// src/hooks/useFetch.js
// Hook reutilizable para descargar y parsear cualquier URL de la federación.
// Gestiona los estados: cargando, datos, error y recarga.
//
// V5 — Estrategia "stale-while-revalidate" con caché en 3 niveles:
//   1. resultCache (memoria de sesión) → render instantáneo.
//   2. persistentCache (AsyncStorage)  → render instantáneo tras reiniciar la app.
//   3. Red (fedvasvol.com)             → refresco en segundo plano.
// La UI nunca se bloquea esperando la red si ya hay datos: se pintan al instante
// y, cuando llega la respuesta fresca, se actualizan en silencio.
//
// Estados devueltos:
//   loading    → true solo si NO hay nada que mostrar todavía (skeleton).
//   refreshing → true durante un revalidado forzado (pull-to-refresh) con datos ya visibles.

import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import { fetchAndParse } from '../utils/htmlParser';
import {
  getCachedBlocks,
  getCachedBlocksSync,
  setCachedBlocks,
} from '../utils/persistentCache';

// Keyed by URL → parsed block array. Solo dura lo que la sesión de la app.
export const resultCache = new Map();
const fetchedAtCache = new Map();
const DEFAULT_STALE_MS = 5 * 60 * 1000;
// "Última vez que esta URL falló contra la red". Con una URL sin caché que
// falla repetidamente (p. ej. 403 al saturar la cola de peticiones) evitamos el
// bucle render→fetch→error que machaca la red mientras la pantalla está montada.
const failureLog = new Map(); // url -> { count, lastAt }
const FAILURE_RETRY_MS = 60 * 1000;

export function markUrlFailed(url) {
  if (!url) return;
  const prev = failureLog.get(url);
  const now = Date.now();
  const count = prev && now - prev.lastAt < FAILURE_RETRY_MS ? prev.count + 1 : 1;
  failureLog.set(url, { count, lastAt: now });
}

export function clearUrlFailure(url) {
  if (url) failureLog.delete(url);
}

// Solo throttling a partir del 2º fallo consecutivo: el primer error se muestra
// con normalidad; los siguientes dentro de la ventana no repiten la petición.
function shouldThrottleFailedUrl(url) {
  const f = failureLog.get(url);
  if (!f) return false;
  if (Date.now() - f.lastAt > FAILURE_RETRY_MS) return false;
  return f.count >= 2;
}

// Siembra la caché de resultados desde fuera (precachear de App/LeagueScreen):
// marca fetchedAt para que el primer useFetch de esa URL NO relance otra
// petición idéntica justo después (duplicaba GET+POST al arrancar).
export function seedResultCache(url, blocks) {
  if (!url || !Array.isArray(blocks) || blocks.length === 0) return;
  if (resultCache.get(url)?.length >= blocks.length) return;
  resultCache.set(url, blocks);
  fetchedAtCache.set(url, Date.now());
  setCachedBlocks(url, blocks);
}

// Retención: cada useFetch marca su URL como "en uso" mientras esté montado.
const activeUrls = new Set();
function acquire(url) {
  if (!url) return;
  activeUrls.add(url);
}
function release(url) {
  if (!url) return;
  activeUrls.delete(url);
}

/**
 * @param {string} url - URL pública a parsear
 * @returns {{ blocks, loading, refreshing, error, refresh }}
 */
