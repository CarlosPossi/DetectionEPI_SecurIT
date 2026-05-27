from flask import Flask
from flask_socketio import SocketIO
from ultralytics import YOLO
import cv2
import numpy as np
import os


import requests

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*")
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
model_path = os.path.join(BASE_DIR, "deteccaoepi.pt")

model = YOLO(model_path)
print(f"YOLO Model loaded with labels: {model.names}")

from deepface import DeepFace
import json

SPI_API_URL = "http://localhost:3000/api/employees"

def cosine_distance(a, b):
    return 1 - (np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))

def get_employees():
    try:
        response = requests.get(SPI_API_URL)
        if response.status_code == 200:
            return response.json()
    except Exception as e:
        print(f"Error fetching employees: {e}")
    return []

def update_employee_face(employee_id, encoding):
    try:
        url = f"{SPI_API_URL}/{employee_id}"
        response = requests.patch(url, json={"faceEncoding": json.dumps(encoding)})
        return response.status_code == 200
    except Exception as e:
        print(f"Error updating employee: {e}")
    return False

@app.route("/")
def index():
    return "Backend is running!"

import base64
import io
from PIL import Image as PILImage

@socketio.on("identify_face")
def handle_identify_face(data):
    try:
        print("--- IDENTIFY FACE START ---")
        if isinstance(data, bytes):
            image_bytes = data
        else:
            header, encoded = data.split(",", 1)
            image_bytes = base64.b64decode(encoded)

        npimg = np.frombuffer(image_bytes, np.uint8)
        frame = cv2.imdecode(npimg, cv2.IMREAD_COLOR)

        if frame is None:
            print("ERROR: Image decoding failed")
            socketio.emit("identification_result", {"status": "error", "message": "Invalid image"})
            return

        # Estimativa de distância baseada no tamanho do rosto
        try:
            face_objs = DeepFace.extract_faces(frame, enforce_detection=True, detector_backend='opencv')
            if face_objs:
                face_area = face_objs[0]['facial_area']
                w_face = face_area['w']
                h_frame, w_frame = frame.shape[:2]
                
                print(f"DEBUG: Face width: {w_face}, Frame width: {w_frame}")
                
                if w_face < (w_frame * 0.25):
                    print("GUIDANCE: Aproxime-se")
                    socketio.emit("identification_result", {"status": "no_face", "message": "Aproxime-se mais"})
                    return
                elif w_face > (w_frame * 0.75):
                    print("GUIDANCE: Afaste-se")
                    socketio.emit("identification_result", {"status": "no_face", "message": "Afaste-se um pouco"})
                    return
        except Exception as e:
            print(f"DEBUG: No face detected in distance check: {e}")
            socketio.emit("identification_result", {"status": "no_face", "message": "Posicione o rosto"})
            return

        employees = get_employees()
        known_employees = [e for e in employees if e.get("faceEncoding")]
        print(f"INFO: Checking against {len(known_employees)} registered faces")
        
        if not known_employees:
            print("INFO: No registered faces found in DB. Please register a face first.")
            socketio.emit("identification_result", {"status": "unknown"})
            return

        try:
            results = DeepFace.represent(frame, model_name="VGG-Face", enforce_detection=True)
        except Exception as e:
            print(f"DEBUG: Face detection failed during representation: {e}")
            socketio.emit("identification_result", {"status": "no_face"})
            return

        if not results:
            socketio.emit("identification_result", {"status": "no_face"})
            return
        
        current_embedding = results[0]["embedding"]
        best_match = None
        threshold = 0.4  # Strict threshold for VGG-Face cosine distance
        min_dist = 1.0 

        print(f"DEBUG: Comparing against {len(known_employees)} employees...")
        for emp in known_employees:
            try:
                emp_encoding = emp["faceEncoding"]
                if isinstance(emp_encoding, str):
                    emp_embedding = json.loads(emp_encoding)
                else:
                    emp_embedding = emp_encoding

                dist = cosine_distance(current_embedding, emp_embedding)
                print(f"DEBUG: Distance to {emp['name']}: {dist:.4f}")
                
                if dist < min_dist:
                    min_dist = dist
                    if dist < threshold:
                        best_match = emp
            except Exception as e:
                print(f"ERROR: Comparison failed for {emp.get('name')}: {e}")

        if best_match:
            print(f"SUCCESS: Match found! {best_match['name']} (dist: {min_dist:.4f} < {threshold})")
            socketio.emit("identification_result", {
                "status": "success",
                "user": {
                    "id": best_match["id"],
                    "name": best_match["name"]
                }
            })
        else:
            print(f"INFO: No match found. Best distance was {min_dist:.4f} (Threshold: {threshold})")
            socketio.emit("identification_result", {"status": "unknown"})

    except Exception as e:
        print(f"CRITICAL ERROR in identify_face: {e}")
        socketio.emit("identification_result", {"status": "error", "message": str(e)})

