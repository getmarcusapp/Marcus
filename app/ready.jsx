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
  // Skull at the app's standard logo scale (150) — matches the Practice /
  // sealed hero so the logo never changes size between screens (per V).
  skull: { width: 150, height: 150, marginBottom: 28, opacity: 1 },
  title: {
    fontSize: 44,
    fontFamily: font.display,
    color: '#FFFFFF',
    letterSpacing: -1.5,
    marginBottom: 32,
    textAlign: 'center',
    lineHeight: 52,
  },
  // "Day 1" at the app's standard gold "Day N" scale (48) — matches the
  // Practice / sealed hero streak so typography stays consistent (per V).
  streak: {
    fontSize: 48,
    fontFamily: font.display,
    color: colors.accent,
    letterSpacing: -0.5,
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
    minHeight: 56,
  },
  primaryBtnText: {
    fontSize: 15,
    fontFamily: font.bodyBold,
    color: '#000',
    letterSpacing: 0.3,
  },
});
