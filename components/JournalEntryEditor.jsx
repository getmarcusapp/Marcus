import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, radius, font } from '../constants/theme';
import { morningPrompts, eveningPrompts } from '../constants/journalPrompts';

// Inline editor for editing a saved journal entry. Used from the
// Past Entries view (app/journal-history.jsx). Rebuilds the same prompt
// card UI as the live Journal write flow, but pre-populates with the
// stored answers.
export function JournalEntryEditor({ entry, onSave, onCancel }) {
  const isMorning = entry.type === 'morning';
  const prompts = isMorning ? morningPrompts : eveningPrompts;
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
                style={s.promptInput}
                multiline
                placeholder="Write here..."
                placeholderTextColor={colors.textDim}
                value={answers[idx] || ''}
                onChangeText={text => setAnswers(prev => ({ ...prev, [idx]: text }))}
                scrollEnabled={false}
              />
            </View>
          )}
        </TouchableOpacity>
      ))}

      <View style={s.btnRow}>
        <TouchableOpacity style={s.cancelBtn} onPress={onCancel} activeOpacity={0.7}>
          <Text style={s.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={s.saveBtn}
          onPress={() => onSave({ ...entry, answers })}
          activeOpacity={0.8}
        >
          <Text style={s.saveBtnText}>Save changes</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { borderWidth: 0.5, borderColor: colors.accentDim, borderRadius: radius.lg, overflow: 'hidden', marginBottom: 12 },
  header: { backgroundColor: colors.accentBg, padding: 16, borderBottomWidth: 0.5, borderBottomColor: colors.accentDim, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 14, fontWeight: '600', color: colors.accent, textTransform: 'uppercase', letterSpacing: 0.8 },
  headerDate: { fontSize: 13, color: colors.accentDim },
  virtueSection: { padding: 14, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  sectionLabel: { fontSize: font.microSize, letterSpacing: 2, color: colors.accent, textTransform: 'uppercase', marginBottom: 10 },
  virtuePills: { flexDirection: 'row', gap: 6 },
  vpill: { flex: 1, borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.sm, paddingVertical: 10, alignItems: 'center' },
  vpillActive: { borderColor: colors.accent, backgroundColor: colors.accentBg },
  vpillName: { fontSize: 11, fontWeight: '500', color: colors.textDim },
  vpillNameActive: { color: colors.accent },
  promptCard: { borderBottomWidth: 0.5, borderBottomColor: colors.border, padding: 14, backgroundColor: colors.bgCard },
  promptCardOpen: { backgroundColor: colors.bgElevated },
  promptTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  promptNum: { fontSize: 9, letterSpacing: 2, color: colors.accent, textTransform: 'uppercase', marginBottom: 6 },
  promptQ: { fontSize: 14, color: colors.textSecondary, lineHeight: 22, fontFamily: font.serif },
  promptSub: { fontSize: 13, color: colors.textMuted, fontStyle: 'italic', marginTop: 6, lineHeight: 20 },
  promptAnswer: { marginTop: 12, borderTopWidth: 0.5, borderTopColor: colors.border, paddingTop: 12 },
  promptInput: { fontSize: 15, color: colors.textPrimary, lineHeight: 24, minHeight: 80, textAlignVertical: 'top' },
  hintBtn: { padding: 4 },
  hintBtnText: { fontSize: 18, color: colors.accent },
  hintBox: { marginTop: 12, padding: 12, backgroundColor: colors.bg, borderRadius: radius.md, borderWidth: 0.5, borderColor: colors.border },
  hintText: { fontSize: 16, color: colors.textSecondary, lineHeight: 26, fontFamily: font.serif },
  hintTitle: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.accent, textTransform: 'uppercase', marginBottom: 4 },
  hintSource: { fontSize: 12, color: colors.textDim, fontStyle: 'italic', letterSpacing: 0.3 },
  hintDivider: { height: 0.5, backgroundColor: colors.border, marginTop: 12, marginBottom: 12 },
  btnRow: { flexDirection: 'row', gap: 10, padding: 14, backgroundColor: colors.bgDeep },
  cancelBtn: { flex: 1, borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.md, padding: 14, alignItems: 'center' },
  cancelBtnText: { fontSize: 13, color: colors.textDim, letterSpacing: 0.8, textTransform: 'uppercase' },
  saveBtn: { flex: 2, borderWidth: 0.5, borderColor: colors.accentDim, borderRadius: radius.md, padding: 14, alignItems: 'center', backgroundColor: colors.accentBg },
  saveBtnText: { fontSize: 13, fontWeight: '600', color: colors.accent, letterSpacing: 0.8, textTransform: 'uppercase' },
});
