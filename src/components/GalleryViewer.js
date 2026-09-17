/**
 * GalleryViewer.js
 * Componente de visor de imágenes tipo galería de móvil.
 * - Zoom con pellizco (pinch) hasta 5x — siempre activo, sin overlay condicional
 * - Doble tap para zoom in/out centrado en el punto de toque
 * - Pan para moverse cuando está zoomado
 * - Deslizar hacia abajo para cerrar
 * - Navegación horizontal entre imágenes con paginación
 * - Carga la URL original (calidad completa)
 */
import React, { useRef, useState, useCallback, useEffect } from 'react';
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
import { downloadImage } from '../utils/imageUtils';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const MIN_SCALE = 1;
const MAX_SCALE = 5;
const DOUBLE_TAP_ZOOM = 2.8;
const DOUBLE_TAP_DELAY = 260; // ms
const IMG_HEIGHT = SCREEN_HEIGHT * 0.88;

// Clamp helper
const clamp = (val, min, max) => Math.max(min, Math.min(max, val));

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

  // ─── Animated values ───────────────────────────────────────────────────────
  const zoomScale  = useRef(new Animated.Value(1)).current;
  const panX       = useRef(new Animated.Value(0)).current;
  const panY       = useRef(new Animated.Value(0)).current;
  const dismissY   = useRef(new Animated.Value(0)).current;
  const overlayOpacity = useRef(new Animated.Value(1)).current;

  // ─── Mutable refs (avoid stale closures in PanResponder) ──────────────────
  const scaleRef      = useRef(1);
  const panRef        = useRef({ x: 0, y: 0 });
  const panBaseRef    = useRef({ x: 0, y: 0 }); // pan at gesture start

  // Pinch state — tracked entirely by start distance
  const pinchRef = useRef({
    active:    false,
    startDist: 0,
    startScale: 1,
    midX:      0, // midpoint x at pinch start (page coords)
    midY:      0,
    panStartX: 0,
    panStartY: 0,
  });

  // Double-tap detection
  const lastTapRef = useRef(0);
  const lastTapPosRef = useRef({ x: 0, y: 0 });

  // Per-image saved zoom/pan state
  const perImageState = useRef({});

  // Track scroll position
  const scrollRef = useRef(null);

  // ─── Helpers ───────────────────────────────────────────────────────────────
  const getMaxPan = useCallback((scale) => {
    const maxPx = Math.max(0, (SCREEN_WIDTH  * (scale - 1)) / 2);
    const maxPy = Math.max(0, (IMG_HEIGHT    * (scale - 1)) / 2);
    return { maxPx, maxPy };
  }, []);

  const applyPan = useCallback((tx, ty, scale) => {
    const { maxPx, maxPy } = getMaxPan(scale);
    const cx = clamp(tx, -maxPx, maxPx);
    const cy = clamp(ty, -maxPy, maxPy);
    panRef.current = { x: cx, y: cy };
    panX.setValue(cx);
    panY.setValue(cy);
  }, [getMaxPan, panX, panY]);

  const resetZoom = useCallback((animated = false) => {
    scaleRef.current = 1;
    panRef.current   = { x: 0, y: 0 };
    panBaseRef.current = { x: 0, y: 0 };
    if (animated) {
      Animated.parallel([
        Animated.spring(zoomScale, { toValue: 1, useNativeDriver: true, tension: 80, friction: 9 }),
        Animated.spring(panX,      { toValue: 0, useNativeDriver: true, tension: 80, friction: 9 }),
        Animated.spring(panY,      { toValue: 0, useNativeDriver: true, tension: 80, friction: 9 }),
      ]).start();
    } else {
      zoomScale.setValue(1);
      panX.setValue(0);
      panY.setValue(0);
    }
  }, [zoomScale, panX, panY]);

  // Snap back if out of bounds after gesture
  const snapBack = useCallback(() => {
    const s = scaleRef.current;
    const { maxPx, maxPy } = getMaxPan(s);
    const cx = clamp(panRef.current.x, -maxPx, maxPx);
    const cy = clamp(panRef.current.y, -maxPy, maxPy);

    if (s < MIN_SCALE + 0.05) {
      // Snap back to 1x
      resetZoom(true);
    } else {
      const targetScale = clamp(s, MIN_SCALE, MAX_SCALE);
      const animations = [];
      if (Math.abs(s - targetScale) > 0.01) {
        scaleRef.current = targetScale;
        animations.push(Animated.spring(zoomScale, { toValue: targetScale, useNativeDriver: true, tension: 80, friction: 9 }));
      }
      if (Math.abs(cx - panRef.current.x) > 0.5 || Math.abs(cy - panRef.current.y) > 0.5) {
        panRef.current = { x: cx, y: cy };
        animations.push(Animated.spring(panX, { toValue: cx, useNativeDriver: true, tension: 80, friction: 9 }));
        animations.push(Animated.spring(panY, { toValue: cy, useNativeDriver: true, tension: 80, friction: 9 }));
      }
      if (animations.length > 0) Animated.parallel(animations).start();
    }
  }, [getMaxPan, resetZoom, zoomScale, panX, panY]);

  // ─── Dismiss (close on swipe-down) ────────────────────────────────────────
  const handleClose = useCallback(() => {
    resetZoom(false);
    Animated.timing(dismissY, {
      toValue: SCREEN_HEIGHT,
      duration: 220,
      useNativeDriver: true,
    }).start(() => {
      dismissY.setValue(0);
      overlayOpacity.setValue(1);
      onClose?.();
    });
  }, [resetZoom, dismissY, overlayOpacity, onClose]);

  // ─── Distance between two touch points ────────────────────────────────────
  const getTouchDist = (touches) => {
    if (!touches || touches.length < 2) return 0;
    const dx = touches[0].pageX - touches[1].pageX;
    const dy = touches[0].pageY - touches[1].pageY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const getMidpoint = (touches) => {
    if (!touches || touches.length < 2) return { x: SCREEN_WIDTH / 2, y: SCREEN_HEIGHT / 2 };
    return {
      x: (touches[0].pageX + touches[1].pageX) / 2,
      y: (touches[0].pageY + touches[1].pageY) / 2,
    };
  };

  // ─── DOUBLE TAP ────────────────────────────────────────────────────────────
  const handleDoubleTap = useCallback((pageX, pageY) => {
    const now = Date.now();
    const timeDiff = now - lastTapRef.current;

    if (timeDiff < DOUBLE_TAP_DELAY && timeDiff > 0) {
      // It's a double tap
      lastTapRef.current = 0;

      if (scaleRef.current > MIN_SCALE + 0.1) {
        // Zoom OUT → reset
        resetZoom(true);
      } else {
        // Zoom IN → centered on tap position
        const targetScale = DOUBLE_TAP_ZOOM;
        scaleRef.current = targetScale;

        // Calculate pan offset so the tapped point stays in view
        const cx = SCREEN_WIDTH  / 2;
        const cy = SCREEN_HEIGHT / 2;
        const tx = clamp((cx - (pageX ?? cx)) * (targetScale - 1) / targetScale, -(SCREEN_WIDTH  * (targetScale - 1)) / 2, (SCREEN_WIDTH  * (targetScale - 1)) / 2);
        const ty = clamp((cy - (pageY ?? cy)) * (targetScale - 1) / targetScale, -(IMG_HEIGHT    * (targetScale - 1)) / 2, (IMG_HEIGHT    * (targetScale - 1)) / 2);

        panRef.current = { x: tx, y: ty };

        Animated.parallel([
          Animated.spring(zoomScale, { toValue: targetScale, useNativeDriver: true, tension: 70, friction: 8 }),
          Animated.spring(panX,      { toValue: tx,           useNativeDriver: true, tension: 70, friction: 8 }),
          Animated.spring(panY,      { toValue: ty,           useNativeDriver: true, tension: 70, friction: 8 }),
        ]).start();
      }
    } else {
      lastTapRef.current = now;
      lastTapPosRef.current = { x: pageX, y: pageY };
    }
  }, [resetZoom, zoomScale, panX, panY]);

  // ─── MAIN GESTURE RESPONDER ─────────────────────────────────────────────────
  // Handles BOTH pinch-zoom AND pan in a single responder (no overlay switching)
  const gestureResponder = useRef(
    PanResponder.create({
      // Always try to claim multi-touch; single touch only if zoomed
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (e, g) => {
        const touches = e.nativeEvent.touches;
        const isMulti = (touches && touches.length >= 2) || g.numberActiveTouches >= 2;
        return isMulti || scaleRef.current > MIN_SCALE + 0.02;
      },
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponderCapture: (e, g) => {
        const touches = e.nativeEvent.touches;
        const isMulti = (touches && touches.length >= 2) || g.numberActiveTouches >= 2;
        return isMulti || scaleRef.current > MIN_SCALE + 0.02;
      },

      onPanResponderGrant: (e, _g) => {
        panBaseRef.current = { x: panRef.current.x, y: panRef.current.y };
        const touches = e.nativeEvent.touches;

        if (touches && touches.length >= 2) {
          const dist = getTouchDist(touches);
          const mid  = getMidpoint(touches);
          pinchRef.current = {
            active:     true,
            startDist:  dist,
            startScale: scaleRef.current,
            midX:       mid.x,
            midY:       mid.y,
            panStartX:  panRef.current.x,
            panStartY:  panRef.current.y,
          };
        } else {
          pinchRef.current = { active: false, startDist: 0, startScale: 1, midX: 0, midY: 0, panStartX: 0, panStartY: 0 };
        }
      },

      onPanResponderMove: (e, g) => {
        const touches = e.nativeEvent.touches;
        const isMulti = touches && touches.length >= 2;

        if (isMulti) {
          // ── PINCH ZOOM ──────────────────────────────────────────────────
          const dist = getTouchDist(touches);

          if (!pinchRef.current.active || pinchRef.current.startDist === 0) {
            // Initialize pinch mid-gesture
            const mid = getMidpoint(touches);
            pinchRef.current = {
              active:     true,
              startDist:  dist,
              startScale: scaleRef.current,
              midX:       mid.x,
              midY:       mid.y,
              panStartX:  panRef.current.x,
              panStartY:  panRef.current.y,
            };
            return;
          }

          const ratio    = dist / pinchRef.current.startDist;
          const rawScale = pinchRef.current.startScale * ratio;
          const newScale = clamp(rawScale, MIN_SCALE * 0.85, MAX_SCALE * 1.1); // slight over-stretch allowed

          scaleRef.current = newScale;
          zoomScale.setValue(newScale);

          // Also pan so the pinch midpoint stays fixed on screen
          const cx    = SCREEN_WIDTH  / 2;
          const cy    = SCREEN_HEIGHT / 2;
          const prevS = pinchRef.current.startScale;
          const curS  = newScale;

          // Focal-point pan: offset = (mid - center) * (1 - curS/prevS) + panStart * (curS/prevS)
          const scaleFactor = curS / Math.max(prevS, 0.01);
          const tx = pinchRef.current.panStartX * scaleFactor
                   + (pinchRef.current.midX - cx) * (1 - scaleFactor);
          const ty = pinchRef.current.panStartY * scaleFactor
                   + (pinchRef.current.midY - cy) * (1 - scaleFactor);

          const { maxPx, maxPy } = {
            maxPx: Math.max(0, (SCREEN_WIDTH * (Math.abs(curS) - 1)) / 2),
            maxPy: Math.max(0, (IMG_HEIGHT   * (Math.abs(curS) - 1)) / 2),
          };
          const cx2 = clamp(tx, -maxPx, maxPx);
          const cy2 = clamp(ty, -maxPy, maxPy);

          panRef.current = { x: cx2, y: cy2 };
          panX.setValue(cx2);
          panY.setValue(cy2);

        } else {
          // ── PAN (single finger, only when zoomed) ───────────────────────
          pinchRef.current.active = false;

          if (scaleRef.current > MIN_SCALE + 0.02) {
            const s = scaleRef.current;
            const tx = panBaseRef.current.x + g.dx;
            const ty = panBaseRef.current.y + g.dy;
            const { maxPx, maxPy } = {
              maxPx: Math.max(0, (SCREEN_WIDTH * (s - 1)) / 2),
              maxPy: Math.max(0, (IMG_HEIGHT   * (s - 1)) / 2),
            };
            const cx = clamp(tx, -maxPx, maxPx);
            const cy = clamp(ty, -maxPy, maxPy);
            panRef.current = { x: cx, y: cy };
            panX.setValue(cx);
            panY.setValue(cy);
          }
        }
      },

      onPanResponderRelease: (_e, _g) => {
        pinchRef.current.active = false;
        snapBack();
      },

      onPanResponderTerminate: (_e, _g) => {
        pinchRef.current.active = false;
        snapBack();
      },
    })
  ).current;

  // ─── DISMISS RESPONDER ─────────────────────────────────────────────────────
  const dismissResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_e, g) =>
        scaleRef.current <= MIN_SCALE + 0.05 &&
        g.dy > 14 &&
        Math.abs(g.dx) < Math.abs(g.dy) * 1.2,
      onPanResponderMove: (_e, g) => {
        const progress = Math.max(0, g.dy);
        dismissY.setValue(progress * 0.45);
        overlayOpacity.setValue(Math.max(0.15, 1 - progress / 350));
      },
      onPanResponderRelease: (_e, g) => {
        if (g.dy > 100 || g.vy > 0.5) {
          handleClose();
        } else {
          Animated.parallel([
            Animated.spring(dismissY,      { toValue: 0, useNativeDriver: true, tension: 70, friction: 9 }),
            Animated.spring(overlayOpacity,{ toValue: 1, useNativeDriver: true, tension: 70, friction: 9 }),
          ]).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.parallel([
          Animated.spring(dismissY,      { toValue: 0, useNativeDriver: true }),
          Animated.spring(overlayOpacity,{ toValue: 1, useNativeDriver: true }),
        ]).start();
      },
    })
  ).current;

  // ─── PAGE CHANGE ────────────────────────────────────────────────────────────
  const handlePageChange = useCallback((e) => {
    const newIdx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    if (newIdx !== currentIdx) {
      // Save current
      perImageState.current[currentIdx] = {
        scale: scaleRef.current,
        x: panRef.current.x,
        y: panRef.current.y,
      };
      // Restore or reset
      const saved = perImageState.current[newIdx] || { scale: 1, x: 0, y: 0 };
      scaleRef.current = saved.scale;
      panRef.current   = { x: saved.x, y: saved.y };
      panBaseRef.current = { x: saved.x, y: saved.y };
      zoomScale.setValue(saved.scale);
      panX.setValue(saved.x);
      panY.setValue(saved.y);
      setCurrentIdx(newIdx);
    }
  }, [currentIdx, zoomScale, panX, panY]);

  // Reset when re-opened
  useEffect(() => {
    if (visible) {
      setCurrentIdx(initialIndex);
      perImageState.current = {};
      resetZoom(false);
    }
  }, [visible, initialIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!visible || images.length === 0) return null;



  // ── Tap handler on image (for double-tap) ────────────────────────────────
  const onImagePress = (e) => {
    const { pageX, pageY } = e.nativeEvent;
    handleDoubleTap(pageX, pageY);
  };

  // ─── Image with gestures ───────────────────────────────────────────────────
  const ZoomableImage = ({ uri }) => (
    <Animated.View
      style={[
        styles.imageWrapper,
        {
          transform: [
            { translateX: panX },
            { translateY: panY },
            { scale: zoomScale },
          ],
        },
      ]}
      {...gestureResponder.panHandlers}
    >
      <TouchableOpacity activeOpacity={1} onPress={onImagePress}>
        <Image
          source={{ uri }}
          style={styles.image}
          resizeMode="contain"
        />
      </TouchableOpacity>
    </Animated.View>
  );

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
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={handleClose}
          activeOpacity={0.8}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <View style={styles.closeBtnInner}>
            <MaterialIcons name="close" size={22} color="#fff" />
          </View>
        </TouchableOpacity>

        {/* Download button */}
        <TouchableOpacity
          style={styles.downloadBtn}
          onPress={() => downloadImage(images[currentIdx])}
          activeOpacity={0.8}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <View style={styles.closeBtnInner}>
            <MaterialIcons name="share" size={20} color="#fff" />
          </View>
        </TouchableOpacity>

        {/* Counter */}
        {images.length > 1 && (
          <View style={styles.counter}>
            <Text style={styles.counterText}>{currentIdx + 1} / {images.length}</Text>
          </View>
        )}

        {/* Dismiss swipe wrapper */}
        <Animated.View
          style={[StyleSheet.absoluteFill, { transform: [{ translateY: dismissY }] }]}
          {...dismissResponder.panHandlers}
        >
          {images.length === 1 ? (
            <View style={styles.singlePage}>
              <ZoomableImage uri={images[0]} />
            </View>
          ) : (
            <ScrollView
              ref={scrollRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              scrollEnabled={scaleRef.current <= MIN_SCALE + 0.05}
              canCancelContentTouches
              delaysContentTouches={false}
              contentOffset={{ x: initialIndex * SCREEN_WIDTH, y: 0 }}
              onMomentumScrollEnd={handlePageChange}
              style={{ flex: 1 }}
            >
              {images.map((uri, i) => (
                <View key={i} style={styles.page}>
                  {i === currentIdx ? (
                    <ZoomableImage uri={uri} />
                  ) : (
                    <TouchableOpacity activeOpacity={1} onPress={onImagePress}>
                      <Image source={{ uri }} style={styles.image} resizeMode="contain" />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </ScrollView>
          )}
        </Animated.View>

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
  downloadBtn: {
    position: 'absolute',
    top: 52,
    left: 16,
    zIndex: 100,
  },
  closeBtnInner: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.6)',
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
    overflow: 'hidden',
  },
  singlePage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
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
