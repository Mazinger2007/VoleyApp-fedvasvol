// =============================================================
// fedvas-browser-benchmark.js — Benchmark AJAX en navegador
// =============================================================
// USO:
//   1. Abre https://fedvasvol.com/es/tournaments en tu navegador
//   2. DevTools (F12) → pestaña Console
//   3. Pega todo el contenido de este archivo y pulsa Enter
//   4. Espera ~2 min a que terminen las 18 ligas
//
// Para probar solo N ligas (ej. primeras 3):
//   Cambia LIMIT = 3 antes de pegar
// =============================================================

(async () => {
  'use strict';

  const BASE = 'https://fedvasvol.com';
  const AJAX_TOURNAMENTS_URL = `${BASE}/es/ajax/tournaments`;
  const AJAX_TABLE_SEARCH_URL = `${BASE}/es/ajax/table-search`;

  /** Pon un número > 0 para limitar las ligas a medir, 0 = todas */
  const LIMIT = 0;

  /** Ligas "En curso" — temporada Voleibol 2025/2026 */
  const EN_CURSO = [
    { id: '1322242', name: '1ª Div. Española Masculina A' },
    { id: '1322243', name: '1ª Div. Española Femenina A' },
    { id: '1333205', name: 'Txapelketa Junior Femenino' },
    { id: '1333210', name: 'Txapelketa Junior Masculino' },
    { id: '1333206', name: 'Txapelketa Juvenil Femenino' },
    { id: '1333211', name: 'Txapelketa Juvenil Masculino' },
    { id: '1315743', name: 'Euskal Liga 1 Femenina' },
    { id: '1315744', name: 'Euskal Liga 2 Femenina' },
    { id: '1315745', name: 'Euskal Liga Masculina' },
    { id: '1320312', name: 'Liga Alavesa Absoluta Fem.' },
    { id: '1320332', name: 'Liga Alavesa Cadete Fem.' },
    { id: '1320334', name: 'Liga Alavesa Escolar Masc.' },
    { id: '1320331', name: 'Liga Alavesa Federada Masc.' },
    { id: '1320333', name: 'Liga Alavesa Infantil Fem.' },
    { id: '1323532', name: 'Liga Alavesa Minivoley' },
    { id: '1324969', name: 'Prueba' },
    { id: '1322241', name: 'Super Liga 2 Masculina' },
    { id: '1333445', name: 'Topaketa Infantil Fem. 2026' },
  ];

  // ── Helpers ──────────────────────────────────────────────────

  /** Mide el tiempo de una función async. Devuelve { ms, result, error } */
  async function timed(fn) {
    const t0 = performance.now();
    let result = null;
    let error = null;
    try {
      result = await fn();
    } catch (e) {
      error = e;
    }
    const ms = Math.round((performance.now() - t0) * 10) / 10;
    return { ms, result, error };
  }

  /** Parsea un string HTML con DOMParser (disponible en browser) */
  function parseHtml(html) {
    return new DOMParser().parseFromString(html || '', 'text/html');
  }

  /** Extrae el csrf_token del DOM del documento dado */
  function getCsrf(doc) {
    return doc.querySelector('input[name="csrf_token"]')?.value || '';
  }

  /** Extrae el season seleccionado del DOM */
  function getSeason(doc) {
    return (
      doc.querySelector('[name="season"]')?.value ||
      doc.querySelector('[data-season]')?.dataset?.season ||
      ''
    );
  }

  /**
   * Busca el bloque .ml-secondary-inputs con input[name="type"] === typeStr
   * y devuelve un objeto con todos los campos del bloque, o null si no existe.
   */
  function getSecondaryInputs(doc, typeStr) {
    for (const div of doc.querySelectorAll('.ml-secondary-inputs')) {
      const typeInput = div.querySelector('input[name="type"]');
      if (typeInput?.value === String(typeStr)) {
        const fields = {};
        div.querySelectorAll('input[name]').forEach((inp) => {
          fields[inp.name] = inp.value;
        });
        return fields;
      }
    }
    return null;
  }

  /**
   * Busca el primer enlace de navegación al calendario en el documento dado.
   * Devuelve la URL absoluta (sin /all) o cadena vacía.
   */
  function findCalendarUrl(doc) {
    for (const a of doc.querySelectorAll('a[href]')) {
      if (/\/tournament\/\d+\/calendar\/\d+$/.test(a.href)) return a.href;
    }
    // Fallback: buscar en texto del HTML como regex
    const match = doc.documentElement.innerHTML.match(
      /https?:\/\/[^"'\s]+\/tournament\/\d+\/calendar\/\d+(?:\/\d+)?(?=["'])/
    );
    return match ? match[0].replace(/\/all$/, '') : '';
  }

  /** Formatea ms con 1 decimal o devuelve '-' */
  function fmt(ms) {
    return ms != null ? `${ms}ms` : '-';
  }

  // ── Paso 0: Contexto inicial ─────────────────────────────────

  console.log('%c═══ fedvas-browser-benchmark ═══', 'font-weight:bold; font-size:14px');
  console.log(`URL actual: ${location.href}`);

  let rootDoc;
  if (/\/es\/tournaments/.test(location.pathname)) {
    rootDoc = document;
    console.log('[init] Usando documento actual como contexto');
  } else {
    console.log('[init] Descargando /es/tournaments para obtener csrf...');
    const { result: html } = await timed(() =>
      fetch(`${BASE}/es/tournaments`, { credentials: 'include' }).then((r) => r.text())
    );
    rootDoc = parseHtml(html);
  }

  const csrf = getCsrf(rootDoc);
  const seasonId = getSeason(rootDoc);

  console.log(`[init] csrf=${csrf ? 'encontrado ✓' : '⚠️ NO encontrado'}, season=${seasonId || '?'}`);
  if (!csrf) {
    console.warn('[WARN] Sin csrf_token: el test de /ajax/tournaments puede devolver 500');
  }

  // ── Paso 1: Tabla de ligas (POST /ajax/tournaments) ──────────

  console.log('\n%c── 1/3 · TABLA DE LIGAS (ajax/tournaments) ──', 'font-weight:bold');

  let tourRow = { endpoint: 'ajax/tournaments', ms: null, status: 'skip', bytes: 0 };

  if (csrf) {
    const body = new URLSearchParams({ csrf_token: csrf });
    if (seasonId) body.set('season', seasonId);

    const { ms, result, error } = await timed(() =>
      fetch(AJAX_TOURNAMENTS_URL, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: body.toString(),
      }).then(async (r) => {
        const text = await r.text();
        if (!r.ok) throw new Error(`HTTP ${r.status} — ${text.slice(0, 200)}`);
        return text;
      })
    );

    tourRow = {
      endpoint: 'ajax/tournaments',
      ms,
      status: error ? `ERROR: ${String(error.message).slice(0, 120)}` : 'ok',
      bytes: result?.length ?? 0,
    };
    console.log(`  → ${fmt(ms)}  ${tourRow.status}  (${tourRow.bytes} bytes)`);
  } else {
    console.log('  → SKIP (sin csrf_token)');
  }

  // ── Paso 2: Ranking + Calendario por liga ────────────────────

  console.log('\n%c── 2/3 · RANKING + CALENDARIO POR LIGA ──', 'font-weight:bold');
  const selected = LIMIT > 0 ? EN_CURSO.slice(0, LIMIT) : EN_CURSO;
  const leagueRows = [];

  for (let i = 0; i < selected.length; i++) {
    const t = selected[i];
    const rankingUrl = `${BASE}/es/tournament/${t.id}/ranking`;

    let rCtxMs = null;
    let rAjaxMs = null;
    let rTotalMs = null;
    let cCtxMs = null;
    let cAjaxMs = null;
    let cTotalMs = null;
    let rError = null;
    let cError = null;
    let calendarUrl = '';

    // ── Ranking ────────────────────────────────────────────────
    try {
      const rankingStart = performance.now();

      // 1a. Descarga página HTML de ranking (contexto)
      const { ms: ctxMs, result: rankingHtml, error: ctxErr } = await timed(() =>
        fetch(rankingUrl, { credentials: 'include' }).then((r) => r.text())
      );
      rCtxMs = ctxMs;
      if (ctxErr) throw ctxErr;

      const rankingDoc = parseHtml(rankingHtml);
      const rankingInputs = getSecondaryInputs(rankingDoc, '12');
      calendarUrl = findCalendarUrl(rankingDoc);

      // 1b. Llama al AJAX de tabla ranking (type=12)
      if (rankingInputs?.id) {
        const params = new URLSearchParams({ ...rankingInputs, input: '' });
        const { ms: ajaxMs, error: ajaxErr } = await timed(() =>
          fetch(`${AJAX_TABLE_SEARCH_URL}?${params}`, {
            credentials: 'include',
            headers: { 'X-Requested-With': 'XMLHttpRequest' },
          }).then((r) => {
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return r.text();
          })
        );
        rAjaxMs = ajaxMs;
        if (ajaxErr) throw ajaxErr;
      } else {
        rError = 'no type=12 inputs';
      }

      rTotalMs = Math.round((performance.now() - rankingStart) * 10) / 10;
    } catch (e) {
      rError = String(e.message).slice(0, 80);
    }

    // ── Calendario ─────────────────────────────────────────────
    if (calendarUrl) {
      try {
        const calStart = performance.now();

        // 2a. Descarga HTML de la jornada actual (contexto)
        const { ms: ctxMs, result: calHtml, error: ctxErr } = await timed(() =>
          fetch(calendarUrl, { credentials: 'include' }).then((r) => r.text())
        );
        cCtxMs = ctxMs;
        if (ctxErr) throw ctxErr;

        const calDoc = parseHtml(calHtml);
        const calInputs = getSecondaryInputs(calDoc, '9');

        // 2b. Llama al AJAX de tabla calendario (type=9)
        if (calInputs?.id) {
          const params = new URLSearchParams({ ...calInputs, input: '' });
          const { ms: ajaxMs, error: ajaxErr } = await timed(() =>
            fetch(`${AJAX_TABLE_SEARCH_URL}?${params}`, {
              credentials: 'include',
              headers: { 'X-Requested-With': 'XMLHttpRequest' },
            }).then((r) => {
              if (!r.ok) throw new Error(`HTTP ${r.status}`);
              return r.text();
            })
          );
          cAjaxMs = ajaxMs;
          if (ajaxErr) throw ajaxErr;
        } else {
          cError = 'no type=9 inputs';
        }

        cTotalMs = Math.round((performance.now() - calStart) * 10) / 10;
      } catch (e) {
        cError = String(e.message).slice(0, 80);
      }
    } else {
      cError = 'calendario no encontrado';
    }

    const row = {
      '#': i + 1,
      liga: t.name,
      'rCtx(ms)': rCtxMs,
      'rAjax(ms)': rAjaxMs,
      'rTotal(ms)': rTotalMs ?? rError ?? '-',
      'cCtx(ms)': cCtxMs,
      'cAjax(ms)': cAjaxMs,
      'cTotal(ms)': cTotalMs ?? cError ?? '-',
      'total(ms)':
        rTotalMs != null && cTotalMs != null
          ? Math.round((rTotalMs + cTotalMs) * 10) / 10
          : '-',
    };
    leagueRows.push(row);

    const flag = rError || cError ? '⚠️' : '✓';
    console.log(
      `  [${String(i + 1).padStart(2)}/${selected.length}] ${flag} ${t.name.padEnd(33)} ` +
        `ranking=${fmt(rTotalMs)} calendario=${fmt(cTotalMs)}`
    );
  }

  // ── Paso 3: Resumen ──────────────────────────────────────────

  console.log('\n%c── 3/3 · RESUMEN ──', 'font-weight:bold');
  console.log(`Tabla de ligas (ajax/tournaments): ${fmt(tourRow.ms)}  [${tourRow.status}]`);

  console.log('\nTiempos por liga:');
  console.table(leagueRows);

  // Estadísticas
  const nums = (key) =>
    leagueRows.map((r) => r[key]).filter((v) => typeof v === 'number');
  const avg = (arr) =>
    arr.length
      ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10
      : 0;
  const med = (arr) => {
    if (!arr.length) return 0;
    const s = [...arr].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m];
  };

  const rankingTotals = nums('rTotal(ms)');
  const calendarTotals = nums('cTotal(ms)');
  const grandTotals = nums('total(ms)');

  console.log('\nEstadísticas:');
  console.table([
    {
      métrica: 'Ranking (ctx+ajax)',
      n: rankingTotals.length,
      avg: `${avg(rankingTotals)}ms`,
      median: `${med(rankingTotals)}ms`,
      min: `${Math.min(...rankingTotals)}ms`,
      max: `${Math.max(...rankingTotals)}ms`,
    },
    {
      métrica: 'Calendario (ctx+ajax)',
      n: calendarTotals.length,
      avg: `${avg(calendarTotals)}ms`,
      median: `${med(calendarTotals)}ms`,
      min: `${Math.min(...calendarTotals)}ms`,
      max: `${Math.max(...calendarTotals)}ms`,
    },
    {
      métrica: 'Total (ranking+cal)',
      n: grandTotals.length,
      avg: `${avg(grandTotals)}ms`,
      median: `${med(grandTotals)}ms`,
      min: `${Math.min(...grandTotals)}ms`,
      max: `${Math.max(...grandTotals)}ms`,
    },
  ]);

  console.log('\n%c✅ Benchmark completado', 'color:green; font-weight:bold');
  // Retorna los datos para poder copiarlos con: copy(await $result)
  return { tournamentsRow: tourRow, leagues: leagueRows };
})();
