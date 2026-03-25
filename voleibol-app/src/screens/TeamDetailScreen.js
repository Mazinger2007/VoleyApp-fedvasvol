// src/screens/TeamDetailScreen.js
// Pantalla de detalle de un equipo — Diseño premium v2.
// Muestra: hero con escudo, stats, próximos y partidos jugados.

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  StatusBar,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';

import LoadingView from '../components/LoadingView';
import { useFetch } from '../hooks/useFetch';
import { toAbsoluteUrl } from '../utils/htmlParser';
import { getDominantBorderColor } from '../utils/imageColor';
import { Spacing, Typography, Radius } from '../styles/theme';
import { useTheme } from '../contexts/ThemeContext';
import { getMatchSummary, parseMatchDateTime, MatchCard, rowToMatch } from '../components/MatchList';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('');
}

function buildImageSizeCandidates(url = '') {
  const raw = String(url || '').trim();
  if (!raw) return [];
  const sizePattern = /\.\d+x\d+(?=\.[a-zA-Z0-9]+(?:[?#]|$))/i;
  if (!sizePattern.test(raw)) return [raw];
  const variants = [200, 120, 60].map((size) =>
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

// Calculate win/loss/draw from played matches for a team
function calcRecord(matches = [], teamName = '') {
  const norm = normalizeTeamName(teamName);
  let wins = 0, losses = 0;
  matches.forEach(m => {
    const summary = getMatchSummary(m);
    if (summary.state !== 'finished') return;
    const homeNorm = normalizeTeamName(summary.homeTeam || '');
    const awayNorm = normalizeTeamName(summary.awayTeam || '');
    const isHome = homeNorm === norm;
    const isAway = awayNorm === norm;
    if (!isHome && !isAway) return;
    const score = parseScorePair(m);
    if (!score) return;
    if (isHome) score.home > score.away ? wins++ : losses++;
    else score.away > score.home ? wins++ : losses++;
  });
  return { wins, losses };
}

// ─── Sub-component: Stat card ──────────────────────────────────────────────────
function StatCard({ label, value, icon, Colors, isDark }) {
  return (
    <View style={{
      flex: 1,
      backgroundColor: isDark ? Colors.surfaceAlt : Colors.surface,
      borderRadius: Radius.xl,
      borderWidth: 1,
      borderColor: Colors.border,
      paddingVertical: 14,
      paddingHorizontal: 8,
      alignItems: 'center',
      gap: 4,
    }}>
      <MaterialIcons name={icon} size={18} color={Colors.primary} />
      <Text style={{ fontSize: 20, fontWeight: '800', color: Colors.textPrimary, lineHeight: 24 }}>
        {value ?? '—'}
      </Text>
      <Text style={{ fontSize: 10, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 }}>
        {label}
      </Text>
    </View>
  );
}

// ─── Sub-component: Section header ────────────────────────────────────────────
function SectionHeader({ title, count, Colors }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <Text style={{ fontSize: 16, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.3 }}>
        {title}
      </Text>
      {count > 0 && (
        <View style={{ backgroundColor: Colors.primaryAlpha15, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: Colors.primary }}>{count}</Text>
        </View>
      )}
    </View>
  );
}

// ─── Pantalla principal ───────────────────────────────────────────────────────

export default function TeamDetailScreen({ route, navigation }) {
  const { colors: Colors, isDark } = useTheme();
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

  useEffect(() => {
    if (blocks && blocks.length > 0) {
      console.log('--- TEAM DETAIL BLOCKS ---');
      blocks.forEach(b => {
        if (b.type === 'table') {
          console.log('[Table]', b.headers?.join(' | '), 'Rows:', b.rows?.length);
        } else if (b.type === 'heading') {
          console.log('[Heading]', b.content);
        } else if (b.type === 'paragraph') {
          console.log('[Paragraph]', b.content?.substring(0, 50));
        }
      });
    }
  }, [blocks]);
  const [accentColor, setAccentColor] = useState(null);
  const [logoError, setLogoError] = useState(false);

  const initials = useMemo(() => getInitials(teamName), [teamName]);
  const teamLogoCandidates = useMemo(() => buildImageSizeCandidates(teamLogo), [teamLogo]);
  const teamLogoUri = useMemo(() => teamLogoCandidates[0] || null, [teamLogoCandidates]);

  // Extract dominant accent color from logo
  useEffect(() => {
    let mounted = true;
    async function resolveColor() {
      if (!teamLogoUri) return;
      const color = await getDominantBorderColor(teamLogoUri);
      if (mounted && color) setAccentColor(color);
    }
    resolveColor();
    return () => { mounted = false; };
  }, [teamLogoUri]);

  const heroAccent = accentColor || Colors.primary;

  const pointsFromCalendar = useMemo(
    () => sumTeamPointsFromCalendarBlocks(calendarBlocks, teamName),
    [calendarBlocks, teamName]
  );

  const leagueStats = useMemo(() => ({
    position: leagueStatsFromRoute?.position ?? '—',
    played: leagueStatsFromRoute?.played ?? '—',
    pointsScored: Number.isFinite(pointsScoredTotal) ? pointsScoredTotal : (pointsFromCalendar || '—'),
  }), [leagueStatsFromRoute, pointsScoredTotal, pointsFromCalendar]);

  const { statsTable, matchTables, otherTables } = useMemo(() => {
    let stats = null;
    const matches = [];
    const others = [];

    (blocks || []).forEach(b => {
      if (b.type === 'table') {
        const hStr = (b.headers || []).join(' ').toLowerCase();
        // Detect table with stats from standard Resumen or the new AJAX ['Nombre', 'Cantidad'] headers
        if (/(puntos|partidos|sets a favor)/i.test(hStr) || /nombre.*cantidad/i.test(hStr)) {
          stats = b;
        } else if (b.matches?.length > 0 || /equipo 1.*resultado|local.*visitante|fecha/i.test(hStr)) {
          matches.push(b);
        } else {
          others.push(b);
        }
      }
    });
    return { statsTable: stats, matchTables: matches, otherTables: others };
  }, [blocks]);

  const teamMatches = useMemo(() => {
    const list = [];
    const norm = normalizeTeamName(teamName);
    
    // De las tablas propias de la página de Resumen de equipo
    matchTables.forEach(b => {
      if (Array.isArray(b.matches) && b.matches.length > 0) {
        list.push(...b.matches);
      } else if (Array.isArray(b.rows) && Array.isArray(b.headers)) {
        b.rows.forEach(r => list.push(rowToMatch(r, b.headers)));
      }
    });

    // Del calendario de toda la liga (más seguro y siempre completo si navegamos desde Ranking)
    (calendarBlocks || []).forEach(b => {
      if (b.type === 'table' && Array.isArray(b.matches)) {
        b.matches.forEach(m => {
          if (normalizeTeamName(m.homeTeam) === norm || normalizeTeamName(m.awayTeam) === norm) {
            // Evitar duplicados
            const alreadyAdded = list.some(existing => 
              (existing.homeTeam === m.homeTeam && existing.awayTeam === m.awayTeam && existing.rawDate === m.rawDate) ||
              (existing.matchScore?.home === m.matchScore?.home && existing.homeTeam === m.homeTeam)
            );
            if (!alreadyAdded) {
              list.push(m);
            }
          }
        });
      }
    });

    return list.filter(Boolean);
  }, [matchTables, calendarBlocks, teamName]);

  const { upcomingMatches, playedMatches } = useMemo(() => {
    const withSummary = teamMatches.map(m => {
      const summary = getMatchSummary(m);
      const dateObj = parseMatchDateTime(summary.rawDate);
      const ts = dateObj ? dateObj.getTime() : 0;
      return { match: m, ts, state: summary.state };
    });

    const upcoming = withSummary
      .filter(m => m.state === 'upcoming' || m.state === 'live')
      .sort((a, b) => a.ts - b.ts)
      .map(m => m.match);

    const played = withSummary
      .filter(m => m.state === 'finished')
      .sort((a, b) => b.ts - a.ts)
      .map(m => m.match);

    return { upcomingMatches: upcoming, playedMatches: played };
  }, [teamMatches]);

  const record = useMemo(() => calcRecord(playedMatches, teamName), [playedMatches, teamName]);

  // -- NEW STATS EXTRACTION FROM AJAX TABS --
  const officialStats = useMemo(() => {
    let pts = null, played = null, wins = null, losses = null;
    if (statsTable?.rows) {
      statsTable.rows.forEach(r => {
        const key = String(r[0] || '').toLowerCase();
        const val = Number((r[1] || '').replace(/[^\d]/g, ''));
        if (key.includes('puntos') && !key.includes('juego') && !key.includes('favor')) pts = val;
        if (key.includes('jugados')) played = val;
        if (key.includes('ganados')) wins = val;
        if (key.includes('perdidos')) losses = val;
      });
    }
    return { pts, played, wins, losses };
  }, [statsTable]);

  // Prioritize official stats over computed ones
  const finalPoints = officialStats.pts ?? leagueStats.pointsScored;
  const finalPlayed = officialStats.played ?? leagueStats.played;
  const finalWins = officialStats.wins ?? record.wins;

  if (loading) return <LoadingView variant="clean" message={`Cargando ${teamName}…`} />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: isDark ? '#0f1923' : '#f5f7f8' }} edges={['top']}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={isDark ? '#0f1923' : '#ffffff'} />

      {/* ── Navbar ── */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: isDark ? '#0f1923' : '#ffffff', paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: isDark ? '#2f3033' : 'rgba(226, 232, 240, 0.5)' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primaryAlpha10, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 2, borderColor: heroAccent }}>
            {teamLogoUri && !logoError ? (
              <Image source={{ uri: teamLogoUri }} style={{ width: '100%', height: '100%' }} contentFit="cover" onError={() => setLogoError(true)} />
            ) : (
              <Text style={{ fontSize: 16, fontWeight: '900', color: Colors.primary }}>{initials || '?'}</Text>
            )}
          </View>
          <Text style={{ fontSize: 18, fontWeight: '900', textTransform: 'uppercase', color: isDark ? '#f1f5f9' : '#001f3d', letterSpacing: -0.5, flexShrink: 1 }} numberOfLines={1} ellipsizeMode="tail">
            {teamName}
          </Text>
        </View>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7} style={{ padding: 8, marginRight: -8, marginLeft: 8 }}>
          <MaterialIcons name="close" size={24} color={isDark ? '#f1f5f9' : '#001f3d'} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} colors={[Colors.primary]} />}
      >
        {/* ── Error banner ── */}
        {error && !loading ? (
          <TouchableOpacity onPress={refresh} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginTop: 16, backgroundColor: Colors.errorSoft, borderRadius: Radius.lg, padding: 12, borderWidth: 1, borderColor: `${Colors.error}40` }}>
            <MaterialIcons name="error-outline" size={18} color={Colors.error} />
            <Text style={{ flex: 1, fontSize: 13, color: Colors.error }}>No se pudo cargar información. Toca para reintentar.</Text>
          </TouchableOpacity>
        ) : null}

        {/* ── Hero Identity Section ── */}
        <View style={{ position: 'relative', overflow: 'hidden', borderRadius: Radius.xl, backgroundColor: heroAccent, padding: 32, marginHorizontal: 16, marginTop: error ? 16 : 24, elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.15, shadowRadius: 20 }}>
          {/* Background icon */}
          <MaterialIcons name="sports-volleyball" size={200} color="#ffffff" style={{ position: 'absolute', top: 0, right: '-10%', opacity: 0.1, transform: [{ rotate: '-12deg' }] }} />
          
          <View style={{ alignItems: 'center', zIndex: 10 }}>
            {/* Logo */}
            <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: '#ffffff', padding: 4, marginBottom: 16, borderWidth: 4, borderColor: 'rgba(255,255,255,0.2)' }}>
              {teamLogoUri && !logoError ? (
                <Image source={{ uri: teamLogoUri }} style={{ width: '100%', height: '100%', borderRadius: 40 }} contentFit="contain" />
              ) : (
                <View style={{ flex: 1, borderRadius: 40, backgroundColor: Colors.primaryAlpha15, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 32, fontWeight: '900', color: heroAccent }}>{initials || '?'}</Text>
                </View>
              )}
            </View>
            {/* Team Name */}
            <Text style={{ fontSize: 24, fontWeight: '900', color: '#ffffff', textAlign: 'center', marginBottom: 12, textTransform: 'uppercase', letterSpacing: -0.5 }}>
              {teamName}
            </Text>
            {/* Badges */}
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 24, flexWrap: 'wrap', justifyContent: 'center' }}>
              {tournamentTitle ? (
                <View style={{ backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 16 }}>
                  <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#ffffff', textTransform: 'uppercase', letterSpacing: 1 }}>
                    {tournamentTitle}
                  </Text>
                </View>
              ) : null}
              <View style={{ backgroundColor: '#22c55e', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 16 }}>
                <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#ffffff', textTransform: 'uppercase', letterSpacing: 1 }}>Activo</Text>
              </View>
            </View>
            
            {/* Season Stats Bento Row */}
            <View style={{ flexDirection: 'row', width: '100%', gap: 12 }}>
              <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: Radius.lg, padding: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
                <Text style={{ fontSize: 10, fontWeight: 'bold', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Puntos</Text>
                <Text style={{ fontSize: 24, fontWeight: '900', color: '#ffffff' }}>{finalPoints}</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: Radius.lg, padding: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
                <Text style={{ fontSize: 10, fontWeight: 'bold', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Ganados</Text>
                <Text style={{ fontSize: 24, fontWeight: '900', color: '#ffffff' }}>{finalWins}</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: Radius.lg, padding: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
                <Text style={{ fontSize: 10, fontWeight: 'bold', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Jugados</Text>
                <Text style={{ fontSize: 24, fontWeight: '900', color: '#ffffff' }}>{finalPlayed}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── Next Match ── */}
        {upcomingMatches.length > 0 && (
          <View style={{ paddingHorizontal: 16, paddingTop: 24 }}>
            <Text style={{ fontSize: 12, fontWeight: 'bold', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12, paddingHorizontal: 4 }}>Próximo Partido</Text>
            <View style={{ backgroundColor: isDark ? Colors.surface : '#ffffff', borderRadius: Radius.xl, padding: 24, borderWidth: 1, borderColor: isDark ? Colors.border : '#e2e8f0', borderLeftWidth: 4, borderLeftColor: heroAccent, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
                {/* Home Team */}
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: isDark ? '#1e293b' : '#f8fafc', marginBottom: 8, padding: 8 }}>
                    {upcomingMatches[0].homeLogo ? (
                      <Image source={{ uri: upcomingMatches[0].homeLogo }} style={{ width: '100%', height: '100%' }} contentFit="contain" />
                    ) : (
                      <Text style={{ fontSize: 14, fontWeight: '900', color: heroAccent }}>{getInitials(upcomingMatches[0].homeTeam)}</Text>
                    )}
                  </View>
                  <Text style={{ fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', textAlign: 'center', color: Colors.textPrimary }} numberOfLines={2}>{upcomingMatches[0].homeTeam}</Text>
                </View>
                {/* VS */}
                <View style={{ alignItems: 'center', gap: 4 }}>
                  <Text style={{ fontSize: 10, fontWeight: '900', color: heroAccent, backgroundColor: heroAccent + '15', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }}>VS</Text>
                  <Text style={{ fontSize: 12, fontWeight: 'bold', color: Colors.textMuted }}>{(upcomingMatches[0].dateTime || '').split('T')[1]?.substring(0,5) || 'TBD'}</Text>
                </View>
                {/* Away Team */}
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: isDark ? '#1e293b' : '#f8fafc', marginBottom: 8, padding: 8 }}>
                    {upcomingMatches[0].awayLogo ? (
                      <Image source={{ uri: upcomingMatches[0].awayLogo }} style={{ width: '100%', height: '100%' }} contentFit="contain" />
                    ) : (
                      <Text style={{ fontSize: 14, fontWeight: '900', color: heroAccent }}>{getInitials(upcomingMatches[0].awayTeam)}</Text>
                    )}
                  </View>
                  <Text style={{ fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', textAlign: 'center', color: Colors.textPrimary }} numberOfLines={2}>{upcomingMatches[0].awayTeam}</Text>
                </View>
              </View>
              <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: isDark ? '#2f3033' : '#f8fafc', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <MaterialIcons name="calendar-today" size={14} color={Colors.textMuted} />
                  <Text style={{ fontSize: 10, fontWeight: 'bold', color: Colors.textMuted, letterSpacing: 0.5 }}>{getMatchSummary(upcomingMatches[0]).formattedDate || 'Fecha por confirmar'}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <MaterialIcons name="location-pin" size={16} color={Colors.textMuted} />
                  <Text style={{ fontSize: 10, fontWeight: 'bold', color: Colors.textMuted, letterSpacing: 0.5, flexShrink: 1 }} numberOfLines={1}>{upcomingMatches[0].venue || 'Por designar'}</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* ── Competiciones ── */}
        {tournamentTitle && (
          <View style={{ paddingHorizontal: 16, paddingTop: 24 }}>
            <Text style={{ fontSize: 12, fontWeight: 'bold', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12, paddingHorizontal: 4 }}>Competiciones</Text>
            <View style={{ backgroundColor: isDark ? Colors.surface : '#ffffff', borderRadius: Radius.lg, padding: 16, borderWidth: 1, borderColor: isDark ? Colors.border : '#e2e8f0', flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <View style={{ width: 40, height: 40, backgroundColor: Colors.primaryAlpha10, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center' }}>
                <MaterialIcons name="emoji-events" size={24} color={heroAccent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, fontWeight: 'bold', color: heroAccent, textTransform: 'uppercase' }}>{tournamentTitle}</Text>
                <Text style={{ fontSize: 10, color: Colors.textMuted, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1, marginTop: 2 }}>Temporada Actual</Text>
              </View>
            </View>
          </View>
        )}

        {/* ── Últimos Resultados ── */}
        {playedMatches.length > 0 && (
          <View style={{ paddingHorizontal: 16, paddingTop: 24 }}>
            <Text style={{ fontSize: 12, fontWeight: 'bold', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12, paddingHorizontal: 4 }}>Últimos Resultados</Text>
            <View style={{ backgroundColor: isDark ? Colors.surface : '#ffffff', borderRadius: Radius.xl, borderWidth: 1, borderColor: isDark ? Colors.border : '#e2e8f0', overflow: 'hidden' }}>
              {playedMatches.slice(0, 5).map((m, i) => {
                const norm = normalizeTeamName(teamName);
                const isHome = normalizeTeamName(m.homeTeam) === norm;
                const score = parseScorePair(m);
                const isWin = score ? (isHome ? score.home > score.away : score.away > score.home) : false;
                const opponent = isHome ? m.awayTeam : m.homeTeam;
                
                return (
                  <View key={`last-res-${i}`} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: i < 4 && i < playedMatches.length - 1 ? 1 : 0, borderBottomColor: isDark ? '#2f3033' : '#f8fafc' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: isWin ? '#22c55e' : '#ef4444' }} />
                      <Text style={{ fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase', color: Colors.textSecondary, flexShrink: 1 }} numberOfLines={1}>vs {opponent}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                      <Text style={{ fontSize: 18, fontWeight: '900', color: heroAccent, letterSpacing: -1 }}>
                        {score ? (isHome ? `${score.home} - ${score.away}` : `${score.away} - ${score.home}`) : m.scoreText}
                      </Text>
                      <View style={{ backgroundColor: isWin ? '#dcfce7' : '#fee2e2', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }}>
                        <Text style={{ fontSize: 10, fontWeight: 'bold', color: isWin ? '#15803d' : '#991b1b', textTransform: 'uppercase' }}>{isWin ? 'W' : 'L'}</Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* ── Empty state ── */}
        {upcomingMatches.length === 0 && playedMatches.length === 0 && !loading && !error && (
          <View style={{ alignItems: 'center', paddingTop: 64, paddingHorizontal: 32 }}>
            <MaterialIcons name="sports-volleyball" size={56} color={Colors.textMuted} style={{ opacity: 0.3, marginBottom: 16 }} />
            <Text style={{ fontSize: 16, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center', marginBottom: 8 }}>
              Sin datos del equipo
            </Text>
            <Text style={{ fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 }}>
              No se encontraron partidos ni información asociada al equipo en curso.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
