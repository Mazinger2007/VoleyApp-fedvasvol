// src/screens/CompetitionsScreen.js
// Pantalla de Ligas â€” lista de torneos con bÃºsqueda y filtros.

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import TournamentList from '../components/TournamentList';
import LoadingView from '../components/LoadingView';
import ErrorView from '../components/ErrorView';
import { useFetch } from '../hooks/useFetch';
import { URLS, toTournamentRankingUrl } from '../utils/htmlParser';
import { Spacing, Typography, Radius } from '../styles/theme';
import { useTheme } from '../contexts/ThemeContext';

const FILTERS = [
  { key: 'all', label: 'Todas' },
  { key: 'senior', label: 'Senior' },
  { key: 'junior', label: 'Junior' },
  { key: 'femenino', label: 'Femenino' },
  { key: 'masculino', label: 'Masculino' },
];

export default function CompetitionsScreen({ navigation }) {
  const { colors: Colors } = useTheme();
  const [activeFilter, setActiveFilter] = useState('all');
  const [search, setSearch] = useState('');

  const { blocks, loading, error, refresh } = useFetch(URLS.home);

  const tournamentTable = useMemo(() => {
    const tables = blocks.filter((b) => b.type === 'table');
    return tables[0] || null;
  }, [blocks]);

  // Apply search + filter to the table block rows
  const filteredTable = useMemo(() => {
    if (!tournamentTable) return null;
    const { rows, headers, rowLinks } = tournamentTable;

    const filtered = rows.reduce(
      (acc, row, i) => {
        const namePart = (row[headers.findIndex((h) => h.toLowerCase().includes('nombre'))] || row[0] || '').toLowerCase();
        const catPart = (row[headers.findIndex((h) => h.toLowerCase().includes('categor'))] || '').toLowerCase();
        const sexPart = (row[headers.findIndex((h) => h.toLowerCase().includes('sex') || h.toLowerCase().includes('gÃ©n'))] || '').toLowerCase();
        const allText = `${namePart} ${catPart} ${sexPart}`;

        const matchesSearch = !search.trim() || allText.includes(search.toLowerCase());
        const matchesFilter =
          activeFilter === 'all' ||
          allText.includes(activeFilter.toLowerCase());

        if (matchesSearch && matchesFilter) {
          acc.rows.push(row);
          acc.rowLinks.push(rowLinks?.[i] || null);
        }
        return acc;
      },
      { rows: [], headers, rowLinks: [] }
    );

    return filtered.rows.length > 0 ? filtered : null;
  }, [tournamentTable, search, activeFilter]);

  const handleOpenTournament = (tournament) => {
    if (!tournament?.href) return;
    const rankingUrl = toTournamentRankingUrl(tournament.href);
    navigation.navigate('TournamentDetail', {
      url: rankingUrl,
      title: tournament.name || 'ClasificaciÃ³n y calendario',
      defaultTab: 'ranking',
    });
  };
  const styles = useMemo(() => StyleSheet.create({
    safe: { flex: 1, backgroundColor: Colors.background },
    stickyHeader: {
      backgroundColor: Colors.background,
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: Colors.border,
      gap: Spacing.sm,
    },
    titleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: Spacing.xs,
    },
    title: {
      color: Colors.textPrimary,
      fontSize: Typography.size.xxl,
      fontWeight: Typography.weight.bold,
      letterSpacing: -0.3,
    },
    refreshBtn: {
      width: 38, height: 38, borderRadius: Radius.full,
      backgroundColor: Colors.surfaceAlt,
      justifyContent: 'center', alignItems: 'center',
      borderWidth: 1,
      borderColor: Colors.border,
    },
    refreshIcon: { color: Colors.textSecondary, fontSize: 20, fontWeight: Typography.weight.bold },
    searchBar: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: Colors.surface,
      borderRadius: Radius.xl,
      paddingHorizontal: Spacing.md,
      height: 46, gap: Spacing.sm,
      borderWidth: 1,
      borderColor: Colors.border,
    },
    searchIcon: { fontSize: 16, color: Colors.primary },
    searchInput: { flex: 1, color: Colors.textPrimary, fontSize: Typography.size.md, paddingVertical: 0 },
    chipsScroll: { gap: Spacing.sm, paddingVertical: Spacing.sm },
    chip: {
      paddingHorizontal: Spacing.lg, paddingVertical: 6,
      borderRadius: Radius.full,
      backgroundColor: Colors.surface,
      borderWidth: 1, borderColor: Colors.border,
    },
    chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
    chipText: { color: Colors.textSecondary, fontSize: Typography.size.sm, fontWeight: Typography.weight.medium },
    chipTextActive: { color: Colors.textOnPrimary, fontWeight: Typography.weight.semiBold },
    scroll: { flex: 1, backgroundColor: Colors.background },
    empty: { padding: Spacing.xxl, alignItems: 'center', gap: Spacing.md, marginTop: Spacing.xl },
    emptyIcon: { fontSize: 44 },
    emptyText: { color: Colors.textMuted, fontSize: Typography.size.md, textAlign: 'center' },
  }), [Colors]);
  if (loading) return <LoadingView message="Cargando ligas..." />;
  if (error) return <ErrorView message={error} onRetry={refresh} />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      {/* Sticky header */}
      <View style={styles.stickyHeader}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Ligas</Text>
          <TouchableOpacity style={styles.refreshBtn} onPress={refresh} activeOpacity={0.7}>
            <Text style={styles.refreshIcon}>⟳</Text>
          </TouchableOpacity>
        </View>

        {/* Search bar */}
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar ligas, categorías..."
            placeholderTextColor={Colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        {/* Filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsScroll}
        >
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f.key}
              style={[styles.chip, activeFilter === f.key && styles.chipActive]}
              onPress={() => setActiveFilter(f.key)}
              activeOpacity={0.8}
            >
              <Text style={[styles.chipText, activeFilter === f.key && styles.chipTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* League list */}
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={refresh}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
      >
        {filteredTable ? (
          <TournamentList
            tableBlock={filteredTable}
            onOpenTournament={handleOpenTournament}
          />
        ) : (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>ðŸ”</Text>
            <Text style={styles.emptyText}>
              {search || activeFilter !== 'all'
                ? 'No se encontraron ligas con ese filtro.'
                : 'No hay ligas disponibles.'}
            </Text>
          </View>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}
