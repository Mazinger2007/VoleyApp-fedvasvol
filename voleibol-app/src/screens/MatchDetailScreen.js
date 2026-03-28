import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { XMLParser } from 'fast-xml-parser';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  StyleSheet,
  Linking,
  Platform,
  Dimensions,
  RefreshControl,
  Animated,
  ActivityIndicator,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { MaterialIcons } from '@expo/vector-icons';
import { Radius, Spacing, Typography, Shadow } from '../styles/theme';
import { useTheme } from '../contexts/ThemeContext';
import StatusModal from '../components/StatusModal';
import { getMatchSummary, parseMatchDateTime } from '../components/MatchList';
import { getCachedLogoColorSync } from '../utils/logoColorCache';
import { getTeamManualCoords } from '../constants/teamColors'; 
import { fetchAndParse } from '../utils/htmlParser';
import VenueMap from '../components/VenueMap';
import { getTeamFromCache } from '../utils/teamCache';
import PagerView from '../components/PagerViewWrapper';
import * as Calendar from 'expo-calendar';
import axios from 'axios';

const { width: SCREEN_WIDTH_PROB } = Dimensions.get('window');
const SCREEN_WIDTH = SCREEN_WIDTH_PROB || 375;

function TeamLogo({ uri, name, isDark, size = 64 }) {
  const bgColor = getCachedLogoColorSync(uri) || (isDark ? '#1e293b' : '#f1f5f9');
  const containerSize = size + 12; // Un poco más de espacio para el círculo
  return (
    <View style={[styles.logoWrap, {
      width: containerSize,
      height: containerSize,
      borderRadius: containerSize / 2,
      backgroundColor: bgColor,
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden'
    }]}>
      {uri ? (
        <Image
          source={uri}
          style={{ width: '95%', height: '95%' }}
          contentFit="contain"
          transition={200}
        />
      ) : (
        <View style={[styles.logoPlaceholder, { width: size, height: size, borderRadius: size / 2, backgroundColor: 'rgba(0,0,0,0.1)' }]}>
          <Text style={{ fontSize: size / 3, fontWeight: 'bold', color: '#94a3b8' }}>{name?.[0] || '?'}</Text>
        </View>
      )}
    </View>
  );
}

