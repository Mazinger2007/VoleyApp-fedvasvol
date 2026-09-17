import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Image, RefreshControl, ScrollView, Dimensions, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useFavorites } from '../../contexts/FavoritesContext';
import { CardSection } from '../../components/base/Card';
import TeamLogo from '../../components/base/TeamLogo';
import { SkeletonCard } from '../../components/base/SkeletonLoader';
import EmptyState from '../../components/base/EmptyState';
import { fetchAndParse, fetchAndParseCached, URLS, toRankingUrl } from '../../utils/htmlParser';
import { getTeamFromCache, cacheTeamsFromRanking } from '../../utils/teamCache';
import {
  loadRankingCache, getAllCachedStandings,
  saveLeagueStandings,
} from '../../utils/rankingCache';
import { resultCache, markUrlFailed, clearUrlFailure } from '../../hooks/useFetch';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_HORIZONTAL_PADDING = 16;
const LEAGUE_CARD_WIDTH = SCREEN_WIDTH - CARD_HORIZONTAL_PADDING * 2 - 8;
const TEAM_CARD_WIDTH = SCREEN_WIDTH * 0.42;

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 20) return 'Buenas tardes';
  return 'Buenas noches';
}

function PaginationDots({ count, activeIndex, color }) {
  if (count <= 1) return null;
  return (
    <View style={styles.paginationDots}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            {
              backgroundColor: i === activeIndex ? color : 'rgba(128,128,128,0.3)',
              width: i === activeIndex ? 20 : 6,
            },
          ]}
        />
      ))}
    </View>
  );
}

function SkeletonRow({ colors }) {
  return (
    <View style={styles.leagueTeamRow}>
      <View style={[styles.leagueTeamPos, { backgroundColor: colors.surfaceAlt }]} />
      <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.surfaceAlt }} />
      <View style={[styles.skeletonBar, { flex: 1, height: 12, borderRadius: 4, backgroundColor: colors.surfaceAlt }]} />
      <View style={[styles.skeletonBar, { width: 32, height: 16, borderRadius: 6, backgroundColor: colors.surfaceAlt }]} />
    </View>
  );
}

