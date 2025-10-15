import { describe, it, expect, vi, beforeEach } from 'vitest';

// Import or define the function
const applyDogsBundleImplementation = async (toolArgs, deps) => {
  const { StateManager, logger, Errors } = deps;
  const { ArtifactError, ToolError } = Errors;
  const { dogs_path, verify_command } = toolArgs;

  const dogsContent = await StateManager.getArtifactContent(dogs_path);
  if (!dogsContent) {
    throw new ArtifactError(`Dogs bundle not found: ${dogs_path}`);
  }

  const changes = [];
  const blocks = dogsContent.split('```paws-change');

  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i];
    const metaEnd = block.indexOf('```');
    if (metaEnd === -1) continue;

    const meta = block.substring(0, metaEnd).trim();
    const operationMatch = meta.match(/operation:\s*(\w+)/);
    const filePathMatch = meta.match(/file_path:\s*(.+)/);

    if (!operationMatch || !filePathMatch) continue;

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

    changes.push({ operation, file_path: filePath, new_content: newContent });
  }

  if (changes.length === 0) {
    return { success: false, message: "No valid changes found in dogs bundle" };
  }

  const checkpoint = await StateManager.createCheckpoint(`Before applying ${dogs_path}`);
  logger.info(`[ToolRunner] Created checkpoint: ${checkpoint.id}`);

  const appliedChanges = [];
  try {
    for (const change of changes) {
      logger.info(`[ToolRunner] Applying ${change.operation} to ${change.file_path}`);

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
      logger.info(`[ToolRunner] Running verification: ${verify_command}`);
      logger.warn("[ToolRunner] Verification execution pending Web Worker implementation");
    }

    return {
      success: true,
      message: `Successfully applied ${appliedChanges.length} changes`,
      changes_applied: appliedChanges.length,
      checkpoint: checkpoint.id
    };

  } catch (error) {
    logger.error(`[ToolRunner] Error applying changes, rolling back to checkpoint ${checkpoint.id}`);
    await StateManager.restoreCheckpoint(checkpoint.id);
    throw new ToolError(`Failed to apply dogs bundle: ${error.message}`);
  }
};

