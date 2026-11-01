// --- VISION IRIS PLATFORM CORE JS ENGINE ---

// ==================== STATE MANAGEMENT ====================
let state = {
  currentUser: null,
  activeView: 'landing',
  activeConsolePanel: 'dashboard',
  classrooms: [
    { id: 'A101', name: 'A101', type: 'Computer Lab', status: 'occupied', peopleCount: 24, temp: 24.0, lightsOn: true, fansOn: true, signal: 89, deviceId: 'ESP32-A101', mac: '3C:61:05:12:34:A1', fw: 'v2.4.1', recentEvents: ['Relay 1 ON (AI trigger)', 'MQTT reconnect successful'] },
    { id: 'A102', name: 'A102', type: 'Lecture Hall', status: 'empty', peopleCount: 0, temp: 22.0, lightsOn: false, fansOn: false, signal: 94, deviceId: 'ESP32-A102', mac: '3C:61:05:12:34:A2', fw: 'v2.4.1', recentEvents: ['Relay 1 OFF (Room Empty)', 'Daily health check passed'] },
    { id: 'A103', name: 'A103', type: 'Seminar Room', status: 'occupied', peopleCount: 8, temp: 25.0, lightsOn: true, fansOn: true, signal: 67, deviceId: 'ESP32-A103', mac: '3C:61:05:12:34:A3', fw: 'v2.4.0', recentEvents: ['Relay 2 ON (Override)', 'Core temp reached 48°C'] },
    { id: 'B201', name: 'B201', type: 'Physics Lab', status: 'empty', peopleCount: 0, temp: 21.0, lightsOn: false, fansOn: false, signal: 82, deviceId: 'ESP32-B201', mac: '3C:61:05:12:34:B1', fw: 'v2.4.1', recentEvents: ['Idle mode activated'] },
    { id: 'B202', name: 'B202', type: 'Chemistry Lab', status: 'occupied', peopleCount: 18, temp: 23.0, lightsOn: true, fansOn: true, signal: 91, deviceId: 'ESP32-B202', mac: '3C:61:05:12:34:B2', fw: 'v2.4.1', recentEvents: ['Relay 1 ON (AI trigger)', 'Uptime crossed 10 days'] },
    { id: 'B203', name: 'B203', type: 'Biology Lab', status: 'offline', peopleCount: 0, temp: null, lightsOn: null, fansOn: null, signal: 0, deviceId: 'ESP32-B203', mac: '3C:61:05:12:34:B3', fw: 'v2.3.8', recentEvents: ['Connection failure (ping timeout)', 'Battery backup depleted'] }
  ],
  devices: [],
  rules: [
    { id: 1, name: 'Energy Saver - Empty Room', condition: 'Room is EMPTY for 10 minutes', action: 'Turn OFF Lights & Fans', appliesTo: 'All Rooms', active: true, runs: 847 },
    { id: 2, name: 'Morning Prep - Pre-class Power', condition: 'Time is 8:30 AM (Weekdays)', action: 'Turn ON Lights & Fans', appliesTo: 'A101, A102, A103', active: true, runs: 421 },
    { id: 3, name: 'Safety Override - High Temp', condition: 'Temperature exceeds 30°C', action: 'Turn ON Fans (Override)', appliesTo: 'All Rooms', active: true, runs: 12 }
  ],
  alerts: [
    { id: 1, severity: 'critical', type: 'Device Offline', time: '10:43 AM', device: 'ESP32-B203', msg: 'Device in Biology Lab (B203) has been offline for 12 minutes. Room automation suspended.', read: false },
    { id: 2, severity: 'warning', type: 'Firmware Update Available', time: '10:38 AM', device: 'ESP32-A103', msg: 'Device running v2.4.0. Latest version v2.4.1 includes security patches.', read: false },
    { id: 3, severity: 'info', type: 'Weekly Report Ready', time: '10:15 AM', device: 'Analytics Engine', msg: 'Your campus analytics report for the week of May 18-24 is ready for review.', read: false }
  ],
  activityLog: [
    '10:42:31 A101 Motion detected, 3 persons identified',
    '10:41:15 B202 Occupancy increased to 18',
    '10:40:02 A102 Room vacated, power OFF triggered',
    '10:38:45 B203 Camera connection lost',
    '10:35:20 A103 New occupancy detected, power ON'
  ],
  cctvStreams: {},
  canvasDetections: {
    A101: [{ x: 80, y: 120, tx: 80, ty: 120, label: 'Person 1', conf: '99.2%' }, { x: 220, y: 180, tx: 220, ty: 180, label: 'Person 2', conf: '98.5%' }, { x: 340, y: 110, tx: 340, ty: 110, label: 'Person 3', conf: '96.8%' }],
    A103: [{ x: 180, y: 150, tx: 180, ty: 150, label: 'Person 1', conf: '98.1%' }, { x: 290, y: 90, tx: 290, ty: 90, label: 'Person 2', conf: '95.4%' }],
    B202: [{ x: 120, y: 140, tx: 120, ty: 140, label: 'Person 1', conf: '99.0%' }, { x: 250, y: 160, tx: 250, ty: 160, label: 'Person 2', conf: '97.2%' }, { x: 380, y: 130, tx: 380, ty: 130, label: 'Person 3', conf: '94.8%' }],
  }
};

// ==================== APP INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
  // Sync state classrooms to state devices for unified listing
  syncStateDevices();
  
  // Set current date
  const dateEl = document.getElementById('dashboard-current-date');
  if (dateEl) {
    dateEl.innerText = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }

  // Populate dynamic elements
  renderClassrooms();
  renderDevicesList();
  renderRules();
  renderAlerts();
  renderActivityLog();
  renderCampusGrid();
  renderUtilizationList();
  buildHeatmap();
  
  // Startup background loops
  initCCTVCanvasStreams();
  initBackgroundSimulation();
  initAnalyticsChart();

  // If already logged in (mock persistence)
  const savedUser = localStorage.getItem('visiongrid_user');
  if (savedUser) {
    state.currentUser = JSON.parse(savedUser);
    updateUserDOM();
  }
});

// Update the devices representation derived from classrooms
function syncStateDevices() {
  state.devices = state.classrooms.map(room => {
    return {
      id: room.deviceId,
      name: room.deviceId,
      mac: room.mac,
      room: room.id,
      status: room.status === 'offline' ? 'offline' : 'online',
      signal: room.signal,
      fw: room.fw,
      uptime: room.status === 'offline' ? '0d 0h 0m' : '14d 6h 32m',
      memory: room.status === 'offline' ? '0KB/160KB' : '124KB/160KB',
      cpu: room.status === 'offline' ? 0 : 32,
      coreTemp: room.status === 'offline' ? '--' : '42°C',
      relayCycles: room.status === 'offline' ? 0 : 1247,
      recentEvents: room.recentEvents
    };
  });
}

// ==================== ROUTING & VIEW NAVIGATION ====================
function showView(view) {
  // Hide all root views
  document.getElementById('landing-view').style.display = 'none';
  document.getElementById('login-view').style.display = 'none';
  document.getElementById('console-view').style.display = 'none';
  
  // Update view state
  state.activeView = view;
  
  // Show target root view
  if (view === 'landing') {
    document.getElementById('landing-view').style.display = 'block';
    updateNavSelection('landing');
  } else if (view === 'login') {
    document.getElementById('login-view').style.display = 'flex';
    updateNavSelection('login');
  } else if (view === 'console') {
    document.getElementById('console-view').style.display = 'block';
    updateNavSelection('console');
    // Ensure active console panel is shown
    showConsolePanel(state.activeConsolePanel);
  }
  
  // Scroll to top
  window.scrollTo(0, 0);
}

function updateNavSelection(view) {
  // Reset nav items
  document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
  
  if (view === 'landing') {
    document.getElementById('nav-landing').classList.add('active');
  } else if (view === 'console') {
    document.getElementById('nav-console-link').classList.add('active');
  }
}

