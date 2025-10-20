# Blueprint 0x000034: Audit Logging Policy

**Objective:** Establish the logging, persistence, and review guarantees provided by the Audit Logger service.

**Target Upgrade:** AUDT (`audit-logger.js`)

**Prerequisites:** 0x000003 (Core Utilities & Error Handling), 0x000005 (State Management Architecture), 0x000033 (Module Integrity Verification)

**Affected Artifacts:** `/upgrades/audit-logger.js`, `/.audit/*.jsonl`, `/upgrades/boot-module-loader.js`, `/upgrades/rate-limiter.js`

---

### 1. The Strategic Imperative
Audit trails are mandatory for security-sensitive automation. They provide:
- **Forensics** after incidents (what module ran, who approved).
- **Compliance** for regulated environments.
- **Early warning** by trending errors or security violations.

This blueprint positions the Audit Logger as the canonical source for trustworthy telemetry.

### 2. Architectural Overview
The module exposes an async factory returning `{ init, api, widget }`.

```javascript
const Audit = await ModuleLoader.getModule('AuditLogger');
await Audit.init();
await Audit.api.logModuleLoad('ToolRunner', '/vfs/upgrades/tool-runner.js', true);
```

Key components:
- **Event Types** (`AuditEventType`): `MODULE_LOAD`, `MODULE_VERIFY`, `VFS_*`, `API_CALL`, `RATE_LIMIT`, `SECURITY_VIOLATION`, `SESSION_*`.
- **Entry Structure**: each log entry contains `id`, `timestamp`, `eventType`, `severity`, `details`, `userAgent`.
- **Buffer**: last 100 entries cached in memory (`recentLogs`) for fast UI access.
- **Persistence**: JSONL files per day at `/.audit/YYYY-MM-DD.jsonl`.
- **Helpers**: typed logging methods (e.g., `logApiCall`, `logVfsDelete`) that set severity automatically.
- **Querying**: `queryLogs`, `getStats`, `exportLogs` for retrieval and analytics.

**Web Component Widget:**

The widget uses a Web Component with Shadow DOM for encapsulated rendering:

```javascript
class AuditLoggerWidget extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    // Auto-refresh every 2 seconds
    this._interval = setInterval(() => this.render(), 2000);
  }

  disconnectedCallback() {
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
    }
  }

  getStatus() {
    const totalEvents = recentLogs.length;
    const securityViolations = recentLogs.filter(e =>
      e.eventType === AuditEventType.SECURITY_VIOLATION
    ).length;
    const errors = recentLogs.filter(e => e.severity === 'error').length;
    const lastEvent = recentLogs.length > 0
      ? recentLogs[recentLogs.length - 1].timestamp
      : null;

    let state = 'idle';
    if (totalEvents > 0 && lastEvent &&
        Date.now() - new Date(lastEvent).getTime() < 5000) {
      state = 'active';
    }
    if (securityViolations > 0) state = 'warning';
    if (errors > 0) state = 'error';

    return {
      state,
      primaryMetric: `${totalEvents} events`,
      secondaryMetric: `${errors} errors`,
      lastActivity: lastEvent ? new Date(lastEvent).getTime() : null,
      message: null
    };
  }

  getControls() {
    return [
      {
        id: 'export-logs',
        label: '↓ Export',
        action: async () => {
          const today = new Date().toISOString().split('T')[0];
          const logs = await exportLogs(today, today);
          // Download logs as file
          return { success: true, message: 'Logs exported' };
        }
      },
      {
        id: 'clear-recent',
        label: '⌦ Clear',
        action: () => {
          recentLogs.length = 0;
          this.render();
          return { success: true, message: 'Recent logs cleared' };
        }
      }
    ];
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          font-family: monospace;
        }
        .audit-logger-panel {
          padding: 12px;
          color: #fff;
        }
        /* Additional styles for stats grid, event stream, etc. */
      </style>
      <div class="audit-logger-panel">
        <h4>⊠ Audit Logger</h4>
        <!-- Stats grid, event type breakdown, recent events -->
      </div>
    `;
  }
}

