/**
 * @fileoverview Tool Documentation Generator for REPLOID
 * Automatically generates markdown documentation from tool schemas.
 * Provides comprehensive reference docs for all available tools.
 *
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

    /**
     * Initialize tool documentation generator
     */
    const init = async () => {
      logger.info('[ToolDocGen] Tool documentation generator ready');
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
      const badge = category === 'read' ? '🔍 Read' : '✏️ Write';
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

    return {
      init,
      api: {
        generateDocs,
        generateSummary,
        generateByCategory,
        saveDocs,
        generateAndSave,
        getStats
      }
    };
  }
};

// Export
ToolDocGenerator;
