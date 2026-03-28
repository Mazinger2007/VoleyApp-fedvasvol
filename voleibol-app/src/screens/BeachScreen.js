// src/screens/BeachScreen.js
// Pantalla de Voley Playa — solo mensaje próximamente.

import React, { useMemo } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, StatusBar, StyleSheet, View, TouchableOpacity } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { Colors } from '../styles/theme'; 


export default function BeachScreen({ navigation }) {
  const { colors: Colors, setIsAppReady } = useTheme();

  React.useEffect(() => {
    setIsAppReady(true);
  }, [setIsAppReady]);
  const styles = useMemo(() => StyleSheet.create({
    safe: { flex: 1, backgroundColor: Colors.background },
    header: {
      height: 64,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 8,
      backgroundColor: Colors.surface,
      borderBottomColor: Colors.border,
      borderBottomWidth: 1,
    },
    headerTitleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      justifyContent: 'center',
    },
    headerTitleText: { fontSize: 16, fontWeight: '900', letterSpacing: -0.5, color: Colors.primary },
    backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
    messageWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    message: { color: Colors.textPrimary, fontSize: 22, fontWeight: 'bold', textAlign: 'center', padding: 32 },
  }), [Colors]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitleText}>VOLEY PLAYA</Text>
        </View>
        <View style={styles.backBtn} />
      </View>
      <View style={styles.messageWrap}>
        <Text style={styles.message}>Próximamente</Text>
      </View>
    </SafeAreaView>
  );
}