export function useFetch(url, options = {}) {
  const { lazy = false, refreshOnAppFocus = true, staleMs = DEFAULT_STALE_MS } = options;
  const latestRequestTokenRef = useRef(0);
  const abortControllerRef = useRef(null);
  const mountedRef = useRef(true);

  const hasMemory = Boolean(url && resultCache.has(url) && resultCache.get(url)?.length);
  const cachedSync = url ? getCachedBlocksSync(url) : null;
  const initialBlocks = hasMemory ? resultCache.get(url) : cachedSync || [];
  const [state, setState] = useState(() => ({
    url,
    blocks: url && !lazy ? initialBlocks : [],
    loading: Boolean(url && !lazy && !hasMemory && !cachedSync),
    refreshing: false,
    error: null,
  }));

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const safeSet = useCallback((next) => {
    if (mountedRef.current) setState(next);
  }, []);

  // Si la URL cambia en caliente, resolver estado inmediatamente desde caché.
  const resolvedState = state.url !== url
    ? (() => {
        const hasMem = Boolean(url && resultCache.has(url) && resultCache.get(url)?.length);
        const disk = url ? getCachedBlocksSync(url) : null;
        return {
          url,
          blocks: url && !lazy ? (hasMem ? resultCache.get(url) : disk || []) : [],
          loading: Boolean(url && !lazy && !hasMem && !disk),
          refreshing: false,
          error: null,
        };
      })()
    : state;

  if (state.url !== url) {
    setState(resolvedState);
  }

  const markRefreshing = useCallback((value) => {
    if (mountedRef.current) {
      setState((prev) => (prev.refreshing === value ? prev : { ...prev, refreshing: value }));
    }
  }, []);

  const commitFresh = useCallback((currentUrl, fresh, token, signal) => {
    if (signal.aborted) return false;
    if (latestRequestTokenRef.current !== token) return false;
    if (!Array.isArray(fresh) || fresh.length === 0) return false;
    resultCache.set(currentUrl, fresh);
    fetchedAtCache.set(currentUrl, Date.now());
    setCachedBlocks(currentUrl, fresh);
    safeSet({ url: currentUrl, blocks: fresh, loading: false, refreshing: false, error: null });
    return true;
  }, [safeSet]);

  const load = useCallback(async (forceRefresh = false) => {
    const currentUrl = url;
    if (!currentUrl || (lazy && !forceRefresh && !resultCache.has(currentUrl))) {
      return;
    }

    const nextToken = Date.now() + Math.random();
    latestRequestTokenRef.current = nextToken;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    const memory = resultCache.get(currentUrl);

    // ── A) Revalidado forzado con datos visibles: spinner de pull-to-refresh,
    //      la pantalla NUNCA se queda en blanco ni muestra skeleton.
    if (forceRefresh && Array.isArray(memory) && memory.length > 0) {
      markRefreshing(true);
      try {
        const fresh = await fetchAndParse(currentUrl, { signal, force: true });
        if (!commitFresh(currentUrl, fresh, nextToken, signal)) {
          if (latestRequestTokenRef.current === nextToken && !signal.aborted) {
            safeSet({ url: currentUrl, blocks: memory, loading: false, refreshing: false, error: null });
          }
        }
      } catch (_) {
        // Error de red: conservamos los datos actuales tal cual.
        if (latestRequestTokenRef.current === nextToken && !signal.aborted) {
          safeSet({ url: currentUrl, blocks: memory, loading: false, refreshing: false, error: null });
        }
      } finally {
        if (mountedRef.current) {
          markRefreshing(false);
        }
      }
      return;
    }

    // ── B) Dato en memoria sin forzar: pintarlo ya y revalidar en background
    //      si ha pasado al menos la mitad del TTL.
    if (Array.isArray(memory) && memory.length > 0 && !forceRefresh) {
      safeSet({ url: currentUrl, blocks: memory, loading: false, refreshing: false, error: null });
      const fetchedAt = fetchedAtCache.get(currentUrl) || 0;
      if (Date.now() - fetchedAt < staleMs / 2) {
        return; // dato muy fresco: ni red
      }
      try {
        const fresh = await fetchAndParse(currentUrl, { signal, force: true });
        commitFresh(currentUrl, fresh, nextToken, signal);
      } catch (_) {
        // silencioso: conservamos el dato en memoria
      }
      return;
    }

    // ── C) Disco (primera carga tras reiniciar): pintar ya y refrescar en background
    if (!forceRefresh) {
      const fromDisk = await getCachedBlocks(currentUrl);
      if (Array.isArray(fromDisk) && fromDisk.length > 0) {
        resultCache.set(currentUrl, fromDisk);
        if (latestRequestTokenRef.current === nextToken) {
          safeSet({ url: currentUrl, blocks: fromDisk, loading: false, refreshing: false, error: null });
        }
        try {
          const fresh = await fetchAndParse(currentUrl, { signal, force: true });
          commitFresh(currentUrl, fresh, nextToken, signal);
        } catch (_) {
          // silencioso
        }
        return;
      }
    }

    // ── D) Sin caché en ningún nivel (o refresh forzado sin datos): red real.
    // Anti-bucle: si esta URL acaba de fallar varias veces seguidas, no la
    // volvemos a pedir automáticamente (solo un retry explícito la reintenta).
    if (shouldThrottleFailedUrl(currentUrl)) {
      safeSet({
        url: currentUrl,
        blocks: [],
        loading: false,
        refreshing: false,
        error: 'No se pudo conectar. Espera unos segundos y vuelve a intentarlo.',
      });
      return;
    }
    safeSet((prev) => ({ ...prev, url: currentUrl, loading: true, error: null }));

    try {
      const result = await fetchAndParse(currentUrl, { signal });
      if (signal.aborted) return;

      if (latestRequestTokenRef.current === nextToken) {
        clearUrlFailure(currentUrl);
        if (Array.isArray(result) && result.length === 0) {
          // Respuesta vacía: conservar caché previa si existía (posible rate-limit)
          const previous = resultCache.get(currentUrl);
          if (Array.isArray(previous) && previous.length > 0) {
            safeSet({ url: currentUrl, blocks: previous, loading: false, refreshing: false, error: null });
            return;
          }
        }
        resultCache.set(currentUrl, result);
        fetchedAtCache.set(currentUrl, Date.now());
        setCachedBlocks(currentUrl, result);
        safeSet({ url: currentUrl, blocks: result, loading: false, refreshing: false, error: null });
      }
    } catch (caughtError) {
      if (latestRequestTokenRef.current === nextToken && !signal.aborted) {
        markUrlFailed(currentUrl);
        const errorMsg = caughtError?.message || 'Error desconocido';
        const cached = resultCache.get(currentUrl);
        safeSet({
          url: currentUrl,
          blocks: cached || [],
          loading: false,
          refreshing: false,
          error: cached ? null : errorMsg,
        });
      }
    }
  }, [url, lazy, staleMs, safeSet, commitFresh, markRefreshing]);

  const refresh = useCallback(() => {
    if (url) {
      // Conservamos el contenido actual en pantalla; solo forzamos revalidado.
      fetchedAtCache.delete(url);
      // Un retry explícito del usuario siempre vuelve a intentar la red.
      clearUrlFailure(url);
    }
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
    acquire(url);
    return () => release(url);
  }, [url]);

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
    refreshing: resolvedState.refreshing,
    error: resolvedState.error,
    refresh,
  };
}
