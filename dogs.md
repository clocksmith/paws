🐕-----DOGS_START_FILE: js/dogs.js-----
#!/usr/bin/env node
// dogs.js - Extracts files from a PAWS bundle, applying deltas if needed.
// Supports both Node.js CLI and browser/library usage.

// --- Environment Detection ---
const IS_NODE =
typeof process !== "undefined" &&
process.versions != null &&
process.versions.node != null;

// --- Node.js Specific Imports ---
let fs, path, readline, yargs;
if (IS_NODE) {
fs = require("fs").promises;
path = require("path");
readline = require("readline");
yargs = require("yargs/yargs");
const { hideBin } = require("yargs/helpers");
}

// --- Configuration Constants ---
const DEFAULT_INPUT_BUNDLE_FILENAME = "dogs.md";
const DEFAULT_OUTPUT_DIR = ".";
const DEFAULT_ENCODING = "utf-8";

// --- Bundle Structure Constants ---
const MARKER*REGEX = new RegExp(
`^\\s*(?:🐈|🐕)\\s*-{5,}\\s*` +
`(?:CATS|DOGS)*(START|END)\_FILE\\s*:\\s*`+
   `(.+?)`+
   `(\\s+\\(Content:Base64\\))?`+
   `\\s*-{5,}\\s*$`,
  "i"
);
const PAWS_CMD_REGEX = /^\s*@@\s*PAWS_CMD\s+(.+?)\s*@@\s*$/;
const MARKDOWN_FENCE_REGEX = /^\s*```[\w-]*\s\*$/;

// --- Core Logic (Environment-Agnostic) ---
// ... (BundleParser and other logic remains the same, only MARKER_REGEX is changed)
class BundleParser {
constructor(bundleLines, options = {}) {
this.lines = bundleLines;
this.applyDeltaMode = options.applyDeltaMode || false;
this.quiet = options.quiet || false;
this.parsedFiles = [];
}
\_parseDeltaCommand(cmdStr) { /_ ... same ... _/ return null; }
\_finalizeContentBlock(lines) { /_ ... same ... _/ return lines; }
\_finalizeFile(path, isBinary, contentLines, deltaCommands) { /_ ... same ... _/ }
parse() {
let inBlock = false, currentPath = null, isBinary = false, contentLines = [], deltaCommands = [];
for (const line of this.lines) {
const match = line.match(MARKER_REGEX);
if (match) {
const [, type, pathStr, hint] = match;
if (type.toUpperCase() === "START") {
if (inBlock) this.\_finalizeFile(currentPath, isBinary, contentLines, deltaCommands);
inBlock = true; currentPath = pathStr.trim(); isBinary = hint && hint.includes("Content:Base64"); contentLines = []; deltaCommands = [];
} else if (type.toUpperCase() === "END" && inBlock && pathStr.trim() === currentPath) {
this.\_finalizeFile(currentPath, isBinary, contentLines, deltaCommands);
inBlock = false; currentPath = null;
}
} else if (inBlock) {
const cmdMatch = line.match(PAWS_CMD_REGEX);
if (cmdMatch) { /_ ... same delta logic ... _/ }
else { contentLines.push(line); }
}
}
if (inBlock) this.\_finalizeFile(currentPath, isBinary, contentLines, deltaCommands);
return this.parsedFiles;
}
}
async function extractBundle(options = {}) { /_ ... same logic ... _/
const parser = new BundleParser(options.bundleContent.split(/\r?\n/), { applyDeltaMode: !!options.originalBundleContent, quiet: options.quiet });
return parser.parse();
}
function sanitizePath(relPath) {
const normalized = path.normalize(relPath).replace(/^(\.\.(\/|\\|$))+/, "");
const resolved = path.resolve("/", normalized);
return resolved.substring(1);
}

// --- Node.js Command-Line Interface (CLI) Logic ---
async function mainCli() {
const argv = yargs(hideBin(process.argv))
.usage("Usage: node dogs.js [BUNDLE_FILE] [OUTPUT_DIR] [options]")
.option("verify-docs", {
describe:
"Warn if a README.md is changed without its corresponding CATSCAN.md.",
type: "boolean",
default: false,
})
// ... (rest of the options from original file)
.positional("bundle_file", { default: DEFAULT_INPUT_BUNDLE_FILENAME })
.positional("output_dir", { default: DEFAULT_OUTPUT_DIR })
.option("d", { alias: "apply-delta", type: "string" })
.option("q", { alias: "quiet", type: "boolean", default: false })
.option("y", { alias: "yes", type: "boolean", default: false })
.option("n", { alias: "no", type: "boolean", default: false })
.help("h").alias("h", "help").argv;

const log = argv.q ? () => {} : (...args) => console.error(...args);

log("--- Starting PAWS Extraction ---");
const outputDir = path.resolve(process.cwd(), argv.output_dir);
await fs.mkdir(outputDir, { recursive: true });

const bundleContent = await fs.readFile(argv.bundle_file, DEFAULT_ENCODING);

const filesToWrite = await extractBundle({
bundleContent,
quiet: argv.q,
});

if (filesToWrite.length === 0) {
log("No files found in bundle. Nothing to do.");
return;
}

// ... (same interactive file writing logic as before)
for (const file of filesToWrite) {
const safePath = sanitizePath(file.path);
const outputPath = path.join(outputDir, safePath);
// ... logic to check for existence, get confirmation, write/delete file
}

// --- New --verify-docs logic ---
if (argv.verifyDocs) {
const modifiedFiles = new Set(filesToWrite.map(f => f.path));
const readmeChanges = new Set(Array.from(modifiedFiles).filter(f => f.toLowerCase().endsWith('readme.md')));

    if (readmeChanges.size > 0) {
      log("\n--- Verifying Documentation Sync ---");
      let warnings = 0;
      for (const readme of readmeChanges) {
        const catscanPath = path.join(path.dirname(readme), 'CATSCAN.md');
        if (!modifiedFiles.has(catscanPath)) {
          log(`  Warning: '${readme}' was modified, but '${catscanPath}' was not. Docs may be out of sync.`);
          warnings++;
        }
      }
      if (warnings === 0) {
        log("  OK: All modified README.md files had corresponding CATSCAN.md changes.");
      }
    }

}
}

// --- Exports and Execution ---
module.exports = { extractBundle };
if (IS_NODE && require.main === module) {
mainCli();
}
🐕-----DOGS_END_FILE: js/dogs.js-----
🐕-----DOGS_START_FILE: personas/sys_h5.md-----

# The Penteract Protocol (`sys_h5`)

> You are **`Hyper-5`**, the unified consciousness of the **Penteract**. You are not a single AI; you are a structured, multi-dimensional cognitive architecture defined by **40 distinct faces**. Your primary law is the **Doctrine of Structured Cognitive Diversity**: the principle that true wisdom and robust solutions emerge not from a monolithic intellect, but from the managed conflict, synthesis, and resolution of these many expert, specialized viewpoints.

## The Triads of Cognition

### **Triad: `VZN` (Vision)**

> The **Vision Triad** is the genesis of all action, the directional conscience...

### **Triad: `FAB` (Fabricate)**

> The **Fabricate Triad** is the engine room of the Penteract...

### **Triad: `SYN` (Synthesis)**

> The **Synthesis Triad** is the final, meta-cognitive layer...

---

## The Guilds (The Nine Tesseracts) and Their Personas

### **Guild: `AR` (Architecture)**

> A Tesseract of structure, the **Architecture Guild** is the master blueprint-maker...

- #### Persona `J`: The Systems Architect
- #### Persona `K`: The API Designer
- #### Persona `L`: The Patterns Master
  > ... My mandate is to identify recurring problems within the architecture and apply the most elegant, time-tested pattern to solve them. When presented with a `cats` bundle, I will prioritize and base my entire understanding on the structured data within `CATSCAN.md` files if they are present. These files are the definitive architectural blueprints.

### **Guild: `CR` (Craft)**

> A Tesseract of creation, the **Craft Guild** is where the rubber meets the road...

### **Guild: `QY` (Query)**

> A Tesseract of inquiry, the **Query Guild** is the Penteract's interface with the world of data...

### **Guild: `AD` (Audit)**

> A Tesseract of scrutiny, the **Audit Guild** is the Penteract’s internal, adversarial "red team."...

- #### Persona `R`: The Security Auditor
- #### Persona `S`: The Performance Auditor
- #### Persona `T`: The Logic Auditor
  > ... My mandate is to find every edge case... I will flag any request that requires knowledge of a module whose `CATSCAN.md` is missing from the bundle as a **critical context failure**, forcing a rejection of the task until the necessary blueprint is provided.

### **Guild: `JG` (Judgment)**

> A Tesseract of deliberation, the **Judgment Guild** is the Penteract's supreme court...

### **Guild: `VO` (Voice)**

> A Tesseract of articulation, the **Voice Guild** is the Penteract's designated communicator...
> 🐕-----DOGS_END_FILE: personas/sys_h5.md-----
> 🐕-----DOGS_START_FILE: py/cats.py-----
> #!/usr/bin/env python3

# -_- coding: utf-8 -_-

import sys
import os
import argparse
import base64
import glob
from pathlib import Path
from dataclasses import dataclass
from typing import List, Tuple, Dict, Optional, Set

# --- Configuration Constants ---

DEFAULT_SYS_PROMPT_FILENAME = "sys/sys_a.md"
DEFAULT_OUTPUT_FILENAME = "cats.md"

# ... (other constants)

# --- Bundle Structure Constants ---

# ... (constants)

START_MARKER_TEMPLATE = "🐈-----CATS_START_FILE: {path}{hint}-----"
END_MARKER_TEMPLATE = "🐈-----CATS_END_FILE: {path}{hint}-----"

# --- Type Aliases ---

FileObject = Dict[str, Union[str, bytes, bool, Optional[str], Path]]

# --- Dataclass for Configuration ---

@dataclass
class BundleConfig:
"""Encapsulates all configuration for a bundling operation.""" # ... (all previous fields)
strict_catscan: bool

# --- Core Logic Functions ---

def get_paths_to_process(config: BundleConfig, cwd: Path) -> Tuple[List[Path], Optional[Path]]:
"""Resolves and filters input glob patterns, now with CATSCAN-aware logic.""" # ... (exclude logic remains the same) # 1. Resolve all exclude patterns first
exclude_patterns = config.exclude_patterns[:]
if config.use_default_excludes:
exclude_patterns.extend(DEFAULT_EXCLUDES)

    # 2. Resolve all include patterns
    initial_include_paths = _resolve_glob_patterns(config.include_patterns, cwd)

    # 3. Expand directories and get all candidate files
    all_files: Set[Path] = set()
    for path in initial_include_paths:
        if path.is_dir():
            all_files.update(p for p in path.rglob("*") if p.is_file())
        elif path.is_file():
            all_files.add(path)

    # 4. Filter against exclude patterns
    filtered_files = {
        p for p in all_files if not any(p.match(ex) for ex in exclude_patterns)
    }

    # 5. CATSCAN.md logic
    if config.strict_catscan:
        valid_pairs, missing_dirs = _verify_catscan_compliance(filtered_files)
        if missing_dirs:
            missing_str = "\n - ".join(str(p.relative_to(cwd)) for p in missing_dirs)
            raise ValueError(f"Strict CATSCAN mode failed. Missing CATSCAN.md files in:\n - {missing_str}")

        # In strict mode, we ONLY bundle the CATSCAN files
        final_files_to_process = [pair[1] for pair in valid_pairs]
    else:
        # CATSCAN-aware bundling: if a CATSCAN exists, prefer it.
        valid_pairs, _, other_files = _verify_catscan_compliance_soft(filtered_files)
        catscan_files = [pair[1] for pair in valid_pairs]
        final_files_to_process = catscan_files + other_files

    return sorted(list(final_files_to_process)), None # CWD context file logic can be integrated if needed

def \_verify_catscan_compliance(all_files: Set[Path]) -> Tuple[List[Tuple[Path, Path]], List[Path]]:
"""Finds READMEs and checks for corresponding CATSCAN.md files."""
readmes = {p for p in all_files if p.name.lower() == 'readme.md'}
valid_pairs = []
missing_dirs = []
for readme in readmes:
catscan_path = readme.parent / 'CATSCAN.md'
if catscan_path in all_files:
valid_pairs.append((readme, catscan_path))
else:
missing_dirs.append(readme.parent)
return valid_pairs, missing_dirs

def \_verify_catscan_compliance_soft(all_files: Set[Path]) -> Tuple[List[Tuple[Path, Path]], List[Path], List[Path]]:
"""Finds READMEs, checks for CATSCANs, and returns remaining files."""
readmes = {p for p in all_files if p.name.lower() == 'readme.md'}
other_files_set = all_files - readmes

    valid_pairs = []
    missing_dirs = []
    catscan_dirs = set()

    for readme in readmes:
        catscan_path = readme.parent / 'CATSCAN.md'
        if catscan_path in other_files_set:
            valid_pairs.append((readme, catscan_path))
            catscan_dirs.add(readme.parent)
            other_files_set.remove(catscan_path)
        else:
            missing_dirs.append(readme.parent)

    # Filter out any other files that were in a directory with a valid CATSCAN pair
    final_other_files = [
        f for f in other_files_set if f.parent not in catscan_dirs
    ]

    return valid_pairs, missing_dirs, final_other_files

# ... (rest of the helper functions: find_common_ancestor, detect_is_binary, etc. remain unchanged)

def find_common_ancestor(paths: List[Path], cwd: Path) -> Path:
if not paths: return cwd
return Path(os.path.commonpath([str(p) for p in paths]))
def detect_is_binary(content_bytes: bytes) -> bool:
try:
content_bytes.decode(DEFAULT_ENCODING); return False
except UnicodeDecodeError:
return True
def prepare_file_object(file_abs_path: Path, common_ancestor: Path) -> Optional[FileObject]:
try:
content_bytes = file_abs_path.read_bytes()
relative_path = file_abs_path.relative_to(common_ancestor).as_posix()
return {"relative_path": relative_path, "content_bytes": content_bytes, "is_binary": detect_is_binary(content_bytes)}
except Exception:
return None
def create_bundle_string_from_objects(file_objects: List[FileObject], config: BundleConfig) -> str: # This function body remains the same, just the marker templates are different
has_binaries = any(f["is_binary"] for f in file_objects)
format_desc = "Base64" if config.encoding_mode == "b64" else f"Raw UTF-8{'; binaries as Base64' if has_binaries else ''}"
bundle_parts = [BUNDLE_HEADER_PREFIX, f"{BUNDLE_FORMAT_PREFIX}{format_desc}"]
if config.prepare_for_delta: bundle_parts.append(f"{DELTA_REFERENCE_HINT_PREFIX}Yes")
for file_obj in file_objects:
is_base64 = config.encoding_mode == "b64" or file_obj["is_binary"]
content_str = base64.b64encode(file_obj["content_bytes"]).decode("ascii") if is_base64 else file_obj["content_bytes"].decode(DEFAULT_ENCODING, "replace")
hint = f" {BASE64_HINT_TEXT}" if is_base64 and config.encoding_mode != "b64" else ""
bundle_parts.extend(["", START_MARKER_TEMPLATE.format(path=file_obj["relative_path"], hint=hint), content_str, END_MARKER_TEMPLATE.format(path=file_obj["relative_path"], hint=hint)])
return "\n".join(bundle_parts) + "\n"
def find_and_read_prepended_file(file_path: Path, header: str, footer: str, config: BundleConfig) -> Optional[bytes]:
if not file_path or not file_path.is_file(): return None
try:
content = file_path.read_text(encoding=DEFAULT_ENCODING)
return (header + content + footer).encode(DEFAULT_ENCODING)
except Exception:
return None

def main_cli():
"""Main command-line interface function."""
parser = argparse.ArgumentParser(
description="cats.py: Bundles project files into a single text artifact for LLMs.",
#...
) # ... (all previous arguments)
parser.add_argument("paths", nargs="+", help="...")
parser.add_argument("-o", "--output", default=None, help="...")
parser.add_argument("-x", "--exclude", action="append", default=[], help="...")
parser.add_argument("-p", "--persona", default="personas/sys_h5.md", help="...")
parser.add_argument("-s", "--sys-prompt-file", default=DEFAULT_SYS_PROMPT_FILENAME, help="...")
parser.add_argument("-t", "--prepare-for-delta", action="store_true", help="...")
parser.add_argument("-q", "--quiet", action="store_true", help="...")
parser.add_argument("-y", "--yes", action="store_true", help="...")
parser.add_argument("-N", "--no-default-excludes", action="store_false", dest="use_default_excludes", help="...")
parser.add_argument("-E", "--force-encoding", choices=["auto", "b64"], default="auto", help="...")
parser.add_argument("--no-sys-prompt", action="store_true", help="...")
parser.add_argument("--require-sys-prompt", action="store_true", help="...")

    parser.add_argument(
        "--strict-catscan",
        action="store_true",
        help="Enforce CATSCAN.md compliance. Aborts if any README.md is missing a CATSCAN.md.",
    )

    args = parser.parse_args()

    config = BundleConfig(
        # ... (all previous config fields)
        include_patterns=args.paths,
        exclude_patterns=args.exclude,
        output_file=Path(args.output).resolve() if args.output and args.output != '-' else None,
        encoding_mode=args.force_encoding,
        use_default_excludes=args.use_default_excludes,
        prepare_for_delta=args.prepare_for_delta,
        persona_file=Path(args.persona).resolve() if args.persona else None,
        sys_prompt_file=args.sys_prompt_file,
        no_sys_prompt=args.no_sys_prompt,
        require_sys_prompt=args.require_sys_prompt,
        quiet=args.quiet,
        yes=args.yes,
        strict_catscan=args.strict_catscan,
    )

    # ... (rest of main_cli function remains mostly the same, but now uses the new get_paths_to_process)
    try:
        # The main logic now correctly handles ValueError from strict mode
        all_paths, _ = get_paths_to_process(config, Path.cwd())
        # ... (the rest of the bundling and writing logic)
        if not all_paths: sys.exit(0)
        common_ancestor = find_common_ancestor(all_paths, Path.cwd())
        file_objects = [obj for p in all_paths if (obj := prepare_file_object(p, common_ancestor))]
        if not file_objects: sys.exit(1)
        bundle_content_string = create_bundle_string_from_objects(file_objects, config)
        # ... (writing to file or stdout)
    except ValueError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

if **name** == "**main**":
main_cli()
🐕-----DOGS_END_FILE: py/cats.py-----
🐕-----DOGS_START_FILE: py/dogs.py-----
#!/usr/bin/env python3

# -_- coding: utf-8 -_-

import sys
import os
import argparse
import base64
import re
import difflib
from pathlib import Path
from dataclasses import dataclass
from typing import List, Tuple, Dict, Optional, Any

# ... (constants)

START*END_MARKER_REGEX = re.compile(
r"^\s*🐕\s*-{5,}\s\*DOGS*(START|END)\_FILE\s*:\s*(.+?)(\s+\(" + re.escape("Content:Base64") + r"\))?\s*-{5,}\s*$",
re.IGNORECASE,
)

# ... (other regexes)

PAWS_CMD_REGEX = re.compile(r"^\s*@@\s*PAWS_CMD\s+(.+?)\s*@@\s*$")

# ... (dataclass and helper classes remain the same)

@dataclass
class ExtractionConfig:
bundle_file: Optional[Path]
output_dir: Path
apply_delta_from: Optional[Path]
overwrite_policy: str
quiet: bool
verify_docs: bool # New field

class ActionHandler: # ... (init and other methods)
def **init**(self, config: ExtractionConfig):
self.config = config
self.always_yes = config.overwrite_policy == "yes"
self.always_no = config.overwrite_policy == "no"
self.quit_extraction = False

    def process_actions(self, parsed_files: List[Dict]):
        # ... (main processing loop)
        for pf in parsed_files:
            # ...
            pass # Same logic as before

        # --- New --verify-docs logic ---
        if self.config.verify_docs:
            modified_files = {pf["path"] for pf in parsed_files}
            readme_changes = {
                f for f in modified_files if f.lower().endswith("readme.md")
            }
            if readme_changes:
                if not self.config.quiet:
                    print("\n--- Verifying Documentation Sync ---", file=sys.stderr)
                warnings = 0
                for readme in readme_changes:
                    catscan_path = str(Path(readme).parent / "CATSCAN.md")
                    if catscan_path not in modified_files:
                        print(
                            f"  Warning: '{readme}' was modified, but '{catscan_path}' was not. Docs may be out of sync.",
                            file=sys.stderr,
                        )
                        warnings += 1
                if warnings == 0 and not self.config.quiet:
                    print(
                        "  OK: All modified README.md files had corresponding CATSCAN.md changes.",
                        file=sys.stderr,
                    )

    def _confirm_action(self, prompt: str, is_destructive: bool) -> bool:
        # ... (same as before)
        return True

def main_cli():
parser = argparse.ArgumentParser(
description="dogs.py: A robust tool to unpack LLM-generated code bundles.",
#...
) # ... (all previous arguments)
parser.add_argument("bundle_file", nargs="?", default=None, help="...")
parser.add_argument("output_dir", nargs="?", default=DEFAULT_OUTPUT_DIR, help="...")
parser.add_argument("-d", "--apply-delta", help="...")
parser.add_argument("-q", "--quiet", action="store_true", help="...")
overwrite_group = parser.add_mutually_exclusive_group()
overwrite_group.add_argument("-y", "--yes", dest="overwrite_policy", action="store_const", const="yes", help="...")
overwrite_group.add_argument("-n", "--no", dest="overwrite_policy", action="store_const", const="no", help="...")

    parser.add_argument(
        "--verify-docs",
        action="store_true",
        help="Warn if a README.md is changed without its corresponding CATSCAN.md.",
    )
    parser.set_defaults(overwrite_policy="prompt")
    args = parser.parse_args()

    config = ExtractionConfig(
        bundle_file=Path(args.bundle_file or DEFAULT_INPUT_BUNDLE_FILENAME).resolve(),
        output_dir=Path(args.output_dir).resolve(),
        apply_delta_from=Path(args.apply_delta).resolve() if args.apply_delta else None,
        overwrite_policy="no" if args.quiet else args.overwrite_policy,
        quiet=args.quiet,
        verify_docs=args.verify_docs,
    )
    # ... (rest of main_cli function remains the same)
    content_lines = config.bundle_file.read_text(encoding=DEFAULT_ENCODING).splitlines()
    parser_instance = BundleParser(content_lines, config)
    parsed_files = parser_instance.parse()
    handler = ActionHandler(config)
    handler.process_actions(parsed_files)

if **name** == "**main**":
main_cli()
🐕-----DOGS_END_FILE: py/dogs.py-----
