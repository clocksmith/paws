import { describe, it, expect, beforeEach, vi } from 'vitest';
import SelfTester from '../../upgrades/self-tester.js';

describe('SelfTester Module', () => {
  let mockDeps;
  let testerInstance;

  beforeEach(() => {
    // Mock DIContainer
    global.window = {
      DIContainer: {
        get: vi.fn((name) => {
          const mocks = {
            Utils: { logger: { info: vi.fn() } },
            StateManager: { getState: vi.fn(() => ({ agent_state: 'IDLE', goal: 'test', turns: 0, cycle: 1 })), setState: vi.fn(), updateState: vi.fn() },
            EventBus: { on: vi.fn(), emit: vi.fn(), off: vi.fn() },
            ApiClient: { request: vi.fn() },
            ToolRunner: { execute: vi.fn(() => Promise.resolve({})), loadTools: vi.fn() },
            PerformanceMonitor: { getMetrics: vi.fn(() => ({ session: {}, tools: {} })), trackEvent: vi.fn() },
            Introspector: { getModuleGraph: vi.fn(), getToolCatalog: vi.fn() },
            ReflectionStore: { addReflection: vi.fn(), getReflections: vi.fn(() => Promise.resolve([])), init: vi.fn(() => Promise.resolve()) }
          };
          return mocks[name] || null;
        })
      }
    };

    global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve([]) }));
    global.indexedDB = {};

    mockDeps = {
      Utils: { logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } },
      EventBus: { emit: vi.fn(), on: vi.fn() },
      StateManager: { getState: vi.fn(() => ({})) }
    };


    testerInstance = SelfTester.factory(mockDeps);
  });

  describe('Module Metadata', () => {
    it('should have correct metadata', () => {
      expect(SelfTester.metadata.id).toBe('SelfTester');
      expect(SelfTester.metadata.type).toBe('validation');
      expect(SelfTester.metadata.async).toBe(true);
    });
  });

  describe('Test Suites', () => {
    it('should test module loading', async () => {
      const results = await testerInstance.testModuleLoading();
      expect(results.name).toBe('Module Loading');
      expect(results.passed).toBeGreaterThan(0);
    });

    it('should test tool execution', async () => {
      const results = await testerInstance.testToolExecution();
      expect(results.name).toBe('Tool Execution');
      expect(results.tests).toBeDefined();
    });

    it('should test FSM transitions', async () => {
      const results = await testerInstance.testFSMTransitions();
      expect(results.name).toBe('FSM Transitions');
    });

    it('should test storage systems', async () => {
      const results = await testerInstance.testStorageSystems();
      expect(results.passed).toBeDefined();
    });

    it('should test performance monitoring', async () => {
      const results = await testerInstance.testPerformanceMonitoring();
      expect(results).toBeDefined();
    });
  });

  describe('Comprehensive Testing', () => {
    it('should run all tests', async () => {
      const results = await testerInstance.runAllTests();
      expect(results.suites).toHaveLength(5);
      expect(results.summary.totalTests).toBeGreaterThan(0);
      expect(results.summary.successRate).toBeGreaterThanOrEqual(0);
    });

    it('should track test history', async () => {
      await testerInstance.runAllTests();
      const history = testerInstance.getTestHistory();
      expect(history.length).toBe(1);
    });

    it('should generate report', async () => {
      await testerInstance.runAllTests();
      const report = testerInstance.generateReport();
      expect(report).toContain('# REPLOID Self-Test Report');
    });
  });
});
