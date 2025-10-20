# Blueprint 0x000047: Structured Agent Cycle

**Objective:** Implement an 8-step structured agent cycle with explicit deliberation, self-assessment, and confidence scoring to enable more sophisticated agent reasoning and transparent decision-making.

**Target Upgrade:** STCY (`agent-cycle-structured.js`)


**Prerequisites:** 0x000008 (Agent Cognitive Cycle), 0x000009 (Pure Agent Logic Helpers), 0x000012 (Structured Self-Evaluation)

**Affected Artifacts:** `/upgrades/agent-cycle-structured.js`, `/personas/MultiMindSynthesisPersona.js`, `/config.json`

---

### 1. The Strategic Imperative

The current agent cycle (Sentinel FSM) provides human-in-the-loop oversight but lacks explicit self-assessment and confidence scoring. When an agent proposes changes, humans cannot see:
- **What alternatives were considered**
- **Why this approach was chosen**
- **How confident the agent is**
- **What the agent is uncertain about**

This creates opacity in decision-making. For recursive self-improvement (RSI) to be safe and effective, the agent must articulate its reasoning, assess its own proposals critically, and express uncertainty quantitatively.

A structured 8-step cycle addresses this by:
1. Making deliberation explicit (not implicit in natural language)
2. Separating justification from implementation
3. Requiring self-assessment before execution
4. Providing numeric confidence scores for automation

This enables:
- **Conditional automation** (auto-apply high-confidence changes)
- **Targeted review** (focus on low-confidence or high-uncertainty areas)
- **Learning from mistakes** (track confidence vs. outcomes)
- **Multi-perspective synthesis** (integrate multiple expert viewpoints)

---

### 2. The Architectural Solution

The structured cycle is implemented as a **parallel alternative** to the default `agent-cycle.js`, not a replacement. This allows:
- Personas to choose between default FSM flow or structured cycle
- A/B testing of approaches
- Gradual migration without breaking existing workflows

**Module:** `upgrades/agent-cycle-structured.js`

**Key Design Decisions:**

**1. Structured JSON Output (Not Markdown)**
- Default cycle outputs markdown (`dogs.md` bundles)
- Structured cycle outputs JSON with defined schema
- JSON enables programmatic analysis of confidence, uncertainties, trade-offs

**2. Separate Steps with Distinct LLM Calls**
- Each step (deliberate, propose, justify, assess) is a separate LLM invocation
- Prevents "bleeding" of concerns (e.g., justification mixed with code)
- Allows different temperatures for different steps (low for code, high for creativity)

**3. Confidence Calculation Algorithm**
```javascript
score = 0.5  // Base confidence
  + (strengths.length * 0.1)
  - (weaknesses.length * 0.1)
  - (uncertainties.length * 0.15)  // Penalize uncertainty more
  - (changeCount > 10 ? 0.1 : 0.0)  // Penalize complexity

score = Math.max(0.0, Math.min(1.0, score))  // Clamp [0, 1]
```

Why this formula?
- **Base 0.5**: Neutral starting point
- **Strengths +10% each**: Reward solid reasoning
- **Weaknesses -10% each**: Penalize known issues
- **Uncertainties -15% each**: Penalize unknowns more than known issues
- **Complexity penalty**: Large changesets are riskier

**4. Persona Integration**
- Step 1 (Deliberate) uses persona's system prompt
- Persona can provide custom deliberation templates
- Multi-mind personas add cross-perspective analysis

**5. Tool Call Generation**
- Artifact changes automatically mapped to tool calls
- Supports: `write_artifact`, `delete_artifact`, `create_dynamic_tool`, `define_web_component`
- Compatible with existing tool runner

**6. Widget Interface (Web Component)**

The module exposes a `AgentCycleStructuredWidget` custom element for dashboard visualization:

