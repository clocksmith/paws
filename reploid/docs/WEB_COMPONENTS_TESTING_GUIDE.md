# Web Components Testing Guide

> **📊 Back to Source of Truth:** [WEB_COMPONENTS_MIGRATION_TRACKER.md](./WEB_COMPONENTS_MIGRATION_TRACKER.md)

This guide explains **how to test Web Component widgets** that have been migrated from the old widget pattern to the new Web Components pattern.

---

## Quick Start

### 1. Import Test Helpers

Add the test helpers import at the top of your test file:

```javascript
import {
  mountWidget,
  unmountWidget,
  waitForRender,
  queryShadow,
  queryShadowAll,
  getTextContent,
  clickShadowButton
} from '../helpers/web-component-helpers.js';
```

### 2. Add Widget Test Suite

At the end of your existing test file (before the closing `});`), add a new describe block:

```javascript
describe('[ModuleName]Widget Web Component', () => {
  let widget;
  let mockApi;

  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = '';

    // Verify custom element is defined
    expect(customElements.get('module-name-widget')).toBeDefined();

    // Create widget instance
    widget = document.createElement('module-name-widget');

    // Mock API (customize based on your module)
    mockApi = {
      getState: vi.fn(() => ({ /* mock state */ })),
      someMethod: vi.fn()
    };
  });

  afterEach(() => {
    if (widget.parentNode) {
      widget.parentNode.removeChild(widget);
    }
  });

  // Add tests here (see sections below)
});
```

---

## Test Patterns

### Pattern 1: Shadow DOM Creation

**What to test:** Verify the widget creates shadow DOM on construction.

```javascript
it('should create shadow DOM on construction', () => {
  expect(widget.shadowRoot).toBeDefined();
  expect(widget.shadowRoot.mode).toBe('open');
});
```

---

### Pattern 2: Loading State

**What to test:** Widget shows "Loading..." when no API is injected.

```javascript
it('should render loading state without API', () => {
  document.body.appendChild(widget);

  const content = widget.shadowRoot.innerHTML;
  expect(content).toContain('Loading');
});
```

---

### Pattern 3: API Injection & Rendering

**What to test:** Widget renders correctly when module API is injected.

```javascript
it('should render content when API injected', async () => {
  widget.moduleApi = mockApi;
  document.body.appendChild(widget);

  // Wait for render
  await waitForRender(widget);

  const content = widget.shadowRoot.textContent;
  expect(content).toContain('Expected Content');
});
```

---

### Pattern 4: getStatus() Method

**What to test:** Widget implements getStatus() and returns correct structure.

```javascript
it('should implement getStatus() correctly', () => {
  widget.moduleApi = mockApi;

  const status = widget.getStatus();

  // All 5 required fields
  expect(status).toHaveProperty('state');
  expect(status).toHaveProperty('primaryMetric');
  expect(status).toHaveProperty('secondaryMetric');
  expect(status).toHaveProperty('lastActivity');
  expect(status).toHaveProperty('message');

  // Validate state value
  const validStates = ['idle', 'active', 'error', 'warning', 'disabled'];
  expect(validStates).toContain(status.state);

  // Validate metric types
  expect(typeof status.primaryMetric).toBe('string');
  expect(typeof status.secondaryMetric).toBe('string');
});
```

**Common states:**
- `'idle'` - Module loaded but not active
- `'active'` - Module actively processing
- `'error'` - Module has errors
- `'warning'` - Module has warnings
- `'disabled'` - Module is disabled

---

### Pattern 4b: getControls() Method (REQUIRED FOR INTERACTIVE WIDGETS)

**What to test:** Widget implements getControls() and returns correct structure.

```javascript
it('should implement getControls() correctly', () => {
  widget.moduleApi = mockApi;

  const controls = widget.getControls();

  // Verify it returns an array
  expect(Array.isArray(controls)).toBe(true);

  // Verify each control has required fields
  controls.forEach(control => {
    expect(control).toHaveProperty('id');
    expect(control).toHaveProperty('label');
    expect(control).toHaveProperty('action');
    expect(typeof control.action).toBe('function');
  });
});
```

**Test control actions:**

```javascript
it('should execute control actions correctly', () => {
  widget.moduleApi = mockApi;

  const controls = widget.getControls();
  const resetControl = controls.find(c => c.id === 'reset');

  expect(resetControl).toBeDefined();

  // Execute the action
  const result = resetControl.action();

  // Verify return value
  expect(result).toHaveProperty('success');
  expect(result.success).toBe(true);
  expect(result).toHaveProperty('message');

  // Verify API was called
  expect(mockApi.reset).toHaveBeenCalled();
});
```

**Test async control actions:**

