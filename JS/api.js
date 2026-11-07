/**
 * TRACE - Backend Integration & Communication Layer (api.js)
 * Handles Socket.IO real-time telemetry and REST API interactions
 * with automatic fallback to standalone DEMO MODE.
 */

const TRACE_API = (function () {
  // Configurable backend configuration
  const config = {
    baseUrl: localStorage.getItem('trace_backend_url') || 'http://localhost:5000',
    socketUrl: localStorage.getItem('trace_backend_url') || 'http://localhost:5000',
    mode: localStorage.getItem('trace_mode') || 'demo', // 'demo' or 'live'
    reconnectInterval: 5000,
    requestTimeout: 4000
  };

  let socket = null;
  let isConnected = false;
  let connectionChangeCallbacks = [];
  let eventListeners = {};

  /**
   * Initialize Socket.IO connection if in LIVE mode
   */
  function initSocket() {
    if (config.mode !== 'live') {
      console.log('[TRACE API] Operating in DEMO MODE. Socket.IO connection idle.');
      updateConnectionStatus(false, 'Demo Mode Active (Offline)');
      return;
    }

    if (typeof io === 'undefined') {
      console.warn('[TRACE API] Socket.IO client library not loaded. Falling back to Demo Mode.');
      updateConnectionStatus(false, 'Socket.IO Library Unavailable');
      return;
    }

    try {
      console.log(`[TRACE API] Connecting to backend at ${config.socketUrl}...`);
      socket = io(config.socketUrl, {
        reconnection: true,
        reconnectionDelay: 2000,
        timeout: config.requestTimeout,
        transports: ['websocket', 'polling']
      });

      socket.on('connect', () => {
        console.log('[TRACE API] Real-time Socket.IO connected successfully!');
        isConnected = true;
        updateConnectionStatus(true, 'Connected to Flask Backend');
        emitNotification('Backend Connected', 'Live telemetry stream active from hardware.', 'success');
      });

      socket.on('disconnect', (reason) => {
        console.warn('[TRACE API] Socket.IO disconnected:', reason);
        isConnected = false;
        updateConnectionStatus(false, 'Disconnected from Flask Backend');
      });

      socket.on('connect_error', (error) => {
        console.warn('[TRACE API] Socket.IO connection failed:', error.message);
        isConnected = false;
        updateConnectionStatus(false, 'Backend Unreachable (Check Port 5000)');
      });

      // Register standard hardware telemetry event listeners
      registerSocketHandler('door_update', handleDoorUpdate);
      registerSocketHandler('lock_update', handleLockUpdate);
      registerSocketHandler('access_event', handleAccessEvent);
      registerSocketHandler('security_alert', handleSecurityAlert);
      registerSocketHandler('sensor_update', handleSensorUpdate);
      registerSocketHandler('device_status', handleDeviceStatus);

    } catch (err) {
      console.error('[TRACE API] Failed to initialize Socket.IO:', err);
      updateConnectionStatus(false, 'Socket Init Error');
    }
  }

  function registerSocketHandler(eventName, handler) {
    if (!socket) return;
    socket.off(eventName);
    socket.on(eventName, (data) => {
      console.log(`[TRACE API] Inbound socket event [${eventName}]:`, data);
      handler(data);
      triggerCallbacks(eventName, data);
    });
  }

  // Telemetry event handlers
  function handleDoorUpdate(data) {
    if (window.TRACE) {
      window.TRACE.updateDoorState(data.door_state || data.state, 'hardware');
    }
  }

  function handleLockUpdate(data) {
    if (window.TRACE) {
      window.TRACE.updateLockState(data.lock_state || data.state, 'hardware');
    }
  }

  function handleAccessEvent(data) {
    if (window.TRACE) {
      window.TRACE.recordAccessEvent({
        method: data.method || 'RFID',
        result: data.result || 'granted',
        user: data.user || data.card_id || 'Unknown',
        description: data.description || 'Hardware access attempt',
        source: 'hardware'
      });
    }
  }

  function handleSecurityAlert(data) {
    if (window.TRACE) {
      window.TRACE.triggerAlert({
        title: data.title || 'Hardware Security Alert',
        type: data.type || 'Forced Entry',
        severity: data.severity || 'critical',
        description: data.description || 'Triggered from ESP32 edge sensor',
        source: 'hardware'
      });
    }
  }

  function handleSensorUpdate(data) {
    if (window.TRACE) {
      window.TRACE.updateSensorTelemetry(data, 'hardware');
    }
  }

  function handleDeviceStatus(data) {
    if (window.TRACE) {
      window.TRACE.updateDeviceHealth(data);
    }
  }

  function updateConnectionStatus(connected, statusText) {
    isConnected = connected;
    connectionChangeCallbacks.forEach(cb => {
      try { cb(connected, statusText, config.mode); } catch (e) { console.error(e); }
    });
  }

  function triggerCallbacks(eventName, data) {
    if (eventListeners[eventName]) {
      eventListeners[eventName].forEach(cb => {
        try { cb(data); } catch (e) { console.error(e); }
      });
    }
  }

  function emitNotification(title, desc, type) {
    if (window.TRACE && window.TRACE.showToast) {
      window.TRACE.showToast(title, desc, type);
    }
  }

  /**
   * Generic REST Fetch wrapper with timeout & error handling
   */
  async function apiFetch(endpoint, options = {}) {
    if (config.mode === 'demo') {
      return { ok: false, demo: true, message: 'Running in standalone demo mode' };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.requestTimeout);

    try {
      const response = await fetch(`${config.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {})
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (err) {
      clearTimeout(timeoutId);
      console.warn(`[TRACE API] API Request to ${endpoint} failed:`, err.message);
      return { ok: false, error: err.message };
    }
  }

  return {
    // Mode & Connection Config
    getConfig: () => ({ ...config, isConnected }),

    setBaseUrl: function (url) {
      config.baseUrl = url.replace(/\/$/, '');
      config.socketUrl = config.baseUrl;
      localStorage.setItem('trace_backend_url', config.baseUrl);
      if (config.mode === 'live') {
        if (socket) socket.disconnect();
        initSocket();
      }
    },

    setMode: function (newMode) {
      config.mode = newMode;
      localStorage.setItem('trace_mode', newMode);
      if (newMode === 'live') {
        initSocket();
      } else {
        if (socket) {
          socket.disconnect();
          socket = null;
        }
        updateConnectionStatus(false, 'Demo Mode Active (Offline)');
      }
    },

    testConnection: async function (targetUrl) {
      const url = (targetUrl || config.baseUrl).replace(/\/$/, '');
      const startTime = performance.now();
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
        const res = await fetch(`${url}/api/device/status`, { signal: controller.signal });
        clearTimeout(timeout);
        const latency = Math.round(performance.now() - startTime);
        if (res.ok) {
          const json = await res.json();
          return { success: true, latency, data: json };
        }
        return { success: false, latency, message: `Server replied with HTTP ${res.status}` };
      } catch (err) {
        return { success: false, latency: null, message: err.message || 'Connection failed' };
      }
    },

    // Subscriptions
    onConnectionChange: function (callback) {
      connectionChangeCallbacks.push(callback);
      // Immediately notify current status
      callback(isConnected, isConnected ? 'Connected to Flask Backend' : 'Demo Mode Active', config.mode);
    },

    on: function (eventName, callback) {
      if (!eventListeners[eventName]) eventListeners[eventName] = [];
      eventListeners[eventName].push(callback);
    },

    // REST API Endpoint Methods
    fetchDashboard: () => apiFetch('/api/dashboard'),
    fetchEvents: () => apiFetch('/api/events'),
    fetchAlerts: () => apiFetch('/api/alerts'),
    fetchDeviceStatus: () => apiFetch('/api/device/status'),

    acknowledgeAlert: (alertId) => apiFetch(`/api/alerts/${alertId}/acknowledge`, {
      method: 'POST'
    }),

    resolveAlert: (alertId) => apiFetch(`/api/alerts/${alertId}/resolve`, {
      method: 'POST'
    }),

    sendSimulatorEvent: (scenarioType, payload = {}) => {
      if (socket && isConnected) {
        socket.emit('simulator_trigger', { scenario: scenarioType, ...payload });
      }
      return apiFetch('/api/simulator/trigger', {
        method: 'POST',
        body: JSON.stringify({ scenario: scenarioType, ...payload })
      });
    },

    sendRemoteUnlock: (reason = 'Manual Remote Unlock') => {
      if (socket && isConnected) {
        socket.emit('remote_command', { action: 'unlock', reason });
      }
      return apiFetch('/api/door/unlock', {
        method: 'POST',
        body: JSON.stringify({ reason })
      });
    },

    sendRemoteLock: (reason = 'Manual Remote Lock') => {
      if (socket && isConnected) {
        socket.emit('remote_command', { action: 'lock', reason });
      }
      return apiFetch('/api/door/lock', {
        method: 'POST',
        body: JSON.stringify({ reason })
      });
    },

    init: initSocket
  };
})();
