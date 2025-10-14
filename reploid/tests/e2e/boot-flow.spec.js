// E2E Test: Boot Flow - Persona Selection and Goal Setting
import { test, expect } from '@playwright/test';

test.describe('Boot Flow', () => {
  test('should load boot screen with boot modes', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#boot-container', { timeout: 10000 });

    // Check that boot screen is visible
    await expect(page.locator('h1')).toHaveText('REPLOID');

    // Check that boot modes are loaded
    const bootModes = page.locator('.boot-mode-btn');
    const count = await bootModes.count();
    expect(count).toBeGreaterThan(0); // Should have multiple boot modes

    // Check that goal input is enabled (Minimal RSI Core selected by default)
    const goalInput = page.locator('#goal-input');
    await expect(goalInput).toBeEnabled();

    // Check that awaken button is disabled initially (no goal entered)
    const awakenBtn = page.locator('#awaken-btn');
    await expect(awakenBtn).toBeDisabled();
  });

  test('should allow selecting different boot modes', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#boot-container', { timeout: 10000 });

    // Check that Minimal RSI Core is selected by default
    const minimalMode = page.locator('.boot-mode-btn[data-mode="minimal"]');
    await expect(minimalMode).toHaveClass(/selected/);

    // Select a different mode (e.g., Default Core)
    const defaultMode = page.locator('.boot-mode-btn[data-mode="default"]');
    await defaultMode.click();

    // Check that new mode is selected
    await expect(defaultMode).toHaveClass(/selected/);

    // Goal input should remain enabled
    const goalInput = page.locator('#goal-input');
    await expect(goalInput).toBeEnabled();

    // Awaken button should still be disabled (no goal yet)
    const awakenBtn = page.locator('#awaken-btn');
    await expect(awakenBtn).toBeDisabled();
  });

  test('should enable awaken button after entering goal', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#boot-container', { timeout: 10000 });

    // Mode is already selected by default (Minimal RSI Core)
    // Enter a goal
    const goalInput = page.locator('#goal-input');
    await goalInput.fill('Create a simple test function');

    // Check that awaken button is now enabled
    const awakenBtn = page.locator('#awaken-btn');
    await expect(awakenBtn).toBeEnabled();
  });

  test('should disable awaken button without goal', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#boot-container', { timeout: 10000 });

    // Mode is selected by default, but no goal entered
    const awakenBtn = page.locator('#awaken-btn');

    // Awaken button should be disabled without goal
    await expect(awakenBtn).toBeDisabled();
  });

  test('should sanitize goal input (maxlength)', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#boot-container', { timeout: 10000 });

    // Try to enter very long goal (>500 chars)
    const goalInput = page.locator('#goal-input');
    const longGoal = 'a'.repeat(600);
    await goalInput.fill(longGoal);

    // Check that input value is limited to 500 chars (HTML maxlength)
    const actualValue = await goalInput.inputValue();
    expect(actualValue.length).toBeLessThanOrEqual(500);
  });

  test('should support switching between config tabs', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#boot-container', { timeout: 10000 });

    // Check that Simple Mode tab is active by default
    const simpleModeTab = page.locator('.config-tab').first();
    await expect(simpleModeTab).toHaveClass(/active/);

    // Switch to Advanced Configuration tab
    const advancedTab = page.locator('.config-tab').last();
    await advancedTab.click();

    // Check that advanced tab is now active
    await expect(advancedTab).toHaveClass(/active/);

    // Simple Mode tab should no longer be active
    await expect(simpleModeTab).not.toHaveClass(/active/);
  });

  test('should display boot modes with correct structure', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#boot-container', { timeout: 10000 });

    const bootModes = page.locator('.boot-mode-btn');
    const count = await bootModes.count();
    expect(count).toBeGreaterThan(0);

    // Check that each mode has a label and description
    for (let i = 0; i < count; i++) {
      const mode = bootModes.nth(i);
      await expect(mode.locator('.boot-mode-label')).toBeVisible();
      await expect(mode.locator('.boot-mode-desc')).toBeVisible();
    }
  });

  test('should only allow one boot mode selected at a time', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#boot-container', { timeout: 10000 });

    // Check that Minimal RSI Core is selected by default
    const minimalMode = page.locator('.boot-mode-btn[data-mode="minimal"]');
    await expect(minimalMode).toHaveClass(/selected/);

    // Select different mode (Default Core)
    const defaultMode = page.locator('.boot-mode-btn[data-mode="default"]');
    await defaultMode.click();
    await expect(defaultMode).toHaveClass(/selected/);

    // First mode should no longer be selected
    await expect(minimalMode).not.toHaveClass(/selected/);
  });
});
