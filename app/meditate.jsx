import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, SafeAreaView, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, font } from '../constants/theme';

const MEDITATIONS = [
  {
    id: 'view-from-above',
    title: 'The View From Above',
    subtitle: 'Perspective',
    duration: '5 min',
    description: 'Rise above your circumstances to see them at their actual scale.',
    time: 'Anytime',
    file: require('../assets/meditations/view-from-above.mp3'),
  },
  {
    id: 'premeditatio',
    title: 'Premeditatio Malorum',
    subtitle: 'Preparation',
    duration: '5 min',
    description: 'Look at what might go wrong before the day begins so it cannot surprise you.',
    time: 'Morning',
    file: require('../assets/meditations/premeditatio-malorum.mp3'),
  },
  {
    id: 'evening-examination',
    title: 'The Evening Examination',
    subtitle: 'Accounting',
    duration: '5 min',
    description: 'Ask three honest questions and put the day down.',
    time: 'Evening',
    file: require('../assets/meditations/evening-examination.mp3'),
  },
  {
    id: 'negative-visualization',
    title: 'Negative Visualization',
    subtitle: 'Gratitude',
    duration: '5 min',
    description: 'Imagine the absence of what you love to see it clearly.',
    time: 'Anytime',
    file: require('../assets/meditations/negative-visualization.mp3'),
  },
  {
    id: 'present-moment',
    title: 'The Present Moment',
    subtitle: 'Attention',
    duration: '5 min',
    description: 'Pure attention training. Not staying. Returning.',
    time: 'Anytime',
    file: require('../assets/meditations/present-moment.mp3'),
  },
];

