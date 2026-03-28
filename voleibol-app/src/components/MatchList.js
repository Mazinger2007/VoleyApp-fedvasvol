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
import { useNavigation } from '@react-navigation/native';
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
export function rowToMatch(row, headers) {
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
export function parseMatchDateTime(rawDate) {
  if (!rawDate) return null;
  const s = String(rawDate);

  const timeM = s.match(/(\d{1,2}):(\d{2})/);
  const hours = timeM ? parseInt(timeM[1], 10) : 0;
  const minutes = timeM ? parseInt(timeM[2], 10) : 0;

  // DD/MM/YYYY o DD/MM/YY
  const fullM = s.match(/(\d{1,2})\s*[\/-]\s*(\d{1,2})\s*[\/-]\s*(\d{2,4})/);
  if (fullM) {
    const a = parseInt(fullM[1], 10);
    const b = parseInt(fullM[2], 10);
    let year = parseInt(fullM[3], 10);
    if (year < 100) year += 2000;

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

  // DD/MM (sin año → año actual)
  const shortM = s.match(/(\d{1,2})[\/-](\d{1,2})/);
  if (shortM) {
    const now = new Date();
    const d = new Date(now.getFullYear(), parseInt(shortM[2], 10) - 1, parseInt(shortM[1], 10), hours, minutes);
    return isNaN(d.getTime()) ? null : d;
  }

  // Solo hora (ej: "20:00") -> hoy
  if (timeM) {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), today.getDate(), hours, minutes);
  }

  // Fallback a parseo nativo (ISO u otros)
  const nativeParsed = new Date(s);
  if (!Number.isNaN(nativeParsed.getTime())) {
    return nativeParsed;
  }

  return null;
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
  try {
    const date = parseMatchDateTime(rawDate);
    if (!date) return null;
    // Intl can fail on some Android environments in production
    if (typeof Intl !== 'undefined' && Intl.DateTimeFormat) {
      try {
        const weekday = new Intl.DateTimeFormat('es-ES', { weekday: 'long' }).format(date);
        return weekday.charAt(0).toUpperCase() + weekday.slice(1);
      } catch (intlErr) {
        return null;
      }
    }
  } catch (e) {
    console.warn('[formatWeekdayEs] Error:', e.message);
  }
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
    withLogoResolution(base, 200),
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
export function computeMatchState(rawDate, explicitState, homeScore, awayScore) {
  const home = Number(homeScore || 0);
  const away = Number(awayScore || 0);
  if (home === 3 || away === 3) return 'finished';

  // Explicit status from HTML icon/text is most reliable
  const stateStr = String(explicitState || '').toLowerCase();
  const isExplicitLive = /en\s*curso|live|directo/.test(stateStr);
  const isExplicitFinal = /final|cerrad|terminad/.test(stateStr);

  if (isExplicitLive) {
    const matchStart = parseMatchDateTime(rawDate);
    if (matchStart) {
      const now = new Date();
      const diffHours = (now - matchStart) / (1000 * 60 * 60);
      // Si la fecha del partido fue hace más de 12 horas, ignoramos el "En curso" del HTML (probablemente obsoleto)
      if (diffHours > 12) return 'finished';
    }
    return 'live';
  }
  if (isExplicitFinal) return 'finished';

  const matchStart = parseMatchDateTime(rawDate);
  if (matchStart) {
    const now = new Date();
    if (now < matchStart) return 'upcoming';

    // If it's today, it's live until 3 sets are reached
    const sameDay = matchStart.getFullYear() === now.getFullYear() &&
                    matchStart.getMonth() === now.getMonth() &&
                    matchStart.getDate() === now.getDate();
    
    if (sameDay) return 'live';

    // For past days, we assume it's finished even if sets aren't 3 (to avoid stale 'live')
    return 'finished';
  }

  return 'upcoming';
}

const SPANISH_MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export function formatMatchDisplayDate(rawDate, isLive = false) {
  if (isLive) return 'EN DIRECTO';
  const dateObj = parseMatchDateTime(rawDate);
  if (!dateObj) return (typeof rawDate === 'string' ? rawDate : 'Por definir');
  const day = dateObj.getDate();
  const monthIdx = dateObj.getMonth();
  const month = SPANISH_MONTHS[monthIdx] || '???';
  return `${day} ${month}`;
}

export function formatMatchTime(rawDate, timeStr) {
  const d = parseMatchDateTime(rawDate);
  if (!d) return timeStr || '--:--';
  if (timeStr) {
    const parts = String(timeStr).split(':').map(Number);
    if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      d.setHours(parts[0], parts[1], 0);
    }
  }
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function getMatchSummary(match = {}) {
  try {
    if (!match) return { homeTeam: 'Local', awayTeam: 'Visitante', homeScore: null, awayScore: null, time: '--:--', sets: [], venue: 'Sede desconocida' };
    
    // Si ya es un resumen (tiene dateLabel), devolverlo pero asegurar tipos
    if (match.dateLabel !== undefined && match.state !== undefined) {
      if (typeof match.homeTeam !== 'string') match.homeTeam = String(match.homeTeam || 'Local');
      if (typeof match.awayTeam !== 'string') match.awayTeam = String(match.awayTeam || 'Visitante');
      if (!Array.isArray(match.sets)) match.sets = [];
      return match;
    }

    const structured = !!(match.homeTeam && match.awayTeam);
    const homeTeam = structured ? match.homeTeam : getMatchField(match, 'local', 'equipo a', 'home', 'equipo');
    const awayTeam = structured ? match.awayTeam : getMatchField(match, 'visitante', 'equipo b', 'away');

    const resultRaw = structured
      ? (match.matchScore?.home !== undefined && match.matchScore?.away !== undefined)
        ? `${match.matchScore.home}-${match.matchScore.away}`
        : (match.homeScore !== undefined && match.awayScore !== undefined)
           ? `${match.homeScore}-${match.awayScore}`
           : null
      : getMatchField(match, 'resultado', 'marcador', 'result', 'sets');

    const score = resultRaw ? parseNumericScore(resultRaw) : { home: null, away: null };
    
    // Intentar sacar scores directos si falló lo anterior
    if (score.home === null && typeof match.homeScore === 'number') score.home = match.homeScore;
    if (score.away === null && typeof match.awayScore === 'number') score.away = match.awayScore;

    const rawDate = structured ? match.date : getMatchField(match, 'fecha', 'date', 'día', 'jornada');
    const timeMatch = String(rawDate || '').match(/\b\d{1,2}:\d{2}\b/);
    const rawTime = structured ? (match.time || timeMatch?.[0] || null) : (timeMatch?.[0] || null);

    const isLive = computeMatchState(rawDate, null, score.home, score.away) === 'live';
    const dateLabel = isLive ? 'EN DIRECTO' : formatMatchDisplayDate(rawDate);
    const weekdayLabel = formatWeekdayEs(rawDate);
    const time = formatMatchTime(rawDate, rawTime);
    const venue = structured ? (match.venue || match.location || getMatchField(match, 'lugar', 'sede', 'campo', 'pabellón')) : getMatchField(match, 'lugar', 'sede', 'campo', 'pabellón');

    const state = computeMatchState(rawDate, getMatchField(match, 'estado', 'status'), score.home, score.away);

    return {
      state,
      homeTeam: String(homeTeam || 'Local'),
      awayTeam: String(awayTeam || 'Visitante'),
      homeScore: score.home,
      awayScore: score.away,
      time: time || '--:--',
      rawDate: (typeof rawDate === 'string' ? rawDate : null),
      dateLabel: String(dateLabel || 'Fecha desconocida'),
      weekdayLabel: String(weekdayLabel || ''),
      venue: String(venue || 'Sede por confirmar'),
      homeLogo: match.homeLogo || match.homeImage || null,
      awayLogo: match.awayLogo || match.awayImage || null,
      sets: Array.isArray(match.sets) ? match.sets : [],
      coordinates: match.coordinates || null,
      href: match.href || null,
    };
  } catch (e) {
    console.warn("Error parseando partido en getMatchSummary:", e.message);
    return {
      homeTeam: String(match?.homeTeam || 'Local'),
      awayTeam: String(match?.awayTeam || 'Visitante'),
      homeScore: typeof match?.homeScore === 'number' ? match.homeScore : null,
      awayScore: typeof match?.awayScore === 'number' ? match.awayScore : null,
      time: '--:--',
      rawDate: null,
      dateLabel: 'Fecha desconocida',
      weekdayLabel: '',
      venue: 'Sede por confirmar',
      sets: [],
      isError: true
    };
  }
}

export function MatchCard({ match, headers, onPress, calendarUrl }) {
  const navigation = useNavigation();
  const { colors: Colors, isDark } = useTheme();
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
      style={{ 
        backgroundColor: state === 'live' ? (isDark ? 'rgba(239, 68, 68, 0.05)' : '#fff5f5') : Colors.surface, 
        borderRadius: Radius.lg, 
        borderWidth: 1, 
        borderColor: state === 'live' ? 'rgba(239, 68, 68, 0.3)' : Colors.border,
        borderLeftWidth: state === 'live' ? 6 : 0,
        borderLeftColor: '#ef4444',
        overflow: 'hidden', 
        ...Shadow.sm 
      }}
      activeOpacity={0.88}
      onPress={() => {
        if (onPress) {
          onPress(match);
        } else {
          navigation.navigate('MatchDetail', { match: { ...match, ...summary }, calendarUrl });
        }
      }}
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
            {summary.time}{summary.time && summary.dateLabel ? ' · ' : ''}{summary.dateLabel || 'Fecha pendiente'}
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
export default function MatchList({ tableBlock, matches, onPressMatch, calendarUrl }) {
  const { colors: Colors } = useTheme();
  
  const finalMatches = useMemo(() => {
    if (matches && matches.length > 0) return matches;
    if (tableBlock && tableBlock.matches?.length) return tableBlock.matches;
    if (tableBlock && tableBlock.rows?.length) {
      return tableBlock.rows.map((row, i) => {
        const matchObj = rowToMatch(row, tableBlock.headers);
        if (tableBlock.rowLinks?.[i]) matchObj.href = tableBlock.rowLinks[i];
        return matchObj;
      });
    }
    return [];
  }, [tableBlock, matches]);

  if (finalMatches.length === 0) {
    return (
      <View style={{ padding: Spacing.xxl, alignItems: 'center' }}>
        <Text style={{ color: Colors.textMuted, fontSize: Typography.size.md }}>No hay partidos disponibles</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={finalMatches}
      keyExtractor={(_, i) => String(i)}
      renderItem={({ item }) => (
        <MatchCard match={item} headers={tableBlock?.headers || []} onPress={onPressMatch} calendarUrl={calendarUrl} />
      )}
      contentContainerStyle={{ paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm }}
      showsVerticalScrollIndicator={false}
      ItemSeparatorComponent={() => <View style={{ height: Spacing.xs + 2 }} />}
      scrollEnabled={false}
    />
  );
}
