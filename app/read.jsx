import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TextInput,
  TouchableOpacity, StyleSheet, SafeAreaView, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { colors, radius, spacing, font } from '../constants/theme';
import { getTodayReading, saveTodayReading, saveReadingInsight, getReadingLog, getReadingHistory, getLastVirtueFocus } from '../store/db';
import { getNextPracticeAfter } from '../store/practice-flow';

const SYSTEM_PROMPT = `You are a curator of Stoic and philosophical wisdom generating a personalized daily reading for a user of a Stoic practice app.

You have access to a web search tool. Optionally use it to find a current event ONLY from within the past 48 hours. Before invoking the Stoic lens on any event, verify the article's publication date is within 48 hours of today. If you cannot find a date or the event is older, DO NOT use it — write a timeless reflection instead. A timeless reflection is preferred over a recycled or stale event.

Topical diversity is critical. Do not repeatedly anchor on the same domain (e.g. marathons, elections, market moves). Rotate categories across days. If your search returns the same dominant story you've covered before, ignore it and write timeless.

Avoid events where the Stoic framing could be read as taking a political side. Do not use: ongoing military conflicts, contested foreign policy, partisan political disputes. Prefer when freshness is verified: markets, natural disasters, cultural moments, scientific discoveries, business, sports, or universal human stories. If the only significant news is political, military, or stale, write a timeless reading instead.

Generate a daily reading in this EXACT JSON format with no other text:
{
  "quote": "the exact quote",
  "author": "Author Name",
  "work": "Title of Work",
  "theme": "2-4 word Stoic theme (not the news event itself)",
  "virtue": "Wisdom|Courage|Moderation|Justice",
  "reflection": "A 3-4 sentence reflection. If a current event applies, briefly name it and apply the Stoic lens. Otherwise write a timeless reflection in second person. Personalize to the user's Virtue focus and compass context if provided."
}

Sources — never invent or misattribute:
- Core Stoics: Marcus Aurelius (Meditations), Epictetus (Discourses, Enchiridion), Seneca (Letters, Essays), Zeno, Cato, Cleanthes
- Aligned thinkers: Socrates, Aristotle, Heraclitus, Cicero, Viktor Frankl, Montaigne, Stockdale

Rules: Vary sources daily. No consecutive same author. Prefer lesser-cited quotes. Match virtue field to user's focus if provided.`;

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
  const [loadingPhase, setLoadingPhase] = useState(0);
  const [log, setLog] = useState([]);
  const [searchQ, setSearchQ] = useState('');
  const [filterAuthor, setFilterAuthor] = useState('all');
  const [filterMonth, setFilterMonth] = useState('all');
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
    setLoadingPhase(0);
    const phaseTimer = setTimeout(() => setLoadingPhase(1), 4000);
    try {
      const history = await getReadingHistory();
      const virtueFocus = await getLastVirtueFocus();
      const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
      const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
      const recentAuthors = history.slice(0, 14).map(r => r.author).filter(Boolean).join(', ');
      const recentQuotes = history.slice(0, 7).map(r => r.quote ? r.quote.substring(0, 60) : '').filter(Boolean).join(' | ');
      const recentReflections = history.slice(0, 7).map((r, i) => r.reflection ? `(${i + 1}) ${r.reflection.substring(0, 200)}` : '').filter(Boolean).join('\n');
      const recentThemes = history.slice(0, 7).map(r => r.theme).filter(Boolean).join(', ');
      const userMessage = `Today is ${dateStr} (day ${dayOfYear} of the year). Search for a current event first, then generate a personalized Stoic reading. Return only the JSON object.

${virtueFocus ? `User's current Virtue focus: ${virtueFocus}. Tailor the reading and reflection to that focus.` : ''}

Do NOT use these recently used authors: ${recentAuthors || 'none'}.
Do NOT use quotes similar to these recent ones: ${recentQuotes || 'none'}.
Do NOT repeat these recent themes: ${recentThemes || 'none'}.
Do NOT write a reflection that overlaps in topic, framing, or news event with these recent reflections:
${recentReflections || 'none'}`;
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.EXPO_PUBLIC_ANTHROPIC_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 2048,
          system: SYSTEM_PROMPT,
          tools: [{ type: 'web_search_20250305', name: 'web_search' }],
          messages: [{ role: 'user', content: userMessage }],
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        console.log('Reading API non-OK:', response.status, JSON.stringify(data));
        throw new Error(`API ${response.status}: ${data?.error?.message || 'unknown'}`);
      }
      // Web search returns multiple content blocks; extract the final text block
      const textBlock = Array.isArray(data.content)
        ? data.content.filter(b => b.type === 'text').pop()
        : null;
      const text = textBlock?.text || data.content?.[0]?.text || '';
      const stripped = text.replace(/```json|```/g, '').trim();
      const start = stripped.indexOf('{');
      const end = stripped.lastIndexOf('}');
      if (start === -1 || end === -1 || end <= start) {
        console.log('Reading: no JSON object in response. Raw text:', stripped.slice(0, 500));
        throw new Error('Model did not return JSON');
      }
      const result = JSON.parse(stripped.slice(start, end + 1));
      await saveTodayReading(result);
      setReading(result);
      setInsight('');
      setInsightSaved(false);
    } catch (e) {
      console.log('Reading generation failed:', e?.message, e);
      Alert.alert('', 'Could not generate reading. Check your connection.');
    } finally {
      clearTimeout(phaseTimer);
      setLoading(false);
      setLoadingPhase(0);
    }
  }

  async function handleSaveInsight() {
    if (!insight.trim()) return;
    await saveReadingInsight(insight);
    setInsightSaved(true);
    const updated = await getReadingLog();
    setLog(updated);

    const next = await getNextPracticeAfter('reading');
    if (next) {
      Alert.alert('', 'Insight saved.', [
        { text: `${next.label} →`, onPress: () => router.replace(next.href) },
        { text: 'Back to Practice', style: 'cancel', onPress: () => router.replace('/') },
      ]);
    } else {
      Alert.alert('', 'Insight saved.', [
        { text: 'Back to Practice', onPress: () => router.replace('/') },
      ]);
    }
  }

  // Unique authors and months from log for filter pills
  const authors = ['all', ...new Set(log.map(e => e.reading?.author).filter(Boolean))];
  const availableMonths = [...new Set(log.map(e => {
    const d = new Date(e.date);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }))].sort().reverse();

  const filteredLog = log
    .filter(e => {
      if (filterAuthor !== 'all' && e.reading?.author !== filterAuthor) return false;
      if (filterMonth !== 'all') {
        const d = new Date(e.date);
        const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
        if (key !== filterMonth) return false;
      }
      if (searchQ.trim()) {
        const q = searchQ.toLowerCase();
        const text = [e.reading?.quote, e.insight, e.reading?.theme, e.reading?.author].join(' ').toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });

  // Group by month for display
  function groupLogByMonth(entries) {
    const groups = {};
    entries.forEach(entry => {
      const d = new Date(entry.date);
      const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      if (!groups[key]) groups[key] = { label, entries: [] };
      groups[key].entries.push(entry);
    });
    return Object.keys(groups).sort().reverse().map(k => groups[k]);
  }

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
          keyboardShouldPersistTaps="handled"
          contentInset={{ bottom: 40 }}
          scrollIndicatorInsets={{ bottom: 40 }}
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
              {tab === 'today' ? 'Chosen for you. Grounded in today.' : 'Your reading archive'}
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
                  <ActivityIndicator
                    size="small"
                    color={colors.accent}
                    style={{ marginTop: 20, marginBottom: 8 }}
                  />
                  <Text style={s.loadingText}>
                    {loadingPhase === 0 ? 'Searching today\'s world...' : 'Composing your reading...'}
                  </Text>
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
                    <Text style={s.quoteText}>“{reading.quote}”</Text>
                    <View style={s.quoteRule} />
                    <Text style={s.quoteAuthor}>— {reading.author}</Text>
                    {reading.work && <Text style={s.quoteWork}>{reading.work}</Text>}
                    <Text style={s.readingSourceNote}>Generated for you based on your Virtue focus and compass. Not every reading comes from a Stoic text — each is chosen because it carries a lesson the Stoics would recognize.</Text>
                  </View>

                  <View style={s.reflectionCard}>
                    <Text style={s.reflectionLabel}>Reflection</Text>
                    <Text style={s.reflectionText}>{reading.reflection}</Text>
                  </View>

                  <View style={s.insightCard}>
                    <View style={s.insightLabelRow}>
                      <Text style={s.insightLabel}>Your insight</Text>
                      {insightSaved && (
                        <TouchableOpacity onPress={() => setInsightSaved(false)} activeOpacity={0.7}>
                          <Text style={s.insightEditBtn}>Edit</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    {!insightSaved && (
                      <Text style={s.insightSub}>What does this mean for you today?</Text>
                    )}
                    <TextInput
                      style={[s.insightInput, insightSaved && s.insightInputSaved]}
                      multiline
                      placeholder="Write your reaction, insight, or intention..."
                      placeholderTextColor={colors.textDim}
                      value={insight}
                      onChangeText={text => setInsight(text)}
                      scrollEnabled={false}
                      editable={!insightSaved}
                    />
                  </View>

                  {!insightSaved && (
                    <TouchableOpacity
                      style={s.saveBtn}
                      onPress={handleSaveInsight}
                      activeOpacity={0.8}
                    >
                      <Text style={s.saveBtnText}>Save insight</Text>
                    </TouchableOpacity>
                  )}

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
              <View style={s.searchBar}>
                <TextInput
                  style={s.searchInput}
                  placeholder="Search quotes or insights..."
                  placeholderTextColor={colors.textDim}
                  value={searchQ}
                  onChangeText={setSearchQ}
                  clearButtonMode="while-editing"
                />
              </View>
              <View style={s.filterRow}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingBottom: 4 }}>
                  {authors.map(a => (
                    <TouchableOpacity
                      key={a}
                      style={[s.filterPill, filterAuthor === a && s.filterPillActive]}
                      onPress={() => setFilterAuthor(a)}
                      activeOpacity={0.7}
                    >
                      <Text style={[s.filterPillText, filterAuthor === a && s.filterPillTextActive]}>
                        {a === 'all' ? 'All authors' : a}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              {availableMonths.length > 1 && (
                <View style={[s.filterRow, { paddingTop: 0 }]}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingBottom: 4 }}>
                    <TouchableOpacity style={[s.filterPill, filterMonth === 'all' && s.filterPillActive]} onPress={() => setFilterMonth('all')} activeOpacity={0.7}>
                      <Text style={[s.filterPillText, filterMonth === 'all' && s.filterPillTextActive]}>All time</Text>
                    </TouchableOpacity>
                    {availableMonths.map(mk => {
                      const d = new Date(mk + '-01');
                      const label = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                      return (
                        <TouchableOpacity key={mk} style={[s.filterPill, filterMonth === mk && s.filterPillActive]} onPress={() => setFilterMonth(mk)} activeOpacity={0.7}>
                          <Text style={[s.filterPillText, filterMonth === mk && s.filterPillTextActive]}>{label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}
              {filteredLog.length !== log.length && (
                <Text style={[s.filterCount, { paddingHorizontal: 16, paddingBottom: 8 }]}>{filteredLog.length} of {log.length} readings</Text>
              )}

              {filteredLog.length === 0 && log.length > 0 ? (
                <View style={s.empty}>
                  <Text style={s.emptyText}>No readings match your search.</Text>
                </View>
              ) : filteredLog.length === 0 ? (
                <View style={s.empty}>
                  <Text style={s.emptyText}>No readings saved yet.{'\n'}Save your first insight to begin the archive.</Text>
                </View>
              ) : (
                groupLogByMonth(filteredLog).map(group => (
                  <View key={group.label}>
                    <View style={s.monthHeader}>
                      <Text style={s.monthHeaderText}>{group.label}</Text>
                    </View>
                    {group.entries.map(entry => (
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
                    ))}
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
    backgroundColor: colors.bgElevated,
  },
  loadingSkull: { width: 160, height: 160, opacity: 0.9, marginBottom: 16 },
  loadingText: { fontSize: 14, color: colors.textMuted, marginTop: 4, fontFamily: font.serif, fontStyle: 'italic' },
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
  quoteText: { fontSize: 19, color: colors.textPrimary, lineHeight: 32, fontFamily: font.serif },
  quoteRule: { height: 0.5, backgroundColor: colors.border, marginVertical: 16 },
  quoteAuthor: { fontSize: 14, color: colors.textSecondary, fontWeight: '500' },
  readingSourceNote: { fontSize: 13, color: colors.textMuted, marginTop: 14, lineHeight: 20 },
  quoteWork: { fontSize: 12, color: colors.textDim, marginTop: 3 },
  // Reflection — light
  reflectionCard: {
    borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.lg,
    padding: 22, marginBottom: 12, backgroundColor: colors.bgElevated,
  },
  reflectionLabel: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.textMuted, textTransform: 'uppercase', marginBottom: 12 },
  reflectionText: { fontSize: 16, color: colors.textSecondary, lineHeight: 28, fontFamily: font.serif },
  // Insight — light writing surface
  insightCard: {
    borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.lg,
    padding: 20, marginBottom: 12, backgroundColor: colors.bgElevated,
  },
  insightLabel: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.textMuted, textTransform: 'uppercase', marginBottom: 4 },
  insightSub: { fontSize: 13, color: colors.textDim, marginBottom: 14 },
  insightInput: {
    fontSize: 16, color: colors.textPrimary, lineHeight: 26,
    minHeight: 120, textAlignVertical: 'top', paddingBottom: 16,
  },
  insightInputSaved: { color: colors.textSecondary, minHeight: 0 },
  insightLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  insightEditBtn: { fontSize: 13, color: colors.accent, letterSpacing: 0.3 },
  saveBtn: {
    borderWidth: 0.5, borderColor: colors.borderMid, borderRadius: radius.md,
    padding: 18, alignItems: 'center', backgroundColor: colors.bgElevated, marginBottom: 10,
  },
  saveBtnDone: { borderColor: colors.borderMid, backgroundColor: colors.bgElevated },
  saveBtnText: { fontSize: 13, fontWeight: '500', color: colors.textPrimary, letterSpacing: 1, textTransform: 'uppercase' },
  refreshBtn: { padding: 14, alignItems: 'center', marginBottom: 60 },
  refreshBtnText: { fontSize: 12, color: colors.textMuted, letterSpacing: 0.8, textTransform: 'uppercase' },
  generateBtn: {
    borderWidth: 0.5, borderColor: colors.borderMid, borderRadius: radius.md,
    padding: 20, alignItems: 'center', backgroundColor: colors.bgElevated, marginTop: 8,
  },
  generateBtnText: { fontSize: 14, fontWeight: '500', color: colors.textPrimary, letterSpacing: 1, textTransform: 'uppercase' },
  empty: { padding: 60, alignItems: 'center', backgroundColor: colors.bgCard },
  searchBar: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },
  searchInput: { backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.borderMid, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: colors.textPrimary },
  filterRow: { paddingVertical: 6 },
  filterPill: { borderWidth: 0.5, borderColor: colors.border, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: colors.bgCard },
  filterPillActive: { backgroundColor: colors.accentBg, borderColor: colors.accentDim },
  filterPillText: { fontSize: 12, color: colors.textDim, letterSpacing: 0.3 },
  filterPillTextActive: { color: colors.accent },
  filterCount: { fontSize: 12, color: colors.textMuted },
  monthHeader: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: colors.bgDeep, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  monthHeaderText: { fontSize: 11, letterSpacing: 2, color: colors.accent, textTransform: 'uppercase' },
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