// Service Worker for REPLOID
// Enables offline operation, background processing, and persistent autonomy

const CACHE_NAME = 'reploid-v1';
const RUNTIME_CACHE = 'reploid-runtime';
const API_CACHE = 'reploid-api';

// Files to cache for offline operation
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/upgrades/app-logic.js',
  '/upgrades/boot-module-loader.js',
  '/upgrades/module-manifest.json',
  '/upgrades/utils.js',
  '/upgrades/api-client.js',
  '/upgrades/state-manager.js',
  '/upgrades/agent-cycle.js',
  '/upgrades/tool-runner.js',
  '/upgrades/storage-indexeddb.js',
  '/upgrades/ui-manager.js',
  '/upgrades/tool-worker.js',
  '/upgrades/worker-pool.js'
];

// Install event - cache essential files
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[ServiceWorker] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activating...');
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(name => name.startsWith('reploid-') && name !== CACHE_NAME)
            .map(name => caches.delete(name))
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache when offline
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Handle API requests separately
  if (url.pathname.includes('/api/') || url.hostname.includes('googleapis.com')) {
    event.respondWith(handleApiRequest(request));
    return;
  }
  
  // Handle static assets
  event.respondWith(
    caches.match(request)
      .then(response => {
        if (response) {
          return response;
        }
        
        return fetch(request).then(response => {
          // Cache successful responses
          if (response.ok) {
            const responseToCache = response.clone();
            caches.open(RUNTIME_CACHE)
              .then(cache => cache.put(request, responseToCache));
          }
          return response;
        });
      })
      .catch(() => {
        // Return offline page if available
        if (request.destination === 'document') {
          return caches.match('/index.html');
        }
      })
  );
});

// Handle API requests with intelligent caching
async function handleApiRequest(request) {
  const cache = await caches.open(API_CACHE);
  
  try {
    // Try network first for API calls
    const response = await fetch(request);
    
    if (response.ok) {
      // Cache successful API responses with timestamp
      const responseData = await response.clone().json();
      const cachedResponse = new Response(JSON.stringify({
        timestamp: Date.now(),
        data: responseData
      }), {
        headers: response.headers
      });
      
      await cache.put(request, cachedResponse);
    }
    
    return response;
  } catch (error) {
    // Fallback to cache if offline
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      const cachedData = await cachedResponse.json();
      const age = Date.now() - cachedData.timestamp;
      
      // Return cached data if less than 1 hour old
      if (age < 3600000) {
        return new Response(JSON.stringify(cachedData.data), {
          headers: cachedResponse.headers
        });
      }
    }
    
    throw error;
  }
}

// Background sync for queued operations
self.addEventListener('sync', (event) => {
  console.log('[ServiceWorker] Background sync triggered');
  
  if (event.tag === 'reploid-sync') {
    event.waitUntil(syncQueuedOperations());
  }
});

// Sync queued operations when back online
async function syncQueuedOperations() {
  const db = await openIndexedDB();
  const tx = db.transaction(['queued_operations'], 'readonly');
  const store = tx.objectStore('queued_operations');
  const operations = await store.getAll();
  
  for (const op of operations) {
    try {
      // Execute queued operation
      await executeOperation(op);
      
      // Remove from queue after successful execution
      const deleteTx = db.transaction(['queued_operations'], 'readwrite');
      await deleteTx.objectStore('queued_operations').delete(op.id);
    } catch (error) {
      console.error('[ServiceWorker] Failed to sync operation:', error);
    }
  }
}

// Execute a queued operation
async function executeOperation(operation) {
  switch (operation.type) {
    case 'api_call':
      return fetch(operation.url, operation.options);
    case 'state_update':
      return updateState(operation.data);
    case 'tool_execution':
      return executeToolInBackground(operation.tool, operation.args);
    default:
      throw new Error(`Unknown operation type: ${operation.type}`);
  }
}

// Background tool execution
async function executeToolInBackground(toolName, toolArgs) {
  // Create a client for background execution
  const client = await self.clients.matchAll({ type: 'window' })
    .then(clients => clients[0]);
  
  if (!client) {
    throw new Error('No active client for background execution');
  }
  
  // Send message to client to execute tool
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    
    channel.port1.onmessage = (event) => {
      if (event.data.success) {
        resolve(event.data.result);
      } else {
        reject(new Error(event.data.error));
      }
    };
    
    client.postMessage({
      type: 'background_tool_execution',
      tool: toolName,
      args: toolArgs
    }, [channel.port2]);
  });
}

