#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import * as url from 'url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const SRC = path.resolve(__dirname, 'src');

// ── Replicas of internal functions from parseBeachResults.js ──
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
  const last = items[items.length - 1];
  if (last && last.text.trim()) {
    const merged = splitRankingFromItem(last);
    if (merged) return { idx: items.length - 1, pos: merged.pos, pareja: merged.pareja };
  }
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
    const ranking = findRankingInItems(items);
    if (ranking) {
      splitIdx = ranking.idx;
    }
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
    const matchItems = splitIdx > 0 ? items.slice(0, splitIdx) : items;
    const matchTexts = mergeItems(matchItems);
    matchRows.push({ ...row, items: matchItems, cells: matchTexts, cellTexts: matchTexts });
    if (splitIdx > 0) {
      const rankingItems = items.slice(splitIdx);
      const rankingTexts = rankingItems
        .sort((a, b) => a.x - b.x)
        .map(it => it.text.trim())
        .filter(Boolean);
      rankingRows.push({ ...row, cells: rankingTexts, cellTexts: rankingTexts });
    }
  }
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
  const items = (row.items || []).filter(i => i.text.trim().length > 0);
  items.sort((a, b) => a.x - b.x);
  const texts = items.map(i => i.text.trim());
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
    const last = items[items.length - 1];
    if (last && last.text.trim()) {
      const merged = splitRankingFromItem(last);
      if (merged && !seen.has(merged.pos)) {
        found = { posicion: merged.pos, pareja: merged.pareja };
      }
    }
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

function columnarParse(pages) {
  const allItems = [];
  for (const page of pages) {
    for (const item of page.items || []) {
      allItems.push({ x: item.x, y: item.y, text: item.text, w: item.w || 0 });
    }
  }
  if (allItems.length === 0) return null;
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
  if (columns.length === 0) return null;
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
// ── End of replicas ──

async function loadPdf(source) {
  if (/^https?:\/\//i.test(source)) {
    const resp = await fetch(source);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const buf = await resp.arrayBuffer();
    return new Uint8Array(buf);
  }
  return new Uint8Array(fs.readFileSync(source));
}

async function extractPages(pdfBytes) {
  const pdfjsLib = await import('pdfjs-dist');
  const doc = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
  const pages = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const items = [];
    for (const item of content.items) {
      if (!item.str || item.str.trim().length === 0) continue;
      items.push({
        text: item.str,
        x: Math.round(item.transform[4] * 10) / 10,
        y: Math.round((viewport.height - item.transform[5]) * 10) / 10,
        w: Math.round(item.width * 10) / 10,
      });
    }
    pages.push({ page: p, items, width: viewport.width, height: viewport.height });
  }
  return pages;
}

