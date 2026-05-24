# VisionGrid AI — Installation, Testing & Debugging Manual
This guide provides complete instructions to configure your local software stack, verify the end-to-end signal flow, manually test MQTT brokers, and debug common prototype issues.

---

## 1. Project Folder Structure

Verify that your workspace directory matches the following structure:

```text
iris-vision/
├── ai-engine/
│   └── detector.py         # OpenCV HOG Human Detection and countdown script
├── backend/
│   ├── app.py              # FastAPI server, WebSockets broadcaster, and MQTT handler
│   └── requirements.txt    # Python package dependencies
├── esp32/
│   └── esp32_firmware.ino  # ESP32 Arduino C++ firmware sketch
├── frontend/
│   ├── src/
│   │   ├── App.jsx         # React Glassmorphism Dashboard Logic
│   │   ├── App.css         # Cyberpunk dashboard styling rules
│   │   ├── index.css       # Global stylesheet resets
│   │   └── main.jsx        # React root mount script
│   ├── package.json        # Node npm project configuration
│   ├── vite.config.js      # Vite React bundler configuration
│   └── index.html          # Frontend root DOM hook
├── docs/
│   ├── hardware_setup.md   # Wiring guide, pricing, pins, and safety specs
│   └── testing_guide.md    # THIS MANUAL: installation, scripts, and debugging
└── task.md                 # Project implementation tracking file
```

---

## 2. Software Installation Guide

### Step A: Install Python & Libraries
1.  Download and install **Python (3.9 to 3.11 recommended)** from the official site. Check the box "Add Python to PATH" during installation.
2.  Open your terminal or command prompt inside the `backend/` directory and run:
    ```bash
    pip install -r requirements.txt
    ```

