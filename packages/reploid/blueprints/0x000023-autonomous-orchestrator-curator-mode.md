# Blueprint 0x000023: Autonomous Orchestrator - Curator Mode

**Module ID:** AUOR
**Module Path:** `upgrades/autonomous-orchestrator.js`
**Category:** Service
**Status:** Implemented
**Version:** 1.0.0
**Created:** 2025-10-05

---

## Overview

The Autonomous Orchestrator enables **Curator Mode** - a safe, overnight autonomous proposal generation system that operates without human intervention while maintaining critical safety boundaries. This blueprint documents the architecture, safety mechanisms, and integration patterns for autonomous RSI agent operation.

**Core Principle:** Auto-approve context curation, NEVER auto-approve proposals. Generate proposals overnight for human review in the morning.

---

## 1. Purpose & Mission Alignment

### 1.1 RSI Mission Alignment

Curator Mode directly supports REPLOID's core Recursive Self-Improvement (RSI) mission:

1. **Self-Modification** - Generates proposals for code improvements autonomously
2. **Meta-Learning** - Learns from proposal generation patterns across sessions
3. **Safe Experimentation** - Operates in read-only mode until human approval
4. **Browser-Native** - Leverages browser persistence for session history and reports

### 1.2 Use Cases

**Overnight Autonomous Operation:**
- Leave agent running overnight with 3 goals
- Agent generates 7 proposals per goal (21 total proposals)
- Wake up to visual HTML report with all proposals ready for review
- Review and selectively apply proposals in morning

**Example Goals:**
```javascript
[
  "Analyze all modules for performance optimization opportunities",
  "Generate test cases for untested functions in core modules",
  "Create RFC proposals for missing blueprint documentation"
]
```

**Output:**
- 21 `.dogs.md` proposal files in VFS
- 1 interactive HTML report with timeline and stats
- 1 JSON report for programmatic analysis

---

## 2. Architecture

### 2.1 Module Structure

```javascript
const AutonomousOrchestrator = {
  metadata: {
    id: 'AutonomousOrchestrator',
    version: '1.0.0',
    dependencies: ['config', 'Utils', 'StateManager', 'EventBus', 'Storage'],
    async: false,
    type: 'service'
  },
  factory: (deps) => {
    // Returns API with lifecycle controls
  }
};
```

### 2.2 Configuration Schema

**File:** `config.json`

```json
{
  "curatorMode": {
    "enabled": false,
    "autoApproveContext": true,
    "autoApproveProposal": false,  // CRITICAL: Always false for safety
    "maxProposalsPerGoal": 7,
    "iterationDelay": 5000,  // 5 seconds between iterations
    "defaultGoals": [
      "Analyze all modules for performance optimization opportunities",
      "Generate test cases for untested functions in core modules",
      "Create RFC proposals for missing blueprint documentation"
    ]
  }
}
```

### 2.3 State Machine

```
┌─────────────────────────────────────────────────────┐
│                  CURATOR MODE LOOP                   │
└─────────────────────────────────────────────────────┘

START
  │
  ├─> For Each Goal (e.g., 3 goals)
  │     │
  │     ├─> For Each Proposal (max 7 per goal)
  │     │     │
  │     │     ├─> Trigger Agent Cycle: EventBus.emit('goal:set', goal)
  │     │     │
  │     │     ├─> CURATING_CONTEXT
  │     │     │     └─> Auto-approve context ✓
  │     │     │
  │     │     ├─> PLANNING_WITH_CONTEXT
  │     │     │     └─> Generate proposal via LLM
  │     │     │
  │     │     ├─> AWAITING_PROPOSAL_APPROVAL
  │     │     │     └─> STOP HERE (human review required) ✗
  │     │     │
  │     │     ├─> Record proposal in sessionHistory[]
  │     │     │
  │     │     └─> Wait 5 seconds (iterationDelay)
  │     │
  │     └─> Move to next goal
  │
  └─> END
      └─> Generate HTML + JSON reports
```

---

## 3. Safety Mechanisms

### 3.1 Critical Safety Rules

**RULE 1: Never Auto-Apply**
```javascript
autoApproveProposal: false  // Hardcoded in config, never override
```

**RULE 2: Human-in-the-Loop Gate**
```javascript
// In agent-cycle.js
transitionTo('AWAITING_PROPOSAL_APPROVAL');
// Curator Mode does NOT bypass this state
// Agent waits indefinitely for user approval
```

