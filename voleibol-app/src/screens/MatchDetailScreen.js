import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StatusBar,
  StyleSheet,
  Linking,
  Platform,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Radius, Spacing, Typography, Shadow } from '../styles/theme';
import { useTheme } from '../contexts/ThemeContext';
import { getMatchSummary } from '../components/MatchList';
import { getCachedLogoColorSync } from '../utils/logoColorCache';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

function TeamLogo({ uri, name, isDark, size = 64 }) {
  const bgColor = getCachedLogoColorSync(uri) || (isDark ? '#1e293b' : '#f1f5f9');
  return (
    <View style={[styles.logoWrap, { width: size + 8, height: size + 8, borderRadius: size / 2, backgroundColor: bgColor }]}>
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} resizeMode="contain" />
      ) : (
        <View style={[styles.logoPlaceholder, { width: size, height: size, borderRadius: size / 2, backgroundColor: 'rgba(0,0,0,0.1)' }]}>
          <Text style={{ fontSize: size / 3, fontWeight: 'bold', color: '#94a3b8' }}>{name?.[0] || '?'}</Text>
        </View>
      )}
    </View>
  );
}

export default function MatchDetailScreen({ route, navigation }) {
  const { match } = route.params;
  const { colors: Colors, isDark } = useTheme();
  const [activeTab, setActiveTab] = useState('detalles');

  const summary = useMemo(() => getMatchSummary(match), [match]);

  const openVenueInMaps = () => {
    const query = encodeURIComponent(summary.venue || '');
    const url = Platform.select({
      ios: `maps:0,0?q=${query}`,
      android: `geo:0,0?q=${query}`,
      default: `https://www.google.com/maps/search/?api=1&query=${query}`
    });
    Linking.openURL(url);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'detalles':
        const setList = summary.sets || [];
        let totalHomePoints = 0;
        let totalAwayPoints = 0;
        return (
          <View style={styles.card}>
            <View style={[styles.cardHeader, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc' }]}>
              <Text style={[styles.cardHeaderText, { color: Colors.textPrimary }]}>Puntuación por Sets</Text>
            </View>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHead, { flex: 1.5 }]}>SET</Text>
              <Text style={[styles.tableHead, { flex: 1, textAlign: 'center' }]}>LCL</Text>
              <Text style={[styles.tableHead, { flex: 1, textAlign: 'center' }]}>VST</Text>
              <Text style={[styles.tableHead, { flex: 1, textAlign: 'center' }]}>TOT</Text>
              <Text style={[styles.tableHead, { flex: 1.2, textAlign: 'right' }]}>GANADOR</Text>
            </View>
            {setList.map((set, idx) => {
              const home = parseInt(set.home || set.local) || 0;
              const away = parseInt(set.away || set.visitante) || 0;
              totalHomePoints += home;
              totalAwayPoints += away;
              const setTotal = home + away;
              const winner = home > away ? 'LCL' : (away > home ? 'VST' : '-');
              return (
                <View key={idx} style={[styles.tableRow, idx < (setList.length - 1) && styles.tableDivider]}>
                  <Text style={[styles.setLabel, { flex: 1.5, color: Colors.textSecondary }]}>Set {idx + 1}</Text>
                  <Text style={[styles.scoreValue, { flex: 1, color: home > away ? Colors.primary : Colors.textPrimary }]}>{home}</Text>
                  <Text style={[styles.scoreValue, { flex: 1, color: away > home ? Colors.primary : Colors.textPrimary }]}>{away}</Text>
                  <Text style={[styles.scoreTotalValue, { flex: 1, color: Colors.textMuted }]}>{setTotal}</Text>
                  <View style={{ flex: 1.2, alignItems: 'flex-end' }}>
                    {winner !== '-' && (
                      <View style={[styles.winnerBadge, { backgroundColor: winner === 'LCL' ? (isDark ? 'rgba(59,130,246,0.1)' : '#eff6ff') : (isDark ? 'rgba(148,163,184,0.1)' : '#f1f5f9') }]}>
                        <Text style={[styles.winnerBadgeText, { color: winner === 'LCL' ? Colors.primary : Colors.textMuted }]}>{winner}</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
            <View style={[styles.totalPointsRow, { borderTopColor: Colors.border, backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#f8fafc' }]}>
              <Text style={[styles.totalPointsLabel, { flex: 1.5, color: Colors.textMuted }]}>PUNTOS</Text>
              <Text style={[styles.totalPointsValue, { flex: 1, color: Colors.textPrimary }]}>{totalHomePoints}</Text>
              <Text style={[styles.totalPointsValue, { flex: 1, color: Colors.textPrimary }]}>{totalAwayPoints}</Text>
              <Text style={[styles.totalPointsValueSum, { flex: 1, color: Colors.primary }]}>{totalHomePoints + totalAwayPoints}</Text>
              <View style={{ flex: 1.2 }} />
            </View>
            <View style={[styles.totalRow, { backgroundColor: Colors.primaryAlpha10 }]}>
              <Text style={[styles.totalLabel, { color: Colors.textPrimary }]}>SETS</Text>
              <Text style={[styles.totalValue, { color: Colors.primary }]}>{summary.homeScore}</Text>
              <Text style={[styles.totalValue, { color: Colors.textMuted }]}>{summary.awayScore}</Text>
              <Text style={[styles.finalLabel, { color: Colors.primary }]}>Final</Text>
            </View>
          </View>
        );
      case 'mapa':
        return (
          <View style={{ gap: Spacing.lg }}>
            <View style={[styles.mapPlaceholder, { borderColor: Colors.border, backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }]}>
              <Image source={{ uri: `https://images.unsplash.com/photo-1569336415962-a4bd9f69c07a?auto=format&fit=crop&q=80&w=800&sig=${encodeURIComponent(summary.venue || '')}` }} style={styles.mapImg} />
              <View style={styles.mapOverlay}>
                <View style={[styles.mapPin, { backgroundColor: Colors.primary, elevation: 10 }]}>
                  <MaterialIcons name="location-on" size={36} color="#fff" />
                </View>
                <View style={[styles.mapTooltip, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
                  <Text style={[styles.mapTooltipText, { color: Colors.textPrimary }]}>{summary.venue || 'Sede'}</Text>
                </View>
              </View>
            </View>
            <View style={styles.card}>
              <View style={styles.cardPadding}>
                <Text style={[styles.venueName, { color: Colors.textPrimary }]}>{summary.venue || 'Pabellón no especificado'}</Text>
                <View style={styles.addressRow}>
                  <MaterialIcons name="place" size={18} color={Colors.primary} />
                  <Text style={[styles.addressText, { color: Colors.textMuted }]}>Información de ubicación obtenida del calendario oficial.</Text>
                </View>
                <View style={{ gap: Spacing.md, marginTop: Spacing.xl }}>
                  <TouchableOpacity style={[styles.actionBtn, { backgroundColor: Colors.primary }]} onPress={openVenueInMaps}>
                    <MaterialIcons name="map" size={20} color="#fff" />
                    <Text style={styles.actionBtnText}>Abrir en Mapas</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionBtnOutline, { borderColor: Colors.primary }]}>
                    <MaterialIcons name="notifications-active" size={20} color={Colors.primary} />
                    <Text style={[styles.actionBtnTextOutline, { color: Colors.primary }]}>Añadir recordatorio</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        );
      case 'repeticion':
        return (
          <View style={{ gap: Spacing.xl }}>
            <View style={[styles.videoPlayer, { backgroundColor: '#000' }]}>
              <Image source={{ uri: 'https://images.unsplash.com/photo-1592656094267-764a45159577?auto=format&fit=crop&q=80&w=800' }} style={styles.videoThumb} />
              <View style={styles.playBtnWrap}>
                <View style={[styles.playBtn, { backgroundColor: 'rgba(13,143,242,0.9)' }]}>
                  <MaterialIcons name="play-arrow" size={48} color="#fff" />
                </View>
              </View>
            </View>
            <View style={styles.clipListHeader}>
              <Text style={[styles.sectionTitle, { color: Colors.primary }]}>Momentos Destacados</Text>
              <Text style={[styles.clipCount, { backgroundColor: Colors.surfaceAlt, color: Colors.textMuted }]}>3 CLIPS</Text>
            </View>
            {[1, 2, 3].map((i) => (
              <TouchableOpacity key={i} style={[styles.clipCard, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
                <View style={styles.clipThumbWrap}>
                  <Image source={{ uri: `https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&q=80&w=400&sig=${i}` }} style={styles.clipThumb} />
                  <View style={styles.durationBadge}>
                    <Text style={styles.durationText}>0{i}:20</Text>
                  </View>
                </View>
                <View style={styles.clipInfo}>
                  <Text style={[styles.clipTitle, { color: Colors.textPrimary }]} numberOfLines={2}>Lo mejor del Set {i} - Jugada clave</Text>
                  <Text style={[styles.clipMeta, { color: Colors.textMuted }]}>Puntazo del partido</Text>
                </View>
                <MaterialIcons name="play-circle-filled" size={32} color={Colors.primary} />
              </TouchableOpacity>
            ))}
          </View>
        );
      default:
        return null;
    }
  };

  const badgeText = summary.state === 'live' ? 'EN CURSO' : (summary.state === 'finished' ? 'FINALIZADO' : 'PRÓXIMO');

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: Colors.background }]} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={[styles.header, { backgroundColor: Colors.surface, borderBottomColor: Colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: Colors.textPrimary }]}>Detalles del partido</Text>
        <TouchableOpacity style={styles.notifyBtn}>
          <MaterialIcons name="notifications-none" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent} stickyHeaderIndices={[2]}>
        <View style={[styles.hero, { backgroundColor: isDark ? Colors.surface : Colors.primary }]}>
          <View style={styles.heroStatus}>
            <View style={[styles.statusBadge, { backgroundColor: isDark ? Colors.primaryAlpha20 : 'rgba(255,255,255,0.2)' }]}>
              <Text style={styles.statusBadgeText}>{badgeText}</Text>
            </View>
            <Text style={styles.matchDate}>{(summary.date || '').split('·')[0].trim() || 'Fecha pendiente'}</Text>
          </View>
          <View style={styles.scoreboard}>
            <View style={styles.teamSide}>
              <TeamLogo uri={summary.homeLogo} name={summary.homeTeam} isDark={isDark} size={64} />
              <Text style={styles.teamName} numberOfLines={2}>{summary.homeTeam}</Text>
            </View>
            <View style={styles.scoreContainer}>
              <Text style={styles.scoreText}>
                <Text style={summary.homeScore >= summary.awayScore ? styles.scoreBold : styles.scoreDim}>{summary.homeScore}</Text>
                <Text style={styles.scoreSep}> - </Text>
                <Text style={summary.awayScore >= summary.homeScore ? styles.scoreBold : styles.scoreDim}>{summary.awayScore}</Text>
              </Text>
            </View>
            <View style={styles.teamSide}>
              <TeamLogo uri={summary.awayLogo} name={summary.awayTeam} isDark={isDark} size={64} />
              <Text style={styles.teamName} numberOfLines={2}>{summary.awayTeam}</Text>
            </View>
          </View>
          <View style={styles.venueRow}>
            <MaterialIcons name="location-pin" size={14} color="rgba(255,255,255,0.7)" />
            <Text style={styles.venueText} numberOfLines={1}>{summary.venue || 'Sede por definir'}</Text>
          </View>
        </View>
        <View style={{ height: Spacing.lg, backgroundColor: 'transparent' }} />
        <View>
          <View style={{ 
            flexDirection: 'row', 
            width: '100%', 
            backgroundColor: Colors.surface, 
            borderBottomWidth: 1, 
            borderBottomColor: Colors.border,
            zIndex: 10,
            elevation: 4
          }}>
            {['detalles', 'mapa', 'repeticion'].map((tab) => {
              const isActive = activeTab === tab;
              const label = tab === 'repeticion' ? 'Repetición' : tab.charAt(0).toUpperCase() + tab.slice(1);
              return (
                <TouchableOpacity
                  key={tab}
                  onPress={() => setActiveTab(tab)}
                  activeOpacity={0.8}
                  style={{
                    flex: 1,
                    paddingVertical: Spacing.md,
                    alignItems: 'center',
                    borderBottomWidth: 3,
                    borderBottomColor: isActive ? Colors.primary : 'transparent'
                  }}
                >
                  <Text style={{
                    fontSize: 14,
                    fontWeight: isActive ? '800' : '600',
                    color: isActive ? Colors.primary : Colors.textMuted
                  }}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
        <View style={styles.mainContent}>
          {renderTabContent()}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm,
    borderBottomWidth: 1,
    ...Platform.select({ ios: Shadow.sm, android: { elevation: 3 } }),
  },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: Typography.size.md, fontWeight: '700' },
  notifyBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  hero: {
    padding: Spacing.xl,
    paddingTop: Spacing.lg,
    borderBottomLeftRadius: Radius.xl,
    borderBottomRightRadius: Radius.xl,
    ...Shadow.md,
  },
  heroStatus: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xl },
  statusBadge: { paddingHorizontal: Spacing.md, paddingVertical: 4, borderRadius: Radius.full },
  statusBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  matchDate: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '600' },
  scoreboard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md },
  teamSide: { flex: 1, alignItems: 'center', gap: Spacing.sm },
  logoWrap: { justifyContent: 'center', alignItems: 'center', ...Shadow.sm },
  logoPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  teamName: { color: '#fff', fontSize: 12, fontWeight: '800', textAlign: 'center', textTransform: 'uppercase' },
  scoreContainer: { alignItems: 'center', justifyContent: 'center' },
  scoreText: { fontSize: 48, fontWeight: '900', color: '#fff', letterSpacing: -2 },
  scoreSep: { opacity: 0.4, fontWeight: '300' },
  scoreDim: { opacity: 0.5 },
  scoreBold: { fontWeight: '900' },
  venueRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: Spacing.xl, gap: 4 },
  venueText: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '500' },
  scrollContent: { paddingBottom: 60 },
  mainContent: { padding: Spacing.lg },
  card: { borderRadius: Radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(71,85,105,0.2)' },
  cardHeader: { padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: 'rgba(71,85,105,0.1)' },
  cardHeaderText: { fontSize: 14, fontWeight: '700' },
  cardPadding: { padding: Spacing.lg },
  tableHeader: { flexDirection: 'row', paddingHorizontal: Spacing.md, paddingVertical: 10, backgroundColor: 'rgba(148,163,184,0.05)' },
  tableHead: { fontSize: 10, fontWeight: '700', color: '#94a3b8', letterSpacing: 0.5 },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: 14 },
  tableDivider: { borderBottomWidth: 1, borderBottomColor: 'rgba(71,85,105,0.08)' },
  setLabel: { fontSize: 14, fontWeight: '600' },
  scoreValue: { fontSize: 16, fontWeight: '800', textAlign: 'center' },
  scoreTotalValue: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
  winnerBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.full },
  winnerBadgeText: { fontSize: 11, fontWeight: '700' },
  totalPointsRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: 12, borderTopWidth: 1 },
  totalPointsLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  totalPointsValue: { fontSize: 14, fontWeight: '700', textAlign: 'center' },
  totalPointsValueSum: { fontSize: 15, fontWeight: '900', textAlign: 'center' },
  totalRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: 18 },
  totalLabel: { flex: 1.5, fontSize: 15, fontWeight: '800' },
  totalValue: { flex: 1, fontSize: 24, fontWeight: '900', textAlign: 'center' },
  finalLabel: { flex: 1.2, textAlign: 'right', fontSize: 14, fontWeight: '700' },
  mapPlaceholder: { width: '100%', height: 180, borderRadius: Radius.xl, overflow: 'hidden', borderWidth: 1, position: 'relative' },
  mapImg: { width: '100%', height: '100%' },
  mapOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.1)', justifyContent: 'center', alignItems: 'center' },
  mapPin: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
  mapTooltip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.md, borderWidth: 1, marginTop: 8, ...Shadow.sm },
  mapTooltipText: { fontSize: 11, fontWeight: '700' },
  venueName: { fontSize: Typography.size.lg, fontWeight: '800', marginBottom: 4 },
  addressRow: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
  addressText: { flex: 1, fontSize: 13, lineHeight: 18 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52, borderRadius: Radius.lg, ...Shadow.sm },
  actionBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  actionBtnOutline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52, borderRadius: Radius.lg, borderWidth: 2 },
  actionBtnTextOutline: { fontSize: 15, fontWeight: '700' },
  videoPlayer: { aspectRatio: 16 / 9, borderRadius: Radius.xl, overflow: 'hidden', position: 'relative', ...Shadow.lg },
  videoThumb: { width: '100%', height: '100%', opacity: 0.8 },
  playBtnWrap: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  playBtn: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center' },
  clipListHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.sm },
  sectionTitle: { fontSize: 18, fontWeight: '900' },
  clipCount: { fontSize: 10, fontWeight: '800', paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.sm },
  clipCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: Radius.lg, borderWidth: 1, ...Shadow.sm },
  clipThumbWrap: { width: 100, height: 70, borderRadius: Radius.md, overflow: 'hidden', position: 'relative' },
  clipThumb: { width: '100%', height: '100%' },
  durationBadge: { position: 'absolute', bottom: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 4, paddingVertical: 2, borderRadius: 2 },
  durationText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  clipInfo: { flex: 1 },
  clipTitle: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  clipMeta: { fontSize: 11, fontWeight: '500' },
});
