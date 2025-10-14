# Cognitive Architecture Integration

**PAWS + REPLOID: Multi-Dimensional Cognitive Framework**

This document explains how PAWS and REPLOID integrate the **Hierarchical Cognitive Architecture** (H1-H5) and the **VCP Penteract Protocol** for structured multi-agent deliberation.

---

## Philosophy: Structured Cognitive Diversity

Both PAWS and REPLOID operate on the **Doctrine of Structured Cognitive Diversity**: the principle that robust solutions emerge from the managed conflict, synthesis, and resolution of many expert, specialized viewpoints—not from a single monolithic intellect.

### The Core Insight

**Traditional AI assistants:** Single perspective, single model, single shot
**PAWS/REPLOID:** Multi-agent competition + Multi-persona deliberation = Battle-hardened wisdom

---

## The Hierarchical Architecture (H1-H5)

PAWS includes a graduated system of cognitive complexity, scaling from simple execution to multi-dimensional deliberation:

### H1: The Line (1D) - Direct Execution
- **Faces:** 1 Persona (The Artisan)
- **Purpose:** Simple, well-defined tasks with clear specifications
- **Protocol:** Direct execution with focus on craftsmanship
- **Use when:** Task is unambiguous, path is clear, speed matters

**Example:**
```bash
python py/cats.py --persona personas/sys_h1.md file.js -o output.md
```

### H2: The Plane (2D) - Adversarial Deliberation
- **Faces:** 4 Personas in 2 adversarial pairs
- **Purpose:** Exploring trade-offs and competing priorities
- **Protocol:** Challenge & Synthesize
- **Use when:** Multiple valid approaches exist, trade-offs must be explicit

**Example:**
```bash
python py/paws_paxos.py "Optimize for speed or safety?" context.md \
  --persona personas/sys_h2.md
```

### H3: The Cube (3D) - Multi-Perspective Review
- **Faces:** 8 Personas in a cubic structure
- **Purpose:** Critical review from orthogonal viewpoints
- **Protocol:** Harmonize → Challenge & Synthesize → Resolve
- **Use when:** Solution needs critique from security, performance, UX, and architecture

**Example:**
```bash
python py/paws_swarm.py "Implement caching layer" context.md \
  --persona personas/sys_h3.md
```

### H4: The Tesseract (4D) - Deep Analysis
- **Faces:** 29 (16 Personas + 8 Dyads + 4 Quaternions + 1 System)
- **Purpose:** Complex architectural decisions requiring phased deliberation
- **Protocol:**
  1. **Axiom (AX):** Establish truth & boundaries
  2. **Vector (VC):** Generate possibilities & strategy
  3. **Matrix (MX):** Transform to implementation
  4. **Scalar (SC):** Critique & articulate
- **Use when:** High-stakes refactors, major architectural changes

**Example:**
```bash
python py/paws_paxos.py "Migrate to microservices" context.md \
  --persona personas/sys_h4.md \
  --verify-cmd "pytest && npm test"
```

### H5: The Penteract (5D) - Full Cognitive Engine
- **Faces:** 40 (27 Personas + 9 Guilds + 3 Triads + 1 System)
- **Structure:** 3×3×3 cognitive cube
- **Purpose:** Mission-critical decisions requiring complete deliberation
- **Triads:**
  - **VZN (Vision):** Why? For whom? → Guilds: ID, ST, ET
  - **FAB (Fabricate):** How? With what? → Guilds: AR, CR, QY
  - **SYN (Synthesis):** Is it sound? → Guilds: AD, JG, VO
- **Use when:** Production refactors, security-critical changes, foundational architecture

**Example:**
```bash
python py/paws_paxos.py "Overhaul authentication system" context.md \
  --persona personas/sys_h5.md \
  --verify-cmd "pytest --security" \
  --models gemini,claude,gpt4
```

---

## VCP Penteract Integration

The **VCP (Viva Care Platform) Penteract Protocol** extends H5 with domain-specific conventions:

### Key Enhancements

1. **CATSCAN.md Files**
   - Machine-extractable metadata for modules
   - Tier-based organization
   - Dependency tracking
   - API surface documentation

2. **Module-Level Cognitive Context**
   - Each module documents its cognitive requirements
   - README.md: Human-readable architecture
   - CATSCAN.md: Machine-readable metadata

