import os
import json
import time
import asyncio
import logging
from typing import Set, Dict, Any, Optional
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Request, Response
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from room_manager import RoomManager
from mqtt_handler import MQTTHandler
from camera_engine import CameraManager

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("VisionGrid-Backend")

app = FastAPI(
    title="VisionGrid AI - Central Automation & Camera Server",
    description="Smart Classroom Energy Management with Real-Time Computer Vision and IoT Telemetry",
    version="2.0.0"
)

# Enable CORS for frontend and external connections
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Base directories
BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent
CONFIG_PATH = str(BASE_DIR / "cameras.json")

# Main async event loop reference for thread-safe websocket broadcasts
main_loop: Optional[asyncio.AbstractEventLoop] = None
active_websockets: Set[WebSocket] = set()

# ==================== MANAGERS INITIALIZATION ====================

def on_room_state_change(room_data: Dict[str, Any]):
    """Invoked when any room state changes (occupancy, power, ESP32 status)."""
    schedule_websocket_broadcast({
        "type": "room_update",
        "room": room_data,
        # Backward compatibility fields for single-room frontend (Room A101)
        "room_id": room_data.get("room_id"),
        "occupied": room_data.get("occupied", False),
        "power_status": room_data.get("power_status", "OFF"),
        "esp32_status": room_data.get("esp32_status", "Disconnected"),
        "last_seen_esp32": room_data.get("last_seen_esp32", 0.0)
    })

def on_mqtt_publish(room_id: str, power_state: str):
    """Dispatches relay power state command via MQTT handler."""
    mqtt_handler.publish_power(room_id, power_state)

def on_esp32_telemetry(room_id: str, data: Dict[str, Any]):
    """Processes incoming MQTT telemetry from ESP32."""
    room_manager.handle_esp32_heartbeat(room_id, data)

room_manager = RoomManager(
    on_state_change=on_room_state_change,
    on_mqtt_publish=on_mqtt_publish
)

mqtt_handler = MQTTHandler(
    broker="localhost",
    port=1883,
    on_telemetry_received=on_esp32_telemetry
)

def on_camera_occupancy_update(room_id: str, occupied: bool, people_count: int):
    """Callback from CameraStream when AI detector finds occupants."""
    room_manager.update_occupancy(
        room_id=room_id,
        occupied=occupied,
        people_count=people_count,
        source="CCTV AI Vision"
    )

camera_manager = CameraManager(
    config_path=CONFIG_PATH,
    on_occupancy_update=on_camera_occupancy_update
)

# ==================== ASYNC WEBSOCKET BROADCASTING ====================

def schedule_websocket_broadcast(payload: Dict[str, Any]):
    """Thread-safe scheduler to broadcast payloads via WebSockets."""
    global main_loop
    if main_loop and main_loop.is_running() and active_websockets:
        asyncio.run_coroutine_threadsafe(broadcast_payload(payload), main_loop)

async def broadcast_payload(payload: Dict[str, Any]):
    """Sends JSON payload to all active WebSocket subscribers."""
    message = json.dumps(payload)
    disconnected = set()
    for ws in list(active_websockets):
        try:
            await ws.send_text(message)
        except Exception:
            disconnected.add(ws)

    for ws in disconnected:
        active_websockets.discard(ws)

# ==================== LIFECYCLE HOOKS ====================

@app.on_event("startup")
async def startup_event():
    global main_loop
    main_loop = asyncio.get_running_loop()
    logger.info("Initializing VisionGrid camera engine and streams...")
    camera_manager.load_or_init_default()

    # Start background task to monitor ESP32 offline timeouts
    asyncio.create_task(esp32_timeout_supervisor())
    logger.info("VisionGrid Backend Server started successfully!")

@app.on_event("shutdown")
def shutdown_event():
    logger.info("Shutting down active camera streams...")
    for cam in camera_manager.cameras.values():
        cam.stop()

async def esp32_timeout_supervisor():
    """Checks for timed out ESP32 connections every 5 seconds."""
    while True:
        try:
            room_manager.check_esp32_timeouts(timeout_seconds=45.0)
        except Exception as e:
            logger.error(f"Error in timeout supervisor: {e}")
        await asyncio.sleep(5)

# ==================== PYDANTIC SCHEMAS ====================

class AddCameraRequest(BaseModel):
    name: str = Field(..., example="Room A101 Main Camera")
    room_id: str = Field(..., example="A101")
    source: str = Field(..., example="0", description="Webcam index (0, 1), RTSP URL, HTTP URL, or 'simulation'")
    camera_id: Optional[str] = Field(None, example="cam_a101_webcam")
    description: Optional[str] = Field("", example="High-definition front classroom camera")
    ai_enabled: Optional[bool] = Field(True, description="Enable real-time AI bounding box HUD and detection")

class UpdateStateRequest(BaseModel):
    occupied: bool
    room_id: Optional[str] = "A101"
    people_count: Optional[int] = 1

