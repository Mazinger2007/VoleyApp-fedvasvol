// src/hooks/useFetch.js
// Hook reutilizable para descargar y parsear cualquier URL de la federación.
// Gestiona los estados: cargando, datos, error y recarga.
// V3: Evita flash de datos cacheados de URLs anteriores al cambiar de URL.

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
  const [state, setState] = useState(() => ({
    url,
    blocks: (url && resultCache.has(url)) ? resultCache.get(url) : [],
    loading: !url || !resultCache.has(url),
    error: null,
  }));

  const latestRequestTokenRef = useRef(0);

  // Derivación de estado síncrona: Si la URL cambia, reseteamos el estado INMEDIATAMENTE
  // (antes de que se dibuje nada en pantalla) para evitar flash de datos antiguos.
  if (state.url !== url) {
    setState({
      url,
      blocks: (url && resultCache.has(url)) ? resultCache.get(url) : [],
      loading: !url || !resultCache.has(url),
      error: null,
    });
  }

  const load = useCallback(async (forceRefresh = false) => {
    const currentUrl = url;
    const nextToken = Date.now() + Math.random();
    latestRequestTokenRef.current = nextToken;

    if (!currentUrl) {
      if (latestRequestTokenRef.current === nextToken) {
        setState({ url: currentUrl, blocks: [], loading: false, error: null });
      }
      return;
    }

    const cached = resultCache.get(currentUrl);
    if (cached && !forceRefresh) {
      if (latestRequestTokenRef.current === nextToken) {
        setState({ url: currentUrl, blocks: cached, loading: false, error: null });
      }
      return;
    }

    // Ya hemos puesto loading: true de forma síncrona en el if (state.url !== url),
    // pero si es un forceRefresh explícito desde el botón, lo forzamos visualmente.
    if (forceRefresh) {
      setState(prev => ({ ...prev, loading: true, error: null }));
    }

    try {
      let pending = inFlightByUrl.get(currentUrl);
      if (!pending) {
        pending = fetchAndParse(currentUrl).finally(() => {
          if (inFlightByUrl.get(currentUrl) === pending) {
            inFlightByUrl.delete(currentUrl);
          }
        });
        inFlightByUrl.set(currentUrl, pending);
      }

      const result = await pending;
      if (latestRequestTokenRef.current === nextToken) {
        resultCache.set(currentUrl, result);
        setState({ url: currentUrl, blocks: result, loading: false, error: null });
      }
    } catch (err) {
      if (latestRequestTokenRef.current === nextToken) {
        setState(prev => ({ ...prev, loading: false, error: err.message || 'Error desconocido' }));
      }
    }
  }, [url]);

  const refresh = useCallback(() => {
    if (url) resultCache.delete(url);
    load(true);
  }, [url, load]);

  useEffect(() => {
    // Si la cache ya tiene estos datos, load resolverá de inmediato
    load();
  }, [load]);

  return { blocks: state.blocks, loading: state.loading, error: state.error, refresh };
}
