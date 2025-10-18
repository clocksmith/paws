// Streaming Response Handler Module
// Provides real-time streaming response handling for incremental UI updates

const StreamingResponseHandler = {
  metadata: {
    id: 'StreamingResponseHandler',
    version: '1.0.0',
    dependencies: ['Utils', 'EventBus', 'StateManager'],
    async: false,
    type: 'service'
  },

  factory: (deps) => {
    const { Utils, EventBus, StateManager } = deps;
    const { logger } = Utils;

    logger.info('[StreamingResponseHandler] Initializing streaming response handler...');

    // Active stream state
    let activeStream = null;
    let currentChunks = [];
    let streamAborted = false;

    // Stream a response from an API endpoint
    const streamResponse = async (apiCall, onChunk, onComplete, onError) => {
      logger.info('[StreamingResponseHandler] Starting new stream...');

      currentChunks = [];
      streamAborted = false;

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
          EventBus.emit('stream:aborted', { partialText: fullText });
        } else {
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

    return {
      streamResponse,
      abortStream,
      getStreamStatus,
      wrapApiForStreaming
    };
  }
};

// Export standardized module
export default StreamingResponseHandler;
