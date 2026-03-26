// src/utils/teamCache.js
// Caché en memoria para almacenar los datos de los equipos de la liga actual.
// Esto permite que al hacer clic en un equipo desde el calendario/partido,
// se cargue inmediatamente con todos sus datos como si fuera desde la clasificación.

const leagueTeamsCache = new Map();

/**
 * Guarda los equipos extraídos de la clasificación de una liga.
 * @param {string} rankingUrl URL base de la clasificación
 * @param {Array} rankingBlocks Bloques de la clasificación
 */
export function cacheTeamsFromRanking(rankingUrl, rankingBlocks) {
  if (!rankingUrl || !rankingBlocks || !rankingBlocks.length) return;
  
  const tables = rankingBlocks.filter(b => b.type === 'table' && b.rows && b.rows.length > 0);
  if (!tables.length) return;

  const teamDataMap = new Map();

  tables.forEach(table => {
    const headers = table.headers || [];
    const teamColIndex = headers.findIndex(h => String(h||'').toLowerCase().includes('equipo'));
    const colIdx = teamColIndex >= 0 ? teamColIndex : 1;

    table.rows.forEach((row, rowIndex) => {
      const teamName = row[colIdx] || row[0];
      if (!teamName) return;

      const teamUrl = table.rowLinks?.[rowIndex];
      if (!teamUrl) return;

      // Extract context data similar to LeagueScreen -> handleTeamPress
      const ptsIdx = headers.findIndex(h => /pts|puntos|points/i.test(h) && (teamColIndex < 0 || h !== headers[teamColIndex]));
      const pIdx = headers.findIndex(h => String(h||'').toLowerCase() === 'p');
      const points = (ptsIdx >= 0 && row[ptsIdx]) || (pIdx >= 0 && row[pIdx]) || '-';

      teamDataMap.set(teamName.trim().toLowerCase(), {
        name: teamName,
        url: teamUrl,
        points,
        divisionName: table.title || 'Clasificación',
        // Optional position handling if we can extract it
        position: row[0] || (rowIndex + 1).toString(),
      });
    });
  });

  const baseTournamentUrl = rankingUrl.match(/^(https?:\/\/[^/]+\/[a-z]{2}\/tournament\/\d+)/i)?.[1] || rankingUrl;
  leagueTeamsCache.set(baseTournamentUrl, teamDataMap);
}

/**
 * Intenta recuperar los datos de un equipo desde la caché.
 * @param {string} calendarUrl o URL de partido para extraer el contexto
 * @param {string} teamName Nombre del equipo a buscar
 */
export function getTeamFromCache(calendarUrl, teamName) {
  if (!calendarUrl || !teamName) return null;
  const baseTournamentUrl = calendarUrl.match(/^(https?:\/\/[^/]+\/[a-z]{2}\/tournament\/\d+)/i)?.[1];
  if (!baseTournamentUrl) return null;

  const cacheMap = leagueTeamsCache.get(baseTournamentUrl);
  if (!cacheMap) return null;

  return cacheMap.get(teamName.trim().toLowerCase()) || null;
}
