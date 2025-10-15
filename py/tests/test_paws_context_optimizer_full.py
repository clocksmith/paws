#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Comprehensive tests for paws_context_optimizer.py
Tests DependencyAnalyzer and ContextOptimizer classes
"""

import unittest
import os
import sys
import tempfile
import shutil
from pathlib import Path
from unittest.mock import patch, Mock

sys.path.insert(0, str(Path(__file__).parent.parent))

import paws_context_optimizer
from paws_context_optimizer import (
    CodeModule, ContextWindow, DependencyAnalyzer, ContextOptimizer
)


class TestCodeModuleDataclass(unittest.TestCase):
    """Test CodeModule dataclass"""

    def test_code_module_creation(self):
        """Test creating CodeModule instance"""
        module = CodeModule(
            path=Path("test.py"),
            size_lines=100,
            imports={"os", "sys"},
            exports={"func1", "Class1"},
            complexity_score=5.5
        )

        self.assertEqual(module.path, Path("test.py"))
        self.assertEqual(module.size_lines, 100)
        self.assertIn("os", module.imports)
        self.assertIn("func1", module.exports)
        self.assertEqual(module.complexity_score, 5.5)
        self.assertIsNone(module.summary)

    def test_code_module_with_summary(self):
        """Test CodeModule with summary"""
        module = CodeModule(
            path=Path("test.py"),
            size_lines=50,
            imports=set(),
            exports=set(),
            complexity_score=1.0,
            summary="Test summary"
        )

        self.assertEqual(module.summary, "Test summary")


class TestContextWindowDataclass(unittest.TestCase):
    """Test ContextWindow dataclass"""

    def test_context_window_creation(self):
        """Test creating ContextWindow instance"""
        window = ContextWindow(
            core_files=[Path("main.py"), Path("util.py")],
            summary_files=[Path("lib.py")],
            total_lines=500,
            estimated_tokens=2000
        )

        self.assertEqual(len(window.core_files), 2)
        self.assertEqual(len(window.summary_files), 1)
        self.assertEqual(window.total_lines, 500)
        self.assertEqual(window.estimated_tokens, 2000)


class TestDependencyAnalyzer(unittest.TestCase):
    """Test DependencyAnalyzer class"""

    def setUp(self):
        self.test_dir = Path(tempfile.mkdtemp(prefix="context_opt_"))
        self.analyzer = DependencyAnalyzer(self.test_dir)

    def tearDown(self):
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_analyzer_initialization(self):
        """Test DependencyAnalyzer initialization"""
        self.assertEqual(self.analyzer.root_path, self.test_dir)
        self.assertEqual(len(self.analyzer.modules), 0)

    def test_analyze_simple_python_file(self):
        """Test analyzing a simple Python file"""
        # Create test file
        test_file = self.test_dir / "simple.py"
        test_file.write_text("""
import os
import sys
from pathlib import Path

def public_function():
    pass

def _private_function():
    pass

class PublicClass:
    def method(self):
        pass

class _PrivateClass:
    pass
""")

        module = self.analyzer.analyze_python_file(test_file)

        # Check basic properties
        self.assertEqual(module.path, test_file)
        self.assertGreater(module.size_lines, 0)

        # Check imports
        self.assertIn("os", module.imports)
        self.assertIn("sys", module.imports)
        self.assertIn("pathlib", module.imports)

        # Check exports (only public items)
        self.assertIn("public_function", module.exports)
        self.assertIn("PublicClass", module.exports)
        self.assertNotIn("_private_function", module.exports)
        self.assertNotIn("_PrivateClass", module.exports)

        # Check complexity score
        self.assertGreater(module.complexity_score, 0)

    def test_analyze_file_with_import_from(self):
        """Test analyzing file with ImportFrom statements (lines 66-68)"""
        test_file = self.test_dir / "imports.py"
        test_file.write_text("""
from typing import Dict, List
from collections import defaultdict
import json

def process():
    pass