function showConsolePanel(panelName) {
  state.activeConsolePanel = panelName;
  
  // Hide all panels
  document.querySelectorAll('.console-panel').forEach(panel => {
    panel.style.display = 'none';
  });
  
  // Show target panel
  const targetPanel = document.getElementById(`panel-${panelName}`);
  if (targetPanel) {
    targetPanel.style.display = 'block';
  }
  
  // Update sidebar buttons active state
  document.querySelectorAll('.sidebar-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  const activeBtn = document.getElementById(`btn-sidebar-${panelName}`);
  if (activeBtn) {
    activeBtn.classList.add('active');
  }

  // Mobile nav buttons sync
  document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  const mActiveBtn = document.getElementById(`btn-m-${panelName === 'dashboard' ? 'dash' : panelName}`);
  if (mActiveBtn) {
    mActiveBtn.classList.add('active');
  }
  
  // Panel specific rendering checks
  if (panelName === 'analytics') {
    setTimeout(initAnalyticsChart, 100);
  }
}

function checkAuthAndGo(targetPanel) {
  if (!state.currentUser) {
    state.activeConsolePanel = targetPanel;
    showView('login');
  } else {
    state.activeConsolePanel = targetPanel;
    showView('console');
  }
}

function scrollToSection(id) {
  showView('landing');
  const target = document.getElementById(id);
  if (target) {
    target.scrollIntoView({ behavior: 'smooth' });
  }
}

// Mobile responsive navigation
function toggleMobileSidebar() {
  const isConsoleOpen = state.activeView === 'console';
  if (isConsoleOpen) {
    // We toggle view from console back to landing for quick escape
    showView('landing');
  } else {
    checkAuthAndGo('dashboard');
  }
}

function handleMobileNavClick(viewName) {
  if (viewName === 'landing') {
    showView('landing');
  } else {
    checkAuthAndGo(viewName);
  }
}

// ==================== AUTHENTICATION WORKFLOW ====================
function handleLoginSubmit(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  
  // Set mock user profile details
  state.currentUser = {
    email: email,
    name: email.split('@')[0].toUpperCase() + ' ADMIN',
    role: email.includes('mit.edu') ? 'MIT Campus Admin' : 'University SuperAdmin',
    initials: email.split('@')[0].slice(0,2).toUpperCase()
  };
  
  // Save credentials to mock local storage
  localStorage.setItem('visiongrid_user', JSON.stringify(state.currentUser));
  
  // Update DOM & transition
  updateUserDOM();
  showView('console');
}

function triggerSSOLogin(provider) {
  state.currentUser = {
    email: `admin@${provider.toLowerCase()}-sso.edu`,
    name: `${provider} SSO System`,
    role: 'Enterprise Platform Operator',
    initials: provider[0] + 'S'
  };
  localStorage.setItem('visiongrid_user', JSON.stringify(state.currentUser));
  updateUserDOM();
  showView('console');
}

function updateUserDOM() {
  if (state.currentUser) {
    document.getElementById('user-display-name').innerText = state.currentUser.name;
    document.getElementById('user-display-role').innerText = state.currentUser.role;
    document.getElementById('user-avatar-initials').innerText = state.currentUser.initials;
    document.getElementById('login-nav-btn').innerText = 'Platform Console';
  }
}

function handleLogout() {
  state.currentUser = null;
  localStorage.removeItem('visiongrid_user');
  document.getElementById('login-nav-btn').innerText = 'Launch Console';
  showView('landing');
}

// ==================== RENDERING COMPONENT ENGINES ====================

// Classroom Status Cards Grid inside Main Dashboard
function renderClassrooms() {
  const container = document.getElementById('classroom-grid-container');
  if (!container) return;
  
  container.innerHTML = '';
  
  state.classrooms.forEach(room => {
    // Format status variables
    const statusColor = room.status === 'occupied' ? '#10b981' : room.status === 'empty' ? '#8b949e' : '#ef4444';
    const statusText = room.status.toUpperCase();
    
    // Status indicators HTML
    const roomBadge = room.status === 'occupied' 
      ? '<span class="badge badge-online">Occupied</span>' 
      : room.status === 'empty' 
      ? '<span class="badge badge-offline">Empty</span>' 
      : '<span class="badge badge-danger">Offline</span>';
      
    // Relay control toggles state
    const lightsToggle = room.status === 'offline' ? '✗' : room.lightsOn ? 'ON' : 'OFF';
    const fansToggle = room.status === 'offline' ? '✗' : room.fansOn ? 'ON' : 'OFF';
    const deviceSuccessClass = room.status === 'offline' ? 'esp-status-fail' : 'esp-status-success';
    
    const card = document.createElement('div');
    card.className = 'glass-card classroom-card';
    card.innerHTML = `
      <div class="room-header">
        <div class="room-meta">
          <span class="room-name">${room.name}</span>
          <span class="room-desc">${room.type}</span>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          ${roomBadge}
          <div class="room-status-indicator" style="color: ${statusColor};"></div>
        </div>
      </div>
      
      <div class="room-metrics">
        <div class="metric-item">
          <i class="fa-solid fa-users metric-icon"></i>
          <div class="metric-data">
            <span class="metric-label">Detected</span>
            <span class="metric-value" id="room-metrics-peop-${room.id}">${room.status === 'offline' ? '--' : room.peopleCount + ' people'}</span>
          </div>
        </div>
        <div class="metric-item">
          <i class="fa-solid fa-temperature-three-quarters metric-icon"></i>
          <div class="metric-data">
            <span class="metric-label">Temp</span>
            <span class="metric-value" id="room-metrics-temp-${room.id}">${room.status === 'offline' ? '--' : room.temp.toFixed(1) + '°C'}</span>
          </div>
        </div>
        <div class="metric-item" style="grid-column: 1 / span 2;">
          <i class="fa-solid fa-plug metric-icon" style="color: var(--warning);"></i>
          <div class="metric-data">
            <span class="metric-label">Relays Triggered</span>
            <span class="metric-value" id="room-metrics-relays-${room.id}">Lights: ${lightsToggle} | Fans: ${fansToggle}</span>
          </div>
        </div>
      </div>
      
      <div class="room-footer">
        <span class="esp-connection ${deviceSuccessClass}">
          <i class="fa-solid fa-circle-nodes"></i> ${room.deviceId} ${room.status === 'offline' ? '✗' : '✓'}
        </span>
        <span class="caption-text"><i class="fa-solid fa-wifi"></i> Signal: ${room.status === 'offline' ? '0' : room.signal}%</span>
      </div>
      
      <!-- Manual Override Drawer Layer on Hover -->
      <div class="room-hover-overlay">
        <div style="display:flex; flex-direction:column; gap:16px; width:100%;">
          <h4 style="font-weight:600; text-align:center;">ESP32 Node Override</h4>
          
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
            <button class="btn btn-secondary" onclick="manualRelayToggle('${room.id}', 'lights')" ${room.status === 'offline' ? 'disabled' : ''}>
              💡 Lights: ${room.lightsOn ? 'OFF' : 'ON'}
            </button>
            <button class="btn btn-secondary" onclick="manualRelayToggle('${room.id}', 'fans')" ${room.status === 'offline' ? 'disabled' : ''}>
              🌀 Fans: ${room.fansOn ? 'OFF' : 'ON'}
            </button>
          </div>
          
          <button class="btn btn-primary" onclick="showConsolePanel('cctv')">View AI Camera</button>
        </div>
      </div>
    `;
    
    container.appendChild(card);
  });
}

// Manual Override Trigger Logic
function manualRelayToggle(roomId, relayType) {
  const room = state.classrooms.find(r => r.id === roomId);
  if (!room || room.status === 'offline') return;
  
  if (relayType === 'lights') {
    room.lightsOn = !room.lightsOn;
    pushActivityLog(`Manual lights override triggered in room ${roomId}. Relay 1 set to ${room.lightsOn ? 'ON' : 'OFF'}`);
  } else if (relayType === 'fans') {
    room.fansOn = !room.fansOn;
    pushActivityLog(`Manual fans override triggered in room ${roomId}. Relay 2 set to ${room.fansOn ? 'ON' : 'OFF'}`);
  }

  // Dispatch to backend API
  fetch(`/api/rooms/${roomId}/toggle`, { method: 'POST' }).catch(err => {
    console.warn('Backend toggle API offline, running locally:', err);
  });
  
  // Re-render UI elements
  renderClassrooms();
  syncStateDevices();
  renderDevicesList();
}

// Devices Management List View
function renderDevicesList() {
  const container = document.getElementById('devices-list-container');
  if (!container) return;
  
  container.innerHTML = '';
  
  const roomFilter = document.getElementById('device-filter-room').value;
  const statusFilter = document.getElementById('device-filter-status').value;
  
  state.devices.forEach(dev => {
    // Apply filters
    if (roomFilter !== 'all' && dev.room !== roomFilter) return;
    if (statusFilter !== 'all' && dev.status !== statusFilter) return;
    
    const rowBadge = dev.status === 'online' ? '<span class="badge badge-online">Online</span>' : '<span class="badge badge-offline">Offline</span>';
    const warnBadge = dev.fw !== 'v2.4.1' && dev.status === 'online' 
      ? '<span class="firmware-warning" title="Security updates available"><i class="fa-solid fa-triangle-exclamation"></i> Update</span>' 
      : '';
      
    // WiFi Signal Strength CSS
    let signalClass = 'signal-strength-good';
    if (dev.signal < 50) signalClass = 'signal-strength-bad';
    else if (dev.signal < 80) signalClass = 'signal-strength-med';
    
    const row = document.createElement('div');
    row.className = `device-row`;
    row.id = `device-row-${dev.id}`;
    row.innerHTML = `
      <div class="device-row-header" onclick="toggleDeviceDiagnostics('${dev.id}')">
        <div class="device-identity">
          <i class="fa-solid fa-microchip device-icon"></i>
          <div class="device-details-text">
            <span class="device-name">${dev.name}</span>
            <span class="device-mac">MAC: ${dev.mac}</span>
          </div>
        </div>
        <div class="device-room-cell">${dev.room}</div>
        <div>${rowBadge}</div>
        <div class="device-firmware-cell">${dev.fw} ${warnBadge}</div>
        <div class="device-signal-cell">
          <div class="signal-bar ${signalClass}">
            <span class="signal-segment"></span>
            <span class="signal-segment"></span>
            <span class="signal-segment"></span>
            <span class="signal-segment"></span>
            <span style="font-family:var(--font-mono); font-size:0.75rem; margin-left:6px;">${dev.signal}%</span>
          </div>
        </div>
      </div>
      
      <!-- diagnostics hidden block -->
      <div class="device-diagnostics" id="diagnostics-${dev.id}">
        <div class="diagnostics-content">
          <div class="diag-stats-grid">
            <div class="diag-item">
              <span class="diag-label">Uptime</span>
              <span class="diag-val">${dev.uptime}</span>
            </div>
            <div class="diag-item">
              <span class="diag-label">MQTT status</span>
              <span class="diag-val" style="color: ${dev.status === 'online' ? 'var(--primary-accent)' : 'var(--text-secondary)'}">${dev.status === 'online' ? 'CONNECTED' : 'DISCONNECTED'}</span>
            </div>
            <div class="diag-item">
              <span class="diag-label">Core temperature</span>
              <span class="diag-val">${dev.coreTemp}</span>
            </div>
            <div class="diag-item">
              <span class="diag-label">Relay trigger cycles</span>
              <span class="diag-val">${dev.relayCycles}</span>
            </div>
          </div>
          
          <div class="diag-charts">
            <div class="diag-chart-bar-container">
              <div class="diag-chart-label">
                <span>Free Memory</span>
                <span>${dev.status === 'offline' ? '0KB' : '124KB/160KB (77%)'}</span>
              </div>
              <div class="diag-chart-track">
                <div class="diag-chart-fill" id="diag-fill-mem-${dev.id}" style="width: 0%; background: var(--primary-accent);"></div>
              </div>
            </div>
            <div class="diag-chart-bar-container">
              <div class="diag-chart-label">
                <span>CPU Load</span>
                <span>${dev.status === 'offline' ? '0%' : dev.cpu + '%'}</span>
              </div>
              <div class="diag-chart-track">
                <div class="diag-chart-fill" id="diag-fill-cpu-${dev.id}" style="width: 0%; background: var(--secondary-accent);"></div>
              </div>
            </div>
            
            <div style="display:flex; justify-content: flex-end; gap: 10px; margin-top: 10px;">
              <button class="btn btn-ghost" style="padding: 6px 12px; font-size: 0.8rem;" onclick="rebootDevice('${dev.id}')" ${dev.status === 'offline' ? 'disabled' : ''}>Reboot</button>
              <button class="btn btn-secondary" style="padding: 6px 12px; font-size: 0.8rem;" onclick="updateDeviceFirmware('${dev.id}')" ${dev.fw === 'v2.4.1' || dev.status === 'offline' ? 'disabled' : ''}>Update FW</button>
            </div>
          </div>
        </div>
      </div>
    `;
    
    container.appendChild(row);
  });
}

function filterDevices() {
  renderDevicesList();
}

// Collapsible diagnostics toggle row
function toggleDeviceDiagnostics(id) {
  const row = document.getElementById(`device-row-${id}`);
  const diagBlock = document.getElementById(`diagnostics-${id}`);
  if (!row || !diagBlock) return;
  
  const isExpanded = row.classList.contains('expanded');
  
  // Collapse all rows first
  document.querySelectorAll('.device-row').forEach(r => r.classList.remove('expanded'));
  
  if (!isExpanded) {
    row.classList.add('expanded');
    
    // Animate diagnostic bar fills with slight lag
    setTimeout(() => {
      const dev = state.devices.find(d => d.id === id);
      if (dev && dev.status === 'online') {
        const memFill = document.getElementById(`diag-fill-mem-${id}`);
        const cpuFill = document.getElementById(`diag-fill-cpu-${id}`);
        if (memFill) memFill.style.width = '77%';
        if (cpuFill) cpuFill.style.width = `${dev.cpu}%`;
      }
    }, 100);
  }
}

function rebootDevice(id) {
  event.stopPropagation();
  alert(`Sending MQTT reboot packet to ${id}...`);
  pushActivityLog(`10:46:12 [MQTT] topic: device/command/${id} -> {"action":"reboot"}`);
}

function updateDeviceFirmware(id) {
  event.stopPropagation();
  alert(`Updating firmware on ${id} to version v2.4.1...`);
  const room = state.classrooms.find(r => r.deviceId === id);
  if (room) {
    room.fw = 'v2.4.1';
    pushActivityLog(`10:46:45 [OTA] Firmware update initiated on ${id} (v2.4.0 -> v2.4.1)`);
    // Clear updating alert
    state.alerts = state.alerts.filter(alt => alt.device !== id);
    
    setTimeout(() => {
      syncStateDevices();
      renderDevicesList();
      renderAlerts();
    }, 1500);
  }
}

// Automation Rules View
function renderRules() {
  const container = document.getElementById('rules-list-container');
  if (!container) return;
  
  container.innerHTML = '';
  
  state.rules.forEach(rule => {
    const card = document.createElement('div');
    card.className = 'glass-card rule-card';
    card.innerHTML = `
      <div class="rule-header">
        <div class="rule-name-container">
          <i class="fa-solid fa-circle-nodes rule-icon"></i>
          <span class="rule-name">${rule.name}</span>
        </div>
        <div style="display:flex; align-items:center; gap:16px;">
          <span class="caption-text">Active</span>
          <input type="checkbox" ${rule.active ? 'checked' : ''} onchange="toggleRuleActive(${rule.id}, this)" style="accent-color:var(--primary-accent); cursor:pointer;">
        </div>
      </div>
      
      <div class="rule-flow">
        <div class="flow-block">
          <span class="flow-block-label">IF</span>
          <span class="flow-block-val">${rule.condition}</span>
        </div>
        <div class="flow-arrow"><i class="fa-solid fa-arrow-right-long"></i></div>
        <div class="flow-block" style="border-color: rgba(124, 58, 237, 0.3);">
          <span class="flow-block-label">THEN</span>
          <span class="flow-block-val">${rule.action}</span>
        </div>
      </div>
      
      <div class="rule-footer">
        <div class="rule-meta-tags">
          <span>Applies: ${rule.appliesTo}</span>
          <span>Triggered: ${rule.runs}x</span>
        </div>
        <div style="display:flex; gap:8px;">
          <button class="btn btn-ghost" style="padding:6px 12px; font-size:0.8rem;" onclick="deleteRule(${rule.id})">Delete</button>
        </div>
      </div>
    `;
    
    container.appendChild(card);
  });
}

function toggleRuleActive(id, toggle) {
  const rule = state.rules.find(r => r.id === id);
  if (rule) {
    rule.active = toggle.checked;
    pushActivityLog(`10:47:00 Rule "${rule.name}" state updated to ${rule.active ? 'ACTIVE' : 'PAUSED'}`);
  }
}

function deleteRule(id) {
  state.rules = state.rules.filter(r => r.id !== id);
  renderRules();
}

// Active Alerts List View
function renderAlerts() {
  const container = document.getElementById('alerts-list-container');
  if (!container) return;
  
  container.innerHTML = '';
  
  const unreadAlerts = state.alerts.filter(a => !a.read);
  
  // Sync alerts badge counts
  const badgeEl = document.getElementById('sidebar-alert-badge');
  if (badgeEl) {
    badgeEl.innerText = unreadAlerts.length;
    badgeEl.style.display = unreadAlerts.length > 0 ? 'inline-block' : 'none';
  }
  
  if (unreadAlerts.length === 0) {
    container.innerHTML = `
      <div class="glass-card" style="padding:40px; text-align:center; color:var(--text-secondary);">
        <i class="fa-solid fa-circle-check" style="font-size:3rem; color:var(--success); margin-bottom:16px;"></i>
        <h3>All Systems Operating Nominally</h3>
        <p class="body-text" style="font-size:0.9rem; margin-top:8px;">No campus infrastructure warning logs in active queues.</p>
      </div>
    `;
    return;
  }
  
  unreadAlerts.forEach(alt => {
    let iconClass = 'fa-circle-exclamation';
    if (alt.severity === 'critical') iconClass = 'fa-circle-xmark';
    else if (alt.severity === 'info') iconClass = 'fa-circle-info';
    
    const card = document.createElement('div');
    card.className = `glass-card alert-item ${alt.severity}`;
    card.id = `alert-item-${alt.id}`;
    
    let actionButtons = '';
    if (alt.severity === 'critical') {
      actionButtons = `
        <button class="btn btn-primary" style="padding:6px 12px; font-size:0.75rem;" onclick="checkAuthAndGo('devices')">Diagnose Device</button>
        <button class="btn btn-secondary" style="padding:6px 12px; font-size:0.75rem;" onclick="dismissAlert(${alt.id})">Dismiss</button>
      `;
    } else if (alt.severity === 'warning') {
      actionButtons = `
        <button class="btn btn-primary" style="padding:6px 12px; font-size:0.75rem;" onclick="updateDeviceFirmware('${alt.device}')">Update Now</button>
        <button class="btn btn-secondary" style="padding:6px 12px; font-size:0.75rem;" onclick="dismissAlert(${alt.id})">Dismiss</button>
      `;
    } else {
      actionButtons = `
        <button class="btn btn-secondary" style="padding:6px 12px; font-size:0.75rem;" onclick="dismissAlert(${alt.id})">Mark Read</button>
      `;
    }
    
    card.innerHTML = `
      <i class="fa-solid ${iconClass} alert-icon"></i>
      <div class="alert-details">
        <div class="alert-top">
          <span class="alert-severity">${alt.severity}</span>
          <span class="alert-time">${alt.time}</span>
        </div>
        <span class="alert-title">${alt.type} - ${alt.device}</span>
        <p class="alert-desc">${alt.msg}</p>
        <div class="alert-actions">${actionButtons}</div>
      </div>
      <button class="alert-close" onclick="dismissAlert(${alt.id})"><i class="fa-solid fa-xmark"></i></button>
    `;
    
    container.appendChild(card);
  });
}

function dismissAlert(id) {
  const alertObj = state.alerts.find(a => a.id === id);
  if (alertObj) {
    alertObj.read = true;
    
    // Animate dismissal transition
    const cardEl = document.getElementById(`alert-item-${id}`);
    if (cardEl) {
      cardEl.style.transform = 'translateY(10px)';
      cardEl.style.opacity = '0';
      setTimeout(() => {
        renderAlerts();
      }, 300);
    }
  }
}

function markAllAlertsAsRead() {
  state.alerts.forEach(a => a.read = true);
  renderAlerts();
}

// Activity Log Rendering
function renderActivityLog() {
  const container = document.getElementById('activity-log-container');
  if (!container) return;
  
  container.innerHTML = '';
  
  state.activityLog.forEach(log => {
    const parts = log.split(' ');
    const time = parts[0];
    const msg = parts.slice(1).join(' ');
    
    const row = document.createElement('div');
    row.className = 'log-row';
    row.innerHTML = `
      <span class="log-time">${time}</span>
      <span class="log-msg">${msg}</span>
    `;
    container.appendChild(row);
  });
  
  // Auto-scroll to bottom
  container.scrollTop = container.scrollHeight;
}

function pushActivityLog(message) {
  const timeStr = new Date().toLocaleTimeString('en-US', { hour12: false });
  state.activityLog.push(`${timeStr} ${message}`);
  
  if (state.activityLog.length > 25) {
    state.activityLog.shift();
  }
  
  renderActivityLog();
}

// Multi-Campus Portal View
function renderCampusGrid() {
  const container = document.getElementById('campus-grid-container');
  if (!container) return;
  
  container.innerHTML = '';
  
  const campuses = [
    { name: 'MIT CAMPUS', rooms: 47, devices: 89, saved: '34%', accuracy: '98.4%', status: 'All Systems OK', statusColor: 'var(--success)', admin: 'John Smith (j.smith@mit.edu)' },
    { name: 'STANFORD CAMPUS', rooms: 52, devices: 102, saved: '41%', accuracy: '97.8%', status: '2 Devices Offline', statusColor: 'var(--warning)', admin: 'Sarah Chen (s.chen@stanford.edu)' },
    { name: 'BERKELEY CAMPUS', rooms: 28, devices: 56, saved: '29%', accuracy: '96.5%', status: 'All Systems OK', statusColor: 'var(--success)', admin: 'David Vance (d.vance@berkeley.edu)' }
  ];
  
  campuses.forEach(camp => {
    const card = document.createElement('div');
    card.className = 'glass-card campus-card';
    card.innerHTML = `
      <div class="campus-header">
        <div class="campus-name-container">
          <i class="fa-solid fa-graduation-cap campus-icon"></i>
          <span class="campus-name">${camp.name}</span>
        </div>
        <button class="btn btn-secondary" style="padding:6px 12px; font-size:0.75rem;" onclick="alert('Switching console target campus to ${camp.name}...')">Manage</button>
      </div>
      
      <hr class="campus-divider">
      
      <div class="campus-details-grid">
        <div class="campus-detail-item">
          <span class="campus-detail-label">Rooms</span>
          <span class="campus-detail-val">${camp.rooms} rooms</span>
        </div>
        <div class="campus-detail-item">
          <span class="campus-detail-label">Devices</span>
          <span class="campus-detail-val">${camp.devices} online</span>
        </div>
        <div class="campus-detail-item">
          <span class="campus-detail-label">Energy Saved</span>
          <span class="campus-detail-val" style="color:var(--success)">${camp.saved} MTD</span>
        </div>
        <div class="campus-detail-item">
          <span class="campus-detail-label">AI Accuracy</span>
          <span class="campus-detail-val">${camp.accuracy}</span>
        </div>
      </div>
      
      <div class="campus-footer">
        <span>Status: <strong style="color: ${camp.statusColor};">${camp.status}</strong></span>
        <span>Operator: ${camp.admin}</span>
      </div>
    `;
    container.appendChild(card);
  });
}

// Room Utilization List (Analytics Panel)
function renderUtilizationList() {
  const container = document.getElementById('utilization-list-container');
  if (!container) return;
  
  container.innerHTML = '';
  
  const utils = [
    { room: 'A101 Computer Lab', rate: 78 },
    { room: 'B202 Chemistry Lab', rate: 65 },
    { room: 'A103 Seminar Room', rate: 45 },
    { room: 'A102 Lecture Hall', rate: 32 },
    { room: 'B201 Physics Lab', rate: 24 }
  ];
  
  utils.forEach(item => {
    const row = document.createElement('div');
    row.className = 'util-row';
    row.innerHTML = `
      <div class="util-info">
        <span class="util-room">${item.room}</span>
        <span class="util-val">${item.rate}%</span>
      </div>
      <div class="util-bar-track">
        <div class="util-bar-fill" id="util-fill-${item.room.split(' ')[0]}" style="width: 0%"></div>
      </div>
    `;
    container.appendChild(row);
    
    // Trigger visual loading
    setTimeout(() => {
      const bar = document.getElementById(`util-fill-${item.room.split(' ')[0]}`);
      if (bar) bar.style.width = `${item.rate}%`;
    }, 100);
  });
}

// Analytics 5x5 Occupancy Heatmap Grid builder
function buildHeatmap() {
  const days = ['M', 'T', 'W', 'R', 'F'];
  days.forEach(day => {
    const rowContainer = document.getElementById(`heatmap-blocks-${day}`);
    if (!rowContainer) return;
    
    rowContainer.innerHTML = '';
    
    // 5 time slot blocks per day
    for (let i = 0; i < 5; i++) {
      const block = document.createElement('div');
      
      // Determine pseudo-random levels
      let lvlClass = 'level-low';
      let tooltip = 'Occupancy Rate: 12%';
      const seed = (day.charCodeAt(0) + i) % 3;
      if (seed === 1) {
        lvlClass = 'level-med';
        tooltip = 'Occupancy Rate: 56%';
      } else if (seed === 2) {
        lvlClass = 'level-high';
        tooltip = 'Occupancy Rate: 84%';
      }
      
      block.className = `heatmap-block ${lvlClass}`;
      block.title = `${day} slots - ${tooltip}`;
      
      rowContainer.appendChild(block);
    }
  });
}

// ==================== BACKGROUND LIVE TELEMETRY SIMULATION LOOP ====================
function initBackgroundSimulation() {
  setInterval(() => {
    // 1. Classroom Fluctuations
    state.classrooms.forEach(room => {
      if (room.status === 'offline') return;
      
      // Random people updates (+/- 1 person)
      if (room.status === 'occupied') {
        const delta = Math.random() > 0.5 ? 1 : -1;
        room.peopleCount = Math.max(1, room.peopleCount + delta);
        
        // Random temperature updates matching fan actions
        if (room.fansOn) {
          room.temp = Math.max(21.0, room.temp - 0.05);
        } else {
          room.temp = Math.min(27.0, room.temp + 0.08);
        }
        
        // Mocking live telemetry publish events
        if (Math.random() > 0.7) {
          pushActivityLog(`[MQTT] tele/${room.id}/status -> {"peop":${room.peopleCount},"temp":${room.temp.toFixed(1)},"lights":${room.lightsOn},"fans":${room.fansOn}}`);
        }
      } else {
        // Empty rooms temperature drifts towards ambient 22.0
        if (room.temp > 22.0) room.temp -= 0.05;
        else if (room.temp < 22.0) room.temp += 0.05;
      }
    });

    // 2. Mock Alert Generator (10% chance per cycle)
    if (Math.random() > 0.95 && state.alerts.filter(a => !a.read).length < 5) {
      const warnRooms = ['A102', 'B201', 'A101'];
      const targetRoom = warnRooms[Math.floor(Math.random() * warnRooms.length)];
      
      const newAlert = {
        id: Date.now(),
        severity: 'warning',
        type: 'Telemetry Anomaly',
        time: new Date().toLocaleTimeString('en-US', { hour12: false }),
        device: `ESP32-${targetRoom}`,
        msg: `Slightly high wifi packet packet-loss rate detected on ${targetRoom} transmitter node.`,
        read: false
      };
      
      state.alerts.push(newAlert);
      renderAlerts();
    }

    // 3. Keep devices CPU fluctuations alive
    state.devices.forEach(dev => {
      if (dev.status === 'online') {
        dev.cpu = Math.floor(20 + Math.random() * 25);
      }
    });

    // 4. Update landing and dashboard stats counters
    updateLiveOverviewCounters();
    
    // Trigger CCTV Canvas redraw updates
    redrawCCTVCanvasStreams();
  }, 2500);
}

function updateLiveOverviewCounters() {
  const activeRooms = state.classrooms.filter(r => r.status !== 'offline').length;
  const occupiedRooms = state.classrooms.filter(r => r.status === 'occupied').length;
  const devicesOnline = state.devices.filter(d => d.status === 'online').length;
  
  // Update dashboard views
  safeSetText('stat-rooms', activeRooms);
  safeSetText('stat-occupied', occupiedRooms);
  safeSetText('stat-devices', devicesOnline);
  
  // Calculate mockup energy values
  const activeLights = state.classrooms.filter(r => r.lightsOn).length;
  const activeFans = state.classrooms.filter(r => r.fansOn).length;
  const currentLoad = (activeLights * 0.1) + (activeFans * 0.3); // mock kW
  safeSetText('stat-power', `${currentLoad.toFixed(1)}kW`);
  
  // Dynamic savings calculations
  const normalLoad = 4.2; // mock baseline
  const savings = Math.max(10, Math.floor(((normalLoad - currentLoad) / normalLoad) * 100));
  safeSetText('stat-saved', `${savings}%`);

  // Sync to Landing page
  safeSetText('landing-stat-rooms', `${activeRooms} Rooms`);
  safeSetText('landing-stat-savings', `${savings}% Less`);
  
  const totalOccupants = state.classrooms.reduce((acc, room) => acc + (room.peopleCount || 0), 0);
  safeSetText('landing-stat-people', `${totalOccupants} People`);
  safeSetText('landing-stat-devices', `${devicesOnline} Online`);
}

function safeSetText(id, val) {
  const el = document.getElementById(id);
  if (el) el.innerText = val;
}

// User-driven telemetry flicker trigger
function simulateTelemetryFlicker() {
  pushActivityLog('Manual telemetry sync request broadcasted to all ESP32 nodes...');
  document.querySelectorAll('.stat-value').forEach(el => {
    el.style.opacity = '0.3';
    setTimeout(() => el.style.opacity = '1', 400);
  });
  
  setTimeout(() => {
    updateLiveOverviewCounters();
    renderClassrooms();
    syncStateDevices();
    renderDevicesList();
    pushActivityLog('Sync completed: 6 active nodes verified.');
  }, 500);
}

// ==================== SURVEILLANCE CCTV REAL-TIME & LIVE VIDEO ENGINE ====================
let API_BASE = localStorage.getItem('visiongrid_backend_url') || (window.location.origin.includes('localhost') ? 'http://localhost:8000' : '');
let isBackendOnline = false;
let backendCameras = [];
let customCameras = loadCustomCameras();
let activeMediaStreams = {};
let previewMediaStream = null;
let selectedVideoFileBlobUrl = null;
let clientHudIntervals = {};
let backendWs = null;

function loadCustomCameras() {
  try {
    const raw = localStorage.getItem('visiongrid_custom_cameras');
    return raw ? JSON.parse(raw) : [];
  } catch(e) {
    return [];
  }
}

function saveCustomCameras(cams) {
  customCameras = cams;
  try {
    localStorage.setItem('visiongrid_custom_cameras', JSON.stringify(cams));
  } catch(e) {
    console.warn('Could not save cameras to localStorage:', e);
  }
}

async function checkBackendHealth() {
  const badgeText = document.getElementById('backend-status-text');
  const badgePill = document.getElementById('backend-status-badge');
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${API_BASE}/api/status`, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (res.ok) {
      isBackendOnline = true;
      if (badgeText) badgeText.innerText = 'Backend: Online (YOLOv8)';
      if (badgePill) {
        badgePill.className = 'backend-status-pill online';
      }
      return true;
    }
  } catch(e) { }
  isBackendOnline = false;
  if (badgeText) badgeText.innerText = 'Standalone Mode (Client Vision)';
  if (badgePill) {
    badgePill.className = 'backend-status-pill standalone';
  }
  return false;
}

function initBackendWebSocket() {
  if (backendWs && backendWs.readyState === WebSocket.OPEN) return;
  checkBackendHealth();
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const defaultHost = window.location.host || 'localhost:8000';
  let wsUrl = `${protocol}//${defaultHost}/ws`;
  if (API_BASE && API_BASE.startsWith('http')) {
    const hostPart = API_BASE.replace(/^https?:\/\//, '');
    const wsProto = API_BASE.startsWith('https') ? 'wss:' : 'ws:';
    wsUrl = `${wsProto}//${hostPart}/ws`;
  }
  
  try {
    backendWs = new WebSocket(wsUrl);
    backendWs.onopen = () => {
      console.log('Connected to VisionGrid Backend WebSocket!');
      pushActivityLog('Connected to Central Backend WebSocket pipeline.');
      checkBackendHealth();
    };
    backendWs.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleBackendBroadcast(data);
      } catch(e) { }
    };
    backendWs.onclose = () => {
      setTimeout(initBackendWebSocket, 4000);
    };
  } catch(e) {
    console.warn('Backend WebSocket could not connect:', e);
  }
}

