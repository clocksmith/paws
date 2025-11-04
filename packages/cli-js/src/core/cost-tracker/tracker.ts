/**
 * Cost tracking implementation
 */

import { v4 as uuidv4 } from 'uuid';
import {
  CostTrackerOptions,
  OperationCost,
  TokenUsage,
  CostSummary,
  BudgetStatus,
} from './types';
import { ErrorCatalog } from '../errors';

export class CostTracker {
  private storage: CostTrackerOptions['storage'];
  private pricing: Map<string, { inputCostPer1kTokens: number; outputCostPer1kTokens: number }>;
  private budgetLimit?: number;
  private budgetPeriod: 'daily' | 'weekly' | 'monthly';
  private warnThreshold: number;
  private blockOnExceed: boolean;
  private onBudgetWarning?: (status: BudgetStatus) => void;
  private onBudgetExceeded?: (status: BudgetStatus) => void;
  private warningTriggered = false;

  constructor(options: CostTrackerOptions) {
    this.storage = options.storage;
    this.pricing = options.pricing || new Map();
    this.budgetLimit = options.budgetLimit;
    this.budgetPeriod = options.budgetPeriod || 'monthly';
    this.warnThreshold = options.warnThreshold || 80;
    this.blockOnExceed = options.blockOnExceed || false;
    this.onBudgetWarning = options.onBudgetWarning;
    this.onBudgetExceeded = options.onBudgetExceeded;
  }

