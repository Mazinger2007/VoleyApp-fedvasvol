import React, { memo, useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, Platform, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Spacing, Typography, Radius } from '../styles/theme';
import { useTheme } from '../contexts/ThemeContext';
import { useFetch } from '../hooks/useFetch';
import { resultCache } from '../hooks/useFetch';
import { toRankingUrl } from '../utils/htmlParser';
import { loadLeagueShields, saveLeagueShields } from '../utils/teamCache';
import { getCachedBlocksSync } from '../utils/persistentCache';


const LeagueShields = memo(function LeagueShields({ blocks, isDark, isConfiguring, leagueUrl }) {
  const [imageErrs, setImageErrs] = useState({});
  const [cachedShields, setCachedShields] = useState(null);
  const isMobile = Platform.OS !== 'web';

  // Cargar escudos guardados de esta liga (evita refetch si el ranking falla o tarda)
  useEffect(() => {
    if (!leagueUrl) return;
    let active = true;
    loadLeagueShields(leagueUrl).then((list) => {
      if (active && Array.isArray(list) && list.length > 0) {
        setCachedShields(list);
      }
    });
    return () => { active = false; };
  }, [leagueUrl]);

  const logosData = useMemo(() => {
    if (!blocks || blocks.length === 0) return [];

    // First, try to find logos in a standard table
    const tableTable = blocks.find(b => b.type === 'table');
    if (tableTable && tableTable.rows && tableTable.rows.length > 0) {
      const headers = tableTable.headers || [];
      const teamCol = headers.findIndex((h) => String(h || '').toLowerCase().includes('equipo'));
      const colIdx = teamCol >= 0 ? teamCol : 1;

      return tableTable.rows.slice(0, 3).map((row, i) => {
        const logoUrl = tableTable.rowLogos?.[i];
        const teamName = row[colIdx] || row[0] || 'EQ';
        const fallbackUrl = logoUrl
          ? null
          : `https://ui-avatars.com/api/?name=${encodeURIComponent(teamName)}&background=random&color=fff&rounded=true&bold=true`;
        return {
          url: logoUrl || fallbackUrl,
          fallbackUrl,
          isPlaceholder: !logoUrl,
          label: teamName,
        };
      });
    }

    // Fallback: try to find logos in tournament brackets
    const bracketBlocks = blocks.filter(b => b.type === 'bracket');
    if (bracketBlocks.length > 0) {
      const extractedTeams = [];
      const seenTeams = new Set();

      for (const bracket of bracketBlocks) {
        if (!bracket.columns) continue;
        for (const col of bracket.columns) {
          if (!col.matches) continue;
          for (const match of col.matches) {
            if (extractedTeams.length >= 3) break;

            if (match.homeTeam && match.homeTeam.trim() !== '' && match.homeTeam.trim() !== 'TBD' && !seenTeams.has(match.homeTeam)) {
              seenTeams.add(match.homeTeam);
              const fallbackUrl = match.homeLogo
                ? null
                : `https://ui-avatars.com/api/?name=${encodeURIComponent(match.homeTeam)}&background=random&color=fff&rounded=true&bold=true`;
              extractedTeams.push({
                url: match.homeLogo || fallbackUrl,
                fallbackUrl,
                isPlaceholder: !match.homeLogo,
                label: match.homeTeam,
              });
            }
            if (extractedTeams.length >= 3) break;

            if (match.awayTeam && match.awayTeam.trim() !== '' && match.awayTeam.trim() !== 'TBD' && !seenTeams.has(match.awayTeam)) {
              seenTeams.add(match.awayTeam);
              const fallbackUrl = match.awayLogo
                ? null
                : `https://ui-avatars.com/api/?name=${encodeURIComponent(match.awayTeam)}&background=random&color=fff&rounded=true&bold=true`;
              extractedTeams.push({
                url: match.awayLogo || fallbackUrl,
                fallbackUrl,
                isPlaceholder: !match.awayLogo,
                label: match.awayTeam,
              });
            }
          }
          if (extractedTeams.length >= 3) break;
        }
        if (extractedTeams.length >= 3) break;
      }
      return extractedTeams;
    }

    return [];
  }, [blocks]);

  // Persistir escudos reales del ranking para no refetchear la próxima vez
  useEffect(() => {
    if (!leagueUrl) return;
    const realLogos = logosData
      .filter((l) => !l.isPlaceholder && l.url)
      .map((l) => ({ url: l.url, label: l.label }));
    if (realLogos.length > 0) {
      saveLeagueShields(leagueUrl, realLogos);
    }
  }, [logosData, leagueUrl]);

  // Priorizar datos frescos; si el ranking aún no carga/fralla, usar los guardados
  const effectiveLogos = useMemo(() => {
    if (logosData.some((l) => !l.isPlaceholder && l.url)) return logosData;
    if (Array.isArray(cachedShields) && cachedShields.length > 0) {
      return cachedShields.map((c) => ({
        url: c.url,
        fallbackUrl: null,
        isPlaceholder: false,
        label: c.label || 'EQ',
      }));
    }
    return logosData;
  }, [logosData, cachedShields]);

  if (isConfiguring) {
    return <DefaultShields isDark={isDark} />;
  }

  if (effectiveLogos.length > 0) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 12 }}>
        {effectiveLogos.map((logo, idx) => {
          const initials = logo.fallbackUrl?.match(/name=([^&]+)/)?.[1] || logo.label || '';
          const isGeneric = initials.toLowerCase() === 'se' || initials.toLowerCase() === 'sq' || initials.toLowerCase() === 'eq';
          const shouldUseAvatar = !isMobile && !!logo.fallbackUrl;
          const useCached = !logo.isPlaceholder && logo.url && !imageErrs[idx];
          const useCachedAvatar = !useCached && !isMobile && logo.fallbackUrl;
          
          return (
            <View key={idx} style={{
              width: 32, height: 32, borderRadius: 16,
              borderWidth: 2, borderColor: isDark ? '#1e293b' : '#ffffff',
              backgroundColor: isDark ? '#334155' : '#f1f5f9',
              alignItems: 'center', justifyContent: 'center',
              marginLeft: idx === 0 ? 0 : -12, elevation: 1, overflow: 'hidden',
              zIndex: 10 - idx
            }}>
              {useCached ? (
                <Image
                  source={{ uri: logo.url }}
                  onError={() => setImageErrs(p => ({ ...p, [idx]: true }))}
                  style={{ width: '95%', height: '95%' }}
                  resizeMode="contain"
                />
              ) : useCachedAvatar && !isGeneric ? (
                <Image
                  source={{ uri: logo.fallbackUrl }}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="cover"
                />
              ) : (
                <MaterialIcons name="security" size={12} color={isDark ? '#cbd5e1' : '#94a3b8'} />
              )}
            </View>
          );
        })}
      </View>
    );
  }

  return <DefaultShields isDark={isDark} />;
});

