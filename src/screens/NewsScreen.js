import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, StatusBar, StyleSheet, View, FlatList, TouchableOpacity, ActivityIndicator, Image, Modal, TextInput, ScrollView, Platform } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { fetchAndParse, URLS } from '../utils/htmlParser';
import { Spacing } from '../styles/theme';


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
      const blocks = await fetchAndParse(url);
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
  }, [buildUrl]);

  useEffect(() => {
    setIsAppReady(true);
    fetchPosts(1, {});
  }, [setIsAppReady, fetchPosts]);

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
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: {
      backgroundColor: Colors.surface,
      borderTopLeftRadius: 20, borderTopRightRadius: 20,
      paddingBottom: Platform.OS === 'ios' ? 40 : 24,
      maxHeight: '85%',
    },
    modalHeader: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 20, paddingVertical: 16,
      borderBottomWidth: 1, borderBottomColor: Colors.border,
    },
    modalTitle: { fontSize: 17, fontWeight: '900', color: Colors.textPrimary },
    modalClose: { padding: 4 },
    modalScroll: { paddingHorizontal: 20, paddingTop: 16 },
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
    filterApplyBtn: {
      flex: 1, height: 48, borderRadius: 12, backgroundColor: Colors.primary,
      justifyContent: 'center', alignItems: 'center',
    },
    filterApplyText: { color: '#fff', fontWeight: '700', fontSize: 15 },
    filterClearBtn: {
      height: 48, borderRadius: 12, borderWidth: 1, borderColor: Colors.border,
      justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20,
    },
    filterClearText: { color: Colors.textMuted, fontWeight: '600', fontSize: 14 },
    paginationWrap: {
      borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.surface,
      paddingHorizontal: Spacing.md,
    },
  }), [Colors]);

  const renderPost = useCallback(({ item }) => (
    <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={() => handlePostPress(item)}>
      {item.image ? (
        <Image source={{ uri: item.image }} style={styles.cardImage} resizeMode="cover" />
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
        <View style={styles.spacer} />
        <View style={styles.headerTitleContainer}>
          <MaterialIcons name="newspaper" size={20} color={Colors.primary} style={{ marginRight: 8 }} />
          <Text style={styles.headerTitleText}>NOTICIAS</Text>
        </View>
        <TouchableOpacity
          style={{ width: 44, height: 44, justifyContent: 'center', alignItems: 'center' }}
          onPress={() => setShowFilters(true)}
          activeOpacity={0.7}
        >
          <MaterialIcons name="filter-list" size={22} color={hasActiveFilters ? Colors.primary : Colors.textMuted} />
          {hasActiveFilters ? <View style={styles.filterBadge} /> : null}
        </TouchableOpacity>
      </View>
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
          <MaterialIcons name="article" size={64} color={Colors.textMuted} style={{ opacity: 0.3 }} />
          <Text style={styles.emptyText}>No hay publicaciones</Text>
        </View>
      )}
      <Modal visible={showFilters} transparent animationType="slide" onRequestClose={() => setShowFilters(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowFilters(false)}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Filtros</Text>
                <TouchableOpacity style={styles.modalClose} onPress={() => setShowFilters(false)} activeOpacity={0.7}>
                  <MaterialIcons name="close" size={24} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                <Text style={styles.filterLabel}>Fecha (Desde)</Text>
                <TextInput
                  style={styles.filterInput}
                  placeholder="dd/mm/aaaa"
                  placeholderTextColor={Colors.textMuted}
                  value={filters.date_from}
                  onChangeText={(v) => setFilters(f => ({ ...f, date_from: v }))}
                  autoCapitalize="none"
                />
                <Text style={styles.filterLabel}>Fecha (Hasta)</Text>
                <TextInput
                  style={styles.filterInput}
                  placeholder="dd/mm/aaaa"
                  placeholderTextColor={Colors.textMuted}
                  value={filters.date_to}
                  onChangeText={(v) => setFilters(f => ({ ...f, date_to: v }))}
                  autoCapitalize="none"
                />
                {renderFilterSelect('Disciplina', 'discipline', DISCIPLINE_OPTIONS, filters.discipline, (v) => setFilters(f => ({ ...f, discipline: v })))}
                {renderFilterSelect('Destacada', 'featured', FEATURED_OPTIONS, filters.featured, (v) => setFilters(f => ({ ...f, featured: v })))}
                <Text style={styles.filterLabel}>Etiqueta</Text>
                <TextInput
                  style={styles.filterInput}
                  placeholder="– Sin especificar –"
                  placeholderTextColor={Colors.textMuted}
                  value={filters.tag}
                  onChangeText={(v) => setFilters(f => ({ ...f, tag: v }))}
                  autoCapitalize="none"
                />
                <Text style={styles.filterLabel}>Título</Text>
                <TextInput
                  style={styles.filterInput}
                  placeholder="Buscar por título..."
                  placeholderTextColor={Colors.textMuted}
                  value={filters.title}
                  onChangeText={(v) => setFilters(f => ({ ...f, title: v }))}
                  autoCapitalize="none"
                />
              </ScrollView>
              <View style={styles.filterActions}>
                <TouchableOpacity style={styles.filterClearBtn} onPress={handleClearFilters} activeOpacity={0.7}>
                  <Text style={styles.filterClearText}>Limpiar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.filterApplyBtn} onPress={handleApplyFilters} activeOpacity={0.7}>
                  <Text style={styles.filterApplyText}>Filtrar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}
