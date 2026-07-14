import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TextInput, Image,
  TouchableOpacity, StyleSheet, SafeAreaView,
  Platform, InputAccessoryView, Keyboard,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMiniPlayerInset } from '../components/MiniMeditationPlayer';
import { ScreenHeader } from '../components/ScreenHeader';
import { colors, radius, spacing, font } from '../constants/theme';
import { getReadingLog, updateReadingInsight } from '../store/db';
import { useEntitlement } from '../lib/useEntitlement';
import { useCaretScroll } from '../lib/useCaretScroll';
import { GoldPrimary, GoldSecondary } from '../components/GoldButton';

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
  const { hasAccess } = useEntitlement();
  const playerInset = useMiniPlayerInset();
  const params = useLocalSearchParams();
  const fromPath = params?.from
    ? `/read?from=${params.from}&fromLabel=${params?.fromLabel || 'Practice'}`
    : '/read';

  const [log, setLog] = useState([]);
  const [searchQ, setSearchQ] = useState('');
  const [filterAuthor, setFilterAuthor] = useState('all');
  const [filterMonth, setFilterMonth] = useState('all');
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState('');
  const scrollRef = useRef(null);
  // Keep the caret above the keyboard + accessory bar as the edited insight
  // grows line by line (iOS only auto-scrolls on focus, not on caret wrap).
  const { onScroll, onGrow } = useCaretScroll(scrollRef);

  async function handleEditSave() {
    if (!editingId) return;
    await updateReadingInsight(editingId, editDraft);
    const refreshed = await getReadingLog();
    setLog(refreshed);
    setEditingId(null);
    setEditDraft('');
  }

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
      {/* Keyboard insets are owned by the ScrollView's
          automaticallyAdjustKeyboardInsets — a KeyboardAvoidingView stacked
          on top double-compensated during the keyboard animation. */}
      <View style={{ flex: 1, backgroundColor: colors.bgCard }}>
      <ScrollView
        ref={scrollRef}
        style={[s.scroll, { backgroundColor: colors.bgCard }]}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 36 + playerInset }}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
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
              placeholderTextColor={colors.textSecondary}
              value={searchQ}
              onChangeText={setSearchQ}
              clearButtonMode="while-editing"
              keyboardAppearance="dark"
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
              <Image source={require('../assets/heroes/read.jpg')} style={s.emptyImage} resizeMode="cover" />
              <Text style={s.emptyEyebrow}>Ancient wisdom for this day</Text>
              <Text style={s.emptyTitle}>Your archive is empty</Text>
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
                {group.entries.map(entry => {
                  const isEditing = editingId === entry.id;
                  return (
                  <View key={entry.id} style={s.archiveRow}>
                    <View style={s.archiveTop}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.archiveDate}>
                          {new Date(entry.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        </Text>
                        {entry.reading?.virtue && (
                          <Text style={[s.archiveVirtue, { color: virtueColor[entry.reading.virtue] || colors.textSecondary, marginTop: 2 }]}>
                            {entry.reading.virtue}
                          </Text>
                        )}
                      </View>
                      {!isEditing && (
                        <GoldSecondary
                          style={s.editBtn}
                          onPress={() => hasAccess ? (setEditingId(entry.id), setEditDraft(entry.insight || '')) : router.push('/paywall')}
                          contentStyle={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                          borderWidth={0.5}
                          flatStroke
                        >
                          <Ionicons name="create-outline" size={12} color={colors.accent} />
                          <Text style={s.editBtnText}>Edit</Text>
                        </GoldSecondary>
                      )}
                    </View>
                    {entry.reading?.theme && (
                      <Text style={s.archiveTheme}>{entry.reading.theme}</Text>
                    )}
                    {entry.reading?.quote && (
                      <Text style={s.archiveQuote}>
                        "{entry.reading.quote.length > 100 ? `${entry.reading.quote.slice(0, 100)}…` : entry.reading.quote}"
                      </Text>
                    )}
                    {isEditing ? (
                      <View style={s.archiveInsightBlock}>
                        <Text style={s.archiveInsightLabel}>Your insight</Text>
                        <TextInput
                          style={s.archiveInsightInput}
                          multiline
                          value={editDraft}
                          onChangeText={setEditDraft}
                          onContentSizeChange={onGrow('insight')}
                          placeholder="Write your reflection..."
                          placeholderTextColor={colors.textSecondary}
                          scrollEnabled={false}
                          autoFocus
                          inputAccessoryViewID={Platform.OS === 'ios' ? 'readArchiveInsightAccessory' : undefined}
                          keyboardAppearance="dark"
                        />
                      </View>
                    ) : entry.insight && (
                      <View style={s.archiveInsightBlock}>
                        <Text style={s.archiveInsightLabel}>Your insight</Text>
                        <Text style={s.archiveInsight}>{entry.insight}</Text>
                      </View>
                    )}
                  </View>
                  );
                })}
              </View>
            ))
          )}
        </View>
      </ScrollView>
      </View>
      {Platform.OS === 'ios' && editingId && (
        <InputAccessoryView nativeID="readArchiveInsightAccessory">
          <View style={s.accessoryBarPair}>
            <GoldSecondary
              style={s.editBtnAccessory}
              onPress={() => { Keyboard.dismiss(); setEditingId(null); setEditDraft(''); }}
            >
              <Text style={s.editBtnAccessoryText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>Cancel</Text>
            </GoldSecondary>
            <GoldPrimary
              style={s.editBtnAccessory}
              onPress={() => { Keyboard.dismiss(); handleEditSave(); }}
            >
              <Text style={[s.editBtnAccessoryText, s.editBtnAccessorySaveText]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>Save</Text>
            </GoldPrimary>
          </View>
        </InputAccessoryView>
      )}
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
  filterRow: { paddingTop: 6, paddingBottom: 18 },
  filterPill: { borderWidth: 0.5, borderColor: colors.border, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: colors.bgCard },
  filterPillActive: { borderColor: colors.accent, backgroundColor: colors.bg },
  filterPillText: { fontSize: 12, color: colors.textSecondary, letterSpacing: 0.3 },
  filterPillTextActive: { color: colors.accent, fontFamily: font.bodyMedium },
  filterCount: { fontSize: 12, color: colors.textSecondary },
  empty: { padding: 40, paddingTop: 56, alignItems: 'center' },
  emptyEyebrow: { fontSize: font.labelSize, letterSpacing: 2, color: colors.accent, fontFamily: font.bodyMedium, textTransform: 'uppercase', marginBottom: 16, textAlign: 'center' },
  emptyImage: { width: 180, height: 108, borderRadius: 12, marginBottom: 24 },
  emptyTitle: { fontSize: 26, color: colors.textPrimary, marginBottom: 14, textAlign: 'center', fontFamily: font.display, letterSpacing: -0.5, lineHeight: 32 },
  emptyText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 22, maxWidth: 320 },
  emptyCta: {
    marginTop: 28,
    borderWidth: 0.5, borderColor: colors.accentDim, borderRadius: radius.md,
    paddingVertical: 14, paddingHorizontal: 22,
    backgroundColor: colors.bg,
  },
  emptyCtaText: { fontSize: 13, fontFamily: font.bodyMedium, color: colors.accent, letterSpacing: 1, textTransform: 'uppercase' },
  monthHeader: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 12, backgroundColor: colors.bgDeep, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  monthHeaderText: { fontSize: 11, letterSpacing: 2, color: colors.accent, fontFamily: font.bodyMedium, textTransform: 'uppercase' },
  archiveRow: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24, borderBottomWidth: 0.5, borderBottomColor: colors.border, backgroundColor: colors.bgCard },
  archiveTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  archiveDate: { fontSize: 14, color: colors.textPrimary, fontFamily: font.bodyMedium },
  archiveVirtue: { fontSize: 12, fontFamily: font.bodySemiBold, letterSpacing: 0.5 },
  archiveTheme: { fontSize: 12, color: colors.textSecondary, letterSpacing: 0.3, marginBottom: 8, fontFamily: font.bodyMedium, textTransform: 'uppercase' },
  archiveQuote: { fontSize: 14, color: colors.textSecondary, fontFamily: font.bodyLightItalic, fontStyle: 'italic', lineHeight: 22, marginBottom: 10 },
  archiveInsightBlock: { borderLeftWidth: 1.5, borderLeftColor: colors.border, paddingLeft: 12, marginTop: 8 },
  archiveInsightLabel: { fontSize: 11, color: colors.textSecondary, letterSpacing: 1.5, fontFamily: font.bodyMedium, textTransform: 'uppercase', marginBottom: 4 },
  archiveInsight: { fontSize: 14, color: colors.textSecondary, lineHeight: 22 },
  archiveInsightInput: { fontSize: 14, color: colors.textPrimary, lineHeight: 22, minHeight: 48, textAlignVertical: 'top', fontFamily: font.body },
  // Library EDIT chip — matches journal-history / emotions-history / review-archive.
  editBtn: { borderRadius: 4, paddingHorizontal: 10, paddingVertical: 5 },
  editBtnText: { fontSize: 12, color: colors.accent, letterSpacing: 0.3 },
  // Library keyboard accessory bar — H44 outlined + filled-gold pair used
  // when editing a past insight (matches compass / journal / emotions / review).
  accessoryBarPair: {
    flexDirection: 'row', gap: 10, backgroundColor: colors.bg,
    borderTopWidth: 0.5, borderTopColor: colors.border,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  editBtnAccessory: {
    flex: 1, height: 44, borderRadius: radius.md,
    paddingHorizontal: 16,
  },
  editBtnAccessorySave: { backgroundColor: colors.accent },
  editBtnAccessoryText: { fontSize: 14, fontFamily: font.bodyMedium, color: colors.accent, letterSpacing: 0.3 },
  editBtnAccessorySaveText: { color: '#1a1a1a' },
});