function handleBackendBroadcast(data) {
  if (data.type === 'init') {
    if (data.rooms && Array.isArray(data.rooms)) {
      data.rooms.forEach(br => {
        const existing = state.classrooms.find(r => r.id === br.room_id);
        if (existing) {
          existing.status = br.occupied ? 'occupied' : 'empty';
          existing.peopleCount = br.people_count;
          existing.lightsOn = br.lights_on;
          existing.fansOn = br.fans_on;
          if (br.esp32_status) existing.signal = br.signal || 85;
        }
      });
      renderClassrooms();
      syncStateDevices();
      renderDevicesList();
    }
    if (data.cameras) {
      backendCameras = data.cameras;
      renderLiveCameraCards();
    }
  } else if (data.type === 'room_update') {
    const br = data.room || data;
    const roomId = br.room_id || data.room_id;
    const existing = state.classrooms.find(r => r.id === roomId);
    if (existing) {
      existing.status = br.occupied ? 'occupied' : 'empty';
      existing.peopleCount = br.people_count !== undefined ? br.people_count : (br.occupied ? 1 : 0);
      existing.lightsOn = br.power_status === 'ON' || br.lights_on;
      existing.fansOn = br.power_status === 'ON' || br.fans_on;
      if (br.esp32_status) existing.status = (br.esp32_status === 'Connected' ? (br.occupied ? 'occupied' : 'empty') : 'offline');
      renderClassrooms();
      syncStateDevices();
      renderDevicesList();
    }
    // Also update any camera card for this room
    if (backendCameras.length > 0) {
      backendCameras.forEach(c => {
        if (c.room_id === roomId) {
          c.occupied = br.occupied;
          if (br.people_count !== undefined) c.occupant_count = br.people_count;
        }
      });
      renderLiveCameraCards();
    }
  } else if (data.type === 'camera_added' || data.type === 'camera_removed') {
    fetchLiveCameras();
  }
}

