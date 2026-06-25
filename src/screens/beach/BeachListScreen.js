import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, StatusBar, StyleSheet, View, ScrollView, TouchableOpacity, TextInput, Animated, Dimensions, ActivityIndicator } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import PagerView from '../../components/PagerViewWrapper';
import { downloadPdfBase64 } from '../../utils/pdfExtractor';
import PDFExtractorWebView from '../../components/PDFExtractorWebView';
import { parseBeachResults } from '../../utils/parseBeachResults';

const AnimatedPagerView = Animated.createAnimatedComponent(PagerView);

const { width: SCREEN_WIDTH } = Dimensions.get('window');

function RankingRow({ posicion, pareja, onPress, isLast }) {
  const { colors: Colors } = useTheme();
  return (
    <TouchableOpacity
      onPress={() => onPress?.(posicion, pareja)}
      activeOpacity={0.6}
      style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingVertical: 12, paddingHorizontal: 16,
        borderBottomWidth: isLast ? 0 : 0.5, borderBottomColor: Colors.border,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
        <View style={{
          width: 28, height: 28, borderRadius: 14,
          backgroundColor: posicion <= 3 ? (posicion === 1 ? '#f59e0b' : posicion === 2 ? '#94a3b8' : '#d97706') : Colors.background,
          justifyContent: 'center', alignItems: 'center',
        }}>
          <Text style={{
            fontWeight: '900', fontSize: 12,
            color: posicion <= 3 ? '#fff' : Colors.textMuted,
          }}>{posicion}</Text>
        </View>
        <Text style={{ fontWeight: '700', color: Colors.textPrimary, fontSize: 14, flex: 1 }}>{pareja}</Text>
      </View>
      <MaterialIcons name="chevron-right" size={20} color={Colors.textMuted} />
    </TouchableOpacity>
  );
}

