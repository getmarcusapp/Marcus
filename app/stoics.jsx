import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, Image,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius, spacing, font } from '../constants/theme';
import { STOICS_BY_SECTION } from '../constants/stoics';
import { READING_LIST } from '../constants/library';
import { useMiniPlayerInset } from '../components/MiniMeditationPlayer';
import { ScreenHeader } from '../components/ScreenHeader';

// Strict left/right alternation, NOT height-balanced masonry.
//
// The list is chronological and the sequence is the point: it shows the school
// moving from the Greek founders through republican Rome to the empire. A
// balancing algorithm assigns each card to whichever column is currently
// shorter, which scrambles that order into something unreadable. Alternating
// means the grid reads in rows, left to right, exactly as the data is ordered.
//
// This costs nothing here because every card is the same height: the portrait
// well is a fixed aspectRatio, so the only variation is whether a name wraps to
// a second line.
function splitColumns(items) {
  const cols = [[], []];
  items.forEach((item, i) => cols[i % 2].push(item));
  return cols;
}

function StoicCard({ stoic, onPress }) {
  const bookCount = stoic.bookIds.filter(id => READING_LIST.some(b => b.id === id)).length;
  return (
    <TouchableOpacity style={s.card} onPress={onPress} activeOpacity={0.85}>
      {stoic.image ? (
        <View style={s.imageWrap}>
          <Image source={stoic.image} style={s.image} resizeMode="cover" />
          <LinearGradient
            colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.55)']}
            style={StyleSheet.absoluteFillObject}
          />
        </View>
      ) : (
        // No likeness of this person survives. Rather than borrow someone
        // else's face or invent one, the card carries the name in Cinzel —
        // Roman inscriptional capitals, which is how these names were
        // actually cut in stone.
        <View style={[s.imageWrap, s.inscription]}>
          <Text style={s.inscriptionText} numberOfLines={3} adjustsFontSizeToFit minimumFontScale={0.6}>
            {stoic.name}
          </Text>
        </View>
      )}
      <Text style={s.name}>{stoic.name}</Text>
      <Text style={s.meta}>{stoic.role} · {stoic.dates}</Text>
      {bookCount > 0 && (
        <Text style={s.books}>{bookCount} {bookCount === 1 ? 'book' : 'books'}</Text>
      )}
    </TouchableOpacity>
  );
}

export default function StoicsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const fromPath = params?.from || '/more';
  const fromLabel = params?.fromLabel || 'More';
  const playerInset = useMiniPlayerInset();

  const open = id => router.push(`/stoic?id=${id}&from=/stoics&fromLabel=The Stoics`);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScreenHeader fromPath={fromPath} fromLabel={fromLabel} />
      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: playerInset + 36 }}
      >
        <View style={s.hero}>
          <Text style={s.eyebrow}>The Stoics</Text>
          <Text style={s.title}>Who they were,{'\n'}and what to read.</Text>
          <Text style={s.sub}>
            The voices behind the daily practice, and the sources we know them through.
          </Text>
        </View>

        {STOICS_BY_SECTION.map(group => {
          const [left, right] = splitColumns(group.items);
          return (
            <View key={group.section} style={s.section}>
              <Text style={s.secLabel}>{group.section}</Text>
              <View style={s.grid}>
                <View style={s.col}>
                  {left.map(st => <StoicCard key={st.id} stoic={st} onPress={() => open(st.id)} />)}
                </View>
                <View style={s.col}>
                  {right.map(st => <StoicCard key={st.id} stoic={st} onPress={() => open(st.id)} />)}
                </View>
              </View>
            </View>
          );
        })}

        <View style={s.footerNote}>
          <Text style={s.footerNoteText}>
            Not everyone here was a Stoic. The tradition drew on the Cynics and the
            Pre-Socratics, and much of what we know about the early school reaches us
            through biographers and critics who stood outside it.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const GAP = 12;

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgDeep },
  scroll: { flex: 1 },
  hero: { paddingHorizontal: spacing.md, paddingTop: 12, paddingBottom: 8 },
  eyebrow: {
    fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.accent,
    fontFamily: font.bodyMedium, textTransform: 'uppercase', marginBottom: 10,
  },
  title: {
    fontSize: font.titleSize, fontFamily: font.display, color: colors.textPrimary,
    letterSpacing: -0.5, lineHeight: 34, marginBottom: 10,
  },
  sub: { fontSize: 15, lineHeight: 24, color: colors.textSecondary, fontFamily: font.body },

  section: { paddingHorizontal: spacing.md, marginTop: 26 },
  secLabel: {
    fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.accent,
    fontFamily: font.bodyMedium, textTransform: 'uppercase', marginBottom: 14,
  },
  grid: { flexDirection: 'row', gap: GAP },
  col: { flex: 1, gap: 22 },

  card: {},
  imageWrap: {
    width: '100%',
    aspectRatio: 0.78,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: '#000',
    borderWidth: 0.5,
    borderColor: colors.border,
    marginBottom: 10,
  },
  image: { width: '100%', height: '100%' },
  inscription: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  inscriptionText: {
    fontFamily: font.display,
    fontSize: 20,
    lineHeight: 26,
    color: colors.accentDim,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  name: { fontSize: 16, fontFamily: font.bodySemiBold, color: colors.textPrimary, marginBottom: 3 },
  meta: { fontSize: 12, lineHeight: 17, color: colors.textSecondary, fontFamily: font.body },
  books: { fontSize: 12, color: colors.accentDim, fontFamily: font.bodyMedium, marginTop: 5 },

  footerNote: {
    marginTop: 32, marginHorizontal: spacing.md, padding: 16,
    borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.md,
  },
  footerNoteText: { fontSize: 13, lineHeight: 21, color: colors.textSecondary, fontFamily: font.body },
});
