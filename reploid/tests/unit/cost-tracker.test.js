import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('CostTracker Module', () => {
  let CostTracker;
  let mockDeps;
  let trackerInstance;
  let mockEventBus;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T10:00:00Z'));

    let eventHandlers = {};

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

    mockDeps = {
      EventBus: mockEventBus,
      Utils: {
        logger: {
          info: vi.fn(),
          debug: vi.fn(),
          warn: vi.fn(),
          error: vi.fn()
        }
      },
      StateManager: {
        getState: vi.fn().mockResolvedValue({}),
        updateState: vi.fn().mockResolvedValue(undefined)
      }
    };

    CostTracker = {
      metadata: {
        id: 'CostTracker',
        version: '1.0.0',
        dependencies: ['EventBus', 'Utils', 'StateManager'],
        async: true,
        type: 'analytics'
      },
      factory: (deps) => {
        const { EventBus, Utils, StateManager } = deps;
        const { logger } = Utils;

        const PRICING = {
          'gemini': { input: 0.075, output: 0.30, name: 'Gemini 1.5 Flash' },
          'gemini-pro': { input: 0.35, output: 1.05, name: 'Gemini 1.5 Pro' },
          'openai': { input: 10.00, output: 30.00, name: 'GPT-4 Turbo' },
          'anthropic': { input: 3.00, output: 15.00, name: 'Claude 3 Opus' },
          'local': { input: 0, output: 0, name: 'Local LLM' }
        };

        const RATE_LIMITS = {
          'gemini': 15,
          'gemini-pro': 2,
          'openai': 10,
          'anthropic': 5,
          'local': null
        };

        let sessionStart = Date.now();
        let apiCalls = [];
        let rateLimitBuckets = {};

        const init = async () => {
          logger.info('[CostTracker] Initializing API cost tracking');

          EventBus.on('api:complete', handleApiComplete);
          EventBus.on('hybrid-llm:complete', handleHybridComplete);
          EventBus.on('local-llm:complete', handleLocalComplete);

          const state = await StateManager.getState();
          if (state.costTracking) {
            apiCalls = state.costTracking.apiCalls || [];
            sessionStart = state.costTracking.sessionStart || Date.now();
            logger.info(`[CostTracker] Restored ${apiCalls.length} API calls from state`);
          }

          return true;
        };

        const calculateCost = (call) => {
          const pricing = PRICING[call.provider] || PRICING['gemini'];
          const inputCost = (call.inputTokens / 1000000) * pricing.input;
          const outputCost = (call.outputTokens / 1000000) * pricing.output;
          return inputCost + outputCost;
        };

        const persistState = async () => {
          await StateManager.updateState(state => {
            state.costTracking = {
              apiCalls,
              sessionStart,
              lastUpdated: Date.now()
            };
            return state;
          });
        };

        const handleApiComplete = (data) => {
          const { provider, usage, timestamp } = data;

          if (!usage) return;

          const call = {
            timestamp: timestamp || Date.now(),
            provider: provider || 'gemini',
            inputTokens: usage.promptTokenCount || usage.prompt_tokens || 0,
            outputTokens: usage.candidatesTokenCount || usage.completion_tokens || 0,
            totalTokens: usage.totalTokenCount || usage.total_tokens || 0
          };

          call.cost = calculateCost(call);
          apiCalls.push(call);

          logger.debug(`[CostTracker] Logged API call: $${call.cost.toFixed(4)} (${call.provider})`);

          persistState();

          EventBus.emit('cost:updated', {
            totalCost: getTotalCost(),
            sessionCost: getSessionCost(),
            apiCalls: apiCalls.length
          });
        };

        const handleHybridComplete = (data) => {
          if (data.provider === 'cloud' && data.usage) {
            handleApiComplete({
              provider: 'gemini',
              usage: data.usage,
              timestamp: Date.now()
            });
          } else if (data.provider === 'local') {
            handleLocalComplete(data);
          }
        };

        const handleLocalComplete = (data) => {
          const call = {
            timestamp: Date.now(),
            provider: 'local',
            inputTokens: data.usage?.promptTokens || 0,
            outputTokens: data.usage?.completionTokens || 0,
            totalTokens: data.usage?.totalTokens || 0,
            cost: 0
          };

          apiCalls.push(call);
          persistState();
        };

        const checkRateLimit = (provider) => {
          const limit = RATE_LIMITS[provider];

          if (limit === null) return true;

          if (!rateLimitBuckets[provider]) {
            rateLimitBuckets[provider] = [];
          }

          const now = Date.now();
          const oneMinuteAgo = now - 60000;

          rateLimitBuckets[provider] = rateLimitBuckets[provider].filter(
            ts => ts > oneMinuteAgo
          );

          if (rateLimitBuckets[provider].length >= limit) {
            const oldestRequest = rateLimitBuckets[provider][0];
            const waitTime = Math.ceil((oldestRequest + 60000 - now) / 1000);

            logger.warn(`[CostTracker] Rate limit exceeded for ${provider}. Wait ${waitTime}s`);

            EventBus.emit('rate-limit:exceeded', {
              provider,
              limit,
              waitTime
            });

            return false;
          }

          rateLimitBuckets[provider].push(now);
          return true;
        };

        const getTotalCost = () => {
          return apiCalls.reduce((sum, call) => sum + (call.cost || 0), 0);
        };

        const getSessionCost = () => {
          return apiCalls
            .filter(call => call.timestamp >= sessionStart)
            .reduce((sum, call) => sum + (call.cost || 0), 0);
        };

        const getCostByProvider = () => {
          const breakdown = {};

          for (const call of apiCalls) {
            if (!breakdown[call.provider]) {
              breakdown[call.provider] = {
                count: 0,
                totalCost: 0,
                inputTokens: 0,
                outputTokens: 0,
                name: PRICING[call.provider]?.name || call.provider
              };
            }

            breakdown[call.provider].count++;
            breakdown[call.provider].totalCost += call.cost || 0;
            breakdown[call.provider].inputTokens += call.inputTokens || 0;
            breakdown[call.provider].outputTokens += call.outputTokens || 0;
          }

          return breakdown;
        };

        const getCostStats = (periodMs = 86400000) => {
          const now = Date.now();
          const periodStart = now - periodMs;

          const periodCalls = apiCalls.filter(call => call.timestamp >= periodStart);

          return {
            period: periodMs,
            callCount: periodCalls.length,
            totalCost: periodCalls.reduce((sum, call) => sum + (call.cost || 0), 0),
            avgCostPerCall: periodCalls.length > 0
              ? periodCalls.reduce((sum, call) => sum + (call.cost || 0), 0) / periodCalls.length
              : 0,
            inputTokens: periodCalls.reduce((sum, call) => sum + (call.inputTokens || 0), 0),
            outputTokens: periodCalls.reduce((sum, call) => sum + (call.outputTokens || 0), 0)
          };
        };

        const getRateLimitStatus = () => {
          const status = {};

          for (const provider in RATE_LIMITS) {
            const limit = RATE_LIMITS[provider];
            if (limit === null) {
              status[provider] = { limit: null, used: 0, available: Infinity };
              continue;
            }

            const bucket = rateLimitBuckets[provider] || [];
            const now = Date.now();
            const oneMinuteAgo = now - 60000;

            const used = bucket.filter(ts => ts > oneMinuteAgo).length;

            status[provider] = {
              limit,
              used,
              available: limit - used,
              resetIn: bucket.length > 0 ? Math.ceil((bucket[0] + 60000 - now) / 1000) : 0
            };
          }

          return status;
        };

        const generateReport = () => {
          const breakdown = getCostByProvider();
          const stats24h = getCostStats(86400000);
          const rateLimits = getRateLimitStatus();

          let report = '# API Cost & Usage Report\n\n';

          report += `**Session Duration:** ${((Date.now() - sessionStart) / 1000 / 60).toFixed(1)} minutes\n`;
          report += `**Total API Calls:** ${apiCalls.length}\n`;
          report += `**Session Cost:** $${getSessionCost().toFixed(4)}\n`;
          report += `**All-Time Cost:** $${getTotalCost().toFixed(4)}\n\n`;

          report += '## Last 24 Hours\n\n';
          report += `**Calls:** ${stats24h.callCount}\n`;
          report += `**Cost:** $${stats24h.totalCost.toFixed(4)}\n`;
          report += `**Avg Cost/Call:** $${stats24h.avgCostPerCall.toFixed(4)}\n`;
          report += `**Input Tokens:** ${stats24h.inputTokens.toLocaleString()}\n`;
          report += `**Output Tokens:** ${stats24h.outputTokens.toLocaleString()}\n\n`;

          report += '## Cost by Provider\n\n';
          report += '| Provider | Calls | Cost | Input Tokens | Output Tokens |\n';
          report += '|----------|-------|------|--------------|---------------|\n';

          for (const [provider, data] of Object.entries(breakdown)) {
            report += `| ${data.name} | ${data.count} | $${data.totalCost.toFixed(4)} | ${data.inputTokens.toLocaleString()} | ${data.outputTokens.toLocaleString()} |\n`;
          }
          report += '\n';

          report += '## Rate Limit Status\n\n';
          report += '| Provider | Used | Available | Limit | Reset In |\n';
          report += '|----------|------|-----------|-------|----------|\n';

          for (const [provider, status] of Object.entries(rateLimits)) {
            const limitStr = status.limit === null ? '∞' : status.limit;
            const availableStr = status.available === Infinity ? '∞' : status.available;
            const resetStr = status.resetIn > 0 ? `${status.resetIn}s` : '-';

            report += `| ${provider} | ${status.used} | ${availableStr} | ${limitStr} | ${resetStr} |\n`;
          }

          return report;
        };

        const resetSession = () => {
          sessionStart = Date.now();
          apiCalls = apiCalls.filter(call => call.timestamp < sessionStart);
          rateLimitBuckets = {};
          persistState();
          logger.info('[CostTracker] Session reset');
        };

        const clearAll = () => {
          apiCalls = [];
          rateLimitBuckets = {};
          sessionStart = Date.now();
          persistState();
          logger.info('[CostTracker] All tracking data cleared');
        };

        return {
          init,
          api: {
            checkRateLimit,
            getTotalCost,
            getSessionCost,
            getCostByProvider,
            getCostStats,
            getRateLimitStatus,
            generateReport,
            resetSession,
            clearAll,
            getApiCalls: () => [...apiCalls],
            getPricing: () => ({ ...PRICING }),
            getRateLimits: () => ({ ...RATE_LIMITS })
          }
        };
      }
    };

    trackerInstance = CostTracker.factory(mockDeps);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('Module Metadata', () => {
    it('should have correct metadata', () => {
      expect(CostTracker.metadata.id).toBe('CostTracker');
      expect(CostTracker.metadata.version).toBe('1.0.0');
      expect(CostTracker.metadata.type).toBe('analytics');
    });

    it('should declare required dependencies', () => {
      expect(CostTracker.metadata.dependencies).toContain('EventBus');
      expect(CostTracker.metadata.dependencies).toContain('Utils');
      expect(CostTracker.metadata.dependencies).toContain('StateManager');
    });

    it('should be async type', () => {
      expect(CostTracker.metadata.async).toBe(true);
    });
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      const result = await trackerInstance.init();

      expect(result).toBe(true);
      expect(mockEventBus.on).toHaveBeenCalledWith('api:complete', expect.any(Function));
      expect(mockEventBus.on).toHaveBeenCalledWith('hybrid-llm:complete', expect.any(Function));
      expect(mockEventBus.on).toHaveBeenCalledWith('local-llm:complete', expect.any(Function));
    });

    it('should restore state on init', async () => {
      const savedCalls = [
        { provider: 'gemini', cost: 0.01, timestamp: Date.now() }
      ];

      mockDeps.StateManager.getState.mockResolvedValue({
        costTracking: {
          apiCalls: savedCalls,
          sessionStart: Date.now() - 1000
        }
      });

      await trackerInstance.init();

      expect(mockDeps.Utils.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Restored 1 API calls')
      );
    });
  });

  describe('API Call Tracking', () => {
    beforeEach(async () => {
      await trackerInstance.init();
    });

    it('should track API call with Gemini format', () => {
      mockEventBus.emit('api:complete', {
        provider: 'gemini',
        usage: {
          promptTokenCount: 1000,
          candidatesTokenCount: 500,
          totalTokenCount: 1500
        }
      });

      const calls = trackerInstance.api.getApiCalls();
      expect(calls).toHaveLength(1);
      expect(calls[0].inputTokens).toBe(1000);
      expect(calls[0].outputTokens).toBe(500);
    });

    it('should track API call with OpenAI format', () => {
      mockEventBus.emit('api:complete', {
        provider: 'openai',
        usage: {
          prompt_tokens: 2000,
          completion_tokens: 1000,
          total_tokens: 3000
        }
      });

      const calls = trackerInstance.api.getApiCalls();
      expect(calls).toHaveLength(1);
      expect(calls[0].inputTokens).toBe(2000);
      expect(calls[0].outputTokens).toBe(1000);
    });

    it('should calculate cost correctly for Gemini', () => {
      mockEventBus.emit('api:complete', {
        provider: 'gemini',
        usage: {
          promptTokenCount: 1000000,
          candidatesTokenCount: 1000000
        }
      });

      const calls = trackerInstance.api.getApiCalls();
      // (1M / 1M) * 0.075 + (1M / 1M) * 0.30 = 0.375
      expect(calls[0].cost).toBeCloseTo(0.375, 4);
    });

    it('should emit cost:updated event', () => {
      mockEventBus.emit('api:complete', {
        provider: 'gemini',
        usage: {
          promptTokenCount: 1000,
          candidatesTokenCount: 500
        }
      });

      expect(mockEventBus.emit).toHaveBeenCalledWith('cost:updated', expect.objectContaining({
        totalCost: expect.any(Number),
        sessionCost: expect.any(Number),
        apiCalls: 1
      }));
    });

    it('should ignore API calls without usage data', () => {
      mockEventBus.emit('api:complete', {
        provider: 'gemini'
      });

      const calls = trackerInstance.api.getApiCalls();
      expect(calls).toHaveLength(0);
    });

    it('should default to gemini provider', () => {
      mockEventBus.emit('api:complete', {
        usage: {
          promptTokenCount: 1000,
          candidatesTokenCount: 500
        }
      });

      const calls = trackerInstance.api.getApiCalls();
      expect(calls[0].provider).toBe('gemini');
    });
  });

  describe('Hybrid LLM Tracking', () => {
    beforeEach(async () => {
      await trackerInstance.init();
    });

    it('should track cloud provider from hybrid', () => {
      mockEventBus.emit('hybrid-llm:complete', {
        provider: 'cloud',
        usage: {
          promptTokenCount: 1000,
          candidatesTokenCount: 500
        }
      });

      const calls = trackerInstance.api.getApiCalls();
      expect(calls).toHaveLength(1);
      expect(calls[0].provider).toBe('gemini');
    });

    it('should track local provider from hybrid', () => {
      mockEventBus.emit('hybrid-llm:complete', {
        provider: 'local',
        usage: {
          promptTokens: 1000,
          completionTokens: 500
        }
      });

      const calls = trackerInstance.api.getApiCalls();
      expect(calls).toHaveLength(1);
      expect(calls[0].provider).toBe('local');
      expect(calls[0].cost).toBe(0);
    });
  });

  describe('Local LLM Tracking', () => {
    beforeEach(async () => {
      await trackerInstance.init();
    });

    it('should track local LLM calls with zero cost', () => {
      mockEventBus.emit('local-llm:complete', {
        usage: {
          promptTokens: 1000,
          completionTokens: 500,
          totalTokens: 1500
        }
      });

      const calls = trackerInstance.api.getApiCalls();
      expect(calls).toHaveLength(1);
      expect(calls[0].provider).toBe('local');
      expect(calls[0].cost).toBe(0);
    });
  });

  describe('Cost Calculations', () => {
    beforeEach(async () => {
      await trackerInstance.init();
    });

    it('should calculate total cost', () => {
      mockEventBus.emit('api:complete', {
        provider: 'gemini',
        usage: { promptTokenCount: 1000000, candidatesTokenCount: 1000000 }
      });
      mockEventBus.emit('api:complete', {
        provider: 'gemini',
        usage: { promptTokenCount: 500000, candidatesTokenCount: 500000 }
      });

      const totalCost = trackerInstance.api.getTotalCost();
      expect(totalCost).toBeGreaterThan(0);
    });

    it('should calculate session cost', () => {
      mockEventBus.emit('api:complete', {
        provider: 'gemini',
        usage: { promptTokenCount: 1000000, candidatesTokenCount: 1000000 }
      });

      const sessionCost = trackerInstance.api.getSessionCost();
      expect(sessionCost).toBeGreaterThan(0);
    });

    it('should calculate cost by provider', () => {
      mockEventBus.emit('api:complete', {
        provider: 'gemini',
        usage: { promptTokenCount: 1000000, candidatesTokenCount: 1000000 }
      });
      mockEventBus.emit('api:complete', {
        provider: 'openai',
        usage: { prompt_tokens: 1000000, completion_tokens: 1000000 }
      });

      const breakdown = trackerInstance.api.getCostByProvider();

      expect(breakdown).toHaveProperty('gemini');
      expect(breakdown).toHaveProperty('openai');
      expect(breakdown.gemini.count).toBe(1);
      expect(breakdown.openai.count).toBe(1);
    });

    it('should calculate stats for time period', () => {
      mockEventBus.emit('api:complete', {
        provider: 'gemini',
        usage: { promptTokenCount: 1000000, candidatesTokenCount: 1000000 }
      });

      vi.advanceTimersByTime(60000);

      mockEventBus.emit('api:complete', {
        provider: 'gemini',
        usage: { promptTokenCount: 1000000, candidatesTokenCount: 1000000 }
      });

      const stats = trackerInstance.api.getCostStats(120000);

      expect(stats.callCount).toBe(2);
      expect(stats.totalCost).toBeGreaterThan(0);
      expect(stats.avgCostPerCall).toBeGreaterThan(0);
    });
  });

  describe('Rate Limiting', () => {
    beforeEach(async () => {
      await trackerInstance.init();
    });

    it('should allow requests under limit', () => {
      const result = trackerInstance.api.checkRateLimit('gemini');
      expect(result).toBe(true);
    });

    it('should enforce rate limit', () => {
      const limit = trackerInstance.api.getRateLimits()['gemini'];

      for (let i = 0; i < limit; i++) {
        expect(trackerInstance.api.checkRateLimit('gemini')).toBe(true);
      }

      expect(trackerInstance.api.checkRateLimit('gemini')).toBe(false);
    });

    it('should emit rate-limit:exceeded event', () => {
      const limit = trackerInstance.api.getRateLimits()['openai'];

      for (let i = 0; i < limit; i++) {
        trackerInstance.api.checkRateLimit('openai');
      }

      trackerInstance.api.checkRateLimit('openai');

      expect(mockEventBus.emit).toHaveBeenCalledWith('rate-limit:exceeded', expect.objectContaining({
        provider: 'openai',
        limit: 10
      }));
    });

    it('should reset rate limit after 1 minute', () => {
      trackerInstance.api.checkRateLimit('anthropic');
      trackerInstance.api.checkRateLimit('anthropic');

      vi.advanceTimersByTime(61000);

      const result = trackerInstance.api.checkRateLimit('anthropic');
      expect(result).toBe(true);
    });

    it('should allow unlimited local requests', () => {
      for (let i = 0; i < 1000; i++) {
        expect(trackerInstance.api.checkRateLimit('local')).toBe(true);
      }
    });

    it('should get rate limit status', () => {
      trackerInstance.api.checkRateLimit('gemini');
      trackerInstance.api.checkRateLimit('gemini');

      const status = trackerInstance.api.getRateLimitStatus();

      expect(status.gemini.used).toBe(2);
      expect(status.gemini.available).toBe(13);
      expect(status.gemini.limit).toBe(15);
    });

    it('should calculate reset time', () => {
      const limit = trackerInstance.api.getRateLimits()['gemini-pro'];

      for (let i = 0; i < limit; i++) {
        trackerInstance.api.checkRateLimit('gemini-pro');
      }

      const status = trackerInstance.api.getRateLimitStatus();
      expect(status['gemini-pro'].resetIn).toBeGreaterThan(0);
    });
  });

  describe('Report Generation', () => {
    beforeEach(async () => {
      await trackerInstance.init();
    });

    it('should generate comprehensive report', () => {
      mockEventBus.emit('api:complete', {
        provider: 'gemini',
        usage: { promptTokenCount: 1000000, candidatesTokenCount: 1000000 }
      });

      const report = trackerInstance.api.generateReport();

      expect(report).toContain('# API Cost & Usage Report');
      expect(report).toContain('Session Duration');
      expect(report).toContain('Total API Calls');
      expect(report).toContain('Last 24 Hours');
      expect(report).toContain('Cost by Provider');
      expect(report).toContain('Rate Limit Status');
    });

    it('should include provider breakdown in report', () => {
      mockEventBus.emit('api:complete', {
        provider: 'gemini',
        usage: { promptTokenCount: 1000, candidatesTokenCount: 500 }
      });

      const report = trackerInstance.api.generateReport();

      expect(report).toContain('Gemini 1.5 Flash');
    });

    it('should include rate limits in report', () => {
      trackerInstance.api.checkRateLimit('openai');

      const report = trackerInstance.api.generateReport();

      expect(report).toContain('openai');
    });
  });

  describe('Session Management', () => {
    beforeEach(async () => {
      await trackerInstance.init();
    });

    it('should reset session', () => {
      mockEventBus.emit('api:complete', {
        provider: 'gemini',
        usage: { promptTokenCount: 1000, candidatesTokenCount: 500 }
      });

      trackerInstance.api.resetSession();

      expect(trackerInstance.api.getSessionCost()).toBe(0);
      expect(mockDeps.Utils.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Session reset')
      );
    });

    it('should retain historical data after reset', () => {
      mockEventBus.emit('api:complete', {
        provider: 'gemini',
        usage: { promptTokenCount: 1000, candidatesTokenCount: 500 }
      });

      const costBefore = trackerInstance.api.getTotalCost();

      // Advance time so the call becomes "historical"
      vi.advanceTimersByTime(1000);

      trackerInstance.api.resetSession();

      expect(trackerInstance.api.getTotalCost()).toBe(costBefore);
    });

    it('should clear all data', () => {
      mockEventBus.emit('api:complete', {
        provider: 'gemini',
        usage: { promptTokenCount: 1000, candidatesTokenCount: 500 }
      });

      trackerInstance.api.clearAll();

      expect(trackerInstance.api.getTotalCost()).toBe(0);
      expect(trackerInstance.api.getApiCalls()).toHaveLength(0);
    });

    it('should clear rate limit buckets on clear', () => {
      trackerInstance.api.checkRateLimit('gemini');

      trackerInstance.api.clearAll();

      const status = trackerInstance.api.getRateLimitStatus();
      expect(status.gemini.used).toBe(0);
    });
  });

  describe('Data Access', () => {
    it('should provide pricing information', () => {
      const pricing = trackerInstance.api.getPricing();

      expect(pricing).toHaveProperty('gemini');
      expect(pricing).toHaveProperty('openai');
      expect(pricing).toHaveProperty('local');
      expect(pricing.gemini.input).toBe(0.075);
    });

    it('should provide rate limits', () => {
      const limits = trackerInstance.api.getRateLimits();

      expect(limits).toHaveProperty('gemini');
      expect(limits.gemini).toBe(15);
      expect(limits.local).toBeNull();
    });

    it('should return copy of API calls', async () => {
      await trackerInstance.init();

      mockEventBus.emit('api:complete', {
        provider: 'gemini',
        usage: { promptTokenCount: 1000, candidatesTokenCount: 500 }
      });

      const calls1 = trackerInstance.api.getApiCalls();
      const calls2 = trackerInstance.api.getApiCalls();

      expect(calls1).not.toBe(calls2);
      expect(calls1).toEqual(calls2);
    });
  });

  describe('State Persistence', () => {
    beforeEach(async () => {
      await trackerInstance.init();
    });

    it('should persist state on API call', () => {
      mockEventBus.emit('api:complete', {
        provider: 'gemini',
        usage: { promptTokenCount: 1000, candidatesTokenCount: 500 }
      });

      expect(mockDeps.StateManager.updateState).toHaveBeenCalled();
    });

    it('should persist state on session reset', () => {
      trackerInstance.api.resetSession();

      expect(mockDeps.StateManager.updateState).toHaveBeenCalled();
    });

    it('should persist state on clear all', () => {
      trackerInstance.api.clearAll();

      expect(mockDeps.StateManager.updateState).toHaveBeenCalled();
    });
  });
});
