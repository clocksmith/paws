# 🐾 PAWS: Prepare Artifacts With SWAP 🧶🐈⚽🐕

**PAWS** provides a set of transparent and powerful command-line utilities to bundle your project files for efficient interaction with Large Language Models (LLMs) and then to reconstruct them, enabling a swift code **💱 SWAP** (Streamlined Write After PAWS).

This repository contains parallel implementations in **Python** and **Node.js**, offering feature parity and a consistent workflow for developers in both ecosystems.

## The PAWS Philosophy: Programmatic AI Whole System

The landscape of AI-assisted development is defined by two powerful paradigms. The first, the **AI-Integrated IDE** (e.g., GitHub Copilot, Cursor), positions the developer as an _Augmented User_, seamlessly accelerating their inner workflow. The second, the **Programmatic AI Toolkit (PAT)**, elevates the developer to the role of an _AI Systems Architect_.

**PAWS/SWAP is a foundational toolkit for this second paradigm**. It is designed for developers who want to move beyond being users of a pre-built AI assistant and become architects of bespoke AI systems. It provides the essential components to compose, orchestrate, and direct an LLM's intelligence with precision, control, and reproducibility.

| Dimension            | AI-Integrated IDE (e.g., Cursor)                                                                                | PAWS (Programmatic AI Toolkit)                                                                                                                                                       |
| :------------------- | :-------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Locus of Control** | **Developer-in-the-Loop:** The AI suggests, but the human is always the pilot, reviewing and approving changes. | **Developer-as-Orchestrator:** The developer designs the AI's cognitive process upfront, then directs its autonomous operation.                                                      |
| **Context**          | **Implicit & Automatic:** Context is derived from open files and the IDE's index. Powerful but can be opaque.   | **Explicit & Controlled:** The developer constructs the _exact_ context bundle, ensuring focus and eliminating noise.                                                                |
| **Extensibility**    | **Bound by Plugin Architecture:** Customization is limited to what the host IDE's extension API allows.         | **Natively Composable:** As a CLI tool, PAWS can be scripted and combined with code subsets, library context, custom personas, and system prompts for limitless workflow automation. |
| **Reproducibility**  | **Low:** Conversational interactions in a UI are difficult to reproduce exactly.                                | **High:** A given bundle (`cats.md`) and persona file will produce a far more deterministic and repeatable result.                                                                   |

## The PAWS Advantage: Control and Robustness

### `cats`: Explicit Context Bundling 🧶🐈

The power of an LLM is directly proportional to the quality of its context. While AI-IDEs automatically gather context, this process is often a "black box." `cats` gives you full control.

- **Surgical Selection with Globs:** You can create a "clean room" context containing only what is necessary. For example, to refactor a feature without confusing the LLM with test files or documentation, you can be precise:
  ```bash
  # Bundle all source files, but exclude tests and legacy code
  python py/cats.py 'src/**/*.js' -x '**/__tests__/**' -x 'src/legacy/**'
  ```
- **Combine Code with External Context:** You can easily concatenate the output of `cats` with other context sources, like library documentation or API specifications, before sending it to the LLM.

### `dogs`: Robust Reconstruction ⚽🐕

LLMs are not perfect; their output can be surrounded by conversational text and formatting artifacts. `dogs` is engineered for this reality.

