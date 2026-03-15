import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, RefreshControl, StyleSheet, StatusBar, Image,
  Linking, Alert, Platform, PanResponder, Animated, Easing, useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Calendar from 'expo-calendar';
import { MaterialIcons } from '@expo/vector-icons';
import CompetitionTable from '../components/CompetitionTable';
import MatchList from '../components/MatchList';
import LoadingView from '../components/LoadingView';
import ErrorView from '../components/ErrorView';
import { useFetch } from '../hooks/useFetch';
import {
  discoverCalendarUrlFromRanking,
  discoverTournamentSeasonLabel,
  toTournamentRankingUrl,
} from '../utils/htmlParser';
import { getDominantBorderColor } from '../utils/imageColor';
import { Radius, Spacing, Typography } from '../styles/theme';
import { useTheme } from '../contexts/ThemeContext';

function ensureCalendarAllUrl(value = '') {
  if (!value) return value;
  const clean = value.replace(/\/+$/, '');
  if (/\/calendar\/\d+\/all$/i.test(clean)) return clean;
  if (/\/calendar\/\d+$/i.test(clean)) return `${clean}/all`;
  return clean;
}

function getPreferredCalendarUrl(rankingUrl = '', fallback = '') {
  const tournament = rankingUrl.match(/^(https?:\/\/[^/]+\/[a-z]{2}\/tournament\/\d+)/i)?.[1] || '';
  if (/\/tournament\/1315743$/i.test(tournament)) {
    return 'https://fedvasvol.com/en/tournament/1315743/calendar/3637244/all';
  }
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

export default function TournamentDetailScreen({ route, navigation }) {
  const { colors: Colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const { url, title, defaultTab } = route.params || {};
  const [activeTab, setActiveTab] = useState(defaultTab || 'ranking');
  const [resolvedCalendarUrl, setResolvedCalendarUrl] = useState(null);
  const [expandedCalendar, setExpandedCalendar] = useState({});
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [modalHomeLogoIndex, setModalHomeLogoIndex] = useState(0);
  const [modalAwayLogoIndex, setModalAwayLogoIndex] = useState(0);
  const [homeLogoCenterColor, setHomeLogoCenterColor] = useState('#ffffff');
  const [awayLogoCenterColor, setAwayLogoCenterColor] = useState('#ffffff');
  const [modalTab, setModalTab] = useState('details');
  const [reminderSaved, setReminderSaved] = useState(false);
  const [reminderLoading, setReminderLoading] = useState(false);
  const [seasonLabel, setSeasonLabel] = useState(null);
  const initialMainX = (defaultTab || 'ranking') === 'calendar' ? -screenWidth : 0;
  const mainSlideX = useRef(new Animated.Value(initialMainX)).current;
  const modalSlideX = useRef(new Animated.Value(0)).current;
  const mainGestureStartX = useRef(0);
  const modalGestureStartX = useRef(0);

  const switchTab = useCallback((nextTab) => {
    if (!nextTab || nextTab === activeTab) return;
    setActiveTab(nextTab);
    Animated.timing(mainSlideX, {
      toValue: nextTab === 'calendar' ? -screenWidth : 0,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [activeTab, mainSlideX, screenWidth]);

  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) =>
      Math.abs(gesture.dx) > 18 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.35,
    onPanResponderGrant: () => {
      mainSlideX.stopAnimation((value) => {
        mainGestureStartX.current = value;
      });
    },
    onPanResponderMove: (_, gesture) => {
      const minX = -screenWidth;
      const maxX = 0;
      const next = Math.max(minX, Math.min(maxX, mainGestureStartX.current + gesture.dx));
      mainSlideX.setValue(next);
    },
    onPanResponderRelease: (_, gesture) => {
      const shouldGoCalendar = (gesture.dx < -50 || (gesture.dx < -24 && gesture.vx < -0.45)) && activeTab === 'ranking';
      const shouldGoRanking = (gesture.dx > 50 || (gesture.dx > 24 && gesture.vx > 0.45)) && activeTab === 'calendar';
      const nextTab = shouldGoCalendar ? 'calendar' : shouldGoRanking ? 'ranking' : activeTab;
      const targetX = nextTab === 'calendar' ? -screenWidth : 0;
      Animated.timing(mainSlideX, {
        toValue: targetX,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      if (nextTab !== activeTab) setActiveTab(nextTab);
    },
    onPanResponderTerminate: () => {
      const targetX = activeTab === 'calendar' ? -screenWidth : 0;
      Animated.timing(mainSlideX, {
        toValue: targetX,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    },
  }), [activeTab, mainSlideX, screenWidth]);

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

  const rankingUrl = useMemo(() => toTournamentRankingUrl(url), [url]);
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

    const match = rankingUrl.match(/^(https?:\/\/[^/]+\/[a-z]{2}\/tournament\/\d+)/i);
    return match ? `${match[1]}/calendar` : null;
  }, [rankingBlocks]);

  useEffect(() => {
    let mounted = true;

    async function resolveCalendar() {
      if (calendarUrlFromBlocks && /\/calendar\/\d+/i.test(calendarUrlFromBlocks)) {
        if (mounted) setResolvedCalendarUrl(getPreferredCalendarUrl(rankingUrl, calendarUrlFromBlocks));
        return;
      }

      try {
        const discovered = await discoverCalendarUrlFromRanking(rankingUrl);
        if (mounted) {
          const preferred = getPreferredCalendarUrl(rankingUrl, discovered || calendarUrlFromBlocks || null);
          setResolvedCalendarUrl(preferred || null);
        }
      } catch (_) {
        if (mounted) {
          const preferred = getPreferredCalendarUrl(rankingUrl, calendarUrlFromBlocks || null);
          setResolvedCalendarUrl(preferred || null);
        }
      }
    }

    resolveCalendar();

    return () => {
      mounted = false;
    };
  }, [calendarUrlFromBlocks, rankingUrl]);

  useEffect(() => {
    let mounted = true;

    async function resolveSeason() {
      try {
        const discoveredSeason = await discoverTournamentSeasonLabel(rankingUrl);
        if (mounted) setSeasonLabel(discoveredSeason || null);
      } catch (_) {
        if (mounted) setSeasonLabel(null);
      }
    }

    resolveSeason();

    return () => {
      mounted = false;
    };
  }, [rankingUrl]);

  const {
    blocks: calendarBlocks,
    loading: calendarLoading,
    error: calendarError,
    refresh: refreshCalendar,
  } = useFetch(resolvedCalendarUrl);

  const rankingTables = useMemo(
    () => (rankingBlocks || []).filter((b) => b.type === 'table'),
    [rankingBlocks]
  );

  const calendarTables = useMemo(
    () => (calendarBlocks || []).filter((b) => b.type === 'table').slice().reverse(),
    [calendarBlocks]
  );

  useEffect(() => {
    if (!calendarTables.length) return;

    setExpandedCalendar((prev) => {
      const next = {};
      calendarTables.forEach((_, i) => {
        const key = `jornada-${i}`;
        next[key] = prev[key] ?? i === 0;
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

  const toggleCalendarSection = (index) => {
    const key = `jornada-${index}`;
    setExpandedCalendar((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const openMatchModal = (match) => {
    if (!match) return;
    setSelectedMatch(match);
    setModalTab('details');
    setReminderSaved(false);
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

  useEffect(() => {
    let mounted = true;
    async function resolveColor() {
      if (!modalHomeLogoUri) {
        if (mounted) setHomeLogoCenterColor('#ffffff');
        return;
      }
      const color = await getDominantBorderColor(modalHomeLogoUri);
      if (mounted) setHomeLogoCenterColor(color || '#ffffff');
    }
    resolveColor();
    return () => { mounted = false; };
  }, [modalHomeLogoUri]);

  useEffect(() => {
    let mounted = true;
    async function resolveColor() {
      if (!modalAwayLogoUri) {
        if (mounted) setAwayLogoCenterColor('#ffffff');
        return;
      }
      const color = await getDominantBorderColor(modalAwayLogoUri);
      if (mounted) setAwayLogoCenterColor(color || '#ffffff');
    }
    resolveColor();
    return () => { mounted = false; };
  }, [modalAwayLogoUri]);

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
        Alert.alert('Permiso denegado', 'Necesitamos acceso al calendario para crear el recordatorio.');
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
      const endDate = new Date(startDate.getTime() + (2 * 60 + 30) * 60 * 1000); // +2 h 30 min

      const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      const writable  = calendars.find((c) => c.allowsModifications && c.type !== 'birthday');
      if (!writable) {
        Alert.alert('Sin calendario', 'No se encontró un calendario editable en el dispositivo.');
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
    } catch (e) {
      Alert.alert('Error', 'No se pudo guardar el recordatorio.');
    } finally {
      setReminderLoading(false);
    }
  };

  if (rankingLoading) return <LoadingView message="Cargando clasificación..." />;
  if (rankingError) return <ErrorView message={rankingError} onRetry={refreshRanking} />;

  const renderRankingContent = () => {
    if (rankingTables.length > 0) {
      return rankingTables.map((table, i) => (
        <CompetitionTable
          key={`ranking-${i}`}
          tableBlock={table}
          title={seasonLabel
            ? (i > 0 ? `${seasonLabel} · Grupo ${i}` : seasonLabel)
            : (i > 0 ? `Grupo ${i}` : undefined)}
          onPressTeam={(teamName, teamUrl, teamLogo, leagueStats) =>
            navigation.navigate('TeamDetail', {
              teamName,
              teamUrl,
              teamLogo,
              tournamentTitle: title,
              leagueStats,
              pointsScoredTotal: sumTeamPointsScored(calendarTables, teamName),
              calendarUrl: resolvedCalendarUrl,
            })
          }
          onPressExpand={(tableBlock, tableTitle) =>
            navigation.navigate('RankingTable', {
              tableBlock,
              title: tableTitle || title || 'Clasificación',
              subtitle: seasonLabel || 'Datos oficiales de la federación',
            })
          }
        />
      ));
    }

    return (
      <View style={styles.emptyWrap}>
        <MaterialIcons name="emoji-events" size={44} color={Colors.textMuted} />
        <Text style={styles.emptyText}>No se encontró clasificación para este torneo.</Text>
      </View>
    );
  };

  const renderCalendarContent = () => {
    if (calendarTables.length > 0) {
      return calendarTables.map((table, i) => {
        const jornada = calendarTables.length - i;
        const sectionKey = `jornada-${i}`;
        const isOpen = !!expandedCalendar[sectionKey];
        return (
          <View key={`calendar-${i}`} style={styles.calendarBlock}>
            <TouchableOpacity
              style={styles.calendarTitleBtn}
              activeOpacity={0.84}
              onPress={() => toggleCalendarSection(i)}
            >
              <Text style={styles.calendarTitle}>Jornada {jornada}</Text>
              <MaterialIcons name={isOpen ? 'expand-less' : 'expand-more'} size={22} color={Colors.primary} />
            </TouchableOpacity>

            {isOpen ? (
              <MatchList
                tableBlock={table}
                onPressMatch={openMatchModal}
              />
            ) : null}
          </View>
        );
      });
    }

    return (
      <View style={styles.emptyWrap}>
        <MaterialIcons name="calendar-month" size={44} color={Colors.textMuted} />
        <Text style={styles.emptyText}>No se encontró calendario para este torneo.</Text>
      </View>
    );
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
      borderBottomWidth: 1, borderBottomColor: Colors.border,
      backgroundColor: Colors.background,
    },
    backBtn: {
      width: 38, height: 38, borderRadius: Radius.full,
      justifyContent: 'center', alignItems: 'center',
      backgroundColor: Colors.surfaceAlt,
      borderWidth: 1,
      borderColor: Colors.border,
    },
    backIcon: { color: Colors.textPrimary, fontSize: 24, fontWeight: Typography.weight.bold, lineHeight: 28, textAlign: 'center' },
    headerTitle: { flex: 1, color: Colors.textPrimary, fontSize: Typography.size.lg, fontWeight: Typography.weight.bold, textAlign: 'center', paddingHorizontal: Spacing.sm, letterSpacing: -0.2 },
    tabBar: { flexDirection: 'row', paddingHorizontal: Spacing.md, backgroundColor: Colors.background, borderBottomWidth: 1, borderBottomColor: Colors.border },
    tabItem: { flex: 1, paddingTop: Spacing.sm + 4, paddingBottom: 0, alignItems: 'center' },
    tabLabel: { color: Colors.textMuted, fontSize: Typography.size.md, fontWeight: Typography.weight.bold, paddingBottom: Spacing.sm },
    tabLabelActive: { color: Colors.primary, fontWeight: Typography.weight.bold },
    tabUnderline: { height: 3, width: '100%', borderRadius: 2, backgroundColor: 'transparent' },
    tabUnderlineActive: { backgroundColor: Colors.primary },
    mainPagerClip: { flex: 1, overflow: 'hidden' },
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
    scoreLogoWrap: { width: 80, height: 80, borderRadius: Radius.full, backgroundColor: '#ffffff', borderWidth: 2, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
    scoreLogoImg: { width: 64, height: 64, borderRadius: Radius.full, backgroundColor: 'transparent' },
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
    modalFooterBtn: { backgroundColor: Colors.primary, borderRadius: Radius.lg, paddingVertical: Spacing.md + 4, alignItems: 'center', shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
    modalFooterBtnText: { color: Colors.textOnPrimary, fontWeight: Typography.weight.bold, fontSize: Typography.size.md },
    // Map tab
    mapPlaceholder: { height: 220, backgroundColor: isDark ? '#0c1929' : '#b8cfe2', margin: Spacing.md, borderRadius: Radius.xl, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
    mapPinCircle: { width: 64, height: 64, borderRadius: Radius.full, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 6 },
    mapInfoSection: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
    mapTitleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: Spacing.md, marginBottom: Spacing.lg },
    mapVenueTitle: { color: Colors.textPrimary, fontSize: Typography.size.xxl, fontWeight: Typography.weight.bold, letterSpacing: -0.5 },
    mapSportsBadge: { backgroundColor: Colors.primaryAlpha10, borderRadius: Radius.xl, padding: Spacing.md },
    mapBtns: { gap: Spacing.sm },
    mapPrimaryBtn: { backgroundColor: Colors.primary, borderRadius: Radius.xl, paddingVertical: Spacing.md + 4, paddingHorizontal: Spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 3 },
    mapPrimaryBtnText: { color: Colors.textOnPrimary, fontWeight: Typography.weight.bold, fontSize: Typography.size.md },
    mapSecondaryBtn: { backgroundColor: Colors.surfaceAlt, borderRadius: Radius.xl, paddingVertical: Spacing.md + 4, paddingHorizontal: Spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
    mapSecondaryBtnText: { color: Colors.textPrimary, fontWeight: Typography.weight.semiBold, fontSize: Typography.size.md },
    mapFooter: { borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.background, paddingBottom: insets.bottom > 0 ? insets.bottom : Spacing.sm },
    mapFooterTextBtn: { paddingVertical: Spacing.lg, alignItems: 'center' },
    mapFooterTextBtnText: { color: Colors.textMuted, fontWeight: Typography.weight.bold, fontSize: Typography.size.sm, letterSpacing: 2 },
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      {/* Header with back + title */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <MaterialIcons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title || 'Torneo'}
        </Text>
        <TouchableOpacity style={styles.backBtn} activeOpacity={0.7}>
          <MaterialIcons name="search" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={styles.tabItem}
            onPress={() => switchTab(tab.key)}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>
              {tab.label}
            </Text>
            <View style={[styles.tabUnderline, activeTab === tab.key && styles.tabUnderlineActive]} />
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.mainPagerClip} {...panResponder.panHandlers}>
        <Animated.View
          style={[
            styles.mainPagerTrack,
            {
              width: screenWidth * 2,
              transform: [{ translateX: mainSlideX }],
            },
          ]}
        >
          <View style={[styles.mainPage, { width: screenWidth }]}>
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
              {renderRankingContent()}
              <View style={{ height: Spacing.xxxl }} />
            </ScrollView>
          </View>

          <View style={[styles.mainPage, { width: screenWidth }]}>
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
              {calendarError ? (
                <View style={styles.emptyWrap}>
                  <Text style={styles.emptyText}>{calendarError}</Text>
                  <TouchableOpacity style={styles.retryBtn} onPress={refreshCalendar}>
                    <Text style={styles.retryText}>Reintentar</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                renderCalendarContent()
              )}
              <View style={{ height: Spacing.xxxl }} />
            </ScrollView>
          </View>
        </Animated.View>
      </View>

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
                      {(selectedMatch?.weekdayLabel || selectedMatch?.dateLabel || selectedMatch?.rawDate) ? (
                        <View style={styles.metaChip}>
                          <MaterialIcons name="calendar-today" size={18} color={Colors.primary} />
                          <Text style={styles.metaChipText}>
                            {selectedMatch.weekdayLabel
                              ? `${selectedMatch.weekdayLabel} · ${selectedMatch.dateLabel || selectedMatch.rawDate}`
                              : (selectedMatch.dateLabel || selectedMatch.rawDate)}
                          </Text>
                        </View>
                      ) : null}
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
    </SafeAreaView>
  );
}
