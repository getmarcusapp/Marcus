import React, { useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, SafeAreaView, ActivityIndicator, Image,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { ScreenHeader } from '../components/ScreenHeader';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, radius, spacing, font } from '../constants/theme';
import {
  MEDITATIONS, MEDITATIONS_LIST,
  useMeditationPlayer, play, toggle as togglePlayer, seek as seekPlayer,
  formatMedTime,
} from '../lib/meditationPlayer';
import { useEntitlement } from '../lib/useEntitlement';

export default function MeditateScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const player = useMeditationPlayer();
  const scrollRef = useRef(null);

  useFocusEffect(useCallback(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, []));
  // Player state survives across screens, which means a meditation played
  // earlier in the day stays "selected" even after it finishes. When the user
  // taps "All meditations" from Practice expecting to see today's contextual
  // pick, we suppress that stale selection unless they're actually mid-track.
  const playerSelected = player.currentMedId ? MEDITATIONS[player.currentMedId] : null;
  const isPlayerActive = player.isPlaying || player.isLoading || player.position > 0;
  const arrivedFresh = !params?.id;
  const selected = (arrivedFresh && !isPlayerActive) ? null : playerSelected;
  const isPlaying = player.isPlaying;
  const isLoading = player.isLoading;
  const position = player.position;
  const duration = player.duration;

  // Auto-play when arriving with ?id=... (deep-linked from practice card
  // or journal screens). If the same meditation is already loaded and
  // playing, do nothing — don't restart.
  useEffect(() => {
    if (!params?.id) return;
    const med = MEDITATIONS[params.id];
    if (!med) return;
    if (player.currentMedId === med.id && player.isPlaying) return;
    play(med);
  }, [params?.id]);

  const { hasAccess } = useEntitlement();
  function requireAccess(action) {
    if (hasAccess) { action(); return; }
    if (hasAccess === null) return; // entitlement still loading — swallow the tap rather than misroute a subscriber
    router.push('/paywall');
  }

  function selectMeditation(med) {
    requireAccess(() => play(med));
  }

  function togglePlay() {
    if (!selected) return;
    requireAccess(() => togglePlayer(selected));
  }

  function seek(direction) {
    seekPlayer(direction * 15);
  }

  const progress = duration > 0 ? position / duration : 0;
  const formatTime = formatMedTime;

  // Back-navigation source. Hidden routes are siblings of the tabs so
  // router.back() falls through to the active tab; we accept an explicit
  // ?from=&fromLabel= from the caller and replace to that route.
  const fromPath = params?.from || '/more';
  const fromLabel = params?.fromLabel || 'More';

  // Contextual meditation for the page hero (matches the practice card pick):
  // morning -> Premeditatio, midday -> View From Above, evening -> Evening Examination.
  // Only shown when nothing is selected — once a meditation is loaded, the
  // player below carries the visual weight and the header drops the image
  // to avoid stacking the same painting twice on the page.
  const hour = new Date().getHours();
  const contextualMed =
    hour >= 5 && hour < 12 ? MEDITATIONS['premeditatio']
    : hour >= 18 || hour < 5 ? MEDITATIONS['evening-examination']
    : MEDITATIONS['view-from-above'];
  const showHeaderImage = !selected;

  return (
    <SafeAreaView style={s.safe}>
      <ScreenHeader fromPath={fromPath} fromLabel={fromLabel} />
      <ScrollView ref={scrollRef} style={[s.scroll, { backgroundColor: colors.bgCard }]} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 36 }}>

        <View style={[s.header, !showHeaderImage && s.headerCompact]}>
          {showHeaderImage && (
            <>
              <Image source={contextualMed.image} style={s.headerImage} resizeMode="cover" />
              <LinearGradient
                colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.25)', 'rgba(0,0,0,0.75)', 'rgba(0,0,0,0.95)']}
                locations={[0, 0.4, 0.75, 1]}
                style={StyleSheet.absoluteFillObject}
              />
            </>
          )}
          <View style={s.headerContent}>
            <Text style={s.eyebrow}>Seven guided meditations</Text>
            <Text style={s.title}>{`Ancient attention\ntraining`}</Text>
          </View>
        </View>

        {/* Player */}
        {selected && (
          <View style={s.player}>
            <View style={s.playerHero}>
              <Image source={selected.image} style={s.playerHeroImg} resizeMode="cover" />
              <LinearGradient
                colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.95)']}
                locations={[0, 0.55, 1]}
                style={StyleSheet.absoluteFillObject}
              />
              <View style={s.playerHeroText}>
                <Text style={s.playerSubtitle}>{selected.subtitle}</Text>
                <Text style={s.playerTitle}>{selected.title}</Text>
              </View>
            </View>

            <View style={s.playerBody}>
              <Text style={s.playerDesc}>{selected.description}</Text>

              <View style={s.progressBar}>
                <View style={[s.progressFill, { flex: progress }]} />
                <View style={{ flex: 1 - progress }} />
              </View>
              <View style={s.timeRow}>
                <Text style={s.timeText}>{formatTime(position)}</Text>
                <Text style={s.timeText}>
                  {duration > 0 ? `−${formatTime(duration - position)}` : formatTime(duration)}
                </Text>
              </View>

              <View style={s.controls}>
                <TouchableOpacity style={s.skipBtn} onPress={() => seek(-1)}>
                  <MaterialCommunityIcons name="rewind-15" size={30} color={colors.textSecondary} />
                </TouchableOpacity>

                <TouchableOpacity style={s.playBtn} onPress={togglePlay}>
                  {isLoading ? (
                    <ActivityIndicator color={colors.bg} />
                  ) : (
                    <Ionicons
                      name={isPlaying ? 'pause' : 'play'}
                      size={22}
                      color={colors.bg}
                      style={!isPlaying && { marginLeft: 2 }}
                    />
                  )}
                </TouchableOpacity>

                <TouchableOpacity style={s.skipBtn} onPress={() => seek(1)}>
                  <MaterialCommunityIcons name="fast-forward-15" size={30} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Meditation list */}
        <View style={s.list}>
          {MEDITATIONS_LIST.map(med => {
            // When nothing is loaded in the player, highlight today's contextual
            // so the list matches the hero image and the Practice tile pick.
            const highlightId = selected?.id || contextualMed.id;
            const isActive = highlightId === med.id;
            return (
              <TouchableOpacity
                key={med.id}
                style={[s.medCard, isActive && s.medCardActive]}
                onPress={() => selectMeditation(med)}
                activeOpacity={0.7}
              >
                <View style={s.medLeft}>
                  <View style={s.medThumb}>
                    <Image source={med.image} style={s.medThumbImg} resizeMode="cover" />
                    <View style={s.medThumbOverlay}>
                      <Ionicons
                        name={isActive && isPlaying ? 'pause-circle' : 'play-circle'}
                        size={30}
                        color={isActive ? colors.accent : '#fff'}
                      />
                    </View>
                  </View>
                  <View style={s.medText}>
                    <Text style={[s.medTitle, isActive && s.medTitleActive]}>
                      {med.title}
                    </Text>
                    <Text style={s.medMeta}>{med.subtitle} · {med.time} · {med.duration}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgDeep },
  scroll: { flex: 1 },

  header: {
    minHeight: 240,
    backgroundColor: '#000',
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  // Compact header used when a meditation is selected — drops the image
  // so it doesn't stack with the player below. Plain dark, just enough
  // height for the back link + 'Meditations' title.
  headerCompact: {
    minHeight: 0,
    backgroundColor: colors.bgDeep,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  headerImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  headerContent: { paddingHorizontal: 28, paddingTop: 48, paddingBottom: 32 },
  eyebrow: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.accent, fontFamily: font.bodyMedium, textTransform: 'uppercase', marginBottom: 12, textShadowColor: 'rgba(0,0,0,0.85)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 },
  title: { fontSize: 44, fontFamily: font.display, color: '#FFFFFF', letterSpacing: -1.5, lineHeight: 52, textShadowColor: 'rgba(0,0,0,0.7)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 8 },
  sub: { fontSize: font.subSize, color: colors.textSecondary, lineHeight: 22 },

  player: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    borderWidth: 0.5,
    borderColor: colors.border,
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  playerHero: { width: '100%', height: 220, backgroundColor: '#000' },
  playerHeroImg: { width: '100%', height: '100%' },
  playerHeroText: { position: 'absolute', left: spacing.lg, right: spacing.lg, bottom: 14 },
  playerBody: { padding: spacing.lg },
  playerSubtitle: { fontSize: font.labelSize, color: colors.accent, letterSpacing: 2, fontFamily: font.bodyMedium, textTransform: 'uppercase', marginBottom: 6 },
  playerTitle: { fontSize: 22, fontFamily: font.bodySemiBold, color: colors.textPrimary },
  playerDesc: { fontSize: 14, color: colors.textSecondary, lineHeight: 20, marginBottom: spacing.lg },

  progressBar: {
    height: 2,
    backgroundColor: colors.border,
    borderRadius: 1,
    flexDirection: 'row',
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: { backgroundColor: colors.accent, borderRadius: 1 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.lg },
  timeText: { fontSize: 12, color: colors.textSecondary },

  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xl },
  playBtn: {
    width: 56,
    minHeight: 56,
    borderRadius: 28,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },

  list: { paddingHorizontal: spacing.lg },
  sectionLabel: { fontSize: font.labelSize, color: colors.textSecondary, letterSpacing: 2, fontFamily: font.bodyMedium, textTransform: 'uppercase', marginBottom: spacing.md },

  medCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  // Active/playing row — bright gold bordered box, matching the journal &
  // practice meditation cards. Negative margin + matching padding lets the
  // border expand outward into the list inset so content doesn't shift.
  medCardActive: {
    borderWidth: 0.5,
    borderColor: colors.accent,
    borderBottomColor: colors.accent,
    borderRadius: radius.md,
    marginHorizontal: -10,
    paddingHorizontal: 10,
  },
  medLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 },
  medThumb: {
    width: 64, height: 64, borderRadius: radius.md,
    overflow: 'hidden', backgroundColor: '#000',
    position: 'relative',
  },
  medThumbImg: { width: '100%', height: '100%' },
  medThumbOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  medText: { flex: 1 },
  medTitle: { fontSize: 15, fontFamily: font.bodyMedium, color: colors.textSecondary, marginBottom: 3 },
  medTitleActive: { color: colors.textPrimary },
  medMeta: { fontSize: 12, color: colors.textSecondary },
});