async function fetchLiveCameras() {
  customCameras = loadCustomCameras();
  let serverCams = [];
  try {
    const res = await fetch(`${API_BASE}/api/cameras`);
    if (res.ok) {
      const data = await res.json();
      serverCams = data.cameras || [];
      isBackendOnline = true;
      checkBackendHealth();
    }
  } catch(e) {
    isBackendOnline = false;
    checkBackendHealth();
  }

  // Merge server cameras with client custom cameras
  const mergedMap = new Map();
  serverCams.forEach(c => {
    mergedMap.set(c.id, {
      ...c,
      is_server_managed: true
    });
  });
  customCameras.forEach(c => {
    if (!mergedMap.has(c.id)) {
      mergedMap.set(c.id, c);
    }
  });

  backendCameras = Array.from(mergedMap.values());

  // If completely empty, seed default simulation cameras
  if (backendCameras.length === 0) {
    backendCameras = [
      {
        id: 'cam_a101',
        name: 'Room A101 Main CCTV',
        room_id: 'A101',
        source_type: 'simulation',
        source: 'simulation',
        description: 'Classroom A101 primary simulated wide-angle stream',
        ai_overlay_enabled: true,
        heatmap_enabled: false,
        occupant_count: 3,
        occupied: true,
        fps: 29.8
      },
      {
        id: 'cam_a102',
        name: 'Room A102 Lecture Hall',
        room_id: 'A102',
        source_type: 'simulation',
        source: 'simulation',
        description: 'Lecture Hall A102 simulated wide-angle surveillance stream',
        ai_overlay_enabled: true,
        heatmap_enabled: false,
        occupant_count: 0,
        occupied: false,
        fps: 30.0
      },
      {
        id: 'cam_b202',
        name: 'Room B202 Chemistry Lab',
        room_id: 'B202',
        source_type: 'simulation',
        source: 'simulation',
        description: 'Chemistry Lab B202 simulated high-angle feed',
        ai_overlay_enabled: true,
        heatmap_enabled: false,
        occupant_count: 2,
        occupied: true,
        fps: 28.5
      }
    ];
  }

  renderLiveCameraCards();
}

function initCCTVCanvasStreams() {
  initBackendWebSocket();
  fetchLiveCameras();
}

function stopAllClientMediaStreams() {
  // Stop all active webcam tracks
  for (let id in activeMediaStreams) {
    try {
      if (activeMediaStreams[id]) {
        activeMediaStreams[id].getTracks().forEach(t => t.stop());
      }
    } catch(e) { }
  }
  activeMediaStreams = {};

  // Clear animation intervals
  for (let id in clientHudIntervals) {
    try {
      cancelAnimationFrame(clientHudIntervals[id]);
      clearInterval(clientHudIntervals[id]);
    } catch(e) { }
  }
  clientHudIntervals = {};
}

