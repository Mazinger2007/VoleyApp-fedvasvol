// src/hooks/useLivePolling.js
// Polls a URL periodically and updates the block result only when scores change.
// It keeps polling even before a match is live so "EN CURSO" transitions are
// detected automatically without manual refresh.

import { useEffect, useRef, useCallback } from 'react';
import { AppState } from 'react-native';
import { fetchAndParse } from '../utils/htmlParser';

// Sondeo adaptativo: rápido solo cuando hay partidos en vivo, lento el resto
// del tiempo. Reduce muchísimo la presión de rate-limit del servidor sin
// perder la detección temprana de "EN CURSO".
const FAST_POLL_MS = 10_000;  // con partidos en vivo o próximos a empezar
const IDLE_POLL_MS = 60_000;  // sin señal de actividad

/** Detecta indicios de actividad en vivo (partido EN CURSO o que empieza ya). */
function hasLiveIndicators(blocks) {
  const now = Date.now();
  return (blocks || []).some((b) => {
    if (b?.type !== 'table') return false;
    const matches = b.matches || [];
    return matches.some((m) => {
      if (m?.state === 'live' || m?.status === 'live') return true;
      if (m?.state === 'upcoming' && m?.rawDate) {
        const t = new Date(String(m.rawDate).replace(/GMT([+-]\d{2}:\d{2})?/, 'UTC$1')).getTime();
        if (Number.isFinite(t)) {
          const diffH = (t - now) / 3600000;
          return diffH > -3 && diffH < 3; // ventana ±3h del horario previsto
        }
      }
      return false;
    });
  });
}

/**
 * Serializes live-relevant data so we can detect changes without deep equal.
 */
function scoreSnapshot(blocks) {
  return blocks
    .filter((b) => b?.type === 'table')
    .map((b) => {
      const matches = b.matches || b.rows || [];
      return matches
        .map((m) => (Array.isArray(m)
          ? m.join('|')
          : `${m.homeScore ?? ''}-${m.awayScore ?? ''}:${m.status ?? ''}`
        ))
        .join(';');
    })
    .join('\n');
}

/**
 * @param {string|null} url          - Calendar URL to poll. Polling is disabled if null.
 * @param {Array}       currentBlocks - Current block array from useFetch.
 * @param {Function}    onUpdate      - Called with the new blocks array when scores change.
 * @param {Function}    onResultChange - Optional callback called when any change is detected.
 */
export function useLivePolling(url, currentBlocks, onUpdate, onResultChange) {
  const intervalRef = useRef(FAST_POLL_MS);
  const lastSnapshotRef = useRef('');
  const appStateRef = useRef(AppState.currentState);
  const isFetchingRef = useRef(false);

  const poll = useCallback(async () => {
    if (!url || isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      // force=true: el sondeo debe ver resultados NUEVOS, nunca caché.
      const newBlocks = await fetchAndParse(url, { force: true });
      const newSnapshot = scoreSnapshot(newBlocks);
      if (newSnapshot !== lastSnapshotRef.current) {
        lastSnapshotRef.current = newSnapshot;
        onUpdate(newBlocks);
        onResultChange?.();
      }
      // Adaptativo: mientras haya partidos con cambios, sondeo rápido;
      // si todo está tranquilo, bajamos a 60s para no provocar rate-limits.
      intervalRef.current = hasLiveIndicators(newBlocks) ? FAST_POLL_MS : IDLE_POLL_MS;
    } catch (_) {
      // Ignore polling errors silently
    } finally {
      isFetchingRef.current = false;
    }
  }, [url, onUpdate]);

  useEffect(() => {
    if (!url || !currentBlocks?.length) return;

    lastSnapshotRef.current = scoreSnapshot(currentBlocks);
    intervalRef.current = hasLiveIndicators(currentBlocks) ? FAST_POLL_MS : IDLE_POLL_MS;

    let timeoutId = null;
    const scheduleNext = () => {
      timeoutId = setTimeout(async () => {
        await poll();
        scheduleNext();
      }, intervalRef.current);
    };
    scheduleNext();

    // Also handle app coming back to foreground
    const sub = AppState.addEventListener('change', (state) => {
      if (appStateRef.current.match(/inactive|background/) && state === 'active') {
        poll();
      }
      appStateRef.current = state;
    });

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      sub.remove();
    };
  }, [url, currentBlocks, poll]);
}
