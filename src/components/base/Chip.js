import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

export default function Chip({ label, selected, onPress, icon, style }) {
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? colors.primary : colors.surfaceAlt,
          borderColor: selected ? colors.primary : colors.border,
        },
        style,
      ]}
    >
      {icon && (
        <Text style={[styles.icon, { color: selected ? '#fff' : colors.textMuted }]}>{icon}</Text>
      )}
      <Text
        style={[
          styles.label,
          { color: selected ? '#ffffff' : colors.textSecondary },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    gap: 5,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
  icon: {
    fontSize: 13,
  },
});
