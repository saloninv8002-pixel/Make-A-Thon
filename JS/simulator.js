/**
 * TRACE - Scenario Simulator Engine (simulator.js)
 * Essential Make-A-Thon demonstration module for physical security attacks
 * and anomaly simulation with visual step execution and state mirroring.
 */

window.TRACE_SIMULATOR = (function () {
  let activeSimulationTimer = null;

  function clearActiveStepHighlights() {
    document.querySelectorAll('.step-item').forEach(step => {
      step.classList.remove('step-active');
    });
    document.querySelectorAll('.scenario-card').forEach(card => {
      card.classList.remove('active-simulation');
    });
  }

  /**
   * SCENARIO 1: FORCED ENTRY
   * Simulates door opened physically while locked (reed switch open + servo locked)
   */
  function triggerScenarioForcedEntry() {
    clearActiveStepHighlights();
    const card = document.getElementById('scenarioCard1');
    if (card) card.classList.add('active-simulation');

    const s1 = document.getElementById('s1_step1');
    const s2 = document.getElementById('s1_step2');
    const s3 = document.getElementById('s1_step3');
    const s4 = document.getElementById('s1_step4');

    // Step 1: Ensure system is locked
    if (s1) s1.classList.add('step-active');
    window.TRACE.updateLockState('locked', 'simulated');

    setTimeout(() => {
      // Step 2: Physical pry / reed switch separates without unlock authorization
      if (s1) s1.classList.remove('step-active');
      if (s2) s2.classList.add('step-active');
      
      // Update door to open while locked
      window.TRACE.updateDoorState('open', 'simulated');

      setTimeout(() => {
        // Step 3: Digital Twin Mismatch Engine detects conflict
        if (s2) s2.classList.remove('step-active');
        if (s3) s3.classList.add('step-active');

        setTimeout(() => {
          // Step 4: Strobe & Siren activated, critical alert logged
          if (s3) s3.classList.remove('step-active');
          if (s4) s4.classList.add('step-active');

          window.TRACE.showToast(
            'SCENARIO 1: FORCED ENTRY',
            'Sensor mismatch detected! Physical door swung open while deadbolt locked.',
            'critical',
            6000
          );
        }, 600);
      }, 700);
    }, 500);
  }

  /**
   * SCENARIO 2: DOOR HELD OPEN
   * Simulates authorized unlock, door opening, and remaining open beyond threshold (> 120s)
   */
  function triggerScenarioDoorHeldOpen() {
    clearActiveStepHighlights();
    const card = document.getElementById('scenarioCard2');
    if (card) card.classList.add('active-simulation');

    const s1 = document.getElementById('s2_step1');
    const s2 = document.getElementById('s2_step2');
    const s3 = document.getElementById('s2_step3');

    // Step 1: Door opened authorized
    if (s1) s1.classList.add('step-active');
    window.TRACE.updateLockState('unlocked', 'simulated');
    window.TRACE.updateDoorState('open', 'simulated');

    setTimeout(() => {
      // Step 2: Fast-forward simulation of 120-second timer
      if (s1) s1.classList.remove('step-active');
      if (s2) s2.classList.add('step-active');

      window.TRACE.showToast(
        'Timer Fast-Forward',
        'Simulating door held open threshold expiration (>120s)...',
        'info',
        2500
      );

      setTimeout(() => {
        // Step 3: Trigger Alert & Warning
        if (s2) s2.classList.remove('step-active');
        if (s3) s3.classList.add('step-active');

        const state = window.TRACE.getState();
        state.rules.rule3_door_held_open.status = 'triggered';

        window.TRACE.triggerAlert({
          title: 'DOOR HELD OPEN EXCEEDED',
          type: 'Door Held Open',
          severity: 'warning',
          description: 'Door remained open beyond safety threshold (simulated 120s elapsed). Tamper risk detected.',
          source: 'simulated'
        });
      }, 1200);
    }, 600);
  }

  /**
   * SCENARIO 3: WRONG PIN (Brute Force Break-in Attempt)
   * Simulates 3 consecutive invalid PIN entries leading to lockout & alert
   */
  function triggerScenarioWrongPin() {
    clearActiveStepHighlights();
    const card = document.getElementById('scenarioCard3');
    if (card) card.classList.add('active-simulation');

    const s1 = document.getElementById('s3_step1');
    const s2 = document.getElementById('s3_step2');
    const s3 = document.getElementById('s3_step3');

    // Step 1: Failed PIN attempt 1
    if (s1) s1.classList.add('step-active');
    window.TRACE.playKeypadTone(420);
    window.TRACE.recordAccessEvent({
      method: 'Keypad',
      result: 'denied',
      user: 'Attacker (Probe 1)',
      card_id: 'PIN-1234',
      description: 'Invalid PIN 1234 entered.',
      source: 'simulated'
    });

    setTimeout(() => {
      // Step 2: Failed PIN attempt 2
      if (s1) s1.classList.remove('step-active');
      if (s2) s2.classList.add('step-active');
      window.TRACE.playKeypadTone(420);
      window.TRACE.recordAccessEvent({
        method: 'Keypad',
        result: 'denied',
        user: 'Attacker (Probe 2)',
        card_id: 'PIN-9999',
        description: 'Invalid PIN 9999 entered.',
        source: 'simulated'
      });

      setTimeout(() => {
        // Step 3: Failed PIN attempt 3 & Lockout
        if (s2) s2.classList.remove('step-active');
        if (s3) s3.classList.add('step-active');
        window.TRACE.playKeypadTone(350);

        const state = window.TRACE.getState();
        state.rules.rule2_wrong_pin.status = 'triggered';
        state.rules.rule2_wrong_pin.failedCount = 3;
        state.sensors.keypad = 'locked_out';

        window.TRACE.triggerAlert({
          title: 'BRUTE-FORCE BREAK-IN ATTEMPT',
          type: 'Wrong PIN',
          severity: 'critical',
          description: 'Three consecutive incorrect PIN attempts ("1234", "9999", "0000"). Keypad lockout initiated for 60s.',
          source: 'simulated'
        });
      }, 1000);
    }, 1000);
  }

  /**
   * SCENARIO 4: SENSOR FAILURE
   * Simulates loss of sensor telemetry / ESP32 disconnection
   */
  function triggerScenarioSensorFailure() {
    clearActiveStepHighlights();
    const card = document.getElementById('scenarioCard4');
    if (card) card.classList.add('active-simulation');

    const s1 = document.getElementById('s4_step1');
    const s2 = document.getElementById('s4_step2');
    const s3 = document.getElementById('s4_step3');

    if (s1) s1.classList.add('step-active');
    window.TRACE.showToast('Heartbeat Interruption', 'Simulating magnetic reed wire severance...', 'info');

    setTimeout(() => {
      if (s1) s1.classList.remove('step-active');
      if (s2) s2.classList.add('step-active');

      const state = window.TRACE.getState();
      state.sensors.esp32Status = 'degraded';
      state.sensors.reedSwitch = 'open';
      state.sensors.voltage = 0.00;
      state.rules.rule4_sensor_failure.status = 'triggered';

      setTimeout(() => {
        if (s2) s2.classList.remove('step-active');
        if (s3) s3.classList.add('step-active');

        window.TRACE.triggerAlert({
          title: 'SENSOR TELEMETRY TIMEOUT',
          type: 'Sensor Failure',
          severity: 'critical',
          description: 'Heartbeat signal lost from physical reed sensor (Pin 4). Possible cable tampering or sensor fault.',
          source: 'simulated'
        });
      }, 800);
    }, 800);
  }

  function handleResetSimulation() {
    clearActiveStepHighlights();
    window.TRACE.resetToNormalSecure();
  }

  function init() {
    // Attach trigger scenario buttons
    const btnS1 = document.getElementById('btnTriggerScenario1');
    const btnS2 = document.getElementById('btnTriggerScenario2');
    const btnS3 = document.getElementById('btnTriggerScenario3');
    const btnS4 = document.getElementById('btnTriggerScenario4');
    const btnReset = document.getElementById('btnResetSimulation');
    const btnResetTop = document.getElementById('btnResetSimulationTop');

    if (btnS1) btnS1.addEventListener('click', triggerScenarioForcedEntry);
    if (btnS2) btnS2.addEventListener('click', triggerScenarioDoorHeldOpen);
    if (btnS3) btnS3.addEventListener('click', triggerScenarioWrongPin);
    if (btnS4) btnS4.addEventListener('click', triggerScenarioSensorFailure);

    if (btnReset) btnReset.addEventListener('click', handleResetSimulation);
    if (btnResetTop) btnResetTop.addEventListener('click', handleResetSimulation);
  }

  return {
    init,
    triggerForcedEntry: triggerScenarioForcedEntry,
    triggerDoorHeldOpen: triggerScenarioDoorHeldOpen,
    triggerWrongPin: triggerScenarioWrongPin,
    triggerSensorFailure: triggerScenarioSensorFailure,
    reset: handleResetSimulation
  };
})();

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.TRACE_SIMULATOR.init();
});
