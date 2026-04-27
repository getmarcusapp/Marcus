import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TextInput,
  TouchableOpacity, StyleSheet, SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors, radius, spacing, font } from '../constants/theme';
import { virtues } from '../constants/virtues';
import { getCompass, saveCompass, getTodayReading, getTodayJournal } from '../store/db';

const COMPASS_HINTS = {
  why: {
    placeholder: "e.g. To act with integrity regardless of outcome. To be the kind of person my future self would be proud of.",
    hint: "The Stoics distinguished sharply between what is 'up to us' and what is not. Your Why should live entirely in the first category — character, intention, how you show up — not outcomes, status, or what others think of you.\n\nAsk: is this something I could achieve even if everything around me went wrong? If yes, it is a Stoic Why. If it depends on external circumstances going your way, return to what is in your control.\n\nMarcus Aurelius' unspoken Why was simple: to be a just and rational man, regardless of whether his empire prospered.",
  },
  aspire: {
    placeholder: "e.g. To respond to difficulty with reason rather than reaction. To be present with the people I love.",
    hint: "Aspiration in Stoic terms is the cultivation of virtue — not achievement of outcomes. The four virtues are wisdom, courage, temperance, and justice.\n\nThe test: does your aspiration describe who you are becoming, or what you are getting? 'I aspire to be promoted' is external. 'I aspire to do work worthy of recognition' is internal.\n\nEpictetus: 'First say to yourself what you would be; then do what you have to do.'",
  },
  overcome: {
    placeholder: "e.g. My tendency to avoid difficult conversations. Mistaking busyness for progress.",
    hint: "Name a pattern you can observe in yourself — not a circumstance or another person. Those are outside your control.\n\nWhat you can overcome is your habitual judgment about events. 'I want to overcome anxiety' is external. 'I want to stop treating anxiety as a verdict rather than an impression' is internal.\n\nThat distinction is where the Stoic practice lives.",
  },
};

const tabs = ['Why', 'Overcome', 'Aspire', 'Virtues'];
const tabKeys = ['why', 'overcome', 'aspire'];

