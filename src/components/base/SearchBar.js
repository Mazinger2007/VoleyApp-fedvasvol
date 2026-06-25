import React from 'react';
import { View, TextInput, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';

export default function SearchBar({ value, onChangeText, placeholder, autoFocus, style }) {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }, style]}>
      <MaterialIcons name="search" size={18} color={colors.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder || 'Buscar...'}
        placeholderTextColor={colors.textMuted}
        autoFocus={autoFocus}
        style={[styles.input, { color: colors.textPrimary }]}
        returnKeyType="search"
      />
      {value ? (
        <TouchableOpacity onPress={() => onChangeText('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <MaterialIcons name="close" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    padding: 0,
  },
});
