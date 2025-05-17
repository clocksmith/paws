# PAWS for Node.js: `cats.js` and `dogs.js`

This directory contains the Node.js versions of the **PAWS** (Prepare Artifacts With SWAP) command-line utilities: `cats.js` and `dogs.js`. These tools bundle project files for interaction with Large Language Models (LLMs) and then reconstruct them.
(Python versions, `cats.py` and `dogs.py`, offering similar core functionality are available in the parent directory.)

- **`cats.js`**: Bundles specified project files/directories into a single text artifact. By convention, `cats.js` will automatically include a file named `sys_human.txt` if it exists in the current working directory, including it as the **first file _within_** the Cats Bundle. It applies default excludes (`.git`, `node_modules/`, `gem/`, `__pycache__`) which can be disabled.
- **`dogs.js`**: Extracts files from such a bundle back into a directory structure. It can apply delta changes specified in the bundle if invoked with the `--apply-delta` flag. The default input bundle name is `dogs_in.bundle`.

## Workflow

The primary goal is to enable a seamless workflow for project-wide analysis, refactoring, or content generation by LLMs:

1.  **🧶🐈 Bundle with `cats.js`**:
    Use `cats.js` to package your entire project (or relevant parts) into one text artifact (`cats_out.bundle`).

    **NOTE:** A `sys_human.txt` in the current working directory will be bundled as the first file if present and not excluded. It's good practice for this file to guide the LLM. Default excludes are applied.

    ```bash
    # Bundle current dir, excluding defaults AND custom dir 'dist' (Node.js)
    node cats.js . -x dist -o my_project_context.bundle

    # Bundle current dir, but DO NOT use default excludes (Node.js)
    node cats.js . -N -o my_project_context.bundle
    ```

2.  **Interact with LLM**:
    Provide this bundle (`cats_out.bundle`) to an LLM. Give clear instructions:

    - **Identify Structure**: "This is a bundle of files. Each file starts with `🐈 --- CATS_START_FILE: path/to/file.ext ---` (or `🐕 --- DOGS_START_FILE: ... ---` if processed) and ends with the corresponding `END_FILE` marker. The first file may be `sys_human.txt` providing context."
    - **Note Encoding**: "The bundle's first lines might include a `# Format: ...` header (e.g., `Raw UTF-8`, `Raw UTF-16LE`, `Base64`). Respect this encoding for modifications. UTF-8 is the default for text."
    - **Preserve/Use Markers**:
      - "**VERY IMPORTANT: Only modify content _between_ the start and end file markers.**"
      - "**Use `🐕 --- DOGS_START_FILE: path/to/your/file.ext ---` and `🐕 --- DOGS_END_FILE ---` for each file you output.** This helps the `dogs` utility parse your output most reliably."
      - "Do NOT alter the original `🐈 CATS_START_FILE` / `🐈 CATS_END_FILE` markers or any `# Format:` headers if you are only making minor changes _within_ existing file blocks of an input bundle."
    - **Maintain Encoding**: "If the bundle format is Base64, your output must be valid Base64. If Raw UTF-8 or Raw UTF-16LE, ensure valid text in that encoding."
    - **New Files**: "For new files, use `🐕 DOGS_START_FILE: path/to/new_file.ext ---`, its full content, then `🐕 DOGS_END_FILE ---`. Use relative paths with forward slashes `/`."
    - **Delta Changes (Optional, for `dogs.js --apply-delta`):** "If modifying large existing files, you can specify changes using delta commands within the `🐕 DOGS_` block. Use `@@ PAWS_CMD REPLACE_LINES(start, end) @@`, `@@ PAWS_CMD INSERT_AFTER_LINE(line_num) @@`, or `@@ PAWS_CMD DELETE_LINES(start, end) @@`. These refer to 1-based line numbers in the _original_ file (from `cats_out.bundle`). Ensure the user intends to run `dogs.js` with the `-d` flag."

3.  **🥏🐕 Extract with `dogs.js`**:
    Use `dogs.js` to extract the LLM's output bundle (`dogs_in.bundle`) back into a functional project. Use `-d <original_bundle>` if the LLM used delta commands.

    ```bash
    # Extract full file contents from dogs_in.bundle (Node.js)
    node dogs.js dogs_in.bundle ./project_v2 -y

    # Apply delta changes from dogs_in.bundle using cats_out.bundle as reference (Node.js)
    node dogs.js dogs_in.bundle ./project_v2 -y -d cats_out.bundle
    ```

