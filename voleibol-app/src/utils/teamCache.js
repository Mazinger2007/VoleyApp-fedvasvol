// src/utils/teamCache.js
// Caché en memoria SIMPLE: nombre equipo → { url, name, points, position, divisionName }
// Se llena cuando se carga la clasificación en LeagueScreen.
// Matching flexible por nombre (contains/normalizado).

const leagueTeamsCache = new Map();

/**
 * Normaliza un string para comparaciones:
 * - Quita acentos
 * - Todo a minúsculas
 * - Quita caracteres especiales (deja solo letras, números y espacios)
 * - Colapsa espacios extra
 */
function normalizeName(name = '') {
  if (!name) return '';
  let str = String(name);
  
  // 1. Quitar acentos (Normalización NFD y quitar marcas de combinación)
  str = str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  // 2. A minúsculas
  str = str.toLowerCase();
  
  // 3. Quitar caracteres especiales, dejando solo letras, números y espacios
  str = str.replace(/[^a-z0-9\s]/g, ' ');
  
  // 4. Colapsar espacios y recortar
  return str.replace(/\s+/g, ' ').trim();
}

/**
 * Limpia el caché de equipos para una liga concreta (o todo el caché si no se pasa URL).
 */
export function clearTeamCache(rankingUrl) {
  if (rankingUrl) {
    const base = getBaseUrl(rankingUrl);
    if (base) leagueTeamsCache.delete(base);
  } else {
    leagueTeamsCache.clear();
  }
}

function getBaseUrl(url) {
  if (!url) return null;
  // Intento 1: Patrón estándar /tournament/ID
  const tournamentMatch = url.match(/^(https?:\/\/[^/]+(?:\/[a-z]{2})?\/tournament\/\d+)/i);
  if (tournamentMatch) return tournamentMatch[1];

  // Intento 2: Antes de segmentos conocidos
  const suffixMatch = url.match(/^(https?:\/\/[^/]+.*?)\/(?:ranking|calendar|results|match-detail|team|overview)/i);
  if (suffixMatch) return suffixMatch[1];

  // Fallback: dominio + primer segmento (ej: site.com/federation)
  const parts = url.split('/');
  if (parts.length >= 4) return parts.slice(0, 4).join('/');
  return url;
}

/**
 * Guarda los equipos extraídos de la clasificación de una liga.
 */
export function cacheTeamsFromRanking(rankingUrl, rankingBlocks) {
  if (!rankingUrl || !rankingBlocks || !rankingBlocks.length) return;

  const tables = rankingBlocks.filter(b => b.type === 'table' && b.rows && b.rows.length > 0);
  if (!tables.length) return;

  const teamDataMap = new Map();

  tables.forEach(table => {
    const headers = table.headers || [];
    const teamColIndex = headers.findIndex(h => {
      const low = String(h || '').toLowerCase();
      return low.includes('equipo') || low.includes('club') || low.includes('nombre') || low.includes('team');
    });
    const colIdx = teamColIndex >= 0 ? teamColIndex : 1;

    const ptsIdx = headers.findIndex(h => /pts|puntos|points/i.test(h) && (teamColIndex < 0 || h !== headers[teamColIndex]));
    const pIdx = headers.findIndex(h => String(h || '').toLowerCase() === 'p');

    table.rows.forEach((row, rowIndex) => {
      const teamName = row[colIdx] || row[0];
      if (!teamName) return;

      const teamUrl = table.rowLinks?.[rowIndex];
      // Si no hay URL, no nos sirve para navegar, pero lo guardamos igual por si acaso
      if (!teamUrl) return;

      const points = (ptsIdx >= 0 && row[ptsIdx]) || (pIdx >= 0 && row[pIdx]) || '-';
      const normalizedName = normalizeName(teamName);

      const leagueStatsObj = {};
      headers.forEach((h, i) => {
        const header = String(h || '').toLowerCase();
        const value = row[i];
        if (header.includes('puesto') || i === 0) leagueStatsObj.position = value;
        if (header.includes('jugados') || header === 'j') leagueStatsObj.played = value;
        if (header.includes('ganados') || header === 'g') leagueStatsObj.won = value;
        if (header.includes('perdidos') || (header === 'p' && !leagueStatsObj.points)) leagueStatsObj.lost = value;
        if (header.includes('puntos') || header === 'pts' || header === 'p') leagueStatsObj.points = value;
        if (header.includes('favor') || header === 'f') leagueStatsObj.setsFor = value;
        if (header.includes('contra') || header === 'c') leagueStatsObj.setsAgainst = value;
      });

      teamDataMap.set(normalizedName, {
        name: teamName,
        url: teamUrl,
        points,
        divisionName: table.title || 'Clasificación',
        position: String(row[0] || (rowIndex + 1)),
        leagueStats: leagueStatsObj,
        logo: table.rowLogos?.[rowIndex] || table.rowImages?.[rowIndex] || null
      });
    });
  });

  if (teamDataMap.size > 0) {
    const baseTournamentUrl = getBaseUrl(rankingUrl);
    if (baseTournamentUrl) {
      leagueTeamsCache.set(baseTournamentUrl, teamDataMap);
    }
  }
}

/**
 * Intenta recuperar los datos de un equipo desde el caché.
 * Prioriza el contexto actual (misma liga), pero si no encuentra nada
 * busca en todas las ligas cacheadas por si el equipo está en otra.
 */
export function getTeamFromCache(contextUrl, teamName) {
  if (!teamName) return null;

  // 1. Buscar en la liga del contexto actual
  if (contextUrl) {
    const baseTournamentUrl = getBaseUrl(contextUrl);
    const cacheMap = leagueTeamsCache.get(baseTournamentUrl);
    if (cacheMap) {
      const match = searchInMap(cacheMap, teamName);
      if (match) return match;
    }
  }

  // 2. Fallback: Buscar en ABSOLUTAMENTE TODAS las ligas cacheadas
  // Esto es útil si el usuario viene de un enlace de partido genérico
  for (const cacheMap of leagueTeamsCache.values()) {
    const match = searchInMap(cacheMap, teamName);
    if (match) return match;
  }

  return null;
}

/**
 * Lógica de búsqueda flexible dentro de un Map de equipos.
 */
function searchInMap(cacheMap, teamName) {
  if (!cacheMap || cacheMap.size === 0) return null;
  const query = normalizeName(teamName);
  if (!query) return null;

  // 1. Coincidencia exacta (normalizada)
  if (cacheMap.has(query)) return cacheMap.get(query);

  // 2. Búsqueda por inclusión: 
  // Ej: "Ekialde" coincide con "Cafes Foronda Ekialde"
  // O "Cafes Foronda Ekialde" coincide con "Ekialde"
  for (const [key, value] of cacheMap) {
    if (key.includes(query) || query.includes(key)) {
      return value;
    }
  }

  // 3. Búsqueda por palabras significativas (opcional, para mayor robustez)
  // Quita palabras comunes como "CV", "CD", "Taldea", etc.
  const queryWords = query.split(' ').filter(w => w.length > 3);
  if (queryWords.length > 0) {
    for (const [key, value] of cacheMap) {
      if (queryWords.some(word => key.includes(word))) {
        return value;
      }
    }
  }

  return null;
}

