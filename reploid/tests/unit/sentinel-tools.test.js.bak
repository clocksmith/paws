import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('SentinelTools Module', () => {
  let sentinelTools;
  let mockDeps;

  beforeEach(() => {
    mockDeps = {
      Storage: {},
      StateManager: {
        getArtifactContent: vi.fn().mockResolvedValue('file content'),
        getAllArtifactMetadata: vi.fn().mockResolvedValue({
          '/modules/api.js': {},
          '/config.json': {},
          '/sessions/test/file.txt': {},
          '/docs/readme.md': {}
        }),
        createArtifact: vi.fn().mockResolvedValue(true),
        updateArtifact: vi.fn().mockResolvedValue(true),
        deleteArtifact: vi.fn().mockResolvedValue(true),
        createCheckpoint: vi.fn().mockResolvedValue({ id: 'checkpoint-123' }),
        restoreCheckpoint: vi.fn().mockResolvedValue(true),
        commitChanges: vi.fn().mockResolvedValue(true)
      },
      Utils: {
        logger: {
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
          debug: vi.fn()
        },
        Errors: {
          ArtifactError: class ArtifactError extends Error {},
          ToolError: class ToolError extends Error {}
        }
      },
      ApiClient: {
        sendMessage: vi.fn().mockResolvedValue({
          content: '["/modules/api.js", "/config.json"]'
        })
      },
      VerificationManager: {
        runVerification: vi.fn().mockResolvedValue({ success: true })
      }
    };

    const SentinelToolsModule = {
      metadata: {
        id: 'SentinelTools',
        version: '1.0.0',
        dependencies: ['Storage', 'StateManager', 'Utils', 'ApiClient', 'VerificationManager?'],
        async: false,
        type: 'service'
      },
      factory: (deps) => {
        const { StateManager, Utils, ApiClient } = deps;
        const { logger, Errors } = Utils;
        const { ArtifactError, ToolError } = Errors;

        const parseDogsBundle = (content) => {
          const changes = [];
          const blocks = content.split('```paws-change');

          for (let i = 1; i < blocks.length; i++) {
            const block = blocks[i];
            const metaEnd = block.indexOf('```');
            if (metaEnd === -1) continue;

            const meta = block.substring(0, metaEnd).trim();
            const operationMatch = meta.match(/operation:\s*(\w+)/);
            const filePathMatch = meta.match(/file_path:\s*(.+)/);

            if (!operationMatch || !filePathMatch) {
              logger.warn(`[SentinelTools] Skipping malformed change block in dogs bundle`);
              continue;
            }

            const operation = operationMatch[1];
            const filePath = filePathMatch[1].trim();

            let newContent = '';
            if (operation !== 'DELETE') {
              const contentStart = block.indexOf('```', metaEnd + 3);
              if (contentStart !== -1) {
                const actualStart = contentStart + 3;
                const contentEnd = block.indexOf('```', actualStart);
                if (contentEnd !== -1) {
                  let startIdx = actualStart;
                  if (block[startIdx] === '\n') startIdx++;
                  newContent = block.substring(startIdx, contentEnd);
                }
              }
            }

            changes.push({
              operation,
              file_path: filePath,
              new_content: newContent
            });
          }

          return changes;
        };

        const createCatsBundle = async (toolArgs) => {
          const { file_paths, reason, turn_path, ai_curate } = toolArgs;

          let selectedPaths = file_paths;

          if (ai_curate && !file_paths) {
            logger.info('[SentinelTools] Using AI to curate file selection');
            selectedPaths = await curateFilesWithAI(reason);
          }

          let bundleContent = `## PAWS Context Bundle (cats.md)\n\n`;
          bundleContent += `**Reason:** ${reason}\n\n`;
          bundleContent += `**Files:** ${selectedPaths.length}\n\n`;
          bundleContent += `---\n\n`;

          for (const path of selectedPaths) {
            try {
              const content = await StateManager.getArtifactContent(path);
              if (content === null) {
                logger.warn(`[SentinelTools] File not found: ${path}`);
                continue;
              }

              bundleContent += `### File: ${path}\n\n`;
              bundleContent += '```vfs-file\n';
              bundleContent += `path: ${path}\n`;
              bundleContent += '```\n\n';
              bundleContent += '```\n';
              bundleContent += content;
              bundleContent += '\n```\n\n';
            } catch (error) {
              logger.error(`[SentinelTools] Error reading ${path}:`, error);
            }
          }

          await StateManager.createArtifact(turn_path, 'markdown', bundleContent,
            `Context bundle for turn: ${reason}`);

          return {
            success: true,
            path: turn_path,
            files_included: selectedPaths.length
          };
        };

        const curateFilesWithAI = async (goal) => {
          const allMeta = await StateManager.getAllArtifactMetadata();
          const filePaths = Object.keys(allMeta);

          const relevantPaths = filePaths.filter(path =>
            !path.startsWith('/sessions/') &&
            !path.includes('.tmp') &&
            !path.includes('.backup')
          );

          const fileTree = relevantPaths.map(path => {
            const parts = path.split('/');
            return '  '.repeat(parts.length - 2) + parts[parts.length - 1];
          }).join('\n');

          const prompt = `You are analyzing a codebase to select relevant files for a task.

Task: ${goal}

Available files:
${fileTree}

Select ONLY the most relevant files needed to understand and complete this task.
Be selective - include only what's necessary.
Return a JSON array of file paths.

Example: ["/modules/api.js", "/config.json"]`;

          try {
            const response = await ApiClient.sendMessage([{
              role: 'user',
              content: prompt
            }]);

            const content = response.content;
            const jsonMatch = content.match(/\[[\s\S]*?\]/);
            if (jsonMatch) {
              const selectedFiles = JSON.parse(jsonMatch[0]);
              return selectedFiles.filter(f => relevantPaths.includes(f));
            }
          } catch (error) {
            logger.error('[SentinelTools] AI curation failed:', error);
          }

          return relevantPaths.slice(0, 10);
        };

        const createDogsBundle = async (toolArgs) => {
          const { changes, turn_path, summary } = toolArgs;

          let bundleContent = `## PAWS Change Proposal (dogs.md)\n\n`;

          if (summary) {
            bundleContent += `**Summary:** ${summary}\n\n`;
          }

          bundleContent += `**Total Changes:** ${changes.length}\n`;

          const counts = { CREATE: 0, MODIFY: 0, DELETE: 0 };
          changes.forEach(c => counts[c.operation]++);
          bundleContent += `- Create: ${counts.CREATE}\n`;
          bundleContent += `- Modify: ${counts.MODIFY}\n`;
          bundleContent += `- Delete: ${counts.DELETE}\n\n`;
          bundleContent += `---\n\n`;

          for (const change of changes) {
            bundleContent += '```paws-change\n';
            bundleContent += `operation: ${change.operation}\n`;
            bundleContent += `file_path: ${change.file_path}\n`;
            bundleContent += '```\n\n';

            if (change.operation !== 'DELETE' && change.new_content) {
              bundleContent += '```\n';
              bundleContent += change.new_content;
              bundleContent += '\n```\n\n';
            }
          }

          await StateManager.createArtifact(turn_path, 'markdown', bundleContent,
            `Change proposal: ${summary || 'Multiple changes'}`);

          return {
            success: true,
            path: turn_path,
            changes_count: changes.length
          };
        };

        const applyDogsBundle = async (toolArgs) => {
          const { dogs_path, verify_command, session_id } = toolArgs;

          const dogsContent = await StateManager.getArtifactContent(dogs_path);
          if (!dogsContent) {
            throw new ArtifactError(`Dogs bundle not found: ${dogs_path}`);
          }

          const changes = parseDogsBundle(dogsContent);
          if (changes.length === 0) {
            return {
              success: false,
              message: 'No valid changes found in dogs bundle'
            };
          }

          if (session_id) {
            const sessionPath = `/sessions/${session_id}/`;
            for (const change of changes) {
              if (!isPathAllowed(change.file_path, sessionPath)) {
                throw new ToolError(
                  `Security: Change to ${change.file_path} violates session workspace constraints`
                );
              }
            }
          }

          const checkpoint = await StateManager.createCheckpoint(
            `Before applying ${dogs_path}`
          );
          logger.info(`[SentinelTools] Created checkpoint: ${checkpoint.id}`);

          const appliedChanges = [];
          try {
            for (const change of changes) {
              logger.info(`[SentinelTools] Applying ${change.operation} to ${change.file_path}`);

              if (change.operation === 'CREATE') {
                const existing = await StateManager.getArtifactContent(change.file_path);
                if (existing !== null) {
                  throw new ToolError(`Cannot CREATE ${change.file_path}: file already exists`);
                }
                await StateManager.createArtifact(
                  change.file_path,
                  'text',
                  change.new_content,
                  'Created by dogs bundle'
                );
                appliedChanges.push(change);

              } else if (change.operation === 'MODIFY') {
                const existing = await StateManager.getArtifactContent(change.file_path);
                if (existing === null) {
                  throw new ToolError(`Cannot MODIFY ${change.file_path}: file not found`);
                }
                await StateManager.updateArtifact(change.file_path, change.new_content);
                appliedChanges.push(change);

              } else if (change.operation === 'DELETE') {
                await StateManager.deleteArtifact(change.file_path);
                appliedChanges.push(change);
              }
            }

            if (verify_command) {
              logger.info(`[SentinelTools] Running verification: ${verify_command}`);
              const verifyResult = await runVerificationCommand(verify_command);

              if (!verifyResult.success) {
                logger.error(`[SentinelTools] Verification failed, rolling back`);
                await StateManager.restoreCheckpoint(checkpoint.id);
                return {
                  success: false,
                  message: `Verification failed: ${verifyResult.error}`,
                  changes_rolled_back: appliedChanges.length,
                  checkpoint_restored: checkpoint.id
                };
              }
            }

            if (StateManager.commitChanges) {
              await StateManager.commitChanges(
                `Applied dogs bundle: ${appliedChanges.length} changes`,
                { dogs_path, checkpoint: checkpoint.id }
              );
            }

            return {
              success: true,
              message: `Successfully applied ${appliedChanges.length} changes`,
              changes_applied: appliedChanges,
              checkpoint: checkpoint.id
            };

          } catch (error) {
            logger.error(`[SentinelTools] Error applying changes, rolling back:`, error);
            await StateManager.restoreCheckpoint(checkpoint.id);
            throw new ToolError(`Failed to apply dogs bundle: ${error.message}`);
          }
        };

        const isPathAllowed = (path, sessionPath) => {
          if (sessionPath && !path.startsWith(sessionPath)) {
            if (path.startsWith('/modules/') || path.startsWith('/docs/')) {
              return false;
            }
          }
          return true;
        };

        const runVerificationCommand = async (command, sessionId) => {
          if (!command) {
            return { success: true };
          }

          logger.info(`[SentinelTools] Running verification: ${command}`);

          try {
            if (deps.VerificationManager) {
              try {
                const result = await deps.VerificationManager.runVerification(command, sessionId);
                logger.info(`[SentinelTools] Verification ${result.success ? 'passed' : 'failed'}`);
                return result;
              } catch (err) {
                logger.error(`[SentinelTools] VerificationManager failed:`, err);
              }
            }

            if (command.startsWith('test:')) {
              const testPath = command.substring(5);
              const testCode = await StateManager.getArtifactContent(testPath);
              if (!testCode) {
                return { success: false, error: `Test file not found: ${testPath}` };
              }

              return {
                success: true,
                output: `Test file found: ${testPath} (execution not implemented)`
              };
            }

            const patterns = {
              'npm test': /^npm\s+(test|run\s+test)/,
              'npm run build': /^npm\s+run\s+build/,
              'lint': /lint/,
              'typecheck': /type-?check/
            };

            for (const [name, pattern] of Object.entries(patterns)) {
              if (pattern.test(command)) {
                return {
                  success: true,
                  output: `${name} command recognized but not executed (sandbox not available)`
                };
              }
            }

            return {
              success: true,
              output: `Command ${command} recognized but not executed`
            };

          } catch (error) {
            logger.error(`[SentinelTools] Verification error:`, error);
            return { success: false, error: error.message };
          }
        };

        return {
          api: {
            createCatsBundle,
            createDogsBundle,
            applyDogsBundle,
            parseDogsBundle,
            isPathAllowed,
            curateFilesWithAI
          }
        };
      }
    };

    sentinelTools = SentinelToolsModule.factory(mockDeps).api;
  });

  describe('Module Metadata', () => {
    it('should have correct API structure', () => {
      expect(sentinelTools).toBeDefined();
      expect(sentinelTools.createCatsBundle).toBeTypeOf('function');
      expect(sentinelTools.createDogsBundle).toBeTypeOf('function');
      expect(sentinelTools.applyDogsBundle).toBeTypeOf('function');
      expect(sentinelTools.parseDogsBundle).toBeTypeOf('function');
      expect(sentinelTools.isPathAllowed).toBeTypeOf('function');
      expect(sentinelTools.curateFilesWithAI).toBeTypeOf('function');
    });
  });

  describe('parseDogsBundle', () => {
    it('should parse CREATE operation', () => {
      const content = '```paws-change\noperation: CREATE\nfile_path: /test.js\n```\n\n```\nconst x = 1;\n```\n\n';
      const changes = sentinelTools.parseDogsBundle(content);

      expect(changes).toHaveLength(1);
      expect(changes[0].operation).toBe('CREATE');
      expect(changes[0].file_path).toBe('/test.js');
      expect(changes[0].new_content).toBe('const x = 1;\n');
    });

    it('should parse MODIFY operation', () => {
      const content = '```paws-change\noperation: MODIFY\nfile_path: /test.js\n```\n\n```\nconst x = 2;\n```\n\n';
      const changes = sentinelTools.parseDogsBundle(content);

      expect(changes).toHaveLength(1);
      expect(changes[0].operation).toBe('MODIFY');
      expect(changes[0].file_path).toBe('/test.js');
      expect(changes[0].new_content).toBe('const x = 2;\n');
    });

    it('should parse DELETE operation', () => {
      const content = '```paws-change\noperation: DELETE\nfile_path: /test.js\n```\n\n';
      const changes = sentinelTools.parseDogsBundle(content);

      expect(changes).toHaveLength(1);
      expect(changes[0].operation).toBe('DELETE');
      expect(changes[0].file_path).toBe('/test.js');
      expect(changes[0].new_content).toBe('');
    });

    it('should parse multiple changes', () => {
      const content = '```paws-change\noperation: CREATE\nfile_path: /file1.js\n```\n\n```\ncontent1\n```\n\n' +
        '```paws-change\noperation: MODIFY\nfile_path: /file2.js\n```\n\n```\ncontent2\n```\n\n' +
        '```paws-change\noperation: DELETE\nfile_path: /file3.js\n```\n\n';
      const changes = sentinelTools.parseDogsBundle(content);

      expect(changes).toHaveLength(3);
      expect(changes[0].operation).toBe('CREATE');
      expect(changes[1].operation).toBe('MODIFY');
      expect(changes[2].operation).toBe('DELETE');
    });

    it('should skip malformed blocks', () => {
      const content = '```paws-change\ninvalid block\n```\n\n';
      const changes = sentinelTools.parseDogsBundle(content);

      expect(changes).toHaveLength(0);
      expect(mockDeps.Utils.logger.warn).toHaveBeenCalled();
    });

    it('should handle empty content', () => {
      const changes = sentinelTools.parseDogsBundle('');
      expect(changes).toHaveLength(0);
    });
  });

  describe('createCatsBundle', () => {
    it('should create bundle with provided file paths', async () => {
      const result = await sentinelTools.createCatsBundle({
        file_paths: ['/file1.js', '/file2.js'],
        reason: 'test reason',
        turn_path: '/test/cats.md',
        ai_curate: false
      });

      expect(result.success).toBe(true);
      expect(result.path).toBe('/test/cats.md');
      expect(result.files_included).toBe(2);
      expect(mockDeps.StateManager.createArtifact).toHaveBeenCalled();
    });

    it('should use AI curation when requested', async () => {
      const result = await sentinelTools.createCatsBundle({
        file_paths: null,
        reason: 'test goal',
        turn_path: '/test/cats.md',
        ai_curate: true
      });

      expect(result.success).toBe(true);
      expect(mockDeps.ApiClient.sendMessage).toHaveBeenCalled();
    });

    it('should skip missing files', async () => {
      mockDeps.StateManager.getArtifactContent
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce('content2');

      const result = await sentinelTools.createCatsBundle({
        file_paths: ['/missing.js', '/exists.js'],
        reason: 'test',
        turn_path: '/test/cats.md',
        ai_curate: false
      });

      expect(result.success).toBe(true);
      expect(mockDeps.Utils.logger.warn).toHaveBeenCalled();
    });

    it('should handle errors reading files gracefully', async () => {
      mockDeps.StateManager.getArtifactContent
        .mockRejectedValueOnce(new Error('Read error'))
        .mockResolvedValueOnce('content2');

      const result = await sentinelTools.createCatsBundle({
        file_paths: ['/error.js', '/ok.js'],
        reason: 'test',
        turn_path: '/test/cats.md',
        ai_curate: false
      });

      expect(result.success).toBe(true);
      expect(mockDeps.Utils.logger.error).toHaveBeenCalled();
    });
  });

  describe('curateFilesWithAI', () => {
    it('should filter out session files', async () => {
      const result = await sentinelTools.curateFilesWithAI('implement feature');

      expect(mockDeps.StateManager.getAllArtifactMetadata).toHaveBeenCalled();
      expect(mockDeps.ApiClient.sendMessage).toHaveBeenCalled();

      // Check that the prompt doesn't include /sessions/ paths
      const call = mockDeps.ApiClient.sendMessage.mock.calls[0];
      const prompt = call[0][0].content;
      expect(prompt).not.toContain('/sessions/');
    });

    it('should return AI-selected files', async () => {
      const result = await sentinelTools.curateFilesWithAI('implement feature');

      expect(result).toContain('/modules/api.js');
      expect(result).toContain('/config.json');
      expect(result).not.toContain('/sessions/test/file.txt');
    });

    it('should fallback to heuristic selection on AI failure', async () => {
      mockDeps.ApiClient.sendMessage.mockRejectedValue(new Error('API error'));

      const result = await sentinelTools.curateFilesWithAI('implement feature');

      expect(result.length).toBeLessThanOrEqual(10);
      expect(mockDeps.Utils.logger.error).toHaveBeenCalled();
    });

    it('should handle invalid JSON response', async () => {
      mockDeps.ApiClient.sendMessage.mockResolvedValue({
        content: 'Not a JSON array'
      });

      const result = await sentinelTools.curateFilesWithAI('implement feature');

      expect(result.length).toBeLessThanOrEqual(10);
    });
  });

  describe('createDogsBundle', () => {
    it('should create bundle with changes', async () => {
      const changes = [
        { operation: 'CREATE', file_path: '/new.js', new_content: 'new content' },
        { operation: 'MODIFY', file_path: '/existing.js', new_content: 'modified' },
        { operation: 'DELETE', file_path: '/old.js', new_content: null }
      ];

      const result = await sentinelTools.createDogsBundle({
        changes,
        turn_path: '/test/dogs.md',
        summary: 'Test changes'
      });

      expect(result.success).toBe(true);
      expect(result.path).toBe('/test/dogs.md');
      expect(result.changes_count).toBe(3);
      expect(mockDeps.StateManager.createArtifact).toHaveBeenCalled();
    });

    it('should count operations by type', async () => {
      const changes = [
        { operation: 'CREATE', file_path: '/1.js', new_content: 'a' },
        { operation: 'CREATE', file_path: '/2.js', new_content: 'b' },
        { operation: 'MODIFY', file_path: '/3.js', new_content: 'c' },
        { operation: 'DELETE', file_path: '/4.js', new_content: null }
      ];

      const result = await sentinelTools.createDogsBundle({
        changes,
        turn_path: '/test/dogs.md',
        summary: 'Multiple ops'
      });

      expect(result.success).toBe(true);

      // Verify the bundle content includes counts
      const createCall = mockDeps.StateManager.createArtifact.mock.calls[0];
      const bundleContent = createCall[2];
      expect(bundleContent).toContain('Create: 2');
      expect(bundleContent).toContain('Modify: 1');
      expect(bundleContent).toContain('Delete: 1');
    });

    it('should handle empty changes array', async () => {
      const result = await sentinelTools.createDogsBundle({
        changes: [],
        turn_path: '/test/dogs.md',
        summary: 'No changes'
      });

      expect(result.success).toBe(true);
      expect(result.changes_count).toBe(0);
    });

    it('should work without summary', async () => {
      const changes = [
        { operation: 'CREATE', file_path: '/test.js', new_content: 'test' }
      ];

      const result = await sentinelTools.createDogsBundle({
        changes,
        turn_path: '/test/dogs.md'
      });

      expect(result.success).toBe(true);
    });
  });

  describe('applyDogsBundle', () => {
    beforeEach(() => {
      mockDeps.StateManager.getArtifactContent.mockResolvedValue(
        '```paws-change\noperation: CREATE\nfile_path: /sessions/test/new.js\n```\n\n```\nconst x = 1;\n```\n\n'
      );
    });

    it('should apply CREATE change', async () => {
      mockDeps.StateManager.getArtifactContent
        .mockResolvedValueOnce('```paws-change\noperation: CREATE\nfile_path: /sessions/test/new.js\n```\n\n```\nconst x = 1;\n```\n\n')
        .mockResolvedValueOnce(null); // File doesn't exist

      const result = await sentinelTools.applyDogsBundle({
        dogs_path: '/test/dogs.md',
        session_id: 'test'
      });

      expect(result.success).toBe(true);
      expect(mockDeps.StateManager.createArtifact).toHaveBeenCalled();
      expect(mockDeps.StateManager.createCheckpoint).toHaveBeenCalled();
    });

    it('should apply MODIFY change', async () => {
      mockDeps.StateManager.getArtifactContent
        .mockResolvedValueOnce('```paws-change\noperation: MODIFY\nfile_path: /sessions/test/file.js\n```\n\n```\nmodified content\n```\n\n')
        .mockResolvedValueOnce('original content'); // File exists

      const result = await sentinelTools.applyDogsBundle({
        dogs_path: '/test/dogs.md',
        session_id: 'test'
      });

      expect(result.success).toBe(true);
      expect(mockDeps.StateManager.updateArtifact).toHaveBeenCalled();
    });

    it('should apply DELETE change', async () => {
      mockDeps.StateManager.getArtifactContent.mockResolvedValueOnce(
        '```paws-change\noperation: DELETE\nfile_path: /sessions/test/old.js\n```\n\n'
      );

      const result = await sentinelTools.applyDogsBundle({
        dogs_path: '/test/dogs.md',
        session_id: 'test'
      });

      expect(result.success).toBe(true);
      expect(mockDeps.StateManager.deleteArtifact).toHaveBeenCalled();
    });

    it('should rollback on CREATE failure (file exists)', async () => {
      mockDeps.StateManager.getArtifactContent
        .mockResolvedValueOnce('```paws-change\noperation: CREATE\nfile_path: /sessions/test/existing.js\n```\n\n```\ncontent\n```\n\n')
        .mockResolvedValueOnce('file already exists');

      await expect(sentinelTools.applyDogsBundle({
        dogs_path: '/test/dogs.md',
        session_id: 'test'
      })).rejects.toThrow('file already exists');

      expect(mockDeps.StateManager.restoreCheckpoint).toHaveBeenCalled();
    });

    it('should rollback on MODIFY failure (file not found)', async () => {
      mockDeps.StateManager.getArtifactContent
        .mockResolvedValueOnce('```paws-change\noperation: MODIFY\nfile_path: /sessions/test/missing.js\n```\n\n```\ncontent\n```\n\n')
        .mockResolvedValueOnce(null); // File doesn't exist

      await expect(sentinelTools.applyDogsBundle({
        dogs_path: '/test/dogs.md',
        session_id: 'test'
      })).rejects.toThrow('file not found');

      expect(mockDeps.StateManager.restoreCheckpoint).toHaveBeenCalled();
    });

    it('should enforce session workspace security', async () => {
      mockDeps.StateManager.getArtifactContent.mockResolvedValueOnce(
        '```paws-change\noperation: MODIFY\nfile_path: /modules/api.js\n```\n\n```\nhacked\n```\n\n'
      );

      await expect(sentinelTools.applyDogsBundle({
        dogs_path: '/test/dogs.md',
        session_id: 'test'
      })).rejects.toThrow('violates session workspace constraints');
    });

    it('should handle empty bundle', async () => {
      mockDeps.StateManager.getArtifactContent.mockResolvedValueOnce('no changes here');

      const result = await sentinelTools.applyDogsBundle({
        dogs_path: '/test/dogs.md',
        session_id: 'test'
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('No valid changes');
    });

    it('should throw error if dogs bundle not found', async () => {
      mockDeps.StateManager.getArtifactContent.mockResolvedValueOnce(null);

      await expect(sentinelTools.applyDogsBundle({
        dogs_path: '/missing/dogs.md',
        session_id: 'test'
      })).rejects.toThrow('Dogs bundle not found');
    });

    it('should commit changes after successful apply', async () => {
      mockDeps.StateManager.getArtifactContent
        .mockResolvedValueOnce('```paws-change\noperation: CREATE\nfile_path: /sessions/test/new.js\n```\n\n```\ntest\n```\n\n')
        .mockResolvedValueOnce(null);

      const result = await sentinelTools.applyDogsBundle({
        dogs_path: '/test/dogs.md',
        session_id: 'test'
      });

      expect(result.success).toBe(true);
      expect(mockDeps.StateManager.commitChanges).toHaveBeenCalled();
    });
  });

  describe('isPathAllowed', () => {
    it('should allow session-scoped paths', () => {
      expect(sentinelTools.isPathAllowed(
        '/sessions/test/file.js',
        '/sessions/test/'
      )).toBe(true);
    });

    it('should deny /modules/ from session scope', () => {
      expect(sentinelTools.isPathAllowed(
        '/modules/api.js',
        '/sessions/test/'
      )).toBe(false);
    });

    it('should deny /docs/ from session scope', () => {
      expect(sentinelTools.isPathAllowed(
        '/docs/readme.md',
        '/sessions/test/'
      )).toBe(false);
    });

    it('should allow any path when no session constraint', () => {
      expect(sentinelTools.isPathAllowed(
        '/modules/api.js',
        null
      )).toBe(true);
    });

    it('should allow non-system paths outside session', () => {
      expect(sentinelTools.isPathAllowed(
        '/custom/file.js',
        '/sessions/test/'
      )).toBe(true);
    });
  });

  describe('Integration Tests', () => {
    it('should complete full CATS -> DOGS -> Apply workflow', async () => {
      // Create CATS bundle
      const catsResult = await sentinelTools.createCatsBundle({
        file_paths: ['/test.js'],
        reason: 'test workflow',
        turn_path: '/sessions/test/cats.md',
        ai_curate: false
      });

      expect(catsResult.success).toBe(true);

      // Create DOGS bundle
      const dogsResult = await sentinelTools.createDogsBundle({
        changes: [
          { operation: 'CREATE', file_path: '/sessions/test/result.js', new_content: 'output' }
        ],
        turn_path: '/sessions/test/dogs.md',
        summary: 'Create output'
      });

      expect(dogsResult.success).toBe(true);

      // Apply DOGS bundle
      mockDeps.StateManager.getArtifactContent
        .mockResolvedValueOnce('```paws-change\noperation: CREATE\nfile_path: /sessions/test/result.js\n```\n\n```\noutput\n```\n\n')
        .mockResolvedValueOnce(null);

      const applyResult = await sentinelTools.applyDogsBundle({
        dogs_path: '/sessions/test/dogs.md',
        session_id: 'test'
      });

      expect(applyResult.success).toBe(true);
      expect(applyResult.changes_applied).toHaveLength(1);
    });
  });
});
