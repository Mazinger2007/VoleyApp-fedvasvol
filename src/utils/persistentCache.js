// src/utils/persistentCache.js
// Cache de resultados parseados persistente (AsyncStorage).
// Objetivo: la primera carga de la app muestra datos al instante (desde disco)
// mientras se refrescan en segundo plano, en vez de esperar la red.
//
// - Un único blob JSON por chunk para minimizar I/O.
// - Cola de escritura con coalescing: si llegan N escrituras seguidas, solo
//   se escribe una vez al disco (debounce corto).
// - TTL configurable por entrada para purga automática.

import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_KEY = '@html_blocks_cache_v1';
const CHUNK_SIZE = 400; // entradas por chunk: 0-399, 400-799, ...
const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 días
const WRITE_DEBOUNCE_MS = 800;

const chunks = new Map(); // "chunkIndex" -> Map(url -> { b: blocks, t: timestamp })
let loaded = false;
let loadPromise = null;
let dirtyChunks = new Set();
let writeTimer = null;

function chunkIndexOf(key) {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % CHUNK_SIZE;
}

// Load all chunks from disk once at startup
export function hydratePersistentCache() {
  if (loaded) return Promise.resolve();
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = (keys || []).filter((k) => k.startsWith(CACHE_KEY));
      if (cacheKeys.length === 0) {
        loaded = true;
        return;
      }
      const pairs = await AsyncStorage.multiGet(cacheKeys);
      const now = Date.now();
      for (const [key, value] of pairs) {
        if (!value) continue;
        try {
          const parsed = JSON.parse(value);
          const idx = Number(key.slice(CACHE_KEY.length));
          const entries = Object.entries(parsed || {});
          const m = new Map();
          for (const [url, entry] of entries) {
            // Purga de entradas caducadas al hidratar
            if (!entry || !entry.b || now - (entry.t || 0) > DEFAULT_TTL_MS) continue;
            m.set(url, entry);
          }
          chunks.set(idx, m);
        } catch (_) {
          // chunk corrupto: se ignora y se sobrescribirá al guardar
        }
      }
    } catch (_) {
      // ignore hydration errors
    } finally {
      loaded = true;
    }
  })();
  return loadPromise;
}

// Kick off hydration immediately on module import (non-blocking)
if (typeof AsyncStorage?.getAllKeys === 'function') {
  hydratePersistentCache().catch(() => {});
}

function scheduleFlush() {
  if (writeTimer) return;
  writeTimer = setTimeout(async () => {
    writeTimer = null;
    const toWrite = dirtyChunks;
    dirtyChunks = new Set();
    for (const idx of toWrite) {
      const m = chunks.get(idx);
      if (!m) continue;
      try {
        const obj = {};
        for (const [url, entry] of m) obj[url] = entry;
        await AsyncStorage.setItem(`${CACHE_KEY}${idx}`, JSON.stringify(obj));
      } catch (_) {
        // storage full / error: silently drop (memoria sigue funcionando)
      }
    }
  }, WRITE_DEBOUNCE_MS);
}

/** ¿Existe en disco (aunque la hidratación no haya terminado)? No bloquea. */
export function hasCached(url) {
  if (!url) return false;
  const idx = chunkIndexOf(url);
  const m = chunks.get(idx);
  return m ? m.has(url) : false;
}

/** Lee del cache persistente. Resuelve [] si no existe. */
export async function getCachedBlocks(url) {
  if (!url) return null;
  await hydratePersistentCache();
  const idx = chunkIndexOf(url);
  const m = chunks.get(idx);
  const entry = m?.get(url);
  if (!entry) return null;
  return Array.isArray(entry.b) ? entry.b : null;
}

/** Lee sin esperar hidratación (null si aún no está). */
export function getCachedBlocksSync(url) {
  if (!url) return null;
  const idx = chunkIndexOf(url);
  const m = chunks.get(idx);
  const entry = m?.get(url);
  return entry && Array.isArray(entry.b) ? entry.b : null;
}

/** Guarda bloques en cache persistente (fire-and-forget). */
export function setCachedBlocks(url, blocks) {
  if (!url || !Array.isArray(blocks) || blocks.length === 0) return;
  const idx = chunkIndexOf(url);
  let m = chunks.get(idx);
  if (!m) {
    m = new Map();
    chunks.set(idx, m);
  }
  m.set(url, { b: blocks, t: Date.now() });
  dirtyChunks.add(idx);
  scheduleFlush();
}

/** Borra una URL del cache persistente (usado al refrescar forzadamente). */
export function deleteCachedBlocks(url) {
  if (!url) return;
  const idx = chunkIndexOf(url);
  const m = chunks.get(idx);
  if (m && m.has(url)) {
    m.delete(url);
    dirtyChunks.add(idx);
    scheduleFlush();
  }
}

/** Borra TODO el cache persistente. */
export async function clearPersistentCache() {
  chunks.clear();
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = (keys || []).filter((k) => k.startsWith(CACHE_KEY));
    if (cacheKeys.length > 0) await AsyncStorage.multiRemove(cacheKeys);
  } catch (_) {
    // ignore
  }
}
