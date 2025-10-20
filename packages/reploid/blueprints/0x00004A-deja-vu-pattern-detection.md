# Blueprint 0x00004A: Déjà Vu Pattern Detection

**Objective:** Detect repetitive patterns in agent actions to identify opportunities for automation and efficiency improvement, mimicking the human brain's déjà vu mechanism.

**Target Upgrade:** DEJA (`deja-vu-detector.js`)


**Prerequisites:** 0x00003B (Reflection Store), 0x000003 (Core Utilities)

**Affected Artifacts:** `/upgrades/deja-vu-detector.js`

---

### 1. The Strategic Imperative

Humans experience déjà vu when the brain detects a familiar pattern - a signal that "I've been here before." This serves as a meta-cognitive alert that something is repeating. For an AI agent, detecting repetitive patterns is crucial for identifying:

**Inefficiency Signals:**
- Creating similar tools manually instead of using a factory
- Executing the same tool sequence repeatedly instead of creating a composite tool
- Failing with the same error multiple times instead of changing approach
- Modifying the same file frequently instead of refactoring

**Without pattern detection**, the agent cannot:
- Learn from its own behavior
- Recognize when it's being inefficient
- Autonomously decide to improve itself
- Evolve beyond programmed behaviors

A déjà vu detection system makes the agent **self-aware of its patterns**.

---

### 2. The Architectural Solution

The Déjà Vu Detector is implemented as a **pattern recognition engine** that monitors agent actions and maintains a rolling window of recent history.

**Key Components:**

**1. Pattern Cache (In-Memory)**
```javascript
const patternCache = {
  toolCreations: [],      // Tools the agent has created
  toolCalls: [],          // Tools the agent has executed
  failures: [],           // Failed operations
  modifications: []       // File modifications
};
```

**Why in-memory?**
- Fast pattern matching (no DB queries)
- Recent history is most relevant for inefficiency detection
- Older patterns are in ReflectionStore for long-term learning

**5. Web Component Widget**

The widget uses a Web Component with Shadow DOM for encapsulated rendering and lifecycle management:

```javascript
class DejaVuDetectorWidget extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    // Auto-refresh every 10 seconds to show live pattern detection
    this._interval = setInterval(() => this.render(), 10000);
  }

  disconnectedCallback() {
    // Clean up interval to prevent memory leaks
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
    }
  }

  getStatus() {
    const stats = getStats();
    const totalActions = stats.toolCreations + stats.toolCalls +
                         stats.failures + stats.modifications;

    // Detect if there are high-confidence patterns
    const allPatterns = [
      ...detectToolCreationPatterns(),
      ...detectToolUsagePatterns(),
      ...detectFailurePatterns(),
      ...detectModificationPatterns()
    ];
    const hasHighConfidence = allPatterns.some(p =>
      p.confidence >= THRESHOLDS.HIGH_CONFIDENCE
    );

    return {
      state: hasHighConfidence ? 'warning' :
             (totalActions > 0 ? 'active' : 'disabled'),
      primaryMetric: totalActions > 0 ? `${totalActions} actions` : 'Idle',
      secondaryMetric: hasHighConfidence ? 'Patterns found!' : 'Monitoring',
      lastActivity: totalActions > 0 ? Date.now() : null,
      message: hasHighConfidence ? '⚠️ Repetitive patterns detected' : null
    };
  }

  render() {
    const stats = getStats();
    const allPatterns = [
      ...detectToolCreationPatterns(),
      ...detectToolUsagePatterns(),
      ...detectFailurePatterns(),
      ...detectModificationPatterns()
    ].sort((a, b) => b.confidence - a.confidence);

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          background: rgba(255,255,255,0.05);
          border-radius: 8px;
          padding: 16px;
          font-family: monospace;
          font-size: 12px;
        }
        h3 {
          margin: 0 0 16px 0;
          color: #fff;
        }
        .stat-value { color: #0ff; }
        .stat-value.error { color: #f00; }
        .pattern-stat-value.high { color: #f00; }
        .pattern-stat-value.medium { color: #ff0; }
      </style>

      <div class="deja-vu-panel">
        <h3>♲ Déjà Vu Detector</h3>

        <div class="controls">
          <button class="detect-patterns">⌕ Detect Patterns</button>
          <button class="inefficiency-score">☱ Inefficiency Score</button>
          <button class="suggest-improvements">◯ Suggest Improvements</button>
          <button class="clear-cache">⛶ Clear Cache</button>
        </div>

        <div class="section">
          <div class="section-title">Action Cache</div>
          <div>Tool Creations: <span class="stat-value">${stats.toolCreations}</span></div>
          <div>Tool Calls: <span class="stat-value">${stats.toolCalls}</span></div>
          <div>Failures: <span class="stat-value error">${stats.failures}</span></div>
          <div>Modifications: <span class="stat-value">${stats.modifications}</span></div>
        </div>

        ${allPatterns.length > 0 ? `
          <div class="patterns-box">
            <div>Total Patterns: ${allPatterns.length}</div>
            <div>High Confidence: ${allPatterns.filter(p => p.confidence >= THRESHOLDS.HIGH_CONFIDENCE).length}</div>
          </div>
        ` : ''}
      </div>
    `;

    // Attach event listeners for interactive controls
    this.shadowRoot.querySelector('.detect-patterns')?.addEventListener('click', async () => {
      const patterns = await detectPatterns();
      this.render();
    });

    this.shadowRoot.querySelector('.inefficiency-score')?.addEventListener('click', async () => {
      const result = await calculateInefficiencyScore();
      console.log('Inefficiency Analysis:', result);
    });

    this.shadowRoot.querySelector('.suggest-improvements')?.addEventListener('click', async () => {
      const suggestions = await suggestImprovements();
      console.table(suggestions);
    });

    this.shadowRoot.querySelector('.clear-cache')?.addEventListener('click', () => {
      clearCache();
      this.render();
    });
  }
}

