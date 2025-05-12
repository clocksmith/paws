# PAWS: Prepare Artifacts With SWAP (Streamlined Write After PAWS)

PAWS provides simple, dependency-free command-line utilities (`cats` and `dogs`) to bundle your project files for interaction with Large Language Models (LLMs) and then reconstruct them, for a quick code SWAP. The tools are available in both Python and Node.js, offering nearly identical command-line APIs and behavior for their core bundling and extraction tasks.

- **`cats`**: Bundles specified project files/directories into a single text artifact. **By convention, `cats` will also automatically include a file named `sys_human.txt` if it exists in the current working directory**, prepending it to the bundle. It applies default excludes (`.git`, `node_modules/`, `gem/`, `__pycache__`) which can be disabled.
- **`dogs`**: Extracts files from such a bundle back into a directory structure. It can apply delta changes specified in the bundle if invoked with the `--apply-delta` flag. The default input bundle name is `dogs_in.bundle`.

## Core Idea & LLM Workflow

The primary goal is to enable a seamless workflow for project-wide analysis, refactoring, or content generation by LLMs:

1.  **Bundle with `cats`**:
    Use `cats` to package your entire project (or relevant parts) into one text artifact (`cats_out.bundle`).

    **NOTE:** Although `sys_human.txt` will be included automatically if present, its good practice to add to system prompt. Default excludes are applied.

    ```bash
    # Bundle current dir, excluding defaults AND custom dir 'dist'
    # python cats.py . -x dist -o my_project_context.bundle
    # node cats.js . -x dist -o my_project_context.bundle

    # Bundle current dir, but DO NOT use default excludes
    # python cats.py . -N -o my_project_context.bundle
    # node cats.js . -N -o my_project_context.bundle
    ```

3.  **Interact with LLM**:
    Provide this bundle (`cats_out.bundle`) to an LLM. Give clear instructions:

    - **Identify Structure**: "This is a bundle of files. Each file starts with `🐈 --- CATS_START_FILE: path/to/file.ext ---` (or `🐕 --- DOGS_START_FILE: ... ---` if processed) and ends with the corresponding `END_FILE` marker. The first file may be `sys_human.txt` providing context."
    - **Note Encoding**: "The bundle's first lines might include a `# Format: ...` header (e.g., `Raw UTF-8`, `Raw UTF-16LE`, `Base64`). Respect this encoding for modifications. UTF-8 is the default for text."
    - **Preserve/Use Markers**:
      - "**VERY IMPORTANT: Only modify content _between_ the start and end file markers.**"
      - "**Use `🐕 --- DOGS_START_FILE: path/to/your/file.ext ---` and `🐕 --- DOGS_END_FILE ---` for each file you output.** This helps the `dogs` utility parse your output most reliably."
      - "Do NOT alter the original `🐈 CATS_START_FILE` / `🐈 CATS_END_FILE` markers or any `# Format:` headers if you are only making minor changes _within_ existing file blocks of an input bundle."
    - **Maintain Encoding**: "If the bundle format is Base64, your output must be valid Base64. If Raw UTF-8 or Raw UTF-16LE, ensure valid text in that encoding."
    - **New Files**: "For new files, use `🐕 DOGS_START_FILE: path/to/new_file.ext ---`, its full content, then `🐕 DOGS_END_FILE ---`. Use relative paths with forward slashes `/`."
    - **Delta Changes (Optional, for `dogs --apply-delta`):** "If modifying large existing files, you can specify changes using delta commands within the `🐕 DOGS_` block. Use `@@ PAWS_CMD REPLACE_LINES(start, end) @@`, `@@ PAWS_CMD INSERT_AFTER_LINE(line_num) @@`, or `@@ PAWS_CMD DELETE_LINES(start, end) @@`. These refer to 1-based line numbers in the *original* file (from `cats_out.bundle`). Ensure the user intends to run `dogs` with the `-d` flag."

    **Example LLM Task (Full File Output):**
    "Refactor all Python functions named `old_func` to `new_func` in the `cats_out.bundle`. Output the complete modified files in a `dogs_in.bundle` using `🐕 DOGS_` markers, assuming `Raw UTF-8`."

    **Example LLM Task (Delta Output):**
    "In `large_file.py` from `cats_out.bundle`, replace lines 500-510 with the provided code snippet and insert another snippet after line 600. Output a `dogs_in.bundle` using `🐕 DOGS_` markers and `PAWS_CMD` delta instructions for `large_file.py`."

4.  **Extract with `dogs`**:
    Use `dogs` to extract the LLM's output bundle (`dogs_in.bundle`) back into a functional project. Use `-d <original_bundle>` if the LLM used delta commands.

    ```bash
    # Extract full file contents from dogs_in.bundle
    # python dogs.py dogs_in.bundle ./project_v2 -y
    # node dogs.js dogs_in.bundle ./project_v2 -y

    # Apply delta changes from dogs_in.bundle using cats_out.bundle as reference
    # python dogs.py dogs_in.bundle ./project_v2 -y -d cats_out.bundle
    # node dogs.js dogs_in.bundle ./project_v2 -y -d cats_out.bundle
    ```

