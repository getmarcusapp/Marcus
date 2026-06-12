import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TextInput, Image,
  TouchableOpacity, StyleSheet, SafeAreaView, Alert,
  Platform, InputAccessoryView, Keyboard,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, font } from '../constants/theme';
import { emotions } from '../constants/virtues';
import { EMOTION_COLORS, DISTORTIONS } from '../constants/emotionsData';
import { getTriggers, updateTriggerEntry } from '../store/db';
import * as haptics from '../lib/haptics';
import { useEntitlement } from '../lib/useEntitlement';
import { useMiniPlayerInset } from '../components/MiniMeditationPlayer';
import { ScreenHeader } from '../components/ScreenHeader';
import { GoldPrimary, GoldSecondary } from '../components/GoldButton';

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

export default function EmotionsHistoryScreen() {
  const router = useRouter();
  const { hasAccess } = useEntitlement();
  const playerInset = useMiniPlayerInset();
  const scrollRef = useRef(null);

  const [history, setHistory] = useState([]);
  const [searchQ, setSearchQ] = useState('');
  const [filterEmotion, setFilterEmotion] = useState('all');
  const [filterIntensity, setFilterIntensity] = useState(0); // 0 = all, 7 = high only
  const [sortMode, setSortMode] = useState('date'); // 'date' | 'intensity'
  const [editingEntry, setEditingEntry] = useState(null);

  useFocusEffect(useCallback(() => {
    getTriggers().then(setHistory);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, []));

  async function handleEditSave(updated) {
    const ok = await updateTriggerEntry(updated);
    if (ok) {
      const updated2 = await getTriggers();
      setHistory(updated2);
      setEditingEntry(null);
      Alert.alert('', 'Entry updated.');
    }
  }

  const filteredHistory = history
    .filter(e => {
      if (filterEmotion !== 'all' && e.emotion !== filterEmotion) return false;
      if (filterIntensity > 0 && (e.intensity || 0) < filterIntensity) return false;
      if (searchQ.trim()) {
        const q = searchQ.toLowerCase();
        const text = [e.trigger, e.reaction, e.chosenResponse].join(' ').toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => sortMode === 'intensity'
      ? (b.intensity || 0) - (a.intensity || 0)
      : new Date(b.date) - new Date(a.date)
    );

  return (
    <SafeAreaView style={s.safe}>
      <ScreenHeader fromPath="/emotions" fromLabel="Back" />
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
      >
        <View style={s.hero}>
          <Text style={s.eyebrow}>Emotional mastery</Text>
          <Text style={s.title}>Past triggers</Text>
          <Text style={s.sub}>Patterns reveal what single moments cannot</Text>
        </View>

        <View style={s.body}>
          <View style={s.searchBar}>
            <TextInput
              style={s.searchInput}
              placeholder="Search triggers..."
              placeholderTextColor={colors.textSecondary}
              value={searchQ}
              onChangeText={setSearchQ}
              clearButtonMode="while-editing"
              keyboardAppearance="dark"
            />
          </View>
          <View style={s.filterRow}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingBottom: 4 }}>
              {['all', ...emotions.map(e => e.id)].map(em => (
                <TouchableOpacity
                  key={em}
                  style={[s.filterPill, filterEmotion === em && s.filterPillActive]}
                  onPress={() => setFilterEmotion(em)}
                  activeOpacity={0.7}
                >
                  <Text style={[s.filterPillText, filterEmotion === em && s.filterPillTextActive]}>
                    {em === 'all' ? 'All emotions' : emotions.find(x => x.id === em)?.label || em}
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={[s.filterPill, filterIntensity >= 7 && s.filterPillActive]}
                onPress={() => setFilterIntensity(filterIntensity >= 7 ? 0 : 7)}
                activeOpacity={0.7}
              >
                <Text style={[s.filterPillText, filterIntensity >= 7 && s.filterPillTextActive]}>High intensity</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
          <View style={s.sortRow}>
            <TouchableOpacity onPress={() => setSortMode(sortMode === 'date' ? 'intensity' : 'date')} style={s.sortBtn}>
              <Text style={s.sortBtnText}>Sort: {sortMode === 'date' ? 'Date ↓' : 'Intensity ↓'}</Text>
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
              <Image source={require('../assets/heroes/emotions.jpg')} style={s.emptyImage} resizeMode="cover" />
              <Text style={s.emptyEyebrow}>The space between stimulus and response</Text>
              <Text style={s.emptyTitle}>Nothing logged yet</Text>
              <Text style={s.emptyText}>
                When a strong emotion arises, open the logger before you react. Name it, rate it, describe what triggered it. Then read the Stoic reframe. The practice lives in that pause.
              </Text>
            </View>
          ) : (
            groupByMonth(filteredHistory).map(group => (
              <View key={group.label}>
                <View style={s.monthHeader}><Text style={s.monthHeaderText}>{group.label}</Text></View>
                {group.entries.map(entry => {
                  const ec = EMOTION_COLORS[entry.emotion] || EMOTION_COLORS.other;

                  if (editingEntry?.id === entry.id) {
                    return (
                      <View key={entry.id} style={[s.editCard, { borderColor: ec.border }]}>
                        <View style={[s.editCardHeader, { backgroundColor: ec.tint }]}>
                          <Text style={[s.editCardTitle, { color: ec.border }]}>Editing · {entry.emotion}</Text>
                          <TouchableOpacity
                            onPress={() => { Keyboard.dismiss(); handleEditSave(editingEntry); }}
                            activeOpacity={0.7}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Text style={[s.editCardDone, { color: ec.border }]}>Done</Text>
                          </TouchableOpacity>
                        </View>
                        <View style={s.editCardBody}>
                          <Text style={s.editFieldLabel}>What triggered it?</Text>
                          <TextInput
                            style={s.editFieldInput}
                            multiline
                            inputAccessoryViewID={Platform.OS === 'ios' ? 'emoHistEditAccessory' : undefined}
                            value={editingEntry.trigger}
                            onChangeText={text => setEditingEntry(prev => ({ ...prev, trigger: text }))}
                            placeholderTextColor={colors.textSecondary}
                            scrollEnabled={false}
                            keyboardAppearance="dark"
                          />
                          <View style={s.editDivider} />
                          <Text style={s.editFieldLabel}>My automatic reaction</Text>
                          <TextInput
                            style={s.editFieldInput}
                            multiline
                            inputAccessoryViewID={Platform.OS === 'ios' ? 'emoHistEditAccessory' : undefined}
                            value={editingEntry.reaction || ''}
                            onChangeText={text => setEditingEntry(prev => ({ ...prev, reaction: text }))}
                            placeholderTextColor={colors.textSecondary}
                            scrollEnabled={false}
                            keyboardAppearance="dark"
                          />
                          <View style={s.editDivider} />
                          <Text style={s.editFieldLabel}>
                            {editingEntry.timing === 'now' ? 'How will I respond?' : 'How should I have responded?'}
                          </Text>
                          <TextInput
                            style={s.editFieldInput}
                            multiline
                            inputAccessoryViewID={Platform.OS === 'ios' ? 'emoHistEditAccessory' : undefined}
                            value={editingEntry.chosenResponse || ''}
                            onChangeText={text => setEditingEntry(prev => ({ ...prev, chosenResponse: text }))}
                            placeholderTextColor={colors.textSecondary}
                            scrollEnabled={false}
                            keyboardAppearance="dark"
                          />
                          <View style={s.editDivider} />
                          <Text style={s.editFieldLabel}>Cognitive distortions</Text>
                          <Text style={[s.editFieldLabel, { fontSize: 12, color: colors.textSecondary, fontFamily: font.body, marginTop: -8, marginBottom: 12 }]}>Tap to add or remove</Text>
                          <View style={s.distortionGrid}>
                            {DISTORTIONS.map(d => {
                              const isSelected = (editingEntry.distortions || []).includes(d.id);
                              return (
                                <TouchableOpacity
                                  key={d.id}
                                  style={[s.distortionPill, isSelected && { backgroundColor: ec.tint, borderColor: ec.border }]}
                                  onPress={() => {
                                    haptics.tap();
                                    const current = editingEntry.distortions || [];
                                    const updated = isSelected
                                      ? current.filter(x => x !== d.id)
                                      : [...current, d.id];
                                    setEditingEntry(prev => ({ ...prev, distortions: updated }));
                                  }}
                                  activeOpacity={0.7}
                                >
                                  <Text style={[s.distortionLabel, isSelected && { color: ec.border }]}>{d.label}</Text>
                                  <Text style={[s.distortionQ, isSelected && { color: ec.border }]}>{d.q}</Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        </View>
                      </View>
                    );
                  }

                  return (
                    <View key={entry.id} style={s.histRow}>
                      <View style={s.histTop}>
                        <View>
                          <Text style={s.histDate}>
                            {new Date(entry.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                          </Text>
                          <Text style={[s.histEmotionLine, { color: ec.border }]}>
                            {entry.emotion}{entry.timing ? ` · ${entry.timing === 'now' ? 'In the moment' : 'After the fact'}` : ''}
                          </Text>
                        </View>
                        <GoldSecondary
                          style={s.histEditBtn}
                          onPress={() => hasAccess ? setEditingEntry({ ...entry }) : router.push('/paywall')}
                          contentStyle={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                          borderWidth={0.5}
                          flatStroke
                        >
                          <Ionicons name="create-outline" size={12} color={colors.accent} />
                          <Text style={s.histEditBtnText}>Edit</Text>
                        </GoldSecondary>
                      </View>
                      <Text style={s.histIntensity}>Intensity {entry.intensity}/10</Text>
                      {entry.distortions && entry.distortions.length > 0 && (
                        <View style={s.histDistortions}>
                          {entry.distortions.map(d => (
                            <View key={d} style={[s.histDistortionTag, { borderColor: ec.border, backgroundColor: ec.tint }]}>
                              <Text style={[s.histDistortionText, { color: ec.border }]}>{d.replace('_', ' ')}</Text>
                            </View>
                          ))}
                        </View>
                      )}
                      <Text style={s.histTrigger}>{entry.trigger}</Text>
                      {entry.chosenResponse ? (
                        <Text style={s.histResponse}>"{entry.chosenResponse}"</Text>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            ))
          )}
        </View>
      </ScrollView>
      </View>
      {Platform.OS === 'ios' && editingEntry && (
        <InputAccessoryView nativeID="emoHistEditAccessory">
          <View style={s.accessoryBarPair}>
            <GoldSecondary onPress={() => { Keyboard.dismiss(); setEditingEntry(null); }} style={s.editBtn}>
              <Text style={s.editBtnText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>Cancel</Text>
            </GoldSecondary>
            <GoldPrimary
              onPress={() => { Keyboard.dismiss(); handleEditSave(editingEntry); }}
              style={s.editBtn}
            >
              <Text style={[s.editBtnText, s.editBtnSaveText]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>Save changes</Text>
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
  filterRow: { paddingTop: 6, paddingBottom: 6 },
  filterPill: { borderWidth: 0.5, borderColor: colors.border, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: colors.bgCard },
  filterPillActive: { borderColor: colors.accent, backgroundColor: colors.bg },
  filterPillText: { fontSize: 12, color: colors.textSecondary, letterSpacing: 0.3 },
  filterPillTextActive: { color: colors.accent, fontFamily: font.bodyMedium },
  sortRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 6, paddingBottom: 8 },
  sortBtn: { paddingVertical: 4 },
  sortBtnText: { fontSize: 12, color: colors.textSecondary, letterSpacing: 0.3 },
  filterCount: { fontSize: 12, color: colors.textSecondary },
  empty: { padding: 40, paddingTop: 56, alignItems: 'center', backgroundColor: colors.bgCard },
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
  monthHeader: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: colors.bgDeep, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  monthHeaderText: { fontSize: 11, letterSpacing: 2, color: colors.accent, fontFamily: font.bodyMedium, textTransform: 'uppercase' },
  // Past-entry row layout mirrors journal-history: date + emotion subtitle on
  // the left, library EDIT chip on the right (top-aligned), content below.
  histRow: { padding: 18, borderBottomWidth: 0.5, borderBottomColor: colors.border, backgroundColor: colors.bgCard },
  histTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  histDate: { fontSize: 13, color: colors.textSecondary, fontFamily: font.bodyMedium },
  histEmotionLine: { fontSize: 11, letterSpacing: 0.5, textTransform: 'capitalize', marginTop: 2 },
  histIntensity: { fontSize: 12, color: colors.textSecondary, marginBottom: 6 },
  histDistortions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  histDistortionTag: { borderWidth: 0.5, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3 },
  histDistortionText: { fontSize: 11, textTransform: 'capitalize', letterSpacing: 0.3, fontFamily: font.bodyMedium },
  histTrigger: { fontSize: 15, color: colors.textSecondary, lineHeight: 23 },
  histResponse: { fontSize: 14, color: colors.textSecondary, marginTop: 8, lineHeight: 22 },
  // Canonical EDIT chip — matches compass roleDeleteChip / journal-history editBtn
  // (gold border, gold text + create-outline glyph).
  histEditBtn: { borderRadius: 4, paddingHorizontal: 10, paddingVertical: 5 },
  histEditBtnText: { fontSize: 12, color: colors.accent, letterSpacing: 0.3 },
  editCard: { borderWidth: 1, borderRadius: radius.md, marginBottom: 12, marginHorizontal: 16, overflow: 'hidden' },
  editCardHeader: { padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  editCardTitle: { fontSize: 13, letterSpacing: 0.8, fontFamily: font.bodyMedium, textTransform: 'uppercase' },
  editCardDate: { fontSize: 12, color: colors.textSecondary },
  // Header "Done" tap — saves + closes when keyboard is down (e.g. user
  // only tweaked distortion pills). Keyboard-up exits go through the
  // accessory bar's Cancel/Save changes pair below.
  editCardDone: { fontSize: 13, letterSpacing: 0.8, fontFamily: font.bodyMedium, textTransform: 'uppercase' },
  editCardBody: { padding: 16, backgroundColor: colors.inputBg },
  editFieldLabel: { fontSize: font.labelSize, letterSpacing: 2, color: colors.textSecondary, fontFamily: font.bodyMedium, textTransform: 'uppercase', marginBottom: 10 },
  editFieldInput: { fontSize: 15, color: colors.textPrimary, lineHeight: 24, minHeight: 48, textAlignVertical: 'top', marginBottom: 4, fontFamily: font.body },
  editDivider: { height: 0.5, backgroundColor: colors.border, marginVertical: 14 },
  // Library accessory bar — H44 outlined + filled-gold pair (matches the
  // pattern used in compass / journal / emotions / review / read).
  accessoryBarPair: {
    flexDirection: 'row', gap: 10, backgroundColor: colors.bg,
    borderTopWidth: 0.5, borderTopColor: colors.border,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  editBtn: {
    flex: 1, height: 44, borderRadius: radius.md,
    paddingHorizontal: 16,
  },
  editBtnSave: { backgroundColor: colors.accent },
  editBtnText: { fontSize: 14, fontFamily: font.bodyMedium, color: colors.accent, letterSpacing: 0.3 },
  editBtnSaveText: { color: '#1a1a1a' },
  distortionGrid: { gap: 10, marginBottom: 16 },
  distortionPill: { borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.md, padding: 14, backgroundColor: colors.bgElevated },
  distortionLabel: { fontSize: 15, fontFamily: font.bodyMedium, color: colors.textPrimary, marginBottom: 4 },
  distortionQ: { fontSize: 13, color: colors.textSecondary, lineHeight: 20 },
});
