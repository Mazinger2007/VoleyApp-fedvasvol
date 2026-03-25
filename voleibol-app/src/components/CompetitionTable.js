import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
} from 'react-native';
import { Image } from 'expo-image';
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
          source={uri}
          style={{ width: 24, height: 24 }}
          contentFit="contain"
          transition={{ effect: 'cross-dissolve', duration: 100 }}
          cachePolicy="memory-disk"
          onError={() => setIndex((current) => (current + 1 < candidates.length ? current + 1 : candidates.length))}
        />
      ) : (
        <Text style={{ color: Colors.textMuted, fontSize: 11, fontWeight: Typography.weight.bold }}>{initials || '?'}</Text>
      )}
    </View>
  );
}

function CompetitionTable({ tableBlock, title, onPressTeam, onPressExpand }) {
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

  const getCell = (row, idx, fallback = '-') => {
    if (idx < 0) return fallback;
    const value = String(row[idx] ?? '').trim();
    return value || fallback;
  };

  return (
    <View style={{ marginBottom: Spacing.xl }}>


      <View style={{ flex: 1, backgroundColor: Colors.background }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, backgroundColor: Colors.surfaceAlt, borderBottomWidth: 1, borderBottomColor: Colors.border }}>
          <Text style={{ width: 40, color: Colors.textMuted, fontSize: 10, fontWeight: Typography.weight.bold, textTransform: 'uppercase', letterSpacing: 1.6 }}>Pos</Text>
          <Text style={{ flex: 1, color: Colors.textMuted, fontSize: 10, fontWeight: Typography.weight.bold, textTransform: 'uppercase', letterSpacing: 1.6 }}>Equipo</Text>
          <Text style={{ width: 40, textAlign: 'right', color: Colors.textMuted, fontSize: 10, fontWeight: Typography.weight.bold, textTransform: 'uppercase', letterSpacing: 1.6 }}>Pts</Text>
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

          const rowContent = (
            <>
              <View style={{ width: 40, flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ color: topColor || (isRelegation ? '#ef4444' : Colors.textPrimary), fontSize: Typography.size.sm, fontWeight: Typography.weight.bold }}>
                  {posLabel}
                </Text>
                {(topColor || isRelegation) && (
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: topColor ? '#10b981' : '#ef4444', marginLeft: 4 }} />
                )}
              </View>

              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                <TeamLogo teamLogo={teamLogo} initials={initials} Colors={Colors} />
                <Text style={{ flex: 1, color: Colors.textPrimary, fontSize: Typography.size.sm, fontWeight: Typography.weight.semiBold }} numberOfLines={1}>
                  {teamName}
                </Text>
              </View>

              <Text style={{ width: 40, textAlign: 'right', color: Colors.primary, fontSize: Typography.size.sm, fontWeight: Typography.weight.bold }}>{ptsVal}</Text>
            </>
          );

          if (onPressTeam) {
            return (
              <TouchableOpacity
                key={ri}
                style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, backgroundColor: Colors.background, borderBottomWidth: 1, borderBottomColor: Colors.border }}
                activeOpacity={0.75}
                onPress={() => onPressTeam(teamName, teamUrl, teamLogo, {
                  position: posLabel,
                  played: getCell(row, pjCol, '-'),
                  won: getCell(row, vCol, '-'),
                  points: ptsVal,
                })}
              >
                {rowContent}
              </TouchableOpacity>
            );
          }

          return (
            <View key={ri} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, backgroundColor: Colors.background, borderBottomWidth: 1, borderBottomColor: Colors.border }}>
              {rowContent}
            </View>
          );
        })}
      </View>

      <View style={{ padding: Spacing.lg, gap: Spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xl }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#10b981' }} />
            <Text style={{ color: Colors.textMuted, fontSize: Typography.size.xs, fontWeight: Typography.weight.medium }}>Fase Final</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444' }} />
            <Text style={{ color: Colors.textMuted, fontSize: Typography.size.xs, fontWeight: Typography.weight.medium }}>Permanencia</Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => onPressExpand?.(tableBlock, title)}
          activeOpacity={0.75}
          style={{ width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: Radius.xl, backgroundColor: Colors.surfaceAlt, paddingVertical: Spacing.md + 2 }}
        >
          <MaterialIcons name="fullscreen" size={18} color={Colors.textPrimary} />
          <Text style={{ color: Colors.textPrimary, fontSize: Typography.size.sm, fontWeight: Typography.weight.bold }}>Pantalla Completa</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
export default React.memo(CompetitionTable);