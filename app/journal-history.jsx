import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TextInput,
  TouchableOpacity, StyleSheet, SafeAreaView,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { colors, radius, spacing, font } from '../constants/theme';
import { virtues } from '../constants/virtues';
import { morningPrompts, eveningPrompts } from '../constants/journalPrompts';
import { JournalEntryEditor } from '../components/JournalEntryEditor';
import { getJournals, updateJournalEntry } from '../store/db';
import { useMiniPlayerInset } from '../components/MiniMeditationPlayer';
import { ScreenHeader } from '../components/ScreenHeader';

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

  useFocusEffect(useCallback(() => {
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
      <ScrollView style={[s.scroll, { backgroundColor: colors.bgCard }]} showsVerticalScrollIndicator={true} contentContainerStyle={{ paddingBottom: 36 + playerInset }}>
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
              placeholderTextColor={colors.textDim}
              value={searchQ}
              onChangeText={setSearchQ}
              clearButtonMode="while-editing"
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

          {filteredHistory.length === 0 && history.length > 0 ? (
            <View style={s.empty}>
              <Text style={s.emptyTitle}>Nothing matches your filter.</Text>
              <Text style={s.emptyText}>Adjust your search or open the field wider.</Text>
            </View>
          ) : filteredHistory.length === 0 ? (
            <View style={s.empty}>
              <Text style={s.emptyIcon}>{isMorning ? '☼' : '☽'}</Text>
              <Text style={s.emptyTitle}>Your {isMorning ? 'mornings' : 'evenings'} are not yet written.</Text>
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
                ))}
              </View>
            ))
          )}
        </View>
      </ScrollView>
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
  eyebrow: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.accent, textTransform: 'uppercase', marginBottom: 8 },
  title: { fontSize: font.titleSize, fontWeight: '300', color: colors.textPrimary, letterSpacing: -0.5, lineHeight: 36 },
  sub: { fontSize: font.subSize, color: colors.textMuted, marginTop: 8 },
  body: { paddingTop: 4 },
  searchBar: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },
  searchInput: { backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.borderMid, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: colors.textPrimary },
  filterRow: { paddingTop: 6, paddingBottom: 6 },
  filterPill: { borderWidth: 0.5, borderColor: colors.border, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: colors.bgCard },
  filterPillActive: { borderColor: colors.accent, backgroundColor: colors.accentBg },
  filterPillText: { fontSize: 12, color: colors.textMuted, letterSpacing: 0.3 },
  filterPillTextActive: { color: colors.accent, fontWeight: '500' },
  sortRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 6, paddingBottom: 8 },
  sortBtn: { paddingVertical: 4 },
  sortBtnText: { fontSize: 12, color: colors.textMuted, letterSpacing: 0.3 },
  filterCount: { fontSize: 12, color: colors.textDim },
  empty: { padding: 40, alignItems: 'center' },
  emptyIcon: { fontSize: 36, color: colors.accentDim, marginBottom: 18 },
  emptyTitle: { fontSize: 18, color: colors.textSecondary, fontFamily: font.serif, marginBottom: 12, textAlign: 'center' },
  emptyText: { fontSize: 14, color: colors.textMuted, lineHeight: 22, textAlign: 'center', marginBottom: 22 },
  emptyCta: { borderWidth: 0.5, borderColor: colors.accentDim, borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: 22, backgroundColor: colors.accentBg },
  emptyCtaText: { fontSize: 13, color: colors.accent, letterSpacing: 0.5, textTransform: 'uppercase' },
  monthHeader: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  monthHeaderText: { fontSize: 11, letterSpacing: 1.5, color: colors.accent, textTransform: 'uppercase', fontWeight: '600' },
  histEntry: { borderTopWidth: 0.5, borderTopColor: colors.border, padding: 16, backgroundColor: colors.bgCard },
  histEntryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  histEntryDate: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
  histEntryVirtue: { fontSize: 11, color: colors.textDim, letterSpacing: 0.5, textTransform: 'capitalize', marginTop: 2 },
  editBtn: { borderWidth: 0.5, borderColor: colors.borderMid, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 4 },
  editBtnText: { fontSize: 11, color: colors.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' },
  histAnswerBlock: { marginTop: 8 },
  histPromptNum: { fontSize: 9, letterSpacing: 1.5, color: colors.accent, textTransform: 'uppercase', marginBottom: 4 },
  histAnswer: { fontSize: 14, color: colors.textSecondary, lineHeight: 22 },
});
