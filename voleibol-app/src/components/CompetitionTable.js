import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Spacing, Typography, Radius } from '../styles/theme';
import { useTheme } from '../contexts/ThemeContext';
import { getDominantBorderColor } from '../utils/imageColor';
import { getCachedLogoColorSync, requestLogoColorExtraction, subscribeToLogoColor } from '../utils/logoColorCache';

function getInitials(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

function findColIndex(headers, ...keywords) {
  for (const kw of keywords) {
    const idx = headers.findIndex((h) => h.toLowerCase().includes(kw));
    if (idx >= 0) return idx;
  }
  return -1;
}

function normalizeHeader(value = '') {
  return String(value || '').trim().toLowerCase();
}

function findRepeatedPIndexes(headers) {
  return headers.reduce((indexes, header, index) => {
    if (normalizeHeader(header) === 'p') indexes.push(index);
    return indexes;
  }, []);
}

function findPositionCol(headers, teamCol) {
  const explicit = findColIndex(headers, 'pos', 'puesto', '#');
  if (explicit >= 0) return explicit;

  const repeatedPIndexes = findRepeatedPIndexes(headers);
  const candidates = repeatedPIndexes.filter((index) => teamCol < 0 || index < teamCol);
  return candidates[0] ?? repeatedPIndexes[0] ?? -1;
}

function findPointsCol(headers, teamCol) {
  const explicit = findColIndex(headers, 'pts', 'puntos', 'point');
  if (explicit >= 0) return explicit;

  const repeatedPIndexes = findRepeatedPIndexes(headers);
  const candidates = repeatedPIndexes.filter((index) => teamCol < 0 || index > teamCol);
  return candidates[0] ?? repeatedPIndexes[1] ?? -1;
}

function findExactHeaderIndex(headers, ...aliases) {
  const normalizedAliases = aliases.map((value) => normalizeHeader(value));
  return headers.findIndex((header) => normalizedAliases.includes(normalizeHeader(header)));
}

function getTopColor(pos) {
  if (pos === 0) return '#f59e0b';
  if (pos === 1) return '#94a3b8';
  if (pos === 2) return '#d97706';
  return null;
}

function stripLogoResolution(url = '') {
  if (!url) return '';
  return String(url).replace(/\.\d+x\d+(?=\.[a-zA-Z0-9]+(?:[?#].*)?$)/, '');
}

function withLogoResolution(url = '', size = 120) {
  if (!url) return '';
  const clean = stripLogoResolution(url);
  return clean.replace(/(\.[a-zA-Z0-9]+)([?#].*)?$/, `.${size}x${size}$1$2`);
}

function buildLogoCandidates(url = '') {
  if (!url) return [];
  const base = stripLogoResolution(url);
  return [
    base,
    withLogoResolution(base, 120),
    withLogoResolution(base, 60),
    withLogoResolution(base, 30),
  ].filter((value, index, list) => value && list.indexOf(value) === index);
}

function TeamLogo({ teamLogo, initials, Colors }) {
  const candidates = useMemo(() => buildLogoCandidates(teamLogo), [teamLogo]);
  const [index, setIndex] = useState(0);
  const [bgColor, setBgColor] = useState(() => getCachedLogoColorSync(candidates[0]) || '#ffffff');
  const uri = candidates[index] || null;

  useEffect(() => {
    if (!uri) { setBgColor(Colors.surfaceAlt); return; }
    const cached = getCachedLogoColorSync(uri);
    if (cached) { setBgColor(cached); }
    requestLogoColorExtraction(uri, getDominantBorderColor);
    let mounted = true;
    const unsubscribe = subscribeToLogoColor(uri, (color) => {
      if (mounted && color) setBgColor(color);
    });
    return () => { mounted = false; unsubscribe(); };
  }, [uri, Colors.surfaceAlt]);

  return (
    <View style={{ width: 32, height: 32, borderRadius: Radius.sm, backgroundColor: uri ? bgColor : Colors.surfaceAlt, justifyContent: 'center', alignItems: 'center' }}>
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: 24, height: 24 }}
          resizeMode="contain"
          onError={() => setIndex((current) => (current + 1 < candidates.length ? current + 1 : candidates.length))}
        />
      ) : (
        <Text style={{ color: Colors.textMuted, fontSize: 11, fontWeight: Typography.weight.bold }}>{initials || '?'}</Text>
      )}
    </View>
  );
}

export default function CompetitionTable({ tableBlock, title, onPressTeam, onPressExpand }) {
  const { colors: Colors } = useTheme();

  if (!tableBlock || !tableBlock.rows?.length) {
    return (
      <View style={{ padding: Spacing.xl, alignItems: 'center' }}>
        <Text style={{ color: Colors.textMuted, fontSize: Typography.size.md }}>Sin datos de clasificación</Text>
      </View>
    );
  }

  const { headers, rows } = tableBlock;

  const teamCol = findColIndex(headers, 'equipo', 'club', 'nombre', 'team');
  const posCol = findPositionCol(headers, teamCol);
  const ptsCol = findPointsCol(headers, teamCol);
  const pjCol = findExactHeaderIndex(headers, 'pj') >= 0 ? findExactHeaderIndex(headers, 'pj') : findColIndex(headers, 'jug', 'played');
  const vCol = findExactHeaderIndex(headers, 'v') >= 0 ? findExactHeaderIndex(headers, 'v') : findExactHeaderIndex(headers, 'pg');
  const eCol = findExactHeaderIndex(headers, 'e') >= 0 ? findExactHeaderIndex(headers, 'e') : findExactHeaderIndex(headers, 'pe');
  const dCol = findExactHeaderIndex(headers, 'd') >= 0 ? findExactHeaderIndex(headers, 'd') : findExactHeaderIndex(headers, 'pp');
  const statCols = [
    { key: 'pj', label: 'PJ', index: pjCol },
    { key: 'v', label: 'V', index: vCol },
    { key: 'e', label: 'E', index: eCol },
    { key: 'd', label: 'D', index: dCol },
  ].filter((item) => item.index >= 0);
  const getCell = (row, idx, fallback = '-') => {
    if (idx < 0) return fallback;
    const value = String(row[idx] ?? '').trim();
    return value || fallback;
  };

  return (
    <View style={{ marginBottom: Spacing.xl }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.xxl, marginBottom: 0, backgroundColor: Colors.background, paddingVertical: Spacing.sm + 6 }}>
        <Text style={{ color: Colors.textMuted, fontSize: 10, fontWeight: Typography.weight.bold, flex: 1, textTransform: 'uppercase', letterSpacing: 1.6 }} numberOfLines={1}>
          {title || 'Temporada oficial'}
        </Text>
        <TouchableOpacity
          onPress={() => onPressExpand?.(tableBlock, title)}
          activeOpacity={0.75}
          style={{ width: '46%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: Radius.md, backgroundColor: Colors.surface, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm, marginLeft: Spacing.sm }}
        >
          <MaterialIcons name="fullscreen" size={16} color={Colors.textSecondary} />
          <Text style={{ color: Colors.textSecondary, fontSize: 10, fontWeight: Typography.weight.semiBold }}>Pantalla completa</Text>
        </TouchableOpacity>
      </View>

      <View>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, backgroundColor: Colors.background }}>
          <Text style={{ width: 30, color: Colors.textMuted, fontSize: 10, fontWeight: Typography.weight.bold, textTransform: 'uppercase' }}>Pos</Text>
          <Text style={{ flex: 1, color: Colors.textMuted, fontSize: 10, fontWeight: Typography.weight.bold, textTransform: 'uppercase' }}>Equipo</Text>
          {statCols.map((stat) => (
            <Text key={`head-${stat.key}`} style={{ width: 30, textAlign: 'center', color: Colors.textMuted, fontSize: 10, fontWeight: Typography.weight.bold, textTransform: 'uppercase' }}>
              {stat.label}
            </Text>
          ))}
          <Text style={{ width: 40, textAlign: 'right', color: Colors.textMuted, fontSize: 10, fontWeight: Typography.weight.bold, textTransform: 'uppercase' }}>Pts</Text>
        </View>

        {rows.map((row, ri) => {
          const teamName = getCell(row, teamCol, row[1] || row[0] || '—');
          const posLabel = getCell(row, posCol, String(ri + 1));
          const ptsVal = getCell(row, ptsCol, '-');
          const initials = getInitials(teamName);
          const rowLinks = tableBlock.rowLinks || [];
          const rowLogos = tableBlock.rowLogos || tableBlock.rowImages || [];
          const teamUrl = rowLinks[ri] || null;
          const teamLogo = rowLogos[ri] || null;

          const topColor = getTopColor(ri);
          const isRelegation = ri >= Math.max(rows.length - 2, 0);
          const rowHighlight = topColor
            ? { backgroundColor: `${topColor}20` }
            : isRelegation
              ? { borderLeftWidth: 3, borderLeftColor: '#ef4444' }
              : null;

          const RowWrapper = onPressTeam
            ? ({ children }) => (
                <TouchableOpacity
                  key={ri}
                  style={[{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm + 3, backgroundColor: Colors.background }, rowHighlight]}
                  activeOpacity={0.75}
                  onPress={() => onPressTeam(teamName, teamUrl, teamLogo, {
                    position: posLabel,
                    played: getCell(row, pjCol, '-'),
                    won: getCell(row, vCol, '-'),
                    points: ptsVal,
                  })}
                >
                  {children}
                </TouchableOpacity>
              )
            : ({ children }) => (
                <View key={ri} style={[{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm + 3, backgroundColor: Colors.background }, rowHighlight]}>
                  {children}
                </View>
              );

          return (
            <RowWrapper key={ri}>
              <Text style={{ width: 30, color: topColor || (isRelegation ? '#ef4444' : Colors.textMuted), fontSize: Typography.size.sm, fontWeight: Typography.weight.bold, textAlign: 'center' }}>
                {posLabel}
              </Text>

              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.xs }}>
                <TeamLogo teamLogo={teamLogo} initials={initials} Colors={Colors} />
                <Text style={{ flex: 1, color: Colors.textPrimary, fontSize: Typography.size.sm, fontWeight: ri < 3 ? Typography.weight.bold : Typography.weight.medium }} numberOfLines={1}>
                  {teamName}
                </Text>
              </View>

              {statCols.map((stat) => (
                <Text key={`row-${ri}-${stat.key}`} style={{ width: 30, textAlign: 'center', color: Colors.textSecondary, fontSize: Typography.size.xs, fontWeight: Typography.weight.medium }}>
                  {getCell(row, stat.index, '-')}
                </Text>
              ))}

              <Text style={{ width: 40, textAlign: 'right', color: Colors.textPrimary, fontSize: Typography.size.sm, fontWeight: Typography.weight.bold }}>{ptsVal}</Text>
            </RowWrapper>
          );
        })}
      </View>

      <View style={{ marginTop: Spacing.lg, marginHorizontal: Spacing.lg, paddingVertical: Spacing.sm, gap: Spacing.sm }}>
        <Text style={{ color: Colors.textMuted, fontSize: Typography.size.xs, fontWeight: Typography.weight.bold, textTransform: 'uppercase', letterSpacing: 1 }}>Leyenda</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
          <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: '#f59e0b33' }} />
          <Text style={{ color: Colors.textMuted, fontSize: Typography.size.xs }}>Clasificación directa para Fase Final</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
          <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: '#ef444433' }} />
          <Text style={{ color: Colors.textMuted, fontSize: Typography.size.xs }}>Permanencia en Liga</Text>
        </View>
      </View>
    </View>
  );
}

