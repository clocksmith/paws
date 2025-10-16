# Boot UI Redesign Proposal

## Problem Statement

The current Settings UI treats deployment modes as "model selection" when they're actually fundamentally different architectures. Users can't easily understand:
- What mode they're running in
- Tradeoffs (cost, privacy, speed, reliability)
- Requirements (server, Ollama, API keys)
- When to use each mode

## Proposed Solution

### 1. Add "Deployment Mode" as First-Class Concept

Instead of just "Select AI Model", have two-step selection:

**Step 1: Choose Deployment Mode** (with clear cards showing tradeoffs)
**Step 2: Configure Model** (contextual based on mode)

### 2. Mode Selector Design

```
┌─────────────────────────────────────────────────────────────┐
│  How do you want to run Reploid?                            │
└─────────────────────────────────────────────────────────────┘

┌───────────────────────┐ ┌───────────────────────┐ ┌──────────────────────┐
│ 🖥️ LOCAL (Ollama)     │ │ ☁️ CLOUD PROVIDER    │ │ 🌐 BROWSER ONLY      │
│                       │ │                       │ │                      │
│ ✅ Free               │ │ ✅ Fast & Powerful    │ │ ✅ No Setup          │
│ ✅ Private            │ │ ✅ Advanced models    │ │ ✅ Deploy anywhere   │
│ ⚙️ Requires Ollama    │ │ 💳 Costs money        │ │ ⚠️ Limited features  │
│                       │ │ 📡 Needs internet     │ │ 🐌 Slower inference  │
│                       │ │                       │ │                      │
│ [SELECT]              │ │ [SELECT]              │ │ [SELECT]             │
└───────────────────────┘ └───────────────────────┘ └──────────────────────┘

┌───────────────────────┐ ┌───────────────────────┐ ┌──────────────────────┐
│ 🔄 HYBRID (Auto)      │ │ 🏢 HIGH AVAILABILITY  │ │ 🔧 CUSTOM            │
│                       │ │                       │ │                      │
│ ✅ Cost optimized     │ │ ✅ Never fails        │ │ ✅ Your infrastructure│
│ ✅ Best of both       │ │ ✅ Best quality       │ │ ✅ Enterprise ready  │
│ ⚙️ Needs Ollama       │ │ 💰 3x cost            │ │ 🔧 Advanced setup    │
│ 💳 Pay as needed      │ │ 🚀 Production ready   │ │                      │
│                       │ │                       │ │                      │
│ [SELECT]              │ │ [SELECT]              │ │ [SELECT]             │
└───────────────────────┘ └───────────────────────┘ └──────────────────────┘
```

### 3. After Mode Selection: Show Relevant Config

#### Example: Local Mode Selected

```
┌─────────────────────────────────────────────────────────────┐
│  🖥️ LOCAL MODE CONFIGURATION                                │
└─────────────────────────────────────────────────────────────┘

Status:
  ✅ Server running
  ✅ Ollama detected

Available Models:
  ● gpt-oss:120b (65GB) - Your largest model
  ○ qwen3:30b (18GB)
  ○ deepseek-r1:32b (19GB)

[Select Model] ▼

Ollama Endpoint: http://localhost:11434
Auto-start Ollama: [✓]

[Save Configuration]
```

#### Example: Cloud Mode Selected

```
┌─────────────────────────────────────────────────────────────┐
│  ☁️ CLOUD PROVIDER CONFIGURATION                            │
└─────────────────────────────────────────────────────────────┘

⚠️ Note: Using cloud providers will send your code and prompts
   to third-party servers. API costs apply.

Choose Provider:
  ● Google Gemini
    - Fast and cost-effective
    - 1,500 free requests/day
    - Best for: Rapid iteration
    [Select Model] ▼ Gemini 2.0 Flash
    API Key: [●●●●●●●●●AIza...] ✅

  ○ OpenAI
    - Most popular, reliable
    - Vision and multimodal support
    - Best for: Production
    [Select Model] ▼ GPT-4o
    API Key: [Enter key...] ❌

  ○ Anthropic Claude
    - Excellent for coding
    - Best safety features
    - Best for: Complex reasoning
    [Select Model] ▼ Claude 3.5 Sonnet
    API Key: [Enter key...] ❌

[Save Configuration]
```

#### Example: High Availability Selected

```
┌─────────────────────────────────────────────────────────────┐
│  🏢 HIGH AVAILABILITY (PAXOS) CONFIGURATION                  │
└─────────────────────────────────────────────────────────────┘

⚠️ Multi-model mode will make multiple API calls simultaneously
   This provides fault tolerance but increases costs ~3x

Strategy: [Fastest First ▼]
  - Fastest First: Use quickest response
  - Consensus Vote: Compare responses, pick best
  - Fallback Chain: Try primary, then fallback on error

Primary Model:    [Gemini 2.0 Flash ▼] (fast, cheap)
Fallback Model:   [GPT-4o ▼]           (reliable backup)
Consensus Model:  [Claude 3.5 Sonnet ▼] (quality tiebreaker)

Required API Keys:
  ✅ Gemini API Key configured
  ✅ OpenAI API Key configured
  ⚠️ Anthropic API Key missing

Estimated Cost: $0.08 per 1000 requests
Compared to:    $0.02 single provider

[Save Configuration]
```

### 4. Status Bar Enhancement

Current: Just shows "Server · Online" and "Ollama · Online"

Proposed:
```
┌─────────────────────────────────────────────────────────────┐
│ Mode: 🖥️ Local          Model: gpt-oss:120b                 │
│ Status: ✅ Ready        Cost: Free     Privacy: ✅ Private   │
└─────────────────────────────────────────────────────────────┘
```

