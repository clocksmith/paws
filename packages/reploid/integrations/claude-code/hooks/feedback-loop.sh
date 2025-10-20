#!/bin/bash
# Automated Feedback Loop for REPLOID Development
# Tests the application, detects errors, and reports them

set -e

GOAL="${1:-test automation feedback loop}"
MAX_ITERATIONS="${2:-5}"
CONSOLE_LOG="console.log"
ERROR_LOG=".claude/feedback-errors.log"

echo "🔄 Starting Automated Feedback Loop"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Goal: $GOAL"
echo "Max iterations: $MAX_ITERATIONS"
echo ""

# Clear previous error log
> "$ERROR_LOG"

iteration=1
while [ $iteration -le $MAX_ITERATIONS ]; do
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🔁 Iteration $iteration/$MAX_ITERATIONS"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""

    # Clear old console logs for this iteration
    > "$CONSOLE_LOG"

    echo "🚀 Running browser automation..."
    if node .claude/hooks/browser-automation.mjs awaken "$GOAL" 2>&1 | tee -a "$ERROR_LOG"; then
        echo ""
        echo "✅ Browser automation completed"
    else
        echo ""
        echo "❌ Browser automation failed"
    fi

    echo ""
    echo "📊 Checking for errors in console.log..."

    # Extract errors from console log
    if [ -f "$CONSOLE_LOG" ]; then
        ERRORS=$(grep -i '\[ERROR\]' "$CONSOLE_LOG" || true)

        if [ -z "$ERRORS" ]; then
            echo ""
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            echo "🎉 SUCCESS! No errors detected!"
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            echo ""
            echo "✅ Agent awakening successful"
            echo "✅ Goal: $GOAL"
            echo "✅ Iterations needed: $iteration"
            echo ""
            echo "📸 Screenshot: /tmp/reploid-after-awaken.png"
            exit 0
        else
            echo ""
            echo "❌ Errors detected in iteration $iteration:"
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            echo "$ERRORS" | head -n 10
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            echo ""

            # Extract the most recent unique error
            LATEST_ERROR=$(echo "$ERRORS" | tail -n 1)
            echo "📍 Latest error:"
            echo "$LATEST_ERROR"
            echo ""

            # Save to error log
            echo "=== Iteration $iteration ===" >> "$ERROR_LOG"
            echo "$LATEST_ERROR" >> "$ERROR_LOG"
            echo "" >> "$ERROR_LOG"

            # Check if this error is the same as previous iteration
            if [ $iteration -gt 1 ]; then
                PREV_ERROR=$(grep -A 1 "=== Iteration $((iteration-1)) ===" "$ERROR_LOG" | tail -n 1)
                if [ "$LATEST_ERROR" = "$PREV_ERROR" ]; then
                    echo "⚠️  Same error as previous iteration - feedback loop stuck"
                    echo ""
                    echo "🛑 Manual intervention required"
                    echo ""
                    echo "Suggested actions:"
                    echo "1. Review the error in detail: cat console.log | grep ERROR"
                    echo "2. Check the problematic file/module"
                    echo "3. Apply manual fixes"
                    echo "4. Re-run this script"
                    echo ""
                    exit 1
                fi
            fi

            echo "💡 Waiting 2 seconds before next iteration..."
            sleep 2
        fi
    else
        echo "⚠️  No console.log file found"
        echo "   Make sure servers are running (npm run dev)"
        exit 1
    fi

    iteration=$((iteration + 1))
    echo ""
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⚠️  Max iterations reached ($MAX_ITERATIONS)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Errors persist after $MAX_ITERATIONS attempts"
echo ""
echo "📝 Error log saved to: $ERROR_LOG"
echo "📸 Last screenshot: /tmp/reploid-after-awaken.png"
echo ""
echo "Next steps:"
echo "1. Review all errors: cat $ERROR_LOG"
echo "2. Check console logs: cat $CONSOLE_LOG | grep ERROR"
echo "3. View screenshot: open /tmp/reploid-after-awaken.png"
echo "4. Ask Claude Code to analyze and fix the errors"
echo ""
exit 1
