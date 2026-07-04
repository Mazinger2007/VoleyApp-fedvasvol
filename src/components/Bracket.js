import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, useWindowDimensions } from 'react-native';
import PagerView from './PagerViewWrapper';
import { Spacing, Radius, Shadow } from '../styles/theme';
import { useTheme } from '../contexts/ThemeContext';
import { MaterialIcons } from '@expo/vector-icons';
import { getMatchSummary } from './MatchList';
import BaseTeamLogo from './base/TeamLogo';

const CARD_GAP = 16;
const CONNECTOR_WIDTH = 40;
const PHASE_CARD_WIDTH = 300;

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

    let yTop = 0;
    for (let k = 0; k < topIdx; k++) {
      yTop += (cardHeights[k] ?? 0) + CARD_GAP;
    }
    yTop += hTop / 2;

    let yBot = 0;
    for (let k = 0; k < botIdx; k++) {
      yBot += (cardHeights[k] ?? 0) + CARD_GAP;
    }
    yBot += hBot / 2;

    const yMid = (yTop + yBot) / 2;
    const verticalHeight = yBot - yTop;
    const isFirstPhaseWithFour = isFirstPhase && totalMatches === 4;
    const topWidth = CONNECTOR_WIDTH;
    const bottomWidth = (isFirstPhaseWithFour && i === 0) ? CONNECTOR_WIDTH * 2 : CONNECTOR_WIDTH;
    const nextTopEquivalentWidth = (isFirstPhaseWithFour && i === 1) ? CONNECTOR_WIDTH * 2 : CONNECTOR_WIDTH;
    const effectiveTopWidth = i === 1 ? nextTopEquivalentWidth : topWidth;

    lines.push(
      <View
        key={`h-top-${i}-${Math.round(yTop)}`}
        style={[styles.connLine, { top: yTop - 1, left: 0, width: effectiveTopWidth, height: 2 }]}
      />,
      <View
        key={`h-bot-${i}-${Math.round(yBot)}`}
        style={[styles.connLine, { top: yBot - 1, left: 0, width: bottomWidth, height: 2 }]}
      />,
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

function BracketColumn({ col, cIdx, totalColumns, colors, renderMatchCard }) {
  const [cardHeights, setCardHeights] = useState({});
  const matchCount = col.matches.length;
  const hasConnectors = cIdx < totalColumns - 1 && matchCount >= 2;

  const handleCardLayout = useCallback((mIdx, event) => {
    const { height } = event.nativeEvent.layout;
    setCardHeights((prev) => {
      if (prev[mIdx] === height) return prev;
      return { ...prev, [mIdx]: height };
    });
  }, []);

  return (
    <View style={styles.columnWrapper}>
      <Text style={[styles.phaseTitleText, { color: colors.textMuted }]}>{String(col.header || col.title || 'Fase').toUpperCase()}</Text>
      <View style={{ flexDirection: 'row' }}>
        <View style={[styles.matchesGroup, { width: PHASE_CARD_WIDTH }]}> 
          {col.matches.map((m, mIdx) => (
            <View
              key={`${String(col.header || col.title || 'col').toLowerCase().trim()}-${cIdx}-${mIdx}`}
              onLayout={(e) => handleCardLayout(mIdx, e)}
            >
              {renderMatchCard(m, `match-${cIdx}-${mIdx}`)}
            </View>
          ))}
        </View>

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

const Bracket = ({ championshipData, onMatchPress }) => {
  const { colors: ThemeColors, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const { mainFlow = [], placements = [] } = championshipData || {};
  const pagerRef = useRef(null);
  const [currentPage, setCurrentPage] = useState(0);

  const compactColumnWidth = useMemo(() => (width < 900 ? 272 : PHASE_CARD_WIDTH), [width]);

  const renderMatchCard = useCallback((match, keySuffix = '') => {
    const summary = getMatchSummary(match);
    const displayTimeString = summary.dateLabel
      ? `${summary.dateLabel}${summary.time && summary.time !== '--:--' ? ` · ${summary.time}` : ''}`
      : 'Pendiente';
    const { homeScore, awayScore } = getMatchScores(match);

    return (
      <TouchableOpacity
        key={keySuffix}
        activeOpacity={0.82}
        onPress={() => onMatchPress(match)}
        style={[
          styles.matchCard,
          { backgroundColor: ThemeColors.surface, borderColor: ThemeColors.border },
          Shadow.sm,
        ]}
      >
        <View style={styles.matchHeader}>
          <Text style={[styles.matchTitle, { color: ThemeColors.textMuted }]} numberOfLines={1}>
            {match.title || 'Partido'}
          </Text>
          <Text style={[styles.matchDate, { color: ThemeColors.textMuted }]}>
            {displayTimeString.toUpperCase()}
          </Text>
        </View>

        <View style={styles.teamRow}>
          <View style={styles.teamInfo}>
            {match.homeLogo ? (
              <BaseTeamLogo uri={match.homeLogo} name={match.homeTeam} size={28} style={{ borderWidth: 1, borderColor: 'rgba(13, 143, 242, 0.20)' }} />
            ) : (
              <View style={[styles.logoPlaceholder, { backgroundColor: ThemeColors.surfaceAlt }]}>
                <MaterialIcons name="shield" size={14} color={ThemeColors.textMuted} />
              </View>
            )}
            <Text style={[styles.teamName, { color: ThemeColors.textPrimary }]} numberOfLines={1}>
              {match.homeTeam}
            </Text>
          </View>
          <Text style={[styles.score, { color: ThemeColors.primary }]}>
            {(homeScore ?? match.scoreText?.split('-')[0]?.trim()) || '-'}
          </Text>
        </View>

        <View style={styles.teamRow}>
          <View style={styles.teamInfo}>
            {match.awayLogo ? (
              <BaseTeamLogo uri={match.awayLogo} name={match.awayTeam} size={28} style={{ borderWidth: 1, borderColor: 'rgba(13, 242, 143, 0.20)' }} />
            ) : (
              <View style={[styles.logoPlaceholder, { backgroundColor: ThemeColors.surfaceAlt }]}>
                <MaterialIcons name="shield" size={14} color={ThemeColors.textMuted} />
              </View>
            )}
            <Text style={[styles.teamName, { color: ThemeColors.textPrimary }]} numberOfLines={1}>
              {match.awayTeam}
            </Text>
          </View>
          <Text style={[styles.score, { color: ThemeColors.primary }]}>
            {(awayScore ?? match.scoreText?.split('-')[1]?.trim()) || '-'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }, [ThemeColors, onMatchPress]);

  if (!mainFlow.length && !placements.length) {
    return (
      <View style={styles.emptyContainer}>
        <MaterialIcons name="emoji-events" size={48} color={ThemeColors.textMuted} />
        <Text style={[styles.emptyText, { color: ThemeColors.textSecondary }]}>No hay datos del cuadro disponibles</Text>
      </View>
    );
  }

  const renderPhase = (phase, pIdx) => (
    <View key={`phase-${pIdx}`} style={styles.page}>
      <ScrollView contentContainerStyle={[styles.roundContent, { paddingBottom: placements.length > 0 ? 160 : Spacing.xl }]}>
        {phase.blocks?.map((block, bIdx) => {
          if (block.type === 'bracket') {
            const columns = Array.isArray(block.columns) ? block.columns : [];
            return (
              <ScrollView
                key={`bracket-${bIdx}`}
                horizontal
                showsHorizontalScrollIndicator={false}
                snapToOffsets={columns.map((_, index) => index * (compactColumnWidth + CONNECTOR_WIDTH * 1.5))}
                snapToAlignment="start"
                decelerationRate={0.685}
                directionalLockEnabled
                contentContainerStyle={styles.columnsContainer}
              >
                {columns.map((col, cIdx) => (
                  <View key={`col-${pIdx}-${cIdx}`} style={[styles.column, { width: compactColumnWidth }]}>
                    <BracketColumn
                      col={col}
                      cIdx={cIdx}
                      totalColumns={columns.length}
                      colors={ThemeColors}
                      renderMatchCard={renderMatchCard}
                    />
                  </View>
                ))}
              </ScrollView>
            );
          }

          if (block.type === 'table') {
            return (
              <View key={`tab-${bIdx}`} style={{ marginBottom: Spacing.xl }}>
                <Text style={[styles.sectionLabel, { color: ThemeColors.textMuted, marginBottom: Spacing.md }]}>CLASIFICACIÓN</Text>
                <View style={{ borderRadius: Radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: ThemeColors.border }}>
                  <Text style={{ padding: 20, color: ThemeColors.textSecondary, textAlign: 'center', fontSize: 12 }}>
                    Esta fase contiene una tabla de clasificación.
                  </Text>
                </View>
              </View>
            );
          }

          if (block.type === 'heading' && block.level > 1) {
            return <Text key={`h-${bIdx}`} style={[styles.sectionHeading, { color: ThemeColors.textPrimary }]}>{block.content}</Text>;
          }

          return null;
        })}
      </ScrollView>
    </View>
  );

  return (
    <View style={styles.container}>
      {mainFlow.length > 1 && (
        <View style={[styles.header, { borderBottomColor: ThemeColors.border }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsContainer}>
            {mainFlow.map((round, index) => (
              <TouchableOpacity
                key={`tab-${index}`}
                onPress={() => pagerRef.current?.setPage(index)}
                style={[styles.tab, currentPage === index && { borderBottomColor: ThemeColors.primary }]}
              >
                <Text
                  style={[
                    styles.tabText,
                    { color: currentPage === index ? ThemeColors.primary : ThemeColors.textMuted },
                    currentPage === index && styles.tabTextActive,
                  ]}
                >
                  {round.title}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {mainFlow.length > 0 ? (
        <PagerView
          ref={pagerRef}
          style={styles.pager}
          initialPage={0}
          onPageSelected={(e) => setCurrentPage(e.nativeEvent.position)}
        >
          {mainFlow.map((phase, pIdx) => renderPhase(phase, pIdx))}
        </PagerView>
      ) : (
        <View style={styles.page} />
      )}

      {placements.length > 0 && (
        <View style={[
          styles.placementsContainer,
          {
            backgroundColor: isDark ? '#1a222a' : '#f8f9fa',
            borderTopColor: ThemeColors.border,
          },
        ]}>
          <View style={styles.placementsHeader}>
            <MaterialIcons name="insights" size={14} color={ThemeColors.primary} />
            <Text style={[styles.placementsTitle, { color: ThemeColors.textMuted }]}>PUESTOS FINALES</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.placementsScroll}>
            {placements.map((p, pIdx) => (
              <View key={`placement-${pIdx}`} style={styles.placementGroup}>
                <Text style={[styles.placementLabel, { color: ThemeColors.primary }]}>{p.title}</Text>
                {p.blocks?.map((block) => {
                  if (block.type !== 'bracket') return null;
                  return (block.columns || []).map((col, cIdx) =>
                    (col.matches || []).map((m, mIdx) => (
                      <TouchableOpacity
                        key={`pm-${pIdx}-${cIdx}-${mIdx}`}
                        activeOpacity={0.7}
                        onPress={() => onMatchPress(m)}
                        style={[
                          styles.smallMatchCard,
                          { backgroundColor: ThemeColors.surface, borderColor: ThemeColors.border },
                          Shadow.sm,
                        ]}
                      >
                        <View style={styles.smallTeamRow}>
                          <Text style={[styles.smallTeamName, { color: ThemeColors.textPrimary }]} numberOfLines={1}>{m.homeTeam}</Text>
                          <Text style={[styles.smallScore, { color: ThemeColors.primary }]}>{m.scoreText?.split('-')[0]?.trim() || '-'}</Text>
                        </View>
                        <View style={[styles.smallTeamRow, { marginTop: 4 }]}>
                          <Text style={[styles.smallTeamName, { color: ThemeColors.textPrimary }]} numberOfLines={1}>{m.awayTeam}</Text>
                          <Text style={[styles.smallScore, { color: ThemeColors.primary }]}>{m.scoreText?.split('-')[1]?.trim() || '-'}</Text>
                        </View>
                      </TouchableOpacity>
                    ))
                  );
                })}
              </View>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    height: 48,
    borderBottomWidth: 1,
    backgroundColor: 'transparent',
  },
  tabsContainer: {
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
  },
  tab: {
    paddingHorizontal: Spacing.lg,
    height: '100%',
    justifyContent: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tabTextActive: {
    fontWeight: 'bold',
  },
  pager: {
    flex: 1,
  },
  page: {
    flex: 1,
  },
  roundContent: {
    padding: Spacing.lg,
  },
  columnsContainer: {
    paddingRight: Spacing.xl,
    flexDirection: 'row',
  },
  column: {
    marginRight: Spacing.xl,
  },
  columnWrapper: {
    width: '100%',
  },
  phaseTitleText: {
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginBottom: Spacing.sm,
    letterSpacing: 1.6,
    opacity: 0.82,
  },
  matchesGroup: {
    position: 'relative',
  },
  connLine: {
    position: 'absolute',
    backgroundColor: '#c9d4e6',
    borderRadius: 999,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    opacity: 0.8,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: 'bold',
    marginVertical: Spacing.md,
  },
  matchCard: {
    borderRadius: Radius.lg,
    padding: 16,
    borderWidth: 1,
  },
  matchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128,128,128,0.1)',
    paddingBottom: 8,
  },
  matchTitle: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    flex: 1,
    paddingRight: 8,
  },
  matchDate: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  teamRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 6,
  },
  teamInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  logo: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  logoPlaceholder: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  teamName: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  score: {
    fontSize: 18,
    fontWeight: 'bold',
    minWidth: 30,
    textAlign: 'right',
  },
  placementsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 12,
    borderTopWidth: 1,
    height: 155,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.1,
        shadowRadius: 5,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  placementsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 10,
  },
  placementsTitle: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  placementsScroll: {
    paddingHorizontal: Spacing.lg,
    gap: 16,
    paddingBottom: 20,
  },
  placementGroup: {
    minWidth: 160,
  },
  placementLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  smallMatchCard: {
    borderRadius: Radius.md,
    padding: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  smallTeamRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  smallTeamName: {
    fontSize: 11,
    fontWeight: '500',
    flex: 1,
  },
  smallScore: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 15,
    textAlign: 'center',
    opacity: 0.7,
  },
});

export default Bracket;
