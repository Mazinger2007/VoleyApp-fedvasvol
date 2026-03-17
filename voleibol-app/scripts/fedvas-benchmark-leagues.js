/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const BASE = 'https://fedvasvol.com';
const ROOT_TOURNAMENTS = `${BASE}/es/tournaments`;
const AJAX_TOURNAMENTS = `${BASE}/es/ajax/tournaments`;
const AJAX_TABLE_SEARCH = `${BASE}/es/ajax/table-search`;

function getArg(args, name, fallback = null) {
  const idx = args.findIndex((arg) => arg === `--${name}`);
  if (idx < 0) return fallback;
  const value = args[idx + 1];
  if (!value || value.startsWith('--')) return true;
  return value;
}

function defaultHeaders(extra = {}) {
  return {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml',
    'Accept-Language': 'es-ES,es;q=0.9',
    ...extra,
  };
}

async function timed(fn) {
  const start = process.hrtime.bigint();
  const result = await fn();
  const end = process.hrtime.bigint();
  return {
    ms: Number(end - start) / 1e6,
    result,
  };
}

function ensureCalendarAllUrl(url = '') {
  const clean = String(url || '').replace(/\/+$/, '');
  if (!clean) return '';
  if (/\/calendar\/\d+\/all$/i.test(clean)) return clean;
  if (/\/calendar\/\d+$/i.test(clean)) return `${clean}/all`;
  return clean;
}

function toAbsolute(url = '') {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  return `${BASE}${url.startsWith('/') ? url : `/${url}`}`;
}

function extractCsrfToken(html = '') {
  return html.match(/name="csrf_token"\s+value="([^"]+)"/i)?.[1] || '';
}

function findSecondaryInputSets(html = '') {
  const blocks = [...String(html || '').matchAll(/<div class="ml-secondary-inputs">([\s\S]*?)<\/div>/gi)];
  return blocks
    .map((match) => {
      const fields = [...match[1].matchAll(/<input[^>]*name="([^"]+)"[^>]*value="([^"]*)"/gi)]
        .reduce((acc, input) => ({
          ...acc,
          [input[1]]: input[2],
        }), {});
      return fields;
    })
    .filter((fields) => Object.keys(fields).length > 0);
}

