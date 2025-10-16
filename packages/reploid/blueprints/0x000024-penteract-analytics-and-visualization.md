# Blueprint 0x000024: Penteract Analytics & Visualization

**Objective:** Transform Paxos and Penteract competition telemetry into a real-time, human-auditable dashboard that guides approval decisions and future persona tuning.

**Prerequisites:** 0x000007, 0x00000D, 0x000019

**Affected Artifacts:** `/js/cats.js`, `/js/dogs.js`, `/js/progress-bus.js`, `/py/paws_paxos.py`, `/reploid/hermes/index.js`, `/reploid/upgrades/ui-manager.js`, `/reploid/upgrades/penteract-visualizer.js`

---

### 1. The Strategic Imperative
Penteract-mode competitions generate multi-agent deliberations whose value hinges on transparency. Without instrumentation, approvers face opaque “winner” selections and cannot diagnose why specific personas succeed or fail. Streaming analytics aligns PAWS with 2025 context-engineering best practices: it preserves trust, accelerates iteration, and surfaces signals that inform persona curation, verification design, and upgrade prioritisation.

### 2. The Architectural Solution
The solution establishes a pipeline from CLI telemetry to REPLOID’s UI. `cats`/`dogs` publish structured events via **ProgressBus** (`.paws/cache/progress-stream.ndjson`). Hermes’ **ProgressWatcher** tails the log and broadcasts `PROGRESS_EVENT` frames over WebSocket. The UI manager converts those into `progress:event` and `paxos:analytics` signals. The new **PenteractVisualizer** upgrade renders consensus state (status badges, agent metrics) and primes future overlays (guild heatmaps, persona win-rates). Paxos orchestrator snapshots persist to `paxos-analytics.json` so past runs fuel historical insights.

### 3. The Implementation Pathway
1. **Emit Telemetry**  
   - Call `ProgressBus.publish()` from `cats`, `dogs`, Paxos (`bundle:*`, `apply:*`, `analytics`).  
   - Keep payloads JSON-safe; append to `.paws/cache/progress-stream.ndjson`.
2. **Transport to UI**  
   - Ensure Hermes’ watcher streams tail increments to REPLOID clients.  
   - On reconnect, replay recent lines so dashboards stay warm-started.
3. **UI Integration**  
   - In `ui-manager`, bridge `PROGRESS_EVENT` → EventBus (`progress:event`, `paxos:analytics`).  
   - Log meaningful summaries in Advanced Log for audit trails.
4. **Render Analytics**  
   - Initialize `PenteractVisualizer.init('penteract-visualizer')` once layout loads.  
   - Display consensus header, agent table (status, tokens, latency), and task summary.  
   - Leave hooks for persona heatmaps, historical sparklines, and guild-specific stats.
5. **Iterate**  
   - Extend Paxos orchestrator to record guild/persona metadata.  
   - Feed analytics into decision heuristics (e.g., auto-prune failing agents, adjust temperatures).  
   - Add UI controls to compare runs, export reports, or trigger follow-up Paxos rounds.
