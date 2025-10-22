# Blueprint 0x00006E: Browser-Native Multi-Model Arena

**Objective:** Enable browser-native multi-model competitive testing for REPLOID without requiring Node.js proxy or Python CLI, making Arena a first-class citizen in the RSI workflow.

**Target Upgrade:** AREN (`multi-model-arena.js`)

**Prerequisites:**
- **0x00004E** (Module Widget Protocol) - REQUIRED for widget implementation
- HYBR (Hybrid LLM Provider) - For multi-model inference
- VRFY (Verification Manager) - For Web Worker-based testing
- STMT (State Manager) - For VFS snapshots
- PAXA (Penteract Analytics) - For telemetry collection
- WRTC (WebRTC Coordinator) - Optional for distributed testing

**Affected Artifacts:** `/upgrades/multi-model-paxos.js`, `/tests/unit/multi-model-paxos.test.js`, `/config.json`

**Category:** RSI/Competition

---

## 1. The Strategic Imperative

**The Problem:**

Current Arena implementation (`arena_tool.js`) is NOT truly browser-native:

```javascript
// Current approach (arena_tool.js):
async function runPawsArenaWorkflow(objective) {
  // 1. Call Node.js proxy server
  const response = await fetch('/api/arena', { method: 'POST', body: JSON.stringify({ objective }) });

  // 2. Server spawns Python CLI: paws-arena
  // 3. Python script:
  //    - Creates 3+ real git worktrees
  //    - Runs LLM models via API
  //    - Executes shell commands for testing
  //    - Compares results
  // 4. Send results back via WebSocket

  // Total: Requires Node.js server + Python + Git + Shell access
}
```

**Limitations:**
- ❌ Requires Node.js server running (not pure browser)
- ❌ Requires Python environment
- ❌ Requires Git worktrees (filesystem access)
- ❌ Requires shell command execution
- ❌ Cannot work in pure browser environment
- ❌ No integration with REPLOID's VFS
- ❌ No Web Worker-based verification
- ❌ No WebRTC distribution capabilities

**The Vision:**

Make Arena a **first-class RSI capability** that runs entirely in the browser:

```javascript
// New approach (multi-model-arena.js):
async function runBrowserArena(objective, config) {
  // 1. Create VFS snapshots (no git needed)
  const snapshot = await StateManager.createSnapshot();

  // 2. Run multiple models in parallel (via HybridLLMProvider)
  const solutions = await Promise.all([
    generateSolution(objective, 'gemini-2.5-flash'),
    generateSolution(objective, 'claude-haiku-4-5'),
    generateSolution(objective, 'gpt-5-mini')
  ]);

  // 3. Verify solutions in Web Workers (sandboxed)
  const results = await Promise.all(
    solutions.map(sol => VerificationManager.verifySolution(sol))
  );

  // 4. Select winner based on test results
  const winner = selectBestSolution(results);

  // 5. Optional: Distribute across WebRTC swarm
  if (config.useSwarm) {
    await distributeToSwarm(solutions);
  }

  // Total: 100% browser-native, no external dependencies
}
```

**Benefits:**
- ✅ 100% browser-native (works offline)
- ✅ Uses VFS snapshots (no filesystem access needed)
- ✅ Web Worker verification (sandboxed safety)
- ✅ Integrates with HybridLLMProvider (supports Gemini, Claude, GPT, local)
- ✅ Optional WebRTC distribution (scale across tabs/browsers)
- ✅ Telemetry integration with PAXA
- ✅ First-class RSI capability (no proxy needed)

---

## 2. The Architectural Solution

### 2.1 Core Architecture

**Arena Workflow (Browser-Native):**

