import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TextInput, Image,
  TouchableOpacity, StyleSheet, SafeAreaView,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, font } from '../constants/theme';
import { virtues } from '../constants/virtues';
import { morningPrompts, eveningPrompts } from '../constants/journalPrompts';
import { JournalEntryEditor } from '../components/JournalEntryEditor';
import { useEntitlement } from '../lib/useEntitlement';
import { getJournals, updateJournalEntry } from '../store/db';
import { useMiniPlayerInset } from '../components/MiniMeditationPlayer';
import { ScreenHeader } from '../components/ScreenHeader';
import { GoldSecondary } from '../components/GoldButton';

// Group entries by month for chronological browsing
function groupByMonth(entries) {
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

export default function JournalHistoryScreen() {
  const router = useRouter();
  const { hasAccess } = useEntitlement();
  const playerInset = useMiniPlayerInset();
  const params = useLocalSearchParams();
  // ?type=morning|evening sets which set of entries to show; defaults
  // to morning if absent.
  const sessionType = params?.type === 'evening' ? 'evening' : 'morning';
  const isMorning = sessionType === 'morning';
  const prompts = isMorning ? morningPrompts : eveningPrompts;
  const fromPath = params?.from ? `/journal?type=${sessionType}&from=${params.from}&fromLabel=${params?.fromLabel || 'Practice'}` : `/journal?type=${sessionType}`;

  const [history, setHistory] = useState([]);
  const [searchQ, setSearchQ] = useState('');
  const [filterVirtue, setFilterVirtue] = useState('all');
  const [filterMonth, setFilterMonth] = useState('all');
  const [sortMode, setSortMode] = useState('date');
  const [editingEntry, setEditingEntry] = useState(null);
  const scrollRef = useRef(null);

  useFocusEffect(useCallback(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    (async () => {
      const all = await getJournals();
      setHistory(all.filter(j => j.type === sessionType));
    })();
  }, [sessionType]));

  // Available months drawn from the entries themselves so the filter
  // pills only show months the user actually has writing in.
  const availableMonths = Array.from(new Set(history.map(e => {
    const d = new Date(e.date);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }))).sort().reverse();

  const filteredHistory = history
    .filter(e => {
      if (filterVirtue !== 'all' && e.virtue !== filterVirtue) return false;
      if (filterMonth !== 'all') {
        const d = new Date(e.date);
        const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
        if (key !== filterMonth) return false;
      }
      if (searchQ.trim()) {
        const q = searchQ.toLowerCase();
        const text = Object.values(e.answers || {}).join(' ').toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortMode === 'virtue') return (a.virtue || '').localeCompare(b.virtue || '');
      return new Date(b.date) - new Date(a.date);
    });

  async function handleEditSave(updated) {
    await updateJournalEntry(updated);
    const all = await getJournals();
    setHistory(all.filter(j => j.type === sessionType));
    setEditingEntry(null);
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScreenHeader fromPath={fromPath} fromLabel="Back" />
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.bgCard }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
      <ScrollView
        ref={scrollRef}
        style={[s.scroll, { backgroundColor: colors.bgCard }]}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 36 + playerInset }}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <View style={s.hero}>
          <Text style={s.eyebrow}>{isMorning ? 'Morning Journal' : 'Evening Journal'}</Text>
          <Text style={s.title}>Past entries</Text>
          <Text style={s.sub}>The examined life, recorded</Text>
        </View>

        <View style={s.body}>
          <View style={s.searchBar}>
            <TextInput
              style={s.searchInput}
              placeholder="Search entries..."
              placeholderTextColor={colors.textSecondary}
              value={searchQ}
              onChangeText={setSearchQ}
              clearButtonMode="while-editing"
              keyboardAppearance="dark"
            />
          </View>
          <View style={s.filterRow}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingBottom: 4 }}>
              {['all', ...virtues.map(v => v.id)].map(v => (
                <TouchableOpacity
                  key={v}
                  style={[s.filterPill, filterVirtue === v && s.filterPillActive]}
                  onPress={() => setFilterVirtue(v)}
                  activeOpacity={0.7}
                >
                  <Text style={[s.filterPillText, filterVirtue === v && s.filterPillTextActive]}>
                    {v === 'all' ? 'All Virtues' : virtues.find(x => x.id === v)?.name || v}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
          {availableMonths.length > 1 && (
            <View style={[s.filterRow, { paddingTop: 0 }]}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingBottom: 4 }}>
                <TouchableOpacity
                  style={[s.filterPill, filterMonth === 'all' && s.filterPillActive]}
                  onPress={() => setFilterMonth('all')}
                  activeOpacity={0.7}
                >
                  <Text style={[s.filterPillText, filterMonth === 'all' && s.filterPillTextActive]}>All time</Text>
                </TouchableOpacity>
                {availableMonths.map(mk => {
                  const [yr, mo] = mk.split('-');
                  const d = new Date(parseInt(yr, 10), parseInt(mo, 10) - 1, 1);
                  const label = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                  return (
                    <TouchableOpacity
                      key={mk}
                      style={[s.filterPill, filterMonth === mk && s.filterPillActive]}
                      onPress={() => setFilterMonth(mk)}
                      activeOpacity={0.7}
                    >
                      <Text style={[s.filterPillText, filterMonth === mk && s.filterPillTextActive]}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}
          <View style={s.sortRow}>
            <TouchableOpacity onPress={() => setSortMode(sortMode === 'date' ? 'virtue' : 'date')} style={s.sortBtn}>
              <Text style={s.sortBtnText}>Sort: {sortMode === 'date' ? 'Date ↓' : 'Virtue A–Z'}</Text>
            </TouchableOpacity>
            {filteredHistory.length !== history.length && (
              <Text style={s.filterCount}>{filteredHistory.length} of {history.length}</Text>
            )}
          </View>

          {editingEntry ? (
            // When an entry is being edited, hide all OTHER entries so the
            // editor card is the only thing competing for vertical space
            // above the keyboard. Avoids the "lots of other entries visible
            // between the active input and the keyboard" feel.
            <JournalEntryEditor
              entry={editingEntry}
              onSave={handleEditSave}
              onCancel={() => setEditingEntry(null)}
            />
          ) : filteredHistory.length === 0 && history.length > 0 ? (
            <View style={s.empty}>
              <Text style={s.emptyTitle}>Nothing matches your filter.</Text>
              <Text style={s.emptyText}>Adjust your search or open the field wider.</Text>
            </View>
          ) : filteredHistory.length === 0 ? (
            <View style={s.empty}>
              <Image
                source={isMorning
                  ? require('../assets/heroes/journal-morning.jpg')
                  : require('../assets/heroes/journal-evening.jpg')}
                style={s.emptyImage}
                resizeMode="cover"
              />
              <Text style={s.emptyEyebrow}>{isMorning ? 'Morning practice' : 'Evening reckoning'}</Text>
              <Text style={s.emptyTitle}>Your {isMorning ? 'mornings' : 'evenings'} are not yet written</Text>
              <Text style={s.emptyText}>
                {isMorning
                  ? 'Four prompts each morning — what is in your control, where courage is required, what you are postponing, what difficulty might arise. Begin one when you are ready.'
                  : 'Four movements each evening — where you acted with Virtue, where you fell short, what you are carrying, and one thing that deserves your thanks.'}
              </Text>
            </View>
          ) : (
            groupByMonth(filteredHistory).map(group => (
              <View key={group.label}>
                <View style={s.monthHeader}><Text style={s.monthHeaderText}>{group.label}</Text></View>
                {group.entries.map(entry => (
                  <View key={entry.id}>
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
                          <GoldSecondary
                            style={s.editBtn}
                            onPress={() => hasAccess ? setEditingEntry(entry) : router.push('/paywall')}
                            contentStyle={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                            borderWidth={0.5}
                            flatStroke
                          >
                            <Ionicons name="create-outline" size={12} color={colors.accent} />
                            <Text style={s.editBtnText}>Edit</Text>
                          </GoldSecondary>
                        </View>
                        {/* The Reckoning (evening entries that audited a
                            morning commitment) leads, with the morning's
                            words as context. */}
                        {entry.answers?.reckon?.trim() ? (
                          <View style={s.histAnswerBlock}>
                            <Text style={s.histPromptNum}>This morning</Text>
                            {entry.reckonOf ? (
                              <Text style={s.histReckonOf}>“{entry.reckonOf}”</Text>
                            ) : null}
                            <Text style={s.histAnswer}>{entry.answers.reckon}</Text>
                          </View>
                        ) : null}
                        {Object.entries(entry.answers || {}).map(([idx, answer]) => {
                          if (idx === 'reckon') return null;
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
                  </View>
                ))}
              </View>
            ))
          )}
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgDeep },
  scroll: { flex: 1 },
  hero: {
    backgroundColor: colors.bgDeep,
    padding: spacing.xl,
    paddingTop: 52,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  eyebrow: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.accent, fontFamily: font.bodyMedium, textTransform: 'uppercase', marginBottom: 8 },
  title: { fontSize: font.titleSize, fontFamily: font.display, color: colors.textPrimary, letterSpacing: -0.5, lineHeight: 36 },
  sub: { fontSize: font.subSize, color: colors.textSecondary, marginTop: 8 },
  body: { paddingTop: 4 },
  searchBar: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },
  searchInput: { backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: colors.textPrimary, fontFamily: font.body },
  filterRow: { paddingTop: 6, paddingBottom: 6 },
  filterPill: { borderWidth: 0.5, borderColor: colors.border, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: colors.bgCard },
  filterPillActive: { borderColor: colors.accent, backgroundColor: colors.bg },
  filterPillText: { fontSize: 12, color: colors.textSecondary, letterSpacing: 0.3 },
  filterPillTextActive: { color: colors.accent, fontFamily: font.bodyMedium },
  sortRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 6, paddingBottom: 8 },
  sortBtn: { paddingVertical: 4 },
  sortBtnText: { fontSize: 12, color: colors.textSecondary, letterSpacing: 0.3 },
  filterCount: { fontSize: 12, color: colors.textSecondary },
  empty: { padding: 40, paddingTop: 56, alignItems: 'center' },
  emptyImage: { width: 180, height: 108, borderRadius: 12, marginBottom: 24 },
  emptyEyebrow: { fontSize: font.labelSize, letterSpacing: 2, color: colors.accent, fontFamily: font.bodyMedium, textTransform: 'uppercase', marginBottom: 16, textAlign: 'center' },
  emptyTitle: { fontSize: 26, color: colors.textPrimary, fontFamily: font.display, letterSpacing: -0.5, lineHeight: 32, marginBottom: 14, textAlign: 'center' },
  emptyText: { fontSize: 14, color: colors.textSecondary, lineHeight: 22, textAlign: 'center', marginBottom: 22 },
  emptyCta: { borderWidth: 0.5, borderColor: colors.accentDim, borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: 22, backgroundColor: colors.bg },
  emptyCtaText: { fontSize: 13, color: colors.accent, letterSpacing: 0.5, fontFamily: font.bodyMedium, textTransform: 'uppercase' },
  monthHeader: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  monthHeaderText: { fontSize: 11, letterSpacing: 1.5, color: colors.accent, fontFamily: font.bodyMedium, textTransform: 'uppercase' },
  histEntry: { borderTopWidth: 0.5, borderTopColor: colors.border, padding: 16, backgroundColor: colors.bgCard },
  histEntryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  histEntryDate: { fontSize: 13, color: colors.textSecondary, fontFamily: font.bodyMedium },
  histEntryVirtue: { fontSize: 11, color: colors.textSecondary, letterSpacing: 0.5, textTransform: 'capitalize', marginTop: 2 },
  // Canonical EDIT chip — matches compass roleDeleteChip / compassPreviewEdit
  // (gold border, gold text + create-outline glyph, radius.md).
  editBtn: { borderRadius: 4, paddingHorizontal: 10, paddingVertical: 5 },
  editBtnText: { fontSize: 12, color: colors.accent, letterSpacing: 0.3 },
  histAnswerBlock: { marginTop: 8 },
  histPromptNum: { fontSize: 9, letterSpacing: 1.5, color: colors.accent, fontFamily: font.bodyMedium, textTransform: 'uppercase', marginBottom: 4 },
  histAnswer: { fontSize: 14, color: colors.textSecondary, lineHeight: 22 },
  // The morning commitment a reckoning answered — quoted context line.
  histReckonOf: { fontSize: 13, color: colors.textPrimary, fontFamily: font.bodyLightItalic, fontStyle: 'italic', lineHeight: 19, marginBottom: 4 },
});
