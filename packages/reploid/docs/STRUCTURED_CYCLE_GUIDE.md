# Structured 8-Step Agent Cycle Guide

## Overview

REPLOID now supports an enhanced **Structured 8-Step Cycle** that provides explicit deliberation, self-assessment, and confidence scoring. This is a more sophisticated alternative to the default Sentinel FSM cycle.

## Architecture

**Module:** `upgrades/agent-cycle-structured.js` (ID: `STCY`)
**Blueprint:** `0x000047` (to be created)
**Persona:** `MultiMindSynthesisPersona.js` (recommended)

---

## The 8 Steps

### 1. Deliberate & Analyze (`persona_analysis_musing`)

**Purpose:** Multi-perspective analysis before acting

**Output:**
```json
{
  "analysis": "Multi-perspective deliberation considering patterns, risks, edge cases...",
  "persona": "architect|purist|auditor|craftsman",
  "focus": "What the agent should focus on",
  "evaluation": "How success will be measured"
}
```

**Example:**
```json
{
  "analysis": "This task requires both architectural thinking (modular design) and security mindset (input validation). The Purist perspective identifies edge cases: null inputs, type coercion issues. The Auditor flags potential XSS vectors. Historical context shows similar patterns in React's hooks implementation.",
  "persona": "purist",
  "focus": "Type safety and edge case handling",
  "evaluation": "Tests pass + TypeScript strict mode + no security warnings"
}
```

---

### 2. Propose Changes (`proposed_changes_description`)

**Purpose:** High-level description of what will change

**Output:**
```json
{
  "description": "2-4 sentence summary of proposed changes",
  "type": "tool|web_component|page_composition|code_modification",
  "files_affected": ["path/to/file1.js", "path/to/file2.css"],
  "approach": "Explanation of approach",
  "dependencies": ["New dependencies if any"]
}
```

**Example:**
```json
{
  "description": "Add error boundary component to handle React rendering errors gracefully. Implement fallback UI and error reporting. Integrate with existing logger.",
  "type": "web_component",
  "files_affected": [
    "components/ErrorBoundary.jsx",
    "components/App.jsx",
    "utils/logger.js"
  ],
  "approach": "Class-based React component using componentDidCatch lifecycle",
  "dependencies": []
}
```

---

### 3. Generate Artifact Changes (`artifact_changes`)

**Purpose:** Detailed file-level modifications

**Output:**
```json
{
  "changes": [
    {
      "artifact_id": "path/to/file.js",
      "operation": "CREATE|MODIFY|DELETE",
      "paradigm": "module|component|page|tool",
      "content": "Full file content",
      "reason": "Why this change?"
    }
  ],
  "paradigm": "Overall architectural paradigm"
}
```

**Important:** If `type` is `page_composition`, do NOT use `full_html_source`. Use semantic components.

---

### 4. Tool/Component Creation (`proposed_new_tools`, `web_components`)

**Purpose:** Define new tools or web components if needed

**Output (for tools):**
```json
{
  "tools": [
    {
      "name": "custom_validator",
      "description": "Validates user input against schema",
      "parameters": [...],
      "implementation": "// code here"
    }
  ]
}
```

**Output (for web components):**
```json
{
  "components": [
    {
      "tag_name": "error-boundary",
      "description": "React error boundary component",
      "template": "<!-- HTML template -->",
      "styles": "/* Component styles */"
    }
  ]
}
```

---

### 5. Tool Calls (`tool_calls`)

**Purpose:** Specify which tools to execute

**Output:**
```json
{
  "calls": [
    {
      "tool_name": "write_artifact",
      "arguments": {
        "path": "/components/ErrorBoundary.jsx",
        "content": "...",
        "reason": "Create error boundary component"
      }
    }
  ]
}
```

---

### 6. Justification (`justification_persona_musing`)

**Purpose:** Explain why this approach was chosen

**Output:**
```json
{
  "justification": "2-3 paragraphs explaining reasoning",
  "alternatives_considered": ["Alt 1", "Alt 2"],
  "trade_offs": {
    "benefits": ["Benefit 1", "Benefit 2"],
    "costs": ["Cost 1", "Cost 2"]
  }
}
```

**Example:**
```json
{
  "justification": "Class-based error boundary is the only React pattern that supports componentDidCatch. While function components with hooks are preferred, React Error Boundaries require lifecycle methods not available in hooks. This aligns with The Purist mindset—using the right tool for the job rather than forcing a pattern. The fallback UI follows accessibility best practices from The Designer perspective.",
  "alternatives_considered": [
    "Try-catch in function components (doesn't catch rendering errors)",
    "Third-party error boundary library (adds dependency)",
    "Window error handler (doesn't integrate with React lifecycle)"
  ],
  "trade_offs": {
    "benefits": [
      "Native React pattern, well-documented",
      "Catches rendering errors that try-catch can't",
      "Integrates with React DevTools"
    ],
    "costs": [
      "Requires class component (not function component)",
      "Doesn't catch errors in event handlers (by design)",
      "Need to manually hoist state to reset boundary"
    ]
  }
}
```

