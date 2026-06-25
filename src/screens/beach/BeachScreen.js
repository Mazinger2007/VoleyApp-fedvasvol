import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, StatusBar, StyleSheet, View, FlatList, TouchableOpacity, ActivityIndicator, Modal } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { fetchAndParse, URLS } from '../utils/htmlParser';
import { Spacing } from '../styles/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';

const GENDER_STORAGE_KEY = '@beach_gender';


const GENDER_KEYWORDS = {
  male: ['chico', 'masculino', 'mutila'],
  female: ['neskak', 'femenino', 'chicas'],
};

function matchesGender(fileName, gender) {
  const lower = fileName.toLowerCase();
  return GENDER_KEYWORDS[gender].some(kw => lower.includes(kw));
}


export default function BeachScreen({ navigation }) {
  const { colors: Colors, isDark, setIsAppReady } = useTheme();
  const [allFiles, setAllFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [gender, setGender] = useState(null);
  const [showGenderPicker, setShowGenderPicker] = useState(false);

  useEffect(() => {
    setIsAppReady(true);
    let cancelled = false;
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(GENDER_STORAGE_KEY);
        if (!cancelled) setGender(saved || 'male');
      } catch {}
    })();
    (async () => {
      try {
        const blocks = await fetchAndParse(URLS.beachVolleyball);
        if (cancelled) return;
        setAllFiles((blocks || []).find(b => b.type === 'files')?.files || []);
      } catch (e) {
        console.warn('[BeachScreen] Error fetching:', e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [setIsAppReady]);

  const filteredFiles = useMemo(() => {
    if (!gender) return [];
    return allFiles.filter(f => matchesGender(f.name, gender));
  }, [allFiles, gender]);

  const handleGenderSelect = useCallback(async (selected) => {
    setGender(selected);
    setShowGenderPicker(false);
    try { await AsyncStorage.setItem(GENDER_STORAGE_KEY, selected); } catch {}
  }, []);

  const handleChangeGender = useCallback(() => {
    setShowGenderPicker(true);
  }, []);

  const handleOpenPDF = useCallback((url, name) => {
    navigation.navigate('BeachList', { pdfUrl: url, pdfName: name });
  }, [navigation]);

  const styles = useMemo(() => StyleSheet.create({
    safe: { flex: 1, backgroundColor: Colors.background },
    header: {
      height: 64,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 8,
      backgroundColor: Colors.surface,
      borderBottomColor: Colors.border,
      borderBottomWidth: 1,
    },
    headerTitleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      justifyContent: 'center',
    },
    headerTitleText: { fontSize: 16, fontWeight: '900', letterSpacing: -0.5, color: Colors.primary },
    spacer: { width: 44 },
    genderBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      backgroundColor: Colors.primary + '18',
      minWidth: 80,
    },
    genderBtnText: { fontSize: 13, fontWeight: '700', color: Colors.primary, marginLeft: 4 },
    headerRight: { width: 80, alignItems: 'flex-end' },
    list: { flex: 1, padding: Spacing.md },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: Colors.surface,
      borderRadius: 12,
      padding: Spacing.md,
      marginBottom: Spacing.sm,
      borderWidth: 1,
      borderColor: Colors.border,
    },
    cardContent: { flex: 1, marginLeft: Spacing.md },
    fileName: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary, marginBottom: 4 },
    fileMeta: { fontSize: 12, color: Colors.textMuted },
    pdfIcon: { color: '#e74c3c' },
    loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
    emptyText: { color: Colors.textMuted, fontSize: 16, fontWeight: '500', textAlign: 'center' },
    modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)' },
    modalCard: {
      backgroundColor: Colors.surface,
      borderRadius: 20,
      padding: 32,
      width: '80%',
      maxWidth: 360,
      alignItems: 'center',
    },
    modalIcon: { marginBottom: 16 },
    modalTitle: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary, marginBottom: 8, textAlign: 'center' },
    modalSubtitle: { fontSize: 14, color: Colors.textMuted, marginBottom: 24, textAlign: 'center', lineHeight: 20 },
    genderOption: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      paddingVertical: 16,
      borderRadius: 14,
      marginBottom: 12,
    },
    genderMale: { backgroundColor: '#2563eb20' },
    genderFemale: { backgroundColor: '#ec489920' },
    genderOptionText: { fontSize: 17, fontWeight: '700', marginLeft: 10 },
    genderMaleText: { color: '#2563eb' },
    genderFemaleText: { color: '#ec4899' },
  }), [Colors]);

  const renderItem = useCallback(({ item }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.7}
      onPress={() => handleOpenPDF(item.url, item.name)}
    >
      <MaterialIcons name="picture-as-pdf" size={36} style={styles.pdfIcon} />
      <View style={styles.cardContent}>
        <Text style={styles.fileName} numberOfLines={2}>{item.name}</Text>
        <Text style={styles.fileMeta}>
          {[item.size, item.date].filter(Boolean).join(' · ')}
        </Text>
      </View>
      <MaterialIcons name="open-in-new" size={18} color={Colors.textMuted} />
    </TouchableOpacity>
  ), [styles, Colors.textMuted, handleOpenPDF]);

  const content = () => {
    if (!gender) return null;
    if (loading) {
      return (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={[styles.emptyText, { marginTop: 16 }]}>Cargando documentos...</Text>
        </View>
      );
    }
    if (filteredFiles.length === 0) {
      return (
        <View style={styles.emptyWrap}>
          <MaterialIcons name="description" size={64} color={Colors.textMuted} style={{ opacity: 0.3 }} />
          <Text style={styles.emptyText}>No hay documentos para esta categoría</Text>
        </View>
      );
    }
    return (
      <FlatList
        data={filteredFiles}
        renderItem={renderItem}
        keyExtractor={(item, i) => `${item.url}_${i}`}
        style={styles.list}
        contentContainerStyle={{ paddingBottom: 32 }}
      />
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={Colors.background} />
      <View style={styles.header}>
        {gender ? (
          <TouchableOpacity style={styles.genderBtn} onPress={handleChangeGender} activeOpacity={0.7}>
            <MaterialIcons name={gender === 'male' ? 'male' : 'female'} size={18} color={Colors.primary} />
            <Text style={styles.genderBtnText}>{gender === 'male' ? 'Masculino' : 'Femenino'}</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.spacer} />
        )}
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitleText}>VOLEY PLAYA</Text>
        </View>
        {gender ? <View style={styles.headerRight} /> : <View style={styles.spacer} />}
      </View>
      {content()}
      <Modal visible={showGenderPicker} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <MaterialIcons name="beach-access" size={56} color={Colors.primary} style={styles.modalIcon} />
            <Text style={styles.modalTitle}>Voley Playa</Text>
            <Text style={styles.modalSubtitle}>Selecciona la categoría para ver los documentos disponibles</Text>
            <TouchableOpacity
              style={[styles.genderOption, styles.genderMale]}
              activeOpacity={0.7}
              onPress={() => handleGenderSelect('male')}
            >
              <MaterialIcons name="male" size={28} color="#2563eb" />
              <Text style={[styles.genderOptionText, styles.genderMaleText]}>Masculino</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.genderOption, styles.genderFemale]}
              activeOpacity={0.7}
              onPress={() => handleGenderSelect('female')}
            >
              <MaterialIcons name="female" size={28} color="#ec4899" />
              <Text style={[styles.genderOptionText, styles.genderFemaleText]}>Femenino</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
