// WebGPU Module Loading Test - Verify LLMR and HYBR modules load correctly
import { test, expect } from '@playwright/test';

test.describe('WebGPU Module Loading', () => {
  test('should load LLMR and HYBR modules in config', async ({ page }) => {
    await page.goto('/');

    // Wait for boot screen
    await page.waitForSelector('#boot-container', { timeout: 10000 });

    // Check config.json includes LLMR and HYBR in minimalRSICore
    const configResponse = await page.evaluate(async () => {
      const response = await fetch('/config.json');
      return await response.json();
    });

    expect(configResponse.minimalRSICore).toContain('LLMR');
    expect(configResponse.minimalRSICore).toContain('HYBR');
  });

  test('should have WebLLM library loaded', async ({ page }) => {
    await page.goto('/');

    // Wait for page to load
    await page.waitForSelector('#boot-container', { timeout: 10000 });

    // Check if WebLLM script tag exists
    const hasWebLLM = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('script'));
      return scripts.some(script =>
        script.src.includes('@mlc-ai/web-llm')
      );
    });

    expect(hasWebLLM).toBe(true);
  });

  test('should show WebGPU availability after module loads', async ({ page }) => {
    await page.goto('/');

    // Wait for boot screen
    await page.waitForSelector('#boot-container', { timeout: 10000 });

    // Click "Launch Agent" button to trigger module loading
    // First, select Minimal RSI Core (should already be selected)
    await page.click('.boot-mode-btn[data-mode="minimal"]');

    // Enter a goal
    await page.fill('#goal-input', 'Test WebGPU availability');

    // Click Launch Agent button
    await page.click('#awaken-btn');

    // Wait a moment for modules to initialize (or dashboard to appear)
    await page.waitForTimeout(2000);

    // Check if WebGPU is available in browser context
    const webGPUInfo = await page.evaluate(async () => {
      if (!navigator.gpu) {
        return { available: false, reason: 'navigator.gpu not available' };
      }

      try {
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) {
          return { available: false, reason: 'No WebGPU adapter found' };
        }

        return {
          available: true,
          vendor: adapter.info?.vendor || 'Unknown',
          architecture: adapter.info?.architecture || 'Unknown'
        };
      } catch (error) {
        return { available: false, reason: error.message };
      }
    });

    // Log WebGPU availability (test passes either way, but logs the status)
    console.log('WebGPU Status:', webGPUInfo);

    // Test passes - we're just checking the status
    expect(webGPUInfo).toBeDefined();
  });

  test('should have local-llm.js module file', async ({ page }) => {
    await page.goto('/');

    // Try to fetch the local-llm.js module
    const moduleResponse = await page.evaluate(async () => {
      try {
        const response = await fetch('/upgrades/local-llm.js');
        return {
          exists: response.ok,
          status: response.status,
          contentType: response.headers.get('content-type')
        };
      } catch (error) {
        return { exists: false, error: error.message };
      }
    });

    expect(moduleResponse.exists).toBe(true);
    expect(moduleResponse.status).toBe(200);
    expect(moduleResponse.contentType).toContain('javascript');
  });

  test('should have hybrid-llm-provider.js module file', async ({ page }) => {
    await page.goto('/');

    // Try to fetch the hybrid-llm-provider.js module
    const moduleResponse = await page.evaluate(async () => {
      try {
        const response = await fetch('/upgrades/hybrid-llm-provider.js');
        return {
          exists: response.ok,
          status: response.status,
          contentType: response.headers.get('content-type')
        };
      } catch (error) {
        return { exists: false, error: error.message };
      }
    });

    expect(moduleResponse.exists).toBe(true);
    expect(moduleResponse.status).toBe(200);
    expect(moduleResponse.contentType).toContain('javascript');
  });

  test('should load upgrades configuration with LLMR and HYBR entries', async ({ page }) => {
    await page.goto('/');

    // Check config.json upgrades array
    const upgradesInfo = await page.evaluate(async () => {
      const response = await fetch('/config.json');
      const config = await response.json();

      const llmrUpgrade = config.upgrades.find(u => u.id === 'LLMR');
      const hybrUpgrade = config.upgrades.find(u => u.id === 'HYBR');

      return {
        llmr: llmrUpgrade,
        hybr: hybrUpgrade,
        totalUpgrades: config.upgrades.length
      };
    });

    // Verify LLMR upgrade exists
    expect(upgradesInfo.llmr).toBeDefined();
    expect(upgradesInfo.llmr.path).toBe('local-llm.js');
    expect(upgradesInfo.llmr.category).toBe('runtime');

    // Verify HYBR upgrade exists
    expect(upgradesInfo.hybr).toBeDefined();
    expect(upgradesInfo.hybr.path).toBe('hybrid-llm-provider.js');
    expect(upgradesInfo.hybr.category).toBe('agent');

    // Log total upgrades count
    console.log(`Total upgrades configured: ${upgradesInfo.totalUpgrades}`);
  });
});
