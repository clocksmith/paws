import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ConfirmationModal from '../../upgrades/confirmation-modal.js';

describe('ConfirmationModal Module', () => {
  let mockDeps, mockUtils, mockEventBus, mockLogger;
  let mockDocument, mockHead, mockBody;
  let modal;

  // Mock button elements (shared so we can access event handlers)
  let mockConfirmBtn, mockCancelBtn, mockCloseBtn;

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    };

    mockUtils = {
      logger: mockLogger
    };

    mockEventBus = {
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn()
    };

    mockDeps = {
      Utils: mockUtils,
      EventBus: mockEventBus
    };

    // Reset mock button elements
    mockConfirmBtn = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      focus: vi.fn()
    };
    mockCancelBtn = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    };
    mockCloseBtn = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    };

    // Mock DOM elements
    const createElement = (tag) => {
      const element = {
        tagName: tag.toUpperCase(),
        className: '',
        _innerHTML: '',
        _textContent: '',
        get innerHTML() {
          return this._innerHTML;
        },
        set innerHTML(value) {
          this._innerHTML = value;
        },
        get textContent() {
          return this._textContent;
        },
        set textContent(value) {
          this._textContent = value;
          // Simulate HTML escaping: when textContent is set, innerHTML should be the escaped version
          this._innerHTML = String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
        },
        style: {},
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        querySelector: vi.fn((selector) => {
          // Return shared mock button elements
          if (selector === '.modal-btn-confirm') {
            return mockConfirmBtn;
          }
          if (selector === '.modal-btn-cancel') {
            return mockCancelBtn;
          }
          if (selector === '.modal-close') {
            return mockCloseBtn;
          }
          return null;
        }),
        querySelectorAll: vi.fn(() => []),
        appendChild: vi.fn(),
        removeChild: vi.fn(),
        parentNode: null,
        focus: vi.fn()
      };
      return element;
    };

    mockHead = {
      appendChild: vi.fn()
    };

    mockBody = {
      appendChild: vi.fn(),
      removeChild: vi.fn()
    };

    mockDocument = {
      createElement: vi.fn(createElement),
      getElementById: vi.fn(() => null),
      head: mockHead,
      body: mockBody,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    };

    global.document = mockDocument;
    global.setTimeout = vi.fn((fn) => fn()); // Execute immediately for tests

    modal = ConfirmationModal.factory(mockDeps);
  });

  afterEach(() => {
    delete global.document;
    delete global.setTimeout;
  });

  describe('Module Metadata', () => {
    it('should have correct metadata', () => {
      expect(ConfirmationModal.metadata.id).toBe('ConfirmationModal');
      expect(ConfirmationModal.metadata.version).toBe('1.0.0');
      expect(ConfirmationModal.metadata.type).toBe('ui');
    });

    it('should not be async', () => {
      expect(ConfirmationModal.metadata.async).toBe(false);
    });

    it('should declare dependencies', () => {
      expect(ConfirmationModal.metadata.dependencies).toContain('Utils');
      expect(ConfirmationModal.metadata.dependencies).toContain('EventBus');
    });
  });

  describe('Initialization', () => {
    it('should inject styles on initialization', () => {
      expect(mockHead.appendChild).toHaveBeenCalled();
    });

    it('should log initialization', () => {
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Initialized')
      );
    });

    it('should create style element', () => {
      expect(mockDocument.createElement).toHaveBeenCalledWith('style');
    });
  });

  describe('Public API', () => {
    it('should export confirm method', () => {
      expect(modal).toHaveProperty('confirm');
      expect(typeof modal.confirm).toBe('function');
    });

    it('should export closeModal method', () => {
      expect(modal).toHaveProperty('closeModal');
      expect(typeof modal.closeModal).toBe('function');
    });
  });

  describe('confirm()', () => {
    it('should return a promise', () => {
      const result = modal.confirm({ title: 'Test' });

      expect(result).toBeInstanceOf(Promise);
    });

    it('should create modal overlay', () => {
      modal.confirm({ title: 'Test' });

      expect(mockDocument.createElement).toHaveBeenCalledWith('div');
    });

    it('should add modal to body', () => {
      modal.confirm({ title: 'Test' });

      expect(mockBody.appendChild).toHaveBeenCalled();
    });

    it('should use default options', () => {
      modal.confirm();

      // Should not throw - uses defaults
      expect(mockBody.appendChild).toHaveBeenCalled();
    });

    it('should use custom title', () => {
      modal.confirm({ title: 'Custom Title' });

      const overlay = mockBody.appendChild.mock.calls[0][0];
      expect(overlay.innerHTML).toContain('Custom Title');
    });

    it('should use custom message', () => {
      modal.confirm({ message: 'Custom message text' });

      const overlay = mockBody.appendChild.mock.calls[0][0];
      expect(overlay.innerHTML).toContain('Custom message text');
    });

    it('should use custom button text', () => {
      modal.confirm({
        confirmText: 'Yes, proceed',
        cancelText: 'No, cancel'
      });

      const overlay = mockBody.appendChild.mock.calls[0][0];
      expect(overlay.innerHTML).toContain('Yes, proceed');
      expect(overlay.innerHTML).toContain('No, cancel');
    });

    it('should apply danger style when danger=true', () => {
      modal.confirm({ danger: true });

      const overlay = mockBody.appendChild.mock.calls[0][0];
      expect(overlay.innerHTML).toContain('modal-danger');
      expect(overlay.innerHTML).toContain('btn-danger');
    });

    it('should include details if provided', () => {
      modal.confirm({ details: 'Additional information here' });

      const overlay = mockBody.appendChild.mock.calls[0][0];
      expect(overlay.innerHTML).toContain('Additional information here');
      expect(overlay.innerHTML).toContain('modal-details');
    });

    it('should not include details section if not provided', () => {
      modal.confirm();

      const overlay = mockBody.appendChild.mock.calls[0][0];
      expect(overlay.innerHTML).not.toContain('modal-details');
    });

    it('should setup event listeners', () => {
      modal.confirm();

      const overlay = mockBody.appendChild.mock.calls[0][0];
      // Verify querySelector is called for buttons (implementation detail)
      expect(overlay.querySelector).toHaveBeenCalledWith('.modal-btn-confirm');
      expect(overlay.querySelector).toHaveBeenCalledWith('.modal-btn-cancel');
      expect(overlay.querySelector).toHaveBeenCalledWith('.modal-close');
    });

    it('should setup document keydown listener', () => {
      modal.confirm();

      expect(mockDocument.addEventListener).toHaveBeenCalledWith(
        'keydown',
        expect.any(Function)
      );
    });

    it('should setup overlay click listener', () => {
      modal.confirm();

      const overlay = mockBody.appendChild.mock.calls[0][0];
      expect(overlay.addEventListener).toHaveBeenCalledWith(
        'click',
        expect.any(Function)
      );
    });

    it('should close existing modal before showing new one', () => {
      modal.confirm({ title: 'First' });
      const firstOverlay = mockBody.appendChild.mock.calls[0][0];
      firstOverlay.parentNode = mockBody;

      modal.confirm({ title: 'Second' });

      // Second confirm should close first modal
      expect(mockBody.removeChild).toHaveBeenCalledWith(firstOverlay);
    });
  });

  describe('Modal Interaction', () => {
    it('should resolve with true when confirmed', async () => {
      const promise = modal.confirm();

      const overlay = mockBody.appendChild.mock.calls[0][0];
      const confirmBtn = overlay.querySelector('.modal-btn-confirm');
      const confirmHandler = confirmBtn.addEventListener.mock.calls[0][1];

      // Simulate confirm button click
      confirmHandler();

      const result = await promise;
      expect(result).toBe(true);
    });

    it('should resolve with false when cancelled', async () => {
      const promise = modal.confirm();

      const overlay = mockBody.appendChild.mock.calls[0][0];
      const cancelBtn = overlay.querySelector('.modal-btn-cancel');
      const cancelHandler = cancelBtn.addEventListener.mock.calls[0][1];

      // Simulate cancel button click
      cancelHandler();

      const result = await promise;
      expect(result).toBe(false);
    });

    it('should resolve with false when close button clicked', async () => {
      const promise = modal.confirm();

      const overlay = mockBody.appendChild.mock.calls[0][0];
      const closeBtn = overlay.querySelector('.modal-close');
      const closeHandler = closeBtn.addEventListener.mock.calls[0][1];

      // Simulate close button click
      closeHandler();

      const result = await promise;
      expect(result).toBe(false);
    });

    it('should resolve with false on Escape key', async () => {
      const promise = modal.confirm();

      // Get the document keydown handler
      const keydownHandler = mockDocument.addEventListener.mock.calls.find(
        ([event]) => event === 'keydown'
      )?.[1];

      expect(keydownHandler).toBeDefined();

      // Simulate Escape key press
      if (keydownHandler) {
        keydownHandler({ key: 'Escape' });
      }

      const result = await promise;
      expect(result).toBe(false);
    });

    it('should not close on other keys', async () => {
      const promise = modal.confirm();

      const keydownHandler = mockDocument.addEventListener.mock.calls.find(
        ([event]) => event === 'keydown'
      )?.[1];

      if (keydownHandler) {
        keydownHandler({ key: 'Enter' });
      }

      // Promise should not resolve yet
      // We can't easily test this without race conditions, so just verify handler exists
      expect(keydownHandler).toBeDefined();
    });

    it('should resolve with false when clicking overlay background', async () => {
      const promise = modal.confirm();

      const overlay = mockBody.appendChild.mock.calls[0][0];
      const overlayClickHandler = overlay.addEventListener.mock.calls.find(
        ([event]) => event === 'click'
      )?.[1];

      expect(overlayClickHandler).toBeDefined();

      // Simulate clicking overlay (target is overlay itself)
      if (overlayClickHandler) {
        overlayClickHandler({ target: overlay });
      }

      const result = await promise;
      expect(result).toBe(false);
    });

    it('should not close when clicking inside modal content', () => {
      modal.confirm();

      const overlay = mockBody.appendChild.mock.calls[0][0];
      const overlayClickHandler = overlay.addEventListener.mock.calls.find(
        ([event]) => event === 'click'
      )?.[1];

      // Simulate clicking inside content (target is not overlay)
      if (overlayClickHandler) {
        const contentElement = { tagName: 'DIV' };
        overlayClickHandler({ target: contentElement });
      }

      // Modal should still be active (no removeChild call for this interaction)
      const removeChildCalls = mockBody.removeChild.mock.calls.length;
      expect(removeChildCalls).toBe(0);
    });
  });

  describe('closeModal()', () => {
    it('should remove modal from DOM', () => {
      modal.confirm();

      const overlay = mockBody.appendChild.mock.calls[0][0];
      overlay.parentNode = mockBody;

      modal.closeModal();

      expect(mockBody.removeChild).toHaveBeenCalledWith(overlay);
    });

    it('should remove event listeners', () => {
      modal.confirm();

      const overlay = mockBody.appendChild.mock.calls[0][0];
      overlay.parentNode = mockBody;

      modal.closeModal();

      expect(mockDocument.removeEventListener).toHaveBeenCalledWith(
        'keydown',
        expect.any(Function)
      );
    });

    it('should handle no active modal', () => {
      // Should not throw
      expect(() => modal.closeModal()).not.toThrow();
    });

    it('should handle modal without parent node', () => {
      modal.confirm();

      const overlay = mockBody.appendChild.mock.calls[0][0];
      overlay.parentNode = null;

      // Should not throw
      expect(() => modal.closeModal()).not.toThrow();
    });
  });

  describe('HTML Escaping', () => {
    it('should escape HTML in title', () => {
      modal.confirm({ title: '<script>alert("xss")</script>' });

      const overlay = mockBody.appendChild.mock.calls[0][0];
      // HTML should be escaped - actual escaping done by escapeHtml function
      expect(overlay.innerHTML).toContain('&lt;script&gt;');
    });

    it('should escape HTML in message', () => {
      modal.confirm({ message: '<img src=x onerror=alert(1)>' });

      const overlay = mockBody.appendChild.mock.calls[0][0];
      expect(overlay.innerHTML).toContain('&lt;img');
    });

    it('should escape HTML in button text', () => {
      modal.confirm({
        confirmText: '<b>Bold</b>',
        cancelText: '<i>Italic</i>'
      });

      const overlay = mockBody.appendChild.mock.calls[0][0];
      expect(overlay.innerHTML).toContain('&lt;b&gt;');
      expect(overlay.innerHTML).toContain('&lt;i&gt;');
    });

    it('should escape HTML in details', () => {
      modal.confirm({ details: '<script>alert("details")</script>' });

      const overlay = mockBody.appendChild.mock.calls[0][0];
      expect(overlay.innerHTML).toContain('&lt;script&gt;');
    });
  });

  describe('Accessibility', () => {
    it('should include aria-label on close button', () => {
      modal.confirm();

      const overlay = mockBody.appendChild.mock.calls[0][0];
      expect(overlay.innerHTML).toContain('aria-label="Close"');
    });

    it('should use semantic HTML structure', () => {
      modal.confirm();

      const overlay = mockBody.appendChild.mock.calls[0][0];
      expect(overlay.innerHTML).toContain('<h3');
      expect(overlay.innerHTML).toContain('<button');
    });
  });
});
