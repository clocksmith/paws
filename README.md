# PAWS: Prepare Artifacts With SWAP (Streamlined Write After PAWS)

PAWS provides simple, dependency-free command-line utilities (`cats` and `dogs`) to bundle your project files for interaction with Large Language Models (LLMs) and then reconstruct them, for a quick code SWAP. The tools are available in both Python and Node.js, offering nearly identical command-line APIs and behavior for their core bundling and extraction tasks.

- **`cats`**: Bundles specified project files/directories into a single text artifact. **By convention, `cats` will also automatically include a file named `sys_human.txt` if it exists in the current working directory**, prepending it to the bundle. This file typically contains human-readable system guidelines or LLM interaction context.
- **`dogs`**: Extracts files from such a bundle back into a directory structure.

## Core Idea & LLM Workflow

The primary goal is to enable a seamless workflow for project-wide analysis, refactoring, or content generation by LLMs:

1.  **Bundle with `cats`**:
    Use `cats` to package your entire project (or relevant parts) into one text artifact. `sys_human.txt` will be included automatically if present.

    ```bash
    # Python
    python cats.py ./my_project -x .git -x node_modules -o my_project_context.bundle

    # Node.js (now with more feature parity with Python version)
    node cats.js ./my_project -x .git -x node_modules -o my_project_context.bundle
    ```

2.  **Interact with LLM**:
    Provide this bundle to an LLM. It's crucial to give clear instructions:

    - **Identify Structure**: "This is a bundle of files. Each file starts with `--- CATS_START_FILE: path/to/file.ext ---` (or `--- DOGS_START_FILE: ... ---` if I previously processed it) and ends with `--- CATS_END_FILE ---` (or `--- DOGS_END_FILE ---`). The first file may be `sys_human.txt` providing context for our interaction."
    - **Note Encoding**: "The bundle's first lines might include a `# Format: ...` header (e.g., `Raw UTF-8` or `Base64`). Respect this encoding for modifications." (The `dogs` utility will prioritize a `DOGS_` header if present, then a `CATS_` header).
    - **Preserve/Use Markers**:
      - "**VERY IMPORTANT: Only modify content _between_ the start and end file markers.**"
      - "**If you are generating new file content or significantly restructuring, please use `--- DOGS_START_FILE: path/to/your/file.ext ---` and `--- DOGS_END_FILE ---` for each file you output.** This helps the `dogs` utility parse your output most reliably."
      - "Do NOT alter the original `CATS_START_FILE` / `CATS_END_FILE` markers or any `# Format:` headers if you are only making minor changes _within_ existing file blocks of an input bundle."
    - **Maintain Encoding**: "If content is Base64, your output for that block must be valid Base64. If Raw UTF-8, ensure valid UTF-8."
    - **New Files (if using `DOGS_` markers)**: "For new files, use `--- DOGS_START_FILE: path/to/new_file.ext ---`, its content, then `--- DOGS_END_FILE ---`. Use relative paths with forward slashes `/`."

    **Example LLM Task**:
    "Refactor all Python functions named `old_func` to `new_func` in the following project bundle. The bundle may start with `sys_human.txt`. Please output the modified files using `DOGS_START_FILE` and `DOGS_END_FILE` markers, preserving the original encoding format indicated in the bundle header (or assume Raw UTF-8 if not specified)."

3.  **Extract with `dogs`**:
    Use `dogs` to extract the LLM's (potentially modified) bundle back into a functional project. The Python version, `dogs.py`, is particularly robust at parsing various LLM output styles, including strict `DOGS_`/`CATS_` markers and more conversational file indications.

    ```bash
    # Python (recommended for LLM output due to advanced parsing)
    python dogs.py llm_output.bundle ./project_v2 -y

    # Node.js (parses strict DOGS_ and CATS_ markers)
    node dogs.js llm_output.bundle ./project_v2 -y
    ```

## Key Features

- **Comprehensive Context:** Bundles multiple files and directories.
- **Automatic `sys_human.txt` Inclusion (`cats`):** If `sys_human.txt` exists in the CWD, it's automatically prepended to the bundle.
- **Robust Exclusion (`cats`):** Precisely exclude files or directories using absolute or relative paths.
- **Intelligent Path Handling (`cats`):** Improved common ancestor detection for cleaner relative paths in bundle markers, consistent across Python and Node.js versions.
- **Intelligent Encoding (`cats`):** Defaults to UTF-8; auto-switches entire bundle to Base64 if non-UTF-8 content is found. Option to force Base64.
- **Clear Bundle Structure:** Includes format headers and file markers.
- **Safe Extraction (`dogs`):** Sanitizes paths, prevents traversal, handles malformed bundles.
- **Overwrite Control (`dogs`):** User control over overwriting existing files.
- **Python `dogs.py` Power:** Advanced parsing for LLM outputs, including `DOGS_` markers, `CATS_` markers, and common conversational/heuristic file indicators from LLMs.
- **Node.js `dogs.js`:** Parses strict `DOGS_` and `CATS_` markers.

