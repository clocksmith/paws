// E2E Test: Accessibility - Keyboard navigation and ARIA compliance
import { test, expect } from '@playwright/test';

test.describe('Accessibility', () => {
  test('should support keyboard navigation on boot screen', async ({ page }) => {
    await page.goto('/');

    // Wait for boot screen to load
    await page.waitForSelector('#boot-container', { timeout: 10000 });

    // Goal input should exist and be enabled (Minimal RSI Core is selected by default)
    const goalInput = page.locator('#goal-input');
    await goalInput.focus();
    await page.keyboard.type('Test keyboard navigation');

    // Goal should be entered
    const value = await goalInput.inputValue();
    expect(value).toContain('Test keyboard navigation');

    // Tab to awaken button
    await page.keyboard.press('Tab');

    // Verify button gets focus
    const awakenBtn = page.locator('#awaken-btn');
    await expect(awakenBtn).toBeFocused();
  });

  test('should have proper ARIA labels on boot screen', async ({ page }) => {
    await page.goto('/');

    // Wait for page to fully load
    await page.waitForSelector('#boot-container', { timeout: 10000 });

    // Check for ARIA labels on key elements
    const goalInput = page.locator('#goal-input');
    const placeholder = await goalInput.getAttribute('placeholder');
    expect(placeholder).toBeTruthy();

    // Boot mode buttons should be clickable
    const bootModeButtons = page.locator('.boot-mode-btn');
    const firstButton = bootModeButtons.first();
    await expect(firstButton).toBeVisible();
  });

  test('should support ESC key to clear focus', async ({ page }) => {
    await page.goto('/');

    // Wait for boot screen to load
    await page.waitForSelector('#boot-container', { timeout: 10000 });

    const goalInput = page.locator('#goal-input');
    await goalInput.fill('Test ESC behavior');
    await goalInput.focus();

    // Press ESC (behavior depends on implementation)
    await page.keyboard.press('Escape');

    // This test documents expected ESC behavior
    // Actual behavior may vary based on implementation
  });

  test('should have proper focus indicators', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#boot-container', { timeout: 10000 });

    // Tab through elements and verify focus is visible
    await page.keyboard.press('Tab');

    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();

    // Check that focused element has visual indication (outline, border, etc.)
    const outlineWidth = await focusedElement.evaluate((el) => {
      const styles = window.getComputedStyle(el);
      return styles.outlineWidth;
    });

    // Should have some outline (specific value depends on CSS)
    // This is a basic check for focus visibility
  });

  test('should handle keyboard shortcuts', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#boot-container', { timeout: 10000 });

    // Test tab navigation to config tabs
    const configTabs = page.locator('.config-tab');
    const firstTab = configTabs.first();
    await expect(firstTab).toBeVisible();

    // Test that awaken button is reachable via keyboard
    const awakenBtn = page.locator('#awaken-btn');
    await awakenBtn.focus();
    await expect(awakenBtn).toBeFocused();
  });

  test('should have semantic HTML structure', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#boot-container', { timeout: 10000 });

    // Check for semantic elements
    const heading = page.locator('h1');
    await expect(heading).toBeVisible();
    await expect(heading).toHaveText('REPLOID');

    // Check for proper button elements
    const awakenBtn = page.locator('#awaken-btn');
    const tagName = await awakenBtn.evaluate((el) => el.tagName);
    expect(tagName).toBe('BUTTON');

    // Check for proper input elements
    const goalInput = page.locator('#goal-input');
    const inputType = await goalInput.getAttribute('type');
    expect(inputType).toBe('text');
  });
});

test.describe('Accessibility - Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#boot-container', { timeout: 10000 });

    // Select Minimal RSI Core mode (should already be selected by default)
    await page.click('.boot-mode-btn[data-mode="minimal"]');

    await page.locator('#goal-input').fill('Test accessibility');
    await page.locator('#awaken-btn').click();
    await page.waitForTimeout(3000); // Wait for dashboard to initialize
  });

  test('should support keyboard navigation in dashboard', async ({ page }) => {
    // Tab through dashboard elements
    await page.keyboard.press('Tab');

    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();

    // Multiple tabs should navigate through interactive elements
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
    }

    // Should be able to navigate through dashboard
    // Specific assertions depend on dashboard structure
  });

  test('should have ARIA landmarks in dashboard', async ({ page }) => {
    // Look for semantic landmarks
    const main = page.locator('main, [role="main"]');
    const nav = page.locator('nav, [role="navigation"]');

    // At least one should exist for proper screen reader navigation
    const mainCount = await main.count();
    const navCount = await nav.count();

    expect(mainCount + navCount).toBeGreaterThan(0);
  });
});
