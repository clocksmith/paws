# 🐾 PAWS: Prepare Artifacts With SWAP (Streamlined Write After PAWS)

**PAWS** provides transparent and powerful command-line utilities (`cats.py` and `dogs.py`) to bundle your project files for efficient interaction with Large Language Models (LLMs) and then to reconstruct them, enabling a swift code **💱 SWAP** (Streamlined Write After PAWS).

This two-part toolkit is designed for professional development workflows. It is **verbose by default** for clarity, supports **glob patterns** for flexible file selection, and features a **safe, interactive process** for applying changes, including colorized diffs and explicit confirmations for destructive operations.

(Node.js versions, `cats.js` and `dogs.js`, offering similar core functionality are available in the `js/` subdirectory; see `js/README.md` for details.)

## Table of Contents

- [Overview](#overview)
  - [`cats.py` - The Bundler](#catspy---the-bundler)
  - [`dogs.py` - The Unpacker](#dogspy---the-unpacker)
- [Core Workflow](#core-workflow)
- [Key Features](#key-features)
- [`cats.py` - Command-Line Reference](#catspy---command-line-reference)
  - [Syntax](#syntax)
  - [Key Options](#key-options)
  - [Extensive `cats.py` Examples](#extensive-catspy-examples)
- [`dogs.py` - Command-Line Reference](#dogspy---command-line-reference)
  - [Syntax](#syntax-1)
  - [Key Options](#key-options-1)
  - [Interactive Prompts (Default Behavior)](#interactive-prompts-default-behavior)
  - [Extensive `dogs.py` Examples](#extensive-dogspy-examples)
- [Advanced Workflows](#advanced-workflows)
  - [The Delta Workflow: A Step-by-Step Guide](#the-delta-workflow-a-step-by-step-guide)
  - [Persona Injection for Custom Instructions](#persona-injection-for-custom-instructions)
  - [Recursive Self-Modification (RSI)](#recursive-self-modification-rsi)

## Overview

### `cats.py` - The Bundler

`cats.py` creates a single, LLM-readable text artifact (`cats.md`) from your source code. It is **verbose by default**, showing you exactly which files are being collected. It intelligently handles file inclusion/exclusion with **glob patterns**, manages different content types, and can prepend layered instructions for the AI.

### `dogs.py` - The Unpacker

`dogs.py` is the counterpart that unpacks the AI's response bundle (`dogs.md`). It is also **verbose by default** and is built for safety. It provides a **colorized diff** of changes before overwriting files and requires explicit, interactive confirmation for destructive operations like file overwrites and deletions, ensuring a human-in-the-loop process.

## Core Workflow

1.  **🧶🐈 Bundle with `cats.py`**: Package your project into a `cats.md` file. The tool will print its progress.

    ```bash
    # Bundle all .py files in the src directory, excluding tests
    python cats.py 'src/**/*.py' -x 'src/**/test_*.py' -o my_project.md
    ```

2.  **🤖 Interact with an LLM**: Provide the `cats.md` bundle to your AI, along with your request. The AI will generate a `dogs.md` file containing the modifications.

3.  **🥏🐕 Extract with `dogs.py`**: Apply the AI's changes to your project. `dogs.py` will be verbose, show diffs, and prompt you before changing files.
    ```bash
    # dogs.py will now interactively guide you through the changes.
    python dogs.py dogs.md .
    ```

## Key Features

- **Verbose by Default**: Both tools provide clear, real-time feedback on the files they are processing. Use the `--quiet` (`-q`) flag on either script for silent operation.
- **Glob Pattern Support (`cats.py`)**: Use familiar glob patterns like `src/**/*.js` for including files and `-x 'test/**'` for excluding them.
- **Layered Prompting (`cats.py`)**:
  1.  **Persona Injection (`-p`)**: Prepend a task-specific persona or instruction file for the AI.
  2.  **System Prompt (`-s`)**: Automatically prepends a general guide (`sys_a.md`, `sys_d.md`, etc.).
  3.  **CWD Context File**: Bundles a context file from the current directory as the first file _inside_ the bundle.
- **Safe, Interactive Extraction (`dogs.py`)**:
  - **Diff on Overwrite**: Shows a colorized diff of changes before asking for confirmation to overwrite a file.
  - **Explicit Deletion**: Requires confirmation for the `DELETE_FILE` command, preventing accidental data loss.
- **Intelligent Delta Support**: An advanced mode for applying precise, line-based changes, ideal for large files and formal code reviews.
- **Symmetrical Markers**: Uses robust, symmetrical start and end file markers for reliable parsing by both humans and machines.

---

## `cats.py` - Command-Line Reference

### Syntax

`python cats.py [PATH_PATTERN...] [options]`

### Key Options

- `PATH_PATTERN...`: One or more glob patterns or file paths to include (e.g., `'src/**/*.py'`, `README.md`).
- `-o, --output <file>`: Output bundle file (default: `cats.md`).
- `-x, --exclude <pattern>`: A glob pattern to exclude files. Can be used multiple times.
- `-p, --persona <file>`: Prepend a specific persona/instruction file to the entire output.
- `-s, --sys-prompt-file <file>`: Specify the system prompt file to use (default: `sys_a.md`).
- `-t, --prepare-for-delta`: Mark the bundle as a clean reference for future delta operations.
- `-q, --quiet`: Suppress informational messages.
- `-y, --yes`: Auto-confirm writing the output file without a prompt.
- `-N, --no-default-excludes`: Disables default excludes (`.git`, `node_modules`, etc.).

### Extensive `cats.py` Examples

**Example 1: Basic Bundling of a Web Project**
Bundle all JavaScript, CSS, and HTML files, while excluding the `node_modules` directory (handled by default) and any `.log` files.

```bash
python cats.py 'src/**/*.js' 'styles/**/*.css' 'public/**/*.html' -x '*.log' -o web_project.md
```

````

_`cats.py` will print a list of every file it finds and adds to `web_project.md`._

**Example 2: Bundling with a Custom Persona for a Specific Task**
Prepare a bundle for an AI task to add documentation, using a custom persona.

```bash
# Create a persona file named 'doc_writer.md' with content like:
# "You are a technical writer. Your task is to add Python docstrings..."

python cats.py 'api/**/*.py' -p doc_writer.md -o for_doc_writing.md
```

_The contents of `doc_writer.md` will be placed at the very top of the final bundle._

**Example 3: Creating a Delta-Ready Reference Bundle**
Create a clean, pristine snapshot of a project, marking it as the "v1" reference for a future delta-based update.

```bash
# The -t flag is the key here.
python cats.py . -x 'dist/' -x 'venv/' -t -o project_v1_reference.md
```

_This `project_v1_reference.md` is now the canonical "before" state for `dogs.py`._

**Example 4: Quietly Piping to Clipboard**
Quickly grab a few files and pipe them to your clipboard without creating a file and with no console output. (Requires a clipboard utility like `pbcopy` on macOS or `xclip` on Linux).

```bash
python cats.py 'src/main.py' 'src/utils.py' -q -o - | pbcopy
```

---

## `dogs.py` - Command-Line Reference

### Syntax

`python dogs.py [BUNDLE_FILE] [OUTPUT_DIR] [options]`

- `BUNDLE_FILE` (optional): The bundle to extract (default: `dogs.md`).
- `OUTPUT_DIR` (optional): Directory to extract files into (default: `./`).

### Key Options

- `-d, --apply-delta <original_bundle>`: **Crucial for deltas.** Applies delta commands using the original bundle as a reference.
- `-i, --input-format <mode>`: Override bundle's format detection (`auto`, `b64`, `utf8`).
- `-q, --quiet`: Suppress informational messages, diffs, and all interactive prompts. Implies `-n`.
- `-y, --yes`: **[Yes-All]** Automatically answer "yes" to all prompts (overwrite and delete).
- `-n, --no`: **[No-All]** Automatically answer "no" to all prompts, skipping all conflicts.

### Interactive Prompts (Default Behavior)

`dogs.py` prioritizes safety. When run without `-y`, `-n`, or `-q`, it is fully interactive:

- **On Overwrite**: It shows a colorized `diff` of the proposed changes and asks `Overwrite? [y/N/a(yes-all)/s(skip-all)/q(quit)]`.
- **On Delete**: It shows a high-stakes warning: `Request to DELETE file: ...` and asks `Permanently delete this file? [y/N/q(quit)]`.

### Extensive `dogs.py` Examples

**Example 1: Default Interactive Extraction**
The most common and safest use case. You have received `dogs.md` from an AI and want to review its changes before applying them.

```bash
python dogs.py
```

_`dogs.py` will process `dogs.md`, find `main.py` has changed, show you a `diff`, and ask if you want to overwrite it._

**Example 2: Applying Deltas and Handling a Deletion Request**
You used the delta workflow and the AI is requesting a refactor and a file deletion.

```bash
# Use the -d flag with the reference bundle you created earlier.
python dogs.py llm_output.md . -d project_v1_reference.md
```

_`dogs.py` will apply the line changes to any files with deltas. If it encounters a `DELETE_FILE` command for `old_util.py`, it will stop and ask for explicit confirmation before deleting it._

**Example 3: Automated Extraction in a CI/CD Pipeline**
You trust the source of the bundle and want to apply all changes automatically without any interaction.

```bash
# The -y flag auto-confirms all overwrites and deletions.
python dogs.py ci_bundle.md ./build -y
```

**Example 4: Quietly Extracting Only New Files**
You want to extract a bundle but are only interested in files that don't already exist in your project, skipping all conflicts silently.

```bash
# The -q flag implies "no" to all prompts and suppresses all output.
python dogs.py feature_bundle.md . -q
```

---

## Advanced Workflows

### The Delta Workflow: A Step-by-Step Guide

This is the most precise way to work with an LLM, ideal for refactoring large files.

1.  **Create Reference (`-t`)**: First, create the "before" snapshot. The system prompt is not important for this step.

    ```bash
    python cats.py . -t -o original_code.md
    ```

2.  **Instruct LLM (`-s sys_d.md`)**: Next, create the bundle to send to the LLM, instructing it to generate deltas.

    ```bash
    python cats.py . -s sys_d.md -o for_llm_delta_task.md
    ```

    _You send `for_llm_delta_task.md` to the AI, which now knows to use `@@ PAWS_CMD ... @@` syntax._

3.  **Apply Deltas (`-d`)**: Finally, use `dogs.py` to apply the LLM's patch (`llm_output.md`) using your original reference from Step 1.
    ```bash
    python dogs.py llm_output.md . -d original_code.md
    ```

### Persona Injection for Custom Instructions

1.  Create `my_persona.md` with instructions like: _"You are a Go developer specializing in concurrency..."_
2.  Bundle with the persona to guide the LLM's task: `python cats.py 'src/**/*.go' -p my_persona.md`

### Recursive Self-Modification (RSI)

This is the process of using PAWS to modify its own source code. It requires maximum precision and uses the specialized `sys_r.md` prompt (`-s sys_r.md`), which mandates a cautious, delta-first approach.
````
