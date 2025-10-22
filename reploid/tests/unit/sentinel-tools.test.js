import { describe, it, expect, beforeEach, vi } from 'vitest';

import SentinelToolsModule from '../../upgrades/sentinel-tools.js';
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
