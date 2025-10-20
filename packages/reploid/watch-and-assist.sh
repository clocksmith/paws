#!/bin/bash
# Automated development assistant for REPLOID
# This script watches the console.log for errors and alerts Claude Code

CONSOLE_LOG="console.log"
LAST_SIZE=0

echo "🔍 Starting development watch mode..."
echo "📊 Monitoring: $CONSOLE_LOG"
echo "🤖 Claude Code will be alerted on errors"
echo ""

# Create console.log if it doesn't exist
touch "$CONSOLE_LOG"

while true; do
    if [ -f "$CONSOLE_LOG" ]; then
        CURRENT_SIZE=$(wc -c < "$CONSOLE_LOG")

        # Check if file has grown
        if [ "$CURRENT_SIZE" -gt "$LAST_SIZE" ]; then
            # Get only the new content
            NEW_CONTENT=$(tail -c +$((LAST_SIZE + 1)) "$CONSOLE_LOG")

            # Check for errors in new content
            if echo "$NEW_CONTENT" | grep -qi '\[ERROR\]'; then
                echo "❌ ERROR DETECTED IN BROWSER CONSOLE!"
                echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
                echo "$NEW_CONTENT"
                echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
                echo ""
                echo "💡 Claude Code: Please review the error above and suggest fixes."
                echo ""
            fi

            LAST_SIZE=$CURRENT_SIZE
        fi
    fi

    sleep 1
done
