#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Tests for dogs.py AI command features
Targets uncovered lines: 487-530 (AI context requests and reinvoke)
"""

import unittest
import os
import sys
import tempfile
import shutil
from pathlib import Path
from unittest.mock import patch, Mock

sys.path.insert(0, str(Path(__file__).parent.parent))

from paws import dogs


class TestAIContextRequests(unittest.TestCase):
    """Test AI context request commands (lines 487-494)"""

    def setUp(self):
        self.test_dir = Path(tempfile.mkdtemp(prefix="dogs_ai_ctx_"))
        self.original_cwd = Path.cwd()
        os.chdir(self.test_dir)

    def tearDown(self):
        os.chdir(self.original_cwd)
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_request_context_with_reason(self):
        """Test AI context request with reason"""
        bundle = """
🐕 --- DOGS_START_FILE: test.py ---
@@ PAWS_CMD request_context(reason="Need more information") @@
🐕 --- DOGS_END_FILE: test.py ---
"""

        config = {
            "output_dir": str(self.test_dir),
            "apply_delta_from": None,
            "interactive": False,
            "auto_accept": True,
            "quiet": True,
            "allow_reinvoke": False
        }

        processor = dogs.BundleProcessor(config)

        # Should exit when context is requested
        with self.assertRaises(SystemExit) as cm:
            changeset = processor.parse_bundle(bundle)

        self.assertEqual(cm.exception.code, 0)

    def test_request_context_with_suggested_command(self):
        """Test AI context request with suggested command"""
        bundle = """
🐕 --- DOGS_START_FILE: test.py ---
@@ PAWS_CMD request_context(reason="Need test results", suggested_command="npm test") @@
🐕 --- DOGS_END_FILE: test.py ---
"""

        config = {
            "output_dir": str(self.test_dir),
            "apply_delta_from": None,
            "interactive": False,
            "auto_accept": True,
            "quiet": True,
            "allow_reinvoke": False
        }

        processor = dogs.BundleProcessor(config)

        with self.assertRaises(SystemExit) as cm:
            changeset = processor.parse_bundle(bundle)

        self.assertEqual(cm.exception.code, 0)

    def test_request_context_minimal(self):
        """Test AI context request with minimal content"""
        bundle = """
🐕 --- DOGS_START_FILE: test.py ---
@@ PAWS_CMD request_context(reason="") @@
🐕 --- DOGS_END_FILE: test.py ---
"""

        config = {
            "output_dir": str(self.test_dir),
            "apply_delta_from": None,
            "interactive": False,
            "auto_accept": True,
            "quiet": True,
            "allow_reinvoke": False
        }

        processor = dogs.BundleProcessor(config)

        # Should still exit for request_context even with empty reason
        with self.assertRaises(SystemExit) as cm:
            changeset = processor.parse_bundle(bundle)

        self.assertEqual(cm.exception.code, 0)


class TestExecuteAndReinvoke(unittest.TestCase):
    """Test execute_and_reinvoke commands (lines 495-530)"""

    def setUp(self):
        self.test_dir = Path(tempfile.mkdtemp(prefix="dogs_reinvoke_"))
        self.original_cwd = Path.cwd()
        os.chdir(self.test_dir)

    def tearDown(self):
        os.chdir(self.original_cwd)
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_execute_and_reinvoke_without_flag(self):
        """Test execute_and_reinvoke when --allow-reinvoke not set"""
        bundle = """
🐕 --- DOGS_START_FILE: test.py ---
@@ PAWS_CMD execute_and_reinvoke(command_to_run="pytest") @@
🐕 --- DOGS_END_FILE: test.py ---
"""

        config = {
            "output_dir": str(self.test_dir),
            "apply_delta_from": None,
            "interactive": False,
            "auto_accept": True,
            "quiet": True,
            "allow_reinvoke": False  # Not set
        }

        processor = dogs.BundleProcessor(config)

        # Should exit with error when allow_reinvoke is False
        with self.assertRaises(SystemExit) as cm:
            changeset = processor.parse_bundle(bundle)

        self.assertEqual(cm.exception.code, 1)

    def test_execute_and_reinvoke_with_empty_command(self):
        """Test execute_and_reinvoke with empty command"""
        bundle = """
🐕 --- DOGS_START_FILE: test.py ---
@@ PAWS_CMD execute_and_reinvoke(command_to_run="") @@
🐕 --- DOGS_END_FILE: test.py ---
"""

        config = {
            "output_dir": str(self.test_dir),
            "apply_delta_from": None,
            "interactive": False,
            "auto_accept": True,
            "quiet": True,
            "allow_reinvoke": True  # Flag set
        }

        processor = dogs.BundleProcessor(config)

        # Should exit with error when command is empty
        with self.assertRaises(SystemExit) as cm:
            changeset = processor.parse_bundle(bundle)

        self.assertEqual(cm.exception.code, 1)

    def test_execute_and_reinvoke_with_disallowed_command(self):
        """Test execute_and_reinvoke with command not in allowlist"""
        bundle = """
