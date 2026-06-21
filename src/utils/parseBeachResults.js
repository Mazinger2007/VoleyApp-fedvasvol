const Y_TOLERANCE = 4;
const X_CELL_GAP = 15;

function groupIntoRows(items) {
  const sorted = [...items].sort((a, b) => b.y - a.y);
  const rows = [];
  let currentRow = null;
  for (const item of sorted) {
    if (!currentRow || Math.abs(item.y - currentRow.y) > Y_TOLERANCE) {
      currentRow = { y: item.y, items: [] };
      rows.push(currentRow);
    }
    currentRow.items.push({ x: item.x, text: item.text, w: item.w || 0 });
  }
  for (const row of rows) {
    row.items.sort((a, b) => a.x - b.x);
    const merged = [];
    let cell = null;
    for (const it of row.items) {
      const shouldMerge = cell && (
        (it.x - cell.x <= X_CELL_GAP) ||
        (cell.text.endsWith('/') && /^[A-ZÑÁÉÍÓÚ]/.test(it.text)) ||
        (cell.text.endsWith('/ ') && /^[A-ZÑÁÉÍÓÚ]/.test(it.text))
      );
      if (!cell || !shouldMerge) {
        cell = { x: it.x, text: it.text };
        merged.push(cell);
      } else {
        cell.text += ' ' + it.text;
      }
    }
    row.cells = merged;
    row.cellTexts = merged.map(c => c.text.trim()).filter(Boolean);
  }
  return rows;
}


function mergeItems(arr) {
  const sorted = [...arr].sort((a, b) => a.x - b.x);
  const m = [];
  let c = null;
  for (const it of sorted) {
    const shouldMerge = c && (
      (it.x - c.x <= X_CELL_GAP) ||
      (c.text.endsWith('/') && /^[A-ZÑÁÉÍÓÚ]/.test(it.text))
    );
    if (!c || !shouldMerge) {
      c = { x: it.x, text: it.text };
      m.push(c);
    } else {
      c.text += ' ' + it.text;
    }
  }
  return m.map(x => x.text.trim()).filter(Boolean);
}

function parseRankingNumber(text) {
  const m = text.trim().match(/^(\d{1,2})[\.\)]?\s*$/);
  if (!m) return 0;
  const n = parseInt(m[1], 10);
  return (n >= 1 && n <= 32) ? n : 0;
}

function isNameText(text) {
  const t = text.trim();
  return t.length > 2 && !/^\d+$/.test(t) && !t.includes(':') && !/^[\d\s\/-]+$/.test(t);
}

function splitRankingFromItem(item) {
  const m = item.text.trim().match(/^(\d{1,2})\s+(.+)$/);
  if (!m) return null;
  const pos = parseInt(m[1], 10);
  if (pos < 1 || pos > 32) return null;
  const name = m[2].trim();
  if (!isNameText(name)) return null;
  return { pos, pareja: name };
}

function findRankingInItems(items) {
  if (items.length < 2) return null;
  // Strategy A: Last item for merged "N NAME" (e.g., "24 DEL RIO/LEKUE")
  const last = items[items.length - 1];
  if (last && last.text.trim()) {
    const merged = splitRankingFromItem(last);
    if (merged) return { idx: items.length - 1, pos: merged.pos, pareja: merged.pareja };
  }
  // Strategy A (part 2): Second-to-last + last as adjacent number + name
  const n = items.length - 2;
  const first = items[n];
  if (first && first.text.trim()) {
    const pos = parseRankingNumber(first.text);
    if (pos) {
      const second = items[n + 1];
      if (second && isNameText(second.text)) {
        return { idx: n, pos, pareja: second.text.trim() };
      }
    }
  }
  // Strategy B: Scan last 5 items for adjacent pairs
  const minIdx = items.length >= 5 ? items.length - 5 : 0;
  for (let i = minIdx; i < items.length - 1; i++) {
    const a = items[i];
    if (!a || !a.text.trim()) continue;
    const pos = parseRankingNumber(a.text);
    if (!pos) continue;
    const b = items[i + 1];
    if (!b || !b.text.trim()) continue;
    const gap = b.x - a.x - (a.w || 0);
    if (gap > 15) continue;
    if (isNameText(b.text)) {
      return { idx: i, pos, pareja: b.text.trim() };
    }
  }
  // Strategy C: Scan ALL items for adjacent pairs (most lenient)
  for (let i = 0; i < items.length - 1; i++) {
    const a = items[i];
    if (!a || !a.text.trim()) continue;
    const pos = parseRankingNumber(a.text);
    if (!pos) continue;
    const b = items[i + 1];
    if (!b || !b.text.trim()) continue;
    const gap = b.x - a.x - (a.w || 0);
    if (gap > 15) continue;
    if (isNameText(b.text)) {
      return { idx: i, pos, pareja: b.text.trim() };
    }
  }
  return null;
}

