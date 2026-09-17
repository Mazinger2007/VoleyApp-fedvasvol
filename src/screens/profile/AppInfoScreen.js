import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useTheme } from '../../contexts/ThemeContext';
import { Spacing, Typography, Radius, Shadow } from '../../styles/theme';
import { BASE_URL } from '../../utils/htmlParser';
import AppDetailHeader from '../../components/AppDetailHeader';
import ContactModal from '../../components/ContactModal';
import StatusModal from '../../components/StatusModal';

const APP_VERSION = Constants.expoConfig?.version ?? '0.0.0';
const FEDERATION_URL = BASE_URL;

function InfoCard({ icon, title, children, colors }) {
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, Shadow.sm]}>
      <View style={styles.cardHeader}>
        <View style={[styles.cardIconWrap, { backgroundColor: colors.primaryAlpha15 }]}>
          <MaterialIcons name={icon} size={20} color={colors.primary} />
        </View>
        <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{title}</Text>
      </View>
      <View style={styles.cardBody}>{children}</View>
    </View>
  );
}

function BodyText({ children, colors, style }) {
  return (
    <Text style={[styles.bodyText, { color: colors.textSecondary }, style]}>
      {children}
    </Text>
  );
}

function BulletItem({ children, colors }) {
  return (
    <View style={styles.bulletRow}>
      <View style={[styles.bulletDot, { backgroundColor: colors.primary }]} />
      <Text style={[styles.bulletText, { color: colors.textSecondary }]}>{children}</Text>
    </View>
  );
}

function MetaRow({ icon, label, value, colors }) {
  return (
    <View style={styles.metaRow}>
      <MaterialIcons name={icon} size={18} color={colors.textMuted} />
      <Text style={[styles.metaLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.metaValue, { color: colors.textPrimary }]}>{value}</Text>
    </View>
  );
}

