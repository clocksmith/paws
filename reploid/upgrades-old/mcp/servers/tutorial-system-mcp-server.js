// @blueprint 0x00008F - Tutorial System MCP Server for REPLOID
/**
 * Tutorial System MCP Server
 *
 * Exposes REPLOID Tutorial System operations via MCP
 * Enables interactive tutorial management
 *
 * Available Tools:
 * - start_tutorial - Start a tutorial
 * - get_current_step - Get current tutorial step
 * - next_step - Move to next step
 * - previous_step - Move to previous step
 * - complete_tutorial - Complete current tutorial
 */

const TutorialSystemMCPServer = {
  metadata: {
    id: 'TutorialSystemMCPServer',
    version: '1.0.0',
    description: 'Tutorial system operations via MCP',
    dependencies: ['ReploidMCPServerBase', 'TutorialSystem', 'Utils'],
    async: false,
    type: 'mcp-server'
  },

  factory: (deps) => {
    const { ReploidMCPServerBase, TutorialSystem, Utils } = deps;
    const { createMCPServer } = ReploidMCPServerBase;
    const { logger } = Utils;

    logger.info('[TutorialSystemMCPServer] Initializing Tutorial System MCP Server...');

    const server = createMCPServer({
      name: 'tutorial-system',
      version: '1.0.0',
      description: 'REPLOID Tutorial System - interactive tutorials',
      capabilities: { tools: true, resources: false, prompts: false },
      tools: [
        {
          name: 'start_tutorial',
          schema: {
            description: 'Start a tutorial',
            properties: {
              tutorial_id: {
                type: 'string',
                description: 'Tutorial ID (e.g., "first-time", "advanced-features")'
              }
            },
            required: ['tutorial_id']
          },
          handler: async (args) => {
            const { tutorial_id } = args;

            try {
              const success = TutorialSystem.start(tutorial_id);

              if (!success) {
                return {
                  success: false,
                  error: `Tutorial ${tutorial_id} not found`
                };
              }

              const tutorial = TutorialSystem.getCurrentTutorial();

              return {
                success: true,
                tutorial: {
                  id: tutorial.id,
                  name: tutorial.name,
                  description: tutorial.description,
                  steps: tutorial.steps.length,
                  current_step: 0
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
          name: 'get_current_step',
          schema: {
            description: 'Get current tutorial step',
            properties: {}
          },
          handler: async () => {
            try {
              const tutorial = TutorialSystem.getCurrentTutorial();
              const stepIndex = TutorialSystem.getCurrentStep();

              if (!tutorial) {
                return {
                  success: false,
                  error: 'No active tutorial'
                };
              }

              const step = tutorial.steps[stepIndex];

              return {
                success: true,
                step: {
                  index: stepIndex,
                  total: tutorial.steps.length,
                  title: step.title,
                  content: step.content,
                  target: step.target,
                  placement: step.placement,
                  action: step.action
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
          name: 'next_step',
          schema: {
            description: 'Move to next tutorial step',
            properties: {}
          },
          handler: async () => {
            try {
              if (!TutorialSystem.isActive()) {
                return {
                  success: false,
                  error: 'No active tutorial'
                };
              }

              TutorialSystem.next();

              return {
                success: true,
                message: 'Moved to next step'
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
          name: 'previous_step',
          schema: {
            description: 'Move to previous tutorial step',
            properties: {}
          },
          handler: async () => {
            try {
              if (!TutorialSystem.isActive()) {
                return {
                  success: false,
                  error: 'No active tutorial'
                };
              }

              TutorialSystem.previous();

              return {
                success: true,
                message: 'Moved to previous step'
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
          name: 'complete_tutorial',
          schema: {
            description: 'Complete current tutorial',
            properties: {}
          },
          handler: async () => {
            try {
              if (!TutorialSystem.isActive()) {
                return {
                  success: false,
                  error: 'No active tutorial'
                };
              }

              const tutorial = TutorialSystem.getCurrentTutorial();
              TutorialSystem.complete();

              return {
                success: true,
                tutorial_id: tutorial.id,
                message: 'Tutorial completed'
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
          name: 'stop_tutorial',
          schema: {
            description: 'Stop current tutorial',
            properties: {}
          },
          handler: async () => {
            try {
              if (!TutorialSystem.isActive()) {
                return {
                  success: false,
                  error: 'No active tutorial'
                };
              }

              TutorialSystem.stop();

              return {
                success: true,
                message: 'Tutorial stopped'
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
          name: 'list_tutorials',
          schema: {
            description: 'List all available tutorials',
            properties: {}
          },
          handler: async () => {
            try {
              const tutorials = TutorialSystem.getAvailableTutorials();

              return {
                success: true,
                tutorials: tutorials.map(t => ({
                  id: t.id,
                  name: t.name,
                  description: t.description,
                  steps: t.steps,
                  completed: t.completed
                })),
                total: tutorials.length
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
          name: 'show_menu',
          schema: {
            description: 'Show tutorial menu UI',
            properties: {}
          },
          handler: async () => {
            try {
              TutorialSystem.showMenu();

              return {
                success: true,
                message: 'Tutorial menu displayed'
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
          name: 'is_completed',
          schema: {
            description: 'Check if a tutorial is completed',
            properties: {
              tutorial_id: {
                type: 'string',
                description: 'Tutorial ID to check'
              }
            },
            required: ['tutorial_id']
          },
          handler: async (args) => {
            const { tutorial_id } = args;

            try {
              const completed = TutorialSystem.isCompleted(tutorial_id);

              return {
                success: true,
                tutorial_id,
                completed
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

    server.initialize();
    logger.info(`[TutorialSystemMCPServer] Initialized with ${server.listTools().length} tools`);

    return server;
  }
};

export default TutorialSystemMCPServer;
