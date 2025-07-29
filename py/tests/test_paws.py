import unittest
import os
import shutil
import sys
import tempfile
import base64
import io
from pathlib import Path
from unittest.mock import patch, MagicMock, ANY

# --- Path Setup ---
# Ensures the test script can find the modules when run from the project root.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
from py import cats, dogs

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

def run_cli(module, args_list, user_input=None, expect_exit_code=0, bundle_content=None):
    """A robust helper to run a CLI module and capture all I/O."""
    cli_args = [f"py/{module.__name__}.py"] + args_list
    
    # Prepare stdin if bundle content is provided for piping
    stdin_patch = patch('sys.stdin', io.StringIO(bundle_content or ""))

    # If not piping, create a temporary file for the bundle
    if bundle_content is not None and "-" not in args_list and not any(arg.endswith('.md') for arg in args_list):
        bundle_path = Path(tempfile.gettempdir()) / f"paws_test_bundle_{os.urandom(4).hex()}.md"
        bundle_path.write_text(bundle_content, encoding="utf-8")
        cli_args.insert(1, str(bundle_path))
    else:
        bundle_path = None

    input_patch = patch('builtins.input', side_effect=user_input if user_input else ["y\n"] * 50)
    argv_patch = patch('sys.argv', cli_args)
    stdout_patch = patch('sys.stdout', new_callable=io.StringIO)
    stderr_patch = patch('sys.stderr', new_callable=io.StringIO)

    with argv_patch, stdout_patch as mock_stdout, stderr_patch as mock_stderr, input_patch, stdin_patch:
        try:
            module.main_cli()
        except SystemExit as e:
            if e.code != expect_exit_code:
                raise AssertionError(
                    f"CLI exited with code {e.code}, expected {expect_exit_code}. Stderr:\n{mock_stderr.getvalue()}"
                ) from e
        finally:
            if bundle_path and bundle_path.exists():
                bundle_path.unlink()

    return mock_stdout.getvalue(), mock_stderr.getvalue()

# --- Test Suite for cats.py (75 Tests) ---