export default function AppInfoScreen({ navigation }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [showContact, setShowContact] = useState(false);
  const [statusModal, setStatusModal] = useState({ visible: false });

  const platformLabel = Platform.OS === 'ios' ? 'iOS' : Platform.OS === 'android' ? 'Android' : 'Web';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <AppDetailHeader
        title="Sobre la app"
        onBack={() => navigation.goBack()}
      />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + Spacing.xxxl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.heroCard, { backgroundColor: colors.primary }]}>
          <Text style={styles.heroEmoji}>🏐</Text>
          <Text style={styles.heroTitle}>Voleibol Euskadi</Text>
          <Text style={styles.heroSubtitle}>
            Resultados, clasificaciones y calendarios del voleibol vasco, en un solo lugar.
          </Text>
        </View>

        <InfoCard icon="cloud-download" title="¿De dónde salen los datos?" colors={colors}>
          <BodyText colors={colors}>
            Los datos que ves en la aplicación se obtienen automáticamente a partir de la
            información publicada por la Federación Vasca de Voleibol.
          </BodyText>
          <BodyText colors={colors}>
            La app recopila esa información, la organiza y la presenta de una forma mucho más
            cómoda, rápida e intuitiva para consultar resultados, clasificaciones y calendarios.
          </BodyText>
          <TouchableOpacity
            onPress={() => Linking.openURL(FEDERATION_URL)}
            activeOpacity={0.7}
            style={[styles.linkButton, { backgroundColor: colors.primaryAlpha10 }]}
          >
            <MaterialIcons name="open-in-new" size={16} color={colors.primary} />
            <Text style={[styles.linkText, { color: colors.primary }]}>fedvasvol.com</Text>
          </TouchableOpacity>
        </InfoCard>

        <InfoCard icon="handshake" title="Un proyecto independiente" colors={colors}>
          <BodyText colors={colors}>
            Esta aplicación nació como un proyecto personal, creado con la intención de mejorar
            la forma en que seguimos el voleibol.
          </BodyText>
          <BulletItem colors={colors}>
            He intentado ponerme en contacto con la Federación Vasca de Voleibol para colaborar
            y ofrecer una aplicación aún mejor.
          </BulletItem>
          <BulletItem colors={colors}>
            Hasta el momento no he recibido respuesta o las conversaciones no han llegado a
            materializarse.
          </BulletItem>
          <BulletItem colors={colors}>
            Aun así, continúo mejorando la aplicación de forma independiente siempre que me es posible.
          </BulletItem>
          <View style={[styles.noteBox, { backgroundColor: colors.primaryAlpha10, borderColor: colors.border }]}>
            <MaterialIcons name="info-outline" size={16} color={colors.primary} />
            <Text style={[styles.noteText, { color: colors.textSecondary }]}>
              Esta app no es oficial ni está afiliada a la Federación Vasca de Voleibol.
            </Text>
          </View>
        </InfoCard>

        <InfoCard icon="schedule" title="Limitaciones a tener en cuenta" colors={colors}>
          <BulletItem colors={colors}>
            La información disponible depende de lo que publica oficialmente la federación.
          </BulletItem>
          <BulletItem colors={colors}>
            Algunas actualizaciones pueden tardar un poco más en aparecer en la app, porque
            dependen de cuándo se publiquen los datos en la web oficial.
          </BulletItem>
          <BulletItem colors={colors}>
            Aun así, he intentado optimizar al máximo la velocidad, la estabilidad y la
            experiencia de uso.
          </BulletItem>
        </InfoCard>

        <InfoCard icon="gavel" title="Derechos y reconocimientos" colors={colors}>
          <BodyText colors={colors}>
            Los datos de competiciones, resultados y clasificaciones pertenecen a la Federación
            Vasca de Voleibol. Los logos y nombres de equipos son propiedad de sus respectivos clubes.
          </BodyText>
          <BodyText colors={colors}>
            Gracias a la federación por mantener la información al día y hacerla accesible al
            público. Y gracias a ti por usar la app y ayudarme a mejorarla con tus comentarios.
          </BodyText>
        </InfoCard>

        <InfoCard icon="smartphone" title="Estado de la app" colors={colors}>
          <MetaRow icon="info-outline" label="Versión" value={APP_VERSION} colors={colors} />
          <MetaRow icon="devices" label="Plataforma" value={platformLabel} colors={colors} />
          <MetaRow icon="build-circle" label="Estado" value="En mejora continua" colors={colors} />
        </InfoCard>

        <View style={[styles.contactCard, { backgroundColor: colors.surface, borderColor: colors.border }, Shadow.sm]}>
          <View style={styles.contactHeader}>
            <View style={[styles.cardIconWrap, { backgroundColor: colors.primaryAlpha15 }]}>
              <MaterialIcons name="mail-outline" size={20} color={colors.primary} />
            </View>
            <View style={styles.contactHeaderText}>
              <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>¿Tienes alguna sugerencia?</Text>
              <Text style={[styles.contactSubtitle, { color: colors.textMuted }]}>
                Cuéntame si encuentras algún fallo o tienes ideas para mejorar la app.
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.contactButton, { backgroundColor: colors.primary }]}
            onPress={() => setShowContact(true)}
            activeOpacity={0.85}
          >
            <MaterialIcons name="send" size={18} color="#fff" />
            <Text style={styles.contactButtonText}>Enviar mensaje</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.textMuted }]}>
            Voleibol Euskadi · v{APP_VERSION}
          </Text>
          <Text style={[styles.footerSubtext, { color: colors.textMuted }]}>
            Hecho con cariño para la comunidad del voleibol vasco
          </Text>
        </View>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    gap: Spacing.lg,
  },

  heroCard: {
    borderRadius: Radius.xl,
    paddingVertical: Spacing.xxl,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    overflow: 'hidden',
  },
  heroEmoji: { fontSize: 40, marginBottom: Spacing.sm },
  heroTitle: {
    fontSize: Typography.size.xl,
    fontWeight: Typography.weight.extraBold,
    color: '#ffffff',
    marginBottom: Spacing.xs,
  },
  heroSubtitle: {
    fontSize: Typography.size.md,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
  },

  card: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  cardIconWrap: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    flex: 1,
    fontSize: Typography.size.lg,
    fontWeight: Typography.weight.bold,
  },
  cardBody: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    gap: Spacing.sm,
  },

  bodyText: {
    fontSize: Typography.size.md,
    lineHeight: 22,
  },

  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    paddingLeft: Spacing.xs,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 8,
  },
  bulletText: {
    flex: 1,
    fontSize: Typography.size.md,
    lineHeight: 22,
  },

  noteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginTop: Spacing.xs,
  },
  noteText: {
    flex: 1,
    fontSize: Typography.size.sm,
    lineHeight: 20,
  },

  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    marginTop: Spacing.xs,
  },
  linkText: {
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.semiBold,
  },

  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  metaLabel: {
    flex: 1,
    fontSize: Typography.size.md,
  },
  metaValue: {
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.semiBold,
  },

  contactCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  contactHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  contactHeaderText: {
    flex: 1,
    gap: Spacing.xs,
  },
  contactSubtitle: {
    fontSize: Typography.size.sm,
    lineHeight: 20,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  contactButtonText: {
    color: '#ffffff',
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.semiBold,
  },

  footer: {
    alignItems: 'center',
    paddingTop: Spacing.sm,
    gap: Spacing.xs,
  },
  footerText: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.semiBold,
  },
  footerSubtext: {
    fontSize: Typography.size.sm,
    textAlign: 'center',
  },
});
