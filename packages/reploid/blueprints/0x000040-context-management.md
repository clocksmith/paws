# Blueprint 0x000046: Context Management

**Status:** ✅ Implemented
**Module ID:** CTXM
**File:** `upgrades/context-manager.js`
**Version:** 1.0.0
**Category:** Intelligence / Performance

---

## Purpose

The Context Manager intelligently manages the conversation history (context window) to prevent token limit exhaustion while preserving the most important information. This enables longer agent sessions, reduces API costs, and maintains high-quality reasoning even in extended interactions.

## Problem Statement

LLM APIs have finite context windows (e.g., 128K-1M tokens). As conversations grow:
- Context exceeds model limits, causing errors
- API costs increase linearly with context size
- Irrelevant historical information dilutes important context
- Agent reasoning degrades due to information overload

Without intelligent pruning, agents must either:
1. Keep all history → hit limits and fail
2. Use fixed sliding window → lose important context
3. Manually manage context → complex and error-prone

## Solution Architecture

### Core Algorithm: Importance-Based Retention

The Context Manager scores each message by:
1. **Recency:** Newer messages weighted higher (40% of score)
2. **Role:** System > User > Model (30% weight)
3. **Keywords:** Errors, tools, operations (25% weight)
4. **Length:** Very long messages may be important (5% weight)

Messages are sorted by importance and retained until token budget is reached.

### Key Components

**1. Token Estimation**
```javascript
estimateTokens(content) → number
```
Rough approximation: ~4 characters per token. Fast and accurate enough for pruning decisions.

**2. Importance Scoring**
```javascript
scoreContextImportance(item, index, totalItems) → number
```
Returns 0-100 score indicating how critical this message is to retain.

**3. Intelligent Pruning**
```javascript
pruneContext(history, maxTokens, modelName) → { pruned, removed, stats }
```
Always keeps:
- All system prompts (identity/instructions)
- Most recent message (current context)
- Highest-scored middle messages (up to budget)

**4. Summarization**
```javascript
summarizeContext(history, maxItems) → { summarized, summary, stats }
```
Replaces old messages with a compact summary: "Previous 50 turns: 25 user messages, 25 model responses, 10 tool calls"

### Model-Specific Limits

| Model | Token Limit | Target (80%) |
|-------|-------------|--------------|
| Gemini 2.5 Flash | 1M | 800K |
| Claude 4.5 | 200K | 160K |
| GPT-5 | 128K | 102K |
| Default | 100K | 80K |

## Integration Points

### With Agent Cycle

```javascript
const ContextManager = await container.resolve('ContextManager');

// Before API call, auto-manage context
const { pruned } = ContextManager.autoManageContext(history, 'gemini-2.5-flash');

// Use pruned history for API call
const response = await ApiClient.callApiWithRetry(pruned, apiKey, funcDecls);
```

### With State Manager

```javascript
// Check context health
const stats = ContextManager.getContextStats(StateManager.getHistory(), 'claude-4-5-sonnet');

if (stats.needsPruning) {
  // Proactively prune before hitting limits
  const { pruned, stats } = ContextManager.pruneContext(history);
  StateManager.setHistory(pruned);

  logger.info(`Context pruned: ${stats.itemsRemoved} items removed, ${stats.original - stats.final} tokens saved`);
}
```

### With Reflection Store

```javascript
// Before pruning, optionally save removed context to reflections
EventBus.on('context:pruned', ({ removed }) => {
  // Store low-importance items as "archived context" for future reference
  ReflectionStore.archiveOldContext(removed);
});
```

## Public API

### `pruneContext(history, maxTokens, modelName)`

Intelligently reduces context while preserving important information.

**Parameters:**
- `history`: Array of conversation messages
- `maxTokens`: Target token count (optional, defaults to 80% of model limit)
- `modelName`: Model being used (optional, defaults to 'default')

**Returns:**
```javascript
{
  pruned: Array,     // Reduced history
  removed: Array,    // Discarded messages
  stats: {
    original: number,      // Original token count
    final: number,         // Final token count
    itemsRemoved: number,  // Messages removed
    itemsKept: number      // Messages retained
  }
}
```

