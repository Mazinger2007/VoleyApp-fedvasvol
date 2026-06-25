import React, { useEffect, useMemo, useState, useRef } from 'react';
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
import { Radius, Shadow, Spacing, Typography } from '../../styles/theme';
import { useTheme } from '../../contexts/ThemeContext';
import { cacheTeamsFromRanking, getTeamFromCache } from '../../utils/teamCache';

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

function getRowAccent(index, isDark, colors) {
  if (index === 0) return isDark ? 'rgba(13, 143, 242, 0.12)' : 'rgba(13, 143, 242, 0.05)';
  if (index === 1 || index === 2) return isDark ? 'rgba(13, 143, 242, 0.06)' : 'rgba(13, 143, 242, 0.03)';
  return 'transparent';
}

function getPositionBadgeColor(index, colors) {
  if (index === 0) return colors.primary;
  if (index === 1 || index === 2) return colors.primaryAlpha20 || 'rgba(13, 143, 242, 0.20)';
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

const COLUMN_FULL_NAMES = {
  points: 'Puntos',
  played: 'Partidos Jugados',
  won: 'Partidos Ganados',
  draw: 'Partidos Empatados',
  lost: 'Partidos Perdidos',
  g3: 'Ganados 3-0',
  g2: 'Ganados 3-1 o 3-2',
  p1: 'Perdidos 1-3 o 2-3',
  p0: 'Perdidos 0-3',
  setsFavor: 'Sets a Favor',
  setsAgainst: 'Sets en Contra',
  setsDiff: 'Diferencia de Sets',
  favor: 'Puntos a Favor',
  against: 'Puntos en Contra',
  diff: 'Diferencia de Puntos',
  ad: 'Average (F/C)',
  pfpc: 'Average de Puntos (PF/PC)',
};

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
  const { colors: Colors, isDark } = useTheme();
  const { tableBlock, title, subtitle } = route.params || {};
  const { width: windowWidth } = useWindowDimensions();
  const [tooltipKey, setTooltipKey] = useState(null);
  const tooltipTimer = useRef(null);

  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
    
    // Al entrar, si tenemos la URL del ranking, forzamos el cacheo de estos datos
    if (route.params?.rankingUrl && tableBlock) {
      cacheTeamsFromRanking(route.params.rankingUrl, [tableBlock]);
    }

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
    const explicit = findExactHeaderIndex(headers, 'dp');
    if (explicit >= 0) return explicit;
    return findColIndex(headers, 'difer');
  }, [headers]);
  const adCol = useMemo(() => {
    const exact = findExactHeaderIndex(headers, 'a/d', 'f/c');
    if (exact >= 0) return exact;
    return findColIndex(headers, 'a/d', 'f/c');
  }, [headers]);
  const pfpcCol = useMemo(() => {
    const exact = findExactHeaderIndex(headers, 'pf/pc');
    if (exact >= 0) return exact;
    return findColIndex(headers, 'pf/pc');
  }, [headers]);

  const hasAdData = useMemo(() => {
    if (adCol < 0) return false;
    return rows.some((row) => getCell(row, adCol, '').length > 0);
  }, [rows, adCol]);

  const adLabel = useMemo(() => {
    if (adCol >= 0 && hasAdData) return headers[adCol].toUpperCase();
    return 'F/C';
  }, [headers, adCol, hasAdData]);

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
      { key: 'ad', label: adLabel, index: adCol, tone: 'diff' },
      { key: 'pfpc', label: 'PF/PC', index: pfpcCol, tone: 'diff' },
    ];

    const filtered = columns.filter((column) => {
      if (column.index < 0) return false;
      if (column.key === 'ad' && !hasAdData) return false;
      return true;
    });

    if ((adCol < 0 || !hasAdData) && setsFavorCol >= 0 && setsAgainstCol >= 0) {
      filtered.push({ key: 'ad', label: adLabel, index: setsFavorCol, tone: 'diff', computed: 'fc' });
    }
    if (pfpcCol < 0 && favorCol >= 0 && againstCol >= 0) {
      filtered.push({ key: 'pfpc', label: 'PF/PC', index: favorCol, tone: 'diff', computed: 'pfpc' });
    }

    return filtered.sort((a, b) => {
      const order = ['points', 'played', 'won', 'draw', 'lost', 'g3', 'g2', 'p1', 'p0', 'setsFavor', 'setsAgainst', 'setsDiff', 'favor', 'against', 'diff', 'ad', 'pfpc'];
      return order.indexOf(a.key) - order.indexOf(b.key);
    });
  }, [adCol, adLabel, againstCol, diffCol, drawCol, favorCol, g2Col, g3Col, lostCol, p0Col, p1Col, pfpcCol, pjCol, ptsCol, setsAgainstCol, setsDiffCol, setsFavorCol, wonCol, hasAdData]);

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
        if (column.computed === 'fc') {
          const num = parseInt(getCell(row, setsFavorCol, '0'), 10) || 0;
          const den = parseInt(getCell(row, setsAgainstCol, '0'), 10) || 0;
          acc[column.key] = den ? (num / den).toFixed(3) : '-';
        } else if (column.computed === 'pfpc') {
          const num = parseInt(getCell(row, favorCol, '0'), 10) || 0;
          const den = parseInt(getCell(row, againstCol, '0'), 10) || 0;
          acc[column.key] = den ? (num / den).toFixed(3) : '-';
        } else {
          const rawValue = getCell(row, column.index, '-');
          acc[column.key] = column.key === 'diff' || column.key === 'setsDiff' || column.key === 'ad' || column.key === 'pfpc'
            ? formatDiff(rawValue)
            : rawValue;
        }
        return acc;
      }, {}),
      logo: rowLogos[index] || null,
    })),
    [posCol, rowLogos, rows, statColumns, setsFavorCol, setsAgainstCol, favorCol, againstCol, teamCol]
  );

  const handlePressTeam = (row) => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});

    const cached = getTeamFromCache(route.params?.rankingUrl || route.params?.calendarUrl, row.teamName);
    
    navigation.navigate('TeamDetail', {
      teamName: cached?.name || row.teamName,
      teamUrl: cached?.url || tableBlock?.rowLinks?.[row.index],
      teamLogo: cached?.logo || row.logo,
      tournamentTitle: title,
      leagueStats: cached?.leagueStats || row.values,
      calendarUrl: route.params?.calendarUrl,
      rankingBlocks: [tableBlock],
    });
  };

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
      borderColor: Colors.border,
      backgroundColor: isDark ? 'rgba(30, 41, 59, 0.5)' : Colors.surface,
      overflow: 'hidden',
      position: 'relative',
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
    tooltipWrap: {
      position: 'absolute',
      top: 0, left: 0, right: 0,
      alignItems: 'center',
      zIndex: 100,
      paddingTop: Spacing.sm,
    },
    tooltipBubble: {
      backgroundColor: isDark ? '#334155' : '#1e293b',
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: Radius.md,
      elevation: 8,
    },
    tooltipText: {
      color: '#ffffff',
      fontSize: 12,
      fontWeight: Typography.weight.semiBold,
    },
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
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={Colors.background} />

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
            <TouchableOpacity style={styles.exitButton} activeOpacity={0.85} onPress={() => { if (navigation.canGoBack()) navigation.goBack(); }}>
              <MaterialIcons name="fullscreen-exit" size={21} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.tableCard}>
          {tooltipKey ? (
            <View style={styles.tooltipWrap}>
              <View style={styles.tooltipBubble}>
                <Text style={styles.tooltipText}>{COLUMN_FULL_NAMES[tooltipKey] || tooltipKey}</Text>
              </View>
            </View>
          ) : null}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tableScroller} contentContainerStyle={styles.tableInner}>
            <View style={styles.tableInner}>
              <View style={styles.tableHeaderRow}>
                <View style={styles.cellPos}><Text style={styles.headerLabel}>POS</Text></View>
                <View style={styles.cellTeam}><Text style={styles.headerLabel}>EQUIPO</Text></View>
                {statColumns.map((column) => (
                  <TouchableOpacity key={column.key} style={styles.cellStat} onPress={() => {
                    if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
                    setTooltipKey(column.key);
                    tooltipTimer.current = setTimeout(() => setTooltipKey(null), 2000);
                  }}>
                    <Text style={[styles.headerLabel, column.tone === 'primary' && styles.headerLabelPrimary]}>{column.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {renderedRows.map((row) => {
                const showPosBadge = row.index < 3;

                return (
                  <View
                    key={row.key}
                    style={[
                      styles.tableBodyRow,
                      row.index < 3 ? { backgroundColor: getRowAccent(row.index, isDark, Colors) } : null,
                    ]}
                  >
                    <View style={styles.cellPos}>
                      {showPosBadge ? (
                        <View style={[styles.posBadge, { backgroundColor: getPositionBadgeColor(row.index, Colors) }]}>
                          <Text style={[styles.posBadgeText, { color: isDark ? '#ffffff' : Colors.textOnPrimary }]}>{row.position}</Text>
                        </View>
                      ) : (
                        <Text style={styles.posPlainText}>{row.position}</Text>
                      )}
                    </View>

                    <TouchableOpacity 
                      style={styles.cellTeam}
                      activeOpacity={0.7}
                      onPress={() => handlePressTeam(row)}
                    >
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
                    </TouchableOpacity>

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
