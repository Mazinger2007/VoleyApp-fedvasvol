import React, { useState, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, useWindowDimensions, ScrollView, Platform } from 'react-native';
import PagerView from './PagerViewWrapper';
import { Spacing, Radius, Typography, Shadow, Colors } from '../styles/theme';
import { useTheme } from '../contexts/ThemeContext';
import { MaterialIcons } from '@expo/vector-icons';
import { formatMatchDisplayDate, formatMatchTime, getMatchSummary } from './MatchList';

const Bracket = ({ championshipData, onMatchPress }) => {
  const { colors: ThemeColors, isDark } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const [currentPage, setCurrentPage] = useState(0);
  const pagerRef = useRef(null);

  const { mainFlow = [], placements = [] } = championshipData || {};

  const handlePageSelect = (e) => {
    setCurrentPage(e.nativeEvent.position);
  };

  const renderMatchCard = (match, pIdx, cIdx, mIdx) => {
    const isFinished = match.scoreText && match.scoreText !== '- -' && !match.scoreText.includes('-');
    
    const summary = getMatchSummary(match);

    const displayTimeString = summary.dateLabel 
      ? `${summary.dateLabel}${summary.time && summary.time !== '--:--' ? ` · ${summary.time}` : ''}`
      : 'Pendiente';

    return (
      <TouchableOpacity
        key={`match-${pIdx}-${cIdx}-${mIdx}`}
        activeOpacity={0.8}
        onPress={() => onMatchPress(match)}
        style={[
          styles.matchCard,
          { backgroundColor: ThemeColors.surface, borderColor: ThemeColors.border },
          Shadow.sm
        ]}
      >
        <View style={styles.matchHeader}>
          <Text style={[styles.matchTitle, { color: ThemeColors.textMuted }]}>{match.title || 'Partido'}</Text>
          <Text style={[styles.matchDate, { color: ThemeColors.textMuted }]}>
            {displayTimeString.toUpperCase()}
          </Text>
        </View>

        <View style={styles.teamRow}>
          <View style={styles.teamInfo}>
            {match.homeLogo ? (
              <Image source={{ uri: match.homeLogo }} style={styles.logo} resizeMode="contain" />
            ) : (
              <View style={[styles.logoPlaceholder, { backgroundColor: ThemeColors.surfaceAlt }]}>
                 <MaterialIcons name="shield" size={14} color={ThemeColors.textMuted} />
              </View>
            )}
            <Text style={[styles.teamName, { color: ThemeColors.textPrimary }]} numberOfLines={1}>{match.homeTeam}</Text>
          </View>
          <Text style={[styles.score, { color: ThemeColors.primary }]}>
            {match.scoreText?.split('-')[0]?.trim() || '-'}
          </Text>
        </View>

        <View style={styles.teamRow}>
          <View style={styles.teamInfo}>
            {match.awayLogo ? (
              <Image source={{ uri: match.awayLogo }} style={styles.logo} resizeMode="contain" />
            ) : (
              <View style={[styles.logoPlaceholder, { backgroundColor: ThemeColors.surfaceAlt }]}>
                 <MaterialIcons name="shield" size={14} color={ThemeColors.textMuted} />
              </View>
            )}
            <Text style={[styles.teamName, { color: ThemeColors.textPrimary }]} numberOfLines={1}>{match.awayTeam}</Text>
          </View>
          <Text style={[styles.score, { color: ThemeColors.primary }]}>
            {match.scoreText?.split('-')[1]?.trim() || '-'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (!mainFlow.length && !placements.length) {
    return (
      <View style={styles.emptyContainer}>
        <MaterialIcons name="emoji-events" size={48} color={ThemeColors.textMuted} />
        <Text style={[styles.emptyText, { color: ThemeColors.textSecondary }]}>No hay datos del cuadro disponibles</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Round Header / Indicator - Only show if there's more than one phase */}
      {mainFlow.length > 1 && (
        <View style={[styles.header, { borderBottomColor: ThemeColors.border }]}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            contentContainerStyle={styles.tabsContainer}
          >
            {mainFlow.map((round, index) => (
              <TouchableOpacity
                key={`tab-${index}`}
                onPress={() => pagerRef.current?.setPage(index)}
                style={[
                  styles.tab,
                  currentPage === index && { borderBottomColor: ThemeColors.primary }
                ]}
              >
                <Text style={[
                  styles.tabText,
                  { color: currentPage === index ? ThemeColors.primary : ThemeColors.textMuted },
                  currentPage === index && styles.tabTextActive
                ]}>
                  {round.title}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Main Rounds Pager */}
      <PagerView
        ref={pagerRef}
        style={styles.pager}
        initialPage={0}
        onPageSelected={handlePageSelect}
      >
        {mainFlow.length > 0 ? (
          mainFlow.map((phase, pIdx) => (
            <View key={`phase-${pIdx}`} style={styles.page}>
              <ScrollView 
                contentContainerStyle={[
                  styles.roundContent, 
                  { paddingBottom: placements.length > 0 ? 160 : Spacing.xl }
                ]}
              >
                {phase.blocks?.map((block, bIdx) => {
                  if (block.type === 'bracket') {
                    return (
                      <ScrollView 
                        key={`bracket-${bIdx}`}
                        horizontal 
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.columnsContainer}
                      >
                        {block.columns.map((col, cIdx) => (
                          <View key={`col-${pIdx}-${cIdx}`} style={styles.column}>
                            {col.header ? <Text style={[styles.colHeader, { color: ThemeColors.textMuted }]}>{col.header}</Text> : null}
                            <View style={styles.matchesList}>
                              {col.matches.map((m, mIdx) => renderMatchCard(m, pIdx, cIdx, mIdx))}
                            </View>
                          </View>
                        ))}
                      </ScrollView>
                    );
                  }
                  if (block.type === 'table') {
                    return (
                      <View key={`tab-${bIdx}`} style={{ marginBottom: Spacing.xl }}>
                        <Text style={[styles.colHeader, { color: ThemeColors.textMuted, marginBottom: Spacing.md }]}>
                          CLASIFICACIÓN
                        </Text>
                        <View style={{ borderRadius: Radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: ThemeColors.border }}>
                          {/* We could use CompetitionTable here, but keeping it simple for now to avoid dependency cycles or complex props */}
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
          ))
        ) : (
          <View style={styles.page} />
        )}
      </PagerView>

      {/* Fixed Bottom Section for Placements */}
      {placements.length > 0 && (
        <View style={[
          styles.placementsContainer, 
          { 
            backgroundColor: isDark ? '#1a222a' : '#f8f9fa', 
            borderTopColor: ThemeColors.border 
          }
        ]}>
          <View style={styles.placementsHeader}>
            <MaterialIcons name="insights" size={14} color={ThemeColors.primary} />
            <Text style={[styles.placementsTitle, { color: ThemeColors.textMuted }]}>PUESTOS FINALES</Text>
          </View>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            contentContainerStyle={styles.placementsScroll}
          >
            {placements.map((p, pIdx) => (
              <View key={`placement-${pIdx}`} style={styles.placementGroup}>
                <Text style={[styles.placementLabel, { color: ThemeColors.primary }]}>{p.title}</Text>
                {p.blocks?.map((block) => {
                   if (block.type === 'bracket') {
                     return block.columns.map(col => col.matches.map((m, mIdx) => (
                       <TouchableOpacity
                         key={`pm-${pIdx}-${mIdx}`}
                         activeOpacity={0.7}
                         onPress={() => onMatchPress(m)}
                         style={[
                           styles.smallMatchCard, 
                           { backgroundColor: ThemeColors.surface, borderColor: ThemeColors.border },
                           Shadow.sm
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
                     )));
                   }
                   return null;
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
    width: 280,
    marginRight: Spacing.xl,
  },
  colHeader: {
    fontSize: 11,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginBottom: Spacing.sm,
    letterSpacing: 1.5,
    opacity: 0.8,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: 'bold',
    marginVertical: Spacing.md,
  },
  matchesList: {
    gap: 12,
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
