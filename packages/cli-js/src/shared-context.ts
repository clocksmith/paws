/**
 * Shared context and utilities for PAWS commands
 *
 * Provides integrated access to:
 * - Configuration management
 * - Logging
 * - Cost tracking
 * - Error handling
 * - Session management
 */

import * as path from 'path';
import * as os from 'os';
import {
  ConfigManager,
  PawsConfig,
  createLogger,
  Logger,
  ConsoleTransport,
  FileTransport,
  LogLevel,
  parseLogLevel,
  CostTracker,
  createCostTracker,
  EnhancedSessionManager,
  setupGlobalErrorHandler,
} from './core';

/**
 * PAWS command context with integrated infrastructure
 */
export class PawsContext {
  public config: PawsConfig;
  public logger: Logger;
  public costTracker: CostTracker | null;
  public sessionManager: EnhancedSessionManager | null;
  public rootPath: string;

  private configManager: ConfigManager;

  private constructor(
    configManager: ConfigManager,
    logger: Logger,
    costTracker: CostTracker | null,
    sessionManager: EnhancedSessionManager | null,
    rootPath: string
  ) {
    this.configManager = configManager;
    this.config = configManager.get();
    this.logger = logger;
    this.costTracker = costTracker;
    this.sessionManager = sessionManager;
    this.rootPath = rootPath;
  }

  /**
   * Create PAWS context with all infrastructure initialized
   */
  static async create(options?: {
    rootPath?: string;
    profile?: string;
    verbose?: boolean;
  }): Promise<PawsContext> {
    const rootPath = options?.rootPath || process.cwd();

    // Load configuration
    const configManager = await ConfigManager.load(rootPath, {
      profile: options?.profile,
      allowMissing: true,
    });

    const config = configManager.get();

    // Create logger
    const logger = createPawsLogger(config, options?.verbose);

    // Setup global error handler
    setupGlobalErrorHandler(logger);

    // Create cost tracker
    const costTracker = createCostTracker(config);

    // Create session manager
    const sessionManager = config.session?.baseDir
      ? new EnhancedSessionManager(config.session.baseDir, {
          historyEnabled: config.session.keepHistory,
          maxHistoryEntries: config.session.maxHistoryEntries,
        })
      : null;

    // Initialize session manager
    if (sessionManager) {
      await sessionManager.initialize();
    }

    const context = new PawsContext(
      configManager,
      logger,
      costTracker,
      sessionManager,
      rootPath
    );

    await logger.info('PAWS context initialized', {
      rootPath,
      profile: options?.profile,
      costTrackingEnabled: costTracker !== null,
      sessionManagementEnabled: sessionManager !== null,
    });

    return context;
  }

  /**
   * Get configuration value
   */
  getConfig<T = any>(path: string): T | undefined {
    return this.configManager.getValue(path);
  }

  /**
   * Update configuration value
   */
  setConfig(path: string, value: any): void {
    this.configManager.setValue(path, value);
  }

  /**
   * Save configuration
   */
  async saveConfig(): Promise<void> {
    await this.configManager.save();
  }

  /**
   * Get API key for a provider
   */
  getProviderApiKey(provider: string): string | undefined {
    return this.getConfig(`providers.${provider}.apiKey`);
  }

  /**
   * Get provider timeout
   */
  getProviderTimeout(provider: string): number {
    return this.getConfig(`providers.${provider}.timeout`) || 60000;
  }

  /**
   * Get provider max retries
   */
  getProviderMaxRetries(provider: string): number {
    return this.getConfig(`providers.${provider}.maxRetries`) || 3;
  }

  /**
   * Check if debug mode is enabled
   */
  isDebugMode(): boolean {
    return this.config.logging?.level === 'DEBUG' || process.env.PAWS_DEBUG === 'true';
  }

  /**
   * Create a child logger
   */
  createLogger(source: string): Logger {
    return this.logger.child(source);
  }

  /**
   * Flush all resources
   */
  async flush(): Promise<void> {
    await this.logger.flush();
  }

  /**
   * Close all resources
   */
  async close(): Promise<void> {
    await this.logger.close();
  }
}

/**
 * Create logger from configuration
 */
function createPawsLogger(config: PawsConfig, verbose?: boolean): Logger {
  const transports = [];

  // Determine log level
  let logLevel = LogLevel.INFO;
  if (verbose) {
    logLevel = LogLevel.DEBUG;
  } else if (config.logging?.level) {
    logLevel = parseLogLevel(config.logging.level);
  }

  // Console transport (always enabled unless explicitly disabled)
  if (config.logging?.console !== false) {
    transports.push(
      new ConsoleTransport({
        minLevel: logLevel,
        colorize: config.logging?.colorize !== false,
        includeTimestamp: config.logging?.includeTimestamp !== false,
      })
    );
  }

  // File transport (enabled if configured)
  if (config.logging?.file && config.logging?.fileOptions?.path) {
    transports.push(
      new FileTransport({
        filePath: config.logging.fileOptions.path,
        minLevel: logLevel,
        maxSize: config.logging.fileOptions.maxSize,
        maxFiles: config.logging.fileOptions.maxFiles,
        json: config.logging.fileOptions.format === 'json',
      })
    );
  }

  return createLogger({
    minLevel: logLevel,
    transports,
  });
}

/**
 * Quick helper to create context with defaults
 */
export async function createPawsContext(
  rootPath?: string,
  options?: { verbose?: boolean; profile?: string }
): Promise<PawsContext> {
  return PawsContext.create({
    rootPath,
    ...options,
  });
}

/**
 * Helper to get default paths
 */
export const PawsPaths = {
  home: os.homedir(),
  pawsDir: path.join(os.homedir(), '.paws'),
  logs: path.join(os.homedir(), '.paws', 'logs'),
  sessions: path.join(os.homedir(), '.paws', 'sessions'),
  costs: path.join(os.homedir(), '.paws', 'costs'),
  cache: path.join(os.homedir(), '.paws', 'cache'),
  config: {
    global: path.join(os.homedir(), '.pawsrc.json'),
    local: (cwd: string) => path.join(cwd, '.pawsrc.json'),
  },
};
