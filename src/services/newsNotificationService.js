import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchAndParse, URLS } from '../utils/htmlParser';

const KEYS = {
  enabled: '@news_notifications_enabled',
  lastSeenUrl: '@news_last_seen_url',
};

const IS_STANDALONE =
  Constants.executionEnvironment === 'standalone' ||
  Constants.executionEnvironment === 'bare' ||
  Constants.appOwnership === 'standalone';

let bannerShowFn = null;
let Notifications = null;

function getNotifications() {
  if (!IS_STANDALONE) return null;
  if (!Notifications) {
    try {
      Notifications = require('expo-notifications');
    } catch {
      return null;
    }
  }
  return Notifications;
}

export function setBannerShowFn(fn) {
  bannerShowFn = fn;
}

export async function setupNotifications() {
  const mod = getNotifications();
  if (!mod) return true;

  try {
    mod.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    if (Platform.OS === 'android') {
      await mod.setNotificationChannelAsync('news', {
        name: 'Noticias',
        importance: mod.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 100],
      });
    }
    const { status } = await mod.requestPermissionsAsync();
    return status === 'granted';
  } catch (e) {
    console.log('[NewsNotification] Native notifications init failed, using banner');
    return true;
  }
}

export async function isEnabled() {
  const val = await AsyncStorage.getItem(KEYS.enabled);
  return val === 'true';
}

export async function setEnabled(enabled) {
  await AsyncStorage.setItem(KEYS.enabled, enabled ? 'true' : 'false');
}

async function getLastSeenUrl() {
  return AsyncStorage.getItem(KEYS.lastSeenUrl);
}

async function setLastSeenUrl(url) {
  await AsyncStorage.setItem(KEYS.lastSeenUrl, url);
}

async function fireNotification(title, body) {
  const mod = getNotifications();
  if (mod) {
    try {
      await mod.scheduleNotificationAsync({
        content: { title, body, data: {} },
        trigger: null,
      });
      return;
    } catch (e) {
      console.log('[NewsNotification] Native notification failed, falling back to banner');
    }
  }

  if (bannerShowFn) {
    bannerShowFn(title, body);
  }
}

export async function checkForNewNews() {
  try {
    const enabled = await isEnabled();
    if (!enabled) return;

    const blocks = await fetchAndParse(URLS.posts, {});
    const postsBlock = blocks.find(b => b.type === 'posts');
    if (!postsBlock || !postsBlock.posts || postsBlock.posts.length === 0) return;

    const latest = postsBlock.posts[0];
    const latestUrl = latest.href;

    const lastSeen = await getLastSeenUrl();
    if (latestUrl === lastSeen) return;

    await setLastSeenUrl(latestUrl);

    if (!lastSeen) return;

    await fireNotification(
      latest.title || 'Nueva noticia',
      'Toca para abrir la noticia completa'
    );
  } catch (e) {
    console.warn('[NewsNotification] Error checking for new news:', e);
  }
}
