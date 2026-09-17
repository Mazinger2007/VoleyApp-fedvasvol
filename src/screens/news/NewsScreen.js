import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, StatusBar, StyleSheet, View, FlatList, TouchableOpacity, ActivityIndicator, Image, Modal, TextInput, ScrollView, Platform, Keyboard, Dimensions, Animated, PanResponder, KeyboardAvoidingView } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { fetchAndParse, fetchAndParseCached, URLS } from '../../utils/htmlParser';
import { Spacing, Radius } from '../../styles/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { checkForNewNews } from '../../services/newsNotificationService';
import { downloadImage } from '../../utils/imageUtils';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const RECENT_SEARCHES_KEY = '@news_recent_searches';

const DISCIPLINE_OPTIONS = [
  { value: '', label: '– Sin especificar –' },
  { value: '11', label: 'Voleibol' },
  { value: '35', label: 'Voley playa' },
];

const FEATURED_OPTIONS = [
  { value: '', label: '– Sin especificar –' },
  { value: 'true', label: 'Sí' },
  { value: 'false', label: 'No' },
];


function Pagination({ currentPage, totalPages, onPageChange }) {
  const { colors: Colors } = useTheme();
  const pages = useMemo(() => {
    const result = [];
    const start = Math.max(1, currentPage - 2);
    const end = Math.min(totalPages, currentPage + 2);
    if (start > 1) result.push(1);
    if (start > 2) result.push('...');
    for (let i = start; i <= end; i++) result.push(i);
    if (end < totalPages - 1) result.push('...');
    if (end < totalPages) result.push(totalPages);
    return result;
  }, [currentPage, totalPages]);

  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4, paddingVertical: 16 }}>
      <TouchableOpacity
        onPress={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1}
        style={{ padding: 8, opacity: currentPage <= 1 ? 0.3 : 1 }}
        activeOpacity={0.7}
      >
        <MaterialIcons name="chevron-left" size={20} color={Colors.primary} />
      </TouchableOpacity>
      {pages.map((p, i) => {
        if (p === '...') {
          return <Text key={`dots_${i}`} style={{ color: Colors.textMuted, fontSize: 13, paddingHorizontal: 4 }}>...</Text>;
        }
        const isActive = p === currentPage;
        return (
          <TouchableOpacity
            key={p}
            onPress={() => onPageChange(p)}
            style={{
              width: 32, height: 32, borderRadius: 8,
              backgroundColor: isActive ? Colors.primary : 'transparent',
              justifyContent: 'center', alignItems: 'center',
            }}
            activeOpacity={0.7}
          >
            <Text style={{
              fontSize: 13, fontWeight: isActive ? '900' : '600',
              color: isActive ? '#fff' : Colors.textMuted,
            }}>{p}</Text>
          </TouchableOpacity>
        );
      })}
      <TouchableOpacity
        onPress={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages}
        style={{ padding: 8, opacity: currentPage >= totalPages ? 0.3 : 1 }}
        activeOpacity={0.7}
      >
        <MaterialIcons name="chevron-right" size={20} color={Colors.primary} />
      </TouchableOpacity>
    </View>
  );
}


