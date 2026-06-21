#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import * as url from 'url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const SRC = path.resolve(__dirname, '..', 'src');

// Helper: load PDF bytes from URL or file
async function loadPdf(source) {
  if (/^https?:\/\//i.test(source)) {
    const resp = await fetch(source);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const buf = await resp.arrayBuffer();
    return new Uint8Array(buf);
  }
  return new Uint8Array(fs.readFileSync(source));
}

// Helper: extract text items using pdfjs-dist (same structure as WebView version)
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

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Uso: node scripts/test-pdf-parser.mjs <pdf-url|pdf-file>');
    process.exit(1);
  }
  const source = args[0];
  console.log('>> Cargando PDF:', source);

  const pdfBytes = await loadPdf(source);
  console.log('>> PDF size:', (pdfBytes.length / 1024).toFixed(1), 'KB');

  const pages = await extractPages(pdfBytes);
  console.log('>> Pages:', pages.length);
  const totalItems = pages.reduce((s, p) => s + p.items.length, 0);
  console.log('>> Total items:', totalItems);

  // Dump items from page 1 grouped by y
  if (pages.length > 0) {
    const byY = {};
    for (const it of pages[0].items) {
      const key = Math.round(it.y);
      if (!byY[key]) byY[key] = [];
      byY[key].push(it);
    }
    const yKeys = Object.keys(byY).map(Number).sort((a,b) => b - a);
    console.log('\n--- Page 1 items grouped by y-order (top→bottom) ---');
    for (const y of yKeys.slice(0, 20)) {
      const its = byY[y].sort((a,b) => a.x - b.x);
      const n = its.length;
      const texts = its.map(it => `"${it.text}"`).join(', ');
      console.log(`  y=${String(y).padStart(5)} (${n} items): ${texts.substring(0, 200)}`);
    }
    console.log('  ... (showing first 20 of ' + yKeys.length + ' y-layers)');
  }

  // Parse using our beach results parser
  const { parseBeachResults } = await import(url.pathToFileURL(path.join(SRC, 'utils', 'parseBeachResults.js')).href);

  const result = parseBeachResults(pages, null);

  console.log('\n' + '='.repeat(60));
  console.log('DEBUG:', JSON.stringify(result._debug, null, 2));

  if (result._debug.rowSamples) {
    console.log('\n--- Raw row samples ---');
    for (const s of result._debug.rowSamples) {
      console.log('  ' + s);
      console.log('');
    }
  }

  console.log('\n=== TORNEO ===');
  console.log('  Categoria:', result.torneo.categoria);
  console.log('  Fecha:', result.torneo.fecha);
  console.log('  Lugar:', result.torneo.lugar);

  console.log('\n=== RANKING (' + result.ranking.length + ') ===');
  for (const r of result.ranking) {
    console.log(`  ${String(r.posicion).padStart(2)}. ${r.pareja}`);
  }

  console.log('\n=== PARTIDOS (' + result.partidos.length + ') ===');
  for (const m of result.partidos) {
    const sets = [m.set1, m.set2, m.set3].filter(Boolean)
      .map(s => `${String(s.A).padStart(2)}-${String(s.B).padStart(2)}`)
      .join(', ');
    console.log(`  #${String(m.partido).padStart(2)} ${m.fase ? m.fase + ' ' : ''}${m.pista ? '(P' + m.pista + ')' : ''} ${m.parejaA.padEnd(25)} ${String(m.setsA).padStart(1)}-${String(m.setsB).padEnd(1)} ${m.parejaB.padEnd(25)}  [${sets}]`);
  }
}

main().catch(e => {
  console.error('FATAL:', e);
  process.exit(1);
});
