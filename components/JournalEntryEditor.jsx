import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Platform, InputAccessoryView, Keyboard,
} from 'react-native';
import { colors, radius, font } from '../constants/theme';
import { GoldPrimary, GoldSecondary } from './GoldButton';
import { morningPrompts, eveningPromptsInOrder, askedPrompt } from '../constants/journalPrompts';

// Inline editor for editing a saved journal entry. Used from the
// Past Entries view (app/journal-history.jsx). Rebuilds the same prompt
// card UI as the live Journal write flow, but pre-populates with the
// stored answers.
// `onInputGrow` is the onGrow factory from the host screen's useCaretScroll
// hook (the editor renders inside that screen's ScrollView). Wiring it keeps
// the caret above the keyboard as an answer grows past one line.
export function JournalEntryEditor({ entry, onSave, onCancel, onInputGrow }) {
  const isMorning = entry.type === 'morning';
  // Evening renders in display order (III · Undone sits at storage index 4);
  // `answerKey` carries the storage index so edits land on the right answer.
  // Edits show the entry the questions it was written under, so editing an old
  // answer never quietly re-frames it as an answer to a reworded prompt. Hints
  // stay live; only the label and question come from the snapshot.
  const prompts = (isMorning
    ? morningPrompts.map((p, i) => ({ ...p, answerKey: i }))
    : eveningPromptsInOrder
  ).map(p => askedPrompt(entry, p, p.answerKey));
  const [answers, setAnswers] = useState(entry.answers || {});
  const [openPrompt, setOpenPrompt] = useState(-1);
  const [openHint, setOpenHint] = useState(null);

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Edit {isMorning ? 'morning' : 'evening'} entry</Text>
        <Text style={s.headerDate}>{new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>
      </View>

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
                onPress={() => { if (openHint !== idx) Keyboard.dismiss(); setOpenHint(openHint === idx ? null : idx); }}
              >
                <Text style={s.hintBtnText}>ⓘ</Text>
              </TouchableOpacity>
            )}
          </View>
          <Text style={s.promptQ}>{prompt.q}</Text>
          {prompt.sub ? <Text style={s.promptSub}>{prompt.sub}</Text> : null}
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
                style={s.promptInput}
                multiline
                placeholder="Write here..."
                placeholderTextColor={colors.textSecondary}
                value={answers[prompt.answerKey] || ''}
                onChangeText={text => setAnswers(prev => ({ ...prev, [prompt.answerKey]: text }))}
                onFocus={() => setOpenHint(null)}
                onContentSizeChange={onInputGrow && onInputGrow(`prompt-${idx}`)}
                scrollEnabled={false}
                inputAccessoryViewID={Platform.OS === 'ios' ? 'journalArchiveEditAccessory' : undefined}
                keyboardAppearance="dark"
              />
            </View>
          )}
        </TouchableOpacity>
      ))}

      {/* Always-visible Save/Cancel — the keyboard accessory pair below only
          exists while an input is focused, which left no way to save or
          cancel once the keyboard was dismissed (edits were silently lost on
          navigate-away). Same hazard emotions-history solved with its header
          Done button. */}
      <View style={s.btnRow}>
        <GoldSecondary style={s.cancelBtn} onPress={onCancel}>
          <Text style={s.cancelBtnText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>Cancel</Text>
        </GoldSecondary>
        <GoldPrimary style={s.saveBtn} onPress={() => onSave({ ...entry, answers })}>
          <Text style={s.saveBtnText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>Save changes</Text>
        </GoldPrimary>
      </View>

      {Platform.OS === 'ios' && (
        <InputAccessoryView nativeID="journalArchiveEditAccessory">
          <View style={s.accessoryBarPair}>
            <GoldSecondary
              style={s.accessoryBtn}
              onPress={() => { Keyboard.dismiss(); onCancel(); }}
            >
              <Text style={s.accessoryBtnText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>Cancel</Text>
            </GoldSecondary>
            <GoldPrimary
              style={s.accessoryBtn}
              onPress={() => { Keyboard.dismiss(); onSave({ ...entry, answers }); }}
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
  virtueSection: { padding: 14, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  sectionLabel: { fontSize: font.labelSize, letterSpacing: 2, color: colors.accent, fontFamily: font.bodyMedium, textTransform: 'uppercase', marginBottom: 10 },
  virtuePills: { flexDirection: 'row', gap: 6 },
  vpill: { flex: 1, borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.sm, paddingVertical: 10, alignItems: 'center' },
  vpillActive: { borderColor: colors.accent, backgroundColor: colors.bg },
  vpillName: { fontSize: 11, fontFamily: font.bodyMedium, color: colors.textSecondary },
  vpillNameActive: { color: colors.accent },
  promptCard: { borderBottomWidth: 0.5, borderBottomColor: colors.border, paddingHorizontal: 8, paddingVertical: 14, backgroundColor: colors.bgCard },
  promptCardOpen: { backgroundColor: colors.bgElevated },
  promptTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  promptNum: { fontSize: 9, letterSpacing: 2, color: colors.accent, fontFamily: font.bodyMedium, textTransform: 'uppercase', marginBottom: 6 },
  promptQ: { fontSize: 14, color: colors.textSecondary, lineHeight: 22 },
  promptSub: { fontSize: 13, color: colors.textSecondary, fontStyle: 'italic', marginTop: 6, lineHeight: 20 },
  promptAnswer: { marginTop: 12, borderTopWidth: 0.5, borderTopColor: colors.border, paddingTop: 12 },
  promptInput: { fontSize: 16, color: colors.textPrimary, lineHeight: 26, minHeight: 56, textAlignVertical: 'top', fontFamily: font.body },
  hintBtn: { padding: 4 },
  hintBtnText: { fontSize: 18, color: colors.accent },
  hintBox: { marginTop: 12, padding: 12, backgroundColor: colors.bg, borderRadius: radius.md, borderWidth: 0.5, borderColor: colors.border },
  hintText: { fontSize: 16, color: colors.textSecondary, lineHeight: 26 },
  hintTitle: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.accent, fontFamily: font.bodyMedium, textTransform: 'uppercase', marginBottom: 4 },
  hintSource: { fontSize: 12, color: colors.textSecondary, fontStyle: 'italic', letterSpacing: 0.3 },
  hintDivider: { height: 0.5, backgroundColor: colors.border, marginTop: 12, marginBottom: 12 },
  btnRow: { flexDirection: 'row', gap: 10, padding: 14, backgroundColor: colors.bgDeep },
  // Library H56 outlined + filled-gold pair (matches editBtn / editBtnSave used
  // app-wide in compass / journal / emotions / review / read).
  cancelBtn: { flex: 1, minHeight: 56, borderRadius: radius.md, paddingHorizontal: 16 },
  cancelBtnText: { fontSize: 14, fontFamily: font.bodyMedium, color: colors.accent, letterSpacing: 0.3 },
  saveBtn: { flex: 1, minHeight: 56, borderWidth: 1, borderColor: colors.accent, backgroundColor: colors.accent, borderRadius: radius.md, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { fontSize: 14, fontFamily: font.bodyMedium, color: '#1a1a1a', letterSpacing: 0.3 },
  // Library accessory bar — H44 outlined + filled-gold pair so Save/Cancel
  // remain reachable above the keyboard while editing prompts.
  accessoryBarPair: {
    flexDirection: 'row', gap: 10, backgroundColor: colors.bg,
    borderTopWidth: 0.5, borderTopColor: colors.border,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  accessoryBtn: {
    flex: 1, minHeight: 44, borderRadius: radius.md,
    paddingHorizontal: 16,
  },
  accessoryBtnSave: { backgroundColor: colors.accent },
  accessoryBtnText: { fontSize: 14, fontFamily: font.bodyMedium, color: colors.accent, letterSpacing: 0.3 },
  accessoryBtnSaveText: { color: '#1a1a1a' },
});
