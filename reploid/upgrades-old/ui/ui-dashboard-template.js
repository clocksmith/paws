/**
 * @fileoverview UI Dashboard HTML Template Module
 * Pure module containing dashboard HTML template string
 * Extracted from ui-manager.js monolith
 *
 * @module UIDashboardTemplate
 * @version 1.0.0
 * @category ui
 */

const UIDashboardTemplate = {
  metadata: {
    id: 'UIDashboardTemplate',
    version: '1.0.0',
    description: 'Dashboard HTML template for REPLOID UI',
    dependencies: [],  // Pure module - no dependencies
    async: false,
    type: 'pure'
  },

  factory: (deps = {}) => {
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

    // Public API
    return {
      getDashboardHTML: () => DASHBOARD_HTML,

      // For direct access (backward compatibility)
      DASHBOARD_HTML
    };
  }
};

// Export for module loader
export default UIDashboardTemplate;
