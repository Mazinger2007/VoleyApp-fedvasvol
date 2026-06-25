import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';

export default function TeamLogo({ uri, name, size = 36, style }) {
  const { colors } = useTheme();
  const fontSize = Math.round(size * 0.4);

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[
          {
            width: size,
            height: size,
            borderRadius: size / 2,
          },
          style,
        ]}
        resizeMode="contain"
      />
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
