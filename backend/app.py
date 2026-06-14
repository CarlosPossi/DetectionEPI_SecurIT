from flask import Flask, request, jsonify
from flask_socketio import SocketIO
from ultralytics import YOLO
import cv2
import numpy as np
import os
import base64
import json
from datetime import datetime
from pymongo import MongoClient
from bson import ObjectId
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*")
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
model_path = os.path.join(BASE_DIR, "deteccaoepi.pt")

model = YOLO(model_path)
print(f"YOLO Model loaded with labels: {model.names}")

from deepface import DeepFace

# Database connection
MONGO_URL = os.getenv("DATABASE_URL")
client = MongoClient(MONGO_URL)
db = client.get_database() # Gets database from URI (securit_db)

def serialize_doc(doc):
    if not doc: return None
    doc["id"] = str(doc.pop("_id"))
    return doc

def cosine_distance(a, b):
    return 1 - (np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))

def get_employees():
    try:
        employees = list(db.Employee.find({}))
        return [serialize_doc(e) for e in employees]
    except Exception as e:
        print(f"Error fetching employees from DB: {e}")
    return []

def update_employee_face(employee_id, encoding):
    try:
        result = db.Employee.update_one(
            {"_id": ObjectId(employee_id)},
            {"$set": {"faceEncoding": json.dumps(encoding)}}
        )
        return result.modified_count > 0
    except Exception as e:
        print(f"Error updating employee in DB: {e}")
    return False

@app.route("/")
def index():
    return "Backend is running with direct DB access!"

@app.route("/api/employees", methods=["GET"])
def api_get_employees():
    return jsonify(get_employees())

@app.route("/api/detection", methods=["POST"])
def handle_detection():
    data = request.json
    print("📥 Recebendo dados do Terminal...")
    try:
        employee_name = data.get("employeeName")
        location = data.get("location")
        status = data.get("status")
        compliance = data.get("compliance")
        check_in = data.get("checkIn")
        epis_ok = data.get("episOk", [])
        epis_missing = data.get("episMissing", [])
        alerts = data.get("alerts", [])
        images = data.get("images", [])

        # 1. Create Alert in DB if dangerous
        alert_id = None
        if status == 'danger':
            alert_title = ", ".join(alerts) if alerts else "Violação detectada"
            
            # Deduplicação (10 segundos)
            ten_seconds_ago = datetime.utcnow().timestamp() - 10
            existing_alert = db.Alert.find_one({
                "title": alert_title,
                "location": location or "Terminal",
                "createdAt": {"$gte": datetime.fromtimestamp(ten_seconds_ago)}
            })

            if not existing_alert:
                new_alert = {
                    "type": 'critical',
                    "title": alert_title,
                    "location": location or "Terminal",
                    "time": datetime.now().strftime("%H:%M"),
                    "images": images,
                    "description": f"Monitoramento IA detectou baixa conformidade para {employee_name}",
                    "createdAt": datetime.utcnow()
                }
                res = db.Alert.insert_one(new_alert)
                alert_id = str(res.inserted_id)
                print(f"🚨 Alerta criado no DB: {alert_id}")

        # 2. Update Employee and add Activity
        if employee_name:
            clean_name = employee_name.strip()
            employee = db.Employee.find_one({"name": {"$regex": f"^{clean_name}$", "$options": "i"}})

            if employee:
                emp_id = employee["_id"]
                if status == 'offline':
                    db.Employee.update_one(
                        {"_id": emp_id},
                        {"$set": {"status": 'offline', "location": "Pendente", "lastCheck": "Pendente"}}
                    )
                    print(f"🔌 Sessão encerrada para: {employee_name}")
                    return jsonify({"success": True})

                check_time = check_in or (employee.get("lastCheck") if employee.get("lastCheck") != 'Pendente' else datetime.now().strftime("%H:%M"))
                rounded_compliance = round(compliance) if compliance is not None else employee.get("compliance", 100)

                # Update Employee
                db.Employee.update_one(
                    {"_id": emp_id},
                    {"$set": {
                        "status": 'alert' if status == 'danger' else 'ok',
                        "compliance": rounded_compliance,
                        "location": location or employee.get("location"),
                        "lastCheck": check_time
                    }}
                )

                # Create Activity
                new_activity = {
                    "type": 'alert' if status == 'danger' else 'check',
                    "title": f"Violação: {', '.join(alerts)}" if status == 'danger' else ("EPI Verificado (Check-in)" if check_in else "EPI Verificado"),
                    "time": datetime.now().strftime("%H:%M"),
                    "location": location or employee.get("location"),
                    "status": 'alert' if status == 'danger' else 'ok',
                    "compliance": rounded_compliance,
                    "episOk": epis_ok,
                    "episMissing": epis_missing,
                    "employeeId": emp_id,
                    "createdAt": datetime.utcnow()
                }
                db.Activity.insert_one(new_activity)
                print(f"👤 {employee_name} atualizado. Status: {status}. Compliance: {rounded_compliance}%")

        return jsonify({"success": True, "alertId": alert_id})
    except Exception as e:
        print(f"❌ Erro na API de Detecção: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

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
                    "name": best_match["name"],
                    "requiredEPIs": best_match.get("requiredEPIs", [])
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