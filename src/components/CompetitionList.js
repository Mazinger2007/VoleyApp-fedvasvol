import React, { memo, useMemo, useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, Platform, ActivityIndicator } from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Spacing, Typography, Radius } from '../styles/theme';
import { useTheme } from '../contexts/ThemeContext';
import { useFetch } from '../hooks/useFetch';
import { toRankingUrl } from '../utils/htmlParser';

const LeagueShields = memo(function LeagueShields({ blocks, isDark, isConfiguring }) {
  const [imageErrs, setImageErrs] = useState({});

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
        const fallbackUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(teamName)}&background=random&color=fff&rounded=true&bold=true`;
        return { url: logoUrl || fallbackUrl, fallbackUrl, isPlaceholder: false };
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
              const fallbackUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(match.homeTeam)}&background=random&color=fff&rounded=true&bold=true`;
              extractedTeams.push({ url: match.homeLogo || fallbackUrl, fallbackUrl, isPlaceholder: false });
            }
            if (extractedTeams.length >= 3) break;

            if (match.awayTeam && match.awayTeam.trim() !== '' && match.awayTeam.trim() !== 'TBD' && !seenTeams.has(match.awayTeam)) {
              seenTeams.add(match.awayTeam);
              const fallbackUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(match.awayTeam)}&background=random&color=fff&rounded=true&bold=true`;
              extractedTeams.push({ url: match.awayLogo || fallbackUrl, fallbackUrl, isPlaceholder: false });
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

  if (isConfiguring) {
    return <DefaultShields isDark={isDark} />;
  }

  if (logosData.length > 0) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 12 }}>
        {logosData.map((logo, idx) => (
          <View key={idx} style={{
            width: 32, height: 32, borderRadius: 16,
            borderWidth: 2, borderColor: isDark ? '#1e293b' : '#ffffff',
            backgroundColor: isDark ? '#334155' : '#f1f5f9',
            alignItems: 'center', justifyContent: 'center',
            marginLeft: idx === 0 ? 0 : -12, elevation: 1, overflow: 'hidden',
            zIndex: 10 - idx
          }}>
            <Image
              source={{ uri: imageErrs[idx] ? logo.fallbackUrl : logo.url }}
              onError={() => setImageErrs(p => ({ ...p, [idx]: true }))}
              style={{ width: '95%', height: '95%' }}
              resizeMode="contain"
            />
          </View>
        ))}
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

function CompetitionCard({ item, blocks, onPress }) {
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
          <LeagueShields blocks={blocks} isDark={isDark} isConfiguring={/configurando/i.test(status)} />
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

function SkeletonCompetitionCard() {
  const { colors: Colors, isDark } = useTheme();
  return (
    <View style={{
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderRadius: Radius.xl,
      borderWidth: 1,
      borderColor: 'rgba(13,143,242,0.05)',
      height: 165,
      marginBottom: Spacing.md,
      padding: Spacing.xl,
      justifyContent: 'space-between'
    }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <View style={{ width: 80, height: 20, backgroundColor: isDark ? '#334155' : '#f1f5f9', borderRadius: Radius.sm }} />
        <View style={{ width: 60, height: 20, backgroundColor: isDark ? '#334155' : '#f1f5f9', borderRadius: Radius.sm }} />
      </View>
      <View style={{ gap: 8 }}>
        <View style={{ width: '70%', height: 24, backgroundColor: isDark ? '#334155' : '#f1f5f9', borderRadius: Radius.sm }} />
        <View style={{ width: '40%', height: 16, backgroundColor: isDark ? '#334155' : '#f1f5f9', borderRadius: Radius.sm }} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: isDark ? '#334155' : '#f1f5f9', paddingTop: Spacing.md }}>
        <View style={{ width: 60, height: 32, backgroundColor: isDark ? '#334155' : '#f1f5f9', borderRadius: 16 }} />
        <View style={{ width: 100, height: 32, backgroundColor: isDark ? '#334155' : '#f1f5f9', borderRadius: Radius.md }} />
      </View>
    </View>
  );
}

function LeagueCardWrapper({ item, onPress, onLoaded }) {
  const rankingUrl = (!item.href || /configurando/i.test(item.status)) ? null : toRankingUrl(item.href);
  const { blocks, loading } = useFetch(rankingUrl);

  useEffect(() => {
    if (!loading) {
      onLoaded();
    }
  }, [loading, onLoaded]);

  // Once fetched, reveal the real Card populated fully with its data
  return <CompetitionCard item={item} onPress={onPress} blocks={blocks} />;
}

export default function CompetitionList({ tableBlock, onOpenTournament, onReady }) {
  const { colors: Colors, isDark } = useTheme();

  // Si no hay ligas, notificar inmediatamente para no bloquear la app
  useEffect(() => {
    if (!tableBlock?.rows?.length && onReady) {
      onReady();
    }
  }, [tableBlock, onReady]);

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

  const [loadedCount, setLoadedCount] = useState(0);

  const handleLoaded = useCallback(() => {
    setLoadedCount(prev => prev + 1);
  }, []);

  const totalCards = tournaments.length;
  // Fallback de seguridad: reducido a 4s para no bloquear demasiado en caso de red lenta
  const [forcedReady, setForcedReady] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setForcedReady(true), 4000);
    return () => clearTimeout(timer);
  }, []);

  const isReady = forcedReady || loadedCount >= totalCards;

  useEffect(() => {
    if (isReady && onReady) {
      onReady();
    }
  }, [isReady, onReady]);

  return (
    <View>
      {!isReady && (
        <View style={{ padding: Spacing.xxxl, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={{ marginTop: Spacing.md, color: Colors.textMuted, fontSize: Typography.size.md }}>
            Cargando competiciones...
          </Text>
        </View>
      )}
      <View style={{ opacity: isReady ? 1 : 0, height: isReady ? 'auto' : 0, overflow: 'hidden' }}>
        <FlatList
          data={tournaments}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md }}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.md }} />}
          renderItem={({ item }) => (
            <LeagueCardWrapper
              item={item}
              onPress={(tipo) => item.href && onOpenTournament?.(item.href, item.name, tipo)}
              onLoaded={handleLoaded}
            />
          )}
          scrollEnabled={false}
        />
      </View>
    </View>
  );
}
