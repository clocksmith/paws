#!/bin/bash
# reploid/tests/monitor-agents.sh
# Monitor progress of all agents

TODOS_DIR="/home/clocksmith/deco/paws/.todos"

if [ ! -d "$TODOS_DIR" ]; then
  echo "Error: .todos directory not found at $TODOS_DIR"
  exit 1
fi

cd "$TODOS_DIR"

echo "========================================="
echo "AGENT PROGRESS MONITOR"
echo "Updated: $(date)"
echo "========================================="
echo ""

# Check if there are any agent files
if ! ls agent-*.json 1> /dev/null 2>&1; then
  echo "No agent todo files found in $TODOS_DIR"
  exit 0
fi

for agent_file in agent-*.json; do
  if [ ! -f "$agent_file" ]; then
    continue
  fi

  agent_name=$(jq -r '.agent // "Unknown"' "$agent_file" 2>/dev/null)
  if [ $? -ne 0 ]; then
    echo "[$agent_file] Error: Failed to parse JSON"
    continue
  fi

  updated=$(jq -r '.updated // "Unknown"' "$agent_file" 2>/dev/null)

  echo "[$agent_name] (Updated: $updated)"

  # Count tasks by status
  total=$(jq '.todos | length' "$agent_file" 2>/dev/null || echo "0")
  completed=$(jq '[.todos[] | select(.status == "completed")] | length' "$agent_file" 2>/dev/null || echo "0")
  in_progress=$(jq '[.todos[] | select(.status == "in_progress")] | length' "$agent_file" 2>/dev/null || echo "0")
  pending=$(jq '[.todos[] | select(.status == "pending")] | length' "$agent_file" 2>/dev/null || echo "0")

  echo "  Total: $total | Completed: $completed | In Progress: $in_progress | Pending: $pending"

  # Calculate progress percentage
  if [ "$total" -gt 0 ]; then
    progress=$((completed * 100 / total))
    echo "  Progress: $progress%"
  fi

  # Show current task
  if [ "$in_progress" -gt 0 ]; then
    current_task=$(jq -r '[.todos[] | select(.status == "in_progress")] | .[0].content // "Unknown task"' "$agent_file" 2>/dev/null)
    echo "  Current: $current_task"
  elif [ "$pending" -gt 0 ]; then
    next_task=$(jq -r '[.todos[] | select(.status == "pending")] | .[0].content // "Unknown task"' "$agent_file" 2>/dev/null)
    echo "  Next: $next_task"
  fi

  echo ""
done

echo "========================================="
echo "BLOCKERS"
echo "========================================="

if [ -f "coordination.json" ]; then
  blocker_count=$(jq '.blockers | length' coordination.json 2>/dev/null || echo "0")
  if [ "$blocker_count" -gt 0 ]; then
    jq -r '.blockers[] | "[\(.reported_by)] \(.task): \(.reason)"' coordination.json 2>/dev/null || echo "Error parsing blockers"
  else
    echo "No blockers reported"
  fi
else
  echo "coordination.json not found"
fi
echo ""

echo "========================================="
echo "DEPENDENCIES"
echo "========================================="
echo "Agent 1 → Agent 2,3 (MCP Bridge needed by servers/widgets)"
echo "Agent 2 → Agent 4 (Servers needed for testing)"
echo "Agent 3 → Agent 4 (Widgets needed for E2E testing)"
echo ""
