// Visualization Data Adapter for REPLOID
// Transforms internal agent state into visualizable data structures

const VizDataAdapter = {
  metadata: {
    id: 'VDAT',
    version: '1.0.0',
    dependencies: ['logger', 'Utils', 'StateManager', 'Storage'],
    async: true,
    type: 'visualization'
  },

  factory: (deps) => {
    const { logger, Utils, StateManager, Storage } = deps;
    
    if (!logger || !Utils || !StateManager || !Storage) {
      throw new Error('VizDataAdapter: Missing required dependencies');
    }

    // Cache for computed visualization data
    const cache = {
      dependencyGraph: null,
      cognitiveFlow: null,
      memoryHeatmap: null,
      goalTree: null,
      toolUsage: null,
      lastUpdate: 0
    };

    const CACHE_TTL = 1000; // 1 second cache

    // Get module dependency graph
    const getDependencyGraph = async () => {
      if (cache.dependencyGraph && Date.now() - cache.lastUpdate < CACHE_TTL) {
        return cache.dependencyGraph;
      }

      const nodes = [];
      const edges = [];
      const processedModules = new Set();

      // Get module manifest if available
      const manifestContent = await Storage.getArtifactContent('/modules/module-manifest.json');
      let manifest = {};
      
      try {
        manifest = manifestContent ? JSON.parse(manifestContent) : {};
      } catch (e) {
        logger.logEvent('warn', 'Failed to parse module manifest');
      }

      // Get all modules from storage
      const metadata = await Storage.getAllArtifactMetadata();
      
      // Process each module
      for (const [path, meta] of Object.entries(metadata)) {
        if (path.startsWith('/modules/') && path.endsWith('.js')) {
          const moduleId = path.replace('/modules/', '').replace('.js', '').toUpperCase();
          
          if (!processedModules.has(moduleId)) {
            processedModules.add(moduleId);
            
            // Determine category based on path or metadata
            let category = 'core';
            if (moduleId.includes('TOOL') || moduleId.includes('TL')) category = 'tool';
            else if (moduleId.includes('UI')) category = 'ui';
            else if (moduleId.includes('AGENT') || moduleId.includes('AG') || moduleId.includes('CYCL')) category = 'agent';
            else if (moduleId.includes('STOR') || moduleId.includes('IDB')) category = 'storage';
            else if (meta.experimental) category = 'experimental';

            nodes.push({
              id: moduleId,
              label: moduleId.substring(0, 4),
              category,
              x: Math.random() * 400,
              y: Math.random() * 300,
              radius: 15,
              status: meta.loaded ? 'active' : 'idle'
            });

            // Add dependencies as edges
            const moduleInfo = manifest[moduleId];
            if (moduleInfo && moduleInfo.dependencies) {
              moduleInfo.dependencies.forEach(dep => {
                const depId = dep.toUpperCase();
                edges.push({
                  source: moduleId,
                  target: depId,
                  type: 'dependency'
                });
              });
            }
          }
        }
      }

      cache.dependencyGraph = { nodes, edges };
      cache.lastUpdate = Date.now();
      return cache.dependencyGraph;
    };

    // Get cognitive cycle flow visualization
    const getCognitiveFlow = async () => {
      if (cache.cognitiveFlow && Date.now() - cache.lastUpdate < CACHE_TTL) {
        return cache.cognitiveFlow;
      }

      const state = StateManager.getState();
      const nodes = [];
      const edges = [];

      // Core cognitive cycle stages
      const stages = [
        { id: 'OBSERVE', label: 'Observe', level: 0, category: 'agent' },
        { id: 'ORIENT', label: 'Orient', level: 1, category: 'agent' },
        { id: 'DECIDE', label: 'Decide', level: 2, category: 'agent' },
        { id: 'ACT', label: 'Act', level: 3, category: 'agent' }
      ];

      stages.forEach((stage, i) => {
        nodes.push({
          ...stage,
          x: 100 + (i * 80),
          y: 50 + (i * 60),
          radius: 20,
          status: state.currentStage === stage.id ? 'active' : 'idle'
        });

        if (i < stages.length - 1) {
          edges.push({
            source: stage.id,
            target: stages[i + 1].id,
            type: 'flow',
            active: state.currentStage === stage.id
          });
        }
      });

      // Add feedback loop
      edges.push({
        source: 'ACT',
        target: 'OBSERVE',
        type: 'feedback',
        curved: true
      });

      // Add tool execution nodes
      if (state.recentTools) {
        state.recentTools.forEach((tool, i) => {
          const toolNode = {
            id: `TOOL_${tool}`,
            label: tool,
            category: 'tool',
            level: 4,
            x: 350,
            y: 100 + (i * 30),
            radius: 10
          };
          nodes.push(toolNode);
          edges.push({
            source: 'ACT',
            target: toolNode.id,
            type: 'execution'
          });
        });
      }

      cache.cognitiveFlow = { nodes, edges };
      return cache.cognitiveFlow;
    };

    // Get memory access heatmap
    const getMemoryHeatmap = async () => {
      if (cache.memoryHeatmap && Date.now() - cache.lastUpdate < CACHE_TTL) {
        return cache.memoryHeatmap;
      }

      const heatmap = new Map();
      const nodes = [];
      const metadata = await Storage.getAllArtifactMetadata();
      
      // Create grid of memory cells
      const gridSize = 20;
      const cols = Math.floor(400 / gridSize);
      const rows = Math.floor(300 / gridSize);
      
      let i = 0;
      for (const [path, meta] of Object.entries(metadata)) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        
        if (row >= rows) break;
        
        // Calculate access frequency (mock data, could be real metrics)
        const accessCount = meta.accessCount || Math.floor(Math.random() * 100);
        heatmap.set(`${col},${row}`, accessCount);
        
        nodes.push({
          id: path,
          label: path.split('/').pop().substring(0, 8),
          x: col * gridSize + gridSize/2,
          y: row * gridSize + gridSize/2,
          radius: gridSize/3,
          heat: accessCount,
          category: 'storage'
        });
        
        i++;
      }

      cache.memoryHeatmap = { heatmap, nodes };
      return cache.memoryHeatmap;
    };

    // Get goal hierarchy tree
    const getGoalTree = async () => {
      if (cache.goalTree && Date.now() - cache.lastUpdate < CACHE_TTL) {
        return cache.goalTree;
      }

      const state = StateManager.getState();
      const nodes = [];
      const edges = [];

      // Root goal
      const rootGoal = {
        id: 'ROOT_GOAL',
        label: state.currentGoal || 'No Goal',
        isRoot: true,
        category: 'agent',
        x: 200,
        y: 30,
        radius: 20,
        status: 'active'
      };
      nodes.push(rootGoal);

      // Sub-goals (mock data structure - could be enhanced with real goal decomposition)
      const subGoals = [
        { id: 'ANALYZE', label: 'Analyze', parent: 'ROOT_GOAL' },
        { id: 'PLAN', label: 'Plan', parent: 'ROOT_GOAL' },
        { id: 'EXECUTE', label: 'Execute', parent: 'ROOT_GOAL' }
      ];

      subGoals.forEach((goal, i) => {
        nodes.push({
          ...goal,
          category: 'agent',
          x: 80 + (i * 120),
          y: 100,
          radius: 15,
          status: 'idle'
        });
        
        edges.push({
          source: goal.parent,
          target: goal.id,
          type: 'hierarchy'
        });
      });

      // Add task nodes under each subgoal
      const tasks = {
        'ANALYZE': ['Read files', 'Parse code', 'Find patterns'],
        'PLAN': ['Design solution', 'Validate approach', 'Estimate resources'],
        'EXECUTE': ['Write code', 'Run tests', 'Deploy']
      };

      Object.entries(tasks).forEach(([parent, taskList]) => {
        taskList.forEach((task, i) => {
          const taskId = `${parent}_${i}`;
          const parentNode = nodes.find(n => n.id === parent);
          
          nodes.push({
            id: taskId,
            label: task,
            parent,
            category: 'tool',
            x: parentNode.x - 30 + (i * 30),
            y: 170,
            radius: 8,
            status: 'pending'
          });
          
          edges.push({
            source: parent,
            target: taskId,
            type: 'subtask'
          });
        });
      });

      cache.goalTree = { nodes, edges };
      return cache.goalTree;
    };

    // Get tool usage graph
    const getToolUsage = async () => {
      if (cache.toolUsage && Date.now() - cache.lastUpdate < CACHE_TTL) {
        return cache.toolUsage;
      }

      const nodes = [];
      const edges = [];
      const state = StateManager.getState();
      
      // Get tool definitions
      const toolsReadContent = await Storage.getArtifactContent('/modules/tools-read.json');
      const toolsWriteContent = await Storage.getArtifactContent('/modules/tools-write.json');
      
      let readTools = [];
      let writeTools = [];
      
      try {
        readTools = toolsReadContent ? JSON.parse(toolsReadContent) : [];
        writeTools = toolsWriteContent ? JSON.parse(toolsWriteContent) : [];
      } catch (e) {
        logger.logEvent('warn', 'Failed to parse tool definitions');
      }

      // Add tool nodes
      [...readTools, ...writeTools].forEach((tool, i) => {
        const isWrite = writeTools.includes(tool);
        nodes.push({
          id: tool.name || `TOOL_${i}`,
          label: tool.name || `Tool ${i}`,
          category: 'tool',
          x: Math.random() * 350 + 25,
          y: Math.random() * 250 + 25,
          radius: 12,
          color: isWrite ? '#f00' : '#0f0',
          usageCount: Math.floor(Math.random() * 50), // Mock usage count
          status: 'idle'
        });
      });

      // Add relationships between tools that are commonly used together
      // This is mock data - could be replaced with real usage patterns
      for (let i = 0; i < nodes.length - 1; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          if (Math.random() > 0.7) {
            edges.push({
              source: nodes[i].id,
              target: nodes[j].id,
              type: 'correlation',
              weight: Math.random(),
              directed: false
            });
          }
        }
      }

      cache.toolUsage = { nodes, edges };
      return cache.toolUsage;
    };

    // Track activity for real-time visualization updates
    const trackActivity = (type, data) => {
      logger.logEvent('debug', `Tracking activity: ${type}`, data);
      
      // Invalidate relevant caches
      switch (type) {
        case 'module_loaded':
        case 'dependency_resolved':
          cache.dependencyGraph = null;
          break;
          
        case 'cycle_started':
        case 'cycle_completed':
        case 'stage_changed':
          cache.cognitiveFlow = null;
          break;
          
        case 'artifact_accessed':
        case 'artifact_written':
          cache.memoryHeatmap = null;
          break;
          
        case 'goal_updated':
        case 'subgoal_created':
          cache.goalTree = null;
          break;
          
        case 'tool_executed':
          cache.toolUsage = null;
          cache.cognitiveFlow = null;
          break;
      }
    };

    // Get metrics for performance visualization
    const getPerformanceMetrics = async () => {
      const state = StateManager.getState();
      
      return {
        cycles: state.totalCycles || 0,
        apiCalls: state.apiCallCount || 0,
        tokensUsed: state.totalTokens || 0,
        artifactsCreated: Object.keys(await Storage.getAllArtifactMetadata()).length,
        successRate: state.successfulCycles / (state.totalCycles || 1),
        avgCycleTime: state.avgCycleTime || 0,
        memoryUsage: state.memoryUsage || 0
      };
    };

    // Get RSI-specific visualization data
    const getRSIActivity = async () => {
      const modifications = [];
      const improvements = [];
      
      // Track self-modifications
      const metadata = await Storage.getAllArtifactMetadata();
      for (const [path, meta] of Object.entries(metadata)) {
        if (path.startsWith('/modules/') && meta.modifiedBy === 'SELF') {
          modifications.push({
            path,
            timestamp: meta.modified,
            type: 'self-modification',
            impact: meta.impact || 'unknown'
          });
        }
      }

      // Track improvements
      const state = StateManager.getState();
      if (state.improvements) {
        state.improvements.forEach(imp => {
          improvements.push({
            id: imp.id,
            description: imp.description,
            metric: imp.metric,
            before: imp.before,
            after: imp.after,
            improvement: ((imp.after - imp.before) / imp.before * 100).toFixed(2) + '%'
          });
        });
      }

      return {
        modifications,
        improvements,
        rsiScore: calculateRSIScore(modifications, improvements)
      };
    };

    const calculateRSIScore = (modifications, improvements) => {
      // Simple RSI score calculation
      const modScore = modifications.length * 10;
      const impScore = improvements.reduce((acc, imp) => {
        const improvement = parseFloat(imp.improvement);
        return acc + (improvement > 0 ? improvement : 0);
      }, 0);
      
      return Math.min(100, modScore + impScore);
    };

    // Initialize and return public interface
    const init = async () => {
      logger.logEvent('info', 'VizDataAdapter initialized');
      
      return {
        getDependencyGraph,
        getCognitiveFlow,
        getMemoryHeatmap,
        getGoalTree,
        getToolUsage,
        getPerformanceMetrics,
        getRSIActivity,
        trackActivity
      };
    };

    return { init };
  }
};

// Module export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VizDataAdapter;
}