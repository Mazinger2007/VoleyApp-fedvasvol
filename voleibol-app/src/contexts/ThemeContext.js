// src/contexts/ThemeContext.js
// Contexto global de tema (claro / oscuro).
// Usar useTheme() en cualquier componente para acceder a colors + toggleTheme.

import React, { createContext, useContext, useState, useMemo } from 'react';

// ─── Paleta oscura (por defecto) ─────────────────────────────────────────────
const darkColors = {
  primary: '#0d8ff2',
  primaryDark: '#0b76ca',
  primaryAlpha20: 'rgba(13,143,242,0.20)',
  primaryAlpha15: 'rgba(13,143,242,0.15)',
  primaryAlpha10: 'rgba(13,143,242,0.10)',

  background: '#101a22',
  surface: '#17242f',
  surfaceAlt: '#1f2e3b',

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

// ─── Paleta clara ────────────────────────────────────────────────────────────
const lightColors = {
  primary: '#0d8ff2',
  primaryDark: '#0b76ca',
  primaryAlpha20: 'rgba(13,143,242,0.20)',
  primaryAlpha15: 'rgba(13,143,242,0.15)',
  primaryAlpha10: 'rgba(13,143,242,0.10)',

  background: '#f5f7f8',
  surface: '#ffffff',
  surfaceAlt: '#eef2f4',

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

// ─── Contexto ─────────────────────────────────────────────────────────────────
const ThemeContext = createContext({
  colors: darkColors,
  isDark: true,
  toggleTheme: () => {},
});

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(true);

  const toggleTheme = () => setIsDark((prev) => !prev);

  const colors = useMemo(() => (isDark ? darkColors : lightColors), [isDark]);

  const value = useMemo(() => ({ colors, isDark, toggleTheme }), [colors, isDark]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
