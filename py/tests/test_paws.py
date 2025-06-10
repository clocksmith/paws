import unittest
import os
import shutil
import sys
import tempfile
import base64
import io
from pathlib import Path
from unittest.mock import patch, MagicMock

# --- Path Setup ---
# Allows the test script to be run from the project root and find the modules.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import py.cats as cats
import py.dogs as dogs


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
            "docs": {"guide.md": "# Guide", "image.png": b"\x89PNG\r\n"},
            "tests": {"test_main.py": "# test"},
            "config.ini": "[settings]",
            ".venv": {"pyvenv.cfg": "config"},
            ".git": {"config": "[user]"},
            "sys_a.md": "CWD_SYS_PROMPT",  # For testing CWD context
        }
        create_test_files(self.test_dir, self.project_structure)

    def tearDown(self):
        os.chdir(self.original_cwd)
        shutil.rmtree(self.test_dir)

    def run_cats_cli(self, args_list, quiet=True):
        """Helper to run cats.py CLI and capture stdout."""
        cli_args = ["cats.py"] + args_list
        if quiet:
            cli_args.append("-q")

        with patch("sys.argv", cli_args), patch(
            "sys.stdout", new_callable=io.StringIO
        ) as mock_stdout, patch("builtins.input", return_value="y"):
            try:
                cats.main_cli()
            except SystemExit as e:
                self.assertEqual(e.code, 0, "CLI should exit cleanly.")
            return mock_stdout.getvalue()

    def test_glob_include_and_exclude(self):
        output = self.run_cats_cli(["src/**/*.py", "-x", "src/utils.py", "-o", "-"])
        self.assertIn("src/main.py", output)
        self.assertIn("src/api/v1.py", output)
        self.assertNotIn("src/utils.py", output)

    def test_default_excludes_and_override(self):
        # Default excludes should be active
        output = self.run_cats_cli([".", "-o", "-"])
        self.assertNotIn(".git/config", output)
        self.assertNotIn(".venv/pyvenv.cfg", output)

        # -N flag should disable default excludes
        output_no_excludes = self.run_cats_cli([".", "-N", "-o", "-"])
        self.assertIn(".git/config", output_no_excludes)
        self.assertIn(".venv/pyvenv.cfg", output_no_excludes)

    @patch("cats.find_and_read_prepended_file")
    def test_persona_and_sys_prompt_injection(self, mock_read):
        # Mock the file reading to isolate the test from the file system state
        def side_effect(file_path, header, footer, config):
            if file_path and "my_persona" in str(file_path):
                return (header + "PERSONA" + footer).encode()
            if file_path and "sys_a.md" in str(file_path):
                return (header + "SYS_PROMPT" + footer).encode()
            return b""

        mock_read.side_effect = side_effect

        output = self.run_cats_cli(
            ["config.ini", "-p", "my_persona.md", "-s", "sys_a.md", "-o", "-"]
        )

        self.assertTrue(output.startswith(cats.PERSONA_HEADER.strip()))
        self.assertIn("PERSONA", output)
        self.assertIn("SYS_PROMPT", output)
        self.assertLess(output.find("PERSONA"), output.find("SYS_PROMPT"))
        self.assertLess(output.find("SYS_PROMPT"), output.find("config.ini"))

    def test_cwd_sys_prompt_is_bundled_first(self):
        output = self.run_cats_cli(["config.ini", "-s", "sys_a.md", "-o", "-"])
        self.assertIn("CWD_SYS_PROMPT", output)
        self.assertLess(output.find("sys_a.md"), output.find("config.ini"))

    def test_symmetrical_markers_with_binary_hint(self):
        output = self.run_cats_cli(["docs/image.png", "-o", "-"])
        path_hint = f"docs/image.png {cats.BASE64_HINT_TEXT}"
        self.assertIn(
            cats.START_MARKER_TEMPLATE.format(
                path="docs/image.png", hint=f" {cats.BASE64_HINT_TEXT}"
            ),
            output,
        )
        self.assertIn(
            cats.END_MARKER_TEMPLATE.format(
                path="docs/image.png", hint=f" {cats.BASE64_HINT_TEXT}"
            ),
            output,
        )

    def test_bundling_from_outside_cwd(self):
        """Covers the ValueError traceback fix when using '../'."""
        src_dir = self.test_dir / "src"
        os.chdir(src_dir)
        # This should not crash
        output = self.run_cats_cli(["../docs/guide.md", "-o", "-"])
        self.assertIn("docs/guide.md", output)

    def test_no_files_found_exits_gracefully(self):
        with patch("sys.stderr", new_callable=io.StringIO) as mock_stderr:
            self.run_cats_cli(["nonexistent-*.glob"], quiet=False)
            self.assertIn("No files matched", mock_stderr.getvalue())


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
        bundle_path.write_text(bundle_content, encoding="utf-8")
        full_args = ["dogs.py", str(bundle_path), str(self.output_dir)] + args_list

        input_stream = [f"{i}\n" for i in user_input] if user_input else ["y\n"] * 20
        with patch("sys.argv", full_args), patch(
            "builtins.input", side_effect=input_stream
        ):
            try:
                dogs.main_cli()
            except SystemExit as e:
                self.assertEqual(e.code, 0, "CLI should exit cleanly.")

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

    def test_parser_handles_mixed_binary_and_text_hints(self):
        """Covers the `IndexError: no such group` fix."""
        binary_content_b64 = base64.b64encode(b"binary").decode()
        bundle = f"""
🐕 --- DOGS_START_FILE: text_file.txt ---
Just text.
🐕 --- DOGS_END_FILE: text_file.txt ---
🐕 --- DOGS_START_FILE: bin_file.dat (Content:Base64) ---
{binary_content_b64}
🐕 --- DOGS_END_FILE: bin_file.dat (Content:Base64) ---
"""
        self.run_dogs_cli(bundle, ["-y"])
        self.assertEqual(
            (self.output_dir / "text_file.txt").read_text().strip(), "Just text."
        )
        self.assertEqual((self.output_dir / "bin_file.dat").read_bytes(), b"binary")

    def test_parser_handles_unterminated_blocks(self):
        bundle = """
🐕 --- DOGS_START_FILE: file1.txt ---
File 1 content
🐕 --- DOGS_START_FILE: file2.txt ---
File 2 content
🐕 --- DOGS_END_FILE: file2.txt ---
🐕 --- DOGS_START_FILE: file3.txt ---
File 3 content at EOF
"""
        with patch("sys.stderr", new_callable=io.StringIO) as mock_stderr:
            self.run_dogs_cli(bundle, ["-y"], user_input=["y"] * 3)
            err_output = mock_stderr.getvalue()
            self.assertIn("started before 'file1.txt' ended", err_output)
            self.assertIn("not properly terminated. Finalizing", err_output)

        self.assertEqual(
            (self.output_dir / "file1.txt").read_text().strip(), "File 1 content"
        )
        self.assertEqual(
            (self.output_dir / "file2.txt").read_text().strip(), "File 2 content"
        )
        self.assertEqual(
            (self.output_dir / "file3.txt").read_text().strip(), "File 3 content at EOF"
        )

    def test_delete_file_command_and_confirmation(self):
        (self.output_dir / "to_delete.txt").write_text("data")
        bundle = "🐕 --- DOGS_START_FILE: to_delete.txt ---\n@@ PAWS_CMD DELETE_FILE() @@\n🐕 --- DOGS_END_FILE: to_delete.txt ---"
        # Test 'n'
        self.run_dogs_cli(bundle, [], user_input=["n"])
        self.assertTrue((self.output_dir / "to_delete.txt").exists())
        # Test 'y'
        self.run_dogs_cli(bundle, [], user_input=["y"])
        self.assertFalse((self.output_dir / "to_delete.txt").exists())

    def test_overwrite_identical_file_prompt(self):
        (self.output_dir / "file.txt").write_text("line1\nline2")
        bundle = "🐕 --- DOGS_START_FILE: file.txt ---\nline1\nline2\n🐕 --- DOGS_END_FILE: file.txt ---"
        with patch("dogs.ActionHandler._confirm_action") as mock_confirm:
            self.run_dogs_cli(bundle, [], user_input=["n"])
            mock_confirm.assert_called_with(
                "File content is identical. Overwrite anyway?", False
            )

    def test_security_prevents_path_traversal(self):
        bundle = "🐕 --- DOGS_START_FILE: ../evil.txt ---\nowned\n🐕 --- DOGS_END_FILE: ../evil.txt ---"
        with patch("sys.stderr", new_callable=io.StringIO) as mock_stderr:
            self.run_dogs_cli(bundle, ["-y"])
            self.assertIn("Security Alert", mock_stderr.getvalue())
        self.assertFalse((self.test_dir / "evil.txt").exists())

    def test_empty_bundle_exits_gracefully(self):
        with patch("sys.stderr", new_callable=io.StringIO) as mock_stderr:
            self.run_dogs_cli("", [])
            self.assertIn("No valid file blocks", mock_stderr.getvalue())


