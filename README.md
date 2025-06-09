# 🐾 PAWS: Prepare Artifacts With SWAP

**PAWS** provides a set of transparent and powerful command-line utilities to bundle your project files for efficient interaction with Large Language Models (LLMs) and then to reconstruct them, enabling a swift code **💱 SWAP** (Streamlined Write After PAWS).

This repository contains parallel implementations in **Python** and **Node.js**, offering feature parity and a consistent workflow for developers in both ecosystems.

## Table of Contents

- [Why PAWS? The Missing Link for Large Context LLMs](#why-paws-the-missing-link-for-large-context-llms)
- [Key Features](#key-features)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [For Python Users](#for-python-users)
  - [For JavaScript Users](#for-javascript-users)
- [Testing](#testing)
  - [Running Python Tests](#running-python-tests)
  - [Running JavaScript Tests](#running-javascript-tests)
- [Contributing](#contributing)
- [License](#license)

## Why PAWS? The Missing Link for Large Context LLMs

State-of-the-art LLMs now have massive context windows, making it possible to feed an entire codebase into a single prompt for project-wide refactoring or feature implementation. However, a large context window alone is not enough. The raw "copy-paste" workflow is inefficient, error-prone, and lacks critical safety features. **PAWS provides the essential scaffolding to bridge this gap.**

1.  **Intelligent Bundling (`cats`)**: You can't just `cat *.*`. A real project has build artifacts, local configurations, and test files you want to exclude. The `cats` utilities use powerful globbing and default-deny patterns to create a clean, minimal, and contextually-rich bundle that respects your project's structure.
2.  **Instruction & Persona Scaffolding**: An LLM needs precise instructions. PAWS allows you to programmatically prepend system prompts and task-specific "personas," ensuring the AI has the guidance it needs to perform the task correctly _before_ it sees the first line of code.
3.  **Robust, Fault-Tolerant Parsing (`dogs`)**: LLMs are not perfect. They add conversational filler, forget to close markdown code fences, and sometimes produce malformed output. The `dogs` utilities are specifically hardened to handle this noise, surgically extracting valid code blocks while ignoring extraneous text.
4.  **Human-in-the-Loop Safety (`dogs`)**: Letting an AI directly overwrite your entire project is reckless. `dogs` provides a critical safety layer with interactive modes, colorized diffs, and explicit confirmations for all overwrites and deletions. You always have the final say.

PAWS turns the potential of large context windows into a practical, safe, and powerful development reality.

## Key Features

- **Full CLI Parity**: The Python and JavaScript versions support the same command-line flags and arguments for a consistent experience.
- **Powerful File Selection**: Uses standard **glob patterns** (e.g., `src/**/*.js`), directory paths, and file paths to precisely control what gets bundled.
- **Advanced Delta Support**: A precise mode for applying line-based changes, ideal for large files and formal code reviews.
- **Hardened Parser**: Ignores LLM "chatter" and artifacts, and gracefully recovers from common formatting errors like missing file markers.
- **Safe, Interactive Extraction**: Provides colorized diffs and confirmation prompts for all file modifications and deletions.
- **Environment-Aware JS**: The JavaScript version works as both a CLI tool in Node.js and as a library in the browser.

## Project Structure

The project is organized into language-specific directories, with shared system prompts at the root.

```
.
├── js/                  <-- Node.js implementation
│   ├── cats.js
│   ├── dogs.js
│   ├── package.json
│   ├── README.md        <-- JS-specific documentation
│   └── test/
│       └── test_paws.js
├── py/                  <-- Python implementation
│   ├── cats.py
│   ├── dogs.py
│   ├── README.md        <-- Python-specific documentation
│   └── tests/
│       └── test_paws.py
├── README.md
├── sys_a.md             <-- Shared: Default system prompt
├── sys_d.md             <-- Shared: Delta mode system prompt
└── sys_r.md             <-- Shared: RSI (self-modification) prompt
```

## Getting Started

### For Python Users

**Prerequisites**: Python 3.9+ (no external libraries required).

**Usage**:

```bash
# Bundle the current directory into my_project.md
python py/cats.py . -o my_project.md

# Extract changes from dogs.md into the current directory
python py/dogs.py dogs.md .
```

For more detailed examples, see the [Python README](./py/README.md).

### For JavaScript Users

**Prerequisites**: Node.js v14+.

**Installation**:

```bash
# Install required dependencies
npm install
```

**Usage**:

```bash
# Bundle the current directory into my_project.md
node js/cats.js . -o my_project.md

# Extract changes from dogs.md into the current directory
node js/dogs.js dogs.md .
```

For more detailed examples, see the [JavaScript README](./js/README.md).

## Testing

Both implementations come with their own comprehensive test suites.

### Running Python Tests

The Python tests use the built-in `unittest` module.

1.  Navigate to the project root directory.
2.  Run the test discovery command:
    ```bash
    python -m unittest discover py/tests
    ```

### Running JavaScript Tests

The JavaScript tests use the Mocha and Chai testing frameworks.

1.  Ensure you have installed the development dependencies:
    ```bash
    # This will install mocha and chai from package.json
    npm install
    ```
2.  Run the `test` script defined in `package.json`:
    ```bash
    npm test
    ```
    _(This is a shortcut for `npx mocha js/test/test_paws.js`)_

## Contributing

Contributions are welcome! Please feel free to open an issue to report a bug or suggest a feature, or submit a pull request with your improvements.

## License

This project is licensed under the ISC License.