## `cats` - Bundling Your Project

**Command Syntax (Nearly Identical for Python/Node.js):**

```bash
python cats.py [PATH_TO_INCLUDE_1] [PATH_TO_INCLUDE_2...] [options]
node cats.js [PATH_TO_INCLUDE_1] [PATH_TO_INCLUDE_2...] [options]
```

**Key Options:**

- `paths` (required): Files or directories to bundle.
- `-o BUNDLE_FILE`, `--output BUNDLE_FILE`: Output bundle name (default: `cats_out.bundle`).
- `-x EXCLUDE_PATH`, `--exclude EXCLUDE_PATH`: Path to exclude (multiple allowed).
- `--force-b64`: Force Base64 encoding for all files.
- `-y`, `--yes`: Auto-confirm bundling process if a prompt would occur (Python and Node.js).
- `-v`, `--verbose` (Node.js `cats.js` only currently, Python `cats.py` logs by default): Enable verbose logging.
- `-h`, `--help`: Show help.

**`cats` Examples:**

1.  **Bundle current directory, excluding `.git` and `dist` (sys_human.txt will be included if in current dir):**

    ```bash
    python cats.py . -x .git -x dist -o my_project.bundle
    node cats.js . -x .git -x dist -o my_project.bundle -v
    ```

2.  **Bundle specific files and a directory, force Base64:**
    ```bash
    python cats.py ./src/main.js ./assets ./README.md --force-b64 -o app_b64.bundle
    node cats.js ./src/main.js ./assets ./README.md --force-b64 -o app_b64.bundle
    ```

## `dogs` - Reconstructing from a Bundle

**Command Syntax (Identical for Python/Node.js):**

```bash
python dogs.py [BUNDLE_FILE] [OUTPUT_DIR] [options]
node dogs.js [BUNDLE_FILE] [OUTPUT_DIR] [options]
```

**Key Options:**

- `bundle_file` (optional): Bundle to extract (default: `cats_out.bundle` if it exists, otherwise error).
- `output_directory` (optional): Where to extract (default: current directory `./`).
- `-i {auto|b64|utf8}`, `--input-format {auto|b64|utf8}`: Override bundle format detection.
- `-y`, `--yes`: Overwrite existing files without asking.
- `-n`, `--no`: Skip overwriting existing files without asking (if not `-y`, `dogs.js` defaults to this in non-interactive, `dogs.py` prompts).
- `-v`, `--verbose`: Enable verbose logging during parsing/extraction.
- `-h`, `--help`: Show help.

**`dogs` Examples:**

1.  **Extract default `cats_out.bundle` to `./output`, auto-overwrite:**

    ```bash
    python dogs.py cats_out.bundle ./output -y
    node dogs.js cats_out.bundle ./output -y
    ```

2.  **Extract LLM's response, non-interactively skip existing, verbose (Python):**

    ```bash
    python dogs.py llm_response.txt ./project_updated -n -v
    ```

3.  **Extract specific bundle, forcing Base64 interpretation (Node.js):**
    ```bash
    node dogs.js needs_b64_decode.bundle ./extracted_stuff -i b64 -v
    ```

## Library Usage

### Python (`cats.py`, `dogs.py`)

The core logic can be imported:

```python
# --- Using cats.py as a library ---
from cats import create_bundle_from_paths

# paths_to_bundle = ['./src', 'config.json']
# # sys_human.txt is automatically handled if you run from a directory where it exists
# # and don't explicitly exclude it, or if you add it to paths_to_bundle.
# # For library use, if you want to ensure sys_human.txt from CWD is included,
# # you might check for it and add it to include_paths_raw if desired.
#
# bundle_str, fmt_desc, files_count = create_bundle_from_paths(
#     include_paths_raw=paths_to_bundle,
#     exclude_paths_raw=['./src/temp'],
#     force_base64=False,
#     original_user_paths=paths_to_bundle # Important for correct warning logic
# )
# if files_count > 0:
#     print(f"Python bundle created ({fmt_desc}), {files_count} files. Preview:\n{bundle_str[:300]}...")

# --- Using dogs.py as a library ---
from dogs import extract_bundle_from_string

# example_bundle_content = """
# # Dogs Bundle (Output from LLM)
# # Format: Raw UTF-8
# --- DOGS_START_FILE: example.txt ---
# Hello from Python library test!
# --- DOGS_END_FILE ---
# """
# results = extract_bundle_from_string(
#     bundle_content=example_bundle_content,
#     output_dir_base="./py_lib_extracted",
#     overwrite_policy="yes", # "yes", "no", or "prompt"
#     # input_format_override=None, # "b64" or "utf8"
#     # verbose_logging=True
# )
# for res in results:
#     print(f"Path: {res.get('path_in_bundle', 'N/A')}, Status: {res['status']}, Msg: {res.get('message', '')}")
```

