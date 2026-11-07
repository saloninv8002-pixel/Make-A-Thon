/**
 * TRACE - System Settings Controller (settings.js)
 * Manages mode switching (DEMO vs LIVE), configurable Flask backend URL,
 * Socket.IO connection testing, audio synthesizer volume & tests,
 * and theme toggle.
 */

window.TRACE_SETTINGS = (function () {
  function updateUIFromState() {
    if (!window.TRACE || !window.TRACE_API) return;
    const apiConfig = window.TRACE_API.getConfig();

    const modeSelect = document.getElementById('settingModeSelect');
    const backendUrlInput = document.getElementById('settingBackendUrl');
    const liveIndicator = document.getElementById('settingConnectionStatus');
    const pingIndicator = document.getElementById('settingPingValue');

    if (modeSelect) modeSelect.value = apiConfig.mode;
    if (backendUrlInput) backendUrlInput.value = apiConfig.baseUrl;

    if (liveIndicator) {
      if (apiConfig.mode === 'live') {
        if (apiConfig.isConnected) {
          liveIndicator.className = 'status-indicator-pill';
          liveIndicator.innerHTML = '<span class="status-dot"></span> CONNECTED (SOCKET.IO LIVE)';
        } else {
          liveIndicator.className = 'status-indicator-pill danger';
          liveIndicator.innerHTML = '<span class="status-dot"></span> DISCONNECTED (WAITING FOR BACKEND)';
        }
      } else {
        liveIndicator.className = 'status-indicator-pill demo';
        liveIndicator.innerHTML = '<span class="status-dot"></span> DEMO MODE (STANDALONE OFFLINE)';
      }
    }

    if (pingIndicator) {
      pingIndicator.textContent = apiConfig.isConnected ? '14 ms' : 'N/A';
    }
  }

  function handleModeChange(newMode) {
    window.TRACE_API.setMode(newMode);
    updateUIFromState();
    if (newMode === 'live') {
      window.TRACE.showToast('Live Mode Engaged', 'Attempting Socket.IO handshake with Flask backend...', 'info');
    } else {
      window.TRACE.showToast('Demo Mode Engaged', 'Operating in standalone demo sandbox.', 'info');
    }
  }

  function handleSaveUrl() {
    const input = document.getElementById('settingBackendUrl');
    if (!input) return;
    const newUrl = input.value.trim();
    if (!newUrl) {
      window.TRACE.showToast('Error', 'Please enter a valid backend URL.', 'warning');
      return;
    }
    window.TRACE_API.setBaseUrl(newUrl);
    window.TRACE.showToast('Backend URL Saved', `Configured target endpoint: ${newUrl}`, 'success');
    updateUIFromState();
  }

  async function handleTestConnection() {
    const input = document.getElementById('settingBackendUrl');
    const url = input ? input.value.trim() : 'http://localhost:5000';
    const testResultEl = document.getElementById('connectionTestResult');

    if (testResultEl) {
      testResultEl.style.display = 'block';
      testResultEl.className = 'badge badge-info';
      testResultEl.textContent = 'Pinging /api/device/status...';
    }

    const res = await window.TRACE_API.testConnection(url);

    if (testResultEl) {
      if (res.success) {
        testResultEl.className = 'badge badge-success';
        testResultEl.textContent = `Online! Latency: ${res.latency}ms (Device: ${res.data?.device_id || 'ESP32'})`;
        window.TRACE.showToast('Backend Reachable', `Connected in ${res.latency}ms. Device ready.`, 'success');
      } else {
        testResultEl.className = 'badge badge-critical';
        testResultEl.textContent = `Unreachable: ${res.message}. Ensure Flask backend is running.`;
        window.TRACE.showToast('Connection Failed', `Backend unreachable at ${url}. Operating in Demo mode.`, 'critical');
      }
    }
  }

  function init() {
    // Mode Switcher Select
    const modeSelect = document.getElementById('settingModeSelect');
    if (modeSelect) {
      modeSelect.addEventListener('change', (e) => {
        handleModeChange(e.target.value);
      });
    }

    // Backend URL Save Button
    const btnSaveUrl = document.getElementById('btnSaveBackendUrl');
    if (btnSaveUrl) {
      btnSaveUrl.addEventListener('click', handleSaveUrl);
    }

    // Test Connection Button
    const btnTestConn = document.getElementById('btnTestConnection');
    if (btnTestConn) {
      btnTestConn.addEventListener('click', handleTestConnection);
    }

    // Theme Toggle Switch
    const themeToggle = document.getElementById('settingThemeToggle');
    if (themeToggle) {
      const savedTheme = localStorage.getItem('trace_theme') || 'dark';
      document.documentElement.setAttribute('data-theme', savedTheme);
      themeToggle.checked = (savedTheme === 'light');

      themeToggle.addEventListener('change', () => {
        const theme = themeToggle.checked ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('trace_theme', theme);
        window.TRACE.showToast('Theme Changed', `Switched to ${theme.toUpperCase()} contrast mode.`, 'info');
      });
    }

    // Sound Alert Toggle
    const soundToggle = document.getElementById('settingSoundToggle');
    if (soundToggle) {
      soundToggle.checked = true;
      soundToggle.addEventListener('change', () => {
        window.TRACE.setSoundEnabled(soundToggle.checked);
        const topbarBtn = document.getElementById('audioToggleBtn');
        if (topbarBtn) topbarBtn.classList.toggle('active', soundToggle.checked);
      });
    }

    // Sound Volume Slider
    const volumeSlider = document.getElementById('settingVolumeSlider');
    if (volumeSlider) {
      volumeSlider.addEventListener('input', (e) => {
        const vol = parseFloat(e.target.value) / 100;
        window.TRACE.setMasterVolume(vol);
      });
    }

    // Audio Test Buttons
    const btnTestChime = document.getElementById('btnTestChime');
    if (btnTestChime) {
      btnTestChime.addEventListener('click', () => {
        window.TRACE.playUnlockChime();
      });
    }

    const btnTestSiren = document.getElementById('btnTestSiren');
    if (btnTestSiren) {
      let testSirenActive = false;
      btnTestSiren.addEventListener('click', () => {
        if (!testSirenActive) {
          testSirenActive = true;
          btnTestSiren.textContent = 'Stop Siren';
          btnTestSiren.className = 'btn btn-danger btn-sm';
          window.TRACE.startAlarmSiren();
        } else {
          testSirenActive = false;
          btnTestSiren.textContent = 'Test Siren';
          btnTestSiren.className = 'btn btn-outline btn-sm';
          window.TRACE.stopAlarmSiren();
        }
      });
    }

    // Reset Data Button
    const btnResetAll = document.getElementById('btnResetAllDemoData');
    if (btnResetAll) {
      btnResetAll.addEventListener('click', () => {
        if (confirm('Are you sure you want to restore default demo baseline data?')) {
          window.TRACE.resetToNormalSecure();
        }
      });
    }

    // API Connection callback
    if (window.TRACE_API) {
      window.TRACE_API.onConnectionChange(() => {
        updateUIFromState();
      });
    }

    updateUIFromState();
  }

  return {
    init,
    refresh: updateUIFromState
  };
})();

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.TRACE_SETTINGS.init();
});
