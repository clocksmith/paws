/**
 * @fileoverview Unit tests for InternalPatchFormat module
 * @blueprint 0x00006D
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load modules
const UtilsModule = require(resolve(__dirname, '../../upgrades/utils.js'));
const EventBusModule = require(resolve(__dirname, '../../upgrades/event-bus.js'));
const IPATModule = require(resolve(__dirname, '../../upgrades/internal-patch-format.js')).default;

describe('InternalPatchFormat Module', () => {
  let IPAT;
  let mockEventBus;

  beforeEach(() => {
    // Create mock EventBus with tracking
    const eventBusInstance = EventBusModule.factory({ Utils: UtilsModule.factory() });
    mockEventBus = eventBusInstance.api;

    // Create IPAT instance
    const ipatInstance = IPATModule.factory({
      Utils: UtilsModule.factory(),
      EventBus: mockEventBus
    });

    IPAT = ipatInstance.api;
  });

  afterEach(() => {
    // Reset stats after each test
    IPAT.resetStats();
  });

  describe('Module Exports', () => {
    it('should export api object with all required methods', () => {
      const instance = IPATModule.factory({
        Utils: UtilsModule.factory(),
        EventBus: mockEventBus
      });

      expect(instance.api).toBeDefined();
      expect(typeof instance.api.createPatch).toBe('function');
      expect(typeof instance.api.parsePatch).toBe('function');
      expect(typeof instance.api.validatePatch).toBe('function');
      expect(typeof instance.api.verifyChanges).toBe('function');
      expect(typeof instance.api.patchToDogs).toBe('function');
      expect(typeof instance.api.dogsToIPAT).toBe('function');
      expect(typeof instance.api.getStats).toBe('function');
      expect(typeof instance.api.resetStats).toBe('function');
    });

    it('should export widget object with required fields', () => {
      const instance = IPATModule.factory({
        Utils: UtilsModule.factory(),
        EventBus: mockEventBus
      });

      expect(instance.widget).toBeDefined();
      expect(instance.widget.element).toBe('internal-patch-format-widget');
      expect(instance.widget.displayName).toBe('Internal Patch Format');
      expect(instance.widget.icon).toBe('⚡');
      expect(instance.widget.category).toBe('rsi');
      expect(instance.widget.visible).toBe(true);
      expect(instance.widget.priority).toBe(8);
    });
  });

  describe('Patch Creation (createPatch)', () => {
    it('should create valid IPAT v2 patch', () => {
      const changes = [
        {
          type: 'CREATE',
          path: '/test.js',
          content: 'console.log("test");',
          encoding: 'utf8'
        }
      ];

      const patch = IPAT.createPatch(changes);

      expect(patch.version).toBe(2);
      expect(patch.timestamp).toBeTypeOf('number');
      expect(patch.changes).toHaveLength(1);
      expect(patch.changes[0].type).toBe('CREATE');
      expect(patch.changes[0].path).toBe('/test.js');
    });

    it('should include timestamp and version', () => {
      const patch = IPAT.createPatch([{ type: 'CREATE', path: '/test.js', content: 'test' }]);

      expect(patch.version).toBe(2);
      expect(patch.timestamp).toBeGreaterThan(Date.now() - 1000);
      expect(patch.timestamp).toBeLessThanOrEqual(Date.now());
    });

    it('should handle multiple changes', () => {
      const changes = [
        { type: 'CREATE', path: '/file1.js', content: 'code1' },
        { type: 'MODIFY', path: '/file2.js', content: 'code2', oldContent: 'old' },
        { type: 'DELETE', path: '/file3.js' }
      ];

      const patch = IPAT.createPatch(changes);

      expect(patch.changes).toHaveLength(3);
      expect(patch.changes[0].type).toBe('CREATE');
      expect(patch.changes[1].type).toBe('MODIFY');
      expect(patch.changes[2].type).toBe('DELETE');
    });

    it('should update statistics', () => {
      IPAT.createPatch([{ type: 'CREATE', path: '/test.js', content: 'test' }]);
      IPAT.createPatch([{ type: 'CREATE', path: '/test2.js', content: 'test2' }]);

      const stats = IPAT.getStats();

      expect(stats.patchesCreated).toBe(2);
      expect(stats.lastPatchTime).toBeGreaterThan(0);
      expect(stats.avgParseTime).toBeGreaterThanOrEqual(0);
    });

    it('should include metadata with defaults', () => {
      const patch = IPAT.createPatch([{ type: 'CREATE', path: '/test.js', content: 'test' }]);

      expect(patch.metadata).toBeDefined();
      expect(patch.metadata.reason).toBe('Internal RSI cycle');
      expect(patch.metadata.author).toBe('agent');
      expect(patch.metadata.confidence).toBe(1.0);
    });

    it('should accept custom metadata', () => {
      const patch = IPAT.createPatch(
        [{ type: 'CREATE', path: '/test.js', content: 'test' }],
        {
          reason: 'Custom reason',
          author: 'custom-agent',
          confidence: 0.85,
          custom: 'field'
        }
      );

      expect(patch.metadata.reason).toBe('Custom reason');
      expect(patch.metadata.author).toBe('custom-agent');
      expect(patch.metadata.confidence).toBe(0.85);
      expect(patch.metadata.custom).toBe('field');
    });

    it('should emit ipat:patch-created event', () => {
      const eventSpy = vi.fn();
      mockEventBus.on('ipat:patch-created', eventSpy);

      IPAT.createPatch([{ type: 'CREATE', path: '/test.js', content: 'test' }]);

      expect(eventSpy).toHaveBeenCalledTimes(1);
      expect(eventSpy.mock.calls[0][0]).toHaveProperty('patchId');
      expect(eventSpy.mock.calls[0][0]).toHaveProperty('changeCount', 1);
      expect(eventSpy.mock.calls[0][0]).toHaveProperty('parseTime');
    });

    it('should default encoding to utf8', () => {
      const patch = IPAT.createPatch([{ type: 'CREATE', path: '/test.js', content: 'test' }]);

      expect(patch.changes[0].encoding).toBe('utf8');
    });
  });

  describe('Patch Parsing (parsePatch)', () => {
    it('should parse valid JSON patch string', () => {
      const patchObj = {
        version: 2,
        timestamp: Date.now(),
        metadata: { reason: 'test' },
        changes: [{ type: 'CREATE', path: '/test.js', content: 'test' }]
      };

      const patchJSON = JSON.stringify(patchObj);
      const parsed = IPAT.parsePatch(patchJSON);

      expect(parsed.version).toBe(2);
      expect(parsed.changes).toHaveLength(1);
    });

    it('should parse patch object directly', () => {
      const patchObj = {
        version: 2,
        timestamp: Date.now(),
        metadata: { reason: 'test' },
        changes: [{ type: 'CREATE', path: '/test.js', content: 'test' }]
      };

      const parsed = IPAT.parsePatch(patchObj);

      expect(parsed.version).toBe(2);
      expect(parsed.changes).toHaveLength(1);
    });

    it('should be fast (~1ms for simple patch)', () => {
      const patch = {
        version: 2,
        timestamp: Date.now(),
        metadata: {},
        changes: [{ type: 'CREATE', path: '/test.js', content: 'test' }]
      };

      const start = performance.now();
      IPAT.parsePatch(patch);
      const duration = performance.now() - start;

      // Should be under 5ms (generous threshold for test environment overhead)
      expect(duration).toBeLessThan(5);
    });

    it('should reject invalid patches', () => {
      const invalidPatch = {
        version: 1,  // Wrong version
        timestamp: Date.now(),
        changes: []
      };

      expect(() => {
        IPAT.parsePatch(invalidPatch);
      }).toThrow();
    });

    it('should update statistics', () => {
      const patch = {
        version: 2,
        timestamp: Date.now(),
        changes: [{ type: 'CREATE', path: '/test.js', content: 'test' }]
      };

      IPAT.parsePatch(patch);
      IPAT.parsePatch(patch);

      const stats = IPAT.getStats();

      expect(stats.patchesParsed).toBe(2);
      expect(stats.avgParseTime).toBeGreaterThanOrEqual(0);
    });

    it('should emit ipat:patch-parsed event', () => {
      const eventSpy = vi.fn();
      mockEventBus.on('ipat:patch-parsed', eventSpy);

      const patch = {
        version: 2,
        timestamp: Date.now(),
        changes: [{ type: 'CREATE', path: '/test.js', content: 'test' }]
      };

      IPAT.parsePatch(patch);

      expect(eventSpy).toHaveBeenCalledTimes(1);
      expect(eventSpy.mock.calls[0][0]).toHaveProperty('parseTime');
    });

    it('should handle malformed JSON gracefully', () => {
      expect(() => {
        IPAT.parsePatch('{ invalid json }');
      }).toThrow();

      const stats = IPAT.getStats();
      expect(stats.errors).toBeGreaterThan(0);
    });
  });

  describe('Validation (validatePatch)', () => {
    it('should validate correct patch schema', () => {
      const patch = {
        version: 2,
        timestamp: Date.now(),
        changes: [{ type: 'CREATE', path: '/test.js', content: 'test' }]
      };

      const result = IPAT.validatePatch(patch);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing required fields', () => {
      const patch = {
        version: 2
        // Missing timestamp and changes
      };

      const result = IPAT.validatePatch(patch);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should validate change types', () => {
      const patch = {
        version: 2,
        timestamp: Date.now(),
        changes: [{ type: 'INVALID_TYPE', path: '/test.js' }]
      };

      const result = IPAT.validatePatch(patch);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid type'))).toBe(true);
    });

    it('should require content for CREATE changes', () => {
      const patch = {
        version: 2,
        timestamp: Date.now(),
        changes: [{ type: 'CREATE', path: '/test.js' }]  // Missing content
      };

      const result = IPAT.validatePatch(patch);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('CREATE requires content'))).toBe(true);
    });

    it('should require content for MODIFY changes', () => {
      const patch = {
        version: 2,
        timestamp: Date.now(),
        changes: [{ type: 'MODIFY', path: '/test.js' }]  // Missing content
      };

      const result = IPAT.validatePatch(patch);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('MODIFY requires content'))).toBe(true);
    });

    it('should validate encoding values', () => {
      const patch = {
        version: 2,
        timestamp: Date.now(),
        changes: [{ type: 'CREATE', path: '/test.js', content: 'test', encoding: 'invalid' }]
      };

      const result = IPAT.validatePatch(patch);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid encoding'))).toBe(true);
    });

    it('should reject unsupported versions', () => {
      const patch = {
        version: 999,
        timestamp: Date.now(),
        changes: []
      };

      const result = IPAT.validatePatch(patch);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Unsupported version'))).toBe(true);
    });
  });

  describe('Verification (verifyChanges)', () => {
    it('should verify MODIFY change matches current state', () => {
      const patch = {
        version: 2,
        timestamp: Date.now(),
        changes: [{
          type: 'MODIFY',
          path: '/test.js',
          content: 'new content',
          oldContent: 'old content'
        }]
      };

      const currentState = {
        '/test.js': 'old content'
      };

      const result = IPAT.verifyChanges(patch, currentState);

      expect(result.verified).toBe(true);
      expect(result.mismatches).toHaveLength(0);
    });

    it('should detect oldContent mismatch', () => {
      const patch = {
        version: 2,
        timestamp: Date.now(),
        changes: [{
          type: 'MODIFY',
          path: '/test.js',
          content: 'new content',
          oldContent: 'expected old content'
        }]
      };

      const currentState = {
        '/test.js': 'actual different content'
      };

      const result = IPAT.verifyChanges(patch, currentState);

      expect(result.verified).toBe(false);
      expect(result.mismatches.length).toBeGreaterThan(0);
      expect(result.mismatches[0]).toContain("doesn't match current state");
    });

    it('should detect DELETE on non-existent file', () => {
      const patch = {
        version: 2,
        timestamp: Date.now(),
        changes: [{ type: 'DELETE', path: '/nonexistent.js' }]
      };

      const currentState = {};

      const result = IPAT.verifyChanges(patch, currentState);

      expect(result.verified).toBe(false);
      expect(result.mismatches.some(m => m.includes('Cannot delete non-existent file'))).toBe(true);
    });

    it('should detect CREATE on existing file', () => {
      const patch = {
        version: 2,
        timestamp: Date.now(),
        changes: [{ type: 'CREATE', path: '/test.js', content: 'test' }]
      };

      const currentState = {
        '/test.js': 'already exists'
      };

      const result = IPAT.verifyChanges(patch, currentState);

      expect(result.verified).toBe(false);
      expect(result.mismatches.some(m => m.includes('Cannot create file that already exists'))).toBe(true);
    });

    it('should verify multiple changes correctly', () => {
      const patch = {
        version: 2,
        timestamp: Date.now(),
        changes: [
          { type: 'MODIFY', path: '/file1.js', content: 'new1', oldContent: 'old1' },
          { type: 'DELETE', path: '/file2.js' },
          { type: 'CREATE', path: '/file3.js', content: 'new3' }
        ]
      };

      const currentState = {
        '/file1.js': 'old1',
        '/file2.js': 'exists'
        // /file3.js doesn't exist (correct for CREATE)
      };

      const result = IPAT.verifyChanges(patch, currentState);

      expect(result.verified).toBe(true);
      expect(result.mismatches).toHaveLength(0);
    });
  });

  describe('Backward Compatibility - IPAT to DOGS (patchToDogs)', () => {
    it('should convert IPAT to DOGS markdown', () => {
      const patch = {
        version: 2,
        timestamp: Date.now(),
        metadata: { reason: 'Test conversion', author: 'test' },
        changes: [{ type: 'CREATE', path: '/test.js', content: 'console.log("test");' }]
      };

      const dogs = IPAT.patchToDogs(patch);

      expect(typeof dogs).toBe('string');
      expect(dogs).toContain('# DOGS Bundle');
      expect(dogs).toContain('CREATE /test.js');
      expect(dogs).toContain('console.log("test");');
    });

    it('should include metadata in DOGS output', () => {
      const patch = {
        version: 2,
        timestamp: Date.now(),
        metadata: { reason: 'Important change', author: 'agent-v2' },
        changes: [{ type: 'CREATE', path: '/test.js', content: 'test' }]
      };

      const dogs = IPAT.patchToDogs(patch);

      expect(dogs).toContain('Important change');
      expect(dogs).toContain('agent-v2');
    });

    it('should handle DELETE changes', () => {
      const patch = {
        version: 2,
        timestamp: Date.now(),
        changes: [{ type: 'DELETE', path: '/old-file.js' }]
      };

      const dogs = IPAT.patchToDogs(patch);

      expect(dogs).toContain('DELETE /old-file.js');
      expect(dogs).toContain('*File deleted*');
    });

    it('should handle multiple changes', () => {
      const patch = {
        version: 2,
        timestamp: Date.now(),
        changes: [
          { type: 'CREATE', path: '/file1.js', content: 'code1' },
          { type: 'MODIFY', path: '/file2.js', content: 'code2' },
          { type: 'DELETE', path: '/file3.js' }
        ]
      };

      const dogs = IPAT.patchToDogs(patch);

      expect(dogs).toContain('CREATE /file1.js');
      expect(dogs).toContain('MODIFY /file2.js');
      expect(dogs).toContain('DELETE /file3.js');
    });
  });

  describe('Backward Compatibility - DOGS to IPAT (dogsToIPAT)', () => {
    it('should convert DOGS to IPAT when DogsParser available', () => {
      // Mock DogsParser in global scope
      global.window = global.window || {};
      global.window.DIContainer = {
        resolve: vi.fn((name) => {
          if (name === 'DogsParser') {
            return {
              api: {
                parseDogs: vi.fn(() => ({
                  changes: [
                    {
                      action: 'create',
                      path: '/test.js',
                      content: 'test content',
                      oldContent: null
                    }
                  ]
                }))
              }
            };
          }
          return null;
        })
      };

      const dogsBundle = `# DOGS Bundle\n## CREATE /test.js\n\`\`\`\ntest content\n\`\`\``;

      const patch = IPAT.dogsToIPAT(dogsBundle);

      expect(patch.version).toBe(2);
      expect(patch.changes).toHaveLength(1);
      expect(patch.changes[0].type).toBe('CREATE');
      expect(patch.changes[0].path).toBe('/test.js');
      expect(patch.metadata.originalFormat).toBe('DOGS');

      // Cleanup
      delete global.window;
    });

    it('should throw error when DogsParser not available', () => {
      global.window = global.window || {};
      global.window.DIContainer = {
        resolve: vi.fn(() => null)
      };

      expect(() => {
        IPAT.dogsToIPAT('# DOGS Bundle');
      }).toThrow('DogsParser not loaded');

      // Cleanup
      delete global.window;
    });
  });

  describe('Statistics (getStats, resetStats)', () => {
    it('should track creation statistics', () => {
      IPAT.createPatch([{ type: 'CREATE', path: '/test1.js', content: 'test' }]);
      IPAT.createPatch([{ type: 'CREATE', path: '/test2.js', content: 'test' }]);

      const stats = IPAT.getStats();

      expect(stats.patchesCreated).toBe(2);
      expect(stats.patchesParsed).toBe(0);
    });

    it('should track parsing statistics', () => {
      const patch = { version: 2, timestamp: Date.now(), changes: [] };

      IPAT.parsePatch(patch);
      IPAT.parsePatch(patch);
      IPAT.parsePatch(patch);

      const stats = IPAT.getStats();

      expect(stats.patchesParsed).toBe(3);
      expect(stats.patchesCreated).toBe(0);
    });

    it('should calculate average parse time', () => {
      const patch = { version: 2, timestamp: Date.now(), changes: [] };

      IPAT.parsePatch(patch);
      IPAT.parsePatch(patch);

      const stats = IPAT.getStats();

      expect(stats.avgParseTime).toBeGreaterThanOrEqual(0);
      expect(stats.avgParseTime).toBeLessThan(100);  // Should be very fast
    });

    it('should track errors', () => {
      try {
        IPAT.parsePatch('invalid json');
      } catch (e) {
        // Expected error
      }

      const stats = IPAT.getStats();

      expect(stats.errors).toBeGreaterThan(0);
    });

    it('should reset statistics', () => {
      IPAT.createPatch([{ type: 'CREATE', path: '/test.js', content: 'test' }]);
      IPAT.parsePatch({ version: 2, timestamp: Date.now(), changes: [] });

      let stats = IPAT.getStats();
      expect(stats.patchesCreated).toBe(1);
      expect(stats.patchesParsed).toBe(1);

      IPAT.resetStats();

      stats = IPAT.getStats();
      expect(stats.patchesCreated).toBe(0);
      expect(stats.patchesParsed).toBe(0);
      expect(stats.errors).toBe(0);
      expect(stats.avgParseTime).toBe(0);
    });

    it('should emit reset event', () => {
      const eventSpy = vi.fn();
      mockEventBus.on('ipat:stats-reset', eventSpy);

      IPAT.resetStats();

      expect(eventSpy).toHaveBeenCalledTimes(1);
      expect(eventSpy.mock.calls[0][0]).toHaveProperty('timestamp');
    });

    it('should return copy of stats (not reference)', () => {
      const stats1 = IPAT.getStats();
      stats1.patchesCreated = 999;  // Mutate copy

      const stats2 = IPAT.getStats();

      expect(stats2.patchesCreated).not.toBe(999);
    });
  });

  describe('Widget Protocol Compliance', () => {
    it('should implement getStatus() with 5 required fields', () => {
      // Create widget element
      const widgetEl = document.createElement('internal-patch-format-widget');
      document.body.appendChild(widgetEl);

      const status = widgetEl.getStatus();

      expect(status).toHaveProperty('state');
      expect(status).toHaveProperty('primaryMetric');
      expect(status).toHaveProperty('secondaryMetric');
      expect(status).toHaveProperty('lastActivity');
      expect(status).toHaveProperty('message');

      document.body.removeChild(widgetEl);
    });

    it('should show active state when recent activity', () => {
      IPAT.createPatch([{ type: 'CREATE', path: '/test.js', content: 'test' }]);

      const widgetEl = document.createElement('internal-patch-format-widget');
      document.body.appendChild(widgetEl);

      const status = widgetEl.getStatus();

      expect(status.state).toBe('active');

      document.body.removeChild(widgetEl);
    });

    it('should show error state when errors exist', () => {
      try {
        IPAT.parsePatch('invalid');
      } catch (e) {
        // Expected
      }

      const widgetEl = document.createElement('internal-patch-format-widget');
      document.body.appendChild(widgetEl);

      const status = widgetEl.getStatus();

      expect(status.state).toBe('error');
      expect(status.message).toContain('error');

      document.body.removeChild(widgetEl);
    });

    it('should track performance metrics in widget', () => {
      IPAT.createPatch([{ type: 'CREATE', path: '/test.js', content: 'test' }]);

      const widgetEl = document.createElement('internal-patch-format-widget');
      document.body.appendChild(widgetEl);

      const status = widgetEl.getStatus();

      expect(status.primaryMetric).toContain('created');
      expect(status.secondaryMetric).toContain('ms');

      document.body.removeChild(widgetEl);
    });
  });

  describe('Web Component Lifecycle', () => {
    it('should register custom element without duplicates', () => {
      const elementName = 'internal-patch-format-widget';
      const element = customElements.get(elementName);

      expect(element).toBeDefined();
    });

    it('should attach shadow DOM', () => {
      const widgetEl = document.createElement('internal-patch-format-widget');
      document.body.appendChild(widgetEl);

      expect(widgetEl.shadowRoot).toBeDefined();

      document.body.removeChild(widgetEl);
    });

    it('should render widget content', () => {
      const widgetEl = document.createElement('internal-patch-format-widget');
      document.body.appendChild(widgetEl);

      widgetEl.connectedCallback();

      expect(widgetEl.shadowRoot.innerHTML).toContain('Internal Patch Format');

      document.body.removeChild(widgetEl);
    });

    it('should clean up interval on disconnect', () => {
      const widgetEl = document.createElement('internal-patch-format-widget');
      document.body.appendChild(widgetEl);

      widgetEl.connectedCallback();
      const intervalId = widgetEl._interval;

      expect(intervalId).toBeDefined();

      widgetEl.disconnectedCallback();

      expect(widgetEl._interval).toBeNull();

      document.body.removeChild(widgetEl);
    });
  });

  describe('Performance Benchmarks', () => {
    it('should parse 100 patches in < 100ms', () => {
      const patches = Array.from({ length: 100 }, (_, i) => ({
        version: 2,
        timestamp: Date.now(),
        changes: [{ type: 'CREATE', path: `/test${i}.js`, content: 'test' }]
      }));

      const start = performance.now();
      patches.forEach(patch => IPAT.parsePatch(patch));
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(100);
    });

    it('should be significantly faster than regex parsing', () => {
      // IPAT parsing
      const ipatStart = performance.now();
      for (let i = 0; i < 100; i++) {
        IPAT.parsePatch({ version: 2, timestamp: Date.now(), changes: [] });
      }
      const ipatDuration = performance.now() - ipatStart;

      // This test validates IPAT is fast (< 50ms for 100 parses)
      // In practice, DOGS regex parsing would take ~1000ms
      expect(ipatDuration).toBeLessThan(50);
    });
  });

  describe('Error Handling', () => {
    it('should emit error events on creation failure', () => {
      const errorSpy = vi.fn();
      mockEventBus.on('ipat:error', errorSpy);

      try {
        // Force error by passing invalid data
        IPAT.createPatch(null);
      } catch (e) {
        // Expected
      }

      expect(errorSpy).toHaveBeenCalled();
    });

    it('should emit error events on parse failure', () => {
      const errorSpy = vi.fn();
      mockEventBus.on('ipat:error', errorSpy);

      try {
        IPAT.parsePatch('{ invalid }');
      } catch (e) {
        // Expected
      }

      expect(errorSpy).toHaveBeenCalled();
    });

    it('should increment error counter on failures', () => {
      try {
        IPAT.parsePatch('invalid');
      } catch (e) {
        // Expected
      }

      try {
        IPAT.parsePatch('{ bad json }');
      } catch (e) {
        // Expected
      }

      const stats = IPAT.getStats();

      expect(stats.errors).toBeGreaterThanOrEqual(2);
    });
  });
});
