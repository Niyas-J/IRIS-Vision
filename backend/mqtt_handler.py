import json
import logging
import threading
import time
from typing import Callable, Optional, Dict, Any, List

logger = logging.getLogger("VisionGrid-MQTT")

try:
    import paho.mqtt.client as mqtt
    PAHO_AVAILABLE = True
except ImportError:
    PAHO_AVAILABLE = False
    logger.warning("paho-mqtt not installed; running in virtual MQTT bus mode.")

class MQTTHandler:
    def __init__(self, broker: str = "localhost", port: int = 1883,
                 on_telemetry_received: Optional[Callable[[str, Dict[str, Any]], None]] = None):
        self.broker = broker
        self.port = port
        self.on_telemetry_received = on_telemetry_received
        self.connected = False
        self.running = True
        self.client: Optional[Any] = None
        self.activity_log: List[str] = [
            f"[{time.strftime('%H:%M:%S')}] MQTT virtual bus initialized on channel visiongrid/#"
        ]

        if PAHO_AVAILABLE:
            try:
                self.client = mqtt.Client("VisionGrid_Backend_Controller")
                self.client.on_connect = self._on_connect
                self.client.on_disconnect = self._on_disconnect
                self.client.on_message = self._on_message
            except Exception as e:
                logger.error(f"Failed to create MQTT client: {e}")

        # Start background connection supervisor
        self.supervisor_thread = threading.Thread(target=self._connection_supervisor, daemon=True)
        self.supervisor_thread.start()

    def log_activity(self, msg: str):
        timestamp = time.strftime("%H:%M:%S")
        entry = f"[{timestamp}] {msg}"
        self.activity_log = [entry] + self.activity_log[:40]
        logger.info(f"MQTT Pipe: {msg}")

    def _on_connect(self, client, userdata, flags, rc):
        if rc == 0:
            self.connected = True
            logger.info(f"Successfully connected to Mosquitto MQTT Broker at {self.broker}:{self.port}")
            self.log_activity(f"Broker Connected: {self.broker}:{self.port}")
            # Subscribe to all room telemetry and control channels
            client.subscribe("visiongrid/+/telemetry")
            client.subscribe("visiongrid/+/power")
        else:
            self.connected = False
            logger.warning(f"MQTT Broker returned connection code: {rc}")

    def _on_disconnect(self, client, userdata, rc):
        self.connected = False
        logger.warning(f"Disconnected from MQTT Broker (code {rc})")
        self.log_activity("Broker connection lost. Switching to virtual event pipeline.")

    def _on_message(self, client, userdata, msg):
        try:
            topic = msg.topic
            payload_str = msg.payload.decode("utf-8")
            self.log_activity(f"RX topic [{topic}]: {payload_str}")

            parts = topic.split("/")
            # topic pattern: visiongrid/{room_id}/telemetry
            if len(parts) >= 3 and parts[2] == "telemetry":
                room_id = parts[1]
                data = json.loads(payload_str)
                if self.on_telemetry_received:
                    self.on_telemetry_received(room_id, data)
        except Exception as e:
            logger.error(f"Error handling incoming MQTT message: {e}")

    def _connection_supervisor(self):
        """Continuously attempts to connect or reconnect to Mosquitto if down."""
        while self.running:
            if PAHO_AVAILABLE and self.client and not self.connected:
                try:
                    self.client.connect(self.broker, self.port, keepalive=60)
                    self.client.loop_start()
                    # Sleep while connected
                    while self.connected and self.running:
                        time.sleep(2)
                except Exception as e:
                    # Broker offline, will retry quietly every 10s
                    time.sleep(10)
            else:
                time.sleep(5)

    def publish_power(self, room_id: str, state_val: str):
        """Publishes power state (ON/OFF) to topic visiongrid/{room_id}/power."""
        topic = f"visiongrid/{room_id}/power"
        self.log_activity(f"TX [{topic}] -> {state_val} (Relay Trigger)")

        if self.connected and self.client:
            try:
                self.client.publish(topic, state_val, qos=1, retain=True)
            except Exception as e:
                logger.error(f"Failed to publish to MQTT: {e}")

    def publish_telemetry(self, room_id: str, payload: Dict[str, Any]):
        """Publishes telemetry packet."""
        topic = f"visiongrid/{room_id}/telemetry"
        payload_str = json.dumps(payload)
        self.log_activity(f"TX [{topic}] -> {payload_str}")

        if self.connected and self.client:
            try:
                self.client.publish(topic, payload_str, qos=0, retain=False)
            except Exception as e:
                logger.error(f"Failed to publish telemetry to MQTT: {e}")

    def get_status(self) -> Dict[str, Any]:
        return {
            "broker": f"{self.broker}:{self.port}",
            "connected": self.connected,
            "mode": "Live Mosquitto Broker" if self.connected else "Virtual MQTT Pipeline (Simulated & Active)",
            "recent_activity": self.activity_log[:15]
        }
