import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, Image,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius, spacing, font } from '../constants/theme';
import { virtues } from '../constants/virtues';
import { MEDITATIONS_LIST } from '../lib/meditationPlayer';

// Per-image attribution + reasoning, mirrors the Notion gallery doc.
// Keys match meditation IDs and virtue IDs; hero entries are listed
// separately under HERO_ENTRIES.
const MEDITATION_NOTES = {
  'view-from-above': {
    artist: 'Caspar David Friedrich',
    work: 'Wanderer above the Sea of Fog (1818)',
    why: 'The single most iconic image of the sublime perspective. A figure standing on a peak looking down at a sea of cloud — exactly the cosmic-zoom move the meditation asks. Marcus Aurelius wrote the same imagery in Meditations 1700 years before Friedrich painted it.',
  },
  'premeditatio': {
    artist: 'Roman sculpture',
    work: 'Bust of Marcus Aurelius (Capitoline Museums, Rome)',
    why: 'Marcus Aurelius literally practiced premeditatio malorum every morning — documented in Meditations II.1. Showing the man himself on the meditation he taught feels right rather than circular.',
  },
  'evening-examination': {
    artist: 'Caravaggio',
    work: 'Saint Jerome Writing (1605–6, Borghese)',
    why: 'Old man, candlelight, writing at his desk, skull on the table — practically a literal visual of the Stoic evening examen. Caravaggio\'s chiaroscuro keeps it focused: just the act of writing, the truth, and the reminder of mortality.',
  },
  'negative-visualization': {
    artist: 'Philippe de Champaigne',
    work: 'Vanitas (Still Life with a Skull) (1671)',
    why: 'A vanitas with three objects: tulip (life, beauty), skull (death), hourglass (time). The whole genre exists to teach negative visualization — what you have will be lost, therefore see it now. Champaigne\'s composition is the cleanest version; nothing extra.',
  },
  'present-moment': {
    artist: 'Francisco de Zurbarán',
    work: 'Cup of Water and a Rose on a Silver Plate (c. 1630)',
    why: 'Zurbarán painted everyday objects with the kind of attention monks brought to prayer. A glass of water, a rose, a silver plate — that\'s the entire painting. The attention given to these small things is the meditation.',
  },
};

const VIRTUE_NOTES = {
  wisdom: {
    artist: 'Roman, after Greek original',
    work: 'Marble head of Athena (Met Museum)',
    why: 'Athena is the goddess of wisdom in the Greek tradition. A marble bust is the most direct, least metaphorical way to render the abstraction.',
  },
  courage: {
    artist: 'Caravaggio',
    work: 'David with the Head of Goliath (1610, Borghese)',
    why: 'Caravaggio\'s David doesn\'t look triumphant — he looks pensive, almost mournful, as if the act cost him. That\'s the right note for Stoic courage: not bravado, but the willingness to act rightly even when it is costly. He painted Goliath\'s head as a self-portrait while dying.',
  },
  moderation: {
    artist: 'Piero del Pollaiolo',
    work: 'Temperance (1469–72, Uffizi)',
    why: 'The personification holds two vessels, pouring water from one into the other — the classical iconography of temperance: dilution, moderation, the disciplined middle path.',
  },
  justice: {
    artist: 'Maerten van Heemskerck',
    work: 'Iustitia (16th century)',
    why: 'Heemskerck\'s Justitia is the iconic blindfolded figure with sword and scales. Less ornate than later Baroque versions; the simplicity helps it hold its own. Northern Renaissance, austere — fits the restrained register.',
  },
};

const HERO_ENTRIES = [
  {
    image: require('../assets/heroes/journal-morning.jpg'),
    title: 'Morning Journal',
    artist: 'Rembrandt van Rijn',
    work: 'The Philosopher in Meditation (1632)',
    why: 'Old man in his study, morning light through a window, deep in reflection. Quintessential morning-practice imagery: stillness, light, intention before the day begins.',
  },
  {
    image: require('../assets/heroes/journal-evening.jpg'),
    title: 'Evening Journal',
    artist: 'Georges de La Tour',
    work: 'The Penitent Magdalen (c. 1640, Met)',
    why: 'Single candle, deep examination, dark — exactly the register of the evening examen. Different from the Caravaggio used for the Evening Examination meditation so the screens don\'t visually fight.',
  },
  {
    image: require('../assets/heroes/emotions.jpg'),
    title: 'Emotional Mastery',
    artist: 'Caravaggio',
    work: 'Narcissus (1597–99)',
    why: 'Emotional logging is self-examination through reflection. Narcissus looks into the water and meets himself — the visual metaphor for the space between stimulus and response.',
  },
  {
    image: require('../assets/heroes/read.jpg'),
    title: 'Daily Reading',
    artist: 'Rembrandt van Rijn',
    work: 'Aristotle with a Bust of Homer (1653, Met)',
    why: 'A philosopher in modern dress drawing wisdom from a bust of an ancient. That\'s the daily reading metaphor exactly — the user, in their own present moment, encountering ancient Stoic wisdom curated for today.',
  },
  {
    image: require('../assets/heroes/compass.jpg'),
    title: 'Stoic Compass',
    artist: 'Johannes Vermeer',
    work: 'The Astronomer (1668)',
    why: 'The Stoic Compass is "your North Star." Vermeer\'s astronomer is literally examining a celestial globe — a man orienting himself against the fixed points of the universe.',
  },
  {
    image: require('../assets/heroes/review.jpg'),
    title: 'Weekly Review',
    artist: 'Caspar David Friedrich',
    work: 'Two Men Contemplating the Moon (1819–20)',
    why: 'The Weekly Review is the Sunday reckoning — looking back at the week, examining what was done. Two figures standing in solitude under the moon, contemplating together, is the visual exact of that practice.',
  },
];

