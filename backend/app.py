from flask import Flask, request, jsonify, session
from flask_cors import CORS
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
import time
import requests
import atexit
import signal
import sys

load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = 'securit-secret-key'
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")

# Dicionário para rastrear sessões ativas (socket_id -> employee_id)
active_sessions = {}

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
model_path = os.path.join(BASE_DIR, "deteccaoepi.pt")

model = YOLO(model_path)
print(f"YOLO Model loaded with labels: {model.names}")

last_state = "OK"
last_change_time = 0
DEBOUNCE_SECONDS = 1.0

# Mapeia o id de EPI usado na tela (Sector.requiredEPIs / EpiSelection) para o(s)
# label(s) reais que o modelo YOLO retorna. Usado pelo alarme físico (ESP32)
# pra exigir TODOS os EPIs do setor, e não só a luva.
EPI_LABEL_MAP = {
    "helmet": {"capacete"},
    "vest": {"colete", "macacao"},
    "mask": {"mascara-cirurgica"},
    "glasses": {"oculos"},
    "gloves": {"luva"},
    "boots": {"sapato"},
}

# sid -> lista de ids de EPI exigidos na sessão atual (vem do frontend via
# o evento "set_required_epis", emitido quando o setor/local é confirmado).
required_epis_by_sid = {}

from deepface import DeepFace

# Database connection
MONGO_URL = os.getenv("DATABASE_URL")
client = MongoClient(MONGO_URL)
db = client.get_database() # Gets database from URI (securit_db)

DEVICE_STATE_ID = "esp32_buzzer"

def set_device_state(state: str):
    """Grava o estado do alarme (ALERTA/OK) no MongoDB. Fonte da verdade para o ESP32.
    Chamado só quando o estado MUDA (não a cada frame)."""
    try:
        db["DeviceState"].update_one(
            {"_id": DEVICE_STATE_ID},
            {"$set": {
                "state": state,
                "updatedAt": datetime.utcnow(),
                "lastSeenAt": datetime.utcnow()  # também conta como "sinal de vida"
            }},
            upsert=True
        )
        print(f"💾 Estado do alarme salvo no MongoDB: {state}")
    except Exception as e:
        print("ERRO ao salvar estado do alarme no DB:", e)

def touch_alive():
    """Atualiza só o 'sinal de vida' (chamado a cada frame processado, mude o
    estado ou não). É isso que o endpoint usa pra saber se o monitoramento
    ainda está realmente ativo, sem depender só da última mudança de estado."""
    try:
        db["DeviceState"].update_one(
            {"_id": DEVICE_STATE_ID},
            {"$set": {"lastSeenAt": datetime.utcnow()},
            "$setOnInsert": {"state": "OK", "updatedAt": datetime.utcnow()}},
            upsert=True
        )
    except Exception as e:
        print("ERRO ao atualizar sinal de vida do alarme:", e)

def trigger_alert():
    set_device_state("ALERTA")

def stop_alert():
    set_device_state("OK")

def cleanup_active_sessions():
    """Garante que quando o backend/terminal do detectionEPI for encerrado, todas as sessões ativas fiquem offline."""
    try:
        print("🛑 Encerrando sessões ativas do terminal...")
        db["Employee"].update_many(
            {"status": {"$ne": "offline"}},
            {"$set": {
                "status": "offline",
                "compliance": 0,
                "location": "Pendente",
                "lastCheck": "Pendente",
                "lastHeartbeat": None
            }}
        )
        stop_alert()
        print("✅ Sessões ativas encerradas com sucesso.")
    except Exception as e:
        print(f"Erro ao limpar sessões: {e}")

atexit.register(cleanup_active_sessions)

def signal_handler(sig, frame):
    cleanup_active_sessions()
    sys.exit(0)

signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)
if hasattr(signal, "SIGHUP"):
    signal.signal(signal.SIGHUP, signal_handler)

def serialize_doc(doc):
    if not doc: return None
    doc["id"] = str(doc.pop("_id"))
    return doc

def cosine_distance(a, b):
    return 1 - (np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))

def get_employees():
    try:
        employees = list(db["Employee"].find({}))
        return [serialize_doc(e) for e in employees]
    except Exception as e:
        print(f"Error fetching employees from DB: {e}")
    return []

