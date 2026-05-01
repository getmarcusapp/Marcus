import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TextInput,
  TouchableOpacity, StyleSheet, SafeAreaView, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform, Image, Share,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import SkullLoader from '../components/SkullLoader';
import { colors, radius, spacing, font } from '../constants/theme';
import { getTodayReading, saveTodayReading, saveReadingInsight, getReadingLog, getReadingHistory, getLastVirtueFocus } from '../store/db';
import { getNextPracticeAfter } from '../store/practice-flow';
import { cancelJournalNotification } from '../notifications';
import * as haptics from '../lib/haptics';

const SYSTEM_PROMPT = `You are a curator of Stoic and philosophical wisdom generating a personalized daily reading for a user of a Stoic practice app.

Generate a daily reading in this EXACT JSON format with no other text:
{
  "quote": "the exact quote",
  "author": "Author Name",
  "work": "Title of Work",
  "theme": "2-4 word Stoic theme",
  "virtue": "Wisdom|Courage|Moderation|Justice",
  "event_date": null,
  "event_url": null,
  "reflection": "A 3-4 sentence reflection in second person. Personalize to the user's Virtue focus if provided."
}

Default mode is TIMELESS. Set event_date and event_url to null. Do not use temporal markers (today, yesterday, this week, recently, just announced, etc.).

If the user message includes "TOPICAL MODE", and only then, you may use the web_search tool to find a current event from the past 48 hours, fill event_date with the article's actual publication date (YYYY-MM-DD), and fill event_url with the article URL — both must come from a real search result, never fabricated. If you cannot find a fresh event with a verified URL, fall back to timeless mode for that response.

Sources — never invent or misattribute:
- Core Stoics: Marcus Aurelius (Meditations), Epictetus (Discourses, Enchiridion), Seneca (Letters, Essays), Zeno, Cato, Cleanthes
- Aligned thinkers: Socrates, Aristotle, Heraclitus, Cicero, Viktor Frankl, Montaigne, Stockdale, Boethius, Hadot, Pierre Hadot, Lao Tzu, Confucius

Rules: Vary sources across days. No consecutive same author. Prefer lesser-cited quotes. Match virtue field to user's focus if provided.`;

const TEMPORAL_MARKERS = /\b(today|yesterday|this week|last week|recently|just announced|the latest|earlier this|this morning|tonight|just now|this past|this month|breaking)\b/i;

function isReadingFresh(result) {
  const reflection = result?.reflection || '';
  const hasTemporal = TEMPORAL_MARKERS.test(reflection);
  const eventDate = result?.event_date;
  const eventUrl = result?.event_url;
  if (!hasTemporal && !eventDate) return true;
  if (eventDate) {
    const parsed = new Date(eventDate);
    if (isNaN(parsed.getTime())) return false;
    const ageMs = Date.now() - parsed.getTime();
    if (ageMs > 48 * 60 * 60 * 1000 || ageMs < -24 * 60 * 60 * 1000) return false;
    if (!eventUrl) return false;
    return true;
  }
  return false;
}