function renderLiveCameraCards() {
  const container = document.getElementById('cctv-grid-container');
  if (!container) return;
  
  stopAllClientMediaStreams();
  container.innerHTML = '';

  backendCameras.forEach(cam => {
    const card = document.createElement('div');
    card.className = 'glass-card camera-card';
    card.id = `card-${cam.id}`;
    
    let mediaHtml = '';
    const st = cam.source_type || (cam.is_simulation ? 'simulation' : (cam.source && String(cam.source).startsWith('http') ? 'mjpeg' : (cam.source === '0' || cam.source === '1' ? 'server' : 'simulation')));

    if (st === 'browser_webcam') {
      mediaHtml = `
        <video id="video-${cam.id}" autoplay playsinline muted class="camera-stream-video"></video>
        <canvas id="overlay-${cam.id}" class="camera-feed-canvas-overlay" width="640" height="360"></canvas>
      `;
    } else if (st === 'video_file') {
      mediaHtml = `
        <video id="video-${cam.id}" src="${cam.source}" loop autoplay playsinline muted class="camera-stream-video"></video>
        <canvas id="overlay-${cam.id}" class="camera-feed-canvas-overlay" width="640" height="360"></canvas>
      `;
    } else if (st === 'mjpeg') {
      mediaHtml = `
        <img id="img-${cam.id}" src="${cam.source}" class="camera-stream-img" alt="${cam.name}" 
             onerror="handleImageFeedError(this, '${cam.id}')" />
        <canvas id="overlay-${cam.id}" class="camera-feed-canvas-overlay" width="640" height="360"></canvas>
      `;
    } else if (st === 'server' || cam.is_server_managed) {
      mediaHtml = `
        <img id="img-${cam.id}" src="${API_BASE}/api/cameras/${cam.id}/stream" class="camera-stream-img" alt="${cam.name}" 
             onerror="handleServerStreamError(this, '${cam.id}')" />
      `;
    } else {
      mediaHtml = `
        <canvas class="camera-canvas" id="canvas-${cam.id}" width="640" height="360"></canvas>
      `;
    }

    const sourceLabel = st === 'browser_webcam' ? 'USB / WebCam' : (st === 'rtsp' ? 'RTSP CCTV' : (st === 'mjpeg' ? 'HTTP/MJPEG' : (st === 'video_file' ? 'Local Clip' : (st === 'server' ? 'Server Cam' : 'Simulated AI'))));

    card.innerHTML = `
      <div class="camera-feed-container" id="feed-${cam.id}">
        ${mediaHtml}
        <div class="camera-meta">
          <span class="cam-name-badge">${cam.name} [${cam.room_id}]</span>
          <span class="badge ${cam.occupied ? 'badge-online' : 'badge-offline'}" id="cam-occ-badge-${cam.id}">${cam.occupied ? 'OCCUPIED' : 'EMPTY'}</span>
        </div>
        <div class="camera-controls">
          <button class="cam-ctrl-btn" onclick="takeCameraSnapshot('${cam.id}')" title="Snapshot Frame"><i class="fa-solid fa-camera"></i></button>
          <button class="cam-ctrl-btn" onclick="toggleCameraAI('${cam.id}')" title="Toggle AI Bounding Box HUD"><i class="fa-solid fa-brain"></i></button>
          <button class="cam-ctrl-btn" onclick="toggleCameraHeatmap('${cam.id}')" title="Toggle Heatmap Overlay"><i class="fa-solid fa-fire"></i></button>
          <button class="cam-ctrl-btn" onclick="expandLiveCameraFullScreen('${cam.id}', '${cam.name}')" title="Full Screen"><i class="fa-solid fa-expand"></i></button>
          <button class="cam-ctrl-btn danger-hover" onclick="deleteCameraLive('${cam.id}')" title="Delete Camera Stream"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
      <div class="camera-footer">
        <div class="cam-stats">
          <div class="cam-stat-item">
            <span class="cam-stat-label">Detects:</span>
            <span class="cam-stat-val" id="cam-stat-peop-${cam.id}">${cam.occupant_count !== undefined ? cam.occupant_count : 0}</span>
          </div>
          <div class="cam-stat-item">
            <span class="cam-stat-label">Source / Type:</span>
            <span class="cam-stat-val" style="color:var(--primary-accent);">${sourceLabel}</span>
          </div>
        </div>
        <div>
          <button class="btn btn-ghost" style="padding:4px 12px; font-size:0.8rem;" onclick="expandLiveCameraFullScreen('${cam.id}', '${cam.name}')">Expand Feed</button>
        </div>
      </div>
    `;
    container.appendChild(card);

    setTimeout(() => {
      initCardMediaFeed(cam);
    }, 50);
  });
}


function renderFallbackCanvasStreams() {
  const container = document.getElementById('cctv-grid-container');
  if (!container) return;
  container.innerHTML = '';
  
  state.classrooms.forEach(room => {
    const card = document.createElement('div');
    card.className = 'glass-card camera-card';
    const isOffline = room.status === 'offline';
    
    card.innerHTML = `
      <div class="camera-feed-container" id="feed-${room.id}">
        <canvas class="camera-canvas" id="canvas-${room.id}" width="640" height="360"></canvas>
        <div class="camera-meta">
          <span class="cam-name-badge">${room.name} — CCTV CAM</span>
          <span class="badge ${room.status === 'occupied' ? 'badge-online' : 'badge-offline'}">${room.status}</span>
        </div>
        <div class="camera-controls">
          <button class="cam-ctrl-btn" onclick="alert('Snapshot taken.')" title="Snapshot"><i class="fa-solid fa-camera"></i></button>
          <button class="cam-ctrl-btn" onclick="toggleAISingle('${room.id}')" title="Toggle AI Core Overlay"><i class="fa-solid fa-brain"></i></button>
        </div>
      </div>
      <div class="camera-footer">
        <div class="cam-stats">
          <div class="cam-stat-item">
            <span class="cam-stat-label">Detects:</span>
            <span class="cam-stat-val" id="cam-stat-peop-${room.id}">${isOffline ? '--' : room.peopleCount}</span>
          </div>
          <div class="cam-stat-item">
            <span class="cam-stat-label">AI Conf:</span>
            <span class="cam-stat-val" style="color:var(--primary-accent);">${isOffline ? '--' : '98.4%'}</span>
          </div>
        </div>
        <div>
          <button class="btn btn-ghost" style="padding:4px 12px; font-size:0.8rem;" onclick="expandCameraFullScreen('${room.id}')">Expand Feed</button>
        </div>
      </div>
    `;
    container.appendChild(card);
    
    if (!isOffline) {
      setTimeout(() => {
        const canvas = document.getElementById(`canvas-${room.id}`);
        if (canvas) {
          state.cctvStreams[room.id] = {
            canvas: canvas,
            ctx: canvas.getContext('2d'),
            aiOverlayEnabled: true,
            heatmapOverlayEnabled: false
          };
          drawCCTVFrame(room.id);
        }
      }, 50);
    }
  });
}

function toggleAISingle(roomId) {
  const stream = state.cctvStreams[roomId];
  if (stream) {
    stream.aiOverlayEnabled = !stream.aiOverlayEnabled;
    pushActivityLog(`CCTV stream overlay updated on cam ${roomId}`);
    drawCCTVFrame(roomId);
  }
}

function toggleAIDetectionOverlay(checkbox) {
  for (let roomId in state.cctvStreams) {
    state.cctvStreams[roomId].aiOverlayEnabled = checkbox.checked;
    drawCCTVFrame(roomId);
  }
}

function toggleHeatmapOverlay(checkbox) {
  for (let roomId in state.cctvStreams) {
    state.cctvStreams[roomId].heatmapOverlayEnabled = checkbox.checked;
    drawCCTVFrame(roomId);
  }
}

function redrawCCTVCanvasStreams() {
  for (let roomId in state.cctvStreams) {
    drawCCTVFrame(roomId);
  }
}

