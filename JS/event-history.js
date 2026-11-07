/**
 * TRACE - Event History & Audit Log Controller (event-history.js)
 * Manages comprehensive audit trail, multi-criteria filtering,
 * instant client-side search, and RFC 4180 compliant CSV export.
 */

window.TRACE_HISTORY = (function () {
  function renderHistory() {
    if (!window.TRACE) return;
    const state = window.TRACE.getState();
    const tbody = document.getElementById('eventHistoryTableBody');
    if (!tbody) return;

    const searchTerm = (document.getElementById('historySearchInput')?.value || '').toLowerCase().trim();
    const typeFilter = document.getElementById('historyTypeFilter')?.value || 'all';
    const severityFilter = document.getElementById('historySeverityFilter')?.value || 'all';
    const sourceFilter = document.getElementById('historySourceFilter')?.value || 'all';

    // Filter events (newest first)
    const filtered = state.events.filter(evt => {
      // Type filter
      if (typeFilter !== 'all') {
        if (typeFilter === 'granted' && !evt.type.includes('Granted')) return false;
        if (typeFilter === 'denied' && !evt.type.includes('Denied')) return false;
        if (typeFilter === 'alert' && !evt.type.includes('ALERT') && !evt.type.includes('Forced')) return false;
        if (typeFilter === 'system' && !evt.type.includes('System') && !evt.type.includes('Auto-Lock')) return false;
      }

      // Severity filter
      if (severityFilter !== 'all' && evt.severity !== severityFilter) {
        return false;
      }

      // Source filter
      if (sourceFilter !== 'all' && evt.source !== sourceFilter) {
        return false;
      }

      // Search query filter
      if (searchTerm) {
        const fullStr = `${evt.id} ${evt.type} ${evt.method} ${evt.user} ${evt.card_id} ${evt.prevState} ${evt.curState} ${evt.description}`.toLowerCase();
        if (!fullStr.includes(searchTerm)) return false;
      }

      return true;
    });

    const countEl = document.getElementById('historyRecordCount');
    if (countEl) countEl.textContent = `Showing ${filtered.length} of ${state.events.length} records`;

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 32px; color: var(--text-muted);">
            No security events match the current filter criteria.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map(evt => {
      let severityBadge = '';
      if (evt.severity === 'critical') {
        severityBadge = '<span class="badge badge-critical">CRITICAL</span>';
      } else if (evt.severity === 'warning') {
        severityBadge = '<span class="badge badge-warning">WARNING</span>';
      } else {
        severityBadge = '<span class="badge badge-success">NORMAL</span>';
      }

      const sourceBadge = evt.source === 'hardware'
        ? '<span class="badge badge-hardware" style="font-size: 0.65rem;">HARDWARE</span>'
        : '<span class="badge badge-simulated" style="font-size: 0.65rem;">SIMULATED</span>';

      const dateObj = new Date(evt.timestamp);
      const timeStr = dateObj.toLocaleTimeString();
      const dateStr = dateObj.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });

      return `
        <tr>
          <td style="font-family: var(--font-mono); font-size: 0.78rem; font-weight: 700; color: var(--accent-secondary);">
            ${evt.id}
          </td>
          <td style="font-family: var(--font-mono); font-size: 0.78rem; color: var(--text-muted); white-space: nowrap;">
            ${dateStr} ${timeStr}
          </td>
          <td>
            <div style="font-weight: 600; color: var(--text-primary); font-size: 0.86rem;">${evt.type}</div>
            <div style="font-size: 0.76rem; color: var(--text-secondary);">${evt.description}</div>
          </td>
          <td>
            <div style="font-weight: 500;">${evt.method}</div>
            <div style="font-size: 0.72rem; color: var(--text-muted);">${evt.user}</div>
          </td>
          <td style="font-family: var(--font-mono); font-size: 0.74rem; color: var(--text-muted);">
            ${evt.prevState}
          </td>
          <td style="font-family: var(--font-mono); font-size: 0.74rem; font-weight: 600; color: var(--text-primary);">
            ${evt.curState}
          </td>
          <td>
            <div style="display: flex; flex-direction: column; gap: 4px; align-items: flex-start;">
              ${severityBadge}
              ${sourceBadge}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  function exportCSV() {
    if (!window.TRACE) return;
    const state = window.TRACE.getState();
    const events = state.events;

    if (events.length === 0) {
      window.TRACE.showToast('Export Empty', 'No events in audit log to export.', 'warning');
      return;
    }

    // Prepare CSV header
    const headers = [
      'Event ID',
      'Timestamp',
      'Event Type',
      'Method',
      'User / Identity',
      'Credential ID',
      'Previous State',
      'Current State',
      'Severity',
      'Source',
      'Description'
    ];

    // Escape CSV cell value according to RFC 4180
    const escapeCsv = (str) => {
      if (str === null || str === undefined) return '""';
      const s = String(str).replace(/"/g, '""');
      return `"${s}"`;
    };

    const rows = events.map(evt => [
      escapeCsv(evt.id),
      escapeCsv(new Date(evt.timestamp).toISOString()),
      escapeCsv(evt.type),
      escapeCsv(evt.method),
      escapeCsv(evt.user),
      escapeCsv(evt.card_id),
      escapeCsv(evt.prevState),
      escapeCsv(evt.curState),
      escapeCsv(evt.severity),
      escapeCsv(evt.source),
      escapeCsv(evt.description)
    ].join(','));

    const csvContent = '\uFEFF' + [headers.map(escapeCsv).join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const filename = `TRACE_Security_Audit_Log_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}.csv`;

    const downloadLink = document.createElement('a');
    downloadLink.setAttribute('href', url);
    downloadLink.setAttribute('download', filename);
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(url);

    window.TRACE.showToast(
      'Audit Log Exported',
      `Successfully generated CSV file (${events.length} records): ${filename}`,
      'success'
    );
  }

  function clearFilters() {
    const searchInput = document.getElementById('historySearchInput');
    const typeFilter = document.getElementById('historyTypeFilter');
    const severityFilter = document.getElementById('historySeverityFilter');
    const sourceFilter = document.getElementById('historySourceFilter');

    if (searchInput) searchInput.value = '';
    if (typeFilter) typeFilter.value = 'all';
    if (severityFilter) severityFilter.value = 'all';
    if (sourceFilter) sourceFilter.value = 'all';

    renderHistory();
    window.TRACE.showToast('Filters Cleared', 'Displaying all audit events.', 'info');
  }

  function init() {
    const searchInput = document.getElementById('historySearchInput');
    const typeFilter = document.getElementById('historyTypeFilter');
    const severityFilter = document.getElementById('historySeverityFilter');
    const sourceFilter = document.getElementById('historySourceFilter');
    const btnClear = document.getElementById('btnHistoryClearFilters');
    const btnExport = document.getElementById('btnHistoryExportCSV');

    if (searchInput) searchInput.addEventListener('input', renderHistory);
    if (typeFilter) typeFilter.addEventListener('change', renderHistory);
    if (severityFilter) severityFilter.addEventListener('change', renderHistory);
    if (sourceFilter) sourceFilter.addEventListener('change', renderHistory);
    if (btnClear) btnClear.addEventListener('click', clearFilters);
    if (btnExport) btnExport.addEventListener('click', exportCSV);

    // Subscribe to state updates
    window.TRACE.subscribe(() => {
      renderHistory();
    });

    renderHistory();
  }

  return {
    init,
    refresh: renderHistory,
    exportCSV
  };
})();

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.TRACE_HISTORY.init();
});
