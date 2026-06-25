import React, { useMemo } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, StatusBar, StyleSheet, View, ScrollView, TouchableOpacity } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { Spacing } from '../styles/theme';

export default function BeachMatchDetailScreen({ route, navigation }) {
  const { match, torneo } = route.params || {};
  const { colors: Colors, isDark } = useTheme();

  const allSets = [match?.set1, match?.set2, match?.set3].filter(Boolean);
  const maxSets = Math.max(allSets.length, 3);
  const aWon = match?.setsA > match?.setsB;
  const bWon = match?.setsB > match?.setsA;

  const styles = useMemo(() => StyleSheet.create({
    safe: { flex: 1, backgroundColor: Colors.background },
    header: {
      height: 64, flexDirection: 'row', alignItems: 'center',
      backgroundColor: Colors.surface,
      borderBottomColor: Colors.border, borderBottomWidth: 1, paddingHorizontal: 8,
    },
    backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
    headerTitle: { fontSize: 15, fontWeight: '900', letterSpacing: -0.5, color: Colors.primary, flex: 1, textAlign: 'center' },
    scroll: { flex: 1 },
    section: { paddingHorizontal: Spacing.lg, marginBottom: 24 },
    heroCard: {
      backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1, borderColor: Colors.border,
      padding: 20, marginHorizontal: Spacing.lg, marginTop: 16, marginBottom: 20,
    },
    matchHeader: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16,
    },
    matchNumBadge: {
      fontSize: 11, fontWeight: '900', backgroundColor: Colors.primary, color: '#fff',
      paddingHorizontal: 10, paddingVertical: 3, borderRadius: 6, overflow: 'hidden',
    },
    phaseBadge: {
      fontSize: 11, fontWeight: '900', backgroundColor: Colors.background, color: Colors.textMuted,
      paddingHorizontal: 10, paddingVertical: 3, borderRadius: 6, overflow: 'hidden',
    },
    matchMeta: { fontSize: 13, fontWeight: '600', color: Colors.textMuted },
    teamRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingVertical: 14,
    },
    teamName: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary, flex: 1 },
    teamSets: { fontSize: 14, fontWeight: '900', color: Colors.textMuted, width: 32, textAlign: 'center' },
    setScores: { flexDirection: 'row', gap: 8 },
    setScore: {
      width: 32, textAlign: 'center', fontSize: 15, fontWeight: '700', paddingVertical: 4,
      borderRadius: 6,
    },
    setScoreWon: { backgroundColor: Colors.primary + '20', color: Colors.primary },
    setScoreLost: { backgroundColor: Colors.background, color: Colors.textMuted },
    winnerBadge: {
      fontSize: 10, fontWeight: '900', marginLeft: 8,
      backgroundColor: Colors.primary, color: '#fff',
      paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, overflow: 'hidden',
    },
    setsTable: {
      backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1, borderColor: Colors.border,
      marginHorizontal: Spacing.lg, marginBottom: 20, overflow: 'hidden',
    },
    setsTableHeader: {
      flexDirection: 'row', backgroundColor: Colors.background,
      paddingVertical: 10, paddingHorizontal: 16,
    },
    setsTableRow: {
      flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 16,
      borderTopWidth: 0.5, borderTopColor: Colors.border,
    },
    cellTeam: { flex: 1, fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
    cellSet: {
      width: 40, textAlign: 'center', fontSize: 13, fontWeight: '600',
    },
    cellSetWon: { color: Colors.primary, fontWeight: '900' },
    cellSetLost: { color: Colors.textMuted },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
    sectionTitle: { fontSize: 20, fontWeight: '900', color: Colors.textPrimary, letterSpacing: -0.5 },
    sectionDivider: { height: 2, flex: 1, backgroundColor: Colors.border, borderRadius: 1 },
    infoRow: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: Colors.surface, padding: 14, borderRadius: 12,
      borderWidth: 1, borderColor: Colors.border, marginBottom: 8,
    },
    infoIcon: { width: 24 },
    infoLabel: { fontSize: 13, color: Colors.textMuted, fontWeight: '600' },
    infoValue: { fontSize: 14, color: Colors.textPrimary, fontWeight: '700' },
    emptySection: { padding: 24, alignItems: 'center' },
    emptySectionText: { color: Colors.textMuted, fontSize: 14, textAlign: 'center' },
  }), [Colors]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={Colors.background} />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <MaterialIcons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Partido {match?.partido}</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.heroCard}>
          <View style={styles.matchHeader}>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <Text style={styles.matchNumBadge}>Partido {match?.partido}</Text>
              {match?.fase ? <Text style={styles.phaseBadge}>{match.fase}</Text> : null}
            </View>
            <Text style={styles.matchMeta}>
              {match?.hora ? match.hora : ''}{match?.hora && match?.pista ? ' • ' : ''}{match?.pista ? `Pista ${match.pista}` : ''}
            </Text>
          </View>

          <View style={[styles.teamRow, { borderBottomWidth: 0.5, borderBottomColor: Colors.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <Text style={styles.teamName} numberOfLines={2}>{match?.parejaA}</Text>
              {aWon ? <Text style={styles.winnerBadge}>GANADOR</Text> : null}
            </View>
            <View style={styles.setScores}>
              {Array.from({ length: maxSets }).map((_, idx) => {
                const set = [match?.set1, match?.set2, match?.set3][idx];
                return (
                  <Text key={idx} style={[styles.setScore, set ? (set.A > set.B ? styles.setScoreWon : styles.setScoreLost) : styles.setScoreLost]}>
                    {set ? String(set.A).padStart(2, '0') : '-'}
                  </Text>
                );
              })}
              <Text style={styles.teamSets}>{match?.setsA}</Text>
            </View>
          </View>

          <View style={styles.teamRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <Text style={styles.teamName} numberOfLines={2}>{match?.parejaB}</Text>
              {bWon ? <Text style={styles.winnerBadge}>GANADOR</Text> : null}
            </View>
            <View style={styles.setScores}>
              {Array.from({ length: maxSets }).map((_, idx) => {
                const set = [match?.set1, match?.set2, match?.set3][idx];
                return (
                  <Text key={idx} style={[styles.setScore, set ? (set.B > set.A ? styles.setScoreWon : styles.setScoreLost) : styles.setScoreLost]}>
                    {set ? String(set.B).padStart(2, '0') : '-'}
                  </Text>
                );
              })}
              <Text style={styles.teamSets}>{match?.setsB}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="format-list-bulleted" size={20} color={Colors.primary} />
            <Text style={styles.sectionTitle}>Detalle de sets</Text>
            <View style={styles.sectionDivider} />
          </View>
        </View>

        {[match?.set1, match?.set2, match?.set3].map((set, idx) => (
          <View key={idx} style={styles.setsTable}>
            <View style={styles.setsTableHeader}>
              <Text style={[styles.cellTeam, { color: Colors.textMuted, fontWeight: '900', fontSize: 11 }]}>
                SET {idx + 1}
              </Text>
              <Text style={[styles.cellSet, { color: Colors.textMuted, fontWeight: '900', fontSize: 11 }]}>
                {match?.parejaA?.split('/')[0]?.trim() || 'A'}
              </Text>
              <Text style={[styles.cellSet, { color: Colors.textMuted, fontWeight: '900', fontSize: 11 }]}>
                {match?.parejaB?.split('/')[0]?.trim() || 'B'}
              </Text>
            </View>
            {set ? (
              <View style={styles.setsTableRow}>
                <Text style={styles.cellTeam}>Puntos</Text>
                <Text style={[styles.cellSet, set.A > set.B ? styles.cellSetWon : styles.cellSetLost]}>
                  {set.A}
                </Text>
                <Text style={[styles.cellSet, set.B > set.A ? styles.cellSetWon : styles.cellSetLost]}>
                  {set.B}
                </Text>
              </View>
            ) : (
              <View style={[styles.setsTableRow, { justifyContent: 'center' }]}>
                <Text style={{ color: Colors.textMuted, fontStyle: 'italic', fontSize: 13 }}>No jugado</Text>
              </View>
            )}
          </View>
        ))}

        {torneo?.titulo || torneo?.fecha || torneo?.lugar ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="info-outline" size={20} color={Colors.primary} />
              <Text style={styles.sectionTitle}>Información del torneo</Text>
              <View style={styles.sectionDivider} />
            </View>
            <View style={{ marginTop: 4 }}>
              {torneo?.titulo ? (
                <View style={styles.infoRow}>
                  <View style={styles.infoIcon}><MaterialIcons name="emoji-events" size={18} color={Colors.primary} /></View>
                  <Text style={styles.infoLabel}>Torneo</Text>
                  <Text style={styles.infoValue} numberOfLines={2}>{torneo.titulo}</Text>
                </View>
              ) : null}
              {torneo?.fecha ? (
                <View style={styles.infoRow}>
                  <View style={styles.infoIcon}><MaterialIcons name="calendar-today" size={18} color={Colors.primary} /></View>
                  <Text style={styles.infoLabel}>Fecha</Text>
                  <Text style={styles.infoValue}>{torneo.fecha}</Text>
                </View>
              ) : null}
              {torneo?.lugar ? (
                <View style={styles.infoRow}>
                  <View style={styles.infoIcon}><MaterialIcons name="location-on" size={18} color={Colors.primary} /></View>
                  <Text style={styles.infoLabel}>Lugar</Text>
                  <Text style={styles.infoValue}>{torneo.lugar}</Text>
                </View>
              ) : null}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}