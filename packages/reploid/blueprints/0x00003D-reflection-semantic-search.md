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
- **Tokenization & Vectors**
  - `tokenize()` normalizes to lowercase, strips punctuation, removes short words.
  - `calculateTF`/`calculateIDF`/`calculateTFIDF` compute vector weights.
  - Cosine similarity measures relevance.
- **Search API**
  - `search(query, { limit, threshold, outcome })` returns ranked results with similarity scores.
  - `findSimilar(reflectionId)` finds neighbours for an existing reflection.
  - `getRelevantForContext({ goal, error, tags })` builds query from context and searches automatically.
- **Index Maintenance**
  - `ensureIndexFresh()` rebuilds when TTL expired or index invalidated.
  - `clearIndex()` resets caches for manual refresh.
  - Listens to `reflection:created` events to invalidate index.

### 3. Implementation Pathway
1. **Initialization**
   - Call `init()` during boot after ReflectionStore and EventBus ready.
   - Handle empty datasets by creating empty index structure.
2. **Query Workflow**
   - On search, ensure index fresh, compute query TF-IDF vector, compare against corpus.
   - Filter results by optional outcome; enforce similarity threshold (default 0.1).
3. **UI Integration**
   - Display scores, highlight matched tags/keywords.
   - Provide quick actions (open reflection, apply recommendation).
4. **Contextual Recommendations**
   - When agent hits error, call `getRelevantForContext` to surface similar reflections automatically.
   - Combine with `ReflectionAnalyzer` for deeper insights.
5. **Performance Considerations**
   - Index rebuild should run off main thread if/when dataset grows (future web worker optimization).
   - Keep TTL reasonable; allow manual refresh from UI.

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
