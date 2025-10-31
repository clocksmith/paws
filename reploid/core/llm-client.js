// Unified LLM Client - Supports all 4 connection types
// browser-cloud, proxy-cloud, browser-local (WebLLM), proxy-local (Ollama)

const LLMClient = {
  metadata: {
    name: 'LLMClient',
    version: '1.0.0'
  },

  factory: (deps) => {
    const PROXY_URL = 'http://localhost:8000';
    let webllmEngine = null;

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

    // Call proxy-cloud or proxy-local (via server proxy)
    const callProxy = async (messages, modelConfig) => {
      const response = await fetch(`${PROXY_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: modelConfig.provider,
          model: modelConfig.id,
          messages
        })
      });

      if (!response.ok) {
        throw new Error(`Proxy error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return {
        content: data.response || data.content,
        usage: data.usage
      };
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
    const chat = async (messages, modelConfig) => {
      console.log(`[LLMClient] Calling ${modelConfig.hostType} - ${modelConfig.provider}/${modelConfig.id}`);

      try {
        let result;

        switch (modelConfig.hostType) {
          case 'browser-cloud':
            result = await callBrowserCloud(messages, modelConfig);
            break;

          case 'proxy-cloud':
          case 'proxy-local':
            result = await callProxy(messages, modelConfig);
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

    return {
      chat,
      stream
    };
  }
};

export default LLMClient;
