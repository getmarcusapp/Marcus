import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/theme';
import { useIsSaved, toggleSaved } from '../lib/saved';
import * as haptics from '../lib/haptics';
import { track } from '../lib/analytics';

// The heart does two jobs, which is why it is one control rather than two.
//
// On a quote you have not kept, it is the save button. On a line resurfaced by
// lib/saved.js on the Practice screen, it renders already filled, which is how
// you recognize the line as one of your own without a "you kept this" label.
// The state IS the marker.
export function SaveHeart({ text, author, work, from, size = 20, style }) {
  const saved = useIsSaved(text);

  async function onPress() {
    const nowSaved = await toggleSaved({ text, author, work, from });
    // Success haptic on save, a lighter tap on unsave: keeping something should
    // feel like a small event, letting it go should not.
    if (nowSaved) haptics.success(); else haptics.tap();
    track(nowSaved ? 'line_saved' : 'line_unsaved', { from: from || 'unknown' });
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      activeOpacity={0.7}
      style={[s.btn, style]}
      accessibilityRole="button"
      accessibilityLabel={saved ? 'Remove from saved' : 'Save this line'}
    >
      <Ionicons
        name={saved ? 'heart' : 'heart-outline'}
        size={size}
        color={saved ? colors.accent : colors.textSecondary}
      />
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  btn: { padding: 4 },
});