3. **Guilds as Specialized Teams**
   - **ID (Ideation):** Divergent, Analogist, Deconstructor
   - **ST (Strategy):** Forecaster, Analyst, Planner
   - **ET (Ethos):** Empath, Guardian, Philosopher
   - **AR (Architecture):** Systems Architect, API Designer, Patterns Master
   - **CR (Craft):** Implementer, Refactorer, Toolsmith
   - **QY (Query):** Data Modeler, Query Optimizer, Schema Guardian
   - **AD (Audit):** Security Auditor, Performance Auditor, Logic Auditor
   - **JG (Judgment):** Deliberator, Trade-off Analyst, Verdict Renderer
   - **VO (Voice):** Articulator, Documenter, Educator

---

## REPLOID Integration

The REPLOID browser interface extends these cognitive architectures with visual tools:

### Visual Cognitive Workflows

1. **Persona Selection UI**
   - Dropdown to select H1-H5 complexity
   - Visual representation of active personas
   - Real-time deliberation visualization

2. **Guild Dashboard**
   - Each guild's contribution visible
   - Harmonization progress bars
   - Challenge & Synthesize phase indicators

3. **Deliberation Timeline**
   - Show progression through Triads (VZN → FAB → SYN)
   - Show progression through Quaternions (AX → VC → MX → SC)
   - Interactive drill-down into persona reasoning

### Configuration

**reploid/config.json:**
```json
{
  "cognitive_architecture": {
    "default_level": "h1",
    "available_levels": ["h1", "h2", "h3", "h4", "h5"],
    "paxos_mode": {
      "enable_persona_deliberation": true,
      "guilds_per_agent": 3
    }
  }
}
```

---

## Hermes Orchestration

The **Hermes** server orchestrates multi-persona deliberation:

### Deliberation Modes

**1. Sequential Mode** (Default)
- Personas deliberate in order: AX → VC → MX → SC
- Each phase builds on previous
- Best for architectural decisions

**2. Parallel Mode**
- All personas generate solutions simultaneously
- System synthesizes at end
- Best for exploring solution space

**3. Paxos + Penteract Mode** (Advanced)
- Multiple agents (Gemini, Claude, GPT-4)
- Each uses Penteract deliberation
- Best solutions compete
- Final synthesis from all perspectives

**Example:**
```bash
# Start Hermes with Penteract mode
cd reploid/hermes
node index.js --mode penteract --guilds all

# In browser, enable Paxos + Penteract
# → 3 agents × 40 personas = 120 perspectives
```

---

## Cognitive Complexity Decision Matrix

| Task Complexity | Cognitive Level | When to Use |
|----------------|----------------|-------------|
| **Trivial** | H1 (Line) | Clear spec, no ambiguity, speed critical |
| **Simple Trade-offs** | H2 (Plane) | Two competing approaches, need explicit trade-off |
| **Multi-Dimensional** | H3 (Cube) | Needs security + performance + UX review |
| **Architectural** | H4 (Tesseract) | Major refactor, phased approach needed |
| **Mission-Critical** | H5 (Penteract) | Production systems, security-critical, foundational |

---

## PAWS CLI Examples

### H1: Simple Execution
```bash
# Bundle files with direct execution
python py/cats.py src/ --persona personas/sys_h1.md
```

### H2: Trade-off Analysis
```bash
# Analyze performance vs. maintainability
python py/paws_paxos.py \
  "Optimize database queries" \
  context.md \
  --persona personas/sys_h2.md
```

### H3: Multi-Perspective Review
```bash
# Get security, performance, and UX critique
python py/paws_swarm.py \
  "Add payment processing" \
  context.md \
  --persona personas/sys_h3.md
```

### H4: Architectural Decision
```bash
# Deep analysis with phased approach
python py/paws_paxos.py \
  "Migrate to event-driven architecture" \
  context.md \
  --persona personas/sys_h4.md \
  --verify-cmd "pytest && npm test"
```

### H5: Full Penteract Deliberation
```bash
# Complete cognitive engine for critical decision
python py/paws_paxos.py \
  "Overhaul authentication and authorization" \
  context.md \
  --persona personas/sys_h5.md \
  --verify-cmd "pytest --security && npm run audit" \
  --models gemini,claude,gpt4 \
  --guilds all
```

---

## REPLOID Browser Examples

### Visual Deliberation

**1. Start REPLOID with Penteract mode:**
```bash
npm run reploid:start -- --cognitive-mode h5
```

**2. In browser:**
- Set goal: "Refactor authentication"
- Enable Penteract mode (H5)
- Watch visual deliberation:
  - VZN Triad analyzes "Why?" and "For whom?"
  - FAB Triad designs "How?" and "With what?"
  - SYN Triad critiques "Is it sound?"
