# @paws/cli-py

**[↑ Back to Main](../../README.md)** | **[↑ Packages](../README.md)** | **[→ CLI-JS](../cli-js/README.md)**

---

Python CLI tools for PAWS multi-agent workflows - Alternative Python implementation of PAWS CLI tools.

## Installation

```bash
# From PyPI (when published)
pip install paws-cli

# Or from source
cd packages/cli-py
pip install -e .
```

## CLI Tools

All the same tools as [@paws/cli-js](../cli-js/README.md), implemented in Python:

- **paws-cats** - Context bundler with AI-assisted file selection
- **paws-dogs** - Change applier with interactive review
- **paws-session** - Session manager with git worktrees
- **paws-arena** - Multi-agent competitive verification
- **paws-swarm** - Collaborative multi-agent workflows
- **paws-benchmark** - LLM performance comparison
- **paws-context-optimizer** - Smart context pruning

## Usage

Same command-line interface as the TypeScript version:

```bash
# Create context bundle
paws-cats src/**/*.py -o context.md

# Apply changes
paws-dogs changes.md

# Start session
paws-session start "feature-auth"

# Run arena competition
paws-arena "Refactor auth module" context.md --verify-cmd "pytest"
```

See [@paws/cli-js documentation](../cli-js/README.md) for detailed usage of each tool.

## Python API

```python
from paws.cats import CatsBundler
from paws.dogs import BundleProcessor

# Create bundle
bundler = CatsBundler(
    output_file='context.md',
    sys_prompt='/path/to/sys_a.md'
)
bundle = bundler.create_bundle(['src/**/*.py'])

# Apply changes
processor = BundleProcessor(
    output_dir='./src',
    verify='pytest'
)
processor.process_bundle(bundle_content)
```

## Development

```bash
# Install dependencies
pip install -r requirements.txt

# Run tests
pytest tests/
```

## License

MIT

---

**[↑ Back to Main](../../README.md)** | **[↑ Packages](../README.md)** | **[→ CLI-JS](../cli-js/README.md)**