```
┌─────────────────────────────────────────────────────────────┐
│                   MULTI-MODEL ARENA ENGINE                  │
└─────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┴─────────────┐
                │                           │
        ┌───────▼────────┐          ┌──────▼───────┐
        │  Parallel      │          │  VFS         │
        │  Generation    │          │  Snapshot    │
        └───────┬────────┘          └──────┬───────┘
                │                           │
        ┌───────▼────────┐          ┌──────▼───────┐
        │ HybridLLM      │          │ Isolated     │
        │ Provider       │          │ Workspace    │
        │ • Gemini       │          │ (VFS copy)   │
        │ • Claude       │          └──────┬───────┘
        │ • GPT-4        │                 │
        │ • Local Ollama │          ┌──────▼───────┐
        └───────┬────────┘          │ Apply        │
                │                   │ Solutions    │
                │                   └──────┬───────┘
        ┌───────▼────────┐                │
        │ 3+ Solutions   │          ┌─────▼────────┐
        │ Generated      │          │ Web Worker   │
        └───────┬────────┘          │ Verification │
                │                   │ • Run tests  │
                │                   │ • Sandbox    │
        ┌───────▼────────┐          │ • Timeout    │
        │ Parallel       │◄─────────┤ • Results    │
        │ Verification   │          └──────────────┘
        └───────┬────────┘
                │
        ┌───────▼────────┐
        │ Score &        │
        │ Select Winner  │
        │ • Test pass    │
        │ • Performance  │
        │ • Code quality │
        └───────┬────────┘
                │
        ┌───────▼────────┐
        │ Optional:      │
        │ WebRTC Swarm   │
        │ Distribution   │
        └────────────────┘
```

### 2.2 Module API

```javascript
const MultiModelArena = {
  api: {
    // Core competition
    runCompetition: async (objective, config) => {
      // config:
      // - models: ['gemini-2.5-flash', 'claude-haiku-4-5', ...]
      // - verificationFn: (solution) => { /* test code */ }
      // - timeout: 60000
      // - useSwarm: false
      // - maxConcurrent: 3

      return {
        solutions: [...],
        winner: { model: 'gemini-2.5-flash', score: 0.95, ... },
        telemetry: { ... }
      };
    },

    // Snapshot management
    createWorkspace: async () => { /* VFS snapshot */ },
    cleanupWorkspace: async (workspaceId) => { /* restore snapshot */ },

    // Solution generation
    generateSolution: async (objective, model) => { /* HybridLLM call */ },

    // Verification
    verifySolution: async (solution, verifyFn) => { /* Web Worker test */ },

    // Scoring
    scoreSolution: (verificationResult) => { /* calculate score */ },
    selectWinner: (solutions) => { /* pick best */ },

    // Telemetry
    emitTelemetry: (event, data) => { /* PAXA integration */ },

    // Swarm distribution (optional)
    distributeToSwarm: async (solutions) => { /* WebRTC */ },

    // Statistics
    getCompetitionHistory: () => { /* past competitions */ },
    getStats: () => { /* performance metrics */ }
  }
};
```

### 2.3 Verification Strategy

**Traditional Arena (Git worktrees + Shell):**
```bash
# Python CLI approach:
git worktree add /tmp/arena-workspace-1 HEAD
cd /tmp/arena-workspace-1
# Apply changes
npm test  # Real shell execution
git worktree remove /tmp/arena-workspace-1
```

**Browser Arena (VFS + Web Workers):**
```javascript
// Browser approach:
const workspace = await StateManager.createSnapshot();  // ~1ms

// Apply solution to snapshot
workspace.writeArtifact('/upgrades/module.js', solution.code);

// Verify in Web Worker (sandboxed)
const result = await VerificationManager.verify({
  code: solution.code,
  tests: solution.tests,
  timeout: 30000
});

// No filesystem, no shell, no cleanup needed
```

### 2.4 Multi-Model Generation Strategy

```javascript
const generateSolutions = async (objective, models) => {
  const HybridLLM = DIContainer.resolve('HybridLLMProvider');

  return await Promise.all(
    models.map(async (model) => {
      const startTime = Date.now();

      try {
        const response = await HybridLLM.api.generateWithModel(
          buildPrompt(objective),
          { model, temperature: 0.7, maxTokens: 4000 }
        );

        return {
          model,
          code: extractCode(response),
          tests: extractTests(response),
          metadata: {
            duration: Date.now() - startTime,
            tokens: response.usage
          }
        };
      } catch (error) {
        return {
          model,
          error: error.message,
          failed: true
        };
      }
    })
  );
};
```

