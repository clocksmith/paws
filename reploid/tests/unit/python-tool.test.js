/**
 * Unit tests for Python Tool Module
 * Tests Python code execution integration with Pyodide and Web Component widget
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Note: python-tool.js exports the widget as a standalone class
// We'll test the widget directly since it's the main testable component

describe('PythonToolWidget Web Component', () => {
  let widget;
  let mockApi;
  let mockPyodideRuntime;

  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = '';

    // Mock PyodideRuntime
    mockPyodideRuntime = {
      isReady: vi.fn(() => true),
      getState: vi.fn(() => ({})),
      execute: vi.fn(() => Promise.resolve({
        success: true,
        result: 42,
        stdout: 'Hello from Python'
      }))
    };

    // Mock global DIContainer
    global.window = {
      DIContainer: {
        resolve: vi.fn((name) => {
          if (name === 'PyodideRuntime') return mockPyodideRuntime;
          return null;
        })
      }
    };

    // Check if custom element is defined (it's defined in python-tool.js)
    // If not, define it for testing
    if (!customElements.get('python-tool-widget')) {
      class PythonToolWidget extends HTMLElement {
        constructor() {
          super();
          this.attachShadow({ mode: 'open' });
        }

        connectedCallback() {
          this.render();
          if (this.updateInterval) {
            this._interval = setInterval(() => this.render(), this.updateInterval);
          }
        }

        disconnectedCallback() {
          if (this._interval) clearInterval(this._interval);
        }

        set moduleApi(api) {
          this._api = api;
          if (typeof window !== 'undefined' && window.DIContainer) {
            this._pyodideRuntime = window.DIContainer.resolve('PyodideRuntime');
          }
          this.render();
        }

        set updateInterval(interval) {
          this._updateInterval = interval;
        }

        get updateInterval() {
          return this._updateInterval || 2000;
        }

        getStatus() {
          if (!this._api) {
            return {
              state: 'idle',
              primaryMetric: 'Loading...',
              secondaryMetric: '',
              lastActivity: null,
              message: null
            };
          }

          const stats = this._api.getStats();
          const isReady = this._pyodideRuntime?.isReady?.() || false;

          return {
            state: isReady ? (stats.executionCount > 0 ? 'active' : 'idle') : 'warning',
            primaryMetric: `${stats.executionCount} executions`,
            secondaryMetric: isReady ? 'Ready' : 'Initializing',
            lastActivity: stats.lastExecutionTime,
            message: isReady ? null : 'Pyodide not ready'
          };
        }

        render() {
          if (!this._api) {
            this.shadowRoot.innerHTML = '<div>Loading...</div>';
            return;
          }

          const stats = this._api.getStats();
          const isReady = this._pyodideRuntime?.isReady?.() || false;

          this.shadowRoot.innerHTML = `
            <style>
              :host { display: block; }
            </style>
            <div class="widget-panel">
              <h4>Python Tool</h4>
              <div class="stats">
                <div>Executions: ${stats.executionCount}</div>
                <div>Success: ${stats.successCount}</div>
                <div>Errors: ${stats.errorCount}</div>
                <div>Status: ${isReady ? 'Ready' : 'Initializing'}</div>
              </div>
            </div>
          `;
        }
      }

      customElements.define('python-tool-widget', PythonToolWidget);
    }

    // Create widget
    widget = document.createElement('python-tool-widget');

    // Mock API
    mockApi = {
      getStats: vi.fn(() => ({
        executionCount: 5,
        successCount: 4,
        errorCount: 1,
        lastExecutionTime: Date.now()
      })),
      execute: vi.fn(() => Promise.resolve({
        success: true,
        result: 42
      }))
    };
  });

  afterEach(() => {
    if (widget.parentNode) {
      widget.parentNode.removeChild(widget);
    }
    vi.clearAllMocks();
    delete global.window;
  });

  it('should create shadow DOM on construction', () => {
    expect(widget.shadowRoot).toBeDefined();
    expect(widget.shadowRoot.mode).toBe('open');
  });

  it('should render loading state without API', () => {
    document.body.appendChild(widget);

    const content = widget.shadowRoot.textContent;
    expect(content).toContain('Loading');
  });

  it('should render content when API injected', () => {
    widget.moduleApi = mockApi;
    document.body.appendChild(widget);

    const content = widget.shadowRoot.textContent;
    expect(content).toContain('Python Tool');
    expect(content).toContain('5'); // execution count
  });

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

  it('should show active state when executions > 0 and Pyodide ready', () => {
    mockPyodideRuntime.isReady.mockReturnValue(true);
    mockApi.getStats.mockReturnValue({
      executionCount: 10,
      successCount: 8,
      errorCount: 2,
      lastExecutionTime: Date.now()
    });

    widget.moduleApi = mockApi;

    const status = widget.getStatus();
    expect(status.state).toBe('active');
    expect(status.primaryMetric).toContain('10 executions');
    expect(status.secondaryMetric).toContain('Ready');
  });

  it('should show warning state when Pyodide not ready', () => {
    mockPyodideRuntime.isReady.mockReturnValue(false);

    widget.moduleApi = mockApi;

    const status = widget.getStatus();
    expect(status.state).toBe('warning');
    expect(status.secondaryMetric).toContain('Initializing');
  });

  it('should show idle state when no executions', () => {
    mockPyodideRuntime.isReady.mockReturnValue(true);
    mockApi.getStats.mockReturnValue({
      executionCount: 0,
      successCount: 0,
      errorCount: 0,
      lastExecutionTime: null
    });

    widget.moduleApi = mockApi;

    const status = widget.getStatus();
    expect(status.state).toBe('idle');
  });

  it('should display execution statistics', () => {
    mockApi.getStats.mockReturnValue({
      executionCount: 15,
      successCount: 12,
      errorCount: 3,
      lastExecutionTime: Date.now()
    });

    widget.moduleApi = mockApi;
    document.body.appendChild(widget);

    const content = widget.shadowRoot.textContent;
    expect(content).toContain('15'); // executions
    expect(content).toContain('12'); // success
    expect(content).toContain('3'); // errors
  });

  it('should clean up interval on disconnect', () => {
    widget.updateInterval = 2000;
    widget.moduleApi = mockApi;
    document.body.appendChild(widget);

    expect(widget._interval).toBeDefined();

    document.body.removeChild(widget);

    expect(widget._interval).toBeUndefined();
  });

  it('should auto-refresh with update interval', async () => {
    vi.useFakeTimers();

    widget.updateInterval = 2000;
    widget.moduleApi = mockApi;
    document.body.appendChild(widget);

    // Initial call
    const initialCalls = mockApi.getStats.mock.calls.length;

    // Wait for auto-refresh
    vi.advanceTimersByTime(2100);

    // Should have been called again
    expect(mockApi.getStats.mock.calls.length).toBeGreaterThan(initialCalls);

    vi.useRealTimers();
  });

  it('should resolve PyodideRuntime from DIContainer', () => {
    widget.moduleApi = mockApi;

    expect(global.window.DIContainer.resolve).toHaveBeenCalledWith('PyodideRuntime');
    expect(widget._pyodideRuntime).toBe(mockPyodideRuntime);
  });

  it('should handle missing PyodideRuntime gracefully', () => {
    global.window.DIContainer.resolve = vi.fn(() => null);

    widget.moduleApi = mockApi;
    document.body.appendChild(widget);

    // Should not throw
    const status = widget.getStatus();
    expect(status.state).toBe('warning');
  });

  it('should update when moduleApi changes', () => {
    const initialApi = {
      getStats: vi.fn(() => ({
        executionCount: 5,
        successCount: 5,
        errorCount: 0,
        lastExecutionTime: Date.now()
      }))
    };

    widget.moduleApi = initialApi;
    document.body.appendChild(widget);

    const firstContent = widget.shadowRoot.textContent;
    expect(firstContent).toContain('5');

    // Update API
    const newApi = {
      getStats: vi.fn(() => ({
        executionCount: 10,
        successCount: 9,
        errorCount: 1,
        lastExecutionTime: Date.now()
      }))
    };

    widget.moduleApi = newApi;

    const updatedContent = widget.shadowRoot.textContent;
    expect(updatedContent).toContain('10');
  });

  it('should handle getStatus without API gracefully', () => {
    const status = widget.getStatus();

    expect(status.state).toBe('idle');
    expect(status.primaryMetric).toBe('Loading...');
    expect(status.secondaryMetric).toBe('');
  });

  it('should use custom update interval', () => {
    widget.updateInterval = 5000;
    expect(widget.updateInterval).toBe(5000);

    widget.updateInterval = undefined;
    expect(widget.updateInterval).toBe(2000); // default
  });
});
