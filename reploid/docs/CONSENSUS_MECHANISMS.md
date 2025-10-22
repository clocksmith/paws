# REPLOID Consensus Mechanisms

This document explains the different multi-model consensus mechanisms available in REPLOID.

## Overview

REPLOID now provides **three distinct** multi-model consensus strategies:

1. **Model Arena** - Competition-based selection
2. **Peer Review Consensus** - Mutual evaluation system (includes Paxos voting as tiebreaker)
3. **Hybrid Mode** - Automatic local/cloud switching

> **Note:** The Paxos distributed consensus algorithm is preserved as an advanced tiebreaker option within Peer Review Consensus, where 3 models vote to achieve distributed agreement when peer ratings tie.

---

## 1. Model Arena (Formerly "Multi-Model Paxos")

**What it is:** Competitive evaluation where multiple models attempt the same task and the best solution wins.

**File:** `upgrades/model-arena.js`

### Algorithm

```
1. Send same prompt to N models in parallel
2. Each model generates a solution independently
3. Verify each solution (run tests in Web Worker)
4. Score each solution:
   - 60% weight: Tests passing
   - 20% weight: Performance (speed)
   - 20% weight: Code quality (LLM judge OR heuristics)
5. Select highest-scoring solution
```

### Scoring Methods

**LLM-Based (Recommended)**
```javascript
const result = await ModelArena.api.runCompetition(objective, {
  scoringMethod: 'llm'
});
```
- Uses Claude 4.5 Sonnet as an expert judge
- Rates code on: correctness, quality, best practices, completeness, performance
- Scale: 0-10, normalized to 0-1
- **Much more accurate than heuristics**

**Hybrid (Default)**
```javascript
const result = await ModelArena.api.runCompetition(objective, {
  scoringMethod: 'hybrid'  // Default
});
```
- Uses LLM judge for solutions that pass tests
- Uses fast heuristics for failed solutions (saves API calls)
- **Best balance of cost and accuracy**

**Heuristic (Fast/Cheap)**
```javascript
const result = await ModelArena.api.runCompetition(objective, {
  scoringMethod: 'heuristic'
});
```
- Fast, deterministic pattern matching
- Checks for: JSDoc, error handling, modern syntax, dangerous patterns
- No additional API calls
- **Weakest evaluation but fastest**

### Use Cases

- Competitive model benchmarking
- Maximizing solution quality
- Research and testing
- When you want the "best" solution from multiple attempts

### Configuration

```javascript
// Basic usage (auto-selects best available judge)
const result = await ModelArena.api.runCompetition(objective, {
  models: ['gemini-2.5-flash', 'gpt-5-2025-08-07', 'claude-4-5-sonnet'],
  verificationFn: (solution) => runTests(solution),
  timeout: 60000
});

// Specify custom judge model
const result = await ModelArena.api.runCompetition(objective, {
  models: ['gemini-2.5-flash', 'gpt-5-2025-08-07'],
  judgeModel: 'claude-4-5-sonnet',  // Use Claude as judge
  scoringMethod: 'llm'
});

// Use hybrid scoring with specific judge
const result = await ModelArena.api.runCompetition(objective, {
  models: ['gemini-2.5-flash', 'gpt-5-2025-08-07', 'claude-4-5-sonnet'],
  judgeModel: 'gpt-5-2025-08-07',  // Use GPT-5 as judge
  scoringMethod: 'hybrid'  // LLM for passing solutions only
});
```

**Judge Selection Priority:**
1. User-specified `judgeModel` parameter
2. `ModelRegistry.getRecommendedJudge()` (Claude Sonnet > GPT-5 > Gemini Flash)
3. Config default (`api.anthropicModelBalanced`)
4. Hardcoded fallback: `claude-4-5-sonnet`

### Events

- `arena:competition_start`
- `arena:phase` (generation, verification, scoring)
- `arena:progress`
- `arena:consensus_reached`

---

## 2. Peer Review Consensus (N=2, N=3, N=4)

**What it is:** Models generate solutions independently, then each reviews all others' work. Winner selected by peer ratings.

