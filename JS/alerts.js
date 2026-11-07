/**
 * TRACE - Alerts & Notifications Management Controller (alerts.js)
 * Displays critical security alerts (Forced Entry, Door Held Open,
 * Wrong PIN, Sensor Failure), supports acknowledgement and resolution,
 * and maintains real-time severity badges.
 */

window.TRACE_ALERTS = (function () {
  let activeFilter = 'all'; // 'all' | 'critical' | 'warning' | 'resolved'

  function renderAlerts() {
    if (!window.TRACE) return;
    const state = window.TRACE.getState();
    const container = document.getElementById('alertsFeedContainer');
    if (!container) return;

    // Filter alerts based on activeFilter
    const filtered = state.alerts.filter(alert => {
      if (activeFilter === 'all') return true;
      if (activeFilter === 'critical') return alert.severity === 'critical' && alert.status !== 'resolved';
      if (activeFilter === 'warning') return alert.severity === 'warning' && alert.status !== 'resolved';
      if (activeFilter === 'resolved') return alert.status === 'resolved';
      return true;
    });

    // Update filter counts
    updateFilterCounts();

    if (filtered.length === 0) {
      container.innerHTML = `
        <div style="background: var(--bg-card); border: 1px dashed var(--border-color); border-radius: var(--border-radius-md); padding: 40px; text-align: center; color: var(--text-muted);">
          <div style="font-size: 1.1rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 6px;">No Alerts In This Category</div>
          <p style="font-size: 0.85rem;">All safety rules and hardware sensor telemetry within acceptable limits.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map(alert => {
      const isResolved = alert.status === 'resolved';
      const isAcknowledged = alert.status === 'acknowledged';
      const severityClass = `severity-${alert.severity}`;
      const statusClass = isResolved ? 'status-resolved' : '';

      let severityBadge = '';
      if (alert.severity === 'critical') {
        severityBadge = '<span class="badge badge-critical">CRITICAL</span>';
      } else if (alert.severity === 'warning') {
        severityBadge = '<span class="badge badge-warning">WARNING</span>';
      } else {
        severityBadge = '<span class="badge badge-success">NORMAL</span>';
      }

      let statusBadge = '';
      if (isResolved) {
        statusBadge = '<span class="badge badge-info" style="opacity: 0.8;">RESOLVED</span>';
      } else if (isAcknowledged) {
        statusBadge = '<span class="badge badge-warning">ACKNOWLEDGED</span>';
      } else {
        statusBadge = '<span class="badge badge-critical" style="animation: pulse-critical 1.5s infinite;">ACTIVE</span>';
      }

      const sourceBadge = alert.source === 'hardware'
        ? '<span class="badge badge-hardware" style="font-size: 0.65rem;">HARDWARE</span>'
        : '<span class="badge badge-simulated" style="font-size: 0.65rem;">SIMULATED</span>';

      const timeFormatted = new Date(alert.timestamp).toLocaleString();

      return `
        <div class="alert-card-item ${severityClass} ${statusClass}" id="alert-card-${alert.id}">
          <div class="alert-main-content">
            <div class="alert-icon-col">
              ${getAlertIcon(alert.type, alert.severity)}
            </div>
            <div class="alert-body-col">
              <div class="alert-title-row">
                <span class="alert-heading">${alert.title}</span>
                ${severityBadge}
                ${statusBadge}
                ${sourceBadge}
              </div>
              <div class="alert-description-text">${alert.description}</div>
              <div class="alert-meta-time">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                <span>ID: ${alert.id}</span> • <span>${timeFormatted}</span> • <span>Rule Type: ${alert.type}</span>
              </div>
            </div>
          </div>
          <div class="alert-actions-col">
            ${!isResolved && !isAcknowledged ? `
              <button class="btn btn-warning btn-sm btn-acknowledge" data-id="${alert.id}">
                Acknowledge
              </button>
            ` : ''}
            ${!isResolved ? `
              <button class="btn btn-secondary btn-sm btn-resolve" data-id="${alert.id}">
                Resolve
              </button>
            ` : `
              <span style="font-size: 0.78rem; color: var(--text-muted); font-style: italic;">Cleared</span>
            `}
          </div>
        </div>
      `;
    }).join('');

    // Attach event listeners to buttons
    container.querySelectorAll('.btn-acknowledge').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        window.TRACE.acknowledgeAlert(id);
      });
    });

    container.querySelectorAll('.btn-resolve').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        window.TRACE.resolveAlert(id);
      });
    });
  }

  function getAlertIcon(type, severity) {
    if (severity === 'critical') {
      return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
    }
    return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
  }

  function updateFilterCounts() {
    const state = window.TRACE.getState();
    const countAll = state.alerts.length;
    const countCritical = state.alerts.filter(a => a.severity === 'critical' && a.status !== 'resolved').length;
    const countWarning = state.alerts.filter(a => a.severity === 'warning' && a.status !== 'resolved').length;
    const countResolved = state.alerts.filter(a => a.status === 'resolved').length;

    const elCountAll = document.getElementById('countAlertsAll');
    const elCountCrit = document.getElementById('countAlertsCritical');
    const elCountWarn = document.getElementById('countAlertsWarning');
    const elCountRes = document.getElementById('countAlertsResolved');

    if (elCountAll) elCountAll.textContent = countAll;
    if (elCountCrit) elCountCrit.textContent = countCritical;
    if (elCountWarn) elCountWarn.textContent = countWarning;
    if (elCountRes) elCountRes.textContent = countResolved;
  }

  function init() {
    // Filter pills
    document.querySelectorAll('.alert-filter-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.alert-filter-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        activeFilter = pill.getAttribute('data-filter');
        renderAlerts();
      });
    });

    // Acknowledge All Button
    const ackAllBtn = document.getElementById('btnAcknowledgeAll');
    if (ackAllBtn) {
      ackAllBtn.addEventListener('click', () => {
        const state = window.TRACE.getState();
        state.alerts.forEach(a => {
          if (a.status === 'active') a.status = 'acknowledged';
        });
        window.TRACE.stopAlarmSiren();
        window.TRACE.showToast('All Acknowledged', 'Operator has acknowledged all active security alerts.', 'info');
        renderAlerts();
      });
    }

    // Subscribe to state updates
    window.TRACE.subscribe(() => {
      renderAlerts();
    });

    renderAlerts();
  }

  return {
    init,
    refresh: renderAlerts
  };
})();

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.TRACE_ALERTS.init();
});
