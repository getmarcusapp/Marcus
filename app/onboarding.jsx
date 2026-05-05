import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, Image, TextInput,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, radius, spacing, font } from '../constants/theme';
import { saveCompass, setHasOnboarded } from '../store/db';
import { requestNotificationPermissions, scheduleAllNotifications } from '../notifications';

const DEFAULT_NOTIF_SETTINGS = {
  morningEnabled: true,
  morningHour: 7,
  morningMinute: 0,
  compassEnabled: true,
  compassHour: 7,
  compassMinute: 30,
  middayEnabled: false,
  middayHour: 12,
  middayMinute: 0,
  eveningEnabled: true,
  eveningHour: 20,
  eveningMinute: 0,
  reviewEnabled: true,
  reviewHour: 9,
  reviewMinute: 0,
  reviewDay: 0,
};

const HERO_GRADIENT = ['#4a3a26', '#1a1410', '#000000'];

const DEFAULT_COMPASS = {
  why: 'To cultivate the kind of person I want to be: disciplined in attention, deliberate in action, calm in the face of what I cannot control. Built from character, not from outcomes.',
  overcome: 'I want to worry less about what I cannot control. To respond instead of react. To free myself from the anxiety of other people\'s opinions and the tyranny of my own undisciplined mind.',
  aspire: 'I want to meet adversity with calm, and fortune with humility. To live each day with intention, not perfectly, but deliberately. To be someone who acts in accordance with their values, even when it\'s hard.',
};

export default function OnboardingScreen() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [compass, setCompass] = useState({ ...DEFAULT_COMPASS });

  async function handleFinish() {
    await saveCompass(compass);
    await setHasOnboarded();
    router.replace('/paywall');
  }

  async function handleSkipCompass() {
    await saveCompass(DEFAULT_COMPASS);
    await setHasOnboarded();
    router.replace('/paywall');
  }

  const steps = [
    <WelcomeStep onNext={() => setStep(1)} />,
    <PhilosophyStep onNext={() => setStep(2)} />,
    <CompassStep compass={compass} setCompass={setCompass} onNext={() => setStep(3)} onSkip={() => setStep(3)} />,
    <PracticePreviewStep onNext={() => setStep(4)} />,
    <RemindersStep onNext={() => setStep(5)} />,
    <ReadyStep onFinish={handleFinish} />,
  ];

  return (
    <View style={{ flex: 1 }}>
      {step > 0 && step < 5 && (
        <TouchableOpacity
          onPress={() => setStep(step - 1)}
          style={s.onboardingBack}
          activeOpacity={0.7}
        >
          <Text style={s.onboardingBackText}>‹ Back</Text>
        </TouchableOpacity>
      )}
      {steps[step]}
    </View>
  );
}

