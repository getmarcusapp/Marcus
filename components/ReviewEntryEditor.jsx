import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Platform, InputAccessoryView, Keyboard,
} from 'react-native';
import { colors, radius, font } from '../constants/theme';

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

export function ReviewEntryEditor({ entry, onSave, onCancel }) {
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
                placeholderTextColor={colors.textDim}
                value={answers[prompt.key] || ''}
                onChangeText={text => setAnswers(prev => ({ ...prev, [prompt.key]: text }))}
                scrollEnabled={false}
                inputAccessoryViewID={Platform.OS === 'ios' ? 'reviewArchiveEditAccessory' : undefined}
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
                placeholderTextColor={colors.textDim}
                value={answers.roles || ''}
                onChangeText={text => setAnswers(prev => ({ ...prev, roles: text }))}
                scrollEnabled={false}
                inputAccessoryViewID={Platform.OS === 'ios' ? 'reviewArchiveEditAccessory' : undefined}
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
              placeholderTextColor={colors.textDim}
              value={intention}
              onChangeText={setIntention}
              scrollEnabled={false}
              inputAccessoryViewID={Platform.OS === 'ios' ? 'reviewArchiveEditAccessory' : undefined}
            />
          </View>
        )}
      </TouchableOpacity>

      <View style={s.btnRow}>
        <TouchableOpacity style={s.cancelBtn} onPress={onCancel} activeOpacity={0.7}>
          <Text style={s.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={s.saveBtn}
          onPress={() => onSave({ ...entry, answers, intention })}
          activeOpacity={0.8}
        >
          <Text style={s.saveBtnText}>Save changes</Text>
        </TouchableOpacity>
      </View>
      {Platform.OS === 'ios' && (
        <InputAccessoryView nativeID="reviewArchiveEditAccessory">
          <View style={s.accessoryBarPair}>
            <TouchableOpacity
              style={s.accessoryBtn}
              onPress={() => { Keyboard.dismiss(); onCancel(); }}
              activeOpacity={0.8}
            >
              <Text style={s.accessoryBtnText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.accessoryBtn, s.accessoryBtnSave]}
              onPress={() => { Keyboard.dismiss(); onSave({ ...entry, answers, intention }); }}
              activeOpacity={0.8}
            >
              <Text style={[s.accessoryBtnText, s.accessoryBtnSaveText]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>Save changes</Text>
            </TouchableOpacity>
          </View>
        </InputAccessoryView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { borderWidth: 0.5, borderColor: colors.accentDim, borderRadius: radius.lg, overflow: 'hidden', marginBottom: 12 },
  header: { backgroundColor: colors.accentBg, padding: 16, borderBottomWidth: 0.5, borderBottomColor: colors.accentDim, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 14, fontWeight: '600', color: colors.accent, textTransform: 'uppercase', letterSpacing: 0.8 },
  headerDate: { fontSize: 13, color: colors.accentDim },
  promptCard: { borderBottomWidth: 0.5, borderBottomColor: colors.border, padding: 14, backgroundColor: colors.bgCard },
  promptCardOpen: { backgroundColor: colors.bgElevated },
  promptNum: { fontSize: 9, letterSpacing: 2, color: colors.accent, textTransform: 'uppercase', marginBottom: 6 },
  promptQ: { fontSize: 14, color: colors.textSecondary, lineHeight: 22, fontFamily: font.serif },
  promptAnswer: { marginTop: 12, borderTopWidth: 0.5, borderTopColor: colors.border, paddingTop: 12 },
  promptInput: { fontSize: 15, color: colors.textPrimary, lineHeight: 24, minHeight: 80, textAlignVertical: 'top', paddingBottom: 60 },
  btnRow: { flexDirection: 'row', gap: 10, padding: 14, backgroundColor: colors.bgDeep },
  cancelBtn: { flex: 1, height: 56, borderWidth: 1, borderColor: colors.accent, backgroundColor: colors.bg, borderRadius: radius.md, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  cancelBtnText: { fontSize: 14, fontWeight: '500', color: colors.accent, letterSpacing: 0.3 },
  saveBtn: { flex: 1, height: 56, borderWidth: 1, borderColor: colors.accent, backgroundColor: colors.accent, borderRadius: radius.md, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { fontSize: 14, fontWeight: '500', color: '#1a1a1a', letterSpacing: 0.3 },
  // Library accessory bar — H44 outlined + filled-gold pair so Save/Cancel
  // are reachable above the keyboard when editing fields inside this editor.
  accessoryBarPair: {
    flexDirection: 'row', gap: 10, backgroundColor: colors.bg,
    borderTopWidth: 0.5, borderTopColor: colors.border,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  accessoryBtn: {
    flex: 1, height: 44, borderWidth: 1, borderColor: colors.accent,
    backgroundColor: colors.bg, borderRadius: radius.md,
    paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center',
  },
  accessoryBtnSave: { backgroundColor: colors.accent },
  accessoryBtnText: { fontSize: 14, fontWeight: '500', color: colors.accent, letterSpacing: 0.3 },
  accessoryBtnSaveText: { color: '#1a1a1a' },
});