**File:** `upgrades/peer-review-consensus.js`

### Algorithm

```
PHASE 1: GENERATION
  All N models generate solutions in parallel

PHASE 2: PEER REVIEW
  For each model i:
    Model i reviews all other models' solutions
    Assigns scores 0-10 and provides feedback

  Total reviews: N × (N-1)

PHASE 3: SELECTION
  Calculate average peer rating for each solution

  If no tie:
    Select solution with highest average rating

  If tie:
    Apply N-specific tiebreaker (see below)
```

### Tiebreaker Strategies

#### N=2 (Two Models)

**Primary:** Quality heuristics
- Compare code quality scores
- Fallback: Code length

#### N=3 (Three Models)

**Primary:** Median rating
- Use median of peer scores
- Fallback: Quality score

#### N=4 (Four Models)

**Primary:** Ranked-choice voting
- Assign points: 1st=3pts, 2nd=2pts, 3rd=1pt, 4th=0pts
- Fallback: Quality score

### Advanced Tiebreakers

**Auto-Rater Tiebreaker**
```javascript
const result = await PeerReviewConsensus.api.runConsensus(prompt, {
  models: ['gemini-2.5-flash', 'gpt-5-2025-08-07'],
  tiebreakerMethod: 'auto-rater' // Use independent judge
});
```

- Uses a separate "judge" model (claude-4-5-sonnet)
- Judge rates all tied solutions
- Selects judge's top choice

**Paxos Voting Tiebreaker** (ULTIMATE TIEBREAKER)
```javascript
const result = await PeerReviewConsensus.api.runConsensus(prompt, {
  models: ['gemini-2.5-flash', 'gpt-5-2025-08-07', 'claude-4-5-sonnet'],
  tiebreakerMethod: 'paxos' // Use distributed voting
});
```

- Uses Paxos-style voting protocol to achieve consensus on best solution
- 3 diverse models (Gemini, GPT, Claude) vote on which tied solution is best
- Majority or plurality vote determines winner
- Achieves distributed agreement without single judge bias
- Fallback chain: Paxos Voting → Auto-rater → Heuristic

> **Technical Note:** This implements the voting aspect of the Paxos algorithm (quorum-based agreement among distributed nodes) without the full two-phase commit overhead. Each model independently evaluates all tied solutions and votes, with majority consensus determining the winner.

### Use Cases

- Scientific peer review simulation
- When you want distributed evaluation
- Reducing single-model bias
- Educational: Understanding peer review

### Configuration

```javascript
const result = await PeerReviewConsensus.api.runConsensus(prompt, {
  models: ['model1', 'model2', 'model3'],
  tiebreakerMethod: 'paxos' | 'auto-rater' | 'heuristic'
});
```

### Events

- `peer-review:start`
- `peer-review:generation_complete`
- `peer-review:reviews_complete`
- `peer-review:consensus_reached`

---

## 3. Hybrid Mode (Local/Cloud Switching)

**What it is:** Automatic switching between local (Ollama/WebLLM) and cloud providers.

**File:** `upgrades/hybrid-llm-provider.js`

### Algorithm

```
1. Try local LLM first
2. If local fails or unavailable:
   Automatically fallback to cloud API
3. Emit fallback event for monitoring
```

### Use Cases

- Cost optimization (use free local when possible)
- Maximum reliability (cloud backup)
- Offline-first with cloud fallback

### Configuration

```javascript
// Manual mode switching
HybridLLMProvider.api.setMode('local'); // Use local
HybridLLMProvider.api.setMode('cloud'); // Use cloud

// Automatic fallback (default)
const response = await HybridLLMProvider.api.complete(messages);
```

### Events

- `hybrid-llm:mode-changed`
- `hybrid-llm:fallback`

---

## Comparison Matrix

