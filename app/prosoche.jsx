import { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, font, spacing, radius } from '../constants/theme';
import { GoldPrimary } from '../components/GoldButton';
import * as haptics from '../lib/haptics';
import { track } from '../lib/analytics';

// Prosoche (προσοχή) — the Stoic discipline of attention. The midday
// checkpoint is deliberately NOT a timer or a breathing exercise (that is
// Calm/Headspace territory the app positions against). It is a single
// attention question you hold yourself to for a breath, then return to the
// day sharper. Questions rotate randomly per open so it stays fresh.
//
// Type follows the app's settled scale: eyebrow at labelSize, the question in
// the 20/30 Light Italic contemplative voice used on every other quote
// surface, guidance at 17/26 like the sealed states. No invented sizes.
const PROMPTS = [
  'What are you assenting to right now?',
  'What just passed through your impressions unexamined?',
  'What is this moment asking of you?',
  'Is what troubles you within your control, or not?',
  'Who are you being, right now, to the person in front of you?',
  'What are you telling yourself about this, and is it true?',
  'Where has your attention drifted, and what called it away?',
  'If this were your last hour, would you still spend it like this?',
];

// Matches the scholarly register of the journal prompts' info cards, and
// gives the Greek word on the eyebrow somewhere to be explained.
const PROSOCHE_INFO = {
  title: 'Prosochē',
  source: 'Epictetus, Discourses 4.12',
  body: "Prosochē is the Stoic discipline of attention, and Epictetus gave it an entire discourse. Relax your attention for a little, he warned, and do not imagine you will recover it whenever you please.\n\nIt is often called Stoic mindfulness, but the aim is not calm. It is vigilance. You are watching what you assent to: the impression that arrived uninvited, the judgment made before you noticed making it, the story already running in the background.\n\nThere is no timer and nothing to achieve. One question, held for the length of a breath or two, is the whole of it. Then you return to the day, having caught yourself once.",
};

// Brief confirmation beat after Noted before the screen closes. Deliberately
// short: undo does NOT depend on catching this window. Reopening the
// checkpoint on a day you already noted shows the noted state with an Undo,
// so the recovery path is "come back", not "react fast".
const CONFIRM_MS = 800;

const STAMP_KEY = 'prosoche_last';

function isToday(iso) {
  if (!iso) return false;
  const d = new Date(iso);
  return !Number.isNaN(d.getTime()) && d.toDateString() === new Date().toDateString();
}

