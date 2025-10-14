// Event Bus Module for REPLOID - Project Phoenix
// A simple pub/sub system for decoupling modules.

const EventBus = {
  metadata: {
    id: 'EventBus',
    version: '1.0.0',
    dependencies: ['Utils'],
    async: false,
    type: 'service'
  },
  factory: (deps) => {
    const { Utils } = deps;
    const { logger, createSubscriptionTracker } = Utils;

    const _listeners = new Map();
    const _tracker = createSubscriptionTracker();

    const on = (eventName, listener, moduleId = null) => {
      if (!_listeners.has(eventName)) {
        _listeners.set(eventName, []);
      }
      _listeners.get(eventName).push(listener);
      logger.debug(`[EventBus] Listener registered for event: ${eventName}`);

      // Create unsubscribe function
      const unsubscribe = () => off(eventName, listener);

      // Track subscription for auto-cleanup if moduleId provided
      if (moduleId) {
        _tracker.track(moduleId, unsubscribe);
      }

      return unsubscribe;
    };

    const off = (eventName, listenerToRemove) => {
      if (!_listeners.has(eventName)) {
        return;
      }
      const listeners = _listeners.get(eventName).filter(l => l !== listenerToRemove);
      _listeners.set(eventName, listeners);
      logger.debug(`[EventBus] Listener removed for event: ${eventName}`);
    };

    const emit = (eventName, data) => {
      logger.info(`[EventBus] Emitting event: ${eventName}`, data);
      if (!_listeners.has(eventName)) {
        return;
      }
      _listeners.get(eventName).forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          logger.error(`[EventBus] Error in listener for event ${eventName}:`, error);
        }
      });
    };

    const unsubscribeAll = (moduleId) => {
      _tracker.unsubscribeAll(moduleId);
    };

    const getSubscriptionReport = () => {
      return _tracker.getAllActive();
    };

    return {
      api: {
        on,
        off,
        emit,
        unsubscribeAll,
        getSubscriptionReport
      }
    };
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = EventBus;
}
EventBus;