function splitRankingRows(rows) {
  const matchRows = [];
  const rankingRows = [];
  for (const row of rows) {
    const items = row.items;
    let splitIdx = -1;

    // Scan items for ranking pattern (number 1-32 followed by text) at any position
    const ranking = findRankingInItems(items);
    if (ranking) {
      splitIdx = ranking.idx;
    }

    // Gap fallback: only if scan didn't find ranking
    if (splitIdx < 0) {
      for (let i = 1; i < items.length; i++) {
        const gap = items[i].x - items[i - 1].x - items[i - 1].w;
        if (gap > 25) {
          const after = items.slice(i);
          if (after.length >= 2) {
            if (parseRankingNumber(after[0].text) && isNameText(after[1].text)) {
              splitIdx = i;
              break;
            }
          }
        }
      }
    }

    // ALWAYS add to matchRows — every row is a match candidate
    const matchItems = splitIdx > 0 ? items.slice(0, splitIdx) : items;
    const matchTexts = mergeItems(matchItems);
    matchRows.push({ ...row, items: matchItems, cells: matchTexts, cellTexts: matchTexts });

    // If ranking detected at end of match row, add to rankingRows (NOT re-merged)
    if (splitIdx > 0) {
      const rankingItems = items.slice(splitIdx);
      const rankingTexts = rankingItems
        .sort((a, b) => a.x - b.x)
        .map(it => it.text.trim())
        .filter(Boolean);
      rankingRows.push({ ...row, cells: rankingTexts, cellTexts: rankingTexts });
    }
  }

  // Second pass: detect ranking-only rows (exactly 2 items: position + name)
  for (const row of matchRows) {
    const items = row.items;
    if (items.length !== 2) continue;
    const firstNonEmpty = items.find(i => i.text.trim().length > 0);
    if (!firstNonEmpty) continue;
    const pos = parseRankingNumber(firstNonEmpty.text);
    if (!pos) continue;
    const hasTime = items.some(i => /\b\d{1,2}:\d{2}\b/.test(i.text.trim()));
    if (hasTime) continue;
    const rankingTexts = [...items]
      .sort((a, b) => a.x - b.x)
      .map(it => it.text.trim())
      .filter(Boolean);
    rankingRows.push({ ...row, cells: rankingTexts, cellTexts: rankingTexts });
  }
  return { matchRows, rankingRows };
}


function extractTournamentInfo(rows) {
  let categoria = '', fecha = '', lugar = '';
  const CATEGORY_RE = /\b(Senior|Junior|Cadete|Kadete|Sub-\d+|U-\d+|U\d+|Absoluto|Absolutua|Infantil|Alevín|Benjamin|Alevin)\b/i;

  for (const row of rows) {
    const raw = row.cellTexts.join(' ') + ' ' + row.cells.map(c => c.text).join(' ');

    if (!fecha) {
      const m = raw.match(/\d{4}[-/]\d{1,2}[-/]\d{1,2}/);
      if (m) fecha = m[0];
    }

    if (!categoria) {
      const m = raw.match(CATEGORY_RE);
      if (m) categoria = m[1];
    }

    if (!lugar && fecha) {
      const m = raw.match(/\d{4}[-/]\d{1,2}[-/]\d{1,2}\s+([A-ZÁÉÍÓÚÑa-záéíóúñ]+)/);
      if (m) lugar = m[1].trim();
    }
  }
  return { categoria, fecha, lugar };
}


function extractByeMatch(texts) {
  if (!texts.some(t => /^BYE$/i.test(t.trim()))) return null;
  let partido = 0;
  for (const t of texts) {
    const m = t.match(/^(\d{1,2})$/);
    if (m) { partido = parseInt(m[1], 10); break; }
  }
  const fase = texts.filter(t => /^\d{1,2}\/\d{1,2}$/.test(t)).pop() || '';
  const referencia = texts.filter(t => /^[WL]\d+/.test(t) || /^\d+-\d+$/.test(t)).pop() || '';
  const teamCandidates = texts.filter(t => {
    if (/^\d{1,2}$/.test(t)) return false;
    if (/^\d{1,2}\/\d{1,2}$/.test(t)) return false;
    if (/^[WL]\d+/.test(t)) return false;
    if (/^\d+-\d+$/.test(t)) return false;
    if (/^BYE$/i.test(t.trim())) return false;
    if (/^\d{1,2}\s+[A-Z]/.test(t)) return false;
    if (/\d{1,2}:\d{2}/.test(t)) return false;
    return t.trim().length > 0;
  });
  let parejaA = 'BYE', parejaB = 'BYE';
  if (teamCandidates.length === 1) {
    parejaA = teamCandidates[0]; parejaB = 'BYE';
  } else if (teamCandidates.length >= 2) {
    parejaA = teamCandidates[0]; parejaB = teamCandidates[1];
  }
  return {
    partido, hora: null, pista: '', fase, referencia,
    parejaA: parejaA.replace(/\s*\/\s*/g, '/').trim(),
    parejaB: parejaB.replace(/\s*\/\s*/g, '/').trim(),
    setsA: 0, setsB: 0, set1: null, set2: null, set3: null,
  };
}

