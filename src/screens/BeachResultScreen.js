import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, StatusBar, StyleSheet, View, ScrollView, TouchableOpacity, ActivityIndicator, Linking, TextInput, Animated } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { Spacing } from '../styles/theme';
import { downloadPdfBase64 } from '../utils/pdfExtractor';
import PDFExtractorWebView from '../components/PDFExtractorWebView';
import { parseBeachResults } from '../utils/parseBeachResults';


const INITIAL_RANKING_SHOW = 7;
const INITIAL_MATCHES_SHOW = 6;


function SkeletonBlock({ height, style }) {
  const { colors: Colors } = useTheme();
  return (
    <View style={[{ height: height || 80, backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, opacity: 0.5 }, style]}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="small" color={Colors.textMuted} />
      </View>
    </View>
  );
}


function MedalCard({ posicion, pareja, gold, silver, bronze }) {
  const medal = gold ? { color: '#f59e0b', bg: '#fef3c7', icon: 'emoji_events', label: 'Oro', size: 64, circleSize: 64 } :
    silver ? { color: '#94a3b8', bg: '#f1f5f9', icon: 'emoji_events', label: 'Plata', size: 56, circleSize: 56 } :
    { color: '#d97706', bg: '#fff7ed', icon: 'emoji_events', label: 'Bronce', size: 48, circleSize: 48 };

  return (
    <View style={{
      backgroundColor: medal.bg,
      borderWidth: 2, borderColor: medal.color, borderRadius: 16, padding: 16,
      flexDirection: 'row', alignItems: 'center', gap: 16, overflow: 'hidden',
    }}>
      <View style={{
        width: medal.circleSize, height: medal.circleSize, borderRadius: medal.circleSize / 2,
        backgroundColor: medal.color, justifyContent: 'center', alignItems: 'center',
      }}>
        <MaterialIcons name="emoji-events" size={medal.size * 0.45} color="#fff" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 10, fontWeight: '900', letterSpacing: 1, color: medal.color, textTransform: 'uppercase' }}>
          {posicion}º {medal.label}
        </Text>
        <Text style={{ fontSize: 16, fontWeight: '900', color: '#1e293b', marginTop: 2 }}>{pareja}</Text>
      </View>
    </View>
  );
}


function RankingRow({ posicion, pareja, isLast, highlighted }) {
  const { colors: Colors } = useTheme();
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingVertical: 12, paddingHorizontal: 16,
      borderBottomWidth: isLast ? 0 : 0.5, borderBottomColor: Colors.border,
      backgroundColor: highlighted ? Colors.primary + '12' : 'transparent',
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Text style={{ width: 28, fontWeight: '900', color: Colors.textMuted, fontSize: 15 }}>{posicion}</Text>
        <Text style={{ fontWeight: highlighted ? '900' : '700', color: Colors.textPrimary, fontSize: 14 }}>{pareja}</Text>
      </View>
    </View>
  );
}


