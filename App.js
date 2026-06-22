// App.js
// Punto de entrada de la app.
// Configura React Navigation con NavigationContainer.
// La navegación principal usa un pager deslizable y una barra inferior fija.

import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, Animated, Platform, TouchableOpacity, AppState } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as NavigationBar from 'expo-navigation-bar';
import { MaterialIcons, MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import * as ScreenOrientation from 'expo-screen-orientation';
import PagerView from './src/components/PagerViewWrapper';

// ── Pantallas ────────────────────────────────────────────────────────────────
import MatchesScreen from './src/screens/MatchesScreen';
import BeachScreen from './src/screens/BeachScreen';
import NewsScreen from './src/screens/NewsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import LeagueScreen from './src/screens/LeagueScreen';
import TournamentScreen from './src/screens/TournamentScreen';
import TeamDetailScreen from './src/screens/TeamDetailScreen';
import RankingTableScreen from './src/screens/RankingTableScreen';
import JornadaDetailScreen from './src/screens/JornadaDetailScreen';
import MatchDetailScreen from './src/screens/MatchDetailScreen';
import PostDetailScreen from './src/screens/PostDetailScreen';
import BeachResultScreen from './src/screens/BeachResultScreen';
import BeachListScreen from './src/screens/BeachListScreen';
import BeachMatchDetailScreen from './src/screens/BeachMatchDetailScreen';
import BeachPairScreen from './src/screens/BeachPairScreen';
import InfoScreen from './src/screens/InfoScreen';
import LoadingView from './src/components/LoadingView';

// ── Tema ─────────────────────────────────────────────────────────────────────
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';
import { hydrateLogoColorCache as hydrateLogoColors } from './src/utils/logoColorCache';
import { initTeamsData } from './src/constants/teamColors';
import { checkForNewNews } from './src/services/newsNotificationService';
import NotificationBanner from './src/components/NotificationBanner';

// load time, before any React tree renders. This means getCachedLogoColorSync
// will return instant results for already-seen URLs.

const Stack = createNativeStackNavigator();

const TAB_ITEMS = [
  { key: 'Matches', title: 'LIGAS', icon: 'emoji-events', component: MatchesScreen },
  { key: 'Beach', title: 'VOLEY PLAYA', icon: 'beach-access', component: BeachScreen },
  { key: 'News', title: 'NOTICIAS', icon: 'newspaper', component: NewsScreen },
  { key: 'Settings', title: 'AJUSTES', icon: 'settings', component: SettingsScreen },
];

// ─── Tab icon component ───────────────────────────────────────────────────────
function TabIcon({ iconName, focused, colors }) {
  const iconColor = focused ? colors.primary : colors.textMuted;

  return (
    <View style={iconStyles.wrap}>
      <MaterialIcons
        name={iconName || 'circle'}
        size={Platform.OS === 'web' ? 24 : 25}
        color={iconColor}
      />
    </View>
  );
}

const iconStyles = StyleSheet.create({
  wrap: {
    width: 44,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
});

function MainTabs({ navigation }) {
  const { colors: Colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const isMobile = Platform.OS !== 'web';
  const pagerRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const tabBarHeight = isMobile ? 62 : 56;

  const goToTab = (index) => {
    if (index < 0 || index >= TAB_ITEMS.length) return;
    pagerRef.current?.setPage?.(index);
  };

  return (
    <View style={{ flex: 1 }}>
      <PagerView
        ref={pagerRef}
        style={{ flex: 1 }}
        initialPage={0}
        onPageSelected={(event) => setActiveIndex(event.nativeEvent.position)}
      >
        {TAB_ITEMS.map((tab) => {
          const ScreenComponent = tab.component;
          return (
            <View key={tab.key} style={{ flex: 1, paddingBottom: tabBarHeight + insets.bottom }}>
              <ScreenComponent navigation={navigation} />
            </View>
          );
        })}
      </PagerView>

      <View
        style={[
          styles.tabBar,
          {
            backgroundColor: isDark ? 'rgba(15,25,35,0.98)' : 'rgba(255,255,255,0.98)',
            borderTopColor: Colors.border,
            height: tabBarHeight + insets.bottom,
            paddingBottom: Math.max(insets.bottom, isMobile ? 6 : 4),
          },
        ]}
      >
        {TAB_ITEMS.map((tab, index) => {
          const focused = index === activeIndex;
          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => goToTab(index)}
              activeOpacity={0.8}
              style={styles.tabButton}
            >
              <TabIcon iconName={tab.icon} focused={focused} colors={Colors} />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    ...MaterialIcons.font,
    ...MaterialCommunityIcons.font,
    ...Ionicons.font,
  });

  useEffect(() => {
    async function prepare() {
      try {
        // Kick off AsyncStorage → memory hydration of logo colors
        hydrateLogoColors();
        initTeamsData();

        // Inicializar y bloquear la orientación vertical por defecto
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      } catch (e) {
        console.warn('Initialization Error:', e);
      }
    }

    prepare();
  }, []);

  return (
    <ThemeProvider>
      <AppContent fontsLoaded={fontsLoaded} />
    </ThemeProvider>
  );
}

function AppContent({ fontsLoaded }) {
  const { colors: Colors, isDark, animColors, isAppReady } = useTheme();
  const safeBgColor = animColors?.background || Colors.background;
  const isUiReady = isAppReady && fontsLoaded;
  const appStartRef = useRef(Date.now());
  const [showLoader, setShowLoader] = useState(true);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (Platform.OS === 'android') {
      NavigationBar.setStyle(isDark ? 'light' : 'dark');
    }
  }, [isDark]);

  // Keep global loader visible for at least 600ms to avoid flash of empty content
  useEffect(() => {
    if (isUiReady) {
      const elapsed = Date.now() - appStartRef.current;
      const delay = Math.max(0, 600 - elapsed);
      const timer = setTimeout(() => setShowLoader(false), delay);
      return () => clearTimeout(timer);
    }
  }, [isUiReady]);

  // Fade navigator in smoothly instead of snapping
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: isUiReady ? 1 : 0,
      duration: 350,
      useNativeDriver: true,
    }).start();
  }, [isUiReady, fadeAnim]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        checkForNewNews();
      }
    });

    return () => sub.remove();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor={Colors.background} />
      {/* Animated background layer — transitions smoothly on theme change */}
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: safeBgColor }]} pointerEvents="none" />

      <View style={{ flex: 1 }}>
        <NavigationContainer
          theme={{
            dark: isDark,
            colors: {
              primary: Colors.primary,
              background: 'transparent',
              card: Colors.surface,
              text: Colors.textPrimary,
              border: Colors.border,
              notification: Colors.primary,
            },
          }}
        >
          {/* We keep the navigator ALWAYS rendered so it can mount children (data fetching)
              but we fade it in smoothly once everything is ready. */}
          <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
            <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
              <Stack.Screen name="MainTabs" component={MainTabs} />
              <Stack.Screen name="League" component={LeagueScreen} />
              <Stack.Screen name="Tournament" component={TournamentScreen} />
              <Stack.Screen name="TeamDetail" component={TeamDetailScreen} />
              <Stack.Screen name="RankingTable" component={RankingTableScreen} />
              <Stack.Screen name="JornadaDetail" component={JornadaDetailScreen} />
              <Stack.Screen name="MatchDetail" component={MatchDetailScreen} />
              <Stack.Screen name="Info" component={InfoScreen} />
              <Stack.Screen name="PostDetail" component={PostDetailScreen} />
              <Stack.Screen name="BeachResult" component={BeachResultScreen} />
              <Stack.Screen name="BeachList" component={BeachListScreen} />
              <Stack.Screen name="BeachMatchDetail" component={BeachMatchDetailScreen} />
              <Stack.Screen name="BeachPair" component={BeachPairScreen} />
            </Stack.Navigator>
          </Animated.View>
        </NavigationContainer>

        {/* Notification Banner */}
        <NotificationBanner />

        {/* Global Full-Screen Loader */}
        {showLoader && (
          <View style={[StyleSheet.absoluteFill, { zIndex: 9999 }]}>
            <LoadingView message="Cargando ligas y torneos..." />
          </View>
        )}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    borderTopWidth: 1,
    elevation: 0,
  },
  tabButton: {
    flex: 1,
    paddingTop: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
