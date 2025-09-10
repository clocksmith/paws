#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CATS - Context Aggregation and Transformation System

Bundles project files into a single text artifact for Language Models with:
- AI-powered file curation based on task description
- Smart project structure analysis
- System prompt and persona support
- CATSCAN-aware bundling mode
- Module verification and API extraction
"""

import sys
import os
import argparse
import base64
import subprocess
import json
import re
import glob as glob_module
import ast
from pathlib import Path
from typing import List, Optional, Dict, Set, Any
from dataclasses import dataclass

# For AI curation
try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False

try:
    import anthropic
    CLAUDE_AVAILABLE = True
except ImportError:
    CLAUDE_AVAILABLE = False

try:
    import openai
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False

# For git operations
try:
    import git
    GIT_AVAILABLE = True
except ImportError:
    GIT_AVAILABLE = False

# --- Configuration Constants ---
DEFAULT_SYS_PROMPT_FILENAME = "sys/sys_a.md"
DEFAULT_OUTPUT_FILENAME = "cats.md"
DEFAULT_ENCODING = "utf-8"
PAWSIGNORE_FILENAME = ".pawsignore"
DEFAULT_EXCLUDES = [
    ".git",
    "node_modules",
    "**/__pycache__",
    "**/*.pyc",
    ".DS_Store",
    "cats.md",
    "dogs.md",
]

# --- Bundle Structure Constants ---
PERSONA_HEADER = "\n--- START PERSONA ---\n"
PERSONA_FOOTER = "\n--- END PERSONA ---\n"
SYS_PROMPT_POST_SEPARATOR = (
    "\n--- END PREPENDED INSTRUCTIONS ---\nThe following content is the Cats Bundle.\n"
)
BUNDLE_HEADER_PREFIX = "# Cats Bundle"
BUNDLE_FORMAT_PREFIX = "# Format: "
DELTA_REFERENCE_HINT_PREFIX = "# Delta Reference: "
BASE64_HINT_TEXT = "(Content:Base64)"
START_MARKER_TEMPLATE = "🐈 --- CATS_START_FILE: {path}{hint} ---"
END_MARKER_TEMPLATE = "🐈 --- CATS_END_FILE: {path}{hint} ---"


@dataclass
class BundleConfig:
    """Configuration for bundling operation"""
    path_specs: List[str]
    exclude_patterns: List[str]
    output_file: Optional[Path]
    encoding_mode: str
    use_default_excludes: bool
    prepare_for_delta: bool
    persona_files: List[Path]
    sys_prompt_file: str
    no_sys_prompt: bool
    require_sys_prompt: bool
    strict_catscan: bool
    verify: Optional[str]
    quiet: bool
    yes: bool
    # AI curation (NEW)
    ai_curate: Optional[str] = None
    ai_provider: str = "gemini"
    ai_key: Optional[str] = None
    max_files: int = 20
    include_tests: bool = False


class PythonASTVisitor(ast.NodeVisitor):
    """Extract Python module API for verification"""
    def __init__(self):
        self.functions = []
        self.classes = {}
        self.imports = []
        self.public_api = {}

    def visit_FunctionDef(self, node: ast.FunctionDef):
        if not node.name.startswith("_"):
            self.functions.append(node.name)
            self.public_api[node.name] = {
                "type": "function",
                "args": [arg.arg for arg in node.args.args],
            }
        self.generic_visit(node)

    def visit_ClassDef(self, node: ast.ClassDef):
        if not node.name.startswith("_"):
            methods = []
            for item in node.body:
                if isinstance(item, ast.FunctionDef) and not item.name.startswith("_"):
                    methods.append(item.name)
            self.classes[node.name] = methods
            self.public_api[node.name] = {"type": "class", "methods": methods}
        self.generic_visit(node)

    def visit_Import(self, node: ast.Import):
        for alias in node.names:
            self.imports.append(alias.name)

    def visit_ImportFrom(self, node: ast.ImportFrom):
        if node.module:
            self.imports.append(node.module)


def verify_python_module(module_path: Path, quiet: bool) -> Dict[str, Any]:
    """Verify Python module and extract API"""
    try:
        with open(module_path, "r", encoding="utf-8") as f:
            tree = ast.parse(f.read(), filename=str(module_path))
        visitor = PythonASTVisitor()
        visitor.visit(tree)
        return visitor.public_api
    except Exception as e:
        if not quiet:
            print(f"Warning: Could not analyze {module_path}: {e}", file=sys.stderr)
        return {}


def verify_js_ts_module(module_path: Path, quiet: bool) -> Dict[str, Any]:
    """Verify JavaScript/TypeScript module"""
    # Basic verification - could be enhanced with proper parser
    return {"verified": True}


def run_verification(config: BundleConfig, cwd: Path):
    """Run module verification if requested"""
    if not config.verify:
        return
    
    print(f"Running verification for module: {config.verify}")
    module_path = cwd / config.verify
    
    if not module_path.exists():
        print(f"Error: Module {config.verify} not found", file=sys.stderr)
        sys.exit(1)
    
    if module_path.suffix == ".py":
        api = verify_python_module(module_path, config.quiet)
        if api:
            print(f"Module API: {json.dumps(api, indent=2)}")
    elif module_path.suffix in [".js", ".ts"]:
        verify_js_ts_module(module_path, config.quiet)
    else:
        print(f"Warning: No verification support for {module_path.suffix} files", file=sys.stderr)


@dataclass
class FileTreeNode:
    """Represents a file or directory in the project tree"""
    path: str
    is_dir: bool
    size: int = 0
    children: List['FileTreeNode'] = None
    
    def __post_init__(self):
        if self.children is None:
            self.children = []
    
    def to_string(self, indent=0) -> str:
        """Convert to string representation for LLM context"""
        prefix = "  " * indent
        if self.is_dir:
            result = f"{prefix}{Path(self.path).name}/\n"
            for child in self.children:
                result += child.to_string(indent + 1)
            return result
        else:
            size_str = f" ({self.size} bytes)" if self.size > 0 else ""
            return f"{prefix}{Path(self.path).name}{size_str}\n"


class ProjectAnalyzer:
    """Analyzes project structure for AI curation"""
    
    def __init__(self, root_path: Path):
        self.root_path = root_path
        self.file_tree = None
        self.gitignore_patterns = self._load_gitignore()
    
    def _load_gitignore(self) -> Set[str]:
        """Load gitignore patterns"""
        patterns = set()
        gitignore_path = self.root_path / ".gitignore"
        
        if gitignore_path.exists():
            with open(gitignore_path, 'r') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#'):
                        patterns.add(line)
        
        # Always ignore common patterns
        patterns.update([
            '__pycache__', '*.pyc', 'node_modules', '.git',
            '.venv', 'venv', 'env', '.env', '*.log', '.DS_Store'
        ])
        
        return patterns
    
    def _should_ignore(self, path: Path) -> bool:
        """Check if path should be ignored"""
        path_str = str(path.relative_to(self.root_path))
        
        for pattern in self.gitignore_patterns:
            if pattern in path_str:
                return True
            if path.name == pattern:
                return True
        
        return False
    
    def build_file_tree(self) -> FileTreeNode:
        """Build a tree representation of the project"""
        if GIT_AVAILABLE:
            return self._build_tree_with_git()
        else:
            return self._build_tree_with_walk()
    
    def _build_tree_with_git(self) -> FileTreeNode:
        """Build tree using git ls-files for tracked files"""
        try:
            repo = git.Repo(self.root_path)
            tracked_files = repo.git.ls_files().splitlines()
            
            root = FileTreeNode(path=str(self.root_path), is_dir=True)
            nodes = {str(self.root_path): root}
            
            for file_path in tracked_files:
                full_path = self.root_path / file_path
                if full_path.exists():
                    self._add_file_to_tree(full_path, root, nodes)
            
            return root
        except:
            return self._build_tree_with_walk()
    
    def _build_tree_with_walk(self) -> FileTreeNode:
        """Build tree by walking the filesystem"""
        root = FileTreeNode(path=str(self.root_path), is_dir=True)
        nodes = {str(self.root_path): root}
        
        for dirpath, dirnames, filenames in os.walk(self.root_path):
            # Filter ignored directories
            dirnames[:] = [d for d in dirnames if not self._should_ignore(Path(dirpath) / d)]
            
            dir_path = Path(dirpath)
            if self._should_ignore(dir_path):
                continue
            
            # Add files
            for filename in filenames:
                file_path = dir_path / filename
                if not self._should_ignore(file_path):
                    self._add_file_to_tree(file_path, root, nodes)
        
        return root
    
    def _add_file_to_tree(self, file_path: Path, root: FileTreeNode, nodes: Dict[str, FileTreeNode]):
        """Add a file to the tree structure"""
        parts = file_path.relative_to(self.root_path).parts
        current = root
        
        for i, part in enumerate(parts[:-1]):
            dir_path = self.root_path / Path(*parts[:i+1])
            dir_key = str(dir_path)
            
            if dir_key not in nodes:
                new_dir = FileTreeNode(path=dir_key, is_dir=True)
                nodes[dir_key] = new_dir
                current.children.append(new_dir)
                current = new_dir
            else:
                current = nodes[dir_key]
        
        # Add the file
        try:
            size = file_path.stat().st_size
        except:
            size = 0
        
        file_node = FileTreeNode(
            path=str(file_path),
            is_dir=False,
            size=size
        )
        current.children.append(file_node)


class AICurator:
    """Handles AI-powered context curation"""
    
    def __init__(self, api_key: Optional[str] = None, provider: str = "gemini"):
        self.provider = provider
        self.api_key = api_key or os.environ.get(f"{provider.upper()}_API_KEY")
        self.client = None
        
        if not self.api_key:
            raise ValueError(f"No API key provided for {provider}")
        
        self._initialize_client()
    
    def _initialize_client(self):
        """Initialize the AI client based on provider"""
        if self.provider == "gemini" and GEMINI_AVAILABLE:
            genai.configure(api_key=self.api_key)
            self.client = genai.GenerativeModel('gemini-pro')
        elif self.provider == "claude" and CLAUDE_AVAILABLE:
            self.client = anthropic.Anthropic(api_key=self.api_key)
        elif self.provider == "openai" and OPENAI_AVAILABLE:
            openai.api_key = self.api_key
            self.client = openai
        else:
            raise ValueError(f"Provider {self.provider} not available or not supported")
    
    def curate_files(self, task_description: str, file_tree: str, max_files: int = 20) -> List[str]:
        """Use AI to select relevant files for the task"""
        prompt = self._build_curation_prompt(task_description, file_tree, max_files)
        
        if self.provider == "gemini":
            return self._curate_with_gemini(prompt)
        elif self.provider == "claude":
            return self._curate_with_claude(prompt)
        elif self.provider == "openai":
            return self._curate_with_openai(prompt)
        else:
            raise ValueError(f"Unknown provider: {self.provider}")
    
    def _build_curation_prompt(self, task: str, tree: str, max_files: int) -> str:
        """Build the prompt for file curation"""
        return f"""You are an expert Staff Software Engineer specializing in codebase analysis.
