// src/hooks/useLivePolling.js
// Polls a URL periodically and updates the block result only when scores change.
// It keeps polling even before a match is live so "EN CURSO" transitions are
// detected automatically without manual refresh.

import { useEffect, useRef, useCallback } from 'react';
import { AppState } from 'react-native';
import { fetchAndParse } from '../utils/htmlParser';

const POLL_INTERVAL_MS = 10_000; // 10 seconds between polls

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
  const timerRef = useRef(null);
  const lastSnapshotRef = useRef('');
  const appStateRef = useRef(AppState.currentState);
  const isFetchingRef = useRef(false);

  const poll = useCallback(async () => {
    if (!url || isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      const newBlocks = await fetchAndParse(url);
      const newSnapshot = scoreSnapshot(newBlocks);
      if (newSnapshot !== lastSnapshotRef.current) {
        lastSnapshotRef.current = newSnapshot;
        onUpdate(newBlocks);
        onResultChange?.();
      }
    } catch (_) {
      // Ignore polling errors silently
    } finally {
      isFetchingRef.current = false;
    }
  }, [url, onUpdate]);

  useEffect(() => {
    if (!url || !currentBlocks?.length) return;

    lastSnapshotRef.current = scoreSnapshot(currentBlocks);

    timerRef.current = setInterval(poll, POLL_INTERVAL_MS);

    // Also handle app coming back to foreground
    const sub = AppState.addEventListener('change', (state) => {
      if (appStateRef.current.match(/inactive|background/) && state === 'active') {
        poll();
      }
      appStateRef.current = state;
    });

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      sub.remove();
    };
  }, [url, currentBlocks, poll]);
}
