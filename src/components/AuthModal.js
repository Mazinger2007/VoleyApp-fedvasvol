import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, Modal,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';

export default function AuthModal({ visible, onClose, message }) {
  const { colors } = useTheme();
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  function reset() {
    setEmail('');
    setPassword('');
    setUsername('');
    setError('');
    setMode('login');
    setShowPassword(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function switchMode() {
    setMode(mode === 'login' ? 'register' : 'login');
    setError('');
  }

  const isLogin = mode === 'login';
  const isValid = isLogin
    ? email.includes('@') && password.length >= 6
    : email.includes('@') && password.length >= 6 && username.trim().length >= 3;

  async function handleSubmit() {
    if (!isValid) return;
    setLoading(true);
    setError('');
    try {
      if (isLogin) {
        await signIn(email.trim(), password);
      } else {
        await signUp(email.trim(), password, username.trim());
      }
      handleClose();
    } catch (e) {
      setError(e.message || 'Ha ocurrido un error');
    } finally {
      setLoading(false);
    }
  }

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={handleClose} />
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {/* Close */}
          <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
            <MaterialIcons name="close" size={20} color={colors.textMuted} />
          </TouchableOpacity>

          {/* Icon */}
          <View style={[styles.iconCircle, { backgroundColor: colors.primaryAlpha15 }]}>
            <MaterialIcons name={isLogin ? 'login' : 'person-add'} size={28} color={colors.primary} />
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {isLogin ? 'Iniciar Sesión' : 'Crear Cuenta'}
          </Text>

          {message && (
            <Text style={[styles.message, { color: colors.textMuted }]}>{message}</Text>
          )}

          {/* Error */}
          {error ? (
            <View style={[styles.errorBox, { backgroundColor: colors.errorSoft, borderColor: colors.error }]}>
              <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
            </View>
          ) : null}

          {/* Form */}
          <View style={styles.form}>
            {!isLogin && (
              <View style={[styles.inputWrap, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                <MaterialIcons name="person" size={16} color={colors.textMuted} />
                <TextInput
                  value={username}
                  onChangeText={setUsername}
                  placeholder="Nombre de usuario"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={[styles.input, { color: colors.textPrimary }]}
                />
              </View>
            )}

            <View style={[styles.inputWrap, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
              <MaterialIcons name="email" size={16} color={colors.textMuted} />
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="Email"
                placeholderTextColor={colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                style={[styles.input, { color: colors.textPrimary }]}
              />
            </View>

            <View style={[styles.inputWrap, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
              <MaterialIcons name="lock" size={16} color={colors.textMuted} />
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Contraseña"
                placeholderTextColor={colors.textMuted}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                style={[styles.input, { color: colors.textPrimary }]}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <MaterialIcons name={showPassword ? 'visibility' : 'visibility-off'} size={16} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Submit */}
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={!isValid || loading}
            activeOpacity={0.85}
            style={[
              styles.button,
              { backgroundColor: isValid ? colors.primary : colors.surfaceAlt },
              !isValid && { borderWidth: 1, borderColor: colors.border },
            ]}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={[styles.buttonText, { color: isValid ? '#fff' : colors.textMuted }]}>
                {isLogin ? 'Iniciar Sesión' : 'Crear Cuenta'}
              </Text>
            )}
          </TouchableOpacity>

          {/* Switch */}
          <TouchableOpacity onPress={switchMode} style={styles.switchWrap}>
            <Text style={[styles.switchText, { color: colors.textMuted }]}>
              {isLogin ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}{' '}
              <Text style={{ color: colors.primary, fontWeight: '700' }}>
                {isLogin ? 'Regístrate' : 'Inicia sesión'}
              </Text>
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    gap: 14,
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  message: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  errorBox: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
  },
  errorText: {
    fontSize: 13,
    textAlign: 'center',
  },
  form: {
    gap: 10,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },
  button: {
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  switchWrap: {
    alignItems: 'center',
    paddingTop: 4,
  },
  switchText: {
    fontSize: 13,
  },
});
