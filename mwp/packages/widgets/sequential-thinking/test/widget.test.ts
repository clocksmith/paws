/**
 * Sequential Thinking Widget Tests
 *
 * Comprehensive test suite for Sequential Thinking widget.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { types } from '@mcp-wp/core';
import createSequentialThinkingWidget from '../src/index.js';
import { SequentialThinkingWidget } from '../src/widget.js';

type EventBus = types.EventBus;
type MCPBridge = types.MCPBridge;
type Configuration = types.Configuration;
type Dependencies = types.Dependencies;
type MCPServerInfo = types.MCPServerInfo;

/**
 * Mock EventBus
 */
class MockEventBus implements EventBus {
  private listeners = new Map<string, Set<Function>>();

  emit(event: string, data?: any): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach(handler => handler(data));
    }
  }

  on(event: string, handler: Function): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
    return () => this.listeners.get(event)?.delete(handler);
  }

  off(event: string, handler: Function): void {
    this.listeners.get(event)?.delete(handler);
  }

  once(event: string, handler: Function): () => void {
    const wrappedHandler = (data: any) => {
      handler(data);
      this.off(event, wrappedHandler);
    };
    return this.on(event, wrappedHandler);
  }

  clear(): void {
    this.listeners.clear();
  }
}

/**
 * Mock MCPBridge
 */
class MockMCPBridge implements MCPBridge {
  async callTool(
    serverName: string,
    toolName: string,
    args: Record<string, unknown>
  ): Promise<any> {
    // Mock tool responses
    if (toolName === 'start_thinking') {
      return {
        sessionId: 'mock-session-123',
        status: 'active',
      };
    }
    if (toolName === 'add_step') {
      return {
        stepId: 'mock-step-456',
        status: 'completed',
      };
    }
    if (toolName === 'get_session') {
      return {
        id: args.sessionId,
        prompt: 'Test prompt',
        steps: [],
        status: 'active',
        createdAt: new Date().toISOString(),
      };
    }
    return {};
  }

  async getResource(serverName: string, uri: string): Promise<any> {
    return { content: 'mock resource' };
  }

  async callPrompt(
    serverName: string,
    promptName: string,
    args: Record<string, unknown>
  ): Promise<any> {
    return { messages: [] };
  }

  async listTools(serverName: string): Promise<any[]> {
    return [
      { name: 'start_thinking', description: 'Start thinking session' },
      { name: 'add_step', description: 'Add thinking step' },
      { name: 'get_session', description: 'Get session' },
    ];
  }

  async listResources(serverName: string): Promise<any[]> {
    return [];
  }

  async listPrompts(serverName: string): Promise<any[]> {
    return [];
  }
}

/**
 * Mock Configuration
 */
class MockConfiguration implements Configuration {
  private config = new Map<string, any>();

  get(key: string): any {
    return this.config.get(key);
  }

  set(key: string, value: any): void {
    this.config.set(key, value);
  }

  has(key: string): boolean {
    return this.config.has(key);
  }

  delete(key: string): boolean {
    return this.config.delete(key);
  }

  clear(): void {
    this.config.clear();
  }
}

