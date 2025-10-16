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

    return {
      init,
      api: {
        generateInsights,
        captureSnapshot,
        compareSnapshots
      }
    };
  }
};

export default VisualSelfImprovement;
