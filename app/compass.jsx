import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TextInput,
  TouchableOpacity, StyleSheet, SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors, radius, spacing, font } from '../constants/theme';
import { virtues } from '../constants/virtues';
import { getCompass, saveCompass, getTodayReading, getTodayJournal } from '../store/db';

const tabs = ['Why', 'Overcome', 'Aspire', 'Virtues'];
const tabKeys = ['why', 'overcome', 'aspire'];

export default function CompassScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(0);
  const [compass, setCompass] = useState(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
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
          <Text style={s.heroQuote}>"Know thyself — then act accordingly."</Text>
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
              onPress={() => { setActiveTab(i); setEditing(false); }}
            >
              <Text style={[s.navPillText, activeTab === i && s.navPillTextActive]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={s.body}>
          {activeTab < 3 ? (
            editing ? (
              <View>
                <TextInput
                  style={s.editInput}
                  multiline
                  value={draft}
                  onChangeText={setDraft}
                  placeholderTextColor={colors.textGhost}
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
  heroQuote: { fontSize: 15, color: colors.textMuted, fontFamily: font.serif, lineHeight: 24 },
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
    padding: 22, marginBottom: 14, backgroundColor: colors.bgCard,
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
    backgroundColor: colors.bgCard,
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
    padding: 22, marginBottom: 12, backgroundColor: colors.bgCard,
  },
  virtueTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 },
  virtueName: { fontSize: 22, fontWeight: '400', color: colors.textPrimary },
  virtueLatin: { fontSize: 13, color: colors.textMuted },
  virtueDesc: { fontSize: 15, color: colors.textSecondary, lineHeight: 24 },
  virtueDivider: { height: 0.5, backgroundColor: colors.border, marginVertical: 14 },
  virtueQuestion: { fontSize: 14, color: colors.textMuted, lineHeight: 22 },
});