function formatTime(ms) {
  if (!ms) return '0:00';
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

export default function MeditateScreen() {
  const router = useRouter();
  const soundRef = useRef(null);
  const [selected, setSelected] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      shouldDuckAndroid: true,
    });
    return () => {
      if (soundRef.current) soundRef.current.unloadAsync();
    };
  }, []);

  async function selectMeditation(med) {
    if (soundRef.current) {
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }
    setSelected(med);
    setIsPlaying(false);
    setPosition(0);
    setDuration(0);
  }

  async function togglePlay() {
    if (!selected) return;

    if (!soundRef.current) {
      setIsLoading(true);
      try {
        const { sound } = await Audio.Sound.createAsync(
          selected.file,
          { shouldPlay: true },
          onPlaybackStatus
        );
        soundRef.current = sound;
        setIsPlaying(true);
      } catch (e) {
        console.log('Audio error:', e);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    if (isPlaying) {
      await soundRef.current.pauseAsync();
      setIsPlaying(false);
    } else {
      await soundRef.current.playAsync();
      setIsPlaying(true);
    }
  }

  function onPlaybackStatus(status) {
    if (!status.isLoaded) return;
    setPosition(status.positionMillis);
    setDuration(status.durationMillis || 0);
    if (status.didJustFinish) {
      setIsPlaying(false);
      setPosition(0);
      soundRef.current.setPositionAsync(0);
    }
  }

  async function seek(direction) {
    if (!soundRef.current) return;
    const newPos = Math.max(0, Math.min(duration, position + direction * 15000));
    await soundRef.current.setPositionAsync(newPos);
    setPosition(newPos);
  }

  const progress = duration > 0 ? position / duration : 0;

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>

        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={20} color={colors.textMuted} />
            <Text style={s.backLabel}>More</Text>
          </TouchableOpacity>
          <Text style={s.eyebrow}>Meditations</Text>
          <Text style={s.title}>Stoic practice.</Text>
          <Text style={s.sub}>Ancient attention training for the modern day.</Text>
        </View>

        {/* Player */}
        {selected && (
          <View style={s.player}>
            <Text style={s.playerSubtitle}>{selected.subtitle}</Text>
            <Text style={s.playerTitle}>{selected.title}</Text>
            <Text style={s.playerDesc}>{selected.description}</Text>

            {/* Progress bar */}
            <View style={s.progressBar}>
              <View style={[s.progressFill, { flex: progress }]} />
              <View style={{ flex: 1 - progress }} />
            </View>
            <View style={s.timeRow}>
              <Text style={s.timeText}>{formatTime(position)}</Text>
              <Text style={s.timeText}>{formatTime(duration)}</Text>
            </View>

            {/* Controls */}
            <View style={s.controls}>
              <TouchableOpacity style={s.skipBtn} onPress={() => seek(-1)}>
                <Ionicons name="play-back" size={22} color={colors.textMuted} />
                <Text style={s.skipLabel}>15s</Text>
              </TouchableOpacity>

              <TouchableOpacity style={s.playBtn} onPress={togglePlay}>
                {isLoading ? (
                  <ActivityIndicator color={colors.bg} />
                ) : (
                  <Ionicons
                    name={isPlaying ? 'pause' : 'play'}
                    size={28}
                    color={colors.bg}
                  />
                )}
              </TouchableOpacity>

              <TouchableOpacity style={s.skipBtn} onPress={() => seek(1)}>
                <Ionicons name="play-forward" size={22} color={colors.textMuted} />
                <Text style={s.skipLabel}>15s</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Meditation list */}
        <View style={s.list}>
          <Text style={s.sectionLabel}>All meditations</Text>
          {MEDITATIONS.map(med => (
            <TouchableOpacity
              key={med.id}
              style={[s.medCard, selected?.id === med.id && s.medCardActive]}
              onPress={() => selectMeditation(med)}
              activeOpacity={0.7}
            >
              <View style={s.medLeft}>
                <View style={s.medIconWrap}>
                  <Ionicons
                    name={selected?.id === med.id && isPlaying ? 'pause-circle' : 'play-circle'}
                    size={36}
                    color={selected?.id === med.id ? colors.accent : colors.textDim}
                  />
                </View>
                <View style={s.medText}>
                  <Text style={[s.medTitle, selected?.id === med.id && s.medTitleActive]}>
                    {med.title}
                  </Text>
                  <Text style={s.medMeta}>{med.subtitle} · {med.time} · {med.duration}</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },

  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xl },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: spacing.lg },
  backLabel: { fontSize: font.labelSize, color: colors.textMuted, letterSpacing: 0.5 },
  eyebrow: { fontSize: font.labelSize, letterSpacing: 2, color: colors.accent, textTransform: 'uppercase', marginBottom: 8 },
  title: { fontSize: font.titleSize, fontWeight: '600', color: colors.textPrimary, marginBottom: 6 },
  sub: { fontSize: font.subSize, color: colors.textMuted, lineHeight: 22 },

  player: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    borderWidth: 0.5,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  playerSubtitle: { fontSize: font.labelSize, color: colors.accent, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 },
  playerTitle: { fontSize: 20, fontWeight: '600', color: colors.textPrimary, marginBottom: 8 },
  playerDesc: { fontSize: 14, color: colors.textMuted, lineHeight: 20, marginBottom: spacing.lg },

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
  timeText: { fontSize: 12, color: colors.textDim },

  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xl },
  playBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipBtn: { alignItems: 'center', gap: 2 },
  skipLabel: { fontSize: 10, color: colors.textDim },

  list: { paddingHorizontal: spacing.lg },
  sectionLabel: { fontSize: font.labelSize, color: colors.textDim, letterSpacing: 2, textTransform: 'uppercase', marginBottom: spacing.md },

  medCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  medCardActive: {},
  medLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 },
  medIconWrap: {},
  medText: { flex: 1 },
  medTitle: { fontSize: 15, fontWeight: '500', color: colors.textSecondary, marginBottom: 3 },
  medTitleActive: { color: colors.textPrimary },
  medMeta: { fontSize: 12, color: colors.textDim },
});
