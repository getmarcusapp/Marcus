import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TextInput,
  TouchableOpacity, StyleSheet, SafeAreaView, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { colors, radius, spacing, font } from '../constants/theme';
import { emotions, stoicReframes } from '../constants/virtues';
import { saveTrigger, getTriggers, updateTriggerEntry } from '../store/db';

const EMOTION_COLORS = {
  anger:       { bg: '#FDF0EF', border: '#E8A09A', text: '#C0504A' },
  anxiety:     { bg: '#EFF4FD', border: '#9AB4E8', text: '#4A6EC0' },
  frustration: { bg: '#FDF8EF', border: '#E8C87A', text: '#A07830' },
  shame:       { bg: '#F5EFFd', border: '#C09AE8', text: '#7050B0' },
  avoidance:   { bg: '#EFF8F5', border: '#7AC8B4', text: '#307870' },
  envy:        { bg: '#EFF8EF', border: '#80C880', text: '#307030' },
  grief:       { bg: '#F0F0F8', border: '#A0A0D0', text: '#505090' },
  fear:        { bg: '#FDF2EF', border: '#E8B09A', text: '#B06040' },
  other:       { bg: '#F5F5F5', border: '#C0C0C0', text: '#707070' },
};

const DISTORTIONS = [
  { id: 'catastrophizing', label: 'Catastrophizing', q: 'Am I imagining the worst possible outcome?' },
  { id: 'mind_reading', label: 'Mind-reading', q: 'Am I assuming I know what others think or feel?' },
  { id: 'overgeneralizing', label: 'Overgeneralizing', q: 'Am I treating one event as a permanent pattern?' },
  { id: 'personalizing', label: 'Personalizing', q: 'Am I taking responsibility for things outside my control?' },
  { id: 'filtering', label: 'Filtering', q: 'Am I ignoring the good and fixating on the bad?' },
  { id: 'emotional_reasoning', label: 'Emotional reasoning', q: 'Am I treating a feeling as proof that something is true?' },
  { id: 'should_statements', label: 'Should statements', q: 'Am I imposing rigid rules on myself or others?' },
];

// Situation-agnostic reframes
const stoicReframesUpdated = {
  anger: "Is this worth your peace? What happened is not in your control. Your response is. What does the situation actually require of you?",
  anxiety: "Separate what is in your control from what is not. Attend only to the former. The rest is not yours to carry.",
  frustration: "You were not wronged — you were inconvenienced. The Stoic does not react to inconvenience. What is the wise response here?",
  shame: "Examine whether the shame is warranted. If you acted wrongly, own it and correct course. If not, release it — the judgment of others is not yours to control.",
  avoidance: "You are delaying because you fear an outcome. Name the fear. Then ask: is it as bad as the cost of continued avoidance?",
  envy: "You are measuring your inner life against another's outer life. You do not know their interior. Tend your own.",
  grief: "Grief is love with nowhere to go. Honor it. The Stoic does not suppress feeling — only the slavery to feeling.",
  fear: "Fear imagines futures that have not arrived. Return to what is actually in front of you, in this moment. What does now require?",
  other: "Pause. Name what you are actually feeling beneath the surface. Then ask: what would a person of virtue do here?",
};

function IntensitySlider({ value, onChange }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 }}>
      <TouchableOpacity
        onPress={() => onChange(Math.max(1, value - 1))}
        style={{ width: 44, height: 44, borderWidth: 0.5, borderColor: colors.borderMid, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bgElevated }}
      >
        <Text style={{ fontSize: 24, color: colors.textSecondary }}>−</Text>
      </TouchableOpacity>
      <View style={{ flex: 1, height: 4, backgroundColor: colors.border, borderRadius: 2, overflow: 'hidden' }}>
        <View style={{ width: `${(value / 10) * 100}%`, height: '100%', backgroundColor: colors.textSecondary, borderRadius: 2 }} />
      </View>
      <TouchableOpacity
        onPress={() => onChange(Math.min(10, value + 1))}
        style={{ width: 44, height: 44, borderWidth: 0.5, borderColor: colors.borderMid, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bgElevated }}
      >
        <Text style={{ fontSize: 24, color: colors.textSecondary }}>+</Text>
      </TouchableOpacity>
      <Text style={{ fontSize: 18, fontWeight: '700', color: colors.textPrimary, minWidth: 48, textAlign: 'right' }}>{value}/10</Text>
    </View>
  );
}

