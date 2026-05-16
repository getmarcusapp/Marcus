import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, TextInput,
  TouchableOpacity, StyleSheet, SafeAreaView, Alert,
  Platform, InputAccessoryView, Keyboard, Image, Share,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { colors, radius, spacing, font } from '../constants/theme';
import { virtues } from '../constants/virtues';
import { saveReview, getReviews, getJournals, getTriggers, getRoles } from '../store/db';
import * as haptics from '../lib/haptics';
import { useKeyboardVisible } from '../lib/useKeyboardVisible';
import { useEntitlement } from '../lib/useEntitlement';
import { captureRef } from 'react-native-view-shot';
import { ReviewShareCard } from '../components/ReviewShareCard';
import { useMiniPlayerInset } from '../components/MiniMeditationPlayer';
import { ScreenHeader } from '../components/ScreenHeader';

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

  useEffect(() => {
    if (openPrompt < 0) return;
    // iOS handles scroll-into-view via automaticallyAdjustKeyboardInsets;
    // breathing room above the keyboard comes from paddingBottom inside the
    // TextInput rather than fighting iOS's scroll.
    const t = setTimeout(() => promptInputRefs.current[openPrompt]?.focus(), 200);
    return () => clearTimeout(t);
  }, [openPrompt]);

  useFocusEffect(useCallback(() => {
    setOpenHint(null);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, []));
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState({ journaled: 0, triggers: 0, reframed: 0 });
  const shareCardRef = useRef(null);
  const scrollRef = useRef(null);
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

  // Gate sealing on at least one prompt answer OR an intention. Virtue picks
  // alone aren't enough — the textual reflection is what makes a sealed
  // week meaningful.
  const canSeal = Object.values(answers).some(v => v && v.trim().length > 0)
    || (intention || '').trim().length > 0;

  async function handleSave() {
    if (!canSeal) return;
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
    // Return to Practice — the Weekly Review tile renders in its sealed
    // state there, which is the in-context acknowledgment. Share lives on
    // every review-archive entry for users who want it later.
    router.replace('/');
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
      <ScreenHeader fromPath={fromPath} fromLabel={fromLabel} />
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
            colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.85)']}
            locations={[0, 0.55, 0.8, 1]}
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
            activeOpacity={0.8}
          >
            <Text style={s.pastReviewsText}>Past reviews</Text>
            <Ionicons name="arrow-forward" size={14} color={colors.accent} style={{ marginTop: 2 }} />
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
                      placeholder={hasAccess ? "Write here. No judgment, only honesty..." : "Start your 7-day free trial to write."}
                      placeholderTextColor={colors.textDim}
                      value={answers[p.key] || ''}
                      onChangeText={text => setAnswers(prev => ({ ...prev, [p.key]: text }))}
                      editable={hasAccess}
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
                  placeholderTextColor={colors.textDim}
                  value={answers.roles || ''}
                  onChangeText={text => setAnswers(prev => ({ ...prev, roles: text }))}
                  editable={hasAccess}
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
                placeholder={hasAccess ? "Write it as a commitment, not a wish..." : "Start your 7-day free trial to write."}
                placeholderTextColor={colors.textDim}
                value={intention}
                onChangeText={setIntention}
                editable={hasAccess}
                scrollEnabled={false}
                inputAccessoryViewID={Platform.OS === 'ios' ? 'reviewIntentionAccessory' : undefined}
              />
            </View>

            {!keyboardUp && (
              <>
                <TouchableOpacity
                  style={[s.editBtn, s.editBtnSave, s.sealBtn, !canSeal && s.sealBtnDisabled]}
                  onPress={() => requireAccess(handleSave)}
                  activeOpacity={0.8}
                  disabled={!canSeal}
                >
                  <Text style={[s.editBtnText, s.editBtnSaveText]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>Seal this week</Text>
                </TouchableOpacity>
                <Text style={s.sealBtnSub}>
                  {canSeal ? 'Saved to your review archive' : 'Answer at least one prompt to seal'}
                </Text>
              </>
            )}

          </View>

        </ScrollView>
      {Platform.OS === 'ios' && hasAccess && (
        <>
          <InputAccessoryView nativeID="reviewPromptAccessory">
            <View style={s.accessoryBarPair}>
              <TouchableOpacity
                style={s.editBtn}
                onPress={() => {
                  haptics.tap();
                  if (openPrompt > 0) {
                    setOpenPrompt(openPrompt - 1);
                  } else {
                    setOpenPrompt(-1);
                    Keyboard.dismiss();
                  }
                }}
                activeOpacity={0.8}
              >
                <Text style={s.editBtnText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>Back</Text>
              </TouchableOpacity>
              {openPrompt < reviewPrompts.length - 1 ? (
                <TouchableOpacity
                  style={[s.editBtn, s.editBtnSave]}
                  onPress={() => { haptics.tap(); setOpenPrompt(openPrompt + 1); }}
                  activeOpacity={0.8}
                >
                  <Text style={[s.editBtnText, s.editBtnSaveText]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>Next prompt</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={[s.editBtn, s.editBtnSave]} onPress={() => Keyboard.dismiss()} activeOpacity={0.8}>
                  <Text style={[s.editBtnText, s.editBtnSaveText]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>Continue</Text>
                </TouchableOpacity>
              )}
            </View>
          </InputAccessoryView>
          {/* VI · Account — auto-focus Commit, since there's still one prompt after */}
          <InputAccessoryView nativeID="reviewAccountAccessory">
            <View style={s.accessoryBarPair}>
              <TouchableOpacity
                style={s.editBtn}
                onPress={() => {
                  haptics.tap();
                  // Back from Account → return to last reflection prompt (V · Ledger).
                  setOpenPrompt(reviewPrompts.length - 1);
                }}
                activeOpacity={0.8}
              >
                <Text style={s.editBtnText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.editBtn, s.editBtnSave]}
                onPress={() => { haptics.tap(); intentionInputRef.current?.focus(); }}
                activeOpacity={0.8}
              >
                <Text style={[s.editBtnText, s.editBtnSaveText]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>Next prompt</Text>
              </TouchableOpacity>
            </View>
          </InputAccessoryView>
          {/* VII · Commit — final prompt; Seal triggers save */}
          <InputAccessoryView nativeID="reviewIntentionAccessory">
            <View style={s.accessoryBarPair}>
              <TouchableOpacity
                style={s.editBtn}
                onPress={() => {
                  haptics.tap();
                  // Back from Commit → return to Account if roles exist, else last prompt.
                  if (roles.length > 0) {
                    accountInputRef.current?.focus();
                  } else {
                    setOpenPrompt(reviewPrompts.length - 1);
                  }
                }}
                activeOpacity={0.8}
              >
                <Text style={s.editBtnText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.editBtn, s.editBtnSave, !canSeal && s.sealBtnDisabled]}
                onPress={() => { Keyboard.dismiss(); requireAccess(handleSave); }}
                activeOpacity={0.8}
                disabled={!canSeal}
              >
                <Text style={[s.editBtnText, s.editBtnSaveText]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>Seal this week</Text>
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
  title: { fontSize: font.titleSize, fontWeight: '300', color: colors.textPrimary, letterSpacing: -0.5, marginBottom: 8, textShadowColor: 'rgba(0,0,0,0.7)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 8 },
  // "Past reviews" link below the hero — uses Valeriya's library
  // smaller-button outlined-gold token (matches Past entries / Past readings).
  pastReviewsRow: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 20, paddingVertical: 14, backgroundColor: colors.bgDeep, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  pastReviewsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.md,
  },
  pastReviewsText: { fontSize: 12, fontWeight: '600', color: colors.accent, letterSpacing: 1, textTransform: 'uppercase' },
  body: { padding: spacing.md },
  // Prompts
  // Input field treatment per Valeriya's library: subtle elevation above
  // screen bg, with stroke shifting between non-active (#474747) and
  // active (#878787) focus states.
  promptCard: { borderWidth: 0.5, borderColor: colors.inputBorder, borderRadius: radius.lg, padding: 20, marginBottom: 10, backgroundColor: colors.inputBg },
  promptCardOpen: { borderColor: colors.inputBorderActive },
  promptTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  promptNum: { fontSize: font.microSize, letterSpacing: 2, color: colors.accent, textTransform: 'uppercase' },
  promptQ: { fontSize: 15, color: colors.textPrimary, lineHeight: 24, fontWeight: '400' },
  promptAnswer: { marginTop: 16, borderTopWidth: 0.5, borderTopColor: colors.border, paddingTop: 16 },
  promptInput: { fontSize: 16, color: colors.textPrimary, lineHeight: 26, minHeight: 100, textAlignVertical: 'top', paddingBottom: 60 },
  nextPromptBtn: { marginTop: 12, alignSelf: 'flex-end', paddingVertical: 8, paddingHorizontal: 4 },
  nextPromptText: { fontSize: 12, color: colors.accent, letterSpacing: 1, textTransform: 'uppercase' },
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
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editBtnSave: { backgroundColor: colors.accent },
  editBtnText: { fontSize: 14, fontWeight: '500', color: colors.accent, letterSpacing: 0.3 },
  editBtnSaveText: { color: '#1a1a1a' },
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
  intentionInput: { fontSize: 16, color: colors.textPrimary, lineHeight: 26, minHeight: 90, textAlignVertical: 'top', marginTop: 12, paddingBottom: 60 },
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
  // In-body primary CTA reuses library editBtn + editBtnSave; this override
  // just adds spacing below the button before the caption.
  // In-body primary CTA — H56 override (no-keyboard primary per library).
  sealBtn: { height: 56, marginBottom: 12 },
  // Disabled state — gated on at least one prompt OR intention having content.
  sealBtnDisabled: { opacity: 0.4 },
  sealBtnSub: { fontSize: 12, color: colors.textDim, textAlign: 'center', marginBottom: 36 },
});