function MatchCard({ match, highlighted }) {
  const { colors: Colors } = useTheme();
  const allSets = [match.set1, match.set2, match.set3].filter(Boolean);
  const maxSets = Math.max(allSets.length, 3);

  return (
    <View style={{
      backgroundColor: highlighted ? Colors.primary + '08' : Colors.surface,
      borderRadius: 12, borderWidth: 1,
      borderColor: highlighted ? Colors.primary + '40' : Colors.border,
      padding: 16,
    }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <Text style={{ fontSize: 10, fontWeight: '900', backgroundColor: Colors.primary, color: '#fff', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' }}>
            Partido {match.partido}
          </Text>
          {match.fase ? (
            <Text style={{ fontSize: 10, fontWeight: '900', backgroundColor: Colors.background, color: Colors.textMuted, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' }}>
              {match.fase}
            </Text>
          ) : null}
        </View>
        <Text style={{ fontSize: 12, fontWeight: '600', color: Colors.textMuted }}>
          {match.hora ? match.hora + ' • ' : ''}{match.pista ? `Pista ${match.pista}` : ''}
        </Text>
      </View>
      <View style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 10, fontWeight: '900', color: Colors.textMuted, width: 28 }}>{match.setsA} {match.setsA > match.setsB ? '(W)' : ''}</Text>
            <Text style={{ fontWeight: '900', color: Colors.primary, fontSize: 14 }}>{match.parejaA}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {Array.from({ length: maxSets }).map((_, idx) => {
              const set = [match.set1, match.set2, match.set3][idx];
              if (set) {
                return (
                  <Text key={idx} style={{
                    width: 24, textAlign: 'center', fontSize: 12,
                    fontWeight: set.A > set.B ? '900' : '600',
                    color: set.A > set.B ? Colors.textPrimary : Colors.textMuted,
                  }}>
                    {String(set.A).padStart(2, '0')}
                  </Text>
                );
              }
              return <Text key={idx} style={{ width: 24, textAlign: 'center', fontSize: 12, color: Colors.textMuted, opacity: 0.3 }}>-</Text>;
            })}
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 10, fontWeight: '900', color: Colors.textMuted, width: 28 }}>{match.setsB} {match.setsB > match.setsA ? '(W)' : ''}</Text>
            <Text style={{ fontWeight: '700', color: Colors.textPrimary, fontSize: 14 }}>{match.parejaB}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {Array.from({ length: maxSets }).map((_, idx) => {
              const set = [match.set1, match.set2, match.set3][idx];
              if (set) {
                return (
                  <Text key={idx} style={{
                    width: 24, textAlign: 'center', fontSize: 12,
                    fontWeight: set.B > set.A ? '900' : '600',
                    color: set.B > set.A ? Colors.textPrimary : Colors.textMuted,
                  }}>
                    {String(set.B).padStart(2, '0')}
                  </Text>
                );
              }
              return <Text key={idx} style={{ width: 24, textAlign: 'center', fontSize: 12, color: Colors.textMuted, opacity: 0.3 }}>-</Text>;
            })}
          </View>
        </View>
      </View>
    </View>
  );
}


export default function BeachResultScreen({ route, navigation }) {
  const { pdfUrl, pdfName } = route.params || {};
  const { colors: Colors, isDark } = useTheme();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Safety timeout: 180s for OCR-heavy PDFs
  useEffect(() => {
    if (!loading) return;
    const timer = setTimeout(() => {
      setError('Timeout: no se pudo extraer datos del PDF');
      setLoading(false);
    }, 180000);
    return () => clearTimeout(timer);
  }, [loading]);
  const [showAllRanking, setShowAllRanking] = useState(false);
  const [showAllMatches, setShowAllMatches] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [pdfBase64, setPdfBase64] = useState(null);
  const [extractKey, setExtractKey] = useState(0);
  const [searchAnim] = useState(() => new Animated.Value(0));
  const [ocrProgress, setOcrProgress] = useState(null);
  const searchRef = useRef(null);

  useEffect(() => {
    if (!pdfUrl) { setLoading(false); setError('No hay URL del PDF'); return; }
    let cancelled = false;
    (async () => {
      try {
        const b64 = await downloadPdfBase64(pdfUrl);
        if (!cancelled) setPdfBase64(b64);
      } catch (e) {
        if (!cancelled) { setError(e.message || 'Error al descargar el PDF'); setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [pdfUrl]);

  const handleDataExtracted = useCallback((pages, ocrText) => {
    try {
      const parsed = parseBeachResults(pages, ocrText);
      if (parsed.partidos.length === 0 && parsed.ranking.length === 0) {
        const isImage = parsed._debug?.totalItems === 0 || parsed._debug?.ocr;
        setError(isImage
          ? 'Este PDF parece ser un documento escaneado (imagen). No contiene texto seleccionable.'
          : 'No se pudieron extraer datos estructurados de este PDF');
      } else {
        setData(parsed);
        setError(null);
      }
    } catch (e) {
      setError('Error al procesar: ' + e.message);
    }
    setLoading(false);
  }, []);

  const handleOcrProgress = useCallback((msg) => {
    setOcrProgress(msg);
  }, []);

  const handleExtractError = useCallback((msg) => {
    try {
      setOcrProgress(null);
      setError(msg || 'Error al extraer texto del PDF');
    } catch (e) {
      setError('Error desconocido');
    }
    setLoading(false);
  }, []);

  const openPDF = useCallback(() => {
    Linking.openURL(pdfUrl).catch(() => {});
  }, [pdfUrl]);

  const toggleSearch = useCallback(() => {
    setShowSearch(prev => {
      const next = !prev;
      if (next) {
        setSearchQuery('');
        Animated.timing(searchAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      } else {
        Animated.timing(searchAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start();
      }
      return next;
    });
  }, [searchAnim]);

  useEffect(() => {
    if (showSearch && searchRef.current) {
      setTimeout(() => searchRef.current?.focus(), 300);
    }
  }, [showSearch]);

  const searchLower = searchQuery.toLowerCase().trim();

  const filteredRanking = useMemo(() => {
    if (!data || !searchLower) return data?.ranking || [];
    return data.ranking.filter(r => r.pareja.toLowerCase().includes(searchLower));
  }, [data, searchLower]);

  const filteredMatches = useMemo(() => {
    if (!data || !searchLower) return data?.partidos || [];
    return data.partidos.filter(m =>
      m.parejaA.toLowerCase().includes(searchLower) ||
      m.parejaB.toLowerCase().includes(searchLower)
    );
  }, [data, searchLower]);

  const visibleRanking = useMemo(() => {
    const source = searchLower ? filteredRanking : (data?.ranking || []);
    return showAllRanking ? source : source.slice(0, INITIAL_RANKING_SHOW);
  }, [data, searchLower, filteredRanking, showAllRanking]);

  const visibleMatches = useMemo(() => {
    const source = searchLower ? filteredMatches : (data?.partidos || []);
    return showAllMatches ? source : source.slice(0, INITIAL_MATCHES_SHOW);
  }, [data, searchLower, filteredMatches, showAllMatches]);

  const hasRanking = (data?.ranking?.length || 0) > 0;
  const hasMatches = (data?.partidos?.length || 0) > 0;

  const retry = useCallback(() => {
    setError(null);
    setLoading(true);
    setData(null);
    setShowAllRanking(false);
    setShowAllMatches(false);
    setSearchQuery('');
    setShowSearch(false);
    setOcrProgress(null);
    setExtractKey(k => k + 1);
  }, []);

  const styles = useMemo(() => StyleSheet.create({
    safe: { flex: 1, backgroundColor: Colors.background },
    header: {
      height: 64, flexDirection: 'row', alignItems: 'center',
      backgroundColor: Colors.surface,
      borderBottomColor: Colors.border, borderBottomWidth: 1, paddingHorizontal: 8,
    },
    backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
    headerTitle: { fontSize: 15, fontWeight: '900', letterSpacing: -0.5, color: Colors.primary, flex: 1, textAlign: 'center' },
    headerBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
    headerRight: { flexDirection: 'row' },
    scroll: { flex: 1 },
    section: { paddingHorizontal: Spacing.lg, marginBottom: 24 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
    sectionTitle: { fontSize: 20, fontWeight: '900', color: Colors.textPrimary, letterSpacing: -0.5 },
    sectionDivider: { height: 2, flex: 1, backgroundColor: Colors.border, borderRadius: 1 },
    podium: { gap: 12, marginBottom: 16 },
    rankingListWrap: { backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
    rankingListHeader: { padding: 12, backgroundColor: Colors.background, borderBottomWidth: 1, borderBottomColor: Colors.border },
    rankingListHeaderText: { fontSize: 11, fontWeight: '900', letterSpacing: 1, color: Colors.textMuted, textTransform: 'uppercase' },
    showMoreBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      paddingVertical: 14, marginTop: 12,
      backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border,
    },
    showMoreText: { fontSize: 14, fontWeight: '700', color: Colors.primary, marginLeft: 6 },
    matchesGrid: { gap: 12, marginBottom: 8 },
    heroTitle: { fontSize: 26, fontWeight: '900', color: Colors.textPrimary, letterSpacing: -1, marginBottom: 6 },
    badgesWrap: { flexDirection: 'row', gap: 8, marginBottom: 16 },
    badge: { backgroundColor: Colors.surface, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, borderWidth: 1, borderColor: Colors.border },
    badgeText: { fontSize: 12, fontWeight: '600', color: Colors.textMuted },
    emptySection: { padding: 24, alignItems: 'center' },
    emptySectionText: { color: Colors.textMuted, fontSize: 14, textAlign: 'center' },
    retryBtn: { marginTop: 20, paddingVertical: 12, paddingHorizontal: 24, backgroundColor: Colors.primary, borderRadius: 12 },
    retryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
    searchBar: {
      flexDirection: 'row', alignItems: 'center', marginHorizontal: Spacing.lg, marginBottom: 16,
      backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.primary + '60',
      paddingHorizontal: 12, height: 44,
    },
    searchInput: { flex: 1, fontSize: 14, color: Colors.textPrimary, marginLeft: 8 },
    searchClear: { padding: 4 },
    searchResultsText: { fontSize: 13, color: Colors.textMuted, fontWeight: '600', marginBottom: 12 },
  }), [Colors]);

  const renderSkeleton = () => (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={Colors.background} />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <MaterialIcons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{pdfName || 'Resultados'}</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerBtn} onPress={openPDF} activeOpacity={0.7}>
            <MaterialIcons name="download" size={22} color={Colors.primary} />
          </TouchableOpacity>
        </View>
      </View>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.section}>
          <View style={[styles.heroTitle, { height: 32, backgroundColor: Colors.surface, borderRadius: 6, width: '70%' }]} />
          <View style={[styles.badgesWrap, { marginTop: 8 }]}>
            <View style={{ height: 28, width: 100, backgroundColor: Colors.surface, borderRadius: 20 }} />
          </View>
          <SkeletonBlock height={80} style={{ marginBottom: 8 }} />
          <SkeletonBlock height={72} style={{ marginBottom: 8 }} />
          <SkeletonBlock height={64} />
        </View>
        <View style={styles.section}>
          <SkeletonBlock height={48} />
        </View>
        {ocrProgress ? (
          <View style={[{ marginHorizontal: Spacing.lg, padding: 12, backgroundColor: Colors.surface, borderRadius: 8, borderWidth: 1, borderColor: Colors.primary + '40' }]}>
            <Text style={{ fontSize: 13, color: Colors.primary, fontWeight: '600', textAlign: 'center' }}>{ocrProgress}</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );

  return (
    <View style={{ flex: 1 }}>
      {pdfBase64 ? (
        <PDFExtractorWebView
          key={extractKey}
          pdfBase64={pdfBase64}
          onData={handleDataExtracted}
          onError={handleExtractError}
          onProgress={handleOcrProgress}
        />
      ) : null}
      {loading ? renderSkeleton() : (
        <SafeAreaView style={styles.safe} edges={['top']}>
          <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={Colors.background} />
          <View style={styles.header}>
            <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
              <MaterialIcons name="arrow-back" size={24} color={Colors.primary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle} numberOfLines={1}>{pdfName || 'Resultados'}</Text>
            <View style={styles.headerRight}>
              <TouchableOpacity style={styles.headerBtn} onPress={toggleSearch} activeOpacity={0.7}>
                <MaterialIcons name={showSearch ? 'search-off' : 'search'} size={22} color={showSearch ? Colors.primary : Colors.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.headerBtn} onPress={openPDF} activeOpacity={0.7}>
                <MaterialIcons name="download" size={22} color={Colors.primary} />
              </TouchableOpacity>
            </View>
          </View>
          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
            {showSearch && (
              <Animated.View style={[styles.searchBar, {
                opacity: searchAnim,
                transform: [{ translateY: searchAnim.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) }],
              }]}>
                <MaterialIcons name="search" size={18} color={Colors.textMuted} />
                <TextInput
                  ref={searchRef}
                  style={styles.searchInput}
                  placeholder="Buscar jugador..."
                  placeholderTextColor={Colors.textMuted}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity style={styles.searchClear} onPress={() => setSearchQuery('')} activeOpacity={0.7}>
                    <MaterialIcons name="close" size={18} color={Colors.textMuted} />
                  </TouchableOpacity>
                )}
              </Animated.View>
            )}

            <View style={styles.section}>
              <Text style={styles.heroTitle}>{data?.torneo?.categoria || 'Torneo Voley Playa'}</Text>
              {(data?.torneo?.fecha || data?.torneo?.lugar) ? (
                <View style={styles.badgesWrap}>
                  {data.torneo.fecha ? <View style={styles.badge}><Text style={styles.badgeText}>{data.torneo.fecha}</Text></View> : null}
                  {data.torneo.lugar ? <View style={styles.badge}><Text style={styles.badgeText}>{data.torneo.lugar}</Text></View> : null}
                </View>
              ) : null}
            </View>

            {searchLower ? (
              <View style={styles.section}>
                <Text style={styles.searchResultsText}>
                  Resultados para "{searchQuery}": {filteredRanking.length} en clasificación, {filteredMatches.length} partidos
                </Text>
              </View>
            ) : null}

            {hasRanking ? (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <MaterialIcons name="emoji-events" size={22} color={Colors.primary} />
                  <Text style={styles.sectionTitle}>Clasificación</Text>
                  <View style={styles.sectionDivider} />
                </View>
                {!searchLower && (
                <View style={styles.podium}>
                  {(searchLower ? filteredRanking : data.ranking.filter(r => r.posicion <= 3)).map(r => (
                    <MedalCard key={r.posicion} posicion={r.posicion} pareja={r.pareja}
                      gold={r.posicion === 1} silver={r.posicion === 2} bronze={r.posicion === 3} />
                  ))}
                </View>
                )}
                {visibleRanking.length > 0 && !searchLower && visibleRanking.filter(r => r.posicion > 3).length > 0 && (
                  <View style={styles.rankingListWrap}>
                    <View style={styles.rankingListHeader}>
                      <Text style={styles.rankingListHeaderText}>Resto de Clasificación</Text>
                    </View>
                    {visibleRanking.filter(r => r.posicion > 3).map((r, i, arr) => (
                      <RankingRow key={r.posicion} posicion={r.posicion} pareja={r.pareja} isLast={i === arr.length - 1} />
                    ))}
                    {data.ranking.length > INITIAL_RANKING_SHOW && !showAllRanking ? (
                      <TouchableOpacity
                        style={{ padding: 12, backgroundColor: Colors.background, alignItems: 'center' }}
                        onPress={() => setShowAllRanking(true)}
                        activeOpacity={0.7}
                      >
                        <Text style={{ fontSize: 12, fontWeight: '600', color: Colors.textMuted, fontStyle: 'italic' }}>
                          +{data.ranking.length - INITIAL_RANKING_SHOW} más — pulsa para ver todos
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                )}
                {searchLower && visibleRanking.length > 0 && (
                  <View style={styles.rankingListWrap}>
                    <View style={styles.rankingListHeader}>
                      <Text style={styles.rankingListHeaderText}>Coincidencias</Text>
                    </View>
                    {visibleRanking.map((r, i, arr) => (
                      <RankingRow key={r.posicion} posicion={r.posicion} pareja={r.pareja} isLast={i === arr.length - 1} highlighted />
                    ))}
                  </View>
                )}
                {!searchLower && hasRanking && data.ranking.length > INITIAL_RANKING_SHOW ? (
                  <TouchableOpacity style={styles.showMoreBtn} onPress={() => setShowAllRanking(!showAllRanking)} activeOpacity={0.7}>
                    <MaterialIcons name={showAllRanking ? 'expand-less' : 'expand-more'} size={20} color={Colors.primary} />
                    <Text style={styles.showMoreText}>{showAllRanking ? 'Ver menos' : 'Ver clasificación completa'}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : error ? (
              <View style={[styles.section, styles.emptySection]}>
                <MaterialIcons name="error-outline" size={40} color={Colors.textMuted} style={{ opacity: 0.3 }} />
                <Text style={[styles.emptySectionText, { marginTop: 8, marginBottom: 12 }]}>{error}</Text>
                <TouchableOpacity style={styles.retryBtn} onPress={retry} activeOpacity={0.7}>
                  <Text style={styles.retryText}>Reintentar</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={[styles.section, styles.emptySection]}>
                <Text style={styles.emptySectionText}>No se encontró clasificación en este PDF</Text>
              </View>
            )}

            {data?._debug ? (
              <View style={[{ backgroundColor: '#fef2f2', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#fca5a5', marginHorizontal: Spacing.lg, marginBottom: 24 }]}>
                <Text style={{ fontSize: 12, color: '#991b1b', fontWeight: '700', marginBottom: 4 }}>Diagnóstico {!hasRanking ? '(sin clasificación)' : ''}</Text>
                <Text style={{ fontSize: 11, color: '#7f1d1d', fontFamily: 'monospace' }}>
                  Paginas: {data._debug.pages}, Items: {data._debug.totalItems}, Filas: {data._debug.totalRows}
                  {'\n'}matchRows: {data._debug.matchRows}, rankingRows: {data._debug.rankingRows}, fallback: {data._debug.fallbackFound}
                  {data._debug.ocrLines !== undefined ? ('\nOCR: ' + data._debug.ocrLines + ' lineas') : ''}
                  {data._debug.ocrTextPreview ? ('\nOCR preview: ' + data._debug.ocrTextPreview) : ''}
                </Text>
              </View>
            ) : null}

            {hasMatches ? (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <MaterialIcons name="format-list-bulleted" size={22} color={Colors.primary} />
                  <Text style={styles.sectionTitle}>Partidos</Text>
                  <View style={styles.sectionDivider} />
                </View>
                <View style={styles.matchesGrid}>
                  {visibleMatches.length > 0 ? visibleMatches.map((m, i) => (
                    <MatchCard key={i} match={m} highlighted={searchLower && (m.parejaA.toLowerCase().includes(searchLower) || m.parejaB.toLowerCase().includes(searchLower))} />
                  )) : searchLower ? (
                    <View style={styles.emptySection}><Text style={styles.emptySectionText}>No hay partidos que coincidan</Text></View>
                  ) : null}
                </View>
                {!searchLower && data.partidos.length > INITIAL_MATCHES_SHOW ? (
                  <TouchableOpacity style={styles.showMoreBtn} onPress={() => setShowAllMatches(!showAllMatches)} activeOpacity={0.7}>
                    <MaterialIcons name={showAllMatches ? 'expand-less' : 'expand-more'} size={20} color={Colors.primary} />
                    <Text style={styles.showMoreText}>{showAllMatches ? 'Ver menos' : `Ver todos los partidos (${data.partidos.length})`}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}
          </ScrollView>
        </SafeAreaView>
      )}
    </View>
  );
}