function discoverCalendarUrlFromHtml(html = '', rankingUrl = '') {
  const absoluteAll = html.match(/https?:\/\/[^"'\s]+\/[a-z]{2}\/tournament\/\d+\/calendar\/\d+\/all/i)?.[0];
  if (absoluteAll) return absoluteAll;

  const absolute = html.match(/https?:\/\/[^"'\s]+\/[a-z]{2}\/tournament\/\d+\/calendar\/\d+/i)?.[0];
  if (absolute) return ensureCalendarAllUrl(absolute);

  const relativeAll = html.match(/\/[a-z]{2}\/tournament\/\d+\/calendar\/\d+\/all/i)?.[0];
  if (relativeAll) return toAbsolute(relativeAll);

  const relative = html.match(/\/[a-z]{2}\/tournament\/\d+\/calendar\/\d+/i)?.[0];
  if (relative) return ensureCalendarAllUrl(toAbsolute(relative));

  const rankingGroup = html.match(/\/[a-z]{2}\/tournament\/(\d+)\/ranking\/(\d+)/i);
  if (rankingGroup?.[1] && rankingGroup?.[2]) {
    const locale = rankingUrl.match(/https?:\/\/[^/]+\/(\w{2})\//i)?.[1] || 'es';
    return `${BASE}/${locale}/tournament/${rankingGroup[1]}/calendar/${rankingGroup[2]}/all`;
  }

  return '';
}

function mean(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return (sorted[mid - 1] + sorted[mid]) / 2;
  return sorted[mid];
}

function summarize(values = []) {
  if (!values.length) {
    return {
      samples: 0,
      minMs: 0,
      maxMs: 0,
      avgMs: 0,
      medianMs: 0,
    };
  }

  return {
    samples: values.length,
    minMs: Math.min(...values),
    maxMs: Math.max(...values),
    avgMs: mean(values),
    medianMs: median(values),
  };
}

async function getTournamentsFromMap() {
  const mapPath = path.join(process.cwd(), 'data', 'fedvas-site-map.json');
  const content = await fs.promises.readFile(mapPath, 'utf8');
  const parsed = JSON.parse(content);

  const seasons = Array.isArray(parsed?.seasons) ? parsed.seasons : [];
  const tournaments = Array.isArray(parsed?.tournaments) ? parsed.tournaments : [];

  return { seasons, tournaments };
}

async function measureLeaguesTable(primarySeasonId = '') {
  const htmlProbe = await timed(async () => {
    const response = await axios.get(ROOT_TOURNAMENTS, {
      timeout: 30000,
      headers: defaultHeaders(),
    });
    return typeof response.data === 'string' ? response.data : String(response.data || '');
  });

  const rootHtml = htmlProbe.result;
  const csrfToken = extractCsrfToken(rootHtml);

  let ajaxMs = null;
  let ajaxStatus = 'not-run';
  let ajaxError = null;
  if (csrfToken && primarySeasonId) {
    const payload = new URLSearchParams();
    payload.append('csrf_token', csrfToken);
    payload.append('season', String(primarySeasonId));

    try {
      const ajaxProbe = await timed(async () => {
        await axios.post(AJAX_TOURNAMENTS, payload.toString(), {
          timeout: 30000,
          headers: defaultHeaders({
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'X-Requested-With': 'XMLHttpRequest',
            Referer: ROOT_TOURNAMENTS,
            Origin: BASE,
          }),
        });
      });
      ajaxMs = ajaxProbe.ms;
      ajaxStatus = 'ok';
    } catch (error) {
      ajaxStatus = 'error';
      ajaxError = error.message;
    }
  }

  return {
    htmlMs: htmlProbe.ms,
    ajaxMs,
    ajaxStatus,
    ajaxError,
    csrfToken: Boolean(csrfToken),
  };
}

async function measureRankingAndCalendar(tournament) {
  let rankingUrl = tournament.rankingUrl;
  if (!rankingUrl) {
    rankingUrl = `${BASE}/es/tournament/${tournament.tournamentId}/ranking`;
  }

  let rankingMs = null;
  let rankingContextMs = null;
  let rankingAjaxMs = null;
  let calendarMs = null;
  let totalMs = null;
  let calendarUrl = '';
  let rankingMode = 'html-only';
  let error = null;

  try {
    const rankingStart = process.hrtime.bigint();

    const rankingContextProbe = await timed(async () => {
      const response = await axios.get(rankingUrl, {
        timeout: 30000,
        headers: defaultHeaders(),
      });
      return typeof response.data === 'string' ? response.data : String(response.data || '');
    });

    const rankingHtml = rankingContextProbe.result;
    rankingContextMs = rankingContextProbe.ms;
    calendarUrl = ensureCalendarAllUrl(discoverCalendarUrlFromHtml(rankingHtml, rankingUrl));

    const secondaryInputs = findSecondaryInputSets(rankingHtml);
    const rankingInputs = secondaryInputs.find((fields) => fields.type === '12') || null;

    if (rankingInputs?.id) {
      const rankingAjaxProbe = await timed(async () => {
        await axios.get(AJAX_TABLE_SEARCH, {
          timeout: 30000,
          params: {
            ...rankingInputs,
            input: '',
          },
          headers: defaultHeaders({
            Referer: rankingUrl,
            'X-Requested-With': 'XMLHttpRequest',
          }),
        });
      });
      rankingAjaxMs = rankingAjaxProbe.ms;
      rankingMode = 'html+ajax';
    }

    const rankingEnd = process.hrtime.bigint();
    rankingMs = Number(rankingEnd - rankingStart) / 1e6;

    if (calendarUrl) {
      const calendarProbe = await timed(async () => {
        await axios.get(calendarUrl, {
          timeout: 30000,
          headers: defaultHeaders(),
        });
      });
      calendarMs = calendarProbe.ms;
    }

    totalMs = (rankingMs || 0) + (calendarMs || 0);
  } catch (err) {
    error = err.message;
  }

  return {
    tournamentId: tournament.tournamentId,
    name: tournament.name,
    seasonLabel: tournament.seasonLabel || null,
    status: tournament.status || null,
    rankingUrl,
    calendarUrl: calendarUrl || null,
    rankingMode,
    rankingContextMs,
    rankingAjaxMs,
    rankingMs,
    calendarMs,
    totalMs,
    error,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const includeAll = Boolean(getArg(args, 'all', false));
  const limit = Number(getArg(args, 'limit', '0')) || 0;

  const { seasons, tournaments } = await getTournamentsFromMap();
  const primarySeasonId = seasons?.[0]?.id || '';

  const selected = tournaments
    .filter((item) => includeAll || item.status === 'En curso')
    .slice(0, limit > 0 ? limit : undefined);

  if (!selected.length) {
    throw new Error('No hay ligas para medir con los filtros actuales');
  }

  console.log(`[benchmark-leagues] ligas=${selected.length}, includeAll=${includeAll}`);

  const leaguesTable = await measureLeaguesTable(primarySeasonId);
  console.log(
    `[tabla-ligas] html=${leaguesTable.htmlMs.toFixed(1)}ms` +
      (leaguesTable.ajaxMs ? ` ajax=${leaguesTable.ajaxMs.toFixed(1)}ms` : '') +
      (leaguesTable.ajaxStatus === 'error' ? ` ajaxError=${leaguesTable.ajaxError}` : '')
  );

  const leagueResults = [];
  for (const tournament of selected) {
    const result = await measureRankingAndCalendar(tournament);
    leagueResults.push(result);

    const rankPart = result.rankingMs != null ? `${result.rankingMs.toFixed(1)}ms` : 'n/a';
    const calPart = result.calendarMs != null ? `${result.calendarMs.toFixed(1)}ms` : 'n/a';
    const totalPart = result.totalMs != null ? `${result.totalMs.toFixed(1)}ms` : 'n/a';
    const statusPart = result.error ? ` ERROR=${result.error}` : '';

    console.log(
      `[liga] ${result.tournamentId} ${result.name} :: ranking=${rankPart} calendario=${calPart} total=${totalPart}${statusPart}`
    );
  }

  const ok = leagueResults.filter((item) => !item.error);
  const rankingValues = ok.map((item) => item.rankingMs).filter((v) => typeof v === 'number');
  const calendarValues = ok.map((item) => item.calendarMs).filter((v) => typeof v === 'number');
  const totalValues = ok.map((item) => item.totalMs).filter((v) => typeof v === 'number');

  const summary = {
    generatedAt: new Date().toISOString(),
    measuredLeagues: leagueResults.length,
    successfulLeagues: ok.length,
    failedLeagues: leagueResults.filter((item) => item.error).length,
    leaguesTable,
    ranking: summarize(rankingValues),
    calendar: summarize(calendarValues),
    total: summarize(totalValues),
  };

  const output = {
    summary,
    leagues: leagueResults,
  };

  const outPath = path.join(process.cwd(), 'data', 'fedvas-benchmark-leagues.json');
  await fs.promises.writeFile(outPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');

  const slowest = [...ok]
    .filter((item) => typeof item.totalMs === 'number')
    .sort((a, b) => b.totalMs - a.totalMs)
    .slice(0, 5)
    .map((item) => ({
      id: item.tournamentId,
      name: item.name,
      totalMs: Number(item.totalMs.toFixed(1)),
    }));

  console.log('\n=== BENCHMARK LIGAS (RESUMEN) ===');
  console.log(JSON.stringify(summary, null, 2));
  console.log('\nTop 5 ligas más lentas (total):');
  console.log(JSON.stringify(slowest, null, 2));
  console.log(`\nGuardado en: ${outPath}`);
}

main().catch((error) => {
  console.error('[fatal]', error.message);
  process.exitCode = 1;
});