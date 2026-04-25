import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TextInput,
  TouchableOpacity, StyleSheet, SafeAreaView, Alert,
} from 'react-native';
import { colors, radius, spacing, font } from '../constants/theme';
import { virtues } from '../constants/virtues';
import { saveReview, getReviews, getJournals, getTriggers } from '../store/db';

const reviewPrompts = [
  { label: 'What went well?', sub: 'Where did you act with virtue this week?', key: 'wentWell' },
  { label: 'Where did I stray?', sub: 'Where did you fall short of your own standard?', key: 'strayed' },
  { label: 'Recurring challenges', sub: 'What patterns keep showing up? What is unresolved?', key: 'challenges' },
  { label: 'Body and discipline', sub: 'How did you treat your physical self — sleep, movement, food, restraint?', key: 'body' },
];

export default function ReviewScreen() {
  const [tab, setTab] = useState('current');
  const [answers, setAnswers] = useState({});
  const [bestVirtue, setBestVirtue] = useState(virtues[0].id);
  const [worstVirtue, setWorstVirtue] = useState(virtues[3].id);
  const [intention, setIntention] = useState('');
  const [openPrompt, setOpenPrompt] = useState(0);
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState({ journaled: 0, triggers: 0, reframed: 0 });

  useEffect(() => {
    async function load() {
      const reviews = await getReviews();
      setHistory(reviews);
      const journals = await getJournals();
      const triggers = await getTriggers();
      const weekAgo = Date.now() - 7 * 86400000;
      const weekJournals = journals.filter(j => new Date(j.date).getTime() > weekAgo);
      const weekTriggers = triggers.filter(t => new Date(t.date).getTime() > weekAgo);
      const reframed = weekTriggers.filter(t => t.chosenResponse && t.chosenResponse.trim().length > 0);
      setStats({ journaled: weekJournals.length, triggers: weekTriggers.length, reframed: reframed.length });
    }
    load();
  }, []);

  async function handleSave() {
    const entry = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      weekOf: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      answers, bestVirtue, worstVirtue, intention, stats,
    };
    await saveReview(entry);
    const updated = await getReviews();
    setHistory(updated);
    Alert.alert('', 'Week sealed.', [{ text: 'Done', onPress: () => setTab('history') }]);
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false} keyboardDismissMode="on-drag">

        <View style={s.hero}>
          <Text style={s.eyebrow}>Weekly review</Text>
          <Text style={s.title}>
            {tab === 'current'
              ? `Week of ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
              : 'Your archive'}
          </Text>
          <Text style={s.sub}>
            {tab === 'current' ? '15–30 min · Sunday reckoning' : 'The examined life, recorded'}
          </Text>
        </View>

        <View style={s.tabRow}>
          {['current', 'history'].map(t => (
            <TouchableOpacity
              key={t}
              style={[s.tabBtn, tab === t && s.tabBtnActive]}
              onPress={() => setTab(t)}
            >
              <Text style={[s.tabBtnText, tab === t && s.tabBtnTextActive]}>
                {t === 'current' ? 'This week' : 'Archive'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {tab === 'current' ? (
          <View style={s.body}>

            <View style={s.statRow}>
              <View style={s.stat}>
                <Text style={s.statNum}>{stats.journaled}</Text>
                <Text style={s.statLbl}>Days{'\n'}journaled</Text>
              </View>
              <View style={s.stat}>
                <Text style={[s.statNum, { color: colors.virtueGood }]}>{stats.reframed}</Text>
                <Text style={s.statLbl}>Triggers{'\n'}reframed</Text>
              </View>
              <View style={s.stat}>
                <Text style={[s.statNum, { color: colors.virtueBad }]}>{stats.triggers}</Text>
                <Text style={s.statLbl}>Total{'\n'}triggers</Text>
              </View>
            </View>

            {reviewPrompts.map((p, idx) => (
              <TouchableOpacity
                key={p.key}
                style={[s.promptBlock, openPrompt === idx && s.promptBlockOpen]}
                onPress={() => setOpenPrompt(openPrompt === idx ? -1 : idx)}
                activeOpacity={0.8}
              >
                <View style={s.pbHeader}>
  <View style={s.pbLabelWrap}>
    <Text style={s.pbLabel}>{p.label}</Text>
    <Text style={s.pbSub}>{p.sub}</Text>
  </View>
  <Text style={s.pbChev}>{openPrompt === idx ? '∨' : '›'}</Text>
</View>
                {openPrompt === idx && (
                  <View style={s.pbBody}>
                    <TextInput
                      style={s.pbInput}
                      multiline
                      placeholder="Write honestly..."
                      placeholderTextColor={colors.textDim}
                      value={answers[p.key] || ''}
                      onChangeText={text => setAnswers(prev => ({ ...prev, [p.key]: text }))}
                    />
                  </View>
                )}
              </TouchableOpacity>
            ))}

            <Text style={s.secLabel}>Virtue ledger</Text>
            <View style={s.virtueRow}>
              <View style={s.virtuePicker}>
                <Text style={s.vpLabel}>Most embodied</Text>
                {virtues.map(v => (
                  <TouchableOpacity
                    key={v.id}
                    style={[s.vpBtn, bestVirtue === v.id && s.vpBtnActive]}
                    onPress={() => setBestVirtue(v.id)}
                  >
                    <Text style={[s.vpBtnText, bestVirtue === v.id && { color: colors.virtueGood, fontWeight: '600' }]}>
                      {v.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={s.virtuePicker}>
                <Text style={s.vpLabel}>Least embodied</Text>
                {virtues.map(v => (
                  <TouchableOpacity
                    key={v.id}
                    style={[s.vpBtn, worstVirtue === v.id && s.vpBtnActive]}
                    onPress={() => setWorstVirtue(v.id)}
                  >
                    <Text style={[s.vpBtnText, worstVirtue === v.id && { color: colors.virtueBad, fontWeight: '600' }]}>
                      {v.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={s.intentionCard}>
              <Text style={s.secLabel}>Intention for next week</Text>
              <TextInput
                style={s.intentionInput}
                multiline
                placeholder="What one thing will you do differently? Write it as a commitment, not a wish..."
                placeholderTextColor={colors.textDim}
                value={intention}
                onChangeText={setIntention}
              />
            </View>

            <TouchableOpacity style={s.sealBtn} onPress={handleSave} activeOpacity={0.8}>
              <Text style={s.sealBtnText}>Seal this week</Text>
              <Text style={s.sealBtnSub}>Saved to your review archive</Text>
            </TouchableOpacity>

          </View>
        ) : (
          <View>
            {history.length === 0 ? (
              <View style={s.empty}>
                <Text style={s.emptyText}>No reviews yet.{'\n'}Complete your first week.</Text>
              </View>
            ) : (
              history.map(entry => (
                <View key={entry.id} style={s.histRow}>
                  <View style={s.histTop}>
                    <Text style={s.histDate}>Week of {entry.weekOf}</Text>
                    <Text style={s.histStreak}>{entry.stats?.journaled || 0}/7 days</Text>
                  </View>
                  {entry.bestVirtue && <Text style={s.histBest}>{entry.bestVirtue} · most embodied</Text>}
                  {entry.worstVirtue && <Text style={s.histWorst}>{entry.worstVirtue} · least embodied</Text>}
                  {entry.answers?.wentWell && (
                    <Text style={s.histPreview}>"{entry.answers.wentWell.slice(0, 140)}..."</Text>
                  )}
                </View>
              ))
            )}
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  hero: {
    backgroundColor: colors.bgDeep,
    padding: spacing.xl,
    paddingTop: 36,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  eyebrow: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.accent, textTransform: 'uppercase', marginBottom: 8 },
  title: { fontSize: font.titleSize, fontWeight: '300', color: colors.textPrimary, letterSpacing: -0.5, marginBottom: 8 },
  sub: { fontSize: font.subSize, color: colors.textMuted },
  tabRow: { flexDirection: 'row', gap: 10, padding: spacing.md, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  tabBtn: { flex: 1, borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.md, padding: 14, alignItems: 'center' },
  tabBtnActive: { backgroundColor: colors.bgElevated, borderColor: colors.borderStrong },
  tabBtnText: { fontSize: 13, color: colors.textDim, letterSpacing: 0.8, textTransform: 'uppercase' },
  tabBtnTextActive: { color: colors.textSecondary },
  body: { padding: spacing.md },
  statRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  stat: { flex: 1, backgroundColor: colors.bgCard, borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.md, padding: 16, alignItems: 'center' },
  statNum: { fontSize: 30, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 },
  statLbl: { fontSize: 10, color: colors.textDim, letterSpacing: 1, textTransform: 'uppercase', textAlign: 'center', lineHeight: 16 },
  promptBlock: { borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.lg, marginBottom: 12, overflow: 'hidden' },
  promptBlockOpen: { backgroundColor: colors.bgCard, borderColor: colors.borderMid },
  pbHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 18, backgroundColor: colors.bgDeep },
  pbLabelWrap: { flex: 1 },
  pbLabel: { fontSize: 14, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8 },
  pbSub: { fontSize: 13, color: colors.textDim, marginTop: 3, fontStyle: 'italic' },
  pbChev: { fontSize: 20, color: colors.textDim },
  pbBody: { padding: 18, borderTopWidth: 0.5, borderTopColor: colors.border },
  pbInput: { fontSize: 16, color: colors.textPrimary, lineHeight: 26, minHeight: 80, textAlignVertical: 'top', fontStyle: 'italic', fontFamily: font.serif },
  secLabel: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.textDim, textTransform: 'uppercase', marginBottom: 12, marginTop: 4 },
  virtueRow: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  virtuePicker: { flex: 1, borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.lg, overflow: 'hidden' },
  vpLabel: { fontSize: 10, letterSpacing: 1.5, color: colors.textDim, textTransform: 'uppercase', padding: 12, paddingHorizontal: 14, backgroundColor: colors.bgDeep, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  vpBtn: { padding: 13, paddingHorizontal: 14, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  vpBtnActive: { backgroundColor: colors.bgElevated },
  vpBtnText: { fontSize: 15, color: colors.textDim },
  intentionCard: { borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.lg, padding: 18, marginBottom: 14, backgroundColor: colors.bgCard },
  intentionInput: { fontSize: 16, color: colors.textPrimary, lineHeight: 26, minHeight: 90, textAlignVertical: 'top' },
  sealBtn: { borderWidth: 0.5, borderColor: colors.borderStrong, borderRadius: radius.md, padding: 18, alignItems: 'center', backgroundColor: colors.bgCard, marginBottom: 36 },
  sealBtnText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, letterSpacing: 1, textTransform: 'uppercase' },
  sealBtnSub: { fontSize: 12, color: colors.textDim, marginTop: 5 },
  histRow: { padding: 18, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  histTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  histDate: { fontSize: 17, fontWeight: '600', color: colors.textSecondary },
  histStreak: { fontSize: 13, color: colors.textDim },
  histBest: { fontSize: 14, color: colors.virtueGood, marginBottom: 4 },
  histWorst: { fontSize: 14, color: colors.virtueBad, marginBottom: 4 },
  histPreview: { fontSize: 14, color: colors.textDim, lineHeight: 22, fontStyle: 'italic', fontFamily: font.serif, marginTop: 6 },
  empty: { padding: 60, alignItems: 'center' },
  emptyText: { fontSize: 16, color: colors.textDim, fontStyle: 'italic', textAlign: 'center', lineHeight: 26 },
});