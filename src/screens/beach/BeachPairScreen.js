import React, { useMemo, useState } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, StatusBar, StyleSheet, View, ScrollView, TouchableOpacity } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { Spacing } from '../../styles/theme';

export default function BeachPairScreen({ route, navigation }) {
  const { pareja, posicion, partidos, ranking, torneo } = route.params || {};
  const { colors: Colors, isDark } = useTheme();
  const { userProfile } = useAuth();
  const isAdmin = userProfile?.role === 'admin';

  // useState solo para el toggle de la sección rivales
  const [rivalesExpanded, setRivalesExpanded] = useState(true);

  // Un único useMemo para stats con todos los cálculos
  const stats = useMemo(() => {
    const fallbackStats = {
      jugados: 0,
      ganados: 0,
      perdidos: 0,
      partidosJugados: 0,
      partidosGanados: 0,
      partidosPerdidos: 0,
      winRate: 0,
      winRateStr: '0.0',
      setsGanados: 0,
      setsPerdidos: 0,
      totalSetsJugados: 0,
      ratioSets: "0:0",
      puntosAFavor: 0,
      puntosEnContra: 0,
      eficienciaOfensiva: 0,
      eficienciaOfensivaStr: '0.0',
      mediaPuntosFavor: 0,
      mediaPuntosContra: 0,
      mediaPuntosPorSet: 0,
      mediaPuntosEncajadosPorSet: 0,
      diferenciaMedia: 0,
      diferenciaMediaPorPartido: 0,
      setsGanadosDominante: 0,
      setsPerdidosMinima: 0,
      mejorSet: null,
      peorSet: null,
      partidosA2Sets: 0,
      partidosA3Sets: 0,
      pctContundencia: 0,
      pct2Sets: 0,
      remontados: 0,
      ventajasCedidas: 0,
      caidas: 0,
      rachaActual: { tipo: 'victoria', valor: 0 },
      rendimientoPorFase: [],
      rivalData: [],
      mejorVictoria: null,
      peorDerrota: null,
      rankingAtaque: null,
      rankingDefensa: null,
      pairMatches: [],
      playedMatches: [],
      pendingMatches: []
    };

    if (!partidos || !pareja) {
      return fallbackStats;
    }

    const pairMatches = partidos.filter(m => m.parejaA === pareja || m.parejaB === pareja);
    const played = pairMatches.filter(m => m.set1 != null);
    const pendingMatches = pairMatches.filter(m => m.set1 == null);

    if (played.length === 0) {
      return {
        ...fallbackStats,
        pairMatches,
        pendingMatches
      };
    }

    const isA = (m) => m.parejaA === pareja;
    const getSetsData = (m) => [m.set1, m.set2, m.set3].filter(Boolean);

    // Puntos por set - case insensitive A/a B/b support
    const misPuntosPorSet = (m) =>
      getSetsData(m).map(s => isA(m) ? (s.A ?? s.a ?? 0) : (s.B ?? s.b ?? 0));

    const susPuntosPorSet = (m) =>
      getSetsData(m).map(s => isA(m) ? (s.B ?? s.b ?? 0) : (s.A ?? s.a ?? 0));

    const misPuntosTotales = (m) =>
      misPuntosPorSet(m).reduce((acc, v) => acc + v, 0);

    const susPuntosTotales = (m) =>
      susPuntosPorSet(m).reduce((acc, v) => acc + v, 0);

    const misSets = (m) => isA(m) ? (m.setsA || 0) : (m.setsB || 0);
    const susSets = (m) => isA(m) ? (m.setsB || 0) : (m.setsA || 0);

    const ganados = played.filter(m => misSets(m) > susSets(m));
    const perdidos = played.filter(m => misSets(m) < susSets(m));

    const setsGanados = played.reduce((a, m) => a + misSets(m), 0);
    const setsPerdidos = played.reduce((a, m) => a + susSets(m), 0);
    const totalSetsJugados = setsGanados + setsPerdidos;

    const puntosAFavor = played.reduce((a, m) => a + misPuntosTotales(m), 0);
    const puntosEnContra = played.reduce((a, m) => a + susPuntosTotales(m), 0);
    const totalPuntos = puntosAFavor + puntosEnContra;

    // Sets dominantes y ajustados
    let setsGanadosDominante = 0;
    let setsPerdidosMinima = 0;

    played.forEach(m => {
      misPuntosPorSet(m).forEach((mis, i) => {
        const sus = susPuntosPorSet(m)[i];
        if (mis > sus && (mis - sus) >= 5) setsGanadosDominante++;
        if (mis < sus && (sus - mis) <= 3) setsPerdidosMinima++;
      });
    });

    // Partidos a 2 o 3 sets
    const partidosA3Sets = played.filter(m => m.set3 != null);
    const partidosA2Sets = ganados.filter(m => m.set3 == null);

    // Remontados y ventajas cedidas
    // Remontado = perdían el primer set y ganaron el partido
    const remontados = ganados.filter(m => {
      if (!m.set1) return false;
      const mis1 = isA(m) ? (m.set1.A ?? m.set1.a ?? 0) : (m.set1.B ?? m.set1.b ?? 0);
      const sus1 = isA(m) ? (m.set1.B ?? m.set1.b ?? 0) : (m.set1.A ?? m.set1.a ?? 0);
      return mis1 < sus1;
    });

    // Ventaja cedida = ganaron el primer set pero perdieron el partido
    const ventajasCedidas = perdidos.filter(m => {
      if (!m.set1) return false;
      const mis1 = isA(m) ? (m.set1.A ?? m.set1.a ?? 0) : (m.set1.B ?? m.set1.b ?? 0);
      const sus1 = isA(m) ? (m.set1.B ?? m.set1.b ?? 0) : (m.set1.A ?? m.set1.a ?? 0);
      return mis1 > sus1;
    });

    // Mejor y peor set
    let mejorSet = null;
    let peorSet = null;
    let mejorDif = -Infinity;
    let peorDif = Infinity;

    played.forEach(m => {
      const rival = isA(m) ? m.parejaB : m.parejaA;
      getSetsData(m).forEach((s, i) => {
        const mis = isA(m) ? (s.A ?? s.a ?? 0) : (s.B ?? s.b ?? 0);
        const sus = isA(m) ? (s.B ?? s.b ?? 0) : (s.A ?? s.a ?? 0);
        const dif = mis - sus;
        if (dif > mejorDif) {
          mejorDif = dif;
          mejorSet = { rival, setNum: i + 1, mis, sus, dif, misPts: mis, susPts: sus, diff: dif };
        }
        if (dif < peorDif) {
          peorDif = dif;
          peorSet = { rival, setNum: i + 1, mis, sus, dif, misPts: mis, susPts: sus, diff: dif };
        }
      });
    });

    // Racha actual
    const ordenados = [...played].sort((a, b) => a.partido - b.partido);
    let rachaValor = 1;
    let rachaTipo = misSets(ordenados[ordenados.length - 1]) > susSets(ordenados[ordenados.length - 1]) ? 'victoria' : 'derrota';
    for (let i = ordenados.length - 2; i >= 0; i--) {
      const tipo = misSets(ordenados[i]) > susSets(ordenados[i]) ? 'victoria' : 'derrota';
      if (tipo === rachaTipo) rachaValor++;
      else break;
    }

    // Rendimiento por fase
    const fases = {};
    played.forEach(m => {
      if (!fases[m.fase]) {
        fases[m.fase] = {
          fase: m.fase,
          jugados: 0,
          ganados: 0,
          perdidos: 0,
          pf: 0,
          pc: 0,
          puntosAFavor: 0,
          puntosEnContra: 0
        };
      }
      fases[m.fase].jugados++;
      if (misSets(m) > susSets(m)) fases[m.fase].ganados++;
      else fases[m.fase].perdidos++;
      const misTot = misPuntosTotales(m);
      const susTot = susPuntosTotales(m);
      fases[m.fase].pf += misTot;
      fases[m.fase].pc += susTot;
      fases[m.fase].puntosAFavor += misTot;
      fases[m.fase].puntosEnContra += susTot;
    });
    const rendimientoPorFase = Object.values(fases);

    // Mejor victoria y peor derrota
    const rivalData = played.map(m => ({
      rival: isA(m) ? m.parejaB : m.parejaA,
      gano: misSets(m) > susSets(m),
      misSetsVal: misSets(m),
      susSetsVal: susSets(m),
      pf: misPuntosTotales(m),
      pc: susPuntosTotales(m),
      dif: misPuntosTotales(m) - susPuntosTotales(m),
      fase: m.fase,
      partido: m.partido,
      partidoNum: m.partido,
      setsStr: isA(m) ? `${m.setsA}-${m.setsB}` : `${m.setsB}-${m.setsA}`,
      diferenciaTotal: misPuntosTotales(m) - susPuntosTotales(m),
      ptsFor: misPuntosTotales(m),
      ptsAgainst: susPuntosTotales(m)
    }));

    const victorias = rivalData.filter(r => r.gano);
    const derrotas = rivalData.filter(r => !r.gano);
    const mejorVictoria = victorias.length > 0
      ? victorias.reduce((best, r) => r.dif > best.dif ? r : best)
      : null;
    const peorDerrota = derrotas.length > 0
      ? derrotas.reduce((worst, r) => r.dif < worst.dif ? r : worst)
      : null;

    // Torneo ranking comparisons (Ataque y Defensa)
    let rankingAtaque = null;
    let rankingDefensa = null;

    if (ranking && Array.isArray(ranking) && ranking.length > 0) {
      const teamStatsMap = {};
      ranking.forEach(r => {
        if (r.pareja) {
          teamStatsMap[r.pareja] = { pareja: r.pareja, ptsFor: 0, ptsAgainst: 0, setsPlayed: 0 };
        }
      });
      partidos.forEach(m => {
        if (m.set1 != null) {
          [m.parejaA, m.parejaB].forEach(p => {
            if (p && !teamStatsMap[p]) {
              teamStatsMap[p] = { pareja: p, ptsFor: 0, ptsAgainst: 0, setsPlayed: 0 };
            }
          });
        }
      });
      partidos.forEach(m => {
        if (m.set1 != null) {
          const sets = [m.set1, m.set2, m.set3].filter(Boolean);
          sets.forEach(s => {
            const ptsA = Number(s.A ?? s.a) || 0;
            const ptsB = Number(s.B ?? s.b) || 0;
            if (teamStatsMap[m.parejaA]) {
              teamStatsMap[m.parejaA].ptsFor += ptsA;
              teamStatsMap[m.parejaA].ptsAgainst += ptsB;
              teamStatsMap[m.parejaA].setsPlayed++;
            }
            if (teamStatsMap[m.parejaB]) {
              teamStatsMap[m.parejaB].ptsFor += ptsB;
              teamStatsMap[m.parejaB].ptsAgainst += ptsA;
              teamStatsMap[m.parejaB].setsPlayed++;
            }
          });
        }
      });

      const teamStatsList = Object.values(teamStatsMap);
      const attackSorted = [...teamStatsList].sort((a, b) => {
        const avgA = a.setsPlayed > 0 ? (a.ptsFor / a.setsPlayed) : 0;
        const avgB = b.setsPlayed > 0 ? (b.ptsFor / b.setsPlayed) : 0;
        return avgB - avgA;
      });
      const defenseSorted = [...teamStatsList].sort((a, b) => {
        const avgA = a.setsPlayed > 0 ? (a.ptsAgainst / a.setsPlayed) : 0;
        const avgB = b.setsPlayed > 0 ? (b.ptsAgainst / b.setsPlayed) : 0;
        return avgA - avgB;
      });

      const attackIndex = attackSorted.findIndex(t => t.pareja === pareja);
      const defenseIndex = defenseSorted.findIndex(t => t.pareja === pareja);

      if (attackIndex !== -1) {
        const ourTeam = attackSorted[attackIndex];
        rankingAtaque = {
          pos: attackIndex + 1,
          value: ourTeam.setsPlayed > 0 ? (ourTeam.ptsFor / ourTeam.setsPlayed) : 0
        };
      }
      if (defenseIndex !== -1) {
        const ourTeam = defenseSorted[defenseIndex];
        rankingDefensa = {
          pos: defenseIndex + 1,
          value: ourTeam.setsPlayed > 0 ? (ourTeam.ptsAgainst / ourTeam.setsPlayed) : 0
        };
      }
    }

    return {
      jugados: played.length,
      ganados: ganados.length,
      perdidos: perdidos.length,
      partidosJugados: played.length,
      partidosGanados: ganados.length,
      partidosPerdidos: perdidos.length,

      winRate: played.length > 0 ? (ganados.length / played.length * 100) : 0,
      winRateStr: (ganados.length / played.length * 100).toFixed(1),

      setsGanados,
      setsPerdidos,
      totalSetsJugados,
      ratioSets: `${setsGanados}:${setsPerdidos}`,

      puntosAFavor,
      puntosEnContra,
      eficienciaOfensiva: totalPuntos > 0 ? (puntosAFavor / totalPuntos * 100) : 0,
      eficienciaOfensivaStr: totalPuntos > 0 ? (puntosAFavor / totalPuntos * 100).toFixed(1) : '0.0',

      mediaPuntosFavor: totalSetsJugados > 0 ? (puntosAFavor / totalSetsJugados) : 0,
      mediaPuntosContra: totalSetsJugados > 0 ? (puntosEnContra / totalSetsJugados) : 0,
      mediaPuntosPorSet: totalSetsJugados > 0 ? (puntosAFavor / totalSetsJugados) : 0,
      mediaPuntosEncajadosPorSet: totalSetsJugados > 0 ? (puntosEnContra / totalSetsJugados) : 0,

      diferenciaMedia: played.length > 0 ? ((puntosAFavor - puntosEnContra) / played.length) : 0,
      diferenciaMediaPorPartido: played.length > 0 ? ((puntosAFavor - puntosEnContra) / played.length) : 0,

      setsGanadosDominante,
      setsPerdidosMinima,
      partidosA3Sets: partidosA3Sets.length,
      partidosA2Sets: partidosA2Sets.length,
      pctContundencia: ganados.length > 0 ? (partidosA2Sets.length / ganados.length * 100) : 0,
      pct2Sets: ganados.length > 0 ? (partidosA2Sets.length / ganados.length * 100) : 0,

      remontados: remontados.length,
      ventajasCedidas: ventajasCedidas.length,
      caidas: ventajasCedidas.length,

      mejorSet,
      peorSet,
      rachaActual: { tipo: rachaTipo, valor: rachaValor },
      rendimientoPorFase,
      rivalData,
      mejorVictoria,
      peorDerrota,

      rankingAtaque,
      rankingDefensa,
      pairMatches,
      playedMatches: played,
      pendingMatches
    };
  }, [partidos, pareja, ranking]);

  // Un único useMemo para styles
  const styles = useMemo(() => StyleSheet.create({
    safe: { flex: 1, backgroundColor: Colors.background },
    header: {
      height: 64, flexDirection: 'row', alignItems: 'center',
      backgroundColor: Colors.surface,
      borderBottomColor: Colors.border, borderBottomWidth: 1, paddingHorizontal: 8,
    },
    backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
    headerTitle: { fontSize: 15, fontWeight: '900', letterSpacing: -0.5, color: Colors.primary, flex: 1, textAlign: 'center', marginRight: 44 },
    scroll: { flex: 1 },
    content: { paddingBottom: 40 },
    
    // HERO
    heroSection: {
      paddingHorizontal: Spacing.lg,
      paddingTop: 16,
      paddingBottom: 16,
    },
    heroName: {
      fontSize: 22,
      fontWeight: '800',
      color: Colors.textPrimary,
    },
    heroMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 6,
    },
    positionChip: {
      backgroundColor: Colors.surfaceAlt,
      borderWidth: 1,
      borderColor: Colors.border,
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    positionChipText: {
      fontSize: 11,
      fontWeight: '700',
      color: Colors.textPrimary,
    },
    torneoBadge: {
      backgroundColor: Colors.primary + '15',
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 2,
      flexShrink: 1,
    },
    torneoBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: Colors.primary,
    },
    
    // NON-ADMIN PREMIUM HERO
    heroCardNonAdmin: {
      marginHorizontal: Spacing.lg,
      marginTop: 16,
      marginBottom: 20,
      backgroundColor: Colors.surface,
      borderRadius: 16,
      padding: 20,
      borderWidth: 1,
      borderColor: Colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0.3 : 0.05,
      shadowRadius: 12,
      elevation: 4,
    },
    medalRowNonAdmin: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderRadius: 12,
      marginBottom: 16,
      gap: 12,
    },
    medalCircleNonAdmin: {
      width: 48,
      height: 48,
      borderRadius: 24,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
    },
    medalLabelNonAdmin: {
      fontSize: 16,
      fontWeight: '900',
      letterSpacing: 0.5,
    },
    medalTorneoNonAdmin: {
      fontSize: 12,
      color: Colors.textMuted,
      fontWeight: '600',
      marginTop: 2,
    },
    positionRowNonAdmin: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
      gap: 12,
    },
    positionBubbleNonAdmin: {
      backgroundColor: Colors.surfaceAlt,
      borderWidth: 1,
      borderColor: Colors.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 8,
      alignItems: 'center',
    },
    positionBubbleNum: {
      fontSize: 20,
      fontWeight: '900',
      color: Colors.textPrimary,
      lineHeight: 24,
    },
    positionBubbleLabel: {
      fontSize: 9,
      fontWeight: '700',
      color: Colors.textMuted,
      letterSpacing: 0.5,
    },
    positionTorneoText: {
      flex: 1,
      fontSize: 13,
      fontWeight: '600',
      color: Colors.textSecondary,
    },
    heroNameBig: {
      fontSize: 28,
      fontWeight: '900',
      color: Colors.textPrimary,
      lineHeight: 34,
      letterSpacing: -0.5,
    },
    heroSeparator: {
      height: 1,
      backgroundColor: Colors.border,
      marginVertical: 16,
    },
    heroStatsRowNonAdmin: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    heroStatItemNonAdmin: {
      flex: 1,
      alignItems: 'center',
    },
    heroStatValNonAdmin: {
      fontSize: 18,
      fontWeight: '900',
      color: Colors.textPrimary,
      marginBottom: 4,
    },
    heroStatLblNonAdmin: {
      fontSize: 9,
      fontWeight: '700',
      color: Colors.textMuted,
      letterSpacing: 0.5,
    },
    heroStatDivider: {
      width: 1,
      height: 24,
      backgroundColor: Colors.border,
    },


    // RESUMEN RÁPIDO
    resumenRow: {
      flexDirection: 'row',
      gap: 6,
      paddingHorizontal: Spacing.lg,
      marginBottom: 20,
    },
    resumenChip: {
      flex: 1,
      backgroundColor: Colors.surface,
      borderColor: Colors.border,
      borderWidth: 1,
      borderRadius: 8,
      paddingVertical: 8,
      paddingHorizontal: 6,
      alignItems: 'center',
    },
    resumenLabel: {
      fontSize: 9,
      fontWeight: '700',
      color: Colors.textMuted,
      textTransform: 'uppercase',
    },
    resumenValue: {
      fontSize: 14,
      fontWeight: '800',
      color: Colors.textPrimary,
      marginTop: 2,
    },

    // SECTION HEADERS
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
    sectionHeaderClickable: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 4,
      borderBottomWidth: 1,
      borderBottomColor: Colors.border,
      marginBottom: 12,
    },

    // GRIDS AND CARDS
    gridRow: {
      flexDirection: 'row',
      gap: 8,
    },
    statCardSmall: {
      flex: 1,
      backgroundColor: Colors.surface,
      borderColor: Colors.border,
      borderWidth: 1,
      borderRadius: 10,
      padding: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    statCardFull: {
      backgroundColor: Colors.surface,
      borderColor: Colors.border,
      borderWidth: 1,
      borderRadius: 10,
      padding: 12,
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
    },
    statLabelSmall: {
      fontSize: 10,
      fontWeight: '700',
      color: Colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 4,
    },
    statLabelFull: {
      fontSize: 10,
      fontWeight: '700',
      color: Colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 4,
      textAlign: 'center',
    },
    statValueSmall: {
      fontSize: 16,
      fontWeight: '800',
      color: Colors.textPrimary,
    },
    statValueLarge: {
      fontSize: 18,
      fontWeight: '800',
      color: Colors.textPrimary,
    },

    // PROGRESS BAR
    progressBarBg: {
      width: '100%',
      height: 6,
      backgroundColor: Colors.border,
      borderRadius: 3,
      overflow: 'hidden',
    },
    progressBarFill: {
      height: '100%',
      borderRadius: 3,
    },

    // COMPARE CARDS
    compareCard: {
      flex: 1,
      backgroundColor: Colors.surface,
      borderColor: Colors.border,
      borderWidth: 1,
      borderRadius: 10,
      padding: 12,
      alignItems: 'center',
    },
    compareBadgeText: {
      fontSize: 9,
      fontWeight: '800',
      textTransform: 'uppercase',
      marginBottom: 6,
    },
    compareRival: {
      fontSize: 13,
      fontWeight: '700',
      color: Colors.textPrimary,
      textAlign: 'center',
      marginBottom: 4,
    },
    compareScore: {
      fontSize: 11,
      color: Colors.textMuted,
      marginBottom: 2,
    },
    compareDiff: {
      fontSize: 13,
      fontWeight: '800',
      marginTop: 4,
    },
    compareLabelMuted: {
      fontSize: 12,
      color: Colors.textMuted,
      fontStyle: 'italic',
      textAlign: 'center',
    },

    // ADMIN STUFF
    adminHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 12,
    },
    adminBadge: {
      backgroundColor: '#f59e0b20',
      borderColor: '#f59e0b',
      borderWidth: 1,
      borderRadius: 4,
      paddingHorizontal: 6,
      paddingVertical: 1,
    },
    adminBadgeText: {
      fontSize: 9,
      fontWeight: '800',
      color: '#f59e0b',
    },
    adminSubtitle: {
      fontSize: 10,
      fontWeight: '700',
      color: Colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginTop: 14,
      marginBottom: 8,
    },

    // TABLES (PHASES)
    phaseTable: {
      backgroundColor: Colors.surface,
      borderColor: Colors.border,
      borderWidth: 1,
      borderRadius: 10,
      overflow: 'hidden',
    },
    phaseHeaderRow: {
      flexDirection: 'row',
      backgroundColor: Colors.surfaceAlt,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderBottomWidth: 1,
      borderBottomColor: Colors.border,
    },
    phaseHeaderCell: {
      fontSize: 9,
      fontWeight: '800',
      color: Colors.textMuted,
    },
    phaseRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
      paddingHorizontal: 12,
    },
    phaseCellName: {
      fontSize: 12,
      fontWeight: '700',
      color: Colors.textPrimary,
    },
    phaseCell: {
      fontSize: 12,
      color: Colors.textPrimary,
    },

    // RACHA
    rachaContainer: {
      flexDirection: 'row',
      marginBottom: 4,
    },
    rachaChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: 8,
      borderWidth: 1,
      paddingHorizontal: 10,
      paddingVertical: 6,
      flex: 1,
    },
    rachaText: {
      fontSize: 12,
      fontWeight: '700',
    },

    // RANKING COMPARE
    rankingCompareWrap: {
      backgroundColor: Colors.surface,
      borderColor: Colors.border,
      borderWidth: 1,
      borderRadius: 10,
      padding: 12,
    },
    rankingCompareRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    rankingCompareText: {
      fontSize: 12,
      color: Colors.textPrimary,
      flex: 1,
    },

    // RIVAL LIST
    rivalListContainer: {
      backgroundColor: Colors.surface,
      borderColor: Colors.border,
      borderWidth: 1,
      borderRadius: 10,
      overflow: 'hidden',
    },
    rivalRow: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
    },
    rivalRowDivider: {
      borderTopWidth: 1,
      borderTopColor: Colors.border,
    },
    wlChip: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    wlText: {
      fontSize: 10,
      fontWeight: '800',
    },
    rivalNameText: {
      fontSize: 13,
      fontWeight: '700',
      color: Colors.textPrimary,
    },
    rivalFaseText: {
      fontSize: 10,
      color: Colors.textMuted,
      marginTop: 2,
    },
    rivalSetsText: {
      fontSize: 12,
      fontWeight: '700',
      color: Colors.textPrimary,
    },
    rivalDiffText: {
      fontSize: 11,
      fontWeight: '600',
      marginTop: 2,
    },
    
    // EMPTY STATE
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 32,
      minHeight: 300,
    },
    emptyText: {
      fontSize: 14,
      color: Colors.textMuted,
      textAlign: 'center',
      marginTop: 8,
    },
  }), [Colors]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={Colors.background} />
      
      {/* HEADER PRINCIPAL */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <MaterialIcons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={2}>{pareja}</Text>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        
        {/* 1. HERO SECTION */}
        {isAdmin ? (
          /* Hero compacto para admin (ya tiene mucha info) */
          <View style={styles.heroSection}>
            <Text style={styles.heroName}>{pareja}</Text>
            <View style={styles.heroMetaRow}>
              {posicion && posicion <= 32 ? (
                <View style={styles.positionChip}>
                  <Text style={styles.positionChipText}>
                    {posicion}º {posicion === 1 ? 'Oro' : posicion === 2 ? 'Plata' : posicion === 3 ? 'Bronce' : 'Puesto'}
                  </Text>
                </View>
              ) : null}
              {torneo?.titulo ? (
                <View style={styles.torneoBadge}>
                  <Text style={styles.torneoBadgeText} numberOfLines={1}>{torneo.titulo}</Text>
                </View>
              ) : null}
            </View>
          </View>
        ) : (
          /* Hero premium para usuario normal */
          <View style={styles.heroCardNonAdmin}>
            {/* Medalla / Posición */}
            {posicion && posicion <= 3 ? (() => {
              const medalColor = posicion === 1 ? '#f59e0b' : posicion === 2 ? '#94a3b8' : '#d97706';
              const medalBg = posicion === 1 ? '#fef3c720' : posicion === 2 ? '#f1f5f920' : '#fff7ed20';
              const medalLabel = posicion === 1 ? 'ORO' : posicion === 2 ? 'PLATA' : 'BRONCE';
              return (
                <View style={[styles.medalRowNonAdmin, { backgroundColor: medalBg }]}>
                  <View style={[styles.medalCircleNonAdmin, { backgroundColor: medalColor + '22', borderColor: medalColor }]}>
                    <MaterialIcons name="emoji-events" size={28} color={medalColor} />
                  </View>
                  <View>
                    <Text style={[styles.medalLabelNonAdmin, { color: medalColor }]}>{posicion}º {medalLabel}</Text>
                    {torneo?.titulo ? (
                      <Text style={styles.medalTorneoNonAdmin} numberOfLines={1}>{torneo.titulo}</Text>
                    ) : null}
                  </View>
                </View>
              );
            })() : posicion ? (
              <View style={styles.positionRowNonAdmin}>
                <View style={styles.positionBubbleNonAdmin}>
                  <Text style={styles.positionBubbleNum}>{posicion}</Text>
                  <Text style={styles.positionBubbleLabel}>PUESTO</Text>
                </View>
                {torneo?.titulo ? (
                  <Text style={styles.positionTorneoText} numberOfLines={2}>{torneo.titulo}</Text>
                ) : null}
              </View>
            ) : torneo?.titulo ? (
              <View style={styles.torneoBadge}>
                <Text style={styles.torneoBadgeText} numberOfLines={1}>{torneo.titulo}</Text>
              </View>
            ) : null}

            {/* Nombre de la pareja */}
            <Text style={styles.heroNameBig}>{pareja}</Text>

            {/* Separador */}
            <View style={styles.heroSeparator} />

            {/* Stats inline: PJ · PG · PP · % */}
            {stats.partidosJugados > 0 ? (
              <View style={styles.heroStatsRowNonAdmin}>
                <View style={styles.heroStatItemNonAdmin}>
                  <Text style={styles.heroStatValNonAdmin}>{stats.partidosJugados}</Text>
                  <Text style={styles.heroStatLblNonAdmin}>JUGADOS</Text>
                </View>
                <View style={styles.heroStatDivider} />
                <View style={styles.heroStatItemNonAdmin}>
                  <Text style={[styles.heroStatValNonAdmin, { color: '#22c55e' }]}>{stats.partidosGanados}</Text>
                  <Text style={styles.heroStatLblNonAdmin}>VICTORIAS</Text>
                </View>
                <View style={styles.heroStatDivider} />
                <View style={styles.heroStatItemNonAdmin}>
                  <Text style={[styles.heroStatValNonAdmin, { color: '#ef4444' }]}>{stats.partidosPerdidos}</Text>
                  <Text style={styles.heroStatLblNonAdmin}>DERROTAS</Text>
                </View>
                <View style={styles.heroStatDivider} />
                <View style={styles.heroStatItemNonAdmin}>
                  <Text style={[styles.heroStatValNonAdmin, {
                    color: stats.winRate >= 50 ? '#22c55e' : '#ef4444'
                  }]}>{stats.winRate.toFixed(0)}%</Text>
                  <Text style={styles.heroStatLblNonAdmin}>VICTORIAS</Text>
                </View>
              </View>
            ) : null}
          </View>
        )}

        {/* SECTIONS 3-7: only shown when there are played matches */}
        {stats.partidosJugados === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialIcons name="bar-chart" size={48} color={Colors.border} />
            <Text style={styles.emptyText}>No hay partidos jugados registrados para esta pareja.</Text>
          </View>
        ) : (
          <>
            {/* 2. RESUMEN RÁPIDO — solo admin */}
            {isAdmin && (
              <View style={styles.resumenRow}>
                <View style={styles.resumenChip}>
                  <Text style={styles.resumenLabel}>PJ</Text>
                  <Text style={styles.resumenValue}>{stats.partidosJugados}</Text>
                </View>
                <View style={styles.resumenChip}>
                  <Text style={styles.resumenLabel}>PG</Text>
                  <Text style={[styles.resumenValue, { color: '#22c55e' }]}>{stats.partidosGanados}</Text>
                </View>
                <View style={styles.resumenChip}>
                  <Text style={styles.resumenLabel}>PP</Text>
                  <Text style={[styles.resumenValue, { color: '#ef4444' }]}>{stats.partidosPerdidos}</Text>
                </View>
                <View style={styles.resumenChip}>
                  <Text style={styles.resumenLabel}>% Victorias</Text>
                  <Text style={[styles.resumenValue, { color: stats.winRate >= 50 ? '#22c55e' : '#ef4444' }]}>
                    {stats.winRate.toFixed(0)}%
                  </Text>
                </View>
              </View>
            )}

            {/* 3-5. ESTADÍSTICAS AVANZADAS [SOLO ADMIN] */}
            {isAdmin && (
              <>
                {/* 3. SECCIÓN PARTIDOS Y SETS */}
                <View style={styles.section}>
                  <View style={styles.sectionDividerRow}>
                    <Text style={styles.sectionTitle}>PARTIDOS Y SETS</Text>
                    <View style={styles.sectionDivider} />
                  </View>

                  <View style={styles.gridRow}>
                    <View style={styles.statCardSmall}>
                      <Text style={styles.statLabelSmall}>Sets Ganados</Text>
                      <Text style={styles.statValueSmall}>{stats.setsGanados}</Text>
                    </View>
                    <View style={styles.statCardSmall}>
                      <Text style={styles.statLabelSmall}>Sets Perdidos</Text>
                      <Text style={styles.statValueSmall}>{stats.setsPerdidos}</Text>
                    </View>
                  </View>

                  <View style={[styles.gridRow, { marginTop: 8 }]}>
                    <View style={styles.statCardSmall}>
                      <Text style={styles.statLabelSmall}>Ratio Sets</Text>
                      <Text style={[styles.statValueSmall, { color: stats.setsGanados > stats.setsPerdidos ? '#22c55e' : (stats.setsGanados < stats.setsPerdidos ? '#ef4444' : Colors.textPrimary) }]}>
                        {stats.ratioSets}
                      </Text>
                    </View>
                    <View style={styles.statCardSmall}>
                      <Text style={styles.statLabelSmall}>Partidos a 2 Sets</Text>
                      <Text style={styles.statValueSmall}>{stats.partidosA2Sets}</Text>
                    </View>
                  </View>

                  <View style={[styles.gridRow, { marginTop: 8 }]}>
                    <View style={styles.statCardSmall}>
                      <Text style={styles.statLabelSmall}>Partidos a 3 Sets</Text>
                      <Text style={[styles.statValueSmall, { color: stats.partidosA3Sets > 0 ? '#f59e0b' : Colors.textPrimary }]}>
                        {stats.partidosA3Sets}
                      </Text>
                    </View>
                    <View style={styles.statCardSmall}>
                      <Text style={styles.statLabelSmall}>% Contundencia</Text>
                      <Text style={styles.statValueSmall}>{stats.pct2Sets.toFixed(1)}%</Text>
                    </View>
                  </View>
                </View>

                {/* 4. SECCIÓN PUNTOS */}
                <View style={styles.section}>
                  <View style={styles.sectionDividerRow}>
                    <Text style={styles.sectionTitle}>PUNTOS Y EFICIENCIA</Text>
                    <View style={styles.sectionDivider} />
                  </View>

                  <View style={styles.gridRow}>
                    <View style={styles.statCardSmall}>
                      <Text style={styles.statLabelSmall}>Pts Favor</Text>
                      <Text style={[styles.statValueSmall, { color: Colors.primary }]}>{stats.puntosAFavor}</Text>
                    </View>
                    <View style={styles.statCardSmall}>
                      <Text style={styles.statLabelSmall}>Pts Contra</Text>
                      <Text style={styles.statValueSmall}>{stats.puntosEnContra}</Text>
                    </View>
                  </View>

                  <View style={[styles.statCardFull, { marginTop: 8 }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 6 }}>
                      <Text style={styles.statLabelFull}>Eficiencia Ofensiva</Text>
                      <Text style={[styles.statValueSmall, { color: stats.eficienciaOfensiva >= 50 ? '#22c55e' : '#ef4444' }]}>
                        {stats.eficienciaOfensiva.toFixed(1)}%
                      </Text>
                    </View>
                    <View style={styles.progressBarBg}>
                      <View style={[styles.progressBarFill, {
                        width: `${stats.eficienciaOfensiva}%`,
                        backgroundColor: stats.eficienciaOfensiva >= 50 ? '#22c55e' : '#ef4444'
                      }]} />
                    </View>
                  </View>

                  <View style={[styles.gridRow, { marginTop: 8 }]}>
                    <View style={styles.statCardSmall}>
                      <Text style={styles.statLabelSmall}>Media Favor / Set</Text>
                      <Text style={styles.statValueSmall}>{stats.mediaPuntosPorSet.toFixed(1)}</Text>
                    </View>
                    <View style={styles.statCardSmall}>
                      <Text style={styles.statLabelSmall}>Media Contra / Set</Text>
                      <Text style={styles.statValueSmall}>{stats.mediaPuntosEncajadosPorSet.toFixed(1)}</Text>
                    </View>
                  </View>

                  <View style={[styles.statCardFull, { marginTop: 8 }]}>
                    <Text style={styles.statLabelFull}>Diferencia Media por Partido</Text>
                    <Text style={[styles.statValueLarge, {
                      color: stats.diferenciaMediaPorPartido > 0 ? '#22c55e' : (stats.diferenciaMediaPorPartido < 0 ? '#ef4444' : Colors.textPrimary)
                    }]}>
                      {stats.diferenciaMediaPorPartido > 0 ? '+' : ''}{stats.diferenciaMediaPorPartido.toFixed(1)} pts
                    </Text>
                  </View>
                </View>

                {/* 5. SECCIÓN CONSISTENCIA */}
                <View style={styles.section}>
                  <View style={styles.sectionDividerRow}>
                    <Text style={styles.sectionTitle}>CONSISTENCIA Y SETS</Text>
                    <View style={styles.sectionDivider} />
                  </View>

                  <View style={styles.gridRow}>
                    <View style={styles.statCardSmall}>
                      <Text style={styles.statLabelSmall}>Sets Dom. Ganados</Text>
                      <Text style={[styles.statValueSmall, { color: stats.setsGanadosDominante > 0 ? '#22c55e' : Colors.textPrimary }]}>
                        {stats.setsGanadosDominante}
                      </Text>
                    </View>
                    <View style={styles.statCardSmall}>
                      <Text style={styles.statLabelSmall}>Sets Perdidos Mín.</Text>
                      <Text style={[styles.statValueSmall, { color: stats.setsPerdidosMinima > 0 ? '#f59e0b' : Colors.textPrimary }]}>
                        {stats.setsPerdidosMinima}
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.gridRow, { marginTop: 8 }]}>
                    <View style={styles.statCardSmall}>
                      <Text style={styles.statLabelSmall}>Partidos Remontados</Text>
                      <Text style={[styles.statValueSmall, { color: stats.remontados > 0 ? '#22c55e' : Colors.textPrimary }]}>
                        {stats.remontados}
                      </Text>
                    </View>
                    <View style={styles.statCardSmall}>
                      <Text style={styles.statLabelSmall}>Ventajas Cedidas</Text>
                      <Text style={[styles.statValueSmall, { color: stats.caidas > 0 ? '#ef4444' : Colors.textPrimary }]}>
                        {stats.caidas}
                      </Text>
                    </View>
                  </View>

                  {stats.mejorSet && stats.peorSet && (
                    <View style={[styles.gridRow, { marginTop: 8 }]}>
                      <View style={[styles.compareCard, { borderColor: '#22c55e40' }]}>
                        <Text style={[styles.compareBadgeText, { color: '#22c55e' }]}>MEJOR SET</Text>
                        <Text style={styles.compareRival} numberOfLines={1}>vs {stats.mejorSet.rival}</Text>
                        <Text style={styles.compareScore}>Set {stats.mejorSet.setNum} ({stats.mejorSet.misPts}-{stats.mejorSet.susPts})</Text>
                        <Text style={[styles.compareDiff, { color: '#22c55e' }]}>+{stats.mejorSet.diff} pts</Text>
                      </View>
                      
                      <View style={[styles.compareCard, { borderColor: '#ef444440' }]}>
                        <Text style={[styles.compareBadgeText, { color: '#ef4444' }]}>PEOR SET</Text>
                        <Text style={styles.compareRival} numberOfLines={1}>vs {stats.peorSet.rival}</Text>
                        <Text style={styles.compareScore}>Set {stats.peorSet.setNum} ({stats.peorSet.misPts}-{stats.peorSet.susPts})</Text>
                        <Text style={[styles.compareDiff, { color: '#ef4444' }]}>{stats.peorSet.diff} pts</Text>
                      </View>
                    </View>
                  )}
                </View>
              </>
            )}

            {/* 6. SECCIÓN ANÁLISIS AVANZADO [SOLO ADMIN] */}
            {isAdmin && (
              <View style={styles.section}>
                <View style={styles.sectionDividerRow}>
                  <Text style={styles.sectionTitle}>ANÁLISIS AVANZADO</Text>
                  <View style={styles.adminBadge}>
                    <Text style={styles.adminBadgeText}>ADMIN</Text>
                  </View>
                  <View style={styles.sectionDivider} />
                </View>

                {/* 6c. Racha actual */}
                {stats.rachaActual.valor > 0 && (
                  <View style={[styles.rachaContainer, { marginBottom: 12 }]}>
                    <View style={[
                      styles.rachaChip,
                      {
                        backgroundColor: stats.rachaActual.tipo === 'victoria' ? '#22c55e15' : '#ef444415',
                        borderColor: stats.rachaActual.tipo === 'victoria' ? '#22c55e' : '#ef4444'
                      }
                    ]}>
                      <MaterialIcons
                        name={stats.rachaActual.tipo === 'victoria' ? 'trending-up' : 'trending-down'}
                        size={18}
                        color={stats.rachaActual.tipo === 'victoria' ? '#22c55e' : '#ef4444'}
                      />
                      <Text style={[
                        styles.rachaText,
                        { color: stats.rachaActual.tipo === 'victoria' ? '#22c55e' : '#ef4444' }
                      ]}>
                        Racha de {stats.rachaActual.valor} {stats.rachaActual.valor === 1 ? (stats.rachaActual.tipo === 'victoria' ? 'victoria' : 'derrota') : (stats.rachaActual.tipo === 'victoria' ? 'victorias' : 'derrotas')} consecutivas
                      </Text>
                    </View>
                  </View>
                )}

                {/* 6a. Rendimiento por fase */}
                <Text style={styles.adminSubtitle}>Rendimiento por Fase</Text>
                <View style={styles.phaseTable}>
                  <View style={styles.phaseHeaderRow}>
                    <Text style={[styles.phaseHeaderCell, { flex: 2 }]}>FASE</Text>
                    <Text style={[styles.phaseHeaderCell, { flex: 1, textAlign: 'center' }]}>PJ</Text>
                    <Text style={[styles.phaseHeaderCell, { flex: 1, textAlign: 'center' }]}>PG</Text>
                    <Text style={[styles.phaseHeaderCell, { flex: 1, textAlign: 'center' }]}>PP</Text>
                    <Text style={[styles.phaseHeaderCell, { flex: 1.5, textAlign: 'center' }]}>PF</Text>
                    <Text style={[styles.phaseHeaderCell, { flex: 1.5, textAlign: 'center' }]}>PC</Text>
                    <Text style={[styles.phaseHeaderCell, { flex: 1.5, textAlign: 'right' }]}>DIF</Text>
                  </View>
                  {stats.rendimientoPorFase.map((item, idx) => {
                    const diff = item.puntosAFavor - item.puntosEnContra;
                    const isEven = idx % 2 === 0;
                    return (
                      <View key={idx} style={[styles.phaseRow, { backgroundColor: isEven ? 'transparent' : Colors.surfaceAlt }]}>
                        <Text style={[styles.phaseCellName, { flex: 2 }]} numberOfLines={1}>{item.fase}</Text>
                        <Text style={[styles.phaseCell, { flex: 1, textAlign: 'center' }]}>{item.jugados}</Text>
                        <Text style={[styles.phaseCell, { flex: 1, textAlign: 'center' }]}>{item.ganados}</Text>
                        <Text style={[styles.phaseCell, { flex: 1, textAlign: 'center' }]}>{item.perdidos}</Text>
                        <Text style={[styles.phaseCell, { flex: 1.5, textAlign: 'center' }]}>{item.puntosAFavor}</Text>
                        <Text style={[styles.phaseCell, { flex: 1.5, textAlign: 'center' }]}>{item.puntosEnContra}</Text>
                        <Text style={[styles.phaseCell, { flex: 1.5, textAlign: 'right', fontWeight: '700', color: diff > 0 ? '#22c55e' : (diff < 0 ? '#ef4444' : Colors.textPrimary) }]}>
                          {diff > 0 ? `+${diff}` : diff}
                        </Text>
                      </View>
                    );
                  })}
                </View>

                {/* 6b. Mejor victoria y peor derrota */}
                <Text style={styles.adminSubtitle}>Partidos Destacados</Text>
                <View style={styles.gridRow}>
                  {stats.mejorVictoria ? (
                    <View style={[styles.compareCard, { borderColor: '#22c55e40' }]}>
                      <Text style={[styles.compareBadgeText, { color: '#22c55e' }]}>MÁS CONTUNDENTE</Text>
                      <Text style={styles.compareRival} numberOfLines={1}>vs {stats.mejorVictoria.rival}</Text>
                      <Text style={styles.compareScore}>{stats.mejorVictoria.setsStr}</Text>
                      <Text style={styles.compareScore}>Pts: {stats.mejorVictoria.ptsFor}-{stats.mejorVictoria.ptsAgainst}</Text>
                      <Text style={[styles.compareDiff, { color: '#22c55e' }]}>+{stats.mejorVictoria.diferenciaTotal} pts</Text>
                    </View>
                  ) : (
                    <View style={styles.compareCard}>
                      <Text style={styles.compareLabelMuted}>Sin victorias</Text>
                    </View>
                  )}

                  {stats.peorDerrota ? (
                    <View style={[styles.compareCard, { borderColor: '#ef444440' }]}>
                      <Text style={[styles.compareBadgeText, { color: '#ef4444' }]}>MÁS SUFRIDA</Text>
                      <Text style={styles.compareRival} numberOfLines={1}>vs {stats.peorDerrota.rival}</Text>
                      <Text style={styles.compareScore}>{stats.peorDerrota.setsStr}</Text>
                      <Text style={styles.compareScore}>Pts: {stats.peorDerrota.ptsFor}-{stats.peorDerrota.ptsAgainst}</Text>
                      <Text style={[styles.compareDiff, { color: '#ef4444' }]}>{stats.peorDerrota.diferenciaTotal} pts</Text>
                    </View>
                  ) : (
                    <View style={styles.compareCard}>
                      <Text style={styles.compareLabelMuted}>Sin derrotas</Text>
                    </View>
                  )}
                </View>

                {/* 6d. Comparativa en el torneo */}
                {stats.rankingAtaque && stats.rankingDefensa && (
                  <>
                    <Text style={styles.adminSubtitle}>Comparativa en Torneo</Text>
                    <View style={styles.rankingCompareWrap}>
                      <View style={styles.rankingCompareRow}>
                        <MaterialIcons name="emoji-events" size={18} color="#f59e0b" />
                        <Text style={styles.rankingCompareText}>
                          Nº <Text style={{ fontWeight: '800' }}>{stats.rankingAtaque.pos}</Text> en ataque del torneo ({stats.rankingAtaque.value.toFixed(1)} pts/set)
                        </Text>
                      </View>
                      <View style={[styles.rankingCompareRow, { marginTop: 8 }]}>
                        <MaterialIcons name="security" size={18} color={Colors.primary} />
                        <Text style={styles.rankingCompareText}>
                          Nº <Text style={{ fontWeight: '800' }}>{stats.rankingDefensa.pos}</Text> en defensa del torneo ({stats.rankingDefensa.value.toFixed(1)} pts/set encajados)
                        </Text>
                      </View>
                    </View>
                  </>
                )}
              </View>
            )}

            {/* 7. SECCIÓN RIVALES Y RESULTADOS */}
            <View style={styles.section}>
              <TouchableOpacity
                style={styles.sectionHeaderClickable}
                onPress={() => setRivalesExpanded(!rivalesExpanded)}
                activeOpacity={0.7}
              >
                <Text style={styles.sectionTitle}>RIVALES Y RESULTADOS ({stats.rivalData.length})</Text>
                <MaterialIcons
                  name={rivalesExpanded ? "expand-less" : "expand-more"}
                  size={20}
                  color={Colors.textMuted}
                />
              </TouchableOpacity>

              {rivalesExpanded && (
                <View style={styles.rivalListContainer}>
                  {stats.rivalData.length > 0 ? (
                    stats.rivalData.map((item, idx) => (
                      <TouchableOpacity
                        key={idx}
                        style={[styles.rivalRow, idx > 0 && styles.rivalRowDivider]}
                        onPress={() => {
                          const originalMatch = stats.pairMatches.find(m => m.partido === item.partidoNum);
                          if (originalMatch) {
                            navigation.navigate('BeachMatchDetail', { match: originalMatch, torneo });
                          }
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.wlChip, { backgroundColor: item.gano ? '#22c55e20' : '#ef444420', borderColor: item.gano ? '#22c55e' : '#ef4444' }]}>
                          <Text style={[styles.wlText, { color: item.gano ? '#22c55e' : '#ef4444' }]}>
                            {item.gano ? 'W' : 'L'}
                          </Text>
                        </View>
                        <View style={{ flex: 1, marginLeft: 8 }}>
                          <Text style={styles.rivalNameText} numberOfLines={1}>vs {item.rival}</Text>
                          {item.fase ? <Text style={styles.rivalFaseText}>Partido {item.partidoNum} • {item.fase}</Text> : null}
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={styles.rivalSetsText}>Sets: {item.setsStr}</Text>
                          <Text style={[styles.rivalDiffText, { color: item.diferenciaTotal > 0 ? '#22c55e' : (item.diferenciaTotal < 0 ? '#ef4444' : Colors.textPrimary) }]}>
                            Dif: {item.diferenciaTotal > 0 ? `+${item.diferenciaTotal}` : item.diferenciaTotal} pts
                          </Text>
                        </View>
                        <MaterialIcons name="chevron-right" size={16} color={Colors.border} style={{ marginLeft: 8 }} />
                      </TouchableOpacity>
                    ))
                  ) : (
                    <Text style={styles.emptyText}>No hay partidos registrados</Text>
                  )}
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}