describe('applyDogsBundleImplementation', () => {
  let mockDeps, mockStateManager, mockLogger, mockErrors;

  beforeEach(() => {
    mockStateManager = {
      getArtifactContent: vi.fn(),
      createCheckpoint: vi.fn().mockResolvedValue({ id: 'checkpoint-123' }),
      createArtifact: vi.fn(),
      updateArtifact: vi.fn(),
      deleteArtifact: vi.fn(),
      restoreCheckpoint: vi.fn()
    };

    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    };

    mockErrors = {
      ArtifactError: class ArtifactError extends Error {},
      ToolError: class ToolError extends Error {}
    };

    mockDeps = {
      StateManager: mockStateManager,
      logger: mockLogger,
      Errors: mockErrors
    };
  });

  describe('Bundle Parsing', () => {
    it('should throw if dogs bundle not found', async () => {
      mockStateManager.getArtifactContent.mockResolvedValue(null);

      await expect(
        applyDogsBundleImplementation({ dogs_path: '/missing.dogs' }, mockDeps)
      ).rejects.toThrow('Dogs bundle not found');
    });

    it('should parse CREATE operation', async () => {
      const dogsContent = `
\`\`\`paws-change
operation: CREATE
file_path: /test.txt
\`\`\`
\`\`\`
New file content
\`\`\`
`;
      mockStateManager.getArtifactContent.mockImplementation((path) => {
        if (path === '/test.dogs') return Promise.resolve(dogsContent);
        return Promise.resolve(null); // File doesn't exist
      });

      const result = await applyDogsBundleImplementation({ dogs_path: '/test.dogs' }, mockDeps);

      expect(result.success).toBe(true);
      expect(mockStateManager.createArtifact).toHaveBeenCalledWith(
        '/test.txt',
        'text',
        'New file content\n',
        'Created by dogs bundle'
      );
    });

    it('should parse MODIFY operation', async () => {
      const dogsContent = `
\`\`\`paws-change
operation: MODIFY
file_path: /existing.txt
\`\`\`
\`\`\`
Modified content
\`\`\`
`;
      mockStateManager.getArtifactContent.mockImplementation((path) => {
        if (path === '/test.dogs') return Promise.resolve(dogsContent);
        if (path === '/existing.txt') return Promise.resolve('old content');
        return Promise.resolve(null);
      });

      const result = await applyDogsBundleImplementation({ dogs_path: '/test.dogs' }, mockDeps);

      expect(result.success).toBe(true);
      expect(mockStateManager.updateArtifact).toHaveBeenCalledWith('/existing.txt', 'Modified content\n');
    });

    it('should parse DELETE operation', async () => {
      const dogsContent = `
\`\`\`paws-change
operation: DELETE
file_path: /old.txt
\`\`\`
`;
      mockStateManager.getArtifactContent.mockResolvedValue(dogsContent);

      const result = await applyDogsBundleImplementation({ dogs_path: '/test.dogs' }, mockDeps);

      expect(result.success).toBe(true);
      expect(mockStateManager.deleteArtifact).toHaveBeenCalledWith('/old.txt');
    });

    it('should handle multiple changes', async () => {
      const dogsContent = `
\`\`\`paws-change
operation: CREATE
file_path: /file1.txt
\`\`\`
\`\`\`
Content 1
\`\`\`

\`\`\`paws-change
operation: DELETE
file_path: /file2.txt
\`\`\`
`;
      mockStateManager.getArtifactContent.mockImplementation((path) => {
        if (path === '/test.dogs') return Promise.resolve(dogsContent);
        return Promise.resolve(null);
      });

      const result = await applyDogsBundleImplementation({ dogs_path: '/test.dogs' }, mockDeps);

      expect(result.success).toBe(true);
      expect(result.changes_applied).toBe(2);
    });

    it('should return failure if no valid changes', async () => {
      mockStateManager.getArtifactContent.mockResolvedValue('No changes here');

      const result = await applyDogsBundleImplementation({ dogs_path: '/test.dogs' }, mockDeps);

      expect(result.success).toBe(false);
      expect(result.message).toContain('No valid changes found');
    });
  });

  describe('Change Application', () => {
    it('should create checkpoint before applying', async () => {
      const dogsContent = `
\`\`\`paws-change
operation: CREATE
file_path: /test.txt
\`\`\`
\`\`\`
content
\`\`\`
`;
      mockStateManager.getArtifactContent.mockImplementation((path) => {
        if (path === '/test.dogs') return Promise.resolve(dogsContent);
        return Promise.resolve(null);
      });

      await applyDogsBundleImplementation({ dogs_path: '/test.dogs' }, mockDeps);

      expect(mockStateManager.createCheckpoint).toHaveBeenCalledWith('Before applying /test.dogs');
    });

    it('should fail CREATE if file exists', async () => {
      const dogsContent = `
\`\`\`paws-change
operation: CREATE
file_path: /existing.txt
\`\`\`
\`\`\`
content
\`\`\`
`;
      mockStateManager.getArtifactContent
        .mockResolvedValueOnce(dogsContent)
        .mockResolvedValueOnce('existing content');

      await expect(
        applyDogsBundleImplementation({ dogs_path: '/test.dogs' }, mockDeps)
      ).rejects.toThrow('file already exists');
    });

    it('should fail MODIFY if file not found', async () => {
      const dogsContent = `
\`\`\`paws-change
operation: MODIFY
file_path: /missing.txt
\`\`\`
\`\`\`
content
\`\`\`
`;
      mockStateManager.getArtifactContent
        .mockResolvedValueOnce(dogsContent)
        .mockResolvedValueOnce(null);

      await expect(
        applyDogsBundleImplementation({ dogs_path: '/test.dogs' }, mockDeps)
      ).rejects.toThrow('file not found');
    });

    it('should rollback on error', async () => {
      const dogsContent = `
\`\`\`paws-change
operation: CREATE
file_path: /test.txt
\`\`\`
\`\`\`
content
\`\`\`
`;
      mockStateManager.getArtifactContent.mockResolvedValue(dogsContent);
      mockStateManager.createArtifact.mockRejectedValue(new Error('Write failed'));

      await expect(
        applyDogsBundleImplementation({ dogs_path: '/test.dogs' }, mockDeps)
      ).rejects.toThrow();

      expect(mockStateManager.restoreCheckpoint).toHaveBeenCalledWith('checkpoint-123');
    });
  });

  describe('Verification', () => {
    it('should log verification command', async () => {
      const dogsContent = `
\`\`\`paws-change
operation: CREATE
file_path: /test.txt
\`\`\`
\`\`\`
content
\`\`\`
`;
      mockStateManager.getArtifactContent.mockImplementation((path) => {
        if (path === '/test.dogs') return Promise.resolve(dogsContent);
        return Promise.resolve(null);
      });

      await applyDogsBundleImplementation(
        { dogs_path: '/test.dogs', verify_command: 'npm test' },
        mockDeps
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Running verification: npm test')
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('pending Web Worker implementation')
      );
    });

    it('should work without verification command', async () => {
      const dogsContent = `
\`\`\`paws-change
operation: CREATE
file_path: /test.txt
\`\`\`
\`\`\`
content
\`\`\`
`;
      mockStateManager.getArtifactContent.mockImplementation((path) => {
        if (path === '/test.dogs') return Promise.resolve(dogsContent);
        return Promise.resolve(null);
      });

      const result = await applyDogsBundleImplementation({ dogs_path: '/test.dogs' }, mockDeps);

      expect(result.success).toBe(true);
    });
  });

  describe('Return Value', () => {
    it('should return success with change count', async () => {
      const dogsContent = `
\`\`\`paws-change
operation: CREATE
file_path: /test.txt
\`\`\`
\`\`\`
content
\`\`\`
`;
      mockStateManager.getArtifactContent.mockImplementation((path) => {
        if (path === '/test.dogs') return Promise.resolve(dogsContent);
        return Promise.resolve(null);
      });

      const result = await applyDogsBundleImplementation({ dogs_path: '/test.dogs' }, mockDeps);

      expect(result.success).toBe(true);
      expect(result.changes_applied).toBe(1);
      expect(result.checkpoint).toBe('checkpoint-123');
      expect(result.message).toContain('Successfully applied 1 changes');
    });
  });

  describe('Malformed Bundle Parsing', () => {
    it('should skip blocks with missing closing backticks', async () => {
      const dogsContent = `
\`\`\`paws-change
operation: CREATE
file_path: /test1.txt
\`\`\`paws-change
operation: CREATE
file_path: /test2.txt
\`\`\`
\`\`\`
Valid content
\`\`\`
`;
      mockStateManager.getArtifactContent.mockImplementation((path) => {
        if (path === '/test.dogs') return Promise.resolve(dogsContent);
        return Promise.resolve(null);
      });

      const result = await applyDogsBundleImplementation({ dogs_path: '/test.dogs' }, mockDeps);

      expect(result.success).toBe(true);
      expect(result.changes_applied).toBe(1);
      expect(mockStateManager.createArtifact).toHaveBeenCalledWith(
        '/test2.txt',
        'text',
        'Valid content\n',
        'Created by dogs bundle'
      );
    });

    it('should skip blocks without operation', async () => {
      const dogsContent = `
\`\`\`paws-change
file_path: /test.txt
\`\`\`
\`\`\`
content
\`\`\`
`;
      mockStateManager.getArtifactContent.mockResolvedValue(dogsContent);

      const result = await applyDogsBundleImplementation({ dogs_path: '/test.dogs' }, mockDeps);

      expect(result.success).toBe(false);
      expect(result.message).toContain('No valid changes found');
    });

    it('should skip blocks without file_path', async () => {
      const dogsContent = `
\`\`\`paws-change
operation: CREATE
\`\`\`
\`\`\`
content
\`\`\`
`;
      mockStateManager.getArtifactContent.mockResolvedValue(dogsContent);

      const result = await applyDogsBundleImplementation({ dogs_path: '/test.dogs' }, mockDeps);

      expect(result.success).toBe(false);
      expect(result.message).toContain('No valid changes found');
    });

    it('should handle empty content blocks', async () => {
      const dogsContent = `
\`\`\`paws-change
operation: CREATE
file_path: /empty.txt
\`\`\`
\`\`\`
\`\`\`
`;
      mockStateManager.getArtifactContent.mockImplementation((path) => {
        if (path === '/test.dogs') return Promise.resolve(dogsContent);
        return Promise.resolve(null);
      });

      const result = await applyDogsBundleImplementation({ dogs_path: '/test.dogs' }, mockDeps);

      expect(result.success).toBe(true);
      expect(mockStateManager.createArtifact).toHaveBeenCalledWith(
        '/empty.txt',
        'text',
        '',
        'Created by dogs bundle'
      );
    });

    it('should handle corrupted bundle with no paws-change blocks', async () => {
      const dogsContent = 'This is just plain text, not a valid bundle';
      mockStateManager.getArtifactContent.mockResolvedValue(dogsContent);

      const result = await applyDogsBundleImplementation({ dogs_path: '/test.dogs' }, mockDeps);

      expect(result.success).toBe(false);
      expect(result.message).toContain('No valid changes found');
    });
  });

  describe('Edge Cases - File Paths', () => {
    it('should handle paths with spaces', async () => {
      const dogsContent = `
\`\`\`paws-change
operation: CREATE
file_path: /path with spaces/file.txt
\`\`\`
\`\`\`
content
\`\`\`
`;
      mockStateManager.getArtifactContent.mockImplementation((path) => {
        if (path === '/test.dogs') return Promise.resolve(dogsContent);
        return Promise.resolve(null);
      });

      const result = await applyDogsBundleImplementation({ dogs_path: '/test.dogs' }, mockDeps);

      expect(result.success).toBe(true);
      expect(mockStateManager.createArtifact).toHaveBeenCalledWith(
        '/path with spaces/file.txt',
        'text',
        'content\n',
        'Created by dogs bundle'
      );
    });

    it('should handle deeply nested paths', async () => {
      const dogsContent = `
\`\`\`paws-change
operation: CREATE
file_path: /deep/nested/folder/structure/file.txt
\`\`\`
\`\`\`
content
\`\`\`
`;
      mockStateManager.getArtifactContent.mockImplementation((path) => {
        if (path === '/test.dogs') return Promise.resolve(dogsContent);
        return Promise.resolve(null);
      });

      const result = await applyDogsBundleImplementation({ dogs_path: '/test.dogs' }, mockDeps);

      expect(result.success).toBe(true);
      expect(mockStateManager.createArtifact).toHaveBeenCalledWith(
        '/deep/nested/folder/structure/file.txt',
        'text',
        'content\n',
        'Created by dogs bundle'
      );
    });

    it('should handle paths with special characters', async () => {
      const dogsContent = `
\`\`\`paws-change
operation: CREATE
file_path: /folder-name_123/file.test.js
\`\`\`
\`\`\`
content
\`\`\`
`;
      mockStateManager.getArtifactContent.mockImplementation((path) => {
        if (path === '/test.dogs') return Promise.resolve(dogsContent);
        return Promise.resolve(null);
      });

      const result = await applyDogsBundleImplementation({ dogs_path: '/test.dogs' }, mockDeps);

      expect(result.success).toBe(true);
      expect(mockStateManager.createArtifact).toHaveBeenCalledWith(
        '/folder-name_123/file.test.js',
        'text',
        'content\n',
        'Created by dogs bundle'
      );
    });

    it('should trim whitespace from file paths', async () => {
      const dogsContent = `
\`\`\`paws-change
operation: CREATE
file_path:   /test.txt
\`\`\`
\`\`\`
content
\`\`\`
`;
      mockStateManager.getArtifactContent.mockImplementation((path) => {
        if (path === '/test.dogs') return Promise.resolve(dogsContent);
        return Promise.resolve(null);
      });

      const result = await applyDogsBundleImplementation({ dogs_path: '/test.dogs' }, mockDeps);

      expect(result.success).toBe(true);
      expect(mockStateManager.createArtifact).toHaveBeenCalledWith(
        '/test.txt',
        'text',
        'content\n',
        'Created by dogs bundle'
      );
    });
  });

  describe('Edge Cases - Content', () => {
    it('should handle unicode content', async () => {
      const dogsContent = `
\`\`\`paws-change
operation: CREATE
file_path: /unicode.txt
\`\`\`
\`\`\`
Hello 世界 🌍 مرحبا
\`\`\`
`;
      mockStateManager.getArtifactContent.mockImplementation((path) => {
        if (path === '/test.dogs') return Promise.resolve(dogsContent);
        return Promise.resolve(null);
      });

      const result = await applyDogsBundleImplementation({ dogs_path: '/test.dogs' }, mockDeps);

      expect(result.success).toBe(true);
      expect(mockStateManager.createArtifact).toHaveBeenCalledWith(
        '/unicode.txt',
        'text',
        'Hello 世界 🌍 مرحبا\n',
        'Created by dogs bundle'
      );
    });

    it('should handle content with backticks inside', async () => {
      const dogsContent = `
\`\`\`paws-change
operation: CREATE
file_path: /code.js
\`\`\`
\`\`\`
function test() {
  const str = \\\`template\\\`;
}
\`\`\`
`;
      mockStateManager.getArtifactContent.mockImplementation((path) => {
        if (path === '/test.dogs') return Promise.resolve(dogsContent);
        return Promise.resolve(null);
      });

      const result = await applyDogsBundleImplementation({ dogs_path: '/test.dogs' }, mockDeps);

      expect(result.success).toBe(true);
      expect(mockStateManager.createArtifact).toHaveBeenCalledWith(
        '/code.js',
        'text',
        expect.stringContaining('template'),
        'Created by dogs bundle'
      );
    });

    it('should handle very long content', async () => {
      const longContent = 'A'.repeat(10000);
      const dogsContent = `
\`\`\`paws-change
operation: CREATE
file_path: /large.txt
\`\`\`
\`\`\`
${longContent}
\`\`\`
`;
      mockStateManager.getArtifactContent.mockImplementation((path) => {
        if (path === '/test.dogs') return Promise.resolve(dogsContent);
        return Promise.resolve(null);
      });

      const result = await applyDogsBundleImplementation({ dogs_path: '/test.dogs' }, mockDeps);

      expect(result.success).toBe(true);
      expect(mockStateManager.createArtifact).toHaveBeenCalledWith(
        '/large.txt',
        'text',
        expect.stringContaining('A'.repeat(100)),
        'Created by dogs bundle'
      );
    });

    it('should handle content with multiple newlines', async () => {
      const dogsContent = `
\`\`\`paws-change
operation: CREATE
file_path: /multiline.txt
\`\`\`
\`\`\`
Line 1

Line 3


Line 6
\`\`\`
`;
      mockStateManager.getArtifactContent.mockImplementation((path) => {
        if (path === '/test.dogs') return Promise.resolve(dogsContent);
        return Promise.resolve(null);
      });

      const result = await applyDogsBundleImplementation({ dogs_path: '/test.dogs' }, mockDeps);

      expect(result.success).toBe(true);
      const call = mockStateManager.createArtifact.mock.calls[0];
      expect(call[2].split('\n').length).toBeGreaterThan(5);
    });
  });

  describe('Complex Multi-Operation Scenarios', () => {
    it('should handle mixed operations in sequence', async () => {
      const dogsContent = `
\`\`\`paws-change
operation: CREATE
file_path: /new.txt
\`\`\`
\`\`\`
New content
\`\`\`

\`\`\`paws-change
operation: MODIFY
file_path: /existing.txt
\`\`\`
\`\`\`
Modified content
\`\`\`

\`\`\`paws-change
operation: DELETE
file_path: /old.txt
\`\`\`
`;
      mockStateManager.getArtifactContent.mockImplementation((path) => {
        if (path === '/test.dogs') return Promise.resolve(dogsContent);
        if (path === '/existing.txt') return Promise.resolve('old');
        return Promise.resolve(null);
      });

      const result = await applyDogsBundleImplementation({ dogs_path: '/test.dogs' }, mockDeps);

      expect(result.success).toBe(true);
      expect(result.changes_applied).toBe(3);
      expect(mockStateManager.createArtifact).toHaveBeenCalledTimes(1);
      expect(mockStateManager.updateArtifact).toHaveBeenCalledTimes(1);
      expect(mockStateManager.deleteArtifact).toHaveBeenCalledTimes(1);
    });

    it('should apply changes in order', async () => {
      const dogsContent = `
\`\`\`paws-change
operation: CREATE
file_path: /file1.txt
\`\`\`
\`\`\`
First
\`\`\`

\`\`\`paws-change
operation: CREATE
file_path: /file2.txt
\`\`\`
\`\`\`
Second
\`\`\`

\`\`\`paws-change
operation: CREATE
file_path: /file3.txt
\`\`\`
\`\`\`
Third
\`\`\`
`;
      const callOrder = [];
      mockStateManager.getArtifactContent.mockImplementation((path) => {
        if (path === '/test.dogs') return Promise.resolve(dogsContent);
        return Promise.resolve(null);
      });
      mockStateManager.createArtifact.mockImplementation((path) => {
        callOrder.push(path);
        return Promise.resolve();
      });

      await applyDogsBundleImplementation({ dogs_path: '/test.dogs' }, mockDeps);

      expect(callOrder).toEqual(['/file1.txt', '/file2.txt', '/file3.txt']);
    });

    it('should stop and rollback on first error in sequence', async () => {
      const dogsContent = `
\`\`\`paws-change
operation: CREATE
file_path: /file1.txt
\`\`\`
\`\`\`
First
\`\`\`

\`\`\`paws-change
operation: CREATE
file_path: /file2.txt
\`\`\`
\`\`\`
Second (will fail)
\`\`\`

\`\`\`paws-change
operation: CREATE
file_path: /file3.txt
\`\`\`
\`\`\`
Third (should not run)
\`\`\`
`;
      mockStateManager.getArtifactContent.mockImplementation((path) => {
        if (path === '/test.dogs') return Promise.resolve(dogsContent);
        return Promise.resolve(null);
      });
      mockStateManager.createArtifact
        .mockResolvedValueOnce() // First succeeds
        .mockRejectedValueOnce(new Error('Disk full')); // Second fails

      await expect(
        applyDogsBundleImplementation({ dogs_path: '/test.dogs' }, mockDeps)
      ).rejects.toThrow();

      expect(mockStateManager.restoreCheckpoint).toHaveBeenCalledWith('checkpoint-123');
      expect(mockStateManager.createArtifact).toHaveBeenCalledTimes(2); // Third never called
    });

    it('should handle 10+ operations successfully', async () => {
      let dogsContent = '';
      for (let i = 0; i < 15; i++) {
        dogsContent += `
\`\`\`paws-change
operation: CREATE
file_path: /file${i}.txt
\`\`\`
\`\`\`
Content ${i}
\`\`\`
`;
      }

      mockStateManager.getArtifactContent.mockImplementation((path) => {
        if (path === '/test.dogs') return Promise.resolve(dogsContent);
        return Promise.resolve(null);
      });

      const result = await applyDogsBundleImplementation({ dogs_path: '/test.dogs' }, mockDeps);

      expect(result.success).toBe(true);
      expect(result.changes_applied).toBe(15);
      expect(mockStateManager.createArtifact).toHaveBeenCalledTimes(15);
    });
  });

  describe('Checkpoint Management', () => {
    it('should handle checkpoint creation failure', async () => {
      const dogsContent = `
\`\`\`paws-change
operation: CREATE
file_path: /test.txt
\`\`\`
\`\`\`
content
\`\`\`
`;
      mockStateManager.getArtifactContent.mockResolvedValue(dogsContent);
      mockStateManager.createCheckpoint.mockRejectedValue(new Error('Checkpoint failed'));

      await expect(
        applyDogsBundleImplementation({ dogs_path: '/test.dogs' }, mockDeps)
      ).rejects.toThrow('Checkpoint failed');

      expect(mockStateManager.createArtifact).not.toHaveBeenCalled();
    });

    it('should include dogs path in checkpoint message', async () => {
      const dogsContent = `
\`\`\`paws-change
operation: CREATE
file_path: /test.txt
\`\`\`
\`\`\`
content
\`\`\`
`;
      mockStateManager.getArtifactContent.mockImplementation((path) => {
        if (path === '/custom/path.dogs') return Promise.resolve(dogsContent);
        return Promise.resolve(null);
      });

      await applyDogsBundleImplementation({ dogs_path: '/custom/path.dogs' }, mockDeps);

      expect(mockStateManager.createCheckpoint).toHaveBeenCalledWith('Before applying /custom/path.dogs');
    });

    it('should log checkpoint ID', async () => {
      const dogsContent = `
\`\`\`paws-change
operation: CREATE
file_path: /test.txt
\`\`\`
\`\`\`
content
\`\`\`
`;
      mockStateManager.getArtifactContent.mockImplementation((path) => {
        if (path === '/test.dogs') return Promise.resolve(dogsContent);
        return Promise.resolve(null);
      });
      mockStateManager.createCheckpoint.mockResolvedValue({ id: 'custom-checkpoint-id' });

      await applyDogsBundleImplementation({ dogs_path: '/test.dogs' }, mockDeps);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('custom-checkpoint-id')
      );
    });
  });

  describe('Operation-Specific Errors', () => {
    it('should handle CREATE with null existing check', async () => {
      const dogsContent = `
\`\`\`paws-change
operation: CREATE
file_path: /test.txt
\`\`\`
\`\`\`
content
\`\`\`
`;
      mockStateManager.getArtifactContent
        .mockResolvedValueOnce(dogsContent)
        .mockResolvedValueOnce(null); // File doesn't exist (correct)

      const result = await applyDogsBundleImplementation({ dogs_path: '/test.dogs' }, mockDeps);

      expect(result.success).toBe(true);
    });

    it('should handle MODIFY with empty string existing content', async () => {
      const dogsContent = `
\`\`\`paws-change
operation: MODIFY
file_path: /empty.txt
\`\`\`
\`\`\`
New content
\`\`\`
`;
      mockStateManager.getArtifactContent.mockImplementation((path) => {
        if (path === '/test.dogs') return Promise.resolve(dogsContent);
        if (path === '/empty.txt') return Promise.resolve(''); // Empty but exists
        return Promise.resolve(null);
      });

      const result = await applyDogsBundleImplementation({ dogs_path: '/test.dogs' }, mockDeps);

      expect(result.success).toBe(true);
      expect(mockStateManager.updateArtifact).toHaveBeenCalledWith('/empty.txt', 'New content\n');
    });

    it('should handle DELETE of non-existent file gracefully', async () => {
      const dogsContent = `
\`\`\`paws-change
operation: DELETE
file_path: /missing.txt
\`\`\`
`;
      mockStateManager.getArtifactContent.mockResolvedValue(dogsContent);
      mockStateManager.deleteArtifact.mockResolvedValue(); // Succeeds even if file missing

      const result = await applyDogsBundleImplementation({ dogs_path: '/test.dogs' }, mockDeps);

      expect(result.success).toBe(true);
      expect(mockStateManager.deleteArtifact).toHaveBeenCalledWith('/missing.txt');
    });

    it('should handle unknown operation gracefully', async () => {
      const dogsContent = `
\`\`\`paws-change
operation: RENAME
file_path: /test.txt
\`\`\`
\`\`\`
content
\`\`\`
`;
      mockStateManager.getArtifactContent.mockResolvedValue(dogsContent);

      const result = await applyDogsBundleImplementation({ dogs_path: '/test.dogs' }, mockDeps);

      // Should parse but not apply the unknown operation
      expect(result.success).toBe(true);
      expect(result.changes_applied).toBe(0);
    });
  });

  describe('Logging', () => {
    it('should log each operation being applied', async () => {
      const dogsContent = `
\`\`\`paws-change
operation: CREATE
file_path: /test.txt
\`\`\`
\`\`\`
content
\`\`\`
`;
      mockStateManager.getArtifactContent.mockImplementation((path) => {
        if (path === '/test.dogs') return Promise.resolve(dogsContent);
        return Promise.resolve(null);
      });

      await applyDogsBundleImplementation({ dogs_path: '/test.dogs' }, mockDeps);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Applying CREATE to /test.txt')
      );
    });

    it('should log error when rolling back', async () => {
      const dogsContent = `
\`\`\`paws-change
operation: CREATE
file_path: /test.txt
\`\`\`
\`\`\`
content
\`\`\`
`;
      mockStateManager.getArtifactContent.mockResolvedValue(dogsContent);
      mockStateManager.createArtifact.mockRejectedValue(new Error('Write failed'));

      await expect(
        applyDogsBundleImplementation({ dogs_path: '/test.dogs' }, mockDeps)
      ).rejects.toThrow();

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('rolling back to checkpoint')
      );
    });
  });
});