_(Refer to `cats.py` and `dogs.py` source for full function signatures and details.)_

### Node.js (`cats.js`, `dogs.js`)

```javascript
// --- Using cats.js (Node.js) as a library ---
// const { bundleFromPathsNode } = require("./cats.js"); // For CommonJS
// // import { bundleFromPathsNode } from "./cats.js"; // For ESM

// async function catNodeLibExample() {
//   try {
//     // For library use, explicitly add "sys_human.txt" if desired and check existence
//     const includePaths = ["./src", "package.json"];
//     // if (fs.existsSync("sys_human.txt")) {
//     //   includePaths.unshift("sys_human.txt");
//     // }
//     const { bundleString, formatDescription, filesAdded } =
//       await bundleFromPathsNode({
//         includePaths: includePaths,
//         excludePaths: ["./src/node_modules"],
//         forceBase64: false,
//         originalUserPaths: ["./src", "package.json"], // Match user-specified paths
//         // verbose: true,
//       });
//     if (filesAdded > 0) {
//       console.log(
//         `Node.js bundle created (${formatDescription}), ${filesAdded} files. Preview:\n${bundleString.substring(0,300)}...`
//       );
//     }
//   } catch (err) { console.error("Error in catNodeLibExample:", err); }
// }
// catNodeLibExample();

// --- Using dogs.js (Node.js) as a library ---
// const { extractToDiskNode, extractToMemory } = require("./dogs.js"); // For CommonJS
// // import { extractToDiskNode, extractToMemory } from "./dogs.js"; // For ESM

// async function dogNodeLibExample() {
//   const exampleBundleContent = `
// # Dogs Bundle (Output from LLM)
// # Format: Raw UTF-8
// --- DOGS_START_FILE: example_node.txt ---
// Hello from Node.js library test!
// --- DOGS_END_FILE ---
// `;
//   try {
//     const summary = await extractToDiskNode({
//       bundleFileContent: exampleBundleContent, // or bundleFilePath: 'path/to/bundle'
//       outputDir: "./js_lib_extracted_node",
//       overwritePolicy: "yes", // 'yes', 'no', 'prompt'
//       // inputFormat: 'auto', // 'auto', 'b64', 'utf8'
//       // verbose: true,
//     });
//     console.log("Node.js library extraction summary (to disk):", summary);

//     // const filesInMemory = await extractToMemory(exampleBundleContent, 'auto', true);
//     // console.log("Node.js library extraction (to memory):", filesInMemory);

//   } catch (err) { console.error("Error in dogNodeLibExample:", err); }
// }
// dogNodeLibExample();
```

_(Refer to `cats.js` and `dogs.js` source for full function signatures and details.)_

### Browser JavaScript (`cats.js`, `dogs.js`)

For browser usage, you'd typically use these with file inputs or text areas. `sys_human.txt` would need to be handled manually by the browser application logic if desired for inclusion.

```javascript
// Assuming 'cats.js' and 'dogs.js' are loaded as ES Modules
// import { bundleFromBrowser } from './cats.js'; // For bundling files from <input type="file" webkitdirectory>
// import { extractFromBrowser, extractToMemory } from './dogs.js'; // For extracting a bundle string

// --- Bundling in Browser (e.g., from file input) ---
// async function handleFileBundle(fileListOrDirectoryHandle, forceB64 = false) {
//   // fileListOrDirectoryHandle from: <input type="file" multiple webkitdirectory>
//   // or from window.showDirectoryPicker();
//   // Manually add sys_human.txt content here if needed before calling bundleFromBrowser
//   const { bundleString, formatDescription, filesAdded } =
//     await bundleFromBrowser(fileListOrDirectoryHandle, forceB64);
//   if (filesAdded > 0) {
//     console.log(`Browser bundle created (${formatDescription}), ${filesAdded} files.`);
//     // E.g., document.getElementById('outputTextArea').value = bundleString;
//   }
// }

// --- Extracting in Browser (e.g., from a textarea) ---
// async function handleBundleExtract(bundleStringFromTextArea) {
//   // Option 1: Attempt to save to disk using File System Access API or individual downloads
//   // const result = await extractFromBrowser(bundleStringFromTextArea, { inputFormat: 'auto' });
//   // console.log(`Browser extraction attempt: ${result.method}, Files Written: ${result.filesWritten || 0}`);

//   // Option 2: Extract to memory (array of { path, contentBytes })
//   // const filesArray = await extractToMemory(bundleStringFromTextArea, 'auto');
//   // console.log(`Extracted ${filesArray.length} files to memory:`);
//   // filesArray.forEach(f => console.log(`  - ${f.path} (${f.contentBytes.length} bytes)`));
// }
```

_(Refer to `cats.js` and `dogs.js` source for available browser-specific functions and their parameters.)_

---

This utility is designed for simplicity and robustness in its specific role of bridging your codebase with LLMs.
