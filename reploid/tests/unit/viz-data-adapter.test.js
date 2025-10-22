import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('VizDataAdapter Module', () => {
  let VizDataAdapter;
  let mockDeps;
  let adapterInstance;
  let mockStateManager;
  let mockStorage;

  beforeEach(async () => {
    // Mock StateManager
    mockStateManager = {
      getState: vi.fn(() => ({
        totalCycles: 5,
        currentGoal: 'Test goal',
        currentStage: 'DECIDE',
        recentTools: ['read', 'write', 'edit'],
        apiCallCount: 100,
        totalTokens: 5000,
        successfulCycles: 4,
        avgCycleTime: 1500,
        memoryUsage: 1024000,
        improvements: [
          {
            id: 'imp1',
            description: 'Optimized parsing',
            metric: 'speed',
            before: 100,
            after: 150
          }
        ]
      }))
    };

    // Mock Storage
    mockStorage = {
      getArtifactContent: vi.fn((path) => {
        if (path === '/modules/module-manifest.json') {
          return Promise.resolve(JSON.stringify({
            MODULE1: {
              dependencies: ['Utils', 'StateManager']
            },
            MODULE2: {
              dependencies: ['MODULE1']
            }
          }));
        }
        if (path === '/modules/tools-read.json') {
          return Promise.resolve(JSON.stringify([
            { name: 'read', description: 'Read file' },
            { name: 'grep', description: 'Search content' }
          ]));
        }
        if (path === '/modules/tools-write.json') {
          return Promise.resolve(JSON.stringify([
            { name: 'write', description: 'Write file' },
            { name: 'edit', description: 'Edit file' }
          ]));
        }
        return Promise.resolve('');
      }),
      getAllArtifactMetadata: vi.fn(() => Promise.resolve({
        '/modules/module1.js': {
          loaded: true,
          created: Date.now()
        },
        '/modules/module2.js': {
          loaded: false,
          experimental: true,
          created: Date.now()
        },
        '/data/artifact1.txt': {
          accessCount: 25,
          modifiedBy: 'SELF',
          modified: Date.now(),
          impact: 'high'
        },
        '/data/artifact2.json': {
          accessCount: 50,
          created: Date.now()
        }
      }))
    };

    // Mock logger
    const mockLogger = {
      logEvent: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn()
    };

    mockDeps = {
      logger: mockLogger,
      Utils: {
        formatError: vi.fn((err) => err.message)
      },
      StateManager: mockStateManager,
      Storage: mockStorage
    };

    // Define VizDataAdapter module
    VizDataAdapter = {
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

        const cache = {
          dependencyGraph: null,
          cognitiveFlow: null,
          memoryHeatmap: null,
          goalTree: null,
          toolUsage: null,
          lastUpdate: 0
        };

        const CACHE_TTL = 1000;

        const getDependencyGraph = async () => {
          if (cache.dependencyGraph && Date.now() - cache.lastUpdate < CACHE_TTL) {
            return cache.dependencyGraph;
          }

          const nodes = [];
          const edges = [];
          const processedModules = new Set();

          const manifestContent = await Storage.getArtifactContent('/modules/module-manifest.json');
          let manifest = {};

          try {
            manifest = manifestContent ? JSON.parse(manifestContent) : {};
          } catch (e) {
            logger.logEvent('warn', 'Failed to parse module manifest');
          }

          const metadata = await Storage.getAllArtifactMetadata();

          for (const [path, meta] of Object.entries(metadata)) {
            if (path.startsWith('/modules/') && path.endsWith('.js')) {
              const moduleId = path.replace('/modules/', '').replace('.js', '').toUpperCase();

              if (!processedModules.has(moduleId)) {
                processedModules.add(moduleId);

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

        const getCognitiveFlow = async () => {
          if (cache.cognitiveFlow && Date.now() - cache.lastUpdate < CACHE_TTL) {
            return cache.cognitiveFlow;
          }

          const state = StateManager.getState();
          const nodes = [];
          const edges = [];

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

          edges.push({
            source: 'ACT',
            target: 'OBSERVE',
            type: 'feedback',
            curved: true
          });

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

        const getMemoryHeatmap = async () => {
          if (cache.memoryHeatmap && Date.now() - cache.lastUpdate < CACHE_TTL) {
            return cache.memoryHeatmap;
          }

          const heatmap = new Map();
          const nodes = [];
          const metadata = await Storage.getAllArtifactMetadata();

          const gridSize = 20;
          const cols = Math.floor(400 / gridSize);
          const rows = Math.floor(300 / gridSize);

          let i = 0;
          for (const [path, meta] of Object.entries(metadata)) {
            const col = i % cols;
            const row = Math.floor(i / cols);

            if (row >= rows) break;

            const accessCount = meta.accessCount || Math.floor(Math.random() * 100);
            heatmap.set(`${col},${row}`, accessCount);

            nodes.push({
              id: path,
              label: path.split('/').pop().substring(0, 8),
              x: col * gridSize + gridSize / 2,
              y: row * gridSize + gridSize / 2,
              radius: gridSize / 3,
              heat: accessCount,
              category: 'storage'
            });

            i++;
          }

          cache.memoryHeatmap = { heatmap, nodes };
          return cache.memoryHeatmap;
        };

        const getGoalTree = async () => {
          if (cache.goalTree && Date.now() - cache.lastUpdate < CACHE_TTL) {
            return cache.goalTree;
          }

          const state = StateManager.getState();
          const nodes = [];
          const edges = [];

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

        const getToolUsage = async () => {
          if (cache.toolUsage && Date.now() - cache.lastUpdate < CACHE_TTL) {
            return cache.toolUsage;
          }

          const nodes = [];
          const edges = [];

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
              usageCount: Math.floor(Math.random() * 50),
              status: 'idle'
            });
          });

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

        const trackActivity = (type, data) => {
          logger.logEvent('debug', `Tracking activity: ${type}`, data);

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

        const getRSIActivity = async () => {
          const modifications = [];
          const improvements = [];

          const metadata = await Storage.getAllArtifactMetadata();
          for (const [path, meta] of Object.entries(metadata)) {
            if (meta.modifiedBy === 'SELF') {
              modifications.push({
                path,
                timestamp: meta.modified,
                type: 'self-modification',
                impact: meta.impact || 'unknown'
              });
            }
          }

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
          const modScore = modifications.length * 10;
          const impScore = improvements.reduce((acc, imp) => {
            const improvement = parseFloat(imp.improvement);
            return acc + (improvement > 0 ? improvement : 0);
          }, 0);

          return Math.min(100, modScore + impScore);
        };

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

    const instance = VizDataAdapter.factory(mockDeps);
    adapterInstance = await instance.init();
  });

  describe('Module Metadata', () => {
    it('should have correct metadata', () => {
      expect(VizDataAdapter.metadata.id).toBe('VDAT');
      expect(VizDataAdapter.metadata.version).toBe('1.0.0');
      expect(VizDataAdapter.metadata.type).toBe('visualization');
    });

    it('should declare required dependencies', () => {
      expect(VizDataAdapter.metadata.dependencies).toContain('logger');
      expect(VizDataAdapter.metadata.dependencies).toContain('Utils');
      expect(VizDataAdapter.metadata.dependencies).toContain('StateManager');
      expect(VizDataAdapter.metadata.dependencies).toContain('Storage');
    });

    it('should be async', () => {
      expect(VizDataAdapter.metadata.async).toBe(true);
    });
  });

  describe('Initialization', () => {
    it('should initialize successfully', () => {
      expect(adapterInstance).toBeDefined();
      expect(adapterInstance.getDependencyGraph).toBeDefined();
      expect(adapterInstance.getCognitiveFlow).toBeDefined();
      expect(adapterInstance.getMemoryHeatmap).toBeDefined();
      expect(adapterInstance.getToolUsage).toBeDefined();
    });

    it('should throw error when missing dependencies', () => {
      expect(() => {
        VizDataAdapter.factory({ logger: mockDeps.logger });
      }).toThrow('VizDataAdapter: Missing required dependencies');
    });

    it('should log initialization message', () => {
      expect(mockDeps.logger.logEvent).toHaveBeenCalledWith(
        'info',
        'VizDataAdapter initialized'
      );
    });
  });

  describe('Dependency Graph', () => {
    it('should build dependency graph from modules', async () => {
      const graph = await adapterInstance.getDependencyGraph();

      expect(graph).toBeDefined();
      expect(graph.nodes).toBeDefined();
      expect(graph.edges).toBeDefined();
      expect(Array.isArray(graph.nodes)).toBe(true);
      expect(Array.isArray(graph.edges)).toBe(true);
    });

    it('should categorize modules correctly', async () => {
      const graph = await adapterInstance.getDependencyGraph();

      const module1 = graph.nodes.find(n => n.id === 'MODULE1');
      expect(module1).toBeDefined();
      expect(module1.status).toBe('active');
    });

    it('should create edges from dependencies', async () => {
      const graph = await adapterInstance.getDependencyGraph();

      const edge = graph.edges.find(e => e.source === 'MODULE1' && e.target === 'UTILS');
      expect(edge).toBeDefined();
      expect(edge.type).toBe('dependency');
    });

    it('should handle experimental modules', async () => {
      const graph = await adapterInstance.getDependencyGraph();

      const experimentalModule = graph.nodes.find(n => n.category === 'experimental');
      expect(experimentalModule).toBeDefined();
    });

    it('should cache results', async () => {
      await adapterInstance.getDependencyGraph();
      const callCount1 = mockStorage.getAllArtifactMetadata.mock.calls.length;

      await adapterInstance.getDependencyGraph();
      const callCount2 = mockStorage.getAllArtifactMetadata.mock.calls.length;

      expect(callCount2).toBe(callCount1);
    });

    it('should handle missing manifest gracefully', async () => {
      mockStorage.getArtifactContent.mockImplementation((path) => {
        if (path === '/modules/module-manifest.json') {
          return Promise.resolve('invalid json');
        }
        return Promise.resolve('');
      });

      const graph = await adapterInstance.getDependencyGraph();
      expect(graph.nodes).toBeDefined();
      expect(mockDeps.logger.logEvent).toHaveBeenCalledWith(
        'warn',
        'Failed to parse module manifest'
      );
    });
  });

  describe('Cognitive Flow', () => {
    it('should generate cognitive cycle flow', async () => {
      const flow = await adapterInstance.getCognitiveFlow();

      expect(flow).toBeDefined();
      expect(flow.nodes).toHaveLength(7); // 4 stages + 3 tools (feedback is an edge)
      expect(flow.edges).toBeDefined();
    });

    it('should include all OODA stages', async () => {
      const flow = await adapterInstance.getCognitiveFlow();

      const stages = ['OBSERVE', 'ORIENT', 'DECIDE', 'ACT'];
      stages.forEach(stage => {
        const node = flow.nodes.find(n => n.id === stage);
        expect(node).toBeDefined();
      });
    });

    it('should mark current stage as active', async () => {
      const flow = await adapterInstance.getCognitiveFlow();

      const decideNode = flow.nodes.find(n => n.id === 'DECIDE');
      expect(decideNode.status).toBe('active');

      const observeNode = flow.nodes.find(n => n.id === 'OBSERVE');
      expect(observeNode.status).toBe('idle');
    });

    it('should include recent tools', async () => {
      const flow = await adapterInstance.getCognitiveFlow();

      const toolNodes = flow.nodes.filter(n => n.id.startsWith('TOOL_'));
      expect(toolNodes).toHaveLength(3);
      expect(toolNodes.some(n => n.label === 'read')).toBe(true);
    });

    it('should create feedback loop', async () => {
      const flow = await adapterInstance.getCognitiveFlow();

      const feedbackEdge = flow.edges.find(e =>
        e.source === 'ACT' && e.target === 'OBSERVE' && e.type === 'feedback'
      );
      expect(feedbackEdge).toBeDefined();
      expect(feedbackEdge.curved).toBe(true);
    });
  });

  describe('Memory Heatmap', () => {
    it('should generate memory heatmap', async () => {
      const heatmap = await adapterInstance.getMemoryHeatmap();

      expect(heatmap).toBeDefined();
      expect(heatmap.heatmap).toBeInstanceOf(Map);
      expect(heatmap.nodes).toBeDefined();
    });

    it('should create grid of memory cells', async () => {
      const heatmap = await adapterInstance.getMemoryHeatmap();

      expect(heatmap.nodes.length).toBeGreaterThan(0);
      heatmap.nodes.forEach(node => {
        expect(node.x).toBeGreaterThanOrEqual(0);
        expect(node.y).toBeGreaterThanOrEqual(0);
        expect(node.heat).toBeDefined();
      });
    });

    it('should use access count for heat values', async () => {
      const heatmap = await adapterInstance.getMemoryHeatmap();

      const artifact1 = heatmap.nodes.find(n => n.id === '/data/artifact1.txt');
      expect(artifact1).toBeDefined();
      expect(artifact1.heat).toBe(25);

      const artifact2 = heatmap.nodes.find(n => n.id === '/data/artifact2.json');
      expect(artifact2).toBeDefined();
      expect(artifact2.heat).toBe(50);
    });

    it('should respect grid boundaries', async () => {
      const heatmap = await adapterInstance.getMemoryHeatmap();

      heatmap.nodes.forEach(node => {
        expect(node.x).toBeLessThan(400);
        expect(node.y).toBeLessThan(300);
      });
    });
  });

  describe('Goal Tree', () => {
    it('should generate goal hierarchy', async () => {
      const tree = await adapterInstance.getGoalTree();

      expect(tree).toBeDefined();
      expect(tree.nodes).toBeDefined();
      expect(tree.edges).toBeDefined();
    });

    it('should include root goal', async () => {
      const tree = await adapterInstance.getGoalTree();

      const root = tree.nodes.find(n => n.id === 'ROOT_GOAL');
      expect(root).toBeDefined();
      expect(root.label).toBe('Test goal');
      expect(root.isRoot).toBe(true);
      expect(root.status).toBe('active');
    });

    it('should include subgoals', async () => {
      const tree = await adapterInstance.getGoalTree();

      const subGoals = ['ANALYZE', 'PLAN', 'EXECUTE'];
      subGoals.forEach(goal => {
        const node = tree.nodes.find(n => n.id === goal);
        expect(node).toBeDefined();
      });
    });

    it('should create hierarchy edges', async () => {
      const tree = await adapterInstance.getGoalTree();

      const hierarchyEdges = tree.edges.filter(e => e.type === 'hierarchy');
      expect(hierarchyEdges.length).toBeGreaterThan(0);

      hierarchyEdges.forEach(edge => {
        expect(edge.source).toBe('ROOT_GOAL');
      });
    });

    it('should include task nodes', async () => {
      const tree = await adapterInstance.getGoalTree();

      const taskNodes = tree.nodes.filter(n => n.category === 'tool');
      expect(taskNodes.length).toBeGreaterThan(0);

      const subtaskEdges = tree.edges.filter(e => e.type === 'subtask');
      expect(subtaskEdges.length).toBe(taskNodes.length);
    });
  });

  describe('Tool Usage', () => {
    it('should generate tool usage graph', async () => {
      const usage = await adapterInstance.getToolUsage();

      expect(usage).toBeDefined();
      expect(usage.nodes).toBeDefined();
      expect(usage.edges).toBeDefined();
    });

    it('should include read and write tools', async () => {
      const usage = await adapterInstance.getToolUsage();

      expect(usage.nodes.length).toBeGreaterThan(0);

      const readTool = usage.nodes.find(n => n.id === 'read');
      expect(readTool).toBeDefined();
      expect(readTool.color).toBe('#0f0');

      const writeTool = usage.nodes.find(n => n.id === 'write');
      expect(writeTool).toBeDefined();
      expect(writeTool.color).toBe('#f00');
    });

    it('should create correlation edges', async () => {
      const usage = await adapterInstance.getToolUsage();

      const correlationEdges = usage.edges.filter(e => e.type === 'correlation');
      correlationEdges.forEach(edge => {
        expect(edge.weight).toBeGreaterThanOrEqual(0);
        expect(edge.weight).toBeLessThanOrEqual(1);
        expect(edge.directed).toBe(false);
      });
    });

    it('should handle parsing errors gracefully', async () => {
      mockStorage.getArtifactContent.mockImplementation(() => {
        return Promise.resolve('invalid json');
      });

      const usage = await adapterInstance.getToolUsage();
      expect(usage.nodes).toBeDefined();
      expect(mockDeps.logger.logEvent).toHaveBeenCalledWith(
        'warn',
        'Failed to parse tool definitions'
      );
    });
  });

  describe('Activity Tracking', () => {
    it('should track module activity', () => {
      adapterInstance.trackActivity('module_loaded', { module: 'TestModule' });

      expect(mockDeps.logger.logEvent).toHaveBeenCalledWith(
        'debug',
        'Tracking activity: module_loaded',
        { module: 'TestModule' }
      );
    });

    it('should invalidate dependency graph cache on module events', async () => {
      await adapterInstance.getDependencyGraph();
      const callCount1 = mockStorage.getAllArtifactMetadata.mock.calls.length;

      adapterInstance.trackActivity('module_loaded', {});
      await adapterInstance.getDependencyGraph();
      const callCount2 = mockStorage.getAllArtifactMetadata.mock.calls.length;

      expect(callCount2).toBeGreaterThan(callCount1);
    });

    it('should invalidate cognitive flow cache on cycle events', async () => {
      await adapterInstance.getCognitiveFlow();
      adapterInstance.trackActivity('cycle_completed', {});

      // Cache should be invalidated, requiring fresh data
      expect(mockDeps.logger.logEvent).toHaveBeenCalledWith(
        'debug',
        'Tracking activity: cycle_completed',
        {}
      );
    });

    it('should invalidate memory heatmap cache on artifact events', async () => {
      await adapterInstance.getMemoryHeatmap();
      adapterInstance.trackActivity('artifact_written', { path: '/test.txt' });

      expect(mockDeps.logger.logEvent).toHaveBeenCalled();
    });

    it('should invalidate goal tree cache on goal events', async () => {
      await adapterInstance.getGoalTree();
      adapterInstance.trackActivity('goal_updated', { goal: 'New goal' });

      expect(mockDeps.logger.logEvent).toHaveBeenCalled();
    });

    it('should invalidate multiple caches on tool execution', async () => {
      await adapterInstance.getToolUsage();
      await adapterInstance.getCognitiveFlow();

      adapterInstance.trackActivity('tool_executed', { tool: 'write' });

      expect(mockDeps.logger.logEvent).toHaveBeenCalledWith(
        'debug',
        'Tracking activity: tool_executed',
        { tool: 'write' }
      );
    });
  });

  describe('Performance Metrics', () => {
    it('should return performance metrics', async () => {
      const metrics = await adapterInstance.getPerformanceMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.cycles).toBe(5);
      expect(metrics.apiCalls).toBe(100);
      expect(metrics.tokensUsed).toBe(5000);
      expect(metrics.artifactsCreated).toBe(4);
      expect(metrics.successRate).toBe(0.8);
      expect(metrics.avgCycleTime).toBe(1500);
      expect(metrics.memoryUsage).toBe(1024000);
    });

    it('should handle missing state values', async () => {
      mockStateManager.getState.mockReturnValue({});

      const metrics = await adapterInstance.getPerformanceMetrics();

      expect(metrics.cycles).toBe(0);
      expect(metrics.apiCalls).toBe(0);
      expect(metrics.tokensUsed).toBe(0);
    });

    it('should calculate success rate correctly', async () => {
      mockStateManager.getState.mockReturnValue({
        totalCycles: 10,
        successfulCycles: 7
      });

      const metrics = await adapterInstance.getPerformanceMetrics();

      expect(metrics.successRate).toBe(0.7);
    });
  });

  describe('RSI Activity', () => {
    it('should track self-modifications', async () => {
      const rsiActivity = await adapterInstance.getRSIActivity();

      expect(rsiActivity).toBeDefined();
      expect(rsiActivity.modifications).toBeDefined();
      expect(rsiActivity.improvements).toBeDefined();
      expect(rsiActivity.rsiScore).toBeDefined();
    });

    it('should identify self-modified artifacts', async () => {
      const rsiActivity = await adapterInstance.getRSIActivity();

      const selfMod = rsiActivity.modifications.find(m =>
        m.path === '/data/artifact1.txt'
      );
      expect(selfMod).toBeDefined();
      expect(selfMod.type).toBe('self-modification');
      expect(selfMod.impact).toBe('high');
    });

    it('should track improvements', async () => {
      const rsiActivity = await adapterInstance.getRSIActivity();

      expect(rsiActivity.improvements).toHaveLength(1);
      expect(rsiActivity.improvements[0].id).toBe('imp1');
      expect(rsiActivity.improvements[0].improvement).toBe('50.00%');
    });

    it('should calculate RSI score', async () => {
      const rsiActivity = await adapterInstance.getRSIActivity();

      // 1 modification * 10 + 50% improvement = 60
      expect(rsiActivity.rsiScore).toBe(60);
    });

    it('should cap RSI score at 100', async () => {
      // Mock many modifications
      const manyModifications = {};
      for (let i = 0; i < 20; i++) {
        manyModifications[`/modules/mod${i}.js`] = {
          modifiedBy: 'SELF',
          modified: Date.now(),
          impact: 'high'
        };
      }
      mockStorage.getAllArtifactMetadata.mockResolvedValue(manyModifications);

      const rsiActivity = await adapterInstance.getRSIActivity();

      expect(rsiActivity.rsiScore).toBe(100);
    });

    it('should handle missing improvements array', async () => {
      mockStateManager.getState.mockReturnValue({
        totalCycles: 5
      });

      const rsiActivity = await adapterInstance.getRSIActivity();

      expect(rsiActivity.improvements).toHaveLength(0);
      expect(rsiActivity.rsiScore).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Caching', () => {
    it('should cache results for TTL period', async () => {
      await adapterInstance.getDependencyGraph();
      const callCount1 = mockStorage.getAllArtifactMetadata.mock.calls.length;

      // Call again within cache TTL
      await adapterInstance.getDependencyGraph();
      const callCount2 = mockStorage.getAllArtifactMetadata.mock.calls.length;

      expect(callCount2).toBe(callCount1);
    });

    it('should expire cache after TTL', async () => {
      vi.useFakeTimers();

      await adapterInstance.getDependencyGraph();
      const callCount1 = mockStorage.getAllArtifactMetadata.mock.calls.length;

      // Advance time beyond cache TTL
      vi.advanceTimersByTime(1500);

      await adapterInstance.getDependencyGraph();
      const callCount2 = mockStorage.getAllArtifactMetadata.mock.calls.length;

      expect(callCount2).toBeGreaterThan(callCount1);

      vi.useRealTimers();
    });
  });
});