### 2.5 Widget Interface

```javascript
class MultiModelArenaWidget extends HTMLElement {
  getStatus() {
    const activeCompetition = competitionInProgress();
    const history = getCompetitionHistory();

    return {
      state: activeCompetition ? 'active' : (history.length > 0 ? 'idle' : 'disabled'),
      primaryMetric: activeCompetition
        ? `Running: ${activeCompetition.modelsCount} models`
        : `${history.length} competitions`,
      secondaryMetric: activeCompetition
        ? `${activeCompetition.progress}% complete`
        : history.length > 0 ? `Last: ${history[0].winner}` : 'No history',
      lastActivity: history.length > 0 ? history[0].timestamp : null,
      message: activeCompetition ? `Testing ${activeCompetition.objective}` : null
    };
  }
}
```

---

## 3. The Implementation Pathway

### Step 1: Create Module Skeleton

```javascript
// @blueprint 0x00006E

const MultiModelArena = {
  metadata: {
    id: 'MultiModelArena',
    version: '1.0.0',
    dependencies: ['Utils', 'EventBus', 'StateManager', 'HybridLLMProvider', 'VerificationManager'],
    async: true,
    type: 'rsi'
  },

  factory: (deps) => {
    const { Utils, EventBus, StateManager, HybridLLMProvider, VerificationManager } = deps;

    // Competition state
    let _activeCompetition = null;
    let _competitionHistory = [];
    let _stats = {
      totalCompetitions: 0,
      totalSolutions: 0,
      averageDuration: 0,
      winnersByModel: {}
    };

    // API implementation...
    // Widget implementation...

    return { api, widget };
  }
};
```

### Step 2: Implement Core Competition Flow

```javascript
const runCompetition = async (objective, config = {}) => {
  const startTime = Date.now();

  try {
    // 1. Validate configuration
    const models = config.models || ['gemini-2.5-flash', 'claude-haiku-4-5', 'gpt-5-mini'];
    const verifyFn = config.verificationFn || defaultVerification;
    const timeout = config.timeout || 60000;

    // 2. Create competition instance
    const competitionId = `arena-${Date.now()}`;
    _activeCompetition = {
      id: competitionId,
      objective,
      models,
      modelsCount: models.length,
      progress: 0,
      startTime
    };

    EventBus.emit('arena:competition:start', {
      competitionId,
      objective,
      models
    });

    // 3. Create VFS workspace
    const workspace = await StateManager.createSnapshot();

    // 4. Generate solutions in parallel
    EventBus.emit('arena:phase', { phase: 'generation', progress: 0 });

    const solutions = await Promise.all(
      models.map(async (model, idx) => {
        const solution = await generateSolution(objective, model, workspace);

        _activeCompetition.progress = Math.floor(((idx + 1) / models.length) * 50);
        EventBus.emit('arena:progress', { progress: _activeCompetition.progress });

        return solution;
      })
    );

    // 5. Verify solutions in parallel
    EventBus.emit('arena:phase', { phase: 'verification', progress: 50 });

    const verifiedSolutions = await Promise.all(
      solutions.map(async (solution, idx) => {
        if (solution.failed) return solution;

        const result = await verifySolution(solution, verifyFn, workspace);

        _activeCompetition.progress = 50 + Math.floor(((idx + 1) / models.length) * 40);
        EventBus.emit('arena:progress', { progress: _activeCompetition.progress });

        return { ...solution, verification: result };
      })
    );

    // 6. Score and select winner
    EventBus.emit('arena:phase', { phase: 'scoring', progress: 90 });

    const scored = verifiedSolutions.map(sol => ({
      ...sol,
      score: scoreSolution(sol)
    }));

    const winner = selectWinner(scored);

    // 7. Emit telemetry
    const duration = Date.now() - startTime;
    const telemetry = {
      competitionId,
      objective,
      models,
      solutions: scored,
      winner: winner.model,
      winnerScore: winner.score,
      duration
    };

    emitTelemetry('competition_complete', telemetry);

    // 8. Update history
    _competitionHistory.unshift({
      ...telemetry,
      timestamp: Date.now()
    });

    if (_competitionHistory.length > 50) {
      _competitionHistory = _competitionHistory.slice(0, 50);
    }

    // 9. Update stats
    updateStats(telemetry);

    // 10. Cleanup
    _activeCompetition = null;
    EventBus.emit('arena:competition:complete', telemetry);

    return {
      solutions: scored,
      winner,
      telemetry
    };

  } catch (error) {
    _activeCompetition = null;

    EventBus.emit('arena:competition:error', {
      error: error.message,
      objective
    });

    throw Utils.createError('ArenaCompetitionError', error.message);
  }
};
```