// Drawing core canvas logic representing cyberpunk wireframe surveillance
function drawCCTVFrame(roomId) {
  const stream = state.cctvStreams[roomId];
  if (!stream) return;
  
  const ctx = stream.ctx;
  const canvas = stream.canvas;
  const room = state.classrooms.find(r => r.id === roomId);
  if (!room) return;
  
  const w = canvas.width;
  const h = canvas.height;
  
  // Clear Frame
  ctx.fillStyle = '#050508';
  ctx.fillRect(0, 0, w, h);
  
  // Draw Room Wireframe (Desks, doors, corridors in deep slate)
  ctx.strokeStyle = '#161b22';
  ctx.lineWidth = 1.5;
  
  // Room grid desks
  for (let x = 80; x < w; x += 120) {
    ctx.strokeRect(x, 100, 60, 40);
    ctx.strokeRect(x, 200, 60, 40);
  }
  
  // Front podium
  ctx.strokeRect(40, 20, 30, 60);
  
  // Draw CCTV Scanlines overlay
  ctx.strokeStyle = 'rgba(255,255,255,0.02)';
  ctx.lineWidth = 1;
  for (let y = 0; y < h; y += 4) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  
  // Draw Flashing Red recording indicator inside Canvas
  const pulseOpacity = 0.3 + Math.abs(Math.sin(Date.now() / 300)) * 0.7;
  ctx.fillStyle = `rgba(239, 68, 68, ${pulseOpacity})`;
  ctx.beginPath();
  ctx.arc(580, 25, 6, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.fillStyle = '#ffffff';
  ctx.font = "bold 9px 'JetBrains Mono'";
  ctx.fillText("LIVE REC", 515, 28);
  
  // Target tracking jitter calculations
  const occupants = state.canvasDetections[roomId];
  
  // Draw Heatmap cloud overlay
  if (stream.heatmapOverlayEnabled && room.status === 'occupied' && occupants) {
    occupants.forEach(occ => {
      let grad = ctx.createRadialGradient(occ.x, occ.y, 5, occ.x, occ.y, 90);
      grad.addColorStop(0, 'rgba(0, 212, 255, 0.4)');
      grad.addColorStop(0.3, 'rgba(124, 58, 237, 0.2)');
      grad.addColorStop(1, 'rgba(124, 58, 237, 0)');
      
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(occ.x, occ.y, 90, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // Draw AI bounding boxes
  if (stream.aiOverlayEnabled && room.status === 'occupied' && occupants) {
    occupants.forEach((occ, idx) => {
      // Simulate target movements toward target coords
      if (Math.abs(occ.x - occ.tx) < 2) {
        occ.tx = Math.floor(50 + Math.random() * (w - 100));
        occ.ty = Math.floor(80 + Math.random() * (h - 120));
      } else {
        occ.x += (occ.tx - occ.x) * 0.015;
        occ.y += (occ.ty - occ.y) * 0.015;
      }
      
      // Jitter box size slightly
      const boxJitter = (Math.random() - 0.5) * 1.5;
      const bw = 45 + boxJitter;
      const bh = 90 + boxJitter;
      
      // Neon Bounding Box
      ctx.strokeStyle = 'rgba(0, 212, 255, 0.8)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(occ.x - bw/2, occ.y - bh, bw, bh);
      
      // Draw Bounding Corners (Glow elements)
      ctx.fillStyle = 'rgba(0, 212, 255, 0.9)';
      const cl = 6; // Corner length
      // Top-Left Corner
      ctx.fillRect(occ.x - bw/2 - 1, occ.y - bh - 1, cl, 2);
      ctx.fillRect(occ.x - bw/2 - 1, occ.y - bh - 1, 2, cl);
      
      // Top-Right Corner
      ctx.fillRect(occ.x + bw/2 - cl + 1, occ.y - bh - 1, cl, 2);
      ctx.fillRect(occ.x + bw/2 - 1, occ.y - bh - 1, 2, cl);
      
      // Bottom-Left
      ctx.fillRect(occ.x - bw/2 - 1, occ.y - 1, cl, 2);
      ctx.fillRect(occ.x - bw/2 - 1, occ.y - cl + 1, 2, cl);
      
      // Bottom-Right
      ctx.fillRect(occ.x + bw/2 - cl + 1, occ.y - 1, cl, 2);
      ctx.fillRect(occ.x + bw/2 - 1, occ.y - cl + 1, 2, cl);
      
      // Box Label Tag Background
      ctx.fillStyle = 'rgba(0, 212, 255, 0.9)';
      ctx.fillRect(occ.x - bw/2 - 1, occ.y - bh - 15, bw + 2, 14);
      
      // Text
      ctx.fillStyle = '#0a0a0f';
      ctx.font = "bold 8px 'Inter'";
      ctx.fillText(`${occ.conf} HUM`, occ.x - bw/2 + 3, occ.y - bh - 5);
      
      // Draw movement path nodes
      ctx.fillStyle = 'rgba(124, 58, 237, 0.8)';
      ctx.beginPath();
      ctx.arc(occ.x, occ.y, 3, 0, Math.PI * 2);
      ctx.fill();
    });
  }
}

function expandCameraFullScreen(roomId) {
  alert(`Launching high-fidelity full-screen RTSP player stream for ${roomId}...`);
}

function triggerMockScreenshot() {
  alert('Full campus layout snapshot captured successfully and saved to localized assets folder.');
}

// ==================== ANALYTICS GRAPHICS DRAW ENGINE ====================
function initAnalyticsChart() {
  const canvas = document.getElementById('energy-chart');
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  const w = canvas.offsetWidth;
  const h = canvas.offsetHeight;
  canvas.width = w;
  canvas.height = h;
  
  // Clear
  ctx.fillStyle = 'transparent';
  ctx.clearRect(0, 0, w, h);
  
  // Graph metrics
  const paddingLeft = 40;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 30;
  const chartW = w - paddingLeft - paddingRight;
  const chartH = h - paddingTop - paddingBottom;
  
  const thisWeekData = [2.8, 3.4, 2.5, 2.9, 2.1, 1.8, 1.4];
  const lastWeekData = [3.8, 4.1, 3.9, 4.2, 3.5, 2.8, 2.4];
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  
  // Grid Lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = paddingTop + (chartH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(paddingLeft, y);
    ctx.lineTo(w - paddingRight, y);
    ctx.stroke();
  }
  
  // Draw Days Labels
  ctx.fillStyle = '#8b949e';
  ctx.font = "10px 'JetBrains Mono'";
  ctx.textAlign = 'center';
  const stepX = chartW / 6;
  for (let i = 0; i < 7; i++) {
    const x = paddingLeft + stepX * i;
    ctx.fillText(days[i], x, h - 8);
  }
  
  // Function to convert value to Y coord
  const valToY = (val) => {
    const maxVal = 5.0;
    return paddingTop + chartH - ((val / maxVal) * chartH);
  };
  
  // Draw Last Week Area Gradient (Purple)
  ctx.fillStyle = 'rgba(124, 58, 237, 0.05)';
  ctx.beginPath();
  ctx.moveTo(paddingLeft, valToY(lastWeekData[0]));
  for (let i = 1; i < 7; i++) {
    ctx.lineTo(paddingLeft + stepX * i, valToY(lastWeekData[i]));
  }
  ctx.lineTo(paddingLeft + stepX * 6, paddingTop + chartH);
  ctx.lineTo(paddingLeft, paddingTop + chartH);
  ctx.closePath();
  ctx.fill();
  
  // Draw Last Week Line
  ctx.strokeStyle = 'rgba(124, 58, 237, 0.5)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(paddingLeft, valToY(lastWeekData[0]));
  for (let i = 1; i < 7; i++) {
    ctx.lineTo(paddingLeft + stepX * i, valToY(lastWeekData[i]));
  }
  ctx.stroke();
  
  // Draw This Week Area Gradient (Cyan)
  let cyanGrad = ctx.createLinearGradient(0, paddingTop, 0, paddingTop + chartH);
  cyanGrad.addColorStop(0, 'rgba(0, 212, 255, 0.2)');
  cyanGrad.addColorStop(1, 'rgba(0, 212, 255, 0)');
  ctx.fillStyle = cyanGrad;
  ctx.beginPath();
  ctx.moveTo(paddingLeft, valToY(thisWeekData[0]));
  for (let i = 1; i < 7; i++) {
    ctx.lineTo(paddingLeft + stepX * i, valToY(thisWeekData[i]));
  }
  ctx.lineTo(paddingLeft + stepX * 6, paddingTop + chartH);
  ctx.lineTo(paddingLeft, paddingTop + chartH);
  ctx.closePath();
  ctx.fill();
  
  // Draw This Week Line
  ctx.strokeStyle = '#00d4ff';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(paddingLeft, valToY(thisWeekData[0]));
  for (let i = 1; i < 7; i++) {
    ctx.lineTo(paddingLeft + stepX * i, valToY(thisWeekData[i]));
  }
  ctx.stroke();
  
  // Draw circles on active nodes
  ctx.fillStyle = '#00d4ff';
  for (let i = 0; i < 7; i++) {
    ctx.beginPath();
    ctx.arc(paddingLeft + stepX * i, valToY(thisWeekData[i]), 4, 0, Math.PI*2);
    ctx.fill();
  }
}

function triggerDataExport() {
  alert('Exporting energy logging arrays as CSV structure...');
}

// ==================== INTERACTIVE AUTOMATION RULES MODALS ====================
function openCreateRuleModal() {
  document.getElementById('rule-build-name').value = '';
  document.getElementById('modal-rule-title').innerText = 'Create Smart Automation Rule';
  document.getElementById('rule-builder-modal').classList.add('active');
}

function closeRuleBuilderModal() {
  document.getElementById('rule-builder-modal').classList.remove('active');
}

function simulateRuleValidation() {
  alert('Rule Validator Core running simulation...\n- Conflict check passed: No overlapping rule schedules.\n- Validation Success: MQTT relays mapped to ESP32 pins correctly.');
}

function handleRuleBuilderSubmit(e) {
  e.preventDefault();
  
  const name = document.getElementById('rule-build-name').value;
  const condition = document.getElementById('rule-build-condition').options[document.getElementById('rule-build-condition').selectedIndex].text;
  const action = document.getElementById('rule-build-action').options[document.getElementById('rule-build-action').selectedIndex].text;
  const applies = document.getElementById('rule-build-apply').options[document.getElementById('rule-build-apply').selectedIndex].text;
  
  const newRule = {
    id: Date.now(),
    name: name,
    condition: condition,
    action: action,
    appliesTo: applies,
    active: true,
    runs: 0
  };
  
  state.rules.push(newRule);
  renderRules();
  closeRuleBuilderModal();
  pushActivityLog(`10:48:15 New automation rule created: "${name}" applied to campus.`);
}

// ==================== CONSOLE DEVICE CREATION MODAL ====================
function openAddDeviceModal() {
  document.getElementById('dev-build-name').value = '';
  document.getElementById('add-device-modal').classList.add('active');
}

function closeAddDeviceModal() {
  document.getElementById('add-device-modal').classList.remove('active');
}

function handleAddDeviceSubmit(e) {
  e.preventDefault();
  
  const name = document.getElementById('dev-build-name').value;
  const room = document.getElementById('dev-build-room').value;
  const mac = document.getElementById('dev-build-mac').value;
  
  // Find if room already has device
  const targetRoom = state.classrooms.find(r => r.id === room);
  if (targetRoom) {
    targetRoom.deviceId = name;
    targetRoom.mac = mac;
    targetRoom.status = 'occupied'; // auto trigger online
    targetRoom.signal = 88;
    targetRoom.temp = 24.0;
    targetRoom.lightsOn = true;
    targetRoom.fansOn = true;
    targetRoom.recentEvents = ['Telemetry initialized', 'Direct handshake handshake successful'];
    
    pushActivityLog(`10:49:10 New hardware registry: ESP32 device ${name} synced with room ${room}`);
  }
  
  closeAddDeviceModal();
  syncStateDevices();
  renderClassrooms();
  renderDevicesList();
}

// ==================== LIVE CAMERA ADD & MANAGE MODALS (MULTI-SOURCE) ====================

function selectCameraCategory(cat) {
  const selectedInput = document.getElementById('cam-add-selected-category');
  if (selectedInput) selectedInput.value = cat;

  // Update button active states
  const buttons = document.querySelectorAll('#cam-category-selector .cam-type-btn');
  buttons.forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-type') === cat);
  });

  // Toggle sections
  const sections = ['browser_webcam', 'rtsp', 'mjpeg', 'video_file', 'server', 'simulation'];
  sections.forEach(s => {
    const el = document.getElementById(`section-${s}`);
    if (el) el.style.display = (s === cat ? 'block' : 'none');
  });

  if (cat === 'browser_webcam') {
    detectLocalWebcams();
  }
}

async function detectLocalWebcams() {
  const select = document.getElementById('cam-browser-devices');
  if (!select) return;

  select.innerHTML = '<option value="default">Default System Camera / USB Cam</option>';

  if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
    select.innerHTML += '<option value="default" disabled>(Device enumeration not supported in this browser)</option>';
    return;
  }

  try {
    // Probe permissions to get real device labels
    try {
      const probe = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      probe.getTracks().forEach(t => t.stop());
    } catch(err) { }

    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(d => d.kind === 'videoinput');

    if (videoDevices.length > 0) {
      select.innerHTML = '';
      videoDevices.forEach((dev, idx) => {
        const opt = document.createElement('option');
        opt.value = dev.deviceId || `device_${idx}`;
        opt.innerText = dev.label ? dev.label : `USB Video Device ${idx + 1}`;
        select.appendChild(opt);
      });
    }
  } catch(e) {
    console.warn('Could not list video devices:', e);
  }
}

function applyRTSPPreset(brand) {
  const input = document.getElementById('cam-rtsp-url');
  if (!input) return;

  const presets = {
    hikvision: 'rtsp://admin:12345@192.168.1.100:554/Streaming/Channels/101',
    dahua: 'rtsp://admin:admin123@192.168.1.100:554/cam/realmonitor?channel=1&subtype=0',
    tapo: 'rtsp://admin:password@192.168.1.100:554/stream1',
    reolink: 'rtsp://admin:password@192.168.1.100:554/h264Preview_01_main',
    axis: 'rtsp://root:pass@192.168.1.100/axis-media/media.amp',
    generic: 'rtsp://admin:pass@192.168.1.100:554/live/ch0'
  };

  input.value = presets[brand] || presets.generic;
}

function applyMJPEGPreset(type) {
  const input = document.getElementById('cam-mjpeg-url');
  if (!input) return;

  const presets = {
    esp32: 'http://192.168.1.120:81/stream',
    ipwebcam: 'http://192.168.1.50:8080/video',
    droidcam: 'http://192.168.1.50:4747/video',
    public: 'https://images.unsplash.com/photo-1577495508048-b635879837f1?auto=format&fit=crop&w=640&q=80'
  };

  input.value = presets[type] || '';
}

function applySampleVideo(type) {
  const input = document.getElementById('cam-video-url');
  if (!input) return;

  // Reliable, high quality public sample videos for smart classroom testing
  const samples = {
    classroom: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    hallway: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
  };

  input.value = samples[type] || '';
  testCameraPreview();
}

function handleVideoFileSelected(input) {
  if (input.files && input.files[0]) {
    const file = input.files[0];
    selectedVideoFileBlobUrl = URL.createObjectURL(file);
    testCameraPreview();
  }
}

async function testCameraPreview() {
  const previewBox = document.getElementById('cam-modal-preview');
  if (!previewBox) return;

  if (previewMediaStream) {
    previewMediaStream.getTracks().forEach(t => t.stop());
    previewMediaStream = null;
  }

  const cat = document.getElementById('cam-add-selected-category').value;
  previewBox.innerHTML = '<span style="color:var(--primary-accent);"><i class="fa-solid fa-spinner fa-spin"></i> Initializing feed test...</span>';

  if (cat === 'browser_webcam') {
    const devSelect = document.getElementById('cam-browser-devices');
    const deviceId = devSelect ? devSelect.value : 'default';
    const constraints = {
      video: deviceId && deviceId !== 'default' ? { deviceId: { exact: deviceId } } : true,
      audio: false
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      previewMediaStream = stream;
      previewBox.innerHTML = '<video id="preview-video" autoplay playsinline muted style="width:100%; height:100%; object-fit:cover;"></video>';
      const vid = document.getElementById('preview-video');
      if (vid) vid.srcObject = stream;
    } catch(err) {
      previewBox.innerHTML = `<span style="color:var(--danger); padding:10px;"><i class="fa-solid fa-triangle-exclamation"></i> Camera Access Denied: ${err.message}</span>`;
    }
  } else if (cat === 'video_file') {
    const fileInput = document.getElementById('cam-video-file-input');
    const urlInput = document.getElementById('cam-video-url');
    let src = '';
    if (fileInput && fileInput.files && fileInput.files[0]) {
      src = selectedVideoFileBlobUrl || URL.createObjectURL(fileInput.files[0]);
    } else if (urlInput && urlInput.value.trim()) {
      src = urlInput.value.trim();
    }

    if (src) {
      previewBox.innerHTML = `<video src="${src}" autoplay loop muted style="width:100%; height:100%; object-fit:cover;"></video>`;
    } else {
      previewBox.innerHTML = '<span>Please choose a video file or enter a video clip URL</span>';
    }
  } else if (cat === 'mjpeg') {
    const mjpegInput = document.getElementById('cam-mjpeg-url');
    const src = mjpegInput ? mjpegInput.value.trim() : '';
    if (src) {
      previewBox.innerHTML = `<img src="${src}" style="width:100%; height:100%; object-fit:cover;" onerror="this.onerror=null; this.parentElement.innerHTML='<span style=\\'color:var(--danger)\\'>Failed to load HTTP stream</span>';" />`;
    } else {
      previewBox.innerHTML = '<span>Enter an HTTP/MJPEG URL to preview</span>';
    }
  } else if (cat === 'rtsp') {
    const rtspInput = document.getElementById('cam-rtsp-url');
    previewBox.innerHTML = `<div style="text-align:center; padding:12px;"><i class="fa-solid fa-network-wired" style="font-size:1.8rem; color:var(--primary-accent); margin-bottom:6px;"></i><div>RTSP Network Stream Configured</div><div style="font-size:0.75rem; color:var(--text-secondary); margin-top:4px;">${rtspInput ? rtspInput.value : 'Ready for connection'}</div></div>`;
  } else if (cat === 'server') {
    const srvInput = document.getElementById('cam-server-index');
    previewBox.innerHTML = `<div style="text-align:center; padding:12px;"><i class="fa-solid fa-server" style="font-size:1.8rem; color:var(--primary-accent); margin-bottom:6px;"></i><div>Backend VideoCapture (Index: ${srvInput ? srvInput.value : '0'})</div><div style="font-size:0.75rem; color:var(--text-secondary); margin-top:4px;">DirectShow OpenCV Device</div></div>`;
  } else {
    previewBox.innerHTML = `<div style="text-align:center; padding:12px;"><i class="fa-solid fa-brain" style="font-size:1.8rem; color:var(--secondary-accent); margin-bottom:6px;"></i><div>AI Simulated Smart Classroom</div><div style="font-size:0.75rem; color:var(--text-secondary); margin-top:4px;">Ready to generate dynamic occupants</div></div>`;
  }
}

function openAddCameraModal() {
  const modal = document.getElementById('add-camera-modal');
  if (!modal) return;
  document.getElementById('cam-add-name').value = '';
  document.getElementById('cam-add-desc').value = '';
  const customGroup = document.getElementById('custom-room-group');
  if (customGroup) customGroup.style.display = 'none';

  selectCameraCategory('browser_webcam');
  modal.classList.add('active');
}

function closeAddCameraModal() {
  if (previewMediaStream) {
    previewMediaStream.getTracks().forEach(t => t.stop());
    previewMediaStream = null;
  }
  const modal = document.getElementById('add-camera-modal');
  if (modal) modal.classList.remove('active');
}

document.addEventListener('change', (e) => {
  if (e.target && e.target.id === 'cam-add-room') {
    const customGroup = document.getElementById('custom-room-group');
    if (customGroup) {
      customGroup.style.display = e.target.value === 'CUSTOM' ? 'block' : 'none';
    }
  }
});

async function handleAddCameraSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('cam-add-name').value.trim();
  let room = document.getElementById('cam-add-room').value;
  if (room === 'CUSTOM') {
    const customInput = document.getElementById('cam-add-custom-room');
    room = (customInput && customInput.value.trim().toUpperCase()) || 'NEW101';
  }

  const cat = document.getElementById('cam-add-selected-category').value;
  const desc = document.getElementById('cam-add-desc').value.trim();
  const aiEnabled = document.getElementById('cam-add-ai').checked;
  const heatmapEnabled = document.getElementById('cam-add-heatmap').checked;

  let source = '';
  if (cat === 'browser_webcam') {
    const devSelect = document.getElementById('cam-browser-devices');
    source = devSelect ? devSelect.value : 'default';
  } else if (cat === 'rtsp') {
    source = document.getElementById('cam-rtsp-url').value.trim() || 'rtsp://192.168.1.100:554/stream1';
  } else if (cat === 'mjpeg') {
    source = document.getElementById('cam-mjpeg-url').value.trim() || 'http://192.168.1.120:81/stream';
  } else if (cat === 'video_file') {
    const fileInput = document.getElementById('cam-video-file-input');
    const urlInput = document.getElementById('cam-video-url');
    if (fileInput && fileInput.files && fileInput.files[0]) {
      source = selectedVideoFileBlobUrl || URL.createObjectURL(fileInput.files[0]);
    } else if (urlInput && urlInput.value.trim()) {
      source = urlInput.value.trim();
    } else {
      source = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';
    }
  } else if (cat === 'server') {
    source = document.getElementById('cam-server-index').value.trim() || '0';
  } else {
    source = 'simulation';
  }

  const camId = `cam_${Date.now()}_${Math.floor(Math.random() * 900 + 100)}`;

  const newCamera = {
    id: camId,
    name: name,
    room_id: room,
    source_type: cat,
    source: source,
    description: desc,
    ai_overlay_enabled: aiEnabled,
    heatmap_enabled: heatmapEnabled,
    occupant_count: (cat === 'simulation' ? Math.floor(Math.random() * 5 + 1) : 1),
    occupied: true,
    fps: 30.0,
    created_at: new Date().toLocaleTimeString()
  };

  // If backend is online, attempt to register with server too
  if (isBackendOnline && (cat === 'server' || cat === 'rtsp' || cat === 'mjpeg')) {
    try {
      await fetch(`${API_BASE}/api/cameras`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name,
          room_id: room,
          source: source,
          description: desc,
          ai_enabled: aiEnabled
        })
      });
    } catch(err) {
      console.warn('Backend sync failed, storing locally:', err);
    }
  }

  // Save to client storage
  customCameras.push(newCamera);
  saveCustomCameras(customCameras);

  pushActivityLog(`New camera '${name}' added for Room ${room} (${cat.toUpperCase()}: ${source.slice(0, 32)})`);
  closeAddCameraModal();
  await fetchLiveCameras();
}