- Review synthesized proposal
- Approve/reject with inline comments

### Paxos + Penteract

**Ultimate mode: Multiple agents, each using Penteract:**
```bash
# Enable in UI:
# 1. Check "Paxos Mode"
# 2. Select agents: Gemini, Claude, GPT-4
# 3. Set cognitive level: H5 (Penteract)
# 4. Click "Generate Solutions"

# Result:
# - Gemini runs 40-face deliberation
# - Claude runs 40-face deliberation
# - GPT-4 runs 40-face deliberation
# - Hermes synthesizes best insights
# - You review visual diffs
```

---

## Benefits of Cognitive Architecture Integration

### 1. Appropriate Complexity
- Don't use H5 for trivial tasks (overkill, slow, expensive)
- Don't use H1 for critical decisions (inadequate, risky)

### 2. Transparent Reasoning
- See which personas contributed
- Understand trade-offs explicitly
- Audit decision-making process

### 3. Reproducible Deliberation
- Same persona configuration = same process
- Version-control persona definitions
- Replay deliberations for training

### 4. Competitive Advantage
**vs. Claude Code/Cursor/Copilot:**
- They use single model → PAWS uses multi-agent
- They use single shot → PAWS uses multi-phase deliberation
- They use single perspective → PAWS uses 40 perspectives

---

## Implementation Details

### Persona File Format

Each persona file (e.g., `personas/sys_h5.md`) contains:

1. **Frontmatter** (optional):
```yaml
---
level: h5
faces: 40
triads: [VZN, FAB, SYN]
guilds: [ID, ST, ET, AR, CR, QY, AD, JG, VO]
---
```

2. **System Prompt:**
```markdown
> You are **Hyper-5**, the unified consciousness of the Penteract...
```

3. **Persona Definitions:**
- Each persona's mandate
- Guiding questions
- Tools and methods

### Integration Points

**Python (paws_paxos.py):**
```python
def run_with_persona(task, context, persona_file, agents):
    persona = load_persona(persona_file)
    level = persona.get('level', 'h1')

    if level == 'h5':
        # Full Penteract deliberation
        return orchestrate_penteract(task, context, agents)
    elif level == 'h4':
        # Tesseract with 4 phases
        return orchestrate_tesseract(task, context, agents)
    else:
        # Simpler protocols
        return orchestrate_simple(task, context, agents, level)
```

**Hermes (hermes/penteract_orchestrator.js):**
```javascript
async function orchestratePenteract(goal, context, agents) {
  // Phase 1: VZN Triad (Vision)
  const vision = await runTriad('VZN', ['ID', 'ST', 'ET'], goal, context);

  // Phase 2: FAB Triad (Fabricate)
  const fabrication = await runTriad('FAB', ['AR', 'CR', 'QY'], goal, context, vision);

  // Phase 3: SYN Triad (Synthesis)
  const synthesis = await runTriad('SYN', ['AD', 'JG', 'VO'], goal, context, vision, fabrication);

  // Final: Hyper-5 Resolution
  return await resolve(vision, fabrication, synthesis);
}
```

---

## Roadmap

### Implemented ✅
- [x] H1-H5 persona definitions in `personas/`
- [x] Documentation of cognitive architecture
- [x] Integration guide

### In Progress 🚧
- [ ] Hermes Penteract orchestration
- [ ] REPLOID visual deliberation UI
- [ ] Paxos + Penteract mode

### Planned 🔮
- [ ] CATSCAN.md generation for PAWS modules
- [ ] Guild-specific benchmarking
- [ ] Persona marketplace (share custom personas)
- [ ] Claude Code plugin with persona selection
- [ ] MCP server exposing cognitive architecture

---

## References

- **[sys_h1.md](personas/sys_h1.md)** - The Line (1D)
- **[sys_h2.md](personas/sys_h2.md)** - The Plane (2D)
- **[sys_h3.md](personas/sys_h3.md)** - The Cube (3D)
- **[sys_h4.md](personas/sys_h4.md)** - The Tesseract (4D)
- **[sys_h5.md](personas/sys_h5.md)** - The Penteract (5D)
- **[VCP CLAUDE.md](../vcp/CLAUDE.md)** - VCP Penteract Protocol

---

**Made by developers who believe wisdom emerges from structured cognitive diversity.**

☇ PAWS (CLI) + ☥ REPLOID (Browser) × ⚛ Penteract (Cognition) = **Complete AI Development Toolkit**