### Step 3: Implement Solution Generation

```javascript
const generateSolution = async (objective, model, workspace) => {
  const startTime = Date.now();

  try {
    const prompt = buildPrompt(objective, workspace);

    const response = await HybridLLMProvider.api.generateWithModel(prompt, {
      model,
      temperature: 0.7,
      maxTokens: 4000
    });

    const code = extractCode(response.content);
    const tests = extractTests(response.content);

    return {
      model,
      code,
      tests,
      raw: response.content,
      metadata: {
        duration: Date.now() - startTime,
        tokens: response.usage,
        timestamp: Date.now()
      },
      failed: false
    };
  } catch (error) {
    return {
      model,
      error: error.message,
      failed: true,
      metadata: {
        duration: Date.now() - startTime,
        timestamp: Date.now()
      }
    };
  }
};
```

### Step 4: Implement Web Worker Verification

```javascript
const verifySolution = async (solution, verifyFn, workspace) => {
  try {
    // Apply solution to workspace
    const testWorkspace = workspace.clone();

    if (solution.code) {
      testWorkspace.writeArtifact('/test-solution.js', solution.code);
    }

    // Execute verification in Web Worker
    const result = await VerificationManager.api.verify({
      code: solution.code,
      tests: solution.tests || verifyFn,
      timeout: 30000,
      context: {
        workspace: testWorkspace.getState()
      }
    });

    return {
      passed: result.success,
      testResults: result.results,
      errors: result.errors,
      duration: result.duration,
      stdout: result.stdout,
      stderr: result.stderr
    };
  } catch (error) {
    return {
      passed: false,
      errors: [error.message],
      duration: 0
    };
  }
};
```

### Step 5: Implement Scoring and Winner Selection

```javascript
const scoreSolution = (solution) => {
  if (solution.failed) return 0;

  let score = 0;

  // Test passing (60% weight)
  if (solution.verification.passed) {
    score += 0.6;
  }

  // Performance (20% weight)
  const avgDuration = _stats.averageDuration || 1000;
  const durationScore = Math.max(0, 1 - (solution.metadata.duration / avgDuration));
  score += durationScore * 0.2;

  // Code quality (20% weight)
  const qualityScore = assessCodeQuality(solution.code);
  score += qualityScore * 0.2;

  return Math.min(1, Math.max(0, score));
};

const selectWinner = (solutions) => {
  const sorted = solutions
    .filter(sol => !sol.failed)
    .sort((a, b) => b.score - a.score);

  return sorted[0] || null;
};
```

### Step 6: Implement Telemetry Integration

```javascript
const emitTelemetry = (event, data) => {
  // Emit to EventBus for general consumption
  EventBus.emit(`arena:${event}`, data);

  // Emit to PAXA for analytics
  const PAXA = DIContainer.resolve('PenteractAnalytics');
  if (PAXA) {
    PAXA.api.trackArenaEvent({
      event,
      ...data,
      timestamp: Date.now()
    });
  }
};
```

### Step 7: Implement Web Component Widget