**RULE 3: Iteration Limits**
```javascript
maxProposalsPerGoal: 7  // Prevents runaway generation
```

**RULE 4: Delay Between Iterations**
```javascript
iterationDelay: 5000  // Rate limiting to prevent API abuse
```

### 3.2 Failure Handling

```javascript
try {
  EventBus.emit('goal:set', currentGoal);
} catch (error) {
  logger.error('[Curator] Iteration failed:', error);
  sessionHistory[sessionHistory.length - 1].status = 'error';
  sessionHistory[sessionHistory.length - 1].error = error.message;

  // Continue to next iteration (don't halt entire session)
  setTimeout(runNextIteration, CURATOR_CONFIG.iterationDelay);
}
```

---

## 4. Integration with Agent Cycle

### 4.1 Dependency Injection

**File:** `upgrades/agent-cycle.js`

```javascript
const CycleLogic = {
  metadata: {
    id: 'CycleLogic',
    version: '3.1.0',
    dependencies: [
      'config', 'Utils', 'StateManager', 'ApiClient',
      'HybridLLMProvider', 'ToolRunner', 'EventBus',
      'AutonomousOrchestrator?'  // Optional dependency
    ]
  },

  factory: (deps) => {
    const { AutonomousOrchestrator } = deps;

    const isCuratorMode = () =>
      AutonomousOrchestrator && AutonomousOrchestrator.isRunning();
  }
};
```

### 4.2 Auto-Approval Logic

**Context Approval (Auto-Approve):**
```javascript
// In agentActionCurateContext()
if (isCuratorMode()) {
  logger.info('[Curator] Auto-approving context');
  transitionTo('PLANNING_WITH_CONTEXT');
  await agentActionPlanWithContext();
} else {
  transitionTo('AWAITING_CONTEXT_APPROVAL');
}
```

**Proposal Approval (NEVER Auto-Approve):**
```javascript
// In agentActionPlanWithContext()
// Always wait for human review
transitionTo('AWAITING_PROPOSAL_APPROVAL');
```

---

## 5. Event System

### 5.1 Emitted Events

**Lifecycle Events:**
```javascript
EventBus.emit('curator:started', {
  goals: CURATOR_CONFIG.goals,
  maxProposalsPerGoal: CURATOR_CONFIG.maxProposalsPerGoal,
  startTime: Date.now()
});

EventBus.emit('curator:stopped', { report });

EventBus.emit('curator:report:saved', {
  jsonPath: reportPath,
  htmlPath: htmlPath,
  report: reportData
});
```

**Iteration Events:**
```javascript
EventBus.emit('curator:iteration:start', {
  id: currentIteration,
  goalIndex: currentGoalIndex,
  goal: currentGoal,
  proposalNumber: proposalsForCurrentGoal + 1,
  startTime: Date.now()
});

EventBus.emit('curator:iteration:complete', {
  id: iteration.id,
  status: 'completed',
  duration: iteration.duration,
  proposalPath: event.proposalPath
});
```

### 5.2 Subscribed Events

**Agent State Changes:**
```javascript
EventBus.on('agent:state:change', (event) => {
  if (isRunning && event.newState === 'AWAITING_PROPOSAL_APPROVAL') {
    handleProposalGenerated({ proposalPath: event.context?.turn?.dogs_path });
  }
});
```

**Error Handling:**
```javascript
EventBus.on('agent:error', handleCycleError);
```

---

## 6. Visual Reporting System

### 6.1 HTML Report Features

**Design Principles:**
- Dark theme (matches REPLOID aesthetic)
- Monospace fonts (developer-friendly)
- Gradient backgrounds (visual polish)
- Responsive grid layout

**Sections:**

**1. Summary Metrics (4 cards):**
```
┌─────────────┬─────────────┬─────────────┬─────────────┐
│   Total     │   Success   │   Total     │     Avg     │
│ Proposals   │    Rate     │  Duration   │  Iteration  │
│     21      │   95.2%     │   12.3 min  │   35.2 sec  │
└─────────────┴─────────────┴─────────────┴─────────────┘
```

**2. Goals Summary:**
```
┌──────────────────────────────────────────────────────┐
│ Goal 1: Analyze modules for performance              │
│ ✓ 7 proposals  ✗ 0 errors                           │
├──────────────────────────────────────────────────────┤
│ Goal 2: Generate test cases for core modules         │
│ ✓ 7 proposals  ✗ 0 errors                           │
├──────────────────────────────────────────────────────┤
│ Goal 3: Create RFC proposals for blueprints          │
│ ✓ 6 proposals  ✗ 1 errors                           │
└──────────────────────────────────────────────────────┘
```

