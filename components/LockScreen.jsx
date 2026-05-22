import React, { useEffect, useState } from 'react';
import {
  View, Text, Image, ImageBackground, TouchableOpacity, StyleSheet, SafeAreaView, Animated, Easing,
} from 'react-native';
import { authenticate } from '../lib/appLock';
import { colors, radius, spacing, font } from '../constants/theme';

export function LockScreen() {
  const [authing, setAuthing] = useState(false);
  const [authFailed, setAuthFailed] = useState(false);

  // Auto-prompt FaceID once on mount. If the user cancels or it fails,
  // they get a manual Unlock button.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setAuthing(true);
      const r = await authenticate().catch(() => ({ success: false }));
      if (cancelled) return;
      if (!r.success) setAuthFailed(true);
      setAuthing(false);
    })();
    return () => { cancelled = true; };
  }, []);

  async function handleUnlock() {
    setAuthFailed(false);
    setAuthing(true);
    const r = await authenticate().catch(() => ({ success: false }));
    if (!r.success) setAuthFailed(true);
    setAuthing(false);
  }

  return (
    <View style={s.root}>
      <ImageBackground
        source={require('../assets/bg.png')}
        style={StyleSheet.absoluteFillObject}
        resizeMode="cover"
      />
      <SafeAreaView style={s.safe}>
        <View style={s.body}>
          <Image
            source={require('../assets/skull.png')}
            style={s.skull}
            resizeMode="contain"
          />
          <Text style={s.eyebrow}>Marcus</Text>
          <Text style={s.title}>Locked</Text>
          <Text style={s.sub}>
            Your practice is private.{'\n'}Unlock to continue.
          </Text>
        </View>
        <View style={s.footer}>
          <TouchableOpacity
            style={s.unlockBtn}
            onPress={handleUnlock}
            activeOpacity={0.8}
            disabled={authing}
          >
            <Text style={s.unlockBtnText}>
              {authing ? 'Authenticating…' : authFailed ? 'Try again →' : 'Unlock →'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000', zIndex: 9999 },
  safe: { flex: 1, backgroundColor: 'transparent', justifyContent: 'space-between' },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  skull: { width: 160, height: 160, marginBottom: 32, opacity: 0.95 },
  eyebrow: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.accent, fontFamily: font.bodyMedium, textTransform: 'uppercase', marginBottom: 14 },
  title: { fontSize: 44, fontWeight: '300', color: colors.textPrimary, letterSpacing: -1, marginBottom: 18, fontFamily: font.serif },
  sub: { fontSize: 16, color: colors.textMuted, textAlign: 'center', lineHeight: 26, fontFamily: font.serif },
  footer: { padding: spacing.xl, paddingBottom: 36 },
  unlockBtn: {
    borderWidth: 0.5, borderColor: colors.accentDim, borderRadius: radius.md,
    paddingVertical: 18, alignItems: 'center', backgroundColor: colors.accentBg,
  },
  unlockBtnText: { fontSize: 14, fontFamily: font.bodyMedium, color: colors.accent, letterSpacing: 1, textTransform: 'uppercase' },
});
