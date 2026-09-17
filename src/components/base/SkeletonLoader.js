import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Easing } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

export default function SkeletonLoader({ width, height, borderRadius, style }) {
  const { colors } = useTheme();
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 800, easing: Easing.ease, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 800, easing: Easing.ease, useNativeDriver: true }),
      ]),
    ).start();
  }, [shimmer]);

  const opacity = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [0.25, 0.65],
  });

  return (
    <Animated.View
      style={[
        {
          width: width || '100%',
          height: height || 16,
          borderRadius: borderRadius || 8,
          backgroundColor: colors.surfaceAlt,
          opacity,
        },
        style,
      ]}
    />
  );
}

export function SkeletonCard({ count = 3 }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 12 }}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <SkeletonLoader height={14} width="60%" />
          <SkeletonLoader height={12} width="40%" />
          <View style={styles.row}>
            <SkeletonLoader height={12} width="25%" />
            <SkeletonLoader height={12} width="20%" />
          </View>
        </View>
      ))}
    </View>
  );
}

export function SkeletonMatchCard() {
  const { colors } = useTheme();
  return (
    <View style={[styles.matchCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <SkeletonLoader height={12} width="50%" />
      <View style={styles.matchRow}>
        <SkeletonLoader height={14} width="35%" />
        <SkeletonLoader height={20} width={60} borderRadius={6} />
        <SkeletonLoader height={14} width="35%" />
      </View>
      <SkeletonLoader height={10} width="30%" />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  matchCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 10,
    alignItems: 'center',
  },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
});
