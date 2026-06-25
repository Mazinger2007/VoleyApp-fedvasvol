import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, StatusBar, StyleSheet, View, ScrollView, TouchableOpacity, ActivityIndicator, Image, Linking, Dimensions } from 'react-native';
import GalleryViewer from '../../components/GalleryViewer';
import { useTheme } from '../../contexts/ThemeContext';
import { fetchAndParse } from '../../utils/htmlParser';
import { Spacing } from '../../styles/theme';


const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const URL_REGEX = /(https?:\/\/[^\s<]+)|(www\.[^\s<]+)/gi;


function Paragraph({ text, isFirst, colors, leadStyle, bodyStyle }) {
  const parts = [];
  let lastIndex = 0;
  let match;
  URL_REGEX.lastIndex = 0;
  let hasLinks = false;
  while ((match = URL_REGEX.exec(text)) !== null) {
    hasLinks = true;
    if (match.index > lastIndex) {
      parts.push({ text: text.substring(lastIndex, match.index), link: null });
    }
    parts.push({ text: match[0], link: match[0] });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push({ text: text.substring(lastIndex), link: null });
  }
  const textStyle = isFirst ? leadStyle : bodyStyle;
  if (!hasLinks) {
    return <Text style={textStyle}>{text}</Text>;
  }
  return (
    <Text style={textStyle}>
      {parts.map((part, i) => {
        if (part.link) {
          const url = part.link.startsWith('www') ? 'https://' + part.link : part.link;
          return (
            <Text key={i} style={{ color: colors.primary, textDecorationLine: 'underline' }}
              onPress={() => Linking.openURL(url).catch(() => {})}>
              {part.text}
            </Text>
          );
        }
        return <Text key={i}>{part.text}</Text>;
      })}
    </Text>
  );
}


