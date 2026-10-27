import sys
import time
import argparse
import cv2
import requests

# Initialize OpenCV built-in HOG descriptor for human detection
try:
    hog = cv2.HOGDescriptor()
    hog.setSVMDetector(cv2.HOGDescriptor_getDefaultPeopleDetector())
    HOG_READY = True
except Exception as e:
    print(f"[ERROR] Failed to initialize HOG Descriptor: {e}")
    HOG_READY = False

def detect_humans(frame):
    """Detects humans in the frame and returns bounding boxes and count."""
    if not HOG_READY:
        return 0, []
    # Resize frame to standard size to speed up HOG processing
    resized = cv2.resize(frame, (640, 480))
    # Detect people
    (rects, weights) = hog.detectMultiScale(resized, winStride=(8, 8), padding=(8, 8), scale=1.05)
    return len(rects), rects

def main():
    parser = argparse.ArgumentParser(description="VisionGrid AI Camera Detection Edge Client")
    parser.add_argument("--camera", type=str, default="0", help="Camera index (0, 1) or RTSP URL")
    parser.add_argument("--room", type=str, default="A101", help="Target Room ID (e.g. A101, A102)")
    parser.add_argument("--endpoint", type=str, default="http://localhost:8000/update-state", help="Backend update-state URL")
    parser.add_argument("--interval", type=float, default=2.0, help="Detection interval seconds")
    parser.add_argument("--cooldown", type=float, default=10.0, help="Empty room cooldown seconds")
    parser.add_argument("--headless", action="store_true", help="Run without GUI window")
    args = parser.parse_args()

    print("==========================================================")
    print("      VisionGrid AI - Local Camera Detection Engine       ")
    print("==========================================================")
    print(f"Target Room: {args.room}")
    print(f"Target API Endpoint: {args.endpoint}")
    print(f"AI Sample Rate: Once every {args.interval} seconds")
    print(f"Empty Cooldown Timer: {args.cooldown} seconds")
    print("----------------------------------------------------------")

    # Initialize Camera Capture
    source = int(args.camera) if args.camera.isdigit() else args.camera
    print(f"Initializing camera stream (Source: {source})...")
    
    if isinstance(source, int):
        cap = cv2.VideoCapture(source, cv2.CAP_DSHOW)
        if not cap.isOpened():
            cap = cv2.VideoCapture(source)
    else:
        cap = cv2.VideoCapture(source)

    camera_connected = True
    if not cap.isOpened():
        print(f"[WARNING] Camera could not be opened (source {args.camera}).")
        print("Switching AI Engine to [SIMULATION MODE] using synthetic frame loops...")
        camera_connected = False

    occupied_state = False
    empty_since = None

    try:
        while True:
            start_time = time.time()
            human_count = 0
            rects = []

            if camera_connected:
                ret, frame = cap.read()
                if not ret:
                    print("[ERROR] Failed to read frame from webcam.")
                    time.sleep(2)
                    continue

                human_count, rects = detect_humans(frame)

                if not args.headless:
                    # Draw boxes
                    for (x, y, w, h) in rects:
                        cv2.rectangle(frame, (x, y), (x + w, y + h), (0, 212, 255), 2)
                        cv2.putText(frame, "HUMAN", (x, y - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 212, 255), 2)

                    status_txt = f"Room {args.room}: {'OCCUPIED' if occupied_state else 'EMPTY'} | Count: {human_count}"
                    cv2.putText(frame, status_txt, (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.7,
                                (0, 255, 0) if occupied_state else (0, 0, 255), 2)
                    cv2.imshow(f"VisionGrid AI - Camera [{args.room}]", frame)

                    if cv2.waitKey(1) & 0xFF == ord('q'):
                        print("Exiting capture loop...")
                        break
            else:
                cycle = int(time.time() / 15) % 2
                human_count = 2 if cycle == 0 else 0
                print(f"[SIMULATION] Mock Camera Processing [{args.room}]: Found {human_count} occupants.")

            # State cooldown machine
            if human_count > 0:
                empty_since = None
                if not occupied_state:
                    print(f"💡 Occupancy detected in Room {args.room}! [{human_count} humans]. Pushing STATE = OCCUPIED...")
                    occupied_state = True
                    try:
                        resp = requests.post(args.endpoint, json={"occupied": True, "room_id": args.room, "people_count": human_count}, timeout=2.0)
                        print(f"Backend Sync Response: {resp.status_code}")
                    except Exception as e:
                        print(f"[ERROR] Could not connect to FastAPI Backend: {e}")
            else:
                if occupied_state:
                    if empty_since is None:
                        empty_since = time.time()
                        print(f"⚠️ Room {args.room} is empty! Cooldown countdown initiated for {args.cooldown} seconds...")

                    elapsed = time.time() - empty_since
                    print(f"Cooldown active: {elapsed:.1f}s / {args.cooldown}s remaining...")

                    if elapsed >= args.cooldown:
                        print(f"⏱️ Cooldown expired! Pushing STATE = EMPTY for Room {args.room}...")
                        occupied_state = False
                        empty_since = None
                        try:
                            resp = requests.post(args.endpoint, json={"occupied": False, "room_id": args.room, "people_count": 0}, timeout=2.0)
                            print(f"Backend Sync Response: {resp.status_code}")
                        except Exception as e:
                            print(f"[ERROR] Could not connect to FastAPI Backend: {e}")

            elapsed_processing = time.time() - start_time
            sleep_dur = max(0.1, args.interval - elapsed_processing)
            time.sleep(sleep_dur)

    except KeyboardInterrupt:
        print("AI engine stopped by keyboard interrupt.")
    finally:
        if camera_connected and cap is not None:
            cap.release()
            cv2.destroyAllWindows()
            print("Camera stream released.")
        print("Engine offline.")

if __name__ == "__main__":
    main()
