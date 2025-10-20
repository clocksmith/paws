# Blueprint Update Guide

> **📊 Back to Source of Truth:** [WEB_COMPONENTS_MIGRATION_TRACKER.md](./WEB_COMPONENTS_MIGRATION_TRACKER.md)

This guide explains **how to update a blueprint** after converting a module to use Web Components.

**⚠️ CRITICAL: Blueprints MUST be updated to match current implementation. Sentinel Agent uses blueprints for knowledge foundation.**

**When to Update**: Whenever an upgrade's implementation changes significantly, update its corresponding blueprint to reflect the new approach.

---

## Update Process (4 Steps)

### 1. Locate the Blueprint

Use `BLUEPRINTS_UPGRADES_MAPPING.md` to find the blueprint for your upgrade:
- Example: `storage-localstorage.js` → Blueprint `0x000004`
- Blueprint file: `blueprints/0x000004-default-storage-backend-localstorage.md`

### 2. Update "The Architectural Solution" (Section 2)

Modify the code examples and architectural description to match the new Web Components implementation.

**BEFORE (OLD PATTERN):**
```markdown
## Section 2: The Architectural Solution

The widget uses HTML string concatenation for rendering:

\`\`\`javascript
const widget = {
  renderPanel: (container) => {
    container.innerHTML = \`
      <div class="storage-panel">
        <h3>Storage Backend</h3>
        <div>Items: \${getItemCount()}</div>
      </div>
    \`;
  },

  getStatus: () => ({
    state: 'idle',
    primaryMetric: \`\${getItemCount()} items\`
  }),

  updateInterval: 5000
};
\`\`\`
```

**AFTER (WEB COMPONENT PATTERN):**
```markdown
## Section 2: The Architectural Solution

The widget uses a Web Component with Shadow DOM for encapsulated rendering:

\`\`\`javascript
class StorageWidget extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    this._interval = setInterval(() => this.render(), 5000);
  }

  disconnectedCallback() {
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
    }
  }

  getStatus() {
    return {
      state: 'idle',
      primaryMetric: \`\${getItemCount()} items\`,
      secondaryMetric: 'Ready',
      lastActivity: null,
      message: null
    };
  }

  render() {
    this.shadowRoot.innerHTML = \`
      <style>
        :host { display: block; }
        .storage-panel { padding: 16px; }
      </style>
      <div class="storage-panel">
        <h3>Storage Backend</h3>
        <div>Items: \${getItemCount()}</div>
      </div>
    \`;
  }
}

customElements.define('storage-widget', StorageWidget);

const widget = {
  element: 'storage-widget',
  displayName: 'Storage Backend',
  icon: '💾',
  category: 'storage'
};
\`\`\`

**Key architectural improvements:**
- Shadow DOM provides style encapsulation
- Lifecycle methods ensure proper cleanup
- Closure access to module state eliminates injection complexity
```

### 3. Update "The Implementation Pathway" (Section 3)

Revise the step-by-step instructions to reflect the Web Components approach.

**BEFORE (OLD STEPS):**
```markdown
## Section 3: The Implementation Pathway

1. Create widget object with renderPanel method
2. Implement HTML string concatenation for UI
3. Add getStatus() method to widget object
4. Set updateInterval for auto-refresh
5. Return widget from factory function
```

**AFTER (WEB COMPONENT STEPS):**
```markdown
## Section 3: The Implementation Pathway

1. **Define Web Component class** extending HTMLElement inside factory function
2. **Add Shadow DOM** using \`attachShadow({ mode: 'open' })\` in constructor
3. **Implement lifecycle methods**:
   - \`connectedCallback()\`: Initial render and auto-refresh setup
   - \`disconnectedCallback()\`: Clean up intervals to prevent memory leaks
4. **Implement getStatus()** as class method with closure access to module state
5. **Implement getControls()** as class method for interactive elements (if applicable)
6. **Implement render()** method:
   - Set \`this.shadowRoot.innerHTML\` with encapsulated styles
   - Use template literals for dynamic content
   - Include \`<style>\` tag with \`:host\` selector
7. **Register custom element**:
   - Use kebab-case naming: \`module-name-widget\`
   - Add duplicate check: \`if (!customElements.get(...))\`
   - Call \`customElements.define(elementName, WidgetClass)\`
8. **Return widget object** with new format:
   - \`{ element: elementName, displayName, icon, category }\`
   - Remove \`renderPanel\`, \`getStatus\`, \`getControls\`, \`updateInterval\`
9. **Test** Shadow DOM rendering and lifecycle cleanup
```

### 4. Preserve Blueprint Structure

**⚠️ CRITICAL: DO NOT CHANGE:**

- ✅ Blueprint ID (e.g., `0x000004`) - Used for knowledge graph navigation
- ✅ File name (e.g., `0x000004-default-storage-backend-localstorage.md`)
- ✅ Target Upgrade field (e.g., `LSTR`) - Module identifier
- ✅ Core objective statement - Fundamental goal of the module
- ✅ Prerequisites list - Dependencies required
- ✅ Blueprint header section - Metadata fields

**✏️ UPDATE:**

- Section 2: Architectural Solution (implementation details)
- Section 3: Implementation Pathway (how-to steps)
- Code examples throughout
- Terminology (HTML string widget → Web Component)
- Method references (renderPanel → render)

**WHY**: Blueprint IDs and structure are used by Sentinel Agent for knowledge graph navigation. Changing them breaks the knowledge foundation.

---

## Web Components Update Checklist

When updating a blueprint for Web Components:

