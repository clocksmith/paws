# Blueprint 0x00003D: Reflection Semantic Search

**Objective:** Document the TF-IDF based semantic search system that surfaces past reflections relevant to the current situation.

**Target Upgrade:** RESRCH (`reflection-search.js`)

**Prerequisites:** 0x00003B (Reflection Store Architecture), 0x000003 (Core Utilities & Error Handling), 0x00001B (Code Introspection & Self-Analysis)

**Affected Artifacts:** `/upgrades/reflection-search.js`, `/upgrades/reflection-store.js`, `/styles/dashboard.css`

---

### 1. The Strategic Imperative
Agents learn fastest when they can retrieve analogous experiences. Keyword search misses nuance; semantic search bridges:
- Similar failure modes (e.g., “TypeError in state-manager”).
- Proven strategies for analogous goals.
- Relevant reflections across categories and tags.

### 2. Architectural Overview
`ReflectionSearch` builds and caches a TF-IDF index of reflections.

```javascript
const Search = await ModuleLoader.getModule('ReflectionSearch');
await Search.init();
const results = await Search.api.search('timeout while calling GitHub API', { limit: 5, outcome: 'successful' });
```

Key mechanics:
- **Indexing**
  - `rebuildIndex()` fetches up to 1,000 reflections, tokenizes description/goal/tags, computes TF-IDF vectors.
  - Cached in `tfidfIndex` with timestamp; TTL defaults to 5 minutes (`INDEX_TTL`).
  - Tracks `_indexRebuildCount` for monitoring.
- **Tokenization & Vectors**
  - `tokenize()` normalizes to lowercase, strips punctuation, removes short words (>2 chars).
  - `calculateTF`/`calculateIDF`/`calculateTFIDF` compute vector weights.
  - `cosineSimilarity()` measures relevance between query and document vectors.
- **Search API**
  - `search(query, { limit, threshold, outcome })` returns ranked results with similarity scores.
  - `findSimilar(reflectionId)` finds neighbours for an existing reflection.
  - `getRelevantForContext({ goal, error, tags })` builds query from context and searches automatically.
  - Tracks search statistics: `_searchCount`, `_lastSearchTime`, `_recentSearches`.
- **Index Maintenance**
  - `ensureIndexFresh()` rebuilds when TTL expired or index invalidated.
  - `clearIndex()` resets caches for manual refresh.
  - Listens to `reflection:created` events to invalidate index.

#### Monitoring Widget (Web Component)

The module provides a Web Component widget for monitoring search activity and index health:

```javascript
class ReflectionSearchWidget extends HTMLElement {
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
    const stats = getIndexStats();
    const indexAge = stats.age ? Math.floor(stats.age / 1000) : 0;
    const isStale = indexAge > (INDEX_TTL / 1000);

    return {
      state: !tfidfIndex ? 'warning' : (isStale ? 'idle' : (_searchCount > 0 ? 'active' : 'idle')),
      primaryMetric: `${stats.indexed} reflections`,
      secondaryMetric: `${_searchCount} searches`,
      lastActivity: _lastSearchTime,
      message: !tfidfIndex ? 'No index' : (isStale ? 'Index stale' : 'Ready')
    };
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        .stats-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
        .stat-card.stale { background: rgba(255,150,0,0.1); }
        .stat-value.warning { color: #f90; }
      </style>
      <div class="widget-panel">
        <h3>⌕ Reflection Search</h3>
        <div class="controls">
          <button class="rebuild-index">↻ Rebuild Index</button>
          <button class="clear-index">⛶ Clear Index</button>
        </div>
        <div class="stats-grid">
          <!-- Indexed count, vocabulary size, searches, index age -->
        </div>
        <!-- Index statistics, recent searches list -->
      </div>
    `;

    // Event listeners for interactive controls
    this.shadowRoot.querySelector('.rebuild-index')?.addEventListener('click', async () => {
      await rebuildIndex();
      this.render();
    });
  }
}

// Register custom element
if (!customElements.get('reflection-search-widget')) {
  customElements.define('reflection-search-widget', ReflectionSearchWidget);
}

