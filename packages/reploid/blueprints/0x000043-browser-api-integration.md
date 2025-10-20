# Blueprint 0x000043: Browser API Integration Layer

**Objective:** Outline how REPLOID leverages native browser capabilities (filesystem, notifications, clipboard, share, storage, wake locks) to outperform CLI environments.

**Target Upgrade:** BAPI (`browser-apis.js`)

**Prerequisites:** 0x000005 (State Management Architecture), 0x000028 (Confirmation Modal & Safety Interlocks), 0x000031 (Toast Notification System)

**Affected Artifacts:** `/upgrades/browser-apis.js`, `/styles/dashboard.css`, `/upgrades/state-manager.js`, `/upgrades/event-bus.js`

---

### 1. The Strategic Imperative
Browser-native APIs let REPLOID:
- Persist artifacts to the user’s filesystem without servers.
- Alert operators through notifications.
- Interact with clipboard/share flows for smooth UX.
- Monitor storage pressure and wake locks for long tasks.

Harnessing these APIs safely differentiates REPLOID from CLI-bound agents.

### 2. Architectural Overview
`BrowserAPIs` detects and wraps optional capabilities with consistent logging and EventBus signalling.

```javascript
const BrowserAPIs = await ModuleLoader.getModule('BrowserAPIs');
await BrowserAPIs.init();
const caps = BrowserAPIs.api.getCapabilities();
```

Key features:
- **Capability Detection**
  - File System Access (`showDirectoryPicker`)
  - Notifications (`Notification`)
  - Clipboard (`navigator.clipboard`)
  - Web Share (`navigator.share`)
  - Storage Estimate (`navigator.storage.estimate`)
  - Wake Lock (`navigator.wakeLock`)
  - Emits `browser-apis:initialized` with detected capabilities.
- **Filesystem Bridge**
  - `requestDirectoryAccess(mode)` obtains directory handle; caches for subsequent operations.
  - `writeFile`, `readFile`, `syncArtifactToFilesystem` interact with chosen directory.
  - Emits events for audit/tracking (e.g., `browser-apis:filesystem:write`).
- **Notifications**
  - `requestNotificationPermission`, `showNotification` gating on permission state.
- **Clipboard**
  - `writeToClipboard`, `readFromClipboard` with safety logging.
- **Web Share**
  - `share(data)` wraps `navigator.share` with abort handling.
- **Storage Monitoring**
  - `getStorageEstimate()` returns usage/quota metrics, enabling UI warnings.
- **State Exposure**
  - `getCapabilities()`, `getDirectoryHandle()` allow other modules to adapt behaviour.

**Widget Interface (Web Component):**

The module exposes a `BrowserAPIsWidget` custom element for dashboard visualization:

```javascript
class BrowserAPIsWidget extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    // No auto-refresh needed - capabilities are static once detected
  }

  set moduleApi(api) {
    this._api = api;
    this.render();
  }

  getStatus() {
    const state = this._api.getState();
    const availableCount = Object.values(state.capabilities).filter(Boolean).length;
    const hasRecentOp = state.operationStats.lastOperation &&
      (Date.now() - state.operationStats.lastOperation.timestamp < 60000);

    return {
      state: availableCount > 0 ? (hasRecentOp ? 'active' : 'idle') : 'disabled',
      primaryMetric: `${availableCount}/${totalCount} APIs`,
      secondaryMetric: state.fileSystemHandle ? `⛁ ${state.fileSystemHandle.name}` : 'No FS access',
      lastActivity: state.operationStats.lastOperation ? state.operationStats.lastOperation.timestamp : null
    };
  }

  render() {
    const state = this._api.getState();

    this.shadowRoot.innerHTML = `
      <style>/* Shadow DOM styles */</style>
      <div class="browser-apis-panel">
        <!-- API availability checklist (✓/✗ for each capability) -->
        <!-- Operation stats (file reads/writes, notifications, clipboard, shares) -->
        <!-- File system access status with directory name -->
        <!-- Notification permission status -->
        <!-- Last operation timestamp and type -->
        <!-- Interactive buttons: Request FS, Check Storage, Request Notifications, Generate Report -->
      </div>
    `;

    // Attach event listeners to interactive buttons
    this.shadowRoot.getElementById('request-fs').addEventListener('click', async () => {
      await this._api.requestDirectoryAccess();
    });

    this.shadowRoot.getElementById('check-storage').addEventListener('click', async () => {
      await this._api.getStorageEstimate();
    });
  }
}

customElements.define('browser-apis-widget', BrowserAPIsWidget);
```

**Key Widget Features:**
- **API Capability Checklist**: Visual display of all detected browser APIs (✓ available, ✗ unavailable)
- **Operation Statistics**: Tracks and displays file reads/writes, notifications shown, clipboard operations, shares
- **Permission States**: Shows file system directory access and notification permission status
- **Interactive Controls**: Buttons to request permissions, check storage, generate capability reports
- **Real-time Activity**: Highlights recent operations (< 1 minute) and updates state from 'idle' to 'active'

The widget provides a complete dashboard for monitoring browser API availability and usage without requiring external UI code.

### 3. Implementation Pathway
1. **Permissions UX**
   - Pair direct API requests with confirmation modals so the user understands consequences (e.g., enabling filesystem sync).
   - Store granted permissions in `StateManager` for future sessions (where supported).
2. **Error Handling**
   - Distinguish user cancellations vs hard failures; log at info vs error levels.
   - Provide actionable toasts on failure (e.g., “Enable clipboard permissions in browser settings”).
3. **Security Posture**
   - Never auto-grant destructive operations; always require user interaction for filesystem writes.
   - Validate paths to avoid writing outside intended directories.
4. **Integration Points**
   - Sync pipeline triggers `syncArtifactToFilesystem` after apply operations when user opted in.
   - Notifications for long-running tasks or consensus results.
   - Clipboard shortcuts for copying diffs or prompts.
   - Storage estimates surfaced in metrics dashboard to warn about quota exhaustion.
5. **Extensibility**
   - Add Wake Lock management to prevent sleep during long sessions.
   - Integrate Web Share for quick blueprint sharing with teammates.

### 4. Verification Checklist
- [ ] Capability detection runs once and events emitted correctly.
- [ ] Filesystem operations respect user-selected handle and handle nested paths.
- [ ] Notification requests update permission state and block `showNotification` when not granted.
- [ ] Clipboard API gracefully degrades (returns false/null when unsupported).
- [ ] Storage estimates include MB conversions and handle quota==0 edge cases.

### 5. Extension Opportunities
- Provide sandboxed “dry run” that previews filesystem changes before writing.
- Track average notification response time for UX tuning.
- Allow scheduling wake locks during Paxos competitions.
- Export capabilities summary in diagnostics reports.

Maintain this blueprint when adding new browser APIs or altering permission flows.
