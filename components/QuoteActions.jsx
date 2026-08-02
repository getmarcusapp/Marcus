import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/theme';
import { SaveHeart } from './SaveHeart';

// The heart + share pair that sits under every quote surface: the Practice
// screen, the daily reading, both journal landings and the weekly review.
// One component so the order, spacing and icon sizes cannot drift apart as
// they get added to more places.
//
// The caller owns the share itself (via lib/useQuoteShare) rather than this
// component owning it, because the off-screen capture card has to be mounted
// near the screen root — nested inside a card it risks being clipped, which
// yields a blank image.
export function QuoteActions({ text, author, work, from, onShare, size = 18, style }) {
  return (
    <View style={[s.row, style]}>
      <SaveHeart text={text} author={author} work={work} from={from} size={size} />
      <TouchableOpacity
        onPress={() => onShare({ text, author, work })}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        activeOpacity={0.7}
        style={s.btn}
        accessibilityRole="button"
        accessibilityLabel="Share this passage"
      >
        <Ionicons name="arrow-redo-outline" size={size - 1} color={colors.textSecondary} />
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  btn: { padding: 4 },
});
