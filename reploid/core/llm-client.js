// Unified LLM Client - Supports all 4 connection types
// browser-cloud, proxy-cloud, browser-local (WebLLM), proxy-local (Ollama)

const LLMClient = {
  metadata: {
    name: 'LLMClient',
    version: '1.0.0'
  },

  factory: (deps) => {
    // Use the same origin as the current page, or fallback to localhost for local dev
    const PROXY_URL = window.location.origin.includes('file://')
      ? 'http://localhost:8000'
      : window.location.origin;
    let webllmEngine = null;
    let currentAbortController = null; // Track active request for cancellation

    // Metrics storage for visualization
    let lastStreamingMetrics = null;
    let modelPerformanceHistory = {}; // Track per-model statistics

    // Provider API endpoints
    const PROVIDER_ENDPOINTS = {
      gemini: 'https://generativelanguage.googleapis.com/v1beta/models/',
      openai: 'https://api.openai.com/v1/chat/completions',
      anthropic: 'https://api.anthropic.com/v1/messages'
    };

    // Initialize WebLLM engine (lazy load)
    const initWebLLM = async () => {
      if (webllmEngine) return webllmEngine;

      if (!navigator.gpu) {
        throw new Error('WebGPU not supported in this browser');
      }

      // Dynamically import WebLLM
      const { CreateMLCEngine } = await import('https://esm.run/@mlc-ai/web-llm');
      webllmEngine = await CreateMLCEngine({
        initProgressCallback: (progress) => {
          console.log(`[WebLLM] Loading: ${progress.text}`);
        }
      });

      return webllmEngine;
    };

    // Call browser-cloud (direct API call with user's key)
    const callBrowserCloud = async (messages, modelConfig) => {
      const provider = modelConfig.provider;
      const apiKey = modelConfig.apiKey || localStorage.getItem(`${provider.toUpperCase()}_API_KEY`);

      if (!apiKey) {
        throw new Error(`No API key found for ${provider}. Please add one in model settings.`);
      }

      if (provider === 'gemini') {
        const endpoint = `${PROVIDER_ENDPOINTS.gemini}${modelConfig.id}:generateContent?key=${apiKey}`;
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: messages.map(m => ({
              role: m.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: m.content }]
            }))
          })
        });

        if (!response.ok) {
          throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return {
          content: data.candidates[0].content.parts[0].text,
          usage: data.usageMetadata
        };
      }

      if (provider === 'openai') {
        const response = await fetch(PROVIDER_ENDPOINTS.openai, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({ model: modelConfig.id, messages })
        });

        if (!response.ok) {
          throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return {
          content: data.choices[0].message.content,
          usage: data.usage
        };
      }

      if (provider === 'anthropic') {
        const response = await fetch(PROVIDER_ENDPOINTS.anthropic, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: modelConfig.id,
            messages,
            max_tokens: 4096
          })
        });

        if (!response.ok) {
          throw new Error(`Anthropic API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return {
          content: data.content[0].text,
          usage: data.usage
        };
      }

      throw new Error(`Unsupported provider: ${provider}`);
    };

    // Call proxy-cloud or proxy-local (via server proxy) with streaming
    const callProxy = async (messages, modelConfig, onStreamUpdate) => {
      // Create abort controller for this request
      currentAbortController = new AbortController();

      const response = await fetch(`${PROXY_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: modelConfig.provider,
          model: modelConfig.id,
          messages
        }),
        signal: currentAbortController.signal
      });

      if (!response.ok) {
        throw new Error(`Proxy error: ${response.status} ${response.statusText}`);
      }

      // Check if response is streaming (SSE)
      const contentType = response.headers.get('content-type');
      console.log('[LLMClient] Response content-type:', contentType);
      if (contentType && contentType.includes('text/event-stream')) {
        console.log('[LLMClient] Streaming response detected, processing...');
        // Handle streaming response
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fullContent = '';
        let fullThinking = ''; // Track thinking separately
        let tokenCount = 0;
        let tokensInCurrentWindow = 0; // Track tokens in last second for rate calculation
        let lastWindowTime = null;
        const requestStartTime = Date.now();
        let firstTokenTime = null;

        // Helper to estimate token count from text
        const estimateTokens = (text) => {
          if (!text || text.trim().length === 0) return 0;
          // Rough estimation: ~0.7 words per token (i.e., 1 token ≈ 0.7 words)
          // So tokens = words / 0.7 = words * 1.43
          const words = text.split(/\s+/).filter(w => w.length > 0).length;
          return Math.ceil(words / 0.7);
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop(); // Keep incomplete line

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const dataStr = line.substring(6);
              try {
                const data = JSON.parse(dataStr);

                // Handle both thinking and content tokens
                if (data.message && (data.message.content || data.message.thinking)) {
                  const now = Date.now();

                  // Record first token time (for either thinking or content)
                  if (firstTokenTime === null) {
                    firstTokenTime = now;
                    lastWindowTime = now;
                  }

                  // Accumulate content and thinking SEPARATELY
                  const previousContentLength = fullContent.length;
                  if (data.message.content) {
                    fullContent += data.message.content;
                  }
                  if (data.message.thinking) {
                    fullThinking += data.message.thinking;
                  }

                  // Calculate new tokens in this chunk
                  const previousTokenCount = tokenCount;
                  tokenCount = estimateTokens(fullContent);
                  const newTokensInChunk = tokenCount - previousTokenCount;

                  // Track tokens in current window for rate calculation
                  tokensInCurrentWindow += newTokensInChunk;

                  // Reset window every second
                  const timeSinceLastWindow = (now - lastWindowTime) / 1000;
                  if (timeSinceLastWindow >= 1.0) {
                    lastWindowTime = now;
                    tokensInCurrentWindow = newTokensInChunk; // Reset to current chunk
                  }

                  const ttft = ((firstTokenTime - requestStartTime) / 1000).toFixed(2);
                  const streamingElapsed = (now - firstTokenTime) / 1000;
                  // Use windowed rate for more accurate tok/s, fallback to average if window too small
                  const windowedRate = timeSinceLastWindow > 0 ? (tokensInCurrentWindow / timeSinceLastWindow) : 0;
                  const averageRate = streamingElapsed > 0 ? (tokenCount / streamingElapsed) : 0;
                  const streamingRate = (windowedRate > 0 ? windowedRate : averageRate).toFixed(2);
                  const totalElapsed = ((now - requestStartTime) / 1000).toFixed(1);

                  // Call update callback for any token activity
                  if (onStreamUpdate) {
                    onStreamUpdate({
                      content: fullContent,
                      thinking: fullThinking, // Include thinking separately
                      tokens: tokenCount,
                      ttft: ttft,
                      tokensPerSecond: streamingRate,
                      elapsedSeconds: totalElapsed
                    });
                  }
                }

                if (data.done) {
                  console.log(`[LLMClient] Stream complete. Total content length: ${fullContent.length}, tokens: ${tokenCount}`);

                  // Store metrics for visualization
                  const totalElapsed = (Date.now() - requestStartTime) / 1000;
                  const ttft = firstTokenTime ? ((firstTokenTime - requestStartTime) / 1000) : 0;
                  const tokensPerSec = totalElapsed > 0 ? (tokenCount / totalElapsed) : 0;

                  lastStreamingMetrics = {
                    ttft: ttft.toFixed(2),
                    tokensPerSecond: tokensPerSec.toFixed(2),
                    totalTokens: tokenCount,
                    totalElapsed: totalElapsed.toFixed(1),
                    timestamp: Date.now(),
                    model: `${modelConfig.provider}/${modelConfig.id}`
                  };

                  // Update model performance history
                  const modelKey = `${modelConfig.provider}/${modelConfig.id}`;
                  if (!modelPerformanceHistory[modelKey]) {
                    modelPerformanceHistory[modelKey] = {
                      calls: 0,
                      totalTokens: 0,
                      totalTime: 0,
                      totalTTFT: 0,
                      successCount: 0
                    };
                  }
                  const history = modelPerformanceHistory[modelKey];
                  history.calls++;
                  history.totalTokens += tokenCount;
                  history.totalTime += totalElapsed;
                  history.totalTTFT += ttft;
                  history.successCount++;

                  return {
                    content: fullContent,
                    usage: { tokens: tokenCount }
                  };
                }
              } catch (e) {
                console.error('[LLMClient] Failed to parse SSE data:', dataStr);
              }
            }
          }
        }

        return {
          content: fullContent,
          usage: { tokens: tokenCount }
        };
      } else {
        // Non-streaming response (fallback for other providers)
        const data = await response.json();
        return {
          content: data.response || data.content,
          usage: data.usage
        };
      }
    };

    // Call browser-local (WebLLM)
    const callBrowserLocal = async (messages, modelConfig) => {
      const engine = await initWebLLM();

      // Load model if not already loaded
      await engine.reload(modelConfig.id);

      const response = await engine.chat.completions.create({
        messages,
        temperature: 0.7,
        max_tokens: 2048
      });

      return {
        content: response.choices[0].message.content,
        usage: response.usage
      };
    };

    // Main chat interface
    const chat = async (messages, modelConfig, onStreamUpdate) => {
      console.log(`[LLMClient] Calling ${modelConfig.hostType} - ${modelConfig.provider}/${modelConfig.id}`);

      try {
        let result;

        switch (modelConfig.hostType) {
          case 'browser-cloud':
            result = await callBrowserCloud(messages, modelConfig);
            break;

          case 'proxy-cloud':
          case 'proxy-local':
            result = await callProxy(messages, modelConfig, onStreamUpdate);
            break;

          case 'browser-local':
            result = await callBrowserLocal(messages, modelConfig);
            break;

          default:
            throw new Error(`Unknown hostType: ${modelConfig.hostType}`);
        }

        console.log(`[LLMClient] Response received (${result.content.length} chars)`);
        return result;

      } catch (error) {
        console.error(`[LLMClient] Error:`, error);
        throw error;
      }
    };

    // Streaming interface (for future enhancement)
    const stream = async (messages, modelConfig, onToken) => {
      // TODO: Implement streaming for each provider
      // For now, fall back to regular chat
      const result = await chat(messages, modelConfig);
      onToken(result.content);
      return result;
    };

    // Abort ongoing request
    const abort = () => {
      if (currentAbortController) {
        console.log('[LLMClient] Aborting request');
        currentAbortController.abort();
        currentAbortController = null;
      }
    };

    // Get streaming metrics for visualization
    const getMetrics = () => {
      return {
        lastStream: lastStreamingMetrics,
        modelHistory: Object.keys(modelPerformanceHistory).map(modelKey => ({
          model: modelKey,
          calls: modelPerformanceHistory[modelKey].calls,
          totalTokens: modelPerformanceHistory[modelKey].totalTokens,
          averageTokensPerCall: (modelPerformanceHistory[modelKey].totalTokens / modelPerformanceHistory[modelKey].calls).toFixed(0),
          averageTime: (modelPerformanceHistory[modelKey].totalTime / modelPerformanceHistory[modelKey].calls).toFixed(2),
          averageTTFT: (modelPerformanceHistory[modelKey].totalTTFT / modelPerformanceHistory[modelKey].calls).toFixed(2),
          successRate: ((modelPerformanceHistory[modelKey].successCount / modelPerformanceHistory[modelKey].calls) * 100).toFixed(1)
        }))
      };
    };

    return {
      chat,
      stream,
      abort,
      getMetrics
    };
  }
};

export default LLMClient;
