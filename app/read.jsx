import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TextInput,
  TouchableOpacity, StyleSheet, SafeAreaView, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { colors, radius, spacing, font } from '../constants/theme';
import { getTodayReading, saveTodayReading, saveReadingInsight, getReadingLog, getTodayJournal } from '../store/db';

const SYSTEM_PROMPT = `You are a Stoic philosopher and teacher. Generate a daily Stoic reading in this EXACT JSON format with no other text:
{
  "quote": "the exact quote",
  "author": "Author Name",
  "work": "Title of Work",
  "theme": "2-4 word theme",
  "virtue": "Wisdom|Courage|Moderation|Justice",
  "reflection": "A 3-4 sentence practical reflection connecting ancient wisdom to modern life. Write in second person."
}
Use only real, accurately attributed quotes from Marcus Aurelius (Meditations), Epictetus (Discourses, Enchiridion), or Seneca (Letters, On the Shortness of Life). Never invent quotes.`;

const virtueColor = {
  Wisdom: '#7a9aaa',
  Courage: '#aa8a6a',
  Moderation: '#7a9a7a',
  Justice: '#9a8aaa',
};

export default function ReadScreen() {
  const router = useRouter();
  const [tab, setTab] = useState('today');
  const [reading, setReading] = useState(null);
  const [insight, setInsight] = useState('');
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState([]);
  const [insightSaved, setInsightSaved] = useState(false);

  useFocusEffect(useCallback(() => {
  async function load() {
    const cached = await getTodayReading();
    if (cached) {
      setReading(cached);
      if (cached.insight) {
        setInsight(cached.insight);
        setInsightSaved(true);
      }
    } else {
      // Auto-generate on first load of the day
      generateReading();
    }
    const logEntries = await getReadingLog();
    setLog(logEntries);
  }
  load();
}, []));

  async function generateReading() {
    setLoading(true);
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.EXPO_PUBLIC_ANTHROPIC_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-5',
          max_tokens: 1000,
          system: SYSTEM_PROMPT,
          messages: [{
            role: 'user',
            content: `Today is ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}. Generate a Stoic reading. Return only the JSON object.`,
          }],
        }),
      });
      const data = await response.json();
      const text = data.content?.[0]?.text || '';
      const clean = text.replace(/```json|```/g, '').trim();
      const result = JSON.parse(clean);
      await saveTodayReading(result);
      setReading(result);
      setInsight('');
      setInsightSaved(false);
    } catch (e) {
      Alert.alert('', 'Could not generate reading. Check your connection.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveInsight() {
    if (!insight.trim()) return;
    await saveReadingInsight(insight);
    setInsightSaved(true);
    const updated = await getReadingLog();
    setLog(updated);

    // Check what's still left to do
    const morning = await getTodayJournal('morning');

    if (!morning) {
      Alert.alert('', 'Insight saved.', [
        { text: 'Morning journal →', onPress: () => router.replace({ pathname: '/journal', params: { type: 'morning' } }) },
        { text: 'Back to Practice', style: 'cancel', onPress: () => router.replace('/') },
      ]);
    } else {
      Alert.alert('', 'Insight saved.', [
        { text: 'Back to Practice', onPress: () => router.replace('/') },
      ]);
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

          <View style={s.hero}>
            <TouchableOpacity onPress={() => router.back()} style={s.backRow}>
              <Text style={s.backArrow}>‹</Text>
              <Text style={s.backLabel}>Practice</Text>
            </TouchableOpacity>
            <Text style={s.eyebrow}>Daily reading</Text>
            <Text style={s.title}>
              {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
            </Text>
            <Text style={s.sub}>
              {tab === 'today' ? 'Ancient wisdom for this day' : 'Your reading archive'}
            </Text>
          </View>

          <View style={s.tabRow}>
            {['today', 'archive'].map(t => (
              <TouchableOpacity
                key={t}
                style={[s.tabBtn, tab === t && s.tabBtnActive]}
                onPress={() => setTab(t)}
              >
                <Text style={[s.tabBtnText, tab === t && s.tabBtnTextActive]}>
                  {t === 'today' ? 'Today' : 'Archive'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {tab === 'today' ? (
            <View style={s.body}>
              {loading ? (
                <View style={s.loadingCard}>
  <Image
    source={require('../assets/skull.png')}
    style={s.loadingSkull}
    resizeMode="contain"
  />
  <Text style={s.loadingText}>Summoning wisdom from antiquity...</Text>
</View>
              ) : reading ? (
                <>
                  <View style={s.badgeRow}>
                    {reading.virtue && (
                      <View style={[s.virtueBadge, { borderColor: virtueColor[reading.virtue] || colors.border }]}>
                        <Text style={[s.virtueBadgeText, { color: virtueColor[reading.virtue] || colors.textDim }]}>
                          {reading.virtue}
                        </Text>
                      </View>
                    )}
                    {reading.theme && (
                      <View style={s.themeBadge}>
                        <Text style={s.themeBadgeText}>{reading.theme}</Text>
                      </View>
                    )}
                  </View>

                  <View style={s.quoteCard}>
                    <Text style={s.quoteMark}>"</Text>
                    <Text style={s.quoteText}>{reading.quote}"</Text>
                    <View style={s.quoteRule} />
                    <Text style={s.quoteAuthor}>— {reading.author}</Text>
                    {reading.work && <Text style={s.quoteWork}>{reading.work}</Text>}
                  </View>

                  <View style={s.reflectionCard}>
                    <Text style={s.reflectionLabel}>Reflection</Text>
                    <Text style={s.reflectionText}>{reading.reflection}</Text>
                  </View>

                  <View style={s.insightCard}>
                    <Text style={s.insightLabel}>Your insight</Text>
                    <Text style={s.insightSub}>What does this mean for you today?</Text>
                    <TextInput
                      style={s.insightInput}
                      multiline
                      placeholder="Write your reaction, insight, or intention..."
                      placeholderTextColor={colors.textDim}
                      value={insight}
                      onChangeText={text => { setInsight(text); setInsightSaved(false); }}
                      scrollEnabled={false}
                    />
                  </View>

                  <TouchableOpacity
                    style={[s.saveBtn, insightSaved && s.saveBtnDone]}
                    onPress={handleSaveInsight}
                    activeOpacity={0.8}
                  >
                    <Text style={s.saveBtnText}>
                      {insightSaved ? 'Insight saved' : 'Save insight'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={s.refreshBtn} onPress={generateReading} activeOpacity={0.8}>
                    <Text style={s.refreshBtnText}>Generate new reading</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity style={s.generateBtn} onPress={generateReading} activeOpacity={0.8}>
                  <Text style={s.generateBtnText}>Generate today's reading</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View>
              {log.length === 0 ? (
                <View style={s.empty}>
                  <Text style={s.emptyText}>No readings saved yet.{'\n'}Save your first insight to begin the archive.</Text>
                </View>
              ) : (
                log.map(entry => (
                  <View key={entry.id} style={s.archiveRow}>
                    <View style={s.archiveTop}>
                      <Text style={s.archiveDate}>{entry.date}</Text>
                      {entry.reading?.virtue && (
                        <Text style={[s.archiveVirtue, { color: virtueColor[entry.reading.virtue] || colors.textDim }]}>
                          {entry.reading.virtue}
                        </Text>
                      )}
                    </View>
                    {entry.reading?.theme && (
                      <Text style={s.archiveTheme}>{entry.reading.theme}</Text>
                    )}
                    {entry.reading?.quote && (
                      <Text style={s.archiveQuote}>"{entry.reading.quote.slice(0, 100)}..."</Text>
                    )}
                    {entry.insight && (
                      <View style={s.archiveInsightBlock}>
                        <Text style={s.archiveInsightLabel}>Your insight</Text>
                        <Text style={s.archiveInsight}>{entry.insight}</Text>
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
  title: { fontSize: font.titleSize, fontWeight: '300', color: colors.textPrimary, letterSpacing: -0.5, marginBottom: 6 },
  sub: { fontSize: font.subSize, color: colors.textMuted },
  tabRow: {
    flexDirection: 'row', gap: 10, padding: spacing.md,
    borderBottomWidth: 0.5, borderBottomColor: colors.border, backgroundColor: colors.bgDeep,
  },
  tabBtn: { flex: 1, borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.md, padding: 14, alignItems: 'center' },
  tabBtnActive: { backgroundColor: colors.bgElevated, borderColor: colors.borderStrong },
  tabBtnText: { fontSize: 13, color: colors.textDim, letterSpacing: 0.8, textTransform: 'uppercase' },
  tabBtnTextActive: { color: colors.textSecondary },
  // Light reading body
  body: { padding: spacing.md, backgroundColor: colors.bgCard },
  loadingCard: {
    borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.lg,
    padding: 48, alignItems: 'center', marginTop: 8,
    backgroundColor: colors.bgCard,
  },
  loadingSkull: { width: 64, height: 64, opacity: 0.6, marginBottom: 16 },
  loadingText: { fontSize: 14, color: colors.textMuted },
  badgeRow: { flexDirection: 'row', gap: 8, marginBottom: 14, marginTop: 8 },
  virtueBadge: { borderWidth: 0.5, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 5 },
  virtueBadgeText: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5 },
  themeBadge: { borderWidth: 0.5, borderColor: colors.border, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 5 },
  themeBadgeText: { fontSize: 12, color: colors.textMuted },
  // Quote card stays dark — gravitas of the Stoic quote
  quoteCard: {
    borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.lg,
    padding: 22, marginBottom: 12, backgroundColor: colors.bgDeep,
  },
  quoteMark: { fontSize: 40, color: colors.borderStrong, lineHeight: 32, fontFamily: font.serif, marginBottom: -4 },
  quoteText: { fontSize: 19, color: colors.textPrimary, lineHeight: 32, fontFamily: font.serif },
  quoteRule: { height: 0.5, backgroundColor: colors.border, marginVertical: 16 },
  quoteAuthor: { fontSize: 14, color: colors.textSecondary, fontWeight: '500' },
  quoteWork: { fontSize: 12, color: colors.textDim, marginTop: 3 },
  // Reflection — light
  reflectionCard: {
    borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.lg,
    padding: 22, marginBottom: 12, backgroundColor: colors.bgCard,
  },
  reflectionLabel: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.textMuted, textTransform: 'uppercase', marginBottom: 12 },
  reflectionText: { fontSize: 16, color: colors.textSecondary, lineHeight: 28, fontFamily: font.serif },
  // Insight — light writing surface
  insightCard: {
    borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.lg,
    padding: 20, marginBottom: 12, backgroundColor: colors.bgCard,
  },
  insightLabel: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.textMuted, textTransform: 'uppercase', marginBottom: 4 },
  insightSub: { fontSize: 13, color: colors.textDim, marginBottom: 14 },
  insightInput: {
    fontSize: 16, color: colors.textPrimary, lineHeight: 26,
    minHeight: 100, textAlignVertical: 'top',
  },
  saveBtn: {
    borderWidth: 0.5, borderColor: colors.borderMid, borderRadius: radius.md,
    padding: 18, alignItems: 'center', backgroundColor: colors.bgCard, marginBottom: 10,
  },
  saveBtnDone: { borderColor: colors.borderMid, backgroundColor: colors.bgElevated },
  saveBtnText: { fontSize: 13, fontWeight: '500', color: colors.textPrimary, letterSpacing: 1, textTransform: 'uppercase' },
  refreshBtn: { padding: 14, alignItems: 'center', marginBottom: 36 },
  refreshBtnText: { fontSize: 12, color: colors.textMuted, letterSpacing: 0.8, textTransform: 'uppercase' },
  generateBtn: {
    borderWidth: 0.5, borderColor: colors.borderMid, borderRadius: radius.md,
    padding: 20, alignItems: 'center', backgroundColor: colors.bgCard, marginTop: 8,
  },
  generateBtnText: { fontSize: 14, fontWeight: '500', color: colors.textPrimary, letterSpacing: 1, textTransform: 'uppercase' },
  empty: { padding: 60, alignItems: 'center', backgroundColor: colors.bgCard },
  emptyText: { fontSize: 16, color: colors.textDim, textAlign: 'center', lineHeight: 26 },
  archiveRow: { padding: 20, borderBottomWidth: 0.5, borderBottomColor: colors.border, backgroundColor: colors.bgCard },
  archiveTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  archiveDate: { fontSize: 14, color: colors.textPrimary, fontWeight: '500' },
  archiveVirtue: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5 },
  archiveTheme: { fontSize: 12, color: colors.textDim, letterSpacing: 0.3, marginBottom: 8, textTransform: 'uppercase' },
  archiveQuote: { fontSize: 14, color: colors.textMuted, fontFamily: font.serif, lineHeight: 22, marginBottom: 10 },
  archiveInsightBlock: { borderLeftWidth: 1.5, borderLeftColor: colors.borderMid, paddingLeft: 12, marginTop: 4 },
  archiveInsightLabel: { fontSize: 10, color: colors.textDim, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 },
  archiveInsight: { fontSize: 14, color: colors.textSecondary, lineHeight: 22 },
});