def update_employee_face(employee_id, encoding):
    try:
        result = db["Employee"].update_one(
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

@app.route("/api/health")
def health_check():
    try:
        # Tenta realizar um comando simples no banco de dados
        client.admin.command('ping')
        return jsonify({
            "status": "online",
            "database": "connected",
            "timestamp": datetime.utcnow().isoformat()
        }), 200
    except Exception as e:
        return jsonify({
            "status": "error",
            "database": "disconnected",
            "message": str(e)
        }), 500

@app.route("/api/employees", methods=["GET"])
def api_get_employees():
    unregistered_only = request.args.get("unregistered") == "true"
    print(f"DEBUG: GET /api/employees - unregistered_only: {unregistered_only}")
    try:
        query = {}
        if unregistered_only:
            query = {"$or": [{"faceEncoding": {"$exists": False}}, {"faceEncoding": None}, {"faceEncoding": ""}]}
        
        print(f"DEBUG: Query: {query}")
        employees = list(db["Employee"].find(query))
        print(f"DEBUG: Found {len(employees)} employees")
        
        serialized = [serialize_doc(e) for e in employees]
        return jsonify(serialized)
    except Exception as e:
        print(f"ERROR fetching employees: {e}")
        return jsonify([]), 500

@app.route("/api/sectors", methods=["GET"])
def api_get_sectors():
    try:
        sectors = list(db["Sector"].find({}).sort("name", 1))
        
        # Auto-seed if empty to ensure sectors are always available
        if not sectors:
            default_sectors = [
                { "name": "Setor A - Produção", "description": "Área de máquinas pesadas", "requiredEPIs": ["helmet", "vest", "boots"], "createdAt": datetime.utcnow() },
                { "name": "Setor B - Logística", "description": "Docas e armazenamento", "requiredEPIs": ["vest", "boots", "gloves"], "createdAt": datetime.utcnow() },
                { "name": "Setor C - Almoxarifado", "description": "Estoque de materiais", "requiredEPIs": ["boots", "glasses"], "createdAt": datetime.utcnow() },
                { "name": "Área Externa", "description": "Pátio e carregamento", "requiredEPIs": ["helmet", "vest"], "createdAt": datetime.utcnow() },
                { "name": "Oficina de Manutenção", "description": "Reparos e ferramentas", "requiredEPIs": ["helmet", "gloves", "glasses"], "createdAt": datetime.utcnow() },
            ]
            db["Sector"].insert_many(default_sectors)
            sectors = list(db["Sector"].find({}).sort("name", 1))
            
        serialized = [serialize_doc(s) for s in sectors]
        return jsonify(serialized)
    except Exception as e:
        print(f"Error fetching sectors: {e}")
        return jsonify({"error": "Failed to fetch sectors"}), 500
    
@app.route("/api/alert-status", methods=["GET"])
def api_alert_status():
    """
    Endpoint que o ESP32 consulta via polling (HTTP GET) para saber se deve
    ligar ou desligar o alarme. O estado vem 100% do MongoDB (coleção
    DeviceState), nunca de uma chamada direta/local do backend para o ESP32.
    """
    # Se não chega nenhum frame (monitoramento parado/sessão caiu) há mais que
    # isso, consideramos que não há mais risco sendo avaliado -> força "OK".
    STALE_SECONDS = 8

    try:
        doc = db["DeviceState"].find_one({"_id": DEVICE_STATE_ID})
        state = doc["state"] if doc else "OK"
        updated_at = doc.get("updatedAt") if doc else None
        last_seen_at = doc.get("lastSeenAt") if doc else None

        is_stale = last_seen_at is not None and (
            (datetime.utcnow() - last_seen_at).total_seconds() > STALE_SECONDS
        )
        if is_stale:
            state = "OK"

        return jsonify({
            "state": state,          # "ALERTA" ou "OK"
            "alert": state == "ALERTA",
            "updatedAt": updated_at.isoformat() if updated_at else None,
            "stale": is_stale
        }), 200
    except Exception as e:
        print(f"Error fetching device state: {e}")
        return jsonify({"state": "OK", "alert": False, "error": str(e)}), 500

@app.route("/api/heartbeat", methods=["POST"])
def api_heartbeat():
    data = request.json or {}
    employee_id = data.get("employeeId") or data.get("id")
    employee_name = data.get("employeeName")
    try:
        query = {}
        if employee_id:
            try:
                query = {"_id": ObjectId(employee_id)}
            except Exception:
                pass
        if not query and employee_name:
            import re
            clean_name = employee_name.strip()
            safe_name = re.escape(clean_name)
            query = {"name": {"$regex": f"^{safe_name}$", "$options": "i"}}
        
        if query:
            db["Employee"].update_one(
                query,
                {"$set": {"lastHeartbeat": datetime.utcnow()}}
            )
            return jsonify({"success": True}), 200
    except Exception as e:
        print(f"Erro no heartbeat: {e}")
    return jsonify({"success": False}), 400

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
            existing_alert = db["Alert"].find_one({
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
                res = db["Alert"].insert_one(new_alert)
                alert_id = str(res.inserted_id)
                print(f"🚨 Alerta criado no DB: {alert_id}")

        # 2. Update Employee and add Activity
        employee_id = data.get("employeeId") or data.get("id")
        if employee_id or employee_name:
            employee = None
            if employee_id:
                try:
                    employee = db["Employee"].find_one({"_id": ObjectId(employee_id)})
                except Exception:
                    pass
            if not employee and employee_name:
                import re
                clean_name = employee_name.strip()
                safe_name = re.escape(clean_name)
                employee = db["Employee"].find_one({"name": {"$regex": f"^{safe_name}$", "$options": "i"}})

            if employee:
                emp_id = employee["_id"]
                if status == 'offline':
                    db["Employee"].update_one(
                        {"_id": emp_id},
                        {"$set": {"status": 'offline', "compliance": 0, "location": "Pendente", "lastCheck": "Pendente", "lastHeartbeat": None}}
                    )
                    print(f"🔌 Sessão encerrada para: {employee_name} (Conformidade setada para 0%)")
                    return jsonify({"success": True})

                check_time = check_in or (employee.get("lastCheck") if employee.get("lastCheck") != 'Pendente' else datetime.now().strftime("%H:%M"))
                rounded_compliance = round(compliance) if compliance is not None else employee.get("compliance", 100)

                # Deduplicação (10 segundos por funcionário para evitar gravações duplicadas)
                ten_seconds_ago = datetime.utcnow().timestamp() - 10
                recent_act = db["Activity"].find_one({
                    "employeeId": emp_id,
                    "createdAt": {"$gte": datetime.fromtimestamp(ten_seconds_ago)}
                })
                if recent_act:
                    print(f"⏭️ Evento duplicado ignorado em Python para {employee_name} (Deduplicação de 10s)")
                    return jsonify({"success": True, "message": "Deduplicated"})

                # Regra de Gamificação
                is_check_in = bool(check_in or data.get("isCheckIn"))
                is_compliant = rounded_compliance >= 80
                
                curr_xp = employee.get("xp") if employee.get("xp") is not None else 0
                curr_streak = employee.get("streak") if employee.get("streak") is not None else 0
                curr_total_checks = employee.get("totalChecks") if employee.get("totalChecks") is not None else 0
                curr_compliant_checks = employee.get("compliantChecks") if employee.get("compliantChecks") is not None else 0

                if is_check_in:
                    # Check-in inicial: NÃO soma XP
                    xp_gained = 0
                    new_xp = curr_xp
                    new_streak = curr_streak
                    new_total_checks = curr_total_checks
                    new_compliant_checks = curr_compliant_checks
                else:
                    # Ciclo de 1 minuto monitorado: Estritamente 10 XP por ciclo de conformidade
                    new_total_checks = curr_total_checks + 1
                    if is_compliant:
                        new_compliant_checks = curr_compliant_checks + 1
                        new_streak = curr_streak + 1
                        xp_gained = 10 # Estritamente 10 XP
                        new_xp = curr_xp + xp_gained
                    else:
                        new_compliant_checks = curr_compliant_checks
                        new_streak = 0
                        xp_gained = 0
                        new_xp = curr_xp

                new_level = (new_xp // 100) + 1

                # Update Employee
                db["Employee"].update_one(
                    {"_id": emp_id},
                    {"$set": {
                        "status": 'alert' if status == 'danger' else 'ok',
                        "compliance": rounded_compliance,
                        "location": location or employee.get("location"),
                        "lastCheck": check_time,
                        "lastHeartbeat": datetime.utcnow(),
                        "xp": new_xp,
                        "level": new_level,
                        "streak": new_streak,
                        "totalChecks": new_total_checks,
                        "compliantChecks": new_compliant_checks
                    }}
                )

                # Create Activity
                new_activity = {
                    "type": 'alert' if status == 'danger' else 'check',
                    "title": "EPI Verificado (Check-in)" if is_check_in else (f"EPI Verificado (+10 XP)" if is_compliant else (f"Violação: {', '.join(alerts)}" if status == 'danger' else "EPI Verificado (< 80%)")),
                    "time": datetime.now().strftime("%H:%M"),
                    "location": location or employee.get("location"),
                    "status": 'alert' if status == 'danger' else 'ok',
                    "compliance": rounded_compliance,
                    "episOk": epis_ok,
                    "episMissing": epis_missing,
                    "employeeId": emp_id,
                    "createdAt": datetime.utcnow()
                }
                db["Activity"].insert_one(new_activity)
                print(f"👤 {employee_name} atualizado. Compliance: {rounded_compliance}%. Gamificação: +{xp_gained} XP (Total: {new_xp} XP, Nível: {new_level}, Streak: {new_streak})")

                # 📡 Sincronização direta com o Dashboard SPI_Challenge (Next.js no porto 3000)
                try:
                    requests.post("http://localhost:3000/api/detection", json=data, timeout=1.0)
                    print(f"📡 Sincronizado em tempo real com SPI_Challenge Dashboard (Porto 3000)")
                except Exception as sync_err:
                    pass

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
            
            # Registrar sessão ativa para logout automático no disconnect
            active_sessions[request.sid] = best_match["id"]
            
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
        
@socketio.on("set_required_epis")
def handle_set_required_epis(data):
    """
    Recebido do frontend quando o setor/local é confirmado (ou os EPIs mudam).
    'data' deve ser uma lista de ids, ex: ["helmet", "vest", "gloves"].
    Isso é o que o alarme físico (ESP32) usa pra saber TODOS os EPIs exigidos,
    em vez de checar só a luva.
    """
    try:
        epis = data if isinstance(data, list) else []
        required_epis_by_sid[request.sid] = epis
        print(f"🦺 EPIs exigidos definidos para sessão {request.sid}: {epis}")
    except Exception as e:
        print(f"ERRO ao definir EPIs exigidos: {e}")

@socketio.on("frame")
def handle_frame(data):
    global last_state, last_change_time
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
        detected = set()

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

            detected.add(label)
        
        print("DET;", detected)

        EPIS = required_epis_by_sid.get(request.sid, [])

        faltando = []
        for epi_id in EPIS:
            labels_do_epi = EPI_LABEL_MAP.get(epi_id, set())
            if not (labels_do_epi & detected):  # nenhum label desse EPI foi detectado
                faltando.append(epi_id)

        current_state = "ALERTA" if len(faltando) > 0 else "OK"

        current_state = "ALERTA" if len(faltando) > 0 else "OK"
        
        touch_alive()

        now = time.time()

        if current_state != last_state and (now - last_change_time) > DEBOUNCE_SECONDS:
            print(f"STATE: {last_state} -> {current_state}")

            if current_state == "ALERTA":
                trigger_alert()

            else:
                stop_alert()
            
            last_state = current_state
            last_change_time = now
        

        socketio.emit("debug", {
            "detected": list(detected),
            "faltando": list(faltando),
            "state": current_state
        })
        
        socketio.emit("detections", {
            "detections": detections,
            "width": w,
            "height": h
        })
    except Exception as e:
        print(f"Error processing frame:", e)

@socketio.on("disconnect")
def handle_disconnect():
    global last_state, last_change_time
    sid = request.sid

    required_epis_by_sid.pop(sid, None)

    # 🔕 Failsafe: se a sessão de monitoramento cair (aba fechada, wifi caiu,
    # usuário saiu da tela), ninguém mais vai chamar stop_alert() via handle_frame.
    # Sem isso, o alarme fica preso em "ALERTA" para sempre no banco.
    if last_state == "ALERTA":
        stop_alert()
        last_state = "OK"
        last_change_time = time.time()

    if sid in active_sessions:
        employee_id = active_sessions.pop(sid)
        try:
            db["Employee"].update_one(
                {"_id": ObjectId(employee_id)},
                {"$set": {
                    "status": 'offline',
                    "compliance": 0,
                    "location": "Pendente",
                    "lastCheck": "Pendente",
                    "lastHeartbeat": None,
                }}
            )
            print(f"🔌 Logout automático (Browser Fechado) para o funcionário ID: {employee_id}")
        except Exception as e:
            print(f"❌ Erro ao realizar logout automático no disconnect: {e}")

if __name__ == "__main__":
    socketio.run(
        app,
        debug=True,
        host="0.0.0.0",
        port=5001,
        allow_unsafe_werkzeug=True
    )