Your task is to identify the most relevant set of files for a developer to complete a task.

**Task Description:**
{task}

**Project File Tree:**
```
{tree}
```

**Instructions:**
1. Analyze the task and the file tree carefully
2. Identify a concise set of files (maximum {max_files}) that are absolutely essential
3. Prioritize:
   - Core implementation files directly related to the task
   - Interface/API definitions that need modification
   - Configuration files if relevant
   - Data models or schemas that are affected
4. AVOID including:
   - Test files (unless the task is specifically about testing)
   - Documentation files (unless the task is about documentation)
   - Build artifacts or generated files
   - Unrelated modules or components

**Output Format:**
Return ONLY a JSON object with a single key "files" containing an array of relative file paths.
Do not include any explanation or other text.

Example:
{{"files": ["src/auth/login.py", "src/models/user.py", "config/auth.yaml"]}}
"""
    
    def _curate_with_gemini(self, prompt: str) -> List[str]:
        """Use Gemini to curate files"""
        try:
            response = self.client.generate_content(prompt)
            return self._parse_ai_response(response.text)
        except Exception as e:
            print(f"Gemini curation failed: {e}")
            return []
    
    def _curate_with_claude(self, prompt: str) -> List[str]:
        """Use Claude to curate files"""
        try:
            response = self.client.messages.create(
                model="claude-3-sonnet-20240229",
                max_tokens=1000,
                messages=[{"role": "user", "content": prompt}]
            )
            return self._parse_ai_response(response.content[0].text)
        except Exception as e:
            print(f"Claude curation failed: {e}")
            return []
    
    def _curate_with_openai(self, prompt: str) -> List[str]:
        """Use OpenAI to curate files"""
        try:
            response = openai.ChatCompletion.create(
                model="gpt-4",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3
            )
            return self._parse_ai_response(response.choices[0].message.content)
        except Exception as e:
            print(f"OpenAI curation failed: {e}")
            return []
    
    def _parse_ai_response(self, response: str) -> List[str]:
        """Parse the AI response to extract file paths"""
        try:
            # Try to extract JSON from the response
            json_match = re.search(r'\{.*\}', response, re.DOTALL)
            if json_match:
                data = json.loads(json_match.group())
                return data.get("files", [])
        except:
            pass
        
        # Fallback: extract file paths directly
        paths = []
        for line in response.split('\n'):
            line = line.strip()
            if line and (line.endswith('.py') or line.endswith('.js') or 
                        line.endswith('.ts') or line.endswith('.java') or
                        line.endswith('.go') or line.endswith('.rs')):
                # Clean up the path
                line = line.strip('"\'`,-')
                if line and not line.startswith('#'):
                    paths.append(line)
        
        return paths


def load_pawsignore(cwd: Path) -> List[str]:
    """Load .pawsignore patterns"""
    pawsignore_path = cwd / PAWSIGNORE_FILENAME
    if pawsignore_path.exists():
        with open(pawsignore_path, "r") as f:
            return [line.strip() for line in f if line.strip() and not line.startswith("#")]
    return []


def get_paths_to_process(config: BundleConfig, cwd: Path) -> Dict[str, Any]:
    """Get all paths to process based on config"""
    included_paths = set()
    excluded_patterns = list(config.exclude_patterns)
    
    # Add default excludes
    if config.use_default_excludes:
        excluded_patterns.extend(DEFAULT_EXCLUDES)
        excluded_patterns.extend(load_pawsignore(cwd))
    
    # Process path specs
    for spec in config.path_specs:
        spec_path = Path(spec)
        if spec_path.is_absolute():
            if spec_path.exists():
                if spec_path.is_file():
                    included_paths.add(spec_path)
                else:
                    for file_path in spec_path.rglob("*"):
                        if file_path.is_file():
                            included_paths.add(file_path)
        else:
            # Use glob for relative paths
            matches = glob_module.glob(spec, recursive=True)
            for match in matches:
                match_path = Path(match)
                if match_path.is_file():
                    included_paths.add(match_path.resolve())
    
    # Apply exclusions
    final_paths = []
    for path in included_paths:
        should_exclude = False
        for pattern in excluded_patterns:
            if glob_module.fnmatch.fnmatch(str(path), pattern):
                should_exclude = True
                break
        if not should_exclude:
            final_paths.append(path)
    
    return {
        "paths": final_paths,
        "common_ancestor": find_common_ancestor(final_paths, cwd)
    }


def find_common_ancestor(paths: List[Path], cwd: Path) -> Path:
    """Find common ancestor directory"""
    if not paths:
        return cwd
    common = Path(os.path.commonpath([str(p) for p in paths]))
    return common if common.is_dir() else common.parent


def detect_is_binary(content_bytes: bytes) -> bool:
    """Detect if content is binary"""
    return b"\x00" in content_bytes[:1024]


def prepare_file_object(file_path: Path, common_ancestor: Path, encoding_mode: str) -> Dict[str, Any]:
    """Prepare a file object for bundling"""
    try:
        with open(file_path, "rb") as f:
            content_bytes = f.read()
        
        is_binary = detect_is_binary(content_bytes)
        rel_path = file_path.relative_to(common_ancestor)
        
        if is_binary:
            content = base64.b64encode(content_bytes).decode("ascii")
        else:
            content = content_bytes.decode(DEFAULT_ENCODING, errors="ignore")
        
        return {
            "path": str(rel_path),
            "content": content,
            "is_binary": is_binary,
            "exists": True
        }
    except Exception as e:
        print(f"Error reading {file_path}: {e}", file=sys.stderr)
        return None


def find_catscan_replacement(file_path: Path) -> Optional[Path]:
    """Find CATSCAN.md replacement for README.md (strict mode)"""
    if file_path.name.lower() == "readme.md":
        catscan_path = file_path.parent / "CATSCAN.md"
        if catscan_path.exists():
            return catscan_path
    return None


def create_bundle_string_from_objects(file_objects: List[Dict], config: BundleConfig) -> str:
    """Create the bundle string from file objects"""
    lines = []
    
    # Add headers
    lines.append(BUNDLE_HEADER_PREFIX)
    if config.prepare_for_delta:
        lines.append(f"{BUNDLE_FORMAT_PREFIX}DELTA")
    else:
        lines.append(f"{BUNDLE_FORMAT_PREFIX}FULL")
    lines.append("")
    
    # Add files
    for obj in file_objects:
        if obj is None:
            continue
        
        path = obj["path"]
        content = obj["content"]
        is_binary = obj["is_binary"]
        
        hint = f" {BASE64_HINT_TEXT}" if is_binary else ""
        lines.append(START_MARKER_TEMPLATE.format(path=path, hint=hint))
        
        if not is_binary:
            lines.append("```")
        lines.append(content)
        if not is_binary:
            lines.append("```")
        
        lines.append(END_MARKER_TEMPLATE.format(path=path, hint=hint))
        lines.append("")
    
    return "\n".join(lines)


def find_and_read_prepended_files(config: BundleConfig, cwd: Path) -> tuple:
    """Find and read persona and system prompt files"""
    persona_contents = []
    for persona_path in config.persona_files:
        if persona_path.exists():
            with open(persona_path, "r", encoding=DEFAULT_ENCODING) as f:
                persona_contents.append(f.read())
    
    sys_prompt_content = None
    if not config.no_sys_prompt:
        sys_prompt_path = cwd / config.sys_prompt_file
        if sys_prompt_path.exists():
            with open(sys_prompt_path, "r", encoding=DEFAULT_ENCODING) as f:
                sys_prompt_content = f.read()
        elif config.require_sys_prompt:
            raise FileNotFoundError(f"Required system prompt file not found: {config.sys_prompt_file}")
    
    return persona_contents, sys_prompt_content


class CatsBundler:
    """CATS bundler with AI curation support"""
    
    def __init__(self, config: BundleConfig):
        self.config = config
        self.root_path = Path(config.path_specs[0] if config.path_specs else ".")
    
    def create_bundle(self, files: Optional[List[str]] = None) -> str:
        """Create a CATS bundle with optional AI curation"""
        
        # Get files to bundle
        if self.config.ai_curate:
            files = self._get_ai_curated_files()
            if not files:
                print("AI curation failed or returned no files.")
                return ""
        
        if not files:
            # Use path specs from config
            paths_info = get_paths_to_process(self.config, Path.cwd())
            files = paths_info["paths"]
            common_ancestor = paths_info["common_ancestor"]
        else:
            # Convert string paths to Path objects
            files = [Path(f) for f in files]
            common_ancestor = find_common_ancestor(files, Path.cwd())
        
        if not files:
            print("No files specified for bundling.")
            return ""
        
        # Prepare file objects
        file_objects = []
        for file_path in files:
            # Handle CATSCAN mode
            if self.config.strict_catscan:
                replacement = find_catscan_replacement(file_path)
                if replacement:
                    file_path = replacement
            
            obj = prepare_file_object(file_path, common_ancestor, self.config.encoding_mode)
            if obj:
                file_objects.append(obj)
                if not self.config.quiet:
                    print(f"✓ Added: {obj['path']}")
        
        # Create bundle
        bundle_content = create_bundle_string_from_objects(file_objects, self.config)
        
        # Add persona and system prompt if configured
        persona_contents, sys_prompt_content = find_and_read_prepended_files(
            self.config, Path.cwd()
        )
        
        final_content = []
        
        # Add personas
        for persona in persona_contents:
            final_content.append(PERSONA_HEADER)
            final_content.append(persona)
            final_content.append(PERSONA_FOOTER)
        
        # Add system prompt
        if sys_prompt_content:
            final_content.append(sys_prompt_content)
            final_content.append(SYS_PROMPT_POST_SEPARATOR)
        
        # Add bundle
        final_content.append(bundle_content)
        
        return "\n".join(final_content)
    
    def _get_ai_curated_files(self) -> List[str]:
        """Get AI-curated list of files for the task"""
        print(f"[AI] Analyzing codebase for task: {self.config.ai_curate[:50]}...")
        
        # Build file tree
        analyzer = ProjectAnalyzer(self.root_path)
        file_tree = analyzer.build_file_tree()
        tree_str = file_tree.to_string()
        
        # Curate files with AI
        try:
            curator = AICurator(api_key=self.config.ai_key, provider=self.config.ai_provider)
            files = curator.curate_files(
                self.config.ai_curate, 
                tree_str,
                self.config.max_files
            )
            
            print(f"[AI] Selected {len(files)} files:")
            for f in files:
                print(f"  - {f}")
            
            return files
        except Exception as e:
            print(f"[AI] Curation failed: {e}")
            return []


def main():
    parser = argparse.ArgumentParser(
        description="CATS - Bundle project files for AI/LLM consumption with optional AI-powered curation"
    )
    
    # File specification
    parser.add_argument(
        "path_specs",
        nargs="*",
        help="Files or directories to include"
    )
    
    # AI curation (NEW)
    parser.add_argument(
        "--ai-curate",
        metavar="TASK",
        help="Use AI to select files based on task description"
    )
    parser.add_argument(
        "--ai-provider",
        choices=["gemini", "claude", "openai"],
        default="gemini",
        help="AI provider to use for curation"
    )
    parser.add_argument(
        "--ai-key",
        help="API key for AI provider (or set via environment variable)"
    )
    parser.add_argument(
        "--max-files",
        type=int,
        default=20,
        help="Maximum number of files to include with AI curation"
    )
    parser.add_argument(
        "--include-tests",
        action="store_true",
        help="Include test files in AI curation"
    )
    
    # Output options
    parser.add_argument(
        "-o", "--output",
        default=DEFAULT_OUTPUT_FILENAME,
        help=f"Output file (default: {DEFAULT_OUTPUT_FILENAME}). Use '-' for stdout."
    )
    
    # BACKWARD COMPATIBILITY - Exclusion patterns
    parser.add_argument(
        "-x", "--exclude",
        action="append",
        default=[],
        help="Exclude pattern (can be used multiple times)"
    )
    
    # BACKWARD COMPATIBILITY - Persona files
    parser.add_argument(
        "-p", "--persona",
        action="append",
        default=[],
        help="Persona file to prepend (can be used multiple times)"
    )
    
    # BACKWARD COMPATIBILITY - System prompt
    parser.add_argument(
        "-s", "--sys-prompt-file",
        default=DEFAULT_SYS_PROMPT_FILENAME,
        help=f"System prompt file (default: {DEFAULT_SYS_PROMPT_FILENAME})"
    )
    parser.add_argument(
        "--no-sys-prompt",
        action="store_true",
        help="Disable system prompt prepending"
    )
    parser.add_argument(
        "--require-sys-prompt",
        action="store_true",
        help="Fail if system prompt file not found"
    )
    
    # BACKWARD COMPATIBILITY - Bundle format
    parser.add_argument(
        "--prepare-for-delta",
        action="store_true",
        help="Prepare bundle for delta application"
    )
    
    # BACKWARD COMPATIBILITY - CATSCAN mode
    parser.add_argument(
        "--strict-catscan",
        action="store_true",
        help="Replace README.md with CATSCAN.md when available"
    )
    
    # BACKWARD COMPATIBILITY - Default excludes
    parser.add_argument(
        "--no-default-excludes",
        action="store_false",
        dest="use_default_excludes",
        help=f"Disable default excludes and {PAWSIGNORE_FILENAME}"
    )
    
    # BACKWARD COMPATIBILITY - Module verification
    parser.add_argument(
        "--verify",
        metavar="MODULE",
        help="Verify module and extract API"
    )
    
    # Standard options
    parser.add_argument(
        "-q", "--quiet",
        action="store_true",
        help="Suppress informational output"
    )
    parser.add_argument(
        "-y", "--yes",
        action="store_true",
        help="Auto-confirm all prompts"
    )
    
    args = parser.parse_args()
    
    # Build config
    config = BundleConfig(
        path_specs=args.path_specs or ["."],
        exclude_patterns=args.exclude,
        output_file=Path(args.output) if args.output != "-" else None,
        encoding_mode="auto",
        use_default_excludes=args.use_default_excludes,
        prepare_for_delta=args.prepare_for_delta,
        persona_files=[Path(p) for p in args.persona],
        sys_prompt_file=args.sys_prompt_file,
        no_sys_prompt=args.no_sys_prompt,
        require_sys_prompt=args.require_sys_prompt,
        strict_catscan=args.strict_catscan,
        verify=args.verify,
        quiet=args.quiet,
        yes=args.yes,
        ai_curate=args.ai_curate,
        ai_provider=args.ai_provider,
        ai_key=args.ai_key,
        max_files=args.max_files,
        include_tests=args.include_tests
    )
    
    # Run verification if requested
    if config.verify:
        run_verification(config, Path.cwd())
        return 0
    
    # Create bundler
    bundler = CatsBundler(config)
    
    # Create bundle
    bundle_content = bundler.create_bundle()
    
    if bundle_content:
        # Write to output
        if config.output_file:
            with open(config.output_file, 'w', encoding=DEFAULT_ENCODING) as f:
                f.write(bundle_content)
            if not config.quiet:
                print(f"\n✓ Bundle written to: {config.output_file}")
        else:
            print(bundle_content)
        return 0
    else:
        print("✗ Failed to create bundle")
        return 1


if __name__ == "__main__":
    sys.exit(main())