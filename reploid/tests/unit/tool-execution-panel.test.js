import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import ToolExecutionPanel from '../../upgrades/tool-execution-panel.js';

describe('ToolExecutionPanel', () => {
  let instance;
  let mockDeps;
  let mockEventBus;

  beforeEach(() => {
    // Mock EventBus
    mockEventBus = {
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn()
    };

    mockDeps = {
      EventBus: mockEventBus,
      Utils: {
        logger: {
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn()
        }
      }
    };

    instance = ToolExecutionPanel.factory(mockDeps);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Module API', () => {
    it('should have correct metadata', () => {
      expect(ToolExecutionPanel.metadata.id).toBe('ToolExecutionPanel');
      expect(ToolExecutionPanel.metadata.type).toBe('ui');
      expect(ToolExecutionPanel.metadata.dependencies).toContain('EventBus');
      expect(ToolExecutionPanel.metadata.dependencies).toContain('Utils');
    });

    it('should return widget configuration', () => {
      expect(instance.widget).toBeDefined();
      expect(instance.widget.element).toBe('tool-execution-panel-widget');
      expect(instance.widget.displayName).toBe('Tool Execution Panel');
      expect(instance.widget.category).toBe('ui');
      expect(instance.widget.icon).toBe('⚒️');
    });

    it('should expose API methods', () => {
      expect(instance.api).toBeDefined();
      expect(typeof instance.api.init).toBe('function');
      expect(typeof instance.api.clear).toBe('function');
      expect(typeof instance.api.getExecutions).toBe('function');
      expect(typeof instance.api.renderPanel).toBe('function');
    });
  });

  describe('Event Handlers', () => {
    it('should register event handlers on init', () => {
      const container = document.createElement('div');
      instance.api.init(container);

      expect(mockEventBus.on).toHaveBeenCalledWith('tool:start', expect.any(Function));
      expect(mockEventBus.on).toHaveBeenCalledWith('tool:complete', expect.any(Function));
      expect(mockEventBus.on).toHaveBeenCalledWith('tool:error', expect.any(Function));
      expect(mockEventBus.on).toHaveBeenCalledWith('tool:progress', expect.any(Function));
      expect(mockEventBus.on).toHaveBeenCalledTimes(4);
    });
  });

  describe('Execution Tracking', () => {
    beforeEach(() => {
      const container = document.createElement('div');
      instance.api.init(container);
    });

    it('should start with empty executions', () => {
      const executions = instance.api.getExecutions();
      expect(Array.isArray(executions)).toBe(true);
      expect(executions.length).toBe(0);
    });

    it('should clear all executions', () => {
      // Simulate adding an execution
      const toolStartHandler = mockEventBus.on.mock.calls.find(call => call[0] === 'tool:start')[1];
      toolStartHandler({
        toolName: 'test_tool',
        args: { test: true },
        executionId: 'test-1'
      });

      expect(instance.api.getExecutions().length).toBe(1);

      instance.api.clear();

      expect(instance.api.getExecutions().length).toBe(0);
    });
  });

  describe('Tool Lifecycle Events', () => {
    let toolStartHandler;
    let toolCompleteHandler;
    let toolErrorHandler;
    let toolProgressHandler;

    beforeEach(() => {
      const container = document.createElement('div');
      instance.api.init(container);

      // Get handlers
      toolStartHandler = mockEventBus.on.mock.calls.find(call => call[0] === 'tool:start')[1];
      toolCompleteHandler = mockEventBus.on.mock.calls.find(call => call[0] === 'tool:complete')[1];
      toolErrorHandler = mockEventBus.on.mock.calls.find(call => call[0] === 'tool:error')[1];
      toolProgressHandler = mockEventBus.on.mock.calls.find(call => call[0] === 'tool:progress')[1];
    });

    it('should handle tool start event', () => {
      toolStartHandler({
        toolName: 'create_artifact',
        args: { path: '/test.js', content: 'console.log("test")' },
        executionId: 'exec-1'
      });

      const executions = instance.api.getExecutions();
      expect(executions.length).toBe(1);
      expect(executions[0].toolName).toBe('create_artifact');
      expect(executions[0].status).toBe('running');
      expect(executions[0].startTime).toBeDefined();
      expect(executions[0].progress).toBe(0);
    });

    it('should handle tool complete event', () => {
      // Start tool
      toolStartHandler({
        toolName: 'read_artifact',
        args: { path: '/test.js' },
        executionId: 'exec-2'
      });

      // Complete tool
      toolCompleteHandler({
        toolName: 'read_artifact',
        result: { content: 'file content' },
        executionId: 'exec-2'
      });

      const executions = instance.api.getExecutions();
      expect(executions.length).toBe(1);
      expect(executions[0].status).toBe('completed');
      expect(executions[0].endTime).toBeDefined();
      expect(executions[0].duration).toBeGreaterThanOrEqual(0);
      expect(executions[0].result).toEqual({ content: 'file content' });
      expect(executions[0].progress).toBe(100);
    });

    it('should handle tool error event', () => {
      // Start tool
      toolStartHandler({
        toolName: 'python_exec',
        args: { code: 'print("test")' },
        executionId: 'exec-3'
      });

      // Error in tool
      toolErrorHandler({
        toolName: 'python_exec',
        error: new Error('Pyodide not loaded'),
        executionId: 'exec-3'
      });

      const executions = instance.api.getExecutions();
      expect(executions.length).toBe(1);
      expect(executions[0].status).toBe('failed');
      expect(executions[0].endTime).toBeDefined();
      expect(executions[0].duration).toBeGreaterThanOrEqual(0);
      expect(executions[0].error).toBe('Pyodide not loaded');
    });

    it('should handle tool progress event', () => {
      // Start tool
      toolStartHandler({
        toolName: 'run_tests',
        args: { suite: 'unit' },
        executionId: 'exec-4'
      });

      // Update progress
      toolProgressHandler({
        toolName: 'run_tests',
        progress: 50,
        executionId: 'exec-4'
      });

      const executions = instance.api.getExecutions();
      expect(executions.length).toBe(1);
      expect(executions[0].progress).toBe(50);

      // Update progress again
      toolProgressHandler({
        toolName: 'run_tests',
        progress: 75,
        executionId: 'exec-4'
      });

      expect(instance.api.getExecutions()[0].progress).toBe(75);
    });

    it('should handle events without executionId', () => {
      // Start tool without executionId
      toolStartHandler({
        toolName: 'introspect',
        args: {}
      });

      let executions = instance.api.getExecutions();
      expect(executions.length).toBe(1);

      // Complete using toolName lookup
      toolCompleteHandler({
        toolName: 'introspect',
        result: { modules: [] }
      });

      executions = instance.api.getExecutions();
      expect(executions[0].status).toBe('completed');
    });

    it('should handle error for unknown tool', () => {
      toolCompleteHandler({
        toolName: 'unknown_tool',
        result: {},
        executionId: 'nonexistent'
      });

      expect(mockDeps.Utils.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('No execution found')
      );
    });

    it('should log when error occurs for unknown tool', () => {
      toolErrorHandler({
        toolName: 'unknown_tool',
        error: 'Some error',
        executionId: 'nonexistent'
      });

      expect(mockDeps.Utils.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('No execution found')
      );
    });
  });

  describe('ToolExecutionPanelWidget Web Component', () => {
    let widget;

    beforeEach(() => {
      document.body.innerHTML = '';
      expect(customElements.get('tool-execution-panel-widget')).toBeDefined();
      widget = document.createElement('tool-execution-panel-widget');

      // Initialize the panel
      const container = document.createElement('div');
      instance.api.init(container);
    });

    afterEach(() => {
      if (widget.parentNode) {
        widget.parentNode.removeChild(widget);
      }
    });

    it('should create shadow DOM on construction', () => {
      expect(widget.shadowRoot).toBeDefined();
      expect(widget.shadowRoot.mode).toBe('open');
    });

    it('should render panel statistics when connected', () => {
      document.body.appendChild(widget);

      const content = widget.shadowRoot.textContent;
      expect(content).toContain('Panel Statistics');
    });

    it('should implement getStatus() correctly', () => {
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

    it('should return active state when tools are running', () => {
      // Add a running tool
      const toolStartHandler = mockEventBus.on.mock.calls.find(call => call[0] === 'tool:start')[1];
      toolStartHandler({
        toolName: 'test_tool',
        args: {},
        executionId: 'test-1'
      });

      const status = widget.getStatus();
      expect(status.state).toBe('active');
      expect(status.secondaryMetric).toContain('running');
    });

    it('should return idle state when no tools are running', () => {
      const status = widget.getStatus();
      expect(status.state).toBe('idle');
      expect(status.secondaryMetric).toBe('Idle');
    });

    it('should show failed count in message when tools fail', () => {
      const toolStartHandler = mockEventBus.on.mock.calls.find(call => call[0] === 'tool:start')[1];
      const toolErrorHandler = mockEventBus.on.mock.calls.find(call => call[0] === 'tool:error')[1];

      // Start and fail a tool
      toolStartHandler({
        toolName: 'test_tool',
        args: {},
        executionId: 'test-fail'
      });

      toolErrorHandler({
        toolName: 'test_tool',
        error: 'Test error',
        executionId: 'test-fail'
      });

      const status = widget.getStatus();
      expect(status.message).toContain('failed');
    });

    it('should implement getControls() correctly', () => {
      const controls = widget.getControls();

      // Verify it returns an array
      expect(Array.isArray(controls)).toBe(true);
      expect(controls.length).toBeGreaterThan(0);

      // Verify each control has required fields
      controls.forEach(control => {
        expect(control).toHaveProperty('id');
        expect(control).toHaveProperty('label');
        expect(control).toHaveProperty('action');
        expect(typeof control.action).toBe('function');
      });
    });

    it('should have clear panel control', () => {
      const controls = widget.getControls();
      const clearControl = controls.find(c => c.id === 'clear-panel');

      expect(clearControl).toBeDefined();
      expect(clearControl.label).toMatch(/clear/i);
    });

    it('should execute clear control action', () => {
      // Add some executions first
      const toolStartHandler = mockEventBus.on.mock.calls.find(call => call[0] === 'tool:start')[1];
      toolStartHandler({
        toolName: 'test_tool',
        args: {},
        executionId: 'test-1'
      });

      expect(instance.api.getExecutions().length).toBe(1);

      const controls = widget.getControls();
      const clearControl = controls.find(c => c.id === 'clear-panel');
      const result = clearControl.action();

      expect(result).toHaveProperty('success');
      expect(result.success).toBe(true);
      expect(result).toHaveProperty('message');
      expect(instance.api.getExecutions().length).toBe(0);
    });

    it('should auto-refresh with interval', () => {
      document.body.appendChild(widget);

      expect(widget._interval).toBeDefined();
    });

    it('should clean up interval on disconnect', () => {
      document.body.appendChild(widget);

      expect(widget._interval).toBeDefined();

      document.body.removeChild(widget);

      expect(widget._interval).toBeNull();
    });

    it('should display running tools in widget', () => {
      const toolStartHandler = mockEventBus.on.mock.calls.find(call => call[0] === 'tool:start')[1];
      toolStartHandler({
        toolName: 'create_artifact',
        args: {},
        executionId: 'test-running'
      });

      document.body.appendChild(widget);

      const content = widget.shadowRoot.textContent;
      expect(content).toContain('Currently Running');
      expect(content).toContain('create_artifact');
    });

    it('should display failed tools in widget', () => {
      const toolStartHandler = mockEventBus.on.mock.calls.find(call => call[0] === 'tool:start')[1];
      const toolErrorHandler = mockEventBus.on.mock.calls.find(call => call[0] === 'tool:error')[1];

      toolStartHandler({
        toolName: 'test_tool',
        args: {},
        executionId: 'test-error'
      });

      toolErrorHandler({
        toolName: 'test_tool',
        error: 'Test error message',
        executionId: 'test-error'
      });

      document.body.appendChild(widget);

      const content = widget.shadowRoot.textContent;
      expect(content).toContain('Recent Failures');
      expect(content).toContain('test_tool');
    });

    it('should calculate and display statistics correctly', () => {
      const toolStartHandler = mockEventBus.on.mock.calls.find(call => call[0] === 'tool:start')[1];
      const toolCompleteHandler = mockEventBus.on.mock.calls.find(call => call[0] === 'tool:complete')[1];

      // Add multiple executions
      toolStartHandler({ toolName: 'tool1', args: {}, executionId: 'e1' });
      toolCompleteHandler({ toolName: 'tool1', result: {}, executionId: 'e1' });

      toolStartHandler({ toolName: 'tool2', args: {}, executionId: 'e2' });
      toolCompleteHandler({ toolName: 'tool2', result: {}, executionId: 'e2' });

      document.body.appendChild(widget);

      const content = widget.shadowRoot.textContent;
      expect(content).toContain('Execution Panel Info');
      expect(content).toContain('Success rate');
    });

    it('should re-render when moduleApi is set', () => {
      const renderSpy = vi.spyOn(widget, 'render');

      widget.moduleApi = { someApi: true };

      expect(widget._api).toEqual({ someApi: true });
      expect(renderSpy).toHaveBeenCalled();
    });

    it('should display top tools usage', () => {
      const toolStartHandler = mockEventBus.on.mock.calls.find(call => call[0] === 'tool:start')[1];

      // Add multiple executions of same tool
      toolStartHandler({ toolName: 'create_artifact', args: {}, executionId: 'e1' });
      toolStartHandler({ toolName: 'create_artifact', args: {}, executionId: 'e2' });
      toolStartHandler({ toolName: 'read_artifact', args: {}, executionId: 'e3' });

      document.body.appendChild(widget);

      const content = widget.shadowRoot.textContent;
      expect(content).toContain('Most Used Tools');
    });

    it('should show progress bar for running tools', () => {
      const toolStartHandler = mockEventBus.on.mock.calls.find(call => call[0] === 'tool:start')[1];
      const toolProgressHandler = mockEventBus.on.mock.calls.find(call => call[0] === 'tool:progress')[1];

      toolStartHandler({ toolName: 'run_tests', args: {}, executionId: 'progress-test' });
      toolProgressHandler({ toolName: 'run_tests', progress: 50, executionId: 'progress-test' });

      document.body.appendChild(widget);

      // Check for progress indicator in shadow DOM
      const shadowContent = widget.shadowRoot.innerHTML;
      expect(shadowContent).toContain('50%'); // Progress percentage
    });
  });

  describe('Execution History Management', () => {
    let toolStartHandler;
    let toolCompleteHandler;

    beforeEach(() => {
      const container = document.createElement('div');
      instance.api.init(container);

      toolStartHandler = mockEventBus.on.mock.calls.find(call => call[0] === 'tool:start')[1];
      toolCompleteHandler = mockEventBus.on.mock.calls.find(call => call[0] === 'tool:complete')[1];
    });

    it('should maintain execution history', () => {
      // Add multiple executions
      for (let i = 0; i < 5; i++) {
        toolStartHandler({
          toolName: `tool${i}`,
          args: {},
          executionId: `exec-${i}`
        });
        toolCompleteHandler({
          toolName: `tool${i}`,
          result: {},
          executionId: `exec-${i}`
        });
      }

      const executions = instance.api.getExecutions();
      expect(executions.length).toBe(5);
    });

    it('should track lastActivity timestamp', () => {
      const beforeTime = Date.now();

      toolStartHandler({
        toolName: 'test_tool',
        args: {},
        executionId: 'time-test'
      });

      const afterTime = Date.now();
      const executions = instance.api.getExecutions();

      expect(executions[0].startTime).toBeGreaterThanOrEqual(beforeTime);
      expect(executions[0].startTime).toBeLessThanOrEqual(afterTime);
    });
  });
});