// Periodic background tasks
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'reploid-autonomous-cycle') {
    console.log('[ServiceWorker] Autonomous cycle triggered');
    event.waitUntil(runAutonomousCycle());
  }
});

// Run an autonomous cycle in the background
async function runAutonomousCycle() {
  try {
    // Check if we should run (based on config)
    const config = await getConfig();
    if (!config.enableAutonomous) return;
    
    // Get current state
    const state = await getState();
    if (!state.currentGoal) return;
    
    // Execute a cycle
    const result = await executeBackgroundCycle(state);
    
    // Notify client if available
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach(client => {
      client.postMessage({
        type: 'background_cycle_complete',
        result
      });
    });
    
  } catch (error) {
    console.error('[ServiceWorker] Autonomous cycle failed:', error);
  }
}

// Execute a cycle in the background
async function executeBackgroundCycle(state) {
  // This would interface with the agent-cycle module
  // For now, return a placeholder
  return {
    cycle: state.totalCycles + 1,
    timestamp: Date.now(),
    success: true,
    changes: []
  };
}

// Helper to open IndexedDB
function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('REPLOID_ServiceWorker', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      if (!db.objectStoreNames.contains('queued_operations')) {
        db.createObjectStore('queued_operations', { keyPath: 'id', autoIncrement: true });
      }
      
      if (!db.objectStoreNames.contains('config')) {
        db.createObjectStore('config', { keyPath: 'key' });
      }
      
      if (!db.objectStoreNames.contains('state')) {
        db.createObjectStore('state', { keyPath: 'key' });
      }
    };
  });
}

// Get configuration from IndexedDB
async function getConfig() {
  const db = await openIndexedDB();
  const tx = db.transaction(['config'], 'readonly');
  const store = tx.objectStore('config');
  const config = await store.get('main');
  return config?.value || { enableAutonomous: false };
}

// Get state from IndexedDB
async function getState() {
  const db = await openIndexedDB();
  const tx = db.transaction(['state'], 'readonly');
  const store = tx.objectStore('state');
  const state = await store.get('current');
  return state?.value || {};
}

// Update state in IndexedDB
async function updateState(newState) {
  const db = await openIndexedDB();
  const tx = db.transaction(['state'], 'readwrite');
  const store = tx.objectStore('state');
  await store.put({ key: 'current', value: newState });
}

// Message handler for client communication
self.addEventListener('message', (event) => {
  const { type, data } = event.data;
  
  switch (type) {
    case 'queue_operation':
      queueOperation(data).then(() => {
        event.ports[0].postMessage({ success: true });
      }).catch(error => {
        event.ports[0].postMessage({ success: false, error: error.message });
      });
      break;
      
    case 'enable_autonomous':
      enableAutonomousMode(data).then(() => {
        event.ports[0].postMessage({ success: true });
      });
      break;
      
    case 'get_cache_stats':
      getCacheStats().then(stats => {
        event.ports[0].postMessage({ success: true, stats });
      });
      break;
  }
});

// Queue an operation for later execution
async function queueOperation(operation) {
  const db = await openIndexedDB();
  const tx = db.transaction(['queued_operations'], 'readwrite');
  const store = tx.objectStore('queued_operations');
  await store.add({
    ...operation,
    timestamp: Date.now()
  });
  
  // Register for background sync
  await self.registration.sync.register('reploid-sync');
}

// Enable autonomous mode with periodic sync
async function enableAutonomousMode(config) {
  const db = await openIndexedDB();
  const tx = db.transaction(['config'], 'readwrite');
  const store = tx.objectStore('config');
  await store.put({ key: 'main', value: { ...config, enableAutonomous: true } });
  
  // Register for periodic sync (if supported)
  if ('periodicSync' in self.registration) {
    await self.registration.periodicSync.register('reploid-autonomous-cycle', {
      minInterval: config.cycleInterval || 60 * 60 * 1000 // Default 1 hour
    });
  }
}

// Get cache statistics
async function getCacheStats() {
  const cacheNames = await caches.keys();
  const stats = {};
  
  for (const name of cacheNames) {
    const cache = await caches.open(name);
    const requests = await cache.keys();
    stats[name] = {
      count: requests.length,
      urls: requests.map(r => r.url)
    };
  }
  
  return stats;
}

console.log('[ServiceWorker] Loaded and ready');