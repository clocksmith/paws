/**
 * Console Monitor - Automatically logs browser console to a file
 * This allows the AI to monitor browser console output without manual copy/paste
 */

// Intercept console methods
const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error,
  info: console.info
};

const logBuffer = [];
const MAX_BUFFER_SIZE = 100;

function formatLogEntry(level, args) {
  const timestamp = new Date().toISOString();
  const message = args.map(arg => {
    if (arg instanceof Error) {
      // Handle Error objects specially
      return `${arg.name}: ${arg.message}\n${arg.stack || ''}`;
    } else if (typeof arg === 'object' && arg !== null) {
      try {
        // For objects, include non-enumerable properties if it's an error-like object
        if (arg.message || arg.stack) {
          return `Error-like object: ${arg.message || ''}\n${arg.stack || ''}`;
        }
        return JSON.stringify(arg, null, 2);
      } catch (e) {
        return String(arg);
      }
    }
    return String(arg);
  }).join(' ');

  return {
    timestamp,
    level,
    message
  };
}

function sendLogsToServer() {
  if (logBuffer.length === 0) return;

  const logs = [...logBuffer];
  logBuffer.length = 0;

  // Send to proxy server endpoint
  fetch('http://localhost:8000/api/console-logs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ logs })
  }).catch(err => {
    // Silently fail - don't want to create infinite loop
  });
}

// Wrap console methods
['log', 'warn', 'error', 'info'].forEach(level => {
  console[level] = function(...args) {
    // Call original
    originalConsole[level].apply(console, args);

    // Buffer log
    const entry = formatLogEntry(level, args);
    logBuffer.push(entry);

    // Trim buffer
    if (logBuffer.length > MAX_BUFFER_SIZE) {
      logBuffer.shift();
    }

    // Send to server (debounced)
    clearTimeout(console._sendTimeout);
    console._sendTimeout = setTimeout(sendLogsToServer, 500);
  };
});

console.log('[ConsoleMonitor] Browser console monitoring enabled');