function LeagueCarouselCard({ item, teams, loading, colors, onPressHeader, onPressTeam }) {
  return (
    <TouchableOpacity
      style={[styles.leagueCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
      activeOpacity={0.85}
      onPress={onPressHeader}
    >
      <View style={styles.leagueCardHeader}>
        <MaterialIcons name="emoji-events" size={16} color={colors.primary} />
        <Text style={[styles.leagueCardTitle, { color: colors.textPrimary }]} numberOfLines={1}>
          {item.title}
        </Text>
        <MaterialIcons name="chevron-right" size={18} color={colors.textMuted} />
      </View>

      <View style={[styles.leagueCardDivider, { backgroundColor: colors.divider }]} />

      {loading ? (
        <>
          <SkeletonRow colors={colors} />
          <SkeletonRow colors={colors} />
          <SkeletonRow colors={colors} />
        </>
      ) : teams.length > 0 ? teams.map((t, ti) => {
        const setDiff = (t.setsFor && t.setsAgainst)
          ? `${t.setsFor}-${t.setsAgainst}`
          : null;
        return (
          <TouchableOpacity
            key={ti}
            style={styles.leagueTeamRow}
            onPress={onPressTeam}
            activeOpacity={0.7}
          >
            <View style={[styles.leagueTeamPos, { backgroundColor: ti === 0 ? colors.primary + '20' : 'transparent' }]}>
              <Text style={[styles.leagueTeamPosText, { color: ti === 0 ? colors.primary : colors.textMuted }]}>
                {t.position || ti + 1}
              </Text>
            </View>
            <TeamLogo uri={t.logo} name={t.name} size={28} />
            <Text style={[styles.leagueTeamName, { color: colors.textPrimary }]} numberOfLines={1}>
              {t.name}
            </Text>
            {setDiff ? (
              <Text style={[styles.leagueTeamDiff, { color: colors.textMuted }]}>{setDiff}</Text>
            ) : null}
            {t.points ? (
              <View style={[styles.leagueTeamPtsBadge, { backgroundColor: colors.primaryAlpha15 }]}>
                <Text style={[styles.leagueTeamPts, { color: colors.primary }]}>{t.points}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        );
      }) : (
        <View style={styles.leagueEmpty}>
          <Text style={[styles.leagueEmptyText, { color: colors.textMuted }]}>Sin datos de clasificación</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function TeamCarouselCard({ item, cached, colors, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.teamCarouselCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={[styles.teamCarouselLogoWrap, { backgroundColor: colors.primaryAlpha10 }]}>
        <TeamLogo uri={cached?.logo || ''} name={item.entityName} size={56} />
      </View>
      <Text style={[styles.teamCarouselName, { color: colors.textPrimary }]} numberOfLines={2}>
        {item.entityName}
      </Text>
      {cached?.divisionName ? (
        <Text style={[styles.teamCarouselCategory, { color: colors.textMuted }]} numberOfLines={1}>
          {cached.divisionName}
        </Text>
      ) : null}
      {cached?.leagueStats?.points ? (
        <View style={[styles.teamCarouselPts, { backgroundColor: colors.primaryAlpha15 }]}>
          <Text style={[styles.teamCarouselPtsText, { color: colors.primary }]}>{cached.leagueStats.points} pts</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

function extractStandings(table) {
  if (!table?.headers || !table?.rows?.length) return [];
  const headers = table.headers.map(h => h.toLowerCase());
  const teamCol = headers.findIndex(h => /equipo|club|nombre|team/i.test(h));
  const ptsCol = headers.findIndex(h => /pts|puntos|points/i.test(h));
  const sfCol = headers.findIndex(h => /favor|sf|sets?\s*(?:a|favor)/i.test(h));
  const scCol = headers.findIndex(h => /contra|sc|sets?\s*(?:c|contra)/i.test(h));
  const tc = teamCol >= 0 ? teamCol : 1;
  return table.rows.slice(0, 5).map((row, i) => ({
    name: row[tc] || row[1] || '',
    logo: table.rowLogos?.[i] || table.rowImages?.[i] || null,
    position: row[0] || String(i + 1),
    points: ptsCol >= 0 ? row[ptsCol] : null,
    setsFor: sfCol >= 0 ? row[sfCol] : null,
    setsAgainst: scCol >= 0 ? row[scCol] : null,
  })).filter(t => t.name);
}

export default function HomeScreen({ navigation }) {
  const { colors } = useTheme();
  const { userProfile, isGuest } = useAuth();
  const { favorites } = useFavorites();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const contentAnim = useRef(new Animated.Value(0)).current;
  const scaleContent = useRef(new Animated.Value(0.92)).current;
  const prevLoading = useRef(true);

  const [leagueIdx, setLeagueIdx] = useState(0);
  const [teamIdx, setTeamIdx] = useState(0);
  const leagueScrollX = useRef(new Animated.Value(0)).current;
  const teamScrollX = useRef(new Animated.Value(0)).current;

  const [compData, setCompData] = useState(null);
  const [newsData, setNewsData] = useState([]);
  const [recentMatches, setRecentMatches] = useState([]);

  const [leagueStandings, setLeagueStandings] = useState({});
  const [standingsReady, setStandingsReady] = useState(false);
  const fetchedRef = useRef(new Set());

  const favLeagues = useMemo(
    () => favorites.filter(f => f.entityType === 'league' || f.entityType === 'competition')
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [favorites],
  );
  const favTeams = useMemo(
    () => favorites.filter(f => f.entityType === 'team')
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [favorites],
  );

  useEffect(() => {
    async function loadCached() {
      await loadRankingCache();
      const allCache = getAllCachedStandings();
      const initial = {};
      for (const [leagueId, entry] of Object.entries(allCache)) {
        if (entry?.standings?.length > 0) {
          initial[leagueId] = entry.standings;
        }
      }
      if (Object.keys(initial).length > 0) {
        setLeagueStandings(initial);
      }
      setStandingsReady(true);
    }
    loadCached();
  }, []);

  // Serie de peticiones de favoritos: fetches en paralelo saturan la cola de
  // fedvasvol y el servidor responde 403 "Request failed with status code 403".
  // De uno en uno (la cola de htmlParser ya serializa, aquí evitamos además el
  // apilado) y con backoff tras un error para no reintentar en bucle.
  const rankFetchFailedAtRef = useRef(new Map());

  useEffect(() => {
    if (!standingsReady || favLeagues.length === 0) return;

    const toFetch = favLeagues.filter(fav => !fetchedRef.current.has(fav.entityId));
    if (toFetch.length === 0) return;

    let cancelled = false;

    (async () => {
      for (const fav of toFetch) {
        if (cancelled) return;
        const leagueId = fav.entityId;
        fetchedRef.current.add(leagueId);

        try {
          const rankingUrl = toRankingUrl(leagueId);
          if (!rankingUrl) continue;

          const failedAt = rankFetchFailedAtRef.current.get(rankingUrl) || 0;
          if (Date.now() - failedAt < 60 * 1000) continue; // error reciente: esperamos

          const blocks = await fetchAndParse(rankingUrl);
          if (cancelled) return;
          resultCache.set(rankingUrl, blocks);
          clearUrlFailure(rankingUrl);
          const tableBlock = blocks?.find(b => b.type === 'table' && b.rows?.length > 0);
          if (tableBlock) {
            const standings = extractStandings(tableBlock);
            if (standings.length > 0) {
              setLeagueStandings(prev => ({ ...prev, [leagueId]: standings }));
              saveLeagueStandings(leagueId, standings);
              cacheTeamsFromRanking(rankingUrl, [tableBlock]);
              continue;
            }
          }
          setLeagueStandings(prev => ({ ...prev, [leagueId]: null }));
        } catch (e) {
          const rankingUrl = toRankingUrl(fav.entityId);
          if (rankingUrl) {
            markUrlFailed(rankingUrl);
            rankFetchFailedAtRef.current.set(rankingUrl, Date.now());
          }
          console.warn('[Home] Rank fetch:', fav.entityId, e.message);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [favLeagues, standingsReady]);

  const loadData = useCallback(async () => {
    try {
      const [compBlocks, newsBlocks] = await Promise.allSettled([
        fetchAndParseCached(URLS.competitions),
        fetchAndParseCached(URLS.posts),
      ]);

      if (compBlocks.status === 'fulfilled' && compBlocks.value) {
        setCompData(compBlocks.value);
        for (const block of compBlocks.value) {
          if (block.type === 'table' && block.rows?.length) {
            cacheTeamsFromRanking(block.url || URLS.competitions, [block]);
          }
        }
      }

      if (newsBlocks.status === 'fulfilled' && newsBlocks.value) {
        const postsBlock = newsBlocks.value.find(b => b.type === 'posts');
        if (postsBlock?.posts) {
          setNewsData(postsBlock.posts.slice(0, 5));
        }
      }

      const allMatches = [];
      if (compBlocks.status === 'fulfilled' && compBlocks.value) {
        for (const block of compBlocks.value) {
          if (block.type === 'table' && block.matches) {
            allMatches.push(...block.matches);
          }
        }
      }
      allMatches.sort((a, b) => {
        const da = a.dateTime ? new Date(a.dateTime).getTime() : 0;
        const db = b.dateTime ? new Date(b.dateTime).getTime() : 0;
        return db - da;
      });
      setRecentMatches(allMatches.slice(0, 4));
    } catch (e) {
      console.warn('[Home] Load error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!loading && prevLoading.current) {
      contentAnim.setValue(0);
      Animated.parallel([
        Animated.timing(contentAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(scaleContent, { toValue: 1, friction: 9, tension: 40, useNativeDriver: true }),
      ]).start();
    }
    prevLoading.current = loading;
  }, [loading]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    fetchedRef.current.clear();
    rankFetchFailedAtRef.current.clear();
    await loadData();
    if (favLeagues.length > 0) {
      const results = await Promise.allSettled(
        favLeagues.map(async (fav) => {
          const leagueId = fav.entityId;
          const rankingUrl = toRankingUrl(leagueId);
          if (!rankingUrl) return;
          const blocks = await fetchAndParse(rankingUrl);
          resultCache.set(rankingUrl, blocks);
          const tableBlock = blocks?.find(b => b.type === 'table' && b.rows?.length > 0);
          if (tableBlock) {
            const standings = extractStandings(tableBlock);
            if (standings.length > 0) {
              setLeagueStandings(prev => ({ ...prev, [leagueId]: standings }));
              saveLeagueStandings(leagueId, standings);
              cacheTeamsFromRanking(rankingUrl, [tableBlock]);
              return;
            }
          }
          setLeagueStandings(prev => ({ ...prev, [leagueId]: null }));
        })
      );
      results.forEach((r, i) => {
        if (r.status === 'rejected') {
          console.warn('[Home] Refresh rank:', favLeagues[i]?.entityId, r.reason?.message);
        }
      });
    }
    setRefreshing(false);
  }, [loadData, favLeagues]);

  const displayName = userProfile?.username || (isGuest ? 'Invitado' : 'Usuario');

  function renderMatchCompact(match, idx) {
    return (
      <TouchableOpacity
        key={idx}
        style={[styles.matchCompact, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => match.href && navigation.navigate('MatchDetail', { match })}
        activeOpacity={0.7}
      >
        <Text style={[styles.matchCompName, { color: colors.textMuted }]} numberOfLines={1}>
          {match.competition || match.category || ''}
        </Text>
        <View style={styles.matchTeams}>
          <Text style={[styles.matchTeam, { color: colors.textPrimary }]} numberOfLines={1}>
            {match.homeTeam || match.team1 || '—'}
          </Text>
          <View style={[styles.matchScoreBox, { backgroundColor: colors.primaryAlpha15 }]}>
            <Text style={[styles.matchScore, { color: colors.primary }]}>
              {match.scoreText || match.score || '—'}
            </Text>
          </View>
          <Text style={[styles.matchTeam, { color: colors.textPrimary, textAlign: 'right' }]} numberOfLines={1}>
            {match.awayTeam || match.team2 || '—'}
          </Text>
        </View>
        <Text style={[styles.matchDate, { color: colors.textMuted }]}>
          {match.dateText || match.date || ''}
        </Text>
      </TouchableOpacity>
    );
  }

  function renderNewsItem(item, idx) {
    return (
      <TouchableOpacity
        key={idx}
        style={[styles.newsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => item.href && navigation.navigate('PostDetail', { postUrl: item.href, postTitle: item.title })}
        activeOpacity={0.7}
      >
        {item.image ? (
          <Image source={{ uri: item.image }} style={styles.newsImage} resizeMode="cover" />
        ) : (
          <View style={[styles.newsImagePlaceholder, { backgroundColor: colors.surfaceAlt }]}>
            <MaterialIcons name="article" size={28} color={colors.textMuted} />
          </View>
        )}
        <View style={styles.newsInfo}>
          <Text style={[styles.newsTitle, { color: colors.textPrimary }]} numberOfLines={2}>
            {item.title}
          </Text>
          {item.date ? (
            <Text style={[styles.newsDate, { color: colors.textMuted }]}>{item.date}</Text>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.header}>
          <Text style={[styles.greeting, { color: colors.textSecondary }]}>{getGreeting()}</Text>
          <Text style={[styles.userName, { color: colors.textPrimary }]}>{displayName}</Text>
        </View>
        <ScrollView contentContainerStyle={[styles.scrollContent, { paddingHorizontal: 16 }]}>
          <SkeletonCard count={3} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <Animated.ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
        style={{ opacity: contentAnim, transform: [{ scale: scaleContent }] }}
      >
        <View style={styles.header}>
          <Text style={[styles.greeting, { color: colors.textSecondary }]}>{getGreeting()}</Text>
          <Text style={[styles.userName, { color: colors.textPrimary }]}>{displayName}</Text>
        </View>

        {favLeagues.length > 0 && (
          <View style={styles.carouselSection}>
            <View style={styles.carouselSectionHeader}>
              <Text style={[styles.carouselSectionTitle, { color: colors.textPrimary }]}>Tus ligas</Text>
              <TouchableOpacity onPress={() => navigation.navigate('ResultsTab')} activeOpacity={0.7}>
                <Text style={[styles.carouselSectionAction, { color: colors.primary }]}>Ver todas</Text>
              </TouchableOpacity>
            </View>
            <Animated.FlatList
              data={favLeagues}
              keyExtractor={(item, i) => `${item.entityId}-${i}`}
              horizontal
              pagingEnabled
              snapToInterval={LEAGUE_CARD_WIDTH + 12}
              decelerationRate="fast"
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: CARD_HORIZONTAL_PADDING }}
              onScroll={Animated.event(
                [{ nativeEvent: { contentOffset: { x: leagueScrollX } } }],
                { useNativeDriver: false, listener: (e) => {
                  const idx = Math.round(e.nativeEvent.contentOffset.x / (LEAGUE_CARD_WIDTH + 12));
                  if (idx !== leagueIdx) setLeagueIdx(idx);
                }}
              )}
              renderItem={({ item }) => {
                const teams = leagueStandings[item.entityId];
                const isLoading = !standingsReady || teams === undefined;
                return (
                  <LeagueCarouselCard
                    item={{ title: item.entityName, url: item.entityId }}
                    teams={teams || []}
                    loading={isLoading}
                    colors={colors}
                    onPressHeader={() => navigation.navigate('LeagueDetail', { url: item.entityId, title: item.entityName })}
                    onPressTeam={() => navigation.navigate('LeagueDetail', { url: item.entityId, title: item.entityName })}
                  />
                );
              }}
            />
            <PaginationDots count={favLeagues.length} activeIndex={leagueIdx} color={colors.primary} />
          </View>
        )}

        {favTeams.length > 0 && (
          <View style={styles.carouselSection}>
            <View style={styles.carouselSectionHeader}>
              <Text style={[styles.carouselSectionTitle, { color: colors.textPrimary }]}>Tus equipos</Text>
            </View>
            <Animated.FlatList
              data={favTeams}
              keyExtractor={(item, i) => `${item.entityId}-${i}`}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: CARD_HORIZONTAL_PADDING, gap: 12 }}
              snapToInterval={TEAM_CARD_WIDTH + 12}
              decelerationRate="fast"
              onScroll={Animated.event(
                [{ nativeEvent: { contentOffset: { x: teamScrollX } } }],
                { useNativeDriver: false, listener: (e) => {
                  const idx = Math.round(e.nativeEvent.contentOffset.x / (TEAM_CARD_WIDTH + 12));
                  if (idx !== teamIdx) setTeamIdx(idx);
                }}
              )}
              renderItem={({ item }) => {
                const cached = getTeamFromCache('', item.entityName);
                return (
                  <TeamCarouselCard
                    item={item}
                    cached={cached}
                    colors={colors}
                    onPress={() => navigation.navigate('TeamDetail', {
                      teamName: item.entityName,
                      teamUrl: item.entityId,
                      teamLogo: cached?.logo || '',
                    })}
                  />
                );
              }}
            />
          </View>
        )}

        {recentMatches.length > 0 && (
          <CardSection title="Últimos resultados" actionText="Ver todos" onAction={() => navigation.navigate('ResultsTab')}>
            {recentMatches.map((m, i) => renderMatchCompact(m, i))}
          </CardSection>
        )}

        {newsData.length > 0 && (
          <CardSection title="Noticias" actionText="Ver todas" onAction={() => navigation.navigate('NewsTab')}>
            {newsData.map((n, i) => renderNewsItem(n, i))}
          </CardSection>
        )}

        {favLeagues.length === 0 && favTeams.length === 0 && recentMatches.length === 0 && newsData.length === 0 && (
          <EmptyState icon="sports-volleyball" message="Añade ligas o equipos favoritos para ver tu personalización aquí" />
        )}

        <View style={{ height: 20 }} />
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: 30 },
  header: { paddingHorizontal: 16, paddingTop: 8, marginBottom: 16 },
  greeting: { fontSize: 13, fontWeight: '500' },
  userName: { fontSize: 24, fontWeight: '800', marginTop: 2 },

  carouselSection: { marginBottom: 24 },
  carouselSectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, marginBottom: 12,
  },
  carouselSectionTitle: { fontSize: 17, fontWeight: '800' },
  carouselSectionAction: { fontSize: 13, fontWeight: '600' },

  paginationDots: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    gap: 4, marginTop: 12,
  },
  dot: {
    height: 6, borderRadius: 3,
  },

  leagueCard: {
    width: LEAGUE_CARD_WIDTH,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginRight: 12,
  },
  leagueCardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4,
  },
  leagueCardTitle: { fontSize: 15, fontWeight: '800', flex: 1 },
  leagueCardDivider: { height: 1, marginBottom: 10 },

  leagueTeamRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 6,
  },
  leagueTeamPos: {
    width: 24, height: 24, borderRadius: 6,
    alignItems: 'center', justifyContent: 'center',
  },
  leagueTeamPosText: { fontSize: 11, fontWeight: '800' },
  leagueTeamName: { fontSize: 13, fontWeight: '600', flex: 1 },
  leagueTeamDiff: { fontSize: 11, fontWeight: '600', marginRight: 4 },
  leagueTeamPtsBadge: {
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6,
    minWidth: 36, alignItems: 'center',
  },
  leagueTeamPts: { fontSize: 12, fontWeight: '800' },

  skeletonBar: {},

  leagueEmpty: { paddingVertical: 16, alignItems: 'center' },
  leagueEmptyText: { fontSize: 13, fontStyle: 'italic' },

  teamCarouselCard: {
    width: TEAM_CARD_WIDTH,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    alignItems: 'center',
  },
  teamCarouselLogoWrap: {
    width: 72, height: 72, borderRadius: 36,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 10,
  },
  teamCarouselName: {
    fontSize: 13, fontWeight: '700', textAlign: 'center',
    marginBottom: 4,
  },
  teamCarouselCategory: { fontSize: 11, textAlign: 'center', marginBottom: 8 },
  teamCarouselPts: {
    paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8,
  },
  teamCarouselPtsText: { fontSize: 11, fontWeight: '800' },

  matchCompact: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
  },
  matchCompName: { fontSize: 11, fontWeight: '600', marginBottom: 6 },
  matchTeams: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  matchTeam: { fontSize: 13, fontWeight: '600', flex: 1 },
  matchScoreBox: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4, marginHorizontal: 8 },
  matchScore: { fontSize: 14, fontWeight: '800' },
  matchDate: { fontSize: 11, marginTop: 4 },

  newsCard: {
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    marginBottom: 8,
    gap: 12,
  },
  newsImage: { width: 72, height: 72, borderRadius: 8 },
  newsImagePlaceholder: {
    width: 72, height: 72, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  newsInfo: { flex: 1, justifyContent: 'center' },
  newsTitle: { fontSize: 13, fontWeight: '700', marginBottom: 4 },
  newsDate: { fontSize: 11 },
});
