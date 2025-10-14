const AutonomousOrchestrator = {
  metadata: {
    id: 'AutonomousOrchestrator',
    version: '1.0.0',
    dependencies: ['config', 'Utils', 'StateManager', 'EventBus', 'Storage'],
    async: false,
    type: 'service'
  },

  factory: (deps) => {
    const { config, Utils, StateManager, EventBus, Storage } = deps;
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
        "Create RFC proposals for missing blueprint documentation"
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
        await StateManager.writeArtifact(reportPath, JSON.stringify(report, null, 2));

        // Also generate HTML report
        const htmlReport = generateHTMLReport(report);
        const htmlPath = `/sessions/curator-reports/report-${report.sessionId}.html`;
        await StateManager.writeArtifact(htmlPath, htmlReport);

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

    // Listen for agent events to track progress
    EventBus.on('agent:state:change', (event) => {
      if (isRunning && event.newState === 'AWAITING_PROPOSAL_APPROVAL') {
        // Proposal generated - record it
        handleProposalGenerated({ proposalPath: event.context?.turn?.dogs_path });
      }
    });

    EventBus.on('agent:error', handleCycleError);

    return {
      api: {
        startCuratorMode,
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
        }
      }
    };
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = AutonomousOrchestrator;
}
