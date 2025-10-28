// @blueprint 0x00005B - Thought Panel Module
// Thought Panel UI Component for REPLOID Agent
// Provides real-time agent thought streaming with memory management
// CLUSTER 2 Phase 6 Implementation

const ThoughtPanel = {
  metadata: {
    id: 'ThoughtPanel',
    version: '1.0.0',
    description: 'Agent thought streaming panel with auto-trim memory management',
    features: [
      'Real-time thought streaming from agent reasoning',
      'Auto-trim circular buffer (1000 thought limit)',
      'Export to markdown with timestamps',
      'Pause/resume rendering when panel hidden',
      'Feature flag support for incremental rollout'
    ],
    dependencies: ['EventBus', 'Utils', 'StateManager?'],
    async: false,
    type: 'ui-core',
    widget: {
      element: 'thought-panel-widget',
      displayName: 'Agent Thoughts',
      visible: false,  // Hidden from ModuleDashboard (core UI)
      category: 'core-ui'
    }
  },

  factory: (deps) => {
    const { EventBus, Utils } = deps;
    const { logger, escapeHtml } = Utils;

    // Closure state
    let container = null;
    let thoughts = [];  // Array of {timestamp, text}
    const MAX_THOUGHTS = 1000;
    let isPaused = false;
    let lastActivity = null;

    // Streaming state
    let currentStreamingThought = null;  // {timestamp, text, isStreaming: true}

    // Event listener tracking for cleanup
    const eventListeners = {
      agentThought: null,
      streamChunk: null,
      streamComplete: null,
      panelShow: null,
      panelHide: null
    };

    // Cleanup function (prevents memory leaks)
    const cleanup = () => {
      if (eventListeners.agentThought) {
        EventBus.off('agent:thought', eventListeners.agentThought);
        eventListeners.agentThought = null;
      }
      if (eventListeners.streamChunk) {
        EventBus.off('hybrid-llm:stream-chunk', eventListeners.streamChunk);
        eventListeners.streamChunk = null;
      }
      if (eventListeners.streamComplete) {
        EventBus.off('hybrid-llm:stream-complete', eventListeners.streamComplete);
        eventListeners.streamComplete = null;
      }
      if (eventListeners.panelShow) {
        EventBus.off('ui:panel-show', eventListeners.panelShow);
        eventListeners.panelShow = null;
      }
      if (eventListeners.panelHide) {
        EventBus.off('ui:panel-hide', eventListeners.panelHide);
        eventListeners.panelHide = null;
      }
      logger.info('[ThoughtPanel] Cleanup complete');
    };

    // Initialize the thought panel
    const init = (containerId) => {
      logger.info('[ThoughtPanel] init() called with containerId:', containerId);

      // Clean up any existing listeners first
      cleanup();

      container = document.getElementById(containerId);

      if (!container) {
        logger.error('[ThoughtPanel] Container not found:', containerId);
        EventBus.emit('ui:panel-error', {
          panel: 'ThoughtPanel',
          error: 'Container not found',
          timestamp: Date.now()
        });
        return;
      }

      // Add styles if not already present (idempotent)
      if (!document.getElementById('thought-panel-styles')) {
        const styles = document.createElement('style');
        styles.id = 'thought-panel-styles';
        styles.innerHTML = getThoughtPanelStyles();
        document.head.appendChild(styles);
      }

      // Register event listeners and store references
      eventListeners.agentThought = handleThought;
      eventListeners.streamChunk = handleStreamChunk;
      eventListeners.streamComplete = handleStreamComplete;
      eventListeners.panelShow = () => {
        isPaused = false;
        logger.debug('[ThoughtPanel] Resumed rendering');
      };
      eventListeners.panelHide = () => {
        isPaused = true;
        logger.debug('[ThoughtPanel] Paused rendering');
      };

      EventBus.on('agent:thought', eventListeners.agentThought);
      EventBus.on('hybrid-llm:stream-chunk', eventListeners.streamChunk);
      EventBus.on('hybrid-llm:stream-complete', eventListeners.streamComplete);
      EventBus.on('ui:panel-show', eventListeners.panelShow);
      EventBus.on('ui:panel-hide', eventListeners.panelHide);

      // Render initial empty state
      render();

      logger.info('[ThoughtPanel] Initialized successfully');
      EventBus.emit('ui:panel-ready', {
        panel: 'ThoughtPanel',
        mode: 'modular',
        timestamp: Date.now()
      });
    };

    // Handle incoming thought events
    const handleThought = (thoughtChunk) => {
      // Feature flag check (prevents duplicate UI)
      const featureFlags = window.reploidConfig?.featureFlags;
      if (featureFlags && !featureFlags.useModularPanels?.ThoughtPanel) {
        return;  // Panel disabled, skip rendering
      }

      if (isPaused) {
        logger.debug('[ThoughtPanel] Paused, ignoring thought');
        return;  // Don't render when panel hidden
      }

      appendThought(thoughtChunk);
    };

    // Handle real-time streaming chunks
    const handleStreamChunk = (data) => {
      // Feature flag check
      const featureFlags = window.reploidConfig?.featureFlags;
      if (featureFlags && !featureFlags.useModularPanels?.ThoughtPanel) {
        return;  // Panel disabled, skip rendering
      }

      if (isPaused) {
        return;  // Don't render when panel hidden
      }

      const { chunk, total, chunkCount, provider } = data;

      // Initialize or update the current streaming thought
      if (!currentStreamingThought) {
        currentStreamingThought = {
          timestamp: Date.now(),
          text: total,
          isStreaming: true,
          provider,
          chunkCount
        };
      } else {
        currentStreamingThought.text = total;
        currentStreamingThought.chunkCount = chunkCount;
      }

      lastActivity = Date.now();
      render();
    };

    // Handle stream completion - finalize streaming thought
    const handleStreamComplete = (data) => {
      if (!currentStreamingThought) return;

      // Move streaming thought to permanent thoughts
      thoughts.push({
        timestamp: currentStreamingThought.timestamp,
        text: currentStreamingThought.text
      });

      // Auto-trim if over limit
      if (thoughts.length > MAX_THOUGHTS) {
        const removed = thoughts.length - MAX_THOUGHTS;
        thoughts = thoughts.slice(removed);
        logger.debug(`[ThoughtPanel] Auto-trimmed ${removed} old thoughts`);
      }

      logger.info(`[ThoughtPanel] Stream complete: ${currentStreamingThought.chunkCount} chunks, ${currentStreamingThought.text.length} characters`);

      // Clear streaming state
      currentStreamingThought = null;
      lastActivity = Date.now();
      render();
    };

    // Append thought with auto-trim
    const appendThought = (chunk) => {
      // Add thought with timestamp
      thoughts.push({
        timestamp: Date.now(),
        text: chunk
      });

      // Auto-trim if over limit
      if (thoughts.length > MAX_THOUGHTS) {
        const removed = thoughts.length - MAX_THOUGHTS;
        thoughts = thoughts.slice(removed);
        logger.debug(`[ThoughtPanel] Auto-trimmed ${removed} old thoughts`);
      }

      lastActivity = Date.now();
      render();
    };

    // Clear all thoughts
    const clear = () => {
      thoughts = [];
      lastActivity = Date.now();
      render();
      logger.info('[ThoughtPanel] Cleared all thoughts');
    };

    // Export to markdown
    const exportToMarkdown = () => {
      const markdown = thoughts.map(({ timestamp, text }) => {
        const date = new Date(timestamp).toISOString();
        return `**${date}**\n${text}\n`;
      }).join('\n---\n\n');

      return `# Agent Thoughts Export\n\nTotal thoughts: ${thoughts.length}\n\n${markdown}`;
    };

    // Render the thought panel
    const render = () => {
      if (!container) return;

      if (thoughts.length === 0 && !currentStreamingThought) {
        container.innerHTML = `
          <div class="thought-panel-empty">
            <p>No thoughts yet. Waiting for agent reasoning...</p>
          </div>
        `;
        return;
      }

      // Build streaming thought HTML (show at top if active)
      let streamingHtml = '';
      if (currentStreamingThought) {
        const date = new Date(currentStreamingThought.timestamp).toLocaleTimeString();
        streamingHtml = `
          <div class="thought-item thought-item-streaming">
            <span class="thought-timestamp">
              ${date}
              <span class="streaming-indicator">● Streaming (${currentStreamingThought.chunkCount} chunks)</span>
            </span>
            <span class="thought-text">${escapeHtml(currentStreamingThought.text)}<span class="cursor-blink">▊</span></span>
          </div>
        `;
      }

      // Build thought list (most recent first)
      const thoughtsHtml = thoughts
        .slice()
        .reverse()
        .map(({ timestamp, text }) => {
          const date = new Date(timestamp).toLocaleTimeString();
          return `
            <div class="thought-item">
              <span class="thought-timestamp">${date}</span>
              <span class="thought-text">${escapeHtml(text)}</span>
            </div>
          `;
        })
        .join('');

      container.innerHTML = `
        <div class="thought-panel-header">
          <h4>Agent Thoughts (${thoughts.length}/${MAX_THOUGHTS})${currentStreamingThought ? ' 🔴 Live' : ''}</h4>
          <div class="thought-controls">
            <button id="export-thoughts-btn" class="btn-secondary" title="Export to Markdown">📥 Export</button>
            <button id="clear-thoughts-btn" class="btn-secondary" title="Clear all thoughts">🗑️ Clear</button>
          </div>
        </div>
        <div class="thought-panel-list">
          ${streamingHtml}
          ${thoughtsHtml}
        </div>
        ${thoughts.length === MAX_THOUGHTS ? '<div class="thought-warning">⚠️ Memory limit reached. Old thoughts auto-trimmed.</div>' : ''}
      `;

      // Attach event handlers
      const exportBtn = document.getElementById('export-thoughts-btn');
      const clearBtn = document.getElementById('clear-thoughts-btn');

      if (exportBtn) {
        exportBtn.onclick = () => {
          const markdown = exportToMarkdown();
          downloadFile('thoughts.md', markdown);
        };
      }

      if (clearBtn) {
        clearBtn.onclick = () => {
          if (confirm(`Clear all ${thoughts.length} thoughts?`)) {
            clear();
          }
        };
      }
    };

    // Download helper
    const downloadFile = (filename, content) => {
      const blob = new Blob([content], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      logger.info(`[ThoughtPanel] Exported ${thoughts.length} thoughts to ${filename}`);
    };

    // Widget Protocol: getStatus()
    const getStatus = () => {
      return {
        state: isPaused ? 'paused' : (thoughts.length > 0 ? 'streaming' : 'idle'),
        primaryMetric: `${thoughts.length} thoughts`,
        secondaryMetric: isPaused ? 'Paused' : 'Active',
        lastActivity: lastActivity,
        message: thoughts.length === MAX_THOUGHTS ? 'Memory limit reached' : null
      };
    };

    // Widget Protocol: getControls()
    const getControls = () => {
      return [
        {
          id: 'clear-thoughts',
          label: 'Clear Thoughts',
          icon: '🗑️',
          action: () => {
            clear();
            return { success: true, message: 'Thoughts cleared' };
          }
        },
        {
          id: 'export-thoughts',
          label: 'Export',
          icon: '📥',
          action: () => {
            const markdown = exportToMarkdown();
            downloadFile('thoughts.md', markdown);
            return { success: true, message: `Exported ${thoughts.length} thoughts` };
          }
        },
        {
          id: 'pause-thoughts',
          label: isPaused ? 'Resume' : 'Pause',
          icon: isPaused ? '▶️' : '⏸️',
          action: () => {
            isPaused = !isPaused;
            return { success: true, message: `Rendering ${isPaused ? 'paused' : 'resumed'}` };
          }
        }
      ];
    };

    // Styles for thought panel
    const getThoughtPanelStyles = () => `
      .thought-panel-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px;
        background: rgba(0, 0, 0, 0.1);
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      }

      .thought-panel-header h4 {
        margin: 0;
        font-size: 14px;
        font-weight: 600;
      }

      .thought-controls {
        display: flex;
        gap: 8px;
      }

      .thought-panel-list {
        max-height: 400px;
        overflow-y: auto;
        padding: 12px;
      }

      .thought-item {
        display: flex;
        flex-direction: column;
        padding: 8px;
        margin-bottom: 8px;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 4px;
        font-family: 'SF Mono', 'Consolas', monospace;
        font-size: 12px;
      }

      .thought-item-streaming {
        background: rgba(100, 150, 255, 0.1);
        border-left: 3px solid rgba(100, 150, 255, 0.5);
        animation: pulse-border 2s infinite;
      }

      @keyframes pulse-border {
        0%, 100% {
          border-left-color: rgba(100, 150, 255, 0.5);
        }
        50% {
          border-left-color: rgba(100, 150, 255, 1);
        }
      }

      .thought-timestamp {
        color: rgba(255, 255, 255, 0.5);
        font-size: 10px;
        margin-bottom: 4px;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .streaming-indicator {
        color: rgba(100, 150, 255, 0.9);
        font-weight: bold;
        animation: pulse-text 1.5s infinite;
      }

      @keyframes pulse-text {
        0%, 100% {
          opacity: 0.7;
        }
        50% {
          opacity: 1;
        }
      }

      .thought-text {
        color: rgba(255, 255, 255, 0.9);
        white-space: pre-wrap;
        word-break: break-word;
      }

      .cursor-blink {
        color: rgba(100, 150, 255, 0.9);
        animation: blink 1s step-end infinite;
      }

      @keyframes blink {
        0%, 50% {
          opacity: 1;
        }
        51%, 100% {
          opacity: 0;
        }
      }

      .thought-panel-empty {
        padding: 32px;
        text-align: center;
        color: rgba(255, 255, 255, 0.5);
      }

      .thought-warning {
        padding: 8px 12px;
        background: rgba(255, 165, 0, 0.1);
        border: 1px solid rgba(255, 165, 0, 0.3);
        border-radius: 4px;
        margin: 12px;
        font-size: 12px;
        color: rgba(255, 165, 0, 0.9);
      }

      .btn-secondary {
        padding: 6px 12px;
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 4px;
        color: rgba(255, 255, 255, 0.9);
        cursor: pointer;
        font-size: 12px;
        transition: all 0.2s;
      }

      .btn-secondary:hover {
        background: rgba(255, 255, 255, 0.2);
        border-color: rgba(255, 255, 255, 0.3);
      }
    `;

    // Public API
    return {
      init,
      appendThought,
      clear,
      export: exportToMarkdown,
      getThoughts: () => thoughts,
      getStatus,
      getControls,
      cleanup
    };
  }
};

// Export for module loader
export default ThoughtPanel;
