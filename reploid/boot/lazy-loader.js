/**
 * Lazy Loader - Dynamically loads CDN libraries on demand
 * Prevents loading unnecessary dependencies during boot
 */

const loadedLibraries = new Set();
const loadingPromises = new Map();

// CDN URLs for libraries
const CDN_URLS = {
    'chart.js': 'https://cdn.jsdelivr.net/npm/chart.js',
    'd3': 'https://cdn.jsdelivr.net/npm/d3@7',
    'acorn': 'https://cdnjs.cloudflare.com/ajax/libs/acorn/8.11.3/acorn.min.js',
    'prism': 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js',
    'prism-css': 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css',
    'webllm': 'https://esm.run/@mlc-ai/web-llm'
};

/**
 * Load a library from CDN
 * @param {string} name - Library name (e.g., 'chart.js', 'd3')
 * @param {string} [customUrl] - Optional custom URL to override default
 * @returns {Promise<void>}
 */
export async function loadLibrary(name, customUrl = null) {
    // Check if already loaded
    if (loadedLibraries.has(name)) {
        console.log(`[LazyLoader] Library '${name}' already loaded`);
        return;
    }

    // Check if currently loading
    if (loadingPromises.has(name)) {
        console.log(`[LazyLoader] Waiting for '${name}' to finish loading...`);
        return await loadingPromises.get(name);
    }

    const url = customUrl || CDN_URLS[name];
    if (!url) {
        throw new Error(`[LazyLoader] Unknown library '${name}' and no custom URL provided`);
    }

    console.log(`[LazyLoader] Loading '${name}' from ${url}`);

    const loadPromise = new Promise((resolve, reject) => {
        const isCSS = url.endsWith('.css');

        if (isCSS) {
            // Load CSS file
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = url;
            link.onload = () => {
                loadedLibraries.add(name);
                loadingPromises.delete(name);
                console.log(`[LazyLoader] ✓ Loaded CSS: ${name}`);
                resolve();
            };
            link.onerror = (error) => {
                loadingPromises.delete(name);
                console.error(`[LazyLoader] ✗ Failed to load CSS: ${name}`, error);
                reject(error);
            };
            document.head.appendChild(link);
        } else {
            // Load JS file
            const script = document.createElement('script');
            script.src = url;

            // Use module type for ES modules
            if (name === 'webllm') {
                script.type = 'module';
            }

            script.onload = () => {
                loadedLibraries.add(name);
                loadingPromises.delete(name);
                console.log(`[LazyLoader] ✓ Loaded: ${name}`);
                resolve();
            };
            script.onerror = (error) => {
                loadingPromises.delete(name);
                console.error(`[LazyLoader] ✗ Failed to load: ${name}`, error);
                reject(error);
            };
            document.head.appendChild(script);
        }
    });

    loadingPromises.set(name, loadPromise);
    return await loadPromise;
}

/**
 * Load multiple libraries in parallel
 * @param {string[]} names - Array of library names
 * @returns {Promise<void>}
 */
export async function loadLibraries(names) {
    console.log(`[LazyLoader] Loading ${names.length} libraries:`, names);
    await Promise.all(names.map(name => loadLibrary(name)));
    console.log(`[LazyLoader] All libraries loaded`);
}

/**
 * Check if a library is loaded
 * @param {string} name - Library name
 * @returns {boolean}
 */
export function isLoaded(name) {
    return loadedLibraries.has(name);
}

/**
 * Get list of all loaded libraries
 * @returns {string[]}
 */
export function getLoadedLibraries() {
    return Array.from(loadedLibraries);
}