```javascript
it('should handle async control actions', async () => {
  mockApi.performAsyncOperation = vi.fn(() =>
    Promise.resolve({ success: true })
  );

  widget.moduleApi = mockApi;

  const controls = widget.getControls();
  const asyncControl = controls.find(c => c.id === 'async-operation');

  // Execute async action
  const result = await asyncControl.action();

  expect(result.success).toBe(true);
  expect(mockApi.performAsyncOperation).toHaveBeenCalled();
});
```

**Test conditional controls:**

```javascript
it('should show different controls based on state', () => {
  // Test idle state
  mockApi.getState.mockReturnValue({ isActive: false });
  widget.moduleApi = mockApi;

  let controls = widget.getControls();
  expect(controls.find(c => c.id === 'start')).toBeDefined();
  expect(controls.find(c => c.id === 'stop')).toBeUndefined();

  // Test active state
  mockApi.getState.mockReturnValue({ isActive: true });
  widget.moduleApi = mockApi;

  controls = widget.getControls();
  expect(controls.find(c => c.id === 'start')).toBeUndefined();
  expect(controls.find(c => c.id === 'stop')).toBeDefined();
});
```

---

### Pattern 5: State-Based Rendering

**What to test:** Widget displays different content based on module state.

```javascript
it('should report active state when processing', () => {
  mockApi.getState.mockReturnValue({
    isProcessing: true,
    itemCount: 5
  });

  widget.moduleApi = mockApi;

  const status = widget.getStatus();
  expect(status.state).toBe('active');
  expect(status.primaryMetric).toContain('5');
});

it('should report idle state when not processing', () => {
  mockApi.getState.mockReturnValue({
    isProcessing: false,
    itemCount: 0
  });

  widget.moduleApi = mockApi;

  const status = widget.getStatus();
  expect(status.state).toBe('idle');
});
```

---

### Pattern 6: Shadow DOM Queries

**What to test:** Specific UI elements exist in shadow DOM.

```javascript
it('should display stats grid', async () => {
  widget.moduleApi = mockApi;
  document.body.appendChild(widget);

  await waitForRender(widget);

  const statsGrid = queryShadow(widget, '.stats-grid');
  expect(statsGrid).toBeTruthy();

  const statCards = queryShadowAll(widget, '.stat-card');
  expect(statCards.length).toBeGreaterThan(0);
});
```

---

### Pattern 7: Button Interactions

**What to test:** Clicking buttons calls correct API methods.

```javascript
it('should call API method when button clicked', async () => {
  widget.moduleApi = mockApi;
  document.body.appendChild(widget);

  await waitForRender(widget);

  const button = queryShadow(widget, '#action-button');
  expect(button).toBeTruthy();

  button.click();

  expect(mockApi.someMethod).toHaveBeenCalled();
});
```

**Alternative using helper:**

```javascript
it('should call API method when button clicked', async () => {
  widget.moduleApi = mockApi;
  document.body.appendChild(widget);

  await waitForRender(widget);

  const clicked = clickShadowButton(widget, '#action-button');
  expect(clicked).toBe(true);
  expect(mockApi.someMethod).toHaveBeenCalled();
});
```

---

### Pattern 8: Auto-Refresh / Update Interval

**What to test:** Widget auto-refreshes at specified interval.

```javascript
it('should auto-refresh with update interval', async () => {
  widget.updateInterval = 100;
  widget.moduleApi = mockApi;
  document.body.appendChild(widget);

  // Initial call
  expect(mockApi.getState).toHaveBeenCalledTimes(1);

  // Wait for auto-refresh
  await new Promise(resolve => setTimeout(resolve, 150));

  // Should have been called again
  expect(mockApi.getState).toHaveBeenCalledTimes(2);
});
```

---

### Pattern 9: Lifecycle Cleanup

**What to test:** Widget cleans up intervals/listeners on disconnect.

```javascript
it('should clean up interval on disconnect', () => {
  widget.updateInterval = 100;
  widget.moduleApi = mockApi;
  document.body.appendChild(widget);

  expect(widget._interval).toBeDefined();

  document.body.removeChild(widget);

  expect(widget._interval).toBeUndefined();
});
```

---

### Pattern 10: EventBus Integration

**What to test:** Widget subscribes/unsubscribes from EventBus correctly.