function extractNoTimeMatch(texts) {
  if (texts.length < 4) return null;
  const partido = parseInt(texts[0], 10);
  if (isNaN(partido) || partido < 1) return null;
  let h = 1;
  let pista = '';
  if (h < texts.length && /^\d{1,2}$/.test(texts[h]) && !texts[h].includes('/') && !texts[h].includes('-')) {
    pista = texts[h]; h++;
  }
  const fase = (h < texts.length && texts[h].includes('/')) ? texts[h++] : '';
  const referencia = (h < texts.length && texts[h].includes('-')) ? texts[h++] : '';

  let scoreStart = -1;
  let setsA = 0, setsB = 0;
  for (let i = h; i < texts.length; i++) {
    const dashMatch = texts[i].match(/^(\d)-(\d)$/);
    if (dashMatch) {
      const a = parseInt(dashMatch[1], 10);
      const b = parseInt(dashMatch[2], 10);
      if (a >= 0 && a <= 3 && b >= 0 && b <= 3) {
        scoreStart = i; setsA = a; setsB = b; break;
      }
    }
    if (/^\d+$/.test(texts[i])) {
      const v = parseInt(texts[i], 10);
      if (v >= 0 && v <= 3 && i + 1 < texts.length && /^\d+$/.test(texts[i + 1])) {
        const nv = parseInt(texts[i + 1], 10);
        if (nv >= 0 && nv <= 3) { scoreStart = i; setsA = v; setsB = nv; break; }
      }
    }
  }
  if (scoreStart < 0) return null;

  const pairTexts = texts.slice(h, scoreStart);
  let parejaA = '', parejaB = '';

  if (pairTexts.length === 2) {
    parejaA = pairTexts[0]; parejaB = pairTexts[1];
  } else if (pairTexts.length === 1) {
    const t = pairTexts[0];
    const parts = t.split(/\s{2,}/);
    if (parts.length >= 2) { parejaA = parts[0]; parejaB = parts.slice(1).join(' '); }
    else { parejaA = t; parejaB = ''; }
  } else if (pairTexts.length > 2) {
    const merged = []; let cur = '';
    for (const pt of pairTexts) {
      if (cur && (cur.endsWith('/') || pt.startsWith('/') || /^[A-ZÑÁÉÍÓÚ][a-záéíóú]/.test(pt))) {
        cur += ' ' + pt;
      } else {
        if (cur) merged.push(cur);
        cur = pt;
      }
    }
    if (cur) merged.push(cur);
    parejaA = merged[0] || ''; parejaB = merged.slice(1).join(' ') || '';
  }

  // Collect set scores: expand dash-merged numbers (e.g., "21-19" -> 21, 19)
  const setNumbers = [];
  for (const t of texts.slice(scoreStart + (/\d-\d/.test(texts[scoreStart]) ? 1 : 2))) {
    const dash = t.match(/^(\d+)-(\d+)$/);
    if (dash) {
      setNumbers.push(parseInt(dash[1], 10), parseInt(dash[2], 10));
    } else if (/^\d+$/.test(t)) {
      setNumbers.push(parseInt(t, 10));
    }
  }
  const setData = [];
  for (let si = 0; si + 1 < setNumbers.length && si < 6; si += 2) {
    setData.push({ A: setNumbers[si], B: setNumbers[si + 1] });
  }

  return {
    partido, hora: null, pista, fase, referencia,
    parejaA: parejaA.replace(/\s*\/\s*/g, '/').trim(),
    parejaB: parejaB.replace(/\s*\/\s*/g, '/').trim(),
    setsA, setsB,
    set1: setData[0] || null, set2: setData[1] || null, set3: setData[2] || null,
  };
}

