import React, { useEffect, useRef, useCallback } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, Platform, Dimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { Typography, Radius, Spacing } from '../styles/theme';
import { setBannerShowFn } from '../services/newsNotificationService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function NotificationBanner() {
  const { colors: Colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const HIDDEN_OFFSET = React.useMemo(() => -(insets.top + 100), [insets.top]);
  const translateY = useRef(new Animated.Value(HIDDEN_OFFSET)).current;
  const dataRef = useRef({ title: '', body: '' });
  const timeoutRef = useRef(null);

  const hide = useCallback(() => {
    Animated.timing(translateY, {
      toValue: HIDDEN_OFFSET,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [translateY, HIDDEN_OFFSET]);

  const show = useCallback((title, body) => {
    dataRef.current = { title, body };
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    Animated.timing(translateY, {
      toValue: 0,
      duration: 400,
      useNativeDriver: true,
    }).start();
    timeoutRef.current = setTimeout(hide, 5000);
  }, [translateY, hide]);

  useEffect(() => {
    setBannerShowFn(show);
    return () => setBannerShowFn(null);
  }, [show]);

  return (
    <Animated.View
      style={[
        styles.wrapper,
        {
          transform: [{ translateY }],
          backgroundColor: Colors.surface,
          borderBottomColor: Colors.border,
          paddingTop: insets.top + 8,
        },
      ]}
    >
      <View style={styles.inner}>
        <View style={[styles.iconWrap, { backgroundColor: isDark ? 'rgba(59,130,246,0.15)' : '#eff6ff' }]}>
          <MaterialIcons name="newspaper" size={20} color={Colors.primary} />
        </View>
        <View style={styles.textWrap}>
          <Text style={[styles.title, { color: Colors.textPrimary }]} numberOfLines={1}>
            {dataRef.current.title}
          </Text>
          <Text style={[styles.body, { color: Colors.textSecondary }]} numberOfLines={1}>
            {dataRef.current.body}
          </Text>
        </View>
        <TouchableOpacity onPress={hide} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <MaterialIcons name="close" size={18} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    borderBottomWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingBottom: 10,
    elevation: 10,
    ...(Platform.OS !== 'web' ? {
      shadowColor: '#000',
      shadowOpacity: 0.15,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
    } : {
      boxShadow: '0 4px 8px rgba(0,0,0,0.15)',
    }),
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textWrap: {
    flex: 1,
  },
  title: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.semiBold,
  },
  body: {
    fontSize: Typography.size.xs,
    marginTop: 2,
  },
});