- **Resilient Parsing:** The `dogs` parser is designed to ignore extraneous text and find the valid file blocks. Our parser happily jumps any "fences" (like ` ``` `) the LLM might forget to close, ensuring you get your code back.
- **A Predictable Contract:** This robustness is possible because our system prompts (`sys/sys_a.md`, `sys_d.md`) establish a clear contract with the LLM on how to format its output. `dogs` is the other half of that contract.
- **Precision with Deltas:** For large files, `dogs` supports a delta mode that can apply surgical `REPLACE_LINES`, `INSERT_AFTER_LINE`, and `DELETE_LINES` commands, ensuring minimal, reviewable changes.

## Getting Started

### For Python Users

**Prerequisites**: Python 3.9+ (no external libraries required).

```bash
# Bundle the current directory into my_project.md
python py/cats.py . -o my_project.md

# Extract changes from an LLM's response bundle
python py/dogs.py dogs.md .
```

### For JavaScript Users

**Prerequisites**: Node.js v14+.

```bash
# Install dependencies from project root
npm install

# Bundle the current directory into my_project.md
node js/cats.js . -o my_project.md

# Extract changes from an LLM's response bundle
node js/dogs.js dogs.md .
```

## Advanced Usage and Architectural Control

### Example: Multi-Turn Conversation

PAWS is stateless by design. Conversation after a change is in the context window, allowing for complete control over the AI's , and multi-turn changes.

1.  **Initial Prompt:** `python py/cats.py src/ -o turn_1_prompt.md` (this is sent to the context window)
2.  **LLM Generates:** `turn_1_response.md` (this is part of the context window)
3.  **Continue with New Instructions:** Send a new change request to generate `turn_2_response.md`

### Example: Authoring a Custom Persona

The true power of PAWS lies in defining custom cognitive architectures. You can create your own `.md` file and pass it with `-p` to give the AI a specific role and process.

#### Here is a practical example of a **`Continuous Coder for Large Tasks`** persona:

```markdown

# Persona: Continuous Code Streamer

> You are **`Stream-1`**, a non-conversational code generation engine. Your sole function is to output the contents of a complete `dogs` bundle based on the user's request.

**Directives:**

1.  **Generate Only:** Your entire response must be the code bundle. Do not add explanations. Start immediately with the first file marker.

2.  **Continue on Command:** If your output is interrupted and the user provides the single command `continue`, you must resume generation from the exact point you were cut off.

3.  **Terminate on New Input:** Any input other than `continue` is a new task. Terminate the previous stream and begin a new one.

**Example:**

**User:** `Create a file.`
**Stream-1:** `🐕 --- DOGS_START_FILE: file.txt ---`
`Hello Wor` **-- INTERRUPTED --**
**User:** `continue`
**Stream-1:** `ld.`
`🐕 --- DOGS_END_FILE: file.txt ---`
```
**To use this:** `python py/cats.py src/ -p path/to/ccs_persona.md` or use built in `python py/cats.py src/ -p personas/sys_c.md`

#### Here is a practical example of a **`Test-Driven Development Writer`** persona:

```markdown
# Persona: Test-Driven Development Writer

You are an expert Test-Driven Development (TDD) engineer. Your process is strict and non-negotiable. For any given feature request, you will follow this three-step protocol in your response:

1.  **Write the Failing Test:** First, create a new test file or modify an existing one to include a concise, clear test case that captures the feature's requirements. This test MUST fail when run against the existing code.
2.  **Write the Minimal Implementation:** Second, write the simplest, cleanest possible code in the application files required to make the failing test pass. Do not add any extra features or gold-plating.
3.  **Refactor (If Necessary):** Third, if the minimal implementation introduced any code duplication or sloppiness, provide a `REPLACE_LINES` delta command to refactor the newly-added code for clarity and efficiency.
```

**To use this:** `python py/cats.py src/ -p path/to/tdd_persona.md`

## The `sys_h{N}` Architectures: From Agent to Architect

Building on this principle, PAWS includes a pre-built suite of advanced `sys_h{N}` personas. This hierarchy allows you to scale the AI's cognitive complexity to match your task, a key principle in designing effective Multi-Agent Systems (MAS) [3].

- **`sys_h1` (The Line):** A single-purpose agent for flawless execution of a clear specification.

  - **Use for:** Writing boilerplate code, translating a file.
  - **Why it works:** Mirrors a specialized, single-function agent, ideal for deterministic tasks where creativity is not required.

- **`sys_h2` (The Plane):** An adversarial debater for resolving binary trade-offs (e.g., speed vs. quality).

  - **Use for:** Deciding between a quick fix and a robust solution.
  - **Why it works:** Simulates a two-agent system designed to find a robust equilibrium between competing objectives.

- **`sys_h3` (The Cube):** A deliberation engine for critical reviews and judgment.

  - **Use for:** Performing a critical code review or analyzing a refactoring proposal.
  - **Why it works:** Models a supervised workflow (Examine -> Arbitrate -> Articulate), similar to the Process Supervision patterns that improve agent reliability [4].

- **`sys_h4` & `sys_h5` (The Tesseract & Penteract):** Hierarchical, multi-agent systems for the most ambiguous and strategic problems.
  - **Use for:** Designing a new software framework or formulating a technology strategy.
  - **Why it works:** These are composed systems of specialized agents, similar to the architecture of Microsoft's AutoGen, designed to tackle complex problems that require diverse, collaborative intelligence.

## Project Structure

```
.
├── js/                  <-- Node.js implementation
├── py/                  <-- Python implementation
├── personas/
│   ├── sys_h1.md - sys_h5.md
└── sys/
    ├── sys_a.md         <-- Shared: Default system prompt
    ├── sys_d.md         <-- Shared: Delta mode system prompt
    └── sys_r.md         <-- Shared: RSI (self-modification) prompt
```

## Testing

From the project root:

- **Python:** `python -m unittest discover py/tests`
- **JavaScript:** `npm install && npm test`

## Contributing

Contributions are welcome! Please open an issue to report a bug or suggest a feature.

## License

This project is licensed under the ISC License.

## References

[1] Vibe Coding: Copilot vs Cursor AI. (2025). Techpoint.africa.
[2] GitHub Blog: Copilot ask, edit, and agent modes. (2025).
[3] Prompting Guide: LLM Agents. (2025).
[4] arXiv: CodeTool: Enhancing Programmatic Tool Invocation of LLMs via Process Supervision. (2025).