### Step B: Install Mosquitto MQTT Broker
1.  **Windows**: Download the Windows `.exe` installer from [mosquitto.org/download/](https://mosquitto.org/download/). Run the installer.
2.  By default, Mosquitto registers as a local Windows service. To ensure it allows local anonymous connections (crucial for local testing):
    *   Open `C:\Program Files\mosquitto\mosquitto.conf` in a text editor (as administrator).
    *   Add the following lines at the bottom of the file:
        ```text
        listener 1883
        allow_anonymous true
        ```
    *   Open PowerShell as Administrator and restart the service:
        ```powershell
        Restart-Service -Name mosquitto
        ```

### Step C: Configure Arduino IDE for ESP32
1.  Download and install the latest **Arduino IDE**.
2.  Open **File -> Preferences**. In "Additional Boards Manager URLs", paste:
    ```text
    https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
    ```
3.  Go to **Tools -> Board -> Boards Manager**, search for `esp32` by Espressif, and click **Install**.
4.  Go to **Tools -> Manage Libraries**, search for and install:
    *   `PubSubClient` by Nick O'Leary
    *   `ArduinoJson` by Benoit Blanchon
5.  Open `esp32/esp32_firmware.ino`. Adjust Wi-Fi Credentials (`ssid`, `password`) and set `mqtt_server` to your laptop's local IP address.
6.  Connect your ESP32 board using a USB cable. Under **Tools**, select your ESP32 board model and matching COM Port, then click **Upload**.

### Step D: Initialize Vite React Frontend
1.  Install **Node.js LTS** from the official site.
2.  Open a terminal inside the `frontend/` directory and run:
    ```bash
    npm install
    ```

---

## 3. Step-by-Step Signal Flow Testing

To verify the end-to-end integration, launch the modules in the following order:

```text
  [1. Mosquitto Broker] ──► [2. FastAPI Backend] ◄── [3. React Dashboard]
                                   ▲
                                   │ (POST states)
                          [4. Python AI Engine]
                                   │
                          [5. Webcam Frame Capture]
```

### Step 1: Start Mosquitto Broker
Ensure Mosquitto is active on port 1883.

### Step 2: Start the FastAPI Backend
Open a terminal in the `backend/` directory and run:
```bash
python app.py
```
*   *Validation*: You should see `INFO: Launched FastAPI server on port 8000...` and `INFO: Successfully connected to local MQTT Broker!`.

### Step 3: Start the React Dashboard
Open a terminal in the `frontend/` directory and run:
```bash
npm run dev
```
*   Open `http://localhost:3000` in your web browser.
*   *Validation*: The dashboard header connection indicator should instantly show **Broker: ONLINE** as the WebSocket handshake completes.

### Step 4: Launch the AI Detection Engine
Open a terminal in the `ai-engine/` directory and run:
```bash
python detector.py
```
*   *Validation*: A window showing your live webcam feed should open. The terminal will log frame evaluations every 3 seconds.

### Step 5: Test the Automation Trigger
1.  **AI Detection (ON)**: Step in front of the webcam.
    *   *AI Terminal*: Logs `occupancy detected! Pushing STATE = OCCUPIED to backend...`.
    *   *FastAPI Terminal*: Logs status change, publishes command `ON` to topic `visiongrid/A101/power`, and broadcasts over Websockets.
    *   *React Dashboard*: Card updates state to **Occupied: DETECTED** and power status to **ON**.
    *   *ESP32 Node*: Board receives the MQTT `ON` command, switches GPIO 25 High, activating the relay, and turns the bulb **ON**.
2.  **Cooldown Action (OFF)**: Step out of the webcam frame.
    *   *AI Terminal*: Logs `Room is empty! Cooldown countdown initiated...`.
    *   *AI Terminal (10s later)*: Logs `Cooldown expired! Pushing STATE = EMPTY to backend...`.
    *   *FastAPI Terminal*: Publishes `OFF` to `visiongrid/A101/power`.
    *   *React Dashboard*: Syncs state changes.
    *   *ESP32 Node*: Receives `OFF`, drives GPIO 25 Low, switching the relay, turning the bulb **OFF**.

---

## 4. Manual MQTT Connection Debugging

To isolate connection bugs or simulate commands without running the full AI engine, use Mosquitto's built-in command-line tools:

### Monitor All Commands
Open a terminal and listen to all power command signals dispatched by the backend:
```bash
"C:\Program Files\mosquitto\mosquitto_sub.exe" -h localhost -t visiongrid/A101/power -v
```

### Manually Turn Device ON
Force the relay to turn ON without camera trigger:
```bash
"C:\Program Files\mosquitto\mosquitto_pub.exe" -h localhost -t visiongrid/A101/power -m "ON"
```

### Manually Turn Device OFF
Force the relay to turn OFF:
```bash
"C:\Program Files\mosquitto\mosquitto_pub.exe" -h localhost -t visiongrid/A101/power -m "OFF"
```

### Inspect ESP32 Node Telemetry Heartbeats
Monitor RAM heap size, RSSI signal levels, and uptime reported by the ESP32 node:
```bash
"C:\Program Files\mosquitto\mosquitto_sub.exe" -h localhost -t visiongrid/A101/telemetry -v
```

---

## 5. Troubleshooting Common Failures

| Issue | Potential Cause | Troubleshooting & Mitigation Steps |
| :--- | :--- | :--- |
| **FastAPI logs MQTT connection failures** | Mosquitto service is stopped or configuration block is missing | 1. Ensure `allow_anonymous true` is added to `mosquitto.conf`. <br>2. Restart the Windows service via PowerShell: `Restart-Service -Name mosquitto`. |
| **ESP32 state shows 'Disconnected' on Dashboard** | Heartbeat timed out or broker IP is misconfigured | 1. Open Serial Monitor in Arduino IDE at 115200 baudrate.<br>2. Check if WiFi connection is successful.<br>3. Verify that `mqtt_server` in the `.ino` code matches your computer's local IP address (run `ipconfig` in cmd to find it). |
| **AI Engine starts in Simulation Mode** | Camera index 0 is occupied by another app or driver is missing | 1. Close Zoom, Teams, or any web browser currently locking your camera.<br>2. Try changing camera indices in `detector.py`: `cv2.VideoCapture(1)` or `cv2.VideoCapture(-1)`. |
| **Relay board does not switch (no click sound)** | Insufficient current or incorrect GPIO pin driving | 1. Verify VCC is connected to a 5V pin on the ESP32 (some modules do not trigger with 3.3V logic).<br>2. Check if your relay is active-high or active-low. If active-low, swap `HIGH` and `LOW` calls in the Arduino IDE callback. |
| **AI detection triggers repeatedly when room is empty** | Shadows, ceiling fan rotation, or noise triggers SVM | 1. Adjust the camera angle to avoid moving shadows or ceiling fans.<br>2. In `detector.py`, increase the HOG scale parameter slightly (e.g. `scale = 1.08`) or filter small rect boundaries. |
| **WiFi connections drop frequently** | Router channel overload or weak signal | 1. Increase the ESP32 antenna gain by positioning the node closer to the router.<br>2. The C++ firmware automatically handles reconnection loops every 5 seconds to gracefully handle network drops. |