  /**
   * Track a new operation cost
   */
  async trackOperation(
    modelId: string,
    provider: string,
    tokens: TokenUsage,
    options?: {
      operationType?: string;
      sessionId?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<OperationCost> {
    // Calculate cost
    const cost = this.calculateCost(modelId, tokens);

    // Check budget before recording
    if (this.blockOnExceed && this.budgetLimit) {
      const currentStatus = await this.getBudgetStatus();
      if (currentStatus.exceeded) {
        throw ErrorCatalog.cost.storageError(
          'track operation',
          new Error(`Budget exceeded: $${currentStatus.usage.toFixed(2)} / $${currentStatus.limit.toFixed(2)}`)
        );
      }
    }

    // Create operation cost record
    const operationCost: OperationCost = {
      operationId: uuidv4(),
      timestamp: new Date(),
      modelId,
      provider,
      tokens,
      cost,
      operationType: options?.operationType,
      sessionId: options?.sessionId,
      metadata: options?.metadata,
    };

    // Save to storage
    await this.storage.save(operationCost);

    // Check budget after recording
    await this.checkBudget();

    return operationCost;
  }

  /**
   * Calculate cost for a given token usage
   */
  calculateCost(modelId: string, tokens: TokenUsage): number {
    const modelPricing = this.pricing.get(modelId);

    if (!modelPricing) {
      // If pricing not found, return 0 and warn
      console.warn(`No pricing information for model: ${modelId}. Cost reported as $0.00`);
      return 0;
    }

    const inputCost = (tokens.inputTokens / 1000) * modelPricing.inputCostPer1kTokens;
    const outputCost = (tokens.outputTokens / 1000) * modelPricing.outputCostPer1kTokens;

    return inputCost + outputCost;
  }

  /**
   * Get cost summary for a time range
   */
  async getSummary(start?: Date, end?: Date): Promise<CostSummary> {
    const costs = start && end
      ? await this.storage.getByTimeRange(start, end)
      : await this.storage.getAll();

    return this.aggregateCosts(costs);
  }

  /**
   * Get cost summary for a session
   */
  async getSessionSummary(sessionId: string): Promise<CostSummary> {
    const costs = await this.storage.getBySession(sessionId);
    return this.aggregateCosts(costs);
  }

  /**
   * Get cost summary for a model
   */
  async getModelSummary(modelId: string): Promise<CostSummary> {
    const costs = await this.storage.getByModel(modelId);
    return this.aggregateCosts(costs);
  }

  /**
   * Get budget status
   */
  async getBudgetStatus(): Promise<BudgetStatus> {
    if (!this.budgetLimit) {
      throw new Error('No budget limit configured');
    }

    const { start, end } = this.getCurrentPeriodRange();
    const summary = await this.getSummary(start, end);

    const usage = summary.totalCost;
    const remaining = this.budgetLimit - usage;
    const usagePercent = (usage / this.budgetLimit) * 100;
    const exceeded = usage > this.budgetLimit;
    const warning = usagePercent >= this.warnThreshold;

    return {
      limit: this.budgetLimit,
      usage,
      remaining,
      usagePercent,
      exceeded,
      warning,
      period: this.budgetPeriod,
      periodStart: start,
      periodEnd: end,
    };
  }

  /**
   * Check budget and trigger callbacks if needed
   */
  private async checkBudget(): Promise<void> {
    if (!this.budgetLimit) {
      return;
    }

    const status = await this.getBudgetStatus();

    // Trigger exceeded callback
    if (status.exceeded && this.onBudgetExceeded) {
      this.onBudgetExceeded(status);
    }

    // Trigger warning callback (only once per period)
    if (status.warning && !status.exceeded && !this.warningTriggered && this.onBudgetWarning) {
      this.onBudgetWarning(status);
      this.warningTriggered = true;
    }

    // Reset warning flag if we go back under threshold
    if (!status.warning) {
      this.warningTriggered = false;
    }
  }

  /**
   * Get current period date range
   */
  private getCurrentPeriodRange(): { start: Date; end: Date } {
    const now = new Date();
    let start: Date;
    let end: Date;

    switch (this.budgetPeriod) {
      case 'daily':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        break;

      case 'weekly':
        const dayOfWeek = now.getDay();
        start = new Date(now);
        start.setDate(now.getDate() - dayOfWeek);
        start.setHours(0, 0, 0, 0);
        end = new Date(start);
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        break;

      case 'monthly':
        start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        break;
    }

    return { start, end };
  }

  /**
   * Aggregate costs into summary
   */
  private aggregateCosts(costs: OperationCost[]): CostSummary {
    const summary: CostSummary = {
      totalCost: 0,
      totalTokens: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      operationCount: costs.length,
      byModel: {},
      byProvider: {},
      byOperationType: {},
    };

    if (costs.length === 0) {
      return summary;
    }

    // Find time range
    const timestamps = costs.map((c) => new Date(c.timestamp).getTime());
    summary.startTime = new Date(Math.min(...timestamps));
    summary.endTime = new Date(Math.max(...timestamps));

    // Aggregate
    for (const cost of costs) {
      summary.totalCost += cost.cost;
      summary.totalTokens += cost.tokens.totalTokens;
      summary.totalInputTokens += cost.tokens.inputTokens;
      summary.totalOutputTokens += cost.tokens.outputTokens;

      // By model
      if (!summary.byModel[cost.modelId]) {
        summary.byModel[cost.modelId] = { cost: 0, tokens: 0, operationCount: 0 };
      }
      summary.byModel[cost.modelId].cost += cost.cost;
      summary.byModel[cost.modelId].tokens += cost.tokens.totalTokens;
      summary.byModel[cost.modelId].operationCount += 1;

      // By provider
      if (!summary.byProvider[cost.provider]) {
        summary.byProvider[cost.provider] = { cost: 0, tokens: 0, operationCount: 0 };
      }
      summary.byProvider[cost.provider].cost += cost.cost;
      summary.byProvider[cost.provider].tokens += cost.tokens.totalTokens;
      summary.byProvider[cost.provider].operationCount += 1;

      // By operation type
      const opType = cost.operationType || 'unknown';
      if (!summary.byOperationType[opType]) {
        summary.byOperationType[opType] = { cost: 0, tokens: 0, operationCount: 0 };
      }
      summary.byOperationType[opType].cost += cost.cost;
      summary.byOperationType[opType].tokens += cost.tokens.totalTokens;
      summary.byOperationType[opType].operationCount += 1;
    }

    return summary;
  }

  /**
   * Set model pricing
   */
  setModelPricing(
    modelId: string,
    inputCostPer1kTokens: number,
    outputCostPer1kTokens: number
  ): void {
    this.pricing.set(modelId, { inputCostPer1kTokens, outputCostPer1kTokens });
  }

  /**
   * Get model pricing
   */
  getModelPricing(modelId: string): { inputCostPer1kTokens: number; outputCostPer1kTokens: number } | undefined {
    return this.pricing.get(modelId);
  }

  /**
   * Export costs to file
   */
  async export(outputPath: string): Promise<void> {
    await this.storage.export(outputPath);
  }

  /**
   * Clear all cost data
   */
  async clear(): Promise<void> {
    await this.storage.clear();
  }
}
