import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TextInput,
  TouchableOpacity, StyleSheet, SafeAreaView, Alert,
  KeyboardAvoidingView, Platform, InputAccessoryView, Keyboard, Image, Share,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing, font } from '../constants/theme';
import { virtues } from '../constants/virtues';
import { saveReview, getReviews, getJournals, getTriggers, getRoles } from '../store/db';
import * as haptics from '../lib/haptics';
import { captureRef } from 'react-native-view-shot';
import { ReviewShareCard } from '../components/ReviewShareCard';

const EMOTION_LABELS = {
  anger: 'Anger', anxiety: 'Anxiety', frustration: 'Frustration',
  shame: 'Shame', avoidance: 'Avoidance', envy: 'Envy',
  grief: 'Grief', fear: 'Fear', other: 'Other',
};
const DISTORTION_LABELS = {
  catastrophizing: 'Catastrophizing', mind_reading: 'Mind-reading',
  overgeneralizing: 'Overgeneralizing', personalizing: 'Personalizing',
  filtering: 'Filtering', emotional_reasoning: 'Emotional reasoning',
  should_statements: 'Should statements',
};

const reviewPrompts = [
  {
    num: 'I · Account',
    q: 'What went well? Where did I act with Virtue this week?',
    hint: 'This is not a victory lap. Notice the moments — even small ones — where you showed up as the person you want to be. Honest accounting cuts both ways: catalog what worked so you can repeat it.',
    key: 'wentWell',
  },
  {
    num: 'II · Reckon',
    q: 'Where did I stray? Where did I fall short of my own standard?',
    hint: 'Without shame, without flinching. The Stoic practice is not about being perfect. It is about being awake to where you fell short. Naming it is the beginning of correcting it.',
    key: 'strayed',
  },
  {
    num: 'III · Pattern',
    q: 'What patterns am I noticing? What remains unresolved?',
    hint: 'A single bad day is a moment. The same bad day, three weeks running, is a pattern. Patterns are where the practice does its real work. They reveal what is actually shaping your life.',
    key: 'challenges',
  },
  {
    num: 'IV · Body',
    q: 'How did I treat my physical self: sleep, movement, food, restraint?',
    hint: 'The Stoics did not separate the body from the practice. Marcus Aurelius wrote about food, sleep, and exercise as moral matters. The body is the instrument of Virtue. How well did you maintain it?\n\nBefore answering, consider opening Apple Health and glancing at your Mindfulness, Sleep, and Activity tabs for the week. Real data beats memory. Honest reflection deserves honest evidence.',
    key: 'body',
  },
];

