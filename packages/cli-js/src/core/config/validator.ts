/**
 * Configuration validator
 */

import { PawsConfig, ProviderConfig, ModelPricing } from './types';
import { ErrorCatalog } from '../errors';

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate a complete configuration
 */
export function validateConfig(config: PawsConfig): ValidationResult {
  const errors: string[] = [];

  // Validate providers
  if (config.providers) {
    for (const [name, providerConfig] of Object.entries(config.providers)) {
      const providerErrors = validateProvider(name, providerConfig);
      errors.push(...providerErrors);
    }
  }

  // Validate pricing
  if (config.pricing) {
    for (const [modelId, pricing] of Object.entries(config.pricing)) {
      const pricingErrors = validatePricing(modelId, pricing);
      errors.push(...pricingErrors);
    }
  }

  // Validate logging
  if (config.logging) {
    const validLevels = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
    if (config.logging.level && !validLevels.includes(config.logging.level)) {
      errors.push(`Invalid logging level: ${config.logging.level}`);
    }

    if (config.logging.fileOptions?.maxSize && config.logging.fileOptions.maxSize <= 0) {
      errors.push('Logging maxSize must be positive');
    }

    if (config.logging.fileOptions?.maxFiles && config.logging.fileOptions.maxFiles <= 0) {
      errors.push('Logging maxFiles must be positive');
    }
  }

  // Validate session
  if (config.session) {
    if (
      config.session.autoSaveInterval &&
      config.session.autoSaveInterval < 1000
    ) {
      errors.push('Session autoSaveInterval must be at least 1000ms');
    }

    if (
      config.session.maxHistoryEntries &&
      config.session.maxHistoryEntries <= 0
    ) {
      errors.push('Session maxHistoryEntries must be positive');
    }
  }

  // Validate arena
  if (config.arena) {
    if (config.arena.timeout && config.arena.timeout <= 0) {
      errors.push('Arena timeout must be positive');
    }

    if (config.arena.maxParallel && config.arena.maxParallel <= 0) {
      errors.push('Arena maxParallel must be positive');
    }
  }

  // Validate cost
  if (config.cost) {
    if (config.cost.budgetLimit && config.cost.budgetLimit <= 0) {
      errors.push('Cost budgetLimit must be positive');
    }

    if (config.cost.warnThreshold) {
      if (config.cost.warnThreshold <= 0 || config.cost.warnThreshold > 100) {
        errors.push('Cost warnThreshold must be between 0 and 100');
      }
    }

    const validPeriods = ['daily', 'weekly', 'monthly'];
    if (config.cost.budgetPeriod && !validPeriods.includes(config.cost.budgetPeriod)) {
      errors.push(`Invalid cost budgetPeriod: ${config.cost.budgetPeriod}`);
    }
  }

  // Validate CATS
  if (config.cats) {
    if (config.cats.cacheTtl && config.cats.cacheTtl < 0) {
      errors.push('CATS cacheTtl must be non-negative');
    }

    if (config.cats.maxBundleSize && config.cats.maxBundleSize <= 0) {
      errors.push('CATS maxBundleSize must be positive');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate provider configuration
 */
function validateProvider(name: string, config: ProviderConfig): string[] {
  const errors: string[] = [];

  if (config.timeout && config.timeout <= 0) {
    errors.push(`Provider ${name}: timeout must be positive`);
  }

  if (config.maxRetries && config.maxRetries < 0) {
    errors.push(`Provider ${name}: maxRetries must be non-negative`);
  }

  if (config.rateLimitPerMinute && config.rateLimitPerMinute <= 0) {
    errors.push(`Provider ${name}: rateLimitPerMinute must be positive`);
  }

  if (config.baseUrl) {
    try {
      new URL(config.baseUrl);
    } catch {
      errors.push(`Provider ${name}: invalid baseUrl`);
    }
  }

  return errors;
}

/**
 * Validate model pricing configuration
 */
function validatePricing(modelId: string, pricing: ModelPricing): string[] {
  const errors: string[] = [];

  if (typeof pricing.inputCostPer1kTokens !== 'number' || pricing.inputCostPer1kTokens < 0) {
    errors.push(`Model ${modelId}: inputCostPer1kTokens must be a non-negative number`);
  }

  if (typeof pricing.outputCostPer1kTokens !== 'number' || pricing.outputCostPer1kTokens < 0) {
    errors.push(`Model ${modelId}: outputCostPer1kTokens must be a non-negative number`);
  }

  if (pricing.contextWindow && pricing.contextWindow <= 0) {
    errors.push(`Model ${modelId}: contextWindow must be positive`);
  }

  return errors;
}

/**
 * Throw error if config is invalid
 */
export function assertValidConfig(config: PawsConfig): void {
  const result = validateConfig(config);

  if (!result.valid) {
    throw ErrorCatalog.config.validationFailed(result.errors);
  }
}
