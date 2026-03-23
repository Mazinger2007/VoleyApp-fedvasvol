import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Platform,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { Spacing, Typography, Radius, Shadow } from '../styles/theme';
import { fetchInfoData, toInfoUrl } from '../utils/htmlParser';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

export default function InfoScreen({ route, navigation }) {
  const { tournamentUrl, title } = route.params;
  const { colors: Colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const [info, setInfo] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadInfo() {
      try {
        setLoading(true);
        const url = toInfoUrl(tournamentUrl);
        const data = await fetchInfoData(url);
        setInfo(data);
      } catch (err) {
        setError('No se pudo cargar la información del torneo.');
      } finally {
        setLoading(false);
      }
    }
    loadInfo();
  }, [tournamentUrl]);

  const groupedInfo = useMemo(() => {
    const map = {};
    info.forEach(item => {
      const label = (item.label || '').toLowerCase();
      const value = item.value || '';

      if (label.includes('nombre') || label.includes('competición')) map.nombre = value;
      else if (label.includes('deporte')) map.deporte = value;
      else if (label.includes('sexo') || label.includes('género')) map.sexo = value;
      else if (label.includes('temporada') || label.includes('año')) map.temporada = value;
      else if (label.includes('ámbito') || label.includes('zona') || label.includes('región')) map.ambito = value;
      else if (label.includes('categoría')) map.categoria = value;
      else if (label.includes('inscritos') || label.includes('equipos') || label.includes('participantes')) map.inscritos = value;
      else if (label.includes('inicio')) map.inicio = value;
      else if (label.includes('fin')) map.fin = value;

      map[item.label] = value;
    });
    return map;
  }, [info]);

  const displaySeason = useMemo(() => {
    // Priority 1: Data from navigation params (instant)
    if (route.params?.season) return route.params.season;

    const yearPattern = /\b(20\d{2})\s*[\/\-]\s*(\d{2,4})\b/;
    for (const src of [groupedInfo.temporada, title]) {
      const m = (src || '').match(yearPattern);
      if (m) return `${m[1]}/${m[2].length === 2 ? m[2] : m[2].slice(-2)}`;
    }
    return loading ? '' : (groupedInfo.temporada || '2024/25');
  }, [groupedInfo.temporada, title, route.params?.season, loading]);

  const competitionStatus = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    
    // Parse start/end dates from info table
    const parseDate = (d) => {
      if (!d) return null;
      const [dd, mm, yyyy] = d.split('/').map(Number);
      return new Date(yyyy, mm - 1, dd);
    };

    const startDate = parseDate(groupedInfo.inicio);
    const endDate = parseDate(groupedInfo.fin);

    // If we have an explicit end date, it takes priority
    if (endDate && now > endDate) {
      return { label: 'Finalizado', color: '#64748b' };
    }
    if (startDate && now < startDate) {
      return { label: 'Próximamente', color: Colors.primary };
    }

    // Fallback: Check the season year (e.g. 2021/22)
    const yearPattern = /\b20\d{2}[\/\-](\d{2,4})\b/;
    const m = (displaySeason || '').match(yearPattern);
    if (m) {
      let endYearStr = m[1];
      if (endYearStr.length === 2) endYearStr = `20${endYearStr}`;
      const endYear = parseInt(endYearStr, 10);
      
      // If the season end year is in the past, it's definitely finished
      // For current year, we assume it's ongoing unless endDate says otherwise
      if (endYear < currentYear) {
        return { label: 'Finalizado', color: '#64748b' };
      }
    }

    // Default to "En Curso" if no evidence it finished or is upcoming
    return { label: 'En Curso', color: '#22c55e' };
  }, [groupedInfo.inicio, groupedInfo.fin, displaySeason, Colors.primary]);

  return (
    <View style={[styles.safe, { backgroundColor: Colors.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" translucent />

      <View style={[
        styles.fixedHeader,
        {
          paddingTop: insets.top,
          height: 64 + insets.top,
          backgroundColor: Colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9'
        }
      ]}>
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              style={styles.headerActionBtn}
              onPress={() => navigation.goBack()}
              activeOpacity={0.7}
            >
              <MaterialIcons name="arrow-back" size={24} color={Colors.primary} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: Colors.primary }]}>
              Detalles de Liga
            </Text>
          </View>
          <TouchableOpacity style={styles.headerActionBtn} activeOpacity={0.7}>
            <MaterialIcons name="share" size={24} color={Colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.scrollContent, { paddingTop: 64 + insets.top + Spacing.md }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroOuter}>
          <View style={[styles.hero, { backgroundColor: Colors.primary }]}>

            <View style={styles.heroContent}>
              <View style={styles.heroBadgesRow}>
                {(!loading || competitionStatus.label !== 'En Curso') && (
                  <View style={[styles.statusBadge, { backgroundColor: competitionStatus.color }]}>
                    <Text style={styles.statusBadgeText}>{competitionStatus.label}</Text>
                  </View>
                )}
                {displaySeason ? (
                  <Text style={styles.heroSeasonText}>
                    Temporada {displaySeason}
                  </Text>
                ) : null}
              </View>

              <Text style={styles.heroTitle}>
                {groupedInfo.nombre || title || 'Euskadiko txapelketa Junior Femenino'}
              </Text>

              <View style={styles.heroMetaRow}>
                <View style={styles.heroMetaItem}>
                  <MaterialCommunityIcons name="volleyball" size={18} color="#ffffff" />
                  <Text style={styles.heroMetaText}>{groupedInfo.deporte || 'Voleibol'}</Text>
                </View>
                <View style={styles.heroMetaDivider} />
                <View style={styles.heroMetaItem}>
                  <MaterialCommunityIcons
                    name={groupedInfo.sexo?.toLowerCase()?.includes('masc') ? 'gender-male' : 'gender-female'}
                    size={16}
                    color="#ffffff"
                  />
                  <Text style={styles.heroMetaText}>{groupedInfo.sexo || 'Femenino'}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {loading ? (
          <View style={styles.center}>
            <Text style={{ color: Colors.textMuted, fontWeight: '600' }}>Cargando detalles...</Text>
          </View>
        ) : (
          <View style={styles.contentSections}>
            <View style={styles.bentoGrid}>
              <View style={[
                styles.mainBentoCard,
                { backgroundColor: Colors.surface, borderColor: isDark ? Colors.border : '#e2e8f0' }
              ]}>
                <View style={styles.mainBentoHeader}>
                  <View>
                    <Text style={[styles.bentoLabel, { color: isDark ? Colors.textMuted : '#94a3b8' }]}>CATEGORÍA</Text>
                    <Text style={[styles.mainBentoTitle, { color: Colors.primary }]}>
                      {groupedInfo.categoria || 'Junior'}
                    </Text>
                  </View>
                  <MaterialIcons
                    name="school"
                    size={56}
                    color={isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,31,61,0.05)'}
                    style={styles.fadedIcon}
                  />
                </View>

                <View style={[styles.mainBentoFooter, { borderTopColor: isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9' }]}>
                  <View style={styles.flex1}>
                    <Text style={[styles.bentoLabel, { color: isDark ? Colors.textMuted : '#94a3b8' }]}>INSCRITOS</Text>
                    <Text style={[styles.bentoSubValue, { color: Colors.textPrimary }]}>
                      {route.params?.teamCount ? `${route.params.teamCount} Equipos` : (groupedInfo.inscritos || 'Múltiples')}
                    </Text>
                  </View>
                  <View style={styles.flex1}>
                    <Text style={[styles.bentoLabel, { color: isDark ? Colors.textMuted : '#94a3b8' }]}>REGIÓN</Text>
                    <Text style={[styles.bentoSubValue, { color: Colors.textPrimary }]}>
                      {groupedInfo.ambito || 'País Vasco'}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={[
                styles.sideBentoCard,
                { backgroundColor: Colors.surface, borderColor: isDark ? Colors.border : '#e2e8f0' }
              ]}>
                <View style={[styles.bentoIconBox, { backgroundColor: Colors.primaryAlpha10 }]}>
                  <MaterialIcons name="event" size={24} color={Colors.primary} />
                </View>
                <View>
                  <Text style={[styles.bentoLabel, { color: isDark ? Colors.textMuted : '#94a3b8' }]}>INICIO</Text>
                  <Text style={[styles.sideBentoValue, { color: Colors.textPrimary }]}>{groupedInfo.inicio || '21/03/2026'}</Text>
                </View>
              </View>

              <View style={[
                styles.sideBentoCard,
                { backgroundColor: Colors.surface, borderColor: isDark ? Colors.border : '#e2e8f0' }
              ]}>
                <View style={[styles.bentoIconBox, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9' }]}>
                  <MaterialIcons name="event-busy" size={24} color={isDark ? Colors.textSecondary : '#64748b'} />
                </View>
                <View>
                  <Text style={[styles.bentoLabel, { color: isDark ? Colors.textMuted : '#94a3b8' }]}>FIN</Text>
                  <Text style={[styles.sideBentoValue, { color: Colors.textPrimary }]}>{groupedInfo.fin || '21/03/2026'}</Text>
                </View>
              </View>
            </View>

          </View>
        )}

        <View style={{ height: Spacing.xxl + insets.bottom }} />
      </ScrollView>
    </View>
  );

}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  fixedHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.m,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerActionBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: -0.5,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
  },
  heroOuter: {
    borderRadius: Radius.xl,
    overflow: 'hidden',
    marginBottom: Spacing.xl,
    ...Shadow.lg,
  },
  hero: {
    minHeight: 180,
    padding: Spacing.xl,
    justifyContent: 'flex-end',
    position: 'relative',
  },
  heroContent: {
    zIndex: 10,
  },
  heroBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  statusBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  heroSeasonText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  heroTitle: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: -1,
    lineHeight: 34,
    marginBottom: Spacing.md,
  },
  heroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroMetaDivider: {
    width: 1,
    height: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  heroMetaText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  contentSections: {
    gap: Spacing.l,
    paddingHorizontal: Spacing.sm,
  },
  bentoGrid: {
    flexDirection: 'column',
    gap: Spacing.md,
    marginBottom: Spacing.m,
  },
  mainBentoCard: {
    padding: Spacing.xl,
    borderRadius: Radius.xl,
    borderWidth: 1,
    justifyContent: 'space-between',
    ...Shadow.sm,
  },
  mainBentoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  mainBentoTitle: {
    fontSize: 26,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: -0.5,
  },
  fadedIcon: {
    position: 'absolute',
    right: -10,
    top: -5,
    opacity: 0.8,
  },
  mainBentoFooter: {
    marginTop: Spacing.xl,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: Spacing.xl,
  },
  flex1: {
    flex: 1,
  },
  sideBentoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    borderRadius: Radius.xl,
    borderWidth: 1,
    gap: Spacing.lg,
    ...Shadow.sm,
  },
  bentoIconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bentoLabel: {
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  bentoSubValue: {
    fontSize: 18,
    fontWeight: '900',
  },
  sideBentoValue: {
    fontSize: 14,
    fontWeight: '900',
  },
  center: {
    paddingVertical: Spacing.xxxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