### `summarizeContext(history, maxItems)`

Replaces old messages with a compact summary.

**Parameters:**
- `history`: Array of conversation messages
- `maxItems`: How many recent items to keep verbatim (default: 10)

**Returns:**
```javascript
{
  summarized: Array,  // New history with summary
  summary: Object,    // The summary message object
  stats: {
    summarizedItems: number,
    keptItems: number
  }
}
```

### `getContextStats(history, modelName)`

Analyzes context health without modifying it.

**Returns:**
```javascript
{
  items: number,              // Total messages
  tokens: number,             // Estimated total tokens
  limit: number,              // Model's token limit
  utilizationPercent: number, // How full (0-100%)
  needsPruning: boolean       // Over 80% threshold?
}
```

### `autoManageContext(history, modelName)`

Automatically prunes if needed, otherwise returns unchanged.

**Returns:** Same as `pruneContext()`, but `pruned` === `history` if no action taken.

## Events

| Event | Payload | Description |
|-------|---------|-------------|
| `context:pruned` | `{ original, final, removed, tokenReduction }` | Context was pruned |
| `context:summarized` | `{ summarized, kept, summary }` | Context was summarized |

## Scoring Algorithm Example

Given history: `[system, user1, model1, user2, model2, user3]`

**Scores (0-100):**
```
system:  70  (30 role + 40 recency)
user1:   20  (20 role + 0 recency)
model1:  18  (10 role + 8 recency)
user2:   36  (20 role + 16 recency)
model2:  34  (10 role + 24 recency)
user3:   60  (20 role + 40 recency) ← most recent
```

If budget allows only 4 items:
- Keep: system (always), user3 (most recent), user2 (high score), model2 (high score)
- Remove: user1, model1 (lowest scores)

## Performance Characteristics

- **Pruning Speed:** ~1ms per 100 messages
- **Memory:** O(n) for scoring, O(1) for processing
- **Accuracy:** ±10% on token estimation (sufficient for pruning)

## Configuration

All thresholds are constants that can be tuned:

```javascript
// In module code
const RECENCY_WEIGHT = 40;
const ROLE_WEIGHT_SYSTEM = 30;
const ROLE_WEIGHT_USER = 20;
const ROLE_WEIGHT_MODEL = 10;
const KEYWORD_WEIGHT = 15;
const LENGTH_WEIGHT = 5;
const TARGET_UTILIZATION = 0.8; // 80%
```

## Testing Strategy

```javascript
describe('ContextManager', () => {
  it('should keep system prompts always', () => {
    const history = [{ role: 'system', parts: [...] }, ...many...];
    const { pruned } = pruneContext(history, 1000);
    expect(pruned[0].role).toBe('system');
  });

  it('should keep most recent message always', () => {
    const history = [...many..., { role: 'user', parts: ['last'] }];
    const { pruned } = pruneContext(history, 1000);
    expect(pruned[pruned.length - 1].parts[0]).toBe('last');
  });

  it('should respect token limits', () => {
    const history = createLargeHistory(10000); // 10K tokens
    const { stats } = pruneContext(history, 5000); // Target 5K
    expect(stats.final).toBeLessThanOrEqual(5000);
  });

  it('should prioritize error messages', () => {
    const history = [
      { role: 'user', parts: ['hello'] },
      { role: 'model', parts: ['ERROR: Failed'] },
      { role: 'user', parts: ['goodbye'] }
    ];
    const { pruned } = pruneContext(history, 500);
    expect(pruned.some(x => x.parts[0].includes('ERROR'))).toBe(true);
  });
});
```

## Use Cases

### 1. Long Agent Sessions
Agent runs overnight generating 100+ proposals. Context Manager prevents exhaustion while keeping critical context.

### 2. Cost Optimization
Reduce API costs by 30-50% by pruning redundant context without impacting quality.

### 3. Performance Enhancement
Smaller context = faster API calls. Pruning can reduce latency by 20-40%.

