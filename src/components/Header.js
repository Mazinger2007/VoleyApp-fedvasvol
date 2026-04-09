// src/components/Header.js
// Barra de cabecera adaptable: título principal, botón atrás y/o refresh.

import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import { Spacing, Typography, Radius } from '../styles/theme';
import { useTheme } from '../contexts/ThemeContext';

/**
 * @param {string}    title       - Título principal
 * @param {boolean}   showBack    - Muestra botón de retroceso
 * @param {function}  onBack      - Callback del botón atrás
 * @param {function}  onRefresh   - Callback del botón de actualizar
 * @param {boolean}   centerTitle - Centra el título (cuando hay botón atrás)
 */
export default function Header({ title, showBack = false, onBack, onRefresh, centerTitle = false }) {
  const { colors: Colors, isDark } = useTheme();

  const styles = useMemo(() => StyleSheet.create({
    container: {
      backgroundColor: Colors.background,
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.lg,
      paddingBottom: Spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: Colors.border,
    },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    title: { flex: 1, color: Colors.textPrimary, fontSize: Typography.size.xxl, fontWeight: Typography.weight.bold, letterSpacing: -0.3 },
    titleCenter: { textAlign: 'center', fontSize: Typography.size.lg },
    iconBtn: { width: 38, height: 38, borderRadius: Radius.full, backgroundColor: Colors.surfaceAlt, justifyContent: 'center', alignItems: 'center' },
    iconPlaceholder: { width: 38 },
    iconSymbol: { color: Colors.primary, fontSize: 22, fontWeight: Typography.weight.bold, lineHeight: 26, textAlign: 'center' },
  }), [Colors]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={Colors.background} />
      <View style={styles.row}>
        {showBack ? (
          <TouchableOpacity style={styles.iconBtn} onPress={onBack} activeOpacity={0.7}>
            <Text style={styles.iconSymbol}>‹</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.iconPlaceholder} />
        )}

        <Text
          style={[styles.title, (showBack || centerTitle) && styles.titleCenter]}
          numberOfLines={1}
        >
          {title}
        </Text>

        {onRefresh ? (
          <TouchableOpacity style={styles.iconBtn} onPress={onRefresh} activeOpacity={0.7}>
            <Text style={styles.iconSymbol}>⟳</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.iconPlaceholder} />
        )}
      </View>
    </View>
  );
}