const widget = {
  element: 'reflection-search-widget',
  displayName: 'Reflection Search',
  icon: '⌕',
  category: 'intelligence',
  updateInterval: 5000
};
```

**Widget Features:**
- **Closure Access**: Widget class accesses module state (`tfidfIndex`, `_searchCount`, `_recentSearches`) directly via closure.
- **Status Reporting**: `getStatus()` provides index health for dashboard integration.
- **Index Monitoring**: Shows indexed reflection count, vocabulary size, index age, staleness warnings.
- **Search History**: Displays recent searches with result counts and timestamps.
- **Interactive Controls**: Buttons to manually rebuild or clear the index.
- **Auto-Refresh**: Updates every 5 seconds to reflect current search activity.
- **Shadow DOM**: Fully encapsulated styling prevents CSS leakage.

### 3. Implementation Pathway

#### Core Search Implementation

1. **Initialization**
   - Call `init()` during boot after ReflectionStore and EventBus ready.
   - Build initial TF-IDF index from all reflections.
   - Set up EventBus listener for `reflection:created` to invalidate index.
   - Handle empty datasets by creating empty index structure.
2. **TF-IDF Indexing**
   - Implement `tokenize()` to normalize text (lowercase, strip punctuation, filter short words).
   - Implement `calculateTF()`, `calculateIDF()`, `calculateTFIDF()` for vector computation.
   - Implement `cosineSimilarity()` for relevance scoring.
   - Track `_indexRebuildCount` for monitoring.
3. **Query Workflow**
   - On search, ensure index fresh via `ensureIndexFresh()`, compute query TF-IDF vector.
   - Compare query vector against corpus using cosine similarity.
   - Filter results by optional outcome; enforce similarity threshold (default 0.1).
   - Track search stats: `_searchCount`, `_lastSearchTime`, `_recentSearches`.
4. **Search APIs**
   - Implement `search(query, options)` for text-based queries.
   - Implement `findSimilar(reflectionId)` to find neighbors.
   - Implement `getRelevantForContext(context)` for automatic recommendations.
5. **Index Maintenance**
   - Implement `rebuildIndex()` with timing and logging.
   - Implement `clearIndex()` for manual reset.
   - Set TTL (5 minutes) for automatic index refresh.
6. **Contextual Recommendations**
   - When agent hits error, call `getRelevantForContext` to surface similar reflections automatically.
   - Combine with `ReflectionAnalyzer` for deeper insights.

#### Widget Implementation (Web Component)

7. **Define Web Component Class** inside factory function:
   ```javascript
   class ReflectionSearchWidget extends HTMLElement {
     constructor() {
       super();
       this.attachShadow({ mode: 'open' });
     }
   }
   ```
8. **Implement Lifecycle Methods**:
   - `connectedCallback()`: Initial render and start 5-second auto-refresh interval
   - `disconnectedCallback()`: Clean up interval to prevent memory leaks
9. **Implement getStatus()** as class method with closure access:
   - Return all 5 required fields: `state`, `primaryMetric`, `secondaryMetric`, `lastActivity`, `message`
   - Access module state (`tfidfIndex`, `_searchCount`) via closure
   - Calculate index staleness for status warnings
10. **Implement render()** method:
    - Set `this.shadowRoot.innerHTML` with encapsulated styles
    - Display stats grid (indexed, vocabulary, searches, index age)
    - Show index statistics (last update, rebuilds, TTL, status)
    - Show recent searches with result counts (if any)
    - Add interactive controls (rebuild index, clear index)
    - Attach event listeners to buttons
11. **Register Custom Element**:
    - Use kebab-case naming: `reflection-search-widget`
    - Add duplicate check: `if (!customElements.get('reflection-search-widget'))`
    - Call `customElements.define('reflection-search-widget', ReflectionSearchWidget)`
12. **Return Widget Object** with new format:
    - `{ element: 'reflection-search-widget', displayName: 'Reflection Search', icon: '⌕', category: 'intelligence' }`
13. **Test** Shadow DOM rendering, lifecycle cleanup, index monitoring, and closure access to search stats

### 4. Verification Checklist
- [ ] Index rebuild logs size and completes without unhandled errors.
- [ ] Searching empty corpus returns empty array (no throws).
- [ ] Similarity scores decrease monotonically after sorting.
- [ ] `findSimilar` excludes target reflection itself.
- [ ] Context search handles missing fields gracefully (warn + empty result).

### 5. Extension Opportunities
- Replace TF-IDF with embeddings (e.g., MiniLM) when inference available.
- Add stop-word dictionary per domain to improve relevance.
- Persist index in IndexedDB for faster startup.
- Provide API to pin reflections for always-on recommendations.

Keep this blueprint aligned with changes to indexing strategy, tokenization, or EventBus integration.
