// src/screens/HomeScreen.js
// Pantalla principal de la app.
// Descarga la portada de la FVV, parsea el HTML y muestra el contenido
// usando BlockRenderer, destacando las noticias y textos relevantes.
// CAMBIO CRÍTICO: No renderiza NADA hasta que TODAS las ligas estén listas (isAppReady).

import React, { useMemo, useState, useCallback, useEffect } from 'react';
import {
  View,
  ScrollView,
  Text,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Header from '../components/Header';
import CompetitionList from '../components/CompetitionList';
import LoadingView from '../components/LoadingView';
import ErrorView from '../components/ErrorView';
import { useFetch } from '../hooks/useFetch';
import { URLS } from '../utils/htmlParser';
import { openTournamentDetail } from '../utils/navigationHelper';
import { Spacing, Typography } from '../styles/theme';
import { useTheme } from '../contexts/ThemeContext';

export default function HomeScreen({ navigation }) {
  const { colors: Colors } = useTheme();
  const { blocks, loading, error, refresh } = useFetch(URLS.home);

  // ── Estado global de carga: NO renderizar NADA hasta que todo esté listo ──
  const [isAppReady, setIsAppReady] = useState(false);

  const handleReady = useCallback(() => {
    setIsAppReady(true);
  }, []);

  const tournamentTable = useMemo(() => {
    const tables = blocks.filter((b) => b.type === 'table');
    return tables[0] || null;
  }, [blocks]);

  const handleOpenTournament = useCallback((url, name, tipo) => {
    if (tipo === 'torneo') {
      openTournamentDetail(navigation, { href: url, name, isTorneo: true });
    } else {
      openTournamentDetail(navigation, { href: url, name });
    }
  }, [navigation]);

  // Si la carga terminó y no hay ligas (error o vacío), desbloquear loader
  useEffect(() => {
    if (!loading && !tournamentTable && !isAppReady) {
      setIsAppReady(true);
    }
  }, [loading, tournamentTable, isAppReady]);

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

  // ── Estado de error ──────────────────────────────────────────────────────
  if (error && !isAppReady) {
    return <ErrorView message={error} onRetry={refresh} />;
  }

  // ── Pantalla de carga completa: antes de que todo esté listo, no mostramos NADA ──
  if (!isAppReady) {
    return (
      <SafeAreaView style={[styles.safe, { justifyContent: 'center', alignItems: 'center' }]} edges={['top']}>
        {/* Cargamos las CompetitionList en background (ocultas) para poblar el cache */}
        <View style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', height: 0, overflow: 'hidden' }}>
          {tournamentTable && (
            <CompetitionList
              tableBlock={tournamentTable}
              onOpenTournament={handleOpenTournament}
              onReady={handleReady}
            />
          )}
        </View>
        <LoadingView message={loading ? "Descargando temporada..." : "Preparando ligas..."} />
      </SafeAreaView>
    );
  }

  // ── App lista: renderizar TODO de golpe ──────────────────────────────────
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
          <CompetitionList
            tableBlock={tournamentTable}
            onOpenTournament={handleOpenTournament}
            onReady={handleReady}
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