## Key Features

- **Comprehensive Context:** Bundles multiple files and directories.
- **Automatic `sys_human.txt` Inclusion (`cats`):** Prepended if exists in CWD and not excluded.
- **Default Excludes (`cats`):** Automatically excludes `.git`, `node_modules/`, `gem/`, `__pycache__`. Disable with `-N`.
- **Robust Exclusion (`cats`):** Precisely exclude additional files/directories.
- **Encoding Options (`cats`):** Handles UTF-8 (default), UTF-16LE. Auto-switches to Base64 for binary content unless text encoding is forced (`-E`).
- **Clear Bundle Structure:** Includes format headers and `🐈`/`🐕` file markers.
- **Safe Extraction (`dogs`):** Sanitizes paths, prevents traversal.
- **Delta Application (`dogs`):** Applies line-based changes using `--apply-delta (-d)` flag and `@@ PAWS_CMD [...] @@` syntax.
- **Overwrite Control (`dogs`):** User control over overwriting existing files (`-y`, `-n`, prompt).
- **Python `dogs.py` Power:** Advanced heuristic parsing for LLM outputs, plus robust delta application.
- **Node.js `dogs.js`:** Parses strict `🐕`/`🐈` markers and implements delta application.

## `cats` - Bundling Your Project

**Command Syntax (Nearly Identical for Python/Node.js):**

```bash
python cats.py [PATH...] [options]
node cats.js [PATH...] [options]
```

**Key Options:**

- `paths` (required): Files or directories to bundle.
- `-o BUNDLE_FILE`, `--output BUNDLE_FILE`: Output bundle name (default: `cats_out.bundle`).
- `-x EXCLUDE_PATH`, `--exclude EXCLUDE_PATH`: Path to exclude (multiple allowed). Applied *in addition* to default excludes.
- `-N`, `--no-default-excludes`: Disable default excludes (`.git`, `node_modules/`, `gem/`, `__pycache__`).
- `-E {auto,utf8,utf16le,b64}`, `--force-encoding {auto,utf8,utf16le,b64}`: Force bundle encoding (default: `auto` detects text/binary, preferring UTF-8 for text).
- `-y`, `--yes`: Auto-confirm bundling process.
- `-v`, `--verbose` (Node.js `cats.js` only; Python `cats.py` logs by default): Enable verbose logging.
- `-h`, `--help`: Show help.

**`cats` Examples:**

1.  **Bundle current directory, using default excludes, output to default `cats_out.bundle`:**
    ```bash
    python cats.py .
    node cats.js .
    ```
2.  **Bundle src, exclude tests, disable default excludes, force UTF-16LE:**
    ```bash
    python cats.py ./src -x ./src/tests -N -E utf16le -o app_utf16.bundle
    node cats.js ./src -x ./src/tests -N -E utf16le -o app_utf16.bundle
    ```

## `dogs` - Reconstructing from a Bundle

**Command Syntax (Identical for Python/Node.js):**

```bash
python dogs.py [BUNDLE_FILE] [OUTPUT_DIR] [options]
node dogs.js [BUNDLE_FILE] [OUTPUT_DIR] [options]
```

**Key Options:**

- `bundle_file` (optional): Bundle to extract (default: `dogs_in.bundle` if exists, else error).
- `output_directory` (optional): Where to extract (default: current directory `./`).
- `-d ORIGINAL_BUNDLE`, `--apply-delta ORIGINAL_BUNDLE`: Apply delta commands found in `bundle_file`, using `ORIGINAL_BUNDLE` (e.g., `cats_out.bundle`) as the reference for original line numbers.
- `-i {auto,b64,utf8,utf16le}`, `--input-format {auto,b64,utf8,utf16le}`: Override bundle format detection.
- `-y`, `--yes`: Overwrite existing files without asking.
- `-n`, `--no`: Skip overwriting existing files without asking (if not `-y`, behavior depends on interactivity).
- `-v`, `--verbose`: Enable verbose logging during parsing/extraction/delta application.
- `-h`, `--help`: Show help.

**`dogs` Examples:**

1.  **Extract default `dogs_in.bundle` to `./output`, auto-overwrite:**
    ```bash
    python dogs.py -y -o ./output
    node dogs.js -y -o ./output
    ```
2.  **Apply deltas from `llm_delta.bundle` using `project_v1.bundle` as base, verbose (Python):**
    ```bash
    python dogs.py llm_delta.bundle ./project_v2 -v -d project_v1.bundle
    ```
3.  **Extract specific bundle, forcing Base64 interpretation (Node.js):**
    ```bash
    node dogs.js needs_b64_decode.bundle ./extracted_stuff -i b64 -v
    ```

