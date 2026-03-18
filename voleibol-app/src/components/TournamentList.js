import React, { useMemo, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image } from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Spacing, Typography, Radius, Shadow } from '../styles/theme';
import { useTheme } from '../contexts/ThemeContext';
import { useFetch } from '../hooks/useFetch';
import { toTournamentRankingUrl } from '../utils/htmlParser';

function LeagueShields({ href, isDark, isConfiguring }) {
  const rankingUrl = (!href || isConfiguring) ? null : toTournamentRankingUrl(href);
  const { blocks, loading } = useFetch(rankingUrl);
  const [imageErrs, setImageErrs] = useState({});

  const logosData = useMemo(() => {
    if (!blocks) return [];
    const tables = blocks.filter(b => b.type === 'table');
    const firstTable = tables[0];
    if (!firstTable || !firstTable.rows) return [];
    
    // Find the team name column (usually 1 or 0)
    const headers = firstTable.headers || [];
    const teamCol = headers.findIndex((h) => String(h || '').toLowerCase().includes('equipo'));
    const colIdx = teamCol >= 0 ? teamCol : 1;

    return firstTable.rows.slice(0, 3).map((row, i) => {
      const logoUrl = firstTable.rowLogos?.[i];
      const teamName = row[colIdx] || row[0] || 'EQ';
      const fallbackUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(teamName)}&background=random&color=fff&rounded=true&bold=true`;
      return { url: logoUrl || fallbackUrl, fallbackUrl, isPlaceholder: false };
    });
  }, [blocks]);

  if (!rankingUrl || loading) {
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
              onError={() => setImageErrs(p => ({...p, [idx]: true}))}
              style={{ width: '100%', height: '100%' }} resizeMode="cover" 
            />
          </View>
        ))}
      </View>
    );
  }

  return <DefaultShields isDark={isDark} />;
}

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

function TournamentCard({ item, onPress }) {
  const { colors: Colors, isDark } = useTheme();
  const { name, status, season, category, sex, teamCount, organizer } = item;
  const active = isActive(status);

  return (
    <TouchableOpacity
      style={{
        backgroundColor: isDark ? '#1e293b' : '#ffffff',
        borderRadius: Radius.xl,
        padding: Spacing.xl,
        borderWidth: 1,
        borderColor: 'rgba(13,143,242,0.05)',
        ...Shadow.sm,
      }}
      activeOpacity={0.8}
      onPress={onPress}
    >
      <View style={{ flexDirection: 'column', gap: Spacing.lg }}>
        {/* Top Tag & Status */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ backgroundColor: Colors.primary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.md }}>
            <Text style={{ color: '#ffffff', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 }}>
              {category || 'Competición'}
            </Text>
          </View>
          
          {!!status && (
            <View style={{ backgroundColor: isDark ? '#334155' : '#f8fafc', paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.sm, borderWidth: 1, borderColor: isDark ? '#475569' : '#e2e8f0' }}>
              <Text style={{ color: isDark ? '#cbd5e1' : '#64748b', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' }}>
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
          
          <LeagueShields href={item.href} isDark={isDark} isConfiguring={/configurando/i.test(status)} />

          {/* Button */}
          <View style={{ backgroundColor: Colors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radius.md, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '600' }}>Ver Liga</Text>
            <MaterialIcons name="chevron-right" size={18} color="#ffffff" />
          </View>

        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function TournamentList({ tableBlock, onOpenTournament }) {
  const { colors: Colors, isDark } = useTheme();
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
