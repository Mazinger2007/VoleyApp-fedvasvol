import React, { useMemo } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, StatusBar, StyleSheet, View, ScrollView, TouchableOpacity } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { Spacing } from '../styles/theme';

export default function BeachPairScreen({ route, navigation }) {
  const { pareja, posicion, partidos, ranking, torneo } = route.params || {};
  const { colors: Colors, isDark } = useTheme();

  const pairMatches = useMemo(() => {
    if (!partidos || !pareja) return [];
    return partidos.filter(m =>
      m.parejaA === pareja || m.parejaB === pareja
    );
  }, [partidos, pareja]);

  const stats = useMemo(() => {
    const played = pairMatches.filter(m => m.set1 != null);
    const won = played.filter(m =>
      (m.parejaA === pareja && m.setsA > m.setsB) ||
      (m.parejaB === pareja && m.setsB > m.setsA)
    );
    const lost = played.filter(m =>
      (m.parejaA === pareja && m.setsA < m.setsB) ||
      (m.parejaB === pareja && m.setsB < m.setsA)
    );
    return {
      total: pairMatches.length,
      played: played.length,
      won: won.length,
      lost: lost.length,
      winRate: played.length > 0 ? Math.round((won.length / played.length) * 100) : 0,
    };
  }, [pairMatches, pareja]);

  const styles = useMemo(() => StyleSheet.create({
    safe: { flex: 1, backgroundColor: Colors.background },
    header: {
      height: 64, flexDirection: 'row', alignItems: 'center',
      backgroundColor: Colors.surface,
      borderBottomColor: Colors.border, borderBottomWidth: 1, paddingHorizontal: 8,
    },
    backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
    headerTitle: { fontSize: 15, fontWeight: '900', letterSpacing: -0.5, color: Colors.primary, flex: 1, textAlign: 'center', marginHorizontal: 4 },
    scroll: { flex: 1 },
    heroCard: {
      backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1, borderColor: Colors.border,
      padding: 24, marginHorizontal: Spacing.lg, marginTop: 16, marginBottom: 20, alignItems: 'center',
    },
    heroCircle: {
      width: 72, height: 72, borderRadius: 36,
      backgroundColor: Colors.primary + '20', justifyContent: 'center', alignItems: 'center',
      marginBottom: 12,
    },
    heroName: { fontSize: 22, fontWeight: '900', color: Colors.textPrimary, textAlign: 'center' },
    heroPosition: {
      fontSize: 14, fontWeight: '700', color: Colors.textMuted, marginTop: 4,
      backgroundColor: Colors.background, paddingHorizontal: 12, paddingVertical: 4,
      borderRadius: 20, overflow: 'hidden',
    },
    statsRow: { flexDirection: 'row', gap: 12, marginHorizontal: Spacing.lg, marginBottom: 20 },
    statCard: {
      flex: 1, backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.border,
      padding: 16, alignItems: 'center',
    },
    statValue: { fontSize: 26, fontWeight: '900', color: Colors.textPrimary },
    statLabel: { fontSize: 12, fontWeight: '600', color: Colors.textMuted, marginTop: 4 },
    winRateBar: {
      height: 6, borderRadius: 3, backgroundColor: Colors.border, marginTop: 8, width: '100%', overflow: 'hidden',
    },
    winRateFill: { height: '100%', borderRadius: 3 },
    section: { paddingHorizontal: Spacing.lg, marginBottom: 24 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
    sectionTitle: { fontSize: 20, fontWeight: '900', color: Colors.textPrimary, letterSpacing: -0.5 },
    sectionDivider: { height: 2, flex: 1, backgroundColor: Colors.border, borderRadius: 1 },
    matchCard: {
      backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border,
      padding: 16, marginBottom: 10,
    },
    matchTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    matchNumBadge: {
      fontSize: 10, fontWeight: '900', backgroundColor: Colors.primary, color: '#fff',
      paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, overflow: 'hidden',
    },
    matchRival: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
    matchScore: { fontSize: 13, fontWeight: '900', color: Colors.primary },
    matchResult: { fontSize: 11, fontWeight: '700' },
    emptySection: { padding: 24, alignItems: 'center' },
    emptySectionText: { color: Colors.textMuted, fontSize: 14, textAlign: 'center' },
    infoRow: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: Colors.surface, padding: 14, borderRadius: 12,
      borderWidth: 1, borderColor: Colors.border, marginBottom: 8,
    },
    infoIcon: { width: 24 },
    infoLabel: { fontSize: 13, color: Colors.textMuted, fontWeight: '600' },
    infoValue: { fontSize: 14, color: Colors.textPrimary, fontWeight: '700' },
  }), [Colors]);

  const getRival = (m) => m.parejaA === pareja ? m.parejaB : m.parejaA;
  const didWin = (m) =>
    (m.parejaA === pareja && m.setsA > m.setsB) ||
    (m.parejaB === pareja && m.setsB > m.setsA);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={Colors.background} />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <MaterialIcons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={2}>{pareja}</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.heroCard}>
          <View style={styles.heroCircle}>
            <MaterialIcons name="people" size={32} color={Colors.primary} />
          </View>
          <Text style={styles.heroName}>{pareja}</Text>
          {posicion && posicion <= 32 ? (
            <Text style={styles.heroPosition}>
              {posicion}º {posicion === 1 ? 'Oro' : posicion === 2 ? 'Plata' : posicion === 3 ? 'Bronce' : `Puesto`}
            </Text>
          ) : null}
        </View>

        {stats.total > 0 ? (
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: Colors.primary }]}>{stats.won}</Text>
              <Text style={styles.statLabel}>Ganados</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.lost}</Text>
              <Text style={styles.statLabel}>Perdidos</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, {
                color: stats.winRate >= 50 ? '#22c55e' : '#ef4444'
              }]}>{stats.winRate}%</Text>
              <Text style={styles.statLabel}>Victorias</Text>
              <View style={styles.winRateBar}>
                <View style={[styles.winRateFill, {
                  width: `${stats.winRate}%`,
                  backgroundColor: stats.winRate >= 50 ? '#22c55e' : '#ef4444',
                }]} />
              </View>
            </View>
          </View>
        ) : null}

        {torneo?.titulo ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="info-outline" size={20} color={Colors.primary} />
              <Text style={styles.sectionTitle}>Torneo</Text>
              <View style={styles.sectionDivider} />
            </View>
            <View style={styles.infoRow}>
              <View style={styles.infoIcon}><MaterialIcons name="emoji-events" size={18} color={Colors.primary} /></View>
              <Text style={styles.infoValue} numberOfLines={2}>{torneo.titulo}</Text>
            </View>
            {torneo?.fecha ? (
              <View style={styles.infoRow}>
                <View style={styles.infoIcon}><MaterialIcons name="calendar-today" size={18} color={Colors.primary} /></View>
                <Text style={styles.infoValue}>{torneo.fecha}</Text>
              </View>
            ) : null}
            {torneo?.lugar ? (
              <View style={styles.infoRow}>
                <View style={styles.infoIcon}><MaterialIcons name="location-on" size={18} color={Colors.primary} /></View>
                <Text style={styles.infoValue}>{torneo.lugar}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="format-list-bulleted" size={20} color={Colors.primary} />
            <Text style={styles.sectionTitle}>Partidos ({pairMatches.length})</Text>
            <View style={styles.sectionDivider} />
          </View>

          {pairMatches.length > 0 ? pairMatches.map((m, i) => (
            <TouchableOpacity key={i} style={styles.matchCard}
              onPress={() => navigation.navigate('BeachMatchDetail', { match: m, torneo })}
              activeOpacity={0.7}
            >
              <View style={styles.matchTop}>
                <Text style={styles.matchNumBadge}>Partido {m.partido}</Text>
                {m.set1 ? (
                  <Text style={[styles.matchResult, { color: didWin(m) ? '#22c55e' : '#ef4444' }]}>
                    {didWin(m) ? 'VICTORIA' : 'DERROTA'}
                  </Text>
                ) : (
                  <Text style={[styles.matchResult, { color: Colors.textMuted }]}>NO JUGADO</Text>
                )}
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.matchRival}>vs {getRival(m)}</Text>
                <Text style={styles.matchScore}>{m.setsA}-{m.setsB}</Text>
              </View>
              {m.fase || m.hora || m.pista ? (
                <Text style={{ fontSize: 11, color: Colors.textMuted, marginTop: 6 }}>
                  {[m.fase, m.hora, m.pista ? `Pista ${m.pista}` : ''].filter(Boolean).join(' • ')}
                </Text>
              ) : null}
            </TouchableOpacity>
          )) : (
            <View style={styles.emptySection}>
              <Text style={styles.emptySectionText}>No hay partidos registrados para esta pareja</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}