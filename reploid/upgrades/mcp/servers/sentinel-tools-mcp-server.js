// @blueprint 0x000083 - SentinelTools MCP Server for REPLOID
/**
 * SentinelTools MCP Server
 *
 * Exposes PAWS CLI tool bundling via MCP (cats/dogs pattern)
 * Enables agents to create context bundles and apply code changes
 *
 * Available Tools:
 * - create_cats_bundle - Create a cats bundle (context bundling)
 * - create_dogs_bundle - Create a dogs bundle (code change extraction)
 * - apply_dogs_bundle - Apply a dogs bundle (apply code changes)
 * - parse_dogs_bundle - Parse a dogs bundle
 * - is_path_allowed - Check if path is allowed
 * - curate_files_with_ai - AI-assisted file curation
 */

const SentinelToolsMCPServer = {
  metadata: {
    id: 'SentinelToolsMCPServer',
    version: '1.0.0',
    description: 'PAWS CLI tool bundling (cats/dogs)',
    dependencies: ['ReploidMCPServerBase', 'SentinelTools', 'Utils'],
    async: false,
    type: 'mcp-server'
  },

  factory: (deps) => {
    const { ReploidMCPServerBase, SentinelTools, Utils } = deps;
    const { createMCPServer } = ReploidMCPServerBase;
    const { logger } = Utils;

    logger.info('[SentinelToolsMCPServer] Initializing...');

    const server = createMCPServer({
      name: 'sentinel-tools',
      version: '1.0.0',
      description: 'REPLOID Sentinel Tools - context bundling and code change tools',
      capabilities: { tools: true, resources: false, prompts: false },
      tools: [
        {
          name: 'create_cats_bundle',
          schema: {
            description: 'Create a cats bundle (context bundling for LLMs)',
            properties: {
              file_paths: { type: 'array', description: 'Array of file paths to bundle' },
              options: { type: 'object', description: 'Bundle options' }
            },
            required: ['file_paths']
          },
          handler: async (args) => {
            const { file_paths, options } = args;
            const bundle = await SentinelTools.createCatsBundle(file_paths, options);
            return { success: true, bundle };
          }
        },
        {
          name: 'create_dogs_bundle',
          schema: {
            description: 'Create a dogs bundle (extract code changes)',
            properties: {
              content: { type: 'string', description: 'LLM response content' },
              options: { type: 'object', description: 'Extraction options' }
            },
            required: ['content']
          },
          handler: async (args) => {
            const { content, options } = args;
            const bundle = await SentinelTools.createDogsBundle(content, options);
            return { success: true, bundle };
          }
        },
        {
          name: 'apply_dogs_bundle',
          schema: {
            description: 'Apply a dogs bundle (apply code changes)',
            properties: {
              bundle: { type: 'object', description: 'Dogs bundle to apply' },
              options: { type: 'object', description: 'Application options' }
            },
            required: ['bundle']
          },
          handler: async (args) => {
            const { bundle, options } = args;
            const result = await SentinelTools.applyDogsBundle(bundle, options);
            return { success: true, result };
          }
        },
        {
          name: 'parse_dogs_bundle',
          schema: {
            description: 'Parse a dogs bundle',
            properties: {
              content: { type: 'string', description: 'Bundle content to parse' }
            },
            required: ['content']
          },
          handler: async (args) => {
            const { content } = args;
            const parsed = SentinelTools.parseDogsBundle(content);
            return { success: true, parsed };
          }
        },
        {
          name: 'is_path_allowed',
          schema: {
            description: 'Check if a file path is allowed',
            properties: {
              path: { type: 'string', description: 'File path to check' }
            },
            required: ['path']
          },
          handler: async (args) => {
            const { path } = args;
            const allowed = SentinelTools.isPathAllowed(path);
            return { success: true, path, allowed };
          }
        },
        {
          name: 'curate_files_with_ai',
          schema: {
            description: 'AI-assisted file curation for context bundling',
            properties: {
              goal: { type: 'string', description: 'Goal for file curation' },
              available_files: { type: 'array', description: 'Available files' }
            },
            required: ['goal', 'available_files']
          },
          handler: async (args) => {
            const { goal, available_files } = args;
            const curated = await SentinelTools.curateFilesWithAI(goal, available_files);
            return { success: true, curated };
          }
        }
      ]
    });

    server.initialize();
    logger.info(`[SentinelToolsMCPServer] Initialized with ${server.listTools().length} tools`);
    return server;
  }
};

export default SentinelToolsMCPServer;
