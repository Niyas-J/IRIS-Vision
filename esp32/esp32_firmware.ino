/**
 * VisionGrid AI - Smart Classroom Automation Node
 * Target Hardware: ESP32 Development Module
 * 
 * Responsibilities:
 * 1. Establishes robust dual-band Wi-Fi connection.
 * 2. Connects to local Mosquitto MQTT broker on port 1883.
 * 3. Subscribes to classroom relay control topic: "visiongrid/A101/power".
 * 4. Actuates the 5V Relay GPIO Pin based on ON/OFF commands.
 * 5. Publishes a JSON heartbeat telemetry packet every 30 seconds.
 * 6. Automatically recovers from network disconnections.
 * 
 * Required Arduino IDE Libraries:
 * - PubSubClient by Nick O'Leary (MQTT client)
 * - ArduinoJson by Benoit Blanchon (JSON parsing)
 */

#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

// ==================== CONFIGURATION ====================
// Wifi Credentials
const char* ssid     = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// Local MQTT Broker IP (Change to your computer's IP address on the local network)
const char* mqtt_server = "192.168.1.100"; 
const int mqtt_port     = 1883;

// MQTT Topic Definitions
const char* topic_power     = "visiongrid/A101/power";
const char* topic_telemetry = "visiongrid/A101/telemetry";

// Hardware GPIO Pins Setup
const int RELAY_PIN       = 25;  // GPIO pin connected to relay IN channel
const int ONBOARD_LED_PIN = 2;   // Onboard indicator LED

// Timing variables
unsigned long lastHeartbeat = 0;
const long heartbeatInterval = 30000; // Heartbeat interval: 30 seconds

// ==================== OBJECT INSTANTIATION ====================
WiFiClient espClient;
PubSubClient client(espClient);

// ==================== WIFI SETUP CONNECTION ====================
void setup_wifi() {
  delay(10);
  Serial.println();
  Serial.print("Connecting to Wi-Fi SSID: ");
  Serial.println(ssid);

  WiFi.begin(ssid, password);

  // Flash onboard LED while connecting
  while (WiFi.status() != WL_CONNECTED) {
    digitalWrite(ONBOARD_LED_PIN, HIGH);
    delay(250);
    digitalWrite(ONBOARD_LED_PIN, LOW);
    delay(250);
    Serial.print(".");
  }

  Serial.println("");
  Serial.println("Wi-Fi connected successfully!");
  Serial.print("IP Address assigned: ");
  Serial.println(WiFi.localIP());
  digitalWrite(ONBOARD_LED_PIN, LOW); // LED off when connected
}

// ==================== MQTT INCOMING SIGNAL CALLBACK ====================
void callback(char* topic, byte* payload, unsigned int length) {
  Serial.print("Incoming MQTT Message arrived [");
  Serial.print(topic);
  Serial.print("]: ");
  
  // Extract and convert payload to String
  String message = "";
  for (int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  Serial.println(message);

  // Validate topic and toggle relay output
  if (String(topic) == topic_power) {
    if (message == "ON") {
      Serial.println(">>> Command Received: ON. Turning Relay ON (GPIO 25 High)...");
      digitalWrite(RELAY_PIN, HIGH);       // Drive relay input high
      digitalWrite(ONBOARD_LED_PIN, HIGH); // Onboard feedback LED ON
    } 
    else if (message == "OFF") {
      Serial.println(">>> Command Received: OFF. Turning Relay OFF (GPIO 25 Low)...");
      digitalWrite(RELAY_PIN, LOW);        // Drive relay input low
      digitalWrite(ONBOARD_LED_PIN, LOW);  // Onboard feedback LED OFF
    }
  }
}

// ==================== MQTT RECONNECTION LOGIC ====================
void reconnect() {
  // Loop until we are reconnected
  while (!client.connected()) {
    Serial.print("Attempting MQTT connection to broker: ");
    Serial.print(mqtt_server);
    Serial.println("...");
    
    // Create a unique client ID based on MAC address
    String clientId = "ESP32_A101_Node-";
    clientId += String(WiFi.macAddress());

    // Attempt to connect
    if (client.connect(clientId.c_str())) {
      Serial.println("MQTT Connection established successfully!");
      
      // Once connected, subscribe to command topic
      client.subscribe(topic_power);
      Serial.print("Subscribed to command topic: ");
      Serial.println(topic_power);
      
      // Instantly send an initial connection report
      publishHeartbeat();
    } else {
      Serial.print("Connection failed, rc=");
      Serial.print(client.state());
      Serial.println(" | Retrying in 5 seconds...");
      
      // Flash LED warning during retry back-off
      for(int i=0; i<5; i++) {
        digitalWrite(ONBOARD_LED_PIN, HIGH);
        delay(100);
        digitalWrite(ONBOARD_LED_PIN, LOW);
        delay(900);
      }
    }
  }
}

// ==================== TELEMETRY HEARTBEAT DISPATCHER ====================
void publishHeartbeat() {
  // Construct JSON heartbeat payload
  StaticJsonDocument<200> doc;
  doc["device"] = "ESP32-A101";
  doc["room"] = "A101";
  doc["status"] = "online";
  doc["uptime"] = millis() / 1000; // Node uptime in seconds
  doc["heap"] = ESP.getFreeHeap(); // Diagnostics: free RAM memory
  doc["rssi"] = WiFi.RSSI();       // Wifi signal strength index (dBm)

  char buffer[256];
  serializeJson(doc, buffer);
  
  Serial.print("Publishing Telemetry Packet: ");
  Serial.println(buffer);
  
  bool success = client.publish(topic_telemetry, buffer);
  if (success) {
    Serial.println("Telemetry published successfully!");
  } else {
    Serial.println("[ERROR] Telemetry publish failed.");
  }
}

// ==================== ARDUINO HARDWARE INITIALIZATION ====================
void setup() {
  // Initialize hardware serial baudrate
  Serial.begin(115200);
  
  // Set GPIO pin modes
  pinMode(RELAY_PIN, OUTPUT);
  pinMode(ONBOARD_LED_PIN, OUTPUT);
  
  // Initialize default relay state: OFF (GPIO Low)
  digitalWrite(RELAY_PIN, LOW);
  digitalWrite(ONBOARD_LED_PIN, LOW);

  // Run Wi-Fi Connection
  setup_wifi();
  
  // Set MQTT client parameters
  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(callback);
}

// ==================== PHYSICAL REALTIME LOOP ====================
void loop() {
  // Ensure MQTT client connection is kept alive
  if (!client.connected()) {
    reconnect();
  }
  
  // Run PubSubClient internal message listener loop
  client.loop();

  // Dispatch heartbeat every 30 seconds
  unsigned long now = millis();
  if (now - lastHeartbeat >= heartbeatInterval) {
    lastHeartbeat = now;
    publishHeartbeat();
  }
}
