import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

export default function LiveIndicator({ text }) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.4, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
      ]),
    ).start();
  }, [pulse]);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.dot, { opacity: pulse }]} />
      <Text style={styles.text}>{text || 'EN VIVO'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#DC2626',
  },
  text: {
    fontSize: 10,
    fontWeight: '800',
    color: '#DC2626',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
