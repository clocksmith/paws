import unittest
import os
import shutil
import sys
import tempfile
import base64
import re
from pathlib import Path
from unittest.mock import patch

# --- Path Setup ---
# This allows the test script to be run from the project root (e.g., `python -m unittest discover tests`)
# and find the 'cats' and 'dogs' modules in the parent directory.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import cats
import dogs


# --- Helper Functions ---
def create_test_files(base_dir: Path, structure: dict):
    """Recursively creates a directory structure with test files and content."""
    for name, content in structure.items():
        item_path = base_dir / name
        if isinstance(content, dict):
            item_path.mkdir(parents=True, exist_ok=True)
            create_test_files(item_path, content)
        elif isinstance(content, bytes):
            item_path.write_bytes(content)
        else:
            item_path.write_text(content, encoding="utf-8")


# --- Test Suites ---


class TestCatsPy(unittest.TestCase):
    """Exhaustive tests for the cats.py bundler."""

    def setUp(self):
        self.test_dir = Path(tempfile.mkdtemp(prefix="paws_cats_"))
        self.original_cwd = Path.cwd()
        os.chdir(self.test_dir)
        self.project_structure = {
            "src": {
                "main.py": "print('hello')",
                "utils.py": "# utils",
                "api": {"v1.py": "# v1", "v1.g.dart": "// generated"},
            },
            "docs": {
                "guide.md": "# Guide",
                "image.png": b"\x89PNG\r\n",
                "sub": {"manual.md": "..."},
            },
            "assets": {"data.json": '{"key": "value"}', "icon.svg": "<svg></svg>"},
            "tests": {"test_main.py": "# test"},
            "config.ini": "[settings]\nversion=1.0",
            "service.log": "log entry",
            ".venv": {"pyvenv.cfg": "config"},
            ".git": {"config": "[user]"},
            "file with spaces.txt": "special name",
            "empty_dir": {},
        }
        create_test_files(self.test_dir, self.project_structure)

    def tearDown(self):
        os.chdir(self.original_cwd)
        shutil.rmtree(self.test_dir)

    def run_cats_cli(self, args_list, quiet=True):
        """Helper to run cats.py CLI and capture stdout."""
        if quiet:
            args_list.append("-q")
        with patch("sys.argv", ["cats.py"] + args_list):
            with patch("sys.stdout.buffer.write") as mock_write:
                with patch("builtins.input", return_value="y"):
                    try:
                        cats.main_cli()
                    except SystemExit as e:
                        # Allow successful exits
                        if e.code != 0:
                            raise
                return (
                    mock_write.call_args[0][0].decode() if mock_write.call_args else ""
                )

    def test_default_output_filename(self):
        self.run_cats_cli(["."], quiet=False)  # Run non-quietly to ensure it runs
        self.assertTrue(Path("cats.md").exists())

    def test_glob_include_recursive(self):
        output = self.run_cats_cli(["src/**/*.py", "-o", "-"])
        self.assertIn("src/main.py", output)
        self.assertIn("src/utils.py", output)
        self.assertIn("src/api/v1.py", output)
        self.assertNotIn("guide.md", output)

    def test_glob_multiple_patterns(self):
        output = self.run_cats_cli(["**/*.md", "**/*.json", "-o", "-"])
        self.assertIn("docs/guide.md", output)
        self.assertIn("docs/sub/manual.md", output)
        self.assertIn("assets/data.json", output)
        self.assertNotIn("main.py", output)

    def test_glob_exclude(self):
        output = self.run_cats_cli([".", "-x", "**/*.py", "-x", "*.json", "-o", "-"])
        self.assertIn("guide.md", output)
        self.assertNotIn("main.py", output)
        self.assertNotIn("data.json", output)

    def test_glob_exclude_wildcard_for_generated_files(self):
        output = self.run_cats_cli([".", "-x", "*.g.dart", "-o", "-"])
        self.assertIn("src/api/v1.py", output)
        self.assertNotIn("src/api/v1.g.dart", output)

    def test_default_excludes_are_active(self):
        output = self.run_cats_cli([".", "-o", "-"])
        self.assertNotIn(".git/config", output)
        self.assertNotIn(".venv/pyvenv.cfg", output)

    def test_no_default_excludes_flag(self):
        output = self.run_cats_cli([".", "-N", "-o", "-"])
        self.assertIn(".git/config", output)
        self.assertIn(".venv/pyvenv.cfg", output)

    def test_persona_and_sys_prompt_injection_order(self):
        (self.test_dir / "my_persona.md").write_text("PERSONA")
        (self.test_dir / "sys_a.md").write_text("SYS_PROMPT")

        script_dir = Path(cats.__file__).resolve().parent
        shutil.copy(self.test_dir / "sys_a.md", script_dir / "sys_a.md")

        output = self.run_cats_cli(
            ["config.ini", "-p", "my_persona.md", "-s", "sys_a.md", "-o", "-"]
        )

        self.assertTrue(output.startswith(cats.PERSONA_HEADER.strip()))
        persona_end_idx = output.find(cats.PERSONA_FOOTER.strip())
        sys_prompt_end_idx = output.find(cats.SYS_PROMPT_POST_SEPARATOR.strip())
        bundle_header_idx = output.find(cats.BUNDLE_HEADER_PREFIX)

        self.assertLess(persona_end_idx, sys_prompt_end_idx)
        self.assertLess(sys_prompt_end_idx, bundle_header_idx)
        self.assertIn("PERSONA", output)
        self.assertIn("SYS_PROMPT", output)

        os.remove(script_dir / "sys_a.md")

    def test_symmetrical_markers_with_binary_hint(self):
        output = self.run_cats_cli(["docs/image.png", "-o", "-"])
        path_hint = "docs/image.png (Content:Base64)"
        self.assertIn(f"--- CATS_START_FILE: {path_hint} ---", output)
        self.assertIn(f"--- CATS_END_FILE: {path_hint} ---", output)

    def test_file_with_spaces_in_name_is_bundled(self):
        output = self.run_cats_cli(["file with spaces.txt", "-o", "-"])
        self.assertIn("--- CATS_START_FILE: file with spaces.txt ---", output)

    def test_delta_preparation_flag(self):
        output = self.run_cats_cli([".", "-t", "-o", "-"])
        self.assertIn(cats.DELTA_REFERENCE_HINT_PREFIX, output)

    def test_force_base64_encoding(self):
        output = self.run_cats_cli(["src/main.py", "-E", "b64", "-o", "-"])
        self.assertIn("# Format: Base64", output)
        # Verify content is actually base64
        content_part = output.split("---")[2].strip()
        self.assertEqual(base64.b64decode(content_part).decode(), "print('hello')")


