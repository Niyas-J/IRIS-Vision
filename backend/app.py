import json
import logging
import threading
import time
from typing import Set
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import paho.mqtt.client as mqtt

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("VisionGrid-Backend")

app = FastAPI(title="VisionGrid AI - Central Control Backend")

# Enable CORS for frontend connectivity
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================== GLOBAL STATE ENGINE ====================
room_state = {
    "room_id": "A101",
    "occupied": False,
    "power_status": "OFF",
    "esp32_status": "Disconnected",
    "last_seen_esp32": 0.0
}

active_websockets: Set[WebSocket] = set()
MQTT_BROKER = "localhost"
MQTT_PORT = 1883
MQTT_TOPIC_POWER = "visiongrid/A101/power"
MQTT_TOPIC_TELEMETRY = "visiongrid/A101/telemetry"

mqtt_client = mqtt.Client("VisionGrid_Backend_Server")

# ==================== WEBSOCKET BROADCASTER ====================
async def broadcast_state():
    """Broadcasts current room state to all active WebSocket clients."""
    payload = json.dumps(room_state)
    logger.info(f"Broadcasting state via WebSocket: {payload}")
    disconnected_sockets = set()
    for websocket in active_websockets:
        try:
            await websocket.send_text(payload)
        except Exception as e:
            logger.error(f"Error sending WebSocket payload: {e}")
            disconnected_sockets.add(websocket)
            
    for ws in disconnected_sockets:
        active_websockets.remove(ws)

# ==================== MQTT HANDLERS ====================
def on_connect(client, userdata, flags, rc):
    if rc == 0:
        logger.info("Successfully connected to local MQTT Broker!")
        # Subscribe to telemetry channel to listen to ESP32 pings
        client.subscribe(MQTT_TOPIC_TELEMETRY)
        logger.info(f"Subscribed to topic: {MQTT_TOPIC_TELEMETRY}")
    else:
        logger.error(f"MQTT Connection failed with return code: {rc}")

def on_message(client, userdata, msg):
    """Parses incoming telemetry heartbeats from the physical ESP32."""
    global room_state
    try:
        payload_str = msg.payload.decode("utf-8")
        logger.info(f"Received MQTT message on {msg.topic}: {payload_str}")
        
        if msg.topic == MQTT_TOPIC_TELEMETRY:
            data = json.loads(payload_str)
            if data.get("status") == "online":
                import asyncio
                room_state["esp32_status"] = "Connected"
                room_state["last_seen_esp32"] = time.time()
                
                # Broadcast the connection status update
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                loop.run_until_complete(broadcast_state())
                loop.close()
    except Exception as e:
        logger.error(f"Failed to parse incoming MQTT message: {e}")

mqtt_client.on_connect = on_connect
mqtt_client.on_message = on_message

def start_mqtt_loop():
    """Tries to connect to Mosquitto and runs client loop in separate background thread."""
    try:
        logger.info(f"Connecting to MQTT Broker at {MQTT_BROKER}:{MQTT_PORT}...")
        mqtt_client.connect(MQTT_BROKER, MQTT_PORT, 60)
        mqtt_client.loop_forever()
    except Exception as e:
        logger.warning(f"Could not start local MQTT loop (Mosquitto might be offline): {e}")
        logger.warning("Prototype running in simulated state. Toggle commands will still trigger API/WebSockets.")

mqtt_thread = threading.Thread(target=start_mqtt_loop, daemon=True)
mqtt_thread.start()

def publish_power_command(state_val: str):
    """Publishes ON/OFF commands to the MQTT broker."""
    try:
        info = mqtt_client.publish(MQTT_TOPIC_POWER, state_val, qos=1, retain=True)
        logger.info(f"Published Command [{state_val}] to topic: {MQTT_TOPIC_POWER}")
    except Exception as e:
        logger.error(f"MQTT publish failed: {e}")

# ==================== ESP32 OFFLINE MONITOR ====================
def monitor_esp32_heartbeats():
    """Background loop that invalidates ESP32 connection if heartbeat exceeds 45s."""
    global room_state
    import asyncio
    while True:
        time.sleep(5)
        if room_state["esp32_status"] == "Connected":
            elapsed = time.time() - room_state["last_seen_esp32"]
            if elapsed > 45.0:
                logger.warning(f"ESP32 heartbeat timeout! {elapsed:.1f}s since last seen. Marking disconnected.")
                room_state["esp32_status"] = "Disconnected"
                
                # Broadcast connection lost state
                try:
                    loop = asyncio.new_event_loop()
                    asyncio.set_event_loop(loop)
                    loop.run_until_complete(broadcast_state())
                    loop.close()
                except Exception as e:
                    logger.error(f"Failed to run heartbeat broadcast: {e}")

monitor_thread = threading.Thread(target=monitor_esp32_heartbeats, daemon=True)
monitor_thread.start()

# ==================== FASTAPI WEB API ROUTES ====================

@app.get("/")
def read_root():
    return {"name": "VisionGrid AI Central Control Server", "version": "1.0.0"}

@app.get("/room-status")
def get_room_status():
    """Returns full status payload of Classroom A101."""
    return room_state

@app.get("/device-status")
def get_device_status():
    """Returns connected status of ESP32 node."""
    return {"device_id": "ESP32-A101", "status": room_state["esp32_status"]}

@app.post("/update-state")
async def update_occupancy_state(payload: dict):
    """
    Receives detection signals from the local Python AI Engine.
    Triggers MQTT commands and WebSockets broadcasts based on changes.
    """
    global room_state
    occupied = payload.get("occupied", False)
    
    if room_state["occupied"] != occupied:
        room_state["occupied"] = occupied
        logger.info(f"Room state change detected! Occupied: {occupied}")
        
        # Decide power action
        new_power = "ON" if occupied else "OFF"
        room_state["power_status"] = new_power
        
        # Dispatch signal to MQTT broker
        publish_power_command(new_power)
        
        # Broadcast changes immediately to Frontend dashboard
        await broadcast_state()
        
    return {"status": "success", "room_state": room_state}

@app.post("/toggle-room")
async def toggle_room_power():
    """Manual override actuator. Toggles active power status on the fly."""
    global room_state
    
    current_power = room_state["power_status"]
    new_power = "OFF" if current_power == "ON" else "ON"
    
    logger.info(f"Manual override triggered! Power transitioning: {current_power} -> {new_power}")
    room_state["power_status"] = new_power
    
    # Broadcast to ESP32
    publish_power_command(new_power)
    
    # Broadcast to Frontend
    await broadcast_state()
    
    return {"status": "success", "power_status": new_power}

# ==================== WEBSOCKET ENDPOINT ====================
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_websockets.add(websocket)
    logger.info(f"New client connected to Dashboard WebSocket. Active connections: {len(active_websockets)}")
    
    # Send current state instantly on handshake
    try:
        await websocket.send_text(json.dumps(room_state))
    except Exception as e:
        logger.error(f"Error in handshake: {e}")
        
    try:
        while True:
            # Keep socket alive, wait for incoming ping messages if any
            data = await websocket.receive_text()
            # If dashboard sends direct commands via ws
            if data == "toggle":
                await toggle_room_power()
    except WebSocketDisconnect:
        active_websockets.remove(websocket)
        logger.info(f"WebSocket client disconnected. Remaining active connections: {len(active_websockets)}")
    except Exception as e:
        logger.error(f"WebSocket error encountered: {e}")
        if websocket in active_websockets:
            active_websockets.remove(websocket)

if __name__ == "__main__":
    import uvicorn
    logger.info("Launching FastAPI server on port 8000...")
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
