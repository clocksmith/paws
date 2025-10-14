// Verification Manager - Handles Web Worker creation and communication
// Integrates with tool-runner.js for sandboxed verification execution

const VerificationManager = {
  metadata: {
    id: 'VerificationManager',
    version: '1.0.0',
    dependencies: ['Utils', 'StateManager'],
    async: false,
    type: 'service'
  },

  factory: (deps) => {
    const { Utils, StateManager } = deps;
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
        const allMetadata = await StateManager.getAllArtifactMetadata();

        // Include only necessary files for verification
        for (const [path, meta] of Object.entries(allMetadata)) {
            // Include JS files, test files, and config files
            if (path.endsWith('.js') ||
                path.endsWith('.json') ||
                path.includes('test') ||
                path.includes('spec')) {

                const content = await StateManager.getArtifactContent(path);
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

    return {
        init,
        api: {
            runVerification,
            verifyTests,
            verifyLinting,
            verifyTypes,
            verifySafeEval,
            runFullVerification,
            terminate,
            test,
            isInitialized: () => worker !== null
        }
    };
  }
};

// Register module if running in REPLOID environment
if (typeof window !== 'undefined' && window.ModuleRegistry) {
    window.ModuleRegistry.register(VerificationManager);
}

export default VerificationManager;