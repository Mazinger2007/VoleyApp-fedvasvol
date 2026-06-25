/**
 * GalleryViewer.js
 * Componente de visor de imágenes tipo galería de móvil.
 * - Zoom con pellizco (pinch) hasta 4x
 * - Doble tap para zoom in/out
 * - Pan para moverse cuando está zoomado
 * - Deslizar hacia abajo para cerrar
 * - Navegación horizontal entre imágenes con paginación
 * - Carga la URL original (calidad completa)
 */
import React, { useRef, useState, useCallback, useMemo } from 'react';
import {
  Modal,
  View,
  Image,
  Text,
  TouchableOpacity,
  Animated,
  PanResponder,
  Dimensions,
  StyleSheet,
  StatusBar,
  ScrollView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DOUBLE_TAP_ZOOM = 2.5;
const PAN_SENSITIVITY = 1.6;

/**
 * GalleryViewer
 *
 * Props:
 *   visible        {bool}     - si el modal está abierto
 *   images         {string[]} - array de URLs de imágenes
 *   initialIndex   {number}   - índice inicial (default 0)
 *   onClose        {func}     - callback al cerrar
 */
export default function GalleryViewer({ visible, images = [], initialIndex = 0, onClose }) {
  const [currentIdx, setCurrentIdx] = useState(initialIndex);
  const [zoomActive, setZoomActive] = useState(false);

  // Animated values
  const zoomScale = useRef(new Animated.Value(1)).current;
  const panXY = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const dismissY = useRef(new Animated.Value(0)).current;
  const overlayOpacity = useRef(new Animated.Value(1)).current;

  // Mutable refs (avoid stale closures)
  const scaleRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  const panBaseRef = useRef({ x: 0, y: 0 });
  const lastTapRef = useRef(0);
  const pinchTrackRef = useRef({ active: false, dist: 0, baseScale: 1 });
  const perImageState = useRef({});

  // Reset zoom for a given image index
  const resetZoom = useCallback(() => {
    scaleRef.current = 1;
    panRef.current = { x: 0, y: 0 };
    panBaseRef.current = { x: 0, y: 0 };
    setZoomActive(false);
    zoomScale.setValue(1);
    panXY.setValue({ x: 0, y: 0 });
  }, [zoomScale, panXY]);

  const handleClose = useCallback(() => {
    resetZoom();
    Animated.timing(dismissY, { toValue: SCREEN_HEIGHT, duration: 200, useNativeDriver: true }).start(() => {
      dismissY.setValue(0);
      overlayOpacity.setValue(1);
      onClose?.();
    });
  }, [resetZoom, dismissY, overlayOpacity, onClose]);

  // Distance between two touch points
  const getTouchDist = useCallback((touches) => {
    if (!touches || touches.length < 2) return 0;
    const dx = touches[0].pageX - touches[1].pageX;
    const dy = touches[0].pageY - touches[1].pageY;
    return Math.sqrt(dx * dx + dy * dy);
  }, []);

  // ── ZOOM / PAN responder (active while zoomed or pinching) ──────────────────
  const zoomPanResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (e, g) => {
      const multiTouch = (e.nativeEvent.touches?.length >= 2) || g.numberActiveTouches >= 2;
      return multiTouch || scaleRef.current > 1;
    },
    onStartShouldSetPanResponderCapture: () => false,
    onMoveShouldSetPanResponderCapture: (e, g) => {
      const multiTouch = (e.nativeEvent.touches?.length >= 2) || g.numberActiveTouches >= 2;
      return multiTouch || scaleRef.current > 1;
    },
    onPanResponderGrant: (_e, _g) => {
      panBaseRef.current = { x: panRef.current.x, y: panRef.current.y };
      pinchTrackRef.current.active = false;
    },
    onPanResponderMove: (e, g) => {
      const touches = e.nativeEvent.touches;
      const multi = (touches?.length >= 2) || g.numberActiveTouches >= 2;

      if (multi) {
        // PINCH ZOOM
        const dist = getTouchDist(touches);
        if (dist > 0) {
          if (!pinchTrackRef.current.active) {
            pinchTrackRef.current = { active: true, dist, baseScale: scaleRef.current };
          } else {
            const ratio = dist / pinchTrackRef.current.dist;
            // Apply damping for a natural feel
            const damped = 1 + (ratio - 1) * 0.55;
            const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, pinchTrackRef.current.baseScale * damped));
            scaleRef.current = newScale;
            zoomScale.setValue(newScale);
            pinchTrackRef.current.dist = dist;
            pinchTrackRef.current.baseScale = newScale;
            if (!zoomActive) setZoomActive(true);
          }
        }
      } else {
        // PAN (only when zoomed)
        pinchTrackRef.current.active = false;
        if (scaleRef.current > 1) {
          const s = scaleRef.current;
          const maxPx = (SCREEN_WIDTH * (s - 1)) / 2;
          const maxPy = Math.max(0, (SCREEN_HEIGHT * 0.85 * (s - 1)) / 2);
          const tx = Math.max(-maxPx, Math.min(maxPx, panBaseRef.current.x + PAN_SENSITIVITY * g.dx / s));
          const ty = Math.max(-maxPy, Math.min(maxPy, panBaseRef.current.y + PAN_SENSITIVITY * g.dy / s));
          panRef.current = { x: tx, y: ty };
          panXY.x.setValue(tx);
          panXY.y.setValue(ty);
        }
      }
    },
    onPanResponderRelease: () => {
      pinchTrackRef.current.active = false;
      const s = scaleRef.current;
      if (s < MIN_SCALE) {
        scaleRef.current = MIN_SCALE;
        panRef.current = { x: 0, y: 0 };
        panBaseRef.current = { x: 0, y: 0 };
        setZoomActive(false);
        Animated.parallel([
          Animated.spring(zoomScale, { toValue: MIN_SCALE, useNativeDriver: true, tension: 80 }),
          Animated.spring(panXY, { toValue: { x: 0, y: 0 }, useNativeDriver: true, tension: 80 }),
        ]).start();
      } else if (s > MAX_SCALE) {
        scaleRef.current = MAX_SCALE;
        Animated.spring(zoomScale, { toValue: MAX_SCALE, useNativeDriver: true, tension: 80 }).start();
      }
    },
  })).current;

  // ── DISMISS (swipe down) responder ─────────────────────────────────────────
  const dismissResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_e, g) => {
      // Only intercept downward swipes when not zoomed
      return scaleRef.current <= 1 && g.dy > 12 && Math.abs(g.dx) < Math.abs(g.dy) * 1.4;
    },
    onPanResponderMove: (_e, g) => {
      const progress = Math.max(0, g.dy);
      dismissY.setValue(progress * 0.5);
      overlayOpacity.setValue(Math.max(0.2, 1 - progress / 400));
    },
    onPanResponderRelease: (_e, g) => {
      if (g.dy > 90) {
        handleClose();
      } else {
        Animated.parallel([
          Animated.spring(dismissY, { toValue: 0, useNativeDriver: true, tension: 80 }),
          Animated.spring(overlayOpacity, { toValue: 1, useNativeDriver: true }),
        ]).start();
      }
    },
    onPanResponderTerminate: () => {
      Animated.parallel([
        Animated.spring(dismissY, { toValue: 0, useNativeDriver: true }),
        Animated.spring(overlayOpacity, { toValue: 1, useNativeDriver: true }),
      ]).start();
    },
  })).current;

  // ── DOUBLE TAP ─────────────────────────────────────────────────────────────
  const handleDoubleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < 280) {
      if (scaleRef.current > 1.2) {
        // Zoom out
        scaleRef.current = 1;
        panRef.current = { x: 0, y: 0 };
        panBaseRef.current = { x: 0, y: 0 };
        setZoomActive(false);
        Animated.parallel([
          Animated.spring(zoomScale, { toValue: 1, useNativeDriver: true, tension: 100 }),
          Animated.spring(panXY, { toValue: { x: 0, y: 0 }, useNativeDriver: true, tension: 100 }),
        ]).start();
      } else {
        // Zoom in to 2.5x
        scaleRef.current = DOUBLE_TAP_ZOOM;
        setZoomActive(true);
        Animated.spring(zoomScale, { toValue: DOUBLE_TAP_ZOOM, useNativeDriver: true, tension: 100 }).start();
      }
    }
    lastTapRef.current = now;
  }, [zoomScale, panXY]);

  // ── PAGE CHANGE ─────────────────────────────────────────────────────────────
  const handlePageChange = useCallback((e) => {
    const newIdx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    if (newIdx !== currentIdx) {
      // Save current image zoom state
      perImageState.current[currentIdx] = {
        scale: scaleRef.current,
        x: panRef.current.x,
        y: panRef.current.y,
      };
      // Restore new image zoom state (or reset)
      const saved = perImageState.current[newIdx] || { scale: 1, x: 0, y: 0 };
      scaleRef.current = saved.scale;
      panRef.current = { x: saved.x, y: saved.y };
      panBaseRef.current = { x: saved.x, y: saved.y };
      zoomScale.setValue(saved.scale);
      panXY.setValue({ x: saved.x, y: saved.y });
      setZoomActive(saved.scale > 1);
      setCurrentIdx(newIdx);
    }
  }, [currentIdx, zoomScale, panXY]);

  const currentUrl = images[currentIdx] || null;

  if (!visible || images.length === 0) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <StatusBar hidden />
      <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
        {/* Close button */}
        <TouchableOpacity style={styles.closeBtn} onPress={handleClose} activeOpacity={0.8} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <View style={styles.closeBtnInner}>
            <MaterialIcons name="close" size={22} color="#fff" />
          </View>
        </TouchableOpacity>

        {/* Counter */}
        {images.length > 1 && (
          <View style={styles.counter}>
            <Text style={styles.counterText}>{currentIdx + 1} / {images.length}</Text>
          </View>
        )}

        {/* Main content — dismiss swipe wrapper */}
        <Animated.View
          style={[StyleSheet.absoluteFill, { transform: [{ translateY: dismissY }] }]}
          {...dismissResponder.panHandlers}
        >
          {/* Images */}
          {images.length === 1 ? (
            <View style={styles.singlePage}>
              <TouchableOpacity activeOpacity={1} onPress={handleDoubleTap}>
                <Image
                  source={{ uri: images[0] }}
                  style={styles.image}
                  resizeMode="contain"
                />
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              scrollEnabled={!zoomActive}
              canCancelContentTouches={zoomActive}
              delaysContentTouches={false}
              contentOffset={{ x: initialIndex * SCREEN_WIDTH, y: 0 }}
              onMomentumScrollEnd={handlePageChange}
              style={{ flex: 1 }}
            >
              {images.map((uri, i) => (
                <View key={i} style={styles.page}>
                  <TouchableOpacity activeOpacity={1} onPress={handleDoubleTap}>
                    <Image
                      source={{ uri }}
                      style={styles.image}
                      resizeMode="contain"
                    />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}
        </Animated.View>

        {/* Zoom overlay — intercepts gestures when zoomed or pinching */}
        {(zoomActive) && (
          <View style={[StyleSheet.absoluteFill, styles.zoomOverlay]} {...zoomPanResponder.panHandlers}>
            <View style={styles.zoomContainer}>
              <TouchableOpacity activeOpacity={1} onPress={handleDoubleTap}>
                <Animated.View style={{
                  transform: [
                    { translateX: panXY.x },
                    { translateY: panXY.y },
                    { scale: zoomScale },
                  ],
                }}>
                  <Image
                    source={{ uri: currentUrl }}
                    style={styles.image}
                    resizeMode="contain"
                  />
                </Animated.View>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Pinch capture overlay — always present for detecting pinch start */}
        {!zoomActive && (
          <View
            style={StyleSheet.absoluteFill}
            pointerEvents="box-none"
            onStartShouldSetResponder={() => false}
            {...zoomPanResponder.panHandlers}
          />
        )}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#000',
  },
  closeBtn: {
    position: 'absolute',
    top: 52,
    right: 16,
    zIndex: 100,
  },
  closeBtnInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  counter: {
    position: 'absolute',
    bottom: 48,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    zIndex: 100,
  },
  counterText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  page: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  singlePage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.85,
  },
  zoomOverlay: {
    zIndex: 50,
  },
  zoomContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
