// ES6 Module version of app-logic.js
// Main application orchestrator with proper module exports

export const AppLogic = {
  metadata: {
    id: 'AppLogic',
    version: '2.0.0',
    dependencies: ['logger', 'Utils', 'Storage', 'StateManager', 'ApiClient', 'AgentCycle', 'UI'],
    async: true,
    type: 'core'
  },

  factory: (deps) => {
    const { logger, Utils, Storage, StateManager, ApiClient, AgentCycle, UI } = deps;
    
    if (!logger || !Utils || !Storage || !StateManager || !ApiClient || !AgentCycle || !UI) {
      throw new Error('AppLogic: Missing required dependencies');
    }

    const handleAgentEvent = (eventData) => {
      const { type, payload } = eventData;
      
      switch (type) {
        case 'cycle:start':
          UI.onCycleStart?.(payload);
          break;
        case 'cycle:complete':
          UI.onCycleComplete?.(payload);
          break;
        case 'cycle:error':
          UI.onCycleError?.(payload);
          break;
        case 'artifact:created':
          UI.onArtifactCreated?.(payload);
          break;
        case 'state:updated':
          UI.updateStateDisplay?.();
          break;
        default:
          logger.logEvent('debug', `Unhandled agent event: ${type}`);
      }
    };

    const init = async () => {
      logger.logEvent('info', 'AppLogic initializing...');
      
      // Initialize state manager
      await StateManager.init();
      
      // Initialize agent cycle with event handlers
      await AgentCycle.init(StateManager, handleAgentEvent);
      
      // Initialize UI with dependencies
      await UI.init(StateManager, AgentCycle);
      
      logger.logEvent('info', 'AppLogic initialization complete');
      
      return {
        getState: () => StateManager.getState(),
        runCycle: () => AgentCycle.executeCycle(),
        abortCycle: () => AgentCycle.abortCurrentCycle(),
        updateGoal: (goal) => StateManager.updateGoal(goal)
      };
    };

    return { init };
  }
};

// Export for ES6 module usage
export default AppLogic;