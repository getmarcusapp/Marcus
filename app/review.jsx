import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, TextInput,
  TouchableOpacity, StyleSheet, SafeAreaView, Alert,
  KeyboardAvoidingView, Platform, InputAccessoryView, Keyboard, Image, Share,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing, font } from '../constants/theme';
import { virtues } from '../constants/virtues';
import { saveReview, getReviews, getJournals, getTriggers, getRoles } from '../store/db';
import * as haptics from '../lib/haptics';
import { captureRef } from 'react-native-view-shot';
import { ReviewShareCard } from '../components/ReviewShareCard';
import { useMiniPlayerInset } from '../components/MiniMeditationPlayer';
import { PracticeHeader } from '../components/PracticeHeader';

const EMOTION_LABELS = {
  anger: 'Anger', anxiety: 'Anxiety', frustration: 'Frustration',
  shame: 'Shame', avoidance: 'Avoidance', envy: 'Envy',
  grief: 'Grief', fear: 'Fear', other: 'Other',
};
const reviewPrompts = [
  {
    num: 'I · Honor',
    q: 'What went well? Where did I act with Virtue this week?',
    hint: 'Notice the small moments where you showed up as the person you want to be. Catalog what worked so you can repeat it.',
    key: 'wentWell',
  },
  {
    num: 'II · Reckon',
    q: 'Where did I stray? Where did I fall short of my own standard?',
    hint: 'Without shame, without flinching. Naming where you fell short is the beginning of correcting it.',
    key: 'strayed',
  },
  {
    num: 'III · Pattern',
    q: 'What patterns am I noticing? What remains unresolved?',
    hint: 'A single bad day is a moment. The same bad day three weeks running is a pattern, and patterns are where the practice does its real work.',
    key: 'challenges',
  },
  {
    num: 'IV · Body',
    q: 'How did I treat my physical self: sleep, movement, food, restraint?',
    hint: 'The Stoics treated food, sleep, and movement as moral matters; the body is the instrument of Virtue. Glance at Apple Health if you want real data instead of memory.',
    key: 'body',
  },
];

