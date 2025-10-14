/**
 * @fileoverview Unit tests for EventBus module
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load modules
const Utils = require(resolve(__dirname, '../../upgrades/utils.js'));
const EventBusModule = require(resolve(__dirname, '../../upgrades/event-bus.js'));

describe('EventBus', () => {
  let eventBus;

  beforeEach(() => {
    const utils = Utils.factory();
    const eventBusInstance = EventBusModule.factory({ Utils: utils });
    eventBus = eventBusInstance.api;
  });

  describe('on/off', () => {
    it('should register and call event listeners', () => {
      const listener = vi.fn();
      eventBus.on('test:event', listener);

      eventBus.emit('test:event', { data: 'test' });

      expect(listener).toHaveBeenCalledWith({ data: 'test' });
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should support multiple listeners for same event', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      eventBus.on('test:event', listener1);
      eventBus.on('test:event', listener2);

      eventBus.emit('test:event', { data: 'test' });

      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });

    it('should remove listener with off', () => {
      const listener = vi.fn();
      eventBus.on('test:event', listener);

      eventBus.off('test:event', listener);
      eventBus.emit('test:event', { data: 'test' });

      expect(listener).not.toHaveBeenCalled();
    });

    it('should return unsubscribe function', () => {
      const listener = vi.fn();
      const unsubscribe = eventBus.on('test:event', listener);

      expect(typeof unsubscribe).toBe('function');

      unsubscribe();
      eventBus.emit('test:event', { data: 'test' });

      expect(listener).not.toHaveBeenCalled();
    });

    it('should handle removing non-existent listener gracefully', () => {
      const listener = vi.fn();
      expect(() => {
        eventBus.off('nonexistent:event', listener);
      }).not.toThrow();
    });
  });

  describe('emit', () => {
    it('should not throw when emitting event with no listeners', () => {
      expect(() => {
        eventBus.emit('nonexistent:event', { data: 'test' });
      }).not.toThrow();
    });

    it('should pass data to all listeners', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      const testData = { foo: 'bar', count: 42 };

      eventBus.on('test:event', listener1);
      eventBus.on('test:event', listener2);

      eventBus.emit('test:event', testData);

      expect(listener1).toHaveBeenCalledWith(testData);
      expect(listener2).toHaveBeenCalledWith(testData);
    });

    it('should continue emitting to other listeners if one throws', () => {
      const listener1 = vi.fn(() => {
        throw new Error('Listener error');
      });
      const listener2 = vi.fn();

      eventBus.on('test:event', listener1);
      eventBus.on('test:event', listener2);

      eventBus.emit('test:event', { data: 'test' });

      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });
  });

  describe('Subscription Tracking', () => {
    it('should track subscriptions by module ID', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      eventBus.on('event1', listener1, 'TestModule');
      eventBus.on('event2', listener2, 'TestModule');

      const report = eventBus.getSubscriptionReport();
      expect(report).toHaveProperty('TestModule');
      expect(report.TestModule).toBe(2);
    });

    it('should unsubscribe all listeners for a module', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      eventBus.on('event1', listener1, 'TestModule');
      eventBus.on('event2', listener2, 'TestModule');

      eventBus.unsubscribeAll('TestModule');

      eventBus.emit('event1', {});
      eventBus.emit('event2', {});

      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).not.toHaveBeenCalled();
    });

    it('should not affect other modules when unsubscribing', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      eventBus.on('event1', listener1, 'Module1');
      eventBus.on('event2', listener2, 'Module2');

      eventBus.unsubscribeAll('Module1');

      eventBus.emit('event1', {});
      eventBus.emit('event2', {});

      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });

    it('should handle subscriptions without module ID', () => {
      const listener = vi.fn();
      eventBus.on('event', listener); // No module ID

      eventBus.emit('event', { data: 'test' });

      expect(listener).toHaveBeenCalled();
    });
  });

  describe('Event Isolation', () => {
    it('should keep different events separate', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      eventBus.on('event:a', listener1);
      eventBus.on('event:b', listener2);

      eventBus.emit('event:a', { data: 'a' });

      expect(listener1).toHaveBeenCalledWith({ data: 'a' });
      expect(listener2).not.toHaveBeenCalled();
    });

    it('should support namespaced event names', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      eventBus.on('agent:state:change', listener1);
      eventBus.on('agent:goal:set', listener2);

      eventBus.emit('agent:state:change', { state: 'IDLE' });

      expect(listener1).toHaveBeenCalled();
      expect(listener2).not.toHaveBeenCalled();
    });
  });

  describe('Real-World Scenarios', () => {
    it('should support state change notifications', () => {
      const stateListener = vi.fn();

      eventBus.on('agent:state:change', stateListener);

      eventBus.emit('agent:state:change', {
        from: 'IDLE',
        to: 'CURATING_CONTEXT',
        timestamp: Date.now()
      });

      expect(stateListener).toHaveBeenCalledTimes(1);
      expect(stateListener.mock.calls[0][0]).toHaveProperty('from', 'IDLE');
      expect(stateListener.mock.calls[0][0]).toHaveProperty('to', 'CURATING_CONTEXT');
    });

    it('should support artifact saved notifications', () => {
      const artifactListener = vi.fn();

      eventBus.on('artifact:saved', artifactListener);

      eventBus.emit('artifact:saved', {
        path: '/test.txt',
        size: 1024,
        timestamp: Date.now()
      });

      expect(artifactListener).toHaveBeenCalledTimes(1);
      expect(artifactListener.mock.calls[0][0]).toHaveProperty('path', '/test.txt');
    });

    it('should support tool execution notifications', () => {
      const toolListener = vi.fn();

      eventBus.on('tool:executed', toolListener);

      eventBus.emit('tool:executed', {
        tool: 'read_artifact',
        duration: 45,
        success: true
      });

      expect(toolListener).toHaveBeenCalledTimes(1);
      expect(toolListener.mock.calls[0][0]).toHaveProperty('tool', 'read_artifact');
    });
  });

  describe('Memory Management', () => {
    it('should not leak listeners when properly unsubscribed', () => {
      const listeners = [];

      // Register many listeners
      for (let i = 0; i < 100; i++) {
        const listener = vi.fn();
        listeners.push(listener);
        eventBus.on('test:event', listener, 'TestModule');
      }

      // Unsubscribe all
      eventBus.unsubscribeAll('TestModule');

      // Emit should not call any listeners
      eventBus.emit('test:event', {});

      listeners.forEach(listener => {
        expect(listener).not.toHaveBeenCalled();
      });
    });

    it('should allow same listener on different events', () => {
      const listener = vi.fn();

      eventBus.on('event:a', listener);
      eventBus.on('event:b', listener);

      eventBus.emit('event:a', { data: 'a' });
      eventBus.emit('event:b', { data: 'b' });

      expect(listener).toHaveBeenCalledTimes(2);
    });
  });
});
