/**
 * TRACE - Access Control View Controller (access-control.js)
 * Manages access KPIs, interactive RFID card reader simulation,
 * interactive 4x4 matrix keypad simulation, and searchable access audit logs.
 */

window.TRACE_ACCESS = (function () {
  let keypadInput = '';
  let hourlyChartInstance = null;

  // Pre-configured RFID Credentials for Demonstration
  const rfidCredentials = {
    'admin': {
      id: 'RFID-A94-F2',
      name: 'Alex Chen',
      role: 'Administrator',
      authorized: true
    },
    'staff': {
      id: 'RFID-B12-E8',
      name: 'Priya Sharma',
      role: 'Hardware Engineer',
      authorized: true
    },
    'security': {
      id: 'RFID-M82-C1',
      name: 'Marcus Vance',
      role: 'Security Patrol',
      authorized: true
    },
    'intruder': {
      id: 'RFID-X99-BAD',
      name: 'Cloned Badge / Rogue ID',
      role: 'Unauthorized',
      authorized: false
    }
  };

  // Valid PIN configurations
  const validPins = ['1379', '4521', '8080'];

  function updateKPIs() {
    if (!window.TRACE) return;
    const state = window.TRACE.getState();

    const elRfidAttempts = document.getElementById('accRfidAttempts');
    const elKeypadAttempts = document.getElementById('accKeypadAttempts');
    const elSuccessAttempts = document.getElementById('accSuccessAttempts');
    const elFailedAttempts = document.getElementById('accFailedAttempts');
    const elSuccessRate = document.getElementById('accSuccessRate');

    if (elRfidAttempts) elRfidAttempts.textContent = state.metrics.rfidAttempts;
    if (elKeypadAttempts) elKeypadAttempts.textContent = state.metrics.keypadAttempts;
    if (elSuccessAttempts) elSuccessAttempts.textContent = state.metrics.successfulAttempts;
    if (elFailedAttempts) elFailedAttempts.textContent = state.metrics.failedAttempts;

    if (elSuccessRate) {
      const rate = Math.round((state.metrics.successfulAttempts / (state.metrics.totalAttempts || 1)) * 100);
      elSuccessRate.textContent = `${rate}%`;
    }
  }

  function renderTable() {
    if (!window.TRACE) return;
    const state = window.TRACE.getState();
    const tableBody = document.getElementById('accessHistoryTableBody');
    if (!tableBody) return;

    const searchTerm = (document.getElementById('accSearchInput')?.value || '').toLowerCase();
    const methodFilter = document.getElementById('accMethodFilter')?.value || 'all';
    const statusFilter = document.getElementById('accStatusFilter')?.value || 'all';

    // Filter access events (only Access Granted / Access Denied)
    const accessEvents = state.events.filter(evt => {
      const isAccessEvt = evt.type.includes('Access Granted') || evt.type.includes('Access Denied');
      if (!isAccessEvt) return false;

      // Method filter
      if (methodFilter !== 'all' && evt.method.toLowerCase() !== methodFilter.toLowerCase()) {
        return false;
      }

      // Status filter
      if (statusFilter === 'granted' && !evt.type.includes('Granted')) return false;
      if (statusFilter === 'denied' && !evt.type.includes('Denied')) return false;

      // Search term
      if (searchTerm) {
        const str = `${evt.id} ${evt.user} ${evt.card_id} ${evt.description}`.toLowerCase();
        if (!str.includes(searchTerm)) return false;
      }

      return true;
    });

    if (accessEvents.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; padding: 24px; color: var(--text-muted);">
            No matching access logs found.
          </td>
        </tr>
      `;
      return;
    }

    tableBody.innerHTML = accessEvents.map(evt => {
      const isGranted = evt.type.includes('Granted');
      const badgeClass = isGranted ? 'badge-success' : 'badge-critical';
      const resultText = isGranted ? 'GRANTED' : 'DENIED';
      const timeStr = new Date(evt.timestamp).toLocaleTimeString();
      const dateStr = new Date(evt.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' });

      return `
        <tr>
          <td style="font-family: var(--font-mono); font-size: 0.78rem; color: var(--text-muted);">
            ${dateStr} ${timeStr}
          </td>
          <td>
            <div style="font-weight: 600; color: var(--text-primary);">${evt.method}</div>
            <div style="font-family: var(--font-mono); font-size: 0.72rem; color: var(--accent-secondary);">${evt.card_id}</div>
          </td>
          <td>
            <div style="font-weight: 500;">${evt.user}</div>
          </td>
          <td>
            <span class="badge ${badgeClass}">${resultText}</span>
          </td>
          <td style="font-size: 0.8rem; color: var(--text-secondary);">
            ${evt.description}
          </td>
        </tr>
      `;
    }).join('');
  }

  function handleRfidTap() {
    const selector = document.getElementById('rfidSelectCard');
    const selectedKey = selector ? selector.value : 'admin';
    const cardData = rfidCredentials[selectedKey];

    if (!cardData) return;

    // Visual pulse in Twin
    const rfidZone = document.getElementById('twinRfidZone');
    if (rfidZone) {
      rfidZone.classList.add('reading');
      setTimeout(() => rfidZone.classList.remove('reading'), 900);
    }

    // Play synthesized RFID chirp
    window.TRACE.playRfidChirp();

    if (cardData.authorized) {
      window.TRACE.recordAccessEvent({
        method: 'RFID',
        result: 'granted',
        user: `${cardData.name} (${cardData.role})`,
        card_id: cardData.id,
        description: `RFID Authorization successful for ${cardData.name}. Unlocking door.`,
        source: 'simulated'
      });
      window.TRACE.showToast('Access Granted', `Welcome, ${cardData.name} (${cardData.role}).`, 'success');
    } else {
      window.TRACE.recordAccessEvent({
        method: 'RFID',
        result: 'denied',
        user: `${cardData.name}`,
        card_id: cardData.id,
        description: `Security breach warning: Unauthorized badge ${cardData.id} rejected.`,
        source: 'simulated'
      });
      window.TRACE.showToast('Access Denied', `Unauthorized RFID Card [${cardData.id}] flagged.`, 'critical');
    }
  }

  function updateKeypadDisplay() {
    const display = document.getElementById('keypadScreen');
    if (!display) return;
    if (keypadInput.length === 0) {
      display.textContent = '----';
    } else {
      display.textContent = '*'.repeat(keypadInput.length);
    }
  }

  function handleKeypadPress(val) {
    if (keypadInput.length >= 6) return;
    keypadInput += val;
    window.TRACE.playKeypadTone(500 + val.charCodeAt(0) * 15);
    updateKeypadDisplay();
  }

  function handleKeypadClear() {
    keypadInput = '';
    window.TRACE.playTone(350, 'sine', 80, 0.2);
    updateKeypadDisplay();
  }

  function handleKeypadSubmit() {
    if (keypadInput.length === 0) return;
    const pin = keypadInput;
    keypadInput = '';
    updateKeypadDisplay();

    const state = window.TRACE.getState();
    const isPinValid = validPins.includes(pin);

    if (isPinValid) {
      // Valid PIN
      state.rules.rule2_wrong_pin.failedCount = 0;
      window.TRACE.recordAccessEvent({
        method: 'Keypad',
        result: 'granted',
        user: 'Authorized PIN User',
        card_id: 'PIN-AUTH',
        description: 'Keypad PIN verified successfully.',
        source: 'simulated'
      });
      window.TRACE.showToast('PIN Verified', 'Access granted. Deadbolt released.', 'success');
    } else {
      // Invalid PIN
      state.rules.rule2_wrong_pin.failedCount = (state.rules.rule2_wrong_pin.failedCount || 0) + 1;
      const count = state.rules.rule2_wrong_pin.failedCount;

      window.TRACE.recordAccessEvent({
        method: 'Keypad',
        result: 'denied',
        user: 'Unknown User',
        card_id: 'PIN-FAILED',
        description: `Invalid PIN entry attempt (${count}/3).`,
        source: 'simulated'
      });

      if (count >= 3) {
        // Trigger Rule 2 Lockout & Security Alert!
        state.rules.rule2_wrong_pin.status = 'triggered';
        state.sensors.keypad = 'locked_out';
        window.TRACE.triggerAlert({
          title: 'BRUTE-FORCE PIN ATTEMPT',
          type: 'Wrong PIN',
          severity: 'critical',
          description: 'Three consecutive incorrect PIN attempts detected. Keypad locked out for 60 seconds.',
          source: 'simulated'
        });

        // Auto unlock keypad lockout after 60s
        setTimeout(() => {
          state.sensors.keypad = 'active';
          state.rules.rule2_wrong_pin.failedCount = 0;
          if (state.rules.rule2_wrong_pin.status === 'triggered') {
            state.rules.rule2_wrong_pin.status = 'normal';
          }
        }, 60000);
      } else {
        window.TRACE.showToast('Invalid PIN', `Incorrect code entered (${count}/3 attempts).`, 'warning');
      }
    }
  }

  function initChart() {
    const canvas = document.getElementById('accessHourlyChart');
    if (!canvas || typeof Chart === 'undefined') return;

    const ctx = canvas.getContext('2d');
    hourlyChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'],
        datasets: [
          {
            label: 'Granted',
            data: [4, 6, 8, 5, 7, 3, 6, 9, 4, 3],
            backgroundColor: 'rgba(20, 184, 166, 0.75)',
            borderColor: '#14B8A6',
            borderRadius: 4
          },
          {
            label: 'Denied',
            data: [0, 1, 0, 1, 0, 2, 0, 1, 0, 0],
            backgroundColor: 'rgba(239, 68, 68, 0.75)',
            borderColor: '#EF4444',
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            stacked: true,
            grid: { color: 'rgba(148, 163, 184, 0.08)' },
            ticks: { color: '#94A3B8', font: { family: 'Inter', size: 11 } }
          },
          y: {
            stacked: true,
            grid: { color: 'rgba(148, 163, 184, 0.08)' },
            ticks: { color: '#94A3B8', font: { family: 'Inter', size: 11 }, stepSize: 2 }
          }
        },
        plugins: {
          legend: {
            position: 'top',
            labels: { color: '#94A3B8', font: { family: 'Inter', size: 12 } }
          }
        }
      }
    });
  }

  function init() {
    // Hardware Simulator Tabs
    const tabBtns = document.querySelectorAll('.hardware-tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const targetTab = btn.getAttribute('data-tab');
        document.querySelectorAll('.hardware-tab-pane').forEach(p => p.classList.remove('active'));
        const pane = document.getElementById(targetTab);
        if (pane) pane.classList.add('active');
      });
    });

    // RFID Tap Simulator Button
    const btnRfidTap = document.getElementById('btnSimulateRfidTap');
    if (btnRfidTap) {
      btnRfidTap.addEventListener('click', handleRfidTap);
    }

    // Keypad number keys
    document.querySelectorAll('.keypad-digit-key').forEach(btn => {
      btn.addEventListener('click', () => {
        const digit = btn.getAttribute('data-key');
        handleKeypadPress(digit);
      });
    });

    const btnClear = document.getElementById('keypadBtnClear');
    if (btnClear) btnClear.addEventListener('click', handleKeypadClear);

    const btnEnter = document.getElementById('keypadBtnEnter');
    if (btnEnter) btnEnter.addEventListener('click', handleKeypadSubmit);

    // Filters & Search
    const searchInput = document.getElementById('accSearchInput');
    const methodFilter = document.getElementById('accMethodFilter');
    const statusFilter = document.getElementById('accStatusFilter');

    if (searchInput) searchInput.addEventListener('input', renderTable);
    if (methodFilter) methodFilter.addEventListener('change', renderTable);
    if (statusFilter) statusFilter.addEventListener('change', renderTable);

    // State change subscription
    window.TRACE.subscribe(() => {
      updateKPIs();
      renderTable();
    });

    updateKPIs();
    renderTable();
    setTimeout(initChart, 200);
  }

  return {
    init,
    refresh: () => {
      updateKPIs();
      renderTable();
    }
  };
})();

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.TRACE_ACCESS.init();
});
