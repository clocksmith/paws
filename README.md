# [PAWS](#PAWS): Prepare Artifacts With **SWAP** (Streamlined Write After [PAWS](#PAWS))

**🐾 PAWS** provides simple, dependency-free command-line utilities (`cats.py` and `dogs.py`) to bundle your project files for interaction with Large Language Models (LLMs) and then reconstruct them, for a quick code **💱 SWAP**.
(Node.js versions, `cats.js` and `dogs.js`, offering similar core functionality are available in the `js/` subdirectory; see `js/README.md` for details.)

- **`cats.py`**: Bundles specified project files/directories into a single text artifact.
  - **System Prompt Prepending**: By default, `cats.py` searches for a `sys_human.txt` file (named `SYS_PROMPT_FILENAME` in the script) alongside itself or one directory level up. If found, its content is **prepended** to the output, _before_ the actual Cats Bundle structure. This can be disabled with `--no-sys-prompt`.
  - **CWD `sys_human.txt` Bundling**: By convention, `cats.py` also checks for a file named `sys_human.txt` in the current working directory. If found (and not excluded), it is included as the **first file _within_** the Cats Bundle.
  - It applies default excludes (`.git`, `node_modules/`, `gem/`, `__pycache__`) which can be disabled.
- **`dogs.py`**: Extracts files from such a bundle back into a directory structure. It can apply delta changes specified in the bundle if invoked with the `--apply-delta` flag. The default input bundle name is `dogs_in.bundle`. When applying deltas, the resulting text is encoded according to the text format (`Raw UTF-8` or `Raw UTF-16LE`) specified in the input `dogs` bundle's header.

## Workflow

The primary goal is to enable a seamless workflow for project-wide analysis, refactoring, or content generation by LLMs:

1.  **🧶🐈 Bundle with `cats.py`**:
    Use `cats.py` to package your entire project (or relevant parts) into one text artifact (`cats_out.bundle`).

    **NOTE:** A `sys_human.txt` found near `cats.py` will be automatically prepended. Additionally, a `sys_human.txt` in the current working directory will be bundled as the first file if present and not excluded. It's good practice for the prepended `sys_human.txt` to guide the LLM. Default excludes are applied.

    ```bash
    # Bundle current dir, excluding defaults AND custom dir 'dist' (Python)
    python cats.py . -x dist -o my_project_context.bundle

    # Bundle current dir, but DO NOT use default excludes (Python)
    python cats.py . -N -o my_project_context.bundle

    # Bundle, but do NOT prepend the script-sibling sys_human.txt (Python)
    python cats.py . --no-sys-prompt -o my_project_context.bundle
    ```

    _(For Node.js `cats.js` usage, see `js/README.md`)_

2.  **Interact with an LLM**:
    Provide this bundle (`cats_out.bundle`) to an LLM. Give clear instructions:

    - **Understand Input**: "The very first part of this input, before any `--- CATS_START_FILE ---` or `--- DOGS_START_FILE ---` markers, is a system prompt/guide that you MUST adhere to. Following that, there is a bundle of files. Each file in the bundle starts with `🐈 --- CATS_START_FILE: path/to/file.ext ---` (or `🐕 --- DOGS_START_FILE: ... ---` if processed) and ends with the corresponding `END_FILE` marker. The first file _within_ the bundle may be `sys_human.txt` providing project-specific context, distinct from the initial system prompt."
    - **Note Encoding**: "The bundle (after the initial system prompt, if any) will have a header like `# Cats Bundle` or `# Dogs Bundle`. Its first lines might include a `# Format: ...` (e.g., `Raw UTF-8`, `Raw UTF-16LE`, `Base64`). Respect this encoding for modifications. UTF-8 is the default for text."
    - **Preserve/Use Markers**:
      - "**VERY IMPORTANT: Only modify content _between_ the start and end file markers.**"
      - "**Use `🐕 --- DOGS_START_FILE: path/to/your/file.ext ---` and `🐕 --- DOGS_END_FILE ---` for each file you output.** This helps the `dogs` utility parse your output most reliably."
      - "Do NOT alter the original `🐈 CATS_START_FILE` / `🐈 CATS_END_FILE` markers or any `# Format:` headers if you are only making minor changes _within_ existing file blocks of an input bundle."
    - **Maintain Encoding**: "If the bundle format is Base64, your output must be valid Base64. If Raw UTF-8 or Raw UTF-16LE, ensure valid text in that encoding for all content between your `🐕 DOGS_` markers."
    - **New Files**: "For new files, use `🐕 DOGS_START_FILE: path/to/new_file.ext ---`, its full content, then `🐕 DOGS_END_FILE ---`. Use relative paths with forward slashes `/`."
    - **Delta Changes (Optional, for `dogs.py --apply-delta`):** "If modifying large existing files, you can specify changes using delta commands within the `🐕 DOGS_` block. Use `@@ PAWS_CMD REPLACE_LINES(start, end) @@`, `@@ PAWS_CMD INSERT_AFTER_LINE(line_num) @@`, or `@@ PAWS_CMD DELETE_LINES(start, end) @@`. These refer to 1-based line numbers in the _original_ file (from `cats_out.bundle`). Ensure the user intends to run `dogs.py` with the `-d` flag."

    **Example LLM Task (Full File Output):**
    "Refactor all Python functions named `old_func` to `new_func` in the `cats_out.bundle`. Output the complete modified files in a `dogs_in.bundle` using `🐕 DOGS_` markers, assuming `Raw UTF-8`."

    **Example LLM Task (Delta Output):**
    "In `large_file.py` from `cats_out.bundle`, replace lines 500-510 with the provided code snippet and insert another snippet after line 600. Output a `dogs_in.bundle` using `🐕 DOGS_` markers and `PAWS_CMD` delta instructions for `large_file.py`."