---

### 7. Self-Assessment (`self_assessment_notes`)

**Purpose:** Agent evaluates its own proposal critically

**Output:**
```json
{
  "assessment": "Overall assessment (2-3 sentences)",
  "strengths": ["Strength 1", "Strength 2"],
  "weaknesses": ["Weakness 1", "Weakness 2"],
  "uncertainties": ["Uncertainty 1", "Uncertainty 2"],
  "testing_recommendations": ["Test 1", "Test 2"],
  "improvement_ideas": ["Idea 1", "Idea 2"]
}
```

**Example:**
```json
{
  "assessment": "The error boundary implementation is solid and follows React best practices. However, the fallback UI is basic and could be more informative. Integration with the existing logger is straightforward.",
  "strengths": [
    "Follows React documentation exactly",
    "Handles edge case: errors in componentDidCatch itself",
    "PropTypes validation included"
  ],
  "weaknesses": [
    "Fallback UI doesn't show error details in dev mode",
    "No retry mechanism for transient errors",
    "Doesn't capture error context (user actions leading to error)"
  ],
  "uncertainties": [
    "Not sure if logger.error supports Error objects (might need error.toString())",
    "Unclear if we should clear error state on route change",
    "Should we report errors to external service (Sentry)?"
  ],
  "testing_recommendations": [
    "Test with intentionally broken component",
    "Verify fallback UI renders correctly",
    "Check logger integration (mock logger.error)",
    "Test reset functionality (componentDidMount after error)"
  ],
  "improvement_ideas": [
    "Add error details toggle for development builds",
    "Implement exponential backoff retry for network errors",
    "Capture Redux/Zustand state snapshot on error",
    "Add accessibility attributes to fallback UI"
  ]
}
```

---

### 8. Confidence Score (`agent_confidence_score`)

**Purpose:** Numeric confidence rating (0.0-1.0)

**Output:**
```json
{
  "score": 0.75,
  "breakdown": {
    "base": 0.5,
    "from_strengths": 0.3,
    "from_weaknesses": -0.1,
    "from_uncertainties": -0.15,
    "from_complexity": 0.0
  },
  "interpretation": "high|medium|low"
}
```

**Calculation:**
```javascript
score = 0.5 // base
  + (strengths.length * 0.1)
  - (weaknesses.length * 0.1)
  - (uncertainties.length * 0.15)
  - (changeCount > 10 ? 0.1 : 0.0)

score = Math.max(0.0, Math.min(1.0, score)) // clamp [0,1]
```

**Interpretation:**
- `>= 0.8`: High confidence - safe to proceed
- `>= 0.5`: Medium confidence - review carefully
- `< 0.5`: Low confidence - needs human oversight

---

## Usage Example

### Basic Usage

```javascript
// Load the structured cycle module
const AgentCycleStructured = await loadModule('agent-cycle-structured.js');

// Execute a cycle
const result = await AgentCycleStructured.executeStructuredCycle(
  'Add dark mode toggle to settings',
  '/vfs/turn-001.cats.md' // optional context path
);

// Inspect results
console.log('Persona:', result.selected_persona);
console.log('Confidence:', result.agent_confidence_score);
console.log('Changes:', result.artifact_changes.changes.length);
console.log('Assessment:', result.self_assessment_notes.assessment);
```

### With Multi-Mind Persona

```javascript
// Load Multi-Mind Synthesis Persona
const MultiMindPersona = await loadModule('../personas/MultiMindSynthesisPersona.js');

// Inject into DI container
container.register('Persona', MultiMindPersona);

// Execute cycle (will use multi-mind deliberation)
const result = await AgentCycleStructured.executeStructuredCycle(
  'Optimize performance of rendering pipeline'
);

// Multi-mind adds additional context
console.log('Active mindsets:', MultiMindPersona.getActiveMindsets());
console.log('Deliberation prompt:', result.persona_analysis_musing);
```

### Conditional Execution Based on Confidence

```javascript
const result = await AgentCycleStructured.executeStructuredCycle(goal);

if (result.agent_confidence_score >= 0.8) {
  // High confidence - auto-apply
  console.log('High confidence. Auto-applying changes...');
  await applyChanges(result.tool_calls);

} else if (result.agent_confidence_score >= 0.5) {
  // Medium confidence - show diff for approval
  console.log('Medium confidence. Please review:');
  showDiffViewer(result.artifact_changes);

} else {
  // Low confidence - show warning
  console.warn('Low confidence detected!');
  console.warn('Uncertainties:', result.self_assessment_notes.uncertainties);
  showWarning('Agent is uncertain about this proposal. Manual review required.');
}
```

---

## Current Personas in REPLOID

### 1. CodeRefactorerPersona (Built-in)

**File:** `personas/CodeRefactorerPersona.js`
**System Prompt:** "You are a senior software engineer specializing in code quality..."

