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
The system exposes a simple API backed by a singleton DOM container.

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
   - Optionally emit `EventBus` events when toasts appear/dismiss for metrics.

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
