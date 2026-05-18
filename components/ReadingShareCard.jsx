import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, font } from '../constants/theme';

// 1080×1920 share card (9:16, fits iOS Story / Instagram crop) styled in
// the same visual register as the in-app heroes: dark gradient over a
// classical artwork backdrop with serif quote and gold attribution.
//
// The wrapping <View> is rendered off-screen but laid out at full size;
// captureRef serializes it to a PNG/JPEG for the share sheet.
//
// Backdrop: Friedrich's "Wanderer above the Sea of Fog" — already used as
// the View-From-Above meditation hero, well-known, instantly recognizable.

const SHARE_BG = require('../assets/meditations/img/view-from-above.jpg');

export const SHARE_CARD_WIDTH = 1080;
export const SHARE_CARD_HEIGHT = 1920;

export function ReadingShareCard({ quote, author, work }) {
  return (
    <View style={s.card}>
      <Image source={SHARE_BG} style={s.bg} resizeMode="cover" />
      <LinearGradient
        colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0.78)', 'rgba(0,0,0,0.95)']}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={s.content}>
        <Text style={s.eyebrow}>From Marcus</Text>

        <Text style={s.quote} numberOfLines={14}>
          "{quote}"
        </Text>

        <View style={s.divider} />

        <Text style={s.author}>{author?.toUpperCase?.()}</Text>
        {work ? <Text style={s.work}>{work}</Text> : null}
      </View>

      <View style={s.footer}>
        <Text style={s.brand}>MARCUS</Text>
        <Text style={s.tagline}>A daily Stoic practice</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    width: SHARE_CARD_WIDTH,
    height: SHARE_CARD_HEIGHT,
    backgroundColor: '#000',
    overflow: 'hidden',
    position: 'relative',
  },
  bg: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },

  content: {
    position: 'absolute',
    left: 80,
    right: 80,
    top: 240,
    bottom: 280,
    justifyContent: 'center',
  },
  eyebrow: {
    fontSize: 28,
    letterSpacing: 6,
    color: colors.accent,
    fontFamily: font.bodyMedium, textTransform: 'uppercase',
    marginBottom: 56,
  },
  quote: {
    fontSize: 56,
    color: colors.textPrimary,
    fontFamily: font.serif,
    lineHeight: 78,
    marginBottom: 56,
  },
  divider: {
    width: 80,
    height: 1.5,
    backgroundColor: colors.accentDim,
    marginBottom: 32,
  },
  author: {
    fontSize: 24,
    letterSpacing: 4,
    color: colors.accent,
    fontFamily: font.bodyMedium,
    marginBottom: 6,
  },
  work: {
    fontSize: 22,
    color: colors.textMuted,
    fontStyle: 'italic',
    fontFamily: font.serif,
  },

  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 100,
    alignItems: 'center',
  },
  brand: {
    fontSize: 28,
    letterSpacing: 12,
    color: colors.textPrimary,
    fontFamily: font.wordmark,
    marginBottom: 8,
  },
  tagline: {
    fontSize: 18,
    letterSpacing: 1,
    color: colors.textMuted,
    fontFamily: font.serif,
    fontStyle: 'italic',
  },
});
