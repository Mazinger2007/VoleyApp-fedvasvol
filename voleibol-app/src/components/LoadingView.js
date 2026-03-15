// src/components/LoadingView.js
// Pantalla de carga que aparece mientras se descarga el contenido.

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  Animated,
} from 'react-native';
import { Spacing, Typography } from '../styles/theme';
import { useTheme } from '../contexts/ThemeContext';

export default function LoadingView({ message = 'Cargando información...' }) {
  const { colors: Colors } = useTheme();
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.3, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, [pulse]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background, padding: Spacing.xl }}>
      <Animated.Text style={[{ fontSize: 56, marginBottom: Spacing.xl }, { transform: [{ scale: pulse }] }]}>
        🏐
      </Animated.Text>
      <ActivityIndicator size="large" color={Colors.primary} style={{ marginBottom: Spacing.lg }} />
      <Text style={{ color: Colors.textSecondary, fontSize: Typography.size.md, textAlign: 'center' }}>{message}</Text>
    </View>
  );
}
