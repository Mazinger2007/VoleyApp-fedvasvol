// src/screens/SettingsScreen.js
// Pantalla de Perfil — nueva UI basada en el mockup de la comunidad.

import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, StatusBar, ScrollView, TouchableOpacity, Platform, Animated } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Spacing, Typography, Radius } from '../styles/theme';
import { useTheme, ACCENT_COLORS } from '../contexts/ThemeContext';
import ConfirmationModal from '../components/ConfirmationModal';
import StatusModal from '../components/StatusModal';
import ContactModal from '../components/ContactModal';
import { DarkTheme } from '@react-navigation/native';
import { isEnabled as isNewsNotifyEnabled, setEnabled as setNewsNotifyEnabled, setupNotifications } from '../services/newsNotificationService';
import AnimatedSwitch from '../components/AnimatedSwitch';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { colors: Colors, isDark, toggleTheme, accentKey, changeAccent, animColors } = useTheme();

  const [showClearCacheModal, setShowClearCacheModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [statusModal, setStatusModal] = useState({ visible: false, title: '', message: '', type: 'info' });
  const [newsNotifications, setNewsNotifications] = useState(false);

  useEffect(() => {
    isNewsNotifyEnabled().then(setNewsNotifications);
  }, []);

  const toggleNewsNotifications = async (value) => {
    setNewsNotifications(value);
    await setNewsNotifyEnabled(value);
    if (value) {
      await setupNotifications();
    }
  };

  const handleClearCache = async () => {
    setShowClearCacheModal(true);
  };

  const executeClearCache = async () => {
    setShowClearCacheModal(false);
    try {
      await AsyncStorage.clear();
      setStatusModal({
        visible: true,
        title: '¡Todo listo!',
        message: 'La caché se ha vaciado correctamente.',
        type: 'success'
      });
    } catch (error) {
      setStatusModal({
        visible: true,
        title: 'Error',
        message: 'No se pudo vaciar la caché.',
        type: 'error'
      });
    }
  };

  const styles = useMemo(() => StyleSheet.create({
    safe: {
      flex: 1,
    },
    headerBar: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.md,
      borderBottomWidth: 0,
      alignItems: 'center',
      elevation: 4,
      shadowColor: Colors.primary,
      shadowOpacity: 0.08,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
    },
    headerTitle: {
      color: DarkTheme.colors.text,
      fontSize: Typography.size.lg,
      fontWeight: Typography.weight.bold,
      letterSpacing: 1,
      textShadowColor: 'rgba(0,0,0,0.04)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 1,
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
    <Animated.View style={[styles.safe, { backgroundColor: animColors.background, paddingTop: insets.top }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={Colors.surface} />

      <Animated.View style={[styles.headerBar, { backgroundColor: animColors.surface }]}>
        <Text style={[styles.headerTitle, { color: Colors.textPrimary }]}>Ajustes</Text>
      </Animated.View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Personalización */}
        <View style={styles.section}>
          <Animated.Text style={[styles.sectionTitle, { color: animColors.textMuted }]}>Personalización</Animated.Text>
          <Animated.View style={[styles.card, { backgroundColor: animColors.surface, borderColor: animColors.border }]}>
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
                        isActive && {
                          borderColor: Colors.surface,
                          elevation: 4,
                          ...(Platform.OS !== 'web' ? {
                            shadowColor: hex,
                            shadowOpacity: 0.5,
                            shadowRadius: 4,
                          } : {
                            boxShadow: `0 0 8px ${hex}80`
                          })
                        }
                      ]}
                    >
                      {isActive && <View style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: hex, position: 'absolute' }} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
            <View style={styles.divider} />
            <TouchableOpacity
              style={[styles.cardPadding, styles.settingRow]}
              onPress={toggleTheme}
              activeOpacity={0.7}
            >
              <View style={styles.settingLabelRow}>
                <MaterialIcons name="dark-mode" size={20} color={Colors.textMuted} />
                <Text style={styles.settingLabel}>Modo Oscuro</Text>
              </View>
              <AnimatedSwitch
                value={isDark}
                onValueChange={toggleTheme}
                trackColor={{ false: '#e2e8f0', true: Colors.primary }}
                thumbColor="#ffffff"
              />
            </TouchableOpacity>
          </Animated.View>
        </View>

        {/* Notificaciones */}
        <View style={styles.section}>
          <Animated.Text style={[styles.sectionTitle, { color: animColors.textMuted }]}>Notificaciones</Animated.Text>
          <Animated.View style={[styles.card, { backgroundColor: animColors.surface, borderColor: animColors.border }]}>
            <TouchableOpacity
              style={[styles.cardPadding, styles.settingRow]}
              onPress={() => toggleNewsNotifications(!newsNotifications)}
              activeOpacity={0.7}
            >
              <View style={styles.settingLabelRow}>
                <MaterialIcons name="notifications" size={20} color={Colors.primary} />
                <View>
                  <Text style={styles.settingLabel}>Nuevas noticias</Text>
                  <Text style={{ fontSize: 11, color: Colors.textMuted }}>Recibe un aviso cuando se publique una noticia</Text>
                </View>
              </View>
              <AnimatedSwitch
                value={newsNotifications}
                onValueChange={toggleNewsNotifications}
                trackColor={{ false: '#e2e8f0', true: Colors.primary }}
                thumbColor="#ffffff"
              />
            </TouchableOpacity>
          </Animated.View>
        </View>

        {/* Sobre la App */}
        <View style={styles.section}>
          <Animated.Text style={[styles.sectionTitle, { color: animColors.textMuted }]}>Sobre la App</Animated.Text>
          <Animated.View style={[styles.card, { backgroundColor: animColors.surface, borderColor: animColors.border }]}>
            <View style={styles.cardPadding}>
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
            <View style={styles.divider} />
            <TouchableOpacity
              style={[styles.cardPadding, styles.settingRow]}
              onPress={() => setShowContactModal(true)}
              activeOpacity={0.7}
            >
              <View style={styles.settingLabelRow}>
                <MaterialIcons name="mail-outline" size={20} color={Colors.primary} />
                <Text style={styles.settingLabel}>Sugerencias y Soporte</Text>
              </View>
              <MaterialIcons name="chevron-right" size={24} color={Colors.textMuted} />
            </TouchableOpacity>
          </Animated.View>
        </View>

        {/* Mantenimiento */}
        <View style={styles.section}>
          <Animated.Text style={[styles.sectionTitle, { color: animColors.textMuted }]}>Sistema y Datos</Animated.Text>
          <Animated.View style={[styles.card, { backgroundColor: animColors.surface, borderColor: animColors.border }]}>
            <TouchableOpacity
              style={[styles.cardPadding, styles.settingRow]}
              onPress={handleClearCache}
              activeOpacity={0.7}
            >
              <View style={styles.settingLabelRow}>
                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(244, 63, 94, 0.1)', justifyContent: 'center', alignItems: 'center' }}>
                  <MaterialIcons name="delete-sweep" size={18} color="#f43f5e" />
                </View>
                <View>
                  <Text style={[styles.settingLabel, { color: '#f43f5e' }]}>Vaciar Caché</Text>
                  <Text style={{ fontSize: 11, color: Colors.textMuted }}>Elimina datos locales para liberar espacio</Text>
                </View>
              </View>
              <MaterialIcons name="chevron-right" size={24} color={Colors.textMuted} />
            </TouchableOpacity>
          </Animated.View>
        </View>

        {/* Legal */}
        <View style={styles.section}>
          <Animated.Text style={[styles.sectionTitle, { color: animColors.textMuted }]}>Legal y Propiedad Intelectual</Animated.Text>
          <Animated.View style={[styles.card, styles.cardPadding, { backgroundColor: animColors.surface, borderColor: animColors.border }]}>
            <View style={styles.legalBlock}>
              <Text style={styles.legalTitle}>Propiedad</Text>
              <Text style={styles.textBody}>
                Todos los datos, logotipos, nombres de equipos y clasificaciones son propiedad intelectual exclusiva de la <Text style={{ fontWeight: 'bold' }}>Federación Vasca de Voleibol (fedvasvol.com)</Text> y sus respectivos propietarios.
              </Text>
            </View>
            <View style={[styles.divider, { marginVertical: Spacing.md }]} />
            <View style={styles.legalBlock}>
              <Text style={styles.legalTitle}>Descargo de Responsabilidad</Text>
              <Text style={[styles.textBody, { fontStyle: 'italic' }]}>
                Esta aplicación no es oficial y no tiene afiliación comercial con la federación. Se exime de toda responsabilidad legal derivada del uso de la información mostrada. Esta aplicación es un proyecto independiente de código abierto distribuido bajo la licencia GNU GPL v3. El código fuente está disponible para su consulta y mejora, garantizando que el trabajo realizado para la comunidad del voleibol permanezca siempre accesible y transparente.
              </Text>
            </View>
          </Animated.View>
        </View>

        {/* Footer */}
        <Text style={styles.footerText}>Voleibol Vasco App</Text>

      </ScrollView>

      {/* Confirmation Modal for Cache */}
      <ConfirmationModal
        visible={showClearCacheModal}
        title="¿Vaciar la caché?"
        message="Se eliminarán todos los datos locales guardados para optimizar el almacenamiento."
        confirmLabel="Vaciar"
        icon="delete-sweep"
        isDestructive={true}
        onConfirm={executeClearCache}
        onCancel={() => setShowClearCacheModal(false)}
      />
  
      <ContactModal
        visible={showContactModal}
        onClose={() => setShowContactModal(false)}
        onComplete={(status) => setStatusModal(status)}
      />

      <StatusModal
        visible={statusModal.visible}
        title={statusModal.title}
        message={statusModal.message}
        type={statusModal.type}
        onClose={() => setStatusModal({ ...statusModal, visible: false })}
      />
    </Animated.View>
  );
}
