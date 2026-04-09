import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../contexts/ThemeContext';
import { Spacing, Typography, Radius } from '../styles/theme';

export default function StatusModal({ 
  visible, 
  title, 
  message, 
  buttonLabel = 'Entendido', 
  onClose, 
  type = 'info' // 'success', 'error', 'info', 'warning'
}) {
  const { colors: Colors, isDark } = useTheme();

  const getIcon = () => {
    switch (type) {
      case 'success': return { name: 'check-circle', color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' };
      case 'error': return { name: 'error-outline', color: '#f43f5e', bg: 'rgba(244, 63, 94, 0.1)' };
      case 'warning': return { name: 'warning', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' };
      default: return { name: 'info-outline', color: Colors.primary, bg: 'rgba(13, 143, 242, 0.1)' };
    }
  };

  const iconConfig = getIcon();

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        {Platform.OS !== 'web' ? (
          <BlurView 
            intensity={isDark ? 30 : 50} 
            tint={isDark ? 'dark' : 'light'} 
            style={StyleSheet.absoluteFill} 
          />
        ) : (
          <TouchableOpacity 
            style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)' }]} 
            activeOpacity={1} 
            onPress={onClose} 
          />
        )}
        
        <TouchableOpacity 
          style={StyleSheet.absoluteFill} 
          activeOpacity={1} 
          onPress={onClose} 
        />

        <View style={[
          styles.content, 
          { 
            backgroundColor: isDark ? '#1e293b' : '#ffffff',
            borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
            borderWidth: 1,
          }
        ]}>
          <View style={[styles.iconWrap, { backgroundColor: iconConfig.bg }]}>
            <MaterialIcons name={iconConfig.name} size={32} color={iconConfig.color} />
          </View>
          
          <Text style={[styles.title, { color: Colors.textPrimary }]}>{title}</Text>
          <Text style={[styles.message, { color: Colors.textSecondary }]}>{message}</Text>
          
          <TouchableOpacity 
            style={styles.btn} 
            onPress={onClose}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={[Colors.primary, Colors.primary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.gradient}
            >
              <Text style={styles.btnText}>{buttonLabel}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  content: {
    width: '100%',
    maxWidth: 320,
    borderRadius: Radius.xxl,
    padding: Spacing.lg,
    paddingTop: Spacing.xl,
    alignItems: 'center',
    elevation: 10,
    ...(Platform.OS !== 'web' ? {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.25,
      shadowRadius: 20,
    } : {
      boxShadow: '0 10px 20px rgba(0,0,0,0.25)'
    })
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: Typography.size.lg,
    fontWeight: Typography.weight.bold,
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  message: {
    fontSize: Typography.size.sm,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.lg,
    opacity: 0.8,
  },
  btn: {
    width: '100%',
    height: 48,
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  gradient: {
    flex: 1,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.semiBold,
    color: '#ffffff',
  },
});
