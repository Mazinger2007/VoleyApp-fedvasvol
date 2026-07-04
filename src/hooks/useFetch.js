// src/hooks/useFetch.js
// Hook reutilizable para descargar y parsear cualquier URL de la federación.
// Gestiona los estados: cargando, datos, error y recarga.
// V4: Soporta señal de aborto para cancelar navegación.

import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import { fetchAndParse } from '../utils/htmlParser';

// Keyed by URL → parsed block array. Solo dura lo que la sesión de la app.
export const resultCache = new Map();
const fetchedAtCache = new Map();
const DEFAULT_STALE_MS = 5 * 60 * 1000;

/**
 * @param {string} url - URL pública a parsear
 * @returns {{ blocks, loading, error, refresh }}
 */
export function useFetch(url, options = {}) {
  const { lazy = false, refreshOnAppFocus = true, staleMs = DEFAULT_STALE_MS } = options;
  const [state, setState] = useState(() => ({
    url,
    blocks: (url && !lazy && resultCache.has(url)) ? resultCache.get(url) : [],
    loading: url && !lazy && !resultCache.has(url),
    error: null,
  }));

  const latestRequestTokenRef = useRef(0);
  const abortControllerRef = useRef(null);

  const resolvedState = state.url !== url
    ? {
        url,
        blocks: (url && resultCache.has(url)) ? resultCache.get(url) : [],
        loading: Boolean(url && !lazy && !resultCache.has(url)),
        error: null,
      }
    : state;

  if (state.url !== url) {
    setState(resolvedState);
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
        const previous = resultCache.get(currentUrl);
        if (Array.isArray(previous) && previous.length > 0 && Array.isArray(result) && result.length === 0) {
          setState({ url: currentUrl, blocks: previous, loading: false, error: null });
          return;
        }
        resultCache.set(currentUrl, result);
        fetchedAtCache.set(currentUrl, Date.now());
        setState({ url: currentUrl, blocks: result, loading: false, error: null });
      }
    } catch (caughtError) {
      if (latestRequestTokenRef.current === nextToken && !signal.aborted) {
        const errorMsg = caughtError?.message || 'Error desconocido';
        const cached = resultCache.get(currentUrl);
        setState({
          url: currentUrl,
          blocks: cached || [],
          loading: false,
          error: cached ? null : errorMsg,
        });
      }
    }
  }, [url, lazy]);

  const refresh = useCallback(() => {
    if (url) resultCache.delete(url);
    if (url) fetchedAtCache.delete(url);
    load(true);
  }, [url, load]);

  useEffect(() => {
    let active = true;
    if (active) load();
    return () => {
      active = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [load]);

  useEffect(() => {
    if (!refreshOnAppFocus || !url) return undefined;

    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') return;
      const fetchedAt = fetchedAtCache.get(url) || 0;
      if (!resultCache.has(url) || Date.now() - fetchedAt > staleMs) {
        load(true);
      }
    });

    return () => sub.remove();
  }, [load, refreshOnAppFocus, staleMs, url]);

  return {
    blocks: resolvedState.blocks,
    loading: resolvedState.loading,
    error: resolvedState.error,
    refresh,
  };
}
