# Blueprint 0x00003B: Reflection Store Architecture

**Objective:** Define the persistence and querying strategy that allows REPLOID to learn from past actions.

**Target Upgrade:** REFL (`reflection-store.js`)

**Prerequisites:** 0x000003 (Core Utilities & Error Handling), 0x000008 (Agent Cognitive Cycle), 0x000034 (Audit Logging Policy)

**Affected Artifacts:** `/upgrades/reflection-store.js`, `/styles/dashboard.css`, `/upgrades/reflection-analyzer.js`, `/upgrades/reflection-search.js`

---

### 1. The Strategic Imperative
Reflections are the memory of successes and failures. Without durable storage:
- RSI loops forget lessons between sessions.
- Swarm peers cannot benefit from shared insights.
- Analyzer tooling lacks data to surface patterns.

This blueprint keeps reflection data trustworthy and queryable.

### 2. Architectural Overview
`ReflectionStore` uses IndexedDB to persist reflections with fast filtering.

```javascript
const Store = await ModuleLoader.getModule('ReflectionStore');
await Store.init();
const id = await Store.api.addReflection({
  outcome: 'success',
  description: 'Modularized agent-cycle.js for clarity',
  category: 'architecture',
  tags: ['refactor', 'performance']
});
```

Key components:
- **Database Schema**
  - DB: `reploid_reflections`, Object store: `reflections`.
  - Indexes: `timestamp`, `outcome`, `category`, `session`, `tags` (multi-entry).
- **Operations**
  - `addReflection` validates payload, enriches metadata (timestamp, sessionId), emits `reflection:added`.
  - `getReflections(filters)` leverages indexes, applies optional time/limit filters, sorts newest-first.
  - `getReflection(id)` fetches single entry.
  - Tracks addition stats: `_additionCount`, `_lastAdditionTime`, `_outcomeCounts`.
- **Analytics APIs**
  - `getSuccessPatterns()`, `getFailurePatterns()` summarise categories, tags, errors.
  - `getLearningSummary()` aggregates counts, success rate, recency.
  - `generateReport(filters)` outputs markdown summarising insights.
- **Maintenance**
  - `deleteOldReflections(days)` prunes stale entries.
  - `exportReflections()` / `importReflections()` support backups and sharing.

#### Monitoring Widget (Web Component)

The store provides a Web Component widget for monitoring reflection storage and analytics:

```javascript
class ReflectionStoreWidget extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    this._interval = setInterval(() => this.render(), 5000);
  }

  disconnectedCallback() {
    if (this._interval) clearInterval(this._interval);
  }

  getStatus() {
    // Access module state via closure
    const total = Object.values(_outcomeCounts).reduce((sum, count) => sum + count, 0);
    const successRate = total > 0 ? ((_outcomeCounts.success || 0) / total * 100).toFixed(0) : 0;

    return {
      state: _additionCount > 0 ? 'active' : 'idle',
      primaryMetric: `${total} reflections`,
      secondaryMetric: `${successRate}% success`,
      lastActivity: _lastAdditionTime,
      message: db ? 'Ready' : 'Not initialized'
    };
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        .stats-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
        .outcome-item.success { background: rgba(0,200,100,0.1); border-left-color: #0c0; }
        .outcome-item.failure { background: rgba(255,0,0,0.1); border-left-color: #ff6b6b; }
        .outcome-item.partial { background: rgba(255,150,0,0.1); border-left-color: #f90; }
      </style>
      <div class="widget-panel">
        <h3>☁ Reflection Store</h3>
        <div class="controls">
          <button class="generate-report">⛿ Generate Report</button>
          <button class="export-data">⇑ Export Data</button>
          <button class="get-summary">☱ Get Summary</button>
        </div>
        <div class="stats-grid">
          <!-- Total, success rate, added count, DB status -->
        </div>
        <!-- Outcome breakdown with progress bars -->
      </div>
    `;

    // Event listeners for interactive controls
    this.shadowRoot.querySelector('.generate-report')?.addEventListener('click', async () => {
      const report = await generateReport();
      console.log(report);
    });
  }
}

// Register custom element
if (!customElements.get('reflection-store-widget')) {
  customElements.define('reflection-store-widget', ReflectionStoreWidget);
}

