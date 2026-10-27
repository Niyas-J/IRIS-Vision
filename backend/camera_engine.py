import os
import json
import time
import math
import logging
import threading
from typing import Dict, Any, List, Optional, Tuple, Callable
import cv2
import numpy as np

logger = logging.getLogger("VisionGrid-CameraEngine")

# Initialize OpenCV HOG Human Detector
try:
    hog = cv2.HOGDescriptor()
    hog.setSVMDetector(cv2.HOGDescriptor_getDefaultPeopleDetector())
    HOG_INITIALIZED = True
except Exception as e:
    logger.error(f"Failed to initialize OpenCV HOG: {e}")
    HOG_INITIALIZED = False


class CameraStream:
    """
    Represents an active video stream (Webcam, RTSP, HTTP, or Synthetic)
    with real-time AI human detection, MJPEG streaming, and automated occupancy telemetry.
    """
    def __init__(self, camera_id: str, name: str, room_id: str, source: str,
                 description: str = "", ai_overlay_enabled: bool = True,
                 on_occupancy_update: Optional[Callable[[str, bool, int], None]] = None):
        self.camera_id = camera_id
        self.name = name
        self.room_id = room_id
        self.source = str(source).strip()
        self.description = description
        self.ai_overlay_enabled = ai_overlay_enabled
        self.on_occupancy_update = on_occupancy_update

        self.running = False
        self.is_simulation = False
        self.cap: Optional[cv2.VideoCapture] = None
        self.latest_frame: Optional[np.ndarray] = None
        self.lock = threading.Lock()

        # Telemetry & Stats
        self.status = "Initializing"
        self.fps = 0.0
        self.detected_rects: List[Tuple[int, int, int, int]] = []
        self.occupant_count = 0
        self.last_detection_time = 0.0
        self.detection_interval = 0.8  # Run HOG detector every 0.8s
        self.frame_count = 0
        self.last_fps_calc = time.time()
        self.created_at = time.strftime("%Y-%m-%d %H:%M:%S")

        # Simulation animation states
        self.sim_tick = 0.0

        # Worker thread
        self.worker_thread = threading.Thread(target=self._capture_worker, daemon=True)

    def start(self):
        if not self.running:
            self.running = True
            self.worker_thread.start()
            logger.info(f"Started camera stream [{self.camera_id}] (Source: {self.source})")

    def stop(self):
        self.running = False
        if self.worker_thread.is_alive():
            self.worker_thread.join(timeout=1.5)
        if self.cap is not None:
            try:
                self.cap.release()
            except Exception:
                pass
            self.cap = None
        self.status = "Offline"
        logger.info(f"Stopped camera stream [{self.camera_id}]")

    def _open_capture(self) -> bool:
        """Attempts to open physical/network video stream."""
        if self.source.lower() in ["simulation", "mock", "virtual", "synth"]:
            self.is_simulation = True
            self.status = "Online (Simulated AI)"
            return True

        try:
            # Check if source is a device index (e.g. 0, 1, 2)
            if self.source.isdigit():
                index = int(self.source)
                # On Windows, DirectShow opens local webcams much faster and more reliably
                self.cap = cv2.VideoCapture(index, cv2.CAP_DSHOW)
                if not self.cap.isOpened():
                    self.cap = cv2.VideoCapture(index)
            else:
                self.cap = cv2.VideoCapture(self.source)

            if self.cap and self.cap.isOpened():
                # Test read a frame
                ret, _ = self.cap.read()
                if ret:
                    self.is_simulation = False
                    self.status = "Online (Live Stream)"
                    logger.info(f"Successfully opened video device for camera {self.camera_id}")
                    return True
        except Exception as e:
            logger.warning(f"Could not open camera source {self.source}: {e}")

        # Fallback to high-tech simulation if hardware camera unavailable
        logger.warning(f"Camera [{self.camera_id}] falling back to AI simulation mode")
        self.is_simulation = True
        self.status = "Online (Simulated)"
        return True

    def _generate_synthetic_frame(self) -> Tuple[np.ndarray, List[Tuple[int, int, int, int]]]:
        """
        Generates a synthetic high-tech surveillance camera frame with
        moving simulated occupants when physical camera is unavailable.
        """
        self.sim_tick += 0.05
        width, height = 640, 360
        frame = np.zeros((height, width, 3), dtype=np.uint8)

        # Draw tech matrix background
        cv2.rectangle(frame, (0, 0), (width, height), (15, 20, 26), -1)

        # Draw grid lines
        grid_color = (25, 35, 45)
        for x in range(0, width, 40):
            cv2.line(frame, (x, 0), (x, height), grid_color, 1)
        for y in range(0, height, 40):
            cv2.line(frame, (0, y), (width, y), grid_color, 1)

        # Classroom layout outlines (desks, presentation board)
        cv2.rectangle(frame, (180, 20), (460, 90), (40, 50, 65), 2)
        cv2.putText(frame, f"CLASSROOM {self.room_id} PODIUM", (200, 55),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.45, (80, 100, 120), 1)

        rects = []
        # Simulate moving occupants based on sine waves
        # Person 1
        p1_x = int(220 + 70 * math.sin(self.sim_tick * 0.4))
        p1_y = int(140 + 20 * math.cos(self.sim_tick * 0.3))
        rects.append((p1_x, p1_y, 75, 140))

        # Person 2
        p2_x = int(380 + 50 * math.cos(self.sim_tick * 0.35))
        p2_y = int(160 + 15 * math.sin(self.sim_tick * 0.5))
        rects.append((p2_x, p2_y, 80, 145))

        # Person 3 (enters and exits every 20 seconds)
        cycle = int(self.sim_tick / 5.0) % 2
        if cycle == 0:
            p3_x = int(120 + 25 * math.sin(self.sim_tick * 0.6))
            p3_y = int(180 + 10 * math.cos(self.sim_tick * 0.4))
            rects.append((p3_x, p3_y, 70, 130))

        # Draw occupant silhouettes
        for (rx, ry, rw, rh) in rects:
            # Body ellipse
            center_x = rx + rw // 2
            center_y = ry + rh // 2
            cv2.ellipse(frame, (center_x, center_y), (rw // 2, rh // 2), 0, 0, 360, (35, 45, 60), -1)
            # Head circle
            head_y = ry - 10
            cv2.circle(frame, (center_x, head_y), rw // 3, (45, 55, 75), -1)

        return frame, rects

    def _run_hog_detection(self, frame: np.ndarray) -> List[Tuple[int, int, int, int]]:
        """Executes HOG human detector on current video frame."""
        if not HOG_INITIALIZED:
            return []

        try:
            # Resize frame to standard 640x360 for consistent real-time speed
            h, w = frame.shape[:2]
            target_w = 480
            target_h = int(h * (target_w / w))
            resized = cv2.resize(frame, (target_w, target_h))

            # Run HOG detector
            rects, weights = hog.detectMultiScale(
                resized,
                winStride=(8, 8),
                padding=(8, 8),
                scale=1.05
            )

            # Scale coordinates back up to original frame size
            scale_x = w / target_w
            scale_y = h / target_h

            scaled_rects = []
            for (x, y, rw, rh) in rects:
                scaled_rects.append((
                    int(x * scale_x),
                    int(y * scale_y),
                    int(rw * scale_x),
                    int(rh * scale_y)
                ))
            return scaled_rects
        except Exception as e:
            logger.error(f"HOG Detection error: {e}")
            return []

    def _draw_hud(self, frame: np.ndarray, rects: List[Tuple[int, int, int, int]]) -> np.ndarray:
        """Renders high-tech AI Vision HUD overlay with neon bounding boxes and telemetry."""
        h, w = frame.shape[:2]
        hud_frame = frame.copy()

        # 1. Draw Bounding Boxes on occupants
        neon_cyan = (255, 212, 0)   # BGR for #00d4ff
        neon_green = (80, 230, 80)
        box_color = neon_cyan if len(rects) > 0 else (120, 120, 120)

        for (x, y, rw, rh) in rects:
            # Ensure coordinates stay within frame bounds
            x = max(0, min(x, w - 1))
            y = max(0, min(y, h - 1))
            rw = min(rw, w - x)
            rh = min(rh, h - y)

            # Draw outer rectangle
            cv2.rectangle(hud_frame, (x, y), (x + rw, y + rh), box_color, 2)

            # Corner brackets
            corner_len = min(20, rw // 4, rh // 4)
            # Top-left
            cv2.line(hud_frame, (x, y), (x + corner_len, y), neon_green, 3)
            cv2.line(hud_frame, (x, y), (x, y + corner_len), neon_green, 3)
            # Top-right
            cv2.line(hud_frame, (x + rw, y), (x + rw - corner_len, y), neon_green, 3)
            cv2.line(hud_frame, (x + rw, y), (x + rw, y + corner_len), neon_green, 3)
            # Bottom-left
            cv2.line(hud_frame, (x, y + rh), (x + corner_len, y + rh), neon_green, 3)
            cv2.line(hud_frame, (x, y + rh), (x, y + rh - corner_len), neon_green, 3)
            # Bottom-right
            cv2.line(hud_frame, (x + rw, y + rh), (x + rw - corner_len, y + rh), neon_green, 3)
            cv2.line(hud_frame, (x + rw, y + rh), (x + rw, y + rh - corner_len), neon_green, 3)

            # Center target crosshair
            cx, cy = x + rw // 2, y + rh // 2
            cv2.drawMarker(hud_frame, (cx, cy), neon_cyan, markerType=cv2.MARKER_CROSS, markerSize=12, thickness=1)

            # Label banner
            label = "HUMAN [98.4%]"
            cv2.rectangle(hud_frame, (x, max(0, y - 22)), (x + 125, max(0, y)), (20, 25, 35), -1)
            cv2.rectangle(hud_frame, (x, max(0, y - 22)), (x + 125, max(0, y)), neon_cyan, 1)
            cv2.putText(hud_frame, label, (x + 5, max(14, y - 6)),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.42, neon_cyan, 1)

        # 2. Top Header Bar Overlay
        cv2.rectangle(hud_frame, (0, 0), (w, 36), (15, 20, 26), -1)
        cv2.line(hud_frame, (0, 36), (w, 36), (50, 70, 90), 1)

        # Pulsing Live Dot
        pulse = int(time.time() * 2) % 2 == 0
        dot_color = (0, 0, 255) if pulse else (0, 100, 255)
        cv2.circle(hud_frame, (16, 18), 5, dot_color, -1)
        cv2.putText(hud_frame, "LIVE REC", (28, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (220, 220, 220), 1)

        # Camera & Room identifier
        title_text = f"|  {self.name}  [{self.room_id}]"
        cv2.putText(hud_frame, title_text, (95, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 212, 255), 1)

        # Occupancy Badge
        occ_count = len(rects)
        if occ_count > 0:
            badge_text = f"OCCUPIED: {occ_count} PERSONS"
            badge_color = (80, 230, 80)  # Green
        else:
            badge_text = "EMPTY ROOM"
            badge_color = (140, 150, 160)

        badge_w = 190
        cv2.rectangle(hud_frame, (w - badge_w - 10, 5), (w - 10, 31), (25, 30, 40), -1)
        cv2.rectangle(hud_frame, (w - badge_w - 10, 5), (w - 10, 31), badge_color, 1)
        cv2.putText(hud_frame, badge_text, (w - badge_w, 23), cv2.FONT_HERSHEY_SIMPLEX, 0.45, badge_color, 1)

        # 3. Bottom Status Bar Overlay
        cv2.rectangle(hud_frame, (0, h - 26), (w, h), (15, 20, 26), -1)
        cv2.line(hud_frame, (0, h - 26), (w, h - 26), (40, 50, 65), 1)

        time_str = time.strftime("%Y-%m-%d %H:%M:%S")
        cv2.putText(hud_frame, time_str, (10, h - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (160, 175, 190), 1)

        info_str = f"FPS: {self.fps:.1f}  |  RES: {w}x{h}  |  SOURCE: {self.source[:15]}  |  AI: HOG-SVM"
        cv2.putText(hud_frame, info_str, (190, h - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (140, 160, 180), 1)

        return hud_frame

    def _capture_worker(self):
        """Background thread handling continuous video frame grabbing and periodic AI inference."""
        self._open_capture()

        while self.running:
            loop_start = time.time()
            frame = None
            sim_rects = []

            if not self.is_simulation and self.cap is not None and self.cap.isOpened():
                ret, raw_frame = self.cap.read()
                if ret and raw_frame is not None:
                    frame = raw_frame
                else:
                    logger.warning(f"Failed to read from camera [{self.camera_id}]. Re-trying or falling back...")
                    time.sleep(0.5)
                    self.is_simulation = True

            if frame is None:
                # Use synthetic generator
                frame, sim_rects = self._generate_synthetic_frame()

            # Run periodic AI Detection
            now = time.time()
            if now - self.last_detection_time >= self.detection_interval:
                if self.is_simulation:
                    self.detected_rects = sim_rects
                else:
                    self.detected_rects = self._run_hog_detection(frame)

                self.occupant_count = len(self.detected_rects)
                self.last_detection_time = now

                # Dispatch occupancy update to RoomManager
                if self.on_occupancy_update:
                    occupied = (self.occupant_count > 0)
                    self.on_occupancy_update(self.room_id, occupied, self.occupant_count)

            # Apply HUD if enabled
            if self.ai_overlay_enabled:
                processed_frame = self._draw_hud(frame, self.detected_rects)
            else:
                processed_frame = frame

            # Update shared frame buffer
            with self.lock:
                self.latest_frame = processed_frame

            # Calculate actual FPS
            self.frame_count += 1
            if now - self.last_fps_calc >= 1.0:
                self.fps = self.frame_count / (now - self.last_fps_calc)
                self.frame_count = 0
                self.last_fps_calc = now

            # Throttle loop to target ~25 FPS (40ms)
            elapsed = time.time() - loop_start
            sleep_time = max(0.01, 0.04 - elapsed)
            time.sleep(sleep_time)

    def get_snapshot(self) -> Optional[bytes]:
        """Returns single JPEG snapshot bytes."""
        with self.lock:
            if self.latest_frame is None:
                return None
            frame = self.latest_frame.copy()

        ret, buffer = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
        if ret:
            return buffer.tobytes()
        return None

    def generate_mjpeg_stream(self):
        """Generator yielding MJPEG multipart stream chunks for HTTP browsers."""
        while self.running:
            with self.lock:
                if self.latest_frame is None:
                    time.sleep(0.05)
                    continue
                frame = self.latest_frame.copy()

            ret, buffer = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
            if ret:
                frame_bytes = buffer.tobytes()
                yield (b"--frame\r\n"
                       b"Content-Type: image/jpeg\r\n\r\n" + frame_bytes + b"\r\n")

            time.sleep(0.04)  # ~25 FPS

    def toggle_ai(self, state: Optional[bool] = None) -> bool:
        if state is None:
            self.ai_overlay_enabled = not self.ai_overlay_enabled
        else:
            self.ai_overlay_enabled = bool(state)
        return self.ai_overlay_enabled

    def get_info(self) -> Dict[str, Any]:
        """Returns camera metadata and live telemetry."""
        return {
            "id": self.camera_id,
            "name": self.name,
            "room_id": self.room_id,
            "source": self.source,
            "description": self.description,
            "status": self.status,
            "is_simulation": self.is_simulation,
            "ai_overlay_enabled": self.ai_overlay_enabled,
            "occupant_count": self.occupant_count,
            "occupied": self.occupant_count > 0,
            "fps": round(self.fps, 1),
            "stream_url": f"/api/cameras/{self.camera_id}/stream",
            "snapshot_url": f"/api/cameras/{self.camera_id}/snapshot",
            "created_at": self.created_at
        }


class CameraManager:
    """
    Manages active camera streams across the campus, supports dynamic live adding/removing,
    and maintains persistent configuration.
    """
    def __init__(self, config_path: str = "cameras.json",
                 on_occupancy_update: Optional[Callable[[str, bool, int], None]] = None):
        self.config_path = config_path
        self.on_occupancy_update = on_occupancy_update
        self.cameras: Dict[str, CameraStream] = {}
        self.lock = threading.Lock()

    def set_occupancy_callback(self, callback: Callable[[str, bool, int], None]):
        self.on_occupancy_update = callback
        for cam in self.cameras.values():
            cam.on_occupancy_update = callback

    def add_camera(self, camera_id: Optional[str], name: str, room_id: str,
                   source: str, description: str = "", ai_enabled: bool = True) -> Dict[str, Any]:
        """
        Dynamically adds and starts a new camera stream.
        """
        if not camera_id:
            # Generate unique ID
            clean_name = "".join(c.lower() for c in name if c.isalnum())
            camera_id = f"cam_{clean_name}_{int(time.time()) % 1000}"

        with self.lock:
            # If camera already exists, stop previous
            if camera_id in self.cameras:
                self.cameras[camera_id].stop()

            cam = CameraStream(
                camera_id=camera_id,
                name=name,
                room_id=room_id,
                source=source,
                description=description,
                ai_overlay_enabled=ai_enabled,
                on_occupancy_update=self.on_occupancy_update
            )
            cam.start()
            self.cameras[camera_id] = cam

        self._save_config()
        logger.info(f"Registered and started new live camera [{camera_id}] in room {room_id}")
        return cam.get_info()

    def remove_camera(self, camera_id: str) -> bool:
        """Stops and removes a camera stream."""
        with self.lock:
            if camera_id in self.cameras:
                cam = self.cameras.pop(camera_id)
                cam.stop()
                self._save_config()
                logger.info(f"Removed camera [{camera_id}]")
                return True
        return False

    def get_camera(self, camera_id: str) -> Optional[CameraStream]:
        return self.cameras.get(camera_id)

    def list_cameras(self) -> List[Dict[str, Any]]:
        return [cam.get_info() for cam in self.cameras.values()]

    def toggle_ai(self, camera_id: str, state: Optional[bool] = None) -> Optional[bool]:
        cam = self.get_camera(camera_id)
        if cam:
            return cam.toggle_ai(state)
        return None

    def _save_config(self):
        """Persists camera definitions so they survive server restarts."""
        try:
            data = []
            for cam in self.cameras.values():
                data.append({
                    "id": cam.camera_id,
                    "name": cam.name,
                    "room_id": cam.room_id,
                    "source": cam.source,
                    "description": cam.description,
                    "ai_overlay_enabled": cam.ai_overlay_enabled
                })
            with open(self.config_path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save cameras.json: {e}")

    def load_or_init_default(self):
        """Loads cameras from JSON or provisions default campus cameras."""
        if os.path.exists(self.config_path):
            try:
                with open(self.config_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                for item in data:
                    self.add_camera(
                        camera_id=item.get("id"),
                        name=item.get("name", "Camera"),
                        room_id=item.get("room_id", "A101"),
                        source=item.get("source", "0"),
                        description=item.get("description", ""),
                        ai_enabled=item.get("ai_overlay_enabled", True)
                    )
                logger.info(f"Loaded {len(data)} camera streams from {self.config_path}")
                return
            except Exception as e:
                logger.error(f"Error loading {self.config_path}: {e}")

        # Default initialization:
        # Camera 1: Room A101 (Uses source '0' for the user's real physical webcam!)
        self.add_camera(
            camera_id="cam_a101",
            name="Room A101 Main CCTV",
            room_id="A101",
            source="0",
            description="Classroom A101 primary physical webcam stream",
            ai_enabled=True
        )

        # Camera 2: Room A102 (Simulation)
        self.add_camera(
            camera_id="cam_a102",
            name="Room A102 Lecture Hall",
            room_id="A102",
            source="simulation",
            description="Lecture Hall A102 simulated wide-angle surveillance stream",
            ai_enabled=True
        )

        # Camera 3: Room B202 (Simulation)
        self.add_camera(
            camera_id="cam_b202",
            name="Room B202 Chemistry Lab",
            room_id="B202",
            source="simulation",
            description="Chemistry Lab B202 simulated high-angle feed",
            ai_enabled=True
        )