function extractMatchFromRow(row) {
  // Use raw items (unmerged) for reliable column detection
  const items = (row.items || []).filter(i => i.text.trim().length > 0);
  items.sort((a, b) => a.x - b.x);
  const texts = items.map(i => i.text.trim());

  // Pattern: [matchNum,] hora, pista, fase, referencia, parejaA, parejaB, setsA, setsB, set1A, set1B, set2A, set2B, [set3A, set3B]
  // Find hora: standalone "19:00" or merged "80 19:00"
  const horaIdx = texts.findIndex(t => /\b\d{1,2}:\d{2}\b/.test(t));
  if (horaIdx >= 0) {
    const horaMatch = texts[horaIdx].match(/(\d{1,2}:\d{2})/);
    const hora = horaMatch[1];

    let partido = 0;
    const numBefore = horaIdx > 0 ? texts[horaIdx - 1].match(/^(\d+)$/) : null;
    if (numBefore) {
      partido = parseInt(numBefore[1], 10);
    } else {
      const mergedPrefix = texts[horaIdx].match(/^(\d+)\s+\d{1,2}:\d{2}/);
      if (mergedPrefix) partido = parseInt(mergedPrefix[1], 10);
    }

    let h = horaIdx + 1;
    let pista = '';
    if (h < texts.length) {
      const m = texts[h].match(/^(\d+)(?:\s|$)/);
      if (m) pista = m[1];
      if (/^\d+$/.test(texts[h])) h++;
    }
    const fase = h < texts.length && texts[h].includes('/') ? texts[h++] : '';
    const referencia = h < texts.length && texts[h].includes('-') ? texts[h++] : '';

    let scoreStart = -1;
    let setsA = 0, setsB = 0;
    for (let i = h; i < texts.length; i++) {
      const dashMatch = texts[i].match(/^(\d)-(\d)$/);
      if (dashMatch) {
        const a = parseInt(dashMatch[1], 10);
        const b = parseInt(dashMatch[2], 10);
        if (a >= 0 && a <= 3 && b >= 0 && b <= 3) {
          scoreStart = i; setsA = a; setsB = b; break;
        }
      }
      if (/^\d+$/.test(texts[i])) {
        const v = parseInt(texts[i], 10);
        if (v >= 0 && v <= 3 && i + 1 < texts.length && /^\d+$/.test(texts[i + 1])) {
          const nv = parseInt(texts[i + 1], 10);
          if (nv >= 0 && nv <= 3) { scoreStart = i; setsA = v; setsB = nv; break; }
        }
      }
    }

    if (scoreStart < 0) {
      const byeIdx = texts.findIndex(t => /^BYE$/i.test(t));
      if (byeIdx >= 0) {
        const teamAText = texts.slice(h, byeIdx).join(' ').trim();
        const afterBye = texts.slice(byeIdx + 1).filter(t => !/^\d{1,2}\s+[A-Z]/.test(t));
        const setsNum = afterBye.find(t => /^\d+$/.test(t));
        return {
          partido, hora, pista, fase, referencia,
          parejaA: teamAText ? teamAText.replace(/\s*\/\s*/g, '/') : 'BYE',
          parejaB: 'BYE',
          setsA: setsNum ? parseInt(setsNum, 10) : 0, setsB: 0,
          set1: null, set2: null, set3: null,
        };
      }
      return null;
    }

    const pairTexts = texts.slice(h, scoreStart);
    let parejaA = '', parejaB = '';

    if (pairTexts.length === 2) {
      parejaA = pairTexts[0]; parejaB = pairTexts[1];
    } else if (pairTexts.length === 1) {
      const t = pairTexts[0];
      const parts = t.split(/\s{2,}/);
      if (parts.length >= 2) { parejaA = parts[0]; parejaB = parts.slice(1).join(' '); }
      else { parejaA = t; parejaB = ''; }
    } else if (pairTexts.length > 2) {
      const merged = []; let cur = '';
      for (const pt of pairTexts) {
        if (cur && (cur.endsWith('/') || pt.startsWith('/') || /^[A-ZÑÁÉÍÓÚ][a-záéíóú]/.test(pt))) {
          cur += ' ' + pt;
        } else {
          if (cur) merged.push(cur);
          cur = pt;
        }
      }
      if (cur) merged.push(cur);
      parejaA = merged[0] || ''; parejaB = merged.slice(1).join(' ') || '';
    }

    // Collect set scores: expand dash-merged numbers
    const setNumbers = [];
    const scoreEndOffset = /\d-\d/.test(texts[scoreStart]) ? 1 : 2;
    for (const t of texts.slice(scoreStart + scoreEndOffset)) {
      const dash = t.match(/^(\d+)-(\d+)$/);
      if (dash) {
        setNumbers.push(parseInt(dash[1], 10), parseInt(dash[2], 10));
      } else if (/^\d+$/.test(t)) {
        setNumbers.push(parseInt(t, 10));
      }
    }
    const setData = [];
    for (let si = 0; si + 1 < setNumbers.length && si < 6; si += 2) {
      setData.push({ A: setNumbers[si], B: setNumbers[si + 1] });
    }

    return {
      partido, hora, pista, fase, referencia,
      parejaA: parejaA.replace(/\s*\/\s*/g, '/').trim(),
      parejaB: parejaB.replace(/\s*\/\s*/g, '/').trim(),
      setsA, setsB,
      set1: setData[0] || null, set2: setData[1] || null, set3: setData[2] || null,
    };
  }

  const byeMatch = extractByeMatch(texts);
  if (byeMatch) return byeMatch;
  return extractNoTimeMatch(texts);
}


