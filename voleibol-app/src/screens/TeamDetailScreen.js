// src/screens/TeamDetailScreen.js
// Pantalla de detalle de un equipo.
// Recibe { teamName, teamUrl, tournamentTitle } como parámetros de ruta.
// Descarga la página del equipo y muestra sus jugadores y stats básicos.

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  StatusBar,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import LoadingView from '../components/LoadingView';
import ErrorView from '../components/ErrorView';
import { useFetch } from '../hooks/useFetch';
import { toAbsoluteUrl } from '../utils/htmlParser';
import { getDominantBorderColor } from '../utils/imageColor';
import { Colors, Spacing, Typography, Radius, Shadow } from '../styles/theme';
import { useTheme } from '../contexts/ThemeContext';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('');
}

/** Deduplica cadenas del tipo "NombreNombre" → "Nombre" */
function dedup(s = '') {
  const len = s.length;
  if (len > 8 && len % 2 === 0) {
    const half = len / 2;
    if (s.slice(0, half) === s.slice(half)) return s.slice(0, half);
  }
  return s;
}

/**
 * Extrae jugadores de los bloques parseados.
 * Busca tablas que tengan columnas de nombre y partidos jugados.
 */

function buildImageSizeCandidates(url = '') {
  const raw = String(url || '').trim();
  if (!raw) return [];

  const sizePattern = /\.\d+x\d+(?=\.[a-zA-Z0-9]+(?:[?#]|$))/i;
  if (!sizePattern.test(raw)) return [raw];

  const variants = [120, 60, 30].map((size) =>
    raw.replace(sizePattern, `.${size}x${size}`)
  );

  return [...new Set(variants)];
}

function normalizeTeamName(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function parseScorePair(match = {}) {
  const homeRaw = match?.homeScore ?? match?.matchScore?.home;
  const awayRaw = match?.awayScore ?? match?.matchScore?.away;
  const home = Number(homeRaw);
  const away = Number(awayRaw);
  if (!Number.isFinite(home) || !Number.isFinite(away)) return null;
  return { home, away };
}

function sumTeamPointsFromCalendarBlocks(blocks = [], teamName = '') {
  const normalizedTeam = normalizeTeamName(teamName);
  if (!normalizedTeam) return 0;

  const tables = (blocks || []).filter((block) => block.type === 'table');
  return tables.reduce((acc, table) => {
    const matches = table?.matches || [];
    return acc + matches.reduce((sum, match) => {
      const homeName = normalizeTeamName(match?.homeTeam || '');
      const awayName = normalizeTeamName(match?.awayTeam || '');
      const isHome = homeName === normalizedTeam;
      const isAway = awayName === normalizedTeam;
      if (!isHome && !isAway) return sum;

      const sets = Array.isArray(match?.sets) ? match.sets : [];
      const fromSets = sets.reduce((setTotal, setItem) => {
        const homeSet = Number(setItem?.home);
        const awaySet = Number(setItem?.away);
        if (!Number.isFinite(homeSet) || !Number.isFinite(awaySet)) return setTotal;
        return setTotal + (isHome ? homeSet : awaySet);
      }, 0);
      if (fromSets > 0) return sum + fromSets;

      const score = parseScorePair(match);
      if (!score) return sum;
      return sum + (isHome ? score.home : score.away);
    }, 0);
  }, 0);
}

// ─── Pantalla ─────────────────────────────────────────────────────────────────

export default function TeamDetailScreen({ route, navigation }) {
  const { colors: Colors } = useTheme();
  const {
    teamName = '',
    teamUrl,
    teamLogo,
    tournamentTitle,
    leagueStats: leagueStatsFromRoute,
    pointsScoredTotal,
    calendarUrl,
  } = route.params || {};

  const { blocks, loading, error, refresh } = useFetch(teamUrl || null);
  const { blocks: calendarBlocks } = useFetch(calendarUrl || null);
  const [teamLogoBgColor, setTeamLogoBgColor] = useState('#ffffff');


  const initials = useMemo(() => getInitials(teamName), [teamName]);
  const teamLogoCandidates = useMemo(() => buildImageSizeCandidates(teamLogo), [teamLogo]);
  const teamLogoUri = useMemo(() => teamLogoCandidates[0] || null, [teamLogoCandidates]);

  useEffect(() => {
    let mounted = true;
    async function resolveColor() {
      if (!teamLogoUri) {
        if (mounted) setTeamLogoBgColor(Colors.surfaceAlt);
        return;
      }
      const color = await getDominantBorderColor(teamLogoUri);
      if (mounted) setTeamLogoBgColor(color || '#ffffff');
    }
    resolveColor();
    return () => { mounted = false; };
  }, [teamLogoUri, Colors.surfaceAlt]);
  const pointsFromCalendar = useMemo(
    () => sumTeamPointsFromCalendarBlocks(calendarBlocks, teamName),
    [calendarBlocks, teamName]
  );
  const leagueStats = useMemo(() => ({
    position: leagueStatsFromRoute?.position ?? '-',
    played: leagueStatsFromRoute?.played ?? '-',
    pointsScored: Number.isFinite(pointsScoredTotal) ? pointsScoredTotal : pointsFromCalendar,
  }), [leagueStatsFromRoute, pointsScoredTotal, pointsFromCalendar]);


  if (loading) return <LoadingView message={`Cargando ${teamName}…`} />;

  const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: Colors.background },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.background },
    backBtn: { width: 38, height: 38, borderRadius: Radius.full, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.surfaceAlt },
    backIcon: { color: Colors.textPrimary, fontSize: 24, fontWeight: Typography.weight.bold, lineHeight: 28, textAlign: 'center' },
    headerTitle: { flex: 1, color: Colors.textPrimary, fontSize: Typography.size.lg, fontWeight: Typography.weight.bold, textAlign: 'center', paddingHorizontal: Spacing.sm },
    scroll: { flex: 1, backgroundColor: Colors.background },
    profileCard: { alignItems: 'center', paddingTop: Spacing.xl, paddingBottom: Spacing.lg, gap: Spacing.md },
    avatarOuter: { width: 132, height: 132, borderRadius: 66, backgroundColor: Colors.primaryAlpha20, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.primaryAlpha20 },
    avatarInner: { width: 116, height: 116, borderRadius: 58, backgroundColor: teamLogoUri ? teamLogoBgColor : Colors.surfaceAlt, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: Colors.background, ...Shadow.md },
    avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', ...Shadow.md },
    avatarImage: { width: 88, height: 88, borderRadius: 44 },
    avatarText: { color: Colors.textOnPrimary, fontSize: Typography.size.xxl, fontWeight: Typography.weight.bold },
    teamName: { color: Colors.textPrimary, fontSize: Typography.size.xl, fontWeight: Typography.weight.bold, textAlign: 'center', paddingHorizontal: Spacing.lg },
    leagueBadge: { backgroundColor: Colors.primaryAlpha10, borderRadius: Radius.full, paddingVertical: Spacing.xs, paddingHorizontal: Spacing.md, borderWidth: 1, borderColor: Colors.primaryAlpha20 },
    leagueBadgeText: { color: Colors.primary, fontSize: Typography.size.xs, fontWeight: Typography.weight.semiBold },
    statsGrid: { flexDirection: 'row', gap: Spacing.sm, marginHorizontal: Spacing.md, marginBottom: Spacing.lg, justifyContent: 'space-between' },
    statCard: { width: '31.5%', backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.lg, paddingVertical: Spacing.sm, alignItems: 'center' },
    statLabel: { color: Colors.textMuted, fontSize: 10, fontWeight: Typography.weight.bold, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 2 },
    statValue: { color: Colors.primary, fontSize: Typography.size.xl, fontWeight: Typography.weight.bold },
    errorBanner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: Spacing.lg, marginBottom: Spacing.md, backgroundColor: 'rgba(220,50,50,0.12)', borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderWidth: 1, borderColor: 'rgba(220,50,50,0.25)' },
    errorText: { color: '#f87171', fontSize: Typography.size.sm, flex: 1 },
    retryText: { color: Colors.primary, fontSize: Typography.size.sm, fontWeight: Typography.weight.semiBold, marginLeft: Spacing.md },
    section: { marginHorizontal: Spacing.sm, marginBottom: Spacing.xl, backgroundColor: Colors.surface, borderRadius: Radius.xl, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border },
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{teamName}</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        style={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={refresh} colors={[Colors.primary]} tintColor={Colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarOuter}>
            <View style={styles.avatarInner}>
              {teamLogoUri ? (
                <Image source={{ uri: teamLogoUri }} style={styles.avatarImage} resizeMode="contain" />
              ) : (
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initials || '?'}</Text>
                </View>
              )}
            </View>
          </View>
          <Text style={styles.teamName}>{teamName}</Text>
          {tournamentTitle ? (
            <View style={styles.leagueBadge}>
              <Text style={styles.leagueBadgeText}>{tournamentTitle}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Posición</Text>
            <Text style={styles.statValue}>{leagueStats.position}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Partidos</Text>
            <Text style={styles.statValue}>{leagueStats.played}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Puntos</Text>
            <Text style={styles.statValue}>{leagueStats.pointsScored}</Text>
          </View>
        </View>

        {/* Error inline (not blocking — show what we have) */}
        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>⚠ No se pudo cargar la info del equipo</Text>
            <TouchableOpacity onPress={refresh}>
              <Text style={styles.retryText}>Reintentar</Text>
            </TouchableOpacity>
          </View>
        ) : null}


        <View style={{ height: Spacing.xxxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}
