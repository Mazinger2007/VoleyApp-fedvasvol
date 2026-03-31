// src/utils/navigationHelper.js
import { toRankingUrl } from './htmlParser';

/**
 * Detecta si una competición es un torneo (eliminatorias) o una liga regular
 * basándose en palabras clave en el título.
 */
export function isTournament(title = '') {
  const tournamentKeywords = [
    'torneo', 'copa', 'kopa', 'txapelketa', 'topaketa', 'sector', 'campeonato', 
    'final', 'fase', 'eliminatoria', 'ranking', 'playoff', 'play off',
    'ascenso', 'descenso', 'kanporaketak', 'cup'
  ];
  const lowerTitle = title.toLowerCase();
  return tournamentKeywords.some(kw => lowerTitle.includes(kw));
}

/**
 * Navega a la pantalla correspondiente (Liga o Torneo)
 */
export function openTournamentDetail(navigation, tournament, extraParams = {}) {
  if (!tournament?.href) return;
  
  const title = tournament.name || tournament.title || 'Competición';
  const rankingUrl = toRankingUrl(tournament.href);
  
  if (tournament.isTorneo || isTournament(title)) {
    navigation.navigate('Tournament', {
      url: rankingUrl,
      title: title,
      ...extraParams
    });
  } else {
    navigation.navigate('League', {
      url: rankingUrl,
      title: title,
      defaultTab: 'ranking',
      ...extraParams
    });
  }
}
