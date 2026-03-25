// Parser específico para detalle de partido de torneo
function parseTournamentMatchDetail(html) {
  // Extraer equipos y sets usando data-original-title
  // 1. Buscar todas las filas de la tabla de sets
  const tableMatch = String(html).match(/<div class="match-partials">([\s\S]*?)<\/div>/i);
  if (!tableMatch) return [];
  const rows = [...tableMatch[1].matchAll(/<tr>([\s\S]*?)<\/tr>/gi)];
  if (rows.length < 2) return [];

  // 2. Extraer nombre de equipo de data-original-title y sets de cada fila
  const teamRows = rows.map((row, idx) => {
    // Extraer todos los <td>...</td> (incluyendo el primero)
    const cellMatches = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)];
    let teamName = null;
    let tdRaw = '';
    if (cellMatches.length > 0) {
      tdRaw = row[1].match(/<td[^>]*>.*?<\/td>/is)?.[0] || '';
    }
    // Loguear el HTML crudo del primer <td>
    if (typeof window !== 'undefined' && window.console) {
      window.console.log(`[parseTournamentMatchDetail] Fila ${idx}: primer <td>:`, tdRaw);
    } else {
      console.log(`[parseTournamentMatchDetail] Fila ${idx}: primer <td>:`, tdRaw);
    }
    // Buscar el primer <td ... data-original-title="NOMBRE" ...> o title="NOMBRE"
    let tdMatch = tdRaw.match(/data-original-title=["']([^"']*)["']/i);
    if (tdMatch && tdMatch[1] && tdMatch[1].trim().length > 0) {
      teamName = tdMatch[1].trim();
    } else {
      tdMatch = tdRaw.match(/title=["']([^"']*)["']/i);
      if (tdMatch && tdMatch[1] && tdMatch[1].trim().length > 0) {
        teamName = tdMatch[1].trim();
      } else if (cellMatches.length > 0) {
        teamName = cellMatches[0][1].replace(/<[^>]+>/g, '').trim();
      }
    }
    // Los sets están en las celdas a partir de la segunda
    const setValues = cellMatches.slice(1).map(m => parseInt(m[1].replace(/<[^>]+>/g, '').trim(), 10) || 0);
    if (typeof window !== 'undefined' && window.console) {
      window.console.log(`[parseTournamentMatchDetail] Fila ${idx}: teamName="${teamName}"`);
    } else {
      console.log(`[parseTournamentMatchDetail] Fila ${idx}: teamName="${teamName}"`);
    }
    return { teamName, setValues };
  });

  // 3. Si hay dos equipos y ambos tienen nombre y sets
  if (teamRows.length === 2 && teamRows[0].teamName && teamRows[1].teamName) {
    const [home, away] = teamRows;
    // Calcular sets ganados
    const homeScore = home.setValues.filter((h, i) => h > (away.setValues[i] || 0)).length;
    const awayScore = away.setValues.filter((a, i) => a > (home.setValues[i] || 0)).length;
    if (typeof window !== 'undefined' && window.console) {
      window.console.log(`[parseTournamentMatchDetail] Equipos extraídos: "${home.teamName}" vs "${away.teamName}"`);
    } else {
      console.log(`[parseTournamentMatchDetail] Equipos extraídos: "${home.teamName}" vs "${away.teamName}"`);
    }
    return [{
      homeTeam: home.teamName,
      awayTeam: away.teamName,
      sets: home.setValues.map((h, i) => ({ home: h, away: away.setValues[i] || 0 })),
      homeScore,
      awayScore,
      scoreText: `${homeScore} - ${awayScore}`,
    }];
  }
  console.log('[parseTournamentMatchDetail] No se pudieron extraer ambos equipos y sets correctamente:', JSON.stringify(teamRows));
  return [];
}
// src/utils/htmlParser.js
// Utilidad central para descargar y parsear el HTML de la federación.
// Usa htmlparser2 + domutils para recorrer el DOM sin ningún CSS original.

import axios from 'axios';
import * as htmlparser2 from 'htmlparser2';
import * as DomUtils from 'domutils';

// ─── URLs base de la Federación Vasca de Voleibol ───────────────────────────
export const BASE_URL = 'https://fedvasvol.com';

export const URLS = {
  // Home de la app: competiciones (tu página principal objetivo)
  home: 'https://fedvasvol.com/es/tournaments',
  competitions: 'https://fedvasvol.com/es/tournaments',
  teams: 'https://fedvasvol.com/es/information',
  results: 'https://fedvasvol.com/es/tournaments',
};

const AJAX_URLS = {
  tournaments: `${BASE_URL}/es/ajax/tournaments`,
  tableSearch: `${BASE_URL}/es/ajax/table-search`,
};

const tournamentContextCache = new Map();
const tournamentContextInFlight = new Map();
const tournamentsAjaxContextCache = new Map();
const calendarAjaxContextCache = new Map();
const infoDataCache = new Map();
const championshipDataCache = new Map();
const CHAMPIONSHIP_CACHE_TTL_MS = 30000;

let globalSessionCookie = '';

// ─── Helpers de URL ─────────────────────────────────────────────────────────
export function toAbsoluteUrl(href = '') {
  if (!href || typeof href !== 'string') return '';
  if (/^https?:\/\//i.test(href)) return href;
  return `${BASE_URL}${href.startsWith('/') ? href : `/${href}`}`;
}

export function toRankingUrl(inputUrl = '') {
  if (!inputUrl) return '';

  const absolute = toAbsoluteUrl(inputUrl);
  const normalized = absolute
    .replace(/\/summary(?:\/.*)?$/i, '/ranking')
    .replace(/\/information(?:\/.*)?$/i, '/ranking')
    .replace(/\/calendar(?:\/\d+)?(?:\/.*)?$/i, '/ranking');

  if (/\/ranking(?:\/\d+)?$/i.test(normalized)) {
    // Fuerza /ranking base para obtener navegación y detectar calendario activo
    return normalized.replace(/\/ranking(?:\/\d+)?$/i, '/ranking');
  }

  const match = normalized.match(/^(https?:\/\/[^/]+\/[a-z]{2}\/tournament\/\d+)/i);
  return match ? `${match[1]}/ranking` : normalized;
}

export function toInfoUrl(inputUrl = '') {
  if (!inputUrl) return '';

  const absolute = toAbsoluteUrl(inputUrl);
  const normalized = absolute
    .replace(/\/summary(?:\/.*)?$/i, '/information')
    .replace(/\/ranking(?:\/\d+)?(?:\/.*)?$/i, '/information')
    .replace(/\/calendar(?:\/\d+)?(?:\/all)?(?:\/.*)?$/i, '/information');

  if (/\/information(?:\/.*)?$/i.test(normalized)) {
    return normalized.replace(/\/information(?:\/.*)?$/i, '/information');
  }

  const match = normalized.match(/^(https?:\/\/[^/]+\/[a-z]{2}\/tournament\/\d+)/i);
  return match ? `${match[1]}/information` : normalized;
}

function ensureCalendarAllUrl(value = '') {
  if (!value) return value;
  try {
    const urlObj = new URL(value);
    let pathname = urlObj.pathname.replace(/\/+$/, '');
    if (!/\/all$/i.test(pathname)) {
      urlObj.pathname = `${pathname}/all`;
    }
    return urlObj.toString();
  } catch (e) {
    const [path, search] = String(value || '').split('?');
    const cleanPath = path.replace(/\/+$/, '');
    if (/\/all$/i.test(cleanPath)) return value;
    return search ? `${cleanPath}/all?${search}` : `${cleanPath}/all`;
  }
}

function ensureCalendarCurrentUrl(value = '') {
  return ensureCalendarAllUrl(value); // We always want /all in our app to get all matchdays
}

function stripHtml(value = '') {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function defaultRequestHeaders() {
  return {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml',
    'Accept-Language': 'es-ES,es;q=0.9',
  };
}

function normalizeUrlForCache(url = '') {
  return String(url || '').trim();
}

function extractCsrfToken(html = '') {
  return String(html || '').match(/name="csrf_token"\s+value="([^"]+)"/i)?.[1] || null;
}

function extractSelectedSeason(html = '') {
  const selected = String(html || '').match(/<select[^>]*name="season"[\s\S]*?<option[^>]*value="([^"]*)"[^>]*selected/i)?.[1];
  if (selected) return selected;
  const first = String(html || '').match(/<select[^>]*name="season"[\s\S]*?<option[^>]*value="([^"]*)"/i)?.[1];
  return first || '';
}

function extractSelectedSeasonLabel(html = '') {
  const selectMatch = String(html || '').match(/<select[^>]*name="season"[\s\S]*?>([\s\S]*?)<\/select>/i);
  if (!selectMatch) return null;

  const selectedOption = selectMatch[1].match(/<option[^>]*value="[^"]*"[^>]*selected[^>]*>([\s\S]*?)<\/option>/i)
    || selectMatch[1].match(/<option[^>]*value="[^"]*"[^>]*>([\s\S]*?)<\/option>/i);

  return selectedOption ? stripHtml(selectedOption[1]) : null;
}

function extractAllSeasons(html = '') {
  const selectMatch = String(html || '').match(/<select[^>]*name="season"[\s\S]*?>([\s\S]*?)<\/select>/i);
  if (!selectMatch) return [];
  
  const options = [...selectMatch[1].matchAll(/<option[^>]*value="([^"]*)"[^>]*>([\s\S]*?)<\/option>/gi)];
  return options.map(m => ({
    value: m[1],
    label: stripHtml(m[2])
  })).filter(o => o.value);
}

function getTournamentBaseUrl(inputUrl = '') {
  const absolute = toAbsoluteUrl(inputUrl);
  return absolute.match(/^(https?:\/\/[^/]+\/[a-z]{2}\/tournament\/\d+)/i)?.[1] || '';
}

