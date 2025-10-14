// Standardized UI Manager Module for REPLOID - v2.0 (Dashboard Enabled)
// POLISH-1 Enhanced: Integrated AgentVisualizer and ASTVisualizer panels

const UI = {
  metadata: {
    id: 'UI',
    version: '4.0.0',
    description: 'Central UI management with browser-native visualizer integration, modal system, toast notifications, Python REPL, and Local LLM',
    dependencies: ['config', 'Utils', 'DiffGenerator', 'EventBus', 'VFSExplorer', 'PerformanceMonitor', 'MetricsDashboard', 'Introspector', 'ReflectionStore', 'SelfTester', 'BrowserAPIs', 'AgentVisualizer', 'ASTVisualizer', 'ModuleGraphVisualizer', 'ToastNotifications', 'TutorialSystem', 'PyodideRuntime', 'LocalLLM'],
    async: true,
    type: 'ui'
  },

  factory: (deps) => {
    const { config, Utils, DiffGenerator, EventBus, VFSExplorer, PerformanceMonitor, MetricsDashboard, Introspector, ReflectionStore, SelfTester, BrowserAPIs, AgentVisualizer, ASTVisualizer, ModuleGraphVisualizer, ToastNotifications, TutorialSystem, PyodideRuntime, LocalLLM } = deps;
    const { logger, showButtonSuccess, exportAsMarkdown } = Utils;

    let uiRefs = {};
    let isLogView = false;
    let isPerfView = false;
    let isIntroView = false;
    let isReflView = false;
    let isTestView = false;
    let isApiView = false;
    let isAvisView = false;
    let isAstvView = false;
    let isPyReplView = false;
    let isLlmView = false;
    let bootConfig = null;

    // Panel state persistence keys
    const STORAGE_KEY_PANEL = 'reploid_last_panel_view';

    // Save current panel state to localStorage
    const savePanelState = () => {
        const state = {
            isLogView,
            isPerfView,
            isIntroView,
            isReflView,
            isTestView,
            isApiView,
            isAvisView,
            isAstvView,
            isPyReplView,
            isLlmView
        };
        try {
            localStorage.setItem(STORAGE_KEY_PANEL, JSON.stringify(state));
        } catch (err) {
            logger.warn('[UIManager] Failed to save panel state:', err);
        }
    };

    // Restore panel state from localStorage
    const restorePanelState = async () => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY_PANEL);
            if (!saved) return false;

            const state = JSON.parse(saved);

            // Restore state flags
            isLogView = state.isLogView || false;
            isPerfView = state.isPerfView || false;
            isIntroView = state.isIntroView || false;
            isPyReplView = state.isPyReplView || false;
            isLlmView = state.isLlmView || false;
            isReflView = state.isReflView || false;
            isTestView = state.isTestView || false;
            isApiView = state.isApiView || false;
            isAvisView = state.isAvisView || false;
            isAstvView = state.isAstvView || false;

            // Show the last active panel
            if (isLogView && uiRefs.advancedLogPanel) {
                showOnlyPanel(uiRefs.advancedLogPanel);
                uiRefs.logToggleBtn.textContent = 'Show Agent Thoughts';
            } else if (isPerfView && uiRefs.performancePanel) {
                showOnlyPanel(uiRefs.performancePanel);
                renderPerformancePanel();
                uiRefs.logToggleBtn.textContent = 'Show Self-Analysis';
            } else if (isIntroView && uiRefs.introspectionPanel) {
                showOnlyPanel(uiRefs.introspectionPanel);
                await renderIntrospectionPanel();
                uiRefs.logToggleBtn.textContent = 'Show Learning History';
            } else if (isReflView && uiRefs.reflectionsPanel) {
                showOnlyPanel(uiRefs.reflectionsPanel);
                await renderReflectionsPanel();
                uiRefs.logToggleBtn.textContent = 'Show Self-Tests';
            } else if (isTestView && uiRefs.selfTestPanel) {
                showOnlyPanel(uiRefs.selfTestPanel);
                await renderSelfTestPanel();
                uiRefs.logToggleBtn.textContent = 'Show Browser APIs';
            } else if (isApiView && uiRefs.browserApisPanel) {
                showOnlyPanel(uiRefs.browserApisPanel);
                await renderBrowserAPIsPanel();
                uiRefs.logToggleBtn.textContent = 'Show Agent Visualization';
            } else if (isAvisView && uiRefs.agentVisualizerPanel) {
                showOnlyPanel(uiRefs.agentVisualizerPanel);
                renderAgentVisualizerPanel();
                uiRefs.logToggleBtn.textContent = 'Show AST Visualization';
            } else if (isAstvView && uiRefs.astVisualizerPanel) {
                showOnlyPanel(uiRefs.astVisualizerPanel);
                renderASTVisualizerPanel();
                uiRefs.logToggleBtn.textContent = 'Show Python REPL';
            } else if (isPyReplView && uiRefs.pythonReplPanel) {
                showOnlyPanel(uiRefs.pythonReplPanel);
                renderPythonReplPanel();
                uiRefs.logToggleBtn.textContent = 'Show Local LLM';
            } else if (isLlmView && uiRefs.localLlmPanel) {
                showOnlyPanel(uiRefs.localLlmPanel);
                await renderLocalLLMPanel();
                uiRefs.logToggleBtn.textContent = 'Show Advanced Logs';
            }

            logger.info('[UIManager] Restored panel state');
            return true;
        } catch (err) {
            logger.warn('[UIManager] Failed to restore panel state:', err);
            return false;
        }
    };

    // Metrics dashboard initialization flag
    let chartsDashboardInitialized = false;
    let agentVisualizerInitialized = false;
    let astVisualizerInitialized = false;

    const renderVfsExplorer = async () => {
        // Use new enhanced VFS Explorer if available
        if (VFSExplorer && uiRefs.vfsTree) {
            try {
                await VFSExplorer.init('vfs-tree');
                logger.info('[UI] Enhanced VFS Explorer initialized');
            } catch (err) {
                logger.error('[UI] Failed to initialize VFS Explorer:', err);
                // Fallback to basic tree
                await renderBasicVfsTree();
            }
        } else {
            await renderBasicVfsTree();
        }
    };

    const renderBasicVfsTree = async () => {
        if (!uiRefs.vfsTree) return;

        const allMeta = await StateManager.getAllArtifactMetadata();
        const fileTree = {};

        for (const path in allMeta) {
            let currentLevel = fileTree;
            const parts = path.split('/').filter(p => p);
            parts.forEach((part, index) => {
                if (index === parts.length - 1) {
                    currentLevel[part] = { _isLeaf: true, path };
                } else {
                    if (!currentLevel[part]) {
                        currentLevel[part] = {};
                    }
                    currentLevel = currentLevel[part];
                }
            });
        }

        const createTreeHtml = (tree) => {
            let html = '<ul>';
            for (const key in tree) {
                if (tree[key]._isLeaf) {
                    html += `<li><a href="#" data-path="${tree[key].path}">${key}</a></li>`;
                } else {
                    html += `<li>${key}${createTreeHtml(tree[key])}</li>`;
                }
            }
            html += '</ul>';
            return html;
        };

        uiRefs.vfsTree.innerHTML = createTreeHtml(fileTree);

        // Add click listeners
        uiRefs.vfsTree.querySelectorAll('a').forEach(a => {
            a.addEventListener('click', async (e) => {
                e.preventDefault();
                const path = e.target.dataset.path;
                const content = await StateManager.getArtifactContent(path);
                logToAdvanced(`Content of ${path}:\n${content}`, 'vfs-file');
            });
        });
    };

    const init = async () => {
        logger.info("Dashboard UI Manager (Event-Driven) taking control of DOM...");
        bootConfig = window.REPLOID_BOOT_CONFIG || {};

        const bootContainer = document.getElementById('boot-container');
        if (bootContainer) bootContainer.remove();
        
        document.body.style = "";

        const [bodyTemplate, styleContent, vfsExplorerStyle] = await Promise.all([
            fetch('ui-dashboard.html').then(res => res.text()),
            fetch('styles/dashboard.css').then(res => res.text()),
            fetch('styles/vfs-explorer.css').then(res => res.text()).catch(() => '')
        ]);

        const appRoot = document.getElementById('app-root');
        appRoot.innerHTML = bodyTemplate;
        appRoot.style.display = 'block';

        const styleEl = document.createElement('style');
        styleEl.textContent = styleContent;
        document.head.appendChild(styleEl);

        if (vfsExplorerStyle) {
            const vfsStyleEl = document.createElement('style');
            vfsStyleEl.textContent = vfsExplorerStyle;
            document.head.appendChild(vfsStyleEl);
        }

        initializeUIElementReferences();
        setupEventListeners();
        setupEventBusListeners(); // New setup for event listeners
        checkPersonaMode();
        if (ToastNotifications) ToastNotifications.init(); // Initialize toast system
        await renderVfsExplorer(); // Render the VFS tree
        await restorePanelState(); // Restore last viewed panel
        logger.info("Dashboard UI Initialized. Listening for events.");
    };

    const renderIntrospectionPanel = async () => {
        if (!Introspector || !uiRefs.introspectionPanel) return;

        try {
            const moduleGraph = await Introspector.getModuleGraph();
            const toolCatalog = await Introspector.getToolCatalog();
            const capabilities = Introspector.getCapabilities();

            // Module stats
            uiRefs.introModules.innerHTML = `
                <div class="intro-stat-item">
                    <span class="intro-stat-label">Total Modules:</span>
                    <span class="intro-stat-value">${moduleGraph.statistics.totalModules}</span>
                </div>
                <div class="intro-stat-item">
                    <span class="intro-stat-label">Dependencies:</span>
                    <span class="intro-stat-value">${moduleGraph.edges.length}</span>
                </div>
                <div class="intro-stat-item">
                    <span class="intro-stat-label">Avg Deps:</span>
                    <span class="intro-stat-value">${moduleGraph.statistics.avgDependencies.toFixed(2)}</span>
                </div>
                <div class="intro-stat-item">
                    <span class="intro-stat-label">Categories:</span>
                    <span class="intro-stat-value">${Object.keys(moduleGraph.statistics.byCategory).length}</span>
                </div>
            `;

            // Tool stats
            uiRefs.introTools.innerHTML = `
                <div class="intro-stat-item">
                    <span class="intro-stat-label">Total Tools:</span>
                    <span class="intro-stat-value">${toolCatalog.statistics.totalTools}</span>
                </div>
                <div class="intro-stat-item">
                    <span class="intro-stat-label">Read Tools:</span>
                    <span class="intro-stat-value">${toolCatalog.statistics.readCount}</span>
                </div>
                <div class="intro-stat-item">
                    <span class="intro-stat-label">Write Tools:</span>
                    <span class="intro-stat-value">${toolCatalog.statistics.writeCount}</span>
                </div>
                <div class="intro-stat-item">
                    <span class="intro-stat-label">RSI Capable:</span>
                    <span class="intro-stat-value available">✓ Yes</span>
                </div>
            `;

            // Capabilities stats
            const availableCount = Object.values(capabilities.features).filter(v => v).length;
            const totalCount = Object.keys(capabilities.features).length;

            uiRefs.introCapabilities.innerHTML = `
                <div class="intro-stat-item">
                    <span class="intro-stat-label">Features:</span>
                    <span class="intro-stat-value">${availableCount}/${totalCount}</span>
                </div>
                <div class="intro-stat-item">
                    <span class="intro-stat-label">WebWorker:</span>
                    <span class="intro-stat-value ${capabilities.features.webWorker ? 'available' : 'unavailable'}">${capabilities.features.webWorker ? '✓' : '✗'}</span>
                </div>
                <div class="intro-stat-item">
                    <span class="intro-stat-label">WebGPU:</span>
                    <span class="intro-stat-value ${capabilities.features.webGPU ? 'available' : 'unavailable'}">${capabilities.features.webGPU ? '✓' : '✗'}</span>
                </div>
                <div class="intro-stat-item">
                    <span class="intro-stat-label">WebAssembly:</span>
                    <span class="intro-stat-value ${capabilities.features.webAssembly ? 'available' : 'unavailable'}">${capabilities.features.webAssembly ? '✓' : '✗'}</span>
                </div>
            `;
        } catch (err) {
            logger.error('[UIManager] Failed to render introspection panel:', err);
            uiRefs.introModules.innerHTML = '<p style="grid-column: 1/-1; color: #f88;">Error loading introspection data</p>';
        }
    };

    const renderReflectionsPanel = async () => {
        if (!ReflectionStore || !uiRefs.reflectionsPanel) return;

        try {
            const allReflections = await ReflectionStore.getReflections();
            const successPatterns = await ReflectionStore.getSuccessPatterns();
            const failurePatterns = await ReflectionStore.getFailurePatterns();

            // Summary stats
            const successCount = allReflections.filter(r => r.outcome === 'success').length;
            const failureCount = allReflections.filter(r => r.outcome === 'failure').length;
            const partialCount = allReflections.filter(r => r.outcome === 'partial').length;
            const successRate = allReflections.length > 0 ? ((successCount / allReflections.length) * 100).toFixed(1) : 0;

            uiRefs.reflSummary.innerHTML = `
                <div class="refl-stat-item">
                    <span class="refl-stat-label">Total:</span>
                    <span class="refl-stat-value">${allReflections.length}</span>
                </div>
                <div class="refl-stat-item">
                    <span class="refl-stat-label">Success:</span>
                    <span class="refl-stat-value success">${successCount}</span>
                </div>
                <div class="refl-stat-item">
                    <span class="refl-stat-label">Failure:</span>
                    <span class="refl-stat-value failure">${failureCount}</span>
                </div>
                <div class="refl-stat-item">
                    <span class="refl-stat-label">Success Rate:</span>
                    <span class="refl-stat-value">${successRate}%</span>
                </div>
            `;

            // Patterns
            const topSuccess = successPatterns.topCategories.slice(0, 3)
                .map(c => `${c.category} (${c.count})`)
                .join(', ') || 'None';
            const topFailure = failurePatterns.topCategories.slice(0, 3)
                .map(c => `${c.category} (${c.count})`)
                .join(', ') || 'None';

            const insights = [
                ...successPatterns.insights.slice(0, 2),
                ...failurePatterns.insights.slice(0, 1)
            ];

            uiRefs.reflPatterns.innerHTML = `
                <div class="refl-pattern-item">
                    <strong>Success Patterns:</strong>
                    <div>${topSuccess}</div>
                </div>
                <div class="refl-pattern-item">
                    <strong>Failure Patterns:</strong>
                    <div>${topFailure}</div>
                </div>
                ${insights.length > 0 ? `
                    <div class="refl-pattern-item">
                        <strong>Key Insights:</strong>
                        <ul>
                            ${insights.map(i => `<li>${i}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
            `;

            // Recent reflections
            const recent = allReflections.slice(0, 5);
            if (recent.length === 0) {
                uiRefs.reflRecent.innerHTML = '<p style="color: #666;">No reflections recorded yet</p>';
            } else {
                uiRefs.reflRecent.innerHTML = recent.map(r => `
                    <div class="refl-item ${r.outcome}">
                        <div class="refl-item-header">
                            <span class="refl-outcome">${r.outcome.toUpperCase()}</span>
                            <span class="refl-time">${new Date(r.timestamp).toLocaleString()}</span>
                        </div>
                        <div class="refl-desc">${r.description || 'No description'}</div>
                        <div class="refl-meta">
                            <span>Category: ${r.category}</span>
                            ${r.metrics?.successRate !== undefined ? `<span>Success Rate: ${r.metrics.successRate}%</span>` : ''}
                        </div>
                    </div>
                `).join('');
            }

        } catch (err) {
            logger.error('[UIManager] Failed to render reflections panel:', err);
            uiRefs.reflSummary.innerHTML = '<p style="grid-column: 1/-1; color: #f88;">Error loading reflection data</p>';
        }
    };

    const renderSelfTestPanel = async () => {
        if (!SelfTester || !uiRefs.selfTestPanel) return;

        try {
            const lastResults = SelfTester.getLastResults();
            const history = SelfTester.getTestHistory();

            if (!lastResults) {
                uiRefs.testSummary.innerHTML = '<p style="color: #666;">No tests run yet. Click "Run Tests" to begin validation.</p>';
                uiRefs.testSuites.innerHTML = '';
                uiRefs.testHistory.innerHTML = '';
                return;
            }

            // Render summary
            const successRate = lastResults.summary.successRate;
            const successClass = successRate >= 90 ? 'passed' : successRate >= 70 ? 'warning' : 'failed';

            uiRefs.testSummary.innerHTML = `
                <div class="test-stat-item">
                    <span class="test-stat-label">Total Tests:</span>
                    <span class="test-stat-value">${lastResults.summary.totalTests}</span>
                </div>
                <div class="test-stat-item">
                    <span class="test-stat-label">Passed:</span>
                    <span class="test-stat-value passed">${lastResults.summary.passed}</span>
                </div>
                <div class="test-stat-item">
                    <span class="test-stat-label">Failed:</span>
                    <span class="test-stat-value failed">${lastResults.summary.failed}</span>
                </div>
                <div class="test-stat-item">
                    <span class="test-stat-label">Success Rate:</span>
                    <span class="test-stat-value ${successClass}">${successRate.toFixed(1)}%</span>
                </div>
                <div class="test-stat-item">
                    <span class="test-stat-label">Duration:</span>
                    <span class="test-stat-value">${lastResults.duration}ms</span>
                </div>
            `;

            // Render suites
            uiRefs.testSuites.innerHTML = lastResults.suites.map(suite => {
                const suiteTotal = suite.passed + suite.failed;
                const suiteClass = suite.failed === 0 ? 'passed' : suite.passed === 0 ? 'failed' : 'partial';

                const detailsHtml = suite.tests.slice(0, 5).map(test => {
                    const detailClass = test.passed ? 'passed' : 'failed';
                    const icon = test.passed ? '✓' : '✗';
                    return `<div class="test-detail ${detailClass}">${icon} ${test.name}${test.error ? ` - ${test.error}` : ''}</div>`;
                }).join('');

                return `
                    <div class="test-suite-item ${suiteClass}">
                        <div class="test-suite-header">
                            <span class="test-suite-name">${suite.name}</span>
                            <span class="test-suite-summary">${suite.passed}/${suiteTotal} passed</span>
                        </div>
                        ${detailsHtml}
                        ${suite.tests.length > 5 ? `<div class="test-detail">... and ${suite.tests.length - 5} more tests</div>` : ''}
                    </div>
                `;
            }).join('');

            // Render history
            if (history.length > 0) {
                uiRefs.testHistory.innerHTML = history.slice().reverse().slice(0, 5).map(item => `
                    <div class="test-history-item">
                        <div class="test-history-time">${new Date(item.timestamp).toLocaleString()}</div>
                        <div class="test-history-summary">${item.summary.passed}/${item.summary.totalTests} passed (${item.summary.successRate.toFixed(1)}%) - ${item.duration}ms</div>
                    </div>
                `).join('');
            } else {
                uiRefs.testHistory.innerHTML = '<p style="color: #666;">No test history available</p>';
            }

        } catch (err) {
            logger.error('[UIManager] Failed to render self-test panel:', err);
            uiRefs.testSummary.innerHTML = '<p style="grid-column: 1/-1; color: #f88;">Error loading test data</p>';
        }
    };

    const renderBrowserAPIsPanel = async () => {
        if (!BrowserAPIs || !uiRefs.browserApisPanel) return;

        try {
            const capabilities = BrowserAPIs.getCapabilities();

            // Render capabilities
            uiRefs.apiCapabilities.innerHTML = Object.entries(capabilities)
                .map(([api, available]) => {
                    const apiName = api.replace(/([A-Z])/g, ' $1').trim();
                    return `
                        <div class="api-stat-item">
                            <span class="api-stat-label">${apiName}:</span>
                            <span class="api-stat-value ${available ? 'available' : 'unavailable'}">
                                ${available ? '✓ Available' : '✗ Not Available'}
                            </span>
                        </div>
                    `;
                }).join('');

            // Update filesystem status
            const dirHandle = BrowserAPIs.getDirectoryHandle();
            if (dirHandle) {
                uiRefs.filesystemStatus.textContent = `Connected: ${dirHandle.name}`;
                uiRefs.filesystemStatus.classList.add('connected');
                uiRefs.filesystemSyncBtn.classList.remove('hidden');
            }

            // Update notification status
            if (capabilities.notifications) {
                const permission = Notification.permission;
                uiRefs.notificationsStatus.textContent = `Permission: ${permission}`;
                if (permission === 'granted') {
                    uiRefs.notificationsStatus.classList.add('granted');
                    uiRefs.notificationsTestBtn.classList.remove('hidden');
                } else if (permission === 'denied') {
                    uiRefs.notificationsStatus.classList.add('denied');
                }
            }

            // Update storage estimate
            if (capabilities.storageEstimation) {
                const estimate = await BrowserAPIs.getStorageEstimate();
                if (estimate) {
                    const usageClass = estimate.usagePercent > 80 ? 'error' : estimate.usagePercent > 60 ? 'warning' : 'available';
                    uiRefs.storageEstimate.innerHTML = `
                        <div class="api-stat-item">
                            <span class="api-stat-label">Used:</span>
                            <span class="api-stat-value">${estimate.usageMB} MB</span>
                        </div>
                        <div class="api-stat-item">
                            <span class="api-stat-label">Quota:</span>
                            <span class="api-stat-value">${estimate.quotaMB} MB</span>
                        </div>
                        <div class="api-stat-item">
                            <span class="api-stat-label">Usage:</span>
                            <span class="api-stat-value ${usageClass}">${estimate.usagePercent.toFixed(1)}%</span>
                        </div>
                        <div class="api-stat-item">
                            <span class="api-stat-label">Available:</span>
                            <span class="api-stat-value">${estimate.availableMB} MB</span>
                        </div>
                    `;
                }
            }

        } catch (err) {
            logger.error('[UIManager] Failed to render browser APIs panel:', err);
        }
    };

    const renderAgentVisualizerPanel = () => {
        if (!AgentVisualizer || !uiRefs.agentVisualizerContainer) return;

        // Initialize visualizer on first render
        if (!agentVisualizerInitialized && typeof d3 !== 'undefined') {
            try {
                AgentVisualizer.init(uiRefs.agentVisualizerContainer);
                agentVisualizerInitialized = true;
                logger.info('[UIManager] Agent visualizer initialized');
            } catch (err) {
                logger.warn('[UIManager] Failed to initialize agent visualizer:', err);
            }
        }
    };

    const renderASTVisualizerPanel = () => {
        if (!ASTVisualizer || !uiRefs.astVizContainer) return;

        // Initialize visualizer on first render
        if (!astVisualizerInitialized && typeof d3 !== 'undefined' && typeof acorn !== 'undefined') {
            try {
                ASTVisualizer.init(uiRefs.astVizContainer);
                astVisualizerInitialized = true;
                logger.info('[UIManager] AST visualizer initialized');
            } catch (err) {
                logger.warn('[UIManager] Failed to initialize AST visualizer:', err);
            }
        }
    };

    // Render Python REPL panel
    const renderPythonReplPanel = () => {
        if (!PyodideRuntime || !uiRefs.pythonReplPanel) return;

        // Update Pyodide status
        const updatePyodideStatus = () => {
            const isReady = PyodideRuntime.isReady();
            const error = PyodideRuntime.getError();

            if (error) {
                uiRefs.pyodideStatusIcon.textContent = '🔴';
                uiRefs.pyodideStatusText.textContent = `Error: ${error.message}`;
            } else if (isReady) {
                uiRefs.pyodideStatusIcon.textContent = '🟢';
                uiRefs.pyodideStatusText.textContent = 'Ready';
            } else {
                uiRefs.pyodideStatusIcon.textContent = '🟡';
                uiRefs.pyodideStatusText.textContent = 'Initializing...';
            }
        };

        // Set up event listeners for Python REPL buttons
        const setupReplButtons = () => {
            // Execute button
            const executeBtn = document.getElementById('python-execute-btn');
            const executeAsyncBtn = document.getElementById('python-execute-async-btn');
            const clearBtn = document.getElementById('repl-clear-btn');
            const packagesBtn = document.getElementById('repl-packages-btn');
            const syncBtn = document.getElementById('repl-sync-btn');
            const syncWorkspaceCheck = document.getElementById('python-sync-workspace-check');

            if (executeBtn) {
                executeBtn.onclick = async () => {
                    const code = uiRefs.pythonCodeInput.value;
                    const syncWorkspace = syncWorkspaceCheck?.checked || false;

                    if (!code.trim()) return;

                    executeBtn.disabled = true;
                    executeBtn.textContent = '⏳ Running...';

                    try {
                        if (syncWorkspace) {
                            await PyodideRuntime.syncWorkspace();
                        }

                        const result = await PyodideRuntime.execute(code, { async: false });
                        appendReplOutput(result);
                    } catch (error) {
                        appendReplOutput({ success: false, error: error.message });
                    } finally {
                        executeBtn.disabled = false;
                        executeBtn.textContent = '▶️ Run';
                    }
                };
            }

            if (executeAsyncBtn) {
                executeAsyncBtn.onclick = async () => {
                    const code = uiRefs.pythonCodeInput.value;
                    const syncWorkspace = syncWorkspaceCheck?.checked || false;

                    if (!code.trim()) return;

                    executeAsyncBtn.disabled = true;
                    executeAsyncBtn.textContent = '⏳ Running...';

                    try {
                        if (syncWorkspace) {
                            await PyodideRuntime.syncWorkspace();
                        }

                        const result = await PyodideRuntime.execute(code, { async: true });
                        appendReplOutput(result);
                    } catch (error) {
                        appendReplOutput({ success: false, error: error.message });
                    } finally {
                        executeAsyncBtn.disabled = false;
                        executeAsyncBtn.textContent = '▶️ Run Async';
                    }
                };
            }

            if (clearBtn) {
                clearBtn.onclick = () => {
                    uiRefs.pythonOutput.innerHTML = '';
                };
            }

            if (packagesBtn) {
                packagesBtn.onclick = async () => {
                    await showPackageModal();
                };
            }

            if (syncBtn) {
                syncBtn.onclick = async () => {
                    syncBtn.disabled = true;
                    syncBtn.textContent = '⏳ Syncing...';

                    try {
                        const result = await PyodideRuntime.syncWorkspace();
                        if (ToastNotifications) {
                            ToastNotifications.show(`Synced ${result.synced} files`, 'success');
                        }
                    } catch (error) {
                        if (ToastNotifications) {
                            ToastNotifications.show(`Sync failed: ${error.message}`, 'error');
                        }
                    } finally {
                        syncBtn.disabled = false;
                        syncBtn.textContent = '🔄 Sync VFS';
                    }
                };
            }
        };

        // Append output to REPL
        const appendReplOutput = (result) => {
            const output = document.createElement('div');
            output.className = `repl-result ${result.success ? 'repl-result-success' : 'repl-result-error'}`;

            const header = document.createElement('div');
            header.className = 'repl-result-header';
            header.textContent = `--- ${new Date().toLocaleTimeString()} ---`;
            output.appendChild(header);

            if (result.stdout) {
                const stdout = document.createElement('div');
                stdout.className = 'repl-stdout';
                stdout.textContent = result.stdout;
                output.appendChild(stdout);
            }

            if (result.stderr) {
                const stderr = document.createElement('div');
                stderr.className = 'repl-stderr';
                stderr.textContent = result.stderr;
                output.appendChild(stderr);
            }

            if (result.success && result.result !== undefined && result.result !== null) {
                const returnValue = document.createElement('div');
                returnValue.className = 'repl-return-value';
                returnValue.textContent = `=> ${JSON.stringify(result.result)}`;
                output.appendChild(returnValue);
            }

            if (!result.success && result.error) {
                const error = document.createElement('div');
                error.className = 'repl-error';
                error.textContent = `Error: ${result.error}`;
                output.appendChild(error);

                if (result.traceback) {
                    const traceback = document.createElement('div');
                    traceback.className = 'repl-error';
                    traceback.textContent = result.traceback;
                    output.appendChild(traceback);
                }
            }

            if (result.executionTime !== undefined) {
                const execTime = document.createElement('div');
                execTime.className = 'repl-execution-time';
                execTime.textContent = `Execution time: ${result.executionTime}ms`;
                output.appendChild(execTime);
            }

            uiRefs.pythonOutput.appendChild(output);
            uiRefs.pythonOutput.scrollTop = uiRefs.pythonOutput.scrollHeight;
        };

        // Show package management modal
        const showPackageModal = async () => {
            const modal = document.createElement('div');
            modal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.8);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
            `;

            const content = document.createElement('div');
            content.className = 'repl-package-modal';
            content.innerHTML = `
                <h3>Python Packages</h3>
                <div class="repl-package-input">
                    <input type="text" id="package-name-input" placeholder="Package name (e.g., matplotlib)" />
                    <button id="install-package-btn">Install</button>
                </div>
                <div class="repl-package-list" id="package-list">
                    <div style="color: #aaa; font-style: italic;">Loading packages...</div>
                </div>
                <button class="repl-modal-close" id="close-package-modal">Close</button>
            `;

            modal.appendChild(content);
            document.body.appendChild(modal);

            // Load installed packages
            try {
                const result = await PyodideRuntime.getPackages();
                const packageList = document.getElementById('package-list');
                if (result.success && result.packages) {
                    packageList.innerHTML = result.packages.map(pkg =>
                        `<div class="repl-package-item">${pkg}</div>`
                    ).join('') || '<div style="color: #aaa;">No packages installed</div>';
                } else {
                    packageList.innerHTML = '<div style="color: #f00;">Failed to load packages</div>';
                }
            } catch (error) {
                logger.warn('[PythonREPL] Failed to load packages:', error);
            }

            // Install button
            document.getElementById('install-package-btn').onclick = async () => {
                const input = document.getElementById('package-name-input');
                const packageName = input.value.trim();
                if (!packageName) return;

                const installBtn = document.getElementById('install-package-btn');
                installBtn.disabled = true;
                installBtn.textContent = 'Installing...';

                try {
                    const result = await PyodideRuntime.installPackage(packageName);
                    if (result.success) {
                        if (ToastNotifications) {
                            ToastNotifications.show(`Installed ${packageName}`, 'success');
                        }
                        // Refresh package list
                        const refreshResult = await PyodideRuntime.getPackages();
                        const packageList = document.getElementById('package-list');
                        if (refreshResult.success && refreshResult.packages) {
                            packageList.innerHTML = refreshResult.packages.map(pkg =>
                                `<div class="repl-package-item">${pkg}</div>`
                            ).join('');
                        }
                        input.value = '';
                    } else {
                        if (ToastNotifications) {
                            ToastNotifications.show(`Failed to install ${packageName}`, 'error');
                        }
                    }
                } catch (error) {
                    if (ToastNotifications) {
                        ToastNotifications.show(`Error: ${error.message}`, 'error');
                    }
                } finally {
                    installBtn.disabled = false;
                    installBtn.textContent = 'Install';
                }
            };

            // Close button
            document.getElementById('close-package-modal').onclick = () => {
                document.body.removeChild(modal);
            };

            // Click outside to close
            modal.onclick = (e) => {
                if (e.target === modal) {
                    document.body.removeChild(modal);
                }
            };
        };

        // Initial status update
        updatePyodideStatus();

        // Set up buttons
        setupReplButtons();

        // Listen for Pyodide status changes
        EventBus.on('pyodide:ready', updatePyodideStatus);
        EventBus.on('pyodide:error', updatePyodideStatus);
        EventBus.on('pyodide:initialized', updatePyodideStatus);

        logger.info('[UIManager] Python REPL panel rendered');
    };

    // Render Local LLM panel
    const renderLocalLLMPanel = async () => {
        if (!LocalLLM || !uiRefs.localLlmPanel) return;

        // Update LLM status
        const updateLLMStatus = () => {
            const status = LocalLLM.getStatus();

            if (status.error) {
                uiRefs.llmStatusIcon.textContent = '🔴';
                uiRefs.llmStatusText.textContent = `Error: ${status.error}`;
            } else if (status.ready) {
                uiRefs.llmStatusIcon.textContent = '🟢';
                uiRefs.llmStatusText.textContent = 'Ready';
                uiRefs.llmCurrentModel.textContent = status.model || 'Unknown';

                // Enable test button
                const testBtn = document.getElementById('llm-test-btn');
                if (testBtn) testBtn.disabled = false;

                // Show unload button, hide load button
                const loadBtn = document.getElementById('llm-load-btn');
                const unloadBtn = document.getElementById('llm-unload-btn');
                if (loadBtn) loadBtn.classList.add('hidden');
                if (unloadBtn) unloadBtn.classList.remove('hidden');
            } else if (status.loading) {
                uiRefs.llmStatusIcon.textContent = '🟡';
                uiRefs.llmStatusText.textContent = 'Loading model...';
            } else {
                uiRefs.llmStatusIcon.textContent = '⚪';
                uiRefs.llmStatusText.textContent = 'Not loaded';
            }
        };

        // Check WebGPU status
        const checkWebGPU = async () => {
            const gpuCheck = await LocalLLM.checkWebGPU();
            const statusDiv = document.getElementById('llm-webgpu-status');

            if (gpuCheck.available) {
                statusDiv.innerHTML = `✅ WebGPU available (${gpuCheck.info?.vendor || 'Unknown'})`;
                statusDiv.style.color = '#0f0';
            } else {
                statusDiv.innerHTML = `❌ WebGPU not available: ${gpuCheck.error}`;
                statusDiv.style.color = '#f00';

                // Disable load button
                const loadBtn = document.getElementById('llm-load-btn');
                if (loadBtn) {
                    loadBtn.disabled = true;
                    loadBtn.title = 'WebGPU not available';
                }
            }
        };

        // Set up event listeners
        const setupLLMButtons = () => {
            const loadBtn = document.getElementById('llm-load-btn');
            const unloadBtn = document.getElementById('llm-unload-btn');
            const testBtn = document.getElementById('llm-test-btn');
            const modelSelect = document.getElementById('llm-model-select');

            if (loadBtn) {
                loadBtn.onclick = async () => {
                    const modelId = modelSelect?.value;
                    if (!modelId) {
                        if (ToastNotifications) {
                            ToastNotifications.show('Please select a model', 'warning');
                        }
                        return;
                    }

                    loadBtn.disabled = true;
                    loadBtn.textContent = '⏳ Loading...';

                    // Show loading section
                    const loadingSection = document.getElementById('llm-loading-section');
                    if (loadingSection) loadingSection.classList.remove('hidden');

                    try {
                        await LocalLLM.init(modelId);

                        if (ToastNotifications) {
                            ToastNotifications.show('Model loaded successfully', 'success');
                        }
                    } catch (error) {
                        logger.error('[LocalLLM UI] Load failed:', error);

                        if (ToastNotifications) {
                            ToastNotifications.show(`Failed to load model: ${error.message}`, 'error');
                        }
                    } finally {
                        loadBtn.disabled = false;
                        loadBtn.textContent = '⚡ Load Model';

                        // Hide loading section
                        const loadingSection = document.getElementById('llm-loading-section');
                        if (loadingSection) loadingSection.classList.add('hidden');
                    }
                };
            }

            if (unloadBtn) {
                unloadBtn.onclick = async () => {
                    unloadBtn.disabled = true;

                    try {
                        await LocalLLM.unload();

                        // Reset UI
                        updateLLMStatus();
                        const testBtn = document.getElementById('llm-test-btn');
                        if (testBtn) testBtn.disabled = true;

                        unloadBtn.classList.add('hidden');
                        const loadBtn = document.getElementById('llm-load-btn');
                        if (loadBtn) loadBtn.classList.remove('hidden');

                        if (ToastNotifications) {
                            ToastNotifications.show('Model unloaded', 'success');
                        }
                    } catch (error) {
                        logger.error('[LocalLLM UI] Unload failed:', error);
                    } finally {
                        unloadBtn.disabled = false;
                    }
                };
            }

            if (testBtn) {
                testBtn.onclick = async () => {
                    const prompt = document.getElementById('llm-test-prompt')?.value;
                    const streamCheck = document.getElementById('llm-stream-check');
                    const stream = streamCheck?.checked !== false;

                    if (!prompt?.trim()) return;

                    testBtn.disabled = true;
                    testBtn.textContent = '⏳ Generating...';

                    const outputDiv = document.getElementById('llm-test-output');
                    if (outputDiv) outputDiv.innerHTML = '';

                    try {
                        const startTime = Date.now();

                        if (stream) {
                            // Streaming mode
                            const generator = await LocalLLM.complete(prompt, { stream: true });

                            for await (const chunk of generator) {
                                if (outputDiv) {
                                    if (chunk.done) {
                                        outputDiv.innerHTML += `\n\n<div class="llm-output-stats">Tokens: ${chunk.tokenCount} | Time: ${chunk.elapsed}ms | Speed: ${chunk.tokensPerSecond.toFixed(1)} tok/s</div>`;
                                    } else {
                                        outputDiv.innerHTML = `<span class="llm-output-streaming">${chunk.text}</span>`;
                                    }
                                    outputDiv.scrollTop = outputDiv.scrollHeight;
                                }
                            }
                        } else {
                            // Non-streaming mode
                            const result = await LocalLLM.complete(prompt, { stream: false });
                            const elapsed = Date.now() - startTime;

                            if (outputDiv) {
                                outputDiv.innerHTML = `<span class="llm-output-complete">${result.text}</span>`;
                                outputDiv.innerHTML += `\n\n<div class="llm-output-stats">Time: ${elapsed}ms | Speed: ${result.tokensPerSecond.toFixed(1)} tok/s</div>`;
                            }
                        }
                    } catch (error) {
                        logger.error('[LocalLLM UI] Generation failed:', error);

                        if (outputDiv) {
                            outputDiv.innerHTML = `<span style="color: #f00;">Error: ${error.message}</span>`;
                        }

                        if (ToastNotifications) {
                            ToastNotifications.show(`Generation failed: ${error.message}`, 'error');
                        }
                    } finally {
                        testBtn.disabled = false;
                        testBtn.textContent = '▶️ Test';
                    }
                };
            }
        };

        // Initial setup
        updateLLMStatus();
        await checkWebGPU();
        setupLLMButtons();

        // Listen for LocalLLM events
        EventBus.on('local-llm:ready', updateLLMStatus);
        EventBus.on('local-llm:error', updateLLMStatus);
        EventBus.on('local-llm:unloaded', updateLLMStatus);

        EventBus.on('local-llm:progress', (data) => {
            const progressFill = document.getElementById('llm-progress-fill');
            const progressText = document.getElementById('llm-progress-text');

            if (progressFill) {
                progressFill.style.width = `${(data.progress * 100).toFixed(1)}%`;
            }

            if (progressText) {
                progressText.textContent = data.text || `${(data.progress * 100).toFixed(1)}%`;
            }
        });

        logger.info('[UIManager] Local LLM panel rendered');
    };

    // Show module graph modal
    const showModuleGraphModal = async () => {
        // Create modal overlay
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            backdrop-filter: blur(4px);
        `;

        // Create modal content
        const content = document.createElement('div');
        content.className = 'modal-content';
        content.style.cssText = `
            background: #1e1e1e;
            border: 1px solid rgba(0, 255, 255, 0.3);
            border-radius: 8px;
            width: 90%;
            max-width: 1200px;
            height: 80%;
            max-height: 800px;
            display: flex;
            flex-direction: column;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
        `;

        // Header
        const header = document.createElement('div');
        header.style.cssText = `
            padding: 16px;
            border-bottom: 1px solid rgba(0, 255, 255, 0.2);
            display: flex;
            justify-content: space-between;
            align-items: center;
        `;
        header.innerHTML = `
            <h3 style="margin: 0; color: #00ffff;">Module Dependency Graph</h3>
            <button id="modal-close-btn" style="background: transparent; border: 1px solid rgba(255, 255, 255, 0.3); color: white; padding: 4px 12px; border-radius: 4px; cursor: pointer; font-size: 16px;">✕</button>
        `;

        // Graph container
        const graphContainer = document.createElement('div');
        graphContainer.id = 'module-graph-container';
        graphContainer.style.cssText = `
            flex: 1;
            overflow: hidden;
            position: relative;
        `;

        // Footer with stats
        const footer = document.createElement('div');
        footer.id = 'module-graph-footer';
        footer.style.cssText = `
            padding: 12px 16px;
            border-top: 1px solid rgba(0, 255, 255, 0.2);
            display: flex;
            gap: 16px;
            font-size: 12px;
            color: #888;
        `;

        // Assemble modal
        content.appendChild(header);
        content.appendChild(graphContainer);
        content.appendChild(footer);
        modal.appendChild(content);
        document.body.appendChild(modal);

        // Close modal handler
        const closeModal = () => {
            document.body.removeChild(modal);
        };
        document.getElementById('modal-close-btn').addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });

        // Initialize visualizer
        if (ModuleGraphVisualizer) {
            try {
                ModuleGraphVisualizer.init(graphContainer);
                await ModuleGraphVisualizer.visualize();

                // Show stats
                const stats = ModuleGraphVisualizer.getStats();
                if (stats) {
                    footer.innerHTML = `
                        <span><strong>Modules:</strong> ${stats.totalModules}</span>
                        <span><strong>Dependencies:</strong> ${stats.totalDependencies}</span>
                        <span><strong>Categories:</strong> ${stats.categories}</span>
                        <span><strong>Avg Dependencies:</strong> ${stats.avgDependencies.toFixed(2)}</span>
                        <button id="graph-reset-btn" style="margin-left: auto; padding: 4px 12px; background: rgba(0, 255, 255, 0.1); border: 1px solid rgba(0, 255, 255, 0.3); color: #00ffff; border-radius: 4px; cursor: pointer;">🔄 Reset View</button>
                    `;

                    document.getElementById('graph-reset-btn')?.addEventListener('click', () => {
                        ModuleGraphVisualizer.reset();
                    });
                }

                logger.info('[UIManager] Module graph modal opened');
            } catch (err) {
                logger.error('[UIManager] Failed to show module graph:', err);
                graphContainer.innerHTML = '<div style="color: #f48771; padding: 20px; text-align: center;">Failed to load module graph. Check console for details.</div>';
            }
        }
    };

    const initializeUIElementReferences = () => {
        const ids = [
            "goal-text", "thought-stream", "diff-viewer", "log-toggle-btn",
            "advanced-log-panel", "log-output", "thought-panel",
            "visual-preview-panel", "preview-iframe", "dashboard", "status-bar",
            "performance-panel", "perf-session", "perf-llm", "perf-memory", "perf-tools",
            "introspection-panel", "intro-modules", "intro-tools", "intro-capabilities",
            "reflections-panel", "refl-summary", "refl-patterns", "refl-recent",
            "self-test-panel", "test-summary", "test-suites", "test-history",
            "browser-apis-panel", "api-capabilities", "filesystem-status", "notifications-status",
            "storage-estimate", "filesystem-sync-btn", "notifications-test-btn",
            "agent-visualizer-panel", "agent-visualizer-container",
            "ast-visualizer-panel", "ast-viz-container", "ast-code-input",
            "python-repl-panel", "python-code-input", "python-output", "pyodide-status-icon", "pyodide-status-text",
            "local-llm-panel", "llm-status-icon", "llm-status-text", "llm-current-model"
        ];
        ids.forEach(id => {
            uiRefs[Utils.kabobToCamel(id)] = document.getElementById(id);
        });

        // Performance panel buttons
        const perfRefreshBtn = document.getElementById('perf-refresh-btn');
        const perfExportBtn = document.getElementById('perf-export-btn');
        const perfResetBtn = document.getElementById('perf-reset-btn');

        if (perfRefreshBtn) {
            perfRefreshBtn.addEventListener('click', () => {
                renderPerformancePanel();
                // Visual feedback
                perfRefreshBtn.textContent = '✓ Refreshed';
                setTimeout(() => {
                    perfRefreshBtn.textContent = '🔄 Refresh';
                }, 1000);
            });
        }

        if (perfExportBtn && PerformanceMonitor) {
            perfExportBtn.addEventListener('click', async () => {
                try {
                    const report = PerformanceMonitor.generateReport();
                    exportAsMarkdown(`performance-report-${Date.now()}.md`, report);
                    logger.info('[UIManager] Exported performance report');
                    showButtonSuccess(perfExportBtn, '💾 Export Report', '✓ Exported!');
                } catch (err) {
                    logger.error('[UIManager] Failed to export performance report:', err);
                    if (ToastNotifications) ToastNotifications.error('Failed to export performance report');
                }
            });
        }

        if (perfResetBtn && PerformanceMonitor) {
            perfResetBtn.addEventListener('click', () => {
                if (confirm('Are you sure you want to reset all performance metrics?')) {
                    PerformanceMonitor.reset();
                    renderPerformancePanel();
                    logger.info('[UIManager] Performance metrics reset');
                }
            });
        }

        // Introspection panel buttons
        const introRefreshBtn = document.getElementById('intro-refresh-btn');
        const introExportBtn = document.getElementById('intro-export-btn');
        const introGraphBtn = document.getElementById('intro-graph-btn');

        if (introRefreshBtn) {
            introRefreshBtn.addEventListener('click', async () => {
                if (Introspector) {
                    Introspector.clearCache();
                }
                await renderIntrospectionPanel();
                // Visual feedback
                introRefreshBtn.textContent = '✓ Refreshed';
                setTimeout(() => {
                    introRefreshBtn.textContent = '🔄 Refresh';
                }, 1000);
            });
        }

        if (introExportBtn && Introspector) {
            introExportBtn.addEventListener('click', async () => {
                try {
                    const report = await Introspector.generateSelfReport();
                    exportAsMarkdown(`self-analysis-report-${Date.now()}.md`, report);
                    logger.info('[UIManager] Exported self-analysis report');
                    showButtonSuccess(introExportBtn, '💾 Export Report', '✓ Exported!');
                } catch (err) {
                    logger.error('[UIManager] Failed to export self-analysis report:', err);
                    if (ToastNotifications) ToastNotifications.error('Failed to export self-analysis report');
                }
            });
        }

        if (introGraphBtn && ModuleGraphVisualizer) {
            introGraphBtn.addEventListener('click', async () => {
                // Open modal with D3.js module graph visualization
                showModuleGraphModal();
                showButtonSuccess(introGraphBtn, '🕸️ Module Graph', '✓ Opened!');
            });
        }

        // Reflections panel buttons
        const reflRefreshBtn = document.getElementById('refl-refresh-btn');
        const reflExportBtn = document.getElementById('refl-export-btn');
        const reflClearBtn = document.getElementById('refl-clear-btn');

        if (reflRefreshBtn) {
            reflRefreshBtn.addEventListener('click', async () => {
                await renderReflectionsPanel();
                // Visual feedback
                reflRefreshBtn.textContent = '✓ Refreshed';
                setTimeout(() => {
                    reflRefreshBtn.textContent = '🔄 Refresh';
                }, 1000);
            });
        }

        if (reflExportBtn && ReflectionStore) {
            reflExportBtn.addEventListener('click', async () => {
                try {
                    const report = await ReflectionStore.generateReport();
                    exportAsMarkdown(`reflections-report-${Date.now()}.md`, report);
                    logger.info('[UIManager] Exported reflections report');
                    showButtonSuccess(reflExportBtn, '💾 Export Report', '✓ Exported!');
                } catch (err) {
                    logger.error('[UIManager] Failed to export reflections report:', err);
                    if (ToastNotifications) ToastNotifications.error('Failed to export reflections report');
                }
            });
        }

        if (reflClearBtn && ReflectionStore) {
            reflClearBtn.addEventListener('click', async () => {
                if (confirm('Clear reflections older than 30 days?')) {
                    try {
                        const cutoff = Date.now() - (30 * 24 * 60 * 60 * 1000);
                        const allRefl = await ReflectionStore.getReflections();
                        const oldRefl = allRefl.filter(r => r.timestamp < cutoff);

                        for (const refl of oldRefl) {
                            await ReflectionStore.deleteReflection(refl.id);
                        }

                        await renderReflectionsPanel();
                        logger.info(`[UIManager] Cleared ${oldRefl.length} old reflections`);

                        reflClearBtn.textContent = `✓ Cleared ${oldRefl.length}`;
                        setTimeout(() => {
                            reflClearBtn.textContent = '🗑️ Clear Old';
                        }, 2000);
                    } catch (err) {
                        logger.error('[UIManager] Failed to clear old reflections:', err);
                        if (ToastNotifications) ToastNotifications.error('Failed to clear old reflections');
                    }
                }
            });
        }

        // Self-test panel buttons
        const testRunBtn = document.getElementById('test-run-btn');
        const testExportBtn = document.getElementById('test-export-btn');
        const testRefreshBtn = document.getElementById('test-refresh-btn');

        if (testRunBtn && SelfTester) {
            testRunBtn.addEventListener('click', async () => {
                const originalText = '▶️ Run Tests';
                try {
                    testRunBtn.textContent = '⏳ Running...';
                    testRunBtn.classList.add('running');
                    testRunBtn.disabled = true;

                    await SelfTester.runAllTests();
                    await renderSelfTestPanel();

                    testRunBtn.classList.remove('running');
                    showButtonSuccess(testRunBtn, originalText, '✓ Complete');
                } catch (err) {
                    logger.error('[UIManager] Failed to run tests:', err);
                    testRunBtn.classList.remove('running');
                    showButtonSuccess(testRunBtn, originalText, '✗ Failed');
                }
            });
        }

        if (testExportBtn && SelfTester) {
            testExportBtn.addEventListener('click', async () => {
                try {
                    const report = SelfTester.generateReport();
                    exportAsMarkdown(`self-test-report-${Date.now()}.md`, report);
                    logger.info('[UIManager] Exported self-test report');
                    showButtonSuccess(testExportBtn, '💾 Export Report', '✓ Exported!');
                } catch (err) {
                    logger.error('[UIManager] Failed to export test report:', err);
                    if (ToastNotifications) ToastNotifications.error('Failed to export test report');
                }
            });
        }

        if (testRefreshBtn) {
            testRefreshBtn.addEventListener('click', async () => {
                await renderSelfTestPanel();
                testRefreshBtn.textContent = '✓ Refreshed';
                setTimeout(() => {
                    testRefreshBtn.textContent = '🔄 Refresh';
                }, 1000);
            });
        }

        // Browser APIs panel buttons
        const filesystemRequestBtn = document.getElementById('filesystem-request-btn');
        const filesystemSyncBtn = document.getElementById('filesystem-sync-btn');
        const notificationsRequestBtn = document.getElementById('notifications-request-btn');
        const notificationsTestBtn = document.getElementById('notifications-test-btn');
        const storageRefreshBtn = document.getElementById('storage-refresh-btn');
        const storagePersistBtn = document.getElementById('storage-persist-btn');
        const apiExportBtn = document.getElementById('api-export-btn');

        if (filesystemRequestBtn && BrowserAPIs) {
            filesystemRequestBtn.addEventListener('click', async () => {
                const handle = await BrowserAPIs.requestDirectoryAccess('readwrite');
                if (handle) {
                    await renderBrowserAPIsPanel();
                }
            });
        }

        if (filesystemSyncBtn && BrowserAPIs) {
            filesystemSyncBtn.addEventListener('click', async () => {
                const originalText = '💾 Sync VFS';
                try {
                    filesystemSyncBtn.textContent = '⏳ Syncing...';
                    filesystemSyncBtn.disabled = true;

                    const allMeta = await StateManager.getAllArtifactMetadata();
                    const paths = Object.keys(allMeta);
                    let synced = 0;

                    for (const path of paths) {
                        const success = await BrowserAPIs.syncArtifactToFilesystem(path);
                        if (success) synced++;
                    }

                    showButtonSuccess(filesystemSyncBtn, originalText, `✓ Synced ${synced}/${paths.length}`);
                } catch (err) {
                    logger.error('[UIManager] Failed to sync VFS:', err);
                    showButtonSuccess(filesystemSyncBtn, originalText, '✗ Failed');
                }
            });
        }

        if (notificationsRequestBtn && BrowserAPIs) {
            notificationsRequestBtn.addEventListener('click', async () => {
                await BrowserAPIs.requestNotificationPermission();
                await renderBrowserAPIsPanel();
            });
        }

        if (notificationsTestBtn && BrowserAPIs) {
            notificationsTestBtn.addEventListener('click', async () => {
                await BrowserAPIs.showNotification('REPLOID Test', {
                    body: 'Browser notifications are working!',
                    tag: 'test'
                });
            });
        }

        if (storageRefreshBtn && BrowserAPIs) {
            storageRefreshBtn.addEventListener('click', async () => {
                await renderBrowserAPIsPanel();
                storageRefreshBtn.textContent = '✓ Refreshed';
                setTimeout(() => {
                    storageRefreshBtn.textContent = '🔄 Refresh';
                }, 1000);
            });
        }

        if (storagePersistBtn && BrowserAPIs) {
            storagePersistBtn.addEventListener('click', async () => {
                const isPersisted = await BrowserAPIs.requestPersistentStorage();
                storagePersistBtn.textContent = isPersisted ? '✓ Persistent' : '✗ Not Persistent';
                setTimeout(() => {
                    storagePersistBtn.textContent = '🔒 Request Persistent';
                }, 2000);
            });
        }

        if (apiExportBtn && BrowserAPIs) {
            apiExportBtn.addEventListener('click', async () => {
                try {
                    const report = BrowserAPIs.generateReport();
                    exportAsMarkdown(`browser-apis-report-${Date.now()}.md`, report);
                    logger.info('[UIManager] Exported browser APIs report');
                    showButtonSuccess(apiExportBtn, '💾 Export Report', '✓ Exported!');
                } catch (err) {
                    logger.error('[UIManager] Failed to export browser APIs report:', err);
                    if (ToastNotifications) ToastNotifications.error('Failed to export browser APIs report');
                }
            });
        }

        // Agent Visualizer panel buttons
        const avisResetBtn = document.getElementById('avis-reset-btn');
        const avisCenterBtn = document.getElementById('avis-center-btn');

        if (avisResetBtn && AgentVisualizer) {
            avisResetBtn.addEventListener('click', () => {
                if (agentVisualizerInitialized) {
                    AgentVisualizer.resetVisualization();
                    showButtonSuccess(avisResetBtn, '🔄 Reset', '✓ Reset!');
                }
            });
        }

        if (avisCenterBtn && AgentVisualizer) {
            avisCenterBtn.addEventListener('click', () => {
                if (agentVisualizerInitialized) {
                    AgentVisualizer.centerView();
                    showButtonSuccess(avisCenterBtn, '🎯 Center', '✓ Centered!');
                }
            });
        }

        // AST Visualizer panel buttons
        const astVisualizeBtn = document.getElementById('ast-visualize-btn');
        const astExpandBtn = document.getElementById('ast-expand-btn');
        const astCollapseBtn = document.getElementById('ast-collapse-btn');
        const astResetBtn = document.getElementById('ast-reset-btn');
        const astCodeInput = document.getElementById('ast-code-input');

        if (astVisualizeBtn && ASTVisualizer && astCodeInput) {
            astVisualizeBtn.addEventListener('click', () => {
                const code = astCodeInput.value;
                if (code && code.trim()) {
                    ASTVisualizer.visualizeCode(code);
                    showButtonSuccess(astVisualizeBtn, '🔍 Visualize', '✓ Visualized!');
                }
            });
        }

        if (astExpandBtn && ASTVisualizer) {
            astExpandBtn.addEventListener('click', () => {
                ASTVisualizer.expandAll();
                showButtonSuccess(astExpandBtn, '➕ Expand All', '✓ Expanded!');
            });
        }

        if (astCollapseBtn && ASTVisualizer) {
            astCollapseBtn.addEventListener('click', () => {
                ASTVisualizer.collapseAll();
                showButtonSuccess(astCollapseBtn, '➖ Collapse All', '✓ Collapsed!');
            });
        }

        if (astResetBtn && astCodeInput) {
            astResetBtn.addEventListener('click', () => {
                astCodeInput.value = `// Example: Function declaration
function greet(name) {
  return \`Hello, \${name}!\`;
}`;
                showButtonSuccess(astResetBtn, '🔄 Reset', '✓ Reset!');
            });
        }
    };

    const renderPerformancePanel = () => {
        if (!PerformanceMonitor || !uiRefs.performancePanel) return;

        const metrics = PerformanceMonitor.getMetrics();
        const llmStats = PerformanceMonitor.getLLMStats();
        const memStats = PerformanceMonitor.getMemoryStats();

        // Initialize charts dashboard on first render
        if (!chartsDashboardInitialized && MetricsDashboard && typeof Chart !== 'undefined') {
            try {
                MetricsDashboard.init(uiRefs.performancePanel);
                chartsDashboardInitialized = true;
                logger.info('[UIManager] Metrics dashboard charts initialized');
            } catch (err) {
                logger.warn('[UIManager] Failed to initialize charts dashboard:', err);
            }
        }

        // Update charts if initialized
        if (chartsDashboardInitialized && MetricsDashboard) {
            try {
                MetricsDashboard.updateCharts();
            } catch (err) {
                logger.warn('[UIManager] Failed to update charts:', err);
            }
        }

        // Session stats
        const uptime = metrics.session.uptime;
        const uptimeMin = Math.floor(uptime / 60000);
        const uptimeSec = Math.floor((uptime % 60000) / 1000);

        uiRefs.perfSession.innerHTML = `
            <div class="perf-stat-item">
                <span class="perf-stat-label">Uptime:</span>
                <span class="perf-stat-value">${uptimeMin}m ${uptimeSec}s</span>
            </div>
            <div class="perf-stat-item">
                <span class="perf-stat-label">Cycles:</span>
                <span class="perf-stat-value">${metrics.session.cycles}</span>
            </div>
            <div class="perf-stat-item">
                <span class="perf-stat-label">Created:</span>
                <span class="perf-stat-value">${metrics.session.artifacts.created}</span>
            </div>
            <div class="perf-stat-item">
                <span class="perf-stat-label">Modified:</span>
                <span class="perf-stat-value">${metrics.session.artifacts.modified}</span>
            </div>
        `;

        // LLM stats
        const errorClass = llmStats.errorRate > 0.1 ? 'error' : llmStats.errorRate > 0.05 ? 'warning' : 'good';
        uiRefs.perfLlm.innerHTML = `
            <div class="perf-stat-item">
                <span class="perf-stat-label">Calls:</span>
                <span class="perf-stat-value">${llmStats.calls}</span>
            </div>
            <div class="perf-stat-item">
                <span class="perf-stat-label">Tokens:</span>
                <span class="perf-stat-value">${llmStats.tokens.total.toLocaleString()}</span>
            </div>
            <div class="perf-stat-item">
                <span class="perf-stat-label">Avg Latency:</span>
                <span class="perf-stat-value">${llmStats.avgLatency.toFixed(0)}ms</span>
            </div>
            <div class="perf-stat-item">
                <span class="perf-stat-label">Error Rate:</span>
                <span class="perf-stat-value ${errorClass}">${(llmStats.errorRate * 100).toFixed(1)}%</span>
            </div>
        `;

        // Memory stats
        if (memStats) {
            const usagePct = (memStats.current.usedJSHeapSize / memStats.current.jsHeapSizeLimit) * 100;
            const usageClass = usagePct > 80 ? 'error' : usagePct > 60 ? 'warning' : 'good';
            uiRefs.perfMemory.innerHTML = `
                <div class="perf-stat-item">
                    <span class="perf-stat-label">Current:</span>
                    <span class="perf-stat-value">${(memStats.current.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB</span>
                </div>
                <div class="perf-stat-item">
                    <span class="perf-stat-label">Peak:</span>
                    <span class="perf-stat-value">${(memStats.max / 1024 / 1024).toFixed(2)} MB</span>
                </div>
                <div class="perf-stat-item">
                    <span class="perf-stat-label">Usage:</span>
                    <span class="perf-stat-value ${usageClass}">${usagePct.toFixed(1)}%</span>
                </div>
                <div class="perf-stat-item">
                    <span class="perf-stat-label">Limit:</span>
                    <span class="perf-stat-value">${(memStats.current.jsHeapSizeLimit / 1024 / 1024).toFixed(0)} MB</span>
                </div>
            `;
        } else {
            uiRefs.perfMemory.innerHTML = '<p>Memory metrics not available</p>';
        }

        // Top tools
        const toolEntries = Object.entries(metrics.tools)
            .map(([name, data]) => ({
                name,
                calls: data.calls,
                avgTime: data.calls > 0 ? data.totalTime / data.calls : 0
            }))
            .sort((a, b) => b.calls - a.calls)
            .slice(0, 4);

        if (toolEntries.length > 0) {
            uiRefs.perfTools.innerHTML = toolEntries.map(tool => `
                <div class="perf-stat-item">
                    <span class="perf-stat-label">${tool.name}:</span>
                    <span class="perf-stat-value">${tool.calls} (${tool.avgTime.toFixed(1)}ms)</span>
                </div>
            `).join('');
        } else {
            uiRefs.perfTools.innerHTML = '<p style="grid-column: 1/-1; color: #666;">No tool data yet</p>';
        }
    };

    // Helper to show only one panel, hiding all others (DRY pattern)
    const showOnlyPanel = (panelToShow) => {
        const allPanels = [
            uiRefs.thoughtPanel,
            uiRefs.performancePanel,
            uiRefs.introspectionPanel,
            uiRefs.reflectionsPanel,
            uiRefs.selfTestPanel,
            uiRefs.browserApisPanel,
            uiRefs.agentVisualizerPanel,
            uiRefs.astVisualizerPanel,
            uiRefs.pythonReplPanel,
            uiRefs.localLlmPanel,
            uiRefs.advancedLogPanel
        ];

        allPanels.forEach(panel => {
            if (panel) {
                if (panel === panelToShow) {
                    panel.classList.remove('hidden');
                } else {
                    panel.classList.add('hidden');
                }
            }
        });
    };

    const setupEventListeners = () => {
        uiRefs.logToggleBtn?.addEventListener('click', async () => {
            // Cycle: Thoughts → Performance → Introspection → Reflections → Tests → APIs → Agent Viz → AST Viz → Python REPL → Local LLM → Logs → Thoughts
            if (isLlmView) {
                // Switch from Local LLM to logs
                isLlmView = false;
                isLogView = true;
                showOnlyPanel(uiRefs.advancedLogPanel);
                uiRefs.logToggleBtn.textContent = 'Show Agent Thoughts';
            } else if (isPyReplView) {
                // Switch from Python REPL to Local LLM
                isPyReplView = false;
                isLlmView = true;
                showOnlyPanel(uiRefs.localLlmPanel);
                await renderLocalLLMPanel();
                uiRefs.logToggleBtn.textContent = 'Show Advanced Logs';
            } else if (isAstvView) {
                // Switch from AST Viz to Python REPL
                isAstvView = false;
                isPyReplView = true;
                showOnlyPanel(uiRefs.pythonReplPanel);
                renderPythonReplPanel();
                uiRefs.logToggleBtn.textContent = 'Show Local LLM';
            } else if (isAvisView) {
                // Switch from Agent Viz to AST Viz
                isAvisView = false;
                isAstvView = true;
                showOnlyPanel(uiRefs.astVisualizerPanel);
                renderASTVisualizerPanel();
                uiRefs.logToggleBtn.textContent = 'Show Python REPL';
            } else if (isApiView) {
                // Switch from APIs to Agent Viz
                isApiView = false;
                isAvisView = true;
                showOnlyPanel(uiRefs.agentVisualizerPanel);
                renderAgentVisualizerPanel();
                uiRefs.logToggleBtn.textContent = 'Show AST Visualization';
            } else if (isTestView) {
                // Switch from tests to APIs
                isTestView = false;
                isApiView = true;
                showOnlyPanel(uiRefs.browserApisPanel);
                await renderBrowserAPIsPanel();
                uiRefs.logToggleBtn.textContent = 'Show Agent Visualization';
            } else if (isReflView) {
                // Switch from reflections to tests
                isReflView = false;
                isTestView = true;
                showOnlyPanel(uiRefs.selfTestPanel);
                await renderSelfTestPanel();
                uiRefs.logToggleBtn.textContent = 'Show Browser APIs';
            } else if (isIntroView) {
                // Switch from introspection to reflections
                isIntroView = false;
                isReflView = true;
                showOnlyPanel(uiRefs.reflectionsPanel);
                await renderReflectionsPanel();
                uiRefs.logToggleBtn.textContent = 'Show Self-Tests';
            } else if (isPerfView) {
                // Switch from perf to introspection
                isPerfView = false;
                isIntroView = true;
                showOnlyPanel(uiRefs.introspectionPanel);
                await renderIntrospectionPanel();
                uiRefs.logToggleBtn.textContent = 'Show Learning History';
            } else if (isLogView) {
                // Switch from logs to thoughts
                isLogView = false;
                showOnlyPanel(uiRefs.thoughtPanel);
                uiRefs.logToggleBtn.textContent = 'Show Performance';
            } else {
                // Switch from thoughts to perf
                isPerfView = true;
                showOnlyPanel(uiRefs.performancePanel);
                renderPerformancePanel();
                uiRefs.logToggleBtn.textContent = 'Show Self-Analysis';
            }
            uiRefs.logToggleBtn.setAttribute('aria-pressed', (isLogView || isPerfView || isIntroView || isReflView || isTestView || isApiView || isAvisView || isAstvView || isPyReplView || isLlmView).toString());
            savePanelState(); // Persist panel state
        });

        // Export session report button
        const exportBtn = document.getElementById('export-session-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', async () => {
                await exportSessionReport();
            });
        }

        // Tutorial button
        const tutorialBtn = document.getElementById('tutorial-btn');
        if (tutorialBtn && TutorialSystem) {
            tutorialBtn.addEventListener('click', () => {
                TutorialSystem.showMenu();
            });
        }

        // Theme toggle button
        const themeBtn = document.getElementById('theme-toggle-btn');
        if (themeBtn) {
            // Initialize theme from localStorage
            const savedTheme = localStorage.getItem('reploid-theme') || 'dark';
            applyTheme(savedTheme);

            themeBtn.addEventListener('click', () => {
                const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
                const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
                applyTheme(newTheme);
                localStorage.setItem('reploid-theme', newTheme);
                logger.info('[UIManager] Theme changed', { theme: newTheme });
            });
        }

        if (bootConfig?.persona?.id === 'rfc_author') {
            addRFCButton();
        }
    };

    /**
     * Apply theme to document root.
     * @param {string} theme - 'light' or 'dark'
     */
    const applyTheme = (theme) => {
        const root = document.documentElement;
        const themeBtn = document.getElementById('theme-toggle-btn');

        if (theme === 'light') {
            root.setAttribute('data-theme', 'light');
            if (themeBtn) themeBtn.textContent = '☀️';
        } else {
            root.removeAttribute('data-theme');
            if (themeBtn) themeBtn.textContent = '🌙';
        }
    };

    const exportSessionReport = async () => {
        try {
            const report = await generateSessionReport();
            exportAsMarkdown(`session-report-${Date.now()}.md`, report);
            logger.info('[UIManager] Exported session report');

            const btn = document.getElementById('export-session-btn');
            if (btn) {
                showButtonSuccess(btn, btn.innerHTML, '✓ Exported!');
            }
        } catch (err) {
            logger.error('[UIManager] Failed to export session report:', err);
            if (ToastNotifications) ToastNotifications.error('Failed to export session report');
        }
    };

    const generateSessionReport = async () => {
        const state = StateManager.getState();
        const date = new Date().toISOString();

        let md = `# REPLOID Session Report\n\n`;
        md += `**Generated:** ${date}\n`;
        md += `**Session ID:** ${state.session_id || 'N/A'}\n`;
        md += `**Agent State:** ${state.agent_state || 'Unknown'}\n`;
        md += `**Cycle:** ${state.cycle || 0}\n\n`;

        // Goal
        md += `## Goal\n\n`;
        md += `${state.goal || 'No goal set'}\n\n`;

        // Turns
        if (state.turns && state.turns.length > 0) {
            md += `## Session History (${state.turns.length} turns)\n\n`;

            for (const [index, turn] of state.turns.entries()) {
                md += `### Turn ${index + 1}\n\n`;
                md += `- **Status:** ${turn.status || 'unknown'}\n`;
                md += `- **Context:** ${turn.cats_path || 'N/A'}\n`;
                md += `- **Proposal:** ${turn.dogs_path || 'N/A'}\n`;

                if (turn.verification) {
                    md += `- **Verification:** ${turn.verification}\n`;
                }

                md += `\n`;
            }
        } else {
            md += `## Session History\n\nNo turns yet.\n\n`;
        }

        // Artifacts
        const artifacts = Object.keys(state.artifactMetadata || {});
        if (artifacts.length > 0) {
            md += `## Artifacts (${artifacts.length} files)\n\n`;
            artifacts.forEach(path => {
                md += `- ${path}\n`;
            });
            md += `\n`;
        }

        // Statistics
        md += `## Statistics\n\n`;
        md += `- **Total Turns:** ${state.turns?.length || 0}\n`;
        md += `- **Artifacts:** ${artifacts.length}\n`;
        md += `- **Checkpoints:** ${state.checkpoints?.length || 0}\n\n`;

        md += `---\n\n*Generated by REPLOID Sentinel Agent*\n`;

        return md;
    };

    const setupEventBusListeners = () => {
        EventBus.on('agent:state:change', handleStateChange);
        // ... other listeners
    };

    const handleStateChange = async ({ newState, context }) => {
        const sentinelContent = uiRefs.sentinelContent;
        const approveBtn = uiRefs.sentinelApproveBtn;
        const reviseBtn = uiRefs.sentinelReviseBtn;

        // Hide all actions by default
        approveBtn.classList.add('hidden');
        reviseBtn.classList.add('hidden');
        sentinelContent.innerHTML = '';

        switch (newState) {
            case 'AWAITING_CONTEXT_APPROVAL':
                sentinelContent.innerHTML = `<h4>Review Context (cats.md)</h4><p>Agent wants to read the following files:</p>`;
                const catsContent = await StateManager.getArtifactContent(context.turn.cats_path);
                sentinelContent.innerHTML += `<pre>${catsContent}</pre>`;
                approveBtn.classList.remove('hidden');
                approveBtn.onclick = () => EventBus.emit('user:approve:context');
                break;

            case 'AWAITING_PROPOSAL_APPROVAL':
                sentinelContent.innerHTML = `<h4>Review Proposal (dogs.md)</h4><p>Agent proposes the following changes:</p>`;

                // Use the interactive diff viewer if available
                const diffViewerPanel = document.getElementById('diff-viewer-panel');
                if (diffViewerPanel) {
                    diffViewerPanel.classList.remove('hidden');
                    // Trigger the diff viewer to show the dogs bundle
                    EventBus.emit('diff:show', {
                        dogs_path: context.turn.dogs_path,
                        session_id: context.sessionId,
                        turn: context.turn
                    });
                } else {
                    // Fallback to simple display
                    const dogsContent = await StateManager.getArtifactContent(context.turn.dogs_path);
                    sentinelContent.innerHTML += `<pre>${dogsContent}</pre>`;
                    approveBtn.classList.remove('hidden');
                    approveBtn.onclick = () => EventBus.emit('user:approve:proposal');
                }
                break;

            case 'IDLE':
                sentinelContent.innerHTML = '<p>Agent is idle. Set a goal to begin.</p>';
                break;

            default:
                sentinelContent.innerHTML = `<p>Agent is in state: <strong>${newState}</strong></p>`;
                break;
        }
    };

    
    const checkPersonaMode = () => {
        if (bootConfig?.persona?.type === 'factory') {
            uiRefs.dashboard?.classList.add('factory-mode');
            uiRefs.visualPreviewPanel?.classList.remove('hidden');
            logger.info("Factory mode enabled with live preview.");
        }
    };
    
    const addRFCButton = () => {
        const rfcButton = document.createElement('button');
        rfcButton.id = 'generate-rfc-btn';
        rfcButton.textContent = 'Generate RFC';
        rfcButton.style.cssText = 'padding: 10px; margin: 10px; background: #333; color: #0ff; border: 1px solid #0ff; cursor: pointer;';
        
        rfcButton.addEventListener('click', () => {
            const title = prompt('Enter a title for the RFC:');
            if (title) {
                const rfcGoal = `Draft an RFC titled '${title}'. First, use the create_rfc tool. Then, analyze the project and fill out the document.`;
                EventBus.emit('goal:set', rfcGoal);
                logToAdvanced(`RFC generation initiated: ${title}`);
            }
        });
        
        const goalPanel = document.getElementById('goal-panel');
        if (goalPanel) {
            goalPanel.appendChild(rfcButton);
        }
    };

    const updateGoal = (text) => {
        if (uiRefs.goalText) uiRefs.goalText.textContent = text;
        logToAdvanced(`Goal Updated: ${text}`, 'goal_modified');
    };

    const streamThought = (textChunk) => {
        if (isLogView) return;
        if (uiRefs.thoughtStream) {
            uiRefs.thoughtStream.textContent += textChunk;
        }
    };
    
    const clearThoughts = () => {
        if(uiRefs.thoughtStream) uiRefs.thoughtStream.textContent = '';
    };

    const renderFileDiff = (path, oldContent, newContent) => {
        if (isLogView) return;
        if (!uiRefs.diffViewer || !DiffGenerator) return;
        
        const diff = DiffGenerator.createDiff(oldContent, newContent);
        const diffHtml = diff.map(part => {
            const line = Utils.escapeHtml(part.line);
            if (part.type === 'add') return `<span class="diff-add">+ ${line}</span>`;
            if (part.type === 'remove') return `<span class="diff-remove">- ${line}</span>`;
            return `  ${line}`;
        }).join('\n');

        uiRefs.diffViewer.innerHTML += `<h4>Changes for ${path}</h4><pre>${diffHtml}</pre>`;
    };
    
    const clearFileDiffs = () => {
        if(uiRefs.diffViewer) uiRefs.diffViewer.innerHTML = '';
    };

    const logToAdvanced = (data, type = 'info') => {
        if (uiRefs.logOutput) {
            let message = data;
            let details = {};
            let level = type;

            if (typeof data === 'object') {
                message = data.message;
                details = data.details || {};
                level = data.level || type;
            }

            const line = document.createElement('div');
            line.textContent = `[${new Date().toLocaleTimeString()}] [${level.toUpperCase()}] ${message}`;
            
            switch(level.toLowerCase()) {
                case 'info': line.style.color = '#fff'; break;
                case 'warn': line.style.color = '#ff0'; break;
                case 'error': line.style.color = '#f00'; break;
                case 'cycle': line.style.color = '#0ff'; break;
                default: line.style.color = '#aaa'; break;
            }

            // Optional: Add details view
            if (Object.keys(details).length > 0) {
                const detailsPre = document.createElement('pre');
                detailsPre.style.cssText = 'margin-left: 20px; font-size: 0.8em; color: #ccc;';
                detailsPre.textContent = JSON.stringify(details, null, 2);
                line.appendChild(detailsPre);
            }

            uiRefs.logOutput.appendChild(line);
            uiRefs.logOutput.scrollTop = uiRefs.logOutput.scrollHeight;
        }
    };

    return {
      init,
      api: {}
    };
  }
};

// Export standardized module
UI;