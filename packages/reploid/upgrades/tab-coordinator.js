/**
 * @fileoverview Inter-Tab Coordinator for REPLOID
 * Synchronizes state across multiple browser tabs to prevent conflicts.
 *
 * @blueprint 0x00003A - Coordinates browser tabs via BroadcastChannel.
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

    // Widget tracking
    let _messagesSent = 0;
    let _messagesReceived = 0;
    let _connectedTabs = new Set();
    let _lastMessageTime = null;
    let _stateSyncCount = 0;

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

      _messagesReceived++;
      _lastMessageTime = Date.now();
      _connectedTabs.add(message.tabId);

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

        _stateSyncCount++;

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

      _messagesSent++;
      _lastMessageTime = Date.now();

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

    // Web Component Widget (INSIDE factory closure to access state)
    class TabCoordinatorWidget extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: 'open' });
      }

      set moduleApi(api) {
        this._api = api;
        this.render();
      }

      connectedCallback() {
        this.render();
        // Auto-refresh every 3 seconds
        this._interval = setInterval(() => this.render(), 3000);
      }

      disconnectedCallback() {
        if (this._interval) {
          clearInterval(this._interval);
          this._interval = null;
        }
      }

      getStatus() {
        return {
          state: isInitialized ? (_connectedTabs.size > 0 ? 'active' : 'idle') : 'warning',
          primaryMetric: `${_connectedTabs.size} tabs`,
          secondaryMetric: `${_messagesSent + _messagesReceived} msgs`,
          lastActivity: _lastMessageTime,
          message: isInitialized ? (_connectedTabs.size > 0 ? 'Connected' : 'Solo') : 'Not initialized'
        };
      }

      renderPanel() {
        const formatTime = (timestamp) => {
          if (!timestamp) return 'Never';
          const diff = Date.now() - timestamp;
          if (diff < 60000) return `${Math.floor(diff/1000)}s ago`;
          if (diff < 3600000) return `${Math.floor(diff/60000)}m ago`;
          return `${Math.floor(diff/3600000)}h ago`;
        };

        return `
          <h3>⚯ Tab Coordinator</h3>

          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-top: 12px;">
            <div style="padding: 12px; background: ${_connectedTabs.size > 0 ? 'rgba(0,200,100,0.1)' : 'rgba(100,150,255,0.1)'}; border-radius: 4px;">
              <div style="font-size: 0.85em; color: #888;">Connected Tabs</div>
              <div style="font-size: 1.3em; font-weight: bold; color: ${_connectedTabs.size > 0 ? '#0c0' : 'inherit'};">${_connectedTabs.size}</div>
            </div>
            <div style="padding: 12px; background: rgba(100,150,255,0.1); border-radius: 4px;">
              <div style="font-size: 0.85em; color: #888;">State Syncs</div>
              <div style="font-size: 1.3em; font-weight: bold;">${_stateSyncCount}</div>
            </div>
            <div style="padding: 12px; background: rgba(100,150,255,0.1); border-radius: 4px;">
              <div style="font-size: 0.85em; color: #888;">Messages Sent</div>
              <div style="font-size: 1.3em; font-weight: bold;">${_messagesSent}</div>
            </div>
            <div style="padding: 12px; background: rgba(100,150,255,0.1); border-radius: 4px;">
              <div style="font-size: 0.85em; color: #888;">Messages Received</div>
              <div style="font-size: 1.3em; font-weight: bold;">${_messagesReceived}</div>
            </div>
          </div>

          <h4 style="margin-top: 16px;">ℹ️ This Tab</h4>
          <div style="margin-top: 8px; padding: 12px; background: rgba(255,255,255,0.05); border-radius: 4px;">
            <div style="font-family: monospace; font-size: 0.9em; color: #6496ff; margin-bottom: 4px;">${tabId || 'Not initialized'}</div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 0.85em; color: #aaa;">
              <div>
                <span>Initialized:</span>
                <span style="float: right; color: ${isInitialized ? '#0c0' : '#ff6b6b'};">${isInitialized ? 'Yes' : 'No'}</span>
              </div>
              <div>
                <span>Supported:</span>
                <span style="float: right; color: ${'BroadcastChannel' in window ? '#0c0' : '#ff6b6b'};">${'BroadcastChannel' in window ? 'Yes' : 'No'}</span>
              </div>
            </div>
          </div>

          ${_connectedTabs.size > 0 ? `
            <h4 style="margin-top: 16px;">⚏ Connected Tabs (${_connectedTabs.size})</h4>
            <div style="max-height: 100px; overflow-y: auto; margin-top: 8px;">
              ${Array.from(_connectedTabs).map(id => `
                <div style="padding: 6px 8px; background: rgba(255,255,255,0.05); border-radius: 3px; margin-bottom: 4px; font-family: monospace; font-size: 0.85em; color: #aaa;">
                  ${id}
                </div>
              `).join('')}
            </div>
          ` : `
            <div style="margin-top: 16px; padding: 12px; background: rgba(255,255,255,0.05); border-radius: 4px; text-align: center; color: #888; font-style: italic;">
              No other tabs detected
            </div>
          `}

          <div style="margin-top: 16px; padding: 12px; background: rgba(100,150,255,0.1); border-left: 3px solid #6496ff; border-radius: 4px;">
            <strong>ℹ️ Inter-Tab Coordination</strong>
            <div style="margin-top: 6px; color: #aaa; font-size: 0.9em;">
              Synchronizes state across browser tabs via BroadcastChannel.<br>
              Last message: ${formatTime(_lastMessageTime)}
            </div>
          </div>

          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-top: 16px;">
            <button class="announce-btn" style="padding: 10px; background: #f90; border: none; border-radius: 4px; color: white; font-weight: bold; cursor: pointer; font-size: 0.95em;">
              ⚠ Announce Tab
            </button>
            <button class="show-tabs-btn" style="padding: 10px; background: #6496ff; border: none; border-radius: 4px; color: white; font-weight: bold; cursor: pointer; font-size: 0.95em;">
              ⚏ Show Connected Tabs
            </button>
          </div>
        `;
      }

      render() {
        this.shadowRoot.innerHTML = `
          <style>
            :host {
              display: block;
              font-family: system-ui, -apple-system, sans-serif;
              color: #ccc;
            }

            .widget-content {
              background: rgba(255,255,255,0.03);
              border-radius: 8px;
              padding: 16px;
            }

            h3 {
              margin: 0 0 12px 0;
              font-size: 1.1em;
              color: #fff;
            }

            h4 {
              margin: 16px 0 8px 0;
              font-size: 0.95em;
              color: #aaa;
            }

            button {
              transition: all 0.2s ease;
            }

            .announce-btn:hover {
              background: #fa0 !important;
              transform: translateY(-1px);
            }

            .show-tabs-btn:hover {
              background: #7ba6ff !important;
              transform: translateY(-1px);
            }

            button:active {
              transform: translateY(0);
            }
          </style>

          <div class="widget-content">
            ${this.renderPanel()}
          </div>
        `;

        // Wire up buttons
        const announceBtn = this.shadowRoot.querySelector('.announce-btn');
        if (announceBtn) {
          announceBtn.addEventListener('click', () => {
            if (isInitialized) {
              broadcast({ type: 'tab-joined', tabId });
              logger.info('[TabCoordinator] Widget: Tab presence announced');
              this.render(); // Refresh
            }
          });
        }

        const showTabsBtn = this.shadowRoot.querySelector('.show-tabs-btn');
        if (showTabsBtn) {
          showTabsBtn.addEventListener('click', () => {
            console.log('[TabCoordinator] Connected tabs:', Array.from(_connectedTabs));
            logger.info('[TabCoordinator] Widget: Tab list logged to console');
          });
        }
      }
    }

    // Define custom element
    if (!customElements.get('tab-coordinator-widget')) {
      customElements.define('tab-coordinator-widget', TabCoordinatorWidget);
    }

    return {
      init,
      api: {
        broadcast,
        requestLock,
        releaseLock,
        getTabInfo,
        cleanup
      },
      widget: {
        element: 'tab-coordinator-widget',
        displayName: 'Tab Coordinator',
        icon: '⚯',
        category: 'coordination',
        updateInterval: 3000
      }
    };
  }
};

// Export
export default TabCoordinator;