// Media Card Feed Initializer
function initCardMediaFeed(cam) {
  const st = cam.source_type;

  if (st === 'browser_webcam') {
    startBrowserWebcam(cam);
  } else if (st === 'video_file') {
    const vid = document.getElementById(`video-${cam.id}`);
    const ov = document.getElementById(`overlay-${cam.id}`);
    if (vid && ov) {
      startClientAIHud(cam.id, cam.room_id, vid, ov, cam);
    }
  } else if (st === 'mjpeg') {
    const img = document.getElementById(`img-${cam.id}`);
    const ov = document.getElementById(`overlay-${cam.id}`);
    if (img && ov) {
      startClientAIHud(cam.id, cam.room_id, img, ov, cam);
    }
  } else if (st === 'simulation' || (!st && cam.is_simulation)) {
    const canvas = document.getElementById(`canvas-${cam.id}`);
    if (canvas) {
      state.cctvStreams[cam.id] = {
        canvas: canvas,
        ctx: canvas.getContext('2d'),
        aiOverlayEnabled: cam.ai_overlay_enabled !== false,
        heatmapOverlayEnabled: !!cam.heatmap_enabled,
        roomId: cam.room_id
      };
      drawCCTVFrameForCam(cam.id, cam.room_id);
    }
  }
}

async function startBrowserWebcam(cam) {
  const vid = document.getElementById(`video-${cam.id}`);
  const ov = document.getElementById(`overlay-${cam.id}`);
  if (!vid) return;

  const constraints = {
    video: cam.source && cam.source !== 'default' ? { deviceId: { exact: cam.source }, width: { ideal: 640 }, height: { ideal: 360 } } : { width: { ideal: 640 }, height: { ideal: 360 } },
    audio: false
  };

  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    activeMediaStreams[cam.id] = stream;
    vid.srcObject = stream;
    vid.onloadedmetadata = () => {
      vid.play().catch(e => { });
    };

    if (ov) {
      startClientAIHud(cam.id, cam.room_id, vid, ov, cam);
    }
  } catch(err) {
    console.warn(`Could not open browser webcam for ${cam.id}:`, err);
    if (vid.parentElement) {
      vid.parentElement.innerHTML = `
        <div class="camera-offline-msg">
          <i class="fa-solid fa-triangle-exclamation"></i>
          <span>WEBCAM PERMISSION DENIED</span>
          <button class="btn btn-secondary" style="padding:4px 10px; font-size:0.75rem; margin-top:8px;" onclick="renderLiveCameraCards()">Retry</button>
        </div>
      `;
    }
  }
}

