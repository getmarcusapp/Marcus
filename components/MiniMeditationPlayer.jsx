import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import {
  MEDITATIONS, useMeditationPlayer,
  toggle, seek, unload, formatMedTime,
} from '../lib/meditationPlayer';
import { colors, radius } from '../constants/theme';

const TAB_BAR_HEIGHT = 84;

// Routes where the mini-player should NOT show: the full meditate screen
// already has its own player, and onboarding/paywall hide the tab bar.
const HIDDEN_ROUTES = new Set(['/meditate', '/onboarding', '/paywall']);

export function MiniMeditationPlayer() {
  const router = useRouter();
  const pathname = usePathname();
  const player = useMeditationPlayer();

  if (!player.currentMedId) return null;
  if (HIDDEN_ROUTES.has(pathname)) return null;
  const med = MEDITATIONS[player.currentMedId];
  if (!med) return null;

  const progress = player.duration > 0 ? player.position / player.duration : 0;

  return (
    <View style={s.container}>
      <View style={s.progressBar}>
        <View style={[s.progressFill, { flex: progress }]} />
        <View style={{ flex: Math.max(0, 1 - progress) }} />
      </View>
      <View style={s.body}>
        <TouchableOpacity
          style={s.titleArea}
          onPress={() => router.push({ pathname: '/meditate', params: { id: med.id } })}
          activeOpacity={0.7}
        >
          <Text style={s.title} numberOfLines={1}>{med.title}</Text>
          <Text style={s.time}>
            {formatMedTime(player.position)} · {formatMedTime(player.duration)}
          </Text>
        </TouchableOpacity>
        <View style={s.controls}>
          <TouchableOpacity onPress={() => seek(-15)} style={s.skipBtn}>
            <Ionicons name="play-back" size={24} color={colors.textSecondary} />
            <Text style={s.skipLabel}>15</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => toggle(med)} style={s.playBtn}>
            {player.isLoading ? (
              <ActivityIndicator color={colors.accent} size="small" />
            ) : (
              <Ionicons name={player.isPlaying ? 'pause' : 'play'} size={28} color={colors.accent} />
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => seek(15)} style={s.skipBtn}>
            <Ionicons name="play-forward" size={24} color={colors.textSecondary} />
            <Text style={s.skipLabel}>15</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => unload()} style={s.closeBtn}>
            <Ionicons name="close" size={22} color={colors.textDim} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0, right: 0,
    bottom: TAB_BAR_HEIGHT,
    backgroundColor: '#0a0a0a',
    borderTopWidth: 0.5,
    borderTopColor: colors.border,
  },
  progressBar: {
    height: 1.5,
    backgroundColor: colors.border,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  progressFill: { backgroundColor: colors.accent },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 8,
    paddingVertical: 8,
    gap: 8,
  },
  titleArea: { flex: 1 },
  title: { fontSize: 13, color: colors.textPrimary, fontWeight: '500' },
  time: { fontSize: 11, color: colors.textDim, marginTop: 2, letterSpacing: 0.3 },
  controls: { flexDirection: 'row', alignItems: 'center' },
  // 44pt tap targets per Apple HIG; consistent square buttons so spacing
  // is visually even and fat-fingering doesn't hit the wrong control.
  skipBtn: {
    width: 44, height: 44,
    alignItems: 'center', justifyContent: 'center',
  },
  skipLabel: { fontSize: 10, color: colors.textDim, marginTop: -2, letterSpacing: 0.3, fontWeight: '500' },
  playBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  closeBtn: {
    width: 44, height: 44,
    alignItems: 'center', justifyContent: 'center',
  },
});
