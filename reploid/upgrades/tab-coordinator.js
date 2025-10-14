/**
 * @fileoverview Inter-Tab Coordinator for REPLOID
 * Synchronizes state across multiple browser tabs to prevent conflicts.
 *
 * @module TabCoordinator
 * @version 1.0.0
 * @category coordination
 */

const TabCoordinator = {
  metadata: {
    id: 'TabCoordinator',
    version: '1.0.0',
    dependencies: ['StateManager', 'EventBus', 'Utils'],
    async: true,
    type: 'coordination'
  },

  factory: (deps) => {
    const { StateManager, EventBus, Utils } = deps;
    const { logger } = Utils;

    let broadcastChannel = null;
    let tabId = null;
    let isInitialized = false;

    /**
     * Initialize tab coordination
     */
    const init = async () => {
      logger.info('[TabCoordinator] Initializing inter-tab coordination');

      // Generate unique tab ID
      tabId = `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Create BroadcastChannel for communication
      if ('BroadcastChannel' in window) {
        broadcastChannel = new BroadcastChannel('reploid-tabs');

        broadcastChannel.onmessage = (event) => {
          handleMessage(event.data);
        };

        // Announce presence
        broadcast({
          type: 'tab-joined',
          tabId
        });

        isInitialized = true;
        logger.info(`[TabCoordinator] Tab ${tabId} joined coordination`);
      } else {
        logger.warn('[TabCoordinator] BroadcastChannel not supported');
        return false;
      }

      // Listen for state changes to broadcast
      EventBus.on('state:updated', (data) => {
        if (data.source !== 'remote') {
          broadcast({
            type: 'state-update',
            tabId,
            state: data.state,
            timestamp: Date.now()
          });
        }
      });

      return true;
    };

    /**
     * Handle messages from other tabs
     */
    const handleMessage = (message) => {
      if (message.tabId === tabId) return; // Ignore own messages

      switch (message.type) {
        case 'tab-joined':
          logger.info(`[TabCoordinator] Tab ${message.tabId} joined`);
          EventBus.emit('tab:joined', { tabId: message.tabId });
          break;

        case 'state-update':
          logger.debug(`[TabCoordinator] State update from ${message.tabId}`);
          handleRemoteStateUpdate(message);
          break;

        case 'lock-request':
          handleLockRequest(message);
          break;

        case 'lock-release':
          handleLockRelease(message);
          break;
      }
    };

    /**
     * Handle remote state update
     */
    const handleRemoteStateUpdate = async (message) => {
      // Use last-write-wins strategy
      const currentState = await StateManager.getState();

      if (!currentState._timestamp || message.timestamp > currentState._timestamp) {
        // Remote state is newer, apply it
        await StateManager.updateState({
          ...message.state,
          _timestamp: message.timestamp,
          _source: 'remote'
        });

        EventBus.emit('state:remote-update', {
          from: message.tabId,
          state: message.state
        });
      }
    };

    /**
     * Broadcast message to all tabs
     */
    const broadcast = (message) => {
      if (!broadcastChannel) return false;

      broadcastChannel.postMessage({
        ...message,
        tabId,
        timestamp: Date.now()
      });

      return true;
    };

    /**
     * Request exclusive lock for operation
     */
    const requestLock = async (resource, timeout = 5000) => {
      if (!isInitialized) return true; // No coordination needed

      return new Promise((resolve) => {
        const lockId = `lock_${Date.now()}`;

        broadcast({
          type: 'lock-request',
          resource,
          lockId
        });

        // Wait for objections
        setTimeout(() => {
          resolve(lockId);
        }, 100);
      });
    };

    /**
     * Release lock
     */
    const releaseLock = (lockId) => {
      if (!isInitialized) return;

      broadcast({
        type: 'lock-release',
        lockId
      });
    };

    /**
     * Handle lock request from another tab
     */
    const handleLockRequest = (message) => {
      // For now, just log - can implement conflict resolution later
      logger.debug(`[TabCoordinator] Lock requested for ${message.resource}`);
    };

    /**
     * Handle lock release
     */
    const handleLockRelease = (message) => {
      logger.debug(`[TabCoordinator] Lock released: ${message.lockId}`);
    };

    /**
     * Get tab info
     */
    const getTabInfo = () => {
      return {
        tabId,
        isInitialized,
        supported: 'BroadcastChannel' in window
      };
    };

    /**
     * Cleanup
     */
    const cleanup = () => {
      if (broadcastChannel) {
        broadcast({
          type: 'tab-leaving',
          tabId
        });

        broadcastChannel.close();
        broadcastChannel = null;
      }

      isInitialized = false;
      logger.info('[TabCoordinator] Cleanup complete');
    };

    // Cleanup on page unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', cleanup);
    }

    return {
      init,
      api: {
        broadcast,
        requestLock,
        releaseLock,
        getTabInfo,
        cleanup
      }
    };
  }
};

// Export
TabCoordinator;
