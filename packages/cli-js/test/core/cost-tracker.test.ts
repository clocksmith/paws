/**
 * Unit tests for cost tracking
 */

import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { CostTracker, FileCostStorage, TokenUsage } from '../../src/core/cost-tracker';

describe('Cost Tracking', () => {
  let testDir: string;
  let storage: FileCostStorage;
  let tracker: CostTracker;

  beforeEach(() => {
    // Create temp directory for tests
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'paws-cost-test-'));
    storage = new FileCostStorage(testDir);

    // Create tracker with test pricing
    const pricing = new Map([
      ['test-model', { inputCostPer1kTokens: 0.01, outputCostPer1kTokens: 0.03 }],
      ['free-model', { inputCostPer1kTokens: 0.0, outputCostPer1kTokens: 0.0 }],
    ]);

    tracker = new CostTracker({
      storage,
      pricing,
    });
  });

  afterEach(() => {
    // Clean up temp directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('CostTracker', () => {
    it('should calculate cost correctly', () => {
      const tokens: TokenUsage = {
        inputTokens: 1000,
        outputTokens: 2000,
        totalTokens: 3000,
      };

      const cost = tracker.calculateCost('test-model', tokens);

      // (1000/1000 * 0.01) + (2000/1000 * 0.03) = 0.01 + 0.06 = 0.07
      expect(cost).to.equal(0.07);
    });

    it('should handle free models', () => {
      const tokens: TokenUsage = {
        inputTokens: 10000,
        outputTokens: 10000,
        totalTokens: 20000,
      };

      const cost = tracker.calculateCost('free-model', tokens);
      expect(cost).to.equal(0);
    });

    it('should track operations', async () => {
      const tokens: TokenUsage = {
        inputTokens: 500,
        outputTokens: 1000,
        totalTokens: 1500,
      };

      const operation = await tracker.trackOperation('test-model', 'test-provider', tokens, {
        operationType: 'generation',
        sessionId: 'test-session',
      });

      expect(operation.operationId).to.exist;
      expect(operation.cost).to.equal(0.035);
      expect(operation.modelId).to.equal('test-model');
      expect(operation.provider).to.equal('test-provider');
    });

    it('should generate summaries', async () => {
      // Track multiple operations
      const tokens: TokenUsage = {
        inputTokens: 1000,
        outputTokens: 1000,
        totalTokens: 2000,
      };

      await tracker.trackOperation('test-model', 'provider-1', tokens, {
        operationType: 'generation',
      });

      await tracker.trackOperation('test-model', 'provider-1', tokens, {
        operationType: 'embedding',
      });

      await tracker.trackOperation('free-model', 'provider-2', tokens);

      const summary = await tracker.getSummary();

      expect(summary.operationCount).to.equal(3);
      expect(summary.totalTokens).to.equal(6000);
      expect(summary.totalCost).to.be.greaterThan(0);

      // Check breakdowns
      expect(summary.byModel['test-model']).to.exist;
      expect(summary.byModel['test-model'].operationCount).to.equal(2);

      expect(summary.byProvider['provider-1']).to.exist;
      expect(summary.byProvider['provider-1'].operationCount).to.equal(2);

      expect(summary.byOperationType['generation']).to.exist;
    });

    it('should track session costs', async () => {
      const tokens: TokenUsage = {
        inputTokens: 1000,
        outputTokens: 1000,
        totalTokens: 2000,
      };

      await tracker.trackOperation('test-model', 'test-provider', tokens, {
        sessionId: 'session-1',
      });

      await tracker.trackOperation('test-model', 'test-provider', tokens, {
        sessionId: 'session-1',
      });

      await tracker.trackOperation('test-model', 'test-provider', tokens, {
        sessionId: 'session-2',
      });

      const session1Summary = await tracker.getSessionSummary('session-1');
      expect(session1Summary.operationCount).to.equal(2);

      const session2Summary = await tracker.getSessionSummary('session-2');
      expect(session2Summary.operationCount).to.equal(1);
    });

    it('should enforce budget limits when blockOnExceed is true', async () => {
      const trackerWithBudget = new CostTracker({
        storage,
        pricing: new Map([
          ['test-model', { inputCostPer1kTokens: 0.01, outputCostPer1kTokens: 0.03 }],
        ]),
        budgetLimit: 0.05,
        budgetPeriod: 'daily',
        blockOnExceed: true,
      });

      const tokens: TokenUsage = {
        inputTokens: 1000,
        outputTokens: 1000,
        totalTokens: 2000,
      };

      // First operation should succeed (cost: 0.04)
      await trackerWithBudget.trackOperation('test-model', 'test-provider', tokens);

      // Second operation should fail (would exceed budget)
      try {
        await trackerWithBudget.trackOperation('test-model', 'test-provider', tokens);
        expect.fail('Should have thrown budget exceeded error');
      } catch (error: any) {
        expect(error.message).to.include('Budget exceeded');
      }
    });
  });

  describe('FileCostStorage', () => {
    it('should save and load costs', async () => {
      const cost = {
        operationId: 'test-op-1',
        timestamp: new Date(),
        modelId: 'test-model',
        provider: 'test-provider',
        tokens: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
        cost: 0.01,
      };

      await storage.save(cost);

      const allCosts = await storage.getAll();
      expect(allCosts).to.have.lengthOf(1);
      expect(allCosts[0].operationId).to.equal('test-op-1');
    });

    it('should filter by time range', async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      // Save costs at different times
      await storage.save({
        operationId: 'op-yesterday',
        timestamp: yesterday,
        modelId: 'test',
        provider: 'test',
        tokens: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        cost: 0,
      });

      await storage.save({
        operationId: 'op-today',
        timestamp: now,
        modelId: 'test',
        provider: 'test',
        tokens: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        cost: 0,
      });

      // Get costs from today only
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

      const todayCosts = await storage.getByTimeRange(todayStart, todayEnd);

      expect(todayCosts).to.have.lengthOf(1);
      expect(todayCosts[0].operationId).to.equal('op-today');
    });

    it('should export to CSV', async () => {
      await storage.save({
        operationId: 'test-op',
        timestamp: new Date(),
        modelId: 'test-model',
        provider: 'test-provider',
        tokens: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
        cost: 0.01,
      });

      const csvPath = path.join(testDir, 'export.csv');
      await storage.export(csvPath);

      expect(fs.existsSync(csvPath)).to.be.true;

      const content = fs.readFileSync(csvPath, 'utf-8');
      expect(content).to.include('test-op');
      expect(content).to.include('test-model');
      expect(content).to.include('0.010000');
    });
  });
});
