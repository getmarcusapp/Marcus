import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, SafeAreaView,
  StyleSheet, KeyboardAvoidingView, Platform, InputAccessoryView, Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, font } from '../constants/theme';
import { GoldPrimary, GoldSecondary } from './GoldButton';
import { COMPASS_FIELDS } from '../constants/compassFields';
import { useKeyboardVisible } from '../lib/useKeyboardVisible';

// First-visit walkthrough for the Compass screen. Lifts the experience that
// used to live in Onboarding (Your Compass is ready) into the live /compass
// surface so users only see it when they actually open the Compass — not
// inline during onboarding where it slowed them down.
//
// Two modes:
//   - 'summary': preview cards for Why / Overcome / Aspire with an EDIT
//     chip per card. A "Use these to start" CTA dismisses the intro.
//   - 'edit':    one prompt at a time with a TextInput + keyboard accessory
//     (Back / Next | Save). Mirrors the prior onboarding flow.
//
// Parent owns the compass state and persists changes; this component is
// purely UI + local edit-step tracking.
export function CompassIntro({ compass, setCompass, onDismiss, onBack }) {
  const [mode, setMode] = useState('summary');
  const [editIdx, setEditIdx] = useState(0);
  const [hintOpen, setHintOpen] = useState(false);
  // Separate from hintOpen (which is the per-field edit-step hint) so the
  // ready-step Roles bubble toggles independently.
  const [rolesOpen, setRolesOpen] = useState(false);
  const [editFocused, setEditFocused] = useState(false);
  const editInputRef = useRef(null);
  const keyboardUp = useKeyboardVisible();

  useEffect(() => {
    if (mode !== 'edit') return;
    const t = setTimeout(() => editInputRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, [mode, editIdx]);

  function advanceOrFinish() {
    if (editIdx < COMPASS_FIELDS.length - 1) {
      setEditIdx(editIdx + 1);
      setHintOpen(false);
    } else {
      setMode('summary');
    }
  }

  function goBack() {
    if (editIdx > 0) {
      setEditIdx(editIdx - 1);
      setHintOpen(false);
    } else {
      setMode('summary');
    }
  }

  if (mode === 'edit') {
    const field = COMPASS_FIELDS[editIdx];
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.editHeader}>
          <TouchableOpacity
            onPress={() => { Keyboard.dismiss(); goBack(); }}
            style={s.editHeaderBackBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={18} color={colors.accent} />
            <Text style={s.editHeaderBackText}>Back</Text>
          </TouchableOpacity>
        </View>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          <ScrollView
            style={s.scroll}
            showsVerticalScrollIndicator={false}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: keyboardUp ? 24 : 140 }}
          >
            <View style={s.stepHero}>
              <Text style={s.stepEyebrow}>{editIdx + 1} of {COMPASS_FIELDS.length}</Text>
              <Text style={s.stepTitle}>{field.label}</Text>
              <Text style={s.stepSub}>{field.sub}</Text>
            </View>

            <View style={s.stepBody}>
              <View style={[s.compassField, editFocused && s.compassFieldFocused]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 4 }}>
                  <TouchableOpacity
                    onPress={() => { if (!hintOpen) Keyboard.dismiss(); setHintOpen(!hintOpen); }}
                    style={{ padding: 4 }}
                    activeOpacity={0.7}
                  >
                    <Text style={{ fontSize: 18, color: colors.accent }}>ⓘ</Text>
                  </TouchableOpacity>
                </View>
                {hintOpen && (
                  <View style={{ backgroundColor: colors.bg, borderWidth: 0.5, borderColor: colors.border, borderRadius: 10, padding: 14, marginBottom: 10 }}>
                    <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 21 }}>{field.hint}</Text>
                  </View>
                )}
                <TextInput
                  ref={editInputRef}
                  style={[s.compassInput, editFocused && s.compassInputFocused]}
                  multiline
                  value={compass[field.key]}
                  onChangeText={text => setCompass(prev => ({ ...prev, [field.key]: text }))}
                  onFocus={() => { setEditFocused(true); setHintOpen(false); }}
                  onBlur={() => setEditFocused(false)}
                  placeholder={field.placeholder}
                  placeholderTextColor={colors.textSecondary}
                  scrollEnabled={false}
                  keyboardAppearance="dark"
                  inputAccessoryViewID={Platform.OS === 'ios' ? 'compassIntroAccessory' : undefined}
                />
              </View>
            </View>
          </ScrollView>
          {!keyboardUp && (
            <View style={s.footer}>
              <GoldPrimary style={s.primaryBtn} onPress={advanceOrFinish}>
                <Text style={[s.primaryBtnText, { color: '#1a1a1a' }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                  {editIdx < COMPASS_FIELDS.length - 1 ? 'Next' : 'Save'}
                </Text>
                <Ionicons name="arrow-forward" size={18} color="#1a1a1a" style={{ marginTop: 2 }} />
              </GoldPrimary>
            </View>
          )}
        </KeyboardAvoidingView>
        {Platform.OS === 'ios' && (
          <InputAccessoryView nativeID="compassIntroAccessory">
            <View style={s.accessoryBarPair}>
              <GoldSecondary onPress={() => { Keyboard.dismiss(); goBack(); }} style={s.editBtn}>
                <Text style={s.editBtnText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>Back</Text>
              </GoldSecondary>
              <GoldPrimary
                onPress={() => { Keyboard.dismiss(); advanceOrFinish(); }}
                style={s.editBtn}
              >
                <Text style={[s.editBtnText, s.editBtnSaveText]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                  {editIdx < COMPASS_FIELDS.length - 1 ? 'Next' : 'Save'}
                </Text>
              </GoldPrimary>
            </View>
          </InputAccessoryView>
        )}
      </SafeAreaView>
    );
  }

  // Summary mode (default)
  return (
    <SafeAreaView style={s.safe}>
      {onBack && (
        <View style={s.editHeader}>
          <TouchableOpacity
            onPress={onBack}
            style={s.editHeaderBackBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={18} color={colors.accent} />
            <Text style={s.editHeaderBackText}>Back</Text>
          </TouchableOpacity>
        </View>
      )}
      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 140 }}
      >
        <View style={s.stepHero}>
          <Text style={s.stepTitle}>Your Compass{'\n'}is ready</Text>
          <Text style={s.stepSub}>
            Three answers anchor your daily practice. The defaults below are a complete starting point. Customize them now or anytime later in Compass.{'\u00A0'}
            <Text style={s.rolesInfoIcon} onPress={() => setRolesOpen(!rolesOpen)}>{'\u24D8'}</Text>
          </Text>
          {rolesOpen && (
            <View style={s.rolesBubble}>
              <Text style={s.rolesBubbleText}>
                Your Compass also has a Roles section for naming the relational positions you occupy: parent, partner, colleague, citizen. You can fill that in once your practice begins, in Compass · Roles.
              </Text>
            </View>
          )}
        </View>

        <View style={s.stepBody}>
          {COMPASS_FIELDS.map((field, i) => (
            <TouchableOpacity
              key={field.key}
              style={s.compassPreview}
              onPress={() => { setMode('edit'); setEditIdx(i); setHintOpen(false); }}
              activeOpacity={0.75}
            >
              <View style={s.compassPreviewHeader}>
                <Text style={s.compassPreviewLabel}>{field.label}</Text>
                <View style={s.compassPreviewEdit}>
                  <Ionicons name="create-outline" size={12} color={colors.accent} />
                  <Text style={s.compassPreviewEditText}>Edit</Text>
                </View>
              </View>
              <Text style={s.compassPreviewText} numberOfLines={3}>
                {compass[field.key] || field.placeholder}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
      <View style={s.footer}>
        <GoldPrimary style={s.primaryBtn} onPress={onDismiss}>
          <Text style={[s.primaryBtnText, { color: '#1a1a1a' }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>Use these to start</Text>
          <Ionicons name="arrow-forward" size={18} color="#1a1a1a" style={{ marginTop: 2 }} />
        </GoldPrimary>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  // Top-of-screen back affordance for the multi-step edit flow. Without
  // this users were stranded once the keyboard dismissed (the only
  // alternate Back lives in the keyboard accessory bar).
  editHeader: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 4 },
  editHeaderBackBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4, paddingRight: 12, alignSelf: 'flex-start' },
  editHeaderBackText: { fontSize: 13, color: colors.accent, letterSpacing: 0.8, fontFamily: font.bodyMedium, textTransform: 'uppercase' },
  stepHero: {
    backgroundColor: colors.bgDeep,
    paddingHorizontal: 28,
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  stepEyebrow: {
    fontSize: font.labelSize,
    letterSpacing: font.sectionTracking,
    color: colors.accent,
    fontFamily: font.bodyMedium, textTransform: 'uppercase',
    marginBottom: 6,
  },
  stepTitle: {
    fontSize: 44,
    fontFamily: font.display,
    color: '#FFFFFF',
    letterSpacing: -1.5,
    lineHeight: 52,
    marginBottom: 8,
  },
  stepSub: {
    fontSize: 17,
    color: colors.textSecondary,
    lineHeight: 26,
  },
  stepBody: {
    paddingHorizontal: 24,
    paddingTop: 28,
  },
  compassField: {
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 20,
    marginBottom: 16,
    backgroundColor: colors.inputBg,
  },
  compassFieldFocused: {
    borderColor: colors.inputBorderActive,
  },
  compassInput: {
    fontSize: 18,
    color: colors.textPrimary,
    lineHeight: 28,
    minHeight: 240,
    textAlignVertical: 'top',
    fontFamily: font.body,
  },
  compassInputFocused: {
    color: colors.textPrimary,
  },
  compassPreview: {
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 16,
    marginBottom: 12,
    backgroundColor: colors.bgCard,
  },
  compassPreviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  compassPreviewLabel: {
    fontSize: 14,
    fontFamily: font.bodyMedium,
    color: colors.textPrimary,
    letterSpacing: 0.2,
  },
  compassPreviewEdit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 0.5,
    borderColor: colors.accent,
    borderRadius: 6,
  },
  // Matches the canonical archive EDIT chip — icon left, "Edit" right in
  // title case (per Valeriya: the archive form is the one to align to).
  compassPreviewEditText: {
    fontSize: 12,
    color: colors.accent,
    letterSpacing: 0.3,
  },
  compassPreviewText: {
    fontSize: 16,
    color: colors.textSecondary,
    lineHeight: 24,
  },
  // Inline info affordance on the subheadline. Trailing ⓘ in accent, with a
  // bordered reveal bubble matching the per-field hint bubble used in the
  // edit step (bg fill, 0.5 border, radius 10, 14 padding).
  rolesInfoIcon: {
    fontSize: 15,
    color: colors.accent,
  },
  rolesBubble: {
    backgroundColor: colors.bg,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 14,
    marginTop: 12,
  },
  rolesBubbleText: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 21,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 16,
    backgroundColor: colors.bg,
    borderTopWidth: 0.5,
    borderTopColor: colors.border,
  },
  primaryBtn: {
    backgroundColor: colors.bg,
    borderWidth: 0.5,
    borderColor: colors.accent,
    borderRadius: radius.md,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 8,
  },
  primaryBtnText: {
    fontSize: 15,
    fontFamily: font.bodyMedium,
    color: colors.accent,
    letterSpacing: 0.3,
  },
  // Library accessory bar — H44 outlined + filled-gold pair.
  accessoryBarPair: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: colors.bg,
    borderTopWidth: 0.5,
    borderTopColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  editBtn: {
    flex: 1,
    height: 44,
    borderRadius: radius.md,
    paddingHorizontal: 16,
  },
  editBtnSave: { backgroundColor: colors.accent },
  editBtnText: { fontSize: 14, fontFamily: font.bodyMedium, color: colors.accent, letterSpacing: 0.3 },
  editBtnSaveText: { color: '#1a1a1a' },
});
