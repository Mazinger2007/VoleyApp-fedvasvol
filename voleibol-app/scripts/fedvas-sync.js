/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const htmlparser2 = require('htmlparser2');
const DomUtils = require('domutils');

const BASE = 'https://fedvasvol.com';
const ROOT_TOURNAMENTS = `${BASE}/es/tournaments`;
const AJAX_TOURNAMENTS = `${BASE}/es/ajax/tournaments`;

const outDir = path.join(process.cwd(), 'data');
const mapPath = path.join(outDir, 'fedvas-site-map.json');
const cachePath = path.join(outDir, 'fedvas-cache.json');

function defaultHeaders(extra = {}) {
  return {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml',
    'Accept-Language': 'es-ES,es;q=0.9',
    ...extra,
  };
}

async function fetchHtml(url, config = {}) {
  const { headers = {}, ...rest } = config;
  const { data } = await axios.get(url, {
    timeout: 30000,
    headers: defaultHeaders(headers),
    ...rest,
  });
  return data;
}

function parseDocument(html) {
  return htmlparser2.parseDocument(html);
}

function buildCookieHeader(setCookie = []) {
  if (!Array.isArray(setCookie) || !setCookie.length) return '';
  return setCookie
    .map((item) => String(item || '').split(';')[0].trim())
    .filter(Boolean)
    .join('; ');
}

function extractHtmlFromResponseData(data) {
  if (typeof data === 'string') return data;
  if (!data || typeof data !== 'object') return String(data || '');

  const queue = [data];
  while (queue.length) {
    const current = queue.shift();
    if (!current || typeof current !== 'object') continue;

    for (const value of Object.values(current)) {
      if (typeof value === 'string' && /<\s*(div|table|tr|td|a)\b/i.test(value)) {
        return value;
      }
      if (value && typeof value === 'object') queue.push(value);
    }
  }

  return JSON.stringify(data);
}

function text(node) {
  if (!node) return '';
  if (node.type === 'text') return (node.data || '').replace(/\s+/g, ' ').trim();
  return (node.children || []).map(text).join(' ').replace(/\s+/g, ' ').trim();
}

