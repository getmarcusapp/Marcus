import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TextInput,
  TouchableOpacity, StyleSheet, SafeAreaView, Alert,
  Platform, InputAccessoryView, Keyboard,
  ActivityIndicator, Image,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { MEDITATIONS, useMeditationPlayer, toggle as toggleMeditation, formatMedTime } from '../lib/meditationPlayer';
import { useMiniPlayerInset } from '../components/MiniMeditationPlayer';
import { QuoteActions } from '../components/QuoteActions';
import { useQuoteShare } from '../lib/useQuoteShare';
import { splitAttribution } from '../lib/saved';
import { ReadingShareCard } from '../components/ReadingShareCard';
import { useCaretScroll } from '../lib/useCaretScroll';
import { PracticeHeader } from '../components/PracticeHeader';
import { WizardHeader } from '../components/WizardHeader';
import { HeroOverlayChip } from '../components/HeroOverlayChip';
import { colors, radius, spacing, font } from '../constants/theme';
import { GoldPrimary, GoldSecondary } from '../components/GoldButton';

import { saveJournal, getTodayJournal, incrementStreak } from '../store/db';
import { cancelJournalNotification } from '../notifications';
import * as haptics from '../lib/haptics';
import { track } from '../lib/analytics';
import * as health from '../lib/health';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMindfulSession } from '../lib/useMindfulSession';
import { useKeyboardVisible } from '../lib/useKeyboardVisible';
import { useEntitlement } from '../lib/useEntitlement';

async function maybeAskHealthPermission() {
  const asked = await AsyncStorage.getItem('health_permission_asked');
  if (asked === 'true') return;
  const available = await health.isAvailable();
  if (!available) return;
  Alert.alert(
    'Sync to Apple Health?',
    'Marcus can record each practice you complete as Mindful Minutes, so your reflection time joins the rest of your wellness data. You can change this anytime in Settings.',
    [
      {
        text: 'Maybe later',
        style: 'cancel',
        onPress: async () => { await AsyncStorage.setItem('health_permission_asked', 'true'); },
      },
      {
        text: 'Connect',
        onPress: async () => {
          await health.requestPermission();
          await AsyncStorage.setItem('health_permission_asked', 'true');
        },
      },
    ],
  );
}

// Morning + Evening prompts live in constants/journalPrompts.js so the
// Past Entries view can render the same prompt copy when displaying or
// editing past entries.
import { morningPrompts, eveningPromptsInOrder, UNDONE_KEY } from '../constants/journalPrompts';

const virtuePronunciations = {
  sophia: 'soh-FEE-ah',
  andreia: 'an-DRAY-ah',
  sophrosyne: 'soh-FROH-sih-nee',
  dikaiosyne: 'dee-KAY-oh-sih-nee',
};

// Morning memento quotes rotate day to day so the pre-writing landing does not
// go stale. The Serenity Prayer earns its place: it is the dichotomy of control
// compressed to three lines (Epictetus in later dress), and its Courage/Wisdom
// name two of the four cardinal virtues the app is built around. Kept in its
// secular "Give me" form, not "God grant me", to hold Marcus's non-religious
// register. Add more entries here to extend the rotation.
const MORNING_MEMENTOS = [
  {
    text: '"When you wake, expect to meet people who are difficult: meddling, arrogant, ungrateful. They are this way because they cannot tell good from evil. But they share your nature, and no one can truly harm you. You were made to work with them, not against them."',
    attr: 'Marcus Aurelius · Meditations II.1',
  },
  {
    text: '"Give me the Serenity to accept the things I cannot change,\nThe Courage to change the things I can,\nAnd the Wisdom to know the difference."',
    attr: 'The Serenity Prayer',
  },
  {
    text: '"Some things are within our control and some are not. Within our control are opinion, desire, aversion, and, in a word, whatever is our own doing. Not within our control are the body, property, and reputation, whatever is not our own doing."',
    attr: 'Epictetus · Enchiridion 1',
  },
  {
    text: '"Begin at once to live, and count each separate day as a separate life."',
    attr: 'Seneca · Letters 101',
  },
  {
    text: '"At dawn, when you have trouble getting out of bed, tell yourself: I have to go to work, as a human being. What do I have to complain of, if I\'m going to do what I was born for, the things I was brought into the world to do?"',
    attr: 'Marcus Aurelius · Meditations V.1',
  },
  {
    text: '"Men are disturbed not by things, but by the views which they take of them."',
    attr: 'Epictetus · Enchiridion 5',
  },
];

