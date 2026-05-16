import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, TextInput,
  TouchableOpacity, StyleSheet, SafeAreaView, Alert,
  KeyboardAvoidingView, Platform, InputAccessoryView, Keyboard, Image,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, font } from '../constants/theme';
import { emotions } from '../constants/virtues';
import { EMOTION_COLORS, DISTORTIONS } from '../constants/emotionsData';
import { saveTrigger } from '../store/db';
import * as haptics from '../lib/haptics';
import { useMindfulSession } from '../lib/useMindfulSession';
import { useKeyboardVisible } from '../lib/useKeyboardVisible';
import { useEntitlement } from '../lib/useEntitlement';
import { useMiniPlayerInset } from '../components/MiniMeditationPlayer';

// Situation-agnostic reframes
const stoicReframesUpdated = {
  anger: "Is this worth your peace? What happened is not in your control. Your response is. What does the situation actually require of you?",
  anxiety: "Separate what is in your control from what is not. Attend only to the former. The rest is not yours to carry.",
  frustration: "You were not wronged. You were inconvenienced. The Stoic does not react to inconvenience. What is the wise response here?",
  shame: "Examine whether the shame is warranted. If you acted wrongly, own it and correct course. If not, release it. The judgment of others is not yours to control.",
  avoidance: "You are delaying because you fear an outcome. Name the fear. Then ask: is it as bad as the cost of continued avoidance?",
  envy: "You are measuring your inner life against another's outer life. You do not know their interior. Tend your own.",
  grief: "Grief is love with nowhere to go. Honor it. The Stoic does not suppress feeling, only the slavery to feeling.",
  fear: "Fear imagines futures that have not arrived. Return to what is actually in front of you, in this moment. What does now require?",
  other: "Pause. Name what you are actually feeling beneath the surface. Then ask: what would a person of Virtue do here?",
};

function IntensitySlider({ value, onChange }) {
  function step(next) {
    if (next === value) return;
    haptics.tap();
    onChange(next);
  }
  return (
    <View style={iss.row}>
      <TouchableOpacity onPress={() => step(Math.max(1, value - 1))} style={iss.btn}>
        <Text style={iss.btnText}>−</Text>
      </TouchableOpacity>
      <View style={iss.track}>
        <View style={[iss.fill, { width: `${(value / 10) * 100}%` }]} />
      </View>
      <TouchableOpacity onPress={() => step(Math.min(10, value + 1))} style={iss.btn}>
        <Text style={iss.btnText}>+</Text>
      </TouchableOpacity>
      <Text style={iss.value}>{value}/10</Text>
    </View>
  );
}

const iss = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  btn: {
    width: 44, height: 44, borderWidth: 0.5, borderColor: colors.borderMid,
    borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.bgElevated,
  },
  btnText: { fontSize: 24, color: colors.textSecondary },
  track: { flex: 1, height: 4, backgroundColor: colors.border, borderRadius: 2, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.textSecondary, borderRadius: 2 },
  value: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, minWidth: 48, textAlign: 'right' },
});

