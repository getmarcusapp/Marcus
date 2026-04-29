import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity,
  StyleSheet, SafeAreaView, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { getStreak } from '../store/db';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, font } from '../constants/theme';

const menuItems = [
  {
    section: 'Practice',
    items: [
      { label: 'Stoic compass', sub: 'Your north star', icon: 'compass-outline', route: '/compass' },
      { label: 'Daily reading', sub: 'Personalized to your practice', icon: 'book-outline', route: '/read' },
      { label: 'Morning journal', sub: "Today's reflection and history", icon: 'sunny-outline', route: '/journal?type=morning' },
      { label: 'Evening journal', sub: "Tonight's reflection and history", icon: 'moon-outline', route: '/journal?type=evening' },
      { label: 'Daily readings', sub: 'Your reading archive', icon: 'book-outline', route: '/read' },
      { label: 'Weekly review', sub: 'Examine the week', icon: 'layers-outline', route: '/review' },
    ],
  },
  {
    section: 'App',
    items: [
      { label: 'How Marcus works', sub: 'The practice explained', icon: 'help-circle-outline', route: '/howto' },
      { label: 'Settings', sub: 'Notifications and preferences', icon: 'settings-outline', route: '/settings' },
    ],
  },
];

export default function MoreScreen() {
  const router = useRouter();
  const [streak, setStreak] = useState({ current: 0, longest: 0, totalDays: 0 });

  useEffect(() => {
    getStreak().then(s => setStreak(s || { current: 0, longest: 0, totalDays: 0 }));
  }, []);

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>

        <View style={s.hero}>
          <Text style={s.title}>Marcus</Text>
          <Text style={s.sub}>A Stoic practice app</Text>
          <Text style={s.heroQuote}>"Waste no more time arguing about what a good man should be. Be one."</Text>
          <Text style={s.heroAttr}>Marcus Aurelius</Text>
        </View>

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

        {menuItems.map(section => (
          <View key={section.section} style={s.section}>
            <Text style={s.sectionLabel}>{section.section}</Text>
            <View style={s.card}>
              {section.items.map((item, idx) => (
                <TouchableOpacity
                  key={item.label}
                  style={[s.row, idx < section.items.length - 1 && s.rowBorder]}
                  onPress={() => router.push(item.route)}
                  activeOpacity={0.7}
                >
                  <View style={s.iconWrap}>
                    <Ionicons name={item.icon} size={20} color={colors.textMuted} />
                  </View>
                  <View style={s.rowContent}>
                    <Text style={s.rowLabel}>{item.label}</Text>
                    <Text style={s.rowSub}>{item.sub}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textDim} />
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
    backgroundColor: colors.bgDeep,
    padding: spacing.xl,
    paddingTop: 48,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  title: { fontSize: font.heroSize, fontWeight: '600', color: colors.textPrimary, letterSpacing: -1.5, marginBottom: 8 },
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
  statLabel: { fontSize: 10, color: colors.textDim, letterSpacing: 1, textTransform: 'uppercase' },
  statDivider: { width: 0.5, backgroundColor: colors.border },
  heroQuote: { fontSize: 15, color: colors.textMuted, fontFamily: font.serif, lineHeight: 24 },
  heroAttr: { fontSize: 11, color: colors.textDim, letterSpacing: 1, textTransform: 'uppercase', marginTop: 8 },
  section: { paddingHorizontal: spacing.md, paddingTop: spacing.lg },
  sectionLabel: {
    fontSize: font.labelSize,
    letterSpacing: font.sectionTracking,
    color: colors.accent,
    textTransform: 'uppercase',
    marginBottom: 10,
    paddingLeft: 4,
  },
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
  rowLabel: { fontSize: 16, fontWeight: '500', color: colors.textSecondary, marginBottom: 2 },
  rowSub: { fontSize: 13, color: colors.textDim },
  footerQuote: {
    fontSize: 14, color: colors.textMuted, fontStyle: 'italic', fontFamily: font.serif,
    textAlign: 'center', lineHeight: 22, marginBottom: 8,
  },
  footerAttr: { fontSize: 11, color: colors.textDim, letterSpacing: 1, textTransform: 'uppercase' },
});