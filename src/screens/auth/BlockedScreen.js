import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../../components/base/Button';

export default function BlockedScreen() {
  const { colors } = useTheme();
  const { blockedReason, signOut } = useAuth();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <View style={[styles.iconContainer, { backgroundColor: colors.errorSoft }]}>
          <MaterialIcons name="block" size={64} color={colors.error} />
        </View>

        <Text style={[styles.title, { color: colors.textPrimary }]}>Cuenta deshabilitada</Text>

        <Text style={[styles.reason, { color: colors.textSecondary }]}>
          {blockedReason || 'Tu cuenta ha sido deshabilitada. Contacta con soporte para más información.'}
        </Text>

        <View style={styles.buttonContainer}>
          <Button
            onPress={signOut}
            style={[styles.button, { backgroundColor: colors.error }]}
            textStyle={{ color: '#ffffff' }}
          >
            Cerrar sesión
          </Button>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  content: {
    alignItems: 'center',
    maxWidth: 340,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 28,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  reason: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  buttonContainer: {
    width: '100%',
  },
  button: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
});
