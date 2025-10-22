# PAWS Examples

This guide demonstrates the multi-agent and context optimization features available in PAWS.

## Setup

```bash
# Install dependencies
pip install google-generativeai anthropic openai rich GitPython

# Set API keys
export GEMINI_API_KEY="your-key"
export ANTHROPIC_API_KEY="your-key"
export OPENAI_API_KEY="your-key"

# Create config file
cat > arena_config.json <<EOF
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
paws-cats \
  --ai-curate "refactor authentication to use OAuth2" \
  --ai-provider gemini \
  --max-files 15 \
  -o context.md

# Step 2: Run multi-agent competition
paws-arena \
  "Refactor the authentication module to use OAuth2 with proper token refresh" \
  context.md \
  --verify-cmd "pytest tests/test_auth.py" \
  --config arena_config.json

# Step 3: Review winning solution
paws-dogs \
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

## Example 2: Swarm Collaboration

**Scenario:** Implement a complex caching layer where agents collaborate like a team.

```bash
# Run swarm with role-based collaboration
paws-swarm \
  "Implement a Redis-based caching layer with TTL, invalidation, and monitoring" \
  context.md \
  --config arena_config.json

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

## Example 3: Performance Benchmarking

**Scenario:** Compare LLM performance on your codebase.

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
paws-benchmark \
  --suite benchmark_suite.json \
  --config arena_config.json

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

## Example 4: Context Optimization

**Scenario:** Refactor a large codebase (too large for model context windows).

```bash
# Step 1: Optimize context
paws-context-optimizer \
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
paws-arena \
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

## Example 5: Deterministic Execution

**Scenario:** Ensure reproducible results across your team.

```bash
# Create version-locked config
cat > deterministic_config.json <<EOF
{
  "competitors": [
    {
      "name": "claude-deterministic",
      "model_id": "claude-4.5-sonnet",
      "provider": "claude",
      "temperature": 0.0,
      "max_tokens": 4000
    }
  ]
}
EOF

# Run with explicit context bundle (checked into git)
paws-arena \
  "$(cat task_description.txt)" \
  context.md \
  --config deterministic_config.json \
  --verify-cmd "pytest"

# Same input → same output
# - Version-locked model (claude-4.5-sonnet)
# - Explicit context bundle (checked into git)
# - Temperature 0.0
# - Test verification
```

## Usage Tips

1. **AI curation**: Use `--ai-curate` to automatically select relevant files
2. **Test verification**: Add `--verify-cmd` to ensure solutions pass tests before presentation
3. **Benchmark models**: Run `paws-benchmark` to compare model performance on your codebase
4. **Large codebases**: Use `paws-context-optimizer` to create hierarchical context bundles

## Troubleshooting

**Problem:** "No API key found"
**Solution:** `export GEMINI_API_KEY="your-key"`

**Problem:** "All agents failed verification"
**Solution:** Make sure your tests pass on the current code first

**Problem:** "Context too large"
**Solution:** Use `paws-context-optimizer` to create hierarchical bundle

**Problem:** "Git worktree failed"
**Solution:** Make sure you're in a git repository and have no uncommitted changes
