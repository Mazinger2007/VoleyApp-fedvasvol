// src/screens/ProfileScreen.js
// Pantalla de Perfil — incluye toggle de tema claro/oscuro.

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, StatusBar, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Spacing, Typography, Radius } from '../styles/theme';
import { useTheme } from '../contexts/ThemeContext';

export default function ProfileScreen() {
  const { colors: Colors, isDark, toggleTheme } = useTheme();

  const styles = useMemo(() => StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: Colors.background,
    },
    headerBar: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: Colors.border,
      backgroundColor: Colors.background,
    },
    headerTitle: {
      color: Colors.textPrimary,
      fontSize: Typography.size.xxl,
      fontWeight: Typography.weight.bold,
      letterSpacing: -0.3,
    },
    content: {
      flex: 1,
      alignItems: 'center',
      paddingTop: Spacing.xxl * 2,
      paddingHorizontal: Spacing.lg,
    },
    avatarWrap: {
      width: 96,
      height: 96,
      borderRadius: Radius.full,
      backgroundColor: Colors.surface,
      borderWidth: 2,
      borderColor: Colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: Spacing.lg,
    },
    avatarEmoji: {
      fontSize: 48,
    },
    name: {
      color: Colors.textPrimary,
      fontSize: Typography.size.xl,
      fontWeight: Typography.weight.bold,
      marginBottom: Spacing.xs,
    },
    subtitle: {
      color: Colors.textMuted,
      fontSize: Typography.size.sm,
      marginBottom: Spacing.xl,
    },
    card: {
      width: '100%',
      backgroundColor: Colors.surface,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: Colors.border,
      padding: Spacing.lg,
      gap: Spacing.md,
    },
    cardRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
    },
    cardRowBetween: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    cardIcon: {
      fontSize: 22,
    },
    cardLabel: {
      color: Colors.textMuted,
      fontSize: Typography.size.xs,
      marginBottom: 2,
    },
    cardValue: {
      color: Colors.textSecondary,
      fontSize: Typography.size.sm,
      fontWeight: Typography.weight.medium,
    },
    divider: {
      height: 1,
      backgroundColor: Colors.border,
    },
    themeLabel: {
      color: Colors.textPrimary,
      fontSize: Typography.size.sm,
      fontWeight: Typography.weight.semiBold,
    },
    themeSub: {
      color: Colors.textMuted,
      fontSize: Typography.size.xs,
      marginTop: 2,
    },
  }), [Colors]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={Colors.background} />

      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>Perfil</Text>
      </View>

      <View style={styles.content}>
        {/* Avatar */}
        <View style={styles.avatarWrap}>
          <Text style={styles.avatarEmoji}>🏐</Text>
        </View>
        <Text style={styles.name}>Aficionado</Text>
        <Text style={styles.subtitle}>Federación Vasca de Voleibol</Text>

        {/* Info card */}
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <Text style={styles.cardIcon}>🌐</Text>
            <View>
              <Text style={styles.cardLabel}>Fuente de datos</Text>
              <Text style={styles.cardValue}>fedvasvol.com</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.cardRow}>
            <Text style={styles.cardIcon}>📱</Text>
            <View>
              <Text style={styles.cardLabel}>Aplicación</Text>
              <Text style={styles.cardValue}>Voley Pro — uso personal</Text>
            </View>
          </View>
          <View style={styles.divider} />
          {/* Theme toggle */}
          <View style={styles.cardRowBetween}>
            <View style={styles.cardRow}>
              <Text style={styles.cardIcon}>{isDark ? '🌙' : '☀️'}</Text>
              <View>
                <Text style={styles.themeLabel}>{isDark ? 'Tema oscuro' : 'Tema claro'}</Text>
                <Text style={styles.themeSub}>Toca para cambiar</Text>
              </View>
            </View>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: '#cbd5e1', true: '#3966ef' }}
              thumbColor={isDark ? '#ffffff' : '#ffffff'}
            />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
