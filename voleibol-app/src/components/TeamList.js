// src/components/TeamList.js
// Lista de equipos extraídos del HTML parseado.
// Muestra cada equipo como una tarjeta con avatar, nombre y categoría.

import React from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { Spacing, Typography, Radius, Shadow } from '../styles/theme';
import { useTheme } from '../contexts/ThemeContext';

/**
 * Genera las iniciales de un nombre de equipo para el avatar
 */
function getInitials(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('');
}

/**
 * Genera un color de fondo determinista según el nombre del equipo
 */
const AVATAR_COLORS = [
  '#1565C0', '#283593', '#4527A0', '#00695C',
  '#2E7D32', '#E65100', '#B71C1C', '#37474F',
];
function getAvatarColor(name = '') {
  const sum = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
}

/**
 * Tarjeta individual de equipo
 */
function TeamCard({ team, onPress }) {
  const { colors: Colors } = useTheme();
  const initials = getInitials(team.name);
  const avatarColor = getAvatarColor(team.name);

  return (
    <TouchableOpacity
      style={{ backgroundColor: Colors.surface, borderRadius: Radius.lg, flexDirection: 'row', alignItems: 'center', padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, ...Shadow.sm }}
      onPress={() => onPress?.(team)}
      activeOpacity={0.75}
    >
      <View style={{ width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.lg, backgroundColor: avatarColor }}>
        <Text style={{ color: '#ffffff', fontSize: Typography.size.lg, fontWeight: Typography.weight.bold }}>{initials}</Text>
      </View>

      <View style={{ flex: 1 }}>
        <Text style={{ color: Colors.textPrimary, fontSize: Typography.size.md, fontWeight: Typography.weight.semiBold, marginBottom: 4 }} numberOfLines={2}>
          {team.name}
        </Text>
        {team.category ? (
          <View style={{ alignSelf: 'flex-start', backgroundColor: Colors.surfaceAlt, borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2, marginBottom: 3 }}>
            <Text style={{ color: Colors.primary, fontSize: Typography.size.xs, fontWeight: Typography.weight.medium }} numberOfLines={1}>
              {team.category}
            </Text>
          </View>
        ) : null}
        {team.extra ? (
          <Text style={{ color: Colors.textMuted, fontSize: Typography.size.xs }} numberOfLines={1}>
            {team.extra}
          </Text>
        ) : null}
      </View>

      <Text style={{ color: Colors.textMuted, fontSize: 24, marginLeft: Spacing.sm }}>›</Text>
    </TouchableOpacity>
  );
}

export default function TeamList({ teams = [], onSelectTeam }) {
  const { colors: Colors } = useTheme();
  if (!teams.length) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xxl }}>
        <Text style={{ fontSize: 48, marginBottom: Spacing.md }}>🏐</Text>
        <Text style={{ color: Colors.textMuted, fontSize: Typography.size.md }}>No hay equipos disponibles</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={teams}
      keyExtractor={(_, i) => String(i)}
      renderItem={({ item }) => (
        <TeamCard team={item} onPress={onSelectTeam} />
      )}
      contentContainerStyle={{ padding: Spacing.lg }}
      showsVerticalScrollIndicator={false}
      ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
    />
  );
}
      {/* Avatar con iniciales */}