function normalizeQuote(q) {
  return (q || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim().slice(0, 80);
}

function findDuplicateQuote(quote, history) {
  const target = normalizeQuote(quote);
  if (!target) return null;
  return history.find(h => normalizeQuote(h.quote) === target) || null;
}

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
  const [mode, setMode] = useState('timeless');

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

  async function generateReading(opts = {}) {
    const topical = !!opts.topical;
    setLoading(true);
    setLoadingPhase(0);
    const phaseTimer = setTimeout(() => setLoadingPhase(1), 4000);
    try {
      const history = await getReadingHistory();
      const virtueFocus = await getLastVirtueFocus();
      const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
      const recentAuthors = history.slice(0, 60).map(r => r.author).filter(Boolean).join(', ');
      const recentQuotes = history.slice(0, 30).map(r => r.quote ? r.quote.substring(0, 80) : '').filter(Boolean).join(' | ');
      const recentReflections = history.slice(0, 14).map((r, i) => r.reflection ? `(${i + 1}) ${r.reflection.substring(0, 160)}` : '').filter(Boolean).join('\n');
      const recentThemes = history.slice(0, 30).map(r => r.theme).filter(Boolean).join(', ');

      async function callOnce({ topicalCall, dedupNote }) {
        const modeLine = topicalCall
          ? 'TOPICAL MODE: Use web_search to find a current event from the past 48 hours, fill event_date and event_url from the actual search result. If no fresh event is found with a verified URL, fall back to timeless for this response.'
          : 'TIMELESS MODE. Set event_date and event_url to null. No temporal markers.';
        const dedupLine = dedupNote ? `\n\n${dedupNote}\n` : '';
        const userMessage = `Today is ${dateStr}. ${modeLine}

${virtueFocus ? `User's current Virtue focus: ${virtueFocus}. Tailor the reading and reflection to that focus.` : ''}

Uniqueness across the user's full reading history is critical. Do NOT reuse:
- Authors recently used: ${recentAuthors || 'none'}
- Quotes recently used (first 80 chars each): ${recentQuotes || 'none'}
- Themes recently used: ${recentThemes || 'none'}
- Reflections recently written:
${recentReflections || 'none'}${dedupLine}
Return only the JSON object.`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000);
        try {
          const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            signal: controller.signal,
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
              tools: topicalCall ? [{ type: 'web_search_20250305', name: 'web_search' }] : undefined,
              messages: [{ role: 'user', content: userMessage }],
            }),
          });
          const data = await response.json();
          if (!response.ok) {
            console.log('Reading API non-OK:', response.status, JSON.stringify(data));
            throw new Error(`API ${response.status}: ${data?.error?.message || 'unknown'}`);
          }
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
          return JSON.parse(stripped.slice(start, end + 1));
        } finally {
          clearTimeout(timeoutId);
        }
      }

      let result = await callOnce({ topicalCall: topical });

      if (topical && !isReadingFresh(result)) {
        console.log('Reading: topical freshness check failed, falling back to timeless. event_date =', result?.event_date);
        result = await callOnce({ topicalCall: false });
      }

      const dup = findDuplicateQuote(result?.quote, history);
      if (dup) {
        const dupDate = dup.date ? new Date(dup.date).toDateString() : 'a previous day';
        console.log('Reading: duplicate quote detected, retrying. Quote:', result.quote?.slice(0, 60), 'first used:', dupDate);
        result = await callOnce({
          topicalCall: false,
          dedupNote: `IMPORTANT: You returned a quote we already used on ${dupDate}: "${(dup.quote || '').slice(0, 120)}". Pick a fundamentally different quote and a different author than that one.`,
        });
      }

      await saveTodayReading(result);
      cancelJournalNotification('reading');
      setReading(result);
      setInsight('');
      setInsightSaved(false);
    } catch (e) {
      const isTimeout = e?.name === 'AbortError';
      console.log('Reading generation failed:', isTimeout ? 'timeout' : e?.message, e);
      Alert.alert(
        '',
        isTimeout
          ? 'The reading is taking longer than expected. Try again?'
          : 'Could not generate reading right now.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Try again', onPress: () => generateReading(opts) },
        ]
      );
    } finally {
      clearTimeout(phaseTimer);
      setLoading(false);
      setLoadingPhase(0);
    }
  }

  async function handleSaveInsight() {
    if (!insight.trim()) return;
    await saveReadingInsight(insight);
    haptics.action();
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

  async function handleShare() {
    if (!reading) return;
    haptics.tap();
    const lines = [
      `"${reading.quote}"`,
      `— ${reading.author}${reading.work ? `, ${reading.work}` : ''}`,
      '',
      reading.reflection,
      '',
      'From Marcus — daily Stoic practice.',
    ];
    try {
      await Share.share({ message: lines.join('\n') });
    } catch (e) {
      console.log('Share failed:', e?.message);
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
                <SkullLoader text={loadingPhase === 0 ? "Searching today's world..." : 'Composing your reading...'} />
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
                    <TouchableOpacity style={s.quoteShareIcon} onPress={handleShare} activeOpacity={0.6} hitSlop={10}>
                      <Ionicons name="share-outline" size={20} color={colors.accent} />
                    </TouchableOpacity>
                    <Text style={[s.quoteText, s.quoteTextWithIcon]}>“{reading.quote}”</Text>
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

                  <View style={s.modeRow}>
                    <TouchableOpacity
                      style={[s.modePill, mode === 'timeless' && s.modePillActive]}
                      onPress={() => { haptics.tap(); setMode('timeless'); }}
                      activeOpacity={0.7}
                    >
                      <Text style={[s.modePillText, mode === 'timeless' && s.modePillTextActive]}>Timeless</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.modePill, mode === 'topical' && s.modePillActive]}
                      onPress={() => { haptics.tap(); setMode('topical'); }}
                      activeOpacity={0.7}
                    >
                      <Text style={[s.modePillText, mode === 'topical' && s.modePillTextActive]}>Topical</Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={s.modeHint}>
                    {mode === 'timeless'
                      ? 'Drawn from the Stoic canon. Untethered to today\'s news.'
                      : "Tied to a current event. Slower; falls back to timeless if no fresh story fits."}
                  </Text>

                  <TouchableOpacity
                    style={s.regenBtn}
                    onPress={() => generateReading({ topical: mode === 'topical' })}
                    activeOpacity={0.8}
                  >
                    <Text style={s.regenBtnText}>Generate new reading</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity style={s.generateBtn} onPress={() => generateReading()} activeOpacity={0.8}>
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
                      const [yr, mo] = mk.split('-');
                      const d = new Date(parseInt(yr, 10), parseInt(mo, 10) - 1, 1);
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
                  <Text style={s.emptyText}>Nothing matches your filter. Adjust your search or open the field wider.</Text>
                </View>
              ) : filteredLog.length === 0 ? (
                <View style={s.empty}>
                  <Text style={s.emptyText}>Your archive is empty. Save your first insight today, and the days will accumulate here.</Text>
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
  tabBtnActive: { backgroundColor: colors.accentBg, borderColor: colors.accentDim },
  tabBtnText: { fontSize: 13, color: colors.textDim, letterSpacing: 0.8, textTransform: 'uppercase' },
  tabBtnTextActive: { color: colors.accent, fontWeight: '500' },
  // Light reading body
  body: { padding: spacing.md, backgroundColor: colors.bgCard },
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
  quoteShareIcon: {
    position: 'absolute', top: 12, right: 12, zIndex: 1,
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 0.5, borderColor: colors.accentDim, backgroundColor: colors.accentBg,
    alignItems: 'center', justifyContent: 'center',
  },
  quoteTextWithIcon: { paddingRight: 40 },
  modeRow: { flexDirection: 'row', gap: 8, marginTop: 24, marginBottom: 8 },
  modeHint: { fontSize: 12, color: colors.textMuted, lineHeight: 18, textAlign: 'center', marginBottom: 14, paddingHorizontal: 8 },
  modePill: {
    flex: 1, borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.md,
    paddingVertical: 10, alignItems: 'center', backgroundColor: colors.bgCard,
  },
  modePillActive: { backgroundColor: colors.accentBg, borderColor: colors.accentDim },
  modePillText: { fontSize: 12, color: colors.textDim, letterSpacing: 1, textTransform: 'uppercase' },
  modePillTextActive: { color: colors.accent },
  regenBtn: {
    borderWidth: 0.5, borderColor: colors.accentDim, borderRadius: radius.md,
    padding: 18, alignItems: 'center', backgroundColor: colors.accentBg, marginBottom: 60,
  },
  regenBtnText: { fontSize: 13, fontWeight: '500', color: colors.accent, letterSpacing: 1, textTransform: 'uppercase' },
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