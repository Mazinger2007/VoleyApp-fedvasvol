import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { XMLParser } from 'fast-xml-parser';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StatusBar,
  StyleSheet,
  Linking,
  Platform,
  Dimensions,
  RefreshControl,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { MaterialIcons } from '@expo/vector-icons';
import { Radius, Spacing, Typography, Shadow } from '../styles/theme';
import { useTheme } from '../contexts/ThemeContext';
import StatusModal from '../components/StatusModal';
import { getMatchSummary, parseMatchDateTime } from '../components/MatchList';
import { getCachedLogoColorSync } from '../utils/logoColorCache';
import { useLivePolling } from '../hooks/useLivePolling';
import { fetchAndParse } from '../utils/htmlParser';
import VenueMap from '../components/VenueMap';
import PagerView from '../components/PagerViewWrapper';
import * as Calendar from 'expo-calendar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
          source={{ uri }} 
          style={{ width: '95%', height: '95%' }} 
          resizeMode="contain" 
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
  const { match, calendarUrl } = route.params;
  const { colors: Colors, isDark } = useTheme();

  // 1. Hooks de estado
  const [activeTab, setActiveTab] = useState('detalles');
  const [youtubeVideoId, setYoutubeVideoId] = useState(null);
  const [youtubeLoading, setYoutubeLoading] = useState(false);
  const [currentMatch, setCurrentMatch] = useState(match);
  const [refreshing, setRefreshing] = useState(false);
  const [isReminderActive, setIsReminderActive] = useState(false);
  const [reminderLoading, setReminderLoading] = useState(false);
  const [statusModal, setStatusModal] = useState({ visible: false, title: '', message: '', type: 'info' });

  // 2. Refs
  const pagerRef = useRef(null);
  const bellAnim = useRef(new Animated.Value(1)).current;

  // 3. Valores calculados
  const summary = useMemo(() => getMatchSummary(currentMatch), [currentMatch]);
  const TABS = ['detalles', 'mapa', 'repeticion'];

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
    'https://inv.nadeko.net',
    'https://invidious.nerdvpn.de',
    'https://invidious.projectsegfau.lt'
  ];


  const fetchYouTubeVideo = async () => {
    const apiKey = process.env.EXPO_PUBLIC_YOUTUBE_API_KEY;

    setYoutubeLoading(true);
    try {
      const matchDateObj = parseMatchDateTime(summary.rawDate) || new Date();
      // Normalizar a medianoche (hora local) para la comparación
      const matchDay = new Date(matchDateObj.getFullYear(), matchDateObj.getMonth(), matchDateObj.getDate());
      
      const isCloseDate = (pubDate, targetDay) => {
        const d1 = new Date(pubDate.getFullYear(), pubDate.getMonth(), pubDate.getDate());
        const d2 = targetDay;
        const diffDays = Math.abs(d1 - d2) / (1000 * 60 * 60 * 24);
        return diffDays <= 1; // Margen de 1 día (el mismo día o el siguiente)
      };

      const cleanName = (n) => n.replace(/Voleibol|Boleibol|Voley|C\.V\.|C\.D\.|S\.D\.|Club|Kiroldegia|Polideportivo|BKK|Taldea|Vialki|BKE|B.K.E.|VBC/gi, '').trim();
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

        if (matchHome) score += 5; // Más peso a los nombres individuales
        if (matchAway) score += 5;
        if (matchHome && matchAway) score += 20; // ¡Super bono por tener ambos!

        if (t.includes('vs') || t.includes('contra') || t.includes('-')) score += 2;
        if (t.includes('voley') || t.includes('voleibol') || t.includes('partido')) score += 1;
        if (t.includes('jornada') || t.includes('fecha') || t.includes('liga')) score += 1;
        
        console.log(`[YouTube] Evaluando: "${titulo}" | Score: ${score} (H:${matchHome}, A:${matchAway})`);
        return score;
      };

      // ─── PASO 1 y 2: Búsqueda en canales oficiales de los equipos (RSS + Invidious) ───────────────
      const matchLabel = matchDay.toLocaleDateString('es-ES');
      
      // Filtrar para buscar SOLO en los canales de los equipos que están jugando
      const relevantChannels = OFFICIAL_CHANNELS.filter(c => 
        c.patterns.some(p => p.test(summary.homeTeam) || p.test(summary.awayTeam))
      );

      let officialResult = null;
      if (relevantChannels.length > 0) {
        console.log(`[YouTube] Escaneando canales de ${relevantChannels.map(c => c.name).join(', ')} para el ${matchLabel}...`);
        
        const channelSearches = relevantChannels.map(async (channel) => {
          const isHome = channel.patterns.some(p => p.test(summary.homeTeam));
          const opponent = isHome ? summary.awayTeam : summary.homeTeam;
          const opponentClean = cleanName(opponent);
          
          try {
            const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
            const rssRes = await axios.get(`https://www.youtube.com/feeds/videos.xml?channel_id=${channel.id}`, { timeout: 6000 });
            const data = parser.parse(rssRes.data);
            const entries = data?.feed?.entry ? (Array.isArray(data.feed.entry) ? data.feed.entry : [data.feed.entry]) : [];

            let channelBest = null;
            for (const entry of entries) {
              const pubDate = new Date(entry.published);
              if (isCloseDate(pubDate, matchDay)) {
                const score = calcularScore(entry.title, summary.homeTeam, summary.awayTeam);
                if (score > (channelBest?.score || 0)) {
                  channelBest = { id: entry['yt:videoId'], score, source: 'RSS', canal: channel.name, priority: channel.priority || false, isHome };
                }
              }
            }
            if (channelBest && channelBest.score >= 20) return channelBest;

            const host = INVIDIOUS_HOSTS[Math.floor(Math.random() * INVIDIOUS_HOSTS.length)];
            
            // Paso 2.1: Búsqueda específica dentro del canal
            try {
              const searchRes = await axios.get(`${host}/api/v1/channels/${channel.id}/search?q=${encodeURIComponent(opponentClean)}`, { timeout: 8000 });
              const searchVideos = searchRes.data || [];
              for (const v of searchVideos) {
                const pubDate = new Date(v.published * 1000);
                if (isCloseDate(pubDate, matchDay)) {
                  const score = calcularScore(v.title, summary.homeTeam, summary.awayTeam);
                  if (score > (channelBest?.score || 0)) {
                    channelBest = { id: v.videoId, score, source: 'InvSearch', canal: channel.name, priority: channel.priority || false, isHome };
                  }
                }
              }
            } catch (searchErr) {
              console.log(`[YouTube] Invidious Search falló para ${channel.name}: ${searchErr.message}`);
            }
            if (channelBest && channelBest.score >= 20) return channelBest;

            // Paso 2.2: Escaneo cronológico (como último recurso en el canal)
            const invRes = await axios.get(`${host}/api/v1/channels/${channel.id}/videos?sort_by=newest`, { timeout: 8000 });
            const videos = invRes.data?.videos || [];
            for (const v of videos) {
              const pubDate = new Date(v.published * 1000);
              if (isCloseDate(pubDate, matchDay)) {
                const score = calcularScore(v.title, summary.homeTeam, summary.awayTeam);
                if (score > (channelBest?.score || 0)) {
                   channelBest = { id: v.videoId, score, source: 'Invidious', canal: channel.name, priority: channel.priority || false, isHome };
                }
              }
            }
            if (channelBest && channelBest.score > 0) return channelBest;
          } catch (e) {
            return null;
          }
          return null;
        });

        const results = (await Promise.all(channelSearches)).filter(Boolean);
        
        if (results.length > 0) {
          officialResult = results.reduce((prev, current) => {
            if (current.score > prev.score) return current;
            if (current.score < prev.score) return prev;
            if (current.priority && !prev.priority) return current;
            if (!current.priority && prev.priority) return prev;
            if (current.isHome && !prev.isHome) return current;
            return prev;
          });
          
          if (officialResult.score >= 15) { // Si ya es una excelente coincidencia, paramos
            foundId = officialResult.id;
            console.log(`[YouTube] ✓ Encontrado en canal oficial (${officialResult.canal}) con alta puntuación: ${officialResult.score}`);
          }
        }
      }

      // ─── PASO 3: Búsqueda General en YouTube (Si no hay nada oficial fuerte) ───────────────
      if (!foundId && apiKey) {
        console.log(`[YouTube] Probando búsqueda general: ${searchTerm} (Puntuación oficial previa: ${officialResult?.score || 0})`);
        try {
          const res = await axios.get('https://www.googleapis.com/youtube/v3/search', {
            params: { 
              part: 'snippet', 
              q: searchTerm, 
              maxResults: 50, 
              type: 'video', 
              relevanceLanguage: 'es',
              regionCode: 'ES',
              key: apiKey 
            }
          });
          
          if (res.data?.items?.length > 0) {
            let bestApiMatch = null;
            for (const item of res.data.items) {
              const score = calcularScore(item.snippet.title, summary.homeTeam, summary.awayTeam);
              console.log(`[YouTube API Check] Evaluando: "${item.snippet.title}" | Score: ${score}`);
              
              if (score > (bestApiMatch?.score || 0)) {
                bestApiMatch = { id: item.id.videoId, score };
              }
            }

            // Decidir si la API general encontró algo mejor que lo oficial débil
            if (bestApiMatch && bestApiMatch.score > (officialResult?.score || 0)) {
               foundId = bestApiMatch.id;
               console.log(`[YouTube] ✓ Encontrado vía API General con mejor puntuación: ${bestApiMatch.score}`);
            } else if (officialResult) {
              foundId = officialResult.id;
              console.log(`[YouTube] ✓ Manteniendo resultado oficial (Score: ${officialResult.score}) por ser mejor que API.`);
            }
          } else if (officialResult) {
            foundId = officialResult.id;
          }
        } catch (err) {
          console.warn('[YouTube] Búsqueda general falló:', err.message, err.response?.data?.error || '');
          if (officialResult) foundId = officialResult.id;
        }
      }



      if (foundId) {
        setYoutubeVideoId(foundId);
      } else {
        console.log('[YouTube] No se encontró ningún vídeo');
      }
    } catch (err) {
      console.error('Error YouTube:', err.message);
    } finally {
      setYoutubeLoading(false);
    }
  };

  // 5. Effects
  useEffect(() => {
    if (activeTab === 'repeticion' && !youtubeVideoId && !youtubeLoading) {
      fetchYouTubeVideo();
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
          } catch (err) {
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

  const updateMatchFromBlocks = useCallback((blocks) => {
    // Find correctly identifying match by team names
    for (const block of blocks) {
      if (block.type !== 'table') continue;
      const matches = block.matches || [];
      const found = matches.find(m => {
        const s = getMatchSummary(m);
        return s.homeTeam === summary.homeTeam && s.awayTeam === summary.awayTeam;
      });
      if (found) {
        setCurrentMatch(found);
        return;
      }
    }
  }, [summary.homeTeam, summary.awayTeam]);

  // Background polling if in progress
  useLivePolling(
    summary.state === 'live' ? calendarUrl : null,
    [currentMatch], // Needs to be an array for hasLiveMatch check
    updateMatchFromBlocks
  );

  const onRefresh = useCallback(async () => {
    if (!calendarUrl) return;
    setRefreshing(true);
    try {
      const blocks = await fetchAndParse(calendarUrl);
      updateMatchFromBlocks(blocks);
    } catch (err) {
      console.error('Error refreshing match detail:', err);
    } finally {
      setRefreshing(false);
    }
  }, [calendarUrl, updateMatchFromBlocks]);

  const openVenueInMaps = () => {
    let venue = summary.venue || '';
    const lowerVenue = venue.toLowerCase();
    
    // Si no contiene palabras clave de polideportivo, las añadimos para mejorar la búsqueda
    const keywords = ['polideportivo', 'kiroldegia', 'pabellón', 'pista', 'frontón', 'campo', 'estadio'];
    const hasKeyword = keywords.some(k => lowerVenue.includes(k));
    
    if (!hasKeyword && venue.length > 3) {
      // Intentamos ser inteligentes: si es una palabra corta podría ser un pueblo, 
      // si es larga ya podría ser el nombre del polideportivo.
      venue = `Polideportivo ${venue}`;
    }

    const query = encodeURIComponent(venue);
    const url = Platform.select({
      ios: `maps:0,0?q=${query}`,
      android: `geo:0,0?q=${query}`,
      default: `https://www.google.com/maps/search/?api=1&query=${query}`
    });
    Linking.openURL(url);
  };

  const renderTabContent = () => {
    switch (activeTab) {
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
              const home = parseInt(set.home || set.local) || 0;
              const away = parseInt(set.away || set.visitante) || 0;
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
        const lowerVenue = venue.toLowerCase();
        // Lógica de búsqueda mejorada
        const keywords = ['polideportivo', 'kiroldegia', 'pabellón', 'pista', 'frontón', 'campo', 'estadio'];
        const hasKeyword = keywords.some(k => lowerVenue.includes(k));
        const searchVenue = (!hasKeyword && venue.length > 3) ? `Polideportivo ${venue}` : venue;
        const query = encodeURIComponent(searchVenue);

        return (
          <View style={{ gap: Spacing.lg }}>
            <View style={[styles.mapPlaceholder, { borderColor: Colors.border, backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }]}>
               <VenueMap 
                venue={venue} 
                searchVenue={searchVenue} 
                query={query} 
                colors={Colors}
                isDark={isDark}
                Spacing={Spacing}
              />
            </View>
            <View style={styles.card}>
              <View style={styles.cardPadding}>
                <Text style={[styles.venueName, { color: Colors.textPrimary }]}>{venue || 'Pabellón no especificado'}</Text>
                <View style={styles.addressRow}>
                  <MaterialIcons name="place" size={18} color={Colors.primary} />
                  <Text style={[styles.addressText, { color: Colors.textMuted }]}>
                    Información de ubicación obtenida del calendario oficial.
                    {!hasKeyword && venue.length > 3 && "\nSe ha añadido 'Polideportivo' para mejorar la búsqueda."}
                  </Text>
                </View>
                <View style={{ gap: Spacing.md, marginTop: Spacing.xl }}>
                  <TouchableOpacity style={[styles.actionBtn, { backgroundColor: Colors.primary }]} onPress={openVenueInMaps}>
                    <MaterialIcons name="map" size={20} color="#fff" />
                    <Text style={styles.actionBtnText}>Abrir en Google Maps</Text>
                  </TouchableOpacity>
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
            <View style={[styles.videoPlayer, { backgroundColor: '#000', overflow: 'hidden' }]}>
              {youtubeVideoId ? (
                <WebView
                  style={{ flex: 1 }}
                  source={{ 
                    uri: `https://www.youtube-nocookie.com/embed/${youtubeVideoId}?rel=0&modestbranding=1&playsinline=1&enablejsapi=1&origin=https://www.youtube.com`,
                    headers: { 'Referer': 'https://www.youtube.com' }
                  }}
                  javaScriptEnabled={true}
                  domStorageEnabled={true}
                  allowsFullscreenVideo={true}
                  allowsInlineMediaPlayback={true}
                  mediaPlaybackRequiresUserAction={true}
                  userAgent="Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1"
                />
              ) : youtubeLoading ? (
                <View style={[styles.videoPlaceholder, { justifyContent: 'center', alignItems: 'center', flex: 1 }]}>
                  <Text style={{ color: '#fff' }}>Buscando repetición...</Text>
                </View>
              ) : (
                <View style={[styles.videoPlaceholder, { justifyContent: 'center', alignItems: 'center', flex: 1 }]}>
                   <MaterialIcons name="video-library" size={48} color="rgba(255,255,255,0.3)" />
                   <Text style={{ color: 'rgba(255,255,255,0.6)', marginTop: 12 }}>No se ha encontrado repetición del partido</Text>
                   <TouchableOpacity style={{ marginTop: 20, padding: 10 }} onPress={fetchYouTubeVideo}>
                     <Text style={{ color: Colors.primary }}>Reintentar búsqueda</Text>
                   </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        );
      default:
        return null;
    }
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
            <View style={styles.teamSide}>
              <TeamLogo uri={summary.homeLogo} name={summary.homeTeam} isDark={isDark} size={64} />
              <Text style={styles.teamName} numberOfLines={2}>{summary.homeTeam}</Text>
            </View>
            <View style={styles.scoreContainer}>
              <Text style={styles.scoreText}>
                <Text style={summary.homeScore >= summary.awayScore ? styles.scoreBold : styles.scoreDim}>{summary.homeScore}</Text>
                <Text style={styles.scoreSep}> - </Text>
                <Text style={summary.awayScore >= summary.homeScore ? styles.scoreBold : styles.scoreDim}>{summary.awayScore}</Text>
              </Text>
            </View>
            <View style={styles.teamSide}>
              <TeamLogo uri={summary.awayLogo} name={summary.awayTeam} isDark={isDark} size={64} />
              <Text style={styles.teamName} numberOfLines={2}>{summary.awayTeam}</Text>
            </View>
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
              const isActive = activeTab === tab;
              const label = tab === 'repeticion' ? 'Repetición' : tab.charAt(0).toUpperCase() + tab.slice(1);
              return (
                <TouchableOpacity
                  key={tab}
                  onPress={() => {
                    setActiveTab(tab);
                    pagerRef.current?.setPage(index);
                  }}
                  activeOpacity={0.8}
                  style={{
                    flex: 1,
                    paddingVertical: Spacing.md,
                    alignItems: 'center',
                    borderBottomWidth: 3,
                    borderBottomColor: isActive ? Colors.primary : 'transparent'
                  }}
                >
                  <Text style={{
                    fontSize: 14,
                    fontWeight: isActive ? '800' : '600',
                    color: isActive ? Colors.primary : Colors.textMuted
                  }}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
        <View style={styles.mainContent}>
          <PagerView
            ref={pagerRef}
            style={{ height: activeTab === 'detalles' ? 600 : (activeTab === 'mapa' ? 500 : 800) }}
            initialPage={0}
            onPageSelected={(e) => setActiveTab(TABS[e.nativeEvent.position])}
          >
            <View key="detalles">
              {activeTab === 'detalles' && renderTabContent()}
            </View>
            <View key="mapa">
              {activeTab === 'mapa' && renderTabContent()}
            </View>
            <View key="repeticion">
              {activeTab === 'repeticion' && renderTabContent()}
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