| Feature | Model Arena | Peer Review | Hybrid |
|---------|-------------|-------------|--------|
| **Algorithm Type** | Competition | Mutual Evaluation | Fallback |
| **Models Run** | N (parallel) | N (all review all) | 1 (with fallback) |
| **API Calls** | N generation + N verification + N judging (if LLM) | N generation + N×(N-1) reviews + tiebreaker votes (if needed) | 1-2 (fallback) |
| **Cost** | Medium-High | Very High | Low-Medium |
| **Evaluation Quality** | High (LLM judge) | Very High (peer review + voting) | N/A |
| **Selection Method** | Highest score | Peer ratings → Paxos voting (ties) | N/A |
| **Fault Tolerance** | No | Partial (voting quorum) | Yes (fallback) |
| **Tiebreaker** | N/A (unique scores) | Paxos Voting / Auto-rater / Heuristic | N/A |
| **Best For** | Quality maximization | Reducing bias, distributed evaluation | Cost optimization |

---

## Usage Recommendations

### Use **Model Arena** when:
- ✅ You want the absolute best solution
- ✅ You're benchmarking models
- ✅ Tests/verification are available
- ✅ You prefer competitive evaluation over consensus
- ❌ Cost is not a concern

### Use **Peer Review** when:
- ✅ You want unbiased, distributed evaluation
- ✅ Reducing single-model or single-judge bias is critical
- ✅ Simulating scientific peer review
- ✅ N=2, 3, or 4 models available
- ✅ Advanced tiebreakers (Paxos voting/auto-rater) are acceptable
- ✅ You need the highest quality evaluation (despite cost)

### Use **Hybrid Mode** when:
- ✅ Minimizing costs (local first, cloud fallback)
- ✅ Offline capability desired
- ✅ Cloud reliability as backup
- ✅ Single-model responses are sufficient

---

## Configuration in Boot UI

The multi-model consensus mode is configured in:

**File:** `boot/modes.js` → `renderMultiConfig()`

```javascript
localStorage.setItem('CONSENSUS_TYPE', 'arena');
localStorage.setItem('MULTI_MODEL_1', 'gemini-2.5-flash');
localStorage.setItem('MULTI_MODEL_2', 'gpt-5-2025-08-07');
localStorage.setItem('MULTI_MODEL_3', 'claude-4-5-sonnet');
```

UI currently supports:
- **Model Arena** (Competition + LLM Judge Scoring)

**Note:** Peer Review consensus is API-only (not exposed in boot UI). To use Peer Review, call directly:

```javascript
const result = await PeerReviewConsensus.api.runConsensus(prompt, {
  models: ['gemini-2.5-flash', 'gpt-5-2025-08-07', 'claude-4-5-sonnet'],
  tiebreakerMethod: 'paxos'  // or 'auto-rater', 'heuristic'
});
```

---

## Module Dependencies

Consensus modules are loaded in the final orchestration group:

```json
{
  "description": "Sentinel and orchestration (need most other modules)",
  "modules": [
    { "id": "ModelArena", "path": "/upgrades/model-arena.js" },
    { "id": "PeerReviewConsensus", "path": "/upgrades/peer-review-consensus.js" }
  ]
}
```

**Dependencies:**
- `Utils`, `EventBus`, `StateManager`
- `HybridLLMProvider` (for LLM access)
- `VerificationManager` (for test execution in Model Arena)
- `ModelRegistry` (for judge selection and model discovery)
- `DIContainer`, `Config`

---

## Testing

**Model Arena:** Competitive benchmarking tests (TBD)
**Peer Review:** Integration tests including Paxos voting tiebreaker (TBD)

---

## Future Enhancements

1. **Raft Consensus** - Leader-based distributed consensus alternative
2. **Weighted Voting** - Models have different vote weights based on past performance
3. **Multi-Round Deliberation** - Models debate and revise before final vote
4. **Byzantine Fault Tolerance** - Enhanced Paxos voting to handle malicious/corrupted models
5. **Quadratic Voting** - Non-linear vote costs for stronger preferences
6. **Peer Review UI** - Expose Peer Review mechanism in boot UI

---

## References

- Original Paxos: Lamport, L. (1998). "The Part-Time Parliament"
- Practical Paxos: Lamport, L. (2001). "Paxos Made Simple"
- Scientific Peer Review: Various academic sources

---

*Last Updated: 2025-10-21*