```javascript
import { setupGlobalMocks, cleanupGlobalMocks } from '../helpers/web-component-helpers.js';

describe('EventBus Integration', () => {
  let mockEventBus;

  beforeEach(() => {
    setupGlobalMocks();
    mockEventBus = window.DIContainer.resolve('EventBus');
  });

  afterEach(() => {
    cleanupGlobalMocks();
  });

  it('should subscribe to EventBus on connect', () => {
    widget.moduleApi = mockApi;
    document.body.appendChild(widget);

    expect(mockEventBus.on).toHaveBeenCalledWith(
      'module:event',
      expect.any(Function),
      'WidgetName'
    );
  });

  it('should unsubscribe from EventBus on disconnect', () => {
    widget.moduleApi = mockApi;
    document.body.appendChild(widget);

    document.body.removeChild(widget);

    expect(mockEventBus.off).toHaveBeenCalledWith(
      'module:event',
      expect.any(Function)
    );
  });

  it('should re-render when EventBus event fires', async () => {
    widget.moduleApi = mockApi;
    document.body.appendChild(widget);

    await waitForRender(widget);

    const initialContent = widget.shadowRoot.textContent;

    // Trigger event
    mockEventBus._trigger('module:event', { data: 'updated' });

    await waitForRender(widget);

    const updatedContent = widget.shadowRoot.textContent;
    expect(updatedContent).not.toBe(initialContent);
  });
});
```

---

### Pattern 11: Error Handling

**What to test:** Widget handles missing/broken API gracefully.

```javascript
it('should handle missing API methods gracefully', () => {
  const brokenApi = {}; // Missing methods
  widget.moduleApi = brokenApi;

  const status = widget.getStatus();
  expect(status.state).toBe('idle');
  expect(status.primaryMetric).toBe('Loading...');
});

it('should handle API errors gracefully', async () => {
  mockApi.getState.mockImplementation(() => {
    throw new Error('API Error');
  });

  widget.moduleApi = mockApi;
  document.body.appendChild(widget);

  await waitForRender(widget);

  // Widget should not crash
  expect(widget.shadowRoot.innerHTML).toBeTruthy();
});
```

---

### Pattern 12: Dynamic Updates

**What to test:** Widget re-renders when API changes.

```javascript
it('should re-render when moduleApi changes', async () => {
  widget.moduleApi = mockApi;
  document.body.appendChild(widget);

  await waitForRender(widget);

  const firstContent = getTextContent(widget, '.primary-metric');
  expect(firstContent).toBe('Initial Value');

  // Update API
  const newApi = {
    getState: vi.fn(() => ({ value: 'Updated Value' }))
  };

  widget.moduleApi = newApi;

  await waitForRender(widget);

  const updatedContent = getTextContent(widget, '.primary-metric');
  expect(updatedContent).toBe('Updated Value');
});
```

---

## Complete Example

Here's a complete example for `browser-apis.test.js`:

```javascript
describe('BrowserAPIsWidget Web Component', () => {
  let widget;
  let mockApi;

  beforeEach(() => {
    document.body.innerHTML = '';
    expect(customElements.get('browser-apis-widget')).toBeDefined();
    widget = document.createElement('browser-apis-widget');

    mockApi = {
      getState: vi.fn(() => ({
        capabilities: {
          fileSystemAccess: true,
          notifications: true,
          clipboard: true,
          share: false,
          storage: true,
          wakeLock: true
        },
        fileSystemHandle: null,
        notificationPermission: 'default',
        operationStats: {
          filesWritten: 5,
          filesRead: 10,
          clipboardOperations: 3
        }
      })),
      requestDirectoryAccess: vi.fn(),
      requestNotificationPermission: vi.fn()
    };
  });

  afterEach(() => {
    unmountWidget(widget);
  });

  it('should create shadow DOM on construction', () => {
    expect(widget.shadowRoot).toBeDefined();
    expect(widget.shadowRoot.mode).toBe('open');
  });

  it('should render loading state without API', () => {
    document.body.appendChild(widget);
    expect(getTextContent(widget, 'div')).toContain('Loading');
  });

  it('should render capabilities when API injected', async () => {
    widget.moduleApi = mockApi;
    document.body.appendChild(widget);
    await waitForRender(widget);

    const content = widget.shadowRoot.textContent;
    expect(content).toContain('File System Access');
    expect(content).toContain('Notifications');
  });

  it('should implement getStatus() correctly', () => {
    widget.moduleApi = mockApi;

    const status = widget.getStatus();

    expect(status).toHaveProperty('state');
    expect(status.state).toBe('idle');
  });

  it('should show operation stats', async () => {
    widget.moduleApi = mockApi;
    document.body.appendChild(widget);
    await waitForRender(widget);

    const content = widget.shadowRoot.textContent;
    expect(content).toContain('5'); // filesWritten
    expect(content).toContain('10'); // filesRead
  });

  it('should call requestDirectoryAccess when button clicked', async () => {
    widget.moduleApi = mockApi;
    document.body.appendChild(widget);
    await waitForRender(widget);

    const clicked = clickShadowButton(widget, '#request-fs');
    expect(clicked).toBe(true);
    expect(mockApi.requestDirectoryAccess).toHaveBeenCalled();
  });
});
```

---

## Checklist for Widget Tests

Use this checklist when adding tests for a new widget:

