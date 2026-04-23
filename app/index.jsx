import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, Image,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, radius, spacing, font } from '../constants/theme';
import { morningQuotes, mementoMoriQuotes, getDailyQuote } from '../constants/quotes';
import { virtues } from '../constants/virtues';
import { getTodayJournal, getStreak, getTodayReading, getCompassDone, persistCompassDone, clearCompassDone } from '../store/db';
import { refreshNotificationsForToday } from '../notifications';

const virtueDetails = {
  wisdom: { definition: 'The virtue of discernment and right judgment. Wisdom means seeing things clearly — not as you wish them to be, but as they are.', question: 'Am I perceiving this clearly or through bias, fear, or ego?' },
  courage: { definition: 'The virtue of strength and moral fortitude. Courage is doing the right thing even when it is hard.', question: 'What fear is stopping me right now?' },
  moderation: { definition: 'The virtue of temperance and balance. Neither indulgence nor deprivation — the disciplined middle path.', question: 'Where am I in excess today?' },
  justice: { definition: 'The virtue of fairness and right action toward others. Justice is about how you treat the people around you.', question: 'Did I treat others with fairness today?' },
};

export default function PracticeScreen() {
  const router = useRouter();
  const [morningDone, setMorningDone] = useState(false);
  const [eveningDone, setEveningDone] = useState(false);
  const [compassDone, setCompassDone] = useState(false);
  const [readingDone, setReadingDone] = useState(false);
  const [streak, setStreak] = useState({ current: 0, longest: 0, totalDays: 0 });
  const [todayDate, setTodayDate] = useState(new Date());
  const [reviewDay, setReviewDay] = useState(0);
  const [virtueExpanded, setVirtueExpanded] = useState(false);

  const today = todayDate;
  const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const [todayVirtue, setTodayVirtue] = useState(virtues[today.getDate() % 4]);
  const isReviewDay = today.getDay() === reviewDay;

  const quote = getDailyQuote(morningQuotes);
  const sealQuote = getDailyQuote(mementoMoriQuotes, 7);

  useFocusEffect(useCallback(() => {
    async function load() {
      const now = new Date();
      setTodayDate(now);
      setTodayVirtue(virtues[now.getDate() % 4]);
      const morning = await getTodayJournal('morning');
      const evening = await getTodayJournal('evening');
      const reading = await getTodayReading();
      const compassToday = await getCompassDone();
      const s = await getStreak();
      const settings = await AsyncStorage.getItem('notification_settings');
      if (settings) {
        const parsed = JSON.parse(settings);
        if (parsed.reviewDay !== undefined) setReviewDay(parsed.reviewDay);
      }
      setMorningDone(!!morning);
      setEveningDone(!!evening);
      setReadingDone(!!reading);
      setCompassDone(compassToday);
      setStreak(s);
      // Cancel notifications for anything already done today
      refreshNotificationsForToday().catch(() => {});
      if (morning?.virtue) {
        const found = virtues.find(v => v.id === morning.virtue);
        if (found) setTodayVirtue(found);
      }
    }
    load();
  }, []));

  const totalItems = isReviewDay ? 5 : 4;
  const completed = [compassDone, readingDone, morningDone, eveningDone, isReviewDay ? false : null]
    .filter(v => v === true).length;
  const allDone = completed >= 4 && (!isReviewDay || completed >= 5);
  const progress = Math.min(completed / (isReviewDay ? 5 : 4), 1);

  if (allDone) {
    return (
      <SafeAreaView style={s.safe}>
        <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>

          <View style={s.heroSealed}>
            <Image
              source={require('../assets/skull.png')}
              style={s.skullIconSealed}
              resizeMode="contain"
            />
            <Text style={s.sealedEyebrow}>Practice complete</Text>
            <Text style={s.sealedDate}>{dateStr}</Text>
            <Text style={s.sealedStreak}>
              {streak.current > 0 ? `Day ${streak.current}` : 'Day 1'}
            </Text>
          </View>

          <View style={s.sealedCard}>
            <Text style={s.sealedQuoteOpen}>"</Text>
            <Text style={s.sealedQuoteText}>{sealQuote.text}"</Text>
            <View style={s.sealedQuoteRule} />
            <Text style={s.sealedQuoteAttr}>— {sealQuote.author.toUpperCase()}, {sealQuote.source.toUpperCase()}</Text>
          </View>

          <View style={s.sealedRestCard}>
            <Text style={s.sealedRestTitle}>The rest of the day is yours.</Text>
            <Text style={s.sealedRestSub}>You have done what was required. Now live what you practiced.</Text>
          </View>

          <View style={s.body}>
            <TouchableOpacity
              style={s.virtueCard}
              onPress={() => setVirtueExpanded(!virtueExpanded)}
              activeOpacity={0.8}
            >
              <Text style={s.virtueEyebrow}>Virtue focus · {todayVirtue.latin}</Text>
              <Text style={s.virtueName}>{todayVirtue.name}</Text>
              <Text style={s.virtueDesc}>{todayVirtue.desc}</Text>
              <Text style={s.virtueQuestion}>"{todayVirtue.question}"</Text>
              {virtueExpanded && (
                <View style={s.virtueDetail}>
                  <View style={s.virtueDivider} />
                  <Text style={s.virtueDetailText}>{virtueDetails[todayVirtue.id]?.definition}</Text>
                  <Text style={s.virtueDetailQuestion}>"{virtueDetails[todayVirtue.id]?.question}"</Text>
                </View>
              )}
              <Text style={s.virtueChev}>{virtueExpanded ? '∨ Less' : '› More'}</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>

        <View style={s.hero}>
          <Image
            source={require('../assets/skull.png')}
            style={s.skullIcon}
            resizeMode="contain"
          />
          <Text style={s.eyebrow}>Memento mori</Text>
          <Text style={s.heroDate}>{dateStr}</Text>
          <Text style={s.heroSub}>
            {streak.current > 0 ? `Day ${streak.current} of your finite days` : 'Your practice begins today'}
          </Text>
        </View>

        <View style={s.quoteCard}>
          <Text style={s.quoteOpen}>"</Text>
          <Text style={s.quoteText}>{quote.text}"</Text>
          <Text style={s.quoteAttr}>— {quote.author.toUpperCase()}, {quote.source.toUpperCase()}</Text>
        </View>

        <View style={s.body}>

          <View style={s.practiceHeader}>
            <Text style={s.secLabel}>Today's practice</Text>
          </View>
          <View style={s.progressBar}>
            <View style={[s.progressFill, { width: `${progress * 100}%` }]} />
          </View>
          <Text style={s.progressText}>{completed} of {totalItems} complete</Text>

          {(streak.current > 0 || streak.longest > 0 || streak.totalDays > 0) && (
            <View style={s.streakRow}>
              <View style={s.streakStat}>
                <Text style={s.streakNum}>{streak.current}</Text>
                <Text style={s.streakLabel}>Current</Text>
              </View>
              <View style={s.streakDivider} />
              <View style={s.streakStat}>
                <Text style={s.streakNum}>{streak.longest || 0}</Text>
                <Text style={s.streakLabel}>Longest</Text>
              </View>
              <View style={s.streakDivider} />
              <View style={s.streakStat}>
                <Text style={s.streakNum}>{streak.totalDays || 0}</Text>
                <Text style={s.streakLabel}>Total days</Text>
              </View>
            </View>
          )}

          <View style={s.routineCard}>

            <TouchableOpacity
              style={[s.routineRow, s.routineRowBorder]}
              onPress={async () => { router.push('/compass'); setCompassDone(true); await persistCompassDone(); }}
              activeOpacity={0.7}
            >
              <View style={[s.dot, compassDone && s.dotDone]} />
              <View style={s.routineContent}>
                <Text style={[s.routineTitle, compassDone && s.titleDone]}>Stoic compass</Text>
                <Text style={s.routineSub}>Your north star — read daily</Text>
              </View>
              <View style={s.tagRow}>
                {compassDone && (
                  <TouchableOpacity style={s.undoBtn} onPress={async () => { setCompassDone(false); await clearCompassDone(); }}>
                    <Text style={s.undoBtnText}>Undo</Text>
                  </TouchableOpacity>
                )}
                <View style={[s.tag, compassDone ? s.tagDone : s.tagNow]}>
                  <Text style={[s.tagText, !compassDone && s.tagTextNow]}>{compassDone ? 'DONE' : 'NOW'}</Text>
                </View>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.routineRow, s.routineRowBorder]}
              onPress={() => router.push('/read')}
              activeOpacity={0.7}
            >
              <View style={[s.dot, readingDone && s.dotDone]} />
              <View style={s.routineContent}>
                <Text style={[s.routineTitle, readingDone && s.titleDone]}>Daily reading</Text>
                <Text style={s.routineSub}>Ancient wisdom for this day</Text>
              </View>
              <View style={[s.tag, readingDone ? s.tagDone : s.tagNow]}>
                <Text style={[s.tagText, !readingDone && s.tagTextNow]}>{readingDone ? 'DONE' : 'READ'}</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.routineRow, s.routineRowBorder]}
              onPress={() => router.push({ pathname: '/journal', params: { type: 'morning' } })}
              activeOpacity={0.7}
            >
              <View style={[s.dot, morningDone && s.dotDone]} />
              <View style={s.routineContent}>
                <Text style={[s.routineTitle, morningDone && s.titleDone]}>Morning journal</Text>
                <Text style={s.routineSub}>5–10 min · reflect and intend</Text>
              </View>
              <View style={[s.tag, morningDone ? s.tagDone : s.tagNow]}>
                <Text style={[s.tagText, !morningDone && s.tagTextNow]}>{morningDone ? 'DONE' : 'NOW'}</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.routineRow, isReviewDay && s.routineRowBorder]}
              onPress={() => router.push({ pathname: '/journal', params: { type: 'evening' } })}
              activeOpacity={0.7}
            >
              <View style={[s.dot, eveningDone && s.dotDone]} />
              <View style={s.routineContent}>
                <Text style={[s.routineTitle, eveningDone && s.titleDone]}>Evening journal</Text>
                <Text style={s.routineSub}>10–15 min · examine and release</Text>
              </View>
              <View style={[s.tag, eveningDone ? s.tagDone : s.tagLater]}>
                <Text style={s.tagText}>{eveningDone ? 'DONE' : 'LATER'}</Text>
              </View>
            </TouchableOpacity>

            {isReviewDay && (
              <TouchableOpacity
                style={s.routineRow}
                onPress={() => router.push('/review')}
                activeOpacity={0.7}
              >
                <View style={s.dot} />
                <View style={s.routineContent}>
                  <Text style={s.routineTitle}>Weekly review</Text>
                  <Text style={s.routineSub}>15–30 min · seal the week</Text>
                </View>
                <View style={[s.tag, s.tagAccent]}>
                  <Text style={[s.tagText, s.tagTextAccent]}>TODAY</Text>
                </View>
              </TouchableOpacity>
            )}

          </View>

          <TouchableOpacity
            style={s.virtueCard}
            onPress={() => setVirtueExpanded(!virtueExpanded)}
            activeOpacity={0.8}
          >
            <Text style={s.virtueEyebrow}>Virtue focus · {todayVirtue.latin}</Text>
            <Text style={s.virtueName}>{todayVirtue.name}</Text>
            <Text style={s.virtueDesc}>{todayVirtue.desc}</Text>
            <Text style={s.virtueQuestion}>"{todayVirtue.question}"</Text>
            {virtueExpanded && (
              <View style={s.virtueDetail}>
                <View style={s.virtueDivider} />
                <Text style={s.virtueDetailText}>{virtueDetails[todayVirtue.id]?.definition}</Text>
                <Text style={s.virtueDetailQuestion}>"{virtueDetails[todayVirtue.id]?.question}"</Text>
              </View>
            )}
            <Text style={s.virtueChev}>{virtueExpanded ? '∨ Less' : '› More'}</Text>
          </TouchableOpacity>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },

  // Normal hero
  hero: {
    backgroundColor: colors.bgDeep,
    paddingTop: 48,
    paddingBottom: 36,
    paddingHorizontal: spacing.xl,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
    alignItems: 'center',
  },
  skullIcon: { width: 96, height: 96, marginBottom: 20, opacity: 0.9 },
  eyebrow: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.accent, textTransform: 'uppercase', marginBottom: 10, textAlign: 'center' },
  heroDate: { fontSize: font.heroSize, fontWeight: '600', color: colors.textPrimary, letterSpacing: -1, marginBottom: 8, textAlign: 'center' },
  heroSub: { fontSize: font.subSize, color: colors.textMuted, textAlign: 'center' },

  // Sealed hero
  heroSealed: {
    backgroundColor: colors.bgDeep,
    paddingTop: 48,
    paddingBottom: 36,
    paddingHorizontal: spacing.xl,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.accentDim,
    alignItems: 'center',
  },
  skullIconSealed: { width: 140, height: 140, marginBottom: 24, opacity: 1 },
  sealedEyebrow: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.accent, textTransform: 'uppercase', marginBottom: 10, textAlign: 'center' },
  sealedDate: { fontSize: font.titleSize, fontWeight: '600', color: colors.textPrimary, letterSpacing: -0.5, marginBottom: 8, textAlign: 'center' },
  sealedStreak: { fontSize: 48, fontWeight: '700', color: colors.accent, letterSpacing: -1, textAlign: 'center' },

  // Sealed quote
  sealedCard: {
    backgroundColor: colors.accentBg,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.accentDim,
    padding: spacing.xl,
    paddingVertical: 26,
  },
  sealedQuoteOpen: { fontSize: 40, color: colors.accentDim, fontFamily: font.serif, lineHeight: 32, marginBottom: -4 },
  sealedQuoteText: { fontSize: 18, color: colors.textSecondary, lineHeight: 30, fontStyle: 'italic', fontFamily: font.serif },
  sealedQuoteRule: { height: 0.5, backgroundColor: colors.accentDim, marginVertical: 16 },
  sealedQuoteAttr: { fontSize: 10, color: colors.accentDim, letterSpacing: 1.5 },

  // Sealed rest card — light zone
  sealedRestCard: {
    padding: spacing.xl,
    paddingVertical: 24,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
    backgroundColor: colors.bgCard,
  },
  sealedRestTitle: { fontSize: 20, fontWeight: '400', color: colors.textPrimary, marginBottom: 8 },
  sealedRestSub: { fontSize: 15, color: colors.textMuted, lineHeight: 24, fontFamily: font.serif },

  // Normal quote
  quoteCard: {
    backgroundColor: colors.bgDeep,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
    padding: spacing.xl,
    paddingVertical: 22,
  },
  quoteOpen: { fontSize: 36, color: colors.borderStrong, fontFamily: font.serif, lineHeight: 28, marginBottom: -4 },
  quoteText: { fontSize: 18, color: colors.textPrimary, lineHeight: 30, fontFamily: font.serif },
  quoteAttr: { fontSize: 11, color: colors.textMuted, marginTop: 12, letterSpacing: 1.5 },

  // Light body zone
  body: { padding: spacing.md, backgroundColor: colors.bgCard },
  practiceHeader: { marginTop: 8, marginBottom: 10 },
  secLabel: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.textDim, textTransform: 'uppercase' },
  progressBar: { height: 1, backgroundColor: colors.border, borderRadius: 1, marginBottom: 8, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.textPrimary, borderRadius: 1 },
  progressText: { fontSize: 12, color: colors.textDim, marginBottom: 12 },

  streakRow: {
    flexDirection: 'row',
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.bgElevated,
    marginBottom: 14,
    overflow: 'hidden',
  },
  streakStat: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  streakNum: { fontSize: 22, fontWeight: '300', color: colors.textPrimary, letterSpacing: -0.5 },
  streakLabel: { fontSize: 10, color: colors.textDim, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 3 },
  streakDivider: { width: 0.5, backgroundColor: colors.border, marginVertical: 8 },

  routineCard: {
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.bgElevated,
    overflow: 'hidden',
    marginBottom: 16,
  },
  routineRow: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, paddingHorizontal: 18 },
  routineRowBorder: { borderBottomWidth: 0.5, borderBottomColor: colors.border },
  dot: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: colors.borderMid },
  dotDone: { backgroundColor: colors.textPrimary, borderColor: colors.textPrimary },
  routineContent: { flex: 1 },
  routineTitle: { fontSize: 15, fontWeight: '400', color: colors.textPrimary, marginBottom: 3 },
  titleDone: { color: colors.textDim, textDecorationLine: 'line-through' },
  routineSub: { fontSize: 12, color: colors.textDim },
  tagRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  undoBtn: { borderWidth: 0.5, borderColor: colors.border, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  undoBtnText: { fontSize: 11, color: colors.textMuted },
  tag: { borderWidth: 0.5, borderColor: colors.border, borderRadius: 5, paddingHorizontal: 10, paddingVertical: 4 },
  tagDone: { borderColor: colors.border },
  tagNow: { borderColor: colors.textPrimary, backgroundColor: 'transparent' },
  tagLater: { borderColor: colors.border },
  tagAccent: { borderColor: colors.borderMid },
  tagText: { fontSize: 10, color: colors.textMuted, letterSpacing: 1, textTransform: 'uppercase' },
  tagTextNow: { color: colors.textPrimary, fontWeight: '500' },
  tagTextAccent: { color: colors.textMuted },

  virtueCard: {
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 22,
    marginBottom: 32,
    backgroundColor: colors.bgCard,
  },
  virtueEyebrow: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.accent, textTransform: 'uppercase', marginBottom: 10 },
  virtueName: { fontSize: 24, fontWeight: '600', color: colors.textPrimary, marginBottom: 8 },
  virtueDesc: { fontSize: 15, color: colors.textSecondary, lineHeight: 24, marginBottom: 12 },
  virtueQuestion: { fontSize: 15, color: colors.textMuted, fontFamily: font.serif, lineHeight: 24 },
  virtueDetail: { marginTop: 14 },
  virtueDivider: { height: 0.5, backgroundColor: colors.border, marginBottom: 14 },
  virtueDetailText: { fontSize: 15, color: colors.textSecondary, lineHeight: 24, fontFamily: font.serif, marginBottom: 10 },
  virtueDetailQuestion: { fontSize: 14, color: colors.textMuted, fontFamily: font.serif },
  virtueChev: { fontSize: 12, color: colors.accentDim, marginTop: 12, letterSpacing: 0.5 },
});