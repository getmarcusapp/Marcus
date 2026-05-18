import React, { useRef, useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, SafeAreaView, Image, Linking,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius, spacing, font } from '../constants/theme';
import { READING_LIST, bookshopUrl, amazonUrl } from '../constants/library';
import { useMiniPlayerInset } from '../components/MiniMeditationPlayer';
import { ScreenHeader } from '../components/ScreenHeader';

const SECTIONS = [
  { key: 'Primary sources',     short: 'Primary',    sub: 'The three core Stoics in their own words, plus Cicero and Musonius.' },
  { key: 'Modern interpreters', short: 'Modern',     sub: 'Contemporary scholars and writers translating the practice.' },
  { key: 'Adjacent thinkers',   short: 'Adjacent',   sub: 'Voices the Stoics would have recognized — different traditions, same disciplines.' },
  { key: 'Eastern parallel',    short: 'Eastern',    sub: 'Scriptures from outside the Greco-Roman tradition that arrive at compatible conclusions.' },
];

// Sticky nav band height. Used to offset scrollTo so the section
// label lands below the chips, not under them.
const STICKY_NAV_HEIGHT = 60;

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

  const scrollRef = useRef(null);
  const playerInset = useMiniPlayerInset();
  const [searchQ, setSearchQ] = useState('');
  const [sortMode, setSortMode] = useState('section'); // 'section' | 'title'
  // null = show all sections; otherwise narrow to one section.key
  const [sectionFilter, setSectionFilter] = useState(null);

  // Apply search + optional section filter. Search matches title, author,
  // translator, and the "why" body so users can find books by description,
  // not just title.
  const filteredBooks = useMemo(() => {
    const q = searchQ.trim().toLowerCase();
    return READING_LIST.filter(b => {
      if (sectionFilter && b.section !== sectionFilter) return false;
      if (!q) return true;
      const hay = [b.title, b.author, b.translator || '', b.why].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [searchQ, sectionFilter]);

  // Per-section counts respect the search query but ignore the active
  // section filter — so each chip shows how many books exist in that
  // section after search, regardless of which is selected.
  const sectionCounts = useMemo(() => {
    const q = searchQ.trim().toLowerCase();
    const counts = {};
    for (const section of SECTIONS) {
      counts[section.key] = READING_LIST.filter(b => {
        if (b.section !== section.key) return false;
        if (!q) return true;
        const hay = [b.title, b.author, b.translator || '', b.why].join(' ').toLowerCase();
        return hay.includes(q);
      }).length;
    }
    return counts;
  }, [searchQ]);

  const totalForSearch = useMemo(() => {
    const q = searchQ.trim().toLowerCase();
    if (!q) return READING_LIST.length;
    return READING_LIST.filter(b => {
      const hay = [b.title, b.author, b.translator || '', b.why].join(' ').toLowerCase();
      return hay.includes(q);
    }).length;
  }, [searchQ]);

  const flatSorted = useMemo(() => {
    return [...filteredBooks].sort((a, b) => a.title.localeCompare(b.title));
  }, [filteredBooks]);

  return (
    <SafeAreaView style={s.safe}>
      <ScreenHeader fromPath={fromPath} fromLabel={fromLabel} />
      <ScrollView
        ref={scrollRef}
        style={[s.scroll, { backgroundColor: colors.bgCard }]}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: playerInset }}
        stickyHeaderIndices={sortMode === 'section' && !searchQ.trim() ? [2] : []}
      >

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
            <Text style={s.eyebrow}>Further reading</Text>
            <Text style={s.heroTitle}>The works behind{'\n'}the practice</Text>
            <Text style={s.heroSub}>
              A short shelf, hand-curated. Primary sources, modern interpreters, and a few voices from outside the Greco-Roman tradition the Stoics would have recognized.
            </Text>
          </View>
        </View>

        {/* Search + sort row (non-sticky) */}
        <View style={s.controlsWrap}>
          <TextInput
            style={s.searchInput}
            placeholder="Search by title, author, or theme..."
            placeholderTextColor={colors.textDim}
            value={searchQ}
            onChangeText={setSearchQ}
            clearButtonMode="while-editing"
            autoCorrect={false}
          />
          <View style={s.sortRow}>
            <TouchableOpacity
              style={[s.sortBtn, sortMode === 'section' && s.sortBtnActive]}
              onPress={() => setSortMode('section')}
              activeOpacity={0.7}
            >
              <Text style={[s.sortBtnText, sortMode === 'section' && s.sortBtnTextActive]}>By section</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.sortBtn, sortMode === 'title' && s.sortBtnActive]}
              onPress={() => setSortMode('title')}
              activeOpacity={0.7}
            >
              <Text style={[s.sortBtnText, sortMode === 'title' && s.sortBtnTextActive]}>A–Z</Text>
            </TouchableOpacity>
            {searchQ.trim().length > 0 && (
              <Text style={s.resultCount}>{filteredBooks.length} of {READING_LIST.length}</Text>
            )}
          </View>
        </View>

        {/* Sticky filter pills — "All" plus a chip per section. Tapping
            narrows the body to that section; tapping again clears. */}
        <View style={s.chipsWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
          >
            <TouchableOpacity
              style={[s.chip, !sectionFilter && s.chipActive]}
              onPress={() => setSectionFilter(null)}
              activeOpacity={0.7}
            >
              <Text style={[s.chipText, !sectionFilter && s.chipTextActive]}>
                All
                <Text style={[s.chipCount, !sectionFilter && s.chipCountActive]}> · {totalForSearch}</Text>
              </Text>
            </TouchableOpacity>
            {SECTIONS.map(section => {
              const count = sectionCounts[section.key];
              const active = sectionFilter === section.key;
              return (
                <TouchableOpacity
                  key={section.key}
                  style={[s.chip, active && s.chipActive]}
                  onPress={() => setSectionFilter(active ? null : section.key)}
                  activeOpacity={0.7}
                  disabled={count === 0}
                >
                  <Text style={[s.chipText, active && s.chipTextActive, count === 0 && s.chipTextDim]}>
                    {section.short}
                    <Text style={[s.chipCount, active && s.chipCountActive]}> · {count}</Text>
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Body */}
        {sortMode === 'title' || searchQ.trim() ? (
          <View style={s.body}>
            {(sortMode === 'title' ? flatSorted : filteredBooks).length === 0 ? (
              <View style={s.empty}>
                <Text style={s.emptyTitle}>Nothing matches your search.</Text>
                <Text style={s.emptyText}>Try a different title, author, or theme.</Text>
              </View>
            ) : (
              (sortMode === 'title' ? flatSorted : filteredBooks).map(b => (
                <BookCard key={b.id} book={b} />
              ))
            )}
          </View>
        ) : (
          <View style={s.body}>
            {SECTIONS.map(section => {
              if (sectionFilter && section.key !== sectionFilter) return null;
              const books = filteredBooks.filter(b => b.section === section.key);
              if (!books.length) return null;
              return (
                <View key={section.key} style={s.sectionWrap}>
                  <Text style={s.sectionLabel}>{section.key}</Text>
                  <Text style={s.sectionSub}>{section.sub}</Text>
                  {books.map(b => <BookCard key={b.id} book={b} />)}
                </View>
              );
            })}
          </View>
        )}

        <View style={s.disclosureCard}>
          <Text style={s.disclosureText}>
            Some links here are affiliate links. As an Amazon Associate and a Bookshop.org affiliate, Marcus may earn a small commission when you buy a book through them, at no extra cost to you. This helps keep the practice running.
          </Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgDeep },
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
  eyebrow: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.accent, fontFamily: font.bodyMedium, textTransform: 'uppercase', marginBottom: 8 },
  heroTitle: { fontSize: font.heroSize, fontFamily: font.display, color: colors.textPrimary, letterSpacing: -0.8, marginBottom: 12, lineHeight: 38 },
  heroSub: { fontSize: 15, color: colors.textSecondary, lineHeight: 23 },

  // Search + sort
  controlsWrap: {
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6,
    backgroundColor: colors.bg,
    borderBottomWidth: 0.5, borderBottomColor: colors.border,
  },
  searchInput: {
    backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.borderMid,
    borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 15, color: colors.textPrimary,
  },
  sortRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 10, paddingBottom: 4 },
  sortBtn: {
    borderWidth: 0.5, borderColor: colors.border, borderRadius: 16,
    paddingHorizontal: 12, paddingVertical: 5,
    backgroundColor: colors.bgCard,
  },
  sortBtnActive: { borderColor: colors.accent, backgroundColor: colors.accentBg },
  sortBtnText: { fontSize: 12, color: colors.textMuted, letterSpacing: 0.3 },
  sortBtnTextActive: { color: colors.accent, fontFamily: font.bodyMedium },
  resultCount: { fontSize: 12, color: colors.textDim, marginLeft: 'auto' },

  // Sticky section chips
  chipsWrap: {
    backgroundColor: colors.bg,
    borderBottomWidth: 0.5, borderBottomColor: colors.border,
    paddingVertical: 10,
    minHeight: STICKY_NAV_HEIGHT,
    justifyContent: 'center',
  },
  chip: {
    borderWidth: 0.5, borderColor: colors.borderMid, borderRadius: 18,
    paddingHorizontal: 14, paddingVertical: 6,
    backgroundColor: colors.bgCard,
  },
  // Active filter pill — gold border + tinted bg + gold text (matches the
  // archive filter pill pattern in read-archive / emotions-history).
  chipActive: { borderColor: colors.accent, backgroundColor: colors.accentBg },
  chipText: { fontSize: 13, color: colors.textSecondary, letterSpacing: 0.3, fontFamily: font.bodyMedium },
  chipTextActive: { color: colors.accent },
  chipTextDim: { color: colors.textDim },
  chipCount: { fontSize: 12, color: colors.textDim, fontWeight: '400' },
  chipCountActive: { color: colors.accentDim },

  body: { padding: spacing.md, paddingTop: spacing.lg },

  sectionWrap: { marginBottom: 28, marginTop: 18 },
  sectionLabel: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.accent, fontFamily: font.bodyMedium, textTransform: 'uppercase', marginBottom: 6, paddingHorizontal: 4 },
  sectionSub: { fontSize: 14, color: colors.textMuted, lineHeight: 22, marginBottom: 14, paddingHorizontal: 4 },

  card: {
    borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.lg,
    backgroundColor: colors.bgCard, marginBottom: 14, padding: 18,
  },
  title: { fontSize: 19, color: colors.textPrimary, fontFamily: font.serif, marginBottom: 4, lineHeight: 26 },
  byline: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', marginBottom: 12 },
  author: { fontSize: 12, color: colors.accent, letterSpacing: 1, fontFamily: font.bodyMedium, textTransform: 'uppercase', marginRight: 4 },
  translator: { fontSize: 12, color: colors.textDim, fontStyle: 'italic' },
  why: { fontSize: 14, color: colors.textSecondary, lineHeight: 22, marginBottom: 16 },

  linksRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  primaryLink: {
    borderWidth: 0.5, borderColor: colors.accentDim, borderRadius: radius.md,
    paddingVertical: 10, paddingHorizontal: 14,
    backgroundColor: colors.accentBg,
  },
  primaryLinkText: { fontSize: 12, color: colors.accent, fontFamily: font.bodyMedium, letterSpacing: 0.8, textTransform: 'uppercase' },
  secondaryLink: {
    paddingVertical: 10, paddingHorizontal: 4,
  },
  secondaryLinkText: { fontSize: 12, color: colors.textMuted, letterSpacing: 0.5, fontFamily: font.bodyMedium, textTransform: 'uppercase' },

  empty: { padding: 40, alignItems: 'center' },
  emptyTitle: { fontSize: 18, color: colors.textSecondary, fontFamily: font.serif, marginBottom: 12, textAlign: 'center' },
  emptyText: { fontSize: 14, color: colors.textMuted, lineHeight: 22, textAlign: 'center' },

  disclosureCard: {
    borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.lg,
    padding: 16, marginHorizontal: spacing.md, marginTop: 18, marginBottom: 12,
    backgroundColor: colors.bgElevated,
  },
  disclosureText: { fontSize: 12, color: colors.textDim, lineHeight: 19, fontStyle: 'italic' },
});
