// @blueprint 0x00001B - Details the introspector for deep code self-analysis.
// Introspector Module for REPLOID - RSI-1
// Enables the agent to understand its own architecture and capabilities

const Introspector = {
  metadata: {
    id: 'Introspector',
    version: '1.0.0',
    dependencies: ['Utils', 'EventBus', 'Storage'],
    async: false,
    type: 'introspection'
  },

  factory: (deps) => {
    const { Utils, EventBus, Storage } = deps;
    const { logger } = Utils;

    // Cache for introspection data
    let moduleGraphCache = null;
    let toolCatalogCache = null;
    let capabilitiesCache = null;

    // Initialize
    const init = () => {
      logger.info('[Introspector] Initializing self-analysis capabilities');

      // Listen for module registration events to invalidate cache
      EventBus.on('module:registered', () => {
        moduleGraphCache = null;
        toolCatalogCache = null;
      });

      logger.info('[Introspector] Initialized successfully');
    };

    // Get the module dependency graph
    const getModuleGraph = async () => {
      if (moduleGraphCache) {
        return moduleGraphCache;
      }

      logger.info('[Introspector] Building module dependency graph');

      try {
        // Read config.json to get module registry
        const configContent = await Storage.getArtifactContent('/config.json');
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

        // Parse modules from config
        if (config.modules) {
          for (const module of config.modules) {
            const moduleNode = {
              id: module.id,
              path: module.path,
              description: module.description,
              category: module.category,
              dependencies: []
            };

            // Try to read the actual module to get metadata
            try {
              const modulePath = `/upgrades/${module.path}`;
              const moduleContent = await Storage.getArtifactContent(modulePath);

              // Extract metadata (look for metadata: { ... } pattern)
              const metadataMatch = moduleContent.match(/metadata:\s*\{([^}]+)\}/s);
              if (metadataMatch) {
                // Extract dependencies array
                const depsMatch = moduleContent.match(/dependencies:\s*\[([^\]]*)\]/);
                if (depsMatch) {
                  const depsString = depsMatch[1];
                  const deps = depsString.split(',')
                    .map(d => d.trim().replace(/['"]/g, ''))
                    .filter(d => d.length > 0);
                  moduleNode.dependencies = deps;

                  // Create edges
                  deps.forEach(dep => {
                    graph.edges.push({
                      from: module.id,
                      to: dep,
                      type: 'dependency'
                    });
                  });
                }

                // Extract version
                const versionMatch = moduleContent.match(/version:\s*['"]([^'"]+)['"]/);
                if (versionMatch) {
                  moduleNode.version = versionMatch[1];
                }

                // Extract type
                const typeMatch = moduleContent.match(/type:\s*['"]([^'"]+)['"]/);
                if (typeMatch) {
                  moduleNode.type = typeMatch[1];
                }
              }
            } catch (err) {
              logger.warn(`[Introspector] Could not analyze module ${module.id}:`, err.message);
            }

            graph.modules.push(moduleNode);

            // Update statistics
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

    // Get catalog of available tools
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
        // Read tools-read.json
        const readToolsContent = await Storage.getArtifactContent('/upgrades/tools-read.json');
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
        // Read tools-write.json
        const writeToolsContent = await Storage.getArtifactContent('/upgrades/tools-write.json');
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

    // Analyze the agent's own code for complexity and patterns
    const analyzeOwnCode = async (filePath) => {
      logger.info(`[Introspector] Analyzing code: ${filePath}`);

      try {
        const content = await Storage.getArtifactContent(filePath);

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

          // Line categorization
          if (trimmed === '') {
            analysis.lines.blank++;
          } else if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
            analysis.lines.comments++;
          } else {
            analysis.lines.code++;
          }

          // Complexity patterns
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

          // Pattern detection
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

          // Error/warning comments
          if (/\berror\b/i.test(line) && trimmed.startsWith('//')) {
            analysis.patterns.errors.push({ line: index + 1, message: trimmed.substring(2).trim() });
          }
          if (/\bwarning\b/i.test(line) && trimmed.startsWith('//')) {
            analysis.patterns.warnings.push({ line: index + 1, message: trimmed.substring(2).trim() });
          }

          // Dependencies
          if (/import\s+.+\s+from/.test(line)) {
            const match = line.match(/from\s+['"]([^'"]+)['"]/);
            if (match) analysis.dependencies.imports.push(match[1]);
          }
          if (/require\s*\(['"]/.test(line)) {
            const match = line.match(/require\s*\(['"]([^'"]+)['"]\)/);
            if (match) analysis.dependencies.requires.push(match[1]);
          }

          // Line length metrics
          const lineLength = line.length;
          analysis.metrics.maxLineLength = Math.max(analysis.metrics.maxLineLength, lineLength);
        });

        // Calculate averages
        analysis.metrics.avgLineLength = analysis.lines.code > 0
          ? Math.round(lines.filter(l => l.trim() !== '').reduce((sum, l) => sum + l.length, 0) / analysis.lines.code)
          : 0;

        // Calculate complexity score (simplified cyclomatic complexity estimate)
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

    // Detect browser capabilities
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
          webRTC: 'RTCPeerConnection' in window,
          clipboard: 'clipboard' in navigator,
          share: 'share' in navigator,
          notifications: 'Notification' in window,
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
          pyodide: checkPyodideAvailable(),
          webLLM: checkWebLLMAvailable(),
          tensorFlow: typeof tf !== 'undefined'
        }
      };

      capabilitiesCache = capabilities;
      logger.info('[Introspector] Capabilities detected');
      return capabilities;
    };

    // Helper: Detect WebGL
    const detectWebGL = () => {
      try {
        const canvas = document.createElement('canvas');
        return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
      } catch (e) {
        return false;
      }
    };

    // Helper: Check if Pyodide is available or loadable
    const checkPyodideAvailable = () => {
      return typeof loadPyodide !== 'undefined' || window.pyodide !== undefined;
    };

    // Helper: Check if WebLLM is available
    const checkWebLLMAvailable = () => {
      return typeof WebLLM !== 'undefined' || window.WebLLM !== undefined;
    };

    // Generate a comprehensive self-analysis report
    const generateSelfReport = async () => {
      logger.info('[Introspector] Generating comprehensive self-analysis report');

      const moduleGraph = await getModuleGraph();
      const toolCatalog = await getToolCatalog();
      const capabilities = getCapabilities();

      let report = `# REPLOID Self-Analysis Report\n\n`;
      report += `**Generated:** ${new Date().toISOString()}\n\n`;

      // Module Architecture
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

      // Tool Capabilities
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

      // Browser Capabilities
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

      // Memory
      if (capabilities.performance.memory.available) {
        const mem = capabilities.performance.memory;
        report += `### Memory\n`;
        report += `- **Heap Limit:** ${(mem.jsHeapSizeLimit / 1024 / 1024).toFixed(2)} MB\n`;
        report += `- **Total Heap:** ${(mem.totalJSHeapSize / 1024 / 1024).toFixed(2)} MB\n`;
        report += `- **Used Heap:** ${(mem.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB\n`;
        report += `- **Usage:** ${((mem.usedJSHeapSize / mem.jsHeapSizeLimit) * 100).toFixed(1)}%\n\n`;
      }

      // Experimental
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

    // Clear all caches
    const clearCache = () => {
      moduleGraphCache = null;
      toolCatalogCache = null;
      capabilitiesCache = null;
      logger.info('[Introspector] Caches cleared');
    };

    // Widget interface
    const widget = (() => {
      class IntrospectorWidget extends HTMLElement {
        constructor() {
          super();
          this.attachShadow({ mode: 'open' });
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
          const graph = await getModuleGraph();
          const catalog = await getToolCatalog();

          return {
            state: 'idle',
            primaryMetric: `${graph.modules.length} modules`,
            secondaryMetric: `${catalog.tools.length} tools`,
            lastActivity: null,
            message: null
          };
        }

        async render() {
          const graph = await getModuleGraph();
          const catalog = await getToolCatalog();
          const capabilities = await getCapabilities();

          const categoryStats = Object.entries(graph.statistics.byCategory || {})
            .sort((a, b) => b[1] - a[1]);

          this.shadowRoot.innerHTML = `
            <style>
              :host {
                display: block;
                font-family: monospace;
                color: #e0e0e0;
              }
              .introspector-panel {
                padding: 12px;
                background: #1a1a1a;
                border-radius: 4px;
              }
              .controls {
                margin-bottom: 12px;
                display: flex;
                gap: 8px;
              }
              button {
                padding: 6px 12px;
                background: #333;
                color: #e0e0e0;
                border: 1px solid #555;
                border-radius: 3px;
                cursor: pointer;
                font-family: monospace;
                font-size: 11px;
              }
              button:hover {
                background: #444;
              }
              h4 {
                color: #0ff;
                margin: 0 0 10px 0;
                font-size: 14px;
              }
              .intro-stats {
                display: grid;
                grid-template-columns: 1fr 1fr 1fr;
                gap: 10px;
                margin-bottom: 20px;
              }
              .stat-card {
                padding: 10px;
                border-radius: 5px;
              }
              .stat-card div:first-child {
                color: #888;
                font-size: 11px;
              }
              .stat-card div:last-child {
                font-size: 20px;
                font-weight: bold;
              }
              .categories, .capabilities {
                margin-bottom: 20px;
              }
              .category-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 8px;
              }
              .category-item {
                padding: 8px;
                background: rgba(255,255,255,0.03);
                border-radius: 3px;
                display: flex;
                justify-content: space-between;
                font-size: 12px;
              }
              .capability-list {
                font-size: 12px;
                line-height: 1.8;
              }
              .capability-item {
                padding: 4px;
              }
            </style>
            <div class="introspector-panel">
              <div class="controls">
                <button class="generate-report">☷ Generate Report</button>
                <button class="clear-cache">⛶ Clear Cache</button>
              </div>

              <div class="intro-stats">
                <div class="stat-card" style="background: rgba(0,255,255,0.1);">
                  <div>Modules</div>
                  <div style="color: #0ff;">${graph.modules.length}</div>
                </div>
                <div class="stat-card" style="background: rgba(156,39,176,0.1);">
                  <div>Tools</div>
                  <div style="color: #9c27b0;">${catalog.tools.length}</div>
                </div>
                <div class="stat-card" style="background: rgba(76,175,80,0.1);">
                  <div>Dependencies</div>
                  <div style="color: #4caf50;">${graph.edges.length}</div>
                </div>
              </div>

              <div class="categories">
                <h4>Module Categories</h4>
                <div class="category-grid">
                  ${categoryStats.map(([cat, count]) => `
                    <div class="category-item">
                      <span style="color: #ccc;">${cat}</span>
                      <span style="font-weight: bold; color: #0ff;">${count}</span>
                    </div>
                  `).join('')}
                </div>
              </div>

              <div class="capabilities">
                <h4>System Capabilities</h4>
                <div class="capability-list">
                  ${Object.entries(capabilities).map(([cap, enabled]) => `
                    <div class="capability-item" style="color: ${enabled ? '#4caf50' : '#666'};">
                      ${enabled ? '✓' : '○'} ${cap}
                    </div>
                  `).join('')}
                </div>
              </div>
            </div>
          `;

          // Attach event listeners
          this.shadowRoot.querySelector('.generate-report')?.addEventListener('click', async () => {
            const report = await generateSelfReport();
            console.log('[Introspector] Self-report:', report);
            if (typeof EventBus !== 'undefined') {
              EventBus.emit('toast:success', { message: 'Self-report generated (see console)' });
            }
          });

          this.shadowRoot.querySelector('.clear-cache')?.addEventListener('click', () => {
            clearCache();
            if (typeof EventBus !== 'undefined') {
              EventBus.emit('toast:success', { message: 'Cache cleared' });
            }
          });
        }
      }

      if (!customElements.get('introspector-widget')) {
        customElements.define('introspector-widget', IntrospectorWidget);
      }

      return {
        element: 'introspector-widget',
        displayName: 'Introspector',
        icon: '⌕',
        category: 'rsi',
        order: 80
      };
    })();

    return {
      init,
      api: {
        getModuleGraph,
        getToolCatalog,
        analyzeOwnCode,
        getCapabilities,
        generateSelfReport,
        clearCache
      },
      widget
    };
  }
};

// Export standardized module
export default Introspector;
