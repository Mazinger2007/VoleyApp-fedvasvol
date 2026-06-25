import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useTheme, ACCENT_COLORS } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useFavorites } from '../../contexts/FavoritesContext';
import DragReorderSection from '../../components/DragReorderSection';
import AuthModal from '../../components/AuthModal';
import ContactModal from '../../components/ContactModal';
import StatusModal from '../../components/StatusModal';

const TOGGLE_WIDTH = 51;
const TOGGLE_HEIGHT = 31;
const THUMB_SIZE = 27;

function AnimatedToggle({ value, onValueChange, activeColor, inactiveColor, trackActive, trackInactive }) {
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: value ? 1 : 0,
      useNativeDriver: false,
      friction: 6,
      tension: 60,
    }).start();
  }, [value, anim]);

  const translateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [2, TOGGLE_WIDTH - THUMB_SIZE - 2],
  });

  const bgColor = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => onValueChange(!value)}
      style={styles.toggleContainer}
    >
      <Animated.View style={[
        styles.toggleTrack,
        {
          backgroundColor: bgColor.interpolate({
            inputRange: [0, 1],
            outputRange: [trackInactive, trackActive],
          }),
        },
      ]}>
        <Animated.View style={[
          styles.toggleThumb,
          {
            transform: [{ translateX }],
            backgroundColor: '#fff',
          },
        ]} />
      </Animated.View>
    </TouchableOpacity>
  );
}

const ACCENT_OPTIONS = Object.keys(ACCENT_COLORS).map((key) => ({
  key,
  color: ACCENT_COLORS[key].primary,
}));

const AVATAR_KEY = '@profile_avatar';
const NOTIFY_KEY = '@notifications_enabled';