function WelcomeStep({ onNext }) {
  return (
    <LinearGradient
      colors={HERO_GRADIENT}
      locations={[0, 0.6, 1]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={{ flex: 1 }}
    >
      <SafeAreaView style={s.safeTransparent}>
        <View style={s.welcomeBody}>
          <Image source={require('../assets/skull.png')} style={s.welcomeSkull} resizeMode="contain" />
          <Text style={s.welcomeTitle}>Marcus</Text>
          <Text style={s.welcomeSub}>A Stoic practice app</Text>
          <View style={s.welcomeDivider} />
          <Text style={s.welcomeTagline}>
            “The impediment to action advances action. What stands in the way becomes the way.”
          </Text>
          <Text style={s.welcomeAttr}>— Marcus Aurelius, Meditations V.20</Text>
        </View>
        <View style={s.footer}>
          <TouchableOpacity style={s.primaryBtn} onPress={onNext} activeOpacity={0.8}>
            <Text style={s.primaryBtnText}>Begin your practice</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

function PhilosophyStep({ onNext }) {
  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        <View style={s.stepHero}>
          <Text style={s.stepEyebrow}>What is Marcus?</Text>
          <Text style={s.stepTitle}>A daily Stoic{'\n'}practice</Text>
        </View>

        <View style={s.stepBody}>
          <Text style={s.philosophyText}>
            Marcus is a daily system rooted in Stoic philosophy: one of history's most practical frameworks for living well. Not theory. Not productivity hacks. A system for becoming someone you respect.
          </Text>

          <Text style={s.practiceHeading}>Your daily practice</Text>

          {[
            { title: 'Stoic Compass', desc: 'Your personal North Star: why you practice, what you want to overcome, who you aspire to be.' },
            { title: 'Daily Reading', desc: 'A real quote, generated fresh each day and personalized to your Virtue focus. Grounded in today\'s world.' },
            { title: 'Morning Journal', desc: 'Set your intention, choose your Virtue focus, and prepare for what the day requires.' },
            { title: 'Evening Journal', desc: 'Examine how you acted, confess where you fell short, and release what you carry.' },
            { title: 'Emotion logger', desc: 'When strong emotions arise, log the trigger, examine your thinking, and choose your response.' },
            { title: 'Weekly review', desc: 'Once a week, examine your patterns, assess your virtues, and set your intention forward.' },
          ].map((item, idx) => (
            <View key={idx} style={s.practiceItem}>
              <View style={s.practiceItemDot} />
              <View style={s.practiceItemContent}>
                <Text style={s.practiceItemTitle}>{item.title}</Text>
                <Text style={s.practiceItemDesc}>{item.desc}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
      <View style={s.footer}>
        <TouchableOpacity style={s.primaryBtn} onPress={onNext} activeOpacity={0.8}>
          <Text style={s.primaryBtnText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function CompassStep({ compass, setCompass, onNext, onSkip }) {
  const [openHint, setOpenHint] = React.useState(null);

  const HINTS = {
    why: "The Stoics held that Virtue — not outcome — is the only true good. Your Why should reflect what is in your control: your character, your intentions, how you show up.\n\nA Stoic Why doesn't depend on external circumstances. 'I want to be respected' is external. 'I want to act with integrity regardless of outcome' is internal: yours to achieve regardless of what happens around you.",
    overcome: "Name a pattern you can observe in yourself, not a circumstance or another person. Those are outside your control. What you can overcome is your habitual response to them.\n\n'I want to overcome anxiety' is external. 'I want to stop treating anxiety as a verdict rather than an impression' is internal. That is where the Stoic practice lives.",
    aspire: "Aspiration in Stoic terms is the cultivation of Virtue: wisdom, courage, temperance, justice. The test is whether your aspiration describes who you are becoming, not what you are getting.\n\nEpictetus: 'First say to yourself what you would be; then do what you have to do.'",
  };

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={s.scroll}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 140 }}
        >
          <View style={s.stepHero}>
            <Text style={s.stepEyebrow}>Your compass</Text>
            <Text style={s.stepTitle}>Set your{'\n'}North Star</Text>
            <Text style={s.stepSub}>
              These three questions anchor your daily practice. They come pre-filled. Edit each one to make it yours, or leave the defaults and customize later.
            </Text>
          </View>

          <View style={s.stepBody}>
            {[
              {
                key: 'why', label: 'Why I practice', sub: 'What draws you to Stoicism?',
                placeholder: 'e.g. To act with integrity regardless of outcome. To be the kind of person my future self would be proud of.',
              },
              {
                key: 'overcome', label: 'What I want to overcome', sub: 'What patterns or struggles brought you here?',
                placeholder: 'e.g. My tendency to avoid difficult conversations. Mistaking busyness for progress.',
              },
              {
                key: 'aspire', label: 'Who I aspire to be', sub: 'What does the best version of you look like?',
                placeholder: 'e.g. To respond to difficulty with reason rather than reaction. To be present with the people I love.',
              },
            ].map(field => (
              <View key={field.key} style={s.compassField}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={s.compassFieldLabel}>{field.label}</Text>
                  <TouchableOpacity
                    onPress={() => setOpenHint(openHint === field.key ? null : field.key)}
                    style={{ padding: 4 }}
                    activeOpacity={0.7}
                  >
                    <Text style={{ fontSize: 18, color: colors.accent }}>ⓘ</Text>
                  </TouchableOpacity>
                </View>
                <Text style={s.compassFieldSub}>{field.sub}</Text>
                {openHint === field.key && (
                  <View style={{ backgroundColor: colors.bg, borderWidth: 0.5, borderColor: colors.border, borderRadius: 10, padding: 14, marginBottom: 10 }}>
                    <Text style={{ fontSize: 13, color: colors.textMuted, lineHeight: 21 }}>{HINTS[field.key]}</Text>
                  </View>
                )}
                <TextInput
                  style={s.compassInput}
                  multiline
                  value={compass[field.key]}
                  onChangeText={text => setCompass(prev => ({ ...prev, [field.key]: text }))}
                  placeholder={field.placeholder}
                  placeholderTextColor={colors.textDim}
                  scrollEnabled={false}
                />
              </View>
            ))}

            <TouchableOpacity onPress={onSkip} style={s.skipLink}>
              <Text style={s.skipLinkText}>Skip for now, use the defaults</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
        <View style={s.footer}>
          <TouchableOpacity style={s.primaryBtn} onPress={onNext} activeOpacity={0.8}>
            <Text style={s.primaryBtnText}>Save my compass</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function PracticePreviewStep({ onNext }) {
  const items = [
    { title: 'Stoic Compass', sub: 'Your North Star · read daily', tag: 'NOW' },
    { title: 'Daily Reading', sub: 'Personalized to your practice, fresh each day', tag: 'READ' },
    { title: 'Morning Journal', sub: 'Reflect and intend', tag: 'NOW' },
    { title: 'Evening Journal', sub: 'Examine and release', tag: 'LATER' },
  ];

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={s.previewHero}>
          <Text style={s.previewEyebrow}>Your daily practice</Text>
          <Text style={s.previewTitle}>{`This is what\neach day looks like.`}</Text>
          <Text style={s.previewSub}>Four elements. Executed with intention.</Text>
        </View>

        <View style={s.previewBody}>
          <View style={s.previewCard}>
            {items.map((item, idx) => (
              <View key={idx} style={[s.previewRow, idx < items.length - 1 && s.previewRowBorder]}>
                <View style={s.previewDot} />
                <View style={s.previewContent}>
                  <Text style={s.previewItemTitle}>{item.title}</Text>
                  <Text style={s.previewItemSub}>{item.sub}</Text>
                </View>
                <View style={[s.previewTag, item.tag === 'LATER' && s.previewTagLater, item.tag !== 'LATER' && s.previewTagNow]}>
                  <Text style={[s.previewTagText, item.tag !== 'LATER' && s.previewTagTextNow]}>{item.tag}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={s.previewNote}>
            <Text style={s.previewNoteText}>
              Complete all four and the day is sealed. Your streak grows. The practice compounds.
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={s.footer}>
        <TouchableOpacity style={s.primaryBtn} onPress={onNext} activeOpacity={0.8}>
          <Text style={s.primaryBtnText}>Begin your practice →</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function RemindersStep({ onNext }) {
  async function handleEnable() {
    const granted = await requestNotificationPermissions();
    if (granted) {
      await AsyncStorage.setItem('notification_settings', JSON.stringify(DEFAULT_NOTIF_SETTINGS));
      await scheduleAllNotifications();
    }
    onNext();
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.stepHero}>
          <Text style={s.stepEyebrow}>Stay anchored</Text>
          <Text style={s.stepTitle}>A few gentle{'\n'}reminders.</Text>
        </View>

        <View style={s.stepBody}>
          <Text style={s.philosophyText}>
            Marcus uses notifications to anchor your practice across the day. Just enough to keep the rhythm, never enough to feel like a leash.
          </Text>

          <Text style={s.practiceHeading}>Out of the box</Text>
          <View style={s.reminderList}>
            {[
              { time: '7:00 AM', name: 'Morning Journal' },
              { time: '7:30 AM', name: 'Stoic Compass' },
              { time: '8:00 PM', name: 'Evening Journal' },
              { time: 'Sun 9:00 AM', name: 'Weekly Review' },
            ].map((r, i, arr) => (
              <View key={r.name} style={[s.reminderRow, i < arr.length - 1 && s.reminderRowBorder]}>
                <Text style={s.reminderTime}>{r.time}</Text>
                <Text style={s.reminderName}>{r.name}</Text>
              </View>
            ))}
          </View>

          <Text style={s.reminderNote}>
            Adjust times or add a midday check-in anytime in Settings.
          </Text>
        </View>

        <View style={s.footer}>
          <TouchableOpacity style={s.primaryBtn} onPress={handleEnable} activeOpacity={0.8}>
            <Text style={s.primaryBtnText}>Enable reminders</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.skipLink} onPress={onNext} activeOpacity={0.7}>
            <Text style={s.skipLinkText}>Maybe later</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ReadyStep({ onFinish }) {
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
      <SafeAreaView style={s.safeTransparent}>
        <View style={s.welcomeBody}>
          <Image source={require('../assets/skull.png')} style={s.readySkull} resizeMode="contain" />
          <Text style={s.readyEyebrow}>Memento mori</Text>
          <Text style={s.readyTitle}>Your practice{'\n'}begins now.</Text>
          <Text style={s.readyDate}>{dateStr}</Text>
          <Text style={s.readyStreak}>Day 1</Text>
        </View>
        <View style={s.footer}>
          <TouchableOpacity style={s.primaryBtn} onPress={onFinish} activeOpacity={0.8}>
            <Text style={s.primaryBtnText}>Go to Practice →</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  safeTransparent: { flex: 1, backgroundColor: 'transparent' },
  scroll: { flex: 1 },

  // Welcome
  welcomeBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
    paddingBottom: 40,
  },
  welcomeSkull: { width: 180, height: 180, marginBottom: 32, opacity: 0.95 },
  welcomeTitle: {
    fontSize: 64,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -3,
    marginBottom: 10,
    textAlign: 'center',
  },
  welcomeSub: {
    fontSize: 20,
    color: colors.textSecondary,
    fontFamily: font.serif,
    marginBottom: 36,
    textAlign: 'center',
  },
  welcomeDivider: {
    width: 40,
    height: 0.5,
    backgroundColor: colors.accentDim,
    marginBottom: 28,
  },
  welcomeTagline: {
    fontSize: 17,
    color: colors.textMuted,
    fontFamily: font.serif,
    textAlign: 'center',
    lineHeight: 28,
    marginBottom: 12,
  },
  welcomeAttr: {
    fontSize: 13,
    color: colors.textDim,
    letterSpacing: 0.5,
    textAlign: 'center',
  },

  // Ready
  // Practice Preview
  previewHero: {
    backgroundColor: colors.bgDeep,
    padding: 36,
    paddingTop: 48,
    paddingBottom: 32,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
    alignItems: 'center',
  },
  previewEyebrow: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.accent, textTransform: 'uppercase', marginBottom: 12, textAlign: 'center' },
  previewTitle: { fontSize: 36, fontWeight: '300', color: colors.textPrimary, letterSpacing: -1.5, marginBottom: 12, textAlign: 'center', lineHeight: 42 },
  previewSub: { fontSize: 15, color: colors.textMuted, textAlign: 'center', lineHeight: 24 },
  previewBody: { padding: 20 },
  previewCard: { borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.bgCard, overflow: 'hidden', marginBottom: 16 },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, paddingHorizontal: 20 },
  previewRowBorder: { borderBottomWidth: 0.5, borderBottomColor: colors.border },
  previewDot: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: colors.textMuted },
  previewContent: { flex: 1 },
  previewItemTitle: { fontSize: 16, fontWeight: '500', color: colors.textSecondary, marginBottom: 2 },
  previewItemSub: { fontSize: 13, color: colors.textMuted },
  previewTag: { borderWidth: 0.5, borderColor: colors.border, borderRadius: 5, paddingHorizontal: 10, paddingVertical: 4 },
  previewTagNow: { borderColor: colors.accentDim, backgroundColor: colors.accentBg },
  previewTagLater: { borderWidth: 0, paddingHorizontal: 0, paddingVertical: 0 },
  previewTagTextNow: { color: colors.accent, fontWeight: '500' },
  previewTagText: { fontSize: 10, color: colors.textDim, letterSpacing: 1, textTransform: 'uppercase' },
  previewNote: { borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.lg, padding: 18, backgroundColor: colors.bgDeep },
  previewNoteText: { fontSize: 14, color: colors.textMuted, lineHeight: 22, textAlign: 'center' },

  readySkull: { width: 180, height: 180, marginBottom: 28, opacity: 1 },
  readyEyebrow: {
    fontSize: font.labelSize,
    letterSpacing: font.sectionTracking,
    color: colors.accent,
    textTransform: 'uppercase',
    marginBottom: 14,
    textAlign: 'center',
  },
  readyTitle: {
    fontSize: 44,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -1.5,
    marginBottom: 16,
    textAlign: 'center',
    lineHeight: 52,
  },
  readyDate: {
    fontSize: 18,
    color: colors.textMuted,
    marginBottom: 20,
    textAlign: 'center',
  },
  readyStreak: {
    fontSize: 56,
    fontWeight: '700',
    color: colors.accent,
    letterSpacing: -1,
    textAlign: 'center',
  },

  onboardingBack: {
    position: 'absolute',
    top: 56,
    left: 20,
    zIndex: 10,
    padding: 8,
  },
  onboardingBackText: {
    fontSize: 15,
    color: colors.accent,
    letterSpacing: 0.3,
  },
  // Step screens
  stepHero: {
    backgroundColor: colors.bgDeep,
    paddingHorizontal: 28,
    paddingTop: 52,
    paddingBottom: 32,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  stepEyebrow: {
    fontSize: font.labelSize,
    letterSpacing: font.sectionTracking,
    color: colors.accent,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  stepTitle: {
    fontSize: 44,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -1.5,
    lineHeight: 52,
    marginBottom: 14,
  },
  stepSub: {
    fontSize: 17,
    color: colors.textMuted,
    lineHeight: 26,
  },
  stepBody: {
    paddingHorizontal: 24,
    paddingTop: 28,
  },

  // Philosophy
  philosophyText: {
    fontSize: 19,
    color: colors.textSecondary,
    lineHeight: 32,
    fontFamily: font.serif,
    marginBottom: 36,
  },
  practiceHeading: {
    fontSize: font.labelSize,
    letterSpacing: font.sectionTracking,
    color: colors.accent,
    textTransform: 'uppercase',
    marginBottom: 20,
  },
  reminderList: {
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.bgCard,
    overflow: 'hidden',
    marginBottom: 16,
  },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 18,
    gap: 16,
  },
  reminderRowBorder: {
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  reminderTime: {
    fontSize: 13,
    color: colors.accent,
    letterSpacing: 0.5,
    minWidth: 84,
  },
  reminderName: {
    fontSize: 15,
    color: colors.textSecondary,
    fontWeight: '500',
    flex: 1,
  },
  reminderNote: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 20,
    marginTop: 4,
  },
  practiceItem: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  practiceItemDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
    marginTop: 8,
    flexShrink: 0,
  },
  practiceItemContent: { flex: 1 },
  practiceItemTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 5,
  },
  practiceItemDesc: {
    fontSize: 15,
    color: colors.textMuted,
    lineHeight: 23,
  },

  // Compass
  compassField: {
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 20,
    marginBottom: 16,
    backgroundColor: colors.bgCard,
  },
  compassFieldLabel: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  compassFieldSub: {
    fontSize: 14,
    color: colors.textDim,
    marginBottom: 16,
  },
  compassInput: {
    fontSize: 16,
    color: colors.textSecondary,
    lineHeight: 26,
    minHeight: 80,
    textAlignVertical: 'top',
    fontFamily: font.serif,
  },
  skipLink: { paddingVertical: 20, alignItems: 'center' },
  skipLinkText: { fontSize: 15, color: colors.textDim },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 16,
    backgroundColor: colors.bg,
    borderTopWidth: 0.5,
    borderTopColor: colors.border,
  },
  primaryBtn: {
    backgroundColor: colors.bgElevated,
    borderWidth: 0.5,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    padding: 20,
    alignItems: 'center',
  },
  primaryBtnText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
});