- [ ] **Shadow DOM Creation** - Verifies shadow DOM is created
- [ ] **Loading State** - Verifies "Loading..." shown without API
- [ ] **API Injection** - Verifies rendering with API
- [ ] **getStatus() Method** - Verifies status object structure and ALL 5 required fields
- [ ] **getControls() Method** - Verifies controls array structure (REQUIRED for interactive widgets)
- [ ] **Control Actions** - Verifies control actions execute correctly
- [ ] **Async Controls** - Verifies async control actions work properly (if applicable)
- [ ] **Conditional Controls** - Verifies controls change based on state (if applicable)
- [ ] **State-Based Display** - Verifies different states ('active', 'idle', 'error')
- [ ] **Shadow DOM Content** - Verifies key UI elements exist
- [ ] **Button Interactions** - Verifies buttons call correct API methods
- [ ] **Auto-Refresh** - Verifies update interval works (if applicable)
- [ ] **Lifecycle Cleanup** - Verifies intervals cleared on disconnect
- [ ] **EventBus Integration** - Verifies subscribe/unsubscribe (if applicable)
- [ ] **Error Handling** - Verifies graceful degradation
- [ ] **Dynamic Updates** - Verifies re-render on API changes

---

## Common Pitfalls

### 1. Forgetting to wait for render

**Problem:**
```javascript
widget.moduleApi = mockApi;
document.body.appendChild(widget);

// ❌ WRONG - Tests immediately, before render completes
const element = queryShadow(widget, '.stat-value');
```

**Solution:**
```javascript
widget.moduleApi = mockApi;
document.body.appendChild(widget);

// ✅ CORRECT - Wait for render to complete
await waitForRender(widget);

const element = queryShadow(widget, '.stat-value');
```

---

### 2. Not cleaning up DOM

**Problem:**
```javascript
// ❌ WRONG - Widget stays in DOM between tests
afterEach(() => {
  // Nothing here
});
```

**Solution:**
```javascript
// ✅ CORRECT - Clean up after each test
afterEach(() => {
  if (widget.parentNode) {
    widget.parentNode.removeChild(widget);
  }
  // Or use helper:
  unmountWidget(widget);
});
```

---

### 3. Not resetting mocks

**Problem:**
```javascript
beforeEach(() => {
  mockApi = {
    getState: vi.fn(() => ({ count: 5 }))
  };
});

it('first test', () => {
  widget.moduleApi = mockApi;
  expect(mockApi.getState).toHaveBeenCalledTimes(1); // ✅ Passes
});

it('second test', () => {
  widget.moduleApi = mockApi;
  expect(mockApi.getState).toHaveBeenCalledTimes(1); // ❌ Fails - count is 2!
});
```

**Solution:**
```javascript
beforeEach(() => {
  vi.clearAllMocks(); // Clear all mock call counts

  mockApi = {
    getState: vi.fn(() => ({ count: 5 }))
  };
});
```

---

### 4. Testing implementation details

**Problem:**
```javascript
// ❌ WRONG - Testing internal rendering logic
it('should call render() method', () => {
  const spy = vi.spyOn(widget, 'render');
  widget.moduleApi = mockApi;
  expect(spy).toHaveBeenCalled();
});
```

**Solution:**
```javascript
// ✅ CORRECT - Test observable behavior
it('should display content when API injected', async () => {
  widget.moduleApi = mockApi;
  document.body.appendChild(widget);
  await waitForRender(widget);

  const content = widget.shadowRoot.textContent;
  expect(content).toContain('Expected Content');
});
```

---

## Running Tests

### Run all tests

```bash
npm test
```

### Run specific test file

```bash
npm test tool-runner.test.js
```

### Run in watch mode

```bash
npm run test:watch
```

### Run with coverage

```bash
npm run test:coverage
```

### Run only widget tests

```bash
npm test -- --grep "Widget Web Component"
```

---

## Test Coverage Goals

- ✅ **100% of migrated widgets** have test coverage
- ✅ **All lifecycle methods** (connectedCallback, disconnectedCallback) tested
- ✅ **All interactive elements** (buttons, forms) tested
- ✅ **All state variations** (active, idle, error) tested
- ✅ **EventBus integration** tested for widgets that use it
- ✅ **Overall project coverage** remains >60%

---

## Additional Resources

- **Test Helpers**: `/tests/helpers/web-component-helpers.js`
- **Vitest Docs**: https://vitest.dev/
- **Web Components Spec**: https://developer.mozilla.org/en-US/docs/Web/API/Web_components
- **Shadow DOM Testing**: https://developer.mozilla.org/en-US/docs/Web/API/ShadowRoot

---

**Last Updated**: 2025-10-19
**Status**: AUTHORITATIVE - Must be followed for all Web Component widget testing
**Critical Addition**: Pattern 4b (getControls testing) is REQUIRED for interactive widgets
