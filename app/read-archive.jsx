import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TextInput,
  TouchableOpacity, StyleSheet, SafeAreaView,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useMiniPlayerInset } from '../components/MiniMeditationPlayer';
import { ScreenHeader } from '../components/ScreenHeader';
import { colors, radius, spacing, font } from '../constants/theme';
import { getReadingLog } from '../store/db';

const virtueColor = {
  Wisdom: '#7a9aaa',
  Courage: '#aa8a6a',
  Temperance: '#7a9a7a',
  Moderation: '#7a9a7a', // legacy: older entries stored "Moderation" before the rename
  Justice: '#9a8aaa',
};

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

export default function ReadArchiveScreen() {
  const router = useRouter();
  const playerInset = useMiniPlayerInset();
  const params = useLocalSearchParams();
  const fromPath = params?.from
    ? `/read?from=${params.from}&fromLabel=${params?.fromLabel || 'Practice'}`
    : '/read';

  const [log, setLog] = useState([]);
  const [searchQ, setSearchQ] = useState('');
  const [filterAuthor, setFilterAuthor] = useState('all');
  const [filterMonth, setFilterMonth] = useState('all');
  const scrollRef = useRef(null);

  useFocusEffect(useCallback(() => {
    getReadingLog().then(setLog);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, []));

  const authors = ['all', ...new Set(log.map(e => e.reading?.author).filter(Boolean))];
  const availableMonths = [...new Set(log.map(e => {
    const d = new Date(e.date);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }))].sort().reverse();

  const filteredLog = log.filter(e => {
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

  return (
    <SafeAreaView style={s.safe}>
      <ScreenHeader fromPath={fromPath} fromLabel="Back" />
      <ScrollView ref={scrollRef} style={[s.scroll, { backgroundColor: colors.bgCard }]} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 36 + playerInset }}>
        <View style={s.hero}>
          <Text style={s.eyebrow}>Daily Reading</Text>
          <Text style={s.title}>Past readings</Text>
          <Text style={s.sub}>The wisdom you've gathered, day by day</Text>
        </View>

        <View style={s.body}>
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
              <Text style={s.emptyEyebrow}>Ancient wisdom for this day</Text>
              <Text style={s.emptyTitle}>Your archive is empty.</Text>
              <Text style={s.emptyText}>
                Each day, a fresh reading: a real Stoic passage chosen for you, with space to write your own insight before the day begins. Save the first, and the days accumulate here.
              </Text>
            </View>
          ) : (
            groupByMonth(filteredLog).map(group => (
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
  filterRow: { paddingTop: 6, paddingBottom: 18 },
  filterPill: { borderWidth: 0.5, borderColor: colors.border, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: colors.bgCard },
  filterPillActive: { borderColor: colors.accent, backgroundColor: colors.accentBg },
  filterPillText: { fontSize: 12, color: colors.textMuted, letterSpacing: 0.3 },
  filterPillTextActive: { color: colors.accent, fontWeight: '500' },
  filterCount: { fontSize: 12, color: colors.textDim },
  empty: { padding: 40, paddingTop: 56, alignItems: 'center' },
  emptyEyebrow: { fontSize: font.microSize, letterSpacing: 2, color: colors.accent, textTransform: 'uppercase', marginBottom: 16, textAlign: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '400', color: colors.textPrimary, marginBottom: 12, textAlign: 'center', fontFamily: font.serif },
  emptyText: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 22, maxWidth: 320 },
  emptyCta: {
    marginTop: 28,
    borderWidth: 0.5, borderColor: colors.accentDim, borderRadius: radius.md,
    paddingVertical: 14, paddingHorizontal: 22,
    backgroundColor: colors.accentBg,
  },
  emptyCtaText: { fontSize: 13, fontWeight: '500', color: colors.accent, letterSpacing: 1, textTransform: 'uppercase' },
  monthHeader: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 12, backgroundColor: colors.bgDeep, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  monthHeaderText: { fontSize: 11, letterSpacing: 2, color: colors.accent, textTransform: 'uppercase' },
  archiveRow: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24, borderBottomWidth: 0.5, borderBottomColor: colors.border, backgroundColor: colors.bgCard },
  archiveTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  archiveDate: { fontSize: 14, color: colors.textPrimary, fontWeight: '500' },
  archiveVirtue: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5 },
  archiveTheme: { fontSize: 12, color: colors.textDim, letterSpacing: 0.3, marginBottom: 8, textTransform: 'uppercase' },
  archiveQuote: { fontSize: 14, color: colors.textMuted, fontFamily: font.serif, lineHeight: 22, marginBottom: 10 },
  archiveInsightBlock: { borderLeftWidth: 1.5, borderLeftColor: colors.borderMid, paddingLeft: 12, marginTop: 8 },
  archiveInsightLabel: { fontSize: 10, color: colors.textDim, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 },
  archiveInsight: { fontSize: 14, color: colors.textSecondary, lineHeight: 22 },
});
