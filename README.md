🐕 --- DOGS_START_FILE: README.md ---

# 🐾 PAWS: Prepare Artifacts With SWAP (Streamlined Write After PAWS)

**PAWS** provides transparent and powerful command-line utilities (`cats.py` and `dogs.py`) to bundle your project files for efficient interaction with Large Language Models (LLMs) and then to reconstruct them, enabling a swift code **💱 SWAP** (Streamlined Write After PAWS).

This two-part toolkit is designed for professional development workflows. It is **verbose by default** for clarity, supports powerful **glob patterns** for flexible file selection, and features a **safe, interactive process** for applying changes, including colorized diffs and explicit confirmations for destructive operations.

(Node.js versions, `cats.js` and `dogs.js`, offering similar core functionality are available in the `js/` subdirectory; see `js/README.md` for details.)

## Table of Contents

- [Why PAWS? The Missing Link for Large Context LLMs](#why-paws-the-missing-link-for-large-context-llms)
- [Overview](#overview)
  - [`cats.py` - The Bundler](#catspy---the-bundler)
  - [`dogs.py` - The Unpacker](#dogspy---the-unpacker)
- [Core Workflow](#core-workflow)
- [Key Features](#key-features)
- [`cats.py` - Command-Line Reference](#catspy---command-line-reference)
- [`dogs.py` - Command-Line Reference](#dogspy---command-line-reference)
- [Advanced Workflows](#advanced-workflows)

## Why PAWS? The Missing Link for Large Context LLMs

State-of-the-art LLMs now have massive context windows (100k to 1M+ tokens), making it possible to feed an entire codebase into a single prompt. This is a paradigm shift for AI-assisted development, enabling tasks like:

- Project-wide refactoring.
- Adding a new feature that touches multiple files.
- Generating comprehensive documentation based on source code.
- Identifying and fixing complex, cross-cutting bugs.

However, a large context window alone is not enough. The raw "copy-paste" workflow is inefficient, error-prone, and lacks critical safety features. **PAWS provides the essential scaffolding to bridge this gap.**

1.  **Intelligent Bundling (`cats.py`)**: You can't just `cat *.*`. A real project has build artifacts, local configurations, and test files you want to exclude. `cats.py` uses powerful globbing and default-deny patterns to create a clean, minimal, and contextually-rich bundle that respects your project's structure.
2.  **Instruction & Persona Scaffolding**: An LLM needs precise instructions. PAWS allows you to programmatically prepend system prompts and task-specific "personas," ensuring the AI has the guidance it needs to perform the task correctly _before_ it sees the first line of code.
3.  **Robust, Fault-Tolerant Parsing (`dogs.py`)**: LLMs are not perfect. They add conversational filler, forget to close markdown code fences, and sometimes produce malformed output. `dogs.py` is specifically hardened to handle this noise. It surgically extracts only the valid code blocks, ignoring extraneous text and recovering from common formatting errors, ensuring that what gets written to your disk is clean.
4.  **Human-in-the-Loop Safety (`dogs.py`)**: Letting an AI directly overwrite your entire project is reckless. `dogs.py` provides a critical safety layer. Its interactive mode shows you a colorized `diff` of every proposed change and requires explicit confirmation for all overwrites and deletions. You always have the final say.

PAWS turns the potential of large context windows into a practical, safe, and powerful development reality.

## Overview

### `cats.py` - The Bundler

`cats.py` creates a single, LLM-readable text artifact (`cats.md`) from your source code. It is **verbose by default**, showing you exactly which files are being collected. It intelligently handles file inclusion/exclusion with **glob patterns**, manages binary files, and can prepend layered instructions for the AI.

### `dogs.py` - The Unpacker

`dogs.py` is the counterpart that unpacks the AI's response bundle (`dogs.md`). It is also **verbose by default** and is built for safety and robustness. It provides a **colorized diff** of changes before overwriting files and requires explicit, interactive confirmation for destructive operations. Its parser is specifically designed to ignore LLM chatter and recover from common formatting mistakes.

## Core Workflow

1.  **🧶🐈 Bundle with `cats.py`**: Package your project into a `cats.md` file.

    ```bash
    # Bundle an entire project directory, excluding build artifacts and .log files
    python cats.py . -x 'build/' -x '*.log' -o my_project.md
    ```

2.  **🤖 Interact with an LLM**: Provide the `cats.md` bundle to your AI, along with your request. The AI will generate a `dogs.md` file containing the modifications.

3.  **🥏🐕 Extract with `dogs.py`**: Interactively review and apply the AI's changes to your project.
    ```bash
    # dogs.py will now guide you through the changes from the dogs.md file.
    python dogs.py
    ```

## Key Features

- **Verbose by Default**: Both tools provide clear, real-time feedback. Use `--quiet` (`-q`) for silent operation.
- **Powerful File Selection**: Use familiar **glob patterns** (`src/**/*.js`), directory paths (`.`), and file paths to precisely control what gets bundled.
- **Robust Path Handling**: Invoke `cats.py` from any directory; it correctly handles relative paths (e.g., `../other-project`) and determines the correct common ancestor for bundled files.
- **Layered Prompting (`cats.py`)**:
  1.  **Persona Injection (`-p`)**: Prepend a task-specific persona file for the AI.
  2.  **System Prompt (`-s`)**: Automatically prepend a general instruction file (`sys_a.md`, `sys_d.md`, etc.).
- **Hardened, Fault-Tolerant Parsing (`dogs.py`)**:
  - **Ignores LLM Chatter**: Safely ignores conversational text before, between, or after valid file blocks.
  - **Strips Artifacts**: Automatically removes markdown code fences (e.g., ` ```python `) and extraneous whitespace from code blocks.
  - **Recovers from Errors**: Correctly processes files even if the LLM forgets the `DOGS_END_FILE` marker.
- **Safe, Interactive Extraction (`dogs.py`)**:
  - **Diff on Overwrite**: Shows a colorized `diff` of all changes and asks for confirmation.
  - **Explicit Deletion**: Requires confirmation for the `DELETE_FILE` command.
  - **No Silent Failures**: Provides clear warnings and errors for issues like path traversal attempts or decoding failures.
- **Advanced Delta Support**: A precise mode for applying line-based changes, ideal for large files and formal code reviews.

---

## `cats.py` - Command-Line Reference

### Syntax

`python cats.py [PATH_PATTERN...] [options]`

### Key Options

- `PATH_PATTERN...`: One or more files, directories, or glob patterns to include (e.g., `'src/**/*.py'`, `.` , `../project`).
- `-o, --output <file>`: Output file (default: `cats.md`). Use `-` for stdout.
- `-x, --exclude <pattern>`: A glob pattern to exclude files. Can be used multiple times.
- `-p, --persona <file>`: Prepend a specific persona/instruction file.
- `-s, --sys-prompt-file <file>`: Specify the system prompt file to use (default: `sys_a.md`).
- `-t, --prepare-for-delta`: Mark the bundle as a clean reference for delta operations.
- `-q, --quiet`: Suppress informational messages.
- `-y, --yes`: Auto-confirm writing the output file.
- `-N, --no-default-excludes`: Disables default excludes (`.git`, `node_modules`, etc.).
- `-E, --force-encoding <mode>`: Force encoding (`auto`, `b64`).

### Extensive `cats.py` Examples

**Example 1: Bundle an Entire Project**

```bash
python cats.py . -x 'dist/' -x '*.log' -o web_project.md
```

**Example 2: Bundle with a Custom Persona**

```bash
# Create doc_writer.md with instructions: "You are a technical writer..."
python cats.py 'api/**/*.py' -p doc_writer.md -o for_doc_writing.md
```

**Example 3: Create a Delta-Ready Reference**

```bash
python cats.py . -t -o project_v1_reference.md
```

**Example 4: Quietly Pipe to Clipboard**
(Requires a clipboard utility like `pbcopy` on macOS or `xclip` on Linux).

```bash
python cats.py 'src/main.py' 'src/utils.py' -q -o - | pbcopy
```

---

## `dogs.py` - Command-Line Reference

### Syntax

`python dogs.py [BUNDLE_FILE] [OUTPUT_DIR] [options]`

### Key Options

- `BUNDLE_FILE` (optional): The bundle to extract (default: `dogs.md`). Use `-` for stdin.
- `OUTPUT_DIR` (optional): Directory to extract files into (default: `./`).
- `-d, --apply-delta <original_bundle>`: **Crucial for deltas.** Applies delta commands using the original bundle as a reference.
- `-q, --quiet`: Suppress all output and prompts. Implies `-n`.
- `-y, --yes`: **[Yes-All]** Auto-confirm all prompts (overwrite/delete).
- `-n, --no`: **[No-All]** Auto-skip all conflicting actions.

### Interactive Prompts (Default Behavior)

`dogs.py` prioritizes safety. When run without `-y`, `-n`, or `-q`, it is fully interactive:

- **On Overwrite**: Shows a colorized `diff` and asks `Overwrite? [y/N/a(yes-all)/s(skip-all)/q(quit)]`.
- **On Delete**: Shows a high-stakes warning and asks `Permanently delete this file? [y/N/q(quit)]`.

### Extensive `dogs.py` Examples

**Example 1: Default Interactive Extraction**

```bash
# Processes dogs.md in the current directory
python dogs.py
```

**Example 2: Applying Deltas**

```bash
python dogs.py llm_output.md . -d project_v1_reference.md
```

**Example 3: Automated Extraction in CI/CD**

```bash
# Apply all changes from a trusted bundle without interaction
python dogs.py ci_bundle.md ./build -y
```

**Example 4: Extracting from a Pipe**

```bash
# Generate response and apply it in one command
my-llm-tool "Refactor this code" project.md | python dogs.py -
```

---

## Advanced Workflows

### The Delta Workflow: A Step-by-Step Guide

This is the most precise way to work with an LLM, ideal for refactoring large files.

1.  **Create Reference (`-t`)**: First, create the "before" snapshot.
    ```bash
    python cats.py . -t -o original_code.md
    ```
2.  **Instruct LLM (`-s sys_d.md`)**: Next, create the bundle for the LLM, instructing it to generate deltas.
    ```bash
    python cats.py . -s sys_d.md -o for_llm_delta_task.md
    ```
3.  **Apply Deltas (`-d`)**: Finally, use `dogs.py` to apply the LLM's patch using your original reference.
    ```bash
    python dogs.py llm_output.md . -d original_code.md
    ```

### Recursive Self-Modification (RSI)

This is the process of using PAWS to modify its own source code. It requires maximum precision and uses the specialized `sys_r.md` prompt (`-s sys_r.md`), which mandates a cautious, delta-first approach.
