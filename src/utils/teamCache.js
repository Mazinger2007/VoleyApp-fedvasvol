import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_PREFIX = '@team_details:';

// ─── Caché persistente por teamId ───────────────────────────────────────────

export async function loadTeamDetailsCache(teamId) {
  if (!teamId) return null;
  try {
    const raw = await AsyncStorage.getItem(`${CACHE_PREFIX}${teamId}`);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return null;
}

export async function saveTeamDetailsCache(teamId, data) {
  if (!teamId) return;
  try {
    await AsyncStorage.setItem(`${CACHE_PREFIX}${teamId}`, JSON.stringify(data));
  } catch (_) {}
}

// ─── Caché en memoria por nombre de equipo ──────────────────────────────────
const teamsByName = {};

export function getTeamFromCache(_rankingUrl, teamName) {
  return teamsByName[teamName] || null;
}

export function cacheTeamsFromRanking(_rankingUrl, tableBlocks) {
  for (const table of tableBlocks || []) {
    if (!table?.rows?.length) continue;
    const headers = (table.headers || []).map(h => h.toLowerCase());
    const teamCol = headers.findIndex(h => /equipo|club|nombre|team/i.test(h));
    const tc = teamCol >= 0 ? teamCol : 1;
    table.rows.forEach((row, i) => {
      const name = row[tc] || row[1] || '';
      if (name) {
        teamsByName[name] = {
          name,
          logo: table.rowLogos?.[i] || table.rowImages?.[i] || null,
          url: table.rowLinks?.[i] || null,
        };
      }
    });
  }
}

// ─── Caché persistente de escudos por liga ─────────────────────────────────
// Guarda los logos (escudos) de los equipos de una liga para no tener que
// volver a descargar su ranking cada vez que se muestra la lista de ligas.
const LEAGUE_SHIELDS_PREFIX = '@league_shields:';

export async function saveLeagueShields(leagueUrl, shields) {
  if (!leagueUrl) return;
  try {
    await AsyncStorage.setItem(
      `${LEAGUE_SHIELDS_PREFIX}${leagueUrl}`,
      JSON.stringify(shields)
    );
  } catch (_) {}
}

export async function loadLeagueShields(leagueUrl) {
  if (!leagueUrl) return [];
  try {
    const raw = await AsyncStorage.getItem(`${LEAGUE_SHIELDS_PREFIX}${leagueUrl}`);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}
