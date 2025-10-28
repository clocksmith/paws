// @blueprint 0x00000D - Details the architecture for managing the agent's developer console UI.
// Standardized UI Manager Module for REPLOID - v2.0 (Dashboard Enabled)
// POLISH-1 Enhanced: Integrated AgentVisualizer and ASTVisualizer panels

const UI = {
  metadata: {
    id: 'UI',
    version: '5.0.0',
    description: 'Central UI management with browser-native visualizer integration, modal system, toast notifications, Python REPL, Local LLM, and modular panel support',
    dependencies: ['config', 'Utils', 'StateManager', 'DiffGenerator', 'EventBus', 'VFSExplorer', 'PerformanceMonitor?', 'MetricsDashboard?', 'Introspector', 'ReflectionStore?', 'SelfTester', 'BrowserAPIs', 'AgentVisualizer?', 'ASTVisualizer?', 'ModuleGraphVisualizer?', 'ToastNotifications?', 'TutorialSystem?', 'PyodideRuntime?', 'LocalLLM?', 'ProgressTracker?', 'LogPanel?', 'StatusBar?', 'ThoughtPanel?', 'GoalPanel?', 'SentinelPanel?'],
    async: true,
    type: 'ui'
  },

  factory: (deps) => {
    const { config, Utils, StateManager, DiffGenerator, EventBus, VFSExplorer, PerformanceMonitor, MetricsDashboard, Introspector, ReflectionStore, SelfTester, BrowserAPIs, AgentVisualizer, ASTVisualizer, ModuleGraphVisualizer, ToastNotifications, TutorialSystem, PyodideRuntime, LocalLLM, ProgressTracker, LogPanel, StatusBar, ThoughtPanel, GoalPanel, SentinelPanel } = deps;
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
    let progressSocket = null;
    let progressReconnectTimer = null;
    let progressAttempts = 0;

    // Panel state persistence keys
    const STORAGE_KEY_PANEL = 'reploid_last_panel_view';

    // ========================================================================
    // INLINED UI ASSETS (no external HTTP fetch required)
    // ========================================================================

    const DASHBOARD_HTML = `<div id="dashboard" role="main" aria-label="REPLOID Dashboard">
    <div id="status-bar" class="status-bar" role="status" aria-live="polite" aria-atomic="true">
        <div class="status-indicator">
            <span id="status-icon" class="status-icon" aria-hidden="true">⚪</span>
            <span id="status-state" class="status-state" aria-label="Agent state">IDLE</span>
        </div>
        <div id="status-detail" class="status-detail" aria-label="Status details">Waiting for goal</div>
        <div id="status-progress" class="status-progress" style="display:none;" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" aria-label="Task progress">
            <div class="progress-bar">
                <div id="progress-fill" class="progress-fill" style="width:0%"></div>
            </div>
        </div>
        <button id="export-session-btn" class="btn-export-session" title="Export session report" aria-label="Export session report">
            ☐ Export
        </button>
        <button id="tutorial-btn" class="btn-tutorial" title="Start tutorial" aria-label="Start interactive tutorial">
            ☎ Tutorial
        </button>
        <button id="theme-toggle-btn" class="btn-theme-toggle" title="Toggle theme" aria-label="Toggle light/dark theme">
            ☾
        </button>
    </div>
    <div id="goal-panel" class="panel" role="region" aria-labelledby="dashboard-goal-title">
        <h2 id="dashboard-goal-title">◈ Current Goal</h2>
        <p id="goal-text" aria-live="polite" class="goal-text-empty">No goal set. Awaken agent from boot screen with a goal.</p>
    </div>
    <div id="agent-progress-tracker" class="panel agent-progress-tracker" role="region" aria-label="Agent Progress">
        <h3>◐ Agent Progress</h3>
        <div id="progress-steps" class="progress-steps"></div>
    </div>
    <div id="sentinel-panel" class="panel" role="region" aria-label="Sentinel Control">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <h4 style="margin: 0;">⛨ Sentinel Control</h4>
            <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 11px; color: #888;">Auto-Approve</span>
                <label class="toggle-switch" title="Auto-approve context curation (never approves code changes)">
                    <input type="checkbox" id="session-auto-approve-toggle" />
                    <span class="toggle-slider"></span>
                </label>
            </div>
        </div>
        <div id="sentinel-content" aria-live="polite" aria-relevant="additions text" class="sentinel-empty">
            <p class="empty-state-message">Waiting for agent to request approval...</p>
            <p class="empty-state-help">When the agent wants to read files or modify code, approval buttons will appear here.</p>
        </div>
        <div id="sentinel-actions" role="group" aria-label="Sentinel actions">
            <button id="sentinel-approve-btn" class="btn-primary hidden" aria-label="Approve changes">✓ Approve</button>
            <button id="sentinel-revise-btn" class="btn-secondary hidden" aria-label="Revise proposal">⟲ Revise</button>
        </div>
    </div>
    <div class="panel-container">
        <div id="vfs-explorer-panel" class="panel" role="region" aria-labelledby="vfs-explorer-title">
            <h4 id="vfs-explorer-title">⛁ VFS Explorer</h4>
            <div id="vfs-tree" role="tree" aria-label="Virtual file system explorer">
                <div class="empty-state-message">No files yet.</div>
                <div class="empty-state-help">Files will appear here when the agent creates or modifies them.</div>
            </div>
        </div>
        <div id="thought-panel" class="panel" role="region" aria-labelledby="thought-panel-title">
            <h4 id="thought-panel-title">◐ Agent Thoughts</h4>
            <div id="thought-stream" aria-live="polite" aria-relevant="additions" aria-atomic="false">
                <div class="empty-state-message">Agent hasn't started yet.</div>
                <div class="empty-state-help">Enter a goal and awaken the agent to see its reasoning stream here.</div>
            </div>
        </div>
        <div id="diff-viewer-panel" class="panel" role="region" aria-labelledby="diff-viewer-title">
            <h4 id="diff-viewer-title">◫ Visual Diffs</h4>
            <div id="diff-viewer" aria-live="polite" aria-relevant="additions text">
                <div class="empty-state-message">No changes proposed yet.</div>
                <div class="empty-state-help">Side-by-side diffs appear here when the agent proposes code modifications.</div>
            </div>
        </div>
    </div>
    <div id="visual-preview-panel" class="panel hidden" role="region" aria-labelledby="preview-panel-title">
        <h2 id="preview-panel-title">Live Preview</h2>
        <iframe id="preview-iframe" sandbox="allow-scripts" csp="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline';" title="Live preview of generated content"></iframe>
    </div>

    <!-- Collapsible Section: Debugging & Monitoring -->
    <div class="panel-section">
        <button class="section-toggle" data-section="debugging" aria-expanded="false">
            <span class="section-icon">▶</span>
            <span class="section-title">⚙ Debugging & Monitoring</span>
            <span class="section-count">3 tools</span>
        </button>
        <div class="section-content" id="debugging-section" style="display: none;">
            <div class="section-buttons">
                <button class="panel-switch-btn" data-panel="logs">Advanced Logs</button>
                <button class="panel-switch-btn" data-panel="performance">Performance Metrics</button>
                <button class="panel-switch-btn" data-panel="introspection">Self-Analysis</button>
            </div>
        </div>
    </div>

    <!-- Collapsible Section: Development Tools -->
    <div class="panel-section">
        <button class="section-toggle" data-section="dev-tools" aria-expanded="false">
            <span class="section-icon">▶</span>
            <span class="section-title">⚗ Development Tools</span>
            <span class="section-count">3 tools</span>
        </button>
        <div class="section-content" id="dev-tools-section" style="display: none;">
            <div class="section-buttons">
                <button class="panel-switch-btn" data-panel="python">Python REPL</button>
                <button class="panel-switch-btn" data-panel="llm">Local LLM (WebGPU)</button>
                <button class="panel-switch-btn" data-panel="ast">AST Visualizer</button>
            </div>
        </div>
    </div>

    <!-- Collapsible Section: Advanced Features -->
    <div class="panel-section">
        <button class="section-toggle" data-section="advanced" aria-expanded="false">
            <span class="section-icon">▶</span>
            <span class="section-title">◆ Advanced Features</span>
            <span class="section-count">5 tools</span>
        </button>
        <div class="section-content" id="advanced-section" style="display: none;">
            <div class="section-buttons">
                <button class="panel-switch-btn" data-panel="reflections">Learning History</button>
                <button class="panel-switch-btn" data-panel="tests">Self-Test Validation</button>
                <button class="panel-switch-btn" data-panel="apis">Browser Capabilities</button>
                <button class="panel-switch-btn" data-panel="agent-viz">Agent Visualization</button>
                <button class="panel-switch-btn" data-panel="canvas-viz">Canvas Visualizer</button>
            </div>
        </div>
    </div>
    <div id="advanced-log-panel" class="panel hidden" role="region" aria-labelledby="advanced-log-title" aria-live="polite">
        <h2 id="advanced-log-title">Advanced Logs</h2>
        <div id="log-output" aria-live="polite" aria-relevant="additions"></div>
    </div>
    <div id="performance-panel" class="panel hidden" role="region" aria-labelledby="performance-title">
        <h2 id="performance-title">Performance Metrics</h2>
        <div id="performance-content">
            <div class="perf-section">
                <h3>Session</h3>
                <div id="perf-session" class="perf-stats"></div>
            </div>
            <div class="perf-section">
                <h3>LLM API</h3>
                <div id="perf-llm" class="perf-stats"></div>
            </div>
            <div class="perf-section">
                <h3>Memory</h3>
                <div id="perf-memory" class="perf-stats"></div>
            </div>
            <div class="perf-section">
                <h3>Top Tools</h3>
                <div id="perf-tools" class="perf-stats"></div>
            </div>
            <div class="perf-actions">
                <button id="perf-refresh-btn" aria-label="Refresh performance metrics">⟳ Refresh</button>
                <button id="perf-export-btn" aria-label="Export performance report">☐ Export Report</button>
                <button id="perf-reset-btn" aria-label="Reset metrics" class="danger">☒ Reset</button>
            </div>
        </div>
    </div>
    <div id="introspection-panel" class="panel hidden" role="region" aria-labelledby="introspection-title">
        <h2 id="introspection-title">Self-Analysis</h2>
        <div id="introspection-content">
            <div class="intro-section">
                <h3>Module Architecture</h3>
                <div id="intro-modules" class="intro-stats"></div>
            </div>
            <div class="intro-section">
                <h3>Tool Catalog</h3>
                <div id="intro-tools" class="intro-stats"></div>
            </div>
            <div class="intro-section">
                <h3>Browser Capabilities</h3>
                <div id="intro-capabilities" class="intro-stats"></div>
            </div>
            <div class="intro-actions">
                <button id="intro-refresh-btn" aria-label="Refresh introspection data">⟳ Refresh</button>
                <button id="intro-export-btn" aria-label="Export self-analysis report">☐ Export Report</button>
                <button id="intro-graph-btn" aria-label="View module graph">⛶ Module Graph</button>
            </div>
        </div>
    </div>
    <div id="reflections-panel" class="panel hidden" role="region" aria-labelledby="reflections-title">
        <h2 id="reflections-title">Learning History</h2>
        <div id="reflections-content">
            <div class="refl-section">
                <h3>Summary</h3>
                <div id="refl-summary" class="refl-stats"></div>
            </div>
            <div class="refl-section">
                <h3>Patterns</h3>
                <div id="refl-patterns" class="refl-stats"></div>
            </div>
            <div class="refl-section">
                <h3>Recent Reflections</h3>
                <div id="refl-recent" class="refl-list"></div>
            </div>
            <div class="refl-actions">
                <button id="refl-refresh-btn" aria-label="Refresh reflections">⟳ Refresh</button>
                <button id="refl-export-btn" aria-label="Export reflection report">☐ Export Report</button>
                <button id="refl-clear-btn" aria-label="Clear old reflections" class="danger">☒ Clear Old</button>
            </div>
        </div>
    </div>
    <div id="self-test-panel" class="panel hidden" role="region" aria-labelledby="self-test-title">
        <h2 id="self-test-title">Self-Test Validation</h2>
        <div id="self-test-content">
            <div class="test-section">
                <h3>Test Summary</h3>
                <div id="test-summary" class="test-stats"></div>
            </div>
            <div class="test-section">
                <h3>Test Suites</h3>
                <div id="test-suites" class="test-list"></div>
            </div>
            <div class="test-section">
                <h3>Test History</h3>
                <div id="test-history" class="test-history"></div>
            </div>
            <div class="test-actions">
                <button id="test-run-btn" aria-label="Run all tests">▶ Run Tests</button>
                <button id="test-export-btn" aria-label="Export test report">☐ Export Report</button>
                <button id="test-refresh-btn" aria-label="Refresh test results">⟳ Refresh</button>
            </div>
        </div>
    </div>
    <div id="browser-apis-panel" class="panel hidden" role="region" aria-labelledby="browser-apis-title">
        <h2 id="browser-apis-title">Browser Capabilities</h2>
        <div id="browser-apis-content">
            <div class="api-section">
                <h3>File System Access</h3>
                <div id="api-filesystem" class="api-controls">
                    <div class="api-status" id="filesystem-status">Not connected</div>
                    <button id="filesystem-request-btn" aria-label="Request directory access">☐ Connect Directory</button>
                    <button id="filesystem-sync-btn" class="hidden" aria-label="Sync VFS to filesystem">☐ Sync VFS</button>
                </div>
            </div>
            <div class="api-section">
                <h3>Notifications</h3>
                <div id="api-notifications" class="api-controls">
                    <div class="api-status" id="notifications-status">Permission not granted</div>
                    <button id="notifications-request-btn" aria-label="Request notification permission">☊ Enable Notifications</button>
                    <button id="notifications-test-btn" class="hidden" aria-label="Test notification">☈ Test</button>
                </div>
            </div>
            <div class="api-section">
                <h3>Storage</h3>
                <div id="api-storage" class="api-controls">
                    <div id="storage-estimate" class="api-stats"></div>
                    <button id="storage-refresh-btn" aria-label="Refresh storage estimate">⟳ Refresh</button>
                    <button id="storage-persist-btn" aria-label="Request persistent storage">☿ Request Persistent</button>
                </div>
            </div>
            <div class="api-section">
                <h3>Capabilities</h3>
                <div id="api-capabilities" class="api-stats"></div>
            </div>
            <div class="api-actions">
                <button id="api-export-btn" aria-label="Export capabilities report">☐ Export Report</button>
            </div>
        </div>
    </div>
    <div id="agent-visualizer-panel" class="panel hidden" role="region" aria-labelledby="agent-visualizer-title">
        <h2 id="agent-visualizer-title">Agent Process Visualization</h2>
        <div id="agent-visualizer-content">
            <div class="visualizer-controls">
                <button id="avis-reset-btn" aria-label="Reset visualization">⟳ Reset</button>
                <button id="avis-center-btn" aria-label="Center view">⚐ Center</button>
            </div>
            <div id="agent-visualizer-container" class="visualizer-container" aria-label="Force-directed graph showing FSM states and transitions"></div>
        </div>
    </div>
    <div id="ast-visualizer-panel" class="panel hidden" role="region" aria-labelledby="ast-visualizer-title">
        <h2 id="ast-visualizer-title">AST Visualization</h2>
        <div id="ast-visualizer-content">
            <div class="ast-input-section">
                <h4>JavaScript Code Input</h4>
                <textarea id="ast-code-input" class="ast-code-input" placeholder="Enter JavaScript code to visualize..." aria-label="JavaScript code input">// Example: Function declaration
function greet(name) {
  return \`Hello, \${name}!\`;
}</textarea>
                <div class="ast-controls">
                    <button id="ast-visualize-btn" aria-label="Visualize AST">⚲ Visualize</button>
                    <button id="ast-expand-btn" aria-label="Expand all nodes">⊕ Expand All</button>
                    <button id="ast-collapse-btn" aria-label="Collapse all nodes">⊖ Collapse All</button>
                    <button id="ast-reset-btn" aria-label="Reset to example">⟳ Reset</button>
                </div>
            </div>
            <div id="ast-viz-container" class="ast-viz-container" aria-label="Tree diagram showing Abstract Syntax Tree structure"></div>
        </div>
    </div>
    <div id="python-repl-panel" class="panel hidden" role="region" aria-labelledby="python-repl-title">
        <h2 id="python-repl-title">Python REPL</h2>
        <div id="python-repl-content">
            <div class="repl-status">
                <div id="pyodide-status" class="pyodide-status">
                    <span id="pyodide-status-icon" class="status-icon" aria-hidden="true">⚪</span>
                    <span id="pyodide-status-text" aria-live="polite">Initializing...</span>
                </div>
                <div class="repl-controls">
                    <button id="repl-clear-btn" aria-label="Clear output" title="Clear output">☒ Clear</button>
                    <button id="repl-packages-btn" aria-label="Manage packages" title="Manage packages">☐ Packages</button>
                    <button id="repl-sync-btn" aria-label="Sync workspace" title="Sync workspace files to Python">⟳ Sync VFS</button>
                </div>
            </div>
            <div class="repl-input-section">
                <h4>Python Code</h4>
                <textarea id="python-code-input" class="python-code-input" placeholder="Enter Python code to execute..." aria-label="Python code input"># Example: Data analysis
import sys
print(f"Python {sys.version}")
print("Hello from Pyodide!")</textarea>
                <div class="repl-actions">
                    <button id="python-execute-btn" aria-label="Execute Python code">▶ Run</button>
                    <button id="python-execute-async-btn" aria-label="Execute Python code (async)">▶ Run Async</button>
                    <label class="repl-checkbox">
                        <input type="checkbox" id="python-sync-workspace-check" aria-label="Sync workspace before execution">
                        Sync workspace before run
                    </label>
                </div>
            </div>
            <div class="repl-output-section">
                <h4>Output</h4>
                <div id="python-output" class="python-output" aria-live="polite" aria-atomic="false"></div>
            </div>
        </div>
    </div>
    <div id="local-llm-panel" class="panel hidden" role="region" aria-labelledby="local-llm-title">
        <h2 id="local-llm-title">Local LLM (WebGPU)</h2>
        <div id="local-llm-content">
            <div class="llm-status">
                <div id="llm-status-display" class="llm-status-display">
                    <span id="llm-status-icon" class="status-icon" aria-hidden="true">⚪</span>
                    <span id="llm-status-text" aria-live="polite">Not loaded</span>
                </div>
                <div class="llm-model-info">
                    <span id="llm-current-model">No model loaded</span>
                </div>
            </div>
            <div id="llm-loading-section" class="llm-loading-section hidden">
                <h4>Loading Model...</h4>
                <div class="llm-progress-bar">
                    <div id="llm-progress-fill" class="llm-progress-fill" style="width: 0%"></div>
                </div>
                <div id="llm-progress-text" class="llm-progress-text">Initializing...</div>
            </div>
            <div class="llm-controls-section">
                <h4>Model Management</h4>
                <div class="llm-model-selector">
                    <select id="llm-model-select" aria-label="Select LLM model">
                        <option value="">Select a model...</option>
                        <optgroup label="Text Models">
                            <option value="Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC">Qwen2.5 Coder 1.5B (~900MB)</option>
                            <option value="Phi-3.5-mini-instruct-q4f16_1-MLC">Phi-3.5 Mini (~2.1GB)</option>
                            <option value="Llama-3.2-1B-Instruct-q4f16_1-MLC">Llama 3.2 1B (~900MB)</option>
                            <option value="gemma-2-2b-it-q4f16_1-MLC">Gemma 2 2B (~1.2GB)</option>
                        </optgroup>
                        <optgroup label="Vision Models">
                            <option value="Phi-3.5-vision-instruct-q4f16_1-MLC">Phi-3.5 Vision (~4.2GB)</option>
                            <option value="llava-v1.5-7b-q4f16_1-MLC">LLaVA 1.5 7B (~4.5GB)</option>
                        </optgroup>
                    </select>
                    <button id="llm-load-btn" aria-label="Load selected model">☇ Load Model</button>
                    <button id="llm-unload-btn" class="hidden" aria-label="Unload current model">☒ Unload</button>
                </div>
                <div class="llm-info">
                    <div id="llm-webgpu-status">Checking WebGPU...</div>
                </div>
            </div>
            <div class="llm-test-section">
                <h4>Test Inference</h4>
                <textarea id="llm-test-prompt" class="llm-test-prompt" placeholder="Enter a coding prompt to test the model..." aria-label="Test prompt">Write a Python function to calculate fibonacci numbers.</textarea>
                <div class="llm-image-upload" id="llm-image-upload-section" style="display: none;">
                    <label for="llm-test-image" class="llm-image-label">
                        ⛶ Upload Image (for vision models):
                    </label>
                    <input type="file" id="llm-test-image" accept="image/*" aria-label="Upload image for vision model" />
                    <div id="llm-image-preview-container" style="display: none; margin-top: 8px;">
                        <img id="llm-test-preview" style="max-width: 200px; max-height: 200px; border: 1px solid var(--border);" alt="Preview" />
                        <button id="llm-clear-image" style="margin-left: 8px;">☒ Clear</button>
                    </div>
                </div>
                <div class="llm-test-controls">
                    <button id="llm-test-btn" aria-label="Test inference" disabled>▶ Test</button>
                    <label class="llm-checkbox">
                        <input type="checkbox" id="llm-stream-check" aria-label="Enable streaming" checked>
                        Stream output
                    </label>
                </div>
                <div id="llm-test-output" class="llm-test-output"></div>
            </div>
        </div>
    </div>
    <div id="canvas-viz-panel" class="panel hidden" role="region" aria-labelledby="canvas-viz-title">
        <h2 id="canvas-viz-title">Agent Visualization</h2>
        <div id="canvas-viz-container" style="width: 100%; height: 450px; position: relative; background: var(--bg-secondary); border: 1px solid var(--border); border-radius: var(--radius-md);">
            <!-- Canvas will be inserted here by canvas-visualizer.js -->
        </div>
        <div class="canvas-viz-controls" style="margin-top: var(--space-md); display: flex; gap: var(--space-sm); flex-wrap: wrap;">
            <button class="viz-mode-btn btn secondary" data-mode="dependency">☰ Dependencies</button>
            <button class="viz-mode-btn btn secondary" data-mode="cognitive">☥ Cognitive Flow</button>
            <button class="viz-mode-btn btn secondary" data-mode="memory">⚘ Memory Heatmap</button>
            <button class="viz-mode-btn btn secondary" data-mode="goals">⚐ Goal Tree</button>
            <button class="viz-mode-btn btn secondary" data-mode="tools">⚙ Tool Usage</button>
        </div>
    </div>
</div>
`;

    const UI_CORE_CSS = `/* Dashboard Styles */

/* Theme System - CSS Variables */
:root {
    /* Dark Theme (Default) */
    --bg-primary: #0a0a14;
    --bg-secondary: #1a1a2e;
    --bg-tertiary: #16213e;
    --bg-panel: rgba(26, 26, 46, 0.8);
    --bg-hover: rgba(0, 255, 255, 0.1);

    --text-primary: #e0e0e0;
    --text-secondary: #aaa;
    --text-muted: #666;

    --border-primary: rgba(0, 255, 255, 0.3);
    --border-secondary: rgba(255, 255, 255, 0.1);

    --accent-cyan: #00ffff;
    --accent-cyan-dim: rgba(0, 255, 255, 0.1);
    --accent-cyan-bright: rgba(0, 255, 255, 0.3);

    --success: #0f0;
    --success-bg: rgba(0, 255, 0, 0.1);
    --warning: #ff0;
    --warning-bg: rgba(255, 255, 0, 0.1);
    --error: #f00;
    --error-bg: rgba(255, 0, 0, 0.1);
    --info: #00f;
    --info-bg: rgba(0, 0, 255, 0.1);

    --scrollbar-bg: #1a1a2e;
    --scrollbar-thumb: rgba(0, 255, 255, 0.3);
    --scrollbar-thumb-hover: rgba(0, 255, 255, 0.5);

    /* Spacing Scale */
    --space-xs: 4px;
    --space-sm: 8px;
    --space-md: 12px;
    --space-lg: 16px;
    --space-xl: 24px;
    --space-2xl: 32px;

    /* Font Size Scale */
    --font-xs: 10px;
    --font-sm: 11px;
    --font-base: 13px;
    --font-md: 14px;
    --font-lg: 16px;
    --font-xl: 18px;
    --font-2xl: 24px;

    /* Border Radius Scale */
    --radius-sm: 3px;
    --radius-md: 4px;
    --radius-lg: 6px;
    --radius-xl: 8px;

    /* Transition Timing */
    --transition-fast: 0.15s;
    --transition-normal: 0.2s;
    --transition-slow: 0.3s;
}

/* Light Theme */
[data-theme="light"] {
    --bg-primary: #f5f5f5;
    --bg-secondary: #ffffff;
    --bg-tertiary: #e8e8e8;
    --bg-panel: rgba(255, 255, 255, 0.95);
    --bg-hover: rgba(0, 128, 128, 0.05);

    --text-primary: #1a1a1a;
    --text-secondary: #555;
    --text-muted: #999;

    --border-primary: rgba(0, 128, 128, 0.3);
    --border-secondary: rgba(0, 0, 0, 0.1);

    --accent-cyan: #008b8b;
    --accent-cyan-dim: rgba(0, 128, 128, 0.05);
    --accent-cyan-bright: rgba(0, 128, 128, 0.15);

    --success: #0a0;
    --success-bg: rgba(0, 170, 0, 0.1);
    --warning: #aa0;
    --warning-bg: rgba(170, 170, 0, 0.1);
    --error: #a00;
    --error-bg: rgba(170, 0, 0, 0.1);
    --info: #00a;
    --info-bg: rgba(0, 0, 170, 0.1);

    --scrollbar-bg: #e8e8e8;
    --scrollbar-thumb: rgba(0, 128, 128, 0.3);
    --scrollbar-thumb-hover: rgba(0, 128, 128, 0.5);
}

/* Generic stat item styles (DRY pattern for perf-, intro-, refl-, test-, api-stat-item) */
.stat-item, .perf-stat-item, .intro-stat-item, .refl-stat-item, .test-stat-item, .api-stat-item {
    display: flex;
    justify-content: space-between;
    padding: var(--space-xs) 0;
}

.stat-label, .perf-stat-label, .intro-stat-label, .refl-stat-label, .test-stat-label, .api-stat-label {
    color: var(--text-secondary);
}

.stat-value, .perf-stat-value, .intro-stat-value, .refl-stat-value, .test-stat-value, .api-stat-value {
    color: var(--text-primary);
    font-weight: bold;
}

#dashboard {
    display: grid;
    grid-template-columns: 1fr 2fr;
    grid-template-rows: auto auto 1fr auto;
    grid-template-areas:
        "status status"
        "goal thoughts"
        "changes thoughts"
        "toggle toggle";
    gap: var(--space-lg);
    height: 100vh;
    padding: var(--space-lg);
    box-sizing: border-box;
    background-color: var(--bg-primary);
    color: var(--text-primary);
    font-family: 'Courier New', monospace;
}

/* Factory mode layout with preview */
#dashboard.factory-mode {
    grid-template-columns: 1fr 1fr 1fr;
    grid-template-areas:
        "status status status"
        "goal thoughts preview"
        "changes thoughts preview"
        "toggle toggle toggle";
}

/* Status Bar */
.status-bar {
    grid-area: status;
    display: flex;
    align-items: center;
    gap: var(--space-lg);
    padding: var(--space-md) var(--space-lg);
    background: var(--accent-cyan-dim);
    border: 1px solid var(--border-primary);
    border-radius: var(--radius-md);
}

.status-indicator {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
}

.status-icon {
    font-size: var(--font-xl);
    animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
}

.status-state {
    font-weight: bold;
    color: #0ff;
    font-size: var(--font-md);
    text-transform: uppercase;
    letter-spacing: 1px;
}

.status-detail {
    flex: 1;
    color: #e0e0e0;
    font-size: var(--font-base);
}

.status-progress {
    width: 200px;
    height: var(--space-sm);
    background: rgba(0, 0, 0, 0.3);
    border-radius: var(--radius-md);
    overflow: hidden;
}

.progress-bar {
    height: 100%;
    background: rgba(0, 0, 0, 0.2);
}

.progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #0ff, #0cc);
    transition: width var(--transition-slow) ease;
}

.btn-export-session {
    padding: 6px var(--space-md);
    background: rgba(0, 255, 255, 0.1);
    border: 1px solid rgba(0, 255, 255, 0.3);
    border-radius: var(--radius-md);
    color: #0ff;
    font-size: var(--font-base);
    cursor: pointer;
    transition: all var(--transition-normal);
    font-family: 'Courier New', monospace;
}

.btn-export-session:hover {
    background: rgba(0, 255, 255, 0.2);
    border-color: #0ff;
    box-shadow: 0 0 8px rgba(0, 255, 255, 0.3);
}

.btn-export-session:active {
    transform: scale(0.98);
}

.btn-tutorial {
    padding: 6px var(--space-md);
    background: rgba(255, 215, 0, 0.1);
    border: 1px solid rgba(255, 215, 0, 0.3);
    border-radius: var(--radius-md);
    color: #ffd700;
    font-size: var(--font-sm);
    cursor: pointer;
    transition: all var(--transition-normal);
    font-family: 'Courier New', monospace;
}

.btn-tutorial:hover {
    background: rgba(255, 215, 0, 0.2);
    border-color: #ffd700;
    box-shadow: 0 0 8px rgba(255, 215, 0, 0.3);
}

.btn-tutorial:active {
    transform: scale(0.98);
}

.btn-theme-toggle {
    padding: 6px var(--space-md);
    background: var(--accent-cyan-dim);
    border: 1px solid var(--border-primary);
    border-radius: var(--radius-md);
    color: var(--accent-cyan);
    font-size: var(--font-lg);
    cursor: pointer;
    transition: all var(--transition-normal);
    font-family: 'Courier New', monospace;
    margin-left: auto;
}

.btn-theme-toggle:hover {
    background: var(--accent-cyan-bright);
    box-shadow: 0 0 8px var(--border-primary);
}

.btn-theme-toggle:active {
    transform: scale(0.98);
}

.panel {
    border: 1px solid var(--border-secondary);
    padding: var(--space-lg);
    background: var(--bg-panel);
    overflow: auto;
}

#goal-panel { grid-area: goal; }
#changes-panel { grid-area: changes; }
#thought-panel { grid-area: thoughts; }
#visual-preview-panel { grid-area: preview; }
#advanced-log-toggle { grid-area: toggle; }
#advanced-log-panel { grid-area: thoughts; } /* Will occupy same space as thoughts */

/* Preview panel styles */
#visual-preview-panel {
    position: relative;
}

#preview-iframe {
    width: 100%;
    height: calc(100% - 40px);
    border: 1px solid var(--border-secondary);
    background: var(--bg-secondary);
}

.panel h2 {
    color: var(--accent-cyan);
    margin-top: 0;
    font-size: 1.2em;
    text-shadow: 0 0 5px var(--accent-cyan);
}

#thought-stream p {
    margin: 0 0 10px 0;
    line-height: 1.6;
    white-space: pre-wrap;
}

#diff-viewer pre {
    margin: 0;
    font-family: inherit;
}

.diff-add {
    color: #0f0;
    background-color: rgba(0, 255, 0, 0.1);
}

.diff-remove {
    color: #f00;
    background-color: rgba(255, 0, 0, 0.1);
}

#log-toggle-btn {
    width: 100%;
    padding: var(--space-sm) var(--space-md);
    background: #333;
    color: #e0e0e0;
    border: 1px solid #555;
    cursor: pointer;
}

/* ========================================
   ACCESSIBILITY
   ======================================== */

/* Focus indicators for keyboard navigation */
button:focus-visible,
a:focus-visible,
[role="button"]:focus-visible {
    outline: 2px solid #0ff;
    outline-offset: 2px;
    box-shadow: 0 0 8px rgba(0, 255, 255, 0.5);
}

/* High contrast focus for interactive elements */
.panel a:focus-visible,
#vfs-tree a:focus-visible {
    outline: 2px solid #0ff;
    outline-offset: 1px;
    background: rgba(0, 255, 255, 0.1);
}

/* Skip to main content link (for screen readers) */
.skip-link {
    position: absolute;
    top: -40px;
    left: 0;
    background: #0ff;
    color: #000;
    padding: var(--space-sm);
    text-decoration: none;
    z-index: 100;
}

.skip-link:focus {
    top: 0;
}

/* Ensure sufficient contrast for status states */
.status-state[aria-label] {
    font-weight: bold;
}

/* Visual feedback for aria-pressed states */
[aria-pressed="true"] {
    background: rgba(0, 255, 255, 0.2);
    border-color: #0ff;
}

/* ========================================
   PERFORMANCE PANEL
   ======================================== */

#performance-panel {
    grid-area: thoughts;
}

#performance-content {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.perf-section {
    background: rgba(0, 255, 255, 0.03);
    border: 1px solid rgba(0, 255, 255, 0.1);
    border-radius: var(--radius-md);
    padding: var(--space-md);
}

.perf-section h3 {
    color: #0ff;
    font-size: 0.9em;
    margin: 0 0 8px 0;
    text-transform: uppercase;
    letter-spacing: 1px;
}

.perf-stats {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    font-size: 0.85em;
}

/* perf-stat-item styles now use generic .stat-item from top of file */

.perf-stat-value.good {
    color: #0f0;
}

.perf-stat-value.warning {
    color: #ff0;
}

.perf-stat-value.error {
    color: #f00;
}

.perf-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    margin-top: 8px;
}

.perf-actions button {
    padding: var(--space-sm) var(--space-md);
    background: rgba(0, 255, 255, 0.1);
    border: 1px solid rgba(0, 255, 255, 0.3);
    border-radius: var(--radius-md);
    color: #0ff;
    cursor: pointer;
    font-size: 0.85em;
    transition: all 0.2s;
}

.perf-actions button:hover {
    background: rgba(0, 255, 255, 0.2);
    border-color: #0ff;
}

.perf-actions button.danger {
    color: #f88;
    border-color: rgba(255, 136, 136, 0.3);
}

.perf-actions button.danger:hover {
    background: rgba(255, 136, 136, 0.2);
    border-color: #f88;
}

/* ========================================
   INTROSPECTION PANEL
   ======================================== */

#introspection-panel {
    grid-area: thoughts;
}

#introspection-content {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.intro-section {
    background: rgba(0, 255, 255, 0.03);
    border: 1px solid rgba(0, 255, 255, 0.1);
    border-radius: var(--radius-md);
    padding: var(--space-md);
}

.intro-section h3 {
    color: #0ff;
    font-size: 0.9em;
    margin: 0 0 8px 0;
    text-transform: uppercase;
    letter-spacing: 1px;
}

.intro-stats {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    font-size: 0.85em;
}

/* intro-stat-item styles now use generic .stat-item from top of file */

.intro-stat-value.available {
    color: #0f0;
}

.intro-stat-value.unavailable {
    color: #666;
}

.intro-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    margin-top: 8px;
}

.intro-actions button {
    padding: var(--space-sm) var(--space-md);
    background: rgba(0, 255, 255, 0.1);
    border: 1px solid rgba(0, 255, 255, 0.3);
    border-radius: var(--radius-md);
    color: #0ff;
    cursor: pointer;
    font-size: 0.85em;
    transition: all 0.2s;
}

.intro-actions button:hover {
    background: rgba(0, 255, 255, 0.2);
    border-color: #0ff;
}

/* ========================================
   REFLECTIONS PANEL
   ======================================== */

#reflections-panel {
    grid-area: thoughts;
}

#reflections-content {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.refl-section {
    background: rgba(0, 255, 255, 0.03);
    border: 1px solid rgba(0, 255, 255, 0.1);
    border-radius: var(--radius-md);
    padding: var(--space-md);
}

.refl-section h3 {
    color: #0ff;
    font-size: 0.9em;
    margin: 0 0 8px 0;
    text-transform: uppercase;
    letter-spacing: 1px;
}

.refl-stats {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    font-size: 0.85em;
}

/* refl-stat-item styles now use generic .stat-item from top of file */

.refl-list {
    max-height: 300px;
    overflow-y: auto;
    font-size: 0.85em;
}

.refl-item {
    border-left: 3px solid;
    padding: var(--space-sm);
    margin-bottom: 8px;
    background: rgba(0, 0, 0, 0.2);
}

.refl-item.success {
    border-left-color: #0f0;
}

.refl-item.failure {
    border-left-color: #f00;
}

.refl-item.partial {
    border-left-color: #ff0;
}

.refl-item-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 4px;
    font-size: 0.9em;
}

.refl-item-outcome {
    font-weight: bold;
}

.refl-item-date {
    color: #888;
    font-size: 0.85em;
}

.refl-item-description {
    color: #ddd;
    line-height: 1.4;
}

.refl-item-tags {
    margin-top: 4px;
    font-size: 0.8em;
    color: #888;
}

.refl-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    margin-top: 8px;
}

.refl-actions button {
    padding: var(--space-sm) var(--space-md);
    background: rgba(0, 255, 255, 0.1);
    border: 1px solid rgba(0, 255, 255, 0.3);
    border-radius: var(--radius-md);
    color: #0ff;
    cursor: pointer;
    font-size: 0.85em;
    transition: all 0.2s;
}

.refl-actions button:hover {
    background: rgba(0, 255, 255, 0.2);
    border-color: #0ff;
}

.refl-actions button.danger {
    color: #f88;
    border-color: rgba(255, 136, 136, 0.3);
}

.refl-actions button.danger:hover {
    background: rgba(255, 136, 136, 0.2);
    border-color: #f88;
}

.hidden {
    display: none !important;
}

/* ========================================
   MOBILE RESPONSIVE DESIGN
   ======================================== */

/* Tablet breakpoint (1024px and below) */
@media (max-width: 1024px) {
    #dashboard {
        grid-template-columns: 1fr;
        grid-template-rows: auto auto auto 1fr auto;
        grid-template-areas:
            "status"
            "goal"
            "changes"
            "thoughts"
            "toggle";
        padding: var(--space-sm) var(--space-md);
        gap: 10px;
    }

    /* Factory mode on tablets - stack vertically */
    #dashboard.factory-mode {
        grid-template-columns: 1fr;
        grid-template-areas:
            "status"
            "goal"
            "preview"
            "changes"
            "thoughts"
            "toggle";
    }

    .status-bar {
        flex-wrap: wrap;
        padding: var(--space-sm) var(--space-md);
    }

    .status-progress {
        width: 100%;
        order: 3;
        flex-basis: 100%;
        margin-top: 8px;
    }

    .panel {
        padding: var(--space-sm) var(--space-md);
        max-height: 300px;
    }

    #thought-panel,
    #advanced-log-panel {
        max-height: 400px;
    }

    .panel h2 {
        font-size: 1em;
    }
}

/* Mobile breakpoint (768px and below) */
@media (max-width: 768px) {
    #dashboard {
        height: auto;
        min-height: 100vh;
        padding: var(--space-sm);
        gap: 8px;
    }

    .status-bar {
        padding: var(--space-sm);
        gap: 8px;
    }

    .status-icon {
        font-size: var(--font-lg);
    }

    .status-state {
        font-size: var(--font-base);
        letter-spacing: 0.5px;
    }

    .status-detail {
        font-size: var(--font-sm);
    }

    .panel {
        padding: var(--space-sm);
        font-size: var(--font-base);
        max-height: 250px;
        min-height: 150px;
    }

    .panel h2 {
        font-size: 0.9em;
        margin-bottom: 8px;
    }

    #thought-stream p {
        font-size: var(--font-base);
        margin-bottom: 8px;
    }

    #log-toggle-btn {
        padding: var(--space-sm);
        font-size: var(--font-base);
    }

    #preview-iframe {
        height: 250px;
    }

    /* Make scrollbars thinner on mobile */
    .panel::-webkit-scrollbar {
        width: 4px;
        height: 4px;
    }
}

/* Small mobile breakpoint (480px and below) */
@media (max-width: 480px) {
    #dashboard {
        padding: 5px;
        gap: 5px;
    }

    .status-bar {
        flex-direction: column;
        align-items: flex-start;
        padding: 6px;
    }

    .status-indicator {
        width: 100%;
    }

    .status-detail {
        width: 100%;
        margin-top: 4px;
    }

    .status-progress {
        margin-top: 6px;
    }

    .panel {
        padding: 6px;
        font-size: var(--font-base);
        max-height: 200px;
        min-height: 120px;
        border-radius: var(--radius-md);
    }

    .panel h2 {
        font-size: 0.85em;
        margin-bottom: 6px;
    }

    #thought-stream p {
        font-size: var(--font-sm);
        line-height: 1.4;
    }

    #log-toggle-btn {
        padding: 6px;
        font-size: var(--font-base);
    }
}

/* Landscape mobile (height < 500px) */
@media (max-height: 500px) and (orientation: landscape) {
    #dashboard {
        height: auto;
        min-height: 100vh;
    }

    .panel {
        max-height: 150px;
    }

    .status-bar {
        padding: 6px var(--space-md);
    }
}

/* Touch device optimizations */
@media (hover: none) and (pointer: coarse) {
    /* Larger touch targets */
    #log-toggle-btn {
        min-height: 44px;
    }

    .panel h2 {
        user-select: none;
    }

    /* Better scroll momentum */
    .panel {
        -webkit-overflow-scrolling: touch;
        overflow-y: auto;
    }
}

/* Metrics Dashboard Styles */
.charts-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 20px;
    margin-top: 15px;
}

.chart-container {
    background: rgba(0, 255, 255, 0.03);
    border: 1px solid rgba(0, 255, 255, 0.2);
    border-radius: var(--radius-lg);
    padding: 15px;
    min-height: 300px;
}

.chart-container h4 {
    margin: 0 0 10px 0;
    font-size: var(--font-md);
    color: #0ff;
    text-align: center;
}

.chart-container canvas {
    max-height: 250px;
}

/* Self-Test Panel Styles */
#self-test-panel {
    grid-area: thoughts;
}

.test-section {
    background: rgba(0, 255, 255, 0.03);
    border: 1px solid rgba(0, 255, 255, 0.1);
    border-radius: var(--radius-md);
    padding: var(--space-md);
    margin-bottom: 12px;
}

.test-section h3 {
    margin: 0 0 10px 0;
    font-size: var(--font-md);
    color: #0ff;
}

.test-stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 8px;
}

.test-stat-item {
    /* Base layout from generic .stat-item */
    padding: 6px;
    background: rgba(0, 0, 0, 0.3);
    border-radius: var(--radius-sm);
}

.test-stat-label {
    /* Overrides generic .stat-label for block layout */
    display: block;
    font-size: var(--font-sm);
    color: #888;
    margin-bottom: 2px;
}

.test-stat-value {
    /* Extends generic .stat-value */
    font-size: var(--font-lg);
}

.test-stat-value.passed {
    color: #0f0;
}

.test-stat-value.failed {
    color: #f00;
}

.test-stat-value.warning {
    color: #ff0;
}

.test-list {
    max-height: 300px;
    overflow-y: auto;
}

.test-suite-item {
    background: rgba(0, 0, 0, 0.3);
    border-left: 3px solid;
    padding: var(--space-sm);
    margin-bottom: 8px;
    border-radius: var(--radius-sm);
}

.test-suite-item.passed {
    border-left-color: #0f0;
}

.test-suite-item.failed {
    border-left-color: #f00;
}

.test-suite-item.partial {
    border-left-color: #ff0;
}

.test-suite-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;
}

.test-suite-name {
    font-weight: bold;
    font-size: var(--font-base);
    color: #fff;
}

.test-suite-summary {
    font-size: var(--font-base);
    color: #888;
}

.test-detail {
    font-size: var(--font-sm);
    color: #ccc;
    margin-left: 12px;
    margin-top: 4px;
}

.test-detail.passed {
    color: #0f0;
}

.test-detail.failed {
    color: #f00;
}

.test-history {
    max-height: 200px;
    overflow-y: auto;
}

.test-history-item {
    padding: 6px;
    background: rgba(0, 0, 0, 0.3);
    border-radius: var(--radius-sm);
    margin-bottom: 6px;
    font-size: var(--font-sm);
}

.test-history-time {
    color: #888;
    font-size: var(--font-xs);
}

.test-history-summary {
    margin-top: 4px;
    color: #ccc;
}

.test-actions {
    display: flex;
    gap: 8px;
    margin-top: 12px;
    flex-wrap: wrap;
}

.test-actions button {
    padding: var(--space-sm) var(--space-md);
    background: rgba(0, 255, 255, 0.1);
    border: 1px solid rgba(0, 255, 255, 0.3);
    color: #0ff;
    cursor: pointer;
    border-radius: var(--radius-sm);
    font-family: inherit;
    font-size: var(--font-base);
    transition: all 0.2s;
}

.test-actions button:hover {
    background: rgba(0, 255, 255, 0.2);
    border-color: rgba(0, 255, 255, 0.5);
}

.test-actions button:active {
    transform: scale(0.98);
}

.test-actions button.running {
    background: rgba(255, 255, 0, 0.2);
    border-color: rgba(255, 255, 0, 0.5);
    color: #ff0;
    cursor: wait;
}

/* Browser APIs Panel Styles */
#browser-apis-panel {
    grid-area: thoughts;
}

.api-section {
    background: rgba(0, 255, 255, 0.03);
    border: 1px solid rgba(0, 255, 255, 0.1);
    border-radius: var(--radius-md);
    padding: var(--space-md);
    margin-bottom: 12px;
}

.api-section h3 {
    margin: 0 0 10px 0;
    font-size: var(--font-md);
    color: #0ff;
}

.api-controls {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.api-status {
    padding: var(--space-sm);
    background: rgba(0, 0, 0, 0.3);
    border-radius: var(--radius-sm);
    font-size: var(--font-base);
    color: #ccc;
    border-left: 3px solid #666;
}

.api-status.connected {
    border-left-color: #0f0;
    color: #0f0;
}

.api-status.granted {
    border-left-color: #0f0;
    color: #0f0;
}

.api-status.denied {
    border-left-color: #f00;
    color: #f88;
}

.api-stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 8px;
}

.api-stat-item {
    /* Base layout from generic .stat-item */
    padding: 6px;
    background: rgba(0, 0, 0, 0.3);
    border-radius: var(--radius-sm);
}

.api-stat-label {
    /* Overrides generic .stat-label for block layout */
    display: block;
    font-size: var(--font-xs);
    color: #888;
    margin-bottom: 2px;
}

.api-stat-value {
    /* Extends generic .stat-value */
    font-size: var(--font-md);
}

.api-stat-value.available {
    color: #0f0;
}

.api-stat-value.unavailable {
    color: #666;
}

.api-stat-value.warning {
    color: #ff0;
}

.api-stat-value.error {
    color: #f00;
}

.api-actions {
    display: flex;
    gap: 8px;
    margin-top: 12px;
    flex-wrap: wrap;
}

.api-actions button,
.api-controls button {
    padding: var(--space-sm) var(--space-md);
    background: rgba(0, 255, 255, 0.1);
    border: 1px solid rgba(0, 255, 255, 0.3);
    color: #0ff;
    cursor: pointer;
    border-radius: var(--radius-sm);
    font-family: inherit;
    font-size: var(--font-base);
    transition: all 0.2s;
}

.api-actions button:hover,
.api-controls button:hover {
    background: rgba(0, 255, 255, 0.2);
    border-color: rgba(0, 255, 255, 0.5);
}

.api-actions button:active,
.api-controls button:active {
    transform: scale(0.98);
}

.api-controls button.hidden {
    display: none;
}

/* ========================================
   UTILITY CLASSES
   ======================================== */

/* Animation Utilities */
@keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}

@keyframes slideIn {
    from {
        opacity: 0;
        transform: translateY(20px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

@keyframes slideInFromRight {
    from {
        opacity: 0;
        transform: translateX(20px);
    }
    to {
        opacity: 1;
        transform: translateX(0);
    }
}

.animate-fade-in {
    animation: fadeIn var(--transition-slow) ease;
}

.animate-slide-in {
    animation: slideIn var(--transition-slow) ease;
}

.animate-slide-in-right {
    animation: slideInFromRight var(--transition-slow) ease;
}

/* Transition Utilities */
.transition-fast {
    transition: all var(--transition-fast) ease;
}

.transition-normal {
    transition: all var(--transition-normal) ease;
}

.transition-slow {
    transition: all var(--transition-slow) ease;
}

/* Component Utility Classes */

/* Button Variants */
.btn-primary {
    padding: var(--space-sm) var(--space-lg);
    background: var(--accent-cyan-dim);
    border: 1px solid var(--border-primary);
    border-radius: var(--radius-md);
    color: var(--accent-cyan);
    font-size: var(--font-base);
    cursor: pointer;
    transition: all var(--transition-normal);
    font-family: 'Courier New', monospace;
}

.btn-primary:hover {
    background: var(--accent-cyan-bright);
    border-color: var(--accent-cyan);
    box-shadow: 0 0 8px var(--border-primary);
}

.btn-primary:active {
    transform: scale(0.98);
}

.btn-secondary {
    padding: var(--space-sm) var(--space-md);
    background: rgba(0, 255, 255, 0.05);
    border: 1px solid rgba(0, 255, 255, 0.2);
    border-radius: var(--radius-md);
    color: var(--text-secondary);
    font-size: var(--font-base);
    cursor: pointer;
    transition: all var(--transition-normal);
    font-family: 'Courier New', monospace;
}

.btn-secondary:hover {
    background: rgba(0, 255, 255, 0.1);
    border-color: rgba(0, 255, 255, 0.3);
    color: var(--accent-cyan);
}

.btn-secondary:active {
    transform: scale(0.98);
}

.btn-ghost {
    padding: var(--space-sm) var(--space-md);
    background: transparent;
    border: 1px solid transparent;
    border-radius: var(--radius-md);
    color: var(--text-secondary);
    font-size: var(--font-base);
    cursor: pointer;
    transition: all var(--transition-normal);
    font-family: 'Courier New', monospace;
}

.btn-ghost:hover {
    background: var(--accent-cyan-dim);
    border-color: var(--border-primary);
    color: var(--accent-cyan);
}

.btn-ghost:active {
    transform: scale(0.98);
}

/* Agent Progress Tracker */
.agent-progress-tracker {
    margin-bottom: var(--space-lg);
}

.progress-steps {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    flex-wrap: wrap;
    margin-top: var(--space-md);
}

.progress-step {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    padding: var(--space-xs) var(--space-md);
    background: var(--bg-secondary);
    border: 1px solid var(--border-secondary);
    border-radius: var(--radius-md);
    font-size: var(--font-sm);
    color: var(--text-secondary);
    transition: all var(--transition-normal);
}

.progress-step.active {
    background: var(--accent-cyan-dim);
    border-color: var(--border-primary);
    color: var(--accent-cyan);
    box-shadow: 0 0 8px var(--border-primary);
}

.progress-step.completed {
    background: var(--success-bg);
    border-color: rgba(0, 255, 0, 0.3);
    color: var(--success);
}

.progress-step .step-icon {
    font-size: var(--font-md);
}

.progress-step .step-label {
    font-family: 'Courier New', monospace;
}

/* Card Components */
.card {
    background: var(--bg-panel);
    border: 1px solid var(--border-secondary);
    border-radius: var(--radius-md);
    padding: var(--space-lg);
    transition: all var(--transition-normal);
}

.card:hover {
    border-color: var(--border-primary);
    box-shadow: 0 0 10px var(--accent-cyan-dim);
}

.card-header {
    color: var(--accent-cyan);
    font-size: var(--font-md);
    font-weight: bold;
    margin-bottom: var(--space-md);
    padding-bottom: var(--space-sm);
    border-bottom: 1px solid var(--border-secondary);
}

.card-body {
    color: var(--text-primary);
    font-size: var(--font-base);
    line-height: 1.6;
}

.card-footer {
    margin-top: var(--space-md);
    padding-top: var(--space-sm);
    border-top: 1px solid var(--border-secondary);
    display: flex;
    gap: var(--space-sm);
    justify-content: flex-end;
}

/* Badge Components */
.badge {
    display: inline-block;
    padding: 2px var(--space-sm);
    border-radius: var(--radius-sm);
    font-size: var(--font-xs);
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.badge-success {
    background: var(--success-bg);
    color: var(--success);
    border: 1px solid var(--success);
}

.badge-warning {
    background: var(--warning-bg);
    color: var(--warning);
    border: 1px solid var(--warning);
}

.badge-error {
    background: var(--error-bg);
    color: var(--error);
    border: 1px solid var(--error);
}

.badge-info {
    background: var(--info-bg);
    color: var(--info);
    border: 1px solid var(--info);
}

.badge-neutral {
    background: rgba(255, 255, 255, 0.05);
    color: var(--text-secondary);
    border: 1px solid var(--border-secondary);
}

/* ========================================
   AGENT VISUALIZER STYLES
   ======================================== */

/* Visualizer Panel */
#agent-visualizer-panel {
    grid-area: thoughts;
}

.visualizer-container {
    width: 100%;
    height: 600px;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(0, 255, 255, 0.2);
    border-radius: var(--radius-md);
    overflow: hidden;
    position: relative;
}

.visualizer-container svg {
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.2);
}

/* Node styling (applied via D3) */
.node {
    cursor: pointer;
}

.node circle {
    transition: all var(--transition-normal);
}

.node:hover circle {
    filter: brightness(1.3);
}

.node.active-state circle {
    animation: pulse-active 2s ease-in-out infinite;
}

@keyframes pulse-active {
    0%, 100% {
        stroke-width: 4px;
        stroke-opacity: 1;
    }
    50% {
        stroke-width: 6px;
        stroke-opacity: 0.7;
    }
}

/* Link styling */
.link {
    transition: stroke-width var(--transition-normal);
}

/* Visualizer controls */
.visualizer-controls {
    display: flex;
    gap: var(--space-sm);
    margin-top: var(--space-md);
    justify-content: flex-end;
}

.visualizer-controls button {
    padding: var(--space-sm) var(--space-md);
    background: rgba(0, 255, 255, 0.1);
    border: 1px solid rgba(0, 255, 255, 0.3);
    border-radius: var(--radius-md);
    color: var(--accent-cyan);
    font-size: var(--font-base);
    cursor: pointer;
    transition: all var(--transition-normal);
    font-family: 'Courier New', monospace;
}

.visualizer-controls button:hover {
    background: rgba(0, 255, 255, 0.2);
    border-color: var(--accent-cyan);
}

.visualizer-controls button:active {
    transform: scale(0.98);
}

/* Legend */
.visualizer-legend {
    margin-top: var(--space-md);
    padding: var(--space-md);
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: var(--radius-md);
}

.visualizer-legend h4 {
    margin: 0 0 var(--space-sm) 0;
    color: var(--accent-cyan);
    font-size: var(--font-base);
}

.legend-items {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: var(--space-sm);
}

.legend-item {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    font-size: var(--font-sm);
}

.legend-icon {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 2px solid rgba(255, 255, 255, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
}

/* ========================================
   AST VISUALIZER STYLES
   ======================================== */

/* AST Visualizer Panel */
#ast-visualizer-panel {
    grid-area: thoughts;
}

.ast-container {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
    height: 100%;
}

.ast-input-section {
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(0, 255, 255, 0.2);
    border-radius: var(--radius-md);
    padding: var(--space-md);
}

.ast-input-section h4 {
    margin: 0 0 var(--space-sm) 0;
    color: var(--accent-cyan);
    font-size: var(--font-base);
}

.ast-code-input {
    width: 100%;
    min-height: 120px;
    padding: var(--space-sm);
    background: rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: var(--radius-sm);
    color: var(--text-primary);
    font-family: 'Courier New', monospace;
    font-size: var(--font-sm);
    resize: vertical;
}

.ast-code-input:focus {
    outline: none;
    border-color: var(--accent-cyan);
    box-shadow: 0 0 5px var(--accent-cyan-dim);
}

.ast-controls {
    display: flex;
    gap: var(--space-sm);
    margin-top: var(--space-sm);
}

.ast-controls button {
    padding: var(--space-sm) var(--space-md);
    background: rgba(0, 255, 255, 0.1);
    border: 1px solid rgba(0, 255, 255, 0.3);
    border-radius: var(--radius-md);
    color: var(--accent-cyan);
    font-size: var(--font-base);
    cursor: pointer;
    transition: all var(--transition-normal);
    font-family: 'Courier New', monospace;
}

.ast-controls button:hover {
    background: rgba(0, 255, 255, 0.2);
    border-color: var(--accent-cyan);
}

.ast-controls button:active {
    transform: scale(0.98);
}

.ast-viz-container {
    flex: 1;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(0, 255, 255, 0.2);
    border-radius: var(--radius-md);
    overflow: hidden;
    min-height: 400px;
}

.ast-viz-container svg {
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.2);
}

/* AST Node styling */
.ast-viz-container .node {
    cursor: pointer;
    transition: all var(--transition-fast);
}

.ast-viz-container .node:hover {
    filter: brightness(1.3);
}

.ast-viz-container .node circle,
.ast-viz-container .node rect,
.ast-viz-container .node path {
    transition: all var(--transition-normal);
}

.ast-viz-container .link {
    transition: stroke var(--transition-normal);
}

/* AST Error display */
.ast-error {
    padding: var(--space-md);
    background: var(--error-bg);
    border: 1px solid var(--error);
    border-radius: var(--radius-md);
    color: var(--error);
    font-size: var(--font-sm);
    font-family: 'Courier New', monospace;
}

.ast-error-title {
    font-weight: bold;
    margin-bottom: var(--space-sm);
}

/* AST Examples */
.ast-examples {
    display: flex;
    gap: var(--space-sm);
    margin-top: var(--space-sm);
    flex-wrap: wrap;
}

.ast-example-btn {
    padding: 4px var(--space-sm);
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: var(--radius-sm);
    color: var(--text-secondary);
    font-size: var(--font-xs);
    cursor: pointer;
    transition: all var(--transition-fast);
    font-family: 'Courier New', monospace;
}

.ast-example-btn:hover {
    background: rgba(0, 255, 255, 0.1);
    border-color: var(--accent-cyan);
    color: var(--accent-cyan);
}

/* AST Legend */
.ast-legend {
    margin-top: var(--space-sm);
    padding: var(--space-sm);
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: var(--radius-sm);
    font-size: var(--font-xs);
}

.ast-legend-title {
    color: var(--accent-cyan);
    margin-bottom: 4px;
    font-weight: bold;
}

.ast-legend-items {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-sm);
}

.ast-legend-item {
    display: flex;
    align-items: center;
    gap: 4px;
}

.ast-legend-shape {
    width: 12px;
    height: 12px;
    border-radius: 50%;
}

.ast-legend-shape.rect {
    border-radius: 2px;
}

.ast-legend-shape.diamond {
    transform: rotate(45deg);
}

/* ============================================
   PX-3: Enhanced Diff Viewer with Syntax Highlighting
   ============================================ */

/* Diff Statistics Summary */
.diff-stats-summary {
    display: flex;
    gap: var(--space-md);
    padding: var(--space-sm) var(--space-md);
    background: rgba(0, 0, 0, 0.3);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    margin-bottom: var(--space-sm);
    font-size: var(--font-sm);
    font-family: 'Courier New', monospace;
}

.diff-stat-item {
    padding: 2px var(--space-sm);
    border-radius: var(--radius-sm);
    font-weight: 600;
}

.diff-stat-item.added {
    background: rgba(76, 175, 80, 0.2);
    color: #4ec9b0;
    border: 1px solid rgba(76, 175, 80, 0.4);
}

.diff-stat-item.removed {
    background: rgba(244, 135, 113, 0.2);
    color: #f48771;
    border: 1px solid rgba(244, 135, 113, 0.4);
}

.diff-stat-item.modified {
    background: rgba(255, 215, 0, 0.2);
    color: #ffd700;
    border: 1px solid rgba(255, 215, 0, 0.4);
}

.diff-stat-item.unchanged {
    background: rgba(255, 255, 255, 0.05);
    color: var(--text-secondary);
    border: 1px solid rgba(255, 255, 255, 0.1);
}

/* Enhanced Diff Line Highlighting */
.diff-line.added {
    background: rgba(76, 175, 80, 0.15) !important;
    border-left: 3px solid #4ec9b0;
}

.diff-line.removed {
    background: rgba(244, 135, 113, 0.15) !important;
    border-left: 3px solid #f48771;
}

.diff-line.changed {
    background: rgba(255, 215, 0, 0.1) !important;
    border-left: 3px solid rgba(255, 215, 0, 0.5);
}

.diff-line.empty {
    background: rgba(0, 0, 0, 0.2) !important;
    opacity: 0.3;
}

/* Prism.js Syntax Highlighting Overrides for Dark Theme */
.line-content code[class*="language-"],
.line-content pre[class*="language-"],
.code-block code[class*="language-"],
.code-block pre[class*="language-"] {
    background: transparent !important;
    margin: 0;
    padding: 0;
    font-size: var(--font-sm);
    line-height: 1.5;
    text-shadow: none;
}

/* Token colors optimized for dark theme with diff viewer */
.token.comment,
.token.prolog,
.token.doctype,
.token.cdata {
    color: #6a9955;
}

.token.punctuation {
    color: #d4d4d4;
}

.token.property,
.token.tag,
.token.boolean,
.token.number,
.token.constant,
.token.symbol,
.token.deleted {
    color: #b5cea8;
}

.token.selector,
.token.attr-name,
.token.string,
.token.char,
.token.builtin,
.token.inserted {
    color: #ce9178;
}

.token.operator,
.token.entity,
.token.url,
.language-css .token.string,
.style .token.string {
    color: #d4d4d4;
}

.token.atrule,
.token.attr-value,
.token.keyword {
    color: #569cd6;
}

.token.function,
.token.class-name {
    color: #dcdcaa;
}

.token.regex,
.token.important,
.token.variable {
    color: #d16969;
}

/* Improved code block styling */
.code-block {
    font-family: 'Courier New', 'Consolas', monospace;
    font-size: var(--font-sm);
    line-height: 1.5;
    overflow-x: auto;
    background: rgba(0, 0, 0, 0.3);
}

/* Smooth transitions for diff changes */
.diff-line {
    transition: background var(--transition-fast), border-color var(--transition-fast);
}

.diff-line:hover {
    background: rgba(0, 255, 255, 0.05) !important;
}

/* Python REPL Panel Styles */
#python-repl-panel {
    grid-area: thoughts;
}

#python-repl-content {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
    height: 100%;
}

.repl-status {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-sm) var(--space-md);
    background: rgba(0, 255, 255, 0.03);
    border: 1px solid rgba(0, 255, 255, 0.1);
    border-radius: var(--radius-md);
}

.pyodide-status {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    font-size: var(--font-sm);
}

.pyodide-status .status-icon {
    font-size: var(--font-lg);
}

.repl-controls {
    display: flex;
    gap: var(--space-sm);
}

.repl-controls button {
    padding: var(--space-xs) var(--space-md);
    font-size: var(--font-xs);
    background: rgba(0, 255, 255, 0.05);
    border: 1px solid rgba(0, 255, 255, 0.2);
    color: var(--accent-cyan);
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all var(--transition-fast);
}

.repl-controls button:hover {
    background: rgba(0, 255, 255, 0.1);
    border-color: rgba(0, 255, 255, 0.4);
}

.repl-input-section,
.repl-output-section {
    background: rgba(0, 255, 255, 0.03);
    border: 1px solid rgba(0, 255, 255, 0.1);
    border-radius: var(--radius-md);
    padding: var(--space-md);
}

.repl-input-section h4,
.repl-output-section h4 {
    margin: 0 0 var(--space-sm) 0;
    font-size: var(--font-md);
    color: var(--accent-cyan);
}

.python-code-input {
    width: 100%;
    min-height: 120px;
    padding: var(--space-sm);
    font-family: 'Courier New', 'Consolas', monospace;
    font-size: var(--font-sm);
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(0, 255, 255, 0.2);
    border-radius: var(--radius-sm);
    color: var(--text-primary);
    resize: vertical;
    line-height: 1.5;
}

.python-code-input:focus {
    outline: none;
    border-color: rgba(0, 255, 255, 0.5);
    background: rgba(0, 0, 0, 0.4);
}

.repl-actions {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    margin-top: var(--space-sm);
}

.repl-actions button {
    padding: var(--space-sm) var(--space-lg);
    font-size: var(--font-sm);
    background: rgba(0, 255, 0, 0.1);
    border: 1px solid rgba(0, 255, 0, 0.3);
    color: var(--success);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all var(--transition-fast);
    font-weight: 600;
}

.repl-actions button:hover {
    background: rgba(0, 255, 0, 0.2);
    border-color: rgba(0, 255, 0, 0.5);
}

.repl-actions button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.repl-checkbox {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    font-size: var(--font-xs);
    color: var(--text-secondary);
    cursor: pointer;
    user-select: none;
}

.repl-checkbox input[type="checkbox"] {
    width: 14px;
    height: 14px;
    cursor: pointer;
}

.python-output {
    min-height: 200px;
    max-height: 400px;
    padding: var(--space-sm);
    font-family: 'Courier New', 'Consolas', monospace;
    font-size: var(--font-xs);
    background: rgba(0, 0, 0, 0.4);
    border: 1px solid rgba(0, 255, 255, 0.1);
    border-radius: var(--radius-sm);
    color: var(--text-primary);
    overflow-y: auto;
    white-space: pre-wrap;
    word-break: break-word;
    line-height: 1.6;
}

.python-output:empty::before {
    content: "Output will appear here...";
    color: var(--text-muted);
    font-style: italic;
}

.repl-result {
    margin-bottom: var(--space-md);
    padding: var(--space-sm);
    border-left: 3px solid rgba(0, 255, 255, 0.5);
    background: rgba(0, 255, 255, 0.02);
}

.repl-result-header {
    font-size: var(--font-xs);
    color: var(--text-muted);
    margin-bottom: var(--space-xs);
}

.repl-result-success {
    border-left-color: var(--success);
    background: var(--success-bg);
}

.repl-result-error {
    border-left-color: var(--error);
    background: var(--error-bg);
}

.repl-stdout {
    color: var(--text-primary);
}

.repl-stderr {
    color: var(--warning);
}

.repl-error {
    color: var(--error);
}

.repl-return-value {
    color: var(--accent-cyan);
    font-weight: 600;
}

.repl-execution-time {
    font-size: var(--font-xs);
    color: var(--text-muted);
    margin-top: var(--space-xs);
}

/* Package management modal */
.repl-package-modal {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 90%;
    max-width: 500px;
    background: var(--bg-secondary);
    border: 2px solid var(--border-primary);
    border-radius: var(--radius-lg);
    padding: var(--space-xl);
    z-index: 10000;
    box-shadow: 0 10px 50px rgba(0, 0, 0, 0.5);
}

.repl-package-modal h3 {
    margin: 0 0 var(--space-lg) 0;
    color: var(--accent-cyan);
}

.repl-package-input {
    display: flex;
    gap: var(--space-sm);
    margin-bottom: var(--space-lg);
}

.repl-package-input input {
    flex: 1;
    padding: var(--space-sm);
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(0, 255, 255, 0.2);
    border-radius: var(--radius-sm);
    color: var(--text-primary);
    font-size: var(--font-sm);
}

.repl-package-input button {
    padding: var(--space-sm) var(--space-lg);
    background: rgba(0, 255, 0, 0.1);
    border: 1px solid rgba(0, 255, 0, 0.3);
    color: var(--success);
    border-radius: var(--radius-sm);
    cursor: pointer;
}

.repl-package-list {
    max-height: 300px;
    overflow-y: auto;
    margin-bottom: var(--space-lg);
}

.repl-package-item {
    padding: var(--space-sm);
    background: rgba(0, 255, 255, 0.03);
    border: 1px solid rgba(0, 255, 255, 0.1);
    border-radius: var(--radius-sm);
    margin-bottom: var(--space-xs);
    font-size: var(--font-sm);
    color: var(--text-primary);
}

.repl-modal-close {
    padding: var(--space-sm) var(--space-lg);
    background: rgba(255, 0, 0, 0.1);
    border: 1px solid rgba(255, 0, 0, 0.3);
    color: var(--error);
    border-radius: var(--radius-sm);
    cursor: pointer;
}

/* Local LLM Panel Styles */
#local-llm-panel {
    grid-area: thoughts;
}

#local-llm-content {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
    height: 100%;
}

.llm-status {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-sm) var(--space-md);
    background: rgba(138, 43, 226, 0.05);
    border: 1px solid rgba(138, 43, 226, 0.2);
    border-radius: var(--radius-md);
}

.llm-status-display {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    font-size: var(--font-sm);
}

.llm-model-info {
    font-size: var(--font-xs);
    color: var(--text-secondary);
}

.llm-loading-section {
    background: rgba(138, 43, 226, 0.03);
    border: 1px solid rgba(138, 43, 226, 0.1);
    border-radius: var(--radius-md);
    padding: var(--space-md);
}

.llm-loading-section h4 {
    margin: 0 0 var(--space-sm) 0;
    font-size: var(--font-md);
    color: #8a2be2;
}

.llm-progress-bar {
    width: 100%;
    height: 20px;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(138, 43, 226, 0.3);
    border-radius: var(--radius-sm);
    overflow: hidden;
    margin-bottom: var(--space-sm);
}

.llm-progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #8a2be2, #9370db);
    transition: width 0.3s ease;
}

.llm-progress-text {
    font-size: var(--font-xs);
    color: var(--text-secondary);
    text-align: center;
}

.llm-controls-section,
.llm-test-section {
    background: rgba(138, 43, 226, 0.03);
    border: 1px solid rgba(138, 43, 226, 0.1);
    border-radius: var(--radius-md);
    padding: var(--space-md);
}

.llm-controls-section h4,
.llm-test-section h4 {
    margin: 0 0 var(--space-sm) 0;
    font-size: var(--font-md);
    color: #8a2be2;
}

.llm-model-selector {
    display: flex;
    gap: var(--space-sm);
    margin-bottom: var(--space-md);
}

.llm-model-selector select {
    flex: 1;
    padding: var(--space-sm);
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(138, 43, 226, 0.3);
    border-radius: var(--radius-sm);
    color: var(--text-primary);
    font-size: var(--font-sm);
}

.llm-model-selector button {
    padding: var(--space-sm) var(--space-lg);
    font-size: var(--font-sm);
    background: rgba(138, 43, 226, 0.2);
    border: 1px solid rgba(138, 43, 226, 0.4);
    color: #8a2be2;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all var(--transition-fast);
    font-weight: 600;
}

.llm-model-selector button:hover:not(:disabled) {
    background: rgba(138, 43, 226, 0.3);
    border-color: rgba(138, 43, 226, 0.6);
}

.llm-model-selector button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.llm-info {
    font-size: var(--font-xs);
    color: var(--text-secondary);
    padding: var(--space-sm);
    background: rgba(0, 0, 0, 0.2);
    border-radius: var(--radius-sm);
}

.llm-test-prompt {
    width: 100%;
    min-height: 80px;
    padding: var(--space-sm);
    font-family: 'Courier New', 'Consolas', monospace;
    font-size: var(--font-sm);
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(138, 43, 226, 0.2);
    border-radius: var(--radius-sm);
    color: var(--text-primary);
    resize: vertical;
    line-height: 1.5;
    margin-bottom: var(--space-sm);
}

.llm-test-prompt:focus {
    outline: none;
    border-color: rgba(138, 43, 226, 0.5);
    background: rgba(0, 0, 0, 0.4);
}

.llm-test-controls {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    margin-bottom: var(--space-md);
}

.llm-test-controls button {
    padding: var(--space-sm) var(--space-lg);
    font-size: var(--font-sm);
    background: rgba(138, 43, 226, 0.2);
    border: 1px solid rgba(138, 43, 226, 0.4);
    color: #8a2be2;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all var(--transition-fast);
    font-weight: 600;
}

.llm-test-controls button:hover:not(:disabled) {
    background: rgba(138, 43, 226, 0.3);
    border-color: rgba(138, 43, 226, 0.6);
}

.llm-test-controls button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.llm-checkbox {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    font-size: var(--font-xs);
    color: var(--text-secondary);
    cursor: pointer;
    user-select: none;
}

.llm-checkbox input[type="checkbox"] {
    width: 14px;
    height: 14px;
    cursor: pointer;
}

.llm-test-output {
    min-height: 150px;
    max-height: 300px;
    padding: var(--space-sm);
    font-family: 'Courier New', 'Consolas', monospace;
    font-size: var(--font-xs);
    background: rgba(0, 0, 0, 0.4);
    border: 1px solid rgba(138, 43, 226, 0.2);
    border-radius: var(--radius-sm);
    color: var(--text-primary);
    overflow-y: auto;
    white-space: pre-wrap;
    word-break: break-word;
    line-height: 1.6;
}

.llm-test-output:empty::before {
    content: "Output will appear here...";
    color: var(--text-muted);
    font-style: italic;
}

.llm-output-streaming {
    color: #8a2be2;
}

.llm-output-complete {
    color: var(--text-primary);
}

.llm-output-stats {
    margin-top: var(--space-sm);
    padding-top: var(--space-sm);
    border-top: 1px solid rgba(138, 43, 226, 0.2);
    font-size: var(--font-xs);
    color: var(--text-muted);
}

/* Empty State Messages */
.empty-state-message {
    color: var(--text-muted);
    font-size: var(--font-md);
    margin: var(--space-lg) 0 var(--space-sm);
    text-align: center;
    font-style: italic;
}

.empty-state-help {
    color: var(--text-secondary);
    font-size: var(--font-sm);
    text-align: center;
    padding: 0 var(--space-md);
    line-height: 1.5;
}

.goal-text-empty {
    color: var(--text-muted);
    font-style: italic;
}

.sentinel-empty .empty-state-message {
    margin-top: var(--space-sm);
}

/* Collapsible Panel Sections */
.panel-section {
    margin: var(--space-md) 0;
    background: var(--bg-panel);
    border: 1px solid var(--border-secondary);
    border-radius: var(--radius-md);
    overflow: hidden;
}

.section-toggle {
    width: 100%;
    display: flex;
    align-items: center;
    gap: var(--space-md);
    padding: var(--space-md) var(--space-lg);
    background: transparent;
    border: none;
    color: var(--text-primary);
    font-size: var(--font-md);
    font-weight: 500;
    cursor: pointer;
    transition: background var(--transition-fast);
}

.section-toggle:hover {
    background: var(--bg-hover);
}

.section-toggle[aria-expanded="true"] .section-icon {
    transform: rotate(90deg);
}

.section-icon {
    font-size: var(--font-sm);
    transition: transform var(--transition-normal);
}

.section-title {
    flex: 1;
    text-align: left;
}

.section-count {
    font-size: var(--font-sm);
    color: var(--text-secondary);
    background: var(--bg-secondary);
    padding: var(--space-xs) var(--space-sm);
    border-radius: var(--radius-sm);
}

.section-content {
    border-top: 1px solid var(--border-secondary);
    padding: var(--space-md);
    animation: slideDown var(--transition-normal) ease-out;
}

.section-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-sm);
}

.panel-switch-btn {
    padding: var(--space-sm) var(--space-md);
    background: var(--bg-secondary);
    border: 1px solid var(--border-primary);
    border-radius: var(--radius-sm);
    color: var(--text-primary);
    font-size: var(--font-sm);
    cursor: pointer;
    transition: all var(--transition-fast);
}

.panel-switch-btn:hover {
    background: var(--accent-cyan-dim);
    border-color: var(--accent-cyan);
    color: var(--accent-cyan);
}

.panel-switch-btn.active {
    background: var(--accent-cyan-bright);
    border-color: var(--accent-cyan);
    color: var(--accent-cyan);
    font-weight: 600;
}

@keyframes slideDown {
    from {
        opacity: 0;
        max-height: 0;
    }
    to {
        opacity: 1;
        max-height: 500px;
    }
}

/* Remove empty state messages when content is present */
#vfs-tree:not(:empty) .empty-state-message,
#vfs-tree:not(:empty) .empty-state-help,
#thought-stream:not(:empty) .empty-state-message,
#thought-stream:not(:empty) .empty-state-help,
#diff-viewer:not(:empty) .empty-state-message,
#diff-viewer:not(:empty) .empty-state-help,
#sentinel-content:not(.sentinel-empty) .empty-state-message,
#sentinel-content:not(.sentinel-empty) .empty-state-help {
    display: none;
}

/* Toggle Switch Styles */
.toggle-switch {
    position: relative;
    display: inline-block;
    width: 48px;
    height: 24px;
}

.toggle-switch input {
    opacity: 0;
    width: 0;
    height: 0;
}

.toggle-slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: #555;
    transition: 0.3s;
    border-radius: 24px;
}

.toggle-slider:before {
    position: absolute;
    content: "";
    height: 18px;
    width: 18px;
    left: 3px;
    bottom: 3px;
    background-color: white;
    transition: 0.3s;
    border-radius: 50%;
}

.toggle-switch input:checked + .toggle-slider {
    background-color: #4ec9b0;
}

.toggle-switch input:checked + .toggle-slider:before {
    transform: translateX(24px);
}

.toggle-switch input:focus + .toggle-slider {
    box-shadow: 0 0 1px #4ec9b0;
}
`;

    // ========================================================================

    const resolveProgressUrl = () => {
        const configured = config?.proxy?.websocketUrl ||
            config?.proxy?.wsUrl ||
            config?.proxy?.websocketPath ||
            config?.proxy?.websocket;

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        if (configured) {
            if (configured.startsWith('ws')) return configured;
            if (configured.startsWith('//')) return `${protocol}${configured}`;
            if (configured.startsWith('/')) return `${protocol}//${window.location.host}${configured}`;
            return `${protocol}//${configured}`;
        }

        const hostname = config?.proxy?.host || window.location.hostname || 'localhost';
        const port = config?.proxy?.port || 8000;
        return `${protocol}//${hostname}:${port}`;
    };

    const handleProgressMessage = (event) => {
        if (!event?.data) return;
        let payload;
        try {
            payload = JSON.parse(event.data);
        } catch (err) {
            logger.warn('[UI] Failed to parse progress event payload:', err);
            return;
        }

        if (payload?.type === 'PROGRESS_EVENT') {
            processProgressEvent(payload.data);
        } else if (payload?.source && payload?.event) {
            processProgressEvent(payload);
        }
    };

    const processProgressEvent = (payload = {}) => {
        if (!payload) return;
        try {
            EventBus.emit('progress:event', payload);
        } catch (err) {
            logger.warn('[UI] Failed to emit progress:event:', err);
        }
        logProgressEvent(payload);
        updateDiffFromProgress(payload);
        if (payload.source === 'arena' && payload.event === 'analytics' && payload.payload) {
            try {
                EventBus.emit('arena:analytics', payload.payload);
            } catch (err) {
                logger.warn('[UI] Failed to emit arena analytics event:', err);
            }
        }
    };

    const logProgressEvent = (payload) => {
        if (!payload?.event) return;
        const source = payload.source || 'agent';
        const status = payload.status ? ` [${payload.status}]` : '';
        const target = payload.path ? ` ${payload.path}` : '';
        logToAdvanced({
            message: `${source} ${payload.event}${target}${status}`,
            level: 'cycle',
            details: payload
        });
    };

    const updateDiffFromProgress = (payload) => {
        if (!window.DiffViewerUI || typeof window.DiffViewerUI.getCurrentDiff !== 'function') {
            return;
        }

        const current = window.DiffViewerUI.getCurrentDiff();
        if (!current || !Array.isArray(current.changes)) {
            return;
        }

        const cloneAndRefresh = () => {
            const cloned = current.changes.map(change => ({ ...change }));
            window.DiffViewerUI.refresh({ changes: cloned });
        };

        if (payload.source === 'dogs') {
            if (payload.event === 'apply:start') {
                current.changes.forEach(change => {
                    if (change.approved) {
                        change.status = 'applying';
                    }
                });
                cloneAndRefresh();
                return;
            }

            if (payload.event === 'apply:file' && payload.path) {
                const target = current.changes.find(change => change.file_path === payload.path);
                if (target) {
                    target.status = payload.status || 'applying';
                    cloneAndRefresh();
                }
                return;
            }

            if (payload.event === 'session:complete') {
                current.changes.forEach(change => {
                    if (payload.status === 'success') {
                        if (change.approved) {
                            change.status = 'success';
                        }
                    } else if (payload.status === 'error' && change.status === 'applying') {
                        change.status = 'error';
                    }
                });
                cloneAndRefresh();
                return;
            }

            if (payload.event === 'apply:complete') {
                current.changes.forEach(change => {
                    if (change.status === 'applying') {
                        change.status = 'success';
                    }
                });
                cloneAndRefresh();
                return;
            }
        }
    };

    const setupProgressStream = () => {
        // Progress streaming is disabled - server only has /signaling WebSocket for WebRTC
        logger.debug('[UI] Progress streaming disabled (not supported by server)');
        return;
    };

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

    // Helper to check if modular panel is enabled
    const isModularPanelEnabled = (panelName) => {
        try {
            const flags = window.reploidConfig?.featureFlags?.useModularPanels;
            return flags && flags[panelName] === true;
        } catch (err) {
            return false;
        }
    };

    // Initialize modular panel support (CLUSTER 1 + CLUSTER 2)
    const initializeModularPanels = () => {
        logger.info('[UIManager] Initializing modular panel support...');

        // CLUSTER 1 Panels
        if (ProgressTracker && isModularPanelEnabled('ProgressTracker')) {
            try {
                ProgressTracker.init('progress-tracker-container');
                logger.info('[UIManager] ProgressTracker modular panel initialized');
            } catch (err) {
                logger.error('[UIManager] Failed to initialize ProgressTracker:', err);
            }
        }

        if (LogPanel && isModularPanelEnabled('LogPanel')) {
            try {
                LogPanel.init('log-panel-container');
                logger.info('[UIManager] LogPanel modular panel initialized');
            } catch (err) {
                logger.error('[UIManager] Failed to initialize LogPanel:', err);
            }
        }

        if (StatusBar && isModularPanelEnabled('StatusBar')) {
            try {
                StatusBar.init('status-bar-container');
                logger.info('[UIManager] StatusBar modular panel initialized');
            } catch (err) {
                logger.error('[UIManager] Failed to initialize StatusBar:', err);
            }
        }

        // CLUSTER 2 Panels
        if (ThoughtPanel && isModularPanelEnabled('ThoughtPanel')) {
            try {
                ThoughtPanel.init('thought-panel-container');
                logger.info('[UIManager] ThoughtPanel modular panel initialized');
            } catch (err) {
                logger.error('[UIManager] Failed to initialize ThoughtPanel:', err);
            }
        }

        if (GoalPanel && isModularPanelEnabled('GoalPanel')) {
            try {
                GoalPanel.init('goal-panel-container');
                logger.info('[UIManager] GoalPanel modular panel initialized');
            } catch (err) {
                logger.error('[UIManager] Failed to initialize GoalPanel:', err);
            }
        }

        if (SentinelPanel && isModularPanelEnabled('SentinelPanel')) {
            try {
                SentinelPanel.init('sentinel-panel-container');
                logger.info('[UIManager] SentinelPanel modular panel initialized');
            } catch (err) {
                logger.error('[UIManager] Failed to initialize SentinelPanel:', err);
            }
        }

        logger.info('[UIManager] Modular panel initialization complete');
    };

    const init = async () => {
        logger.info("Dashboard UI Manager (Event-Driven) taking control of DOM...");
        bootConfig = window.REPLOID_BOOT_CONFIG || {};

        const bootContainer = document.getElementById('boot-container');
        if (bootContainer) bootContainer.remove();
        
        document.body.style = "";

        setupProgressStream();

        const [bodyTemplate, styleContent] = await Promise.all([
            Promise.resolve(DASHBOARD_HTML),
            Promise.resolve(UI_CORE_CSS)
        ]);

        const appRoot = document.getElementById('app-root');
        appRoot.innerHTML = bodyTemplate;
        appRoot.style.display = 'block';

        const styleEl = document.createElement('style');
        styleEl.textContent = styleContent;
        document.head.appendChild(styleEl);

        initializeUIElementReferences();
        setupEventListeners();
        setupEventBusListeners(); // New setup for event listeners
        checkPersonaMode();
        if (ToastNotifications) ToastNotifications.init(); // Initialize toast system
        initializeModularPanels(); // Initialize modular panel support
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
                uiRefs.pyodideStatusIcon.textContent = '●';
                uiRefs.pyodideStatusText.textContent = `Error: ${error.message}`;
            } else if (isReady) {
                uiRefs.pyodideStatusIcon.textContent = '○';
                uiRefs.pyodideStatusText.textContent = 'Ready';
            } else {
                uiRefs.pyodideStatusIcon.textContent = '○';
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
                        syncBtn.textContent = '↻ Sync VFS';
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
                uiRefs.llmStatusIcon.textContent = '●';
                uiRefs.llmStatusText.textContent = `Error: ${status.error}`;
            } else if (status.ready) {
                uiRefs.llmStatusIcon.textContent = '○';
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
                uiRefs.llmStatusIcon.textContent = '○';
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
                statusDiv.innerHTML = `✓ WebGPU available (${gpuCheck.info?.vendor || 'Unknown'})`;
                statusDiv.style.color = '#0f0';
            } else {
                statusDiv.innerHTML = `✗ WebGPU not available: ${gpuCheck.error}`;
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
                        <button id="graph-reset-btn" style="margin-left: auto; padding: 4px 12px; background: rgba(0, 255, 255, 0.1); border: 1px solid rgba(0, 255, 255, 0.3); color: #00ffff; border-radius: 4px; cursor: pointer;">↻ Reset View</button>
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
            "status-icon", "status-state", "status-detail", "status-progress", "progress-fill",
            "performance-panel", "perf-session", "perf-llm", "perf-memory", "perf-tools",
            "introspection-panel", "intro-modules", "intro-tools", "intro-capabilities",
            "reflections-panel", "refl-summary", "refl-patterns", "refl-recent",
            "self-test-panel", "test-summary", "test-suites", "test-history",
            "browser-apis-panel", "api-capabilities", "filesystem-status", "notifications-status",
            "storage-estimate", "filesystem-sync-btn", "notifications-test-btn",
            "agent-visualizer-panel", "agent-visualizer-container",
            "ast-visualizer-panel", "ast-viz-container", "ast-code-input",
            "python-repl-panel", "python-code-input", "python-output", "pyodide-status-icon", "pyodide-status-text",
            "local-llm-panel", "llm-status-icon", "llm-status-text", "llm-current-model",
            "sentinel-content", "sentinel-approve-btn", "sentinel-revise-btn",
            "agent-progress-tracker", "progress-steps"
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
                    perfRefreshBtn.textContent = '↻ Refresh';
                }, 1000);
            });
        }

        if (perfExportBtn && PerformanceMonitor) {
            perfExportBtn.addEventListener('click', async () => {
                try {
                    const report = PerformanceMonitor.generateReport();
                    exportAsMarkdown(`performance-report-${Date.now()}.md`, report);
                    logger.info('[UIManager] Exported performance report');
                    showButtonSuccess(perfExportBtn, '⛃ Export Report', '✓ Exported!');
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
                    introRefreshBtn.textContent = '↻ Refresh';
                }, 1000);
            });
        }

        if (introExportBtn && Introspector) {
            introExportBtn.addEventListener('click', async () => {
                try {
                    const report = await Introspector.generateSelfReport();
                    exportAsMarkdown(`self-analysis-report-${Date.now()}.md`, report);
                    logger.info('[UIManager] Exported self-analysis report');
                    showButtonSuccess(introExportBtn, '⛃ Export Report', '✓ Exported!');
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
                showButtonSuccess(introGraphBtn, '⚌️ Module Graph', '✓ Opened!');
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
                    reflRefreshBtn.textContent = '↻ Refresh';
                }, 1000);
            });
        }

        if (reflExportBtn && ReflectionStore) {
            reflExportBtn.addEventListener('click', async () => {
                try {
                    const report = await ReflectionStore.generateReport();
                    exportAsMarkdown(`reflections-report-${Date.now()}.md`, report);
                    logger.info('[UIManager] Exported reflections report');
                    showButtonSuccess(reflExportBtn, '⛃ Export Report', '✓ Exported!');
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
                            reflClearBtn.textContent = '⛶️ Clear Old';
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
                    showButtonSuccess(testExportBtn, '⛃ Export Report', '✓ Exported!');
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
                    testRefreshBtn.textContent = '↻ Refresh';
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
                const originalText = '⛃ Sync VFS';
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
                    storageRefreshBtn.textContent = '↻ Refresh';
                }, 1000);
            });
        }

        if (storagePersistBtn && BrowserAPIs) {
            storagePersistBtn.addEventListener('click', async () => {
                const isPersisted = await BrowserAPIs.requestPersistentStorage();
                storagePersistBtn.textContent = isPersisted ? '✓ Persistent' : '✗ Not Persistent';
                setTimeout(() => {
                    storagePersistBtn.textContent = '⛝ Request Persistent';
                }, 2000);
            });
        }

        if (apiExportBtn && BrowserAPIs) {
            apiExportBtn.addEventListener('click', async () => {
                try {
                    const report = BrowserAPIs.generateReport();
                    exportAsMarkdown(`browser-apis-report-${Date.now()}.md`, report);
                    logger.info('[UIManager] Exported browser APIs report');
                    showButtonSuccess(apiExportBtn, '⛃ Export Report', '✓ Exported!');
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
                    showButtonSuccess(avisResetBtn, '↻ Reset', '✓ Reset!');
                }
            });
        }

        if (avisCenterBtn && AgentVisualizer) {
            avisCenterBtn.addEventListener('click', () => {
                if (agentVisualizerInitialized) {
                    AgentVisualizer.centerView();
                    showButtonSuccess(avisCenterBtn, '⊙ Center', '✓ Centered!');
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
                    showButtonSuccess(astVisualizeBtn, '⌕ Visualize', '✓ Visualized!');
                }
            });
        }

        if (astExpandBtn && ASTVisualizer) {
            astExpandBtn.addEventListener('click', () => {
                ASTVisualizer.expandAll();
                showButtonSuccess(astExpandBtn, '⊕ Expand All', '✓ Expanded!');
            });
        }

        if (astCollapseBtn && ASTVisualizer) {
            astCollapseBtn.addEventListener('click', () => {
                ASTVisualizer.collapseAll();
                showButtonSuccess(astCollapseBtn, '⊖ Collapse All', '✓ Collapsed!');
            });
        }

        if (astResetBtn && astCodeInput) {
            astResetBtn.addEventListener('click', () => {
                astCodeInput.value = `// Example: Function declaration
function greet(name) {
  return \`Hello, \${name}!\`;
}`;
                showButtonSuccess(astResetBtn, '↻ Reset', '✓ Reset!');
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
        // Collapsible section toggles
        document.querySelectorAll('.section-toggle').forEach(toggle => {
            toggle.addEventListener('click', () => {
                const section = toggle.dataset.section;
                const content = document.getElementById(`${section}-section`);
                const isExpanded = toggle.getAttribute('aria-expanded') === 'true';

                if (isExpanded) {
                    content.style.display = 'none';
                    toggle.setAttribute('aria-expanded', 'false');
                } else {
                    content.style.display = 'block';
                    toggle.setAttribute('aria-expanded', 'true');
                }
            });
        });

        // Panel switch buttons
        document.querySelectorAll('.panel-switch-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const panel = btn.dataset.panel;

                // Remove active class from all buttons
                document.querySelectorAll('.panel-switch-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // Hide all special panels, show main three
                showOnlyPanel(null);

                // Switch to requested panel
                switch(panel) {
                    case 'logs':
                        isLogView = true;
                        showOnlyPanel(uiRefs.advancedLogPanel);
                        break;
                    case 'performance':
                        isPerfView = true;
                        showOnlyPanel(uiRefs.performancePanel);
                        renderPerformancePanel();
                        break;
                    case 'introspection':
                        isIntroView = true;
                        showOnlyPanel(uiRefs.introspectionPanel);
                        await renderIntrospectionPanel();
                        break;
                    case 'reflections':
                        isReflView = true;
                        showOnlyPanel(uiRefs.reflectionsPanel);
                        await renderReflectionsPanel();
                        break;
                    case 'tests':
                        isTestView = true;
                        showOnlyPanel(uiRefs.selfTestPanel);
                        await renderSelfTestPanel();
                        break;
                    case 'apis':
                        isApiView = true;
                        showOnlyPanel(uiRefs.browserApisPanel);
                        await renderBrowserAPIsPanel();
                        break;
                    case 'python':
                        isPyReplView = true;
                        showOnlyPanel(uiRefs.pythonReplPanel);
                        renderPythonReplPanel();
                        break;
                    case 'llm':
                        isLlmView = true;
                        showOnlyPanel(uiRefs.localLlmPanel);
                        await renderLocalLLMPanel();
                        break;
                    case 'ast':
                        isAstvView = true;
                        showOnlyPanel(uiRefs.astVisualizerPanel);
                        renderASTVisualizerPanel();
                        break;
                    case 'agent-viz':
                        isAvisView = true;
                        showOnlyPanel(uiRefs.agentVisualizerPanel);
                        renderAgentVisualizerPanel();
                        break;
                    case 'canvas-viz':
                        // Canvas viz logic here
                        break;
                }

                savePanelState();
            });
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
            if (themeBtn) themeBtn.textContent = '☾';
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

    const updateStatusBar = (state, detail, progress) => {
        // Skip monolithic implementation if modular panel is enabled
        if (isModularPanelEnabled('StatusBar')) return;

        // Update state text and icon
        if (uiRefs.statusState) {
            uiRefs.statusState.textContent = state || 'IDLE';
        }

        // Update status icon based on state (non-emoji unicode only)
        if (uiRefs.statusIcon) {
            const icons = {
                'IDLE': '○',
                'CURATING_CONTEXT': '⚙',
                'AWAITING_CONTEXT_APPROVAL': '⏸',
                'PLANNING_WITH_CONTEXT': '⚙',
                'GENERATING_PROPOSAL': '⚙',
                'AWAITING_PROPOSAL_APPROVAL': '⏸',
                'APPLYING_CHANGESET': '▶',
                'REFLECTING': '◐',
                'ERROR': '⚠'
            };
            uiRefs.statusIcon.textContent = icons[state] || '○';
        }

        // Update detail text
        if (uiRefs.statusDetail && detail !== null && detail !== undefined) {
            uiRefs.statusDetail.textContent = detail || '';
        }

        // Update progress bar
        if (uiRefs.statusProgress && uiRefs.progressFill) {
            if (progress !== null && progress !== undefined) {
                uiRefs.statusProgress.style.display = 'block';
                uiRefs.progressFill.style.width = `${progress}%`;
                uiRefs.statusProgress.setAttribute('aria-valuenow', progress);
            } else {
                uiRefs.statusProgress.style.display = 'none';
            }
        }
    };

    const setupEventBusListeners = () => {
        // Listen to FSM state changes
        EventBus.on('fsm:state:changed', (data) => {
            handleStateChange({ newState: data.newState, context: data.context });
        });

        // Listen to status updates
        EventBus.on('status:updated', (data) => {
            updateStatusBar(data.state, data.detail, data.progress);
        });

        // Legacy event name support
        EventBus.on('agent:state:change', handleStateChange);
    };

    const updateProgressTracker = (currentState) => {
        // Skip monolithic implementation if modular panel is enabled
        if (isModularPanelEnabled('ProgressTracker')) return;

        if (!uiRefs.progressSteps) return;

        const steps = [
            { state: 'IDLE', icon: '○', label: 'Idle' },
            { state: 'CURATING_CONTEXT', icon: '⚙', label: 'Curating' },
            { state: 'AWAITING_CONTEXT_APPROVAL', icon: '⏸', label: 'Approve Context' },
            { state: 'PLANNING_WITH_CONTEXT', icon: '◐', label: 'Planning' },
            { state: 'GENERATING_PROPOSAL', icon: '✎', label: 'Generating' },
            { state: 'AWAITING_PROPOSAL_APPROVAL', icon: '⏸', label: 'Approve Proposal' },
            { state: 'APPLYING_CHANGESET', icon: '▶', label: 'Applying' },
            { state: 'REFLECTING', icon: '◐', label: 'Reflecting' }
        ];

        const currentIndex = steps.findIndex(s => s.state === currentState);

        uiRefs.progressSteps.innerHTML = steps.map((step, index) => {
            let className = 'progress-step';
            if (index < currentIndex) className += ' completed';
            if (index === currentIndex) className += ' active';

            return `
                <div class="${className}">
                    <span class="step-icon">${step.icon}</span>
                    <span class="step-label">${step.label}</span>
                </div>
            `;
        }).join('');
    };

    const handleStateChange = async ({ newState, context }) => {
        // Skip monolithic implementation if modular panel is enabled
        if (isModularPanelEnabled('SentinelPanel')) {
            // Still update progress tracker if it's not using modular panel
            updateProgressTracker(newState);
            return;
        }

        const sentinelContent = uiRefs.sentinelContent;
        const approveBtn = uiRefs.sentinelApproveBtn;
        const reviseBtn = uiRefs.sentinelReviseBtn;

        // Update progress tracker
        updateProgressTracker(newState);

        // Hide all actions by default
        approveBtn.classList.add('hidden');
        reviseBtn.classList.add('hidden');
        sentinelContent.innerHTML = '';
        // Remove empty state class when showing actual content
        sentinelContent.classList.remove('sentinel-empty');

        switch (newState) {
            case 'AWAITING_CONTEXT_APPROVAL':
                const contextPath = context?.turn?.context_path || context?.catsPath || 'unknown';
                const contextFileName = contextPath.split('/').pop();
                sentinelContent.innerHTML = `<h4>Review Context (${contextFileName})</h4><p>Agent wants to read the following files:</p>`;
                const catsContent = await StateManager.getArtifactContent(contextPath);
                sentinelContent.innerHTML += `<pre>${catsContent || 'No content available'}</pre>`;
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
        // Skip monolithic implementation if modular panel is enabled
        if (isModularPanelEnabled('GoalPanel')) return;

        logger.info('[UI] updateGoal called with:', { text, hasGoalTextRef: !!uiRefs.goalText });

        if (uiRefs.goalText) {
            uiRefs.goalText.textContent = text;
            // Remove empty state class when goal is set
            if (text && text.trim()) {
                uiRefs.goalText.classList.remove('goal-text-empty');
            } else {
                uiRefs.goalText.classList.add('goal-text-empty');
            }
            logger.info('[UI] Goal text element updated successfully');
        } else {
            logger.error('[UI] goalText ref is null - element not found');
            // Try direct DOM access as fallback
            const goalEl = document.getElementById('goal-text');
            if (goalEl) {
                logger.warn('[UI] Using fallback direct DOM access');
                goalEl.textContent = text;
                if (text && text.trim()) {
                    goalEl.classList.remove('goal-text-empty');
                } else {
                    goalEl.classList.add('goal-text-empty');
                }
            } else {
                logger.error('[UI] goal-text element not found in DOM');
            }
        }
        logToAdvanced(`Goal Updated: ${text}`, 'goal_modified');
    };

    const streamThought = (textChunk) => {
        // Skip monolithic implementation if modular panel is enabled
        if (isModularPanelEnabled('ThoughtPanel')) return;

        if (isLogView) return;
        if (uiRefs.thoughtStream) {
            // Clear empty state messages on first thought
            const emptyMessages = uiRefs.thoughtStream.querySelectorAll('.empty-state-message, .empty-state-help');
            emptyMessages.forEach(msg => msg.remove());
            uiRefs.thoughtStream.textContent += textChunk;
        }
    };
    
    const clearThoughts = () => {
        // Skip monolithic implementation if modular panel is enabled
        if (isModularPanelEnabled('ThoughtPanel')) return;

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
        // Skip monolithic implementation if modular panel is enabled
        if (isModularPanelEnabled('LogPanel')) return;

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

    // UI Manager statistics for widget
    const uiStats = {
      panelSwitches: 0,
      progressEventsReceived: 0,
      thoughtUpdates: 0,
      goalUpdates: 0,
      statusBarUpdates: 0,
      lastActivity: null,
      panelUsage: {},
      currentPanel: null,
      sessionStart: Date.now()
    };

    // Wrap streamThought to track stats
    const wrappedStreamThought = (...args) => {
      uiStats.thoughtUpdates++;
      uiStats.lastActivity = Date.now();
      return streamThought(...args);
    };

    // Wrap updateGoal to track stats
    const wrappedUpdateGoal = (...args) => {
      uiStats.goalUpdates++;
      uiStats.lastActivity = Date.now();
      return updateGoal(...args);
    };

    // Wrap updateStatusBar to track stats
    const wrappedUpdateStatusBar = (...args) => {
      uiStats.statusBarUpdates++;
      uiStats.lastActivity = Date.now();
      return updateStatusBar(...args);
    };

    // Track progress events
    EventBus.on('progress:event', () => {
      uiStats.progressEventsReceived++;
      uiStats.lastActivity = Date.now();
    });

    // Track panel switches
    EventBus.on('panel:switch', (data) => {
      uiStats.panelSwitches++;
      uiStats.lastActivity = Date.now();
      if (data && data.panel) {
        uiStats.currentPanel = data.panel;
        uiStats.panelUsage[data.panel] = (uiStats.panelUsage[data.panel] || 0) + 1;
      }
    });

    // Web Component Widget (defined inside factory to access closure state)
    class UIManagerWidget extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this._updateInterval = null;
      }

      set moduleApi(api) {
        this._api = api;
        this.render();
      }

      connectedCallback() {
        this.render();
        // Auto-refresh every 5 seconds for real-time stats
        this._updateInterval = setInterval(() => this.render(), 5000);
      }

      disconnectedCallback() {
        if (this._updateInterval) {
          clearInterval(this._updateInterval);
          this._updateInterval = null;
        }
      }

      getStatus() {
        const hasRecentActivity = uiStats.lastActivity &&
          (Date.now() - uiStats.lastActivity < 30000);
        const totalUpdates = uiStats.thoughtUpdates + uiStats.goalUpdates + uiStats.statusBarUpdates;

        return {
          state: hasRecentActivity ? 'active' : (totalUpdates > 0 ? 'idle' : 'disabled'),
          primaryMetric: uiStats.currentPanel
            ? `Panel: ${uiStats.currentPanel}`
            : totalUpdates > 0
              ? `${totalUpdates} updates`
              : 'Ready',
          secondaryMetric: uiStats.progressEventsReceived > 0
            ? `${uiStats.progressEventsReceived} events`
            : 'Idle',
          lastActivity: uiStats.lastActivity,
          message: hasRecentActivity ? 'Active' : null
        };
      }

      getControls() {
        return [
          {
            id: 'panel-thoughts',
            label: '☁ Thoughts Panel',
            action: () => {
              EventBus.emit('panel:switch', { panel: 'thoughts' });
              return { success: true, message: 'Switched to thoughts panel' };
            }
          },
          {
            id: 'panel-performance',
            label: '☱ Performance Panel',
            action: () => {
              EventBus.emit('panel:switch', { panel: 'performance' });
              return { success: true, message: 'Switched to performance panel' };
            }
          },
          {
            id: 'panel-logs',
            label: '✎ Logs Panel',
            action: () => {
              EventBus.emit('panel:switch', { panel: 'logs' });
              return { success: true, message: 'Switched to logs panel' };
            }
          }
        ];
      }

      renderPanel() {
        const uptime = Date.now() - uiStats.sessionStart;
        const uptimeMinutes = Math.floor(uptime / 60000);
        const totalUpdates = uiStats.thoughtUpdates + uiStats.goalUpdates + uiStats.statusBarUpdates;

        let html = '<div style="font-family: monospace; font-size: 12px;">';

        // Update summary
        html += '<div style="margin-bottom: 12px;">';
        html += '<div style="color: #0ff; font-weight: bold; margin-bottom: 8px;">UI Activity</div>';
        html += `<div style="color: #e0e0e0;">Total Updates: <span style="color: #0ff;">${totalUpdates}</span></div>`;
        html += `<div style="color: #e0e0e0;">Panel Switches: <span style="color: #0ff;">${uiStats.panelSwitches}</span></div>`;
        html += `<div style="color: #e0e0e0;">Progress Events: <span style="color: #0ff;">${uiStats.progressEventsReceived}</span></div>`;
        html += `<div style="color: #aaa; font-size: 10px;">Uptime: ${uptimeMinutes} min</div>`;
        html += '</div>';

        // Update breakdown
        if (totalUpdates > 0) {
          html += '<div style="margin-bottom: 12px; padding: 8px; background: rgba(0,255,255,0.05); border: 1px solid rgba(0,255,255,0.2);">';
          html += '<div style="color: #0ff; font-weight: bold; margin-bottom: 4px;">Update Breakdown</div>';
          if (uiStats.thoughtUpdates > 0) {
            html += `<div style="color: #aaa;">Thought Updates: <span style="color: #fff;">${uiStats.thoughtUpdates}</span></div>`;
          }
          if (uiStats.goalUpdates > 0) {
            html += `<div style="color: #aaa;">Goal Updates: <span style="color: #fff;">${uiStats.goalUpdates}</span></div>`;
          }
          if (uiStats.statusBarUpdates > 0) {
            html += `<div style="color: #aaa;">Status Bar Updates: <span style="color: #fff;">${uiStats.statusBarUpdates}</span></div>`;
          }
          html += '</div>';
        }

        // Current panel
        if (uiStats.currentPanel) {
          html += '<div style="margin-bottom: 12px; padding: 8px; background: rgba(0,255,255,0.05); border: 1px solid rgba(0,255,255,0.2);">';
          html += '<div style="color: #0ff; font-weight: bold; margin-bottom: 4px;">Current Panel</div>';
          html += `<div style="color: #fff; font-size: 14px;">${uiStats.currentPanel}</div>`;
          html += '</div>';
        }

        // Panel usage statistics
        if (Object.keys(uiStats.panelUsage).length > 0) {
          html += '<div style="margin-bottom: 12px;">';
          html += '<div style="color: #0ff; font-weight: bold; margin-bottom: 8px;">Panel Usage</div>';
          html += '<div style="max-height: 120px; overflow-y: auto;">';
          const sortedPanels = Object.entries(uiStats.panelUsage)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);
          sortedPanels.forEach(([panel, count]) => {
            const percentage = ((count / uiStats.panelSwitches) * 100).toFixed(1);
            html += `<div style="padding: 3px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">`;
            html += `<div style="display: flex; justify-content: space-between;">`;
            html += `<span style="color: #fff; font-size: 11px;">${panel}</span>`;
            html += `<span style="color: #888; font-size: 10px;">${count} (${percentage}%)</span>`;
            html += `</div>`;
            html += `<div style="margin-top: 2px; background: rgba(0,0,0,0.3); height: 4px; border-radius: 2px; overflow: hidden;">`;
            html += `<div style="background: #0ff; height: 100%; width: ${percentage}%;"></div>`;
            html += '</div></div>';
          });
          html += '</div></div>';
        }

        // Connection status
        const wsConnected = progressSocket && progressSocket.readyState === WebSocket.OPEN;
        html += '<div style="margin-top: 12px; padding: 8px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1);">';
        html += '<div style="color: #888; font-weight: bold; margin-bottom: 4px; font-size: 10px;">Connection Status</div>';
        html += `<div style="color: ${wsConnected ? '#0f0' : '#f00'}; font-size: 11px;">`;
        html += `WebSocket: ${wsConnected ? '✓ Connected' : '✗ Disconnected'}`;
        html += '</div>';
        html += '</div>';

        if (totalUpdates === 0) {
          html += '<div style="color: #888; text-align: center; margin-top: 20px;">No UI activity yet</div>';
        }

        html += '</div>';
        return html;
      }

      render() {
        this.shadowRoot.innerHTML = `
          <style>
            :host {
              display: block;
              font-family: monospace;
              font-size: 12px;
              color: #ccc;
            }
          </style>

          ${this.renderPanel()}
        `;
      }
    }

    // Define custom element
    const elementName = 'ui-manager-widget';
    if (!customElements.get(elementName)) {
      customElements.define(elementName, UIManagerWidget);
    }

    return {
      init,
      updateGoal: wrappedUpdateGoal,
      api: {
        updateGoal: wrappedUpdateGoal,
        streamThought: wrappedStreamThought,
        updateStatusBar: wrappedUpdateStatusBar
      },
      widget: {
        element: elementName,
        displayName: 'UI Manager',
        icon: '⌨️',
        category: 'ui',
        order: 5,
        updateInterval: 5000
      }
    };
  }
};

// Export standardized module
UI;
