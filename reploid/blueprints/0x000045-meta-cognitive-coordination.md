# Blueprint 0x00004B: Meta-Cognitive Coordination Layer

**Objective:** Implement autonomous meta-cognitive decision-making that enables the agent to improve its own processes, tools, and workflows without human intervention.

**Target Upgrade:** MTCG (`meta-cognitive-layer.js`)


**Prerequisites:** 0x00004A (Déjà Vu Detector), 0x000016 (Meta-Tool Creator), 0x00003B (Reflection Store)

**Affected Artifacts:** `/upgrades/meta-cognitive-layer.js`

---

### 1. The Strategic Imperative

Most AI agents can learn from data. Few can learn from **their own behavior**. Even fewer can **decide to improve themselves**.

The Meta-Cognitive Layer is the "executive function" that:
- **Monitors** efficiency via DejaVuDetector
- **Decides** when improvements are needed
- **Coordinates** improvement execution
- **Tracks** outcomes for future learning
- **Learns** which improvements work best

**Without meta-cognition:**
- Agent repeats inefficient patterns forever
- Improvements only happen when human notices
- No autonomous skill acquisition
- Fixed capabilities (no growth)

**With meta-cognition:**
- Agent detects its own inefficiencies
- Improves autonomously (true RSI)
- Acquires new capabilities over time
- Evolves beyond initial design

This is the difference between **tool-using AI** and **tool-evolving AI**.

---

### 2. The Architectural Solution

**Conceptual Model:**

```
┌─────────────────────────────────────────┐
│      Meta-Cognitive Layer (MTCG)        │
│           "Executive Function"           │
└─────────────────────────────────────────┘
         ↑              ↓              ↓
    Monitors        Decides        Executes
         │              │              │
┌────────┴────────┐ ┌──┴───┐ ┌────────┴──────────┐
│ DejaVuDetector  │ │Logic │ │ MetaToolCreator   │
│  (Patterns)     │ │Rules │ │ (Solutions)       │
└─────────────────┘ └──────┘ └───────────────────┘
         ↓              ↓              ↓
    ┌────────────────────────────────────┐
    │       ReflectionStore              │
    │    (Long-term Learning)            │
    └────────────────────────────────────┘
```

**Key Design Decisions:**

**1. Periodic Monitoring (Not Reactive Only)**

The layer runs checks every N minutes, not just on events:
```javascript
checkIntervalMs: 10 * 60 * 1000  // Every 10 minutes
```

**Why periodic?**
- Patterns emerge over time, not in single events
- Some inefficiencies are cumulative
- Gives agent time to gather evidence before acting

**Alternative:** Could be purely event-driven (reacts to high-confidence déjà vu)
**Trade-off:** Periodic = more CPU overhead, but catches subtle patterns

**2. Auto-Apply vs. Manual Approval**

Critical decision point:
```javascript
requireApproval: false  // Auto-apply meta-improvements (RISKY!)
```

**Auto-apply** (current):
- ✅ True autonomous improvement
- ✅ Fast iteration
- ❌ Risk of runaway self-modification
- ❌ Potential infinite loops

**Manual approval**:
- ✅ Safe (human in loop)
- ✅ Controlled evolution
- ❌ Not truly autonomous
- ❌ Slow (waits for human)

**Current choice:** Auto-apply for patterns with confidence > 70%
**Safety mechanism:** Limit to 3 improvements per session

**3. Confidence-Based Gating**

Not all patterns trigger improvements:
```javascript
if (pattern.confidence < 0.7) {
  decision.approved = false;
  decision.reason = 'Pattern confidence too low';
  return decision;
}
```

**Why 70%?**
- Below 70%: Too uncertain, might create unhelpful tools
- Above 70%: Strong pattern, worth automation
- Can be adjusted based on outcomes

**4. Priority-Based Auto-Approval**

