// src/screens/SettingsScreen.js
// Pantalla de Perfil — nueva UI basada en el mockup de la comunidad.

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, StatusBar, Switch, ScrollView, TouchableOpacity, Linking, Alert, ActivityIndicator, Modal, Platform, Animated } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Spacing, Typography, Radius } from '../styles/theme';
import { useTheme, ACCENT_COLORS } from '../contexts/ThemeContext';
import ConfirmationModal from '../components/ConfirmationModal';
import StatusModal from '../components/StatusModal';
import { DarkTheme } from '@react-navigation/native';

export default function SettingsScreen() {
  const { colors: Colors, isDark, toggleTheme, accentKey, changeAccent, animColors } = useTheme();
  
  const [isChecking, setIsChecking] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [showClearCacheModal, setShowClearCacheModal] = useState(false);
  const [statusModal, setStatusModal] = useState({ visible: false, title: '', message: '', type: 'info' });
  const currentVersion = Constants.expoConfig?.version || '1.0.0';

  const checkForUpdates = async () => {
    setIsChecking(true);
    try {
      const REPO_APP_JSON_URL = 'https://gitea.dtbx.duckdns.org/Mazinger2007/Voleibol/raw/branch/main/voleibol-app/app.json';
      const REPO_RELEASES_URL = 'https://gitea.dtbx.duckdns.org/Mazinger2007/Voleibol/releases/latest';
      
      const response = await fetch(REPO_APP_JSON_URL, { cache: 'no-cache' });
      if (!response.ok) throw new Error('Network response was not ok');
      const data = await response.json();
      
      const latestVersion = data?.expo?.version;
      if (!latestVersion) throw new Error('Invalid app.json payload');
      
      const isNewer = compareVersions(latestVersion, currentVersion) > 0;
      
      if (isNewer) {
        setUpdateInfo({ version: latestVersion, isNewer: true, url: REPO_RELEASES_URL });
      } else {
        setUpdateInfo({ version: currentVersion, isNewer: false });
      }
    } catch (error) {
      console.log('Update check failed:', error);
      setStatusModal({
        visible: true,
        title: 'Servidor no disponible',
        message: 'No hemos podido conectar con el centro de actualizaciones en este momento. Por favor, inténtalo de nuevo más tarde.',
        type: 'error'
      });
    } finally {
      setIsChecking(false);
    }
  };

  function compareVersions(v1, v2) {
    const parts1 = String(v1).split('.').map(Number);
    const parts2 = String(v2).split('.').map(Number);
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
        const p1 = parts1[i] || 0;
        const p2 = parts2[i] || 0;
        if (p1 > p2) return 1;
        if (p1 < p2) return -1;
    }
    return 0;
  }

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
    } catch (err) {
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
      paddingTop: 0,
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
    <Animated.View style={[styles.safe, { backgroundColor: animColors.background }]}>
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
              <Switch
                value={isDark}
                onValueChange={toggleTheme}
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
              onPress={checkForUpdates}
              disabled={isChecking}
              activeOpacity={0.7}
            >
              <View style={styles.settingLabelRow}>
                <MaterialIcons name="system-update" size={20} color={Colors.primary} />
                <Text style={styles.settingLabel}>Buscar actualizaciones</Text>
              </View>
              {isChecking ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <MaterialIcons name="chevron-right" size={24} color={Colors.textMuted} />
              )}
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
          </Animated.View>
        </View>

        {/* Footer */}
        <Text style={styles.footerText}>Voleibol Vasco App v{currentVersion}</Text>

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

      {/* Custom Update Modal */}
      <Modal
        visible={!!updateInfo}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setUpdateInfo(null)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: Spacing.xl }}>
          {Platform.OS !== 'web' && (
            <BlurView intensity={30} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          )}
          <TouchableOpacity 
            style={StyleSheet.absoluteFill} 
            activeOpacity={1} 
            onPress={() => setUpdateInfo(null)} 
          />
          
          <View style={{ 
            width: '100%', 
            maxWidth: 320,
            backgroundColor: isDark ? '#1e293b' : '#ffffff', 
            borderRadius: Radius.xxl, 
            padding: Spacing.lg,
            paddingTop: Spacing.xl, 
            alignItems: 'center', 
            borderWidth: 1,
            borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
            elevation: 10,
            ...(Platform.OS !== 'web' ? {
              shadowColor: '#000', 
              shadowOpacity: 0.25, 
              shadowRadius: 20,
              shadowOffset: { width: 0, height: 10 },
            } : {
              boxShadow: '0 10px 20px rgba(0,0,0,0.25)'
            })
          }}>
            
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: updateInfo?.isNewer ? (isDark ? 'rgba(59, 130, 246, 0.15)' : '#eff6ff') : (isDark ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5'), justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.md }}>
              <MaterialIcons 
                name={updateInfo?.isNewer ? "system-update" : "check-circle"} 
                size={34} 
                color={updateInfo?.isNewer ? Colors.primary : '#10b981'} 
              />
            </View>
            
            <Text style={{ fontSize: Typography.size.lg, fontWeight: Typography.weight.bold, color: Colors.textPrimary, marginBottom: Spacing.xs, textAlign: 'center' }}>
              {updateInfo?.isNewer ? '¡Actualización Disponible!' : 'Todo al día'}
            </Text>
            
            <Text style={{ fontSize: Typography.size.sm, color: Colors.textSecondary, textAlign: 'center', marginBottom: Spacing.lg, lineHeight: 20, opacity: 0.8 }}>
              {updateInfo?.isNewer 
                ? `Hay una nueva versión de la app (v${updateInfo.version}). ¿Deseas descargar e instalar la actualización ahora?` 
                : `Tienes la versión más reciente instalada (v${updateInfo?.version}).`}
            </Text>
            
            {updateInfo?.isNewer ? (
              <View style={{ flexDirection: 'row', gap: Spacing.md, width: '100%' }}>
                <TouchableOpacity 
                  style={{ flex: 1, height: 48, borderRadius: Radius.lg, backgroundColor: isDark ? 'rgba(71, 85, 105, 0.2)' : '#f1f5f9', alignItems: 'center', justifyContent: 'center' }}
                  activeOpacity={0.9}
                  onPress={() => setUpdateInfo(null)}
                >
                  <Text style={{ color: Colors.textPrimary, fontWeight: Typography.weight.semiBold }}>Más tarde</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={{ flex: 1, height: 48 }} 
                  activeOpacity={0.9}
                  onPress={() => {
                    Linking.openURL(updateInfo.url);
                    setUpdateInfo(null);
                  }}
                >
                  <LinearGradient
                    colors={[Colors.primary, Colors.primary]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{ flex: 1, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center', elevation: 2 }}
                  >
                    <Text style={{ color: '#ffffff', fontWeight: Typography.weight.semiBold }}>Descargar</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity 
                style={{ width: '100%', height: 48 }} 
                activeOpacity={0.9}
                onPress={() => setUpdateInfo(null)}
              >
                <LinearGradient
                  colors={[Colors.primary, Colors.primary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{ flex: 1, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center', elevation: 2 }}
                >
                  <Text style={{ color: '#ffffff', fontWeight: Typography.weight.semiBold }}>Aceptar</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}

          </View>
        </View>
      </Modal>

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
