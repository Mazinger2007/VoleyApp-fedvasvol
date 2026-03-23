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

  const onPageScrollHandler = useMemo(() => Animated.event(
    [{ nativeEvent: { position: positionAnim, offset: offsetAnim } }],
    { useNativeDriver: false }
  ), [positionAnim, offsetAnim]);

  const TAB_COUNT = 3;
  const tabWidth = SCREEN_WIDTH / TAB_COUNT;
  const tabIndicatorX = pagerScrollNative.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [0, tabWidth, tabWidth * 2],
  });

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
      const matchDateObj = parseMatchDateTime(summary.rawDate) || new Date();
      // Normalizar a medianoche (hora local) para la comparación
      const matchDay = new Date(matchDateObj.getFullYear(), matchDateObj.getMonth(), matchDateObj.getDate());
      const isLiveMatch = summary.state === 'live';
      const dayStart = new Date(matchDay);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(matchDay);
      dayEnd.setHours(23, 59, 59, 999);
      
      const isCloseDate = (pubDate, targetDay) => {
        const d1 = new Date(pubDate.getFullYear(), pubDate.getMonth(), pubDate.getDate());
        const d2 = targetDay;
        const diffDays = Math.abs(d1 - d2) / (1000 * 60 * 60 * 24);
        return diffDays <= 1; // Margen de 1 día (el mismo día o el siguiente)
      };
      const hasLiveWords = (title = '') => /en\s*directo|directo|live|stream/i.test(title);

      const cleanName = (n) => n.replace(/Club Voleibol|Voleibol|Boleibol|Voley|C\.V\.|C\.D\.|S\.D\.|S\.K\.T\.|S\.K\.T|K\.E\.|Club|Kiroldegia|Polideportivo|BKK|Taldea|Vialki|BKE|B.K.E.|VBC/gi, '').trim();
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
        if (t.includes('voley') || t.includes('voleibol') || t.includes('boleibola') || t.includes('boleibol') || t.includes('partido')) score += 1;
        if (t.includes('jornada') || t.includes('fecha') || t.includes('liga')) score += 1;
        
        // console.log(`[YouTube] Evaluando: "${titulo}" | Score: ${score} (H:${matchHome}, A:${matchAway})`);
        return score;
      };

      // Helper para peticiones web robustas (intenta varios proxies si uno falla)
      const robustGet = async (url, isJson = true) => {
        const headers = {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        };
        if (Platform.OS !== 'web') {
          const res = await axios.get(url, { headers, timeout: 5000 });
          return res.data;
        }
        // Proxy 1: CorsProxy.io (Rápido)
        try {
          const res = await axios.get(`https://corsproxy.io/?${encodeURIComponent(url)}`, { timeout: 3500 });
          if (isJson && typeof res.data === 'string' && res.data.trim().startsWith('<')) throw new Error("Proxy devolvió HTML");
          return res.data;
        } catch (e) { /* Falló P1, probar siguiente */ }
        // Proxy 2: AllOrigins (Respaldo fiable)
        try {
          const res = await axios.get(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`, { timeout: 4500 });
          if (res.data?.contents) return isJson ? JSON.parse(res.data.contents) : res.data.contents;
        } catch (e) { /* Falló P2 */ }

        throw new Error("Todos los proxies fallaron");
      };

      // ─── PASO 1 y 2: Búsqueda en canales oficiales de los equipos (RSS + Invidious) ───────────────
      const matchLabel = matchDay.toLocaleDateString('es-ES');
      
      // Filtrar para buscar SOLO en los canales de los equipos que están jugando
      const relevantChannels = OFFICIAL_CHANNELS.filter(c => 
        c.patterns.some(p => p.test(summary.homeTeam) || p.test(summary.awayTeam))
      );

      let officialResult = null;
      if (relevantChannels.length > 0) {
        console.log(`[YouTube] Paso 1: Escaneando canales oficiales (${relevantChannels.map(c => c.name).join(', ')}) para ${matchLabel}...`);
        
        const channelSearches = relevantChannels.map(async (channel) => {
          const isHome = channel.patterns.some(p => p.test(summary.homeTeam));
          const opponent = isHome ? summary.awayTeam : summary.homeTeam;
          const opponentClean = cleanName(opponent);
          
          let channelBest = null;
          try {
            const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
            
            const rssBaseUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channel.id}`;
            const rssRes = { data: await robustGet(rssBaseUrl, false) }; // false = esperamos XML string
            const data = parser.parse(rssRes.data);
            const entries = data?.feed?.entry ? (Array.isArray(data.feed.entry) ? data.feed.entry : [data.feed.entry]) : [];

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

            // Paso 1.5: Piped API (Más robusto que Invidious para escaneo de canal)
            if (!channelBest || channelBest.score < 20) {
              for (const host of PIPED_HOSTS) {
                try {
                  const res = await robustGet(`${host}/channel/${channel.id}`, true);
                  if (res && Array.isArray(res.relatedStreams)) {
                    for (const v of res.relatedStreams) {
                      // Piped suele devolver 'uploaded' como timestamp numérico
                      // Si es < 10^10, asumimos segundos y convertimos a ms
                      const uploadTime = typeof v.uploaded === 'number' ? (v.uploaded < 10000000000 ? v.uploaded * 1000 : v.uploaded) : Date.now();
                      const pubDate = new Date(uploadTime);
                      if (isCloseDate(pubDate, matchDay)) {
                          const score = calcularScore(v.title, summary.homeTeam, summary.awayTeam);
                          if (score > (channelBest?.score || 0)) {
                            // url viene como "/watch?v=ID"
                            const vId = v.url.split('v=')[1];
                            if (vId) {
                              channelBest = { id: vId, score, source: 'Piped', canal: channel.name, priority: channel.priority || false, isHome };
                            }
                          }
                      }
                    }
                    // Si encontramos algo bueno en Piped, dejamos de buscar
                    if (channelBest && channelBest.score >= 20) break;
                  }
                } catch (e) { 
                  if (typeof window === 'undefined') {
                    // Solo log en nativo para no saturar web
                    // console.log(`[YouTube] Piped falló en ${host}:`, e.message); 
                  }
                }
              }
            }
            if (channelBest && channelBest.score >= 20) return channelBest;

            // Intentar con los servidores en orden de fiabilidad/velocidad (sin shuffle)
            const shuffledHosts = [...INVIDIOUS_HOSTS];
            
            for (const host of shuffledHosts) {
              if (channelBest && channelBest.score >= 20) break; // Ya tenemos uno bueno
              let hostWorks = false;
              
              try {
                // Paso 2.1: Búsqueda específica
                const searchApiUrl = `${host}/api/v1/channels/${channel.id}/search?q=${encodeURIComponent(opponentClean)}`;
                const responseData = await robustGet(searchApiUrl, true);
                
                if (!Array.isArray(responseData)) throw new Error("Respuesta inválida (no es array)");

                hostWorks = true;
                const searchVideos = responseData || [];
                for (const v of searchVideos) {
                  const pubDate = new Date(v.published * 1000);
                  if (isCloseDate(pubDate, matchDay)) {
                    const score = calcularScore(v.title, summary.homeTeam, summary.awayTeam);
                    if (score > (channelBest?.score || 0)) {
                      channelBest = { id: v.videoId, score, source: 'InvSearch', canal: channel.name, priority: channel.priority || false, isHome };
                    }
                  }
                }
              } catch (err) {
                // console.log(`[YouTube] Search falló en ${host}: ${err.message}`);
              }

              if (channelBest && channelBest.score >= 20) break;

              try {
                // Paso 2.2: Escaneo cronológico (fallback)
                const videosApiUrl = `${host}/api/v1/channels/${channel.id}/videos?sort_by=newest`;
                const responseData = await robustGet(videosApiUrl, true);

                // Validar estructura de respuesta de vídeos
                if (!responseData || !Array.isArray(responseData.videos)) throw new Error("Respuesta inválida (campo videos faltante)");

                hostWorks = true;
                const videos = responseData.videos || [];
                for (const v of videos) {
                  const pubDate = new Date(v.published * 1000);
                  if (isCloseDate(pubDate, matchDay)) {
                    const score = calcularScore(v.title, summary.homeTeam, summary.awayTeam);
                    if (score > (channelBest?.score || 0)) {
                      channelBest = { id: v.videoId, score, source: 'Invidious', canal: channel.name, priority: channel.priority || false, isHome };
                    }
                  }
                }
              } catch (err) {
                // console.log(`[YouTube] Videos falló en ${host}: ${err.message}`);
              }
              
              // Si el host respondió correctamente a algo (Search o Videos), paramos de rotar para no saturar,
              // a menos que no hayamos encontrado nada, pero Invidious suele ser consistente.
              if (hostWorks) break;
            }

            // Fallback: Si Invidious falló y tenemos API Key, buscar específicamente en este canal
            if ((!channelBest || channelBest.score < 10) && apiKey) {
              try {
                const apiRes = await axios.get('https://www.googleapis.com/youtube/v3/search', {
                  params: {
                    part: 'snippet',
                    channelId: channel.id,
                    q: searchTerm,
                    maxResults: 5,
                    order: 'date',
                    type: 'video',
                    key: apiKey
                  }
                });
                
                if (apiRes.data?.items) {
                  for (const item of apiRes.data.items) {
                    const pubDate = new Date(item.snippet.publishedAt);
                    if (isCloseDate(pubDate, matchDay)) {
                      const score = calcularScore(item.snippet.title, summary.homeTeam, summary.awayTeam);
                      if (score > (channelBest?.score || 0)) {
                        channelBest = { 
                          id: item.id.videoId, score, source: 'API_Channel', canal: channel.name, priority: channel.priority || false, isHome 
                        };
                      }
                    }
                  }
                }
              } catch (err) {
                console.log(`[YouTube] API Channel Search falló para ${channel.name} (Fallback):`, err.message);
              }
            }

            if (channelBest && channelBest.score > 0) return channelBest;
          } catch (e) {
            if (channelBest && channelBest.score > 0) return channelBest;
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
          
          if (!isLiveMatch && officialResult.score >= 15) { // En live primero intentamos directos
            foundId = officialResult.id;
            console.log(`[YouTube] ✓ Encontrado en canal oficial (${officialResult.canal}) vía ${officialResult.source}. Score: ${officialResult.score}`);
          }
        }
      }

      // ─── PASO 3: Si está en directo, priorizar búsqueda LIVE en YouTube ─────────────────────
      if (!foundId && apiKey && isLiveMatch) {
        console.log(`[YouTube] Partido en directo: buscando emisiones LIVE para "${searchTerm}"...`);
        try {
          const liveRes = await axios.get('https://www.googleapis.com/youtube/v3/search', {
            params: {
              part: 'snippet',
              q: searchTerm,
              maxResults: 25,
              type: 'video',
              eventType: 'live',
              relevanceLanguage: 'es',
              regionCode: 'ES',
              key: apiKey
            }
          });

          if (liveRes.data?.items?.length > 0) {
            let bestLiveMatch = null;
            for (const item of liveRes.data.items) {
              const score = calcularScore(item.snippet.title, summary.homeTeam, summary.awayTeam)
                + (hasLiveWords(item.snippet.title) ? 8 : 0);
              if (score > (bestLiveMatch?.score || 0)) {
                bestLiveMatch = { id: item.id.videoId, score };
              }
            }
            if (bestLiveMatch) {
              foundId = bestLiveMatch.id;
              console.log(`[YouTube] ✓ Directo encontrado vía API LIVE (score ${bestLiveMatch.score})`);
            }
          }
        } catch (err) {
          console.warn('[YouTube] Búsqueda LIVE falló:', err.message, err.response?.data?.error || '');
        }
      }

      // ─── PASO 4: Fallback a vídeos emitidos/subidos el día del partido ──────────────────────
      if (!foundId) {
        // 4a. Intentar búsqueda general en PIPED antes que la API oficial (ahorra cuota y a veces es mejor)
        console.log(`[YouTube] Paso 4a: Búsqueda general en Piped: "${searchTerm}"`);
        for (const host of PIPED_HOSTS) {
          try {
            const res = await robustGet(`${host}/search?q=${encodeURIComponent(searchTerm)}&filter=all`, true);
            if (res && Array.isArray(res.items)) {
              for (const item of res.items) {
                // Piped search items a veces no traen fecha exacta, cuidado
                // Pero si el score es muy alto (nombres exactos), nos vale
                const score = calcularScore(item.title, summary.homeTeam, summary.awayTeam);
                if (score >= 20) {
                   // url viene como "/watch?v=ID"
                   const vId = item.url.split('v=')[1];
                   if (vId) {
                     foundId = vId;
                     console.log(`[YouTube] ✓ Encontrado vía Piped Search: ${item.title} (Score: ${score})`);
                     break;
                   }
                }
              }
            }
            if (foundId) break;
          } catch (e) { 
            // console.log(`[YouTube] Piped Search falló en ${host}:`, e.message);
          }
        }

        // 4b. Fallback: Intentar búsqueda general en INVIDIOUS si Piped falló
        if (!foundId) {
          console.log(`[YouTube] Paso 4b: Búsqueda general en Invidious: "${searchTerm}"`);
          for (const host of INVIDIOUS_HOSTS) {
            try {
              const res = await robustGet(`${host}/api/v1/search?q=${encodeURIComponent(searchTerm)}`, true);
              if (Array.isArray(res)) {
                for (const item of res) {
                  const score = calcularScore(item.title, summary.homeTeam, summary.awayTeam);
                  if (score >= 20) {
                    foundId = item.videoId;
                    console.log(`[YouTube] ✓ Encontrado vía Invidious Search en ${host}: ${item.title} (Score: ${score})`);
                    break;
                  }
                }
              }
              if (foundId) break;
            } catch (e) { /* ignore */ }
          }
        }

        if (!foundId && apiKey) {
        console.log(`[YouTube] Paso 4c: Búsqueda API General: "${searchTerm}" (Puntuación oficial previa: ${officialResult?.score || 0})`);
        try {
          const res = await axios.get('https://www.googleapis.com/youtube/v3/search', {
            params: { 
              part: 'snippet', 
              q: searchTerm, 
              maxResults: 50, 
              type: 'video', 
              order: 'date',
              publishedAfter: dayStart.toISOString(),
              publishedBefore: dayEnd.toISOString(),
              relevanceLanguage: 'es',
              regionCode: 'ES',
              key: apiKey 
            }
          });
          
          if (res.data?.items?.length > 0) {
            let bestApiMatch = null;
            for (const item of res.data.items) {
              const score = calcularScore(item.snippet.title, summary.homeTeam, summary.awayTeam);
              // console.log(`[YouTube API Check] Evaluando: "${item.snippet.title}" | Score: ${score}`);
              
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
        } // fin if apiKey
      }

      // PASO FINAL: Si tenemos un resultado de canal oficial (aunque sea de baja puntuación) y no hay nada mejor, usarlo.
      // Esto arregla casos donde el título es solo "Getxo en directo" (Score ~6) pero es el canal correcto en el día correcto.
      if (!foundId && officialResult) {
        foundId = officialResult.id;
        console.log(`[YouTube] ✓ Forzando uso de resultado oficial (Score: ${officialResult.score}) al no encontrar alternativa mejor.`);
      }


      if (foundId) {
        setYoutubeVideoId(foundId);
        // No iniciamos la reproducción, solo cargamos el ID para mostrar la miniatura
      } else {
        console.log('[YouTube] No se encontró ningún vídeo');
      }
    } catch (err) {
      console.error('[YouTube] Error Fatal:', err.message);
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

  const updateMatchFromBlocks = useCallback(async (blocks) => {
    // Si hay href, refresca usando el enlace directo del partido
    if (currentMatch?.href) {
      try {
        const directBlocks = await fetchAndParse(currentMatch.href);
        const blockMatches = (directBlocks || [])
          .filter((b) => b.type === 'table')
          .flatMap((b) => b.matches || []);
        // 1. Buscar por nombre exacto
        let found = blockMatches.find(m => {
          const s = getMatchSummary(m);
          return s.homeTeam === summary.homeTeam && s.awayTeam === summary.awayTeam;
        });
        // 2. Si no, buscar el primero con sets válidos
        if (!found) found = blockMatches.find(m => (m.sets || []).length > 0);
        // 3. Si no, usar el primero
        if (!found && blockMatches.length > 0) found = blockMatches[0];
        if (found) {
          setCurrentMatch((prev) => ({
            ...prev,
            ...found,
            href: prev?.href || found?.href || null,
          }));
          return;
        }
      } catch (err) {
        console.warn('[MatchDetail] Error al refrescar desde href:', err?.message || err);
      }
    }
    // Si no hay href, buscar por nombre en los bloques
    let found = null;
    for (const block of blocks) {
      if (block.type !== 'table') continue;
      const matches = block.matches || [];
      found = matches.find(m => {
        const s = getMatchSummary(m);
        return s.homeTeam === summary.homeTeam && s.awayTeam === summary.awayTeam;
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
    if (found) setCurrentMatch(found);
  }, [currentMatch?.href, summary.homeTeam, summary.awayTeam]);

  const updateMatchFromDirectMatchBlocks = useCallback((blocks) => {
    const blockMatches = (blocks || [])
      .filter((b) => b.type === 'table')
      .flatMap((b) => b.matches || []);

    if (!blockMatches.length) return false;

    // 1. Buscar por nombre exacto
    let found = blockMatches.find((m) => {
      const s = getMatchSummary(m);
      return s.homeTeam === summary.homeTeam && s.awayTeam === summary.awayTeam;
    });
    // 2. Si no, buscar el primero con sets válidos
    if (!found) found = blockMatches.find((m) => (m.sets || []).length > 0);
    // 3. Si no, usar el primero
    if (!found && blockMatches.length > 0) found = blockMatches[0];
    if (!found) return false;

    setCurrentMatch((prev) => ({
      ...prev,
      ...found,
      href: prev?.href || found?.href || null,
    }));
    return true;
  }, [summary.homeTeam, summary.awayTeam]);

  // Auto-refresh cada 10 segundos, INDEPENDIENTEMENTE del estado (Live/Finished)
  // para corregir posibles errores de estado en la web.
  useEffect(() => {
    // if (!calendarUrl && !currentMatch?.href) return;
    // console.log('[MatchDetail] Iniciando auto-refresh (10s)...');
    const intervalId = setInterval(async () => {
      try {
        // console.log('[MatchDetail] Auto-refresh (10s) ejecutándose...');
        if (calendarUrl) {
          const blocks = await fetchAndParse(calendarUrl);
          updateMatchFromBlocks(blocks);
        }
        if (currentMatch?.href) {
          const directBlocks = await fetchAndParse(currentMatch.href);
          updateMatchFromDirectMatchBlocks(directBlocks);
        }
        // if (!calendarUrl && !currentMatch?.href) {
        //   console.log('[MatchDetail] No se puede actualizar: faltan calendarUrl y match.href');
        // }
      } catch (e) {
        console.log('[MatchDetail] Error en auto-refresh:', e.message);
      }
    }, 10000); // 10 segundos
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
    } catch (err) {
      console.error('Error refreshing match detail:', err);
    } finally {
      setRefreshing(false);
    }
  }, [calendarUrl, currentMatch?.href, updateMatchFromBlocks, updateMatchFromDirectMatchBlocks]);

  // When opened from TournamentScreen, fetch direct match URL to load sets.
  useEffect(() => {
    let cancelled = false;
    async function loadDirectMatchData() {
      if (!currentMatch?.href) return;
      try {
        const directBlocks = await fetchAndParse(currentMatch.href);
        if (!cancelled) updateMatchFromDirectMatchBlocks(directBlocks);
      } catch (err) {
        console.warn('Error loading direct match data:', err?.message || err);
      }
    }
    loadDirectMatchData();
    return () => { cancelled = true; };
  }, [currentMatch?.href, updateMatchFromDirectMatchBlocks]);

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

  const renderTabContent = (tabKey) => {
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
              setActiveTab(TABS[pos]);
              positionAnim.setValue(pos);
              offsetAnim.setValue(0);
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