3.  **🥏🐕 Extract with `dogs.py`**:
    Use `dogs.py` to extract the LLM's output bundle (`dogs_in.bundle`) back into a functional project. Use `-d <original_bundle>` if the LLM used delta commands.

    ```bash
    # Extract full file contents from dogs_in.bundle (Python)
    python dogs.py dogs_in.bundle ./project_v2 -y

    # Apply delta changes from dogs_in.bundle using cats_out.bundle as reference (Python)
    python dogs.py dogs_in.bundle ./project_v2 -y -d cats_out.bundle
    ```

    _(For Node.js `dogs.js` usage, see `js/README.md`)_

## Key Features `cats.py`/`dogs.py`

- **Comprehensive Context:** Bundles multiple files and directories.
- **Dual `sys_human.txt` Handling (`cats.py`):**
  - Automatically **prepends** a `sys_human.txt` found near the script (configurable with `--no-sys-prompt`, `--require-sys-prompt`).
  - Automatically **bundles** a `sys_human.txt` from CWD as the first file if present and not excluded.
- **Default Excludes (`cats.py`):** Automatically excludes `.git`, `node_modules/`, `gem/`, `__pycache__`. Disable with `-N`.
- **Robust Exclusion (`cats.py`):** Precisely exclude additional files/directories.
- **Encoding Options (`cats.py`):** Handles UTF-8 (default), UTF-16LE. Auto-switches to Base64 for binary content unless text encoding is forced (`-E`).
- **Clear Bundle Structure:** Includes format headers and `🐈`/`🐕` file markers.
- **Safe Extraction (`dogs.py`):** Sanitizes paths, prevents traversal.
- **Delta Application (`dogs.py`):** Applies line-based changes using `--apply-delta (-d)` flag and `@@ PAWS_CMD [...] @@` syntax. Output from deltas respects the `dogs` bundle's declared text encoding.
- **Overwrite Control (`dogs.py`):** User control over overwriting existing files (`-y`, `-n`, prompt).

## `cats.py` - Bundling your source code 🧶🐈

**Command Syntax:**

```bash
python cats.py [PATH...] [options]
```

**Key Options:**

- `paths` (required): Files or directories to bundle.
- `-o BUNDLE_FILE`, `--output BUNDLE_FILE`: Output bundle name (default: `cats_out.bundle`). Use `-` for stdout.
- `-x EXCLUDE_PATH`, `--exclude EXCLUDE_PATH`: Path to exclude (multiple allowed). Applied _in addition_ to default excludes.
- `-N`, `--no-default-excludes`: Disable default excludes.
- `-E {auto,utf8,utf16le,b64}`, `--force-encoding {auto,utf8,utf16le,b64}`: Force bundle encoding (default: `auto`).
- `--no-sys-prompt`: Do not prepend the `sys_human.txt` found near the script.
- `--require-sys-prompt`: Exit with error if system prompt prepending is attempted but `sys_human.txt` is not found/readable.
- `-y`, `--yes`: Auto-confirm bundling process.
- `-h`, `--help`: Show help.

**`cats.py` Examples:**

1.  **Bundle current directory, using default excludes, output to default `cats_out.bundle`:**
    ```bash
    python cats.py .
    ```
