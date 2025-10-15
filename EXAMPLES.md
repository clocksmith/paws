# PAWS Examples - Revolutionary Features

This guide shows the unique capabilities that make PAWS different from Cursor, Claude Code, and other AI coding tools.

## Setup

```bash
# Install dependencies
pip install google-generativeai anthropic openai rich GitPython

# Set API keys
export GEMINI_API_KEY="your-key"
export ANTHROPIC_API_KEY="your-key"
export OPENAI_API_KEY="your-key"

# Create config file
cat > paxos_config.json <<EOF
{
  "competitors": [
    {
      "name": "gemini-pro",
      "model_id": "gemini-pro",
      "provider": "gemini"
    },
    {
      "name": "claude-sonnet",
      "model_id": "claude-3-sonnet-20240229",
      "provider": "claude"
    },
    {
      "name": "gpt4-turbo",
      "model_id": "gpt-4-turbo-preview",
      "provider": "openai"
    }
  ]
}
EOF
```

## Example 1: Multi-Agent Competition

**Scenario:** Refactor authentication to use OAuth2. Get 3 LLMs to compete, only accept solutions that pass tests.

```bash
# Step 1: Create context with AI curation
python py/cats.py \
  --ai-curate "refactor authentication to use OAuth2" \
  --ai-provider gemini \
  --max-files 15 \
  -o context.md

# Step 2: Run multi-agent competition
python py/paws_paxos.py \
  "Refactor the authentication module to use OAuth2 with proper token refresh" \
  context.md \
  --verify-cmd "pytest tests/test_auth.py" \
  --config paxos_config.json

# Step 3: Review winning solution
python py/dogs.py \
  workspace/competition/claude-sonnet_solution.dogs.md \
  --interactive

# Step 4: Apply changes
# (Interactive mode lets you review each file)
```

**What happens:**
1. Gemini, Claude, and GPT-4 all generate solutions independently
2. Each solution is tested in an isolated git worktree
3. Only solutions that pass `pytest tests/test_auth.py` are presented
4. You get a performance comparison with metrics

**Why this matters:** Cursor and Claude Code can't do this. They use one model. PAWS runs 3-5 in parallel with test verification.

## Example 2: Swarm Collaboration

**Scenario:** Implement a complex caching layer where agents collaborate like a team.

```bash
# Run swarm with role-based collaboration
python py/paws_swarm.py \
  "Implement a Redis-based caching layer with TTL, invalidation, and monitoring" \
  context.md \
  --config paxos_config.json

# What happens:
# 1. Architect (gemini-pro) breaks task into subtasks:
#    - Design cache interface
#    - Implement Redis client
#    - Add monitoring hooks
#    - Write tests
#
# 2. For each subtask:
#    - Implementer (claude) writes code
#    - Reviewer (gpt4) critiques
#    - Implementer revises based on feedback
#
# 3. Architect integrates all solutions
```

**Why this matters:** Other tools are single-agent. PAWS agents have roles and collaborate through multiple rounds.

## Example 3: Performance Benchmarking

**Scenario:** Find out which LLM is actually best for YOUR codebase.

```bash
# Create a benchmark suite
cat > benchmark_suite.json <<EOF
{
  "name": "Auth System Benchmark",
  "description": "Test LLM performance on auth-related tasks",
  "tasks": [
    {
      "task": "Fix OAuth2 token refresh race condition",
      "context_bundle": "context.md",
      "verify_cmd": "pytest tests/test_oauth.py"
    },
    {
      "task": "Add rate limiting to login endpoint",
      "context_bundle": "context.md",
      "verify_cmd": "pytest tests/test_rate_limit.py"
    },
    {
      "task": "Implement session management with Redis",
      "context_bundle": "context.md",
      "verify_cmd": "pytest tests/test_sessions.py"
    }
  ]
}
EOF

# Run benchmark
python py/paws_benchmark.py \
  --suite benchmark_suite.json \
  --config paxos_config.json

# Results saved to workspace/benchmarks/benchmark_report.json
```

**Output:**
```
Model Performance Summary:
Model                     Pass Rate    Avg Time    Tokens      Cost
----------------------------------------------------------------------
claude-sonnet             100.0%       45.2s       3421        $0.103
gemini-pro                66.7%        32.1s       4102        $0.041
gpt5                100.0%       52.8s       3892        $0.389

Rankings:
  ☇ Best Pass Rate:         claude-sonnet
  ⚡ Fastest:                gemini-pro
  ☉ Most Token Efficient:   claude-sonnet
  ♢ Best Cost Efficiency:   gemini-pro
  ♃ Best Solution Quality:  claude-sonnet
```

**Why this matters:** No other tool tracks LLM performance with metrics. You can make data-driven decisions about which model to use.

## Example 4: Massive Context Optimization

