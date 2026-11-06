import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { usePathname } from 'expo-router';
import {
  MEDITATIONS, useMeditationPlayer,
  toggle, seek, unload, expand, formatMedTime,
} from '../lib/meditationPlayer';
import { colors, radius, font } from '../constants/theme';

const TAB_BAR_HEIGHT = 84;

// Approximate rendered height of the mini player (progress bar + body).
// Tab screens add this as bottom padding to their scrolls when the player
// is active so the last row isn't hidden behind the overlay.
export const MINI_PLAYER_HEIGHT = 64;

export function useMiniPlayerInset() {
  const player = useMeditationPlayer();
  return player.currentMedId ? MINI_PLAYER_HEIGHT : 0;
}

// Routes where the mini-player should NOT show: onboarding/paywall hide the
// tab bar. The Meditate tab shows it like everywhere else, now that the full
// player is its own screen (components/FullMeditationPlayer.jsx).
const HIDDEN_ROUTES = new Set(['/onboarding', '/paywall', '/ready', '/welcome']);

export function MiniMeditationPlayer() {
  const pathname = usePathname();
  const player = useMeditationPlayer();

  if (!player.currentMedId) return null;
  if (player.expanded || HIDDEN_ROUTES.has(pathname)) return null;
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
          onPress={expand}
          activeOpacity={0.7}
        >
          <Text style={s.title} numberOfLines={1}>{med.title}</Text>
          <Text style={s.time}>
            {formatMedTime(player.position)} · {formatMedTime(player.duration)}
          </Text>
        </TouchableOpacity>
        <View style={s.controls}>
          <TouchableOpacity onPress={() => seek(-15)} style={s.skipBtn}>
            <MaterialCommunityIcons name="rewind-15" size={26} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => toggle(med)} style={s.playBtn}>
            <View style={s.playCircle}>
              {player.isLoading ? (
                <ActivityIndicator color={colors.accent} size="small" />
              ) : (
                <Ionicons
                  name={player.isPlaying ? 'pause' : 'play'}
                  size={20}
                  color={colors.accent}
                  style={!player.isPlaying && { marginLeft: 2 }}
                />
              )}
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => seek(15)} style={s.skipBtn}>
            <MaterialCommunityIcons name="fast-forward-15" size={26} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => unload()} style={s.closeBtn}>
            <Ionicons name="close" size={22} color={colors.textSecondary} />
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
  title: { fontSize: 13, color: colors.textPrimary, fontFamily: font.bodyMedium },
  time: { fontSize: 11, color: colors.textSecondary, marginTop: 2, letterSpacing: 0.3 },
  controls: { flexDirection: 'row', alignItems: 'center' },
  // 44pt tap targets per Apple HIG; consistent square buttons so spacing
  // is visually even and fat-fingering doesn't hit the wrong control.
  skipBtn: {
    width: 44, height: 44,
    alignItems: 'center', justifyContent: 'center',
  },
  playBtn: {
    width: 44, height: 44,
    alignItems: 'center', justifyContent: 'center',
  },
  playCircle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.bg,
    borderWidth: 0.5, borderColor: colors.accentDim,
    alignItems: 'center', justifyContent: 'center',
  },
  closeBtn: {
    width: 44, height: 44,
    alignItems: 'center', justifyContent: 'center',
  },
});
