import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, font } from '../constants/theme';

// 1080×1920 share card for a sealed weekly review.
// Backdrop: Friedrich's Two Men Contemplating the Moon — already used as
// the Weekly Review hero. Felt right for the Sunday-reckoning moment.

const SHARE_BG = require('../assets/heroes/review.jpg');

export const SHARE_CARD_WIDTH = 1080;
export const SHARE_CARD_HEIGHT = 1920;

function virtueLabel(id) {
  if (!id) return null;
  // Map id -> display name without importing the full virtues array
  // (avoids accidental coupling on order changes).
  const names = { wisdom: 'Wisdom', courage: 'Courage', moderation: 'Temperance', justice: 'Justice' };
  return names[id] || id;
}

export function ReviewShareCard({ weekOf, bestVirtue, intention }) {
  const best = virtueLabel(bestVirtue);
  // Truncate intention generously so it always fits the layout.
  const intentionText = (intention || '').trim();
  const truncated = intentionText.length > 280
    ? intentionText.slice(0, 277).trimEnd() + '…'
    : intentionText;

  return (
    <View style={s.card}>
      <Image source={SHARE_BG} style={s.bg} resizeMode="cover" />
      <LinearGradient
        colors={['rgba(0,0,0,0.5)', 'rgba(0,0,0,0.8)', 'rgba(0,0,0,0.95)']}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={s.content}>
        <Text style={s.eyebrow}>Sunday reckoning</Text>
        <Text style={s.weekTitle}>Week of {weekOf}</Text>

        {best ? (
          <>
            <View style={s.divider} />
            <Text style={s.virtueLabel}>Most embodied</Text>
            <Text style={s.virtueName}>{best}</Text>
          </>
        ) : null}

        {truncated ? (
          <>
            <View style={s.divider} />
            <Text style={s.intentionLabel}>Intention for the week ahead</Text>
            <Text style={s.intentionText}>{truncated}</Text>
          </>
        ) : null}
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
    top: 220,
    bottom: 280,
    justifyContent: 'center',
  },
  eyebrow: {
    fontSize: 28,
    letterSpacing: 6,
    color: colors.accent,
    textTransform: 'uppercase',
    marginBottom: 28,
    fontWeight: '500',
  },
  weekTitle: {
    fontSize: 64,
    color: colors.textPrimary,
    fontFamily: font.serif,
    fontWeight: '300',
    letterSpacing: -1.5,
    lineHeight: 76,
  },
  divider: {
    width: 80,
    height: 1.5,
    backgroundColor: colors.accentDim,
    marginVertical: 40,
  },
  virtueLabel: {
    fontSize: 22,
    letterSpacing: 4,
    color: colors.accent,
    textTransform: 'uppercase',
    marginBottom: 14,
    fontWeight: '500',
  },
  virtueName: {
    fontSize: 56,
    color: colors.textPrimary,
    fontFamily: font.serif,
    fontWeight: '300',
    letterSpacing: -1,
  },
  intentionLabel: {
    fontSize: 22,
    letterSpacing: 4,
    color: colors.accent,
    textTransform: 'uppercase',
    marginBottom: 18,
    fontWeight: '500',
  },
  intentionText: {
    fontSize: 38,
    color: colors.textSecondary,
    fontFamily: font.serif,
    lineHeight: 56,
    fontStyle: 'italic',
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
    fontWeight: '300',
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
