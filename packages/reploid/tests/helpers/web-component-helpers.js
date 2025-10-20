/**
 * @fileoverview Test Helpers for Web Components
 * Utilities for testing Web Component widgets in Vitest with happy-dom
 *
 * @module WebComponentHelpers
 * @version 1.0.0
 */

/**
 * Mount a web component with mocked module API
 *
 * @param {string} elementName - Custom element tag name (e.g., 'tool-runner-widget')
 * @param {Object} moduleApi - Mocked module API object
 * @param {Object} options - Optional configuration
 * @param {boolean} options.attachToDOM - Whether to attach to document.body (default: true)
 * @param {number} options.updateInterval - Update interval for the widget
 * @returns {HTMLElement} The mounted widget element
 *
 * @example
 * const widget = mountWidget('tool-runner-widget', mockApi);
 * expect(widget.shadowRoot).toBeDefined();
 */
export function mountWidget(elementName, moduleApi, options = {}) {
  const { attachToDOM = true, updateInterval = null } = options;

  // Check if custom element is defined
  if (!customElements.get(elementName)) {
    throw new Error(`Custom element '${elementName}' is not defined. Make sure the module is imported.`);
  }

  // Create widget instance
  const element = document.createElement(elementName);

  // Set update interval if provided
  if (updateInterval !== null) {
    element.updateInterval = updateInterval;
  }

  // Inject module API
  if (moduleApi) {
    element.moduleApi = moduleApi;
  }

  // Attach to DOM if requested
  if (attachToDOM) {
    document.body.appendChild(element);
  }

  return element;
}

/**
 * Unmount a widget from the DOM
 *
 * @param {HTMLElement} element - The widget element to unmount
 */
export function unmountWidget(element) {
  if (element && element.parentNode) {
    element.parentNode.removeChild(element);
  }
}

/**
 * Wait for shadow DOM to render
 * Uses microtask queue to ensure render completes
 *
 * @param {HTMLElement} element - The widget element
 * @returns {Promise<void>}
 */