export default function ReviewScreen() {
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
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState({ journaled: 0, triggers: 0, reframed: 0 });
  const shareCardRef = useRef(null);
  const [shareEntry, setShareEntry] = useState(null);
  const [emotionBreakdown, setEmotionBreakdown] = useState([]);
  const [distortionBreakdown, setDistortionBreakdown] = useState([]);
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

      const distMap = {};
      weekTriggers.forEach(t => {
        (t.distortions || []).forEach(d => {
          distMap[d] = (distMap[d] || 0) + 1;
        });
      });
      const distList = Object.entries(distMap)
        .map(([id, count]) => ({ id, label: DISTORTION_LABELS[id] || id, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
      setDistortionBreakdown(distList);

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
      <TouchableOpacity onPress={() => router.replace(fromPath)} style={[s.backRow, { top: insets.top + 12 }]} activeOpacity={0.7}>
        <Text style={s.backArrow}>‹</Text>
        <Text style={s.backLabel}>{fromLabel}</Text>
      </TouchableOpacity>
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
          style={s.scroll}
          showsVerticalScrollIndicator={true}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          contentInset={{ bottom: 60 }}
          scrollIndicatorInsets={{ bottom: 60 }}
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
            <Text style={s.eyebrow}>Weekly Review</Text>
            <Text style={s.title}>
              {`Week of ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
            </Text>
            <Text style={s.sub}>Sunday reckoning</Text>
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

            {/* Stats row */}
            <View style={s.statRow}>
              <View style={s.stat}>
                <Text style={s.statNum}>{stats.journaled}</Text>
                <Text style={s.statLbl}>Days{'\n'}journaled</Text>
              </View>
              <View style={s.stat}>
                <Text style={[s.statNum, { color: colors.virtueGood }]}>{stats.reframed}</Text>
                <Text style={s.statLbl}>Triggers{'\n'}reframed</Text>
              </View>
              <View style={s.stat}>
                <Text style={[s.statNum, { color: colors.virtueBad }]}>{stats.triggers}</Text>
                <Text style={s.statLbl}>Total{'\n'}triggers</Text>
              </View>
            </View>

            {/* Emotion data first — informs reflection */}
            {emotionBreakdown.length > 0 && (
              <View style={s.insightCard}>
                <Text style={s.insightCardTitle}>Emotions this week</Text>

                {/* 7-day intensity sparkline — answers "is the storm getting smaller?" */}
                <View style={s.sparkSection}>
                  <Text style={s.sparkLabel}>Daily intensity · past 7 days</Text>
                  <View style={s.sparkChart}>
                    {dailyIntensity.map((d, i) => {
                      const SPARK_HEIGHT = 72;
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
                  {(() => {
                    const days = dailyIntensity.filter(d => d.avg !== null);
                    if (days.length < 2) return null;
                    const half = Math.floor(days.length / 2);
                    const firstAvg = days.slice(0, half).reduce((acc, d) => acc + d.avg, 0) / half;
                    const secondAvg = days.slice(-half).reduce((acc, d) => acc + d.avg, 0) / half;
                    const diff = secondAvg - firstAvg;
                    const direction = diff < -0.5 ? 'trending calmer' : diff > 0.5 ? 'more turbulent' : 'steady';
                    return (
                      <Text style={s.sparkCaption}>
                        Disturbed {days.length} of 7 days · {direction}
                      </Text>
                    );
                  })()}
                </View>

                <View style={s.sparkDivider} />

                {emotionBreakdown.map((item, idx) => (
                  <View key={idx} style={s.insightRow}>
                    <View style={s.insightRowLeft}>
                      <Text style={s.insightEmotionLabel}>{item.label}</Text>
                      <View style={s.insightBar}>
                        <View style={[s.insightBarFill, {
                          flex: item.count / (emotionBreakdown[0]?.count || 1),
                          backgroundColor: item.avgIntensity >= 7 ? colors.virtueBad : item.avgIntensity >= 4 ? colors.accent : colors.borderStrong,
                        }]} />
                        <View style={{ flex: 1 - (item.count / (emotionBreakdown[0]?.count || 1)) }} />
                      </View>
                    </View>
                    <View style={s.insightRowRight}>
                      <Text style={s.insightCount}>{item.count}×</Text>
                      <Text style={s.insightIntensity}>avg {item.avgIntensity}/10</Text>
                    </View>
                  </View>
                ))}
                <View style={s.intensityLegend}>
                  <Text style={s.intensityLegendLabel}>Avg intensity</Text>
                  <View style={s.intensityLegendItems}>
                    <View style={s.intensityLegendItem}>
                      <View style={[s.intensityLegendDot, { backgroundColor: colors.borderStrong }]} />
                      <Text style={s.intensityLegendText}>Low</Text>
                    </View>
                    <View style={s.intensityLegendItem}>
                      <View style={[s.intensityLegendDot, { backgroundColor: colors.accent }]} />
                      <Text style={s.intensityLegendText}>Moderate</Text>
                    </View>
                    <View style={s.intensityLegendItem}>
                      <View style={[s.intensityLegendDot, { backgroundColor: colors.virtueBad }]} />
                      <Text style={s.intensityLegendText}>High</Text>
                    </View>
                  </View>
                </View>
              </View>
            )}

            {distortionBreakdown.length > 0 && (
              <View style={s.insightCard}>
                <Text style={s.insightCardTitle}>Recurring distortions</Text>
                {distortionBreakdown.map((item, idx) => (
                  <View key={idx} style={[s.insightRow, { alignItems: 'center', marginBottom: 10 }]}>
                    <Text style={[s.insightEmotionLabel, { flex: 1, marginBottom: 0 }]}>{item.label}</Text>
                    <View style={s.insightPill}>
                      <Text style={s.insightPillText}>{item.count}×</Text>
                    </View>
                  </View>
                ))}
                <Text style={s.insightFootnote}>Let these patterns inform your reflection below.</Text>
              </View>
            )}

            {/* Reflection prompts */}
            {reviewPrompts.map((p, idx) => (
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
            ))}

            {/* V · Ledger — pure honest self-assessment, no pre-fill */}
            <View style={s.promptCard}>
              <View style={s.promptTopRow}>
                <Text style={s.promptNum}>V · Ledger</Text>
              </View>
              <Text style={s.promptQ}>Which Virtue did I most embody this week, and which did I fall short on?</Text>
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
  safe: { flex: 1, backgroundColor: colors.bg },
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
  // Stats
  statRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  stat: { flex: 1, backgroundColor: colors.bgCard, borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.md, padding: 16, alignItems: 'center' },
  statNum: { fontSize: 30, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 },
  statLbl: { fontSize: 10, color: colors.textDim, letterSpacing: 1, textTransform: 'uppercase', textAlign: 'center', lineHeight: 16 },
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
  // Insight cards (shared by emotions, distortions, virtue ledger)
  insightCard: { borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.lg, padding: 18, marginBottom: 14, backgroundColor: colors.bgCard },
  insightCardTitle: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.accent, textTransform: 'uppercase', marginBottom: 12 },
  insightRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  insightRowLeft: { flex: 1, marginRight: 12 },
  insightRowRight: { alignItems: 'flex-end' },
  insightEmotionLabel: { fontSize: 14, color: colors.textSecondary, marginBottom: 6 },
  insightBar: { height: 3, backgroundColor: colors.border, borderRadius: 2, overflow: 'hidden', flexDirection: 'row' },
  insightBarFill: { height: 3, borderRadius: 2 },
  insightCount: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: 2 },
  insightIntensity: { fontSize: 11, color: colors.textDim, letterSpacing: 0.5 },
  insightPill: { borderWidth: 0.5, borderColor: colors.borderMid, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  insightPillText: { fontSize: 12, color: colors.textMuted },
  insightFootnote: { fontSize: 12, color: colors.textMuted, marginTop: 4, marginBottom: 8, lineHeight: 18 },
  sparkSection: { marginBottom: 4 },
  sparkLabel: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.textMuted, textTransform: 'uppercase', marginBottom: 14 },
  sparkChart: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 4 },
  sparkCol: { flex: 1, alignItems: 'center' },
  sparkBarTrack: { width: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  sparkBar: { width: '70%', borderRadius: 3, minHeight: 3 },
  sparkBaseline: { width: '70%', height: 1.5, backgroundColor: colors.border, borderRadius: 1 },
  sparkDay: { fontSize: 11, color: colors.textDim, marginTop: 8, letterSpacing: 0.4 },
  sparkDayToday: { color: colors.accent, fontWeight: '600' },
  sparkCaption: { fontSize: 12, color: colors.textMuted, marginTop: 14, textAlign: 'center', letterSpacing: 0.3, fontStyle: 'italic' },
  sparkDivider: { height: 0.5, backgroundColor: colors.border, marginTop: 18, marginBottom: 16 },
  intensityLegend: { marginTop: 14, paddingTop: 14, borderTopWidth: 0.5, borderTopColor: colors.border },
  intensityLegendLabel: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.textMuted, textTransform: 'uppercase', marginBottom: 10 },
  intensityLegendItems: { flexDirection: 'row', gap: 18, alignItems: 'center', flexWrap: 'wrap' },
  intensityLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  intensityLegendDot: { width: 10, height: 10, borderRadius: 5 },
  intensityLegendText: { fontSize: 13, color: colors.textSecondary, letterSpacing: 0.2 },
  // Virtue ledger (inside promptCard)
  ledgerHint: { fontSize: 13, color: colors.textMuted, lineHeight: 20, marginTop: 8 },
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