const widget = {
  element: 'reflection-store-widget',
  displayName: 'Reflection Store',
  icon: '☁',
  category: 'learning',
  updateInterval: 5000
};
```

**Widget Features:**
- **Closure Access**: Widget class accesses module state (`db`, `_additionCount`, `_outcomeCounts`) directly via closure.
- **Status Reporting**: `getStatus()` provides store health and success metrics for dashboard integration.
- **Outcome Breakdown**: Visual breakdown of success/failure/partial outcomes with progress bars.
- **Analytics Summary**: Shows total reflections, success rate, additions count.
- **Interactive Controls**: Buttons to generate reports, export data, and view summaries.
- **Auto-Refresh**: Updates every 5 seconds to reflect current storage state.
- **Shadow DOM**: Fully encapsulated styling prevents CSS leakage.

### 3. Implementation Pathway

#### Core Store Implementation

1. **Initialization**
   - Call `init()` during boot when IndexedDB available.
   - Create database and object store with indexes: `timestamp`, `outcome`, `category`, `session`, `tags`.
   - Provide fallback message for environments without IndexedDB (e.g., file-based CLI).
   - Initialize tracking variables: `_additionCount`, `_lastAdditionTime`, `_outcomeCounts`.
2. **Reflection Lifecycle**
   - When agent completes a cycle, pipeline should construct reflection objects and call `addReflection`.
   - Include structured data: `outcome`, `description`, `category`, `tags`, optional `error`.
   - Validate required fields before writing to database.
   - Emit `reflection:added` event after successful addition.
   - Update `_outcomeCounts` for the specific outcome type.
3. **Querying**
   - UI modules (Reflections panel) call `getReflections` with filters (category, tag, session).
   - Leverage IndexedDB indexes for efficient filtering.
   - Always handle promise rejections gracefully (e.g., DB blocked).
   - Support pagination via `limit` and time-based filtering.
4. **Analysis**
   - `ReflectionAnalyzer` (0x00003C) uses success/failure patterns to generate recommendations.
   - `ReflectionSearch` (0x00003D) performs semantic lookup; ensure store exposes necessary fields.
   - Implement `getSuccessPatterns()` and `getFailurePatterns()` for pattern extraction.
   - Implement `getLearningSummary()` for aggregated metrics.
5. **Data Hygiene**
   - Consider scheduling `deleteOldReflections` to cap DB growth.
   - When importing reflections, deduplicate by hash or timestamp to avoid duplicates.
   - Implement `exportReflections()` / `importReflections()` for backup/sharing.

#### Widget Implementation (Web Component)

6. **Define Web Component Class** inside factory function:
   ```javascript
   class ReflectionStoreWidget extends HTMLElement {
     constructor() {
       super();
       this.attachShadow({ mode: 'open' });
     }
   }
   ```
7. **Implement Lifecycle Methods**:
   - `connectedCallback()`: Initial render and start 5-second auto-refresh interval
   - `disconnectedCallback()`: Clean up interval to prevent memory leaks
8. **Implement getStatus()** as class method with closure access:
   - Return all 5 required fields: `state`, `primaryMetric`, `secondaryMetric`, `lastActivity`, `message`
   - Access module state (`db`, `_additionCount`, `_outcomeCounts`) via closure
   - Calculate success rate from outcome counts
9. **Implement render()** method:
   - Set `this.shadowRoot.innerHTML` with encapsulated styles
   - Display stats grid (total, success rate, added count, DB status)
   - Show outcome breakdown (success/failure/partial) with progress bars
   - Add interactive controls (generate report, export data, get summary)
   - Attach event listeners to buttons
10. **Register Custom Element**:
    - Use kebab-case naming: `reflection-store-widget`
    - Add duplicate check: `if (!customElements.get('reflection-store-widget'))`
    - Call `customElements.define('reflection-store-widget', ReflectionStoreWidget)`
11. **Return Widget Object** with new format:
    - `{ element: 'reflection-store-widget', displayName: 'Reflection Store', icon: '☁', category: 'learning' }`
12. **Test** Shadow DOM rendering, lifecycle cleanup, outcome tracking, and closure access to store state

### 4. Verification Checklist
- [ ] Database upgrades preserve existing data (version bump migration path).
- [ ] `addReflection` rejects missing required fields.
- [ ] Index-based queries return results matching filters.
- [ ] Report generation includes summary, patterns, recent reflections.
- [ ] Export/import round-trip preserves count and metadata.

### 5. Extension Opportunities
- Add sentiment/score fields to reflections for richer analytics.
- Support encryption for privacy-sensitive reflections.
- Integrate with Swarm orchestrator to sync reflections across peers.
- Provide CLI commands to view/export reflections outside UI.

Maintain this blueprint as the reflection schema evolves or new analytics layers are introduced.
