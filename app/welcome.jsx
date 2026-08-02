import React from 'react';
import { View, Text, Image, StyleSheet, SafeAreaView, Dimensions } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { colors, radius, font } from '../constants/theme';

// Background sized to the literal window (not flex:1 / absoluteFill), matching
// the Practice/More fix — fills the screen 1:1 with no zoom. See app/index.jsx.
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
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
          <Text style={s.eyebrow}>Welcome</Text>
          <Image source={require('../assets/marcus-wordmark.png')} style={s.titleWordmark} resizeMode="contain" />
          <Text style={s.titleTagline}>is yours</Text>
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
  // 150 to match ready.jsx + the Practice/sealed hero — the logo holds the
  // same size across every threshold screen (per V), never resizing between them.
  skull: { width: 150, height: 150, marginBottom: 28, opacity: 1 },
  eyebrow: {
    fontSize: font.labelSize,
    letterSpacing: font.sectionTracking,
    color: colors.accent,
    fontFamily: font.bodyMedium, textTransform: 'uppercase',
    marginBottom: 14,
    textAlign: 'center',
  },
  // Marcus wordmark image + "is yours" tagline beneath it (replaces the
  // Cormorant "Marcus is yours" text heading). 1144×203 source (aspect ≈ 5.64);
  // explicit width+height at that aspect so it never crops to "ARC". Enlarged
  // to match the onboarding welcome hero.
  titleWordmark: { width: 232, height: 41, marginBottom: 10 },
  // 36 Cinzel — matches the onboarding stepTitle/previewTitle heading size
  // (toned to 36 per V, since Cinzel all-caps reads larger than its point size).
  titleTagline: { fontSize: 36, fontFamily: font.display, color: '#FFFFFF', letterSpacing: -1, textAlign: 'center', marginBottom: 16 },
  // Hero subline — Inter regular on the app's standard secondary-text token.
  // (Was hardcoded #AAAAAA to match an old More-hero sub that has since been
  // redesigned; that grey was the last off-token text color in the app and
  // rendered dimmer than the sibling onboarding screens.)
  sub: {
    fontSize: 20,
    fontFamily: font.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 28,
    paddingHorizontal: 8,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  // H56 per library — matches onboarding primaryBtn / paywall cta / ready.
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