```javascript
if (suggestion.priority === 'critical') {
  decision.approved = true;  // Always apply
}
if (suggestion.priority === 'high') {
  decision.approved = true;  // Always apply
}
if (suggestion.priority === 'medium') {
  decision.approved = true;  // Always apply
}
if (suggestion.priority === 'low') {
  decision.approved = false; // Skip
}
```

**Priority assigned by DejaVuDetector based on:**
- Repeated failures → Critical (prevents wasted cycles)
- Tool creation patterns → High (clear win)
- Tool sequences → Medium (moderate benefit)
- File modifications → Medium (quality improvement)

**5. Improvement Action Types**

The layer can execute 4 types of improvements:

**A. Create Tool Factory** (Highest ROI)
```javascript
// Agent created 5 "analyze_" tools manually
// MTCG creates: create_analyze_tool factory
// Future "analyze_" tools auto-generated in seconds
```

**B. Create Composite Tool** (Workflow Automation)
```javascript
// Agent runs: read_artifact → parse_json → extract_field
// MTCG creates: extract_json_field (one-step composite)
// Reduces 3 tool calls to 1
```

**C. Record Avoidance Pattern** (Prevent Failures)
```javascript
// Agent failed 3 times with same error
// MTCG stores pattern in ReflectionStore
// Future cycles check reflections before repeating mistake
// (TODO: Integrate with system prompt for awareness)
```

**D. Suggest Refactoring** (Code Quality)
```javascript
// Agent modified same file 5 times
// MTCG analyzes file structure
// Suggests: extract functions, add abstraction layer
// (Currently suggestion-only, doesn't auto-refactor)
```

**6. LLM-Assisted Improvement Generation**

The layer doesn't hardcode improvement implementations. It uses the LLM to generate them:

```javascript
const prompt = `PATTERN DETECTED: Created ${examples.length} similar tools
${examples.join('\n')}

Create a factory tool that can generate "${category}_" tools automatically.

Return JSON with tool definition...`;

const toolDef = await HybridLLMProvider.complete([...]);
await MetaToolCreator.createDynamicTool(toolDef);
```

**Why LLM-assisted?**
- Flexible: Works for any pattern, not just anticipated ones
- Creative: May generate better solutions than hardcoded logic
- Meta-level: Uses reasoning to improve reasoning

**Risk:** LLM could generate buggy tools
**Mitigation:** Confidence threshold + manual approval mode available

**7. Web Component Widget**

The widget uses a Web Component with Shadow DOM for real-time meta-cognitive monitoring:

```javascript
class MetaCognitiveLayerWidget extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    // Auto-refresh every 5 seconds to show live meta-cognitive activity
    this._interval = setInterval(() => this.render(), 5000);
  }

  disconnectedCallback() {
    // Clean up interval to prevent memory leaks
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
    }
  }

  getStatus() {
    const status = getStatus();
    const history = getHistory();

    return {
      state: status.enabled ? (status.improvementsApplied > 0 ? 'active' : 'idle') : 'disabled',
      primaryMetric: `${status.improvementsApplied} improvements`,
      secondaryMetric: `${status.improvementsProposed} proposed`,
      lastActivity: history.length > 0 ? history[history.length - 1].timestamp : null,
      message: status.enabled ? null : 'Monitoring disabled'
    };
  }

  render() {
    const status = getStatus();
    const history = getHistory();
    const recentChecks = history.slice(-10).reverse();

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          background: rgba(255,255,255,0.05);
          border-radius: 8px;
          padding: 16px;
        }
        h3 {
          margin: 0 0 16px 0;
          color: #fff;
        }
        .stats-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 10px;
          margin-bottom: 20px;
        }
        .stat-value.applied-val { color: #0ff; }
        .stat-value.proposed-val { color: #ffc107; }
      </style>

      <div class="meta-cognitive-panel">
        <h3>⚛ Meta-Cognitive Layer</h3>

        <div class="controls">
          <button class="toggle-monitoring">${status.enabled ? '⏸ Stop' : '▶ Start'}</button>
          <button class="check-now">⌕ Check Now</button>
        </div>

        <div class="stats-grid">
          <div class="stat-card applied">
            <div class="stat-label">Applied</div>
            <div class="stat-value applied-val">${status.improvementsApplied}</div>
          </div>
          <div class="stat-card proposed">
            <div class="stat-label">Proposed</div>
            <div class="stat-value proposed-val">${status.improvementsProposed}</div>
          </div>
          <div class="stat-card checks">
            <div class="stat-label">Total Checks</div>
            <div class="stat-value checks-val">${history.length}</div>
          </div>
        </div>

        <h4>Recent Efficiency Checks (${recentChecks.length})</h4>
        <div class="recent-checks">
          ${recentChecks.map(check => `
            <div class="check-item ${check.data.inefficiencyScore >= 0.4 ? 'high-score' : 'low-score'}">
              <div class="check-level">${check.data.level}</div>
              <div class="check-score">Inefficiency: ${(check.data.inefficiencyScore * 100).toFixed(0)}%</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    // Attach event listeners for interactive controls
    this.shadowRoot.querySelector('.toggle-monitoring')?.addEventListener('click', () => {
      if (status.enabled) {
        stopMonitoring();
      } else {
        startMonitoring();
      }
      this.render();
    });

    this.shadowRoot.querySelector('.check-now')?.addEventListener('click', async () => {
      await performEfficiencyCheck();
      this.render();
    });
  }
}

