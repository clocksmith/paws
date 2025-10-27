/**
 * Test helpers for MWP widget testing
 */

import type { MCPServerInfo } from '@mwp/core';
import { createMockDependencies, type MockDependencies } from './mocks.js';
import { createMockServerInfo } from './fixtures.js';

/**
 * Options for mounting a widget
 */
export interface MountOptions {
  serverName?: string;
  serverInfo?: Partial<MCPServerInfo>;
  config?: Record<string, any>;
  bridgeDelay?: number;
  autoInitialize?: boolean;
}

/**
 * Mounted widget with mocks and container
 */
export interface MountedWidget<T = any> {
  widget: T;
  mocks: MockDependencies;
  container: HTMLElement;
  serverInfo: MCPServerInfo;
}

/**
 * Mount a widget with mock dependencies
 */
export async function mountWidget<T extends HTMLElement>(
  WidgetClass: new () => T,
  options: MountOptions = {}
): Promise<MountedWidget<T>> {
  // Create mocks
  const mocks = createMockDependencies({
    bridgeDelay: options.bridgeDelay,
    initialConfig: options.config,
  });

  // Create server info
  const serverInfo = createMockServerInfo({
    serverName: options.serverName || 'test-server',
    ...options.serverInfo,
  });

  // Create widget instance
  const widget = new WidgetClass();

  // Set dependencies (if method exists)
  if ('setDependencies' in widget && typeof (widget as any).setDependencies === 'function') {
    (widget as any).setDependencies(mocks.eventBus, mocks.mcpBridge, mocks.configuration);
  }

  // Set server info (if method exists)
  if ('setServerInfo' in widget && typeof (widget as any).setServerInfo === 'function') {
    (widget as any).setServerInfo(serverInfo);
  }

  // Create container and append widget
  const container = document.createElement('div');
  container.id = 'test-container';
  document.body.appendChild(container);
  container.appendChild(widget);

  // Initialize if auto-initialize is enabled (default: true)
  if (options.autoInitialize !== false) {
    if ('initialize' in widget && typeof (widget as any).initialize === 'function') {
      await (widget as any).initialize();
    }
  }

  return {
    widget,
    mocks,
    container,
    serverInfo,
  };
}

/**
 * Wait for widget to render
 */
export async function waitForRender(
  widget: HTMLElement,
  timeout = 1000
): Promise<void> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const checkRender = () => {
      if (widget.shadowRoot && widget.shadowRoot.innerHTML) {
        resolve();
        return;
      }

      if (Date.now() - startTime > timeout) {
        reject(new Error('Widget render timeout'));
        return;
      }

      requestAnimationFrame(checkRender);
    };

    checkRender();
  });
}

/**
 * Wait for a specific event to be emitted
 */
export async function waitForEvent(
  eventBus: any,
  eventName: string,
  timeout = 1000
): Promise<any> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Event '${eventName}' not emitted within ${timeout}ms`));
    }, timeout);

    const unsubscribe = eventBus.on(eventName, (data: any) => {
      clearTimeout(timeoutId);
      unsubscribe();
      resolve(data);
    });
  });
}

/**
 * Wait for a condition to be true
 */
export async function waitFor(
  condition: () => boolean,
  options: { timeout?: number; interval?: number } = {}
): Promise<void> {
  const timeout = options.timeout || 1000;
  const interval = options.interval || 10;
  const startTime = Date.now();

  return new Promise((resolve, reject) => {
    const check = () => {
      if (condition()) {
        resolve();
        return;
      }

      if (Date.now() - startTime > timeout) {
        reject(new Error('Condition timeout'));
        return;
      }

      setTimeout(check, interval);
    };

    check();
  });
}

/**
 * Simulate a user click on an element
 */
export function simulateClick(element: Element): void {
  const event = new MouseEvent('click', {
    bubbles: true,
    cancelable: true,
    view: window,
  });
  element.dispatchEvent(event);
}

/**
 * Simulate user input in a form field
 */
export function simulateInput(element: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  element.value = value;

  const inputEvent = new Event('input', {
    bubbles: true,
    cancelable: true,
  });
  element.dispatchEvent(inputEvent);

  const changeEvent = new Event('change', {
    bubbles: true,
    cancelable: true,
  });
  element.dispatchEvent(changeEvent);
}

/**
 * Simulate keyboard event
 */
export function simulateKeyboard(
  element: Element,
  key: string,
  options: { ctrlKey?: boolean; shiftKey?: boolean; altKey?: boolean } = {}
): void {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...options,
  });
  element.dispatchEvent(event);
}

/**
 * Query selector within shadow root
 */
export function queryShadow<T extends Element = Element>(
  widget: HTMLElement,
  selector: string
): T | null {
  return widget.shadowRoot?.querySelector<T>(selector) || null;
}

/**
 * Query all selectors within shadow root
 */
export function queryShadowAll<T extends Element = Element>(
  widget: HTMLElement,
  selector: string
): T[] {
  return Array.from(widget.shadowRoot?.querySelectorAll<T>(selector) || []);
}

/**
 * Get text content from shadow root
 */
export function getShadowText(widget: HTMLElement, selector?: string): string {
  if (selector) {
    const element = queryShadow(widget, selector);
    return element?.textContent?.trim() || '';
  }
  return widget.shadowRoot?.textContent?.trim() || '';
}

/**
 * Check if element is visible in shadow root
 */
export function isShadowElementVisible(widget: HTMLElement, selector: string): boolean {
  const element = queryShadow(widget, selector);
  if (!element) return false;

  const style = window.getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
}

/**
 * Wait for element to appear in shadow root
 */
export async function waitForShadowElement(
  widget: HTMLElement,
  selector: string,
  timeout = 1000
): Promise<Element> {
  const startTime = Date.now();

  return new Promise((resolve, reject) => {
    const check = () => {
      const element = queryShadow(widget, selector);
      if (element) {
        resolve(element);
        return;
      }

      if (Date.now() - startTime > timeout) {
        reject(new Error(`Element '${selector}' not found within ${timeout}ms`));
        return;
      }

      requestAnimationFrame(check);
    };

    check();
  });
}

/**
 * Cleanup test environment
 */
export function cleanup(): void {
  // Remove all test containers
  document.querySelectorAll('#test-container').forEach(el => el.remove());

  // Clear any custom elements
  const customElements = Array.from(document.querySelectorAll('*')).filter(el =>
    el.tagName.includes('-')
  );
  customElements.forEach(el => el.remove());
}

/**
 * Create a mock HTMLElement for testing
 */
export function createMockElement(tagName = 'div', attributes: Record<string, string> = {}): HTMLElement {
  const element = document.createElement(tagName);

  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, value);
  });

  return element;
}

/**
 * Flush all pending promises
 */
export async function flushPromises(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

/**
 * Advanced: Spy on a method
 */
export function spy<T extends (...args: any[]) => any>(
  obj: any,
  methodName: string
): { calls: any[][]; restore: () => void } {
  const originalMethod = obj[methodName];
  const calls: any[][] = [];

  obj[methodName] = function (...args: any[]) {
    calls.push(args);
    return originalMethod.apply(this, args);
  };

  return {
    calls,
    restore: () => {
      obj[methodName] = originalMethod;
    },
  };
}

/**
 * Advanced: Mock a method temporarily
 */
export function mock<T>(
  obj: any,
  methodName: string,
  implementation: T
): { restore: () => void } {
  const originalMethod = obj[methodName];

  obj[methodName] = implementation;

  return {
    restore: () => {
      obj[methodName] = originalMethod;
    },
  };
}