**3. Iteration Timeline:**
```
┌──────────────────────────────────────────────────────┐
│ Iteration #1 - Goal 1 - Proposal 1  [COMPLETED]     │
│ Analyze modules for performance                      │
│                                          32.5s       │
├──────────────────────────────────────────────────────┤
│ Iteration #2 - Goal 1 - Proposal 2  [COMPLETED]     │
│ Analyze modules for performance                      │
│                                          28.1s       │
├──────────────────────────────────────────────────────┤
│ Iteration #8 - Goal 2 - Proposal 1  [ERROR]         │
│ Generate test cases for core modules                 │
│ Error: API rate limit exceeded                       │
│                                          —           │
└──────────────────────────────────────────────────────┘
```

### 6.2 Report Storage

**VFS Paths:**
```
/sessions/curator-reports/
  ├── report-curator-1728086400000.json   # JSON data
  └── report-curator-1728086400000.html   # Visual report
```

**JSON Structure:**
```json
{
  "sessionId": "curator-1728086400000",
  "startTime": 1728086400000,
  "endTime": 1728087200000,
  "totalDuration": 800000,
  "totalIterations": 21,
  "totalProposals": 20,
  "goals": [
    {
      "goal": "Analyze modules for performance",
      "index": 0,
      "proposals": 7,
      "errors": 0
    }
  ],
  "iterations": [
    {
      "id": 1,
      "goalIndex": 0,
      "goal": "Analyze modules for performance",
      "proposalNumber": 1,
      "startTime": 1728086400000,
      "endTime": 1728086432500,
      "duration": 32500,
      "status": "completed",
      "proposalPath": "/sessions/session-123/turn-001/proposal.dogs.md"
    }
  ],
  "averageDuration": 35200
}
```

---

## 7. API Reference

### 7.1 Public API

**Start Curator Mode:**
```javascript
const AutonomousOrchestrator = DIContainer.get('AutonomousOrchestrator');

const result = await AutonomousOrchestrator.startCuratorMode([
  "Analyze all modules for performance optimization",
  "Generate test cases for untested functions",
  "Create RFC proposals for missing blueprints"
]);

// Returns:
// {
//   success: true,
//   message: "Curator mode started with 3 goals",
//   sessionId: "curator-1728086400000"
// }
```

**Stop Curator Mode:**
```javascript
const result = AutonomousOrchestrator.stopCuratorMode();

// Returns:
// {
//   success: true,
//   totalProposals: 20,
//   report: { ... }  // Full report object
// }
```

**Get Current Status:**
```javascript
const status = AutonomousOrchestrator.getCurrentStatus();

// Returns:
// {
//   running: true,
//   iteration: 15,
//   goalIndex: 2,
//   proposalsForCurrentGoal: 1,
//   totalProposals: 14
// }
```

**Update Configuration:**
```javascript
AutonomousOrchestrator.updateConfig({
  maxProposalsPerGoal: 10,
  iterationDelay: 10000  // 10 seconds
});
```

---

## 8. UI Integration Patterns

### 8.1 Dashboard Controls

**Recommended UI:**
```html
<div class="curator-mode-panel">
  <h3>🤖 Curator Mode</h3>

  <!-- Status Indicator -->
  <div class="status-indicator">
    <span class="status-badge">Idle</span>
    <span class="proposals-count">0 proposals generated</span>
  </div>

  <!-- Configuration -->
  <div class="config-section">
    <label>Max Proposals per Goal:</label>
    <input type="number" id="max-proposals" value="7" min="1" max="20" />

    <label>Iteration Delay (ms):</label>
    <input type="number" id="iteration-delay" value="5000" min="1000" max="30000" />
  </div>

  <!-- Goals Input -->
  <div class="goals-section">
    <label>Goals (one per line):</label>
    <textarea id="curator-goals" rows="5">
Analyze all modules for performance optimization
Generate test cases for untested functions
Create RFC proposals for missing blueprints
    </textarea>
  </div>

  <!-- Controls -->
  <div class="controls">
    <button id="start-curator" class="btn-primary">Start Curator Mode</button>
    <button id="stop-curator" class="btn-danger" disabled>Stop</button>
    <button id="view-reports" class="btn-secondary">View Reports</button>
  </div>

  <!-- Live Progress -->
  <div class="progress-section">
    <progress id="curator-progress" max="21" value="0"></progress>
    <span class="progress-text">Iteration <span id="current-iteration">0</span> / <span id="total-iterations">0</span></span>
  </div>
</div>
```

