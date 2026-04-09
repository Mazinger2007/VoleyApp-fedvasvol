// src/styles/theme.js
// Sistema de diseño global: colores, tipografía, espaciado, sombras
// Modifica estos valores para cambiar el aspecto de toda la app
import { Platform } from 'react-native';


export const Colors = {
  primary: '#059669',
  primaryDark: '#047857',
  primaryAlpha20: 'rgba(5,150,105,0.20)',
  primaryAlpha15: 'rgba(5,150,105,0.15)',
  primaryAlpha10: 'rgba(5,150,105,0.10)',

  // Fondos — dark theme
  background: '#101a22',
  surface: '#17242f',
  surfaceAlt: '#1f2e3b',

  // Texto
  textPrimary: '#f1f5f9',
  textSecondary: '#cbd5e1',
  textMuted: '#94a3b8',
  textOnPrimary: '#ffffff',

  // Estado
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#0d8ff2',
  successSoft: 'rgba(16,185,129,0.15)',
  warningSoft: 'rgba(245,158,11,0.15)',
  errorSoft: 'rgba(239,68,68,0.15)',

  // Bordes y separadores
  border: 'rgba(71,85,105,0.55)',
  divider: '#263444',

  // Tabla alternada
  tableRowEven: '#17242f',
  tableRowOdd: '#101a22',
  tableHeader: '#0d8ff2',

  // Medallas
  medalGold: '#FFD700',
  medalGoldDark: '#B8860B',
  medalSilver: '#C0C0C0',
  medalSilverDark: '#708090',
  medalBronze: '#CD7F32',
  medalBronzeDark: '#8B4513',

  // Paleta de colores para tarjetas de ligas (cover)
  cardBlue: '#1b3a6b',
  cardPurple: '#3b1a5c',
  cardGreen: '#1a4a2e',
  cardRed: '#4a1a1a',
  cardOrange: '#4a2e0a',
  cardTeal: '#0a3a3a',
};

export const Typography = {
  // Fuentes (Expo usa las del sistema)
  fontFamily: {
    regular: undefined,   // System default
    medium: undefined,
    bold: undefined,
  },

  // Tamaños
  size: {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 17,
    xl: 20,
    xxl: 24,
    xxxl: 30,
  },

  // Pesos
  weight: {
    regular: '400',
    medium: '500',
    semiBold: '600',
    bold: '700',
    extraBold: '800',
    black: '900',
  },

  // Altura de línea
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.8,
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

export const Radius = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
  xxl: 32,
  full: 9999,
};

export const Shadow = {
  sm: {
    ...(Platform.OS !== 'web' && {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
    }),
    elevation: 2,
    ...(Platform.OS === 'web' && { boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }),
  },
  md: {
    ...(Platform.OS !== 'web' && {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.12,
      shadowRadius: 10,
    }),
    elevation: 4,
    ...(Platform.OS === 'web' && { boxShadow: '0 3px 10px rgba(0,0,0,0.12)' }),
  },
  lg: {
    ...(Platform.OS !== 'web' && {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.14,
      shadowRadius: 16,
    }),
    elevation: 8,
    ...(Platform.OS === 'web' && { boxShadow: '0 6px 16px rgba(0,0,0,0.14)' }),
  },
};
