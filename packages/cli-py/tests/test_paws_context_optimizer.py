#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Test suite for paws_context_optimizer.py"""

import unittest
import tempfile
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent.parent))

from paws_context_optimizer import CodeModule, ContextWindow, DependencyAnalyzer, ContextOptimizer


class TestCodeModule(unittest.TestCase):
    """Test CodeModule dataclass"""

    def test_create_module(self):
        """Test creating a code module"""
        module = CodeModule(
            path=Path("test.py"),
            size_lines=100,
            imports={"os", "sys"},
            exports={"main", "helper"},
            complexity_score=5.2
        )
        self.assertEqual(module.size_lines, 100)
        self.assertEqual(len(module.imports), 2)
        self.assertEqual(len(module.exports), 2)


class TestContextWindow(unittest.TestCase):
    """Test ContextWindow dataclass"""

    def test_create_window(self):
        """Test creating a context window"""
        window = ContextWindow(
            core_files=[Path("a.py"), Path("b.py")],
            summary_files=[Path("c.py")],
            total_lines=500,
            estimated_tokens=2000
        )
        self.assertEqual(len(window.core_files), 2)
        self.assertEqual(len(window.summary_files), 1)
        self.assertEqual(window.total_lines, 500)


class TestDependencyAnalyzer(unittest.TestCase):
    """Test DependencyAnalyzer class"""

    def setUp(self):
        """Set up test environment"""
        self.temp_dir = Path(tempfile.mkdtemp(prefix="paws_optimizer_test_"))
        self.analyzer = DependencyAnalyzer(self.temp_dir)

    def tearDown(self):
        """Clean up"""
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_analyze_simple_file(self):
        """Test analyzing a simple Python file"""
        test_file = self.temp_dir / "test.py"
        test_file.write_text("import os\n\ndef hello():\n    return 'world'\n")

        module = self.analyzer.analyze_python_file(test_file)
        self.assertIsNotNone(module)
        self.assertIn("os", module.imports)
        self.assertIn("hello", module.exports)

    def test_modules_dict_exists(self):
        """Test that modules dictionary exists"""
        self.assertIsNotNone(self.analyzer.modules)
        self.assertIsInstance(self.analyzer.modules, dict)


class TestContextOptimizer(unittest.TestCase):
    """Test ContextOptimizer class"""

    def setUp(self):
        """Set up test environment"""
        self.temp_dir = Path(tempfile.mkdtemp(prefix="paws_optimizer_test_"))
        self.optimizer = ContextOptimizer(self.temp_dir, max_tokens=4000)

    def tearDown(self):
        """Clean up"""
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_init(self):
        """Test initialization"""
        self.assertEqual(self.optimizer.root_path, self.temp_dir)
        self.assertEqual(self.optimizer.max_tokens, 4000)

    def test_has_required_methods(self):
        """Test that optimizer has expected methods"""
        self.assertTrue(hasattr(self.optimizer, 'create_context_window'))
        self.assertTrue(hasattr(self.optimizer, 'create_optimized_bundle'))
        self.assertTrue(hasattr(self.optimizer, 'generate_catscan_summary'))


def suite():
    """Create test suite"""
    suite = unittest.TestSuite()
    loader = unittest.TestLoader()

    suite.addTests(loader.loadTestsFromTestCase(TestCodeModule))
    suite.addTests(loader.loadTestsFromTestCase(TestContextWindow))
    suite.addTests(loader.loadTestsFromTestCase(TestDependencyAnalyzer))
    suite.addTests(loader.loadTestsFromTestCase(TestContextOptimizer))

    return suite


if __name__ == '__main__':
    runner = unittest.TextTestRunner(verbosity=2)
    runner.run(suite())
