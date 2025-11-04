/**
 * Default configuration values
 */

import * as path from 'path';
import * as os from 'os';
import { PawsConfig } from './types';

export const defaultConfig: PawsConfig = {
  version: '1.0.0',

  providers: {
    anthropic: {
      timeout: 60000,
      maxRetries: 3,
      rateLimitPerMinute: 50,
    },
    openai: {
      timeout: 60000,
      maxRetries: 3,
      rateLimitPerMinute: 60,
    },
    gemini: {
      timeout: 60000,
      maxRetries: 3,
      rateLimitPerMinute: 60,
    },
  },

  pricing: {
    // Anthropic models
    'claude-3-5-sonnet-20241022': {
      inputCostPer1kTokens: 0.003,
      outputCostPer1kTokens: 0.015,
      contextWindow: 200000,
      displayName: 'Claude 3.5 Sonnet',
    },
    'claude-3-5-haiku-20241022': {
      inputCostPer1kTokens: 0.001,
      outputCostPer1kTokens: 0.005,
      contextWindow: 200000,
      displayName: 'Claude 3.5 Haiku',
    },
    'claude-3-opus-20240229': {
      inputCostPer1kTokens: 0.015,
      outputCostPer1kTokens: 0.075,
      contextWindow: 200000,
      displayName: 'Claude 3 Opus',
    },
    'claude-3-sonnet-20240229': {
      inputCostPer1kTokens: 0.003,
      outputCostPer1kTokens: 0.015,
      contextWindow: 200000,
      displayName: 'Claude 3 Sonnet',
    },
    'claude-3-haiku-20240307': {
      inputCostPer1kTokens: 0.00025,
      outputCostPer1kTokens: 0.00125,
      contextWindow: 200000,
      displayName: 'Claude 3 Haiku',
    },

    // OpenAI models
    'gpt-4-turbo-preview': {
      inputCostPer1kTokens: 0.01,
      outputCostPer1kTokens: 0.03,
      contextWindow: 128000,
      displayName: 'GPT-4 Turbo',
    },
    'gpt-4': {
      inputCostPer1kTokens: 0.03,
      outputCostPer1kTokens: 0.06,
      contextWindow: 8192,
      displayName: 'GPT-4',
    },
    'gpt-4-32k': {
      inputCostPer1kTokens: 0.06,
      outputCostPer1kTokens: 0.12,
      contextWindow: 32768,
      displayName: 'GPT-4 32K',
    },
    'gpt-3.5-turbo': {
      inputCostPer1kTokens: 0.0015,
      outputCostPer1kTokens: 0.002,
      contextWindow: 16385,
      displayName: 'GPT-3.5 Turbo',
    },
    'gpt-4o': {
      inputCostPer1kTokens: 0.005,
      outputCostPer1kTokens: 0.015,
      contextWindow: 128000,
      displayName: 'GPT-4o',
    },
    'gpt-4o-mini': {
      inputCostPer1kTokens: 0.00015,
      outputCostPer1kTokens: 0.0006,
      contextWindow: 128000,
      displayName: 'GPT-4o Mini',
    },

    // Google models
    'gemini-pro': {
      inputCostPer1kTokens: 0.00025,
      outputCostPer1kTokens: 0.0005,
      contextWindow: 32760,
      displayName: 'Gemini Pro',
    },
    'gemini-1.5-pro': {
      inputCostPer1kTokens: 0.00125,
      outputCostPer1kTokens: 0.005,
      contextWindow: 1000000,
      displayName: 'Gemini 1.5 Pro',
    },
    'gemini-1.5-flash': {
      inputCostPer1kTokens: 0.000075,
      outputCostPer1kTokens: 0.0003,
      contextWindow: 1000000,
      displayName: 'Gemini 1.5 Flash',
    },
    'gemini-2.0-flash-exp': {
      inputCostPer1kTokens: 0.0,
      outputCostPer1kTokens: 0.0,
      contextWindow: 1000000,
      displayName: 'Gemini 2.0 Flash (Experimental)',
    },
  },

  logging: {
    level: 'INFO',
    console: true,
    file: false,
    fileOptions: {
      path: path.join(os.homedir(), '.paws', 'logs', 'paws.log'),
      maxSize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      format: 'json',
    },
    colorize: true,
    includeTimestamp: true,
  },

  session: {
    baseDir: path.join(os.homedir(), '.paws', 'sessions'),
    autoSave: true,
    autoSaveInterval: 30000, // 30 seconds
    keepHistory: true,
    maxHistoryEntries: 100,
  },

  arena: {
    configFile: 'arena_config.json',
    timeout: 300000, // 5 minutes
    parallel: true,
    maxParallel: 3,
  },

  cost: {
    enabled: true,
    storagePath: path.join(os.homedir(), '.paws', 'costs'),
    budgetLimit: undefined, // No limit by default
    budgetPeriod: 'monthly',
    warnThreshold: 80, // Warn at 80% of budget
    blockOnExceed: false,
  },

  cats: {
    cacheTtl: 86400, // 24 hours
    enableCache: true,
    ignorePatterns: [
      'node_modules/**',
      '.git/**',
      'dist/**',
      'build/**',
      'coverage/**',
      '*.log',
      '.DS_Store',
      'yarn.lock',
      'package-lock.json',
    ],
    maxBundleSize: 50 * 1024 * 1024, // 50MB
  },

  dogs: {
    autoApply: false,
    createBackup: true,
    backupDir: path.join(os.homedir(), '.paws', 'backups'),
  },

  custom: {},
};
