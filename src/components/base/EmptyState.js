import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';

export default function EmptyState({ icon, title, message, action }) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <View style={[styles.iconCircle, { backgroundColor: colors.surfaceAlt }]}>
        <MaterialIcons name={icon || 'inbox'} size={40} color={colors.textMuted} />
      </View>
      <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
      {message && (
        <Text style={[styles.message, { color: colors.textMuted }]}>{message}</Text>
      )}
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
    gap: 12,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
