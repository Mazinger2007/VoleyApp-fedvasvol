import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, RefreshControl, StyleSheet, StatusBar, Image,
  Linking, Alert, Platform, PanResponder, Animated, Easing, useWindowDimensions, Modal, TextInput
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import PagerView from '../components/PagerViewWrapper';
import * as Calendar from 'expo-calendar';
import { MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import CompetitionTable from '../components/CompetitionTable';
import MatchList, { parseMatchDateTime, getMatchSummary, formatMatchDisplayDate } from '../components/MatchList';
import Bracket from '../components/Bracket';
import LoadingView from '../components/LoadingView';
import ErrorView from '../components/ErrorView';
import { useFetch } from '../hooks/useFetch';
import { useLivePolling } from '../hooks/useLivePolling';
import {
  discoverCalendarUrlFromRanking,
  discoverSeasonLabel,
  toRankingUrl,
  extractPhaseLinks,
  fetchChampionshipData,
} from '../utils/htmlParser';
import { getDominantBorderColor } from '../utils/imageColor';
import { ensureLogoColorsCached, getCachedLogoColorSync, requestLogoColorExtraction, subscribeToLogoColor } from '../utils/logoColorCache';
import { Radius, Spacing, Typography } from '../styles/theme';
import { useTheme } from '../contexts/ThemeContext';
import StatusModal from '../components/StatusModal';

function ensureCalendarAllUrl(value = '') {
  if (!value) return value;
  const clean = value.replace(/\/+$/, '');
  if (/\/calendar\/\d+\/all$/i.test(clean)) return clean;
  if (/\/calendar\/\d+$/i.test(clean)) return clean;
  return clean;
}

function getPreferredCalendarUrl(rankingUrl = '', fallback = '') {
  const tournament = rankingUrl.match(/^(https?:\/\/[^/]+\/[a-z]{2}\/tournament\/\d+)/i)?.[1] || '';
  return ensureCalendarAllUrl(fallback || `${tournament}/calendar`);
}

function stripLogoResolution(url = '') {
  if (!url) return '';
  return String(url).replace(/\.\d+x\d+(?=\.[a-zA-Z0-9]+(?:[?#].*)?$)/, '');
}

function withLogoResolution(url = '', size = 120) {
  if (!url) return '';
  const clean = stripLogoResolution(url);
  return clean.replace(/(\.[a-zA-Z0-9]+)([?#].*)?$/, `.${size}x${size}$1$2`);
}

function buildLogoCandidates(url = '') {
  if (!url) return [];
  const base = stripLogoResolution(url);
  return [
    withLogoResolution(base, 200),
    base,
    withLogoResolution(base, 120),
    withLogoResolution(base, 60),
    withLogoResolution(base, 30),
  ].filter((value, index, list) => value && list.indexOf(value) === index);
}

function normalizeTeamName(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function findColIndex(headers = [], ...keywords) {
  for (const kw of keywords) {
    const idx = headers.findIndex((h) => String(h || '').toLowerCase().includes(kw));
    if (idx >= 0) return idx;
  }
  return -1;
}

function findPositionCol(headers = [], teamCol = -1) {
  const explicit = findColIndex(headers, 'pos', 'puesto', '#');
  if (explicit >= 0) return explicit;
  const repeated = headers
    .map((h, i) => ({ h: String(h || '').trim().toLowerCase(), i }))
    .filter((item) => item.h === 'p')
    .map((item) => item.i);
  const candidates = repeated.filter((i) => teamCol < 0 || i < teamCol);
  return candidates[0] ?? repeated[0] ?? -1;
}

function findPointsCol(headers = [], teamCol = -1) {
  const explicit = findColIndex(headers, 'pts', 'puntos', 'point');
  if (explicit >= 0) return explicit;
  const repeated = headers
    .map((h, i) => ({ h: String(h || '').trim().toLowerCase(), i }))
    .filter((item) => item.h === 'p')
    .map((item) => item.i);
  const candidates = repeated.filter((i) => teamCol < 0 || i > teamCol);
  return candidates[0] ?? repeated[1] ?? -1;
}

function getCellValue(row = [], idx = -1, fallback = '-') {
  if (idx < 0) return fallback;
  const value = String(row[idx] ?? '').trim();
  return value || fallback;
}

function parseScorePair(match = {}) {
  const homeRaw = match?.homeScore ?? match?.matchScore?.home;
  const awayRaw = match?.awayScore ?? match?.matchScore?.away;
  const home = Number(homeRaw);
  const away = Number(awayRaw);
  if (!Number.isFinite(home) || !Number.isFinite(away)) return null;
  return { home, away };
}

function sumTeamPointsScored(calendarTables = [], teamName = '') {
  const normalizedTeam = normalizeTeamName(teamName);
  if (!normalizedTeam) return 0;
  return calendarTables.reduce((acc, table) => {
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


function FeaturedMatch({ match, onPress }) {
  if (!match) return null;
  const { colors: Colors, isDark } = useTheme();
  const summary = getMatchSummary(match);
  const { state, homeTeam, awayTeam, homeScore, awayScore, venue, time, dateLabel } = summary;

  return (
    <View style={{ padding: Spacing.lg, paddingBottom: 0 }}>
      <Text style={{ color: isDark ? Colors.textPrimary : Colors.primary, fontSize: Typography.size.lg, fontWeight: Typography.weight.bold, marginBottom: Spacing.md }}>
        Partido Destacado
      </Text>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => onPress(match)}
        style={{
          backgroundColor: isDark ? '#1e293b' : '#ffffff',
          borderRadius: Radius.xl,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: 'rgba(13,14,242,0.1)',
          elevation: 5,
          ...(Platform.OS !== 'web' ? {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.1,
            shadowRadius: 12,
          } : {
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
          })
        }}
      >
        <View style={{ height: 160, backgroundColor: Colors.surfaceAlt, overflow: 'hidden' }}>
          <Image
            source={{ uri: 'https://images.unsplash.com/photo-1592659762303-90081d34b277?q=80&w=1000&auto=format&fit=crop' }}
            style={{ width: '100%', height: '100%', opacity: 0.8 }}
            resizeMode="cover"
          />
          <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,31,61,0.4)' }} />
          {state === 'live' && (
            <View style={{ position: 'absolute', top: 12, left: 12, backgroundColor: '#ef4444', paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.sm, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' }} />
              <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>EN VIVO</Text>
            </View>
          )}
        </View>

        <View style={{ padding: Spacing.lg }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>
              {homeTeam} vs {awayTeam}
            </Text>
            {homeScore !== null && (
               <Text style={{ color: '#fff', fontSize: 20, fontWeight: 'bold' }}>
                 {homeScore} - {awayScore}
               </Text>
            )}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 16 }}>
            <MaterialIcons name="location-on" size={14} color="#e2e8f0" />
            <Text style={{ color: '#e2e8f0', fontSize: 13 }}>{venue || 'Sede por confirmar'}</Text>
            <Text style={{ color: '#e2e8f0', fontSize: 13, marginLeft: 4 }}>
              • {time}{time && dateLabel ? ' · ' : ''}{dateLabel}
            </Text>
          </View>

          <View style={{ backgroundColor: '#fff', paddingVertical: 12, borderRadius: Radius.lg, alignItems: 'center' }}>
            <Text style={{ color: Colors.primary, fontWeight: 'bold', fontSize: 14 }}>Ver detalles del partido</Text>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const normalizeString = (str) => (str || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const getMonthDays = (year, month) => {
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = [];
  
  // Adjusted for Monday start (0=Mon, ..., 6=Sun)
  const offset = (firstDay === 0 ? 6 : firstDay - 1);
  for (let i = 0; i < offset; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);
  return days;
};

export default function LeagueScreen({ route, navigation }) {
  const { colors: Colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const { url, title, defaultTab, season } = route.params || {};

  // Construct URLs with season if present
  const getUrlWithSeason = (baseUrl) => {
    if (!season || !baseUrl) return baseUrl;
    const urlObj = new URL(baseUrl);
    urlObj.searchParams.set('season', season);
    return urlObj.toString();
  };

  const [activeTab, setActiveTab] = useState(defaultTab || 'ranking');
  const pagerRef = useRef(null);
  const [expandedCalendar, setExpandedCalendar] = useState({});
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [modalHomeLogoIndex, setModalHomeLogoIndex] = useState(0);
  const [modalAwayLogoIndex, setModalAwayLogoIndex] = useState(0);
  const [homeLogoCenterColor, setHomeLogoCenterColor] = useState('#ffffff');
  const [awayLogoCenterColor, setAwayLogoCenterColor] = useState('#ffffff');
  const [modalTab, setModalTab] = useState('details');
  const [reminderSaved, setReminderSaved] = useState(false);
  const [reminderLoading, setReminderLoading] = useState(false);
  const [statusModal, setStatusModal] = useState({ visible: false, title: '', message: '', type: 'info' });
  const [seasonLabel, setSeasonLabel] = useState(null);
  const [resolvedCalendarUrl, setResolvedCalendarUrl] = useState(null);

  // Search State
  const [isSearchModalVisible, setIsSearchModalVisible] = useState(false);
  const [searchTeams, setSearchTeams] = useState([]); // Multi-select teams
  const [searchDate, setSearchDate] = useState(null);
  const [searchLocations, setSearchLocations] = useState([]); // Multi-select locations
  const [isTeamPickerVisible, setIsTeamPickerVisible] = useState(false);
  const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);
  const [isLocationPickerVisible, setIsLocationPickerVisible] = useState(false);
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());

  const hasActiveFilters = searchTeams.length > 0 || searchLocations.length > 0 || !!searchDate;

  const headerIconAnim = useRef(new Animated.Value(0)).current;
  const modalSlideX = useRef(new Animated.Value(0)).current;
  const modalGestureStartX = useRef(0);

  const switchTab = useCallback((nextTab) => {
    if (!nextTab || nextTab === activeTab) return;
    setActiveTab(nextTab);
    if (pagerRef.current) {
      pagerRef.current.setPage(nextTab === 'ranking' ? 0 : 1);
    }
  }, [activeTab]);

  useEffect(() => {
    Animated.timing(headerIconAnim, {
      toValue: activeTab === 'calendar' ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [activeTab]);

  useEffect(() => {
    if (isDatePickerVisible && !searchDate && allAvailableDates.length > 0) {
      const first = allAvailableDates[0];
      const match = first.toLowerCase().match(/(\d+)\s+de\s+([a-z]+)/);
      if (match) {
        const mIdx = MONTHS.findIndex(m => m.toLowerCase().startsWith(match[2].substring(0, 3)));
        if (mIdx !== -1) {
          setCalendarMonth(mIdx);
        }
      }
    } else if (isDatePickerVisible && searchDate) {
      const match = searchDate.toLowerCase().match(/(\d+)\s+de\s+([a-z]+)/);
      if (match) {
         const mIdx = MONTHS.findIndex(m => m.toLowerCase().startsWith(match[2].substring(0, 3)));
         if (mIdx !== -1) setCalendarMonth(mIdx);
      }
    }
  }, [isDatePickerVisible, searchDate, allAvailableDates]);

  const modalPanResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) =>
      Math.abs(gesture.dx) > 18 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.2,
    onPanResponderGrant: () => {
      modalSlideX.stopAnimation((value) => {
        modalGestureStartX.current = value;
      });
    },
    onPanResponderMove: (_, gesture) => {
      const minX = -screenWidth;
      const maxX = 0;
      const next = Math.max(minX, Math.min(maxX, modalGestureStartX.current + gesture.dx));
      modalSlideX.setValue(next);
    },
    onPanResponderRelease: (_, gesture) => {
      const shouldGoMap = (gesture.dx < -50 || (gesture.dx < -24 && gesture.vx < -0.45)) && modalTab === 'details';
      const shouldGoDetails = (gesture.dx > 50 || (gesture.dx > 24 && gesture.vx > 0.45)) && modalTab === 'map';
      const nextModalTab = shouldGoMap ? 'map' : shouldGoDetails ? 'details' : modalTab;
      const targetX = nextModalTab === 'map' ? -screenWidth : 0;
      Animated.timing(modalSlideX, {
        toValue: targetX,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      if (nextModalTab !== modalTab) setModalTab(nextModalTab);
    },
    onPanResponderTerminate: () => {
      const targetX = modalTab === 'map' ? -screenWidth : 0;
      Animated.timing(modalSlideX, {
        toValue: targetX,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    },
  }), [modalSlideX, modalTab, screenWidth]);

  const rankingUrl = useMemo(() => getUrlWithSeason(toRankingUrl(url)), [url, season]);
  
  const {
    blocks: rankingBlocks,
    loading: rankingLoading,
    error: rankingError,
    refresh: refreshRanking,
  } = useFetch(rankingUrl);

  const calendarUrlFromBlocks = useMemo(() => {
    const linkBlocks = (rankingBlocks || []).filter((b) => b.type === 'link');

    const calendarByHref = linkBlocks.find((b) => /\/calendar\/\d+/i.test(b.href || ''));
    if (calendarByHref?.href) return calendarByHref.href;

    const calendarByText = linkBlocks.find(
      (b) => /calendario|calendar/i.test((b.content || '').toLowerCase()) && /\/calendar\//i.test(b.href || '')
    );
    if (calendarByText?.href) return calendarByText.href;

    const match = rankingUrl.match(/^(https?:\/\/[^/]+\/(?:es|en)\/tournament\/\d+)/i) || 
                  rankingUrl.match(/^(https?:\/\/[^/]+\/tournament\/\d+)/i);
    return match ? `${match[1]}/calendar` : null;
  }, [rankingBlocks, rankingUrl]);

  useEffect(() => {
    let mounted = true;

    async function resolveCalendar() {
      if (calendarUrlFromBlocks && /\/calendar\/\d+/i.test(calendarUrlFromBlocks)) {
        if (mounted) setResolvedCalendarUrl(getUrlWithSeason(calendarUrlFromBlocks));
        return;
      }

      try {
        const discovered = await discoverCalendarUrlFromRanking(rankingUrl);
        if (mounted) {
          setResolvedCalendarUrl(getUrlWithSeason(discovered || calendarUrlFromBlocks || null));
        }
      } catch (_) {
        if (mounted) {
          setResolvedCalendarUrl(getUrlWithSeason(calendarUrlFromBlocks || null));
        }
      }
    }

    resolveCalendar();

    return () => {
      mounted = false;
    };
  }, [calendarUrlFromBlocks, rankingUrl, season]);

  // --- NUEVO: Manejo de Campeonatos (Txapelketas) ---
  const [championshipData, setChampionshipData] = useState(null);
  const [championshipLoading, setChampionshipLoading] = useState(false);

  const phaseLinks = useMemo(() => {
    if (!rankingBlocks) return [];
    return extractPhaseLinks(rankingBlocks, rankingUrl);
  }, [rankingBlocks, rankingUrl]);

  const isChampionship = useMemo(() => {
    return (rankingBlocks || []).some(b => b.type === 'bracket');
  }, [rankingBlocks]);

  const {
    blocks: calendarBlocksRaw,
    loading: calendarLoading,
    error: calendarError,
    refresh: refreshCalendar,
  } = useFetch(resolvedCalendarUrl);

  // Live match polling — automatically starts only when EN CURSO matches detected,
  // updates calendarBlocks in place without full re-render of parent.
  const [liveCalendarBlocks, setLiveCalendarBlocks] = useState(null);
  useLivePolling(resolvedCalendarUrl, calendarBlocksRaw, setLiveCalendarBlocks, refreshRanking);

  // Use live-updated blocks if available, else use fetched blocks
  const calendarBlocks = liveCalendarBlocks || calendarBlocksRaw;

  useEffect(() => {
    let mounted = true;
    async function resolveSeason() {
      try {
        const discoveredSeason = await discoverSeasonLabel(rankingUrl);
        if (mounted) setSeasonLabel(discoveredSeason || null);
      } catch (_) {
        if (mounted) setSeasonLabel(null);
      }
    }
    resolveSeason();
    return () => { mounted = false; };
  }, [rankingUrl]);

  // Cache logo colors directly reading from rankingBlocks once available
  useEffect(() => {
    if (!rankingBlocks?.length) return;
    const logos = [];
    for (const block of rankingBlocks) {
      if (block?.rowLogos && Array.isArray(block.rowLogos)) {
        for (const logo of block.rowLogos) {
          if (logo && !logos.includes(logo)) logos.push(logo);
        }
      }
      if (block?.rowImages && Array.isArray(block.rowImages)) {
        for (const logo of block.rowImages) {
          if (logo && !logos.includes(logo)) logos.push(logo);
        }
      }
    }
    if (logos.length) ensureLogoColorsCached(logos, getDominantBorderColor);
  }, [rankingBlocks]);

  const rankingTables = useMemo(
    () => (rankingBlocks || []).filter((b) => b.type === 'table'),
    [rankingBlocks]
  );
  
  const rankingBrackets = useMemo(
    () => (rankingBlocks || []).filter((b) => b.type === 'bracket'),
    [rankingBlocks]
  );

  const calendarTables = useMemo(
    () => (calendarBlocks || []).filter((b) => b.type === 'table').slice().reverse(),
    [calendarBlocks]
  );

  const flattenedMatches = useMemo(() => {
    return calendarTables.flatMap(t => t.matches || []);
  }, [calendarTables]);

  const filteredMatches = useMemo(() => {
    if (!hasActiveFilters) return [];
    let result = [...flattenedMatches];
    
    if (searchTeams.length > 0) {
      result = result.filter(m => 
        searchTeams.includes(m.homeTeam) || 
        searchTeams.includes(m.awayTeam)
      );
    }
    
    if (searchLocations.length > 0) {
      result = result.filter(m => searchLocations.includes(m.venue || 'Sede por confirmar'));
    }
    
    if (searchDate) {
      result = result.filter(m => (m.rawDate || m.date) === searchDate);
    }
    
    return result;
  }, [flattenedMatches, searchTeams, searchLocations, searchDate, hasActiveFilters]);

  const allAvailableTeams = useMemo(() => {
    const teams = new Set();
    flattenedMatches.forEach(m => {
      if (m.homeTeam) teams.add(m.homeTeam);
      if (m.awayTeam) teams.add(m.awayTeam);
    });
    return [...teams].sort();
  }, [flattenedMatches]);

  const allAvailableDates = useMemo(() => {
    const dates = flattenedMatches.map(m => m.rawDate || m.date).filter(Boolean);
    return [...new Set(dates)].sort();
  }, [flattenedMatches]);

  const allAvailableLocations = useMemo(() => {
    const venues = flattenedMatches.map(m => m.venue || 'Sede por confirmar').filter(Boolean);
    return [...new Set(venues)].sort();
  }, [flattenedMatches]);

  const rankingTeamCount = useMemo(() => {
    if (!rankingTables || rankingTables.length === 0) return 0;
    return rankingTables.reduce((acc, table) => acc + (table.rows?.length || 0), 0);
  }, [rankingTables]);

  useEffect(() => {
    if (!calendarTables.length) return;

    setExpandedCalendar((prev) => {
      const next = {};
      calendarTables.forEach((_, i) => {
        const key = `jornada-${i}`;
        next[key] = prev[key] ?? false;
      });
      return next;
    });
  }, [calendarTables]);

  const selectedSets = useMemo(() => {
    if (!selectedMatch?.sets?.length) return [];
    return selectedMatch.sets
      .filter((set) => set && (set.home !== null || set.away !== null))
      .map((set, i) => ({
        number: set.number || i + 1,
        home: set.home ?? '—',
        away: set.away ?? '—',
      }));
  }, [selectedMatch]);

  const toggleCalendarSection = useCallback((index) => {
    const key = `jornada-${index}`;
    setExpandedCalendar((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const openMatchModal = useCallback((match) => {
    if (!match) return;
    setSelectedMatch(match);
    setModalTab('details');
    setReminderSaved(false);
  }, []);

  // OPTIMIZACIÓN: Callbacks estables para evitar re-render de tablas
  const handlePressTeam = useCallback((teamName, teamUrl, teamLogo, leagueStats) => {
    navigation.navigate('TeamDetail', {
      teamName,
      teamUrl,
      teamLogo,
      tournamentTitle: title,
      leagueStats,
      pointsScoredTotal: sumTeamPointsScored(calendarTables, teamName),
      calendarUrl: resolvedCalendarUrl,
    });
  }, [navigation, title, calendarTables, resolvedCalendarUrl]);

  const handlePressExpand = useCallback((tableBlock, tableTitle) => {
    navigation.navigate('RankingTable', {
      tableBlock,
      title: tableTitle || title || 'Clasificación',
      subtitle: seasonLabel || 'Datos oficiales de la federación',
    });
  }, [navigation, title, seasonLabel]);

  const handleOpenInfo = () => {
    navigation.navigate('Info', {
      tournamentUrl: rankingUrl,
      title: title || 'Información',
      teamCount: rankingTeamCount,
    });
  };

  const openTeamFromMatch = (side = 'home') => {
    if (!selectedMatch) return;

    const isHome = side === 'home';
    const teamName = isHome ? (selectedMatch.homeTeam || 'Local') : (selectedMatch.awayTeam || 'Visitante');
    const normalizedTeam = normalizeTeamName(teamName);

    let teamUrl = null;
    let teamLogo = isHome ? (selectedMatch.homeLogo || null) : (selectedMatch.awayLogo || null);
    let leagueStats = {
      position: '-',
      played: '-',
      won: '-',
      points: '-',
    };

    for (const table of rankingTables) {
      const headers = table?.headers || [];
      const rows = table?.rows || [];
      const teamCol = findColIndex(headers, 'equipo', 'club', 'nombre', 'team');
      if (teamCol < 0) continue;

      const posCol = findPositionCol(headers, teamCol);
      const ptsCol = findPointsCol(headers, teamCol);
      const playedCol = findColIndex(headers, 'pj', 'jug', 'played', 'partidos');
      const wonCol = headers.findIndex((h) => ['v', 'pg'].includes(String(h || '').trim().toLowerCase()));

      for (let index = 0; index < rows.length; index += 1) {
        const row = rows[index] || [];
        const rowTeam = getCellValue(row, teamCol, '');
        if (!rowTeam) continue;
        if (normalizeTeamName(rowTeam) !== normalizedTeam) continue;

        teamUrl = table?.rowLinks?.[index] || teamUrl;
        teamLogo = table?.rowLogos?.[index] || table?.rowImages?.[index] || teamLogo;
        leagueStats = {
          position: getCellValue(row, posCol, String(index + 1)),
          played: getCellValue(row, playedCol, '-'),
          won: getCellValue(row, wonCol, '-'),
          points: getCellValue(row, ptsCol, '-'),
        };
        break;
      }

      if (teamUrl || leagueStats.position !== '-') break;
    }

    const pointsScoredTotal = sumTeamPointsScored(calendarTables, teamName);

    navigation.navigate('TeamDetail', {
      teamName,
      teamUrl,
      teamLogo,
      tournamentTitle: title,
      leagueStats,
      pointsScoredTotal,
      calendarUrl: resolvedCalendarUrl,
    });
  };

  const closeMatchModal = () => setSelectedMatch(null);

  const modalHomeLogoCandidates = useMemo(
    () => buildLogoCandidates(selectedMatch?.homeLogo),
    [selectedMatch?.homeLogo]
  );
  const modalAwayLogoCandidates = useMemo(
    () => buildLogoCandidates(selectedMatch?.awayLogo),
    [selectedMatch?.awayLogo]
  );

  const modalHomeLogoUri = modalHomeLogoCandidates[modalHomeLogoIndex] || null;
  const modalAwayLogoUri = modalAwayLogoCandidates[modalAwayLogoIndex] || null;

  useEffect(() => {
    setModalHomeLogoIndex(0);
    setModalAwayLogoIndex(0);
  }, [selectedMatch?.homeLogo, selectedMatch?.awayLogo]);

  // --- NUEVO: Usar caché persistente para los colores de los logos en el modal ---
  useEffect(() => {
    if (!modalHomeLogoUri) { setHomeLogoCenterColor(Colors.surfaceAlt); return; }
    const cached = getCachedLogoColorSync(modalHomeLogoUri);
    if (cached) setHomeLogoCenterColor(cached);
    requestLogoColorExtraction(modalHomeLogoUri, getDominantBorderColor);
    let mounted = true;
    const unsubscribe = subscribeToLogoColor(modalHomeLogoUri, (color) => {
      if (mounted && color) setHomeLogoCenterColor(color);
    });
    return () => { mounted = false; unsubscribe(); };
  }, [modalHomeLogoUri, Colors.surfaceAlt]);

  useEffect(() => {
    if (!modalAwayLogoUri) { setAwayLogoCenterColor(Colors.surfaceAlt); return; }
    const cached = getCachedLogoColorSync(modalAwayLogoUri);
    if (cached) setAwayLogoCenterColor(cached);
    requestLogoColorExtraction(modalAwayLogoUri, getDominantBorderColor);
    let mounted = true;
    const unsubscribe = subscribeToLogoColor(modalAwayLogoUri, (color) => {
      if (mounted && color) setAwayLogoCenterColor(color);
    });
    return () => { mounted = false; unsubscribe(); };
  }, [modalAwayLogoUri, Colors.surfaceAlt]);

  // ── Open venue in maps app ─────────────────────────────────────────────
  const openMaps = (venue) => {
    if (!venue) return;
    const query = encodeURIComponent(venue);
    const url = Platform.OS === 'ios'
      ? `maps://maps.apple.com/?q=${query}`
      : `geo:0,0?q=${query}`;
    Linking.canOpenURL(url).then((supported) => {
      if (supported) {
        Linking.openURL(url);
      } else {
        Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`);
      }
    });
  };

  // ── Add calendar reminder ──────────────────────────────────────────────
  const addReminder = async () => {
    try {
      setReminderLoading(true);
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      if (status !== 'granted') {
        setStatusModal({
          visible: true,
          title: '¡Vaya!',
          message: 'Necesitamos tu permiso para acceder al calendario y poder crear el recordatorio del partido.',
          type: 'error'
        });
        return;
      }

      const match = selectedMatch;
      const homeTeam = match?.homeTeam || 'Local';
      const awayTeam = match?.awayTeam || 'Visitante';
      const rawDate  = match?.rawDate || match?.date || null;
      const timeStr  = match?.time || null;

      // Build start date
      let startDate = new Date();
      if (rawDate) {
        const dmMatch = rawDate.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
        const isoMatch = rawDate.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
        if (dmMatch) {
          startDate = new Date(Number(dmMatch[3]), Number(dmMatch[2]) - 1, Number(dmMatch[1]));
        } else if (isoMatch) {
          startDate = new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
        }
        if (timeStr) {
          const [h, m] = timeStr.split(':').map(Number);
          startDate.setHours(h || 0, m || 0, 0, 0);
        } else {
          startDate.setHours(18, 0, 0, 0);
        }
      }

      const now = new Date();
      if (startDate < now) {
        setStatusModal({
          visible: true,
          title: 'Partido pasado',
          message: 'Este partido ya ha ocurrido, por lo que no podemos añadir un recordatorio al calendario.',
          type: 'warning'
        });
        setReminderLoading(false);
        return;
      }

      const endDate = new Date(startDate.getTime() + (2 * 60 + 30) * 60 * 1000); // +2 h 30 min

      const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      const writable  = calendars.find((c) => c.allowsModifications && c.type !== 'birthday');
      if (!writable) {
        setStatusModal({
          visible: true,
          title: 'Sin calendario',
          message: 'No hemos podido encontrar un calendario editable en tu dispositivo para guardar el evento.',
          type: 'error'
        });
        return;
      }

      await Calendar.createEventAsync(writable.id, {
        title:     `${homeTeam} vs ${awayTeam}`,
        location:  match?.venue || '',
        startDate,
        endDate,
        notes:     `Partido de voleibol · ${title || ''}\nLocal: ${homeTeam} | Visitante: ${awayTeam}`,
        alarms:    [{ relativeOffset: -60 }],  // 1 h before
      });
      setReminderSaved(true);
      setStatusModal({
        visible: true,
        title: '¡Excelente!',
        message: 'El partido se ha guardado en tu calendario. Te avisaremos antes del comienzo.',
        type: 'success'
      });
    } catch (e) {
      setStatusModal({
        visible: true,
        title: 'Error',
        message: 'No se pudo guardar el recordatorio en este momento.',
        type: 'error'
      });
    } finally {
      setReminderLoading(false);
    }
  };

  const RT_LABELS = {
    ranking: 'Clasificación',
    calendar: 'Calendario',
  };

  const TABS = [
    { key: 'ranking', label: 'Clasificación' },
    { key: 'calendar', label: 'Calendario' },
  ];

  const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: Colors.background },
    header: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
      backgroundColor: Colors.background,
    },
    backBtn: {
      width: 40, height: 40,
      justifyContent: 'center', alignItems: 'center',
      backgroundColor: 'transparent',
    },
    headerTitle: { flex: 1, color: isDark ? Colors.textPrimary : Colors.primary, fontSize: Typography.size.lg, fontWeight: Typography.weight.bold, textAlign: 'center', paddingHorizontal: Spacing.sm, letterSpacing: -0.2 },
    tabBar: { flexDirection: 'row', paddingHorizontal: Spacing.md, backgroundColor: Colors.background, borderBottomWidth: 1, borderBottomColor: Colors.border },
    tabItem: { flex: 1, paddingTop: Spacing.sm + 4, paddingBottom: Spacing.sm, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
    tabItemActive: { borderBottomColor: Colors.primary },
    tabLabel: { color: Colors.textMuted, fontSize: Typography.size.sm, fontWeight: Typography.weight.bold },
    tabLabelActive: { color: isDark ? Colors.textOnPrimary : Colors.primary, fontWeight: Typography.weight.bold },
    mainPagerClip: { flex: 1, overflow: 'hidden' },
    tabScene: { ...StyleSheet.absoluteFillObject },
    tabSceneVisible: { opacity: 1 },
    tabSceneHidden: { opacity: 0 },
    mainPagerTrack: { flex: 1, flexDirection: 'row' },
    mainPage: { flex: 1 },
    scroll: { flex: 1, backgroundColor: Colors.background },
    calendarBlock: { paddingTop: Spacing.sm, paddingHorizontal: Spacing.lg },
    calendarTitleBtn: { paddingHorizontal: Spacing.md, paddingTop: Spacing.sm + 2, paddingBottom: Spacing.sm + 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.lg },
    calendarTitle: { color: Colors.textPrimary, fontSize: Typography.size.sm, fontWeight: Typography.weight.bold },
    calendarChevron: { color: Colors.primary, fontSize: Typography.size.lg, fontWeight: Typography.weight.bold },
    emptyWrap: { padding: Spacing.xxl, alignItems: 'center', gap: Spacing.md, marginTop: Spacing.xl },
    emptyIcon: { fontSize: 44 },
    emptyText: { color: Colors.textMuted, fontSize: Typography.size.md, textAlign: 'center' },
    retryBtn: { backgroundColor: Colors.primary, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.xl, borderRadius: Radius.full, marginTop: Spacing.sm },
    retryText: { color: Colors.textOnPrimary, fontWeight: Typography.weight.semiBold, fontSize: Typography.size.sm },
    
    // Search Styles
    searchContainer: { padding: Spacing.md, paddingTop: 0, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.background },
    searchInputRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    searchInputWrapper: { flexDirection: 'row', alignItems: 'center', borderRadius: Radius.lg, backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.border },
    searchFilterBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, height: 38, borderRadius: Radius.lg, backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.border },
    searchResultsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4, marginBottom: Spacing.md },
    searchResultsTitle: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
    emptySearch: { padding: Spacing.xxl, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.xxl },
    emptySearchTitle: { fontSize: 18, fontWeight: 'bold', color: Colors.textPrimary, marginBottom: 8 },
    emptySearchText: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', opacity: 0.7, marginBottom: Spacing.xl },
    clearBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: Radius.xl, backgroundColor: Colors.primary },
    clearBtnText: { color: Colors.textOnPrimary, fontWeight: 'bold' },
    
    // Premium Search Modal
    centeredModalWrapper: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
    premiumSearchCard: { width: '100%', maxWidth: 400, borderRadius: Radius.xxl, padding: Spacing.lg, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 10 },
    searchModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
    searchModalTitle: { fontSize: 20, fontWeight: 'bold' },
    searchModalBody: { maxHeight: 500 },
    searchLabel: { fontSize: 14, fontWeight: 'bold', marginBottom: Spacing.xs, marginLeft: 4, textTransform: 'uppercase', letterSpacing: 1 },
    searchFilterPill: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border },
    searchModalBtn: { height: 54, borderRadius: Radius.xl, justifyContent: 'center', alignItems: 'center', marginTop: Spacing.md },
    searchModalBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold', letterSpacing: 0.5 },
    
    // Selection Modal
    selectionModal: { width: '90%', maxHeight: '80%', borderRadius: Radius.xxl, padding: Spacing.lg },
    selectionModalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: Spacing.md, textAlign: 'center' },
    selectionItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
    selectionItemText: { fontSize: 16 },
    
    // Date Grid
    dateGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, justifyContent: 'space-between' },
    dateGridItem: { width: '30%', padding: Spacing.sm, borderRadius: Radius.lg, alignItems: 'center', borderWidth: 1, borderColor: 'transparent' },
    dateGridDay: { fontSize: 18, fontWeight: 'bold' },
    dateGridMonth: { fontSize: 12, textTransform: 'uppercase' },

    dateModal: { width: '85%', maxHeight: '70%', borderRadius: Radius.xl, padding: Spacing.lg, elevation: 5 },
    dateModalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: Spacing.md, textAlign: 'center' },
    dateItem: { paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
    dateItemText: { fontSize: 14 },
    dateItemActive: { color: Colors.primary, fontWeight: 'bold' },

    // Calendar UI Styles
    calendarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg, paddingHorizontal: Spacing.sm },
    calendarMonthTitle: { fontSize: 18, fontWeight: 'bold' },
    calendarDaysHeader: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: Spacing.sm },
    calendarDayLabel: { width: '14%', textAlign: 'center', fontSize: 12, fontWeight: '600' },
    calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
    calendarDayCell: { width: '14.28%', height: 44, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
    calendarDayText: { fontSize: 15 },
    matchDot: { width: 4, height: 4, borderRadius: 2, marginTop: 2 },
    modalFooterBtn: { height: 50, borderRadius: Radius.lg, justifyContent: 'center', alignItems: 'center' },
    modalFooterBtnText: { fontSize: 14, fontWeight: 'bold', letterSpacing: 0.5 },
    
    // ── Full-screen match modal ───────────────────────────────────────────
    modalRoot: { ...StyleSheet.absoluteFillObject, zIndex: 30, backgroundColor: Colors.background },
    modalHeader: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: Spacing.md,
      paddingTop: insets.top + Spacing.sm,
      paddingBottom: Spacing.sm,
      borderBottomWidth: 1, borderBottomColor: Colors.border,
      backgroundColor: Colors.background,
    },
    modalCloseBtn: { width: 40, height: 40, borderRadius: Radius.full, justifyContent: 'center', alignItems: 'center' },
    modalTitleText: { flex: 1, color: Colors.textPrimary, fontSize: Typography.size.lg, fontWeight: Typography.weight.bold, textAlign: 'center', paddingHorizontal: Spacing.sm },
    modalTabRow: { flexDirection: 'row', paddingHorizontal: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.background },
    modalTabItem: { flex: 1, paddingTop: Spacing.sm + 4, paddingBottom: 0, alignItems: 'center' },
    modalTabLabel: { color: Colors.textMuted, fontSize: Typography.size.md, fontWeight: Typography.weight.bold, paddingBottom: Spacing.sm },
    modalTabLabelActive: { color: Colors.primary, fontWeight: Typography.weight.bold },
    modalTabUnderline: { height: 3, width: '100%', borderRadius: 2, backgroundColor: 'transparent' },
    modalTabUnderlineActive: { backgroundColor: Colors.primary },
    modalPagerClip: { flex: 1, overflow: 'hidden' },
    modalPagerTrack: { flex: 1, flexDirection: 'row' },
    modalPage: { flex: 1 },
    modalScroll: { flex: 1, backgroundColor: Colors.background },
    // Score section
    scoreSection: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.xl, paddingBottom: Spacing.md, alignItems: 'center' },
    scoreTeamsRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', width: '100%', maxWidth: 340, gap: Spacing.md },
    scoreTeamCol: { flex: 1, alignItems: 'center', gap: Spacing.sm },
    scoreLogoWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#ffffff', borderWidth: 2, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
    scoreLogoImg: { width: 76, height: 76, backgroundColor: 'transparent' },
    scoreLogoFallback: { color: Colors.textSecondary, fontSize: Typography.size.lg, fontWeight: Typography.weight.bold },
    scoreTeamRoleLabel: { color: Colors.textMuted, fontSize: Typography.size.xs, fontWeight: Typography.weight.bold, textTransform: 'uppercase', letterSpacing: 1 },
    scoreMid: { alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, paddingTop: Spacing.sm },
    scoreRow: { flexDirection: 'row', alignItems: 'baseline' },
    scoreNum: { fontSize: 48, fontWeight: Typography.weight.bold, color: Colors.textPrimary, lineHeight: 56 },
    scoreSep: { fontSize: Typography.size.xl, color: Colors.textMuted, paddingHorizontal: 4 },
    statusPill: { paddingHorizontal: Spacing.md, paddingVertical: 4, borderRadius: Radius.full, borderWidth: 1 },
    statusPillText: { fontSize: Typography.size.xs, fontWeight: Typography.weight.bold, textTransform: 'uppercase', letterSpacing: 0.5 },
    metaChipsRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: Spacing.sm, marginTop: Spacing.lg, width: '100%' },
    metaChip: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, backgroundColor: Colors.surfaceAlt, borderRadius: Radius.lg },
    metaChipText: { color: Colors.textPrimary, fontSize: Typography.size.sm, fontWeight: Typography.weight.medium },
    // Sets table
    setsSection: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl },
    setsCard: { backgroundColor: Colors.surfaceAlt, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
    setsHeaderRow: { flexDirection: 'row', backgroundColor: Colors.surface, paddingVertical: Spacing.md, paddingHorizontal: Spacing.md },
    setsHeaderCell: { flex: 1, color: Colors.textMuted, fontSize: Typography.size.xs, fontWeight: Typography.weight.bold, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.5 },
    setsDataRow: { flexDirection: 'row', paddingVertical: Spacing.md, paddingHorizontal: Spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
    setsDataRowHighlight: { backgroundColor: isDark ? 'rgba(13,143,242,0.06)' : 'rgba(13,143,242,0.04)' },
    setsCell: { flex: 1, color: Colors.textMuted, fontSize: Typography.size.lg, textAlign: 'center' },
    setsCellWin: { color: Colors.primary, fontWeight: Typography.weight.bold },
    noSetsBox: { backgroundColor: Colors.surfaceAlt, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center' },
    noSetsText: { color: Colors.textMuted, fontSize: Typography.size.sm },
    // Modal footer (details tab)
    modalFooter: {
      paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm,
      paddingBottom: insets.bottom > 0 ? insets.bottom : Spacing.md,
      borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.background,
    },
    modalFooterBtn: { 
      backgroundColor: Colors.primary, 
      borderRadius: Radius.lg, 
      paddingVertical: Spacing.md + 4, 
      alignItems: 'center', 
      elevation: 4,
      ...(Platform.OS !== 'web' ? {
        shadowColor: Colors.primary, 
        shadowOffset: { width: 0, height: 4 }, 
        shadowOpacity: 0.3, 
        shadowRadius: 8,
      } : { 
        boxShadow: `0 4px 8px ${Colors.primary}4D` 
      })
    },
    modalFooterBtnText: { color: Colors.textOnPrimary, fontWeight: Typography.weight.bold, fontSize: Typography.size.md },
    // Map tab
    mapPlaceholder: { height: 220, backgroundColor: isDark ? '#0c1929' : '#b8cfe2', margin: Spacing.md, borderRadius: Radius.xl, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
    mapPinCircle: { 
      width: 64, height: 64, borderRadius: Radius.full, 
      backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', 
      elevation: 6,
      ...(Platform.OS !== 'web' ? {
        shadowColor: Colors.primary, 
        shadowOffset: { width: 0, height: 4 }, 
        shadowOpacity: 0.4, 
        shadowRadius: 12,
      } : { 
        boxShadow: `0 4px 12px ${Colors.primary}66` 
      })
    },
    mapInfoSection: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
    mapTitleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: Spacing.md, marginBottom: Spacing.lg },
    mapVenueTitle: { color: Colors.textPrimary, fontSize: Typography.size.xxl, fontWeight: Typography.weight.bold, letterSpacing: -0.5 },
    mapSportsBadge: { backgroundColor: Colors.primaryAlpha10, borderRadius: Radius.xl, padding: Spacing.md },
    mapBtns: { gap: Spacing.sm },
    mapPrimaryBtn: { 
      backgroundColor: Colors.primary, borderRadius: Radius.xl, 
      paddingVertical: Spacing.md + 4, paddingHorizontal: Spacing.lg, 
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, 
      elevation: 3,
      ...(Platform.OS !== 'web' ? {
        shadowColor: Colors.primary, 
        shadowOffset: { width: 0, height: 4 }, 
        shadowOpacity: 0.25, 
        shadowRadius: 8,
      } : { 
        boxShadow: `0 4px 8px ${Colors.primary}40` 
      })
    },
    mapPrimaryBtnText: { color: Colors.textOnPrimary, fontWeight: Typography.weight.bold, fontSize: Typography.size.md },
    mapSecondaryBtn: { backgroundColor: Colors.surfaceAlt, borderRadius: Radius.xl, paddingVertical: Spacing.md + 4, paddingHorizontal: Spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
    mapSecondaryBtnText: { color: Colors.textPrimary, fontWeight: Typography.weight.semiBold, fontSize: Typography.size.md },
    mapFooter: { borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.background, paddingBottom: insets.bottom > 0 ? insets.bottom : Spacing.sm },
    mapFooterTextBtn: { paddingVertical: Spacing.lg, alignItems: 'center' },
    mapFooterTextBtnText: { color: Colors.textMuted, fontWeight: Typography.weight.bold, fontSize: Typography.size.sm, letterSpacing: 2 },
    // ── Season configuration modal ───────────────────────────────────────
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: Spacing.xl,
    },
    configModal: {
      width: '100%',
      maxWidth: 340,
      borderRadius: Radius.xxl,
      overflow: 'hidden',
      elevation: 10,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.3,
      shadowRadius: 20,
    },
    configModalHeader: {
      height: 120,
      justifyContent: 'center',
      alignItems: 'center',
    },
    configModalBody: {
      padding: Spacing.xl,
      alignItems: 'center',
    },
    configModalTitle: {
      fontSize: 22,
      fontWeight: '900',
      textAlign: 'center',
      marginBottom: Spacing.md,
      textTransform: 'uppercase',
      letterSpacing: -0.5,
    },
    configModalText: {
      fontSize: 16,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: Spacing.s,
    },
    configModalSubtext: {
      fontSize: 13,
      textAlign: 'center',
      lineHeight: 18,
      marginBottom: Spacing.xl,
      fontStyle: 'italic',
    },
    configModalBtn: {
      width: '100%',
      paddingVertical: Spacing.md,
      borderRadius: Radius.lg,
      alignItems: 'center',
    },
    configModalBtnText: {
      color: '#ffffff',
      fontWeight: '800',
      letterSpacing: 1,
    },
  });

  const rankingContent = useMemo(() => {
    const isTournament = /\b(torneo|copa|final|txapelketa|sector)\b/i.test(title || '');
    if (rankingLoading && !rankingTables.length) {
      return <LoadingView message={isTournament ? "Cargando esquema del torneo..." : "Cargando clasificación..."} />;
    }

    const hasData = rankingTables.length > 0 || rankingBrackets.length > 0;

    
    if (hasData) {
      return (
        <View>
          {rankingTables.map((table, i) => (
            <CompetitionTable
              key={`ranking-${i}`}
              tableBlock={table}
              title={seasonLabel
                ? (rankingTables.length > 1 ? `${seasonLabel} · Grupo ${i + 1}` : seasonLabel)
                : (rankingTables.length > 1 ? `Grupo ${i + 1}` : undefined)}
              onPressTeam={handlePressTeam}
              onPressExpand={handlePressExpand}
            />
          ))}
          {rankingBrackets.map((bracket, i) => (
            <Bracket
              key={`bracket-${i}`}
              championshipData={{ mainFlow: [{ title: '', blocks: [bracket] }] }}
              onMatchPress={openMatchModal}
            />
          ))}
        </View>
      );
    }
    return (
      <View style={styles.emptyWrap}>
        <MaterialIcons name="emoji-events" size={44} color={Colors.textMuted} />
        <Text style={styles.emptyText}>No se encontró clasificación para este torneo.</Text>
      </View>
    );
  }, [isChampionship, phaseLinks.length, championshipLoading, championshipData, rankingTables, rankingBrackets, rankingLoading, seasonLabel, handlePressTeam, handlePressExpand, Colors, styles.emptyWrap, styles.emptyText, openMatchModal]);

  const calendarContent = useMemo(() => {
    if (calendarTables.length === 0) {
      return (
        <View style={styles.emptyWrap}>
          <MaterialIcons name="calendar-month" size={44} color={Colors.textMuted} />
          <Text style={styles.emptyText}>No se encontró calendario para este torneo.</Text>
        </View>
      );
    }

    // Find all matches to pick a featured one (live first, then next upcoming)
    const allMatches = [];
    calendarTables.forEach(table => {
      const tableMatches = table.matches || [];
      allMatches.push(...tableMatches);
    });

    const liveMatch = allMatches.find(m => m.state === 'live');
    const featuredMatch = liveMatch || null;

    return (
      <View style={{ paddingBottom: Spacing.xxxl }}>
        {featuredMatch && (
          <FeaturedMatch match={featuredMatch} onPress={openMatchModal} />
        )}

        <View style={{ paddingHorizontal: Spacing.lg, marginTop: Spacing.lg }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: Spacing.md }}>
            <Text style={{ color: isDark ? Colors.textPrimary : Colors.primary, fontSize: Typography.size.lg, fontWeight: Typography.weight.bold }}>
              Jornadas
            </Text>
            <Text style={{ color: Colors.textMuted, fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 }}>
              Temporada {(() => {
                const yearPattern = /\b(20\d{2})\s*[\/\-]\s*(\d{2,4})\b/;
                for (const src of [seasonLabel, season, title]) {
                  const m = (src || '').match(yearPattern);
                  if (m) return `${m[1]}/${m[2].length === 2 ? m[2] : m[2].slice(-2)}`;
                }
                return seasonLabel || season || '--/--';
              })()}
            </Text>
          </View>

          <View style={{ gap: 12 }}>
            {calendarTables.map((table, i) => {
              const jornada = calendarTables.length - i;
              const rawTitle = table.title || `Jornada ${jornada}`;
              const displayTitle = rawTitle.replace(/\s*[-–—(]\s*\d{1,2}[\/\-]\d{1,2}.*$/, '').trim();

              const sectionKey = `jornada-${i}`;
              const isOpen = !!expandedCalendar[sectionKey];
              
              const matches = table.matches || [];
              const hasMatches = matches.length > 0;
              const summaries = matches.map(m => getMatchSummary(m));
              const hasLive = summaries.some(s => s.state === 'live');
              const allFinished = hasMatches && summaries.every(s => s.state === 'finished');
              
              const status = hasLive ? 'live' : allFinished ? 'finished' : 'upcoming';

              return (
                <View key={sectionKey} style={{
                  backgroundColor: isDark ? '#1e293b' : '#ffffff',
                  borderRadius: Radius.xl,
                  borderWidth: 1,
                  borderColor: 'rgba(13,143,242,0.1)',
                  overflow: 'hidden',
                  elevation: 2,
                  ...(Platform.OS !== 'web' ? {
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.08,
                    shadowRadius: 4,
                  } : {
                    boxShadow: '0 1px 4px rgba(0,0,0,0.08)'
                  })
                }}>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => navigation.navigate('JornadaDetail', { 
                      tableBlock: table, 
                      title: displayTitle,
                      subtitle: seasonLabel,
                      calendarUrl: resolvedCalendarUrl
                    })}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 16,
                      borderLeftWidth: (hasMatches && status === 'live') ? 6 : 0,
                      borderLeftColor: '#ef4444',
                      backgroundColor: (hasMatches && status === 'live') ? (isDark ? 'rgba(239, 68, 68, 0.05)' : '#fff5f5') : 'transparent',
                    }}
                  >
                    <View>
                      <Text style={{ color: isDark ? Colors.textPrimary : Colors.primary, fontSize: 16, fontWeight: 'bold' }}>
                        {displayTitle}
                      </Text>
                      <Text style={{ color: Colors.textMuted, fontSize: 12, marginTop: 2 }}>
                        {!hasMatches ? 'Sin información' : status === 'live' ? 'Esta semana' : status === 'finished' ? 'Finalizada' : 'Próxima'}
                      </Text>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <View style={{
                        backgroundColor: !hasMatches ? Colors.surfaceAlt : status === 'live' ? 'rgba(34,197,94,0.1)' : status === 'finished' ? 'rgba(148,163,184,0.1)' : 'rgba(59,130,246,0.1)',
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: Radius.sm,
                        borderWidth: 1,
                        borderColor: !hasMatches ? Colors.border : status === 'live' ? 'rgba(34,197,94,0.2)' : status === 'finished' ? 'rgba(148,163,184,0.2)' : 'rgba(59,130,246,0.2)',
                      }}>
                        <Text style={{
                          color: !hasMatches ? Colors.textMuted : status === 'live' ? '#22c55e' : status === 'finished' ? '#94a3b8' : '#3b82f6',
                          fontSize: 10,
                          fontWeight: 'bold',
                        }}>
                          {!hasMatches ? 'SIN INFORMACIÓN' : status === 'live' ? 'EN CURSO' : status === 'finished' ? 'FINALIZADA' : 'PRÓXIMA'}
                        </Text>
                      </View>
                      <MaterialIcons 
                        name="chevron-right" 
                        size={24} 
                        color={isDark ? Colors.textMuted : 'rgba(15, 23, 42, 0.3)'} 
                      />
                    </View>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        </View>
      </View>
    );
  }, [calendarTables, expandedCalendar, Colors, isDark, openMatchModal, toggleCalendarSection, seasonLabel]);

  const renderSearchResults = useCallback(() => {
    if (filteredMatches.length === 0) {
      return (
        <View style={styles.emptySearch}>
          <MaterialIcons name="search-off" size={64} color={Colors.textMuted} style={{ opacity: 0.3, marginBottom: Spacing.md }} />
          <Text style={[styles.emptySearchTitle, { color: Colors.textPrimary }]}>No hay resultados</Text>
          <Text style={[styles.emptySearchText, { color: Colors.textMuted }]}>
            No se han encontrado partidos que coincidan con los filtros seleccionados.
          </Text>
          <TouchableOpacity 
            style={[styles.clearBtn, { backgroundColor: Colors.primary }]}
            onPress={() => {
              setSearchTeams([]);
              setSearchDate(null);
              setSearchLocations([]);
            }}
          >
            <Text style={styles.clearBtnText}>Limpiar filtros</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={{ padding: Spacing.md }}>
        <View style={styles.searchResultsHeader}>
          <Text style={[styles.searchResultsTitle, { color: Colors.textSecondary }]}>
            {filteredMatches.length} {filteredMatches.length === 1 ? 'partido encontrado' : 'partidos encontrados'}
          </Text>
          <TouchableOpacity onPress={() => {
             setSearchTeams([]);
             setSearchDate(null);
             setSearchLocations([]);
          }}>
            <Text style={{ color: Colors.primary, fontWeight: 'bold', fontSize: 13 }}>Limpiar</Text>
          </TouchableOpacity>
        </View>
        <MatchList 
          matches={filteredMatches}
          onPressMatch={openMatchModal}
          onTeamPress={(name) => handlePressTeam(name, null, null, null)}
          compact={true}
        />
      </View>
    );
  }, [filteredMatches, Colors, hasActiveFilters, openMatchModal, handlePressTeam]);

  if (rankingLoading) return <LoadingView message="Cargando esquema de torneo..." />;
  
  // Manejo de temporada en configuración
  const isConfiguring = rankingError === 'SEASON_CONFIGURING' || calendarError === 'SEASON_CONFIGURING';

  if (rankingError && !isConfiguring) return <ErrorView message={rankingError} onRetry={refreshRanking} />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      {/* Modal de Temporada en Configuración */}
      <Modal
        visible={isConfiguring}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.configModal, { backgroundColor: Colors.surface }]}>
            <LinearGradient
              colors={['#001f3d', '#004a8f']}
              style={styles.configModalHeader}
            >
              <MaterialIcons name="settings" size={48} color="#ffffff" />
            </LinearGradient>
            
            <View style={styles.configModalBody}>
              <Text style={[styles.configModalTitle, { color: Colors.textPrimary }]}>
                Temporada en Configuración
              </Text>
              <Text style={[styles.configModalText, { color: Colors.textSecondary }]}>
                Esta temporada se está configurando actualmente por la federación.
              </Text>
              <Text style={[styles.configModalSubtext, { color: Colors.textMuted }]}>
                Vuelve a intentarlo en unos días para ver los calendarios y clasificaciones actualizados.
              </Text>
              
              <TouchableOpacity 
                style={[styles.configModalBtn, { backgroundColor: Colors.primary }]}
                onPress={() => navigation.goBack()}
              >
                <Text style={styles.configModalBtnText}>ENTENDIDO</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Header with back + title */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => { if (navigation.canGoBack()) navigation.goBack(); }} activeOpacity={0.7}>
          <MaterialIcons name="arrow-back" size={24} color={isDark ? Colors.textPrimary : Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title || 'Liga'}
        </Text>
        <TouchableOpacity 
          style={styles.backBtn} 
          onPress={activeTab === 'calendar' ? () => setIsSearchModalVisible(true) : handleOpenInfo} 
          activeOpacity={0.7}
        >
          <Animated.View style={{
            opacity: headerIconAnim.interpolate({
              inputRange: [0, 0.4, 0.6, 1],
              outputRange: [1, 0, 0, 1]
            }),
            transform: [{
              rotate: headerIconAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0deg', '90deg']
              })
            }, {
              scale: headerIconAnim.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [1, 0.7, 1]
              })
            }]
          }}>
            <MaterialIcons 
              name={activeTab === 'calendar' ? 'search' : 'info-outline'} 
              size={24} 
              color={isDark ? Colors.textPrimary : Colors.primary} 
            />
          </Animated.View>
        </TouchableOpacity>
      </View>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        {TABS.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tabItem, activeTab === tab.key && styles.tabItemActive]}
              onPress={() => switchTab(tab.key)}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

      {/* Premium Search Modal */}
      <Modal visible={isSearchModalVisible} transparent animationType="fade">
        <BlurView intensity={20} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setIsSearchModalVisible(false)} activeOpacity={1} />
        </BlurView>
        <View style={styles.centeredModalWrapper} pointerEvents="box-none">
          <View style={[styles.premiumSearchCard, { backgroundColor: Colors.surface }]}>
            <View style={styles.searchModalHeader}>
              <Text style={[styles.searchModalTitle, { color: Colors.textPrimary }]}>Buscar Partidos</Text>
              <TouchableOpacity onPress={() => setIsSearchModalVisible(false)}>
                <MaterialIcons name="close" size={24} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.searchModalBody} showsVerticalScrollIndicator={false}>
              {/* Equipo Select */}
              <Text style={[styles.searchLabel, { color: Colors.textSecondary }]}>Equipos ({searchTeams.length})</Text>
              <TouchableOpacity 
                onPress={() => setIsTeamPickerVisible(true)}
                style={[styles.searchFilterPill, { backgroundColor: Colors.surfaceAlt, marginBottom: Spacing.md }]}
              >
                <MaterialIcons name="sports-volleyball" size={20} color={searchTeams.length > 0 ? Colors.primary : Colors.textMuted} />
                <Text style={{ flex: 1, fontSize: 14, color: searchTeams.length > 0 ? Colors.textPrimary : Colors.textMuted, marginLeft: 10 }} numberOfLines={1}>
                  {searchTeams.length === 0 ? 'Todos los equipos' 
                   : searchTeams.length === 1 ? searchTeams[0]
                   : `${searchTeams.length} seleccionados`}
                </Text>
                {searchTeams.length > 0 && (
                  <TouchableOpacity onPress={(e) => { e.stopPropagation(); setSearchTeams([]); }} style={{ padding: 4 }}>
                    <MaterialIcons name="close" size={16} color={Colors.textMuted} />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>

              {/* Fecha Select */}
              <Text style={[styles.searchLabel, { color: Colors.textSecondary }]}>Fecha</Text>
              <TouchableOpacity 
                onPress={() => setIsDatePickerVisible(true)}
                style={[styles.searchFilterPill, { backgroundColor: Colors.surfaceAlt, marginBottom: Spacing.md }]}
              >
                <MaterialIcons name="event" size={20} color={searchDate ? Colors.primary : Colors.textMuted} />
                <Text style={{ flex: 1, fontSize: 14, color: searchDate ? Colors.textPrimary : Colors.textMuted, marginLeft: 10 }}>
                  {searchDate || 'Cualquier fecha'}
                </Text>
                {searchDate && (
                  <TouchableOpacity onPress={(e) => { e.stopPropagation(); setSearchDate(null); }} style={{ padding: 4 }}>
                    <MaterialIcons name="close" size={16} color={Colors.textMuted} />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>

              {/* Ubicación Select */}
              <Text style={[styles.searchLabel, { color: Colors.textSecondary }]}>Sedes ({searchLocations.length})</Text>
              <TouchableOpacity 
                onPress={() => setIsLocationPickerVisible(true)}
                style={[styles.searchFilterPill, { backgroundColor: Colors.surfaceAlt, marginBottom: Spacing.xl }]}
              >
                <MaterialIcons name="location-on" size={20} color={searchLocations.length > 0 ? Colors.primary : Colors.textMuted} />
                <Text style={{ flex: 1, fontSize: 14, color: searchLocations.length > 0 ? Colors.textPrimary : Colors.textMuted, marginLeft: 10 }} numberOfLines={1}>
                  {searchLocations.length === 0 ? 'Todas las sedes' 
                   : searchLocations.length === 1 ? searchLocations[0]
                   : `${searchLocations.length} seleccionadas`}
                </Text>
                {searchLocations.length > 0 && (
                  <TouchableOpacity onPress={(e) => { e.stopPropagation(); setSearchLocations([]); }} style={{ padding: 4 }}>
                    <MaterialIcons name="close" size={16} color={Colors.textMuted} />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.searchModalBtn, { backgroundColor: Colors.primary }]}
                onPress={() => setIsSearchModalVisible(false)}
              >
                <Text style={styles.searchModalBtnText}>VER RESULTADOS</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Team Picker Modal */}
      <Modal visible={isTeamPickerVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.selectionModal, { backgroundColor: Colors.surface }]}>
            <Text style={[styles.selectionModalTitle, { color: Colors.textPrimary }]}>Seleccionar Equipos</Text>
            <ScrollView style={{ maxHeight: screenHeight * 0.6 }}>
              {allAvailableTeams.map((team) => {
                const isSelected = searchTeams.includes(team);
                return (
                  <TouchableOpacity 
                    key={team} 
                    style={styles.selectionItem} 
                    onPress={() => {
                      if (isSelected) {
                        setSearchTeams(searchTeams.filter(t => t !== team));
                      } else {
                        setSearchTeams([...searchTeams, team]);
                      }
                    }}
                  >
                    <MaterialIcons 
                      name={isSelected ? "check-box" : "check-box-outline-blank"} 
                      size={24} 
                      color={isSelected ? Colors.primary : Colors.textMuted} 
                    />
                    <Text style={[styles.selectionItemText, { color: Colors.textPrimary, marginLeft: 12 }, isSelected && { fontWeight: 'bold' }]}>
                      {team}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity 
              style={[styles.modalFooterBtn, { backgroundColor: Colors.primary, marginTop: Spacing.md }]} 
              onPress={() => setIsTeamPickerVisible(false)}
            >
              <Text style={styles.modalFooterBtnText}>LISTO</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Location Picker Modal (Multi-select) */}
      <Modal visible={isLocationPickerVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.selectionModal, { backgroundColor: Colors.surface }]}>
            <Text style={[styles.selectionModalTitle, { color: Colors.textPrimary }]}>Seleccionar Sedes</Text>
            <ScrollView style={{ maxHeight: screenHeight * 0.5 }}>
              {allAvailableLocations.map((loc) => {
                const isSelected = searchLocations.includes(loc);
                return (
                  <TouchableOpacity 
                    key={loc} 
                    style={styles.selectionItem} 
                    onPress={() => {
                      if (isSelected) {
                        setSearchLocations(searchLocations.filter(l => l !== loc));
                      } else {
                        setSearchLocations([...searchLocations, loc]);
                      }
                    }}
                  >
                    <MaterialIcons 
                      name={isSelected ? "check-box" : "check-box-outline-blank"} 
                      size={24} 
                      color={isSelected ? Colors.primary : Colors.textMuted} 
                    />
                    <Text style={[styles.selectionItemText, { color: Colors.textPrimary, marginLeft: 12 }, isSelected && { fontWeight: 'bold' }]}>
                      {loc}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity 
              style={[styles.modalFooterBtn, { backgroundColor: Colors.primary, marginTop: Spacing.md }]} 
              onPress={() => setIsLocationPickerVisible(false)}
            >
              <Text style={styles.modalFooterBtnText}>LISTO</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Date Picker Modal (7-Column Calendar) */}
      <Modal visible={isDatePickerVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.selectionModal, { backgroundColor: Colors.surface, width: '95%', maxWidth: 450 }]}>
            <View style={styles.calendarHeader}>
              <TouchableOpacity onPress={() => {
                if (calendarMonth === 0) { setCalendarMonth(11); setCalendarYear(calendarYear - 1); }
                else setCalendarMonth(calendarMonth - 1);
              }}>
                <MaterialIcons name="chevron-left" size={28} color={Colors.primary} />
              </TouchableOpacity>
              <Text style={[styles.calendarMonthTitle, { color: Colors.textPrimary }]}>
                {MONTHS[calendarMonth]} {calendarYear}
              </Text>
              <TouchableOpacity onPress={() => {
                if (calendarMonth === 11) { setCalendarMonth(0); setCalendarYear(calendarYear + 1); }
                else setCalendarMonth(calendarMonth + 1);
              }}>
                <MaterialIcons name="chevron-right" size={28} color={Colors.primary} />
              </TouchableOpacity>
            </View>

            <View style={styles.calendarDaysHeader}>
               {DAYS.map(d => <Text key={d} style={[styles.calendarDayLabel, { color: Colors.textMuted }]}>{d}</Text>)}
            </View>

            <View style={styles.calendarGrid}>
              {getMonthDays(calendarYear, calendarMonth).map((day, idx) => {
                 if (!day) return <View key={`empty-${idx}`} style={styles.calendarDayCell} />;
                 
                 // Check if this date has matches
                 const formattedDate = `${day} de ${MONTHS[calendarMonth].toLowerCase()}`;
                 const hasMatch = allAvailableDates.some(d => d.toLowerCase().startsWith(formattedDate));
                 const isSelected = searchDate && searchDate.toLowerCase().startsWith(formattedDate);
                 
                 return (
                   <TouchableOpacity 
                     key={day} 
                     style={[
                       styles.calendarDayCell,
                       hasMatch && { backgroundColor: isDark ? 'rgba(13,143,242,0.1)' : 'rgba(13,143,242,0.05)' },
                       isSelected && { backgroundColor: Colors.primary, borderRadius: 8 }
                     ]}
                     disabled={!hasMatch}
                     onPress={() => {
                        const actualDate = allAvailableDates.find(d => d.toLowerCase().startsWith(formattedDate));
                        setSearchDate(actualDate);
                        setIsDatePickerVisible(false);
                     }}
                   >
                     <Text style={[
                       styles.calendarDayText, 
                       { color: hasMatch ? Colors.textPrimary : Colors.textMuted },
                       isSelected && { color: '#fff', fontWeight: 'bold' }
                     ]}>
                       {day}
                     </Text>
                     {hasMatch && !isSelected && <View style={[styles.matchDot, { backgroundColor: Colors.primary }]} />}
                   </TouchableOpacity>
                 );
              })}
            </View>

            <TouchableOpacity 
              style={[styles.modalFooterBtn, { backgroundColor: Colors.surfaceAlt, marginTop: Spacing.xl }]} 
              onPress={() => { setSearchDate(null); setIsDatePickerVisible(false); }}
            >
              <Text style={[styles.modalFooterBtnText, { color: Colors.textPrimary }]}>TODAS LAS FECHAS</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <PagerView
        ref={pagerRef}
        style={{ flex: 1 }}
        initialPage={defaultTab === 'calendar' ? 1 : 0}
        onPageSelected={(e) => {
          setActiveTab(e.nativeEvent.position === 0 ? 'ranking' : 'calendar');
        }}
      >
        <View key="0" style={styles.mainPage}>
          <ScrollView
            style={styles.scroll}
            refreshControl={
              <RefreshControl
                refreshing={rankingLoading}
                onRefresh={refreshRanking}
                colors={[Colors.primary]}
                tintColor={Colors.primary}
              />
            }
          >
            <View>
              {rankingContent}
            </View>
            <View style={{ height: Spacing.xxxl }} />
          </ScrollView>
        </View>

        <View key="1" style={styles.mainPage}>
          <ScrollView
            style={styles.scroll}
            refreshControl={
              <RefreshControl
                refreshing={calendarLoading}
                onRefresh={refreshCalendar}
                colors={[Colors.primary]}
                tintColor={Colors.primary}
              />
            }
          >
            {calendarLoading ? (
              <View style={styles.emptyWrap}>
                <LoadingView message="Cargando calendario..." />
              </View>
            ) : calendarError ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyText}>{calendarError}</Text>
                <TouchableOpacity style={styles.retryBtn} onPress={refreshCalendar}>
                  <Text style={styles.retryText}>Reintentar</Text>
                </TouchableOpacity>
              </View>
            ) : (activeTab === 'calendar' && hasActiveFilters) ? (
              renderSearchResults()
            ) : (
              calendarContent
            )}
            <View style={{ height: Spacing.xxxl }} />
          </ScrollView>
        </View>
      </PagerView>

      {selectedMatch ? (
        <View style={styles.modalRoot}>
          {/* ── Header ── */}
          <View style={styles.modalHeader}>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={closeMatchModal} activeOpacity={0.7}>
              <MaterialIcons name="close" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.modalTitleText} numberOfLines={1}>Detalles del partido</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* ── Tab bar ── */}
          <View style={styles.modalTabRow}>
            {[{ key: 'details', label: 'Detalles' }, { key: 'map', label: 'Mapa' }].map((t) => (
              <TouchableOpacity key={t.key} style={styles.modalTabItem} onPress={() => {
                const targetX = t.key === 'map' ? -screenWidth : 0;
                Animated.timing(modalSlideX, { toValue: targetX, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
                setModalTab(t.key);
              }} activeOpacity={0.8}>
                <Text style={[styles.modalTabLabel, modalTab === t.key && styles.modalTabLabelActive]}>{t.label}</Text>
                <View style={[styles.modalTabUnderline, modalTab === t.key && styles.modalTabUnderlineActive]} />
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.modalPagerClip} {...modalPanResponder.panHandlers}>
            <Animated.View
              style={[
                styles.modalPagerTrack,
                {
                  width: screenWidth * 2,
                  transform: [{ translateX: modalSlideX }],
                },
              ]}
            >
              <View style={[styles.modalPage, { width: screenWidth }]}>
                <ScrollView style={styles.modalScroll} contentContainerStyle={{ paddingBottom: Spacing.xl }}>
                  <View style={styles.scoreSection}>
                    <View style={styles.scoreTeamsRow}>
                      <TouchableOpacity style={styles.scoreTeamCol} activeOpacity={0.78} onPress={() => openTeamFromMatch('home')}>
                        <View style={[styles.scoreLogoWrap, { backgroundColor: homeLogoCenterColor || '#ffffff' }]}>
                          {modalHomeLogoUri
                            ? <Image source={{ uri: modalHomeLogoUri }} style={styles.scoreLogoImg} resizeMode="contain" onError={() => setModalHomeLogoIndex((current) => (current + 1 < modalHomeLogoCandidates.length ? current + 1 : modalHomeLogoCandidates.length))} />
                            : <Text style={styles.scoreLogoFallback}>{(selectedMatch.homeTeam || 'LO').slice(0, 2).toUpperCase()}</Text>
                          }
                        </View>
                        <Text style={styles.scoreTeamRoleLabel}>Local</Text>
                        <Text style={{ color: Colors.textSecondary, fontSize: Typography.size.xs, fontWeight: Typography.weight.semiBold, textAlign: 'center', maxWidth: 90 }} numberOfLines={2}>{selectedMatch.homeTeam || ''}</Text>
                      </TouchableOpacity>

                      <View style={styles.scoreMid}>
                        <View style={styles.scoreRow}>
                          <Text style={styles.scoreNum}>{selectedMatch?.homeScore ?? selectedMatch?.matchScore?.home ?? '—'}</Text>
                          <Text style={styles.scoreSep}> - </Text>
                          <Text style={styles.scoreNum}>{selectedMatch?.awayScore ?? selectedMatch?.matchScore?.away ?? '—'}</Text>
                        </View>
                        {selectedMatch?.status ? (
                          <View style={[styles.statusPill, {
                            backgroundColor: selectedMatch.status === 'FINALIZADO' ? Colors.primaryAlpha10
                              : selectedMatch.status === 'EN CURSO' ? 'rgba(239,68,68,0.12)' : Colors.surfaceAlt,
                            borderColor: selectedMatch.status === 'FINALIZADO' ? Colors.primaryAlpha20
                              : selectedMatch.status === 'EN CURSO' ? 'rgba(239,68,68,0.3)' : Colors.border,
                          }]}>
                            <Text style={[styles.statusPillText, {
                              color: selectedMatch.status === 'FINALIZADO' ? Colors.primary
                                : selectedMatch.status === 'EN CURSO' ? '#ef4444' : Colors.textMuted,
                            }]}>{selectedMatch.status}</Text>
                          </View>
                        ) : null}
                      </View>

                      <TouchableOpacity style={styles.scoreTeamCol} activeOpacity={0.78} onPress={() => openTeamFromMatch('away')}>
                        <View style={[styles.scoreLogoWrap, { backgroundColor: awayLogoCenterColor || '#ffffff' }]}>
                          {modalAwayLogoUri
                            ? <Image source={{ uri: modalAwayLogoUri }} style={styles.scoreLogoImg} resizeMode="contain" onError={() => setModalAwayLogoIndex((current) => (current + 1 < modalAwayLogoCandidates.length ? current + 1 : modalAwayLogoCandidates.length))} />
                            : <Text style={styles.scoreLogoFallback}>{(selectedMatch.awayTeam || 'VI').slice(0, 2).toUpperCase()}</Text>
                          }
                        </View>
                        <Text style={styles.scoreTeamRoleLabel}>Visitante</Text>
                        <Text style={{ color: Colors.textSecondary, fontSize: Typography.size.xs, fontWeight: Typography.weight.semiBold, textAlign: 'center', maxWidth: 90 }} numberOfLines={2}>{selectedMatch.awayTeam || ''}</Text>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.metaChipsRow}>
                      <View style={styles.metaChip}>
                        <MaterialIcons name="calendar-today" size={18} color={Colors.primary} />
                        <Text style={styles.metaChipText}>{selectedMatch.dateLabel}</Text>
                      </View>
                      
                      {selectedMatch?.time ? (
                        <View style={styles.metaChip}>
                          <MaterialIcons name="schedule" size={18} color={Colors.primary} />
                          <Text style={styles.metaChipText}>{selectedMatch.time}</Text>
                        </View>
                      ) : null}
                      {selectedMatch?.venue && selectedMatch.venue !== 'Sede por confirmar' ? (
                        <View style={styles.metaChip}>
                          <MaterialIcons name="location-on" size={18} color={Colors.primary} />
                          <Text style={styles.metaChipText}>{selectedMatch.venue}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>

                  <View style={styles.setsSection}>
                    {selectedSets.length > 0 ? (
                      <View style={styles.setsCard}>
                        <View style={styles.setsHeaderRow}>
                          <Text style={[styles.setsHeaderCell, { textAlign: 'left', maxWidth: 56 }]}>Set</Text>
                          <Text style={styles.setsHeaderCell}>Local</Text>
                          <Text style={styles.setsHeaderCell}>Visitante</Text>
                        </View>
                        {selectedSets.map((set) => {
                          const hw = typeof set.home === 'number' && typeof set.away === 'number' && set.home > set.away;
                          const aw = typeof set.home === 'number' && typeof set.away === 'number' && set.away > set.home;
                          return (
                            <View key={`set-${set.number}`} style={[styles.setsDataRow, hw && styles.setsDataRowHighlight]}>
                              <Text style={[styles.setsCell, { textAlign: 'left', maxWidth: 56, color: hw ? Colors.primary : Colors.textMuted, fontWeight: hw ? Typography.weight.bold : Typography.weight.regular }]}>#{set.number}</Text>
                              <Text style={[styles.setsCell, hw && styles.setsCellWin]}>{set.home}</Text>
                              <Text style={[styles.setsCell, aw && styles.setsCellWin]}>{set.away}</Text>
                            </View>
                          );
                        })}
                      </View>
                    ) : (
                      <View style={styles.noSetsBox}>
                        <Text style={styles.noSetsText}>No hay desglose de sets disponible.</Text>
                      </View>
                    )}
                  </View>
                </ScrollView>

                <View style={styles.modalFooter}>
                  <TouchableOpacity style={styles.modalFooterBtn} onPress={closeMatchModal} activeOpacity={0.84}>
                    <Text style={styles.modalFooterBtnText}>Cerrar</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={[styles.modalPage, { width: screenWidth }]}>
                <ScrollView style={styles.modalScroll} contentContainerStyle={{ paddingBottom: Spacing.xxxl }}>
                  <View style={styles.mapPlaceholder}>
                    <View style={styles.mapPinCircle}>
                      <MaterialIcons name="location-on" size={36} color={Colors.textOnPrimary} />
                    </View>
                  </View>

                  <View style={styles.mapInfoSection}>
                    <View style={styles.mapTitleRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.mapVenueTitle} numberOfLines={2}>
                          {selectedMatch?.venue && selectedMatch.venue !== 'Sede por confirmar'
                            ? selectedMatch.venue : 'Sede por confirmar'}
                        </Text>
                      </View>
                      <View style={styles.mapSportsBadge}>
                        <MaterialIcons name="sports-volleyball" size={24} color={Colors.primary} />
                      </View>
                    </View>

                    <View style={styles.mapBtns}>
                      {selectedMatch?.venue && selectedMatch.venue !== 'Sede por confirmar' ? (
                        <TouchableOpacity style={styles.mapPrimaryBtn} onPress={() => openMaps(selectedMatch.venue)} activeOpacity={0.84}>
                          <MaterialIcons name="map" size={20} color={Colors.textOnPrimary} />
                          <Text style={styles.mapPrimaryBtnText}>Abrir en Mapas</Text>
                        </TouchableOpacity>
                      ) : null}

                      <TouchableOpacity
                        style={[styles.mapSecondaryBtn, reminderSaved && { backgroundColor: Colors.successSoft }]}
                        onPress={reminderSaved ? undefined : addReminder}
                        activeOpacity={reminderSaved ? 1 : 0.84}
                        disabled={reminderLoading || reminderSaved}
                      >
                        <MaterialIcons name={reminderSaved ? 'check' : 'notifications'} size={20} color={reminderSaved ? Colors.success : Colors.textPrimary} />
                        <Text style={[styles.mapSecondaryBtnText, reminderSaved && { color: Colors.success }]}>
                          {reminderLoading ? 'Guardando…' : reminderSaved ? 'Recordatorio guardado' : 'Añadir recordatorio'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </ScrollView>

                <View style={styles.mapFooter}>
                  <TouchableOpacity style={styles.mapFooterTextBtn} onPress={closeMatchModal} activeOpacity={0.7}>
                    <Text style={styles.mapFooterTextBtnText}>CERRAR</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Animated.View>
          </View>
        </View>
      ) : null}
      <StatusModal
        visible={statusModal.visible}
        title={statusModal.title}
        message={statusModal.message}
        type={statusModal.type}
        onClose={() => setStatusModal({ ...statusModal, visible: false })}
      />
    </SafeAreaView>
  );
}
