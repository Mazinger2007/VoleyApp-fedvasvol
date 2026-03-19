// src/hooks/useLivePolling.js
// Polls a URL periodically and updates the block result only when scores change.
// Polling only starts when at least one "EN CURSO" / "live" match is detected.

import { useEffect, useRef, useCallback } from 'react';
import { AppState } from 'react-native';
import { fetchAndParse } from '../utils/htmlParser';

const POLL_INTERVAL_MS = 60_000; // 60 seconds between polls

/**
 * Returns true if any calendar block contains a live match.
 * @param {Array} blocks - Parsed blocks from the calendar URL.
 */
function hasLiveMatch(blocks) {
  for (const block of blocks) {
    if (block?.type !== 'table') continue;
    const rows = block.rows || [];
    for (const row of rows) {
      for (const cell of row) {
        const val = String(cell || '').toUpperCase();
        if (val.includes('EN CURSO') || val.includes('LIVE') || val.includes('DIRECTO')) {
          return true;
        }
      }
    }
    // Also check rowData if present
    const matches = block.matches || [];
    for (const match of matches) {
      const s = String(match?.status || '').toUpperCase();
      if (s.includes('EN CURSO') || s.includes('LIVE') || s.includes('DIRECTO')) {
        return true;
      }
    }
  }
  return false;
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
        // If no more live matches, stop polling
        if (!hasLiveMatch(newBlocks)) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      }
    } catch (_) {
      // Ignore polling errors silently
    } finally {
      isFetchingRef.current = false;
    }
  }, [url, onUpdate]);

  useEffect(() => {
    if (!url || !currentBlocks?.length) return;

    // Only start polling when there's at least one live match
    if (!hasLiveMatch(currentBlocks)) return;

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