### 8.2 Event Listeners

```javascript
// Start button
document.getElementById('start-curator').addEventListener('click', async () => {
  const goals = document.getElementById('curator-goals').value
    .split('\n')
    .map(g => g.trim())
    .filter(g => g.length > 0);

  const config = {
    maxProposalsPerGoal: parseInt(document.getElementById('max-proposals').value),
    iterationDelay: parseInt(document.getElementById('iteration-delay').value)
  };

  AutonomousOrchestrator.updateConfig(config);
  await AutonomousOrchestrator.startCuratorMode(goals);
});

// Status updates
EventBus.on('curator:iteration:complete', (event) => {
  const status = AutonomousOrchestrator.getCurrentStatus();
  document.querySelector('.proposals-count').textContent =
    `${status.totalProposals} proposals generated`;
  document.getElementById('curator-progress').value = status.iteration;
  document.getElementById('current-iteration').textContent = status.iteration;
});

// Report saved
EventBus.on('curator:report:saved', (event) => {
  showToast(`Report saved: ${event.htmlPath}`, 'success');
  // Auto-open report in new tab
  window.open(event.htmlPath, '_blank');
});
```

---

## 9. Testing & Validation

### 9.1 Manual Testing Checklist

**Basic Functionality:**
- [ ] Start Curator Mode with 3 goals, 7 proposals per goal
- [ ] Verify context is auto-approved (no UI prompt)
- [ ] Verify proposals stop at AWAITING_PROPOSAL_APPROVAL
- [ ] Check iteration delay is respected (5 seconds)
- [ ] Confirm all 21 proposals are generated
- [ ] Verify HTML report is saved to VFS
- [ ] Open HTML report and check all sections render
- [ ] Verify JSON report has correct structure

**Error Handling:**
- [ ] Test with invalid API key (should record error, continue)
- [ ] Test with rate limit exceeded (should delay, retry)
- [ ] Test stopping mid-session (should generate partial report)

**Safety:**
- [ ] Verify proposals are NEVER auto-applied
- [ ] Confirm context auto-approval only happens in Curator Mode
- [ ] Test that normal mode still requires human context approval

### 9.2 Integration Testing

```javascript
// Test Curator Mode lifecycle
describe('AutonomousOrchestrator', () => {
  it('should generate 7 proposals per goal', async () => {
    const goals = [
      'Analyze performance',
      'Generate tests'
    ];

    await AutonomousOrchestrator.startCuratorMode(goals);

    // Wait for completion (mocked agent cycles)
    await waitForEvent('curator:stopped');

    const status = AutonomousOrchestrator.getCurrentStatus();
    expect(status.totalProposals).toBe(14);
  });

  it('should never auto-approve proposals', async () => {
    await AutonomousOrchestrator.startCuratorMode(['Test goal']);

    // Mock agent reaching AWAITING_PROPOSAL_APPROVAL
    EventBus.emit('agent:state:change', {
      newState: 'AWAITING_PROPOSAL_APPROVAL'
    });

    // Should NOT transition to APPLYING_CHANGESET
    const state = CycleLogic.getCurrentState();
    expect(state).toBe('AWAITING_PROPOSAL_APPROVAL');
  });
});
```

---

## 10. Future Enhancements

### 10.1 Planned Features (Not Yet Implemented)

**1. Proposal Quality Scoring:**
- Auto-analyze proposals with introspector
- Rank by complexity/impact
- Surface best proposals first in UI

**2. Git Worktree Isolation:**
- Run in isolated worktree `/worktrees/curator-lab/`
- Can be discarded entirely if all proposals are bad
- Branch: `curator-YYYY-MM-DD`

**3. Smart Goal Rotation:**
- Learn which goals produce best proposals
- Auto-suggest goals based on reflection history
- Prioritize high-value areas

**4. Multi-Agent Swarm:**
- Parallel proposal generation
- Each goal assigned to different agent instance
- Coordinate via `swarm-orchestrator.js`

### 10.2 Configuration Extensions