class TestCatsPyComprehensive(unittest.TestCase):
    """Exhaustive test suite for cats.py with 75 distinct test cases."""
    def setUp(self):
        self.test_dir = Path(tempfile.mkdtemp(prefix="paws_cats_"))
        self.original_cwd = Path.cwd()
        os.chdir(self.test_dir)
        create_test_files(self.test_dir, {
            "src": { 
                "main.py": "print(1)", 
                "utils": {
                    "helpers.py": "# helpers",
                    "README.md": "Utils README",
                    "CATSCAN.md": "Utils Summary"
                },
                "data": {"db.py": "# db", "README.md": "Data README"}
            },
            "docs": {"guide.md": "# Guide", "img.png": b'\x89PNG'},
            ".pawsignore": "*.log\nbuild/\n.DS_Store",
            "app.log": "secret", "build": {"asset": "file"},
            "personas": {"coder.md": "coder", "reviewer.md": "reviewer", "sys_h5.md": "default"},
            "sys": {"sys_a.md": "system prompt"}
        })

    def tearDown(self):
        os.chdir(self.original_cwd)
        shutil.rmtree(self.test_dir)

    # Basic Inclusion (15 Tests)
    def test_include_single_file(self): stdout, _ = run_cli(cats, ["src/main.py", "-o", "-"]); self.assertIn("src/main.py", stdout)
    def test_include_directory_recursively(self): stdout, _ = run_cli(cats, ["src", "-o", "-"]); self.assertIn("src/main.py", stdout); self.assertIn("src/utils/helpers.py", stdout)
    def test_include_glob_pattern(self): stdout, _ = run_cli(cats, ["src/**/*.py", "-o", "-"]); self.assertIn("src/main.py", stdout); self.assertIn("src/utils/helpers.py", stdout)
    def test_include_multiple_paths(self): stdout, _ = run_cli(cats, ["src/main.py", "docs/guide.md", "-o", "-"]); self.assertIn("src/main.py", stdout); self.assertIn("docs/guide.md", stdout)
    def test_output_to_file(self): run_cli(cats, ["src/main.py", "-o", "bundle.md"]); self.assertTrue(Path("bundle.md").exists())
    def test_output_to_stdout(self): stdout, _ = run_cli(cats, ["src/main.py", "-o", "-"]); self.assertIn("print(1)", stdout)
    def test_binary_file_is_base64_encoded(self): stdout, _ = run_cli(cats, ["docs/img.png", "-o", "-"]); self.assertIn(base64.b64encode(b'\x89PNG').decode(), stdout)
    def test_empty_file_is_included(self): Path("empty.txt").touch(); stdout, _ = run_cli(cats, ["empty.txt", "-o", "-"]); self.assertIn("empty.txt", stdout)
    def test_dotfile_is_included_by_default(self): Path(".config").write_text("c"); stdout, _ = run_cli(cats, [".config", "-o", "-"]); self.assertIn(".config", stdout)
    def test_quiet_mode_suppresses_logs(self): _, stderr = run_cli(cats, ["src", "-o", "-", "--quiet"]); self.assertEqual(stderr.strip(), "")
    def test_verbose_mode_shows_logs(self): _, stderr = run_cli(cats, ["src", "-o", "b.md"]); self.assertIn("Info:", stderr)
    def test_path_with_spaces(self): Path("a file.txt").touch(); stdout, _ = run_cli(cats, ["a file.txt", "-o", "-"]); self.assertIn("a file.txt", stdout)
    def test_multiple_globs(self): stdout, _ = run_cli(cats, ["src/*.py", "docs/*.md", "-o", "-"]); self.assertIn("src/main.py", stdout); self.assertIn("docs/guide.md", stdout)
    def test_no_paths_provided_fails(self): run_cli(cats, ["-y"], expect_exit_code=2)
    def test_yes_flag_skips_confirmation(self): run_cli(cats, ["src", "-o", "bundle.md", "-y"], user_input=[]) # Should not hang

    # Exclusion Logic (20 Tests)
    def test_exclude_flag_removes_file(self): stdout, _ = run_cli(cats, ["src", "-x", "src/main.py", "-o", "-"]); self.assertNotIn("src/main.py", stdout)
    def test_exclude_flag_removes_dir(self): stdout, _ = run_cli(cats, ["src", "-x", "src/utils", "-o", "-"]); self.assertNotIn("src/utils/helpers.py", stdout)
    def test_exclude_flag_with_glob(self): stdout, _ = run_cli(cats, ["src", "-x", "src/**/*.py", "-o", "-"]); self.assertNotIn(".py", stdout)
    def test_multiple_exclude_flags(self): stdout, _ = run_cli(cats, ["src", "-x", "src/main.py", "-x", "src/utils/helpers.py", "-o", "-"]); self.assertNotIn("main.py", stdout); self.assertNotIn("helpers.py", stdout)
    def test_pawsignore_is_used_by_default(self): stdout, _ = run_cli(cats, ["."], "-o", "-"); self.assertNotIn("app.log", stdout); self.assertNotIn("build/asset", stdout)
    def test_pawsignore_wildcard(self): stdout, _ = run_cli(cats, ["."], "-o", "-"); self.assertNotIn("app.log", stdout)
    def test_pawsignore_directory(self): stdout, _ = run_cli(cats, ["."], "-o", "-"); self.assertNotIn("build/asset", stdout)
    def test_no_default_excludes_ignores_pawsignore(self): stdout, _ = run_cli(cats, [".", "-N", "-o", "-"]); self.assertIn("app.log", stdout); self.assertIn("build/asset", stdout)
    def test_default_excludes_remove_git(self): stdout, _ = run_cli(cats, ["."], "-o", "-"); self.assertNotIn(".git", stdout)
    def test_no_default_excludes_includes_git(self): Path(".git").mkdir(); stdout, _ = run_cli(cats, [".", "-N", "-o", "-"]); self.assertIn(".git", stdout)
    def test_output_file_is_auto_excluded(self): run_cli(cats, [".", "-o", "bundle.md"]); stdout, _ = run_cli(cats, [".", "-o", "-"]); self.assertNotIn("bundle.md", stdout)
    def test_exclude_takes_precedence_over_include(self): stdout, _ = run_cli(cats, ["src/main.py", "-x", "src/main.py", "-o", "-"]); self.assertNotIn("src/main.py", stdout)
    def test_exclude_dotfile(self): Path(".env").touch(); stdout, _ = run_cli(cats, [".", "-x", ".env", "-o", "-"]); self.assertNotIn(".env", stdout)
    def test_exclude_path_with_spaces(self): Path("exclude me.txt").touch(); stdout, _ = run_cli(cats, [".", "-x", "exclude me.txt", "-o", "-"]); self.assertNotIn("exclude me.txt", stdout)
    def test_empty_pawsignore_file(self): Path(".pawsignore").write_text("\n\n"); stdout, _ = run_cli(cats, ["app.log", "-o", "-"]); self.assertIn("app.log", stdout)
    def test_pawsignore_comments_are_ignored(self): Path(".pawsignore").write_text("#*.log"); stdout, _ = run_cli(cats, ["app.log", "-o", "-"]); self.assertIn("app.log", stdout)
    def test_exclude_nested_pawsignore_is_not_supported(self): Path("src/.pawsignore").write_text("main.py"); stdout, _ = run_cli(cats, ["src", "-o", "-"]); self.assertIn("main.py", stdout)
    def test_exclude_from_parent_directory(self): os.chdir("src"); stdout, _ = run_cli(cats, [".", "-x", "../docs", "-o", "-"]); self.assertIn("main.py", stdout); self.assertNotIn("guide.md", stdout)
    def test_complex_glob_exclusion(self): stdout, _ = run_cli(cats, ["src", "-x", "src/u*/*helpers.py", "-o", "-"]); self.assertNotIn("helpers.py", stdout)
    def test_persona_files_are_excluded(self): stdout, _ = run_cli(cats, [".", "-p", "personas/coder.md", "-o", "-"]); self.assertNotIn("personas/coder.md", stdout)

    # CATSCAN & Summarization (20 Tests)
    def test_summary_prefix_works(self): stdout, _ = run_cli(cats, ["summary:src/utils", "-o", "-"]); self.assertIn("Utils Summary", stdout); self.assertNotIn("helpers.py", stdout)
    def test_summary_and_full_include_mix(self): stdout, _ = run_cli(cats, ["src/main.py", "summary:src/utils", "-o", "-"]); self.assertIn("main.py", stdout); self.assertIn("Utils Summary", stdout)
    def test_summary_on_dir_without_catscan_includes_nothing(self): stdout, _ = run_cli(cats, ["summary:src/data", "-o", "-"]); self.assertNotIn("db.py", stdout); self.assertNotIn("Data README", stdout)
    def test_summary_glob(self): stdout, _ = run_cli(cats, ["summary:src/*", "-o", "-"]); self.assertIn("Utils Summary", stdout); self.assertNotIn("Data README", stdout)
    def test_strict_catscan_fails_if_readme_no_catscan(self): run_cli(cats, ["src/data", "--strict-catscan", "-o", "b.md"], expect_exit_code=1)
    def test_strict_catscan_passes_if_catscan_exists(self): run_cli(cats, ["src/utils", "--strict-catscan", "-o", "b.md"])
    def test_strict_catscan_passes_if_no_readme(self): Path("no_readme/file.py").parent.mkdir(); Path("no_readme/file.py").touch(); run_cli(cats, ["no_readme", "--strict-catscan", "-o", "b.md"])
    def test_summary_is_case_insensitive(self): stdout, _ = run_cli(cats, ["SUMMARY:src/utils", "-o", "-"]); self.assertIn("Utils Summary", stdout)
    def test_summary_excludes_file_in_summarized_dir(self): stdout, _ = run_cli(cats, ["src/utils", "summary:src/utils", "-o", "-"]); self.assertIn("Utils Summary", stdout); self.assertNotIn("helpers.py", stdout)
    def test_verify_mode_runs(self): _, stderr = run_cli(cats, ["--verify", "src"]); self.assertIn("Verification Complete", stderr)
    def test_verify_on_nonexistent_path_fails(self): run_cli(cats, ["--verify", "nonexistent"], expect_exit_code=1)
    def test_verify_finds_catscans(self): _, stderr = run_cli(cats, ["--verify", "src"]); self.assertIn("Verifying: src/utils", stderr)
    def test_verify_skips_if_no_catscans(self): _, stderr = run_cli(cats, ["--verify", "docs"]); self.assertIn("No CATSCAN.md files found", stderr)
    def test_verify_python_parser(self): _, stderr = run_cli(cats, ["--verify", "src"]); self.assertIn("Verifying: src/utils", stderr)
    def test_summary_and_exclude(self): stdout, _ = run_cli(cats, ["src", "summary:src/utils", "-x", "src/main.py", "-o", "-"]); self.assertNotIn("main.py", stdout); self.assertIn("Utils Summary", stdout)
    def test_deeply_nested_summary(self): (self.test_dir / "a/b/c").mkdir(parents=True); (self.test_dir / "a/b/CATSCAN.md").write_text("B"); stdout, _ = run_cli(cats, ["summary:a", "-o", "-"]); self.assertIn("B", stdout)
    def test_catscan_itself_is_not_summarized(self): stdout, _ = run_cli(cats, ["src/utils/CATSCAN.md", "summary:src/utils", "-o", "-"]); self.assertEqual(stdout.count("Utils Summary"), 1)
    def test_summary_does_not_add_files_outside_scope(self): stdout, _ = run_cli(cats, ["summary:docs", "-o", "-"]); self.assertNotIn("CATSCAN", stdout)
    def test_prepare_for_delta_adds_header(self): stdout, _ = run_cli(cats, ["src/main.py", "-o", "-", "--prepare-for-delta"]); self.assertIn("# Delta Reference: Yes", stdout)
    def test_no_prepare_for_delta_no_header(self): stdout, _ = run_cli(cats, ["src/main.py", "-o", "-"]); self.assertNotIn("# Delta Reference: Yes", stdout)

    # Persona & System Prompts (10 Tests)
    def test_single_persona(self): stdout, _ = run_cli(cats, ["src", "-p", "personas/coder.md", "-o", "-"]); self.assertIn("coder persona", stdout)
    def test_multiple_personas(self): stdout, _ = run_cli(cats, ["src", "-p", "personas/coder.md", "-p", "personas/reviewer.md", "-o", "-"]); self.assertIn("coder", stdout); self.assertIn("reviewer", stdout)
    def test_persona_order_is_preserved(self): stdout, _ = run_cli(cats, ["src", "-p", "personas/reviewer.md", "-p", "personas/coder.md", "-o", "-"]); self.assertLess(stdout.find("reviewer"), stdout.find("coder"))
    def test_missing_persona_file_is_warned(self): _, stderr = run_cli(cats, ["src", "-p", "nonexistent.md", "-o", "b.md"]); self.assertIn("Warning:", stderr)
    def test_default_sys_prompt_is_used(self): stdout, _ = run_cli(cats, ["src", "-o", "-"]); self.assertIn("system prompt", stdout)
    def test_custom_sys_prompt_is_used(self): Path("custom.md").write_text("custom"); stdout, _ = run_cli(cats, ["src", "-s", "custom.md", "-o", "-"]); self.assertIn("custom", stdout)
    def test_no_sys_prompt_flag(self): stdout, _ = run_cli(cats, ["src", "--no-sys-prompt", "-o", "-"]); self.assertNotIn("system prompt", stdout)
    def test_require_sys_prompt_fails_if_missing(self): run_cli(cats, ["src", "-s", "nonexistent.md", "--require-sys-prompt", "-o", "-"], expect_exit_code=1)
    def test_persona_and_sys_prompt_correct_order(self): stdout, _ = run_cli(cats, ["src", "-p", "personas/coder.md", "-o", "-"]); self.assertLess(stdout.find("coder"), stdout.find("system prompt"))
    def test_default_persona_if_none_provided(self): stdout, _ = run_cli(cats, ["src", "-o", "-"]); self.assertIn("default", stdout)

    # Final Edge Cases (10 Tests)
    def test_unreadable_file_is_skipped_with_warning(self): unreadable = Path("unreadable.txt"); unreadable.touch(); unreadable.chmod(0o000); _, stderr = run_cli(cats, ["."]); self.assertIn("Warning: Skipping unreadable file", stderr)
    def test_bundle_empty_dir(self): Path("empty").mkdir(); run_cli(cats, ["empty"])
    def test_bundle_dir_with_only_ignored_files(self): Path("ignored/file.log").mkdir(parents=True); run_cli(cats, ["ignored"], expect_exit_code=0)
    def test_stdin_is_not_tty_no_prompt(self): with patch('sys.stdin.isatty', return_value=False): run_cli(cats, ["src", "-o", "bundle.md"], user_input=[]) # Should not hang
    def test_user_cancel_stops_execution(self): run_cli(cats, ["src", "-o", "bundle.md"], user_input=['n'], expect_exit_code=0)
    def test_force_b64_encoding(self): stdout, _ = run_cli(cats, ["src/main.py", "--force-encoding", "b64", "-o", "-"]); self.assertIn(base64.b64encode(b'print(1)').decode(), stdout)
    def test_hidden_file_inclusion(self): Path(".hidden").write_text("h"); stdout, _ = run_cli(cats, [".hidden", "-o", "-"]); self.assertIn(".hidden", stdout)
    def test_very_long_path(self): long_path = Path("a/b/c/d/e/f/g/h/i/j/k/l/m/n/o/p/file.txt"); long_path.parent.mkdir(parents=True); long_path.touch(); stdout, _ = run_cli(cats, [str(long_path), "-o", "-"]); self.assertIn(str(long_path), stdout)
    def test_symlink_to_file(self): Path("target.txt").write_text("tgt"); Path("link.txt").symlink_to("target.txt"); stdout, _ = run_cli(cats, ["link.txt", "-o", "-"]); self.assertIn("tgt", stdout)
    def test_symlink_to_dir(self): d = Path("realdir"); d.mkdir(); (d / "f.txt").touch(); Path("linkdir").symlink_to(d, target_is_directory=True); stdout, _ = run_cli(cats, ["linkdir", "-o", "-"]); self.assertIn("linkdir/f.txt", stdout)

