import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import AgentCycleStructured from '../../upgrades/agent-cycle-structured.js';

describe('AgentCycleStructured', () => {
  let instance;
  let mockDeps;

  beforeEach(() => {
    mockDeps = {
      HybridLLMProvider: {
        complete: vi.fn().mockResolvedValue({ text: '{}' })
      },
      ContextManager: {
        getRelevantContext: vi.fn().mockResolvedValue('mock context')
      },
      EventBus: {
        emit: vi.fn(),
        on: vi.fn(),
        off: vi.fn()
      },
      Utils: {
        logger: {
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn()
        }
      }
    };

    instance = AgentCycleStructured.factory(mockDeps);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Module API', () => {
    it('should have correct metadata', () => {
      expect(AgentCycleStructured.metadata.id).toBe('AgentCycleStructured');
      expect(AgentCycleStructured.metadata.type).toBe('service');
      expect(AgentCycleStructured.metadata.dependencies).toContain('HybridLLMProvider');
      expect(AgentCycleStructured.metadata.dependencies).toContain('ContextManager');
    });

    it('should return api and widget', () => {
      expect(instance.api).toBeDefined();
      expect(instance.api.executeStructuredCycle).toBeDefined();
      expect(instance.api.getCurrentCycle).toBeDefined();
      expect(instance.api.getCycleHistory).toBeDefined();
      expect(instance.widget).toBeDefined();
    });

    it('should execute structured cycle', async () => {
      mockDeps.HybridLLMProvider.complete.mockResolvedValue({
        text: JSON.stringify({
          persona: 'default',
          context_summary: 'test summary',
          confidence: 0.8
        })
      });

      const result = await instance.api.executeStructuredCycle('Test goal');

      expect(result).toBeDefined();
      expect(result.step8).toBeDefined();
      expect(mockDeps.HybridLLMProvider.complete).toHaveBeenCalled();
      expect(mockDeps.EventBus.emit).toHaveBeenCalledWith(
        'cycle:structured:complete',
        expect.any(Object)
      );
    });

    it('should track cycle history', async () => {
      mockDeps.HybridLLMProvider.complete.mockResolvedValue({
        text: JSON.stringify({ persona: 'default', confidence: 0.8 })
      });

      await instance.api.executeStructuredCycle('Test goal');

      const history = instance.api.getCycleHistory();
      expect(history).toHaveLength(1);
      expect(history[0].goal).toBe('Test goal');
    });
  });

  describe('AgentCycleStructuredWidget Web Component', () => {
    let widget;

    beforeEach(() => {
      document.body.innerHTML = '';
      expect(customElements.get('agent-cycle-structured-widget')).toBeDefined();
      widget = document.createElement('agent-cycle-structured-widget');
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

    it('should render loading state without API', () => {
      document.body.appendChild(widget);

      const content = widget.shadowRoot.textContent;
      expect(content).toContain('Structured Agent Cycle');
    });

    it('should implement getStatus() correctly', () => {
      widget.moduleApi = instance.api;

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

    it('should show idle state when no cycle running', () => {
      widget.moduleApi = instance.api;

      const status = widget.getStatus();
      expect(status.state).toBe('idle');
      expect(status.primaryMetric).toBe('Idle');
    });

    it('should auto-refresh with interval', () => {
      widget.moduleApi = instance.api;
      document.body.appendChild(widget);

      expect(widget._interval).toBeDefined();
    });

    it('should clean up interval on disconnect', () => {
      widget.moduleApi = instance.api;
      document.body.appendChild(widget);

      expect(widget._interval).toBeDefined();

      document.body.removeChild(widget);

      expect(widget._interval).toBeUndefined();
    });
  });
});
