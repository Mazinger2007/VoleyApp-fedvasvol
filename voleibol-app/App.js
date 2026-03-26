// App.js
// Punto de entrada de la app.
// Configura React Navigation con NavigationContainer y Bottom Tabs.
// Cada pestaña corresponde a una pantalla principal.

import React, { useEffect } from 'react';
import { StyleSheet, Text, View, Platform, TouchableOpacity, Animated } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
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

// ── Tema ─────────────────────────────────────────────────────────────────────
import { Typography } from './src/styles/theme';
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';
import { hydrateLogoColorCache } from './src/utils/logoColorCache';

// Kick off AsyncStorage → memory hydration of logo colors immediately at module
// load time, before any React tree renders. This means getCachedLogoColorSync
// will return instant results for already-seen URLs.
hydrateLogoColorCache();

const Tab = createMaterialTopTabNavigator();
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
      <MaterialIcons name={iconByRoute[routeName] || 'circle'} size={24} color={iconColor} />
      {focused && <View style={[iconStyles.dot, { backgroundColor: colors.primary }]} />}
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
    marginBottom: 2,
  },
  dot: {
    position: 'absolute',
    bottom: -6,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
});

const TAB_LABELS = {
  Matches: 'LIGAS',
  Beach: 'VOLEY PLAYA',
  News: 'NOTICIAS',
  Settings: 'AJUSTES',
};

// COMPONENTE PERSONALIZADO PARA WEB
// Evita el bug de la librería material-top-tabs (react-native-tab-view) 
// que crashea al intentar usar interpolate() en campos undefined.
function CustomWebTabBar({ state, descriptors, navigation }) {
  const { colors: Colors } = useTheme();

  return (
    <View style={{
      flexDirection: 'row',
      backgroundColor: Colors.surface,
      borderTopColor: Colors.border,
      borderTopWidth: 1,
      height: 64,
      paddingBottom: 8,
      paddingTop: 8,
    }}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label = options.tabBarLabel !== undefined ? options.tabBarLabel : route.name;
        const isFocused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <TouchableOpacity
            key={route.key}
            onPress={onPress}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
            activeOpacity={0.7}
          >
            <TabIcon routeName={route.name} focused={isFocused} colors={Colors} />
            <Text style={{
              color: isFocused ? Colors.primary : Colors.textMuted,
              fontSize: 10,
              fontWeight: '500',
              marginTop: 4
            }}>
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function MainTabs() {
  const { colors: Colors, isDark } = useTheme();
  return (
    <Tab.Navigator
      tabBar={Platform.OS === 'web' ? (props) => <CustomWebTabBar {...props} /> : undefined}
      tabBarPosition="bottom"
      screenOptions={({ route }) => ({
        headerShown: false,
        swipeEnabled: Platform.OS !== 'web',
        animationEnabled: Platform.OS !== 'web',
        lazy: true,
        // The material-top-tabs library has a bug on web where it crashes trying to animate/interpolate
        // if certain props like icons or complex styles are present. We simplify for web.
        tabBarShowIcon: Platform.OS !== 'web',
        tabBarIcon: Platform.OS === 'web' ? undefined : ({ focused }) => (
          <TabIcon routeName={route.name} focused={focused} colors={Colors} />
        ),
        tabBarStyle: {
          backgroundColor: isDark ? 'rgba(15,25,35,0.95)' : 'rgba(255,255,255,0.95)',
          borderTopColor: Colors.border,
          borderTopWidth: 1,
          height: Platform.OS === 'web' ? 60 : 76,
          paddingBottom: Platform.OS === 'web' ? 0 : 24,
          paddingTop: Platform.OS === 'web' ? 0 : 8,
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          elevation: 0,
        },
        tabBarIndicatorStyle: {
          backgroundColor: Platform.OS === 'web' ? Colors.primary : 'transparent',
          height: Platform.OS === 'web' ? 2 : 0,
        },
        tabBarPressColor: 'transparent',
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
  useEffect(() => {
    // Inicializar y bloquear la orientación vertical por defecto para evitar errores de referencia
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP)
      .catch((error) => console.log('Orientation Lock Error:', error));
  }, []);

  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

function AppContent() {
  const { colors: Colors, isDark, animColors } = useTheme();
  return (
    <SafeAreaProvider>
      <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor={Colors.background} />
      {/* Animated background layer — transitions smoothly on theme change */}
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: animColors.background }]} pointerEvents="none" />
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
      </NavigationContainer>
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
    paddingTop: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
