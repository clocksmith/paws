// Inter-Tab Coordination Module for REPLOID
// Enables communication and coordination between multiple browser tabs

const InterTabCoordinator = {
  metadata: {
    id: 'InterTabCoordinator',
    version: '1.0.0',
    dependencies: ['logger', 'StateManager', 'Utils'],
    async: false,
    type: 'service'
  },

  factory: (deps) => {
    const { logger, StateManager, Utils } = deps;
    
    // Coordination state
    let tabId = null;
    let isLeader = false;
    let channel = null;
    let sharedState = new Map();
    let messageHandlers = new Map();
    let leaderElectionTimeout = null;
    
    // Initialize coordinator
    const initialize = () => {
      logger.info('[InterTabCoordinator] Initializing inter-tab coordination');
      
      // Generate unique tab ID
      tabId = `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Create broadcast channel
      channel = new BroadcastChannel('reploid-coordinator');
      channel.onmessage = handleMessage;
      
      // Register tab
      registerTab();
      
      // Start leader election
      electLeader();
      
      // Handle tab close
      window.addEventListener('beforeunload', handleUnload);
      
      // Periodic heartbeat
      setInterval(sendHeartbeat, 5000);
      
      logger.info(`[InterTabCoordinator] Initialized with tab ID: ${tabId}`);
    };
    
    // Register this tab
    const registerTab = () => {
      broadcast({
        type: 'tab-register',
        tabId,
        timestamp: Date.now(),
        state: StateManager.getState()
      });
    };
    
    // Handle incoming messages
    const handleMessage = (event) => {
      const message = event.data;
      
      if (message.tabId === tabId) return; // Ignore own messages
      
      logger.debug(`[InterTabCoordinator] Message from ${message.tabId}:`, message.type);
      
      // Route to specific handlers
      switch (message.type) {
        case 'tab-register':
          handleTabRegister(message);
          break;
        case 'leader-election':
          handleLeaderElection(message);
          break;
        case 'leader-announcement':
          handleLeaderAnnouncement(message);
          break;
        case 'state-sync':
          handleStateSync(message);
          break;
        case 'task-claim':
          handleTaskClaim(message);
          break;
        case 'task-complete':
          handleTaskComplete(message);
          break;
        case 'heartbeat':
          updateTabStatus(message.tabId, 'active');
          break;
        case 'tab-unload':
          handleTabUnload(message);
          break;
        default:
          // Check custom handlers
          const handler = messageHandlers.get(message.type);
          if (handler) {
            handler(message);
          }
      }
    };
    
    // Handle tab registration
    const handleTabRegister = (message) => {
      logger.info(`[InterTabCoordinator] New tab registered: ${message.tabId}`);
      
      // Share current state with new tab
      if (isLeader) {
        unicast(message.tabId, {
          type: 'state-sync',
          state: StateManager.getState(),
          sharedState: Array.from(sharedState.entries())
        });
      }
    };
    
    // Leader election process
    const electLeader = () => {
      logger.info('[InterTabCoordinator] Starting leader election');
      
      // Clear existing timeout
      if (leaderElectionTimeout) {
        clearTimeout(leaderElectionTimeout);
      }
      
      // Announce candidacy
      broadcast({
        type: 'leader-election',
        tabId,
        timestamp: Date.now()
      });
      
      // Wait for other candidates
      leaderElectionTimeout = setTimeout(() => {
        // If no other leader announced, become leader
        if (!isLeader) {
          becomeLeader();
        }
      }, 1000);
    };
    
    // Handle leader election message
    const handleLeaderElection = (message) => {
      // Simple election: lowest timestamp wins
      if (message.timestamp < Date.now() - 1000) {
        // This tab has been around longer, they should be leader
        clearTimeout(leaderElectionTimeout);
      }
    };
    
    // Become the leader tab
    const becomeLeader = () => {
      logger.info('[InterTabCoordinator] This tab is now the leader');
      isLeader = true;
      
      broadcast({
        type: 'leader-announcement',
        tabId,
        timestamp: Date.now()
      });
      
      // Start leader responsibilities
      startLeaderTasks();
    };
    
    // Handle leader announcement
    const handleLeaderAnnouncement = (message) => {
      logger.info(`[InterTabCoordinator] Tab ${message.tabId} is the leader`);
      isLeader = false;
      clearTimeout(leaderElectionTimeout);
    };
    
    // Start leader-specific tasks
    const startLeaderTasks = () => {
      // Coordinate autonomous cycles
      setInterval(() => {
        if (isLeader) {
          coordinateAutonomousCycle();
        }
      }, 60000); // Every minute
      
      // Manage shared state
      setInterval(() => {
        if (isLeader) {
          syncSharedState();
        }
      }, 10000); // Every 10 seconds
    };
    
    // Coordinate autonomous cycle execution
    const coordinateAutonomousCycle = async () => {
      logger.info('[InterTabCoordinator] Leader coordinating autonomous cycle');
      
      // Check if any tab is already running a cycle
      const cycleInProgress = sharedState.get('cycleInProgress');
      if (cycleInProgress) {
        logger.debug('[InterTabCoordinator] Cycle already in progress');
        return;
      }
      
      // Claim cycle execution
      sharedState.set('cycleInProgress', true);
      broadcast({
        type: 'cycle-start',
        tabId,
        timestamp: Date.now()
      });
      
      // Execute cycle (would interface with agent-cycle module)
      try {
        // Placeholder for actual cycle execution
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        broadcast({
          type: 'cycle-complete',
          tabId,
          timestamp: Date.now()
        });
      } finally {
        sharedState.set('cycleInProgress', false);
      }
    };
    
    // Sync shared state across tabs
    const syncSharedState = () => {
      broadcast({
        type: 'state-sync',
        tabId,
        sharedState: Array.from(sharedState.entries()),
        timestamp: Date.now()
      });
    };
    
    // Handle state sync message
    const handleStateSync = (message) => {
      if (message.sharedState) {
        sharedState = new Map(message.sharedState);
      }
      
      if (message.state && !isLeader) {
        // Followers can optionally sync state
        logger.debug('[InterTabCoordinator] Received state sync from leader');
      }
    };
    
    // Claim a task for execution
    const claimTask = async (taskId) => {
      logger.info(`[InterTabCoordinator] Claiming task: ${taskId}`);
      
      // Check if task is already claimed
      const claimedBy = sharedState.get(`task-${taskId}`);
      if (claimedBy && claimedBy !== tabId) {
        logger.warn(`[InterTabCoordinator] Task ${taskId} already claimed by ${claimedBy}`);
        return false;
      }
      
      // Claim the task
      sharedState.set(`task-${taskId}`, tabId);
      broadcast({
        type: 'task-claim',
        tabId,
        taskId,
        timestamp: Date.now()
      });
      
      return true;
    };
    
    // Handle task claim message
    const handleTaskClaim = (message) => {
      sharedState.set(`task-${message.taskId}`, message.tabId);
      logger.debug(`[InterTabCoordinator] Task ${message.taskId} claimed by ${message.tabId}`);
    };
    
    // Complete a task
    const completeTask = (taskId, result) => {
      logger.info(`[InterTabCoordinator] Task completed: ${taskId}`);
      
      sharedState.delete(`task-${taskId}`);
      broadcast({
        type: 'task-complete',
        tabId,
        taskId,
        result,
        timestamp: Date.now()
      });
    };
    
    // Handle task completion
    const handleTaskComplete = (message) => {
      sharedState.delete(`task-${message.taskId}`);
      logger.debug(`[InterTabCoordinator] Task ${message.taskId} completed by ${message.tabId}`);
      
      // Notify any listeners
      const handler = messageHandlers.get(`task-${message.taskId}-complete`);
      if (handler) {
        handler(message.result);
      }
    };
    
    // Broadcast message to all tabs
    const broadcast = (message) => {
      if (!channel) return;
      
      channel.postMessage({
        ...message,
        tabId,
        timestamp: message.timestamp || Date.now()
      });
    };
    
    // Send message to specific tab
    const unicast = (targetTabId, message) => {
      broadcast({
        ...message,
        targetTabId,
        unicast: true
      });
    };
    
    // Register custom message handler
    const onMessage = (messageType, handler) => {
      messageHandlers.set(messageType, handler);
      logger.debug(`[InterTabCoordinator] Registered handler for: ${messageType}`);
    };
    
    // Get or set shared value
    const getShared = (key) => {
      return sharedState.get(key);
    };
    
    const setShared = (key, value) => {
      sharedState.set(key, value);
      
      // Broadcast update
      broadcast({
        type: 'shared-update',
        key,
        value,
        timestamp: Date.now()
      });
    };
    
    // Execute function on leader tab only
    const executeOnLeader = (fn) => {
      if (isLeader) {
        return fn();
      } else {
        logger.debug('[InterTabCoordinator] Not leader, skipping execution');
        return null;
      }
    };
    
    // Request leader to execute function
    const requestLeaderExecution = (functionName, args) => {
      return new Promise((resolve, reject) => {
        const requestId = Utils.generateId();
        
        // Register response handler
        onMessage(`leader-exec-response-${requestId}`, (message) => {
          if (message.error) {
            reject(new Error(message.error));
          } else {
            resolve(message.result);
          }
        });
        
        // Send request
        broadcast({
          type: 'leader-exec-request',
          requestId,
          functionName,
          args,
          timestamp: Date.now()
        });
        
        // Timeout after 10 seconds
        setTimeout(() => {
          reject(new Error('Leader execution timeout'));
        }, 10000);
      });
    };
    
    // Send heartbeat
    const sendHeartbeat = () => {
      broadcast({
        type: 'heartbeat',
        tabId,
        isLeader,
        timestamp: Date.now()
      });
    };
    
    // Update tab status
    const updateTabStatus = (remoteTabId, status) => {
      sharedState.set(`tab-status-${remoteTabId}`, {
        status,
        lastSeen: Date.now()
      });
    };
    
    // Handle tab unload
    const handleUnload = () => {
      broadcast({
        type: 'tab-unload',
        tabId,
        isLeader,
        timestamp: Date.now()
      });
      
      if (isLeader) {
        // Trigger new leader election
        broadcast({
          type: 'leader-vacancy',
          timestamp: Date.now()
        });
      }
    };
    
    // Handle tab unload message
    const handleTabUnload = (message) => {
      logger.info(`[InterTabCoordinator] Tab ${message.tabId} unloaded`);
      
      // Clean up tab's claimed tasks
      for (const [key, value] of sharedState.entries()) {
        if (key.startsWith('task-') && value === message.tabId) {
          sharedState.delete(key);
        }
      }
      
      // If leader left, start new election
      if (message.isLeader) {
        setTimeout(electLeader, 100);
      }
    };
    
    // Get coordinator statistics
    const getStats = () => {
      const activeTabs = [];
      const now = Date.now();
      
      for (const [key, value] of sharedState.entries()) {
        if (key.startsWith('tab-status-')) {
          const tabId = key.replace('tab-status-', '');
          if (now - value.lastSeen < 10000) {
            activeTabs.push({
              tabId,
              status: value.status,
              lastSeen: value.lastSeen
            });
          }
        }
      }
      
      return {
        tabId,
        isLeader,
        activeTabs: activeTabs.length + 1,
        sharedStateSize: sharedState.size,
        tabs: activeTabs
      };
    };
    
    // Cleanup resources
    const cleanup = () => {
      logger.info('[InterTabCoordinator] Cleaning up');
      
      if (channel) {
        channel.close();
      }
      
      if (leaderElectionTimeout) {
        clearTimeout(leaderElectionTimeout);
      }
      
      window.removeEventListener('beforeunload', handleUnload);
    };
    
    // Initialize on module load
    initialize();
    
    // Public API
    return {
      api: {
        getTabId: () => tabId,
        isLeader: () => isLeader,
        broadcast,
        unicast,
        onMessage,
        claimTask,
        completeTask,
        getShared,
        setShared,
        executeOnLeader,
        requestLeaderExecution,
        getStats,
        cleanup
      }
    };
  }
};

// Legacy compatibility wrapper
const InterTabCoordinatorModule = (logger, StateManager, Utils) => {
  const instance = InterTabCoordinator.factory({ logger, StateManager, Utils });
  return instance.api;
};

// Export both formats
InterTabCoordinator;
InterTabCoordinatorModule;