function getStats(pages) {
  const allItems = [];
  for (const page of pages) {
    for (const item of page.items) {
      allItems.push({ x: item.x, y: item.y, text: item.text, w: item.w });
    }
  }
  return { count: allItems.length };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Uso: node debug-pdf.mjs <pdf-url|pdf-file>');
    console.error('Ej:  node debug-pdf.mjs https://cdn.leverade.com/files/uR6PpK2L57.pdf');
    process.exit(1);
  }
  const source = args[0];

  console.log('='.repeat(70));
  console.log(' DEBUG PDF EXTRACTOR');
  console.log('='.repeat(70));
  console.log();
  console.log(`Source: ${source}`);
  console.log();

  // 1) Load PDF
  console.log('---[ 1. LOAD PDF ]---');
  const pdfBytes = await loadPdf(source);
  console.log(`  Size: ${(pdfBytes.length / 1024).toFixed(1)} KB`);
  console.log();

  // 2) Extract pages
  console.log('---[ 2. EXTRACT PAGES ]---');
  const pages = await extractPages(pdfBytes);
  console.log(`  Pages: ${pages.length}`);
  const totalItems = pages.reduce((s, p) => s + p.items.length, 0);
  console.log(`  Total text items: ${totalItems}`);
  console.log();

  // 3) Per-page item dump grouped by y (like row grouping)
  console.log('---[ 3. PER-PAGE ITEMS GROUPED BY y ]---');
  for (const page of pages) {
    console.log(`  === PAGE ${page.page} (${page.items.length} items, ${page.width}x${page.height}) ===`);
    const byY = {};
    for (const it of page.items) {
      const key = Math.round(it.y);
      if (!byY[key]) byY[key] = [];
      byY[key].push(it);
    }
    const yKeys = Object.keys(byY).map(Number).sort((a, b) => b - a);
    for (const y of yKeys) {
      const its = byY[y].sort((a, b) => a.x - b.x);
      const texts = its.map(it => `${it.text}[x=${it.x},w=${it.w}]`).join(', ');
    console.log(`    y=${String(y).padStart(6)} (${its.length}): ${texts}`);
    }
    console.log();
  }

  // Stats
  const stats = getStats(pages);
  console.log(`  Total items across all pages: ${stats.count}`);
  console.log();

  // 4) groupIntoRows (same function as parsed)
  console.log('---[ 4. GROUP INTO ROWS (groupIntoRows) ]---');
  let allRows = [];
  for (const page of pages) {
    allRows = allRows.concat(groupIntoRows(page.items || []));
  }
  allRows.sort((a, b) => b.y - a.y);
  console.log(`  Total rows: ${allRows.length}`);
  console.log();
  for (let i = 0; i < allRows.length; i++) {
    const row = allRows[i];
    const raw = row.items.map(it => it.text.trim()).filter(Boolean).join(' | ');
    const merged = row.cellTexts.join(' | ');
    console.log(`  Row ${String(i).padStart(2)} (y=${String(row.y).padStart(6)}): [raw] ${raw.substring(0, 120)}`);
    console.log(`              [merged] ${merged.substring(0, 120)}`);
  }
  console.log();

  // 5) splitRankingRows
  console.log('---[ 5. SPLIT RANKING ROWS ]---');
  const { matchRows, rankingRows } = splitRankingRows(allRows);
  console.log(`  Match rows: ${matchRows.length}`);
  console.log(`  Ranking rows: ${rankingRows.length}`);
  console.log();

  if (rankingRows.length > 0) {
    console.log('  -- Ranking-only rows --');
    for (let i = 0; i < rankingRows.length; i++) {
      const row = rankingRows[i];
      const texts = row.cellTexts.join(' | ');
      console.log(`    RankingRow ${String(i).padStart(2)}: ${texts.substring(0, 120)}`);
    }
    console.log();
  }

  // 6) extractMatchFromRow for each match row
  console.log('---[ 6. EXTRACT MATCH FROM ROW ]---');
  let matchedCount = 0;
  let nullCount = 0;
  for (let i = 0; i < matchRows.length; i++) {
    const row = matchRows[i];
    const items = (row.items || []).filter(it => it.text.trim().length > 0);
    items.sort((a, b) => a.x - b.x);
    const texts = items.map(it => it.text.trim());
    const rawLine = texts.join(' | ');

    const rankingInfo = findRankingInItems(items);
    const rankingNote = rankingInfo ? ` [RANKING DETECTED: pos=${rankingInfo.pos}, pareja="${rankingInfo.pareja}"]` : '';

    const match = extractMatchFromRow(row);
    console.log(`  Row ${String(i).padStart(2)} (y=${String(row.y).padStart(6)}): ${rawLine.substring(0, 150)}${rankingNote}`);
    if (match) {
      matchedCount++;
      const sets = [match.set1, match.set2, match.set3].filter(Boolean)
        .map(s => `${s.A}-${s.B}`)
        .join(', ');
      console.log(`    => #${match.partido} ${match.hora || '--:--'} P${match.pista || '?'} ${match.fase || ''} ${match.referencia || ''}`);
      console.log(`       ${match.parejaA || '?'} vs ${match.parejaB || '?'} | ${match.setsA}-${match.setsB} | Sets: [${sets}]`);
    } else {
      nullCount++;
      console.log(`    => NULL (no match)`);
    }
  }
  console.log(`  Matched: ${matchedCount}, Null: ${nullCount}`);
  console.log();

  // 7) Full ranking from actual source
  console.log('---[ 7. FULL RESULT RANKING ]---');
  const { parseBeachResults } = await import(url.pathToFileURL(path.join(SRC, 'utils', 'parseBeachResults.js')).href);
  const fullResult = parseBeachResults(pages, null);
  console.log(`  Torneo: titulo="${fullResult.torneo.titulo}" categoria="${fullResult.torneo.categoria}" fecha="${fullResult.torneo.fecha}" lugar="${fullResult.torneo.lugar}"`);
  console.log(`  Ranking (${fullResult.ranking.length}):`);
  for (const r of fullResult.ranking) {
    console.log(`    ${String(r.posicion).padStart(2)}. ${r.pareja}`);
  }
  console.log();
  console.log(`  Partidos: ${fullResult.partidos.length}`);
  console.log(`  Columnar usado: ${fullResult._debug.columnar}`);
  console.log();

  // 9) Full parseBeachResults output
  console.log('---[ 9. FULL PARSE RESULT ]---');
  console.log('  Debug:', JSON.stringify(fullResult._debug, null, 4));
  console.log();
  console.log();
  console.log(`  Partidos (${fullResult.partidos.length}):`);
  for (const m of fullResult.partidos) {
    const sets = [m.set1, m.set2, m.set3].filter(Boolean)
      .map(s => `${String(s.A).padStart(2)}-${String(s.B).padStart(2)}`)
      .join(', ');
    console.log(`    #${String(m.partido).padStart(2)} ${m.hora || '--:--'} P${m.pista || '?'} ${m.fase || ''} ${m.referencia || ''}`);
    console.log(`        ${(m.parejaA || '?').padEnd(28)} ${String(m.setsA).padStart(1)}-${String(m.setsB).padEnd(1)} ${(m.parejaB || '?').padEnd(28)} [${sets}]`);
  }
  console.log();

  // 10) Raw text dump
  console.log('---[ 10. RAW TEXT DUMP ]---');
  const allText = pages.map(p => p.items.map(i => i.text).join(' ')).join('\n');
  console.log(allText.substring(0, 4000));
  if (allText.length > 4000) console.log(`  ... (${allText.length - 4000} more chars)`);
  console.log();

  console.log('='.repeat(70));
  console.log(' END DEBUG');
  console.log('='.repeat(70));
}

main().catch(e => {
  console.error('\nFATAL:', e);
  process.exit(1);
});
