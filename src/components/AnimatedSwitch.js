import React, { useRef, useEffect } from 'react';
import { Animated, TouchableOpacity, StyleSheet, Platform } from 'react-native';

const TRACK_WIDTH = 48;
const TRACK_HEIGHT = 28;
const THUMB_SIZE = 22;
const THUMB_MARGIN = 3;
const THUMB_OFF = THUMB_MARGIN;
const THUMB_ON = TRACK_WIDTH - THUMB_SIZE - THUMB_MARGIN;

export default function AnimatedSwitch({ value, onValueChange, trackColor, thumbColor = '#ffffff' }) {
  const translateX = useRef(new Animated.Value(value ? THUMB_ON : THUMB_OFF)).current;
  const bgColor = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateX, {
        toValue: value ? THUMB_ON : THUMB_OFF,
        useNativeDriver: true,
        stiffness: 300,
        damping: 20,
        mass: 0.5,
      }),
      Animated.timing(bgColor, {
        toValue: value ? 1 : 0,
        duration: 200,
        useNativeDriver: false,
      }),
    ]).start();
  }, [value, translateX, bgColor]);

  const bgInterpolated = bgColor.interpolate({
    inputRange: [0, 1],
    outputRange: [trackColor?.false || '#e2e8f0', trackColor?.true || '#3b82f6'],
  });

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => onValueChange?.(!value)}
      style={styles.wrapper}
    >
      <Animated.View
        style={[
          styles.track,
          { backgroundColor: bgInterpolated },
        ]}
      >
        <Animated.View
          style={[
            styles.thumb,
            {
              backgroundColor: thumbColor,
              transform: [{ translateX }],
            },
          ]}
        />
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    padding: 4,
  },
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    ...(Platform.OS !== 'web' ? {
      shadowColor: '#000',
      shadowOpacity: 0.2,
      shadowRadius: 3,
      shadowOffset: { width: 0, height: 1 },
    } : {
      boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
    }),
    elevation: 3,
  },
});
