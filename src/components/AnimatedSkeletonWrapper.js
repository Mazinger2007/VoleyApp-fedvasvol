import React, { useEffect, useRef } from 'react';
import { Animated } from 'react-native';

export default function AnimatedSkeletonWrapper({ loading, skeleton, children, duration = 350 }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const prevLoading = useRef(loading);

  useEffect(() => {
    if (!loading && prevLoading.current) {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.92);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 9,
          tension: 40,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (loading) {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.92);
    }
    prevLoading.current = loading;
  }, [loading]);

  if (loading) {
    return skeleton || null;
  }

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ scale: scaleAnim }] }}>
      {children}
    </Animated.View>
  );
}
