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

// ─── Helpers de URL ─────────────────────────────────────────────────────────
export function toAbsoluteUrl(href = '') {
  if (!href || typeof href !== 'string') return '';
  if (/^https?:\/\//i.test(href)) return href;
  return `${BASE_URL}${href.startsWith('/') ? href : `/${href}`}`;
}

export function toTournamentRankingUrl(inputUrl = '') {
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

export function toTournamentInformationUrl(inputUrl = '') {
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
  const clean = String(value || '').replace(/\/+$/, '');
  if (/\/calendar\/\d+\/all$/i.test(clean)) return clean;
  if (/\/calendar\/\d+$/i.test(clean)) return `${clean}/all`;
  return clean;
}

function ensureCalendarCurrentUrl(value = '') {
  if (!value) return value;
  const clean = String(value || '').replace(/\/+$/, '');
  if (/\/all$/i.test(clean)) return clean;
  return `${clean}/all`;
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
      'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/120 Mobile Safari/537.36',
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

function parseBlocksFromHtml(html = '') {
  const dom = parseHTML(String(html || ''));
  const body =
    DomUtils.findOne((n) => n.type === 'tag' && n.name === 'body', dom.children) ||
    null;

  if (body) return domToBlocks(body);

  const blocks = [];
  (dom.children || []).forEach((child) => domToBlocks(child, blocks));
  return blocks;
}

function parseCalendarBlocksFromAllHtml(html = '') {
  const dom = parseHTML(String(html || ''));
  const calendarRoot = DomUtils.findOne(
    (node) => node.type === 'tag' && node.attribs?.id === 'all-tournament-calendar',
    dom.children,
    true
  );

  if (!calendarRoot) {
    return parseBlocksFromHtml(html);
  }

  const blocks = [];
  domToBlocks(calendarRoot, blocks);
  return blocks;
}

async function fetchAjaxTableHtml(params = {}, referer = '') {
  // Petición AJAX directa a Fedvas (sin proxy, muy rápido ~400ms)
  const start = Date.now();
  console.log('[AJAX] → GET /es/ajax/table-search', {
    type: params.type,
    id: params.id,
    rows: params.rows,
    input: params.input || '(empty)',
  });

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
      },
    });

    const elapsed = Date.now() - start;
    const contentLength = response.data?.content?.length || 0;
    
    console.log('[AJAX] ✓ SUCCESS in', `${elapsed}ms`, {
      type: params.type,
      contentLength,
      code: response.data?.code,
    });

    return extractHtmlFromAjaxData(response.data);
  } catch (error) {
    const elapsed = Date.now() - start;
    console.log('[AJAX] ✗ FAILED in', `${elapsed}ms`, {
      type: params.type,
      error: error.message,
      status: error.response?.status,
    });
    throw new Error(`AJAX table-search failed: ${error.message}`);
  }
}

