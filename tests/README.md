# Testing PAWS/SWAP

This document provides instructions and context for running the exhaustive test suite for the `cats.py` and `dogs.py` utilities.

## Purpose of the Test Suite

Given that PAWS operates directly on user source code, **reliability and safety are the top priorities**. The test suite is the primary mechanism for ensuring that:

- **Core features work as expected.**
- **Regressions are not introduced** when new features are added or code is refactored.
- **Edge cases are handled gracefully** (e.g., empty files, missing markers, LLM chatter).
- **Safety mechanisms** (like path traversal prevention and interactive prompts) are fully functional.

A passing test suite provides high confidence that PAWS is safe and reliable to use.

## Prerequisites

- Python 3.9+
- No external libraries are required.

## How to Run Tests

### Running the Full Suite (Recommended)

The most reliable way to run the entire test suite is to use `unittest`'s **discovery feature** from the **project's root directory**.

1.  Navigate to the project root (the directory containing `cats.py` and the `tests/` folder).
2.  Run the following command:

    ```bash
    python -m unittest discover tests
    ```

    - `python -m unittest`: Invokes the `unittest` module as a script, which correctly configures Python's path.
    - `discover`: Tells `unittest` to search for tests.
    - `tests`: Specifies the directory to start searching in.

This command ensures that the test runner can find and import the `cats` and `dogs` modules from the parent directory without any `ModuleNotFoundError`.

### Running Specific Tests

When developing or debugging, you may want to run only a subset of tests. You can target specific files, classes, or even individual methods.

- **Run a single test file:**

  ```bash
  python -m unittest tests/test_paws.py
  ```

- **Run a single test class:**

  ```bash
  python -m unittest tests.test_paws.TestDogsPy
  ```

- **Run a single test method:**
  ```bash
  python -m unittest tests.test_paws.TestDogsPy.test_parser_handles_unterminated_blocks
  ```

## Expected Output

A successful run will show `ok` for each test and end with a summary:

```
..................................................
----------------------------------------------------------------------
Ran 50 tests in 0.123s

OK
```

If any test fails, `unittest` will provide a detailed traceback indicating the failed test, the assertion that failed, and the reason for the failure.

## Understanding the Test Structure

The suite resides in `tests/test_paws.py` and is broken down into three main classes:

1.  **`TestCatsPy`**: Focuses exclusively on the `cats.py` bundler.

    - **File Discovery**: Globbing, directory expansion, and exclusion patterns.
    - **Path Handling**: Correctly bundling from within the CWD and from outside (e.g., `../`).
    - **Exclusions**: Verification of default excludes (`.git`, `.venv`) and the `-N` override flag.
    - **Prompt Injection**: Correct ordering and content of persona (`-p`) and system (`-s`) prompts.
    - **Marker Generation**: Correct creation of file markers, including hints for binary files.
    - **Edge Cases**: Handling of empty directories and no-match glob patterns.

2.  **`TestDogsPy`**: Focuses exclusively on the `dogs.py` unpacker.

    - **Parser Robustness**: Correctly parsing bundles despite LLM chatter, markdown fences, and missing `END` markers.
    - **Safety**: Verifying path traversal prevention and interactive confirmation prompts.
    - **File Operations**: Correctly creating, overwriting, and deleting files.
    - **Diff Logic**: Ensuring diffs are shown for modified files and skipped for identical files.
    - **Edge Cases**: Handling of empty bundles, malformed paths, and binary content.

3.  **`TestFullWorkflow`**: An end-to-end integration test.
    - Simulates the complete user workflow: `cats.py` -> (simulated LLM) -> `dogs.py`.
    - Uses the **delta workflow** (`-t` and `-d` flags) to test modifications, additions, and deletions in a single run.
    - Asserts that the final state of the file system is exactly as expected after the full cycle.