// Evening mementos rotate the same way. Themed for day's-end: examination,
// acceptance, retreat, release. Seen daily (like morning), so it carries a
// full rotation. Add {text, attr} entries to extend.
const EVENING_MEMENTOS = [
  {
    text: '"Ask yourself at day\'s end: What did I do well? What did I do badly? What did I leave undone? Walk through each in turn."',
    attr: 'Epictetus · Discourses III.10',
  },
  {
    text: '"Let us go to our sleep with joy and gladness; let us say, I have lived, and have run the course that Fortune set for me."',
    attr: 'Seneca · Letters 12',
  },
  {
    text: '"Nowhere can you find a more peaceful or untroubled retreat than in your own soul. Give yourself this retreat, and renew yourself."',
    attr: 'Marcus Aurelius · Meditations IV.3',
  },
  {
    text: '"Do not seek to have events happen as you want them to, but wish them to happen as they do, and your life will go well."',
    attr: 'Epictetus · Enchiridion 8',
  },
  {
    text: '"You could leave life right now. Let that determine what you do and say and think."',
    attr: 'Marcus Aurelius · Meditations II.11',
  },
];

export default function JournalScreen() {
  const router = useRouter();
  const playerInset = useMiniPlayerInset();
  const params = useLocalSearchParams();
  const fromPath = params?.from || '/';
  const fromLabel = params?.fromLabel || 'Practice';
  const defaultType = params?.type || (new Date().getHours() < 13 ? 'morning' : 'evening');
  const [sessionType, setSessionType] = useState(defaultType);
  const isMorning = sessionType !== 'evening';
  const commitMindfulSession = useMindfulSession();
  const keyboardUp = useKeyboardVisible();
  const { hasAccess } = useEntitlement();
  function requireAccess(action) {
    if (hasAccess) { action(); return; }
    if (hasAccess === null) return; // entitlement still loading — swallow the tap rather than misroute a subscriber
    router.push('/paywall');
  }
  const journalMedPlayer = useMeditationPlayer();
  const { cardRef: shareCardRef, pending: pendingShare, shareQuote } = useQuoteShare('journal');

  // Sync sessionType when navigating here explicitly from practice with a type param
  useEffect(() => {
    if (params?.type) {
      setSessionType(params.type);
    }
  }, [params?.type]);
  const [answers, setAnswers] = useState({});
  const [openPrompt, setOpenPrompt] = useState(-1);
  // onLanding is defined below, after wizardPrompts.
  const [openHint, setOpenHint] = useState(null);
  const promptInputRefs = useRef({});
  const scrollRef = useRef(null);
  // Keep the caret above the keyboard + accessory bar as an answer grows
  // line by line (iOS only auto-scrolls on focus, not on caret wrap).
  const { onScroll, onGrow } = useCaretScroll(scrollRef);

  useEffect(() => {
    if (openPrompt < 0) return;
    // Focus the input shortly after the card expands. iOS handles the
    // scroll-into-view automatically via automaticallyAdjustKeyboardInsets;
    // breathing room above the keyboard comes from paddingBottom inside the
    // TextInput rather than us fighting iOS's scroll position.
    // Skip the focus attempt entirely when locked — the input is
    // editable={false} but iOS partially registers the focus and leaves
    // the InputAccessoryView floating above the tab bar.
    if (!hasAccess) return;
    const t = setTimeout(() => promptInputRefs.current[openPrompt]?.focus(), 200);
    return () => clearTimeout(t);
  }, [openPrompt, hasAccess]);
  const [alreadySaved, setAlreadySaved] = useState(false);
  // Loop-closure: what the user committed to this morning (III · Name,
  // falling back to II · Brace). Seeds the Reckoning — a conditional first
  // step in the evening wizard where the nightly examination audits the
  // morning's intention — Seneca's whole point. { lead, text, question }
  // or null when there's nothing to reckon with.
  const [morningEcho, setMorningEcho] = useState(null);

  // Loads the morning commitment that seeds the evening's conditional first
  // wizard step (the Reckoning). Called on mount/session-switch AND on every
  // focus — the screen stays mounted in the tab navigator, so without the
  // focus refresh it could miss a just-written morning entry or show
  // yesterday's after midnight.
  const loadMorningEcho = useCallback(async () => {
    if (isMorning) { setMorningEcho(null); return; }
    const morning = await getTodayJournal('morning');
    const named = morning?.answers?.[2]?.trim();
    const braced = morning?.answers?.[1]?.trim();
    // No `question` here — III · Undone supplies it now.
    if (named) setMorningEcho({ lead: 'You named what you were postponing:', text: named });
    else if (braced) setMorningEcho({ lead: 'You braced for:', text: braced });
    else setMorningEcho(null);
  }, [isMorning]);

  // Wizard step list. Evening always runs the same five steps, rendered in
  // display order (see the storage-contract note in constants/journalPrompts).
  // When the user journaled this morning, the commitment they named is merged
  // into III · Undone as context above its question — the nightly examination
  // auditing the morning's intention, which was Seneca's whole point. It rides
  // on that prompt rather than adding a step, so the evening length is
  // constant whether or not a morning entry exists.
  const wizardPrompts = React.useMemo(() => {
    if (isMorning) return morningPrompts.map((p, i) => ({ ...p, answerKey: i }));
    return eveningPromptsInOrder.map(p =>
      p.answerKey === UNDONE_KEY && morningEcho
        ? { ...p, reckon: true, echoLead: morningEcho.lead, echoText: morningEcho.text }
        : p
    );
  }, [isMorning, morningEcho]);

  // True when the user is on the landing screen. Out-of-range openPrompt
  // values are treated as landing too — that catches the race when the
  // user switches morning <-> evening while openPrompt was set deeper
  // than the new flow's step count.
  const onLanding = openPrompt < 0 || openPrompt >= wizardPrompts.length;

  useEffect(() => {
    async function reload() {
      const existing = await getTodayJournal(isMorning ? 'morning' : 'evening');
      if (existing) { setAnswers(existing.answers || {}); setAlreadySaved(true); }
      else { setAnswers({}); setAlreadySaved(false); }
      loadMorningEcho();
    }
    reload();
    // Reset wizard position when switching morning <-> evening — the two
    // prompt arrays have different lengths (morning: 5, evening: 4), so
    // an openPrompt index valid for one can be out of range for the other.
    setOpenPrompt(-1);
  }, [sessionType]);

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    (async () => {
      const existing = await getTodayJournal(isMorning ? 'morning' : 'evening');
      if (cancelled) return;
      setAlreadySaved(!!existing);
      // Hydrate from storage only when nothing is typed locally. A refocus
      // happens mid-wizard too (tab switch, paywall bounce, Past entries),
      // and the previous unconditional setAnswers({}) erased every unsaved
      // answer the user had typed. Unsaved local text always wins here; the
      // mount/sessionType effect above handles the clean-slate cases.
      if (existing) {
        setAnswers(prev =>
          Object.values(prev).some(v => v && v.trim().length > 0) ? prev : (existing.answers || {})
        );
      }
      loadMorningEcho();
    })();
    // Reset scaffolding state on focus — info bubbles are help, not user input.
    setOpenHint(null);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    return () => { cancelled = true; };
  }, [sessionType, loadMorningEcho]));

  const answeredCount = Math.min(Object.values(answers).filter(v => v && v.trim().length > 0).length, wizardPrompts.length);
  // Gate completion on at least one prompt having content. An empty
  // "completion" defeats the purpose of journaling and pollutes the
  // archive with no-op entries. The caption swaps to a prompt asking
  // the user to answer at least one when the button is disabled.
  const canSave = answeredCount > 0;

  const savingJournalRef = useRef(false);
  async function handleSave() {
    // In-flight guard: double-tapping Complete ran the whole pipeline twice
    // (two Health-permission alerts on a first save, double mindful session).
    if (!canSave || savingJournalRef.current) return;
    savingJournalRef.current = true;
    const entry = {
      id: Date.now().toString(),
      type: isMorning ? 'morning' : 'evening',
      date: new Date().toISOString(),
      answers,
    };
    // Preserve what the reckoning was ABOUT — the answer alone ("yes,
    // finally") is meaningless in the archive without the morning's words.
    // Keyed to III · Undone, which the morning echo now rides on.
    if (answers[UNDONE_KEY]?.trim() && morningEcho) {
      entry.reckonOf = morningEcho.text;
    }
    const ok = await saveJournal(entry);
    if (ok) {
      track('journal_saved', { type: isMorning ? 'morning' : 'evening' });
      haptics.success();
      commitMindfulSession();
      cancelJournalNotification(isMorning ? 'morning' : 'evening');
      maybeAskHealthPermission();
      await incrementStreak();
      setAlreadySaved(true);
      // Reset the wizard so re-entry lands on the landing ("Edit ... journal"),
      // not the last step — the screen stays mounted across navigation.
      setOpenPrompt(-1);
      // Both morning and evening saves return to Practice. On the last day-step,
      // Practice renders the sealed state automatically when everything's done.
      router.replace('/');
    }
    savingJournalRef.current = false;
  }

  return (
    <SafeAreaView style={s.safe}>
      {/* Off-screen share card, mounted only while a share is in flight. Kept
          near the screen root so no ancestor can clip the capture. */}
      {pendingShare && (
        <View ref={shareCardRef} collapsable={false} style={s.shareCardOffscreen}>
          <ReadingShareCard quote={pendingShare.text} author={pendingShare.author} work={pendingShare.work} />
        </View>
      )}
      {onLanding ? (
        <PracticeHeader current={isMorning ? 'morning' : 'evening'} />
      ) : (
        <WizardHeader
          title={isMorning ? 'Morning Journal' : 'Evening Journal'}
          step={openPrompt}
          total={wizardPrompts.length}
          onBack={() => {
            haptics.tap();
            if (openPrompt > 0) {
              setOpenPrompt(openPrompt - 1);
            } else {
              setOpenPrompt(-1);
              Keyboard.dismiss();
            }
          }}
          onClose={() => {
            haptics.tap();
            setOpenPrompt(-1);
            Keyboard.dismiss();
          }}
        />
      )}
      <ScrollView
        ref={scrollRef}
        scrollIndicatorInsets={{ bottom: 36 }}
        contentContainerStyle={{ paddingBottom: playerInset }}
        style={[s.scroll, { backgroundColor: colors.bgCard }]}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
          {onLanding ? (
            // Landing — pre-writing context: date hero, past entries link, the
            // meditative memento quote, optional pre-journal meditation, and
            // the Begin CTA. Tapping Begin enters the prompt wizard at index 0.
            <>
              <View style={s.header}>
                <Image
                  source={isMorning
                    ? require('../assets/heroes/journal-morning.jpg')
                    : require('../assets/heroes/journal-evening.jpg')}
                  style={s.headerImage}
                  resizeMode="cover"
                />
                <LinearGradient
                  colors={['rgba(0,0,0,0.85)', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.2)', 'rgba(0,0,0,0.55)']}
                  locations={[0, 0.25, 0.6, 1]}
                  style={StyleSheet.absoluteFillObject}
                />
                <View style={s.headerContent}>
                  <Text style={s.title}>
                    {new Date().toLocaleDateString('en-US', { weekday: 'long' })}{'\n'}
                    {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                  </Text>
                </View>
                <View style={s.heroChipBottom}>
                  <HeroOverlayChip
                    onPress={() => router.push(`/journal-history?type=${sessionType}&from=${encodeURIComponent(fromPath)}&fromLabel=${encodeURIComponent(fromLabel)}`)}
                  >
                    Past entries
                  </HeroOverlayChip>
                </View>
              </View>

              <View style={s.mementoStrip}>
                {(() => {
                  // Rotate the morning memento at the user's local midnight
                  // (not UTC), so each new day the landing shows the next quote.
                  const now = new Date();
                  const localDay = Math.floor((now.getTime() - now.getTimezoneOffset() * 60000) / 86400000);
                  const memento = isMorning
                    ? MORNING_MEMENTOS[localDay % MORNING_MEMENTOS.length]
                    : EVENING_MEMENTOS[localDay % EVENING_MEMENTOS.length];
                  const { author, work } = splitAttribution(memento.attr);
                  return (
                    <>
                      <Text style={s.mementoText}>{memento.text}</Text>
                      <View style={s.mementoFooter}>
                        <Text style={[s.mementoSub, s.mementoSubFlex]}>{memento.attr}</Text>
                        <QuoteActions
                          text={memento.text}
                          author={author}
                          work={work}
                          from={isMorning ? 'journal-morning' : 'journal-evening'}
                          onShare={shareQuote}
                        />
                      </View>
                    </>
                  );
                })()}
              </View>

              <View style={s.body}>
                {(() => {
                  const journalMed = MEDITATIONS[isMorning ? 'premeditatio' : 'evening-examination'];
                  const isCurrent = journalMedPlayer.currentMedId === journalMed.id;
                  const jIsPlaying = isCurrent && journalMedPlayer.isPlaying;
                  const jIsLoading = isCurrent && journalMedPlayer.isLoading;
                  const jPosition = isCurrent ? journalMedPlayer.position : 0;
                  const jDuration = isCurrent ? journalMedPlayer.duration : 0;
                  const jProgress = jDuration > 0 ? jPosition / jDuration : 0;
                  const jLoaded = jDuration > 0;
                  return (
                    <>
                    <Text style={s.listenEyebrow}>{'< 5 min meditation'}</Text>
                    <TouchableOpacity
                      style={[s.listenCard, isCurrent && s.listenCardActive]}
                      onPress={() => { haptics.tap(); toggleMeditation(journalMed); }}
                      activeOpacity={0.85}
                      disabled={jIsLoading}
                    >
                      <View style={s.listenThumb}>
                        <Image source={journalMed.image} style={s.listenThumbImg} resizeMode="cover" />
                        <View style={s.listenThumbOverlay}>
                          {jIsLoading ? (
                            <ActivityIndicator color={colors.accent} size="small" />
                          ) : (
                            <Ionicons
                              name={jIsPlaying ? 'pause-circle' : 'play-circle'}
                              size={32}
                              color={colors.accent}
                            />
                          )}
                        </View>
                      </View>
                      <View style={s.listenContent}>
                        <Text style={s.listenTitle}>{journalMed.title}</Text>
                        {jLoaded ? (
                          <>
                            <View style={s.listenProgressBar}>
                              <View style={[s.listenProgressFill, { flex: jProgress }]} />
                              <View style={{ flex: Math.max(0, 1 - jProgress) }} />
                            </View>
                            <View style={s.listenTimeRow}>
                              <Text style={s.listenTimeText}>{formatMedTime(jPosition)}</Text>
                              <Text style={s.listenTimeText}>{formatMedTime(jDuration)}</Text>
                            </View>
                          </>
                        ) : (
                          <Text style={s.listenDesc}>
                            {isMorning
                              ? 'Tap if you want to listen before writing. Skip if you don\'t.'
                              : 'Tap if you want to listen before reflecting. Skip if you don\'t.'}
                          </Text>
                        )}
                      </View>
                    </TouchableOpacity>
                    </>
                  );
                })()}

                <GoldPrimary
                  style={[s.editBtn, s.saveBtn]}
                  onPress={() => { haptics.tap(); setOpenPrompt(0); }}
                >
                  <Text style={[s.editBtnText, s.editBtnSaveText]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                    {alreadySaved
                      ? `Edit ${isMorning ? 'morning' : 'evening'} journal`
                      : `Begin ${isMorning ? 'morning' : 'evening'} journal`}
                  </Text>
                </GoldPrimary>
                <Text style={s.saveBtnSub}>
                  {wizardPrompts.length} steps · about 5 minutes
                </Text>
              </View>
            </>
          ) : (
            // Wizard — one prompt per "page". Back/Next steps between prompts;
            // Back on the first prompt returns to the landing. On the last
            // prompt Next becomes Complete and saves the entry.
            // No inner progress bar — the prompt's roman-numeral eyebrow
            // (e.g., "I · DISCERN") already communicates position, and the
            // PracticeHeader at the top owns the practice-level progress.
            <View style={s.body}>
              {(() => {
                const prompt = wizardPrompts[openPrompt];
                return (
                  <View style={[s.promptCard, s.promptCardOpen]}>
                    <View style={s.promptTopRow}>
                      <Text style={s.promptNum}>{prompt.num}</Text>
                      {(prompt.hint || prompt.info) && (
                        <TouchableOpacity
                          style={s.hintBtn}
                          onPress={() => { if (openHint !== openPrompt) Keyboard.dismiss(); setOpenHint(openHint === openPrompt ? null : openPrompt); }}
                        >
                          <Text style={s.hintBtnText}>ⓘ</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    {/* The Reckoning carries the morning's own words above
                        its question — the user answers their morning self. */}
                    {prompt.reckon && (
                      <>
                        <Text style={s.echoLead}>{prompt.echoLead}</Text>
                        <Text style={s.echoQuote} numberOfLines={4}>
                          “{prompt.echoText.length > 180 ? `${prompt.echoText.slice(0, 180)}…` : prompt.echoText}”
                        </Text>
                      </>
                    )}
                    <Text style={[s.promptQ, prompt.reckon && { marginTop: 12 }]}>{prompt.q}</Text>
                    {prompt.sub ? <Text style={s.promptSub}>{prompt.sub}</Text> : null}
                    {prompt.info && prompt.hint && (
                      <Text style={s.promptSub}>{prompt.hint}</Text>
                    )}
                    {openHint === openPrompt && (prompt.info || prompt.hint) && (
                      <View style={s.hintBox}>
                        {prompt.info ? (
                          <>
                            <Text style={s.hintTitle}>{prompt.info.title}</Text>
                            <Text style={s.hintSource}>{prompt.info.source}</Text>
                            <View style={s.hintDivider} />
                            {prompt.info.body.split('\n\n').map((para, i) => (
                              <Text key={i} style={[s.hintText, i > 0 && { marginTop: 10 }]}>{para}</Text>
                            ))}
                          </>
                        ) : (
                          <Text style={s.hintText}>{prompt.hint}</Text>
                        )}
                      </View>
                    )}
                    <TouchableOpacity
                      style={s.promptAnswer}
                      activeOpacity={hasAccess ? 1 : 0.85}
                      onPress={hasAccess ? undefined : () => router.push('/paywall')}
                    >
                      <TextInput
                        ref={el => { promptInputRefs.current[openPrompt] = el; }}
                        style={s.promptInput}
                        multiline
                        placeholder={hasAccess ? "Write here. No judgment, only honesty..." : "Start your 7-day free trial to write."}
                        placeholderTextColor={colors.textSecondary}
                        value={answers[prompt.answerKey] || ''}
                        onChangeText={text => setAnswers(prev => ({ ...prev, [prompt.answerKey]: text }))}
                        onFocus={() => setOpenHint(null)}
                        onContentSizeChange={onGrow(`prompt-${openPrompt}`)}
                        editable={hasAccess}
                        scrollEnabled={false}
                        keyboardAppearance="dark"
                        inputAccessoryViewID={Platform.OS === 'ios' ? 'journalAccessory' : undefined}
                      />
                    </TouchableOpacity>
                  </View>
                );
              })()}

              {!keyboardUp && (
                <View style={s.wizardNavRow}>
                  <GoldSecondary
                    style={s.editBtn}
                    onPress={() => {
                      haptics.tap();
                      if (openPrompt > 0) {
                        setOpenPrompt(openPrompt - 1);
                      } else {
                        setOpenPrompt(-1);
                      }
                    }}
                  >
                    <Text style={s.editBtnText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>Back</Text>
                  </GoldSecondary>
                  {openPrompt < wizardPrompts.length - 1 ? (
                    <GoldPrimary
                      style={s.editBtn}
                      onPress={() => { haptics.tap(); setOpenPrompt(openPrompt + 1); }}
                    >
                      <Text style={[s.editBtnText, s.editBtnSaveText]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>Next</Text>
                    </GoldPrimary>
                  ) : (
                    <GoldPrimary
                      style={[s.editBtn, !canSave && s.saveBtnDisabled]}
                      onPress={() => requireAccess(handleSave)}
                      disabled={!canSave}
                    >
                      <Text style={[s.editBtnText, s.editBtnSaveText]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                        {alreadySaved ? 'Update' : 'Complete'}
                      </Text>
                    </GoldPrimary>
                  )}
                </View>
              )}
            </View>
          )}
      </ScrollView>
      {Platform.OS === 'ios' && (
        <InputAccessoryView nativeID="journalAccessory">
          <View style={s.accessoryBarPair}>
            <GoldSecondary
              style={s.editBtn}
              onPress={() => {
                haptics.tap();
                if (openPrompt > 0) {
                  // Go to previous prompt; keyboard stays up, previous input focuses.
                  setOpenPrompt(openPrompt - 1);
                } else {
                  // On first prompt — collapse to browsing state.
                  setOpenPrompt(-1);
                  Keyboard.dismiss();
                }
              }}
            >
              <Text style={s.editBtnText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>Back</Text>
            </GoldSecondary>
            {openPrompt < wizardPrompts.length - 1 ? (
              <GoldPrimary
                style={s.editBtn}
                onPress={() => { haptics.tap(); setOpenPrompt(openPrompt + 1); }}
              >
                <Text style={[s.editBtnText, s.editBtnSaveText]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>Next</Text>
              </GoldPrimary>
            ) : (
              <GoldPrimary
                style={[s.editBtn, !canSave && s.saveBtnDisabled]}
                onPress={() => { Keyboard.dismiss(); requireAccess(handleSave); }}
                disabled={!canSave}
              >
                <Text style={[s.editBtnText, s.editBtnSaveText]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                  {alreadySaved ? 'Update' : 'Complete'}
                </Text>
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
  scroll: { flex: 1 },
  header: {
    backgroundColor: colors.bgDeep,
    minHeight: 280,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'flex-start',
  },
  headerImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  headerContent: { padding: spacing.xl, paddingTop: 52 },
  // Title row hosts the page title on the left and the Past-X chip on the
  // right, both bottom-aligned so the chip sits on the same baseline as the
  // last line of a multi-line title.
  heroTitleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  // Chip anchored bottom-right (asymmetric with the top-left heading) per V.
  heroChipBottom: { position: 'absolute', right: spacing.xl, bottom: spacing.xl },
  title: { fontSize: font.titleSize, fontFamily: font.display, color: colors.textPrimary, letterSpacing: -0.5, lineHeight: 36, textShadowColor: 'rgba(0,0,0,0.7)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 8 },
  // Quiet black card (matches the welcome / list-card language): #0a0a0a
  // fill, 0.5 #474747 border, radius.md, inset from the screen edges. Replaces
  // the old bg.png image strip so all quote surfaces read consistently.
  mementoStrip: {
    backgroundColor: colors.bgCard,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.xl,
    paddingVertical: 20,
    marginHorizontal: spacing.md,
    marginTop: 16,
  },
  // Inter, white, left-aligned — readable for the long morning passage.
  // 20px Inter Light Italic — unified quote treatment across the app (per V).
  mementoText: { fontSize: 20, color: colors.textPrimary, lineHeight: 30, fontFamily: font.bodyLightItalic, fontStyle: 'italic' },
  // Gold uppercase attribution — matches the onboarding welcome screen so
  // every quote reads as one unified component. Was Inter 13 gray title-case.
  // Attribution and the save/share pair share a row. The attribution shrinks
  // rather than pushing the icons off a narrow screen.
  shareCardOffscreen: { position: 'absolute', left: -9999, top: -9999 },
  mementoFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  mementoSubFlex: { flexShrink: 1 },
  mementoSub: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.accent, fontFamily: font.bodyMedium, textTransform: 'uppercase', marginTop: 10 },

  // The Reckoning step: the morning's own words, quoted inside the wizard
  // card above the question. 20px Light Italic per the unified quote
  // treatment (V).
  echoLead: { fontSize: 13, color: colors.textSecondary, fontFamily: font.body, marginBottom: 6 },
  echoQuote: { fontSize: 20, color: colors.textPrimary, lineHeight: 30, fontFamily: font.bodyLightItalic, fontStyle: 'italic', marginBottom: 4 },

  // Light writing surface
  body: { padding: spacing.md, backgroundColor: colors.bgCard },
  secLabel: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.accent, fontFamily: font.bodyMedium, textTransform: 'uppercase', marginBottom: 12, marginTop: 8 },
  listenCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    // Neutral inactive border by default; activates to gold while this
    // meditation is the one loaded/playing in the player (see listenCardActive).
    borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.md,
    padding: 12, paddingRight: 16, marginBottom: 14, backgroundColor: colors.bg,
  },
  // Active state — bright gold border while this meditation is current.
  listenCardActive: { borderColor: colors.accent },
  listenThumb: {
    width: 64, height: 64, borderRadius: radius.md,
    overflow: 'hidden', backgroundColor: '#000',
    position: 'relative',
  },
  listenThumbImg: { width: '100%', height: '100%' },
  listenThumbOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  listenContent: { flex: 1 },
  // Title + desc bumped to match the quote card above (body 17 / attribution
  // 13) per V; eyebrow stays at the app-wide label tier. Margins opened a
  // touch to breathe at the larger sizes.
  // Now a gold section label ABOVE the listen card (per V) — moved out of the
  // card and dropped the "Optional ·" prefix.
  listenEyebrow: { fontSize: 12, letterSpacing: 2, color: colors.accent, fontFamily: font.bodyMedium, textTransform: 'uppercase', marginTop: 4, marginBottom: 12 },
  listenTitle: { fontSize: 17, fontFamily: font.bodySemiBold, color: colors.textPrimary, marginBottom: 8 },
  listenDesc: { fontSize: 13, color: colors.textSecondary, lineHeight: 20 },
  listenProgressBar: {
    height: 2, backgroundColor: colors.border, borderRadius: 1,
    flexDirection: 'row', overflow: 'hidden', marginTop: 4, marginBottom: 6,
  },
  listenProgressFill: { backgroundColor: colors.accent, borderRadius: 1 },
  listenTimeRow: { flexDirection: 'row', justifyContent: 'space-between' },
  listenTimeText: { fontSize: 11, color: colors.textSecondary, letterSpacing: 0.3 },
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
  // Library tokens for keyboard accessory bar — H56 outlined/filled pair
  // (matches Compass / Reading / Onboarding). Done left = outlined gold,
  // action right = filled gold.
  accessoryBarPair: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: colors.bg,
    borderTopWidth: 0.5,
    borderTopColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  // H44 keyboard accessory per Valeriya's library converted for iPhone scale.
  // The in-body primary CTA below overrides height to 56 (H80 medium → 56).
  editBtn: {
    flex: 1,
    height: 44,
    borderRadius: radius.md,
    paddingHorizontal: 16,
  },
  editBtnSave: { backgroundColor: colors.accent },
  editBtnText: { fontSize: 14, fontFamily: font.bodyMedium, color: colors.accent, letterSpacing: 0.3 },
  editBtnSaveText: { color: '#1a1a1a' },
  promptHeader: { marginBottom: 0 },
  hintBtn: { padding: 4 },
  hintBtnText: { fontSize: 18, color: colors.accent },
  hintBox: { marginTop: 14, padding: 14, backgroundColor: colors.bg, borderRadius: radius.md, borderWidth: 0.5, borderColor: colors.border },
  hintText: { fontSize: 16, color: colors.textSecondary, lineHeight: 26 },
  // Subtitle shown beneath the question for prompts that ship a richer
  // info card (currently the discipline-of-assent prompt) — orients the
  // user before they tap the ⓘ to read the teaching.
  promptSub: { fontSize: 13, color: colors.textSecondary, fontStyle: 'italic', marginTop: 6, lineHeight: 20 },
  // Header treatment inside the hintBox when prompt.info is present:
  // small uppercase title in accent, dim source citation below, then a
  // hairline divider before the body paragraphs.
  hintTitle: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.accent, fontFamily: font.bodyMedium, textTransform: 'uppercase', marginBottom: 4 },
  hintSource: { fontSize: 12, color: colors.textSecondary, fontStyle: 'italic', letterSpacing: 0.3 },
  hintDivider: { height: 0.5, backgroundColor: colors.border, marginTop: 12, marginBottom: 12 },
  // In-body primary CTA reuses the library editBtn + editBtnSave H56 filled-gold
  // pair; this override just adds bottom spacing below the button.
  // In-body primary CTA — H56 override (no-keyboard primary per library).
  saveBtn: { height: 56, marginBottom: 12 },
  // Disabled state — gated on at least one prompt having content.
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnSub: { fontSize: 12, color: colors.textSecondary, textAlign: 'center', marginBottom: 36 },
  // Wizard Back/Next pair shown when the keyboard is dismissed. The
  // InputAccessoryView covers the keyboard-up case; this is the parallel
  // body row so the user can always navigate without re-focusing the input.
  wizardNavRow: { flexDirection: 'row', gap: 10, marginTop: 14, marginBottom: 36 },
});