@socketio.on("register_face")
def handle_register_face(data):
    try:
        print("--- REGISTER FACE START ---")
        image_data = data.get("image")
        employee_id = data.get("employeeId")

        if isinstance(image_data, bytes):
            image_bytes = image_data
        else:
            header, encoded = image_data.split(",", 1)
            image_bytes = base64.b64decode(encoded)

        npimg = np.frombuffer(image_bytes, np.uint8)
        frame = cv2.imdecode(npimg, cv2.IMREAD_COLOR)

        if frame is None:
            print("ERROR: Image decoding failed in registration")
            socketio.emit("registration_result", {"status": "error", "message": "Invalid image"})
            return

        # Guia de distância no registro
        try:
            face_objs = DeepFace.extract_faces(frame, enforce_detection=True, detector_backend='opencv')
            if face_objs:
                w_face = face_objs[0]['facial_area']['w']
                w_frame = frame.shape[1]
                print(f"DEBUG: Registration face width: {w_face}, Frame width: {w_frame}")
                if w_face < (w_frame * 0.3):
                    print("GUIDANCE: Aproxime-se para cadastro")
                    socketio.emit("registration_result", {"status": "no_face", "message": "Aproxime-se mais"})
                    return
        except Exception as e:
            print(f"DEBUG: No face detected in registration check: {e}")
            socketio.emit("registration_result", {"status": "no_face", "message": "Posicione o rosto"})
            return

        try:
            results = DeepFace.represent(frame, model_name="VGG-Face", enforce_detection=True)
        except Exception as e:
            print(f"ERROR: Face detection failed during registration: {e}")
            socketio.emit("registration_result", {"status": "no_face"})
            return

        if not results:
            socketio.emit("registration_result", {"status": "no_face"})
            return

        embedding = results[0]["embedding"]
        success = update_employee_face(employee_id, embedding)

        if success:
            print(f"SUCCESS: Face registered for employee {employee_id}")
            socketio.emit("registration_result", {"status": "success"})
        else:
            print(f"ERROR: DB update failed for employee {employee_id}")
            socketio.emit("registration_result", {"status": "error", "message": "Failed to update DB"})

    except Exception as e:
        print(f"CRITICAL ERROR in registration: {e}")
        socketio.emit("registration_result", {"status": "error", "message": str(e)})

@socketio.on("frame")
def handle_frame(data):
    try:
        print("--- FRAME RECEIVED ---")
        # Check if data is bytes (blob) or string (base64)
        if isinstance(data, bytes):
            image_bytes = data
        else:
            header, encoded = data.split(",", 1)
            image_bytes = base64.b64decode(encoded)

        npimg = np.frombuffer(image_bytes, np.uint8)
        frame = cv2.imdecode(npimg, cv2.IMREAD_COLOR)

        if frame is None:
            print("ERROR: Frame decoding failed")
            return

        h, w = frame.shape[:2]

        # YOLO Inference
        results = model.predict(frame, conf=0.25, verbose=False)
        detections = []
        for box in results[0].boxes:
            cls = int(box.cls[0])
            conf = float(box.conf[0])
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            label = model.names[cls]
            detections.append({
                "label": label,
                "box": [x1, y1, x2, y2],
                "conf": conf
            })
        
        if detections:
            print(f"DEBUG: Detections found: {[d['label'] for d in detections]}")
        
        socketio.emit("detections", {
            "detections": detections,
            "width": w,
            "height": h
        })
    except Exception as e:
        print(f"Error processing frame: {e}")

if __name__ == "__main__":
    socketio.run(
        app,
        debug=True,
        host="0.0.0.0",
        port=5001,
        allow_unsafe_werkzeug=True
    )