# ==================== DYNAMIC CAMERA MANAGEMENT API ====================

@app.get("/api/cameras")
def list_cameras():
    """Returns list of all active cameras and live metrics."""
    return {"cameras": camera_manager.list_cameras(), "total": len(camera_manager.cameras)}

@app.post("/api/cameras")
def add_camera(payload: AddCameraRequest):
    """
    Dynamically adds a new camera stream in real time.
    Supports physical webcams (0, 1, 2), RTSP streams, HTTP MJPEG URLs, or simulation.
    """
    logger.info(f"Adding new live camera: {payload.name} for Room {payload.room_id} (Source: {payload.source})")
    room_manager.ensure_room(payload.room_id)
    
    cam_info = camera_manager.add_camera(
        camera_id=payload.camera_id,
        name=payload.name,
        room_id=payload.room_id,
        source=payload.source,
        description=payload.description or "",
        ai_enabled=payload.ai_enabled if payload.ai_enabled is not None else True
    )

    room_manager.register_camera_to_room(cam_info["id"], payload.room_id)

    # Broadcast camera added event
    schedule_websocket_broadcast({
        "type": "camera_added",
        "camera": cam_info
    })

    return {"status": "success", "camera": cam_info}

@app.get("/api/cameras/{camera_id}")
def get_camera_details(camera_id: str):
    """Returns metadata and live telemetry for a specific camera."""
    cam = camera_manager.get_camera(camera_id)
    if not cam:
        raise HTTPException(status_code=404, detail=f"Camera '{camera_id}' not found")
    return cam.get_info()

@app.delete("/api/cameras/{camera_id}")
def delete_camera(camera_id: str):
    """Stops and removes an active camera stream."""
    cam = camera_manager.get_camera(camera_id)
    if not cam:
        raise HTTPException(status_code=404, detail=f"Camera '{camera_id}' not found")

    room_id = cam.room_id
    success = camera_manager.remove_camera(camera_id)
    if success:
        room_manager.unregister_camera_from_room(camera_id, room_id)
        schedule_websocket_broadcast({
            "type": "camera_removed",
            "camera_id": camera_id
        })
        return {"status": "success", "message": f"Camera '{camera_id}' removed successfully"}
    raise HTTPException(status_code=500, detail="Failed to remove camera")

@app.post("/api/cameras/{camera_id}/toggle-ai")
def toggle_camera_ai(camera_id: str):
    """Toggles AI detection bounding box HUD overlay for a camera."""
    new_state = camera_manager.toggle_ai(camera_id)
    if new_state is None:
        raise HTTPException(status_code=404, detail=f"Camera '{camera_id}' not found")
    return {"status": "success", "camera_id": camera_id, "ai_overlay_enabled": new_state}

@app.get("/api/cameras/{camera_id}/stream")
def get_camera_stream(camera_id: str):
    """
    Real-Time MJPEG Live Video Feed Endpoint.
    Can be loaded directly in any HTML <img> tag: <img src="/api/cameras/cam_a101/stream">
    """
    cam = camera_manager.get_camera(camera_id)
    if not cam:
        raise HTTPException(status_code=404, detail=f"Camera '{camera_id}' not found")

    return StreamingResponse(
        cam.generate_mjpeg_stream(),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )

@app.get("/api/cameras/{camera_id}/snapshot")
def get_camera_snapshot(camera_id: str):
    """Returns a single live JPEG snapshot frame from the camera."""
    cam = camera_manager.get_camera(camera_id)
    if not cam:
        raise HTTPException(status_code=404, detail=f"Camera '{camera_id}' not found")

    snapshot_bytes = cam.get_snapshot()
    if not snapshot_bytes:
        raise HTTPException(status_code=503, detail="Camera frame not ready yet")

    return Response(content=snapshot_bytes, media_type="image/jpeg")

# ==================== ROOM & CONTROL APIS ====================

@app.get("/api/rooms")
def get_all_rooms():
    """Returns list of all classrooms and their live automation statuses."""
    return {"rooms": room_manager.get_all_rooms()}

@app.get("/api/rooms/{room_id}")
def get_room_details(room_id: str):
    room = room_manager.get_room(room_id)
    if not room:
        raise HTTPException(status_code=404, detail=f"Room '{room_id}' not found")
    return room

@app.post("/api/rooms/{room_id}/toggle")
def toggle_room(room_id: str):
    """Manual power switch override for a specific room."""
    updated = room_manager.toggle_power(room_id)
    return {"status": "success", "room": updated}

@app.get("/room-status")
def get_legacy_room_status(room_id: str = "A101"):
    """Backward compatibility endpoint for Classroom A101 / specified room."""
    room = room_manager.get_room(room_id)
    if not room:
        return room_manager.ensure_room(room_id)
    return room

