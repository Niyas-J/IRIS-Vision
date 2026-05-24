import React, { useState, useEffect, useRef } from 'react';
import './App.css';

function App() {
  const [occupied, setOccupied] = useState(false);
  const [powerStatus, setPowerStatus] = useState('OFF');
  const [esp32Status, setEsp32Status] = useState('Disconnected');
  const [wsConnected, setWsConnected] = useState(false);
  const [logs, setLogs] = useState([
    'System standby. Awaiting live telemetry...'
  ]);
  
  const ws = useRef(null);

  // Helper to append logs
  const addLog = (msg) => {
    const timeStr = new Date().toLocaleTimeString('en-US', { hour12: false });
    setLogs((prev) => [...prev.slice(-15), `[${timeStr}] ${msg}`]);
  };

  // WebSocket Connection Lifecycle
  useEffect(() => {
    connectWebSocket();
    return () => {
      if (ws.current) ws.current.close();
    };
  }, []);

  const connectWebSocket = () => {
    addLog('Connecting to FastAPI WebSocket server at ws://localhost:8000/ws...');
    ws.current = new WebSocket('ws://localhost:8000/ws');

    ws.current.onopen = () => {
      setWsConnected(true);
      addLog('WebSocket Connection established! Live streaming active.');
    };

    ws.current.onmessage = (event) => {
      try {
        const state = JSON.parse(event.data);
        console.log('Received WebSocket Payload:', state);
        
        // Sync states
        setOccupied(state.occupied);
        setPowerStatus(state.power_status);
        setEsp32Status(state.esp32_status);
        
        addLog(`Sync Event: Room occupied: ${state.occupied} | Power: ${state.power_status} | ESP32: ${state.esp32_status}`);
      } catch (err) {
        console.error('Failed to parse WebSocket packet:', err);
      }
    };

    ws.current.onclose = () => {
      setWsConnected(false);
      setEsp32Status('Disconnected');
      addLog('WebSocket disconnected. Retrying handshake in 3 seconds...');
      setTimeout(connectWebSocket, 3000);
    };

    ws.current.onerror = (error) => {
      console.error('WebSocket encountered an error:', error);
    };
  };

  // Manual Trigger command dispatch
  const handleManualOverride = () => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      addLog('Manual override requested. Sending Toggle Command to controller...');
      ws.current.send('toggle');
    } else {
      addLog('[ERROR] Cannot override: WebSocket broker is offline.');
      alert('Cannot send command. The backend FastAPI server is offline. Please start uvicorn first.');
    }
  };

  return (
    <div className="app-container">
      {/* Network mesh matrix grid */}
      <div className="network-grid-bg"></div>

      {/* Header bar */}
      <header className="app-header">
        <div className="header-logo">
          <div className="logo-box">V</div>
          <span>VISION<span className="accent-text">GRID AI</span></span>
        </div>
        <div className="header-connections">
          <div className={`conn-status ${wsConnected ? 'online' : 'offline'}`}>
            <span className="conn-dot"></span>
            Broker: {wsConnected ? 'ONLINE' : 'OFFLINE'}
          </div>
          <div className={`conn-status ${esp32Status === 'Connected' ? 'online' : 'offline'}`}>
            <span className="conn-dot"></span>
            ESP32: {esp32Status.toUpperCase()}
          </div>
        </div>
      </header>

      {/* Main Grid View */}
      <main className="app-main">
        {/* Core Card Section */}
        <section className="dashboard-view">
          <div className="glass-card room-controller-card">
            <div className="card-header">
              <span className="node-id">NODE: ESP32-A101</span>
              <h2>Classroom A101</h2>
              <span className="room-type">Computer Science Laboratory</span>
            </div>

            <div className="status-grid">
              {/* Metric 1 */}
              <div className="status-tile">
                <span className="tile-label">OCCUPANCY TELEMETRY</span>
                <div className={`tile-val-container ${occupied ? 'active-green' : ''}`}>
                  <span className="pulsing-live-dot"></span>
                  <span className="tile-value">{occupied ? 'DETECTED' : 'EMPTY'}</span>
                </div>
                <span className="tile-subtitle">{occupied ? 'AI occupancy active' : '10s empty cooldown'}</span>
              </div>

              {/* Metric 2 */}
              <div className="status-tile">
                <span className="tile-label">POWER RELAY STATUS</span>
                <div className={`tile-val-container ${powerStatus === 'ON' ? 'active-cyan' : ''}`}>
                  <i className="fa-solid fa-bolt tile-icon"></i>
                  <span className="tile-value">{powerStatus}</span>
                </div>
                <span className="tile-subtitle">Switch GPIO 25 state</span>
              </div>

              {/* Metric 3 */}
              <div className="status-tile" style={{ gridColumn: '1 / span 2' }}>
                <span className="tile-label">HARDWARE HANDSHAKE</span>
                <div className="hardware-info-container">
                  <div className="hw-item">
                    <span className="hw-lbl">Wi-Fi Connection</span>
                    <span className={`hw-val ${esp32Status === 'Connected' ? 'green-text' : 'orange-text'}`}>
                      {esp32Status === 'Connected' ? 'Strong (89%)' : 'No Handshake'}
                    </span>
                  </div>
                  <div className="hw-item">
                    <span className="hw-lbl">Relay Channel</span>
                    <span className="hw-val">5V Single-Channel Relay</span>
                  </div>
                  <div className="hw-item">
                    <span className="hw-lbl">IP Address</span>
                    <span className="hw-val">{esp32Status === 'Connected' ? '192.168.1.104' : 'DHCP standby'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Actuator override action */}
            <div className="action-button-container">
              <button 
                className={`btn-actuate ${powerStatus === 'ON' ? 'on-glow' : ''}`}
                onClick={handleManualOverride}
              >
                <i className="fa-solid fa-power-off"></i>
                MANUAL OVERRIDE SWITCH
              </button>
            </div>
          </div>
        </section>

        {/* Live log feed terminal */}
        <section className="terminal-view">
          <div className="glass-card terminal-card">
            <div className="terminal-header">
              <i className="fa-solid fa-terminal"></i>
              <h3>Real-Time MQTT Communication Pipeline</h3>
              <span className="live-badge">TELEMETRY STREAM</span>
            </div>
            <div className="terminal-body">
              {logs.map((log, index) => (
                <div key={index} className="terminal-line">
                  {log}
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
      
      <footer className="app-footer">
        <span>VisionGrid AI Platform • Prototype Node Control Setup • Security Mode Standard</span>
      </footer>
    </div>
  );
}

export default App;
