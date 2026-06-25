import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
} from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';

export default function RegisterScreen({ navigation }) {
  const { colors } = useTheme();
  const { signUp } = useAuth();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    if (!username.trim() || !email.trim() || !password) {
      setError('Rellena todos los campos');
      return;
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await signUp(email.trim(), password, username.trim());
    } catch (e) {
      setError(e.message || 'Error al crear la cuenta');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={{ color: colors.primary, fontSize: 15 }}>{'< Volver'}</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Crear cuenta</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Únete a la comunidad del voleibol</Text>
        </View>

        <View style={styles.form}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Nombre de usuario</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surfaceAlt, color: colors.textPrimary, borderColor: colors.border }]}
            placeholder="Tu nombre"
            placeholderTextColor={colors.textMuted}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={[styles.label, { color: colors.textSecondary }]}>Email</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surfaceAlt, color: colors.textPrimary, borderColor: colors.border }]}
            placeholder="tu@email.com"
            placeholderTextColor={colors.textMuted}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={[styles.label, { color: colors.textSecondary }]}>Contraseña</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surfaceAlt, color: colors.textPrimary, borderColor: colors.border }]}
            placeholder="Mínimo 6 caracteres"
            placeholderTextColor={colors.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
          />

          {error ? (
            <Text style={[styles.error, { color: colors.error }]}>{error}</Text>
          ) : null}

          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={colors.textOnPrimary} />
            ) : (
              <Text style={[styles.buttonText, { color: colors.textOnPrimary }]}>Crear cuenta</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.loginLink}
            onPress={() => navigation.goBack()}
          >
            <Text style={{ color: colors.textSecondary }}>
              ¿Ya tienes cuenta?{' '}
              <Text style={{ color: colors.primary, fontWeight: '600' }}>Inicia sesión</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  backButton: { position: 'absolute', top: 50, left: 24 },
  header: { alignItems: 'center', marginBottom: 40 },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 8 },
  subtitle: { fontSize: 15 },
  form: { marginBottom: 24 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6, marginLeft: 4 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 16,
  },
  error: { fontSize: 13, textAlign: 'center', marginBottom: 12 },
  button: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonText: { fontSize: 16, fontWeight: '600' },
  loginLink: { alignItems: 'center', marginTop: 16 },
});