function extractRanking(rows) {
  const seen = new Set();
  const ranking = [];
  for (const row of rows) {
    const texts = row.cellTexts;
    if (texts.length === 0) continue;
    // Try merged "N NAME" pattern in first cell first
    const merged = texts[0].trim().match(/^(\d{1,2})\s+(.+)$/);
    if (merged) {
      const pos = parseInt(merged[1], 10);
      if (pos >= 1 && pos <= 32 && !seen.has(pos)) {
        const name = (merged[2] + (texts.length > 1 ? ' ' + texts.slice(1).join(' ') : '')).replace(/\s*\/\s*/g, '/').trim();
        if (name.length > 0) { seen.add(pos); ranking.push({ posicion: pos, pareja: name }); }
        continue;
      }
    }
    const pos = parseRankingNumber(texts[0]);
    if (!pos || seen.has(pos)) continue;
    seen.add(pos);
    const pareja = texts.slice(1).join(' ').replace(/\s*\/\s*/g, '/');
    if (pareja.length > 0) ranking.push({ posicion: pos, pareja });
  }
  ranking.sort((a, b) => a.posicion - b.posicion);
  return ranking;
}


function bruteForceRanking(pages) {
  const allItems = [];
  for (const page of pages) {
    for (const item of page.items || []) {
      allItems.push({ x: item.x, y: item.y, text: item.text, w: item.w || 0 });
    }
  }
  allItems.sort((a, b) => b.y - a.y || a.x - b.x);

  const rows = [];
  let cur = null;
  for (const it of allItems) {
    if (!cur || Math.abs(it.y - cur.y) > Y_TOLERANCE) {
      cur = { y: it.y, items: [] };
      rows.push(cur);
    }
    cur.items.push(it);
  }
  for (const r of rows) r.items.sort((a, b) => a.x - b.x);

  const seen = new Set();
  const ranking = [];

  for (const row of rows) {
    if (row.items.length < 2) continue;
    const items = row.items;
    let found = null;

    // Strategy A: merged "N NAME" in last item
    const last = items[items.length - 1];
    if (last && last.text.trim()) {
      const merged = splitRankingFromItem(last);
      if (merged && !seen.has(merged.pos)) {
        found = { posicion: merged.pos, pareja: merged.pareja };
      }
    }

    // Strategy A (part 2): adjacent pair at end
    if (!found) {
      const n = items.length - 2;
      const first = items[n];
      if (first && first.text.trim()) {
        const pos = parseRankingNumber(first.text);
        if (pos && !seen.has(pos)) {
          const second = items[n + 1];
          if (second && isNameText(second.text)) {
            found = { posicion: pos, pareja: second.text.trim() };
          }
        }
      }
    }

    // Strategy B: scan last 5 items for adjacent pairs
    if (!found) {
      const minIdx = items.length >= 5 ? items.length - 5 : 0;
      for (let i = minIdx; i < items.length - 1; i++) {
        const a = items[i];
        if (!a || !a.text.trim()) continue;
        const pos = parseRankingNumber(a.text);
        if (!pos || seen.has(pos)) continue;
        const b = items[i + 1];
        if (!b || !b.text.trim()) continue;
        const gap = b.x - a.x - (a.w || 0);
        if (gap > 15) continue;
        if (isNameText(b.text)) {
          found = { posicion: pos, pareja: b.text.trim() };
          break;
        }
      }
    }

    // Strategy C: scan ALL items for adjacent pairs
    if (!found) {
      for (let i = 0; i < items.length - 1; i++) {
        const a = items[i];
        if (!a || !a.text.trim()) continue;
        const pos = parseRankingNumber(a.text);
        if (!pos || seen.has(pos)) continue;
        const b = items[i + 1];
        if (!b || !b.text.trim()) continue;
        const gap = b.x - a.x - (a.w || 0);
        if (gap > 15) continue;
        if (isNameText(b.text)) {
          found = { posicion: pos, pareja: b.text.trim() };
          break;
        }
      }
    }

    if (found) {
      seen.add(found.posicion);
      ranking.push(found);
    }
  }
  ranking.sort((a, b) => a.posicion - b.posicion);
  return ranking;
}


// === COLUMNAR PARSER (for multi-column table layouts) ===
// Some PDFs arrange matches as vertical columns rather than horizontal rows.
// Each y-layer contains one data field for ALL matches (e.g., all match numbers,
// all times, all courts, etc.) at different x-positions.