// Register custom element with duplicate check
if (!customElements.get('deja-vu-detector-widget')) {
  customElements.define('deja-vu-detector-widget', DejaVuDetectorWidget);
}

const widget = {
  element: 'deja-vu-detector-widget',
  displayName: 'Déjà Vu Detector',
  icon: '♲',
  category: 'rsi'
};
```

**Key architectural improvements:**
- Shadow DOM provides style encapsulation
- Lifecycle methods ensure proper cleanup of intervals
- Closure access to module state (patternCache, detection functions) eliminates injection complexity
- Interactive controls trigger pattern detection and analysis

**2. Pattern Detection Algorithms**

**Tool Creation Patterns:**
```javascript
// Detects: "I created 3 tools with 'analyze_' prefix"
// Suggestion: "Create a create_analyze_tool factory"

const categories = {};
for (const creation of toolCreations) {
  const prefix = creation.name.split('_')[0];
  categories[prefix] = (categories[prefix] || 0) + 1;
}

if (categories['analyze'] >= 3) {
  return {
    type: 'repeated_tool_creation',
    suggestion: 'Create factory tool: create_analyze_tool'
  };
}
```

**Tool Sequence Patterns:**
```javascript
// Detects: "I always call read_artifact then parse_content"
// Suggestion: "Create composite tool that does both"

const sequences = [];
for (let i = 0; i < toolCalls.length - 1; i++) {
  if (toolCalls[i+1].timestamp - toolCalls[i].timestamp < 5min) {
    sequences.push(`${toolCalls[i].tool} → ${toolCalls[i+1].tool}`);
  }
}

if (countOccurrences(sequences, 'read_artifact → parse_content') >= 3) {
  return {
    type: 'repeated_tool_sequence',
    suggestion: 'Create composite tool for this workflow'
  };
}
```

**Failure Patterns:**
```javascript
// Detects: "I failed 2+ times with same error"
// Suggestion: "Avoid this approach, try alternative"

const normalized = failure.message
  .replace(/['"][^'"]+['"]/g, 'VALUE')  // Abstract specific values
  .replace(/\d+/g, 'NUM');

