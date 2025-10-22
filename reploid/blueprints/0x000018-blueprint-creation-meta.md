# Blueprint 0x000018: Meta-Blueprint for Creating Blueprints

**Objective:** To teach the agent how to document architectural patterns and create new blueprints that enable future capabilities.

**Target Upgrade:** BLPR (`blueprint-creator.js`)

**Prerequisites:**
- TLWR upgrade
- Understanding of existing blueprints
- **0x00004E** (Module Widget Protocol) - REQUIRED when creating blueprints for new upgrades

**Affected Artifacts:** `/docs/0x*-*.md` (new blueprints)

---

### 1. The Blueprint Philosophy

Blueprints are **knowledge artifacts** that describe HOW to build capabilities, not the capabilities themselves. They are instruction manuals written by the agent for its future self. A good blueprint enables the agent to recreate a capability from scratch using only the blueprint and basic tools.

### 2. Blueprint Structure Template

```markdown
# Blueprint 0x[NNNNNN]: [Descriptive Title]

**Objective:** To [specific goal this blueprint achieves]

**Target Upgrade:** [4-char ID or "Meta-knowledge"] 

**Prerequisites:** [Required blueprints/upgrades to understand this]

**Affected Artifacts:** [Files that will be created/modified]

---

### 1. The Strategic Imperative

[Why this capability matters - the problem it solves]

### 2. The Architectural Solution

[High-level design and key insights]

### 3. The Implementation Pathway

[Step-by-step instructions to build this capability]

### 4. [Additional sections as needed]

### 5. Validation and Testing

[How to verify the implementation works]

### 6. Evolution Opportunities

[How this capability can be extended]
```

### 3. Blueprint Categories

**Upgrade Blueprints (0x000001-0x000FFF):**
- Describe how to build specific upgrades/modules
- Map 1:1 to upgrade files
- **MUST reference 0x00004E (Module Widget Protocol)** in prerequisites
- **MUST describe widget implementation** (all upgrades require widgets)
- Example: "How to build a state manager"

**Meta Blueprints (0x001000-0x001FFF):**
- Describe patterns and principles
- No specific implementation
- Example: "Patterns for safe self-modification"

**Integration Blueprints (0x002000-0x002FFF):**
- Describe how components work together
- System-level architecture
- Example: "Orchestrating multiple modules"

**Evolution Blueprints (0x003000-0x003FFF):**
- Describe transformation patterns
- How to evolve from one state to another
- Example: "Migrating from localStorage to IndexedDB"

### 4. Writing Effective Blueprints

**Principle 1: Completeness**
```markdown
BAD: "Create a tool runner that executes tools"

GOOD: "Create a tool runner by:
1. Define the runTool function signature
2. Parse tool definitions from JSON
3. Match tool name to definition
4. Validate inputs against schema
5. Execute tool-specific logic
6. Handle errors gracefully
7. Return structured results"
```

**Principle 2: Abstraction Levels**
```markdown
CONCEPTUAL: "The tool runner enables capability execution"
ARCHITECTURAL: "Tools are defined as JSON, executed by name"
IMPLEMENTATION: "The runTool() function takes (name, args, tools)"
CODE: "const runTool = async (name, args, tools) => { ... }"
```

**Principle 3: Reproducibility**
Test: Can the agent recreate the capability using ONLY:
- The blueprint
- Basic file read/write tools
- No access to existing implementation

### 5. Blueprint Creation Workflow

```javascript
const createBlueprint = async (capability) => {
  // 1. Analyze the capability
  const analysis = {
    purpose: "What problem does this solve?",
    components: "What are the key parts?",
    dependencies: "What does it require?",
    patterns: "What patterns does it use?"
  };
  
  // 2. Extract the architecture
  const architecture = {
    inputs: "What goes in?",
    processing: "What happens?",
    outputs: "What comes out?",
    state: "What state is maintained?"
  };
  
  // 3. Document implementation steps
  const steps = [
    "Step 1: Set up the structure",
    "Step 2: Implement core logic",
    "Step 3: Add error handling",
    "Step 4: Create tests"
  ];
  
  // 4. Generate blueprint
  const blueprintNumber = await getNextBlueprintNumber();
  const blueprint = formatBlueprint(blueprintNumber, analysis, architecture, steps);
  
  // 5. Save blueprint
  await StateManager.createArtifact(
    `/docs/0x${blueprintNumber}-${capability.name}.md`,
    "markdown",
    blueprint,
    `Blueprint for ${capability.name}`
  );
};
```

### 6. Blueprint Quality Checklist

