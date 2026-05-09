import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, Image, Linking,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius, spacing, font } from '../constants/theme';
import { READING_LIST, bookshopUrl, amazonUrl } from '../constants/library';

const SECTIONS = [
  { key: 'Primary sources', sub: 'The three core Stoics in their own words.' },
  { key: 'Modern interpreters', sub: 'Contemporary scholars and writers translating the practice.' },
  { key: 'Adjacent thinkers', sub: "Voices the Stoics would have recognized — different traditions, same disciplines." },
  { key: 'Eastern parallel', sub: 'Scriptures from outside the Greco-Roman tradition that arrive at compatible conclusions.' },
];

function BookCard({ book }) {
  return (
    <View style={s.card}>
      <Text style={s.title}>{book.title}</Text>
      <View style={s.byline}>
        <Text style={s.author}>{book.author}</Text>
        {book.translator ? <Text style={s.translator}>· trans. {book.translator}</Text> : null}
      </View>
      <Text style={s.why}>{book.why}</Text>
      <View style={s.linksRow}>
        <TouchableOpacity
          style={s.primaryLink}
          onPress={() => Linking.openURL(bookshopUrl(book.isbn)).catch(() => {})}
          activeOpacity={0.7}
        >
          <Text style={s.primaryLinkText}>View on Bookshop.org →</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={s.secondaryLink}
          onPress={() => Linking.openURL(amazonUrl(book.asin)).catch(() => {})}
          activeOpacity={0.7}
        >
          <Text style={s.secondaryLinkText}>Amazon</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function LibraryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const fromPath = params?.from || '/more';
  const fromLabel = params?.fromLabel || 'More';

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView style={s.scroll} showsVerticalScrollIndicator={true} contentContainerStyle={{ paddingBottom: 60 }}>

        <View style={s.hero}>
          <Image
            source={require('../assets/heroes/library.jpg')}
            style={s.heroImage}
            resizeMode="cover"
          />
          <LinearGradient
            colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.9)', 'rgba(0,0,0,0.95)']}
            locations={[0, 0.3, 0.65, 1]}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={s.heroContent}>
            <TouchableOpacity onPress={() => router.replace(fromPath)} style={s.backRow}>
              <Text style={s.backArrow}>‹</Text>
              <Text style={s.backLabel}>{fromLabel}</Text>
            </TouchableOpacity>
            <Text style={s.eyebrow}>Further reading</Text>
            <Text style={s.heroTitle}>The works behind{'\n'}the practice.</Text>
            <Text style={s.heroSub}>
              A short shelf, hand-curated. Primary sources, modern interpreters, and a few voices from outside the Greco-Roman tradition the Stoics would have recognized.
            </Text>
          </View>
        </View>

        <View style={s.body}>
          {SECTIONS.map(section => {
            const books = READING_LIST.filter(b => b.section === section.key);
            if (!books.length) return null;
            return (
              <View key={section.key} style={s.sectionWrap}>
                <Text style={s.sectionLabel}>{section.key}</Text>
                <Text style={s.sectionSub}>{section.sub}</Text>
                {books.map(b => <BookCard key={b.id} book={b} />)}
              </View>
            );
          })}

          <View style={s.disclosureCard}>
            <Text style={s.disclosureText}>
              Some links here are affiliate links. As an Amazon Associate and a Bookshop.org affiliate, Marcus may earn a small commission when you buy a book through them — at no extra cost to you. This helps keep the practice running.
            </Text>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },

  hero: {
    backgroundColor: colors.bgDeep,
    minHeight: 300,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  heroImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  heroContent: { padding: spacing.xl, paddingTop: 52 },
  backRow: {
    position: 'absolute', top: 12, left: 16, zIndex: 10,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 8,
  },
  backArrow: { fontSize: 22, color: colors.accent, marginTop: -2 },
  backLabel: { fontSize: 12, color: colors.accent, letterSpacing: 0.8, textTransform: 'uppercase' },
  eyebrow: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.accent, textTransform: 'uppercase', marginBottom: 8 },
  heroTitle: { fontSize: font.heroSize, fontWeight: '300', color: colors.textPrimary, letterSpacing: -0.8, marginBottom: 12, lineHeight: 38 },
  heroSub: { fontSize: 15, color: colors.textSecondary, lineHeight: 23 },

  body: { padding: spacing.md, paddingTop: spacing.lg },

  sectionWrap: { marginBottom: 28, marginTop: 18 },
  sectionLabel: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.accent, textTransform: 'uppercase', marginBottom: 6, paddingHorizontal: 4 },
  sectionSub: { fontSize: 14, color: colors.textMuted, lineHeight: 22, marginBottom: 14, paddingHorizontal: 4 },

  card: {
    borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.lg,
    backgroundColor: colors.bgCard, marginBottom: 14, padding: 18,
  },
  title: { fontSize: 19, color: colors.textPrimary, fontFamily: font.serif, marginBottom: 4, lineHeight: 26 },
  byline: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', marginBottom: 12 },
  author: { fontSize: 12, color: colors.accent, letterSpacing: 1, textTransform: 'uppercase', marginRight: 4 },
  translator: { fontSize: 12, color: colors.textDim, fontStyle: 'italic' },
  why: { fontSize: 14, color: colors.textSecondary, lineHeight: 22, marginBottom: 16 },

  linksRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  primaryLink: {
    borderWidth: 0.5, borderColor: colors.accentDim, borderRadius: radius.md,
    paddingVertical: 10, paddingHorizontal: 14,
    backgroundColor: colors.accentBg,
  },
  primaryLinkText: { fontSize: 12, color: colors.accent, fontWeight: '500', letterSpacing: 0.8, textTransform: 'uppercase' },
  secondaryLink: {
    paddingVertical: 10, paddingHorizontal: 4,
  },
  secondaryLinkText: { fontSize: 12, color: colors.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' },

  disclosureCard: {
    borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.lg,
    padding: 16, marginTop: 18, marginBottom: 12,
    backgroundColor: colors.bgElevated,
  },
  disclosureText: { fontSize: 12, color: colors.textDim, lineHeight: 19, fontStyle: 'italic' },
});
