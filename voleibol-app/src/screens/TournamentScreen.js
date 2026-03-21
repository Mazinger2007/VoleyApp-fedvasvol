import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { Spacing, Typography, Radius } from '../styles/theme';
import { fetchChampionshipData } from '../utils/htmlParser';

export default function TournamentScreen({ route, navigation }) {
  const { colors: Colors, isDark } = useTheme();
  const { title, url } = route.params || {};

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadData() {
      if (!url) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const result = await fetchChampionshipData(url);
        setData(result);
      } catch (err) {
        console.error('[Tournament] Error loading data:', err);
        setError('No se pudo cargar la información del torneo.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [url]);

  const renderMatchCard = (match, isPlacement = false) => {
    const homeScore = parseInt(match.homeScore) || 0;
    const awayScore = parseInt(match.awayScore) || 0;
    const isFinished = match.state === 'finished' || (match.scoreText && match.scoreText !== '- -');
    const homeWinner = isFinished && homeScore > awayScore;
    const awayWinner = isFinished && awayScore > homeScore;

    return (
      <View 
        key={`${match.homeTeam}-${match.awayTeam}-${match.dateTime}`} 
        style={[
          styles.matchCard, 
          { backgroundColor: Colors.surface, borderColor: isPlacement ? Colors.border : 'transparent' },
          !isPlacement && styles.matchCardShadow
        ]}
      >
        <View style={styles.matchCardHeader}>
          <Text style={styles.matchDateText}>{match.dateTime || 'TBD'}</Text>
        </View>

        <View style={styles.matchTeams}>
          {/* Home Team */}
          <View style={[styles.matchTeamRow, !isPlacement && awayWinner && styles.leaserOpacity]}>
            <View style={styles.teamInfo}>
              <View style={[styles.logoContainer, { backgroundColor: Colors.surfaceAlt }]}>
                {match.homeLogo ? (
                  <Image source={{ uri: match.homeLogo }} style={styles.matchLogo} />
                ) : (
                  <MaterialIcons name="shield" size={20} color={Colors.textMuted} />
                )}
              </View>
              <Text style={[styles.matchTeamName, { color: Colors.textPrimary }]} numberOfLines={1}>
                {match.homeTeam}
              </Text>
            </View>
            <Text style={[styles.matchScore, { color: Colors.textPrimary }, homeWinner && styles.winnerScore]}>
              {match.homeScore ?? '-'}
            </Text>
          </View>

          {/* Away Team */}
          <View style={[styles.matchTeamRow, !isPlacement && homeWinner && styles.leaserOpacity]}>
            <View style={styles.teamInfo}>
              <View style={[styles.logoContainer, { backgroundColor: Colors.surfaceAlt }]}>
                {match.awayLogo ? (
                  <Image source={{ uri: match.awayLogo }} style={styles.matchLogo} />
                ) : (
                  <MaterialIcons name="shield" size={20} color={Colors.textMuted} />
                )}
              </View>
              <Text style={[styles.matchTeamName, { color: Colors.textPrimary }]} numberOfLines={1}>
                {match.awayTeam}
              </Text>
            </View>
            <Text style={[styles.matchScore, { color: Colors.textPrimary }, awayWinner && styles.winnerScore]}>
              {match.awayScore ?? '-'}
            </Text>
          </View>
        </View>

        {isFinished && (
          <View style={styles.statusBadgeContainer}>
            <Text style={[styles.statusBadge, { color: Colors.tertiary, backgroundColor: Colors.tertiary + '15' }]}>
              FINALIZADO
            </Text>
          </View>
        )}
      </View>
    );
  };

  const renderChampion = (championName, logo) => {
    return (
      <View style={[styles.championCard, { backgroundColor: Colors.primary }]}>
        <View style={styles.championDecoration}>
          <MaterialIcons name="auto-awesome" size={20} color="rgba(255,255,255,0.3)" style={{ position: 'absolute', top: 10, left: 10 }} />
          <MaterialIcons name="star" size={16} color="rgba(255,255,255,0.3)" style={{ position: 'absolute', top: 40, right: 20 }} />
        </View>
        
        <View style={styles.championLogoCircle}>
          {logo ? (
            <Image source={{ uri: logo }} style={styles.championLogo} />
          ) : (
            <MaterialIcons name="emoji-events" size={60} color={Colors.primary} />
          )}
          <View style={styles.trophyIconBadge}>
             <MaterialIcons name="emoji-events" size={16} color="#FFD700" />
          </View>
        </View>

        <Text style={styles.championLabel}>¡CAMPEÓN!</Text>
        <Text style={styles.championName}>{championName.toUpperCase()}</Text>
        <Text style={styles.championSub}>{title}</Text>
        
        <TouchableOpacity style={styles.galleryBtn}>
          <Text style={styles.galleryBtnText}>GALERÍA DEL CAMPEÓN</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const flattenedColumns = React.useMemo(() => {
    if (!data || !data.mainFlow) return [];
    
    // Aligned columns: array of { title: string, matches: Match[] }
    const columns = [];
    const seenMatchKeys = new Set();

    data.mainFlow.forEach((phase) => {
      (phase.blocks || []).forEach((block) => {
        if (block.type === 'bracket' && block.columns) {
          block.columns.forEach((col, colIdx) => {
            // Ensure we have a column object at this index
            if (!columns[colIdx]) {
              columns[colIdx] = { 
                title: col.header || phase.title || `ROUND ${colIdx + 1}`, 
                matches: [] 
              };
            }

            // Deduplicate and add matches
            (col.matches || []).forEach((m) => {
              const key = `${m.homeTeam}-${m.awayTeam}-${m.dateTime}`.toLowerCase();
              if (!seenMatchKeys.has(key)) {
                seenMatchKeys.add(key);
                columns[colIdx].matches.push(m);
              }
            });
          });
        }
      });
    });

    return columns.filter(c => c.matches.length > 0);
  }, [data]);

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={[styles.loadingText, { color: Colors.textMuted }]}>Cargando esquema del torneo...</Text>
        </View>
      );
    }

    if (error || !data || (flattenedColumns.length === 0 && data.placements.length === 0)) {
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

    // Determine if there's a winner
    let champion = null;
    if (flattenedColumns.length > 0) {
      const lastCol = flattenedColumns[flattenedColumns.length - 1];
      const finalMatch = (lastCol.matches || []).find(m => m.state === 'finished' || (m.scoreText && m.scoreText !== '- -'));
      if (finalMatch) {
         const hScore = parseInt(finalMatch.homeScore) || 0;
         const aScore = parseInt(finalMatch.awayScore) || 0;
         if (hScore > aScore) champion = { name: finalMatch.homeTeam, logo: finalMatch.homeLogo };
         else if (aScore > hScore) champion = { name: finalMatch.awayTeam, logo: finalMatch.awayLogo };
      }
    }

    return (
      <ScrollView style={{ flex: 1 }}>
        <View style={styles.editorialHeader}>
           <View style={[styles.seasonBadge, { backgroundColor: Colors.primary }]}>
             <Text style={styles.seasonBadgeText}>TEMPORADA 2024/25</Text>
           </View>
           <Text style={[styles.editorialTitle, { color: Colors.primary }]}>CUADRO DE FINALES</Text>
           <View style={[styles.editorialUnderline, { backgroundColor: Colors.primary }]} />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bracketContainer}>
          {flattenedColumns.map((col, cIdx) => (
            <View key={`col-${cIdx}`} style={styles.phaseColumn}>
              <Text style={styles.phaseTitleText}>{col.title.toUpperCase()}</Text>
              <View style={styles.matchesGroup}>
                {col.matches.map((m, mIdx) => renderMatchCard(m))}
              </View>
            </View>
          ))}

          {champion && (
            <View style={styles.phaseColumn}>
              <Text style={styles.phaseTitleText}>GANADOR</Text>
              {renderChampion(champion.name, champion.logo)}
            </View>
          )}

          {data.placements.length > 0 && (
            <View style={[styles.phaseColumn, styles.placementsColumn, { borderLeftColor: Colors.border }]}>
               <Text style={styles.phaseTitleText}>CLASIFICACIÓN FINAL</Text>
               <View style={styles.matchesGroup}>
                 {data.placements.flatMap(p => (p.blocks || []).flatMap(b => (b.columns || []).flatMap(c => c.matches || []))).map((m, idx) => {
                    const key = `placement-${m.homeTeam}-${m.awayTeam}-${idx}`;
                    return renderMatchCard(m, true);
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
        <TouchableOpacity style={styles.backBtn}>
          <MaterialIcons name="notifications-none" size={24} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {renderContent()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  headerTitleText: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  backBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
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
  seasonBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  editorialTitle: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -1,
  },
  editorialUnderline: {
    height: 4,
    width: 60,
    marginTop: 8,
  },
  bracketContainer: {
    paddingLeft: 24,
    paddingRight: 100,
    flexDirection: 'row',
  },
  phaseColumn: {
    width: 280,
    marginRight: 40,
  },
  phaseTitleText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#94a3b8',
    letterSpacing: 1.5,
    marginBottom: 16,
    marginLeft: 4,
  },
  matchesGroup: {
    gap: 16,
  },
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
  matchTeams: {
    gap: 12,
  },
  matchTeamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  matchLogo: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  matchTeamName: {
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  matchScore: {
    fontSize: 18,
    fontWeight: '900',
  },
  winnerScore: {
    color: '#001f3d', // Highlight logic could be added
  },
  leaserOpacity: {
    opacity: 0.35,
  },
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
  championCard: {
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,215,0,0.3)',
  },
  championDecoration: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.2,
  },
  championLogoCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#FFF',
    padding: 4,
    marginBottom: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
  },
  championLogo: {
    width: '100%',
    height: '100%',
    borderRadius: 44,
  },
  trophyIconBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: '#001f3d',
    borderRadius: 12,
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  championLabel: {
    color: '#FFD700',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 3,
    marginBottom: 8,
  },
  championName: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 4,
  },
  championSub: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  galleryBtn: {
    marginTop: 24,
    backgroundColor: '#FFD700',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  galleryBtnText: {
    color: '#001f3d',
    fontSize: 11,
    fontWeight: '900',
  },
  placementsColumn: {
    borderLeftWidth: 1,
    paddingLeft: 40,
    marginRight: 0,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  icon: { marginBottom: 20 },
  emptyText: {
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 8,
  },
  subText: {
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.6,
  },
});