export default function ProfileScreen({ navigation }) {
  const { colors, isDark, toggleTheme, accentKey, changeAccent } = useTheme();
  const { userProfile, isGuest, signOut } = useAuth();
  const { favorites, removeFavorite, reorderFavorites } = useFavorites();

  const [avatarUri, setAvatarUri] = useState(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [statusModal, setStatusModal] = useState({ visible: false });

  async function loadAvatar() {
    try {
      const uri = await AsyncStorage.getItem(AVATAR_KEY);
      if (uri) setAvatarUri(uri);
    } catch {}
  }

  async function loadNotificationPref() {
    try {
      const val = await AsyncStorage.getItem(NOTIFY_KEY);
      if (val !== null) setNotificationsEnabled(val === 'true');
    } catch {}
  }

  useEffect(() => {
    async function init() {
      await loadAvatar();
      await loadNotificationPref();
    }
    init();
  }, []);

  const pickAvatar = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        const uri = result.assets[0].uri;
        setAvatarUri(uri);
        await AsyncStorage.setItem(AVATAR_KEY, uri);
      }
    } catch (e) {
      console.warn('[Profile] Image picker error:', e);
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    try { await signOut(); } catch {}
  }, [signOut]);

  const toggleNotifications = useCallback(async (val) => {
    setNotificationsEnabled(val);
    await AsyncStorage.setItem(NOTIFY_KEY, String(val));
  }, []);

  const [scrollEnabled, setScrollEnabled] = useState(true);

  const favLeagues = useMemo(() => favorites.filter(f => f.entityType === 'league' || f.entityType === 'competition'), [favorites]);
  const favTeams = useMemo(() => favorites.filter(f => f.entityType === 'team'), [favorites]);

  const renderFavRow = useCallback((fav, i, listLen, isDragging) => {
    const isTeam = fav.entityType === 'team';
    const iconName = isTeam ? 'shield' : 'sports-volleyball';
    return (
      <View style={[styles.favRow, i < listLen - 1 && { borderBottomWidth: 1, borderBottomColor: colors.divider }]}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={[styles.favIconWrap, { backgroundColor: isTeam ? colors.primaryAlpha15 : colors.primaryAlpha10 }]}>
            <MaterialIcons name={iconName} size={16} color={colors.primary} />
          </View>
          <View style={styles.favInfo}>
            <Text style={[styles.favName, { color: colors.textPrimary }]} numberOfLines={1}>
              {fav.entityName}
            </Text>
            <Text style={[styles.favType, { color: colors.textMuted }]}>
              {isTeam ? 'Equipo' : fav.entityType === 'league' ? 'Liga' : fav.entityType}
            </Text>
          </View>
        </View>
        <View
          onStartShouldSetResponderCapture={() => true}
          onStartShouldSetResponder={() => true}
          onResponderRelease={() => removeFavorite(fav.entityType, fav.entityId)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <MaterialIcons name="favorite" size={18} color={colors.error} />
        </View>
      </View>
    );
  }, [colors, removeFavorite]);

  const displayName = userProfile?.username || (isGuest ? 'Invitado' : userProfile?.email || 'Usuario');
  const emailText = userProfile?.email || '';
  const favCount = favorites.length;
  const teamFavs = favorites.filter(f => f.entityType === 'team').length;
  const leagueFavs = favorites.filter(f => f.entityType === 'league' || f.entityType === 'competition').length;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView scrollEnabled={scrollEnabled} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Hero Section */}
        <View style={[styles.hero, { backgroundColor: colors.primary }]}>
          <View style={styles.heroBgCircle} />
          <TouchableOpacity onPress={pickAvatar} activeOpacity={0.85} style={styles.heroAvatarWrap}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.heroAvatar} />
            ) : (
              <View style={styles.heroAvatarPlaceholder}>
                <MaterialIcons name="person" size={44} color={colors.primary} />
              </View>
            )}
            <View style={styles.heroAvatarBadge}>
              <MaterialIcons name="camera-alt" size={12} color="#fff" />
            </View>
          </TouchableOpacity>
          <Text style={styles.heroName}>{displayName}</Text>
          {emailText ? <Text style={styles.heroEmail}>{emailText}</Text> : null}
          {userProfile?.role ? (
            <View style={styles.heroRoleBadge}>
              <Text style={styles.heroRoleText}>{userProfile.role}</Text>
            </View>
          ) : null}
        </View>

        {/* Stats Bar */}
        <View style={[styles.statsBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: colors.primary }]}>{favCount}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Favoritos</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.divider }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: colors.primary }]}>{teamFavs}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Equipos</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.divider }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: colors.primary }]}>{leagueFavs}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Ligas</Text>
          </View>
        </View>

        {/* Apariencia */}
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Apariencia</Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: colors.primaryAlpha15 }]}>
                <MaterialIcons name="dark-mode" size={18} color={colors.primary} />
              </View>
              <Text style={[styles.settingText, { color: colors.textPrimary }]}>Modo oscuro</Text>
            </View>
            <AnimatedToggle
              value={isDark}
              onValueChange={toggleTheme}
              activeColor={colors.primary}
              inactiveColor={colors.surfaceAlt}
              trackActive={colors.primary}
              trackInactive={colors.surfaceAlt}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.divider }]} />

          <View style={styles.settingCol}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: colors.primaryAlpha15 }]}>
                <MaterialIcons name="palette" size={18} color={colors.primary} />
              </View>
              <Text style={[styles.settingText, { color: colors.textPrimary }]}>Color de acento</Text>
            </View>
            <View style={styles.accentRow}>
              {ACCENT_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.key}
                  style={[
                    styles.accentDot,
                    { backgroundColor: opt.color },
                    accentKey === opt.key && styles.accentDotActive,
                  ]}
                  onPress={() => changeAccent(opt.key)}
                  activeOpacity={0.7}
                />
              ))}
            </View>
          </View>
        </View>

        {/* Notificaciones */}
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Notificaciones</Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: colors.primaryAlpha15 }]}>
                <MaterialIcons name="notifications" size={18} color={colors.primary} />
              </View>
              <Text style={[styles.settingText, { color: colors.textPrimary }]}>Noticias</Text>
            </View>
            <AnimatedToggle
              value={notificationsEnabled}
              onValueChange={toggleNotifications}
              activeColor={colors.primary}
              inactiveColor={colors.surfaceAlt}
              trackActive={colors.primary}
              trackInactive={colors.surfaceAlt}
            />
          </View>
        </View>

        {/* Favoritos */}
        {favorites.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Favoritos</Text>

            {/* ── Ligas ── */}
            {favLeagues.length > 0 && (
              <View style={{ marginBottom: 16 }}>
                <Text style={[styles.sectionHeader, { color: colors.textMuted }]}>LIGAS ({favLeagues.length})</Text>
                <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <DragReorderSection
                    items={favLeagues}
                    renderItem={(fav, i, listLen, isDragging) => renderFavRow(fav, i, listLen, isDragging)}
                    onReorder={(from, to) => {
                      const fromFav = favLeagues[from];
                      const toFav = favLeagues[to];
                      if (fromFav && toFav) {
                        const gFrom = favorites.indexOf(fromFav);
                        const gTo = favorites.indexOf(toFav);
                        if (gFrom >= 0 && gTo >= 0) reorderFavorites(gFrom, gTo);
                      }
                    }}
                    keyExtractor={(fav) => `${fav.entityType}-${fav.entityId}`}
                    onDragStateChange={(canScroll) => setScrollEnabled(canScroll)}
                    onItemPress={(fav) => {
                      if (fav.entityType === 'team') {
                        navigation.navigate('TeamDetail', { teamName: fav.entityName, teamUrl: fav.entityId });
                      } else if (fav.entityType === 'league' || fav.entityType === 'competition') {
                        navigation.navigate('League', { url: fav.entityId, title: fav.entityName });
                      }
                    }}
                  />
                </View>
              </View>
            )}

            {/* ── Equipos ── */}
            {favTeams.length > 0 && (
              <View style={{ marginBottom: 16 }}>
                <Text style={[styles.sectionHeader, { color: colors.textMuted }]}>EQUIPOS ({favTeams.length})</Text>
                <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <DragReorderSection
                    items={favTeams}
                    renderItem={(fav, i, listLen, isDragging) => renderFavRow(fav, i, listLen, isDragging)}
                    onReorder={(from, to) => {
                      const fromFav = favTeams[from];
                      const toFav = favTeams[to];
                      if (fromFav && toFav) {
                        const gFrom = favorites.indexOf(fromFav);
                        const gTo = favorites.indexOf(toFav);
                        if (gFrom >= 0 && gTo >= 0) reorderFavorites(gFrom, gTo);
                      }
                    }}
                    keyExtractor={(fav) => `${fav.entityType}-${fav.entityId}`}
                    onDragStateChange={(canScroll) => setScrollEnabled(canScroll)}
                    onItemPress={(fav) => {
                      if (fav.entityType === 'team') {
                        navigation.navigate('TeamDetail', { teamName: fav.entityName, teamUrl: fav.entityId });
                      } else if (fav.entityType === 'league' || fav.entityType === 'competition') {
                        navigation.navigate('League', { url: fav.entityId, title: fav.entityName });
                      }
                    }}
                  />
                </View>
              </View>
            )}
          </>
        )}

        {/* General */}
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>General</Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => setShowContactModal(true)}
            activeOpacity={0.7}
          >
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: colors.primaryAlpha15 }]}>
                <MaterialIcons name="mail-outline" size={18} color={colors.primary} />
              </View>
              <Text style={[styles.settingText, { color: colors.textPrimary }]}>Contacto y soporte</Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={colors.textMuted} />
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: colors.divider }]} />

          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => navigation.navigate('AppInfo')}
            activeOpacity={0.7}
          >
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: colors.primaryAlpha15 }]}>
                <MaterialIcons name="info-outline" size={18} color={colors.primary} />
              </View>
              <Text style={[styles.settingText, { color: colors.textPrimary }]}>Sobre la app</Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Auth Button */}
        <View style={styles.authSection}>
          {isGuest ? (
            <TouchableOpacity
              style={[styles.authButton, { backgroundColor: colors.primary }]}
              onPress={() => setShowAuthModal(true)}
              activeOpacity={0.85}
            >
              <MaterialIcons name="login" size={20} color="#fff" />
              <Text style={styles.authButtonText}>Iniciar sesión</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.authButton, { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.error }]}
              onPress={handleSignOut}
              activeOpacity={0.85}
            >
              <MaterialIcons name="logout" size={20} color={colors.error} />
              <Text style={[styles.authButtonText, { color: colors.error }]}>Cerrar sesión</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>

      <AuthModal visible={showAuthModal} onClose={() => setShowAuthModal(false)} />
      <ContactModal
        visible={showContactModal}
        onClose={() => setShowContactModal(false)}
        onComplete={(result) => setStatusModal(result)}
      />
      <StatusModal
        visible={statusModal.visible}
        title={statusModal.title}
        message={statusModal.message}
        type={statusModal.type}
        onClose={() => setStatusModal({ visible: false })}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: 30 },

  toggleContainer: {
    width: TOGGLE_WIDTH,
    height: TOGGLE_HEIGHT,
    justifyContent: 'center',
  },
  toggleTrack: {
    width: TOGGLE_WIDTH,
    height: TOGGLE_HEIGHT,
    borderRadius: TOGGLE_HEIGHT / 2,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleThumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },

  hero: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 28,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
  },
  heroBgCircle: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(255,255,255,0.08)',
    top: -80,
    right: -60,
  },
  heroAvatarWrap: { position: 'relative', marginBottom: 14 },
  heroAvatar: { width: 88, height: 88, borderRadius: 44, borderWidth: 3, borderColor: 'rgba(255,255,255,0.3)' },
  heroAvatarPlaceholder: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center', justifyContent: 'center',
  },
  heroAvatarBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)',
  },
  heroName: { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 2 },
  heroEmail: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginBottom: 8 },
  heroRoleBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12, paddingVertical: 3, borderRadius: 10,
  },
  heroRoleText: { fontSize: 11, fontWeight: '700', color: '#fff', textTransform: 'uppercase', letterSpacing: 0.5 },

  statsBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: -16,
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 24,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statNumber: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', marginTop: 2 },
  statDivider: { width: 1 },

  sectionLabel: {
    fontSize: 11, fontWeight: '700', textTransform: 'uppercase',
    letterSpacing: 0.8, marginBottom: 8, marginLeft: 20,
  },
  card: { borderRadius: 14, borderWidth: 1, marginHorizontal: 16, marginBottom: 20, overflow: 'hidden' },

  settingRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 12,
  },
  settingLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  settingIcon: {
    width: 32, height: 32, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  settingText: { fontSize: 14, fontWeight: '500' },

  settingCol: { paddingHorizontal: 14, paddingVertical: 12 },
  accentRow: { flexDirection: 'row', gap: 8, marginTop: 10, marginLeft: 44 },
  accentDot: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: 'transparent' },
  accentDotActive: {
    borderColor: '#fff', shadowColor: '#000', shadowOpacity: 0.3,
    shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 4,
  },

  divider: { height: 1 },

  sectionHeader: {
    fontSize: 10, fontWeight: '700', textTransform: 'uppercase',
    letterSpacing: 1, marginBottom: 6, paddingHorizontal: 4,
    textAlign: 'center',
  },

  favRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  favIconWrap: {
    width: 32, height: 32, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  favInfo: { flex: 1 },
  favName: { fontSize: 14, fontWeight: '600' },
  favType: { fontSize: 11, textTransform: 'capitalize', marginTop: 1 },
  favMore: { alignItems: 'center', paddingVertical: 8 },
  favMoreText: { fontSize: 12, fontWeight: '600' },

  authSection: { marginTop: 8, marginHorizontal: 16 },
  authButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderRadius: 14, paddingVertical: 15, gap: 8,
  },
  authButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