// Register custom element with duplicate check
if (!customElements.get('meta-cognitive-layer-widget')) {
  customElements.define('meta-cognitive-layer-widget', MetaCognitiveLayerWidget);
}

const widget = {
  element: 'meta-cognitive-layer-widget',
  displayName: 'Meta-Cognitive Layer',
  icon: '⚛',
  category: 'meta-cognitive'
};
```

**Key architectural improvements:**
- Shadow DOM provides style encapsulation for complex dashboard UI
- Lifecycle methods ensure proper cleanup of 5-second auto-refresh interval
- Closure access to module state (getStatus, getHistory, performEfficiencyCheck) eliminates injection complexity
- Interactive controls allow manual monitoring toggle and on-demand efficiency checks
- Real-time display of improvement statistics and recent checks

---

### 3. The Implementation Pathway

**Phase 1: Core Loop (Complete)**
1. ✅ Periodic efficiency checking
2. ✅ Decision logic (approve/reject improvements)
3. ✅ Improvement execution (4 action types)
4. ✅ History tracking

**Phase 2: Web Component Widget (Complete)**
1. ✅ **Define Web Component class** `MetaCognitiveLayerWidget` extending HTMLElement inside factory function
2. ✅ **Add Shadow DOM** using `attachShadow({ mode: 'open' })` in constructor
3. ✅ **Implement lifecycle methods**:
   - `connectedCallback()`: Initial render and 5-second auto-refresh setup
   - `disconnectedCallback()`: Clean up interval to prevent memory leaks
4. ✅ **Implement getStatus()** as class method with closure access to:
   - Module state (getStatus, getHistory)
   - Returns state based on monitoring status and improvements applied
5. ✅ **Implement render()** method:
   - Set `this.shadowRoot.innerHTML` with encapsulated styles
   - Use template literals for dynamic content (stats grid, recent checks)
   - Include `<style>` tag with `:host` selector and scoped classes
   - Attach event listeners to interactive controls (toggle monitoring, check now)
6. ✅ **Register custom element**:
   - Use kebab-case naming: `meta-cognitive-layer-widget`
   - Add duplicate check: `if (!customElements.get(...))`
   - Call `customElements.define('meta-cognitive-layer-widget', MetaCognitiveLayerWidget)`
7. ✅ **Return widget object** with new format:
   - `{ element: 'meta-cognitive-layer-widget', displayName, icon, category }`
   - No `renderPanel`, `getStatus`, `updateInterval` in widget object (handled by class)
8. ✅ **Test** Shadow DOM rendering and lifecycle cleanup
9. ✅ **Dashboard** shows improvement history and real-time efficiency statistics

**Phase 3: Integration (Pending)**
1. ❌ Connect to AutonomousOrchestrator
2. ❌ Add meta-goals: "Analyze tool patterns", "Optimize workflows"

**Phase 4: Learning (Future)**
1. ❌ Track improvement outcomes (did it help?)
2. ❌ Adjust thresholds based on success rate
3. ❌ Learn which pattern types yield best improvements
4. ❌ Meta-meta-cognition: Improve the improvement process

---

## Module Interface

### Initialization

```javascript
await MetaCognitiveLayer.init();
// Initializes DejaVuDetector
// Starts periodic monitoring (every 10 min)
// Begins listening for déjà vu events
```

### Manual Trigger

```javascript
// Force immediate efficiency check
await MetaCognitiveLayer.performEfficiencyCheck();
```

### Status

```javascript
const status = MetaCognitiveLayer.getStatus();
// Returns:
{
  enabled: true,
  monitoring: true,
  sessionStats: {
    uptime: 3600000,  // 1 hour
    improvementsProposed: 5,
    improvementsApplied: 3
  },
  historySize: 12,
  config: { ... }
}
```

### History

```javascript
const history = MetaCognitiveLayer.getHistory(10);
// Returns last 10 improvements:
[
  {
    timestamp: 1729350000000,
    suggestion: { action: 'create_tool_factory', ... },
    result: { success: true, toolName: 'create_analyze_tool' },
    inefficiencyBefore: 0.65,
    outcome: 'success'
  },
  ...
]
```

### Efficiency Trends

```javascript
const trends = await MetaCognitiveLayer.getEfficiencyTrends();
// Returns time series of inefficiency scores:
[
  { timestamp: ..., score: 0.45, level: 'medium', outcome: 'acceptable' },
  { timestamp: ..., score: 0.72, level: 'high', outcome: 'improvement_needed' },
  { timestamp: ..., score: 0.38, level: 'low', outcome: 'acceptable' },  // Improved!
  ...
]
```

---

## The Meta-Cognitive Loop

**Step-by-step execution:**

```
1. Timer fires (every 10 min)
     ↓
