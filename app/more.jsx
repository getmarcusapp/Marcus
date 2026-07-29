import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, Image,
  StyleSheet, SafeAreaView, ScrollView, Dimensions,
} from 'react-native';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
// Page-level fixed bg — see index.jsx for the design constraint that
// forced this (bg.png is portrait-aspect; no room for parallax drift
// without cropping the hourglass curves).
const PARALLAX_BG_HEIGHT = SCREEN_H;
import { useRouter, useFocusEffect } from 'expo-router';
import { getStreak } from '../store/db';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, font } from '../constants/theme';
import { useMiniPlayerInset } from '../components/MiniMeditationPlayer';
import { useEntitlement } from '../lib/useEntitlement';
import { getUnreadCount, subscribeDispatches, refreshDispatches } from '../lib/dispatches';
import { getPracticeTimeMs, seedPracticeTimeIfNeeded } from '../lib/practiceTime';

// Total time invested, minutes rolling up to hours as it grows.
function formatPracticeTime(ms) {
  const totalMin = Math.floor((ms || 0) / 60000);
  if (totalMin < 60) return `${totalMin}m`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}


const menuItems = [
  {
    section: 'App',
    items: [
      { label: 'Dispatches', sub: 'News, updates, and notices', icon: 'newspaper-outline', route: '/dispatches', id: 'dispatches' },
      { label: 'Mid-day pause', sub: 'Prosoche, the Stoic discipline of attention', icon: 'eye-outline', route: '/prosoche' },
      { label: 'How Marcus works', sub: 'The practice explained', icon: 'help-circle-outline', route: '/howto' },
      { label: 'The Foundations', sub: 'Seven letters on the practice', icon: 'mail-outline', route: '/foundations-list' },
      { label: 'Further reading', sub: 'A short shelf of curated Stoic works', icon: 'library-outline', route: '/library' },
      { label: 'Virtues & imagery', sub: 'The four Virtues and the art that holds them', icon: 'images-outline', route: '/imagery' },
      { label: 'Settings', sub: 'Notifications and preferences', icon: 'settings-outline', route: '/settings' },
    ],
  },
];