```javascript
class AgentCycleStructuredWidget extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    this._interval = setInterval(() => this.render(), 2000);
  }

  disconnectedCallback() {
    if (this._interval) clearInterval(this._interval);
  }

  set moduleApi(api) {
    this._api = api;
    this.render();
  }

  getStatus() {
    return {
      state: isRunning ? 'active' : 'idle',
      primaryMetric: isRunning ? `Step ${_currentStep}/8` : 'Idle',
      secondaryMetric: `Conf: ${avgConfidence}`,
      lastActivity: _lastActivity,
      message: isRunning ? goalPreview : cycleCount
    };
  }

  renderPanel() {
    // Returns HTML for:
    // - Current cycle progress (step N/8 with progress bar)
    // - 8-step breakdown with checkmarks/arrows
    // - Cycle statistics (total cycles, avg confidence, avg duration)
    // - Persona usage chart
    // - Recent cycle history with confidence scores
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>/* Shadow DOM styles */</style>
      <div class="widget-content">${this.renderPanel()}</div>
    `;
  }
}

customElements.define('agent-cycle-structured-widget', AgentCycleStructuredWidget);
```

This provides real-time visualization of:
- Current step progress (1-8)
- Cycle statistics (total cycles, average confidence, average duration)
- Persona selection history
- Recent cycle outcomes with confidence color coding (green ≥0.8, orange ≥0.5, red <0.5)

---

### 3. The Implementation Pathway

**Phase 1: Core Module (Complete)**
1. ✅ Create `upgrades/agent-cycle-structured.js`
2. ✅ Implement 8 functions (one per step)
3. ✅ Export `executeStructuredCycle()` API
4. ✅ Add reflection storage integration
5. ✅ Emit events for UI updates

**Phase 2: Persona Support (Complete)**
1. ✅ Create `personas/MultiMindSynthesisPersona.js`
2. ✅ Implement multi-mind deliberation prompt
3. ✅ Add mind selection API (`selectRelevantMinds()`)
4. ✅ Implement conservative confidence calibration

**Phase 3: Configuration (In Progress)**
1. ❌ Add `STCY` upgrade to `config.json` upgrades array
2. ❌ Add `multi_mind_architect` persona to personas array
3. ❌ Add Blueprint 0x000047 to blueprints array
4. ❌ Add `structuredCycle` config section

**Phase 4: Integration (Pending)**
1. ❌ Verify boot.js can load structured cycle module
2. ❌ Add conditional in Sentinel FSM to use structured cycle
3. ❌ Update UI manager to display confidence scores
4. ❌ Add confidence-based conditional execution

**Phase 5: Testing & Validation (Pending)**
1. ❌ Create integration test
2. ❌ Verify end-to-end flow: boot → load → execute → output
3. ❌ Test with multi-mind persona
4. ❌ Verify confidence score accuracy

**Phase 6: UI Enhancements (Future)**
1. Confidence score gauge in diff viewer
2. Expandable sections for deliberation, justification, assessment
3. Uncertainty highlighting
4. Alternative approaches comparison view

---

## Module Interface

### Primary Function

```javascript
executeStructuredCycle(goal, contextPath = null) → StructuredCycleOutput
```

**Parameters:**
- `goal` (string): The task to accomplish
- `contextPath` (string, optional): Path to cats bundle for context

**Returns:** `StructuredCycleOutput` (Object)
```javascript
{
  // Step 1
  persona_analysis_musing: string,
  selected_persona: string,
  context_focus: string,
  evaluation_strategy: string,

  // Step 2
  proposed_changes_description: string,
  change_type: string,

  // Step 3
  artifact_changes: {
    changes: Array<ArtifactChange>,
    paradigm: string
  },

  // Step 4
  proposed_new_tools: Array<Tool>,
  web_components: Array<WebComponent>,

  // Step 5
  tool_calls: Array<ToolCall>,

  // Step 6
  justification_persona_musing: string,

  // Step 7
  self_assessment_notes: {
    assessment: string,
    strengths: Array<string>,
    weaknesses: Array<string>,
    uncertainties: Array<string>,
    testing_recommendations: Array<string>,
    improvement_ideas: Array<string>
  },

  // Step 8
  agent_confidence_score: number,  // 0.0 - 1.0
  confidence_breakdown: Object,

  // Metadata
  goal: string,
  timestamp: string,
  cycle_duration_ms: number
}
```

---

## Integration Points

### 1. App Logic (DI Container)

The structured cycle requires these dependencies:
```javascript
dependencies: [
  'StateManager',
  'ApiClient',
  'HybridLLMProvider',
  'ToolRunner',
  'EventBus',
  'Utils',
  'Persona',
  'ReflectionStore'
]
```

All are standard dependencies already loaded by `app-logic.js`.

### 2. Boot Sequence

No changes required to `boot.js`. The structured cycle is loaded like any other upgrade:

```javascript
// In app-logic.js or equivalent
if (personaConfig.upgrades.includes('STCY')) {
  const AgentCycleStructured = await loadModule('upgrades/agent-cycle-structured.js');
  DIContainer.register('AgentCycleStructured', AgentCycleStructured.factory(deps));
}
```

### 3. Sentinel FSM (Optional Integration)

To use structured cycle in Sentinel workflow:

```javascript
// In sentinel-fsm.js PLANNING_WITH_CONTEXT state
const AgentCycleStructured = deps.AgentCycleStructured;