function MatchCard({ match, onPress }) {
  const { colors: Colors } = useTheme();
  const allSets = [match.set1, match.set2, match.set3].filter(Boolean);
  const maxSets = Math.max(allSets.length, 3);
  const isPlayed = match.set1 != null;
  const aWon = isPlayed && (match.setsA > match.setsB);
  const bWon = isPlayed && (match.setsB > match.setsA);

  const getSetPoints = (set) => {
    if (!set) return { a: 0, b: 0 };
    const a = Number(set.A != null ? set.A : set.a) || 0;
    const b = Number(set.B != null ? set.B : set.b) || 0;
    return { a, b };
  };

  const getInitials = (name) => {
    if (!name) return '?';
    const parts = name.split('/');
    if (parts.length >= 2) {
      const p1 = parts[0].trim()[0] || '';
      const p2 = parts[1].trim()[0] || '';
      return (p1 + p2).toUpperCase();
    }
    return name.trim().slice(0, 2).toUpperCase();
  };

  return (
    <TouchableOpacity onPress={() => onPress?.(match)} activeOpacity={0.7}
      style={{
        backgroundColor: Colors.surface,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: Colors.border,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 4,
        elevation: 2,
      }}
    >
      {/* CARD HEADER */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <View style={{ backgroundColor: Colors.primary + '18', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 }}>
            <Text style={{ fontSize: 10, fontWeight: '800', color: Colors.primary, letterSpacing: 0.5 }}>
              PARTIDO {match.partido}
            </Text>
          </View>
          {match.fase ? (
            <View style={{ backgroundColor: Colors.surfaceAlt, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: Colors.border }}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: Colors.textMuted, letterSpacing: 0.5 }}>
                {match.fase.toUpperCase()}
              </Text>
            </View>
          ) : null}
        </View>
        <Text style={{ fontSize: 11, fontWeight: '700', color: Colors.textMuted }}>
          {match.hora ? match.hora + ' • ' : ''}{match.pista ? `Pista ${match.pista}` : ''}
        </Text>
      </View>

      {/* CARD BODY */}
      <View style={{ gap: 12 }}>
        
        {/* ROW PAREJA A */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
            <View style={{
              width: 26, height: 26, borderRadius: 13,
              backgroundColor: aWon ? Colors.primary + '15' : Colors.surfaceAlt,
              borderColor: aWon ? Colors.primary : Colors.border,
              borderWidth: 1,
              justifyContent: 'center', alignItems: 'center'
            }}>
              <Text style={{ fontSize: 10, fontWeight: '800', color: aWon ? Colors.primary : Colors.textSecondary }}>
                {getInitials(match.parejaA)}
              </Text>
            </View>
            <Text style={{
              fontSize: 15,
              fontWeight: aWon ? '800' : '600',
              color: aWon ? Colors.primary : Colors.textPrimary,
              flex: 1
            }} numberOfLines={1}>
              {match.parejaA}
            </Text>
            <View style={{ width: 30, alignItems: 'center' }}>
              <Text style={{
                fontSize: 16,
                fontWeight: '900',
                color: aWon ? Colors.primary : Colors.textSecondary,
              }}>
                {isPlayed ? match.setsA : '-'}
              </Text>
            </View>
          </View>
          
          <View style={{ flexDirection: 'row', gap: 6, marginLeft: 16 }}>
            {Array.from({ length: maxSets }).map((_, idx) => {
              const set = [match.set1, match.set2, match.set3][idx];
              if (set) {
                const { a, b } = getSetPoints(set);
                const wonSet = a > b;
                return (
                  <View key={idx} style={{
                    width: 26, height: 26, borderRadius: 6,
                    backgroundColor: wonSet ? Colors.primary + '10' : Colors.surfaceAlt,
                    justifyContent: 'center', alignItems: 'center',
                    borderWidth: 1, borderColor: wonSet ? Colors.primary + '30' : 'transparent',
                  }}>
                    <Text style={{
                      fontSize: 12,
                      fontWeight: wonSet ? '800' : '600',
                      color: wonSet ? Colors.primary : Colors.textMuted
                    }}>
                      {a}
                    </Text>
                  </View>
                );
              }
              return (
                <View key={idx} style={{ width: 26, height: 26, justifyContent: 'center', alignItems: 'center' }}>
                  <Text style={{ fontSize: 12, color: Colors.border }}>-</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* ROW PAREJA B */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
            <View style={{
              width: 26, height: 26, borderRadius: 13,
              backgroundColor: bWon ? Colors.primary + '15' : Colors.surfaceAlt,
              borderColor: bWon ? Colors.primary : Colors.border,
              borderWidth: 1,
              justifyContent: 'center', alignItems: 'center'
            }}>
              <Text style={{ fontSize: 10, fontWeight: '800', color: bWon ? Colors.primary : Colors.textSecondary }}>
                {getInitials(match.parejaB)}
              </Text>
            </View>
            <Text style={{
              fontSize: 15,
              fontWeight: bWon ? '800' : '600',
              color: bWon ? Colors.primary : Colors.textPrimary,
              flex: 1
            }} numberOfLines={1}>
              {match.parejaB}
            </Text>
            <View style={{ width: 30, alignItems: 'center' }}>
              <Text style={{
                fontSize: 16,
                fontWeight: '900',
                color: bWon ? Colors.primary : Colors.textSecondary,
              }}>
                {isPlayed ? match.setsB : '-'}
              </Text>
            </View>
          </View>
          
          <View style={{ flexDirection: 'row', gap: 6, marginLeft: 16 }}>
            {Array.from({ length: maxSets }).map((_, idx) => {
              const set = [match.set1, match.set2, match.set3][idx];
              if (set) {
                const { a, b } = getSetPoints(set);
                const wonSet = b > a;
                return (
                  <View key={idx} style={{
                    width: 26, height: 26, borderRadius: 6,
                    backgroundColor: wonSet ? Colors.primary + '10' : Colors.surfaceAlt,
                    justifyContent: 'center', alignItems: 'center',
                    borderWidth: 1, borderColor: wonSet ? Colors.primary + '30' : 'transparent',
                  }}>
                    <Text style={{ fontSize: 12, fontWeight: wonSet ? '700' : '500', color: wonSet ? Colors.primary : Colors.textMuted }}>{b}</Text>
                  </View>
                );
              }
              return (
                <View key={idx} style={{ width: 26, height: 26, justifyContent: 'center', alignItems: 'center' }}>
                  <Text style={{ fontSize: 12, color: Colors.border }}>-</Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function BeachListScreen({ route, navigation }) {
  const { data: preParsedData, pdfName, pdfUrl } = route.params || {};
  const { colors: Colors, isDark } = useTheme();
  const [activeTab, setActiveTab] = useState('ranking');
  const [searchQuery, setSearchQuery] = useState('');
  const [hideUnplayed, setHideUnplayed] = useState(false);
  const pagerRef = useRef(null);

  const [parsedData, setParsedData] = useState(preParsedData || null);
  const [loading, setLoading] = useState(!preParsedData && !!pdfUrl);
  const [error, setError] = useState(null);
  const [pdfBase64, setPdfBase64] = useState(null);

  useEffect(() => {
    if (preParsedData || !pdfUrl) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const b64 = await downloadPdfBase64(pdfUrl);
        if (!cancelled) setPdfBase64(b64);
      } catch (e) {
        if (!cancelled) { setError(e.message || 'Error al descargar el PDF'); setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [pdfUrl, preParsedData]);

  const handleDataExtracted = useCallback((extracted) => {
    if (!extracted) return;
    const results = parseBeachResults(extracted);
    setParsedData(results);
    setLoading(false);
    setPdfBase64(null);
  }, []);

  const handleExtractError = useCallback((err) => {
    setError(err?.message || 'Error al procesar el PDF');
    setLoading(false);
  }, []);

  const data = parsedData;

  const TABS = ['ranking', 'matches'];
  const TAB_COUNT = 2;
  const tabWidth = SCREEN_WIDTH / TAB_COUNT;

  const positionAnim = useRef(new Animated.Value(0)).current;
  const offsetAnim = useRef(new Animated.Value(0)).current;

  const pagerScrollNative = useMemo(() => Animated.add(positionAnim, offsetAnim), [positionAnim, offsetAnim]);

  const pagerScrollJS = useRef(new Animated.Value(0)).current;

  const onPageScrollHandler = useMemo(() => Animated.event(
    [{ nativeEvent: { position: positionAnim, offset: offsetAnim } }],
    {
      useNativeDriver: true,
      listener: (e) => {
        const { position, offset } = e.nativeEvent;
        pagerScrollJS.setValue(position + offset);
      }
    }
  ), [positionAnim, offsetAnim, pagerScrollJS]);

  useEffect(() => {
    StatusBar.setBarStyle(isDark ? 'light-content' : 'dark-content');
    StatusBar.setBackgroundColor(Colors.background);
  }, [isDark, Colors.background]);

  const tabIndicatorX = pagerScrollNative.interpolate({
    inputRange: [0, 1],
    outputRange: [0, tabWidth],
  });

  const getTabColor = (index) => {
    return pagerScrollJS.interpolate({
      inputRange: [index - 1, index, index + 1],
      outputRange: [Colors.textMuted, Colors.primary, Colors.textMuted],
      extrapolate: 'clamp',
    });
  };

  const torneo = data?.torneo || {};
  const ranking = data?.ranking || [];
  const partidos = data?.partidos || [];

  const searchLower = searchQuery.toLowerCase().trim();

  const filteredRanking = useMemo(() => {
    if (!searchLower) return ranking;
    return ranking.filter(r => r.pareja.toLowerCase().includes(searchLower));
  }, [ranking, searchLower]);

  const filteredMatches = useMemo(() => {
    let source = partidos;
    if (hideUnplayed) source = source.filter(m => m.set1 != null);
    if (!searchLower) return source;
    return source.filter(m =>
      m.parejaA.toLowerCase().includes(searchLower) ||
      m.parejaB.toLowerCase().includes(searchLower)
    );
  }, [partidos, searchLower, hideUnplayed]);

  const handlePairPress = useCallback((pos, pareja) => {
    navigation.navigate('BeachPair', { pareja, posicion: pos, partidos, ranking, torneo, pdfName });
  }, [navigation, partidos, ranking, torneo, pdfName]);

  const handleMatchPress = useCallback((match) => {
    navigation.navigate('BeachMatchDetail', { match, torneo, pdfName });
  }, [navigation, torneo, pdfName]);

  const renderRankingTab = () => (
    <View style={{ flex: 1 }}>
      {searchLower ? (
        <Text style={styles.resultCount}>
          Resultados para "{searchQuery}": {filteredRanking.length} en clasificación
        </Text>
      ) : null}
      {!searchLower && (
        <View style={styles.podium}>
          {ranking.filter(r => r.posicion <= 3).map(r => (
            <TouchableOpacity key={r.posicion} onPress={() => handlePairPress(r.posicion, r.pareja)} activeOpacity={0.7}
              style={[styles.medalCard, styles.podiumMedal(r.posicion)]}>
              <View style={[styles.medalCircle, styles.podiumCircle(r.posicion)]}>
                <MaterialIcons name="emoji-events" size={(r.posicion === 1 ? 64 : r.posicion === 2 ? 56 : 48) * 0.45} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.medalLabel, { color: r.posicion === 1 ? '#f59e0b' : r.posicion === 2 ? '#94a3b8' : '#d97706' }]}>
                  {r.posicion}º {r.posicion === 1 ? 'Oro' : r.posicion === 2 ? 'Plata' : 'Bronce'}
                </Text>
                <Text style={styles.medalName}>{r.pareja}</Text>
              </View>
              <MaterialIcons name="chevron-right" size={22} color={r.posicion === 1 ? '#f59e0b' : r.posicion === 2 ? '#94a3b8' : '#d97706'} />
            </TouchableOpacity>
          ))}
        </View>
      )}
      {(searchLower ? filteredRanking : ranking.filter(r => r.posicion > 3)).length > 0 && (
        <View style={styles.listWrap}>
          <View style={styles.listHeader}>
            <Text style={styles.listHeaderText}>{searchLower ? 'Coincidencias' : 'Resto de Clasificación'}</Text>
          </View>
          {(searchLower ? filteredRanking : ranking.filter(r => r.posicion > 3)).map((r, i, arr) => (
            <RankingRow key={r.posicion} posicion={r.posicion} pareja={r.pareja}
              onPress={handlePairPress} isLast={i === arr.length - 1} />
          ))}
        </View>
      )}
      {searchLower && filteredRanking.length === 0 && (
        <View style={styles.emptySection}>
          <Text style={styles.emptySectionText}>No se encontraron parejas</Text>
        </View>
      )}
      <View style={{ height: 40 }} />
    </View>
  );

  const renderMatchesTab = () => (
    <View style={{ flex: 1 }}>
      {searchLower ? (
        <Text style={styles.resultCount}>
          Resultados para "{searchQuery}": {filteredMatches.length} partidos
        </Text>
      ) : null}
      {partidos.some(m => m.set1 == null) ? (
        <TouchableOpacity
          onPress={() => setHideUnplayed(o => !o)}
          activeOpacity={0.7}
          style={[styles.filterChip, {
            backgroundColor: hideUnplayed ? Colors.primary + '20' : Colors.surface,
            borderColor: hideUnplayed ? Colors.primary : Colors.border,
          }]}
        >
          <MaterialIcons name={hideUnplayed ? 'visibility-off' : 'visibility'} size={16} color={hideUnplayed ? Colors.primary : Colors.textMuted} />
          <Text style={{ fontSize: 12, fontWeight: '700', color: hideUnplayed ? Colors.primary : Colors.textMuted }}>
            Ocultar no jugados
          </Text>
        </TouchableOpacity>
      ) : null}
      {filteredMatches.length > 0 ? (
        <View style={styles.matchesGrid}>
          {filteredMatches.map((m, i) => (
            <MatchCard key={i} match={m} onPress={handleMatchPress} />
          ))}
        </View>
      ) : (
        <View style={styles.emptySection}>
          <Text style={styles.emptySectionText}>No hay partidos</Text>
        </View>
      )}
      <View style={{ height: 40 }} />
    </View>
  );

  const styles = useMemo(() => ({
    ...StyleSheet.create({
      safe: { flex: 1, backgroundColor: Colors.background },
      header: {
        height: 64, flexDirection: 'row', alignItems: 'center',
        backgroundColor: Colors.surface,
        borderBottomColor: Colors.border, borderBottomWidth: 1, paddingHorizontal: 8,
      },
      backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
      headerTitle: { fontSize: 15, fontWeight: '900', letterSpacing: -0.5, color: Colors.primary, flex: 1, textAlign: 'center' },
      tabBar: {
        flexDirection: 'row', backgroundColor: Colors.surface,
        borderBottomWidth: 1, borderBottomColor: Colors.border,
        zIndex: 10, elevation: 4,
      },
      tab: {
        flex: 1, paddingVertical: 14, alignItems: 'center',
      },
      searchContainer: {
        flexDirection: 'row', alignItems: 'center',
        margin: 12, paddingHorizontal: 12,
        backgroundColor: Colors.surface,
        borderRadius: 12, borderWidth: 1, borderColor: Colors.border,
      },
      searchInput: { flex: 1, fontSize: 14, color: Colors.textPrimary, paddingVertical: 10, marginLeft: 8 },
      pager: { flex: 1 },
      listWrap: {
        backgroundColor: Colors.surface, borderRadius: 16,
        borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
        marginHorizontal: 12, marginBottom: 12,
      },
      listHeader: {
        padding: 12, backgroundColor: Colors.background,
        borderBottomWidth: 1, borderBottomColor: Colors.border,
      },
      listHeaderText: { fontSize: 11, fontWeight: '900', letterSpacing: 1, color: Colors.textMuted, textTransform: 'uppercase' },
      emptySection: { padding: 24, alignItems: 'center' },
      emptySectionText: { color: Colors.textMuted, fontSize: 14, textAlign: 'center' },
      matchesGrid: { gap: 12, padding: 12 },
      filterChip: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20,
        marginHorizontal: 12, marginBottom: 4, alignSelf: 'flex-start',
      },
      podium: { gap: 12, margin: 12, marginBottom: 0 },
      resultCount: { fontSize: 13, color: Colors.textMuted, fontWeight: '600', marginHorizontal: 12, marginBottom: 8, marginTop: 4 },
      medalCard: {
        borderWidth: 2, borderRadius: 16, padding: 16,
        flexDirection: 'row', alignItems: 'center', gap: 16, overflow: 'hidden',
      },
      medalCircle: { borderRadius: 99, justifyContent: 'center', alignItems: 'center' },
      medalLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' },
      medalName: { fontSize: 16, fontWeight: '900', color: '#1e293b', marginTop: 2 },
    }),
    podiumMedal: (m) => ({
      backgroundColor: m === 1 ? '#fef3c7' : m === 2 ? '#f1f5f9' : '#fff7ed',
      borderColor: m === 1 ? '#f59e0b' : m === 2 ? '#94a3b8' : '#d97706',
    }),
    podiumCircle: (m) => ({
      width: m === 1 ? 64 : m === 2 ? 56 : 48,
      height: m === 1 ? 64 : m === 2 ? 56 : 48,
      backgroundColor: m === 1 ? '#f59e0b' : m === 2 ? '#94a3b8' : '#d97706',
    }),
  }), [Colors]);

  if (loading) {
    return (
      <View style={{ flex: 1 }}>
        {pdfBase64 ? (
          <PDFExtractorWebView
            pdfBase64={pdfBase64}
            onData={handleDataExtracted}
            onError={handleExtractError}
          />
        ) : null}
        <SafeAreaView style={styles.safe} edges={['top']}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
              <MaterialIcons name="arrow-back" size={24} color={Colors.primary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle} numberOfLines={1}>{pdfName || 'Voley Playa'}</Text>
            <View style={{ width: 44 }} />
          </View>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 }}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={{ fontSize: 14, fontWeight: '600', color: Colors.textMuted }}>Cargando datos...</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <MaterialIcons name="arrow-back" size={24} color={Colors.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>{pdfName || 'Voley Playa'}</Text>
          <View style={{ width: 44 }} />
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 12 }}>
          <MaterialIcons name="error-outline" size={48} color={Colors.textMuted} style={{ opacity: 0.4 }} />
          <Text style={{ fontSize: 15, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center' }}>{error}</Text>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{ marginTop: 12, paddingVertical: 12, paddingHorizontal: 24, backgroundColor: Colors.primary, borderRadius: 12 }}
            activeOpacity={0.8}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Volver</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <MaterialIcons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{pdfName || 'Voley Playa'}</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.tabBar}>
        {TABS.map((tab, index) => {
          const labels = { ranking: 'Clasificación', matches: 'Partidos' };
          const icons = { ranking: 'emoji-events', matches: 'format-list-bulleted' };
          return (
            <TouchableOpacity
              key={tab}
              onPress={() => pagerRef.current?.setPage(index)}
              activeOpacity={0.8}
              style={styles.tab}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <MaterialIcons name={icons[tab]} size={16} color={getTabColor(index)} />
                <Animated.Text style={{ fontSize: 14, fontWeight: '800', color: getTabColor(index) }}>
                  {labels[tab]}
                </Animated.Text>
              </View>
            </TouchableOpacity>
          );
        })}
        <Animated.View style={{
          position: 'absolute', bottom: 0, left: 0,
          width: tabWidth, height: 3,
          backgroundColor: Colors.primary,
          borderTopLeftRadius: 3, borderTopRightRadius: 3,
          transform: [{ translateX: tabIndicatorX }],
        }} />
      </View>

      <View style={styles.searchContainer}>
        <MaterialIcons name="search" size={20} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder={activeTab === 'ranking' ? 'Buscar pareja...' : 'Buscar partido...'}
          placeholderTextColor={Colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 4 }}>
            <MaterialIcons name="close" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.pager}>
        <AnimatedPagerView
          ref={pagerRef}
          style={{ flex: 1 }}
          initialPage={0}
          onPageSelected={(e) => {
            const pos = e.nativeEvent.position;
            if (typeof pos === 'number' && pos >= 0 && pos < TABS.length) {
              setActiveTab(TABS[pos]);
              setSearchQuery('');
              positionAnim.setValue(pos);
              offsetAnim.setValue(0);
            }
          }}
          onPageScroll={onPageScrollHandler}
        >
          <ScrollView key="ranking" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
            {renderRankingTab()}
          </ScrollView>
          <ScrollView key="matches" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
            {renderMatchesTab()}
          </ScrollView>
        </AnimatedPagerView>
      </View>
    </SafeAreaView>
  );
}