if (sameErrorCount >= 2) {
  return {
    type: 'repeated_failure',
    priority: 'critical',
    suggestion: 'This approach keeps failing - try different method'
  };
}
```

**3. Confidence Scoring**

Each pattern gets a confidence score based on:
- **Frequency:** More repetitions = higher confidence
- **Recency:** Recent patterns = higher confidence
- **Consistency:** Same pattern each time = higher confidence

```javascript
confidence = 0.5 + (occurrences * 0.1);  // Base 50% + 10% per occurrence
if (mostRecentOccurrence < 1hour) confidence += 0.1;  // Recent boost
confidence = Math.min(confidence, 1.0);  // Clamp to 100%
```

**4. Inefficiency Scoring**

Overall inefficiency score (0-1):
```javascript
score = 0;
score += repeated_tool_creation * 0.2;   // Creating similar tools
score += repeated_sequences * 0.15;      // Manual workflows
score += repeated_failures * 0.25;       // Wasted failures
score += frequent_modifications * 0.1;   // Churn in files

score = Math.min(score, 1.0);
```

**Interpretation:**
- 0.0 - 0.3: Efficient operation
- 0.4 - 0.6: Moderate inefficiency (opportunity for improvement)
- 0.7 - 1.0: High inefficiency (meta-improvement urgently needed)

---

### 3. The Implementation Pathway

**Phase 1: Core Pattern Detection (Complete)**
1. ✅ Create pattern cache with categories (toolCreations, toolCalls, failures, modifications)
2. ✅ Implement detection algorithms (tool creation, sequences, failures, modifications)
3. ✅ Calculate confidence scores based on frequency and recency
4. ✅ Emit déjà vu events for high-confidence patterns

**Phase 2: Web Component Widget (Complete)**
1. ✅ **Define Web Component class** `DejaVuDetectorWidget` extending HTMLElement inside factory function
2. ✅ **Add Shadow DOM** using `attachShadow({ mode: 'open' })` in constructor
3. ✅ **Implement lifecycle methods**:
   - `connectedCallback()`: Initial render and 10-second auto-refresh setup
   - `disconnectedCallback()`: Clean up intervals to prevent memory leaks
4. ✅ **Implement getStatus()** as class method with closure access to:
   - Module state (pattern cache, stats)
   - Detection functions (detectToolCreationPatterns, etc.)
   - Returns state based on pattern detection ('warning' if high-confidence patterns found, 'active' if tracking actions, 'disabled' if idle)
5. ✅ **Implement render()** method:
   - Set `this.shadowRoot.innerHTML` with encapsulated styles
   - Use template literals for dynamic content (pattern counts, stats)
   - Include `<style>` tag with `:host` selector and scoped classes
   - Attach event listeners to interactive controls (detect, score, suggest, clear)
6. ✅ **Register custom element**:
   - Use kebab-case naming: `deja-vu-detector-widget`
   - Add duplicate check: `if (!customElements.get(...))`
   - Call `customElements.define('deja-vu-detector-widget', DejaVuDetectorWidget)`
7. ✅ **Return widget object** with new format:
   - `{ element: 'deja-vu-detector-widget', displayName, icon, category }`
   - No `renderPanel`, `getStatus`, `updateInterval` in widget object (handled by class)
8. ✅ **Test** Shadow DOM rendering and lifecycle cleanup

**Phase 3: Integration (Pending)**
1. ❌ Connect to MetaCognitiveLayer for triggering improvements
2. ❌ Integrate with ReflectionStore for persistence
3. ❌ Add to AutonomousOrchestrator for autonomous mode

**Phase 4: Learning (Future)**
1. ❌ Track which patterns lead to successful improvements
2. ❌ Adjust thresholds based on outcomes
3. ❌ Learn which inefficiencies are worth fixing

---

## Module Interface

### Primary Functions

**Initialize and start monitoring:**
```javascript
await DejaVuDetector.init();
// Starts listening for tool_executed, tool_created, cycle_completed events
```

**Detect patterns:**
```javascript
const patterns = await DejaVuDetector.detectPatterns();
// Returns:
[
  {
    type: 'repeated_tool_creation',
    category: 'analyze',
    count: 5,
    confidence: 0.8,
    suggestion: 'Create factory: create_analyze_tool',
    examples: ['analyze_code', 'analyze_performance', 'analyze_memory']
  },
  ...
]
```

**Get inefficiency score:**
```javascript
const inefficiency = await DejaVuDetector.calculateInefficiencyScore();
// Returns:
{
  score: 0.65,
  level: 'medium',
  reasons: [
    'Creating similar tools manually (5x)',
    'Repeating manual workflows (3x)'
  ],
  patterns: [...]  // High-confidence patterns
}
```

**Get improvement suggestions:**
```javascript
const suggestions = await DejaVuDetector.suggestImprovements();
// Returns:
[
  {
    priority: 'high',
    action: 'create_tool_factory',
    params: { category: 'analyze', examples: [...] },
    rationale: 'Created 5 analyze tools - use factory instead',
    estimated_time_saved: '25 minutes'
  },
  ...
]
```

---

## Event System

**Emitted Events:**

```javascript
EventBus.emit('deja-vu:detected', {
  pattern: { type, count, confidence, suggestion },
  severity: 'high' | 'medium' | 'low',
  actionable: boolean
});
```

**Listened Events:**

```javascript
EventBus.on('tool:executed', onToolExecuted);       // Track tool usage
EventBus.on('tool:created', onToolCreated);         // Track tool creation
EventBus.on('cycle:completed', onCycleCompleted);   // Periodic scan
EventBus.on('reflection:added', onReflectionAdded); // Track reflections
```

---

## Configuration

**Adjustable Thresholds:**

```javascript
DejaVuDetector.THRESHOLDS = {
  MIN_OCCURRENCES: 3,         // Default: 3 repetitions to trigger
  SIMILARITY_THRESHOLD: 0.7,   // Default: 70% similarity
  TIME_WINDOW_MS: 24 * 3600 * 1000,  // Default: 24 hours
  HIGH_CONFIDENCE: 0.85,       // Default: 85% for high confidence
  MEDIUM_CONFIDENCE: 0.65      // Default: 65% for medium confidence
};
```

---

## Integration with Meta-Cognitive Layer

The Déjà Vu Detector provides the **sensory input** for meta-cognition:

```
DejaVuDetector (Senses repetition)
  ↓ emits 'deja-vu:detected'
