/**
 * Enhanced session management with metadata and persistence
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import {
  SessionData,
  SessionTurn,
  SessionMetadata,
  SessionSummary,
  SessionAnalytics,
  SessionExport,
  SessionHistoryEntry,
  SessionStatus,
} from './types';
import { ErrorCatalog } from '../errors';

export class EnhancedSessionManager {
  private baseDir: string;
  private historyEnabled: boolean;
  private maxHistoryEntries: number;

  constructor(baseDir: string, options?: { historyEnabled?: boolean; maxHistoryEntries?: number }) {
    this.baseDir = baseDir;
    this.historyEnabled = options?.historyEnabled ?? true;
    this.maxHistoryEntries = options?.maxHistoryEntries ?? 100;
  }

  /**
   * Initialize session storage
   */
  async initialize(): Promise<void> {
    await fs.mkdir(this.baseDir, { recursive: true });
  }

  /**
   * Get path for a session
   */
  private getSessionPath(sessionId: string): string {
    return path.join(this.baseDir, sessionId);
  }

  /**
   * Get path for session metadata file
   */
  private getSessionMetadataPath(sessionId: string): string {
    return path.join(this.getSessionPath(sessionId), 'metadata.json');
  }

  /**
   * Get path for session history file
   */
  private getSessionHistoryPath(sessionId: string): string {
    return path.join(this.getSessionPath(sessionId), 'history.json');
  }

  /**
   * Save session metadata
   */
  async saveSessionMetadata(session: SessionData): Promise<void> {
    try {
      const sessionPath = this.getSessionPath(session.sessionId);
      await fs.mkdir(sessionPath, { recursive: true });

      const metadataPath = this.getSessionMetadataPath(session.sessionId);

      // Update timestamps
      session.updatedAt = new Date();

      // Serialize (convert dates to ISO strings)
      const serialized = this.serializeSession(session);

      await fs.writeFile(metadataPath, JSON.stringify(serialized, null, 2), 'utf-8');

      // Add to history
      if (this.historyEnabled) {
        await this.addHistoryEntry(session.sessionId, {
          timestamp: new Date(),
          event: 'updated',
          description: 'Session metadata updated',
        });
      }
    } catch (error) {
      throw ErrorCatalog.session.corruptedMetadata(
        session.sessionId,
        error as Error
      );
    }
  }

  /**
   * Load session metadata
   */
  async loadSessionMetadata(sessionId: string): Promise<SessionData | null> {
    try {
      const metadataPath = this.getSessionMetadataPath(sessionId);

      const content = await fs.readFile(metadataPath, 'utf-8');
      const data = JSON.parse(content);

      // Deserialize (convert ISO strings back to dates)
      return this.deserializeSession(data);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw ErrorCatalog.session.corruptedMetadata(sessionId, error);
    }
  }

  /**
   * List all sessions
   */
  async listSessions(): Promise<SessionSummary[]> {
    try {
      const entries = await fs.readdir(this.baseDir, { withFileTypes: true });

      const summaries: SessionSummary[] = [];

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const sessionData = await this.loadSessionMetadata(entry.name);
          if (sessionData) {
            summaries.push(this.createSummary(sessionData));
          }
        }
      }

      // Sort by updated date (most recent first)
      summaries.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

      return summaries;
    } catch (error) {
      throw ErrorCatalog.fs.fileNotFound(this.baseDir, 'list sessions');
    }
  }

  /**
   * Get sessions by status
   */
  async getSessionsByStatus(status: SessionStatus): Promise<SessionSummary[]> {
    const allSessions = await this.listSessions();
    return allSessions.filter((s) => s.status === status);
  }

  /**
   * Add a turn to a session
   */
  async addTurn(sessionId: string, turn: SessionTurn): Promise<void> {
    const session = await this.loadSessionMetadata(sessionId);

    if (!session) {
      throw ErrorCatalog.session.notFound(sessionId);
    }

    session.turns.push(turn);

    // Update metadata
    session.metadata.turnCount = session.turns.length;
    if (turn.cost) {
      session.metadata.totalCost = (session.metadata.totalCost || 0) + turn.cost;
    }
    if (turn.tokens) {
      session.metadata.totalTokens = (session.metadata.totalTokens || 0) + turn.tokens;
    }
    if (turn.model && !session.metadata.modelsUsed?.includes(turn.model)) {
      session.metadata.modelsUsed = [...(session.metadata.modelsUsed || []), turn.model];
    }
    session.metadata.lastActivityAt = new Date();

    // Calculate duration
    const createdTime = new Date(session.createdAt).getTime();
    const now = Date.now();
    session.metadata.durationMs = now - createdTime;

    await this.saveSessionMetadata(session);

    if (this.historyEnabled) {
      await this.addHistoryEntry(sessionId, {
        timestamp: new Date(),
        event: 'turn_added',
        description: `Turn ${turn.turnNumber}: ${turn.command}`,
        metadata: { turnNumber: turn.turnNumber },
      });
    }
  }

  /**
   * Update session status
   */
  async updateSessionStatus(sessionId: string, status: SessionStatus): Promise<void> {
    const session = await this.loadSessionMetadata(sessionId);

    if (!session) {
      throw ErrorCatalog.session.notFound(sessionId);
    }

    const oldStatus = session.status;
    session.status = status;

    await this.saveSessionMetadata(session);

    if (this.historyEnabled) {
      await this.addHistoryEntry(sessionId, {
        timestamp: new Date(),
        event: 'status_changed',
        description: `Status changed from ${oldStatus} to ${status}`,
        metadata: { oldStatus, newStatus: status },
      });
    }
  }

  /**
   * Update session metadata
   */
  async updateMetadata(
    sessionId: string,
    updates: Partial<SessionMetadata>
  ): Promise<void> {
    const session = await this.loadSessionMetadata(sessionId);

    if (!session) {
      throw ErrorCatalog.session.notFound(sessionId);
    }

    session.metadata = {
      ...session.metadata,
      ...updates,
    };

    await this.saveSessionMetadata(session);
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<void> {
    const sessionPath = this.getSessionPath(sessionId);

    try {
      await fs.rm(sessionPath, { recursive: true, force: true });
    } catch (error) {
      throw ErrorCatalog.fs.fileNotFound(sessionPath, 'delete');
    }
  }

  /**
   * Export session to JSON
   */
  async exportSession(sessionId: string, outputPath: string): Promise<void> {
    const session = await this.loadSessionMetadata(sessionId);

    if (!session) {
      throw ErrorCatalog.session.notFound(sessionId);
    }

    const exportData: SessionExport = {
      version: '1.0.0',
      exportedAt: new Date(),
      session,
    };

    await fs.writeFile(outputPath, JSON.stringify(exportData, null, 2), 'utf-8');

    if (this.historyEnabled) {
      await this.addHistoryEntry(sessionId, {
        timestamp: new Date(),
        event: 'exported',
        description: `Session exported to ${outputPath}`,
      });
    }
  }

  /**
   * Import session from JSON
   */
  async importSession(importPath: string): Promise<string> {
    try {
      const content = await fs.readFile(importPath, 'utf-8');
      const exportData: SessionExport = JSON.parse(content);

      const session = this.deserializeSession(exportData.session);

      await this.saveSessionMetadata(session);

      if (this.historyEnabled) {
        await this.addHistoryEntry(session.sessionId, {
          timestamp: new Date(),
          event: 'restored',
          description: `Session imported from ${importPath}`,
        });
      }

      return session.sessionId;
    } catch (error) {
      throw ErrorCatalog.fs.fileNotFound(importPath, 'import');
    }
  }

  /**
   * Get session history
   */
  async getHistory(sessionId: string): Promise<SessionHistoryEntry[]> {
    try {
      const historyPath = this.getSessionHistoryPath(sessionId);
      const content = await fs.readFile(historyPath, 'utf-8');
      const data = JSON.parse(content);

      // Deserialize timestamps
      return data.map((entry: any) => ({
        ...entry,
        timestamp: new Date(entry.timestamp),
      }));
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  /**
   * Add history entry
   */
  private async addHistoryEntry(
    sessionId: string,
    entry: SessionHistoryEntry
  ): Promise<void> {
    const history = await this.getHistory(sessionId);

    history.push(entry);

    // Limit history size
    if (history.length > this.maxHistoryEntries) {
      history.splice(0, history.length - this.maxHistoryEntries);
    }

    const historyPath = this.getSessionHistoryPath(sessionId);
    await fs.writeFile(historyPath, JSON.stringify(history, null, 2), 'utf-8');
  }

  /**
   * Get analytics across all sessions
   */
  async getAnalytics(): Promise<SessionAnalytics> {
    const allSessions = await this.listSessions();

    const analytics: SessionAnalytics = {
      totalSessions: allSessions.length,
      activeSessions: allSessions.filter((s) => s.status === SessionStatus.ACTIVE).length,
      totalCost: 0,
      totalTokens: 0,
      topModels: [],
      costBySession: [],
      sessionsByStatus: {
        [SessionStatus.ACTIVE]: 0,
        [SessionStatus.ARCHIVED]: 0,
        [SessionStatus.MERGED]: 0,
        [SessionStatus.ABANDONED]: 0,
        [SessionStatus.PAUSED]: 0,
      },
      avgDurationMs: 0,
      totalTurns: 0,
    };

    const modelStats = new Map<string, { count: number; cost: number }>();

    for (const summary of allSessions) {
      // Aggregate costs and tokens
      analytics.totalCost += summary.totalCost || 0;
      analytics.totalTokens += summary.totalTokens || 0;
      analytics.totalTurns += summary.turnCount;

      // Count by status
      analytics.sessionsByStatus[summary.status]++;

      // Cost by session
      if (summary.totalCost) {
        analytics.costBySession.push({
          sessionId: summary.sessionId,
          name: summary.name,
          cost: summary.totalCost,
        });
      }

      // Load full session to get model stats
      const fullSession = await this.loadSessionMetadata(summary.sessionId);
      if (fullSession) {
        for (const turn of fullSession.turns) {
          if (turn.model) {
            const stats = modelStats.get(turn.model) || { count: 0, cost: 0 };
            stats.count++;
            stats.cost += turn.cost || 0;
            modelStats.set(turn.model, stats);
          }
        }
      }
    }

    // Top models
    analytics.topModels = Array.from(modelStats.entries())
      .map(([model, stats]) => ({ model, ...stats }))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 10);

    // Average duration
    const durationsSum = allSessions.reduce((sum, s) => sum + (s.durationMs || 0), 0);
    analytics.avgDurationMs = allSessions.length > 0 ? durationsSum / allSessions.length : 0;

    // Sort cost by session
    analytics.costBySession.sort((a, b) => b.cost - a.cost);

    return analytics;
  }

  /**
   * Create session summary from full data
   */
  private createSummary(session: SessionData): SessionSummary {
    return {
      sessionId: session.sessionId,
      name: session.name,
      status: session.status,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      turnCount: session.turns.length,
      totalCost: session.metadata.totalCost,
      totalTokens: session.metadata.totalTokens,
      durationMs: session.metadata.durationMs,
      tags: session.metadata.tags,
    };
  }

  /**
   * Serialize session (convert dates to strings)
   */
  private serializeSession(session: SessionData): any {
    return {
      ...session,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
      turns: session.turns.map((turn) => ({
        ...turn,
        timestamp: turn.timestamp.toISOString(),
      })),
      metadata: {
        ...session.metadata,
        lastActivityAt: session.metadata.lastActivityAt?.toISOString(),
      },
    };
  }

  /**
   * Deserialize session (convert strings to dates)
   */
  private deserializeSession(data: any): SessionData {
    return {
      ...data,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
      turns: (data.turns || []).map((turn: any) => ({
        ...turn,
        timestamp: new Date(turn.timestamp),
      })),
      metadata: {
        ...data.metadata,
        lastActivityAt: data.metadata.lastActivityAt
          ? new Date(data.metadata.lastActivityAt)
          : undefined,
      },
    };
  }
}