```javascript
class MultiModelArenaWidget extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    this._interval = setInterval(() => this.render(), 1000);
  }

  disconnectedCallback() {
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
    }
  }

  getStatus() {
    const active = _activeCompetition;
    const history = _competitionHistory;

    return {
      state: active ? 'active' : (history.length > 0 ? 'idle' : 'disabled'),
      primaryMetric: active
        ? `Running: ${active.modelsCount} models`
        : `${history.length} competitions`,
      secondaryMetric: active
        ? `${active.progress}% complete`
        : history.length > 0 ? `Winner: ${history[0].winner}` : 'No history',
      lastActivity: history.length > 0 ? history[0].timestamp : null,
      message: active ? `Testing: ${active.objective.slice(0, 50)}...` : null
    };
  }

  render() {
    const status = this.getStatus();
    const active = _activeCompetition;
    const history = _competitionHistory.slice(0, 5);

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          font-family: monospace;
          font-size: 12px;
        }
        .paxos-panel {
          background: rgba(0, 0, 0, 0.8);
          padding: 16px;
          border-radius: 4px;
        }
        h4 {
          margin: 0 0 12px 0;
          color: #0af;
          font-size: 14px;
        }
        .progress-bar {
          width: 100%;
          height: 8px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 4px;
          overflow: hidden;
          margin: 8px 0;
        }
        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #0af, #0fa);
          transition: width 0.3s ease;
        }
        .stat-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-top: 12px;
        }
        .stat-item {
          padding: 8px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 2px;
        }
        .stat-label {
          color: #888;
          font-size: 10px;
        }
        .stat-value {
          color: #0af;
          font-size: 14px;
          font-weight: bold;
        }
        .history-item {
          padding: 6px;
          margin: 4px 0;
          background: rgba(0, 170, 255, 0.1);
          border-left: 3px solid #0af;
          font-size: 10px;
        }
        button {
          padding: 6px 12px;
          margin-top: 12px;
          background: #0af;
          color: #000;
          border: none;
          cursor: pointer;
          font-size: 11px;
          font-family: monospace;
          border-radius: 2px;
        }
        button:hover {
          background: #0cf;
        }
        button:disabled {
          background: #555;
          cursor: not-allowed;
        }
      </style>

      <div class="arena-panel">
        <h4>⚔ Multi-Model Arena</h4>

        ${active ? `
          <div>
            <strong>Active Competition:</strong><br>
            ${active.objective.slice(0, 60)}${active.objective.length > 60 ? '...' : ''}
          </div>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${active.progress}%"></div>
          </div>
          <div style="color: #0af; font-size: 10px; margin-top: 4px;">
            ${active.progress}% complete - Testing ${active.modelsCount} models
          </div>
        ` : `
          <div style="color: #888;">No active competition</div>
        `}

        <div class="stat-grid">
          <div class="stat-item">
            <div class="stat-label">Total Competitions</div>
            <div class="stat-value">${_stats.totalCompetitions}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">Total Solutions</div>
            <div class="stat-value">${_stats.totalSolutions}</div>
          </div>
        </div>

        ${history.length > 0 ? `
          <h5 style="margin: 12px 0 6px 0; color: #aaa;">Recent Competitions</h5>
          ${history.map(comp => `
            <div class="history-item">
              <strong>${comp.winner}</strong> won<br>
              <span style="color: #888;">${new Date(comp.timestamp).toLocaleString()}</span>
            </div>
          `).join('')}
        ` : ''}

        <button id="run-demo" ${active ? 'disabled' : ''}>
          🎯 Run Demo Competition
        </button>
      </div>
    `;

    // Wire up demo button
    const demoBtn = this.shadowRoot.getElementById('run-demo');
    if (demoBtn && !active) {
      demoBtn.addEventListener('click', () => {
        runCompetition('Optimize the StateManager module for performance', {
          models: ['gemini-2.5-flash', 'claude-haiku-4-5'],
          timeout: 30000
        });
      });
    }
  }
}

