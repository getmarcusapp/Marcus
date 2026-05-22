import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, font } from '../constants/theme';

// Sticky top chrome for multi-step flows (journal wizard, weekly review wizard,
// etc.). Mirrors PracticeHeader's visual language — title row + segmented
// progress bar — but the back chevron and segments are scoped to the wizard's
// internal navigation, not the practice-level chevrons. Use PracticeHeader on
// landing screens (where cross-practice nav matters) and swap to this once the
// user enters a focused write flow.
export function WizardHeader({ title, step, total, onBack, onClose }) {
  return (
    <View style={s.wrap}>
      <View style={s.titleRow}>
        <TouchableOpacity
          onPress={onBack}
          style={s.iconBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={22} color={colors.accent} />
        </TouchableOpacity>
        <Text style={s.titleText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
          {title}
        </Text>
        {onClose ? (
          <TouchableOpacity
            onPress={onClose}
            style={s.iconBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={22} color={colors.accent} />
          </TouchableOpacity>
        ) : (
          // Symmetry spacer so the title stays optically centered when there's
          // no close action. Width matches iconBtn's hit area.
          <View style={s.rightSpacer} />
        )}
      </View>
      <View style={s.segmentsRow}>
        {Array.from({ length: total }).map((_, i) => (
          <View
            key={i}
            style={[
              s.segment,
              i < step && s.segmentDone,
              i === step && s.segmentCurrent,
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    backgroundColor: colors.bgDeep,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 14,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  iconBtn: { paddingVertical: 4, paddingHorizontal: 8, minWidth: 24 },
  rightSpacer: { width: 38 },
  titleText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 15,
    color: colors.textPrimary,
    letterSpacing: 0.5,
    fontFamily: font.bodyMedium,
  },
  segmentsRow: { flexDirection: 'row', gap: 6 },
  segment: { flex: 1, height: 3, borderRadius: 2, backgroundColor: colors.border },
  segmentCurrent: { backgroundColor: colors.accentDim },
  segmentDone: { backgroundColor: colors.accent },
});
