# Agent Progress UI & Workflow Guide

## Overview

The **Agent Progress UI** shows the current state of REPLOID's autonomous cycle through a visual progress tracker. It displays which step the agent is on, how long it's been running, and token usage.

## What Module Powers This?

The progress tracker is managed by **multiple coordinated modules**:

1. **SentinelFSM** (`upgrades/core/sentinel-fsm.js`) - State machine that drives the workflow
2. **UI Manager** (`upgrades/ui/ui-manager.js`) - Displays progress visually
3. **SentinelPanel** (`upgrades/ui/sentinel-panel.js`) - Handles human approval UI

## The Agent Cycle States

The progress tracker shows these states in order:

### 1. IDLE (○ Idle)
- **What**: Agent is waiting for a goal
- **Automatic**: N/A
- **Manual**: User must set a goal and click "Awaken Agent"

### 2. CURATING_CONTEXT (⚙ Curating)
- **What**: Agent uses LLM to select relevant files for the task
- **Automatic**: ✅ Yes - AI automatically chooses 5-15 files
- **Duration**: ~15-30s (shows elapsed time + token count)
- **Module**: `SentinelTools.curateFilesWithAI()`

### 3. AWAITING_CONTEXT_APPROVAL (⏸ Approve Context)
- **What**: Agent shows you which files it wants to read
- **Automatic**: ❌ **NO - REQUIRES HUMAN APPROVAL**
- **Can Skip**: ✅ Yes! Use the auto-approve toggle (see below)
- **UI**: Sentinel Panel shows file list, you click "✓ Approve" or "⟲ Revise"

### 4. PLANNING_WITH_CONTEXT (◐ Planning)
- **What**: Agent reads the approved files and starts planning
- **Automatic**: ✅ Yes - no user interaction
- **Duration**: ~1-5s

### 5. GENERATING_PROPOSAL (✎ Generating)
- **What**: Agent generates specific code changes using LLM
- **Automatic**: ✅ Yes - AI writes proposed changes
- **Duration**: ~30-90s (shows elapsed time + token count)
- **Module**: `HybridLLM.complete()` with full context

### 6. AWAITING_PROPOSAL_APPROVAL (⏸ Approve Proposal)
- **What**: Agent shows you the proposed code changes
- **Automatic**: ❌ **NO - REQUIRES HUMAN APPROVAL**
- **Can Skip**: ❌ No - this approval cannot be automated (safety critical)
- **UI**: Sentinel Panel shows diffs, you click "✓ Approve" or "⟲ Revise"

### 7. APPLYING_CHANGESET (▶ Applying)
- **What**: Agent writes the approved changes to VFS
- **Automatic**: ✅ Yes - applies changes
- **Duration**: ~1-5s

### 8. REFLECTING (◐ Reflecting)
- **What**: Agent analyzes what it did and learns
- **Automatic**: ✅ Yes - self-reflection
- **Duration**: ~5-10s
- **Then**: Returns to IDLE for next cycle

## Automatic vs Manual Steps Summary

| Step | Automatic? | Can Skip Approval? |
|------|-----------|-------------------|
| Set Goal | ❌ Manual | N/A |
| Curating Context | ✅ Auto | N/A |
| **Approve Context** | ❌ **Manual** | ✅ **Yes (toggle)** |
| Planning | ✅ Auto | N/A |
| Generating Proposal | ✅ Auto | N/A |
| **Approve Proposal** | ❌ **Manual** | ❌ **No (safety)** |
| Applying | ✅ Auto | N/A |
| Reflecting | ✅ Auto | N/A |

## The Auto-Approve Toggle

### Location
The toggle is in the **Sentinel Panel** (top-right area, small lock icon 🔒/🔓).

### What It Does
- **OFF (🔒)**: You must manually approve context selection (default)
- **ON (🔓)**: Agent automatically approves context and skips to planning

### How to Enable
1. Look for the Sentinel Panel (shows "Awaiting Approval" states)
2. Find the "🔒 Auto-Approve" button in the header
3. Click it - changes to "🔓 Auto-Approve" (green)
4. Setting persists in localStorage

### What Gets Auto-Approved
- **Context approval ONLY** - which files to read
- **NOT proposal approval** - code changes still need human review

### Why Is This Useful?
If you trust the AI's file selection, you can skip the manual approval step and speed up the cycle. The agent will automatically proceed from "Curating" → "Planning" → "Generating" without stopping.

## Streaming Indicators Explained

### Time Display
- Example: `27s` means the step has been running for 27 seconds
- Updates every second during LLM calls
- Pulsing animation indicates active processing

### Token Count Display
- Example: `27s · 1,245t` means 1,245 tokens used so far
- `t` = total tokens (input + output)
- Only shows during LLM-heavy states (Curating, Generating)
- Helps you understand API costs

## How to Speed Up the Cycle

1. **Enable Auto-Approve** - Skip context approval (safe)
2. **Use Local LLM** - Faster than cloud API (Ollama)
3. **Smaller Models** - Faster generation, lower quality
4. **Focused Goals** - Clearer goals = faster curation

## How to Make It Fully Automatic

You **cannot** make it fully automatic because:
- **Context approval** - Can be automated with toggle ✅
- **Proposal approval** - Cannot be automated (safety) ❌

The proposal approval is intentionally manual to prevent the agent from making unwanted code changes. This is a core safety feature of REPLOID.

## Troubleshooting

### "Stuck on Curating Context"
- Check network connection to Ollama/API
- Look at browser console for errors
- LLM might be taking a long time (wait up to 60s)

### "Auto-Approve Not Working"
- Make sure toggle shows 🔓 (unlocked)
- Check localStorage: `reploid_auto_approve` should be `true`
- Refresh page if toggle state is stale

### "No Token Count Showing"
- Tokens only display during streaming states
- Some providers don't return token counts
- Check EventBus is emitting `llm:tokens` events

## Technical Implementation

### State Machine
- File: `upgrades/core/sentinel-fsm.js`
- Pattern: Finite State Machine (FSM)
- Transitions: `transitionTo(newState)` → emits EventBus event → UI updates

### Event Flow
```
SentinelFSM.transitionTo('CURATING_CONTEXT')
  ↓
EventBus.emit('fsm:state:changed', { oldState, newState, context })
  ↓
UIManager.handleStateChange({ newState, context })
  ↓
updateProgressTracker(newState) → Updates visual display
```

### Token Tracking
```
HybridLLM.complete(messages) → Returns { text, usage: { totalTokens } }
  ↓
EventBus.emit('llm:tokens', { usage })
  ↓
UIManager listens → Updates streamingTokens variable
  ↓
Progress display updates with token count
```

## Related Files

- State Machine: `upgrades/core/sentinel-fsm.js`
- Progress Tracker: `upgrades/ui/ui-manager.js` (lines 5228-5299)
- Sentinel Panel: `upgrades/ui/sentinel-panel.js`
- Token Events: `upgrades/core/sentinel-tools.js` (line 172)
- Auto-Approve Logic: `upgrades/ui/sentinel-panel.js` (lines 84-93, 144-147)

---

**Generated for REPLOID users - Last updated: 2025-10-29**
