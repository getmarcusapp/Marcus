import React from 'react';
import { View, Text, ActivityIndicator, Image, StyleSheet } from 'react-native';
import { colors, radius, font } from '../constants/theme';

export default function SkullLoader({ text }) {
  return (
    <View style={s.card}>
      <Image source={require('../assets/skull-gold.png')} style={s.skull} resizeMode="contain" />
      <ActivityIndicator size="small" color={colors.accent} style={{ marginTop: 20, marginBottom: 8 }} />
      {text ? <Text style={s.text}>{text}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.md,
    backgroundColor: colors.bgDeep, padding: 40, alignItems: 'center', minHeight: 320,
    justifyContent: 'center',
  },
  skull: { width: 160, height: 160, opacity: 0.9, marginBottom: 16 },
  text: { fontSize: 14, color: colors.textSecondary, marginTop: 4, fontFamily: font.body },
});
