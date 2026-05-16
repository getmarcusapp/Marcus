import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TextInput,
  TouchableOpacity, StyleSheet, SafeAreaView, Alert, ActivityIndicator,
  Platform, Image, Share, InputAccessoryView, Keyboard,
} from 'react-native';
import { useFocusEffect, useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import SkullLoader from '../components/SkullLoader';
import { colors, radius, spacing, font } from '../constants/theme';
import {
  getTodayReading, saveTodayReading, saveReadingInsight,
  getReadingHistory, getCompass,
  getReadingCounts, incrementReadingCount,
  READING_DAY_CAP, READING_MONTH_CAP,
} from '../store/db';
import { cancelJournalNotification } from '../notifications';
import * as haptics from '../lib/haptics';
import { useMindfulSession } from '../lib/useMindfulSession';
import { useEntitlement } from '../lib/useEntitlement';
import { captureRef } from 'react-native-view-shot';
import { ReadingShareCard } from '../components/ReadingShareCard';
import { useMiniPlayerInset } from '../components/MiniMeditationPlayer';
import { PracticeHeader } from '../components/PracticeHeader';
import { STOIC_QUOTES, selectCandidates } from '../constants/stoicQuotes';

const SYSTEM_PROMPT = `You are a curator of Stoic and philosophical wisdom generating a personalized daily reading for a user of a Stoic practice app.

CRITICAL: You will be given a list of CANDIDATE QUOTES with their authors, works, and source citations. You MUST select your quote from this candidate list — do not generate, paraphrase, or substitute any quote. Use the exact quote text and exact attribution as provided. This is non-negotiable: misattribution destroys user trust.

Your job is to:
1. Select the candidate that best resonates with the user's Compass — what brought them to the practice, what they want to overcome, who they aspire to be.
2. Write a 3–4 sentence reflection in the second person that connects the quote to the user's practice. The reflection may quietly echo language or ideas from their Compass when it earns the connection — never quote the Compass back at them.

Output this EXACT JSON format with no other text:
{
  "quote_id": "the id of the candidate you selected",
  "quote": "the exact quote text from the candidate (verbatim)",
  "author": "the exact author from the candidate (verbatim)",
  "work": "the exact work from the candidate (verbatim)",
  "theme": "2-4 word Stoic theme",
  "virtue": "Wisdom|Courage|Temperance|Justice",
  "reflection": "A 3-4 sentence reflection in second person, grounded in the user's Compass when it earns the connection."
}

Rules:
- Pick the quote whose theme genuinely speaks to something in the user's Compass. Prefer relevance over rotation.
- Reflection must be original and specific to the chosen quote — no generic Stoic platitudes.
- Match the virtue field to the dominant virtue of the chosen candidate.
- Do not use temporal markers (today, yesterday, this week, recently) in the reflection — the reading should read as timeless.`;

function normalizeQuote(q) {
  return (q || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim().slice(0, 80);
}

function findDuplicateQuote(quote, history) {
  const target = normalizeQuote(quote);
  if (!target) return null;
  return history.find(h => normalizeQuote(h.quote) === target) || null;
}

export default function ReadScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const fromPath = params?.from || '/';
  const fromLabel = params?.fromLabel || 'Practice';
  const [reading, setReading] = useState(null);
  const [insight, setInsight] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState(0);
  const [insightSaved, setInsightSaved] = useState(false);
  const [sourceHintOpen, setSourceHintOpen] = useState(false);
  // Per Valeriya's library, insight card switches stroke + text color on focus.
  const [insightFocused, setInsightFocused] = useState(false);
  const { hasAccess } = useEntitlement();
  // Reusable gate — locked actions push to paywall instead of executing.
  function requireAccess(action) {
    if (hasAccess) { action(); return; }
    router.push('/paywall');
  }
  const shareCardRef = useRef(null);
  const scrollRef = useRef(null);
  const commitMindfulSession = useMindfulSession();
  const playerInset = useMiniPlayerInset();

  useFocusEffect(useCallback(() => {
    async function load() {
      const cached = await getTodayReading();
      if (cached) {
        setReading(cached);
        if (cached.insight) {
          setInsight(cached.insight);
          setInsightSaved(true);
        }
      } else {
        // Auto-generate one reading per day for every user — free or paid.
        // This is the deliberate trial-preview behavior: free users get a
        // personalized reading shaped by their Compass to demonstrate the
        // value, but can't write/save insights or regenerate (those gate
        // on hasAccess via requireAccess). Daily cap is enforced by
        // getTodayReading caching the day's result.
        generateReading();
      }
    }
    load();
    // Reset scaffolding state on focus.
    setSourceHintOpen(false);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, []));

  async function generateReading() {
    // Rate limit: protect AI cost per user. Cap enforces a reasonable
    // ceiling for normal use (most users generate ≤2/day) while catching
    // abuse before unit economics go negative.
    const counts = await getReadingCounts();
    if (counts.dayCount >= READING_DAY_CAP) {
      Alert.alert(
        '',
        `You've generated ${READING_DAY_CAP} readings today. The daily limit resets at midnight — try again tomorrow.`,
      );
      return;
    }
    if (counts.monthCount >= READING_MONTH_CAP) {
      Alert.alert(
        '',
        `You've reached this month's reading limit (${READING_MONTH_CAP}). It resets on the 1st.`,
      );
      return;
    }
    setLoading(true);
    setLoadingPhase(0);
    const phaseTimer = setTimeout(() => setLoadingPhase(1), 4000);
    try {
      const history = await getReadingHistory();
      const compass = await getCompass();
      const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
      const recentReflections = history.slice(0, 14).map((r, i) => r.reflection ? `(${i + 1}) ${r.reflection.substring(0, 160)}` : '').filter(Boolean).join('\n');
      const recentThemes = history.slice(0, 30).map(r => r.theme).filter(Boolean).join(', ');
      // Build the candidate pool: exclude any quote ids the user has seen
      // recently. The AI does the resonance match against the user's
      // Compass — no virtue-level pre-filter; the Compass is the signal.
      const recentIds = history.slice(0, 60).map(r => r.quote_id).filter(Boolean);
      const candidates = selectCandidates({
        excludeIds: recentIds,
        limit: 24,
      });
      const candidateBlock = candidates
        .map(c => `- id: ${c.id}\n  quote: "${c.quote}"\n  author: ${c.author}\n  work: ${c.work}\n  source: ${c.source}\n  virtues: ${c.virtues.join(', ')}\n  themes: ${c.themes.join(', ')}`)
        .join('\n');

      const compassBlock = compass && (compass.why || compass.overcome || compass.aspire)
        ? `User's Compass — the durable signal of who they are and what they're working on:
${compass.why ? `- Why they practice: ${compass.why}` : ''}
${compass.overcome ? `- What they want to overcome: ${compass.overcome}` : ''}
${compass.aspire ? `- Who they aspire to be: ${compass.aspire}` : ''}`
        : '';

      async function callOnce({ dedupNote } = {}) {
        const dedupLine = dedupNote ? `\n\n${dedupNote}\n` : '';
        const userMessage = `Today is ${dateStr}.

${compassBlock}

CANDIDATE QUOTES — choose exactly one and copy its quote/author/work verbatim into your output:
${candidateBlock}

Recent themes to vary from: ${recentThemes || 'none'}
Recent reflections to vary from in style and angle:
${recentReflections || 'none'}${dedupLine}
Return only the JSON object.`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000);
        try {
          const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            signal: controller.signal,
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': process.env.EXPO_PUBLIC_ANTHROPIC_KEY,
              'anthropic-version': '2023-06-01',
              'anthropic-dangerous-direct-browser-access': 'true',
            },
            body: JSON.stringify({
              model: 'claude-sonnet-4-6',
              max_tokens: 2048,
              system: SYSTEM_PROMPT,
              messages: [{ role: 'user', content: userMessage }],
            }),
          });
          const data = await response.json();
          if (!response.ok) {
            console.log('Reading API non-OK:', response.status, JSON.stringify(data));
            throw new Error(`API ${response.status}: ${data?.error?.message || 'unknown'}`);
          }
          const textBlock = Array.isArray(data.content)
            ? data.content.filter(b => b.type === 'text').pop()
            : null;
          const text = textBlock?.text || data.content?.[0]?.text || '';
          const stripped = text.replace(/```json|```/g, '').trim();
          const start = stripped.indexOf('{');
          const end = stripped.lastIndexOf('}');
          if (start === -1 || end === -1 || end <= start) {
            console.log('Reading: no JSON object in response. Raw text:', stripped.slice(0, 500));
            throw new Error('Model did not return JSON');
          }
          return JSON.parse(stripped.slice(start, end + 1));
        } finally {
          clearTimeout(timeoutId);
        }
      }

      let result = await callOnce();

      // Canonical-source guard: even if the AI tried to alter the quote
      // text, look up by quote_id and substitute the verified text/author/
      // work from the corpus. Eliminates any residual misattribution risk.
      const canonical = result?.quote_id
        ? STOIC_QUOTES.find(q => q.id === result.quote_id)
        : null;
      if (canonical) {
        result.quote = canonical.quote;
        result.author = canonical.author;
        result.work = canonical.work;
      } else {
        console.log('Reading: AI returned an unknown quote_id, attempting fallback. id =', result?.quote_id);
      }

      const dup = findDuplicateQuote(result?.quote, history);
      if (dup) {
        const dupDate = dup.date ? new Date(dup.date).toDateString() : 'a previous day';
        console.log('Reading: duplicate quote detected, retrying. Quote:', result.quote?.slice(0, 60), 'first used:', dupDate);
        result = await callOnce({
          dedupNote: `IMPORTANT: You returned a quote we already used on ${dupDate}: "${(dup.quote || '').slice(0, 120)}". Pick a fundamentally different quote (different id, different author).`,
        });
        const canonical2 = result?.quote_id
          ? STOIC_QUOTES.find(q => q.id === result.quote_id)
          : null;
        if (canonical2) {
          result.quote = canonical2.quote;
          result.author = canonical2.author;
          result.work = canonical2.work;
        }
      }

      await saveTodayReading(result);
      // Only count successful generations against the rate limit. Failed
      // API calls don't deduct from the user's budget.
      await incrementReadingCount();
      cancelJournalNotification('reading');
      setReading(result);
      setInsight('');
      setInsightSaved(false);
    } catch (e) {
      const isTimeout = e?.name === 'AbortError';
      console.log('Reading generation failed:', isTimeout ? 'timeout' : e?.message, e);
      Alert.alert(
        '',
        isTimeout
          ? 'The reading is taking longer than expected. Try again?'
          : 'Could not generate reading right now.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Try again', onPress: () => generateReading() },
        ]
      );
    } finally {
      clearTimeout(phaseTimer);
      setLoading(false);
      setLoadingPhase(0);
    }
  }

  async function handleSaveInsight() {
    if (!insight.trim()) return;
    await saveReadingInsight(insight);
    haptics.action();
    commitMindfulSession();
    setInsightSaved(true);
    // Auto-advance to the literal next step in the practice sequence.
    router.replace('/journal?type=morning');
  }

  async function handleShare() {
    if (!reading) return;
    haptics.tap();
    // Image card carries the quote + attribution; text body carries the
    // reflection (the personalized 'why this passage today' beat) so the
    // share is both visually iconic and substantively differentiated.
    const message = [
      reading.reflection,
      '',
      '— Marcus · a daily Stoic practice',
    ].filter(Boolean).join('\n');
    try {
      const uri = await captureRef(shareCardRef, {
        format: 'jpg',
        quality: 0.92,
        result: 'tmpfile',
      });
      await Share.share({ url: uri, message });
    } catch (e) {
      console.log('Share image failed, falling back to text:', e?.message);
      const lines = [
        `"${reading.quote}"`,
        `— ${reading.author}${reading.work ? `, ${reading.work}` : ''}`,
        '',
        reading.reflection,
        '',
        '— Marcus · a daily Stoic practice',
      ];
      try {
        await Share.share({ message: lines.filter(Boolean).join('\n') });
      } catch (e2) {
        console.log('Share text fallback failed:', e2?.message);
      }
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <PracticeHeader current="reading" />
      {/* Off-screen share card. Rendered into the layout tree so captureRef
          can reach it but positioned far off-screen so the user never sees
          it directly. Only mounted once a reading exists to avoid empty
          captures during loading. */}
      {reading && (
        <View
          ref={shareCardRef}
          collapsable={false}
          style={s.shareCardOffscreen}
        >
          <ReadingShareCard
            quote={reading.quote}
            author={reading.author}
            work={reading.work}
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
              source={require('../assets/heroes/read.jpg')}
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
                {new Date().toLocaleDateString('en-US', { weekday: 'long' })}{'\n'}
                {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
              </Text>
            </View>
          </View>

          <View style={s.pastReadingsRow}>
            <TouchableOpacity
              onPress={() => router.push(`/read-archive?from=${encodeURIComponent(fromPath)}&fromLabel=${encodeURIComponent(fromLabel)}`)}
              style={s.pastReadingsBtn}
              activeOpacity={0.8}
            >
              <Text style={s.pastReadingsText}>Past readings</Text>
              <Ionicons name="arrow-forward" size={14} color={colors.accent} style={{ marginTop: 2 }} />
            </TouchableOpacity>
          </View>

          <View style={s.body}>
            {loading ? (
              <SkullLoader text={loadingPhase === 0 ? 'Selecting your quote...' : 'Composing your reading...'} />
            ) : reading ? (
              <>
                <View style={s.quoteCard}>
                  <TouchableOpacity style={s.quoteShareIcon} onPress={handleShare} activeOpacity={0.6} hitSlop={10}>
                    <Ionicons name="share-outline" size={20} color={colors.accent} />
                  </TouchableOpacity>
                  <Text style={[s.quoteText, s.quoteTextWithIcon]}>“{reading.quote}”</Text>
                  <View style={s.quoteRule} />
                  <View style={s.quoteAuthorRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.quoteAuthor}>— {reading.author}</Text>
                      {reading.work && <Text style={s.quoteWork}>{reading.work}</Text>}
                    </View>
                    <TouchableOpacity
                      onPress={() => setSourceHintOpen(!sourceHintOpen)}
                      style={s.sourceHintBtn}
                      hitSlop={10}
                      activeOpacity={0.7}
                    >
                      <Text style={s.sourceHintBtnText}>ⓘ</Text>
                    </TouchableOpacity>
                  </View>
                  {sourceHintOpen && (
                    <View style={s.sourceHintBox}>
                      <Text style={s.sourceHintText}>
                        Selected for you based on your Compass and recent practice. Not every reading comes from a Stoic text. Each is chosen because it carries a lesson the Stoics would recognize.
                      </Text>
                    </View>
                  )}
                </View>

                <View style={s.reflectionCard}>
                  <Text style={s.reflectionLabel}>Reflection</Text>
                  <Text style={s.reflectionText}>{reading.reflection}</Text>
                </View>

                <TouchableOpacity
                  style={[s.insightCard, insightFocused && s.insightCardActive]}
                  activeOpacity={hasAccess ? 1 : 0.85}
                  onPress={hasAccess ? undefined : () => router.push('/paywall')}
                >
                  <View style={s.insightLabelRow}>
                    <Text style={s.insightLabel}>Your insight</Text>
                    {insightSaved && (
                      <TouchableOpacity onPress={() => setInsightSaved(false)} activeOpacity={0.7}>
                        <Text style={s.insightEditBtn}>Edit</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  {!insightSaved && (
                    <Text style={s.insightSub}>What does this mean for you today?</Text>
                  )}
                  <TextInput
                    style={[s.insightInput, insightSaved && s.insightInputSaved, !insightFocused && !insightSaved && s.insightInputDim]}
                    multiline
                    placeholder={hasAccess ? "Write your reaction, insight, or intention..." : "Start your 7-day free trial to write an insight"}
                    placeholderTextColor={colors.textDim}
                    value={insight}
                    onChangeText={text => setInsight(text)}
                    onFocus={() => setInsightFocused(true)}
                    onBlur={() => setInsightFocused(false)}
                    scrollEnabled={false}
                    editable={!insightSaved && hasAccess}
                    keyboardAppearance="dark"
                    inputAccessoryViewID={Platform.OS === 'ios' ? 'readingInsightAccessory' : undefined}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[s.readingBtn, s.readingBtnBody]}
                  onPress={() => requireAccess(() => generateReading())}
                  activeOpacity={0.8}
                >
                  <Text style={s.readingBtnText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>Generate new reading</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity style={[s.readingBtn, s.readingBtnBody, s.readingBtnFilled]} onPress={() => requireAccess(() => generateReading())} activeOpacity={0.8}>
                <Text style={[s.readingBtnText, s.readingBtnFilledText]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>Generate today's reading</Text>
              </TouchableOpacity>
            )}
          </View>

      </ScrollView>
      {Platform.OS === 'ios' && hasAccess && (
        <InputAccessoryView nativeID="readingInsightAccessory">
          <View style={s.accessoryBarPair}>
            <TouchableOpacity
              style={s.readingBtn}
              onPress={() => Keyboard.dismiss()}
              activeOpacity={0.8}
            >
              <Text style={s.readingBtnText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.readingBtn, s.readingBtnFilled, !insight.trim() && { opacity: 0.4 }]}
              onPress={() => { Keyboard.dismiss(); handleSaveInsight(); }}
              activeOpacity={0.8}
              disabled={!insight.trim()}
            >
              <Text style={[s.readingBtnText, s.readingBtnFilledText]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>Save insight</Text>
            </TouchableOpacity>
          </View>
        </InputAccessoryView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgDeep },
  // Position the share card far off-screen so it's laid out (so captureRef
  // can find it) but never visible to the user. left:-99999 keeps it out
  // of the visible viewport on every device.
  shareCardOffscreen: { position: 'absolute', left: -99999, top: 0 },
  scroll: { flex: 1 },
  // Dark header with hero image
  hero: {
    backgroundColor: colors.bgDeep,
    minHeight: 260,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  heroImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  heroContent: { padding: spacing.xl, paddingTop: 52 },
  title: { fontSize: font.titleSize, fontWeight: '300', color: colors.textPrimary, letterSpacing: -0.5, marginBottom: 8, textShadowColor: 'rgba(0,0,0,0.7)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 8 },
  // "Past readings" link below the hero — uses Valeriya's library
  // smaller-button outlined-gold token (same as EDIT chips / nav pills).
  pastReadingsRow: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 20, paddingVertical: 14, backgroundColor: colors.bgDeep, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  pastReadingsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.md,
  },
  pastReadingsText: { fontSize: 12, fontWeight: '600', color: colors.accent, letterSpacing: 1, textTransform: 'uppercase' },
  // Light reading body
  body: { padding: spacing.md, backgroundColor: colors.bgCard },
  // Quote card stays dark — gravitas of the Stoic quote
  quoteCard: {
    borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.lg,
    padding: 22, marginTop: 12, marginBottom: 12, backgroundColor: colors.bgDeep,
  },
  quoteText: { fontSize: 19, color: colors.textPrimary, lineHeight: 32, fontFamily: font.serif },
  quoteRule: { height: 0.5, backgroundColor: colors.border, marginVertical: 16 },
  quoteAuthorRow: { flexDirection: 'row', alignItems: 'flex-start' },
  quoteAuthor: { fontSize: 14, color: colors.textSecondary, fontWeight: '500' },
  quoteWork: { fontSize: 12, color: colors.textDim, marginTop: 3 },
  sourceHintBtn: { paddingLeft: 12, paddingTop: 2 },
  sourceHintBtnText: { fontSize: 16, color: colors.accent },
  sourceHintBox: { marginTop: 14, padding: 14, backgroundColor: colors.bgElevated, borderRadius: radius.md, borderWidth: 0.5, borderColor: colors.border },
  sourceHintText: { fontSize: 13, color: colors.textMuted, lineHeight: 20 },
  // Reflection — light
  reflectionCard: {
    borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.lg,
    padding: 22, marginBottom: 12, backgroundColor: colors.bgElevated,
  },
  reflectionLabel: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.textMuted, textTransform: 'uppercase', marginBottom: 12 },
  // Body prose — matches compass.bodyText (Why / Overcome / Aspire sections).
  // Quote text above stays serif because it is an ancient passage; the
  // reflection is contemporary explanation and reads better sans-serif at length.
  reflectionText: { fontSize: 17, color: colors.textSecondary, lineHeight: 28 },
  // Input field treatment per Valeriya's library: subtle elevation above
  // screen bg, stroke shifts non-active (#474747) → active (#878787),
  // typed text dims (grey) when non-active / brightens (white) when active.
  insightCard: {
    borderWidth: 0.5, borderColor: colors.inputBorder, borderRadius: radius.lg,
    padding: 20, marginBottom: 12, backgroundColor: colors.inputBg,
  },
  insightCardActive: { borderColor: colors.inputBorderActive },
  insightLabel: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.textMuted, textTransform: 'uppercase', marginBottom: 4 },
  insightSub: { fontSize: 13, color: colors.textDim, marginBottom: 14 },
  insightInput: {
    fontSize: 16, color: colors.textPrimary, lineHeight: 26,
    minHeight: 120, textAlignVertical: 'top', paddingBottom: 60,
  },
  insightInputDim: { color: colors.textMuted },
  insightInputSaved: { color: colors.textSecondary, minHeight: 0 },
  insightLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  insightEditBtn: { fontSize: 13, color: colors.accent, letterSpacing: 0.3 },
  // Reading action buttons — library H56 tokens. Outlined-gold default
  // for the secondary action (New reading), filled-gold for the primary
  // commit action (Save insight, Generate today's reading).
  accessoryBarPair: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: colors.bg,
    borderTopWidth: 0.5, borderTopColor: colors.border,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  // H44 keyboard accessory per library. In-body usages override with
  // readingBtnBody to bring back to H56 no-keyboard primary.
  readingBtn: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    marginTop: 8,
  },
  readingBtnBody: { height: 56 },
  readingBtnFilled: { backgroundColor: colors.accent },
  readingBtnText: { fontSize: 14, fontWeight: '500', color: colors.accent, letterSpacing: 0.3 },
  readingBtnFilledText: { color: '#1a1a1a' },
  quoteShareIcon: {
    position: 'absolute', top: 12, right: 12, zIndex: 1,
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 0.5, borderColor: colors.accentDim, backgroundColor: colors.accentBg,
    alignItems: 'center', justifyContent: 'center',
  },
  quoteTextWithIcon: { paddingRight: 40 },
});
