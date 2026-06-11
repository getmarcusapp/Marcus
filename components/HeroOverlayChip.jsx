import React from 'react';
import {
  Text, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, font } from '../constants/theme';
import { GoldSecondary } from './GoldButton';

// Small chip designed to sit inline next to the page title on hero screens
// (Past readings / Past entries / Past triggers / Past reviews). Matches the
// EDIT-button library token Valeriya defined: borderRadius 4, 0.5pt flat
// gold stroke, no fill, uppercase 12pt accent label, forward-arrow icon.
//
// Caller places the chip in the layout (typically a flex row with the title);
// the chip itself is just a styled GoldSecondary. Sits in the hero's bottom
// gradient zone so the gold stroke + label read against the darkened image
// without an extra backdrop.
export function HeroOverlayChip({ onPress, children, iconName = 'arrow-forward' }) {
  return (
    <GoldSecondary
      onPress={onPress}
      style={s.chip}
      contentStyle={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
      borderWidth={0.5}
      flatStroke
    >
      <Text style={s.chipText}>{children}</Text>
      <Ionicons name={iconName} size={14} color={colors.accent} style={{ marginTop: 2 }} />
    </GoldSecondary>
  );
}

const s = StyleSheet.create({
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 4,
  },
  chipText: {
    fontSize: 12,
    // bodyMedium matches the EDIT-button library token this chip mirrors
    // (the old fontWeight '600' was ignored — the family has one face).
    fontFamily: font.bodyMedium,
    color: colors.accent,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});