export default function MatchDetailScreen({ route, navigation }) {
  const { match, calendarUrl } = route?.params || {};
  const { colors: Colors, isDark } = useTheme();

  // 1. Hooks de estado
  const [activeTab, setActiveTab] = useState('detalles');
  const [youtubeVideoId, setYoutubeVideoId] = useState(null);
  const [youtubeLoading, setYoutubeLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [currentMatch, setCurrentMatch] = useState(match);
  const [refreshing, setRefreshing] = useState(false);
  const [isReminderActive, setIsReminderActive] = useState(false);
  const [reminderLoading, setReminderLoading] = useState(false);
  const [statusModal, setStatusModal] = useState({ visible: false, title: '', message: '', type: 'info' });
  const [isPlaying, setIsPlaying] = useState(false);
  const [matchBlocks, setMatchBlocks] = useState([]);
  const [matchBlocksLoading, setMatchBlocksLoading] = useState(false);

  // 2. Refs
  const pagerRef = useRef(null);
  const bellAnim = useRef(new Animated.Value(1)).current;

  // ── Animación de pestañas (Tab Indicator) ──
  const positionAnim = useRef(new Animated.Value(0)).current;
  const offsetAnim = useRef(new Animated.Value(0)).current;
  const pagerScrollNative = useMemo(() => Animated.add(positionAnim, offsetAnim), [positionAnim, offsetAnim]);
  const pagerScrollJS = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const id = pagerScrollNative.addListener(({ value }) => {
      pagerScrollJS.setValue(value);
    });
    return () => pagerScrollNative.removeListener(id);
  }, [pagerScrollNative, pagerScrollJS]);

  const onPageScrollHandler = useCallback((e) => {
    try {
      const { position, offset } = e.nativeEvent;
      if (typeof position === 'number' && typeof offset === 'number') {
        positionAnim.setValue(position);
        offsetAnim.setValue(offset);
      }
    } catch (err) {
      // Ignorar errores en scroll animado
    }
  }, [positionAnim, offsetAnim]);

  const TAB_COUNT = 3;
  const tabWidth = SCREEN_WIDTH / TAB_COUNT;
  const tabIndicatorX = pagerScrollNative.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [0, tabWidth, tabWidth * 2],
  });

  // 3. Valores calculados con protección extra
  const summary = useMemo(() => {
    try {
      return getMatchSummary(currentMatch);
    } catch (e) {
      console.warn('[MatchDetail] Error in getMatchSummary:', e.message);
      return { 
        homeTeam: 'Local', awayTeam: 'Visitante', sets: [], 
        homeScore: null, awayScore: null, venue: 'Sede desconocida', time: '--:--' 
      };
    }
  }, [currentMatch]);

  // Guardar valores estables para los callbacks
  const hTargetRef = useRef(summary.homeTeam);
  const aTargetRef = useRef(summary.awayTeam);
  const hrefRef = useRef(currentMatch?.href || null);
  
  useEffect(() => {
    hTargetRef.current = summary.homeTeam;
    aTargetRef.current = summary.awayTeam;
    hrefRef.current = currentMatch?.href || null;
  }, [summary.homeTeam, summary.awayTeam, currentMatch?.href]);

  const TABS = ['detalles', 'mapa', 'repeticion'];

  // 4. Coordenadas (Prioridad: Acta > Resumen > Manual)
  const matchCoords = useMemo(() => {
    try {
      const fromBlocks = (matchBlocks || []).find(b => b && b.type === 'map_coordinates');
      if (fromBlocks && fromBlocks.latitude && fromBlocks.longitude) {
        return { latitude: Number(fromBlocks.latitude), longitude: Number(fromBlocks.longitude) };
      }
      if (currentMatch?.coordinates?.latitude && currentMatch?.coordinates?.longitude) {
        return currentMatch.coordinates;
      }
      
      const manual = getTeamManualCoords(summary?.homeTeam);
      if (manual && manual.latitude && manual.longitude) {
        return manual;
      }
    } catch (e) {
      console.warn('[MatchDetail] Error calculating coordinates:', e.message);
    }
    return null;
  }, [matchBlocks, currentMatch, summary.homeTeam]);

  // 4. Funciones auxiliares
  const OFFICIAL_CHANNELS = [
    { name: 'Getxo', id: 'UCYHKUaL8kC4QDe5Cx7TgMyg', patterns: [/getxo/i], priority: true },
    { name: 'Jatorkide', id: 'UCDv0NQL_EFWtPC3i5v_Drbw', patterns: [/jatorkide/i], priority: true },
    { name: 'Galdakao', id: 'UCheRHnoAnFsI7Ogd9xSYAFQ', patterns: [/galdakao/i] },
    { name: 'C.V. Sestao', id: 'UC0RH2gitr2hjNYHhCENpzLg', patterns: [/sestao/i] },
    { name: 'Cafés Foronda Ekialde', id: 'UCEeow14MIifOsTXS4uSCB5g', patterns: [/ekialde/i] },
    { name: 'Madre de Dios Deusto', id: 'UCxGbXULdYqJJTn97vBhK8cw', patterns: [/madre de dios/i, /madi/i] },
    { name: 'Ocisa Logroño', id: 'UC9bIaWAOGv4hGkGgN-FDnhQ', patterns: [/logroño/i] },
    { name: 'Gallartaren Ahotsa', id: 'UCi0OUunq4dpoeIDnrRnKaiw', patterns: [/gallarta/i] },
    { name: 'Bera Bera', id: 'UCs8IABn1087s4X_xrHCHbJQ', patterns: [/bera bera/i] },
    { name: 'Tolobolei', id: 'UC0e86MqCMbNFoJBCWbLyPxQ', patterns: [/tolobolei/i] },
    { name: 'Aidean ZKE', id: 'UChXUSuJD-XCLjmFZUYcCtVg', patterns: [/aidean/i] },
    { name: 'Navarvoley', id: 'UC_utcf6nsss9TBzw0IkTs2w', patterns: [/navar/i] }
  ];

  const INVIDIOUS_HOSTS = [
    // Lista actualizada (eliminados fallidos 403/Network)
    'https://invidious.jing.rocks',
    'https://iv.ggtyler.dev',
    'https://inv.bp.projectsegfau.lt',
    'https://invidious.protokolla.fi',
    'https://invidious.private.coffee',
    'https://invidious.perennialte.ch',
    'https://invidious.fdn.fr',
    'https://yewtu.be',
  ];

  const PIPED_HOSTS = [
    'https://pipedapi.kavin.rocks',
    'https://pipedapi.drgns.space',
    'https://api.piped.privacy.com.de',
    'https://pipedapi.smnz.de',
    'https://pipedapi.tokhmi.xyz',
    'https://pipedapi.moomoo.me',
    'https://pipedapi.adminforge.de',
    'https://pipedapi.ngn.tf',
    'https://pipedapi.system41.com',
  ];
  const fetchYouTubeVideo = async () => {
    const apiKey = process.env.EXPO_PUBLIC_YOUTUBE_API_KEY;

    setYoutubeLoading(true);
    try {
      // Usar summary que ya es robusto
      const rawDate = summary?.rawDate;
      const matchDateObj = (typeof rawDate === 'string' || rawDate instanceof Date) ? parseMatchDateTime(rawDate) : null;
      
      if (!matchDateObj) {
        console.log('[YouTube] No hay fecha válida para buscar por fecha');
        setHasSearched(true);
        setYoutubeLoading(false);
        return;
      }

      const matchDay = new Date(matchDateObj.getFullYear(), matchDateObj.getMonth(), matchDateObj.getDate());
      const isLiveMatch = summary.state === 'live';
      const dayStart = new Date(matchDay);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(matchDay);
      dayEnd.setHours(23, 59, 59, 999);

      const isCloseDate = (pubDate, targetDay) => {
        if (!pubDate || isNaN(pubDate.getTime())) return false;
        const d1 = new Date(pubDate.getFullYear(), pubDate.getMonth(), pubDate.getDate());
        const d2 = targetDay;
        const diffDays = Math.abs(d1 - d2) / (1000 * 60 * 60 * 24);
        return diffDays <= 1; // Margen de 1 día (el mismo día o el siguiente)
      };
      const hasLiveWords = (title = '') => /en\s*directo|directo|live|stream/i.test(title);

      const cleanName = (n) => String(n || '').replace(/Club Voleibol|Voleibol|Boleibol|Voley|C\.V\.|C\.D\.|S\.D\.|S\.K\.T\.|S\.K\.T|K\.E\.|Club|Kiroldegia|Polideportivo|BKK|Taldea|Vialki|BKE|B.K.E.|VBC/gi, '').trim();
      const homeClean = cleanName(summary.homeTeam);
      const awayClean = cleanName(summary.awayTeam);
      const searchTerm = `${homeClean} ${awayClean}`.replace(/\s+/g, ' ');
      let foundId = null;

      const normalizar = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, ' ').trim();
      const calcularScore = (titulo, local, visitante) => {
        const t = normalizar(titulo);
        const palabras = (n) => normalizar(n).split(/\s+/).filter(p => p.length >= 2);
        let score = 0;
        const pl = palabras(local);
        const pv = palabras(visitante);

        const matchHome = pl.some(p => t.includes(p));
        const matchAway = pv.some(p => t.includes(p));

        if (!matchHome && !matchAway) return 0;

        if (matchHome) score += 5; 
        if (matchAway) score += 5;
        if (matchHome && matchAway) score += 20; 

        if (t.includes('vs') || t.includes('contra') || t.includes('-')) score += 2;
        if (t.includes('voley') || t.includes('voleibol') || t.includes('boleibola') || t.includes('boleibol') || t.includes('partido')) score += 1;
        if (t.includes('jornada') || t.includes('fecha') || t.includes('liga')) score += 1;

        return score;
      };

      // Helper para peticiones web robustas
      const robustGet = async (url, isJson = true) => {
        const headers = {
          'User-Agent': 'Mozilla/5.0'
        };
        if (Platform.OS !== 'web') {
          const res = await axios.get(url, { headers, timeout: 5000 });
          return res.data;
        }
        try {
          const res = await axios.get(`https://corsproxy.io/?${encodeURIComponent(url)}`, { timeout: 3500 });
          return res.data;
        } catch (e) {
          const res = await axios.get(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`, { timeout: 4500 });
          return isJson ? JSON.parse(res.data.contents) : res.data.contents;
        }
      };

      // ─── PASO 1 y 2: Búsqueda en canales oficiales de los equipos ───────────────
      const matchLabel = matchDay.toLocaleDateString('es-ES');
      const relevantChannels = OFFICIAL_CHANNELS.filter(c =>
        c.patterns.some(p => p.test(summary.homeTeam) || p.test(summary.awayTeam))
      );

      let officialResult = null;
      if (relevantChannels.length > 0) {
        const channelSearches = relevantChannels.map(async (channel) => {
          let channelBest = null;
          try {
            const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
            const rssBaseUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channel.id}`;
            const rssRes = await robustGet(rssBaseUrl, false); 
            const data = parser.parse(rssRes);
            const entries = data?.feed?.entry ? (Array.isArray(data.feed.entry) ? data.feed.entry : [data.feed.entry]) : [];

            for (const entry of entries) {
              const pubDate = new Date(entry.published);
              if (isCloseDate(pubDate, matchDay)) {
                const score = calcularScore(entry.title, summary.homeTeam, summary.awayTeam);
                if (score > (channelBest?.score || 0)) {
                  channelBest = { id: entry['yt:videoId'], score, source: 'RSS', canal: channel.name };
                }
              }
            }
          } catch (e) { /* skip rss */ }
          return channelBest;
        });

        const results = (await Promise.all(channelSearches)).filter(Boolean);
        if (results.length > 0) {
          officialResult = results.sort((a,b) => b.score - a.score)[0];
          if (!isLiveMatch && officialResult.score >= 15) {
            foundId = officialResult.id;
          }
        }
      }

      // ─── PASO 3: Si está en directo, priorizar búsqueda LIVE ─────────────────────
      if (!foundId && apiKey && isLiveMatch) {
        try {
          const liveRes = await axios.get('https://www.googleapis.com/youtube/v3/search', {
            params: { part: 'snippet', q: searchTerm, maxResults: 10, type: 'video', eventType: 'live', key: apiKey }
          });
          if (liveRes.data?.items?.length > 0) {
            let bestLive = null;
            for (const item of liveRes.data.items) {
              const score = calcularScore(item.snippet.title, summary.homeTeam, summary.awayTeam) + (hasLiveWords(item.snippet.title) ? 10 : 0);
              if (score > (bestLive?.score || 0)) bestLive = { id: item.id.videoId, score };
            }
            if (bestLive && bestLive.score >= 10) foundId = bestLive.id;
          }
        } catch (error) { /* skip live */ }
      }

      // ─── PASO 4: Fallback a vídeos cercanos ──────────────────────
      if (!foundId && apiKey) {
        try {
          const res = await axios.get('https://www.googleapis.com/youtube/v3/search', {
            params: {
              part: 'snippet', q: searchTerm, maxResults: 20, type: 'video',
              publishedAfter: dayStart.toISOString(), publishedBefore: dayEnd.toISOString(), key: apiKey
            }
          });
          if (res.data?.items?.length > 0) {
            let bestMatch = null;
            for (const item of res.data.items) {
              const score = calcularScore(item.snippet.title, summary.homeTeam, summary.awayTeam);
              if (score > (bestMatch?.score || 0)) bestMatch = { id: item.id.videoId, score };
            }
            if (bestMatch && bestMatch.score > (officialResult?.score || 0)) foundId = bestMatch.id;
          }
        } catch (error) { /* skip general api */ }
      }

      if (!foundId && officialResult) foundId = officialResult.id;

      if (foundId) setYoutubeVideoId(foundId);
    } catch (error) {
      console.warn('[YouTube] Error Fatal:', error.message);
    } finally {
      setYoutubeLoading(false);
      setHasSearched(true);
    }
  };

  // 5. Effects
  useEffect(() => {
    if (activeTab === 'repeticion' && !youtubeVideoId && !youtubeLoading && !hasSearched) {
      fetchYouTubeVideo();
    }
    // Resetea la reproducción si se cambia de pestaña
    if (activeTab !== 'repeticion') {
      setIsPlaying(false);
    }
  }, [activeTab]);

  useEffect(() => {
    const checkReminder = async () => {
      try {
        const key = `reminder_${summary.homeTeam}_${summary.awayTeam}`;
        const val = await AsyncStorage.getItem(key);
        setIsReminderActive(!!val);
      } catch (e) {
        console.error('Error checking reminder:', e);
      }
    };
    checkReminder();
  }, [summary.homeTeam, summary.awayTeam]);

  const toggleReminder = async () => {
    if (summary.state === 'finished') {
      setStatusModal({
        visible: true,
        title: 'Aviso',
        message: 'Este partido ya ha finalizado, no es posible añadir un recordatorio.',
        type: 'warning'
      });
      return;
    }

    // Animation feedback
    Animated.sequence([
      Animated.spring(bellAnim, { toValue: 1.3, friction: 3, useNativeDriver: true }),
      Animated.spring(bellAnim, { toValue: 1, friction: 3, useNativeDriver: true })
    ]).start();

    try {
      setReminderLoading(true);
      const key = `reminder_${summary.homeTeam}_${summary.awayTeam}`;

      if (isReminderActive) {
        // Remove reminder
        const eventId = await AsyncStorage.getItem(key);
        if (eventId && eventId !== 'active') {
          try {
            await Calendar.deleteEventAsync(eventId);
          } catch (error) {
            console.log('Event already deleted or not found');
          }
        }
        await AsyncStorage.removeItem(key);
        setIsReminderActive(false);
        setStatusModal({
          visible: true,
          title: '¡Todo listo!',
          message: 'El recordatorio ha sido eliminado correctamente de tu calendario.',
          type: 'success'
        });
      } else {
        // Add reminder
        const { status } = await Calendar.requestCalendarPermissionsAsync();
        if (status !== 'granted') {
          setStatusModal({
            visible: true,
            title: '¡Vaya!',
            message: 'Necesitamos tu permiso para acceder al calendario y poder crear el recordatorio del partido.',
            type: 'error'
          });
          setReminderLoading(false);
          return;
        }

        // Parse date for calendar
        let startDate = parseMatchDateTime(summary.rawDate) || new Date();
        if (summary.time && summary.time !== '--:--' && summary.rawDate) {
          // Ensure time is applied to the date object
          const [h, m] = summary.time.split(':').map(Number);
          startDate.setHours(h || 0, m || 0, 0, 0);
        }
        const endDate = new Date(startDate.getTime() + 90 * 60 * 1000); // + 1.5h

        const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
        const writable = calendars.find(c => c.allowsModifications && c.type !== 'birthday') || calendars[0];

        if (!writable) {
          setStatusModal({
            visible: true,
            title: 'Sin calendario',
            message: 'No hemos podido encontrar un calendario editable en tu dispositivo para guardar el evento.',
            type: 'error'
          });
          setReminderLoading(false);
          return;
        }

        const eventId = await Calendar.createEventAsync(writable.id, {
          title: `${summary.homeTeam} vs ${summary.awayTeam}`,
          startDate,
          endDate,
          location: summary.venue || '',
          notes: `Partido de Voleibol\nSede: ${summary.venue || 'Por confirmar'}`,
          alarms: [{ relativeOffset: -60 }], // 1 hour before
        });

        await AsyncStorage.setItem(key, eventId);
        setIsReminderActive(true);
        setStatusModal({
          visible: true,
          title: '¡Excelente!',
          message: 'El partido se ha añadido a tu calendario con un aviso previo.',
          type: 'success'
        });
      }
    } catch (e) {
      console.error('Error toggling reminder:', e);
      setStatusModal({
        visible: true,
        title: 'Error',
        message: 'Hubo un problema al gestionar el recordatorio.',
        type: 'error'
      });
    } finally {
      setReminderLoading(false);
    }
  };

  const updateMatchFromBlocks = useCallback(async (blocks) => {
    if (!blocks || !Array.isArray(blocks)) return;
    
    const hT = (hTargetRef.current || '').trim().toLowerCase();
    const aT = (aTargetRef.current || '').trim().toLowerCase();
    const hRf = hrefRef.current;

    // Si hay href, refresca usando el enlace directo del partido
    if (hRf) {
      try {
        const directBlocks = await fetchAndParse(hRf);
        setMatchBlocks(directBlocks || []);
        
        const bMatches = (directBlocks || [])
          .filter((b) => b.type === 'table')
          .flatMap((b) => b.matches || []);

        const found = bMatches.find((m) => {
          const s = getMatchSummary(m);
          return (s.homeTeam || '').trim().toLowerCase() === hT && (s.awayTeam || '').trim().toLowerCase() === aT;
        }) || bMatches.find(m => (m.sets || []).length > 0) || bMatches[0];

        if (found) {
          setCurrentMatch(prev => {
            if (prev?.scoreText === found.scoreText && (prev?.sets || []).length === (found.sets || []).length) return prev;
            return { ...prev, ...found, href: prev?.href || found?.href || hRf };
          });
          return;
        }
      } catch (error) {
        console.warn('[MatchDetail] Error al refrescar desde href:', error?.message || error);
      }
    }
    // Si no hay href, buscar por nombre en los bloques
    let found = null;
    for (const block of blocks) {
      if (block.type !== 'table') continue;
      const matches = block.matches || [];
      found = matches.find(m => {
        const s = getMatchSummary(m);
        return (s.homeTeam || '').trim().toLowerCase() === hT && (s.awayTeam || '').trim().toLowerCase() === aT;
      });
      if (found) break;
    }
    
    // Si no, buscar el primero con sets válidos
    if (!found) {
      for (const block of blocks) {
        if (block.type !== 'table') continue;
        const matches = block.matches || [];
        found = matches.find(m => (m.sets || []).length > 0);
        if (found) break;
      }
    }
    // Si no, usar el primero
    if (!found) {
      for (const block of blocks) {
        if (block.type !== 'table') continue;
        const matches = block.matches || [];
        if (matches.length > 0) {
          found = matches[0];
          break;
        }
      }
    }
    if (found) {
      setCurrentMatch(prev => {
        if (prev?.scoreText === found.scoreText && (prev?.sets || []).length === (found.sets || []).length) return prev;
        return { ...prev, ...found };
      });
      setMatchBlocks(blocks || []);
    }
  }, []); // ESTABLE

  const updateMatchFromDirectMatchBlocks = useCallback((blocks) => {
    if (!blocks || !Array.isArray(blocks)) return false;
    const blockMatches = blocks
      .filter((b) => b.type === 'table')
      .flatMap((b) => b.matches || []);

    if (!blockMatches.length) return false;

    const hTarget = (homeTargetRef.current || '').trim().toLowerCase();
    const aTarget = (awayTargetRef.current || '').trim().toLowerCase();

    const found = blockMatches.find((m) => {
      const s = getMatchSummary(m);
      const hMatch = (s.homeTeam || '').trim().toLowerCase();
      const aMatch = (s.awayTeam || '').trim().toLowerCase();
      return hMatch === hTarget && aMatch === aTarget;
    }) || blockMatches.find(m => (m.sets || []).length > 0) || blockMatches[0];

    if (found) {
      setCurrentMatch(prev => {
        // Solo actualizar si realmente ha cambiado algo relevante
        if (prev?.scoreText === found.scoreText && (prev?.sets || []).length === (found.sets || []).length) {
          return prev;
        }
        return { ...prev, ...found, href: prev?.href || found?.href || null };
      });
      setMatchBlocks(blocks);
      return true;
    }
    return false;
  }, []); // CERO DEPENDENCIAS: usa Ref para los nombres objetivos

  // Auto-refresh cada 30 segundos, INDEPENDIENTEMENTE del estado (Live/Finished)
  // para corregir posibles errores de estado en la web.
  useEffect(() => {
    const intervalId = setInterval(async () => {
      try {
        if (calendarUrl) {
          const blocks = await fetchAndParse(calendarUrl);
          updateMatchFromBlocks(blocks);
        }
        if (currentMatch?.href) {
          const directBlocks = await fetchAndParse(currentMatch.href);
          updateMatchFromDirectMatchBlocks(directBlocks);
        }
      } catch (e) {
        console.warn('[MatchDetail] Error en auto-refresh:', e.message);
      }
    }, 30000); // 30 segundos
    return () => clearInterval(intervalId);
  }, [calendarUrl, currentMatch?.href, updateMatchFromBlocks, updateMatchFromDirectMatchBlocks]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (calendarUrl) {
        const blocks = await fetchAndParse(calendarUrl);
        updateMatchFromBlocks(blocks);
      }

      if (currentMatch?.href) {
        const directBlocks = await fetchAndParse(currentMatch.href);
        updateMatchFromDirectMatchBlocks(directBlocks);
      }
    } catch (error) {
      console.error('Error refreshing match detail:', error);
    } finally {
      setRefreshing(false);
    }
  }, [calendarUrl, currentMatch?.href, updateMatchFromBlocks, updateMatchFromDirectMatchBlocks]);

  // When opened from TournamentScreen, fetch direct match URL to load sets.
  useEffect(() => {
    let cancelled = false;
    async function loadDirectMatchData() {
      const matchHref = currentMatch?.href;
      if (!matchHref) return;
      
      setMatchBlocksLoading(true);
      try {
        const directBlocks = await fetchAndParse(matchHref);
        if (!cancelled && directBlocks) {
          updateMatchFromDirectMatchBlocks(directBlocks);
        }
      } catch (error) {
        console.warn('[MatchDetail] Error loading direct match data:', error?.message || error);
      } finally {
        if (!cancelled) setMatchBlocksLoading(false);
      }
    }
    loadDirectMatchData();
    return () => { cancelled = true; };
  }, [currentMatch?.href, updateMatchFromDirectMatchBlocks]);

  const openVenueInMaps = () => {
    if (!matchCoords?.latitude || !matchCoords?.longitude) {
      Alert.alert(
        'Ubicación no disponible',
        'La federación no ha publicado las coordenadas exactas para este encuentro.'
      );
      return;
    }
    const url = `https://www.google.com/maps?q=${matchCoords.latitude},${matchCoords.longitude}`;
    Linking.openURL(url);
  };

  const renderTabContent = (tabKey) => {
    try {
      switch (tabKey) {
        case 'detalles':
          const setList = summary.sets || [];
          let totalHomePoints = 0;
          let totalAwayPoints = 0;
          return (
            <View style={styles.card}>
              <View style={[styles.cardHeader, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc' }]}>
                <Text style={[styles.cardHeaderText, { color: Colors.textPrimary }]}>Puntuación por Sets</Text>
              </View>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHead, { flex: 1.5 }]}>SET</Text>
                <Text style={[styles.tableHead, { flex: 1, textAlign: 'center' }]}>LCL</Text>
                <Text style={[styles.tableHead, { flex: 1, textAlign: 'center' }]}>VST</Text>
                <Text style={[styles.tableHead, { flex: 1, textAlign: 'center' }]}>TOT</Text>
                <Text style={[styles.tableHead, { flex: 1.2, textAlign: 'right' }]}>GANADOR</Text>
              </View>
              {setList.map((set, idx) => {
                if (!set) return null;
                const home = parseInt(set.home || set.local || 0) || 0;
                const away = parseInt(set.away || set.visitante || 0) || 0;
                totalHomePoints += home;
                totalAwayPoints += away;
                const setTotal = home + away;
                const winner = home > away ? 'LCL' : (away > home ? 'VST' : '-');
                return (
                  <View key={idx} style={[styles.tableRow, idx < (setList.length - 1) && styles.tableDivider]}>
                    <Text style={[styles.setLabel, { flex: 1.5, color: Colors.textSecondary }]}>Set {idx + 1}</Text>
                    <Text style={[styles.scoreValue, { flex: 1, color: home > away ? Colors.primary : Colors.textPrimary }]}>{home}</Text>
                    <Text style={[styles.scoreValue, { flex: 1, color: away > home ? Colors.primary : Colors.textPrimary }]}>{away}</Text>
                    <Text style={[styles.scoreTotalValue, { flex: 1, color: Colors.textMuted }]}>{setTotal}</Text>
                    <View style={{ flex: 1.2, alignItems: 'flex-end' }}>
                      {winner !== '-' && (
                        <View style={[styles.winnerBadge, { backgroundColor: winner === 'LCL' ? (isDark ? 'rgba(59,130,246,0.1)' : '#eff6ff') : (isDark ? 'rgba(148,163,184,0.1)' : '#f1f5f9') }]}>
                          <Text style={[styles.winnerBadgeText, { color: winner === 'LCL' ? Colors.primary : Colors.textMuted }]}>{winner}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
              <View style={[styles.totalPointsRow, { borderTopColor: Colors.border, backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#f8fafc' }]}>
                <Text style={[styles.totalPointsLabel, { flex: 1.5, color: Colors.textMuted }]}>PUNTOS</Text>
                <Text style={[styles.totalPointsValue, { flex: 1, color: Colors.textPrimary }]}>{totalHomePoints}</Text>
                <Text style={[styles.totalPointsValue, { flex: 1, color: Colors.textPrimary }]}>{totalAwayPoints}</Text>
                <Text style={[styles.totalPointsValueSum, { flex: 1, color: Colors.primary }]}>{totalHomePoints + totalAwayPoints}</Text>
                <View style={{ flex: 1.2 }} />
              </View>
              <View style={[styles.totalRow, { backgroundColor: Colors.primaryAlpha10 }]}>
                <Text style={[styles.totalLabel, { color: Colors.textPrimary }]}>SETS</Text>
                <Text style={[styles.totalValue, { color: Colors.primary }]}>{summary.homeScore}</Text>
                <Text style={[styles.totalValue, { color: Colors.textMuted }]}>{summary.awayScore}</Text>
                <Text style={[styles.finalLabel, { color: Colors.primary }]}>Final</Text>
              </View>
            </View>
          );
        case 'mapa':
          const venue = summary.venue || '';
          const hasCoords = !!(matchCoords?.latitude && matchCoords?.longitude);
  
          return (
            <View style={{ gap: Spacing.lg }}>
              <View style={[styles.mapPlaceholder, { borderColor: Colors.border, backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }]}>
                {matchBlocksLoading ? (
                  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                    <Text style={{ color: Colors.textMuted, marginTop: 12, fontSize: 13, fontWeight: '500' }}>Obteniendo ubicación oficial...</Text>
                  </View>
                ) : hasCoords ? (
                  <VenueMap
                    venue={venue}
                    colors={Colors}
                    isDark={isDark}
                    Spacing={Spacing}
                    latitude={matchCoords.latitude}
                    longitude={matchCoords.longitude}
                  />
                ) : (
                  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                    <MaterialIcons name="map" size={48} color={isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'} />
                    <Text style={{ color: Colors.textMuted, textAlign: 'center', marginTop: 12, fontSize: 13, fontWeight: '500' }}>
                      Ubicación exacta no disponible en el acta oficial para este partido.
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.card}>
                <View style={styles.cardPadding}>
                  <Text style={[styles.venueName, { color: Colors.textPrimary }]}>{venue || 'Pabellón no especificado'}</Text>
                  <View style={styles.addressRow}>
                    <MaterialIcons name="place" size={18} color={Colors.primary} />
                    <Text style={[styles.addressText, { color: Colors.textMuted }]}>
                      {matchCoords
                        ? (matchBlocks.some(b => b.type === 'map_coordinates')
                          ? "✓ Coordenadas obtenidas directamente del acta oficial de la federación."
                          : (currentMatch?.coordinates
                            ? "✓ Ubicación obtenida del resumen del calendario."
                            : `✓ Ubicación habitual de ${summary.homeTeam} (Manual).`))
                        : "La federación no ha publicado el enlace con coordenadas (Google Maps) para este encuentro."}
                    </Text>
                  </View>
                  <View style={{ gap: Spacing.md, marginTop: Spacing.xl }}>
                    {hasCoords && (
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => {
                          const url = `https://www.google.com/maps?q=${matchCoords.latitude},${matchCoords.longitude}`;
                          Linking.openURL(url);
                        }}
                        style={[styles.actionBtn, { backgroundColor: Colors.primary }]}
                      >
                        <MaterialIcons name="map" size={20} color="#fff" />
                        <Text style={styles.actionBtnText}>Cómo llegar (Google Maps)</Text>
                      </TouchableOpacity>
                    )}
  
                    <TouchableOpacity
                      style={[styles.actionBtnOutline, { borderColor: isReminderActive ? Colors.success : Colors.primary, opacity: reminderLoading ? 0.6 : 1 }]}
                      onPress={toggleReminder}
                      disabled={reminderLoading}
                    >
                      <Animated.View style={{ transform: [{ scale: bellAnim }], flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <MaterialIcons
                          name={isReminderActive ? "notifications-active" : "notifications-none"}
                          size={20}
                          color={isReminderActive ? Colors.success : Colors.primary}
                        />
                        <Text style={[styles.actionBtnTextOutline, { color: isReminderActive ? Colors.success : Colors.primary }]}>
                          {reminderLoading ? "Procesando..." : (isReminderActive ? "Recordatorio Activo" : "Añadir recordatorio")}
                        </Text>
                      </Animated.View>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          );
        case 'repeticion':
          return (
            <View style={{ gap: Spacing.xl }}>
              <View style={[styles.videoPlayer, { backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }]}>
                {youtubeLoading || (!hasSearched && !youtubeVideoId) ? (
                  <View style={{ alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                    <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600', letterSpacing: 0.5 }}>BUSCANDO VÍDEO...</Text>
                  </View>
                ) : youtubeVideoId ? (
                  <TouchableOpacity
                    style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}
                    onPress={() => Linking.openURL(`https://www.youtube.com/watch?v=${youtubeVideoId}`)}
                    activeOpacity={0.9}
                  >
                    <Image
                      source={{ uri: `https://img.youtube.com/vi/${youtubeVideoId}/hqdefault.jpg` }}
                      style={{ width: '100%', height: '100%', resizeMode: 'cover' }}
                    />
                    <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' }}>
                      <MaterialIcons name="play-circle" size={72} color="rgba(255,255,255,0.7)" />
                    </View>
                  </TouchableOpacity>
                ) : (
                  <View style={{ alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 }}>
                    <MaterialIcons name="videocam-off" size={48} color="rgba(255,255,255,0.2)" />
                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, textAlign: 'center', lineHeight: 20 }}>
                      No hemos encontrado el partido en los canales oficiales.
                    </Text>
                  </View>
                )}
              </View>
            </View>
          );
        default:
          return null;
      }
    } catch (err) {
      console.warn('[MatchDetail] Error rendering tab content:', err);
      return (
        <View style={{ padding: 40, alignItems: 'center' }}>
          <Text style={{ color: Colors.textMuted }}>Ocurrió un error al mostrar esta sección.</Text>
        </View>
      );
    }
  };

  const getTabColor = (index) => {
    return pagerScrollJS.interpolate({
      inputRange: [index - 1, index, index + 1],
      outputRange: [Colors.textMuted, Colors.primary, Colors.textMuted],
      extrapolate: 'clamp',
    });
  };

  const badgeText = summary.state === 'live' ? 'EN CURSO' : (summary.state === 'finished' ? 'FINALIZADO' : 'PRÓXIMO');

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: Colors.background }]} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={[styles.header, { backgroundColor: Colors.surface, borderBottomColor: Colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: Colors.textPrimary }]}>Detalles del partido</Text>
        <TouchableOpacity style={styles.notifyBtn} onPress={toggleReminder} disabled={reminderLoading}>
          <Animated.View style={{ transform: [{ scale: bellAnim }], opacity: reminderLoading ? 0.5 : 1 }}>
            <MaterialIcons
              name={isReminderActive ? "notifications-active" : "notifications-none"}
              size={24}
              color={isReminderActive ? Colors.success : Colors.textPrimary}
            />
          </Animated.View>
        </TouchableOpacity>
      </View>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        stickyHeaderIndices={[2]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
      >
        <View style={[styles.hero, { backgroundColor: isDark ? Colors.surface : Colors.primary }]}>
          <View style={styles.heroStatus}>
            <View style={[styles.statusBadge, { backgroundColor: isDark ? Colors.primaryAlpha20 : 'rgba(255,255,255,0.2)' }]}>
              <Text style={styles.statusBadgeText}>{badgeText}</Text>
            </View>
            <Text style={styles.matchDate}>{summary.dateLabel || summary.weekdayLabel || 'Fecha pendiente'}</Text>
          </View>
          <View style={styles.scoreboard}>
            <TouchableOpacity
              style={styles.teamSide}
              activeOpacity={0.7}
              onPress={() => {
                const cached = getTeamFromCache(calendarUrl, summary.homeTeam);
                navigation.push('TeamDetail', {
                  teamName: summary.homeTeam,
                  teamUrl: cached?.url || summary.homeUrl,
                  calendarUrl,
                  points: cached?.points,
                  divisionName: cached?.divisionName,
                  position: cached?.position
                });
              }}
            >
              <TeamLogo uri={summary.homeLogo} name={summary.homeTeam} isDark={isDark} size={64} />
              <Text style={styles.teamName} numberOfLines={2}>{summary.homeTeam}</Text>
            </TouchableOpacity>
            <View style={styles.scoreContainer}>
              <Text style={styles.scoreText}>
                <Text style={summary.homeScore >= summary.awayScore ? styles.scoreBold : styles.scoreDim}>{summary.homeScore}</Text>
                <Text style={styles.scoreSep}> - </Text>
                <Text style={summary.awayScore >= summary.homeScore ? styles.scoreBold : styles.scoreDim}>{summary.awayScore}</Text>
              </Text>
            </View>
            <TouchableOpacity
              style={styles.teamSide}
              activeOpacity={0.7}
              onPress={() => {
                const cached = getTeamFromCache(calendarUrl, summary.awayTeam);
                navigation.push('TeamDetail', {
                  teamName: summary.awayTeam,
                  teamUrl: cached?.url || summary.awayUrl,
                  calendarUrl,
                  points: cached?.points,
                  divisionName: cached?.divisionName,
                  position: cached?.position
                });
              }}
            >
              <TeamLogo uri={summary.awayLogo} name={summary.awayTeam} isDark={isDark} size={64} />
              <Text style={styles.teamName} numberOfLines={2}>{summary.awayTeam}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.venueRow}>
            <MaterialIcons name="location-pin" size={14} color="rgba(255,255,255,0.7)" />
            <Text style={styles.venueText} numberOfLines={1}>{summary.venue || 'Sede por definir'}</Text>
          </View>
        </View>
        <View style={{ height: Spacing.lg, backgroundColor: 'transparent' }} />
        <View>
          <View style={{
            flexDirection: 'row',
            width: '100%',
            backgroundColor: Colors.surface,
            borderBottomWidth: 1,
            borderBottomColor: Colors.border,
            zIndex: 10,
            elevation: 4
          }}>
            {TABS.map((tab, index) => {
              const label = tab === 'repeticion' ? 'Repetición' : tab.charAt(0).toUpperCase() + tab.slice(1);
              return (
                <TouchableOpacity
                  key={tab}
                  onPress={() => {
                    pagerRef.current?.setPage(index);
                  }}
                  activeOpacity={0.8}
                  style={{
                    flex: 1,
                    paddingVertical: Spacing.md,
                    alignItems: 'center'
                  }}
                >
                  <Animated.Text style={{
                    fontSize: 14,
                    fontWeight: '800',
                    color: getTabColor(index)
                  }}>
                    {label}
                  </Animated.Text>
                </TouchableOpacity>
              );
            })}
            {/* Indicador animado */}
            <Animated.View style={{
              position: 'absolute', bottom: 0, left: 0,
              width: tabWidth, height: 3,
              backgroundColor: Colors.primary,
              borderTopLeftRadius: 3, borderTopRightRadius: 3,
              transform: [{ translateX: tabIndicatorX }]
            }} />
          </View>
        </View>
        <View style={styles.mainContent}>
          <PagerView
            ref={pagerRef}
            style={{ height: activeTab === 'detalles' ? 600 : (activeTab === 'mapa' ? 500 : 800) }}
            initialPage={0}
            onPageSelected={(e) => {
              const pos = e.nativeEvent.position;
              if (typeof pos === 'number' && pos >= 0 && pos < TABS.length) {
                setActiveTab(TABS[pos]);
                positionAnim.setValue(pos);
                offsetAnim.setValue(0);
              }
            }}
            onPageScroll={onPageScrollHandler}
          >
            <View key="detalles">
              {renderTabContent('detalles')}
            </View>
            <View key="mapa">
              {renderTabContent('mapa')}
            </View>
            <View key="repeticion">
              {renderTabContent('repeticion')}
            </View>
          </PagerView>
        </View>
      </ScrollView>
      {/* Status Modal for Reminders and Errors */}
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

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm,
    borderBottomWidth: 1,
    ...Platform.select({ ios: Shadow.sm, android: { elevation: 3 } }),
  },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: Typography.size.md, fontWeight: '700' },
  notifyBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  hero: {
    padding: Spacing.xl,
    paddingTop: Spacing.lg,
    borderBottomLeftRadius: Radius.xl,
    borderBottomRightRadius: Radius.xl,
    ...Shadow.md,
  },
  heroStatus: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xl },
  statusBadge: { paddingHorizontal: Spacing.md, paddingVertical: 4, borderRadius: Radius.full },
  statusBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  matchDate: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '600' },
  scoreboard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md },
  teamSide: { flex: 1, alignItems: 'center', gap: Spacing.sm },
  logoWrap: { justifyContent: 'center', alignItems: 'center' },
  logoPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  teamName: { color: '#fff', fontSize: 12, fontWeight: '800', textAlign: 'center', textTransform: 'uppercase' },
  scoreContainer: { alignItems: 'center', justifyContent: 'center' },
  scoreText: { fontSize: 48, fontWeight: '900', color: '#fff', letterSpacing: -2 },
  scoreSep: { opacity: 0.4, fontWeight: '300' },
  scoreDim: { opacity: 0.5 },
  scoreBold: { fontWeight: '900' },
  venueRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: Spacing.xl, gap: 4 },
  venueText: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '500' },
  scrollContent: { paddingBottom: 60 },
  mainContent: { padding: Spacing.lg },
  card: { borderRadius: Radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(71,85,105,0.2)' },
  cardHeader: { padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: 'rgba(71,85,105,0.1)' },
  cardHeaderText: { fontSize: 14, fontWeight: '700' },
  cardPadding: { padding: Spacing.lg },
  tableHeader: { flexDirection: 'row', paddingHorizontal: Spacing.md, paddingVertical: 10, backgroundColor: 'rgba(148,163,184,0.05)' },
  tableHead: { fontSize: 10, fontWeight: '700', color: '#94a3b8', letterSpacing: 0.5 },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: 14 },
  tableDivider: { borderBottomWidth: 1, borderBottomColor: 'rgba(71,85,105,0.08)' },
  setLabel: { fontSize: 14, fontWeight: '600' },
  scoreValue: { fontSize: 16, fontWeight: '800', textAlign: 'center' },
  scoreTotalValue: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
  winnerBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.full },
  winnerBadgeText: { fontSize: 11, fontWeight: '700' },
  totalPointsRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: 12, borderTopWidth: 1 },
  totalPointsLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  totalPointsValue: { fontSize: 14, fontWeight: '700', textAlign: 'center' },
  totalPointsValueSum: { fontSize: 15, fontWeight: '900', textAlign: 'center' },
  totalRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: 18 },
  totalLabel: { flex: 1.5, fontSize: 15, fontWeight: '800' },
  totalValue: { flex: 1, fontSize: 24, fontWeight: '900', textAlign: 'center' },
  finalLabel: { flex: 1.2, textAlign: 'right', fontSize: 14, fontWeight: '700' },
  mapPlaceholder: { width: '100%', height: 180, borderRadius: Radius.xl, overflow: 'hidden', borderWidth: 1, position: 'relative' },
  mapImg: { width: '100%', height: '100%' },
  mapOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.1)', justifyContent: 'center', alignItems: 'center' },
  mapPin: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
  mapTooltip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.md, borderWidth: 1, marginTop: 8, ...Shadow.sm },
  mapTooltipText: { fontSize: 11, fontWeight: '700' },
  venueName: { fontSize: Typography.size.lg, fontWeight: '800', marginBottom: 4 },
  addressRow: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
  addressText: { flex: 1, fontSize: 13, lineHeight: 18 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52, borderRadius: Radius.lg, ...Shadow.sm },
  actionBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  actionBtnOutline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52, borderRadius: Radius.lg, borderWidth: 2 },
  actionBtnTextOutline: { fontSize: 15, fontWeight: '700' },
  videoPlayer: { aspectRatio: 16 / 9, borderRadius: Radius.xl, overflow: 'hidden', position: 'relative', ...Shadow.lg },
  videoThumb: { width: '100%', height: '100%', opacity: 0.8 },
  playBtnWrap: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  playBtn: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center' },
  clipListHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.sm },
  sectionTitle: { fontSize: 18, fontWeight: '900' },
  clipCount: { fontSize: 10, fontWeight: '800', paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.sm },
  clipCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: Radius.lg, borderWidth: 1, ...Shadow.sm },
  clipThumbWrap: { width: 100, height: 70, borderRadius: Radius.md, overflow: 'hidden', position: 'relative' },
  clipThumb: { width: '100%', height: '100%' },
  durationBadge: { position: 'absolute', bottom: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 4, paddingVertical: 2, borderRadius: 2 },
  durationText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  clipInfo: { flex: 1 },
  clipTitle: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  clipMeta: { fontSize: 11, fontWeight: '500' },
});
