import React, { useMemo, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StatusBar,
  StyleSheet,
  useWindowDimensions,
  Platform,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { Radius, Spacing, Typography } from '../styles/theme';
import { useTheme } from '../contexts/ThemeContext';
import { getMatchSummary, formatMatchDisplayDate, rowToMatch } from '../components/MatchList';
import { fetchAndParse } from '../utils/htmlParser';
import { 
  getCachedLogoColorSync, 
  requestLogoColorExtraction, 
  subscribeToLogoColor 
} from '../utils/logoColorCache';
import { getDominantBorderColor } from '../utils/imageColor';

function TeamLogo({ uri, name, isDark, colors }) {
  const [bgColor, setBgColor] = useState(getCachedLogoColorSync(uri) || (isDark ? '#0f172a' : '#f8fafc'));

  useEffect(() => {
    if (!uri) return;
    
    // Check cache again in case it hydrated since component mount
    const cached = getCachedLogoColorSync(uri);
    if (cached) setBgColor(cached);

    // Request extraction (queue system)
    requestLogoColorExtraction(uri, getDominantBorderColor);

    // Subscribe to updates
    const unsubscribe = subscribeToLogoColor(uri, (newColor) => {
      if (newColor) setBgColor(newColor);
    });

    return unsubscribe;
  }, [uri]);

  return (
    <View style={[styles.logoWrap, { backgroundColor: bgColor }]}>
      {uri ? (
        <Image 
          source={{ uri }} 
          style={{ width: '95%', height: '95%' }} 
          resizeMode="contain"
        />
      ) : (
        <View style={[styles.logoPlaceholder, { backgroundColor: colors.surfaceAlt }]}>
          <Text style={[styles.logoInitial, { color: colors.textMuted }]}>{name?.[0] || '?'}</Text>
        </View>
      )}
    </View>
  );
}

function MatchCard({ match, isDark, colors, onPress }) {
  const navigation = useNavigation();
  const summary = useMemo(() => getMatchSummary(match), [match]);
  const { state, homeTeam, awayTeam, homeScore, awayScore, time, dateLabel, venue, homeLogo, awayLogo } = summary;

  const isLive = state === 'live';
  const isFinished = state === 'finished';

  const statusBg = isLive ? 'rgba(239, 68, 68, 0.15)' : isFinished ? 'rgba(148, 163, 184, 0.1)' : 'rgba(59, 130, 246, 0.1)';
  const statusTabColor = isLive ? '#ef4444' : isFinished ? '#94a3b8' : '#3b82f6';

  return (
    <View style={[
      styles.card,
      { backgroundColor: isDark ? '#1e293b' : '#ffffff', borderColor: isDark ? 'rgba(71, 85, 105, 0.4)' : '#e2e8f0' },
      isLive && { 
        borderLeftWidth: 6, 
        borderLeftColor: '#ef4444', 
        backgroundColor: isDark ? 'rgba(239, 68, 68, 0.08)' : '#fff5f5' 
      }
    ]}>
      <TouchableOpacity 
        activeOpacity={0.7}
        onPress={() => {
          if (onPress) onPress(match);
          navigation.navigate('MatchDetail', { match: { ...match, ...summary } });
        }}
        style={{ flex: 1 }}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.statusTag, { backgroundColor: statusBg }]}>
            {isLive && <View style={styles.liveDot} />}
            <Text style={[styles.statusText, { color: statusTabColor }]}>
              {isLive ? 'EN DIRECTO' : isFinished ? 'FINALIZADO' : 'PRÓXIMO'}
            </Text>
          </View>
          <View style={{ flex: 1 }} />
          <View style={styles.locationWrap}>
            <MaterialIcons name="location-on" size={12} color={colors.textMuted} />
            <Text style={styles.locationText} numberOfLines={1}>{venue}</Text>
          </View>
        </View>

        <View style={styles.teamsRow}>
          <View style={styles.teamCol}>
            <TeamLogo uri={homeLogo} name={homeTeam} isDark={isDark} colors={colors} />
            <Text style={[styles.teamName, { color: isDark ? colors.textPrimary : '#0f172a' }]} numberOfLines={2}>{homeTeam}</Text>
          </View>

          <View style={styles.scoreCol}>
            {(homeScore !== null && awayScore !== null) ? (
              <View style={styles.scoreWrap}>
                <Text style={[styles.scoreText, { color: isDark ? colors.textPrimary : '#001f3d' }]}>{homeScore}</Text>
                <Text style={styles.scoreSep}>-</Text>
                <Text style={[styles.scoreText, { color: isDark ? colors.textPrimary : '#001f3d' }]}>{awayScore}</Text>
              </View>
            ) : (
              <View style={[styles.vsBadge, { backgroundColor: isDark ? colors.surfaceAlt : '#f8fafc' }]}>
                <Text style={styles.vsText}>VS</Text>
              </View>
            )}
            {isLive && (
               <Text style={styles.setInfo}>PARTIDO EN JUEGO</Text>
            )}
          </View>

          <View style={styles.teamCol}>
            <TeamLogo uri={awayLogo} name={awayTeam} isDark={isDark} colors={colors} />
            <Text style={[styles.teamName, { color: isDark ? colors.textPrimary : '#0f172a' }]} numberOfLines={2}>{awayTeam}</Text>
          </View>
        </View>

        <View style={[styles.cardFooter, { borderTopColor: isDark ? 'rgba(71, 85, 105, 0.2)' : '#f1f5f9' }]}>
          <Text style={styles.timeInfo}>
            {time}{time && dateLabel ? ' · ' : ''}{dateLabel}
          </Text>
          <View style={[styles.detailsBtn, { backgroundColor: isDark ? colors.surfaceAlt : colors.primary }]}>
            <Text style={styles.detailsBtnText}>Ver Detalles</Text>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
}

