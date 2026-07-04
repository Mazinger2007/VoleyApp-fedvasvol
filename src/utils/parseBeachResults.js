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
      const gapFromEnd = cell ? it.x - cell.endX : Infinity;
      const shouldMerge = cell && (
        gapFromEnd <= X_CELL_GAP ||
        (cell.text.endsWith('/') && /^[A-ZÑÁÉÍÓÚ]/.test(it.text)) ||
        (cell.text.endsWith('/ ') && /^[A-ZÑÁÉÍÓÚ]/.test(it.text))
      );
      if (!cell || !shouldMerge) {
        cell = { x: it.x, endX: it.x + (it.w || 0), text: it.text };
        merged.push(cell);
      } else {
        cell.text += ' ' + it.text;
        cell.endX = Math.max(cell.endX, it.x + (it.w || 0));
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
    const gapFromEnd = c ? it.x - c.endX : Infinity;
    const shouldMerge = c && (
      gapFromEnd <= X_CELL_GAP ||
      (c.text.endsWith('/') && /^[A-ZÑÁÉÍÓÚ]/.test(it.text))
    );
    if (!c || !shouldMerge) {
      c = { x: it.x, endX: it.x + (it.w || 0), text: it.text };
      m.push(c);
    } else {
      c.text += ' ' + it.text;
      c.endX = Math.max(c.endX, it.x + (it.w || 0));
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
          if (after.length === 1 && parseRankingNumber(after[0].text)) {
            splitIdx = i;
            break;
          }
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


function normalizeCategory(cat) {
  if (!cat) return '';
  return cat.replace(/\bU-?(\d+)\b/gi, 'Sub $1').replace(/\bSub-(\d+)\b/gi, 'Sub $1');
}

function normalizePlace(place) {
  return place ? place.replace(/\s+/g, '') : '';
}

function extractTournamentInfo(rows) {
  let categoria = '', fecha = '', lugar = '', titulo = '';
  const CATEGORY_RE = /\b(Senior|Junior|Cadete|Kadete|Sub-\d+|U-\d+|U\d+|Absoluto|Absolutua|Infantil|Alevín|Benjamin|Alevin)\b/i;

  for (const row of rows) {
    const raw = row.cellTexts.join(' ') + ' ' + row.cells.map(c => c.text).join(' ');
    const firstCell = row.cellTexts[0] || '';

    if (!titulo) {
      const titleMatch = firstCell.match(/^(.+?)\s+(\d{4}[-/]\d{1,2}[-/]\d{1,2})\s+([A-Za-zÁÉÍÓÚÑáéíóúñ\s]+)$/);
      if (titleMatch) {
        let titleText = titleMatch[1].trim();
        titleText = titleText.replace(/\bU-?(\d+)\b/gi, 'Sub $1');
        titleText = titleText.replace(/\bSub-(\d+)\b/gi, 'Sub $1');
        titulo = titleText;
        if (!fecha) fecha = titleMatch[2];
        if (!lugar) lugar = normalizePlace(titleMatch[3]);
        if (!categoria) {
          const catMatch = raw.match(CATEGORY_RE);
          if (catMatch) categoria = normalizeCategory(catMatch[1]);
        }
        continue;
      }
    }

    if (!fecha) {
      const m = raw.match(/\d{4}[-/]\d{1,2}[-/]\d{1,2}/);
      if (m) fecha = m[0];
    }

    if (!categoria) {
      const m = raw.match(CATEGORY_RE);
      if (m) categoria = normalizeCategory(m[1]);
    }

    if (!lugar && fecha) {
      const m = raw.match(/\d{4}[-/]\d{1,2}[-/]\d{1,2}\s+([A-ZÁÉÍÓÚÑa-záéíóúñ]+)/);
      if (m) lugar = normalizePlace(m[1]);
    }
  }
  return { titulo, categoria, fecha, lugar };
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
      // Sin resultados (calendario/torneo sin sets): extraer equipos igualmente
      const noScorePairTexts = texts.slice(h).filter(t => !/^\d{1,2}$/.test(t));
      let parejaA = '', parejaB = '';
      if (noScorePairTexts.length === 2) {
        parejaA = noScorePairTexts[0]; parejaB = noScorePairTexts[1];
      } else if (noScorePairTexts.length === 1) {
        const t = noScorePairTexts[0];
        const parts = t.split(/\s{2,}/);
        if (parts.length >= 2) { parejaA = parts[0]; parejaB = parts.slice(1).join(' '); }
        else { parejaA = t; parejaB = ''; }
      } else if (noScorePairTexts.length > 2) {
        const merged = []; let cur = '';
        for (const pt of noScorePairTexts) {
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
      return {
        partido, hora, pista, fase, referencia,
        parejaA: parejaA.replace(/\s*\/\s*/g, '/').trim(),
        parejaB: parejaB.replace(/\s*\/\s*/g, '/').trim(),
        setsA: 0, setsB: 0, set1: null, set2: null, set3: null,
      };
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
  const allMatches = [];
  const allRanking = [];

  for (const page of pages) {
    const items = (page.items || []).map(item => ({ x: item.x, y: item.y, text: item.text, w: item.w || 0 }));
    if (items.length === 0) continue;

    // 1) Cluster items by x-position (column boundaries).
    const xSorted = [...items].sort((a, b) => a.x - b.x);
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
      const hasHora = texts.some(t => /\d{1,2}:\d{2}/.test(t));
      if (hasHora && texts.length >= 6) {
        columns.push({ x: cluster.x, texts });
      }
    }

    // 3) Parse each column's texts: detect ranking at end, then extract match
    for (const col of columns) {
      let rankingEntry = null;
      const t = col.texts;
      if (t.length >= 2) {
        const lastNum = t[t.length - 2].trim();
        const lastName = t[t.length - 1].trim();
        const posMatch = lastNum.match(/^(\d{1,2})$/);
        if (posMatch && isNameText(lastName)) {
          const pos = parseInt(posMatch[1], 10);
          if (pos >= 1 && pos <= 32) {
            rankingEntry = { posicion: pos, pareja: lastName.replace(/\s*\/\s*/g, '/').trim() };
            col.texts = t.slice(0, -2);
          }
        }
      }

      const fakeRow = { items: col.texts.map((txt, i) => ({ x: i, text: txt, w: 0 })) };
      const match = extractMatchFromRow(fakeRow);
      if (match) {
        if (!match.partido) match.partido = allMatches.length + 1;
        allMatches.push(match);
      }
      if (rankingEntry) {
        allRanking.push(rankingEntry);
      }
    }
  }

  if (allMatches.length === 0) return null;
  return { partidos: allMatches, ranking: allRanking };
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
// === MAIN ENTRY POINT ===

export function parseBeachResults(pages) {
  if (!pages || pages.length === 0) {
    return { torneo: { categoria: '', fecha: '', lugar: '', titulo: '' }, partidos: [], ranking: [] };
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

  let columnarRanking = [];
  if (isColumnar) {
    const colResult = columnarParse(pages);
    if (colResult && colResult.partidos.length > 3) {
      partidos = colResult.partidos;
      columnarRanking = colResult.ranking || [];
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

  if (usedColumnar && columnarRanking.length > 0) {
    const seen = new Set(ranking.map(r => r.posicion));
    for (const r of columnarRanking) {
      if (!seen.has(r.posicion)) {
        ranking.push(r);
        seen.add(r.posicion);
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