function columnarParse(pages) {
  const allItems = [];
  for (const page of pages) {
    for (const item of page.items || []) {
      allItems.push({ x: item.x, y: item.y, text: item.text, w: item.w || 0 });
    }
  }
  if (allItems.length === 0) return null;

  // 1) Cluster items by x-position (column boundaries).
  // Sort by x, group consecutive items where gap ≤ 6px.
  const xSorted = [...allItems].sort((a, b) => a.x - b.x);
  const xClusters = [];
  let curCluster = null;
  for (const it of xSorted) {
    if (!curCluster || it.x - curCluster.x > 6) {
      curCluster = { x: it.x, items: [] };
      xClusters.push(curCluster);
    }
    curCluster.items.push(it);
  }

  // 2) For each x-cluster (column), sort items by y descending,
  //    group into y-layers, merge text within each y-layer.
  const columns = [];
  for (const cluster of xClusters) {
    cluster.items.sort((a, b) => {
      if (Math.abs(a.y - b.y) > Y_TOLERANCE) return b.y - a.y;
      return a.x - b.x;
    });

    const yLayers = [];
    let curLayer = null;
    for (const it of cluster.items) {
      if (!curLayer || Math.abs(it.y - curLayer.y) > Y_TOLERANCE) {
        curLayer = { y: it.y, texts: [] };
        yLayers.push(curLayer);
      }
      // Merge adjacent items close in x or with slash continuations
      if (curLayer.texts.length > 0) {
        const last = curLayer.texts[curLayer.texts.length - 1];
        if (last.endsWith('/') || it.text.startsWith('/') || it.x - (curLayer.lastX || it.x) <= X_CELL_GAP) {
          curLayer.texts[curLayer.texts.length - 1] += ' ' + it.text;
          curLayer.lastX = it.x + (it.w || 0);
          continue;
        }
      }
      curLayer.texts.push(it.text);
      curLayer.lastX = it.x + (it.w || 0);
    }

    const texts = yLayers.map(l => l.texts.join(' ')).filter(t => t.length > 0);
    // Accept columns with a hora-like token or with at least 6 non-empty texts
    const hasHora = texts.some(t => /\d{1,2}:\d{2}/.test(t));
    if (hasHora && texts.length >= 6) {
      columns.push({ x: cluster.x, texts });
    }
  }

  if (columns.length === 0) return null;

  // 3) Parse each column's texts as a match row
  const matches = [];
  for (const col of columns) {
    const fakeRow = { items: col.texts.map((t, i) => ({ x: i, text: t, w: 0 })) };
    const match = extractMatchFromRow(fakeRow);
    if (match) {
      if (!match.partido) match.partido = matches.length + 1;
      matches.push(match);
    }
  }

  return matches;
}

function detectColumnarLayout(layers, maxRows = 10) {
  let wideCount = 0;
  const counts = [];
  for (let i = 0; i < Math.min(layers.length, maxRows); i++) {
    const n = (layers[i].items || []).length;
    counts.push(n);
    if (n >= 10) wideCount++;
  }
  return wideCount >= 3;
}


// === OCR PARSER (for scanned/image PDFs) ===

function fixOcrCode(code) {
  if (code.includes('/')) return code;
  return code.replace(/(\d)7(?=\d)/g, '$1/');
}

function fixOcrName(name) {
  return name.replace(/[!|7$¢]/g, '/');
}

function splitOcrTeams(nameTokens) {
  const groups = [];
  let cur = [];
  for (const t of nameTokens) {
    if (t === '/') {
      if (cur.length > 0) groups.push(cur.join(' ').trim());
      cur = [];
      continue;
    }
    cur.push(t);
    if (t.includes('/')) {
      groups.push(cur.join(' ').trim());
      cur = [];
    }
  }
  if (cur.length > 0) {
    if (groups.length > 0) groups[groups.length - 1] += ' ' + cur.join(' ').trim();
    else groups.push(cur.join(' ').trim());
  }
  return groups;
}

function expandScoreNumbers(token) {
  const s = token;
  if (s.length >= 4 && s.length % 2 === 0) {
    const res = [];
    for (let i = 0; i < s.length; i += 2) res.push(parseInt(s[i] + s[i + 1]));
    return res;
  }
  if (s.length === 3) {
    return [parseInt(s[0] + s[1]), parseInt(s[2])];
  }
  if (s.length === 1 || s.length === 2) return [parseInt(s)];
  return [parseInt(s)];
}

