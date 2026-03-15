import React, { useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StatusBar,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ScreenOrientation from 'expo-screen-orientation';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Radius, Shadow, Spacing, Typography } from '../styles/theme';
import { useTheme } from '../contexts/ThemeContext';

function findColIndex(headers, ...keywords) {
  for (const kw of keywords) {
    const idx = headers.findIndex((h) => String(h || '').toLowerCase().includes(kw));
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

function getCell(row, idx, fallback = '-') {
  if (idx < 0) return fallback;
  const value = String(row[idx] ?? '').trim();
  return value || fallback;
}

function getInitials(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk[0]?.toUpperCase())
    .join('');
}

function formatDiff(value = '-') {
  if (!value || value === '-') return '-';
  if (/^[+-]/.test(value)) return value;
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return value;
  if (numeric > 0) return `+${numeric}`;
  return `${numeric}`;
}

function getRowAccent(index) {
  if (index === 0) return 'rgba(13, 143, 242, 0.10)';
  if (index === 1 || index === 2) return 'rgba(13, 143, 242, 0.05)';
  return 'transparent';
}

function getPositionBadgeColor(index) {
  if (index === 0) return '#0d8ff2';
  if (index === 1 || index === 2) return 'rgba(13, 143, 242, 0.40)';
  return 'transparent';
}

function getDiffBadgeStyle(value, colors) {
  const numeric = Number(value);
  if (!Number.isNaN(numeric) && numeric > 0) {
    return {
      backgroundColor: 'rgba(13, 143, 242, 0.20)',
      borderColor: 'rgba(13, 143, 242, 0.30)',
      textColor: colors.primary,
    };
  }
  if (!Number.isNaN(numeric) && numeric < 0) {
    return {
      backgroundColor: 'rgba(244, 63, 94, 0.12)',
      borderColor: 'rgba(244, 63, 94, 0.20)',
      textColor: '#fb7185',
    };
  }
  return {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    textColor: colors.textMuted,
  };
}

function findExactHeaderIndex(headers, ...candidates) {
  const normalizedHeaders = headers.map((header) => normalizeHeader(header).replace(/\s+/g, ''));
  for (const candidate of candidates) {
    const normalizedCandidate = normalizeHeader(candidate).replace(/\s+/g, '');
    const index = normalizedHeaders.findIndex((header) => header === normalizedCandidate);
    if (index >= 0) return index;
  }
  return -1;
}

export default function RankingTableScreen({ route, navigation }) {
  const { colors: Colors } = useTheme();
  const { tableBlock, title, subtitle } = route.params || {};
  const { width: windowWidth } = useWindowDimensions();

  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    };
  }, []);

  const headers = tableBlock?.headers || [];
  const rows = tableBlock?.rows || [];
  const rowLogos = tableBlock?.rowLogos || tableBlock?.rowImages || [];

  const teamCol = useMemo(() => findColIndex(headers, 'equipo', 'club', 'nombre', 'team'), [headers]);
  const posCol = useMemo(() => findPositionCol(headers, teamCol), [headers, teamCol]);
  const ptsCol = useMemo(() => findPointsCol(headers, teamCol), [headers, teamCol]);
  const pjCol = useMemo(() => findColIndex(headers, 'pj', 'jugados', 'played'), [headers]);
  const wonCol = useMemo(() => findColIndex(headers, 'pg', 'ganad', 'wins'), [headers]);
  const drawCol = useMemo(() => findColIndex(headers, 'pe', 'empat', 'draw'), [headers]);
  const lostCol = useMemo(() => findColIndex(headers, 'pp', 'perdid', 'lost'), [headers]);
  const g3Col = useMemo(() => findExactHeaderIndex(headers, 'g3'), [headers]);
  const g2Col = useMemo(() => findExactHeaderIndex(headers, 'g2'), [headers]);
  const p1Col = useMemo(() => findExactHeaderIndex(headers, 'p1'), [headers]);
  const p0Col = useMemo(() => findExactHeaderIndex(headers, 'p0'), [headers]);
  const setsFavorCol = useMemo(() => findExactHeaderIndex(headers, 'f'), [headers]);
  const setsAgainstCol = useMemo(() => findExactHeaderIndex(headers, 'c'), [headers]);
  const setsDiffCol = useMemo(() => findExactHeaderIndex(headers, 'd'), [headers]);
  const favorCol = useMemo(() => findExactHeaderIndex(headers, 'pf') >= 0 ? findExactHeaderIndex(headers, 'pf') : findColIndex(headers, 'favor'), [headers]);
  const againstCol = useMemo(() => findExactHeaderIndex(headers, 'pc') >= 0 ? findExactHeaderIndex(headers, 'pc') : findColIndex(headers, 'contra'), [headers]);
  const diffCol = useMemo(() => {
    const explicit = findExactHeaderIndex(headers, 'dp', 'f/c', 'a/d');
    if (explicit >= 0) return explicit;
    return findColIndex(headers, 'difer');
  }, [headers]);
  const adCol = useMemo(() => findExactHeaderIndex(headers, 'a/d'), [headers]);

  const statColumns = useMemo(() => {
    const columns = [
      { key: 'points', label: 'PTS', index: ptsCol, tone: 'primary' },
      { key: 'played', label: 'PJ', index: pjCol, tone: 'neutral' },
      { key: 'won', label: 'PG', index: wonCol, tone: 'win' },
      { key: 'draw', label: 'PE', index: drawCol, tone: 'neutral' },
      { key: 'lost', label: 'PP', index: lostCol, tone: 'loss' },
      { key: 'g3', label: 'G3', index: g3Col, tone: 'win' },
      { key: 'g2', label: 'G2', index: g2Col, tone: 'win' },
      { key: 'p1', label: 'P1', index: p1Col, tone: 'neutral' },
      { key: 'p0', label: 'P0', index: p0Col, tone: 'loss' },
      { key: 'setsFavor', label: 'F', index: setsFavorCol, tone: 'neutral' },
      { key: 'setsAgainst', label: 'C', index: setsAgainstCol, tone: 'neutral' },
      { key: 'setsDiff', label: 'D', index: setsDiffCol, tone: 'diff' },
      { key: 'favor', label: 'PF', index: favorCol, tone: 'neutral' },
      { key: 'against', label: 'PC', index: againstCol, tone: 'neutral' },
      { key: 'diff', label: 'DP', index: diffCol, tone: 'diff' },
      { key: 'ad', label: 'A/D', index: adCol, tone: 'diff' },
    ];

    return columns.filter((column) => column.index >= 0);
  }, [adCol, againstCol, diffCol, drawCol, favorCol, g2Col, g3Col, lostCol, p0Col, p1Col, pjCol, ptsCol, setsAgainstCol, setsDiffCol, setsFavorCol, wonCol]);

  const compactMode = statColumns.length >= 10;
  const statColumnWidth = compactMode ? 44 : 58;
  const posColumnWidth = compactMode ? 52 : 64;
  const teamColumnWidth = compactMode ? 230 : 280;
  const horizontalPadding = Spacing.xl * 2;
  const tableMinWidth = posColumnWidth + teamColumnWidth + (statColumns.length * statColumnWidth);
  const tableWidth = Math.max(windowWidth - horizontalPadding, tableMinWidth);

  const renderedRows = useMemo(
    () => rows.map((row, index) => ({
      key: `row-${index}`,
      index,
      position: getCell(row, posCol, String(index + 1)),
      teamName: getCell(row, teamCol, row[1] || row[0] || 'Equipo'),
      values: statColumns.reduce((acc, column) => {
        const rawValue = getCell(row, column.index, '-');
        acc[column.key] = column.key === 'diff' || column.key === 'setsDiff' || column.key === 'ad'
          ? formatDiff(rawValue)
          : rawValue;
        return acc;
      }, {}),
      logo: rowLogos[index] || null,
    })),
    [posCol, rowLogos, rows, statColumns, teamCol]
  );

  const styles = useMemo(() => StyleSheet.create({
    safe: { flex: 1, backgroundColor: Colors.background },
    rootScroll: { flex: 1, backgroundColor: Colors.background },
    content: {
      width: '100%',
      maxWidth: 1400,
      alignSelf: 'center',
      paddingHorizontal: Spacing.xl,
      paddingTop: Spacing.xl,
      paddingBottom: Spacing.xxl,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottomWidth: 1,
      borderBottomColor: Colors.divider,
      paddingBottom: Spacing.xl,
      marginBottom: Spacing.xl,
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flex: 1 },
    headerIconBox: {
      width: 48,
      height: 48,
      borderRadius: Radius.lg,
      backgroundColor: Colors.primaryAlpha10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitleWrap: { flex: 1 },
    headerTitle: {
      color: Colors.textPrimary,
      fontSize: Typography.size.xxl,
      fontWeight: Typography.weight.black || Typography.weight.extraBold,
      letterSpacing: -0.5,
    },
    headerSubtitle: {
      color: Colors.textMuted,
      fontSize: Typography.size.sm,
      marginTop: 2,
    },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginLeft: Spacing.md },
    exitButton: {
      width: 40,
      height: 40,
      borderRadius: Radius.md,
      backgroundColor: Colors.surfaceAlt,
      borderWidth: 1,
      borderColor: Colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tableCard: {
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: Colors.divider,
      backgroundColor: 'rgba(15, 23, 42, 0.35)',
      overflow: 'hidden',
      ...Shadow.lg,
    },
    tableScroller: { flexGrow: 0 },
    tableInner: { width: tableWidth },
    tableHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: Colors.surfaceAlt,
      borderBottomWidth: 1,
      borderBottomColor: Colors.divider,
    },
    tableBodyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: Colors.divider,
      backgroundColor: Colors.background,
    },
    cellPos: { width: posColumnWidth, alignItems: 'center', justifyContent: 'center', paddingHorizontal: compactMode ? 4 : Spacing.sm, paddingVertical: compactMode ? Spacing.md : Spacing.lg },
    cellTeam: { width: teamColumnWidth, paddingHorizontal: compactMode ? Spacing.sm : Spacing.lg, paddingVertical: compactMode ? Spacing.md : Spacing.lg, justifyContent: 'center' },
    cellStat: { width: statColumnWidth, alignItems: 'center', justifyContent: 'center', paddingHorizontal: compactMode ? 2 : Spacing.xs, paddingVertical: compactMode ? Spacing.md : Spacing.lg },
    headerLabel: { color: Colors.textMuted, fontSize: compactMode ? 9 : 11, fontWeight: Typography.weight.bold, textTransform: 'uppercase', letterSpacing: 0.4 },
    headerLabelPrimary: { color: Colors.primary },
    posBadge: { width: compactMode ? 26 : 32, height: compactMode ? 26 : 32, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
    posBadgeText: { color: Colors.textPrimary, fontSize: compactMode ? 11 : Typography.size.sm, fontWeight: Typography.weight.bold },
    posPlainText: { color: Colors.textMuted, fontSize: compactMode ? 11 : Typography.size.sm, fontWeight: Typography.weight.bold },
    teamRow: { flexDirection: 'row', alignItems: 'center', gap: compactMode ? Spacing.sm : Spacing.md, minWidth: 0 },
    logoWrap: {
      width: compactMode ? 30 : 40,
      height: compactMode ? 30 : 40,
      borderRadius: Radius.full,
      backgroundColor: Colors.surfaceAlt,
      borderWidth: 1,
      borderColor: 'rgba(13, 143, 242, 0.20)',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    logoImage: { width: '100%', height: '100%' },
    logoInitials: { color: Colors.textMuted, fontSize: compactMode ? 9 : Typography.size.xs, fontWeight: Typography.weight.bold },
    teamName: { flex: 1, color: Colors.textPrimary, fontSize: compactMode ? 11 : Typography.size.md, fontWeight: Typography.weight.semiBold },
    statText: { fontSize: compactMode ? 10 : Typography.size.sm, fontWeight: Typography.weight.medium },
    numberPrimary: { color: Colors.primary, fontSize: compactMode ? 12 : Typography.size.lg, fontWeight: Typography.weight.bold },
    numberNeutral: { color: Colors.textSecondary },
    numberWin: { color: Colors.success, fontWeight: Typography.weight.semiBold },
    numberLoss: { color: '#f43f5e', fontWeight: Typography.weight.semiBold },
    diffBadge: {
      minWidth: compactMode ? 34 : 54,
      paddingHorizontal: compactMode ? 6 : Spacing.sm,
      paddingVertical: compactMode ? 2 : 4,
      borderRadius: Radius.full,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    diffText: { fontSize: compactMode ? 9 : Typography.size.xs, fontWeight: Typography.weight.bold },
    footer: {
      marginTop: Spacing.lg,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.md,
      flexWrap: 'wrap',
    },
    footerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xl, flexWrap: 'wrap' },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    legendDot: { width: 12, height: 12, borderRadius: Radius.full },
    legendText: { color: Colors.textMuted, fontSize: Typography.size.sm },
    footerRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
    footerUpdate: { color: Colors.textMuted, fontSize: Typography.size.sm, fontStyle: 'italic' },
    emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xxl, gap: Spacing.md },
    emptyText: { color: Colors.textMuted, fontSize: Typography.size.md },
  }), [Colors, compactMode, posColumnWidth, statColumnWidth, tableWidth, teamColumnWidth]);

  if (!renderedRows.length) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
        <View style={styles.emptyWrap}>
          <MaterialIcons name="emoji-events" size={44} color={Colors.textMuted} />
          <Text style={styles.emptyText}>Sin datos de clasificación</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      <ScrollView style={styles.rootScroll} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.headerIconBox}>
              <MaterialCommunityIcons name="volleyball" size={28} color={Colors.primary} />
            </View>
            <View style={styles.headerTitleWrap}>
              <Text style={styles.headerTitle} numberOfLines={1}>{title || 'Clasificación oficial'}</Text>
              <Text style={styles.headerSubtitle} numberOfLines={1}>{subtitle || 'Datos oficiales de la federación'}</Text>
            </View>
          </View>

          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.exitButton} activeOpacity={0.85} onPress={() => navigation.goBack()}>
              <MaterialIcons name="fullscreen-exit" size={21} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.tableCard}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tableScroller} contentContainerStyle={styles.tableInner}>
            <View style={styles.tableInner}>
              <View style={styles.tableHeaderRow}>
                <View style={styles.cellPos}><Text style={styles.headerLabel}>POS</Text></View>
                <View style={styles.cellTeam}><Text style={styles.headerLabel}>TEAM</Text></View>
                {statColumns.map((column) => (
                  <View key={column.key} style={styles.cellStat}>
                    <Text style={[styles.headerLabel, column.tone === 'primary' && styles.headerLabelPrimary]}>{column.label}</Text>
                  </View>
                ))}
              </View>

              {renderedRows.map((row) => {
                const showPosBadge = row.index < 3;

                return (
                  <View
                    key={row.key}
                    style={[
                      styles.tableBodyRow,
                      row.index < 3 ? { backgroundColor: getRowAccent(row.index) } : null,
                    ]}
                  >
                    <View style={styles.cellPos}>
                      {showPosBadge ? (
                        <View style={[styles.posBadge, { backgroundColor: getPositionBadgeColor(row.index) }]}>
                          <Text style={styles.posBadgeText}>{row.position}</Text>
                        </View>
                      ) : (
                        <Text style={styles.posPlainText}>{row.position}</Text>
                      )}
                    </View>

                    <View style={styles.cellTeam}>
                      <View style={styles.teamRow}>
                        <View style={styles.logoWrap}>
                          {row.logo ? (
                            <Image source={{ uri: row.logo }} style={styles.logoImage} resizeMode="cover" />
                          ) : (
                            <Text style={styles.logoInitials}>{getInitials(row.teamName) || '?'}</Text>
                          )}
                        </View>
                        <Text style={styles.teamName} numberOfLines={1}>{row.teamName}</Text>
                      </View>
                    </View>

                    {statColumns.map((column) => {
                      const value = row.values[column.key] ?? '-';

                      if (column.tone === 'diff') {
                        const badgeStyle = getDiffBadgeStyle(value, Colors);
                        return (
                          <View key={column.key} style={styles.cellStat}>
                            <View style={[styles.diffBadge, { backgroundColor: badgeStyle.backgroundColor, borderColor: badgeStyle.borderColor }]}>
                              <Text style={[styles.diffText, { color: badgeStyle.textColor }]}>{value}</Text>
                            </View>
                          </View>
                        );
                      }

                      const textStyle = [styles.statText];
                      if (column.tone === 'primary') textStyle.push(styles.numberPrimary);
                      if (column.tone === 'neutral') textStyle.push(styles.numberNeutral);
                      if (column.tone === 'win') textStyle.push(styles.numberWin);
                      if (column.tone === 'loss') textStyle.push(styles.numberLoss);

                      return (
                        <View key={column.key} style={styles.cellStat}>
                          <Text style={textStyle}>{value}</Text>
                        </View>
                      );
                    })}
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </View>

        <View style={styles.footer}>
          <View style={styles.footerLeft}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: Colors.primary }]} />
              <Text style={styles.legendText}>Play-off ascenso</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: 'rgba(13, 143, 242, 0.40)' }]} />
              <Text style={styles.legendText}>Play-off promoción</Text>
            </View>
          </View>

          <View style={styles.footerRight}>
            <MaterialIcons name="update" size={16} color={Colors.textMuted} />
            <Text style={styles.footerUpdate}>Datos oficiales federativos</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
