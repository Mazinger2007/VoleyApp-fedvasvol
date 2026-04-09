// src/components/ErrorView.js
// Pantalla de error con opción de reintentar la carga.

import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Spacing, Typography, Radius } from '../styles/theme';
import { useTheme } from '../contexts/ThemeContext';

/**
 * @param {string}   message  - Mensaje de error a mostrar
 * @param {function} onRetry  - Callback para reintentar
 */
export default function ErrorView({ message, onRetry }) {
  const { colors: Colors } = useTheme();

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background, padding: Spacing.xxl },
    icon: { fontSize: 52, marginBottom: Spacing.lg },
    title: { color: Colors.textPrimary, fontSize: Typography.size.xl, fontWeight: Typography.weight.bold, marginBottom: Spacing.sm, textAlign: 'center' },
    message: { color: Colors.textSecondary, fontSize: Typography.size.md, textAlign: 'center', marginBottom: Spacing.xl, lineHeight: 22 },
    button: { backgroundColor: Colors.primary, paddingVertical: Spacing.md, paddingHorizontal: Spacing.xxl, borderRadius: Radius.full },
    buttonText: { color: Colors.textOnPrimary, fontSize: Typography.size.md, fontWeight: Typography.weight.semiBold },
  }), [Colors]);

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>⚠️</Text>
      <Text style={styles.title}>No se pudo cargar</Text>
      <Text style={styles.message}>{message}</Text>
      {onRetry && (
        <TouchableOpacity style={styles.button} onPress={onRetry}>
          <Text style={styles.buttonText}>Reintentar</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
