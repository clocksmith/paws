// Multi-Provider API Client
// Supports OpenAI, Anthropic, Google Gemini, and local LLM providers

export class MultiProviderAPI {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.providers = new Map();
    this.currentProvider = null;
    
    this.initializeProviders();
  }

  initializeProviders() {
    // Register available providers
    this.registerProvider('gemini', new GeminiProvider(this.config, this.logger));
    this.registerProvider('openai', new OpenAIProvider(this.config, this.logger));
    this.registerProvider('anthropic', new AnthropicProvider(this.config, this.logger));
    this.registerProvider('local', new LocalProvider(this.config, this.logger));
    
    // Set default provider
    this.currentProvider = this.config.defaultProvider || 'gemini';
  }

  registerProvider(name, provider) {
    this.providers.set(name, provider);
  }

  setProvider(name) {
    if (!this.providers.has(name)) {
      throw new Error(`Provider ${name} not registered`);
    }
    this.currentProvider = name;
    this.logger.logEvent('info', `Switched to ${name} provider`);
  }

  async callAPI(messages, options = {}) {
    const provider = this.providers.get(this.currentProvider);
    if (!provider) {
      throw new Error(`No provider selected`);
    }

    try {
      return await provider.call(messages, options);
    } catch (error) {
      this.logger.logEvent('error', `${this.currentProvider} API call failed: ${error.message}`);
      
      // Try fallback providers if configured
      if (this.config.fallbackProviders && this.config.fallbackProviders.length > 0) {
        for (const fallbackName of this.config.fallbackProviders) {
          if (fallbackName !== this.currentProvider) {
            this.logger.logEvent('info', `Trying fallback provider: ${fallbackName}`);
            const fallbackProvider = this.providers.get(fallbackName);
            if (fallbackProvider) {
              try {
                return await fallbackProvider.call(messages, options);
              } catch (fallbackError) {
                this.logger.logEvent('error', `Fallback ${fallbackName} also failed: ${fallbackError.message}`);
              }
            }
          }
        }
      }
      
      throw error;
    }
  }

  async streamCall(messages, options = {}, onChunk) {
    const provider = this.providers.get(this.currentProvider);
    if (!provider || !provider.stream) {
      throw new Error(`Provider ${this.currentProvider} does not support streaming`);
    }

    return provider.stream(messages, options, onChunk);
  }

  getProviderList() {
    return Array.from(this.providers.keys());
  }

  getProviderConfig(name) {
    const provider = this.providers.get(name);
    return provider ? provider.getConfig() : null;
  }
}

// Base Provider Class
class BaseProvider {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.apiKey = null;
    this.endpoint = null;
  }

  async call(messages, options) {
    throw new Error('call() must be implemented by provider');
  }

  async stream(messages, options, onChunk) {
    throw new Error('Streaming not supported by this provider');
  }

  getConfig() {
    return {
      name: this.constructor.name,
      hasApiKey: !!this.apiKey,
      endpoint: this.endpoint,
      supportsStreaming: !!this.stream
    };
  }

  formatMessages(messages) {
    // Convert to provider-specific format
    return messages;
  }
}

// Google Gemini Provider
class GeminiProvider extends BaseProvider {
  constructor(config, logger) {
    super(config, logger);
    this.apiKey = config.geminiApiKey || config.apiKey;
    this.endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';
    this.model = config.geminiModel || 'gemini-1.5-flash';
  }

