import React from 'react';
import { View, Text, Image, StyleSheet, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius, font } from '../constants/theme';
import { GoldPrimary } from '../components/GoldButton';

const HERO_GRADIENT = ['#3D2D12', '#150E08', '#000000'];

// Post-paywall confirmation screen. Sits between the paywall and the
// Practice tab so the "your practice begins now" moment lands after the
// commercial step rather than before it. Reached via router.replace
// from the paywall when the source was onboarding (?from=onboarding).
export default function ReadyScreen() {
  const router = useRouter();
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <LinearGradient
      colors={HERO_GRADIENT}
      locations={[0, 0.6, 1]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={{ flex: 1 }}
    >
      <SafeAreaView style={s.safe}>
        <View style={s.body}>
          <Image source={require('../assets/skull.png')} style={s.skull} resizeMode="contain" />
          <Text style={s.eyebrow}>Memento mori</Text>
          <Text style={s.title}>Your practice{'\n'}begins now</Text>
          <Text style={s.date}>{dateStr}</Text>
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
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'transparent' },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
    paddingBottom: 40,
  },
  skull: { width: 180, height: 180, marginBottom: 28, opacity: 1 },
  eyebrow: {
    fontSize: font.labelSize,
    letterSpacing: font.sectionTracking,
    color: colors.accent,
    fontFamily: font.bodyMedium, textTransform: 'uppercase',
    marginBottom: 14,
    textAlign: 'center',
  },
  title: {
    fontSize: 44,
    fontFamily: font.display,
    color: '#FFFFFF',
    letterSpacing: -1.5,
    marginBottom: 16,
    textAlign: 'center',
    lineHeight: 52,
  },
  date: {
    fontSize: 18,
    color: colors.textMuted,
    marginBottom: 20,
    textAlign: 'center',
  },
  streak: {
    fontSize: 56,
    fontWeight: '700',
    color: colors.accent,
    letterSpacing: -1,
    textAlign: 'center',
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
