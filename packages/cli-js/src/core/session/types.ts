/**
 * Enhanced session management types
 */

/**
 * Session status
 */
export enum SessionStatus {
  ACTIVE = 'active',
  ARCHIVED = 'archived',
  MERGED = 'merged',
  ABANDONED = 'abandoned',
  PAUSED = 'paused',
}

/**
 * Session metadata
 */
export interface SessionMetadata {
  /** Total cost for this session in USD */
  totalCost?: number;

  /** Total tokens used in this session */
  totalTokens?: number;

  /** Models used in this session */
  modelsUsed?: string[];

  /** Last activity timestamp */
  lastActivityAt?: Date;

  /** Session duration in milliseconds */
  durationMs?: number;

  /** Number of turns/operations */
  turnCount?: number;

  /** Tags for categorization */
  tags?: string[];

  /** User notes */
  notes?: string;

  /** Custom metadata */
  custom?: Record<string, any>;
}

/**
 * Session turn/operation
 */
export interface SessionTurn {
  /** Turn number (sequential) */
  turnNumber: number;

  /** Timestamp */
  timestamp: Date;

  /** Command executed */
  command: string;

  /** Git commit hash */
  commitHash?: string;

  /** CATS file path */
  catsFile?: string;

  /** DOGS file path */
  dogsFile?: string;

  /** Verification result */
  verificationResult?: string;

  /** Cost for this turn in USD */
  cost?: number;

  /** Tokens used in this turn */
  tokens?: number;

  /** Model used */
  model?: string;

  /** Turn notes */
  notes?: string;

  /** Turn metadata */
  metadata?: Record<string, any>;
}

/**
 * Session data structure
 */
export interface SessionData {
  /** Unique session ID (UUID) */
  sessionId: string;

  /** Session name */
  name: string;

  /** Creation timestamp */
  createdAt: Date;

  /** Last updated timestamp */
  updatedAt: Date;

  /** Session status */
  status: SessionStatus;

  /** Base branch */
  baseBranch: string;

  /** Base commit hash */
  baseCommit: string;

  /** Workspace path */
  workspacePath: string;

  /** Session turns */
  turns: SessionTurn[];

  /** Session metadata */
  metadata: SessionMetadata;
}

/**
 * Session summary for listing
 */
export interface SessionSummary {
  sessionId: string;
  name: string;
  status: SessionStatus;
  createdAt: Date;
  updatedAt: Date;
  turnCount: number;
  totalCost?: number;
  totalTokens?: number;
  durationMs?: number;
  tags?: string[];
}

/**
 * Session analytics
 */
export interface SessionAnalytics {
  /** Total number of sessions */
  totalSessions: number;

  /** Active sessions count */
  activeSessions: number;

  /** Total cost across all sessions */
  totalCost: number;

  /** Total tokens across all sessions */
  totalTokens: number;

  /** Most used models */
  topModels: Array<{ model: string; count: number; cost: number }>;

  /** Cost by session */
  costBySession: Array<{ sessionId: string; name: string; cost: number }>;

  /** Sessions by status */
  sessionsByStatus: Record<SessionStatus, number>;

  /** Average session duration */
  avgDurationMs: number;

  /** Total operations/turns */
  totalTurns: number;
}

/**
 * Session export format
 */
export interface SessionExport {
  /** Export format version */
  version: string;

  /** Export timestamp */
  exportedAt: Date;

  /** Session data */
  session: SessionData;

  /** Include git history */
  gitHistory?: Array<{
    hash: string;
    message: string;
    author: string;
    timestamp: Date;
  }>;
}

/**
 * Session history entry
 */
export interface SessionHistoryEntry {
  timestamp: Date;
  event: 'created' | 'updated' | 'status_changed' | 'turn_added' | 'exported' | 'restored';
  description: string;
  metadata?: Record<string, any>;
}