export default function NewsScreen({ navigation }) {
  const { colors: Colors, isDark, setIsAppReady } = useTheme();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState([]);
  const [zoomImageUrl, setZoomImageUrl] = useState(null);
  const zoomAnim = useRef(new Animated.Value(1)).current;
  const panAnim = useRef(new Animated.ValueXY()).current;
  const scaleRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  const panBaseRef = useRef({ x: 0, y: 0 });
  const lastTapRef = useRef(0);
  const pinchTrackRef = useRef({ active: false, dist: 0, baseScale: 1 });
  const PAN_SENSITIVITY = 1.0;
  const searchInputRef = useRef(null);
  const [filters, setFilters] = useState({
    date_from: '',
    date_to: '',
    discipline: '',
    featured: '',
    tag: '',
    title: '',
  });
  const appliedFilters = useRef({});

  const buildUrl = useCallback((page, filterParams) => {
    const params = new URLSearchParams();
    if (page > 1) params.set('page', page);
    if (filterParams.date_from) params.set('date_from', filterParams.date_from);
    if (filterParams.date_to) params.set('date_to', filterParams.date_to);
    if (filterParams.discipline) params.set('discipline', filterParams.discipline);
    if (filterParams.featured) params.set('featured', filterParams.featured);
    if (filterParams.tag) params.set('tag', filterParams.tag);
    if (filterParams.title) params.set('title', filterParams.title);
    const qs = params.toString();
    return qs ? `${URLS.posts}?${qs}` : URLS.posts;
  }, []);

  const fetchPosts = useCallback(async (page, filterParams) => {
    setLoading(true);
    try {
      const url = buildUrl(page, filterParams);
      // Caché en disco para la primera página sin filtros; el resto va directo a red.
      const useCache = page === 1 && !filterParams.title && !filterParams.date_from && !filterParams.date_to && !filterParams.tag && !filterParams.discipline && !filterParams.featured;
      const blocks = useCache
        ? await fetchAndParseCached(url)
        : await fetchAndParse(url);
      const postsBlock = (blocks || []).find(b => b.type === 'posts');
      const paginationBlock = (blocks || []).find(b => b.type === 'pagination');
      setPosts(postsBlock?.posts || []);
      if (paginationBlock) {
        setTotalPages(paginationBlock.totalPages);
      } else {
        setTotalPages(1);
      }
    } catch (e) {
      console.warn('[NewsScreen] Error:', e.message);
      setPosts([]);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
    if (page === 1 && !filterParams.title && !filterParams.date_from) {
      checkForNewNews();
    }
  }, [buildUrl]);

  useEffect(() => {
    setIsAppReady(true);
    fetchPosts(1, {});
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(RECENT_SEARCHES_KEY);
        if (saved) setRecentSearches(JSON.parse(saved));
      } catch {}
    })();
  }, [setIsAppReady, fetchPosts]);

  const applySearch = useCallback((query) => {
    const newFilters = { ...appliedFilters.current };
    if (query) newFilters.title = query;
    else delete newFilters.title;
    appliedFilters.current = newFilters;
    setCurrentPage(1);
    fetchPosts(1, appliedFilters.current);
  }, [fetchPosts]);

  const handleSearchChange = useCallback((text) => {
    setSearchQuery(text);
  }, []);

  const saveRecentSearch = useCallback((query) => {
    if (!query.trim()) return;
    const updated = [query, ...recentSearches.filter(s => s !== query)].slice(0, 8);
    setRecentSearches(updated);
    try {
      AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    } catch {}
  }, [recentSearches]);

  const handleSearchSubmit = useCallback(() => {
    const query = searchQuery.trim();
    if (!query) {
      Keyboard.dismiss();
      setShowSearch(false);
      return;
    }
    applySearch(query);
    saveRecentSearch(query);
    Keyboard.dismiss();
    setShowSearch(false);
  }, [applySearch, saveRecentSearch, searchQuery]);

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    applySearch('');
  }, [applySearch]);

  const getDistance = useCallback((touches) => {
    if (!touches || touches.length < 2) return 0;
    const dx = touches[0].pageX - touches[1].pageX;
    const dy = touches[0].pageY - touches[1].pageY;
    return Math.sqrt(dx * dx + dy * dy);
  }, []);

  const getTouchCenter = useCallback((touches) => {
    if (!touches || touches.length < 2) return { x: 0, y: 0 };
    return {
      x: (touches[0].pageX + touches[1].pageX) / 2,
      y: (touches[0].pageY + touches[1].pageY) / 2,
    };
  }, []);

  const zoomPanResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (e, g) => {
      return scaleRef.current > 1 || e.nativeEvent.touches?.length >= 2 || g.numberActiveTouches >= 2;
    },
    onStartShouldSetPanResponderCapture: () => false,
    onMoveShouldSetPanResponderCapture: (e, g) => {
      return scaleRef.current > 1 || e.nativeEvent.touches?.length >= 2 || g.numberActiveTouches >= 2;
    },
    onPanResponderGrant: (e) => {
      const touches = e.nativeEvent.touches;
      if (touches && touches.length >= 2) {
        const dist = getDistance(touches);
        const center = getTouchCenter(touches);
        pinchTrackRef.current = { active: true, dist, baseScale: scaleRef.current, center };
      } else {
        pinchTrackRef.current.active = false;
      }
      panBaseRef.current = { x: panRef.current.x, y: panRef.current.y };
    },
    onPanResponderMove: (e, gestureState) => {
      const touches = e.nativeEvent.touches;
      const multi = (touches?.length >= 2) || gestureState.numberActiveTouches >= 2;
      
      if (multi) {
        if (touches && touches.length >= 2) {
          const dist = getDistance(touches);
          if (dist > 0) {
            if (!pinchTrackRef.current.active) {
              const center = getTouchCenter(touches);
              pinchTrackRef.current = { active: true, dist, baseScale: scaleRef.current, center };
              panBaseRef.current = { x: panRef.current.x, y: panRef.current.y };
            } else {
              const ratio = dist / pinchTrackRef.current.dist;
              const newScale = Math.max(1, Math.min(6, pinchTrackRef.current.baseScale * ratio));
              scaleRef.current = newScale;
              zoomAnim.setValue(newScale);

              const center = getTouchCenter(touches);
              const dx = center.x - pinchTrackRef.current.center.x;
              const dy = center.y - pinchTrackRef.current.center.y;

              const maxPx = (SCREEN_WIDTH * (newScale - 1)) / 2;
              const maxPy = Math.max(0, (SCREEN_HEIGHT * 0.8 * newScale - SCREEN_HEIGHT) / 2);
              let tx = panBaseRef.current.x + dx;
              let ty = panBaseRef.current.y + dy;
              tx = Math.max(-maxPx, Math.min(maxPx, tx));
              ty = Math.max(-maxPy, Math.min(maxPy, ty));

              panRef.current = { x: tx, y: ty };
              panAnim.setValue({ x: tx, y: ty });
            }
          }
        }
      } else {
        if (pinchTrackRef.current.active) {
          pinchTrackRef.current.active = false;
          panBaseRef.current = { x: panRef.current.x, y: panRef.current.y };
        }
        
        if (scaleRef.current > 1) {
          const s = scaleRef.current;
          const maxPx = (SCREEN_WIDTH * (s - 1)) / 2;
          const maxPy = Math.max(0, (SCREEN_HEIGHT * 0.8 * s - SCREEN_HEIGHT) / 2);
          
          let tx = panBaseRef.current.x + gestureState.dx;
          let ty = panBaseRef.current.y + gestureState.dy;
          tx = Math.max(-maxPx, Math.min(maxPx, tx));
          ty = Math.max(-maxPy, Math.min(maxPy, ty));

          panRef.current = { x: tx, y: ty };
          panAnim.setValue({ x: tx, y: ty });
        }
      }
    },
    onPanResponderRelease: () => {
      pinchTrackRef.current.active = false;
      const s = scaleRef.current;
      if (s < 1.05) {
        scaleRef.current = 1;
        panRef.current = { x: 0, y: 0 };
        panBaseRef.current = { x: 0, y: 0 };
        Animated.parallel([
          Animated.spring(zoomAnim, { toValue: 1, useNativeDriver: true, tension: 60, friction: 8 }),
          Animated.spring(panAnim, { toValue: { x: 0, y: 0 }, useNativeDriver: true, tension: 60, friction: 8 }),
        ]).start();
      } else if (s > 6) {
        scaleRef.current = 6;
        Animated.spring(zoomAnim, { toValue: 6, useNativeDriver: true, tension: 60, friction: 8 }).start();
        panBaseRef.current = { x: panRef.current.x, y: panRef.current.y };
      } else {
        panBaseRef.current = { x: panRef.current.x, y: panRef.current.y };
      }
    },
  })).current;

  const handleImageDoubleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      if (scaleRef.current > 1.5) {
        scaleRef.current = 1;
        panRef.current = { x: 0, y: 0 };
        panBaseRef.current = { x: 0, y: 0 };
        Animated.parallel([
          Animated.spring(zoomAnim, { toValue: 1, useNativeDriver: true, tension: 60, friction: 8 }),
          Animated.spring(panAnim, { toValue: { x: 0, y: 0 }, useNativeDriver: true, tension: 60, friction: 8 }),
        ]).start();
      } else {
        scaleRef.current = 2.5;
        Animated.spring(zoomAnim, { toValue: 2.5, useNativeDriver: true, tension: 60, friction: 8 }).start();
      }
    }
    lastTapRef.current = now;
  }, []);

  const closeZoom = useCallback(() => {
    scaleRef.current = 1;
    panRef.current = { x: 0, y: 0 };
    panBaseRef.current = { x: 0, y: 0 };
    zoomAnim.setValue(1);
    panAnim.setValue({ x: 0, y: 0 });
    setZoomImageUrl(null);
  }, [zoomAnim, panAnim]);

  const openSearch = useCallback(() => {
    setShowSearch(true);
    setTimeout(() => searchInputRef.current?.focus(), 100);
  }, []);

  const handlePageChange = useCallback((page) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    fetchPosts(page, appliedFilters.current);
  }, [totalPages, fetchPosts]);

  const handleApplyFilters = useCallback(() => {
    appliedFilters.current = { ...filters };
    setCurrentPage(1);
    setShowFilters(false);
    fetchPosts(1, appliedFilters.current);
  }, [filters, fetchPosts]);

  const handleClearFilters = useCallback(() => {
    const empty = { date_from: '', date_to: '', discipline: '', featured: '', tag: '', title: '' };
    setFilters(empty);
    appliedFilters.current = {};
    setCurrentPage(1);
    setShowFilters(false);
    fetchPosts(1, {});
  }, [fetchPosts]);

  const hasActiveFilters = useMemo(() => {
    return Object.values(appliedFilters.current).some(v => v !== '');
  }, [appliedFilters.current]);

  const handlePostPress = useCallback((post) => {
    navigation.push('PostDetail', { postUrl: post.href, postTitle: post.title });
  }, [navigation]);

  const styles = useMemo(() => StyleSheet.create({
    safe: { flex: 1, backgroundColor: Colors.background },
    header: {
      height: 64,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 8,
      backgroundColor: Colors.surface,
      borderBottomColor: Colors.border,
      borderBottomWidth: 1,
    },
    headerTitleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      justifyContent: 'center',
    },
    headerTitleText: { fontSize: 16, fontWeight: '900', letterSpacing: -0.5, color: Colors.primary },
    spacer: { width: 44 },
    filterBadge: {
      position: 'absolute', top: 4, right: 4,
      width: 10, height: 10, borderRadius: 5,
      backgroundColor: '#ef4444',
    },
    list: { flex: 1, padding: Spacing.md },
    card: {
      backgroundColor: Colors.surface,
      borderRadius: 16,
      marginBottom: Spacing.md,
      borderWidth: 1,
      borderColor: Colors.border,
      overflow: 'hidden',
    },
    cardImage: { width: '100%', height: 200, backgroundColor: Colors.background },
    cardBody: { padding: Spacing.lg },
    featuredBadge: {
      alignSelf: 'flex-start',
      backgroundColor: '#f59e0b',
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: 6,
      marginBottom: Spacing.sm,
    },
    featuredText: { color: '#fff', fontSize: 11, fontWeight: '700' },
    cardTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary, lineHeight: 22, marginBottom: Spacing.sm },
    cardExcerpt: { fontSize: 13, color: Colors.textMuted, lineHeight: 18, marginBottom: Spacing.md },
    cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    cardDate: { fontSize: 12, color: Colors.textMuted },
    readMore: { fontSize: 13, fontWeight: '700', color: Colors.primary },
    loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
    emptyText: { color: Colors.textMuted, fontSize: 16, fontWeight: '500', textAlign: 'center' },
    filterLabel: { fontSize: 12, fontWeight: '700', color: Colors.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
    filterInput: {
      backgroundColor: Colors.background,
      borderRadius: 10, borderWidth: 1, borderColor: Colors.border,
      paddingHorizontal: 12, height: 44, fontSize: 14, color: Colors.textPrimary,
      marginBottom: 16,
    },
    filterPicker: {
      backgroundColor: Colors.background,
      borderRadius: 10, borderWidth: 1, borderColor: Colors.border,
      marginBottom: 16, overflow: 'hidden',
    },
    filterOption: {
      paddingHorizontal: 12, height: 44,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      borderBottomWidth: 0.5, borderBottomColor: Colors.border,
    },
    filterOptionText: { fontSize: 14, color: Colors.textPrimary },
    filterOptionSelected: { color: Colors.primary, fontWeight: '700' },
    filterActions: {
      flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16,
    },
    filterClearBtn: {
      height: 48, borderRadius: 12, borderWidth: 1, borderColor: Colors.border,
      justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20,
    },
    filterClearText: { color: Colors.textMuted, fontWeight: '600', fontSize: 14 },
    paginationWrap: {
      borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.surface,
      paddingHorizontal: Spacing.md,
    },
    centeredModalWrapper: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
    premiumSearchCard: {
      width: '100%',
      maxWidth: 400,
      borderRadius: Radius.xxl,
      padding: Spacing.lg,
      overflow: 'hidden',
      elevation: 10,
      ...(Platform.OS === 'web'
        ? { boxShadow: '0 10px 20px rgba(0,0,0,0.1)' }
        : { shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20 }
      ),
    },
    searchModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
    searchModalTitle: { fontSize: 20, fontWeight: 'bold' },
    searchModalBody: { maxHeight: 500 },
    searchFilterPill: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border },
    searchModalBtn: { height: 54, borderRadius: Radius.xl, justifyContent: 'center', alignItems: 'center', marginTop: Spacing.md },
    searchModalBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold', letterSpacing: 0.5 },
    zoomOverlay: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
    zoomClose: { position: 'absolute', top: 50, right: 20, zIndex: 10, padding: 8 },
    zoomDownload: { position: 'absolute', top: 50, left: 20, zIndex: 10, padding: 8 },
    zoomBody: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    zoomImage: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT * 0.8 },

    searchKav: { flex: 1, justifyContent: 'center' },
    searchOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.78)' },
    searchOverlayBg: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.94)' },
    searchModalInner: { paddingHorizontal: 20, paddingBottom: 20 },
    searchCard: {
      borderRadius: 24, padding: 20,
      shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.15, shadowRadius: 24, elevation: 12,
    },
    searchCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
    searchCardHeaderIcon: {
      width: 36, height: 36, borderRadius: 12,
      alignItems: 'center', justifyContent: 'center',
    },
    searchCardTitle: { fontSize: 18, fontWeight: '800', flex: 1 },
    searchCardClose: {
      width: 32, height: 32, borderRadius: 10,
      alignItems: 'center', justifyContent: 'center',
    },
    headerSearchInput: {
      flex: 1, flexDirection: 'row', alignItems: 'center',
      borderRadius: 10, paddingHorizontal: 10, height: 36,
    },
    headerSearchText: { flex: 1, fontSize: 15, fontWeight: '400', paddingVertical: 0 },
    recentBar: {
      paddingVertical: 10, borderBottomWidth: 1,
    },
    recentChip: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      borderRadius: 18, paddingHorizontal: 14, paddingVertical: 7,
    },
    recentChipText: { fontSize: 13, fontWeight: '500' },
    searchClearBtn: { padding: 4 },
    searchSubmitBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      borderRadius: 14, height: 50, marginTop: 4,
    },
    searchSubmitText: { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },
  }), [Colors]);

  const renderPost = useCallback(({ item }) => (
    <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={() => handlePostPress(item)}>
      {item.image ? (
        <TouchableOpacity activeOpacity={0.9} onPress={() => setZoomImageUrl(item.image)}>
          <Image source={{ uri: item.image }} style={styles.cardImage} resizeMode="cover" />
        </TouchableOpacity>
      ) : null}
      <View style={styles.cardBody}>
        {item.featured ? (
          <View style={styles.featuredBadge}>
            <Text style={styles.featuredText}>DESTACADA</Text>
          </View>
        ) : null}
        <Text style={styles.cardTitle} numberOfLines={3}>{item.title}</Text>
        {item.excerpt ? (
          <Text style={styles.cardExcerpt} numberOfLines={3}>{item.excerpt}</Text>
        ) : null}
        <View style={styles.cardFooter}>
          <Text style={styles.cardDate}>{item.date}</Text>
          <Text style={styles.readMore}>Leer más →</Text>
        </View>
      </View>
    </TouchableOpacity>
  ), [styles, handlePostPress]);

  const renderFilterSelect = (label, fieldName, options, currentValue, onSelect) => (
    <View>
      <Text style={styles.filterLabel}>{label}</Text>
      <View style={styles.filterPicker}>
        {options.map((opt, i) => (
          <TouchableOpacity
            key={`${fieldName}_${opt.value}`}
            style={[
              styles.filterOption,
              i === options.length - 1 && { borderBottomWidth: 0 },
            ]}
            onPress={() => onSelect(opt.value)}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterOptionText, currentValue === opt.value && styles.filterOptionSelected]}>
              {opt.label}
            </Text>
            {currentValue === opt.value ? (
              <MaterialIcons name="check" size={18} color={Colors.primary} />
            ) : null}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={Colors.background} />
      <View style={styles.header}>
        {showSearch ? (
          <>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 }}>
              <View style={[styles.headerSearchInput, { backgroundColor: Colors.surfaceAlt }]}>
                <MaterialIcons name="search" size={18} color={Colors.textMuted} style={{ marginRight: 6 }} />
                <TextInput
                  ref={searchInputRef}
                  style={[styles.headerSearchText, { color: Colors.textPrimary }]}
                  placeholder="Buscar noticias..."
                  placeholderTextColor={Colors.textMuted}
                  value={searchQuery}
                  onChangeText={handleSearchChange}
                  onSubmitEditing={handleSearchSubmit}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="search"
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={handleClearSearch} style={{ padding: 4 }}>
                    <MaterialIcons name="close" size={18} color={Colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>
              <TouchableOpacity
                onPress={() => { setShowSearch(false); handleClearSearch(); }}
                style={{ paddingLeft: 8, paddingRight: 4 }}
                activeOpacity={0.7}
              >
                <Text style={{ color: Colors.primary, fontWeight: '600', fontSize: 15 }}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <TouchableOpacity
              style={{ width: 44, height: 44, justifyContent: 'center', alignItems: 'center' }}
              onPress={() => setShowFilters(true)}
              activeOpacity={0.7}
            >
              <MaterialIcons name="filter-list" size={22} color={hasActiveFilters ? Colors.primary : Colors.textMuted} />
              {hasActiveFilters ? <View style={styles.filterBadge} /> : null}
            </TouchableOpacity>
            <View style={styles.headerTitleContainer}>
              <MaterialIcons name="newspaper" size={20} color={Colors.primary} style={{ marginRight: 8 }} />
              <Text style={styles.headerTitleText}>NOTICIAS</Text>
            </View>
            <TouchableOpacity
              style={{ width: 44, height: 44, justifyContent: 'center', alignItems: 'center' }}
              onPress={openSearch}
              activeOpacity={0.7}
            >
              <MaterialIcons name="search" size={22} color={Colors.textMuted} />
            </TouchableOpacity>
          </>
        )}
      </View>

      {showSearch && !searchQuery && recentSearches.length > 0 ? (
        <View style={[styles.recentBar, { backgroundColor: Colors.surface, borderBottomColor: Colors.border }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}>
            {recentSearches.map((s, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.recentChip, { backgroundColor: Colors.surfaceAlt }]}
                onPress={() => { setSearchQuery(s); applySearch(s); saveRecentSearch(s); Keyboard.dismiss(); setShowSearch(false); }}
                activeOpacity={0.7}
              >
                <MaterialIcons name="history" size={14} color={Colors.textMuted} />
                <Text style={[styles.recentChipText, { color: Colors.textSecondary }]}>{s}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      ) : null}
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : posts.length > 0 ? (
        <>
          <FlatList
            data={posts}
            renderItem={renderPost}
            keyExtractor={(item, i) => `${item.href}_${i}`}
            style={styles.list}
            contentContainerStyle={{ paddingBottom: 8 }}
          />
          <View style={styles.paginationWrap}>
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={handlePageChange} />
          </View>
        </>
      ) : (
        <View style={styles.emptyWrap}>
          <MaterialIcons name="newspaper" size={64} color={Colors.textMuted} style={{ opacity: 0.3 }} />
          <Text style={styles.emptyText}>No hay publicaciones</Text>
        </View>
      )}
      <Modal visible={showFilters} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setShowFilters(false)}>
        <View style={styles.searchOverlay}>
          <TouchableOpacity style={styles.searchOverlayBg} onPress={() => setShowFilters(false)} activeOpacity={1} />
          <KeyboardAvoidingView
            style={styles.searchKav}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={0}
          >
            <View style={styles.searchModalInner}>
              <View style={[styles.searchCard, { backgroundColor: Colors.surface }]}>
                <View style={styles.searchCardHeader}>
                  <View style={[styles.searchCardHeaderIcon, { backgroundColor: Colors.primaryAlpha15 }]}>
                    <MaterialIcons name="filter-list" size={20} color={Colors.primary} />
                  </View>
                  <Text style={[styles.searchCardTitle, { color: Colors.textPrimary }]}>Filtros</Text>
                  <TouchableOpacity onPress={() => setShowFilters(false)} style={[styles.searchCardClose, { backgroundColor: Colors.surfaceAlt }]}>
                    <MaterialIcons name="close" size={18} color={Colors.textMuted} />
                  </TouchableOpacity>
                </View>

                <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  <Text style={[styles.filterLabel, { color: Colors.textSecondary }]}>Fecha (Desde)</Text>
                  <TextInput
                    style={[styles.filterInput, { backgroundColor: Colors.surfaceAlt, borderColor: Colors.border, color: Colors.textPrimary }]}
                    placeholder="dd/mm/aaaa"
                    placeholderTextColor={Colors.textMuted}
                    value={filters.date_from}
                    onChangeText={(v) => setFilters(f => ({ ...f, date_from: v }))}
                    autoCapitalize="none"
                  />
                  <Text style={[styles.filterLabel, { color: Colors.textSecondary }]}>Fecha (Hasta)</Text>
                  <TextInput
                    style={[styles.filterInput, { backgroundColor: Colors.surfaceAlt, borderColor: Colors.border, color: Colors.textPrimary }]}
                    placeholder="dd/mm/aaaa"
                    placeholderTextColor={Colors.textMuted}
                    value={filters.date_to}
                    onChangeText={(v) => setFilters(f => ({ ...f, date_to: v }))}
                    autoCapitalize="none"
                  />
                  {renderFilterSelect('Disciplina', 'discipline', DISCIPLINE_OPTIONS, filters.discipline, (v) => setFilters(f => ({ ...f, discipline: v })))}
                  {renderFilterSelect('Destacada', 'featured', FEATURED_OPTIONS, filters.featured, (v) => setFilters(f => ({ ...f, featured: v })))}
                  <Text style={[styles.filterLabel, { color: Colors.textSecondary }]}>Etiqueta</Text>
                  <TextInput
                    style={[styles.filterInput, { backgroundColor: Colors.surfaceAlt, borderColor: Colors.border, color: Colors.textPrimary }]}
                    placeholder="– Sin especificar –"
                    placeholderTextColor={Colors.textMuted}
                    value={filters.tag}
                    onChangeText={(v) => setFilters(f => ({ ...f, tag: v }))}
                    autoCapitalize="none"
                  />
                  <Text style={[styles.filterLabel, { color: Colors.textSecondary }]}>Título</Text>
                  <TextInput
                    style={[styles.filterInput, { backgroundColor: Colors.surfaceAlt, borderColor: Colors.border, color: Colors.textPrimary }]}
                    placeholder="Buscar por título..."
                    placeholderTextColor={Colors.textMuted}
                    value={filters.title}
                    onChangeText={(v) => setFilters(f => ({ ...f, title: v }))}
                    autoCapitalize="none"
                  />
                </ScrollView>

                <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                  <TouchableOpacity
                    style={[styles.searchClearBtn, { backgroundColor: Colors.surfaceAlt, borderRadius: 12, height: 46, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 18 }]}
                    onPress={handleClearFilters} activeOpacity={0.7}
                  >
                    <Text style={{ color: Colors.textMuted, fontWeight: '600', fontSize: 14 }}>Limpiar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.searchSubmitBtn, { flex: 1, marginTop: 0 }]}
                    onPress={handleApplyFilters} activeOpacity={0.85}
                  >
                    <MaterialIcons name="check" size={18} color="#fff" />
                    <Text style={styles.searchSubmitText}>FILTRAR</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal visible={zoomImageUrl !== null} transparent animationType="fade" statusBarTranslucent onRequestClose={closeZoom}>
        <View style={styles.zoomOverlay} {...zoomPanResponder.panHandlers}>
          <TouchableOpacity style={styles.zoomClose} onPress={closeZoom} activeOpacity={0.7}>
            <MaterialIcons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.zoomDownload} onPress={() => downloadImage(zoomImageUrl)} activeOpacity={0.7}>
            <MaterialIcons name="file-download" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={1} onPress={handleImageDoubleTap} style={styles.zoomBody}>
            <Animated.Image
              source={{ uri: zoomImageUrl }}
              style={[styles.zoomImage, {
                transform: [
                  { translateX: panAnim.x },
                  { translateY: panAnim.y },
                  { scale: zoomAnim },
                ],
              }]}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