function DefaultShields({ isDark }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 12 }}>
      {[1, 2, 3].map((_, idx) => (
        <View key={idx} style={{
          width: 32, height: 32, borderRadius: 16,
          borderWidth: 2, borderColor: isDark ? '#1e293b' : '#ffffff',
          backgroundColor: isDark ? (idx === 1 ? '#475569' : '#334155') : (idx === 1 ? '#e2e8f0' : '#f1f5f9'),
          alignItems: 'center', justifyContent: 'center',
          marginLeft: idx === 0 ? 0 : -12, elevation: 1,
          zIndex: 10 - idx
        }}>
          <MaterialIcons name="security" size={12} color={isDark ? '#cbd5e1' : '#94a3b8'} />
        </View>
      ))}
    </View>
  );
}

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

function CompetitionCard({ item, blocks, onPress, onMainLogoReady, leagueUrl }) {
  const { colors: Colors, isDark } = useTheme();
  const { name, status, season, category, sex, teamCount, organizer, logo } = item;
  const active = isActive(status);

  return (
    <TouchableOpacity
      style={{
        backgroundColor: isDark ? '#1e293b' : '#ffffff',
        borderRadius: Radius.xl,
        padding: Spacing.xl,
        borderWidth: 1,
        borderColor: 'rgba(13,143,242,0.05)',
        elevation: 2,
        ...(Platform.OS !== 'web' ? {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.08,
          shadowRadius: 4,
        } : {
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)'
        })
      }}
      activeOpacity={0.8}
      onPress={() => {
        if (/(txapelketa|topaketa|copa|kopa|cup|fase|eliminatoria|final|kanporaketa)/i.test(name || '')) {
          onPress && onPress('torneo');
        } else {
          onPress && onPress('liga');
        }
      }}
    >
      <View style={{ flexDirection: 'column', gap: Spacing.lg }}>
        {/* Top Tag & Status */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {/* Logo a la izquierda */}
            {logo ? (
              <Image
                source={{ uri: logo }}
                onLoad={() => onMainLogoReady?.()}
                onError={() => onMainLogoReady?.()}
                style={{ width: 36, height: 36, borderRadius: 18, marginRight: 8, backgroundColor: isDark ? '#1e293b' : '#f1f5f9', borderWidth: 1, borderColor: '#e5e7eb' }}
                resizeMode="contain"
              />
            ) : null}
            <View style={{ backgroundColor: Colors.primary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.md }}>
              <Text style={{ color: '#ffffff', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 }}>
                {category || 'Competición'}
              </Text>
            </View>
          </View>
          {!!status && (
            <View style={{
              backgroundColor: /curso|activo|activado/i.test(status)
                ? 'rgba(34,197,94,0.1)'
                : /finalizad|terminad|fin$|^fin\s/i.test(status)
                  ? 'rgba(148,163,184,0.1)'
                  : /configurando/i.test(status)
                    ? 'rgba(59,130,246,0.1)'
                    : isDark ? '#334155' : '#f8fafc',
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: Radius.sm,
              borderWidth: 1,
              borderColor: /curso|activo|activado/i.test(status)
                ? 'rgba(34,197,94,0.2)'
                : /finalizad|terminad|fin$|^fin\s/i.test(status)
                  ? 'rgba(148,163,184,0.2)'
                  : /configurando/i.test(status)
                    ? 'rgba(59,130,246,0.2)'
                    : isDark ? '#475569' : '#e2e8f0'
            }}>
              <Text style={{
                color: /curso|activo|activado/i.test(status)
                  ? '#22c55e'
                  : /finalizad|terminad|fin$|^fin\s|finalizada/i.test(status)
                    ? '#94a3b8'
                    : /configurando/i.test(status)
                      ? '#3b82f6'
                      : isDark ? '#cbd5e1' : '#64748b',
                fontSize: 10,
                fontWeight: '800',
                textTransform: 'uppercase'
              }}>
                {status.replace(/^Estado:\s*/i, '')}
              </Text>
            </View>
          )}
        </View>

        {/* Title & Subtitle */}
        <View>
          <Text style={{ fontSize: 18, fontWeight: 'bold', color: isDark ? '#ffffff' : '#0f172a', lineHeight: 22 }}>
            {name || 'Torneo'}
          </Text>
          <Text style={{ fontSize: 14, color: isDark ? '#94a3b8' : '#64748b', marginTop: 2 }}>
            {season || organizer || 'Federación Vasca de Voleibol'}
          </Text>
        </View>

        {/* Bottom Section */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: isDark ? '#334155' : '#f1f5f9', justifyContent: 'space-between' }}>
          <LeagueShields blocks={blocks} isDark={isDark} isConfiguring={/configurando/i.test(status)} leagueUrl={leagueUrl} />
          <View style={{ backgroundColor: Colors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radius.md, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '600' }}>
              {/(txapelketa|topaketa|copa|kopa|cup|fase|eliminatoria|final|kanporaketa)/i.test(name || '') ? 'Ver Torneo' : 'Ver Liga'}
            </Text>
            <MaterialIcons name="chevron-right" size={18} color="#ffffff" />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const SHIMMER_WIDTH = 220;

function ShimmerBar({ width, height, borderRadius, translateX, isDark }) {
  return (
    <View
      style={{
        width,
        height,
        borderRadius,
        backgroundColor: isDark ? '#334155' : '#e2e8f0',
        overflow: 'hidden',
      }}
    >
      <Animated.View
        style={{
          width: SHIMMER_WIDTH,
          height: '100%',
          transform: [{ translateX }],
        }}
      >
        <LinearGradient
          colors={[
            'transparent',
            isDark ? 'rgba(148,163,184,0.10)' : 'rgba(255,255,255,0.60)',
            isDark ? 'rgba(148,163,184,0.18)' : 'rgba(255,255,255,0.85)',
            isDark ? 'rgba(148,163,184,0.10)' : 'rgba(255,255,255,0.60)',
            'transparent',
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ flex: 1 }}
        />
      </Animated.View>
    </View>
  );
}

function SkeletonCompetitionCard() {
  const { isDark } = useTheme();
  const shimmerAnim = useRef(new Animated.Value(-SHIMMER_WIDTH)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 340,
        duration: 1100,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={{
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderRadius: Radius.xl,
      borderWidth: 1,
      borderColor: 'rgba(13,143,242,0.05)',
      height: 165,
      marginBottom: Spacing.md,
      padding: Spacing.xl,
      justifyContent: 'space-between',
    }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <ShimmerBar width={80} height={20} borderRadius={Radius.sm} translateX={shimmerAnim} isDark={isDark} />
        <ShimmerBar width={60} height={20} borderRadius={Radius.sm} translateX={shimmerAnim} isDark={isDark} />
      </View>
      <View style={{ gap: 8 }}>
        <ShimmerBar width="70%" height={24} borderRadius={Radius.sm} translateX={shimmerAnim} isDark={isDark} />
        <ShimmerBar width="40%" height={16} borderRadius={Radius.sm} translateX={shimmerAnim} isDark={isDark} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: isDark ? '#334155' : '#f1f5f9', paddingTop: Spacing.md }}>
        <ShimmerBar width={60} height={32} borderRadius={16} translateX={shimmerAnim} isDark={isDark} />
        <ShimmerBar width={100} height={32} borderRadius={Radius.md} translateX={shimmerAnim} isDark={isDark} />
      </View>
    </View>
  );
}