export default function PostDetailScreen({ route, navigation }) {
  const { postUrl, postTitle } = route.params || {};
  const { colors: Colors, isDark } = useTheme();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fullScreenIdx, setFullScreenIdx] = useState(null);

  const closeFullScreen = useCallback(() => { setFullScreenIdx(null); }, []);

  useEffect(() => {
    if (!postUrl) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const blocks = await fetchAndParse(postUrl);
        if (cancelled) return;
        const block = (blocks || []).find(b => b.type === 'post_detail');
        setPost(block || { title: '', paragraphs: [], gallery: [], files: [], date: '' });
      } catch (e) {
        console.warn('[PostDetail] Error:', e.message);
        if (!cancelled) setPost({ title: '', paragraphs: [], gallery: [], files: [], date: '' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [postUrl]);

  const BEACH_PDF_PATTERN = /(sub[_-]?\d+|u[_-]?\d+)/i;

  const handleOpenFile = useCallback(async (file) => {
    const url = file.url;
    if (!url) return;

    if (BEACH_PDF_PATTERN.test(file.name) || BEACH_PDF_PATTERN.test(url)) {
      navigation.push('BeachList', { pdfUrl: url, pdfName: file.name });
      return;
    }

    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) await Linking.openURL(url);
    } catch (e) {
      console.warn('[PostDetail] Error opening file:', e.message);
    }
  }, [navigation]);

  const styles = useMemo(() => StyleSheet.create({
    safe: { flex: 1, backgroundColor: Colors.background },
    header: {
      height: 64,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: Colors.surface,
      borderBottomColor: Colors.border,
      borderBottomWidth: 1,
      paddingHorizontal: 8,
    },
    backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
    headerTitleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      justifyContent: 'center',
      marginRight: 44,
    },
    headerTitle: { fontSize: 16, fontWeight: '900', letterSpacing: -0.5, color: Colors.primary },
    scroll: { flex: 1 },
    loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    heroImage: { width: SCREEN_WIDTH, height: 260, backgroundColor: Colors.background },
    contentWrap: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.xl, paddingBottom: Spacing.xxxl },
    title: { fontSize: 26, fontWeight: '900', color: Colors.textPrimary, lineHeight: 32, letterSpacing: -0.5, marginBottom: Spacing.md },
    dateBar: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.xl },
    dateIcon: { marginRight: 6 },
    dateText: { fontSize: 13, color: Colors.textMuted, fontWeight: '500' },
    featuredBadge: {
      alignSelf: 'flex-start',
      backgroundColor: '#f59e0b',
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: 6,
      marginLeft: Spacing.sm,
    },
    featuredText: { color: '#fff', fontSize: 11, fontWeight: '700' },
    leadText: { fontSize: 17, fontWeight: '600', color: Colors.textSecondary, lineHeight: 28, marginBottom: Spacing.lg },
    bodyText: { fontSize: 15, color: Colors.textPrimary, lineHeight: 26, marginBottom: Spacing.lg },
    bodyDivider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.lg, opacity: 0.5 },
    sectionTitleWrap: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md, marginTop: Spacing.xl },
    sectionIcon: { marginRight: 8 },
    sectionTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
    galleryScroll: { marginBottom: Spacing.xl, marginLeft: Spacing.lg },
    galleryImage: {
      width: 200,
      height: 140,
      borderRadius: 12,
      marginRight: Spacing.sm,
      backgroundColor: Colors.background,
    },
    fileCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: Colors.surface,
      borderRadius: 12,
      padding: Spacing.md,
      marginBottom: Spacing.sm,
      borderWidth: 1,
      borderColor: Colors.border,
    },
    fileIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 10,
      backgroundColor: Colors.primary + '18',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: Spacing.md,
    },
    fileInfo: { flex: 1 },
    fileName: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary, marginBottom: 2 },
    fileMeta: { fontSize: 12, color: Colors.textMuted },
    fileArrow: { marginLeft: Spacing.sm },
    emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
    emptyText: { color: Colors.textMuted, fontSize: 16, fontWeight: '500', textAlign: 'center' },
    emptyIcon: { opacity: 0.3, marginBottom: Spacing.md },
  }), [Colors]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={Colors.background} />
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <MaterialIcons name="arrow-back" size={24} color={Colors.primary} />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle} numberOfLines={1}>{postTitle || ''}</Text>
          </View>
        </View>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!post) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={Colors.background} />
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <MaterialIcons name="arrow-back" size={24} color={Colors.primary} />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle} numberOfLines={1}>Post</Text>
          </View>
        </View>
        <View style={styles.emptyWrap}>
          <MaterialIcons name="article" size={64} color={Colors.textMuted} style={styles.emptyIcon} />
          <Text style={styles.emptyText}>No se pudo cargar la publicación</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={Colors.background} />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <MaterialIcons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle} numberOfLines={1}>{post.title || postTitle || 'Noticia'}</Text>
        </View>
      </View>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {post.image ? (
          <TouchableOpacity activeOpacity={0.9} onPress={() => {
            if (post.gallery?.length > 0) setFullScreenIdx(0);
            else setFullScreenIdx(-1);
          }}>
            <Image source={{ uri: post.image }} style={styles.heroImage} resizeMode="cover" />
          </TouchableOpacity>
        ) : null}
        <View style={styles.contentWrap}>
          <Text style={styles.title}>{post.title}</Text>
          <View style={styles.dateBar}>
            <MaterialIcons name="calendar-today" size={14} color={Colors.textMuted} style={styles.dateIcon} />
            <Text style={styles.dateText}>{post.date || ''}</Text>
            {post.featured ? (
              <View style={styles.featuredBadge}><Text style={styles.featuredText}>DESTACADA</Text></View>
            ) : null}
          </View>
          {post.paragraphs && post.paragraphs.length > 0 ? (
            <View>
              {post.paragraphs.map((p, i) => (
                <Paragraph key={i} text={p} isFirst={i === 0} colors={Colors} leadStyle={styles.leadText} bodyStyle={styles.bodyText} />
              ))}
              <View style={styles.bodyDivider} />
            </View>
          ) : null}
          {post.gallery && post.gallery.length > 0 ? (
            <>
              <View style={styles.sectionTitleWrap}>
                <MaterialIcons name="collections" size={20} color={Colors.primary} style={styles.sectionIcon} />
                <Text style={styles.sectionTitle}>Galería</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.galleryScroll}>
                {post.gallery.map((img, i) => (
                  <TouchableOpacity key={i} activeOpacity={0.8} onPress={() => setFullScreenIdx(i)}>
                    <Image source={{ uri: img }} style={styles.galleryImage} resizeMode="cover" />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          ) : null}
          {post.files && post.files.length > 0 ? (
            <>
              <View style={styles.sectionTitleWrap}>
                <MaterialIcons name="description" size={20} color={Colors.primary} style={styles.sectionIcon} />
                <Text style={styles.sectionTitle}>Documentos</Text>
              </View>
              {post.files.map((f, i) => (
                <TouchableOpacity key={i} style={styles.fileCard} activeOpacity={0.7} onPress={() => handleOpenFile(f)}>
                  <View style={styles.fileIconWrap}>
                    <MaterialIcons name="picture-as-pdf" size={22} color={Colors.primary} />
                  </View>
                  <View style={styles.fileInfo}>
                    <Text style={styles.fileName} numberOfLines={1}>{f.name}</Text>
                    {(f.size || f.date) ? (
                      <Text style={styles.fileMeta}>{[f.size, f.date].filter(Boolean).join(' — ')}</Text>
                    ) : null}
                  </View>
                  <MaterialIcons name="open-in-new" size={18} color={Colors.textMuted} style={styles.fileArrow} />
                </TouchableOpacity>
              ))}
            </>
          ) : null}
        </View>
      </ScrollView>
      <GalleryViewer
        visible={fullScreenIdx !== null}
        images={fullScreenIdx === -1 ? (post?.image ? [post.image] : []) : (post?.gallery || [])}
        initialIndex={fullScreenIdx === -1 ? 0 : (fullScreenIdx >= 0 ? fullScreenIdx : 0)}
        onClose={closeFullScreen}
      />
    </SafeAreaView>
  );
}
