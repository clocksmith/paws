# Running the PAWS/SWAP Test Suite

This document explains how to run the exhaustive test suite for the `cats.py` and `dogs.py` utilities. The suite is designed to verify all features, edge cases, and safety mechanisms.

## Prerequisites

- Python 3.8+
- No external libraries are required.

## Setup

No special setup is required. The test script, `test_paws.py`, is designed to be self-contained and run from the project's root directory. It automatically creates temporary directories for its test files and cleans them up after execution.

## How to Run the Tests

The `ImportError` you observed is due to how Python's module system interacts with test runners. The most reliable and standard way to run the test suite is to use `unittest`'s **discovery feature** from the **project root directory**.

1.  **Navigate to the project root directory.** This is the directory containing `cats.py`, `dogs.py`, and the `tests/` folder.

2.  Run the following command:

    ```bash
    python3 -m unittest discover tests
    ```

    - `python3 -m unittest`: Invokes the `unittest` module as a top-level script.
    - `discover`: Tells `unittest` to search for tests.
    - `tests`: The directory to start discovery in.

This command correctly sets up the Python path, ensuring that when `tests/test_paws.py` tries to `import cats` and `import dogs`, it can find them in the parent (root) directory, resolving the `ModuleNotFoundError`.

## What to Expect

If all tests pass, you will see detailed output for each test case, followed by a summary message:

```
...
test_symmetrical_markers_with_binary_hint (tests.test_paws.TestCatsPy) ... ok
test_delta_workflow_end_to_end (tests.test_paws.TestFullWorkflow) ... ok
test_parser_handles_all_llm_artifacts (tests.test_paws.TestDogsPy) ... ok
...

----------------------------------------------------------------------
Ran 85 tests in 0.350s

OK
```

If any test fails, `unittest` will provide a detailed traceback indicating the failed test, the assertion that failed, and the reason for the failure.

## Test Coverage

The suite is broken down into three main classes:

1.  **`TestCatsPy`**: Focuses exclusively on the `cats.py` bundler, testing globbing, excludes, prompting, marker generation, and edge cases.

2.  **`TestDogsPy`**: Focuses exclusively on the `dogs.py` unpacker, with extensive tests for the hardened parser, delta engine, file deletion, and all interactive prompt behaviors.

3.  **`TestFullWorkflow`**: An end-to-end integration test that runs `cats.py` to create a reference bundle, simulates an LLM delta response (including modifications, additions, and deletions), runs `dogs.py` to apply the changes, and asserts that the final state of the file system is exactly as expected.
