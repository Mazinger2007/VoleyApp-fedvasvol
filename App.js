// App.js
// Punto de entrada de la app.
// Configura React Navigation con NavigationContainer y Bottom Tabs.
// Cada pestaña corresponde a una pantalla principal.

import React, { useEffect } from 'react';
import { StyleSheet, View, Animated, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { MaterialIcons, MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import * as ScreenOrientation from 'expo-screen-orientation';

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
import InfoScreen from './src/screens/InfoScreen';
import LoadingView from './src/components/LoadingView';

// ── Tema ─────────────────────────────────────────────────────────────────────
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';
import { hydrateLogoColorCache as hydrateLogoColors } from './src/utils/logoColorCache';
import { initTeamsData } from './src/constants/teamColors';

// load time, before any React tree renders. This means getCachedLogoColorSync
// will return instant results for already-seen URLs.

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// ─── Tab icon component ───────────────────────────────────────────────────────
function TabIcon({ routeName, focused, colors }) {
  const iconColor = focused ? colors.primary : colors.textMuted;

  const iconByRoute = {
    Matches: 'emoji-events',
    Beach: 'beach-access',
    News: 'newspaper',
    Settings: 'settings',
  };

  return (
    <View style={iconStyles.wrap}>
      <MaterialIcons
        name={iconByRoute[routeName] || 'circle'}
        size={Platform.OS === 'web' ? 24 : 25}
        color={iconColor}
      />
    </View>
  );
}

const iconStyles = StyleSheet.create({
  wrap: {
    width: 48,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
});

const TAB_LABELS = {
  Matches: 'LIGAS',
  Beach: 'VOLEY PLAYA',
  News: 'NOTICIAS',
  Settings: 'AJUSTES',
};

function MainTabs() {
  const { colors: Colors, isDark } = useTheme();
  const isMobile = Platform.OS !== 'web';

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        lazy: true,
        tabBarShowIcon: true,
        tabBarShowLabel: !isMobile,
        tabBarHideOnKeyboard: true,
        tabBarIcon: ({ focused }) => (
          <TabIcon routeName={route.name} focused={focused} colors={Colors} />
        ),
        tabBarStyle: {
          backgroundColor: isDark ? 'rgba(15,25,35,0.95)' : 'rgba(255,255,255,0.95)',
          borderTopColor: Colors.border,
          borderTopWidth: 1,
          height: isMobile ? 85 : 72,
          paddingBottom: isMobile ? 30 : 10,
          paddingTop: isMobile ? 12 : 8,
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          elevation: 0,
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabelStyle: styles.tabLabel,
        tabBarItemStyle: styles.tabItem,
      })}
    >
      <Tab.Screen
        name="Matches"
        component={MatchesScreen}
        options={{ tabBarLabel: TAB_LABELS.Matches }}
      />
      <Tab.Screen
        name="Beach"
        component={BeachScreen}
        options={{ tabBarLabel: TAB_LABELS.Beach }}
      />
      <Tab.Screen
        name="News"
        component={NewsScreen}
        options={{ tabBarLabel: TAB_LABELS.News }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ tabBarLabel: TAB_LABELS.Settings }}
      />
    </Tab.Navigator>
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
              but we hide it until everything is ready to avoid jumping/partial rendering. */}
          <View style={{ flex: 1, opacity: isUiReady ? 1 : 0 }}>
            <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
              <Stack.Screen name="MainTabs" component={MainTabs} />
              <Stack.Screen name="League" component={LeagueScreen} />
              <Stack.Screen name="Tournament" component={TournamentScreen} />
              <Stack.Screen name="TeamDetail" component={TeamDetailScreen} />
              <Stack.Screen name="RankingTable" component={RankingTableScreen} />
              <Stack.Screen name="JornadaDetail" component={JornadaDetailScreen} />
              <Stack.Screen name="MatchDetail" component={MatchDetailScreen} />
              <Stack.Screen name="Info" component={InfoScreen} />
            </Stack.Navigator>
          </View>
        </NavigationContainer>

        {/* Global Full-Screen Loader */}
        {!isUiReady && (
          <View style={[StyleSheet.absoluteFill, { zIndex: 9999 }]}>
            <LoadingView message="Cargando ligas y torneos..." />
          </View>
        )}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  tabLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 6,
    textTransform: 'uppercase',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  tabItem: {
    flex: 1,
    paddingTop: 6,
    padding: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
