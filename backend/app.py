from flask import Flask
from flask_socketio import SocketIO
from ultralytics import YOLO
import cv2
import numpy as np
import os


app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*")
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
model_path = os.path.join(BASE_DIR, "deteccaoepi.pt")

model = YOLO(model_path)

@socketio.on("frame")
def handle_frame(data):
    npimg = np.frombuffer(data, np.uint8)
    frame = cv2.imdecode(npimg, cv2.IMREAD_COLOR)

    
    h, w = frame.shape[:2]

    results = model.predict(frame, conf=0.25, verbose=False)

    detections = []

    for box in results[0].boxes:
        cls = int(box.cls[0])
        conf = float(box.conf[0])
        x1, y1, x2, y2 = box.xyxy[0].tolist()

        detections.append({
            "label": model.names[cls],
            "box": [x1, y1, x2, y2],
            "conf": conf
        })

    
    socketio.emit("detections", {
        "detections": detections,
        "width": w,
        "height": h
    })

if __name__ == "__main__":
    socketio.run(
        app,
        debug=True,
        host="0.0.0.0",
        port=5000,
        allow_unsafe_werkzeug=True
    )