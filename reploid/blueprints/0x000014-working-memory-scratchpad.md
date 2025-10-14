# Blueprint 0x000014: Working Memory Scratchpad

**Objective:** To establish a transient working memory system for the agent to maintain context, notes, and reasoning traces within and across cycles.

**Target Upgrade:** SCRT (system-scratchpad.md)

**Prerequisites:** `0x000005` (State Management)

**Affected Artifacts:** `/system/scratchpad.md`, `/modules/agent-cycle.js`

---

### 1. The Strategic Imperative

Complex reasoning requires working memory - a space to decompose problems, track intermediate results, and maintain context across tool calls. Unlike permanent artifacts, the scratchpad is ephemeral, meant for the agent's "stream of consciousness" during problem-solving. This enables chain-of-thought reasoning and helps prevent context loss in multi-step operations.

### 2. The Architectural Solution

A markdown artifact at `/system/scratchpad.md` that serves as the agent's notepad:

**Scratchpad Structure:**
```markdown
# Cycle N Scratchpad

## Current Goal Analysis
- Main objective: [goal]
- Subgoals identified: [...]
- Constraints: [...]

## Working Notes
- [Observations and insights]
- [Hypotheses to test]
- [Questions to resolve]

## Tool Call Planning
1. First, I need to...
2. Then I will...
3. Finally...

## Intermediate Results
- Tool call 1 result: [summary]
- Tool call 2 result: [summary]

## Next Steps
- [ ] Task 1
- [ ] Task 2
```

### 3. The Implementation Pathway

1. **Initialize Scratchpad:**
   ```javascript
   // In agent-cycle.js at cycle start
   const scratchpadPath = "/system/scratchpad.md";
   const scratchpadContent = `# Cycle ${currentCycle} Scratchpad\n\n` +
     `## Goal\n${goalInfo.latestGoal}\n\n` +
     `## Working Notes\n\n` +
     `## Tool Calls\n\n` +
     `## Insights\n\n`;
   
   // Create if missing (self-healing)
   const existing = await StateManager.getArtifactMetadata(scratchpadPath);
   if (!existing) {
     await StateManager.createArtifact(scratchpadPath, "markdown", 
       scratchpadContent, "Agent working memory");
   } else {
     await StateManager.updateArtifact(scratchpadPath, scratchpadContent);
   }
   ```

2. **Update During Cycle:**
   ```javascript
   // After each tool call
   const scratchpad = await Storage.getArtifactContent("/system/scratchpad.md");
   const updated = scratchpad + `\n### Tool: ${toolName}\n` +
     `Input: ${JSON.stringify(toolArgs)}\n` +
     `Result: ${JSON.stringify(result)}\n`;
   await StateManager.updateArtifact("/system/scratchpad.md", updated);
   ```

3. **Include in Prompt Context:**
   ```javascript
   // In prompt assembly
   const scratchpadContent = await Storage.getArtifactContent("/system/scratchpad.md");
   const prompt = basePrompt + "\n\nYour working notes:\n" + scratchpadContent;
   ```

### 4. Scratchpad Patterns

**Problem Decomposition:**
```markdown
## Problem: Implement feature X
### Subproblems:
1. Understand current implementation
2. Identify integration points
3. Design solution
4. Implement changes
5. Test
```

**Hypothesis Testing:**
```markdown
## Hypothesis: The error is caused by missing dependency
### Test: Check if module exists
Result: Module not found
### Conclusion: Hypothesis confirmed
```

**Context Preservation:**
```markdown
## Context from Previous Cycle
- Discovered: API returns different format
- TODO: Update parser to handle new format
- Blocked by: Need API documentation
```

### 5. Memory Management Strategies

1. **Cycle-based Reset:** Clear at start of each cycle (current approach)
2. **Rolling Window:** Keep last N entries
3. **Importance-based:** Preserve marked important sections
4. **Topic-based:** Separate scratchpads per topic/goal

### 6. Advanced Usage

The scratchpad can evolve into a sophisticated memory system:
- **Semantic Sections:** Structured areas for different types of thinking
- **Memory Indexing:** Tag and retrieve previous insights
- **Pattern Recognition:** Identify recurring problems/solutions
- **Meta-Cognition:** Track thinking patterns and biases

The scratchpad is not just storage - it's the agent's conscious workspace where reasoning happens.