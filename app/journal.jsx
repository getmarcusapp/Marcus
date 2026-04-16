import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TextInput,
  TouchableOpacity, StyleSheet, SafeAreaView, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { colors, radius, spacing, font } from '../constants/theme';
import { virtues } from '../constants/virtues';
import { saveJournal, getTodayJournal, getJournals, incrementStreak, updateJournalEntry } from '../store/db';

const morningPrompts = [
  { num: 'I', q: 'What is in my control today — and what must I release?' },
  { num: 'II', q: 'Where will courage be required of me today?' },
  { num: 'III', q: 'What are you postponing that matters? Name one thing.' },
  { num: 'IV', q: 'What difficulty might arise today, and how would a person of virtue meet it?' },
  { num: 'V · Memento mori', q: 'The hourglass turns. What do you owe the day?' },
];

const eveningPrompts = [
  { num: 'I · Examine', q: 'Where did I act in accordance with my virtue today?' },
  { num: 'II · Confess', q: 'Where did I fall short? What would the Stoic have done?' },
  { num: 'III · Release', q: 'What am I carrying that I must set down before I sleep?' },
  { num: 'IV · Gratitude', q: 'Name one thing — however small — that deserves your thanks.' },
];

const virtueDetails = {
  wisdom: { latin: 'Sophia', definition: 'The virtue of discernment and right judgment. Wisdom means seeing things clearly — not as you wish them to be, but as they are.', question: 'Am I perceiving this clearly or through bias, fear, or ego?' },
  courage: { latin: 'Andreia', definition: 'The virtue of strength and moral fortitude. Courage is doing the right thing even when it is hard.', question: 'What fear is stopping me right now?' },
  moderation: { latin: 'Sophrosyne', definition: 'The virtue of temperance and balance. Neither indulgence nor deprivation — the disciplined middle path.', question: 'Where am I in excess today?' },
  justice: { latin: 'Dikaiosyne', definition: 'The virtue of fairness and right action toward others. Justice is about how you treat the people around you.', question: 'Did I treat others with fairness today?' },
};