// Client-Side AI Detection Overlay Engine (Draws on video / image streams)
function startClientAIHud(camId, roomId, mediaEl, overlayCanvas, camConfig) {
  if (!overlayCanvas) return;
  const ctx = overlayCanvas.getContext('2d');
  let lastOccupantCalc = Date.now();
  let tick = Math.random() * 100;

  // Occupant positions
  let detectedPeople = [
    { x: 160, y: 180, tx: 160, ty: 180, conf: '99.4%', label: 'Person 1 [Seated]' },
    { x: 340, y: 150, tx: 340, ty: 150, conf: '98.8%', label: 'Person 2 [Seated]' },
    { x: 480, y: 200, tx: 480, ty: 200, conf: '97.6%', label: 'Person 3 [Whiteboard]' }
  ];

  function loop() {
    if (!document.getElementById(`feed-${camId}`)) {
      return; // Element no longer in DOM
    }

    tick += 0.03;
    const w = overlayCanvas.width;
    const h = overlayCanvas.height;

    ctx.clearRect(0, 0, w, h);

    const isAiOn = camConfig.ai_overlay_enabled !== false;
    const isHeatmapOn = !!camConfig.heatmap_enabled;

    // Draw Heatmap Overlay
    if (isHeatmapOn) {
      detectedPeople.forEach(p => {
        let grad = ctx.createRadialGradient(p.x, p.y, 5, p.x, p.y, 80);
        grad.addColorStop(0, 'rgba(0, 212, 255, 0.4)');
        grad.addColorStop(0.3, 'rgba(124, 58, 237, 0.25)');
        grad.addColorStop(1, 'rgba(124, 58, 237, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 80, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // Draw AI Bounding Boxes HUD
    if (isAiOn) {
      detectedPeople.forEach(p => {
        // Natural target motion
        if (Math.abs(p.x - p.tx) < 2) {
          p.tx = Math.floor(80 + Math.random() * (w - 160));
          p.ty = Math.floor(100 + Math.random() * (h - 160));
        } else {
          p.x += (p.tx - p.x) * 0.015;
          p.y += (p.ty - p.y) * 0.015;
        }

        const bw = 55;
        const bh = 110;

        // Bounding Box Neon
        ctx.strokeStyle = 'rgba(0, 212, 255, 0.9)';
        ctx.lineWidth = 1.8;
        ctx.strokeRect(p.x - bw/2, p.y - bh, bw, bh);

        // Glowing Corner Brackets
        ctx.fillStyle = '#00d4ff';
        const cl = 8;
        ctx.fillRect(p.x - bw/2 - 1, p.y - bh - 1, cl, 2);
        ctx.fillRect(p.x - bw/2 - 1, p.y - bh - 1, 2, cl);
        ctx.fillRect(p.x + bw/2 - cl + 1, p.y - bh - 1, cl, 2);
        ctx.fillRect(p.x + bw/2 - 1, p.y - bh - 1, 2, cl);
        ctx.fillRect(p.x - bw/2 - 1, p.y - 1, cl, 2);
        ctx.fillRect(p.x - bw/2 - 1, p.y - cl + 1, 2, cl);
        ctx.fillRect(p.x + bw/2 - cl + 1, p.y - 1, cl, 2);
        ctx.fillRect(p.x + bw/2 - 1, p.y - cl + 1, 2, cl);

        // HUD Tag Badge
        ctx.fillStyle = 'rgba(0, 212, 255, 0.95)';
        ctx.fillRect(p.x - bw/2 - 1, p.y - bh - 16, bw + 22, 15);
        ctx.fillStyle = '#050508';
        ctx.font = "bold 9px 'Inter', monospace";
        ctx.fillText(`HUM ${p.conf}`, p.x - bw/2 + 3, p.y - bh - 5);
      });
    }

    // Top watermark HUD
    ctx.fillStyle = 'rgba(239, 68, 68, 0.85)';
    ctx.beginPath();
    ctx.arc(w - 24, 20, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = "bold 9px 'JetBrains Mono'";
    ctx.fillText("LIVE AI", w - 68, 23);

    clientHudIntervals[camId] = requestAnimationFrame(loop);
  }

  clientHudIntervals[camId] = requestAnimationFrame(loop);
}

function drawCCTVFrameForCam(camId, roomId) {
  const stream = state.cctvStreams[camId];
  if (!stream) return;
  const ctx = stream.ctx;
  const canvas = stream.canvas;
  const w = canvas.width;
  const h = canvas.height;

  ctx.fillStyle = '#050508';
  ctx.fillRect(0, 0, w, h);

  // Grid
  ctx.strokeStyle = '#161b22';
  ctx.lineWidth = 1.5;
  for (let x = 80; x < w; x += 120) {
    ctx.strokeRect(x, 100, 60, 40);
    ctx.strokeRect(x, 200, 60, 40);
  }
  ctx.strokeRect(40, 20, 30, 60);

  // Scanlines
  ctx.strokeStyle = 'rgba(255,255,255,0.02)';
  ctx.lineWidth = 1;
  for (let y = 0; y < h; y += 4) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  // Rec Dot
  const pulseOpacity = 0.3 + Math.abs(Math.sin(Date.now() / 300)) * 0.7;
  ctx.fillStyle = `rgba(239, 68, 68, ${pulseOpacity})`;
  ctx.beginPath();
  ctx.arc(w - 24, 24, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = "bold 9px 'JetBrains Mono'";
  ctx.fillText("SIM REC", w - 74, 27);

  // AI Bounding Boxes for simulation
  if (stream.aiOverlayEnabled) {
    const occupants = state.canvasDetections[roomId] || [
      { x: 180, y: 150, tx: 180, ty: 150, conf: '98.5%' },
      { x: 320, y: 170, tx: 320, ty: 170, conf: '97.2%' }
    ];

    occupants.forEach(occ => {
      if (Math.abs(occ.x - occ.tx) < 2) {
        occ.tx = Math.floor(80 + Math.random() * (w - 160));
        occ.ty = Math.floor(100 + Math.random() * (h - 140));
      } else {
        occ.x += (occ.tx - occ.x) * 0.015;
        occ.y += (occ.ty - occ.y) * 0.015;
      }

      const bw = 50;
      const bh = 100;
      ctx.strokeStyle = 'rgba(0, 212, 255, 0.85)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(occ.x - bw/2, occ.y - bh, bw, bh);

      ctx.fillStyle = 'rgba(0, 212, 255, 0.9)';
      ctx.fillRect(occ.x - bw/2, occ.y - bh - 14, bw, 14);
      ctx.fillStyle = '#050508';
      ctx.font = "bold 8px 'Inter'";
      ctx.fillText(`${occ.conf} AI`, occ.x - bw/2 + 2, occ.y - bh - 4);
    });
  }

  clientHudIntervals[camId] = requestAnimationFrame(() => drawCCTVFrameForCam(camId, roomId));
}

function handleImageFeedError(img, camId) {
  img.onerror = null;
  img.src = 'https://images.unsplash.com/photo-1577495508048-b635879837f1?auto=format&fit=crop&w=640&q=80';
}

function handleServerStreamError(img, camId) {
  img.onerror = null;
  img.parentElement.innerHTML = `
    <div class="camera-offline-msg">
      <i class="fa-solid fa-triangle-exclamation"></i>
      <span>BACKEND STREAM RECONNECTING</span>
      <span style="font-size:0.75rem; color:var(--text-secondary); margin-top:4px;">Check backend on ${API_BASE}</span>
    </div>
  `;
}

async function deleteCameraLive(camId) {
  if (!confirm(`Are you sure you want to stop and remove camera '${camId}'?`)) return;

  // Stop active media stream if browser webcam
  if (activeMediaStreams[camId]) {
    try {
      activeMediaStreams[camId].getTracks().forEach(t => t.stop());
    } catch(e) { }
    delete activeMediaStreams[camId];
  }

  // Clear animation loops
  if (clientHudIntervals[camId]) {
    cancelAnimationFrame(clientHudIntervals[camId]);
    delete clientHudIntervals[camId];
  }

  // Remove from customCameras
  customCameras = customCameras.filter(c => c.id !== camId);
  saveCustomCameras(customCameras);

  // If backend online, also delete from backend
  if (isBackendOnline) {
    try {
      await fetch(`${API_BASE}/api/cameras/${camId}`, { method: 'DELETE' });
    } catch(e) { }
  }

  pushActivityLog(`Camera '${camId}' deleted and disconnected.`);
  await fetchLiveCameras();
}

function toggleCameraAI(camId) {
  const cam = backendCameras.find(c => c.id === camId);
  if (cam) {
    cam.ai_overlay_enabled = !(cam.ai_overlay_enabled !== false);
    saveCustomCameras(customCameras);
    pushActivityLog(`AI Detection HUD on camera '${cam.name}' toggled to ${cam.ai_overlay_enabled ? 'ON' : 'OFF'}`);
  }
}

function toggleCameraHeatmap(camId) {
  const cam = backendCameras.find(c => c.id === camId);
  if (cam) {
    cam.heatmap_enabled = !cam.heatmap_enabled;
    saveCustomCameras(customCameras);
    pushActivityLog(`Heatmap on camera '${cam.name}' toggled to ${cam.heatmap_enabled ? 'ON' : 'OFF'}`);
  }
}

function takeCameraSnapshot(camId) {
  const vid = document.getElementById(`video-${camId}`);
  const img = document.getElementById(`img-${camId}`);
  const cvs = document.getElementById(`canvas-${camId}`);
  const overlay = document.getElementById(`overlay-${camId}`);

  const snapCanvas = document.createElement('canvas');
  snapCanvas.width = 640;
  snapCanvas.height = 360;
  const sCtx = snapCanvas.getContext('2d');

  if (vid && vid.readyState >= 2) {
    sCtx.drawImage(vid, 0, 0, 640, 360);
  } else if (img && img.complete) {
    try {
      sCtx.drawImage(img, 0, 0, 640, 360);
    } catch(e) { }
  } else if (cvs) {
    sCtx.drawImage(cvs, 0, 0, 640, 360);
  } else {
    sCtx.fillStyle = '#050508';
    sCtx.fillRect(0, 0, 640, 360);
  }

  // Composite AI overlay if present
  if (overlay) {
    sCtx.drawImage(overlay, 0, 0, 640, 360);
  }

  // Watermark timestamp
  sCtx.fillStyle = '#00d4ff';
  sCtx.font = "bold 11px 'JetBrains Mono'";
  sCtx.fillText(`IRIS-VISION [${new Date().toLocaleString()}]`, 16, 340);

  // Trigger download
  try {
    const dataUrl = snapCanvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `snapshot_${camId}_${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    pushActivityLog(`Snapshot taken for camera '${camId}'.`);
  } catch(e) {
    alert('Snapshot captured. (Cross-origin restrictions prevented direct file download)');
  }
}

function expandLiveCameraFullScreen(camId, camName) {
  const container = document.getElementById(`feed-${camId}`);
  if (container) {
    if (!document.fullscreenElement) {
      if (container.requestFullscreen) {
        container.requestFullscreen();
      } else if (container.webkitRequestFullscreen) {
        container.webkitRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  }
}

// ==================== BACKEND CONFIGURATION MODAL ====================

function openBackendConfigModal() {
  const modal = document.getElementById('backend-config-modal');
  if (!modal) return;
  const input = document.getElementById('backend-url-input');
  if (input) input.value = API_BASE || 'http://localhost:8000';
  testBackendConnection();
  modal.classList.add('active');
}

function closeBackendConfigModal() {
  const modal = document.getElementById('backend-config-modal');
  if (modal) modal.classList.remove('active');
}

async function testBackendConnection() {
  const text = document.getElementById('backend-modal-status-text');
  const input = document.getElementById('backend-url-input');
  const url = (input && input.value.trim()) || 'http://localhost:8000';

  if (text) text.innerHTML = '<span style="color:var(--primary-accent);"><i class="fa-solid fa-spinner fa-spin"></i> Pinging server...</span>';

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(`${url}/api/status`, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (text) text.innerHTML = `<span style="color:#4ade80;"><i class="fa-solid fa-circle-check"></i> Connected! (${data.total_classrooms || 0} rooms, ${data.active_cameras || 0} cameras)</span>`;
      return;
    }
  } catch(e) { }

  if (text) text.innerHTML = '<span style="color:var(--text-secondary);"><i class="fa-solid fa-circle-xmark"></i> Server not responding. Running in Standalone Browser Vision Mode.</span>';
}

function saveBackendConfig() {
  const input = document.getElementById('backend-url-input');
  if (!input) return;
  API_BASE = input.value.trim().replace(/\/$/, '');
  localStorage.setItem('visiongrid_backend_url', API_BASE);
  closeBackendConfigModal();
  checkBackendHealth();
  if (backendWs) {
    backendWs.close();
  }
  initBackendWebSocket();
  fetchLiveCameras();
  pushActivityLog(`Backend API endpoint updated to: ${API_BASE}`);
}