class TestDogsPy(unittest.TestCase):
    """Exhaustive tests for the dogs.py unpacker."""

    def setUp(self):
        self.test_dir = Path(tempfile.mkdtemp(prefix="paws_dogs_"))
        self.output_dir = self.test_dir / "output"
        self.output_dir.mkdir()

    def tearDown(self):
        shutil.rmtree(self.test_dir)

    def run_dogs_cli(self, bundle_content, args_list, user_input=None):
        """Helper to run dogs.py CLI and mock user input."""
        bundle_path = self.test_dir / "test.md"
        bundle_path.write_text(bundle_content)

        full_args = ["dogs.py", str(bundle_path), str(self.output_dir)] + args_list

        with patch("sys.argv", full_args):
            with patch(
                "builtins.input", side_effect=user_input if user_input else ["y"] * 20
            ):
                with patch("sys.stdout.write"):
                    dogs.main_cli()

    def test_parser_handles_all_llm_artifacts(self):
        bundle = """
I think this is what you wanted. Let me know!
```
🐕 --- DOGS_START_FILE: script.js ---
```javascript
// This is the code
console.log('ok');
```
🐕 --- DOGS_END_FILE: script.js ---
```
Hope that helps!
"""
        self.run_dogs_cli(bundle, ["-y"])
        self.assertEqual(
            (self.output_dir / "script.js").read_text().strip(),
            "// This is the code\nconsole.log('ok');",
        )

    def test_parser_handles_empty_content_and_fences(self):
        bundle = "🐕 --- DOGS_START_FILE: empty.js ---\n```\n```\n🐕 --- DOGS_END_FILE: empty.js ---"
        self.run_dogs_cli(bundle, ["-y"])
        self.assertTrue((self.output_dir / "empty.js").exists())
        self.assertEqual((self.output_dir / "empty.js").read_text(), "")

    def test_delete_file_command_and_confirmation_flow(self):
        file_to_delete = self.output_dir / "to_delete.txt"
        file_to_delete.write_text("delete me")
        bundle = "🐕 --- DOGS_START_FILE: to_delete.txt ---\n@@ PAWS_CMD DELETE_FILE() @@\n🐕 --- DOGS_END_FILE: to_delete.txt ---"

        # Test 'n'
        self.run_dogs_cli(bundle, [], user_input=["n"])
        self.assertTrue(file_to_delete.exists())

        # Test 'y'
        self.run_dogs_cli(bundle, [], user_input=["y"])
        self.assertFalse(file_to_delete.exists())

    def test_diff_on_overwrite_and_no_diff_on_identical(self):
        (self.output_dir / "file.txt").write_text("old line")
        bundle_diff = "🐕 --- DOGS_START_FILE: file.txt ---\nnew line\n🐕 --- DOGS_END_FILE: file.txt ---"
        bundle_no_diff = "🐕 --- DOGS_START_FILE: file.txt ---\nold line\n🐕 --- DOGS_END_FILE: file.txt ---"

        with patch("builtins.print") as mock_print:
            self.run_dogs_cli(bundle_diff, [], user_input=["n"])
            self.assertTrue(
                any(
                    "--- a/file.txt" in str(call.args)
                    for call in mock_print.call_args_list
                )
            )

        with patch("builtins.print") as mock_print:
            self.run_dogs_cli(bundle_no_diff, [])  # No input needed as it should skip
            mock_print.assert_any_call(
                "  Info: No changes detected for file.txt. Skipping."
            )

    def test_interactive_sequence_y_n_a_s_q(self):
        files = ["f1.txt", "f2.txt", "f3.txt", "f4.txt", "f5.txt", "f6.txt"]
        for f in files:
            (self.output_dir / f).write_text(f"old {f}")

        bundle = ""
        for f in files:
            bundle += f"🐕 --- DOGS_START_FILE: {f} ---\nnew {f}\n🐕 --- DOGS_END_FILE: {f} ---\n"

        self.run_dogs_cli(
            bundle, [], user_input=["y", "n", "a", "s", "q"]
        )  # Provide more inputs than needed

        self.assertEqual((self.output_dir / "f1.txt").read_text(), "new f1")  # y -> yes
        self.assertEqual((self.output_dir / "f2.txt").read_text(), "old f2")  # n -> no
        self.assertEqual(
            (self.output_dir / "f3.txt").read_text(), "new f3"
        )  # a -> always yes
        self.assertEqual(
            (self.output_dir / "f4.txt").read_text(), "new f4"
        )  # a -> still in effect
        # Now test 's' after 'a'. The test logic for ActionHandler needs to be robust for this.
        # A simple implementation might just keep `always_yes`. A better one respects the last global command.
        # Assuming the implementation is simple: 'a' wins. If we wanted 's' to override, the logic would be more complex.
        # Let's test the simple case where 'a' persists.
        # A more realistic sequence would be y, n, s, (a and q are terminal for the session's logic)
        self.assertEqual((self.output_dir / "f5.txt").read_text(), "new f5")


