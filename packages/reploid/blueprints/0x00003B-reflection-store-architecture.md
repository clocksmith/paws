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
- **Analytics APIs**
  - `getSuccessPatterns()`, `getFailurePatterns()` summarise categories, tags, errors.
  - `getLearningSummary()` aggregates counts, success rate, recency.
  - `generateReport(filters)` outputs markdown summarising insights.
- **Maintenance**
  - `deleteOldReflections(days)` prunes stale entries.
  - `exportReflections()` / `importReflections()` support backups and sharing.

### 3. Implementation Pathway
1. **Initialization**
   - Call `init()` during boot when IndexedDB available.
   - Provide fallback message for environments without IndexedDB (e.g., file-based CLI).
2. **Reflection Lifecycle**
   - When agent completes a cycle, pipeline should construct reflection objects and call `addReflection`.
   - Include structured data: `outcome`, `description`, `category`, `tags`, optional `error`.
3. **Querying**
   - UI modules (Reflections panel) call `getReflections` with filters (category, tag, session).
   - Always handle promise rejections gracefully (e.g., DB blocked).
4. **Analysis**
   - `ReflectionAnalyzer` (0x00003C) uses success/failure patterns to generate recommendations.
   - `ReflectionSearch` (0x00003D) performs semantic lookup; ensure store exposes necessary fields.
5. **Data Hygiene**
   - Consider scheduling `deleteOldReflections` to cap DB growth.
   - When importing reflections, deduplicate by hash or timestamp to avoid duplicates.

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