## Library Usage

### Python (`cats.py`, `dogs.py`)

```python
# --- Using cats.py as a library ---
from cats import create_bundle_from_paths

# paths_to_bundle = ['./src', 'config.json']
# # Default excludes applied automatically unless use_default_excludes=False
# bundle_str, fmt_desc, files_count = create_bundle_from_paths(
#     include_paths_raw=paths_to_bundle,
#     exclude_paths_raw=['./src/temp'], # Additional excludes
#     encoding_mode='auto', # 'auto', 'utf8', 'utf16le', 'b64'
#     # use_default_excludes=True, # Default
#     # sys_human_abs_realpath_to_include=None # Auto-handled from CWD by default
# )
# if files_count > 0:
#     print(f"Python bundle created ({fmt_desc}), {files_count} files. Preview:\n{bundle_str[:300]}...")

# --- Using dogs.py as a library ---
from dogs import extract_bundle_from_string, extract_bundle_to_memory

# # Option 1: Extract to disk (potentially applying deltas)
# results_disk = extract_bundle_from_string(
#     bundle_path="path/to/dogs_in.bundle", # Can provide path or content
#     output_dir_base="./py_lib_extracted",
#     overwrite_policy="yes", # "yes", "no", or "prompt"
#     # apply_delta_from_original_bundle="path/to/cats_out.bundle", # Optional path to original bundle
#     # input_format_override=None, # "b64", "utf8", "utf16le"
#     # verbose_logging=True
# )
# for res in results_disk:
#     print(f"Disk Op: Path: {res.get('path', 'N/A')}, Status: {res['status']}, Msg: {res.get('message', '')}")

# # Option 2: Extract/parse to memory (does not apply deltas)
# parsed_files_mem = extract_bundle_to_memory(
#     bundle_path="path/to/dogs_in.bundle",
#     # input_format_override=None,
#     # verbose_logging=True
# )
# for pf in parsed_files_mem:
#     print(f"Mem Op: Path: {pf['path_in_bundle']}, Size: {len(pf['content_bytes'])}")

```

### Node.js (`cats.js`, `dogs.js`)

```javascript
// --- Using cats.js (Node.js) as a library ---
// const { bundleFromPathsNode } = require("./cats.js"); // CJS
// // import { bundleFromPathsNode } from "./cats.js"; // ESM

// async function catNodeLibExample() {
//   try {
//     const includePaths = ["./src", "package.json"]; // sys_human.txt handled automatically
//     const { bundleString, formatDescription, filesAdded } =
//       await bundleFromPathsNode({
//         includePaths: includePaths,
//         excludePaths: ["./src/node_modules"], // Added to default excludes
//         // useDefaultExcludes: true, // Default
//         // encodingMode: 'auto', // 'auto', 'utf8', 'utf16le', 'b64'
//         // originalUserPaths: ["./src", "package.json"], // Match user-specified paths
//         // verbose: true,
//       });
//     if (filesAdded > 0) {
//       console.log(
//         `Node.js bundle created (${formatDescription}), ${filesAdded} files. Preview:\n${bundleString.substring(0,300)}...`
//       );
//     }
//   } catch (err) { console.error("Error:", err); }
// }
// // catNodeLibExample();

// --- Using dogs.js (Node.js) as a library ---
// const { extractToDiskNode, extractToMemory } = require("./dogs.js"); // CJS
// // import { extractToDiskNode, extractToMemory } from "./dogs.js"; // ESM

// async function dogNodeLibExample() {
//   try {
//     // Option 1: Extract to disk (potentially applying deltas)
//     const summary = await extractToDiskNode({
//       bundleFileContent: "🐕 --- DOGS_START_FILE: example.txt ---...", // or bundleFilePath
//       outputDir: "./js_lib_extracted_node",
//       overwritePolicy: "yes", // 'yes', 'no', 'prompt'
//       // applyDeltaFromOriginalBundlePath: 'path/to/cats_out.bundle', // Optional
//       // inputFormat: 'auto', // 'auto', 'b64', 'utf8', 'utf16le'
//       // verbose: true,
//     });
//     console.log("Node.js library extraction summary (to disk):", summary);

//     // Option 2: Extract/parse to memory (does not apply deltas)
//     // const filesInMemory = await extractToMemory({ bundleFileContent: "...", verbose: true });
//     // console.log("Node.js library extraction (to memory):", filesInMemory);

//   } catch (err) { console.error("Error:", err); }
// }
// // dogNodeLibExample();
```

### Browser JavaScript (`cats.js`, `dogs.js`)

Browser usage APIs remain conceptually similar but are outside the scope of these recent changes focused on CLI/Node.js consistency and the delta feature.

---

This utility aims for simplicity and robustness in bridging your codebase with LLMs, now with enhanced flexibility for encoding and targeted modifications.
