// src/screens/MatchesScreen.js
// Pestaña "Partidos" — muestra la lista de ligas y al pulsar
// abre TournamentDetailScreen directamente en la pestaña Calendario.

import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  StatusBar,
  Modal,
  Animated,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';

import CompetitionList from '../components/CompetitionList';
import LoadingView from '../components/LoadingView';
import ErrorView from '../components/ErrorView';
import { useFetch } from '../hooks/useFetch';
import { URLS } from '../utils/htmlParser';
import { openTournamentDetail } from '../utils/navigationHelper';
import { Spacing, Typography, Radius } from '../styles/theme';
import { useTheme } from '../contexts/ThemeContext';

const FILTERS = [
  { key: 'all', label: 'Todas' },
  { key: 'senior', label: 'Senior' },
  { key: 'junior', label: 'Junior' },
  { key: 'cadete', label: 'Cadete' },
  { key: 'playa', label: 'Voley Playa' },
];

export default function MatchesScreen({ navigation }) {
  const { colors: Colors, isDark } = useTheme();
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedSeason, setSelectedSeason] = useState(null);
  const [availableSeasons, setAvailableSeasons] = useState([]);
  const [showSeasons, setShowSeasons] = useState(false);
  const slideAnim = useRef(new Animated.Value(500)).current;

  useEffect(() => {
    if (showSeasons) {
      slideAnim.setValue(500);
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, speed: 20, bounciness: 0 }).start();
    }
  }, [showSeasons, slideAnim]);

  const fetchUrl = useMemo(() => {
    if (!selectedSeason) return URLS.home;
    return `${URLS.home}?season=${selectedSeason}`;
  }, [selectedSeason]);

  const { blocks, loading, error, refresh } = useFetch(fetchUrl);

  const tournamentTable = useMemo(() => {
    // Extract seasons metadata if present
    const seasonsBlock = blocks.find(b => b.type === 'seasons');
    if (seasonsBlock && availableSeasons.length === 0) {
      setAvailableSeasons(seasonsBlock.items);
      if (!selectedSeason) setSelectedSeason(seasonsBlock.current);
    }

    const tables = blocks.filter((b) => b.type === 'table');
    return tables[0] || null;
  }, [blocks]);

  const filteredTable = useMemo(() => {
    if (!tournamentTable) return null;
    const { rows, headers, rowLinks, rowLogos, rowImages } = tournamentTable;
    const q = search.toLowerCase().trim();

    const categoryIdx = headers.findIndex((h) => /categor/i.test(h));
    const sexIdx = headers.findIndex((h) => /sexo|género|genero/i.test(h));

    const filtered = rows.reduce(
      (acc, row, i) => {
        const text = row.join(' ').toLowerCase();
        const category = (categoryIdx >= 0 ? row[categoryIdx] : '')?.toLowerCase() || '';
        const sex = (sexIdx >= 0 ? row[sexIdx] : '')?.toLowerCase() || '';
        const matchesSearch = !q || text.includes(q);
        const matchesFilter = activeFilter === 'all' || `${text} ${category} ${sex}`.includes(activeFilter);

        if (matchesSearch && matchesFilter) {
          acc.rows.push(row);
          acc.rowLinks.push(rowLinks?.[i] || null);
          acc.rowLogos.push(rowLogos?.[i] || null);
          acc.rowImages.push(rowImages?.[i] || null);
        }
        return acc;
      },
      { rows: [], rowLinks: [], rowLogos: [], rowImages: [] }
    );

    return {
      ...tournamentTable,
      rows: filtered.rows,
      rowLinks: filtered.rowLinks,
      rowLogos: filtered.rowLogos,
      rowImages: filtered.rowImages
    };
  }, [tournamentTable, search, activeFilter]);

  const handleOpenLeague = (url, leagueName) => {
    openTournamentDetail(navigation, { href: url, name: leagueName }, {
      season: selectedSeason,
    });
  };

  const styles = useMemo(() => StyleSheet.create({
    safe: { flex: 1, backgroundColor: isDark ? '#0f1923' : '#f5f7f9' },
    headerWrap: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.lg,
      paddingBottom: Spacing.sm,
      backgroundColor: isDark ? 'rgba(15,25,35,0.8)' : 'rgba(255,255,255,0.8)',
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(13,143,242,0.1)',
    },
    topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
    leftGroup: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    headerTitle: {
      color: isDark ? '#f1f5f9' : Colors.primary,
      fontSize: 20,
      fontWeight: 'bold',
      letterSpacing: -0.5,
    },
    calendarBtn: {
      width: 40, height: 40, borderRadius: Radius.md,
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(13,143,242,0.1)',
      justifyContent: 'center', alignItems: 'center',
      elevation: 2,
    },
    chipsScroll: { gap: Spacing.sm, paddingBottom: Spacing.md },
    chip: {
      height: 36,
      paddingHorizontal: 20,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: Radius.full,
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderWidth: 1,
      borderColor: 'rgba(13,143,242,0.1)',
    },
    chipActive: {
      backgroundColor: Colors.primary,
      borderColor: Colors.primary,
    },
    chipText: {
      color: isDark ? '#cbd5e1' : '#475569',
      fontSize: 14,
      fontWeight: '500',
    },
    chipTextActive: {
      color: '#ffffff',
    },
    scroll: { flex: 1, backgroundColor: isDark ? '#0f1923' : '#f5f7f9' },
    emptyWrap: { padding: Spacing.xxxl, alignItems: 'center', gap: Spacing.md },
    emptyText: { color: Colors.textMuted, fontSize: Typography.size.md, textAlign: 'center' },

    // Modal Styles
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    modalContent: {
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderTopLeftRadius: 32,
      borderTopRightRadius: 32,
      padding: 24,
      paddingBottom: 48,
      elevation: 20,
      ...(Platform.OS !== 'web' ? {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
      } : {
        boxShadow: '0 -10px 20px rgba(0,0,0,0.1)'
      })
    },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', color: isDark ? '#f1f5f9' : '#0f172a' },
    modalCloseBtn: { padding: 8, backgroundColor: isDark ? '#334155' : '#f1f5f9', borderRadius: 20 },
    seasonBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingVertical: 16,
      borderRadius: 16,
      borderWidth: 2, borderColor: 'transparent',
      backgroundColor: isDark ? '#334155' : '#f8fafc',
      marginBottom: 12,
    },
    seasonBtnActive: {
      borderColor: Colors.primary,
      backgroundColor: isDark ? 'rgba(13,143,242,0.1)' : '#eff6ff',
    },
    seasonText: { fontSize: 16, fontWeight: '500', color: isDark ? '#cbd5e1' : '#334155' },
    seasonTextActive: { fontWeight: '600', color: Colors.primary },
    seasonRadio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: isDark ? '#64748b' : '#cbd5e1' },
    seasonRadioActive: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: Colors.primary, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
    modalConfirmBtn: {
      marginTop: 24,
      backgroundColor: Colors.primary,
      paddingVertical: 16,
      borderRadius: 16,
      alignItems: 'center',
      elevation: 4,
      ...(Platform.OS !== 'web' ? {
        shadowColor: Colors.primary,
        shadowOpacity: 0.3,
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 10,
      } : {
        boxShadow: `0 4px 10px ${Colors.primary}4D`
      })
    },
    modalConfirmText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
  }), [Colors, isDark]);

  if (loading) return <LoadingView message="Cargando ligas y torneos..." />;
  if (error) return <ErrorView message={error} onRetry={refresh} />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      {/* Header */}
      <View style={styles.headerWrap}>
        <View style={styles.topRow}>
          <View style={styles.leftGroup}>
            <Text style={styles.headerTitle}><Text style={{ fontWeight: 'bold' }}>Ligas</Text></Text>
          </View>

          <TouchableOpacity style={styles.calendarBtn} activeOpacity={0.8} onPress={() => setShowSeasons(!showSeasons)}>
            <MaterialIcons name="calendar-month" size={24} color={isDark ? '#e2e8f0' : Colors.primary} />
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f.key}
              style={[styles.chip, activeFilter === f.key && styles.chipActive]}
              activeOpacity={0.85}
              onPress={() => setActiveFilter(f.key)}
            >
              <Text style={[styles.chipText, activeFilter === f.key && styles.chipTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        style={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={refresh}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {filteredTable ? (
          <CompetitionList
            tableBlock={filteredTable}
            onOpenTournament={handleOpenLeague}
          />
        ) : (
          <View style={styles.emptyWrap}>
            <MaterialIcons name="search-off" size={44} color={Colors.textMuted} />
            <Text style={styles.emptyText}>
              {search ? 'Sin resultados para tu búsqueda.' : 'No se encontraron ligas.'}
            </Text>
          </View>
        )}
        <View style={{ height: Spacing.xxxl }} />
      </ScrollView>

      {/* Modal Selecting Season */}
      <Modal visible={showSeasons} transparent animationType="fade" onRequestClose={() => setShowSeasons(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShowSeasons(false)} />
          <Animated.View style={[styles.modalContent, { transform: [{ translateY: slideAnim }] }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Seleccionar Temporada</Text>
              <TouchableOpacity onPress={() => setShowSeasons(false)} style={styles.modalCloseBtn}>
                <MaterialIcons name="close" size={20} color={isDark ? '#cbd5e1' : '#64748b'} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 350 }} showsVerticalScrollIndicator={false}>
              {availableSeasons.map(s => {
                const isSelected = selectedSeason === s.value;
                return (
                  <TouchableOpacity key={s.value} onPress={() => { setSelectedSeason(s.value); setShowSeasons(false); }} activeOpacity={0.8}
                    style={[
                      styles.seasonBtn,
                      isSelected ? styles.seasonBtnActive : {}
                    ]}>
                    <Text style={[styles.seasonText, isSelected ? styles.seasonTextActive : {}]}>{s.label}</Text>
                    {isSelected ? (
                      <View style={styles.seasonRadioActive}>
                        <MaterialIcons name="check" size={14} color="#ffffff" />
                      </View>
                    ) : (
                      <View style={styles.seasonRadio} />
                    )}
                  </TouchableOpacity>
                )
              })}
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}