Or for cloud:
```
┌─────────────────────────────────────────────────────────────┐
│ Mode: ☁️ Cloud          Model: Gemini 2.0 Flash             │
│ Status: ✅ Ready        Cost: ~$0.02/1K  Privacy: ⚠️ Shared │
└─────────────────────────────────────────────────────────────┘
```

### 5. Smart Recommendations

Based on environment detection, show recommendations:

```
┌─────────────────────────────────────────────────────────────┐
│  💡 RECOMMENDED SETUP                                        │
└─────────────────────────────────────────────────────────────┘

We detected:
  ✅ Node.js server running
  ✅ Ollama installed with 9 models
  ❌ No cloud API keys configured

Recommendation: 🖥️ LOCAL MODE
- You have everything needed to run completely free
- Your gpt-oss:120b model is powerful enough for most tasks
- Add cloud API as backup if needed

[Use Recommended Setup]  [Choose Different Mode]
```

### 6. Visual Mode Indicators

Add color coding and icons throughout:

- **Local**: Green 🖥️ (free, private)
- **Cloud**: Blue ☁️ (paid, shared)
- **Browser**: Purple 🌐 (limited)
- **Hybrid**: Yellow 🔄 (mixed)
- **Multi**: Orange 🏢 (expensive)
- **Custom**: Gray 🔧 (unknown)

### 7. Help Tooltips

Every mode card should have an (i) icon that shows:

```
┌─────────────────────────────────────────────────────────────┐
│  🖥️ LOCAL MODE                                    [ℹ️]       │
└─────────────────────────────────────────────────────────────┘

REQUIREMENTS:
  • Ollama installed and running
  • At least one model pulled
  • Node.js proxy server (npm start)

PROS:
  • Completely free (unlimited usage)
  • Maximum privacy (no data sent externally)
  • Fast inference with good hardware
  • Works offline

CONS:
  • Requires powerful hardware (GPU recommended)
  • Limited to model capabilities (vs GPT-4/Claude)
  • Takes disk space (models are large)

BEST FOR:
  • Development and testing
  • Privacy-sensitive work
  • Budget-conscious users
  • Unlimited experimentation

[Learn More] [Select This Mode]
```

### 8. Migration Path Hints

If user changes modes, show what will happen:

```
┌─────────────────────────────────────────────────────────────┐
│  Switching from Local → Cloud                                │
└─────────────────────────────────────────────────────────────┘

Changes:
  ✓ Your VFS and settings will be preserved
  ⚠️ You'll need to add an API key
  ⚠️ API costs will apply (~$0.02-0.10 per 1000 requests)
  ⚠️ Your code will be sent to [Provider]

Continue? [Yes, Switch Mode] [Cancel]
```

### 9. Quick Setup Wizard (Optional)

For first-time users:

```
┌─────────────────────────────────────────────────────────────┐
│  WELCOME TO REPLOID - QUICK SETUP (1/3)                      │
└─────────────────────────────────────────────────────────────┘

Let's get you started. What's most important to you?

○ I want it free and private (→ Local Mode)
○ I want the best AI models (→ Cloud Mode)
○ I want to try without installing anything (→ Browser Mode)
○ I need it for production (→ High Availability)

[Next →]
```

## Implementation Priority

**Phase 1: Minimal Improvements (Quick Wins)**
1. Add tradeoff labels to model dropdown (Free/Paid, Private/Cloud)
2. Add current mode indicator to status bar
3. Add help tooltips to confusing options (Web LLM, Paxos)
4. Show cost estimates for cloud models

**Phase 2: Mode Cards**
1. Create mode selector cards with tradeoffs
2. Reorganize Settings modal with "Mode" as primary
3. Add smart recommendations based on detection
4. Add migration warnings when switching modes

**Phase 3: Advanced Features**
1. Setup wizard for first-time users
2. Visual indicators throughout UI
3. Detailed help modals for each mode
4. Cost tracking and usage statistics

## Mockup: Minimal Improvement (Phase 1)

Just improve the current dropdown:

```html
<select id="model-select" class="model-select-dropdown">
  <optgroup label="💰 Cloud Models (Paid, Fast, Advanced)">
    <option value="gemini-2.0-flash" data-provider="gemini">
      Gemini 2.0 Flash • ~$0.01/1K • Fast
    </option>
    <option value="gpt-4o" data-provider="openai">
      GPT-4o • ~$0.10/1K • Advanced • Vision
    </option>
  </optgroup>

  <optgroup label="🖥️ Local Models (Free, Private)">
    <option value="ollama-gpt-oss:120b" data-provider="local">
      gpt-oss:120b • Free • Requires Ollama
    </option>
  </optgroup>

  <optgroup label="🌐 Browser-Based (Free, Slower)">
    <option value="web-llm" data-provider="web">
      Web LLM • Free • Runs in browser • Download required
    </option>
  </optgroup>

  <optgroup label="🏢 Advanced Modes">
    <option value="paxos" data-provider="paxos">
      Multi-Model (Paxos) • 3x cost • High availability
    </option>
    <option value="custom-proxy" data-provider="custom">
      Custom Endpoint • Your infrastructure
    </option>
  </optgroup>
</select>
```

## User Testing Questions

To validate redesign:
1. "Which mode would you choose and why?"
2. "What's the difference between Local and Cloud?"
3. "What does Paxos do?"
4. "How much will this cost you?"
5. "Is your data private in this configuration?"

Current UI: Users can't answer these easily
Proposed UI: All answers visible at a glance

## Conclusion

**Current state**: Configuration panel disguised as model selector
**Needed state**: Mode-first design with clear tradeoffs and guidance

The redesign makes deployment modes:
- **Discoverable** (cards vs dropdown)
- **Understandable** (tradeoffs shown upfront)
- **Actionable** (clear next steps)
- **Safe** (warnings before changes)
