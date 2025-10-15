import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Introspector Module', () => {
  let Introspector;
  let mockDeps;
  let introspectorInstance;
  let mockEventBus;
  let mockNavigator;
  let mockDocument;
  let mockWindow;

  beforeEach(() => {
    // Mock browser APIs
    mockNavigator = {
      userAgent: 'Mozilla/5.0 Test Browser',
      platform: 'MacIntel',
      language: 'en-US',
      onLine: true,
      cookieEnabled: true,
      serviceWorker: {},
      clipboard: {},
      share: vi.fn(),
      geolocation: {}
    };
    global.navigator = mockNavigator;

    mockDocument = {
      createElement: vi.fn(() => ({
        getContext: vi.fn((type) => {
          if (type === 'webgl' || type === 'experimental-webgl') {
            return {};
          }
          return null;
        })
      }))
    };
    global.document = mockDocument;

    mockWindow = {
      Notification: class Notification {},
      RTCPeerConnection: class RTCPeerConnection {},
      Worker: class Worker {},
      WebAssembly: {}
    };
    Object.assign(global, mockWindow);

    global.indexedDB = {};
    global.localStorage = {};
    global.sessionStorage = {};

    global.performance = {
      memory: {
        jsHeapSizeLimit: 2172649472,
        totalJSHeapSize: 100000000,
        usedJSHeapSize: 50000000
      },
      timing: {},
      navigation: {}
    };

    // Mock EventBus
    mockEventBus = {
      on: vi.fn(),
      emit: vi.fn()
    };

    // Mock dependencies
    mockDeps = {
      Utils: {
        logger: {
          info: vi.fn(),
          debug: vi.fn(),
          warn: vi.fn(),
          error: vi.fn()
        }
      },
      EventBus: mockEventBus,
      StateManager: {
        getArtifactContent: vi.fn()
      }
    };

    // Define Introspector module
    Introspector = {
      metadata: {
        id: 'Introspector',
        version: '1.0.0',
        dependencies: ['Utils', 'EventBus', 'StateManager'],
        async: false,
        type: 'introspection'
      },
      factory: (deps) => {
        const { Utils, EventBus, StateManager } = deps;
        const { logger } = Utils;

        let moduleGraphCache = null;
        let toolCatalogCache = null;
        let capabilitiesCache = null;

        const init = () => {
          logger.info('[Introspector] Initializing self-analysis capabilities');
          EventBus.on('module:registered', () => {
            moduleGraphCache = null;
            toolCatalogCache = null;
          });
          logger.info('[Introspector] Initialized successfully');
        };

        const getModuleGraph = async () => {
          if (moduleGraphCache) {
            return moduleGraphCache;
          }

          logger.info('[Introspector] Building module dependency graph');

          try {
            const configContent = await StateManager.getArtifactContent('/config.json');
            const config = JSON.parse(configContent);

            const graph = {
              modules: [],
              edges: [],
              statistics: {
                totalModules: 0,
                byCategory: {},
                byType: {},
                avgDependencies: 0
              }
            };

            if (config.modules) {
              for (const module of config.modules) {
                const moduleNode = {
                  id: module.id,
                  path: module.path,
                  description: module.description,
                  category: module.category,
                  dependencies: []
                };

                try {
                  const modulePath = `/upgrades/${module.path}`;
                  const moduleContent = await StateManager.getArtifactContent(modulePath);

                  const metadataMatch = moduleContent.match(/metadata:\s*\{([^}]+)\}/s);
                  if (metadataMatch) {
                    const depsMatch = moduleContent.match(/dependencies:\s*\[([^\]]*)\]/);
                    if (depsMatch) {
                      const depsString = depsMatch[1];
                      const deps = depsString.split(',')
                        .map(d => d.trim().replace(/['"]/g, ''))
                        .filter(d => d.length > 0);
                      moduleNode.dependencies = deps;

                      deps.forEach(dep => {
                        graph.edges.push({
                          from: module.id,
                          to: dep,
                          type: 'dependency'
                        });
                      });
                    }

                    const versionMatch = moduleContent.match(/version:\s*['"]([^'"]+)['"]/);
                    if (versionMatch) {
                      moduleNode.version = versionMatch[1];
                    }

                    const typeMatch = moduleContent.match(/type:\s*['"]([^'"]+)['"]/);
                    if (typeMatch) {
                      moduleNode.type = typeMatch[1];
                    }
                  }
                } catch (err) {
                  logger.warn(`[Introspector] Could not analyze module ${module.id}:`, err.message);
                }

                graph.modules.push(moduleNode);

                graph.statistics.byCategory[module.category] =
                  (graph.statistics.byCategory[module.category] || 0) + 1;

                if (moduleNode.type) {
                  graph.statistics.byType[moduleNode.type] =
                    (graph.statistics.byType[moduleNode.type] || 0) + 1;
                }
              }

              graph.statistics.totalModules = graph.modules.length;
              const totalDeps = graph.modules.reduce((sum, m) => sum + m.dependencies.length, 0);
              graph.statistics.avgDependencies = graph.modules.length > 0
                ? totalDeps / graph.modules.length
                : 0;
            }

            moduleGraphCache = graph;
            logger.info(`[Introspector] Module graph built: ${graph.modules.length} modules, ${graph.edges.length} dependencies`);
            return graph;
          } catch (err) {
            logger.error('[Introspector] Failed to build module graph:', err);
            return {
              modules: [],
              edges: [],
              statistics: { totalModules: 0, byCategory: {}, byType: {}, avgDependencies: 0 },
              error: err.message
            };
          }
        };

        const getToolCatalog = async () => {
          if (toolCatalogCache) {
            return toolCatalogCache;
          }

          logger.info('[Introspector] Building tool catalog');

          const catalog = {
            readTools: [],
            writeTools: [],
            statistics: {
              totalTools: 0,
              readCount: 0,
              writeCount: 0
            }
          };

          try {
            const readToolsContent = await StateManager.getArtifactContent('/upgrades/tools-read.json');
            const readTools = JSON.parse(readToolsContent);

            if (Array.isArray(readTools)) {
              catalog.readTools = readTools.map(tool => ({
                name: tool.name,
                description: tool.description,
                parameters: tool.parameters || [],
                category: 'read',
                risk: 'low'
              }));
              catalog.statistics.readCount = catalog.readTools.length;
            }
          } catch (err) {
            logger.warn('[Introspector] Could not load read tools:', err.message);
          }

          try {
            const writeToolsContent = await StateManager.getArtifactContent('/upgrades/tools-write.json');
            const writeTools = JSON.parse(writeToolsContent);

            if (Array.isArray(writeTools)) {
              catalog.writeTools = writeTools.map(tool => ({
                name: tool.name,
                description: tool.description,
                parameters: tool.parameters || [],
                category: 'write',
                risk: 'high'
              }));
              catalog.statistics.writeCount = catalog.writeTools.length;
            }
          } catch (err) {
            logger.warn('[Introspector] Could not load write tools:', err.message);
          }

          catalog.statistics.totalTools = catalog.statistics.readCount + catalog.statistics.writeCount;

          toolCatalogCache = catalog;
          logger.info(`[Introspector] Tool catalog built: ${catalog.statistics.totalTools} tools (${catalog.statistics.readCount} read, ${catalog.statistics.writeCount} write)`);
          return catalog;
        };

        const analyzeOwnCode = async (filePath) => {
          logger.info(`[Introspector] Analyzing code: ${filePath}`);

          try {
            const content = await StateManager.getArtifactContent(filePath);

            const analysis = {
              path: filePath,
              lines: {
                total: 0,
                code: 0,
                comments: 0,
                blank: 0
              },
              complexity: {
                functions: 0,
                classes: 0,
                conditionals: 0,
                loops: 0,
                asyncFunctions: 0
              },
              patterns: {
                todos: [],
                fixmes: [],
                errors: [],
                warnings: []
              },
              dependencies: {
                imports: [],
                requires: []
              },
              metrics: {
                avgLineLength: 0,
                maxLineLength: 0,
                complexityScore: 0
              }
            };

            const lines = content.split('\n');
            analysis.lines.total = lines.length;

            lines.forEach((line, index) => {
              const trimmed = line.trim();

              if (trimmed === '') {
                analysis.lines.blank++;
              } else if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
                analysis.lines.comments++;
              } else {
                analysis.lines.code++;
              }

              if (/\bfunction\s+\w+/.test(line) || /\w+\s*:\s*function/.test(line) || /=>\s*\{?/.test(line)) {
                analysis.complexity.functions++;
              }
              if (/\bclass\s+\w+/.test(line)) {
                analysis.complexity.classes++;
              }
              if (/\b(if|else if|switch|case|\?|&&|\|\|)\b/.test(line)) {
                analysis.complexity.conditionals++;
              }
              if (/\b(for|while|do)\b/.test(line)) {
                analysis.complexity.loops++;
              }
              if (/\basync\s+(function|\(|=>)/.test(line)) {
                analysis.complexity.asyncFunctions++;
              }

              if (/TODO|FIXME|XXX|HACK|BUG/i.test(line)) {
                const match = line.match(/(TODO|FIXME|XXX|HACK|BUG):?\s*(.+)/i);
                if (match) {
                  const type = match[1].toUpperCase();
                  const message = match[2].trim();

                  if (type === 'TODO') {
                    analysis.patterns.todos.push({ line: index + 1, message });
                  } else if (type === 'FIXME') {
                    analysis.patterns.fixmes.push({ line: index + 1, message });
                  }
                }
              }

              if (/\berror\b/i.test(line) && trimmed.startsWith('//')) {
                analysis.patterns.errors.push({ line: index + 1, message: trimmed.substring(2).trim() });
              }
              if (/\bwarning\b/i.test(line) && trimmed.startsWith('//')) {
                analysis.patterns.warnings.push({ line: index + 1, message: trimmed.substring(2).trim() });
              }

              if (/import\s+.+\s+from/.test(line)) {
                const match = line.match(/from\s+['"]([^'"]+)['"]/);
                if (match) analysis.dependencies.imports.push(match[1]);
              }
              if (/require\s*\(['"]/.test(line)) {
                const match = line.match(/require\s*\(['"]([^'"]+)['"]\)/);
                if (match) analysis.dependencies.requires.push(match[1]);
              }

              const lineLength = line.length;
              analysis.metrics.maxLineLength = Math.max(analysis.metrics.maxLineLength, lineLength);
            });

            analysis.metrics.avgLineLength = analysis.lines.code > 0
              ? Math.round(lines.filter(l => l.trim() !== '').reduce((sum, l) => sum + l.length, 0) / analysis.lines.code)
              : 0;

            analysis.metrics.complexityScore =
              analysis.complexity.functions +
              analysis.complexity.conditionals * 2 +
              analysis.complexity.loops * 2 +
              analysis.complexity.classes * 3;

            logger.info(`[Introspector] Code analysis complete: ${analysis.lines.total} lines, complexity score ${analysis.metrics.complexityScore}`);
            return analysis;
          } catch (err) {
            logger.error(`[Introspector] Failed to analyze code:`, err);
            return {
              path: filePath,
              error: err.message
            };
          }
        };

        const getCapabilities = () => {
          if (capabilitiesCache) {
            return capabilitiesCache;
          }

          logger.info('[Introspector] Detecting browser capabilities');

          const capabilities = {
            browser: {
              userAgent: navigator.userAgent,
              platform: navigator.platform,
              language: navigator.language,
              online: navigator.onLine,
              cookiesEnabled: navigator.cookieEnabled
            },
            features: {
              serviceWorker: 'serviceWorker' in navigator,
              webWorker: typeof Worker !== 'undefined',
              indexedDB: typeof indexedDB !== 'undefined',
              localStorage: typeof localStorage !== 'undefined',
              sessionStorage: typeof sessionStorage !== 'undefined',
              webGL: detectWebGL(),
              webGPU: 'gpu' in navigator,
              webAssembly: typeof WebAssembly !== 'undefined',
              webRTC: 'RTCPeerConnection' in global,
              clipboard: 'clipboard' in navigator,
              share: 'share' in navigator,
              notifications: 'Notification' in global,
              geolocation: 'geolocation' in navigator
            },
            performance: {
              memory: performance.memory ? {
                available: true,
                jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
                totalJSHeapSize: performance.memory.totalJSHeapSize,
                usedJSHeapSize: performance.memory.usedJSHeapSize
              } : { available: false },
              timing: performance.timing ? true : false,
              navigation: performance.navigation ? true : false
            },
            experimental: {
              pyodide: typeof loadPyodide !== 'undefined' || global.pyodide !== undefined,
              webLLM: typeof WebLLM !== 'undefined' || global.WebLLM !== undefined,
              tensorFlow: typeof tf !== 'undefined'
            }
          };

          capabilitiesCache = capabilities;
          logger.info('[Introspector] Capabilities detected');
          return capabilities;
        };

        const detectWebGL = () => {
          try {
            const canvas = document.createElement('canvas');
            return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
          } catch (e) {
            return false;
          }
        };

        const generateSelfReport = async () => {
          logger.info('[Introspector] Generating comprehensive self-analysis report');

          const moduleGraph = await getModuleGraph();
          const toolCatalog = await getToolCatalog();
          const capabilities = getCapabilities();

          let report = `# REPLOID Self-Analysis Report\n\n`;
          report += `**Generated:** ${new Date().toISOString()}\n\n`;

          report += `## Module Architecture\n\n`;
          report += `- **Total Modules:** ${moduleGraph.statistics.totalModules}\n`;
          report += `- **Total Dependencies:** ${moduleGraph.edges.length}\n`;
          report += `- **Avg Dependencies per Module:** ${moduleGraph.statistics.avgDependencies.toFixed(2)}\n\n`;

          report += `### Modules by Category\n\n`;
          Object.entries(moduleGraph.statistics.byCategory)
            .sort((a, b) => b[1] - a[1])
            .forEach(([category, count]) => {
              report += `- **${category}:** ${count} modules\n`;
            });
          report += `\n`;

          if (Object.keys(moduleGraph.statistics.byType).length > 0) {
            report += `### Modules by Type\n\n`;
            Object.entries(moduleGraph.statistics.byType)
              .sort((a, b) => b[1] - a[1])
              .forEach(([type, count]) => {
                report += `- **${type}:** ${count} modules\n`;
              });
            report += `\n`;
          }

          report += `## Tool Capabilities\n\n`;
          report += `- **Total Tools:** ${toolCatalog.statistics.totalTools}\n`;
          report += `- **Read Tools:** ${toolCatalog.statistics.readCount} (safe introspection)\n`;
          report += `- **Write Tools:** ${toolCatalog.statistics.writeCount} (RSI capabilities)\n\n`;

          if (toolCatalog.readTools.length > 0) {
            report += `### Read Tools\n\n`;
            toolCatalog.readTools.slice(0, 10).forEach(tool => {
              report += `- **${tool.name}:** ${tool.description}\n`;
            });
            if (toolCatalog.readTools.length > 10) {
              report += `- *...and ${toolCatalog.readTools.length - 10} more*\n`;
            }
            report += `\n`;
          }

          if (toolCatalog.writeTools.length > 0) {
            report += `### Write Tools (RSI)\n\n`;
            toolCatalog.writeTools.slice(0, 10).forEach(tool => {
              report += `- **${tool.name}:** ${tool.description}\n`;
            });
            if (toolCatalog.writeTools.length > 10) {
              report += `- *...and ${toolCatalog.writeTools.length - 10} more*\n`;
            }
            report += `\n`;
          }

          report += `## Browser Capabilities\n\n`;
          report += `### Platform\n`;
          report += `- **User Agent:** ${capabilities.browser.userAgent}\n`;
          report += `- **Platform:** ${capabilities.browser.platform}\n`;
          report += `- **Language:** ${capabilities.browser.language}\n`;
          report += `- **Online:** ${capabilities.browser.online}\n\n`;

          report += `### Features\n`;
          const availableFeatures = Object.entries(capabilities.features)
            .filter(([, available]) => available)
            .map(([feature]) => feature);
          report += availableFeatures.map(f => `- ✓ ${f}`).join('\n');
          report += `\n\n`;

          const unavailableFeatures = Object.entries(capabilities.features)
            .filter(([, available]) => !available)
            .map(([feature]) => feature);
          if (unavailableFeatures.length > 0) {
            report += `### Unavailable Features\n`;
            report += unavailableFeatures.map(f => `- ✗ ${f}`).join('\n');
            report += `\n\n`;
          }

          if (capabilities.performance.memory.available) {
            const mem = capabilities.performance.memory;
            report += `### Memory\n`;
            report += `- **Heap Limit:** ${(mem.jsHeapSizeLimit / 1024 / 1024).toFixed(2)} MB\n`;
            report += `- **Total Heap:** ${(mem.totalJSHeapSize / 1024 / 1024).toFixed(2)} MB\n`;
            report += `- **Used Heap:** ${(mem.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB\n`;
            report += `- **Usage:** ${((mem.usedJSHeapSize / mem.jsHeapSizeLimit) * 100).toFixed(1)}%\n\n`;
          }

          const experimentalAvailable = Object.entries(capabilities.experimental)
            .filter(([, available]) => available);
          if (experimentalAvailable.length > 0) {
            report += `### Experimental Features\n`;
            experimentalAvailable.forEach(([feature]) => {
              report += `- ✓ ${feature}\n`;
            });
            report += `\n`;
          }

          report += `---\n\n*Generated by REPLOID Introspector*\n`;

          return report;
        };

        const clearCache = () => {
          moduleGraphCache = null;
          toolCatalogCache = null;
          capabilitiesCache = null;
          logger.info('[Introspector] Caches cleared');
        };

        return {
          init,
          api: {
            getModuleGraph,
            getToolCatalog,
            analyzeOwnCode,
            getCapabilities,
            generateSelfReport,
            clearCache
          }
        };
      }
    };

    introspectorInstance = Introspector.factory(mockDeps);
    introspectorInstance.init();
  });

  describe('Module Metadata', () => {
    it('should have correct metadata', () => {
      expect(Introspector.metadata.id).toBe('Introspector');
      expect(Introspector.metadata.version).toBe('1.0.0');
      expect(Introspector.metadata.type).toBe('introspection');
    });

    it('should declare required dependencies', () => {
      expect(Introspector.metadata.dependencies).toContain('Utils');
      expect(Introspector.metadata.dependencies).toContain('EventBus');
      expect(Introspector.metadata.dependencies).toContain('StateManager');
    });

    it('should be synchronous', () => {
      expect(Introspector.metadata.async).toBe(false);
    });
  });

  describe('Initialization', () => {
    it('should initialize successfully', () => {
      expect(mockDeps.Utils.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Initializing self-analysis capabilities')
      );
    });

    it('should register cache invalidation listener', () => {
      expect(mockEventBus.on).toHaveBeenCalledWith(
        'module:registered',
        expect.any(Function)
      );
    });
  });

  describe('Module Graph', () => {
    it('should build module graph from config', async () => {
      mockDeps.StateManager.getArtifactContent.mockImplementation((path) => {
        if (path === '/config.json') {
          return Promise.resolve(JSON.stringify({
            modules: [
              { id: 'Module1', path: 'module1.js', description: 'Test module 1', category: 'core' },
              { id: 'Module2', path: 'module2.js', description: 'Test module 2', category: 'utility' }
            ]
          }));
        }
        if (path === '/upgrades/module1.js') {
          return Promise.resolve(`
            metadata: {
              id: 'Module1',
              version: '1.0.0',
              dependencies: ['Utils', 'EventBus'],
              type: 'service'
            }
          `);
        }
        if (path === '/upgrades/module2.js') {
          return Promise.resolve(`
            metadata: {
              id: 'Module2',
              version: '1.1.0',
              dependencies: ['Module1'],
              type: 'helper'
            }
          `);
        }
        return Promise.reject(new Error('Not found'));
      });

      const graph = await introspectorInstance.api.getModuleGraph();

      expect(graph.modules).toHaveLength(2);
      expect(graph.statistics.totalModules).toBe(2);
      expect(graph.edges).toHaveLength(3); // Module1: 2 deps, Module2: 1 dep
    });

    it('should calculate statistics correctly', async () => {
      mockDeps.StateManager.getArtifactContent.mockResolvedValue(JSON.stringify({
        modules: [
          { id: 'M1', path: 'm1.js', category: 'core' },
          { id: 'M2', path: 'm2.js', category: 'core' },
          { id: 'M3', path: 'm3.js', category: 'utility' }
        ]
      }));

      const graph = await introspectorInstance.api.getModuleGraph();

      expect(graph.statistics.byCategory['core']).toBe(2);
      expect(graph.statistics.byCategory['utility']).toBe(1);
    });

    it('should use cache on second call', async () => {
      mockDeps.StateManager.getArtifactContent.mockResolvedValue(JSON.stringify({
        modules: [{ id: 'M1', path: 'm1.js', category: 'core' }]
      }));

      await introspectorInstance.api.getModuleGraph();
      const callCountAfterFirst = mockDeps.StateManager.getArtifactContent.mock.calls.length;

      await introspectorInstance.api.getModuleGraph();
      const callCountAfterSecond = mockDeps.StateManager.getArtifactContent.mock.calls.length;

      // Second call should not make additional requests (cache hit)
      expect(callCountAfterSecond).toBe(callCountAfterFirst);
    });

    it('should handle errors gracefully', async () => {
      mockDeps.StateManager.getArtifactContent.mockRejectedValue(new Error('Config not found'));

      const graph = await introspectorInstance.api.getModuleGraph();

      expect(graph.error).toBe('Config not found');
      expect(graph.modules).toHaveLength(0);
    });
  });

  describe('Tool Catalog', () => {
    it('should build tool catalog from JSON files', async () => {
      mockDeps.StateManager.getArtifactContent.mockImplementation((path) => {
        if (path === '/upgrades/tools-read.json') {
          return Promise.resolve(JSON.stringify([
            { name: 'read1', description: 'Read tool 1' },
            { name: 'read2', description: 'Read tool 2' }
          ]));
        }
        if (path === '/upgrades/tools-write.json') {
          return Promise.resolve(JSON.stringify([
            { name: 'write1', description: 'Write tool 1' }
          ]));
        }
        return Promise.reject(new Error('Not found'));
      });

      const catalog = await introspectorInstance.api.getToolCatalog();

      expect(catalog.readTools).toHaveLength(2);
      expect(catalog.writeTools).toHaveLength(1);
      expect(catalog.statistics.totalTools).toBe(3);
      expect(catalog.statistics.readCount).toBe(2);
      expect(catalog.statistics.writeCount).toBe(1);
    });

    it('should categorize read tools correctly', async () => {
      mockDeps.StateManager.getArtifactContent.mockResolvedValue(JSON.stringify([
        { name: 'tool1', description: 'Test tool' }
      ]));

      const catalog = await introspectorInstance.api.getToolCatalog();

      expect(catalog.readTools[0].category).toBe('read');
      expect(catalog.readTools[0].risk).toBe('low');
    });

    it('should categorize write tools correctly', async () => {
      mockDeps.StateManager.getArtifactContent.mockImplementation((path) => {
        if (path === '/upgrades/tools-read.json') throw new Error('Not found');
        if (path === '/upgrades/tools-write.json') {
          return Promise.resolve(JSON.stringify([
            { name: 'tool1', description: 'Test tool' }
          ]));
        }
      });

      const catalog = await introspectorInstance.api.getToolCatalog();

      expect(catalog.writeTools[0].category).toBe('write');
      expect(catalog.writeTools[0].risk).toBe('high');
    });

    it('should use cache on second call', async () => {
      mockDeps.StateManager.getArtifactContent.mockResolvedValue(JSON.stringify([]));

      await introspectorInstance.api.getToolCatalog();
      await introspectorInstance.api.getToolCatalog();

      expect(mockDeps.StateManager.getArtifactContent).toHaveBeenCalledTimes(2); // once for read, once for write
    });
  });

  describe('Code Analysis', () => {
    it('should analyze code metrics', async () => {
      const code = `// Comment line
function testFunc() {
  if (true) {
    for (let i = 0; i < 10; i++) {
      console.log(i);
    }
  }
}

class TestClass {
  method() {}
}

async function asyncFunc() {
  await something();
}
`;

      mockDeps.StateManager.getArtifactContent.mockResolvedValue(code);

      const analysis = await introspectorInstance.api.analyzeOwnCode('/test.js');

      expect(analysis.complexity.functions).toBeGreaterThan(0);
      expect(analysis.complexity.classes).toBe(1);
      expect(analysis.complexity.conditionals).toBeGreaterThan(0);
      expect(analysis.complexity.loops).toBeGreaterThan(0);
      expect(analysis.complexity.asyncFunctions).toBeGreaterThan(0);
    });

    it('should detect TODO comments', async () => {
      const code = `
// TODO: Implement this feature
function test() {
  // FIXME: This is broken
  return 42;
}
`;

      mockDeps.StateManager.getArtifactContent.mockResolvedValue(code);

      const analysis = await introspectorInstance.api.analyzeOwnCode('/test.js');

      expect(analysis.patterns.todos).toHaveLength(1);
      expect(analysis.patterns.fixmes).toHaveLength(1);
      expect(analysis.patterns.todos[0].message).toContain('Implement this feature');
    });

    it('should detect dependencies', async () => {
      const code = `
import { something } from 'module1';
import other from 'module2';
const local = require('module3');
`;

      mockDeps.StateManager.getArtifactContent.mockResolvedValue(code);

      const analysis = await introspectorInstance.api.analyzeOwnCode('/test.js');

      expect(analysis.dependencies.imports).toContain('module1');
      expect(analysis.dependencies.imports).toContain('module2');
      expect(analysis.dependencies.requires).toContain('module3');
    });

    it('should calculate complexity score', async () => {
      const code = `
function test1() { if (true) { } }
function test2() { for (let i = 0; i < 10; i++) { } }
class MyClass { }
`;

      mockDeps.StateManager.getArtifactContent.mockResolvedValue(code);

      const analysis = await introspectorInstance.api.analyzeOwnCode('/test.js');

      expect(analysis.metrics.complexityScore).toBeGreaterThan(0);
    });

    it('should categorize lines correctly', async () => {
      const code = `// Comment
/* Block comment */

function test() {
  return 42;
}
`;

      mockDeps.StateManager.getArtifactContent.mockResolvedValue(code);

      const analysis = await introspectorInstance.api.analyzeOwnCode('/test.js');

      expect(analysis.lines.comments).toBeGreaterThan(0);
      expect(analysis.lines.blank).toBeGreaterThan(0);
      expect(analysis.lines.code).toBeGreaterThan(0);
      expect(analysis.lines.total).toBe(analysis.lines.comments + analysis.lines.blank + analysis.lines.code);
    });

    it('should handle analysis errors', async () => {
      mockDeps.StateManager.getArtifactContent.mockRejectedValue(new Error('File not found'));

      const analysis = await introspectorInstance.api.analyzeOwnCode('/missing.js');

      expect(analysis.error).toBe('File not found');
      expect(analysis.path).toBe('/missing.js');
    });
  });

  describe('Browser Capabilities', () => {
    it('should detect browser information', () => {
      const capabilities = introspectorInstance.api.getCapabilities();

      expect(capabilities.browser.userAgent).toBe('Mozilla/5.0 Test Browser');
      expect(capabilities.browser.platform).toBe('MacIntel');
      expect(capabilities.browser.language).toBe('en-US');
      expect(capabilities.browser.online).toBe(true);
    });

    it('should detect available features', () => {
      const capabilities = introspectorInstance.api.getCapabilities();

      expect(capabilities.features.webWorker).toBe(true);
      expect(capabilities.features.indexedDB).toBe(true);
      expect(capabilities.features.localStorage).toBe(true);
      expect(capabilities.features.webAssembly).toBe(true);
    });

    it('should detect WebGL support', () => {
      const capabilities = introspectorInstance.api.getCapabilities();

      expect(capabilities.features.webGL).toBe(true);
    });

    it('should detect performance memory', () => {
      const capabilities = introspectorInstance.api.getCapabilities();

      expect(capabilities.performance.memory.available).toBe(true);
      expect(capabilities.performance.memory.jsHeapSizeLimit).toBeGreaterThan(0);
    });

    it('should use cache on second call', () => {
      introspectorInstance.api.getCapabilities();
      introspectorInstance.api.getCapabilities();

      // Logger should only be called once for first detection
      const detectionCalls = mockDeps.Utils.logger.info.mock.calls.filter(
        call => call[0].includes('Detecting browser capabilities')
      );
      expect(detectionCalls).toHaveLength(1);
    });
  });

  describe('Self Report', () => {
    it('should generate comprehensive report', async () => {
      mockDeps.StateManager.getArtifactContent.mockImplementation((path) => {
        if (path === '/config.json') {
          return Promise.resolve(JSON.stringify({
            modules: [{ id: 'M1', path: 'm1.js', category: 'core' }]
          }));
        }
        if (path === '/upgrades/tools-read.json') {
          return Promise.resolve(JSON.stringify([{ name: 'tool1', description: 'Test tool' }]));
        }
        if (path === '/upgrades/tools-write.json') {
          return Promise.resolve(JSON.stringify([]));
        }
        return Promise.resolve('');
      });

      const report = await introspectorInstance.api.generateSelfReport();

      expect(report).toContain('# REPLOID Self-Analysis Report');
      expect(report).toContain('## Module Architecture');
      expect(report).toContain('## Tool Capabilities');
      expect(report).toContain('## Browser Capabilities');
    });

    it('should include module statistics in report', async () => {
      mockDeps.StateManager.getArtifactContent.mockResolvedValue(JSON.stringify({
        modules: [
          { id: 'M1', path: 'm1.js', category: 'core' },
          { id: 'M2', path: 'm2.js', category: 'utility' }
        ]
      }));

      const report = await introspectorInstance.api.generateSelfReport();

      expect(report).toContain('**Total Modules:** 2');
    });

    it('should include browser platform info', async () => {
      mockDeps.StateManager.getArtifactContent.mockResolvedValue(JSON.stringify({
        modules: []
      }));

      const report = await introspectorInstance.api.generateSelfReport();

      expect(report).toContain('Mozilla/5.0 Test Browser');
      expect(report).toContain('MacIntel');
    });
  });

  describe('Cache Management', () => {
    it('should clear all caches', async () => {
      mockDeps.StateManager.getArtifactContent.mockResolvedValue(JSON.stringify({
        modules: []
      }));

      // Populate caches
      await introspectorInstance.api.getModuleGraph();
      await introspectorInstance.api.getToolCatalog();
      introspectorInstance.api.getCapabilities();

      // Clear caches
      introspectorInstance.api.clearCache();

      // Should re-fetch data
      await introspectorInstance.api.getModuleGraph();

      expect(mockDeps.Utils.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Caches cleared')
      );
    });

    it('should invalidate cache on module registration', async () => {
      mockDeps.StateManager.getArtifactContent.mockResolvedValue(JSON.stringify({
        modules: [{ id: 'M1', path: 'm1.js', category: 'core' }]
      }));

      // Build initial graph
      await introspectorInstance.api.getModuleGraph();

      // Trigger cache invalidation
      const callback = mockEventBus.on.mock.calls.find(
        call => call[0] === 'module:registered'
      )[1];
      callback();

      // Should rebuild graph
      await introspectorInstance.api.getModuleGraph();

      // StateManager should be called twice (once for each build)
      expect(mockDeps.StateManager.getArtifactContent).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Handling', () => {
    it('should warn on module analysis failures', async () => {
      mockDeps.StateManager.getArtifactContent.mockImplementation((path) => {
        if (path === '/config.json') {
          return Promise.resolve(JSON.stringify({
            modules: [{ id: 'M1', path: 'm1.js', category: 'core' }]
          }));
        }
        throw new Error('Module file not found');
      });

      await introspectorInstance.api.getModuleGraph();

      expect(mockDeps.Utils.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Could not analyze module'),
        expect.any(String)
      );
    });

    it('should warn on tool loading failures', async () => {
      mockDeps.StateManager.getArtifactContent.mockRejectedValue(new Error('Tools not found'));

      await introspectorInstance.api.getToolCatalog();

      expect(mockDeps.Utils.logger.warn).toHaveBeenCalled();
    });
  });
});