**Best for:**
- Code analysis and refactoring
- Bug fixes
- Performance optimization
- Technical debt reduction

**Tool Priority:**
1. `search_vfs`, `read_artifact` - Analysis
2. `write_artifact`, `diff_artifacts` - Modification

---

### 2. MultiMindSynthesisPersona (New!)

**File:** `personas/MultiMindSynthesisPersona.js`
**System Prompt:** "You are X, a dynamic synthesis embodying 50+ genius-level expert profiles..."

**Expertise Domains:**
- **Foundational Sciences:** Physics (Quantum Mechanics), Mathematics (Graph Theory)
- **Computing & Systems:** Hardware, OS, Distributed Systems, Browsers
- **Web Platform:** HTML/CSS/JS, Performance, A11y
- **AI/AGI:** Meta-Learning, Alignment, Strong AGI
- **Applied:** Crypto, Finance, Entrepreneurship
- **Design:** UX, Color Theory, Accessibility
- **Context:** History, Linguistics

**Best for:**
- Complex architectural decisions
- Cross-domain problems
- Research-level challenges
- AGI-related development
- Multi-perspective analysis

**Special Features:**
```javascript
// Deliberation prompt synthesis
const prompt = MultiMindPersona.getDeliberationPrompt(context);

// Select relevant minds for task
const minds = MultiMindPersona.selectRelevantMinds('performance');
// Returns: ['Physicist', 'Hardware Architect', 'Performance Optimizer']

// Enhanced prompts
const enhanced = MultiMindPersona.enhancePromptWithMultiMind(basePrompt, context);

// Confidence calibration (more conservative)
const calibration = MultiMindPersona.getConfidenceCalibration();
// high_threshold: 0.85 (vs 0.8 default)
```

---

## Comparison: Default Cycle vs Structured Cycle

| Aspect | Default (Sentinel FSM) | Structured 8-Step |
|--------|------------------------|-------------------|
| **Persona Selection** | Manual or config | AI-analyzed |
| **Deliberation** | Implicit | Explicit multi-mind |
| **Self-Assessment** | ❌ None | ✅ Detailed |
| **Confidence Score** | ❌ None | ✅ 0.0-1.0 rating |
| **Justification** | Implicit in proposal | ✅ Separate section |
| **Human Approval** | Required at 2 gates | Optional (based on confidence) |
| **Output Format** | Markdown (dogs.md) | Structured JSON |
| **Best For** | Standard workflows | Research, high-stakes decisions |

---

## Integration with Sentinel FSM

The structured cycle can be integrated into Sentinel FSM:

```javascript
// In sentinel-fsm.js PLANNING_WITH_CONTEXT state:

const useStructuredCycle = config.enableStructuredCycle || false;

if (useStructuredCycle) {
  // Use 8-step cycle
  const result = await AgentCycleStructured.executeStructuredCycle(goal, catsPath);

  // Check confidence before proceeding
  if (result.agent_confidence_score < 0.5) {
    // Show warning to user
    EventBus.emit('warning', {
      message: 'Agent confidence is low',
      uncertainties: result.self_assessment_notes.uncertainties
    });
  }

  // Convert to dogs bundle for compatibility
  const dogsBundle = convertToDogs(result.artifact_changes);
  await StateManager.setArtifactContent(dogsPath, dogsBundle);

} else {
  // Use default cycle
  await agentActionPlanWithContext();
}
```

---

## Enabling Structured Cycle

### Option 1: Add to Persona Config

In `config.json`, add to a persona's upgrades:

```json
{
  "id": "advanced_architect",
  "upgrades": [
    "STCY",  // ← Add this
    "APPL",
    "UTIL",
    // ... other upgrades
  ]
}
```

### Option 2: Enable Globally

In `config.json`, add:

```json
{
  "structuredCycle": {
    "enabled": true,
    "defaultPersona": "MultiMindSynthesisPersona",
    "confidenceThresholds": {
      "autoApply": 0.85,
      "showWarning": 0.50
    }
  }
}
```

---

## Next Steps

1. **Create Blueprint 0x000047:** Document the structured cycle architecture
2. **Add Upgrade Config:** Register `STCY` in `config.json` upgrades array
3. **Create Persona Entry:** Add `multi_mind_architect` to personas array
4. **Test Integration:** Run structured cycle with multi-mind persona
5. **Build UI:** Add confidence score visualization to diff viewer

---

## Related Files

- `upgrades/agent-cycle-structured.js` - Main implementation
- `personas/MultiMindSynthesisPersona.js` - Multi-mind persona
- `personas/CodeRefactorerPersona.js` - Built-in refactoring persona
- `upgrades/sentinel-fsm.js` - Default FSM cycle
- `upgrades/agent-cycle.js` - Default agent cycle
- `hermes/paxos_orchestrator.js` - Multi-mind deliberation prompt

---

**Ready to use the structured cycle?** Try it with the multi-mind persona for your next complex task!