function extractHtmlFromAjaxData(data) {
  if (typeof data === 'string') return data;
  if (!data || typeof data !== 'object') return String(data || '');

  const queue = [data];
  while (queue.length) {
    const current = queue.shift();
    if (!current || typeof current !== 'object') continue;

    for (const value of Object.values(current)) {
      if (typeof value === 'string' && /<\s*(div|table|tr|td|a|h2)\b/i.test(value)) {
        return value;
      }
      if (value && typeof value === 'object') queue.push(value);
    }
  }

  return JSON.stringify(data);
}

function findSecondaryInputSets(html = '') {
  const matches = [...String(html || '').matchAll(/<div class="ml-secondary-inputs">([\s\S]*?)<\/div>/gi)];
  return matches.map((match) => {
    const fields = [...match[1].matchAll(/<input[^>]*name="([^"]+)"[^>]*value="([^"]*)"/gi)]
      .reduce((acc, inputMatch) => ({
        ...acc,
        [inputMatch[1]]: inputMatch[2],
      }), {});
    return fields;
  }).filter((fields) => Object.keys(fields).length > 0);
}

function extractRoundHeadings(html = '') {
  const dom = parseHTML(String(html || ''));
  return DomUtils.findAll((n) => n.type === 'tag' && n.name === 'h2', dom.children, true)
    .map((node) => getTextContent(node).trim())
    .filter(Boolean);
}

/**
 * Parsea HTML y devuelve array de bloques estructurados.
 * Adicionalmente asocia el heading (h2/h3) previo a cada tabla o bracket
 * como `block.title`, de modo que páginas multi-liga (ej. Liga Alavesa)
 * puedan extraer el nombre real de cada sub-competición.
 */
function parseBlocksFromHtml(html = '') {
  const dom = parseHTML(String(html || ''));
  const body =
    DomUtils.findOne((n) => n.type === 'tag' && n.name === 'body', dom.children) ||
    null;
  const root = body || dom;

  const blocks = [];

  // ── 1. Parseo genérico de bloques (Metadata, Links de fases, etc) ─────────
  if (body) {
    domToBlocks(body, blocks);
  } else {
    (dom.children || []).forEach((child) => domToBlocks(child, blocks));
  }

  // ── 2. Propagar el último heading encontrado antes de cada tabla/bracket ──
  //    Esto permite detectar "Liga Alavesa Juvenil" / "Liga Alavesa Senior" etc.
  let lastHeading = '';
  for (const b of blocks) {
    if (b.type === 'heading') {
      lastHeading = b.content || '';
    } else if ((b.type === 'table' || b.type === 'bracket') && !b.title && lastHeading) {
      b.title = lastHeading;
    }
  }

  // ── 3. Parseo de bracket/eliminatoria (si existe en el DOM) ──────────────
  const bracketData = parseBracketFromDom(root);
  if (bracketData && bracketData.columns && bracketData.columns.length > 0) {
    // Avoid duplicate if already parsed via domToBlocks
    const alreadyHasBracket = blocks.some(b => b.type === 'bracket');
    if (!alreadyHasBracket) {
      blocks.push({ type: 'bracket', ...bracketData });
    }
  }

  return blocks;
}

function parseCalendarBlocksFromAllHtml(html = '') {
  const dom = parseHTML(String(html || ''));
  const calendarRoot = DomUtils.findOne(
    (node) => node.type === 'tag' && node.attribs?.id === 'all-tournament-calendar',
    dom.children,
    true
  );
  const blocks = [];
  if (calendarRoot) domToBlocks(calendarRoot, blocks);
  return blocks;
}

async function fetchAjaxTableHtml(params = {}, referer = '') {
  // Petición AJAX directa a Fedvas (sin proxy, muy rápido ~400ms)
  const start = Date.now();

  try {
    const response = await axios.get(AJAX_URLS.tableSearch, {
      timeout: 15000,
      params: {
        ...params,
        input: params.input ?? '',
      },
      headers: {
        ...defaultRequestHeaders(),
        ...(referer ? { Referer: referer } : {}),
        'X-Requested-With': 'XMLHttpRequest',
        ...(globalSessionCookie ? { Cookie: globalSessionCookie } : {}),
      },
    });

    const elapsed = Date.now() - start;
    const contentLength = response.data?.content?.length || 0;
    

    return extractHtmlFromAjaxData(response.data);
  } catch (error) {
    const elapsed = Date.now() - start;
    throw new Error(`AJAX table-search failed: ${error.message}`);
  }
}

async function fetchTournamentContext(inputUrl = '') {
  const baseUrl = getTournamentBaseUrl(inputUrl);
  if (!baseUrl) {
    return {
      baseUrl: '',
      bankingBaseUrl: toRankingUrl(inputUrl),
      html: '',
      blocks: [],
      seasonLabel: null,
      calendarUrl: null,
      rankingInputs: null,
      rankingGroupId: null,
    };
  }

  const cacheKey = normalizeUrlForCache(baseUrl);
  const cached = tournamentContextCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const pending = tournamentContextInFlight.get(cacheKey);
  if (pending) {
    return pending;
  }

  const start = Date.now();

  const loadContextPromise = (async () => {
    const rankingBaseUrl = `${baseUrl}/ranking`;
    const html = await fetchHTML(rankingBaseUrl);
    const blocks = parseBlocksFromHtml(html);
    const secondaryInputs = findSecondaryInputSets(html);
    const rankingInputs = secondaryInputs.find((fields) => fields.type === '12') || null;
    const rankingGroupId = rankingInputs?.id || null;
    const calendarUrl = discoverCalendarUrlFromHtml(html, rankingBaseUrl);
    const seasonLabel = extractSeasonLabelFromBlocks(blocks) || extractSelectedSeasonLabel(html);

    const context = {
      baseUrl,
      rankingBaseUrl,
      html,
      blocks,
      seasonLabel,
      calendarUrl,
      rankingInputs,
      rankingGroupId,
    };

    const elapsed = Date.now() - start;

    tournamentContextCache.set(cacheKey, context);

    // Pre-warm calendar context in the background so clicking Calendar tab
    // is fast (only the AJAX call needed, ~400ms instead of ~1800ms).
    if (context.calendarUrl) {
      prefetchCalendarContext(context.calendarUrl).catch(() => {});
    }

    return context;
  })();

  tournamentContextInFlight.set(cacheKey, loadContextPromise);

  try {
    return await loadContextPromise;
  } finally {
    if (tournamentContextInFlight.get(cacheKey) === loadContextPromise) {
      tournamentContextInFlight.delete(cacheKey);
    }
  }
}

async function prefetchCalendarContext(calendarUrl = '') {
  if (!calendarUrl) return;
  const currentUrl = ensureCalendarCurrentUrl(calendarUrl);
  const cacheKey = normalizeUrlForCache(currentUrl);
  if (calendarAjaxContextCache.has(cacheKey)) return; // already warm

  const t0 = Date.now();
  try {
    const html = await fetchHTML(currentUrl);
    const secondarySets = findSecondaryInputSets(html);
    const inputs = secondarySets.find((f) => f.type === '9') || null;
    if (inputs?.id) {
      const allBlocks = parseBlocksFromHtml(html);
      const metadataBlocks = allBlocks.filter((b) => b.type !== 'table');
      calendarAjaxContextCache.set(cacheKey, { inputs, metadataBlocks });
    } else {
    }
  } catch (e) {
  }
}

