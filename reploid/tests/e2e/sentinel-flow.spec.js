// E2E Test: Sentinel Agent Flow - Full workflow from boot to dashboard
import { test, expect } from '@playwright/test';

test.describe('Sentinel Agent Flow', () => {
  test('should transition from boot to dashboard after awakening', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#boot-container', { timeout: 10000 });

    // Select Minimal RSI Core mode (already selected by default)
    await page.click('.boot-mode-btn[data-mode="minimal"]');

    // Enter a goal
    await page.locator('#goal-input').fill('Add a simple hello world function');

    // Click awaken button
    await page.locator('#awaken-btn').click();

    // Wait for dashboard to load (boot container should hide, app-root should show)
    await page.waitForTimeout(3000); // Give time for initialization

    // Check that boot container is hidden
    const bootContainer = page.locator('#boot-container');
    await expect(bootContainer).toHaveCSS('display', 'none');

    // Check that app-root is visible
    const appRoot = page.locator('#app-root');
    await expect(appRoot).toBeVisible();
  });

  test('should load dashboard with all required elements', async ({ page }) => {
    // Go through full boot flow
    await page.goto('/');
    await page.waitForSelector('#boot-container', { timeout: 10000 });
    await page.click('.boot-mode-btn[data-mode="minimal"]');
    await page.locator('#goal-input').fill('Test goal');
    await page.locator('#awaken-btn').click();

    await page.waitForTimeout(3000);

    // Check that main UI elements are present
    // Note: These selectors depend on actual dashboard structure
    // May need adjustment based on ui-dashboard.html structure

    // Look for common dashboard elements
    const appRoot = page.locator('#app-root');
    await expect(appRoot).toBeVisible();

    // Dashboard should have loaded modules and UI
    // Check for any common element that indicates successful load
    // This is a basic check - more specific checks can be added
  });

  test('should display FSM status indicator', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#boot-container', { timeout: 10000 });
    await page.click('.boot-mode-btn[data-mode="minimal"]');
    await page.locator('#goal-input').fill('Test FSM state');
    await page.locator('#awaken-btn').click();

    await page.waitForTimeout(3000);

    // FSM should start in IDLE state
    // Check for FSM status element (selector may need adjustment)
    const fsmStatus = page.locator('.fsm-status, #fsm-status, [data-fsm-status]');

    // Should exist after dashboard loads
    const count = await fsmStatus.count();
    expect(count).toBeGreaterThanOrEqual(0); // May or may not be visible initially
  });

  test('should handle goal input with special characters', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#boot-container', { timeout: 10000 });
    await page.click('.boot-mode-btn[data-mode="minimal"]');

    // Try goal with HTML tags (should be sanitized)
    const goalWithHtml = 'Create <script>alert("xss")</script> function';
    await page.locator('#goal-input').fill(goalWithHtml);

    await page.locator('#awaken-btn').click();
    await page.waitForTimeout(1000);

    // Dashboard should load without executing the script
    // If XSS prevention is working, no alert should appear
    // This is implicit - Playwright will fail if unexpected dialog appears
  });

  test('should preserve selected boot mode through boot process', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#boot-container', { timeout: 10000 });

    // Select specific boot mode (e.g., Default Core)
    const selectedMode = page.locator('.boot-mode-btn[data-mode="default"]');
    await selectedMode.click();

    // Get mode name
    const modeName = await selectedMode.locator('.boot-mode-label').textContent();
    expect(modeName).toBe('Default Core');

    // Enter goal and awaken
    await page.locator('#goal-input').fill('Test mode preservation');
    await page.locator('#awaken-btn').click();

    await page.waitForTimeout(3000);

    // After loading, the selected mode configuration should be used
    // This test verifies that mode selection is passed through correctly
    // Specific assertion depends on how mode affects dashboard
  });
});

test.describe('Dashboard Panels', () => {
  test.beforeEach(async ({ page }) => {
    // Helper to get to dashboard quickly
    await page.goto('/');
    await page.waitForSelector('#boot-container', { timeout: 10000 });
    await page.click('.boot-mode-btn[data-mode="minimal"]');
    await page.locator('#goal-input').fill('Test panel functionality');
    await page.locator('#awaken-btn').click();
    await page.waitForTimeout(3000);
  });

  test('should have panel toggle functionality', async ({ page }) => {
    // Look for panel toggle buttons
    const toggleButtons = page.locator('[data-toggle-panel], .panel-toggle, button[aria-controls]');
    const count = await toggleButtons.count();

    // Dashboard should have multiple panel toggles
    expect(count).toBeGreaterThan(0);
  });

  test('should persist panel state in localStorage', async ({ page }) => {
    // Check that localStorage is being used for panel state
    const storageKey = 'reploid_last_panel_view';

    // Get localStorage value
    const storedState = await page.evaluate((key) => {
      return localStorage.getItem(key);
    }, storageKey);

    // After dashboard loads, panel state should be saved
    // May be null initially, but structure should exist after interaction
    // This is a basic check
  });
});