export async function waitForRender(element) {
  // Wait for next microtask to allow render to complete
  await new Promise(resolve => setTimeout(resolve, 0));

  // Additional wait if element has update interval
  if (element.updateInterval) {
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

/**
 * Query an element within shadow DOM
 *
 * @param {HTMLElement} element - The widget element with shadow DOM
 * @param {string} selector - CSS selector to query
 * @returns {HTMLElement|null} The matched element or null
 *
 * @example
 * const button = queryShadow(widget, '#clear-history');
 * expect(button).toBeTruthy();
 */
export function queryShadow(element, selector) {
  if (!element.shadowRoot) {
    throw new Error('Element does not have shadow DOM');
  }
  return element.shadowRoot.querySelector(selector);
}

/**
 * Query all elements within shadow DOM
 *
 * @param {HTMLElement} element - The widget element with shadow DOM
 * @param {string} selector - CSS selector to query
 * @returns {NodeList} All matched elements
 */
export function queryShadowAll(element, selector) {
  if (!element.shadowRoot) {
    throw new Error('Element does not have shadow DOM');
  }
  return element.shadowRoot.querySelectorAll(selector);
}

/**
 * Get text content from shadow DOM element
 *
 * @param {HTMLElement} element - The widget element with shadow DOM
 * @param {string} selector - CSS selector to query
 * @returns {string|null} Text content or null if not found
 */
export function getTextContent(element, selector) {
  const target = queryShadow(element, selector);
  return target ? target.textContent.trim() : null;
}

/**
 * Click a button within shadow DOM
 *
 * @param {HTMLElement} element - The widget element with shadow DOM
 * @param {string} selector - CSS selector for the button
 * @returns {boolean} True if button was found and clicked
 */
export function clickShadowButton(element, selector) {
  const button = queryShadow(element, selector);
  if (button) {
    button.click();
    return true;
  }
  return false;
}

/**
 * Wait for an element to appear in shadow DOM
 *
 * @param {HTMLElement} element - The widget element with shadow DOM
 * @param {string} selector - CSS selector to query
 * @param {Object} options - Options
 * @param {number} options.timeout - Timeout in ms (default: 1000)
 * @param {number} options.interval - Poll interval in ms (default: 50)
 * @returns {Promise<HTMLElement>} The found element
 * @throws {Error} If element not found within timeout
 */
export async function waitForShadowElement(element, selector, options = {}) {
  const { timeout = 1000, interval = 50 } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const target = queryShadow(element, selector);
    if (target) {
      return target;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  throw new Error(`Element '${selector}' not found in shadow DOM within ${timeout}ms`);
}

/**
 * Mock EventBus for widget testing
 *
 * @returns {Object} Mocked EventBus with spies
 */
export function createMockEventBus() {
  const listeners = new Map();

  return {
    emit: vi.fn((event, data) => {
      const handlers = listeners.get(event) || [];
      handlers.forEach(handler => handler(data));
    }),

    on: vi.fn((event, handler, context) => {
      if (!listeners.has(event)) {
        listeners.set(event, []);
      }
      listeners.get(event).push(handler);
    }),

    off: vi.fn((event, handler) => {
      const handlers = listeners.get(event) || [];
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }),

    once: vi.fn((event, handler) => {
      const wrappedHandler = (data) => {
        handler(data);
        this.off(event, wrappedHandler);
      };
      this.on(event, wrappedHandler);
    }),

    // Utility to trigger events manually in tests
    _trigger: (event, data) => {
      const handlers = listeners.get(event) || [];
      handlers.forEach(handler => handler(data));
    },

    // Utility to get all listeners for an event
    _getListeners: (event) => {
      return listeners.get(event) || [];
    }
  };
}

/**
 * Setup global mocks for widget testing
 * Call this in beforeEach for widgets that need DI container
 *
 * @param {Object} mocks - Object with mocked modules
 * @returns {Object} The DI container mock
 */
export function setupGlobalMocks(mocks = {}) {
  const defaultMocks = {
    EventBus: createMockEventBus(),
    ToastNotifications: {
      show: vi.fn()
    },
    ...mocks
  };

  // Create DI container mock
  global.window = global.window || {};
  global.window.DIContainer = {
    resolve: vi.fn((moduleName) => {
      if (defaultMocks[moduleName]) {
        return defaultMocks[moduleName];
      }
      throw new Error(`Module '${moduleName}' not found in DI container mock`);
    }),
    register: vi.fn(),
    has: vi.fn((moduleName) => moduleName in defaultMocks)
  };

  return global.window.DIContainer;
}

/**
 * Cleanup global mocks
 * Call this in afterEach
 */
export function cleanupGlobalMocks() {
  if (global.window && global.window.DIContainer) {
    delete global.window.DIContainer;
  }
}

/**
 * Assert widget status matches expected values
 *
 * @param {HTMLElement} widget - The widget element
 * @param {Object} expected - Expected status properties
 * @param {string} expected.state - Expected state ('active', 'idle', 'error', etc.)
 * @param {string} expected.primaryMetric - Expected primary metric
 * @param {string} expected.secondaryMetric - Expected secondary metric
 */
export function assertWidgetStatus(widget, expected) {
  if (!widget.getStatus) {
    throw new Error('Widget does not implement getStatus() method');
  }

  const status = widget.getStatus();

  if (expected.state !== undefined) {
    expect(status.state).toBe(expected.state);
  }

  if (expected.primaryMetric !== undefined) {
    expect(status.primaryMetric).toContain(expected.primaryMetric);
  }

  if (expected.secondaryMetric !== undefined) {
    expect(status.secondaryMetric).toContain(expected.secondaryMetric);
  }

  if (expected.lastActivity !== undefined) {
    expect(status.lastActivity).toBe(expected.lastActivity);
  }

  if (expected.message !== undefined) {
    if (expected.message === null) {
      expect(status.message).toBeNull();
    } else {
      expect(status.message).toContain(expected.message);
    }
  }
}

/**
 * Trigger EventBus event and wait for widget to update
 *
 * @param {HTMLElement} widget - The widget element
 * @param {string} event - Event name
 * @param {*} data - Event data
 */
export async function triggerEventBusUpdate(widget, event, data) {
  // Get EventBus from global mock
  const eventBus = global.window?.DIContainer?.resolve('EventBus');

  if (!eventBus || !eventBus._trigger) {
    throw new Error('EventBus mock not found. Call setupGlobalMocks() first.');
  }

  // Trigger event
  eventBus._trigger(event, data);

  // Wait for render
  await waitForRender(widget);
}

/**
 * Test that widget properly cleans up on disconnect
 *
 * @param {HTMLElement} widget - The widget element
 * @param {Function} setupFn - Function to set up the widget before disconnect
 * @returns {Promise<void>}
 */
export async function testWidgetCleanup(widget, setupFn = null) {
  // Setup if provided
  if (setupFn) {
    await setupFn(widget);
  }

  // Spy on disconnectedCallback
  const spy = vi.spyOn(widget, 'disconnectedCallback');

  // Disconnect
  unmountWidget(widget);

  // Verify cleanup was called
  expect(spy).toHaveBeenCalled();

  // Check that intervals are cleared (if any)
  if (widget._interval) {
    expect(widget._interval).toBeUndefined();
  }
}

// Re-export vitest for convenience
export { vi, expect, describe, it, beforeEach, afterEach } from 'vitest';
