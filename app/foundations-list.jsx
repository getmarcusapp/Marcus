import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView, Image,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, font } from '../constants/theme';
import { FOUNDATIONS_LETTERS } from '../constants/foundations';
import { getFoundationsState } from '../lib/foundations';
import { useMiniPlayerInset } from '../components/MiniMeditationPlayer';
import { ScreenHeader } from '../components/ScreenHeader';
import * as haptics from '../lib/haptics';

// Index of the seven Foundations letters — the series' permanent home,
// reached from More. (It lived on the Library screen briefly, but that's
// a bookshop of external works with affiliate links; the app's own
// teaching deserved its own room.) Locked letters show their arrival day.
export default function FoundationsListScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const playerInset = useMiniPlayerInset();
  const scrollRef = useRef(null);
  const fromPath = params?.from || '/more';
  const fromLabel = params?.fromLabel || 'More';

  const [state, setState] = useState({ unlockedCount: FOUNDATIONS_LETTERS.length, read: [] });

  useFocusEffect(useCallback(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    getFoundationsState().then(setState).catch(() => {});
  }, []));

  return (
    <SafeAreaView style={s.safe}>
      <ScreenHeader fromPath={fromPath} fromLabel={fromLabel} />
      <ScrollView
        ref={scrollRef}
        style={[s.scroll, { backgroundColor: colors.bgCard }]}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 36 + playerInset }}
      >
        {/* Caravaggio, Saint Jerome Writing (1605–06) — an old man writing
            with a skull on the desk. Letters and memento mori in one frame. */}
        <View style={s.hero}>
          <Image
            source={require('../assets/heroes/foundations.jpg')}
            style={s.heroImage}
            resizeMode="cover"
          />
          <LinearGradient
            colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.35)', 'rgba(0,0,0,0.85)', 'rgba(0,0,0,0.95)']}
            locations={[0, 0.4, 0.75, 1]}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={s.heroContent}>
            <Text style={s.eyebrow}>The Foundations</Text>
            <Text style={s.title}>Seven letters{'\n'}on the practice</Text>
            <Text style={s.sub}>
              One unlocked each day of your first week. Each takes two minutes. Each gives you one tool.
            </Text>
          </View>
        </View>

        <View style={s.body}>
          <View style={s.card}>
            {FOUNDATIONS_LETTERS.map((letter, i) => {
              const n = i + 1;
              const locked = n > state.unlockedCount;
              const isRead = state.read.includes(n);
              return (
                <TouchableOpacity
                  key={n}
                  style={[s.row, i < FOUNDATIONS_LETTERS.length - 1 && s.rowBorder]}
                  disabled={locked}
                  onPress={() => {
                    haptics.tap();
                    router.push(`/foundations?letter=${n}&from=${encodeURIComponent('/foundations-list')}&fromLabel=Letters`);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[s.rowNum, locked && s.rowTextLocked, isRead && s.rowNumRead]}>{letter.num}</Text>
                  <View style={s.rowContent}>
                    <Text style={[s.rowTitle, locked && s.rowTextLocked]}>{letter.title}</Text>
                    <Text style={s.rowMeta}>
                      {locked ? `Arrives on day ${n}` : isRead ? 'Read' : 'Unread'}
                    </Text>
                  </View>
                  {locked
                    ? <Ionicons name="lock-closed-outline" size={16} color={colors.textSecondary} style={{ marginLeft: 12 }} />
                    : <Ionicons name={isRead ? 'checkmark' : 'mail-outline'} size={18} color={isRead ? colors.accentDim : colors.accent} style={{ marginLeft: 12 }} />}
                </TouchableOpacity>
              );
            })}
          </View>
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
    minHeight: 280,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  heroImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  heroContent: { padding: spacing.xl, paddingTop: 52 },
  eyebrow: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.accent, fontFamily: font.bodyMedium, textTransform: 'uppercase', marginBottom: 8 },
  title: { fontSize: font.titleSize, fontFamily: font.display, color: colors.textPrimary, letterSpacing: -0.5, marginBottom: 10, lineHeight: 36 },
  sub: { fontSize: font.subSize, color: colors.textSecondary, lineHeight: 22 },
  body: { padding: spacing.md },
  card: {
    borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.md,
    backgroundColor: colors.bg, overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', padding: 18 },
  rowBorder: { borderBottomWidth: 0.5, borderBottomColor: colors.border },
  rowNum: { width: 44, fontSize: 20, fontFamily: font.display, color: colors.accent },
  rowNumRead: { color: colors.accentDim },
  rowContent: { flex: 1 },
  rowTitle: { fontSize: 15, fontFamily: font.body, color: colors.textPrimary, marginBottom: 3 },
  rowMeta: { fontSize: 12, color: colors.textSecondary, letterSpacing: 0.5, textTransform: 'uppercase' },
  rowTextLocked: { color: colors.textSecondary },
});