  async call(messages, options = {}) {
    const requestBody = {
      contents: this.formatMessages(messages),
      generationConfig: {
        temperature: options.temperature || 0.7,
        maxOutputTokens: options.maxTokens || 1024,
        topP: options.topP || 0.95,
        topK: options.topK || 40
      }
    };

    if (options.tools) {
      requestBody.tools = options.tools;
      requestBody.tool_config = { 
        function_calling_config: { mode: "AUTO" } 
      };
    }

    const response = await fetch(`${this.endpoint}?key=${this.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    return this.parseResponse(data);
  }

  formatMessages(messages) {
    return messages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : msg.role,
      parts: [{ text: msg.content }]
    }));
  }

  parseResponse(data) {
    const candidate = data.candidates?.[0];
    if (!candidate) {
      throw new Error('No response from Gemini');
    }

    const part = candidate.content?.parts?.[0];
    if (part?.text) {
      return {
        type: 'text',
        content: part.text,
        usage: data.usageMetadata
      };
    } else if (part?.functionCall) {
      return {
        type: 'functionCall',
        content: part.functionCall,
        usage: data.usageMetadata
      };
    }

    throw new Error('Unexpected response format from Gemini');
  }
}

// OpenAI Provider
class OpenAIProvider extends BaseProvider {
  constructor(config, logger) {
    super(config, logger);
    this.apiKey = config.openaiApiKey;
    this.endpoint = config.openaiEndpoint || 'https://api.openai.com/v1/chat/completions';
    this.model = config.openaiModel || 'gpt-4-turbo-preview';
  }

  async call(messages, options = {}) {
    const requestBody = {
      model: this.model,
      messages: messages,
      temperature: options.temperature || 0.7,
      max_tokens: options.maxTokens || 1024,
      top_p: options.topP || 0.95
    };

    if (options.tools) {
      requestBody.tools = this.convertToolsToOpenAI(options.tools);
      requestBody.tool_choice = 'auto';
    }

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return this.parseResponse(data);
  }

  async stream(messages, options = {}, onChunk) {
    const requestBody = {
      model: this.model,
      messages: messages,
      temperature: options.temperature || 0.7,
      max_tokens: options.maxTokens || 1024,
      stream: true
    };

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              onChunk(content);
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    }
  }

  convertToolsToOpenAI(tools) {
    // Convert from Gemini format to OpenAI format
    return tools.map(tool => ({
      type: 'function',
      function: tool.functionDeclarations?.[0] || tool
    }));
  }

  parseResponse(data) {
    const choice = data.choices?.[0];
    if (!choice) {
      throw new Error('No response from OpenAI');
    }

    if (choice.message?.content) {
      return {
        type: 'text',
        content: choice.message.content,
        usage: data.usage
      };
    } else if (choice.message?.tool_calls) {
      return {
        type: 'functionCall',
        content: choice.message.tool_calls[0].function,
        usage: data.usage
      };
    }

    throw new Error('Unexpected response format from OpenAI');
  }
}

// Anthropic Provider
class AnthropicProvider extends BaseProvider {
  constructor(config, logger) {
    super(config, logger);
    this.apiKey = config.anthropicApiKey;
    this.endpoint = 'https://api.anthropic.com/v1/messages';
    this.model = config.anthropicModel || 'claude-3-opus-20240229';
  }

  async call(messages, options = {}) {
    const requestBody = {
      model: this.model,
      messages: this.formatMessages(messages),
      max_tokens: options.maxTokens || 1024,
      temperature: options.temperature || 0.7
    };

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = await response.json();
    return this.parseResponse(data);
  }

  formatMessages(messages) {
    // Filter out system messages and convert format
    const systemMessage = messages.find(m => m.role === 'system');
    const otherMessages = messages.filter(m => m.role !== 'system');
    
    return {
      system: systemMessage?.content || '',
      messages: otherMessages.map(msg => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content
      }))
    };
  }

  parseResponse(data) {
    if (data.content?.[0]?.text) {
      return {
        type: 'text',
        content: data.content[0].text,
        usage: {
          input_tokens: data.usage?.input_tokens,
          output_tokens: data.usage?.output_tokens
        }
      };
    }

    throw new Error('Unexpected response format from Anthropic');
  }
}

// Local LLM Provider (for Ollama, LM Studio, etc.)
class LocalProvider extends BaseProvider {
  constructor(config, logger) {
    super(config, logger);
    this.endpoint = config.localEndpoint || 'http://localhost:11434/api/generate';
    this.model = config.localModel || 'llama2';
  }

  async call(messages, options = {}) {
    const prompt = this.messagesToPrompt(messages);
    
    const requestBody = {
      model: this.model,
      prompt: prompt,
      stream: false,
      options: {
        temperature: options.temperature || 0.7,
        num_predict: options.maxTokens || 1024,
        top_p: options.topP || 0.95
      }
    };

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`Local LLM error: ${response.status}`);
    }

    const data = await response.json();
    return this.parseResponse(data);
  }

  messagesToPrompt(messages) {
    return messages.map(msg => {
      const role = msg.role === 'assistant' ? 'Assistant' : 'User';
      return `${role}: ${msg.content}`;
    }).join('\n\n');
  }

  parseResponse(data) {
    if (data.response) {
      return {
        type: 'text',
        content: data.response,
        usage: {
          total_duration: data.total_duration,
          prompt_eval_count: data.prompt_eval_count,
          eval_count: data.eval_count
        }
      };
    }

    throw new Error('Unexpected response format from local LLM');
  }
}

// Export module for integration
export const MultiProviderAPIModule = {
  metadata: {
    id: 'MultiProviderAPI',
    version: '1.0.0',
    dependencies: ['config', 'logger'],
    async: false,
    type: 'api'
  },

  factory: (deps) => {
    const { config, logger } = deps;
    
    if (!config || !logger) {
      throw new Error('MultiProviderAPI: Missing required dependencies');
    }

    const api = new MultiProviderAPI(config, logger);
    
    return {
      callAPI: (messages, options) => api.callAPI(messages, options),
      streamCall: (messages, options, onChunk) => api.streamCall(messages, options, onChunk),
      setProvider: (name) => api.setProvider(name),
      getProviders: () => api.getProviderList(),
      getProviderConfig: (name) => api.getProviderConfig(name)
    };
  }
};

export default MultiProviderAPIModule;