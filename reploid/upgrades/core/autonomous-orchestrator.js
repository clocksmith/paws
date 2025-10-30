// @blueprint 0x00001D - Curator Mode: Autonomous overnight proposal generation with safety boundaries and visual reports.
const AutonomousOrchestrator = {
  metadata: {
    id: 'AutonomousOrchestrator',
    version: '1.0.0',
    dependencies: ['config', 'Utils', 'Storage', 'EventBus'],
    async: false,
    type: 'service'
  },

  factory: (deps) => {
    const { config, Utils, Storage, EventBus } = deps;
    const { logger } = Utils;

    let isRunning = false;
    let currentIteration = 0;
    let sessionHistory = [];
    let startTime = null;

    // Curator Mode Configuration
    const CURATOR_CONFIG = {
      enabled: false,
      autoApproveContext: true,
      autoApproveProposal: false,  // SAFE: Only generate proposals, don't apply
      maxProposalsPerGoal: 7,
      iterationDelay: 5000,  // 5 seconds between iterations
      goals: [
        "Analyze all modules for performance optimization opportunities",
        "Generate test cases for untested functions in core modules",
        "Create RFC proposals for missing blueprint documentation",
        "Analyze tool creation patterns from reflection history and create factory tools where beneficial",
        "Detect repeated tool execution sequences and propose composite tools to automate workflows",
        "Review frequently modified files and suggest refactorings to reduce code churn",
        "Identify recurring failure patterns and propose avoidance strategies"
      ],
      metaGoals: [
        // Meta-cognitive goals for autonomous self-improvement
        "Trigger ReflectionAnalyzer meta-analysis and review detected improvement opportunities",
        "Analyze DejaVuDetector patterns and propose meta-improvements for high-confidence patterns",
        "Review MetaCognitiveLayer improvement history and assess effectiveness of past improvements",
        "Detect inefficient tool usage patterns and propose optimizations",
        "Identify opportunities for creating meta-tools (tools that create other tools)"
      ]
    };

    let currentGoalIndex = 0;
    let proposalsForCurrentGoal = 0;

    const startCuratorMode = async (customGoals = null) => {
      if (isRunning) {
        logger.warn('[Curator] Already running');
        return { success: false, message: 'Curator mode already running' };
      }

      isRunning = true;
      currentIteration = 0;
      currentGoalIndex = 0;
      proposalsForCurrentGoal = 0;
      sessionHistory = [];
      startTime = Date.now();

      if (customGoals && customGoals.length > 0) {
        CURATOR_CONFIG.goals = customGoals;
      }

      logger.info('[Curator] Starting autonomous mode with goals:', CURATOR_CONFIG.goals);

      EventBus.emit('curator:started', {
        goals: CURATOR_CONFIG.goals,
        maxProposalsPerGoal: CURATOR_CONFIG.maxProposalsPerGoal,
        startTime
      });

      // Start first iteration
      await runNextIteration();

      return {
        success: true,
        message: `Curator mode started with ${CURATOR_CONFIG.goals.length} goals`,
        sessionId: `curator-${startTime}`
      };
    };

    const stopCuratorMode = () => {
      if (!isRunning) return { success: false, message: 'Not running' };

      isRunning = false;

      const report = generateReport();
      logger.info('[Curator] Stopped. Generated', sessionHistory.length, 'proposals');

      EventBus.emit('curator:stopped', { report });

      return {
        success: true,
        totalProposals: sessionHistory.length,
        report
      };
    };

    const runNextIteration = async () => {
      if (!isRunning) return;

      // Check if we've completed all goals
      if (currentGoalIndex >= CURATOR_CONFIG.goals.length) {
        logger.info('[Curator] All goals completed');
        stopCuratorMode();
        return;
      }

      // Check if we've hit max proposals for current goal
      if (proposalsForCurrentGoal >= CURATOR_CONFIG.maxProposalsPerGoal) {
        logger.info(`[Curator] Completed ${CURATOR_CONFIG.maxProposalsPerGoal} proposals for goal ${currentGoalIndex + 1}`);
        currentGoalIndex++;
        proposalsForCurrentGoal = 0;

        if (currentGoalIndex >= CURATOR_CONFIG.goals.length) {
          stopCuratorMode();
          return;
        }
      }

      currentIteration++;
      const currentGoal = CURATOR_CONFIG.goals[currentGoalIndex];

      logger.info(`[Curator] Iteration ${currentIteration}: Goal ${currentGoalIndex + 1}/${CURATOR_CONFIG.goals.length}, Proposal ${proposalsForCurrentGoal + 1}/${CURATOR_CONFIG.maxProposalsPerGoal}`);

      const iterationStart = Date.now();

      try {
        // Trigger agent cycle with current goal
        EventBus.emit('goal:set', currentGoal);

        // Record iteration start
        const iteration = {
          id: currentIteration,
          goalIndex: currentGoalIndex,
          goal: currentGoal,
          proposalNumber: proposalsForCurrentGoal + 1,
          startTime: iterationStart,
          status: 'running'
        };

        sessionHistory.push(iteration);
        EventBus.emit('curator:iteration:start', iteration);

      } catch (error) {
        logger.error('[Curator] Iteration failed:', error);
        sessionHistory[sessionHistory.length - 1].status = 'error';
        sessionHistory[sessionHistory.length - 1].error = error.message;
        sessionHistory[sessionHistory.length - 1].endTime = Date.now();

        // Continue to next iteration after delay
        setTimeout(runNextIteration, CURATOR_CONFIG.iterationDelay);
      }
    };

    const handleProposalGenerated = async (event) => {
      if (!isRunning) return;

      const iteration = sessionHistory[sessionHistory.length - 1];
      if (!iteration) return;

      iteration.status = 'completed';
      iteration.endTime = Date.now();
      iteration.duration = iteration.endTime - iteration.startTime;
      iteration.proposalPath = event.proposalPath || 'unknown';

      proposalsForCurrentGoal++;

      logger.info(`[Curator] Proposal ${proposalsForCurrentGoal} generated for goal ${currentGoalIndex + 1}`);

      EventBus.emit('curator:iteration:complete', iteration);

      // Schedule next iteration
      setTimeout(runNextIteration, CURATOR_CONFIG.iterationDelay);
    };

    const handleCycleError = (error) => {
      if (!isRunning) return;

      const iteration = sessionHistory[sessionHistory.length - 1];
      if (iteration && iteration.status === 'running') {
        iteration.status = 'error';
        iteration.error = error.message || 'Unknown error';
        iteration.endTime = Date.now();

        logger.error('[Curator] Cycle error:', error);

        // Continue to next iteration
        setTimeout(runNextIteration, CURATOR_CONFIG.iterationDelay);
      }
    };

    const generateReport = () => {
      const endTime = Date.now();
      const totalDuration = endTime - startTime;

      const report = {
        sessionId: `curator-${startTime}`,
        startTime,
        endTime,
        totalDuration,
        totalIterations: currentIteration,
        totalProposals: sessionHistory.filter(h => h.status === 'completed').length,
        goals: CURATOR_CONFIG.goals.map((goal, idx) => ({
          goal,
          index: idx,
          proposals: sessionHistory.filter(h => h.goalIndex === idx && h.status === 'completed').length,
          errors: sessionHistory.filter(h => h.goalIndex === idx && h.status === 'error').length
        })),
        iterations: sessionHistory,
        averageDuration: sessionHistory
          .filter(h => h.duration)
          .reduce((sum, h) => sum + h.duration, 0) /
          (sessionHistory.filter(h => h.duration).length || 1)
      };

      // Save report to VFS
      saveReport(report);

      return report;
    };

    const saveReport = async (report) => {
      try {
        const reportPath = `/sessions/curator-reports/report-${report.sessionId}.json`;
        await Storage.writeArtifact(reportPath, JSON.stringify(report, null, 2));

        // Also generate HTML report
        const htmlReport = generateHTMLReport(report);
        const htmlPath = `/sessions/curator-reports/report-${report.sessionId}.html`;
        await Storage.writeArtifact(htmlPath, htmlReport);

        logger.info('[Curator] Report saved:', htmlPath);

        EventBus.emit('curator:report:saved', {
          jsonPath: reportPath,
          htmlPath,
          report
        });
      } catch (error) {
        logger.error('[Curator] Failed to save report:', error);
      }
    };

    const generateHTMLReport = (report) => {
      const successRate = ((report.totalProposals / report.totalIterations) * 100).toFixed(1);
      const durationMins = (report.totalDuration / 60000).toFixed(1);
      const avgIterationSecs = (report.averageDuration / 1000).toFixed(1);

      return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>⛮ Curator Mode Report - ${new Date(report.startTime).toLocaleString()}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'SF Mono', 'Consolas', monospace;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: #e0e0e0;
      padding: 20px;
      line-height: 1.6;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 {
      color: #4fc3f7;
      margin-bottom: 10px;
      font-size: 28px;
      text-align: center;
    }
    .subtitle {
      text-align: center;
      color: #aaa;
      margin-bottom: 30px;
      font-size: 14px;
    }
    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
      margin-bottom: 30px;
    }
    .metric {
      background: rgba(255, 255, 255, 0.05);
      padding: 20px;
      border-radius: 8px;
      border-left: 4px solid #4fc3f7;
    }
    .metric-label {
      color: #aaa;
      font-size: 12px;
      text-transform: uppercase;
      margin-bottom: 5px;
    }
    .metric-value {
      color: #4fc3f7;
      font-size: 32px;
      font-weight: bold;
    }
    .metric-unit {
      color: #aaa;
      font-size: 14px;
      margin-left: 5px;
    }
    .goals {
      background: rgba(255, 255, 255, 0.05);
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 30px;
    }
    .goals h2 {
      color: #4fc3f7;
      margin-bottom: 15px;
      font-size: 20px;
    }
    .goal-item {
      background: rgba(0, 0, 0, 0.2);
      padding: 15px;
      margin-bottom: 10px;
      border-radius: 4px;
      border-left: 3px solid #66bb6a;
    }
    .goal-item.has-errors {
      border-left-color: #f48771;
    }
    .goal-title {
      color: #fff;
      font-weight: bold;
      margin-bottom: 5px;
    }
    .goal-stats {
      color: #aaa;
      font-size: 13px;
    }
    .goal-stats .success { color: #66bb6a; }
    .goal-stats .error { color: #f48771; }
    .timeline {
      background: rgba(255, 255, 255, 0.05);
      padding: 20px;
      border-radius: 8px;
    }
    .timeline h2 {
      color: #4fc3f7;
      margin-bottom: 15px;
      font-size: 20px;
    }
    .iteration {
      background: rgba(0, 0, 0, 0.2);
      padding: 12px 15px;
      margin-bottom: 8px;
      border-radius: 4px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-left: 3px solid #4fc3f7;
    }
    .iteration.error {
      border-left-color: #f48771;
      background: rgba(244, 135, 113, 0.1);
    }
    .iteration-left {
      flex: 1;
    }
    .iteration-id {
      color: #4fc3f7;
      font-size: 11px;
      margin-bottom: 3px;
    }
    .iteration-goal {
      color: #fff;
      font-size: 13px;
      margin-bottom: 3px;
    }
    .iteration-error {
      color: #f48771;
      font-size: 12px;
      font-style: italic;
    }
    .iteration-duration {
      color: #aaa;
      font-size: 12px;
      text-align: right;
    }
    .status-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 3px;
      font-size: 11px;
      font-weight: bold;
      margin-left: 10px;
    }
    .status-badge.completed {
      background: #66bb6a;
      color: #000;
    }
    .status-badge.error {
      background: #f48771;
      color: #fff;
    }
    .footer {
      text-align: center;
      color: #666;
      margin-top: 30px;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>⛮ REPLOID Curator Mode Report</h1>
    <div class="subtitle">
      Generated: ${new Date(report.endTime).toLocaleString()}<br>
      Session ID: ${report.sessionId}
    </div>

    <div class="summary">
      <div class="metric">
        <div class="metric-label">Total Proposals</div>
        <div class="metric-value">${report.totalProposals}</div>
      </div>
      <div class="metric">
        <div class="metric-label">Success Rate</div>
        <div class="metric-value">${successRate}<span class="metric-unit">%</span></div>
      </div>
      <div class="metric">
        <div class="metric-label">Total Duration</div>
        <div class="metric-value">${durationMins}<span class="metric-unit">min</span></div>
      </div>
      <div class="metric">
        <div class="metric-label">Avg Iteration</div>
        <div class="metric-value">${avgIterationSecs}<span class="metric-unit">sec</span></div>
      </div>
    </div>

    <div class="goals">
      <h2>☐ Goals Summary</h2>
      ${report.goals.map((g, idx) => `
        <div class="goal-item ${g.errors > 0 ? 'has-errors' : ''}">
          <div class="goal-title">Goal ${idx + 1}: ${g.goal}</div>
          <div class="goal-stats">
            <span class="success">✓ ${g.proposals} proposals</span>
            ${g.errors > 0 ? `<span class="error">✗ ${g.errors} errors</span>` : ''}
          </div>
        </div>
      `).join('')}
    </div>

    <div class="timeline">
      <h2>☇ Iteration Timeline</h2>
      ${report.iterations.map(iter => `
        <div class="iteration ${iter.status === 'error' ? 'error' : ''}">
          <div class="iteration-left">
            <div class="iteration-id">
              Iteration #${iter.id} - Goal ${iter.goalIndex + 1} - Proposal ${iter.proposalNumber}
              <span class="status-badge ${iter.status}">${iter.status.toUpperCase()}</span>
            </div>
            <div class="iteration-goal">${iter.goal}</div>
            ${iter.error ? `<div class="iteration-error">Error: ${iter.error}</div>` : ''}
          </div>
          <div class="iteration-duration">
            ${iter.duration ? (iter.duration / 1000).toFixed(1) + 's' : '—'}
          </div>
        </div>
      `).join('')}
    </div>

    <div class="footer">
      REPLOID Sentinel Agent - Curator Mode v1.0.0
    </div>
  </div>
</body>
</html>`;
    };

    /**
     * Start curator mode with meta-cognitive goals for self-improvement
     */
    const startMetaCuratorMode = async () => {
      logger.info('[Curator] Starting meta-cognitive curator mode');

      // Use meta-goals instead of regular goals
      return await startCuratorMode(CURATOR_CONFIG.metaGoals);
    };

    /**
     * Get all available meta-goals
     */
    const getMetaGoals = () => {
      return [...CURATOR_CONFIG.metaGoals];
    };

    // Listen for agent events to track progress
    EventBus.on('agent:state:change', (event) => {
      if (isRunning && event.newState === 'AWAITING_PROPOSAL_APPROVAL') {
        // Proposal generated - record it
        handleProposalGenerated({ proposalPath: event.context?.turn?.dogs_path });
      }
    });

    EventBus.on('agent:error', handleCycleError);

    // Expose state for widget
    const getState = () => ({
      isRunning,
      currentIteration,
      sessionHistory,
      startTime,
      currentGoalIndex,
      proposalsForCurrentGoal,
      config: CURATOR_CONFIG
    });

    return {
      api: {
        startCuratorMode,
        startMetaCuratorMode,
        stopCuratorMode,
        isRunning: () => isRunning,
        getCurrentStatus: () => ({
          running: isRunning,
          iteration: currentIteration,
          goalIndex: currentGoalIndex,
          proposalsForCurrentGoal,
          totalProposals: sessionHistory.filter(h => h.status === 'completed').length
        }),
        getConfig: () => ({ ...CURATOR_CONFIG }),
        updateConfig: (updates) => {
          Object.assign(CURATOR_CONFIG, updates);
          return CURATOR_CONFIG;
        },
        getMetaGoals,
        getState
      },

      widget: {
        element: 'autonomous-orchestrator-widget',
        displayName: 'Autonomous Orchestrator',
        icon: '⚙',
        category: 'agent',
        updateInterval: 3000
      }
    };
  }
};

// Web Component for Autonomous Orchestrator Widget
class AutonomousOrchestratorWidget extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._eventBus = null;
  }

  connectedCallback() {
    // Resolve EventBus from DI container
    if (typeof window !== 'undefined' && window.DIContainer) {
      this._eventBus = window.DIContainer.resolve('EventBus');
    }

    this.render();

    // Set up EventBus listeners for real-time updates
    if (this._eventBus) {
      this._updateHandler = () => this.render();
      this._eventBus.on('curator:started', this._updateHandler, 'AutonomousOrchestratorWidget');
      this._eventBus.on('curator:stopped', this._updateHandler, 'AutonomousOrchestratorWidget');
      this._eventBus.on('curator:iteration:start', this._updateHandler, 'AutonomousOrchestratorWidget');
      this._eventBus.on('curator:iteration:complete', this._updateHandler, 'AutonomousOrchestratorWidget');
    }

    // Auto-refresh at updateInterval
    if (this.updateInterval) {
      this._interval = setInterval(() => this.render(), this.updateInterval);
    }
  }

  disconnectedCallback() {
    // Clean up EventBus listeners
    if (this._eventBus && this._updateHandler) {
      this._eventBus.off('curator:started', this._updateHandler);
      this._eventBus.off('curator:stopped', this._updateHandler);
      this._eventBus.off('curator:iteration:start', this._updateHandler);
      this._eventBus.off('curator:iteration:complete', this._updateHandler);
    }

    if (this._interval) clearInterval(this._interval);
  }

  set moduleApi(api) {
    this._api = api;
    this.render();
  }

  set updateInterval(interval) {
    this._updateInterval = interval;
  }

  get updateInterval() {
    return this._updateInterval || 3000;
  }

  getStatus() {
    if (!this._api) return { state: 'idle', primaryMetric: 'Loading...', secondaryMetric: '' };

    const state = this._api.getState();

    return {
      state: state.isRunning ? 'active' : 'idle',
      primaryMetric: state.isRunning ? `Iteration ${state.currentIteration}` : 'Stopped',
      secondaryMetric: state.isRunning
        ? `Goal ${state.currentGoalIndex + 1}/${state.config.goals.length}`
        : '',
      lastActivity: state.sessionHistory.length > 0
        ? state.sessionHistory[state.sessionHistory.length - 1].startTime
        : null
    };
  }

  render() {
    if (!this._api) {
      this.shadowRoot.innerHTML = '<div>Loading...</div>';
      return;
    }

    const state = this._api.getState();
    const { isRunning, currentIteration, sessionHistory, startTime, currentGoalIndex, proposalsForCurrentGoal, config } = state;

    const completedProposals = sessionHistory.filter(h => h.status === 'completed').length;
    const errorCount = sessionHistory.filter(h => h.status === 'error').length;
    const successRate = currentIteration > 0 ? ((completedProposals / currentIteration) * 100).toFixed(1) : 0;

    const formatDuration = (ms) => {
      if (!ms) return '—';
      const secs = Math.floor(ms / 1000);
      const mins = Math.floor(secs / 60);
      const hours = Math.floor(mins / 60);
      if (hours > 0) return `${hours}h ${mins % 60}m`;
      if (mins > 0) return `${mins}m ${secs % 60}s`;
      return `${secs}s`;
    };

    const sessionDuration = isRunning && startTime ? Date.now() - startTime : 0;

    // Calculate progress for current goal
    const currentGoalProgress = config.maxProposalsPerGoal > 0
      ? (proposalsForCurrentGoal / config.maxProposalsPerGoal) * 100
      : 0;

    // Recent iterations (last 10)
    const recentIterations = sessionHistory.slice(-10).reverse();

    // Goals summary
    const goalsStats = config.goals.map((goal, idx) => ({
      goal,
      index: idx,
      proposals: sessionHistory.filter(h => h.goalIndex === idx && h.status === 'completed').length,
      errors: sessionHistory.filter(h => h.goalIndex === idx && h.status === 'error').length,
      isCurrent: idx === currentGoalIndex
    }));

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          background: rgba(255,255,255,0.05);
          border-radius: 8px;
          padding: 16px;
          color: #fff;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }

        h4 {
          margin: 0 0 16px 0;
          font-size: 1.2em;
          color: #4fc3f7;
        }

        h5 {
          margin: 16px 0 8px 0;
          font-size: 1em;
          color: #aaa;
        }

        .status-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
          padding: 12px;
          background: rgba(0,0,0,0.2);
          border-radius: 6px;
        }

        .status-indicator {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .status-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: ${isRunning ? '#0c0' : '#666'};
          animation: ${isRunning ? 'pulse 2s infinite' : 'none'};
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .status-text {
          font-size: 1.2em;
          font-weight: bold;
          color: ${isRunning ? '#0c0' : '#aaa'};
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: 12px;
          margin-bottom: 16px;
        }

        .stat-card {
          background: rgba(255,255,255,0.05);
          border-radius: 6px;
          padding: 12px;
        }

        .stat-label {
          font-size: 0.85em;
          color: #888;
          margin-bottom: 4px;
        }

        .stat-value {
          font-size: 1.5em;
          font-weight: bold;
          color: #4fc3f7;
        }

        .current-goal {
          background: rgba(79, 195, 247, 0.1);
          border-left: 4px solid #4fc3f7;
          padding: 12px;
          border-radius: 4px;
          margin-bottom: 16px;
        }

        .current-goal-title {
          font-size: 0.9em;
          color: #888;
          margin-bottom: 4px;
        }

        .current-goal-text {
          color: #fff;
          font-weight: bold;
          margin-bottom: 8px;
        }

        .progress-bar {
          background: rgba(255,255,255,0.1);
          border-radius: 4px;
          height: 8px;
          overflow: hidden;
        }

        .progress-fill {
          background: linear-gradient(90deg, #4fc3f7, #66bb6a);
          height: 100%;
          transition: width 0.3s ease;
        }

        .progress-text {
          font-size: 0.85em;
          color: #aaa;
          margin-top: 4px;
        }

        .goals-list {
          max-height: 200px;
          overflow-y: auto;
        }

        .goal-item {
          padding: 8px;
          background: rgba(255,255,255,0.03);
          border-radius: 4px;
          margin-bottom: 6px;
          border-left: 3px solid #666;
        }

        .goal-item.current {
          border-left-color: #4fc3f7;
          background: rgba(79, 195, 247, 0.1);
        }

        .goal-item.completed {
          border-left-color: #66bb6a;
        }

        .goal-title {
          font-size: 0.9em;
          color: #fff;
          margin-bottom: 4px;
        }

        .goal-stats {
          font-size: 0.8em;
          color: #888;
        }

        .goal-stats .success { color: #66bb6a; }
        .goal-stats .error { color: #f48771; }

        .iterations-list {
          max-height: 250px;
          overflow-y: auto;
        }

        .iteration-item {
          padding: 8px;
          background: rgba(255,255,255,0.03);
          border-radius: 4px;
          margin-bottom: 6px;
          border-left: 3px solid #4fc3f7;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }

        .iteration-item.error {
          border-left-color: #f48771;
          background: rgba(244, 135, 113, 0.1);
        }

        .iteration-item.running {
          border-left-color: #ffa500;
          animation: pulse 2s infinite;
        }

        .iteration-info {
          flex: 1;
        }

        .iteration-id {
          font-size: 0.85em;
          color: #4fc3f7;
          margin-bottom: 2px;
        }

        .iteration-goal {
          font-size: 0.9em;
          color: #fff;
          margin-bottom: 2px;
        }

        .iteration-error {
          font-size: 0.85em;
          color: #f48771;
          font-style: italic;
        }

        .iteration-duration {
          font-size: 0.85em;
          color: #aaa;
          text-align: right;
        }

        .controls {
          display: flex;
          gap: 8px;
          margin-top: 16px;
        }

        button {
          flex: 1;
          background: rgba(79, 195, 247, 0.3);
          border: 1px solid #4fc3f7;
          border-radius: 4px;
          color: #fff;
          cursor: pointer;
          padding: 10px;
          font-size: 0.9em;
          font-weight: bold;
          transition: background 0.2s;
        }

        button:hover {
          background: rgba(79, 195, 247, 0.5);
        }

        button:disabled {
          background: rgba(255,255,255,0.05);
          border-color: #666;
          color: #666;
          cursor: not-allowed;
        }

        button.danger {
          background: rgba(244, 135, 113, 0.3);
          border-color: #f48771;
        }

        button.danger:hover:not(:disabled) {
          background: rgba(244, 135, 113, 0.5);
        }

        button.secondary {
          background: rgba(255, 165, 0, 0.3);
          border-color: #ffa500;
        }

        button.secondary:hover:not(:disabled) {
          background: rgba(255, 165, 0, 0.5);
        }

        .info-panel {
          margin-top: 16px;
          padding: 12px;
          background: rgba(100,150,255,0.1);
          border-left: 3px solid #6496ff;
          border-radius: 4px;
        }

        .info-panel strong {
          display: block;
          margin-bottom: 6px;
        }

        .scrollable {
          scrollbar-width: thin;
          scrollbar-color: rgba(79, 195, 247, 0.5) rgba(255,255,255,0.1);
        }

        .scrollable::-webkit-scrollbar {
          width: 6px;
        }

        .scrollable::-webkit-scrollbar-track {
          background: rgba(255,255,255,0.1);
          border-radius: 3px;
        }

        .scrollable::-webkit-scrollbar-thumb {
          background: rgba(79, 195, 247, 0.5);
          border-radius: 3px;
        }
      </style>

      <div class="orchestrator-panel">
        <h4>⚙ Autonomous Orchestrator</h4>

        <div class="status-header">
          <div class="status-indicator">
            <div class="status-dot"></div>
            <div class="status-text">${isRunning ? 'RUNNING' : 'STOPPED'}</div>
          </div>
          ${isRunning ? `
            <div style="color: #aaa; font-size: 0.9em;">
              Duration: ${formatDuration(sessionDuration)}
            </div>
          ` : ''}
        </div>

        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-label">Iterations</div>
            <div class="stat-value">${currentIteration}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Proposals</div>
            <div class="stat-value">${completedProposals}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Errors</div>
            <div class="stat-value" style="color: ${errorCount > 0 ? '#f48771' : '#4fc3f7'};">${errorCount}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Success Rate</div>
            <div class="stat-value">${successRate}%</div>
          </div>
        </div>

        ${isRunning ? `
          <div class="current-goal">
            <div class="current-goal-title">Current Goal (${currentGoalIndex + 1}/${config.goals.length})</div>
            <div class="current-goal-text">${config.goals[currentGoalIndex]}</div>
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${currentGoalProgress}%;"></div>
            </div>
            <div class="progress-text">
              Proposal ${proposalsForCurrentGoal}/${config.maxProposalsPerGoal}
            </div>
          </div>
        ` : ''}

        <h5>Goals Progress</h5>
        <div class="goals-list scrollable">
          ${goalsStats.map(g => `
            <div class="goal-item ${g.isCurrent ? 'current' : ''} ${g.proposals >= config.maxProposalsPerGoal ? 'completed' : ''}">
              <div class="goal-title">
                ${g.isCurrent ? '▶ ' : ''}Goal ${g.index + 1}: ${g.goal}
              </div>
              <div class="goal-stats">
                <span class="success">✓ ${g.proposals}/${config.maxProposalsPerGoal}</span>
                ${g.errors > 0 ? `<span class="error"> ✗ ${g.errors} errors</span>` : ''}
              </div>
            </div>
          `).join('')}
        </div>

        ${recentIterations.length > 0 ? `
          <h5>Recent Iterations (${Math.min(10, sessionHistory.length)} of ${sessionHistory.length})</h5>
          <div class="iterations-list scrollable">
            ${recentIterations.map(iter => `
              <div class="iteration-item ${iter.status}">
                <div class="iteration-info">
                  <div class="iteration-id">
                    Iteration #${iter.id} - Goal ${iter.goalIndex + 1} - Proposal ${iter.proposalNumber}
                  </div>
                  <div class="iteration-goal">${iter.goal}</div>
                  ${iter.error ? `<div class="iteration-error">Error: ${iter.error}</div>` : ''}
                </div>
                <div class="iteration-duration">
                  ${iter.duration ? formatDuration(iter.duration) : (iter.status === 'running' ? '⟳' : '—')}
                </div>
              </div>
            `).join('')}
          </div>
        ` : ''}

        <div class="controls">
          <button id="start-curator" ${isRunning ? 'disabled' : ''}>
            ▶ Start Curator
          </button>
          <button id="start-meta" class="secondary" ${isRunning ? 'disabled' : ''}>
            ◆ Start Meta-Curator
          </button>
          <button id="stop-curator" class="danger" ${!isRunning ? 'disabled' : ''}>
            ◼ Stop Curator
          </button>
        </div>

        <div class="info-panel">
          <strong>ⓘ Curator Mode</strong>
          <div style="color: #aaa; font-size: 0.9em;">
            Autonomous overnight proposal generation with safety boundaries.<br>
            Generates ${config.maxProposalsPerGoal} proposals per goal across ${config.goals.length} goals.<br>
            <strong>Safety:</strong> Proposals require manual approval before application.
          </div>
        </div>
      </div>
    `;

    // Attach event listeners
    const startBtn = this.shadowRoot.getElementById('start-curator');
    const startMetaBtn = this.shadowRoot.getElementById('start-meta');
    const stopBtn = this.shadowRoot.getElementById('stop-curator');

    if (startBtn) {
      startBtn.addEventListener('click', async () => {
        const result = await this._api.startCuratorMode();

        // Get ToastNotifications from DI container
        const ToastNotifications = window.DIContainer?.resolve('ToastNotifications');
        if (result.success) {
          ToastNotifications?.show?.(result.message, 'success');
        } else {
          ToastNotifications?.show?.(result.message, 'error');
        }

        this.render();
      });
    }

    if (startMetaBtn) {
      startMetaBtn.addEventListener('click', async () => {
        const result = await this._api.startMetaCuratorMode();

        const ToastNotifications = window.DIContainer?.resolve('ToastNotifications');
        if (result.success) {
          ToastNotifications?.show?.('Meta-curator mode started', 'success');
        } else {
          ToastNotifications?.show?.(result.message, 'error');
        }

        this.render();
      });
    }

    if (stopBtn) {
      stopBtn.addEventListener('click', () => {
        const result = this._api.stopCuratorMode();

        const ToastNotifications = window.DIContainer?.resolve('ToastNotifications');
        if (result.success) {
          ToastNotifications?.show?.(`Stopped. Generated ${result.totalProposals} proposals`, 'success');
        } else {
          ToastNotifications?.show?.(result.message, 'error');
        }

        this.render();
      });
    }
  }
}

// Define the custom element
if (!customElements.get('autonomous-orchestrator-widget')) {
  customElements.define('autonomous-orchestrator-widget', AutonomousOrchestratorWidget);
}

// Export for ES modules
export default AutonomousOrchestrator;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = AutonomousOrchestrator;
}
