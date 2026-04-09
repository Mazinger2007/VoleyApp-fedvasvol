// src/components/Card.js
// Tarjeta genérica con sombra y bordes redondeados.
// Se usa como contenedor para cualquier bloque de contenido.

import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Spacing, Radius, Shadow } from '../styles/theme';
import { useTheme } from '../contexts/ThemeContext';

export default function Card({ children, style, elevation = 'md' }) {
  const { colors: Colors } = useTheme();
  const shadowStyle = Shadow[elevation] || Shadow.md;

  const cardStyle = useMemo(() => ({
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginVertical: Spacing.sm,
    marginHorizontal: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  }), [Colors]);

  return (
    <View style={[cardStyle, shadowStyle, style]}>
      {children}
    </View>
  );
}
