import React, { useEffect, useRef, useCallback, useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, SafeAreaView, Image,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, font } from '../constants/theme';
import {
  MEDITATIONS, MEDITATIONS_LIST, GROUPS, useMeditationPlayer, open,
} from '../lib/meditationPlayer';
import { useEntitlement } from '../lib/useEntitlement';
import { useMiniPlayerInset } from '../components/MiniMeditationPlayer';

export default function MeditateScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const player = useMeditationPlayer();
  const scrollRef = useRef(null);
  // Group filter pills, same look and behaviour as the Library's: tap to show
  // one group, tap again (or All) to show everything.
  const [groupFilter, setGroupFilter] = useState(null);

  useFocusEffect(useCallback(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, []));
  const { hasAccess } = useEntitlement();
  const miniInset = useMiniPlayerInset();
  const isPlaying = player.isPlaying;

  // Deep link (?id=...): open that meditation in the full player.
  useEffect(() => {
    const med = params?.id && MEDITATIONS[params.id];
    if (med) requireAccess(() => open(med));
  }, [params?.id, hasAccess]);
  function requireAccess(action) {
    if (hasAccess) { action(); return; }
    if (hasAccess === null) return; // entitlement still loading — swallow the tap rather than misroute a subscriber
    router.push('/paywall');
  }

  function selectMeditation(med) {
    requireAccess(() => open(med));
  }

  // Contextual meditation for the page hero (matches the practice card pick):
  // morning -> Premeditatio, midday -> View From Above, evening -> Evening Examination.
  const hour = new Date().getHours();
  const contextualMed =
    hour >= 5 && hour < 12 ? MEDITATIONS['premeditatio']
    : hour >= 18 || hour < 5 ? MEDITATIONS['evening-examination']
    : MEDITATIONS['view-from-above'];

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView ref={scrollRef} style={[s.scroll, { backgroundColor: colors.bgCard }]} showsVerticalScrollIndicator={false} stickyHeaderIndices={[1]} contentContainerStyle={{ paddingBottom: 36 + miniInset }}>

        <View style={s.header}>
          <Image source={contextualMed.image} style={s.headerImage} resizeMode="cover" />
          <LinearGradient
            colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.25)', 'rgba(0,0,0,0.75)', 'rgba(0,0,0,0.95)']}
            locations={[0, 0.4, 0.75, 1]}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={s.headerContent}>
            <Text style={s.eyebrow}>{countWord(MEDITATIONS_LIST.length)} guided meditations</Text>
            <Text style={s.title}>{`Ancient attention\ntraining`}</Text>
          </View>
        </View>

        {/* Sticky group pills (index 1 in the ScrollView, so it sticks) */}
        <View style={s.chipsWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
            <TouchableOpacity style={[s.chip, !groupFilter && s.chipActive]} onPress={() => setGroupFilter(null)} activeOpacity={0.7}>
              <Text style={[s.chipText, !groupFilter && s.chipTextActive]}>
                All<Text style={[s.chipCount, !groupFilter && s.chipCountActive]}> · {MEDITATIONS_LIST.length}</Text>
              </Text>
            </TouchableOpacity>
            {GROUPS.map(g => {
              const active = groupFilter === g.id;
              const count = MEDITATIONS_LIST.filter(m => m.group === g.id).length;
              return (
                <TouchableOpacity key={g.id} style={[s.chip, active && s.chipActive]} onPress={() => setGroupFilter(active ? null : g.id)} activeOpacity={0.7}>
                  <Text style={[s.chipText, active && s.chipTextActive]}>
                    {g.label}<Text style={[s.chipCount, active && s.chipCountActive]}> · {count}</Text>
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Meditation list, by group (lib/meditationPlayer.js GROUPS) */}
        {GROUPS.filter(g => !groupFilter || g.id === groupFilter).map(group => {
          const meds = MEDITATIONS_LIST.filter(m => m.group === group.id);
          if (!meds.length) return null;
          return (
            <View key={group.id}>
              <Text style={s.groupLabel}>{group.label}</Text>
              {/* Two-column grid of paintings: every meditation visible, the art
                  doing the inviting. Sideways rows wait until a group has six+. */}
              <View style={s.grid}>
                {meds.map(med => {
                  // The loaded meditation, else today's contextual pick, so the
                  // grid matches the hero image and the Practice card.
                  const isActive = (player.currentMedId || contextualMed.id) === med.id;
                  const isCurrent = player.currentMedId === med.id;
                  return (
                    <TouchableOpacity
                      key={med.id}
                      style={[s.tile, isActive && s.tileActive]}
                      onPress={() => selectMeditation(med)}
                      activeOpacity={0.8}
                      accessibilityLabel={`${med.title}, ${med.duration}`}
                    >
                      <Image source={med.image} style={s.tileImg} resizeMode="cover" />
                      <LinearGradient
                        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.75)']}
                        locations={[0.55, 1]}
                        style={StyleSheet.absoluteFill}
                      />
                      <View style={s.badge}>
                        <Ionicons name={isCurrent && isPlaying ? 'pause' : 'play'} size={10} color={isCurrent ? colors.accent : '#fff'} />
                        <Text style={[s.badgeText, isCurrent && { color: colors.accent }]}>{med.duration}</Text>
                      </View>
                      <Text style={s.tileTitle} numberOfLines={3}>{med.title}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const NUMBER_WORDS = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen', 'Twenty'];
const countWord = n => NUMBER_WORDS[n] || String(n);

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgDeep },
  scroll: { flex: 1 },

  header: {
    minHeight: 200,
    backgroundColor: '#000',
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  headerImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  headerContent: { paddingHorizontal: 28, paddingTop: 40, paddingBottom: 24 },
  eyebrow: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.accent, fontFamily: font.bodyMedium, textTransform: 'uppercase', marginBottom: 12, textShadowColor: 'rgba(0,0,0,0.85)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 },
  title: { fontSize: 34, fontFamily: font.display, color: '#FFFFFF', letterSpacing: -1, lineHeight: 40, textShadowColor: 'rgba(0,0,0,0.7)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 8 },
  sub: { fontSize: font.subSize, color: colors.textSecondary, lineHeight: 22 },

  grid: { paddingHorizontal: spacing.lg, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 14 },
  tile: { width: '48%', aspectRatio: 1, borderRadius: radius.md, overflow: 'hidden', backgroundColor: '#000', justifyContent: 'flex-end', borderWidth: 0.5, borderColor: colors.border },
  tileActive: { borderColor: colors.accent, borderWidth: 1 },
  // Explicit size: absoluteFill alone drew the painting at its native size,
  // clipped, so a tile showed a zoomed-in corner.
  tileImg: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  badge: { position: 'absolute', top: 8, right: 8, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 4 },
  badgeText: { fontSize: 11, color: '#fff', fontFamily: font.bodyMedium, fontVariant: ['tabular-nums'] },
  tileTitle: { fontSize: 15, lineHeight: 19, color: '#fff', fontFamily: font.bodySemiBold, paddingHorizontal: 12, paddingBottom: 12, textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 },
  // Group pills: copied from app/library.jsx so the two read as one control.
  chipsWrap: { backgroundColor: colors.bg, borderBottomWidth: 0.5, borderBottomColor: colors.border, paddingVertical: 6, justifyContent: 'center' },
  chip: { borderWidth: 0.5, borderColor: colors.border, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 6, backgroundColor: colors.bgCard },
  chipActive: { borderColor: colors.accent, backgroundColor: colors.bg },
  chipText: { fontSize: 13, color: colors.textSecondary, letterSpacing: 0.3, fontFamily: font.bodyMedium },
  chipTextActive: { color: colors.accent },
  chipCount: { fontSize: 12, color: colors.textSecondary, fontFamily: font.body },
  chipCountActive: { color: colors.accentDim },
  groupLabel: { fontSize: font.labelSize, color: colors.accent, letterSpacing: font.sectionTracking, fontFamily: font.bodyMedium, textTransform: 'uppercase', marginTop: spacing.xl, marginBottom: spacing.sm, paddingHorizontal: spacing.lg },
  sectionLabel: { fontSize: font.labelSize, color: colors.textSecondary, letterSpacing: 2, fontFamily: font.bodyMedium, textTransform: 'uppercase', marginBottom: spacing.md },

});