@app.get("/device-status")
def get_legacy_device_status(room_id: str = "A101"):
    """Backward compatibility endpoint for ESP32 device status."""
    room = room_manager.get_room(room_id) or room_manager.ensure_room(room_id)
    return {"device_id": room["device_id"], "status": room["esp32_status"]}

@app.post("/update-state")
def update_occupancy_state(payload: UpdateStateRequest):
    """
    Backward compatibility endpoint for external AI engines (e.g., ai-engine/detector.py).
    Updates room occupancy and triggers automated relay actions.
    """
    room_id = payload.room_id or "A101"
    changed = room_manager.update_occupancy(
        room_id=room_id,
        occupied=payload.occupied,
        people_count=payload.people_count or 1,
        source="External AI Engine"
    )
    room = room_manager.get_room(room_id)
    return {"status": "success", "state_changed": changed, "room_state": room}

@app.post("/toggle-room")
def toggle_legacy_room(room_id: str = "A101"):
    """Backward compatibility toggle endpoint for Room A101."""
    room = room_manager.toggle_power(room_id)
    return {"status": "success", "power_status": room["power_status"], "room_state": room}

@app.post("/api/devices/heartbeat")
def record_device_heartbeat(payload: Dict[str, Any]):
    """Receives HTTP heartbeat from ESP32 or test simulators."""
    room_id = payload.get("room_id", "A101")
    room_manager.handle_esp32_heartbeat(room_id, payload)
    return {"status": "success", "message": f"Heartbeat recorded for {room_id}"}

# ==================== SYSTEM & TELEMETRY ====================

@app.get("/api/system/stats")
def get_system_stats():
    """Campus summary statistics."""
    rooms = room_manager.get_all_rooms()
    total_occupied = sum(1 for r in rooms if r["occupied"])
    total_people = sum(r["people_count"] for r in rooms)
    devices_online = sum(1 for r in rooms if r["esp32_status"] == "Connected")

    return {
        "total_rooms": len(rooms),
        "occupied_rooms": total_occupied,
        "total_people_detected": total_people,
        "devices_online": devices_online,
        "active_cameras": len(camera_manager.cameras),
        "mqtt_status": mqtt_handler.get_status()
    }

@app.get("/api/telemetry/logs")
def get_telemetry_logs():
    return {"logs": mqtt_handler.activity_log}

# ==================== WEBSOCKET HUB ====================

@app.websocket("/ws")
async def websocket_hub(websocket: WebSocket):
    await websocket.accept()
    active_websockets.add(websocket)
    logger.info(f"WebSocket client connected. Active: {len(active_websockets)}")

    # Initial state handshake: Send full snapshot matching both single and multi-room formats
    room_a101 = room_manager.get_room("A101") or room_manager.ensure_room("A101")
    init_packet = {
        "type": "init",
        "rooms": room_manager.get_all_rooms(),
        "cameras": camera_manager.list_cameras(),
        # Single-room fallback fields
        "room_id": "A101",
        "occupied": room_a101["occupied"],
        "power_status": room_a101["power_status"],
        "esp32_status": room_a101["esp32_status"],
        "last_seen_esp32": room_a101["last_seen_esp32"]
    }

    try:
        await websocket.send_text(json.dumps(init_packet))
    except Exception as e:
        logger.error(f"Error sending WS handshake: {e}")

    try:
        while True:
            data = await websocket.receive_text()
            # Handle string or JSON commands
            if data == "toggle":
                room_manager.toggle_power("A101")
            else:
                try:
                    cmd = json.loads(data)
                    action = cmd.get("action")
                    target_room = cmd.get("room_id", "A101")
                    if action == "toggle":
                        room_manager.toggle_power(target_room)
                    elif action == "ping":
                        await websocket.send_text(json.dumps({"type": "pong", "time": time.time()}))
                except json.JSONDecodeError:
                    pass
    except WebSocketDisconnect:
        active_websockets.discard(websocket)
        logger.info(f"WebSocket client disconnected. Remaining: {len(active_websockets)}")
    except Exception as e:
        logger.error(f"WebSocket session error: {e}")
        active_websockets.discard(websocket)

# ==================== STATIC WEB APPLICATION SERVING ====================

@app.get("/")
def serve_index():
    index_file = PROJECT_ROOT / "index.html"
    if index_file.exists():
        return FileResponse(str(index_file))
    return {"name": "VisionGrid AI Central Control Server", "version": "2.0.0"}

@app.get("/styles.css")
def serve_styles():
    css_file = PROJECT_ROOT / "styles.css"
    if css_file.exists():
        return FileResponse(str(css_file), media_type="text/css")
    raise HTTPException(status_code=404)

@app.get("/app.js")
def serve_app_js():
    js_file = PROJECT_ROOT / "app.js"
    if js_file.exists():
        return FileResponse(str(js_file), media_type="application/javascript")
    raise HTTPException(status_code=404)

if __name__ == "__main__":
    import uvicorn
    logger.info("Starting VisionGrid FastAPI Server on port 8000...")
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=False)
