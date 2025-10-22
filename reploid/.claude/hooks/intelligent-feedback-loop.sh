#!/bin/bash
# Intelligent Feedback Loop with Auto-Fix Integration
# Tests, detects errors, and provides Claude Code with fix prompts

set -e

GOAL="${1:-test automation feedback loop}"
MAX_ITERATIONS="${2:-5}"
CONSOLE_LOG="console.log"
ERROR_LOG=".claude/feedback-errors.log"
FIX_PROMPTS_LOG=".claude/fix-prompts.log"

echo "🔄 Intelligent Feedback Loop with Auto-Fix"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Goal: $GOAL"
echo "Max iterations: $MAX_ITERATIONS"
echo ""

# Clear previous logs
> "$ERROR_LOG"
> "$FIX_PROMPTS_LOG"

iteration=1
while [ $iteration -le $MAX_ITERATIONS ]; do
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🔁 Iteration $iteration/$MAX_ITERATIONS"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""

    # Clear old console logs
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
    echo "📊 Analyzing errors..."

    # Extract errors from console log
    if [ -f "$CONSOLE_LOG" ]; then
        ERRORS=$(grep -i '\[ERROR\]' "$CONSOLE_LOG" || true)

        if [ -z "$ERRORS" ]; then
            echo ""
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            echo "🎉 SUCCESS! Agent awakened successfully!"
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            echo ""
            echo "✅ Goal: $GOAL"
            echo "✅ Iterations needed: $iteration"
            echo "📸 Screenshot: /tmp/reploid-after-awaken.png"
            exit 0
        else
            echo "❌ Errors detected"
            echo ""

            # Extract unique error type
            LATEST_ERROR=$(echo "$ERRORS" | grep -oP '(?<=\[ERROR\] ).*' | tail -n 1)
            echo "📍 Latest error: $LATEST_ERROR"
            echo ""

            # Save to logs
            echo "=== Iteration $iteration ===" >> "$ERROR_LOG"
            echo "$LATEST_ERROR" >> "$ERROR_LOG"
            echo "" >> "$ERROR_LOG"

            # INTELLIGENT ERROR ANALYSIS
            echo "🧠 Analyzing error pattern..."

            # Extract error details
            ERROR_TYPE=$(echo "$LATEST_ERROR" | grep -oP 'SyntaxError|TypeError|ReferenceError|Error' | head -n 1 || echo "Unknown")
            ERROR_FILE=$(echo "$LATEST_ERROR" | grep -oP '(?<=for )/[^\s:]+' | head -n 1 || echo "unknown")
            ERROR_TOKEN=$(echo "$LATEST_ERROR" | grep -oP "(?<=Unexpected token ').*(?=')" | head -n 1 || echo "")

            echo "  Type: $ERROR_TYPE"
            echo "  File: $ERROR_FILE"
            if [ -n "$ERROR_TOKEN" ]; then
                echo "  Token: '$ERROR_TOKEN'"
            fi
            echo ""

            # GENERATE FIX PROMPT
            FIX_PROMPT=""

            case "$ERROR_TYPE" in
                "SyntaxError")
                    if [[ "$LATEST_ERROR" =~ "Unexpected token" ]]; then
                        if [[ "$LATEST_ERROR" =~ "export" ]]; then
                            FIX_PROMPT="Fix ESM export syntax in $ERROR_FILE: Convert 'export default' to work with Function() constructor. Check line endings and ensure proper module structure."
                        elif [[ "$ERROR_TOKEN" == ";" ]] || [[ "$ERROR_TOKEN" == "}" ]]; then
                            FIX_PROMPT="Fix JavaScript syntax in $ERROR_FILE: Remove extra semicolon or check for mismatched braces. Common issue: factory property should end with } not };"
                        else
                            FIX_PROMPT="Fix syntax error in $ERROR_FILE: Unexpected token '$ERROR_TOKEN'. Review the module structure, check for missing/extra braces, semicolons, or parentheses."
                        fi
                    fi
                    ;;
                "TypeError")
                    if [[ "$LATEST_ERROR" =~ "is not a function" ]]; then
                        FUNCTION_NAME=$(echo "$LATEST_ERROR" | grep -oP '\w+(?= is not a function)' | head -n 1)
                        FIX_PROMPT="Fix TypeError in $ERROR_FILE: '$FUNCTION_NAME' is not a function. Check if you're accessing the correct property (e.g., container.api.register instead of container.register)."
                    fi
                    ;;
                "ReferenceError")
                    UNDEFINED_VAR=$(echo "$LATEST_ERROR" | grep -oP '\w+(?= is not defined)' | head -n 1)
                    if [ -n "$UNDEFINED_VAR" ]; then
                        FIX_PROMPT="Fix ReferenceError in $ERROR_FILE: Variable '$UNDEFINED_VAR' is not defined. Check imports, scope, or initialization."
                    fi
                    ;;
            esac

            # Output fix prompt
            if [ -n "$FIX_PROMPT" ]; then
                echo "💡 Suggested fix:"
                echo "   $FIX_PROMPT"
                echo ""

                # Save to fix prompts log
                echo "=== Iteration $iteration ===" >> "$FIX_PROMPTS_LOG"
                echo "$FIX_PROMPT" >> "$FIX_PROMPTS_LOG"
                echo "" >> "$FIX_PROMPTS_LOG"

                # Check if error persists from previous iteration
                if [ $iteration -gt 1 ]; then
                    PREV_ERROR=$(grep -A 1 "=== Iteration $((iteration-1)) ===" "$ERROR_LOG" | tail -n 1 || echo "")
                    if [ "$LATEST_ERROR" = "$PREV_ERROR" ]; then
                        echo "⚠️  Error unchanged from previous iteration"
                        echo "⚠️  Previous fix attempt may not have worked or VFS cache needs clearing"
                        echo ""
                        echo "🛑 Manual intervention required:"
                        echo "   1. Clear browser cache (hard refresh or clear VFS)"
                        echo "   2. Verify fix was applied correctly"
                        echo "   3. Check console.log for full stack trace"
                        echo ""
                        echo "Claude Code prompt:"
                        echo "   $FIX_PROMPT"
                        echo "   Then clear VFS cache and retry."
                        echo ""
                        exit 1
                    fi
                fi
            else
                echo "⚠️  Could not generate automatic fix suggestion"
                echo "   Please analyze error manually"
                echo ""
            fi

            echo "⏳ Waiting 2 seconds before next iteration..."
            sleep 2
        fi
    else
        echo "⚠️  No console.log file found"
        exit 1
    fi

    iteration=$((iteration + 1))
    echo ""
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⚠️  Max iterations reached ($MAX_ITERATIONS)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📝 Error log: $ERROR_LOG"
echo "💡 Fix prompts log: $FIX_PROMPTS_LOG"
echo "📸 Screenshot: /tmp/reploid-after-awaken.png"
echo ""
echo "🤖 Claude Code Fix Suggestions:"
cat "$FIX_PROMPTS_LOG"
echo ""
exit 1
