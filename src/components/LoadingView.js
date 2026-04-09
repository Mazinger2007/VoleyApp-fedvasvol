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

export default function LoadingView({ message = 'Cargando información...', variant = 'default' }) {
  const { colors: Colors } = useTheme();
  const pulse = useRef(new Animated.Value(1)).current;
  const showBall = variant !== 'clean';

  useEffect(() => {
    if (!showBall) return undefined;
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.3, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    ).start();
    return undefined;
  }, [pulse, showBall]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background, padding: Spacing.xl }}>
      {showBall ? (
        <Animated.Text style={[{ fontSize: 56, marginBottom: Spacing.xl }, { transform: [{ scale: pulse }] }]}>
          🏐
        </Animated.Text>
      ) : null}
      <ActivityIndicator
        size="large"
        color={Colors.primary}
        style={showBall ? { marginBottom: Spacing.lg } : undefined}
      />
      <Text
        style={{
          color: Colors.textSecondary,
          fontSize: variant === 'clean' ? 14 : Typography.size.md,
          fontWeight: variant === 'clean' ? '600' : '500',
          textAlign: 'center',
          marginTop: variant === 'clean' ? 12 : 0,
        }}
      >
        {message}
      </Text>
    </View>
  );
}
