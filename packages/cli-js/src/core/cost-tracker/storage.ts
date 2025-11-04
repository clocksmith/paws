/**
 * File-based storage for cost tracking
 */

import * as fs from 'fs';
import * as path from 'path';
import { CostStorage, OperationCost } from './types';
import { ErrorCatalog } from '../errors';

/**
 * File-based cost storage using monthly JSON files
 */
export class FileCostStorage implements CostStorage {
  private storagePath: string;
  private cache: Map<string, OperationCost[]> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private readonly cacheTtlMs = 60000; // 1 minute

  constructor(storagePath: string) {
    this.storagePath = storagePath;

    // Ensure storage directory exists
    if (!fs.existsSync(storagePath)) {
      fs.mkdirSync(storagePath, { recursive: true });
    }
  }

  async save(cost: OperationCost): Promise<void> {
    try {
      // Determine file path based on timestamp (monthly files)
      const filePath = this.getFilePathForDate(cost.timestamp);

      // Load existing costs
      const costs = await this.loadFile(filePath);

      // Add new cost
      costs.push(cost);

      // Save back to file
      await this.saveFile(filePath, costs);

      // Invalidate cache for this file
      this.cache.delete(filePath);
      this.cacheExpiry.delete(filePath);
    } catch (error) {
      throw ErrorCatalog.cost.storageError('save', error as Error);
    }
  }

  async getByTimeRange(start: Date, end: Date): Promise<OperationCost[]> {
    try {
      const filePaths = this.getFilePathsForRange(start, end);
      const allCosts: OperationCost[] = [];

      for (const filePath of filePaths) {
        const costs = await this.loadFile(filePath);
        allCosts.push(...costs);
      }

      // Filter by exact time range
      return allCosts.filter((cost) => {
        const costTime = new Date(cost.timestamp);
        return costTime >= start && costTime <= end;
      });
    } catch (error) {
      throw ErrorCatalog.cost.storageError('getByTimeRange', error as Error);
    }
  }

  async getBySession(sessionId: string): Promise<OperationCost[]> {
    try {
      const allCosts = await this.getAll();
      return allCosts.filter((cost) => cost.sessionId === sessionId);
    } catch (error) {
      throw ErrorCatalog.cost.storageError('getBySession', error as Error);
    }
  }

  async getByModel(modelId: string): Promise<OperationCost[]> {
    try {
      const allCosts = await this.getAll();
      return allCosts.filter((cost) => cost.modelId === modelId);
    } catch (error) {
      throw ErrorCatalog.cost.storageError('getByModel', error as Error);
    }
  }

  async getAll(): Promise<OperationCost[]> {
    try {
      const allCosts: OperationCost[] = [];

      // Read all JSON files in storage directory
      const files = fs.readdirSync(this.storagePath);

      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(this.storagePath, file);
          const costs = await this.loadFile(filePath);
          allCosts.push(...costs);
        }
      }

      return allCosts;
    } catch (error) {
      throw ErrorCatalog.cost.storageError('getAll', error as Error);
    }
  }

  async clear(): Promise<void> {
    try {
      const files = fs.readdirSync(this.storagePath);

      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(this.storagePath, file);
          fs.unlinkSync(filePath);
        }
      }

      // Clear cache
      this.cache.clear();
      this.cacheExpiry.clear();
    } catch (error) {
      throw ErrorCatalog.cost.storageError('clear', error as Error);
    }
  }

  async export(outputPath: string): Promise<void> {
    try {
      const allCosts = await this.getAll();

      // Ensure output directory exists
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Write as JSON or CSV based on extension
      const ext = path.extname(outputPath).toLowerCase();

      if (ext === '.csv') {
        const csv = this.convertToCSV(allCosts);
        fs.writeFileSync(outputPath, csv, 'utf8');
      } else {
        const json = JSON.stringify(allCosts, null, 2);
        fs.writeFileSync(outputPath, json, 'utf8');
      }
    } catch (error) {
      throw ErrorCatalog.cost.storageError('export', error as Error);
    }
  }

  /**
   * Load costs from a file with caching
   */
  private async loadFile(filePath: string): Promise<OperationCost[]> {
    // Check cache
    const cached = this.cache.get(filePath);
    const expiry = this.cacheExpiry.get(filePath);

    if (cached && expiry && Date.now() < expiry) {
      return cached;
    }

    // Load from file
    if (!fs.existsSync(filePath)) {
      return [];
    }

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const costs = JSON.parse(content) as OperationCost[];

      // Convert timestamp strings to Date objects
      costs.forEach((cost) => {
        cost.timestamp = new Date(cost.timestamp);
      });

      // Update cache
      this.cache.set(filePath, costs);
      this.cacheExpiry.set(filePath, Date.now() + this.cacheTtlMs);

      return costs;
    } catch (error) {
      throw ErrorCatalog.config.invalidJson(filePath, error as Error);
    }
  }

  /**
   * Save costs to a file
   */
  private async saveFile(filePath: string, costs: OperationCost[]): Promise<void> {
    const json = JSON.stringify(costs, null, 2);
    fs.writeFileSync(filePath, json, 'utf8');
  }

  /**
   * Get file path for a specific date (monthly files)
   */
  private getFilePathForDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const filename = `costs-${year}-${month}.json`;
    return path.join(this.storagePath, filename);
  }

  /**
   * Get all file paths for a date range
   */
  private getFilePathsForRange(start: Date, end: Date): string[] {
    const filePaths: string[] = [];
    const current = new Date(start.getFullYear(), start.getMonth(), 1);
    const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);

    while (current <= endMonth) {
      filePaths.push(this.getFilePathForDate(current));
      current.setMonth(current.getMonth() + 1);
    }

    return filePaths;
  }

  /**
   * Convert costs to CSV format
   */
  private convertToCSV(costs: OperationCost[]): string {
    const headers = [
      'Timestamp',
      'Operation ID',
      'Model',
      'Provider',
      'Operation Type',
      'Session ID',
      'Input Tokens',
      'Output Tokens',
      'Total Tokens',
      'Cost (USD)',
    ];

    const rows = costs.map((cost) => [
      cost.timestamp.toISOString(),
      cost.operationId,
      cost.modelId,
      cost.provider,
      cost.operationType || '',
      cost.sessionId || '',
      cost.tokens.inputTokens.toString(),
      cost.tokens.outputTokens.toString(),
      cost.tokens.totalTokens.toString(),
      cost.cost.toFixed(6),
    ]);

    return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
  }
}