// Register custom element
const elementName = 'multi-model-arena-widget';
if (!customElements.get(elementName)) {
  customElements.define(elementName, MultiModelArenaWidget);
}
```

### Step 8: Export Module

```javascript
return {
  api: {
    // Core API
    runCompetition,
    generateSolution,
    verifySolution,
    scoreSolution,
    selectWinner,

    // Workspace management
    createWorkspace: () => StateManager.createSnapshot(),

    // History & stats
    getCompetitionHistory: () => [..._competitionHistory],
    getStats: () => ({ ..._stats }),
    clearHistory: () => { _competitionHistory = []; },

    // Telemetry
    emitTelemetry
  },

  widget: {
    element: elementName,
    displayName: 'Multi-Model Arena',
    icon: '⚔',
    category: 'rsi',
    updateInterval: 1000,
    visible: true,
    priority: 9,
    collapsible: true,
    defaultCollapsed: false
  }
};
```

---

## 4. Validation and Testing

### Unit Test Structure

```javascript
describe('MultiModelArena Module', () => {
  describe('Competition Flow', () => {
    it('should run competition with multiple models', async () => {});
    it('should generate solutions in parallel', async () => {});
    it('should verify solutions in Web Workers', async () => {});
    it('should select winner based on scores', async () => {});
  });

  describe('Solution Generation', () => {
    it('should generate solution using HybridLLM', async () => {});
    it('should handle model failures gracefully', async () => {});
    it('should extract code and tests from response', async () => {});
  });

  describe('Verification', () => {
    it('should verify solution in Web Worker', async () => {});
    it('should timeout long-running tests', async () => {});
    it('should isolate verification in VFS snapshot', async () => {});
  });

  describe('Scoring', () => {
    it('should score solutions based on test results', async () => {});
    it('should consider performance in scoring', async () => {});
    it('should select highest-scoring solution', async () => {});
  });

  describe('Widget Protocol', () => {
    it('should implement getStatus() with 5 required fields', async () => {});
    it('should show active state during competition', async () => {});
    it('should display competition history', async () => {});
  });
});
```

### Success Criteria

- ✅ Runs 100% in browser (no Node.js/Python)
- ✅ Uses VFS snapshots (no filesystem access)
- ✅ Web Worker verification (sandboxed)
- ✅ Supports multiple LLM providers
- ✅ Emits telemetry to PAXA
- ✅ Implements Module Widget Protocol
- ✅ Handles failures gracefully
- ✅ Real-time progress updates

---

## 5. Extension Opportunities

### Short-term Extensions
- **WebRTC Swarm Distribution:** Distribute verifications across browser tabs
- **Custom Scoring Functions:** User-defined scoring criteria
- **Competition Replay:** Replay past competitions for analysis
- **Model Performance Tracking:** Per-model win rates and statistics

### Long-term Extensions
- **Ensemble Voting:** Combine multiple model outputs
- **Adaptive Model Selection:** Choose models based on task type
- **Cost Optimization:** Balance model quality vs API costs
- **Competition Templates:** Pre-defined competition types

---

## 6. Comparison: Traditional vs Browser Arena

| Feature | Traditional Arena (arena_tool.js) | Browser Arena (AREN) |
|---------|-----------------------------------|-----------------------|
| **Environment** | Node.js + Python + Git | 100% Browser |
| **Workspace** | Real git worktrees | VFS snapshots (~1ms) |
| **Verification** | Shell commands | Web Workers (sandboxed) |
| **Models** | Hardcoded to Gemini | Hybrid (Gemini/Claude/GPT/Local) |
| **Distribution** | Not supported | Optional WebRTC swarm |
| **Telemetry** | Limited | Full PAXA integration |
| **UI** | WebSocket logs | Real-time widget updates |
| **Setup** | Requires proxy server | Zero setup |
| **Offline** | Not supported | Works offline (with local models) |

---

**Remember:** This module makes Arena a first-class RSI capability in REPLOID, enabling true browser-native multi-model competitive testing without any external dependencies.

**Status:** Ready for implementation - architecture fully designed.
