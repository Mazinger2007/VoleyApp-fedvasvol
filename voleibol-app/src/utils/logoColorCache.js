import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_KEY_PREFIX = '@logo_color_';

// In-memory cache is king — instant lookup with zero I/O
const memoryCache = new Map();

// Queue management
const extractionListeners = new Map();

// A Set means each URL only appears once
const extractionQueue = [];
const queuedUrls = new Set();

let isProcessingQueue = false;
let globalExtractorFn = null;

// ─── Cache hydration from AsyncStorage on startup ────────────────────────────
// We load the whole logo color storage into memory upfront once, so all
// subsequent getCachedLogoColor calls are synchronous Map lookups.
let hydrationDone = false;
let hydrationPromise = null;

export function hydrateLogoColorCache() {
  if (hydrationDone || hydrationPromise) return hydrationPromise;
  hydrationPromise = (async () => {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const logoKeys = (allKeys || []).filter((k) => k.startsWith(CACHE_KEY_PREFIX));
      if (logoKeys.length > 0) {
        const pairs = await AsyncStorage.multiGet(logoKeys);
        for (const [key, value] of pairs) {
          if (key && value) {
            const url = key.slice(CACHE_KEY_PREFIX.length);
            memoryCache.set(url, value);
          }
        }
      }
    } catch (_) {
      // ignore
    } finally {
      hydrationDone = true;
    }
  })();
  return hydrationPromise;
}

// ─── Read cache — purely synchronous after hydration ─────────────────────────
export function getCachedLogoColorSync(url) {
  if (!url) return null;
  return memoryCache.get(url) || null;
}

// ─── Async version for backwards-compat ──────────────────────────────────────
export async function getCachedLogoColor(url) {
  if (!url) return null;
  if (memoryCache.has(url)) return memoryCache.get(url);
  // Fallback single-key lookup (used before hydration completes)
  try {
    const cached = await AsyncStorage.getItem(CACHE_KEY_PREFIX + url);
    if (cached) {
      memoryCache.set(url, cached);
      return cached;
    }
  } catch (_) {
    // ignore
  }
  return null;
}

export async function setCachedLogoColor(url, color) {
  if (!url || !color) return;
  memoryCache.set(url, color);
  try {
    await AsyncStorage.setItem(CACHE_KEY_PREFIX + url, color);
  } catch (_) {
    // ignore
  }
}

// ─── Pub/Sub for live color updates ──────────────────────────────────────────
export function subscribeToLogoColor(url, callback) {
  if (!url || !callback) return () => {};
  if (!extractionListeners.has(url)) {
    extractionListeners.set(url, new Set());
  }
  extractionListeners.get(url).add(callback);
  return () => {
    extractionListeners.get(url)?.delete(callback);
  };
}

function notifySubscribers(url, color) {
  const set = extractionListeners.get(url);
  if (set) {
    for (const cb of set) {
      try { cb(color); } catch (_) { /* ignore */ }
    }
  }
}

// ─── Queue a URL for background color extraction ─────────────────────────────
export function requestLogoColorExtraction(url, extractColorFn) {
  if (!url) return;

  if (extractColorFn) globalExtractorFn = extractColorFn;

  // Serve instantly from memory if available (no async I/O needed)
  const cached = memoryCache.get(url);
  if (cached) {
    notifySubscribers(url, cached);
    return;
  }

  // Avoid duplicates in queue
  if (queuedUrls.has(url)) return;
  queuedUrls.add(url);
  extractionQueue.push(url);

  // Kick off the processor with a big initial delay so we never compete
  // with the first render / touch event processing.
  scheduleProcessing();
}

let processingScheduled = false;
function scheduleProcessing() {
  if (processingScheduled || isProcessingQueue) return;
  processingScheduled = true;
  // Wait 1.5s before starting so the UI has finished its first render
  setTimeout(() => {
    processingScheduled = false;
    processExtractionQueue();
  }, 1500);
}

async function processExtractionQueue() {
  if (isProcessingQueue || !globalExtractorFn) return;
  isProcessingQueue = true;

  try {
    while (extractionQueue.length > 0) {
      const url = extractionQueue.shift();
      queuedUrls.delete(url);

      // Check memory cache again (may have been populated by another path)
      const existing = memoryCache.get(url);
      if (existing) {
        notifySubscribers(url, existing);
      } else {
        try {
          const color = await globalExtractorFn(url);
          if (color) {
            await setCachedLogoColor(url, color);
            notifySubscribers(url, color);
          }
        } catch (_) {
          // ignore
        }
      }

      // Yield 600ms between each extraction to keep the JS thread free for touches
      if (extractionQueue.length > 0) {
        await new Promise((resolve) => setTimeout(resolve, 600));
      }
    }
  } finally {
    isProcessingQueue = false;
  }
}

// ─── Convenience bulk-queue helper ──────────────────────────────────────────
export function ensureLogoColorsCached(urls, extractColorFn) {
  if (!Array.isArray(urls)) return;
  for (const url of urls) {
    requestLogoColorExtraction(url, extractColorFn);
  }
}
