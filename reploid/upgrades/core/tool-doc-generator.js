/**
 * @fileoverview Tool Documentation Generator for REPLOID
 * Automatically generates markdown documentation from tool schemas.
 * Provides comprehensive reference docs for all available tools.
 *
 * @blueprint 0x00003B - Generates tool documentation from schemas.
 * @module ToolDocGenerator
 * @version 1.0.0
 * @category documentation
 */

const ToolDocGenerator = {
  metadata: {
    id: 'ToolDocGenerator',
    version: '1.0.0',
    dependencies: ['Utils', 'StateManager'],
    async: true,
    type: 'documentation'
  },

  factory: (deps) => {
    const { Utils, StateManager } = deps;
    const { logger } = Utils;

    // Widget tracking state
    const _generationHistory = [];
    let _lastGeneration = null;
    let _cachedStats = null;

    /**
     * Initialize tool documentation generator
     */
    const init = async () => {
      logger.info('[ToolDocGen] Tool documentation generator ready');

      // Load initial stats
      _cachedStats = await getStats();

      return true;
    };

    /**
     * Load tool schemas from JSON files
     */
    const loadToolSchemas = async () => {
      const schemas = { read: [], write: [] };

      try {
        // Load read tools
        const readResponse = await fetch('/upgrades/tools-read.json');
        if (readResponse.ok) {
          schemas.read = await readResponse.json();
        }
      } catch (err) {
        logger.warn('[ToolDocGen] Failed to load tools-read.json:', err);
      }

      try {
        // Load write tools
        const writeResponse = await fetch('/upgrades/tools-write.json');
        if (writeResponse.ok) {
          schemas.write = await writeResponse.json();
        }
      } catch (err) {
        logger.warn('[ToolDocGen] Failed to load tools-write.json:', err);
      }

      return schemas;
    };

    /**
     * Format parameter schema as table row
     * @param {string} name - Parameter name
     * @param {Object} schema - Parameter schema
     * @param {boolean} isRequired - Whether parameter is required
     * @returns {string} Markdown table row
     */
    const formatParameter = (name, schema, isRequired) => {
      const type = schema.type || 'string';
      const description = schema.description || 'No description';
      const required = isRequired ? '✓' : '';

      // Handle array types
      let typeStr = type;
      if (type === 'array' && schema.items) {
        typeStr = `array<${schema.items.type || 'any'}>`;
      }

      // Handle object types
      if (type === 'object') {
        typeStr = 'object';
      }

      return `| \`${name}\` | ${typeStr} | ${required} | ${description} |`;
    };

    /**
     * Generate documentation for a single tool
     * @param {Object} tool - Tool schema
     * @param {string} category - Tool category (read/write)
     * @returns {string} Markdown documentation
     */
    const generateToolDoc = (tool, category) => {
      let doc = `### ${tool.name}\n\n`;

      // Category badge
      const badge = category === 'read' ? '⌕ Read' : '✏️ Write';
      doc += `**Category:** ${badge}\n\n`;

      // Description
      doc += `**Description:** ${tool.description || 'No description available'}\n\n`;

      // Input schema
      if (tool.inputSchema || tool.parameters) {
        const schema = tool.inputSchema || tool.parameters;

        doc += `#### Parameters\n\n`;
        doc += `| Name | Type | Required | Description |\n`;
        doc += `|------|------|----------|-------------|\n`;

        const properties = schema.properties || {};
        const required = schema.required || [];

        for (const [name, propSchema] of Object.entries(properties)) {
          doc += formatParameter(name, propSchema, required.includes(name)) + '\n';
        }

        doc += '\n';
      }

      // Output schema
      if (tool.outputSchema) {
        doc += `#### Returns\n\n`;
        doc += `**Type:** ${tool.outputSchema.type || 'object'}\n\n`;

        if (tool.outputSchema.description) {
          doc += `${tool.outputSchema.description}\n\n`;
        }

        if (tool.outputSchema.properties) {
          doc += `| Property | Type | Description |\n`;
          doc += `|----------|------|-------------|\n`;

          for (const [name, propSchema] of Object.entries(tool.outputSchema.properties)) {
            const type = propSchema.type || 'any';
            const description = propSchema.description || '';
            doc += `| \`${name}\` | ${type} | ${description} |\n`;
          }

          doc += '\n';
        }
      }

      // Examples
      if (tool.examples && tool.examples.length > 0) {
        doc += `#### Examples\n\n`;

        for (const example of tool.examples) {
          doc += `**${example.title || 'Example'}**\n\n`;

          if (example.description) {
            doc += `${example.description}\n\n`;
          }

          doc += '```json\n';
          doc += JSON.stringify(example.input, null, 2);
          doc += '\n```\n\n';

          if (example.output) {
            doc += 'Output:\n\n';
            doc += '```json\n';
            doc += JSON.stringify(example.output, null, 2);
            doc += '\n```\n\n';
          }
        }
      }

      doc += '---\n\n';
      return doc;
    };

    /**
     * Generate complete tool documentation
     * @returns {Promise<string>} Complete markdown documentation
     */
    const generateDocs = async () => {
      logger.info('[ToolDocGen] Generating tool documentation...');

      const schemas = await loadToolSchemas();
      const totalTools = schemas.read.length + schemas.write.length;

      let doc = `# REPLOID Tool Reference\n\n`;
      doc += `**Generated:** ${new Date().toISOString()}\n`;
      doc += `**Total Tools:** ${totalTools}\n\n`;

      doc += `This document provides comprehensive reference for all available tools in REPLOID.\n\n`;

      // Table of contents
      doc += `## Table of Contents\n\n`;
      doc += `- [Read Tools](#read-tools) (${schemas.read.length})\n`;
      doc += `- [Write Tools](#write-tools) (${schemas.write.length})\n\n`;

      doc += `---\n\n`;

      // Read tools section
      doc += `## Read Tools\n\n`;
      doc += `Read tools provide introspection and information retrieval capabilities.\n\n`;

      if (schemas.read.length === 0) {
        doc += `*No read tools available*\n\n`;
      } else {
        for (const tool of schemas.read) {
          doc += generateToolDoc(tool, 'read');
        }
      }

      // Write tools section
      doc += `## Write Tools\n\n`;
      doc += `Write tools enable the agent to make changes and perform actions.\n\n`;

      if (schemas.write.length === 0) {
        doc += `*No write tools available*\n\n`;
      } else {
        for (const tool of schemas.write) {
          doc += generateToolDoc(tool, 'write');
        }
      }

      // Footer
      doc += `---\n\n`;
      doc += `*This documentation was automatically generated by ToolDocGenerator*\n`;

      logger.info(`[ToolDocGen] Generated documentation for ${totalTools} tools`);
      return doc;
    };

    /**
     * Generate summary table of all tools
     * @returns {Promise<string>} Markdown summary table
     */
    const generateSummary = async () => {
      const schemas = await loadToolSchemas();

      let summary = `# Tool Summary\n\n`;

      // Read tools table
      summary += `## Read Tools (${schemas.read.length})\n\n`;
      summary += `| Tool | Description |\n`;
      summary += `|------|-------------|\n`;

      for (const tool of schemas.read) {
        const desc = (tool.description || '').substring(0, 100);
        summary += `| \`${tool.name}\` | ${desc} |\n`;
      }

      summary += '\n';

      // Write tools table
      summary += `## Write Tools (${schemas.write.length})\n\n`;
      summary += `| Tool | Description |\n`;
      summary += `|------|-------------|\n`;

      for (const tool of schemas.write) {
        const desc = (tool.description || '').substring(0, 100);
        summary += `| \`${tool.name}\` | ${desc} |\n`;
      }

      summary += '\n';

      return summary;
    };

    /**
     * Generate tool documentation by category
     * @param {string} category - Category to generate (read/write)
     * @returns {Promise<string>} Markdown documentation for category
     */
    const generateByCategory = async (category) => {
      const schemas = await loadToolSchemas();
      const tools = schemas[category] || [];

      let doc = `# ${category === 'read' ? 'Read' : 'Write'} Tools\n\n`;
      doc += `**Total:** ${tools.length}\n\n`;

      for (const tool of tools) {
        doc += generateToolDoc(tool, category);
      }

      return doc;
    };

    /**
     * Save documentation to VFS
     * @param {string} path - VFS path to save to
     * @param {string} content - Documentation content
     */
    const saveDocs = async (path, content) => {
      try {
        await StateManager.createArtifact(
          path,
          'md',
          content,
          'Auto-generated tool documentation'
        );
        logger.info(`[ToolDocGen] Saved documentation to ${path}`);
        return { success: true, path };
      } catch (err) {
        logger.error('[ToolDocGen] Failed to save documentation:', err);
        return { success: false, error: err.message };
      }
    };

    /**
     * Generate and save complete documentation
     * @returns {Promise<Object>} Result with paths
     */
    const generateAndSave = async () => {
      const timestamp = new Date().toISOString().split('T')[0];
      const generationStart = Date.now();

      // Generate all docs
      const fullDocs = await generateDocs();
      const summary = await generateSummary();
      const readDocs = await generateByCategory('read');
      const writeDocs = await generateByCategory('write');

      // Save to VFS
      const results = await Promise.all([
        saveDocs(`/docs/tools/TOOL-REFERENCE.md`, fullDocs),
        saveDocs(`/docs/tools/TOOL-SUMMARY.md`, summary),
        saveDocs(`/docs/tools/READ-TOOLS.md`, readDocs),
        saveDocs(`/docs/tools/WRITE-TOOLS.md`, writeDocs)
      ]);

      const success = results.every(r => r.success);
      const duration = Date.now() - generationStart;

      // Track generation
      const generation = {
        timestamp: Date.now(),
        success,
        duration,
        filesGenerated: results.length,
        paths: results.map(r => r.path).filter(p => p)
      };

      _lastGeneration = generation;
      _generationHistory.push(generation);
      if (_generationHistory.length > 20) _generationHistory.shift();

      // Update cached stats
      _cachedStats = await getStats();

      return {
        success,
        generated: results.length,
        paths: results.map(r => r.path).filter(p => p)
      };
    };

    /**
     * Get tool statistics
     * @returns {Promise<Object>} Tool statistics
     */
    const getStats = async () => {
      const schemas = await loadToolSchemas();

      const stats = {
        read: {
          total: schemas.read.length,
          withExamples: schemas.read.filter(t => t.examples?.length > 0).length,
          avgParams: 0
        },
        write: {
          total: schemas.write.length,
          withExamples: schemas.write.filter(t => t.examples?.length > 0).length,
          avgParams: 0
        }
      };

      // Calculate average parameters
      if (schemas.read.length > 0) {
        const totalParams = schemas.read.reduce((sum, t) => {
          const schema = t.inputSchema || t.parameters || {};
          return sum + Object.keys(schema.properties || {}).length;
        }, 0);
        stats.read.avgParams = (totalParams / schemas.read.length).toFixed(1);
      }

      if (schemas.write.length > 0) {
        const totalParams = schemas.write.reduce((sum, t) => {
          const schema = t.inputSchema || t.parameters || {};
          return sum + Object.keys(schema.properties || {}).length;
        }, 0);
        stats.write.avgParams = (totalParams / schemas.write.length).toFixed(1);
      }

      return stats;
    };

    // Web Component Widget (INSIDE factory closure to access state)
    class ToolDocGeneratorWidget extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: 'open' });
      }

      set moduleApi(api) {
        this._api = api;
        this.render();
      }

      connectedCallback() {
        this.render();
      }

      disconnectedCallback() {
        // No auto-refresh for this widget
      }

      getStatus() {
        const stats = _cachedStats || { read: { total: 0 }, write: { total: 0 } };
        const totalTools = stats.read.total + stats.write.total;

        return {
          state: _lastGeneration ? 'idle' : 'idle',
          primaryMetric: `${totalTools} tools`,
          secondaryMetric: _lastGeneration ? 'Generated' : 'Ready',
          lastActivity: _lastGeneration ? _lastGeneration.timestamp : null,
          message: _lastGeneration ? `${_lastGeneration.filesGenerated} files` : 'No docs yet'
        };
      }

      renderPanel() {
        const stats = _cachedStats || { read: { total: 0, withExamples: 0, avgParams: 0 }, write: { total: 0, withExamples: 0, avgParams: 0 } };
        const totalTools = stats.read.total + stats.write.total;
        const totalWithExamples = stats.read.withExamples + stats.write.withExamples;

        return `
          <h3>☱ Tool Statistics</h3>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-top: 12px;">
            <div style="padding: 12px; background: rgba(100,150,255,0.1); border-radius: 4px;">
              <div style="font-size: 0.85em; color: #888;">Total Tools</div>
              <div style="font-size: 1.3em; font-weight: bold;">${totalTools}</div>
            </div>
            <div style="padding: 12px; background: rgba(0,200,100,0.1); border-radius: 4px;">
              <div style="font-size: 0.85em; color: #888;">With Examples</div>
              <div style="font-size: 1.3em; font-weight: bold;">${totalWithExamples}</div>
            </div>
          </div>

          <h3 style="margin-top: 20px;">⌕ Read Tools</h3>
          <div style="margin-top: 12px; padding: 10px; background: rgba(255,255,255,0.05); border-radius: 4px;">
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;">
              <div>
                <div style="font-size: 0.85em; color: #888;">Total</div>
                <div style="font-weight: bold;">${stats.read.total}</div>
              </div>
              <div>
                <div style="font-size: 0.85em; color: #888;">With Examples</div>
                <div style="font-weight: bold;">${stats.read.withExamples}</div>
              </div>
              <div>
                <div style="font-size: 0.85em; color: #888;">Avg Params</div>
                <div style="font-weight: bold;">${stats.read.avgParams}</div>
              </div>
            </div>
          </div>

          <h3 style="margin-top: 20px;">✏️ Write Tools</h3>
          <div style="margin-top: 12px; padding: 10px; background: rgba(255,255,255,0.05); border-radius: 4px;">
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;">
              <div>
                <div style="font-size: 0.85em; color: #888;">Total</div>
                <div style="font-weight: bold;">${stats.write.total}</div>
              </div>
              <div>
                <div style="font-size: 0.85em; color: #888;">With Examples</div>
                <div style="font-weight: bold;">${stats.write.withExamples}</div>
              </div>
              <div>
                <div style="font-size: 0.85em; color: #888;">Avg Params</div>
                <div style="font-weight: bold;">${stats.write.avgParams}</div>
              </div>
            </div>
          </div>

          ${_lastGeneration ? `
            <h3 style="margin-top: 20px;">⛿ Last Generation</h3>
            <div style="margin-top: 12px; padding: 12px; background: ${_lastGeneration.success ? 'rgba(0,200,100,0.1)' : 'rgba(255,0,0,0.1)'}; border-radius: 4px;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span style="font-weight: bold;">${_lastGeneration.success ? '✓ Success' : '✗ Failed'}</span>
                <span style="color: #888; font-size: 0.85em;">${new Date(_lastGeneration.timestamp).toLocaleString()}</span>
              </div>
              <div style="font-size: 0.85em; color: #aaa;">
                ${_lastGeneration.filesGenerated} files generated in ${(_lastGeneration.duration / 1000).toFixed(2)}s
              </div>
            </div>
          ` : ''}

          ${_generationHistory.length > 0 ? `
            <h3 style="margin-top: 20px;">⌚ Generation History (Last 10)</h3>
            <div style="margin-top: 12px; max-height: 200px; overflow-y: auto;">
              ${_generationHistory.slice(-10).reverse().map(gen => {
                const timeAgo = Math.floor((Date.now() - gen.timestamp) / 1000);
                const durationSec = (gen.duration / 1000).toFixed(2);

                return `
                  <div style="padding: 6px 8px; background: rgba(255,255,255,0.03); border-radius: 4px; margin-bottom: 4px; font-size: 0.85em;">
                    <div style="display: flex; justify-content: space-between;">
                      <span style="color: ${gen.success ? '#0c0' : '#ff6b6b'};">${gen.success ? '✓' : '✗'} ${gen.filesGenerated} files</span>
                      <span style="color: #666;">${durationSec}s</span>
                      <span style="color: #666;">${timeAgo}s ago</span>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          ` : ''}

          <div style="margin-top: 16px; padding: 12px; background: rgba(100,150,255,0.1); border-left: 3px solid #6496ff; border-radius: 4px;">
            <strong>◰ Documentation Generator</strong>
            <div style="margin-top: 6px; color: #aaa; font-size: 0.9em;">
              Auto-generates markdown docs from tool schemas.<br>
              Output: TOOL-REFERENCE.md, TOOL-SUMMARY.md, READ-TOOLS.md, WRITE-TOOLS.md
            </div>
          </div>

          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-top: 16px;">
            <button class="generate-docs-btn" style="padding: 10px; background: #6496ff; border: none; border-radius: 4px; color: white; font-weight: bold; cursor: pointer; font-size: 0.95em;">
              ⛿ Generate Docs
            </button>
            <button class="refresh-stats-btn" style="padding: 10px; background: #0c0; border: none; border-radius: 4px; color: white; font-weight: bold; cursor: pointer; font-size: 0.95em;">
              ↻ Refresh Stats
            </button>
          </div>
        `;
      }

      render() {
        this.shadowRoot.innerHTML = `
          <style>
            :host {
              display: block;
              font-family: system-ui, -apple-system, sans-serif;
              color: #ccc;
            }

            .widget-content {
              background: rgba(255,255,255,0.03);
              border-radius: 8px;
              padding: 16px;
            }

            h3 {
              margin: 0 0 12px 0;
              font-size: 1.1em;
              color: #fff;
            }

            button {
              transition: all 0.2s ease;
            }

            .generate-docs-btn:hover {
              background: #7ba6ff !important;
              transform: translateY(-1px);
            }

            .refresh-stats-btn:hover {
              background: #0e0 !important;
              transform: translateY(-1px);
            }

            button:active {
              transform: translateY(0);
            }
          </style>

          <div class="widget-content">
            ${this.renderPanel()}
          </div>
        `;

        // Wire up buttons
        const generateDocsBtn = this.shadowRoot.querySelector('.generate-docs-btn');
        if (generateDocsBtn) {
          generateDocsBtn.addEventListener('click', async () => {
            try {
              logger.info('[ToolDocGen] Widget: Generating documentation...');
              generateDocsBtn.disabled = true;
              generateDocsBtn.textContent = '⏳ Generating...';

              const result = await generateAndSave();
              logger.info('[ToolDocGen] Widget: Documentation generated', result);

              this.render(); // Refresh to show new generation
            } catch (error) {
              logger.error('[ToolDocGen] Widget: Failed to generate docs', error);
              this.render();
            }
          });
        }

        const refreshStatsBtn = this.shadowRoot.querySelector('.refresh-stats-btn');
        if (refreshStatsBtn) {
          refreshStatsBtn.addEventListener('click', async () => {
            try {
              refreshStatsBtn.disabled = true;
              refreshStatsBtn.textContent = '⏳ Refreshing...';

              _cachedStats = await getStats();
              logger.info('[ToolDocGen] Widget: Stats refreshed');

              this.render(); // Refresh to show new stats
            } catch (error) {
              logger.error('[ToolDocGen] Widget: Failed to refresh stats', error);
              this.render();
            }
          });
        }
      }
    }

    // Define custom element
    if (!customElements.get('tool-doc-generator-widget')) {
      customElements.define('tool-doc-generator-widget', ToolDocGeneratorWidget);
    }

    return {
      init,
      api: {
        generateDocs,
        generateSummary,
        generateByCategory,
        saveDocs,
        generateAndSave,
        getStats
      },
      widget: {
        element: 'tool-doc-generator-widget',
        displayName: 'Tool Doc Generator',
        icon: '◰',
        category: 'documentation',
        updateInterval: null
      }
    };
  }
};

// Export
export default ToolDocGenerator;
