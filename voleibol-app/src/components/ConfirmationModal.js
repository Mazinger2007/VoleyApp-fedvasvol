import { View, Text, StyleSheet, Modal, TouchableOpacity, Platform, Dimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../contexts/ThemeContext';
import { Spacing, Typography, Radius } from '../styles/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ConfirmationModal({ 
  visible, 
  title, 
  message, 
  confirmLabel = 'Confirmar', 
  cancelLabel = 'Cancelar', 
  onConfirm, 
  onCancel, 
  isDestructive = false,
  icon = 'help-outline'
}) {
  const { colors: Colors, isDark } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onCancel}
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
            onPress={onCancel} 
          />
        )}
        
        <TouchableOpacity 
          style={StyleSheet.absoluteFill} 
          activeOpacity={1} 
          onPress={onCancel} 
        />

        <View style={[
          styles.content, 
          { 
            backgroundColor: isDark ? '#1e293b' : '#ffffff',
            borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
            borderWidth: 1,
          }
        ]}>
          <View style={[
            styles.iconWrap, 
            { backgroundColor: isDestructive ? 'rgba(244, 63, 94, 0.1)' : 'rgba(13, 143, 242, 0.1)' }
          ]}>
            <MaterialIcons 
              name={icon} 
              size={32} 
              color={isDestructive ? '#f43f5e' : Colors.primary} 
            />
          </View>
          
          <Text style={[styles.title, { color: Colors.textPrimary }]}>{title}</Text>
          <Text style={[styles.message, { color: Colors.textSecondary }]}>{message}</Text>
          
          <View style={styles.footer}>
            <TouchableOpacity 
              style={[styles.btn, styles.cancelBtn, { backgroundColor: isDark ? 'rgba(71, 85, 105, 0.2)' : '#f1f5f9' }]} 
              onPress={onCancel}
              activeOpacity={0.7}
            >
              <Text style={[styles.btnText, { color: Colors.textPrimary }]}>{cancelLabel}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.btn} 
              onPress={onConfirm}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={isDestructive ? ['#f43f5e', '#e11d48'] : [Colors.primary, Colors.primary + 'CC']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.gradient, styles.confirmBtn]}
              >
                <Text style={[styles.btnText, { color: '#ffffff' }]}>{confirmLabel}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
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
  footer: {
    flexDirection: 'row',
    gap: Spacing.md,
    justifyContent: 'center',
    width: '100%',
  },
  btn: {
    flex: 1,
    maxWidth: 140,
    height: 48,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  btnText: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.semiBold,
  },
  gradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.lg,
  },
  confirmBtn: {
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  cancelBtn: {},
});
