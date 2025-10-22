import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * Comprehensive test suite for performance-monitor.js
 * Tests performance tracking, metrics collection, and reporting
 */

describe('PerformanceMonitor Module', () => {
  let PerformanceMonitor;
  let mockDeps;
  let mockEventBus;
  let monitorInstance;
  let eventHandlers;

  beforeEach(() => {
    // Track event handlers for testing
    eventHandlers = {};

    // Mock EventBus
    mockEventBus = {
      on: vi.fn((event, handler) => {
        eventHandlers[event] = handler;
      }),
      emit: vi.fn((event, data) => {
        if (eventHandlers[event]) {
          eventHandlers[event](data);
        }
      })
    };

    // Mock dependencies
    mockDeps = {
      Utils: {
        logger: {
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn()
        }
      },
      EventBus: mockEventBus
    };

    // Mock performance.memory
    global.performance = {
      memory: {
        usedJSHeapSize: 50 * 1024 * 1024,
        totalJSHeapSize: 100 * 1024 * 1024,
        jsHeapSizeLimit: 2048 * 1024 * 1024
      }
    };

    // Mock setInterval
    vi.useFakeTimers();

    // Define PerformanceMonitor module structure
    PerformanceMonitor = {
      metadata: {
        id: 'PerformanceMonitor',
        version: '1.0.0',
        dependencies: ['Utils', 'EventBus'],
        async: false,
        type: 'monitoring'
      },
      factory: (deps) => {
        const { Utils, EventBus } = deps;
        const { logger } = Utils;

        const metrics = {
          tools: {},
          states: {},
          llm: {
            calls: 0,
            tokens: { input: 0, output: 0, total: 0 },
            latency: [],
            errors: 0,
            lastCall: null
          },
          memory: [],
          session: {
            startTime: Date.now(),
            cycles: 0,
            artifacts: { created: 0, modified: 0, deleted: 0 }
          }
        };

        const activeTimers = new Map();

        const init = () => {
          logger.info('[PerformanceMonitor] Initializing performance tracking');

          EventBus.on('tool:start', handleToolStart);
          EventBus.on('tool:end', handleToolEnd);
          EventBus.on('tool:error', handleToolError);
          EventBus.on('agent:state:change', handleStateChange);
          EventBus.on('agent:state:exit', handleStateExit);
          EventBus.on('api:request:start', handleApiRequestStart);
          EventBus.on('api:request:end', handleApiRequestEnd);
          EventBus.on('api:request:error', handleApiError);
          EventBus.on('artifact:created', () => metrics.session.artifacts.created++);
          EventBus.on('artifact:updated', () => metrics.session.artifacts.modified++);
          EventBus.on('artifact:deleted', () => metrics.session.artifacts.deleted++);
          EventBus.on('agent:cycle:start', () => metrics.session.cycles++);

          startMemorySampling();

          logger.info('[PerformanceMonitor] Initialized successfully');
        };

        const handleToolStart = ({ toolName, timestamp }) => {
          const startTime = timestamp || Date.now();
          activeTimers.set(`tool:${toolName}`, startTime);

          if (!metrics.tools[toolName]) {
            metrics.tools[toolName] = {
              calls: 0,
              totalTime: 0,
              errors: 0,
              lastCall: null
            };
          }
        };

        const handleToolEnd = ({ toolName, timestamp }) => {
          const endTime = timestamp || Date.now();
          const timerKey = `tool:${toolName}`;
          const startTime = activeTimers.get(timerKey);

          if (startTime && metrics.tools[toolName]) {
            const duration = endTime - startTime;
            metrics.tools[toolName].calls++;
            metrics.tools[toolName].totalTime += duration;
            metrics.tools[toolName].lastCall = endTime;
            activeTimers.delete(timerKey);
          }
        };

        const handleToolError = ({ toolName, error }) => {
          if (metrics.tools[toolName]) {
            metrics.tools[toolName].errors++;
          }
          logger.warn(`[PerformanceMonitor] Tool error: ${toolName}`, { error });
        };

        const handleStateChange = ({ newState, timestamp }) => {
          const startTime = timestamp || Date.now();
          activeTimers.set(`state:${newState}`, startTime);

          if (!metrics.states[newState]) {
            metrics.states[newState] = {
              entries: 0,
              totalTime: 0,
              lastEntry: null
            };
          }

          metrics.states[newState].entries++;
          metrics.states[newState].lastEntry = startTime;
        };

        const handleStateExit = ({ state, timestamp }) => {
          const exitTime = timestamp || Date.now();
          const timerKey = `state:${state}`;
          const startTime = activeTimers.get(timerKey);

          if (startTime && metrics.states[state]) {
            const duration = exitTime - startTime;
            metrics.states[state].totalTime += duration;
            activeTimers.delete(timerKey);
          }
        };

        const handleApiRequestStart = ({ requestId, timestamp }) => {
          const startTime = timestamp || Date.now();
          activeTimers.set(`api:${requestId}`, startTime);
        };

        const handleApiRequestEnd = ({ requestId, tokens, timestamp }) => {
          const endTime = timestamp || Date.now();
          const timerKey = `api:${requestId}`;
          const startTime = activeTimers.get(timerKey);

          if (startTime) {
            const latency = endTime - startTime;
            metrics.llm.latency.push(latency);
            activeTimers.delete(timerKey);
          }

          metrics.llm.calls++;
          if (tokens) {
            metrics.llm.tokens.input += tokens.input || 0;
            metrics.llm.tokens.output += tokens.output || 0;
            metrics.llm.tokens.total += (tokens.input || 0) + (tokens.output || 0);
          }
          metrics.llm.lastCall = endTime;
        };

        const handleApiError = ({ requestId, error }) => {
          metrics.llm.errors++;
          const timerKey = `api:${requestId}`;
          activeTimers.delete(timerKey);
          logger.warn(`[PerformanceMonitor] API error`, { error });
        };

        const startMemorySampling = () => {
          const sampleMemory = () => {
            if (performance.memory) {
              metrics.memory.push({
                timestamp: Date.now(),
                usedJSHeapSize: performance.memory.usedJSHeapSize,
                totalJSHeapSize: performance.memory.totalJSHeapSize,
                jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
              });

              if (metrics.memory.length > 100) {
                metrics.memory.shift();
              }
            }
          };

          sampleMemory();
          setInterval(sampleMemory, 30000);
        };

        const getMetrics = () => {
          return {
            ...metrics,
            session: {
              ...metrics.session,
              uptime: Date.now() - metrics.session.startTime
            }
          };
        };

        const getToolStats = (toolName) => {
          const tool = metrics.tools[toolName];
          if (!tool) return null;

          return {
            ...tool,
            avgTime: tool.calls > 0 ? tool.totalTime / tool.calls : 0,
            errorRate: tool.calls > 0 ? tool.errors / tool.calls : 0
          };
        };

        const getStateStats = (stateName) => {
          const state = metrics.states[stateName];
          if (!state) return null;

          return {
            ...state,
            avgTime: state.entries > 0 ? state.totalTime / state.entries : 0
          };
        };

        const getLLMStats = () => {
          const latencies = metrics.llm.latency;
          let avgLatency = 0;
          let medianLatency = 0;
          let p95Latency = 0;

          if (latencies.length > 0) {
            avgLatency = latencies.reduce((sum, val) => sum + val, 0) / latencies.length;

            const sorted = [...latencies].sort((a, b) => a - b);
            const mid = Math.floor(sorted.length / 2);
            medianLatency = sorted.length % 2 === 0
              ? (sorted[mid - 1] + sorted[mid]) / 2
              : sorted[mid];

            const p95Index = Math.floor(sorted.length * 0.95);
            p95Latency = sorted[p95Index] || sorted[sorted.length - 1];
          }

          return {
            ...metrics.llm,
            avgLatency,
            medianLatency,
            p95Latency,
            errorRate: metrics.llm.calls > 0 ? metrics.llm.errors / metrics.llm.calls : 0,
            avgTokensPerCall: metrics.llm.calls > 0 ? metrics.llm.tokens.total / metrics.llm.calls : 0
          };
        };

        const getMemoryStats = () => {
          if (metrics.memory.length === 0) return null;

          const latest = metrics.memory[metrics.memory.length - 1];
          const usedSizes = metrics.memory.map(m => m.usedJSHeapSize);
          const avgUsed = usedSizes.reduce((sum, val) => sum + val, 0) / usedSizes.length;
          const maxUsed = Math.max(...usedSizes);
          const minUsed = Math.min(...usedSizes);

          return {
            current: latest,
            avg: avgUsed,
            max: maxUsed,
            min: minUsed,
            samples: metrics.memory.length
          };
        };

        const generateReport = () => {
          const uptime = Date.now() - metrics.session.startTime;
          const uptimeMinutes = Math.floor(uptime / 60000);
          const uptimeSeconds = Math.floor((uptime % 60000) / 1000);

          let report = `# REPLOID Performance Report\n\n`;
          report += `**Generated:** ${new Date().toISOString()}\n`;
          report += `**Uptime:** ${uptimeMinutes}m ${uptimeSeconds}s\n\n`;

          report += `## Session Statistics\n\n`;
          report += `- **Cycles:** ${metrics.session.cycles}\n`;
          report += `- **Artifacts Created:** ${metrics.session.artifacts.created}\n`;
          report += `- **Artifacts Modified:** ${metrics.session.artifacts.modified}\n`;
          report += `- **Artifacts Deleted:** ${metrics.session.artifacts.deleted}\n\n`;

          if (Object.keys(metrics.tools).length > 0) {
            report += `## Tool Performance\n\n`;
            const toolStats = Object.entries(metrics.tools)
              .map(([name, data]) => ({
                name,
                ...getToolStats(name)
              }))
              .sort((a, b) => b.totalTime - a.totalTime);

            report += `| Tool | Calls | Avg Time | Total Time | Errors |\n`;
            report += `|------|-------|----------|------------|--------|\n`;
            toolStats.forEach(tool => {
              report += `| ${tool.name} | ${tool.calls} | ${tool.avgTime.toFixed(2)}ms | ${tool.totalTime.toFixed(2)}ms | ${tool.errors} |\n`;
            });
            report += `\n`;
          }

          if (Object.keys(metrics.states).length > 0) {
            report += `## State Performance\n\n`;
            const stateStats = Object.entries(metrics.states)
              .map(([name, data]) => ({
                name,
                ...getStateStats(name)
              }))
              .sort((a, b) => b.totalTime - a.totalTime);

            report += `| State | Entries | Avg Time | Total Time |\n`;
            report += `|-------|---------|----------|------------|\n`;
            stateStats.forEach(state => {
              report += `| ${state.name} | ${state.entries} | ${state.avgTime.toFixed(2)}ms | ${state.totalTime.toFixed(2)}ms |\n`;
            });
            report += `\n`;
          }

          const llmStats = getLLMStats();
          report += `## LLM API Performance\n\n`;
          report += `- **Total Calls:** ${llmStats.calls}\n`;
          report += `- **Total Tokens:** ${llmStats.tokens.total} (${llmStats.tokens.input} input, ${llmStats.tokens.output} output)\n`;
          report += `- **Avg Tokens/Call:** ${llmStats.avgTokensPerCall.toFixed(2)}\n`;
          report += `- **Avg Latency:** ${llmStats.avgLatency.toFixed(2)}ms\n`;
          report += `- **Median Latency:** ${llmStats.medianLatency.toFixed(2)}ms\n`;
          report += `- **P95 Latency:** ${llmStats.p95Latency.toFixed(2)}ms\n`;
          report += `- **Errors:** ${llmStats.errors} (${(llmStats.errorRate * 100).toFixed(2)}%)\n\n`;

          const memStats = getMemoryStats();
          if (memStats) {
            report += `## Memory Usage\n\n`;
            report += `- **Current:** ${(memStats.current.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB\n`;
            report += `- **Average:** ${(memStats.avg / 1024 / 1024).toFixed(2)} MB\n`;
            report += `- **Peak:** ${(memStats.max / 1024 / 1024).toFixed(2)} MB\n`;
            report += `- **Min:** ${(memStats.min / 1024 / 1024).toFixed(2)} MB\n`;
            report += `- **Heap Limit:** ${(memStats.current.jsHeapSizeLimit / 1024 / 1024).toFixed(2)} MB\n\n`;
          }

          report += `---\n\n*Generated by REPLOID Performance Monitor*\n`;

          return report;
        };

        const reset = () => {
          metrics.tools = {};
          metrics.states = {};
          metrics.llm = {
            calls: 0,
            tokens: { input: 0, output: 0, total: 0 },
            latency: [],
            errors: 0,
            lastCall: null
          };
          metrics.memory = [];
          metrics.session = {
            startTime: Date.now(),
            cycles: 0,
            artifacts: { created: 0, modified: 0, deleted: 0 }
          };
          activeTimers.clear();
          logger.info('[PerformanceMonitor] Metrics reset');
        };

        return {
          init,
          api: {
            getMetrics,
            getToolStats,
            getStateStats,
            getLLMStats,
            getMemoryStats,
            generateReport,
            reset
          }
        };
      }
    };

    monitorInstance = PerformanceMonitor.factory(mockDeps);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    delete global.performance;
  });

  describe('Module Metadata', () => {
    it('should have correct metadata structure', () => {
      expect(PerformanceMonitor.metadata).toBeDefined();
      expect(PerformanceMonitor.metadata.id).toBe('PerformanceMonitor');
      expect(PerformanceMonitor.metadata.version).toBe('1.0.0');
    });

    it('should declare required dependencies', () => {
      expect(PerformanceMonitor.metadata.dependencies).toContain('Utils');
      expect(PerformanceMonitor.metadata.dependencies).toContain('EventBus');
    });

    it('should be marked as monitoring type', () => {
      expect(PerformanceMonitor.metadata.type).toBe('monitoring');
      expect(PerformanceMonitor.metadata.async).toBe(false);
    });
  });

  describe('Initialization', () => {
    it('should initialize successfully', () => {
      monitorInstance.init();

      expect(mockDeps.Utils.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Initializing performance tracking')
      );
      expect(mockDeps.Utils.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Initialized successfully')
      );
    });

    it('should subscribe to all required events', () => {
      monitorInstance.init();

      expect(mockEventBus.on).toHaveBeenCalledWith('tool:start', expect.any(Function));
      expect(mockEventBus.on).toHaveBeenCalledWith('tool:end', expect.any(Function));
      expect(mockEventBus.on).toHaveBeenCalledWith('tool:error', expect.any(Function));
      expect(mockEventBus.on).toHaveBeenCalledWith('agent:state:change', expect.any(Function));
      expect(mockEventBus.on).toHaveBeenCalledWith('agent:state:exit', expect.any(Function));
      expect(mockEventBus.on).toHaveBeenCalledWith('api:request:start', expect.any(Function));
      expect(mockEventBus.on).toHaveBeenCalledWith('api:request:end', expect.any(Function));
      expect(mockEventBus.on).toHaveBeenCalledWith('api:request:error', expect.any(Function));
    });

    it('should start memory sampling on init', () => {
      monitorInstance.init();

      const memStats = monitorInstance.api.getMemoryStats();
      expect(memStats).not.toBeNull();
      expect(memStats.samples).toBeGreaterThan(0);
    });
  });

  describe('Tool Tracking', () => {
    beforeEach(() => {
      monitorInstance.init();
    });

    it('should track tool start event', () => {
      const startTime = Date.now();
      mockEventBus.emit('tool:start', { toolName: 'ReadFile', timestamp: startTime });

      const stats = monitorInstance.api.getToolStats('ReadFile');
      expect(stats).toBeDefined();
      expect(stats.calls).toBe(0);
    });

    it('should track tool end event and calculate duration', () => {
      const startTime = Date.now();
      mockEventBus.emit('tool:start', { toolName: 'ReadFile', timestamp: startTime });

      vi.advanceTimersByTime(100);
      const endTime = startTime + 100;
      mockEventBus.emit('tool:end', { toolName: 'ReadFile', timestamp: endTime });

      const stats = monitorInstance.api.getToolStats('ReadFile');
      expect(stats.calls).toBe(1);
      expect(stats.totalTime).toBe(100);
      expect(stats.avgTime).toBe(100);
    });

    it('should track multiple tool calls', () => {
      mockEventBus.emit('tool:start', { toolName: 'WriteFile', timestamp: 1000 });
      mockEventBus.emit('tool:end', { toolName: 'WriteFile', timestamp: 1050 });

      mockEventBus.emit('tool:start', { toolName: 'WriteFile', timestamp: 2000 });
      mockEventBus.emit('tool:end', { toolName: 'WriteFile', timestamp: 2100 });

      const stats = monitorInstance.api.getToolStats('WriteFile');
      expect(stats.calls).toBe(2);
      expect(stats.totalTime).toBe(150);
      expect(stats.avgTime).toBe(75);
    });

    it('should track tool errors', () => {
      mockEventBus.emit('tool:start', { toolName: 'EditFile', timestamp: 1000 });
      mockEventBus.emit('tool:error', { toolName: 'EditFile', error: 'Permission denied' });

      const stats = monitorInstance.api.getToolStats('EditFile');
      expect(stats.errors).toBe(1);
    });

    it('should calculate error rate correctly', () => {
      mockEventBus.emit('tool:start', { toolName: 'DeleteFile', timestamp: 1000 });
      mockEventBus.emit('tool:end', { toolName: 'DeleteFile', timestamp: 1100 });

      mockEventBus.emit('tool:start', { toolName: 'DeleteFile', timestamp: 2000 });
      mockEventBus.emit('tool:error', { toolName: 'DeleteFile', error: 'Not found' });

      const stats = monitorInstance.api.getToolStats('DeleteFile');
      expect(stats.calls).toBe(1);
      expect(stats.errors).toBe(1);
      expect(stats.errorRate).toBe(1);
    });

    it('should return null for non-existent tool', () => {
      const stats = monitorInstance.api.getToolStats('NonExistentTool');
      expect(stats).toBeNull();
    });
  });

  describe('State Tracking', () => {
    beforeEach(() => {
      monitorInstance.init();
    });

    it('should track state change event', () => {
      mockEventBus.emit('agent:state:change', { newState: 'idle', timestamp: 1000 });

      const stats = monitorInstance.api.getStateStats('idle');
      expect(stats).toBeDefined();
      expect(stats.entries).toBe(1);
    });

    it('should track state duration', () => {
      mockEventBus.emit('agent:state:change', { newState: 'thinking', timestamp: 1000 });
      mockEventBus.emit('agent:state:exit', { state: 'thinking', timestamp: 1500 });

      const stats = monitorInstance.api.getStateStats('thinking');
      expect(stats.entries).toBe(1);
      expect(stats.totalTime).toBe(500);
      expect(stats.avgTime).toBe(500);
    });

    it('should track multiple state entries', () => {
      mockEventBus.emit('agent:state:change', { newState: 'executing', timestamp: 1000 });
      mockEventBus.emit('agent:state:exit', { state: 'executing', timestamp: 1200 });

      mockEventBus.emit('agent:state:change', { newState: 'executing', timestamp: 2000 });
      mockEventBus.emit('agent:state:exit', { state: 'executing', timestamp: 2300 });

      const stats = monitorInstance.api.getStateStats('executing');
      expect(stats.entries).toBe(2);
      expect(stats.totalTime).toBe(500);
      expect(stats.avgTime).toBe(250);
    });

    it('should return null for non-existent state', () => {
      const stats = monitorInstance.api.getStateStats('NonExistentState');
      expect(stats).toBeNull();
    });
  });

  describe('LLM API Tracking', () => {
    beforeEach(() => {
      monitorInstance.init();
    });

    it('should track API request lifecycle', () => {
      mockEventBus.emit('api:request:start', { requestId: 'req-1', timestamp: 1000 });
      mockEventBus.emit('api:request:end', {
        requestId: 'req-1',
        timestamp: 1500,
        tokens: { input: 100, output: 50 }
      });

      const stats = monitorInstance.api.getLLMStats();
      expect(stats.calls).toBe(1);
      expect(stats.tokens.input).toBe(100);
      expect(stats.tokens.output).toBe(50);
      expect(stats.tokens.total).toBe(150);
      expect(stats.latency).toHaveLength(1);
      expect(stats.latency[0]).toBe(500);
    });

    it('should calculate average latency', () => {
      mockEventBus.emit('api:request:start', { requestId: 'req-1', timestamp: 1000 });
      mockEventBus.emit('api:request:end', { requestId: 'req-1', timestamp: 1500 });

      mockEventBus.emit('api:request:start', { requestId: 'req-2', timestamp: 2000 });
      mockEventBus.emit('api:request:end', { requestId: 'req-2', timestamp: 2300 });

      const stats = monitorInstance.api.getLLMStats();
      expect(stats.avgLatency).toBe(400);
    });

    it('should calculate median latency', () => {
      mockEventBus.emit('api:request:start', { requestId: 'req-1', timestamp: 1000 });
      mockEventBus.emit('api:request:end', { requestId: 'req-1', timestamp: 1100 });

      mockEventBus.emit('api:request:start', { requestId: 'req-2', timestamp: 2000 });
      mockEventBus.emit('api:request:end', { requestId: 'req-2', timestamp: 2500 });

      mockEventBus.emit('api:request:start', { requestId: 'req-3', timestamp: 3000 });
      mockEventBus.emit('api:request:end', { requestId: 'req-3', timestamp: 3300 });

      const stats = monitorInstance.api.getLLMStats();
      expect(stats.medianLatency).toBe(300);
    });

    it('should calculate p95 latency', () => {
      for (let i = 0; i < 20; i++) {
        mockEventBus.emit('api:request:start', { requestId: `req-${i}`, timestamp: i * 1000 });
        mockEventBus.emit('api:request:end', { requestId: `req-${i}`, timestamp: i * 1000 + 100 + i * 10 });
      }

      const stats = monitorInstance.api.getLLMStats();
      expect(stats.p95Latency).toBeGreaterThan(0);
    });

    it('should track API errors', () => {
      mockEventBus.emit('api:request:start', { requestId: 'req-1', timestamp: 1000 });
      mockEventBus.emit('api:request:error', { requestId: 'req-1', error: 'Timeout' });

      const stats = monitorInstance.api.getLLMStats();
      expect(stats.errors).toBe(1);
    });

    it('should calculate error rate', () => {
      mockEventBus.emit('api:request:start', { requestId: 'req-1', timestamp: 1000 });
      mockEventBus.emit('api:request:end', { requestId: 'req-1', timestamp: 1500 });

      mockEventBus.emit('api:request:start', { requestId: 'req-2', timestamp: 2000 });
      mockEventBus.emit('api:request:error', { requestId: 'req-2', error: 'Timeout' });

      const stats = monitorInstance.api.getLLMStats();
      expect(stats.calls).toBe(1);
      expect(stats.errors).toBe(1);
      expect(stats.errorRate).toBe(1);
    });

    it('should calculate average tokens per call', () => {
      mockEventBus.emit('api:request:end', {
        requestId: 'req-1',
        timestamp: 1500,
        tokens: { input: 100, output: 50 }
      });

      mockEventBus.emit('api:request:end', {
        requestId: 'req-2',
        timestamp: 2500,
        tokens: { input: 200, output: 100 }
      });

      const stats = monitorInstance.api.getLLMStats();
      expect(stats.avgTokensPerCall).toBe(225);
    });
  });

  describe('Memory Tracking', () => {
    beforeEach(() => {
      monitorInstance.init();
    });

    it('should sample memory on init', () => {
      const memStats = monitorInstance.api.getMemoryStats();
      expect(memStats).not.toBeNull();
      expect(memStats.samples).toBe(1);
      expect(memStats.current.usedJSHeapSize).toBe(50 * 1024 * 1024);
    });

    it('should sample memory periodically', () => {
      global.performance.memory.usedJSHeapSize = 60 * 1024 * 1024;
      vi.advanceTimersByTime(30000);

      const memStats = monitorInstance.api.getMemoryStats();
      expect(memStats.samples).toBe(2);
    });

    it('should calculate memory statistics', () => {
      global.performance.memory.usedJSHeapSize = 60 * 1024 * 1024;
      vi.advanceTimersByTime(30000);

      const memStats = monitorInstance.api.getMemoryStats();
      expect(memStats.avg).toBeGreaterThan(0);
      expect(memStats.max).toBeGreaterThanOrEqual(memStats.min);
    });

    it('should limit memory samples to 100', () => {
      for (let i = 0; i < 150; i++) {
        vi.advanceTimersByTime(30000);
      }

      const memStats = monitorInstance.api.getMemoryStats();
      expect(memStats.samples).toBeLessThanOrEqual(100);
    });

    it('should return null if no memory samples', () => {
      delete global.performance.memory;
      const freshInstance = PerformanceMonitor.factory(mockDeps);
      freshInstance.init();

      const memStats = freshInstance.api.getMemoryStats();
      expect(memStats).toBeNull();
    });
  });

  describe('Session Metrics', () => {
    beforeEach(() => {
      monitorInstance.init();
    });

    it('should track artifact creation', () => {
      mockEventBus.emit('artifact:created', {});

      const metrics = monitorInstance.api.getMetrics();
      expect(metrics.session.artifacts.created).toBe(1);
    });

    it('should track artifact modifications', () => {
      mockEventBus.emit('artifact:updated', {});
      mockEventBus.emit('artifact:updated', {});

      const metrics = monitorInstance.api.getMetrics();
      expect(metrics.session.artifacts.modified).toBe(2);
    });

    it('should track artifact deletions', () => {
      mockEventBus.emit('artifact:deleted', {});

      const metrics = monitorInstance.api.getMetrics();
      expect(metrics.session.artifacts.deleted).toBe(1);
    });

    it('should track agent cycles', () => {
      mockEventBus.emit('agent:cycle:start', {});
      mockEventBus.emit('agent:cycle:start', {});

      const metrics = monitorInstance.api.getMetrics();
      expect(metrics.session.cycles).toBe(2);
    });

    it('should calculate session uptime', () => {
      vi.advanceTimersByTime(5000);

      const metrics = monitorInstance.api.getMetrics();
      expect(metrics.session.uptime).toBeGreaterThanOrEqual(5000);
    });
  });

  describe('Report Generation', () => {
    beforeEach(() => {
      monitorInstance.init();
    });

    it('should generate complete performance report', () => {
      mockEventBus.emit('tool:start', { toolName: 'ReadFile', timestamp: 1000 });
      mockEventBus.emit('tool:end', { toolName: 'ReadFile', timestamp: 1100 });

      mockEventBus.emit('agent:state:change', { newState: 'thinking', timestamp: 2000 });
      mockEventBus.emit('agent:state:exit', { state: 'thinking', timestamp: 2500 });

      mockEventBus.emit('api:request:start', { requestId: 'req-1', timestamp: 3000 });
      mockEventBus.emit('api:request:end', {
        requestId: 'req-1',
        timestamp: 3500,
        tokens: { input: 100, output: 50 }
      });

      mockEventBus.emit('artifact:created', {});

      const report = monitorInstance.api.generateReport();

      expect(report).toContain('REPLOID Performance Report');
      expect(report).toContain('Session Statistics');
      expect(report).toContain('Tool Performance');
      expect(report).toContain('State Performance');
      expect(report).toContain('LLM API Performance');
      expect(report).toContain('Memory Usage');
    });

    it('should include tool statistics in report', () => {
      mockEventBus.emit('tool:start', { toolName: 'WriteFile', timestamp: 1000 });
      mockEventBus.emit('tool:end', { toolName: 'WriteFile', timestamp: 1200 });

      const report = monitorInstance.api.generateReport();

      expect(report).toContain('WriteFile');
      expect(report).toContain('200.00ms');
    });

    it('should include state statistics in report', () => {
      mockEventBus.emit('agent:state:change', { newState: 'executing', timestamp: 1000 });
      mockEventBus.emit('agent:state:exit', { state: 'executing', timestamp: 1300 });

      const report = monitorInstance.api.generateReport();

      expect(report).toContain('executing');
      expect(report).toContain('300.00ms');
    });
  });

  describe('Reset Functionality', () => {
    beforeEach(() => {
      monitorInstance.init();
    });

    it('should reset all metrics', () => {
      mockEventBus.emit('tool:start', { toolName: 'ReadFile', timestamp: 1000 });
      mockEventBus.emit('tool:end', { toolName: 'ReadFile', timestamp: 1100 });
      mockEventBus.emit('artifact:created', {});

      monitorInstance.api.reset();

      const metrics = monitorInstance.api.getMetrics();
      expect(Object.keys(metrics.tools)).toHaveLength(0);
      expect(Object.keys(metrics.states)).toHaveLength(0);
      expect(metrics.llm.calls).toBe(0);
      expect(metrics.session.artifacts.created).toBe(0);
    });

    it('should log reset operation', () => {
      monitorInstance.api.reset();

      expect(mockDeps.Utils.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Metrics reset')
      );
    });
  });

  describe('Memory Leak Detection', () => {
    beforeEach(() => {
      monitorInstance.init();
    });

    it('should detect memory leaks from continuous growth', () => {
      for (let i = 0; i < 10; i++) {
        global.performance.memory.usedJSHeapSize = 50 * 1024 * 1024 + (i * 5 * 1024 * 1024);
        vi.advanceTimersByTime(30000);
      }

      const memStats = monitorInstance.api.getMemoryStats();
      expect(memStats.max).toBeGreaterThan(memStats.min);
    });

    it('should identify rapid memory increases', () => {
      global.performance.memory.usedJSHeapSize = 50 * 1024 * 1024;
      vi.advanceTimersByTime(30000);

      global.performance.memory.usedJSHeapSize = 150 * 1024 * 1024;
      vi.advanceTimersByTime(30000);

      const memStats = monitorInstance.api.getMemoryStats();
      expect(memStats.max - memStats.min).toBeGreaterThan(50 * 1024 * 1024);
    });

    it('should track memory patterns over time', () => {
      for (let i = 0; i < 5; i++) {
        global.performance.memory.usedJSHeapSize = 50 * 1024 * 1024 + (i * 10 * 1024 * 1024);
        vi.advanceTimersByTime(30000);
      }

      const memStats = monitorInstance.api.getMemoryStats();
      expect(memStats.samples).toBe(6); // initial + 5 samples
    });

    it('should detect memory spikes', () => {
      global.performance.memory.usedJSHeapSize = 50 * 1024 * 1024;
      vi.advanceTimersByTime(30000);

      global.performance.memory.usedJSHeapSize = 200 * 1024 * 1024;
      vi.advanceTimersByTime(30000);

      global.performance.memory.usedJSHeapSize = 60 * 1024 * 1024;
      vi.advanceTimersByTime(30000);

      const memStats = monitorInstance.api.getMemoryStats();
      expect(memStats.max).toBe(200 * 1024 * 1024);
    });
  });

  describe('High-Frequency Metric Collection', () => {
    beforeEach(() => {
      monitorInstance.init();
    });

    it('should handle rapid tool calls', () => {
      for (let i = 0; i < 100; i++) {
        mockEventBus.emit('tool:start', { toolName: 'FastTool', timestamp: 1000 + i });
        mockEventBus.emit('tool:end', { toolName: 'FastTool', timestamp: 1000 + i + 1 });
      }

      const stats = monitorInstance.api.getToolStats('FastTool');
      expect(stats.calls).toBe(100);
    });

    it('should handle concurrent tool executions', () => {
      mockEventBus.emit('tool:start', { toolName: 'Tool1', timestamp: 1000 });
      mockEventBus.emit('tool:start', { toolName: 'Tool2', timestamp: 1001 });
      mockEventBus.emit('tool:start', { toolName: 'Tool3', timestamp: 1002 });

      mockEventBus.emit('tool:end', { toolName: 'Tool2', timestamp: 1050 });
      mockEventBus.emit('tool:end', { toolName: 'Tool1', timestamp: 1100 });
      mockEventBus.emit('tool:end', { toolName: 'Tool3', timestamp: 1150 });

      expect(monitorInstance.api.getToolStats('Tool1')).toBeDefined();
      expect(monitorInstance.api.getToolStats('Tool2')).toBeDefined();
      expect(monitorInstance.api.getToolStats('Tool3')).toBeDefined();
    });

    it('should handle burst metric collection', () => {
      for (let i = 0; i < 1000; i++) {
        mockEventBus.emit('api:request:end', {
          requestId: `req-${i}`,
          timestamp: 1000 + i,
          tokens: { input: 10, output: 5 }
        });
      }

      const stats = monitorInstance.api.getLLMStats();
      expect(stats.calls).toBe(1000);
    });

    it('should maintain accuracy with high-frequency events', () => {
      for (let i = 0; i < 50; i++) {
        mockEventBus.emit('agent:state:change', { newState: 'thinking', timestamp: 1000 + i * 10 });
        mockEventBus.emit('agent:state:exit', { state: 'thinking', timestamp: 1000 + i * 10 + 5 });
      }

      const stats = monitorInstance.api.getStateStats('thinking');
      expect(stats.entries).toBe(50);
      expect(stats.avgTime).toBe(5);
    });
  });

  describe('Metric Aggregation Edge Cases', () => {
    beforeEach(() => {
      monitorInstance.init();
    });

    it('should handle zero duration events', () => {
      mockEventBus.emit('tool:start', { toolName: 'InstantTool', timestamp: 1000 });
      mockEventBus.emit('tool:end', { toolName: 'InstantTool', timestamp: 1000 });

      const stats = monitorInstance.api.getToolStats('InstantTool');
      expect(stats.totalTime).toBe(0);
      expect(stats.avgTime).toBe(0);
    });

    it('should handle missing start event', () => {
      mockEventBus.emit('tool:end', { toolName: 'MissingStart', timestamp: 1000 });

      const stats = monitorInstance.api.getToolStats('MissingStart');
      expect(stats).toBeNull();
    });

    it('should handle missing end event', () => {
      mockEventBus.emit('tool:start', { toolName: 'MissingEnd', timestamp: 1000 });

      const stats = monitorInstance.api.getToolStats('MissingEnd');
      expect(stats.calls).toBe(0);
    });

    it('should handle negative duration protection', () => {
      mockEventBus.emit('tool:start', { toolName: 'TimeTravelTool', timestamp: 2000 });
      mockEventBus.emit('tool:end', { toolName: 'TimeTravelTool', timestamp: 1000 });

      const stats = monitorInstance.api.getToolStats('TimeTravelTool');
      expect(stats.totalTime).toBeLessThanOrEqual(0);
    });

    it('should handle missing token data', () => {
      mockEventBus.emit('api:request:end', {
        requestId: 'req-no-tokens',
        timestamp: 1500
      });

      const stats = monitorInstance.api.getLLMStats();
      expect(stats.tokens.total).toBe(0);
    });

    it('should handle partial token data', () => {
      mockEventBus.emit('api:request:end', {
        requestId: 'req-partial',
        timestamp: 1500,
        tokens: { input: 100 }
      });

      const stats = monitorInstance.api.getLLMStats();
      expect(stats.tokens.input).toBe(100);
      expect(stats.tokens.output).toBe(0);
    });
  });

  describe('Threshold Violation Tests', () => {
    beforeEach(() => {
      monitorInstance.init();
    });

    it('should detect high latency threshold violations', () => {
      for (let i = 0; i < 10; i++) {
        mockEventBus.emit('api:request:start', { requestId: `req-${i}`, timestamp: i * 1000 });
        mockEventBus.emit('api:request:end', { requestId: `req-${i}`, timestamp: i * 1000 + 5000 });
      }

      const stats = monitorInstance.api.getLLMStats();
      expect(stats.avgLatency).toBeGreaterThan(4000);
    });

    it('should detect high error rate threshold', () => {
      for (let i = 0; i < 10; i++) {
        mockEventBus.emit('tool:start', { toolName: 'FlakyTool', timestamp: i * 100 });
        if (i < 7) {
          mockEventBus.emit('tool:error', { toolName: 'FlakyTool', error: 'Fail' });
        } else {
          mockEventBus.emit('tool:end', { toolName: 'FlakyTool', timestamp: i * 100 + 10 });
        }
      }

      const stats = monitorInstance.api.getToolStats('FlakyTool');
      expect(stats.errorRate).toBeGreaterThan(0.5);
    });

    it('should warn on critical memory usage', () => {
      global.performance.memory.usedJSHeapSize = 1900 * 1024 * 1024;
      global.performance.memory.jsHeapSizeLimit = 2048 * 1024 * 1024;
      vi.advanceTimersByTime(30000);

      const memStats = monitorInstance.api.getMemoryStats();
      const usage = memStats.current.usedJSHeapSize / memStats.current.jsHeapSizeLimit;
      expect(usage).toBeGreaterThan(0.9);
    });

    it('should detect execution time outliers', () => {
      for (let i = 0; i < 9; i++) {
        mockEventBus.emit('tool:start', { toolName: 'ConsistentTool', timestamp: i * 100 });
        mockEventBus.emit('tool:end', { toolName: 'ConsistentTool', timestamp: i * 100 + 10 });
      }

      mockEventBus.emit('tool:start', { toolName: 'ConsistentTool', timestamp: 1000 });
      mockEventBus.emit('tool:end', { toolName: 'ConsistentTool', timestamp: 6000 });

      const stats = monitorInstance.api.getToolStats('ConsistentTool');
      expect(stats.totalTime).toBeGreaterThan(5000);
    });
  });

  describe('Concurrent Monitoring Scenarios', () => {
    beforeEach(() => {
      monitorInstance.init();
    });

    it('should handle concurrent state transitions', () => {
      mockEventBus.emit('agent:state:change', { newState: 'idle', timestamp: 1000 });
      mockEventBus.emit('agent:state:change', { newState: 'thinking', timestamp: 1001 });
      mockEventBus.emit('agent:state:exit', { state: 'idle', timestamp: 1100 });
      mockEventBus.emit('agent:state:exit', { state: 'thinking', timestamp: 1150 });

      expect(monitorInstance.api.getStateStats('idle')).toBeDefined();
      expect(monitorInstance.api.getStateStats('thinking')).toBeDefined();
    });

    it('should handle overlapping tool executions', () => {
      mockEventBus.emit('tool:start', { toolName: 'SlowTool', timestamp: 1000 });
      mockEventBus.emit('tool:start', { toolName: 'FastTool', timestamp: 1100 });
      mockEventBus.emit('tool:end', { toolName: 'FastTool', timestamp: 1150 });
      mockEventBus.emit('tool:end', { toolName: 'SlowTool', timestamp: 2000 });

      expect(monitorInstance.api.getToolStats('SlowTool').totalTime).toBe(1000);
      expect(monitorInstance.api.getToolStats('FastTool').totalTime).toBe(50);
    });

    it('should handle concurrent API requests', () => {
      for (let i = 0; i < 5; i++) {
        mockEventBus.emit('api:request:start', { requestId: `concurrent-${i}`, timestamp: 1000 + i });
      }

      for (let i = 0; i < 5; i++) {
        mockEventBus.emit('api:request:end', {
          requestId: `concurrent-${i}`,
          timestamp: 1500 + i,
          tokens: { input: 50, output: 25 }
        });
      }

      const stats = monitorInstance.api.getLLMStats();
      expect(stats.calls).toBe(5);
    });

    it('should maintain consistency under concurrent updates', () => {
      const events = [];
      for (let i = 0; i < 100; i++) {
        events.push(() => mockEventBus.emit('artifact:created', {}));
        events.push(() => mockEventBus.emit('artifact:updated', {}));
        events.push(() => mockEventBus.emit('agent:cycle:start', {}));
      }

      events.forEach(fn => fn());

      const metrics = monitorInstance.api.getMetrics();
      expect(metrics.session.artifacts.created).toBe(100);
      expect(metrics.session.artifacts.modified).toBe(100);
      expect(metrics.session.cycles).toBe(100);
    });
  });

  describe('Metric Storage Overflow Tests', () => {
    beforeEach(() => {
      monitorInstance.init();
    });

    it('should limit memory samples to 100', () => {
      for (let i = 0; i < 150; i++) {
        global.performance.memory.usedJSHeapSize = 50 * 1024 * 1024 + i;
        vi.advanceTimersByTime(30000);
      }

      const memStats = monitorInstance.api.getMemoryStats();
      expect(memStats.samples).toBe(100);
    });

    it('should handle large number of latency samples', () => {
      for (let i = 0; i < 1000; i++) {
        mockEventBus.emit('api:request:start', { requestId: `load-${i}`, timestamp: i * 10 });
        mockEventBus.emit('api:request:end', { requestId: `load-${i}`, timestamp: i * 10 + 100 });
      }

      const stats = monitorInstance.api.getLLMStats();
      expect(stats.latency.length).toBe(1000);
    });

    it('should maintain performance with many tools tracked', () => {
      for (let i = 0; i < 500; i++) {
        mockEventBus.emit('tool:start', { toolName: `Tool${i}`, timestamp: i * 10 });
        mockEventBus.emit('tool:end', { toolName: `Tool${i}`, timestamp: i * 10 + 5 });
      }

      const metrics = monitorInstance.api.getMetrics();
      expect(Object.keys(metrics.tools).length).toBe(500);
    });

    it('should handle continuous metric accumulation', () => {
      for (let i = 0; i < 10000; i++) {
        mockEventBus.emit('api:request:end', {
          requestId: `req-${i}`,
          timestamp: i,
          tokens: { input: 1, output: 1 }
        });
      }

      const stats = monitorInstance.api.getLLMStats();
      expect(stats.tokens.total).toBe(20000);
    });
  });

  describe('Report Generation Edge Cases', () => {
    beforeEach(() => {
      monitorInstance.init();
    });

    it('should generate report with no data', () => {
      const report = monitorInstance.api.generateReport();

      expect(report).toContain('REPLOID Performance Report');
      expect(report).toContain('Session Statistics');
    });

    it('should handle very long tool names', () => {
      const longName = 'A'.repeat(200);
      mockEventBus.emit('tool:start', { toolName: longName, timestamp: 1000 });
      mockEventBus.emit('tool:end', { toolName: longName, timestamp: 1100 });

      const report = monitorInstance.api.generateReport();
      expect(report).toContain(longName);
    });

    it('should format large numbers correctly', () => {
      for (let i = 0; i < 1000; i++) {
        mockEventBus.emit('tool:start', { toolName: 'ManyTool', timestamp: i * 100 });
        mockEventBus.emit('tool:end', { toolName: 'ManyTool', timestamp: i * 100 + 50 });
      }

      const report = monitorInstance.api.generateReport();
      expect(report).toContain('1000');
    });

    it('should include all sections even with missing data', () => {
      mockEventBus.emit('tool:start', { toolName: 'OnlyTool', timestamp: 1000 });
      mockEventBus.emit('tool:end', { toolName: 'OnlyTool', timestamp: 1100 });

      const report = monitorInstance.api.generateReport();
      expect(report).toContain('Tool Performance');
      expect(report).toContain('LLM API Performance');
      expect(report).toContain('Memory Usage');
    });
  });

  describe('Edge Case Handling', () => {
    beforeEach(() => {
      monitorInstance.init();
    });

    it('should handle undefined timestamps', () => {
      mockEventBus.emit('tool:start', { toolName: 'NoTimestamp' });
      mockEventBus.emit('tool:end', { toolName: 'NoTimestamp' });

      const stats = monitorInstance.api.getToolStats('NoTimestamp');
      expect(stats).toBeDefined();
    });

    it('should handle empty tool names', () => {
      mockEventBus.emit('tool:start', { toolName: '', timestamp: 1000 });
      mockEventBus.emit('tool:end', { toolName: '', timestamp: 1100 });

      const stats = monitorInstance.api.getToolStats('');
      expect(stats).toBeDefined();
    });

    it('should handle null error messages', () => {
      mockEventBus.emit('tool:start', { toolName: 'ErrorTool', timestamp: 1000 });
      mockEventBus.emit('tool:error', { toolName: 'ErrorTool', error: null });

      const stats = monitorInstance.api.getToolStats('ErrorTool');
      expect(stats.errors).toBe(1);
    });

    it('should handle median calculation with even number of samples', () => {
      mockEventBus.emit('api:request:start', { requestId: 'req-1', timestamp: 1000 });
      mockEventBus.emit('api:request:end', { requestId: 'req-1', timestamp: 1100 });
      mockEventBus.emit('api:request:start', { requestId: 'req-2', timestamp: 2000 });
      mockEventBus.emit('api:request:end', { requestId: 'req-2', timestamp: 2500 });

      const stats = monitorInstance.api.getLLMStats();
      expect(stats.medianLatency).toBe(300);
    });

    it('should handle p95 calculation with insufficient samples', () => {
      mockEventBus.emit('api:request:start', { requestId: 'req-1', timestamp: 1000 });
      mockEventBus.emit('api:request:end', { requestId: 'req-1', timestamp: 1100 });

      const stats = monitorInstance.api.getLLMStats();
      expect(stats.p95Latency).toBe(100);
    });
  });
});