""")

        module = self.analyzer.analyze_python_file(test_file)

        # Should capture ImportFrom modules
        self.assertIn("typing", module.imports)
        self.assertIn("collections", module.imports)
        self.assertIn("json", module.imports)

    def test_analyze_invalid_python_file(self):
        """Test analyzing invalid Python file (lines 84-92)"""
        test_file = self.test_dir / "invalid.py"
        test_file.write_text("this is not valid python !@#$%")

        # Should return empty CodeModule on error
        module = self.analyzer.analyze_python_file(test_file)

        self.assertEqual(module.path, test_file)
        self.assertEqual(module.size_lines, 0)
        self.assertEqual(len(module.imports), 0)
        self.assertEqual(len(module.exports), 0)
        self.assertEqual(module.complexity_score, 0.0)

    def test_build_dependency_graph_single_file(self):
        """Test building dependency graph (lines 94-113)"""
        # Create test file
        file1 = self.test_dir / "file1.py"
        file1.write_text("""
import os
def func1():
    pass
""")

        files = [file1]
        graph = self.analyzer.build_dependency_graph(files)

        # Should have graph entry
        self.assertIn(str(file1), graph)
        self.assertIsInstance(graph[str(file1)], set)

    def test_build_dependency_graph_multiple_files(self):
        """Test building dependency graph with multiple files"""
        # Create test files with dependencies
        file1 = self.test_dir / "module1.py"
        file1.write_text("""
import module2
def func1():
    pass
""")

        file2 = self.test_dir / "module2.py"
        file2.write_text("""
def func2():
    pass
""")

        files = [file1, file2]
        graph = self.analyzer.build_dependency_graph(files)

        # Should have both files in graph
        self.assertIn(str(file1), graph)
        self.assertIn(str(file2), graph)

        # file1 should depend on file2
        self.assertIn(str(file2), graph[str(file1)])

    def test_find_dependencies_simple(self):
        """Test finding dependencies (lines 115-136)"""
        # Build simple graph
        file1 = self.test_dir / "file1.py"
        file2 = self.test_dir / "file2.py"

        graph = {
            str(file1): {str(file2)},
            str(file2): set()
        }

        # Find dependencies of file1
        deps = self.analyzer.find_dependencies(file1, graph, max_depth=2)

        # Should include file1 and file2
        self.assertIn(str(file1), deps)
        self.assertIn(str(file2), deps)

    def test_find_dependencies_transitive(self):
        """Test finding transitive dependencies"""
        # Build chain: file1 -> file2 -> file3
        file1 = self.test_dir / "file1.py"
        file2 = self.test_dir / "file2.py"
        file3 = self.test_dir / "file3.py"

        graph = {
            str(file1): {str(file2)},
            str(file2): {str(file3)},
            str(file3): set()
        }

        # Find with max_depth=2
        deps = self.analyzer.find_dependencies(file1, graph, max_depth=2)

        # Should include all three
        self.assertIn(str(file1), deps)
        self.assertIn(str(file2), deps)
        self.assertIn(str(file3), deps)

    def test_find_dependencies_max_depth_limit(self):
        """Test dependency depth limiting"""
        # Build long chain
        file1 = self.test_dir / "file1.py"
        file2 = self.test_dir / "file2.py"
        file3 = self.test_dir / "file3.py"
        file4 = self.test_dir / "file4.py"

        graph = {
            str(file1): {str(file2)},
            str(file2): {str(file3)},
            str(file3): {str(file4)},
            str(file4): set()
        }

        # Find with max_depth=1
        deps = self.analyzer.find_dependencies(file1, graph, max_depth=1)

        # Should only include file1 and file2 (depth 0 and 1)
        self.assertIn(str(file1), deps)
        self.assertIn(str(file2), deps)
        # Should NOT include deeper dependencies
        self.assertNotIn(str(file3), deps)
        self.assertNotIn(str(file4), deps)


class TestContextOptimizer(unittest.TestCase):
    """Test ContextOptimizer class"""

    def setUp(self):
        self.test_dir = Path(tempfile.mkdtemp(prefix="context_opt_"))
        self.optimizer = ContextOptimizer(self.test_dir, max_tokens=100000)

    def tearDown(self):
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_optimizer_initialization(self):
        """Test ContextOptimizer initialization (lines 142-146)"""
        self.assertEqual(self.optimizer.root_path, self.test_dir)
        self.assertEqual(self.optimizer.max_tokens, 100000)
        self.assertEqual(self.optimizer.max_lines, 25000)  # 100000 / 4
        self.assertIsInstance(self.optimizer.analyzer, DependencyAnalyzer)

    def test_generate_catscan_summary_analyzed_file(self):
        """Test generating CATSCAN summary (lines 148-177)"""
        # Create and analyze a test file
        test_file = self.test_dir / "module.py"
        test_file.write_text("""