```json
{
  "curatorMode": {
    "enabled": false,
    "autoApproveContext": true,
    "autoApproveProposal": false,
    "maxProposalsPerGoal": 7,
    "iterationDelay": 5000,

    // Future extensions
    "useGitWorktree": true,
    "worktreePath": "/worktrees/curator-lab/",
    "autoRankProposals": true,
    "parallelGoals": false,
    "maxParallelWorkers": 3
  }
}
```

---

## 11. Comparison with Other Modes

| Feature | Manual Mode | Curator Mode | Sandbox Lab Mode (Future) |
|---------|-------------|--------------|---------------------------|
| **Context Approval** | Human | Auto | Auto |
| **Proposal Approval** | Human | Human | Auto (with tests) |
| **Changes Applied** | Manual | Manual | Auto (in worktree) |
| **Git Isolation** | None | None | Worktree |
| **Safety Level** | High | High | Medium |
| **Overnight Use** | No | Yes | Yes |
| **Max Proposals** | Unlimited | 7 per goal | 25 total |

---

## 12. Security Considerations

### 12.1 Safety Boundaries

**Read-Only Operations:**
- Context curation: Read files from VFS ✓
- LLM inference: Generate text proposals ✓
- Report generation: Write to `/sessions/curator-reports/` ✓

**Write Operations (Requires Human Approval):**
- Applying proposals: BLOCKED until human clicks "Approve" ✗
- Modifying source code: BLOCKED ✗
- Deleting files: BLOCKED ✗

### 12.2 API Cost Controls

**Rate Limiting:**
```javascript
iterationDelay: 5000  // 5 seconds between API calls

// With 21 proposals:
// Total time = 21 * 5s = 105 seconds minimum
// Plus LLM inference time (30-60s each) = ~20-30 minutes total
```

**Token Limits:**
```javascript
// In HybridLLMProvider
maxOutputTokens: 8192  // Per proposal

// With 21 proposals:
// Max tokens = 21 * 8192 = ~172k tokens output
// At $0.10/1M tokens (Gemini Flash) = $0.02 per session
```

### 12.3 Runaway Prevention

**Hard Limits:**
```javascript
maxProposalsPerGoal: 7       // No more than 7 per goal
goals.length <= 10           // Max 10 goals (70 proposals)
iterationDelay >= 1000       // Minimum 1 second delay
```

**Graceful Shutdown:**
```javascript
// User can stop at any time
AutonomousOrchestrator.stopCuratorMode();

// Generates partial report with completed proposals
```

---

## 13. Example Session Output

**Input:**
```javascript
await AutonomousOrchestrator.startCuratorMode([
  "Analyze all modules for performance optimization opportunities",
  "Generate test cases for untested functions in core modules",
  "Create RFC proposals for missing blueprint documentation"
]);
```

**After 20 minutes (overnight run):**

**Generated Files (21 total):**
```
/sessions/session-abc123/
  ├── turn-001/proposal.dogs.md  (Goal 1, Proposal 1)
  ├── turn-002/proposal.dogs.md  (Goal 1, Proposal 2)
  ├── ...
  └── turn-021/proposal.dogs.md  (Goal 3, Proposal 7)

/sessions/curator-reports/
  ├── report-curator-1728086400000.html
  └── report-curator-1728086400000.json
```

**Morning Workflow:**
1. Open `report-curator-1728086400000.html` in browser
2. Review 21 proposals in visual timeline
3. Click proposal paths to open `.dogs.md` files
4. Selectively approve best proposals (e.g., 5 out of 21)
5. Apply approved changes via Sentinel Agent
6. Commit results to Git

---

## 14. Conclusion

The Autonomous Orchestrator (Curator Mode) enables REPLOID to operate overnight, generating high-quality code proposals while maintaining human-in-the-loop safety. By auto-approving context curation but requiring human approval for all changes, it strikes the perfect balance between automation and control.

**Key Benefits:**
- ✓ Wake up to 21 actionable proposals
- ✓ Beautiful visual reports with metrics
- ✓ Zero risk (proposals never auto-applied)
- ✓ Low cost (~$0.02 per session with Gemini Flash)
- ✓ Fully integrated with Sentinel Agent FSM

**Future Evolution:**
- Git worktree isolation (Sandbox Lab Mode)
- Multi-agent swarm coordination
- Auto-ranking of proposals by quality
- Smart goal suggestion based on reflection history

---

**Blueprint Version:** 1.0.0
**Author:** REPLOID Core Team
**Last Updated:** 2025-10-05
**Related Blueprints:** 0x000008 (Agent Cycle), 0x000005 (State Management), 0x00001B (Introspection)
