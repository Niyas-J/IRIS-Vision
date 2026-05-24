# VisionGrid AI — Hardware Node & Relay Wiring Manual
This document details the hardware bill of materials, approximate pricing, breadboard connection schematics, and critical safety guidelines for deploying the prototype Classroom Automation node.

---

## ⚠️ ELECTRICAL SAFETY WARNING
> [!CAUTION]
> **PROTOTYPE VOLTAGE LIMITATION:**
> *   This project guide is intended **ONLY** for safe, low-voltage prototype testing (`5V` or `12V` DC circuits, e.g., low-voltage LEDs or small DC PC fans).
> *   **DO NOT directly connect high-voltage AC utility grid systems (110V/220V AC mains)** to this circuit without proper electrical qualification, appropriate junction box enclosures, and direct supervision by a licensed electrician.
> *   Always disconnect the USB power cable from the ESP32 before adjusting any jumper wires.

---

## 1. Hardware Manifest & Pricing List

To assemble one complete local prototype node, acquire the following standard maker components:

| Component Name | Purpose | Approximate Price (USD) | Source Recommendation |
| :--- | :--- | :--- | :--- |
| **ESP32 NodeMCU Dev Kit** | Core IoT controller with onboard Wi-Fi / Bluetooth | $4.00 - $6.00 | Amazon / AliExpress / Adafruit |
| **5V Optocoupler Relay Module** | Electro-mechanical switch to control the load circuit | $1.50 - $2.50 | Songle 5V Relay Board (Active-High/Low) |
| **5V USB Breadboard Power Module** | Steady 5V DC power source for the relay and ESP32 | $2.00 | MB102 Breadboard Power Supply |
| **Mock Load: 5V DC LED Bulb or Fan** | Simulated classroom appliance (light/fan) | $1.50 | 5V USB LED bulb or 5V computer cooling fan |
| **Solderless Breadboard** | Interconnecting jumper wires and components | $2.00 | 400 or 830 point breadboard |
| **DuPont Jumper Wires** | Connector cables (Male-to-Male, Female-to-Male) | $2.00 | 40-pin ribbon pack |
| **Micro-USB Data Cable** | Flashing code from Arduino IDE and supplying power | $1.50 | Standard high-quality sync/charge cable |
| **Webcam / Integrated Camera** | Capture live footage for OpenCV occupant detections | -- | Standard built-in laptop camera or USB camera |
| **TOTAL ESTIMATED NODE COST** | *(Excluding camera)* | **~$15.00** | -- |

---

## 2. ESP32 to Relay Schematic Connections

The following diagram maps the jumper wire routes from the ESP32 development board pins to the 5V relay module input pins:

```text
    ┌──────────────────────────────────┐            ┌────────────────────────┐
    │          ESP32 DEV KIT           │            │  5V SINGLE-CHANNEL     │
    │                                  │            │     RELAY MODULE       │
    │                   [ VIN ] ──(5V)─┼────────────┼──► [ VCC ]             │
    │                   [ GND ] ───────┼────────────┼──► [ GND ]             │
    │      (Trigger)    [ D25 ] ───────┼────────────┼──► [ IN ]  (Signal)    │
    └──────────────────────────────────┘            └────────────────────────┘
```

### Pin Wiring Details

1.  **VCC Connection**: Connect the **VIN** pin of the ESP32 (which outputs 5V DC when plugged into a USB port) directly to the **VCC** pin of the relay module.
2.  **GND Connection**: Connect a **GND** pin of the ESP32 to the **GND** pin of the relay module.
3.  **Signal Connection**: Connect the ESP32 **GPIO 25 (labeled D25)** pin to the **IN** (or SIG) pin of the relay module.

---

## 3. Safe Low-Voltage Load Wiring

To test the physical automation loop safely, wire a **5V LED** or **5V DC Fan** through the relay switch using a standard 5V USB breakout or battery pack as the load power source:

```text
                                       Relay Terminal Blocks
                                      ┌──────────────────────┐
                                      │  NO  │  COM  │  NC   │
                                      └──┬───┴───┬───┴───────┘
                                         │       │
             ┌───────────────────────────┘       └──────────────┐
             │                                                  │
             ▼                                                  ▼
     ┌──────────────┐                                    ┌──────────────┐
     │  Load (+)    │                                    │  Power (+)   │
     │  Bulb / Fan  │                                    │  5V Source   │
     │  Ground (-)  │◄───────────────────────────────────│  Ground (-)  │
     └──────────────┘                                    └──────────────┘
```

### Load Wiring Steps
1.  Cut a standard USB cable to expose the red (+5V) and black (GND) wires.
2.  Route the **Black (GND)** wire directly to the ground (-) terminal of the bulb/fan.
3.  Route the **Red (+5V)** wire to the **COM (Common)** terminal screw of the relay module.
4.  Connect a separate wire from the **NO (Normally Open)** terminal screw of the relay to the positive (+) terminal of the bulb/fan.
5.  **Result**: The circuit remains broken by default. When the AI Engine detects occupancy, the ESP32 drives GPIO 25 High, activating the electromagnet inside the relay. The COM terminal physically clicks down to connect with the NO terminal, closing the loop and lighting the bulb!

---

## 4. Key Engineering Safety Concepts

### Optocoupler Isolation
Most standard relay modules include an onboard **optocoupler** (e.g., PC817). This optoelectronic component transfers electrical signals between the ESP32 circuit and the relay switch circuit using light waves inside an enclosed IC. This provides total **galvanic isolation**, preventing any high-current surges in the load circuit from back-feeding into the ESP32 pins and frying your computer's USB port.

### Fuse Protection
If you eventually scale this system to larger DC devices (like 12V classroom door actuators), always place an **inline fast-blow fuse** (e.g., 2A or 5A depending on the load) on the positive wire of your power supply. If a short circuit occurs, the fuse blows instantly, preventing thermal damage or fire.
