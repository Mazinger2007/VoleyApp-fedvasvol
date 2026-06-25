import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

export default function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  style,
}) {
  const { colors } = useTheme();

  const isPrimary = variant === 'primary';
  const isGhost = variant === 'ghost';

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.button,
        isPrimary && { backgroundColor: colors.primary },
        !isPrimary && !isGhost && {
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          borderColor: colors.primary,
        },
        isGhost && { backgroundColor: 'transparent' },
        size === 'lg' && styles.lg,
        size === 'sm' && styles.sm,
        (disabled || loading) && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={isPrimary ? '#fff' : colors.primary} />
      ) : (
        <>
          {icon && <Text style={styles.icon}>{icon}</Text>}
          <Text
            style={[
              styles.text,
              isPrimary && { color: '#ffffff' },
              !isPrimary && !isGhost && { color: colors.primary },
              isGhost && { color: colors.primary },
              size === 'lg' && styles.textLg,
              size === 'sm' && styles.textSm,
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  lg: {
    paddingVertical: 16,
    borderRadius: 14,
  },
  sm: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    fontSize: 15,
    fontWeight: '700',
  },
  textLg: {
    fontSize: 17,
  },
  textSm: {
    fontSize: 13,
  },
  icon: {
    fontSize: 16,
  },
});
