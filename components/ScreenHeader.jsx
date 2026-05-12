import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '../constants/theme';

// Sticky top bar with a single back text-link. Used on every screen that
// isn't part of the daily-practice flow (those use PracticeHeader instead).
// Same chrome — bgDeep bg, paddingHorizontal 18, paddingTop 8, paddingBottom 14,
// border-bottom — so the two headers feel like one design system.
export function ScreenHeader({ fromPath = '/', fromLabel = 'Back', onBack }) {
  const router = useRouter();
  function handleBack() {
    if (onBack) return onBack();
    router.replace(fromPath);
  }
  return (
    <View style={s.wrap}>
      <TouchableOpacity
        onPress={handleBack}
        style={s.backBtn}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        activeOpacity={0.7}
      >
        <Text style={s.backText}>{`‹  ${fromLabel}`}</Text>
      </TouchableOpacity>
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
  backBtn: { paddingVertical: 4, paddingRight: 12, alignSelf: 'flex-start' },
  backText: { fontSize: 13, color: colors.accent, letterSpacing: 0.8, textTransform: 'uppercase', fontWeight: '500' },
});
