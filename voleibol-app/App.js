// App.js
// Punto de entrada de la app.
// Configura React Navigation con NavigationContainer y Bottom Tabs.
// Cada pestaña corresponde a una pantalla principal.

import React from 'react';
import { StyleSheet, Text, View, Platform, TouchableOpacity } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';

// ── Pantallas ────────────────────────────────────────────────────────────────
import MatchesScreen from './src/screens/MatchesScreen';
import CompetitionsScreen from './src/screens/CompetitionsScreen';
import TeamsScreen from './src/screens/TeamsScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import TournamentDetailScreen from './src/screens/TournamentDetailScreen';
import TeamDetailScreen from './src/screens/TeamDetailScreen';
import RankingTableScreen from './src/screens/RankingTableScreen';

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

  if (routeName === 'Matches') {
    return (
      <View style={[iconStyles.wrap, focused && { backgroundColor: colors.primaryAlpha15 }]}>
        <MaterialCommunityIcons name="volleyball" size={22} color={iconColor} />
      </View>
    );
  }

  const iconByRoute = {
    Competitions: 'emoji-events',
    Teams: 'groups',
    Profile: 'person',
  };

  return (
    <View style={[iconStyles.wrap, focused && { backgroundColor: colors.primaryAlpha15 }]}>
      <MaterialIcons name={iconByRoute[routeName] || 'circle'} size={22} color={iconColor} />
    </View>
  );
}

const iconStyles = StyleSheet.create({
  wrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

const TAB_LABELS = {
  Matches: 'Partidos',
  Competitions: 'Ligas',
  Teams: 'Equipos',
  Profile: 'Perfil',
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
  const { colors: Colors } = useTheme();
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
          backgroundColor: Colors.surface,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
          height: Platform.OS === 'web' ? 50 : 68,
          paddingBottom: Platform.OS === 'web' ? 0 : 10,
          paddingTop: Platform.OS === 'web' ? 0 : 6,
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
        name="Competitions"
        component={CompetitionsScreen}
        options={{ tabBarLabel: TAB_LABELS.Competitions }}
      />
      <Tab.Screen
        name="Teams"
        component={TeamsScreen}
        options={{ tabBarLabel: TAB_LABELS.Teams }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarLabel: TAB_LABELS.Profile }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

function AppContent() {
  const { colors: Colors, isDark } = useTheme();
  return (
    <SafeAreaProvider>
      <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor={Colors.background} />
      <NavigationContainer
        theme={{
          dark: isDark,
          colors: {
            primary: Colors.primary,
            background: Colors.background,
            card: Colors.surface,
            text: Colors.textPrimary,
            border: Colors.border,
            notification: Colors.primary,
          },
        }}
      >
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="MainTabs" component={MainTabs} />
          <Stack.Screen name="TournamentDetail" component={TournamentDetailScreen} />
          <Stack.Screen name="TeamDetail" component={TeamDetailScreen} />
          <Stack.Screen name="RankingTable" component={RankingTableScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  tabLabel: {
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.medium,
    marginTop: 2,
  },
  tabItem: {
    paddingTop: 4,
  },
});
