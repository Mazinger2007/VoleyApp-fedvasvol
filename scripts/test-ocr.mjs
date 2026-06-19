import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { createCanvas } from 'canvas';
import Tesseract from 'tesseract.js';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pdfjsLib = require('pdfjs-dist');
// Register worker for Node.js
const workerPath = resolve(require.resolve('pdfjs-dist'), '..', '..', 'build', 'pdf.worker.js');
pdfjsLib.GlobalWorkerOptions.workerSrc = workerPath;

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '..', 'temp', 'ocr-debug');

// === REPLICA DEL PREPROCESAMIENTO DEL WEBVIEW (Otsu + median blur) ===

function preprocessImage(pageCanvas) {
  const ctx = pageCanvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, pageCanvas.width, pageCanvas.height);
  const d = imageData.data;
  const w = pageCanvas.width, h = pageCanvas.height;
  const pixels = w * h;

  // Grayscale
  const gray = new Uint8Array(pixels);
  for (let i = 0, j = 0; i < d.length; i += 4, j++) {
    gray[j] = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) | 0;
  }

  // Median blur 3x3
  const blurred = new Uint8Array(gray);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const n = [];
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          n.push(gray[(y + ky) * w + (x + kx)]);
        }
      }
      n.sort((a, b) => a - b);
      blurred[y * w + x] = n[4];
    }
  }

  // Otsu thresholding
  const hist = new Array(256).fill(0);
  for (let i = 0; i < pixels; i++) hist[blurred[i]]++;
  const total = pixels;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0, wB = 0, maxVar = 0, threshold = 128;
  for (let i = 0; i < 256; i++) {
    wB += hist[i];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += i * hist[i];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const v = wB * wF * (mB - mF) * (mB - mF);
    if (v > maxVar) { maxVar = v; threshold = i; }
  }

  // Apply threshold
  for (let i = 0, j = 0; i < d.length; i += 4, j++) {
    if (blurred[j] < threshold) { d[i] = d[i + 1] = d[i + 2] = 0; }
    else { d[i] = d[i + 1] = d[i + 2] = 255; }
  }
  ctx.putImageData(imageData, 0, 0);

  return { threshold, w, h };
}

// === REPLICA DEL PARSER ===

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
    }
  } else if (isBye && remaining.length >= 1) {
    setsA = 0; setsB = 0; set1 = null; set2 = null; set3 = null;
    if (!_rankingPos) _rankingPos = parseInt(remaining[0]);
    if (!_rankingName && remaining.length >= 2) _rankingName = fixOcrName(remaining[remaining.length - 1]);
  }
  return { partido, hora, pista, fase, parejaA: teamA, parejaB: teamB, setsA: setsA || 0, setsB: setsB || 0, set1, set2, set3, _rankingPos, _rankingName };
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
  return { partidos, ranking, totalLines: lines.length, matchedLines: partidos.length };
}

// === MAIN ===

