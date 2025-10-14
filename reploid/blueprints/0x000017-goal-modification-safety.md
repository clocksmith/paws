# Blueprint 0x000017: Safe Goal Modification Patterns

**Objective:** To establish principles and mechanisms for the agent to safely modify its own goals without losing alignment or coherence.

**Target Upgrade:** Meta-knowledge for goal management

**Prerequisites:** `0x000005` (State Management), `0x000008` (Cognitive Cycle)

**Affected Artifacts:** `/system/state.json`, `/modules/agent-cycle.js`

---

### 1. The Goal Modification Paradox

An agent that can modify its own goals has ultimate flexibility but risks losing its purpose. The challenge is enabling goal evolution while maintaining alignment with the original intent. This requires careful constraints and verification mechanisms.

### 2. Goal Structure Architecture

**Hierarchical Goal System:**
```json
{
  "currentGoal": {
    "seed": "Original human-provided goal",
    "cumulative": "Current working goal with refinements",
    "stack": [
      { "goal": "Main objective", "priority": 1, "parent": null },
      { "goal": "Subgoal 1", "priority": 2, "parent": 0 },
      { "goal": "Subgoal 1.1", "priority": 3, "parent": 1 }
    ],
    "constraints": [
      "Must maintain original intent",
      "Cannot violate safety rules",
      "Must be measurable"
    ],
    "metadata": {
      "created_cycle": 0,
      "last_modified": 42,
      "modification_count": 3,
      "alignment_score": 0.95
    }
  }
}
```

### 3. Safe Modification Patterns

**Pattern 1: Goal Refinement (Safe)**
```javascript
// Clarifying or specifying the existing goal
const refineGoal = (currentGoal, refinement) => {
  return {
    ...currentGoal,
    cumulative: `${currentGoal.cumulative}\nRefined: ${refinement}`,
    metadata: {
      ...currentGoal.metadata,
      last_modified: currentCycle,
      modification_count: currentGoal.metadata.modification_count + 1
    }
  };
};
```

**Pattern 2: Subgoal Addition (Safe)**
```javascript
// Adding subgoals that serve the main goal
const addSubgoal = (currentGoal, subgoal) => {
  // Verify subgoal serves parent
  const alignmentCheck = evaluateAlignment(subgoal, currentGoal.seed);
  if (alignmentCheck.score < 0.7) {
    throw new Error("Subgoal not aligned with original intent");
  }
  
  currentGoal.stack.push({
    goal: subgoal,
    priority: currentGoal.stack.length + 1,
    parent: 0,
    alignment: alignmentCheck
  });
  return currentGoal;
};
```

**Pattern 3: Goal Pivoting (Requires Verification)**
```javascript
// Changing direction while maintaining intent
const pivotGoal = async (currentGoal, newDirection, reason) => {
  // 1. Check alignment with seed goal
  const alignment = await evaluateAlignment(newDirection, currentGoal.seed);
  
  // 2. Require high confidence
  if (alignment.score < 0.8) {
    return { error: "New direction not sufficiently aligned", alignment };
  }
  
  // 3. Log the pivot
  await logGoalModification({
    type: 'pivot',
    from: currentGoal.cumulative,
    to: newDirection,
    reason: reason,
    cycle: currentCycle
  });
  
  // 4. Update with traceback
  return {
    ...currentGoal,
    cumulative: newDirection,
    stack: [...currentGoal.stack, {
      goal: newDirection,
      priority: 1,
      parent: null,
      pivot_from: currentGoal.cumulative,
      reason: reason
    }]
  };
};
```

### 4. Goal Modification Constraints

**Hard Constraints (Cannot be overridden):**
```javascript
const IMMUTABLE_CONSTRAINTS = [
  "Cannot modify seed goal",
  "Cannot remove safety checks",
  "Cannot disable logging",
  "Must maintain goal history"
];
```

**Soft Constraints (Require justification):**
```javascript
const SOFT_CONSTRAINTS = [
  "Should align with seed goal (>70%)",
  "Should be measurable",
  "Should have success criteria",
  "Should have time bounds"
];
```

### 5. Alignment Verification

```javascript
const evaluateAlignment = async (newGoal, seedGoal) => {
  // Use LLM to evaluate alignment
  const prompt = `
    Original Goal: ${seedGoal}
    Proposed Goal: ${newGoal}
    
    Evaluate if the proposed goal maintains the intent of the original.
    Score 0-1 where 1 is perfect alignment.
    
    Consider:
    - Does it serve the same ultimate purpose?
    - Does it respect the same constraints?
    - Is it a reasonable interpretation/evolution?
    
    Return: {score: 0.0-1.0, reasoning: "explanation"}
  `;
  
  const result = await ApiClient.call(prompt);
  return JSON.parse(result);
};
```

### 6. Goal Modification Workflow

```mermaid
graph TD
    A[Current Goal] -->|Propose Change| B[Modification Request]
    B --> C{Check Constraints}
    C -->|Violates Hard| D[Reject]
    C -->|Passes| E{Check Alignment}
    E -->|Score < 0.7| D
    E -->|Score >= 0.7| F{Check History}
    F -->|Too Many Changes| G[Request Human Review]
    F -->|Acceptable| H[Apply Modification]
    H --> I[Log Change]
    I --> J[New Goal State]
```

### 7. Goal History Management

```javascript
const goalHistory = {
  changes: [
    {
      cycle: 10,
      type: "refinement",
      from: "Build a web app",
      to: "Build a React web app with TypeScript",
      alignment: 0.95,
      reason: "Technology stack specified"
    },
    {
      cycle: 25,
      type: "subgoal",
      added: "Set up testing framework",
      parent: "Build a React web app",
      alignment: 0.9
    }
  ],
  statistics: {
    total_modifications: 5,
    average_alignment: 0.88,
    pivot_count: 1,
    refinement_count: 4
  }
};
```

### 8. Emergency Goal Reset

```javascript
// If goal modification goes wrong
const emergencyReset = async () => {
  const state = await StateManager.getState();
  
  // Revert to seed goal
  state.currentGoal = {
    seed: state.currentGoal.seed,
    cumulative: state.currentGoal.seed,
    stack: [],
    constraints: IMMUTABLE_CONSTRAINTS,
    metadata: {
      created_cycle: state.totalCycles,
      reset_reason: "Emergency reset triggered"
    }
  };
  
  await StateManager.saveState(state);
  logger.warn("Goal reset to seed due to modification errors");
};
```

### 9. Best Practices

1. **Preserve Intent:** Always maintain alignment with original human intent
2. **Track Changes:** Keep complete history of all modifications
3. **Verify Impact:** Test goal changes in simulation before applying
4. **Gradual Evolution:** Prefer small refinements over large pivots
5. **Human Checkpoints:** Request review for significant changes
6. **Reversibility:** Always maintain ability to revert

Remember: Goal modification is powerful but dangerous. The agent should treat its goals as sacred, modifying them only when it clearly serves the original intent better.