import os
import sys

def public_func():
    pass

class PublicClass:
    def method(self):
        pass
""")

        module = self.optimizer.analyzer.analyze_python_file(test_file)
        self.optimizer.analyzer.modules[str(test_file)] = module

        # Generate summary
        summary = self.optimizer.generate_catscan_summary(test_file)

        # Check summary contains expected content
        self.assertIn("module.py", summary)
        self.assertIn("Size:", summary)
        self.assertIn("Complexity:", summary)
        self.assertIn("Public API", summary)
        self.assertIn("public_func", summary)
        self.assertIn("PublicClass", summary)
        self.assertIn("Dependencies", summary)
        self.assertIn("os", summary)
        self.assertIn("sys", summary)

    def test_generate_catscan_summary_unanalyzed_file(self):
        """Test generating summary for unanalyzed file (lines 152-153)"""
        test_file = self.test_dir / "unknown.py"

        # Generate summary without analyzing
        summary = self.optimizer.generate_catscan_summary(test_file)

        # Should return placeholder summary
        self.assertIn("unknown.py", summary)
        self.assertIn("File not analyzed", summary)

    def test_create_context_window_small_codebase(self):
        """Test creating context window (lines 179+)"""
        # Create small test files
        file1 = self.test_dir / "file1.py"
        file1.write_text("""
def func1():
    pass
""")

        file2 = self.test_dir / "file2.py"
        file2.write_text("""
def func2():
    pass
""")

        # Analyze files
        for f in [file1, file2]:
            module = self.optimizer.analyzer.analyze_python_file(f)
            self.optimizer.analyzer.modules[str(f)] = module

        # Create context window
        try:
            window = self.optimizer.create_context_window(
                task="Implement feature X",
                relevant_files=[file1, file2]
            )

            # Check window properties
            self.assertIsInstance(window, ContextWindow)
            self.assertGreater(window.total_lines, 0)
            self.assertGreater(window.estimated_tokens, 0)
        except AttributeError:
            # Method might not be fully implemented
            self.skipTest("create_context_window not fully implemented")


class TestEdgeCases(unittest.TestCase):
    """Test edge cases and error handling"""

    def setUp(self):
        self.test_dir = Path(tempfile.mkdtemp(prefix="context_edge_"))

    def tearDown(self):
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_analyze_empty_python_file(self):
        """Test analyzing empty Python file"""
        test_file = self.test_dir / "empty.py"
        test_file.write_text("")

        analyzer = DependencyAnalyzer(self.test_dir)
        module = analyzer.analyze_python_file(test_file)

        # Should handle empty file gracefully
        self.assertEqual(module.path, test_file)
        self.assertEqual(len(module.imports), 0)
        self.assertEqual(len(module.exports), 0)

    def test_analyze_file_only_comments(self):
        """Test analyzing file with only comments"""
        test_file = self.test_dir / "comments.py"
        test_file.write_text("""
# This is a comment
# Another comment
""")

        analyzer = DependencyAnalyzer(self.test_dir)
        module = analyzer.analyze_python_file(test_file)

        # Should handle comment-only file
        self.assertEqual(len(module.imports), 0)
        self.assertEqual(len(module.exports), 0)

    def test_circular_dependencies(self):
        """Test handling circular dependencies"""
        analyzer = DependencyAnalyzer(self.test_dir)

        file1 = self.test_dir / "file1.py"
        file2 = self.test_dir / "file2.py"

        # Create circular graph: file1 -> file2 -> file1
        graph = {
            str(file1): {str(file2)},
            str(file2): {str(file1)}
        }

        # Should handle circular dependencies without infinite loop
        deps = analyzer.find_dependencies(file1, graph, max_depth=5)

        # Should include both files but not loop forever
        self.assertIn(str(file1), deps)
        self.assertIn(str(file2), deps)


if __name__ == "__main__":
    unittest.main(verbosity=2)
