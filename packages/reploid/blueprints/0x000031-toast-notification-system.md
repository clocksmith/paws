# Blueprint 0x000031: Toast Notification System

**Objective:** Define the behavioural contract for non-blocking toast notifications that surface agent status to users without halting workflows.

**Target Upgrade:** TSTN (`toast-notifications.js`)

**Prerequisites:** 0x000003 (Core Utilities & Error Handling), 0x00000D (UI Manager), 0x000028 (Confirmation Modal)

**Affected Artifacts:** `/upgrades/toast-notifications.js`, `/styles/dashboard.css`, `/upgrades/app-logic.js`

---

### 1. The Strategic Imperative
Alerts and blocking dialogues disrupt the agent’s flow. Toasts provide:
- **Contextual feedback** (success, error, warning, info) with consistent styling.
- **Non-blocking UX** suitable for automation loops.
- **A centralised channel** so modules report status without reinventing UI.

### 2. Architectural Overview
The system exposes a simple API backed by a singleton DOM container, plus a Web Component widget for monitoring:

```javascript
const Toasts = await ModuleLoader.getModule('ToastNotifications');
Toasts.success('Imported blueprint successfully.');
```

Key behaviours:
- **Lazy Initialization**: `init()` creates `#toast-container` once, positioned top-right with pointer-events control.
- **Toast Factory**: `show(message, type, duration)` builds toast markup, animates entry/exit, and wires click-to-dismiss.
- **Type Config**: `TOAST_TYPES` defines icon, accent colour, BG per severity (`success`, `error`, `warning`, `info`).
- **Queue Management**: Maintains `activeToasts`; removes DOM nodes on transitions to avoid leaks.
- **Convenience APIs**: `.success`, `.error`, `.warning`, `.info`, plus `.clearAll`.

#### Web Component Widget Pattern

The widget uses a Web Component with Shadow DOM for tracking toast statistics:

```javascript
class ToastNotificationsWidget extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    this._interval = setInterval(() => this.render(), 1000);
  }

  disconnectedCallback() {
    if (this._interval) clearInterval(this._interval);
  }

  set moduleApi(api) {
    this._api = api;
    this.render();
  }

  getStatus() {
    let state = 'idle';
    if (activeToasts.length > 0) state = 'active';
    if (activeToasts.some(t => t.className.includes('error'))) state = 'error';

    return {
      state,
      primaryMetric: `${activeToasts.length} active`,
      secondaryMetric: `${_toastStats.total} total`,
      lastActivity: _lastToastTime,
      message: state === 'error' ? 'Error toast shown' : null
    };
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          background: rgba(255,255,255,0.05);
          border-radius: 8px;
          padding: 16px;
        }
        h4 { margin: 0 0 16px 0; font-size: 1.2em; color: #fff; }
        .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
        .stat-card { background: rgba(255,255,255,0.05); border-radius: 6px; padding: 12px; }
        button { padding: 6px 12px; background: rgba(100,150,255,0.2); border: 1px solid rgba(100,150,255,0.4); }
      </style>

      <div class="toast-notifications-panel">
        <h4>⚏ Toast Notifications</h4>

        <div class="controls">
          <button class="clear-all">⌦ Clear All</button>
          <button class="clear-history">≡ Clear History</button>
        </div>

        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-label">Active</div>
            <div class="stat-value">${activeToasts.length}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Total Shown</div>
            <div class="stat-value">${_toastStats.total}</div>
          </div>
          <!-- Additional stats by type -->
        </div>

        <div class="toast-history-list">
          ${_toastHistory.slice(-20).reverse().map(toast => `
            <div class="toast-history-item toast-history-${toast.type}">
              <span>${new Date(toast.timestamp).toLocaleTimeString()}</span>
              <span>${toast.type}</span>
              <span>${toast.message}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    // Attach event listeners
    this.shadowRoot.querySelector('.clear-all')?.addEventListener('click', () => {
      clearAll();
      this.render();
    });
  }
}

if (!customElements.get('toast-notifications-widget')) {
  customElements.define('toast-notifications-widget', ToastNotificationsWidget);
}

const widget = {
  element: 'toast-notifications-widget',
  displayName: 'Toast Notifications',
  icon: '⚏',
  category: 'ui',
  updateInterval: 1000
};
```

**Key architectural improvements:**
- Shadow DOM provides style encapsulation for widget panel
- Lifecycle methods ensure proper interval cleanup
- Closure access to `activeToasts`, `_toastHistory`, `_toastStats` for real-time monitoring
- `getStatus()` provides all 5 required fields including error detection

### 3. Implementation Pathway
1. **Trigger Points**
   - Replace `alert()` and console-only messages in upgrades with toast calls.
   - Typical sources: tool results, API fallback notices, persona switches.
2. **Styling & Accessibility**
   - Use high-contrast colours and icons for quick recognition.
   - Provide `aria-live="polite"` on container to notify assistive tech without interruption (future enhancement).
3. **Duration Management**
   - Default 4000ms; allow callers to override or set `duration = 0` for persistent toasts (requires manual dismiss).
4. **Error Handling**
   - Gracefully degrade if DOM is unavailable (e.g., CLI mode); log via `logger`.
5. **Integration with Analytics**
   - Track toast history and statistics using internal variables (`_toastHistory`, `_toastStats`, `_lastToastTime`)
   - Widget provides monitoring dashboard for toast activity
6. **Web Component Widget Implementation**
   - **Define Web Component class** extending HTMLElement inside factory function
   - **Add Shadow DOM** using `attachShadow({ mode: 'open' })` in constructor
   - **Implement lifecycle methods**:
     - `connectedCallback()`: Initial render and set up 1-second auto-refresh interval
     - `disconnectedCallback()`: Clean up interval with `clearInterval(this._interval)` to prevent memory leaks
   - **Implement getStatus()** as class method with ALL 5 required fields:
     - `state`: 'idle', 'active', or 'error' based on active toasts
     - `primaryMetric`: Number of active toasts
     - `secondaryMetric`: Total toasts shown
     - `lastActivity`: Timestamp of last toast
     - `message`: Error notification if error toast is shown
   - **Implement render()** method:
     - Set `this.shadowRoot.innerHTML` with encapsulated `<style>` tag using `:host` selector
     - Display stats grid with active/total/errors/success counts
     - Show breakdown by toast type with percentages
     - Render recent toast history (last 20) in scrollable list
     - Wire up event listeners for clear buttons
   - **Register custom element**:
     - Use kebab-case naming: `toast-notifications-widget`
     - Add duplicate check: `if (!customElements.get('toast-notifications-widget'))`
     - Call `customElements.define('toast-notifications-widget', ToastNotificationsWidget)`
   - **Return widget object** with new format:
     - `{ element: 'toast-notifications-widget', displayName, icon, category }`
     - No `updateInterval` in widget object (handled internally in connectedCallback)

### 4. Verification Checklist
- [ ] Repeated init calls do not duplicate container.
- [ ] Toasts are clickable and remove themselves without throwing.
- [ ] Rapid bursts (10+) stay performant (no dropped frames).
- [ ] Colors/icons match severity guidelines.
- [ ] `clearAll()` empties queue immediately (useful on persona switch).

### 5. Extension Opportunities
- Allow stacking positions (bottom-left for mobile).
- Provide progress toasts with spinners for long operations.
- Persist critical errors to reflection log for later review.

Use this blueprint whenever adjusting toast styling, extending severity types, or adding telemetry hooks.
