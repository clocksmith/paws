#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PAWS Context Optimizer - Handle 500K+ line refactors

Strategies:
- Hierarchical chunking with CATSCAN summaries
- Dependency graph analysis
- Smart context windowing
- Iterative refinement with context expansion
"""

import argparse
import json
import sys
import ast
from pathlib import Path
from dataclasses import dataclass
from typing import List, Dict, Set, Optional, Any
import subprocess


@dataclass
class CodeModule:
    """Represents a code module with metadata"""
    path: Path
    size_lines: int
    imports: Set[str]
    exports: Set[str]  # Public API
    complexity_score: float
    summary: Optional[str] = None


@dataclass
class ContextWindow:
    """A context window for a specific task"""
    core_files: List[Path]
    summary_files: List[Path]  # Files to include as CATSCAN summaries only
    total_lines: int
    estimated_tokens: int


class DependencyAnalyzer:
    """Analyze code dependencies to build optimal context windows"""

    def __init__(self, root_path: Path):
        self.root_path = root_path
        self.modules: Dict[str, CodeModule] = {}

    def analyze_python_file(self, file_path: Path) -> CodeModule:
        """Analyze a Python file"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                lines = content.count('\n') + 1

            tree = ast.parse(content, filename=str(file_path))

            imports = set()
            exports = set()

            for node in ast.walk(tree):
                if isinstance(node, ast.Import):
                    for alias in node.names:
                        imports.add(alias.name)
                elif isinstance(node, ast.ImportFrom):
                    if node.module:
                        imports.add(node.module)
                elif isinstance(node, (ast.FunctionDef, ast.ClassDef)):
                    if not node.name.startswith('_'):
                        exports.add(node.name)

            # Simple complexity score based on AST depth
            complexity = len(list(ast.walk(tree))) / 100.0

            return CodeModule(
                path=file_path,
                size_lines=lines,
                imports=imports,
                exports=exports,
                complexity_score=complexity
            )

        except Exception as e:
            print(f"Warning: Could not analyze {file_path}: {e}")
            return CodeModule(
                path=file_path,
                size_lines=0,
                imports=set(),
                exports=set(),
                complexity_score=0.0
            )

    def build_dependency_graph(self, files: List[Path]) -> Dict[str, Set[str]]:
        """Build a dependency graph from files"""
        graph = {}

        for file_path in files:
            if file_path.suffix == '.py':
                module = self.analyze_python_file(file_path)
                self.modules[str(file_path)] = module

                # Build graph edges
                module_name = str(file_path)
                graph[module_name] = set()

                for imp in module.imports:
                    # Try to resolve import to file path
                    for other_path in files:
                        if imp in str(other_path):
                            graph[module_name].add(str(other_path))

        return graph

    def find_dependencies(self, file_path: Path, graph: Dict[str, Set[str]],
                         max_depth: int = 2) -> Set[str]:
        """Find transitive dependencies up to max_depth"""
        dependencies = set()
        to_visit = [(str(file_path), 0)]
        visited = set()

        while to_visit:
            current, depth = to_visit.pop(0)

            if current in visited or depth > max_depth:
                continue

            visited.add(current)
            dependencies.add(current)

            if current in graph:
                for dep in graph[current]:
                    if dep not in visited:
                        to_visit.append((dep, depth + 1))

        return dependencies


