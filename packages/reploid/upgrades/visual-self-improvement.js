// @blueprint 0x000019 - Visual RSI: Using 2D canvas visualization for pattern recognition and self-optimization.
// Visual Self-Improvement Engine
// Analyzes visualization data to surface RSI opportunities

const VisualSelfImprovement = {
  metadata: {
    id: 'VRSI',
    version: '1.0.0',
    dependencies: ['Utils', 'VDAT', 'PerformanceMonitor', 'ToolAnalytics'],
    async: false,
    type: 'analysis'
  },

  factory: (deps) => {
    const { Utils, VDAT, PerformanceMonitor, ToolAnalytics } = deps;
    const { logger } = Utils;

    const safeAsync = async (label, fn, fallback = null) => {
      try {
        return await fn();
      } catch (error) {
        logger.warn(`[VisualRSI] Failed to compute ${label}:`, error);
        return fallback;
      }
    };

    const computeCircularEdges = (edges = []) => {
      const edgeSet = new Set(edges.map((edge) => `${edge.source}->${edge.target}`));
      const circular = edges.filter((edge) =>
        edgeSet.has(`${edge.target}->${edge.source}`)
      );
      return Array.from(new Set(circular.map((edge) => edge.source))).sort();
    };

    const computeOrphanedNodes = (graph) => {
      if (!graph) return [];
      const used = new Set();
      (graph.edges || []).forEach(({ source, target }) => {
        used.add(source);
        used.add(target);
      });
      return (graph.nodes || [])
        .filter((node) => !used.has(node.id))
        .map((node) => node.id);
    };

    const analyzeDependencyGraph = async () => {
      const graph = await safeAsync('dependency graph', () => VDAT.getDependencyGraph(), null);
      if (!graph) {
        return {
          summary: 'No dependency information available',
          severity: 'info',
          recommendations: []
        };
      }

      const nodeCount = graph.nodes?.length || 0;
      const edgeCount = graph.edges?.length || 0;
      const circular = computeCircularEdges(graph.edges);
      const orphaned = computeOrphanedNodes(graph);

      const categoryCounts = (graph.nodes || []).reduce((acc, node) => {
        const category = node.category || 'unknown';
        acc[category] = (acc[category] || 0) + 1;
        return acc;
      }, {});

      const dominantCategory = Object.entries(categoryCounts)
        .sort((a, b) => b[1] - a[1])[0];

      const recommendations = [];
      if (circular.length) {
        recommendations.push(
          `Resolve circular dependencies between: ${circular.join(', ')}`
        );
      }
      if (orphaned.length) {
        recommendations.push(
          `Review orphaned modules (no connections): ${orphaned.join(', ')}`
        );
      }
      if (dominantCategory && dominantCategory[1] / Math.max(nodeCount, 1) > 0.6) {
        recommendations.push(
          `Category '${dominantCategory[0]}' dominates graph (${dominantCategory[1]} of ${nodeCount}); consider rebalancing responsibilities.`
        );
      }

      return {
        summary: `${nodeCount} nodes, ${edgeCount} edges`,
        severity: circular.length ? 'warning' : 'info',
        orphanedModules: orphaned,
        circularDependencies: circular,
        dominantCategory: dominantCategory ? dominantCategory[0] : null,
        recommendations
      };
    };

    const analyzeCognitiveFlow = async () => {
      const flow = await safeAsync('cognitive flow', () => VDAT.getCognitiveFlow(), null);
      const metrics = PerformanceMonitor?.getMetrics ? PerformanceMonitor.getMetrics() : null;

      if (!flow || !metrics) {
        return {
          summary: 'Insufficient cognitive flow data',
          severity: 'info',
          recommendations: []
        };
      }

      const stateMetrics = metrics.states || {};
      const dwellTimes = Object.entries(stateMetrics)
        .map(([state, data]) => ({
          state,
          totalTime: data.totalTime || 0,
          entries: data.entries || 0,
          average: data.entries ? Math.round(data.totalTime / data.entries) : 0
        }))
        .sort((a, b) => b.totalTime - a.totalTime);

      const bottleneck = dwellTimes[0];
      const activeStages = (flow.nodes || []).filter((node) => node.status === 'active');

      const recommendations = [];
      if (bottleneck && bottleneck.totalTime > 0) {
        recommendations.push(
          `Stage '${bottleneck.state}' dominates cycle time (${bottleneck.totalTime} ms); drill into this phase.`
        );
      }
      if (activeStages.length > 1) {
        recommendations.push(
          `Multiple active stages detected (${activeStages.map((n) => n.label || n.id).join(', ')}); verify concurrent execution is intentional.`
        );
      }

      return {
        summary: `Longest stage: ${bottleneck ? bottleneck.state : 'n/a'}`,
        severity: bottleneck && bottleneck.totalTime > 0 ? 'warning' : 'info',
        dwellTimes,
        activeStages: activeStages.map((stage) => stage.id),
        recommendations
      };
    };

    const analyzeMemoryHeatmap = async () => {
      const heatmapData = await safeAsync('memory heatmap', () => VDAT.getMemoryHeatmap(), null);
      if (!heatmapData) {
        return {
          summary: 'No memory heatmap data available',
          severity: 'info',
          recommendations: []
        };
      }

      const hotspots = (heatmapData.nodes || [])
        .sort((a, b) => (b.heat || 0) - (a.heat || 0))
        .slice(0, 5);

      const recommendations = [];
      if (hotspots.length && hotspots[0].heat > 20) {
        recommendations.push(
          `Artifact '${hotspots[0].label}' is a hotspot (${hotspots[0].heat} accesses); consider caching or refactoring.`
        );
      }

      return {
        summary: `Top hotspot: ${hotspots[0] ? hotspots[0].label : 'none'}`,
        severity: hotspots.length && hotspots[0].heat > 20 ? 'warning' : 'info',
        hotspots: hotspots.map((node) => ({
          id: node.id,
          label: node.label,
          heat: node.heat
        })),
        recommendations
      };
    };

    const analyzeGoalTree = async () => {
      const tree = await safeAsync('goal tree', () => VDAT.getGoalTree(), null);
      if (!tree) {
        return {
          summary: 'No goal hierarchy available',
          severity: 'info',
          recommendations: []
        };
      }

      const totalNodes = tree.nodes?.length || 0;
      const leafNodes = (tree.nodes || []).filter((node) =>
        !(tree.edges || []).some((edge) => edge.source === node.id)
      );

      const recommendations = [];
      if (leafNodes.length === 0) {
        recommendations.push('Goal tree lacks actionable leaf nodes; decompose goals further.');
      } else if (leafNodes.length / Math.max(totalNodes, 1) < 0.3) {
        recommendations.push('Goal hierarchy appears top-heavy; consider rebalancing tasks across subgoals.');
      }

      return {
        summary: `${leafNodes.length} actionable tasks`,
        severity: leafNodes.length ? 'info' : 'warning',
        leafCount: leafNodes.length,
        totalNodes,
        recommendations
      };
    };

    const analyzeToolUsage = async () => {
      const analytics = ToolAnalytics?.getAllAnalytics
        ? ToolAnalytics.getAllAnalytics()
        : null;

      if (!analytics || !analytics.tools) {
        return {
          summary: 'No tool analytics available',
          severity: 'info',
          recommendations: []
        };
      }

      const topTools = analytics.tools.slice(0, 5);
      const problematic = analytics.tools
        .filter((tool) => parseFloat(tool.errorRate) > 10)
        .map((tool) => tool.name);

      const recommendations = [];
      if (problematic.length) {
        recommendations.push(
          `Investigate high-error tools: ${problematic.join(', ')}`
        );
      }
      if (topTools.length && topTools[0].totalCalls > 0 && topTools[0].errorRate > 0) {
        recommendations.push(
          `Tool '${topTools[0].name}' is heavily used with ${topTools[0].errorRate}% error rate; prioritize hardening.`
        );
      }

      return {
        summary: `${topTools.length ? topTools[0].name : 'n/a'} is most used tool`,
        severity: problematic.length ? 'warning' : 'info',
        topTools,
        highErrorTools: problematic,
        recommendations
      };
    };

    const aggregateScore = (sections) => {
      const weights = {
        dependency: 0.25,
        flow: 0.25,
        memory: 0.2,
        goals: 0.15,
        tools: 0.15
      };

      const warnings = Object.values(sections).reduce(
        (acc, section) => acc + (section.severity === 'warning' ? 1 : 0),
        0
      );

      const recommendationCount = Object.values(sections).reduce(
        (acc, section) => acc + (section.recommendations?.length || 0),
        0
      );

      const baseScore = 100 - warnings * 15 - recommendationCount * 5;
      const finalScore = Math.max(0, Math.min(100, baseScore));

      return Math.round(finalScore);
    };

    const generateInsights = async () => {
      const [dependency, flow, memory, goals, tools] = await Promise.all([
        analyzeDependencyGraph(),
        analyzeCognitiveFlow(),
        analyzeMemoryHeatmap(),
        analyzeGoalTree(),
        analyzeToolUsage()
      ]);

      const sections = { dependency, flow, memory, goals, tools };
      const recommendations = [
        ...dependency.recommendations,
        ...flow.recommendations,
        ...memory.recommendations,
        ...goals.recommendations,
        ...tools.recommendations
      ].filter(Boolean);

      const metrics = PerformanceMonitor?.getMetrics
        ? PerformanceMonitor.getMetrics()
        : null;

      return {
        generatedAt: new Date().toISOString(),
        score: aggregateScore(sections),
        sections,
        performanceSnapshot: metrics
          ? {
              cycles: metrics.session?.cycles || 0,
              llmCalls: metrics.llm?.calls || 0,
              averageToolDuration:
                metrics.tools?.averageDuration || metrics.tools?.avgDuration || 0
            }
          : null,
        recommendations
      };
    };

    const captureSnapshot = async () => {
      const insights = await generateInsights();
      return {
        ...insights,
        snapshotId: `vsnap_${Date.now()}`,
        metadata: {
          capturedAt: insights.generatedAt,
          recommendationCount: insights.recommendations.length
        }
      };
    };

    const compareSnapshots = (previous, current) => {
      if (!previous || !current) {
        return {
          summary: 'Snapshots missing',
          deltas: [],
          scoreDelta: current?.score ?? 0
        };
      }

      const deltas = [];
      const scoreDelta = (current.score || 0) - (previous.score || 0);
      if (scoreDelta !== 0) {
        deltas.push({
          metric: 'overallScore',
          previous: previous.score,
          current: current.score,
          delta: scoreDelta
        });
      }

      const sections = ['dependency', 'flow', 'memory', 'goals', 'tools'];
      sections.forEach((section) => {
        const prev = previous.sections?.[section];
        const curr = current.sections?.[section];
        if (!prev || !curr) return;
        if (prev.recommendations?.length !== curr.recommendations?.length) {
          deltas.push({
            metric: `${section}.recommendations`,
            previous: prev.recommendations.length,
            current: curr.recommendations.length,
            delta: curr.recommendations.length - prev.recommendations.length
          });
        }
      });

      return {
        summary:
          scoreDelta === 0
            ? 'No net improvement detected yet'
            : scoreDelta > 0
            ? `Visual RSI improving (+${scoreDelta})`
            : `Visual RSI regressed (${scoreDelta})`,
        scoreDelta,
        deltas
      };
    };

    const init = async () => {
      logger.info('[VisualRSI] Visual self-improvement analytics ready');
      return true;
    };

    // Visual RSI statistics for widget
    const vrsiStats = {
      insightsGenerated: 0,
      snapshotsCaptured: 0,
      comparisonsRun: 0,
      totalRecommendations: 0,
      lastScore: null,
      scoreHistory: [],
      lastInsight: null,
      lastActivity: null
    };

    // Wrap generateInsights to track stats
    const wrappedGenerateInsights = async () => {
      const insights = await generateInsights();

      vrsiStats.insightsGenerated++;
      vrsiStats.totalRecommendations += insights.recommendations.length;
      vrsiStats.lastScore = insights.score;
      vrsiStats.lastInsight = {
        timestamp: Date.now(),
        score: insights.score,
        recommendationCount: insights.recommendations.length,
        sections: Object.keys(insights.sections).map(key => ({
          name: key,
          severity: insights.sections[key].severity,
          recommendationCount: insights.sections[key].recommendations?.length || 0
        }))
      };
      vrsiStats.lastActivity = Date.now();

      // Track score history
      vrsiStats.scoreHistory.push({
        timestamp: Date.now(),
        score: insights.score
      });
      if (vrsiStats.scoreHistory.length > 20) {
        vrsiStats.scoreHistory = vrsiStats.scoreHistory.slice(-20);
      }

      return insights;
    };

    // Wrap captureSnapshot to track stats
    const wrappedCaptureSnapshot = async () => {
      const snapshot = await captureSnapshot();

      vrsiStats.snapshotsCaptured++;
      vrsiStats.lastActivity = Date.now();

      return snapshot;
    };

    // Wrap compareSnapshots to track stats
    const wrappedCompareSnapshots = (previous, current) => {
      const comparison = compareSnapshots(previous, current);

      vrsiStats.comparisonsRun++;
      vrsiStats.lastActivity = Date.now();

      return comparison;
    };

    return {
      init,
      api: {
        generateInsights: wrappedGenerateInsights,
        captureSnapshot: wrappedCaptureSnapshot,
        compareSnapshots: wrappedCompareSnapshots
      },

      widget: (() => {
        class VisualSelfImprovementWidget extends HTMLElement {
          constructor() {
            super();
            this.attachShadow({ mode: 'open' });
          }

          connectedCallback() {
            this.render();
          }

          disconnectedCallback() {
            // No interval to clean up
          }

          set moduleApi(api) {
            this._api = api;
            this.render();
          }

          getStatus() {
            const hasRecentActivity = vrsiStats.lastActivity &&
              (Date.now() - vrsiStats.lastActivity < 60000);

            return {
              state: hasRecentActivity ? 'active' : (vrsiStats.insightsGenerated > 0 ? 'idle' : 'disabled'),
              primaryMetric: vrsiStats.lastScore !== null ? `${vrsiStats.lastScore}/100` : 'No insights',
              secondaryMetric: vrsiStats.totalRecommendations > 0
                ? `${vrsiStats.totalRecommendations} recommendations`
                : 'Ready',
              lastActivity: vrsiStats.lastActivity,
              message: hasRecentActivity ? 'Analyzing' : null
            };
          }

          render() {
            const scoreColor = vrsiStats.lastScore !== null
              ? (vrsiStats.lastScore >= 80 ? '#0f0' : vrsiStats.lastScore >= 60 ? '#ff0' : '#f00')
              : '#888';

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
                h3 { margin: 0 0 16px 0; font-size: 1.4em; color: #fff; font-family: sans-serif; }
                h4 { margin: 16px 0 8px 0; font-size: 1.1em; color: #0ff; }
                .controls { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
                button {
                  padding: 6px 12px;
                  background: rgba(100,150,255,0.2);
                  border: 1px solid rgba(100,150,255,0.4);
                  border-radius: 4px;
                  color: #fff;
                  cursor: pointer;
                  font-size: 0.9em;
                }
                button:hover { background: rgba(100,150,255,0.3); }
                .score-display {
                  margin-bottom: 12px;
                  padding: 12px;
                  background: rgba(0,0,0,0.3);
                  border: 2px solid ${scoreColor};
                  border-radius: 6px;
                  text-align: center;
                }
                .score-label { color: #888; font-size: 11px; margin-bottom: 4px; }
                .score-value { color: ${scoreColor}; font-size: 36px; font-weight: bold; }
                .stat-row { color: #e0e0e0; margin-bottom: 4px; }
                .stat-value { color: #0ff; }
                .stat-value.warn { color: #ff0; }
                .insight-box {
                  margin-bottom: 12px;
                  padding: 8px;
                  background: rgba(0,255,255,0.05);
                  border: 1px solid rgba(0,255,255,0.2);
                  border-radius: 4px;
                }
                .section-item {
                  padding: 3px 0;
                  border-bottom: 1px solid rgba(255,255,255,0.1);
                }
                .trend { margin-bottom: 6px; }
                .trend.up { color: #0f0; }
                .trend.down { color: #f00; }
                .trend.neutral { color: #888; }
                .chart { display: flex; align-items: flex-end; gap: 2px; height: 40px; }
                .chart-bar { flex: 1; opacity: 0.7; }
                .analysis-areas {
                  margin-top: 12px;
                  padding: 8px;
                  background: rgba(0,0,0,0.3);
                  border: 1px solid rgba(255,255,255,0.1);
                  border-radius: 4px;
                }
                .area-item { color: #666; font-size: 10px; }
                .empty-state { color: #888; text-align: center; margin-top: 20px; }
              </style>

              <div class="vrsi-panel">
                <h3>⛉ Visual Self-Improvement</h3>

                <div class="controls">
                  <button class="generate-insights">⌕ Generate Insights</button>
                  <button class="capture-snapshot">☐ Capture Snapshot</button>
                  <button class="show-details">☱ Show Details</button>
                </div>

                ${vrsiStats.lastScore !== null ? `
                  <div class="score-display">
                    <div class="score-label">CURRENT SCORE</div>
                    <div class="score-value">${vrsiStats.lastScore}/100</div>
                  </div>
                ` : ''}

                <h4>Activity Summary</h4>
                <div class="stat-row">Insights Generated: <span class="stat-value">${vrsiStats.insightsGenerated}</span></div>
                <div class="stat-row">Snapshots Captured: <span class="stat-value">${vrsiStats.snapshotsCaptured}</span></div>
                <div class="stat-row">Comparisons: <span class="stat-value">${vrsiStats.comparisonsRun}</span></div>
                <div class="stat-row">Total Recommendations: <span class="stat-value warn">${vrsiStats.totalRecommendations}</span></div>

                ${vrsiStats.lastInsight ? `
                  <div class="insight-box">
                    <h4 style="margin: 0 0 4px 0;">Last Insight Sections</h4>
                    ${vrsiStats.lastInsight.sections.map(section => {
                      const icon = section.severity === 'warning' ? '⚠️' : 'ℹ️';
                      const color = section.severity === 'warning' ? '#ff0' : '#888';
                      return `
                        <div class="section-item">
                          <span style="color: ${color};">${icon}</span>
                          <span style="color: #fff; font-size: 11px;">${section.name}</span>
                          ${section.recommendationCount > 0 ? `<span style="color: #ff0; font-size: 10px;"> (${section.recommendationCount} recs)</span>` : ''}
                        </div>
                      `;
                    }).join('')}
                    <div style="color: #888; font-size: 10px; margin-top: 4px;">${new Date(vrsiStats.lastInsight.timestamp).toLocaleString()}</div>
                  </div>
                ` : ''}

                ${vrsiStats.scoreHistory.length > 1 ? (() => {
                  const recent = vrsiStats.scoreHistory.slice(-5);
                  const delta = recent[recent.length - 1].score - recent[0].score;
                  const icon = delta > 0 ? '⤊' : delta < 0 ? '⤋' : '➡️';
                  const trendClass = delta > 0 ? 'up' : delta < 0 ? 'down' : 'neutral';

                  return `
                    <h4>Score Trend</h4>
                    <div class="trend ${trendClass}">${icon} ${delta > 0 ? '+' : ''}${delta} over last ${recent.length} insights</div>
                    <div class="chart">
                      ${recent.map(item => {
                        const height = (item.score / 100) * 40;
                        const color = item.score >= 80 ? '#0f0' : item.score >= 60 ? '#ff0' : '#f00';
                        return `<div class="chart-bar" style="background: ${color}; height: ${height}px;" title="${item.score}"></div>`;
                      }).join('')}
                    </div>
                  `;
                })() : ''}

                ${vrsiStats.lastInsight ? `
                  <div class="analysis-areas">
                    <div style="color: #888; font-weight: bold; margin-bottom: 4px; font-size: 10px;">Analysis Areas</div>
                    <div class="area-item">• Dependency Graph</div>
                    <div class="area-item">• Cognitive Flow</div>
                    <div class="area-item">• Memory Heatmap</div>
                    <div class="area-item">• Goal Tree</div>
                    <div class="area-item">• Tool Usage</div>
                  </div>
                ` : ''}

                ${vrsiStats.insightsGenerated === 0 ? '<div class="empty-state">No insights generated yet</div>' : ''}
              </div>
            `;

            // Attach event listeners
            this.shadowRoot.querySelector('.generate-insights')?.addEventListener('click', async () => {
              try {
                const insights = await wrappedGenerateInsights();
                logger.info('[Widget] Insights generated:', insights);
                this.render();
              } catch (error) {
                logger.error('[Widget] Generate insights failed:', error);
              }
            });

            this.shadowRoot.querySelector('.capture-snapshot')?.addEventListener('click', async () => {
              try {
                const snapshot = await wrappedCaptureSnapshot();
                logger.info('[Widget] Snapshot captured:', snapshot.snapshotId);
                this.render();
              } catch (error) {
                logger.error('[Widget] Capture snapshot failed:', error);
              }
            });

            this.shadowRoot.querySelector('.show-details')?.addEventListener('click', () => {
              if (vrsiStats.lastInsight) {
                console.log('Last VRSI Insight:', vrsiStats.lastInsight);
                console.table(vrsiStats.lastInsight.sections);
              }
            });
          }
        }

        if (!customElements.get('visual-self-improvement-widget')) {
          customElements.define('visual-self-improvement-widget', VisualSelfImprovementWidget);
        }

        return {
          element: 'visual-self-improvement-widget',
          displayName: 'Visual Self-Improvement',
          icon: '⛉',
          category: 'rsi',
          order: 90
        };
      })()
    };
  }
};

export default VisualSelfImprovement;
