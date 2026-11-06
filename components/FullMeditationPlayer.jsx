import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Image,
  Animated, PanResponder, Dimensions, Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import {
  MEDITATIONS, useMeditationPlayer,
  toggle, seek, seekTo, collapse, unload, formatMedTime,
} from '../lib/meditationPlayer';
import { colors, radius, font } from '../constants/theme';
import * as haptics from '../lib/haptics';

// The full-screen player. Opening a meditation anywhere brings it up over the
// tabs; the chevron (or a swipe down) collapses it into the mini player, and
// the X stops the session. A meditation is an eyes-closed sitting, so the
// screen gives the painting room and keeps only the controls that matter:
// no speed control, because the silences are the practice.
export function FullMeditationPlayer() {
  const player = useMeditationPlayer();
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = Dimensions.get('window');
  const slide = useRef(new Animated.Value(H)).current;
  const [mounted, setMounted] = useState(false);
  // Keep the last meditation while sliding away, so the closing screen
  // doesn't go blank mid-animation after X clears currentMedId.
  const lastMed = useRef(null);
  const med = MEDITATIONS[player.currentMedId] || lastMed.current;
  if (MEDITATIONS[player.currentMedId]) lastMed.current = MEDITATIONS[player.currentMedId];

  const show = player.expanded && !!player.currentMedId;
  useEffect(() => {
    if (show) {
      setMounted(true);
      Animated.timing(slide, { toValue: 0, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    } else if (mounted) {
      Animated.timing(slide, { toValue: H, duration: 260, easing: Easing.in(Easing.cubic), useNativeDriver: true })
        .start(() => setMounted(false));
    }
  }, [show]);

  // Swipe down anywhere above the scrubber to collapse.
  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => g.dy > 8 && Math.abs(g.dy) > Math.abs(g.dx) * 1.5,
    onPanResponderMove: (_, g) => { if (g.dy > 0) slide.setValue(g.dy); },
    onPanResponderRelease: (_, g) => {
      if (g.dy > 120 || g.vy > 0.8) collapse();
      else Animated.spring(slide, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
    },
  })).current;

  // Scrubber: drag or tap anywhere on the track. While dragging, the thumb
  // follows the finger and the audio seeks once, on release.
  const trackW = useRef(1);
  const [dragPos, setDragPos] = useState(null);
  const durRef = useRef(0);
  durRef.current = player.duration;
  const posAt = x => Math.max(0, Math.min(1, x / trackW.current)) * durRef.current;
  const scrub = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: e => setDragPos(posAt(e.nativeEvent.locationX)),
    onPanResponderMove: e => setDragPos(posAt(e.nativeEvent.locationX)),
    onPanResponderRelease: e => { seekTo(posAt(e.nativeEvent.locationX)); setDragPos(null); },
    onPanResponderTerminate: () => setDragPos(null),
  })).current;

  if (!mounted || !med) return null;

  const position = dragPos ?? player.position;
  const duration = player.duration;
  const progress = duration > 0 ? Math.min(1, position / duration) : 0;
  const art = Math.min(W - 56, H * 0.42);

  return (
    <Animated.View style={[s.root, { transform: [{ translateY: slide }] }]} {...pan.panHandlers}>
      {/* The painting, blurred, as the room's light */}
      <Image source={med.image} style={StyleSheet.absoluteFill} resizeMode="cover" blurRadius={60} />
      <LinearGradient
        colors={['rgba(10,10,10,0.55)', 'rgba(10,10,10,0.75)', colors.bg]}
        locations={[0, 0.5, 0.9]}
        style={StyleSheet.absoluteFill}
      />

      <View style={[s.topRow, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => { haptics.tap(); unload(); }} style={s.iconBtn} accessibilityLabel="Stop and close">
          <Ionicons name="close" size={28} color={colors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={collapse} style={s.iconBtn} accessibilityLabel="Minimize player">
          <Ionicons name="chevron-down" size={28} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <View style={[s.body, { paddingBottom: insets.bottom + 40 }]}>
        <Image source={med.image} style={[s.art, { width: art, height: art }]} resizeMode="cover" />

        <View style={s.textBlock}>
          <Text style={s.eyebrow}>{med.subtitle} · {med.duration}</Text>
          <Text style={s.title}>{med.title}</Text>
          <Text style={s.desc} numberOfLines={3}>{med.description}</Text>
        </View>

        <View
          style={s.trackHit}
          onLayout={e => { trackW.current = e.nativeEvent.layout.width || 1; }}
          {...scrub.panHandlers}
        >
          <View style={s.track} pointerEvents="none">
            <View style={[s.trackFill, { width: `${progress * 100}%` }]} />
          </View>
          <View style={[s.thumb, dragPos != null && s.thumbActive, { left: `${progress * 100}%` }]} pointerEvents="none" />
        </View>
        <View style={s.timeRow}>
          <Text style={s.time}>{formatMedTime(position)}</Text>
          <Text style={s.time}>{duration > 0 ? `−${formatMedTime(duration - position)}` : med.duration}</Text>
        </View>

        <View style={s.controls}>
          <TouchableOpacity style={s.skipBtn} onPress={() => seek(-15)} accessibilityLabel="Back 15 seconds">
            <MaterialCommunityIcons name="rewind-15" size={34} color={colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity style={s.playBtn} onPress={() => { haptics.tap(); toggle(med); }} accessibilityLabel={player.isPlaying ? 'Pause' : 'Play'}>
            {player.isLoading ? (
              <ActivityIndicator color={colors.bg} />
            ) : (
              <Ionicons name={player.isPlaying ? 'pause' : 'play'} size={32} color={colors.bg} style={!player.isPlaying && { marginLeft: 4 }} />
            )}
          </TouchableOpacity>
          <TouchableOpacity style={s.skipBtn} onPress={() => seek(15)} accessibilityLabel="Forward 15 seconds">
            <MaterialCommunityIcons name="fast-forward-15" size={34} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.bg, overflow: 'hidden' },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, paddingHorizontal: 28, justifyContent: 'space-evenly' },
  art: { alignSelf: 'center', borderRadius: radius.md, backgroundColor: '#000' },
  textBlock: {},
  eyebrow: { fontSize: font.labelSize, color: colors.accent, letterSpacing: font.sectionTracking, fontFamily: font.bodyMedium, textTransform: 'uppercase', marginBottom: 10 },
  title: { fontSize: 28, lineHeight: 34, fontFamily: font.bodySemiBold, color: colors.textPrimary, marginBottom: 8 },
  desc: { fontSize: 15, lineHeight: 22, color: colors.textSecondary },
  trackHit: { height: 28, justifyContent: 'center' },
  track: { height: 3, borderRadius: 1.5, backgroundColor: 'rgba(255,255,255,0.18)', overflow: 'hidden' },
  trackFill: { height: '100%', backgroundColor: colors.accent },
  thumb: { position: 'absolute', width: 14, height: 14, borderRadius: 7, marginLeft: -7, backgroundColor: colors.accent },
  thumbActive: { width: 20, height: 20, borderRadius: 10, marginLeft: -10 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -2 },
  time: { fontSize: 12, color: colors.textSecondary, fontVariant: ['tabular-nums'] },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 44 },
  playBtn: { width: 76, height: 76, borderRadius: 38, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  skipBtn: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
});