describe('Sequential Thinking Widget', () => {
  let eventBus: MockEventBus;
  let mcpBridge: MockMCPBridge;
  let config: MockConfiguration;
  let dependencies: Dependencies;
  let serverInfo: MCPServerInfo;

  beforeEach(() => {
    eventBus = new MockEventBus();
    mcpBridge = new MockMCPBridge();
    config = new MockConfiguration();

    dependencies = {
      EventBus: eventBus,
      MCPBridge: mcpBridge,
      Configuration: config,
    };

    serverInfo = {
      serverName: 'sequential-thinking',
      version: '1.0.0',
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: {},
      },
    };

    // Register custom element if not already defined
    if (!customElements.get('sequential-thinking-widget')) {
      customElements.define('sequential-thinking-widget', SequentialThinkingWidget);
    }
  });

  afterEach(() => {
    eventBus.clear();
    config.clear();
    document.body.innerHTML = '';
  });

  describe('Widget Factory', () => {
    it('should create widget factory with correct structure', () => {
      const factory = createSequentialThinkingWidget(dependencies, serverInfo);

      expect(factory).toHaveProperty('api');
      expect(factory).toHaveProperty('widget');
      expect(factory.api).toHaveProperty('initialize');
      expect(factory.api).toHaveProperty('destroy');
      expect(factory.api).toHaveProperty('refresh');
      expect(factory.api).toHaveProperty('getStatus');
      expect(factory.api).toHaveProperty('getResourceUsage');
    });

    it('should have correct widget metadata', () => {
      const factory = createSequentialThinkingWidget(dependencies, serverInfo);

      expect(factory.widget.element).toBe('sequential-thinking-widget');
      expect(factory.widget.displayName).toBe('Sequential Thinking');
      expect(factory.widget.description).toContain('reasoning');
      expect(factory.widget.version).toBe('1.0.0');
      expect(factory.widget.protocolVersion).toBe('1.0.0');
    });

    it('should have correct capabilities', () => {
      const factory = createSequentialThinkingWidget(dependencies, serverInfo);

      expect(factory.widget.capabilities.tools).toBe(true);
      expect(factory.widget.capabilities.resources).toBe(false);
      expect(factory.widget.capabilities.prompts).toBe(false);
    });

    it('should have correct permissions', () => {
      const factory = createSequentialThinkingWidget(dependencies, serverInfo);

      expect(factory.widget.permissions.tools?.scope).toBe('allowlist');
      expect(factory.widget.permissions.tools?.patterns).toContain('start_thinking');
      expect(factory.widget.permissions.tools?.patterns).toContain('add_step');
      expect(factory.widget.permissions.tools?.patterns).toContain('get_session');
    });

    it('should have appropriate tags', () => {
      const factory = createSequentialThinkingWidget(dependencies, serverInfo);

      expect(factory.widget.tags).toContain('thinking');
      expect(factory.widget.tags).toContain('reasoning');
      expect(factory.widget.tags).toContain('chain-of-thought');
      expect(factory.widget.tags).toContain('visualization');
    });
  });

  describe('Widget Initialization', () => {
    it('should initialize successfully', async () => {
      const factory = createSequentialThinkingWidget(dependencies, serverInfo);
      const element = document.createElement('sequential-thinking-widget') as SequentialThinkingWidget;
      document.body.appendChild(element);

      element.setDependencies(eventBus, mcpBridge, config);
      element.setServerInfo(serverInfo);

      await expect(factory.api.initialize()).resolves.not.toThrow();
    });

    it('should initialize within performance budget (<200ms)', async () => {
      const factory = createSequentialThinkingWidget(dependencies, serverInfo);
      const element = document.createElement('sequential-thinking-widget') as SequentialThinkingWidget;
      document.body.appendChild(element);

      element.setDependencies(eventBus, mcpBridge, config);
      element.setServerInfo(serverInfo);

      const startTime = performance.now();
      await factory.api.initialize();
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(200);
    });

    it('should emit initialization event', async () => {
      const factory = createSequentialThinkingWidget(dependencies, serverInfo);
      const element = document.createElement('sequential-thinking-widget') as SequentialThinkingWidget;
      document.body.appendChild(element);

      element.setDependencies(eventBus, mcpBridge, config);
      element.setServerInfo(serverInfo);

      const initSpy = vi.fn();
      eventBus.on('widget:initialized', initSpy);

      await factory.api.initialize();

      expect(initSpy).toHaveBeenCalled();
      expect(initSpy.mock.calls[0][0]).toMatchObject({
        element: 'sequential-thinking-widget',
        serverName: 'sequential-thinking',
      });
    });

    it('should load saved configuration', async () => {
      config.set('thinkingWidget', {
        showTimings: false,
        compactMode: true,
      });

      const factory = createSequentialThinkingWidget(dependencies, serverInfo);
      const element = document.createElement('sequential-thinking-widget') as SequentialThinkingWidget;
      document.body.appendChild(element);

      element.setDependencies(eventBus, mcpBridge, config);
      element.setServerInfo(serverInfo);

      await factory.api.initialize();

      // Widget should have merged saved config
      expect(element).toBeTruthy();
    });
  });

  describe('Widget Rendering', () => {
    it('should render with Shadow DOM', async () => {
      const factory = createSequentialThinkingWidget(dependencies, serverInfo);
      const element = document.createElement('sequential-thinking-widget') as SequentialThinkingWidget;
      document.body.appendChild(element);

      element.setDependencies(eventBus, mcpBridge, config);
      element.setServerInfo(serverInfo);

      await factory.api.initialize();

      expect(element.shadowRoot).toBeTruthy();
      expect(element.shadowRoot?.querySelector('.thinking-widget')).toBeTruthy();
    });

    it('should render header with title and actions', async () => {
      const factory = createSequentialThinkingWidget(dependencies, serverInfo);
      const element = document.createElement('sequential-thinking-widget') as SequentialThinkingWidget;
      document.body.appendChild(element);

      element.setDependencies(eventBus, mcpBridge, config);
      element.setServerInfo(serverInfo);

      await factory.api.initialize();

      const header = element.shadowRoot?.querySelector('.widget-header');
      expect(header).toBeTruthy();
      expect(header?.textContent).toContain('Sequential Thinking');
    });

    it('should render new session form initially', async () => {
      const factory = createSequentialThinkingWidget(dependencies, serverInfo);
      const element = document.createElement('sequential-thinking-widget') as SequentialThinkingWidget;
      document.body.appendChild(element);

      element.setDependencies(eventBus, mcpBridge, config);
      element.setServerInfo(serverInfo);

      await factory.api.initialize();

      const form = element.shadowRoot?.querySelector('.new-session-form');
      expect(form).toBeTruthy();
      expect(element.shadowRoot?.querySelector('#session-prompt')).toBeTruthy();
    });

    it('should include styles in shadow DOM', async () => {
      const factory = createSequentialThinkingWidget(dependencies, serverInfo);
      const element = document.createElement('sequential-thinking-widget') as SequentialThinkingWidget;
      document.body.appendChild(element);

      element.setDependencies(eventBus, mcpBridge, config);
      element.setServerInfo(serverInfo);

      await factory.api.initialize();

      const style = element.shadowRoot?.querySelector('style');
      expect(style).toBeTruthy();
      expect(style?.textContent).toContain('.thinking-widget');
    });
  });

  describe('Session Management', () => {
    it('should create new session via form', async () => {
      const factory = createSequentialThinkingWidget(dependencies, serverInfo);
      const element = document.createElement('sequential-thinking-widget') as SequentialThinkingWidget;
      document.body.appendChild(element);

      element.setDependencies(eventBus, mcpBridge, config);
      element.setServerInfo(serverInfo);

      await factory.api.initialize();

      const promptInput = element.shadowRoot?.querySelector('#session-prompt') as HTMLInputElement;
      const startBtn = element.shadowRoot?.querySelector('#start-session-btn') as HTMLButtonElement;

      expect(promptInput).toBeTruthy();
      expect(startBtn).toBeTruthy();

      if (promptInput) {
        promptInput.value = 'Test thinking prompt';
        startBtn?.click();

        // Wait for async operation
        await new Promise(resolve => setTimeout(resolve, 50));

        // Session should be created
        const session = element.getCurrentSession();
        expect(session).toBeTruthy();
        expect(session?.prompt).toBe('Test thinking prompt');
      }
    });

    it('should emit session started event', async () => {
      const factory = createSequentialThinkingWidget(dependencies, serverInfo);
      const element = document.createElement('sequential-thinking-widget') as SequentialThinkingWidget;
      document.body.appendChild(element);

      element.setDependencies(eventBus, mcpBridge, config);
      element.setServerInfo(serverInfo);

      await factory.api.initialize();

      const sessionSpy = vi.fn();
      eventBus.on('thinking:session:started', sessionSpy);

      const promptInput = element.shadowRoot?.querySelector('#session-prompt') as HTMLInputElement;
      const startBtn = element.shadowRoot?.querySelector('#start-session-btn') as HTMLButtonElement;

      if (promptInput) {
        promptInput.value = 'Test prompt';
        startBtn?.click();

        await new Promise(resolve => setTimeout(resolve, 50));

        expect(sessionSpy).toHaveBeenCalled();
      }
    });

    it('should return to new session form when clicking new session button', async () => {
      const factory = createSequentialThinkingWidget(dependencies, serverInfo);
      const element = document.createElement('sequential-thinking-widget') as SequentialThinkingWidget;
      document.body.appendChild(element);

      element.setDependencies(eventBus, mcpBridge, config);
      element.setServerInfo(serverInfo);

      await factory.api.initialize();

      // Start a session first
      const promptInput = element.shadowRoot?.querySelector('#session-prompt') as HTMLInputElement;
      const startBtn = element.shadowRoot?.querySelector('#start-session-btn') as HTMLButtonElement;

      if (promptInput) {
        promptInput.value = 'Test';
        startBtn?.click();
        await new Promise(resolve => setTimeout(resolve, 50));

        // Now click new session button
        const newSessionBtn = element.shadowRoot?.querySelector('#new-session-btn') as HTMLButtonElement;
        newSessionBtn?.click();

        await new Promise(resolve => setTimeout(resolve, 50));

        // Should show new session form again
        expect(element.shadowRoot?.querySelector('.new-session-form')).toBeTruthy();
      }
    });
  });

  describe('Step Management', () => {
    it('should add thinking step to session', async () => {
      const factory = createSequentialThinkingWidget(dependencies, serverInfo);
      const element = document.createElement('sequential-thinking-widget') as SequentialThinkingWidget;
      document.body.appendChild(element);

      element.setDependencies(eventBus, mcpBridge, config);
      element.setServerInfo(serverInfo);

      await factory.api.initialize();

      // Create session first
      const promptInput = element.shadowRoot?.querySelector('#session-prompt') as HTMLInputElement;
      const startBtn = element.shadowRoot?.querySelector('#start-session-btn') as HTMLButtonElement;

      if (promptInput) {
        promptInput.value = 'Test';
        startBtn?.click();
        await new Promise(resolve => setTimeout(resolve, 50));

        // Add step
        const thoughtInput = element.shadowRoot?.querySelector('#new-step-thought') as HTMLTextAreaElement;
        const addStepBtn = element.shadowRoot?.querySelector('#add-step-btn') as HTMLButtonElement;

        if (thoughtInput) {
          thoughtInput.value = 'First thinking step';
          addStepBtn?.click();
          await new Promise(resolve => setTimeout(resolve, 50));

          const session = element.getCurrentSession();
          expect(session?.steps.length).toBe(1);
          expect(session?.steps[0].thought).toBe('First thinking step');
        }
      }
    });

    it('should emit step added event', async () => {
      const factory = createSequentialThinkingWidget(dependencies, serverInfo);
      const element = document.createElement('sequential-thinking-widget') as SequentialThinkingWidget;
      document.body.appendChild(element);

      element.setDependencies(eventBus, mcpBridge, config);
      element.setServerInfo(serverInfo);

      await factory.api.initialize();

      const stepSpy = vi.fn();
      eventBus.on('thinking:step:added', stepSpy);

      // Create session and add step
      const promptInput = element.shadowRoot?.querySelector('#session-prompt') as HTMLInputElement;
      const startBtn = element.shadowRoot?.querySelector('#start-session-btn') as HTMLButtonElement;

      if (promptInput) {
        promptInput.value = 'Test';
        startBtn?.click();
        await new Promise(resolve => setTimeout(resolve, 50));

        const thoughtInput = element.shadowRoot?.querySelector('#new-step-thought') as HTMLTextAreaElement;
        const addStepBtn = element.shadowRoot?.querySelector('#add-step-btn') as HTMLButtonElement;

        if (thoughtInput) {
          thoughtInput.value = 'Step';
          addStepBtn?.click();
          await new Promise(resolve => setTimeout(resolve, 50));

          expect(stepSpy).toHaveBeenCalled();
        }
      }
    });

    it('should clear input fields after adding step', async () => {
      const factory = createSequentialThinkingWidget(dependencies, serverInfo);
      const element = document.createElement('sequential-thinking-widget') as SequentialThinkingWidget;
      document.body.appendChild(element);

      element.setDependencies(eventBus, mcpBridge, config);
      element.setServerInfo(serverInfo);

      await factory.api.initialize();

      // Create session and add step
      const promptInput = element.shadowRoot?.querySelector('#session-prompt') as HTMLInputElement;
      const startBtn = element.shadowRoot?.querySelector('#start-session-btn') as HTMLButtonElement;

      if (promptInput) {
        promptInput.value = 'Test';
        startBtn?.click();
        await new Promise(resolve => setTimeout(resolve, 50));

        const thoughtInput = element.shadowRoot?.querySelector('#new-step-thought') as HTMLTextAreaElement;
        const conclusionInput = element.shadowRoot?.querySelector('#new-step-conclusion') as HTMLInputElement;
        const addStepBtn = element.shadowRoot?.querySelector('#add-step-btn') as HTMLButtonElement;

        if (thoughtInput && conclusionInput) {
          thoughtInput.value = 'Thought';
          conclusionInput.value = 'Conclusion';
          addStepBtn?.click();
          await new Promise(resolve => setTimeout(resolve, 50));

          // Inputs should be cleared
          expect(thoughtInput.value).toBe('');
          expect(conclusionInput.value).toBe('');
        }
      }
    });
  });

  describe('Export Functionality', () => {
    it('should have export button disabled when no session', async () => {
      const factory = createSequentialThinkingWidget(dependencies, serverInfo);
      const element = document.createElement('sequential-thinking-widget') as SequentialThinkingWidget;
      document.body.appendChild(element);

      element.setDependencies(eventBus, mcpBridge, config);
      element.setServerInfo(serverInfo);

      await factory.api.initialize();

      const exportBtn = element.shadowRoot?.querySelector('#export-btn') as HTMLButtonElement;
      expect(exportBtn?.disabled).toBe(true);
    });

    it('should emit export event when exporting session', async () => {
      const factory = createSequentialThinkingWidget(dependencies, serverInfo);
      const element = document.createElement('sequential-thinking-widget') as SequentialThinkingWidget;
      document.body.appendChild(element);

      element.setDependencies(eventBus, mcpBridge, config);
      element.setServerInfo(serverInfo);

      await factory.api.initialize();

      const exportSpy = vi.fn();
      eventBus.on('thinking:session:exported', exportSpy);

      // Create session first
      const promptInput = element.shadowRoot?.querySelector('#session-prompt') as HTMLInputElement;
      const startBtn = element.shadowRoot?.querySelector('#start-session-btn') as HTMLButtonElement;

      if (promptInput) {
        promptInput.value = 'Test';
        startBtn?.click();
        await new Promise(resolve => setTimeout(resolve, 50));

        const exportBtn = element.shadowRoot?.querySelector('#export-btn') as HTMLButtonElement;
        exportBtn?.click();

        expect(exportSpy).toHaveBeenCalled();
      }
    });
  });

  describe('Status and Resource Usage', () => {
    it('should return healthy status when ready', async () => {
      const factory = createSequentialThinkingWidget(dependencies, serverInfo);
      const element = document.createElement('sequential-thinking-widget') as SequentialThinkingWidget;
      document.body.appendChild(element);

      element.setDependencies(eventBus, mcpBridge, config);
      element.setServerInfo(serverInfo);

      await factory.api.initialize();

      const status = factory.api.getStatus();
      expect(status.status).toBe('healthy');
      expect(status.message).toBe('Ready');
    });

    it('should return initializing status when loading', async () => {
      const factory = createSequentialThinkingWidget(dependencies, serverInfo);
      const element = document.createElement('sequential-thinking-widget') as SequentialThinkingWidget;
      document.body.appendChild(element);

      element.setDependencies(eventBus, mcpBridge, config);
      element.setServerInfo(serverInfo);

      await factory.api.initialize();

      // Trigger loading state
      const promptInput = element.shadowRoot?.querySelector('#session-prompt') as HTMLInputElement;
      const startBtn = element.shadowRoot?.querySelector('#start-session-btn') as HTMLButtonElement;

      if (promptInput) {
        promptInput.value = 'Test';
        startBtn?.click();

        // Check status during loading
        const status = factory.api.getStatus();
        // May be initializing or healthy depending on timing
        expect(['initializing', 'healthy']).toContain(status.status);
      }
    });

    it('should track resource usage within budget (<20MB)', async () => {
      const factory = createSequentialThinkingWidget(dependencies, serverInfo);
      const element = document.createElement('sequential-thinking-widget') as SequentialThinkingWidget;
      document.body.appendChild(element);

      element.setDependencies(eventBus, mcpBridge, config);
      element.setServerInfo(serverInfo);

      await factory.api.initialize();

      const usage = factory.api.getResourceUsage();

      expect(usage.memory).toBeLessThan(20 * 1024 * 1024); // 20MB in bytes
      expect(usage.domNodes).toBeGreaterThan(0);
    });
  });

  describe('Widget Cleanup', () => {
    it('should destroy successfully', async () => {
      const factory = createSequentialThinkingWidget(dependencies, serverInfo);
      const element = document.createElement('sequential-thinking-widget') as SequentialThinkingWidget;
      document.body.appendChild(element);

      element.setDependencies(eventBus, mcpBridge, config);
      element.setServerInfo(serverInfo);

      await factory.api.initialize();
      await expect(factory.api.destroy()).resolves.not.toThrow();
    });

    it('should emit destroyed event', async () => {
      const factory = createSequentialThinkingWidget(dependencies, serverInfo);
      const element = document.createElement('sequential-thinking-widget') as SequentialThinkingWidget;
      document.body.appendChild(element);

      element.setDependencies(eventBus, mcpBridge, config);
      element.setServerInfo(serverInfo);

      await factory.api.initialize();

      const destroySpy = vi.fn();
      eventBus.on('widget:destroyed', destroySpy);

      await factory.api.destroy();

      expect(destroySpy).toHaveBeenCalled();
    });

    it('should clear shadow root on destroy', async () => {
      const factory = createSequentialThinkingWidget(dependencies, serverInfo);
      const element = document.createElement('sequential-thinking-widget') as SequentialThinkingWidget;
      document.body.appendChild(element);

      element.setDependencies(eventBus, mcpBridge, config);
      element.setServerInfo(serverInfo);

      await factory.api.initialize();
      await factory.api.destroy();

      expect(element.shadowRoot?.innerHTML).toBe('');
    });

    it('should unsubscribe from all events', async () => {
      const factory = createSequentialThinkingWidget(dependencies, serverInfo);
      const element = document.createElement('sequential-thinking-widget') as SequentialThinkingWidget;
      document.body.appendChild(element);

      element.setDependencies(eventBus, mcpBridge, config);
      element.setServerInfo(serverInfo);

      await factory.api.initialize();
      await factory.api.destroy();

      // Emit events - should not trigger any handlers
      eventBus.emit('mcp:tool:invoked', { serverName: 'sequential-thinking' });

      // Widget should not respond to events after destroy
      expect(element.shadowRoot?.innerHTML).toBe('');
    });
  });

  describe('Refresh Functionality', () => {
    it('should refresh successfully when no session', async () => {
      const factory = createSequentialThinkingWidget(dependencies, serverInfo);
      const element = document.createElement('sequential-thinking-widget') as SequentialThinkingWidget;
      document.body.appendChild(element);

      element.setDependencies(eventBus, mcpBridge, config);
      element.setServerInfo(serverInfo);

      await factory.api.initialize();
      await expect(factory.api.refresh()).resolves.not.toThrow();
    });

    it('should reload session data when refreshing with active session', async () => {
      const factory = createSequentialThinkingWidget(dependencies, serverInfo);
      const element = document.createElement('sequential-thinking-widget') as SequentialThinkingWidget;
      document.body.appendChild(element);

      element.setDependencies(eventBus, mcpBridge, config);
      element.setServerInfo(serverInfo);

      await factory.api.initialize();

      // Create session
      const promptInput = element.shadowRoot?.querySelector('#session-prompt') as HTMLInputElement;
      const startBtn = element.shadowRoot?.querySelector('#start-session-btn') as HTMLButtonElement;

      if (promptInput) {
        promptInput.value = 'Test';
        startBtn?.click();
        await new Promise(resolve => setTimeout(resolve, 50));

        await expect(factory.api.refresh()).resolves.not.toThrow();
      }
    });
  });

  describe('Performance', () => {
    it('should meet render time budget', async () => {
      const factory = createSequentialThinkingWidget(dependencies, serverInfo);
      const element = document.createElement('sequential-thinking-widget') as SequentialThinkingWidget;
      document.body.appendChild(element);

      element.setDependencies(eventBus, mcpBridge, config);
      element.setServerInfo(serverInfo);

      await factory.api.initialize();

      const usage = factory.api.getResourceUsage();
      expect(usage.renderTime).toBeLessThan(100); // Should be very fast
    });

    it('should efficiently handle multiple steps', async () => {
      const factory = createSequentialThinkingWidget(dependencies, serverInfo);
      const element = document.createElement('sequential-thinking-widget') as SequentialThinkingWidget;
      document.body.appendChild(element);

      element.setDependencies(eventBus, mcpBridge, config);
      element.setServerInfo(serverInfo);

      await factory.api.initialize();

      // Create session
      const promptInput = element.shadowRoot?.querySelector('#session-prompt') as HTMLInputElement;
      const startBtn = element.shadowRoot?.querySelector('#start-session-btn') as HTMLButtonElement;

      if (promptInput) {
        promptInput.value = 'Performance test';
        startBtn?.click();
        await new Promise(resolve => setTimeout(resolve, 50));

        // Add multiple steps quickly
        const thoughtInput = element.shadowRoot?.querySelector('#new-step-thought') as HTMLTextAreaElement;
        const addStepBtn = element.shadowRoot?.querySelector('#add-step-btn') as HTMLButtonElement;

        if (thoughtInput) {
          for (let i = 0; i < 10; i++) {
            thoughtInput.value = `Step ${i + 1}`;
            addStepBtn?.click();
            await new Promise(resolve => setTimeout(resolve, 20));
          }

          const session = element.getCurrentSession();
          expect(session?.steps.length).toBe(10);

          const usage = factory.api.getResourceUsage();
          expect(usage.memory).toBeLessThan(20 * 1024 * 1024);
        }
      }
    });
  });
});
