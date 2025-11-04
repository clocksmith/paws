/**
 * Factory for creating cost trackers from configuration
 */

import { CostTracker } from './tracker';
import { FileCostStorage } from './storage';
import { PawsConfig } from '../config';
import * as chalk from 'chalk';

/**
 * Create a cost tracker from PAWS configuration
 */
export function createCostTracker(config: PawsConfig): CostTracker | null {
  // Check if cost tracking is enabled
  if (config.cost?.enabled === false) {
    return null;
  }

  // Create storage
  const storagePath = config.cost?.storagePath;
  if (!storagePath) {
    console.warn(chalk.yellow('Cost tracking enabled but no storage path configured'));
    return null;
  }

  const storage = new FileCostStorage(storagePath);

  // Build pricing map
  const pricing = new Map<string, { inputCostPer1kTokens: number; outputCostPer1kTokens: number }>();

  if (config.pricing) {
    for (const [modelId, modelPricing] of Object.entries(config.pricing)) {
      pricing.set(modelId, {
        inputCostPer1kTokens: modelPricing.inputCostPer1kTokens,
        outputCostPer1kTokens: modelPricing.outputCostPer1kTokens,
      });
    }
  }

  // Create tracker
  const tracker = new CostTracker({
    storage,
    pricing,
    budgetLimit: config.cost?.budgetLimit,
    budgetPeriod: config.cost?.budgetPeriod,
    warnThreshold: config.cost?.warnThreshold,
    blockOnExceed: config.cost?.blockOnExceed,
    onBudgetWarning: (status) => {
      console.warn('');
      console.warn(chalk.yellow.bold('⚠ Budget Warning'));
      console.warn(
        chalk.yellow(
          `You have used ${status.usagePercent.toFixed(1)}% of your ${status.period} budget`
        )
      );
      console.warn(
        chalk.yellow(
          `Usage: $${status.usage.toFixed(2)} / $${status.limit.toFixed(2)}`
        )
      );
      console.warn('');
    },
    onBudgetExceeded: (status) => {
      console.error('');
      console.error(chalk.red.bold('✖ Budget Exceeded'));
      console.error(
        chalk.red(
          `You have exceeded your ${status.period} budget`
        )
      );
      console.error(
        chalk.red(
          `Usage: $${status.usage.toFixed(2)} / $${status.limit.toFixed(2)}`
        )
      );
      if (config.cost?.blockOnExceed) {
        console.error(chalk.red('Further operations are blocked until budget resets'));
      }
      console.error('');
    },
  });

  return tracker;
}
