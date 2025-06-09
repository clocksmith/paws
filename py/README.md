# 🐾 PAWS for Python: `cats.py` and `dogs.py`

This document describes the Python implementation of the **PAWS/SWAP** toolkit. It provides command-line utilities (`cats.py`, `dogs.py`) to bundle your project files for efficient interaction with Large Language Models (LLMs) and then to safely reconstruct them from the model's output.

For a high-level overview of the PAWS philosophy and project structure, please see the [main project README](../../README.md).

## Table of Contents

- [Prerequisites](#prerequisites)
- [Overview](#overview)
  - [`cats.py` - The Bundler](#catspy---the-bundler)
  - [`dogs.py` - The Unpacker](#dogspy---the-unpacker)
- [Core Workflow](#core-workflow)
- [`cats.py` - Command-Line Reference](#catspy---command-line-reference)
- [`dogs.py` - Command-Line Reference](#dogspy---command-line-reference)
- [Advanced Workflows](#advanced-workflows)
- [Testing the Python Scripts](#testing-the-python-scripts)

## Prerequisites

- Python 3.9+
- No external libraries are required.

## Overview

### `cats.py` - The Bundler

`cats.py` creates a single, LLM-readable text artifact (`cats.md`) from your source code. It is **verbose by default**, showing you exactly which files are being collected. It intelligently handles file inclusion/exclusion with **glob patterns**, manages binary files, and can prepend layered instructions for the AI.

### `dogs.py` - The Unpacker

`dogs.py` is the counterpart that unpacks the AI's response bundle (`dogs.md`). It is also **verbose by default** and is built for safety and robustness. It provides a **colorized diff** of changes before overwriting files and requires explicit, interactive confirmation for destructive operations. Its parser is specifically designed to ignore LLM chatter and recover from common formatting mistakes.

## Core Workflow

1.  **🧶🐈 Bundle with `cats.py`**: From the project root, package your project into a `cats.md` file.

    ```bash
    # Bundle an entire project directory, excluding build artifacts
    python py/cats.py . -x 'build/' -x '*.log' -o my_project.md
    ```

2.  **🤖 Interact with an LLM**: Provide the `cats.md` bundle to your AI, along with your request. The AI will generate a `dogs.md` file containing the modifications.

3.  **🥏🐕 Extract with `dogs.py`**: Interactively review and apply the AI's changes to your project.
    ```bash
    # From the project root, apply changes from dogs.md
    python py/dogs.py dogs.md .
    ```

## `cats.py` - Command-Line Reference

**Syntax**: `python py/cats.py [PATH_PATTERN...] [options]`

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
- `-h, --help`: Show the help message.

---

## `dogs.py` - Command-Line Reference

**Syntax**: `python py/dogs.py [BUNDLE_FILE] [OUTPUT_DIR] [options]`

- `BUNDLE_FILE` (optional): The bundle to extract (default: `dogs.md`). Use `-` for stdin.
- `OUTPUT_DIR` (optional): Directory to extract files into (default: `./`).
- `-d, --apply-delta <original_bundle>`: **Crucial for deltas.** Applies delta commands using the original bundle as a reference.
- `-q, --quiet`: Suppress all output and prompts. Implies `-n`.
- `-y, --yes`: **[Yes-All]** Auto-confirm all prompts (overwrite/delete).
- `-n, --no`: **[No-All]** Auto-skip all conflicting actions.
- `-h, --help`: Show the help message.

---

## Advanced Workflows

### The Delta Workflow: A Step-by-Step Guide

This is the most precise way to work with an LLM, ideal for refactoring large files.

1.  **Create Reference (`-t`)**: First, create the "before" snapshot.
    ```bash
    python py/cats.py . -t -o original_code.md
    ```
2.  **Instruct LLM (`-s sys_d.md`)**: Next, create the bundle for the LLM, instructing it to generate deltas.
    ```bash
    python py/cats.py . -s ../sys_d.md -o for_llm_delta_task.md
    ```
3.  **Apply Deltas (`-d`)**: Finally, use `dogs.py` to apply the LLM's patch using your original reference.
    ```bash
    python py/dogs.py llm_output.md . -d original_code.md
    ```

### Recursive Self-Modification (RSI)

This is the process of using PAWS to modify its own source code. It requires maximum precision and uses the specialized `sys_r.md` prompt (`-s ../sys_r.md`), which mandates a cautious, delta-first approach.

---

## Testing the Python Scripts

The test suite is the primary mechanism for ensuring the reliability and safety of the Python scripts.

### How to Run Tests

#### Running the Full Suite (Recommended)

The most reliable way to run the entire test suite is to use `unittest`'s **discovery feature** from the **project's root directory**.

```bash
# From the project root:
python -m unittest discover py/tests
```

- `python -m unittest`: Invokes the `unittest` module as a script, correctly configuring the path.
- `discover`: Tells `unittest` to search for tests.
- `py/tests`: Specifies the directory where the Python tests reside.

#### Running Specific Tests

When developing or debugging, you can run a subset of tests by targeting specific files, classes, or methods.

- **Run a single test file:**
  ```bash
  python -m unittest py.tests.test_paws
  ```
- **Run a single test class:**
  ```bash
  python -m unittest py.tests.test_paws.TestDogsPy
  ```
- **Run a single test method:**
  ```bash
  python -m unittest py.tests.test_paws.TestDogsPy.test_parser_handles_unterminated_blocks
  ```

### Understanding the Test Structure

The suite resides in `py/tests/test_paws.py` and is broken down into `TestCatsPy`, `TestDogsPy`, and `TestFullWorkflow` classes to verify all features, edge cases, and safety mechanisms.
