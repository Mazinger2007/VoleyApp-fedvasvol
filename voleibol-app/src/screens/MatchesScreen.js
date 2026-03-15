// src/screens/MatchesScreen.js
// Pestaña "Partidos" — muestra la lista de ligas y al pulsar
// abre TournamentDetailScreen directamente en la pestaña Calendario.

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
import { MaterialIcons } from '@expo/vector-icons';

import TournamentList from '../components/TournamentList';
import LoadingView from '../components/LoadingView';
import ErrorView from '../components/ErrorView';
import { useFetch } from '../hooks/useFetch';
import { URLS, toTournamentRankingUrl } from '../utils/htmlParser';
import { Spacing, Typography, Radius } from '../styles/theme';
import { useTheme } from '../contexts/ThemeContext';

const FILTERS = [
  { key: 'all', label: 'Todas' },
  { key: 'junior', label: 'Junior' },
  { key: 'senior', label: 'Senior' },
  { key: 'juvenil', label: 'Juvenil' },
  { key: 'cadete', label: 'Cadete' },
];

export default function MatchesScreen({ navigation }) {
  const { colors: Colors } = useTheme();
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');

  const { blocks, loading, error, refresh } = useFetch(URLS.home);

  const tournamentTable = useMemo(() => {
    const tables = blocks.filter((b) => b.type === 'table');
    return tables[0] || null;
  }, [blocks]);

  const filteredTable = useMemo(() => {
    if (!tournamentTable) return null;
    const { rows, headers, rowLinks } = tournamentTable;
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
        }
        return acc;
      },
      { rows: [], rowLinks: [] }
    );

    return { ...tournamentTable, rows: filtered.rows, rowLinks: filtered.rowLinks };
  }, [tournamentTable, search, activeFilter]);

  const handleOpenLeague = (url, leagueName) => {
    const rankingUrl = toTournamentRankingUrl(url);
    navigation.navigate('TournamentDetail', {
      url: rankingUrl,
      title: leagueName,
      defaultTab: 'ranking',
    });
  };

  const styles = useMemo(() => StyleSheet.create({
    safe: { flex: 1, backgroundColor: Colors.background },
    headerWrap: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.sm,
      backgroundColor: Colors.background,
      borderBottomWidth: 1,
      borderBottomColor: Colors.border,
    },
    topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm + 2 },
    leftGroup: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    iconBtn: { width: 36, height: 36, borderRadius: Radius.full, justifyContent: 'center', alignItems: 'center' },
    notifDot: { position: 'absolute', top: 8, right: 9, width: 8, height: 8, borderRadius: Radius.full, backgroundColor: Colors.primary },
    headerTitle: {
      color: Colors.textPrimary,
      fontSize: Typography.size.xxl,
      fontWeight: Typography.weight.black || Typography.weight.extraBold,
      letterSpacing: -0.5,
    },
    headerSubtitle: { color: Colors.textMuted, fontSize: Typography.size.md, marginBottom: Spacing.md },
    searchBar: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: Colors.surfaceAlt,
      borderRadius: Radius.lg,
      paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
      borderWidth: 1, borderColor: Colors.border,
    },
    searchIcon: { marginRight: Spacing.sm, color: Colors.primary },
    searchInput: { flex: 1, color: Colors.textPrimary, fontSize: Typography.size.md, paddingVertical: 2 },
    clearIcon: { color: Colors.textMuted, fontSize: 15, paddingLeft: Spacing.sm },
    chipsScroll: { gap: Spacing.sm, paddingTop: Spacing.md, paddingBottom: Spacing.xs },
    chip: { paddingHorizontal: Spacing.lg, paddingVertical: 6, borderRadius: Radius.full, backgroundColor: Colors.surfaceAlt },
    chipActive: { backgroundColor: Colors.primary },
    chipText: { color: Colors.textSecondary, fontSize: Typography.size.sm, fontWeight: Typography.weight.semiBold },
    chipTextActive: { color: Colors.textOnPrimary },
    scroll: { flex: 1, backgroundColor: Colors.background },
    emptyWrap: { padding: Spacing.xxxl, alignItems: 'center', gap: Spacing.md },
    emptyText: { color: Colors.textMuted, fontSize: Typography.size.md, textAlign: 'center' },
  }), [Colors]);

  if (loading) return <LoadingView message="Cargando ligas..." />;
  if (error)   return <ErrorView message={error} onRetry={refresh} />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      {/* Header */}
      <View style={styles.headerWrap}>
        <View style={styles.topRow}>
          <View style={styles.leftGroup}>
            <TouchableOpacity
              style={styles.iconBtn}
              activeOpacity={0.8}
              onPress={() => { if (navigation.canGoBack()) navigation.goBack(); }}
            >
              <MaterialIcons name="arrow-back" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Partidos</Text>
          </View>

          <TouchableOpacity style={styles.iconBtn} activeOpacity={0.8}>
            <MaterialIcons name="notifications-none" size={24} color={Colors.textPrimary} />
            <View style={styles.notifDot} />
          </TouchableOpacity>
        </View>

        <Text style={styles.headerSubtitle}>Explora las ligas de voleibol regionales</Text>

        <View style={styles.searchBar}>
          <MaterialIcons name="search" size={20} color={Colors.primary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar ligas, categorías..."
            placeholderTextColor={Colors.textMuted}
            value={search}
            onChangeText={setSearch}
            clearButtonMode="while-editing"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Text style={styles.clearIcon}>✕</Text>
            </TouchableOpacity>
          )}
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
          <TournamentList
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
    </SafeAreaView>
  );
}

