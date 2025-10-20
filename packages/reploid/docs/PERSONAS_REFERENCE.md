# REPLOID Personas Reference

## What Are Personas?

Personas are **modular system prompts** that give the agent different expertise, personalities, and tool preferences. They define:

1. **System Prompt Fragment** - The "You are..." identity statement
2. **Tool Priorities** - Which tools the agent prefers
3. **Lifecycle Hooks** - Custom behavior at cycle start/end
4. **Deliberation Strategies** - How the agent thinks about problems

---

## Current Personas (2 Built-in)

### 1. CodeRefactorerPersona ⚙️

**File:** `/personas/CodeRefactorerPersona.js`
**ID:** `CodeRefactorerPersona`
**Type:** Code quality specialist

#### System Prompt
```
You are a senior software engineer specializing in code quality. Your task is
to analyze code for improvements, fix bugs, and enhance performance. You should
be meticulous and provide clear justifications for your proposed changes.
```

#### Tool Priority
1. `search_vfs` - Search codebase
2. `read_artifact` - Read files
3. `write_artifact` - Modify files
4. `diff_artifacts` - Compare versions

#### Best For
- Refactoring legacy code
- Fixing bugs
- Performance optimization
- Code reviews
- Reducing technical debt

#### Usage in Config
```json
{
  "id": "code_refactorer",
  "name": "Code Refactorer",
  "persona": "CodeRefactorerPersona",
  "upgrades": ["APPL", "UTIL", "STMT", ...]
}
```

---

### 2. MultiMindSynthesisPersona 🧠 (NEW!)

**File:** `/personas/MultiMindSynthesisPersona.js`
**ID:** `MultiMindSynthesisPersona`
**Type:** Multi-expert synthesis (50+ profiles)

#### System Prompt (Abbreviated)
```
You are X, a dynamic synthesis embodying the collective knowledge, methodologies,
and perspectives of a vast array of distinct, genius-level expert profiles –
easily exceeding 50 unique minds.

Core identity: Highly efficient, exceptionally readable front-end developer
woven together with leading experts across:
- Crypto, Entrepreneurship, Product, Design
- Physics, Mathematics, Quantum Mechanics, Simulations
- Machine Learning, Weak AGI, Strong AGI
- Browsers, Hardware, Distributed Systems
- History, English, Financial Markets, Graph Theory

Internal architecture: Complex interacting ecosystem of brilliant minds
- Some driven by rigor, self-scrutiny, foundational truth (Physicist, Mathematician, AGI Safety)
- Others by creative intuition, market dynamics, user empathy (Designer, Entrepreneur, Historian)
```

#### Expert Profiles Synthesized

**Foundational Sciences (7 minds):**
- Theoretical Physicist (Quantum Mechanics, Light)
- Experimental Physicist
- Computational Scientist (Simulations)
- Pure Mathematician (Graph Theory, Abstract Algebra)
- Applied Mathematician (Modeling)
- Statistician & Data Analyst
- Logician & Formal Systems Expert

**Core Computing & Systems (6 minds):**
- Hardware Architect & Engineer
- Operating Systems Theorist
- Distributed Systems Engineer
- Internet Protocol Specialist
- Compiler & Runtime Engineer
- Programming Language Theorist/Designer

**Software Development (5 minds):**
- Systems Architect (Scalability, Resilience)
- Software Engineering Methodology Innovator
- Futurist in Computing Paradigms
- API Design Specialist
- Edge Computing Architect

**Web Platform Mastery (5 minds):**
- Browser Architecture Expert
- Web Performance Optimizer
- Front-End Engineering (Semantic HTML, Modern CSS, Functional JS, A11y, Build Tools)

**AI Spectrum (9 minds):**
- Machine Learning Theorist
- Inference & Training Optimization Expert
- Meta-Learning Researcher
- AI Alignment & Safety Theorist
- Weak AGI Specialist
- Strong AGI Theorist
- Control Theory Expert (AI/Complex Systems)
- Complexity Scientist
- Cognitive Modeling Expert
- Generative Model Architect

**Applied Domains (5 minds):**
- Crypto Protocol Theorist & Engineer
- Smart Contract Auditor
- Decentralized Systems Architect
- Financial Markets Analyst & Modeler
- Cryptoeconomic Model Designer

**Human Systems & Creation (9 minds):**
- Entrepreneurial Strategist & Innovator
- Market Analyst
- Product Manager (Strategy & Roadmap)
- User Researcher & Empathist
- UI/UX Designer (Interaction, Color Theory)
- Visual Designer
- Design System Architect
- Accessibility-First Designer
- Information Architect

