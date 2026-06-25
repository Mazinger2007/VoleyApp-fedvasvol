import React, { useRef, useCallback, useState, useEffect } from 'react';
import {
  View,
  Animated,
  StyleSheet,
  Platform,
} from 'react-native';

const SPRING_CONFIG = { friction: 8, tension: 120, overshootClamping: true, useNativeDriver: true };

export default function DragReorderSection({
  items = [],
  renderItem,
  onReorder,
  onItemPress,
  keyExtractor = (item, i) => String(i),
  onDragStateChange,
}) {
  const animValues = useRef([]);
  const heights = useRef([]);
  const posY = useRef([]);
  const currentShift = useRef([]);
  const longPressTimer = useRef(null);
  const tapHandled = useRef(false);
  const touchStartPageY = useRef(0);
  const dragState = useRef({
    active: false,
    fromIdx: -1,
    startPageY: 0,
    currentDy: 0,
    targetIdx: -1,
  });
  const [activeIdx, setActiveIdx] = useState(-1);

  if (animValues.current.length !== items.length) {
    animValues.current = items.map((_, i) => animValues.current[i] || new Animated.Value(0));
  }
  if (currentShift.current.length !== items.length) {
    currentShift.current = new Array(items.length).fill(0);
  }
  heights.current.length = items.length;
  posY.current.length = items.length;

  /** Whether we need to show the Animated translateY offsets.
   *  When activeIdx < 0, no item is being dragged and no final animation is running,
   *  so items render at their natural layout positions — no flicker after reorder. */
  const showTranslateY = activeIdx >= 0;

  const calcPosY = useCallback(() => {
    let y = 0;
    for (let i = 0; i < items.length; i++) {
      posY.current[i] = y;
      y += heights.current[i] || 60;
    }
  }, [items.length]);

  const calcTargetIdx = useCallback((fromIdx, dy) => {
    const h = heights.current;
    const fingerY = posY.current[fromIdx] + (h[fromIdx] || 60) / 2 + dy;
    let target = fromIdx;
    if (dy > 0) {
      for (let i = fromIdx + 1; i < items.length; i++) {
        if (fingerY > posY.current[i] + (h[i] || 60) / 2) target = i;
      }
    } else {
      for (let i = fromIdx - 1; i >= 0; i--) {
        if (fingerY < posY.current[i] + (h[i] || 60) / 2) target = i;
      }
    }
    return Math.max(0, Math.min(items.length - 1, target));
  }, [items.length]);

  const applyShifts = useCallback((fromIdx, targetIdx, dy) => {
    const anims = animValues.current;
    const h = heights.current;
    const shifts = currentShift.current;
    for (let i = 0; i < items.length; i++) {
      let targetShift = 0;
      if (i === fromIdx) {
        targetShift = dy;
      } else if (dy > 0 && i > fromIdx && i <= targetIdx) {
        targetShift = -(h[i - 1] || h[i] || 60);
      } else if (dy < 0 && i < fromIdx && i >= targetIdx) {
        targetShift = (h[i + 1] || h[i] || 60);
      }
      if (shifts[i] !== targetShift) {
        shifts[i] = targetShift;
        if (i === fromIdx) {
          anims[i].setValue(targetShift);
        } else {
          Animated.spring(anims[i], { ...SPRING_CONFIG, toValue: targetShift }).start();
        }
      }
    }
  }, [items.length]);

  const resetAll = useCallback(() => {
    for (let i = 0; i < animValues.current.length; i++) {
      currentShift.current[i] = 0;
      animValues.current[i].setValue(0);
    }
  }, []);

  const startDrag = useCallback((idx, pageY) => {
    calcPosY();
    resetAll();
    const ds = dragState.current;
    ds.active = true;
    ds.fromIdx = idx;
    ds.startPageY = pageY;
    ds.currentDy = 0;
    ds.targetIdx = idx;
    setActiveIdx(idx);
    if (onDragStateChange) onDragStateChange(false);
  }, [calcPosY, onDragStateChange, resetAll]);

  const endDrag = useCallback(() => {
    const ds = dragState.current;
    if (!ds.active) return;
    const { fromIdx } = ds;
    const targetIdx = ds.targetIdx;

    ds.active = false;

    if (fromIdx === targetIdx || targetIdx < 0) {
      // Animate items back to 0, then hide translateY
      const resetAnims = [];
      for (let i = 0; i < items.length; i++) {
        resetAnims.push(
          Animated.spring(animValues.current[i], { ...SPRING_CONFIG, toValue: 0 })
        );
      }
      Animated.parallel(resetAnims).start(() => {
        for (let i = 0; i < items.length; i++) currentShift.current[i] = 0;
        setActiveIdx(-1);
        if (onDragStateChange) onDragStateChange(true);
      });
      return;
    }

    const h = heights.current;
    const anims = animValues.current;

    const calcFinal = (i) => {
      if (i === fromIdx) {
        let total = 0;
        if (fromIdx < targetIdx) {
          for (let j = fromIdx + 1; j <= targetIdx; j++) total += (h[j] || 60);
        } else {
          for (let j = targetIdx; j < fromIdx; j++) total += (h[j] || 60);
          total = -total;
        }
        return total;
      }
      if (fromIdx < targetIdx && i > fromIdx && i <= targetIdx) return -(h[fromIdx] || 60);
      if (fromIdx > targetIdx && i < fromIdx && i >= targetIdx) return (h[fromIdx] || 60);
      return 0;
    };

    const animations = [];
    for (let i = 0; i < items.length; i++) {
      const finalVal = calcFinal(i);
      currentShift.current[i] = finalVal;
      animations.push(
        Animated.spring(anims[i], { ...SPRING_CONFIG, toValue: finalVal })
      );
    }

    Animated.parallel(animations).start(() => {
      onReorder(fromIdx, targetIdx);
      ds.fromIdx = -1;
      ds.targetIdx = -1;
      ds.currentDy = 0;
      setActiveIdx(-1);
      if (onDragStateChange) onDragStateChange(true);
    });
  }, [items.length, onReorder, onDragStateChange]);

  const handleItemLayout = useCallback((i, evt) => {
    heights.current[i] = evt.nativeEvent.layout.height;
  }, []);

  return (
    <View>
      {items.map((item, i) => {
        const isDragging = i === activeIdx;
        const transform = showTranslateY
          ? [{ translateY: animValues.current[i] }, { scale: isDragging ? 1.04 : 1 }]
          : [{ scale: 1 }];
        return (
          <Animated.View
            key={`drag-${keyExtractor(item, i)}`}
            style={{
              transform,
              zIndex: isDragging ? 9999 : 1,
              ...(isDragging ? styles.draggingElevation : {}),
            }}
            onLayout={(evt) => handleItemLayout(i, evt)}
          >
            <View
              onStartShouldSetResponder={() => true}
              onMoveShouldSetResponder={() => true}
              onResponderGrant={(evt) => {
                const pageY = evt.nativeEvent.pageY;
                touchStartPageY.current = pageY;
                tapHandled.current = false;

                if (longPressTimer.current) clearTimeout(longPressTimer.current);
                longPressTimer.current = setTimeout(() => {
                  tapHandled.current = true;
                  startDrag(i, pageY);
                }, 250);
              }}
              onResponderMove={(evt) => {
                const pageY = evt.nativeEvent.pageY;
                const dy = Math.abs(pageY - touchStartPageY.current);

                if (!dragState.current.active && dy > 10) {
                  if (longPressTimer.current) {
                    clearTimeout(longPressTimer.current);
                    longPressTimer.current = null;
                  }
                  tapHandled.current = true;
                }

                if (dragState.current.active) {
                  const totalDy = pageY - dragState.current.startPageY;
                  const target = calcTargetIdx(dragState.current.fromIdx, totalDy);
                  dragState.current.currentDy = totalDy;
                  dragState.current.targetIdx = target;
                  applyShifts(dragState.current.fromIdx, target, totalDy);
                }
              }}
              onResponderRelease={() => {
                if (longPressTimer.current) {
                  clearTimeout(longPressTimer.current);
                  longPressTimer.current = null;
                }

                if (dragState.current.active) {
                  endDrag();
                } else if (!tapHandled.current && onItemPress) {
                  onItemPress(item);
                }
                tapHandled.current = false;
              }}
              onResponderTerminate={() => {
                if (longPressTimer.current) {
                  clearTimeout(longPressTimer.current);
                  longPressTimer.current = null;
                }
                if (dragState.current.active) endDrag();
              }}
              onResponderTerminationRequest={() => !dragState.current.active}
            >
              {renderItem(item, i, items.length, isDragging)}
            </View>
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  draggingElevation: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.35,
      shadowRadius: 10,
    },
    android: {
      elevation: 10,
    },
    default: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.35,
      shadowRadius: 10,
    },
  }),
});
