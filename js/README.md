# PAWS for Node.js: `cats.js` and `dogs.js`

This document describes the Node.js implementation of the **PAWS/SWAP** toolkit. It provides command-line utilities (`cats.js`, `dogs.js`) that are feature-complete counterparts to the Python versions, designed to bundle project files for Large Language Models (LLMs) and then safely reconstruct them.

For a high-level overview of the PAWS philosophy and project structure, please see the [main project README](../../README.md).

## Table of Contents

- [Prerequisites](#prerequisites)
- [Testing](#testing)
- [Overview](#overview)
  - [`cats.js`](#catsjs)
  - [`dogs.js`](#dogsjs)
- [Core Workflow](#core-workflow)
- [Key Features](#key-features)
- [`cats.js` - Command-Line Reference](#catsjs---command-line-reference)
- [`dogs.js` - Command-Line Reference](#dogsjs---command-line-reference)
- [Library Usage (Browser & Node.js)](#library-usage-browser--nodejs)

## Prerequisites

- **Node.js**: v14 or higher.
- **Dependencies**: The CLI tools rely on `yargs` for argument parsing and `glob` for file matching. From your project root, run:
  ```bash
  npm install
  ```

## Testing

The JavaScript implementation includes a comprehensive test suite using Mocha and Chai to ensure reliability and correctness.

1.  **Install Development Dependencies**: The main `npm install` command from the prerequisites section will install `mocha` and `chai` from the `package.json` file.

2.  **Run the Test Suite**: You can run the tests using the `npm test` script defined in `package.json`:

    ```bash
    # Recommended: Use the npm script from the project root
    npm test

    # Alternative: Direct invocation from the project root
    npx mocha js/test/test_paws.js
    ```

## Overview

### `cats.js`

Bundles specified project files and/or directories into a single text artifact. It supports powerful glob patterns for flexible, inclusive, and exclusive filtering of files.

### `dogs.js`

Extracts files from a PAWS bundle back into a directory structure. It correctly decodes text and Base64-encoded files, can apply precise delta changes, and sanitizes paths to prevent security issues.

## Core Workflow

1.  **🧶🐈 Bundle with `cats.js`**: Package your project into a `cats.md` file.

    ```bash
    # From the project root, bundle an entire project, excluding build artifacts
    node js/cats.js . -x "dist/**" -o my_project.md
    ```

2.  **🤖 Interact with an LLM**: Provide the `cats.md` bundle to your AI with a clear request. The AI generates a `dogs.md` file with the changes.

3.  **🥏🐕 Extract with `dogs.js`**: Interactively review and apply the AI's changes.
    ```bash
    # From the project root, apply changes from dogs.md
    node js/dogs.js dogs.md .
    ```

## Key Features

- **Full CLI Parity**: `cats.js` and `dogs.js` support the same command-line flags and arguments as their Python counterparts for a consistent experience.
- **Powerful File Selection**: Uses standard **glob patterns** (`src/**/*.js`), directory paths (`.`), and file paths to precisely control what gets bundled.
- **Robust Path Handling**: Invoke `cats.js` from any directory; it correctly handles relative paths (e.g., `../other-project`).
- **Layered Prompting (`cats.js`)**: Prepend persona (`-p`) and system (`-s`) prompts for AI guidance.
- **Hardened Parser (`dogs.js`)**:
  - Ignores LLM "chatter" and extraneous text.
  - Strips markdown code fences (e.g., ` ```js `).
  - Recovers from missing `END` markers.
- **Safe, Interactive Extraction (`dogs.js`)**:
  - Shows colorized diffs on overwrite (requires a compatible terminal).
  - Requires explicit confirmation for `DELETE_FILE` commands.
  - Prevents path traversal security vulnerabilities.
- **Advanced Delta Support**: A precise mode for applying line-based changes (`-d, --apply-delta`).
- **Environment-Aware**: Can be run as a CLI tool in Node.js or used as a library in both Node.js and browser environments.

## `cats.js` - Command-Line Reference

**Syntax**: `node js/cats.js [PATH_PATTERN...] [options]`

- `PATH_PATTERN...`: One or more files, directories, or glob patterns to include.
- **`-o, --output <file>`**: Output file (default: `cats.md`). Use `-` for stdout.
- **`-x, --exclude <pattern>`**: A glob pattern to exclude. Can be used multiple times.
- **`-p, --persona <file>`**: Path to a persona file to prepend.
- **`-s, --sys-prompt-file <file>`**: Path to a system prompt file to prepend.
- **`-t, --prepare-for-delta`**: Mark the bundle as a reference for delta operations.
- **`-q, --quiet`**: Suppress informational messages.
- **`-y, --yes`**: Auto-confirm writing the output file.
- **`-N, --no-default-excludes`**: Disable default excludes (`.git`, `node_modules`, etc.).
- **`-E, --force-encoding <mode>`**: `auto` (default) or `b64` (force all as Base64).
- **`-h, --help`**: Show help message.

## `dogs.js` - Command-Line Reference

**Syntax**: `node js/dogs.js [BUNDLE_FILE] [OUTPUT_DIR] [options]`

- `BUNDLE_FILE` (optional): The bundle to extract (default: `dogs.md`).
- `OUTPUT_DIR` (optional): Directory to extract files into (default: `./`).
- **`-d, --apply-delta <ref_bundle>`**: Apply delta commands using a reference bundle.
- **`-q, --quiet`**: Suppress all output and prompts. Implies `-n`.
- **`-y, --yes`**: Auto-confirm all overwrites and deletions.
- **`-n, --no`**: Auto-skip all conflicting actions.
- **`-h, --help`**: Show help message.
- **Interactive Prompts**: If not `-y` or `-n`, prompts for overwrites (`[y/N/a/s/q]`) and deletions (`[y/N]`).

## Library Usage (Browser & Node.js)

Both scripts are "environment-aware." They can be imported and used programmatically.

- **`cats.js`**: Exports a `createBundle(options)` function.
- **`dogs.js`**: Exports an `extractBundle(options)` function.

When used as a library (especially in a browser), they operate on a "virtual file system" by accepting arrays of file objects instead of reading from disk.

### `cats.js` Library Example

```javascript
// In a Node.js project or bundled for the browser
const { createBundle } = require("./js/cats.js");

async function runCatBundle() {
  const files = [
    { path: "src/index.js", content: 'console.log("hello");' },
    { path: "README.md", content: "# My Project" },
  ];

  const bundleString = await createBundle({
    virtualFS: files,
    personaContent: "You are a helpful assistant.",
  });

  console.log(bundleString);
}

runCatBundle();
```

### `dogs.js` Library Example

```javascript
// In a Node.js project or bundled for the browser
const { extractBundle } = require("./js/dogs.js");

async function runDogExtract() {
  const bundleContent = `
🐕 --- DOGS_START_FILE: src/index.js ---
console.log("hello world");
🐕 --- DOGS_END_FILE: src/index.js ---
`;

  // Returns an array of { path, contentBytes, isDelete } objects
  const extractedFiles = await extractBundle({ bundleContent });

  for (const file of extractedFiles) {
    console.log(`Path: ${file.path}`);
    console.log(`Content: ${file.contentBytes.toString("utf-8")}`);
  }
}

runDogExtract();
```
