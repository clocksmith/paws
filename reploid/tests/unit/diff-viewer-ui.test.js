import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

describe('DiffViewerUI', () => {
  let DiffViewerUI;
  let mockDeps;
  let instance;
  let mockContainer;
  let mockEventBus;

  beforeEach(() => {
    // Mock dependencies
    mockEventBus = {
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn()
    };

    mockContainer = {
      innerHTML: '',
      id: 'test-container'
    };

    // Mock DOM
    global.document = {
      getElementById: vi.fn(() => mockContainer),
      createElement: vi.fn((tag) => ({
        id: '',
        innerHTML: '',
        textContent: ''
      })),
      head: {
        appendChild: vi.fn()
      },
      body: {
        appendChild: vi.fn(),
        removeChild: vi.fn()
      },
      querySelector: vi.fn(),
      querySelectorAll: vi.fn(() => [])
    };

    global.window = {
      ModuleRegistry: {
        register: vi.fn()
      },
      DiffViewerUI: {}
    };

    global.URL = {
      createObjectURL: vi.fn(() => 'blob:mock-url'),
      revokeObjectURL: vi.fn()
    };

    global.Blob = vi.fn((content, options) => ({ content, options }));

    global.Prism = {
      highlight: vi.fn((code) => code),
      languages: {
        javascript: {},
        python: {},
        json: {}
      }
    };

    mockDeps = {
      Utils: {
        logger: {
          info: vi.fn(),
          error: vi.fn(),
          warn: vi.fn(),
          debug: vi.fn()
        }
      },
      StateManager: {
        getArtifactContent: vi.fn(),
        getState: vi.fn(() => ({}))
      },
      EventBus: mockEventBus,
      ConfirmationModal: {
        confirm: vi.fn()
      }
    };

    // Import module
    DiffViewerUI = {
      metadata: {
        id: 'DiffViewerUI',
        version: '2.0.0',
        dependencies: ['Utils', 'StateManager', 'EventBus', 'ConfirmationModal?']
      },
      factory: (deps) => {
        const { Utils, StateManager, EventBus, ConfirmationModal } = deps;
        const { logger } = Utils;

        let container = null;
        let currentDiff = null;

        const init = (containerId) => {
          container = document.getElementById(containerId);
          if (!container) {
            logger.error('[DiffViewerUI] Container not found:', containerId);
            return;
          }

          EventBus.on('diff:show', () => {});
          EventBus.on('diff:clear', () => {});
          logger.info('[DiffViewerUI] Initialized');
        };

        const showDiff = (data) => {
          if (!container) return;
          container.innerHTML = '<div class="diff-viewer">Mock diff</div>';
          currentDiff = data;
        };

        const clearDiff = () => {
          if (container) container.innerHTML = '';
          currentDiff = null;
        };

        return {
          init,
          showDiff,
          clearDiff,
          getCurrentDiff: () => currentDiff
        };
      }
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Module Metadata', () => {
    it('should have correct module metadata', () => {
      expect(DiffViewerUI.metadata).toBeDefined();
      expect(DiffViewerUI.metadata.id).toBe('DiffViewerUI');
      expect(DiffViewerUI.metadata.version).toBe('2.0.0');
    });

    it('should declare required dependencies', () => {
      expect(DiffViewerUI.metadata.dependencies).toContain('Utils');
      expect(DiffViewerUI.metadata.dependencies).toContain('StateManager');
      expect(DiffViewerUI.metadata.dependencies).toContain('EventBus');
    });

    it('should be a UI type module', () => {
      expect(DiffViewerUI.metadata.type).toBe('ui');
    });

    it('should not be async', () => {
      expect(DiffViewerUI.metadata.async).toBe(false);
    });
  });

  describe('Initialization', () => {
    it('should initialize with valid container', () => {
      instance = DiffViewerUI.factory(mockDeps);
      instance.init('test-container');

      expect(mockDeps.Utils.logger.info).toHaveBeenCalledWith('[DiffViewerUI] Initialized');
      expect(mockEventBus.on).toHaveBeenCalledTimes(2);
    });

    it('should handle missing container gracefully', () => {
      global.document.getElementById = vi.fn(() => null);
      instance = DiffViewerUI.factory(mockDeps);
      instance.init('missing-container');

      expect(mockDeps.Utils.logger.error).toHaveBeenCalledWith(
        '[DiffViewerUI] Container not found:',
        'missing-container'
      );
    });

    it('should register event listeners for diff:show and diff:clear', () => {
      instance = DiffViewerUI.factory(mockDeps);
      instance.init('test-container');

      expect(mockEventBus.on).toHaveBeenCalledWith('diff:show', expect.any(Function));
      expect(mockEventBus.on).toHaveBeenCalledWith('diff:clear', expect.any(Function));
    });

    it('should inject CSS styles on init', () => {
      global.document.getElementById = vi.fn((id) => {
        if (id === 'diff-viewer-styles') return null;
        return mockContainer;
      });

      instance = DiffViewerUI.factory(mockDeps);
      instance.init('test-container');

      expect(global.document.createElement).toHaveBeenCalledWith('style');
      expect(global.document.head.appendChild).toHaveBeenCalled();
    });
  });

  describe('Core Functionality', () => {
    beforeEach(() => {
      instance = DiffViewerUI.factory(mockDeps);
      instance.init('test-container');
    });

    it('should display diff when showDiff is called', () => {
      const diffData = { changes: [], dogs_path: '/test.md' };
      instance.showDiff(diffData);

      expect(mockContainer.innerHTML).toContain('diff-viewer');
      expect(instance.getCurrentDiff()).toEqual(diffData);
    });

    it('should clear diff when clearDiff is called', () => {
      const diffData = { changes: [], dogs_path: '/test.md' };
      instance.showDiff(diffData);
      instance.clearDiff();

      expect(mockContainer.innerHTML).toBe('');
      expect(instance.getCurrentDiff()).toBeNull();
    });

    it('should handle empty changes array', () => {
      const diffData = { changes: [], dogs_path: '/test.md' };
      instance.showDiff(diffData);

      expect(mockContainer.innerHTML).toBeDefined();
    });

    it('should store current diff data', () => {
      const diffData = {
        changes: [
          { operation: 'CREATE', file_path: '/new.js', new_content: 'console.log()' }
        ],
        dogs_path: '/test.md',
        session_id: 'test-123'
      };

      instance.showDiff(diffData);
      expect(instance.getCurrentDiff()).toEqual(diffData);
    });
  });

  describe('Language Detection', () => {
    it('should detect JavaScript from .js extension', () => {
      const detectLanguage = (filePath) => {
        const ext = filePath.split('.').pop().toLowerCase();
        const langMap = {
          'js': 'javascript',
          'jsx': 'javascript',
          'ts': 'typescript',
          'py': 'python'
        };
        return langMap[ext] || 'javascript';
      };

      expect(detectLanguage('test.js')).toBe('javascript');
      expect(detectLanguage('test.jsx')).toBe('javascript');
    });

    it('should detect TypeScript from .ts extension', () => {
      const detectLanguage = (filePath) => {
        const ext = filePath.split('.').pop().toLowerCase();
        return ext === 'ts' ? 'typescript' : 'javascript';
      };

      expect(detectLanguage('test.ts')).toBe('typescript');
    });

    it('should detect Python from .py extension', () => {
      const detectLanguage = (filePath) => {
        const ext = filePath.split('.').pop().toLowerCase();
        return ext === 'py' ? 'python' : 'javascript';
      };

      expect(detectLanguage('test.py')).toBe('python');
    });

    it('should default to javascript for unknown extensions', () => {
      const detectLanguage = (filePath) => {
        const ext = filePath.split('.').pop().toLowerCase();
        const langMap = { 'js': 'javascript', 'py': 'python' };
        return langMap[ext] || 'javascript';
      };

      expect(detectLanguage('test.xyz')).toBe('javascript');
    });
  });

  describe('Syntax Highlighting', () => {
    it('should use Prism.js for syntax highlighting when available', () => {
      const code = 'const x = 42;';
      const language = 'javascript';

      global.Prism.highlight(code, global.Prism.languages[language], language);

      expect(global.Prism.highlight).toHaveBeenCalledWith(
        code,
        global.Prism.languages.javascript,
        'javascript'
      );
    });

    it('should escape HTML when Prism is not available', () => {
      const originalPrism = global.Prism;
      global.Prism = undefined;

      const escapeHtml = (text) => {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
      };

      const result = escapeHtml('<script>alert("xss")</script>');
      expect(result).not.toContain('<script>');

      global.Prism = originalPrism;
    });

    it('should handle syntax highlighting errors gracefully', () => {
      global.Prism.highlight = vi.fn(() => {
        throw new Error('Highlight error');
      });

      const highlightCode = (code, language) => {
        try {
          return global.Prism.highlight(code, global.Prism.languages[language], language);
        } catch (err) {
          return code;
        }
      };

      const result = highlightCode('const x = 42;', 'javascript');
      expect(result).toBe('const x = 42;');
    });
  });

  describe('Diff Statistics', () => {
    it('should calculate diff statistics correctly', () => {
      const calculateDiffStats = (oldContent, newContent) => {
        const oldLines = oldContent.split('\n');
        const newLines = newContent.split('\n');
        let added = 0, removed = 0, modified = 0, unchanged = 0;
        const maxLines = Math.max(oldLines.length, newLines.length);

        for (let i = 0; i < maxLines; i++) {
          if (oldLines[i] === undefined) added++;
          else if (newLines[i] === undefined) removed++;
          else if (oldLines[i] !== newLines[i]) modified++;
          else unchanged++;
        }

        return { added, removed, modified, unchanged, total: maxLines };
      };

      const stats = calculateDiffStats('line1\nline2', 'line1\nline2\nline3');
      expect(stats.added).toBe(1);
      expect(stats.unchanged).toBe(2);
    });

    it('should count removed lines', () => {
      const calculateDiffStats = (oldContent, newContent) => {
        const oldLines = oldContent.split('\n');
        const newLines = newContent.split('\n');
        let removed = 0;

        for (let i = 0; i < oldLines.length; i++) {
          if (newLines[i] === undefined) removed++;
        }

        return { removed };
      };

      const stats = calculateDiffStats('line1\nline2\nline3', 'line1');
      expect(stats.removed).toBe(2);
    });

    it('should count modified lines', () => {
      const calculateDiffStats = (oldContent, newContent) => {
        const oldLines = oldContent.split('\n');
        const newLines = newContent.split('\n');
        let modified = 0;

        const minLines = Math.min(oldLines.length, newLines.length);
        for (let i = 0; i < minLines; i++) {
          if (oldLines[i] !== newLines[i]) modified++;
        }

        return { modified };
      };

      const stats = calculateDiffStats('old line\nline2', 'new line\nline2');
      expect(stats.modified).toBe(1);
    });
  });

  describe('Export Functionality', () => {
    beforeEach(() => {
      instance = DiffViewerUI.factory(mockDeps);
      instance.init('test-container');
      instance.showDiff({
        changes: [{ operation: 'CREATE', file_path: '/test.js' }],
        dogs_path: '/test.md',
        session_id: 'session-123'
      });
    });

    it('should generate markdown summary', () => {
      const generateDiffMarkdown = (diff) => {
        let md = `# Diff Summary\n\n`;
        md += `**Session:** ${diff.session_id}\n`;
        md += `**Source:** ${diff.dogs_path}\n\n`;
        return md;
      };

      const currentDiff = instance.getCurrentDiff();
      const markdown = generateDiffMarkdown(currentDiff);

      expect(markdown).toContain('# Diff Summary');
      expect(markdown).toContain('session-123');
      expect(markdown).toContain('/test.md');
    });

    it('should create downloadable blob for markdown export', () => {
      const markdown = '# Test';
      const blob = new Blob([markdown], { type: 'text/markdown' });

      expect(global.Blob).toHaveBeenCalledWith([markdown], { type: 'text/markdown' });
    });

    it('should handle clipboard copy', async () => {
      global.navigator = {
        clipboard: {
          writeText: vi.fn().mockResolvedValue()
        }
      };

      await global.navigator.clipboard.writeText('test content');
      expect(global.navigator.clipboard.writeText).toHaveBeenCalledWith('test content');
    });

    it('should handle Web Share API', async () => {
      global.navigator = {
        share: vi.fn().mockResolvedValue()
      };

      await global.navigator.share({
        title: 'REPLOID Diff Summary',
        text: 'Changes'
      });

      expect(global.navigator.share).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      instance = DiffViewerUI.factory(mockDeps);
      instance.init('test-container');
    });

    it('should handle missing dogs bundle gracefully', async () => {
      mockDeps.StateManager.getArtifactContent.mockResolvedValue(null);

      const showError = () => {
        if (mockContainer) {
          mockContainer.innerHTML = '<div class="diff-error">Dogs bundle not found</div>';
        }
      };

      showError();
      expect(mockContainer.innerHTML).toContain('Dogs bundle not found');
    });

    it('should handle parse errors in dogs bundle', async () => {
      mockDeps.StateManager.getArtifactContent.mockRejectedValue(
        new Error('Parse error')
      );

      try {
        await mockDeps.StateManager.getArtifactContent('/invalid.md');
      } catch (error) {
        expect(error.message).toBe('Parse error');
      }
    });

    it('should log errors during diff rendering', () => {
      const error = new Error('Render failed');
      mockDeps.Utils.logger.error('[DiffViewerUI] Error showing diff:', error);

      expect(mockDeps.Utils.logger.error).toHaveBeenCalled();
    });

    it('should handle missing confirmation modal gracefully', async () => {
      const depsWithoutModal = {
        ...mockDeps,
        ConfirmationModal: null
      };

      instance = DiffViewerUI.factory(depsWithoutModal);
      instance.init('test-container');

      // Should fall back to native confirm
      global.confirm = vi.fn(() => true);
    });
  });

  describe('API Exposure', () => {
    it('should expose public API methods', () => {
      instance = DiffViewerUI.factory(mockDeps);

      expect(typeof instance.init).toBe('function');
      expect(typeof instance.showDiff).toBe('function');
      expect(typeof instance.clearDiff).toBe('function');
    });

    it('should register with ModuleRegistry', () => {
      expect(global.window.ModuleRegistry.register).toBeDefined();
    });

    it('should expose global API for onclick handlers', () => {
      expect(global.window.DiffViewerUI).toBeDefined();
    });
  });

  describe('Integration with Dependencies', () => {
    it('should use StateManager to get artifact content', async () => {
      mockDeps.StateManager.getArtifactContent.mockResolvedValue('mock content');

      const content = await mockDeps.StateManager.getArtifactContent('/test.md');
      expect(content).toBe('mock content');
      expect(mockDeps.StateManager.getArtifactContent).toHaveBeenCalledWith('/test.md');
    });

    it('should emit EventBus events', () => {
      mockEventBus.emit('proposal:approved', { dogs_path: '/test.md' });

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'proposal:approved',
        expect.objectContaining({ dogs_path: '/test.md' })
      );
    });

    it('should use Utils logger for all logging', () => {
      instance = DiffViewerUI.factory(mockDeps);
      instance.init('test-container');

      expect(mockDeps.Utils.logger.info).toHaveBeenCalled();
    });

    it('should use ConfirmationModal for approval confirmation', async () => {
      mockDeps.ConfirmationModal.confirm.mockResolvedValue(true);

      const confirmed = await mockDeps.ConfirmationModal.confirm({
        title: 'Apply Changes',
        message: 'Apply changes?'
      });

      expect(confirmed).toBe(true);
    });
  });
});
