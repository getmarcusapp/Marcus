import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TextInput,
  TouchableOpacity, StyleSheet, SafeAreaView, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { colors, radius, spacing, font } from '../constants/theme';
import { virtues } from '../constants/virtues';
import { saveReview, getReviews, getJournals, getTriggers } from '../store/db';

const EMOTION_LABELS = {
  anger: 'Anger', anxiety: 'Anxiety', frustration: 'Frustration',
  shame: 'Shame', avoidance: 'Avoidance', envy: 'Envy',
  grief: 'Grief', fear: 'Fear', other: 'Other',
};
const DISTORTION_LABELS = {
  catastrophizing: 'Catastrophizing', mind_reading: 'Mind-reading',
  overgeneralizing: 'Overgeneralizing', personalizing: 'Personalizing',
  filtering: 'Filtering', emotional_reasoning: 'Emotional reasoning',
  should_statements: 'Should statements',
};

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
  const [filterRange, setFilterRange] = useState('all'); // 'all' | 'month' | 'week'
  const [filterVirtue, setFilterVirtue] = useState('all');
  const [stats, setStats] = useState({ journaled: 0, triggers: 0, reframed: 0 });
  const [emotionBreakdown, setEmotionBreakdown] = useState([]); // [{emotion, count, avgIntensity}]
  const [distortionBreakdown, setDistortionBreakdown] = useState([]); // [{id, label, count}]

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

      // Emotion frequency + average intensity
      const emotionMap = {};
      weekTriggers.forEach(t => {
        const key = t.emotion || 'other';
        if (!emotionMap[key]) emotionMap[key] = { count: 0, totalIntensity: 0 };
        emotionMap[key].count += 1;
        emotionMap[key].totalIntensity += (t.intensity || 5);
      });
      const emotionList = Object.entries(emotionMap)
        .map(([emotion, data]) => ({
          emotion,
          label: EMOTION_LABELS[emotion] || emotion,
          count: data.count,
          avgIntensity: Math.round(data.totalIntensity / data.count),
        }))
        .sort((a, b) => b.count - a.count);
      setEmotionBreakdown(emotionList);

      // Distortion frequency
      const distMap = {};
      weekTriggers.forEach(t => {
        (t.distortions || []).forEach(d => {
          distMap[d] = (distMap[d] || 0) + 1;
        });
      });
      const distList = Object.entries(distMap)
        .map(([id, count]) => ({ id, label: DISTORTION_LABELS[id] || id, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
      setDistortionBreakdown(distList);
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

  const filteredHistory = history.filter(e => {
    if (filterVirtue !== 'all' && e.bestVirtue !== filterVirtue && e.worstVirtue !== filterVirtue) return false;
    if (filterRange !== 'all') {
      const days = filterRange === 'week' ? 7 : 30;
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
      if (new Date(e.date).getTime() < cutoff) return false;
    }
    return true;
  });

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.bg }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={s.scroll}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
          contentInset={{ bottom: 40 }}
          scrollIndicatorInsets={{ bottom: 40 }}
        >

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


            {emotionBreakdown.length > 0 && (
              <View style={s.insightCard}>
                <Text style={s.insightCardTitle}>Emotions this week</Text>
                {emotionBreakdown.map((item, idx) => (
                  <View key={idx} style={s.insightRow}>
                    <View style={s.insightRowLeft}>
                      <Text style={s.insightEmotionLabel}>{item.label}</Text>
                      <View style={s.insightBar}>
                        <View style={[s.insightBarFill, {
                          width: `${Math.round((item.count / (emotionBreakdown[0]?.count || 1)) * 100)}%`,
                          backgroundColor: item.avgIntensity >= 7 ? colors.virtueBad : item.avgIntensity >= 4 ? colors.accent : colors.borderStrong,
                        }]} />
                      </View>
                    </View>
                    <View style={s.insightRowRight}>
                      <Text style={s.insightCount}>{item.count}×</Text>
                      <Text style={s.insightIntensity}>avg {item.avgIntensity}/10</Text>
                    </View>
                  </View>
                ))}
                <Text style={s.insightFootnote}>Bar color reflects average intensity: gold = moderate, red = high</Text>
              </View>
            )}

            {distortionBreakdown.length > 0 && (
              <View style={s.insightCard}>
                <Text style={s.insightCardTitle}>Recurring distortions</Text>
                {distortionBreakdown.map((item, idx) => (
                  <View key={idx} style={[s.insightRow, { alignItems: 'center', marginBottom: 10 }]}>
                    <Text style={[s.insightEmotionLabel, { flex: 1, marginBottom: 0 }]}>{item.label}</Text>
                    <View style={s.insightPill}>
                      <Text style={s.insightPillText}>{item.count}×</Text>
                    </View>
                  </View>
                ))}
                <Text style={s.insightFootnote}>These patterns deserve attention in your intention below.</Text>
              </View>
            )}

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
            <View style={s.filterRow}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingBottom: 8 }}>
                {[['all','All time'],['month','This month'],['week','This week']].map(([val, label]) => (
                  <TouchableOpacity
                    key={val}
                    style={[s.filterPill, filterRange === val && s.filterPillActive]}
                    onPress={() => setFilterRange(val)}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.filterPillText, filterRange === val && s.filterPillTextActive]}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            {filteredHistory.length !== history.length && (
              <Text style={[s.filterCount, { paddingHorizontal: 16, paddingBottom: 8 }]}>{filteredHistory.length} of {history.length} reviews</Text>
            )}

            {filteredHistory.length === 0 && history.length > 0 ? (
              <View style={s.empty}>
                <Text style={s.emptyText}>No reviews in this range.</Text>
              </View>
            ) : filteredHistory.length === 0 ? (
              <View style={s.empty}>
                <Text style={s.emptyText}>No reviews yet.{'\n'}Complete your first week.</Text>
              </View>
            ) : (
              filteredHistory.map(entry => (
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
      </KeyboardAvoidingView>
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
  insightCard: { borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.lg, padding: 18, marginBottom: 14, backgroundColor: colors.bgCard },
  insightCardTitle: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.accent, textTransform: 'uppercase', marginBottom: 16 },
  insightRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  insightRowLeft: { flex: 1, marginRight: 12 },
  insightRowRight: { alignItems: 'flex-end' },
  insightEmotionLabel: { fontSize: 14, color: colors.textSecondary, marginBottom: 6 },
  insightBar: { height: 3, backgroundColor: colors.border, borderRadius: 2, overflow: 'hidden' },
  insightBarFill: { height: 3, borderRadius: 2 },
  insightCount: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: 2 },
  insightIntensity: { fontSize: 11, color: colors.textDim, letterSpacing: 0.5 },
  insightPill: { borderWidth: 0.5, borderColor: colors.borderMid, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  insightPillText: { fontSize: 12, color: colors.textMuted },
  insightFootnote: { fontSize: 11, color: colors.textDim, marginTop: 4, fontStyle: 'italic' },
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
  filterRow: { paddingVertical: 8 },
  filterPill: { borderWidth: 0.5, borderColor: colors.border, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: colors.bgCard },
  filterPillActive: { backgroundColor: colors.accentBg, borderColor: colors.accentDim },
  filterPillText: { fontSize: 12, color: colors.textDim, letterSpacing: 0.3 },
  filterPillTextActive: { color: colors.accent },
  filterCount: { fontSize: 12, color: colors.textMuted },
  emptyText: { fontSize: 16, color: colors.textDim, fontStyle: 'italic', textAlign: 'center', lineHeight: 26 },
});