if (AgentCycleStructured) {
  // Use structured cycle
  const result = await AgentCycleStructured.executeStructuredCycle(goal, catsPath);

  // Check confidence
  if (result.agent_confidence_score < 0.5) {
    EventBus.emit('warning:low-confidence', result.self_assessment_notes);
  }

  // Convert to dogs for compatibility
  const dogsBundle = convertStructuredToDogs(result);

} else {
  // Fallback to default cycle
  await agentActionPlanWithContext();
}
```

### 4. UI Integration

Display confidence in diff viewer:

```javascript
// In ui-manager.js or diff-viewer-ui.js
const confidenceScore = cycleResult.agent_confidence_score;
const interpretation = confidenceScore >= 0.8 ? 'High' :
                      confidenceScore >= 0.5 ? 'Medium' : 'Low';

const confidenceHTML = `
  <div class="confidence-indicator ${interpretation.toLowerCase()}">
    <div class="confidence-label">Agent Confidence</div>
    <div class="confidence-bar">
      <div class="confidence-fill" style="width: ${confidenceScore * 100}%"></div>
    </div>
    <div class="confidence-score">${(confidenceScore * 100).toFixed(0)}% - ${interpretation}</div>
  </div>
`;
```

---

## Comparison with Default Cycle

| Aspect | Default (Sentinel FSM) | Structured 8-Step |
|--------|----------------------|-------------------|
| Output Format | Markdown (dogs.md) | JSON |
| Persona Selection | Manual/Config | AI-analyzed |
| Deliberation | Implicit | Explicit multi-mind |
| Justification | Mixed with code | Separate section |
| Self-Assessment | None | Detailed |
| Confidence Score | None | 0.0 - 1.0 numeric |
| Uncertainties | Not captured | Explicit list |
| Trade-offs | Not documented | Explicit |
| Alternatives | Not considered | Documented |
| Auto-Apply | No | Conditional (if score >= 0.8) |
| Learning | Reflection only | Reflection + confidence tracking |

---

## Safety Mechanisms

**1. Confidence Thresholds**
```javascript
if (confidence < 0.5) {
  // Require human approval
  showWarning('Low confidence - manual review required');
  requireApproval = true;
}
```

**2. Uncertainty Highlighting**
```javascript
if (uncertainties.length > 3) {
  showWarning(`Agent has ${uncertainties.length} uncertainties`);
  displayUncertainties(uncertainties);
}
```

**3. Weakness Disclosure**
```javascript
// Agent must list weaknesses
// UI highlights these for human review
displayWeaknesses(result.self_assessment_notes.weaknesses);
```

**4. Rollback on Low Confidence**
```javascript
if (appliedChanges && result.agent_confidence_score < 0.3) {
  logger.warn('Very low confidence detected post-application');
  recommendRollback();
}
```

---

## Future Enhancements

**1. Confidence Tracking Over Time**
- Store (goal, confidence, outcome) tuples
- Analyze: Do high-confidence changes succeed more?
- Calibrate thresholds based on historical accuracy

**2. Persona-Specific Confidence Calibration**
- Multi-mind persona: higher threshold (0.85)
- Code refactorer: standard threshold (0.8)
- Allow personas to define calibration

**3. Step-Level Confidence**
- Not just overall confidence
- Confidence for each step: deliberation, proposal, implementation
- Visualize as stacked bar chart

**4. Uncertainty Resolution Loop**
- If uncertainties.length > 2, run sub-cycle to resolve
- Use tools to answer uncertain questions
- Re-assess confidence after resolution

**5. Alternative Exploration**
- Generate multiple proposals (different approaches)
- Score each
- Present top 2-3 to user

---

## Usage Example

```javascript
// Load persona
const MultiMindPersona = await loadModule('personas/MultiMindSynthesisPersona.js');
DIContainer.register('Persona', MultiMindPersona.factory());

