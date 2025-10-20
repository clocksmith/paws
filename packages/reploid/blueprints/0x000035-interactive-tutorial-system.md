# Blueprint 0x000035: Interactive Tutorial System

**Objective:** Outline the structure and lifecycle of the in-app tutorial engine that guides new operators through REPLOID.

**Target Upgrade:** TUTR (`tutorial-system.js`)

**Prerequisites:** 0x00000D (UI Manager), 0x000005 (State Management Architecture), 0x000031 (Toast Notification System)

**Affected Artifacts:** `/upgrades/tutorial-system.js`, `/styles/dashboard.css`, `/upgrades/event-bus.js`

---

### 1. The Strategic Imperative
REPLOID’s interface is dense with cognition panels and tooling. A guided tutorial:
- Shortens onboarding time.
- Encourages safe interaction (highlighting confirmation flows).
- Demonstrates RSI concepts (introspection, reflection) interactively.

### 2. Architectural Overview
`TutorialSystem` is a UI service built around predefined tutorial scripts.

```javascript
const Tutorial = await ModuleLoader.getModule('TutorialSystem');
Tutorial.start('first-time');
```

- **Tutorial Catalog**: `tutorials` object with scenarios (`first-time`, `advanced-features`, `self-modification`). Each step defines `title`, `content`, `target`, `placement`, `highlight`, and optional `preAction`.
- **State Variables**: `currentTutorial`, `currentStep`, `isActive`.
- **UI Elements**: overlay mask (`#tutorial-overlay`) and tooltip card (`#tutorial-tooltip`) inserted into DOM on demand.
- **Positioning Logic**: `positionTooltip` calculates placement relative to target element, auto-centering when no target.
- **Event Hooks**: `EventBus` can drive `preAction` (e.g., switching panels before focusing).
- **Navigation**: Steps call `nextStep()`, `prevStep()`, `completeTutorial()` to progress; completion resets state and stores progress in `StateManager`.

### 3. Implementation Pathway
1. **Initialization**
   - Call `createElements()` once to attach overlay/tooltip.
   - Optionally auto-start `first-time` tutorial when session metadata indicates new user.
2. **Starting a Tutorial**
   - `start(tutorialId)` loads script, marks state as active, renders first step.
   - Ensure tutorials pause existing overlay experiences (confirmation modals, etc.).
3. **Step Rendering**
   - Populate tooltip HTML (title, content, CTA buttons).
   - Highlight target element via CSS class (e.g., add glow/outline).
   - Position tooltip using bounding rectangles; clamp to viewport.
   - Provide skip/complete controls for impatient users.
4. **Persistence**
   - Save progress to `StateManager` (`tutorialProgress`) so repeated boots resume where needed or avoid rerunning.
5. **Accessibility**
   - Focus tooltip for screen readers; trap focus while tutorial active.
   - Provide keyboard navigation (Enter = next, Esc = exit).

### 4. Verification Checklist
- [ ] Starting tutorial with invalid ID logs warning and aborts gracefully.
- [ ] Overlay blocks background clicks while allowing tooltip interactions.
- [ ] Highlight removal occurs on step change/exit.
- [ ] `preAction` handlers execute before tooltip positions (e.g., switching panel).
- [ ] Completion stores state and emits `tutorial:completed` event.

### 5. Web Component Widget

The widget uses a Web Component with Shadow DOM for encapsulated rendering:

```javascript
class TutorialSystemWidget extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    // Auto-refresh every 2 seconds to track tutorial progress
    this._interval = setInterval(() => this.render(), 2000);
  }

  disconnectedCallback() {
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
    }
  }

  getStatus() {
    const availableTutorials = getAvailableTutorials();
    const completedCount = availableTutorials.filter(t => t.completed).length;
    const totalCount = availableTutorials.length;

    return {
      state: isActive ? 'active' : (completedCount > 0 ? 'idle' : 'disabled'),
      primaryMetric: isActive
        ? `Step ${currentStep + 1}/${currentTutorial.steps.length}`
        : `${completedCount}/${totalCount} completed`,
      secondaryMetric: isActive ? currentTutorial.name : 'Ready',
      lastActivity: tutorialStats.lastTutorial?.timestamp || null,
      message: isActive ? 'Tutorial active' : null
    };
  }

  getControls() {
    const controls = [];
    if (isActive) {
      controls.push({
        id: 'stop-tutorial',
        label: '⏹️ Stop Tutorial',
        action: () => {
          wrappedStop();
          return { success: true, message: 'Tutorial stopped' };
        }
      });
    }
    return controls;
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          font-family: monospace;
          font-size: 12px;
        }
        .tutorial-panel { padding: 12px; color: #fff; }
        .tutorial-card {
          background: rgba(255,255,255,0.05);
          padding: 12px;
          border-radius: 5px;
          margin-bottom: 10px;
        }
      </style>
      <div class="tutorial-panel">
        <h4>📚 Tutorial System</h4>
        ${isActive ? `
          <div class="active-tutorial">
            <h5>${currentTutorial.name}</h5>
            <p>Step ${currentStep + 1} of ${currentTutorial.steps.length}</p>
          </div>
        ` : `
          <div class="tutorial-list">
            <!-- Available tutorials -->
          </div>
        `}
      </div>
    `;
  }
}

// Register custom element
const elementName = 'tutorial-system-widget';
if (!customElements.get(elementName)) {
  customElements.define(elementName, TutorialSystemWidget);
}

const widget = {
  element: elementName,
  displayName: 'Tutorial System',
  icon: '📚',
  category: 'ui'
};
```

**Key features:**
- Displays tutorial progress and available tutorials
- Shows current step when tutorial is active
- Provides controls to stop active tutorials
- Auto-refresh to track progress changes
- Uses closure access to module state (isActive, currentTutorial, currentStep)
- Shadow DOM encapsulation for styling

### 6. Extension Opportunities
- Fetch tutorials dynamically from VFS so personas can customise onboarding.
- Add analytics to record which steps users replay or skip.
- Integrate with `ToastNotifications` to nudge users when tutorials recommended.
- Provide editor UI to author tutorials visually.

Keep this blueprint updated when expanding tutorial content, altering UI chrome, or integrating external onboarding content.
