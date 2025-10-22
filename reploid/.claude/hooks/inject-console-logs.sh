#!/bin/bash
# Hook to automatically inject console.log errors into Claude Code context
# This runs on every user prompt submission

CONSOLE_LOG="/home/clocksmith/deco/paws/packages/reploid/console.log"

# Only inject if console.log exists and has content
if [ ! -f "$CONSOLE_LOG" ]; then
    exit 0
fi

# Check if there are any errors in the log
if ! grep -q '\[ERROR\]' "$CONSOLE_LOG" 2>/dev/null; then
    # No errors, don't inject anything
    exit 0
fi

# Get the last 20 lines (recent activity)
RECENT_LOGS=$(tail -n 20 "$CONSOLE_LOG" 2>/dev/null)

# Only inject if we have actual content
if [ -z "$RECENT_LOGS" ]; then
    exit 0
fi

# Check if there's an error in the recent logs
if echo "$RECENT_LOGS" | grep -q '\[ERROR\]'; then
    # Output the context injection
    cat <<EOF

---
**[Auto-injected Browser Console Status]**

Recent browser console output (last 20 lines from console.log):

\`\`\`
$RECENT_LOGS
\`\`\`

EOF
fi
