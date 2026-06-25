// src/hooks/useFetch.js
// Hook reutilizable para descargar y parsear cualquier URL de la federación.
// Gestiona los estados: cargando, datos, error y recarga.
// V4: Soporta señal de aborto para cancelar navegación.

import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchAndParse } from '../utils/htmlParser';

// Keyed by URL → parsed block array. Solo dura lo que la sesión de la app.
export const resultCache = new Map();

/**
 * @param {string} url - URL pública a parsear
 * @returns {{ blocks, loading, error, refresh }}
 */
export function useFetch(url, options = {}) {
  const { lazy = false } = options;
  const [state, setState] = useState(() => ({
    url,
    blocks: (url && !lazy && resultCache.has(url)) ? resultCache.get(url) : [],
    loading: url && !lazy && !resultCache.has(url),
    error: null,
  }));

  const latestRequestTokenRef = useRef(0);
  const abortControllerRef = useRef(null);

  // Derivación de estado síncrona: Si la URL cambia, reseteamos el estado INMEDIATAMENTE
  if (state.url !== url) {
    setState({
      url,
      blocks: (url && resultCache.has(url)) ? resultCache.get(url) : [],
      loading: url && !lazy && !resultCache.has(url),
      error: null,
    });
  }

  const load = useCallback(async (forceRefresh = false) => {
    const currentUrl = url;
    if (!currentUrl || (lazy && !forceRefresh && !resultCache.has(currentUrl))) {
      return;
    }

    const nextToken = Date.now() + Math.random();
    latestRequestTokenRef.current = nextToken;

    // Cancel previous request if any
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    // Memoria (solo sesión actual)
    const cached = resultCache.get(currentUrl);
    if (cached && !forceRefresh) {
      if (latestRequestTokenRef.current === nextToken) {
        setState({ url: currentUrl, blocks: cached, loading: false, error: null });
      }
      return;
    }

    // Red
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const result = await fetchAndParse(currentUrl, { signal });
      
      if (latestRequestTokenRef.current === nextToken && !signal.aborted) {
        resultCache.set(currentUrl, result);
        setState({ url: currentUrl, blocks: result, loading: false, error: null });
      }
    } catch (caughtError) {
      if (latestRequestTokenRef.current === nextToken && !signal.aborted) {
        const errorMsg = caughtError?.message || 'Error desconocido';
        setState({ url: currentUrl, blocks: [], loading: false, error: errorMsg });
      }
    }
  }, [url, lazy]);

  const refresh = useCallback(() => {
    if (url) resultCache.delete(url);
    load(true);
  }, [url, load]);

  useEffect(() => {
    load();
    return () => {
      // Cleanup on unmount
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [load]);

  return { blocks: state.blocks, loading: state.loading, error: state.error, refresh };
}
