/**
 * Live Reload - Automatically reloads the page when the server detects changes
 * This creates a tight feedback loop for development
 */

let lastModified = Date.now();
let errorCount = 0;
const CHECK_INTERVAL = 1000; // Check every second

// Track if we've seen errors to avoid reload loops
window._reloadErrorThreshold = 3;
window._consecutiveErrors = 0;

function checkForUpdates() {
  fetch('/api/health', {
    headers: { 'Cache-Control': 'no-cache' }
  })
    .then(response => response.json())
    .then(data => {
      // Check if server timestamp has changed (indicating restart/changes)
      const serverTime = new Date(data.timestamp).getTime();

      if (lastModified && serverTime > lastModified + 2000) {
        console.log('[LiveReload] Server restarted, reloading page...');
        window.location.reload();
      }

      lastModified = serverTime;
      errorCount = 0; // Reset error count on success
    })
    .catch(err => {
      errorCount++;
      if (errorCount > 10) {
        console.error('[LiveReload] Server appears to be down, stopping checks');
        clearInterval(window._reloadInterval);
      }
    });
}

// Start checking for updates
window._reloadInterval = setInterval(checkForUpdates, CHECK_INTERVAL);

// Listen for console errors and track them
const originalError = console.error;
console.error = function(...args) {
  originalError.apply(console, args);

  // Count consecutive errors
  window._consecutiveErrors++;

  // If we hit threshold, stop auto-reload to prevent loops
  if (window._consecutiveErrors >= window._reloadErrorThreshold) {
    console.warn('[LiveReload] Too many errors, disabling auto-reload to prevent loops');
    clearInterval(window._reloadInterval);
  }
};

// Reset error counter when user interacts (they're actively debugging)
['click', 'keydown'].forEach(event => {
  document.addEventListener(event, () => {
    if (window._consecutiveErrors > 0) {
      window._consecutiveErrors = Math.max(0, window._consecutiveErrors - 1);
    }
  }, { passive: true });
});

console.log('[LiveReload] Auto-reload enabled');