function LeagueCardWrapper({ item, loadGeneration, onPress, onLoaded, enableRankingFetch }) {
  const rankingUrl = (!item.href || /configurando/i.test(item.status)) ? null : toRankingUrl(item.href);
  // Solo las primeras cards prefetchean su ranking (escudos de equipos). El resto
  // usa la caché persistente, evitando decenas de peticiones que ralentizan la UI.
  const fetchUrl = enableRankingFetch ? rankingUrl : null;
  const { blocks, loading } = useFetch(fetchUrl);
  const reportedRef = useRef(false);
  const [fetchReady, setFetchReady] = useState(false);
  const [mainLogoReady, setMainLogoReady] = useState(!item.logo);
  const loadGenRef = useRef(loadGeneration);

  useEffect(() => {
    if (loadGenRef.current !== loadGeneration) {
      loadGenRef.current = loadGeneration;
      setFetchReady(false);
      setMainLogoReady(!item.logo);
      reportedRef.current = false;
    }
  }, [loadGeneration, item.logo]);

  useEffect(() => {
    setFetchReady(false);
    setMainLogoReady(!item.logo);
    reportedRef.current = false;
  }, [fetchUrl, item.logo]);

  // Si esta liga ya tiene ranking en caché (disco), la card cuenta como lista
  // AL INSTANTE: no bloquea la aparición de la lista esperando red.
  const hasDiskCache = fetchUrl ? Boolean(getCachedBlocksSync(fetchUrl)) : true;
  useEffect(() => {
    if (hasDiskCache && !reportedRef.current) {
      reportedRef.current = true;
      onLoaded?.();
    }
  }, [hasDiskCache, onLoaded, loadGeneration]);

  useEffect(() => {
    if (!loading) {
      setFetchReady(true);
    }
  }, [loading]);

  useEffect(() => {
    if (fetchReady && mainLogoReady && !reportedRef.current) {
      reportedRef.current = true;
      onLoaded();
    }
  }, [fetchReady, mainLogoReady, onLoaded]);

  return (
    <CompetitionCard
      item={item}
      onPress={onPress}
      blocks={blocks}
      leagueUrl={rankingUrl}
      onMainLogoReady={() => setMainLogoReady(true)}
    />
  );
}

