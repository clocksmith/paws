# 🧶🐈 PAWS: Prepare Artifacts With ⚽🐕 SWAP: Streamlined Write After PAWS 🧶🐈⚽🐕

**🐾 PAWS 💱** provides a set of transparent and powerful command-line utilities to bundle your project files for efficient interaction with Large Language Models (LLMs), and then to reconstruct them, enabling a swift code **💱 SWAP 🐾** (Streamlined Write After PAWS).

This repository contains parallel implementations in **Python** and **Node.js**, offering feature parity and a consistent workflow for developers in both ecosystems.

## The PAWS Philosophy: Programmatic AI Orchestration

While AI-integrated IDEs and direct model CLIs offer remarkable capabilities, they often trade control for convenience. Context is frequently implicit, workflows are ephemeral, and the developer is relegated to reacting to the AI's output.

PAWS is engineered for a different paradigm: **the developer as the orchestrator.** It is a foundational toolkit for operators who build bespoke AI systems, providing the essential, unopinionated components to compose, direct, and reproduce an LLM's intelligence with surgical precision. The core principle is that **controlling the context is controlling the outcome.**

```mermaid
graph LR
    subgraph "Integrated IDEs (Cursor)"
        A1["Seamless In-Editor UI"]
        A2["Implicit Context (Magic)"]
    end
    subgraph "Direct CLIs (Gemini CLI)"
        B1["Raw Model Access"]
        B2["Simple File/Search Grounding"]
    end
    subgraph "PAWS Toolkit"
        C1["<b>Explicit Context Curation (CATSCAN)</b>"]
        C2["<b>Reproducible, Scriptable Workflows</b>"]
        C3["<b>Deterministic Orchestration</b>"]
    end

    classDef paws fill:#16D416,stroke:#000,color:#fff;
    classDef ide fill:#696969,stroke:#000,color:#fff;
    classDef cli fill:#565656,stroke:#000,color:#fff;
    class A1,A2 ide;
    class B1,B2 cli;
    class C1,C2,C3 paws;
```

This focus on deliberate context curation solves three fundamental challenges in AI-assisted development:

1.  **Token Efficiency & Cost:** `CATSCAN.md` files replace thousands of implementation tokens with a few hundred tokens of a precise contract, enabling larger-scale reasoning at a fraction of the cost.
2.  **Attention Focusing:** It compels the LLM to reason about a module's API surface and dependencies—the critical elements for robust changes—preventing it from getting lost in implementation details.
3.  **Reproducibility & Auditing:** The `cats.md` bundle is a deterministic artifact. The entire AI interaction can be audited, version-controlled, and re-executed reliably.

| Dimension           | AI-Integrated IDE (e.g., Cursor)                                                                              | Gemini CLI                                                                                                             | Windsurf (Agentic IDE Vision)                                                                              | PAWS (Programmatic AI Toolkit)                                                                                                                   |
| :------------------ | :------------------------------------------------------------------------------------------------------------ | :--------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------- |
| **Primary Goal**    | Augment the developer's inner loop with seamless, in-editor assistance.                                       | Provide direct, conversational access to the Gemini model from the terminal.                                           | Create a true "coding partner" AI that understands high-level intent within the IDE.                       | Provide a **composable toolkit** for developers to orchestrate their own repeatable, multi-turn AI workflows.                                    |
| **Context Control** | **Implicit & Automatic:** Context is derived from open files and the IDE's index. Powerful but can be opaque. | **File-Based & Search-Grounded:** Context is provided via file paths (`@file`) and web search (`@search`) in a prompt. | **Automatic & Holistic:** Aims to understand the entire codebase contextually to perform autonomous tasks. | **Explicit & Developer-Curated:** The developer deterministically builds the _exact_ context bundle (`cats.md`), ensuring focus.                 |
| **Workflow**        | **Conversational & Manual:** The AI is a reactive chat partner within a graphical interface.                  | **Interactive Agent or Single-Shot:** Can be used as a chat agent or for single, non-interactive command execution.    | **Autonomous Agentic Tasks:** Designed for complex, multi-step operations with less human input.           | **Scriptable & Orchestrated:** As a CLI tool, PAWS is natively designed to be scripted and chained into larger, automated, multi-turn workflows. |
| **Extensibility**   | Bound by the host IDE's plugin architecture.                                                                  | Open-source with support for custom extensions and tools via the Model Context Protocol (MCP).                         | Primarily a closed, integrated product vision (though parts may be open).                                  | **Natively Composable:** Can be combined with any script, persona, or context source, offering limitless workflow design.                        |
| **Reproducibility** | Low: UI-based conversations are difficult to reproduce exactly.                                               | Moderate: Single-shot commands are reproducible, but interactive sessions are less so.                                 | Low: Complex agentic behaviors are inherently hard to reproduce perfectly.                                 | **High:** A given `cats.md` bundle, persona, and prompt will produce a highly deterministic and repeatable result.                               |

## Core Workflow Visualization

### System Mechanics (The `cats` & `dogs` Flow)

This diagram shows the direct data flow, highlighting how `CATSCAN.md` files are central to both creating the context bundle and verifying changes.

