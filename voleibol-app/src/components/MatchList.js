// src/components/MatchList.js
// Componente especializado para mostrar partidos.
// Recibe bloques de tipo 'table' con resultados de competición
// y los presenta como tarjetas de partido modernas.

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Spacing, Typography, Radius, Shadow } from '../styles/theme';
import { useTheme } from '../contexts/ThemeContext';
import { getDominantBorderColor } from '../utils/imageColor';
import { getCachedLogoColorSync, requestLogoColorExtraction, subscribeToLogoColor } from '../utils/logoColorCache';

/**
 * Convierte una fila de tabla en un objeto partido.
 * Asume columnas típicas: Fecha, Local, Resultado, Visitante
 * @param {string[]} row    - Celdas de la fila
 * @param {string[]} headers - Cabeceras de la tabla
 */
function rowToMatch(row, headers) {
  const obj = {};
  headers.forEach((h, i) => {
    obj[h.toLowerCase().trim()] = row[i] || '';
  });
  return obj;
}

/**
 * Tarjeta de partido individual
 */
function parseNumericScore(value = '') {
  const clean = String(value || '').replace(/\s+/g, ' ').trim();
  const match = clean.match(/(\d+)\s*[-:]\s*(\d+)/);
  if (!match) return null;
  return { home: Number(match[1]), away: Number(match[2]) };
}

function getMatchField(match, ...keys) {
  for (const key of keys) {
    const found = Object.entries(match).find(([header]) =>
      header.includes(key.toLowerCase())
    );
    if (found && found[1]) return String(found[1]).trim();
  }
  return null;
}

/**
 * Intenta construir un objeto Date a partir de la cadena de fecha raw.
 * Admite: DD/MM/YYYY, DD-MM-YYYY, DD/MM (año actual) y prefijos de día.
 */