// Load structured cycle
const AgentCycleStructured = await loadModule('upgrades/agent-cycle-structured.js');
const cycle = AgentCycleStructured.factory(deps);

// Execute cycle
const result = await cycle.executeStructuredCycle(
  'Optimize the reflection search algorithm using graph theory',
  '/vfs/sessions/session-001/turn-001.cats.md'
);

// Conditional execution based on confidence
if (result.agent_confidence_score >= 0.85) {
  // High confidence - auto-apply
  logger.info('High confidence. Auto-applying changes...');
  await applyToolCalls(result.tool_calls);

} else if (result.agent_confidence_score >= 0.5) {
  // Medium confidence - show for review
  logger.info('Medium confidence. Review required.');
  showDiffViewer(result);

} else {
  // Low confidence - show warnings
  logger.warn('Low confidence. Uncertainties detected:');
  result.self_assessment_notes.uncertainties.forEach(u => logger.warn(`  - ${u}`));
  showWarningDialog(result);
}

// Store for learning
await ReflectionStore.storeReflection({
  type: 'structured_cycle',
  goal: result.goal,
  confidence: result.agent_confidence_score,
  output: result
});
```

---

## Success Criteria

The structured cycle is successful when:

1. ✅ **Complete 8-step output** - All fields populated
2. ✅ **Valid JSON** - Parseable and schema-compliant
3. ✅ **Confidence correlates with outcome** - High confidence → higher success rate
4. ✅ **Uncertainties are actionable** - Not vague ("might not work"), but specific ("unclear if logger supports Error objects")
5. ✅ **Justification explains trade-offs** - Not just "this is good", but "X benefit vs Y cost"
6. ✅ **Self-assessment is critical** - Lists real weaknesses, not boilerplate
7. ✅ **Tool calls are executable** - Can be passed directly to ToolRunner
8. ✅ **Integration with Sentinel FSM** - Can be used in place of default cycle

---

## Conclusion

The Structured Agent Cycle represents a significant advancement in agent transparency and self-awareness. By making deliberation explicit, requiring self-assessment, and scoring confidence numerically, it enables:

- **Safer RSI** - Agent expresses uncertainty before modifying itself
- **Better learning** - Confidence tracking enables calibration
- **Conditional automation** - High-confidence tasks can auto-execute
- **Multi-perspective synthesis** - Personas like MultiMind bring 50+ expert viewpoints

This blueprint provides the foundation for the next generation of agentic reasoning in REPLOID.

---

**Status:** ✅ Core module complete, ⏳ Configuration in progress, ⏳ Integration pending

**Next Actions:**
1. Update `config.json` with STCY upgrade
2. Add `multi_mind_architect` persona to config
3. Test end-to-end flow from boot to execution
4. Build confidence score UI visualization
