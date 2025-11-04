/**
 * Type definitions for cost tracking
 */

/**
 * Token usage for a single operation
 */
export interface TokenUsage {
  /** Input/prompt tokens */
  inputTokens: number;

  /** Output/completion tokens */
  outputTokens: number;

  /** Total tokens */
  totalTokens: number;
}

/**
 * Cost for a single operation
 */
export interface OperationCost {
  /** Unique operation ID */
  operationId: string;

  /** Timestamp of operation */
  timestamp: Date;

  /** Model ID used */
  modelId: string;

  /** Provider name */
  provider: string;

  /** Token usage */
  tokens: TokenUsage;

  /** Cost in USD */
  cost: number;

  /** Operation type (e.g., 'generation', 'embedding', 'arena', 'cats') */
  operationType?: string;

  /** Session ID if part of a session */
  sessionId?: string;

  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Aggregated cost summary
 */
export interface CostSummary {
  /** Total cost in USD */
  totalCost: number;

  /** Total tokens used */
  totalTokens: number;

  /** Total input tokens */
  totalInputTokens: number;

  /** Total output tokens */
  totalOutputTokens: number;

  /** Number of operations */
  operationCount: number;

  /** Cost breakdown by model */
  byModel: {
    [modelId: string]: {
      cost: number;
      tokens: number;
      operationCount: number;
    };
  };

  /** Cost breakdown by provider */
  byProvider: {
    [provider: string]: {
      cost: number;
      tokens: number;
      operationCount: number;
    };
  };

  /** Cost breakdown by operation type */
  byOperationType: {
    [type: string]: {
      cost: number;
      tokens: number;
      operationCount: number;
    };
  };

  /** Time range */
  startTime?: Date;
  endTime?: Date;
}

/**
 * Budget status
 */
export interface BudgetStatus {
  /** Budget limit in USD */
  limit: number;

  /** Current usage in USD */
  usage: number;

  /** Remaining budget in USD */
  remaining: number;

  /** Usage percentage */
  usagePercent: number;

  /** Whether budget is exceeded */
  exceeded: boolean;

  /** Whether warning threshold is reached */
  warning: boolean;

  /** Budget period */
  period: 'daily' | 'weekly' | 'monthly';

  /** Period start date */
  periodStart: Date;

  /** Period end date */
  periodEnd: Date;
}

/**
 * Cost tracking storage
 */
export interface CostStorage {
  /** Save an operation cost */
  save(cost: OperationCost): Promise<void>;

  /** Get all costs for a time range */
  getByTimeRange(start: Date, end: Date): Promise<OperationCost[]>;

  /** Get all costs for a session */
  getBySession(sessionId: string): Promise<OperationCost[]>;

  /** Get all costs for a model */
  getByModel(modelId: string): Promise<OperationCost[]>;

  /** Get all costs */
  getAll(): Promise<OperationCost[]>;

  /** Clear all costs */
  clear(): Promise<void>;

  /** Export costs to JSON */
  export(outputPath: string): Promise<void>;
}

/**
 * Cost tracker options
 */
export interface CostTrackerOptions {
  /** Storage implementation */
  storage: CostStorage;

  /** Model pricing map */
  pricing?: Map<string, { inputCostPer1kTokens: number; outputCostPer1kTokens: number }>;

  /** Budget limit in USD */
  budgetLimit?: number;

  /** Budget period */
  budgetPeriod?: 'daily' | 'weekly' | 'monthly';

  /** Warn at percentage of budget */
  warnThreshold?: number;

  /** Block operations when budget exceeded */
  blockOnExceed?: boolean;

  /** Callback when budget warning is triggered */
  onBudgetWarning?: (status: BudgetStatus) => void;

  /** Callback when budget is exceeded */
  onBudgetExceeded?: (status: BudgetStatus) => void;
}
