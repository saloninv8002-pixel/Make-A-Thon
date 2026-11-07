/**
 * TRACE - Digital Twin 3D Virtual Smart Door Controller (digital-twin.js)
 * High-fidelity physical-virtual mirror of the smart door hardware.
 * Manages 3D geometry transforms, physical deadbolt actuation, magnetic flux,
 * corner strobe beacons, real-time sensor telemetry, and System Rules engine.
 */

window.TRACE_TWIN = (function () {
  function updateTwinView() {
    if (!window.TRACE) return;
    const state = window.TRACE.getState();

    // Elements
    const viewportCard = document.getElementById('twinViewportCard');
    const doorLeaf = document.getElementById('twinDoorLeaf');
    const stateBadge = document.getElementById('twinStateBadge');
    const deadbolt = document.getElementById('twinDeadbolt');
    const lockLed = document.getElementById('twinLockLed');
    const magneticFlux = document.getElementById('twinMagneticFlux');
    const rfidZone = document.getElementById('twinRfidZone');
    const telemetrySourceBadge = document.getElementById('twinTelemetrySourceBadge');

    // Telemetry displays
    const hudAngle = document.getElementById('hudAngle');
    const hudServo = document.getElementById('hudServo');
    const hudReed = document.getElementById('hudReed');
    const hudVoltage = document.getElementById('hudVoltage');
    const hudRssi = document.getElementById('hudRssi');
    const hudLastChange = document.getElementById('hudLastChange');
    const hudLastUpdate = document.getElementById('hudLastUpdate');

    // 1. Determine which of the 4 Main States we are in:
    // State 1: CLOSED + LOCKED
    // State 2: CLOSED + UNLOCKED
    // State 3: OPEN
    // State 4: ALARM

    let isAlarm = state.activeAlarm;
    let isDoorOpen = (state.doorState === 'open');
    let isLocked = (state.lockState === 'locked');

    // Update Door Leaf 3D Angle
    if (doorLeaf) {
      if (isDoorOpen) {
        doorLeaf.classList.remove('state-closed');
        doorLeaf.classList.add('state-open');
      } else {
        doorLeaf.classList.remove('state-open');
        doorLeaf.classList.add('state-closed');
      }
    }

    // Update Deadbolt Actuation
    if (deadbolt) {
      if (isLocked) {
        deadbolt.classList.remove('unlocked');
        deadbolt.classList.add('locked');
      } else {
        deadbolt.classList.remove('locked');
        deadbolt.classList.add('unlocked');
      }
    }

    // Update Magnetic Flux Indicator
    if (magneticFlux) {
      if (isDoorOpen) {
        magneticFlux.classList.add('broken');
      } else {
        magneticFlux.classList.remove('broken');
      }
    }

    // Update RFID Pulse Zone
    if (rfidZone) {
      if (state.sensors.rfidReader === 'reading') {
        rfidZone.classList.add('reading');
      } else {
        rfidZone.classList.remove('reading');
      }
    }

    // Set Viewport Strobe / Alarm State & State Badge
    if (viewportCard) {
      if (isAlarm) {
        viewportCard.classList.add('alarm-active');
      } else {
        viewportCard.classList.remove('alarm-active');
      }
    }

    if (stateBadge && lockLed) {
      if (isAlarm) {
        // STATE 4: ALARM (Distinct Red Alert State)
        stateBadge.className = 'twin-state-badge state-alarm';
        stateBadge.innerHTML = `<span class="status-dot"></span> ALARM: ${state.alarmReason || 'BREACH DETECTED'}`;
        lockLed.className = 'lock-led-bar led-alarm';
      } else if (isDoorOpen) {
        // STATE 3: OPEN (Warning Indicator)
        stateBadge.className = 'twin-state-badge state-open';
        stateBadge.innerHTML = '<span class="status-dot"></span> OPEN (DOOR AJAR)';
        lockLed.className = isLocked ? 'lock-led-bar led-alarm' : 'lock-led-bar led-unlocked';
      } else if (!isLocked) {
        // STATE 2: CLOSED + UNLOCKED (Amber Indicator)
        stateBadge.className = 'twin-state-badge state-closed-unlocked';
        stateBadge.innerHTML = '<span class="status-dot"></span> CLOSED + UNLOCKED';
        lockLed.className = 'lock-led-bar led-unlocked';
      } else {
        // STATE 1: CLOSED + LOCKED (Green Secure Indicator)
        stateBadge.className = 'twin-state-badge state-closed-locked';
        stateBadge.innerHTML = '<span class="status-dot"></span> CLOSED + LOCKED (SECURE)';
        lockLed.className = 'lock-led-bar';
      }
    }

    // Telemetry Telemetry Source Badge
    if (telemetrySourceBadge) {
      if (state.mode === 'live' && state.backendConnected) {
        telemetrySourceBadge.className = 'badge badge-hardware';
        telemetrySourceBadge.innerHTML = '<span class="status-dot"></span> ESP32 HARDWARE STREAM';
      } else {
        telemetrySourceBadge.className = 'badge badge-simulated';
        telemetrySourceBadge.innerHTML = '<span class="status-dot"></span> SIMULATED TWIN TELEMETRY';
      }
    }

    // Update HUD Metrics
    if (hudAngle) hudAngle.textContent = `${state.sensors.angleDegrees}°`;
    if (hudServo) hudServo.textContent = `${state.sensors.servoAngle}° (${state.sensors.servoLock.toUpperCase()})`;
    if (hudReed) hudReed.textContent = (state.sensors.reedSwitch === 'contact' ? 'CONTACT (0mm)' : 'OPEN (>40mm)');
    if (hudVoltage) hudVoltage.textContent = `${state.sensors.voltage.toFixed(2)}V`;
    if (hudRssi) hudRssi.textContent = `${state.sensors.rssiDbm} dBm`;
    
    if (hudLastChange) {
      const diffSec = Math.floor((Date.now() - new Date(state.lastStateChange).getTime()) / 1000);
      hudLastChange.textContent = diffSec < 60 ? `${diffSec}s ago` : `${Math.floor(diffSec / 60)}m ago`;
    }

    if (hudLastUpdate) {
      const diffSec = Math.floor((Date.now() - new Date(state.lastSensorUpdate).getTime()) / 1000);
      hudLastUpdate.textContent = diffSec < 60 ? `${diffSec}s ago` : `${Math.floor(diffSec / 60)}m ago`;
    }

    // Update Telemetry Panel Status Rows
    const twinCurDoor = document.getElementById('twinCurDoor');
    const twinCurLock = document.getElementById('twinCurLock');
    const twinCurRfid = document.getElementById('twinCurRfid');
    const twinCurKeypad = document.getElementById('twinCurKeypad');
    const twinCurReed = document.getElementById('twinCurReed');
    const twinCurServo = document.getElementById('twinCurServo');
    const twinCurUpdate = document.getElementById('twinCurUpdate');

    if (twinCurDoor) twinCurDoor.textContent = state.doorState.toUpperCase();
    if (twinCurLock) twinCurLock.textContent = state.lockState.toUpperCase();
    if (twinCurRfid) twinCurRfid.textContent = state.sensors.rfidReader.toUpperCase();
    if (twinCurKeypad) twinCurKeypad.textContent = state.sensors.keypad.toUpperCase();
    if (twinCurReed) twinCurReed.textContent = state.sensors.reedSwitch.toUpperCase();
    if (twinCurServo) twinCurServo.textContent = state.sensors.servoLock.toUpperCase();
    if (twinCurUpdate) twinCurUpdate.textContent = new Date(state.lastSensorUpdate).toLocaleTimeString();

    // Update SYSTEM RULES Panel
    updateSystemRules();
  }

  function updateSystemRules() {
    const state = window.TRACE.getState();

    // Rule 1: Door opened while locked
    const r1Card = document.getElementById('ruleCard1');
    const r1Badge = document.getElementById('ruleBadge1');
    if (r1Card && r1Badge) {
      const triggered = (state.rules.rule1_forced_entry.status === 'triggered');
      r1Card.classList.toggle('rule-triggered', triggered);
      r1Badge.className = triggered ? 'rule-status-badge alert' : 'rule-status-badge normal';
      r1Badge.textContent = triggered ? 'BREACH FLAGGED' : 'EVALUATING (OK)';
    }

    // Rule 2: Three wrong PIN attempts
    const r2Card = document.getElementById('ruleCard2');
    const r2Badge = document.getElementById('ruleBadge2');
    if (r2Card && r2Badge) {
      const triggered = (state.rules.rule2_wrong_pin.status === 'triggered');
      r2Card.classList.toggle('rule-triggered', triggered);
      r2Badge.className = triggered ? 'rule-status-badge alert' : 'rule-status-badge normal';
      r2Badge.textContent = triggered ? 'ATTACK DETECTED' : `NORMAL (${state.rules.rule2_wrong_pin.failedCount || 0}/3 FAILURES)`;
    }

    // Rule 3: Door open for more than two minutes
    const r3Card = document.getElementById('ruleCard3');
    const r3Badge = document.getElementById('ruleBadge3');
    if (r3Card && r3Badge) {
      const triggered = (state.rules.rule3_door_held_open.status === 'triggered');
      r3Card.classList.toggle('rule-triggered', triggered);
      r3Badge.className = triggered ? 'rule-status-badge alert' : 'rule-status-badge normal';
      r3Badge.textContent = triggered ? 'TIMER EXCEEDED' : 'MONITORING (<120s)';
    }

    // Rule 4: No sensor update
    const r4Card = document.getElementById('ruleCard4');
    const r4Badge = document.getElementById('ruleBadge4');
    if (r4Card && r4Badge) {
      const triggered = (state.rules.rule4_sensor_failure.status === 'triggered');
      r4Card.classList.toggle('rule-triggered', triggered);
      r4Badge.className = triggered ? 'rule-status-badge alert' : 'rule-status-badge normal';
      r4Badge.textContent = triggered ? 'HEARTBEAT LOST' : 'TELEMETRY LIVE';
    }
  }

  function init() {
    // Manual Twin Control Buttons
    const btnLock = document.getElementById('twinActionLock');
    const btnUnlock = document.getElementById('twinActionUnlock');
    const btnOpen = document.getElementById('twinActionOpen');
    const btnClose = document.getElementById('twinActionClose');
    const btnReset = document.getElementById('twinActionReset');

    if (btnLock) {
      btnLock.addEventListener('click', () => {
        window.TRACE.updateLockState('locked', 'twin-manual');
        window.TRACE.showToast('Lock Engaged', 'Deadbolt motorized into closed position.', 'info');
      });
    }

    if (btnUnlock) {
      btnUnlock.addEventListener('click', () => {
        window.TRACE.updateLockState('unlocked', 'twin-manual');
        window.TRACE.showToast('Lock Released', 'Deadbolt retracted for authorized access.', 'info');
      });
    }

    if (btnOpen) {
      btnOpen.addEventListener('click', () => {
        const state = window.TRACE.getState();
        window.TRACE.updateDoorState('open', 'twin-manual');
        if (state.lockState === 'locked') {
          window.TRACE.showToast('Warning', 'Door opened while locked! Rule 1 violation.', 'critical');
        } else {
          window.TRACE.showToast('Door Opened', 'Door leaf swung open 72 degrees.', 'info');
        }
      });
    }

    if (btnClose) {
      btnClose.addEventListener('click', () => {
        window.TRACE.updateDoorState('closed', 'twin-manual');
        window.TRACE.showToast('Door Closed', 'Magnetic reed switch contact made.', 'success');
      });
    }

    if (btnReset) {
      btnReset.addEventListener('click', () => {
        window.TRACE.resetToNormalSecure();
      });
    }

    // Subscribe to master state changes
    window.TRACE.subscribe(() => {
      updateTwinView();
    });

    updateTwinView();
  }

  return {
    init,
    refresh: updateTwinView
  };
})();

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.TRACE_TWIN.init();
});
