#!/bin/bash
# Verification script for Claude Code hooks setup

echo "🔍 Verifying Claude Code Hooks Setup"
echo "======================================"
echo ""

# Check 1: Directory structure
echo "✓ Checking directory structure..."
if [ -d ".claude/hooks" ]; then
    echo "  ✓ .claude/hooks directory exists"
else
    echo "  ✗ .claude/hooks directory missing"
    exit 1
fi

# Check 2: Hook script exists and is executable
echo ""
echo "✓ Checking hook script..."
if [ -f ".claude/hooks/inject-console-logs.sh" ]; then
    echo "  ✓ inject-console-logs.sh exists"
    if [ -x ".claude/hooks/inject-console-logs.sh" ]; then
        echo "  ✓ Script is executable"
    else
        echo "  ✗ Script is not executable (run: chmod +x .claude/hooks/inject-console-logs.sh)"
        exit 1
    fi
else
    echo "  ✗ Hook script missing"
    exit 1
fi

# Check 3: Settings file exists
echo ""
echo "✓ Checking settings configuration..."
if [ -f ".claude/settings.json" ]; then
    echo "  ✓ .claude/settings.json exists"

    # Validate JSON
    if command -v jq &> /dev/null; then
        if jq empty .claude/settings.json 2>/dev/null; then
            echo "  ✓ JSON is valid"
        else
            echo "  ✗ JSON is invalid"
            exit 1
        fi
    fi

    # Check for UserPromptSubmit hook
    if grep -q "UserPromptSubmit" .claude/settings.json; then
        echo "  ✓ UserPromptSubmit hook configured"
    else
        echo "  ✗ UserPromptSubmit hook not found in settings"
        exit 1
    fi
else
    echo "  ✗ settings.json missing"
    exit 1
fi

# Check 4: Console log file
echo ""
echo "✓ Checking console.log file..."
if [ -f "console.log" ]; then
    echo "  ✓ console.log exists"

    # Check for errors
    if grep -q '\[ERROR\]' console.log; then
        echo "  ⚠ Errors detected in console.log (hook will inject)"
    else
        echo "  ℹ No errors in console.log (hook won't inject)"
    fi

    LINE_COUNT=$(wc -l < console.log)
    echo "  ℹ console.log has $LINE_COUNT lines"
else
    echo "  ⚠ console.log doesn't exist yet (will be created when browser runs)"
fi

# Check 5: Test hook execution
echo ""
echo "✓ Testing hook execution..."
OUTPUT=$(./.claude/hooks/inject-console-logs.sh 2>&1)
if [ -n "$OUTPUT" ]; then
    echo "  ✓ Hook produces output (errors exist)"
    echo ""
    echo "  Sample output:"
    echo "$OUTPUT" | head -n 10
    if [ $(echo "$OUTPUT" | wc -l) -gt 10 ]; then
        echo "  ... (truncated)"
    fi
else
    echo "  ℹ Hook produces no output (no errors to inject)"
fi

# Check 6: Development servers
echo ""
echo "✓ Checking development environment..."
if lsof -i :8000 &> /dev/null; then
    echo "  ✓ Proxy server running on port 8000"
else
    echo "  ⚠ Proxy server not running (run: npm run dev)"
fi

if lsof -i :8080 &> /dev/null; then
    echo "  ✓ Web server running on port 8080"
else
    echo "  ⚠ Web server not running (run: npm run dev)"
fi

# Check 7: Watch script
echo ""
echo "✓ Checking watch script..."
if pgrep -f "watch-and-assist.sh" &> /dev/null; then
    echo "  ✓ watch-and-assist.sh is running"
else
    echo "  ℹ watch-and-assist.sh not running (optional)"
fi

# Summary
echo ""
echo "======================================"
echo "✅ Hooks setup verification complete!"
echo ""
echo "Next steps:"
echo "1. Send any message to Claude Code"
echo "2. If console.log has errors, Claude will see them automatically"
echo "3. No more manual copy/paste of console logs needed!"
echo ""
echo "To test: Just send 'hello' to Claude and see if it mentions browser errors"
