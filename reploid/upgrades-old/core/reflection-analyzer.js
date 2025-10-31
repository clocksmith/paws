/**
 * @fileoverview Reflection Analyzer for REPLOID
 * Analyzes patterns in reflections to enable learning from past experiences.
 * Provides clustering, failure pattern detection, and success strategy identification.
 *
 * @blueprint 0x000036 - Outlines the reflection analysis engine.
 * @module ReflectionAnalyzer
 * @version 1.0.0
 * @category intelligence
 */

const ReflectionAnalyzer = {
  metadata: {
    id: 'ReflectionAnalyzer',
    version: '1.0.0',
    dependencies: ['ReflectionStore', 'Utils', 'EventBus'],
    async: true,
    type: 'intelligence'
  },

  factory: (deps) => {
    const { ReflectionStore, Utils, EventBus } = deps;
    const { logger } = Utils;

    /**
     * Extract keywords from text
     */
    const getKeywords = (text) => {
      if (!text) return [];
      return text.toLowerCase()
        .split(/\W+/)
        .filter(w => w.length > 3)
        .slice(0, 10);
    };

    /**
     * Calculate Jaccard similarity between two keyword sets
     */
    const jaccardSimilarity = (keywordsA, keywordsB) => {
      const setA = new Set(keywordsA);
      const setB = new Set(keywordsB);
      const intersection = new Set([...setA].filter(x => setB.has(x)));
      const union = new Set([...setA, ...setB]);
      return union.size > 0 ? intersection.size / union.size : 0;
    };

    /**
     * Find common tags across a set of reflections
     */
    const findCommonTags = (reflections) => {
      const tagCounts = {};
      reflections.forEach(r => {
        (r.tags || []).forEach(tag => {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
      });

      return Object.entries(tagCounts)
        .filter(([tag, count]) => count >= reflections.length * 0.5)
        .map(([tag]) => tag);
    };

    /**
     * Cluster reflections by similarity
     * Uses Jaccard similarity on description keywords
     */
    const clusterReflections = async (minClusterSize = 3) => {
      logger.info('[ReflectionAnalyzer] Clustering reflections');

      const allReflections = await ReflectionStore.getReflections({ limit: 100 });
      if (allReflections.length < minClusterSize) {
        return [];
      }

      const clusters = [];
      const used = new Set();

      for (let i = 0; i < allReflections.length; i++) {
        if (used.has(i)) continue;

        const cluster = [allReflections[i]];
        const keywordsI = getKeywords(allReflections[i].description);

        for (let j = i + 1; j < allReflections.length; j++) {
          if (used.has(j)) continue;

          const keywordsJ = getKeywords(allReflections[j].description);
          const similarity = jaccardSimilarity(keywordsI, keywordsJ);

          if (similarity > 0.3) {
            cluster.push(allReflections[j]);
            used.add(j);
          }
        }

        if (cluster.length >= minClusterSize) {
          const successCount = cluster.filter(r => r.outcome === 'successful').length;
          clusters.push({
            size: cluster.length,
            reflections: cluster,
            commonTags: findCommonTags(cluster),
            successRate: (successCount / cluster.length * 100).toFixed(1),
            keywords: keywordsI.slice(0, 5)
          });
        }

        used.add(i);
      }

      clusters.sort((a, b) => b.size - a.size);
      logger.info(`[ReflectionAnalyzer] Found ${clusters.length} clusters`);
      return clusters;
    };

    /**
     * Extract failure indicators from reflection description
     */
    const extractFailureIndicators = (description) => {
      const indicators = [];
      const text = description.toLowerCase();

      // Common failure patterns
      const patterns = {
        'syntax-error': /syntax error|unexpected token|parse error/,
        'type-error': /type error|cannot read property|undefined is not/,
        'reference-error': /reference error|is not defined/,
        'timeout': /timeout|timed out|exceeded/,
        'network-error': /network error|fetch failed|connection/,
        'permission-denied': /permission denied|access denied|unauthorized/,
        'file-not-found': /file not found|enoent|no such file/,
        'memory-error': /out of memory|memory limit|allocation failed/,
        'validation-error': /validation failed|invalid input|bad request/
      };

      for (const [indicator, pattern] of Object.entries(patterns)) {
        if (pattern.test(text)) {
          indicators.push(indicator);
        }
      }

      return indicators;
    };

    /**
     * Generate recommendations for a failure indicator
     */
    const generateRecommendations = (indicator) => {
      const recommendations = {
        'syntax-error': [
          'Use a linter or syntax checker before applying changes',
          'Validate code structure with AST parsing',
          'Test code in isolation before integration'
        ],
        'type-error': [
          'Add null/undefined checks before property access',
          'Use optional chaining (?.) for safe property access',
          'Validate input types at function boundaries'
        ],
        'reference-error': [
          'Check variable declarations and scope',
          'Verify imports and module dependencies',
          'Use "use strict" to catch undeclared variables'
        ],
        'timeout': [
          'Add timeout configuration with reasonable limits',
          'Implement retry logic with exponential backoff',
          'Optimize slow operations or add caching'
        ],
        'network-error': [
          'Implement retry logic for transient failures',
          'Add fallback mechanisms for network requests',
          'Check connectivity before making requests'
        ],
        'permission-denied': [
          'Verify required permissions are granted',
          'Request permissions before attempting operations',
          'Provide fallback for denied permissions'
        ],
        'file-not-found': [
          'Check file paths are correct and absolute',
          'Verify files exist before attempting to read',
          'Handle missing files gracefully with defaults'
        ],
        'memory-error': [
          'Process large datasets in chunks',
          'Implement pagination for large collections',
          'Clear caches and release unused resources'
        ],
        'validation-error': [
          'Add input validation with clear error messages',
          'Use JSON schema or type checking for validation',
          'Provide examples of valid input formats'
        ]
      };

      return recommendations[indicator] || ['Review the error details and try a different approach'];
    };

    /**
     * Detect recurring failure patterns
     */
    const detectFailurePatterns = async () => {
      logger.info('[ReflectionAnalyzer] Detecting failure patterns');

      const failed = await ReflectionStore.getReflections({
        outcome: 'failed',
        limit: 100
      });

      const patterns = {};

      for (const reflection of failed) {
        const indicators = extractFailureIndicators(reflection.description);

        for (const indicator of indicators) {
          if (!patterns[indicator]) {
            patterns[indicator] = {
              count: 0,
              examples: [],
              recommendations: generateRecommendations(indicator)
            };
          }
          patterns[indicator].count++;
          if (patterns[indicator].examples.length < 3) {
            patterns[indicator].examples.push({
              sessionId: reflection.sessionId,
              description: reflection.description.slice(0, 100),
              timestamp: reflection.timestamp
            });
          }
        }
      }

      // Sort by frequency
      const sortedPatterns = Object.entries(patterns)
        .map(([indicator, data]) => ({ indicator, ...data }))
        .sort((a, b) => b.count - a.count);

      logger.info(`[ReflectionAnalyzer] Found ${sortedPatterns.length} failure patterns`);
      return sortedPatterns;
    };

    /**
     * Get top success strategies from reflections
     */
    const getTopSuccessStrategies = async (limit = 5) => {
      logger.info('[ReflectionAnalyzer] Analyzing success strategies');

      const successful = await ReflectionStore.getReflections({
        outcome: 'successful',
        limit: 100
      });

      if (successful.length === 0) {
        return [];
      }

      // Extract strategy-related tags
      const strategies = {};
      for (const reflection of successful) {
        const tags = reflection.tags || [];
        const strategyTags = tags.filter(t =>
          t.includes('strategy_') ||
          t.includes('approach_') ||
          t.includes('method_')
        );

        for (const strategy of strategyTags) {
          strategies[strategy] = (strategies[strategy] || 0) + 1;
        }

        // Also extract from description
        const keywords = getKeywords(reflection.description);
        const strategyKeywords = keywords.filter(k =>
          k.includes('atomic') ||
          k.includes('incremental') ||
          k.includes('test') ||
          k.includes('validate') ||
          k.includes('checkpoint')
        );

        for (const keyword of strategyKeywords) {
          const strategyName = `strategy_${keyword}`;
          strategies[strategyName] = (strategies[strategyName] || 0) + 1;
        }
      }

      const topStrategies = Object.entries(strategies)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([strategy, count]) => ({
          strategy: strategy.replace(/^strategy_/, '').replace(/_/g, ' '),
          successCount: count,
          percentage: (count / successful.length * 100).toFixed(1)
        }));

      logger.info(`[ReflectionAnalyzer] Found ${topStrategies.length} success strategies`);
      return topStrategies;
    };

    /**
     * Recommend solution based on similar past reflections
     */
    const recommendSolution = async (currentProblem) => {
      logger.info('[ReflectionAnalyzer] Finding solution recommendations');

      const keywords = getKeywords(currentProblem);
      if (keywords.length === 0) {
        return {
          found: false,
          message: 'Could not extract keywords from problem description'
        };
      }

      // Get all reflections and find similar ones
      const allReflections = await ReflectionStore.getReflections({ limit: 100 });
      const similar = [];

      for (const reflection of allReflections) {
        const reflectionKeywords = getKeywords(reflection.description);
        const similarity = jaccardSimilarity(keywords, reflectionKeywords);

        if (similarity > 0.2) {
          similar.push({ ...reflection, similarity });
        }
      }

      // Sort by similarity
      similar.sort((a, b) => b.similarity - a.similarity);

      // Filter for successful cases
      const successful = similar.filter(r => r.outcome === 'successful');

      if (successful.length === 0) {
        return {
          found: false,
          message: 'No similar successful cases found',
          similarFailures: similar.filter(r => r.outcome === 'failed').length
        };
      }

      // Extract recommendations
      const recommendations = {};
      for (const reflection of successful) {
        const recs = reflection.recommendations || [];
        for (const rec of recs) {
          recommendations[rec] = (recommendations[rec] || 0) + 1;
        }
      }

      const topRecommendations = Object.entries(recommendations)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([rec, count]) => ({
          recommendation: rec,
          frequency: count,
          confidence: (count / successful.length * 100).toFixed(0) + '%'
        }));

      return {
        found: true,
        topRecommendations,
        similarCases: successful.length,
        averageSimilarity: (successful.reduce((sum, r) => sum + r.similarity, 0) / successful.length).toFixed(2)
      };
    };

    /**
     * Get learning insights - comprehensive analysis
     */
    const getLearningInsights = async () => {
      logger.info('[ReflectionAnalyzer] Generating learning insights');

      const [clusters, failurePatterns, successStrategies] = await Promise.all([
        clusterReflections(3),
        detectFailurePatterns(),
        getTopSuccessStrategies(5)
      ]);

      const allReflections = await ReflectionStore.getReflections({ limit: 1000 });
      const successfulCount = allReflections.filter(r => r.outcome === 'successful').length;
      const failedCount = allReflections.filter(r => r.outcome === 'failed').length;

      return {
        summary: {
          totalReflections: allReflections.length,
          successfulCount,
          failedCount,
          overallSuccessRate: allReflections.length > 0
            ? (successfulCount / allReflections.length * 100).toFixed(1)
            : 0
        },
        clusters: clusters.slice(0, 5),
        failurePatterns: failurePatterns.slice(0, 5),
        successStrategies,
        recommendations: generateGeneralRecommendations(failurePatterns, successStrategies)
      };
    };

    /**
     * Generate general recommendations based on patterns
     */
    const generateGeneralRecommendations = (failurePatterns, successStrategies) => {
      const recommendations = [];

      // Based on failure patterns
      if (failurePatterns.length > 0) {
        const topFailure = failurePatterns[0];
        recommendations.push({
          type: 'reduce-failures',
          priority: 'high',
          message: `Address recurring ${topFailure.indicator} (${topFailure.count} occurrences)`,
          actions: topFailure.recommendations.slice(0, 2)
        });
      }

      // Based on success strategies
      if (successStrategies.length > 0) {
        const topStrategy = successStrategies[0];
        recommendations.push({
          type: 'amplify-success',
          priority: 'medium',
          message: `Continue using '${topStrategy.strategy}' strategy (${topStrategy.percentage}% success rate)`,
          actions: [`Apply this strategy to similar tasks`]
        });
      }

      // General best practices
      recommendations.push({
        type: 'best-practice',
        priority: 'low',
        message: 'Maintain consistent reflection documentation',
        actions: [
          'Tag reflections with relevant categories',
          'Include specific error messages in descriptions',
          'Document what worked and what didn\'t'
        ]
      });

      return recommendations;
    };

    /**
     * Detect meta-cognitive improvement opportunities from reflection history
     * Integrates with MetaCognitiveLayer for autonomous self-improvement
     */
    const detectMetaImprovementOpportunities = async () => {
      logger.info('[ReflectionAnalyzer] Analyzing reflection history for meta-improvement opportunities');

      const opportunities = [];

      // Analyze tool creation patterns
      const toolCreationReflections = await ReflectionStore.query({
        type: 'tool_created',
        limit: 100
      });

      if (toolCreationReflections.length >= 3) {
        // Group by tool name prefix
        const prefixGroups = {};
        for (const reflection of toolCreationReflections) {
          const toolName = reflection.data?.toolName || '';
          const prefix = toolName.split('_')[0];
          if (!prefixGroups[prefix]) {
            prefixGroups[prefix] = [];
          }
          prefixGroups[prefix].push(reflection);
        }

        // Detect repeated tool creation patterns
        for (const [prefix, reflections] of Object.entries(prefixGroups)) {
          if (reflections.length >= 3) {
            opportunities.push({
              type: 'tool_factory_opportunity',
              priority: 'high',
              category: prefix,
              count: reflections.length,
              confidence: Math.min(0.6 + (reflections.length * 0.1), 1.0),
              suggestion: `Created ${reflections.length} tools with "${prefix}_" prefix. Consider creating a factory tool.`,
              toolNames: reflections.map(r => r.data.toolName).slice(0, 5),
              action: 'create_tool_factory',
              params: {
                category: prefix,
                examples: reflections.map(r => r.data.toolName)
              }
            });
          }
        }
      }

      // Analyze workflow patterns from successful cycles
      const successfulCycles = await ReflectionStore.query({
        type: 'cycle_completed',
        outcome: 'successful',
        limit: 50
      });

      // Look for repeated tool usage sequences
      const toolSequences = {};
      for (const cycle of successfulCycles) {
        const toolsUsed = cycle.data?.toolsUsed || [];
        if (toolsUsed.length >= 2) {
          for (let i = 0; i < toolsUsed.length - 1; i++) {
            const sequence = `${toolsUsed[i]} → ${toolsUsed[i+1]}`;
            toolSequences[sequence] = (toolSequences[sequence] || 0) + 1;
          }
        }
      }

      // Detect repeated sequences
      for (const [sequence, count] of Object.entries(toolSequences)) {
        if (count >= 3) {
          opportunities.push({
            type: 'workflow_automation_opportunity',
            priority: 'medium',
            sequence: sequence,
            count: count,
            confidence: Math.min(0.5 + (count * 0.15), 1.0),
            suggestion: `The sequence "${sequence}" repeated ${count} times. Consider creating a composite tool.`,
            action: 'create_composite_tool',
            params: {
              sequence: sequence.split(' → '),
              name: `automated_${sequence.split(' → ')[0]}_workflow`
            }
          });
        }
      }

      // Analyze repeated modification patterns
      const modificationReflections = await ReflectionStore.query({
        type: 'artifact_modified',
        limit: 100
      });

      const pathModificationCounts = {};
      for (const reflection of modificationReflections) {
        const path = reflection.data?.path || '';
        if (path) {
          pathModificationCounts[path] = (pathModificationCounts[path] || 0) + 1;
        }
      }

      for (const [path, count] of Object.entries(pathModificationCounts)) {
        if (count >= 5) {
          opportunities.push({
            type: 'refactoring_opportunity',
            priority: 'medium',
            path: path,
            count: count,
            confidence: Math.min(0.5 + (count * 0.1), 1.0),
            suggestion: `Modified "${path}" ${count} times. This file may benefit from refactoring.`,
            action: 'refactor_file',
            params: {
              path: path,
              reason: 'frequent_modifications'
            }
          });
        }
      }

      // Emit high-confidence opportunities to MetaCognitiveLayer
      for (const opportunity of opportunities) {
        if (opportunity.confidence >= 0.7) {
          EventBus?.emit('meta:improvement:opportunity', {
            source: 'ReflectionAnalyzer',
            opportunity: opportunity,
            timestamp: Date.now()
          });
          logger.info(`[ReflectionAnalyzer] ⚏ Meta-improvement opportunity detected: ${opportunity.suggestion}`);
        }
      }

      logger.info(`[ReflectionAnalyzer] Found ${opportunities.length} meta-improvement opportunities`);
      return opportunities.sort((a, b) => b.confidence - a.confidence);
    };

    /**
     * Trigger meta-cognitive analysis and notify MetaCognitiveLayer
     * This can be called periodically or after significant events
     */
    const triggerMetaAnalysis = async () => {
      logger.info('[ReflectionAnalyzer] Triggering meta-cognitive analysis');

      const opportunities = await detectMetaImprovementOpportunities();
      const insights = await getLearningInsights();

      // Calculate overall inefficiency based on patterns
      let inefficiencyScore = 0;

      // Factor in tool creation patterns (repeated manual creation)
      const toolFactoryOpps = opportunities.filter(o => o.type === 'tool_factory_opportunity');
      if (toolFactoryOpps.length > 0) {
        inefficiencyScore += Math.min(toolFactoryOpps.length * 0.15, 0.3);
      }

      // Factor in workflow patterns (repeated sequences)
      const workflowOpps = opportunities.filter(o => o.type === 'workflow_automation_opportunity');
      if (workflowOpps.length > 0) {
        inefficiencyScore += Math.min(workflowOpps.length * 0.1, 0.2);
      }

      // Factor in refactoring needs (code churn)
      const refactoringOpps = opportunities.filter(o => o.type === 'refactoring_opportunity');
      if (refactoringOpps.length > 0) {
        inefficiencyScore += Math.min(refactoringOpps.length * 0.05, 0.15);
      }

      // Factor in failure patterns
      if (insights.failurePatterns.length > 0) {
        inefficiencyScore += Math.min(insights.failurePatterns.length * 0.1, 0.25);
      }

      inefficiencyScore = Math.min(inefficiencyScore, 1.0);

      const result = {
        inefficiencyScore: parseFloat(inefficiencyScore.toFixed(2)),
        opportunities: opportunities,
        insights: insights,
        timestamp: Date.now()
      };

      // Notify MetaCognitiveLayer if inefficiency is significant
      if (inefficiencyScore >= 0.4) {
        EventBus?.emit('meta:inefficiency:detected', {
          source: 'ReflectionAnalyzer',
          score: inefficiencyScore,
          opportunities: opportunities.filter(o => o.confidence >= 0.7),
          timestamp: Date.now()
        });
        logger.warn(`[ReflectionAnalyzer] ⚠️  Inefficiency detected (score: ${inefficiencyScore})`);
      }

      return result;
    };

    // Analysis tracking for widget
    let analysisHistory = [];
    let analysisStats = {
      totalAnalyses: 0,
      totalOpportunities: 0,
      highInefficiencyCount: 0,
      lastInefficiencyScore: 0
    };

    // Wrap triggerMetaAnalysis to track stats
    const trackedTriggerMetaAnalysis = async () => {
      const result = await triggerMetaAnalysis();

      analysisStats.totalAnalyses++;
      analysisStats.totalOpportunities += result.opportunities.length;
      analysisStats.lastInefficiencyScore = result.inefficiencyScore;

      if (result.inefficiencyScore >= 0.4) {
        analysisStats.highInefficiencyCount++;
      }

      analysisHistory.push({
        timestamp: result.timestamp,
        inefficiencyScore: result.inefficiencyScore,
        opportunityCount: result.opportunities.length,
        failurePatternCount: result.insights.failurePatterns.length
      });

      if (analysisHistory.length > 50) {
        analysisHistory = analysisHistory.slice(-50);
      }

      return result;
    };

    // Widget interface for ModuleWidgetProtocol - Web Component
    const widget = (() => {
      class ReflectionAnalyzerWidget extends HTMLElement {
        constructor() {
          super();
          this.attachShadow({ mode: 'open' });
          this._api = null;
        }

        connectedCallback() {
          this.render();
        }

        disconnectedCallback() {
          // No cleanup needed for manual updates
        }

        set moduleApi(api) {
          this._api = api;
          this.render();
        }

        async getStatus() {
          const recentAnalysis = analysisHistory.length > 0
            ? analysisHistory[analysisHistory.length - 1]
            : null;

          const insights = await getLearningInsights();
          const totalInsights = insights.failurePatterns.length + insights.successStrategies.length;

          return {
            state: analysisStats.lastInefficiencyScore >= 0.4 ? 'warning' : 'idle',
            primaryMetric: `${totalInsights} insights`,
            secondaryMetric: `Score: ${(analysisStats.lastInefficiencyScore * 100).toFixed(0)}%`,
            lastActivity: recentAnalysis?.timestamp || null,
            message: analysisStats.lastInefficiencyScore >= 0.4 ? 'High inefficiency detected' : null
          };
        }

        async render() {
          const recentAnalyses = analysisHistory.slice(-10).reverse();
          const insights = await getLearningInsights();
          const opportunities = await detectMetaImprovementOpportunities();

          this.shadowRoot.innerHTML = `
            <style>
              :host {
                display: block;
                font-family: system-ui, -apple-system, sans-serif;
              }
              .reflection-analyzer-panel {
                padding: 15px;
                color: #e0e0e0;
              }
              .controls {
                margin-bottom: 15px;
                display: flex;
                gap: 10px;
              }
              button {
                padding: 8px 12px;
                border: 1px solid #555;
                background: rgba(255,255,255,0.05);
                color: #e0e0e0;
                border-radius: 4px;
                cursor: pointer;
                font-size: 13px;
                transition: all 0.2s;
              }
              button:hover {
                background: rgba(255,255,255,0.1);
                border-color: #0ff;
              }
              .analysis-summary {
                display: grid;
                grid-template-columns: 1fr 1fr 1fr;
                gap: 10px;
                margin-bottom: 20px;
              }
              .stat-card {
                padding: 10px;
                border-radius: 5px;
              }
              .stat-card > div:first-child {
                color: #888;
                font-size: 12px;
              }
              .stat-card > div:last-child {
                font-size: 24px;
                font-weight: bold;
              }
              .insights-section, .opportunities-section, .analysis-history {
                margin-bottom: 20px;
              }
              h4 {
                color: #0ff;
                margin: 0 0 10px 0;
                font-size: 14px;
              }
              .opportunity-list, .history-list {
                max-height: 200px;
                overflow-y: auto;
              }
              .pattern-item, .strategy-item, .opportunity-item, .history-item {
                padding: 8px;
                border-radius: 3px;
                margin-bottom: 6px;
              }
              .pattern-item {
                background: rgba(244,67,54,0.1);
                border-left: 3px solid #f44336;
              }
              .strategy-item {
                background: rgba(76,175,80,0.1);
                border-left: 3px solid #4caf50;
              }
              .opportunity-item {
                background: rgba(255,193,7,0.1);
                border-left: 3px solid #ffc107;
              }
              .empty-state {
                color: #888;
                padding: 20px;
                text-align: center;
              }
            </style>
            <div class="reflection-analyzer-panel">
              <div class="controls">
                <button class="run-analysis">⌕ Run Analysis</button>
                <button class="clear-history">⛶ Clear History</button>
              </div>

              <div class="analysis-summary">
                <div class="stat-card" style="background: rgba(0,255,255,0.1);">
                  <div>Total Analyses</div>
                  <div style="color: #0ff;">${analysisStats.totalAnalyses}</div>
                </div>
                <div class="stat-card" style="background: rgba(255,193,7,0.1);">
                  <div>Opportunities</div>
                  <div style="color: #ffc107;">${opportunities.length}</div>
                </div>
                <div class="stat-card" style="background: ${analysisStats.lastInefficiencyScore >= 0.4 ? 'rgba(244,67,54,0.1)' : 'rgba(76,175,80,0.1)'};">
                  <div>Inefficiency</div>
                  <div style="color: ${analysisStats.lastInefficiencyScore >= 0.4 ? '#f44336' : '#4caf50'};">
                    ${(analysisStats.lastInefficiencyScore * 100).toFixed(0)}%
                  </div>
                </div>
              </div>

              <div class="insights-section">
                <h4>Learning Insights</h4>
                ${insights.failurePatterns.length > 0 ? `
                  <div style="margin-bottom: 15px;">
                    <div style="font-weight: bold; margin-bottom: 8px; color: #f44336;">Failure Patterns (${insights.failurePatterns.length})</div>
                    ${insights.failurePatterns.slice(0, 3).map(pattern => `
                      <div class="pattern-item">
                        <div style="font-size: 13px; font-weight: bold;">${pattern.indicator}</div>
                        <div style="font-size: 11px; color: #888; margin-top: 2px;">
                          Count: ${pattern.count}
                        </div>
                      </div>
                    `).join('')}
                  </div>
                ` : ''}
                ${insights.successStrategies.length > 0 ? `
                  <div>
                    <div style="font-weight: bold; margin-bottom: 8px; color: #4caf50;">Success Strategies (${insights.successStrategies.length})</div>
                    ${insights.successStrategies.slice(0, 3).map(strategy => `
                      <div class="strategy-item">
                        <div style="font-size: 13px; font-weight: bold;">${strategy.strategy}</div>
                        <div style="font-size: 11px; color: #888; margin-top: 2px;">
                          Success: ${strategy.percentage}%
                        </div>
                      </div>
                    `).join('')}
                  </div>
                ` : ''}
                ${insights.failurePatterns.length === 0 && insights.successStrategies.length === 0 ? `
                  <div class="empty-state">No insights available. Run an analysis to generate insights.</div>
                ` : ''}
              </div>

              <div class="opportunities-section">
                <h4>Improvement Opportunities (${opportunities.length})</h4>
                <div class="opportunity-list">
                  ${opportunities.slice(0, 5).map(opp => `
                    <div class="opportunity-item">
                      <div style="font-weight: bold; font-size: 13px; margin-bottom: 4px;">${opp.suggestion}</div>
                      <div style="font-size: 11px; color: #888;">
                        Type: ${opp.type} · Confidence: ${(opp.confidence * 100).toFixed(0)}%
                      </div>
                    </div>
                  `).join('') || '<div class="empty-state">No opportunities detected</div>'}
                </div>
              </div>

              <div class="analysis-history">
                <h4>Recent Analyses (${recentAnalyses.length})</h4>
                <div class="history-list">
                  ${recentAnalyses.map(analysis => {
                    const time = new Date(analysis.timestamp).toLocaleTimeString();
                    const scoreColor = analysis.inefficiencyScore >= 0.4 ? '#f44336' : '#4caf50';

                    return `
                      <div class="history-item" style="background: rgba(255,255,255,0.03); border-left: 3px solid ${scoreColor};">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                          <div style="font-size: 12px;">${time}</div>
                          <div style="font-weight: bold; color: ${scoreColor};">
                            ${(analysis.inefficiencyScore * 100).toFixed(0)}%
                          </div>
                        </div>
                        <div style="font-size: 11px; color: #888; margin-top: 2px;">
                          ${analysis.opportunityCount} opportunities · ${analysis.failurePatternCount} failures
                        </div>
                      </div>
                    `;
                  }).join('') || '<div class="empty-state">No analyses yet</div>'}
                </div>
              </div>
            </div>
          `;

          // Attach event listeners
          this.shadowRoot.querySelector('.run-analysis')?.addEventListener('click', async () => {
            const result = await trackedTriggerMetaAnalysis();
            EventBus.emit('toast:info', {
              message: `Analysis complete: ${result.opportunities.length} opportunities found`
            });
            this.render();
          });

          this.shadowRoot.querySelector('.clear-history')?.addEventListener('click', () => {
            analysisHistory = [];
            EventBus.emit('toast:success', { message: 'Analysis history cleared' });
            this.render();
          });
        }
      }

      if (!customElements.get('reflection-analyzer-widget')) {
        customElements.define('reflection-analyzer-widget', ReflectionAnalyzerWidget);
      }

      return {
        element: 'reflection-analyzer-widget',
        displayName: 'Reflection Analyzer',
        icon: '☁',
        category: 'rsi',
        order: 50
      };
    })();

    return {
      init: async () => {
        logger.info('[ReflectionAnalyzer] Initialized');
        return true;
      },
      api: {
        clusterReflections,
        detectFailurePatterns,
        getTopSuccessStrategies,
        recommendSolution,
        getLearningInsights,
        detectMetaImprovementOpportunities,
        triggerMetaAnalysis: trackedTriggerMetaAnalysis
      },
      widget
    };
  }
};

// Export
export default ReflectionAnalyzer;
