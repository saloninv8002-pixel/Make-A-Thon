/**
 * TRACE - Main Application Engine & Master State Manager (app.js)
 * Coordinates all views, manages reactive state, audio synthesis,
 * live clocks, and cross-view notifications.
 */

window.TRACE = (function () {
  // Web Audio Context for zero-dependency realistic audio effects
  let audioCtx = null;
  let alarmOscillator = null;
  let alarmGainNode = null;
  let isAlarmSounding = false;

  // Sound settings
  let soundEnabled = true;
  let masterVolume = 0.5;

  // Central State of TRACE Platform
  const state = {
    mode: 'demo', // 'demo' or 'live'
    backendConnected: false,
    
    // Core Digital Twin State
    doorState: 'closed',       // 'closed' | 'open'
    lockState: 'locked',       // 'locked' | 'unlocked'
    securityStatus: 'secure',   // 'secure' | 'warning' | 'critical'
    activeAlarm: false,
    alarmReason: '',
    
    // Hardware Sensors & Peripherals State
    sensors: {
      reedSwitch: 'contact',     // 'contact' | 'open'
      servoLock: 'extended',     // 'extended' | 'retracted'
      rfidReader: 'active',      // 'active' | 'reading' | 'inactive'
      keypad: 'active',          // 'active' | 'locked_out' | 'inactive'
      esp32Status: 'online',     // 'online' | 'degraded' | 'offline'
      lastHeartbeat: new Date(),
      angleDegrees: 0,
      servoAngle: 0,             // 0 deg = locked, 90 deg = unlocked
      rssiDbm: -56,
      voltage: 5.02,
      firmware: 'v1.4.2-trace'
    },

    // Metrics for Today
    metrics: {
      totalAttempts: 42,
      successfulAttempts: 38,
      failedAttempts: 4,
      rfidAttempts: 29,
      keypadAttempts: 13,
      activeAlertsCount: 0
    },

    // Timestamps
    lastStateChange: new Date(Date.now() - 14 * 60000),
    lastSensorUpdate: new Date(),

    // System Safety Rules Status
    rules: {
      rule1_forced_entry: {
        id: 1,
        title: 'Door Opened While Locked',
        desc: 'Detects physical door ajar without authorized lock release',
        status: 'normal', // 'normal' | 'triggered'
        lastChecked: new Date()
      },
      rule2_wrong_pin: {
        id: 2,
        title: 'Three Wrong PIN Attempts',
        desc: 'Brute-force protection: triggers immediate lockout and alarm',
        status: 'normal',
        failedCount: 0,
        lastChecked: new Date()
      },
      rule3_door_held_open: {
        id: 3,
        title: 'Door Open Beyond 2 Minutes',
        desc: 'Flags door left ajar for prolonged unauthorized duration',
        status: 'normal',
        openTimer: null,
        lastChecked: new Date()
      },
      rule4_sensor_failure: {
        id: 4,
        title: 'Sensor Heartbeat Loss',
        desc: 'Flags telemetry dropouts or communication line faults',
        status: 'normal',
        lastChecked: new Date()
      }
    },

    // In-Memory Events Log
    events: [
      {
        id: 'EVT-9042',
        timestamp: new Date(Date.now() - 4 * 60000),
        type: 'Access Granted',
        method: 'RFID',
        user: 'Alex Chen (Admin)',
        card_id: 'RFID-A94-F2',
        prevState: 'CLOSED + LOCKED',
        curState: 'CLOSED + LOCKED',
        severity: 'normal',
        source: 'hardware',
        description: 'Authorized badge swipe at main entrance.'
      },
      {
        id: 'EVT-9041',
        timestamp: new Date(Date.now() - 18 * 60000),
        type: 'Access Granted',
        method: 'Keypad',
        user: 'Priya Sharma (Staff)',
        card_id: 'PIN-AUTH',
        prevState: 'CLOSED + LOCKED',
        curState: 'CLOSED + LOCKED',
        severity: 'normal',
        source: 'hardware',
        description: 'Valid 4-digit security PIN verified.'
      },
      {
        id: 'EVT-9040',
        timestamp: new Date(Date.now() - 45 * 60000),
        type: 'Access Denied',
        method: 'RFID',
        user: 'Unknown Badge #X99-BAD',
        card_id: 'RFID-X99-BAD',
        prevState: 'CLOSED + LOCKED',
        curState: 'CLOSED + LOCKED',
        severity: 'warning',
        source: 'hardware',
        description: 'Unrecognized RFID credential rejected.'
      },
      {
        id: 'EVT-9039',
        timestamp: new Date(Date.now() - 92 * 60000),
        type: 'Access Granted',
        method: 'RFID',
        user: 'Marcus Vance (Security)',
        card_id: 'RFID-M82-C1',
        prevState: 'CLOSED + LOCKED',
        curState: 'CLOSED + LOCKED',
        severity: 'normal',
        source: 'hardware',
        description: 'Patrol officer badge authorized.'
      },
      {
        id: 'EVT-9038',
        timestamp: new Date(Date.now() - 140 * 60000),
        type: 'Door Auto-Lock',
        method: 'System',
        user: 'ESP32 Controller',
        card_id: 'SYS-TIMER',
        prevState: 'CLOSED + UNLOCKED',
        curState: 'CLOSED + LOCKED',
        severity: 'normal',
        source: 'hardware',
        description: 'Auto-relock timer expired (5s timeout).'
      }
    ],

    // Security Alerts Log
    alerts: [
      {
        id: 'ALT-108',
        title: 'Unrecognized Badge Scan Attempt',
        type: 'Wrong PIN',
        severity: 'warning',
        timestamp: new Date(Date.now() - 45 * 60000),
        description: 'Badge ID #X99-BAD attempted access with invalid authorization rights.',
        status: 'acknowledged', // 'active' | 'acknowledged' | 'resolved'
        source: 'hardware'
      }
    ]
  };

  // State change observer subscribers
  const stateSubscribers = [];

  /**
   * AUDIO ENGINE (Web Audio API)
   */
  function initAudioContext() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        audioCtx = new AudioContext();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  function playTone(frequency, type, durationMs, volume = 0.3) {
    if (!soundEnabled) return;
    try {
      initAudioContext();
      if (!audioCtx) return;

      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = type; // 'sine', 'square', 'sawtooth', 'triangle'
      osc.frequency.setValueAtTime(frequency, audioCtx.currentTime);

      gain.gain.setValueAtTime(volume * masterVolume, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + durationMs / 1000);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + durationMs / 1000);
    } catch (e) {
      console.warn('Audio tone error:', e);
    }
  }

  function playKeypadTone(frequency = 600) {
    playTone(frequency, 'sine', 90, 0.25);
  }

  function playRfidChirp() {
    if (!soundEnabled) return;
    try {
      initAudioContext();
      if (!audioCtx) return;
      playTone(880, 'sine', 80, 0.3);
      setTimeout(() => playTone(1760, 'sine', 110, 0.35), 90);
    } catch (e) {}
  }

  function playUnlockChime() {
    if (!soundEnabled) return;
    try {
      initAudioContext();
      if (!audioCtx) return;
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        setTimeout(() => playTone(freq, 'triangle', 180, 0.3), idx * 75);
      });
    } catch (e) {}
  }

  function playLockSound() {
    if (!soundEnabled) return;
    playTone(220, 'sawtooth', 120, 0.2);
    setTimeout(() => playTone(165, 'sine', 160, 0.3), 110);
  }

  function playWarningBeep() {
    if (!soundEnabled) return;
    playTone(440, 'square', 140, 0.3);
    setTimeout(() => playTone(440, 'square', 140, 0.3), 200);
  }

  function startAlarmSiren() {
    if (!soundEnabled || isAlarmSounding) return;
    try {
      initAudioContext();
      if (!audioCtx) return;

      isAlarmSounding = true;
      alarmOscillator = audioCtx.createOscillator();
      alarmGainNode = audioCtx.createGain();

      alarmOscillator.type = 'sawtooth';
      alarmGainNode.gain.setValueAtTime(0.35 * masterVolume, audioCtx.currentTime);

      // Pitch modulation sweep (800Hz to 1300Hz wail)
      const now = audioCtx.currentTime;
      alarmOscillator.frequency.setValueAtTime(800, now);
      
      const modulate = () => {
        if (!isAlarmSounding || !alarmOscillator) return;
        const cur = audioCtx.currentTime;
        alarmOscillator.frequency.linearRampToValueAtTime(1300, cur + 0.4);
        alarmOscillator.frequency.linearRampToValueAtTime(800, cur + 0.8);
        setTimeout(modulate, 800);
      };
      modulate();

      alarmOscillator.connect(alarmGainNode);
      alarmGainNode.connect(audioCtx.destination);
      alarmOscillator.start();
    } catch (e) {
      console.warn('Alarm siren error:', e);
    }
  }

  function stopAlarmSiren() {
    if (isAlarmSounding && alarmOscillator) {
      try {
        alarmOscillator.stop();
        alarmOscillator.disconnect();
      } catch (e) {}
      alarmOscillator = null;
      alarmGainNode = null;
      isAlarmSounding = false;
    }
  }

  /**
   * TOAST NOTIFICATION SYSTEM
   */
  function showToast(title, description, type = 'info', duration = 4000) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let iconSvg = '';
    if (type === 'critical') {
      iconSvg = `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="#EF4444" stroke-width="2.2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
    } else if (type === 'warning') {
      iconSvg = `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
    } else if (type === 'success') {
      iconSvg = `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2.2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`;
    } else {
      iconSvg = `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="#38BDF8" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
    }

    toast.innerHTML = `
      ${iconSvg}
      <div class="toast-content">
        <div class="toast-title">${title}</div>
        <div class="toast-desc">${description}</div>
      </div>
      <button class="toast-close" aria-label="Close">&times;</button>
    `;

    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(40px)';
      setTimeout(() => toast.remove(), 250);
    });

    container.appendChild(toast);

    setTimeout(() => {
      if (toast.parentElement) {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(40px)';
        setTimeout(() => toast.remove(), 250);
      }
    }, duration);
  }

  /**
   * NAVIGATION & VIEW SWITCHING
   */
  const pageTitles = {
    'dashboard': { title: 'Security Dashboard', subtitle: 'Live telemetry overview & digital twin status' },
    'digital-twin': { title: 'Digital Twin Model', subtitle: 'High-fidelity 3D physical-virtual sensor mirror' },
    'access-control': { title: 'Access Control', subtitle: 'RFID badge & 4x4 matrix keypad validation' },
    'alerts': { title: 'Alerts & Incidents', subtitle: 'Real-time security threat management' },
    'simulator': { title: 'Scenario Simulator', subtitle: 'Make-A-Thon physical security attack demonstrations' },
    'event-history': { title: 'Audit Event History', subtitle: 'Comprehensive chronological access & security log' },
    'settings': { title: 'System Settings', subtitle: 'Hardware configurations & backend integration' }
  };

  function switchView(targetViewId) {
    // Hide all view sections
    const views = document.querySelectorAll('.view-section');
    views.forEach(v => v.classList.remove('active'));

    // Show target section
    const targetSection = document.getElementById(`view-${targetViewId}`);
    if (targetSection) {
      targetSection.classList.add('active');
    }

    // Update sidebar navigation pills
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
      if (item.getAttribute('data-view') === targetViewId) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Update Topbar page title & breadcrumbs
    const titleEl = document.getElementById('topbarPageTitle');
    const breadcrumbEl = document.getElementById('topbarBreadcrumb');
    if (titleEl && pageTitles[targetViewId]) {
      titleEl.textContent = pageTitles[targetViewId].title;
    }
    if (breadcrumbEl && pageTitles[targetViewId]) {
      breadcrumbEl.textContent = `TRACE / ${pageTitles[targetViewId].title}`;
    }

    // Close mobile sidebar if open
    closeMobileSidebar();

    // Trigger view-specific re-renders
    if (targetViewId === 'dashboard' && window.TRACE_DASHBOARD) {
      window.TRACE_DASHBOARD.refresh();
    } else if (targetViewId === 'digital-twin' && window.TRACE_TWIN) {
      window.TRACE_TWIN.refresh();
    } else if (targetViewId === 'access-control' && window.TRACE_ACCESS) {
      window.TRACE_ACCESS.refresh();
    } else if (targetViewId === 'alerts' && window.TRACE_ALERTS) {
      window.TRACE_ALERTS.refresh();
    } else if (targetViewId === 'event-history' && window.TRACE_HISTORY) {
      window.TRACE_HISTORY.refresh();
    }
  }

  function toggleMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    if (sidebar && backdrop) {
      sidebar.classList.toggle('mobile-open');
      backdrop.classList.toggle('active');
    }
  }

  function closeMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    if (sidebar) sidebar.classList.remove('mobile-open');
    if (backdrop) backdrop.classList.remove('active');
  }

  /**
   * LIVE CLOCK UPDATER
   */
  function startLiveClock() {
    function update() {
      const now = new Date();
      const timeEl = document.getElementById('clockTime');
      const dateEl = document.getElementById('clockDate');
      if (timeEl) {
        timeEl.textContent = now.toLocaleTimeString('en-US', { hour12: false });
      }
      if (dateEl) {
        dateEl.textContent = now.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric'
        });
      }
    }
    update();
    setInterval(update, 1000);
  }

  /**
   * REACTIVE STATE MANAGEMENT & DISPATCH
   */
  function subscribe(fn) {
    stateSubscribers.push(fn);
  }

  function notifySubscribers(changedField, source = 'system') {
    stateSubscribers.forEach(fn => {
      try { fn(state, changedField, source); } catch (e) { console.error('Subscriber error:', e); }
    });
    updateBadges();
  }

  function updateBadges() {
    const activeCount = state.alerts.filter(a => a.status === 'active').length;
    state.metrics.activeAlertsCount = activeCount;

    const navBadge = document.getElementById('alertsNavBadge');
    const bellBadge = document.getElementById('topbarBellBadge');

    if (navBadge) {
      if (activeCount > 0) {
        navBadge.textContent = activeCount;
        navBadge.classList.add('show');
      } else {
        navBadge.classList.remove('show');
      }
    }

    if (bellBadge) {
      if (activeCount > 0) {
        bellBadge.textContent = activeCount;
        bellBadge.classList.add('show');
      } else {
        bellBadge.classList.remove('show');
      }
    }
  }

  /**
   * STATE MUTATION API
   */
  function updateDoorState(newDoorState, source = 'system') {
    state.doorState = newDoorState;
    state.sensors.reedSwitch = (newDoorState === 'open') ? 'open' : 'contact';
    state.sensors.angleDegrees = (newDoorState === 'open') ? 72 : 0;
    state.lastStateChange = new Date();
    state.lastSensorUpdate = new Date();

    // Check System Rule 1: Door opened while locked!
    if (state.doorState === 'open' && state.lockState === 'locked') {
      triggerAlert({
        title: 'FORCED ENTRY DETECTED',
        type: 'Forced Entry',
        severity: 'critical',
        description: 'Physical reed sensor indicates door OPEN while servo deadlock is ENGAGED. Mismatch engine triggered!',
        source: source
      });
      state.rules.rule1_forced_entry.status = 'triggered';
      state.securityStatus = 'critical';
      state.activeAlarm = true;
      state.alarmReason = 'Forced Entry: Sensor Mismatch';
      startAlarmSiren();
    } else {
      if (newDoorState === 'closed' && state.lockState === 'locked' && !state.activeAlarm) {
        state.securityStatus = 'secure';
      }
    }

    notifySubscribers('doorState', source);
  }

  function updateLockState(newLockState, source = 'system') {
    state.lockState = newLockState;
    state.sensors.servoLock = (newLockState === 'locked') ? 'extended' : 'retracted';
    state.sensors.servoAngle = (newLockState === 'locked') ? 0 : 90;
    state.lastStateChange = new Date();
    state.lastSensorUpdate = new Date();

    if (newLockState === 'unlocked') {
      playUnlockChime();
    } else {
      playLockSound();
    }

    // Check if locked while open -> warning or critical
    if (state.lockState === 'locked' && state.doorState === 'open') {
      state.rules.rule1_forced_entry.status = 'triggered';
    } else if (state.lockState === 'locked' && state.doorState === 'closed' && !state.activeAlarm) {
      state.securityStatus = 'secure';
      state.rules.rule1_forced_entry.status = 'normal';
    }

    notifySubscribers('lockState', source);
  }

  function recordAccessEvent(eventData) {
    const isGranted = (eventData.result === 'granted');
    const newId = `EVT-${Math.floor(1000 + Math.random() * 9000)}`;
    const eventObj = {
      id: newId,
      timestamp: new Date(),
      type: isGranted ? 'Access Granted' : 'Access Denied',
      method: eventData.method || 'RFID',
      user: eventData.user || 'User',
      card_id: eventData.card_id || (eventData.method === 'RFID' ? 'RFID-TEMP' : 'PIN-TEMP'),
      prevState: `${state.doorState.toUpperCase()} + ${state.lockState.toUpperCase()}`,
      curState: isGranted ? 'CLOSED + UNLOCKED' : `${state.doorState.toUpperCase()} + ${state.lockState.toUpperCase()}`,
      severity: isGranted ? 'normal' : 'warning',
      source: eventData.source || 'simulated',
      description: eventData.description || (isGranted ? 'Authorized entry' : 'Unauthorized entry attempt')
    };

    // Update metrics
    state.metrics.totalAttempts++;
    if (isGranted) {
      state.metrics.successfulAttempts++;
      playUnlockChime();
      updateLockState('unlocked', eventData.source || 'simulated');
      
      // Auto-relock after 5 seconds in demo
      setTimeout(() => {
        if (state.doorState === 'closed' && state.lockState === 'unlocked' && !state.activeAlarm) {
          updateLockState('locked', 'auto-timer');
        }
      }, 5000);
    } else {
      state.metrics.failedAttempts++;
      playWarningBeep();
    }

    if (eventData.method === 'RFID') state.metrics.rfidAttempts++;
    if (eventData.method === 'Keypad') state.metrics.keypadAttempts++;

    state.events.unshift(eventObj);
    notifySubscribers('events', eventData.source);
  }

  function triggerAlert(alertData) {
    const alertId = `ALT-${Math.floor(100 + Math.random() * 900)}`;
    const newAlert = {
      id: alertId,
      title: alertData.title || 'Security Alert',
      type: alertData.type || 'Forced Entry',
      severity: alertData.severity || 'warning',
      timestamp: new Date(),
      description: alertData.description || 'Security mismatch or threshold violation.',
      status: 'active',
      source: alertData.source || 'simulated'
    };

    state.alerts.unshift(newAlert);
    state.metrics.activeAlertsCount = state.alerts.filter(a => a.status === 'active').length;

    if (newAlert.severity === 'critical') {
      state.securityStatus = 'critical';
      state.activeAlarm = true;
      state.alarmReason = newAlert.title;
      startAlarmSiren();
    } else if (state.securityStatus !== 'critical') {
      state.securityStatus = 'warning';
      playWarningBeep();
    }

    showToast(newAlert.title, newAlert.description, newAlert.severity);

    // Also record event in audit trail
    state.events.unshift({
      id: `EVT-${Math.floor(1000 + Math.random() * 9000)}`,
      timestamp: new Date(),
      type: `SECURITY ALERT: ${newAlert.title}`,
      method: 'Alarm System',
      user: 'TRACE Security Engine',
      card_id: 'RULE-ENGINE',
      prevState: `${state.doorState.toUpperCase()} + ${state.lockState.toUpperCase()}`,
      curState: 'ALARM ACTIVE',
      severity: newAlert.severity,
      source: alertData.source || 'simulated',
      description: newAlert.description
    });

    notifySubscribers('alerts', alertData.source);
  }

  function acknowledgeAlert(alertId) {
    const alert = state.alerts.find(a => a.id === alertId);
    if (alert && alert.status === 'active') {
      alert.status = 'acknowledged';
      stopAlarmSiren();
      showToast('Alert Acknowledged', `Alert [${alertId}] marked as acknowledged by operator.`, 'info');
      notifySubscribers('alerts');
    }
  }

  function resolveAlert(alertId) {
    const alert = state.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.status = 'resolved';
      stopAlarmSiren();
      
      const activeRemaining = state.alerts.filter(a => a.status === 'active').length;
      if (activeRemaining === 0) {
        state.activeAlarm = false;
        state.alarmReason = '';
        if (state.doorState === 'closed' && state.lockState === 'locked') {
          state.securityStatus = 'secure';
        } else {
          state.securityStatus = 'warning';
        }
      }

      showToast('Alert Resolved', `Alert [${alertId}] cleared. Security status updated.`, 'success');
      notifySubscribers('alerts');
    }
  }

  function resetToNormalSecure() {
    stopAlarmSiren();
    state.doorState = 'closed';
    state.lockState = 'locked';
    state.securityStatus = 'secure';
    state.activeAlarm = false;
    state.alarmReason = '';
    state.sensors.reedSwitch = 'contact';
    state.sensors.servoLock = 'extended';
    state.sensors.servoAngle = 0;
    state.sensors.angleDegrees = 0;
    state.sensors.esp32Status = 'online';
    state.sensors.rfidReader = 'active';
    state.sensors.keypad = 'active';
    state.lastStateChange = new Date();
    state.lastSensorUpdate = new Date();

    // Reset all rules
    Object.keys(state.rules).forEach(k => {
      state.rules[k].status = 'normal';
      if (state.rules[k].failedCount !== undefined) state.rules[k].failedCount = 0;
    });

    // Mark active alerts as resolved
    state.alerts.forEach(a => {
      if (a.status === 'active' || a.status === 'acknowledged') {
        a.status = 'resolved';
      }
    });

    // Record reset event
    state.events.unshift({
      id: `EVT-${Math.floor(1000 + Math.random() * 9000)}`,
      timestamp: new Date(),
      type: 'System Restored / Reset',
      method: 'Admin Operator',
      user: 'Security Console',
      card_id: 'SYSTEM-RESET',
      prevState: 'ALARM / FAULT',
      curState: 'CLOSED + LOCKED',
      severity: 'normal',
      source: 'simulated',
      description: 'Physical & digital twin state reset to normal baseline: CLOSED + LOCKED.'
    });

    showToast('Simulation Reset', 'System returned to normal secure baseline (CLOSED + LOCKED).', 'success');
    notifySubscribers('reset');
  }

  function updateSensorTelemetry(telemetryData, source = 'hardware') {
    if (!telemetryData) return;
    if (telemetryData.voltage !== undefined) state.sensors.voltage = telemetryData.voltage;
    if (telemetryData.rssi !== undefined) state.sensors.rssiDbm = telemetryData.rssi;
    state.sensors.lastHeartbeat = new Date();
    state.lastSensorUpdate = new Date();
    notifySubscribers('sensors', source);
  }

  function updateDeviceHealth(healthData) {
    if (healthData.status) state.sensors.esp32Status = healthData.status;
    state.sensors.lastHeartbeat = new Date();
    notifySubscribers('device_status');
  }

  /**
   * INITIALIZE MASTER APP ON DOM READY
   */
  function init() {
    startLiveClock();
    updateBadges();

    // Setup Sidebar Nav Links
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const viewId = item.getAttribute('data-view');
        if (viewId) switchView(viewId);
      });
    });

    // Mobile Hamburger & Backdrop
    const mobileBtn = document.getElementById('mobileMenuBtn');
    if (mobileBtn) {
      mobileBtn.addEventListener('click', toggleMobileSidebar);
    }
    const backdrop = document.getElementById('sidebarBackdrop');
    if (backdrop) {
      backdrop.addEventListener('click', closeMobileSidebar);
    }

    // Audio Mute Toggle Button
    const audioBtn = document.getElementById('audioToggleBtn');
    if (audioBtn) {
      audioBtn.addEventListener('click', () => {
        soundEnabled = !soundEnabled;
        audioBtn.classList.toggle('active', soundEnabled);
        if (!soundEnabled) {
          stopAlarmSiren();
          showToast('Sound Muted', 'Audio synthesized alerts are disabled.', 'info');
        } else {
          initAudioContext();
          playTone(660, 'sine', 100, 0.2);
          showToast('Sound Enabled', 'Tactile beeps and alarm siren enabled.', 'info');
        }
      });
      if (soundEnabled) audioBtn.classList.add('active');
    }

    // Topbar Notification Bell Click -> Jumps to alerts view
    const bellBtn = document.getElementById('topbarBellBtn');
    if (bellBtn) {
      bellBtn.addEventListener('click', () => switchView('alerts'));
    }

    // Topbar Connection Mode Pill Click -> Jumps to Settings view
    const modePill = document.getElementById('topbarModePill');
    if (modePill) {
      modePill.addEventListener('click', () => switchView('settings'));
    }

    // Register API connection listener
    if (window.TRACE_API) {
      window.TRACE_API.onConnectionChange((connected, statusText, mode) => {
        state.backendConnected = connected;
        state.mode = mode;
        const pill = document.getElementById('topbarModePill');
        const pillText = document.getElementById('modePillText');
        const sidebarPill = document.getElementById('sidebarStatusPill');

        if (mode === 'live') {
          if (connected) {
            if (pill) {
              pill.className = 'mode-pill live-connected';
              if (pillText) pillText.textContent = 'LIVE HARDWARE CONNECTED';
            }
            if (sidebarPill) {
              sidebarPill.className = 'status-indicator-pill';
              sidebarPill.innerHTML = '<span class="status-dot"></span> LIVE ONLINE';
            }
          } else {
            if (pill) {
              pill.className = 'mode-pill live-disconnected';
              if (pillText) pillText.textContent = 'LIVE BACKEND OFFLINE';
            }
            if (sidebarPill) {
              sidebarPill.className = 'status-indicator-pill danger';
              sidebarPill.innerHTML = '<span class="status-dot"></span> OFFLINE';
            }
          }
        } else {
          if (pill) {
            pill.className = 'mode-pill';
            if (pillText) pillText.textContent = 'DEMO MODE (STANDALONE)';
          }
          if (sidebarPill) {
            sidebarPill.className = 'status-indicator-pill demo';
            sidebarPill.innerHTML = '<span class="status-dot"></span> DEMO MODE';
          }
        }
      });

      // Start connection watcher
      window.TRACE_API.init();
    }

    console.log('[TRACE APP] Initialized successfully in ' + state.mode.toUpperCase() + ' mode.');
  }

  // Public Interface
  return {
    init,
    getState: () => ({ ...state }),
    subscribe,
    switchView,
    updateDoorState,
    updateLockState,
    recordAccessEvent,
    triggerAlert,
    acknowledgeAlert,
    resolveAlert,
    resetToNormalSecure,
    updateSensorTelemetry,
    updateDeviceHealth,
    showToast,
    // Audio API
    playKeypadTone,
    playRfidChirp,
    playUnlockChime,
    playLockSound,
    playWarningBeep,
    startAlarmSiren,
    stopAlarmSiren,
    setSoundEnabled: (en) => { soundEnabled = en; },
    setMasterVolume: (vol) => { masterVolume = vol; }
  };
})();

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.TRACE.init();
});
