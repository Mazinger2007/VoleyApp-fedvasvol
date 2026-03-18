// src/hooks/useFetch.js
// Hook reutilizable para descargar y parsear cualquier URL de la federación.
// Gestiona los estados: cargando, datos, error y recarga.
// V2: in-memory result cache so revisited URLs render instantly.

import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchAndParse } from '../utils/htmlParser';

// Keyed by URL → parsed block array. Persists for the entire app session.
const resultCache = new Map();
const inFlightByUrl = new Map();

/**
 * @param {string} url - URL pública a parsear
 * @returns {{ blocks, loading, error, refresh }}
 */
export function useFetch(url) {
  // Seed immediately from cache if available (zero-loading-flash on revisits)
  const [blocks, setBlocks] = useState(() => resultCache.get(url) || []);
  const [loading, setLoading] = useState(() => !resultCache.has(url));
  const [error, setError] = useState(null);
  const latestRequestTokenRef = useRef(0);

  const load = useCallback(async (forceRefresh = false) => {
    const nextToken = Date.now() + Math.random();
    latestRequestTokenRef.current = nextToken;

    if (!url) {
      setBlocks([]);
      setError(null);
      setLoading(false);
      return;
    }

    // Serve from cache instantly, then refresh in background
    const cached = resultCache.get(url);
    if (cached && !forceRefresh) {
      setBlocks(cached);
      setLoading(false);
      setError(null);
      return;
    }

    console.log('[useFetch] → Loading', url);
    const start = Date.now();
    setLoading(true);
    setError(null);

    try {
      let pending = inFlightByUrl.get(url);
      if (!pending) {
        pending = fetchAndParse(url).finally(() => {
          if (inFlightByUrl.get(url) === pending) {
            inFlightByUrl.delete(url);
          }
        });
        inFlightByUrl.set(url, pending);
      }

      const result = await pending;
      if (latestRequestTokenRef.current === nextToken) {
        const elapsed = Date.now() - start;
        console.log('[useFetch] ✓ Loaded in', `${elapsed}ms`, { blocks: result.length });
        resultCache.set(url, result);
        setBlocks(result);
      }
    } catch (err) {
      if (latestRequestTokenRef.current === nextToken) {
        const elapsed = Date.now() - start;
        console.log('[useFetch] ✗ Failed in', `${elapsed}ms`, { error: err.message });
        setError(err.message || 'Error desconocido');
      }
    } finally {
      if (latestRequestTokenRef.current === nextToken) {
        setLoading(false);
      }
    }
  }, [url]);

  const refresh = useCallback(() => {
    resultCache.delete(url);
    load(true);
  }, [url, load]);

  useEffect(() => {
    load();
  }, [load]);

  return { blocks, loading, error, refresh };
}