**Scenario:** Refactor a 500K line codebase (too large for any model's context window).

```bash
# Step 1: Optimize context
python py/paws_context_optimizer.py \
  "Migrate backend from Flask to FastAPI" \
  --scan backend/ \
  --max-tokens 100000 \
  --output optimized_context.md

# Output:
# ☉ Context window created:
#   Core files (full content): 12
#   Summary files (CATSCAN): 45
#   Total lines: 18,432
#   Estimated tokens: 82,156

# Step 2: Use optimized context
python py/paws_paxos.py \
  "Migrate Flask app to FastAPI while maintaining all API endpoints" \
  optimized_context.md \
  --verify-cmd "pytest tests/"
```

**How it works:**
- Analyzes dependencies between files
- Ranks files by relevance to task
- Includes top files in full
- Summarizes related files with CATSCAN
- Fits everything in model context window

**Why this matters:** Cursor and Claude Code hit context limits on large refactors. PAWS uses hierarchical summarization to handle 500K+ lines.

## Example 5: Deterministic Execution

**Scenario:** Ensure reproducible results across your team.

```bash
# Create version-locked config
cat > deterministic_config.json <<EOF
{
  "competitors": [
    {
      "name": "claude-deterministic",
      "model_id": "claude-3-sonnet-20240229",
      "provider": "claude",
      "temperature": 0.0,
      "max_tokens": 4000
    }
  ]
}
EOF

# Run with explicit context bundle (checked into git)
python py/paws_paxos.py \
  "$(cat task_description.txt)" \
  context.md \
  --config deterministic_config.json \
  --verify-cmd "pytest"

# Same input → same output
# - Version-locked model (claude-3-sonnet-20240229)
# - Explicit context bundle (checked into git)
# - Temperature 0.0
# - Test verification
```

**Why this matters:** Other tools have implicit context (you don't know what files they're seeing). PAWS bundles are explicit and version-controlled.

## Example 6: Using Local Models (Ollama) with Paxos

**Scenario:** You want to use a local model running on Ollama to compete against cloud-based models, keeping your code on your machine.

**Prerequisite:** Ensure your Ollama server is running. The script assumes it's available at `http://localhost:11434`.

```bash
# Step 1: Create a new config file for local competition
cat > local_paxos_config.json <<EOF
{
  "competitors": [
    {
      "name": "ollama-llama3",
      "model_id": "llama3",
      "provider": "openai_compatible",
      "base_url": "http://localhost:11434/v1",
      "api_key": "ollama"
    },
    {
      "name": "gemini-pro",
      "model_id": "gemini-pro",
      "provider": "gemini"
    }
  ]
}
EOF

# Step 2: Run the competition
python py/paws_paxos.py \
  "Refactor the logging utility to be asynchronous" \
  context.md \
  --verify-cmd "pytest tests/test_logging.py" \
  --config local_paxos_config.json
```

**How it works:**
1.  **`provider`: "openai_compatible"**: This new provider type tells the script to use the generic OpenAI client.
2.  **`base_url`**: This specifies the endpoint for your local model server. For Ollama, this is typically `http://localhost:11434/v1`.
3.  **`api_key`**: For a default Ollama setup, the API key is not required, but the field must be present. You can set it to "ollama" or any other string.
4.  **`model_id`**: This should be the name of the model you have pulled in Ollama (e.g., "llama3", "codellama").

**Why this matters:** You can now leverage local models for privacy, offline work, or to test models that aren't available through major cloud providers. The competition framework remains the same, allowing you to benchmark local models against cloud models on your own code.

## Comparison: PAWS vs Others

### Simple Task (< 5 files, clear requirements)
**Use:** Cursor or Claude Code
**Reason:** Faster iteration for simple changes

### Complex Refactor (10+ files, ambiguous requirements)
**Use:** PAWS Paxos (multi-agent competition)
**Reason:** Consensus voting with test verification

### Critical Production Change
**Use:** PAWS Swarm (collaborative agents)
**Reason:** Multiple review rounds, specialized roles

### Large Codebase (100K+ lines)
**Use:** PAWS Context Optimizer
**Reason:** Hierarchical summarization fits in context window

### Team Workflow (need reproducibility)
**Use:** PAWS with version-controlled bundles
**Reason:** Explicit context, deterministic execution

## Tips

1. **Start with AI curation**: `--ai-curate` automatically selects relevant files
2. **Use test verification**: `--verify-cmd` ensures only working solutions are presented
3. **Run in parallel**: Paxos runs agents concurrently by default
4. **Check benchmarks**: Run `paws_benchmark.py` to see which model works best for your code
5. **Optimize context**: For large refactors, always use `paws_context_optimizer.py` first

## Troubleshooting

**Problem:** "No API key found"
**Solution:** `export GEMINI_API_KEY="your-key"`

**Problem:** "All agents failed verification"
**Solution:** Make sure your tests pass on the current code first

**Problem:** "Context too large"
**Solution:** Use `paws_context_optimizer.py` to create hierarchical bundle

**Problem:** "Git worktree failed"
**Solution:** Make sure you're in a git repository and have no uncommitted changes
