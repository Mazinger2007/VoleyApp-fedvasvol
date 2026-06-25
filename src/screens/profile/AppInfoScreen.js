import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import AppDetailHeader from '../../components/AppDetailHeader';
import ContactModal from '../../components/ContactModal';
import StatusModal from '../../components/StatusModal';

const APP_VERSION = '1.0.0';

function Section({ title, children, colors }) {
  return (
    <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.sectionTitle, { color: colors.primary }]}>{title}</Text>
      {children}
    </View>
  );
}

function Paragraph({ children, colors }) {
  return <Text style={[styles.paragraph, { color: colors.textSecondary }]}>{children}</Text>;
}

function InfoRow({ icon, label, value, colors }) {
  return (
    <View style={styles.infoRow}>
      <MaterialIcons name={icon} size={18} color={colors.textMuted} />
      <Text style={[styles.infoLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: colors.textPrimary }]}>{value}</Text>
    </View>
  );
}

export default function AppInfoScreen({ navigation }) {
  const { colors } = useTheme();
  const [showContact, setShowContact] = useState(false);
  const [statusModal, setStatusModal] = useState({ visible: false });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppDetailHeader
        title="Sobre la app"
        onBack={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Section title="Sobre el proyecto" colors={colors}>
          <Paragraph colors={colors}>
            Voleibol Vizcaya es una aplicación diseñada para seguir la actualidad del voleibol en Bizkaia.
            Consulta resultados, clasificaciones, calendarios y noticias de las competiciones de la Federación
            de Voleibol de Bizkaia (FEDV).
          </Paragraph>
          <Paragraph colors={colors}>
            La app obtiene los datos directamente de la web oficial de la federación mediante procesamiento
            de HTML, ofreciendo una experiencia nativa y fluida.
          </Paragraph>
        </Section>

        <Section title="Estado actual" colors={colors}>
          <InfoRow icon="info" label="Versión" value={APP_VERSION} colors={colors} />
          <InfoRow icon="phone-android" label="Plataforma" value={Platform.OS === 'ios' ? 'iOS' : Platform.OS === 'android' ? 'Android' : 'Web'} colors={colors} />
          <InfoRow icon="check-circle" label="Estado" value="En desarrollo" colors={colors} />
        </Section>

        <Section title="Rendimiento" colors={colors}>
          <Paragraph colors={colors}>
            Los datos se obtienen en segundo plano mediante scraping de la web federativa.
            Se utilizan cachés en memoria y AsyncStorage para reducir las peticiones y mejorar
            la velocidad de carga. Los logos de equipos se almacenan localmente para persistir
            entre sesiones.
          </Paragraph>
        </Section>

        <Section title="Fuentes de datos" colors={colors}>
          <Paragraph colors={colors}>
            Todos los datos proceden de la web oficial de la Federación de Voleibol de Bizkaia.
            La app procesa el HTML de las páginas para extraer clasificaciones, resultados,
            calendarios y otra información competitiva.
          </Paragraph>
          <TouchableOpacity
            onPress={() => Linking.openURL('https://fedvasvol.com')}
            activeOpacity={0.7}
          >
            <Text style={[styles.link, { color: colors.primary }]}>fedvasvol.com</Text>
          </TouchableOpacity>
        </Section>

        <Section title="Derechos y propiedad" colors={colors}>
          <Paragraph colors={colors}>
            Los datos de competiciones, resultados y clasificaciones pertenecen a la Federación
            de Voleibol de Bizkaia (FEDV). Esta aplicación no es oficial ni está afiliada a la federación.
          </Paragraph>
          <Paragraph colors={colors}>
            Los logos y nombres de equipos son propiedad de sus respectivos clubes.
          </Paragraph>
          <TouchableOpacity
            onPress={() => Linking.openURL('https://fedvasvol.com')}
            activeOpacity={0.7}
          >
            <Text style={[styles.link, { color: colors.primary }]}>fedvasvol.com</Text>
          </TouchableOpacity>
        </Section>

        <Section title="Contacto" colors={colors}>
          <Paragraph colors={colors}>
            Si tienes sugerencias, quieres colaborar o encontrar algún fallo, puedes enviarme un mensaje
            directamente desde la app.
          </Paragraph>
          <TouchableOpacity
            style={[styles.contactButton, { backgroundColor: colors.primaryAlpha15 }]}
            onPress={() => setShowContact(true)}
            activeOpacity={0.8}
          >
            <MaterialIcons name="mail-outline" size={20} color={colors.primary} />
            <Text style={[styles.contactButtonText, { color: colors.primary }]}>Enviar mensaje</Text>
          </TouchableOpacity>
        </Section>

        <Section title="Agradecimiento" colors={colors}>
          <Paragraph colors={colors}>
            Gracias a la Federación de Voleibol de Bizkaia por mantener la web actualizada
            y hacer posible el acceso público a la información competitiva.
          </Paragraph>
          <Paragraph colors={colors}>
            Gracias a todos los usuarios que probáis la app y compartís vuestras opiniones
            para mejorarla.
          </Paragraph>
        </Section>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.textMuted }]}>
            Voleibol Vizcaya v{APP_VERSION}
          </Text>
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>

      <ContactModal
        visible={showContact}
        onClose={() => setShowContact(false)}
        onComplete={(result) => setStatusModal(result)}
      />
      <StatusModal
        visible={statusModal.visible}
        title={statusModal.title}
        message={statusModal.message}
        type={statusModal.type}
        onClose={() => setStatusModal({ visible: false })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 16 },
  section: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
  },
  paragraph: {
    fontSize: 13.5,
    lineHeight: 20,
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  infoLabel: {
    fontSize: 13,
    flex: 1,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  link: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
    marginBottom: 8,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
    marginTop: 8,
  },
  contactButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 12,
  },
  footerText: {
    fontSize: 12,
  },
});