// Register custom element
const elementName = 'audit-logger-widget';
if (!customElements.get(elementName)) {
  customElements.define(elementName, AuditLoggerWidget);
}

const widget = {
  element: elementName,
  displayName: 'Audit Logger',
  icon: '⊠',
  category: 'security'
};
```

**Key architectural improvements:**
- Shadow DOM provides style encapsulation for audit event display
- Lifecycle methods ensure proper cleanup of auto-refresh interval
- Closure access to `recentLogs` array eliminates injection complexity
- `getStatus()` derives state from recent logs (active/warning/error)
- `getControls()` provides export and clear actions

### 3. Implementation Pathway
1. **Initialization**
   - Call `AuditLogger.init()` during boot after Storage is ready.
   - Optionally log `SESSION_START` with persona + goal context.
2. **Hook Integration**
   - `ModuleLoader` logs load/verify events and attaches extra data (`isLegacy`, `loadTimeMs`).
   - VFS operations call `logVfs*`.
   - API clients log success/failure, response codes, provider.
   - Rate limiter logs exceedances via `logRateLimit`.
   - Security modules (integrity, sentinel FSM) log `SECURITY_VIOLATION`.
3. **Persistence**
   - Use JSONL to append quickly; handle missing file by creating new.
   - Ensure Storage can create directories ( `/.audit/` ) on first run.
   - Implement retention policy (e.g., prune older than 90 days) via periodic cleanup.
4. **Analysis APIs**
   - `queryLogs({ date, eventType, severity, limit })` supports dashboards.
   - `getStats(date)` summarises totals, severity distribution, failed operations.
   - `exportLogs(startDate, endDate)` packages logs for external review.
5. **Web Component Widget Implementation**
   - Define `AuditLoggerWidget` class extending `HTMLElement` inside factory function
   - Add Shadow DOM using `attachShadow({ mode: 'open' })` in constructor
   - Implement lifecycle methods:
     - `connectedCallback()`: Initial render and setup 2-second auto-refresh interval
     - `disconnectedCallback()`: Clean up interval to prevent memory leaks
   - Implement `getStatus()` as class method with closure access to `recentLogs`:
     - Returns all 5 required fields: `state`, `primaryMetric`, `secondaryMetric`, `lastActivity`, `message`
     - Derives state from recent activity, security violations, and error count
   - Implement `getControls()` as class method for interactive actions:
     - Export logs button (downloads today's audit log)
     - Clear recent logs button (empties in-memory buffer)
   - Implement `render()` method:
     - Set `this.shadowRoot.innerHTML` with encapsulated styles
     - Include `:host` selector for component-level styles
     - Display stats grid, event type breakdown, and scrollable event stream
   - Register custom element:
     - Use kebab-case naming: `audit-logger-widget`
     - Add duplicate check: `if (!customElements.get(elementName))`
     - Call `customElements.define(elementName, AuditLoggerWidget)`
   - Return widget object with new format:
     - `{ element: 'audit-logger-widget', displayName: 'Audit Logger', icon: '⊠', category: 'security' }`
6. **Security & Privacy**
   - Avoid logging secrets (mask API keys, tokens).
   - Include `userAgent` for traceability, but allow anonymisation for privacy requirements.

### 4. Verification Checklist
- [ ] Log files rotate daily and remain parseable JSONL.
- [ ] Failures to persist logs issue warnings but do not crash flows.
- [ ] Typed helpers set appropriate severity (e.g., VFS delete ⇒ warn).
- [ ] Query filters respect limit and event/severity selectors.
- [ ] Export sorts entries chronologically.

### 5. Extension Opportunities
- Stream logs to external SIEM via WebSocket or HTTP.
- Add integrity hashes for logs themselves (append-only guarantee).
- Surface audit insights in dashboard (top violations, modules with most errors).
- Tie audit events into toast notifications for real-time awareness.

Update this blueprint when adding event types, changing storage formats, or integrating with new security tooling.
