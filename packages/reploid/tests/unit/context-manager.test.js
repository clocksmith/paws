/**
 * @fileoverview Unit tests for ContextManager module
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load ContextManager module
const ContextManager = require(resolve(__dirname, '../../upgrades/context-manager.js')).default || require(resolve(__dirname, '../../upgrades/context-manager.js'));

// Mock dependencies
const mockUtils = {
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
};

const mockEventBus = {
  emit: vi.fn(),
  on: vi.fn()
};

const contextManager = ContextManager.factory({ Utils: mockUtils, EventBus: mockEventBus });

describe('ContextManager - Token Estimation', () => {
  it('should estimate tokens correctly', () => {
    const text = 'Hello world this is a test message';
    const tokens = contextManager.api.estimateTokens(text);
    expect(tokens).toBeGreaterThan(0);
    expect(tokens).toBeLessThan(text.length); // Should be less than character count
  });

  it('should handle empty strings', () => {
    const tokens = contextManager.api.estimateTokens('');
    expect(tokens).toBe(0);
  });

  it('should estimate roughly 4 chars per token', () => {
    const text = 'a'.repeat(400); // 400 chars
    const tokens = contextManager.api.estimateTokens(text);
    expect(tokens).toBeGreaterThan(80); // ~100 tokens expected
    expect(tokens).toBeLessThan(120);
  });
});

describe('ContextManager - Importance Scoring', () => {
  it('should score system messages highly', () => {
    const systemMessage = { role: 'system', parts: [{ text: 'You are an agent' }] };
    const score = contextManager.api.scoreContextImportance(systemMessage, 0, 10);
    expect(score).toBeGreaterThan(50); // System messages should score high
  });

  it('should score recent messages higher', () => {
    const message = { role: 'user', parts: [{ text: 'Hello' }] };
    const recentScore = contextManager.api.scoreContextImportance(message, 9, 10);
    const oldScore = contextManager.api.scoreContextImportance(message, 0, 10);
    expect(recentScore).toBeGreaterThan(oldScore);
  });

  it('should score error messages highly', () => {
    const errorMessage = { role: 'model', parts: [{ text: 'ERROR: Failed to execute' }] };
    const score = contextManager.api.scoreContextImportance(errorMessage, 5, 10);
    expect(score).toBeGreaterThan(30); // Error keyword should boost score
  });
});

describe('ContextManager - Context Pruning', () => {
  it('should always keep system prompts', () => {
    const history = [
      { role: 'system', parts: [{ text: 'System prompt' }] },
      ...Array(100).fill({ role: 'user', parts: [{ text: 'message' }] })
    ];

    const { pruned } = contextManager.api.pruneContext(history, 1000);
    expect(pruned[0].role).toBe('system');
  });

  it('should always keep most recent message', () => {
    const history = [
      ...Array(100).fill({ role: 'user', parts: [{ text: 'old message' }] }),
      { role: 'user', parts: [{ text: 'latest message' }] }
    ];

    const { pruned } = contextManager.api.pruneContext(history, 1000);
    const lastMessage = pruned[pruned.length - 1];
    expect(lastMessage.parts[0].text).toBe('latest message');
  });

  it('should respect token limits', () => {
    const history = Array(100).fill({
      role: 'user',
      parts: [{ text: 'a'.repeat(100) }] // ~25 tokens each
    });

    const { stats } = contextManager.api.pruneContext(history, 500);
    expect(stats.final).toBeLessThanOrEqual(500);
  });

  it('should remove low-importance messages', () => {
    const history = [
      { role: 'system', parts: [{ text: 'System' }] },
      { role: 'user', parts: [{ text: 'unimportant' }] },
      { role: 'model', parts: [{ text: 'ERROR: Critical!' }] },
      { role: 'user', parts: [{ text: 'latest' }] }
    ];

    const { pruned, removed } = contextManager.api.pruneContext(history, 200);
    expect(removed.length).toBeGreaterThan(0);
    expect(pruned.some(m => m.parts[0].text === 'ERROR: Critical!')).toBe(true);
  });

  it('should return stats with correct counts', () => {
    const history = Array(50).fill({
      role: 'user',
      parts: [{ text: 'message' }]
    });

    const { stats } = contextManager.api.pruneContext(history, 500);
    expect(stats.itemsKept + stats.itemsRemoved).toBe(history.length);
    expect(stats.original).toBeGreaterThan(stats.final);
  });
});

describe('ContextManager - Context Summarization', () => {
  it('should create summary of old messages', () => {
    const history = Array(20).fill({
      role: 'user',
      parts: [{ text: 'message' }]
    });

    const { summarized, summary } = contextManager.api.summarizeContext(history, 5);
    expect(summarized.length).toBeLessThan(history.length);
    expect(summary).toBeDefined();
    expect(summary.role).toBe('system');
  });

  it('should keep recent messages verbatim', () => {
    const history = [
      ...Array(15).fill({ role: 'user', parts: [{ text: 'old' }] }),
      { role: 'user', parts: [{ text: 'recent1' }] },
      { role: 'user', parts: [{ text: 'recent2' }] }
    ];

    const { summarized } = contextManager.api.summarizeContext(history, 2);
    const recentMessages = summarized.slice(-2);
    expect(recentMessages[0].parts[0].text).toBe('recent1');
    expect(recentMessages[1].parts[0].text).toBe('recent2');
  });

  it('should include summary statistics', () => {
    const history = Array(30).fill({
      role: 'user',
      parts: [{ text: 'message' }]
    });

    const { stats } = contextManager.api.summarizeContext(history, 10);
    expect(stats.summarizedItems).toBe(20);
    expect(stats.keptItems).toBe(10);
  });
});

describe('ContextManager - Context Stats', () => {
  it('should calculate context statistics', () => {
    const history = Array(10).fill({
      role: 'user',
      parts: [{ text: 'a'.repeat(100) }] // ~25 tokens each
    });

    const stats = contextManager.api.getContextStats(history, 'default');
    expect(stats.items).toBe(10);
    expect(stats.tokens).toBeGreaterThan(200);
    expect(stats.limit).toBeDefined();
    expect(stats.utilizationPercent).toBeGreaterThan(0);
  });

  it('should detect when pruning is needed', () => {
    const history = Array(1000).fill({
      role: 'user',
      parts: [{ text: 'a'.repeat(100) }]
    });

    const stats = contextManager.api.getContextStats(history, 'default');
    expect(stats.needsPruning).toBe(true);
    expect(stats.utilizationPercent).toBeGreaterThan(80);
  });

  it('should work with different model names', () => {
    const history = Array(10).fill({ role: 'user', parts: [{ text: 'test' }] });

    const statsGemini = contextManager.api.getContextStats(history, 'gemini-2.5-flash');
    const statsClaude = contextManager.api.getContextStats(history, 'claude-4-5-sonnet');

    expect(statsGemini.limit).toBeGreaterThan(statsClaude.limit);
  });
});

describe('ContextManager - Auto Management', () => {
  it('should auto-prune when over 80% capacity', () => {
    const history = Array(1000).fill({
      role: 'user',
      parts: [{ text: 'a'.repeat(100) }]
    });

    const { pruned } = contextManager.api.autoManageContext(history, 'default');
    expect(pruned.length).toBeLessThan(history.length);
  });

  it('should not prune when under 80% capacity', () => {
    const history = Array(10).fill({
      role: 'user',
      parts: [{ text: 'short' }]
    });

    const { pruned } = contextManager.api.autoManageContext(history, 'default');
    expect(pruned.length).toBe(history.length);
  });
});

describe('ContextManager - Web Component Widget', () => {
  it('should export widget configuration', () => {
    expect(contextManager.widget).toBeDefined();
    expect(contextManager.widget.element).toBe('context-manager-widget');
    expect(contextManager.widget.displayName).toBe('Context Manager');
    expect(contextManager.widget.icon).toBe('🧠');
    expect(contextManager.widget.category).toBe('intelligence');
  });
});
