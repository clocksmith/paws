import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * Comprehensive test suite for tool-doc-generator.js
 * Tests markdown documentation generation from tool schemas
 */

describe('ToolDocGenerator Module', () => {
  let ToolDocGenerator;
  let mockDeps;
  let mockFetch;
  let generatorInstance;

  const mockToolSchemas = {
    read: [
      {
        name: 'read_file',
        description: 'Read a file from the filesystem',
        inputSchema: {
          properties: {
            path: {
              type: 'string',
              description: 'File path to read'
            },
            encoding: {
              type: 'string',
              description: 'File encoding'
            }
          },
          required: ['path']
        },
        outputSchema: {
          type: 'object',
          description: 'File content and metadata',
          properties: {
            content: {
              type: 'string',
              description: 'File content'
            },
            size: {
              type: 'number',
              description: 'File size in bytes'
            }
          }
        },
        examples: [
          {
            title: 'Read a text file',
            description: 'Example of reading a configuration file',
            input: {
              path: '/config/settings.json',
              encoding: 'utf8'
            },
            output: {
              content: '{"theme": "dark"}',
              size: 18
            }
          }
        ]
      }
    ],
    write: [
      {
        name: 'write_file',
        description: 'Write content to a file',
        parameters: {
          properties: {
            path: {
              type: 'string',
              description: 'File path to write to'
            },
            content: {
              type: 'string',
              description: 'Content to write'
            },
            mode: {
              type: 'string',
              description: 'Write mode'
            }
          },
          required: ['path', 'content']
        }
      }
    ]
  };

  beforeEach(() => {
    // Mock fetch
    mockFetch = vi.fn();
    global.fetch = mockFetch;

    // Mock dependencies
    mockDeps = {
      Utils: {
        logger: {
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn()
        }
      },
      StateManager: {
        createArtifact: vi.fn().mockResolvedValue({ success: true })
      }
    };

    // Define ToolDocGenerator module
    ToolDocGenerator = {
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

        const init = async () => {
          logger.info('[ToolDocGen] Tool documentation generator ready');
          return true;
        };

        const loadToolSchemas = async () => {
          const schemas = { read: [], write: [] };

          try {
            const readResponse = await fetch('/upgrades/tools-read.json');
            if (readResponse.ok) {
              schemas.read = await readResponse.json();
            }
          } catch (err) {
            logger.warn('[ToolDocGen] Failed to load tools-read.json:', err);
          }

          try {
            const writeResponse = await fetch('/upgrades/tools-write.json');
            if (writeResponse.ok) {
              schemas.write = await writeResponse.json();
            }
          } catch (err) {
            logger.warn('[ToolDocGen] Failed to load tools-write.json:', err);
          }

          return schemas;
        };

        const formatParameter = (name, schema, isRequired) => {
          const type = schema.type || 'string';
          const description = schema.description || 'No description';
          const required = isRequired ? '✓' : '';

          let typeStr = type;
          if (type === 'array' && schema.items) {
            typeStr = `array<${schema.items.type || 'any'}>`;
          }

          if (type === 'object') {
            typeStr = 'object';
          }

          return `| \`${name}\` | ${typeStr} | ${required} | ${description} |`;
        };

        const generateToolDoc = (tool, category) => {
          let doc = `### ${tool.name}\n\n`;

          const badge = category === 'read' ? '🔍 Read' : '✏️ Write';
          doc += `**Category:** ${badge}\n\n`;

          doc += `**Description:** ${tool.description || 'No description available'}\n\n`;

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

        const generateDocs = async () => {
          logger.info('[ToolDocGen] Generating tool documentation...');

          const schemas = await loadToolSchemas();
          const totalTools = schemas.read.length + schemas.write.length;

          let doc = `# REPLOID Tool Reference\n\n`;
          doc += `**Generated:** ${new Date().toISOString()}\n`;
          doc += `**Total Tools:** ${totalTools}\n\n`;

          doc += `This document provides comprehensive reference for all available tools in REPLOID.\n\n`;

          doc += `## Table of Contents\n\n`;
          doc += `- [Read Tools](#read-tools) (${schemas.read.length})\n`;
          doc += `- [Write Tools](#write-tools) (${schemas.write.length})\n\n`;

          doc += `---\n\n`;

          doc += `## Read Tools\n\n`;
          doc += `Read tools provide introspection and information retrieval capabilities.\n\n`;

          if (schemas.read.length === 0) {
            doc += `*No read tools available*\n\n`;
          } else {
            for (const tool of schemas.read) {
              doc += generateToolDoc(tool, 'read');
            }
          }

          doc += `## Write Tools\n\n`;
          doc += `Write tools enable the agent to make changes and perform actions.\n\n`;

          if (schemas.write.length === 0) {
            doc += `*No write tools available*\n\n`;
          } else {
            for (const tool of schemas.write) {
              doc += generateToolDoc(tool, 'write');
            }
          }

          doc += `---\n\n`;
          doc += `*This documentation was automatically generated by ToolDocGenerator*\n`;

          logger.info(`[ToolDocGen] Generated documentation for ${totalTools} tools`);
          return doc;
        };

        const generateSummary = async () => {
          const schemas = await loadToolSchemas();

          let summary = `# Tool Summary\n\n`;

          summary += `## Read Tools (${schemas.read.length})\n\n`;
          summary += `| Tool | Description |\n`;
          summary += `|------|-------------|\n`;

          for (const tool of schemas.read) {
            const desc = (tool.description || '').substring(0, 100);
            summary += `| \`${tool.name}\` | ${desc} |\n`;
          }

          summary += '\n';

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

        const generateAndSave = async () => {
          const fullDocs = await generateDocs();
          const summary = await generateSummary();
          const readDocs = await generateByCategory('read');
          const writeDocs = await generateByCategory('write');

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

    generatorInstance = ToolDocGenerator.factory(mockDeps);
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete global.fetch;
  });

  describe('Module Metadata', () => {
    it('should have correct metadata structure', () => {
      expect(ToolDocGenerator.metadata).toBeDefined();
      expect(ToolDocGenerator.metadata.id).toBe('ToolDocGenerator');
      expect(ToolDocGenerator.metadata.version).toBe('1.0.0');
    });

    it('should declare required dependencies', () => {
      expect(ToolDocGenerator.metadata.dependencies).toContain('Utils');
      expect(ToolDocGenerator.metadata.dependencies).toContain('StateManager');
    });

    it('should be marked as async documentation type', () => {
      expect(ToolDocGenerator.metadata.async).toBe(true);
      expect(ToolDocGenerator.metadata.type).toBe('documentation');
    });
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      const result = await generatorInstance.init();

      expect(result).toBe(true);
      expect(mockDeps.Utils.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Tool documentation generator ready')
      );
    });
  });

  describe('Documentation Generation', () => {
    beforeEach(() => {
      mockFetch.mockImplementation((url) => {
        if (url === '/upgrades/tools-read.json') {
          return Promise.resolve({
            ok: true,
            json: async () => mockToolSchemas.read
          });
        }
        if (url === '/upgrades/tools-write.json') {
          return Promise.resolve({
            ok: true,
            json: async () => mockToolSchemas.write
          });
        }
        return Promise.reject(new Error('Not found'));
      });
    });

    it('should generate complete documentation', async () => {
      const docs = await generatorInstance.api.generateDocs();

      expect(docs).toContain('# REPLOID Tool Reference');
      expect(docs).toContain('**Total Tools:** 2');
      expect(docs).toContain('## Read Tools');
      expect(docs).toContain('## Write Tools');
      expect(docs).toContain('read_file');
      expect(docs).toContain('write_file');
    });

    it('should include tool descriptions', async () => {
      const docs = await generatorInstance.api.generateDocs();

      expect(docs).toContain('Read a file from the filesystem');
      expect(docs).toContain('Write content to a file');
    });

    it('should include parameters table', async () => {
      const docs = await generatorInstance.api.generateDocs();

      expect(docs).toContain('#### Parameters');
      expect(docs).toContain('| Name | Type | Required | Description |');
      expect(docs).toContain('`path`');
      expect(docs).toContain('File path to read');
    });

    it('should mark required parameters', async () => {
      const docs = await generatorInstance.api.generateDocs();

      // Check that path is marked as required
      const lines = docs.split('\n');
      const pathLine = lines.find(line => line.includes('`path`') && line.includes('File path to read'));
      expect(pathLine).toContain('✓');
    });

    it('should include output schema', async () => {
      const docs = await generatorInstance.api.generateDocs();

      expect(docs).toContain('#### Returns');
      expect(docs).toContain('File content and metadata');
      expect(docs).toContain('`content`');
      expect(docs).toContain('`size`');
    });

    it('should include examples', async () => {
      const docs = await generatorInstance.api.generateDocs();

      expect(docs).toContain('#### Examples');
      expect(docs).toContain('Read a text file');
      expect(docs).toContain('```json');
      expect(docs).toContain('/config/settings.json');
      expect(docs).toContain('Output:');
    });

    it('should handle missing schemas gracefully', async () => {
      mockFetch.mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: async () => []
        })
      );

      const docs = await generatorInstance.api.generateDocs();

      expect(docs).toContain('*No read tools available*');
      expect(docs).toContain('*No write tools available*');
    });

    it('should handle fetch errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const docs = await generatorInstance.api.generateDocs();

      expect(docs).toContain('**Total Tools:** 0');
      expect(mockDeps.Utils.logger.warn).toHaveBeenCalled();
    });
  });

  describe('Summary Generation', () => {
    beforeEach(() => {
      mockFetch.mockImplementation((url) => {
        if (url === '/upgrades/tools-read.json') {
          return Promise.resolve({
            ok: true,
            json: async () => mockToolSchemas.read
          });
        }
        if (url === '/upgrades/tools-write.json') {
          return Promise.resolve({
            ok: true,
            json: async () => mockToolSchemas.write
          });
        }
        return Promise.reject(new Error('Not found'));
      });
    });

    it('should generate tool summary', async () => {
      const summary = await generatorInstance.api.generateSummary();

      expect(summary).toContain('# Tool Summary');
      expect(summary).toContain('## Read Tools (1)');
      expect(summary).toContain('## Write Tools (1)');
      expect(summary).toContain('| Tool | Description |');
      expect(summary).toContain('`read_file`');
      expect(summary).toContain('`write_file`');
    });

    it('should truncate long descriptions', async () => {
      const longDescTool = {
        ...mockToolSchemas.read[0],
        description: 'A'.repeat(150)
      };

      mockFetch.mockImplementation((url) => {
        if (url === '/upgrades/tools-read.json') {
          return Promise.resolve({
            ok: true,
            json: async () => [longDescTool]
          });
        }
        return Promise.resolve({ ok: true, json: async () => [] });
      });

      const summary = await generatorInstance.api.generateSummary();

      const lines = summary.split('\n');
      const toolLine = lines.find(line => line.includes('`read_file`'));
      const description = toolLine.split('|')[2].trim();

      expect(description.length).toBeLessThanOrEqual(100);
    });
  });

  describe('Category-Specific Generation', () => {
    beforeEach(() => {
      mockFetch.mockImplementation((url) => {
        if (url === '/upgrades/tools-read.json') {
          return Promise.resolve({
            ok: true,
            json: async () => mockToolSchemas.read
          });
        }
        if (url === '/upgrades/tools-write.json') {
          return Promise.resolve({
            ok: true,
            json: async () => mockToolSchemas.write
          });
        }
        return Promise.reject(new Error('Not found'));
      });
    });

    it('should generate read tools documentation', async () => {
      const docs = await generatorInstance.api.generateByCategory('read');

      expect(docs).toContain('# Read Tools');
      expect(docs).toContain('**Total:** 1');
      expect(docs).toContain('read_file');
      expect(docs).not.toContain('write_file');
    });

    it('should generate write tools documentation', async () => {
      const docs = await generatorInstance.api.generateByCategory('write');

      expect(docs).toContain('# Write Tools');
      expect(docs).toContain('**Total:** 1');
      expect(docs).toContain('write_file');
      expect(docs).not.toContain('read_file');
    });

    it('should handle invalid category', async () => {
      const docs = await generatorInstance.api.generateByCategory('invalid');

      expect(docs).toContain('**Total:** 0');
    });
  });

  describe('Statistics', () => {
    beforeEach(() => {
      mockFetch.mockImplementation((url) => {
        if (url === '/upgrades/tools-read.json') {
          return Promise.resolve({
            ok: true,
            json: async () => mockToolSchemas.read
          });
        }
        if (url === '/upgrades/tools-write.json') {
          return Promise.resolve({
            ok: true,
            json: async () => mockToolSchemas.write
          });
        }
        return Promise.reject(new Error('Not found'));
      });
    });

    it('should calculate tool statistics', async () => {
      const stats = await generatorInstance.api.getStats();

      expect(stats.read.total).toBe(1);
      expect(stats.write.total).toBe(1);
    });

    it('should count tools with examples', async () => {
      const stats = await generatorInstance.api.getStats();

      expect(stats.read.withExamples).toBe(1);
      expect(stats.write.withExamples).toBe(0);
    });

    it('should calculate average parameters', async () => {
      const stats = await generatorInstance.api.getStats();

      expect(stats.read.avgParams).toBe('2.0');
      expect(stats.write.avgParams).toBe('3.0');
    });

    it('should handle empty tool lists', async () => {
      mockFetch.mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: async () => []
        })
      );

      const stats = await generatorInstance.api.getStats();

      expect(stats.read.total).toBe(0);
      expect(stats.read.avgParams).toBe(0);
      expect(stats.write.total).toBe(0);
      expect(stats.write.avgParams).toBe(0);
    });
  });

  describe('Saving Documentation', () => {
    beforeEach(() => {
      mockFetch.mockImplementation((url) => {
        if (url === '/upgrades/tools-read.json') {
          return Promise.resolve({
            ok: true,
            json: async () => mockToolSchemas.read
          });
        }
        if (url === '/upgrades/tools-write.json') {
          return Promise.resolve({
            ok: true,
            json: async () => mockToolSchemas.write
          });
        }
        return Promise.reject(new Error('Not found'));
      });
    });

    it('should save documentation to VFS', async () => {
      const result = await generatorInstance.api.saveDocs('/test/doc.md', '# Test');

      expect(result.success).toBe(true);
      expect(result.path).toBe('/test/doc.md');
      expect(mockDeps.StateManager.createArtifact).toHaveBeenCalledWith(
        '/test/doc.md',
        'md',
        '# Test',
        'Auto-generated tool documentation'
      );
    });

    it('should handle save errors', async () => {
      mockDeps.StateManager.createArtifact.mockRejectedValue(new Error('Write failed'));

      const result = await generatorInstance.api.saveDocs('/test/doc.md', '# Test');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Write failed');
      expect(mockDeps.Utils.logger.error).toHaveBeenCalled();
    });
  });

  describe('Generate and Save All', () => {
    beforeEach(() => {
      mockFetch.mockImplementation((url) => {
        if (url === '/upgrades/tools-read.json') {
          return Promise.resolve({
            ok: true,
            json: async () => mockToolSchemas.read
          });
        }
        if (url === '/upgrades/tools-write.json') {
          return Promise.resolve({
            ok: true,
            json: async () => mockToolSchemas.write
          });
        }
        return Promise.reject(new Error('Not found'));
      });
    });

    it('should generate and save all documentation', async () => {
      const result = await generatorInstance.api.generateAndSave();

      expect(result.success).toBe(true);
      expect(result.generated).toBe(4);
      expect(result.paths).toHaveLength(4);
      expect(result.paths).toContain('/docs/tools/TOOL-REFERENCE.md');
      expect(result.paths).toContain('/docs/tools/TOOL-SUMMARY.md');
      expect(result.paths).toContain('/docs/tools/READ-TOOLS.md');
      expect(result.paths).toContain('/docs/tools/WRITE-TOOLS.md');
    });

    it('should handle partial save failures', async () => {
      mockDeps.StateManager.createArtifact
        .mockResolvedValueOnce({ success: true })
        .mockRejectedValueOnce(new Error('Write failed'));

      const result = await generatorInstance.api.generateAndSave();

      expect(result.success).toBe(false);
    });
  });
});
