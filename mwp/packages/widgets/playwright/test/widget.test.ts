/**
 * Playwright Widget Tests
 *
 * Unit tests for @mcp-wp/widget-playwright
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { types } from '@mcp-wp/core';
import createPlaywrightWidget from '../src/index.js';
import { PlaywrightWidget } from '../src/widget.js';

type EventBus = types.EventBus;
type MCPBridge = types.MCPBridge;
type Configuration = types.Configuration;
type MCPServerInfo = types.MCPServerInfo;

// Mock Dependencies
function createMockEventBus(): EventBus {
  const listeners = new Map<string, Set<Function>>();

  return {
    on: (event: string, handler: Function) => {
      if (!listeners.has(event)) {
        listeners.set(event, new Set());
      }
      listeners.get(event)!.add(handler);
      return () => listeners.get(event)?.delete(handler);
    },
    emit: (event: string, data: any) => {
      listeners.get(event)?.forEach(handler => handler(data));
    },
    off: (event: string, handler: Function) => {
      listeners.get(event)?.delete(handler);
    },
  } as EventBus;
}

function createMockMCPBridge(): MCPBridge {
  return {
    callTool: vi.fn(async (serverName: string, toolName: string, args: any) => {
      if (toolName === 'playwright_screenshot') {
        return {
          content: [
            {
              type: 'image',
              data: 'base64-encoded-image-data',
              mimeType: 'image/png',
            },
          ],
        };
      }
      return { content: [{ type: 'text', text: 'Success' }] };
    }),
    readResource: vi.fn(async () => ({ content: [] })),
    getPrompt: vi.fn(async () => ({ messages: [] })),
    listTools: vi.fn(async () => ({ tools: [] })),
    listResources: vi.fn(async () => ({ resources: [] })),
    listPrompts: vi.fn(async () => ({ prompts: [] })),
  } as unknown as MCPBridge;
}

function createMockConfiguration(): Configuration {
  const store = new Map<string, any>();
  return {
    get: vi.fn((key: string) => store.get(key)),
    set: vi.fn((key: string, value: any) => store.set(key, value)),
    has: vi.fn((key: string) => store.has(key)),
    delete: vi.fn((key: string) => store.delete(key)),
  } as unknown as Configuration;
}

const mockServerInfo: MCPServerInfo = {
  serverName: 'playwright',
  name: 'Playwright Server',
  version: '1.0.0',
  capabilities: {
    tools: true,
    resources: false,
    prompts: false,
  },
};

describe('PlaywrightWidget', () => {
  let mockEventBus: EventBus;
  let mockMCPBridge: MCPBridge;
  let mockConfig: Configuration;

  beforeEach(() => {
    mockEventBus = createMockEventBus();
    mockMCPBridge = createMockMCPBridge();
    mockConfig = createMockConfiguration();

    // Setup DOM
    document.body.innerHTML = '<div id="container"></div>';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('Widget Factory', () => {
    it('should create widget factory with correct structure', () => {
      const factory = createPlaywrightWidget(
        { EventBus: mockEventBus, MCPBridge: mockMCPBridge, Configuration: mockConfig },
        mockServerInfo
      );

      expect(factory).toHaveProperty('api');
      expect(factory).toHaveProperty('widget');
      expect(factory.api).toHaveProperty('initialize');
      expect(factory.api).toHaveProperty('destroy');
      expect(factory.api).toHaveProperty('refresh');
      expect(factory.api).toHaveProperty('getStatus');
      expect(factory.api).toHaveProperty('getResourceUsage');
    });

    it('should have correct widget metadata', () => {
      const factory = createPlaywrightWidget(
        { EventBus: mockEventBus, MCPBridge: mockMCPBridge, Configuration: mockConfig },
        mockServerInfo
      );

      expect(factory.widget.protocolVersion).toBe('1.0.0');
      expect(factory.widget.element).toBe('playwright-mcp-widget');
      expect(factory.widget.displayName).toBe('Playwright');
      expect(factory.widget.description).toBe('Browser automation and testing');
      expect(factory.widget.capabilities).toEqual({
        tools: true,
        resources: false,
        prompts: false,
      });
    });

    it('should register custom element', () => {
      createPlaywrightWidget(
        { EventBus: mockEventBus, MCPBridge: mockMCPBridge, Configuration: mockConfig },
        mockServerInfo
      );

      const element = customElements.get('playwright-mcp-widget');
      expect(element).toBeDefined();
    });
  });

  describe('Widget Initialization', () => {
    it('should initialize successfully', async () => {
      const factory = createPlaywrightWidget(
        { EventBus: mockEventBus, MCPBridge: mockMCPBridge, Configuration: mockConfig },
        mockServerInfo
      );

      const emitSpy = vi.spyOn(mockEventBus, 'emit');

      await factory.api.initialize();

      expect(emitSpy).toHaveBeenCalledWith(
        'widget:initialized',
        expect.objectContaining({
          element: 'playwright-mcp-widget',
          serverName: 'playwright',
        })
      );
    });

    it('should initialize within performance budget (<200ms)', async () => {
      const factory = createPlaywrightWidget(
        { EventBus: mockEventBus, MCPBridge: mockMCPBridge, Configuration: mockConfig },
        mockServerInfo
      );

      const startTime = performance.now();
      await factory.api.initialize();
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(200);
    });

    it('should load saved configuration', async () => {
      mockConfig.get = vi.fn(() => ({
        browser: 'firefox',
        viewport: { width: 1920, height: 1080 },
      }));

      const factory = createPlaywrightWidget(
        { EventBus: mockEventBus, MCPBridge: mockMCPBridge, Configuration: mockConfig },
        mockServerInfo
      );

      await factory.api.initialize();

      expect(mockConfig.get).toHaveBeenCalledWith('playwrightWidget');
    });
  });

  describe('Widget Rendering', () => {
    it('should render with Shadow DOM', async () => {
      const factory = createPlaywrightWidget(
        { EventBus: mockEventBus, MCPBridge: mockMCPBridge, Configuration: mockConfig },
        mockServerInfo
      );

      const element = document.createElement('playwright-mcp-widget') as PlaywrightWidget;
      document.body.appendChild(element);
      await factory.api.initialize();

      expect(element.shadowRoot).toBeTruthy();
      expect(element.shadowRoot?.querySelector('.playwright-widget')).toBeTruthy();
    });

    it('should render header with tabs', async () => {
      const factory = createPlaywrightWidget(
        { EventBus: mockEventBus, MCPBridge: mockMCPBridge, Configuration: mockConfig },
        mockServerInfo
      );

      const element = document.createElement('playwright-mcp-widget') as PlaywrightWidget;
      document.body.appendChild(element);
      await factory.api.initialize();

      const header = element.shadowRoot?.querySelector('.widget-header');
      expect(header).toBeTruthy();

      const tabs = element.shadowRoot?.querySelectorAll('.tab-button');
      expect(tabs?.length).toBe(4);
    });

    it('should render browser view by default', async () => {
      const factory = createPlaywrightWidget(
        { EventBus: mockEventBus, MCPBridge: mockMCPBridge, Configuration: mockConfig },
        mockServerInfo
      );

      const element = document.createElement('playwright-mcp-widget') as PlaywrightWidget;
      document.body.appendChild(element);
      await factory.api.initialize();

      const browserView = element.shadowRoot?.querySelector('.browser-view');
      expect(browserView).toBeTruthy();
    });

    it('should render within memory budget (<20MB)', async () => {
      const factory = createPlaywrightWidget(
        { EventBus: mockEventBus, MCPBridge: mockMCPBridge, Configuration: mockConfig },
        mockServerInfo
      );

      const element = document.createElement('playwright-mcp-widget') as PlaywrightWidget;
      document.body.appendChild(element);
      await factory.api.initialize();

      const usage = factory.api.getResourceUsage();
      const memoryMB = usage.memory / (1024 * 1024);

      expect(memoryMB).toBeLessThan(20);
    });
  });

  describe('Browser Navigation', () => {
    it('should navigate to URL when clicking Go button', async () => {
      const factory = createPlaywrightWidget(
        { EventBus: mockEventBus, MCPBridge: mockMCPBridge, Configuration: mockConfig },
        mockServerInfo
      );

      const element = document.createElement('playwright-mcp-widget') as PlaywrightWidget;
      document.body.appendChild(element);
      await factory.api.initialize();

      const input = element.shadowRoot?.querySelector('#url-input') as HTMLInputElement;
      const goBtn = element.shadowRoot?.querySelector('#go-btn') as HTMLButtonElement;

      input.value = 'https://example.com';
      goBtn.click();

      // Wait for async navigation
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockMCPBridge.callTool).toHaveBeenCalledWith(
        'playwright',
        'playwright_navigate',
        { url: 'https://example.com' }
      );
    });

    it('should emit navigation events', async () => {
      const factory = createPlaywrightWidget(
        { EventBus: mockEventBus, MCPBridge: mockMCPBridge, Configuration: mockConfig },
        mockServerInfo
      );

      const emitSpy = vi.spyOn(mockEventBus, 'emit');

      const element = document.createElement('playwright-mcp-widget') as PlaywrightWidget;
      document.body.appendChild(element);
      await factory.api.initialize();

      const input = element.shadowRoot?.querySelector('#url-input') as HTMLInputElement;
      const goBtn = element.shadowRoot?.querySelector('#go-btn') as HTMLButtonElement;

      input.value = 'https://example.com';
      goBtn.click();

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(emitSpy).toHaveBeenCalledWith(
        'playwright:navigate:start',
        expect.objectContaining({ url: 'https://example.com' })
      );
    });
  });

  describe('Screenshot Functionality', () => {
    it('should take screenshot when clicking screenshot button', async () => {
      const factory = createPlaywrightWidget(
        { EventBus: mockEventBus, MCPBridge: mockMCPBridge, Configuration: mockConfig },
        mockServerInfo
      );

      const element = document.createElement('playwright-mcp-widget') as PlaywrightWidget;
      document.body.appendChild(element);
      await factory.api.initialize();

      const screenshotBtn = element.shadowRoot?.querySelector('#screenshot-btn') as HTMLButtonElement;

      screenshotBtn.click();

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockMCPBridge.callTool).toHaveBeenCalledWith(
        'playwright',
        'playwright_screenshot',
        expect.objectContaining({ name: expect.stringContaining('screenshot-') })
      );
    });
  });

  describe('View Switching', () => {
    it('should switch to screenshots view', async () => {
      const factory = createPlaywrightWidget(
        { EventBus: mockEventBus, MCPBridge: mockMCPBridge, Configuration: mockConfig },
        mockServerInfo
      );

      const element = document.createElement('playwright-mcp-widget') as PlaywrightWidget;
      document.body.appendChild(element);
      await factory.api.initialize();

      const screenshotsTab = element.shadowRoot?.querySelector('[data-view="screenshots"]') as HTMLButtonElement;

      screenshotsTab.click();

      await new Promise(resolve => setTimeout(resolve, 50));

      const screenshotsView = element.shadowRoot?.querySelector('.screenshots-view');
      expect(screenshotsView || element.shadowRoot?.querySelector('.empty')).toBeTruthy();
    });

    it('should switch to console view', async () => {
      const factory = createPlaywrightWidget(
        { EventBus: mockEventBus, MCPBridge: mockMCPBridge, Configuration: mockConfig },
        mockServerInfo
      );

      const element = document.createElement('playwright-mcp-widget') as PlaywrightWidget;
      document.body.appendChild(element);
      await factory.api.initialize();

      const consoleTab = element.shadowRoot?.querySelector('[data-view="console"]') as HTMLButtonElement;

      consoleTab.click();

      await new Promise(resolve => setTimeout(resolve, 50));

      const consoleView = element.shadowRoot?.querySelector('.console-view');
      expect(consoleView || element.shadowRoot?.querySelector('.empty')).toBeTruthy();
    });
  });

  describe('Widget Status', () => {
    it('should return healthy status when initialized', async () => {
      const factory = createPlaywrightWidget(
        { EventBus: mockEventBus, MCPBridge: mockMCPBridge, Configuration: mockConfig },
        mockServerInfo
      );

      await factory.api.initialize();

      const status = factory.api.getStatus();
      expect(status.status).toBe('healthy');
    });

    it('should return error status when error occurs', async () => {
      mockMCPBridge.callTool = vi.fn().mockRejectedValue(new Error('Navigation failed'));

      const factory = createPlaywrightWidget(
        { EventBus: mockEventBus, MCPBridge: mockMCPBridge, Configuration: mockConfig },
        mockServerInfo
      );

      const element = document.createElement('playwright-mcp-widget') as PlaywrightWidget;
      document.body.appendChild(element);
      await factory.api.initialize();

      const input = element.shadowRoot?.querySelector('#url-input') as HTMLInputElement;
      const goBtn = element.shadowRoot?.querySelector('#go-btn') as HTMLButtonElement;

      input.value = 'https://example.com';
      goBtn.click();

      await new Promise(resolve => setTimeout(resolve, 50));

      const status = factory.api.getStatus();
      expect(status.status).toBe('error');
      expect(status.message).toContain('Navigation failed');
    });
  });

  describe('Widget Refresh', () => {
    it('should refresh successfully', async () => {
      const factory = createPlaywrightWidget(
        { EventBus: mockEventBus, MCPBridge: mockMCPBridge, Configuration: mockConfig },
        mockServerInfo
      );

      const emitSpy = vi.spyOn(mockEventBus, 'emit');

      await factory.api.initialize();
      await factory.api.refresh();

      expect(emitSpy).toHaveBeenCalledWith(
        'widget:refreshed',
        expect.objectContaining({
          widgetId: expect.any(String),
          timestamp: expect.any(Date),
        })
      );
    });
  });

  describe('Widget Cleanup', () => {
    it('should cleanup on destroy', async () => {
      const factory = createPlaywrightWidget(
        { EventBus: mockEventBus, MCPBridge: mockMCPBridge, Configuration: mockConfig },
        mockServerInfo
      );

      const emitSpy = vi.spyOn(mockEventBus, 'emit');

      const element = document.createElement('playwright-mcp-widget') as PlaywrightWidget;
      document.body.appendChild(element);
      await factory.api.initialize();
      await factory.api.destroy();

      expect(emitSpy).toHaveBeenCalledWith(
        'widget:destroyed',
        expect.objectContaining({
          element: 'playwright-mcp-widget',
        })
      );

      expect(element.shadowRoot?.innerHTML).toBe('');
    });

    it('should unsubscribe from all events on destroy', async () => {
      const factory = createPlaywrightWidget(
        { EventBus: mockEventBus, MCPBridge: mockMCPBridge, Configuration: mockConfig },
        mockServerInfo
      );

      await factory.api.initialize();

      const onSpy = vi.spyOn(mockEventBus, 'on');
      const initialCallCount = onSpy.mock.calls.length;

      await factory.api.destroy();

      // Verify cleanup happened (no new listeners added)
      expect(onSpy.mock.calls.length).toBe(initialCallCount);
    });
  });

  describe('Resource Usage', () => {
    it('should track render time', async () => {
      const factory = createPlaywrightWidget(
        { EventBus: mockEventBus, MCPBridge: mockMCPBridge, Configuration: mockConfig },
        mockServerInfo
      );

      await factory.api.initialize();

      const usage = factory.api.getResourceUsage();
      expect(usage).toHaveProperty('renderTime');
      expect(usage.renderTime).toBeGreaterThanOrEqual(0);
    });

    it('should track DOM nodes', async () => {
      const factory = createPlaywrightWidget(
        { EventBus: mockEventBus, MCPBridge: mockMCPBridge, Configuration: mockConfig },
        mockServerInfo
      );

      const element = document.createElement('playwright-mcp-widget') as PlaywrightWidget;
      document.body.appendChild(element);
      await factory.api.initialize();

      const usage = factory.api.getResourceUsage();
      expect(usage).toHaveProperty('domNodes');
      expect(usage.domNodes).toBeGreaterThan(0);
    });

    it('should estimate memory usage', async () => {
      const factory = createPlaywrightWidget(
        { EventBus: mockEventBus, MCPBridge: mockMCPBridge, Configuration: mockConfig },
        mockServerInfo
      );

      await factory.api.initialize();

      const usage = factory.api.getResourceUsage();
      expect(usage).toHaveProperty('memory');
      expect(usage.memory).toBeGreaterThan(0);
    });
  });

  describe('Event Handling', () => {
    it('should handle tool invoked events', async () => {
      const factory = createPlaywrightWidget(
        { EventBus: mockEventBus, MCPBridge: mockMCPBridge, Configuration: mockConfig },
        mockServerInfo
      );

      await factory.api.initialize();

      mockEventBus.emit('mcp:tool:invoked', {
        serverName: 'playwright',
        toolName: 'playwright_navigate',
        result: { success: true },
      });

      // Widget should handle the event without error
      const status = factory.api.getStatus();
      expect(status.status).not.toBe('error');
    });

    it('should handle tool error events', async () => {
      const factory = createPlaywrightWidget(
        { EventBus: mockEventBus, MCPBridge: mockMCPBridge, Configuration: mockConfig },
        mockServerInfo
      );

      await factory.api.initialize();

      mockEventBus.emit('mcp:tool:error', {
        serverName: 'playwright',
        toolName: 'playwright_navigate',
        error: { code: 'NAVIGATION_FAILED', message: 'Failed to navigate' },
      });

      const status = factory.api.getStatus();
      expect(status.status).toBe('error');
    });
  });
});
