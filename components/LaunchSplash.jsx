import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, AccessibilityInfo, View, Dimensions } from 'react-native';
import { colors } from '../constants/theme';

const { width: W, height: H } = Dimensions.get('window');

// ── Timing (all tunable) ────────────────────────────────────────────────
const FLOAT_MS = 800;        // skull + wordmark float-up / fade-in
const GRADIENT_DELAY = 700;  // wait after entrance, then bloom the gradient
const GRADIENT_MS = 700;     // gradient background bloom
const MIN_WELCOME_MS = 1900; // minimum on-screen time before the exit begins
const DISSOLVE_MS = 650;     // final scale-up + fade to reveal Home

// "Waking Up"-style launch welcome: the gold skull + Marcus wordmark float up
// and fade in over the dark ground while a subtle gold spinner turns near the
// bottom; the gradient background then blooms in behind the logo; once the app
// is ready (and a minimum beat has passed), the whole splash gently scales up
// and dissolves to reveal Home. Honors Reduce Motion (fades only, no float/zoom).
export function LaunchSplash({ active, onDone }) {
  const contentY = useRef(new Animated.Value(24)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const spinnerOpacity = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const bgOpacity = useRef(new Animated.Value(0)).current;
  const rootScale = useRef(new Animated.Value(1)).current;
  const rootOpacity = useRef(new Animated.Value(1)).current;
  const mountAt = useRef(Date.now());
  const exited = useRef(false);

  // Entrance: float the logo up + fade in, fade/loop the spinner, then bloom
  // the gradient background behind the logo.
  useEffect(() => {
    let loop;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      Animated.parallel([
        Animated.timing(contentOpacity, { toValue: 1, duration: FLOAT_MS, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(contentY, { toValue: 0, duration: reduce ? 1 : FLOAT_MS, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(spinnerOpacity, { toValue: 1, duration: 500, delay: 450, useNativeDriver: true }),
        Animated.timing(bgOpacity, { toValue: 1, duration: reduce ? 350 : GRADIENT_MS, delay: GRADIENT_DELAY, useNativeDriver: true }),
      ]).start();
      loop = Animated.loop(
        Animated.timing(spin, { toValue: 1, duration: 1100, easing: Easing.linear, useNativeDriver: true }),
      );
      loop.start();
    });
    return () => loop?.stop();
  }, []);

  // Exit: once fonts are ready (+ minimum welcome time), dissolve the splash to
  // reveal the app underneath (its gradient bg lines up, so it reads continuous).
  useEffect(() => {
    if (!active || exited.current) return;
    exited.current = true;
    const delay = Math.max(0, MIN_WELCOME_MS - (Date.now() - mountAt.current));
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(spinnerOpacity, { toValue: 0, duration: 250, useNativeDriver: true }),
          Animated.timing(rootOpacity, { toValue: 0, duration: reduce ? 350 : DISSOLVE_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          ...(reduce ? [] : [Animated.timing(rootScale, { toValue: 1.12, duration: DISSOLVE_MS, easing: Easing.out(Easing.cubic), useNativeDriver: true })]),
        ]),
      ]).start(({ finished }) => { if (finished) onDone?.(); });
    });
  }, [active]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, styles.root, { opacity: rootOpacity, transform: [{ scale: rootScale }] }]}
    >
      {/* Gradient background (same as Home) blooms in behind the logo */}
      <Animated.Image
        source={require('../assets/bg-svg4.png')}
        style={[StyleSheet.absoluteFill, { width: W, height: H, opacity: bgOpacity }]}
        resizeMode="cover"
      />
      {/* Centered logo lockup: gold skull above the Marcus wordmark */}
      <View style={styles.center}>
        <Animated.View style={[styles.logoWrap, { opacity: contentOpacity, transform: [{ translateY: contentY }] }]}>
          <Animated.Image source={require('../assets/skull-gold.png')} style={styles.skull} resizeMode="contain" />
          <Animated.Image source={require('../assets/marcus-wordmark.png')} style={styles.wordmark} resizeMode="contain" />
        </Animated.View>
      </View>
      {/* Subtle gold ring spinner near the bottom */}
      <Animated.View style={[styles.spinnerWrap, { opacity: spinnerOpacity, transform: [{ rotate }] }]}>
        <View style={styles.spinner} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: '#0a0a0a' },
  center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  logoWrap: { alignItems: 'center' },
  skull: { width: 150, height: 150, marginBottom: 16 },
  wordmark: { width: 200, height: 200 * 203 / 1144 },
  // Faint gold ring with a brighter gold arc that turns — sits near the bottom.
  spinnerWrap: { position: 'absolute', bottom: H * 0.13, left: 0, right: 0, alignItems: 'center' },
  spinner: {
    width: 26, height: 26, borderRadius: 13,
    borderWidth: 2,
    borderColor: 'rgba(255,206,130,0.16)',
    borderTopColor: colors.accent,
  },
});