export default function MoreScreen() {
  const router = useRouter();
  const [streak, setStreak] = useState({ current: 0, longest: 0, totalDays: 0 });
  const [dispatchUnread, setDispatchUnread] = useState(0);
  const [practiceMs, setPracticeMs] = useState(0);
  const playerInset = useMiniPlayerInset();
  const scrollRef = useRef(null);
  const { hasAccess, trialDaysLeft } = useEntitlement();

  // Subscription row copy varies by state so the user always knows where
  // they stand. Hidden while entitlement is still loading.
  const subSub = trialDaysLeft !== null
    ? (trialDaysLeft === 0
        ? 'Free trial ends today'
        : `${trialDaysLeft} day${trialDaysLeft === 1 ? '' : 's'} left in free trial`)
    : hasAccess
      ? 'Active · manage in iOS Settings'
      // Row label already reads "Start free trial" in this state, so the
      // sub states the benefit rather than repeating the action.
      : 'Unlock the full practice';

  useEffect(() => {
    getStreak().then(s => setStreak(s || { current: 0, longest: 0, totalDays: 0 }));
    // Seed the historical estimate once (existing users), then load the total.
    (async () => {
      await seedPracticeTimeIfNeeded();
      setPracticeMs(await getPracticeTimeMs());
    })();
  }, []);

  // Keep the Dispatches unread dot live: seed it, and re-read whenever read
  // state changes anywhere (e.g. the inbox screen marking things read).
  useEffect(() => {
    const refresh = () => getUnreadCount().then(setDispatchUnread).catch(() => {});
    refresh();
    return subscribeDispatches(refresh);
  }, []);

  useFocusEffect(useCallback(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    // Pull the latest feed when the user lands on More, then refresh the dot.
    refreshDispatches().catch(() => {});
    getUnreadCount().then(setDispatchUnread).catch(() => {});
    // Refresh the total so it reflects practices done since this screen mounted.
    getPracticeTimeMs().then(setPracticeMs).catch(() => {});
  }, []));

  return (
    <View style={s.root}>
      <Image
        source={require('../assets/bg-svg4.png')}
        style={s.parallaxBg}
        resizeMode="cover"
        pointerEvents="none"
      />
      <View style={s.bgOverlay} pointerEvents="none" />
      <SafeAreaView style={s.safeTransparent}>
      <ScrollView
        ref={scrollRef}
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: playerInset }}
      >

        <View style={s.hero}>
          <Image source={require('../assets/marcus-wordmark.png')} style={s.titleWordmark} resizeMode="contain" />
          <Text style={s.sub}>A Stoic practice app</Text>
          <Text style={s.heroQuote}>“The impediment to action advances action. What stands in the way becomes the way.”</Text>
          <Text style={s.heroAttr}>— Marcus Aurelius</Text>
        </View>

        <View style={s.statsCard}>
          <View style={s.timeBand}>
            <Text style={s.timeBandLabel}>Time in practice</Text>
            <Text style={s.timeBandValue}>{formatPracticeTime(practiceMs)}</Text>
          </View>
          <View style={s.statsRow}>
          <View style={s.statItem}>
            <Text style={s.statNum} numberOfLines={1} adjustsFontSizeToFit>{streak.current}</Text>
            <Text style={s.statLabel}>Active run</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statItem}>
            <Text style={s.statNum} numberOfLines={1} adjustsFontSizeToFit>{streak.longest || 0}</Text>
            <Text style={s.statLabel}>Longest</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statItem}>
            <Text style={s.statNum} numberOfLines={1} adjustsFontSizeToFit>{streak.totalDays || 0}</Text>
            <Text style={s.statLabel}>Active days</Text>
          </View>
          <View style={s.statDivider} />
          {/* The seal: days where all four practices were completed — the
              rarer mark now that any single practice keeps the flame. */}
          <View style={s.statItem}>
            <Text style={s.statNum} numberOfLines={1} adjustsFontSizeToFit>{streak.sealedDays || 0}</Text>
            <Text style={s.statLabel}>Days sealed</Text>
          </View>
          </View>
        </View>

        {hasAccess !== null && (
          <View style={[s.section, { paddingBottom: 0 }]}>
            <View style={s.card}>
              <TouchableOpacity
                style={s.row}
                onPress={() => router.push('/paywall?from=/more&fromLabel=More')}
                activeOpacity={0.7}
              >
                <View style={s.rowContent}>
                  <Text style={s.rowLabel}>{hasAccess ? 'Subscription' : 'Start free trial'}</Text>
                  <Text style={s.rowSub}>{subSub}</Text>
                </View>
                <Ionicons name="diamond-outline" size={20} color={colors.accent} style={{ marginLeft: 12 }} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {menuItems.map(section => (
          <View key={section.section} style={s.section}>
            <View style={s.card}>
              {section.items.map((item, idx) => (
                <TouchableOpacity
                  key={item.label}
                  style={[s.row, idx < section.items.length - 1 && s.rowBorder]}
                  onPress={() => {
                    // Pass from/fromLabel so destination screens with
                    // back buttons land us back on More instead of the
                    // active tab.
                    const sep = item.route.includes('?') ? '&' : '?';
                    router.push(`${item.route}${sep}from=/more&fromLabel=More`);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={s.rowContent}>
                    <Text style={s.rowLabel}>{item.label}</Text>
                    <Text style={s.rowSub}>{item.sub}</Text>
                  </View>
                  {item.id === 'dispatches' && dispatchUnread > 0 && <View style={s.unreadDot} />}
                  <Ionicons name={item.icon} size={20} color={colors.accent} style={{ marginLeft: 12 }} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

      </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#050505', overflow: 'hidden' },
  safeTransparent: { flex: 1, backgroundColor: 'transparent' },
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1, backgroundColor: 'transparent' },
  // Size to the literal window, NOT absoluteFillObject — see index.jsx for the
  // full explanation (absoluteFillObject fills the oversized parent and makes
  // cover zoom the image to a center slice). Explicit SCREEN_W × SCREEN_H fixes it.
  parallaxBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: SCREEN_W,
    height: SCREEN_H,
  },
  // V's tall composition has darkness baked in — transparent no-op. Keep in
  // sync with index.jsx; raise the alpha to go darker than her bake.
  bgOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  // Mirrors the practice-page hero: centered, no bottom border, floating on
  // the bg. Same spacing (paddingTop 64 / paddingBottom 44) and same type
  // system below (gold eyebrow, Didot italic quote, Inter #AAAAAA attribution).
  hero: {
    paddingHorizontal: spacing.xl,
    paddingTop: 64,
    paddingBottom: 44,
    alignItems: 'center',
  },
  // Marcus wordmark image (replaces the Cormorant text). 1144×203 source
  // (aspect ≈ 5.64). Explicit width+height at that aspect — no aspectRatio,
  // which let the box mis-resolve and crop to "ARC". Sized to match the
  // onboarding welcome hero, with marginBottom opening space to the eyebrow.
  titleWordmark: { width: 232, height: 41, marginBottom: 22 },
  // Gold eyebrow — matches the practice hero's "Memento mori" treatment.
  sub: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.accent, fontFamily: font.bodyMedium, textTransform: 'uppercase', textAlign: 'center' },
  statsCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.bgCard,
    overflow: 'hidden',
  },
  timeBand: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  timeBandLabel: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.textSecondary, fontFamily: font.bodyMedium, textTransform: 'uppercase' },
  timeBandValue: { fontSize: 20, fontFamily: font.bodySemiBold, color: colors.accent, letterSpacing: 0.3 },
  statsRow: { flexDirection: 'row' },
  statItem: { flex: 1, alignItems: 'center', paddingVertical: 16 },
  statNum: { fontSize: 26, fontFamily: font.bodySemiBold, color: colors.textSecondary, marginBottom: 4 },
  statLabel: { fontSize: 11, color: colors.textSecondary, letterSpacing: 1, fontFamily: font.bodyMedium, textTransform: 'uppercase' },
  statDivider: { width: 0.5, backgroundColor: colors.border },
  // Quote + attribution — same treatment as the practice hero.
  heroQuote: { fontSize: 20, color: colors.textPrimary, lineHeight: 28, fontFamily: font.bodyLightItalic, fontStyle: 'italic', textAlign: 'center', marginTop: 28 },
  // Gold uppercase attribution — matches the onboarding welcome screen so
  // every quote reads as one unified component. Was Inter 20 gray title-case.
  heroAttr: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.accent, fontFamily: font.bodyMedium, textTransform: 'uppercase', marginTop: 16, textAlign: 'center' },
  section: { paddingHorizontal: spacing.md, paddingTop: spacing.lg, paddingBottom: 36 },
  card: {
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.bgCard,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', padding: 18, gap: 14 },
  rowBorder: { borderBottomWidth: 0.5, borderBottomColor: colors.border },
  iconWrap: {
    width: 36, height: 36, borderRadius: radius.sm,
    backgroundColor: colors.bgElevated, alignItems: 'center', justifyContent: 'center',
  },
  rowContent: { flex: 1 },
  rowLabel: { fontSize: 16, fontFamily: font.bodyMedium, color: colors.textSecondary, marginBottom: 2 },
  rowSub: { fontSize: 13, color: colors.textSecondary },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
});