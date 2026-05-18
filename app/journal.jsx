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
import { PracticeHeader } from '../components/PracticeHeader';
import { colors, radius, spacing, font } from '../constants/theme';
import { GoldPrimary, GoldSecondary } from '../components/GoldButton';

const HERO_GRADIENT = ['#3D2D12', '#150E08', '#000000'];
import { saveJournal, getTodayJournal, incrementStreak } from '../store/db';
import { cancelJournalNotification } from '../notifications';
import * as haptics from '../lib/haptics';
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
import { morningPrompts, eveningPrompts } from '../constants/journalPrompts';

const virtuePronunciations = {
  sophia: 'soh-FEE-ah',
  andreia: 'an-DRAY-ah',
  sophrosyne: 'soh-FROH-sih-nee',
  dikaiosyne: 'dee-KAY-oh-sih-nee',
};

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
    router.push('/paywall');
  }
  const journalMedPlayer = useMeditationPlayer();

  // Sync sessionType when navigating here explicitly from practice with a type param
  useEffect(() => {
    if (params?.type) {
      setSessionType(params.type);
    }
  }, [params?.type]);
  const prompts = isMorning ? morningPrompts : eveningPrompts;

  const [answers, setAnswers] = useState({});
  const [openPrompt, setOpenPrompt] = useState(-1);
  const [openHint, setOpenHint] = useState(null);
  const promptInputRefs = useRef({});
  const scrollRef = useRef(null);

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

  useEffect(() => {
    async function reload() {
      const existing = await getTodayJournal(isMorning ? 'morning' : 'evening');
      if (existing) { setAnswers(existing.answers || {}); setAlreadySaved(true); }
      else { setAnswers({}); setAlreadySaved(false); }
    }
    reload();
  }, [sessionType]);

  useFocusEffect(useCallback(() => {
    async function load() {
      const existing = await getTodayJournal(isMorning ? 'morning' : 'evening');
      if (existing) {
        setAnswers(existing.answers || {});
        setAlreadySaved(true);
      } else {
        setAnswers({});
        setAlreadySaved(false);
      }
    }
    load();
    // Reset scaffolding state on focus — info bubbles are help, not user input.
    setOpenHint(null);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [sessionType]));

  const answeredCount = Math.min(Object.values(answers).filter(v => v && v.trim().length > 0).length, prompts.length);
  // Gate completion on at least one prompt having content. An empty
  // "completion" defeats the purpose of journaling and pollutes the
  // archive with no-op entries. The caption swaps to a prompt asking
  // the user to answer at least one when the button is disabled.
  const canSave = answeredCount > 0;

  async function handleSave() {
    if (!canSave) return;
    const entry = {
      id: Date.now().toString(),
      type: isMorning ? 'morning' : 'evening',
      date: new Date().toISOString(),
      answers,
    };
    const ok = await saveJournal(entry);
    if (ok) {
      haptics.success();
      commitMindfulSession();
      cancelJournalNotification(isMorning ? 'morning' : 'evening');
      maybeAskHealthPermission();
      await incrementStreak();
      setAlreadySaved(true);
      // Both morning and evening saves return to Practice. On the last day-step,
      // Practice renders the sealed state automatically when everything's done.
      router.replace('/');
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <PracticeHeader current={isMorning ? 'morning' : 'evening'} />
      <ScrollView
        ref={scrollRef}
        scrollIndicatorInsets={{ bottom: 36 }}
        contentContainerStyle={{ paddingBottom: playerInset }}
        style={[s.scroll, { backgroundColor: colors.bgCard }]}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
          <View style={s.header}>
            <Image
              source={isMorning
                ? require('../assets/heroes/journal-morning.jpg')
                : require('../assets/heroes/journal-evening.jpg')}
              style={s.headerImage}
              resizeMode="cover"
            />
            <LinearGradient
              colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.85)']}
              locations={[0, 0.55, 0.8, 1]}
              style={StyleSheet.absoluteFillObject}
            />
            <View style={s.headerContent}>
              <Text style={s.title}>
                {new Date().toLocaleDateString('en-US', { weekday: 'long' })}{'\n'}
                {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
              </Text>
            </View>
          </View>

          <View style={s.pastEntriesRow}>
            <GoldSecondary
              onPress={() => router.push(`/journal-history?type=${sessionType}&from=${encodeURIComponent(fromPath)}&fromLabel=${encodeURIComponent(fromLabel)}`)}
              style={s.pastEntriesBtn}
              contentStyle={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
            >
              <Text style={s.pastEntriesText}>Past entries</Text>
              <Ionicons name="arrow-forward" size={14} color={colors.accent} style={{ marginTop: 2 }} />
            </GoldSecondary>
          </View>

          <LinearGradient
                colors={HERO_GRADIENT}
                locations={[0, 0.6, 1]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={s.mementoStrip}
              >
                <Text style={s.mementoText}>
                  {isMorning
                    ? '"When you wake, expect to meet people who are difficult: meddling, arrogant, ungrateful. They are this way because they cannot tell good from evil. But they share your nature, and no one can truly harm you. You were made to work with them, not against them."'
                    : '"Ask yourself at day\'s end: What did I do well? What did I do badly? What did I leave undone? Walk through each in turn."'}
                </Text>
                <Text style={s.mementoSub}>
                  {isMorning ? 'Marcus Aurelius · Meditations II.1' : 'Epictetus · Discourses III.10'}
                </Text>
              </LinearGradient>

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
                    <TouchableOpacity
                      style={s.listenCard}
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
                        <Text style={s.listenEyebrow}>Optional · &lt; 5 min meditation</Text>
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
                  );
                })()}

                {prompts.map((prompt, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={[s.promptCard, openPrompt === idx && s.promptCardOpen]}
                    onPress={() => setOpenPrompt(openPrompt === idx ? -1 : idx)}
                    activeOpacity={0.8}
                  >
                    <View style={s.promptTopRow}>
                      <Text style={s.promptNum}>{prompt.num}</Text>
                      {(prompt.hint || prompt.info) && (
                        <TouchableOpacity
                          style={s.hintBtn}
                          onPress={() => setOpenHint(openHint === idx ? null : idx)}
                        >
                          <Text style={s.hintBtnText}>ⓘ</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    <Text style={s.promptQ}>{prompt.q}</Text>
                    {prompt.info && prompt.hint && (
                      <Text style={s.promptSub}>{prompt.hint}</Text>
                    )}
                    {openHint === idx && (prompt.info || prompt.hint) && (
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
                    {openPrompt === idx && (
                      <View style={s.promptAnswer}>
                        <TextInput
                          ref={el => { promptInputRefs.current[idx] = el; }}
                          style={s.promptInput}
                          multiline
                          placeholder={hasAccess ? "Write here. No judgment, only honesty..." : "Start your 7-day free trial to write."}
                          placeholderTextColor={colors.textDim}
                          value={answers[idx] || ''}
                          onChangeText={text => setAnswers(prev => ({ ...prev, [idx]: text }))}
                          editable={hasAccess}
                          scrollEnabled={false}
                          keyboardAppearance="dark"
                          inputAccessoryViewID={Platform.OS === 'ios' ? 'journalAccessory' : undefined}
                        />
                      </View>
                    )}
                  </TouchableOpacity>
                ))}

                {!keyboardUp && (
                  <>
                    <GoldPrimary
                      style={[s.editBtn, s.saveBtn, !canSave && s.saveBtnDisabled]}
                      onPress={() => requireAccess(handleSave)}
                      disabled={!canSave}
                    >
                      <Text style={[s.editBtnText, s.editBtnSaveText]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                        {alreadySaved ? 'Update journal' : `Complete ${isMorning ? 'morning' : 'evening'} journal`}
                      </Text>
                    </GoldPrimary>
                    <Text style={s.saveBtnSub}>
                      {canSave ? `${answeredCount} of ${prompts.length} prompts answered` : 'Answer at least one prompt to complete'}
                    </Text>
                  </>
                )}
              </View>
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
            {openPrompt < prompts.length - 1 ? (
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
    justifyContent: 'flex-end',
  },
  headerImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  headerContent: { padding: spacing.xl, paddingTop: 52 },
  title: { fontSize: font.titleSize, fontFamily: font.display, color: colors.textPrimary, letterSpacing: -0.5, lineHeight: 36, textShadowColor: 'rgba(0,0,0,0.7)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 8 },
  // "Past entries" link below the hero — uses Valeriya's library
  // smaller-button outlined-gold token (same as Past readings).
  pastEntriesRow: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 20, paddingVertical: 14, backgroundColor: colors.bgDeep, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  pastEntriesBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.md,
  },
  pastEntriesText: { fontSize: 12, fontWeight: '600', color: colors.accent, letterSpacing: 1, fontFamily: font.bodyMedium, textTransform: 'uppercase' },
  mementoStrip: {
    backgroundColor: colors.accentBg,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
    padding: spacing.xl,
    paddingVertical: 20,
  },
  mementoText: { fontSize: 19, color: colors.textPrimary, lineHeight: 30, fontFamily: font.serif },
  mementoSub: { fontSize: 10, color: colors.accentDim, marginTop: 8, letterSpacing: 1.5, fontFamily: font.bodyMedium, textTransform: 'uppercase' },

  // Light writing surface
  body: { padding: spacing.md, backgroundColor: colors.bgCard },
  secLabel: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.accent, fontFamily: font.bodyMedium, textTransform: 'uppercase', marginBottom: 12, marginTop: 8 },
  listenCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderWidth: 0.5, borderColor: colors.accentDim, borderRadius: radius.lg,
    padding: 12, paddingRight: 16, marginBottom: 14, backgroundColor: colors.accentBg,
  },
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
  listenEyebrow: { fontSize: font.microSize, letterSpacing: 2, color: colors.accent, fontFamily: font.bodyMedium, textTransform: 'uppercase', marginBottom: 4 },
  listenTitle: { fontSize: 15, fontWeight: '600', color: colors.textPrimary, marginBottom: 6 },
  listenDesc: { fontSize: 12, color: colors.textMuted, lineHeight: 18 },
  listenProgressBar: {
    height: 2, backgroundColor: colors.border, borderRadius: 1,
    flexDirection: 'row', overflow: 'hidden', marginTop: 4, marginBottom: 6,
  },
  listenProgressFill: { backgroundColor: colors.accent, borderRadius: 1 },
  listenTimeRow: { flexDirection: 'row', justifyContent: 'space-between' },
  listenTimeText: { fontSize: 10, color: colors.textDim, letterSpacing: 0.3 },
  // Input field treatment per Valeriya's library: subtle elevation above
  // screen bg, with stroke shifting between non-active (#474747) and
  // active (#878787) focus states.
  promptCard: { borderWidth: 0.5, borderColor: colors.inputBorder, borderRadius: radius.lg, padding: 20, marginBottom: 10, backgroundColor: colors.inputBg },
  promptCardOpen: { borderColor: colors.inputBorderActive },
  promptTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  promptNum: { fontSize: font.microSize, letterSpacing: 2, color: colors.accent, fontFamily: font.bodyMedium, textTransform: 'uppercase' },
  promptQ: { fontSize: 15, color: colors.textPrimary, lineHeight: 24, fontWeight: '400' },
  promptAnswer: { marginTop: 16, borderTopWidth: 0.5, borderTopColor: colors.border, paddingTop: 16 },
  promptInput: { fontSize: 16, color: colors.textPrimary, lineHeight: 26, minHeight: 100, textAlignVertical: 'top', paddingBottom: 60 },
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
  hintText: { fontSize: 16, color: colors.textSecondary, lineHeight: 26, fontFamily: font.serif },
  // Subtitle shown beneath the question for prompts that ship a richer
  // info card (currently the discipline-of-assent prompt) — orients the
  // user before they tap the ⓘ to read the teaching.
  promptSub: { fontSize: 13, color: colors.textMuted, fontStyle: 'italic', marginTop: 6, lineHeight: 20 },
  // Header treatment inside the hintBox when prompt.info is present:
  // small uppercase title in accent, dim source citation below, then a
  // hairline divider before the body paragraphs.
  hintTitle: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.accent, fontFamily: font.bodyMedium, textTransform: 'uppercase', marginBottom: 4 },
  hintSource: { fontSize: 12, color: colors.textDim, fontStyle: 'italic', letterSpacing: 0.3 },
  hintDivider: { height: 0.5, backgroundColor: colors.border, marginTop: 12, marginBottom: 12 },
  // In-body primary CTA reuses the library editBtn + editBtnSave H56 filled-gold
  // pair; this override just adds bottom spacing below the button.
  // In-body primary CTA — H56 override (no-keyboard primary per library).
  saveBtn: { height: 56, marginBottom: 12 },
  // Disabled state — gated on at least one prompt having content.
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnSub: { fontSize: 12, color: colors.textMuted, textAlign: 'center', marginBottom: 36 },
});