function toAbsolute(href = '') {
  if (!href) return '';
  if (/^https?:\/\//i.test(href)) return href;
  return `${BASE}${href.startsWith('/') ? href : `/${href}`}`;
}

function seasonOptions(dom) {
  const select = DomUtils.findOne(
    (n) => n.type === 'tag' && n.name === 'select' && n.attribs?.name === 'season',
    dom.children,
    true
  );
  if (!select) return [];
  const options = DomUtils.findAll((n) => n.type === 'tag' && n.name === 'option', select.children || []);
  return options
    .map((opt) => ({ id: (opt.attribs?.value || '').trim(), label: text(opt) }))
    .filter((s) => s.id && /^\d+$/.test(s.id));
}

function extractCsrfToken(dom) {
  const tokenInput = DomUtils.findOne(
    (n) => n.type === 'tag' && n.name === 'input' && n.attribs?.name === 'csrf_token' && n.attribs?.value,
    dom.children,
    true
  );
  return (tokenInput?.attribs?.value || '').trim();
}

async function fetchTournamentsContext() {
  const response = await axios.get(ROOT_TOURNAMENTS, {
    timeout: 30000,
    headers: defaultHeaders(),
  });

  const html = typeof response.data === 'string' ? response.data : String(response.data || '');
  const dom = parseDocument(html);

  return {
    html,
    dom,
    csrfToken: extractCsrfToken(dom),
    cookieHeader: buildCookieHeader(response.headers?.['set-cookie'] || []),
  };
}

function tableRowsWithTournamentLink(dom) {
  const rows = DomUtils.findAll((n) => n.type === 'tag' && n.name === 'tr', dom.children, true);

  const items = [];
  for (const row of rows) {
    const link = DomUtils.findOne(
      (n) => n.type === 'tag' && n.name === 'a' && /\/es\/tournament\/\d+\/(summary|information|ranking|calendar)/i.test(n.attribs?.href || ''),
      row.children || [],
      true
    );
    if (!link) continue;

    const href = toAbsolute(link.attribs.href);
    const idMatch = href.match(/\/tournament\/(\d+)\//i);
    const id = idMatch?.[1];
    if (!id) continue;

    const cells = DomUtils.findAll(
      (n) => n.type === 'tag' && (n.name === 'th' || n.name === 'td'),
      row.children || []
    );
    const cellTexts = cells.map((c) => text(c));

    const statusIcon = DomUtils.findOne(
      (n) => n.type === 'tag' && n.name === 'i' && n.attribs?.title,
      row.children || [],
      true
    );

    const baseMatch = href.match(/^(https?:\/\/[^/]+\/[a-z]{2}\/tournament\/\d+)/i);
    const tournamentBaseUrl = baseMatch?.[1] || '';
    const summaryUrl = tournamentBaseUrl
      ? `${tournamentBaseUrl}/summary`
      : href.replace(/\/(ranking|information|calendar)(?:\/.*)?$/i, '/summary');
    const rankingUrl = tournamentBaseUrl
      ? `${tournamentBaseUrl}/ranking`
      : href.replace(/\/(summary|information|calendar)(?:\/.*)?$/i, '/ranking');

    items.push({
      tournamentId: id,
      summaryUrl,
      rankingUrl,
      name: cellTexts[1] || cellTexts[0] || `Tournament ${id}`,
      seasonLabel: cellTexts[3] || null,
      category: cellTexts[4] || null,
      sex: cellTexts[5] || null,
      status: statusIcon?.attribs?.title || cellTexts[0] || null,
    });
  }

  const dedup = new Map();
  for (const it of items) dedup.set(it.tournamentId, it);
  return [...dedup.values()];
}

function parseTableNode(tableNode) {
  const rows = DomUtils.findAll((n) => n.type === 'tag' && n.name === 'tr', tableNode.children || [], true);
  if (!rows.length) return null;

  const firstCells = DomUtils.findAll(
    (n) => n.type === 'tag' && (n.name === 'th' || n.name === 'td'),
    rows[0].children || []
  );
  const headers = firstCells.map((c) => text(c));

  const parsedRows = rows.slice(1).map((row) => {
    const cells = DomUtils.findAll(
      (n) => n.type === 'tag' && (n.name === 'th' || n.name === 'td'),
      row.children || []
    );
    return cells.map((c) => text(c));
  });

  return {
    headers,
    rows: parsedRows.filter((r) => r.some((c) => c && c.length > 0)),
  };
}

function extractGroupLinks(html, tournamentId) {
  const ranking = new Set();
  const calendar = new Set();

  const rankingRegex = new RegExp(`${BASE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/es/tournament/${tournamentId}/ranking/(\\d+)`, 'gi');
  const calendarRegex = new RegExp(`${BASE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/es/tournament/${tournamentId}/calendar/(\\d+)`, 'gi');

  for (const m of html.matchAll(rankingRegex)) ranking.add(m[1]);
  for (const m of html.matchAll(calendarRegex)) calendar.add(m[1]);

  return {
    rankingGroupIds: [...ranking],
    calendarGroupIds: [...calendar],
  };
}

async function fetchSeasonTournamentsHtml(seasonId) {
  const seasonUrl = `${ROOT_TOURNAMENTS}?season=${seasonId}`;
  const html = await fetchHtml(seasonUrl);
  const dom = parseDocument(html);
  const tournaments = tableRowsWithTournamentLink(dom).map((t) => ({ ...t, seasonId }));
  return {
    sourceUrl: seasonUrl,
    sourceMethod: 'html',
    tournaments,
  };
}

async function fetchSeasonTournamentsAjax(seasonId, csrfToken, cookieHeader = '') {
  if (!csrfToken) {
    throw new Error('Missing csrf_token for ajax discovery');
  }

  const payload = new URLSearchParams();
  payload.append('csrf_token', csrfToken);
  payload.append('season', String(seasonId));

  const { data } = await axios.post(AJAX_TOURNAMENTS, payload.toString(), {
    timeout: 30000,
    headers: defaultHeaders({
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
      Referer: ROOT_TOURNAMENTS,
      Origin: BASE,
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
    }),
  });

  const html = extractHtmlFromResponseData(data);
  const dom = parseDocument(html);
  const tournaments = tableRowsWithTournamentLink(dom).map((t) => ({ ...t, seasonId }));

  return {
    sourceUrl: AJAX_TOURNAMENTS,
    sourceMethod: 'ajax',
    tournaments,
  };
}

async function discover(options = {}) {
  const { limitSeasons = 0, discoveryMethod = 'auto' } = options;
  const { dom: rootDom, csrfToken, cookieHeader } = await fetchTournamentsContext();

  const seasons = seasonOptions(rootDom);
  const targetSeasons = limitSeasons > 0 ? seasons.slice(0, limitSeasons) : seasons;

  const discovered = {
    generatedAt: new Date().toISOString(),
    source: ROOT_TOURNAMENTS,
    seasons: [],
    tournaments: [],
  };

  for (const season of targetSeasons) {
    console.log(`[discover] season ${season.label} (${season.id})`);

    let sourceMethod = 'html';
    let sourceUrl = `${ROOT_TOURNAMENTS}?season=${season.id}`;
    let tournaments = [];

    const canUseAjax = discoveryMethod !== 'html' && Boolean(csrfToken);
    if (canUseAjax) {
      try {
        const ajaxResult = await fetchSeasonTournamentsAjax(season.id, csrfToken, cookieHeader);
        tournaments = ajaxResult.tournaments;
        sourceMethod = ajaxResult.sourceMethod;
        sourceUrl = ajaxResult.sourceUrl;
      } catch (error) {
        console.warn(`[discover] ajax fallback season ${season.id}: ${error.message}`);
      }
    }

    if (!tournaments.length || discoveryMethod === 'html') {
      const htmlResult = await fetchSeasonTournamentsHtml(season.id);
      tournaments = htmlResult.tournaments;
      sourceMethod = htmlResult.sourceMethod;
      sourceUrl = htmlResult.sourceUrl;
    }

    discovered.seasons.push({
      id: season.id,
      label: season.label,
      url: sourceUrl,
      method: sourceMethod,
      tournaments: tournaments.map((t) => t.tournamentId),
    });

    discovered.tournaments.push(...tournaments);
  }

  const dedup = new Map();
  for (const t of discovered.tournaments) dedup.set(t.tournamentId, t);
  discovered.tournaments = [...dedup.values()];

  return discovered;
}

async function enrichTournament(tournament) {
  const rankingBaseHtml = await fetchHtml(tournament.rankingUrl);
  const { rankingGroupIds, calendarGroupIds } = extractGroupLinks(rankingBaseHtml, tournament.tournamentId);

  const groupIds = [...new Set([...rankingGroupIds, ...calendarGroupIds])];
  const groups = [];

  for (const groupId of groupIds) {
    const rankingUrl = `${BASE}/es/tournament/${tournament.tournamentId}/ranking/${groupId}`;
    const calendarAllUrl = `${BASE}/es/tournament/${tournament.tournamentId}/calendar/${groupId}/all`;

    const rankingHtml = await fetchHtml(rankingUrl);
    const rankingDom = parseDocument(rankingHtml);
    const rankingTableNode = DomUtils.findOne((n) => n.type === 'tag' && n.name === 'table', rankingDom.children, true);
    const rankingTable = rankingTableNode ? parseTableNode(rankingTableNode) : null;

    const calendarHtml = await fetchHtml(calendarAllUrl);
    const calendarDom = parseDocument(calendarHtml);
    const tables = DomUtils.findAll((n) => n.type === 'tag' && n.name === 'table', calendarDom.children, true);
    const h2s = DomUtils.findAll((n) => n.type === 'tag' && n.name === 'h2', calendarDom.children, true).map((h) => text(h));

    const calendarRounds = tables
      .map((table, idx) => ({
        roundLabel: h2s[idx] || `Jornada ${idx + 1}`,
        table: parseTableNode(table),
      }))
      .filter((r) => r.table && r.table.rows.length > 0);

    groups.push({
      groupId,
      rankingUrl,
      calendarAllUrl,
      rankingTable,
      calendarRounds,
      extractedAt: new Date().toISOString(),
    });
  }

  return {
    ...tournament,
    groups,
    rankingBaseUrl: tournament.rankingUrl,
    refreshedAt: new Date().toISOString(),
  };
}

async function syncSite(options = {}) {
  const {
    limitSeasons = 0,
    limitTournaments = 0,
    discoveryMethod = 'auto',
    discoverOnly = false,
    writeFiles = true,
  } = options;

  try {
    if (writeFiles && !fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    const discovered = await discover({ limitSeasons, discoveryMethod });
    if (writeFiles) {
      fs.writeFileSync(mapPath, JSON.stringify(discovered, null, 2), 'utf8');
      console.log(`[ok] site map -> ${mapPath}`);
    }

    if (discoverOnly) {
      return { discovered, cache: null };
    }

    const candidates = limitTournaments > 0
      ? discovered.tournaments.slice(0, limitTournaments)
      : discovered.tournaments;

    const items = [];
    for (const t of candidates) {
      console.log(`[sync] tournament ${t.tournamentId} ${t.name}`);
      try {
        const enriched = await enrichTournament(t);
        items.push(enriched);
      } catch (error) {
        items.push({
          ...t,
          groups: [],
          error: error.message,
          refreshedAt: new Date().toISOString(),
        });
      }
    }

    const cache = {
      generatedAt: new Date().toISOString(),
      tournaments: items,
    };

    if (writeFiles) {
      fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2), 'utf8');
      console.log(`[ok] cache -> ${cachePath}`);
    }

    return { discovered, cache };
  } catch (error) {
    console.error('[fatal]', error.message);
    throw error;
  }
}

function getArg(args, name, fallback = null) {
  const idx = args.findIndex((a) => a === `--${name}`);
  if (idx < 0) return fallback;
  const value = args[idx + 1];
  if (!value || value.startsWith('--')) return true;
  return value;
}

async function runCli() {
  const args = process.argv.slice(2);
  const limitSeasons = Number(getArg(args, 'limitSeasons', '0')) || 0;
  const limitTournaments = Number(getArg(args, 'limitTournaments', '0')) || 0;
  const discoverOnly = Boolean(getArg(args, 'discover', false));
  const discoveryMethod = String(getArg(args, 'method', 'auto')).toLowerCase();

  try {
    await syncSite({
      limitSeasons,
      limitTournaments,
      discoveryMethod,
      discoverOnly,
      writeFiles: true,
    });
  } catch (error) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  runCli();
}

module.exports = {
  BASE,
  ROOT_TOURNAMENTS,
  AJAX_TOURNAMENTS,
  fetchHtml,
  parseDocument,
  seasonOptions,
  extractCsrfToken,
  fetchTournamentsContext,
  tableRowsWithTournamentLink,
  fetchSeasonTournamentsHtml,
  fetchSeasonTournamentsAjax,
  discover,
  enrichTournament,
  syncSite,
};
