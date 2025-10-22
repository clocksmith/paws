# Blueprint 0x000024: Penteract Analytics & Visualization

**Objective:** Transform Arena and Penteract competition telemetry into a real-time, human-auditable dashboard that guides approval decisions and future persona tuning.

**Target Upgrade:** PAXA (`penteract-analytics.js`)


**Prerequisites:** 0x000007, 0x00000D, 0x000019

**Affected Artifacts:** `/js/cats.js`, `/js/dogs.js`, `/js/progress-bus.js`, `/py/paws_arena.py`, `/reploid/upgrades/ui-manager.js`, `/reploid/upgrades/penteract-visualizer.js`

---

### 1. The Strategic Imperative
Penteract-mode competitions generate multi-agent deliberations whose value hinges on transparency. Without instrumentation, approvers face opaque “winner” selections and cannot diagnose why specific personas succeed or fail. Streaming analytics aligns PAWS with 2025 context-engineering best practices: it preserves trust, accelerates iteration, and surfaces signals that inform persona curation, verification design, and upgrade prioritisation.

### 2. The Architectural Solution
The solution is implemented as a **Web Component widget** that aggregates Arena telemetry into actionable analytics for visualization.

```javascript
// Web Component class pattern
class PenteractAnalyticsWidget extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    this._updateListener = () => this.render();
    EventBus.on('arena:analytics:processed', this._updateListener, 'PenteractAnalyticsWidget');
  }

  disconnectedCallback() {
    if (this._updateListener) {
      EventBus.off('arena:analytics:processed', this._updateListener);
    }
  }

  getStatus() {
    const totalRuns = history.length;
    const successRate = totalRuns > 0 ? Math.round((successCount / totalRuns) * 100) : 0;
    let state = 'idle';
    if (latest?.consensus?.status === 'success') state = 'active';
    else if (latest?.consensus?.status === 'failed') state = 'error';
    return {
      state,
      primaryMetric: `${totalRuns} runs`,
      secondaryMetric: `${successRate}% success`,
      lastActivity: latest?.timestamp ? new Date(latest.timestamp).getTime() : null
    };
  }

  render() {
    // Shadow DOM with analytics dashboard
    this.shadowRoot.innerHTML = `<style>...</style><div>...</div>`;
  }
}
```

Data flow:
- `cats`/`dogs` publish structured events via **ProgressBus** (`.paws/cache/progress-stream.ndjson`).
- **ProgressWatcher** tails the log and broadcasts `PROGRESS_EVENT` frames.
- UI manager converts those into `progress:event` and `arena:analytics` signals.
- **PenteractAnalytics** listens to `EventBus.on('arena:analytics')` and processes snapshots.
- Widget renders consensus state (status badges, agent metrics) and historical analytics.
- Arena snapshots persist to `arena-analytics.json` for historical insights.
- **Widget Protocol**
  - Exports `widget` metadata: `{ element, displayName, icon, category, order }`.
  - Provides `getStatus()` with 5 required fields for dashboard integration.
  - Auto-updates when new analytics are processed.

### 3. The Implementation Pathway
1. **Web Component Registration**
   - Define `PenteractAnalyticsWidget` extending `HTMLElement`.
   - Register custom element: `customElements.define('penteract-analytics-widget', PenteractAnalyticsWidget)`.
   - Export widget metadata: `{ element, displayName: 'Penteract Analytics', icon: '▤', category: 'arena', order: 85 }`.
2. **Lifecycle: connectedCallback**
   - Call `attachShadow({ mode: 'open' })` in constructor.
   - Subscribe to `EventBus.on('arena:analytics:processed')` for real-time updates.
   - Render Shadow DOM with analytics dashboard.
3. **Lifecycle: disconnectedCallback**
   - Unsubscribe from EventBus listener to prevent memory leaks.
4. **Module Initialization**
   - Call `init()` to load history from `/analytics/penteract-analytics.json`.
   - Subscribe to `EventBus.on('arena:analytics', handleSnapshot)`.
   - Emit latest analytics if available.
5. **Analytics Processing**
   - Listen for `arena:analytics` events with snapshot data.
   - Normalize agent data: status, execution_time, token_count, solution_path, error.
   - Analyze agents: totals (pass/fail/error), averages (tokens/time), fastest/most expensive.
   - Build recommendations based on consensus status and metrics.
   - Enrich snapshot with metrics and recommendations.
   - Store in history (last 20 runs) and persist to StateManager.
   - Emit `arena:analytics:processed` event.
6. **Shadow DOM Rendering**
   - Render inline `<style>` with monospace font and cyberpunk theme.
   - Display controls: "Clear History" button.
   - Show stats grid: total runs, success count, failed count, success rate.
   - Display latest run: timestamp, status, agent count, avg tokens, avg time, recommendations.
   - List recent runs (last 10) with timestamp, status, agent counts, pass/fail ratio.
7. **getStatus() Method**
   - Return object with `state` (active if latest run successful, error if failed, idle otherwise).
   - Include `primaryMetric` (total runs), `secondaryMetric` (success rate percentage).
   - Track `lastActivity` (timestamp of latest run).
8. **Public API**
   - `getLatest()`: returns cloned latest analytics snapshot.
   - `getHistory()`: returns cloned history array.
   - `getSummary()`: returns totalRuns, lastRunAt, successRate, consensusTrail.
   - `ingestSnapshot(snapshot)`: manually trigger analytics processing.
9. **History Management**
   - Load history from StateManager artifact on init.
   - Persist history after each snapshot processed.
   - Limit to 20 most recent runs.
   - Clear history button empties array and persists.
10. **Integration Points**
    - Emit telemetry from `cats`, `dogs`, Arena orchestrator.
    - Transport via ProgressWatcher.
    - Bridge to EventBus in UI manager.
    - Widget auto-updates on new analytics events.
