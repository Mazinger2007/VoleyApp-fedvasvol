import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const VARIANTS = {
  live: { bg: '#DC2626', text: '#FFFFFF', icon: null },
  featured: { bg: '#F59E0B', text: '#FFFFFF', icon: '⭐' },
  win: { bg: '#10B981', text: '#FFFFFF', icon: null },
  loss: { bg: '#EF4444', text: '#FFFFFF', icon: null },
  info: { bg: '#0D8FF2', text: '#FFFFFF', icon: null },
  neutral: { bg: '#6B7280', text: '#FFFFFF', icon: null },
  upcoming: { bg: 'rgba(107,114,128,0.15)', text: '#6B7280', icon: null },
};

export default function Badge({ label, variant = 'info', size = 'sm', style }) {
  const v = VARIANTS[variant] || VARIANTS.info;
  const isSmall = size === 'sm';

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: v.bg },
        isSmall ? styles.sm : styles.md,
        style,
      ]}
    >
      {v.icon && <Text style={[styles.icon, isSmall && styles.iconSm]}>{v.icon}</Text>}
      <Text
        style={[styles.text, { color: v.text }, isSmall ? styles.textSm : styles.textMd]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  sm: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 3,
  },
  md: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 4,
  },
  text: {
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  textSm: {
    fontSize: 9,
    letterSpacing: 0.5,
  },
  textMd: {
    fontSize: 11,
    letterSpacing: 0.5,
  },
  icon: {
    fontSize: 10,
  },
  iconSm: {
    fontSize: 8,
  },
});
