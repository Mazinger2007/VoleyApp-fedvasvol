import React, { useRef, useCallback } from 'react';
import { Animated, Image, Dimensions, StyleSheet } from 'react-native';
import {
  PinchGestureHandler,
  PanGestureHandler,
  TapGestureHandler,
  State,
} from 'react-native-gesture-handler';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const IMG_HEIGHT = SCREEN_HEIGHT * 0.88;
const MIN_SCALE = 1;
const MAX_SCALE = 6;
const DOUBLE_TAP_ZOOM = 2.8;

let baseScale = 1;
let basePanX = 0;
let basePanY = 0;
let pinchFocalX = 0;
let pinchFocalY = 0;

export default function ZoomableImage({ uri, style, resizeMode = 'contain', children, ...props }) {
  const scale = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const scaleRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  const panHandlerRef = useRef(null);
  const tapHandlerRef = useRef(null);

  const getMaxPan = useCallback((s) => ({
    maxPx: Math.max(0, (SCREEN_WIDTH * (s - 1)) / 2),
    maxPy: Math.max(0, (IMG_HEIGHT * (s - 1)) / 2),
  }), []);

  const clamp = useCallback((val, min, max) => Math.max(min, Math.min(max, val)), []);

  const applyPan = useCallback((tx, ty, s) => {
    const { maxPx, maxPy } = getMaxPan(s);
    const clampedX = clamp(tx, -maxPx, maxPx);
    const clampedY = clamp(ty, -maxPy, maxPy);
    panRef.current = { x: clampedX, y: clampedY };
    translateX.setValue(clampedX);
    translateY.setValue(clampedY);
  }, [getMaxPan, clamp, translateX, translateY]);

  const resetAnimated = useCallback((animated) => {
    scaleRef.current = 1;
    panRef.current = { x: 0, y: 0 };
    if (animated) {
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 80, friction: 9 }),
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true, tension: 80, friction: 9 }),
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 9 }),
      ]).start();
    } else {
      scale.setValue(1);
      translateX.setValue(0);
      translateY.setValue(0);
    }
  }, [scale, translateX, translateY]);

  const onPinchEvent = useCallback(({ nativeEvent }) => {
    const newScale = clamp(baseScale * nativeEvent.scale, MIN_SCALE, MAX_SCALE);
    scaleRef.current = newScale;
    scale.setValue(newScale);

    const factor = newScale / Math.max(baseScale, 0.01);
    const cx = SCREEN_WIDTH / 2;
    const cy = SCREEN_HEIGHT / 2;
    const tx = basePanX * factor + (pinchFocalX - cx) * (1 - factor);
    const ty = basePanY * factor + (pinchFocalY - cy) * (1 - factor);
    applyPan(tx, ty, newScale);
  }, [clamp, applyPan]);

  const onPinchStateChange = useCallback(({ nativeEvent }) => {
    if (nativeEvent.state === State.BEGAN) {
      baseScale = scaleRef.current;
      basePanX = panRef.current.x;
      basePanY = panRef.current.y;
      pinchFocalX = nativeEvent.focalX;
      pinchFocalY = nativeEvent.focalY;
    } else if (nativeEvent.state === State.END || nativeEvent.state === State.CANCELLED || nativeEvent.state === State.FAILED) {
      if (scaleRef.current < MIN_SCALE + 0.05) {
        resetAnimated(true);
      }
    }
  }, [resetAnimated]);

  const onPanEvent = useCallback(({ nativeEvent }) => {
    if (scaleRef.current > MIN_SCALE + 0.02) {
      const newTx = basePanX + nativeEvent.translationX;
      const newTy = basePanY + nativeEvent.translationY;
      applyPan(newTx, newTy, scaleRef.current);
    }
  }, [applyPan]);

  const onPanStateChange = useCallback(({ nativeEvent }) => {
    if (nativeEvent.state === State.BEGAN) {
      basePanX = panRef.current.x;
      basePanY = panRef.current.y;
    }
  }, []);

  const onDoubleTap = useCallback(({ nativeEvent }) => {
    if (nativeEvent.state === State.ACTIVE) {
      if (scaleRef.current > MIN_SCALE + 0.1) {
        resetAnimated(true);
      } else {
        const targetScale = DOUBLE_TAP_ZOOM;
        scaleRef.current = targetScale;
        const cx = SCREEN_WIDTH / 2;
        const cy = SCREEN_HEIGHT / 2;
        const tx = clamp((cx - nativeEvent.x) * (targetScale - 1) / targetScale, -(SCREEN_WIDTH * (targetScale - 1)) / 2, (SCREEN_WIDTH * (targetScale - 1)) / 2);
        const ty = clamp((cy - nativeEvent.y) * (targetScale - 1) / targetScale, -(IMG_HEIGHT * (targetScale - 1)) / 2, (IMG_HEIGHT * (targetScale - 1)) / 2);
        panRef.current = { x: tx, y: ty };
        Animated.parallel([
          Animated.spring(scale, { toValue: targetScale, useNativeDriver: true, tension: 70, friction: 8 }),
          Animated.spring(translateX, { toValue: tx, useNativeDriver: true, tension: 70, friction: 8 }),
          Animated.spring(translateY, { toValue: ty, useNativeDriver: true, tension: 70, friction: 8 }),
        ]).start();
      }
    }
  }, [clamp, resetAnimated, scale, translateX, translateY]);

  return (
    <PinchGestureHandler
      onGestureEvent={onPinchEvent}
      onHandlerStateChange={onPinchStateChange}
    >
      <Animated.View style={styles.wrapper}>
        <PanGestureHandler
          ref={panHandlerRef}
          minDist={5}
          onGestureEvent={onPanEvent}
          onHandlerStateChange={onPanStateChange}
        >
          <TapGestureHandler
            ref={tapHandlerRef}
            numberOfTaps={2}
            onHandlerStateChange={onDoubleTap}
          >
            <Animated.View
              style={[
                styles.imageWrapper,
                {
                  transform: [
                    { translateX },
                    { translateY },
                    { scale },
                  ],
                },
              ]}
            >
              {children ? children : (
                <Image
                  source={{ uri }}
                  style={[styles.image, style]}
                  resizeMode={resizeMode}
                  {...props}
                />
              )}
            </Animated.View>
          </TapGestureHandler>
        </PanGestureHandler>
      </Animated.View>
    </PinchGestureHandler>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: SCREEN_WIDTH,
    height: IMG_HEIGHT,
  },
});
