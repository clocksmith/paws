#!/usr/bin/env node
/**
 * Browser Automation for REPLOID
 * Uses Playwright to drive the browser and test the application
 */

import { chromium } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';
const HEADLESS = process.env.HEADLESS !== 'false';
const TIMEOUT = parseInt(process.env.TIMEOUT) || 30000;

class ReploidBrowserDriver {
    constructor() {
        this.browser = null;
        this.context = null;
        this.page = null;
    }

    async launch() {
        console.log(`🚀 Launching browser (headless: ${HEADLESS})...`);
        this.browser = await chromium.launch({
            headless: HEADLESS,
            args: ['--no-sandbox']
        });

        this.context = await this.browser.newContext({
            viewport: { width: 1280, height: 720 }
        });

        this.page = await this.context.newPage();

        // Listen to console messages from the browser
        this.page.on('console', msg => {
            const type = msg.type();
            const text = msg.text();
            if (type === 'error') {
                console.log(`❌ [Browser Error]: ${text}`);
            } else if (text.includes('[ERROR]')) {
                console.log(`⚠️  [Browser]: ${text}`);
            }
        });

        console.log(`✅ Browser launched`);
    }

    async navigate(url = BASE_URL) {
        console.log(`📍 Navigating to ${url}...`);
        await this.page.goto(url, { waitUntil: 'networkidle', timeout: TIMEOUT });
        console.log(`✅ Page loaded`);
    }

    async waitForElement(selector, timeout = 5000) {
        try {
            await this.page.waitForSelector(selector, { timeout });
            return true;
        } catch (e) {
            console.log(`⚠️  Element not found: ${selector}`);
            return false;
        }
    }

    async awakenAgent(goal = 'test automation') {
        console.log(`🎯 Awakening agent with goal: "${goal}"...`);

        // Wait for the goal input to be available
        const inputExists = await this.waitForElement('#goal-input');
        if (!inputExists) {
            console.log(`❌ Goal input not found`);
            return false;
        }

        // Fill in the goal
        await this.page.fill('#goal-input', goal);
        console.log(`✅ Goal set: "${goal}"`);

        // Click the awaken button
        const buttonExists = await this.waitForElement('#awaken-btn');
        if (!buttonExists) {
            console.log(`❌ Awaken button not found`);
            return false;
        }

        await this.page.click('#awaken-btn');
        console.log(`✅ Awaken button clicked`);

        // Wait a bit for the action to process
        await this.page.waitForTimeout(2000);

        return true;
    }

    async screenshot(path = '/tmp/reploid-screenshot.png') {
        console.log(`📸 Taking screenshot...`);
        await this.page.screenshot({ path, fullPage: true });
        console.log(`✅ Screenshot saved to: ${path}`);
        return path;
    }

    async getConsoleErrors() {
        const errors = await this.page.evaluate(() => {
            // Access the console.log file through the API
            return fetch('http://localhost:8000/api/console-logs')
                .then(r => r.json())
                .then(data => data.logs.filter(log => log.includes('[ERROR]')))
                .catch(() => []);
        });
        return errors;
    }

    async reload() {
        console.log(`🔄 Reloading page...`);
        await this.page.reload({ waitUntil: 'networkidle' });
        console.log(`✅ Page reloaded`);
    }

    async evaluate(code) {
        console.log(`⚙️  Executing JavaScript...`);
        const result = await this.page.evaluate(code);
        return result;
    }

    async close() {
        if (this.browser) {
            console.log(`🛑 Closing browser...`);
            await this.browser.close();
            console.log(`✅ Browser closed`);
        }
    }
}

// CLI interface
async function main() {
    const command = process.argv[2] || 'help';
    const args = process.argv.slice(3);

    const driver = new ReploidBrowserDriver();

    try {
        await driver.launch();
        await driver.navigate();

        switch (command) {
            case 'awaken':
                const goal = args.join(' ') || 'automated test';
                await driver.awakenAgent(goal);
                await driver.screenshot('/tmp/reploid-after-awaken.png');
                const errors = await driver.getConsoleErrors();
                if (errors.length > 0) {
                    console.log(`\n❌ Errors detected:`);
                    errors.forEach(err => console.log(`   ${err}`));
                }
                break;

            case 'reload':
                await driver.reload();
                break;

            case 'screenshot':
                const path = args[0] || '/tmp/reploid-screenshot.png';
                await driver.screenshot(path);
                break;

            case 'eval':
                const code = args.join(' ');
                const result = await driver.evaluate(code);
                console.log(`Result:`, result);
                break;

            case 'errors':
                const allErrors = await driver.getConsoleErrors();
                console.log(`\n📋 Console Errors:`);
                allErrors.forEach(err => console.log(`   ${err}`));
                break;

            case 'interactive':
                console.log(`\n🎮 Browser is open. Press Ctrl+C to close.`);
                await new Promise(() => {}); // Wait forever
                break;

            case 'help':
            default:
                console.log(`
REPLOID Browser Automation

Usage: node browser-automation.mjs <command> [args]

Commands:
  awaken [goal]     - Awaken agent with specified goal
  reload            - Reload the page
  screenshot [path] - Take a screenshot
  eval <code>       - Execute JavaScript in browser
  errors            - Show console errors
  interactive       - Open browser and keep it open
  help              - Show this help

Environment Variables:
  BASE_URL          - Base URL (default: http://localhost:8080)
  HEADLESS          - Run headless (default: true)
  TIMEOUT           - Page load timeout in ms (default: 30000)

Examples:
  node browser-automation.mjs awaken "make cool graphics"
  HEADLESS=false node browser-automation.mjs interactive
  node browser-automation.mjs screenshot ./screenshot.png
                `);
                break;
        }

        if (command !== 'interactive') {
            await driver.close();
        }

    } catch (error) {
        console.error(`\n❌ Error:`, error.message);
        await driver.close();
        process.exit(1);
    }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}

export default ReploidBrowserDriver;
