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

export function ReviewShareCard({ weekOf, bestVirtue, intention, stats }) {
  const best = virtueLabel(bestVirtue);
  const intentionText = (intention || '').trim();
  const truncated = intentionText.length > 240
    ? intentionText.slice(0, 237).trimEnd() + '…'
    : intentionText;

  const journaled = stats?.journaled ?? 0;
  const reframed = stats?.reframed ?? 0;
  const statBits = [];
  if (journaled > 0) statBits.push(`${journaled}/7 days journaled`);
  if (reframed > 0) statBits.push(`${reframed} reframed`);
  const statsLine = statBits.length ? statBits.join(' · ') : null;

  return (
    <View style={s.card}>
      <Image source={SHARE_BG} style={s.bg} resizeMode="cover" />
      <LinearGradient
        colors={['rgba(0,0,0,0.2)', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.92)']}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={s.content}>
        <Text style={s.eyebrow}>Sunday reckoning</Text>
        <Text style={s.weekTitle}>Week of{'\n'}{weekOf}</Text>

        {statsLine ? <Text style={s.statsLine}>{statsLine}</Text> : null}

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
            <Text style={s.intentionText}>"{truncated}"</Text>
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
    top: 200,
    bottom: 260,
    justifyContent: 'center',
  },
  eyebrow: {
    fontSize: 30,
    letterSpacing: 6,
    color: colors.accent,
    fontFamily: font.bodyMedium, textTransform: 'uppercase',
    marginBottom: 36,
  },
  weekTitle: {
    fontSize: 96,
    color: colors.textPrimary,
    fontFamily: font.serif,
    fontWeight: '300',
    letterSpacing: -2,
    lineHeight: 104,
  },
  statsLine: {
    fontSize: 24,
    color: colors.textMuted,
    letterSpacing: 1,
    marginTop: 28,
    fontFamily: font.serif,
    fontStyle: 'italic',
  },
  divider: {
    width: 100,
    height: 1.5,
    backgroundColor: colors.accentDim,
    marginVertical: 44,
  },
  virtueLabel: {
    fontSize: 22,
    letterSpacing: 4,
    color: colors.accent,
    fontFamily: font.bodyMedium, textTransform: 'uppercase',
    marginBottom: 14,
  },
  virtueName: {
    fontSize: 64,
    color: colors.textPrimary,
    fontFamily: font.serif,
    fontWeight: '300',
    letterSpacing: -1,
  },
  intentionLabel: {
    fontSize: 22,
    letterSpacing: 4,
    color: colors.accent,
    fontFamily: font.bodyMedium, textTransform: 'uppercase',
    marginBottom: 18,
  },
  intentionText: {
    fontSize: 36,
    color: colors.textSecondary,
    fontFamily: font.serif,
    lineHeight: 52,
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
