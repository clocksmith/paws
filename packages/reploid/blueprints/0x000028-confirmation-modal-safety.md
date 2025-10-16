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

### 2. Architectural Overview
`ConfirmationModal` exposes a single async API:

```javascript
const confirmed = await ConfirmationModal.confirm({
  title: 'Delete Blueprint',
  message: 'Remove 0x000010 from the knowledge base?',
  confirmText: 'Delete',
  cancelText: 'Keep',
  danger: true,
  details: 'This cannot be undone.'
});
```

Key mechanics:
- **Singleton Modal**: only one modal may exist; new requests close the existing instance.
- **Dynamic DOM Injection**: builds overlay + dialog markup at call time.
- **Event Wiring**: attaches click handlers, Escape key listener, overlay dismissal, and focus management.
- **Promise Resolution**: resolves `true` on confirm, `false` on cancel or overlay close.
- **Style Injection**: lazily injects CSS if missing to avoid duplicate styles.

### 3. Implementation Pathway
1. **Invocation Flow**
   - UI surfaces (VFS Explorer, Tool Runner, persona actions) call `ConfirmationModal.confirm`.
   - Provide descriptive copy—avoid generic “Are you sure?” messages.
2. **Accessibility Guarantees**
   - Ensure confirm button receives focus after render.
   - Provide `aria-label`s and maintain keyboard navigation.
   - Escape key must always cancel.
3. **Danger Mode**
   - `danger: true` applies red styling and warns the user; reserve for irreversible operations.
   - Pair with toast notifications summarising the final action result.
4. **Integration with Event Bus**
   - Emit `ui:confirmation_shown` and `ui:confirmation_result` events so analytics can track user decisions (optional extension).
5. **Cleanup Discipline**
   - Always call `closeModal()` when the prompt resolves.
   - Remove event listeners to prevent memory leaks.

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