# --- Test Suite for dogs.py (75 Tests) ---

class TestDogsPyParser(unittest.TestCase):
    """(25 Tests) Focus: Testing the BundleParser's ability to handle diverse and malformed inputs."""
    def setUp(self):
        self.config = dogs.ExtractionConfig(None, Path("."), None, "prompt", False, False, False, True)
    
    def parse(self, bundle_str):
        return dogs.BundleParser(bundle_str.splitlines(), self.config).parse()

    def test_p01_empty_bundle(self): self.assertEqual(self.parse(""), [])
    def test_p02_only_chatter(self): self.assertEqual(self.parse("Hello AI"), [])
    def test_p03_simple_valid_file(self): files = self.parse("🐕 --- DOGS_START_FILE: a.txt ---\nc\n🐕 --- DOGS_END_FILE: a.txt ---"); self.assertEqual(len(files), 1); self.assertEqual(files[0]['path'], 'a.txt')
    def test_p04_malformed_start_marker(self): self.assertEqual(self.parse("🐕 -- DOGS_START_FILE: a.txt ---\nc\n🐕 --- DOGS_END_FILE: a.txt ---"), [])
    def test_p05_malformed_end_marker_is_recovered(self): files = self.parse("🐕 --- DOGS_START_FILE: a.txt ---\nc\n🐕 --- DOGS_END_FILE: a.txt --"); self.assertEqual(len(files), 1)
    def test_p06_windows_line_endings(self): files = self.parse("🐕 --- DOGS_START_FILE: a.txt ---\r\nc\r\n🐕 --- DOGS_END_FILE: a.txt ---"); self.assertEqual(files[0]['content_bytes'], b'c')
    def test_p07_empty_file_block(self): files = self.parse("🐕 --- DOGS_START_FILE: a.txt ---\n\n🐕 --- DOGS_END_FILE: a.txt ---"); self.assertEqual(files[0]['content_bytes'], b'')
    def test_p08_delete_command_parsing(self): files = self.parse("🐕 --- DOGS_START_FILE: a.txt ---\n@@ PAWS_CMD DELETE_FILE() @@\n🐕 --- DOGS_END_FILE: a.txt ---"); self.assertEqual(files[0]['action'], 'delete')
    def test_p09_complex_arg_string_parsing(self): cmd = self.parse('🐕 --- DOGS_START_FILE: a.txt ---\n@@ PAWS_CMD EXECUTE_AND_REINVOKE(reason="a \\" b", command_to_run="c") @@\n🐕 --- DOGS_END_FILE: a.txt ---')[0]; self.assertEqual(cmd['args']['reason'], 'a " b')
    def test_p10_unterminated_final_block(self): files = self.parse("🐕 --- DOGS_START_FILE: a.txt ---\nc"); self.assertEqual(len(files), 1)
    def test_p11_mismatched_end_marker(self): files = self.parse("🐕 --- DOGS_START_FILE: a.txt ---\nc\n🐕 --- DOGS_END_FILE: b.txt ---"); self.assertEqual(len(files), 1); self.assertEqual(files[0]['path'], 'a.txt')
    def test_p12_chatter_between_files(self): files = self.parse("🐕 --- DOGS_START_FILE: a.txt ---\nc\n🐕 --- DOGS_END_FILE: a.txt ---\nchatter\n🐕 --- DOGS_START_FILE: b.txt ---\nc2\n🐕 --- DOGS_END_FILE: b.txt ---"); self.assertEqual(len(files), 2)
    def test_p13_chatter_inside_file(self): files = self.parse("🐕 --- DOGS_START_FILE: a.txt ---\nline1\nOkay, here is the next part:\nline2\n🐕 --- DOGS_END_FILE: a.txt ---"); self.assertEqual(files[0]['content_bytes'], b'line1\nOkay, here is the next part:\nline2')
    def test_p14_code_fences_are_stripped(self): files = self.parse("🐕 --- DOGS_START_FILE: a.txt ---\n```python\ncode\n```\n🐕 --- DOGS_END_FILE: a.txt ---"); self.assertEqual(files[0]['content_bytes'], b'code')
    def test_p15_whitespace_around_markers(self): files = self.parse("  🐕 --- DOGS_START_FILE: a.txt ---  \nc\n  🐕 --- DOGS_END_FILE: a.txt ---  "); self.assertEqual(len(files), 1)
    def test_p16_case_insensitivity_of_markers(self): files = self.parse("🐕 --- dogs_start_file: a.txt ---\nc\n🐕 --- dogs_end_file: a.txt ---"); self.assertEqual(len(files), 1)
    def test_p17_binary_content_parsing(self): b64 = base64.b64encode(b'bin').decode(); files = self.parse(f"🐕 --- DOGS_START_FILE: a.bin (Content:Base64) ---\n{b64}\n🐕 --- DOGS_END_FILE: a.bin (Content:Base64) ---"); self.assertEqual(files[0]['content_bytes'], b'bin')
    def test_p18_multiple_commands_in_one_file(self): files = self.parse("🐕 --- DOGS_START_FILE: a.txt ---\n@@ PAWS_CMD INSERT_AFTER_LINE(0) @@\nheader\n@@ PAWS_CMD DELETE_LINES(1,1) @@\n🐕 --- DOGS_END_FILE: a.txt ---"); self.assertEqual(len(files[0]['delta_commands']), 2)
    def test_p19_command_with_no_content(self): files = self.parse("🐕 --- DOGS_START_FILE: a.txt ---\n@@ PAWS_CMD DELETE_LINES(1,1) @@\n🐕 --- DOGS_END_FILE: a.txt ---"); self.assertEqual(files[0]['delta_commands'][0]['type'], 'delete_lines')
    def test_p20_unrecognized_paws_cmd_is_content(self): files = self.parse("🐕 --- DOGS_START_FILE: a.txt ---\n@@ PAWS_CMD UNKNOWN() @@\n🐕 --- DOGS_END_FILE: a.txt ---"); self.assertIn(b"UNKNOWN", files[0]['content_bytes'])
    def test_p21_interleaved_start_markers(self): files = self.parse("🐕 --- DOGS_START_FILE: a.txt ---\nc1\n🐕 --- DOGS_START_FILE: b.txt ---\nc2\n🐕 --- DOGS_END_FILE: b.txt ---"); self.assertEqual(len(files), 2); self.assertEqual(files[0]['path'], 'a.txt')
    def test_p22_rsi_marker_parsing(self): rsi_config = dogs.ExtractionConfig(None, Path("."), None, "prompt", False, True, False, True); files = dogs.BundleParser("⛓️ --- RSI_LINK_START_FILE: a.txt --- ⛓️\nc\n⛓️ --- RSI_LINK_END_FILE: a.txt --- ⛓️".splitlines(), rsi_config).parse(); self.assertEqual(len(files), 1)
    def test_p23_path_with_spaces_and_special_chars(self): path = "src/my file (new).txt"; files = self.parse(f"🐕 --- DOGS_START_FILE: {path} ---\nc\n🐕 --- DOGS_END_FILE: {path} ---"); self.assertEqual(files[0]['path'], path)
    def test_p24_request_context_parsing(self): files = self.parse('🐕 --- DOGS_START_FILE: a.txt ---\n@@ PAWS_CMD REQUEST_CONTEXT(reason="test") @@\n🐕 --- DOGS_END_FILE: a.txt ---'); self.assertEqual(files[0]['type'], 'request_context')
    def test_p25_marker_in_content_is_just_content(self): files = self.parse("🐕 --- DOGS_START_FILE: a.txt ---\nSome text\n🐕 --- DOGS_START_FILE: fake.txt ---\nMore text\n🐕 --- DOGS_END_FILE: a.txt ---"); self.assertIn(b"fake.txt", files[0]['content_bytes'])

