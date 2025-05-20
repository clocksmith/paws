# 🐾 PAWS: Prepare Artifacts With SWAP (Streamlined Write After PAWS)

**PAWS** provides simple, dependency-free command-line utilities (`cats.py` and `dogs.py`) to bundle your project files for interaction with Large Language Models (LLMs) and then reconstruct them, for a quick code **💱 SWAP**.

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
- [Key Features `cats.py`/`dogs.py`](#key-features-catspydogspy)
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

Bundles specified project files/directories into a single text artifact.

- **System Prompt Prepending**: By default, `cats.py` searches for a `sys_ant.txt` file (named `SYS_PROMPT_FILENAME` in the script, currently `sys_ant.txt`) alongside itself or one directory level up. If found, its content is **prepended** to the output, _before_ the actual Cats Bundle structure. This can be disabled with `--no-sys-prompt`.
- **CWD `sys_ant.txt` (or user context file) Bundling**: By convention, `cats.py` also checks for a file named `sys_ant.txt` (or a similar user-provided context file, as defined by `SYS_PROMPT_FILENAME` in the script) in the current working directory. If found (and not excluded), it is included as the **first file _within_** the Cats Bundle.
- **Mixed Content Handling**: `cats.py` intelligently handles mixed content. Text files (e.g., source code) are bundled as raw text (typically UTF-8). Binary files (e.g., images) are Base64 encoded within their respective file blocks, and their start markers will include a `(Content:Base64)` hint (e.g., `🐈 --- CATS_START_FILE: assets/logo.png (Content:Base64) ---`). This allows for efficient bundling of diverse project assets.
- It applies default excludes (`.git`, `node_modules/`, `gem/`, `__pycache__`) which can be disabled.

### `dogs.py` <a name="dogspy-description"></a>

Extracts files from such a bundle back into a directory structure.

- It correctly decodes text and Base64-encoded binary files based on bundle headers and per-file markers.
- It can apply delta changes specified in the bundle if invoked with the `--apply-delta` flag (deltas apply to text-based files).
- The default input bundle name is `dogs_in.bundle`.
- When applying deltas, the resulting text is encoded according to the text format (`Raw UTF-8` or `Raw UTF-16LE`) specified in the input `dogs` bundle's header.

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

**NOTE:** A `sys_ant.txt` (or the file specified by `SYS_PROMPT_FILENAME` in `cats.py`) found near `cats.py` will be automatically prepended. Additionally, a `sys_ant.txt` (or `SYS_PROMPT_FILENAME`) in the current working directory will be bundled as the first file if present and not excluded. It's good practice for the prepended system prompt to guide the LLM. Default excludes are applied.

```bash
# Bundle current dir, excluding defaults AND custom dir 'dist' (Python)
python cats.py . -x dist -o my_project_context.bundle

# Bundle current dir, but DO NOT use default excludes (Python)
python cats.py . -N -o my_project_context.bundle

# Bundle, but do NOT prepend the script-sibling sys_ant.txt (Python)
python cats.py . --no-sys-prompt -o my_project_context.bundle
```

_(For Node.js `cats.js` usage, see `js/README.md`)_

### 2. Interact with an LLM

Provide this bundle (`cats_out.bundle`) to an LLM. Give clear instructions:

> - **Understand Input**: "The very first part of this input, before any `--- CATS_START_FILE ---` or `--- DOGS_START_FILE ---` markers, is a system prompt/guide that you MUST adhere to. Following that, there is a bundle of files. Each file in the bundle starts with `🐈 --- CATS_START_FILE: path/to/file.ext ---` (or `🐕 --- DOGS_START_FILE: ... ---` if processed) and ends with the corresponding `END_FILE` marker. The first file _within_ the bundle may be `sys_ant.txt` (or a similar context file) providing project-specific context, distinct from the initial system prompt."
> - **Note Encoding**: "The bundle (after the initial system prompt, if any) will have a header like `# Cats Bundle` or `# Dogs Bundle`. Its first lines might include a `# Format: ...` (e.g., `Raw UTF-8`, `Raw UTF-16LE`, `Base64`). This **global format** dictates the primary encoding for text files within the bundle. However, individual files (typically binaries like images) may be Base64 encoded regardless of the global format, and these will be explicitly indicated by `(Content:Base64)` in their start marker. Your output for a file marked `(Content:Base64)` must also be Base64. For all other (text) files, adhere to the bundle's global text format (e.g., UTF-8 or UTF-16LE)."
> - **Preserve/Use Markers**:
>   - "**VERY IMPORTANT: Only modify content _between_ the start and end file markers.**"
>   - "**Use `🐕 --- DOGS_START_FILE: path/to/your/file.ext ---` and `🐕 --- DOGS_END_FILE ---` for each file you output.** If outputting binary data (like an image) within a text-primary bundle, use `🐕 --- DOGS_START_FILE: path/to/your/file.bin (Content:Base64) ---`. This helps the `dogs` utility parse your output most reliably."
>   - "Do NOT alter the original `🐈 CATS_START_FILE` / `🐈 CATS_END_FILE` markers or any `# Format:` headers if you are only making minor changes _within_ existing file blocks of an input bundle."
> - **Maintain Encoding**: "If a file block is marked `(Content:Base64)`, your output for that file must be valid Base64. For other files, ensure valid text in the bundle's primary text encoding (e.g., UTF-8 or UTF-16LE) for all content between your `🐕 DOGS_` markers."
> - **New Files**: "For new text files, use `🐕 DOGS_START_FILE: path/to/new_file.ext ---`, its full content, then `🐕 DOGS_END_FILE ---`. For new binary files, use `🐕 DOGS_START_FILE: path/to/new_file.bin (Content:Base64) ---`, its full Base64 content, then `🐕 DOGS_END_FILE ---`. Use relative paths with forward slashes `/`."
> - **Delta Changes (Optional, for `dogs.py --apply-delta` on text files):** "If modifying large existing _text_ files, you can specify changes using delta commands within the `🐕 DOGS_` block. Use `@@ PAWS_CMD REPLACE_LINES(start, end) @@`, `@@ PAWS_CMD INSERT_AFTER_LINE(line_num) @@`, or `@@ PAWS_CMD DELETE_LINES(start, end) @@`. These refer to 1-based line numbers in the _original_ file (from `cats_out.bundle`). Ensure the user intends to run `dogs.py` with the `-d` flag. Deltas are not applicable to files marked `(Content:Base64)`."

**Example LLM Task (Full File Output):**
"Refactor all Python functions named `old_func` to `new_func` in the `cats_out.bundle`. If the bundle contains an image `assets/logo.png` that was marked `(Content:Base64)`, preserve it as Base64 in your output. Output the complete modified files in a `dogs_in.bundle` using `🐕 DOGS_` markers, assuming `Raw UTF-8` as the primary text format."

**Example LLM Task (Delta Output for a text file):**
"In `large_text_file.py` from `cats_out.bundle`, replace lines 500-510 with the provided code snippet and insert another snippet after line 600. Output a `dogs_in.bundle` using `🐕 DOGS_` markers and `PAWS_CMD` delta instructions for `large_text_file.py`."

### 3. 🥏🐕 Extract with `dogs.py`

Use `dogs.py` to extract the LLM's output bundle (`dogs_in.bundle`) back into a functional project. Use `-d <original_bundle>` if the LLM used delta commands for text files.

```bash
# Extract full file contents from dogs_in.bundle (Python)
python dogs.py dogs_in.bundle ./project_v2 -y

# Apply delta changes from dogs_in.bundle using cats_out.bundle as reference (Python)
python dogs.py dogs_in.bundle ./project_v2 -y -d cats_out.bundle
```

_(For Node.js `dogs.js` usage, see `js/README.md`)_

## Key Features `cats.py`/`dogs.py`

- **Comprehensive Context:** Bundles multiple files and directories.
- **Dual `sys_ant.txt` (or `SYS_PROMPT_FILENAME`) Handling (`cats.py`):**
  - Automatically **prepends** a `sys_ant.txt` (or `SYS_PROMPT_FILENAME`) found near the script (configurable with `--no-sys-prompt`, `--require-sys-prompt`).
  - Automatically **bundles** a `sys_ant.txt` (or `SYS_PROMPT_FILENAME`) from CWD as the first file if present and not excluded.
- **Default Excludes (`cats.py`):** Automatically excludes `.git`, `node_modules/`, `gem/`, `__pycache__`. Disable with `-N`.
- **Robust Exclusion (`cats.py`):** Precisely exclude additional files/directories.
- **Flexible Encoding (`cats.py`):**
  - **`auto` mode (default):** Bundles text files as UTF-8 (or UTF-16LE if all text files are consistently that). Binary files (e.g., images) are automatically Base64 encoded and marked with `(Content:Base64)` in their start file marker. The bundle header reflects the primary text encoding (e.g., `# Format: Raw UTF-8 (with potential Base64 blocks)`).
  - **`--force-encoding {utf8|utf16le}`:** Forces all _textual_ content to the specified encoding. Binary files are still Base64 encoded and marked.
  - **`--force-encoding b64`:** Forces _all_ content (text and binary) to be Base64 encoded.
- **Clear Bundle Structure:** Includes format headers and `🐈`/`🐕` file markers, with optional per-file Base64 indicators.
- **Safe Extraction (`dogs.py`):** Sanitizes paths, prevents traversal. Correctly decodes mixed text/Base64 content.
- **Delta Application (`dogs.py`):** Applies line-based changes to _text files_ using `--apply-delta (-d)` flag and `@@ PAWS_CMD [...] @@` syntax. Output from deltas respects the `dogs` bundle's declared text encoding.
- **Overwrite Control (`dogs.py`):** User control over overwriting existing files (`-y`, `-n`, prompt).

## `cats.py` - Bundling your source code 🧶🐈

### Command Syntax (`cats.py`)

```bash
python cats.py [PATH...] [options]
```

### Key Options (`cats.py`)

- **`paths`** (required): Files or directories to bundle.
- **`-o BUNDLE_FILE, --output BUNDLE_FILE`**: Output bundle name (default: `cats_out.bundle`). Use `-` for stdout.
- **`-x EXCLUDE_PATH, --exclude EXCLUDE_PATH`**: Path to exclude (multiple allowed). Applied in addition to default excludes.
- **`-N, --no-default-excludes`**: Disable default excludes.
- **`-E {auto,utf8,utf16le,b64}, --force-encoding {auto,utf8,utf16le,b64}`**: Set bundle encoding strategy (default: `auto`).
  - `auto`: Detects text encoding (UTF-8/UTF-16LE). Binary files become Base64 marked blocks.
  - `utf8`/`utf16le`: Text files conform to this; binary files become Base64 marked blocks.
  - `b64`: All files are Base64 encoded.
- **`--no-sys-prompt`**: Do not prepend the `sys_ant.txt` (or `SYS_PROMPT_FILENAME`) found near the script.
- **`--require-sys-prompt`**: Exit with error if system prompt prepending is attempted but `sys_ant.txt` (or `SYS_PROMPT_FILENAME`) is not found/readable.
- **`-y, --yes`**: Auto-confirm bundling process.
- **`-h, --help`**: Show help.

### `cats.py` Examples

Bundle current directory (mixed text/binary), using default excludes, output to default `cats_out.bundle`:

```bash
python cats.py .
```

Bundle `src`, exclude `tests`, disable default excludes, force all text to UTF-16LE (binaries still Base64):

```bash
python cats.py ./src -x ./src/tests -N -E utf16le -o app_mixed.bundle
```

_(For Node.js `cats.js` CLI options and examples, see `js/README.md`)_

## `dogs.py` - Reconstructing from a bundle 🥏🐕

### Command Syntax (`dogs.py`)

```bash
python dogs.py [BUNDLE_FILE] [OUTPUT_DIR] [options]
```

### Key Options (`dogs.py`)

- **`bundle_file`** (optional): Bundle to extract (default: `dogs_in.bundle` if exists, else error).
- **`output_directory`** (optional): Where to extract (default: current directory `./`).
- **`-d ORIGINAL_BUNDLE, --apply-delta ORIGINAL_BUNDLE`**: Apply delta commands (for text files) found in `bundle_file`, using `ORIGINAL_BUNDLE` as the reference.
- **`-i {auto,b64,utf8,utf16le}, --input-format {auto,b64,utf8,utf16le}`**: Override bundle format detection for the primary text encoding. `dogs.py` will still handle per-file `(Content:Base64)` markers.
- **`-y, --yes`**: Overwrite existing files without asking.
- **`-n, --no`**: Skip overwriting existing files without asking.
- **`-v, --verbose`**: Enable verbose logging.
- **`-h, --help`**: Show help.

### `dogs.py` Examples

Extract default `dogs_in.bundle` (may contain mixed text/Base64 files) to `./output`, auto-overwrite:

```bash
python dogs.py -y ./output
```

Apply deltas from `llm_delta.bundle` using `project_v1.bundle` as base, verbose:

```bash
python dogs.py llm_delta.bundle ./project_v2 -v -d project_v1.bundle
```

_(For Node.js `dogs.js` CLI options and examples, see `js/README.md`)_

## Library Usage (Python)

```python
# from cats import create_bundle_from_paths_api
# from dogs import extract_bundle_from_string_api, extract_bundle_to_memory_api

# Example using cats.py as a library
# paths_to_bundle = ['./src', 'assets/image.png']
# bundle_string, format_description, num_files, bundle_encoding = create_bundle_from_paths_api(
#     include_paths_raw=paths_to_bundle,
#     exclude_paths_raw=['./src/tmp'],
#     encoding_mode='auto'
# )
# if num_files > 0:
#     print(f"Bundle created ({format_description}), {num_files} files. Encoding: {bundle_encoding}")
#     # with open("my_lib_bundle.txt", "w", encoding=bundle_encoding) as f:
#     #     f.write(bundle_string) # Prepending sys_ant.txt would be manual here

# Example using dogs.py as a library
# with open("llm_output.bundle", "r", encoding="utf-8") as f:
#     llm_bundle_content = f.read()

# # To disk
# disk_results = extract_bundle_from_string_api(
#     bundle_content_str=llm_bundle_content,
#     output_dir_base_str="./extracted_project",
#     overwrite_policy="yes",
#     # apply_delta_from_original_bundle_path_str="original_cats_bundle.txt"
# )
# for res in disk_results: print(res)

# # To memory
# memory_files = extract_bundle_to_memory_api(bundle_content_str=llm_bundle_content)
# for mf in memory_files:
#     print(f"Path: {mf['path_in_bundle']}, Decoded as: {mf['format_used_for_decode']}")
#     if mf.get('content_bytes'):
#         # print(f"  Content sample: {mf['content_bytes'][:50]}")
#         pass
#     elif mf.get('delta_commands'):
#         # print(f"  Delta commands: {len(mf['delta_commands'])}")
#         pass
```

_(For Node.js library usage, see `js/README.md`)_

This utility aims for simplicity and robustness in bridging your codebase with LLMs, now with enhanced flexibility for encoding, mixed content handling, and targeted modifications.
