import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_KEY = '@ranking_cache';
let memoryCache = {};

export async function loadRankingCache() {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (raw) {
      memoryCache = JSON.parse(raw);
    }
  } catch (e) {
    console.warn('[RankingCache] load error:', e.message);
  }
  return memoryCache;
}

export function getCachedStandings(leagueId) {
  const entry = memoryCache[leagueId];
  return entry?.standings ?? undefined;
}

export function getAllCachedStandings() {
  return { ...memoryCache };
}

export async function saveLeagueStandings(leagueId, standings) {
  memoryCache[leagueId] = { standings, updatedAt: Date.now() };
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(memoryCache));
  } catch (e) {
    console.warn('[RankingCache] save error:', e.message);
  }
}

export async function removeLeagueStandings(leagueId) {
  delete memoryCache[leagueId];
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(memoryCache));
  } catch (e) {
    console.warn('[RankingCache] remove error:', e.message);
  }
}
