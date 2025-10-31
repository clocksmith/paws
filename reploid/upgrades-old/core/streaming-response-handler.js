// @blueprint 0x00003F - Real-time streaming response handler for incremental UI updates.
// Streaming Response Handler Module
// Provides real-time streaming response handling for incremental UI updates

const StreamingResponseHandler = {
  metadata: {
    id: 'StreamingResponseHandler',
    version: '1.0.0',
    dependencies: ['Utils', 'EventBus', 'Storage'],
    async: false,
    type: 'service'
  },

  factory: (deps) => {
    const { Utils, EventBus, Storage } = deps;
    const { logger } = Utils;

    logger.info('[StreamingResponseHandler] Initializing streaming response handler...');

    // Active stream state
    let activeStream = null;
    let currentChunks = [];
    let streamAborted = false;

    // Widget tracking
    let _streamCount = 0;
    let _abortedCount = 0;
    let _completedCount = 0;
    let _lastStreamTime = null;
    let _totalChunksProcessed = 0;

    // Stream a response from an API endpoint
    const streamResponse = async (apiCall, onChunk, onComplete, onError) => {
      logger.info('[StreamingResponseHandler] Starting new stream...');

      currentChunks = [];
      streamAborted = false;
      _streamCount++;
      _lastStreamTime = Date.now();

      try {
        // Create a readable stream from the API call
        const response = await apiCall();

        if (!response.body) {
          logger.warn('[StreamingResponseHandler] Response has no body, falling back to non-streaming');
          const text = await response.text();
          onChunk(text);
          onComplete(text);
          return;
        }

        activeStream = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (!streamAborted) {
          const { done, value } = await activeStream.read();

          if (done) {
            logger.info('[StreamingResponseHandler] Stream complete');
            break;
          }

          // Decode chunk
          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;

          // Process complete lines
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.trim() === '') continue;

            // Handle SSE format (Server-Sent Events)
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;

              try {
                const parsed = JSON.parse(data);
                const text = parsed.choices?.[0]?.delta?.content || '';

                if (text) {
                  currentChunks.push(text);
                  onChunk(text);
                  _totalChunksProcessed++;

                  // Emit event for UI updates
                  EventBus.emit('stream:chunk', { text, total: currentChunks.join('') });
                }
              } catch (e) {
                logger.debug('[StreamingResponseHandler] Non-JSON chunk:', data);
                currentChunks.push(data);
                onChunk(data);
              }
            } else {
              // Plain text streaming
              currentChunks.push(line);
              onChunk(line);
              EventBus.emit('stream:chunk', { text: line, total: currentChunks.join('\n') });
            }
          }
        }

        // Process any remaining buffer
        if (buffer.trim() && !streamAborted) {
          currentChunks.push(buffer);
          onChunk(buffer);
        }

        const fullText = currentChunks.join('');

        if (streamAborted) {
          logger.info('[StreamingResponseHandler] Stream was aborted');
          _abortedCount++;
          EventBus.emit('stream:aborted', { partialText: fullText });
        } else {
          _completedCount++;
          onComplete(fullText);
          EventBus.emit('stream:complete', { text: fullText });
        }

        activeStream = null;

      } catch (error) {
        logger.error('[StreamingResponseHandler] Stream error:', error);
        onError(error);
        EventBus.emit('stream:error', { error: error.message });
        activeStream = null;
      }
    };

    // Abort the current stream
    const abortStream = () => {
      if (activeStream) {
        logger.info('[StreamingResponseHandler] Aborting active stream');
        streamAborted = true;

        try {
          activeStream.cancel();
        } catch (e) {
          logger.warn('[StreamingResponseHandler] Error canceling stream:', e);
        }

        activeStream = null;
        EventBus.emit('stream:aborted', { partialText: currentChunks.join('') });
      }
    };

    // Get current stream status
    const getStreamStatus = () => ({
      active: activeStream !== null,
      chunks: currentChunks.length,
      partialText: currentChunks.join('')
    });

    // Create a streaming-compatible API wrapper
    const wrapApiForStreaming = (apiClient) => {
      return {
        streamCall: async (history, funcDecls = []) => {
          return new Promise((resolve, reject) => {
            let fullResponse = '';

            const onChunk = (text) => {
              fullResponse += text;
            };

            const onComplete = (text) => {
              resolve({
                type: 'text',
                content: text,
                streamed: true
              });
            };

            const onError = (error) => {
              reject(error);
            };

            // This wraps the API call to be streaming-compatible
            streamResponse(
              () => apiClient.callApiWithRetry(history, funcDecls),
              onChunk,
              onComplete,
              onError
            );
          });
        }
      };
    };

    logger.info('[StreamingResponseHandler] Module initialized successfully');

    // Web Component Widget (INSIDE factory closure to access state)
    class StreamingHandlerWidget extends HTMLElement {
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
        // Auto-refresh every second for live streaming updates
        this._interval = setInterval(() => this.render(), 1000);
      }

      disconnectedCallback() {
        if (this._interval) {
          clearInterval(this._interval);
          this._interval = null;
        }
      }

      getStatus() {
        return {
          state: activeStream ? 'active' : (_streamCount > 0 ? 'idle' : 'idle'),
          primaryMetric: `${_streamCount} streams`,
          secondaryMetric: activeStream ? 'Streaming' : 'Idle',
          lastActivity: _lastStreamTime,
          message: activeStream ? `${currentChunks.length} chunks` : `${_completedCount} completed`
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
          <h3>⏃ Streaming Handler</h3>

          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-top: 12px;">
            <div style="padding: 12px; background: rgba(100,150,255,0.1); border-radius: 4px;">
              <div style="font-size: 0.85em; color: #888;">Total Streams</div>
              <div style="font-size: 1.3em; font-weight: bold;">${_streamCount}</div>
            </div>
            <div style="padding: 12px; background: ${activeStream ? 'rgba(0,200,100,0.1)' : 'rgba(100,150,255,0.1)'}; border-radius: 4px;">
              <div style="font-size: 0.85em; color: #888;">Status</div>
              <div style="font-size: 1.3em; font-weight: bold; color: ${activeStream ? '#0c0' : 'inherit'};">${activeStream ? 'Active' : 'Idle'}</div>
            </div>
            <div style="padding: 12px; background: rgba(100,150,255,0.1); border-radius: 4px;">
              <div style="font-size: 0.85em; color: #888;">Completed</div>
              <div style="font-size: 1.3em; font-weight: bold;">${_completedCount}</div>
            </div>
            <div style="padding: 12px; background: ${_abortedCount > 0 ? 'rgba(255,150,0,0.1)' : 'rgba(100,150,255,0.1)'}; border-radius: 4px;">
              <div style="font-size: 0.85em; color: #888;">Aborted</div>
              <div style="font-size: 1.3em; font-weight: bold; color: ${_abortedCount > 0 ? '#f90' : 'inherit'};">${_abortedCount}</div>
            </div>
          </div>

          ${activeStream ? `
            <h4 style="margin-top: 16px;">↻ Active Stream</h4>
            <div style="margin-top: 8px; padding: 12px; background: rgba(0,200,100,0.1); border-left: 3px solid #0c0; border-radius: 4px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span style="font-weight: bold; color: #0c0;">Streaming in progress</span>
                <span style="font-size: 0.9em; color: #888;">${currentChunks.length} chunks</span>
              </div>
              <div style="background: rgba(255,255,255,0.1); border-radius: 4px; height: 6px; overflow: hidden;">
                <div style="background: linear-gradient(90deg, #0c0, #6496ff); height: 100%; width: 100%;"></div>
              </div>
              <div style="margin-top: 6px; font-size: 0.85em; color: #aaa;">
                Total chunks processed: ${_totalChunksProcessed}
              </div>
            </div>
          ` : ''}

          <h4 style="margin-top: 16px;">☱ Stream Statistics</h4>
          <div style="margin-top: 8px; padding: 12px; background: rgba(255,255,255,0.05); border-radius: 4px;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 0.9em;">
              <div>
                <span style="color: #888;">Total chunks:</span>
                <span style="float: right;">${_totalChunksProcessed}</span>
              </div>
              <div>
                <span style="color: #888;">Success rate:</span>
                <span style="float: right;">${_streamCount > 0 ? ((_completedCount / _streamCount) * 100).toFixed(0) : 0}%</span>
              </div>
              <div>
                <span style="color: #888;">Avg chunks/stream:</span>
                <span style="float: right;">${_completedCount > 0 ? Math.floor(_totalChunksProcessed / _completedCount) : 0}</span>
              </div>
              <div>
                <span style="color: #888;">Last stream:</span>
                <span style="float: right;">${formatTime(_lastStreamTime)}</span>
              </div>
            </div>
          </div>

          <div style="margin-top: 16px; padding: 12px; background: rgba(100,150,255,0.1); border-left: 3px solid #6496ff; border-radius: 4px;">
            <strong>ℹ️ Streaming Response Handler</strong>
            <div style="margin-top: 6px; color: #aaa; font-size: 0.9em;">
              Real-time streaming for incremental UI updates via Server-Sent Events.<br>
              Supports SSE format and plain text streaming.
            </div>
          </div>

          ${activeStream ? `
            <button class="abort-stream-btn" style="width: 100%; margin-top: 16px; padding: 10px; background: #f00; border: none; border-radius: 4px; color: white; font-weight: bold; cursor: pointer; font-size: 0.95em;">
              ⏹️ Abort Stream
            </button>
          ` : ''}
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

            .abort-stream-btn:hover {
              background: #ff3333 !important;
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

        // Wire up abort button
        const abortBtn = this.shadowRoot.querySelector('.abort-stream-btn');
        if (abortBtn) {
          abortBtn.addEventListener('click', () => {
            if (activeStream) {
              abortStream();
              logger.info('[StreamingResponseHandler] Widget: Stream aborted');
              this.render(); // Refresh immediately
            } else {
              logger.warn('[StreamingResponseHandler] Widget: No active stream to abort');
            }
          });
        }
      }
    }

    // Define custom element
    if (!customElements.get('streaming-handler-widget')) {
      customElements.define('streaming-handler-widget', StreamingHandlerWidget);
    }

    return {
      api: {
        streamResponse,
        abortStream,
        getStreamStatus,
        wrapApiForStreaming
      },
      widget: {
        element: 'streaming-handler-widget',
        displayName: 'Streaming Handler',
        icon: '⏃',
        category: 'service',
        updateInterval: 1000
      }
    };
  }
};

// Export standardized module
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StreamingResponseHandler;
}
export default StreamingResponseHandler;