function parseMatchDateTime(rawDate) {
  if (!rawDate) return null;
  const s = String(rawDate);

  const nativeParsed = new Date(s);
  if (!Number.isNaN(nativeParsed.getTime())) {
    return nativeParsed;
  }

  const timeM = s.match(/\b(\d{1,2}):(\d{2})\b/);
  if (!timeM) return null;
  const hours = parseInt(timeM[1], 10);
  const minutes = parseInt(timeM[2], 10);

  // DD/MM/YYYY or MM/DD/YYYY (también con guiones)
  const fullM = s.match(/\b(\d{1,2})\s*[\/-]\s*(\d{1,2})\s*[\/-]\s*(\d{4})\b/);
  if (fullM) {
    const a = parseInt(fullM[1], 10);
    const b = parseInt(fullM[2], 10);
    const year = parseInt(fullM[3], 10);

    let day = a;
    let month = b;

    if (a > 12 && b <= 12) {
      day = a;
      month = b;
    } else if (b > 12 && a <= 12) {
      day = b;
      month = a;
    }

    const d = new Date(year, month - 1, day, hours, minutes);
    return isNaN(d.getTime()) ? null : d;
  }

  // DD/MM (no year → current year)
  const shortM = s.match(/\b(\d{1,2})[\/-](\d{1,2})\b/);
  if (shortM) {
    const now = new Date();
    const d = new Date(now.getFullYear(), parseInt(shortM[2], 10) - 1, parseInt(shortM[1], 10), hours, minutes);
    return isNaN(d.getTime()) ? null : d;
  }

  // Solo hora (ej: "20:00") -> hoy
  const today = new Date();
  const d = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
    hours,
    minutes,
    0,
    0
  );
  return isNaN(d.getTime()) ? null : d;
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function formatDateDMY(rawDate) {
  const date = parseMatchDateTime(rawDate);
  if (!date) return null;
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`;
}

function formatWeekdayEs(rawDate) {
  const date = parseMatchDateTime(rawDate);
  if (!date) return null;
  const weekday = new Intl.DateTimeFormat('es-ES', { weekday: 'long' }).format(date);
  return weekday.charAt(0).toUpperCase() + weekday.slice(1);
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

/**
 * Devuelve 'live' | 'finished' | 'upcoming' para un partido.
 * - Si algún equipo tiene 3 sets → finished
 * - Si el partido ya empezó y nadie tiene 3 → live
 * - Si el partido no ha empezado → upcoming
 */
function computeMatchState(rawDate, explicitState, homeScore, awayScore) {
  const home = Number(homeScore || 0);
  const away = Number(awayScore || 0);
  if (home === 3 || away === 3) return 'finished';

  // Explicit status from HTML icon/text is most reliable
  const stateStr = String(explicitState || '').toLowerCase();
  const isExplicitLive = /en\s*curso|live|directo/.test(stateStr);
  const isExplicitFinal = /final|cerrad|terminad/.test(stateStr);

  if (isExplicitLive) return 'live';
  if (isExplicitFinal) return 'finished';

  const matchStart = parseMatchDateTime(rawDate);
  if (matchStart) {
    const now = new Date();
    if (now < matchStart) return 'upcoming';

    // If it started more than 5 hours ago and we don't have an explicit 'live' status,
    // we assume it's finished (likely stale data) to avoid showing 'EN CURSO' for old dates.
    const hoursElapsed = (now - matchStart) / (1000 * 60 * 60);
    if (hoursElapsed > 5) return 'finished';

    return 'live';
  }

  return 'upcoming';
}

function getMatchSummary(match = {}) {
  const structured = match.homeTeam && match.awayTeam;
  const homeTeam = structured ? match.homeTeam : getMatchField(match, 'local', 'equipo a', 'home');
  const awayTeam = structured ? match.awayTeam : getMatchField(match, 'visitante', 'equipo b', 'away', 'visit');
  const homeLogo = structured ? (match.homeLogo || null) : null;
  const awayLogo = structured ? (match.awayLogo || null) : null;
  const dateRaw = structured ? match.date : getMatchField(match, 'fecha', 'date', 'día', 'jornada');
  const venue = structured ? match.venue : getMatchField(match, 'pabell', 'pista', 'lugar', 'sede', 'venue');
  const explicitState = getMatchField(match, 'estado', 'status');
  const resultRaw = structured
    ? [match.matchScore?.home, match.matchScore?.away].every((v) => v !== null && v !== undefined && v !== '')
      ? `${match.matchScore.home}-${match.matchScore.away}`
      : null
    : getMatchField(match, 'resultado', 'marcador', 'result', 'sets');

  const score = resultRaw ? parseNumericScore(resultRaw) : null;
  const timeMatch = String(dateRaw || '').match(/\b\d{1,2}:\d{2}\b/);
  const time = timeMatch?.[0] || null;
  const state = computeMatchState(dateRaw, explicitState, score?.home ?? null, score?.away ?? null);
  const dateLabel = formatDateDMY(dateRaw);
  const weekdayLabel = formatWeekdayEs(dateRaw);

  return {
    homeTeam: homeTeam || 'Local',
    awayTeam: awayTeam || 'Visitante',
    homeLogo,
    awayLogo,
    time,
    venue: venue || 'Sede por confirmar',
    state,
    dateLabel,
    weekdayLabel,
    homeScore: score?.home ?? null,
    awayScore: score?.away ?? null,
    rawDate: dateRaw || null,
  };
}

function MatchCard({ match, headers, onPress }) {
  const { colors: Colors } = useTheme();
  const summary = getMatchSummary(match);
  const { state } = summary;
  const homeLogoCandidates = useMemo(() => buildLogoCandidates(summary.homeLogo), [summary.homeLogo]);
  const awayLogoCandidates = useMemo(() => buildLogoCandidates(summary.awayLogo), [summary.awayLogo]);
  const [homeLogoIndex, setHomeLogoIndex] = useState(0);
  const [awayLogoIndex, setAwayLogoIndex] = useState(0);
  const [homeLogoBgColor, setHomeLogoBgColor] = useState(() => getCachedLogoColorSync(homeLogoCandidates[0]) || '#ffffff');
  const [awayLogoBgColor, setAwayLogoBgColor] = useState(() => getCachedLogoColorSync(awayLogoCandidates[0]) || '#ffffff');

  useEffect(() => {
    setHomeLogoIndex(0);
    setAwayLogoIndex(0);
  }, [summary.homeLogo, summary.awayLogo]);

  const homeLogoUri = homeLogoCandidates[homeLogoIndex] || null;
  const awayLogoUri = awayLogoCandidates[awayLogoIndex] || null;

  useEffect(() => {
    if (!homeLogoUri) { setHomeLogoBgColor(Colors.surfaceAlt); return; }
    // Synchronous lookup first (after hydration this is instant)
    const cached = getCachedLogoColorSync(homeLogoUri);
    if (cached) { setHomeLogoBgColor(cached); }
    // Queue extraction if not yet computed; subscribe for when it arrives
    requestLogoColorExtraction(homeLogoUri, getDominantBorderColor);
    let mounted = true;
    const unsubscribe = subscribeToLogoColor(homeLogoUri, (color) => {
      if (mounted && color) setHomeLogoBgColor(color);
    });
    return () => { mounted = false; unsubscribe(); };
  }, [homeLogoUri, Colors.surfaceAlt]);

  useEffect(() => {
    if (!awayLogoUri) { setAwayLogoBgColor(Colors.surfaceAlt); return; }
    const cached = getCachedLogoColorSync(awayLogoUri);
    if (cached) { setAwayLogoBgColor(cached); }
    requestLogoColorExtraction(awayLogoUri, getDominantBorderColor);
    let mounted = true;
    const unsubscribe = subscribeToLogoColor(awayLogoUri, (color) => {
      if (mounted && color) setAwayLogoBgColor(color);
    });
    return () => { mounted = false; unsubscribe(); };
  }, [awayLogoUri, Colors.surfaceAlt]);

  const pillStyle = state === 'live'
    ? { bg: 'rgba(239,68,68,0.12)', text: '#ef4444', border: 'rgba(239,68,68,0.30)' }
    : state === 'finished'
      ? { bg: Colors.primaryAlpha10, text: Colors.primary, border: Colors.primaryAlpha20 }
      : { bg: Colors.surfaceAlt, text: Colors.textMuted, border: Colors.border };

  const pillLabel = state === 'live' ? 'EN CURSO' : state === 'finished' ? 'FINALIZADO' : 'PRÓXIMO';

  if (!summary.homeTeam && !summary.awayTeam) {
    return (
      <View style={{ backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border }}>
        {headers.map((h, i) => (
          <Text key={i} style={{ color: Colors.textPrimary, fontSize: Typography.size.sm, marginBottom: 2 }}>
            <Text style={{ fontWeight: Typography.weight.semiBold, color: Colors.textSecondary }}>{h}: </Text>
            {match[h.toLowerCase().trim()] || '—'}
          </Text>
        ))}
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={{ backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden', ...Shadow.sm }}
      activeOpacity={0.88}
      onPress={() => onPress?.({
        ...match,
        ...summary,
        homeLogo: summary.homeLogo || match.homeLogo || null,
        awayLogo: summary.awayLogo || match.awayLogo || null,
      })}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.md, paddingTop: Spacing.md, paddingBottom: Spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, flexWrap: 'wrap', flex: 1, paddingRight: Spacing.sm }}>
          <View style={{ borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 3, backgroundColor: pillStyle.bg, borderWidth: 1, borderColor: pillStyle.border, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            {state === 'live' ? <View style={{ width: 5, height: 5, borderRadius: Radius.full, backgroundColor: '#ef4444' }} /> : null}
            <Text style={{ fontSize: 10, fontWeight: Typography.weight.bold, letterSpacing: 0.4, color: pillStyle.text }}>
              {pillLabel}
            </Text>
          </View>
          <Text style={{ color: Colors.textMuted, fontSize: Typography.size.xs, fontWeight: Typography.weight.medium }} numberOfLines={1}>
            {summary.dateLabel || 'Fecha pendiente'}{summary.time ? `, ${summary.time}` : ''}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, maxWidth: '42%' }}>
          <MaterialIcons name="location-on" size={14} color={Colors.textMuted} />
          <Text style={{ color: Colors.textMuted, fontSize: Typography.size.xs, fontWeight: Typography.weight.medium }} numberOfLines={1}>
            {summary.venue}
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.lg }}>
        <View style={{ flex: 1, alignItems: 'center', gap: Spacing.xs }}>
          <View style={{ width: 62, height: 62, borderRadius: Radius.full, backgroundColor: homeLogoUri ? homeLogoBgColor : Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center' }}>
            {homeLogoUri ? (
              <Image
                source={{ uri: homeLogoUri }}
                style={{ width: 50, height: 50, borderRadius: 25 }}
                resizeMode="contain"
                onError={() => {
                  setHomeLogoIndex((current) => (current + 1 < homeLogoCandidates.length ? current + 1 : homeLogoCandidates.length));
                }}
              />
            ) : (
              <Text style={{ color: Colors.textMuted, fontSize: Typography.size.xs, fontWeight: Typography.weight.bold }}>{summary.homeTeam.slice(0, 2).toUpperCase()}</Text>
            )}
          </View>
          <Text style={{ color: Colors.textPrimary, fontSize: Typography.size.xs, fontWeight: Typography.weight.bold, textAlign: 'center', lineHeight: 14, textTransform: 'uppercase' }} numberOfLines={2}>{summary.homeTeam}</Text>
        </View>

        <View style={{ minWidth: 120, alignItems: 'center', justifyContent: 'center', gap: Spacing.xs }}>
          {summary.homeScore !== null && summary.awayScore !== null ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
              <Text style={{ color: Colors.textPrimary, fontSize: 34, fontWeight: Typography.weight.black }}>{summary.homeScore}</Text>
              <Text style={{ color: Colors.textMuted, fontSize: Typography.size.lg, fontWeight: Typography.weight.regular }}>-</Text>
              <Text style={{ color: Colors.textPrimary, fontSize: 34, fontWeight: Typography.weight.black }}>{summary.awayScore}</Text>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
              <Text style={{ color: Colors.textMuted, fontSize: 30, fontWeight: Typography.weight.black }}>VS</Text>
            </View>
          )}

          <View style={{ marginTop: 2, borderRadius: Radius.sm, borderWidth: 1, borderColor: state === 'finished' ? Colors.primaryAlpha20 : Colors.border, backgroundColor: state === 'live' ? Colors.primaryAlpha10 : Colors.surfaceAlt, paddingHorizontal: Spacing.sm, paddingVertical: 4 }}>
            <Text style={{ color: state === 'finished' || state === 'live' ? Colors.primary : Colors.textMuted, fontSize: 10, fontWeight: Typography.weight.bold, textTransform: 'uppercase', letterSpacing: 1 }}>
              {state === 'live' ? 'En Vivo' : state === 'finished' ? 'Detalles' : 'Previa'}
            </Text>
          </View>
        </View>

        <View style={{ flex: 1, alignItems: 'center', gap: Spacing.xs }}>
          <View style={{ width: 62, height: 62, borderRadius: Radius.full, backgroundColor: awayLogoUri ? awayLogoBgColor : Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center' }}>
            {awayLogoUri ? (
              <Image
                source={{ uri: awayLogoUri }}
                style={{ width: 50, height: 50, borderRadius: 25 }}
                resizeMode="contain"
                onError={() => {
                  setAwayLogoIndex((current) => (current + 1 < awayLogoCandidates.length ? current + 1 : awayLogoCandidates.length));
                }}
              />
            ) : (
              <Text style={{ color: Colors.textMuted, fontSize: Typography.size.xs, fontWeight: Typography.weight.bold }}>{summary.awayTeam.slice(0, 2).toUpperCase()}</Text>
            )}
          </View>
          <Text style={{ color: Colors.textPrimary, fontSize: Typography.size.xs, fontWeight: Typography.weight.bold, textAlign: 'center', lineHeight: 14, textTransform: 'uppercase' }} numberOfLines={2}>{summary.awayTeam}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

/**
 * Lista de partidos a partir de un bloque de tipo 'table'
 * @param {{ headers: string[], rows: string[][] }} tableBlock
 */
export default function MatchList({ tableBlock, onPressMatch }) {
  const { colors: Colors } = useTheme();
  if (!tableBlock || !tableBlock.rows?.length) {
    return (
      <View style={{ padding: Spacing.xxl, alignItems: 'center' }}>
        <Text style={{ color: Colors.textMuted, fontSize: Typography.size.md }}>No hay partidos disponibles</Text>
      </View>
    );
  }

  const matches = tableBlock.matches?.length
    ? tableBlock.matches
    : tableBlock.rows.map((row) => rowToMatch(row, tableBlock.headers));

  return (
    <FlatList
      data={matches}
      keyExtractor={(_, i) => String(i)}
      renderItem={({ item }) => (
        <MatchCard match={item} headers={tableBlock.headers} onPress={onPressMatch} />
      )}
      contentContainerStyle={{ paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm }}
      showsVerticalScrollIndicator={false}
      ItemSeparatorComponent={() => <View style={{ height: Spacing.xs + 2 }} />}
      scrollEnabled={false}
    />
  );
}


