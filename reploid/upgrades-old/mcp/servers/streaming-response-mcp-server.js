// @blueprint 0x000081 - StreamingResponse MCP Server for REPLOID
/**
 * StreamingResponse MCP Server
 *
 * Exposes streaming LLM response handling via MCP
 * Enables agents to handle streaming responses from LLM providers
 *
 * Available Tools:
 * - stream_response - Start streaming a response
 * - abort_stream - Abort an active stream
 * - get_stream_status - Get status of a stream
 * - wrap_api_for_streaming - Wrap an API call to support streaming
 */

const StreamingResponseMCPServer = {
  metadata: {
    id: 'StreamingResponseMCPServer',
    version: '1.0.0',
    description: 'Streaming LLM response handling',
    dependencies: ['ReploidMCPServerBase', 'StreamingResponseHandler', 'Utils'],
    async: false,
    type: 'mcp-server'
  },

  factory: (deps) => {
    const { ReploidMCPServerBase, StreamingResponseHandler, Utils } = deps;
    const { createMCPServer } = ReploidMCPServerBase;
    const { logger } = Utils;

    logger.info('[StreamingResponseMCPServer] Initializing...');

    const server = createMCPServer({
      name: 'streaming-response',
      version: '1.0.0',
      description: 'REPLOID Streaming Response - handle streaming LLM responses',
      capabilities: { tools: true, resources: false, prompts: false },
      tools: [
        {
          name: 'stream_response',
          schema: {
            description: 'Start streaming a response from an LLM',
            properties: {
              stream_id: { type: 'string', description: 'Unique stream identifier' },
              endpoint: { type: 'string', description: 'API endpoint' },
              payload: { type: 'object', description: 'Request payload' }
            },
            required: ['stream_id', 'endpoint', 'payload']
          },
          handler: async (args) => {
            const { stream_id, endpoint, payload } = args;
            const stream = await StreamingResponseHandler.streamResponse(stream_id, endpoint, payload);
            return { success: true, stream_id, stream };
          }
        },
        {
          name: 'abort_stream',
          schema: {
            description: 'Abort an active stream',
            properties: {
              stream_id: { type: 'string', description: 'Stream identifier to abort' }
            },
            required: ['stream_id']
          },
          handler: async (args) => {
            const { stream_id } = args;
            await StreamingResponseHandler.abortStream(stream_id);
            return { success: true, stream_id, aborted: true };
          }
        },
        {
          name: 'get_stream_status',
          schema: {
            description: 'Get status of a stream',
            properties: {
              stream_id: { type: 'string', description: 'Stream identifier' }
            },
            required: ['stream_id']
          },
          handler: async (args) => {
            const { stream_id } = args;
            const status = StreamingResponseHandler.getStreamStatus(stream_id);
            return { success: true, stream_id, status };
          }
        },
        {
          name: 'wrap_api_for_streaming',
          schema: {
            description: 'Wrap an API call to support streaming',
            properties: {
              api_config: { type: 'object', description: 'API configuration' }
            },
            required: ['api_config']
          },
          handler: async (args) => {
            const { api_config } = args;
            const wrapped = await StreamingResponseHandler.wrapApiForStreaming(api_config);
            return { success: true, wrapped };
          }
        }
      ]
    });

    server.initialize();
    logger.info(`[StreamingResponseMCPServer] Initialized with ${server.listTools().length} tools`);
    return server;
  }
};

export default StreamingResponseMCPServer;
