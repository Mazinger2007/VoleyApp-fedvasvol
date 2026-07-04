import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, View, Platform, AppState, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as NavigationBar from 'expo-navigation-bar';
import { MaterialIcons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync();

import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { FavoritesProvider } from './src/contexts/FavoritesContext';

import { hydrateLogoColorCache as hydrateLogoColors } from './src/utils/logoColorCache';
import { initTeamsData } from './src/constants/teamColors';

import { checkForNewNews } from './src/services/newsNotificationService';
import NotificationBanner from './src/components/NotificationBanner';
import { fetchAndParse, URLS } from './src/utils/htmlParser';
import { resultCache } from './src/hooks/useFetch';

import LoginScreen from './src/screens/auth/LoginScreen';
import RegisterScreen from './src/screens/auth/RegisterScreen';
import BlockedScreen from './src/screens/auth/BlockedScreen';
import HomeScreen from './src/screens/home/HomeScreen';
import MatchesScreen from './src/screens/matches/MatchesScreen';
import OldNewsScreen from './src/screens/news/NewsScreen';
import ProfileScreen from './src/screens/profile/ProfileScreen';

import LeagueScreen from './src/screens/leagues/LeagueScreen';
import LeagueDetailScreen from './src/screens/leagues/LeagueDetailScreen';
import TournamentScreen from './src/screens/leagues/TournamentScreen';
import TeamDetailScreen from './src/screens/leagues/TeamDetailScreen';
import RankingTableScreen from './src/screens/leagues/RankingTableScreen';
import JornadaDetailScreen from './src/screens/matches/JornadaDetailScreen';
import MatchDetailScreen from './src/screens/matches/MatchDetailScreen';
import PostDetailScreen from './src/screens/news/PostDetailScreen';
import BeachResultScreen from './src/screens/beach/BeachResultScreen';
import BeachScreen from './src/screens/beach/BeachScreen';
import BeachListScreen from './src/screens/beach/BeachListScreen';
import BeachMatchDetailScreen from './src/screens/beach/BeachMatchDetailScreen';
import BeachPairScreen from './src/screens/beach/BeachPairScreen';
import InfoScreen from './src/screens/leagues/InfoScreen';
import AppInfoScreen from './src/screens/profile/AppInfoScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function TabNavigator() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: isDark ? 'rgba(18,18,18,0.97)' : 'rgba(255,255,255,0.97)',
          borderTopColor: colors.border,
          borderTopWidth: 0.5,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: isDark ? 0.3 : 0.08,
          shadowRadius: 8,
          height: 62 + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: 8,
          paddingHorizontal: 4,
        },
        tabBarIconStyle: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
        },
        tabBarItemStyle: {
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 14,
          paddingVertical: 4,
          marginHorizontal: 2,
        },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ color, focused }) => (
            <View style={{
              alignItems: 'center', justifyContent: 'center',
              width: 52, height: 36, borderRadius: 12,
              backgroundColor: focused ? colors.primary + '18' : 'transparent',
            }}>
              <MaterialIcons name="home" size={26} color={color} />
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="ResultsTab"
        component={MatchesScreen}
        options={{
          tabBarIcon: ({ color, focused }) => (
            <View style={{
              alignItems: 'center', justifyContent: 'center',
              width: 52, height: 36, borderRadius: 12,
              backgroundColor: focused ? colors.primary + '18' : 'transparent',
            }}>
              <MaterialIcons name="emoji-events" size={26} color={color} />
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="BeachTab"
        component={BeachScreen}
        options={{
          tabBarIcon: ({ color, focused }) => (
            <View style={{
              alignItems: 'center', justifyContent: 'center',
              width: 52, height: 36, borderRadius: 12,
              backgroundColor: focused ? colors.primary + '18' : 'transparent',
            }}>
              <MaterialIcons name="beach-access" size={26} color={color} />
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="NewsTab"
        component={OldNewsScreen}
        options={{
          tabBarIcon: ({ color, focused }) => (
            <View style={{
              alignItems: 'center', justifyContent: 'center',
              width: 52, height: 36, borderRadius: 12,
              backgroundColor: focused ? colors.primary + '18' : 'transparent',
            }}>
              <MaterialIcons name="newspaper" size={26} color={color} />
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ color, focused }) => (
            <View style={{
              alignItems: 'center', justifyContent: 'center',
              width: 52, height: 36, borderRadius: 12,
              backgroundColor: focused ? colors.primary + '18' : 'transparent',
            }}>
              <MaterialIcons name="person" size={26} color={color} />
            </View>
          ),
        }}
      />
    </Tab.Navigator>
  );
}

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
    </Stack.Navigator>
  );
}

function MainStack() {
  const { colors, isDark } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: 'transparent' },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="Tabs" component={TabNavigator} />
      <Stack.Screen name="League" component={LeagueScreen} />
      <Stack.Screen name="LeagueDetail" component={LeagueDetailScreen} />
      <Stack.Screen name="Tournament" component={TournamentScreen} />
      <Stack.Screen name="TeamDetail" component={TeamDetailScreen} />
      <Stack.Screen name="RankingTable" component={RankingTableScreen} />
      <Stack.Screen name="JornadaDetail" component={JornadaDetailScreen} />
      <Stack.Screen name="MatchDetail" component={MatchDetailScreen} />
      <Stack.Screen name="Info" component={InfoScreen} />
      <Stack.Screen name="AppInfo" component={AppInfoScreen} />
      <Stack.Screen name="PostDetail" component={PostDetailScreen} />
      <Stack.Screen name="Beach" component={BeachScreen} />
      <Stack.Screen name="BeachResult" component={BeachResultScreen} />
      <Stack.Screen name="BeachList" component={BeachListScreen} />
      <Stack.Screen name="BeachMatchDetail" component={BeachMatchDetailScreen} />
      <Stack.Screen name="BeachPair" component={BeachPairScreen} />
    </Stack.Navigator>
  );
}

