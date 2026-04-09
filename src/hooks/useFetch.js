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

    const cached = resultCache.get(currentUrl);
    if (cached && !forceRefresh) {
      if (latestRequestTokenRef.current === nextToken) {
        setState({ url: currentUrl, blocks: cached, loading: false, error: null });
      }
      return;
    }

    if (forceRefresh || state.url !== currentUrl) {
      setState(prev => ({ ...prev, loading: true, error: null }));
    }

    try {
      // Note: htmlParser.js fetchAndParse doesn't currently take a signal, 
      // but the network layer (axios) in fetchHTML does support it if we pass it down.
      // For now, we handle the state updates only if not aborted via latestRequestTokenRef.
      
      const result = await fetchAndParse(currentUrl);
      
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
