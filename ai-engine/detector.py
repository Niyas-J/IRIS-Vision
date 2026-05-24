import time
import cv2
import requests

# ==================== CONFIGURATION ====================
API_ENDPOINT = "http://localhost:8000/update-state"
FRAME_INTERVAL = 3.0  # Run inference every 3 seconds to optimize CPU
COOLDOWN_PERIOD = 10.0  # Turn off after 10 seconds of empty room

# Initialize the OpenCV built-in HOG descriptor for human detection
hog = cv2.HOGDescriptor()
hog.setSVMDetector(cv2.HOGDescriptor_getDefaultPeopleDetector())

def detect_humans(frame):
    """Detects humans in the frame and returns bounding boxes and count."""
    # Resize frame to speed up HOG processing
    resized = cv2.resize(frame, (640, 480))
    
    # Detect people
    # winStroke = (8, 8), padding = (8, 8), scale = 1.05
    (rects, weights) = hog.detectMultiScale(resized, winStride=(8, 8), padding=(8, 8), scale=1.05)
    
    return len(rects), rects

def main():
    print("==========================================================")
    print("      VisionGrid AI - Local Camera Detection Engine       ")
    print("==========================================================")
    print(f"Target API Endpoint: {API_ENDPOINT}")
    print(f"AI Sample Rate: Once every {FRAME_INTERVAL} seconds")
    print(f"Empty Cooldown Timer: {COOLDOWN_PERIOD} seconds")
    print("----------------------------------------------------------")
    
    # Initialize Camera Capture
    print("Initializing local webcam stream (Camera index 0)...")
    cap = cv2.VideoCapture(0)
    
    camera_connected = True
    if not cap.isOpened():
        print("[WARNING] Local webcam could not be opened (index 0).")
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
                # Capture frame-by-frame
                ret, frame = cap.read()
                if not ret:
                    print("[ERROR] Failed to read frame from webcam.")
                    time.sleep(2)
                    continue
                    
                # Run HOG detector
                human_count, rects = detect_humans(frame)
                
                # Show standard OpenCV visualization window
                # Draw boxes
                for (x, y, w, h) in rects:
                    cv2.rectangle(frame, (x, y), (x + w, y + h), (0, 212, 255), 2)
                    cv2.putText(frame, "HUMAN", (x, y - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 212, 255), 2)
                
                # Draw room state overlay
                status_txt = f"Status: {'OCCUPIED' if occupied_state else 'EMPTY'} | Detections: {human_count}"
                cv2.putText(frame, status_txt, (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0) if occupied_state else (0, 0, 255), 2)
                cv2.imshow("VisionGrid AI - Live Detection View", frame)
                
                # Wait 1ms to process UI window events
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    print("Exiting capture loop...")
                    break
            else:
                # Simulated frame logic (e.g. loops between mock detections)
                # Toggle humans count periodically for prototype testing
                cycle = int(time.time() / 15) % 2
                human_count = 3 if cycle == 0 else 0
                print(f"[SIMULATION] Mock Camera Processing: Found {human_count} occupants.")
            
            # ==================== STATE COOLDOWN MACHINE ====================
            if human_count > 0:
                # Humans detected
                empty_since = None  # Reset timer
                if not occupied_state:
                    print(f"💡 occupancy detected! [{human_count} humans]. Pushing STATE = OCCUPIED to backend...")
                    occupied_state = True
                    # Sync to FastAPI
                    try:
                        resp = requests.post(API_ENDPOINT, json={"occupied": True}, timeout=2.0)
                        print(f"Backend Sync Response: {resp.status_code} - {resp.json()}")
                    except Exception as e:
                        print(f"[ERROR] Could not connect to FastAPI Backend: {e}")
            else:
                # No humans detected
                if occupied_state:
                    if empty_since is None:
                        empty_since = time.time()
                        print(f"⚠️ Room is empty! Cooldown countdown initiated for {COOLDOWN_PERIOD} seconds...")
                    
                    elapsed = time.time() - empty_since
                    print(f"Cooldown active: {elapsed:.1f}s / {COOLDOWN_PERIOD}s remaining...")
                    
                    if elapsed >= COOLDOWN_PERIOD:
                        print(f"⏱️ Cooldown expired! Pushing STATE = EMPTY to backend...")
                        occupied_state = False
                        empty_since = None
                        # Sync to FastAPI
                        try:
                            resp = requests.post(API_ENDPOINT, json={"occupied": False}, timeout=2.0)
                            print(f"Backend Sync Response: {resp.status_code} - {resp.json()}")
                        except Exception as e:
                            print(f"[ERROR] Could not connect to FastAPI Backend: {e}")
            
            # Enforce sampling frequency
            elapsed_processing = time.time() - start_time
            sleep_dur = max(0.1, FRAME_INTERVAL - elapsed_processing)
            time.sleep(sleep_dur)
            
    except KeyboardInterrupt:
        print("AI engine stopped by keyboard interrupt.")
    finally:
        if camera_connected:
            cap.release()
            cv2.destroyAllWindows()
            print("Webcam stream released.")
        print("Engine offline.")

if __name__ == "__main__":
    main()
