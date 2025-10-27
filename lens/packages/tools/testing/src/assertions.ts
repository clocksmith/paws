/**
 * Custom assertions for MWP widget testing
 */

import type { MockEventBus, MockMCPBridge } from './mocks.js';

/**
 * Assert that a widget has rendered successfully
 */
export function expectWidgetToRender(widget: HTMLElement): void {
  if (!widget.shadowRoot) {
    throw new Error('Widget has no shadow root - did it initialize?');
  }

  if (!widget.shadowRoot.innerHTML) {
    throw new Error('Widget shadow root is empty - did it render?');
  }
}

/**
 * Assert that an event was emitted
 */
export function expectEventEmitted(
  eventBus: MockEventBus,
  eventName: string,
  data?: any
): void {
  const events = eventBus.getEmittedEvents(eventName);

  if (events.length === 0) {
    throw new Error(`Expected event '${eventName}' to be emitted, but it was not`);
  }

  if (data !== undefined) {
    const matchingEvent = events.find(
      e => JSON.stringify(e.data) === JSON.stringify(data)
    );

    if (!matchingEvent) {
      throw new Error(
        `Expected event '${eventName}' with data ${JSON.stringify(data)}, ` +
        `but received: ${JSON.stringify(events.map(e => e.data))}`
      );
    }
  }
}

/**
 * Assert that an event was NOT emitted
 */
export function expectEventNotEmitted(
  eventBus: MockEventBus,
  eventName: string
): void {
  const events = eventBus.getEmittedEvents(eventName);

  if (events.length > 0) {
    throw new Error(
      `Expected event '${eventName}' NOT to be emitted, ` +
      `but it was emitted ${events.length} time(s)`
    );
  }
}

/**
 * Assert that a tool was called
 */
export function expectToolCalled(
  bridge: MockMCPBridge,
  serverName: string,
  toolName: string,
  args?: any
): void {
  const wasCalled = bridge.wasToolCalled(serverName, toolName, args);

  if (!wasCalled) {
    const calls = bridge.getCalledTools();
    const relevantCalls = calls.filter(c => c.toolName === toolName);

    if (relevantCalls.length === 0) {
      throw new Error(
        `Expected tool '${toolName}' to be called on server '${serverName}', but it was not. ` +
        `Called tools: ${calls.map(c => c.toolName).join(', ') || 'none'}`
      );
    }

    if (args !== undefined) {
      throw new Error(
        `Expected tool '${toolName}' to be called with args ${JSON.stringify(args)}, ` +
        `but received: ${JSON.stringify(relevantCalls.map(c => c.args))}`
      );
    }
  }
}

/**
 * Assert that a tool was NOT called
 */
export function expectToolNotCalled(
  bridge: MockMCPBridge,
  serverName: string,
  toolName: string
): void {
  const wasCalled = bridge.wasToolCalled(serverName, toolName);

  if (wasCalled) {
    const calls = bridge.getCalledTools(toolName);
    throw new Error(
      `Expected tool '${toolName}' NOT to be called, ` +
      `but it was called ${calls.length} time(s)`
    );
  }
}

/**
 * Assert that a widget has specific status
 */
export function expectWidgetStatus(
  widget: any,
  expectedStatus: 'healthy' | 'error' | 'initializing'
): void {
  if (!('getStatus' in widget)) {
    throw new Error('Widget does not implement getStatus() method');
  }

  const status = widget.getStatus();

  if (status.status !== expectedStatus) {
    throw new Error(
      `Expected widget status to be '${expectedStatus}', ` +
      `but got '${status.status}' with message: ${status.message}`
    );
  }
}

/**
 * Assert that widget shadow root contains text
 */
export function expectShadowToContain(widget: HTMLElement, text: string): void {
  if (!widget.shadowRoot) {
    throw new Error('Widget has no shadow root');
  }

  const content = widget.shadowRoot.textContent || '';

  if (!content.includes(text)) {
    throw new Error(
      `Expected shadow root to contain '${text}', ` +
      `but content was: ${content.substring(0, 100)}...`
    );
  }
}

/**
 * Assert that widget shadow root does NOT contain text
 */
export function expectShadowNotToContain(widget: HTMLElement, text: string): void {
  if (!widget.shadowRoot) {
    throw new Error('Widget has no shadow root');
  }

  const content = widget.shadowRoot.textContent || '';

  if (content.includes(text)) {
    throw new Error(
      `Expected shadow root NOT to contain '${text}', but it does`
    );
  }
}

/**
 * Assert that element exists in shadow root
 */
export function expectShadowElementToExist(
  widget: HTMLElement,
  selector: string
): void {
  if (!widget.shadowRoot) {
    throw new Error('Widget has no shadow root');
  }

  const element = widget.shadowRoot.querySelector(selector);

  if (!element) {
    throw new Error(
      `Expected element with selector '${selector}' to exist in shadow root, but it does not`
    );
  }
}

/**
 * Assert that element does NOT exist in shadow root
 */
export function expectShadowElementNotToExist(
  widget: HTMLElement,
  selector: string
): void {
  if (!widget.shadowRoot) {
    return; // No shadow root means element doesn't exist
  }

  const element = widget.shadowRoot.querySelector(selector);

  if (element) {
    throw new Error(
      `Expected element with selector '${selector}' NOT to exist in shadow root, but it does`
    );
  }
}

/**
 * Assert that widget has error state
 */
export function expectWidgetError(widget: any, expectedMessage?: string): void {
  expectWidgetStatus(widget, 'error');

  if (expectedMessage) {
    const status = widget.getStatus();
    if (!status.message.includes(expectedMessage)) {
      throw new Error(
        `Expected error message to contain '${expectedMessage}', ` +
        `but got: ${status.message}`
      );
    }
  }
}

/**
 * Assert that widget is loading
 */
export function expectWidgetLoading(widget: any): void {
  expectWidgetStatus(widget, 'initializing');
}

/**
 * Assert that widget is healthy
 */
export function expectWidgetHealthy(widget: any): void {
  expectWidgetStatus(widget, 'healthy');
}

/**
 * Assert that event count matches
 */
export function expectEventCount(
  eventBus: MockEventBus,
  eventName: string,
  expectedCount: number
): void {
  const events = eventBus.getEmittedEvents(eventName);

  if (events.length !== expectedCount) {
    throw new Error(
      `Expected ${expectedCount} '${eventName}' event(s), ` +
      `but got ${events.length}`
    );
  }
}

/**
 * Assert that tool call count matches
 */
export function expectToolCallCount(
  bridge: MockMCPBridge,
  toolName: string,
  expectedCount: number
): void {
  const calls = bridge.getCalledTools(toolName);

  if (calls.length !== expectedCount) {
    throw new Error(
      `Expected tool '${toolName}' to be called ${expectedCount} time(s), ` +
      `but it was called ${calls.length} time(s)`
    );
  }
}