MetaCognitiveLayer (Decides action)
  ↓ calls executeImprovement()
MetaToolCreator (Creates solution)
  ↓ creates factory tool
HotReload (Applies change)
  ↓ reloads module
Agent now has improved capability!
```

---

## Success Criteria

**Immediate (Testing):**
- ✅ Detects 3+ similar tool creations
- ✅ Detects 3+ repeated tool sequences
- ✅ Detects 2+ repeated failures
- ✅ Calculates inefficiency score correctly
- ✅ Generates actionable suggestions

**Integration:**
- ❌ MetaCognitiveLayer responds to high-confidence patterns
- ❌ Autonomous mode triggers improvements based on patterns
- ❌ UI shows pattern visualizations

**Long-term (Learning):**
- ❌ Pattern detection improves over time
- ❌ Thresholds auto-adjust based on outcomes
- ❌ Agent proactively avoids inefficient patterns

---

## Known Limitations

1. **No cross-session learning yet** - Patterns reset on page reload (mitigated by ReflectionStore)
2. **Simple similarity matching** - Could use embedding-based semantic similarity
3. **No context awareness** - Doesn't know if repetition is intentional (e.g., testing)
4. **Fixed thresholds** - Not adaptive yet

---

## Future Enhancements

1. **Semantic pattern matching** - Use embeddings to detect conceptually similar actions
2. **Context-aware detection** - Distinguish deliberate repetition from inefficiency
3. **Adaptive thresholds** - Learn optimal thresholds from outcomes
4. **Cross-agent learning** - Share patterns across multiple REPLOID instances
5. **Temporal patterns** - Detect time-based patterns (e.g., "always fails at night")

---

**Remember:** This module doesn't improve the agent itself - it **detects when improvement is needed**. The actual improvements are coordinated by the MetaCognitiveLayer.

The déjà vu feeling = "You should do something about this pattern."
