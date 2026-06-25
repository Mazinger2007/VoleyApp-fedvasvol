// src/utils/navigationHelper.js
import { toRankingUrl } from './htmlParser';

/**
 * Detecta si una competición es un torneo (eliminatorias) o una liga regular
 * basándose en palabras clave en el título.
 */
export function isTournament(title = '') {
  const tournamentKeywords = [
    'torneo', 'copa', 'kopa', 'txapelketa', 'topaketa', 'sector', 'campeonato',
    'final', 'eliminatoria', 'ranking', 'playoff', 'play off', 'pla off',
    'ascenso', 'descenso', 'kanporaketak', 'cup', 'clasificaci'
  ];
  // Remove spaces, dashes, underscores for robust matching (e.g. "Play-off" -> "playoff")
  const normalizedTitle = title.toLowerCase().replace(/[-_\s]/g, '');

  // We check against normalizedTitle and original lowerTitle just in case
  const lowerTitle = title.toLowerCase();

  // Also check if any keyword string with spaces stripped matches the normalized title
  return tournamentKeywords.some(kw => {
    const kwNormalized = kw.replace(/[-_\s]/g, '');
    return normalizedTitle.includes(kwNormalized) || lowerTitle.includes(kw);
  });
}

/**
 * Navega a la pantalla correspondiente (Liga o Torneo)
 */
export function openTournamentDetail(navigation, tournament, extraParams = {}) {
  if (!tournament?.href) return;

  const title = tournament.name || tournament.title || 'Competicion';

  if (tournament.isTorneo || isTournament(title)) {
    navigation.navigate('Tournament', {
      url: tournament.href,
      title,
      ...extraParams,
    });
    return;
  }

  navigation.navigate('League', {
    url: toRankingUrl(tournament.href),
    title,
    defaultTab: 'ranking',
    ...extraParams,
  });
}

