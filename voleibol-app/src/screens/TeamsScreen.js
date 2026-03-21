// src/screens/TeamsScreen.js
// Pestaña "Equipos" — lista las ligas disponibles.
// Al pulsar una liga navega a TournamentDetailScreen en la pestaña
// Clasificación, donde cada equipo es tappable → TeamDetailScreen.

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

import CompetitionList from '../components/CompetitionList';
import LoadingView from '../components/LoadingView';
import ErrorView from '../components/ErrorView';
import { useFetch } from '../hooks/useFetch';
import { URLS } from '../utils/htmlParser';
import { openTournamentDetail } from '../utils/navigationHelper';
import { Spacing, Typography, Radius } from '../styles/theme';
import { useTheme } from '../contexts/ThemeContext';

export default function TeamsScreen({ navigation }) {
  const { colors: Colors } = useTheme();
  const [search, setSearch] = useState('');

  const { blocks, loading, error, refresh } = useFetch(URLS.home);

  const tournamentTable = useMemo(() => {
    const tables = blocks.filter((b) => b.type === 'table');
    return tables[0] || null;
  }, [blocks]);

  const filteredTable = useMemo(() => {
    if (!tournamentTable) return null;
    if (!search.trim()) return tournamentTable;

    const { rows, headers, rowLinks } = tournamentTable;
    const q = search.toLowerCase();

    const filtered = rows.reduce(
      (acc, row, i) => {
        if (row.join(' ').toLowerCase().includes(q)) {
          acc.rows.push(row);
          acc.rowLinks.push(rowLinks?.[i] || null);
        }
        return acc;
      },
      { rows: [], rowLinks: [] }
    );

    return { ...tournamentTable, rows: filtered.rows, rowLinks: filtered.rowLinks };
  }, [tournamentTable, search]);

  const handleOpenLeague = (url, leagueName) => {
    openTournamentDetail(navigation, { href: url, name: leagueName });
  };

  const styles = useMemo(() => StyleSheet.create({
    safe: { flex: 1, backgroundColor: Colors.primary },
    headerWrap: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.sm,
      backgroundColor: Colors.primary,
    },
    headerTitle: {
      color: Colors.textOnPrimary,
      fontSize: Typography.size.xxl,
      fontWeight: Typography.weight.black || Typography.weight.extraBold,
      letterSpacing: -0.5,
    },
    headerSubtitle: { color: 'rgba(255,255,255,0.75)', fontSize: Typography.size.sm, marginTop: 2 },
    searchBar: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: Colors.surface,
      marginHorizontal: Spacing.lg,
      marginTop: Spacing.sm, marginBottom: Spacing.xs,
      borderRadius: Radius.lg,
      paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
      borderWidth: 1, borderColor: Colors.border,
    },
    searchIcon: { fontSize: 15, marginRight: Spacing.sm },
    searchInput: { flex: 1, color: Colors.textPrimary, fontSize: Typography.size.md, paddingVertical: 2 },
    clearIcon: { color: Colors.textMuted, fontSize: 13, paddingLeft: Spacing.sm },
    counter: { color: 'rgba(255,255,255,0.7)', fontSize: Typography.size.xs, marginHorizontal: Spacing.lg, marginBottom: Spacing.sm },
    scroll: { flex: 1, backgroundColor: Colors.background, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl },
    emptyWrap: { padding: Spacing.xxxl, alignItems: 'center', gap: Spacing.md },
    emptyIcon: { fontSize: 44 },
    emptyText: { color: Colors.textMuted, fontSize: Typography.size.md, textAlign: 'center' },
  }), [Colors]);

  if (loading) return <LoadingView message="Cargando ligas y torneos..." />;
  if (error)   return <ErrorView message={error} onRetry={refresh} />;

  const count = filteredTable?.rows?.length ?? 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      <View style={styles.headerWrap}>
        <Text style={styles.headerTitle}>Equipos</Text>
        <Text style={styles.headerSubtitle}>Selecciona una liga para ver clasificación</Text>
      </View>

      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar liga..."
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

      <Text style={styles.counter}>
        {count} liga{count !== 1 ? 's' : ''}
        {search ? ` · "${search}"` : ' · pulsa una para ver sus equipos'}
      </Text>

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
            <Text style={styles.emptyIcon}>👥</Text>
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

