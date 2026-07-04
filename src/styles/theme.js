// src/styles/theme.js
// Compatibility shim — provides Spacing, Radius, Typography, Shadow, Colors
// for existing screens/components. New code should use useTheme() from ThemeContext.

import { Platform } from 'react-native';

export const Colors = {
  primary: '#0f9f7a',
  primaryDark: '#08795e',
  primaryAlpha20: 'rgba(15,159,122,0.20)',
  primaryAlpha15: 'rgba(15,159,122,0.15)',
  primaryAlpha10: 'rgba(15,159,122,0.10)',
  background: '#0b1117',
  surface: '#121b24',
  surfaceAlt: '#1b2630',
  textPrimary: '#f1f5f9',
  textSecondary: '#cbd5e1',
  textMuted: '#94a3b8',
  textOnPrimary: '#ffffff',
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#0d8ff2',
  border: 'rgba(71,85,105,0.55)',
  divider: '#263444',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const Typography = {
  size: {
    xs: 10,
    sm: 12,
    md: 14,
    lg: 16,
    xl: 20,
    xxl: 24,
  },
  weight: {
    regular: '400',
    medium: '500',
    semiBold: '600',
    bold: '700',
    extraBold: '800',
    black: '900',
  },
  family: {
    regular: Platform.OS === 'ios' ? 'System' : 'Roboto',
    medium: Platform.OS === 'ios' ? 'System' : 'Roboto',
    bold: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
};

export const Radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  xxl: 24,
  full: 9999,
};

export const Shadow = {
  sm: Platform.OS === 'web'
    ? { boxShadow: '0 1px 3px rgba(0,0,0,0.12)' }
    : { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.12, shadowRadius: 3, elevation: 2 },
  md: Platform.OS === 'web'
    ? { boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }
    : { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 4 },
  lg: Platform.OS === 'web'
    ? { boxShadow: '0 4px 16px rgba(0,0,0,0.20)' }
    : { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.20, shadowRadius: 16, elevation: 8 },
};
