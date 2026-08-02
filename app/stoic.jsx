import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, Image, Linking,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, font } from '../constants/theme';
import { getStoic } from '../constants/stoics';
import { READING_LIST, bookshopUrl } from '../constants/library';
import { useMiniPlayerInset } from '../components/MiniMeditationPlayer';
import { ScreenHeader } from '../components/ScreenHeader';
import { BookCover } from '../components/BookCover';

// The cover row is the only real colour on this screen, which is otherwise
// marble and type. BookCover handles the missing-cover fallback; this wraps it
// with the title, author and the Bookshop link.
function BookCoverCard({ book }) {
  return (
    <TouchableOpacity
      style={s.coverCard}
      onPress={() => Linking.openURL(bookshopUrl(book.isbn)).catch(() => {})}
      activeOpacity={0.85}
    >
      <BookCover book={book} width={116} />
      <Text style={s.coverTitle} numberOfLines={2}>{book.title}</Text>
      <Text style={s.coverAuthor} numberOfLines={1}>{book.author}</Text>
    </TouchableOpacity>
  );
}

function Section({ label, children }) {
  return (
    <View style={s.block}>
      <Text style={s.secLabel}>{label}</Text>
      {children}
    </View>
  );
}

export default function StoicDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const playerInset = useMiniPlayerInset();
  const stoic = getStoic(params?.id);
  const fromPath = params?.from || '/stoics';
  const fromLabel = params?.fromLabel || 'The Stoics';

  if (!stoic) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <ScreenHeader fromPath={fromPath} fromLabel={fromLabel} />
        <View style={s.missing}>
          <Text style={s.missingText}>That entry could not be found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const books = stoic.bookIds
    .map(id => READING_LIST.find(b => b.id === id))
    .filter(Boolean);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScreenHeader fromPath={fromPath} fromLabel={fromLabel} />
      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: playerInset + 40 }}
      >
        {/* Hero. Where no likeness survives the name is set in Cinzel instead
            of borrowing a face, and the note beneath says why. */}
        <View style={s.hero}>
          {stoic.image ? (
            <>
              <Image source={stoic.image} style={s.heroImage} resizeMode="cover" />
              <LinearGradient
                colors={['rgba(0,0,0,0.25)', 'rgba(0,0,0,0.15)', 'rgba(10,10,10,0.95)']}
                locations={[0, 0.45, 1]}
                style={StyleSheet.absoluteFillObject}
              />
            </>
          ) : (
            <View style={s.heroInscription}>
              <Text style={s.heroInscriptionText}>{stoic.name}</Text>
            </View>
          )}
          <View style={s.heroContent}>
            <Text style={s.heroName}>{stoic.name}</Text>
            <Text style={s.heroMeta}>{stoic.role} · {stoic.dates}</Text>
          </View>
        </View>

        <Text style={s.imageNote}>{stoic.imageNote}</Text>

        <View style={s.body}>
          <Text style={s.summary}>{stoic.summary}</Text>

          <Section label="Life">
            {stoic.life.split('\n\n').map((para, i) => (
              <Text key={i} style={[s.para, i > 0 && { marginTop: 14 }]}>{para}</Text>
            ))}
          </Section>

          <Section label="What they taught">
            {/* Deliberately unquoted. This is a plain statement of the idea, not
                their words — see the note in constants/stoics.js. */}
            <Text style={s.teaching}>{stoic.teaching}</Text>
          </Section>

          <Section label="Works">
            <View style={s.chipRow}>
              {stoic.works.map(w => (
                <View key={w} style={s.chip}>
                  <Text style={s.chipText}>{w}</Text>
                </View>
              ))}
            </View>
          </Section>

          <Section label="Who this is for">
            <Text style={s.para}>{stoic.forWhom}</Text>
          </Section>

          {books.length > 0 && (
            <Section label={books.length === 1 ? 'Where to read' : 'Where to start'}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.coverRow}
              >
                {books.map(book => <BookCoverCard key={book.id} book={book} />)}
              </ScrollView>
              <Text style={s.disclosure}>
                These are affiliate links. As a Bookshop.org affiliate, Marcus may earn
                a small commission when you buy a book through them, at no extra cost
                to you. Bookshop.org supports independent bookshops.
              </Text>
            </Section>
          )}

          <TouchableOpacity
            style={s.wiki}
            onPress={() => Linking.openURL(stoic.wikipedia).catch(() => {})}
            activeOpacity={0.7}
          >
            <Text style={s.wikiText}>Read more on Wikipedia</Text>
            <Ionicons name="open-outline" size={15} color={colors.accent} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgDeep },
  scroll: { flex: 1 },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  missingText: { fontSize: 15, color: colors.textSecondary, fontFamily: font.body },

  hero: { height: 380, backgroundColor: '#000', justifyContent: 'flex-end' },
  heroImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  heroInscription: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  heroInscriptionText: {
    fontFamily: font.display, fontSize: 34, lineHeight: 44,
    color: colors.accentDim, textAlign: 'center', letterSpacing: 1,
  },
  heroContent: { padding: spacing.md, paddingBottom: 18 },
  heroName: {
    fontSize: font.titleSize, fontFamily: font.display, color: colors.textPrimary,
    letterSpacing: -0.5, marginBottom: 6,
  },
  heroMeta: {
    fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.accent,
    fontFamily: font.bodyMedium, textTransform: 'uppercase',
  },
  imageNote: {
    fontSize: 12, lineHeight: 18, color: colors.textSecondary, fontStyle: 'italic',
    paddingHorizontal: spacing.md, paddingTop: 10,
  },

  body: { padding: spacing.md, paddingTop: 18 },
  summary: {
    fontSize: 17, lineHeight: 26, color: colors.textPrimary, fontFamily: font.body,
    marginBottom: 6,
  },
  block: { marginTop: 28 },
  secLabel: {
    fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.accent,
    fontFamily: font.bodyMedium, textTransform: 'uppercase', marginBottom: 12,
  },
  para: { fontSize: 16, lineHeight: 26, color: colors.textSecondary, fontFamily: font.body },
  // The app's unified contemplative voice, 20/30 Light Italic.
  teaching: {
    fontSize: 20, lineHeight: 30, color: colors.textPrimary,
    fontFamily: font.bodyLightItalic, fontStyle: 'italic',
  },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.pill,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  chipText: { fontSize: 13, color: colors.textSecondary, fontFamily: font.body },

  coverRow: { gap: 14, paddingRight: 16, paddingBottom: 4 },
  coverCard: { width: 116 },
  coverTitle: { fontSize: 13, lineHeight: 18, fontFamily: font.bodySemiBold, color: colors.textPrimary, marginTop: 10, marginBottom: 2 },
  coverAuthor: { fontSize: 12, color: colors.textSecondary, fontFamily: font.body },
  disclosure: { fontSize: 12, lineHeight: 19, color: colors.textSecondary, fontFamily: font.body, marginTop: 16 },

  wiki: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 34, paddingVertical: 16,
    borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.md,
  },
  wikiText: { fontSize: 15, color: colors.accent, fontFamily: font.bodyMedium },
});
