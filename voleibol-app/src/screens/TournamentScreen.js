import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { fetchChampionshipData } from '../utils/htmlParser';
import { Radius, Spacing, Typography } from '../styles/theme';


// ─── Gap between cards in the same column ───────────────────────────────────
const CARD_GAP = 16;
// ─── Width of the connector corridor between columns ────────────────────────
const CONNECTOR_WIDTH = 40;
const PHASE_CARD_WIDTH = 300;
const PHASE_SNAP_INTERVAL = PHASE_CARD_WIDTH + CONNECTOR_WIDTH * 1.5;

// Manual snap offset per phase (edit these values).
// Positive = further right, Negative = further left.
const PHASE_SCROLL_TUNING = {
  SEMIFINAL: -100,
  FINAL_1: -5,
  FINAL: -10,
  CLASIFICACION_FINAL: 100,
};

function parseNumericScore(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function getMatchScores(match = {}) {
  const homeFromField = parseNumericScore(match.homeScore);
  const awayFromField = parseNumericScore(match.awayScore);
  if (homeFromField !== null && awayFromField !== null) {
    return { homeScore: homeFromField, awayScore: awayFromField };
  }

  const homeFromNested = parseNumericScore(match?.matchScore?.home);
  const awayFromNested = parseNumericScore(match?.matchScore?.away);
  if (homeFromNested !== null && awayFromNested !== null) {
    return { homeScore: homeFromNested, awayScore: awayFromNested };
  }

  const raw = String(match.scoreText || '').replace(/[‐‑‒–—―]/g, '-');
  const parsed = raw.match(/(\d+)\s*-\s*(\d+)/);
  if (parsed) {
    return {
      homeScore: parseNumericScore(parsed[1]),
      awayScore: parseNumericScore(parsed[2]),
    };
  }

  return {
    homeScore: homeFromField ?? homeFromNested,
    awayScore: awayFromField ?? awayFromNested,
  };
}

function getMatchWinner(match = {}) {
  const { homeScore, awayScore } = getMatchScores(match);
  if (homeScore === null || awayScore === null || homeScore === awayScore) return null;
  return homeScore > awayScore
    ? { name: match.homeTeam, logo: match.homeLogo }
    : { name: match.awayTeam, logo: match.awayLogo };
}

function buildRoundMatchesFromTeams(teams = [], fallbackDateTime = 'Por determinar') {
  const result = [];
  for (let i = 0; i < teams.length; i += 2) {
    const home = teams[i];
    const away = teams[i + 1];
    if (!home || !away) break;
    result.push({
      homeTeam: home.name || 'Por determinar',
      awayTeam: away.name || 'Por determinar',
      homeLogo: home.logo || null,
      awayLogo: away.logo || null,
      homeScore: null,
      awayScore: null,
      scoreText: '- -',
      dateTime: fallbackDateTime,
      state: 'scheduled',
    });
  }
  return result;
}

function reorderOneThreeTwoFour(items = []) {
  if (!Array.isArray(items) || items.length < 4) return items;
  return [items[0], items[2], items[1], items[3], ...items.slice(4)];
}

function buildMatchStableKey(match = {}, fallback = '') {
  const home = String(match?.homeTeam || '').toLowerCase().trim();
  const away = String(match?.awayTeam || '').toLowerCase().trim();
  const dt = String(match?.dateTime || '').toLowerCase().trim();
  const score = String(match?.scoreText || '').toLowerCase().trim();
  return `${home}|${away}|${dt}|${score}|${fallback}`;
}

function toMatchDetailPayload(match = {}) {
  const { homeScore, awayScore } = getMatchScores(match);
  const hasScores = homeScore !== null && awayScore !== null;
  const inferredState = hasScores ? 'finished' : (match.state || 'upcoming');

  return {
    ...match,
    // MatchDetail/getMatchSummary expects `date`, not only `dateTime`
    date: match.date || match.dateTime || null,
    venue: match.venue || match.location || null,
    matchScore: {
      home: homeScore,
      away: awayScore,
    },
    state: inferredState,
    sets: Array.isArray(match.sets) ? match.sets : [],
    href: match.href || null, // Asegura que el enlace directo se pase si existe
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// BracketConnectors
// Draws the horizontal + vertical lines that join pairs of matches to the
// next-round match.  Heights are computed from real card measurements so the
// lines are always perfectly centred.
// ─────────────────────────────────────────────────────────────────────────────
function BracketConnectors({ cardHeights, totalMatches, isFirstPhase = false }) {
  if (!cardHeights || totalMatches < 2) return null;

  const pairs = Math.floor(totalMatches / 2);
  const lines = [];

  for (let i = 0; i < pairs; i++) {
    const topIdx = i * 2;
    const botIdx = i * 2 + 1;

    const hTop = cardHeights[topIdx] ?? 0;
    const hBot = cardHeights[botIdx] ?? 0;

    if (!hTop || !hBot) continue;

    // Y-offset from the top of the matchesGroup to the centre of the top card
    let yTop = 0;
    for (let k = 0; k < topIdx; k++) {
      yTop += (cardHeights[k] ?? 0) + CARD_GAP;
    }
    yTop += hTop / 2;

    // Y-offset to the centre of the bottom card
    let yBot = 0;
    for (let k = 0; k < botIdx; k++) {
      yBot += (cardHeights[k] ?? 0) + CARD_GAP;
    }
    yBot += hBot / 2;

    // Midpoint between the two centres → where the vertical bar sits
    const yMid = (yTop + yBot) / 2;
    const verticalHeight = yBot - yTop;

    const isFirstPhaseWithFour = isFirstPhase && totalMatches === 4;
    const topWidth = CONNECTOR_WIDTH;
    const bottomWidth = (isFirstPhaseWithFour && i === 0) ? CONNECTOR_WIDTH * 2 : CONNECTOR_WIDTH;
    const nextTopEquivalentWidth = (isFirstPhaseWithFour && i === 1) ? CONNECTOR_WIDTH * 2 : CONNECTOR_WIDTH;
    const effectiveTopWidth = i === 1 ? nextTopEquivalentWidth : topWidth;

    lines.push(
      // Horizontal line from top card
      <View
        key={`h-top-${i}-${Math.round(yTop)}`}
        style={[styles.connLine, { top: yTop - 1, left: 0, width: effectiveTopWidth, height: 2 }]}
      />,
      // Horizontal line from bottom card
      <View
        key={`h-bot-${i}-${Math.round(yBot)}`}
        style={[styles.connLine, { top: yBot - 1, left: 0, width: bottomWidth, height: 2 }]}
      />,
      // Vertical bar joining them
      <View
        key={`v-${i}-${Math.round(yTop)}-${Math.round(yBot)}`}
        style={[
          styles.connLine,
          {
            top: yTop - 1,
            left: CONNECTOR_WIDTH - 2,
            width: 2,
            height: verticalHeight + 2,
          },
        ]}
      />
    );

    // Default center stub for all non-custom layouts.
    if (!isFirstPhaseWithFour) {
      lines.push(
        <View
          key={`h-mid-${i}-${Math.round(yMid)}`}
          style={[
            styles.connLine,
            { top: yMid - 1, left: CONNECTOR_WIDTH - 2, width: CONNECTOR_WIDTH / 2 + 2, height: 2 },
          ]}
        />
      );
    }
  }

  return <View style={StyleSheet.absoluteFill} pointerEvents="none">{lines}</View>;
}

// ─────────────────────────────────────────────────────────────────────────────
// BracketColumn
// Renders one round of matches plus the connector layer.
// Uses onLayout callbacks to measure each card before drawing lines.
// ─────────────────────────────────────────────────────────────────────────────
function BracketColumn({ col, cIdx, totalColumns, Colors, renderMatchCard }) {
  const [cardHeights, setCardHeights] = useState({});
  const matchCount = col.matches.length;
  const hasConnectors = cIdx < totalColumns - 1 && matchCount >= 2;

  const handleCardLayout = useCallback((mIdx, event) => {
    const { height } = event.nativeEvent.layout;
    setCardHeights(prev => {
      if (prev[mIdx] === height) return prev;
      return { ...prev, [mIdx]: height };
    });
  }, []);

  return (
    <View style={styles.columnWrapper}>
      <Text style={styles.phaseTitleText}>{col.title.toUpperCase()}</Text>

      {/* Cards + connector overlay */}
      <View style={{ flexDirection: 'row' }}>
        {/* Cards */}
        <View style={[styles.matchesGroup, { width: PHASE_CARD_WIDTH }]}>
          {col.matches.map((m, mIdx) => (
            <View
              key={buildMatchStableKey(m, `card-${cIdx}-${mIdx}`)}
              onLayout={e => handleCardLayout(mIdx, e)}
            >
              {renderMatchCard(m)}
            </View>
          ))}
        </View>

        {/* Connector corridor */}
        {hasConnectors && (
          <View style={{ width: CONNECTOR_WIDTH * 1.5, position: 'relative' }}>
            <BracketConnectors
              cardHeights={cardHeights}
              totalMatches={matchCount}
              isFirstPhase={cIdx === 0}
            />
          </View>
        )}
      </View>

    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────────────────────────────────────
export default function TournamentScreen({ route, navigation }) {
  const { colors: Colors, isDark } = useTheme();
  const { title, url } = route.params || {};

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = useCallback(async () => {
    const nextState = !isFullscreen;
    setIsFullscreen(nextState);
    if (nextState) {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE_RIGHT);
    } else {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.DEFAULT);
    }
  }, [isFullscreen]);

  useEffect(() => {
    // Unlock on unmount
    return () => {
      ScreenOrientation.unlockAsync();
    };
  }, []);

  useEffect(() => {
    async function loadData(showLoading = true) {
      if (!url) { setLoading(false); return; }
      try {
        if (showLoading) setLoading(true);
        setError(null);
        if (showLoading) setData(null);
        const result = await fetchChampionshipData(url);
        setData(result);
      } catch (err) {
        console.error('[Tournament] Error loading data:', err);
        setError('No se pudo cargar la información del torneo.');
      } finally {
        if (showLoading) setLoading(false);
      }
    }
    loadData(true);

    // Live refresh for active tournaments without UI flicker.
    const intervalId = setInterval(() => {
      loadData(false);
    }, 30000);

    return () => clearInterval(intervalId);
  }, [url]);

  // ── Match card ─────────────────────────────────────────────────────────────

  const renderMatchCard = useCallback((match, isPlacement = false) => {
    // Determine winner/loser ONCE, here.
    const p1 = { name: match.homeTeam, logo: match.homeLogo, score: null, sets: [] };
    const p2 = { name: match.awayTeam, logo: match.awayLogo, score: null, sets: [] };

    const { homeScore, awayScore } = getMatchScores(match);
    p1.score = homeScore;
    p2.score = awayScore;

    let winner = null;
    let loser = null;

    if (homeScore !== null && awayScore !== null) {
      if (homeScore > awayScore) {
        winner = p1;
        loser = p2;
      } else if (awayScore > homeScore) {
        winner = p2;
        loser = p1;
      } else if (Array.isArray(match.sets) && match.sets.length > 0) {
        // Tie-break with sets
        let homeSetsWon = 0;
        let awaySetsWon = 0;
        match.sets.forEach(s => {
          if (typeof s.home === 'number' && typeof s.away === 'number') {
            if (s.home > s.away) homeSetsWon++;
            else if (s.away > s.home) awaySetsWon++;
          }
        });
        if (homeSetsWon > awaySetsWon) {
          winner = p1;
          loser = p2;
        } else if (awaySetsWon > homeSetsWon) {
          winner = p2;
          loser = p1;
        }
      }
    }

    // Solo en isPlacement (clasificación final) el ganador va arriba. En el resto, home arriba y away abajo.
    let top, bottom;
    if (isPlacement && winner) {
      top = winner;
      bottom = loser;
    } else {
      top = p1;
      bottom = p2;
    }

    const hasBothScores = top.score !== null && bottom.score !== null;
    const isFinished = match.state === 'finished' || hasBothScores;
    const topIsWinner = hasBothScores && top.score > bottom.score;
    const bottomIsWinner = hasBothScores && bottom.score > top.score;

    const openMatchDetail = () => {
      const payload = {
        match: toMatchDetailPayload(match),
        calendarUrl: url,
      };
      // LOG para depuración
      if (typeof window !== 'undefined') {
        console.log('[NAVIGATE] MatchDetail payload:', payload);
      } else {
        // eslint-disable-next-line no-console
        console.log('[NAVIGATE] MatchDetail payload:', payload);
      }
      navigation.navigate('MatchDetail', payload);
    };

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={openMatchDetail}
        style={[
          styles.matchCard,
          { backgroundColor: Colors.surface, borderColor: isPlacement ? Colors.border : 'transparent' },
          !isPlacement && styles.matchCardShadow,
        ]}
      >
        {/* Top */}
        <View style={[styles.matchTeamRow, !topIsWinner && hasBothScores && styles.loserRow]}>
          <View style={styles.teamInfo}>
            <View style={[styles.logoContainer, { backgroundColor: Colors.surfaceAlt }]}>
              {top.logo
                ? <Image source={{ uri: top.logo }} style={styles.matchLogo} />
                : <MaterialIcons name="shield" size={20} color={Colors.textMuted} />}
            </View>
            <Text style={[styles.matchTeamName, { color: Colors.textPrimary }]} numberOfLines={1}>
              {top.name}
            </Text>
          </View>
          <Text style={[styles.matchScore, { color: Colors.textPrimary }, topIsWinner && styles.winnerScore]}>
            {top.score ?? '--'}
          </Text>
        </View>

        {/* Bottom */}
        <View style={[styles.matchTeamRow, !bottomIsWinner && hasBothScores && styles.loserRow]}>
          <View style={styles.teamInfo}>
            <View style={[styles.logoContainer, { backgroundColor: Colors.surfaceAlt }]}>
              {bottom.logo
                ? <Image source={{ uri: bottom.logo }} style={styles.matchLogo} />
                : <MaterialIcons name="shield" size={20} color={Colors.textMuted} />}
            </View>
            <Text style={[styles.matchTeamName, { color: Colors.textPrimary }]} numberOfLines={1}>
              {bottom.name}
            </Text>
          </View>
          <Text style={[styles.matchScore, { color: Colors.textPrimary }, bottomIsWinner && styles.winnerScore]}>
            {bottom.score ?? '--'}
          </Text>
        </View>

        {isFinished && (
          <View style={styles.statusBadgeContainer}>
            <Text style={[styles.statusBadge, { color: Colors.tertiary, backgroundColor: Colors.tertiary + '15' }]}>
              FINALIZADO
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }, [Colors, navigation]);

  // ── Flatten phases → columns ───────────────────────────────────────────────
  const flattenedColumns = React.useMemo(() => {
    if (!data?.mainFlow) return [];
    const columns = [];
    const seenMatchKeys = new Set();

    const normalizeTitle = (value = '') => String(value || '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();

    const buildMatchKey = (m = {}) => [
      String(m.homeTeam || '').toLowerCase().trim(),
      String(m.awayTeam || '').toLowerCase().trim(),
      String(m.dateTime || '').toLowerCase().trim(),
      String(m.scoreText || '').toLowerCase().trim(),
    ].join('|');

    const upsertColumn = (rawTitle, roundIndex) => {
      const title = rawTitle || `ROUND ${roundIndex + 1}`;
      const normalized = normalizeTitle(title);
      const existingIdx = columns.findIndex(c => normalizeTitle(c.title) === normalized);
      if (existingIdx >= 0) return columns[existingIdx];
      const created = { title, matches: [] };
      columns.push(created);
      return created;
    };

    data.mainFlow.forEach((phase) => {
      (phase.blocks || []).forEach((block) => {
        if (block.type !== 'bracket' || !block.columns) return;
        block.columns.forEach((col, colIdx) => {
          const targetCol = upsertColumn(col.header || phase.title, colIdx);
          (col.matches || []).forEach((m) => {
            if (!m) return;
            const key = buildMatchKey(m);
            if (!key || seenMatchKeys.has(key)) return;
            seenMatchKeys.add(key);
            targetCol.matches.push(m);
          });
        });
      });
    });

    return columns.filter(c => (c.matches || []).length > 0);
  }, [data]);

  // Mostrar siempre el texto "Temporada actual" en el badge
  const seasonBadgeLabel = 'TEMPORADA ACTUAL';

  const displayColumns = React.useMemo(() => {
    if (flattenedColumns.length <= 1) return flattenedColumns;

    let workingColumns = [...flattenedColumns];
    const isThirdFourthColumn = (col) => {
      const title = String(col?.title || '').toLowerCase();
      return /3\s*[ºo°]\s*y\s*4|tercer|tercero|cuarto|fourth|third/.test(title);
    };

    // Remove 3rd/4th place from the main bracket area entirely.
    workingColumns = workingColumns.filter(col => !isThirdFourthColumn(col));
    if (workingColumns.length <= 1) return workingColumns;

    // Merge "Semifinal 1/2" (or similar) into one vertical semifinal column.
    // The renderer stacks matches inside a column vertically.
    const semifinalRegex = /^semi\s*final(?:es)?(?:\s*\d+)?$/i;
    const semifinalColumns = workingColumns.filter(col =>
      semifinalRegex.test(String(col?.title || '').trim())
    );
    if (semifinalColumns.length >= 2) {
      const mergedSemifinalMatches = reorderOneThreeTwoFour(
        semifinalColumns.flatMap(col => col.matches || [])
      );
      const nonSemifinalColumns = workingColumns.filter(
        col => !semifinalRegex.test(String(col?.title || '').trim())
      );
      const insertionIndex = workingColumns.findIndex(col =>
        semifinalRegex.test(String(col?.title || '').trim())
      );

      const mergedColumns = [...nonSemifinalColumns];
      mergedColumns.splice(insertionIndex, 0, {
        title: 'SEMIFINAL',
        matches: mergedSemifinalMatches,
      });
      workingColumns = mergedColumns;
    }

    const normalizedTitles = workingColumns
      .map(c => String(c?.title || '').toLowerCase().replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    const uniqueTitleCount = new Set(normalizedTitles).size;
    const looksClassification = uniqueTitleCount <= 1 || /clasificaci|classification/i.test(title || '');
    if (looksClassification) {
      const mergedMatches = workingColumns.flatMap(col => col.matches || []);
      return [{ title: workingColumns[0]?.title || 'CLASIFICACIÓN', matches: mergedMatches }];
    }

    // Force quarterfinal bracket shape:
    // - QF column: exactly first 4 cards max
    // - Next column: winners of those QFs (2 matches)
    const quarterIdx = workingColumns.findIndex(col => /cuartos|quarter/i.test(String(col?.title || '')));
    if (quarterIdx >= 0) {
      const quarterCol = workingColumns[quarterIdx];
      const trimmedQuarterMatches = (quarterCol?.matches || []).slice(0, 4);
      const quarterWinners = trimmedQuarterMatches.map(getMatchWinner).filter(Boolean);

      workingColumns[quarterIdx] = {
        ...quarterCol,
        title: quarterCol?.title || 'CUARTOS DE FINAL',
        matches: trimmedQuarterMatches,
      };

      if (quarterWinners.length >= 4) {
        const interleavedWinners = [
          quarterWinners[0],
          quarterWinners[2],
          quarterWinners[1],
          quarterWinners[3],
        ].filter(Boolean);
        const semifinalMatches = buildRoundMatchesFromTeams(interleavedWinners, 'Por determinar');
        const nextCol = workingColumns[quarterIdx + 1];
        if (!nextCol) {
          workingColumns.splice(quarterIdx + 1, 0, {
            title: 'SEMIFINAL',
            matches: semifinalMatches,
          });
        } else {
          workingColumns[quarterIdx + 1] = {
            ...nextCol,
            title: /semi/i.test(String(nextCol?.title || '')) ? nextCol.title : 'SEMIFINAL',
            matches: semifinalMatches,
          };
        }
      }
    }

    // Build/fill next column from semifinal winners when the source site
    // has finished semis but no populated final column yet.
    const semIdx = workingColumns.findIndex(col => /semi/i.test(String(col?.title || '')));
    if (semIdx >= 0) {
      const semMatches = workingColumns[semIdx]?.matches || [];
      const winners = semMatches.map(getMatchWinner).filter(Boolean);
      const nextCol = workingColumns[semIdx + 1];
      const nextMatches = nextCol?.matches || [];
      const nextLooksFinal = nextCol
        && /final/i.test(String(nextCol?.title || ''))
        && !/semi/i.test(String(nextCol?.title || ''));

      if (winners.length >= 2 && (!nextCol || nextMatches.length === 0)) {
        const [homeWinner, awayWinner] = winners;
        workingColumns.splice(semIdx + 1, 0, {
          title: 'FINAL',
          matches: [{
            homeTeam: homeWinner.name || 'Por determinar',
            awayTeam: awayWinner.name || 'Por determinar',
            homeLogo: homeWinner.logo || null,
            awayLogo: awayWinner.logo || null,
            homeScore: null,
            awayScore: null,
            scoreText: '- -',
            dateTime: 'Por determinar',
            state: 'scheduled',
          }],
        });
      } else if (winners.length >= 2 && nextLooksFinal && nextMatches.length > 0) {
        const baseFinal = nextMatches[0] || {};
        const homeMissing = !baseFinal.homeTeam || /tbd|por determinar/i.test(String(baseFinal.homeTeam || ''));
        const awayMissing = !baseFinal.awayTeam || /tbd|por determinar/i.test(String(baseFinal.awayTeam || ''));
        if (homeMissing || awayMissing) {
          const [homeWinner, awayWinner] = winners;
          nextMatches[0] = {
            ...baseFinal,
            homeTeam: homeMissing ? (homeWinner.name || baseFinal.homeTeam || 'Por determinar') : baseFinal.homeTeam,
            awayTeam: awayMissing ? (awayWinner.name || baseFinal.awayTeam || 'Por determinar') : baseFinal.awayTeam,
            homeLogo: homeMissing ? (homeWinner.logo || baseFinal.homeLogo || null) : baseFinal.homeLogo,
            awayLogo: awayMissing ? (awayWinner.logo || baseFinal.awayLogo || null) : baseFinal.awayLogo,
          };
        }
      }
    }

    return workingColumns;
  }, [flattenedColumns, title]);

  const phaseSnapOffsets = React.useMemo(() => {
    const mainPhaseKeys = displayColumns.map((_, idx) => {
      if (idx === 0) return 'SEMIFINAL';
      // If there are only 2 columns, treat the second as FINAL.
      if (displayColumns.length <= 2 && idx === 1) return 'FINAL';
      if (idx === 1) return 'FINAL_1';
      return 'FINAL';
    });

    const hasClasificacionFinal = (data?.placements || []).length > 0;
    const allPhaseKeys = hasClasificacionFinal
      ? [...mainPhaseKeys, 'CLASIFICACION_FINAL']
      : mainPhaseKeys;

    return allPhaseKeys.map((phaseKey, idx) => {
      const base = idx * PHASE_SNAP_INTERVAL;
      const tuning = PHASE_SCROLL_TUNING[phaseKey] || 0;
      return Math.max(0, base + tuning);
    });
  }, [displayColumns, data?.placements]);

  // ── Render ─────────────────────────────────────────────────────────────────
  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={[styles.loadingText, { color: Colors.textMuted }]}>
            Cargando esquema del torneo...
          </Text>
        </View>
      );
    }

    if (error || !data || (displayColumns.length === 0 && data.placements.length === 0)) {
      return (
        <View style={styles.content}>
          <MaterialIcons name="emoji-events" size={100} color={Colors.textMuted} style={styles.icon} />
          <Text style={[styles.emptyText, { color: Colors.textMuted }]}>
            {error || 'SIN DATOS DISPONIBLES'}
          </Text>
          <Text style={[styles.subText, { color: Colors.textMuted }]}>
            No se han cargado eliminatorias para este torneo todavía.
          </Text>
        </View>
      );
    }

    // Extraer y ordenar los partidos de clasificación final por puesto
    // Solo partidos de la sección de clasificación final (data.placements), en orden exacto: final, 3-4, 5-6, 7-8
    let placementMatchesRaw = [];
    if (Array.isArray(data.placements)) {
      placementMatchesRaw = data.placements.flatMap((phase) =>
        (phase.blocks || []).flatMap((block) =>
          (block.columns || []).flatMap((col) => {
            const sourceTitle = `${phase?.title || ''} ${col?.header || ''}`.toLowerCase();
            return (col.matches || []).map(match => ({
              ...match,
              _placementTitle: sourceTitle,
              _placementPhase: phase?.title || '',
              _placementHeader: col?.header || '',
            }));
          })
        )
      );
    }

    // Orden exacto deseado para la columna de clasificación final
    const ordenClasificacion = [
      /final|1\s*[ºo°]\s*y\s*2|primero|segundo|1er|2do/, // Final
      /3\s*[ºo°]\s*y\s*4|tercer|cuarto|3er|4to/,         // 3º-4º
      /5\s*[ºo°]\s*y\s*6|quinto|sexto|5to|6to/,         // 5º-6º
      /7\s*[ºo°]\s*y\s*8|séptimo|octavo|7mo|8vo/,       // 7º-8º
    ];
    function getOrdenIndex(title) {
      for (let i = 0; i < ordenClasificacion.length; i++) {
        if (ordenClasificacion[i].test(title)) return i;
      }
      return 99;
    }
    // Filtrar y ordenar SOLO los partidos de posiciones finales
    const placementMatchesFiltered = placementMatchesRaw
      .filter(m => getOrdenIndex(m._placementTitle) < 99);
    // LOG: Mostrar de dónde salen los partidos de clasificación final
    if (typeof window !== 'undefined') {
      // En web
      console.log('[CLASIFICACION FINAL] Partidos extraídos para tarjetas:', placementMatchesFiltered);
    } else {
      // En nativo
      // eslint-disable-next-line no-console
      console.log('[CLASIFICACION FINAL] Partidos extraídos para tarjetas:', placementMatchesFiltered);
    }


    // Definir prioridad de orden según el texto del título
    const placementOrder = [
      /final|1\s*[ºo°]\s*y\s*2|primero|segundo|1er|2do/, // 1º-2º
      /3\s*[ºo°]\s*y\s*4|tercer|cuarto|3er|4to/,         // 3º-4º
      /5\s*[ºo°]\s*y\s*6|quinto|sexto|5to|6to/,         // 5º-6º
      /7\s*[ºo°]\s*y\s*8|séptimo|octavo|7mo|8vo/,       // 7º-8º
    ];

    function getPlacementIndex(title) {
      for (let i = 0; i < placementOrder.length; i++) {
        if (placementOrder[i].test(title)) return i;
      }
      return 99; // Otros abajo
    }

    // Ordenar partidos por puesto
    placementMatchesRaw = placementMatchesRaw.sort((a, b) => {
      return getPlacementIndex(a._placementTitle) - getPlacementIndex(b._placementTitle);
    });

    // Ordenar partidos por puesto exacto (final, 3º-4º, 5º-6º, 7º-8º)
    const puestoRegexes = [
      /final|1\s*[ºo°]\s*y\s*2|primero|segundo|1er|2do/, // 1º-2º
      /3\s*[ºo°]\s*y\s*4|tercer|cuarto|3er|4to/,         // 3º-4º
      /5\s*[ºo°]\s*y\s*6|quinto|sexto|5to|6to/,         // 5º-6º
      /7\s*[ºo°]\s*y\s*8|séptimo|octavo|7mo|8vo/,       // 7º-8º
    ];
    // Lógica para calcular la final igual que en el bracket principal
    function getBracketFinalMatch() {
      // Buscar la columna cuyo título es exactamente 'FINAL' (ignorando espacios y mayúsculas)
      const normalize = t => String(t || '').replace(/\s+/g, '').toLowerCase();
      const finalCol = displayColumns.find(col => normalize(col?.title) === 'final');
      if (finalCol && Array.isArray(finalCol.matches) && finalCol.matches.length > 0) {
        return finalCol.matches[0];
      }
      // Si no existe, buscar la primera columna que contenga 'final' pero no 'semi'
      const altFinalCol = displayColumns.find(col => /final/i.test(String(col?.title || '')) && !/semi/i.test(String(col?.title || '')));
      if (altFinalCol && Array.isArray(altFinalCol.matches) && altFinalCol.matches.length > 0) {
        return altFinalCol.matches[0];
      }
      // Si no hay columna de final, intentar calcularla a partir de los ganadores de semifinales
      const semCol = displayColumns.find(col => /semi/i.test(String(col?.title || '')));
      if (semCol && Array.isArray(semCol.matches) && semCol.matches.length >= 2) {
        const winners = semCol.matches.map(getMatchWinner).filter(Boolean);
        if (winners.length >= 2) {
          return {
            homeTeam: winners[0].name,
            homeLogo: winners[0].logo,
            awayTeam: winners[1].name,
            awayLogo: winners[1].logo,
            homeScore: null,
            awayScore: null,
            scoreText: '- -',
            dateTime: 'Por determinar',
            state: 'scheduled',
          };
        }
      }
      return null;
    }

    // Solo un partido por puesto, en orden, ganador arriba
    const bracketFinal = getBracketFinalMatch();
    const placementMatchesOrdered = puestoRegexes.map((re, idx) => {
      let match = null;
      if (idx === 0 && bracketFinal) {
        // Buscar en placements el partido que coincida con la final real del bracket
        const matchFromPlacements = placementMatchesFiltered.find(m => {
          // Coinciden ambos equipos (sin importar el orden) y fecha
          const teamsBracket = [String(bracketFinal.homeTeam).toLowerCase(), String(bracketFinal.awayTeam).toLowerCase()].sort().join('|');
          const teamsPlacement = [String(m.homeTeam).toLowerCase(), String(m.awayTeam).toLowerCase()].sort().join('|');
          const dateBracket = String(bracketFinal.dateTime || '').split('T')[0];
          const datePlacement = String(m.dateTime || '').split('T')[0];
          return teamsBracket === teamsPlacement && dateBracket === datePlacement;
        });
        match = matchFromPlacements || bracketFinal;
      } else {
        match = placementMatchesFiltered.find(m => re.test(m._placementTitle));
      }
      return match || null;
    }).filter(Boolean);

    return (
      <ScrollView style={{ flex: 1 }}>
        {/* Editorial header */}
        {!isFullscreen && (
          <View style={styles.editorialHeader}>
            <View style={[styles.seasonBadge, { backgroundColor: Colors.primary }]}>
              <Text style={styles.seasonBadgeText}>{seasonBadgeLabel}</Text>
            </View>
            <Text style={[styles.editorialTitle, { color: Colors.primary }]}>CUADRO DE FINALES</Text>
            <View style={[styles.editorialUnderline, { backgroundColor: Colors.primary }]} />
          </View>
        )}

        {/* Horizontal bracket scroll */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToOffsets={phaseSnapOffsets}
          snapToAlignment="start"
          decelerationRate={0.685}
          disableIntervalMomentum
          directionalLockEnabled
          contentContainerStyle={styles.bracketContainer}
        >
          {displayColumns.map((col, cIdx) => (
            <BracketColumn
              key={`${String(col?.title || 'col').toLowerCase().trim()}-${cIdx}-${(col?.matches || []).length}`}
              col={col}
              cIdx={cIdx}
              totalColumns={displayColumns.length}
              Colors={Colors}
              renderMatchCard={renderMatchCard}
            />
          ))}

          {/* Placement matches (3rd/4th etc.) */}
          {!isFullscreen && placementMatchesOrdered.length > 0 && (
            <View style={[
              styles.columnWrapper,
              styles.placementsColumn,
              { borderLeftColor: Colors.border, marginRight: 10, /* solo 10px de margen derecho */ }
            ]}>
              <Text style={styles.phaseTitleText}>CLASIFICACIÓN FINAL</Text>
              <View style={[styles.matchesGroup, { width: PHASE_CARD_WIDTH }]}> 
                {placementMatchesOrdered.map((m, idx) => {
                  if (!m) return null;
                  return (
                    <View key={buildMatchStableKey(m, `placement-${idx}`)}>
                      {renderMatchCard(m, true)}
                    </View>
                  );
                })}
              </View>
            </View>
          )}
        </ScrollView>

        <View style={{ height: 100 }} />
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: Colors.background }]}>
      {!isFullscreen && (
        <View style={[styles.header, { backgroundColor: Colors.surface, borderBottomColor: Colors.border, borderBottomWidth: 1 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <MaterialIcons name="arrow-back" size={24} color={Colors.primary} />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <MaterialIcons name="emoji-events" size={20} color={Colors.primary} style={{ marginRight: 8 }} />
            <Text style={[styles.headerTitleText, { color: Colors.primary }]}>
              {title ? title.toUpperCase() : 'TORNEO'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.navigate('Info', { tournamentUrl: url, title: title || 'Información' })}
          >
            <MaterialIcons name="info-outline" size={24} color={Colors.primary} />
          </TouchableOpacity>
        </View>
      )}

      {renderContent()}

      <TouchableOpacity
        style={[styles.fullscreenBtn, { backgroundColor: Colors.surface }]}
        onPress={toggleFullscreen}
      >
        <MaterialIcons name={isFullscreen ? "fullscreen-exit" : "fullscreen"} size={28} color={Colors.primary} />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1 },

  // ── Header ──────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md, 
    paddingVertical: Spacing.sm,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  headerTitleText: { fontSize: 16, fontWeight: '900', letterSpacing: -0.5 },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },

  // ── Editorial header ─────────────────────────────────────────────────────
  editorialHeader: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
  },
  seasonBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 99,
    marginBottom: 8,
  },
  seasonBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  editorialTitle: { fontSize: 32, fontWeight: '900', letterSpacing: -1 },
  editorialUnderline: { height: 4, width: 60, marginTop: 8 },

  // ── Bracket layout ───────────────────────────────────────────────────────
  bracketContainer: {
    paddingLeft: 30,
    paddingRight: 35,
    flexDirection: 'row',
    alignItems: 'center',
  },
  columnWrapper: {
    marginRight: 0,             // spacing handled by CONNECTOR_WIDTH corridor
    alignItems: 'flex-start',
  },
  matchesGroup: {
    gap: CARD_GAP,
  },
  placementsColumn: {
    borderLeftWidth: 1,
    paddingLeft: 86, // Espacio entre el borde y la tarjeta
    marginLeft: 32, // Más separación desde la columna anterior
    // marginRight eliminado para evitar mini-scroll, se pone solo en el render
    overflow: 'hidden',
  },
  phaseTitleText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#94a3b8',
    letterSpacing: 1.5,
    marginBottom: 16,
    marginLeft: 4,
  },

  // ── Connector lines ──────────────────────────────────────────────────────
  connLine: {
    position: 'absolute',
    backgroundColor: '#cbd5e1',
  },

  // ── Match card ───────────────────────────────────────────────────────────
  matchCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  matchCardShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    borderWidth: 0,
  },
  matchCardHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 12,
  },
  matchDateText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94a3b8',
    textTransform: 'uppercase',
  },
  matchTeamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  teamInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  logoContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  matchLogo: { width: '100%', height: '100%', resizeMode: 'cover' },
  matchTeamName: { fontSize: 13, fontWeight: '700', flex: 1 },
  matchScore: { fontSize: 18, fontWeight: '900' },
  winnerScore: { color: '#001f3d' },
  loserRow: { opacity: 0.4 },
  statusBadgeContainer: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.03)',
    marginTop: 12,
    paddingTop: 8,
    alignItems: 'center',
  },
  statusBadge: {
    fontSize: 9,
    fontWeight: '900',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 99,
  },

  // ── Misc ─────────────────────────────────────────────────────────────────
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 14, fontWeight: '600', marginTop: 12 },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  icon: { marginBottom: 20 },
  emptyText: { fontSize: 18, fontWeight: '900', textAlign: 'center', marginBottom: 8 },
  subText: { fontSize: 14, textAlign: 'center', opacity: 0.6 },
  fullscreenBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
    zIndex: 100,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
});