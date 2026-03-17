// src/screens/HomeScreen.js
// Pantalla principal de la app.
// Descarga la portada de la FVV, parsea el HTML y muestra el contenido
// usando BlockRenderer, destacando las noticias y textos relevantes.

import React, { useMemo } from 'react';
import {
  View,
  ScrollView,
  Text,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Header from '../components/Header';
import TournamentList from '../components/TournamentList';
import LoadingView from '../components/LoadingView';
import ErrorView from '../components/ErrorView';
import { useFetch } from '../hooks/useFetch';
import { URLS, toTournamentRankingUrl } from '../utils/htmlParser';
import { Spacing, Typography } from '../styles/theme';
import { useTheme } from '../contexts/ThemeContext';

export default function HomeScreen({ navigation }) {
  const { colors: Colors } = useTheme();
  const { blocks, loading, error, refresh } = useFetch(URLS.home);

  // Home centrada en torneos
  const tournamentTable = useMemo(() => {
    const tables = blocks.filter((b) => b.type === 'table');
    return tables[0] || null;
  }, [blocks]);

  const handleOpenTournament = (tournament) => {
    if (!tournament?.href) return;
    const rankingUrl = toTournamentRankingUrl(tournament.href);
    navigation.navigate('TournamentDetail', {
      url: rankingUrl,
      title: tournament.name || 'Clasificación y calendario',
      defaultTab: 'ranking',
    });
  };

  const styles = useMemo(() => StyleSheet.create({
    safe: { flex: 1, backgroundColor: Colors.background },
    scroll: { flex: 1, backgroundColor: Colors.background },
    content: { paddingBottom: Spacing.xxxl },
    emptyWrap: {
      padding: Spacing.xxl,
      alignItems: 'center',
      gap: Spacing.md,
      marginTop: Spacing.xl,
    },
    emptyIcon: { fontSize: 52 },
    emptyText: {
      color: Colors.textMuted,
      fontSize: Typography.size.md,
      textAlign: 'center',
      lineHeight: 22,
    },
    footer: { padding: Spacing.xl, alignItems: 'center' },
    footerText: { color: Colors.textMuted, fontSize: Typography.size.xs, textAlign: 'center' },
  }), [Colors]);

  // ── Estado de carga ──────────────────────────────────────────────────────
  if (loading) {
    return <LoadingView message="Cargando noticias de la federación..." />;
  }

  // ── Estado de error ──────────────────────────────────────────────────────
  if (error) {
    return <ErrorView message={error} onRetry={refresh} />;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Header
        title="Voley Pro"
        onRefresh={refresh}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
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
        {/* Lista clicable de torneos */}
        {tournamentTable ? (
          <TournamentList
            tableBlock={tournamentTable}
            onOpenTournament={handleOpenTournament}
          />
        ) : (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyIcon}>🏐</Text>
            <Text style={styles.emptyText}>
              No se encontró contenido en la portada.{'\n'}
              Desliza hacia abajo para recargar.
            </Text>
          </View>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Datos de fedvasvol.com · Uso personal
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
