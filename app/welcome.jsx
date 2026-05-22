import React from 'react';
import { View, Text, Image, ImageBackground, StyleSheet, SafeAreaView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { colors, radius, font } from '../constants/theme';
import { GoldPrimary } from '../components/GoldButton';
import { useEntitlement } from '../lib/useEntitlement';

// Post-paywall threshold moment for non-onboarding subscribers — existing
// users who upgrade from a locked surface. The onboarding flow has its own
// "Day 1" moment in /ready; this screen is the same visual language without
// the Day-1 assumption, since these users may already have practice history.
//
// Routed from app/paywall.jsx after a successful purchase when the source
// was NOT onboarding. The `next` param carries the post-welcome destination;
// defaults to '/'. The tab bar is hidden on this route (see app/_layout.jsx).
export default function WelcomeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const next = params?.next || '/';
  const { subscriptionPeriod } = useEntitlement();
  // RevenueCat reports TRIAL during the 7-day intro; NORMAL once paid.
  // Copy adapts so the "trial active" callout only appears for trial users.
  const isTrial = subscriptionPeriod === 'TRIAL';

  return (
    <ImageBackground
      source={require('../assets/bg.png')}
      style={{ flex: 1 }}
      resizeMode="cover"
    >
      <SafeAreaView style={s.safe}>
        <View style={s.body}>
          <Image source={require('../assets/skull.png')} style={s.skull} resizeMode="contain" />
          <Text style={s.eyebrow}>Welcome</Text>
          <Text style={s.title}>Marcus{'\n'}is yours</Text>
          <Text style={s.sub}>
            {isTrial
              ? 'Your 7-day trial is active. The practice runs uninterrupted.'
              : 'Your subscription is active. The practice runs uninterrupted.'}
          </Text>
        </View>
        <View style={s.footer}>
          <GoldPrimary
            style={s.primaryBtn}
            onPress={() => router.replace(next)}
          >
            <Text style={s.primaryBtnText}>Continue →</Text>
          </GoldPrimary>
        </View>
      </SafeAreaView>
    </ImageBackground>
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
  sub: {
    fontSize: 16,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 8,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  // H56 per library — matches onboarding primaryBtn / paywall cta / ready.
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
