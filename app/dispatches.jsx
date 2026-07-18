import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView, Linking,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, font } from '../constants/theme';
import { ScreenHeader } from '../components/ScreenHeader';
import { useMiniPlayerInset } from '../components/MiniMeditationPlayer';
import { getActiveDispatches, refreshDispatches, markAllRead } from '../lib/dispatches';
import { track } from '../lib/analytics';
import * as haptics from '../lib/haptics';

// Dispatches: an ephemeral in-app inbox (More → Dispatches). Everything here is
// meant to be seen once, then it clears — no growing archive. Two sources:
//   • remote notices from the hosted feed — dismissed when the screen is opened
//     (seen = read = gone next visit),
//   • local letter nudges from the Foundations unlock schedule — a to-do that
//     stays until you actually read that letter (it lives on in The Foundations
//     under More regardless).
// See lib/dispatches.js for the model.

function formatDate(iso) {
  // iso is a plain YYYY-MM-DD. Parse as local (not UTC) so the day doesn't
  // shift backward in western timezones.
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  if (!m) return '';
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
}

function DispatchCard({ item, onCta }) {
  const paragraphs = String(item.body || '').split(/\n{2,}/).filter(Boolean);
  const isLetter = item.kind === 'letter';
  return (
    <View style={s.card}>
      <View style={s.metaRow}>
        <Text style={s.metaText}>{isLetter ? String(item.type || '') : formatDate(item.date)}</Text>
        {!isLetter && !!item.type && <Text style={s.metaType}>{'  ·  ' + String(item.type)}</Text>}
      </View>
      <Text style={s.cardTitle}>{item.title}</Text>
      {paragraphs.map((p, i) => (
        <Text key={i} style={[s.cardBody, i < paragraphs.length - 1 && s.cardBodyGap]}>{p}</Text>
      ))}
      {item.cta && (item.cta.route || item.cta.url) && (
        <TouchableOpacity style={s.cta} activeOpacity={0.85} onPress={() => onCta(item)}>
          <Text style={s.ctaText}>{item.cta.label || 'Open'}</Text>
          <Ionicons name="arrow-forward" size={15} color="#0a0a0a" style={{ marginLeft: 6 }} />
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function DispatchesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const fromPath = params?.from || '/more';
  const fromLabel = params?.fromLabel || 'More';
  const playerInset = useMiniPlayerInset();
  const scrollRef = useRef(null);

  const [items, setItems] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(useCallback(() => {
    let alive = true;
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    (async () => {
      // Show what's cached immediately, then reconcile with the network.
      let list = await getActiveDispatches();
      if (!alive) return;
      setItems(list);
      setLoaded(true);
      track('dispatches_opened');

      await refreshDispatches();
      if (!alive) return;
      list = await getActiveDispatches();
      setItems(list);

      // Dismiss remote NOTICES (seen once) — they're gone next visit. Letter
      // nudges are intentionally NOT dismissed here; they clear when their
      // letter is read.
      const seen = list.filter(d => d.kind !== 'letter').map(d => d.id);
      if (seen.length) await markAllRead(seen);
    })();
    return () => { alive = false; };
  }, []));

  function handleCta(item) {
    haptics.tap();
    track('dispatch_cta_tapped', { id: item.id });
    if (item.cta?.route) {
      const sep = item.cta.route.includes('?') ? '&' : '?';
      router.push(`${item.cta.route}${sep}from=/dispatches&fromLabel=Dispatches`);
    } else if (item.cta?.url) {
      Linking.openURL(item.cta.url).catch(() => {});
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScreenHeader fromPath={fromPath} fromLabel={fromLabel} />
      <ScrollView
        ref={scrollRef}
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 36 + playerInset }}
      >
        <View style={s.hero}>
          <Text style={s.eyebrow}>News &amp; notices</Text>
          <Text style={s.title}>Dispatches</Text>
          <Text style={s.sub}>Occasional word from the practice. Seen once, then it clears.</Text>
        </View>

        <View style={s.body}>
          {items.map(item => (
            <DispatchCard key={item.id} item={item} onCta={handleCta} />
          ))}
          {loaded && items.length === 0 && (
            <View style={s.empty}>
              <Ionicons name="checkmark-circle-outline" size={24} color={colors.textSecondary} />
              <Text style={s.emptyText}>You're all caught up.</Text>
              <Text style={s.emptySub}>New dispatches appear here, then clear once you've seen them.</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgDeep },
  scroll: { flex: 1, backgroundColor: colors.bgCard },
  hero: { paddingHorizontal: spacing.xl, paddingTop: 44, paddingBottom: 24 },
  eyebrow: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.accent, fontFamily: font.bodyMedium, textTransform: 'uppercase', marginBottom: 10 },
  title: { fontSize: font.titleSize, fontFamily: font.display, color: colors.textPrimary, letterSpacing: -0.5, marginBottom: 10 },
  sub: { fontSize: font.subSize, color: colors.textSecondary, lineHeight: 22 },
  body: { paddingHorizontal: spacing.md, paddingTop: spacing.xs },
  card: {
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  metaText: { fontSize: font.labelSize, letterSpacing: 1, color: colors.accentDim, fontFamily: font.bodyMedium, textTransform: 'uppercase' },
  metaType: { fontSize: font.labelSize, letterSpacing: 1, color: colors.textSecondary, fontFamily: font.bodyMedium, textTransform: 'uppercase' },
  cardTitle: { fontSize: 19, fontFamily: font.bodySemiBold, color: colors.textPrimary, lineHeight: 26, marginBottom: 12 },
  cardBody: { fontSize: 15, fontFamily: font.body, color: colors.textSecondary, lineHeight: 24 },
  cardBodyGap: { marginBottom: 14 },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.accent,
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: radius.md,
    marginTop: 18,
  },
  ctaText: { fontSize: 14, fontFamily: font.bodySemiBold, color: '#0a0a0a', letterSpacing: 0.3 },
  empty: { alignItems: 'center', paddingVertical: 64, paddingHorizontal: spacing.xl },
  emptyText: { fontSize: 16, fontFamily: font.bodyMedium, color: colors.textSecondary, marginTop: 14 },
  emptySub: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 20, opacity: 0.8 },
});
