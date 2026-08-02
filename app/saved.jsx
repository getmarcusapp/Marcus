import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, Alert,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, font } from '../constants/theme';
import { useSavedLines, removeSaved } from '../lib/saved';
import { ReadingShareCard } from '../components/ReadingShareCard';
import { useMiniPlayerInset } from '../components/MiniMeditationPlayer';
import { ScreenHeader } from '../components/ScreenHeader';
import * as haptics from '../lib/haptics';
import { useQuoteShare } from '../lib/useQuoteShare';

const INFO = {
  title: 'Hypomnēmata',
  source: 'Pierre Hadot, Philosophy as a Way of Life',
  body: "The Stoics kept personal notebooks of lines worth rereading. They called them hypomnemata, and the practice was not collection but repetition: you wrote down what you needed to hear because you knew you would need to hear it again.\n\nMeditations is one of these. Marcus was not composing a book. He was copying out the same handful of reminders, year after year, because they kept failing to stick. The repetition is not a flaw in the text. It is the text.\n\nLines you keep here come back to you. Roughly one day in three, the passage on your Practice screen is drawn from this collection rather than from ours.",
};

export default function SavedScreen() {
  const params = useLocalSearchParams();
  const fromPath = params?.from || '/more';
  const fromLabel = params?.fromLabel || 'More';
  const playerInset = useMiniPlayerInset();
  const lines = useSavedLines();
  const [showInfo, setShowInfo] = useState(false);
  const { cardRef: shareCardRef, pending: sharing, shareQuote } = useQuoteShare('saved');

  function handleRemove(line) {
    Alert.alert('Remove this line?', 'It will no longer resurface on your Practice screen.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => { haptics.tap(); removeSaved(line.id); },
      },
    ]);
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScreenHeader fromPath={fromPath} fromLabel={fromLabel} />

      {/* Off-screen share card, mounted only while a share is in flight. */}
      {sharing && (
        <View ref={shareCardRef} collapsable={false} style={s.shareCardOffscreen}>
          <ReadingShareCard quote={sharing.text} author={sharing.author} work={sharing.work} />
        </View>
      )}

      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: playerInset + 36 }}
      >
        <View style={s.hero}>
          <View style={s.eyebrowRow}>
            <Text style={s.eyebrow}>Saved</Text>
            <TouchableOpacity style={s.hintBtn} onPress={() => setShowInfo(v => !v)} hitSlop={10}>
              <Text style={s.hintBtnText}>ⓘ</Text>
            </TouchableOpacity>
          </View>
          <Text style={s.title}>
            {lines.length === 0 ? 'Lines worth keeping.' : `${lines.length} ${lines.length === 1 ? 'line' : 'lines'} kept.`}
          </Text>

          {showInfo && (
            <View style={s.hintBox}>
              <Text style={s.hintTitle}>{INFO.title}</Text>
              <Text style={s.hintSource}>{INFO.source}</Text>
              <View style={s.hintDivider} />
              {INFO.body.split('\n\n').map((p, i) => (
                <Text key={i} style={[s.hintText, i > 0 && { marginTop: 10 }]}>{p}</Text>
              ))}
            </View>
          )}
        </View>

        {lines.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="heart-outline" size={26} color={colors.accentDim} />
            <Text style={s.emptyTitle}>Nothing kept yet</Text>
            <Text style={s.emptyBody}>
              Tap the heart beside a passage on your Practice screen or in the daily reading,
              and it lands here.{'\n\n'}
              The Stoics kept notebooks of lines they needed to hear again. Meditations is one
              of them. Once you have kept a few, they start coming back to you: roughly one day
              in three, the passage on your Practice screen is drawn from this collection
              instead of ours.
            </Text>
          </View>
        ) : (
          <View style={s.list}>
            {lines.map(line => (
              <View key={line.id} style={s.card}>
                <Text style={s.quote}>{line.text}</Text>
                {(line.author || line.work) && (
                  <Text style={s.attr}>
                    {[line.author, line.work].filter(Boolean).join(', ')}
                  </Text>
                )}
                <View style={s.actions}>
                  <TouchableOpacity style={s.action} onPress={() => shareQuote({ text: line.text, author: line.author, work: line.work })} activeOpacity={0.7}>
                    <Ionicons name="arrow-redo-outline" size={16} color={colors.accent} />
                    <Text style={s.actionText}>Share</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.action} onPress={() => handleRemove(line)} activeOpacity={0.7}>
                    <Ionicons name="heart-dislike-outline" size={16} color={colors.textSecondary} />
                    <Text style={[s.actionText, { color: colors.textSecondary }]}>Remove</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgDeep },
  scroll: { flex: 1 },
  // Far off-screen so captureRef can reach a laid-out card the user never sees.
  shareCardOffscreen: { position: 'absolute', left: -9999, top: -9999 },

  hero: { paddingHorizontal: spacing.md, paddingTop: 12, paddingBottom: 4 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  eyebrow: {
    fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.accent,
    fontFamily: font.bodyMedium, textTransform: 'uppercase',
  },
  hintBtn: { padding: 4 },
  hintBtnText: { fontSize: 18, color: colors.accent },
  title: {
    fontSize: font.titleSize, fontFamily: font.display, color: colors.textPrimary,
    letterSpacing: -0.5, lineHeight: 34,
  },
  hintBox: {
    marginTop: 16, padding: 14, backgroundColor: colors.bg,
    borderRadius: radius.md, borderWidth: 0.5, borderColor: colors.border,
  },
  hintTitle: {
    fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.accent,
    fontFamily: font.bodyMedium, textTransform: 'uppercase', marginBottom: 4,
  },
  hintSource: { fontSize: 12, color: colors.textSecondary, fontStyle: 'italic', letterSpacing: 0.3 },
  hintDivider: { height: 0.5, backgroundColor: colors.border, marginTop: 12, marginBottom: 12 },
  hintText: { fontSize: 16, color: colors.textSecondary, lineHeight: 26 },

  empty: { alignItems: 'center', paddingHorizontal: spacing.xl, paddingTop: 48, gap: 14 },
  emptyTitle: { fontSize: 17, color: colors.textPrimary, fontFamily: font.bodyMedium },
  emptyBody: { fontSize: 15, lineHeight: 25, color: colors.textSecondary, fontFamily: font.body, textAlign: 'center' },

  list: { padding: spacing.md, gap: 12 },
  card: {
    borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.md,
    padding: 18, backgroundColor: colors.bgCard,
  },
  // The app's unified contemplative voice, 20/30 Light Italic.
  quote: {
    fontSize: 20, lineHeight: 30, color: colors.textPrimary,
    fontFamily: font.bodyLightItalic, fontStyle: 'italic',
  },
  attr: {
    fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.accent,
    fontFamily: font.bodyMedium, textTransform: 'uppercase', marginTop: 12,
  },
  actions: {
    flexDirection: 'row', gap: 22, marginTop: 16, paddingTop: 14,
    borderTopWidth: 0.5, borderTopColor: colors.border,
  },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionText: { fontSize: 13, color: colors.accent, fontFamily: font.bodyMedium },
});