function RootNavigator() {
  const { user, isGuest, isBlocked, loading: authLoading } = useAuth();
  const { colors, isDark } = useTheme();

  if (authLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (isBlocked) {
    return (
      <NavigationContainer
        theme={{
          dark: isDark,
          colors: {
            primary: colors.primary,
            background: 'transparent',
            card: colors.surface,
            text: colors.textPrimary,
            border: colors.border,
            notification: colors.primary,
          },
        }}
      >
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Blocked" component={BlockedScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    );
  }

  return (
    <NavigationContainer
      theme={{
        dark: isDark,
        colors: {
          primary: colors.primary,
          background: 'transparent',
          card: colors.surface,
          text: colors.textPrimary,
          border: colors.border,
          notification: colors.primary,
        },
      }}
    >
      {user || isGuest ? <MainStack /> : <AuthStack />}
    </NavigationContainer>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    ...MaterialIcons.font,
  });
  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        hydrateLogoColors();
        initTeamsData();
        if (ScreenOrientation?.lockAsync) {
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
        }
      } catch (e) {
        console.warn('Initialization Error:', e);
      } finally {
        setAppReady(true);
      }
    }
    prepare();
  }, []);

  useEffect(() => {
    if (fontsLoaded && appReady) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, appReady]);

  if (!fontsLoaded || !appReady) return null;

  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

function AppContent() {
  const { colors, isDark } = useTheme();
  const prefetchedRef = useRef(false);

  useEffect(() => {
    if (Platform.OS === 'android') {
      NavigationBar.setStyle(isDark ? 'light' : 'dark');
    }
  }, [isDark]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        checkForNewNews();
      }
    });
    return () => sub.remove();
  }, []);

  // Prefetch data for all tabs into shared cache so transitions feel instant
  useEffect(() => {
    if (prefetchedRef.current) return;
    prefetchedRef.current = true;
    const urls = [URLS.home, URLS.beachVolleyball, URLS.posts];
    urls.forEach((url) => {
      if (!resultCache.has(url)) {
        fetchAndParse(url)
          .then((blocks) => { resultCache.set(url, blocks); })
          .catch(() => {});
      }
    });
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor={colors.background} />
      <AuthProvider>
        <FavoritesProvider>
          <RootNavigator />
        </FavoritesProvider>
      </AuthProvider>
      <NotificationBanner />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
