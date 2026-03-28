// src/utils/teamCache.js
// Caché en memoria SIMPLE: nombre equipo → { url, name, points, position, divisionName }
// Se llena cuando se carga la clasificación en LeagueScreen.
// Se limpia cuando la liga cambia o cuando se llama clearTeamCache().
// Matching flexible por nombre (contains/normalizado).

const leagueTeamsCache = new Map();

function normalizeName(name = '') {
  let str = String(name || '');
  if (typeof str.normalize === 'function') {
    str = str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  } else {
    // Fallback: reemplazo manual básico de tildes comunes para entornos sin .normalize()
    str = str.replace(/[áàäâ]/gi, 'a')
             .replace(/[éèëê]/gi, 'e')
             .replace(/[íìïî]/gi, 'i')
             .replace(/[óòöô]/gi, 'o')
             .replace(/[úùüû]/gi, 'u')
             .replace(/[ñ]/gi, 'n');
  }
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Limpia el caché de equipos para una liga concreta (o todo el caché si no se pasa URL).
 */
export function clearTeamCache(rankingUrl) {
  if (rankingUrl) {
    const base = rankingUrl.match(/^(https?:\/\/[^/]+\/[a-z]{2}\/tournament\/\d+)/i)?.[1] || rankingUrl;
    leagueTeamsCache.delete(base);
  } else {
    leagueTeamsCache.clear();
  }
}

/**
 * Guarda los equipos extraídos de la clasificación de una liga.
 * @param {string} rankingUrl URL de la clasificación
 * @param {Array} rankingBlocks Bloques parseados de la clasificación
 */
export function cacheTeamsFromRanking(rankingUrl, rankingBlocks) {
  if (!rankingUrl || !rankingBlocks || !rankingBlocks.length) return;

  const tables = rankingBlocks.filter(b => b.type === 'table' && b.rows && b.rows.length > 0);
  if (!tables.length) return;

  const teamDataMap = new Map();

  tables.forEach(table => {
    const headers = table.headers || [];
    const teamColIndex = headers.findIndex(h => String(h || '').toLowerCase().includes('equipo'));
    const colIdx = teamColIndex >= 0 ? teamColIndex : 1;

    const ptsIdx = headers.findIndex(h => /pts|puntos|points/i.test(h) && (teamColIndex < 0 || h !== headers[teamColIndex]));
    const pIdx = headers.findIndex(h => String(h || '').toLowerCase() === 'p');

    table.rows.forEach((row, rowIndex) => {
      const teamName = row[colIdx] || row[0];
      if (!teamName) return;

      const teamUrl = table.rowLinks?.[rowIndex];
      if (!teamUrl) return;

      const points = (ptsIdx >= 0 && row[ptsIdx]) || (pIdx >= 0 && row[pIdx]) || '-';
      const normalizedName = normalizeName(teamName);

      teamDataMap.set(normalizedName, {
        name: teamName,
        url: teamUrl,
        points,
        divisionName: table.title || 'Clasificación',
        position: String(row[0] || (rowIndex + 1)),
      });
    });
  });

  const baseTournamentUrl = rankingUrl.match(/^(https?:\/\/[^/]+\/[a-z]{2}\/tournament\/\d+)/i)?.[1] || rankingUrl;
  leagueTeamsCache.set(baseTournamentUrl, teamDataMap);
}

/**
 * Intenta recuperar los datos de un equipo desde el caché.
 * Matching flexible: exacto primero, luego contains.
 * @param {string} contextUrl URL del calendario o del partido (para extraer la liga)
 * @param {string} teamName Nombre del equipo a buscar
 */
export function getTeamFromCache(contextUrl, teamName) {
  if (!contextUrl || !teamName) return null;

  const baseTournamentUrl = contextUrl.match(/^(https?:\/\/[^/]+\/[a-z]{2}\/tournament\/\d+)/i)?.[1];
  if (!baseTournamentUrl) return null;

  const cacheMap = leagueTeamsCache.get(baseTournamentUrl);
  if (!cacheMap || cacheMap.size === 0) return null;

  const normalizedQuery = normalizeName(teamName);

  // 1. Búsqueda exacta
  const exact = cacheMap.get(normalizedQuery);
  if (exact) return exact;

  // 2. Búsqueda flexible (contains)
  for (const [key, value] of cacheMap) {
    if (key.includes(normalizedQuery) || normalizedQuery.includes(key)) {
      return value;
    }
  }

  // 3. Búsqueda por palabras (al menos una palabra clave en común)
  const queryWords = normalizedQuery.split(' ').filter(w => w.length > 2);
  if (queryWords.length > 0) {
    for (const [key, value] of cacheMap) {
      if (queryWords.some(word => key.includes(word))) {
        return value;
      }
    }
  }

  return null;
}