function parseOcrLine(line) {
  const tokens = line.trim().split(/\s+/);
  if (tokens.length < 5) return null;
  let idx = 0;
  const partido = parseInt(tokens[idx++]);
  if (isNaN(partido) || partido < 1) return null;
  const hora = tokens[idx++];
  if (!/^\d{1,2}:\d{2}$/.test(hora)) return null;
  const pista = parseInt(tokens[idx++]);
  if (isNaN(pista)) return null;
  if (idx >= tokens.length) return null;
  const fase = fixOcrCode(tokens[idx++]);

  // Collect name tokens until we hit score-like numbers
  const nameTokens = [];
  while (idx < tokens.length) {
    const tok = tokens[idx];
    if (/^\d+$/.test(tok)) {
      const num = parseInt(tok, 10);
      if (num >= 0 && num <= 30 && idx + 1 < tokens.length && /^\d+$/.test(tokens[idx + 1])) {
        const nextNum = parseInt(tokens[idx + 1], 10);
        if (nextNum >= 0 && nextNum <= 30) break;
      }
    }
    nameTokens.push(tok);
    idx++;
  }
  if (nameTokens.length === 0) return null;

  let teamA, teamB;
  const nameStr = nameTokens.join(' ');
  const isBye = /BYE/i.test(nameStr);

  if (isBye) {
    teamA = 'BYE'; teamB = 'BYE';
    const byeTokens = nameTokens.filter(t => !/^BYE$/i.test(t));
    if (byeTokens.length > 0) {
      const beforeBye = nameTokens.indexOf(nameTokens.find(t => /^BYE$/i.test(t)));
      if (beforeBye === 0) teamB = fixOcrName(byeTokens.join(' '));
      else teamA = fixOcrName(byeTokens.join(' '));
    }
  } else {
    const groups = splitOcrTeams(nameTokens);
    if (groups.length >= 2) {
      teamA = fixOcrName(groups[0]);
      teamB = fixOcrName(groups.slice(1).join(' '));
    } else if (groups.length === 1) {
      const spaces = groups[0].split(/\s{3,}/);
      if (spaces.length >= 2) {
        teamA = fixOcrName(spaces[0]);
        teamB = fixOcrName(spaces.slice(1).join(' '));
      } else {
        const half = Math.ceil(nameTokens.length / 2);
        teamA = fixOcrName(nameTokens.slice(0, half).join(' '));
        teamB = fixOcrName(nameTokens.slice(half).join(' '));
      }
    } else {
      teamA = fixOcrName(nameTokens[0]);
      teamB = nameTokens.length > 1 ? fixOcrName(nameTokens.slice(1).join(' ')) : '?';
    }
  }

  let setsA, setsB, set1, set2, set3;
  let _rankingPos = null, _rankingName = null;
  const remaining = tokens.slice(idx);

  // Try extracting ranking from the END: look for "<num> <name/name>" pattern
  if (remaining.length >= 2) {
    const lastPos = remaining[remaining.length - 2];
    const lastName = remaining[remaining.length - 1];
    if (/^\d{1,2}$/.test(lastPos) && lastName.includes('/')) {
      const rp = parseInt(lastPos);
      if (rp >= 1 && rp <= 32 && !lastName.includes(':') && !lastName.includes('-')) {
        _rankingPos = rp;
        _rankingName = fixOcrName(lastName);
      }
    }
  }

  if (!isBye && remaining.length >= 2) {
    setsA = parseInt(remaining[0]);
    let rawSetsB = remaining[1];
    if (/^0\d+$/.test(rawSetsB)) {
      setsB = 0;
      remaining.splice(2, 0, rawSetsB.substring(1));
    } else {
      setsB = parseInt(rawSetsB);
    }
    if (!isNaN(setsA) && !isNaN(setsB) && setsA >= 0 && setsA <= 3 && setsB >= 0 && setsB <= 3) {
      const totalSets = setsA + setsB;
      const expected = totalSets * 2;
      let allDigits = '';
      for (let i = 2; i < remaining.length; i++) {
        if (_rankingPos !== null && i >= remaining.length - 2) continue;
        if (/^\d+$/.test(remaining[i])) allDigits += remaining[i];
      }
      if (allDigits.length >= expected) {
        const scores = [];
        let di = 0;
        while (di < allDigits.length && scores.length < expected) {
          const needed = expected - scores.length;
          const left = allDigits.length - di;
          if (left >= 2 && parseInt(allDigits.substring(di, di + 2)) <= 30 && left - 2 >= needed - 1) {
            scores.push(parseInt(allDigits.substring(di, di + 2)));
            di += 2;
          } else {
            scores.push(parseInt(allDigits[di]));
            di++;
          }
        }
        if (scores.length >= expected) {
          set1 = { a: scores[0], b: scores[1] };
          if (totalSets >= 2) set2 = { a: scores[2], b: scores[3] };
          if (totalSets === 3) set3 = { a: scores[4], b: scores[5] };
        }
      }
      if (!set1) {
        let scoreTokens = [];
        for (let i = 2; i < remaining.length; i++) {
          if (_rankingPos !== null && i >= remaining.length - 2) continue;
          if (/^\d+$/.test(remaining[i])) {
            const e = expandScoreNumbers(remaining[i]);
            for (const v of e) scoreTokens.push(v);
          }
        }
        if (scoreTokens.length >= expected) {
          set1 = { a: scoreTokens[0], b: scoreTokens[1] };
          if (totalSets >= 2) set2 = { a: scoreTokens[2], b: scoreTokens[3] };
          if (totalSets === 3) set3 = { a: scoreTokens[4], b: scoreTokens[5] };
        }
      }
    }
  } else if (isBye && remaining.length >= 1) {
    setsA = 0; setsB = 0; set1 = null; set2 = null; set3 = null;
    if (!_rankingPos) _rankingPos = parseInt(remaining[0]);
    if (!_rankingName && remaining.length >= 2) _rankingName = fixOcrName(remaining[remaining.length - 1]);
  }
  return { partido, hora, pista: isNaN(pista) ? undefined : pista, fase, parejaA: teamA, parejaB: teamB, setsA: setsA || 0, setsB: setsB || 0, set1: set1 || null, set2: set2 || null, set3: set3 || null, _rankingPos, _rankingName };
}

