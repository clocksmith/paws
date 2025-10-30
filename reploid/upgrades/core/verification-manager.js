// @blueprint 0x000047 - Verification Manager for sandboxed execution
// Verification Manager - Handles Web Worker creation and communication
// Integrates with tool-runner.js for sandboxed verification execution

const VerificationManager = {
  metadata: {
    id: 'VerificationManager',
    version: '1.0.0',
    dependencies: ['Utils', 'Storage'],
    async: false,
    type: 'service'
  },

  factory: (deps) => {
    const { Utils, Storage } = deps;
    const { logger } = Utils;

    let worker = null;
    let pendingVerifications = new Map();

    // Initialize the worker
    const init = () => {
        try {
            // Create worker from the verification-worker.js file
            worker = new Worker('/upgrades/verification-worker.js');

            // Set up message handler
            worker.addEventListener('message', handleWorkerMessage);

            // Set up error handler
            worker.addEventListener('error', (error) => {
                logger.error('[VerificationManager] Worker error:', error);
                // Reject all pending verifications
                for (const [id, handler] of pendingVerifications) {
                    handler.reject(new Error('Worker crashed'));
                }
                pendingVerifications.clear();
            });

            logger.info('[VerificationManager] Worker initialized');
            return true;

        } catch (error) {
            logger.error('[VerificationManager] Failed to initialize worker:', error);
            return false;
        }
    };

    // Handle messages from worker
    const handleWorkerMessage = (event) => {
        const { type, sessionId, success, output, error, level, message } = event.data;

        switch (type) {
            case 'READY':
                logger.info('[VerificationManager] Worker ready');
                break;

            case 'LOG':
                logger.log(level || 'info', message);
                break;

            case 'VERIFY_COMPLETE':
                const handler = pendingVerifications.get(sessionId);
                if (handler) {
                    if (success) {
                        handler.resolve({ success, output });
                    } else {
                        handler.reject(new Error(error || 'Verification failed'));
                    }
                    pendingVerifications.delete(sessionId);
                }
                break;

            case 'ERROR':
                logger.error('[VerificationManager] Worker error:', error);
                break;

            default:
                logger.warn('[VerificationManager] Unknown message type:', type);
        }
    };

    // Run verification command in worker
    const runVerification = async (command, sessionId) => {
        if (!worker) {
            throw new Error('Verification worker not initialized');
        }

        // Generate unique ID for this verification
        const verificationId = sessionId || `verify_${Date.now()}`;

        // Create promise for this verification
        return new Promise(async (resolve, reject) => {
            // Store handlers
            pendingVerifications.set(verificationId, { resolve, reject });

            try {
                // Get current VFS snapshot for worker
                const vfsSnapshot = await createVFSSnapshot();

                // Send verification request to worker
                worker.postMessage({
                    type: 'VERIFY',
                    payload: {
                        command,
                        vfsSnapshot,
                        sessionId: verificationId
                    }
                });

                // Set timeout
                setTimeout(() => {
                    if (pendingVerifications.has(verificationId)) {
                        pendingVerifications.delete(verificationId);
                        reject(new Error('Verification timeout after 30 seconds'));
                    }
                }, 30000);

            } catch (error) {
                pendingVerifications.delete(verificationId);
                reject(error);
            }
        });
    };

    // Create VFS snapshot for worker
    const createVFSSnapshot = async () => {
        const snapshot = {};
        const allMetadata = await Storage.getAllArtifactMetadata();

        // Include only necessary files for verification
        for (const [path, meta] of Object.entries(allMetadata)) {
            // Include JS files, test files, and config files
            if (path.endsWith('.js') ||
                path.endsWith('.json') ||
                path.includes('test') ||
                path.includes('spec')) {

                const content = await Storage.getArtifactContent(path);
                if (content) {
                    snapshot[path] = content;
                }
            }
        }

        return snapshot;
    };

    // Terminate worker
    const terminate = () => {
        if (worker) {
            worker.terminate();
            worker = null;
            pendingVerifications.clear();
            logger.info('[VerificationManager] Worker terminated');
        }
    };

    // Test the worker
    const test = async () => {
        try {
            if (!worker) {
                init();
            }

            worker.postMessage({ type: 'PING' });

            return new Promise((resolve) => {
                const handler = (event) => {
                    if (event.data.type === 'PONG') {
                        worker.removeEventListener('message', handler);
                        resolve(true);
                    }
                };
                worker.addEventListener('message', handler);

                setTimeout(() => resolve(false), 1000);
            });

        } catch (error) {
            logger.error('[VerificationManager] Test failed:', error);
            return false;
        }
    };

    // Verification command builders
    const buildTestCommand = (testPath) => `test:${testPath}`;
    const buildLintCommand = (filePath) => `lint:${filePath}`;
    const buildTypeCheckCommand = (filePath) => `type-check:${filePath}`;
    const buildEvalCommand = (expression) => `eval:${expression}`;

    // Common verification presets
    const verifyTests = async (testPath) => {
        const command = buildTestCommand(testPath);
        return runVerification(command);
    };

    const verifyLinting = async (filePath) => {
        const command = buildLintCommand(filePath);
        return runVerification(command);
    };

    const verifyTypes = async (filePath) => {
        const command = buildTypeCheckCommand(filePath);
        return runVerification(command);
    };

    const verifySafeEval = async (expression) => {
        const command = buildEvalCommand(expression);
        return runVerification(command);
    };

    // Full verification suite
    const runFullVerification = async (changedFiles) => {
        const results = {
            tests: null,
            linting: null,
            types: null,
            overall: true
        };

        try {
            // Run tests if test files were changed
            const testFiles = changedFiles.filter(f => f.includes('test') || f.includes('spec'));
            if (testFiles.length > 0) {
                for (const testFile of testFiles) {
                    try {
                        const testResult = await verifyTests(testFile);
                        results.tests = testResult;
                    } catch (error) {
                        results.tests = { success: false, error: error.message };
                        results.overall = false;
                    }
                }
            }

            // Run linting on all JS files
            const jsFiles = changedFiles.filter(f => f.endsWith('.js'));
            for (const file of jsFiles) {
                try {
                    const lintResult = await verifyLinting(file);
                    results.linting = lintResult;
                } catch (error) {
                    results.linting = { success: false, error: error.message };
                    results.overall = false;
                }
            }

            // Run type checking on JS files
            for (const file of jsFiles) {
                try {
                    const typeResult = await verifyTypes(file);
                    results.types = typeResult;
                } catch (error) {
                    results.types = { success: false, error: error.message };
                    results.overall = false;
                }
            }

        } catch (error) {
            logger.error('[VerificationManager] Full verification failed:', error);
            results.overall = false;
        }

        return results;
    };

    // Verification tracking for widget
    let verificationHistory = [];
    let verificationStats = {
        totalRuns: 0,
        passed: 0,
        failed: 0,
        lastRun: null,
        activeVerifications: 0
    };

    // Wrap runVerification to track stats
    const originalRunVerification = runVerification;
    const trackedRunVerification = async (command, sessionId) => {
        const startTime = Date.now();
        verificationStats.totalRuns++;
        verificationStats.activeVerifications++;
        verificationStats.lastRun = startTime;

        try {
            const result = await originalRunVerification(command, sessionId);

            if (result.success) {
                verificationStats.passed++;
            } else {
                verificationStats.failed++;
            }

            verificationHistory.push({
                command,
                timestamp: startTime,
                duration: Date.now() - startTime,
                success: result.success,
                output: result.output?.substring(0, 200) || '',
                error: result.error
            });

            // Keep history limited
            if (verificationHistory.length > 50) {
                verificationHistory = verificationHistory.slice(-50);
            }

            verificationStats.activeVerifications--;
            return result;
        } catch (error) {
            verificationStats.failed++;
            verificationStats.activeVerifications--;

            verificationHistory.push({
                command,
                timestamp: startTime,
                duration: Date.now() - startTime,
                success: false,
                error: error.message
            });

            throw error;
        }
    };

    // Web Component Widget
    class VerificationManagerWidget extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: 'open' });
      }

      connectedCallback() {
        this.render();
        // Auto-refresh every 2 seconds to track verification progress
        this._interval = setInterval(() => this.render(), 2000);
      }

      disconnectedCallback() {
        if (this._interval) {
          clearInterval(this._interval);
          this._interval = null;
        }
      }

      getStatus() {
        const passRate = verificationStats.totalRuns > 0
          ? Math.round((verificationStats.passed / verificationStats.totalRuns) * 100)
          : 100;

        const isActive = verificationStats.activeVerifications > 0;

        return {
          state: isActive ? 'active' : (verificationStats.failed > 0 ? 'idle' : 'idle'),
          primaryMetric: `${verificationStats.totalRuns} tests run`,
          secondaryMetric: `${passRate}% pass rate`,
          lastActivity: verificationStats.lastRun,
          message: isActive ? `Running ${verificationStats.activeVerifications} verification(s)` : null
        };
      }

      getControls() {
        const controls = [
          {
            id: 'clear-history',
            label: 'Clear History',
            icon: '⛶️',
            action: () => {
              verificationHistory = [];
              // EventBus may not be available in this scope
              if (typeof EventBus !== 'undefined') {
                EventBus.emit('toast:success', { message: 'Verification history cleared' });
              }
              return { success: true, message: 'Verification history cleared' };
            }
          }
        ];

        if (worker) {
          controls.push({
            id: 'test-worker',
            label: 'Test Worker',
            icon: '⚒',
            action: async () => {
              const result = await test();
              if (typeof EventBus !== 'undefined') {
                EventBus.emit('toast:' + (result ? 'success' : 'error'), {
                  message: result ? 'Worker is healthy' : 'Worker test failed'
                });
              }
              return { success: result, message: result ? 'Worker is healthy' : 'Worker test failed' };
            }
          });

          controls.push({
            id: 'terminate-worker',
            label: 'Restart',
            icon: '↻',
            action: () => {
              terminate();
              init();
              if (typeof EventBus !== 'undefined') {
                EventBus.emit('toast:info', { message: 'Worker restarted' });
              }
              return { success: true, message: 'Worker restarted' };
            }
          });
        } else {
          controls.push({
            id: 'init-worker',
            label: 'Initialize',
            icon: '▶',
            action: () => {
              const success = init();
              if (typeof EventBus !== 'undefined') {
                EventBus.emit('toast:' + (success ? 'success' : 'error'), {
                  message: success ? 'Worker initialized' : 'Worker initialization failed'
                });
              }
              return { success, message: success ? 'Worker initialized' : 'Worker initialization failed' };
            }
          });
        }

        return controls;
      }

      render() {
        const recentVerifications = verificationHistory.slice(-20).reverse();

        const verificationsListHtml = recentVerifications.length > 0
          ? recentVerifications.map(v => {
              const time = new Date(v.timestamp).toLocaleTimeString();
              const statusColor = v.success ? '#4caf50' : '#f44336';
              const statusIcon = v.success ? '✓' : '✗';

              return `
                <div class="verification-item ${v.success ? 'success' : 'failure'}">
                  <div class="verification-header">
                    <div class="verification-command">
                      ${v.command.length > 40 ? v.command.substring(0, 40) + '...' : v.command}
                    </div>
                    <div class="verification-status" style="color: ${statusColor};">${statusIcon}</div>
                  </div>
                  <div class="verification-meta">
                    ${time} · ${v.duration}ms
                  </div>
                  ${v.error ? `
                    <div class="verification-error">
                      Error: ${v.error.substring(0, 100)}${v.error.length > 100 ? '...' : ''}
                    </div>
                  ` : ''}
                  ${v.output && v.output.length > 0 ? `
                    <div class="verification-output">
                      ${v.output.substring(0, 150)}${v.output.length > 150 ? '...' : ''}
                    </div>
                  ` : ''}
                </div>
              `;
            }).join('')
          : '<div class="empty-state">No verifications run yet</div>';

        this.shadowRoot.innerHTML = `
          <style>
            :host {
              display: block;
              font-family: monospace;
              font-size: 12px;
            }

            .verification-manager-panel {
              color: #e0e0e0;
            }

            .verification-summary {
              display: grid;
              grid-template-columns: 1fr 1fr 1fr 1fr;
              gap: 10px;
              margin-bottom: 20px;
            }

            .stat-card {
              padding: 10px;
              border-radius: 5px;
            }

            .stat-card.total {
              background: rgba(0, 255, 255, 0.1);
            }

            .stat-card.passed {
              background: rgba(76, 175, 80, 0.1);
            }

            .stat-card.failed {
              background: rgba(244, 67, 54, 0.1);
            }

            .stat-card.active {
              background: rgba(255, 193, 7, 0.1);
            }

            .stat-label {
              color: #888;
              font-size: 12px;
            }

            .stat-value {
              font-size: 24px;
              font-weight: bold;
              margin-top: 4px;
            }

            .stat-value.cyan { color: #0ff; }
            .stat-value.green { color: #4caf50; }
            .stat-value.red { color: #f44336; }
            .stat-value.yellow { color: #ffc107; }

            .worker-status {
              background: rgba(255, 255, 255, 0.05);
              padding: 10px;
              border-radius: 5px;
              margin-bottom: 20px;
            }

            .worker-status-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
            }

            .worker-status-title {
              font-weight: bold;
              margin-bottom: 4px;
            }

            .worker-status-text {
              font-size: 12px;
              color: #888;
            }

            .worker-icon {
              font-size: 24px;
            }

            .pending-verifications {
              margin-top: 8px;
              font-size: 12px;
              color: #ffc107;
            }

            .verification-history h4 {
              color: #0ff;
              margin: 0 0 10px 0;
              font-size: 14px;
            }

            .verification-list {
              max-height: 300px;
              overflow-y: auto;
            }

            .verification-item {
              padding: 10px;
              margin-bottom: 8px;
              background: rgba(255, 255, 255, 0.03);
              border-radius: 3px;
            }

            .verification-item.success {
              border-left: 3px solid #4caf50;
            }

            .verification-item.failure {
              border-left: 3px solid #f44336;
            }

            .verification-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 4px;
            }

            .verification-command {
              font-weight: bold;
              font-family: monospace;
              font-size: 13px;
            }

            .verification-status {
              font-size: 18px;
            }

            .verification-meta {
              font-size: 12px;
              color: #888;
            }

            .verification-error {
              font-size: 11px;
              color: #f44336;
              margin-top: 4px;
              font-family: monospace;
              background: rgba(244, 67, 54, 0.1);
              padding: 4px;
              border-radius: 3px;
            }

            .verification-output {
              font-size: 11px;
              color: #888;
              margin-top: 4px;
              font-family: monospace;
              background: rgba(255, 255, 255, 0.02);
              padding: 4px;
              border-radius: 3px;
            }

            .empty-state {
              color: #888;
              padding: 20px;
              text-align: center;
            }
          </style>
          <div class="verification-manager-panel">
            <div class="verification-summary">
              <div class="stat-card total">
                <div class="stat-label">Total Runs</div>
                <div class="stat-value cyan">${verificationStats.totalRuns}</div>
              </div>
              <div class="stat-card passed">
                <div class="stat-label">Passed</div>
                <div class="stat-value green">${verificationStats.passed}</div>
              </div>
              <div class="stat-card failed">
                <div class="stat-label">Failed</div>
                <div class="stat-value red">${verificationStats.failed}</div>
              </div>
              <div class="stat-card active">
                <div class="stat-label">Active</div>
                <div class="stat-value yellow">${verificationStats.activeVerifications}</div>
              </div>
            </div>

            <div class="worker-status">
              <div class="worker-status-header">
                <div>
                  <div class="worker-status-title">Worker Status</div>
                  <div class="worker-status-text">
                    ${worker ? '✓ Initialized and ready' : '○ Not initialized'}
                  </div>
                </div>
                <div class="worker-icon">
                  ${worker ? '○' : '⚪'}
                </div>
              </div>
              ${pendingVerifications.size > 0 ? `
                <div class="pending-verifications">
                  ${pendingVerifications.size} pending verification(s)
                </div>
              ` : ''}
            </div>

            <div class="verification-history">
              <h4>Recent Verifications (${recentVerifications.length})</h4>
              <div class="verification-list">
                ${verificationsListHtml}
              </div>
            </div>
          </div>
        `;
      }
    }

    const elementName = 'verification-manager-widget';
    if (!customElements.get(elementName)) {
      customElements.define(elementName, VerificationManagerWidget);
    }

    const widget = {
      element: elementName,
      displayName: 'Verification Manager',
      icon: '✓',
      category: 'tools'
    };

    return {
        init,
        api: {
            runVerification: trackedRunVerification,
            verifyTests,
            verifyLinting,
            verifyTypes,
            verifySafeEval,
            runFullVerification,
            terminate,
            test,
            isInitialized: () => worker !== null
        },
        widget
    };
  }
};

// Register module if running in REPLOID environment
if (typeof window !== 'undefined' && window.ModuleRegistry) {
    window.ModuleRegistry.register(VerificationManager);
}

export default VerificationManager;