export default function ReviewScreen() {
  const playerInset = useMiniPlayerInset();
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const fromPath = params?.from || '/';
  const fromLabel = params?.fromLabel || 'Practice';
  const [answers, setAnswers] = useState({});
  const [bestVirtue, setBestVirtue] = useState(virtues[0].id);
  const [worstVirtue, setWorstVirtue] = useState(virtues[3].id);
  const [intention, setIntention] = useState('');
  const [openPrompt, setOpenPrompt] = useState(-1);
  const [openHint, setOpenHint] = useState(null);
  const promptInputRefs = useRef({});
  const intentionInputRef = useRef(null);

  useEffect(() => {
    if (openPrompt < 0) return;
    const t = setTimeout(() => promptInputRefs.current[openPrompt]?.focus(), 200);
    return () => clearTimeout(t);
  }, [openPrompt]);

  useFocusEffect(useCallback(() => {
    setOpenHint(null);
  }, []));
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState({ journaled: 0, triggers: 0, reframed: 0 });
  const shareCardRef = useRef(null);
  const [shareEntry, setShareEntry] = useState(null);
  const [emotionBreakdown, setEmotionBreakdown] = useState([]);
  const [dailyIntensity, setDailyIntensity] = useState([]);
  const [roles, setRoles] = useState([]);

  useEffect(() => {
    async function load() {
      const reviews = await getReviews();
      setHistory(reviews);
      const journals = await getJournals();
      const triggers = await getTriggers();
      const userRoles = await getRoles();
      setRoles(userRoles);
      const weekAgo = Date.now() - 7 * 86400000;
      const weekJournals = journals.filter(j => new Date(j.date).getTime() > weekAgo);
      const weekTriggers = triggers.filter(t => new Date(t.date).getTime() > weekAgo);
      const reframed = weekTriggers.filter(t => t.chosenResponse && t.chosenResponse.trim().length > 0);
      const uniqueDaysJournaled = new Set(weekJournals.map(j => new Date(j.date).toDateString())).size;
      setStats({ journaled: uniqueDaysJournaled, triggers: weekTriggers.length, reframed: reframed.length });

      const emotionMap = {};
      weekTriggers.forEach(t => {
        const key = t.emotion || 'other';
        if (!emotionMap[key]) emotionMap[key] = { count: 0, totalIntensity: 0 };
        emotionMap[key].count += 1;
        emotionMap[key].totalIntensity += (t.intensity || 5);
      });
      const emotionList = Object.entries(emotionMap)
        .map(([emotion, data]) => ({
          emotion,
          label: EMOTION_LABELS[emotion] || emotion,
          count: data.count,
          avgIntensity: Math.round(data.totalIntensity / data.count),
        }))
        .sort((a, b) => b.count - a.count);
      setEmotionBreakdown(emotionList);

      // Daily intensity: 7 columns, oldest → today. Average all triggers
      // logged on each day. Empty days stay null and render as a baseline
      // mark — the absence is itself signal (calm day, or unobserved).
      const todayMidnight = new Date();
      todayMidnight.setHours(0, 0, 0, 0);
      const dayMs = 86400000;
      const daily = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(todayMidnight.getTime() - i * dayMs);
        const dateKey = d.toDateString();
        const dayTriggers = weekTriggers.filter(
          t => new Date(t.date).toDateString() === dateKey
        );
        const avg = dayTriggers.length
          ? dayTriggers.reduce((sum, t) => sum + (t.intensity || 5), 0) / dayTriggers.length
          : null;
        daily.push({
          dateKey,
          dayLetter: d.toLocaleDateString('en-US', { weekday: 'short' }).charAt(0),
          avg: avg !== null ? Math.round(avg * 10) / 10 : null,
          count: dayTriggers.length,
          isToday: i === 0,
        });
      }
      setDailyIntensity(daily);
    }
    load();
  }, []);

  async function handleSave() {
    const entry = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      weekOf: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      answers, bestVirtue, worstVirtue, intention, stats,
    };
    await saveReview(entry);
    haptics.success();
    const updated = await getReviews();
    setHistory(updated);
    Alert.alert('Week sealed.', 'Saved to your review archive.', [
      { text: 'Share', onPress: () => shareReviewEntry(entry) },
      { text: 'View archive', onPress: () => router.push('/review-archive') },
    ]);
  }

  async function shareReviewEntry(entry) {
    haptics.tap();
    setShareEntry(entry);
    // Let the off-screen card render with the new entry data before capture.
    await new Promise(r => setTimeout(r, 80));
    const intentionText = (entry?.intention || '').trim();
    const message = [
      intentionText ? `Intention for the week ahead:\n\n${intentionText}` : null,
      intentionText ? '' : null,
      '— Marcus · a daily Stoic practice',
    ].filter(v => v !== null).join('\n');
    try {
      const uri = await captureRef(shareCardRef, {
        format: 'jpg',
        quality: 0.92,
        result: 'tmpfile',
      });
      await Share.share({ url: uri, message });
    } catch (e) {
      console.log('Review share image failed, falling back:', e?.message);
      const fallback = [
        `Week of ${entry?.weekOf || ''}`,
        '',
        intentionText ? `Intention for the week ahead:\n${intentionText}` : null,
        intentionText ? '' : null,
        '— Marcus · a daily Stoic practice',
      ].filter(Boolean).join('\n');
      try { await Share.share({ message: fallback }); } catch {}
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <PracticeHeader current="review" />
      {/* Off-screen share card. Re-renders when shareEntry changes. */}
      {shareEntry && (
        <View
          ref={shareCardRef}
          collapsable={false}
          style={s.shareCardOffscreen}
        >
          <ReviewShareCard
            weekOf={shareEntry.weekOf}
            bestVirtue={shareEntry.bestVirtue}
            intention={shareEntry.intention}
            stats={shareEntry.stats}
          />
        </View>
      )}
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.bg }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          style={[s.scroll, { backgroundColor: colors.bgCard }]}
          showsVerticalScrollIndicator={true}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={{ paddingBottom: playerInset }}
          scrollIndicatorInsets={{ bottom: 36 }}
        >

        <View style={s.hero}>
          <Image
            source={require('../assets/heroes/review.jpg')}
            style={s.heroImage}
            resizeMode="cover"
          />
          <LinearGradient
            colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.2)', 'rgba(0,0,0,0.7)']}
            locations={[0, 0.55, 1]}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={s.heroContent}>
            <Text style={s.title}>
              {`Week of ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
            </Text>
          </View>
        </View>

        <View style={s.pastReviewsRow}>
          <TouchableOpacity
            onPress={() => router.push('/review-archive')}
            style={s.pastReviewsBtn}
            activeOpacity={0.7}
          >
            <Text style={s.pastReviewsText}>Past reviews ›</Text>
          </TouchableOpacity>
        </View>

        <View style={s.body}>

            {/* Reflection prompts. The III · Pattern card injects the
                7-day disturbance sparkline + a one-line summary as
                inline context for the question — data informing
                reflection rather than competing with it. */}
            {reviewPrompts.map((p, idx) => {
              const isPattern = p.key === 'challenges';
              const days = dailyIntensity.filter(d => d.avg !== null);
              const showPatternData = isPattern && days.length > 0;
              return (
              <TouchableOpacity
                key={p.key}
                style={[s.promptCard, openPrompt === idx && s.promptCardOpen]}
                onPress={() => setOpenPrompt(openPrompt === idx ? -1 : idx)}
                activeOpacity={0.8}
              >
                <View style={s.promptTopRow}>
                  <Text style={s.promptNum}>{p.num}</Text>
                  {p.hint && (
                    <TouchableOpacity
                      style={s.hintBtn}
                      onPress={() => setOpenHint(openHint === idx ? null : idx)}
                    >
                      <Text style={s.hintBtnText}>ⓘ</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {showPatternData && (() => {
                  const half = Math.floor(days.length / 2);
                  const firstAvg = days.slice(0, half).reduce((acc, d) => acc + d.avg, 0) / Math.max(half, 1);
                  const secondAvg = days.slice(-half).reduce((acc, d) => acc + d.avg, 0) / Math.max(half, 1);
                  const diff = secondAvg - firstAvg;
                  const direction = days.length < 2
                    ? null
                    : diff < -0.5 ? 'trending calmer'
                    : diff > 0.5 ? 'more turbulent'
                    : 'steady';
                  const top = emotionBreakdown[0];
                  const summaryParts = [
                    `Disturbed ${days.length} of 7 days`,
                    direction,
                    top ? `${top.label.toLowerCase()} appeared most often` : null,
                  ].filter(Boolean);
                  return (
                    <View style={s.patternData}>
                      <Text style={s.patternSummary}>
                        {summaryParts.join(' · ')}
                      </Text>
                      <View style={s.sparkChart}>
                        {dailyIntensity.map((d, i) => {
                          const SPARK_HEIGHT = 60;
                          const color = d.avg === null
                            ? colors.borderMid
                            : d.avg >= 7 ? colors.virtueBad
                            : d.avg >= 4 ? colors.accent
                            : colors.borderStrong;
                          const barHeight = d.avg !== null
                            ? Math.max(3, (d.avg / 10) * SPARK_HEIGHT)
                            : 0;
                          return (
                            <View key={i} style={s.sparkCol}>
                              <View style={[s.sparkBarTrack, { height: SPARK_HEIGHT }]}>
                                {d.avg !== null ? (
                                  <View style={[s.sparkBar, { height: barHeight, backgroundColor: color }]} />
                                ) : (
                                  <View style={s.sparkBaseline} />
                                )}
                              </View>
                              <Text style={[s.sparkDay, d.isToday && s.sparkDayToday]}>
                                {d.dayLetter}
                              </Text>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  );
                })()}

                <Text style={s.promptQ}>{p.q}</Text>
                {openHint === idx && p.hint && (
                  <View style={s.hintBox}>
                    <Text style={s.hintText}>{p.hint}</Text>
                  </View>
                )}
                {openPrompt === idx && (
                  <View style={s.promptAnswer}>
                    <TextInput
                      ref={el => { promptInputRefs.current[idx] = el; }}
                      style={s.promptInput}
                      multiline
                      placeholder="Write here. No judgment, only honesty..."
                      placeholderTextColor={colors.textDim}
                      value={answers[p.key] || ''}
                      onChangeText={text => setAnswers(prev => ({ ...prev, [p.key]: text }))}
                      scrollEnabled={false}
                      keyboardAppearance="dark"
                      inputAccessoryViewID={Platform.OS === 'ios' ? 'reviewPromptAccessory' : undefined}
                    />
                  </View>
                )}
              </TouchableOpacity>
              );
            })}

            {/* V · Ledger — pure honest self-assessment, no pre-fill */}
            <View style={s.promptCard}>
              <View style={s.promptTopRow}>
                <Text style={s.promptNum}>V · Ledger</Text>
                <TouchableOpacity
                  style={s.hintBtn}
                  onPress={() => setOpenHint(openHint === 'ledger' ? null : 'ledger')}
                >
                  <Text style={s.hintBtnText}>ⓘ</Text>
                </TouchableOpacity>
              </View>
              <Text style={s.promptQ}>Which Virtue did I most embody this week, and which did I fall short on?</Text>
              {openHint === 'ledger' && (
                <View style={s.hintBox}>
                  <Text style={s.hintText}>The four Virtues are inseparable. Wisdom without Justice is shallow. Courage without Moderation is recklessness. This question is not which Virtue you remembered to do; it is a sober assessment of where the unified character was tested most, and where it held.</Text>
                </View>
              )}
              <View style={s.virtueRow}>
                <View style={s.virtuePicker}>
                  <Text style={s.vpLabel}>Most embodied</Text>
                  {virtues.map(v => (
                    <TouchableOpacity
                      key={v.id}
                      style={[s.vpBtn, bestVirtue === v.id && s.vpBtnActive]}
                      onPress={() => { haptics.tap(); setBestVirtue(v.id); }}
                    >
                      <Text style={[s.vpBtnText, bestVirtue === v.id && { color: colors.virtueGood, fontWeight: '600' }]}>
                        {v.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={s.virtuePicker}>
                  <Text style={s.vpLabel}>Least embodied</Text>
                  {virtues.map(v => (
                    <TouchableOpacity
                      key={v.id}
                      style={[s.vpBtn, worstVirtue === v.id && s.vpBtnActive]}
                      onPress={() => { haptics.tap(); setWorstVirtue(v.id); }}
                    >
                      <Text style={[s.vpBtnText, worstVirtue === v.id && { color: colors.virtueBad, fontWeight: '600' }]}>
                        {v.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            {/* VI · Account — role-fulfillment, only if user has defined roles */}
            {roles.length > 0 && (
              <View style={s.promptCard}>
                <View style={s.promptTopRow}>
                  <Text style={s.promptNum}>VI · Account</Text>
                </View>
                <Text style={s.promptQ}>Which role did I serve well this week? Which fell short?</Text>
                <View style={s.roleChipRow}>
                  {roles.map(r => (
                    <View key={r.id} style={s.roleChip}>
                      <Text style={s.roleChipText}>{r.name}</Text>
                    </View>
                  ))}
                </View>
                <TextInput
                  style={s.intentionInput}
                  multiline
                  placeholder="Be specific. Name names, name moments..."
                  placeholderTextColor={colors.textDim}
                  value={answers.roles || ''}
                  onChangeText={text => setAnswers(prev => ({ ...prev, roles: text }))}
                  scrollEnabled={false}
                  inputAccessoryViewID={Platform.OS === 'ios' ? 'reviewAccountAccessory' : undefined}
                />
              </View>
            )}

            {/* Commit — the output of all reflection above. Numbered VII
                when the Roles · Account prompt is present, otherwise VI. */}
            <View style={s.promptCard}>
              <View style={s.promptTopRow}>
                <Text style={s.promptNum}>{roles.length > 0 ? 'VII · Commit' : 'VI · Commit'}</Text>
                <TouchableOpacity
                  style={s.hintBtn}
                  onPress={() => setOpenHint(openHint === 'commit' ? null : 'commit')}
                >
                  <Text style={s.hintBtnText}>ⓘ</Text>
                </TouchableOpacity>
              </View>
              <Text style={s.promptQ}>What one thing will I do differently next week?</Text>
              {openHint === 'commit' && (
                <View style={s.hintBox}>
                  <Text style={s.hintText}>One change, not many. The Stoics measured the year by what they actually did, not by what they intended. A single concrete commitment, kept, reshapes next week more than a long list you abandon by Wednesday. Make it specific. Make it visible. Make it doable in the conditions you actually live in.</Text>
                </View>
              )}
              <TextInput
                ref={intentionInputRef}
                style={s.intentionInput}
                multiline
                placeholder="Write it as a commitment, not a wish..."
                placeholderTextColor={colors.textDim}
                value={intention}
                onChangeText={setIntention}
                scrollEnabled={false}
                inputAccessoryViewID={Platform.OS === 'ios' ? 'reviewIntentionAccessory' : undefined}
              />
            </View>

            <TouchableOpacity style={s.sealBtn} onPress={handleSave} activeOpacity={0.8}>
              <Text style={s.sealBtnText}>Seal this week</Text>
              <Text style={s.sealBtnSub}>Saved to your review archive</Text>
            </TouchableOpacity>

          </View>

        </ScrollView>
      </KeyboardAvoidingView>
      {Platform.OS === 'ios' && (
        <>
          <InputAccessoryView nativeID="reviewPromptAccessory">
            <View style={s.accessoryBar}>
              <TouchableOpacity onPress={() => Keyboard.dismiss()} style={s.accessoryDone} activeOpacity={0.7}>
                <Text style={s.accessoryDoneText}>Done</Text>
              </TouchableOpacity>
              {openPrompt < reviewPrompts.length - 1 ? (
                <TouchableOpacity
                  onPress={() => { haptics.tap(); setOpenPrompt(openPrompt + 1); }}
                  style={s.accessoryAction}
                  activeOpacity={0.7}
                >
                  <Text style={s.accessoryActionText}>Next prompt →</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={() => Keyboard.dismiss()} style={s.accessoryAction} activeOpacity={0.7}>
                  <Text style={s.accessoryActionText}>Continue ↓</Text>
                </TouchableOpacity>
              )}
            </View>
          </InputAccessoryView>
          {/* VI · Account — auto-focus Commit, since there's still one prompt after */}
          <InputAccessoryView nativeID="reviewAccountAccessory">
            <View style={s.accessoryBar}>
              <TouchableOpacity onPress={() => Keyboard.dismiss()} style={s.accessoryDone} activeOpacity={0.7}>
                <Text style={s.accessoryDoneText}>Done</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { haptics.tap(); intentionInputRef.current?.focus(); }}
                style={s.accessoryAction}
                activeOpacity={0.7}
              >
                <Text style={s.accessoryActionText}>Next prompt →</Text>
              </TouchableOpacity>
            </View>
          </InputAccessoryView>
          {/* VII · Commit — final prompt; Seal triggers save */}
          <InputAccessoryView nativeID="reviewIntentionAccessory">
            <View style={s.accessoryBar}>
              <TouchableOpacity onPress={() => Keyboard.dismiss()} style={s.accessoryDone} activeOpacity={0.7}>
                <Text style={s.accessoryDoneText}>Done</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { Keyboard.dismiss(); handleSave(); }}
                style={s.accessoryAction}
                activeOpacity={0.7}
              >
                <Text style={s.accessoryActionText}>Seal this week →</Text>
              </TouchableOpacity>
            </View>
          </InputAccessoryView>
        </>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgDeep },
  shareCardOffscreen: { position: 'absolute', left: -99999, top: 0 },
  scroll: { flex: 1 },
  hero: {
    backgroundColor: colors.bgDeep,
    minHeight: 220,
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
  title: { fontSize: font.titleSize, fontWeight: '300', color: colors.textPrimary, letterSpacing: -0.5, marginBottom: 8 },
  sub: { fontSize: font.subSize, color: colors.textMuted },
  // "Past reviews ›" link below the hero. Replaced the This Week / Archive
  // tab row — archive now lives at /review-archive.
  pastReviewsRow: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 20, paddingVertical: 10, backgroundColor: colors.bgDeep, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  pastReviewsBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  pastReviewsText: { fontSize: 13, color: colors.accent, letterSpacing: 0.3 },
  body: { padding: spacing.md },
  // Prompts
  promptCard: { borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.lg, padding: 20, marginBottom: 10, backgroundColor: colors.bgElevated },
  promptCardOpen: { borderColor: colors.borderMid },
  promptTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  promptNum: { fontSize: font.microSize, letterSpacing: 2, color: colors.accent, textTransform: 'uppercase' },
  promptQ: { fontSize: 15, color: colors.textPrimary, lineHeight: 24, fontWeight: '400' },
  promptAnswer: { marginTop: 16, borderTopWidth: 0.5, borderTopColor: colors.border, paddingTop: 16 },
  promptInput: { fontSize: 16, color: colors.textPrimary, lineHeight: 26, minHeight: 100, textAlignVertical: 'top' },
  nextPromptBtn: { marginTop: 12, alignSelf: 'flex-end', paddingVertical: 8, paddingHorizontal: 4 },
  nextPromptText: { fontSize: 12, color: colors.accent, letterSpacing: 1, textTransform: 'uppercase' },
  accessoryBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.bgElevated,
    borderTopWidth: 0.5,
    borderTopColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  accessoryDone: { paddingVertical: 6, paddingHorizontal: 8 },
  accessoryDoneText: { fontSize: 14, color: colors.textDim, letterSpacing: 0.3 },
  accessoryAction: { paddingVertical: 6, paddingHorizontal: 8 },
  accessoryActionText: { fontSize: 13, fontWeight: '600', color: colors.accent, letterSpacing: 1, textTransform: 'uppercase' },
  hintBtn: { padding: 4 },
  hintBtnText: { fontSize: 18, color: colors.accent },
  hintBox: { marginTop: 14, padding: 14, backgroundColor: colors.bg, borderRadius: radius.md, borderWidth: 0.5, borderColor: colors.border },
  hintText: { fontSize: 16, color: colors.textSecondary, lineHeight: 26, fontFamily: font.serif },
  // Inline pattern context — appears inside the III · Pattern card to
  // ground the question in the week's actual data without preceding it
  // with a separate analytics surface.
  patternData: { marginBottom: 16, paddingBottom: 16, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  patternSummary: { fontSize: 13, color: colors.textMuted, marginBottom: 12, letterSpacing: 0.2, lineHeight: 19 },
  sparkChart: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 4 },
  sparkCol: { flex: 1, alignItems: 'center' },
  sparkBarTrack: { width: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  sparkBar: { width: '70%', borderRadius: 3, minHeight: 3 },
  sparkBaseline: { width: '70%', height: 1.5, backgroundColor: colors.border, borderRadius: 1 },
  sparkDay: { fontSize: 11, color: colors.textDim, marginTop: 8, letterSpacing: 0.4 },
  sparkDayToday: { color: colors.accent, fontWeight: '600' },
  // Virtue ledger (inside promptCard)
  virtueRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  virtuePicker: { flex: 1, borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.md, overflow: 'hidden' },
  vpLabel: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.accent, textTransform: 'uppercase', padding: 12, paddingHorizontal: 14, backgroundColor: colors.bgDeep, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  vpBtn: { padding: 13, paddingHorizontal: 14, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  vpBtnActive: { backgroundColor: colors.bgElevated },
  vpBtnText: { fontSize: 15, color: colors.textDim },
  // Intention
  intentionCard: { borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.lg, padding: 18, marginBottom: 14, backgroundColor: colors.bgCard },
  intentionInput: { fontSize: 16, color: colors.textPrimary, lineHeight: 26, minHeight: 90, textAlignVertical: 'top', marginTop: 12 },
  // Role chip strip shown above the VI · Account textarea to remind the
  // user which roles are in scope while reflecting on the week. Warm
  // accent tint so they read against the dark prompt card.
  roleChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12, marginBottom: 4 },
  roleChip: {
    borderWidth: 0.5, borderColor: colors.accentDim, borderRadius: 14,
    paddingHorizontal: 10, paddingVertical: 4, backgroundColor: colors.accentBg,
  },
  roleChipText: { fontSize: 12, color: colors.accent, letterSpacing: 0.3 },
  // Seal button
  sealBtn: { borderWidth: 0.5, borderColor: colors.borderStrong, borderRadius: radius.md, padding: 18, alignItems: 'center', backgroundColor: colors.bgCard, marginBottom: 36 },
  sealBtnText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, letterSpacing: 1, textTransform: 'uppercase' },
  sealBtnSub: { fontSize: 12, color: colors.textDim, marginTop: 5 },
});
