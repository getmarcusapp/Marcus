import React from 'react';
import { View, Text, Image, StyleSheet, SafeAreaView, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, radius, font } from '../constants/theme';
import { GoldPrimary } from '../components/GoldButton';

// Background sized to the literal window, matching Practice/More (see index.jsx).
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// Post-paywall confirmation screen. Sits between the paywall and the
// Practice tab so the "your practice begins now" moment lands after the
// commercial step rather than before it. Reached via router.replace
// from the paywall when the source was onboarding (?from=onboarding).
export default function ReadyScreen() {
  const router = useRouter();

  return (
    <View style={s.root}>
      <Image
        source={require('../assets/bg-svg4.png')}
        style={s.bg}
        resizeMode="cover"
        pointerEvents="none"
      />
      <SafeAreaView style={s.safe}>
        <View style={s.body}>
          <Image source={require('../assets/skull-gold.png')} style={s.skull} resizeMode="contain" />
          <Text style={s.title}>Your practice{'\n'}begins now</Text>
          <Text style={s.streak}>Day 1</Text>
        </View>
        <View style={s.footer}>
          <GoldPrimary
            style={s.primaryBtn}
            onPress={() => router.replace('/')}
          >
            <Text style={s.primaryBtnText}>Go to Practice →</Text>
          </GoldPrimary>
        </View>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#050505', overflow: 'hidden' },
  bg: { position: 'absolute', top: 0, left: 0, width: SCREEN_W, height: SCREEN_H },
  safe: { flex: 1, backgroundColor: 'transparent' },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
    paddingBottom: 40,
  },
  // Larger skull per V's new design (180 → 200) — sits as a stronger
  // anchor in the upper third before the title/streak stack.
  skull: { width: 200, height: 200, marginBottom: 32, opacity: 1 },
  title: {
    fontSize: 44,
    fontFamily: font.display,
    color: '#FFFFFF',
    letterSpacing: -1.5,
    marginBottom: 32,
    textAlign: 'center',
    lineHeight: 52,
  },
  // "Day 1" gets the Didot display font per V's new design (was plain
  // Inter at 56pt bold). Pairs visually with the title above and sits
  // between the title and the date below.
  streak: {
    fontSize: 64,
    fontFamily: font.display,
    color: colors.accent,
    letterSpacing: -1,
    textAlign: 'center',
    marginBottom: 8,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  // H56 per library — matches onboarding primaryBtn + paywall cta.
  primaryBtn: {
    borderRadius: radius.md,
    height: 56,
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000',
    letterSpacing: 0.3,
  },
});
