import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, TextInput,
  TouchableOpacity, StyleSheet, SafeAreaView, Alert,
  Platform, InputAccessoryView, Keyboard, Image, Share, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { colors, radius, spacing, font } from '../constants/theme';
import { virtues } from '../constants/virtues';
import { saveReview, updateReview, getReviews, getJournals, getTriggers, getRoles } from '../store/db';
import * as haptics from '../lib/haptics';
import { track } from '../lib/analytics';
import { useKeyboardVisible } from '../lib/useKeyboardVisible';
import { useEntitlement } from '../lib/useEntitlement';
import { GoldPrimary, GoldSecondary } from '../components/GoldButton';
import { HeroOverlayChip } from '../components/HeroOverlayChip';
import { captureRef } from 'react-native-view-shot';
import { ReviewShareCard } from '../components/ReviewShareCard';
import { useMiniPlayerInset } from '../components/MiniMeditationPlayer';
import { ScreenHeader } from '../components/ScreenHeader';
import { WizardHeader } from '../components/WizardHeader';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

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
  const fromPath = params?.from || '/';
  const fromLabel = params?.fromLabel || 'Practice';
  const [answers, setAnswers] = useState({});
  const [bestVirtue, setBestVirtue] = useState(virtues[0].id);
  const [worstVirtue, setWorstVirtue] = useState(virtues[3].id);
  const [intention, setIntention] = useState('');
  const [openPrompt, setOpenPrompt] = useState(-1);
  const [sealed, setSealed] = useState(false);
  const [openHint, setOpenHint] = useState(null);
  const promptInputRefs = useRef({});
  const intentionInputRef = useRef(null);
  const accountInputRef = useRef(null);
  const keyboardUp = useKeyboardVisible();
  const { hasAccess } = useEntitlement();
  function requireAccess(action) {
    if (hasAccess) { action(); return; }
    router.push('/paywall');
  }

  useFocusEffect(useCallback(() => {
    setOpenHint(null);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, []));
  const [history, setHistory] = useState([]);
  // The review (if any) already sealed in the current review window. Editing
  // it updates in place — re-opening the wizard used to start blank and seal
  // a duplicate entry for the same week.
  const [editingReview, setEditingReview] = useState(null);
  const savingRef = useRef(false);
  const [stats, setStats] = useState({ journaled: 0, triggers: 0, reframed: 0 });
  const shareCardRef = useRef(null);
  const scrollRef = useRef(null);
  const [shareEntry, setShareEntry] = useState(null);
  const [emotionBreakdown, setEmotionBreakdown] = useState([]);
  const [dailyIntensity, setDailyIntensity] = useState([]);
  const [roles, setRoles] = useState([]);

  // Wizard step model: 6 or 7 steps depending on whether the user has any
  // roles defined in Compass.
  //  0..3  → I-IV text prompts (Honor / Reckon / Pattern / Body)
  //  4     → V · Ledger virtue picker (no text input)
  //  5     → VI · Account roles input (only when roles.length > 0)
  //  last  → VI/VII · Commit intention input
  const totalSteps = roles.length > 0 ? 7 : 6;
  function stepKind(idx) {
    if (idx < 4) return 'text';
    if (idx === 4) return 'ledger';
    if (roles.length > 0 && idx === 5) return 'roles';
    return 'commit';
  }

  useEffect(() => {
    if (openPrompt < 0) return;
    if (!hasAccess) return;
    // Auto-focus the input that owns the current step so the keyboard
    // appears immediately. Ledger (virtue picker) has no input.
    const kind = stepKind(openPrompt);
    const t = setTimeout(() => {
      if (kind === 'text') promptInputRefs.current[openPrompt]?.focus();
      else if (kind === 'roles') accountInputRef.current?.focus();
      else if (kind === 'commit') intentionInputRef.current?.focus();
    }, 200);
    return () => clearTimeout(t);
  }, [openPrompt, hasAccess, roles.length]);

  function wizardBack() {
    haptics.tap();
    if (openPrompt > 0) {
      setOpenPrompt(openPrompt - 1);
    } else {
      setOpenPrompt(-1);
      Keyboard.dismiss();
    }
  }
  function wizardClose() {
    haptics.tap();
    setOpenPrompt(-1);
    Keyboard.dismiss();
  }
  function wizardNext() {
    haptics.tap();
    if (openPrompt < totalSteps - 1) {
      setOpenPrompt(openPrompt + 1);
    } else {
      Keyboard.dismiss();
      requireAccess(handleSave);
    }
  }

  useEffect(() => {
    async function load() {
      const reviews = await getReviews();
      setHistory(reviews);
      // Pre-load this window's review (same 3-day window the Practice
      // screen uses for its done-state) so "Edit this week's review"
      // actually edits instead of duplicating.
      const windowMs = 3 * 86400000;
      const current = reviews.find(r => Date.now() - new Date(r.date).getTime() < windowMs);
      if (current) {
        setEditingReview(current);
        setAnswers(current.answers || {});
        if (current.bestVirtue) setBestVirtue(current.bestVirtue);
        if (current.worstVirtue) setWorstVirtue(current.worstVirtue);
        setIntention(current.intention || '');
      }
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

  // Gate sealing on at least one prompt answer OR an intention. Virtue picks
  // alone aren't enough — the textual reflection is what makes a sealed
  // week meaningful.
  const canSeal = Object.values(answers).some(v => v && v.trim().length > 0)
    || (intention || '').trim().length > 0;

  async function handleSave() {
    // savingRef guards double-taps on the final wizard step — two quick
    // taps on Seal used to save two entries.
    if (!canSeal || savingRef.current) return;
    savingRef.current = true;
    try {
      if (editingReview) {
        // Re-sealing within the same window updates the existing entry.
        const entry = { ...editingReview, answers, bestVirtue, worstVirtue, intention, stats };
        await updateReview(entry);
        setEditingReview(entry);
      } else {
        const entry = {
          id: Date.now().toString(),
          date: new Date().toISOString(),
          weekOf: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          answers, bestVirtue, worstVirtue, intention, stats,
        };
        await saveReview(entry);
        setEditingReview(entry);
      }
      track('review_sealed', { edited: !!editingReview });
      haptics.success();
      const updated = await getReviews();
      setHistory(updated);
      // Show the dedicated "Week sealed" moment (independent of the daily
      // practice seal), then the user continues to Practice from there.
      setSealed(true);
    } finally {
      savingRef.current = false;
    }
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

  // Dedicated "Week sealed" moment, shown right after the review is saved —
  // independent of the daily practice seal. Mirrors the practice hero's
  // centered type language (gold eyebrow, Didot date/quote, Inter body).
  if (sealed) {
    const sealedDate = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    return (
      <View style={s.weekSealedRoot}>
        <Image source={require('../assets/bg-svg4.png')} style={s.weekSealedBg} resizeMode="cover" pointerEvents="none" />
        <SafeAreaView style={s.weekSealedSafe}>
          <View style={s.weekSealedBody}>
            <Image source={require('../assets/skull-gold.png')} style={s.weekSealedSkull} resizeMode="contain" />
            <Text style={s.weekSealedEyebrow}>Week sealed</Text>
            <Text style={s.weekSealedDate}>{sealedDate}</Text>
            <Text style={s.weekSealedTitle}>The week is examined</Text>
            <Text style={s.weekSealedSub}>You have looked back with honesty. Carry what it taught you into the week ahead.</Text>
          </View>
          <View style={s.weekSealedFooter}>
            <GoldPrimary style={s.weekSealedBtn} onPress={() => router.replace('/')}>
              <Text style={s.weekSealedBtnText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>Go to Practice →</Text>
            </GoldPrimary>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      {openPrompt < 0 ? (
        <ScreenHeader fromPath={fromPath} fromLabel={fromLabel} />
      ) : (
        <WizardHeader
          title="Weekly Review"
          step={openPrompt}
          total={totalSteps}
          onBack={wizardBack}
          onClose={wizardClose}
        />
      )}
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
        <ScrollView
          ref={scrollRef}
          style={[s.scroll, { backgroundColor: colors.bgCard }]}
          showsVerticalScrollIndicator={false}
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
            colors={['rgba(0,0,0,0.85)', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.2)', 'rgba(0,0,0,0.55)']}
            locations={[0, 0.25, 0.6, 1]}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={s.heroContent}>
            <Text style={s.title}>
              {`Week of ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`}
            </Text>
          </View>
          <View style={s.heroChipBottom}>
            <HeroOverlayChip onPress={() => router.push('/review-archive')}>
              Past reviews
            </HeroOverlayChip>
          </View>
        </View>

        {openPrompt < 0 ? (
          // Landing — hero is already rendered above; remaining landing chrome
          // is the memento quote and the Begin CTA. Tapping Begin enters the
          // wizard at step 0.
          <View style={s.body}>
            <View style={s.reviewMementoStrip}>
              <Text style={s.reviewMementoText}>
                "Look back over the past, with its changing empires that rose and fell, and you can foresee the future too."
              </Text>
              <Text style={s.reviewMementoSub}>
                Marcus Aurelius · Meditations VII.49
              </Text>
            </View>
            <GoldPrimary
              style={[s.editBtn, s.sealBtn]}
              onPress={() => requireAccess(() => { haptics.tap(); setOpenPrompt(0); })}
            >
              <Text style={[s.editBtnText, s.editBtnSaveText]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                {editingReview ? 'Edit this week\'s review' : 'Begin weekly review'}
              </Text>
            </GoldPrimary>
            <Text style={s.sealBtnSub}>
              {totalSteps} steps · about 10 minutes
            </Text>
          </View>
        ) : (
          // Wizard — one step per page. Renders text prompt / Ledger picker /
          // roles input / Commit input depending on stepKind(openPrompt).
          <View style={s.body}>
            {stepKind(openPrompt) === 'text' && (() => {
              const idx = openPrompt;
              const p = reviewPrompts[idx];
              const isPattern = p.key === 'challenges';
              const days = dailyIntensity.filter(d => d.avg !== null);
              const showPatternData = isPattern && days.length > 0;
              return (
              <View key={p.key} style={[s.promptCard, s.promptCardOpen]}>
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
                            ? colors.border
                            : d.avg >= 7 ? colors.accentDim
                            : d.avg >= 4 ? colors.accent
                            : colors.border;
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
                <View style={s.promptAnswer}>
                  <TextInput
                    ref={el => { promptInputRefs.current[idx] = el; }}
                    style={s.promptInput}
                    multiline
                    placeholder={hasAccess ? "Write here. No judgment, only honesty..." : "Start your 7-day free trial to write."}
                    placeholderTextColor={colors.textSecondary}
                    value={answers[p.key] || ''}
                    onFocus={() => setOpenHint(null)}
                    onChangeText={text => setAnswers(prev => ({ ...prev, [p.key]: text }))}
                    editable={hasAccess}
                    scrollEnabled={false}
                    keyboardAppearance="dark"
                    inputAccessoryViewID={Platform.OS === 'ios' ? 'reviewWizardAccessory' : undefined}
                  />
                </View>
              </View>
              );
            })()}

            {/* V · Ledger — pure honest self-assessment, no pre-fill */}
            {stepKind(openPrompt) === 'ledger' && (
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
                  <Text style={s.hintText}>The four Virtues are inseparable. Wisdom without Justice is shallow. Courage without Temperance is recklessness. This question is not which Virtue you remembered to do; it is a sober assessment of where the unified character was tested most, and where it held.</Text>
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
                      <Text style={[s.vpBtnText, bestVirtue === v.id && { color: colors.accent, fontFamily: font.bodySemiBold }]}>
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
                      <Text style={[s.vpBtnText, worstVirtue === v.id && { color: colors.accentDim, fontFamily: font.bodySemiBold }]}>
                        {v.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
            )}

            {/* VI · Account — role-fulfillment, only when user has defined
                roles in their Compass. */}
            {stepKind(openPrompt) === 'roles' && (
              <View style={s.promptCard}>
                <View style={s.promptTopRow}>
                  <Text style={s.promptNum}>VI · Account</Text>
                  <TouchableOpacity
                    style={s.hintBtn}
                    onPress={() => setOpenHint(openHint === 'account' ? null : 'account')}
                  >
                    <Text style={s.hintBtnText}>ⓘ</Text>
                  </TouchableOpacity>
                </View>
                <Text style={s.promptQ}>Which role did I serve well this week? Which fell short?</Text>
                {openHint === 'account' && (
                  <View style={s.hintBox}>
                    <Text style={s.hintText}>These are the roles you defined in your Compass — parent, friend, citizen, worker. Edit them there if they have shifted. Epictetus held that virtue is not abstract; it is paid out through the specific parts each person is called to play. The week is the natural unit to test how those parts were served. A sober accounting here, not a defense.</Text>
                  </View>
                )}
                <View style={s.roleChipRow}>
                  {roles.map(r => (
                    <View key={r.id} style={s.roleChip}>
                      <Text style={s.roleChipText}>{r.name}</Text>
                    </View>
                  ))}
                </View>
                <TextInput
                  ref={accountInputRef}
                  style={s.intentionInput}
                  multiline
                  placeholder={hasAccess ? "Be specific. Name names, name moments..." : "Start your 7-day free trial to write."}
                  placeholderTextColor={colors.textSecondary}
                  value={answers.roles || ''}
                  onChangeText={text => setAnswers(prev => ({ ...prev, roles: text }))}
                  onFocus={() => setOpenHint(null)}
                  editable={hasAccess}
                  scrollEnabled={false}
                  inputAccessoryViewID={Platform.OS === 'ios' ? 'reviewWizardAccessory' : undefined}
                />
              </View>
            )}

            {/* Commit — the output of all reflection above. Numbered VII
                when the Roles · Account prompt is present, otherwise VI. */}
            {stepKind(openPrompt) === 'commit' && (
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
                placeholder={hasAccess ? "Write it as a commitment, not a wish..." : "Start your 7-day free trial to write."}
                placeholderTextColor={colors.textSecondary}
                value={intention}
                    onFocus={() => setOpenHint(null)}
                onChangeText={setIntention}
                editable={hasAccess}
                scrollEnabled={false}
                inputAccessoryViewID={Platform.OS === 'ios' ? 'reviewWizardAccessory' : undefined}
              />
            </View>
            )}

            {/* Body Back/Next row — visible when the keyboard is dismissed.
                Mirrors the accessory bar. On the last step Next becomes
                Seal and triggers save. */}
            {!keyboardUp && (
              <View style={s.wizardNavRow}>
                <GoldSecondary onPress={wizardBack} style={s.editBtn}>
                  <Text style={s.editBtnText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>Back</Text>
                </GoldSecondary>
                {openPrompt < totalSteps - 1 ? (
                  <GoldPrimary onPress={wizardNext} style={s.editBtn}>
                    <Text style={[s.editBtnText, s.editBtnSaveText]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>Next</Text>
                  </GoldPrimary>
                ) : (
                  <GoldPrimary
                    onPress={wizardNext}
                    disabled={!canSeal}
                    style={[s.editBtn, !canSeal && s.sealBtnDisabled]}
                  >
                    <Text style={[s.editBtnText, s.editBtnSaveText]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                      Seal this week
                    </Text>
                  </GoldPrimary>
                )}
              </View>
            )}

          </View>
        )}

        </ScrollView>
      {Platform.OS === 'ios' && (
        // Single accessory bar shared by all wizard inputs (text prompts,
        // Account roles input, Commit intention input). Buttons call the
        // shared wizardBack / wizardNext handlers — same semantics as the
        // body Back/Next row that shows when the keyboard is dismissed.
        <InputAccessoryView nativeID="reviewWizardAccessory">
          <View style={s.accessoryBarPair}>
            <GoldSecondary style={s.editBtn} onPress={wizardBack}>
              <Text style={s.editBtnText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>Back</Text>
            </GoldSecondary>
            {openPrompt < totalSteps - 1 ? (
              <GoldPrimary style={s.editBtn} onPress={wizardNext}>
                <Text style={[s.editBtnText, s.editBtnSaveText]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>Next</Text>
              </GoldPrimary>
            ) : (
              <GoldPrimary
                style={[s.editBtn, !canSeal && s.sealBtnDisabled]}
                onPress={wizardNext}
                disabled={!canSeal}
              >
                <Text style={[s.editBtnText, s.editBtnSaveText]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>Seal</Text>
              </GoldPrimary>
            )}
          </View>
        </InputAccessoryView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgDeep },
  // "Week sealed" screen (shown after the review saves). Mirrors the practice
  // hero / threshold language: bg-svg4 wave, centered, gold eyebrow, Didot
  // date, Inter body, gold CTA pinned at the bottom.
  weekSealedRoot: { flex: 1, backgroundColor: '#050505', overflow: 'hidden' },
  weekSealedBg: { position: 'absolute', top: 0, left: 0, width: SCREEN_W, height: SCREEN_H },
  weekSealedSafe: { flex: 1, backgroundColor: 'transparent' },
  weekSealedBody: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36, paddingBottom: 40 },
  weekSealedSkull: { width: 150, height: 150, marginBottom: 40, opacity: 1 },
  weekSealedEyebrow: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.accent, fontFamily: font.bodyMedium, textTransform: 'uppercase', marginBottom: 10, textAlign: 'center' },
  weekSealedDate: { fontSize: font.titleSize, fontFamily: font.display, color: colors.textPrimary, letterSpacing: -0.5, marginBottom: 28, textAlign: 'center' },
  // marginTop opens a clear gap between the WEEK SEALED / date header and the
  // "examined" message, so the message reads as a distinct, lower beat (per V).
  weekSealedTitle: { fontSize: 20, color: colors.textPrimary, fontFamily: font.bodyMedium, marginTop: 44, marginBottom: 10, textAlign: 'center' },
  weekSealedSub: { fontSize: 17, color: colors.textSecondary, fontFamily: font.body, lineHeight: 26, textAlign: 'center' },
  weekSealedFooter: { paddingHorizontal: 24, paddingBottom: 24 },
  weekSealedBtn: { borderRadius: radius.md, height: 56 },
  weekSealedBtnText: { fontSize: 15, fontFamily: font.bodyBold, color: '#000', letterSpacing: 0.3 },
  shareCardOffscreen: { position: 'absolute', left: -99999, top: 0 },
  scroll: { flex: 1 },
  hero: {
    backgroundColor: colors.bgDeep,
    minHeight: 280,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'flex-start',
  },
  heroImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  heroContent: { padding: spacing.xl, paddingTop: 52 },
  // Title row hosts the page title on the left and the Past-X chip on the
  // right, both bottom-aligned so the chip sits on the same baseline.
  heroTitleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  // Chip anchored bottom-right (asymmetric with the top-left heading) per V.
  heroChipBottom: { position: 'absolute', right: spacing.xl, bottom: spacing.xl },
  title: { fontSize: font.titleSize, fontFamily: font.display, color: colors.textPrimary, letterSpacing: -0.5, marginBottom: 8, textShadowColor: 'rgba(0,0,0,0.7)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 8 },
  body: { padding: spacing.md },
  // Prompts
  // Input field treatment per Valeriya's library: subtle elevation above
  // screen bg, with stroke shifting between non-active (#474747) and
  // active (#878787) focus states.
  promptCard: { borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.md, padding: 20, marginBottom: 10, backgroundColor: colors.inputBg },
  promptCardOpen: { borderColor: colors.inputBorderActive },
  promptTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  promptNum: { fontSize: 11, letterSpacing: 1.8, color: colors.accent, fontFamily: font.bodyMedium, textTransform: 'uppercase' },
  promptQ: { fontSize: 15, color: colors.textPrimary, lineHeight: 24, fontFamily: font.body },
  promptAnswer: { marginTop: 16, borderTopWidth: 0.5, borderTopColor: colors.border, paddingTop: 16 },
  promptInput: { fontSize: 16, color: colors.textPrimary, lineHeight: 26, minHeight: 56, textAlignVertical: 'top', fontFamily: font.body },
  nextPromptBtn: { marginTop: 12, alignSelf: 'flex-end', paddingVertical: 8, paddingHorizontal: 4 },
  nextPromptText: { fontSize: 12, color: colors.accent, letterSpacing: 1, fontFamily: font.bodyMedium, textTransform: 'uppercase' },
  // Library tokens for keyboard accessory bar — H56 outlined/filled pair.
  accessoryBarPair: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: colors.bg,
    borderTopWidth: 0.5,
    borderTopColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  // H44 keyboard accessory per library. In-body sealBtn overrides to 56.
  editBtn: {
    flex: 1,
    height: 44,
    borderRadius: radius.md,
    paddingHorizontal: 16,
  },
  editBtnSave: { backgroundColor: colors.accent },
  editBtnText: { fontSize: 14, fontFamily: font.bodyMedium, color: colors.accent, letterSpacing: 0.3 },
  editBtnSaveText: { color: '#1a1a1a' },
  hintBtn: { padding: 4 },
  hintBtnText: { fontSize: 18, color: colors.accent },
  hintBox: { marginTop: 14, padding: 14, backgroundColor: colors.bg, borderRadius: radius.md, borderWidth: 0.5, borderColor: colors.border },
  hintText: { fontSize: 16, color: colors.textSecondary, lineHeight: 26 },
  // Inline pattern context — appears inside the III · Pattern card to
  // ground the question in the week's actual data without preceding it
  // with a separate analytics surface.
  patternData: { marginBottom: 16, paddingBottom: 16, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  patternSummary: { fontSize: 13, color: colors.textSecondary, marginBottom: 12, letterSpacing: 0.2, lineHeight: 19 },
  sparkChart: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 4 },
  sparkCol: { flex: 1, alignItems: 'center' },
  sparkBarTrack: { width: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  sparkBar: { width: '70%', borderRadius: 3, minHeight: 3 },
  sparkBaseline: { width: '70%', height: 1.5, backgroundColor: colors.border, borderRadius: 1 },
  sparkDay: { fontSize: 11, color: colors.textSecondary, marginTop: 8, letterSpacing: 0.4 },
  sparkDayToday: { color: colors.accent, fontFamily: font.bodySemiBold },
  // Virtue ledger (inside promptCard)
  virtueRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  virtuePicker: { flex: 1, borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.md, overflow: 'hidden' },
  vpLabel: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.accent, fontFamily: font.bodyMedium, textTransform: 'uppercase', padding: 12, paddingHorizontal: 14, backgroundColor: colors.bgDeep, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  vpBtn: { padding: 13, paddingHorizontal: 14, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  vpBtnActive: { backgroundColor: colors.bgElevated },
  vpBtnText: { fontSize: 15, color: colors.textSecondary },
  // Intention
  intentionCard: { borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.md, padding: 18, marginBottom: 14, backgroundColor: colors.inputBg },
  intentionInput: { fontSize: 16, color: colors.textPrimary, lineHeight: 26, minHeight: 56, textAlignVertical: 'top', marginTop: 12, fontFamily: font.body },
  // Role chip strip shown above the VI · Account textarea to remind the
  // user which roles are in scope while reflecting on the week. Warm
  // accent tint so they read against the dark prompt card.
  roleChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12, marginBottom: 4 },
  roleChip: {
    borderWidth: 0.5, borderColor: colors.accentDim, borderRadius: 14,
    paddingHorizontal: 10, paddingVertical: 4, backgroundColor: colors.bg,
  },
  roleChipText: { fontSize: 12, color: colors.accent, letterSpacing: 0.3 },
  // Seal button
  // In-body primary CTA reuses library editBtn + editBtnSave; this override
  // just adds spacing below the button before the caption.
  // In-body primary CTA — H56 override (no-keyboard primary per library).
  sealBtn: { height: 56, marginBottom: 12 },
  // Disabled state — gated on at least one prompt OR intention having content.
  sealBtnDisabled: { opacity: 0.4 },
  sealBtnSub: { fontSize: 12, color: colors.textSecondary, textAlign: 'center', marginBottom: 36 },
  // Memento strip on the review landing — same treatment as the
  // journal/emotions mementos. Carries Marcus's "look back over the past..."
  // anchor before the user enters the wizard.
  // Quiet black card — matches the journal memento card exactly. Sits inside
  // the body's spacing.md padding (no negative margins / full-bleed anymore).
  reviewMementoStrip: {
    backgroundColor: colors.bgCard,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.xl,
    paddingVertical: 20,
    marginBottom: 16,
  },
  // 20px Inter Light Italic — unified quote treatment across the app (matches
  // the Daily Reading / Journal / Emotions card quotes). Was Inter regular 17.
  reviewMementoText: { fontSize: 20, color: colors.textPrimary, lineHeight: 30, fontFamily: font.bodyLightItalic, fontStyle: 'italic' },
  // Gold uppercase attribution — matches the unified treatment across the app
  // (onboarding / journal / emotions / read). Was Inter 13 gray title-case.
  reviewMementoSub: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.accent, fontFamily: font.bodyMedium, textTransform: 'uppercase', marginTop: 10 },
  // Wizard Back/Next pair shown when the keyboard is dismissed. The
  // InputAccessoryView covers the keyboard-up case.
  wizardNavRow: { flexDirection: 'row', gap: 10, marginTop: 14, marginBottom: 36 },
});