2. performEfficiencyCheck()
     ↓
3. inefficiency = DejaVuDetector.calculateInefficiencyScore()
     → Returns: { score: 0.65, level: 'medium', reasons: [...] }
     ↓
4. if (score >= 0.4) {  // Threshold check
     ↓
5. suggestions = DejaVuDetector.suggestImprovements()
     → Returns: [{ action: 'create_tool_factory', priority: 'high', ... }]
     ↓
6. for (suggestion of suggestions) {
     ↓
7.   decision = decideImprovement(suggestion)
     → Checks: confidence, priority, approval mode
     ↓
8.   if (decision.approved) {
     ↓
9.     result = executeImprovement(suggestion)
       → Calls: createToolFactory() or createCompositeTool() etc.
       → Uses LLM to generate implementation
       → Calls MetaToolCreator.createDynamicTool()
     ↓
10.    if (result.success) {
         improvementHistory.push({ ... });
         EventBus.emit('meta:improvement:applied', { ... });
       }
     }
   }
}
```

**Typical execution time:**
- Efficiency check: ~500ms
- Pattern detection: ~200ms
- Decision making: ~50ms
- Tool generation (LLM): ~2-5 seconds
- Tool creation: ~100ms
- **Total:** ~3-6 seconds per improvement

---

## Configuration

**Runtime Adjustable:**

```javascript
MetaCognitiveLayer.CONFIG = {
  enabled: true,                    // Master switch
  checkIntervalMs: 10 * 60 * 1000,  // 10 minutes
  minInefficiencyThreshold: 0.4,    // 40% to trigger
  maxImprovementsPerSession: 3,     // Safety limit
  requireApproval: false,           // Auto-apply
  confidenceThreshold: 0.7          // 70% minimum
};
```

**To change at runtime:**
```javascript
MetaCognitiveLayer.CONFIG.requireApproval = true;  // Enable safety mode
MetaCognitiveLayer.CONFIG.checkIntervalMs = 5 * 60 * 1000;  // Check every 5 min
```

---

## Event System

**Emitted:**

```javascript
EventBus.emit('meta:improvement:applied', {
  improvement: suggestion,
  result: { success: true, toolName: 'create_analyze_tool' }
});
```

**Listened:**

```javascript
EventBus.on('meta:improve', handleManualImprovement);
EventBus.on('deja-vu:detected', handleDejaVuEvent);
```

---

## Safety Mechanisms

**1. Session Limits**
```javascript
maxImprovementsPerSession: 3
```
Prevents runaway self-modification. Resets on page reload.

**2. Confidence Gating**
```javascript
if (pattern.confidence < 0.7) { reject(); }
```
Only act on high-confidence patterns.

**3. Priority Filtering**
```javascript
if (suggestion.priority === 'low') { skip(); }
```
Don't waste time on marginal improvements.

**4. Manual Approval Mode**
```javascript
CONFIG.requireApproval = true;
// Emits event instead of auto-applying
// (UI integration pending)
```

**5. Improvement History**
```javascript
improvementHistory.push({ timestamp, suggestion, result, outcome });
```
Tracks all improvements for debugging.

---

## Success Criteria

**Immediate:**
- ✅ Detects inefficiency above threshold
- ✅ Generates factory tools for repeated patterns
- ✅ Creates composite tools for workflows
- ✅ Records avoidance patterns
- ✅ Tracks improvement history

**Integration:**
- ❌ Works in autonomous mode
- ❌ Manual approval UI functional
- ❌ Efficiency trends visualized

**Long-term:**
- ❌ Improves success rate over time
- ❌ Self-adjusts thresholds
- ❌ Learns optimal improvement strategies

---

## Example: End-to-End Meta-Improvement

**Initial State:**
```javascript
// Agent manually creates these tools:
create_dynamic_tool({ name: 'analyze_performance', ... });
create_dynamic_tool({ name: 'analyze_memory', ... });
create_dynamic_tool({ name: 'analyze_network', ... });
```

**Pattern Detection:**
```javascript
// DejaVuDetector notices:
pattern = {
  type: 'repeated_tool_creation',
  category: 'analyze',
  count: 3,
  confidence: 0.8
};
```

**Inefficiency Score:**
```javascript
inefficiency = {
  score: 0.6,  // Above 0.4 threshold
  level: 'medium',
  reasons: ['Creating similar tools manually (3x)']
};
```

**Suggestion:**
```javascript
suggestion = {
  priority: 'high',
  action: 'create_tool_factory',
  params: { category: 'analyze', examples: [...] },
  rationale: 'Created 3 analyze tools - use factory instead'
};
```

**Decision:**
```javascript
decision = {
  approved: true,  // High priority + confidence > 0.7
  reason: 'High priority - auto-approved',
  confidence: 0.8
};
```

**Execution:**
```javascript
// MTCG uses LLM to generate:
toolDef = {
  name: 'create_analyze_tool',
  description: 'Factory for generating analyze tools',
  implementation: {
    type: 'javascript',
    code: `
      // Auto-generated factory implementation
      const toolName = \`analyze_\${args.domain}\`;
      return await MetaToolCreator.createDynamicTool(...);
    `
  }
};

// Creates the factory
await MetaToolCreator.createDynamicTool(toolDef);
```

**Result:**
```javascript
// Future tool creation is now:
await ToolRunner.run('create_analyze_tool', { domain: 'cpu' });
// Instead of manually calling create_dynamic_tool

// Time saved: 5 minutes per tool
// Agent has improved itself!
```

---

**Remember:** This is the "brain" that decides when to improve. The actual improvements are executed by MetaToolCreator, but the **decision to improve** is made here.

Meta-cognition = "I notice I'm being inefficient. I should do something about it."
