import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity,
  StyleSheet, SafeAreaView, ScrollView, ImageBackground,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { getStreak } from '../store/db';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, font } from '../constants/theme';
import { useMiniPlayerInset } from '../components/MiniMeditationPlayer';
import { useEntitlement } from '../lib/useEntitlement';


const menuItems = [
  {
    section: 'App',
    items: [
      { label: 'How Marcus works', sub: 'The practice explained', icon: 'help-circle-outline', route: '/howto' },
      { label: 'Further reading', sub: 'A short shelf of curated Stoic works', icon: 'library-outline', route: '/library' },
      { label: 'Virtues & imagery', sub: 'The four Virtues and the art that holds them', icon: 'images-outline', route: '/imagery' },
      { label: 'Settings', sub: 'Notifications and preferences', icon: 'settings-outline', route: '/settings' },
    ],
  },
];

export default function MoreScreen() {
  const router = useRouter();
  const [streak, setStreak] = useState({ current: 0, longest: 0, totalDays: 0 });
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
      : 'Start your 7-day free trial';

  useEffect(() => {
    getStreak().then(s => setStreak(s || { current: 0, longest: 0, totalDays: 0 }));
  }, []);

  useFocusEffect(useCallback(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, []));

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        ref={scrollRef}
        style={[s.scroll, { backgroundColor: colors.bgCard }]}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: playerInset }}
      >

        <ImageBackground
          source={require('../assets/bg.png')}
          style={s.hero}
          resizeMode="cover"
        >
          <Text style={s.title}>Marcus</Text>
          <Text style={s.sub}>A Stoic practice app</Text>
          <Text style={s.heroQuote}>"The impediment to action advances action. What stands in the way becomes the way."</Text>
          <Text style={s.heroAttr}>Marcus Aurelius</Text>
        </ImageBackground>

        <View style={s.statsCard}>
          <View style={s.statItem}>
            <Text style={s.statNum}>{streak.current}</Text>
            <Text style={s.statLabel}>Active run</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statItem}>
            <Text style={s.statNum}>{streak.longest || 0}</Text>
            <Text style={s.statLabel}>Longest</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statItem}>
            <Text style={s.statNum}>{streak.totalDays || 0}</Text>
            <Text style={s.statLabel}>Active days</Text>
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
                  <Text style={s.rowLabel}>Subscription</Text>
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
                  <Ionicons name={item.icon} size={20} color={colors.accent} style={{ marginLeft: 12 }} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  hero: {
    padding: spacing.xl,
    paddingTop: 48,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  title: { fontSize: font.heroSize, fontFamily: font.wordmark, color: colors.textPrimary, letterSpacing: -0.5, marginBottom: 8 },
  sub: { fontSize: 18, color: colors.textSecondary, fontFamily: font.serif, marginBottom: 20 },
  statsCard: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.bgCard,
    overflow: 'hidden',
  },
  statItem: { flex: 1, alignItems: 'center', paddingVertical: 16 },
  statNum: { fontSize: 26, fontWeight: '600', color: colors.textSecondary, marginBottom: 4 },
  statLabel: { fontSize: 10, color: colors.textDim, letterSpacing: 1, fontFamily: font.bodyMedium, textTransform: 'uppercase' },
  statDivider: { width: 0.5, backgroundColor: colors.border },
  heroQuote: { fontSize: 15, color: colors.textMuted, fontFamily: font.serif, lineHeight: 24 },
  heroAttr: { fontSize: 11, color: colors.textDim, letterSpacing: 1, fontFamily: font.bodyMedium, textTransform: 'uppercase', marginTop: 8 },
  section: { paddingHorizontal: spacing.md, paddingTop: spacing.lg, paddingBottom: 36 },
  card: {
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
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
  rowSub: { fontSize: 13, color: colors.textDim },
  footerQuote: {
    fontSize: 14, color: colors.textMuted, fontStyle: 'italic', fontFamily: font.serif,
    textAlign: 'center', lineHeight: 22, marginBottom: 8,
  },
  footerAttr: { fontSize: 11, color: colors.textDim, letterSpacing: 1, fontFamily: font.bodyMedium, textTransform: 'uppercase' },
});