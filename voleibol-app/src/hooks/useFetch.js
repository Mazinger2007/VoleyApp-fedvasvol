// src/hooks/useFetch.js
// Hook reutilizable para descargar y parsear cualquier URL de la federación.
// Gestiona los estados: cargando, datos, error y recarga.

import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchAndParse } from '../utils/htmlParser';

const inFlightByUrl = new Map();

/**
 * @param {string} url - URL pública a parsear
 * @returns {{ blocks, loading, error, refresh }}
 */
export function useFetch(url) {
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const latestRequestTokenRef = useRef(0);

  const load = useCallback(async () => {
    const nextToken = Date.now() + Math.random();
    latestRequestTokenRef.current = nextToken;

    if (!url) {
      setBlocks([]);
      setError(null);
      setLoading(false);
      return;
    }
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
        setBlocks(result);
      }
    } catch (err) {
      if (latestRequestTokenRef.current === nextToken) {
        setError(err.message || 'Error desconocido');
      }
    } finally {
      if (latestRequestTokenRef.current === nextToken) {
        setLoading(false);
      }
    }
  }, [url]);

  useEffect(() => {
    load();
  }, [load]);

  return { blocks, loading, error, refresh: load };
}
