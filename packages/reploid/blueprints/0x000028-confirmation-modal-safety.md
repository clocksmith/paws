# Blueprint 0x000028: Confirmation Modal & Safety Interlocks

**Objective:** Document the UX and security contract for REPLOID’s confirmation modal system that guards destructive or privileged actions.

**Target Upgrade:** CFMD (`confirmation-modal.js`)

**Prerequisites:** 0x000003 (Core Utilities & Error Handling), 0x00000D (UI Manager), 0x000018 (Blueprint Creation Meta)

**Affected Artifacts:** `/upgrades/confirmation-modal.js`, `/styles/dashboard.css`, `/upgrades/event-bus.js`

---

### 1. The Strategic Imperative
Agents that can edit files, alter goals, or trigger network actions must request explicit confirmation from the operator. The modal is more than a pop-up—it enforces:
- **User intent validation** before applying irreversible changes.
- **Context clarity** via configurable messages and optional details.
- **Accessibility compliance** (focus traps, keyboard escape routes).
- **Event auditing** in tandem with `AuditLogger` (0x000034).

Without a blueprint, destructive actions might bypass confirmation or deliver inconsistent messaging that confuses operators.

### 2. Architectural Solution
`ConfirmationModal` implements both a **Promise-based API** and a **Web Component widget** for dashboard integration.

```javascript
// Promise-based modal API
const confirmed = await ConfirmationModal.confirm({
  title: 'Delete Blueprint',
  message: 'Remove 0x000010 from the knowledge base?',
  confirmText: 'Delete',
  cancelText: 'Keep',
  danger: true,
  details: 'This cannot be undone.'
});

// Web Component widget for dashboard
class ConfirmationModalWidget extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
  }

  disconnectedCallback() {
    // No intervals to clear
  }

  getStatus() {
    const hasActiveModal = activeModal !== null;
    const hasRecentActivity = modalStats.lastModal &&
      (Date.now() - modalStats.lastModal.timestamp < 60000);
    return {
      state: hasActiveModal ? 'active' : (hasRecentActivity ? 'idle' : 'disabled'),
      primaryMetric: modalStats.totalShown > 0 ? `${modalStats.totalShown} shown` : 'No modals',
      secondaryMetric: modalStats.totalConfirmed > 0 ? `${modalStats.totalConfirmed} confirmed` : 'Ready',
      lastActivity: modalStats.lastModal ? modalStats.lastModal.timestamp : null,
      message: hasActiveModal ? 'Modal active' : (modalStats.dangerModalsShown > 0 ? `${modalStats.dangerModalsShown} danger` : null)
    };
  }

  render() {
    // Shadow DOM with modal usage statistics
    this.shadowRoot.innerHTML = `<style>...</style><div>...</div>`;
  }
}
```

Key mechanics:
- **Singleton Modal**: only one modal may exist; new requests close the existing instance.
- **Dynamic DOM Injection**: builds overlay + dialog markup at call time.
- **Event Wiring**: attaches click handlers, Escape key listener, overlay dismissal, and focus management.
- **Promise Resolution**: resolves `true` on confirm, `false` on cancel or overlay close.
- **Style Injection**: lazily injects CSS if missing to avoid duplicate styles.
- **Usage Tracking**: tracks `modalStats` (totalShown, totalConfirmed, totalCancelled, dangerModalsShown, recentModals).
- **Widget Protocol**
  - Exports `widget` metadata: `{ element, displayName, icon, category, order }`.
  - Provides `getStatus()` with 5 required fields for dashboard integration.

### 3. Implementation Pathway
1. **Web Component Registration**
   - Define `ConfirmationModalWidget` extending `HTMLElement`.
   - Register custom element: `customElements.define('confirmation-modal-widget', ConfirmationModalWidget)`.
   - Export widget metadata: `{ element, displayName: 'Confirmation Modal', icon: '⁇', category: 'ui', order: 65 }`.
2. **Lifecycle: connectedCallback**
   - Call `attachShadow({ mode: 'open' })` in constructor.
   - No auto-refresh interval (modal stats updated on-demand).
   - Render Shadow DOM with usage statistics.
3. **Lifecycle: disconnectedCallback**
   - No cleanup needed (no intervals or persistent listeners).
4. **Shadow DOM Rendering**
   - Render inline `<style>` with cyberpunk theme and modal-specific CSS.
   - Display controls: "Test Modal", "Test Danger Modal" buttons for demo.
   - Show usage summary: total shown, confirmed, cancelled, danger modal count.
   - Display confirmation rate percentage with color coding (green/yellow/red).
   - Show last modal info: title, timestamp, danger flag.
   - List recent modals (last 5) with icons and timestamps.
   - Indicate if modal is currently active.
5. **Promise-based Modal API**
   - Call `confirm(options)` with title, message, confirmText, cancelText, danger, details.
   - Create overlay div with modal-content markup.
   - Attach event listeners: confirm button, cancel button, close (×), Escape key, overlay click.
   - Focus confirm button after render for accessibility.
   - Return Promise that resolves `true` (confirmed) or `false` (cancelled).
6. **Usage Tracking**
   - Wrap `confirm()` to increment `modalStats` counters.
   - Track: totalShown, totalConfirmed, totalCancelled, dangerModalsShown.
   - Maintain `recentModals` array (last 10) with title, timestamp, danger flag.
   - Update `lastModal` reference for quick access.
7. **getStatus() Method**
   - Return object with `state` (active if modal open, idle if recent activity, disabled otherwise).
   - Include `primaryMetric` (total shown), `secondaryMetric` (total confirmed).
   - Track `lastActivity` (timestamp of last modal shown).
   - Optional `message` for danger modal count.
8. **Style Injection**
   - Auto-inject global CSS styles on module initialization.
   - Check for existing `#confirmation-modal-styles` to avoid duplicates.
   - Include animations (fadeIn, slideIn), responsive layout, danger mode styling.
9. **Accessibility**
   - Ensure confirm button receives focus after render.
   - Provide accessible close button with aria-label.
   - Escape key always cancels modal.
   - Overlay click cancels modal (click outside to dismiss).
10. **Cleanup Discipline**
    - Call `closeModal()` to remove overlay from DOM.
    - Remove event listeners (especially Escape key) to prevent memory leaks.
    - Reset `activeModal` reference.

### 4. Usage Patterns
- **Destructive Actions**: deleting files, overwriting blueprints, resetting state.
- **Privilege Escalation**: enabling WebRTC swarm, switching to hypervisor personas.
- **Billing/Risk**: executing high-cost API calls.

### 5. Verification Checklist
- [ ] Modal blocks background scrolling (overlay intercepts events).
- [ ] Screen readers describe title/message.
- [ ] Danger mode visually distinct.
- [ ] Multiple rapid invocations do not leak elements or listeners.
- [ ] Confirm resolves within 200ms on user action.

The confirmation modal is a safety net. Treat modifications to its behavior as security-impacting changes and update this blueprint alongside UX adjustments.
