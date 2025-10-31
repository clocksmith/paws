/**
 * @fileoverview Déjà Vu Detector - Pattern Recognition for Repetitive Actions
 * Detects when the agent repeats similar actions, creating opportunities for meta-improvement
 *
 * Like the human brain's déjà vu mechanism, this detects familiar patterns that might indicate:
 * - Inefficiency (doing the same thing multiple times manually)
 * - Missing abstractions (could be automated with a tool)
 * - Learning opportunities (pattern could be generalized)
 *
 * @blueprint 0x000044 - Déjà Vu pattern detection for identifying repetitive actions and automation opportunities.
 * @module DejaVuDetector
 * @version 1.0.0
 * @category meta-cognitive
 */

const DejaVuDetector = {
  metadata: {
    id: 'DejaVuDetector',
    version: '1.0.0',
    dependencies: ['ReflectionStore', 'Utils', 'EventBus', 'StateManager'],
    async: true,
    type: 'meta-cognitive'
  },

  factory: (deps) => {
    const { ReflectionStore, Utils, EventBus, StateManager } = deps;
    const { logger } = Utils;

    // Pattern detection thresholds
    const THRESHOLDS = {
      MIN_OCCURRENCES: 3,        // Minimum repetitions to trigger déjà vu
      SIMILARITY_THRESHOLD: 0.7,  // 70% similarity to count as pattern
      TIME_WINDOW_MS: 24 * 60 * 60 * 1000, // 24 hours
      HIGH_CONFIDENCE: 0.85,      // Strong pattern detected
      MEDIUM_CONFIDENCE: 0.65     // Moderate pattern detected
    };

    // Pattern cache (in-memory for fast detection)
    const patternCache = {
      toolCreations: [],
      toolCalls: [],
      failures: [],
      modifications: []
    };

    /**
     * Initialize déjà vu detection system
     */
    const init = async () => {
      logger.info('[DejaVu] Initializing pattern detection system');

      // Load recent history into cache
      await loadRecentHistory();

      // Listen for new actions
      EventBus.on('tool:executed', onToolExecuted);
      EventBus.on('tool:created', onToolCreated);
      EventBus.on('cycle:completed', onCycleCompleted);
      EventBus.on('reflection:added', onReflectionAdded);

      logger.info('[DejaVu] Pattern detection active');
    };

    /**
     * Load recent action history into cache
     */
    const loadRecentHistory = async () => {
      const cutoff = Date.now() - THRESHOLDS.TIME_WINDOW_MS;

      try {
        const reflections = await ReflectionStore.query({
          since: cutoff,
          limit: 100
        });

        for (const reflection of reflections) {
          categorizeAction(reflection);
        }

        logger.info(`[DejaVu] Loaded ${reflections.length} recent actions into cache`);
      } catch (error) {
        logger.warn('[DejaVu] Failed to load history, starting fresh:', error.message);
      }
    };

    /**
     * Categorize an action for pattern detection
     */
    const categorizeAction = (reflection) => {
      const { type, data } = reflection;

      if (type === 'tool_created') {
        patternCache.toolCreations.push({
          name: data.toolName,
          category: extractCategory(data.toolName),
          timestamp: reflection.timestamp,
          data: data
        });
      } else if (type === 'tool_executed') {
        patternCache.toolCalls.push({
          tool: data.toolName,
          args: normalizeArgs(data.arguments),
          timestamp: reflection.timestamp,
          data: data
        });
      } else if (type === 'cycle_failed' || data?.outcome === 'failure') {
        patternCache.failures.push({
          reason: data.reason || data.error,
          context: data.goal,
          timestamp: reflection.timestamp,
          data: data
        });
      } else if (type === 'artifact_modified') {
        patternCache.modifications.push({
          path: data.path,
          operation: data.operation,
          timestamp: reflection.timestamp,
          data: data
        });
      }

      // Trim old entries outside time window
      trimCache();
    };

    /**
     * Extract tool category from name (e.g., "create_analyzer_tool" -> "create")
     */
    const extractCategory = (toolName) => {
      const parts = toolName.split('_');
      return parts[0]; // First word is usually the category
    };

    /**
     * Normalize arguments for comparison (remove unique IDs, timestamps, etc.)
     */
    const normalizeArgs = (args) => {
      if (!args) return {};

      const normalized = { ...args };

      // Remove timestamp-like values
      delete normalized.timestamp;
      delete normalized.id;
      delete normalized.created_at;

      // Normalize paths (remove version numbers, etc.)
      if (normalized.path) {
        normalized.path = normalized.path.replace(/v\d+/, 'vX');
      }

      return normalized;
    };

    /**
     * Trim cache to remove entries outside time window
     */
    const trimCache = () => {
      const cutoff = Date.now() - THRESHOLDS.TIME_WINDOW_MS;

      patternCache.toolCreations = patternCache.toolCreations.filter(a => a.timestamp > cutoff);
      patternCache.toolCalls = patternCache.toolCalls.filter(a => a.timestamp > cutoff);
      patternCache.failures = patternCache.failures.filter(a => a.timestamp > cutoff);
      patternCache.modifications = patternCache.modifications.filter(a => a.timestamp > cutoff);
    };

    /**
     * Detect patterns in tool creation
     */
    const detectToolCreationPatterns = () => {
      const patterns = [];
      const categories = {};

      // Group by category
      for (const creation of patternCache.toolCreations) {
        if (!categories[creation.category]) {
          categories[creation.category] = [];
        }
        categories[creation.category].push(creation);
      }

      // Detect repeated categories
      for (const [category, tools] of Object.entries(categories)) {
        if (tools.length >= THRESHOLDS.MIN_OCCURRENCES) {
          patterns.push({
            type: 'repeated_tool_creation',
            category: category,
            count: tools.length,
            tools: tools.map(t => t.name),
            confidence: Math.min(0.5 + (tools.length * 0.1), 1.0),
            suggestion: `Created ${tools.length} tools with "${category}_" prefix. Consider creating a factory tool: create_${category}_tool`,
            examples: tools.slice(0, 3),
            timestamp: Date.now()
          });
        }
      }

      return patterns;
    };

    /**
     * Detect patterns in tool usage
     */
    const detectToolUsagePatterns = () => {
      const patterns = [];
      const sequences = [];

      // Look for sequential patterns (tool A followed by tool B)
      for (let i = 0; i < patternCache.toolCalls.length - 1; i++) {
        const current = patternCache.toolCalls[i];
        const next = patternCache.toolCalls[i + 1];

        // Check if they're close in time (within 5 minutes)
        if (next.timestamp - current.timestamp < 5 * 60 * 1000) {
          const sequence = `${current.tool} → ${next.tool}`;
          sequences.push(sequence);
        }
      }

      // Count sequence occurrences
      const sequenceCounts = {};
      for (const seq of sequences) {
        sequenceCounts[seq] = (sequenceCounts[seq] || 0) + 1;
      }

      // Detect repeated sequences
      for (const [sequence, count] of Object.entries(sequenceCounts)) {
        if (count >= THRESHOLDS.MIN_OCCURRENCES) {
          patterns.push({
            type: 'repeated_tool_sequence',
            sequence: sequence,
            count: count,
            confidence: Math.min(0.6 + (count * 0.1), 1.0),
            suggestion: `The sequence "${sequence}" repeated ${count} times. Consider creating a composite tool to automate this workflow.`,
            timestamp: Date.now()
          });
        }
      }

      return patterns;
    };

    /**
     * Detect patterns in failures
     */
    const detectFailurePatterns = () => {
      const patterns = [];
      const reasonCounts = {};

      // Group failures by reason
      for (const failure of patternCache.failures) {
        const normalized = normalizeFailureReason(failure.reason);
        if (!reasonCounts[normalized]) {
          reasonCounts[normalized] = [];
        }
        reasonCounts[normalized].push(failure);
      }

      // Detect repeated failures
      for (const [reason, failures] of Object.entries(reasonCounts)) {
        if (failures.length >= 2) { // Even 2 identical failures is concerning
          patterns.push({
            type: 'repeated_failure',
            reason: reason,
            count: failures.length,
            confidence: Math.min(0.7 + (failures.length * 0.15), 1.0),
            suggestion: `Failed ${failures.length} times with: "${reason}". This pattern should be avoided or the approach should change.`,
            contexts: failures.map(f => f.context),
            timestamp: Date.now()
          });
        }
      }

      return patterns;
    };

    /**
     * Normalize failure reason for pattern matching
     */
    const normalizeFailureReason = (reason) => {
      if (!reason) return 'unknown';

      // Remove specific values but keep structure
      return reason
        .replace(/['"][^'"]+['"]/g, 'VALUE')  // Replace quoted strings
        .replace(/\d+/g, 'NUM')                // Replace numbers
        .replace(/\s+/g, ' ')                  // Normalize whitespace
        .trim();
    };

    /**
     * Detect patterns in file modifications
     */
    const detectModificationPatterns = () => {
      const patterns = [];
      const pathCounts = {};

      // Group by file path
      for (const mod of patternCache.modifications) {
        pathCounts[mod.path] = (pathCounts[mod.path] || 0) + 1;
      }

      // Detect frequently modified files
      for (const [path, count] of Object.entries(pathCounts)) {
        if (count >= THRESHOLDS.MIN_OCCURRENCES) {
          patterns.push({
            type: 'repeated_modification',
            path: path,
            count: count,
            confidence: Math.min(0.5 + (count * 0.15), 1.0),
            suggestion: `Modified "${path}" ${count} times recently. This file may need refactoring or better abstraction.`,
            timestamp: Date.now()
          });
        }
      }

      return patterns;
    };

    /**
     * Run full pattern detection scan
     */
    const detectPatterns = async () => {
      logger.info('[DejaVu] Running pattern detection scan');

      const allPatterns = [
        ...detectToolCreationPatterns(),
        ...detectToolUsagePatterns(),
        ...detectFailurePatterns(),
        ...detectModificationPatterns()
      ];

      // Sort by confidence (highest first)
      allPatterns.sort((a, b) => b.confidence - a.confidence);

      logger.info(`[DejaVu] Detected ${allPatterns.length} patterns`);

      // Emit high-confidence patterns as déjà vu events
      for (const pattern of allPatterns) {
        if (pattern.confidence >= THRESHOLDS.HIGH_CONFIDENCE) {
          EventBus.emit('deja-vu:detected', {
            pattern: pattern,
            severity: 'high',
            actionable: true
          });

          logger.warn(`[DejaVu] ⚠️  STRONG PATTERN: ${pattern.suggestion}`);
        } else if (pattern.confidence >= THRESHOLDS.MEDIUM_CONFIDENCE) {
          EventBus.emit('deja-vu:detected', {
            pattern: pattern,
            severity: 'medium',
            actionable: true
          });

          logger.info(`[DejaVu] Pattern detected: ${pattern.suggestion}`);
        }
      }

      return allPatterns;
    };

    /**
     * Get inefficiency score (0-1, higher = more inefficient)
     */
    const calculateInefficiencyScore = async () => {
      const patterns = await detectPatterns();

      let score = 0;
      let reasons = [];

      for (const pattern of patterns) {
        if (pattern.type === 'repeated_tool_creation') {
          score += 0.2 * Math.min(pattern.count / 5, 1.0);
          reasons.push(`Creating similar tools manually (${pattern.count}x)`);
        }
        if (pattern.type === 'repeated_tool_sequence') {
          score += 0.15 * Math.min(pattern.count / 5, 1.0);
          reasons.push(`Repeating manual workflows (${pattern.count}x)`);
        }
        if (pattern.type === 'repeated_failure') {
          score += 0.25 * Math.min(pattern.count / 3, 1.0);
          reasons.push(`Repeating failed approaches (${pattern.count}x)`);
        }
        if (pattern.type === 'repeated_modification') {
          score += 0.1 * Math.min(pattern.count / 5, 1.0);
          reasons.push(`Frequent file modifications (${pattern.count}x)`);
        }
      }

      score = Math.min(score, 1.0);

      return {
        score: parseFloat(score.toFixed(2)),
        level: score > 0.7 ? 'high' : score > 0.4 ? 'medium' : 'low',
        reasons: reasons,
        patterns: patterns.filter(p => p.confidence >= THRESHOLDS.MEDIUM_CONFIDENCE)
      };
    };

    /**
     * Get actionable improvements based on detected patterns
     */
    const suggestImprovements = async () => {
      const patterns = await detectPatterns();
      const suggestions = [];

      for (const pattern of patterns) {
        if (pattern.confidence < THRESHOLDS.MEDIUM_CONFIDENCE) continue;

        if (pattern.type === 'repeated_tool_creation') {
          suggestions.push({
            priority: 'high',
            action: 'create_tool_factory',
            params: {
              category: pattern.category,
              examples: pattern.tools
            },
            rationale: pattern.suggestion,
            estimated_time_saved: `${pattern.count * 5} minutes`,
            pattern: pattern
          });
        }

        if (pattern.type === 'repeated_tool_sequence') {
          suggestions.push({
            priority: 'medium',
            action: 'create_composite_tool',
            params: {
              sequence: pattern.sequence.split(' → '),
              name: `automated_${pattern.sequence.split(' → ')[0]}_workflow`
            },
            rationale: pattern.suggestion,
            estimated_time_saved: `${pattern.count * 2} minutes`,
            pattern: pattern
          });
        }

        if (pattern.type === 'repeated_failure') {
          suggestions.push({
            priority: 'critical',
            action: 'avoid_pattern',
            params: {
              pattern: pattern.reason,
              alternative_needed: true
            },
            rationale: pattern.suggestion,
            estimated_time_saved: `Avoid ${pattern.count} failures`,
            pattern: pattern
          });
        }

        if (pattern.type === 'repeated_modification') {
          suggestions.push({
            priority: 'medium',
            action: 'refactor_file',
            params: {
              path: pattern.path,
              reason: 'frequent_changes'
            },
            rationale: pattern.suggestion,
            estimated_time_saved: 'Reduce future modifications',
            pattern: pattern
          });
        }
      }

      // Sort by priority
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      suggestions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

      return suggestions;
    };

    // Event handlers
    const onToolExecuted = (event) => {
      categorizeAction({
        type: 'tool_executed',
        timestamp: Date.now(),
        data: event
      });
    };

    const onToolCreated = (event) => {
      categorizeAction({
        type: 'tool_created',
        timestamp: Date.now(),
        data: event
      });
    };

    const onCycleCompleted = (event) => {
      // Automatically scan for patterns after each cycle
      if (Math.random() < 0.2) { // 20% chance to avoid overhead
        setTimeout(detectPatterns, 100);
      }
    };

    const onReflectionAdded = (event) => {
      if (event.reflection) {
        categorizeAction(event.reflection);
      }
    };

    /**
     * Clear all cached patterns (useful for testing)
     */
    const clearCache = () => {
      patternCache.toolCreations = [];
      patternCache.toolCalls = [];
      patternCache.failures = [];
      patternCache.modifications = [];
      logger.info('[DejaVu] Pattern cache cleared');
    };

    /**
     * Get current cache statistics
     */
    const getStats = () => {
      return {
        toolCreations: patternCache.toolCreations.length,
        toolCalls: patternCache.toolCalls.length,
        failures: patternCache.failures.length,
        modifications: patternCache.modifications.length,
        timeWindow: `${THRESHOLDS.TIME_WINDOW_MS / (60 * 60 * 1000)} hours`,
        thresholds: THRESHOLDS
      };
    };

    return {
      init,
      detectPatterns,
      calculateInefficiencyScore,
      suggestImprovements,
      clearCache,
      getStats,
      THRESHOLDS,  // Expose for configuration

      widget: (() => {
        class DejaVuDetectorWidget extends HTMLElement {
          constructor() {
            super();
            this.attachShadow({ mode: 'open' });
          }

          connectedCallback() {
            this.render();
            this._interval = setInterval(() => this.render(), 10000);
          }

          disconnectedCallback() {
            if (this._interval) clearInterval(this._interval);
          }

          set moduleApi(api) {
            this._api = api;
            this.render();
          }

          getStatus() {
            const stats = getStats();
            const totalActions = stats.toolCreations + stats.toolCalls + stats.failures + stats.modifications;
            const hasRecentActivity = totalActions > 0;

            let hasHighConfidence = false;
            try {
              const allPatterns = [
                ...detectToolCreationPatterns(),
                ...detectToolUsagePatterns(),
                ...detectFailurePatterns(),
                ...detectModificationPatterns()
              ];
              hasHighConfidence = allPatterns.some(p => p.confidence >= THRESHOLDS.HIGH_CONFIDENCE);
            } catch (e) {
              // Ignore detection errors in widget
            }

            return {
              state: hasHighConfidence ? 'warning' : (hasRecentActivity ? 'active' : 'disabled'),
              primaryMetric: totalActions > 0 ? `${totalActions} actions` : 'Idle',
              secondaryMetric: hasHighConfidence ? 'Patterns found!' : 'Monitoring',
              lastActivity: totalActions > 0 ? Date.now() : null,
              message: hasHighConfidence ? '⚠️ Repetitive patterns detected' : null
            };
          }

          render() {
            const stats = getStats();
            const totalActions = stats.toolCreations + stats.toolCalls + stats.failures + stats.modifications;

            let allPatterns = [];
            try {
              allPatterns = [
                ...detectToolCreationPatterns(),
                ...detectToolUsagePatterns(),
                ...detectFailurePatterns(),
                ...detectModificationPatterns()
              ].sort((a, b) => b.confidence - a.confidence);
            } catch (e) {
              // Ignore detection errors
            }

            const highConfidence = allPatterns.filter(p => p.confidence >= THRESHOLDS.HIGH_CONFIDENCE);
            const mediumConfidence = allPatterns.filter(p =>
              p.confidence >= THRESHOLDS.MEDIUM_CONFIDENCE &&
              p.confidence < THRESHOLDS.HIGH_CONFIDENCE
            );

            this.shadowRoot.innerHTML = `
              <style>
                :host {
                  display: block;
                  background: rgba(255,255,255,0.05);
                  border-radius: 8px;
                  padding: 16px;
                  font-family: monospace;
                  font-size: 12px;
                }
                h3 {
                  margin: 0 0 16px 0;
                  font-size: 1.4em;
                  color: #fff;
                  font-family: sans-serif;
                }
                .controls {
                  display: flex;
                  gap: 8px;
                  margin-bottom: 16px;
                  flex-wrap: wrap;
                }
                button {
                  padding: 6px 12px;
                  background: rgba(100,150,255,0.2);
                  border: 1px solid rgba(100,150,255,0.4);
                  border-radius: 4px;
                  color: #fff;
                  cursor: pointer;
                  font-size: 0.9em;
                }
                button:hover {
                  background: rgba(100,150,255,0.3);
                }
                .section {
                  margin-bottom: 12px;
                }
                .section-title {
                  color: #0ff;
                  font-weight: bold;
                  margin-bottom: 8px;
                }
                .stat-row {
                  color: #e0e0e0;
                  margin-bottom: 4px;
                }
                .stat-value {
                  color: #0ff;
                }
                .stat-value.error {
                  color: #f00;
                }
                .window-info {
                  color: #888;
                  font-size: 10px;
                }
                .patterns-box {
                  margin-bottom: 12px;
                  padding: 8px;
                  background: rgba(255,255,0,0.05);
                  border: 1px solid rgba(255,255,0,0.2);
                  border-radius: 4px;
                }
                .patterns-title {
                  color: #ff0;
                  font-weight: bold;
                  margin-bottom: 4px;
                }
                .pattern-stat {
                  color: #aaa;
                  margin-bottom: 2px;
                }
                .pattern-stat-value {
                  color: #fff;
                }
                .pattern-stat-value.high {
                  color: #f00;
                }
                .pattern-stat-value.medium {
                  color: #ff0;
                }
                .top-patterns {
                  margin-bottom: 12px;
                }
                .pattern-list {
                  max-height: 120px;
                  overflow-y: auto;
                }
                .pattern-item {
                  padding: 4px;
                  border-bottom: 1px solid rgba(255,255,255,0.1);
                  margin-bottom: 4px;
                }
                .pattern-type {
                  font-size: 11px;
                  font-weight: bold;
                }
                .pattern-type.high { color: #f00; }
                .pattern-type.medium { color: #ff0; }
                .pattern-type.low { color: #888; }
                .pattern-suggestion {
                  color: #888;
                  font-size: 10px;
                  margin-top: 2px;
                }
                .pattern-confidence {
                  color: #666;
                  font-size: 9px;
                  margin-top: 2px;
                }
                .thresholds-box {
                  margin-top: 12px;
                  padding: 8px;
                  background: rgba(0,0,0,0.3);
                  border: 1px solid rgba(255,255,255,0.1);
                  border-radius: 4px;
                }
                .thresholds-title {
                  color: #888;
                  font-weight: bold;
                  margin-bottom: 4px;
                  font-size: 10px;
                }
                .threshold-item {
                  color: #666;
                  font-size: 10px;
                }
                .empty-state {
                  color: #888;
                  text-align: center;
                  margin-top: 20px;
                }
              </style>

              <div class="deja-vu-panel">
                <h3>♲ Déjà Vu Detector</h3>

                <div class="controls">
                  <button class="detect-patterns">⌕ Detect Patterns</button>
                  <button class="inefficiency-score">☱ Inefficiency Score</button>
                  <button class="suggest-improvements">◯ Suggest Improvements</button>
                  <button class="clear-cache">⛶ Clear Cache</button>
                </div>

                <div class="section">
                  <div class="section-title">Action Cache</div>
                  <div class="stat-row">Tool Creations: <span class="stat-value">${stats.toolCreations}</span></div>
                  <div class="stat-row">Tool Calls: <span class="stat-value">${stats.toolCalls}</span></div>
                  <div class="stat-row">Failures: <span class="stat-value error">${stats.failures}</span></div>
                  <div class="stat-row">Modifications: <span class="stat-value">${stats.modifications}</span></div>
                  <div class="window-info">Window: ${stats.timeWindow}</div>
                </div>

                ${allPatterns.length > 0 ? `
                  <div class="patterns-box">
                    <div class="patterns-title">Detected Patterns</div>
                    <div class="pattern-stat">Total: <span class="pattern-stat-value">${allPatterns.length}</span></div>
                    ${highConfidence.length > 0 ? `<div class="pattern-stat">High Confidence: <span class="pattern-stat-value high">${highConfidence.length}</span></div>` : ''}
                    ${mediumConfidence.length > 0 ? `<div class="pattern-stat">Medium Confidence: <span class="pattern-stat-value medium">${mediumConfidence.length}</span></div>` : ''}
                  </div>

                  ${highConfidence.length > 0 || mediumConfidence.length > 0 ? `
                    <div class="top-patterns">
                      <div class="section-title">Top Patterns</div>
                      <div class="pattern-list">
                        ${allPatterns.slice(0, 3).map(pattern => {
                          const confidenceClass = pattern.confidence >= THRESHOLDS.HIGH_CONFIDENCE ? 'high' :
                                                 pattern.confidence >= THRESHOLDS.MEDIUM_CONFIDENCE ? 'medium' : 'low';
                          const icon = pattern.type === 'repeated_failure' ? '✗' :
                                      pattern.type === 'repeated_tool_creation' ? '⚒' :
                                      pattern.type === 'repeated_tool_sequence' ? '↻' : '✎';
                          return `
                            <div class="pattern-item">
                              <div class="pattern-type ${confidenceClass}">${icon} ${pattern.type.replace(/_/g, ' ')}</div>
                              <div class="pattern-suggestion">${pattern.suggestion}</div>
                              <div class="pattern-confidence">Confidence: ${(pattern.confidence * 100).toFixed(0)}%</div>
                            </div>
                          `;
                        }).join('')}
                      </div>
                    </div>
                  ` : ''}
                ` : ''}

                <div class="thresholds-box">
                  <div class="thresholds-title">Detection Thresholds</div>
                  <div class="threshold-item">Min Occurrences: ${stats.thresholds.MIN_OCCURRENCES}</div>
                  <div class="threshold-item">High Confidence: ${(stats.thresholds.HIGH_CONFIDENCE * 100).toFixed(0)}%</div>
                  <div class="threshold-item">Medium Confidence: ${(stats.thresholds.MEDIUM_CONFIDENCE * 100).toFixed(0)}%</div>
                </div>

                ${totalActions === 0 ? '<div class="empty-state">No actions tracked yet</div>' : ''}
              </div>
            `;

            // Attach event listeners
            this.shadowRoot.querySelector('.detect-patterns')?.addEventListener('click', async () => {
              try {
                const patterns = await detectPatterns();
                const highConf = patterns.filter(p => p.confidence >= THRESHOLDS.HIGH_CONFIDENCE);
                logger.info(`[Widget] Found ${patterns.length} patterns (${highConf.length} high confidence)`);
                this.render();
              } catch (error) {
                logger.error('[Widget] Pattern detection failed:', error);
              }
            });

            this.shadowRoot.querySelector('.inefficiency-score')?.addEventListener('click', async () => {
              try {
                const result = await calculateInefficiencyScore();
                logger.info('[Widget] Inefficiency Score:', result);
                console.log('Inefficiency Analysis:', result);
              } catch (error) {
                logger.error('[Widget] Inefficiency score calculation failed:', error);
              }
            });

            this.shadowRoot.querySelector('.suggest-improvements')?.addEventListener('click', async () => {
              try {
                const suggestions = await suggestImprovements();
                logger.info(`[Widget] Found ${suggestions.length} improvement suggestions`);
                console.table(suggestions.map(s => ({
                  Priority: s.priority,
                  Action: s.action,
                  Rationale: s.rationale,
                  'Time Saved': s.estimated_time_saved
                })));
              } catch (error) {
                logger.error('[Widget] Suggestion generation failed:', error);
              }
            });

            this.shadowRoot.querySelector('.clear-cache')?.addEventListener('click', () => {
              clearCache();
              this.render();
            });
          }
        }

        if (!customElements.get('deja-vu-detector-widget')) {
          customElements.define('deja-vu-detector-widget', DejaVuDetectorWidget);
        }

        return {
          element: 'deja-vu-detector-widget',
          displayName: 'Déjà Vu Detector',
          icon: '♲',
          category: 'rsi',
          order: 75,
          updateInterval: 10000
        };
      })()
    };
  }
};

// Export for both REPLOID (global) and ES modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DejaVuDetector };
}

export default DejaVuDetector;