export default function EmotionsScreen() {
  const [tab, setTab] = useState('log');
  const [timing, setTiming] = useState('past'); // 'now' or 'past'
  const [selectedEmotion, setSelectedEmotion] = useState(null);
  const [intensity, setIntensity] = useState(5);
  const [trigger, setTrigger] = useState('');
  const [reaction, setReaction] = useState('');
  const [chosenResponse, setChosenResponse] = useState('');
  const [selectedDistortions, setSelectedDistortions] = useState([]);
  const [history, setHistory] = useState([]);
  const [editingEntry, setEditingEntry] = useState(null);

  useEffect(() => { getTriggers().then(setHistory); }, []);

  function toggleDistortion(id) {
    setSelectedDistortions(prev =>
      prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]
    );
  }

  async function handleLog() {
    if (!selectedEmotion || !trigger.trim()) {
      Alert.alert('', 'Select an emotion and describe the trigger.');
      return;
    }
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
    const updated = await getTriggers();
    setHistory(updated);
    setSelectedEmotion(null);
    setTrigger('');
    setReaction('');
    setChosenResponse('');
    setSelectedDistortions([]);
    setIntensity(5);
    setTiming('past');
    Alert.alert('', 'Trigger logged.', [{ text: 'Done' }]);
    setTab('history');
  }

  async function handleEditSave(updated) {
  const ok = await updateTriggerEntry(updated);
  if (ok) {
    const updated2 = await getTriggers();
    setHistory(updated2);
    setEditingEntry(null);
    Alert.alert('', 'Entry updated.');
  }
}

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.bg }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentInset={{ bottom: 40 }}
          scrollIndicatorInsets={{ bottom: 40 }}
          style={s.scroll}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
        >

          <View style={s.hero}>
            <Text style={s.eyebrow}>Emotional mastery</Text>
            <Text style={s.title}>{tab === 'log' ? 'Log a trigger' : 'Your history'}</Text>
            <Text style={s.sub}>
              {tab === 'log'
                ? 'Between stimulus and response\nthere is a space. This is that space.'
                : 'Patterns reveal what single moments cannot'}
            </Text>
          </View>

          <View style={s.tabRow}>
            {['log', 'history'].map(t => (
              <TouchableOpacity
                key={t}
                style={[s.tabBtn, tab === t && s.tabBtnActive]}
                onPress={() => setTab(t)}
              >
                <Text style={[s.tabBtnText, tab === t && s.tabBtnTextActive]}>
                  {t === 'log' ? 'Log trigger' : 'History'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {tab === 'log' ? (
            <View style={s.body}>

              {/* Timing toggle */}
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

              <Text style={s.secLabel}>What are you feeling?</Text>
              <View style={s.emotionGrid}>
                {emotions.map(e => {
                  const ec = EMOTION_COLORS[e.id];
                  const isSelected = selectedEmotion === e.id;
                  return (
                    <TouchableOpacity
                      key={e.id}
                      style={[s.ePill, isSelected && { backgroundColor: ec.bg, borderColor: ec.border, borderWidth: 1 }]}
                      onPress={() => setSelectedEmotion(e.id)}
                      activeOpacity={0.7}
                    >
                      <View style={[s.eDot, isSelected && { backgroundColor: ec.text }]} />
                      <Text style={[s.ePillName, isSelected && { color: ec.text, fontWeight: '600' }]}>
                        {e.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={s.fieldCard}>
                <Text style={s.fieldLabel}>Intensity</Text>
                <IntensitySlider value={intensity} onChange={setIntensity} />
              </View>

              <View style={s.fieldCard}>
                <Text style={s.fieldLabel}>What triggered it?</Text>
                <TextInput
                  style={s.fieldInput}
                  multiline
                  placeholder="Describe the situation..."
                  placeholderTextColor={colors.textDim}
                  value={trigger}
                  onChangeText={setTrigger}
                  scrollEnabled={false}
                />
              </View>

              <View style={s.fieldCard}>
                <Text style={s.fieldLabel}>My automatic reaction</Text>
                <TextInput
                  style={s.fieldInput}
                  multiline
                  placeholder="What did you want to do or say?"
                  placeholderTextColor={colors.textDim}
                  value={reaction}
                  onChangeText={setReaction}
                  scrollEnabled={false}
                />
              </View>

              {selectedEmotion && (
                <View style={[s.reframeCard, { borderColor: EMOTION_COLORS[selectedEmotion].border }]}>
                  <Text style={[s.reframeEyebrow, { color: EMOTION_COLORS[selectedEmotion].text }]}>
                    The Stoic reframe
                  </Text>
                  <Text style={s.reframeText}>{stoicReframesUpdated[selectedEmotion]}</Text>

                  <View style={s.reframeDivider} />

                  <Text style={s.fieldLabel}>What story are you telling yourself?</Text>
                  <Text style={s.distortionSub}>Select any patterns you notice in your thinking</Text>
                  <View style={s.distortionGrid}>
                    {DISTORTIONS.map(d => {
                      const isSelected = selectedDistortions.includes(d.id);
                      const ec = EMOTION_COLORS[selectedEmotion];
                      return (
                        <TouchableOpacity
                          key={d.id}
                          style={[
                            s.distortionPill,
                            isSelected && { borderColor: ec.border, backgroundColor: ec.bg },
                          ]}
                          onPress={() => toggleDistortion(d.id)}
                          activeOpacity={0.7}
                        >
                          <Text style={[s.distortionLabel, isSelected && { color: ec.text }]}>
                            {d.label}
                          </Text>
                          <Text style={[s.distortionQ, isSelected && { color: ec.text }]}>
                            {d.q}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <View style={s.reframeDivider} />

                  <Text style={s.fieldLabel}>
                    {timing === 'now' ? 'How will I respond?' : 'How should I have responded?'}
                  </Text>
                  <TextInput
                    style={s.fieldInput}
                    multiline
                    placeholder={timing === 'now'
                      ? "What is your chosen response going forward?"
                      : "Looking back — what would the Stoic have done?"}
                    placeholderTextColor={colors.textDim}
                    value={chosenResponse}
                    onChangeText={setChosenResponse}
                    scrollEnabled={false}
                  />
                </View>
              )}

              <TouchableOpacity style={s.saveBtn} onPress={handleLog} activeOpacity={0.8}>
                <Text style={s.saveBtnText}>Log this trigger</Text>
                <Text style={s.saveBtnSub}>Saved privately · used in weekly review</Text>
              </TouchableOpacity>

            </View>
          ) : (
            <View>
              {history.length === 0 ? (
                <View style={s.empty}>
                  <Text style={s.emptyIcon}>⚡</Text>
                  <Text style={s.emptyTitle}>No triggers logged yet</Text>
                  <Text style={s.emptyText}>
                    {'When a strong emotion arises — anger, anxiety, frustration, shame — open this logger before you react.\n\nName the emotion, rate the intensity, describe what triggered it, and note your automatic reaction. Then read the Stoic reframe and choose your response.\n\nThe space between stimulus and response is where the practice lives.'}
                  </Text>
                </View>
              ) : (
                history.map(entry => {
  const ec = EMOTION_COLORS[entry.emotion] || EMOTION_COLORS.other;

  if (editingEntry?.id === entry.id) {
    return (
      <View key={entry.id} style={[s.editCard, { borderColor: ec.border }]}>
        <View style={[s.editCardHeader, { backgroundColor: ec.bg }]}>
          <Text style={[s.editCardTitle, { color: ec.text }]}>Editing · {entry.emotion}</Text>
          <Text style={s.editCardDate}>{new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>
        </View>
        <View style={s.editCardBody}>
          <Text style={s.editFieldLabel}>What triggered it?</Text>
          <TextInput
            style={s.editFieldInput}
            multiline
            value={editingEntry.trigger}
            onChangeText={text => setEditingEntry(prev => ({ ...prev, trigger: text }))}
            placeholderTextColor={colors.textDim}
            scrollEnabled={false}
          />
          <View style={s.editDivider} />
          <Text style={s.editFieldLabel}>My automatic reaction</Text>
          <TextInput
            style={s.editFieldInput}
            multiline
            value={editingEntry.reaction || ''}
            onChangeText={text => setEditingEntry(prev => ({ ...prev, reaction: text }))}
            placeholderTextColor={colors.textDim}
            scrollEnabled={false}
          />
          <View style={s.editDivider} />
          <Text style={s.editFieldLabel}>
            {editingEntry.timing === 'now' ? 'How will I respond?' : 'How should I have responded?'}
          </Text>
          <TextInput
            style={s.editFieldInput}
            multiline
            value={editingEntry.chosenResponse || ''}
            onChangeText={text => setEditingEntry(prev => ({ ...prev, chosenResponse: text }))}
            placeholderTextColor={colors.textDim}
            scrollEnabled={false}
          />
          <View style={s.editDivider} />
          <Text style={s.editFieldLabel}>Cognitive distortions</Text>
          <Text style={[s.editFieldLabel, { fontSize: 12, color: colors.textDim, fontWeight: '400', marginTop: -8, marginBottom: 12 }]}>Tap to add or remove</Text>
          <View style={s.distortionGrid}>
            {DISTORTIONS.map(d => {
              const isSelected = (editingEntry.distortions || []).includes(d.id);
              return (
                <TouchableOpacity
                  key={d.id}
                  style={[s.distortionPill, isSelected && { backgroundColor: ec.bg, borderColor: ec.border }]}
                  onPress={() => {
                    const current = editingEntry.distortions || [];
                    const updated = isSelected
                      ? current.filter(x => x !== d.id)
                      : [...current, d.id];
                    setEditingEntry(prev => ({ ...prev, distortions: updated }));
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[s.distortionLabel, isSelected && { color: ec.text }]}>{d.label}</Text>
                  <Text style={[s.distortionQ, isSelected && { color: ec.text }]}>{d.q}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
        <View style={s.editBtnRow}>
          <TouchableOpacity style={s.editCancelBtn} onPress={() => setEditingEntry(null)} activeOpacity={0.7}>
            <Text style={s.editCancelBtnText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.editSaveBtn, { borderColor: ec.border, backgroundColor: ec.bg }]} onPress={() => handleEditSave(editingEntry)} activeOpacity={0.8}>
            <Text style={[s.editSaveBtnText, { color: ec.text }]}>Save changes</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View key={entry.id} style={s.histRow}>
      <View style={s.histTop}>
        <View style={[s.histBadge, { backgroundColor: ec.bg, borderColor: ec.border }]}>
          <Text style={[s.histEmotion, { color: ec.text }]}>{entry.emotion}</Text>
        </View>
        <View style={s.histTopRight}>
          {entry.timing && (
            <Text style={s.histTiming}>{entry.timing === 'now' ? 'In the moment' : 'After the fact'}</Text>
          )}
          <Text style={s.histDate}>
            {new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </Text>
        </View>
      </View>
      <Text style={s.histIntensity}>Intensity {entry.intensity}/10</Text>
      {entry.distortions && entry.distortions.length > 0 && (
        <View style={s.histDistortions}>
          {entry.distortions.map(d => (
            <View key={d} style={[s.histDistortionTag, { borderColor: ec.border, backgroundColor: ec.bg }]}>
              <Text style={[s.histDistortionText, { color: ec.text }]}>{d.replace('_', ' ')}</Text>
            </View>
          ))}
        </View>
      )}
      <Text style={s.histTrigger}>{entry.trigger}</Text>
      {entry.chosenResponse ? (
        <Text style={s.histResponse}>"{entry.chosenResponse}"</Text>
      ) : null}
      <TouchableOpacity style={s.histEditBtn} onPress={() => setEditingEntry({ ...entry })} activeOpacity={0.7}>
        <Text style={s.histEditBtnText}>Edit entry</Text>
      </TouchableOpacity>
    </View>
  );
})
              )}
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  // Dark header
  hero: {
    backgroundColor: colors.bgDeep,
    padding: spacing.xl,
    paddingTop: 36,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  eyebrow: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.accent, textTransform: 'uppercase', marginBottom: 8 },
  title: { fontSize: font.titleSize, fontWeight: '300', color: colors.textPrimary, letterSpacing: -0.5, marginBottom: 6 },
  sub: { fontSize: font.subSize, color: colors.textMuted, lineHeight: 22 },
  tabRow: { flexDirection: 'row', gap: 10, padding: spacing.md, borderBottomWidth: 0.5, borderBottomColor: colors.border, backgroundColor: colors.bgDeep },
  tabBtn: { flex: 1, borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.md, padding: 14, alignItems: 'center' },
  tabBtnActive: { backgroundColor: colors.bgElevated, borderColor: colors.borderStrong },
  tabBtnText: { fontSize: 13, color: colors.textDim, letterSpacing: 0.8, textTransform: 'uppercase' },
  tabBtnTextActive: { color: colors.textSecondary },
  // Light body
  body: { padding: spacing.md, backgroundColor: colors.bgCard },
  secLabel: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.textDim, textTransform: 'uppercase', marginTop: 8, marginBottom: 12 },
  timingRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  timingBtn: { flex: 1, borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.lg, padding: 16, backgroundColor: colors.bgElevated },
  timingBtnActive: { borderColor: colors.textSecondary, backgroundColor: colors.bgElevated },
  timingBtnText: { fontSize: 14, fontWeight: '400', color: colors.textMuted, marginBottom: 4 },
  timingBtnTextActive: { color: colors.textPrimary, fontWeight: '500' },
  timingBtnSub: { fontSize: 12, color: colors.textDim, lineHeight: 18 },
  timingBtnSubActive: { color: colors.textSecondary },
  emotionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginBottom: 16 },
  ePill: { width: '31%', borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.md, paddingVertical: 16, alignItems: 'center', backgroundColor: colors.bgElevated },
  eDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors.textDim, marginBottom: 8 },
  ePillName: { fontSize: 13, color: colors.textMuted, fontWeight: '400' },
  fieldCard: { borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.lg, padding: 18, marginBottom: 12, backgroundColor: colors.bgElevated },
  fieldLabel: { fontSize: font.microSize, letterSpacing: 2, color: colors.textMuted, textTransform: 'uppercase', marginBottom: 12 },
  fieldInput: { fontSize: 16, color: colors.textPrimary, lineHeight: 25, minHeight: 64, textAlignVertical: 'top', paddingBottom: 16 },
  reframeCard: { borderWidth: 0.5, borderRadius: radius.lg, padding: 20, marginBottom: 12, backgroundColor: colors.bgCard },
  reframeEyebrow: { fontSize: font.microSize, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12, fontWeight: '600' },
  reframeText: { fontSize: 16, color: colors.textSecondary, fontFamily: font.serif, lineHeight: 26, marginBottom: 16 },
  reframeDivider: { height: 0.5, backgroundColor: colors.border, marginBottom: 16 },
  distortionSub: { fontSize: 13, color: colors.textMuted, marginBottom: 14 },
  distortionGrid: { gap: 10, marginBottom: 16 },
  distortionPill: { borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.md, padding: 14, backgroundColor: colors.bgElevated },
  distortionLabel: { fontSize: 15, fontWeight: '500', color: colors.textPrimary, marginBottom: 4 },
  distortionQ: { fontSize: 13, color: colors.textMuted, lineHeight: 20 },
  saveBtn: { borderWidth: 0.5, borderColor: colors.borderMid, borderRadius: radius.md, padding: 18, alignItems: 'center', backgroundColor: colors.bgElevated, marginBottom: 36 },
  saveBtnText: { fontSize: 13, fontWeight: '500', color: colors.textPrimary, letterSpacing: 1, textTransform: 'uppercase' },
  saveBtnSub: { fontSize: 12, color: colors.textMuted, marginTop: 5 },
  // History — light
  histRow: { padding: 18, borderBottomWidth: 0.5, borderBottomColor: colors.border, backgroundColor: colors.bgCard },
  histTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  histTopRight: { alignItems: 'flex-end', gap: 3 },
  histBadge: { borderWidth: 0.5, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  histEmotion: { fontSize: 13, fontWeight: '600', textTransform: 'capitalize' },
  histTiming: { fontSize: 10, color: colors.textDim, letterSpacing: 0.5 },
  histDate: { fontSize: 12, color: colors.textDim },
  histIntensity: { fontSize: 12, color: colors.textMuted, marginBottom: 6 },
  histDistortions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  histDistortionTag: { borderWidth: 0.5, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3 },
  histDistortionText: { fontSize: 11, textTransform: 'capitalize', letterSpacing: 0.3, fontWeight: '500' },
  histTrigger: { fontSize: 15, color: colors.textSecondary, lineHeight: 23 },
  histResponse: { fontSize: 14, color: colors.textMuted, marginTop: 8, lineHeight: 22 },
  empty: { padding: 40, alignItems: 'center', backgroundColor: colors.bgCard },
  emptyIcon: { fontSize: 32, marginBottom: 16, opacity: 0.4 },
  emptyTitle: { fontSize: 17, fontWeight: '500', color: colors.textSecondary, marginBottom: 12, textAlign: 'center' },
  emptyText: { fontSize: 14, color: colors.textDim, textAlign: 'center', lineHeight: 22 },
  editCard: { borderWidth: 1, borderRadius: radius.lg, marginBottom: 12, overflow: 'hidden' },
  editCardHeader: { padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  editCardTitle: { fontSize: 13, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase' },
  editCardDate: { fontSize: 12, color: colors.textDim },
  editCardBody: { padding: 16, backgroundColor: colors.bgElevated },
  editFieldLabel: { fontSize: font.microSize, letterSpacing: 2, color: colors.textDim, textTransform: 'uppercase', marginBottom: 10 },
  editFieldInput: { fontSize: 15, color: colors.textPrimary, lineHeight: 24, minHeight: 48, textAlignVertical: 'top', paddingBottom: 16, marginBottom: 4 },
  editDivider: { height: 0.5, backgroundColor: colors.border, marginVertical: 14 },
  editBtnRow: { flexDirection: 'row', gap: 10, padding: 14, backgroundColor: colors.bgCard },
  editCancelBtn: { flex: 1, borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.md, padding: 13, alignItems: 'center' },
  editCancelBtnText: { fontSize: 12, color: colors.textMuted, letterSpacing: 0.8, textTransform: 'uppercase' },
  editSaveBtn: { flex: 2, borderWidth: 1, borderRadius: radius.md, padding: 13, alignItems: 'center' },
  editSaveBtnText: { fontSize: 12, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase' },
  histEditBtn: { marginTop: 10, borderWidth: 0.5, borderColor: colors.border, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6, alignSelf: 'flex-start' },
  histEditBtnText: { fontSize: 12, color: colors.textDim, letterSpacing: 0.5 },
});