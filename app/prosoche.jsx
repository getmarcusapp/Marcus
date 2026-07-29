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
  title: 'Prosoche',
  source: 'Epictetus, Discourses 4.12',
  body: "Prosoche (προσοχή) is the Stoic discipline of attention, and Epictetus gave it an entire discourse. Relax your attention for a little, he warned, and do not imagine you will recover it whenever you please.\n\nIt is often called Stoic mindfulness, but the aim is not calm. It is vigilance. You are watching what you assent to: the impression that arrived uninvited, the judgment made before you noticed making it, the story already running in the background.\n\nThere is no timer and nothing to achieve. One question, held for the length of a breath or two, is the whole of it. Then you return to the day, having caught yourself once.",
};

// How long "Noted." stays on screen before the checkpoint closes. Long enough
// to catch a mis-tap via Undo, short enough that a deliberate Noted still
// feels like it closes the moment rather than lingering.
const UNDO_WINDOW_MS = 4000;

export default function ProsocheScreen() {
  const router = useRouter();
  const [prompt] = useState(() => PROMPTS[Math.floor(Math.random() * PROMPTS.length)]);
  const [done, setDone] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const dismissTimer = useRef(null);
  const committedRef = useRef(false);

  const leave = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, [router]);

  // Nothing is written or tracked until the undo window closes, so Undo has
  // no state to roll back and there's no race between the write and the undo.
  // Idempotent: the timer and an early close can both reach it.
  const commit = useCallback(() => {
    if (committedRef.current) return;
    committedRef.current = true;
    track('prosoche_checkpoint');
    // Lightweight last-done stamp for possible future surfacing. No streak,
    // no counter — the app deliberately avoids gamifying the practice.
    AsyncStorage.setItem('prosoche_last', new Date().toISOString()).catch(() => {});
  }, []);

  const onNoted = useCallback(() => {
    haptics.success();
    setDone(true);
    dismissTimer.current = setTimeout(() => { commit(); leave(); }, UNDO_WINDOW_MS);
  }, [commit, leave]);

  const onUndo = useCallback(() => {
    haptics.tap();
    track('prosoche_undo');
    if (dismissTimer.current) { clearTimeout(dismissTimer.current); dismissTimer.current = null; }
    setDone(false);
  }, []);

  // Closing during the undo window is still a deliberate Noted — honor it.
  const onClose = useCallback(() => {
    if (done) commit();
    leave();
  }, [done, commit, leave]);

  useEffect(() => () => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
  }, []);

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <View style={s.topRow}>
        <Pressable onPress={onClose} hitSlop={14} style={s.closeBtn}>
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
          <Text style={s.eyebrow}>Prosoche · Mid-day</Text>
          <TouchableOpacity style={s.hintBtn} onPress={() => setShowInfo(v => !v)} hitSlop={10}>
            <Text style={s.hintBtnText}>ⓘ</Text>
          </TouchableOpacity>
        </View>
        {done ? (
          <>
            <Text style={s.prompt}>Noted.</Text>
            <TouchableOpacity style={s.undoBtn} onPress={onUndo} hitSlop={12}>
              <Text style={s.undoText}>Undo</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={s.prompt}>{prompt}</Text>
            <Text style={s.guidance}>Sit with it a moment.{'\n'}Notice, without fixing.</Text>
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
          </>
        )}
      </ScrollView>

      {!done && (
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
