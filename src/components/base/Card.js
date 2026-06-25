import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

export default function Card({ children, style, onPress, accent }) {
  const { colors } = useTheme();

  const content = (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        accent && { borderLeftWidth: 3, borderLeftColor: accent },
        style,
      ]}
    >
      {children}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.7} onPress={onPress}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

export function CardSection({ title, children, actionText, onAction }) {
  const { colors } = useTheme();

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{title}</Text>
        {actionText && (
          <TouchableOpacity onPress={onAction}>
            <Text style={[styles.sectionAction, { color: colors.primary }]}>{actionText}</Text>
          </TouchableOpacity>
        )}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  sectionAction: {
    fontSize: 13,
    fontWeight: '600',
  },
});
