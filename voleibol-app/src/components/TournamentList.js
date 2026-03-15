import React from 'react';
import { View, Text, FlatList, TouchableOpacity } from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Spacing, Typography, Radius, Shadow } from '../styles/theme';
import { useTheme } from '../contexts/ThemeContext';

function getCell(row, headers, includesText) {
  const idx = headers.findIndex((h) =>
    h.toLowerCase().includes(includesText.toLowerCase())
  );
  return idx >= 0 ? (row[idx] || '') : '';
}

function getCoverColor(category, sex, Colors) {
  const cat = (category || '').toLowerCase();
  const sx = (sex || '').toLowerCase();
  if (sx.includes('femenin')) return 'rgba(124,58,237,0.18)';
  if (sx.includes('masculin')) return 'rgba(13,143,242,0.18)';
  if (cat.includes('junior')) return 'rgba(16,185,129,0.18)';
  if (cat.includes('senior')) return 'rgba(245,158,11,0.18)';
  return Colors.primaryAlpha15;
}

function getCoverIconColor(category, sex, Colors) {
  const cat = (category || '').toLowerCase();
  const sx = (sex || '').toLowerCase();
  if (sx.includes('femenin')) return '#8b5cf6';
  if (sx.includes('masculin')) return Colors.primary;
  if (cat.includes('junior')) return '#10b981';
  if (cat.includes('senior')) return '#f59e0b';
  return Colors.primary;
}

function isActive(status) {
  const s = (status || '').toLowerCase();
  return s.includes('curso') || s.includes('activ') || s.includes('en juego');
}

function TournamentCard({ item, onPress }) {
  const { colors: Colors } = useTheme();
  const { name, status, season, category, sex, teamCount, organizer } = item;
  const active = isActive(status);
  const coverColor = getCoverColor(category, sex, Colors);
  const iconColor = getCoverIconColor(category, sex, Colors);

  return (
    <TouchableOpacity
      style={{ backgroundColor: Colors.surface, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden', ...Shadow.sm, padding: Spacing.lg }}
      activeOpacity={0.9}
      onPress={onPress}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: Spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 }}>
          <View style={{ width: 48, height: 48, borderRadius: Radius.md, backgroundColor: coverColor, justifyContent: 'center', alignItems: 'center' }}>
            <MaterialCommunityIcons name="volleyball" size={28} color={iconColor} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: Typography.size.xl, fontWeight: Typography.weight.bold, color: Colors.textPrimary, lineHeight: 30 }} numberOfLines={2}>{name || 'Torneo'}</Text>
            <Text style={{ fontSize: Typography.size.sm, color: Colors.textMuted }} numberOfLines={1}>{organizer || season || 'Federación Vasca de Voleibol'}</Text>
          </View>
        </View>
        <View style={{ borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 4, marginLeft: Spacing.sm, backgroundColor: active ? Colors.successSoft : Colors.warningSoft, borderWidth: 1, borderColor: active ? `${Colors.success}40` : `${Colors.warning}40` }}>
          <Text style={{ fontSize: 10, fontWeight: Typography.weight.bold, letterSpacing: 0.8, color: active ? Colors.success : Colors.warning }}>
              {active ? 'ACTIVO' : 'PRÓXIMO'}
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.lg, marginBottom: Spacing.md }}>
          {category ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <MaterialIcons name="category" size={16} color={Colors.textMuted} />
              <Text style={{ fontSize: Typography.size.sm, color: Colors.textMuted }}>{category}</Text>
            </View>
          ) : null}
          {teamCount ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <MaterialIcons name="groups" size={16} color={Colors.textMuted} />
              <Text style={{ fontSize: Typography.size.sm, color: Colors.textMuted }}>{teamCount} equipos</Text>
            </View>
          ) : null}
      </View>

      <TouchableOpacity
        style={{ borderRadius: Radius.lg, paddingVertical: Spacing.sm + 2, alignItems: 'center', backgroundColor: Colors.primary }}
        onPress={onPress}
        activeOpacity={0.8}
      >
        <Text style={{ fontSize: Typography.size.md, fontWeight: Typography.weight.semiBold, color: Colors.textOnPrimary }}>
          Ver Detalles
        </Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

export default function TournamentList({ tableBlock, onOpenTournament }) {
  const { colors: Colors } = useTheme();
  if (!tableBlock?.rows?.length) {
    return (
      <View style={{ padding: Spacing.xxl, alignItems: 'center', gap: Spacing.sm }}>
        <MaterialIcons name="sports-volleyball" size={44} color={Colors.textMuted} />
        <Text style={{ color: Colors.textMuted, fontSize: Typography.size.md }}>No hay ligas disponibles</Text>
      </View>
    );
  }

  const headers = tableBlock.headers || [];

  const tournaments = tableBlock.rows.map((row, i) => ({
    id: String(i),
    name: getCell(row, headers, 'nombre'),
    status: getCell(row, headers, 'estado'),
    season: getCell(row, headers, 'temporada'),
    category: getCell(row, headers, 'categoría') || getCell(row, headers, 'categoria'),
    sex: getCell(row, headers, 'sexo') || getCell(row, headers, 'género') || getCell(row, headers, 'genero'),
    teamCount: getCell(row, headers, 'equipos') || getCell(row, headers, 'clubs'),
    organizer: getCell(row, headers, 'federación') || getCell(row, headers, 'federacion') || getCell(row, headers, 'organiza') || getCell(row, headers, 'asociación') || getCell(row, headers, 'asociacion'),
    href: tableBlock.rowLinks?.[i] || null,
  }));

  return (
    <FlatList
      data={tournaments}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md }}
      ItemSeparatorComponent={() => <View style={{ height: Spacing.md }} />}
      renderItem={({ item }) => (
        <TournamentCard
          item={item}
          onPress={() => item.href && onOpenTournament?.(item.href, item.name)}
        />
      )}
      scrollEnabled={false}
    />
  );
}