## Key Features `cats.js`/`dogs.js`

- **Comprehensive Context:** Bundles multiple files and directories.
- **Automatic `sys_human.txt` Inclusion (`cats.js`):** Bundled as the first file if exists in CWD and not excluded.
- **Default Excludes (`cats.js`):** Automatically excludes `.git`, `node_modules/`, `gem/`, `__pycache__`. Disable with `-N`.
- **Robust Exclusion (`cats.js`):** Precisely exclude additional files/directories.
- **Encoding Options (`cats.js`):** Handles UTF-8 (default), UTF-16LE. Auto-switches to Base64 for binary content unless text encoding is forced (`-E`).
- **Clear Bundle Structure:** Includes format headers and `🐈`/`🐕` file markers.
- **Safe Extraction (`dogs.js`):** Sanitizes paths, prevents traversal.
- **Delta Application (`dogs.js`):** Applies line-based changes using `--apply-delta (-d)` flag and `@@ PAWS_CMD [...] @@` syntax.
- **Overwrite Control (`dogs.js`):** User control over overwriting existing files (`-y`, `-n`, prompt).

## `cats.js` - Bundling your source code 🧶🐈

**Command Syntax:**

```bash
node cats.js [PATH...] [options]
```

**Key Options:**

- `paths` (required): Files or directories to bundle.
- `-o BUNDLE_FILE`, `--output BUNDLE_FILE`: Output bundle name (default: `cats_out.bundle`).
- `-x EXCLUDE_PATH`, `--exclude EXCLUDE_PATH`: Path to exclude (multiple allowed).
- `-N`, `--no-default-excludes`: Disable default excludes.
- `-E {auto,utf8,utf16le,b64}`, `--force-encoding {auto,utf8,utf16le,b64}`: Force bundle encoding (default: `auto`).
- `-y`, `--yes`: Auto-confirm bundling process.
- `-v`, `--verbose`: Enable verbose logging.
- `-h`, `--help`: Show help.

**`cats.js` Examples:**

1.  **Bundle current directory, using default excludes, output to default `cats_out.bundle`:**
    ```bash
    node cats.js .
    ```
2.  **Bundle src, exclude tests, disable default excludes, force UTF-16LE:**
    ```bash
    node cats.js ./src -x ./src/tests -N -E utf16le -o app_utf16.bundle
    ```

## `dogs.js` - Reconstructing from a bundle 🥏🐕

**Command Syntax:**

```bash
node dogs.js [BUNDLE_FILE] [OUTPUT_DIR] [options]
```

**Key Options:**

- `bundle_file` (optional): Bundle to extract (default: `dogs_in.bundle` if exists, else error).
- `output_directory` (optional): Where to extract (default: current directory `./`).
- `-d ORIGINAL_BUNDLE`, `--apply-delta ORIGINAL_BUNDLE`: Apply delta commands.
- `-i {auto,b64,utf8,utf16le}`, `--input-format {auto,b64,utf8,utf16le}`: Override bundle format.
- `-y`, `--yes`: Overwrite existing files without asking.
- `-n`, `--no`: Skip overwriting existing files without asking.
- `-v`, `--verbose`: Enable verbose logging.
- `-h`, `--help`: Show help.

**`dogs.js` Examples:**

1.  **Extract default `dogs_in.bundle` to `./output`, auto-overwrite:**
    ```bash
    node dogs.js -y -o ./output
    ```
2.  **Apply deltas from `llm_delta.bundle`, verbose:**
    ```bash
    node dogs.js llm_delta.bundle ./project_v2 -v -d project_v1.bundle
    ```

## Library Usage (Node.js)

```javascript
// --- Using cats.js (Node.js) as a library ---
// const { bundleFromPathsNode } = require("./cats.js"); // CJS
// // import { bundleFromPathsNode } from "./cats.js"; // ESM

// async function catNodeLibExample() {
//   try {
//     const includePaths = ["./src", "package.json"]; // sys_human.txt from CWD handled by bundleFromPathsNode convention
//     const { bundleString, formatDescription, filesAdded } =
//       await bundleFromPathsNode({
//         includePaths: includePaths,
//         excludePaths: ["./src/node_modules"],
//         // useDefaultExcludes: true, // Default
//         // encodingMode: 'auto', // 'auto', 'utf8', 'utf16le', 'b64'
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

---

These Node.js utilities aim for simplicity and robustness in bridging your codebase with LLMs.
