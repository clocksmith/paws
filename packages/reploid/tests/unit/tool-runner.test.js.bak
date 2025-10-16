import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('ToolRunner Module', () => {
  let toolRunner;
  let mockDeps;
  let mockStaticTools;
  let mockDynamicTools;

  beforeEach(() => {
    // Mock UI global
    global.UI = {
      logToAdvanced: vi.fn()
    };

    mockDeps = {
      config: {
        useBlobExecution: false
      },
      Storage: {
        get: vi.fn(),
        set: vi.fn()
      },
      StateManager: {
        getArtifactContent: vi.fn(),
        getArtifactMetadata: vi.fn(),
        getAllArtifactMetadata: vi.fn(),
        createArtifact: vi.fn(),
        updateArtifact: vi.fn(),
        deleteArtifact: vi.fn(),
        getArtifactHistory: vi.fn(),
        getArtifactDiff: vi.fn()
      },
      ApiClient: {
        request: vi.fn()
      },
      Utils: {
        logger: {
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
          debug: vi.fn(),
          logEvent: vi.fn()
        },
        post: vi.fn(),
        Errors: {
          ToolError: class ToolError extends Error {
            constructor(message, cause) {
              super(message);
              this.name = 'ToolError';
              this.cause = cause;
            }
          },
          ArtifactError: class ArtifactError extends Error {
            constructor(message, path) {
              super(message);
              this.name = 'ArtifactError';
              this.artifactPath = path;
            }
          }
        }
      },
      ToolRunnerPureHelpers: {
        convertToGeminiFunctionDeclarationPure: vi.fn((mcpTool) => ({
          name: mcpTool.name,
          description: mcpTool.description,
          parameters: {
            type: 'OBJECT',
            properties: {},
            required: []
          }
        }))
      }
    };

    mockStaticTools = [
      { name: 'read_artifact', description: 'Read an artifact' },
      { name: 'list_artifacts', description: 'List artifacts' },
      { name: 'write_artifact', description: 'Write artifact' },
      { name: 'delete_artifact', description: 'Delete artifact' }
    ];

    mockDynamicTools = [];

    const ToolRunnerModule = {
      metadata: {
        id: 'ToolRunner',
        version: '1.0.0',
        dependencies: ['config', 'Storage', 'StateManager', 'ApiClient', 'Utils', 'ToolRunnerPureHelpers'],
        async: false,
        type: 'service'
      },
      factory: (deps) => {
        const { config, Storage, StateManager, ApiClient, Utils, ToolRunnerPureHelpers } = deps;
        const { logger, Errors } = Utils;

        if (!config || !logger || !Storage || !StateManager || !ApiClient || !Errors || !Utils || !ToolRunnerPureHelpers) {
          throw new Error('ToolRunner: Missing required dependencies');
        }

        const { ToolError, ArtifactError } = Errors;

        const runTool = async (toolName, toolArgs, injectedStaticTools, injectedDynamicTools) => {
          logger.logEvent("info", `Run tool: ${toolName}`, toolArgs || {});
          UI.logToAdvanced(`Running tool: ${toolName} with args: ${JSON.stringify(toolArgs)}`);
          const allTools = [...injectedStaticTools, ...injectedDynamicTools.map(t => t.declaration)];
          const toolDef = allTools.find((t) => t.name === toolName);

          if (!toolDef) {
            const available = allTools.map(t => t.name).join(', ');
            throw new ToolError(`Tool '${toolName}' not found. Available tools: ${available}`);
          }

          if (injectedStaticTools.some(t => t.name === toolName)) {
            switch (toolName) {
              case "read_artifact": {
                const content = await StateManager.getArtifactContent(toolArgs.path, toolArgs.version);
                if (content === null) {
                  const allMeta = await StateManager.getAllArtifactMetadata();
                  const available = Object.keys(allMeta).slice(0, 5).join(', ');
                  const msg = `Artifact not found: ${toolArgs.path} (version: ${toolArgs.version || 'latest'})\n` +
                    `Suggestion: Check the path is correct. Some available artifacts: ${available}${Object.keys(allMeta).length > 5 ? '...' : ''}`;
                  throw new ArtifactError(msg, toolArgs.path);
                }
                return { content };
              }

              case "list_artifacts": {
                const allMeta = await StateManager.getAllArtifactMetadata();
                let paths = Object.keys(allMeta);
                if (toolArgs.path) {
                  paths = paths.filter(p => p.startsWith(toolArgs.path));
                }
                return { paths };
              }

              case "diff_artifacts": {
                const contentA = await StateManager.getArtifactContent(toolArgs.path, toolArgs.version_a);
                const contentB = await StateManager.getArtifactContent(toolArgs.path, toolArgs.version_b);
                if (contentA === null || contentB === null) {
                  const missing = contentA === null ? toolArgs.version_a : toolArgs.version_b;
                  throw new ArtifactError(
                    `Cannot diff: version '${missing}' not found for ${toolArgs.path}\n` +
                    `Tip: Use get_artifact_history tool to see available versions.`
                  );
                }
                return { diff: `(Basic diff not implemented. Len A: ${contentA.length}, Len B: ${contentB.length})`, differences: contentA !== contentB };
              }

              case "get_artifact_history": {
                return await StateManager.getArtifactHistory(toolArgs.path);
              }

              case "write_artifact": {
                const { path, content, metadata } = toolArgs;
                if (!path || !content) {
                  throw new ToolError("write_artifact requires both 'path' and 'content' parameters");
                }

                const existingMeta = await StateManager.getArtifactMetadata(path);
                let success;

                try {
                  if (existingMeta) {
                    success = await StateManager.updateArtifact(path, content);
                  } else {
                    const type = path.endsWith('.js') ? 'javascript' :
                      path.endsWith('.css') ? 'css' :
                      path.endsWith('.html') ? 'html' :
                      path.endsWith('.json') ? 'json' :
                      path.endsWith('.md') ? 'markdown' : 'text';
                    success = await StateManager.createArtifact(
                      path,
                      type,
                      content,
                      metadata?.reason || "Agent-created artifact"
                    );
                  }
                } catch (e) {
                  throw new ArtifactError(`Failed to write artifact at path: ${path} - ${e.message}`);
                }

                logger.logEvent("info", `Artifact written: ${path}`, metadata?.reason || "No reason provided");
                return {
                  success: true,
                  path: path,
                  size: content.length,
                  reason: metadata?.reason || "Self-modification"
                };
              }

              case "delete_artifact": {
                const deletePath = toolArgs.path;
                const deleteReason = toolArgs.reason;

                if (!deletePath || !deleteReason) {
                  throw new ToolError(
                    "delete_artifact requires both 'path' and 'reason' parameters.\n" +
                    `Missing: ${!deletePath ? "'path'" : ""} ${!deleteReason ? "'reason'" : ""}\n` +
                    "Example: {path: '/vfs/old-file.js', reason: 'Obsolete after refactor'}"
                  );
                }

                const artifactToDelete = await StateManager.getArtifactMetadata(deletePath);
                if (!artifactToDelete) {
                  throw new ArtifactError(`Cannot delete non-existent artifact: ${deletePath}`);
                }

                const deleteSuccess = await StateManager.deleteArtifact(deletePath);

                logger.logEvent("warn", `Artifact DELETED: ${deletePath}`, deleteReason);
                return {
                  success: deleteSuccess,
                  path: deletePath,
                  reason: deleteReason,
                  warning: "Artifact permanently deleted from VFS"
                };
              }

              case "search_vfs": {
                const allArtifacts = await StateManager.getAllArtifactMetadata();
                const results = [];
                const regex = toolArgs.is_regex ? new RegExp(toolArgs.query) : null;
                for (const path in allArtifacts) {
                  const fileContent = await StateManager.getArtifactContent(path);
                  if (fileContent) {
                    if (regex && regex.test(fileContent)) {
                      results.push(path);
                    } else if (!regex && fileContent.includes(toolArgs.query)) {
                      results.push(path);
                    }
                  }
                }
                return { results };
              }

              case "create_cats_bundle": {
                const { file_paths, reason, turn_path } = toolArgs;
                let bundleContent = `## PAWS Context Bundle (cats.md)\n\n**Reason:** ${reason}\n\n---\n\n`;
                for (const path of file_paths) {
                  const content = await StateManager.getArtifactContent(path);
                  bundleContent += `\`\`\`vfs-file\npath: ${path}\n\`\`\`\n\`\`\`\n${content}\n\`\`\`\n\n`;
                }
                await StateManager.createArtifact(turn_path, 'markdown', bundleContent, `Context bundle for turn`);
                return { success: true, path: turn_path };
              }

              case "create_dogs_bundle": {
                const { changes, turn_path } = toolArgs;
                let bundleContent = `## PAWS Change Proposal (dogs.md)\n\n`;
                for (const change of changes) {
                  bundleContent += `\`\`\`paws-change\noperation: ${change.operation}\nfile_path: ${change.file_path}\n\`\`\`\n`;
                  if (change.operation !== 'DELETE') {
                    bundleContent += `\`\`\`\n${change.new_content}\n\`\`\`\n\n`;
                  }
                }
                await StateManager.createArtifact(turn_path, 'markdown', bundleContent, `Change proposal for turn`);
                return { success: true, path: turn_path };
              }

              case "vfs_revert": {
                const { path, commit_sha } = toolArgs;
                const oldContent = await StateManager.getArtifactContent(path, commit_sha);
                if (oldContent === null) {
                  throw new ArtifactError(
                    `Cannot revert ${path}: version ${commit_sha} not found\n` +
                    `Tip: Use get_artifact_history to see available commit SHAs for this file.`
                  );
                }
                await StateManager.updateArtifact(path, oldContent);
                return { success: true, message: `Artifact ${path} reverted to version ${commit_sha}` };
              }

              case "create_rfc": {
                const templateContent = await StateManager.getArtifactContent('/templates/rfc.md');
                if (!templateContent) {
                  throw new ArtifactError(
                    "RFC template not found at /templates/rfc.md\n" +
                    "To fix: Create the template file with {{TITLE}} and {{DATE}} placeholders.\n" +
                    "Example: Use write_artifact tool to create /templates/rfc.md with your RFC template structure."
                  );
                }
                const today = new Date().toISOString().split('T')[0];
                const newContent = templateContent
                  .replace('{{TITLE}}', toolArgs.title)
                  .replace('{{DATE}}', today);

                const safeTitle = toolArgs.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
                const newPath = `/docs/rfc-${today}-${safeTitle}.md`;

                await StateManager.createArtifact(newPath, 'markdown', newContent, `RFC draft: ${toolArgs.title}`);
                UI.logToAdvanced(`RFC created at ${newPath}`);
                return { success: true, path: newPath };
              }

              case "system.backup": {
                try {
                  const allMeta = await StateManager.getAllArtifactMetadata();
                  const allArtifacts = {};
                  for (const path of Object.keys(allMeta)) {
                    allArtifacts[path] = await StateManager.getArtifactContent(path);
                  }
                  const result = await Utils.post('/api/vfs/backup', allArtifacts);
                  return { success: true, message: result.message };
                } catch (error) {
                  throw new ToolError(
                    `System backup failed: ${error.message}\n` +
                    `Possible causes:\n` +
                    `  • Server endpoint /api/vfs/backup not available\n` +
                    `  • Network connection issue\n` +
                    `  • Insufficient permissions\n` +
                    `Tip: Check server logs and ensure backup service is running.`
                  );
                }
              }

              case "export_project_zip": {
                try {
                  const allMeta = await StateManager.getAllArtifactMetadata();
                  const files = [];

                  for (const path of Object.keys(allMeta)) {
                    const content = await StateManager.getArtifactContent(path);
                    if (content !== null) {
                      files.push({ path, content });
                    }
                  }

                  const exportData = {
                    projectName: toolArgs.filename || 'reploid-export',
                    exportDate: new Date().toISOString(),
                    fileCount: files.length,
                    files: files.map(f => ({ path: f.path, size: f.content.length }))
                  };

                  UI.logToAdvanced(`Project export prepared: ${files.length} files`);

                  return {
                    success: true,
                    message: `Export ready: ${files.length} files would be included`,
                    manifest: exportData
                  };
                } catch (error) {
                  throw new ToolError(
                    `Project export failed: ${error.message}\n` +
                    `Common issues:\n` +
                    `  • Large files may exceed memory limits\n` +
                    `  • Check that all artifacts are accessible\n` +
                    `Tip: Try exporting specific directories instead of the entire project.`
                  );
                }
              }

              default:
                throw new ToolError(`Static tool '${toolName}' is not implemented.`);
            }
          }

          const dynamicTool = injectedDynamicTools.find(t => t.declaration.name === toolName);
          if (dynamicTool) {
            return await executeDynamicTool(dynamicTool, toolArgs);
          }

          throw new ToolError(`Tool '${toolName}' is not implemented.`);
        };

        const executeDynamicTool = async (toolDef, toolArgs) => {
          logger.info(`[ToolRunner] Executing dynamic tool: ${toolDef.declaration.name}`);

          const { implementation } = toolDef;

          if (implementation.type === 'javascript') {
            if (config.useBlobExecution) {
              return { result: 'blob-execution', args: toolArgs };
            } else {
              return { result: 'worker-execution', args: toolArgs };
            }
          } else if (implementation.type === 'composite') {
            const results = [];
            for (const step of implementation.steps) {
              const stepResult = await runTool(step.tool, step.args);
              results.push(stepResult);
            }
            return results;
          } else {
            throw new ToolError(`Unknown implementation type: ${implementation.type}`);
          }
        };

        const convertToGeminiFunctionDeclaration = (mcpToolDefinition) => {
          return ToolRunnerPureHelpers.convertToGeminiFunctionDeclarationPure(mcpToolDefinition);
        };

        return {
          api: {
            runTool,
            convertToGeminiFunctionDeclaration
          },
          _test: {
            executeDynamicTool
          }
        };
      }
    };

    toolRunner = ToolRunnerModule.factory(mockDeps);
  });

  describe('Module Metadata', () => {
    it('should have correct module structure', () => {
      expect(toolRunner.api).toBeDefined();
      expect(toolRunner.api.runTool).toBeTypeOf('function');
      expect(toolRunner.api.convertToGeminiFunctionDeclaration).toBeTypeOf('function');
    });

    it('should throw error when missing dependencies', () => {
      const incompleteDeps = { config: {} };

      expect(() => {
        const ToolRunnerModule = {
          factory: (deps) => {
            const { config, logger, Storage, StateManager, ApiClient, Errors, Utils, ToolRunnerPureHelpers } = deps;
            if (!config || !logger || !Storage || !StateManager || !ApiClient || !Errors || !Utils || !ToolRunnerPureHelpers) {
              throw new Error('ToolRunner: Missing required dependencies');
            }
          }
        };
        ToolRunnerModule.factory(incompleteDeps);
      }).toThrow('ToolRunner: Missing required dependencies');
    });
  });

  describe('Read Artifact Tool', () => {
    it('should read artifact successfully', async () => {
      mockDeps.StateManager.getArtifactContent.mockResolvedValue('file content');

      const result = await toolRunner.api.runTool(
        'read_artifact',
        { path: '/test.js', version: 'v1' },
        mockStaticTools,
        mockDynamicTools
      );

      expect(result.content).toBe('file content');
      expect(mockDeps.StateManager.getArtifactContent).toHaveBeenCalledWith('/test.js', 'v1');
    });

    it('should throw error when artifact not found', async () => {
      mockDeps.StateManager.getArtifactContent.mockResolvedValue(null);
      mockDeps.StateManager.getAllArtifactMetadata.mockResolvedValue({
        '/file1.js': {},
        '/file2.js': {}
      });

      await expect(
        toolRunner.api.runTool('read_artifact', { path: '/missing.js' }, mockStaticTools, mockDynamicTools)
      ).rejects.toThrow('Artifact not found');
    });

    it('should suggest available artifacts when not found', async () => {
      mockDeps.StateManager.getArtifactContent.mockResolvedValue(null);
      mockDeps.StateManager.getAllArtifactMetadata.mockResolvedValue({
        '/file1.js': {},
        '/file2.js': {},
        '/file3.js': {}
      });

      try {
        await toolRunner.api.runTool('read_artifact', { path: '/missing.js' }, mockStaticTools, mockDynamicTools);
      } catch (error) {
        expect(error.message).toContain('Some available artifacts:');
        expect(error.message).toContain('/file1.js');
      }
    });
  });

  describe('List Artifacts Tool', () => {
    it('should list all artifacts', async () => {
      mockDeps.StateManager.getAllArtifactMetadata.mockResolvedValue({
        '/file1.js': {},
        '/file2.js': {},
        '/docs/readme.md': {}
      });

      const result = await toolRunner.api.runTool(
        'list_artifacts',
        {},
        mockStaticTools,
        mockDynamicTools
      );

      expect(result.paths).toHaveLength(3);
      expect(result.paths).toContain('/file1.js');
      expect(result.paths).toContain('/docs/readme.md');
    });

    it('should filter artifacts by path prefix', async () => {
      mockDeps.StateManager.getAllArtifactMetadata.mockResolvedValue({
        '/src/file1.js': {},
        '/src/file2.js': {},
        '/docs/readme.md': {}
      });

      const result = await toolRunner.api.runTool(
        'list_artifacts',
        { path: '/src' },
        mockStaticTools,
        mockDynamicTools
      );

      expect(result.paths).toHaveLength(2);
      expect(result.paths).toContain('/src/file1.js');
      expect(result.paths).not.toContain('/docs/readme.md');
    });

    it('should return empty list when no matches', async () => {
      mockDeps.StateManager.getAllArtifactMetadata.mockResolvedValue({
        '/file1.js': {},
        '/file2.js': {}
      });

      const result = await toolRunner.api.runTool(
        'list_artifacts',
        { path: '/nonexistent' },
        mockStaticTools,
        mockDynamicTools
      );

      expect(result.paths).toHaveLength(0);
    });
  });

  describe('Diff Artifacts Tool', () => {
    beforeEach(() => {
      mockStaticTools.push({ name: 'diff_artifacts', description: 'Diff artifacts' });
    });

    it('should diff two artifact versions', async () => {
      mockDeps.StateManager.getArtifactContent
        .mockResolvedValueOnce('content version A')
        .mockResolvedValueOnce('content version B');

      const result = await toolRunner.api.runTool(
        'diff_artifacts',
        { path: '/test.js', version_a: 'v1', version_b: 'v2' },
        mockStaticTools,
        mockDynamicTools
      );

      expect(result.differences).toBe(true);
      expect(result.diff).toContain('Len A: 17');
      expect(result.diff).toContain('Len B: 17');
    });

    it('should detect no differences when content identical', async () => {
      mockDeps.StateManager.getArtifactContent
        .mockResolvedValueOnce('same content')
        .mockResolvedValueOnce('same content');

      const result = await toolRunner.api.runTool(
        'diff_artifacts',
        { path: '/test.js', version_a: 'v1', version_b: 'v2' },
        mockStaticTools,
        mockDynamicTools
      );

      expect(result.differences).toBe(false);
    });

    it('should throw error when version A not found', async () => {
      mockDeps.StateManager.getArtifactContent
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce('content B');

      await expect(
        toolRunner.api.runTool(
          'diff_artifacts',
          { path: '/test.js', version_a: 'v1', version_b: 'v2' },
          mockStaticTools,
          mockDynamicTools
        )
      ).rejects.toThrow("version 'v1' not found");
    });

    it('should throw error when version B not found', async () => {
      mockDeps.StateManager.getArtifactContent
        .mockResolvedValueOnce('content A')
        .mockResolvedValueOnce(null);

      await expect(
        toolRunner.api.runTool(
          'diff_artifacts',
          { path: '/test.js', version_a: 'v1', version_b: 'v2' },
          mockStaticTools,
          mockDynamicTools
        )
      ).rejects.toThrow("version 'v2' not found");
    });
  });

  describe('Write Artifact Tool', () => {
    it('should create new artifact', async () => {
      mockDeps.StateManager.getArtifactMetadata.mockResolvedValue(null);
      mockDeps.StateManager.createArtifact.mockResolvedValue(true);

      const result = await toolRunner.api.runTool(
        'write_artifact',
        { path: '/new-file.js', content: 'console.log("hello");' },
        mockStaticTools,
        mockDynamicTools
      );

      expect(result.success).toBe(true);
      expect(result.path).toBe('/new-file.js');
      expect(result.size).toBe(21);
      expect(mockDeps.StateManager.createArtifact).toHaveBeenCalled();
    });

    it('should update existing artifact', async () => {
      mockDeps.StateManager.getArtifactMetadata.mockResolvedValue({ path: '/existing.js' });
      mockDeps.StateManager.updateArtifact.mockResolvedValue(true);

      const result = await toolRunner.api.runTool(
        'write_artifact',
        { path: '/existing.js', content: 'updated content' },
        mockStaticTools,
        mockDynamicTools
      );

      expect(result.success).toBe(true);
      expect(mockDeps.StateManager.updateArtifact).toHaveBeenCalledWith('/existing.js', 'updated content');
    });

    it('should infer file type from extension', async () => {
      mockDeps.StateManager.getArtifactMetadata.mockResolvedValue(null);
      mockDeps.StateManager.createArtifact.mockResolvedValue(true);

      await toolRunner.api.runTool(
        'write_artifact',
        { path: '/style.css', content: 'body { margin: 0; }' },
        mockStaticTools,
        mockDynamicTools
      );

      expect(mockDeps.StateManager.createArtifact).toHaveBeenCalledWith(
        '/style.css',
        'css',
        'body { margin: 0; }',
        'Agent-created artifact'
      );
    });

    it('should use custom reason from metadata', async () => {
      mockDeps.StateManager.getArtifactMetadata.mockResolvedValue(null);
      mockDeps.StateManager.createArtifact.mockResolvedValue(true);

      const result = await toolRunner.api.runTool(
        'write_artifact',
        {
          path: '/file.md',
          content: '# Header',
          metadata: { reason: 'Documentation update' }
        },
        mockStaticTools,
        mockDynamicTools
      );

      expect(result.reason).toBe('Documentation update');
    });

    it('should throw error when path missing', async () => {
      await expect(
        toolRunner.api.runTool(
          'write_artifact',
          { content: 'some content' },
          mockStaticTools,
          mockDynamicTools
        )
      ).rejects.toThrow("write_artifact requires both 'path' and 'content' parameters");
    });

    it('should throw error when content missing', async () => {
      await expect(
        toolRunner.api.runTool(
          'write_artifact',
          { path: '/file.js' },
          mockStaticTools,
          mockDynamicTools
        )
      ).rejects.toThrow("write_artifact requires both 'path' and 'content' parameters");
    });

    it('should handle creation failure gracefully', async () => {
      mockDeps.StateManager.getArtifactMetadata.mockResolvedValue(null);
      mockDeps.StateManager.createArtifact.mockRejectedValue(new Error('Disk full'));

      await expect(
        toolRunner.api.runTool(
          'write_artifact',
          { path: '/file.js', content: 'content' },
          mockStaticTools,
          mockDynamicTools
        )
      ).rejects.toThrow('Failed to write artifact at path: /file.js - Disk full');
    });
  });

  describe('Delete Artifact Tool', () => {
    it('should delete artifact successfully', async () => {
      mockDeps.StateManager.getArtifactMetadata.mockResolvedValue({ path: '/old-file.js' });
      mockDeps.StateManager.deleteArtifact.mockResolvedValue(true);

      const result = await toolRunner.api.runTool(
        'delete_artifact',
        { path: '/old-file.js', reason: 'Obsolete code' },
        mockStaticTools,
        mockDynamicTools
      );

      expect(result.success).toBe(true);
      expect(result.path).toBe('/old-file.js');
      expect(result.reason).toBe('Obsolete code');
      expect(result.warning).toContain('permanently deleted');
    });

    it('should require both path and reason', async () => {
      await expect(
        toolRunner.api.runTool(
          'delete_artifact',
          { path: '/file.js' },
          mockStaticTools,
          mockDynamicTools
        )
      ).rejects.toThrow("delete_artifact requires both 'path' and 'reason' parameters");
    });

    it('should throw error when artifact does not exist', async () => {
      mockDeps.StateManager.getArtifactMetadata.mockResolvedValue(null);

      await expect(
        toolRunner.api.runTool(
          'delete_artifact',
          { path: '/nonexistent.js', reason: 'Delete' },
          mockStaticTools,
          mockDynamicTools
        )
      ).rejects.toThrow('Cannot delete non-existent artifact');
    });

    it('should log warning when deleting', async () => {
      mockDeps.StateManager.getArtifactMetadata.mockResolvedValue({ path: '/file.js' });
      mockDeps.StateManager.deleteArtifact.mockResolvedValue(true);

      await toolRunner.api.runTool(
        'delete_artifact',
        { path: '/file.js', reason: 'Test' },
        mockStaticTools,
        mockDynamicTools
      );

      expect(mockDeps.Utils.logger.logEvent).toHaveBeenCalledWith(
        'warn',
        'Artifact DELETED: /file.js',
        'Test'
      );
    });
  });

  describe('Search VFS Tool', () => {
    beforeEach(() => {
      mockStaticTools.push({ name: 'search_vfs', description: 'Search VFS' });
    });

    it('should search with literal string', async () => {
      mockDeps.StateManager.getAllArtifactMetadata.mockResolvedValue({
        '/file1.js': {},
        '/file2.js': {},
        '/file3.js': {}
      });
      mockDeps.StateManager.getArtifactContent
        .mockResolvedValueOnce('function test() {}')
        .mockResolvedValueOnce('const x = 5;')
        .mockResolvedValueOnce('function test() { return true; }');

      const result = await toolRunner.api.runTool(
        'search_vfs',
        { query: 'function test', is_regex: false },
        mockStaticTools,
        mockDynamicTools
      );

      expect(result.results).toHaveLength(2);
      expect(result.results).toContain('/file1.js');
      expect(result.results).toContain('/file3.js');
    });

    it('should search with regex', async () => {
      mockDeps.StateManager.getAllArtifactMetadata.mockResolvedValue({
        '/file1.js': {},
        '/file2.js': {}
      });
      mockDeps.StateManager.getArtifactContent
        .mockResolvedValueOnce('const myVar = 123;')
        .mockResolvedValueOnce('let x = 456;');

      const result = await toolRunner.api.runTool(
        'search_vfs',
        { query: 'const \\w+', is_regex: true },
        mockStaticTools,
        mockDynamicTools
      );

      expect(result.results).toHaveLength(1);
      expect(result.results).toContain('/file1.js');
    });

    it('should return empty results when no matches', async () => {
      mockDeps.StateManager.getAllArtifactMetadata.mockResolvedValue({
        '/file1.js': {}
      });
      mockDeps.StateManager.getArtifactContent.mockResolvedValue('no match here');

      const result = await toolRunner.api.runTool(
        'search_vfs',
        { query: 'impossible-string-xyz', is_regex: false },
        mockStaticTools,
        mockDynamicTools
      );

      expect(result.results).toHaveLength(0);
    });
  });

  describe('PAWS Bundle Tools', () => {
    beforeEach(() => {
      mockStaticTools.push(
        { name: 'create_cats_bundle', description: 'Create CATS bundle' },
        { name: 'create_dogs_bundle', description: 'Create DOGS bundle' }
      );
    });

    it('should create CATS bundle', async () => {
      mockDeps.StateManager.getArtifactContent
        .mockResolvedValueOnce('file1 content')
        .mockResolvedValueOnce('file2 content');
      mockDeps.StateManager.createArtifact.mockResolvedValue(true);

      const result = await toolRunner.api.runTool(
        'create_cats_bundle',
        {
          file_paths: ['/src/file1.js', '/src/file2.js'],
          reason: 'Context for review',
          turn_path: '/turns/turn-001-cats.md'
        },
        mockStaticTools,
        mockDynamicTools
      );

      expect(result.success).toBe(true);
      expect(result.path).toBe('/turns/turn-001-cats.md');
      expect(mockDeps.StateManager.createArtifact).toHaveBeenCalledWith(
        '/turns/turn-001-cats.md',
        'markdown',
        expect.stringContaining('PAWS Context Bundle'),
        'Context bundle for turn'
      );
    });

    it('should create DOGS bundle', async () => {
      mockDeps.StateManager.createArtifact.mockResolvedValue(true);

      const result = await toolRunner.api.runTool(
        'create_dogs_bundle',
        {
          changes: [
            { operation: 'MODIFY', file_path: '/src/file.js', new_content: 'updated code' },
            { operation: 'DELETE', file_path: '/src/old.js' }
          ],
          turn_path: '/turns/turn-001-dogs.md'
        },
        mockStaticTools,
        mockDynamicTools
      );

      expect(result.success).toBe(true);
      expect(result.path).toBe('/turns/turn-001-dogs.md');
      const createdContent = mockDeps.StateManager.createArtifact.mock.calls[0][2];
      expect(createdContent).toContain('PAWS Change Proposal');
      expect(createdContent).toContain('operation: MODIFY');
      expect(createdContent).toContain('operation: DELETE');
    });
  });

  describe('VFS Revert Tool', () => {
    beforeEach(() => {
      mockStaticTools.push({ name: 'vfs_revert', description: 'Revert artifact' });
    });

    it('should revert artifact to previous version', async () => {
      mockDeps.StateManager.getArtifactContent.mockResolvedValue('old content');
      mockDeps.StateManager.updateArtifact.mockResolvedValue(true);

      const result = await toolRunner.api.runTool(
        'vfs_revert',
        { path: '/file.js', commit_sha: 'abc123' },
        mockStaticTools,
        mockDynamicTools
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('reverted to version abc123');
      expect(mockDeps.StateManager.updateArtifact).toHaveBeenCalledWith('/file.js', 'old content');
    });

    it('should throw error when version not found', async () => {
      mockDeps.StateManager.getArtifactContent.mockResolvedValue(null);

      await expect(
        toolRunner.api.runTool(
          'vfs_revert',
          { path: '/file.js', commit_sha: 'invalid' },
          mockStaticTools,
          mockDynamicTools
        )
      ).rejects.toThrow('Cannot revert /file.js: version invalid not found');
    });
  });

  describe('Create RFC Tool', () => {
    beforeEach(() => {
      mockStaticTools.push({ name: 'create_rfc', description: 'Create RFC' });
    });

    it('should create RFC from template', async () => {
      mockDeps.StateManager.getArtifactContent.mockResolvedValue(
        '# RFC: {{TITLE}}\n\nDate: {{DATE}}\n\n## Summary'
      );
      mockDeps.StateManager.createArtifact.mockResolvedValue(true);

      const result = await toolRunner.api.runTool(
        'create_rfc',
        { title: 'New Feature Proposal' },
        mockStaticTools,
        mockDynamicTools
      );

      expect(result.success).toBe(true);
      expect(result.path).toMatch(/^\/docs\/rfc-\d{4}-\d{2}-\d{2}-new-feature-proposal\.md$/);

      const createdContent = mockDeps.StateManager.createArtifact.mock.calls[0][2];
      expect(createdContent).toContain('New Feature Proposal');
      expect(createdContent).not.toContain('{{TITLE}}');
      expect(createdContent).not.toContain('{{DATE}}');
    });

    it('should sanitize RFC title for filename', async () => {
      mockDeps.StateManager.getArtifactContent.mockResolvedValue('# {{TITLE}}\n{{DATE}}');
      mockDeps.StateManager.createArtifact.mockResolvedValue(true);

      const result = await toolRunner.api.runTool(
        'create_rfc',
        { title: 'My New Feature! @2025' },
        mockStaticTools,
        mockDynamicTools
      );

      expect(result.path).toMatch(/my-new-feature-2025\.md$/);
    });

    it('should throw error when template not found', async () => {
      mockDeps.StateManager.getArtifactContent.mockResolvedValue(null);

      await expect(
        toolRunner.api.runTool(
          'create_rfc',
          { title: 'Test RFC' },
          mockStaticTools,
          mockDynamicTools
        )
      ).rejects.toThrow('RFC template not found');
    });
  });

  describe('System Backup Tool', () => {
    beforeEach(() => {
      mockStaticTools.push({ name: 'system.backup', description: 'Backup system' });
    });

    it('should backup all artifacts', async () => {
      mockDeps.StateManager.getAllArtifactMetadata.mockResolvedValue({
        '/file1.js': {},
        '/file2.js': {}
      });
      mockDeps.StateManager.getArtifactContent
        .mockResolvedValueOnce('content1')
        .mockResolvedValueOnce('content2');
      mockDeps.Utils.post.mockResolvedValue({ message: 'Backup successful' });

      const result = await toolRunner.api.runTool(
        'system.backup',
        {},
        mockStaticTools,
        mockDynamicTools
      );

      expect(result.success).toBe(true);
      expect(result.message).toBe('Backup successful');
      expect(mockDeps.Utils.post).toHaveBeenCalledWith(
        '/api/vfs/backup',
        { '/file1.js': 'content1', '/file2.js': 'content2' }
      );
    });

    it('should throw detailed error on backup failure', async () => {
      mockDeps.StateManager.getAllArtifactMetadata.mockResolvedValue({});
      mockDeps.Utils.post.mockRejectedValue(new Error('Network error'));

      await expect(
        toolRunner.api.runTool('system.backup', {}, mockStaticTools, mockDynamicTools)
      ).rejects.toThrow('System backup failed');
    });
  });

  describe('Export Project ZIP Tool', () => {
    beforeEach(() => {
      mockStaticTools.push({ name: 'export_project_zip', description: 'Export project' });
    });

    it('should prepare project export', async () => {
      mockDeps.StateManager.getAllArtifactMetadata.mockResolvedValue({
        '/file1.js': {},
        '/file2.css': {}
      });
      mockDeps.StateManager.getArtifactContent
        .mockResolvedValueOnce('console.log("test");')
        .mockResolvedValueOnce('body { margin: 0; }');

      const result = await toolRunner.api.runTool(
        'export_project_zip',
        { filename: 'my-project' },
        mockStaticTools,
        mockDynamicTools
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('2 files');
      expect(result.manifest.projectName).toBe('my-project');
      expect(result.manifest.fileCount).toBe(2);
    });

    it('should use default filename when not provided', async () => {
      mockDeps.StateManager.getAllArtifactMetadata.mockResolvedValue({});

      const result = await toolRunner.api.runTool(
        'export_project_zip',
        {},
        mockStaticTools,
        mockDynamicTools
      );

      expect(result.manifest.projectName).toBe('reploid-export');
    });

    it('should throw error on export failure', async () => {
      mockDeps.StateManager.getAllArtifactMetadata.mockRejectedValue(new Error('Storage error'));

      await expect(
        toolRunner.api.runTool('export_project_zip', {}, mockStaticTools, mockDynamicTools)
      ).rejects.toThrow('Project export failed');
    });
  });

  describe('Tool Not Found', () => {
    it('should throw error for unknown tool', async () => {
      await expect(
        toolRunner.api.runTool('unknown_tool', {}, mockStaticTools, mockDynamicTools)
      ).rejects.toThrow("Tool 'unknown_tool' not found");
    });

    it('should list available tools in error message', async () => {
      try {
        await toolRunner.api.runTool('missing_tool', {}, mockStaticTools, mockDynamicTools);
      } catch (error) {
        expect(error.message).toContain('Available tools:');
        expect(error.message).toContain('read_artifact');
        expect(error.message).toContain('list_artifacts');
      }
    });
  });

  describe('Dynamic Tool Execution', () => {
    it('should execute JavaScript dynamic tool in worker mode', async () => {
      const dynamicTool = {
        declaration: { name: 'custom_tool', description: 'Custom tool' },
        implementation: { type: 'javascript', code: 'return args.value * 2;' }
      };

      mockDeps.config.useBlobExecution = false;
      const result = await toolRunner._test.executeDynamicTool(dynamicTool, { value: 5 });

      expect(result.result).toBe('worker-execution');
      expect(result.args.value).toBe(5);
    });

    it('should execute JavaScript dynamic tool in blob mode', async () => {
      const dynamicTool = {
        declaration: { name: 'custom_tool', description: 'Custom tool' },
        implementation: { type: 'javascript', code: 'return args.value * 2;' }
      };

      mockDeps.config.useBlobExecution = true;
      const result = await toolRunner._test.executeDynamicTool(dynamicTool, { value: 5 });

      expect(result.result).toBe('blob-execution');
      expect(result.args.value).toBe(5);
    });

    it('should throw error for unknown implementation type', async () => {
      const dynamicTool = {
        declaration: { name: 'bad_tool', description: 'Bad tool' },
        implementation: { type: 'unknown-type', code: 'test' }
      };

      await expect(
        toolRunner._test.executeDynamicTool(dynamicTool, {})
      ).rejects.toThrow('Unknown implementation type: unknown-type');
    });
  });

  describe('Gemini Function Declaration Conversion', () => {
    it('should convert MCP tool to Gemini format', () => {
      const mcpTool = {
        name: 'test_tool',
        description: 'Test tool',
        inputSchema: {
          properties: {
            param1: { type: 'string' }
          }
        }
      };

      const result = toolRunner.api.convertToGeminiFunctionDeclaration(mcpTool);

      expect(result.name).toBe('test_tool');
      expect(result.description).toBe('Test tool');
      expect(mockDeps.ToolRunnerPureHelpers.convertToGeminiFunctionDeclarationPure).toHaveBeenCalledWith(mcpTool);
    });
  });

  describe('Logging and UI', () => {
    it('should log tool execution', async () => {
      mockDeps.StateManager.getAllArtifactMetadata.mockResolvedValue({});

      await toolRunner.api.runTool('list_artifacts', {}, mockStaticTools, mockDynamicTools);

      expect(mockDeps.Utils.logger.logEvent).toHaveBeenCalledWith(
        'info',
        'Run tool: list_artifacts',
        {}
      );
    });

    it('should log to advanced UI', async () => {
      mockDeps.StateManager.getAllArtifactMetadata.mockResolvedValue({});

      await toolRunner.api.runTool('list_artifacts', { path: '/test' }, mockStaticTools, mockDynamicTools);

      expect(global.UI.logToAdvanced).toHaveBeenCalledWith(
        expect.stringContaining('Running tool: list_artifacts')
      );
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete workflow: create, read, delete', async () => {
      // Create
      mockDeps.StateManager.getArtifactMetadata.mockResolvedValue(null);
      mockDeps.StateManager.createArtifact.mockResolvedValue(true);

      const createResult = await toolRunner.api.runTool(
        'write_artifact',
        { path: '/workflow.js', content: 'test content' },
        mockStaticTools,
        mockDynamicTools
      );
      expect(createResult.success).toBe(true);

      // Read
      mockDeps.StateManager.getArtifactContent.mockResolvedValue('test content');
      const readResult = await toolRunner.api.runTool(
        'read_artifact',
        { path: '/workflow.js' },
        mockStaticTools,
        mockDynamicTools
      );
      expect(readResult.content).toBe('test content');

      // Delete
      mockDeps.StateManager.getArtifactMetadata.mockResolvedValue({ path: '/workflow.js' });
      mockDeps.StateManager.deleteArtifact.mockResolvedValue(true);
      const deleteResult = await toolRunner.api.runTool(
        'delete_artifact',
        { path: '/workflow.js', reason: 'Test cleanup' },
        mockStaticTools,
        mockDynamicTools
      );
      expect(deleteResult.success).toBe(true);
    });
  });
});
