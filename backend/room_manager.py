import time
import logging
from typing import Dict, Any, List, Optional, Callable

logger = logging.getLogger("VisionGrid-RoomManager")

class RoomManager:
    def __init__(self, on_state_change: Optional[Callable[[Dict[str, Any]], None]] = None,
                 on_mqtt_publish: Optional[Callable[[str, str], None]] = None):
        self.on_state_change = on_state_change
        self.on_mqtt_publish = on_mqtt_publish
        self.empty_cooldown = 10.0  # seconds

        # Default campus classrooms matching frontend definitions
        self.rooms: Dict[str, Dict[str, Any]] = {
            "A101": {
                "room_id": "A101",
                "name": "Classroom A101",
                "type": "Computer Science Lab",
                "occupied": False,
                "people_count": 0,
                "power_status": "OFF",
                "esp32_status": "Disconnected",
                "last_seen_esp32": 0.0,
                "temp": 24.0,
                "lights_on": False,
                "fans_on": False,
                "signal": 89,
                "device_id": "ESP32-A101",
                "mac": "3C:61:05:12:34:A1",
                "fw": "v2.4.1",
                "empty_since": None,
                "cameras": ["cam_a101"],
                "recent_events": ["Room initialized in standby mode"]
            },
            "A102": {
                "room_id": "A102",
                "name": "Lecture Hall A102",
                "type": "Lecture Hall",
                "occupied": False,
                "people_count": 0,
                "power_status": "OFF",
                "esp32_status": "Disconnected",
                "last_seen_esp32": 0.0,
                "temp": 22.0,
                "lights_on": False,
                "fans_on": False,
                "signal": 94,
                "device_id": "ESP32-A102",
                "mac": "3C:61:05:12:34:A2",
                "fw": "v2.4.1",
                "empty_since": None,
                "cameras": ["cam_a102"],
                "recent_events": ["Standby mode active"]
            },
            "A103": {
                "room_id": "A103",
                "name": "Seminar Room A103",
                "type": "Seminar Room",
                "occupied": False,
                "people_count": 0,
                "power_status": "OFF",
                "esp32_status": "Disconnected",
                "last_seen_esp32": 0.0,
                "temp": 25.0,
                "lights_on": False,
                "fans_on": False,
                "signal": 67,
                "device_id": "ESP32-A103",
                "mac": "3C:61:05:12:34:A3",
                "fw": "v2.4.0",
                "empty_since": None,
                "cameras": [],
                "recent_events": ["Standby mode active"]
            },
            "B201": {
                "room_id": "B201",
                "name": "Physics Lab B201",
                "type": "Physics Lab",
                "occupied": False,
                "people_count": 0,
                "power_status": "OFF",
                "esp32_status": "Disconnected",
                "last_seen_esp32": 0.0,
                "temp": 21.0,
                "lights_on": False,
                "fans_on": False,
                "signal": 82,
                "device_id": "ESP32-B201",
                "mac": "3C:61:05:12:34:B1",
                "fw": "v2.4.1",
                "empty_since": None,
                "cameras": [],
                "recent_events": ["Standby mode active"]
            },
            "B202": {
                "room_id": "B202",
                "name": "Chemistry Lab B202",
                "type": "Chemistry Lab",
                "occupied": False,
                "people_count": 0,
                "power_status": "OFF",
                "esp32_status": "Disconnected",
                "last_seen_esp32": 0.0,
                "temp": 23.0,
                "lights_on": False,
                "fans_on": False,
                "signal": 91,
                "device_id": "ESP32-B202",
                "mac": "3C:61:05:12:34:B2",
                "fw": "v2.4.1",
                "empty_since": None,
                "cameras": ["cam_b202"],
                "recent_events": ["Standby mode active"]
            },
            "B203": {
                "room_id": "B203",
                "name": "Biology Lab B203",
                "type": "Biology Lab",
                "occupied": False,
                "people_count": 0,
                "power_status": "OFF",
                "esp32_status": "Disconnected",
                "last_seen_esp32": 0.0,
                "temp": 24.5,
                "lights_on": False,
                "fans_on": False,
                "signal": 75,
                "device_id": "ESP32-B203",
                "mac": "3C:61:05:12:34:B3",
                "fw": "v2.3.8",
                "empty_since": None,
                "cameras": [],
                "recent_events": ["Standby mode active"]
            }
        }

    def ensure_room(self, room_id: str, name: Optional[str] = None, room_type: Optional[str] = None) -> Dict[str, Any]:
        """Ensures a room exists, creates dynamic room if not present."""
        if room_id not in self.rooms:
            self.rooms[room_id] = {
                "room_id": room_id,
                "name": name or f"Room {room_id}",
                "type": room_type or "General Purpose Classroom",
                "occupied": False,
                "people_count": 0,
                "power_status": "OFF",
                "esp32_status": "Disconnected",
                "last_seen_esp32": 0.0,
                "temp": 23.5,
                "lights_on": False,
                "fans_on": False,
                "signal": 80,
                "device_id": f"ESP32-{room_id}",
                "mac": f"3C:61:05:{hash(room_id)%255:02X}:12:99",
                "fw": "v2.4.1",
                "empty_since": None,
                "cameras": [],
                "recent_events": [f"Dynamic room {room_id} registered"]
            }
            logger.info(f"Registered new dynamic room: {room_id}")
        return self.rooms[room_id]

    def get_room(self, room_id: str) -> Optional[Dict[str, Any]]:
        return self.rooms.get(room_id)

    def get_all_rooms(self) -> List[Dict[str, Any]]:
        return list(self.rooms.values())

    def log_room_event(self, room_id: str, event_text: str):
        room = self.rooms.get(room_id)
        if room:
            timestamp = time.strftime("%H:%M:%S")
            room["recent_events"] = ([f"[{timestamp}] {event_text}"] + room["recent_events"])[:10]

    def update_occupancy(self, room_id: str, occupied: bool, people_count: int = 0, source: str = "AI Engine") -> bool:
        """
        Updates occupancy state for a room. Returns True if state changed.
        Handles automated power ON/OFF logic and event dispatch.
        """
        room = self.ensure_room(room_id)
        changed = False

        if occupied:
            room["empty_since"] = None
            room["people_count"] = max(1, people_count)
            if not room["occupied"]:
                room["occupied"] = True
                room["power_status"] = "ON"
                room["lights_on"] = True
                room["fans_on"] = True
                changed = True
                self.log_room_event(room_id, f"Occupancy detected ({room['people_count']} persons) via {source} -> Power ON")
                logger.info(f"Room {room_id}: Occupancy DETECTED -> Power set to ON")
                if self.on_mqtt_publish:
                    self.on_mqtt_publish(room_id, "ON")
        else:
            room["people_count"] = 0
            if room["occupied"]:
                if room["empty_since"] is None:
                    room["empty_since"] = time.time()
                    self.log_room_event(room_id, f"Room empty. Cooldown timer started ({int(self.empty_cooldown)}s)")
                    logger.info(f"Room {room_id}: Empty countdown initiated ({self.empty_cooldown}s)")

                elapsed = time.time() - room["empty_since"]
                if elapsed >= self.empty_cooldown:
                    room["occupied"] = False
                    room["power_status"] = "OFF"
                    room["lights_on"] = False
                    room["fans_on"] = False
                    room["empty_since"] = None
                    changed = True
                    self.log_room_event(room_id, f"Cooldown expired -> Automated Power OFF")
                    logger.info(f"Room {room_id}: Cooldown expired -> Power set to OFF")
                    if self.on_mqtt_publish:
                        self.on_mqtt_publish(room_id, "OFF")

        if changed and self.on_state_change:
            self.on_state_change(room)

        return changed

    def toggle_power(self, room_id: str = "A101") -> Dict[str, Any]:
        """Manual power override switch for a room."""
        room = self.ensure_room(room_id)
        new_power = "OFF" if room["power_status"] == "ON" else "ON"
        room["power_status"] = new_power
        room["lights_on"] = (new_power == "ON")
        room["fans_on"] = (new_power == "ON")

        self.log_room_event(room_id, f"Manual override toggled power to {new_power}")
        logger.info(f"Room {room_id}: Manual override toggle -> {new_power}")

        if self.on_mqtt_publish:
            self.on_mqtt_publish(room_id, new_power)

        if self.on_state_change:
            self.on_state_change(room)

        return room

    def register_camera_to_room(self, camera_id: str, room_id: str):
        room = self.ensure_room(room_id)
        if camera_id not in room["cameras"]:
            room["cameras"].append(camera_id)
            self.log_room_event(room_id, f"Live camera '{camera_id}' attached to room")

    def unregister_camera_from_room(self, camera_id: str, room_id: str):
        room = self.rooms.get(room_id)
        if room and camera_id in room["cameras"]:
            room["cameras"].remove(camera_id)
            self.log_room_event(room_id, f"Camera '{camera_id}' detached from room")

    def handle_esp32_heartbeat(self, room_id: str, data: Optional[Dict[str, Any]] = None):
        """Processes telemetry packet from ESP32."""
        room = self.ensure_room(room_id)
        room["esp32_status"] = "Connected"
        room["last_seen_esp32"] = time.time()
        if data:
            if "temp" in data:
                room["temp"] = float(data["temp"])
            if "signal" in data:
                room["signal"] = int(data["signal"])

        self.log_room_event(room_id, f"ESP32 telemetry ping received (Signal: {room['signal']}%)")
        if self.on_state_change:
            self.on_state_change(room)

    def check_esp32_timeouts(self, timeout_seconds: float = 45.0) -> List[str]:
        """Marks any ESP32 disconnected if heartbeat timed out."""
        disconnected = []
        now = time.time()
        for room_id, room in self.rooms.items():
            if room["esp32_status"] == "Connected":
                if now - room["last_seen_esp32"] > timeout_seconds:
                    room["esp32_status"] = "Disconnected"
                    self.log_room_event(room_id, f"ESP32 heartbeat timeout (>45s). Marked Disconnected")
                    disconnected.append(room_id)
                    if self.on_state_change:
                        self.on_state_change(room)
        return disconnected