export default function JornadaDetailScreen({ route, navigation }) {
  const { colors: Colors, isDark } = useTheme();
  const { tableBlock, title, subtitle, calendarUrl } = route.params || {};
  
  const [currentTableBlock, setCurrentTableBlock] = useState(tableBlock);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    if (!calendarUrl) return;
    setRefreshing(true);
    try {
      const blocks = await fetchAndParse(calendarUrl);
      // Find the specific table block that matches the current title or contains matches
      const newBlock = blocks.find(b => 
        (b.type === 'table' && (b.title === title || b.title === tableBlock?.title)) ||
        (b.type === 'table' && b.matches?.length > 0)
      );
      if (newBlock) {
        setCurrentTableBlock(newBlock);
      }
    } catch (err) {
      console.error('Error refreshing jornada:', err);
    } finally {
      setRefreshing(false);
    }
  }, [calendarUrl, title, tableBlock]);

  const matchList = useMemo(() => {
    if (currentTableBlock?.matches?.length) return currentTableBlock.matches;
    if (currentTableBlock?.rows?.length) {
      return currentTableBlock.rows.map(row => {
        const m = rowToMatch(row, currentTableBlock.headers);
        return getMatchSummary(m);
      });
    }
    return [];
  }, [currentTableBlock]);

  // Sorting/Grouping
  const sortedMatches = useMemo(() => {
    const live = [];
    const upcoming = [];
    const finished = [];

    matchList.forEach(m => {
      // If it's already a summary, use it. If not, get summary.
      const summary = m.state ? m : getMatchSummary(m);
      if (summary.state === 'live') live.push(summary);
      else if (summary.state === 'finished') finished.push(summary);
      else upcoming.push(summary);
    });

    return { live, upcoming, finished };
  }, [matchList]);

  const handlePressMatch = (match) => {
    navigation.navigate('MatchDetail', { 
      match: { ...match, ...getMatchSummary(match) },
      calendarUrl 
    });
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: Colors.background }]} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={Colors.background} />
      
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: Colors.divider, backgroundColor: isDark ? Colors.background : '#ffffff' }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={24} color={isDark ? Colors.textPrimary : '#001f3d'} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: isDark ? Colors.textPrimary : '#001f3d' }]}>{title || 'Jornada'}</Text>
        <View style={styles.backBtn} />
      </View>


      <ScrollView 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh} 
            colors={[Colors.primary]} 
            tintColor={Colors.primary} 
          />
        }
      >
        {/* LIVE */}
        {sortedMatches.live.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="live-tv" size={16} color="#ef4444" />
              <Text style={[styles.sectionTitle, { color: '#ef4444' }]}>PARTIDOS EN DIRECTO</Text>
            </View>
            {sortedMatches.live.map((m, i) => (
              <MatchCard key={`live-${i}`} match={m} isDark={isDark} colors={Colors} onPress={handlePressMatch} />
            ))}
          </View>
        )}

        {/* UPCOMING */}
        {sortedMatches.upcoming.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="schedule" size={16} color={isDark ? Colors.textMuted : '#64748b'} />
              <Text style={[styles.sectionTitle, { color: isDark ? Colors.textMuted : '#64748b' }]}>PRÓXIMOS PARTIDOS</Text>
            </View>
            {sortedMatches.upcoming.map((m, i) => (
              <MatchCard key={`up-${i}`} match={m} isDark={isDark} colors={Colors} onPress={handlePressMatch} />
            ))}
          </View>
        )}

        {/* FINISHED */}
        {sortedMatches.finished.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="check-circle" size={16} color={isDark ? Colors.textMuted : '#64748b'} />
              <Text style={[styles.sectionTitle, { color: isDark ? Colors.textMuted : '#64748b' }]}>PARTIDOS FINALIZADOS</Text>
            </View>
            {sortedMatches.finished.map((m, i) => (
              <MatchCard key={`fin-${i}`} match={m} isDark={isDark} colors={Colors} onPress={handlePressMatch} />
            ))}
          </View>
        )}

        {matchList.length === 0 && (
          <View style={styles.emptyWrap}>
             <MaterialIcons name="sports-volleyball" size={48} color={Colors.textMuted} />
             <Text style={{ color: Colors.textMuted, marginTop: 12 }}>No hay partidos para esta jornada</Text>
          </View>
        )}
      </ScrollView>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  scrollContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },
  section: {
    gap: 12,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  card: {
    borderRadius: Radius.lg,
    padding: 16,
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: {
        elevation: 1,
      },
      web: {
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      }
    })
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
  },
  locationWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
    justifyContent: 'flex-end',
    marginLeft: 12,
  },
  locationText: {
    fontSize: 12,
    color: '#94a3b8',
    maxWidth: 150,
  },
  teamsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 12,
  },
  teamCol: {
    flex: 1,
    alignItems: 'center',
    gap: 10,
  },
  logoWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.1)',
  },
  logo: {
    width: '100%',
    height: '100%',
    borderRadius: 32,
    resizeMode: 'contain',
  },
  logoPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoInitial: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  teamName: {
    fontSize: 13,
    fontWeight: 'bold',
    textAlign: 'center',
    height: 36,
    lineHeight: 18,
  },
  scoreCol: {
    alignItems: 'center',
    minWidth: 80,
  },
  scoreWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  scoreText: {
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -1,
  },
  scoreSep: {
    fontSize: 24,
    color: '#cbd5e1',
    fontWeight: '300',
  },
  vsBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: Radius.md,
  },
  vsText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#94a3b8',
  },
  setInfo: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#94a3b8',
    marginTop: 6,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    marginTop: 8,
  },
  timeInfo: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
  },
  detailsBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radius.md,
  },
  detailsBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  emptyWrap: {
    alignItems: 'center',
    padding: 64,
  }
});