export default function CompetitionList({
  tableBlock,
  onOpenTournament,
  loadGeneration = 0,
}) {
  const { colors: Colors, isDark } = useTheme();
  // Nº de cards con fetch de ranking (escudos); el resto usa caché persistente.
  const RANKING_PREFETCH_LIMIT = 6;

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
    logo: tableBlock.rowLogos?.[i] || tableBlock.rowImages?.[i] || null,
  }));

  const totalCards = tournaments.length;
  const [loadedCount, setLoadedCount] = useState(0);
  const [forcedReady, setForcedReady] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const isReady = forcedReady || loadedCount >= totalCards;

  const handleLoaded = useCallback(() => {
    setLoadedCount(prev => prev + 1);
  }, []);

  // ¿Alguna card aún necesita red (sin caché en disco)?
  const needsNetwork = tournaments.some(
    (t) => t.href && !/configurando/i.test(t.status) && !getCachedBlocksSync(toRankingUrl(t.href))
  );

  // Reset al cambiar de datos
  useEffect(() => {
    fadeAnim.setValue(0);
    scaleAnim.setValue(0.92);
    setForcedReady(false);
    setLoadedCount(0);
    if (!needsNetwork) {
      // Todo está en caché: mostrar la lista sin esperar safety timeout.
      setForcedReady(true);
      return undefined;
    }
    // Safety timeout: si tardan demasiado, mostramos igualmente
    const timer = setTimeout(() => setForcedReady(true), needsNetwork ? 5000 : 1000);
    return () => clearTimeout(timer);
  }, [tableBlock, loadGeneration, needsNetwork]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fade-in + scale cuando todas las cards están listas
  useEffect(() => {
    if (isReady) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 280,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 9,
          tension: 40,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isReady]); // eslint-disable-line react-hooks/exhaustive-deps

  const displayLoaded = Math.min(loadedCount, totalCards);

  return (
    <View>
      {/* Skeletons + Progress bar: visibles mientras !isReady */}
      {!isReady && (
        <View>
          {/* Barra de progreso */}
          <View style={{ paddingHorizontal: Spacing.lg, paddingTop: Spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text style={{ fontSize: 12, color: Colors.textMuted }}>
                Cargando competiciones...
              </Text>
              <Text style={{ fontSize: 12, color: Colors.primary, fontWeight: '700' }}>
                {displayLoaded}/{totalCards}
              </Text>
            </View>
            <View style={{
              height: 4,
              backgroundColor: isDark ? '#334155' : '#e2e8f0',
              borderRadius: 4,
              overflow: 'hidden',
            }}>
              <View style={{
                width: totalCards > 0 ? `${(displayLoaded / totalCards) * 100}%` : '0%',
                height: '100%',
                backgroundColor: Colors.primary,
                borderRadius: 4,
              }} />
            </View>
          </View>

          <View style={{ paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, gap: Spacing.md }}>
            {tournaments.map((_, i) => (
              <SkeletonCompetitionCard key={i} />
            ))}
          </View>
        </View>
      )}

      {/* Cards reales con fade-in + scale */}
      <Animated.View style={{ opacity: fadeAnim, transform: [{ scale: scaleAnim }] }}>
        <FlatList
          data={tournaments}
          keyExtractor={(item) => item.id}
          extraData={loadGeneration}
          contentContainerStyle={{ paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md }}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.md }} />}
          renderItem={({ item, index }) => (
            <LeagueCardWrapper
              item={item}
              loadGeneration={loadGeneration}
              enableRankingFetch={index < RANKING_PREFETCH_LIMIT || (item.href ? resultCache.has(toRankingUrl(item.href)) : false)}
              onPress={(tipo) => item.href && onOpenTournament?.(item.href, item.name, tipo)}
              onLoaded={handleLoaded}
            />
          )}
          scrollEnabled={false}
        />
      </Animated.View>
    </View>
  );
}
