import { describe, it, expect, beforeEach, vi } from 'vitest';
import RFCAuthor from '../../upgrades/rfc-author.js';

describe('RFC Author Module', () => {
  let mockDeps;
  let mockStateManager;
  let mockLogger;
  let rfcAuthor;

  const createModule = () => RFCAuthor.factory(mockDeps).api;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    };

    mockStateManager = {
      getArtifactContent: vi.fn(),
      getArtifactMetadata: vi.fn().mockReturnValue(null),
      getAllArtifactMetadata: vi.fn().mockResolvedValue({}),
      createArtifact: vi.fn().mockResolvedValue(undefined)
    };

    mockDeps = {
      StateManager: mockStateManager,
      Utils: { logger: mockLogger }
    };

    rfcAuthor = createModule();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('metadata', () => {
    it('exposes expected metadata', () => {
      expect(RFCAuthor.metadata.id).toBe('RFCAuthor');
      expect(RFCAuthor.metadata.version).toBe('1.0.0');
      expect(RFCAuthor.metadata.dependencies).toEqual(['StateManager', 'Utils']);
      expect(RFCAuthor.metadata.async).toBe(false);
      expect(RFCAuthor.metadata.type).toBe('service');
    });
  });

  describe('draftRFC', () => {
    it('populates template placeholders when available', async () => {
      const template = `# {{TITLE}}\nAuthor: {{AUTHOR}}\nDate: {{DATE}}\nStatus: {{STATUS}}`;
      mockStateManager.getArtifactContent.mockResolvedValueOnce(template);

      const metadataMap = {
        '/docs/rfc-2025-01-01-sample.md': { id: '/docs/rfc-2025-01-01-sample.md' }
      };

      mockStateManager.getArtifactMetadata
        .mockReturnValueOnce(metadataMap['/docs/rfc-2025-01-01-sample.md'])
        .mockReturnValue(null);

      const result = await rfcAuthor.draftRFC({
        title: 'Sample',
        author: 'Ada',
        status: 'Review',
        includeArtifacts: false
      });

      expect(result.path).toBe('/docs/rfc-2025-01-01-sample-1.md');
      expect(mockStateManager.createArtifact).toHaveBeenCalledWith(
        result.path,
        'document',
        expect.stringContaining('Author: Ada'),
        expect.stringContaining('RFC draft: Sample')
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('[RFCAuthor] RFC draft created')
      );
    });

    it('falls back to default content when template missing', async () => {
      mockStateManager.getArtifactContent.mockResolvedValueOnce(null);
      mockStateManager.getAllArtifactMetadata.mockResolvedValue({
        '/docs/file.md': { id: '/docs/file.md', type: 'document' }
      });

      const result = await rfcAuthor.draftRFC({
        title: 'Fallback Test',
        includeArtifacts: true
      });

      expect(result.content).toContain('## Background');
      expect(result.content).toContain('### Recent Artifacts');
      expect(mockStateManager.createArtifact).toHaveBeenCalled();
    });
  });

  describe('produceOutline', () => {
    it('returns artifact count and suggested sections', async () => {
      mockStateManager.getAllArtifactMetadata.mockResolvedValue({
        '/docs/a.md': { id: '/docs/a.md', type: 'document' },
        '/modules/b.js': { id: '/modules/b.js', type: 'code' }
      });

      const outline = await rfcAuthor.produceOutline();

      expect(outline.artifactCount).toBe(2);
      expect(outline.recentArtifacts).toContain('`/modules/b.js`');
      expect(outline.suggestedSections).toEqual([
        '## Metrics Impact',
        '## Rollout Plan',
        '## Backout Strategy',
        '## Dependencies'
      ]);
    });
  });
});