function parseOcrLines(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => /^\d{1,2}\s+\d{1,2}:\d{2}/.test(l));
  const partidos = [];
  const rankingMap = new Map();
  for (const line of lines) {
    const match = parseOcrLine(line);
    if (match) {
      partidos.push(match);
      if (match._rankingPos && match._rankingName && !rankingMap.has(match._rankingPos)) {
        rankingMap.set(match._rankingPos, match._rankingName);
      }
    }
  }
  const ranking = [...rankingMap.entries()].sort(([a], [b]) => a - b).map(([p, n]) => ({ posicion: p, pareja: n }));
  partidos.sort((a, b) => a.partido - b.partido);
  for (const m of partidos) { delete m._rankingPos; delete m._rankingName; }
  return { torneo: { categoria: '', fecha: '', lugar: '' }, partidos, ranking, _debug: { ocr: true, ocrLines: lines.length, matchRows: partidos.length } };
}

// === MAIN ENTRY POINT ===

export function parseBeachResults(pages, ocrText) {
  if (ocrText) {
    const result = parseOcrLines(ocrText);
    if (result.partidos.length > 0) return result;
    // OCR attempted but no matches — include text preview in debug
    const preview = ocrText.substring(0, 500).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
    const mergedDebug = { ...result._debug, ocrTextPreview: preview };
    return { torneo: { categoria: '', fecha: '', lugar: '' }, partidos: [], ranking: [], _debug: mergedDebug };
  }
  if (!pages || pages.length === 0) {
    return { torneo: { categoria: '', fecha: '', lugar: '' }, partidos: [], ranking: [] };
  }
  let allRows = [];
  for (const page of pages) {
    allRows = allRows.concat(groupIntoRows(page.items || []));
  }
  allRows.sort((a, b) => b.y - a.y);
  const torneo = extractTournamentInfo(allRows);
  const { matchRows, rankingRows } = splitRankingRows(allRows);

  let partidos = [];
  let ranking = [];
  const fallbackRanking = [];
  let usedColumnar = false;

  // Detect columnar layout: if the first rows have many items (10+)
  const isColumnar = detectColumnarLayout(allRows);

  if (isColumnar) {
    const colMatches = columnarParse(pages);
    if (colMatches && colMatches.length > 3) {
      partidos = colMatches;
      usedColumnar = true;
    }
  }

  if (!usedColumnar) {
    // Parse each match row
    for (const row of matchRows) {
      const match = extractMatchFromRow(row);
      if (match) {
        if (!match.partido) match.partido = partidos.length + 1;
        partidos.push(match);
      }

      // Fallback: extract ranking from original items
      const rankingInfo = findRankingInItems(row.items);
      if (rankingInfo) {
        fallbackRanking.push({ posicion: rankingInfo.pos, pareja: rankingInfo.pareja.replace(/\s*\/\s*/g, '/') });
      }
    }

    // Parse ranking rows (right side after split)
    ranking = extractRanking(rankingRows);

    // Merge: deduplicate by position
    const seen = new Set(ranking.map(r => r.posicion));
    for (const r of fallbackRanking) {
      if (!seen.has(r.posicion)) {
        ranking.push(r);
        seen.add(r.posicion);
      }
    }

    // Last resort: brute force scan
    if (ranking.length === 0) {
      const brute = bruteForceRanking(pages);
      for (const r of brute) {
        if (!seen.has(r.posicion)) {
          ranking.push(r);
          seen.add(r.posicion);
        }
      }
    }
  }

  ranking.sort((a, b) => a.posicion - b.posicion);
  partidos.sort((a, b) => a.partido - b.partido);

  // Diagnostics
  const totalItems = pages.reduce((s, p) => s + (p.items || []).length, 0);
  const totalRows = allRows.length;
  const rowSamples = (usedColumnar ? [] : matchRows).slice(0, 3).map(r => {
    const raw = (r.items || []).map(i => i.text.trim()).filter(Boolean).join(' | ');
    const merged = (r.cells || []).map(c => c.text || c).join(' | ');
    return raw + '  =>  ' + merged;
  });
  const _debug = { pages: pages.length, totalItems, totalRows, matchRows: matchRows.length, rankingRows: rankingRows.length, fallbackFound: fallbackRanking.length, columnar: usedColumnar, detectedColumnar: isColumnar, rowSamples };

  return { torneo, partidos, ranking, _debug };
}
