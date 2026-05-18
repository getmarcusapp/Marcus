import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image,
  StyleSheet, SafeAreaView, Share,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, font } from '../constants/theme';
import { getReviews, updateReview } from '../store/db';
import * as haptics from '../lib/haptics';
import { captureRef } from 'react-native-view-shot';
import { ReviewShareCard } from '../components/ReviewShareCard';
import { ReviewEntryEditor } from '../components/ReviewEntryEditor';
import { useEntitlement } from '../lib/useEntitlement';
import { useMiniPlayerInset } from '../components/MiniMeditationPlayer';
import { ScreenHeader } from '../components/ScreenHeader';
import { GoldSecondary } from '../components/GoldButton';

export default function ReviewArchiveScreen() {
  const router = useRouter();
  const { hasAccess } = useEntitlement();
  const playerInset = useMiniPlayerInset();
  const [history, setHistory] = useState([]);
  const [filterRange, setFilterRange] = useState('all');
  const [editingEntry, setEditingEntry] = useState(null);
  const shareCardRef = useRef(null);
  const [shareEntry, setShareEntry] = useState(null);
  const scrollRef = useRef(null);

  async function handleEditSave(updated) {
    await updateReview(updated);
    const refreshed = await getReviews();
    setHistory(refreshed);
    setEditingEntry(null);
  }

  useFocusEffect(useCallback(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, []));

  useEffect(() => {
    getReviews().then(setHistory);
  }, []);

  const filteredHistory = history.filter(e => {
    if (filterRange !== 'all') {
      const days = filterRange === 'week' ? 7 : 30;
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
      if (new Date(e.date).getTime() < cutoff) return false;
    }
    return true;
  });

  async function shareReviewEntry(entry) {
    haptics.tap();
    setShareEntry(entry);
    await new Promise(r => setTimeout(r, 80));
    const intentionText = (entry?.intention || '').trim();
    const message = [
      intentionText ? `Intention for the week ahead:\n\n${intentionText}` : null,
      intentionText ? '' : null,
      '— Marcus · a daily Stoic practice',
    ].filter(v => v !== null).join('\n');
    try {
      const uri = await captureRef(shareCardRef, {
        format: 'jpg',
        quality: 0.92,
        result: 'tmpfile',
      });
      await Share.share({ url: uri, message });
    } catch (e) {
      console.log('Review share image failed, falling back:', e?.message);
      const fallback = [
        `Week of ${entry?.weekOf || ''}`,
        '',
        intentionText ? `Intention for the week ahead:\n${intentionText}` : null,
        intentionText ? '' : null,
        '— Marcus · a daily Stoic practice',
      ].filter(Boolean).join('\n');
      try { await Share.share({ message: fallback }); } catch {}
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      {/* Off-screen share card. Re-renders when shareEntry changes. */}
      {shareEntry && (
        <View
          ref={shareCardRef}
          collapsable={false}
          style={{ position: 'absolute', left: -10000, top: -10000, width: 1080 }}
        >
          <ReviewShareCard
            weekOf={shareEntry.weekOf}
            answers={shareEntry.answers || {}}
            bestVirtue={shareEntry.bestVirtue}
            worstVirtue={shareEntry.worstVirtue}
            intention={shareEntry.intention}
            stats={shareEntry.stats}
          />
        </View>
      )}

      <ScreenHeader fromPath="/review" fromLabel="Back" />

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
          <Text style={s.eyebrow}>Weekly Review</Text>
          <Text style={s.title}>Your archive</Text>
          <Text style={s.sub}>The examined life, recorded</Text>
        </View>

        <View style={s.filterRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingBottom: 8 }}>
            {[['all','All time'],['month','This month'],['week','This week']].map(([val, label]) => (
              <TouchableOpacity
                key={val}
                style={[s.filterPill, filterRange === val && s.filterPillActive]}
                onPress={() => setFilterRange(val)}
                activeOpacity={0.7}
              >
                <Text style={[s.filterPillText, filterRange === val && s.filterPillTextActive]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
        {filteredHistory.length !== history.length && (
          <Text style={s.filterCount}>{filteredHistory.length} of {history.length} reviews</Text>
        )}

        {filteredHistory.length === 0 && history.length > 0 ? (
          <View style={s.empty}>
            <Text style={s.emptyText}>Nothing in this range. Open the field wider.</Text>
          </View>
        ) : filteredHistory.length === 0 ? (
          <View style={s.empty}>
            <Image source={require('../assets/heroes/review.jpg')} style={s.emptyImage} resizeMode="cover" />
            <Text style={s.emptyEyebrow}>Sunday reckoning</Text>
            <Text style={s.emptyTitle}>No weeks sealed yet</Text>
            <Text style={s.emptyText}>
              At week's end, the practice asks five questions. Account for the wins. Reckon with the shortfalls. Notice the patterns. Examine the body. Commit to the next.{'\n\n'}Seal one and a record gathers here.
            </Text>
          </View>
        ) : (
          filteredHistory.map(entry => {
            if (editingEntry?.id === entry.id) {
              return (
                <ReviewEntryEditor
                  key={entry.id}
                  entry={editingEntry}
                  onSave={handleEditSave}
                  onCancel={() => setEditingEntry(null)}
                />
              );
            }
            return (
              <View key={entry.id} style={s.histRow}>
                <View style={s.histTop}>
                  <View>
                    <Text style={s.histDate}>Week of {entry.weekOf}</Text>
                    <Text style={s.histStreak}>{entry.stats?.journaled || 0}/7 days</Text>
                  </View>
                  <GoldSecondary
                    style={s.editBtn}
                    onPress={() => hasAccess ? setEditingEntry({ ...entry }) : router.push('/paywall')}
                    contentStyle={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                    borderWidth={0.5}
                    flatStroke
                  >
                    <Ionicons name="create-outline" size={12} color={colors.accent} />
                    <Text style={s.editBtnText}>Edit</Text>
                  </GoldSecondary>
                </View>
                {entry.bestVirtue && <Text style={s.histBest}>{entry.bestVirtue} · most embodied</Text>}
                {entry.worstVirtue && <Text style={s.histWorst}>{entry.worstVirtue} · least embodied</Text>}
                {entry.answers?.wentWell && (
                  <Text style={s.histPreview}>"{entry.answers.wentWell.slice(0, 140)}..."</Text>
                )}
                <TouchableOpacity
                  style={s.histShareBtn}
                  onPress={() => shareReviewEntry(entry)}
                  activeOpacity={0.7}
                >
                  <Text style={s.histShareText}>Share →</Text>
                </TouchableOpacity>
              </View>
            );
          })
        )}
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
  eyebrow: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.accent, fontFamily: font.bodyMedium, textTransform: 'uppercase', marginBottom: 8 },
  title: { fontSize: font.titleSize, fontFamily: font.display, color: colors.textPrimary, letterSpacing: -0.5 },
  sub: { fontSize: font.subSize, color: colors.textMuted, marginTop: 8 },
  filterRow: { paddingTop: 14, paddingBottom: 6 },
  filterPill: { borderWidth: 0.5, borderColor: colors.border, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: colors.bgCard },
  filterPillActive: { borderColor: colors.accent, backgroundColor: colors.accentBg },
  filterPillText: { fontSize: 12, color: colors.textMuted, letterSpacing: 0.3 },
  filterPillTextActive: { color: colors.accent, fontFamily: font.bodyMedium },
  filterCount: { fontSize: 12, color: colors.textDim, paddingHorizontal: 16, paddingBottom: 8 },
  empty: { padding: 40, paddingTop: 56, alignItems: 'center' },
  emptyEyebrow: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.accent, fontFamily: font.bodyMedium, textTransform: 'uppercase', marginBottom: 14 },
  emptyImage: { width: 180, height: 108, borderRadius: 12, marginBottom: 24 },
  emptyTitle: { fontSize: 26, color: colors.textPrimary, fontFamily: font.display, letterSpacing: -0.5, lineHeight: 32, marginBottom: 14, textAlign: 'center' },
  emptyText: { fontSize: 15, color: colors.textMuted, lineHeight: 24, textAlign: 'center', maxWidth: 360 },
  emptyCta: { marginTop: 28, borderWidth: 0.5, borderColor: colors.accentDim, borderRadius: radius.md, paddingVertical: 14, paddingHorizontal: 22, backgroundColor: colors.accentBg },
  emptyCtaText: { fontSize: 13, color: colors.accent, letterSpacing: 0.5, fontFamily: font.bodyMedium, textTransform: 'uppercase' },
  histRow: { padding: 18, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  // Layout mirrors journal-history: date stack on left, library EDIT chip on
  // right (top-aligned).
  histTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  histDate: { fontSize: 13, color: colors.textSecondary, fontFamily: font.bodyMedium },
  histStreak: { fontSize: 11, color: colors.textDim, letterSpacing: 0.5, marginTop: 2 },
  // Canonical EDIT chip — matches compass / journal-history / emotions-history.
  editBtn: { borderRadius: 4, paddingHorizontal: 10, paddingVertical: 5 },
  editBtnText: { fontSize: 12, color: colors.accent, letterSpacing: 0.3 },
  histBest: { fontSize: 14, color: colors.virtueGood, marginBottom: 4 },
  histWorst: { fontSize: 14, color: colors.virtueBad, marginBottom: 4 },
  histPreview: { fontSize: 14, color: colors.textMuted, fontStyle: 'italic', marginTop: 6, lineHeight: 22 },
  histShareBtn: { marginTop: 12, paddingVertical: 4 },
  histShareText: { fontSize: 12, color: colors.accent, letterSpacing: 0.5, fontFamily: font.bodyMedium, textTransform: 'uppercase' },
});
