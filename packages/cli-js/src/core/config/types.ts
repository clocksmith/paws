/**
 * Type definitions for configuration management
 */

/**
 * Provider configuration
 */
export interface ProviderConfig {
  /** API key for the provider */
  apiKey?: string;

  /** Base URL for API endpoint */
  baseUrl?: string;

  /** Default model ID */
  defaultModel?: string;

  /** Request timeout in milliseconds */
  timeout?: number;

  /** Maximum retries for failed requests */
  maxRetries?: number;

  /** Rate limit (requests per minute) */
  rateLimitPerMinute?: number;

  /** Enable debug logging for this provider */
  debug?: boolean;
}

/**
 * Model pricing configuration
 */
export interface ModelPricing {
  /** Cost per 1000 input tokens in USD */
  inputCostPer1kTokens: number;

  /** Cost per 1000 output tokens in USD */
  outputCostPer1kTokens: number;

  /** Optional context window size */
  contextWindow?: number;

  /** Optional display name */
  displayName?: string;
}

/**
 * Logging configuration
 */
export interface LoggingConfig {
  /** Minimum log level */
  level?: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

  /** Enable console logging */
  console?: boolean;

  /** Enable file logging */
  file?: boolean;

  /** File logging options */
  fileOptions?: {
    /** Path to log file */
    path?: string;

    /** Maximum file size in bytes */
    maxSize?: number;

    /** Maximum number of rotated files */
    maxFiles?: number;

    /** Output format */
    format?: 'text' | 'json';
  };

  /** Colorize console output */
  colorize?: boolean;

  /** Include timestamps */
  includeTimestamp?: boolean;
}

/**
 * Session configuration
 */
export interface SessionConfig {
  /** Default base directory for sessions */
  baseDir?: string;

  /** Auto-save session state */
  autoSave?: boolean;

  /** Auto-save interval in milliseconds */
  autoSaveInterval?: number;

  /** Keep session history */
  keepHistory?: boolean;

  /** Maximum history entries per session */
  maxHistoryEntries?: number;
}

/**
 * Arena configuration
 */
export interface ArenaConfig {
  /** Path to arena config file */
  configFile?: string;

  /** Default timeout for arena operations (ms) */
  timeout?: number;

  /** Enable parallel execution */
  parallel?: boolean;

  /** Maximum parallel agents */
  maxParallel?: number;
}

/**
 * Cost tracking configuration
 */
export interface CostConfig {
  /** Enable cost tracking */
  enabled?: boolean;

  /** Storage path for cost data */
  storagePath?: string;

  /** Budget limit in USD */
  budgetLimit?: number;

  /** Budget period */
  budgetPeriod?: 'daily' | 'weekly' | 'monthly';

  /** Warn at percentage of budget */
  warnThreshold?: number;

  /** Block operations when budget exceeded */
  blockOnExceed?: boolean;
}

/**
 * CATS (Context bundler) configuration
 */
export interface CatsConfig {
  /** Default cache TTL for AI curation (seconds) */
  cacheTtl?: number;

  /** Enable caching */
  enableCache?: boolean;

  /** Default ignore patterns */
  ignorePatterns?: string[];

  /** Maximum bundle size (bytes) */
  maxBundleSize?: number;
}

/**
 * DOGS (Change applier) configuration
 */
export interface DogsConfig {
  /** Auto-apply mode (skip interactive review) */
  autoApply?: boolean;

  /** Create backup before applying */
  createBackup?: boolean;

  /** Backup directory */
  backupDir?: string;
}

/**
 * Main configuration structure
 */
export interface PawsConfig {
  /** Configuration schema version */
  version?: string;

  /** Active profile name */
  profile?: string;

  /** Provider configurations */
  providers?: {
    [providerName: string]: ProviderConfig;
  };

  /** Model pricing configurations */
  pricing?: {
    [modelId: string]: ModelPricing;
  };

  /** Logging configuration */
  logging?: LoggingConfig;

  /** Session configuration */
  session?: SessionConfig;

  /** Arena configuration */
  arena?: ArenaConfig;

  /** Cost tracking configuration */
  cost?: CostConfig;

  /** CATS configuration */
  cats?: CatsConfig;

  /** DOGS configuration */
  dogs?: DogsConfig;

  /** Custom user-defined settings */
  custom?: Record<string, any>;
}

/**
 * Configuration profiles
 */
export interface ConfigProfile {
  /** Profile name */
  name: string;

  /** Profile description */
  description?: string;

  /** Profile configuration */
  config: PawsConfig;
}

/**
 * Configuration file structure (can contain multiple profiles)
 */
export interface ConfigFile {
  /** Default profile to use */
  defaultProfile?: string;

  /** Named profiles */
  profiles?: {
    [profileName: string]: PawsConfig;
  };

  /** Root-level config (used when no profile specified) */
  [key: string]: any;
}

/**
 * Configuration loading options
 */
export interface ConfigLoadOptions {
  /** Search for config in parent directories */
  searchUp?: boolean;

  /** Profile name to load */
  profile?: string;

  /** Allow missing config file */
  allowMissing?: boolean;

  /** Merge with default config */
  mergeDefaults?: boolean;

  /** Expand environment variables */
  expandEnv?: boolean;
}

/**
 * Configuration levels
 */
export enum ConfigLevel {
  SYSTEM = 0,  // /etc/pawsrc.json
  USER = 1,    // ~/.pawsrc.json
  PROJECT = 2, // .pawsrc.json in project root
  LOCAL = 3,   // .pawsrc.json in current directory
}