export default function CompassScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(0);
  const [compass, setCompass] = useState(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [hintOpen, setHintOpen] = useState(false);
  const [readingDone, setReadingDone] = useState(false);
  const [morningDone, setMorningDone] = useState(false);

  useEffect(() => {
    getCompass().then(setCompass);
    getTodayReading().then(r => setReadingDone(!!r));
    getTodayJournal('morning').then(m => setMorningDone(!!m));
  }, []);

  async function handleSave() {
    const key = tabKeys[activeTab];
    const updated = { ...compass, [key]: draft };
    await saveCompass(updated);
    setCompass(updated);
    setEditing(false);
  }

  function startEdit() {
    setDraft(compass[tabKeys[activeTab]] || '');
    setEditing(true);
  }

  function handleNext() {
    if (!readingDone) {
      router.push('/read');
    } else if (!morningDone) {
      router.push({ pathname: '/journal', params: { type: 'morning' } });
    } else {
      router.replace('/');
    }
  }

  function nextLabel() {
    if (!readingDone) return 'Continue to daily reading';
    if (!morningDone) return 'Continue to morning journal';
    return 'Back to practice';
  }

  if (!compass) return <SafeAreaView style={s.safe} />;

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>

        <View style={s.hero}>
          <TouchableOpacity onPress={() => router.back()} style={s.backRow}>
            <Text style={s.backArrow}>‹</Text>
            <Text style={s.backLabel}>Practice</Text>
          </TouchableOpacity>
          <Text style={s.eyebrow}>My stoic compass</Text>
          <Text style={s.title}>Your north star</Text>
          <Text style={s.heroQuote}>“Know, first, who you are, and then adorn yourself accordingly.”</Text>
          <Text style={s.heroAttr}>— Epictetus, Discourses</Text>
        </View>

        <View style={s.nextRow}>
          <TouchableOpacity
            style={s.nextBtn}
            onPress={handleNext}
            activeOpacity={0.7}
          >
            <Text style={s.nextBtnText}>{nextLabel()}</Text>
            <Text style={s.nextBtnChev}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={s.navRow}>
          {tabs.map((t, i) => (
            <TouchableOpacity
              key={t}
              style={[s.navPill, activeTab === i && s.navPillActive]}
              onPress={() => { setActiveTab(i); setEditing(false); setHintOpen(false); }}
            >
              <Text style={[s.navPillText, activeTab === i && s.navPillTextActive]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={s.body}>
          {activeTab < 3 ? (
            editing ? (
              <View>
                <View style={s.hintRow}>
                  <Text style={s.hintLabel}>{tabs[activeTab]}</Text>
                  <TouchableOpacity style={s.hintBtn} onPress={() => setHintOpen(!hintOpen)} activeOpacity={0.7}>
                    <Text style={s.hintBtnText}>ⓘ</Text>
                  </TouchableOpacity>
                </View>
                {hintOpen && COMPASS_HINTS[tabKeys[activeTab]] && (
                  <View style={s.hintBox}>
                    <Text style={s.hintText}>{COMPASS_HINTS[tabKeys[activeTab]].hint}</Text>
                  </View>
                )}
                <TextInput
                  style={s.editInput}
                  multiline
                  value={draft}
                  onChangeText={setDraft}
                  placeholder={COMPASS_HINTS[tabKeys[activeTab]]?.placeholder || ''}
                  placeholderTextColor={colors.textDim}
                />
                <View style={s.editBtns}>
                  <TouchableOpacity style={s.editBtn} onPress={() => setEditing(false)}>
                    <Text style={s.editBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.editBtn, s.editBtnSave]} onPress={handleSave}>
                    <Text style={[s.editBtnText, { color: colors.textSecondary }]}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View>
                <View style={s.hintRow}>
                  <Text style={s.hintLabel}>{tabs[activeTab]}</Text>
                  <TouchableOpacity style={s.hintBtn} onPress={() => setHintOpen(!hintOpen)} activeOpacity={0.7}>
                    <Text style={s.hintBtnText}>ⓘ</Text>
                  </TouchableOpacity>
                </View>
                {hintOpen && COMPASS_HINTS[tabKeys[activeTab]] && (
                  <View style={s.hintBox}>
                    <Text style={s.hintText}>{COMPASS_HINTS[tabKeys[activeTab]].hint}</Text>
                  </View>
                )}
                <View style={s.textCard}>
                  <Text style={s.bodyText}>{compass[tabKeys[activeTab]]}</Text>
                </View>
                <TouchableOpacity style={s.editTrigger} onPress={startEdit}>
                  <Text style={s.editTriggerText}>Edit this section</Text>
                </TouchableOpacity>
              </View>
            )
          ) : (
            <View>
              <Text style={s.secLabel}>The four cardinal virtues</Text>
              {virtues.map(v => (
                <View key={v.id} style={s.virtueCard}>
                  <View style={s.virtueTop}>
                    <Text style={s.virtueName}>{v.name}</Text>
                    <Text style={s.virtueLatin}>{v.latin}</Text>
                  </View>
                  <Text style={s.virtueDesc}>{v.desc}</Text>
                  <View style={s.virtueDivider} />
                  <Text style={s.virtueQuestion}>"{v.question}"</Text>
                </View>
              ))}
            </View>
          )}
        </View>

      </ScrollView>
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
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 18 },
  backArrow: { fontSize: 24, color: colors.accent },
  backLabel: { fontSize: 13, color: colors.accent, letterSpacing: 0.8, textTransform: 'uppercase' },
  eyebrow: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.accent, textTransform: 'uppercase', marginBottom: 8 },
  title: { fontSize: font.heroSize, fontWeight: '300', color: colors.textPrimary, letterSpacing: -0.8, marginBottom: 10 },
  heroQuote: { fontSize: 15, color: colors.textMuted, fontFamily: font.serif, lineHeight: 24, marginBottom: 6 },
  heroAttr: { fontSize: 11, color: colors.textDim, letterSpacing: 1, textTransform: 'uppercase' },
  nextRow: {
    backgroundColor: colors.accentBg,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.accentDim,
    padding: spacing.md,
  },
  nextBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 14, borderWidth: 0.5, borderColor: colors.accentDim, borderRadius: radius.md,
  },
  nextBtnText: { fontSize: 14, color: colors.accent, fontWeight: '500' },
  nextBtnChev: { fontSize: 20, color: colors.accent },
  navRow: {
    flexDirection: 'row', borderBottomWidth: 0.5,
    borderBottomColor: colors.border, backgroundColor: colors.bgDeep,
  },
  navPill: { flex: 1, paddingVertical: 16, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  navPillActive: { borderBottomColor: colors.accent },
  navPillText: { fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.textDim },
  navPillTextActive: { color: colors.accent },
  // Light reading/editing body
  body: { padding: spacing.md, paddingTop: spacing.lg, backgroundColor: colors.bgCard },
  textCard: {
    borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.lg,
    padding: 22, marginBottom: 14, backgroundColor: colors.bgElevated,
  },
  bodyText: { fontSize: 17, color: colors.textSecondary, lineHeight: 28 },
  editTrigger: {
    borderWidth: 0.5, borderColor: colors.borderMid, borderRadius: radius.md,
    padding: 16, alignItems: 'center', marginBottom: 28,
  },
  editTriggerText: { fontSize: 13, color: colors.textMuted, letterSpacing: 1, textTransform: 'uppercase' },
  editInput: {
    borderWidth: 0.5, borderColor: colors.borderMid, borderRadius: radius.lg,
    padding: 18, fontSize: 16, color: colors.textPrimary, lineHeight: 26,
    minHeight: 240, textAlignVertical: 'top', marginBottom: 12,
    backgroundColor: colors.bgElevated,
  },
  editBtns: { flexDirection: 'row', gap: 10, marginBottom: 28 },
  editBtn: {
    flex: 1, borderWidth: 0.5, borderColor: colors.border,
    borderRadius: radius.md, padding: 16, alignItems: 'center',
  },
  editBtnSave: { borderColor: colors.borderMid, backgroundColor: colors.bgElevated },
  editBtnText: { fontSize: 13, color: colors.textMuted, letterSpacing: 0.8, textTransform: 'uppercase' },
  secLabel: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.textDim, textTransform: 'uppercase', marginBottom: 14 },
  virtueCard: {
    borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.lg,
    padding: 22, marginBottom: 12, backgroundColor: colors.bgElevated,
  },
  virtueTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 },
  virtueName: { fontSize: 22, fontWeight: '400', color: colors.textPrimary },
  virtueLatin: { fontSize: 13, color: colors.textMuted },
  virtueDesc: { fontSize: 15, color: colors.textSecondary, lineHeight: 24 },
  virtueDivider: { height: 0.5, backgroundColor: colors.border, marginVertical: 14 },
  virtueQuestion: { fontSize: 14, color: colors.textMuted, lineHeight: 22 },
  // Hint styles
  hintRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  hintLabel: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.accent, textTransform: 'uppercase' },
  hintBtn: { padding: 6 },
  hintBtnText: { fontSize: 20, color: colors.accent },
  hintBox: { backgroundColor: colors.bgDeep, borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.md, padding: 16, marginBottom: 14 },
  hintText: { fontSize: 15, color: colors.textSecondary, lineHeight: 24 },
});