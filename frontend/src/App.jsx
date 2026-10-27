import React, { useState, useEffect, useRef } from 'react';
import './App.css';

const API_BASE = 'http://localhost:8000';

function App() {
  const [occupied, setOccupied] = useState(false);
  const [powerStatus, setPowerStatus] = useState('OFF');
  const [esp32Status, setEsp32Status] = useState('Disconnected');
  const [wsConnected, setWsConnected] = useState(false);
  const [cameras, setCameras] = useState([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newCam, setNewCam] = useState({
    name: '',
    room_id: 'A101',
    source_type: '0',
    source: '0',
    description: '',
    ai_enabled: true
  });

  const [logs, setLogs] = useState([
    'System standby. Awaiting live telemetry...'
  ]);
  
  const ws = useRef(null);

  // Helper to append logs
  const addLog = (msg) => {
    const timeStr = new Date().toLocaleTimeString('en-US', { hour12: false });
    setLogs((prev) => [...prev.slice(-15), `[${timeStr}] ${msg}`]);
  };

  // Fetch live cameras from backend
  const fetchCameras = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/cameras`);
      if (res.ok) {
        const data = await res.json();
        setCameras(data.cameras || []);
      }
    } catch (err) {
      console.warn('Could not load cameras from API:', err);
    }
  };

  // WebSocket Connection Lifecycle
  useEffect(() => {
    connectWebSocket();
    fetchCameras();
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
        const payload = JSON.parse(event.data);
        console.log('Received WebSocket Payload:', payload);
        
        if (payload.type === 'init') {
          if (payload.occupied !== undefined) setOccupied(payload.occupied);
          if (payload.power_status) setPowerStatus(payload.power_status);
          if (payload.esp32_status) setEsp32Status(payload.esp32_status);
          if (payload.cameras) setCameras(payload.cameras);
        } else if (payload.type === 'room_update') {
          const room = payload.room || payload;
          if (room.room_id === 'A101' || !room.room_id) {
            setOccupied(room.occupied);
            setPowerStatus(room.power_status);
            setEsp32Status(room.esp32_status);
            addLog(`Sync Event: Room ${room.room_id || 'A101'} occupied: ${room.occupied} | Power: ${room.power_status}`);
          }
        } else if (payload.type === 'camera_added' || payload.type === 'camera_removed') {
          fetchCameras();
        }
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
  const handleManualOverride = async () => {
    addLog('Manual override requested. Sending Toggle Command to controller...');
    try {
      const res = await fetch(`${API_BASE}/api/rooms/A101/toggle`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setPowerStatus(data.room.power_status);
        addLog(`Power state toggled to ${data.room.power_status}`);
      }
    } catch(err) {
      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        ws.current.send('toggle');
      } else {
        alert('Backend server is offline. Please start uvicorn first.');
      }
    }
  };

  // Add Camera submit handler
  const handleAddCamera = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/api/cameras`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCam.name,
          room_id: newCam.room_id,
          source: newCam.source,
          description: newCam.description,
          ai_enabled: newCam.ai_enabled
        })
      });
      if (res.ok) {
        addLog(`Added camera: ${newCam.name} [Room ${newCam.room_id}]`);
        setIsAddModalOpen(false);
        setNewCam({ name: '', room_id: 'A101', source_type: '0', source: '0', description: '', ai_enabled: true });
        fetchCameras();
      } else {
        const err = await res.json();
        alert(`Failed to add camera: ${err.detail || 'Server rejected'}`);
      }
    } catch (err) {
      alert(`Network error adding camera: ${err.message}`);
    }
  };

  // Delete camera
  const handleDeleteCamera = async (camId) => {
    if (!window.confirm(`Delete camera stream ${camId}?`)) return;
    try {
      const res = await fetch(`${API_BASE}/api/cameras/${camId}`, { method: 'DELETE' });
      if (res.ok) {
        addLog(`Deleted camera: ${camId}`);
        fetchCameras();
      }
    } catch(err) {
      console.error(err);
    }
  };

  // Toggle AI
  const handleToggleAI = async (camId) => {
    try {
      const res = await fetch(`${API_BASE}/api/cameras/${camId}/toggle-ai`, { method: 'POST' });
      if (res.ok) {
        addLog(`Toggled AI HUD for camera: ${camId}`);
        fetchCameras();
      }
    } catch(err) {
      console.error(err);
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
          <button 
            className="btn-add-camera-nav"
            onClick={() => setIsAddModalOpen(true)}
          >
            <i className="fa-solid fa-video"></i> + Add Live Camera
          </button>
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

        {/* Live Surveillance Camera Feeds */}
        <section className="cameras-section" style={{ gridColumn: '1 / span 2' }}>
          <div className="glass-card cameras-card">
            <div className="terminal-header" style={{ justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-video"></i>
                <h3>Live Surveillance Streams & AI Detection</h3>
              </div>
              <button 
                className="btn-add-camera-mini"
                onClick={() => setIsAddModalOpen(true)}
              >
                <i className="fa-solid fa-plus"></i> Add Camera
              </button>
            </div>

            <div className="cameras-grid">
              {cameras.map((cam) => (
                <div key={cam.id} className="camera-box">
                  <div className="camera-box-header">
                    <span className="cam-title">
                      <span className="rec-dot"></span>
                      {cam.name} [{cam.room_id}]
                    </span>
                    <span className={`cam-status-tag ${cam.occupied ? 'tag-occupied' : 'tag-empty'}`}>
                      {cam.occupied ? 'OCCUPIED' : 'EMPTY'}
                    </span>
                  </div>
                  <div className="camera-img-container">
                    <img 
                      src={`${API_BASE}/api/cameras/${cam.id}/stream`} 
                      alt={cam.name} 
                      className="live-video-feed"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                    <div className="cam-fallback-msg" style={{ display: 'none' }}>
                      <i className="fa-solid fa-triangle-exclamation"></i>
                      <span>Connecting Stream...</span>
                    </div>
                  </div>
                  <div className="camera-box-footer">
                    <div className="cam-fps-info">
                      <span>Occupants: <strong>{cam.occupant_count}</strong></span>
                      <span>FPS: {cam.fps}</span>
                    </div>
                    <div className="cam-actions">
                      <button 
                        title="Snapshot"
                        onClick={() => window.open(`${API_BASE}/api/cameras/${cam.id}/snapshot`, '_blank')}
                      >
                        <i className="fa-solid fa-camera"></i>
                      </button>
                      <button 
                        title="Toggle AI HUD"
                        onClick={() => handleToggleAI(cam.id)}
                      >
                        <i className="fa-solid fa-brain"></i>
                      </button>
                      <button 
                        title="Delete Stream"
                        className="btn-del-cam"
                        onClick={() => handleDeleteCamera(cam.id)}
                      >
                        <i className="fa-solid fa-trash"></i>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {cameras.length === 0 && (
                <div className="no-cams-banner">
                  <span>No cameras connected yet. Click "+ Add Live Camera" to connect your webcam or IP stream.</span>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Live log feed terminal */}
        <section className="terminal-view" style={{ gridColumn: '1 / span 2' }}>
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

      {/* Add Camera Modal */}
      {isAddModalOpen && (
        <div className="react-modal-backdrop">
          <div className="glass-card react-modal-content">
            <div className="modal-header">
              <h3>Connect Live Camera</h3>
              <button onClick={() => setIsAddModalOpen(false)}>×</button>
            </div>
            <form onSubmit={handleAddCamera} className="modal-form">
              <label>Camera Name</label>
              <input 
                type="text" 
                required 
                placeholder="E.g., Classroom A101 Front Webcam"
                value={newCam.name}
                onChange={(e) => setNewCam({ ...newCam, name: e.target.value })}
              />

              <label>Target Room</label>
              <input 
                type="text" 
                required 
                placeholder="A101"
                value={newCam.room_id}
                onChange={(e) => setNewCam({ ...newCam, room_id: e.target.value.toUpperCase() })}
              />

              <label>Source Type</label>
              <select 
                value={newCam.source_type}
                onChange={(e) => {
                  const val = e.target.value;
                  let src = val;
                  if (val === 'rtsp') src = 'rtsp://admin:password@192.168.1.100:554/stream';
                  if (val === 'http') src = 'http://192.168.1.100:8080/video';
                  setNewCam({ ...newCam, source_type: val, source: src });
                }}
              >
                <option value="0">Local Physical Webcam 0 (Integrated / USB)</option>
                <option value="1">External Webcam 1</option>
                <option value="rtsp">RTSP IP Camera Stream</option>
                <option value="http">HTTP MJPEG Stream</option>
                <option value="simulation">Simulated AI Camera</option>
              </select>

              <label>Source Path / URL / Index</label>
              <input 
                type="text" 
                required 
                value={newCam.source}
                onChange={(e) => setNewCam({ ...newCam, source: e.target.value })}
              />

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '8px 0' }}>
                <input 
                  type="checkbox" 
                  id="chk-ai"
                  checked={newCam.ai_enabled}
                  onChange={(e) => setNewCam({ ...newCam, ai_enabled: e.target.checked })}
                />
                <label htmlFor="chk-ai" style={{ margin: 0, cursor: 'pointer' }}>Enable Real-Time OpenCV HOG Human Detection HUD</label>
              </div>

              <div className="modal-actions">
                <button type="button" onClick={() => setIsAddModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Connect Camera</button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      <footer className="app-footer">
        <span>VisionGrid AI Platform • Smart Automation Infrastructure • Connected Backend</span>
      </footer>
    </div>
  );
}

export default App;
