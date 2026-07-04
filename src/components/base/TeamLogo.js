import React, { useState, useEffect } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { getCachedLogoColorSync, requestLogoColorExtraction, subscribeToLogoColor } from '../../utils/logoColorCache';
import { getDominantColor } from '../../utils/imageColor';

export default function TeamLogo({ uri, name, size = 36, style }) {
  const { colors, isDark } = useTheme();
  const fontSize = Math.round(size * 0.4);
  const [bgColor, setBgColor] = useState(() => getCachedLogoColorSync(uri) || colors.surfaceAlt);

  useEffect(() => {
    if (!uri) { setBgColor(colors.surfaceAlt); return; }
    const cached = getCachedLogoColorSync(uri);
    if (cached) setBgColor(cached);

    requestLogoColorExtraction(uri, getDominantColor);

    let mounted = true;
    const unsubscribe = subscribeToLogoColor(uri, (newColor) => {
      if (mounted && newColor) setBgColor(newColor);
    });
    return () => { mounted = false; unsubscribe(); };
  }, [uri, colors.surfaceAlt]);

  if (uri) {
    return (
      <View
        style={[
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: bgColor,
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          },
          style,
        ]}
      >
        <Image
          source={{ uri }}
          style={{ width: '82%', height: '82%' }}
          resizeMode="contain"
        />
      </View>
    );
  }

  const initials = name
    ? name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
    : '?';

  return (
    <View
      style={[
        styles.fallback,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.primaryAlpha15,
        },
        style,
      ]}
    >
      <MaterialIcons name="sports-volleyball" size={fontSize} color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
