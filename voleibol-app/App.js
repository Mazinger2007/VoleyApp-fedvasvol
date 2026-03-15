// App.js
// Punto de entrada de la app.
// Configura React Navigation con NavigationContainer y Bottom Tabs.
// Cada pestaña corresponde a una pantalla principal.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
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

function MainTabs() {
  const { colors: Colors } = useTheme();
  return (
    <Tab.Navigator
      tabBarPosition="bottom"
      screenOptions={({ route }) => ({
        headerShown: false,
        swipeEnabled: true,
        animationEnabled: true,
        lazy: true,
        tabBarShowIcon: true,
        tabBarIcon: ({ focused }) => (
          <TabIcon routeName={route.name} focused={focused} colors={Colors} />
        ),
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
          height: 68,
          paddingBottom: 10,
          paddingTop: 6,
        },
        tabBarIndicatorStyle: {
          backgroundColor: 'transparent',
          height: 0,
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
