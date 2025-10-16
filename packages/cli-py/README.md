# @paws/cli-py

Python CLI tools for PAWS - Context bundler (cats) and change applier (dogs).

## Installation

```bash
pip install -e packages/cli-py
```

Or for development:

```bash
cd packages/cli-py
pip install -e .
```

## CLI Tools

### paws-cats - Context Bundler

Bundle project files into a single text artifact for AI/LLM consumption.

```bash
# Basic usage
paws-cats src/**/*.py -o context.md

# With AI-powered file curation
paws-cats --ai-curate "Implement user authentication" --ai-key YOUR_API_KEY

# With persona and system prompt
paws-cats src/**/*.py -p persona_ax.md -s sys_a.md -o bundle.md
```

### paws-dogs - Change Applier

Apply changes from AI-generated bundles back to your codebase.

```bash
# Apply changes from a bundle
paws-dogs changes.md

# Auto-accept all changes
paws-dogs bundle.md -y
```

### paws-paxos - Multi-Agent Orchestrator

Run multi-agent Paxos consensus workflow.

```bash
# Run paxos with multiple agents
paws-paxos "Implement feature" context.md --agents gemini,claude,gpt4
```

### paws-session - Session Manager

Manage multi-turn AI sessions.

```bash
# Start new session
paws-session start "feature-auth"

# Continue session
paws-session continue session-id
```

## Python API Usage

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

## Testing

```bash
# Run tests
cd packages/cli-py
pytest

# With coverage
pytest --cov=paws --cov-report=html
```

## License

MIT
