#!/bin/bash
# Browser automation driver for REPLOID
# Uses curl and API calls to interact with the application

BASE_URL="http://localhost:8080"
PROXY_URL="http://localhost:8000"

# Function to check if servers are running
check_servers() {
    if ! curl -s "$PROXY_URL/api/health" > /dev/null 2>&1; then
        echo "❌ Proxy server not running on $PROXY_URL"
        return 1
    fi

    if ! curl -s "$BASE_URL" > /dev/null 2>&1; then
        echo "❌ Web server not running on $BASE_URL"
        return 1
    fi

    echo "✅ Servers are running"
    return 0
}

# Function to trigger agent awakening via console injection
awaken_agent() {
    local goal="${1:-test automation}"

    echo "🚀 Triggering agent awakening with goal: $goal"

    # Create a JavaScript command to awaken the agent
    local js_command="
    if (typeof awakenAgent === 'function') {
        document.getElementById('goal-input').value = '$goal';
        document.getElementById('awaken-btn').click();
    } else {
        console.error('awakenAgent function not found');
    }
    "

    echo "📝 JS command created (inject this in browser console manually)"
    echo "   Or use browser automation tools like Playwright/Puppeteer"
}

# Function to get current console logs
get_console_logs() {
    echo "📊 Fetching console logs from proxy..."
    curl -s "$PROXY_URL/api/console-logs" | jq -r '.logs[]' 2>/dev/null || echo "No logs available"
}

# Function to reload the browser page (needs browser extension or automation tool)
reload_page() {
    echo "🔄 Page reload would require:"
    echo "   - Browser automation tool (Puppeteer/Playwright)"
    echo "   - Browser extension"
    echo "   - Or manual refresh"
    echo ""
    echo "   For now, please refresh http://localhost:8080 manually"
}

# Function to take screenshot (needs headless browser)
take_screenshot() {
    echo "📸 Screenshot capability requires Puppeteer/Playwright"
    echo "   Consider installing: npm install -D @playwright/test"
}

# Main command dispatcher
case "${1:-help}" in
    check)
        check_servers
        ;;
    awaken)
        shift
        awaken_agent "$*"
        ;;
    logs)
        get_console_logs
        ;;
    reload)
        reload_page
        ;;
    screenshot)
        take_screenshot
        ;;
    help|*)
        echo "Browser Driver for REPLOID"
        echo ""
        echo "Usage: $0 <command> [args]"
        echo ""
        echo "Commands:"
        echo "  check          - Check if servers are running"
        echo "  awaken <goal>  - Trigger agent awakening (needs automation)"
        echo "  logs           - Fetch console logs from proxy"
        echo "  reload         - Reload browser page (needs automation)"
        echo "  screenshot     - Take screenshot (needs automation)"
        echo "  help           - Show this help"
        ;;
esac