async function fetchTournamentContext(inputUrl = '') {
  const baseUrl = getTournamentBaseUrl(inputUrl);
  if (!baseUrl) {
    return {
      baseUrl: '',
      rankingBaseUrl: toTournamentRankingUrl(inputUrl),
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
    console.log('[CTX] ✓ CACHE HIT:', baseUrl);
    return cached;
  }

  const pending = tournamentContextInFlight.get(cacheKey);
  if (pending) {
    console.log('[CTX] ⏳ IN FLIGHT:', baseUrl);
    return pending;
  }

  console.log('[CTX] → LOADING:', baseUrl);
  const start = Date.now();

  const loadContextPromise = (async () => {
    const rankingBaseUrl = `${baseUrl}/ranking`;
    const html = await fetchHTML(rankingBaseUrl);
    const blocks = parseBlocksFromHtml(html);
    const secondaryInputs = findSecondaryInputSets(html);
    const rankingInputs = secondaryInputs.find((fields) => fields.type === '12') || null;
    const rankingGroupId = rankingInputs?.id || null;
    const calendarUrl = discoverCalendarUrlFromHtml(html, rankingBaseUrl);
    const seasonLabel = extractSeasonLabelFromBlocks(blocks);

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
    console.log('[CTX] ✓ LOADED in', `${elapsed}ms`, {
      blocks: blocks.length,
      groupId: rankingGroupId,
      hasCalendar: !!calendarUrl,
    });

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

  console.log('[PREFETCH] → Calendar context', currentUrl);
  const t0 = Date.now();
  try {
    const html = await fetchHTML(currentUrl);
    const secondarySets = findSecondaryInputSets(html);
    const inputs = secondarySets.find((f) => f.type === '9') || null;
    if (inputs?.id) {
      const allBlocks = parseBlocksFromHtml(html);
      const metadataBlocks = allBlocks.filter((b) => b.type !== 'table');
      calendarAjaxContextCache.set(cacheKey, { inputs, metadataBlocks });
      console.log('[PREFETCH] ✓ Calendar context ready in', `${Date.now() - t0}ms`);
    } else {
      console.log('[PREFETCH] ✗ No type=9 inputs found in', `${Date.now() - t0}ms`);
    }
  } catch (e) {
    console.log('[PREFETCH] ✗ Failed in', `${Date.now() - t0}ms`, e.message);
  }
}

function discoverCalendarUrlFromHtml(html = '', rankingUrl = '') {
  const baseRanking = toTournamentRankingUrl(rankingUrl);
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
  console.log('[RANKING] → START', inputUrl);
  const context = await fetchTournamentContext(inputUrl);
  if (!context.rankingInputs?.id) {
    console.log('[RANKING] ✗ No groupId found in context —', `${Date.now() - t0}ms`);
    return context.blocks;
  }

  console.log('[RANKING] → AJAX groupId:', context.rankingInputs.id);
  try {
    const rankingHtml = await fetchAjaxTableHtml({
      ...context.rankingInputs,
      input: '',
    }, context.rankingBaseUrl);

    const ajaxBlocks = parseBlocksFromHtml(rankingHtml);
    const metadataBlocks = context.blocks.filter((block) => block.type !== 'table');
    console.log('[RANKING] ✓ done in', `${Date.now() - t0}ms`, { ajaxBlocks: ajaxBlocks.length, metadataBlocks: metadataBlocks.length });
    return [...metadataBlocks, ...ajaxBlocks];
  } catch (error) {
    console.warn('[RANKING] ⚠ AJAX failed, falling back to HTML context:', error.message);
    // Si falla AJAX (ej: CORS en web), devolvemos los bloques que ya teníamos del HTML inicial
    return context.blocks;
  }
}

async function fetchCalendarBlocksViaAjax(inputUrl = '') {
  const t0 = Date.now();
  console.log('[CALENDAR] → START', inputUrl);
  const currentUrl = ensureCalendarCurrentUrl(inputUrl); // appends /all
  const cacheKey = normalizeUrlForCache(currentUrl);

  // Full-result cache (not just inputs — the whole block array)
  const cached = calendarAjaxContextCache.get(cacheKey);
  if (cached?.fullBlocks) {
    console.log('[CALENDAR] ✓ CACHE HIT', currentUrl);
    return cached.fullBlocks;
  }

  // Fetch the /all page which already contains every matchday in HTML
  const allHtml = await fetchHTML(currentUrl);
  console.log('[CALENDAR] HTML length:', allHtml?.length);
  const allBlocks = parseBlocksFromHtml(allHtml);

  // The /all page has inline tables for every matchday — use them directly.
  // No AJAX needed; we already have the full data.
  const tableBlocks = allBlocks.filter((b) => b.type === 'table');
  const metadataBlocks = allBlocks.filter((b) => b.type !== 'table');

  console.log('[CALENDAR] Tables found in HTML:', tableBlocks.length);

  if (tableBlocks.length > 1) {
    // Great: multiple matchdays already parsed from HTML.
    // We assign titles from previous headings to tables before returning.
    let lastHeading = '';
    for (const b of allBlocks) {
      if (b.type === 'heading') lastHeading = b.content;
      else if (b.type === 'table' && lastHeading) b.title = lastHeading;
    }

    console.log('[CALENDAR] ✓ done (html-all) in', `${Date.now() - t0}ms`, {
      tables: tableBlocks.length,
      totalBlocks: allBlocks.length,
    });
    calendarAjaxContextCache.set(cacheKey, { fullBlocks: allBlocks });
    return allBlocks;
  }

  // Fallback: The /all page returned only 1 table (some leagues still load
  // matchdays via AJAX). Try the type=9 AJAX endpoint.
  const secondarySets = findSecondaryInputSets(allHtml);
  const calendarInputs = secondarySets.find((f) => f.type === '9') || null;

  if (!calendarInputs?.id) {
    console.log('[CALENDAR] ✗ Fallback → single table from HTML', { blocks: allBlocks.length });
    const fullBlocks = allBlocks;
    calendarAjaxContextCache.set(cacheKey, { fullBlocks });
    return fullBlocks;
  }

  try {
    const ajaxHtml = await fetchAjaxTableHtml({ ...calendarInputs, input: '' }, currentUrl);
    const ajaxBlocks = parseBlocksFromHtml(ajaxHtml);
    const fullBlocks = [...metadataBlocks, ...ajaxBlocks];
    console.log('[CALENDAR] ✓ done (ajax fallback) in', `${Date.now() - t0}ms`, {
      ajaxBlocks: ajaxBlocks.length,
      metadataBlocks: metadataBlocks.length,
    });
    calendarAjaxContextCache.set(cacheKey, { fullBlocks });
    return fullBlocks;
  } catch (error) {
    console.warn('[CALENDAR] ⚠ AJAX fallback failed:', error.message);
    const fullBlocks = allBlocks;
    calendarAjaxContextCache.set(cacheKey, { fullBlocks });
    return fullBlocks;
  }
}

async function fetchTournamentsBlocksViaAjax(inputUrl = '') {
  const t0 = Date.now();
  console.log('[TOURNAMENTS] → START', inputUrl);
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
    console.log('[TOURNAMENTS] ✗ Missing CSRF token, fallback HTML context in', `${Date.now() - t0}ms`);
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

    console.log('[TOURNAMENTS] ✓ done in', `${Date.now() - t0}ms`, { ajaxBlocks: ajaxBlocks.length, seasons: context.allSeasons?.length });
    return [...seasonMetadata, ...metadataBlocks, ...ajaxBlocks];
  } catch (error) {
    console.log('[TOURNAMENTS] ✗ AJAX failed, fallback HTML in', `${Date.now() - t0}ms`, { error: error.message });
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

export async function discoverTournamentSeasonLabel(inputUrl = '') {
  const context = await fetchTournamentContext(inputUrl);
  return context.seasonLabel || null;
}

export async function discoverCalendarUrlFromRanking(rankingUrl = '') {
  const context = await fetchTournamentContext(rankingUrl);
  return context.calendarUrl || null;
}

// ─── Tags que se eliminan completamente (con todo su contenido) ───────────────
const REMOVE_TAGS = new Set([
  'style', 'script', 'link', 'meta', 'head',
  'noscript', 'iframe', 'svg', 'canvas', 'form',
  'input', 'button', 'select', 'textarea', 'nav',
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
  console.log('[HTML] → GET', url);
  
  try {
    const response = await axios.get(url, {
      timeout: 15000,
      headers: defaultRequestHeaders(),
    });
    
    const elapsed = Date.now() - start;
    console.log('[HTML] ✓ SUCCESS in', `${elapsed}ms`, {
      contentLength: response.data?.length || 0,
    });
    
    return response.data;
  } catch (error) {
    const elapsed = Date.now() - start;
    console.log('[HTML] ✗ FAILED in', `${elapsed}ms`, {
      error: error.message,
    });
    throw new Error(`Error descargando ${url}: ${error.message}`);
  }
}

// ─── Parsea el HTML y devuelve el DOM raíz (objetos domhandler) ──────────────
export function parseHTML(html) {
  return htmlparser2.parseDocument(html);
}

// ─── Elimina nodos que pertenecen a tags prohibidos ──────────────────────────
function shouldRemoveNode(node) {
  return (
    node.type === 'comment' ||
    (node.type === 'tag' && REMOVE_TAGS.has(node.name))
  );
}

// ─── Extrae el texto limpio de un nodo (recursivo) ───────────────────────────
export function getTextContent(node) {
  if (!node) return '';
  if (node.type === 'text') return node.data.replace(/\s+/g, ' ').trim();
  if (node.children) {
    return node.children
      .map(getTextContent)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  return '';
}

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

    // Párrafos
    if (tag === 'p') {
      const text = getTextContent(node).trim();
      if (text.length > 3) {
        blocks.push({ type: 'paragraph', content: text });
      }
      return blocks;
    }

    // Listas
    if (tag === 'ul' || tag === 'ol') {
      const items = DomUtils.findAll(
        (n) => n.type === 'tag' && n.name === 'li',
        node.children || []
      ).map((li) => getTextContent(li).trim()).filter((t) => t.length > 0);

      if (items.length > 0) {
        blocks.push({ type: 'list', ordered: tag === 'ol', items });
      }
      return blocks;
    }

    // Tablas
    if (tag === 'table') {
      const tableBlock = parseTable(node);
      if (tableBlock) blocks.push(tableBlock);
      return blocks;
    }

    // Artículos y divs: recursar en hijos
    if (
      ['article', 'section', 'main', 'div', 'body', 'html'].includes(tag) ||
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
      const isTournamentRoute = /\/tournament\/\d+\/(ranking|calendar|summary|information)(?:\/\d+)?/i.test(absHref);
      if ((text.length > 2 || isTournamentRoute) && href && !href.startsWith('#')) {
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

function getNodeClass(node) {
  return (node?.attribs?.class || '').toLowerCase();
}

function normalizeTeamLogoUrl(url = '') {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    const isLeveradeThumb = /cdn\.leverade\.com$/i.test(parsed.hostname)
      && /\/thumbnails\//i.test(parsed.pathname);

    if (!isLeveradeThumb) return url;

    parsed.pathname = parsed.pathname.replace(
      /\.\d+x\d+(?=\.[a-zA-Z0-9]+$)/,
      ''
    );

    return parsed.toString();
  } catch (_) {
    return url.replace(/\.\d+x\d+(?=\.[a-zA-Z0-9]+(?:[?#].*)?$)/, '');
  }
}

function extractRowPrimaryImage(rowNode) {
  if (!rowNode) return null;

  const rowImgs = DomUtils.findAll(
    (n) => n.type === 'tag' && n.name === 'img',
    rowNode.children || []
  );

  const urls = rowImgs
    .map((img) => toAbsoluteUrl(img?.attribs?.src || img?.attribs?.['data-src'] || ''))
    .map((url) => normalizeTeamLogoUrl(url))
    .filter(Boolean);

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

  const verticalResults = DomUtils.findAll(
    (n) => n.type === 'tag' && n.name === 'span' && /\bvertical-result\b/i.test(getNodeClass(n)),
    cellNode.children || []
  );

  if (!verticalResults.length) return null;

  const parsedColumns = verticalResults.map((node) => {
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

  const sets = parsedColumns.slice(1, 6).map((set, index) => ({
    number: index + 1,
    home: set.home,
    away: set.away,
  }));

  return {
    matchScore: parsedColumns[0] || { home: null, away: null },
    sets,
  };
}

function parseDateCell(cellNode) {
  if (!cellNode) return null;

  const span = DomUtils.findOne((n) => n.type === 'tag' && n.name === 'span', cellNode.children || []);
  if (!span) return getTextContent(cellNode).trim() || null;

  const venueSpan = DomUtils.findOne(
    (n) => n.type === 'tag' && n.name === 'span' && /\bellipsis\b/i.test(getNodeClass(n)),
    span.children || []
  );
  const venue = venueSpan?.attribs?.title?.trim() || null;

  const dateText = getTextContent(span)
    .replace(venue || '', '')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    date: dateText || null,
    venue,
  };
}

function parseMatchRow(rowNode) {
  const cells = DomUtils.findAll(
    (n) => n.type === 'tag' && (n.name === 'th' || n.name === 'td'),
    rowNode.children || []
  );

  if (!cells.length) return null;

  const teamCell = cells.find((cell) => /colstyle-equipo/.test(getNodeClass(cell)));
  const periodsCell = cells.find((cell) => /colstyle-parciales/.test(getNodeClass(cell)));
  const dateCell = cells.find((cell) => /colstyle-fecha/.test(getNodeClass(cell)));

  const teams = parseTeamCell(teamCell);
  const periods = parsePeriodsCell(periodsCell);
  const dateData = parseDateCell(dateCell);

  if (!teams || !periods) return null;

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

// ─── Función principal: URL → array de bloques listos para renderizar ─────────
export async function fetchAndParse(url) {
  const t0 = Date.now();
  const absoluteUrl = toAbsoluteUrl(url);
  let blocks;

  if (/\/es\/tournaments(?:\?.*)?$/i.test(absoluteUrl)) {
    blocks = await fetchTournamentsBlocksViaAjax(absoluteUrl);
  } else if (/\/tournament\/\d+\/ranking(?:\/\d+)?$/i.test(absoluteUrl)) {
    blocks = await fetchRankingBlocksViaAjax(absoluteUrl);
  } else if (/\/tournament\/\d+\/calendar\/\d+(?:\/all|\/\d+)?$/i.test(absoluteUrl)) {
    blocks = await fetchCalendarBlocksViaAjax(absoluteUrl);
  } else {
    const html = await fetchHTML(absoluteUrl);
    blocks = parseBlocksFromHtml(html);
  }

  // Elimina bloques duplicados consecutivos
  const result = blocks.filter((block, i) => {
    if (i === 0) return true;
    const prev = blocks[i - 1];
    if (block.type === 'table') return true;
    return !(
      prev.type === block.type &&
      prev.content === block.content &&
      block.content !== undefined
    );
  });

  console.log('[fetchAndParse] ✅ TOTAL', `${Date.now() - t0}ms`, { url: absoluteUrl, blocks: result.length });
  return result;
}