class TestFullWorkflow(unittest.TestCase):
    """Integration tests for the full cats -> dogs pipeline."""

    def setUp(self):
        self.original_cwd = Path.cwd()
        self.test_dir = Path(tempfile.mkdtemp(prefix="paws_workflow_"))
        os.chdir(self.test_dir)
        self.project_dir = self.test_dir / "project"
        self.project_dir.mkdir()
        create_test_files(
            self.project_dir,
            {"main.py": "line1\nline2\nline3\nline4\nline5\n", "utils.py": "pass"},
        )

    def tearDown(self):
        os.chdir(self.original_cwd)
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_e2e_delta_workflow(self):
        # 1. CATS: Create reference
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
🐕 --- DOGS_START_FILE: main.py ---
@@ PAWS_CMD INSERT_AFTER_LINE(1) @@
# Inserted by AI
@@ PAWS_CMD REPLACE_LINES(4, 5) @@
# Replaced lines 3 and 4 (original numbering)
🐕 --- DOGS_END_FILE: main.py ---
🐕 --- DOGS_START_FILE: utils.py ---
@@ PAWS_CMD DELETE_FILE() @@
🐕 --- DOGS_END_FILE: utils.py ---
🐕 --- DOGS_START_FILE: new_feature.js ---
console.log("new file");
🐕 --- DOGS_END_FILE: new_feature.js ---
"""
        dogs_bundle_path = self.test_dir / "dogs.md"
        dogs_bundle_path.write_text(dogs_bundle_content)

        # 3. DOGS: Apply the changes
        with patch(
            "sys.argv",
            [
                "dogs.py",
                str(dogs_bundle_path),
                str(self.project_dir),
                "-d",
                str(original_bundle_path),
                "-y",
                "-q",
            ],
        ):
            dogs.main_cli()

        # 4. Assert final state
        expected_main_py = "line1\n# Inserted by AI\nline2\n# Replaced lines 3 and 4 (original numbering)\nline5\n"
        self.assertEqual((self.project_dir / "main.py").read_text(), expected_main_py)
        self.assertFalse((self.project_dir / "utils.py").exists())
        self.assertTrue((self.project_dir / "new_feature.js").exists())


if __name__ == "__main__":
    unittest.main(verbosity=2)