class TestDogsPyDeltaLogic(unittest.TestCase):
    """(25 Tests) Focus: Testing the ActionHandler's delta validation and application logic."""
    def setUp(self):
        self.handler = dogs.ActionHandler(dogs.ExtractionConfig(None, Path("."), None, "yes", False, False, False, True))
        self.original = "L1\nL2\nL3\nL4\nL5\nL6\nL7\nL8\nL9\nL10".splitlines()

    def test_d01_validate_passes_correct_sequence(self): self.handler._validate_deltas(self.original, [{"type": "insert", "line_num": 1}, {"type": "replace", "start": 5, "end": 5}], "p")
    def test_d02_validate_catches_out_of_order(self): with self.assertRaises(ValueError): self.handler._validate_deltas(self.original, [{"type": "replace", "start": 5, "end": 5}, {"type": "insert", "line_num": 1}], "p")
    def test_d03_validate_catches_out_of_bounds(self): with self.assertRaises(ValueError): self.handler._validate_deltas(self.original, [{"type": "replace", "start": 10, "end": 11}], "p")
    def test_d04_validate_allows_multiple_inserts_at_line_0(self): self.handler._validate_deltas(self.original, [{"type": "insert", "line_num": 0}, {"type": "insert", "line_num": 0}], "p")
    def test_d05_apply_single_replace(self): result = self.handler._apply_deltas(self.original, [{"type": "replace", "start": 5, "end": 5, "content_lines": ["NEW"]}]); self.assertEqual(result[4], "NEW")
    def test_d06_apply_single_insert(self): result = self.handler._apply_deltas(self.original, [{"type": "insert", "line_num": 5, "content_lines": ["NEW"]}]); self.assertEqual(result[5], "NEW")
    def test_d07_apply_single_delete(self): result = self.handler._apply_deltas(self.original, [{"type": "delete_lines", "start": 5, "end": 5}]); self.assertEqual(len(result), 9); self.assertEqual(result[4], "L4")
    def test_d08_apply_multi_line_replace(self): result = self.handler._apply_deltas(self.original, [{"type": "replace", "start": 2, "end": 4, "content_lines": ["X"]}]); self.assertEqual(result[1], "X"); self.assertEqual(len(result), 8)
    def test_d09_apply_multi_line_delete(self): result = self.handler._apply_deltas(self.original, [{"type": "delete_lines", "start": 2, "end": 4}]); self.assertEqual(result[1], "L1"); self.assertEqual(len(result), 7)
    def test_d10_apply_insert_at_start(self): result = self.handler._apply_deltas(self.original, [{"type": "insert", "line_num": 0, "content_lines": ["S"]}]); self.assertEqual(result[0], "S")
    def test_d11_apply_insert_at_end(self): result = self.handler._apply_deltas(self.original, [{"type": "insert", "line_num": 10, "content_lines": ["E"]}]); self.assertEqual(result[10], "E")
    def test_d12_apply_replace_entire_file(self): result = self.handler._apply_deltas(self.original, [{"type": "replace", "start": 1, "end": 10, "content_lines": ["ALL"]}]); self.assertEqual(result, ["ALL"])
    def test_d13_apply_delete_entire_file(self): result = self.handler._apply_deltas(self.original, [{"type": "delete_lines", "start": 1, "end": 10}]); self.assertEqual(result, [])
    def test_d14_apply_no_op_replace(self): result = self.handler._apply_deltas(self.original, [{"type": "replace", "start": 3, "end": 3, "content_lines": ["L3"]}]); self.assertEqual(result, self.original)
    def test_d15_apply_complex_sequence(self): cmds=[{"type":"insert","line_num":0,"content_lines":["S"]},{"type":"replace","start":2,"end":3,"content_lines":["X"]},{"type":"delete_lines","start":5,"end":5}]; res=self.handler._apply_deltas(self.original,cmds); self.assertEqual("\n".join(res), "S\nL1\nX\nL4")
    def test_d16_delta_fails_if_reference_bundle_is_missing(self): with self.assertRaises(IOError): dogs.ActionHandler(dogs.ExtractionConfig(None, Path("."), Path("bad.md"), "y", 0,0,0,1))
    def test_d17_delta_fails_if_file_not_in_reference(self): h = dogs.ActionHandler(dogs.ExtractionConfig(None, Path("."), None, "y", 0,0,0,1)); with self.assertRaises(FileNotFoundError): h.process_actions([{"action": "delta", "path": "p", "delta_commands": []}])
    def test_d18_apply_insert_with_empty_content(self): result = self.handler._apply_deltas(self.original, [{"type": "insert", "line_num": 5, "content_lines": []}]); self.assertEqual(result, self.original)
    def test_d19_apply_replace_with_empty_content_is_delete(self): result = self.handler._apply_deltas(self.original, [{"type": "replace", "start": 5, "end": 5, "content_lines": []}]); self.assertEqual(len(result), 9)
    def test_d20_apply_replace_one_line_with_many(self): result = self.handler._apply_deltas(self.original, [{"type": "replace", "start": 5, "end": 5, "content_lines": ["A","B"]}]); self.assertEqual(len(result), 11)
    def test_d21_apply_replace_many_lines_with_one(self): result = self.handler._apply_deltas(self.original, [{"type": "replace", "start": 5, "end": 7, "content_lines": ["A"]}]); self.assertEqual(len(result), 8)
    def test_d22_validate_delete_range(self): self.handler._validate_deltas(self.original, [{"type": "delete_lines", "start": 1, "end": 10}], "p")
    def test_d23_validate_fails_if_start_greater_than_end(self): with self.assertRaises(ValueError): self.handler._validate_deltas(self.original, [{"type": "replace", "start": 5, "end": 4}], "p")
    def test_d24_apply_adjacent_inserts(self): cmds=[{"type":"insert","line_num":2,"content_lines":["A"]},{"type":"insert","line_num":2,"content_lines":["B"]}]; res=self.handler._apply_deltas(self.original,cmds); self.assertEqual(res[2],"A");self.assertEqual(res[3],"B")
    def test_d25_apply_replace_at_file_end(self): result = self.handler._apply_deltas(self.original, [{"type": "replace", "start": 10, "end": 10, "content_lines": ["END"]}]); self.assertEqual(result[-1], "END")

