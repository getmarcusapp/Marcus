import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { GoldPrimary } from '../components/GoldButton';
import { CANCEL_REASONS, sendCancelReason } from '../lib/cancelSurvey';
import { colors, font, radius } from '../constants/theme';
import * as haptics from '../lib/haptics';

// The one question asked after someone turns off renewal (lib/cancelSurvey.js).
// It is a question and nothing else: no discount, no "are you sure", no second
// screen. Skipping is one tap and is never asked about again.
export default function CancelSurvey() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [reason, setReason] = useState(null);
  const [note, setNote] = useState('');
  const [sent, setSent] = useState(false);
  const preview = params?.preview === '1';
  const stage = params?.stage === 'paid' ? 'paid' : 'trial';
  const active = params?.active === '1';
  const until = params?.until ? new Date(params.until) : null;
  const untilText = until && !isNaN(until)
    ? until.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })
    : null;

  const leave = () => router.replace('/');

  async function submit() {
    if (!reason) return;
    haptics.tap();
    setSent(true);
    // Developer Tools preview: show the screen, record nothing.
    if (!preview) await sendCancelReason({ reason, note, stage, version: Constants.expoConfig?.version });
  }

  if (sent) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.thanks}>
          <Text style={s.eyebrow}>Received</Text>
          <Text style={s.title}>Thank you.</Text>
          <Text style={s.body}>
            Every answer is read by the person who builds Marcus.
            {active && untilText ? ` Your access continues until ${untilText}.` : ''}
          </Text>
          <GoldPrimary style={s.cta} onPress={leave}>
            <Text style={s.ctaText}>Back to the practice</Text>
          </GoldPrimary>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={s.eyebrow}>One question</Text>
          <Text style={s.title}>What made you cancel?</Text>
          <Text style={s.body}>
            {stage === 'trial' ? 'You turned off renewal on your trial.' : 'You turned off renewal on your subscription.'}
            {' '}Nothing here changes that. Your answer shapes what gets built next.
          </Text>

          {CANCEL_REASONS.map(r => {
            const on = reason === r.id;
            return (
              <TouchableOpacity
                key={r.id}
                style={[s.option, on && s.optionOn]}
                onPress={() => { haptics.tap(); setReason(r.id); }}
                activeOpacity={0.8}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
              >
                <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={20} color={on ? colors.accent : colors.border} />
                <Text style={[s.optionText, on && s.optionTextOn]}>{r.label}</Text>
              </TouchableOpacity>
            );
          })}

          <TextInput
            style={s.note}
            value={note}
            onChangeText={setNote}
            placeholder="Anything you want to add (optional)"
            placeholderTextColor={colors.accentDim}
            multiline
            maxLength={400}
            textAlignVertical="top"
          />
          <Text style={s.fine}>
            Your answer is sent to us without your name or email. Nothing from your journal is included.
          </Text>

          <GoldPrimary style={[s.cta, !reason && s.ctaOff]} disabled={!reason} onPress={submit}>
            <Text style={s.ctaText}>Send</Text>
          </GoldPrimary>
          <TouchableOpacity style={s.skip} onPress={leave} hitSlop={{ top: 10, bottom: 10, left: 20, right: 20 }}>
            <Text style={s.skipText}>Skip</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 24, paddingTop: 36, paddingBottom: 40 },
  thanks: { flex: 1, paddingHorizontal: 24, justifyContent: 'center' },
  eyebrow: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.accent, fontFamily: font.bodyMedium, textTransform: 'uppercase', marginBottom: 12 },
  title: { fontSize: 30, lineHeight: 38, fontFamily: font.display, color: colors.textPrimary, marginBottom: 14 },
  body: { fontSize: 16, lineHeight: 25, color: colors.textSecondary, fontFamily: font.body, marginBottom: 26 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingVertical: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, marginBottom: 10 },
  optionOn: { borderColor: colors.accent },
  optionText: { flex: 1, fontSize: 16, lineHeight: 22, color: colors.textSecondary, fontFamily: font.body },
  optionTextOn: { color: colors.textPrimary },
  note: { minHeight: 96, marginTop: 8, padding: 14, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.inputBg, color: colors.textPrimary, fontSize: 16, lineHeight: 23, fontFamily: font.body },
  fine: { fontSize: 13, lineHeight: 19, color: colors.accentDim, fontFamily: font.body, marginTop: 10, marginBottom: 24 },
  cta: { minHeight: 54, borderRadius: radius.md },
  ctaOff: { opacity: 0.4 },
  ctaText: { fontSize: 16, fontFamily: font.bodySemiBold, color: '#1a1a1a', letterSpacing: 0.3 },
  skip: { alignSelf: 'center', marginTop: 18, paddingVertical: 6 },
  skipText: { fontSize: 15, color: colors.textSecondary, fontFamily: font.bodyMedium },
});
