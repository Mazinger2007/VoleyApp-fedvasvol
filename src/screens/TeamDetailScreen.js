// src/screens/TeamDetailScreen.js
// Pantalla de detalle de un equipo — Diseño premium v2.
// Muestra: hero con escudo, stats, próximos y partidos jugados.

import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { getTeamColor, getClubBaseName, subscribeColors, CLUB_BASE_COLORS } from '../constants/teamColors';
import { supabase } from '../utils/supabase';
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
import { useFavorites } from '../contexts/FavoritesContext';
import { getMatchSummary, parseMatchDateTime, MatchCard, rowToMatch } from '../components/MatchList';
import { loadTeamDetailsCache, saveTeamDetailsCache } from '../utils/teamCache';

// Componente para items de competición reutilizable
const CompItem = ({ comp, navigation, teamName, isDark, Colors, Radius, heroAccent }) => (
  <TouchableOpacity
    activeOpacity={0.7}
    onPress={() => {
      if (!comp.href) return;
      if (comp.href.includes('/team/')) {
        navigation.push('TeamDetail', {
          teamUrl: comp.href,
          teamName: teamName
        });
      } else {
        navigation.push('League', {
          url: comp.href,
          title: comp.title,
          season: null,
          defaultTab: 'ranking'
        });
      }
    }}
    style={{ backgroundColor: isDark ? Colors.surface : '#ffffff', borderRadius: Radius.lg, padding: 16, borderWidth: 1, borderColor: isDark ? Colors.border : '#e2e8f0', flexDirection: 'row', alignItems: 'center', gap: 16, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, marginBottom: 4 }}
  >
    <View style={{ width: 40, height: 40, backgroundColor: Colors.primaryAlpha10, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center' }}>
      <MaterialIcons name="emoji-events" size={24} color={heroAccent} />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={{ fontSize: 12, fontWeight: 'bold', color: heroAccent, textTransform: 'uppercase' }}>{comp.title || comp.name}</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
        <Text style={{ fontSize: 10, color: Colors.textMuted, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5 }}>{comp.season || 'Temporada Actual'}</Text>
        {comp.category && (
          <Text style={{ fontSize: 10, color: Colors.textMuted, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5 }}>• {comp.category}</Text>
        )}
        {comp.gender && (
          <Text style={{ fontSize: 10, color: Colors.textMuted, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5 }}>• {comp.gender}</Text>
        )}
      </View>
    </View>
    <MaterialIcons name="chevron-right" size={20} color={Colors.textMuted} />
  </TouchableOpacity>
);

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
  let home = Number(homeRaw);
  let away = Number(awayRaw);

  if (!Number.isFinite(home) || !Number.isFinite(away)) {
    // Try to parse from scoreText if available
    const scoreText = match?.scoreText || '';
    const matchScore = scoreText.match(/(\d+)\s*-\s*(\d+)/);
    if (matchScore) {
      home = Number(matchScore[1]);
      away = Number(matchScore[2]);
    }
  }

  if (!Number.isFinite(home) || !Number.isFinite(away)) return null;
  return { home, away };
}

function sumTeamPointsFromCalendarBlocks(blocks = [], teamName = '') {
  const norm = normalizeTeamName(teamName);
  const clubBase = getClubBaseName(teamName);
  if (!norm) return 0;
  const tables = (blocks || []).filter((block) => block.type === 'table');
  return tables.reduce((acc, table) => {
    const matches = table?.matches || [];
    return acc + matches.reduce((sum, match) => {
      const homeName = normalizeTeamName(match?.homeTeam || '');
      const awayName = normalizeTeamName(match?.awayTeam || '');
      const homeClub = getClubBaseName(match?.homeTeam || '');
      const awayClub = getClubBaseName(match?.awayTeam || '');

      const isHome = homeName === norm || (clubBase && homeClub === clubBase);
      const isAway = awayName === norm || (clubBase && awayClub === clubBase);

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

function sumSetsFromMatches(matches = [], teamName = '', type = 'for') {
  const norm = normalizeTeamName(teamName);
  const clubBase = getClubBaseName(teamName);
  return matches.reduce((acc, m) => {
    const summary = getMatchSummary(m);
    const hBase = getClubBaseName(summary.homeTeam);
    const aBase = getClubBaseName(summary.awayTeam);
    const isHome = normalizeTeamName(summary.homeTeam) === norm || (clubBase && hBase === clubBase);
    const isAway = normalizeTeamName(summary.awayTeam) === norm || (clubBase && aBase === clubBase);
    if (!isHome && !isAway) return acc;

    const sets = summary.sets || [];
    let setsFor = 0, setsAgainst = 0;
    if (sets.length > 0) {
      sets.forEach(s => {
        const homeS = Number(s.home || 0);
        const awayS = Number(s.away || 0);
        if (isHome) {
          if (homeS > awayS) setsFor++;
          else if (awayS > homeS) setsAgainst++;
        } else {
          if (awayS > homeS) setsFor++;
          else if (homeS > awayS) setsAgainst++;
        }
      });
    } else {
      // Fallback a set scores (matchScore)
      const homeScore = Number(summary.homeScore || 0);
      const awayScore = Number(summary.awayScore || 0);
      if (isHome) {
        setsFor = homeScore;
        setsAgainst = awayScore;
      } else {
        setsFor = awayScore;
        setsAgainst = homeScore;
      }
    }
    return acc + (type === 'for' ? setsFor : setsAgainst);
  }, 0);
}

// Calculate win/loss/draw from played matches for a team
function calcRecord(matches = [], teamName = '') {
  const norm = normalizeTeamName(teamName);
  const baseName = getClubBaseName(teamName);
  let wins = 0, losses = 0;
  matches.forEach(m => {
    const summary = getMatchSummary(m);
    if (summary.state !== 'finished') return;
    const homeNorm = normalizeTeamName(summary.homeTeam || '');
    const awayNorm = normalizeTeamName(summary.awayTeam || '');
    const hBase = getClubBaseName(summary.homeTeam || '');
    const aBase = getClubBaseName(summary.awayTeam || '');
    const isHome = homeNorm === norm || (baseName && hBase === baseName);
    const isAway = awayNorm === norm || (baseName && aBase === baseName);

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
  const { isFavorite, toggleFavorite } = useFavorites();
  const {
    teamName = '',
    teamUrl,
    teamLogo: teamLogoFromRoute,
    tournamentTitle,
    leagueStats: leagueStatsFromRoute,
    calendarUrl,
    rankingBlocks,
    calendarBlocks: calendarBlocksFromRoute,
  } = route.params || {};

  const teamBaseName = useMemo(() => getClubBaseName(teamName) || teamName, [teamName]);

  const teamFavId = teamUrl || teamName || '';
  const isTeamFav = isFavorite('team', teamFavId);
  const handleToggleTeamFav = useCallback(() => {
    toggleFavorite('team', teamFavId, teamName || 'Equipo');
  }, [teamFavId, teamName, toggleFavorite]);

  // Siempre obtener datos del equipo (competiciones, equipaciones, estadísticas)
  const teamFetch = useFetch(teamUrl || null);
  // Calendario: si ya viene en params se omite fetch (optimización)
  const skipCalendarFetch = !!calendarBlocksFromRoute;
  const calendarFetch = useFetch(calendarUrl || null, { lazy: skipCalendarFetch });

  // Fusionar bloques: primero los del equipo (competiciones, equipaciones, stats),
  // luego rankingBlocks si llegaron desde la pantalla anterior (estadísticas vía ranking)
  const blocks = useMemo(() => {
    const merged = [...(teamFetch.blocks || [])];
    if (rankingBlocks) {
      rankingBlocks.forEach(b => {
        if (!merged.includes(b)) merged.push(b);
      });
    }
    return merged;
  }, [teamFetch.blocks, rankingBlocks]);
  const calendarBlocks = calendarBlocksFromRoute || calendarFetch.blocks;

  const loading = (!rankingBlocks && teamFetch.loading) || (!skipCalendarFetch && calendarFetch.loading);
  const error = teamFetch.error || calendarFetch.error;
  
  const refresh = useCallback(() => {
    if (teamUrl) teamFetch.refresh();
    if (!skipCalendarFetch) calendarFetch.refresh();
  }, [teamUrl, teamFetch, skipCalendarFetch, calendarFetch]);

  const teamLogoResolved = useMemo(() => {
    if (blocks && blocks.length > 0) {
      for (const block of blocks) {
        if (block.matches) {
          for (const match of block.matches) {
            const hBase = getClubBaseName(match.homeTeam);
            const aBase = getClubBaseName(match.awayTeam);
            if ((match.homeTeam === teamName || (hBase && hBase === teamBaseName)) && match.homeLogo) return match.homeLogo;
            if ((match.awayTeam === teamName || (aBase && aBase === teamBaseName)) && match.awayLogo) return match.awayLogo;
          }
        }
      }
    }
    return teamLogoFromRoute;
  }, [blocks, teamName, teamBaseName, teamLogoFromRoute]);

  // Extraer datos estructurados del bloque teamContext
  const teamContext = useMemo(() => blocks.find(b => b.type === 'teamContext') || null, [blocks]);

  const competitions = useMemo(() => teamContext?.competitions || blocks.find(b => b.type === 'competitions')?.items || [], [teamContext, blocks]);
  const equipaciones = useMemo(() => teamContext?.equipaciones || blocks.find(b => b.type === 'equipaciones')?.items || [], [teamContext, blocks]);

  // Cache de equipo unificado
  const teamId = teamContext?.teamId || teamFavId;
  const [teamCache, setTeamCache] = useState(null);
  const isCacheLoading = useRef(false);
  useEffect(() => {
    if (!teamId || teamCache) return;
    let mounted = true;
    isCacheLoading.current = true;
    loadTeamDetailsCache(teamId).then(cached => {
      if (mounted && cached) setTeamCache(cached);
    }).catch(() => {}).finally(() => { isCacheLoading.current = false; });
    return () => { mounted = false; };
  }, [teamId]);

  // Guardar caché cuando llegan datos del servidor
  const hasFreshData = teamContext && (teamContext.upcomingMatches?.length > 0 || teamContext.competitions?.length > 0);
  useEffect(() => {
    if (hasFreshData && teamId && teamContext) {
      saveTeamDetailsCache(teamId, {
        teamInfo: teamContext.teamInfo,
        competitions: teamContext.competitions,
        equipaciones: teamContext.equipaciones,
        upcomingMatches: teamContext.upcomingMatches,
        lastResults: teamContext.lastResults,
        fetchedAt: Date.now(),
      }).catch(() => {});
    }
  }, [hasFreshData, teamId, teamContext]);

  const [accentColor, setAccentColor] = useState(null);
  const [dbColor, setDbColor] = useState(null);
  const [logoError, setLogoError] = useState(false);
  const [showAllLastMatches, setShowAllLastMatches] = useState(false);

  const initials = useMemo(() => getInitials(teamName), [teamName]);
  const teamLogoCandidates = useMemo(() => buildImageSizeCandidates(teamLogoResolved), [teamLogoResolved]);
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

  // Subscribe to global color updates (from initTeamsData)
  const [, forceRender] = useState(0);
  useEffect(() => {
    const unsub = subscribeColors(() => forceRender(n => n + 1));
    return unsub;
  }, []);

  // Direct DB fetch: query Supabase for this team's color
  // This guarantees we get the color regardless of global init timing
  useEffect(() => {
    let mounted = true;
    async function fetchDbColor() {
      try {
        // First try the global state (may already be loaded)
        const globalColor = getTeamColor(teamName);
        if (globalColor && globalColor !== '#001f3d') {
          if (mounted) setDbColor(globalColor);
          return;
        }

        // Direct query to Supabase
        const { data, error } = await supabase
          .from('teams_data')
          .select('base_name, color');

        if (error || !data) return;

        // Find matching team by checking if teamName contains any base_name
        const upperName = teamName.toUpperCase();
        const match = data.find(row =>
          row.base_name && upperName.includes(row.base_name.toUpperCase())
        );

        if (mounted && match?.color) {
          setDbColor(match.color);
        }
      } catch (_) {
        // Silently fail — will fall back to logo color or theme primary
      }
    }
    fetchDbColor();
    return () => { mounted = false; };
  }, [teamName]);

  // Also update dbColor when global state changes (e.g. initTeamsData completes later)
  const manualColor = getTeamColor(teamName);
  useEffect(() => {
    if (manualColor && manualColor !== '#001f3d') {
      setDbColor(manualColor);
    }
  }, [manualColor]);

  // Determine hero accent color with priority: DB color > logo dominant color > theme primary
  // Filter out white/near-white colors that would make the hero invisible
  const isUsableColor = useCallback((c) => {
    if (!c || c === '#001f3d') return false;
    const hex = c.replace('#', '');
    if (hex.length < 6) return false;
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return luminance <= 210;
  }, []);
  const heroAccent = isUsableColor(dbColor) ? dbColor : (isUsableColor(accentColor) ? accentColor : Colors.primary);

  const pointsFromCalendar = useMemo(
    () => sumTeamPointsFromCalendarBlocks(calendarBlocks, teamName),
    [calendarBlocks, teamName]
  );

  const leagueStats = useMemo(() => ({
    position: leagueStatsFromRoute?.position ?? '—',
    played: leagueStatsFromRoute?.played ?? '—',
    won: leagueStatsFromRoute?.won ?? '—',
    lost: leagueStatsFromRoute?.lost ?? '—',
    setsFor: leagueStatsFromRoute?.setsFor ?? '—',
    setsAgainst: leagueStatsFromRoute?.setsAgainst ?? '—',
    points: leagueStatsFromRoute?.points ?? pointsFromCalendar ?? '—',
  }), [leagueStatsFromRoute, pointsFromCalendar]);

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

    // 1. Usar datos directos del teamContext (más completos)
    const ctxUpcoming = teamContext?.upcomingMatches || [];
    const ctxLast = teamContext?.lastResults || [];
    ctxUpcoming.forEach(m => { if (!list.some(ex => ex.homeTeam === m.homeTeam && ex.awayTeam === m.awayTeam && ex.date === m.date)) list.push(m); });
    ctxLast.forEach(m => { if (!list.some(ex => ex.homeTeam === m.homeTeam && ex.awayTeam === m.awayTeam && ex.matchScore?.home === m.matchScore?.home)) list.push(m); });

    // 1b. Fallback a caché si no hay datos frescos del servidor
    if (ctxUpcoming.length === 0 && ctxLast.length === 0 && teamCache) {
      (teamCache.upcomingMatches || []).forEach(m => {
        if (!list.some(ex => ex.homeTeam === m.homeTeam && ex.awayTeam === m.awayTeam)) list.push(m);
      });
      (teamCache.lastResults || []).forEach(m => {
        if (!list.some(ex => ex.homeTeam === m.homeTeam && ex.awayTeam === m.awayTeam && ex.matchScore?.home === m.matchScore?.home)) list.push(m);
      });
    }

    // 2. Fallback: de las tablas propias de la página de Resumen de equipo
    const norm = normalizeTeamName(teamName);
    matchTables.forEach(b => {
      if (Array.isArray(b.matches) && b.matches.length > 0) {
        b.matches.forEach(m => {
          if (!list.some(ex => ex.homeTeam === m.homeTeam && ex.awayTeam === m.awayTeam)) list.push(m);
        });
      } else if (Array.isArray(b.rows) && Array.isArray(b.headers)) {
        b.rows.forEach(r => {
          const m = rowToMatch(r, b.headers);
          if (m && !list.some(ex => ex.homeTeam === m.homeTeam && ex.awayTeam === m.awayTeam)) list.push(m);
        });
      }
    });

    // 3. Del calendario de toda la liga (si existe)
    const teamBaseName = getClubBaseName(teamName) || teamName;
    const normAlt = normalizeTeamName(teamName);
    (calendarBlocks || []).forEach(b => {
      if (b.type === 'table' && Array.isArray(b.matches)) {
        b.matches.forEach(m => {
          const hBase = getClubBaseName(m.homeTeam);
          const aBase = getClubBaseName(m.awayTeam);
          const isHome = normalizeTeamName(m.homeTeam) === normAlt || (teamBaseName && hBase === teamBaseName);
          const isAway = normalizeTeamName(m.awayTeam) === normAlt || (teamBaseName && aBase === teamBaseName);
          if (isHome || isAway) {
            if (!list.some(ex => ex.homeTeam === m.homeTeam && ex.awayTeam === m.awayTeam && ex.date === m.date)) {
              list.push(m);
            }
          }
        });
      }
    });

    return list.filter(Boolean);
  }, [teamContext, matchTables, calendarBlocks, teamName, teamCache]);

  const { upcomingMatches, playedMatches } = useMemo(() => {
    const withSummary = teamMatches.map(m => {
      const summary = getMatchSummary(m);
      const dateObj = parseMatchDateTime(summary.rawDate);
      const ts = dateObj ? dateObj.getTime() : 0;
      // UNIFICAR: Asegurar que el objeto match tenga los campos de summary
      return { match: { ...m, ...summary }, ts, state: summary.state };
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

  // -- RAW STATS from AJAX tab (all rows directly) --
  const statsRows = useMemo(() => {
    if (statsTable?.rows && statsTable.rows.length > 0) {
      return statsTable.rows
        .filter(r => {
          const label = String(r[0] || '').trim().toLowerCase();
          return label !== 'nombre' && label !== 'name' && label !== 'cantidad' && label !== 'quantity';
        })
        .map(r => ({
          label: String(r[0] || '').trim(),
          value: String(r[1] || '').trim(),
        }));
    }
    return [];
  }, [statsTable]);

  // Fusionar tournamentTitle (competencia actual) + competiciones desde la web + caché
  const mergedCompetitions = useMemo(() => {
    const items = [];
    if (tournamentTitle) {
      items.push({ title: tournamentTitle, season: 'Actual' });
    }
    const source = competitions.length > 0 ? competitions : (teamCache?.competitions || []);
    const kept = new Set();
    source.forEach(comp => {
      const season = String(comp.season || '');
      if (kept.has(comp.title)) return;
      if (season && !season.includes('2025') && !season.includes('2026')) return;
      kept.add(comp.title);
      items.push(comp);
    });
    items.sort((a, b) => {
      const sA = parseInt(String(a.season || ''), 10);
      const sB = parseInt(String(b.season || ''), 10);
      if (isNaN(sA) && isNaN(sB)) return 0;
      if (isNaN(sA)) return 1;
      if (isNaN(sB)) return -1;
      return sB - sA;
    });
    return items;
  }, [tournamentTitle, competitions, teamCache]);

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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <TouchableOpacity onPress={handleToggleTeamFav} activeOpacity={0.7} style={{ padding: 8 }}>
            <MaterialIcons
              name={isTeamFav ? 'favorite' : 'favorite-border'}
              size={22}
              color={isTeamFav ? Colors.error : (isDark ? '#f1f5f9' : '#001f3d')}
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7} style={{ padding: 8, marginRight: -8 }}>
            <MaterialIcons name="close" size={24} color={isDark ? '#f1f5f9' : '#001f3d'} />
          </TouchableOpacity>
        </View>
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

          </View>
        </View>

        {/* ── Próximos Partidos ── */}
        {upcomingMatches.length > 0 ? (
          <View style={{ paddingHorizontal: 16, paddingTop: 24 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, paddingHorizontal: 4 }}>
              <Text style={{ fontSize: 12, fontWeight: 'bold', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 1.5 }}>Próximos Partidos</Text>
              <Text style={{ fontSize: 11, fontWeight: '700', color: heroAccent }}>{upcomingMatches.length} partido(s)</Text>
            </View>
            <View style={{ gap: 8 }}>
              {upcomingMatches.map((m, i) => {
                const summary = getMatchSummary(m);
                const isHome = normalizeTeamName(m.homeTeam) === normalizeTeamName(teamName) || (getClubBaseName(teamName) && getClubBaseName(m.homeTeam) === getClubBaseName(teamName));
                const opponent = isHome ? m.awayTeam : m.homeTeam;
                return (
                  <TouchableOpacity
                    key={`upcoming-${i}`}
                    activeOpacity={0.7}
                    onPress={() => navigation.push('MatchDetail', { match: m, calendarUrl })}
                    style={{ backgroundColor: isDark ? Colors.surface : '#ffffff', borderRadius: Radius.lg, padding: 16, borderWidth: 1, borderColor: isDark ? Colors.border : '#e2e8f0', borderLeftWidth: 4, borderLeftColor: heroAccent, flexDirection: 'row', alignItems: 'center', gap: 12 }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 12, fontWeight: 'bold', color: Colors.textPrimary, textTransform: 'uppercase' }}>vs {opponent}</Text>
                      <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                          <MaterialIcons name="calendar-today" size={11} color={Colors.textMuted} />
                          <Text style={{ fontSize: 10, color: Colors.textMuted, fontWeight: '600' }}>{summary.dateLabel || m.date || 'TBD'}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                          <MaterialIcons name="access-time" size={11} color={Colors.textMuted} />
                          <Text style={{ fontSize: 10, color: Colors.textMuted, fontWeight: '600' }}>{summary.time || m.time || 'TBD'}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                          <MaterialIcons name={isHome ? 'home' : 'flight-takeoff'} size={11} color={Colors.textMuted} />
                          <Text style={{ fontSize: 10, color: Colors.textMuted, fontWeight: '600' }}>{isHome ? 'Local' : 'Visitante'}</Text>
                        </View>
                      </View>
                    </View>
                    <View style={{ backgroundColor: heroAccent + '20', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
                      <Text style={{ fontSize: 9, fontWeight: '900', color: heroAccent, textTransform: 'uppercase', letterSpacing: 0.5 }}>Detalles</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ) : (
          <View style={{ paddingHorizontal: 16, paddingTop: 24, }}>
            <Text style={{ fontSize: 12, fontWeight: 'bold', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12, paddingHorizontal: 4 }}>Próximos Partidos</Text>
            <View style={{ backgroundColor: isDark ? Colors.surface : '#ffffff', borderRadius: Radius.xl, padding: 32, borderWidth: 1, borderColor: isDark ? Colors.border : '#e2e8f0', alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed' }}>
              <MaterialIcons name="event-busy" size={32} color={Colors.textMuted} style={{ opacity: 0.5, marginBottom: 8 }} />
              <Text style={{ fontSize: 14, fontWeight: '700', color: Colors.textMuted, textAlign: 'center' }}>No hay partidos próximos programados</Text>
            </View>
          </View>
        )}

        {/* ── Detailed Stats Table (raw from AJAX) ── */}
        {statsRows.length > 0 && (
          <View style={{ paddingHorizontal: 16, paddingTop: 24 }}>
            <View style={{ backgroundColor: isDark ? Colors.surface : '#ffffff', borderRadius: Radius.xl, overflow: 'hidden', borderWidth: 1, borderColor: isDark ? Colors.border : '#e2e8f0', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 }}>
              <View style={{ paddingHorizontal: 24, paddingVertical: 16, backgroundColor: isDark ? '#1e293b' : '#f8fafc', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 12, fontWeight: 'bold', letterSpacing: 1.5, color: heroAccent, textTransform: 'uppercase' }}>Estadísticas de Temporada</Text>
                <Text style={{ fontSize: 10, fontWeight: 'bold', color: Colors.textMuted }}>{tournamentTitle ? 'ACTUAL' : ''}</Text>
              </View>
              <View style={{ padding: 20, gap: 12 }}>
                {statsRows.map((s, i) => (
                  <View key={`stat-${i}`} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: isDark ? '#2f3033' : '#f1f5f9', paddingBottom: 10 }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.3 }}>{s.label}</Text>
                    <Text style={{ fontSize: 20, fontWeight: '900', color: Colors.textPrimary }}>{s.value}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* ── Competiciones ── */}
        {mergedCompetitions.length > 0 && (
          <View style={{ paddingHorizontal: 16, paddingTop: 24 }}>
            <Text style={{ fontSize: 12, fontWeight: 'bold', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12, paddingHorizontal: 4 }}>Competiciones</Text>
            <View style={{ gap: 10 }}>
              {mergedCompetitions.map((comp, idx) => (
                <CompItem key={`comp-${idx}`} comp={comp} navigation={navigation} teamName={teamName} isDark={isDark} Colors={Colors} Radius={Radius} heroAccent={heroAccent} />
              ))}
            </View>
          </View>
        )}

        {/* ── Equipaciones Section ── */}
        {equipaciones && equipaciones.length > 0 && (
          <View style={{ paddingHorizontal: 16, paddingTop: 24 }}>
            <View style={{ flexDirection: 'row', gap: 16 }}>
              {equipaciones.map((eq, idx) => (
                <View key={`eq-${idx}`} style={{ flex: 1, backgroundColor: isDark ? Colors.surface : '#ffffff', padding: 16, borderRadius: Radius.xl, borderWidth: 1, borderColor: isDark ? Colors.border : '#e2e8f0', borderTopWidth: 4, borderTopColor: eq.hexColor || heroAccent, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                    <MaterialIcons name="checkroom" size={20} color={eq.hexColor || heroAccent} />
                    <Text style={{ fontSize: 10, fontWeight: '900', uppercase: true, letterSpacing: 1.5, color: Colors.textPrimary }}>Equipación {idx + 1}</Text>
                  </View>
                  <View style={{ height: 64, width: '100%', backgroundColor: eq.hexColor ? `${eq.hexColor}15` : Colors.primaryAlpha10, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: eq.hexColor ? `${eq.hexColor}30` : Colors.border }}>
                    <Text style={{ fontSize: 12, fontWeight: 'bold', color: eq.hexColor || heroAccent, textTransform: 'uppercase' }}>{eq.colorName || 'Desconocido'}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── Últimos Resultados ── */}
        {playedMatches.length > 0 && (
          <View style={{ paddingHorizontal: 16, paddingTop: 24 }}>
            <Text style={{ fontSize: 12, fontWeight: 'bold', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12, paddingHorizontal: 4 }}>Últimos Resultados</Text>
            <View style={{ backgroundColor: isDark ? Colors.surface : '#ffffff', borderRadius: Radius.xl, borderWidth: 1, borderColor: isDark ? Colors.border : '#e2e8f0', overflow: 'hidden', elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 }}>
              {(showAllLastMatches ? playedMatches : playedMatches.slice(0, 6)).map((m, i) => {
                const norm = normalizeTeamName(teamName);
                const clubBase = getClubBaseName(teamName);
                const hBase = getClubBaseName(m.homeTeam);
                const isHome = normalizeTeamName(m.homeTeam) === norm || (clubBase && hBase === clubBase);
                const score = parseScorePair(m);
                const isWin = score ? (isHome ? score.home > score.away : score.away > score.home) : false;
                const opponent = isHome ? m.awayTeam : m.homeTeam;

                return (
                  <TouchableOpacity
                    key={`last-res-${i}`}
                    activeOpacity={0.7}
                    onPress={() => navigation.push('MatchDetail', { match: m, calendarUrl })}
                    style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: i < 4 && i < playedMatches.length - 1 ? 1 : 0, borderBottomColor: isDark ? '#2f3033' : '#f8fafc' }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: isWin ? '#22c55e' : '#ef4444' }} />
                      <Text style={{ fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase', color: Colors.textSecondary, flexShrink: 1 }} numberOfLines={1}>vs {opponent}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                      <Text style={{ fontSize: 18, fontWeight: '900', color: Colors.textPrimary, letterSpacing: -1 }}>
                        {score ? (isHome ? `${score.home} - ${score.away}` : `${score.away} - ${score.home}`) : m.scoreText}
                      </Text>
                      <View style={{ backgroundColor: isWin ? '#dcfce7' : '#fee2e2', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }}>
                        <Text style={{ fontSize: 10, fontWeight: 'bold', color: isWin ? '#15803d' : '#991b1b', textTransform: 'uppercase' }}>{isWin ? ' V ' : ' D '}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
              {playedMatches.length > 6 && (
                <TouchableOpacity
                  onPress={() => setShowAllLastMatches(!showAllLastMatches)}
                  activeOpacity={0.7}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, backgroundColor: Colors.primaryAlpha10 }}
                >
                  <Text style={{ color: heroAccent, fontWeight: '800', fontSize: 12, textTransform: 'uppercase' }}>
                    {showAllLastMatches ? 'Ocultar' : `Ver más (${playedMatches.length})`}
                  </Text>
                  <MaterialIcons name={showAllLastMatches ? "expand-less" : "expand-more"} size={20} color={heroAccent} />
                </TouchableOpacity>
              )}
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