```mermaid
graph TD
    classDef cats fill:#C71585,stroke:#000,color:#fff;
    classDef dogs fill:#228B22,stroke:#000,color:#fff;
    classDef default fill:#4F4F4F,stroke:#000,color:#fff;
    classDef llm fill:#483D8B,stroke:#000,color:#fff;
    classDef artifact fill:#008B8B,stroke:#000,color:#fff;

    subgraph "Developer's Local Machine"
        A[Source Code Files]
        I[CATSCAN.md Files]
        B(cats.py / cats.js)
        C[cats.md Bundle]
        F[dogs.md Bundle]
        G(dogs.py / dogs.js)
        H["Updated Project Files <br>(Code + CATSCANs)"]
    end

    subgraph "LLM Environment"
        D(LLM + Persona)
    end

    A -- "Feeds" --> B
    I -- "Are Prioritized By" --> B
    B -- "Produces" --> C
    C -- "Is Input To" --> D
    D -- "Produces" --> F
    F -- "Is Input To" --> G
    G -- "Applies & Verifies<br>Changes To" --> H

    class B cats;
    class G dogs;
    class C,F artifact;
    class D llm;
    class A,I,H default;
```

### Human-in-the-Loop Workflow

This diagram illustrates how a developer uses the PAWS/SWAP toolkit in a cyclical, multi-turn workflow to modify a complex codebase.

```mermaid
graph TD
    classDef human fill:#00008B,stroke:#000,color:#fff;
    classDef tool fill:#696969,stroke:#000,color:#fff;
    classDef artifact fill:#008B8B,stroke:#000,color:#fff;
    classDef llm fill:#483D8B,stroke:#000,color:#fff;
    classDef repo fill:#DAA520,stroke:#000,color:#000;
    classDef catsTool fill:#C71585,stroke:#000,color:#fff;
    classDef dogsTool fill:#228B22,stroke:#000,color:#fff;

    subgraph "Developer's Machine"
        DEV(Human Developer)
        REPO[Monolith Codebase <br/>- Source Files<br/>- CATSCAN.md]
        CATS(cats Tool)
        DOGS(dogs Tool)
    end

    subgraph "LLM Interaction"
        LLM(LLM Engine)
        PERSONA[Persona & System Prompt]
    end

    subgraph "Data Artifacts"
        CATS_MD[cats.md <br/><i>Curated Context</i>]
        DOGS_MD[dogs.md <br/><i>Proposed Changes</i>]
    end

    DEV -- "1. Selects Context" --> REPO
    REPO -- "2. Feeds Files" --> CATS
    CATS -- "3. Produces Bundle" --> CATS_MD
    CATS_MD -- "4. Sends to" --> LLM
    PERSONA -- "Guides" --> LLM
    LLM -- "5. Generates Changes" --> DOGS_MD
    DOGS_MD -- "6. Sends back to" --> DOGS
    DOGS -- "7. Applies Changes" --> REPO
    REPO -- "8. Developer Reviews" --> DEV
    DEV -- "9. Initiates Next Turn" --> CATS

    class DEV human;
    class CATS catsTool;
    class DOGS dogsTool;
    class CATS_MD,DOGS_MD artifact;
    class LLM,PERSONA llm;
    class REPO repo;
```

## Getting Started

### For Python Users

**Prerequisites**: Python 3.9+ (no external libraries required).

```bash
# Bundle the current directory into my_project.md (will prefer CATSCAN.md files)
python py/cats.py . -o my_project.md

# Extract changes from an LLM's response bundle
python py/dogs.py dogs.md . --verify-docs
```

### For JavaScript Users

**Prerequisites**: Node.js v14+.

```bash
# Install dependencies from project root
npm install

# Bundle the current directory into my_project.md
node js/cats.js . -o my_project.md

# Extract changes from an LLM's response bundle
node js/dogs.js dogs.md . --verify-docs
```

## Agentic Personas & System Protocols

PAWS includes a pre-built suite of advanced `sys_h{N}` personas and `sys_a/d/r` system protocols. This hierarchy allows you to scale the AI's cognitive complexity to match your task, a key principle in designing effective Multi-Agent Systems (MAS).

- **Personas (`personas/sys_h*.md`):** These define the AI's role and cognitive process.
  - **`sys_h1` (The Line):** A single-purpose agent for flawless execution.
  - **`sys_h2` (The Plane):** An adversarial debater for resolving trade-offs.
  - **`sys_h3` (The Cube):** A deliberation engine for critical reviews.
  - **`sys_h4` & `sys_h5` (The Tesseract & Penteract):** Hierarchical, multi-agent systems for strategic problems.
- **System Protocols (`sys/*.md`):** These define the technical interaction rules.
  - **`sys_a`:** Default interaction protocol.
  - **`sys_d`:** Delta-mode interaction protocol.
  - **`sys_r`:** Self-improvement (RSI) protocol.

## Advanced Usage

### `CATSCAN.md` Enforcement

- `cats.py --strict-catscan`: Aborts bundling if any `README.md` is found without a corresponding `CATSCAN.md`, enforcing documentation compliance.
- `dogs.py --verify-docs`: After applying changes, warns the operator if a `README.md` was modified without a corresponding change to its `CATSCAN.md`, preventing documentation drift.

### Example: Authoring a Custom Persona

The true power of PAWS lies in defining custom cognitive models. You can create your own `.md` file and pass it with `-p` to give the AI a specific role and process. See `personas/` for examples like a Continuous Coder or a Test-Driven Development writer.

## Project Structure

```
.
├── js/
│   ├── cats.js
│   ├── dogs.js
│   ├── package.json
│   └── test/
├── py/
│   ├── cats.py
│   ├── dogs.py
│   └── tests/
├── personas/
│   ├── sys_h1.md
│   └── ...
├── sys/
│   ├── sys_a.md
│   ├── sys_d.md
│   └── sys_r.md
├── cats.md
├── dogs.md
└── README.md
```

## Testing

From the project root:

- **Python:** `python -m unittest discover py/tests`
- **JavaScript:** `npm install && npm test`

## Contributing

Contributions are welcome! Please open an issue to report a bug or suggest a feature.

## License

This project is licensed under the MIT License.