async function main() {
  const args = process.argv.slice(2);
  const forceOcr = args.includes('--force-ocr');
  const pdfUrl = args.find(a => a.startsWith('http'));
  if (!pdfUrl) {
    console.log('Uso: node scripts/test-ocr.mjs <url-del-pdf> [--force-ocr]');
    console.log('Ej:  node scripts/test-ocr.mjs https://example.com/resultados.pdf');
    console.log('     node scripts/test-ocr.mjs https://example.com/resultados.pdf --force-ocr');
    process.exit(1);
  }
  console.log('\n=== DEBUG OCR ===\n');
  console.log(`PDF: ${pdfUrl}\n`);

  // 1. Download PDF
  console.log('1. Descargando PDF...');
  const resp = await fetch(pdfUrl);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const pdfBuffer = Buffer.from(await resp.arrayBuffer());
  console.log(`   OK (${(pdfBuffer.length / 1024).toFixed(1)} KB)\n`);

  // 2. Load PDF
  console.log('2. Cargando PDF...');
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(pdfBuffer) }).promise;
  console.log(`   Paginas: ${doc.numPages}\n`);

  // 3. Try text extraction first
  console.log('3. Extrayendo texto...');
  let totalTextItems = 0;
  const textPages = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1 });
    const items = content.items
      .filter(i => i.str && i.str.trim().length > 0)
      .map(i => ({
        text: i.str,
        x: Math.round(i.transform[4] * 10) / 10,
        y: Math.round((viewport.height - i.transform[5]) * 10) / 10,
        w: Math.round(i.width * 10) / 10,
      }));
    totalTextItems += items.length;
    textPages.push({ page: p, items, width: viewport.width, height: viewport.height });
  }
  console.log(`   Items de texto: ${totalTextItems}`);

  const needsOcr = totalTextItems === 0 || forceOcr;
  if (totalTextItems > 0) {
    console.log(`   ✓ PDF tiene texto seleccionable (${totalTextItems} items)${forceOcr ? ' — forzando OCR igualmente' : ''}`);
    const textContent = textPages.map(p => p.items.map(i => i.text).join(' ')).join('\n');
    console.log('\n--- VISTA PREVIA DEL TEXTO ---\n');
    console.log(textContent.substring(0, 2000));
  } else {
    console.log('   ✗ PDF sin texto seleccionable → iniciando OCR\n');
  }

  if (!needsOcr) {
    console.log('\nSaltando OCR (usa --force-ocr para ejecutarlo igualmente).\n');
    console.log('=== FIN DEBUG OCR ===\n');
    return;
  }

  // 4. OCR
  console.log('4. Iniciando OCR con Tesseract.js (spa)...\n');
  if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });

  let fullOcrText = '';
  for (let p = 1; p <= doc.numPages; p++) {
    console.log(`   Pagina ${p}/${doc.numPages}...`);
    const page = await doc.getPage(p);
    const viewport = page.getViewport({ scale: 3 });
    const canvas = createCanvas(viewport.width, viewport.height);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvasContext: ctx, viewport }).promise;

    // Save raw rendered page
    const rawBuf = canvas.toBuffer('image/png');
    writeFileSync(join(OUTPUT_DIR, `page-${p}-raw.png`), rawBuf);

    // Apply preprocessing
    const { threshold } = preprocessImage(canvas);
    console.log(`      Threshold Otsu: ${threshold}`);

    // Save preprocessed page
    const processedBuf = canvas.toBuffer('image/png');
    writeFileSync(join(OUTPUT_DIR, `page-${p}-processed.png`), processedBuf);

    // Run OCR (pass PNG buffer for Node.js compatibility)
    const pngBuffer = canvas.toBuffer('image/png');
    const { data } = await Tesseract.recognize(pngBuffer, 'spa', {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          process.stdout.write(`\r      OCR: ${(m.progress * 100).toFixed(0)}%`);
        }
      },
    });
    process.stdout.write('\n');
    console.log(`      Confianza media: ${(data.confidence || 0).toFixed(1)}%`);

    fullOcrText += data.text + '\n';
  }

  // 5. Show raw OCR text
  console.log('\n--- TEXTO CRUDO DEL OCR ---\n');
  console.log(fullOcrText);

  // 6. Show lines matching match pattern
  console.log('--- LINEAS CON FORMATO DE PARTIDO ---\n');
  const lines = fullOcrText.split('\n').map(l => l.trim()).filter(Boolean);
  const matchLines = lines.filter(l => /^\d{1,2}\s+\d{1,2}:\d{2}/.test(l));
  if (matchLines.length > 0) {
    console.log(`Encontradas ${matchLines.length} lineas con formato de partido:\n`);
    for (const l of matchLines) {
      console.log(`  "${l}"`);
    }
  } else {
    console.log('Ninguna linea coincide con el patron de partido.');
    console.log('\nPrimeras 30 lineas del OCR:\n');
    for (const l of lines.slice(0, 30)) {
      console.log(`  "${l}"`);
    }
  }

  // 7. Parse results
  console.log('\n--- RESULTADOS PARSED ---\n');
  const result = parseOcrLines(fullOcrText);
  console.log(`Partidos detectados: ${result.partidos.length}`);
  console.log(`Ranking detectados: ${result.ranking.length}`);
  console.log(`Lineas totales en OCR: ${result.totalLines}`);
  console.log(`Lineas con match: ${result.matchedLines}`);

  if (result.partidos.length > 0) {
    console.log('\nPartidos:\n');
    for (const m of result.partidos) {
      console.log(`  #${m.partido} ${m.hora} P${m.pista} ${m.fase || '-'}: ${m.parejaA} vs ${m.parejaB} (${m.setsA}-${m.setsB})`);
      if (m.set1) console.log(`    Sets: ${m.set1.a}-${m.set1.b}${m.set2 ? `, ${m.set2.a}-${m.set2.b}` : ''}${m.set3 ? `, ${m.set3.a}-${m.set3.b}` : ''}`);
    }
  }

  if (result.ranking.length > 0) {
    console.log('\nRanking:\n');
    for (const r of result.ranking) {
      console.log(`  #${r.posicion}: ${r.pareja}`);
    }
  }

  console.log(`\nImagenes de depuracion guardadas en: ${OUTPUT_DIR}`);
  console.log('\n=== FIN DEBUG OCR ===\n');
}

main().catch(err => {
  console.error('\nError:', err.message);
  console.error(err.stack);
  process.exit(1);
});