🐕 --- DOGS_START_FILE: test.py ---
@@ PAWS_CMD execute_and_reinvoke(command_to_run="rm -rf /") @@
🐕 --- DOGS_END_FILE: test.py ---
"""

        config = {
            "output_dir": str(self.test_dir),
            "apply_delta_from": None,
            "interactive": False,
            "auto_accept": True,
            "quiet": True,
            "allow_reinvoke": True
        }

        processor = dogs.BundleProcessor(config)

        # Should exit with error for disallowed command
        with self.assertRaises(SystemExit) as cm:
            changeset = processor.parse_bundle(bundle)

        self.assertEqual(cm.exception.code, 1)

    def test_execute_and_reinvoke_with_allowed_npm_test(self):
        """Test execute_and_reinvoke with allowed npm test command"""
        bundle = """
🐕 --- DOGS_START_FILE: test.py ---
@@ PAWS_CMD execute_and_reinvoke(command_to_run="npm test") @@
🐕 --- DOGS_END_FILE: test.py ---
"""

        config = {
            "output_dir": str(self.test_dir),
            "apply_delta_from": None,
            "interactive": False,
            "auto_accept": True,
            "quiet": True,
            "allow_reinvoke": True
        }

        processor = dogs.BundleProcessor(config)

        # Mock user input to decline execution
        with patch('builtins.input', return_value='n'):
            with self.assertRaises(SystemExit) as cm:
                changeset = processor.parse_bundle(bundle)

            self.assertEqual(cm.exception.code, 0)

    def test_execute_and_reinvoke_with_allowed_pytest(self):
        """Test execute_and_reinvoke with allowed pytest command"""
        bundle = """
🐕 --- DOGS_START_FILE: test.py ---
@@ PAWS_CMD execute_and_reinvoke(command_to_run="pytest") @@
🐕 --- DOGS_END_FILE: test.py ---
"""

        config = {
            "output_dir": str(self.test_dir),
            "apply_delta_from": None,
            "interactive": False,
            "auto_accept": True,
            "quiet": True,
            "allow_reinvoke": True
        }

        processor = dogs.BundleProcessor(config)

        with patch('builtins.input', return_value='n'):
            with self.assertRaises(SystemExit) as cm:
                changeset = processor.parse_bundle(bundle)

            self.assertEqual(cm.exception.code, 0)

    def test_execute_and_reinvoke_with_allowed_yarn(self):
        """Test execute_and_reinvoke with allowed yarn command"""
        bundle = """
🐕 --- DOGS_START_FILE: test.py ---
@@ PAWS_CMD execute_and_reinvoke(command_to_run="yarn test") @@
🐕 --- DOGS_END_FILE: test.py ---
"""

        config = {
            "output_dir": str(self.test_dir),
            "apply_delta_from": None,
            "interactive": False,
            "auto_accept": True,
            "quiet": True,
            "allow_reinvoke": True
        }

        processor = dogs.BundleProcessor(config)

        with patch('builtins.input', return_value='n'):
            with self.assertRaises(SystemExit) as cm:
                changeset = processor.parse_bundle(bundle)

            self.assertEqual(cm.exception.code, 0)

    def test_execute_and_reinvoke_with_allowed_make(self):
        """Test execute_and_reinvoke with allowed make command"""
        bundle = """
🐕 --- DOGS_START_FILE: test.py ---
@@ PAWS_CMD execute_and_reinvoke(command_to_run="make test") @@
🐕 --- DOGS_END_FILE: test.py ---
"""

        config = {
            "output_dir": str(self.test_dir),
            "apply_delta_from": None,
            "interactive": False,
            "auto_accept": True,
            "quiet": True,
            "allow_reinvoke": True
        }

        processor = dogs.BundleProcessor(config)

        with patch('builtins.input', return_value='n'):
            with self.assertRaises(SystemExit) as cm:
                changeset = processor.parse_bundle(bundle)

            self.assertEqual(cm.exception.code, 0)

    def test_execute_and_reinvoke_user_accepts(self):
        """Test execute_and_reinvoke when user accepts execution"""
        bundle = """
🐕 --- DOGS_START_FILE: test.py ---
@@ PAWS_CMD execute_and_reinvoke(command_to_run="pytest --version") @@
🐕 --- DOGS_END_FILE: test.py ---
"""

        config = {
            "output_dir": str(self.test_dir),
            "apply_delta_from": None,
            "interactive": False,
            "auto_accept": True,
            "quiet": True,
            "allow_reinvoke": True
        }

        processor = dogs.BundleProcessor(config)

        # Mock user input to accept execution
        with patch('builtins.input', return_value='y'):
            with patch('subprocess.run') as mock_run:
                mock_run.return_value = Mock(returncode=0)

                with self.assertRaises(SystemExit) as cm:
                    changeset = processor.parse_bundle(bundle)

                self.assertEqual(cm.exception.code, 0)
                # Verify subprocess.run was called
                mock_run.assert_called_once()


if __name__ == "__main__":
    unittest.main(verbosity=2)