function JournalEntryEditor({ entry, onSave, onCancel }) {
  const isMorning = entry.type === 'morning';
  const prompts = isMorning ? morningPrompts : eveningPrompts;
  const [answers, setAnswers] = useState(entry.answers || {});
  const [selectedVirtue, setSelectedVirtue] = useState(entry.virtue || virtues[0].id);
  const [openPrompt, setOpenPrompt] = useState(0);

  return (
    <View style={e.container}>
      <View style={e.header}>
        <Text style={e.headerTitle}>Edit {isMorning ? 'morning' : 'evening'} entry</Text>
        <Text style={e.headerDate}>{new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>
      </View>

      {isMorning && (
        <View style={e.virtueSection}>
          <Text style={e.sectionLabel}>Virtue focus</Text>
          <View style={e.virtuePills}>
            {virtues.map(v => (
              <TouchableOpacity
                key={v.id}
                style={[e.vpill, selectedVirtue === v.id && e.vpillActive]}
                onPress={() => setSelectedVirtue(v.id)}
                activeOpacity={0.7}
              >
                <Text style={[e.vpillName, selectedVirtue === v.id && e.vpillNameActive]}>{v.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {prompts.map((prompt, idx) => (
        <TouchableOpacity
          key={idx}
          style={[e.promptCard, openPrompt === idx && e.promptCardOpen]}
          onPress={() => setOpenPrompt(openPrompt === idx ? -1 : idx)}
          activeOpacity={0.8}
        >
          <Text style={e.promptNum}>{prompt.num}</Text>
          <Text style={e.promptQ}>{prompt.q}</Text>
          {openPrompt === idx && (
            <View style={e.promptAnswer}>
              <TextInput
                style={e.promptInput}
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

      <View style={e.btnRow}>
        <TouchableOpacity style={e.cancelBtn} onPress={onCancel} activeOpacity={0.7}>
          <Text style={e.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={e.saveBtn}
          onPress={() => onSave({ ...entry, answers, virtue: selectedVirtue })}
          activeOpacity={0.8}
        >
          <Text style={e.saveBtnText}>Save changes</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function JournalScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const type = params?.type || 'morning';
  const isMorning = type !== 'evening';
  const prompts = isMorning ? morningPrompts : eveningPrompts;

  const [answers, setAnswers] = useState({});
  const [selectedVirtue, setSelectedVirtue] = useState(virtues[0].id);
  const [openPrompt, setOpenPrompt] = useState(0);
  const [alreadySaved, setAlreadySaved] = useState(false);
  const [showVirtueDetail, setShowVirtueDetail] = useState(false);
  const [viewMode, setViewMode] = useState('write'); // 'write' | 'history'
  const [history, setHistory] = useState([]);
  const [editingEntry, setEditingEntry] = useState(null);

  useEffect(() => {
    async function load() {
      const existing = await getTodayJournal(isMorning ? 'morning' : 'evening');
      if (existing) {
        setAnswers(existing.answers || {});
        setSelectedVirtue(existing.virtue || virtues[0].id);
        setAlreadySaved(true);
      } else {
        setAnswers({});
        setSelectedVirtue(virtues[0].id);
        setAlreadySaved(false);
      }
      const all = await getJournals();
      setHistory(all.filter(j => j.type === (isMorning ? 'morning' : 'evening')));
    }
    load();
  }, [type]);

  const answeredCount = Object.values(answers).filter(v => v && v.trim().length > 0).length;
  const selectedVirtueObj = virtues.find(v => v.id === selectedVirtue);
  const virtueDetail = virtueDetails[selectedVirtue];

  async function handleSave() {
    const entry = {
      id: Date.now().toString(),
      type: isMorning ? 'morning' : 'evening',
      date: new Date().toISOString(),
      virtue: selectedVirtue,
      answers,
    };
    const ok = await saveJournal(entry);
    if (ok) {
      await incrementStreak();
      setAlreadySaved(true);
      const all = await getJournals();
      setHistory(all.filter(j => j.type === (isMorning ? 'morning' : 'evening')));
      Alert.alert(
  '',
  isMorning ? 'Morning reflection saved.' : 'Evening reflection saved.',
  [
    { text: 'Go to Practice', onPress: () => router.replace('/') },
    { text: 'Read today\'s wisdom', onPress: () => router.replace('/read') },
  ]
);
    }
  }

 async function handleEditSave(updated) {
  const ok = await updateJournalEntry(updated);
  if (ok) {
    const all = await getJournals();
    setHistory(all.filter(j => j.type === (isMorning ? 'morning' : 'evening')));
    setEditingEntry(null);
    Alert.alert('', 'Entry updated.');
  }
}

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <SafeAreaView style={s.safe}>
        <ScrollView
          style={s.scroll}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
        >
          <View style={s.header}>
            <TouchableOpacity onPress={() => router.back()} style={s.backRow}>
              <Text style={s.backArrow}>‹</Text>
              <Text style={s.backLabel}>Practice</Text>
            </TouchableOpacity>
            <Text style={s.eyebrow}>{isMorning ? 'Morning reflection' : 'Evening reflection'}</Text>
            <Text style={s.title}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long' })}{'\n'}
              {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
            </Text>
            <Text style={s.sub}>
              {isMorning ? '5–10 minutes · Before the world begins' : '10–15 minutes · Before the day closes'}
            </Text>
          </View>

          <View style={s.tabRow}>
            {['write', 'history'].map(t => (
              <TouchableOpacity
                key={t}
                style={[s.tabBtn, viewMode === t && s.tabBtnActive]}
                onPress={() => setViewMode(t)}
              >
                <Text style={[s.tabBtnText, viewMode === t && s.tabBtnTextActive]}>
                  {t === 'write' ? (alreadySaved ? 'Today' : 'Write') : 'History'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {viewMode === 'write' ? (
            <>
              <View style={s.mementoStrip}>
                <Text style={s.mementoText}>
                  {isMorning
                    ? '"This day will not come again. What will you make of the hours you are given?"'
                    : '"Did you live well today? Not perfectly — but with intention?"'}
                </Text>
                <Text style={s.mementoSub}>
                  {isMorning ? 'Memento mori · Carpe diem' : 'The day closes · Examine thyself'}
                </Text>
              </View>

              <View style={s.body}>
                {isMorning && (
                  <View style={s.virtueSection}>
                    <Text style={s.secLabel}>Today's virtue focus</Text>
                    <View style={s.virtuePills}>
                      {virtues.map(v => (
                        <TouchableOpacity
                          key={v.id}
                          style={[s.vpill, selectedVirtue === v.id && s.vpillActive]}
                          onPress={() => { setSelectedVirtue(v.id); setShowVirtueDetail(false); }}
                          activeOpacity={0.7}
                        >
                          <Text style={[s.vpillName, selectedVirtue === v.id && s.vpillNameActive]}>
                            {v.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    {selectedVirtueObj && (
                      <TouchableOpacity
                        style={s.virtueInfoCard}
                        onPress={() => setShowVirtueDetail(!showVirtueDetail)}
                        activeOpacity={0.8}
                      >
                        <View style={s.virtueInfoLeft}>
                          <Text style={s.virtueInfoName}>{selectedVirtueObj.name}</Text>
                          <Text style={s.virtueInfoLatin}>{virtueDetail?.latin}</Text>
                          <Text style={s.virtueInfoDesc}>{selectedVirtueObj.desc}</Text>
                        </View>
                        <Text style={s.virtueInfoChev}>{showVirtueDetail ? '∨' : '›'}</Text>
                      </TouchableOpacity>
                    )}
                    {showVirtueDetail && virtueDetail && (
                      <View style={s.virtueDetailCard}>
                        <Text style={s.virtueDetailText}>{virtueDetail.definition}</Text>
                        <View style={s.virtueDetailDivider} />
                        <Text style={s.virtueDetailQuestion}>"{virtueDetail.question}"</Text>
                      </View>
                    )}
                  </View>
                )}

                {prompts.map((prompt, idx) => (
                  <TouchableOpacity
                    key={idx}
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
                          placeholder="Write here — no judgment, only honesty..."
                          placeholderTextColor={colors.textDim}
                          value={answers[idx] || ''}
                          onChangeText={text => setAnswers(prev => ({ ...prev, [idx]: text }))}
                          scrollEnabled={false}
                        />
                      </View>
                    )}
                  </TouchableOpacity>
                ))}

                <View style={s.anchorCard}>
                  <Text style={s.anchorLabel}>{isMorning ? 'Morning anchor' : 'Evening anchor'}</Text>
                  <Text style={s.anchorText}>
                    {isMorning
                      ? '"You\'ll encounter rudeness, selfishness, ingratitude today. But you share a divine reason with them. They are kin. Respond not with anger — but with understanding."'
                      : '"Ask yourself at day\'s end: What was ill done? What done? What left undone? Starting from the first, proceed through all three."'}
                  </Text>
                  <Text style={s.anchorAuthor}>
                    {isMorning ? 'Marcus Aurelius · Meditations II.1' : 'Epictetus · Discourses III.10'}
                  </Text>
                </View>

                <TouchableOpacity style={s.saveBtn} onPress={handleSave} activeOpacity={0.8}>
                  <Text style={s.saveBtnText}>
                    {alreadySaved ? 'Update journal' : `Complete ${isMorning ? 'morning' : 'evening'} journal`}
                  </Text>
                  <Text style={s.saveBtnSub}>{answeredCount} of {prompts.length} prompts answered</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <View style={s.body}>
              {history.length === 0 ? (
                <View style={s.empty}>
                  <Text style={s.emptyText}>No entries yet.{'\n'}Your reflections will appear here.</Text>
                </View>
              ) : (
                history.map(entry => (
                  <View key={entry.id}>
                    {editingEntry?.id === entry.id ? (
                      <JournalEntryEditor
                        entry={editingEntry}
                        onSave={handleEditSave}
                        onCancel={() => setEditingEntry(null)}
                      />
                    ) : (
                      <View style={s.histEntry}>
                        <View style={s.histEntryHeader}>
                          <View>
                            <Text style={s.histEntryDate}>
                              {new Date(entry.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                            </Text>
                            {entry.virtue && (
                              <Text style={s.histEntryVirtue}>{entry.virtue}</Text>
                            )}
                          </View>
                          <TouchableOpacity
                            style={s.editBtn}
                            onPress={() => setEditingEntry(entry)}
                            activeOpacity={0.7}
                          >
                            <Text style={s.editBtnText}>Edit</Text>
                          </TouchableOpacity>
                        </View>
                        {Object.entries(entry.answers || {}).map(([idx, answer]) => {
                          if (!answer || !answer.trim()) return null;
                          const prompt = prompts[parseInt(idx)];
                          return (
                            <View key={idx} style={s.histAnswerBlock}>
                              {prompt && <Text style={s.histPromptNum}>{prompt.num}</Text>}
                              <Text style={s.histAnswer}>{answer}</Text>
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </View>
                ))
              )}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const e = StyleSheet.create({
  container: { borderWidth: 0.5, borderColor: colors.accentDim, borderRadius: radius.lg, overflow: 'hidden', marginBottom: 12 },
  header: { backgroundColor: colors.accentBg, padding: 16, borderBottomWidth: 0.5, borderBottomColor: colors.accentDim, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 14, fontWeight: '600', color: colors.accent, textTransform: 'uppercase', letterSpacing: 0.8 },
  headerDate: { fontSize: 13, color: colors.accentDim },
  virtueSection: { padding: 14, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  sectionLabel: { fontSize: font.microSize, letterSpacing: 2, color: colors.textDim, textTransform: 'uppercase', marginBottom: 10 },
  virtuePills: { flexDirection: 'row', gap: 6 },
  vpill: { flex: 1, borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.sm, paddingVertical: 10, alignItems: 'center' },
  vpillActive: { borderColor: colors.accent, backgroundColor: colors.accentBg },
  vpillName: { fontSize: 11, fontWeight: '500', color: colors.textDim },
  vpillNameActive: { color: colors.accent },
  promptCard: { borderBottomWidth: 0.5, borderBottomColor: colors.border, padding: 14, backgroundColor: colors.bgCard },
  promptCardOpen: { backgroundColor: colors.bgElevated },
  promptNum: { fontSize: 9, letterSpacing: 2, color: colors.accent, textTransform: 'uppercase', marginBottom: 6 },
  promptQ: { fontSize: 14, color: colors.textSecondary, lineHeight: 22, fontFamily: font.serif },
  promptAnswer: { marginTop: 12, borderTopWidth: 0.5, borderTopColor: colors.border, paddingTop: 12 },
  promptInput: { fontSize: 15, color: colors.textPrimary, lineHeight: 24, minHeight: 80, textAlignVertical: 'top' },
  btnRow: { flexDirection: 'row', gap: 10, padding: 14, backgroundColor: colors.bgDeep },
  cancelBtn: { flex: 1, borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.md, padding: 14, alignItems: 'center' },
  cancelBtnText: { fontSize: 13, color: colors.textDim, letterSpacing: 0.8, textTransform: 'uppercase' },
  saveBtn: { flex: 2, borderWidth: 0.5, borderColor: colors.accentDim, borderRadius: radius.md, padding: 14, alignItems: 'center', backgroundColor: colors.accentBg },
  saveBtnText: { fontSize: 13, fontWeight: '600', color: colors.accent, letterSpacing: 0.8, textTransform: 'uppercase' },
});

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  header: {
    backgroundColor: colors.bgDeep,
    padding: spacing.xl,
    paddingTop: spacing.lg,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 18 },
  backArrow: { fontSize: 24, color: colors.textMuted },
  backLabel: { fontSize: 13, color: colors.textMuted, letterSpacing: 0.8, textTransform: 'uppercase' },
  eyebrow: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.accent, textTransform: 'uppercase', marginBottom: 8 },
  title: { fontSize: font.titleSize, fontWeight: '600', color: colors.textPrimary, letterSpacing: -0.5, lineHeight: 36 },
  sub: { fontSize: font.subSize, color: colors.textMuted, marginTop: 8, fontFamily: font.serif },
  tabRow: { flexDirection: 'row', gap: 10, padding: spacing.md, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  tabBtn: { flex: 1, borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.md, padding: 14, alignItems: 'center' },
  tabBtnActive: { backgroundColor: colors.bgElevated, borderColor: colors.borderStrong },
  tabBtnText: { fontSize: 13, color: colors.textDim, letterSpacing: 0.8, textTransform: 'uppercase' },
  tabBtnTextActive: { color: colors.textSecondary },
  mementoStrip: {
    backgroundColor: colors.bgDeep,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
    padding: spacing.xl,
    paddingVertical: 20,
  },
  mementoText: { fontSize: 16, color: colors.textSecondary, lineHeight: 26, fontFamily: font.serif },
  mementoSub: { fontSize: 11, color: colors.textDim, marginTop: 8, letterSpacing: 1.5, textTransform: 'uppercase' },
  body: { padding: spacing.md },
  secLabel: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.textDim, textTransform: 'uppercase', marginBottom: 12, marginTop: 8 },
  virtueSection: { marginBottom: 8 },
  virtuePills: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  vpill: { flex: 1, borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center' },
  vpillActive: { borderColor: colors.accent, backgroundColor: colors.accentBg },
  vpillName: { fontSize: 12, fontWeight: '500', color: colors.textDim },
  vpillNameActive: { color: colors.accent },
  virtueInfoCard: {
    borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.lg,
    padding: 18, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.bgCard,
  },
  virtueInfoLeft: { flex: 1 },
  virtueInfoName: { fontSize: 20, fontWeight: '600', color: colors.textPrimary, marginBottom: 2 },
  virtueInfoLatin: { fontSize: 12, color: colors.accent, fontStyle: 'italic', marginBottom: 6 },
  virtueInfoDesc: { fontSize: 14, color: colors.textSecondary, lineHeight: 21 },
  virtueInfoChev: { fontSize: 20, color: colors.textDim },
  virtueDetailCard: {
    borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.lg,
    padding: 18, marginBottom: 8, backgroundColor: colors.bgDeep,
  },
  virtueDetailText: { fontSize: 15, color: colors.textSecondary, lineHeight: 24, fontFamily: font.serif },
  virtueDetailDivider: { height: 0.5, backgroundColor: colors.border, marginVertical: 14 },
  virtueDetailQuestion: { fontSize: 14, color: colors.textMuted, fontFamily: font.serif, lineHeight: 22 },
  promptCard: { borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.lg, padding: 20, marginBottom: 12, backgroundColor: colors.bgCard },
  promptCardOpen: { backgroundColor: colors.bgElevated, borderColor: colors.borderMid },
  promptNum: { fontSize: font.microSize, letterSpacing: 2, color: colors.accent, textTransform: 'uppercase', marginBottom: 8 },
  promptQ: { fontSize: font.bodySize, color: colors.textSecondary, lineHeight: 26, fontFamily: font.serif },
  promptAnswer: { marginTop: 16, borderTopWidth: 0.5, borderTopColor: colors.border, paddingTop: 16 },
  promptInput: { fontSize: 16, color: colors.textPrimary, lineHeight: 26, minHeight: 120, textAlignVertical: 'top' },
  anchorCard: {
    borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.lg,
    padding: 20, marginBottom: 12, backgroundColor: colors.bgDeep,
  },
  anchorLabel: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.textDim, textTransform: 'uppercase', marginBottom: 10 },
  anchorText: { fontSize: 15, color: colors.textSecondary, fontStyle: 'italic', fontFamily: font.serif, lineHeight: 24 },
  anchorAuthor: { fontSize: 11, color: colors.textDim, marginTop: 10, letterSpacing: 1.2, textTransform: 'uppercase' },
  saveBtn: {
    borderWidth: 0.5, borderColor: colors.borderStrong, borderRadius: radius.md,
    padding: 18, alignItems: 'center', backgroundColor: colors.bgCard, marginBottom: 36,
  },
  saveBtnText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, letterSpacing: 1, textTransform: 'uppercase' },
  saveBtnSub: { fontSize: 12, color: colors.textDim, marginTop: 5 },
  empty: { padding: 60, alignItems: 'center' },
  emptyText: { fontSize: 16, color: colors.textDim, textAlign: 'center', lineHeight: 26 },
  histEntry: { borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.lg, marginBottom: 12, overflow: 'hidden' },
  histEntryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: colors.bgDeep, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  histEntryDate: { fontSize: 15, fontWeight: '600', color: colors.textSecondary, marginBottom: 3 },
  histEntryVirtue: { fontSize: 12, color: colors.accent, textTransform: 'capitalize', letterSpacing: 0.5 },
  editBtn: { borderWidth: 0.5, borderColor: colors.border, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6 },
  editBtnText: { fontSize: 12, color: colors.textMuted, letterSpacing: 0.5 },
  histAnswerBlock: { padding: 14, borderBottomWidth: 0.5, borderBottomColor: colors.border, backgroundColor: colors.bgCard },
  histPromptNum: { fontSize: 9, letterSpacing: 2, color: colors.accent, textTransform: 'uppercase', marginBottom: 5 },
  histAnswer: { fontSize: 15, color: colors.textSecondary, lineHeight: 24, fontFamily: font.serif },
});