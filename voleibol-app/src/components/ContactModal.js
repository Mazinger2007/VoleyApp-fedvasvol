import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Animated, Dimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../contexts/ThemeContext';
import { Spacing, Typography, Radius } from '../styles/theme';

export default function ContactModal({ visible, onClose, onComplete }) {
  const { colors: Colors, isDark } = useTheme();
  const [loading, setLoading] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 8
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true
      }).start();
    }
  }, [visible]);

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [600, 0]
  });

  const [form, setForm] = useState({
    name: '',
    email: '',
    category: 'sugerencia',
    subject: '',
    message: ''
  });

  const categories = [
    { id: 'sugerencia', label: 'Sugerencia', icon: 'lightbulb-outline' },
    { id: 'reportar_error', label: 'Reportar error', icon: 'report-problem' },
    { id: 'nuevo_equipo', label: 'Añadir equipo', icon: 'sports-volleyball' },
    { id: 'otros', label: 'Otros', icon: 'more-horiz' }
  ];

  const handleSubmit = async () => {
    if (!form.subject.trim() || !form.message.trim()) {
      alert('Por favor, rellena el asunto y el mensaje.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('https://formspree.io/f/mqegzprr', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(form)
      });

      if (response.ok) {
        onComplete({
          visible: true,
          title: '¡Mensaje enviado!',
          message: 'He recibido tu solicitud correctamente. Te responderé lo antes posible si has dejado un correo.',
          type: 'success'
        });
        setForm({
          name: '',
          email: '',
          category: 'sugerencia',
          subject: '',
          message: ''
        });
        onClose();
      } else {
        throw new Error('Failed to send');
      }
    } catch (error) {
      onComplete({
        visible: true,
        title: 'Error al enviar',
        message: 'No se pudo enviar el mensaje en este momento. Por favor, inténtalo de nuevo más tarde.',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

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
            intensity={isDark ? 40 : 60}
            tint={isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)' }]} />
        )}

        <Animated.View
          style={[
            styles.keyboardView,
            { transform: [{ translateY }] }
          ]}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ width: '100%' }}
          >
            <View style={[
              styles.content,
              {
                backgroundColor: isDark ? '#1e293b' : '#ffffff',
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
              }
            ]}>
              <View style={styles.header}>
                <View style={[styles.iconCircle, { backgroundColor: isDark ? 'rgba(5, 150, 105, 0.1)' : '#ecfdf5' }]}>
                  <MaterialIcons name="mail-outline" size={24} color={Colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.title, { color: Colors.textPrimary }]}>Contacto y Soporte</Text>
                  <Text style={[styles.subtitle, { color: Colors.textSecondary }]}>Cuéntanos tus ideas o problemas</Text>
                </View>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                  <MaterialIcons name="close" size={24} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.formContainer}>
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: Colors.textMuted }]}>Tu nombre (opcional)</Text>
                  <TextInput
                    style={[styles.input, { color: Colors.textPrimary, backgroundColor: isDark ? '#0f172a' : '#f8fafc', borderColor: Colors.border }]}
                    placeholder="Ej. Kageyama Tobio"
                    placeholderTextColor={Colors.textMuted + '80'}
                    value={form.name}
                    onChangeText={(val) => setForm({ ...form, name: val })}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: Colors.textMuted }]}>Email (opcional)</Text>
                  <TextInput
                    style={[styles.input, { color: Colors.textPrimary, backgroundColor: isDark ? '#0f172a' : '#f8fafc', borderColor: Colors.border }]}
                    placeholder="ejemplo@correo.com"
                    placeholderTextColor={Colors.textMuted + '80'}
                    keyboardType="email-address"
                    value={form.email}
                    onChangeText={(val) => setForm({ ...form, email: val })}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: Colors.textMuted }]}>¿De qué se trata?</Text>
                  <View style={styles.categoryGrid}>
                    {categories.map((cat) => {
                      const active = form.category === cat.id;
                      return (
                        <TouchableOpacity
                          key={cat.id}
                          activeOpacity={0.7}
                          onPress={() => setForm({ ...form, category: cat.id })}
                          style={[
                            styles.catItem,
                            { backgroundColor: isDark ? '#0f172a' : '#f8fafc', borderColor: Colors.border },
                            active && { borderColor: Colors.primary, backgroundColor: isDark ? 'rgba(5, 150, 105, 0.1)' : '#ecfdf5' }
                          ]}
                        >
                          <MaterialIcons name={cat.icon} size={18} color={active ? Colors.primary : Colors.textMuted} />
                          <Text style={[styles.catLabel, { color: active ? Colors.primary : Colors.textSecondary }]}>{cat.label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: Colors.textMuted }]}>Título de la solicitud *</Text>
                  <TextInput
                    style={[styles.input, { color: Colors.textPrimary, backgroundColor: isDark ? '#0f172a' : '#f8fafc', borderColor: Colors.border }]}
                    placeholder="Ej. Alta de mi equipo"
                    placeholderTextColor={Colors.textMuted + '80'}
                    value={form.subject}
                    onChangeText={(val) => setForm({ ...form, subject: val })}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: Colors.textMuted }]}>Detalles *</Text>
                  <TextInput
                    style={[styles.input, styles.textArea, { color: Colors.textPrimary, backgroundColor: isDark ? '#0f172a' : '#f8fafc', borderColor: Colors.border }]}
                    placeholder="Explícanos tu sugerencia o los detalles del equipo..."
                    placeholderTextColor={Colors.textMuted + '80'}
                    multiline={true}
                    numberOfLines={4}
                    textAlignVertical="top"
                    value={form.message}
                    onChangeText={(val) => setForm({ ...form, message: val })}
                  />
                </View>

                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={handleSubmit}
                  disabled={loading}
                  style={styles.submitBtn}
                >
                  <LinearGradient
                    colors={[Colors.primary, Colors.primaryDark]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.gradient}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Text style={styles.submitBtnText}>Enviar mensaje</Text>
                        <MaterialIcons name="send" size={18} color="#fff" style={{ marginLeft: 8 }} />
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  keyboardView: {
    width: '100%',
    maxWidth: 450,
  },
  content: {
    width: '100%',
    borderRadius: Radius.xl,
    borderWidth: 1,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 20
      },
      android: { elevation: 10 },
      web: { boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }
    })
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
    gap: Spacing.md
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center'
  },
  title: {
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.bold,
  },
  subtitle: {
    fontSize: 12,
    opacity: 0.8
  },
  closeBtn: {
    padding: 8
  },
  formContainer: {
    padding: Spacing.lg,
    gap: Spacing.lg
  },
  inputGroup: {
    gap: 6
  },
  label: {
    fontSize: 12,
    fontWeight: Typography.weight.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  input: {
    height: 48,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    fontSize: Typography.size.sm
  },
  textArea: {
    height: 100,
    paddingTop: Spacing.sm,
    textAlignVertical: 'top'
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  catItem: {
    flex: 1,
    minWidth: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
    gap: 8
  },
  catLabel: {
    fontSize: 11,
    fontWeight: Typography.weight.medium
  },
  submitBtn: {
    height: 52,
    borderRadius: Radius.lg,
    marginTop: Spacing.md,
    overflow: 'hidden'
  },
  gradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center'
  },
  submitBtnText: {
    color: '#fff',
    fontWeight: Typography.weight.bold,
    fontSize: 15
  }
});
