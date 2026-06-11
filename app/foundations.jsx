import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, SafeAreaView,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { colors, radius, spacing, font } from '../constants/theme';
import { FOUNDATIONS_LETTERS } from '../constants/foundations';
import { getFoundationsState, markLetterRead } from '../lib/foundations';
import { GoldPrimary } from '../components/GoldButton';
import { useMiniPlayerInset } from '../components/MiniMeditationPlayer';
import { ScreenHeader } from '../components/ScreenHeader';
import * as haptics from '../lib/haptics';
import { track } from '../lib/analytics';

// Reader for the Foundations letters — the seven-day teaching arc. One
// letter per day; earlier letters stay readable. Reached from the Practice
// card during the first week and from the Library shelf afterwards.
export default function FoundationsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const playerInset = useMiniPlayerInset();
  const scrollRef = useRef(null);
  const fromPath = params?.from || '/';
  const fromLabel = params?.fromLabel || 'Practice';

  // 1-based letter number, clamped to the series.
  const requested = parseInt(params?.letter, 10);
  const letterNum = Number.isFinite(requested)
    ? Math.min(Math.max(requested, 1), FOUNDATIONS_LETTERS.length)
    : 1;
  const letter = FOUNDATIONS_LETTERS[letterNum - 1];

  const [unlockedCount, setUnlockedCount] = useState(1);

  useFocusEffect(useCallback(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    getFoundationsState().then(s => setUnlockedCount(s.unlockedCount));
  }, [letterNum]));

  // Opening a letter is reading it — no scroll-depth ceremony.
  useEffect(() => {
    markLetterRead(letterNum);
    track('letter_read', { letter: letterNum });
  }, [letterNum]);

  const hasNext = letterNum < FOUNDATIONS_LETTERS.length;
  const nextUnlocked = hasNext && letterNum + 1 <= unlockedCount;

  return (
    <SafeAreaView style={s.safe}>
      <ScreenHeader fromPath={fromPath} fromLabel={fromLabel} />
      <ScrollView
        ref={scrollRef}
        style={[s.scroll, { backgroundColor: colors.bgCard }]}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 36 + playerInset }}
      >
        <View style={s.hero}>
          <Text style={s.eyebrow}>The Foundations · Letter {letter.num} of VII</Text>
          <Text style={s.title}>{letter.title}</Text>
        </View>

        <View style={s.body}>
          {letter.paragraphs.map((para, i) => (
            <Text key={i} style={[s.para, i > 0 && { marginTop: 16 }]}>{para}</Text>
          ))}
          {letter.tomorrow && (
            <Text style={s.tomorrow}>{letter.tomorrow}</Text>
          )}

          {hasNext && (
            nextUnlocked ? (
              <GoldPrimary
                style={s.nextBtn}
                onPress={() => {
                  haptics.tap();
                  router.setParams({ letter: String(letterNum + 1) });
                }}
              >
                <Text style={s.nextBtnText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                  Letter {FOUNDATIONS_LETTERS[letterNum].num} · {FOUNDATIONS_LETTERS[letterNum].title}
                </Text>
              </GoldPrimary>
            ) : (
              <View style={s.lockedNote}>
                <Text style={s.lockedNoteText}>
                  Letter {FOUNDATIONS_LETTERS[letterNum].num} arrives tomorrow. One tool a day.
                </Text>
              </View>
            )
          )}
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
    padding: spacing.xl,
    paddingTop: 52,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  eyebrow: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.accent, fontFamily: font.bodyMedium, textTransform: 'uppercase', marginBottom: 8 },
  title: { fontSize: font.titleSize, fontFamily: font.display, color: colors.textPrimary, letterSpacing: -0.5 },
  body: { padding: spacing.xl, paddingTop: 24 },
  para: { fontSize: 17, color: colors.textPrimary, lineHeight: 28, fontFamily: font.body },
  // The forward hook, set apart like the memento attributions.
  tomorrow: { fontSize: 15, color: colors.textSecondary, lineHeight: 24, fontFamily: font.bodyLightItalic, fontStyle: 'italic', marginTop: 24 },
  nextBtn: { height: 56, borderRadius: radius.md, marginTop: 28 },
  nextBtnText: { fontSize: 14, fontFamily: font.bodyMedium, color: '#1a1a1a', letterSpacing: 0.3 },
  lockedNote: { marginTop: 28, borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.md, padding: 16, alignItems: 'center' },
  lockedNoteText: { fontSize: 13, color: colors.textSecondary, letterSpacing: 0.3 },
});