class TestDogsPyEndToEnd(unittest.TestCase):
    """(25 Tests) Focus: High-level CLI tests covering user interaction and file system changes."""
    def setUp(self):
        self.test_dir = Path(tempfile.mkdtemp(prefix="paws_e2e_"))
        self.output_dir = self.test_dir / "output"
        self.output_dir.mkdir()

    def tearDown(self):
        shutil.rmtree(self.test_dir)

    def test_e01_create_file(self): run_cli(dogs, ["-", str(self.output_dir), "-y"], bundle_content="🐕 --- DOGS_START_FILE: a.txt ---\nc\n🐕 --- DOGS_END_FILE: a.txt ---"); self.assertTrue((self.output_dir / "a.txt").exists())
    def test_e02_create_file_in_new_subdir(self): run_cli(dogs, ["-", str(self.output_dir), "-y"], bundle_content="🐕 --- DOGS_START_FILE: new/a.txt ---\nc\n🐕 --- DOGS_END_FILE: new/a.txt ---"); self.assertTrue((self.output_dir / "new/a.txt").exists())
    def test_e03_overwrite_denied(self): (self.output_dir/"a.txt").write_text("orig"); run_cli(dogs, ["-", str(self.output_dir)], user_input=['n'], bundle_content="🐕 --- DOGS_START_FILE: a.txt ---\nnew\n🐕 --- DOGS_END_FILE: a.txt ---"); self.assertEqual((self.output_dir/"a.txt").read_text(), "orig")
    def test_e04_overwrite_confirmed(self): (self.output_dir/"a.txt").write_text("orig"); run_cli(dogs, ["-", str(self.output_dir)], user_input=['y'], bundle_content="🐕 --- DOGS_START_FILE: a.txt ---\nnew\n🐕 --- DOGS_END_FILE: a.txt ---"); self.assertEqual((self.output_dir/"a.txt").read_text(), "new\n")
    def test_e05_no_flag_skips_overwrite(self): (self.output_dir/"a.txt").write_text("orig"); run_cli(dogs, ["-", str(self.output_dir), "-n"], bundle_content="🐕 --- DOGS_START_FILE: a.txt ---\nnew\n🐕 --- DOGS_END_FILE: a.txt ---"); self.assertEqual((self.output_dir/"a.txt").read_text(), "orig")
    def test_e06_yes_flag_forces_overwrite(self): (self.output_dir/"a.txt").write_text("orig"); run_cli(dogs, ["-", str(self.output_dir), "-y"], bundle_content="🐕 --- DOGS_START_FILE: a.txt ---\nnew\n🐕 --- DOGS_END_FILE: a.txt ---"); self.assertEqual((self.output_dir/"a.txt").read_text(), "new\n")
    def test_e07_delete_denied(self): (self.output_dir/"a.txt").touch(); run_cli(dogs, ["-", str(self.output_dir)], user_input=['n'], bundle_content="🐕 --- DOGS_START_FILE: a.txt ---\n@@ PAWS_CMD DELETE_FILE() @@\n🐕 --- DOGS_END_FILE: a.txt ---"); self.assertTrue((self.output_dir/"a.txt").exists())
    def test_e08_delete_confirmed(self): (self.output_dir/"a.txt").touch(); run_cli(dogs, ["-", str(self.output_dir)], user_input=['y'], bundle_content="🐕 --- DOGS_START_FILE: a.txt ---\n@@ PAWS_CMD DELETE_FILE() @@\n🐕 --- DOGS_END_FILE: a.txt ---"); self.assertFalse((self.output_dir/"a.txt").exists())
    def test_e09_empty_bundle_exits_gracefully(self): _, stderr = run_cli(dogs, ["-", str(self.output_dir)], bundle_content=""); self.assertIn("Bundle is empty", stderr)
    def test_e10_no_file_blocks_exits_gracefully(self): _, stderr = run_cli(dogs, ["-", str(self.output_dir)], bundle_content="chatter"); self.assertIn("No valid file blocks", stderr)
    def test_e11_rsi_link_e2e(self): run_cli(dogs, ["-", str(self.output_dir), "--rsi-link", "-y"], bundle_content="⛓️ --- RSI_LINK_START_FILE: a.txt --- ⛓️\nc\n⛓️ --- RSI_LINK_END_FILE: a.txt --- ⛓️"); self.assertTrue((self.output_dir/"a.txt").exists())
    def test_e12_request_context_e2e(self): _, stderr = run_cli(dogs, ["-", str(self.output_dir)], bundle_content='🐕 --- DOGS_START_FILE: r.md ---\n@@ PAWS_CMD REQUEST_CONTEXT(reason="r") @@\n🐕 --- DOGS_END_FILE: r.md ---', expect_exit_code=0); self.assertIn("AI Context Request", stderr)
    def test_e13_execute_fails_without_flag(self): run_cli(dogs, ["-", str(self.output_dir)], bundle_content='🐕 --- DOGS_START_FILE: r.md ---\n@@ PAWS_CMD EXECUTE_AND_REINVOKE(command_to_run="c") @@\n🐕 --- DOGS_END_FILE: r.md ---', expect_exit_code=1)
    @patch("subprocess.run")
    def test_e14_execute_works_with_flag(self, mock_run): run_cli(dogs, ["-", str(self.output_dir), "--allow-reinvoke"], user_input=['y'], bundle_content='🐕 --- DOGS_START_FILE: r.md ---\n@@ PAWS_CMD EXECUTE_AND_REINVOKE(command_to_run="c") @@\n🐕 --- DOGS_END_FILE: r.md ---', expect_exit_code=0); mock_run.assert_called()
    @patch("subprocess.run")
    def test_e15_execute_denied_by_user(self, mock_run): run_cli(dogs, ["-", str(self.output_dir), "--allow-reinvoke"], user_input=['n'], bundle_content='🐕 --- DOGS_START_FILE: r.md ---\n@@ PAWS_CMD EXECUTE_AND_REINVOKE(command_to_run="c") @@\n🐕 --- DOGS_END_FILE: r.md ---', expect_exit_code=0); mock_run.assert_not_called()
    def test_e16_verify_docs_passes(self): _, stderr = run_cli(dogs, ["-", str(self.output_dir), "--verify-docs"], bundle_content="🐕 --- DOGS_START_FILE: README.md ---\nc\n🐕 --- DOGS_END_FILE: README.md ---\n🐕 --- DOGS_START_FILE: CATSCAN.md ---\nc\n🐕 --- DOGS_END_FILE: CATSCAN.md ---"); self.assertIn("All modified", stderr)
    def test_e17_verify_docs_fails(self): _, stderr = run_cli(dogs, ["-", str(self.output_dir), "--verify-docs"], bundle_content="🐕 --- DOGS_START_FILE: README.md ---\nc\n🐕 --- DOGS_END_FILE: README.md ---"); self.assertIn("out of sync", stderr)
    def test_e18_full_delta_workflow(self): ref=self.test_dir/"r.md"; dogs_b=self.test_dir/"d.md"; ref.write_text("🐈 --- CATS_START_FILE: a.txt ---\nL1\nL2\n🐈 --- CATS_END_FILE: a.txt ---"); (self.output_dir / "a.txt").write_text("L1\nL2\n"); dogs_b.write_text("🐕 --- DOGS_START_FILE: a.txt ---\n@@ PAWS_CMD REPLACE_LINES(2,2) @@\nNEW\n🐕 --- DOGS_END_FILE: a.txt ---"); run_cli(dogs, [str(dogs_b), str(self.output_dir), "-d", str(ref), "-y"]); self.assertEqual((self.output_dir/"a.txt").read_text(), "L1\nNEW\n")
    def test_e19_rename_operation(self): (self.output_dir/"old.txt").write_text("data"); bundle="🐕 --- DOGS_START_FILE: new.txt ---\ndata\n🐕 --- DOGS_END_FILE: new.txt ---\n🐕 --- DOGS_START_FILE: old.txt ---\n@@ PAWS_CMD DELETE_FILE() @@\n🐕 --- DOGS_END_FILE: old.txt ---"; run_cli(dogs, ["-", str(self.output_dir), "-y"], bundle_content=bundle); self.assertTrue((self.output_dir/"new.txt").exists()); self.assertFalse((self.output_dir/"old.txt").exists())
    def test_e20_make_file_blank(self): (self.output_dir/"a.txt").write_text("data"); run_cli(dogs, ["-", str(self.output_dir), "-y"], bundle_content="🐕 --- DOGS_START_FILE: a.txt ---\n\n🐕 --- DOGS_END_FILE: a.txt ---"); self.assertEqual((self.output_dir/"a.txt").read_text(), "")
    def test_e21_stdin_workflow(self): run_cli(dogs, ["-", str(self.output_dir), "-y"], bundle_content="🐕 --- DOGS_START_FILE: stdin.txt ---\nc\n🐕 --- DOGS_END_FILE: stdin.txt ---"); self.assertTrue((self.output_dir/"stdin.txt").exists())
    def test_e22_quit_option_stops_processing(self): bundle="🐕 --- DOGS_START_FILE: a.txt ---\nc\n🐕 --- DOGS_END_FILE: a.txt ---\n🐕 --- DOGS_START_FILE: b.txt ---\nc\n🐕 --- DOGS_END_FILE: b.txt ---"; (self.output_dir/"a.txt").touch(); (self.output_dir/"b.txt").touch(); _, stderr = run_cli(dogs, ["-", str(self.output_dir)], user_input=['q'], bundle_content=bundle, expect_exit_code=0); self.assertIn("Quit", stderr)
    def test_e23_skip_all_option_works(self): bundle="🐕 --- DOGS_START_FILE: a.txt ---\nc\n🐕 --- DOGS_END_FILE: a.txt ---\n🐕 --- DOGS_START_FILE: b.txt ---\nc\n🐕 --- DOGS_END_FILE: b.txt ---"; (self.output_dir/"a.txt").write_text("orig"); (self.output_dir/"b.txt").write_text("orig"); run_cli(dogs, ["-", str(self.output_dir)], user_input=['s'], bundle_content=bundle); self.assertEqual((self.output_dir/"a.txt").read_text(), "orig"); self.assertEqual((self.output_dir/"b.txt").read_text(), "orig")
    def test_e24_yes_to_all_option_works(self): bundle="🐕 --- DOGS_START_FILE: a.txt ---\nA\n🐕 --- DOGS_END_FILE: a.txt ---\n🐕 --- DOGS_START_FILE: b.txt ---\nB\n🐕 --- DOGS_END_FILE: b.txt ---"; (self.output_dir/"a.txt").touch(); (self.output_dir/"b.txt").touch(); run_cli(dogs, ["-", str(self.output_dir)], user_input=['a'], bundle_content=bundle); self.assertEqual((self.output_dir/"a.txt").read_text(), "A\n"); self.assertEqual((self.output_dir/"b.txt").read_text(), "B\n")
    def test_e25_diff_is_shown_on_overwrite(self): (self.output_dir/"a.txt").write_text("orig"); _, stderr = run_cli(dogs, ["-", str(self.output_dir)], user_input=['n'], bundle_content="🐕 --- DOGS_START_FILE: a.txt ---\nnew\n🐕 --- DOGS_END_FILE: a.txt ---"); self.assertIn("--- a/original", stderr); self.assertIn("+++ b/proposed", stderr)

if __name__ == "__main__":
    unittest.main(verbosity=2)

if __name__ == "__main__":
    # To run all tests from this file
    unittest.main(verbosity=2)
