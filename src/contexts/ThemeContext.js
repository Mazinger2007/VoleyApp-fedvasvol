// src/contexts/ThemeContext.js
// Contexto global de tema (claro / oscuro) con transición suave de colores.
// Usa Animated.Value para interpolar colores directamente sin overlay ni flash.

import React, {
  createContext, useContext, useState, useMemo, useEffect, useRef, useCallback,
} from 'react';
import { Animated } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Paleta oscura ────────────────────────────────────────────────────────────
const darkColors = {
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
  successSoft: 'rgba(16,185,129,0.15)',
  warningSoft: 'rgba(245,158,11,0.15)',
  errorSoft: 'rgba(239,68,68,0.15)',

  border: 'rgba(71,85,105,0.55)',
  divider: '#263444',

  tableRowEven: '#17242f',
  tableRowOdd: '#101a22',
  tableHeader: '#0d8ff2',

  medalGold: '#FFD700',
  medalGoldDark: '#B8860B',
  medalSilver: '#C0C0C0',
  medalSilverDark: '#708090',
  medalBronze: '#CD7F32',
  medalBronzeDark: '#8B4513',

  cardBlue: '#1b3a6b',
  cardPurple: '#3b1a5c',
  cardGreen: '#1a4a2e',
  cardRed: '#4a1a1a',
  cardOrange: '#4a2e0a',
  cardTeal: '#0a3a3a',
};

// ─── Paleta clara ─────────────────────────────────────────────────────────────
const lightColors = {
  primary: '#0f9f7a',
  primaryDark: '#08795e',
  primaryAlpha20: 'rgba(15,159,122,0.20)',
  primaryAlpha15: 'rgba(15,159,122,0.15)',
  primaryAlpha10: 'rgba(15,159,122,0.10)',

  background: '#f6f8f7',
  surface: '#ffffff',
  surfaceAlt: '#edf2f0',

  textPrimary: '#0f172a',
  textSecondary: '#334155',
  textMuted: '#64748b',
  textOnPrimary: '#ffffff',

  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#0d8ff2',
  successSoft: 'rgba(16,185,129,0.12)',
  warningSoft: 'rgba(245,158,11,0.12)',
  errorSoft: 'rgba(239,68,68,0.12)',

  border: 'rgba(148,163,184,0.32)',
  divider: '#e6ecf1',

  tableRowEven: '#ffffff',
  tableRowOdd: '#f8fafc',
  tableHeader: '#0d8ff2',

  medalGold: '#FFD700',
  medalGoldDark: '#B8860B',
  medalSilver: '#C0C0C0',
  medalSilverDark: '#708090',
  medalBronze: '#CD7F32',
  medalBronzeDark: '#8B4513',

  cardBlue: '#dbeafe',
  cardPurple: '#ede9fe',
  cardGreen: '#dcfce7',
  cardRed: '#fee2e2',
  cardOrange: '#ffedd5',
  cardTeal: '#ccfbf1',
};

// ─── Colores de Acento ────────────────────────────────────────────────────────
export const ACCENT_COLORS = {
  emerald: { primary: '#0f9f7a', primaryDark: '#08795e' },
  blue: { primary: '#0d8ff2', primaryDark: '#0b76ca' },
  navy: { primary: '#001f3d', primaryDark: '#001224' },
  red: { primary: '#dc2626', primaryDark: '#b91c1c' },
  amber: { primary: '#f59e0b', primaryDark: '#d97706' },
  purple: { primary: '#9333ea', primaryDark: '#7e22ce' },
  tuquoise: { primary: '#14b8a6', primaryDark: '#0d9488' },
};

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ─── Keys a interpolar en transición dark ↔ light ────────────────────────────
// Solo las que cambian entre dark y light (estáticas se copian directas).
const INTERPOLATED_KEYS = [
  'background', 'surface', 'surfaceAlt',
  'textPrimary', 'textSecondary', 'textMuted',
  'border', 'divider',
  'tableRowEven', 'tableRowOdd',
  'cardBlue', 'cardPurple', 'cardGreen', 'cardRed', 'cardOrange', 'cardTeal',
];

const THEME_DURATION = 200; // ms

// ─── Contexto ─────────────────────────────────────────────────────────────────
const ThemeContext = createContext({
  colors: darkColors,
  isDark: false,
  accentKey: 'emerald',
  animColors: {},        // Animated.Value-based color strings (for backgroundColor etc.)
  themeProgress: null,   // Animated.Value 0=light 1=dark
  toggleTheme: () => { },
  changeAccent: () => { },
  isAppReady: false,
  setIsAppReady: () => { },
});

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(false);
  const [accentKey, setAccentKey] = useState('emerald');
  const [isAppReady, setIsAppReady] = useState(false);

  // Animated value: 0 = light, 1 = dark
  const themeProgress = useRef(new Animated.Value(0)).current;
  // We store a ref to the current target so we can read it synchronously
  const isDarkRef = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem('@theme_preference').then((val) => {
      if (val !== null) {
        const dark = val === 'dark';
        setIsDark(dark);
        isDarkRef.current = dark;
        themeProgress.setValue(dark ? 1 : 0);
      }
    });
    AsyncStorage.getItem('@theme_accent').then((val) => {
      if (val !== null) setAccentKey(val);
    });
  }, []);

  const toggleTheme = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      isDarkRef.current = next;
      Animated.timing(themeProgress, {
        toValue: next ? 1 : 0,
        duration: THEME_DURATION,
        useNativeDriver: false, // color interpolation requires JS driver
      }).start();
      AsyncStorage.setItem('@theme_preference', next ? 'dark' : 'light').catch(() => { });
      return next;
    });
  }, [themeProgress]);

  const changeAccent = useCallback((key) => {
    setAccentKey(key);
    AsyncStorage.setItem('@theme_accent', key).catch(() => { });
  }, []);

  // Static colors (instant, for logic / non-animated use)
  const colors = useMemo(() => {
    const base = isDark ? darkColors : lightColors;
    const accent = ACCENT_COLORS[accentKey] || ACCENT_COLORS.blue;
    return {
      ...base,
      primary: accent.primary,
      primaryDark: accent.primaryDark,
      primaryAlpha20: hexToRgba(accent.primary, 0.20),
      primaryAlpha15: hexToRgba(accent.primary, 0.15),
      primaryAlpha10: hexToRgba(accent.primary, 0.10),
    };
  }, [isDark, accentKey]);

  // Animated color strings — interpolated over themeProgress
  // These can be used directly as `backgroundColor`, `color`, etc. on Animated.View/Text
  const animColors = useMemo(() => {
    const accent = ACCENT_COLORS[accentKey] || ACCENT_COLORS.blue;
    const result = {};

    for (const key of INTERPOLATED_KEYS) {
      result[key] = themeProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [lightColors[key], darkColors[key]],
      });
    }

    // Primary color animated (accent change is instant since it can't be smoothly
    // interpolated without knowing previous accent)
    result.primary = accent.primary;
    result.primaryAlpha20 = hexToRgba(accent.primary, 0.20);
    result.primaryAlpha15 = hexToRgba(accent.primary, 0.15);
    result.primaryAlpha10 = hexToRgba(accent.primary, 0.10);

    return result;
  }, [accentKey, themeProgress]);

  const value = useMemo(
    () => ({ colors, isDark, toggleTheme, accentKey, changeAccent, animColors, themeProgress, isAppReady, setIsAppReady }),
    [colors, isDark, accentKey, toggleTheme, changeAccent, animColors, themeProgress, isAppReady],
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
