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
The module exposes an async factory returning `{ init, api }`.

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
5. **Security & Privacy**
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