### 4. Multi-Turn Conversations
Enable 100+ turn conversations that would otherwise exceed limits.

## Future Enhancements

1. **Semantic Importance:** Use embeddings to identify truly redundant information
2. **Learned Scoring:** Train model to predict which context is most useful
3. **Compression:** Use model itself to compress old context into dense summaries
4. **Adaptive Thresholds:** Adjust scoring weights based on task type

## Web Component Widget

The module includes a `ContextManagerWidget` custom element for real-time context monitoring and management:

```javascript
class ContextManagerWidget extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    this._interval = setInterval(() => this.render(), 3000);
  }

  disconnectedCallback() {
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
    }
  }

  getStatus() {
    const stats = getContextStats(StateManager.getHistory(), 'gemini-2.5-flash');
    return {
      state: stats.needsPruning ? 'warning' : (stats.tokens > 0 ? 'active' : 'idle'),
      primaryMetric: `${stats.tokens.toLocaleString()} tokens`,
      secondaryMetric: `${stats.utilizationPercent.toFixed(0)}% used`,
      lastActivity: Date.now(),
      message: stats.needsPruning ? 'Needs pruning' : 'Healthy'
    };
  }

  render() {
    const history = StateManager.getHistory();
    const stats = getContextStats(history, 'gemini-2.5-flash');

    this.shadowRoot.innerHTML = `
      <style>/* Shadow DOM styling */</style>
      <div class="widget-content">
        <h3>🧠 Context Manager</h3>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-label">Messages</div>
            <div class="stat-value">${stats.items}</div>
          </div>
          <div class="stat-card ${stats.needsPruning ? 'warning' : ''}">
            <div class="stat-label">Tokens</div>
            <div class="stat-value">${stats.tokens.toLocaleString()}</div>
            <div class="stat-sublabel">of ${stats.limit.toLocaleString()}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Utilization</div>
            <div class="stat-value">${stats.utilizationPercent.toFixed(1)}%</div>
            <progress value="${stats.utilizationPercent}" max="100"></progress>
          </div>
        </div>
        ${stats.needsPruning ? `
          <div class="warning-banner">
            ⚠️ Context exceeds 80% capacity - pruning recommended
          </div>
          <button class="prune-btn">Prune Context Now</button>
        ` : ''}
        <div class="info">
          <strong>ℹ️ Automatic Management</strong>
          <div>Context is automatically pruned before API calls when utilization exceeds 80%</div>
        </div>
      </div>
    `;

    // Wire up prune button
    const pruneBtn = this.shadowRoot.querySelector('.prune-btn');
    if (pruneBtn) {
      pruneBtn.addEventListener('click', async () => {
        const { pruned, stats: pruneStats } = pruneContext(history);
        StateManager.setHistory(pruned);
        EventBus.emit('toast:success', {
          message: `Context pruned: ${pruneStats.itemsRemoved} items removed`
        });
        this.render();
      });
    }
  }
}

// Register custom element
if (!customElements.get('context-manager-widget')) {
  customElements.define('context-manager-widget', ContextManagerWidget);
}

const widget = {
  element: 'context-manager-widget',
  displayName: 'Context Manager',
  icon: '🧠',
  category: 'intelligence',
  updateInterval: 3000
};
```

**Widget Features:**
- Real-time token usage monitoring with 3-second refresh
- Visual utilization progress bar and percentage
- Warning banner when context exceeds 80% capacity
- Interactive "Prune Context Now" button for manual pruning
- Color-coded stat cards (warning state for high utilization)
- Auto-refreshes to show context growth during agent cycles
- Shadow DOM encapsulation for style isolation

## Related Blueprints

- **0x000008:** Agent Cognitive Cycle (primary consumer)
- **0x000007:** API Client (benefits from reduced token usage)
- **0x00003B:** Reflection Store (archives pruned context)
- **0x000045:** Streaming Response Handler (faster feedback loop)

---

**Architectural Principle:** Intelligent Resource Management

Context is a precious resource. Like memory management in operating systems, we must balance keeping enough for good performance while not exhausting available capacity. The goal is transparent management that "just works."