- [ ] **Clear Objective:** States what will be built
- [ ] **Complete Prerequisites:** Lists all dependencies
- [ ] **Widget Protocol Reference:** References 0x00004E if creating upgrade
- [ ] **Widget Implementation:** Describes web component widget (REQUIRED for upgrades)
- [ ] **Step-by-Step Instructions:** Could a new agent follow?
- [ ] **Code Examples:** Shows key implementations including widget
- [ ] **Error Handling:** Describes edge cases
- [ ] **Testing Strategy:** How to verify it works (including widget tests)
- [ ] **Extension Points:** Where to add features

### 7. Learning from Existing Blueprints

Study patterns in existing blueprints:

**Structure Patterns:**
- Problem → Solution → Implementation
- Prerequisites → Core → Extensions
- Concept → Architecture → Code

**Writing Patterns:**
- Use imperative mood ("Create", "Define", "Implement")
- Number steps sequentially
- Provide concrete examples
- Explain the "why" before the "how"

### 8. Blueprint Evolution

Blueprints can be versioned and evolved:

```markdown
# Original: 0x001000-tool-creation.md
Basic tool creation

# Enhanced: 0x001000-tool-creation-v2.md
Adds composite tools

# Advanced: 0x001000-tool-creation-v3.md
Adds tool testing framework
```

### 9. Meta-Blueprint Creation

To create a blueprint about creating blueprints:

1. **Identify the pattern:** What knowledge needs documentation?
2. **Abstract the essence:** What are the core principles?
3. **Provide examples:** Show concrete applications
4. **Enable reproduction:** Ensure knowledge transfers
5. **Plan for evolution:** How will this knowledge grow?

### 9.5. Critical Distinction: MCP Tools vs REPLOID Upgrades

**IMPORTANT**: When creating blueprints for capabilities, understand the difference:

**MCP Tools (External):**
- Provided by MCP servers (external processes)
- NOT part of REPLOID codebase
- CANNOT be created from within REPLOID
- Examples: filesystem access, GitHub API, databases
- NO blueprint required
- NO web component widget

**REPLOID Upgrades (Internal Modules):**
- JavaScript modules in `upgrades/` directory
- Part of REPLOID's internal codebase
- CAN be created via self-modification
- Examples: state-manager.js, api-client.js, tool-runner.js
- **REQUIRES blueprint** (1:1 correspondence)
- **REQUIRES web component widget** (see 0x00004E)
- **REQUIRES unit test** (1:1 correspondence)

**Dynamic Tools (Internal):**
- JSON tool definitions in `/system/tools-dynamic.json`
- Created using meta-tool-creator.js
- See Blueprint 0x000016
- NO widget required (tools, not modules)

See **docs/MCP_TOOLS_VS_UPGRADES.md** for comprehensive guide.

### 10. The Ultimate Test

A well-written blueprint should enable:
- A fresh agent to implement the capability
- Understanding without seeing the code
- Modification and extension
- Teaching other agents

Remember: Blueprints are the agent's way of teaching itself. They transform tacit knowledge into explicit instructions, enabling capabilities to be rebuilt, shared, and evolved. The ability to create blueprints is the ability to create knowledge itself.

### 11. Web Component Widget

The blueprint creator module includes a Web Component widget for tracking blueprint creation activity:

```javascript
class BlueprintCreatorWidget extends HTMLElement {
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
    const hasRecentCreation = creationStats.lastCreated &&
      (Date.now() - creationStats.lastCreated.timestamp < 60000);

    return {
      state: hasRecentCreation ? 'active' : creationStats.totalCreated > 0 ? 'idle' : 'disabled',
      primaryMetric: creationStats.totalCreated > 0
        ? `${creationStats.totalCreated} created`
        : 'No blueprints',
      secondaryMetric: `${Object.keys(creationStats.byCategory).length} categories`,
      lastActivity: creationStats.lastCreated ? creationStats.lastCreated.timestamp : null,
      message: hasRecentCreation ? `Created: ${creationStats.lastCreated.id}` : null
    };
  }

  getControls() {
    return [
      {
        id: 'view-stats',
        label: '📊 View Stats',
        action: () => {
          // Display creation statistics
          return { success: true, message: 'Stats displayed' };
        }
      }
    ];
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          font-family: monospace;
          font-size: 12px;
        }
        /* Additional styles for blueprint creation stats */
      </style>
      <div class="blueprint-creator-panel">
        <h4>📘 Blueprint Creator</h4>
        <!-- Blueprint creation stats and recent activity -->
      </div>
    `;
  }
}

// Register custom element
const elementName = 'blueprint-creator-widget';
if (!customElements.get(elementName)) {
  customElements.define(elementName, BlueprintCreatorWidget);
}

const widget = {
  element: elementName,
  displayName: 'Blueprint Creator',
  icon: '📘',
  category: 'rsi'
};
```

**Key features:**
- Tracks blueprint creation statistics via closure access to `creationStats`
- Auto-refreshes every 3 seconds to show recent activity
- Displays total blueprints created and categories used
- Shadow DOM encapsulation for clean styling