### Code Pattern Updates
- [ ] Replace \`renderPanel: (container) => { ... }\` with Web Component class
- [ ] Show \`class ModuleWidget extends HTMLElement\`
- [ ] Show Shadow DOM: \`this.attachShadow({ mode: 'open' })\`
- [ ] Show \`connectedCallback()\` implementation
- [ ] Show \`disconnectedCallback()\` with cleanup
- [ ] Move \`getStatus()\` to class method
- [ ] Move \`getControls()\` to class method (if applicable)
- [ ] Show closure access pattern for module state
- [ ] Show custom element registration: \`customElements.define(...)\`
- [ ] Update widget return: \`{ element: 'tag-name', displayName, icon, category }\`

### Style & CSS Updates
- [ ] Show Shadow DOM \`<style>\` tags
- [ ] Show \`:host\` selector usage
- [ ] Remove global CSS examples (now encapsulated)
- [ ] Show CSS class naming conventions

### Lifecycle & Cleanup
- [ ] Document auto-refresh in \`connectedCallback()\`
- [ ] Document cleanup in \`disconnectedCallback()\`
- [ ] Show interval clearing: \`clearInterval(this._interval)\`
- [ ] Remove \`updateInterval\` from widget object

### Architecture Changes
- [ ] Update architecture diagrams (if any reference widgets)
- [ ] Update terminology (HTML string → Web Component)
- [ ] Update method references (renderPanel → render)
- [ ] Add note about Shadow DOM encapsulation benefits

### Implementation Pathway
- [ ] Rewrite steps to reflect new order of operations
- [ ] Update code snippets in each step
- [ ] Add step for custom element registration check
- [ ] Add step for testing Shadow DOM rendering

### Testing References
- [ ] Link to WEB_COMPONENTS_TESTING_GUIDE.md
- [ ] Update testing examples to use Shadow DOM queries
- [ ] Reference \`queryShadow()\` helper functions
- [ ] Show lifecycle testing patterns

---

## Common Mistakes

### ❌ Mistake 1: Leaving Old Code Examples

**Problem:** Blueprint still shows OLD_PATTERN after conversion.

```markdown
## Example Implementation

\`\`\`javascript
// ❌ This is the OLD pattern - should be removed!
const widget = {
  renderPanel: (container) => {
    container.innerHTML = '<div>...</div>';
  }
};
\`\`\`
```

**Solution:** Update ALL code examples to show Web Components, or clearly mark deprecated patterns.

---

### ❌ Mistake 2: Partial Pattern Updates

**Problem:** Shows Web Component class but still references old widget object.

**Solution:** Update the ENTIRE flow from class definition through registration to widget return.

---

### ❌ Mistake 3: Missing Closure Access Explanation

**Problem:** Blueprint shows Web Component but doesn't explain state access.

**Solution:** Add explicit explanation:

```markdown
## Accessing Module State

The Web Component class is defined INSIDE the factory function, giving it closure access to module state:

\`\`\`javascript
factory: (deps) => {
  // Module state (private)
  let items = [];

  class Widget extends HTMLElement {
    getStatus() {
      // ✅ Direct access to 'items' via closure
      return {
        state: 'idle',
        primaryMetric: \`\${items.length} items\`,
        secondaryMetric: 'Ready',
        lastActivity: null,
        message: null
      };
    }
  }

  return { api, widget };
}
\`\`\`

This pattern eliminates the need for property injection (.moduleApi setter).
```

---

### ❌ Mistake 4: Forgetting Element Registration

**Problem:** Blueprint shows class definition but not registration.

**Solution:** ALWAYS include:

```javascript
// Define the class
class MyWidget extends HTMLElement { ... }

// ✅ Register (with duplicate check)
const elementName = 'my-widget';
if (!customElements.get(elementName)) {
  customElements.define(elementName, MyWidget);
}
```

---

### ❌ Mistake 5: Not Updating Step Order

**Problem:** Section 3 still lists "Create renderPanel method" as a step.

**Solution:** Completely rewrite the Implementation Pathway steps to match the new pattern order.

---

## Verification

After updating a blueprint:

1. ✅ Section 2 shows Web Component class (not renderPanel)
2. ✅ Section 3 steps match Web Component lifecycle
3. ✅ All code examples use Shadow DOM
4. ✅ No references to \`renderPanel:\` or \`updateInterval\` in widget object
5. ✅ Shows \`customElements.define()\` registration
6. ✅ Shows closure access pattern
7. ✅ Blueprint ID and file name unchanged
8. ✅ Core objective statement preserved

Run verification: `grep -i "renderPanel" blueprints/0x*.md` on the specific blueprint should return no results in code examples.

---

## Quick Reference: Old → New Terminology

| Old Pattern | New Pattern | Notes |
|-------------|-------------|-------|
| \`renderPanel(container)\` | \`render()\` | Now sets \`shadowRoot.innerHTML\` |
| \`widget.updateInterval\` | Internal to \`connectedCallback()\` | No longer in widget object |
| \`widget.getStatus()\` | Class method \`getStatus()\` | Accesses state via closure |
| \`widget.getControls()\` | Class method \`getControls()\` | Returns action buttons |
| Inline styles | Shadow DOM \`<style>\` | Fully encapsulated |
| \`container.innerHTML = ...\` | \`this.shadowRoot.innerHTML = ...\` | Shadow DOM target |
| Global CSS classes | \`:host\` and scoped classes | No leakage |
| Return widget object | Return \`{ element: 'tag' }\` | Element name, not functions |

---

## Why This Matters

Blueprints are the **knowledge foundation** for the Sentinel Agent's RSI cycles. When the agent reads a blueprint, it must see the CURRENT implementation approach, not outdated patterns. This ensures the agent proposes changes that align with the existing codebase architecture.

**Rule**: Keep blueprints synchronized with their upgrades to maintain knowledge consistency.

---

**Last Updated**: 2025-10-19
**Status**: AUTHORITATIVE - Follow for all blueprint updates after Web Components conversion
