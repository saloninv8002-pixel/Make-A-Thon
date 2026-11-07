/**
 * TRACE - Dashboard Controller (dashboard.js)
 * Manages the default landing view: KPI metrics, mini digital twin preview,
 * access ratio charts, hardware health status, and recent security events.
 */

window.TRACE_DASHBOARD = (function () {
  let accessChartInstance = null;

  function renderKPIs() {
    if (!window.TRACE) return;
    const state = window.TRACE.getState();

    // 1. Door Status Card
    const doorCard = document.getElementById('kpiDoorCard');
    const doorVal = document.getElementById('kpiDoorVal');
    const doorSub = document.getElementById('kpiDoorSub');
    if (doorVal) {
      doorVal.textContent = state.doorState.toUpperCase();
      if (state.doorState === 'closed') {
        doorCard.className = 'kpi-card state-secure';
        doorSub.innerHTML = '<span class="status-dot"></span> Magnetic seal engaged';
      } else {
        doorCard.className = 'kpi-card state-warning';
        doorSub.innerHTML = '<span class="status-dot"></span> Reed contact opened';
      }
    }

    // 2. Lock Status Card
    const lockCard = document.getElementById('kpiLockCard');
    const lockVal = document.getElementById('kpiLockVal');
    const lockSub = document.getElementById('kpiLockSub');
    if (lockVal) {
      lockVal.textContent = state.lockState.toUpperCase();
      if (state.lockState === 'locked') {
        lockCard.className = 'kpi-card state-secure';
        lockSub.innerHTML = '<span class="status-dot"></span> Deadbolt extended (0°)';
      } else {
        lockCard.className = 'kpi-card state-warning';
        lockSub.innerHTML = '<span class="status-dot"></span> Deadbolt retracted (90°)';
      }
    }

    // 3. Security Status Card
    const secCard = document.getElementById('kpiSecCard');
    const secVal = document.getElementById('kpiSecVal');
    const secSub = document.getElementById('kpiSecSub');
    if (secVal) {
      secVal.textContent = state.securityStatus.toUpperCase();
      if (state.securityStatus === 'secure') {
        secCard.className = 'kpi-card state-secure';
        secSub.innerHTML = '<span class="status-dot"></span> All 4 rules validated';
      } else if (state.securityStatus === 'warning') {
        secCard.className = 'kpi-card state-warning';
        secSub.innerHTML = '<span class="status-dot"></span> Cautionary threshold flagged';
      } else {
        secCard.className = 'kpi-card state-critical';
        secSub.innerHTML = `<span class="status-dot"></span> ${state.alarmReason || 'Alarm Active'}`;
      }
    }

    // 4. RFID Status Card
    const rfidCard = document.getElementById('kpiRfidCard');
    const rfidVal = document.getElementById('kpiRfidVal');
    const rfidSub = document.getElementById('kpiRfidSub');
    if (rfidVal) {
      rfidVal.textContent = state.sensors.rfidReader.toUpperCase();
      rfidCard.className = 'kpi-card state-info';
      rfidSub.textContent = 'RC522 SPI 13.56 MHz Active';
    }

    // 5. Today's Access Attempts
    const attemptsVal = document.getElementById('kpiAttemptsVal');
    const attemptsSub = document.getElementById('kpiAttemptsSub');
    if (attemptsVal) {
      attemptsVal.textContent = state.metrics.totalAttempts;
      const successPct = Math.round((state.metrics.successfulAttempts / (state.metrics.totalAttempts || 1)) * 100);
      attemptsSub.textContent = `${successPct}% success rate (${state.metrics.successfulAttempts} granted / ${state.metrics.failedAttempts} denied)`;
    }

    // 6. Active Alerts Card
    const alertsCard = document.getElementById('kpiAlertsCard');
    const alertsVal = document.getElementById('kpiAlertsVal');
    const alertsSub = document.getElementById('kpiAlertsSub');
    if (alertsVal) {
      alertsVal.textContent = state.metrics.activeAlertsCount;
      if (state.metrics.activeAlertsCount > 0) {
        alertsCard.className = 'kpi-card state-critical';
        alertsSub.innerHTML = '<span class="status-dot"></span> Requires operator action';
      } else {
        alertsCard.className = 'kpi-card state-secure';
        alertsSub.innerHTML = '<span class="status-dot"></span> Zero unhandled incidents';
      }
    }

    // Mini Twin Dashboard Preview updates
    renderMiniTwinPreview();
    renderRecentEvents();
    renderDeviceHealth();
    updateChart();
  }

  function renderMiniTwinPreview() {
    const state = window.TRACE.getState();
    const previewDoor = document.getElementById('dashMiniDoorLeaf');
    const previewStateBadge = document.getElementById('dashMiniStateBadge');
    const previewLockDot = document.getElementById('dashMiniLockLed');

    if (previewDoor) {
      if (state.doorState === 'open') {
        previewDoor.style.transform = 'rotateY(-60deg)';
      } else {
        previewDoor.style.transform = 'rotateY(0deg)';
      }
    }

    if (previewLockDot) {
      if (state.activeAlarm) {
        previewLockDot.style.background = '#EF4444';
        previewLockDot.style.boxShadow = '0 0 10px #EF4444';
      } else if (state.lockState === 'unlocked') {
        previewLockDot.style.background = '#F59E0B';
        previewLockDot.style.boxShadow = '0 0 10px #F59E0B';
      } else {
        previewLockDot.style.background = '#10B981';
        previewLockDot.style.boxShadow = '0 0 10px #10B981';
      }
    }

    if (previewStateBadge) {
      let text = 'CLOSED + LOCKED';
      let cls = 'badge-success';

      if (state.activeAlarm) {
        text = 'ALARM: ' + (state.alarmReason || 'BREACH');
        cls = 'badge-critical';
      } else if (state.doorState === 'open') {
        text = 'DOOR OPEN';
        cls = 'badge-warning';
      } else if (state.lockState === 'unlocked') {
        text = 'CLOSED + UNLOCKED';
        cls = 'badge-warning';
      }

      previewStateBadge.className = `badge ${cls}`;
      previewStateBadge.textContent = text;
    }
  }

  function renderRecentEvents() {
    const listEl = document.getElementById('dashRecentEventsList');
    if (!listEl) return;
    const state = window.TRACE.getState();
    const recent = state.events.slice(0, 5);

    if (recent.length === 0) {
      listEl.innerHTML = '<div style="padding: 16px; color: var(--text-muted); text-align: center;">No events recorded.</div>';
      return;
    }

    listEl.innerHTML = recent.map(evt => {
      const isSuccess = evt.type.includes('Granted');
      const isAlarm = evt.type.includes('ALERT') || evt.type.includes('Forced');
      const badgeCls = isAlarm ? 'badge-critical' : (isSuccess ? 'badge-success' : 'badge-warning');
      const sourceBadge = evt.source === 'hardware' 
        ? '<span class="badge badge-hardware" style="font-size: 0.65rem;">HARDWARE</span>'
        : '<span class="badge badge-simulated" style="font-size: 0.65rem;">SIMULATED</span>';

      return `
        <tr style="border-bottom: 1px solid var(--border-subtle);">
          <td style="padding: 10px 14px; font-family: var(--font-mono); font-size: 0.76rem; color: var(--text-muted);">
            ${new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </td>
          <td style="padding: 10px 14px;">
            <div style="font-weight: 600; color: var(--text-primary); font-size: 0.84rem;">${evt.type}</div>
            <div style="font-size: 0.74rem; color: var(--text-secondary);">${evt.description}</div>
          </td>
          <td style="padding: 10px 14px; font-size: 0.78rem;">
            ${evt.method} <span style="color: var(--text-muted); font-size: 0.72rem;">(${evt.user})</span>
          </td>
          <td style="padding: 10px 14px;">
            <span class="badge ${badgeCls}">${evt.severity.toUpperCase()}</span>
          </td>
          <td style="padding: 10px 14px; text-align: right;">
            ${sourceBadge}
          </td>
        </tr>
      `;
    }).join('');
  }

  function renderDeviceHealth() {
    const state = window.TRACE.getState();
    const espStatus = document.getElementById('healthEspStatus');
    const reedStatus = document.getElementById('healthReedStatus');
    const servoStatus = document.getElementById('healthServoStatus');
    const rfidStatus = document.getElementById('healthRfidStatus');
    const keypadStatus = document.getElementById('healthKeypadStatus');
    const buzzerStatus = document.getElementById('healthBuzzerStatus');

    if (espStatus) espStatus.textContent = state.sensors.esp32Status.toUpperCase();
    if (reedStatus) reedStatus.textContent = (state.sensors.reedSwitch === 'contact' ? 'CLOSED (OK)' : 'OPEN');
    if (servoStatus) servoStatus.textContent = `${state.sensors.servoAngle}° (${state.sensors.servoLock.toUpperCase()})`;
    if (rfidStatus) rfidStatus.textContent = state.sensors.rfidReader.toUpperCase();
    if (keypadStatus) keypadStatus.textContent = state.sensors.keypad.toUpperCase();
    if (buzzerStatus) buzzerStatus.textContent = state.activeAlarm ? 'SOUNDING' : 'IDLE';
  }

  function initChart() {
    const canvas = document.getElementById('accessRatioChart');
    if (!canvas || typeof Chart === 'undefined') return;

    const ctx = canvas.getContext('2d');
    const state = window.TRACE.getState();

    accessChartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Authorized Granted', 'Unauthorized Denied'],
        datasets: [{
          data: [state.metrics.successfulAttempts, state.metrics.failedAttempts],
          backgroundColor: [
            '#10B981', // Emerald green
            '#EF4444'  // Alert red
          ],
          borderColor: '#19283B',
          borderWidth: 3,
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: '#94A3B8',
              font: { family: 'Inter', size: 12 },
              padding: 14
            }
          },
          tooltip: {
            backgroundColor: '#0E1726',
            borderColor: '#38BDF8',
            borderWidth: 1,
            titleColor: '#F8FAFC',
            bodyColor: '#94A3B8'
          }
        },
        cutout: '72%'
      }
    });
  }

  function updateChart() {
    if (!accessChartInstance) return;
    const state = window.TRACE.getState();
    accessChartInstance.data.datasets[0].data = [
      state.metrics.successfulAttempts,
      state.metrics.failedAttempts
    ];
    accessChartInstance.update();
  }

  function init() {
    // Quick action buttons on Dashboard
    const quickUnlockBtn = document.getElementById('dashQuickUnlockBtn');
    const quickLockBtn = document.getElementById('dashQuickLockBtn');
    const viewTwinBtn = document.getElementById('dashViewTwinBtn');

    if (quickUnlockBtn) {
      quickUnlockBtn.addEventListener('click', () => {
        window.TRACE.updateLockState('unlocked', 'dashboard-quick');
        window.TRACE.showToast('Door Unlocked', 'Remote unlock signal dispatched to servo actuator.', 'info');
      });
    }

    if (quickLockBtn) {
      quickLockBtn.addEventListener('click', () => {
        window.TRACE.updateLockState('locked', 'dashboard-quick');
        window.TRACE.showToast('Door Locked', 'Servo deadlock bolt engaged into strike plate.', 'success');
      });
    }

    if (viewTwinBtn) {
      viewTwinBtn.addEventListener('click', () => {
        window.TRACE.switchView('digital-twin');
      });
    }

    // Subscribe to state updates
    window.TRACE.subscribe(() => {
      renderKPIs();
    });

    renderKPIs();
    setTimeout(initChart, 150);
  }

  return {
    init,
    refresh: () => {
      renderKPIs();
      updateChart();
    }
  };
})();

// Initialize dashboard once DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.TRACE_DASHBOARD.init();
});