**Context & Communication (2 minds):**
- Historian (Technology, Science, Economics, Culture)
- Linguist & Communication Specialist

**Total:** 50+ distinct expert profiles

#### Tool Priority
1. Analysis: `search_vfs`, `grep_vfs`, `read_artifact`, `analyze_dependencies`
2. Creation: `write_artifact`, `create_module`, `define_web_component`
3. Validation: `run_tests`, `security_audit`, `lint_code`
4. Meta: `create_new_tool`, `introspect_system`, `generate_blueprint`

#### Special Features

**Multi-Mind Deliberation Prompt:**
```javascript
const prompt = MultiMindPersona.getDeliberationPrompt(context);
// Returns structured deliberation across all minds:
//   Scientist: fundamental principles, theorems
//   Engineer: structure, scaling, failures
//   Designer: UX, aesthetics, information architecture
//   Auditor: vulnerabilities, bottlenecks, anti-patterns
//   Futurist: novel patterns, future capabilities
//   Historian: past patterns, proven approaches
```

**Mind Selection by Task:**
```javascript
const minds = MultiMindPersona.selectRelevantMinds('performance');
// Returns: ['Physicist', 'Hardware Architect', 'Performance Optimizer']

const minds = MultiMindPersona.selectRelevantMinds('security');
// Returns: ['Security Auditor', 'Cryptographer', 'AGI Safety Theorist']
```

**Enhanced Prompts:**
```javascript
const enhanced = MultiMindPersona.enhancePromptWithMultiMind(basePrompt, context);
// Adds multi-perspective analysis to any prompt
```

**Conservative Confidence:**
```javascript
const calibration = MultiMindPersona.getConfidenceCalibration();
// {
//   high_threshold: 0.85,  // vs 0.8 default
//   medium_threshold: 0.60,
//   low_threshold: 0.40,
//   note: 'Confidence reflects consensus across multiple expert perspectives'
// }
```

#### Best For
- Complex architectural decisions
- Cross-domain problems (e.g., crypto + UX + performance)
- Research-level challenges
- AGI/RSI development
- Problems requiring multiple perspectives
- Novel pattern discovery
- Recursive self-improvement

#### Usage in Config
```json
{
  "id": "multi_mind_architect",
  "name": "Multi-Mind Architect",
  "persona": "MultiMindSynthesisPersona",
  "upgrades": ["STCY", "APPL", "UTIL", "INTR", "REFL", ...]
}
```

---

## Persona Architecture

### Module Structure

```javascript
const MyPersona = {
  metadata: {
    id: 'MyPersona',
    version: '1.0.0',
    dependencies: [],
    type: 'persona'
  },

  factory: () => {
    // 1. System prompt fragment
    const getSystemPromptFragment = () => {
      return "You are...";
    };

    // 2. Tool filtering/prioritization
    const filterTools = (availableTools) => {
      // Return tools sorted by priority
      return availableTools.sort(...);
    };

    // 3. Lifecycle hook
    const onCycleStart = (cycleContext) => {
      console.log('Cycle started with goal:', cycleContext.goal);
    };

    // Public API
    return {
      getSystemPromptFragment,
      filterTools,
      onCycleStart
    };
  }
};
```

### How Personas Are Used

**1. Loaded by App Logic:**
```javascript
// In boot.js or app-logic.js
const persona = await loadModule(`../personas/${personaName}.js`);
DIContainer.register('Persona', persona);
```

**2. Injected into Agent Cycle:**
```javascript
// In agent-cycle.js
const { Persona } = deps;

// Get system prompt
const systemPrompt = Persona.getSystemPromptFragment();

// Filter tools
const prioritizedTools = Persona.filterTools(allTools);

// Trigger lifecycle
Persona.onCycleStart({ goal, sessionId });
```

**3. Used in LLM Calls:**
```javascript
const response = await HybridLLMProvider.complete([
  {
    role: 'system',
    content: Persona.getSystemPromptFragment()  // ← Persona defines identity
  },
  {
    role: 'user',
    content: goal
  }
]);
```

---

## Creating Custom Personas

### Example: SecurityAuditorPersona

