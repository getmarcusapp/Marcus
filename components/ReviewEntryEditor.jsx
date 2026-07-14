import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Platform, InputAccessoryView, Keyboard,
} from 'react-native';
import { colors, radius, font } from '../constants/theme';
import { GoldPrimary, GoldSecondary } from './GoldButton';

// Inline editor for a saved weekly review entry. Mirrors JournalEntryEditor:
// expandable prompt cards with the stored answers pre-populated, plus the
// VI · Account roles input (when present) and VII · Commit intention.
// Virtue picks (V · Ledger best/worst) are not currently editable here —
// the text fields cover the substance of a revision pass.

const PROMPTS = [
  { num: 'I · Honor',  key: 'wentWell',   q: 'What went well? Where did I act with Virtue this week?' },
  { num: 'II · Reckon', key: 'strayed',    q: 'Where did I stray? Where did I fall short of my own standard?' },
  { num: 'III · Pattern', key: 'challenges', q: 'What patterns am I noticing? What remains unresolved?' },
  { num: 'IV · Body', key: 'body',        q: 'How did I treat my physical self: sleep, movement, food, restraint?' },
];

// `onInputGrow` is the onGrow factory from the host screen's useCaretScroll
// hook — keeps the caret above the keyboard as an answer grows past one line.
export function ReviewEntryEditor({ entry, onSave, onCancel, onInputGrow }) {
  const [answers, setAnswers] = useState(entry.answers || {});
  const [intention, setIntention] = useState(entry.intention || '');
  const [openPrompt, setOpenPrompt] = useState(-1);

  const hasRoles = typeof (entry.answers?.roles) !== 'undefined';

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Edit review</Text>
        <Text style={s.headerDate}>Week of {entry.weekOf}</Text>
      </View>

      {PROMPTS.map((prompt, idx) => (
        <TouchableOpacity
          key={prompt.key}
          style={[s.promptCard, openPrompt === idx && s.promptCardOpen]}
          onPress={() => setOpenPrompt(openPrompt === idx ? -1 : idx)}
          activeOpacity={0.8}
        >
          <Text style={s.promptNum}>{prompt.num}</Text>
          <Text style={s.promptQ}>{prompt.q}</Text>
          {openPrompt === idx && (
            <View style={s.promptAnswer}>
              <TextInput
                style={s.promptInput}
                multiline
                placeholder="Write here..."
                placeholderTextColor={colors.textSecondary}
                value={answers[prompt.key] || ''}
                onChangeText={text => setAnswers(prev => ({ ...prev, [prompt.key]: text }))}
                onContentSizeChange={onInputGrow && onInputGrow(`prompt-${prompt.key}`)}
                scrollEnabled={false}
                inputAccessoryViewID={Platform.OS === 'ios' ? 'reviewArchiveEditAccessory' : undefined}
                keyboardAppearance="dark"
              />
            </View>
          )}
        </TouchableOpacity>
      ))}

      {hasRoles && (
        <TouchableOpacity
          style={[s.promptCard, openPrompt === 'account' && s.promptCardOpen]}
          onPress={() => setOpenPrompt(openPrompt === 'account' ? -1 : 'account')}
          activeOpacity={0.8}
        >
          <Text style={s.promptNum}>VI · Account</Text>
          <Text style={s.promptQ}>Which role did I serve well this week? Which fell short?</Text>
          {openPrompt === 'account' && (
            <View style={s.promptAnswer}>
              <TextInput
                style={s.promptInput}
                multiline
                placeholder="Be specific. Name names, name moments..."
                placeholderTextColor={colors.textSecondary}
                value={answers.roles || ''}
                onChangeText={text => setAnswers(prev => ({ ...prev, roles: text }))}
                onContentSizeChange={onInputGrow && onInputGrow('account')}
                scrollEnabled={false}
                inputAccessoryViewID={Platform.OS === 'ios' ? 'reviewArchiveEditAccessory' : undefined}
                keyboardAppearance="dark"
              />
            </View>
          )}
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={[s.promptCard, openPrompt === 'commit' && s.promptCardOpen]}
        onPress={() => setOpenPrompt(openPrompt === 'commit' ? -1 : 'commit')}
        activeOpacity={0.8}
      >
        <Text style={s.promptNum}>{hasRoles ? 'VII · Commit' : 'VI · Commit'}</Text>
        <Text style={s.promptQ}>What is the single most important thing I want to do this week?</Text>
        {openPrompt === 'commit' && (
          <View style={s.promptAnswer}>
            <TextInput
              style={s.promptInput}
              multiline
              placeholder="One commitment, kept."
              placeholderTextColor={colors.textSecondary}
              value={intention}
              onChangeText={setIntention}
              onContentSizeChange={onInputGrow && onInputGrow('intention')}
              scrollEnabled={false}
              inputAccessoryViewID={Platform.OS === 'ios' ? 'reviewArchiveEditAccessory' : undefined}
              keyboardAppearance="dark"
            />
          </View>
        )}
      </TouchableOpacity>

      {/* Always-visible Save/Cancel — the keyboard accessory pair only exists
          while an input is focused, which left no way to save when the
          keyboard was down (e.g. after editing only the distortion pills).
          Same hazard emotions-history solved with its header Done button. */}
      <View style={s.btnRow}>
        <GoldSecondary style={s.cancelBtn} onPress={onCancel}>
          <Text style={s.cancelBtnText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>Cancel</Text>
        </GoldSecondary>
        <GoldPrimary style={s.saveBtn} onPress={() => onSave({ ...entry, answers, intention })}>
          <Text style={s.saveBtnText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>Save changes</Text>
        </GoldPrimary>
      </View>

      {Platform.OS === 'ios' && (
        <InputAccessoryView nativeID="reviewArchiveEditAccessory">
          <View style={s.accessoryBarPair}>
            <GoldSecondary
              style={s.accessoryBtn}
              onPress={() => { Keyboard.dismiss(); onCancel(); }}
            >
              <Text style={s.accessoryBtnText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>Cancel</Text>
            </GoldSecondary>
            <GoldPrimary
              style={s.accessoryBtn}
              onPress={() => { Keyboard.dismiss(); onSave({ ...entry, answers, intention }); }}
            >
              <Text style={[s.accessoryBtnText, s.accessoryBtnSaveText]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>Save changes</Text>
            </GoldPrimary>
          </View>
        </InputAccessoryView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { borderWidth: 0.5, borderColor: colors.accentDim, borderRadius: radius.md, overflow: 'hidden', marginBottom: 12 },
  header: { backgroundColor: colors.bg, padding: 16, borderBottomWidth: 0.5, borderBottomColor: colors.accentDim, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 14, color: colors.accent, fontFamily: font.bodyMedium, textTransform: 'uppercase', letterSpacing: 0.8 },
  headerDate: { fontSize: 13, color: colors.accentDim },
  promptCard: { borderBottomWidth: 0.5, borderBottomColor: colors.border, paddingHorizontal: 8, paddingVertical: 14, backgroundColor: colors.bgCard },
  promptCardOpen: { backgroundColor: colors.bgElevated },
  promptNum: { fontSize: 9, letterSpacing: 2, color: colors.accent, fontFamily: font.bodyMedium, textTransform: 'uppercase', marginBottom: 6 },
  promptQ: { fontSize: 14, color: colors.textSecondary, lineHeight: 22 },
  promptAnswer: { marginTop: 12, borderTopWidth: 0.5, borderTopColor: colors.border, paddingTop: 12 },
  promptInput: { fontSize: 16, color: colors.textPrimary, lineHeight: 26, minHeight: 56, textAlignVertical: 'top', fontFamily: font.body },
  btnRow: { flexDirection: 'row', gap: 10, padding: 14, backgroundColor: colors.bgDeep },
  cancelBtn: { flex: 1, height: 56, borderRadius: radius.md, paddingHorizontal: 16 },
  cancelBtnText: { fontSize: 14, fontFamily: font.bodyMedium, color: colors.accent, letterSpacing: 0.3 },
  saveBtn: { flex: 1, height: 56, borderWidth: 1, borderColor: colors.accent, backgroundColor: colors.accent, borderRadius: radius.md, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { fontSize: 14, fontFamily: font.bodyMedium, color: '#1a1a1a', letterSpacing: 0.3 },
  // Library accessory bar — H44 outlined + filled-gold pair so Save/Cancel
  // are reachable above the keyboard when editing fields inside this editor.
  accessoryBarPair: {
    flexDirection: 'row', gap: 10, backgroundColor: colors.bg,
    borderTopWidth: 0.5, borderTopColor: colors.border,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  accessoryBtn: {
    flex: 1, height: 44, borderRadius: radius.md,
    paddingHorizontal: 16,
  },
  accessoryBtnSave: { backgroundColor: colors.accent },
  accessoryBtnText: { fontSize: 14, fontFamily: font.bodyMedium, color: colors.accent, letterSpacing: 0.3 },
  accessoryBtnSaveText: { color: '#1a1a1a' },
});
