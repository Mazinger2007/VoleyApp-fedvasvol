import React, { useMemo } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, StatusBar, StyleSheet, View, ScrollView, TouchableOpacity } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { Spacing } from '../../styles/theme';

function InitialsAvatar({ name, isWinner, Colors }) {
  const parts = name ? name.split('/') : [];
  let initials = '??';
  if (parts.length >= 2) {
    const p1 = parts[0].trim()[0] || '';
    const p2 = parts[1].trim()[0] || '';
    initials = (p1 + p2).toUpperCase();
  } else if (name) {
    initials = name.trim().slice(0, 2).toUpperCase();
  }

  return (
    <View style={{
      width: 52,
      height: 52,
      borderRadius: 26,
      borderWidth: 2,
      borderColor: isWinner ? Colors.primary : Colors.border,
      backgroundColor: isWinner ? Colors.primary + '18' : Colors.surfaceAlt,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 8,
    }}>
      <Text style={{
        fontSize: 14,
        fontWeight: '800',
        color: isWinner ? Colors.primary : Colors.textSecondary,
      }}>
        {initials}
      </Text>
    </View>
  );
}

export default function BeachMatchDetailScreen({ route, navigation }) {
  const { match, torneo } = route.params || {};
  const { colors: Colors, isDark } = useTheme();

  const isPlayed = match?.set1 != null;
  const aWon = isPlayed && (match?.setsA > match?.setsB);
  const bWon = isPlayed && (match?.setsB > match?.setsA);

  const getSetPoints = (set) => {
    if (!set) return { a: 0, b: 0 };
    const a = Number(set.A != null ? set.A : set.a) || 0;
    const b = Number(set.B != null ? set.B : set.b) || 0;
    return { a, b };
  };

  const styles = useMemo(() => StyleSheet.create({
    safe: { flex: 1, backgroundColor: Colors.background },
    header: {
      height: 64,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: Colors.surface,
      borderBottomColor: Colors.border,
      borderBottomWidth: 1,
      paddingHorizontal: 8,
    },
    backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
    headerTitle: {
      fontSize: 15,
      fontWeight: '900',
      letterSpacing: -0.5,
      color: Colors.primary,
      flex: 1,
      textAlign: 'center',
      marginRight: 44,
    },
    scroll: { flex: 1 },
    content: { paddingBottom: 40 },

    // SCOREBOARD HERO
    heroCard: {
      backgroundColor: Colors.surface,
      borderColor: Colors.border,
      borderWidth: 1,
      borderRadius: 14,
      marginHorizontal: Spacing.lg,
      marginTop: 16,
      marginBottom: 12,
      padding: 20,
    },
    heroTop: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    teamCol: {
      flex: 1.2,
      alignItems: 'center',
    },
    centerCol: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    teamName: {
      fontSize: 12,
      fontWeight: '700',
      color: Colors.textPrimary,
      textAlign: 'center',
      lineHeight: 16,
    },
    teamNameWinner: {
      color: Colors.primary,
      fontWeight: '800',
    },
    scoreRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    scoreNum: {
      fontSize: 34,
      fontWeight: '900',
    },
    scoreSep: {
      fontSize: 22,
      fontWeight: '300',
      color: Colors.textMuted,
    },
    statusBadge: {
      marginTop: 8,
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 3,
      alignSelf: 'center',
    },
    statusBadgeText: {
      fontSize: 9,
      fontWeight: '800',
      letterSpacing: 0.5,
    },
    vsBadge: {
      backgroundColor: Colors.primary + '15',
      borderRadius: 8,
      paddingHorizontal: 14,
      paddingVertical: 6,
    },
    vsText: {
      fontSize: 16,
      fontWeight: '900',
      color: Colors.primary,
    },
    // Winner label under the score
    winnerLabel: {
      marginTop: 12,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 4,
    },
    winnerLabelText: {
      fontSize: 11,
      fontWeight: '700',
      color: Colors.primary,
    },

    // META CHIPS ROW
    metaRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      flexWrap: 'wrap',
      gap: 6,
      paddingHorizontal: Spacing.lg,
      marginBottom: 20,
    },
    metaChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: Colors.surface,
      borderColor: Colors.border,
      borderWidth: 1,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    metaChipText: {
      fontSize: 11,
      fontWeight: '700',
      color: Colors.textSecondary,
    },

    // SECTION
    section: {
      paddingHorizontal: Spacing.lg,
      marginBottom: 24,
    },
    sectionDividerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 12,
    },
    sectionDivider: {
      height: 1,
      flex: 1,
      backgroundColor: Colors.border,
    },
    sectionTitle: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1,
      color: Colors.textMuted,
      textTransform: 'uppercase',
    },

    // SET BREAKDOWN
    setCard: {
      backgroundColor: Colors.surface,
      borderColor: Colors.border,
      borderWidth: 1,
      borderRadius: 10,
      padding: 14,
      marginBottom: 8,
    },
    setHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    setLabel: {
      fontSize: 10,
      fontWeight: '800',
      color: Colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    setWinnerBadge: {
      fontSize: 9,
      fontWeight: '800',
      color: Colors.primary,
      letterSpacing: 0.5,
    },
    setScoreRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    setPts: {
      fontSize: 16,
      fontWeight: '800',
      width: 28,
      textAlign: 'center',
    },
    barWrapLeft: {
      flex: 1,
      flexDirection: 'row',
      justifyContent: 'flex-end',
      height: 6,
      backgroundColor: Colors.surfaceAlt,
      borderRadius: 3,
      overflow: 'hidden',
    },
    barWrapRight: {
      flex: 1,
      flexDirection: 'row',
      justifyContent: 'flex-start',
      height: 6,
      backgroundColor: Colors.surfaceAlt,
      borderRadius: 3,
      overflow: 'hidden',
    },
    barFill: {
      height: '100%',
      borderRadius: 3,
    },

    // TORNEO INFO
    infoCard: {
      backgroundColor: Colors.surface,
      borderColor: Colors.border,
      borderWidth: 1,
      borderRadius: 12,
      overflow: 'hidden',
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 12,
      gap: 12,
    },
    infoRowBorder: {
      borderTopWidth: 1,
      borderTopColor: Colors.border,
    },
    infoIconWrap: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: Colors.primary + '15',
      justifyContent: 'center',
      alignItems: 'center',
    },
    infoContent: {
      flex: 1,
    },
    infoLabel: {
      fontSize: 10,
      fontWeight: '700',
      color: Colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    infoValue: {
      fontSize: 13,
      fontWeight: '700',
      color: Colors.textPrimary,
      marginTop: 2,
    },
  }), [Colors]);

  const winnersName = aWon ? match?.parejaA : bWon ? match?.parejaB : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={Colors.background} />

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <MaterialIcons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {match?.fase ? `${match.fase} · Partido ${match?.partido}` : `Partido ${match?.partido}`}
        </Text>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

        {/* SCOREBOARD HERO CARD */}
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            {/* Pareja A */}
            <View style={styles.teamCol}>
              <InitialsAvatar name={match?.parejaA} isWinner={aWon} Colors={Colors} />
              <Text style={[styles.teamName, aWon && styles.teamNameWinner]} numberOfLines={2}>
                {match?.parejaA}
              </Text>
            </View>

            {/* Score / VS */}
            <View style={styles.centerCol}>
              {isPlayed ? (
                <View style={styles.scoreRow}>
                  <Text style={[styles.scoreNum, { color: aWon ? Colors.primary : Colors.textPrimary }]}>
                    {match?.setsA}
                  </Text>
                  <Text style={styles.scoreSep}>-</Text>
                  <Text style={[styles.scoreNum, { color: bWon ? Colors.primary : Colors.textPrimary }]}>
                    {match?.setsB}
                  </Text>
                </View>
              ) : (
                <View style={styles.vsBadge}>
                  <Text style={styles.vsText}>VS</Text>
                </View>
              )}
              <View style={[styles.statusBadge, {
                backgroundColor: isPlayed ? Colors.primary + '15' : Colors.surfaceAlt,
              }]}>
                <Text style={[styles.statusBadgeText, {
                  color: isPlayed ? Colors.primary : Colors.textMuted,
                }]}>
                  {isPlayed ? 'FINALIZADO' : 'PROGRAMADO'}
                </Text>
              </View>
            </View>

            {/* Pareja B */}
            <View style={styles.teamCol}>
              <InitialsAvatar name={match?.parejaB} isWinner={bWon} Colors={Colors} />
              <Text style={[styles.teamName, bWon && styles.teamNameWinner]} numberOfLines={2}>
                {match?.parejaB}
              </Text>
            </View>
          </View>

          {/* Winner row */}
          {isPlayed && winnersName && (
            <View style={styles.winnerLabel}>
              <MaterialIcons name="emoji-events" size={14} color={Colors.primary} />
              <Text style={styles.winnerLabelText}>{winnersName}</Text>
            </View>
          )}
        </View>

        {/* METADATA CHIPS */}
        <View style={styles.metaRow}>
          {match?.fase ? (
            <View style={styles.metaChip}>
              <MaterialIcons name="emoji-events" size={12} color={Colors.primary} />
              <Text style={[styles.metaChipText, { color: Colors.primary }]}>{match.fase}</Text>
            </View>
          ) : null}
          {match?.hora ? (
            <View style={styles.metaChip}>
              <MaterialIcons name="schedule" size={12} color={Colors.textMuted} />
              <Text style={styles.metaChipText}>{match.hora}</Text>
            </View>
          ) : null}
          {match?.pista ? (
            <View style={styles.metaChip}>
              <MaterialIcons name="sports-volleyball" size={12} color={Colors.textMuted} />
              <Text style={styles.metaChipText}>Pista {match.pista}</Text>
            </View>
          ) : null}
          {match?.referencia ? (
            <View style={styles.metaChip}>
              <MaterialIcons name="tag" size={12} color={Colors.textMuted} />
              <Text style={styles.metaChipText}>{match.referencia}</Text>
            </View>
          ) : null}
        </View>

        {/* SETS BREAKDOWN */}
        {isPlayed && (
          <View style={styles.section}>
            <View style={styles.sectionDividerRow}>
              <Text style={styles.sectionTitle}>Distribución de Puntos</Text>
              <View style={styles.sectionDivider} />
            </View>

            {[match?.set1, match?.set2, match?.set3].map((set, idx) => {
              if (!set) return null;
              const { a, b } = getSetPoints(set);
              const total = a + b;
              const pctA = total > 0 ? (a / total) * 100 : 0;
              const pctB = total > 0 ? (b / total) * 100 : 0;
              const aWinsSet = a > b;
              const bWinsSet = b > a;

              return (
                <View key={idx} style={styles.setCard}>
                  <View style={styles.setHeader}>
                    <Text style={styles.setLabel}>Set {idx + 1}</Text>
                    {(aWinsSet || bWinsSet) && (
                      <Text style={styles.setWinnerBadge}>
                        {aWinsSet ? match?.parejaA?.split('/')[0] : match?.parejaB?.split('/')[0]} gana
                      </Text>
                    )}
                  </View>
                  <View style={styles.setScoreRow}>
                    <Text style={[styles.setPts, { color: aWinsSet ? Colors.primary : Colors.textSecondary }]}>
                      {a}
                    </Text>

                    <View style={styles.barWrapLeft}>
                      <View style={[styles.barFill, {
                        width: `${pctA}%`,
                        backgroundColor: aWinsSet ? Colors.primary : Colors.border,
                      }]} />
                    </View>

                    <View style={styles.barWrapRight}>
                      <View style={[styles.barFill, {
                        width: `${pctB}%`,
                        backgroundColor: bWinsSet ? Colors.primary : Colors.border,
                      }]} />
                    </View>

                    <Text style={[styles.setPts, { color: bWinsSet ? Colors.primary : Colors.textSecondary }]}>
                      {b}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* TOURNAMENT INFO */}
        {(torneo?.titulo || torneo?.fecha || torneo?.lugar) ? (
          <View style={styles.section}>
            <View style={styles.sectionDividerRow}>
              <Text style={styles.sectionTitle}>Información del Torneo</Text>
              <View style={styles.sectionDivider} />
            </View>

            <View style={styles.infoCard}>
              {torneo?.titulo ? (
                <View style={styles.infoRow}>
                  <View style={styles.infoIconWrap}>
                    <MaterialIcons name="emoji-events" size={16} color={Colors.primary} />
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Torneo</Text>
                    <Text style={styles.infoValue}>{torneo.titulo}</Text>
                  </View>
                </View>
              ) : null}
              {torneo?.fecha ? (
                <View style={[styles.infoRow, styles.infoRowBorder]}>
                  <View style={styles.infoIconWrap}>
                    <MaterialIcons name="calendar-today" size={16} color={Colors.primary} />
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Fecha</Text>
                    <Text style={styles.infoValue}>{torneo.fecha}</Text>
                  </View>
                </View>
              ) : null}
              {torneo?.lugar ? (
                <View style={[styles.infoRow, styles.infoRowBorder]}>
                  <View style={styles.infoIconWrap}>
                    <MaterialIcons name="location-on" size={16} color={Colors.primary} />
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Lugar</Text>
                    <Text style={styles.infoValue}>{torneo.lugar}</Text>
                  </View>
                </View>
              ) : null}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}