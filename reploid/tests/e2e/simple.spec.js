// Simple E2E Test - Verify Playwright setup works
import { test, expect } from '@playwright/test';

test.describe('Simple Boot Test', () => {
  test('should load the page and boot screen', async ({ page }) => {
    await page.goto('/');

    // Wait for boot container to be visible
    await page.waitForSelector('#boot-container', { timeout: 10000 });

    // Check title exists
    const title = await page.title();
    expect(title).toContain('REPLOID');
  });

  test('should have REPLOID heading', async ({ page }) => {
    await page.goto('/');

    // Wait for boot header
    await page.waitForSelector('.boot-header', { timeout: 10000 });

    const h1 = await page.locator('h1').textContent();
    expect(h1).toBe('REPLOID');
  });

  test('should show Simple Mode by default', async ({ page }) => {
    await page.goto('/');

    // Wait for boot screen
    await page.waitForSelector('.boot-mode-options', { timeout: 10000 });

    // Check that Simple Mode tab is active
    const activeTab = await page.locator('.config-tab.active').textContent();
    expect(activeTab).toContain('Simple Mode');
  });

  test('should have Minimal RSI Core selected by default', async ({ page }) => {
    await page.goto('/');

    // Wait for boot mode buttons
    await page.waitForSelector('.boot-mode-btn.selected', { timeout: 10000 });

    // Check that Minimal RSI Core is selected
    const selectedMode = await page.locator('.boot-mode-btn.selected .boot-mode-label').textContent();
    expect(selectedMode).toBe('Minimal RSI Core');
  });

  test('should show server status as connected', async ({ page }) => {
    await page.goto('/');

    // Wait for status bar
    await page.waitForSelector('.status-bar', { timeout: 10000 });

    // Check server status
    const statusValue = await page.locator('#api-status').textContent();
    expect(statusValue).toContain('Connected');
  });

  test('should show Gemini as AI provider', async ({ page }) => {
    await page.goto('/');

    // Wait for status bar
    await page.waitForSelector('#provider-status', { timeout: 10000 });

    // Check provider
    const provider = await page.locator('#provider-status').textContent();
    expect(provider).toContain('Gemini');
  });
});