2.  **Bundle src, exclude tests, disable default excludes, force UTF-16LE:**
    ```bash
    python cats.py ./src -x ./src/tests -N -E utf16le -o app_utf16.bundle
    ```

_(For `node cats.js` CLI options and examples, see `js/README.md`)_

## `dogs.py` - Reconstructing from a bundle 🥏🐕

**Command Syntax:**

```bash
python dogs.py [BUNDLE_FILE] [OUTPUT_DIR] [options]
```

**Key Options:**

- `bundle_file` (optional): Bundle to extract (default: `dogs_in.bundle` if exists, else error).
- `output_directory` (optional): Where to extract (default: current directory `./`).
- `-d ORIGINAL_BUNDLE`, `--apply-delta ORIGINAL_BUNDLE`: Apply delta commands found in `bundle_file`, using `ORIGINAL_BUNDLE` as the reference.
- `-i {auto,b64,utf8,utf16le}`, `--input-format {auto,b64,utf8,utf16le}`: Override bundle format detection.
- `-y`, `--yes`: Overwrite existing files without asking.
- `-n`, `--no`: Skip overwriting existing files without asking.
- `-v`, `--verbose`: Enable verbose logging.
- `-h`, `--help`: Show help.

**`dogs.py` Examples:**

1.  **Extract default `dogs_in.bundle` to `./output`, auto-overwrite:**
    ```bash
    python dogs.py -y ./output  # Assuming dogs_in.bundle exists
    # OR python dogs.py dogs_in.bundle ./output -y
    ```
2.  **Apply deltas from `llm_delta.bundle` using `project_v1.bundle` as base, verbose:**
    ```bash
    python dogs.py llm_delta.bundle ./project_v2 -v -d project_v1.bundle
    ```

_(For `node dogs.js` CLI options and examples, see `js/README.md`)_

## Library Usage (Python)

```python
# --- Using cats.py as a library ---
from cats import create_bundle_from_paths, find_sys_prompt_path_for_prepending, SYS_PROMPT_POST_SEPARATOR

# Example: Prepending system prompt manually (if not relying on default behavior of main_cli)
# prepended_sys_prompt_content = ""
# sys_prompt_path_to_prepend = find_sys_prompt_path_for_prepending()
# if sys_prompt_path_to_prepend:
#     with open(sys_prompt_path_to_prepend, "r", encoding="utf-8") as f_prompt:
#         prepended_sys_prompt_content = f_prompt.read().rstrip('\\n') + '\\n' + SYS_PROMPT_POST_SEPARATOR

# paths_to_bundle = ['./src', 'config.json']
# bundle_str, fmt_desc, files_count = create_bundle_from_paths(
#     include_paths_raw=paths_to_bundle,
#     exclude_paths_raw=['./src/temp'],
#     encoding_mode='auto',
#     # sys_human_abs_realpath_to_include can be set to path of CWD sys_human.txt
# )
# full_output = prepended_sys_prompt_content + bundle_str # Combine if needed
# if files_count > 0:
#     print(f"Python bundle created ({fmt_desc}), {files_count} files. Preview available.")

# --- Using dogs.py as a library ---
from dogs import extract_bundle_from_string, extract_bundle_to_memory

# # Option 1: Extract to disk (potentially applying deltas)
# results_disk = extract_bundle_from_string(
#     bundle_path="path/to/dogs_in.bundle",
#     output_dir_base="./py_lib_extracted",
#     overwrite_policy="yes",
#     # apply_delta_from_original_bundle="path/to/cats_out.bundle",
#     # verbose_logging=True
# )
# for res in results_disk:
#     print(f"Disk Op: Path: {res.get('path', 'N/A')}, Status: {res['status']}, Msg: {res.get('message', '')}")

# # Option 2: Extract/parse to memory (does not apply deltas)
# parsed_files_mem = extract_bundle_to_memory(
#     bundle_path="path/to/dogs_in.bundle",
#     # verbose_logging=True
# )
# for pf in parsed_files_mem:
#     if pf.get('content_bytes') is not None:
#       print(f"Mem Op: Path: {pf['path_in_bundle']}, Size: {len(pf['content_bytes'])}")
#     elif pf.get('delta_commands') is not None:
#       print(f"Mem Op: Path: {pf['path_in_bundle']}, Deltas: {len(pf['delta_commands'])} commands")

```

_(For Node.js library usage, see `js/README.md`)_

---

This utility aims for simplicity and robustness in bridging your codebase with LLMs, now with enhanced flexibility for encoding and targeted modifications.