function GalleryEntry({ image, title, artist, work, why }) {
  return (
    <View style={s.card}>
      <View style={s.imageWrap}>
        <Image source={image} style={s.image} resizeMode="cover" />
      </View>
      <View style={s.cardBody}>
        {title && <Text style={s.cardEyebrow}>{title}</Text>}
        <Text style={s.work}>{work}</Text>
        <Text style={s.artist}>{artist}</Text>
        <Text style={s.why}>{why}</Text>
      </View>
    </View>
  );
}

function SectionHeader({ eyebrow, title, sub }) {
  return (
    <View style={s.sectionHeader}>
      <Text style={s.sectionEyebrow}>{eyebrow}</Text>
      <Text style={s.sectionTitle}>{title}</Text>
      {sub && <Text style={s.sectionSub}>{sub}</Text>}
    </View>
  );
}

export default function ImageryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const fromPath = params?.from || '/more';
  const fromLabel = params?.fromLabel || 'More';

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>

        <View style={s.hero}>
          <Image
            source={require('../assets/heroes/review.jpg')}
            style={s.heroImage}
            resizeMode="cover"
          />
          <LinearGradient
            colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.92)']}
            locations={[0, 0.5, 1]}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={s.heroContent}>
            <TouchableOpacity onPress={() => router.replace(fromPath)} style={s.backRow}>
              <Text style={s.backArrow}>‹</Text>
              <Text style={s.backLabel}>{fromLabel}</Text>
            </TouchableOpacity>
            <Text style={s.eyebrow}>The artwork</Text>
            <Text style={s.title}>The classical{'\n'}imagery in Marcus.</Text>
            <Text style={s.sub}>
              Every painting and sculpture in the app, where it lives, and why it was chosen. All public-domain works from the Met, the Borghese, the Uffizi, the Capitoline Museums, and beyond.
            </Text>
          </View>
        </View>

        <View style={s.body}>
          <SectionHeader
            eyebrow="Heroes"
            title="One painting per screen"
            sub="The hero band at the top of each major surface."
          />
          {HERO_ENTRIES.map((entry, idx) => (
            <GalleryEntry key={idx} {...entry} />
          ))}

          <SectionHeader
            eyebrow="The four virtues"
            title="One artwork per virtue"
            sub="Wisdom, Courage, Temperance, Justice — rotates daily on the practice screen."
          />
          {virtues.map(v => {
            const note = VIRTUE_NOTES[v.id];
            return (
              <GalleryEntry
                key={v.id}
                image={v.image}
                title={v.name}
                artist={note.artist}
                work={note.work}
                why={note.why}
              />
            );
          })}

          <SectionHeader
            eyebrow="The five meditations"
            title="One artwork per meditation"
            sub="Surfaced contextually based on the time of day."
          />
          {MEDITATIONS_LIST.map(m => {
            const note = MEDITATION_NOTES[m.id];
            return (
              <GalleryEntry
                key={m.id}
                image={m.image}
                title={m.title}
                artist={note.artist}
                work={note.work}
                why={note.why}
              />
            );
          })}

          <View style={s.footerNote}>
            <Text style={s.footerNoteText}>
              All images sourced from Wikimedia Commons and museum open-access programs. Cropped tight and unified with a dark gradient overlay so the set holds together visually across Greek sculpture, Spanish baroque, Dutch chiaroscuro, German Romantic, Renaissance allegory, and Roman portraiture.
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
    minHeight: 320,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  heroImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  heroContent: { padding: spacing.xl, paddingTop: 36 },
  backRow: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 18,
  },
  backArrow: { fontSize: 22, color: colors.accent, marginTop: -2 },
  backLabel: { fontSize: 12, color: colors.accent, letterSpacing: 0.8, textTransform: 'uppercase' },
  eyebrow: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.accent, textTransform: 'uppercase', marginBottom: 8 },
  title: { fontSize: font.heroSize, fontWeight: '300', color: colors.textPrimary, letterSpacing: -0.8, marginBottom: 10, lineHeight: 38 },
  sub: { fontSize: 15, color: colors.textSecondary, lineHeight: 23 },

  body: { padding: spacing.md, paddingTop: spacing.lg },

  sectionHeader: { paddingHorizontal: 6, paddingTop: 12, paddingBottom: 18, marginTop: 18 },
  sectionEyebrow: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.accent, textTransform: 'uppercase', marginBottom: 8 },
  sectionTitle: { fontSize: 22, fontWeight: '300', color: colors.textPrimary, letterSpacing: -0.5, marginBottom: 6 },
  sectionSub: { fontSize: 14, color: colors.textMuted, lineHeight: 21 },

  card: {
    borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.lg,
    backgroundColor: colors.bgCard, marginBottom: 14, overflow: 'hidden',
  },
  imageWrap: { width: '100%', height: 180, backgroundColor: '#000', overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  cardBody: { padding: 18 },
  cardEyebrow: { fontSize: font.microSize, letterSpacing: 2, color: colors.accent, textTransform: 'uppercase', marginBottom: 6 },
  work: { fontSize: 17, fontWeight: '400', color: colors.textPrimary, fontFamily: font.serif, marginBottom: 4, lineHeight: 24 },
  artist: { fontSize: 12, color: colors.textMuted, letterSpacing: 0.5, marginBottom: 12, textTransform: 'uppercase' },
  why: { fontSize: 14, color: colors.textSecondary, lineHeight: 22 },

  footerNote: {
    borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.lg,
    padding: 18, marginTop: 22, marginBottom: 12, backgroundColor: colors.bgElevated,
  },
  footerNoteText: { fontSize: 13, color: colors.textMuted, lineHeight: 21, fontFamily: font.serif },
});