function discoverCalendarUrlFromHtml(html = '', rankingUrl = '') {
  const baseRanking = toRankingUrl(rankingUrl);
  const absoluteAll = html.match(/https?:\/\/[^"'\s]+\/[a-z]{2}\/tournament\/\d+\/calendar\/\d+\/all/i)?.[0];
  if (absoluteAll) return ensureCalendarCurrentUrl(absoluteAll);

  const absolute = html.match(/https?:\/\/[^"'\s]+\/[a-z]{2}\/tournament\/\d+\/calendar\/\d+/i)?.[0];
  if (absolute) return ensureCalendarCurrentUrl(absolute);

  const relativeAll = html.match(/\/[a-z]{2}\/tournament\/\d+\/calendar\/\d+\/all/i)?.[0];
  if (relativeAll) return ensureCalendarCurrentUrl(toAbsoluteUrl(relativeAll));

  const relative = html.match(/\/[a-z]{2}\/tournament\/\d+\/calendar\/\d+/i)?.[0];
  if (relative) return ensureCalendarCurrentUrl(toAbsoluteUrl(relative));

  const rankingGroup = html.match(/\/[a-z]{2}\/tournament\/(\d+)\/ranking\/(\d+)/i);
  if (rankingGroup?.[1] && rankingGroup?.[2]) {
    const locale = baseRanking.match(/https?:\/\/[^/]+\/(\w{2})\//i)?.[1] || 'en';
    return `${BASE_URL}/${locale}/tournament/${rankingGroup[1]}/calendar/${rankingGroup[2]}`;
  }

  return null;
}

function extractSeasonLabelFromBlocks(blocks = []) {
  const textBlock = blocks.find((block) =>
    ['paragraph', 'heading'].includes(block.type) && /\b\d{4}\s*\/\s*\d{4}\b/.test(block.content || '')
  );
  return textBlock?.content?.match(/\d{4}\s*\/\s*\d{4}/)?.[0]?.replace(/\s+/g, '') || null;
}

async function fetchRankingBlocksViaAjax(inputUrl = '') {
  const t0 = Date.now();
  const context = await fetchTournamentContext(inputUrl);
  if (!context.rankingInputs?.id) {
    return context.blocks;
  }

  try {
    const rankingHtml = await fetchAjaxTableHtml({
      ...context.rankingInputs,
      input: '',
    }, context.rankingBaseUrl);

    const ajaxBlocks = parseBlocksFromHtml(rankingHtml);
    const metadataBlocks = context.blocks.filter((block) => block.type !== 'table');
    return [...metadataBlocks, ...ajaxBlocks];
  } catch (error) {
    console.warn('[RANKING] ⚠ AJAX failed, falling back to HTML context:', error.message);
    // Si falla AJAX (ej: CORS en web), devolvemos los bloques que ya teníamos del HTML inicial
    return context.blocks;
  }
}

async function fetchCalendarBlocksViaAjax(inputUrl = '') {
  const t0 = Date.now();
  const currentUrl = ensureCalendarCurrentUrl(inputUrl); // appends /all
  const cacheKey = normalizeUrlForCache(currentUrl);

  // Full-result cache (not just inputs — the whole block array)
  const cached = calendarAjaxContextCache.get(cacheKey);
  if (cached?.fullBlocks) {
    return cached.fullBlocks;
  }

  // Fetch the /all page which already contains every matchday in HTML
  console.log('\n\n[DEBUG CALENDAR] 1. Requesting URL:', currentUrl);
  const allHtml = await fetchHTML(currentUrl);
  console.log('[DEBUG CALENDAR] 2. Received HTML length:', allHtml?.length);
  const allBlocks = parseBlocksFromHtml(allHtml);

  // The /all page has inline tables for every matchday — use them directly.
  // No AJAX needed; we already have the full data.
  const tableBlocks = allBlocks.filter((b) => b.type === 'table');
  const metadataBlocks = allBlocks.filter((b) => b.type !== 'table');
  console.log('[DEBUG CALENDAR] 3. Initial tables found:', tableBlocks.length);


  if (tableBlocks.length > 1) {
    console.log('[DEBUG CALENDAR] 4. Success! Multiple tables found inline. Returning', tableBlocks.length, 'tables.');
    // Great: multiple matchdays already parsed from HTML.
    // We assign titles from previous headings to tables before returning.
    let lastHeading = '';
    for (const b of allBlocks) {
      if (b.type === 'heading') lastHeading = b.content;
      else if (b.type === 'table' && lastHeading) b.title = lastHeading;
    }

    calendarAjaxContextCache.set(cacheKey, { fullBlocks: allBlocks });
    return allBlocks;
  }

  // Fallback: The /all page returned only 1 table. Try the type=9 AJAX endpoint.
  console.log('[DEBUG CALENDAR] 5. Only 1 table found. Attempting AJAX fallback...');
  const secondarySets = findSecondaryInputSets(allHtml);
  const calendarInputs = secondarySets.find((f) => f.type === '9') || null;

  if (!calendarInputs?.id) {
    console.log('[DEBUG CALENDAR] 6. NO inputs found for AJAX fallback! Returning the single table.');
    const fullBlocks = allBlocks;
    calendarAjaxContextCache.set(cacheKey, { fullBlocks });
    return fullBlocks;
  }

  try {
    console.log('[DEBUG CALENDAR] 7. Executing fetchAjaxTableHtml with global Cookie:', !!globalSessionCookie);
    const ajaxHtml = await fetchAjaxTableHtml({ ...calendarInputs, input: '' }, currentUrl);
    console.log('[DEBUG CALENDAR] 8. AJAX response length:', ajaxHtml?.length);
    const ajaxBlocks = parseBlocksFromHtml(ajaxHtml);
    const ajaxTables = ajaxBlocks.filter(b => b.type === 'table');
    console.log('[DEBUG CALENDAR] 9. Tables parsed from AJAX:', ajaxTables.length);
    const fullBlocks = [...metadataBlocks, ...ajaxBlocks];
    calendarAjaxContextCache.set(cacheKey, { fullBlocks });
    return fullBlocks;
  } catch (error) {
    console.error('[CALENDAR] ⚠ AJAX fallback failed:', error.message);
    const fullBlocks = allBlocks;
    calendarAjaxContextCache.set(cacheKey, { fullBlocks });
    return fullBlocks;
  }
}

async function fetchTournamentsBlocksViaAjax(inputUrl = '') {
  const t0 = Date.now();
  const tournamentsUrl = toAbsoluteUrl(inputUrl || URLS.home);
  
  // Extract season from URL if present (e.g. ?season=XXXX)
  const urlObj = new URL(tournamentsUrl);
  const requestedSeason = urlObj.searchParams.get('season');

  const cacheKey = normalizeUrlForCache(tournamentsUrl);

  let context = tournamentsAjaxContextCache.get(cacheKey) || null;
  if (!context) {
    const response = await axios.get(tournamentsUrl, {
      timeout: 15000,
      headers: defaultRequestHeaders(),
    });
    const html = typeof response.data === 'string' ? response.data : String(response.data || '');
    const cookieHeader = (response.headers?.['set-cookie'] || [])
      .map((item) => String(item || '').split(';')[0].trim())
      .filter(Boolean)
      .join('; ');

    context = {
      csrfToken: extractCsrfToken(html),
      season: requestedSeason || extractSelectedSeason(html),
      allSeasons: extractAllSeasons(html),
      contextBlocks: parseBlocksFromHtml(html),
      cookieHeader,
    };
    tournamentsAjaxContextCache.set(cacheKey, context);
  }

  if (!context?.csrfToken) {
    return context?.contextBlocks || [];
  }

  const payload = new URLSearchParams();
  payload.append('csrf_token', context.csrfToken);
  // Priority: 1. URL search param, 2. context default
  const seasonToFetch = requestedSeason || context.season;
  if (seasonToFetch) payload.append('season', seasonToFetch);

  try {
    const response = await axios.post(AJAX_URLS.tournaments, payload.toString(), {
      timeout: 15000,
      headers: {
        ...defaultRequestHeaders(),
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
        Referer: tournamentsUrl,
        Origin: BASE_URL,
        ...(context.cookieHeader ? { Cookie: context.cookieHeader } : {}),
      },
    });

    const ajaxHtml = extractHtmlFromAjaxData(response.data);
    const ajaxBlocks = parseBlocksFromHtml(ajaxHtml);
    const metadataBlocks = (context.contextBlocks || []).filter((block) => block.type !== 'table');
    
    // Inyectamos un bloque especial de metadatos con las temporadas si existen
    const seasonMetadata = context.allSeasons?.length > 0 
      ? [{ type: 'seasons', items: context.allSeasons, current: seasonToFetch }]
      : [];

    return [...seasonMetadata, ...metadataBlocks, ...ajaxBlocks];
  } catch (error) {
    return context.contextBlocks || [];
  }
}

function extractSeasonFromInformationHtml(html = '') {
  if (!html) return null;

  const sectionMatch = html.match(/Temporada\s*<\/div>\s*<div[^>]*>([\s\S]*?)<\/div>/i);
  if (sectionMatch?.[1]) {
    const value = stripHtml(sectionMatch[1]);
    if (value) return value;
  }

  const genericMatch = html.match(/Temporada[^\n\r<]*([12][0-9]{3}\s*\/\s*[12][0-9]{3})/i);
  if (genericMatch?.[1]) {
    return genericMatch[1].replace(/\s+/g, '');
  }

  return null;
}

export async function discoverSeasonLabel(inputUrl = '') {
  const context = await fetchTournamentContext(inputUrl);
  if (context.seasonLabel) return context.seasonLabel;

  // Fallback: try the /information page which usually has "Temporada YYYY/YYYY"
  try {
    const infoUrl = toInfoUrl(inputUrl);
    if (infoUrl) {
      const infoHtml = await fetchHTML(infoUrl);
      const fromInfo = extractSeasonFromInformationHtml(infoHtml);
      if (fromInfo) return fromInfo;
      // Also try extracting from the select on the info page
      const fromSelect = extractSelectedSeasonLabel(infoHtml);
      if (fromSelect) {
        const yearMatch = fromSelect.match(/\b\d{4}\s*\/\s*\d{2,4}\b/);
        return yearMatch ? yearMatch[0].replace(/\s+/g, '') : fromSelect;
      }
    }
  } catch (_) {
    // ignore
  }

  return null;
}

export async function discoverCalendarUrlFromRanking(rankingUrl = '') {
  const context = await fetchTournamentContext(rankingUrl);
  return context.calendarUrl || null;
}

// ─── Tags que se eliminan completamente (con todo su contenido) ───────────────
const REMOVE_TAGS = new Set([
  'style', 'script', 'link', 'meta', 'head',
  'noscript', 'iframe', 'svg', 'canvas', 'form',
  'footer', 'aside',
]);

// ─── Tags de los que solo se extrae el texto plano ──────────────────────────
const INLINE_TAGS = new Set([
  'span', 'strong', 'em', 'b', 'i', 'u', 'small',
  'sup', 'sub', 'abbr', 'cite', 'code',
]);

// ─── Descarga el HTML de una URL y lo devuelve como string ──────────────────
export async function fetchHTML(url) {
  const start = Date.now();
  
  try {
    const response = await axios.get(url, {
      timeout: 15000,
      headers: defaultRequestHeaders(),
    });
    
    const html = typeof response.data === 'string' ? response.data : '';
    
    // Detectar si la temporada se está configurando
    if (
      /esta temporada se est[áa] configurando/i.test(html) ||
      /currently being configured/i.test(html) ||
      /actualmente no existen torneos/i.test(html)
    ) {
      throw new Error('SEASON_CONFIGURING');
    }

    const cookieHeader = (response.headers?.['set-cookie'] || [])
      .map((item) => String(item || '').split(';')[0].trim())
      .filter(Boolean)
      .join('; ');
    if (cookieHeader) {
      globalSessionCookie = cookieHeader;
    }

    const elapsed = Date.now() - start;
    return response.data;
  } catch (error) {
    const elapsed = Date.now() - start;
    if (error.message === 'SEASON_CONFIGURING') throw error;
    throw new Error(`Error descargando ${url}: ${error.message}`);
  }
}

// ─── Parsea el HTML y devuelve el DOM raíz (objetos domhandler) ──────────────
function parseHTML(html) {
  return htmlparser2.parseDocument(html);
}

const getNodeClass = (node) => node?.attribs?.class || '';
const getTextContent = (node) => DomUtils.getText(node).trim();

// ─── UTILS DE PARSEO DE BLOQUES ─────────────────────────────────────────────
function shouldRemoveNode(node) {
  return (
    node.type === 'comment' ||
    (node.type === 'tag' && REMOVE_TAGS.has(node.name))
  );
}

// ─── Extrae el texto limpio de un nodo (recursivo) ───────────────────────────
// export function getTextContent(node) { // Old getTextContent, now using DomUtils.getText
//   if (!node) return '';
//   if (node.type === 'text') return node.data.replace(/\s+/g, ' ').trim();
//   if (node.children) {
//     return node.children
//       .map(getTextContent)
//       .join(' ')
//       .replace(/\s+/g, ' ')
//       .trim();
//   }
//   return '';
// }

// ─── Convierte el DOM en una lista de bloques de contenido estructurado ──────
// Cada bloque tiene: { type, content, level?, href?, rows?, headers? }
export function domToBlocks(node, blocks = []) {
  if (!node || shouldRemoveNode(node)) return blocks;

  if (node.type === 'tag') {
    const tag = node.name;

    // Encabezados
    if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) {
      const text = getTextContent(node).trim();
      if (text.length > 2) {
        blocks.push({
          type: 'heading',
          level: parseInt(tag[1], 10),
          content: text,
        });
      }
      return blocks;
    }

    // Párrafos: extraemos texto pero seguimos recursando para captar links
    if (tag === 'p') {
      const text = getTextContent(node).trim();
      if (text.length > 3) {
        blocks.push({ type: 'paragraph', content: text });
      }
      // NO retornamos, seguimos para ver si hay links importantes dentro
    }

    // Listas: extraemos items pero seguimos recursando para captar links
    if (tag === 'ul' || tag === 'ol') {
      const items = DomUtils.findAll(
        (n) => n.type === 'tag' && n.name === 'li',
        node.children || []
      ).map((li) => getTextContent(li).trim()).filter((t) => t.length > 0);

      if (items.length > 0) {
        blocks.push({ type: 'list', ordered: tag === 'ol', items });
      }
      // NO retornamos, seguimos para ver si hay links importantes dentro
    }

    // Tablas
    if (tag === 'table') {
      const tableBlock = parseTable(node);
      if (tableBlock) blocks.push(tableBlock);
      return blocks;
    }

    // Artículos, divs, nav, header: recursar en hijos
    if (
      ['article', 'section', 'main', 'div', 'body', 'html', 'nav', 'header'].includes(tag) ||
      (node.attribs && (node.attribs.class || node.attribs.id))
    ) {
      (node.children || []).forEach((child) => domToBlocks(child, blocks));
      return blocks;
    }

    // Anclas (links)
    if (tag === 'a') {
      const text = getTextContent(node).trim();
      const href = node.attribs?.href || '';
      const absHref = toAbsoluteUrl(href);
      // Regex más amplia para capturar rutas de torneos independientemente del idioma (/es/ o /en/)
      const isTournamentRoute = /\/(?:es|en)\/tournament\/\d+\/(ranking|calendar|summary|information)(?:\/\d+)?/i.test(absHref) ||
                                /\/tournament\/\d+\/(ranking|calendar|summary|information)(?:\/\d+)?/i.test(absHref);
      
      if ((text.length > 1 || isTournamentRoute) && href && !href.startsWith('#')) {
        blocks.push({
          type: 'link',
          content: text || absHref,
          href: absHref,
        });
      }
      return blocks;
    }

    // Para cualquier otro tag: recursar en hijos
    (node.children || []).forEach((child) => domToBlocks(child, blocks));
  }

  return blocks;
}

// ─── Parsea una tabla HTML y devuelve un bloque tipo 'table' ─────────────────
function parseTable(tableNode) {
  const rows = DomUtils.findAll(
    (n) => n.type === 'tag' && n.name === 'tr',
    tableNode
  );

  if (rows.length === 0) return null;

  // Primera fila como encabezados
  const firstRowCells = DomUtils.findAll(
    (n) => n.type === 'tag' && (n.name === 'th' || n.name === 'td'),
    rows[0]
  );
  const headers = firstRowCells.map((cell) => extractCellText(cell));

  // Exclude player/roster information entirely
  const hStr = headers.join(' ').toLowerCase();
  const isPlayerTable = /(jugador|dorsal\b|altura|año de nac|peso\b)/i.test(hStr) && 
                        !/(local|visitante|jornada|fecha|resultado)/i.test(hStr) &&
                        !/(puntos|partidos|sets)/i.test(hStr);
                        
  if (isPlayerTable) {
    return null;
  }

  // Resto de filas como datos + link de fila (si existe)
  const parsedRows = rows.slice(1).map((row) => {
    const cells = DomUtils.findAll(
      (n) => n.type === 'tag' && (n.name === 'th' || n.name === 'td'),
      row
    );

    const firstLink = DomUtils.findOne(
      (n) => n.type === 'tag' && n.name === 'a' && n.attribs?.href,
      row.children || []
    );
    const href = firstLink?.attribs?.href ? toAbsoluteUrl(firstLink.attribs.href) : null;

    const rowData = {
      cells: cells.map((cell) => extractCellText(cell)),
      href,
      image: extractRowPrimaryImage(row),
    };

    const match = parseMatchRow(row);
    if (match) rowData.match = match;

    return rowData;
  });

  // Filtra filas completamente vacías
  const filteredRows = parsedRows.filter((row) =>
    row.cells.some((cell) => cell.length > 0)
  );

  if (headers.length === 0 && filteredRows.length === 0) return null;

  // Nuevo log para logos cargados
  try {
    // Detectar si la tabla es solo de info/metadata (no partidos ni equipos)
    const infoHeaders = [
      'estado','nombre','modalidad','temporada','categoría','sexo','dirección','organiza','federación','participantes','equipos','grupo','año','registered','start date','end date','category','sport','gender','federation','organizer','teams','group','year'
    ];
    const lowerHeaders = headers.map(h => h.trim().toLowerCase());
    const isInfoTable = lowerHeaders.every(h => infoHeaders.includes(h));
    if (isInfoTable) return {
      type: 'table',
      headers,
      rows: filteredRows.map((r) => r.cells),
      rowLinks: filteredRows.map((r) => r.href),
      rowImages: filteredRows.map((r) => r.image),
      rowLogos: filteredRows.map((r) => r.image),
      matches: filteredRows.map((r) => r.match).filter(Boolean),
    };

    const logos = filteredRows.map((r) => r.image).filter(Boolean);
    let tipo = 'desconocido';
    // Mejor heurística: más palabras clave
    const headersStr = headers.join(' ').toLowerCase();
    if (/jornada|clasificaci[oó]n|equipo|partido|fecha|puntos|local|visitante/.test(headersStr)) tipo = 'liga';
    else if (/grupo|fase|eliminatoria|bracket|semifinal|final|torneo|cuadro|playoff/.test(headersStr)) tipo = 'torneo';
    if (logos.length > 0) {
      console.log(`logos cargados de ${tipo}`);
    } else {
      // Extra debug: muestra headers y todas las celdas de todas las filas
      console.error(`error: no se cargaron logos de ${tipo}`);
      console.error('headers:', headers);
      if (filteredRows.length > 0) {
        filteredRows.forEach((row, idx) => {
          console.error(`fila ${idx}:`, row.cells);
        });
      }
    }
  } catch (e) {
    console.error('error al loguear logos cargados:', e);
  }
  return {
    type: 'table',
    headers,
    rows: filteredRows.map((r) => r.cells),
    rowLinks: filteredRows.map((r) => r.href),
    rowImages: filteredRows.map((r) => r.image),
    rowLogos: filteredRows.map((r) => r.image),
    matches: filteredRows.map((r) => r.match).filter(Boolean),
  };
}

// function getNodeClass(node) { // Moved to global const
//   return (node?.attribs?.class || '').toLowerCase();
// }

function normalizeTeamLogoUrl(url = '') {
  if (!url) return null;

  // Reemplazar siempre el patrón de resolución (ej: .30x30.) por .200x200.
  // Esto aplica para leverade y cualquier otro host, forzando la imagen de alta calidad.
  return url.replace(/\.\d+x\d+(?=\.[a-zA-Z0-9]+(?:[?#].*)?$)/, '.200x200');
}

function extractRowPrimaryImage(rowNode) {
  if (!rowNode) return null;

  const candidates = DomUtils.findAll(
    (n) => n.type === 'tag' && (
      n.name === 'img' || 
      /\b(logo|escudo)\b/i.test(n.attribs?.class || '')
    ),
    rowNode.children || []
  );

  // Removed noisy log

  const urls = candidates
    .map((node) => toAbsoluteUrl(node?.attribs?.src || node?.attribs?.['data-src'] || node?.attribs?.['data-logo'] || ''))
    .map((url) => normalizeTeamLogoUrl(url))
    .filter(Boolean);

  // Removed noisy log

  if (!urls.length) return null;

  const preferred = urls.find((url) =>
    /thumbnail|logo|escudo|team|club|player|jugador|avatar|profile/i.test(url)
  );

  return preferred || urls[0] || null;
}

function parseTeamCell(cellNode) {
  if (!cellNode) return null;

  const titleSpans = DomUtils.findAll(
    (n) => n.type === 'tag' && n.name === 'span' && /\bellipsis\b/i.test(getNodeClass(n)),
    cellNode.children || []
  );

  const names = titleSpans
    .map((n) => n.attribs?.title?.trim() || getTextContent(n).trim())
    .filter(Boolean);

  const logoImgs = DomUtils.findAll(
    (n) => n.type === 'tag' && n.name === 'img',
    cellNode.children || []
  );

  const logos = logoImgs
    .map((img) => toAbsoluteUrl(img?.attribs?.src || img?.attribs?.['data-src'] || ''))
    .map((logoUrl) => normalizeTeamLogoUrl(logoUrl))
    .filter(Boolean);

  if (names.length >= 2) {
    return {
      homeTeam: names[0],
      awayTeam: names[1],
      homeLogo: logos[0] || null,
      awayLogo: logos[1] || null,
    };
  }

  return null;
}

function parsePeriodsCell(cellNode) {
  if (!cellNode) return null;

  // 1. Intentar método clásico (vertical-result/partial-result)
  const verticalResults = DomUtils.findAll(
    (n) => n.type === 'tag' && n.name === 'span' && /\bvertical-result\b/i.test(getNodeClass(n)),
    cellNode.children || []
  );

  let parsedColumns = [];
  if (verticalResults.length) {
    parsedColumns = verticalResults.map((node) => {
      const partials = DomUtils.findAll(
        (n) => n.type === 'tag' && n.name === 'span' && /\bpartial-result\b/i.test(getNodeClass(n)),
        node.children || []
      ).map((n) => {
        const raw = getTextContent(n).replace(/\s+/g, ' ').trim();
        const value = raw.replace(/[-‐‑‒–—―]+/g, '').trim();
        return value || null;
      });
      return {
        home: partials[0] ?? null,
        away: partials[1] ?? null,
      };
    });
  }

  // 2. Fallback: buscar todos los spans o celdas con números tipo set (si no hay verticalResults)
  if (!parsedColumns.length) {
    // Buscar todos los spans o td con dos números (ej: 25 12)
    const setCandidates = DomUtils.findAll(
      (n) => n.type === 'tag' && (n.name === 'span' || n.name === 'td'),
      cellNode.children || [],
      true
    );
    const setRegex = /\b(\d{1,2})\s*[-: ]\s*(\d{1,2})\b/;
    const foundSets = [];
    setCandidates.forEach((n) => {
      const txt = getTextContent(n).replace(/\s+/g, ' ').trim();
      const m = txt.match(setRegex);
      if (m) {
        foundSets.push({ home: m[1], away: m[2] });
      }
    });
    if (foundSets.length) {
      // El primero suele ser el resultado global, el resto los sets
      parsedColumns = foundSets;
    }
  }

  // 3. Construir sets y resultado global
  let sets = parsedColumns.slice(1, 6).map((set, index) => ({
    number: index + 1,
    home: set.home,
    away: set.away,
  }));

  // 4. Fallback: buscar secuencia de números en cualquier celda si no hay sets válidos
  const setsAreEmpty = !sets.length || sets.every(s => (!s.home && !s.away));
  if (setsAreEmpty && cellNode) {
    // Buscar la celda con más números
    const allTexts = DomUtils.findAll(
      (n) => n.type === 'tag' && (n.name === 'td' || n.name === 'span'),
      cellNode.children || [],
      true
    ).map(n => getTextContent(n).replace(/\s+/g, ' ').trim()).filter(Boolean);
    let bestNumbers = [];
    allTexts.forEach(txt => {
      // Buscar secuencia de números (mínimo 4 para 2 sets)
      const nums = txt.match(/\d{1,2}/g);
      if (nums && nums.length > bestNumbers.length && nums.length >= 4) {
        bestNumbers = nums;
      }
    });
    if (bestNumbers.length >= 4) {
      // Agrupar de dos en dos
      sets = [];
      for (let i = 0; i < bestNumbers.length - 1; i += 2) {
        sets.push({
          number: (i / 2) + 1,
          home: bestNumbers[i],
          away: bestNumbers[i + 1],
        });
      }
    }
  }

  return {
    matchScore: parsedColumns[0] || { home: null, away: null },
    sets,
  };
}

function parseDateCell(cellNode) {
  if (!cellNode) return null;

  // Find the outer span inside the td
  const span = DomUtils.findOne((n) => n.type === 'tag' && n.name === 'span', cellNode.children || []);
  if (!span) {
    const fallback = getTextContent(cellNode).trim() || null;
    return { date: fallback, venue: null };
  }

  // Venue is inside a child span — may have class "ellipsis" or NO class at all.
  // Structure: <span>Sáb, 04/10/2025 19:00 GMT+1<span>Aranalde</span></span>
  const venueSpan = DomUtils.findOne(
    (n) => n.type === 'tag' && n.name === 'span',
    span.children || []
  );
  const venue = venueSpan?.attribs?.title?.trim()
    || (venueSpan ? getTextContent(venueSpan).trim() : null)
    || null;

  // Extract ONLY the direct text nodes of the outer span (excludes child span text)
  const directTextParts = (span.children || [])
    .filter((child) => child.type === 'text')
    .map((child) => (child.data || '').trim())
    .filter(Boolean);

  const dateText = directTextParts.join(' ').replace(/\s+/g, ' ').trim();

  // If no direct text found, fallback to full cell text minus venue
  if (!dateText) {
    const fullText = getTextContent(cellNode).trim();
    const venueText = venue || (venueSpan ? getTextContent(venueSpan).trim() : '');
    const cleaned = fullText.replace(venueText, '').replace(/\s+/g, ' ').trim();
    return { date: cleaned || null, venue };
  }

  return {
    date: dateText || null,
    venue,
  };
}

function parseMatchRow(rowNode) {
  // Removed noisy log
  const cells = DomUtils.findAll(
    (n) => n.type === 'tag' && (n.name === 'th' || n.name === 'td'),
    rowNode.children || []
  );

  if (!cells.length) return null;

  const teamCell = cells.find((cell) => /colstyle-equipo/.test(getNodeClass(cell)));
  let periodsCell = cells.find((cell) => /colstyle-parciales/.test(getNodeClass(cell)));
  const dateCell = cells.find((cell) => /colstyle-fecha/.test(getNodeClass(cell)));

  // Removed noisy log

  // --- ADAPTACIÓN TORNEOS: Si no hay periodsCell, buscar la celda con más números ---
  if (!periodsCell) {
    let maxNums = 0;
    let bestCell = null;
    cells.forEach(cell => {
      const txt = getTextContent(cell).replace(/\s+/g, ' ').trim();
      const nums = txt.match(/\d{1,2}/g);
      if (nums && nums.length > maxNums && nums.length >= 4) {
        maxNums = nums.length;
        bestCell = cell;
      }
    });
    if (bestCell) {
      periodsCell = bestCell;
      // Removed noisy log
    }
  }

  const teams = parseTeamCell(teamCell);
  const periods = parsePeriodsCell(periodsCell);
  const dateData = parseDateCell(dateCell);

  // Removed noisy log

  if (!teams || !periods) {
    // Removed noisy log
    return null;
  }

  return {
    ...teams,
    date: dateData?.date || null,
    venue: dateData?.venue || null,
    matchScore: periods.matchScore,
    sets: periods.sets,
  };
}

// ─── Extrae mejor el texto de una celda de tabla ─────────────────────────────
// Casos cubiertos para fedvasvol:
// - celdas con iconos <i title="En curso"> sin texto visible
// - celdas con enlace + <span class="sr-only">Ver</span>
function extractCellText(cellNode) {
  if (!cellNode) return '';

  const raw = getTextContent(cellNode).trim();

  // Título del icono (ej: "En curso", "Configurando")
  const icon = DomUtils.findOne(
    (n) => n.type === 'tag' && n.name === 'i' && n.attribs?.title,
    cellNode.children || []
  );
  const iconTitle = icon?.attribs?.title?.trim() || '';

  // Quita texto auxiliar típico (sr-only)
  const cleaned = raw.replace(/\bVer\b/gi, '').replace(/\s+/g, ' ').trim();

  // Si no hay texto útil pero sí icono con title, usa el title
  if (!cleaned && iconTitle) return iconTitle;

  // Si sólo hay "Ver" y también title, prioriza title
  if (/^ver$/i.test(raw) && iconTitle) return iconTitle;

  return cleaned || iconTitle || '';
}

// ─── Añadido para procesar dinámicamente las pestañas AJAX de un equipo ───
async function fetchTeamContextViaAjax(teamUrl) {
  const currentUrl = toAbsoluteUrl(teamUrl);
  let html = '';
  let cookieHeader = '';

  try {
    const response = await axios.get(currentUrl, {
      timeout: 15000,
      headers: defaultRequestHeaders(),
    });
    html = typeof response.data === 'string' ? response.data : '';
    cookieHeader = (response.headers?.['set-cookie'] || [])
      .map((item) => String(item || '').split(';')[0].trim())
      .filter(Boolean)
      .join('; ');
  } catch(e) {
    if (e.message === 'SEASON_CONFIGURING') throw e;
    console.error('Error en carga inicial de equipo:', e.message);
    return [];
  }

  const initialBlocks = parseBlocksFromHtml(html);

  const csrfMatch = html.match(/name="csrf_token"\s+value="([^"]+)"/i);
  const csrf = csrfMatch ? csrfMatch[1] : null;
  const baseUrlMatch = currentUrl.match(/^(https?:\/\/[^\/]+)/i);
  const siteBase = baseUrlMatch ? baseUrlMatch[1] : BASE_URL;
  const langMatch = currentUrl.match(/https?:\/\/[^\/]+\/([a-z]{2})/i);
  const lang = langMatch ? langMatch[1] : 'es';

  if (!csrf) return initialBlocks;

  const mId = currentUrl.match(/\/team\/(\d+)/i)?.[1];
  if (!mId) return initialBlocks;

  const tabsToFetch = ['upcoming-matches', 'last-results', 'stats', 'information'];
  
  const extraHtmlPromises = tabsToFetch.map(async (tab) => {
    try {
      const resp = await axios.post(
        `${siteBase}/${lang}/ajax/team/${mId}/change-tab`,
        `csrf_token=${csrf}&tab=${tab}`,
        {
          headers: {
            ...defaultRequestHeaders(),
            'X-Requested-With': 'XMLHttpRequest',
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'Cookie': cookieHeader,
          },
          timeout: 10000,
        }
      );
      return resp.data?.content || resp.data?.html || '';
    } catch (err) {
      console.warn(`[WARN] No se pudo cargar pestaña de equipo AJAX ${tab}: ${err.message}`);
      return '';
    }
  });

  const rawTabs = await Promise.all(extraHtmlPromises);
  const extraHtml = rawTabs.join('\n\n<br>\n\n');
  const extraBlocks = parseBlocksFromHtml(extraHtml);

  return [...initialBlocks, ...extraBlocks];
}

// ─── Función principal: URL → array de bloques listos para renderizar ─────────
export async function fetchAndParse(url) {
  const t0 = Date.now();
  const absoluteUrl = toAbsoluteUrl(url);
  let blocks;

  if (/\/tournaments/i.test(absoluteUrl)) {
    blocks = await fetchTournamentsBlocksViaAjax(absoluteUrl);
  } else if (/\/tournament\/\d+\/ranking/i.test(absoluteUrl)) {
    // SOLO HTML: NO AJAX PARA TORNEOS
    const html = await fetchHTML(absoluteUrl);
    blocks = parseBlocksFromHtml(html);
  } else if (/\/tournament\/\d+\/calendar\/\d+/i.test(absoluteUrl)) {
    blocks = await fetchCalendarBlocksViaAjax(absoluteUrl);
  } else if (/\/team\/\d+/i.test(absoluteUrl)) {
    // Carga de equipo mediante peticiones AJAX combinadas simulando Vue
    blocks = await fetchTeamContextViaAjax(absoluteUrl);
  } else {
    const html = await fetchHTML(absoluteUrl);
    blocks = parseBlocksFromHtml(html);
    // Si no se extrajo ningún partido válido, intenta el parser específico
    const hasValidMatch = blocks.some(b => b.type === 'table' && Array.isArray(b.matches) && b.matches.length > 0);
    if (!hasValidMatch) {
      const matches = parseTournamentMatchDetail(html);
      if (matches.length > 0) {
        console.log('[fetchAndParse] Parser torneo devolvió:', JSON.stringify(matches));
        blocks.push({ type: 'table', matches });
      } else {
        console.log('[fetchAndParse] Parser torneo no devolvió ningún partido válido');
      }
    }
  }

  // Elimina bloques duplicados consecutivos
  const result = blocks.filter((block, i) => {
    if (i === 0) return true;
    const prev = blocks[i - 1];
    if (block.type === block.type && block.content === prev.content && block.content !== undefined) return false;
    return true;
  });

  return result;
}

// ─── UTILS PARA CAMPEONATOS (TXAPELKETAS) ───────────────────────────────────

/**
 * Extrae enlaces a fases/grupos de la página de clasificación.
 */
export function extractPhaseLinks(blocks = [], currentUrl = '') {
  const links = (blocks || []).filter(b => b.type === 'link');
  // Atrapa tanto /ranking/ID como /ranking/ID/algo
  // Pero excluimos enlaces que parezcan navegación general (login, home, etc)
  const phasePattern = /\/tournament\/\d+\/ranking\/\d+/i;
  
  const normalizedCurrent = toAbsoluteUrl(currentUrl).replace(/\/$/, '').toLowerCase();
  
  const seenHrefs = new Set([normalizedCurrent]);
  const uniquePhases = [];

  links.forEach(l => {
    if (!l.href) return;
    const absHref = toAbsoluteUrl(l.href);
    if (!phasePattern.test(absHref) || /google|facebook|export|print|xls|pdf/i.test(absHref) || /exportar|imprimir/i.test(l.content || '')) return;
    
    const norm = absHref.replace(/\/$/, '').toLowerCase();
    if (!seenHrefs.has(norm)) {
      seenHrefs.add(norm);
      uniquePhases.push({
        title: l.content || 'Fase',
        href: absHref
      });
    }
  });

  return uniquePhases;
}

/**
 * Devuelve TODAS las fases (incluyendo la actual identificada heurísticamente)
 */
export function extractAllPhases(url = '', html = '', blocks = []) {
  const currentTitle = guessPhaseTitle(url, html);
  const otherPhases = extractPhaseLinks(blocks, url);
  
  // normalizar urls
  const currentUrlNorm = toAbsoluteUrl(url).replace(/\/$/, '').toLowerCase();
  
  // Limpiar posibles duplicados
  const otherPhasesCleaned = otherPhases.filter(p => toAbsoluteUrl(p.href).replace(/\/$/, '').toLowerCase() !== currentUrlNorm);

  // Si no hay enlaces a otras fases, detectamos si la PÁGINA ACTUAL tiene múltiples
  // bloques independientes (tablas o brackets = sub-competiciones).
  const subgroupEntities = (blocks || []).filter(b =>
    (b.type === 'table' && b.rows?.length > 0) || b.type === 'bracket'
  );

  if (otherPhasesCleaned.length === 0 && subgroupEntities.length > 1) {
    // Cada entidad se convierte en una "fase virtual", usando su title extraído
    // del h2/h3 previo (ya propagado por parseBlocksFromHtml).
    let groupCount = 0;
    let playoffCount = 0;
    const NOISE_RE = /Imprimir\s+(clasificaci[oó]n|eliminatoria)\s+de\s+/i;
    const ELLIPSIS_RE = /[…\.]{2,}/g;

    return subgroupEntities.map((entity, index) => {
      let title = (entity.title || '').replace(NOISE_RE, '').replace(ELLIPSIS_RE, '').trim();

      // Si no hay título real, generar uno descriptivo
      if (!title) {
        if (entity.type === 'bracket') {
          playoffCount++;
          title = playoffCount === 1 ? 'Playoffs de ascenso' : `Playoffs (${playoffCount})`;
        } else {
          groupCount++;
          title = groupCount === 1 ? 'Grupo A' : groupCount === 2 ? 'Grupo B' : `Grupo ${String.fromCharCode(64 + groupCount)}`;
        }
      }

      return {
        title,
        href: `${url}#phase-${index}`,
        isBracket: entity.type === 'bracket',
        phaseIndex: index,
      };
    });
  }

  if (otherPhasesCleaned.length > 0) {
    return [{ title: currentTitle, href: url }, ...otherPhasesCleaned];
  }

  return [{ title: currentTitle, href: url }];
}

export async function discoverAllPhases(url) {
  try {
    const html = await fetchHTML(url);
    const blocks = parseBlocksFromHtml(html);
    return extractAllPhases(url, html, blocks);
  } catch (e) {
    return [{ title: 'Liga', href: url }];
  }
}

/**
 * Descarga y parsea todos los datos de un campeonato (Txapelketa) de forma unificada.
 * Utiliza scraping HTML directo (sin AJAX) para evitar problemas de CORS y AJAX.
 */
export async function fetchChampionshipData(rankingUrl) {
  const cacheKey = normalizeUrlForCache(rankingUrl);
  const cached = championshipDataCache.get(cacheKey);
  if (cached) {
    const isExpired = (Date.now() - (cached.cachedAt || 0)) > CHAMPIONSHIP_CACHE_TTL_MS;
    if (!isExpired && cached.data) return cached.data;
  }

  // ── Paso 1: Obtener el HTML de la primera fase ──
  const absoluteUrl = toAbsoluteUrl(rankingUrl);
  const firstHtml = await fetchHTML(absoluteUrl);
  const firstBlocks = parseBlocksFromHtml(firstHtml);

  // ── Paso 2: Extraer los enlaces a todas las demás fases ──
  const phases = extractPhaseLinks(firstBlocks, absoluteUrl);
  const normalizedCurrent = absoluteUrl.replace(/\/$/, '').toLowerCase();

  // Siempre incluir la primera fase (la que ya tenemos)
  const firstTitle = guessPhaseTitle(absoluteUrl, firstHtml);
  const allPhaseUrls = [{ title: firstTitle, href: absoluteUrl, blocks: firstBlocks }];

  // ── Paso 3: Descargar cada fase en paralelo ──
  const otherPhaseData = await Promise.all(
    phases.map(async (p) => {
      try {
        const normP = toAbsoluteUrl(p.href).replace(/\/$/, '').toLowerCase();
        if (normP === normalizedCurrent) return null; // Evitar duplicar la actual

        const html = await fetchHTML(p.href);
        const blocks = parseBlocksFromHtml(html);
        return { title: p.title, href: p.href, blocks };
      } catch (err) {
        console.warn(`[CHAMPIONSHIP] Error fetching phase ${p.title}:`, err.message);
        return null;
      }
    })
  );

  const phaseData = [...allPhaseUrls, ...otherPhaseData.filter(Boolean)];

  // ── Paso 4: Clasificar fases ─────────────────────────────────────────────────
  const placementPatterns = [/puestos?/i, /\d+\s*[ºo°]\s*y\s*\d/i];

  const mainFlow = [];
  const placementFlow = [];

  // SOLO PARTIDOS DE BRACKET O CALENDARIO EN TORNEOS
  phaseData.forEach(p => {
    const title = (p.title || '').toLowerCase();
    const isPlacement = placementPatterns.some(re => re.test(title));
    // Buscar bloques tipo bracket, calendar, o tablas que tengan partidos (playoffs mostrados como tabla)
    const hasMatchData = p.blocks && p.blocks.some(b => b.type === 'bracket' || b.type === 'calendar' || (b.type === 'table' && Array.isArray(b.matches) && b.matches.length > 0));
    if (hasMatchData || p.href === absoluteUrl) {
      if (isPlacement) {
        placementFlow.push(p);
      } else {
        mainFlow.push(p);
      }
    }
  });

  // ── Paso 5: Ordenar el flujo principal cronológicamente (Grupos → Semis → Final) ──
  const getWeight = (t) => {
    const lower = (t || '').toLowerCase();
    if (/final/.test(lower) && !/semi/.test(lower)) return 100;
    if (/semi/.test(lower)) return 80;
    if (/cuartos/.test(lower)) return 60;
    if (/octavos/.test(lower)) return 40;
    if (/grupo\s*a/.test(lower)) return 10;
    if (/grupo\s*b/.test(lower)) return 11;
    if (/grupo/.test(lower)) return 15;
    return 20;
  };
  mainFlow.sort((a, b) => getWeight(a.title) - getWeight(b.title));

  const result = { mainFlow, placements: placementFlow };
  championshipDataCache.set(cacheKey, { data: result, cachedAt: Date.now() });
  return result;
}

/**
 * Intenta adivinar el título de la primera fase a partir de la URL o el HTML.
 */
function guessPhaseTitle(url = '', html = '') {
  const dom = parseHTML(html);
  const normalizedUrl = toAbsoluteUrl(url).replace(/\/$/, '').toLowerCase();

  // 1. Check for any active element inside a tab or pill structure
  const activeTabs = DomUtils.findAll(n => n.type === 'tag' && /\b(active|selected|current)\b/i.test(n.attribs?.class || ''), dom.children || [], true);
  for (const tab of activeTabs) {
    const text = getTextContent(tab).replace(/\s+/g, ' ').trim();
    if (text.length > 0 && text.length < 40 && !/clasificaci|calendar|informaci|inicio|home|seleccionar|competiciones|competición/i.test(text)) {
      return text;
    }
  }

  // 2. Intentar encontrar el ancla que apunta a la URL actual
  const allLinks = DomUtils.findAll(n => n.type === 'tag' && n.name === 'a', dom.children || [], true);
  const matchTab = allLinks.find(n => toAbsoluteUrl(n.attribs?.href || '').replace(/\/$/, '').toLowerCase() === normalizedUrl);
  if (matchTab) {
    const text = getTextContent(matchTab).trim();
    if (text.length > 1 && text.length < 50) return text;
  }

  // 3. Fallback: Buscar un h1 descriptivo (que no sea el nombre de navegacion standard)
  const h1 = DomUtils.findOne(n => n.type === 'tag' && n.name === 'h1', dom.children || [], true);
  if (h1) {
    const text = getTextContent(h1)
      .replace(/clasificaci[oó]n/i, '')
      .replace(/calendar[ií]o/i, '')
      .trim();
    if (text.length > 1 && text.length < 50 && !/seleccionar|competiciones|competición/i.test(text)) {
      return text;
    }
  }

  // 4. Último fallback: Si encontramos las palabras "Grupo A" en el texto, usamos eso.
  const allText = getTextContent(dom);
  if (/\bgrupo\s+a\b/i.test(allText)) {
     return 'Grupo A';
  }

  return 'Fase Regular';
}


/**
 * Extrae información detallada del torneo desde la página /information.
 */
export async function fetchInfoData(infoUrl) {
  const cacheKey = normalizeUrlForCache(infoUrl);
  if (infoDataCache.has(cacheKey)) return infoDataCache.get(cacheKey);

  const html = await fetchHTML(infoUrl);
  const dom = parseHTML(html);
  
  const results = [];
  
  // 1. Búsqueda por estructura de rejilla (div.text-light-gray para etiquetas)
  const infoCols = DomUtils.findAll(
    (n) => n.type === 'tag' && (
      /text-light-gray/i.test(getNodeClass(n)) || 
      n.name === 'strong'
    ),
    dom.children,
    true
  );

  infoCols.forEach(labelNode => {
    const labelStr = getTextContent(labelNode).replace(/:$/, '').trim();
    if (!labelStr) return;

    // El valor suele ser el siguiente nodo de texto o el siguiente <div> hermano
    let valueStr = '';
    
    // Si el labelNode es un strong dentro de un div, buscamos en el div hermano
    if (labelNode.name === 'strong') {
      const parentCol = DomUtils.findOne(n => /col-/i.test(getNodeClass(n)), [labelNode], true);
      if (parentCol) {
        let nextCol = parentCol.next;
        while (nextCol && (nextCol.type !== 'tag' || !/col-/i.test(getNodeClass(nextCol)))) {
          nextCol = nextCol.next;
        }
        if (nextCol) valueStr = getTextContent(nextCol).trim();
      }
    } else {
      // Si es un div.text-light-gray, el valor es el siguiente col hermano
      let nextCol = labelNode.next;
      while (nextCol && (nextCol.type !== 'tag' || !/col-/i.test(getNodeClass(nextCol)))) {
        nextCol = nextCol.next;
      }
      if (nextCol) valueStr = getTextContent(nextCol).trim();
    }

    if (labelStr && valueStr && !results.some(r => r.label.toLowerCase() === labelStr.toLowerCase())) {
      // Evitar meter labels que son solo decorativas o vacías
      if (labelStr.length > 2 && !labelStr.includes('fa-circle')) {
        results.push({ label: labelStr, value: valueStr });
      }
    }
  });

  // 2. Búsqueda agresiva por texto de etiquetas conocidas
  const allTexts = DomUtils.findAll((n) => n.type === 'text', dom.children, true);
  const labelsToSearch = [
    'Name', 'Season', 'Category', 'Sport', 'Gender', 'Start date', 'End date', 'Federation', 'Organizer', 'Teams', 'Registered', 'Group',
    'Nombre', 'Temporada', 'Categoría', 'Deporte', 'Sexo', 'Fecha inicio', 'Fecha fin', 'Género', 'Federación', 'Organiza', 'Equipos', 'Inscritos', 'Año', 'Grupo', 'Participantes'
  ];

  allTexts.forEach(tNode => {
    const text = tNode.data.trim();
    if (!text) return;

    const labelMatch = labelsToSearch.find(l => text.toLowerCase().startsWith(l.toLowerCase()));
    if (labelMatch) {
      const label = text.split(':')[0].trim();
      let value = '';
      if (text.includes(':')) {
        value = text.substring(text.indexOf(':') + 1).trim();
      }
      
      if (!value) {
        let next = tNode.next;
        while (next && !value) {
          const val = getTextContent(next).trim();
          if (val) value = val;
          next = next.next;
        }
      }

      if (label && value && !results.some(r => r.label.toLowerCase() === label.toLowerCase())) {
        results.push({ label, value });
      }
    }
  });

  infoDataCache.set(cacheKey, results);
  return results;
}

/**
 * Parsea una estructura de Bracket/Eliminatoria desde el DOM.
 */
function parseBracketFromDom(dom) {
  const columns = [];
  const searchRoot = dom.children || [];
  
  // Buscar contenedores de columnas (Clupik fullscreen usa bracket-column, otros usan bracket)
  let colNodes = DomUtils.findAll(
    (n) => n.type === 'tag' && /\bbracket-column\b/i.test(n.attribs?.class || ''),
    searchRoot,
    true
  );

  if (colNodes.length === 0) {
    colNodes = DomUtils.findAll(
      (n) => n.type === 'tag' && /\bbracket\b/i.test(n.attribs?.class || ''),
      searchRoot,
      true
    );
  }

  if (colNodes.length === 0) {
    // Fallback 1: Buscar contenedores genéricos con muchos match-boxes
    const allMatches = findMatchBoxes(searchRoot);
    if (allMatches.length >= 2) {
      // Agrupar matches por fase (cuartos, semis, final)
      const phaseMap = new Map();
      allMatches.forEach(m => {
        const ph = m.phase || '';
        if (!phaseMap.has(ph)) phaseMap.set(ph, []);
        phaseMap.get(ph).push(m);
      });
      
      const cols = Array.from(phaseMap.entries()).map(([ph, arr]) => ({
        header: ph,
        matches: arr
      }));
      
      // Intentar ordenar cronológicamente
      const getWeight = (t) => {
        const lower = (t || '').toLowerCase();
        if (/final/.test(lower) && !/semi/.test(lower)) return 100;
        if (/semi/.test(lower)) return 80;
        if (/cuartos/.test(lower)) return 60;
        if (/octavos/.test(lower)) return 40;
        return 10;
      };
      cols.sort((a, b) => getWeight(a.header) - getWeight(b.header));
      
      return { columns: cols };
    }
    // Fallback 2: Si hay al menos un partido (ej: Final), lo damos como bueno
    if (allMatches.length === 1) {
      return { columns: [{ header: 'Final', matches: allMatches }] };
    }
    return null;
  }

  colNodes.forEach(colNode => {
    // Buscar cabecera de ronda
    const headerNode = DomUtils.findOne(n => /\bbracket-header\b/i.test(n.attribs?.class || ''), [colNode], true);
    let header = headerNode ? getTextContent(headerNode) : '';
    
    const matches = findMatchBoxes([colNode]);

    // Si no hay cabecera explícita, buscar en la primera caja del bracket (bracket-data)
    if (!header && matches.length > 0) {
      const firstMatchNode = DomUtils.findOne(
        (n) => n.type === 'tag' && /\b(match-box|box)\b/.test(n.attribs?.class || ''),
        [colNode],
        true
      );
      if (firstMatchNode) {
        const dataNode = DomUtils.findOne(n => /\bbracket-data\b/i.test(n.attribs?.class || ''), [firstMatchNode], true);
        if (dataNode) header = getTextContent(dataNode);
      }
    }

    if (matches.length > 0) {
      columns.push({ header, matches });
    }
  });

  return columns.length > 0 ? { columns } : null;
}

/**
 * Helper para encontrar cajas de partidos dentro de un nodo o array de nodos.
 * La estructura Clupik es:
 *   div.match-box
 *     a.team (x2)        -> logo img + span nombre
 *     a.match            -> span score1 + span score2
 *     a.next-match       -> fecha/hora
 */
function findMatchBoxes(rootOrArray) {
  const matches = [];
  const searchIn = Array.isArray(rootOrArray) ? rootOrArray : (rootOrArray.children || [rootOrArray]);

  const matchNodes = DomUtils.findAll(
    (n) => {
      if (n.type !== 'tag') return false;
      const cls = (n.attribs?.class || '').toLowerCase();
      const style = n.attribs?.style || '';
      
      // 1. Clase explícita de Clupik
      if (/\b(match-box|box|match-data|bracket-data)\b/.test(cls)) return true;
      
      // 2. Heurística de contenido: 2 enlaces a equipo + 1 enlace a partido
      const links = DomUtils.findAll(c => c.name === 'a', [n], true);
      const teamLinks = links.filter(l => /\b(team|equipo)\b/i.test(l.attribs?.class || '') || /\/team\//i.test(l.attribs?.href || ''));
      const matchLinks = links.filter(l => /\bmatch\b/i.test(l.attribs?.class || '') || /\/match\//i.test(l.attribs?.href || ''));
      
      if (teamLinks.length === 2 && matchLinks.length >= 1) return true;

      // 3. Nodos con data-match
      if (n.attribs?.['data-match']) return true;

      return false;
    },
    searchIn,
    true
  );

  matchNodes.forEach(mNode => {
    const hasNestedMatch = DomUtils.findOne(n => n !== mNode && matchNodes.includes(n), [mNode], true);
    if (hasNestedMatch) return;

    // Equipos: links con clase 'team/equipo', data-team, o ruta /team/
    const teamNodes = DomUtils.findAll(
      n => n.type === 'tag' && n.name === 'a' && (
        /\b(team|equipo|club)\b/i.test(n.attribs?.class || '') || 
        /\/team\//i.test(n.attribs?.href || '') ||
        'data-team' in (n.attribs || {})
      ),
      [mNode],
      true
    );

    // Marcador: links con clase 'match', data-match, o ruta /match/
    const matchLinkNode = DomUtils.findOne(
      n => n.type === 'tag' && n.name === 'a' && (
        /\bmatch\b/i.test(n.attribs?.class || '') || 
        /\/match\//i.test(n.attribs?.href || '') ||
        'data-match' in (n.attribs || {})
      ) && !/\b(team|equipo|club)\b/i.test(n.attribs?.class || ''),
      [mNode],
      true
    );

    // Fecha: clase 'next-match' o 'date/time'
    const scheduleNode = DomUtils.findOne(
      n => n.type === 'tag' && (/\b(next-match|match-schedule)\b/.test(n.attribs?.class || '')),
      [mNode],
      true
    );

    const homeTeamNode = teamNodes[0];
    const awayTeamNode = teamNodes[1];

    if (!homeTeamNode && !awayTeamNode && !matchLinkNode) return;

    const getTeamName = (node) => {
      if (!node) return 'TBD';
      // Prioridad 1: el span nombre o clase name/nombre
      const span = DomUtils.findOne(n => n.name === 'span' || /\b(name|nombre)\b/i.test(n.attribs?.class || ''), [node], true);
      const text = (span ? getTextContent(span) : getTextContent(node)).trim();
      if (text && text.length > 1) return text;
      // Prioridad 2: data-team
      if (node.attribs?.['data-team']) return node.attribs['data-team'];
      return 'TBD';
    };

    const getLogo = (node) => {
      if (!node) return '';
      const img = DomUtils.findOne(n => n.name === 'img' || /\b(logo|escudo)\b/i.test(n.attribs?.class || ''), [node], true);
      return img?.attribs?.src || img?.attribs?.['data-src'] || img?.attribs?.['data-logo'] || '';
    };

    const homeTeam = getTeamName(homeTeamNode);
    const awayTeam = getTeamName(awayTeamNode);
    const homeLogo = getLogo(homeTeamNode);
    const awayLogo = getLogo(awayTeamNode);

    let scoreText = '- -';
    if (matchLinkNode) {
      const scoreSpans = DomUtils.findAll(n => n.name === 'span' || /\b(result|score)\b/i.test(n.attribs?.class || ''), [matchLinkNode], true);
      const vals = scoreSpans
        .map(s => getTextContent(s).replace(/\s+/g, '').replace(/[‐\-–—]/g, '-'))
        .filter(s => s === '-' || /^\d+$/.test(s));
      
      if (vals.length >= 2) scoreText = `${vals[0]} - ${vals[1]}`;
      else if (vals.length === 1) scoreText = vals[0];
      else {
        const rawText = getTextContent(matchLinkNode).trim();
        if (rawText && rawText.length < 15 && /[\d\-]/.test(rawText)) scoreText = rawText;
      }
    }


    // --- EXTRACCIÓN ROBUSTA DE FASE, FECHA Y SEDE ---
    let phase = '';
    let dateTime = '';
    let venue = '';
    // Buscar en ancestros .bracket-data y .round-header y .next-match
    let parent = mNode.parent;
    while (parent) {
      if (!phase && parent.attribs && /bracket-data/.test(parent.attribs.class || '')) {
        phase = getTextContent(parent).replace(/\s+/g, ' ').trim();
      }
      if (!phase && parent.attribs && /round-header/.test(parent.attribs.class || '')) {
        phase = getTextContent(parent).replace(/\s+/g, ' ').trim();
      }
      // Buscar fecha/sede en .next-match o en el texto de .bracket-data
      if (!dateTime || !venue) {
        const nextMatch = DomUtils.findOne(
          n => n.type === 'tag' && /next-match/.test(n.attribs?.class || ''),
          [parent],
          true
        );
        if (nextMatch) {
          const txt = getTextContent(nextMatch).replace(/\s+/g, ' ').trim();
          const m = txt.match(/(\d{1,2}\/\d{1,2}(?:\/\d{2,4})? ?\d{0,2}:?\d{0,2})?\s*[·•]?\s*(.*)/);
          if (m) {
            if (m[1]) dateTime = m[1].trim();
            if (m[2]) venue = m[2].trim();
          } else {
            dateTime = txt;
          }
        }
        if (!venue && parent.attribs && /bracket-data/.test(parent.attribs.class || '')) {
          const txt = getTextContent(parent).replace(/\s+/g, ' ').trim();
          const m = txt.match(/(\d{1,2}\/\d{1,2}(?:\/\d{2,4})? ?\d{0,2}:?\d{0,2})?\s*[·•]?\s*(.*)/);
          if (m) {
            if (!dateTime && m[1]) dateTime = m[1].trim();
            if (m[2]) venue = m[2].trim();
          }
        }
      }
      parent = parent.parent;
    }
    // Buscar en hermanos siguientes .bracket-data o .next-match si sigue sin datos
    let sibling = mNode.next;
    while (sibling) {
      if (!phase && sibling.attribs && /bracket-data/.test(sibling.attribs.class || '')) {
        phase = getTextContent(sibling).replace(/\s+/g, ' ').trim();
      }
      if ((!dateTime || !venue) && sibling.attribs && /next-match/.test(sibling.attribs.class || '')) {
        const txt = getTextContent(sibling).replace(/\s+/g, ' ').trim();
        const m = txt.match(/(\d{1,2}\/\d{1,2}(?:\/\d{2,4})? ?\d{0,2}:?\d{0,2})?\s*[·•]?\s*(.*)/);
        if (m) {
          if (m[1]) dateTime = m[1].trim();
          if (m[2]) venue = m[2].trim();
        } else {
          dateTime = txt;
        }
      }
      sibling = sibling.next;
    }
    // Si sigue sin datos, buscar en el propio mNode (por compatibilidad)
    if (!phase) {
      const bracketDataNode = DomUtils.findOne(
        n => n.type === 'tag' && /bracket-data/.test(n.attribs?.class || ''),
        [mNode],
        true
      );
      if (bracketDataNode) {
        phase = getTextContent(bracketDataNode).replace(/\s+/g, ' ').trim();
      }
    }
    if ((!dateTime || !venue) && scheduleNode) {
      const txt = getTextContent(scheduleNode).replace(/\s+/g, ' ').trim();
      const m = txt.match(/(\d{1,2}\/\d{1,2}(?:\/\d{2,4})? ?\d{0,2}:?\d{0,2})?\s*[·•]?\s*(.*)/);
      if (m) {
        if (m[1]) dateTime = m[1].trim();
        if (m[2]) venue = m[2].trim();
      } else {
        dateTime = txt;
      }
    }

    // Forzar logo 200x200
    const fixLogo = url => url ? url.replace(/\.\d+x\d+(?=\.[a-zA-Z0-9]+(?:[?#].*)?$)/, '.200x200') : null;

    // Extraer sets de <span class="partial"><span>home</span><span>away</span></span>
    const setNodes = DomUtils.findAll(
      n => n.type === 'tag' && n.name === 'span' && /partial/.test(n.attribs?.class || ''),
      [mNode],
      true
    );
    const sets = setNodes.map(sn => {
      const nums = DomUtils.findAll(
        n => n.type === 'tag' && n.name === 'span',
        sn.children || [],
        false
      ).map(s => getTextContent(s).replace(/\D+/g, '')).filter(Boolean);
      return nums.length === 2 ? { home: nums[0], away: nums[1] } : null;
    }).filter(Boolean);

    // --- DETECCIÓN DE ESTADO "LIVE"/"EN CURSO" ---
    let state = undefined;
    // 1. Buscar iconos <i title="En curso"> o similares
    const liveIcon = DomUtils.findOne(
      n => n.type === 'tag' && n.name === 'i' && n.attribs && (
        /en\s*curso|en\s*juego|live|directo|in\s*play|in\s*progress/i.test(n.attribs.title || '') ||
        /fa[- ]?bolt|fa[- ]?play|icon[- ]?live|icono[- ]?live/.test(n.attribs.class || '')
      ),
      [mNode],
      true
    );
    // 2. Buscar clases "live", "en-curso", etc. en el propio nodo o descendientes
    const hasLiveClass = (node) => {
      if (!node || !node.attribs) return false;
      return /\blive\b|en[-_]?curso|en[-_]?juego|directo|in[-_]?play|in[-_]?progress/i.test(node.attribs.class || '');
    };
    let foundLiveClass = hasLiveClass(mNode);
    if (!foundLiveClass) {
      DomUtils.findAll(
        n => n.type === 'tag' && hasLiveClass(n),
        [mNode],
        true
      ).forEach(() => { foundLiveClass = true; });
    }
    // 3. Buscar texto visible "En curso", "En juego", "Directo", etc.
    const textContent = getTextContent(mNode).toLowerCase();
    const foundLiveText = /en\s*curso|en\s*juego|directo|live|in\s*play|in\s*progress/.test(textContent);

    if (liveIcon || foundLiveClass || foundLiveText) {
      state = 'live';
    }

    matches.push({
      title: phase,
      phase,
      homeTeam,
      awayTeam,
      homeLogo: fixLogo(toAbsoluteUrl(homeLogo)),
      awayLogo: fixLogo(toAbsoluteUrl(awayLogo)),
      scoreText,
      href: toAbsoluteUrl(matchLinkNode?.attribs?.href || scheduleNode?.attribs?.href || ''),
      dateTime,
      venue,
      sets: sets.length ? sets : undefined,
      ...(state ? { state } : {}),
    });
  });

  return matches;
}
