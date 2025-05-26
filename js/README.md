# PAWS for Node.js: `cats.js` and `dogs.js`

**PAWS** provides simple, dependency-free command-line utilities (`cats.js` and `dogs.js`) to bundle your project files for efficient interaction with Large Language Models (LLMs) and then to reconstruct them, enabling a swift code **💱 SWAP** (Streamlined Write After PAWS).

This two-part toolkit streamlines the process of getting your codebase into and out of an LLM, making project-wide analysis, refactoring, and content generation more intuitive.

(Python versions, `cats.py` and `dogs.py`, offering similar core functionality are available in the parent directory.)

## Table of Contents

- [Overview](#overview)
  - [`cats.js`](#catsjs-description)
  - [`dogs.js`](#dogsjs-description)
- [Why UTF-8 is the Standard](#why-utf-8-is-the-standard)
- [Workflow](#workflow)
  - [1. 🧶🐈 Bundle with `cats.js`](#1--bundle-with-catsjs)
  - [2. Interact with an LLM](#2-interact-with-an-llm)
  - [3. 🥏🐕 Extract with `dogs.js`](#3--extract-with-dogsjs)
    - [Interactive Overwrite Prompt (`dogs.js`)](#interactive-overwrite-prompt-dogsjs)
- [Comprehensive Delta Workflow Example](#comprehensive-delta-workflow-example)
- [Key Features `cats.js`/`dogs.js`](#key-features-catsjsdogsjs)
  - [Specialized Self-Modification (RSI) Mode](#specialized-self-modification-rsi-mode)
- [`cats.js` - Bundling your source code 🧶🐈](#catsjs---bundling-your-source-code-)
  - [Command Syntax (`cats.js`)](#command-syntax-catsjs)
  - [Key Options (`cats.js`)](#key-options-catsjs)
  - [`cats.js` Examples](#catsjs-examples)
- [`dogs.js` - Reconstructing from a bundle 🥏🐕](#dogsjs---reconstructing-from-a-bundle-)
  - [Command Syntax (`dogs.js`)](#command-syntax-dogsjs)
  - [Key Options (`dogs.js`)](#key-options-dogsjs)
  - [`dogs.js` Examples](#dogsjs-examples)
- [Library Usage (Node.js)](#library-usage-nodejs)
  - [Example using `cats.js` as a library](#example-using-catsjs-as-a-library)
  - [Example using `dogs.js` as a library](#example-using-dogsjs-as-a-library)

## Overview

### `cats.js` <a name="catsjs-description"></a>

Bundles specified project files and/or directories into a single text artifact. It's designed for flexible, inclusive, and exclusive filtering of files.

- **System Prompt Prepending**: By default, `cats.js` searches for a `sys_ant.txt` (or similar, as defined by `SYS_PROMPT_FILENAME` in the script) alongside itself or one directory level up. If found, its content is **prepended** to the output, _before_ the actual Cats Bundle structure. This can be disabled with `--no-sys-prompt`.
- **CWD `sys_ant.txt` (or user context file) Bundling**: By convention, `cats.js` also checks for a file named `sys_ant.txt` (or a similar user-provided context file, as defined by `SYS_PROMPT_FILENAME` in the script) in the current working directory. If found (and not excluded), it is included as the **first file _within_** the Cats Bundle.
- **Mixed Content Handling**: `cats.js` intelligently handles mixed content. Text files (e.g., source code) are bundled as raw text (typically UTF-8). Binary files (e.g., images) are Base64 encoded within their respective file blocks, and their start markers will include a `(Content:Base64)` hint (e.g., `🐈 --- CATS_START_FILE: assets/logo.png (Content:Base64) ---`). This allows for efficient bundling of diverse project assets.
- **Delta Reference Hinting**: The `--prepare-for-delta-reference` (`-t`) flag adds a special header to the bundle, signaling that this bundle is a suitable original reference for `dogs.js` when applying delta changes.
- It applies default excludes (`.git`, `node_modules/`, `gem/`, `__pycache__`) which can be disabled.

### `dogs.js` <a name="dogsjs-description"></a>

Extracts files from such a bundle back into a directory structure, faithfully reconstructing the original project layout.

- It correctly decodes text and Base64-encoded binary files based on bundle headers and per-file markers.
- It can apply delta changes specified in the bundle if invoked with the `--apply-delta` flag, using an _original_ bundle as a base. Deltas apply to text-based files only.
- The default input bundle name is `dogs_in.bundle`.
- Before extraction, `dogs.js` provides a clear summary of its plan, including detected formats and file counts, before proceeding.
- When encountering existing files, it provides an interactive prompt allowing fine-grained control over overwriting, skipping, or quitting.

## Why UTF-8 is the Standard

UTF-8 has become the de facto standard encoding for text on the internet, in software development, and across most operating systems. Here's a brief overview:

- **Unicode Foundation:** UTF-8 is an encoding for Unicode, a universal character set standard that aims to represent every character from every writing system in the world, plus a vast array of symbols and emoji. Each character is assigned a unique "code point."
- **Variable-Width Encoding:** UTF-8 uses a variable number of bytes (1 to 4) to represent each Unicode code point.
  - **ASCII Compatibility:** The first 128 Unicode code points are identical to ASCII. UTF-8 encodes these using a single byte, making it backward compatible with ASCII. This means plain English text files are the same in ASCII and UTF-8.
  - **Efficiency:** For languages using Latin scripts, it remains very storage-efficient.
  - **Comprehensive:** It can represent millions of characters, covering almost all known languages, scripts, and symbols, including emoji like "😂" (which is a single Unicode character `U+1F602` typically encoded in 4 bytes in UTF-8).
- **Self-Synchronizing:** The way multi-byte sequences are structured in UTF-8 makes it easy for software to find the start of a character, even if it starts reading from the middle of a sequence, which aids in error recovery.
- **No Byte Order Mark (BOM) Issues (Generally):** Unlike UTF-16 or UTF-32, UTF-8 does not have byte order (endianness) issues. While a UTF-8 BOM exists, it's generally not recommended or needed, and its primary use is to signal that a file is UTF-8, not to indicate byte order.
- **Widespread Adoption:**
  - **Web:** The W3C and WHATWG strongly recommend UTF-8 for all web content (HTML, CSS, JavaScript, JSON, XML). Most web servers and browsers use it by default.
  - **Operating Systems:** Modern versions of Linux, macOS, and Windows use UTF-8 extensively as their default or preferred system encoding.
  - **Programming Languages & Tools:** Most modern programming languages (Python, Java, JavaScript, Go, Rust, C#, etc.) have excellent UTF-8 support, often using it as their default for source files and string handling. Version control systems (like Git) and many developer tools also work best with UTF-8.

This widespread support and technical advantages make UTF-8 the most robust, compatible, and versatile choice for text data exchange in today's interconnected world.

## Workflow

The primary goal is to enable a seamless workflow for project-wide analysis, refactoring, or content generation by LLMs:

### 1. 🧶🐈 Bundle with `cats.js` <a name="1--bundle-with-catsjs"></a>

Use `cats.js` to package your entire project (or relevant parts) into one text artifact (`cats_out.bundle`).

**NOTE:** A `sys_ant.txt` (or the file specified by `SYS_PROMPT_FILENAME` in `cats.js`) found near `cats.js` will be automatically prepended. Additionally, a `sys_ant.txt` (or `SYS_PROMPT_FILENAME`) in the current working directory will be bundled as the first file _within_ the bundle if present and not excluded. It's good practice for the prepended system prompt to guide the LLM. Default excludes are applied.

**Common `cats.js` Examples:**

```bash
# Bundle the current directory (.), using default excludes, output to default cats_out.bundle
node cats.js .

# Bundle the 'src' folder, a sibling 'main.js' file, and a specific subfolder 'docs/api'
# This creates a bundle named 'my_project.bundle'
node cats.js src main.js docs/api -o my_project.bundle

# Bundle the current directory, EXCLUDING the 'dist' folder, and disable default excludes
node cats.js . -x dist -N -o my_custom_bundle.bundle

# Bundle the 'project' folder, and mark the bundle as suitable for future delta operations
node cats.js project -t -o project_original_for_delta.bundle
```

### 2. Interact with an LLM <a name="2-interact-with-an-llm"></a>

Provide this bundle (`cats_out.bundle`) to an LLM. Give clear instructions, emphasizing the bundle format and expected output:

1.  **Understand Input**:
    "The very first part of this input, before any `--- CATS_START_FILE ---` or `--- DOGS_START_FILE ---` markers, is a system prompt/guide that you MUST adhere to. Following that, there is a bundle of files. Each file in the bundle starts with `🐈 --- CATS_START_FILE: path/to/file.ext ---` (or `🐕 --- DOGS_START_FILE: ... ---` if processed) and ends with the corresponding `END_FILE` marker. The first file _within_ the bundle may be `sys_ant.txt` (or a similar context file) providing project-specific context, distinct from the initial system prompt."

2.  **Note Bundle Headers**:
    "The bundle (after the initial system prompt, if any) will have a header like `# Cats Bundle` or `# Dogs Bundle`. Its lines might include a `# Format: ...` (e.g., `Raw UTF-8`, `Raw UTF-16LE`, `Base64`) and potentially a `# Delta Reference: Yes` hint. The **global format** dictates the primary encoding for text files within the bundle. However, individual files (typically binaries like images) may be Base64 encoded regardless of the global format, and these will be explicitly indicated by `(Content:Base64)` in their start marker. Your output for a file marked `(Content:Base64)` must also be Base64. For all other (text) files, adhere to the bundle's global text format (e.g., UTF-8 or UTF-16LE)."

3.  **Preserve/Use Markers**:

    - "**VERY IMPORTANT: Only modify content _between_ the start and end file markers.**"
    - "**Use `🐕 --- DOGS_START_FILE: path/to/your/file.ext ---` and `🐕 --- DOGS_END_FILE ---` for each file you output.** If outputting binary data (like an image) within a text-primary bundle, use `🐕 --- DOGS_START_FILE: path/to/your/file.bin (Content:Base64) ---`. This helps the `dogs` utility parse your output most reliably."
    - "Do NOT alter the original `🐈 CATS_START_FILE` / `🐈 CATS_END_FILE` markers or any `# Format:` or `# Delta Reference:` headers if you are only making minor changes _within_ existing file blocks of an input bundle."

4.  **Maintain Encoding**:
    "If a file block is marked `(Content:Base64)`, your output for that file must be valid Base64. For other files, ensure valid text in the bundle's primary text encoding (e.g., UTF-8 or UTF-16LE) for all content between your `🐕 DOGS_` markers."

5.  **New Files**:
    "For new text files, use `🐕 DOGS_START_FILE: path/to/new_file.ext ---`, its full content, then `🐕 DOGS_END_FILE ---`. For new binary files, use `🐕 DOGS_START_FILE: path/to/new_file.bin (Content:Base64) ---`, its full Base64 content, then `🐕 DOGS_END_FILE ---`. Use relative paths with forward slashes `/`."

6.  **File Deletion (by Omission):**
    "If you intend for a file to be 'deleted' from the user's project, simply **do NOT include it in your `dogs` bundle output**. The `dogs.js` utility does not remove files from the filesystem; it only extracts/overwrites files that are _present_ in the bundle. The user will then manually delete any files that are no longer desired based on your output."

7.  **Delta Changes (Optional, for `dogs.js --apply-delta` on text files):**
    "If modifying large existing _text_ files, you can specify changes using delta commands within the `🐕 DOGS_` block. Use `@@ PAWS_CMD REPLACE_LINES(start, end) @@`, `@@ PAWS_CMD INSERT_AFTER_LINE(line_num) @@`, or `@@ PAWS_CMD DELETE_LINES(start, end) @@`. These refer to 1-based line numbers in the _original_ file (from the `cats_out.bundle` you received). Ensure the user intends to run `dogs.js` with the `-d` flag. Deltas are not applicable to files marked `(Content:Base64)`."

**Example LLM Task (Full File Output):**
"Refactor all JavaScript functions named `oldFunc` to `newFunc` in the `cats_out.bundle`. If the bundle contains an image `assets/logo.png` that was marked `(Content:Base64)`, preserve it as Base64 in your output. Output the complete modified files in a `dogs_in.bundle` using `🐕 DOGS_` markers, assuming `Raw UTF-8` as the primary text format."

**Example LLM Task (Delta Output for a text file):**
"In `large_text_file.js` from `cats_out.bundle`, replace lines 500-510 with the provided code snippet and insert another snippet after line 600. Output a `dogs_in.bundle` using `🐕 DOGS_` markers and `PAWS_CMD` delta instructions for `large_text_file.js`."

### 3. 🥏🐕 Extract with `dogs.js` <a name="3--extract-with-dogsjs"></a>

Use `dogs.js` to extract the LLM's output bundle (`dogs_in.bundle`) back into a functional project. Before extraction, `dogs.js` will present a clear summary of its plan. Use `-d <original_bundle>` if the LLM used delta commands for text files.

**Common `dogs.js` Examples:**

```bash
# Extract default 'dogs_in.bundle' to the current directory (.), automatically overwriting existing files
node dogs.js -y .

# Extract 'llm_refactor_output.bundle' into a new directory 'my_project_v2', overwriting existing files
node dogs.js llm_refactor_output.bundle ./my_project_v2 -y

# Apply delta changes from 'llm_delta.bundle', using 'original_codebase.bundle' as the base reference,
# extracting to './project_with_updates' and showing verbose output
node dogs.js llm_delta.bundle ./project_with_updates -v -d original_codebase.bundle

# Extract 'ai_generated_files.bundle' to 'new_feature_branch', skipping any files that already exist
node dogs.js ai_generated_files.bundle ./new_feature_branch -n

# Extract 'malformed_bundle.txt' to the current directory, forcing interpretation as Base64 (ignoring headers)
node dogs.js malformed_bundle.txt . -i b64
```

#### Interactive Overwrite Prompt (`dogs.js`) <a name="interactive-overwrite-prompt-dogsjs"></a>

When `dogs.js` is run without the `-y` (yes, overwrite all) or `-n` (no, skip all) flags, and it encounters an existing file in the target output directory, it will prompt you for an action. This allows for fine-grained control over individual file conflicts.

The prompt will look like this: `File 'path/to/existing_file.txt' exists. Overwrite? [y/N/a/s/q]:`

- **`y` (Yes)**: Overwrite the _current_ file. `dogs.js` will then continue to the next file, potentially prompting again.
- **`N` (No / Default)**: **Skip** the _current_ file. The existing file on disk will be left untouched. If you just press Enter, this is the default action. `dogs.js` will then continue to the next file.
- **`a` (Always yes)**: Overwrite the _current_ file and **all subsequent existing files** without further prompting. This is equivalent to running with `-y` from this point onward.
- **`s` (Skip all)**: Skip the _current_ file and **all subsequent existing files** without further prompting. This is equivalent to running with `-n` from this point onward.
- **`q` (Quit)**: **Immediately cancel** the entire extraction process. No more files will be written, and `dogs.js` will exit.

This interactive mode gives you granular control over how `dogs.js` handles conflicts with existing files in your project directory.

## Comprehensive Delta Workflow Example <a name="comprehensive-delta-workflow-example"></a>

This example demonstrates a typical workflow for modifying a Flutter/Dart project (`lib/` directory and `pubspec.yaml`) using `cats.js` to create a reference bundle, LLM interaction to generate changes (including new files, modified files via delta and full rewrite, and implicit file deletions), and `dogs.js` to apply those changes.

Assume your project structure looks like this initially:

```
my_flutter_project/
├── lib/
│   ├── src/
│   │   ├── feature_a/
│   │   │   └── widget_a.dart
│   │   └── feature_b/
│   │       └── service_b.dart
│   ├── main.dart
│   └── utils.dart
└── pubspec.yaml
```

_(Imagine `lib/` has 64 files across 3-4 subfolder depths.)_

---

**Step 1: Bundle with `cats.js` (Create the Original Reference)**

First, you'll bundle your project's relevant files into a `cats` bundle, marking it as a suitable reference for delta operations. This bundle will serve as the "original" when `dogs.js` applies delta changes later.

```bash
# From the 'my_flutter_project' root directory:
node cats.js lib pubspec.yaml -t -o original_flutter_project.bundle
```

This command bundles `lib/` (including all 64 files recursively) and `pubspec.yaml`. The `-t` flag adds `# Delta Reference: Yes` to the bundle header.

---

**Step 2: Interact with an LLM**

Provide the `original_flutter_project.bundle` (potentially with `sys_ant.txt` prepended) to your LLM.
Instruct the LLM to perform changes (e.g., refactor `feature_a`, add a new `feature_c`, remove `feature_b`, update `pubspec.yaml`).
The LLM's response should be a `dogs` bundle, including:

- **New files:** Full content for new files (e.g., `lib/src/feature_c/new_widget.dart`).
- **Deleted files:** Files to be 'deleted' (like `lib/src/feature_b/`) should _not_ be present in the LLM's `dogs` bundle output. `dogs.js` will leave them untouched, requiring the user to manually delete them.
- **Modified files (Delta):** Use `@@ PAWS_CMD` for large text files with targeted changes (e.g., `lib/src/feature_a/widget_a.dart` and `main.dart`).
- **Modified files (Full Rewrite):** Provide full content for files with significant or non-line-based changes, or smaller files (e.g., `pubspec.yaml`, `utils.dart`).

**Simulated LLM `dogs_in.bundle` Output (Partial Snippet):**

```
# Dogs Bundle (Output from LLM)
# Format: Raw UTF-8

🐕 --- DOGS_START_FILE: lib/src/feature_a/widget_a.dart ---
@@ PAWS_CMD REPLACE_LINES(10, 15) @@
import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart'; // New import
@@ PAWS_CMD INSERT_AFTER_LINE(30) @@
  // New helper function added by LLM
  Widget _buildUpdatedContent() {
    return Text('Refactored widget content');
  }
🐕 --- DOGS_END_FILE ---

🐕 --- DOGS_START_FILE: lib/src/feature_c/new_widget.dart ---
// This is a brand new file
import 'package:flutter/widgets.dart';

class NewFeatureCWidget extends StatelessWidget {
  const NewFeatureCWidget({super.key});

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Text('Hello from New Feature C!'),
    );
  }
}
🐕 --- DOGS_END_FILE ---

🐕 --- DOGS_START_FILE: pubspec.yaml ---
name: my_flutter_project
description: A new Flutter project.
publish_to: 'none'
version: 1.0.1+2 # Updated version
environment:
  sdk: '>=3.0.0 <4.0.0'
dependencies:
  flutter:
    sdk: flutter
  cupertino_icons: ^1.0.2
  flutter_hooks: ^0.20.0 # New dependency added
dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^2.0.0
flutter:
  uses-material-design: true
🐕 --- DOGS_END_FILE ---

🐕 --- DOGS_START_FILE: lib/utils.dart ---
// This file was completely rewritten by the LLM
String formatName(String firstName, String lastName) {
  return '${firstName.toUpperCase()} ${lastName.toUpperCase()}';
}

int calculateSum(int a, int b) {
  return a + b;
}
🐕 --- DOGS_END_FILE ---
```

*(The LLM would *not* include `lib/src/feature_b/service_b.dart` in its output to indicate its removal.)*

---

**Step 3: Extract with `dogs.js` (Apply Changes)**

Now, use `dogs.js` to apply these changes to your project. You'll specify the LLM's bundle (`dogs_in.bundle`), the target directory (`.`, representing `my_flutter_project/`), and crucially, the original bundle (`original_flutter_project.bundle`) as the `--apply-delta` reference.

```bash
# From the 'my_flutter_project' root directory:
node dogs.js dogs_in.bundle . -y -d original_flutter_project.bundle
```

- `dogs_in.bundle`: This is the bundle generated by the LLM.
- `.`: This specifies the current directory (`my_flutter_project/`) as the output target. `dogs.js` will recreate paths (e.g., `lib/src/feature_c/new_widget.dart`) relative to this.
- `-y`: Automatically overwrites/extracts without prompting (useful for CI/CD or when confident).
- `-d original_flutter_project.bundle`: This is essential. `dogs.js` will read `original_flutter_project.bundle` to get the original content of files like `lib/src/feature_a/widget_a.dart` and `main.dart` before applying the `@@ PAWS_CMD` delta instructions from `dogs_in.bundle`. Files provided as full rewrites (like `pubspec.yaml`, `utils.dart`) or new files (like `lib/src/feature_c/new_widget.dart`) will simply be written directly.

**Resulting Project State (after `dogs.js`):**

```
my_flutter_project/
├── lib/
│   ├── src/
│   │   ├── feature_a/
│   │   │   └── widget_a.dart  # MODIFIED by delta
│   │   └── feature_c/
│   │       └── new_widget.dart # NEW file
│   ├── main.dart             # MODIFIED by delta
│   └── utils.dart            # REWRITTEN (full content)
└── pubspec.yaml              # REWRITTEN (full content)
```

_Note_: `lib/src/feature_b/` (and its contents) would remain in `my_flutter_project` as `dogs.js` does not delete files by omission. The user would need to manually remove it if desired.

---

This example showcases the full power of the PAWS/SWAP system for complex project modifications involving a mix of new files, detailed line-level changes, full file rewrites, and file removals managed by the user.

## Key Features `cats.js`/`dogs.js` <a name="key-features-catsjsdogsjs"></a>

- **Comprehensive Context:** Bundles multiple files and directories (with `cats.js`).
- **Dual `sys_ant.txt` (or `SYS_PROMPT_FILENAME`) Handling (`cats.js`):**
  - Automatically **prepends** a `sys_ant.txt` (or `SYS_PROMPT_FILENAME`) found near the script (configurable with `--no-sys-prompt`, `--require-sys-prompt`).
  - Automatically **bundles** a `sys_ant.txt` (or `SYS_PROMPT_FILENAME`) from CWD as the first file if present and not excluded.
- **Default Excludes (`cats.js`):** Automatically excludes `.git`, `node_modules/`, `gem/`, `__pycache__`. Disable with `-N`.
- **Robust Exclusion (`cats.js`):** Precisely exclude additional files/directories.
- **Flexible Encoding (`cats.js`):**
  - **`auto` mode (default):** Bundles text files as UTF-8 (or UTF-16LE if all text files are consistently that). Binary files (e.g., images) are automatically Base64 encoded and marked with `(Content:Base64)` in their start file marker. The bundle header reflects the primary text encoding (e.g., `# Format: Raw UTF-8 (with potential Base64 blocks)`).
  - **`--force-encoding {utf8|utf16le}`:** Forces all _textual_ content to the specified encoding. Binary files are still Base64 encoded and marked.
  - **`--force-encoding b64`:** Forces _all_ content (text and binary) to be Base64 encoded.
- **Delta Reference Hint (`cats.js`):** The `--prepare-for-delta-reference` (`-t`) flag adds a clear header to the bundle, guiding `dogs.js` that this bundle is suitable as an original for delta operations.
- **Clear Bundle Structure:** Includes format headers and `🐈`/`🐕` file markers, with optional per-file Base64 indicators.
- **Pre-Extraction Summary (`dogs.js`):** Provides a clear summary of the extraction plan (source, destination, format, file counts, delta status) before prompting for user confirmation.
- **Safe Extraction (`dogs.js`):** Sanitizes paths, prevents traversal. Correctly decodes mixed text/Base64 content.
- **Delta Application (`dogs.js`):** Applies line-based changes to _text files_ using `--apply-delta (-d)` flag and `@@ PAWS_CMD [...] @@` syntax. Output from deltas respects the `dogs` bundle's declared text encoding.
- **Overwrite Control (`dogs.js`):** Offers flexible user control over overwriting existing files (`-y` for auto-yes, `-n` for auto-no, or an interactive prompt with `y/N/a/s/q` options).

### Specialized Self-Modification (RSI) Mode <a name="specialized-self-modification-rsi-mode"></a>

In advanced scenarios, the PAWS/SWAP system can be instructed to modify its own source code (e.g., `cats.js`, `dogs.js`, `README.md`, `sys_ant.txt`, `sys_rsi.txt`). For this specific task, a dedicated system prompt file, `sys_rsi.txt`, is used. This file provides the LLM with heightened caution and precise instructions tailored for self-modification, overriding or supplementing the general `sys_ant.txt` guide. `cats.js` will handle `sys_rsi.txt` from the current working directory as the first bundled file in this context.

## `cats.js` - Bundling your source code 🧶🐈 <a name="catsjs---bundling-your-source-code-"></a>

**Command Syntax:**

```bash
node cats.js [PATH...] [options]
```

`PATH...`: One or more files or directories to include. Directories will be scanned recursively.

**Key Options:**

- **`-o BUNDLE_FILE, --output BUNDLE_FILE`**: Output bundle name (default: `cats_out.bundle`). Use `-` for stdout.
- **`-x EXCLUDE_PATH, --exclude EXCLUDE_PATH`**: Path (file or directory) to exclude from bundling. Can be used multiple times. Applied in addition to default excludes.
- **`-N, --no-default-excludes`**: Disable default excludes: `.git`, `node_modules`, `gem`, `__pycache__`. All files will be included unless explicitly excluded by `-x`.
- **`-E {auto,utf8,utf16le,b64}, --force-encoding {auto,utf8,utf16le,b64}`**: Set bundle encoding strategy (default: `auto`).
  - `auto`: Detects text encoding (UTF-8/UTF-16LE). Binary files become Base64 marked blocks.
  - `utf8`/`utf16le`: Text files conform to this; binary files become Base64 marked blocks.
  - `b64`: All files (text and binary) are Base64 encoded.
- **`-t, --prepare-for-delta-reference`**: Adds a header hint to the bundle indicating it is suitable as an original bundle for future delta operations with `dogs.js --apply-delta`.
- **`-y, --yes`**: Automatically confirm and proceed without prompting for output file writing.
- **`--no-sys-prompt`**: Do not prepend the `sys_ant.txt` (or `SYS_PROMPT_FILENAME`) found near the script itself.
- **`--require-sys-prompt`**: Exit with error if `sys_ant.txt` for prepending is not found or unreadable when prepending is attempted.
- **`-v, --verbose`**: Enable verbose logging.
- **`-h, --help`**: Show help message and exit.

**`cats.js` Examples:**

```bash
# Bundle the current directory (.), using default excludes, output to default cats_out.bundle
node cats.js .

# Bundle files from 'src' folder, a specific 'package.json' file, and the 'tests/integration' directory
node cats.js src package.json tests/integration -o my_app_bundle.bundle

# Bundle current directory, excluding the 'dist' folder and disabling default excludes
node cats.js . -x dist -N -o full_project_bundle.bundle

# Bundle the 'my_service' folder, force all content to Base64 (for binary-heavy projects)
node cats.js my_service -E b64 -o service_binaries.bundle

# Bundle the current directory, and explicitly mark this bundle for delta referencing by dogs.js
node cats.js . -t -o original_codebase.bundle

# Bundle just a few files from 'src' to stdout (e.g., for quick LLM prompt)
node cats.js src/main.js src/utils.js -o -
```

## `dogs.js` - Reconstructing from a bundle 🥏🐕 <a name="dogsjs---reconstructing-from-a-bundle-"></a>

**Command Syntax:**

```bash
node dogs.js [BUNDLE_FILE] [OUTPUT_DIR] [options]
```

- `BUNDLE_FILE` (optional): The path to the bundle file to extract (default: `dogs_in.bundle` if it exists in the current directory, otherwise an error).
- `OUTPUT_DIR` (optional): The directory where extracted files will be placed (default: the current directory `./`).

**Key Options:**

- **`-d ORIGINAL_BUNDLE, --apply-delta ORIGINAL_BUNDLE`**: Apply delta commands found in `BUNDLE_FILE`, using `ORIGINAL_BUNDLE` as the reference base. This is crucial when the LLM outputs line-based changes instead of full file contents for text files. Delta commands are ignored for Base64-marked files.
- **`-i {auto,b64,utf8,utf16le}, --input-format {auto,b64,utf8,utf16le}`**: Override bundle's primary text format detection (default: `auto`). This influences how non-Base64-marked content is interpreted. `dogs.js` will still handle per-file `(Content:Base64)` markers.
- **`-y, --yes`**: Automatically overwrite any existing files in the `OUTPUT_DIR` without prompting.
- **`-n, --no`**: Automatically skip existing files in the `OUTPUT_DIR` without prompting.
- **Interactive Overwrite Prompt (Default behavior if `-y` or `-n` are not used):**
  When `dogs.js` is run without the `-y` (yes, overwrite all) or `-n` (no, skip all) flags, and it encounters an existing file in the target output directory, it will display a prompt: `File 'path/to/file' exists. Overwrite? [y/N/a/s/q]:`
  - **`y` (Yes)**: Overwrite the _current_ file. `dogs.js` will then continue to the next file, potentially prompting again.
  - **`N` (No / Default)**: **Skip** the _current_ file, leaving the existing file untouched. If you just press Enter, this is the default action. `dogs.js` will then continue to the next file.
  - **`a` (Always yes)**: Overwrite the _current_ file and **all subsequent existing files** without further prompting. This is equivalent to running with `-y` from this point onward.
  - **`s` (Skip all)**: Skip the _current_ file and **all subsequent existing files** without further prompting. This is equivalent to running with `-n` from this point onward.
  - **`q` (Quit)**: **Immediately cancel** the entire extraction process. No more files will be written, and `dogs.js` will exit.
- **`-v, --verbose`**: Enable verbose logging during parsing and extraction, providing more detailed messages.
- **`-h, --help`**: Show help message and exit.

**`dogs.js` Examples:**

```bash
# Extract default 'dogs_in.bundle' to the current directory (.), automatically overwriting existing files
node dogs.js -y .

# Extract 'llm_refactor_output.bundle' into a new directory 'my_project_v2', overwriting existing files
node dogs.js llm_refactor_output.bundle ./my_project_v2 -y

# Apply delta changes from 'llm_delta.bundle', using 'original_codebase.bundle' as the base reference,
# extracting to './project_with_updates' and showing verbose output
node dogs.js llm_delta.bundle ./project_with_updates -v -d original_codebase.bundle

# Extract 'ai_generated_files.bundle' to 'new_feature_branch', skipping any files that already exist
node dogs.js ai_generated_files.bundle ./new_feature_branch -n

# Extract 'malformed_bundle.txt' to the current directory, forcing interpretation as Base64 (ignoring headers)
node dogs.js malformed_bundle.txt . -i b64
```

## Library Usage (Node.js) <a name="library-usage-nodejs"></a>

Both `cats.js` and `dogs.js` expose their core functionality via API functions, allowing integration into larger Node.js applications.

```javascript
const fs = require("fs").promises; // Use promise-based fs for async operations
const path = require("path");

// Assuming cats.js and dogs.js are in the same directory or accessible via module paths
// const { createBundleFromPathsApi } = require("./cats.js");
// const { extractToDiskNode, extractToMemory } = require("./dogs.js");

// Example using cats.js as a library
async function catsLibraryExample() {
  console.log("--- cats.js Library Example ---");
  const projectRoot = path.join(__dirname, "test_project_cats_lib");
  const srcDir = path.join(projectRoot, "src");
  const assetsDir = path.join(projectRoot, "assets");
  const imagePath = path.join(assetsDir, "test_image.bin");
  const jsFilePath = path.join(srcDir, "example.js");

  // Create dummy files for demonstration
  await fs.mkdir(srcDir, { recursive: true });
  await fs.mkdir(assetsDir, { recursive: true });
  await fs.writeFile(
    imagePath,
    Buffer.from("dummy_image_data_binary_00", "utf8")
  ); // Contains null byte for binary detection
  await fs.writeFile(
    jsFilePath,
    'console.log("Hello Node.js");\nconst x = 10;'
  );

  // Import locally for demonstration (in real app, use `require` or `import` based on module system)
  const { createBundleFromPathsApi } = require("./cats.js"); // Adjust path as needed

  try {
    const bundleOptions = {
      includePathsRaw: [srcDir, imagePath],
      excludePathsRaw: [], // No specific exclusions for this example
      encodingMode: "auto", // Auto-detect text/binary
      useDefaultExcludes: true,
      // Pass a dummy output file path if you want it to exclude itself during bundling
      outputFileAbsPath: path.resolve(projectRoot, "my_lib_bundle.bundle"),
      prepareForDeltaReference: true, // Mark this bundle for delta use
    };

    const { bundleString, formatDescription, filesAdded, bundleFileEncoding } =
      await createBundleFromPathsApi(bundleOptions);

    if (filesAdded > 0) {
      console.log(
        `Bundle created (${formatDescription}), ${filesAdded} files. Encoding: ${bundleFileEncoding}`
      );
      const outputBundlePath = bundleOptions.outputFileAbsPath;
      await fs.writeFile(
        outputBundlePath,
        Buffer.from(bundleString, bundleFileEncoding)
      );
      console.log(`Bundle written to: ${outputBundlePath}`);
    } else {
      console.log("No files were added to the bundle.");
    }
  } catch (e) {
    console.error("Error creating bundle in library example:", e);
  } finally {
    // Clean up dummy project
    try {
      await fs.rm(projectRoot, { recursive: true, force: true });
    } catch (e) {
      /* ignore cleanup errors */
    }
  }
}

// Example using dogs.js as a library
async function dogsLibraryExample() {
  console.log("\n--- dogs.js Library Example ---");
  const extractedDir = path.join(__dirname, "js_lib_extracted_node");

  // Create a dummy bundle string representing LLM output
  const dummyLlmBundleContent = `
# Dogs Bundle (Output from LLM)
# Format: Raw UTF-8

🐕 --- DOGS_START_FILE: new_file.js ---
console.log("This is a new file from LLM.");
🐕 --- DOGS_END_FILE ---

🐕 --- DOGS_START_FILE: existing_file.js ---
@@ PAWS_CMD REPLACE_LINES(1, 1) @@
// Modified by LLM
@@ PAWS_CMD INSERT_AFTER_LINE(2) @@
function newFeature() {
  console.log('New feature logic');
}
🐕 --- DOGS_END_FILE ---

🐕 --- DOGS_START_FILE: binary_asset.bin (Content:Base64) ---
SGVsbG8gQmluYXJ5IERhdGEhCg==
🐕 --- DOGS_END_FILE ---
`;

  // Create a dummy original bundle for delta reference
  const originalBundlePath = path.join(
    __dirname,
    "original_dummy_bundle.bundle"
  );
  const originalDummyContent = `
# Cats Bundle
# Format: Raw UTF-8
# Delta Reference: Yes

🐈 --- CATS_START_FILE: existing_file.js ---
// Original comment
const oldVar = 1;
// Some original content
function oldFunction() {
  console.log('Old logic');
}
🐈 --- CATS_END_FILE ---
`;
  await fs.writeFile(originalBundlePath, originalDummyContent);

  // Import locally for demonstration
  const { extractToDiskNode, extractToMemory } = require("./dogs.js"); // Adjust path as needed

  try {
    // Option 1: Extract to disk (applying deltas)
    console.log(`Attempting to extract to disk at: ${extractedDir}`);
    const diskResults = await extractToDiskNode({
      bundleFileContent: dummyLlmBundleContent,
      outputDir: extractedDir,
      overwritePolicy: "yes", // Auto-overwrite for library usage
      applyDeltaFromOriginalBundlePath: originalBundlePath, // Apply deltas using original
    });
    console.log("Extraction results (to disk):");
    for (const res of diskResults) {
      console.log(`  - ${res.path}: ${res.status} (${res.message})`);
    }

    // Option 2: Extract/parse to memory (does NOT apply deltas, just provides raw parsed files)
    console.log("\nAttempting to extract to memory (raw parsing):");
    const memoryFiles = await extractToMemory({
      bundleFileContent: dummyLlmBundleContent,
      verbose: true,
    });
    console.log("Memory extraction results (parsed files):");
    for (const mf of memoryFiles) {
      console.log(
        `  - Path: ${mf.path_in_bundle}, Decoded as: ${mf.formatUsedForDecode}`
      );
      if (mf.contentBytes) {
        // console.log(`    Content length: ${mf.contentBytes.length} bytes`);
      } else if (mf.deltaCommands) {
        console.log(`    Delta commands count: ${mf.deltaCommands.length}`);
      }
    }
  } catch (e) {
    console.error("Error in dogs.js library example:", e);
  } finally {
    // Clean up dummy extracted project and original bundle
    try {
      await fs.rm(extractedDir, { recursive: true, force: true });
      await fs.unlink(originalBundlePath);
    } catch (e) {
      /* ignore cleanup errors */
    }
  }
}

// To run these examples, uncomment the calls below:
catsLibraryExample();
dogsLibraryExample();
```