class TestFullWorkflow(unittest.TestCase):
    """Integration tests for the full cats -> dogs pipeline."""

    def setUp(self):
        self.test_dir = Path(tempfile.mkdtemp(prefix="paws_workflow_"))
        os.chdir(self.test_dir)
        self.project_dir = self.test_dir / "project"
        self.project_dir.mkdir()
        create_test_files(
            self.project_dir,
            {
                "main.py": "line1\nline2\nline3\nline4\nline5\n",
                "utils.py": "def helper(): pass",
                "data": {"records.csv": "id,value\n1,100"},
            },
        )

    def tearDown(self):
        os.chdir(Path.cwd().parent)  # Go up one level before removing
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_e2e_delta_create_delete(self):
        # 1. CATS: Create the original reference bundle
        original_bundle_path = self.test_dir / "original.md"
        with patch(
            "sys.argv",
            [
                "cats.py",
                str(self.project_dir),
                "-t",
                "-o",
                str(original_bundle_path),
                "-q",
            ],
        ):
            cats.main_cli()
        self.assertTrue(original_bundle_path.exists())

        # 2. Simulate LLM delta response
        dogs_bundle_content = """
🐕 --- DOGS_START_FILE: project/main.py ---
@@ PAWS_CMD INSERT_AFTER_LINE(1) @@
# Inserted by AI
@@ PAWS_CMD REPLACE_LINES(3, 4) @@
# Replaced by AI
🐕 --- DOGS_END_FILE: project/main.py ---
🐕 --- DOGS_START_FILE: project/utils.py ---
@@ PAWS_CMD DELETE_FILE() @@
🐕 --- DOGS_END_FILE: project/utils.py ---
🐕 --- DOGS_START_FILE: project/new_feature.js ---
console.log("new file");
🐕 --- DOGS_END_FILE: project/new_feature.js ---
"""
        dogs_bundle_path = self.test_dir / "dogs.md"
        dogs_bundle_path.write_text(dogs_bundle_content)

        # 3. DOGS: Apply the changes
        output_dir = self.test_dir / "final_project"
        shutil.copytree(self.project_dir, output_dir)

        with patch(
            "sys.argv",
            [
                "dogs.py",
                str(dogs_bundle_path),
                str(output_dir),
                "-d",
                str(original_bundle_path),
                "-y",
                "-q",
            ],
        ):
            dogs.main_cli()

        # 4. Assert the final state
        expected_main_py = "line1\n# Inserted by AI\nline2\n# Replaced by AI\nline5\n"
        self.assertEqual((output_dir / "main.py").read_text(), expected_main_py)

        self.assertFalse((output_dir / "utils.py").exists())

        self.assertTrue((output_dir / "new_feature.js").exists())
        self.assertEqual(
            (output_dir / "new_feature.js").read_text(), 'console.log("new file");'
        )

        self.assertTrue((output_dir / "data" / "records.csv").exists())


if __name__ == "__main__":
    print("--- Running PAWS/SWAP Test Suite ---")
    # This makes the script runnable from the command line for easy testing.
    # The recommended way is `python -m unittest discover tests` from the root.
    suite = unittest.TestSuite()
    loader = unittest.TestLoader()
    suite.addTest(loader.loadTestsFromTestCase(TestCatsPy))
    suite.addTest(loader.loadTestsFromTestCase(TestDogsPy))
    suite.addTest(loader.loadTestsFromTestCase(TestFullWorkflow))
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    if not result.wasSuccessful():
        sys.exit(1)
