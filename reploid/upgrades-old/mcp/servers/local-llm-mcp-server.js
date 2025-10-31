// @blueprint 0x000089 - Local LLM MCP Server for REPLOID
/**
 * Local LLM MCP Server
 *
 * Exposes REPLOID Local LLM (WebLLM) operations via MCP
 * Enables agents to manage local in-browser LLM inference
 *
 * Available Tools:
 * - load_model - Load a WebLLM model into browser
 * - unload_model - Unload current model
 * - list_loaded_models - List currently loaded models
 * - get_model_status - Get status of local LLM runtime
 * - infer - Generate completion using local LLM
 */

const LocalLLMMCPServer = {
  metadata: {
    id: 'LocalLLMMCPServer',
    version: '1.0.0',
    description: 'Local LLM (WebLLM) operations via MCP',
    dependencies: ['ReploidMCPServerBase', 'LocalLLM', 'Utils'],
    async: false,
    type: 'mcp-server'
  },

  factory: (deps) => {
    const { ReploidMCPServerBase, LocalLLM, Utils } = deps;
    const { createMCPServer } = ReploidMCPServerBase;
    const { logger } = Utils;

    logger.info('[LocalLLMMCPServer] Initializing Local LLM MCP Server...');

    // Create MCP server with tools
    const server = createMCPServer({
      name: 'local-llm',
      version: '1.0.0',
      description: 'REPLOID Local LLM (WebLLM) - manage in-browser LLM inference',
      capabilities: { tools: true, resources: false, prompts: false },
      tools: [
        // =================================================================
        // MODEL MANAGEMENT
        // =================================================================
        {
          name: 'load_model',
          schema: {
            description: 'Load a WebLLM model into the browser',
            properties: {
              model_id: {
                type: 'string',
                description: 'Model identifier (e.g., "Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC")'
              }
            },
            required: ['model_id']
          },
          handler: async (args) => {
            const { model_id } = args;

            try {
              const result = await LocalLLM.init(model_id);

              if (result.success === false) {
                return {
                  success: false,
                  error: result.error
                };
              }

              return {
                success: true,
                model_id: model_id,
                message: `Model ${model_id} loaded successfully`
              };
            } catch (error) {
              return {
                success: false,
                error: error.message,
                stack: error.stack
              };
            }
          }
        },

        {
          name: 'unload_model',
          schema: {
            description: 'Unload the currently loaded model',
            properties: {}
          },
          handler: async () => {
            try {
              await LocalLLM.unload();

              return {
                success: true,
                message: 'Model unloaded successfully'
              };
            } catch (error) {
              return {
                success: false,
                error: error.message
              };
            }
          }
        },

        {
          name: 'list_loaded_models',
          schema: {
            description: 'List currently loaded models and available models',
            properties: {}
          },
          handler: async () => {
            try {
              const currentModel = LocalLLM.getCurrentModel();
              const availableModels = LocalLLM.getAvailableModels();
              const webllmModels = LocalLLM.getWebLLMModels();

              return {
                success: true,
                current_model: currentModel,
                available_models: availableModels,
                webllm_catalog: webllmModels.length,
                all_models: webllmModels
              };
            } catch (error) {
              return {
                success: false,
                error: error.message
              };
            }
          }
        },

        {
          name: 'get_model_status',
          schema: {
            description: 'Get status of local LLM runtime',
            properties: {}
          },
          handler: async () => {
            try {
              const status = LocalLLM.getStatus();
              const runtimeInfo = await LocalLLM.getRuntimeInfo();
              const stats = LocalLLM.getInferenceStats();

              return {
                success: true,
                status: {
                  ready: status.ready,
                  loading: status.loading,
                  progress: status.progress,
                  model: status.model,
                  error: status.error
                },
                runtime: {
                  webgpu_available: runtimeInfo.webgpu.available,
                  webgpu_info: runtimeInfo.webgpu.info,
                  webllm_loaded: runtimeInfo.weblllm,
                  available_models: runtimeInfo.availableModels
                },
                inference_stats: {
                  total_inferences: stats.totalInferences,
                  total_tokens: stats.totalTokens,
                  total_time: stats.totalTime,
                  last_inference_time: stats.lastInferenceTime,
                  last_tokens_per_second: stats.lastTokensPerSecond,
                  errors: stats.errors
                }
              };
            } catch (error) {
              return {
                success: false,
                error: error.message
              };
            }
          }
        },

        // =================================================================
        // INFERENCE OPERATIONS
        // =================================================================
        {
          name: 'infer',
          schema: {
            description: 'Generate completion using local LLM',
            properties: {
              messages: {
                type: 'array',
                description: 'Array of message objects with role and content',
                items: {
                  type: 'object',
                  properties: {
                    role: { type: 'string', enum: ['system', 'user', 'assistant'] },
                    content: { type: 'string' }
                  }
                }
              },
              options: {
                type: 'object',
                description: 'Generation options',
                properties: {
                  temperature: { type: 'number', description: 'Sampling temperature (default: 0.7)' },
                  max_tokens: { type: 'number', description: 'Maximum tokens to generate (default: 2048)' },
                  stream: { type: 'boolean', description: 'Whether to stream response (default: false)' }
                }
              }
            },
            required: ['messages']
          },
          handler: async (args) => {
            const { messages, options = {} } = args;

            try {
              if (!LocalLLM.isReady()) {
                return {
                  success: false,
                  error: 'Local LLM not ready. Please load a model first.'
                };
              }

              const result = await LocalLLM.chat(messages, options);

              // Handle streaming vs non-streaming
              if (options.stream) {
                return {
                  success: true,
                  streaming: true,
                  message: 'Streaming response initiated (consume via async iterator)'
                };
              }

              return {
                success: true,
                result: {
                  text: result.text,
                  usage: result.usage,
                  model: result.model,
                  elapsed: result.elapsed,
                  tokens_per_second: result.tokensPerSecond
                }
              };
            } catch (error) {
              return {
                success: false,
                error: error.message,
                stack: error.stack
              };
            }
          }
        },

        {
          name: 'complete_prompt',
          schema: {
            description: 'Generate completion from a single prompt (simplified interface)',
            properties: {
              prompt: {
                type: 'string',
                description: 'The prompt to complete'
              },
              options: {
                type: 'object',
                description: 'Generation options',
                properties: {
                  temperature: { type: 'number' },
                  max_tokens: { type: 'number' }
                }
              }
            },
            required: ['prompt']
          },
          handler: async (args) => {
            const { prompt, options = {} } = args;

            try {
              if (!LocalLLM.isReady()) {
                return {
                  success: false,
                  error: 'Local LLM not ready. Please load a model first.'
                };
              }

              const result = await LocalLLM.complete(prompt, options);

              return {
                success: true,
                result: {
                  text: result.text,
                  usage: result.usage,
                  model: result.model,
                  elapsed: result.elapsed,
                  tokens_per_second: result.tokensPerSecond
                }
              };
            } catch (error) {
              return {
                success: false,
                error: error.message
              };
            }
          }
        },

        // =================================================================
        // SYSTEM OPERATIONS
        // =================================================================
        {
          name: 'check_webgpu',
          schema: {
            description: 'Check WebGPU availability and capabilities',
            properties: {}
          },
          handler: async () => {
            try {
              const gpuCheck = await LocalLLM.checkWebGPU();

              return {
                success: true,
                webgpu: {
                  available: gpuCheck.available,
                  error: gpuCheck.error,
                  info: gpuCheck.info
                }
              };
            } catch (error) {
              return {
                success: false,
                error: error.message
              };
            }
          }
        },

        {
          name: 'switch_model',
          schema: {
            description: 'Switch to a different model (unloads current, loads new)',
            properties: {
              model_id: {
                type: 'string',
                description: 'New model ID to load'
              }
            },
            required: ['model_id']
          },
          handler: async (args) => {
            const { model_id } = args;

            try {
              await LocalLLM.switchModel(model_id);

              return {
                success: true,
                model_id: model_id,
                message: `Switched to model ${model_id}`
              };
            } catch (error) {
              return {
                success: false,
                error: error.message
              };
            }
          }
        }
      ]
    });

    // Initialize server (registers tools)
    server.initialize();

    logger.info(`[LocalLLMMCPServer] Initialized with ${server.listTools().length} tools`);

    // Return server instance
    return server;
  }
};

export default LocalLLMMCPServer;