export default function EmotionsScreen() {
  const router = useRouter();
  const playerInset = useMiniPlayerInset();
  const [timing, setTiming] = useState('now'); // 'now' or 'past'
  const [selectedEmotion, setSelectedEmotion] = useState(null);
  const [intensity, setIntensity] = useState(5);
  const [trigger, setTrigger] = useState('');
  const [reaction, setReaction] = useState('');
  const [chosenResponse, setChosenResponse] = useState('');
  const [selectedDistortions, setSelectedDistortions] = useState([]);
  const [hintOpen, setHintOpen] = useState(false);
  // Tracks which input field is currently focused so the wrapping fieldCard
  // can switch between non-active (darker stroke) and active (brighter stroke).
  const [focusedField, setFocusedField] = useState(null);
  const commitMindfulSession = useMindfulSession();
  const keyboardUp = useKeyboardVisible();
  const { hasAccess } = useEntitlement();
  function requireAccess(action) {
    if (hasAccess) { action(); return; }
    router.push('/paywall');
  }
  const triggerInputRef = useRef(null);
  const reactionInputRef = useRef(null);
  const responseInputRef = useRef(null);
  const scrollRef = useRef(null);
  // Anchors the "III · Reframe" stage label so tapping "Pick patterns" from
  // the Reaction accessory scrolls to just above it (not deeper into the
  // reframe card itself).
  const reframeRef = useRef(null);

  function scrollToReframe() {
    Keyboard.dismiss();
    setTimeout(() => {
      const scrollNode = scrollRef.current?.getScrollableNode?.() || scrollRef.current;
      if (!scrollNode || !reframeRef.current) return;
      reframeRef.current.measureLayout(
        scrollNode,
        (_x, y) => scrollRef.current?.scrollTo({ y: Math.max(0, y - 24), animated: true }),
        () => {},
      );
    }, 150);
  }

  // Auto-focus the trigger textarea when an emotion is selected — bypasses
  // the post-pick scroll-and-tap friction. iOS keyboard avoidance handles
  // bringing the input into view.
  useEffect(() => {
    if (!selectedEmotion) return;
    const t = setTimeout(() => triggerInputRef.current?.focus(), 250);
    return () => clearTimeout(t);
  }, [selectedEmotion]);

  useFocusEffect(useCallback(() => {
    setHintOpen(false);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, []));

  function toggleDistortion(id) {
    haptics.tap();
    setSelectedDistortions(prev =>
      prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]
    );
  }

  async function handleLog() {
    if (!selectedEmotion) return;
    const entry = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      emotion: selectedEmotion,
      intensity,
      timing,
      trigger,
      reaction,
      stoicResponse: stoicReframesUpdated[selectedEmotion],
      chosenResponse,
      distortions: selectedDistortions,
    };
    await saveTrigger(entry);
    haptics.success();
    commitMindfulSession();
    setSelectedEmotion(null);
    setTrigger('');
    setReaction('');
    setChosenResponse('');
    setSelectedDistortions([]);
    setIntensity(5);
    setTiming('now');
    Alert.alert('', 'Trigger logged.', [{ text: 'Done' }]);
  }

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.bg }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          ref={scrollRef}
          scrollIndicatorInsets={{ bottom: 36 }}
          contentContainerStyle={{ paddingBottom: playerInset }}
          style={[s.scroll, { backgroundColor: colors.bgCard }]}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
        >

          <View style={s.hero}>
            <Image
              source={require('../assets/heroes/emotions.jpg')}
              style={s.heroImage}
              resizeMode="cover"
            />
            <LinearGradient
              colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.85)']}
              locations={[0, 0.55, 0.8, 1]}
              style={StyleSheet.absoluteFillObject}
            />
            <View style={s.heroContent}>
              <Text style={s.eyebrow}>Emotional mastery</Text>
              <Text style={s.title}>Log a trigger</Text>
              <Text style={s.sub}>Between stimulus and response{'\n'}there is a space. This is that space.</Text>
            </View>
          </View>

          <View style={s.pastEntriesRow}>
            <TouchableOpacity
              onPress={() => router.push('/emotions-history')}
              style={s.pastEntriesBtn}
              activeOpacity={0.8}
            >
              <Text style={s.pastEntriesText}>Past triggers</Text>
              <Ionicons name="arrow-forward" size={14} color={colors.accent} style={{ marginTop: 2 }} />
            </TouchableOpacity>
          </View>

          <View style={s.body}>

            <Text style={[s.stageLabel, { marginTop: 16 }]}>I · Context</Text>
            <Text style={s.secLabel}>When did this happen?</Text>
            <View style={s.timingRow}>
              <TouchableOpacity
                style={[s.timingBtn, timing === 'now' && s.timingBtnActive]}
                onPress={() => setTiming('now')}
                activeOpacity={0.7}
              >
                <Text style={[s.timingBtnText, timing === 'now' && s.timingBtnTextActive]}>
                  Happening now
                </Text>
                <Text style={[s.timingBtnSub, timing === 'now' && s.timingBtnSubActive]}>
                  How will I respond?
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.timingBtn, timing === 'past' && s.timingBtnActive]}
                onPress={() => setTiming('past')}
                activeOpacity={0.7}
              >
                <Text style={[s.timingBtnText, timing === 'past' && s.timingBtnTextActive]}>
                  Already happened
                </Text>
                <Text style={[s.timingBtnSub, timing === 'past' && s.timingBtnSubActive]}>
                  How should I have responded?
                </Text>
              </TouchableOpacity>
            </View>

            <View style={s.feelingHeader}>
              <Text style={[s.secLabel, { marginTop: 0, marginBottom: 0 }]}>What are you feeling?</Text>
              <TouchableOpacity onPress={() => setHintOpen(!hintOpen)} style={s.hintBtn} activeOpacity={0.7}>
                <Text style={s.hintBtnText}>ⓘ</Text>
              </TouchableOpacity>
            </View>
            {hintOpen && (
              <View style={s.hintBox}>
                <Text style={s.hintText}>
                  Marcus focuses on disturbing emotions because that's where the practice has work to do. Joy and contentment need no Stoic intervention; anger, anxiety, and shame do. Logging them here gives you the space between stimulus and response.
                </Text>
              </View>
            )}
            <View style={s.emotionGrid}>
              {emotions.map(e => {
                const ec = EMOTION_COLORS[e.id];
                const isSelected = selectedEmotion === e.id;
                return (
                  <TouchableOpacity
                    key={e.id}
                    style={[s.ePill, isSelected && { backgroundColor: ec.tint, borderColor: ec.border }]}
                    onPress={() => { haptics.tap(); setSelectedEmotion(e.id); }}
                    activeOpacity={0.7}
                  >
                    <View style={[s.eAccent, { backgroundColor: ec.border, opacity: isSelected ? 1 : 0.55 }]} />
                    <Text style={[s.ePillName, isSelected && { color: ec.border, fontWeight: '600' }]}>
                      {e.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={s.stageLabel}>II · Describe</Text>

            <View style={s.fieldCard}>
              <Text style={s.fieldLabel}>Intensity</Text>
              <IntensitySlider value={intensity} onChange={setIntensity} />
            </View>

            <View style={[s.fieldCard, focusedField === 'trigger' && s.fieldCardActive]}>
              <Text style={s.fieldLabel}>What triggered it?</Text>
              <TextInput
                ref={triggerInputRef}
                style={[s.fieldInput, focusedField !== 'trigger' && s.fieldInputDim]}
                multiline
                placeholder="Describe the situation..."
                placeholderTextColor={colors.textDim}
                value={trigger}
                onChangeText={setTrigger}
                onFocus={() => setFocusedField('trigger')}
                onBlur={() => setFocusedField(null)}
                editable={hasAccess}
                scrollEnabled={false}
                inputAccessoryViewID={Platform.OS === 'ios' ? 'emoTriggerAccessory' : undefined}
              />
            </View>

            <View style={[s.fieldCard, focusedField === 'reaction' && s.fieldCardActive]}>
              <Text style={s.fieldLabel}>My automatic reaction</Text>
              <TextInput
                ref={reactionInputRef}
                style={[s.fieldInput, focusedField !== 'reaction' && s.fieldInputDim]}
                multiline
                placeholder="What did you want to do or say?"
                placeholderTextColor={colors.textDim}
                value={reaction}
                onChangeText={setReaction}
                onFocus={() => setFocusedField('reaction')}
                onBlur={() => setFocusedField(null)}
                editable={hasAccess}
                scrollEnabled={false}
                inputAccessoryViewID={Platform.OS === 'ios' ? 'emoReactionAccessory' : undefined}
              />
            </View>

            <View ref={reframeRef} collapsable={false}>
              <Text style={s.stageLabel}>III · Reframe</Text>
            </View>
            <View
              style={[
                s.reframeCard,
                selectedEmotion
                  ? { borderColor: EMOTION_COLORS[selectedEmotion].border, backgroundColor: EMOTION_COLORS[selectedEmotion].tint }
                  : { borderColor: colors.border, backgroundColor: colors.bgElevated },
              ]}
            >
              <Text style={[s.reframeEyebrow, { color: selectedEmotion ? EMOTION_COLORS[selectedEmotion].text : colors.textDim }]}>
                The Stoic reframe
              </Text>
              <Text style={[s.reframeText, !selectedEmotion && s.reframeTextMuted]}>
                {selectedEmotion
                  ? stoicReframesUpdated[selectedEmotion]
                  : 'Pick what you are feeling above. A Stoic reframe will appear here, with patterns to notice and a place to choose your response.'}
              </Text>

              <View style={s.reframeDivider} />

              <View collapsable={false}>
                <Text style={[s.fieldLabel, !selectedEmotion && s.fieldLabelMuted]}>What story are you telling yourself?</Text>
                <Text style={s.distortionSub}>Select any patterns you notice in your thinking</Text>
              </View>
              <View style={s.distortionGrid}>
                {DISTORTIONS.map(d => {
                  const isSelected = selectedDistortions.includes(d.id);
                  const ec = selectedEmotion ? EMOTION_COLORS[selectedEmotion] : null;
                  return (
                    <TouchableOpacity
                      key={d.id}
                      style={[
                        s.distortionPill,
                        isSelected && ec && { borderColor: ec.border, backgroundColor: ec.bg },
                      ]}
                      onPress={() => toggleDistortion(d.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={[s.distortionLabel, isSelected && ec && { color: ec.text }]}>
                        {d.label}
                      </Text>
                      <Text style={[s.distortionQ, isSelected && ec && { color: ec.text }]}>
                        {d.q}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={s.reframeDivider} />

              <Text style={[s.fieldLabel, !selectedEmotion && s.fieldLabelMuted]}>
                {timing === 'now' ? 'How will I respond?' : 'How should I have responded?'}
              </Text>
              <TextInput
                ref={responseInputRef}
                style={[s.fieldInput, focusedField !== 'response' && s.fieldInputDim]}
                multiline
                placeholder={timing === 'now'
                  ? "What is your chosen response going forward?"
                  : "Looking back, what would the Stoic have done?"}
                placeholderTextColor={colors.textDim}
                value={chosenResponse}
                onChangeText={setChosenResponse}
                onFocus={() => setFocusedField('response')}
                onBlur={() => setFocusedField(null)}
                editable={hasAccess}
                scrollEnabled={false}
                inputAccessoryViewID={Platform.OS === 'ios' ? 'emoResponseAccessory' : undefined}
              />
            </View>

            {!keyboardUp && (
              <>
                <TouchableOpacity
                  style={[s.editBtn, s.editBtnSave, s.saveBtn, !selectedEmotion && s.saveBtnDisabled]}
                  onPress={() => requireAccess(handleLog)}
                  activeOpacity={0.8}
                  disabled={!selectedEmotion}
                >
                  <Text style={[s.editBtnText, s.editBtnSaveText]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>Log this trigger</Text>
                </TouchableOpacity>
                <Text style={s.saveBtnSub}>
                  {selectedEmotion ? 'Saved privately · used in weekly review' : 'Select an emotion above to log this trigger'}
                </Text>
              </>
            )}

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      {Platform.OS === 'ios' && hasAccess && (
        <>
          <InputAccessoryView nativeID="emoTriggerAccessory">
            <View style={s.accessoryBarPair}>
              <TouchableOpacity style={s.editBtn} onPress={() => Keyboard.dismiss()} activeOpacity={0.8}>
                <Text style={s.editBtnText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>Done</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.editBtn, s.editBtnSave]}
                onPress={() => { haptics.tap(); reactionInputRef.current?.focus(); }}
                activeOpacity={0.8}
              >
                <Text style={[s.editBtnText, s.editBtnSaveText]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>Next</Text>
              </TouchableOpacity>
            </View>
          </InputAccessoryView>
          <InputAccessoryView nativeID="emoReactionAccessory">
            <View style={s.accessoryBarPair}>
              <TouchableOpacity style={s.editBtn} onPress={() => Keyboard.dismiss()} activeOpacity={0.8}>
                <Text style={s.editBtnText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>Done</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.editBtn, s.editBtnSave]}
                onPress={() => { haptics.tap(); scrollToReframe(); }}
                activeOpacity={0.8}
              >
                <Text style={[s.editBtnText, s.editBtnSaveText]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>Pick patterns</Text>
              </TouchableOpacity>
            </View>
          </InputAccessoryView>
          <InputAccessoryView nativeID="emoResponseAccessory">
            <View style={s.accessoryBarPair}>
              <TouchableOpacity style={s.editBtn} onPress={() => Keyboard.dismiss()} activeOpacity={0.8}>
                <Text style={s.editBtnText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>Done</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.editBtn, s.editBtnSave, !selectedEmotion && s.saveBtnDisabled]}
                onPress={() => { Keyboard.dismiss(); requireAccess(handleLog); }}
                activeOpacity={0.8}
                disabled={!selectedEmotion}
              >
                <Text style={[s.editBtnText, s.editBtnSaveText]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>Log this trigger</Text>
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
  scroll: { flex: 1 },
  // Dark header with hero image
  hero: {
    backgroundColor: colors.bgDeep,
    minHeight: 240,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  heroImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  heroContent: { padding: spacing.xl, paddingTop: 52 },
  eyebrow: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.accent, textTransform: 'uppercase', marginBottom: 8 },
  title: { fontSize: font.titleSize, fontWeight: '300', color: colors.textPrimary, letterSpacing: -0.5, lineHeight: 36, marginBottom: 6 },
  sub: { fontSize: font.subSize, color: colors.textMuted, lineHeight: 22 },
  // "Past triggers" link below the hero — uses Valeriya's library
  // smaller-button outlined-gold token (matches Past entries / Past readings / Past reviews).
  pastEntriesRow: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 20, paddingVertical: 14, backgroundColor: colors.bgDeep, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  pastEntriesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.md,
  },
  pastEntriesText: { fontSize: 12, fontWeight: '600', color: colors.accent, letterSpacing: 1, textTransform: 'uppercase' },
  // Light body
  body: { padding: spacing.md, backgroundColor: colors.bgCard },
  secLabel: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.accent, textTransform: 'uppercase', marginTop: 8, marginBottom: 12 },
  stageLabel: { fontSize: 11, letterSpacing: 3, color: colors.accentDim, textTransform: 'uppercase', marginTop: 36, marginBottom: 14 },
  feelingHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, marginBottom: 12 },
  hintBtn: { padding: 6, marginTop: -6 },
  hintBtnText: { fontSize: 20, color: colors.accent },
  hintBox: { backgroundColor: colors.bgDeep, borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.md, padding: 16, marginBottom: 14 },
  hintText: { fontSize: 15, color: colors.textSecondary, lineHeight: 24 },
  timingRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  timingBtn: { flex: 1, borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.lg, padding: 16, backgroundColor: colors.bgElevated },
  timingBtnActive: { borderColor: colors.textSecondary, backgroundColor: colors.bgElevated },
  timingBtnText: { fontSize: 14, fontWeight: '400', color: colors.textMuted, marginBottom: 4 },
  timingBtnTextActive: { color: colors.textPrimary, fontWeight: '500' },
  timingBtnSub: { fontSize: 12, color: colors.textDim, lineHeight: 18 },
  timingBtnSubActive: { color: colors.textSecondary },
  emotionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginBottom: 16 },
  ePill: { width: '31%', borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.md, paddingVertical: 18, alignItems: 'center', backgroundColor: colors.bgElevated, overflow: 'hidden' },
  eAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 3 },
  ePillName: { fontSize: 13, color: colors.textSecondary, fontWeight: '400' },
  // Input field treatment per Valeriya's library: subtle elevation above
  // screen bg, with stroke shifting between non-active (#474747) and
  // active (#878787) focus states.
  fieldCard: { borderWidth: 0.5, borderColor: colors.inputBorder, borderRadius: radius.lg, padding: 20, marginBottom: 10, backgroundColor: colors.inputBg },
  fieldCardActive: { borderColor: colors.inputBorderActive },
  fieldLabel: { fontSize: font.microSize, letterSpacing: 2, color: colors.textMuted, textTransform: 'uppercase', marginBottom: 12 },
  fieldInput: { fontSize: 16, color: colors.textPrimary, lineHeight: 25, minHeight: 64, textAlignVertical: 'top', paddingBottom: 60 },
  // Non-focused state: dim the typed text per Valeriya's library (grey body text).
  fieldInputDim: { color: colors.textMuted },
  reframeCard: { borderWidth: 1, borderRadius: radius.lg, padding: 26, marginBottom: 12, backgroundColor: colors.bgCard },
  reframeEyebrow: { fontSize: font.microSize, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12, fontWeight: '600' },
  reframeText: { fontSize: 16, color: colors.textSecondary, fontFamily: font.serif, lineHeight: 26, marginBottom: 16 },
  reframeTextMuted: { color: colors.textDim, fontStyle: 'italic' },
  fieldLabelMuted: { color: colors.textDim },
  reframeDivider: { height: 0.5, backgroundColor: colors.border, marginBottom: 16 },
  distortionSub: { fontSize: 13, color: colors.textMuted, marginBottom: 14 },
  distortionGrid: { gap: 10, marginBottom: 16 },
  distortionPill: { borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.md, padding: 14, backgroundColor: colors.bgElevated },
  distortionLabel: { fontSize: 15, fontWeight: '500', color: colors.textPrimary, marginBottom: 4 },
  distortionQ: { fontSize: 13, color: colors.textMuted, lineHeight: 20 },
  // In-body primary CTA reuses library editBtn + editBtnSave; this override
  // just adds spacing below the button before the caption.
  // In-body primary CTA — H56 override (no-keyboard primary per library).
  saveBtn: { height: 56, marginBottom: 12 },
  // Disabled state — gated on selectedEmotion. Emotion must be picked
  // before a trigger can be logged; everything else stays optional.
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnSub: { fontSize: 12, color: colors.textMuted, textAlign: 'center', marginBottom: 36 },
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
  // H44 keyboard accessory per library. In-body saveBtn overrides to 56.
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
});
