# 🐾 PAWS: Prepare Artifacts With SWAP (Streamlined Write After PAWS)

**PAWS** provides simple, dependency-free command-line utilities (`cats.py` and `dogs.py`) to bundle your project files for efficient interaction with Large Language Models (LLMs) and then to reconstruct them, enabling a swift code **💱 SWAP** (Streamlined Write After PAWS).

This two-part toolkit streamlines the process of getting your codebase into and out of an LLM, making project-wide analysis, refactoring, and content generation more intuitive.

(Node.js versions, `cats.js` and `dogs.js`, offering similar core functionality are available in the `js/` subdirectory; see `js/README.md` for details.)

## Table of Contents

- [Overview](#overview)
  - [`cats.py`](#catspy-description)
  - [`dogs.py`](#dogspy-description)
- [Why UTF-8 is the Standard](#why-utf-8-is-the-standard)
- [Workflow](#workflow)
  - [1. 🧶🐈 Bundle with `cats.py`](#1--bundle-with-catspy)
  - [2. Interact with an LLM](#2-interact-with-an-llm)
  - [3. 🥏🐕 Extract with `dogs.py`](#3--extract-with-dogspy)
    - [Interactive Overwrite Prompt (`dogs.py`)](#interactive-overwrite-prompt-dogspy)
- [Comprehensive Delta Workflow Example](#comprehensive-delta-workflow-example)
- [Key Features `cats.py`/`dogs.py`](#key-features-catspydogspy)
  - [Specialized Self-Modification (RSI) Mode](#specialized-self-modification-rsi-mode)
- [`cats.py` - Bundling your source code 🧶🐈](#catspy---bundling-your-source-code-)
  - [Command Syntax (`cats.py`)](#command-syntax-catspy)
  - [Key Options (`cats.py`)](#key-options-catspy)
  - [`cats.py` Examples](#catspy-examples)
- [`dogs.py` - Reconstructing from a bundle 🥏🐕](#dogspy---reconstructing-from-a-bundle-)
  - [Command Syntax (`dogs.py`)](#command-syntax-dogspy)
  - [Key Options (`dogs.py`)](#key-options-dogspy)
  - [`dogs.py` Examples](#dogspy-examples)
- [Library Usage (Python)](#library-usage-python)
  - [Example using `cats.py` as a library](#example-using-catspy-as-a-library)
  - [Example using `dogs.py` as a library](#example-using-dogspy-as-a-library)

## Overview

### `cats.py` <a name="catspy-description"></a>

Bundles specified project files and/or directories into a single text artifact. It's designed for flexible, inclusive, and exclusive filtering of files.

- **System Prompt Prepending**: By default, `cats.py` searches for a `sys_ant.txt` (or similar, as defined by `SYS_PROMPT_FILENAME` in the script) alongside itself or one directory level up. If found, its content is **prepended** to the output, _before_ the actual Cats Bundle structure. This can be disabled with `--no-sys-prompt`.
- **CWD `sys_ant.txt` (or user context file) Bundling**: By convention, `cats.py` also checks for a file named `sys_ant.txt` (or a similar user-provided context file, as defined by `SYS_PROMPT_FILENAME` in the script) in the current working directory. If found (and not excluded), it is included as the **first file _within_** the Cats Bundle.
- **Mixed Content Handling**: `cats.py` intelligently handles mixed content. Text files (e.g., source code) are bundled as raw text (typically UTF-8). Binary files (e.g., images) are Base64 encoded within their respective file blocks, and their start markers will include a `(Content:Base64)` hint (e.g., `🐈 --- CATS_START_FILE: assets/logo.png (Content:Base64) ---`). This allows for efficient bundling of diverse project assets.
- **Delta Reference Hinting**: The `--prepare-for-delta-reference` (`-t`) flag adds a special header to the bundle, signaling that this bundle is a suitable original reference for `dogs.py` when applying delta changes.
- It applies default excludes (`.git`, `node_modules/`, `gem/`, `__pycache__`) which can be disabled.

### `dogs.py` <a name="dogspy-description"></a>

Extracts files from such a bundle back into a directory structure, faithfully reconstructing the original project layout.

- It correctly decodes text and Base64-encoded binary files based on bundle headers and per-file markers.
- It can apply delta changes specified in the bundle if invoked with the `--apply-delta` flag, using an _original_ bundle as a base. Deltas apply to text-based files only.
- The default input bundle name is `dogs_in.bundle`.
- Before extraction, `dogs.py` provides a clear summary of its plan, including detected formats and file counts, before proceeding.
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

### 1. 🧶🐈 Bundle with `cats.py`

Use `cats.py` to package your entire project (or relevant parts) into one text artifact (`cats_out.bundle`).

**NOTE:** A `sys_ant.txt` (or the file specified by `SYS_PROMPT_FILENAME` in `cats.py`) found near `cats.py` will be automatically prepended. Additionally, a `sys_ant.txt` (or `SYS_PROMPT_FILENAME`) in the current working directory will be bundled as the first file _within_ the bundle if present and not excluded. It's good practice for the prepended system prompt to guide the LLM. Default excludes are applied.

**Common `cats.py` Examples:**

```bash
# Bundle the current directory (.), using default excludes, output to default cats_out.bundle
python cats.py .

# Bundle the 'src' folder, a sibling 'main.py' file, and a specific subfolder 'docs/api'
# This creates a bundle named 'my_project.bundle'
python cats.py src main.py docs/api -o my_project.bundle

# Bundle the current directory, EXCLUDING the 'dist' folder, and disable default excludes
python cats.py . -x dist -N -o my_custom_bundle.bundle

# Bundle the 'project' folder, and mark the bundle as suitable for future delta operations
python cats.py project -t -o project_original_for_delta.bundle
```

````

_(For Node.js `cats.js` usage, see `js/README.md`)_

### 2. Interact with an LLM

Provide this bundle (`cats_out.bundle`) to an LLM. Give clear instructions, emphasizing the bundle format and expected output:

> - **Understand Input**: "The very first part of this input, before any `--- CATS_START_FILE ---` or `--- DOGS_START_FILE ---` markers, is a system prompt/guide that you MUST adhere to. Following that, there is a bundle of files. Each file in the bundle starts with `🐈 --- CATS_START_FILE: path/to/file.ext ---` (or `🐕 --- DOGS_START_FILE: ... ---` if processed) and ends with the corresponding `END_FILE` marker. The first file _within_ the bundle may be `sys_ant.txt` (or a similar context file) providing project-specific context, distinct from the initial system prompt."
> - **Note Bundle Headers**: "The bundle (after the initial system prompt, if any) will have a header like `# Cats Bundle` or `# Dogs Bundle`. Its lines might include a `# Format: ...` (e.g., `Raw UTF-8`, `Raw UTF-16LE`, `Base64`) and potentially a `# Delta Reference: Yes` hint. The **global format** dictates the primary encoding for text files within the bundle. However, individual files (typically binaries like images) may be Base64 encoded regardless of the global format, and these will be explicitly indicated by `(Content:Base64)` in their start marker. Your output for a file marked `(Content:Base64)` must also be Base64. For all other (text) files, adhere to the bundle's global text format (e.g., UTF-8 or UTF-16LE)."
> - **Preserve/Use Markers**:
>   - "**VERY IMPORTANT: Only modify content _between_ the start and end file markers.**"
>   - "**Use `🐕 --- DOGS_START_FILE: path/to/your/file.ext ---` and `🐕 --- DOGS_END_FILE ---` for each file you output.** If outputting binary data (like an image) within a text-primary bundle, use `🐕 --- DOGS_START_FILE: path/to/your/file.bin (Content:Base64) ---`. This helps the `dogs` utility parse your output most reliably."
>   - "Do NOT alter the original `🐈 CATS_START_FILE` / `🐈 CATS_END_FILE` markers or any `# Format:` or `# Delta Reference:` headers if you are only making minor changes _within_ existing file blocks of an input bundle."
> - **Maintain Encoding**: "If a file block is marked `(Content:Base64)`, your output for that file must be valid Base64. For other files, ensure valid text in the bundle's primary text encoding (e.g., UTF-8 or UTF-16LE) for all content between your `🐕 DOGS_` markers."
> - **New Files**: "For new text files, use `🐕 DOGS_START_FILE: path/to/new_file.ext ---`, its full content, then `🐕 DOGS_END_FILE ---`. For new binary files, use `🐕 DOGS_START_FILE: path/to/new_file.bin (Content:Base64) ---`, its full Base64 content, then `🐕 DOGS_END_FILE ---`. Use relative paths with forward slashes `/`."
> - **File Deletion (by Omission):** "If you intend for a file to be 'deleted' from the user's project, simply **do NOT include it in your `dogs` bundle output**. The `dogs.py` utility does not remove files from the filesystem; it only extracts/overwrites files that are _present_ in the bundle. The user will then manually delete any files that are no longer desired based on your output."
> - **Delta Changes (Optional, for `dogs.py --apply-delta` on text files):** "If modifying large existing _text_ files, you can specify changes using delta commands within the `🐕 DOGS_` block. Use `@@ PAWS_CMD REPLACE_LINES(start, end) @@`, `@@ PAWS_CMD INSERT_AFTER_LINE(line_num) @@`, or `@@ PAWS_CMD DELETE_LINES(start, end) @@`. These refer to 1-based line numbers in the _original_ file (from the `cats_out.bundle` you received). Ensure the user intends to run `dogs.py` with the `-d` flag. Deltas are not applicable to files marked `(Content:Base64)`."

**Example LLM Task (Full File Output):**
"Refactor all Python functions named `old_func` to `new_func` in the `cats_out.bundle`. If the bundle contains an image `assets/logo.png` that was marked `(Content:Base64)`, preserve it as Base64 in your output. Output the complete modified files in a `dogs_in.bundle` using `🐕 DOGS_` markers, assuming `Raw UTF-8` as the primary text format."

**Example LLM Task (Delta Output for a text file):**
"In `large_text_file.py` from `cats_out.bundle`, replace lines 500-510 with the provided code snippet and insert another snippet after line 600. Output a `dogs_in.bundle` using `🐕 DOGS_` markers and `PAWS_CMD` delta instructions for `large_text_file.py`."

### 3. 🥏🐕 Extract with `dogs.py`

Use `dogs.py` to extract the LLM's output bundle (`dogs_in.bundle`) back into a functional project. Before extraction, `dogs.py` will present a clear summary of its plan. Use `-d <original_bundle>` if the LLM used delta commands for text files.

**Common `dogs.py` Examples:**

```bash
# Extract default 'dogs_in.bundle' to the current directory (.), automatically overwriting existing files
python dogs.py -y .

# Extract 'llm_refactor_output.bundle' into a new directory 'my_project_v2', overwriting existing files
python dogs.py llm_refactor_output.bundle ./my_project_v2 -y

# Apply delta changes from 'llm_delta.bundle', using 'original_codebase.bundle' as the base reference,
# extracting to './project_with_updates' and showing verbose output
python dogs.py llm_delta.bundle ./project_with_updates -v -d original_codebase.bundle

# Extract 'ai_generated_files.bundle' to 'new_feature_branch', skipping any files that already exist
python dogs.py ai_generated_files.bundle ./new_feature_branch -n
```

#### Interactive Overwrite Prompt (`dogs.py`) <a name="interactive-overwrite-prompt-dogspy"></a>

When `dogs.py` is run without the `-y` (yes, overwrite all) or `-n` (no, skip all) flags, and it encounters an existing file in the target output directory, it will prompt you for an action. This allows for fine-grained control over individual file conflicts.

The prompt will look like this: `File 'path/to/existing_file.txt' exists. Overwrite? [y/N/a/s/q]:`

- **`y` (Yes)**: Overwrite the _current_ file. `dogs.py` will then continue to the next file, potentially prompting again.
- **`N` (No / Default)**: **Skip** the _current_ file. The existing file on disk will be left untouched. If you just press Enter, this is the default action. `dogs.py` will then continue to the next file.
- **`a` (Always yes)**: Overwrite the _current_ file and **all subsequent existing files** without further prompting. This is equivalent to running with `-y` from this point onward.
- **`s` (Skip all)**: Skip the _current_ file and **all subsequent existing files** without further prompts. This is equivalent to running with `-n` from this point onward.
- **`q` (Quit)**: **Immediately cancel** the entire extraction process. No more files will be written, and `dogs.py` will exit.

This interactive mode gives you granular control over how `dogs.py` handles conflicts with existing files in your project directory.

_(For Node.js `dogs.js` usage, see `js/README.md`)_

## Comprehensive Delta Workflow Example

This example demonstrates a typical workflow for modifying a Flutter/Dart project (`lib/` directory and `pubspec.yaml`) using `cats.py` to create a reference bundle, LLM interaction to generate changes (including new files, modified files via delta and full rewrite, and implicit file deletions), and `dogs.py` to apply those changes.

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

**Step 1: Bundle with `cats.py` (Create the Original Reference)**

First, you'll bundle your project's relevant files into a `cats` bundle, marking it as a suitable reference for delta operations. This bundle will serve as the "original" when `dogs.py` applies delta changes later.

```bash
# From the 'my_flutter_project' root directory:
python cats.py lib pubspec.yaml -t -o original_flutter_project.bundle
```

This command bundles `lib/` (including all 64 files recursively) and `pubspec.yaml`. The `-t` flag adds `# Delta Reference: Yes` to the bundle header.

---

**Step 2: Interact with an LLM**

Provide the `original_flutter_project.bundle` (potentially with `sys_ant.txt` prepended) to your LLM.
Instruct the LLM to perform changes (e.g., refactor `feature_a`, add a new `feature_c`, remove `feature_b`, update `pubspec.yaml`).
The LLM's response should be a `dogs` bundle, including:

- **New files:** Full content for new files (e.g., `lib/src/feature_c/new_widget.dart`).
- **Deleted files:** Files to be 'deleted' (like `lib/src/feature_b/`) should _not_ be present in the LLM's `dogs` bundle output. `dogs.py` will leave them untouched, requiring the user to manually delete them.
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

**Step 3: Extract with `dogs.py` (Apply Changes)**

Now, use `dogs.py` to apply these changes to your project. You'll specify the LLM's bundle (`dogs_in.bundle`), the target directory (`.`, representing `my_flutter_project/`), and crucially, the original bundle (`original_flutter_project.bundle`) as the `--apply-delta` reference.

```bash
# From the 'my_flutter_project' root directory:
python dogs.py dogs_in.bundle . -y -d original_flutter_project.bundle
```

- `dogs_in.bundle`: This is the bundle generated by the LLM.
- `.`: This specifies the current directory (`my_flutter_project/`) as the output target. `dogs.py` will recreate paths (e.g., `lib/src/feature_c/new_widget.dart`) relative to this.
- `-y`: Automatically overwrites/extracts without prompting (useful for CI/CD or when confident).
- `-d original_flutter_project.bundle`: This is essential. `dogs.py` will read `original_flutter_project.bundle` to get the original content of files like `lib/src/feature_a/widget_a.dart` and `main.dart` before applying the `@@ PAWS_CMD` delta instructions from `dogs_in.bundle`. Files provided as full rewrites (like `pubspec.yaml`, `utils.dart`) or new files (like `lib/src/feature_c/new_widget.dart`) will simply be written directly.

**Resulting Project State (after `dogs.py`):**

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

_Note_: `lib/src/feature_b/` (and its contents) would remain in `my_flutter_project` as `dogs.py` does not delete files by omission. The user would need to manually remove it if desired.

---

This example showcases the full power of the PAWS/SWAP system for complex project modifications involving a mix of new files, detailed line-level changes, full file rewrites, and file removals managed by the user.
````
