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
import { GoldPrimary, GoldSecondary } from '../components/GoldButton';
import { HeroOverlayChip } from '../components/HeroOverlayChip';
import {
  getTodayReading, saveTodayReading, saveReadingInsight,
  getReadingHistory, getCompass,
  getReadingCounts, incrementReadingCount,
  READING_DAY_CAP, READING_MONTH_CAP,
} from '../store/db';
import { cancelJournalNotification } from '../notifications';
import * as haptics from '../lib/haptics';
import { track } from '../lib/analytics';
import { useMindfulSession } from '../lib/useMindfulSession';
import { useEntitlement } from '../lib/useEntitlement';
import { useKeyboardVisible } from '../lib/useKeyboardVisible';
import { useCaretScroll } from '../lib/useCaretScroll';
import { captureRef } from 'react-native-view-shot';
import { ReadingShareCard } from '../components/ReadingShareCard';
import { SaveHeart } from '../components/SaveHeart';
import { useMiniPlayerInset } from '../components/MiniMeditationPlayer';
import { PracticeHeader } from '../components/PracticeHeader';
import { STOIC_QUOTES, selectCandidates } from '../constants/stoicQuotes';
import { isAppWrittenCompassText } from '../constants/compassFields';

// Recover a quote id from stored reading text. Only needed for history rows
// written before store/db.js started persisting quote_id; normalisation
// mirrors lib/saved.js so wrapping quote marks and spacing don't defeat it.
const normaliseQuote = t => String(t || '')
  .replace(/[\u201C\u201D"\u2018\u2019']/g, '')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase();
const QUOTE_TEXT_TO_ID = new Map(
  STOIC_QUOTES.map(q => [normaliseQuote(q.quote ?? q.text), q.id])
);
const idForQuoteText = text => QUOTE_TEXT_TO_ID.get(normaliseQuote(text)) || null;

// Reading generation goes through our server proxy (api/generate-reading.js,
// deployed with the getmarcus.app site). The Anthropic key, system prompt,
// model, and token cap all live server-side — nothing sensitive ships in the
// JS bundle. EXPO_PUBLIC_READING_ENDPOINT can override for local testing
// (e.g. a `vercel dev` instance).
// www is the canonical host — the apex 307-redirects to it, and skipping
// the redirect saves a round-trip on every generation.
const READING_ENDPOINT =
  process.env.EXPO_PUBLIC_READING_ENDPOINT || 'https://www.getmarcus.app/api/generate-reading';

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
  const keyboardUp = useKeyboardVisible();
  // Reusable gate — locked actions push to paywall instead of executing.
  function requireAccess(action) {
    if (hasAccess) { action(); return; }
    if (hasAccess === null) return; // entitlement still loading — swallow the tap rather than misroute a subscriber
    router.push('/paywall');
  }
  const shareCardRef = useRef(null);
  const scrollRef = useRef(null);
  // Keep the caret above the keyboard + accessory bar as the insight grows
  // line by line (iOS only auto-scrolls on focus, not on caret wrap).
  const { onScroll, onGrow } = useCaretScroll(scrollRef);
  const generatingRef = useRef(false);
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

  async function generateReading({ userInitiated = false } = {}) {
    // In-flight guard: the focus effect re-calls this when the user bounces
    // away and back mid-generation; a second concurrent run produced
    // duplicate history entries and double-counted the rate caps. A ref
    // (not `loading` state) because the focus-effect closure goes stale.
    if (generatingRef.current) return;
    // Rate limit: protect AI cost per user. Cap enforces a reasonable
    // ceiling for normal use (most users generate ≤2/day) while catching
    // abuse before unit economics go negative.
    const counts = await getReadingCounts();
    if (counts.dayCount >= READING_DAY_CAP) {
      // Alert only on explicit taps — the focus effect auto-calls this and a
      // capped user got the same alert on every tab visit, forever.
      if (!userInitiated) return;
      Alert.alert(
        '',
        `You've generated ${READING_DAY_CAP} readings today. The daily limit resets at midnight — try again tomorrow.`,
      );
      return;
    }
    if (counts.monthCount >= READING_MONTH_CAP) {
      if (!userInitiated) return;
      Alert.alert(
        '',
        `You've reached this month's reading limit (${READING_MONTH_CAP}). It resets on the 1st.`,
      );
      return;
    }
    generatingRef.current = true;
    setLoading(true);
    setLoadingPhase(0);
    const phaseTimer = setTimeout(() => setLoadingPhase(1), 4000);
    try {
      const history = await getReadingHistory();
      const compass = await getCompass();
      const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
      const recentReflections = history.slice(0, 14).map((r, i) => r.reflection ? `(${i + 1}) ${r.reflection.substring(0, 160)}` : '').filter(Boolean).join('\n');
      const recentThemes = history.slice(0, 30).map(r => r.theme).filter(Boolean).join(', ');
      // Build the candidate pool: exclude every passage the user has already
      // been given. The daily reading is meant to be unique each day; only the
      // Practice screen quote deliberately returns to something (see
      // lib/saved.js). The AI does the resonance match against the user's
      // Compass — no virtue-level pre-filter; the Compass is the signal.
      //
      // History written before quote_id was persisted has no id, so fall back
      // to matching the stored text. Without this, every reading taken before
      // that fix would count as unseen and could be served a second time.
      const seenIds = history
        .map(r => r.quote_id || idForQuoteText(r.quote))
        .filter(Boolean);
      const candidates = selectCandidates({
        excludeIds: seenIds,
        limit: 24,
      });
      const candidateBlock = candidates
        .map(c => `- id: ${c.id}\n  quote: "${c.quote}"\n  author: ${c.author}\n  work: ${c.work}\n  source: ${c.source}\n  virtues: ${c.virtues.join(', ')}\n  themes: ${c.themes.join(', ')}`)
        .join('\n');

      // The Compass is only a signal once the user has written it. Until then
      // storage holds the onboarding seed text, and sending that would have
      // the reading resonate against words the app wrote about itself. Worse,
      // the server prompt lets the reflection "quietly echo language or ideas
      // from their Compass", so the boilerplate would come back at the user
      // in their first reading as if it were theirs. notifications.js has
      // always guarded this; the reading never did.
      const ownVoice = key => {
        const text = (compass?.[key] || '').trim();
        return isAppWrittenCompassText(text) ? '' : text;
      };
      // Built as a list so a Compass that is only partly written does not
      // send blank bullets, which is what the old per-line ternaries did.
      const ownLines = [
        ['- Why they practice: ', ownVoice('why')],
        ['- What they want to overcome: ', ownVoice('overcome')],
        ['- Who they aspire to be: ', ownVoice('aspire')],
      ].filter(([, text]) => text).map(([label, text]) => label + text);
      const compassBlock = ownLines.length
        ? `User's Compass — the durable signal of who they are and what they're working on:\n${ownLines.join('\n')}`
        : "The user has not written their Compass yet, so there is nothing personal to resonate against. Choose the candidate with the widest reach and keep the reflection general. Do not invent what they might be working on.";

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
          const response = await fetch(READING_ENDPOINT, {
            method: 'POST',
            signal: controller.signal,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userMessage }),
          });
          const data = await response.json();
          if (!response.ok) {
            console.log('Reading API non-OK:', response.status, JSON.stringify(data));
            throw new Error(`API ${response.status}: ${data?.error || 'unknown'}`);
          }
          const text = data.text || '';
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
      track('reading_generated');
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
          { text: 'Try again', onPress: () => generateReading({ userInitiated: true }) },
        ]
      );
    } finally {
      clearTimeout(phaseTimer);
      generatingRef.current = false;
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
      'https://getmarcus.app',
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
        `— ${reading.author}${reading.work && reading.work !== reading.author ? `, ${reading.work}` : ''}`,
        '',
        reading.reflection,
        '',
        '— Marcus · a daily Stoic practice',
        'https://getmarcus.app',
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
        onScroll={onScroll}
        scrollEventThrottle={16}
        // Extra paddingBottom while the keyboard is up so the insight input
        // (last element on the page) has scroll room to clear the keyboard
        // + accessory bar. Without it, iOS auto-adjust can't move the input
        // above the keyboard because there's nothing to scroll into.
        contentContainerStyle={{ paddingBottom: keyboardUp ? 320 : playerInset }}
        scrollIndicatorInsets={{ bottom: 36 }}
      >

          <View style={s.hero}>
            <Image
              source={require('../assets/heroes/read.jpg')}
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
                {new Date().toLocaleDateString('en-US', { weekday: 'long' })}{'\n'}
                {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
              </Text>
            </View>
            <View style={s.heroChipBottom}>
              <HeroOverlayChip
                onPress={() => router.push(`/read-archive?from=${encodeURIComponent(fromPath)}&fromLabel=${encodeURIComponent(fromLabel)}`)}
              >
                Past readings
              </HeroOverlayChip>
            </View>
          </View>

          <View style={s.body}>
            {loading ? (
              <SkullLoader text={loadingPhase === 0 ? 'Selecting your quote...' : 'Composing your reading...'} />
            ) : reading ? (
              <>
                <View style={s.quoteCard}>
                  {/* Heart sits left of the share icon: keeping a line is the
                      more common act, so it takes the position nearer the text. */}
                  <View style={s.quoteSaveIcon}>
                    <SaveHeart
                      text={reading.quote}
                      author={reading.author}
                      work={reading.work}
                      from="reading"
                      size={19}
                    />
                  </View>
                  <TouchableOpacity
                    style={s.quoteShareIcon}
                    onPress={handleShare}
                    activeOpacity={0.6}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel="Share this quote"
                  >
                    <Ionicons name="arrow-redo-outline" size={18} color={colors.accent} />
                  </TouchableOpacity>
                  <Text style={[s.quoteText, s.quoteTextWithIcon]}>“{reading.quote}”</Text>
                  <View style={s.quoteRule} />
                  <View style={s.quoteAuthorRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.quoteAuthor}>
                        {reading.author}{reading.work && reading.work !== reading.author ? ` · ${reading.work}` : ''}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => { if (!sourceHintOpen) Keyboard.dismiss(); setSourceHintOpen(!sourceHintOpen); }}
                      style={s.sourceHintBtn}
                      hitSlop={10}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="information-circle-outline" size={18} color={colors.accent} />
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
                    placeholderTextColor={colors.textSecondary}
                    value={insight}
                    onChangeText={text => setInsight(text)}
                    onFocus={() => { setInsightFocused(true); setSourceHintOpen(false); }}
                    onBlur={() => setInsightFocused(false)}
                    onContentSizeChange={onGrow('insight')}
                    scrollEnabled={false}
                    editable={!insightSaved && hasAccess}
                    keyboardAppearance="dark"
                    inputAccessoryViewID={Platform.OS === 'ios' ? 'readingInsightAccessory' : undefined}
                  />
                </TouchableOpacity>

              </>
            ) : (
              <GoldPrimary style={[s.readingBtn, s.readingBtnBody]} onPress={() => requireAccess(() => generateReading({ userInitiated: true }))}>
                <Text style={[s.readingBtnText, s.readingBtnFilledText]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>Generate today's reading</Text>
              </GoldPrimary>
            )}
          </View>

      </ScrollView>
      {Platform.OS === 'ios' && (
        <InputAccessoryView nativeID="readingInsightAccessory">
          <View style={s.accessoryBarPair}>
            <GoldSecondary
              style={s.readingBtn}
              onPress={() => Keyboard.dismiss()}
            >
              <Text style={s.readingBtnText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>Cancel</Text>
            </GoldSecondary>
            <GoldPrimary
              style={[s.readingBtn, !insight.trim() && { opacity: 0.4 }]}
              onPress={() => { Keyboard.dismiss(); handleSaveInsight(); }}
              disabled={!insight.trim()}
            >
              <Text style={[s.readingBtnText, s.readingBtnFilledText]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>Save</Text>
            </GoldPrimary>
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
    minHeight: 280,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'flex-start',
  },
  // Slight uniform zoom (5%) pushes the asset's baked-in edge lines outside
  // the container, where the hero's overflow:hidden clips them. Keeps aspect
  // (no distortion); crops ~2.5% off each side.
  heroImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%', transform: [{ scale: 1.05 }] },
  heroContent: { padding: spacing.xl, paddingTop: 52 },
  // Title row hosts the page title on the left and the Past-X chip on the
  // right, both bottom-aligned so the chip sits on the same baseline as the
  // last line of a multi-line title.
  heroTitleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  // Chip anchored bottom-right (asymmetric with the top-left heading) per V.
  heroChipBottom: { position: 'absolute', right: spacing.xl, bottom: spacing.xl },
  title: { fontSize: font.titleSize, fontFamily: font.display, color: colors.textPrimary, letterSpacing: -0.5, marginBottom: 8, textShadowColor: 'rgba(0,0,0,0.7)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 8 },
  // Light reading body
  body: { padding: spacing.md, backgroundColor: colors.bgCard },
  // Quote card stays dark — gravitas of the Stoic quote
  quoteCard: {
    borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.md,
    padding: 22, marginTop: 12, marginBottom: 12, backgroundColor: colors.bgDeep,
  },
  // 20px Inter Light Italic — unified quote treatment across the app (per V),
  // matching the hero quotes. Was Inter regular 19.
  quoteText: { fontSize: 20, color: colors.textPrimary, lineHeight: 30, fontFamily: font.bodyLightItalic, fontStyle: 'italic' },
  quoteRule: { height: 0.5, backgroundColor: colors.border, marginVertical: 16 },
  quoteAuthorRow: { flexDirection: 'row', alignItems: 'flex-start' },
  // Author · work on one gold uppercase tracked line — matches the
  // emotional-mastery / journal attribution exactly so all three pages align.
  quoteAuthor: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.accent, fontFamily: font.bodyMedium, textTransform: 'uppercase' },
  sourceHintBtn: { paddingLeft: 12, paddingTop: 2 },
  sourceHintBox: { marginTop: 14, padding: 14, backgroundColor: colors.bgElevated, borderRadius: radius.md, borderWidth: 0.5, borderColor: colors.border },
  sourceHintText: { fontSize: 13, color: colors.textSecondary, lineHeight: 20 },
  // Reflection — light
  reflectionCard: {
    borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.md,
    padding: 22, marginBottom: 12, backgroundColor: colors.bgElevated,
  },
  reflectionLabel: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.textSecondary, fontFamily: font.bodyMedium, textTransform: 'uppercase', marginBottom: 12 },
  // Body prose — matches compass.bodyText (Why / Overcome / Aspire sections).
  // Quote text above stays serif because it is an ancient passage; the
  // reflection is contemporary explanation and reads better sans-serif at length.
  // Inter to match the quote card for readability, with the same textPrimary
  // color. Hierarchy now comes from size alone (quote 19 / reflection 17).
  reflectionText: { fontSize: 17, color: colors.textPrimary, lineHeight: 28, fontFamily: font.body },
  // Input field treatment per Valeriya's library: subtle elevation above
  // screen bg, stroke shifts non-active (#474747) → active (#878787),
  // typed text dims (grey) when non-active / brightens (white) when active.
  insightCard: {
    borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.md,
    padding: 20, marginBottom: 12, backgroundColor: colors.inputBg,
  },
  insightCardActive: { borderColor: colors.inputBorderActive },
  insightLabel: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.textSecondary, fontFamily: font.bodyMedium, textTransform: 'uppercase', marginBottom: 4 },
  insightSub: { fontSize: 13, color: colors.textSecondary, marginBottom: 14 },
  insightInput: {
    fontSize: 16, color: colors.textPrimary, lineHeight: 26,
    minHeight: 56, textAlignVertical: 'top', fontFamily: font.body,
  },
  insightInputDim: { color: colors.textSecondary },
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
    minHeight: 44,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    marginTop: 8,
  },
  readingBtnBody: { minHeight: 56, marginBottom: 36 },
  readingBtnFilled: { backgroundColor: colors.accent },
  readingBtnText: { fontSize: 14, fontFamily: font.bodyMedium, color: colors.accent, letterSpacing: 0.3 },
  readingBtnFilledText: { color: '#1a1a1a' },
  quoteShareIcon: {
    position: 'absolute', top: 14, right: 14, zIndex: 1,
    padding: 4,
  },
  quoteSaveIcon: {
    position: 'absolute', top: 14, right: 48, zIndex: 1,
  },
  // Widened from 40 to clear both icons rather than just the share one.
  quoteTextWithIcon: { paddingRight: 78 },
});