class ContextOptimizer:
    """Optimize context windows for large codebases"""

    def __init__(self, root_path: Path, max_tokens: int = 100000):
        self.root_path = root_path
        self.max_tokens = max_tokens
        self.max_lines = max_tokens // 4  # Rough estimate: 4 tokens per line
        self.analyzer = DependencyAnalyzer(root_path)

    def generate_catscan_summary(self, file_path: Path) -> str:
        """Generate a CATSCAN summary for a file"""
        module = self.analyzer.modules.get(str(file_path))

        if not module:
            return f"# {file_path.name}\n\nFile not analyzed."

        summary_lines = [
            f"# {file_path.name}",
            f"",
            f"**Size:** {module.size_lines} lines",
            f"**Complexity:** {module.complexity_score:.2f}",
            f"",
            f"## Public API",
            ""
        ]

        for export in sorted(module.exports):
            summary_lines.append(f"- `{export}`")

        summary_lines.extend([
            "",
            "## Dependencies",
            ""
        ])

        for imp in sorted(module.imports):
            summary_lines.append(f"- `{imp}`")

        return "\n".join(summary_lines)

    def create_context_window(self, task: str, relevant_files: List[Path]) -> ContextWindow:
        """Create an optimized context window for a task"""
        print(f"\n☉ Optimizing context window...")
        print(f"Analyzing {len(relevant_files)} files...")

        # Build dependency graph
        graph = self.analyzer.build_dependency_graph(relevant_files)

        # Rank files by relevance
        ranked_files = self._rank_files_by_relevance(task, relevant_files, graph)

        # Allocate to core vs summary
        core_files = []
        summary_files = []
        total_lines = 0

        for file_path in ranked_files:
            module = self.analyzer.modules.get(str(file_path))
            if not module:
                continue

            # If adding this file keeps us under limit, add to core
            if total_lines + module.size_lines < self.max_lines * 0.7:  # Reserve 30% for summaries
                core_files.append(file_path)
                total_lines += module.size_lines
            else:
                summary_files.append(file_path)

        # Estimate tokens
        estimated_tokens = total_lines * 4 + len(summary_files) * 100  # Summaries are small

        print(f"\n☉ Context window created:")
        print(f"  Core files (full content): {len(core_files)}")
        print(f"  Summary files (CATSCAN): {len(summary_files)}")
        print(f"  Total lines: {total_lines}")
        print(f"  Estimated tokens: {estimated_tokens}")

        return ContextWindow(
            core_files=core_files,
            summary_files=summary_files,
            total_lines=total_lines,
            estimated_tokens=estimated_tokens
        )

    def _rank_files_by_relevance(self, task: str, files: List[Path],
                                 graph: Dict[str, Set[str]]) -> List[Path]:
        """Rank files by relevance to task"""
        # Simple heuristic: keyword matching + dependency centrality
        task_keywords = set(task.lower().split())

        scores = {}
        for file_path in files:
            score = 0.0

            # Keyword matching
            file_name_lower = str(file_path).lower()
            for keyword in task_keywords:
                if keyword in file_name_lower:
                    score += 10.0

            # Dependency centrality (how many files depend on this one)
            dependents = sum(1 for deps in graph.values() if str(file_path) in deps)
            score += dependents * 2.0

            # Module complexity (prefer simpler files in core)
            module = self.analyzer.modules.get(str(file_path))
            if module:
                score -= module.complexity_score * 0.5

            scores[file_path] = score

        return sorted(files, key=lambda f: scores.get(f, 0), reverse=True)

    def create_optimized_bundle(self, window: ContextWindow, output_path: Path):
        """Create an optimized CATS bundle with hierarchical content"""
        lines = []

        lines.append("# Optimized Context Bundle")
        lines.append("# Generated by PAWS Context Optimizer")
        lines.append("")
        lines.append(f"## Context Strategy")
        lines.append(f"- Core files (full): {len(window.core_files)}")
        lines.append(f"- Summary files: {len(window.summary_files)}")
        lines.append(f"- Total estimated tokens: {window.estimated_tokens}")
        lines.append("")

        # Core files with full content
        lines.append("## Core Files (Full Content)")
        lines.append("")

        for file_path in window.core_files:
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()

                rel_path = file_path.relative_to(self.root_path)
                lines.append(f"🐈 --- CATS_START_FILE: {rel_path} ---")
                lines.append(f"```{file_path.suffix[1:]}")
                lines.append(content)
                lines.append("```")
                lines.append(f"🐈 --- CATS_END_FILE: {rel_path} ---")
                lines.append("")

            except Exception as e:
                print(f"Warning: Could not read {file_path}: {e}")

        # Summary files
        if window.summary_files:
            lines.append("## Related Files (CATSCAN Summaries)")
            lines.append("")
            lines.append("The following files are relevant but summarized to save tokens:")
            lines.append("")

            for file_path in window.summary_files:
                rel_path = file_path.relative_to(self.root_path)
                summary = self.generate_catscan_summary(file_path)
                lines.append(f"### {rel_path}")
                lines.append(summary)
                lines.append("")

        # Write bundle
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write("\n".join(lines))

        print(f"\n☉ Optimized bundle written to: {output_path}")


def main():
    parser = argparse.ArgumentParser(
        description="PAWS Context Optimizer - Handle massive codebases"
    )

    parser.add_argument("task", nargs='?', help="Task description for context optimization")
    parser.add_argument("--files", nargs='+', help="Files to include (or use --scan)")
    parser.add_argument("--scan", help="Scan directory for relevant files")
    parser.add_argument("--output", default="optimized_context.md", help="Output bundle path")
    parser.add_argument("--max-tokens", type=int, default=100000, help="Maximum tokens for context window")

    args = parser.parse_args()

    # Interactive prompts
    task = args.task or input("Enter task description:\n> ")

    # Determine files
    if args.files:
        files = [Path(f) for f in args.files]
    elif args.scan:
        scan_path = Path(args.scan)
        files = list(scan_path.rglob("*.py")) + list(scan_path.rglob("*.js"))
        print(f"Scanned {len(files)} files from {scan_path}")
    else:
        print("Error: Either --files or --scan required")
        return 1

    # Create optimizer
    root_path = Path.cwd()
    optimizer = ContextOptimizer(root_path, max_tokens=args.max_tokens)

    # Create optimized window
    window = optimizer.create_context_window(task, files)

    # Generate bundle
    output_path = Path(args.output)
    optimizer.create_optimized_bundle(window, output_path)

    print(f"\n☉ Context optimization complete!")
    print(f"Use this optimized bundle with:")
    print(f"  paws-paxos \"{task}\" {output_path} --verify-cmd \"pytest\"")

    return 0


if __name__ == "__main__":
    sys.exit(main())
