// src/screens/ProfileScreen.js
// Pantalla de Perfil — nueva UI basada en el mockup de la comunidad.

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, StatusBar, Switch, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Spacing, Typography, Radius } from '../styles/theme';
import { useTheme, ACCENT_COLORS } from '../contexts/ThemeContext';

export default function ProfileScreen() {
  const { colors: Colors, isDark, toggleTheme, accentKey, changeAccent } = useTheme();

  const styles = useMemo(() => StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: Colors.background,
    },
    headerBar: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: Colors.border,
      backgroundColor: Colors.surface,
      alignItems: 'center',
    },
    headerTitle: {
      color: Colors.textPrimary,
      fontSize: Typography.size.lg,
      fontWeight: Typography.weight.bold,
    },
    scrollContent: {
      padding: Spacing.lg,
      paddingBottom: 100,
      gap: Spacing.xxl,
    },
    section: {
      gap: Spacing.sm,
    },
    sectionTitle: {
      fontSize: Typography.size.sm,
      fontWeight: Typography.weight.semiBold,
      color: Colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      paddingHorizontal: 4,
    },
    card: {
      backgroundColor: Colors.surface,
      borderRadius: Radius.xl,
      borderWidth: 1,
      borderColor: Colors.border,
      overflow: 'hidden',
    },
    cardPadding: {
      padding: Spacing.lg,
    },
    divider: {
      height: 1,
      backgroundColor: Colors.border,
    },
    settingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    settingLabelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    settingLabel: {
      fontSize: Typography.size.sm,
      fontWeight: Typography.weight.medium,
      color: Colors.textPrimary,
    },
    colorsWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.md,
      marginTop: Spacing.md,
    },
    colorBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      justifyContent: 'center',
      alignItems: 'center',
    },
    colorBtnActive: {
      borderWidth: 2,
    },
    textBody: {
      fontSize: Typography.size.sm,
      color: Colors.textSecondary,
      lineHeight: 20,
    },
    infoBox: {
      flexDirection: 'row',
      backgroundColor: isDark ? 'rgba(30,41,59,0.5)' : '#f8fafc',
      padding: Spacing.md,
      borderRadius: Radius.lg,
      marginTop: Spacing.md,
      gap: Spacing.md,
    },
    infoText: {
      flex: 1,
      fontSize: Typography.size.xs,
      color: Colors.textMuted,
      lineHeight: 18,
    },
    legalBlock: {
      marginTop: Spacing.sm,
      gap: 4,
    },
    legalTitle: {
      fontSize: Typography.size.xs,
      fontWeight: Typography.weight.semiBold,
      color: Colors.textMuted,
      textTransform: 'uppercase',
    },
    footerText: {
      textAlign: 'center',
      fontSize: Typography.size.xs,
      color: Colors.textMuted,
      marginTop: Spacing.xl,
    }
  }), [Colors, isDark]);

  const COLOR_OPTIONS = ['navy', 'blue', 'red', 'emerald', 'amber', 'purple'];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={Colors.surface} />

      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>Ajustes</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Personalización */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personalización</Text>
          <View style={styles.card}>
            <View style={styles.cardPadding}>
              <Text style={styles.settingLabel}>Color de acento</Text>
              <View style={styles.colorsWrap}>
                {COLOR_OPTIONS.map((c) => {
                  const isActive = accentKey === c;
                  const hex = ACCENT_COLORS[c].primary;
                  return (
                    <TouchableOpacity
                      key={c}
                      activeOpacity={0.8}
                      onPress={() => changeAccent(c)}
                      style={[
                        styles.colorBtn,
                        { backgroundColor: hex },
                        isActive && styles.colorBtnActive,
                        isActive && { borderColor: Colors.surface, shadowColor: hex, shadowOpacity: 0.5, shadowRadius: 4, elevation: 4 }
                      ]}
                    >
                      {isActive && <View style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: hex, position: 'absolute' }} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
            <View style={styles.divider} />
            <View style={[styles.cardPadding, styles.settingRow]}>
              <View style={styles.settingLabelRow}>
                <MaterialIcons name="dark-mode" size={20} color={Colors.textMuted} />
                <Text style={styles.settingLabel}>Modo Oscuro</Text>
              </View>
              <Switch
                value={isDark}
                onValueChange={toggleTheme}
                trackColor={{ false: '#e2e8f0', true: Colors.primary }}
                thumbColor="#ffffff"
              />
            </View>
          </View>
        </View>

        {/* Sobre la App */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sobre la App</Text>
          <View style={[styles.card, styles.cardPadding]}>
            <Text style={styles.textBody}>
              Esta aplicación es un aporte independiente para mejorar la experiencia de la comunidad del voleibol vasco.
            </Text>
            <View style={styles.infoBox}>
              <MaterialIcons name="storage" size={20} color={Colors.primary} />
              <Text style={styles.infoText}>
                Los datos mostrados se obtienen mediante la extracción y procesamiento del código HTML de la web oficial.
              </Text>
            </View>
          </View>
        </View>

        {/* Legal */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Legal y Propiedad Intelectual</Text>
          <View style={[styles.card, styles.cardPadding]}>
            <View style={styles.legalBlock}>
              <Text style={styles.legalTitle}>Propiedad</Text>
              <Text style={styles.textBody}>
                Todos los datos, logotipos, nombres de equipos y clasificaciones son propiedad intelectual exclusiva de la <Text style={{fontWeight: 'bold'}}>Federación Vasca de Voleibol (fedvasvol.com)</Text> y sus respectivos propietarios.
              </Text>
            </View>
            <View style={[styles.divider, { marginVertical: Spacing.md }]} />
            <View style={styles.legalBlock}>
              <Text style={styles.legalTitle}>Descargo de Responsabilidad</Text>
              <Text style={[styles.textBody, { fontStyle: 'italic' }]}>
                Esta aplicación no es oficial y no tiene afiliación comercial con la federación. Se exime de toda responsabilidad legal derivada del uso de la información mostrada.
              </Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <Text style={styles.footerText}>Voleibol Vasco App v1.2.0</Text>

      </ScrollView>
    </SafeAreaView>
  );
}