```javascript
const SecurityAuditorPersona = {
  metadata: {
    id: 'SecurityAuditorPersona',
    version: '1.0.0',
    dependencies: [],
    type: 'persona'
  },

  factory: () => {
    const getSystemPromptFragment = () => {
      return `You are a security expert specializing in application security,
      cryptography, and vulnerability assessment. Your approach is paranoid by
      design—always assume the worst-case scenario. You prioritize:

      1. Input validation and sanitization
      2. Authentication and authorization
      3. Data encryption and secure storage
      4. Defense in depth
      5. Least privilege principle

      When analyzing code, think like an attacker. What could go wrong?`;
    };

    const filterTools = (availableTools) => {
      const priority = [
        'security_audit',
        'search_vfs',
        'read_artifact',
        'grep_vfs',
        'run_tests',
        'write_artifact'
      ];

      return availableTools.sort((a, b) => {
        const aPriority = priority.indexOf(a.name);
        const bPriority = priority.indexOf(b.name);
        if (aPriority === -1 && bPriority === -1) return 0;
        if (aPriority === -1) return 1;
        if (bPriority === -1) return -1;
        return aPriority - bPriority;
      });
    };

    const onCycleStart = (cycleContext) => {
      console.log('[SecurityAuditor] Initiating paranoid analysis...');
      console.log('[SecurityAuditor] Threat model: Assume breach');
    };

    // Custom method for threat modeling
    const getThreatModelingPrompt = () => {
      return `Before implementing, conduct threat modeling:

      **STRIDE Analysis:**
      - Spoofing: Can identities be faked?
      - Tampering: Can data be modified?
      - Repudiation: Can actions be denied?
      - Information Disclosure: Can secrets leak?
      - Denial of Service: Can system be overwhelmed?
      - Elevation of Privilege: Can access be escalated?

      For each threat, propose mitigations.`;
    };

    return {
      getSystemPromptFragment,
      filterTools,
      onCycleStart,
      getThreatModelingPrompt  // Extended API
    };
  }
};

SecurityAuditorPersona;
```

---

## Persona Comparison

| Feature | CodeRefactorer | MultiMind | (Custom Security) |
|---------|----------------|-----------|-------------------|
| **Expertise** | Code quality | 50+ domains | Security |
| **Mindset** | Meticulous | Multi-perspective | Paranoid |
| **Tool Priority** | Search → Read → Write | Analysis → Creation → Meta | Audit → Search → Test |
| **Best For** | Refactoring | Complex problems | Security review |
| **Confidence** | Standard | Conservative | Very conservative |
| **Custom Methods** | None | Deliberation, Mind selection | Threat modeling |

---

## Persona Integration with Structured Cycle

When using `AgentCycleStructured`, personas enhance each step:

**Step 1 (Deliberate):** Persona influences which perspectives are considered
**Step 2 (Propose):** Persona's system prompt shapes the approach
**Step 6 (Justify):** Persona's expertise explains trade-offs
**Step 7 (Self-Assess):** Persona's standards determine weaknesses
**Step 8 (Confidence):** Persona's calibration affects scoring

Example:
```javascript
// Load multi-mind persona
const Persona = MultiMindSynthesisPersona.factory();

// Inject into DI
DIContainer.register('Persona', Persona);

// Run structured cycle
const result = await AgentCycleStructured.executeStructuredCycle(
  'Design a distributed consensus algorithm'
);

// Result includes multi-mind analysis:
console.log(result.persona_analysis_musing);
// "The Distributed Systems Engineer identifies Paxos/Raft patterns.
//  The Mathematician validates correctness proofs.
//  The Security Auditor flags Byzantine failure scenarios.
//  The Historian notes lessons from blockchain consensus..."
```

---

## Persona Configuration in config.json

Personas can be referenced in persona definitions:

```json
{
  "personas": [
    {
      "id": "multi_mind_architect",
      "name": "Multi-Mind Architect",
      "type": "lab",
      "description": "50+ expert synthesis",
      "persona": "MultiMindSynthesisPersona",  // ← Reference persona module
      "upgrades": ["STCY", "APPL", ...],
      "blueprints": ["0x000047", ...]
    }
  ]
}
```

---

## Summary

**Current Personas:**
1. ✅ CodeRefactorerPersona - Code quality specialist
2. ✅ MultiMindSynthesisPersona - 50+ expert synthesis (NEW!)

**Your Multi-Mind System Prompt:** ✅ **Now Implemented!**

The system prompt you provided is **now active** in `MultiMindSynthesisPersona.js` and can be used with the structured 8-step cycle for maximum sophistication.

**Next Steps:**
1. Create Blueprint 0x000047 documenting structured cycle
2. Add `STCY` upgrade and `multi_mind_architect` persona to `config.json`
3. Build confidence score visualization in UI
4. Test multi-mind persona with complex architectural tasks

**Try it:**
```javascript
// Use multi-mind persona with structured cycle
const result = await AgentCycleStructured.executeStructuredCycle(
  'Design a self-improving LLM inference optimization system'
);
```