export default function ProsocheScreen() {
  const router = useRouter();
  const [prompt] = useState(() => PROMPTS[Math.floor(Math.random() * PROMPTS.length)]);
  // null while loading, so the question never flashes before we know whether
  // today was already noted.
  const [notedToday, setNotedToday] = useState(null);
  // Distinguishes "just noted in this session" (auto-closes) from "was already
  // noted earlier today" (stays put, offering Undo).
  const [justNoted, setJustNoted] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const dismissTimer = useRef(null);

  const leave = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, [router]);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(STAMP_KEY)
      .then(v => { if (alive) setNotedToday(isToday(v)); })
      .catch(() => { if (alive) setNotedToday(false); });
    return () => { alive = false; };
  }, []);

  const onNoted = useCallback(() => {
    haptics.success();
    track('prosoche_checkpoint');
    // Written immediately rather than deferred to a timer. The old deferred
    // write could commit while this screen was still mounted (it lives in the
    // tab navigator), leaving a live Undo button over already-saved state.
    // Lightweight last-done stamp. No streak, no counter — the app
    // deliberately avoids gamifying the practice.
    AsyncStorage.setItem(STAMP_KEY, new Date().toISOString()).catch(() => {});
    setNotedToday(true);
    setJustNoted(true);
    dismissTimer.current = setTimeout(leave, CONFIRM_MS);
  }, [leave]);

  // Authoritative: removes the stamp, so it reverses the mark whether it was
  // made a second ago or earlier today. This is what makes reopening a valid
  // recovery path.
  const onUndo = useCallback(() => {
    haptics.tap();
    track('prosoche_undo');
    if (dismissTimer.current) { clearTimeout(dismissTimer.current); dismissTimer.current = null; }
    AsyncStorage.removeItem(STAMP_KEY).catch(() => {});
    setNotedToday(false);
    setJustNoted(false);
  }, []);

  useEffect(() => () => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
  }, []);

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <View style={s.topRow}>
        <Pressable onPress={leave} hitSlop={14} style={s.closeBtn}>
          <Ionicons name="close" size={24} color={colors.textSecondary} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Eyebrow + ⓘ share a row, as they do on every prompt card in the
            app (promptTopRow). Centered as a group rather than pushed apart,
            since this screen's composition is centered. */}
        <View style={s.eyebrowRow}>
          <Text style={s.eyebrow}>Prosochē · Mid-day</Text>
          <TouchableOpacity style={s.hintBtn} onPress={() => setShowInfo(v => !v)} hitSlop={10}>
            <Text style={s.hintBtnText}>ⓘ</Text>
          </TouchableOpacity>
        </View>
        {notedToday === null ? null : (
          <>
            <Text style={s.prompt}>
              {notedToday ? (justNoted ? 'Noted.' : 'Noted today.') : prompt}
            </Text>
            <Text style={s.guidance}>
              {notedToday
                ? 'You have already paused today.'
                : 'Sit with it a moment.\nNotice, without fixing.'}
            </Text>
            {/* Rendered for BOTH states: the explanation of prosochē is worth
                reading whether or not today is already marked, and hiding it
                behind the not-yet-noted state made the ⓘ look broken. */}
            {showInfo && (
              <View style={s.hintBox}>
                <Text style={s.hintTitle}>{PROSOCHE_INFO.title}</Text>
                <Text style={s.hintSource}>{PROSOCHE_INFO.source}</Text>
                <View style={s.hintDivider} />
                {PROSOCHE_INFO.body.split('\n\n').map((para, i) => (
                  <Text key={i} style={[s.hintText, i > 0 && { marginTop: 10 }]}>{para}</Text>
                ))}
              </View>
            )}
            {notedToday && (
              <TouchableOpacity style={s.undoBtn} onPress={onUndo} hitSlop={12}>
                <Text style={s.undoText}>Undo</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </ScrollView>

      {notedToday === false && (
        <View style={s.footer}>
          <GoldPrimary style={s.btn} onPress={onNoted}>
            <Text style={s.btnText}>Noted</Text>
          </GoldPrimary>
        </View>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 36,
  },
  hintBtn: { padding: 4 },
  hintBtnText: { fontSize: 18, color: colors.accent },
  closeBtn: { padding: 4 },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    // Deliberately generous: with the ⓘ sheet open the content scrolls, and a
    // flush bottom edge would put the last paragraph directly under the fixed
    // Noted button — reading the explanation would route your thumb onto the
    // commit action. This keeps text clear of the footer.
    paddingBottom: 56,
  },
  eyebrow: {
    fontSize: font.labelSize,
    letterSpacing: font.sectionTracking,
    color: colors.accent,
    fontFamily: font.bodyMedium,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  // The app's unified contemplative voice — same 20/30 Light Italic used by
  // every memento strip, the daily reading, and the sealed-state quote.
  prompt: {
    fontSize: 20,
    lineHeight: 30,
    color: colors.textPrimary,
    fontFamily: font.bodyLightItalic,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  // 17/26 Inter Regular, matching the sealed states' secondary line.
  guidance: {
    fontSize: 17,
    lineHeight: 26,
    color: colors.textSecondary,
    fontFamily: font.body,
    textAlign: 'center',
    marginTop: 28,
  },
  hintBox: {
    marginTop: 28,
    padding: 14,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  hintTitle: {
    fontSize: font.labelSize,
    letterSpacing: font.sectionTracking,
    color: colors.accent,
    fontFamily: font.bodyMedium,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  hintSource: { fontSize: 12, color: colors.textSecondary, fontStyle: 'italic', letterSpacing: 0.3 },
  hintDivider: { height: 0.5, backgroundColor: colors.border, marginTop: 12, marginBottom: 12 },
  hintText: { fontSize: 16, color: colors.textSecondary, lineHeight: 26 },
  undoBtn: { marginTop: 28, padding: 8 },
  undoText: { fontSize: 14, color: colors.accent, fontFamily: font.bodyMedium, letterSpacing: 0.3 },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    backgroundColor: colors.bg,
  },
  // H56 filled-gold primary, matching the app-wide button spec.
  btn: { height: 56, alignSelf: 'stretch' },
  btnText: { fontSize: 14, color: '#1a1a1a', fontFamily: font.bodyMedium, letterSpacing: 0.3 },
});
