// src/components/BlockRenderer.js
// Componente central que transforma el array de bloques parseados
// en componentes React Native con diseño propio.

import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Linking,
  StyleSheet,
} from 'react-native';
import { Spacing, Typography, Radius, Shadow } from '../styles/theme';
import { useTheme } from '../contexts/ThemeContext';

// ─── Renderiza un encabezado según su nivel (h1–h6) ─────────────────────────
function HeadingBlock({ block }) {
  const { colors } = useTheme();
  const levelStyles = [
    { fontSize: Typography.size.xxxl, fontWeight: Typography.weight.extraBold, color: colors.primaryDark, borderBottomWidth: 3, borderBottomColor: colors.primary, paddingBottom: Spacing.sm },
    { fontSize: Typography.size.xxl, fontWeight: Typography.weight.bold, color: colors.primary, borderLeftWidth: 4, borderLeftColor: colors.primary, paddingLeft: Spacing.md },
    { fontSize: Typography.size.xl, fontWeight: Typography.weight.semiBold, color: colors.primaryDark },
    { fontSize: Typography.size.lg, fontWeight: Typography.weight.medium, color: colors.textSecondary },
  ];
  const levelStyle = levelStyles[Math.min(block.level - 1, 3)];
  return (
    <Text style={[{ color: colors.textPrimary, marginTop: Spacing.xl, marginBottom: Spacing.sm, paddingHorizontal: Spacing.lg }, levelStyle]}>
      {block.content}
    </Text>
  );
}

// ─── Renderiza un párrafo de texto ───────────────────────────────────────────
function ParagraphBlock({ block }) {
  const { colors } = useTheme();
  return (
    <Text style={{ color: colors.textPrimary, fontSize: Typography.size.md, lineHeight: 24, marginVertical: Spacing.sm, paddingHorizontal: Spacing.lg }}>
      {block.content}
    </Text>
  );
}

// ─── Renderiza una lista ordenada o desordenada ──────────────────────────────
function ListBlock({ block }) {
  const { colors } = useTheme();
  return (
    <View style={{ marginVertical: Spacing.sm, paddingHorizontal: Spacing.lg }}>
      {block.items.map((item, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: Spacing.xs }}>
          <Text style={{ color: colors.primary, fontSize: Typography.size.md, fontWeight: Typography.weight.bold, marginRight: Spacing.sm, minWidth: 18 }}>
            {block.ordered ? `${i + 1}.` : '•'}
          </Text>
          <Text style={{ flex: 1, color: colors.textPrimary, fontSize: Typography.size.md, lineHeight: 22 }}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

// ─── Renderiza un enlace como botón tappable ─────────────────────────────────
function LinkBlock({ block }) {
  const { colors } = useTheme();
  const handlePress = () => { if (block.href) Linking.openURL(block.href); };
  return (
    <TouchableOpacity
      style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceAlt, borderRadius: Radius.md, marginVertical: Spacing.xs, marginHorizontal: Spacing.lg, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderWidth: 1, borderColor: colors.primaryAlpha15 }}
      onPress={handlePress}
    >
      <Text style={{ fontSize: 14, marginRight: Spacing.sm }}>🔗</Text>
      <Text style={{ color: colors.primary, fontSize: Typography.size.sm, fontWeight: Typography.weight.medium, flex: 1, textDecorationLine: 'underline' }} numberOfLines={2}>
        {block.content}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Renderiza una tabla HTML como tabla React Native con scroll horizontal ──
export function TableBlock({ block }) {
  const { colors } = useTheme();
  const colCount = Math.max(
    block.headers?.length || 0,
    ...(block.rows?.map((r) => r.length) || [0])
  );
  const COL_W = 100;

  return (
    <View style={{ marginVertical: Spacing.md, marginHorizontal: Spacing.lg, borderRadius: Radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, ...Shadow.sm }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          {block.headers && block.headers.length > 0 && (
            <View style={{ flexDirection: 'row', backgroundColor: colors.tableHeader }}>
              {block.headers.map((h, i) => (
                <View key={i} style={{ padding: Spacing.sm, borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.2)', width: COL_W }}>
                  <Text style={{ color: colors.textOnPrimary, fontSize: Typography.size.sm, fontWeight: Typography.weight.bold, textAlign: 'center' }} numberOfLines={2}>
                    {h}
                  </Text>
                </View>
              ))}
            </View>
          )}
          {block.rows?.map((row, ri) => (
            <View
              key={ri}
              style={[
                { flexDirection: 'row' },
                { backgroundColor: ri % 2 === 0 ? colors.tableRowEven : colors.tableRowOdd },
              ]}
            >
              {Array.from({ length: colCount }).map((_, ci) => (
                <View key={ci} style={{ padding: Spacing.sm, borderRightWidth: 1, borderRightColor: colors.border, borderBottomWidth: 1, borderBottomColor: colors.divider, justifyContent: 'center', width: COL_W }}>
                  <Text style={{ color: colors.textPrimary, fontSize: Typography.size.sm, textAlign: 'center' }} numberOfLines={3}>
                    {row[ci] || ''}
                  </Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Componente principal: recibe el array de bloques y los renderiza ────────
export default function BlockRenderer({ blocks }) {
  const { colors } = useTheme();
  if (!blocks || blocks.length === 0) {
    return (
      <View style={{ padding: Spacing.xxl, alignItems: 'center' }}>
        <Text style={{ color: colors.textMuted, fontSize: Typography.size.md }}>Sin contenido disponible</Text>
      </View>
    );
  }

  return (
    <View>
      {blocks.map((block, index) => {
        switch (block.type) {
          case 'heading':
            return <HeadingBlock key={index} block={block} />;
          case 'paragraph':
            return <ParagraphBlock key={index} block={block} />;
          case 'list':
            return <ListBlock key={index} block={block} />;
          case 'link':
            return <LinkBlock key={index} block={block} />;
          case 'table':
            return <TableBlock key={index} block={block} />;
          default:
            return null;
        }
      })}
    </View>
  );
}

