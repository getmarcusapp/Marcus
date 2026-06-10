import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, Image,
  KeyboardAvoidingView, Platform, Alert,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, radius, spacing, font } from '../constants/theme';
import { saveCompass, setHasOnboarded, setHasSeenCompassIntro } from '../store/db';
import { DEFAULT_COMPASS } from '../constants/compassFields';
import { GoldPrimary, GoldSecondary } from '../components/GoldButton';
import { requestNotificationPermissions, scheduleAllNotifications } from '../notifications';
import { MEDITATIONS_LIST, playPreview, stopPreview, useMeditationPlayer } from '../lib/meditationPlayer';
import { pickAndImportBackup } from '../lib/backup';

const DEFAULT_NOTIF_SETTINGS = {
  // Compass orients the day, so it fires before the Morning Journal acts
  // on that orientation.
  compassEnabled: true,
  compassHour: 7,
  compassMinute: 0,
  morningEnabled: true,
  morningHour: 7,
  morningMinute: 30,
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


// Roman numerals used as left-side row markers in PracticePreview and
// MeditationsStep. They convey order/sequence rather than completion,
// avoiding the empty-circle "checkbox" misread.
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);

  // Onboarding ends by persisting the default compass + has_onboarded, then
  // routing to the paywall. The Compass walkthrough has moved to the live
  // /compass screen — users see it the first time they open Compass, gated
  // by has_seen_compass_intro. Keeps onboarding shorter and lets the
  // walkthrough land in context.
  async function handleFinish() {
    await saveCompass(DEFAULT_COMPASS);
    // Explicitly mark the intro as not-yet-seen so the in-app /compass
    // walkthrough fires on first visit. Without this, the OnboardingGate
    // migration would mark it true for newly onboarded users too.
    await setHasSeenCompassIntro(false);
    await setHasOnboarded();
    router.replace('/paywall?from=onboarding');
  }

  const steps = [
    <WelcomeStep onNext={() => setStep(1)} />,
    <PhilosophyStep onNext={() => setStep(2)} />,
    <PracticePreviewStep onNext={() => setStep(3)} />,
    <MeditationsStep onNext={() => setStep(4)} />,
    <RemindersStep onNext={handleFinish} />,
  ];

  return (
    <View style={{ flex: 1 }}>
      {step > 0 && (
        <View style={[s.onboardingHeader, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
          <TouchableOpacity
            onPress={() => setStep(step - 1)}
            style={s.onboardingBackBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={18} color={colors.accent} />
            <Text style={s.onboardingBackText}>Back</Text>
          </TouchableOpacity>
        </View>
      )}
      {steps[step]}
    </View>
  );
}

function WelcomeStep({ onNext }) {
  const router = useRouter();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  // iPhone SE (667), 8 (667), Mini (812) — below this, the full hero
  // stack is too tall and the input slips below the absolute footer.
  // Compact mode shrinks the skull/title and drops the decorative quote
  // so the input lands above the fold on every screen size.
  const isSmall = screenHeight < 750;

  function handleNext() {
    onNext();
  }

  function handleRestore() {
    Alert.alert(
      'Restore from backup?',
      'Pick a backup file you exported from another device. Your practice — journals, emotion logs, weekly reviews, compass, streak — will be restored. You\'ll skip the rest of onboarding.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Choose file…',
          onPress: async () => {
            try {
              const result = await pickAndImportBackup();
              if (result.canceled) return;
              const exportedDate = result.exportedAt
                ? new Date(result.exportedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                : 'an earlier date';
              // pickAndImportBackup already sets has_onboarded=true.
              // Send to paywall so RevenueCat re-validates entitlement on
              // the new device (subscription is tied to Apple ID, not local).
              Alert.alert(
                'Welcome back',
                `Restored ${result.journalCount} journal entries, ${result.triggerCount} emotion logs, and ${result.reviewCount} weekly reviews from a backup made on ${exportedDate}. Your practice continues.`,
                [{ text: 'Continue', onPress: () => router.replace('/paywall') }],
              );
            } catch (e) {
              Alert.alert('', e?.message || 'Could not import that file.');
            }
          },
        },
      ],
    );
  }

  return (
    <View style={s.welcomeRoot}>
      <Image
        source={require('../assets/bg-svg4.png')}
        style={{ position: 'absolute', top: 0, left: 0, width: screenWidth, height: screenHeight }}
        resizeMode="cover"
        pointerEvents="none"
      />
      <SafeAreaView style={s.safeTransparent}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[s.welcomeBody, isSmall && s.welcomeBodySmall]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets
          bounces={false}
        >
          <Image
            source={require('../assets/skull-gold.png')}
            style={[s.welcomeSkull, isSmall && s.welcomeSkullSmall]}
            resizeMode="contain"
          />
          <Image
            source={require('../assets/marcus-wordmark.png')}
            style={[s.welcomeWordmark, isSmall && s.welcomeWordmarkSmall]}
            resizeMode="contain"
          />
          <Text style={[s.welcomeSub, isSmall && s.welcomeSubSmall]}>A Stoic practice app</Text>
          {!isSmall && (
            <>
              <Text style={s.welcomeTagline}>
                {'“Waste no more time arguing about what a good man should be.\nBe one.”'}
              </Text>
              <Text style={s.welcomeAttr}>— Marcus Aurelius, Meditations X.16</Text>
            </>
          )}

        </ScrollView>
        {/* Subtle bottom scrim so the CTA + restore link stay legible over the
            wave, while the wave runs full-bleed to the bottom (no black bar). */}
        <LinearGradient
          colors={['transparent', 'rgba(5,5,5,0.9)']}
          style={s.welcomeFooterScrim}
          pointerEvents="none"
        />
        <View style={[s.footer, s.welcomeFooter]}>
          {/* Restore link ABOVE the CTA so "Continue" stays anchored at the
              bottom in the same position as every other onboarding step. */}
          <TouchableOpacity onPress={handleRestore} activeOpacity={0.7} style={s.welcomeRestore}>
            <Text style={s.welcomeRestoreText}>I have a backup from another device</Text>
          </TouchableOpacity>
          <GoldPrimary style={s.primaryBtn} onPress={handleNext}>
            <Text style={[s.primaryBtnText, s.primaryBtnFilledText]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>Continue</Text>
            <Ionicons name="arrow-forward" size={18} color="#1a1a1a" style={{ marginTop: 2 }} />
          </GoldPrimary>
        </View>
      </SafeAreaView>
    </View>
  );
}

function PhilosophyStep({ onNext }) {
  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 140 }}
      >
        <View style={s.stepHero}>
          <Image source={require('../assets/heroes/compass.jpg')} style={s.stepHeroImg} resizeMode="cover" />
          <LinearGradient
            colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.25)', 'rgba(0,0,0,0.75)', 'rgba(0,0,0,0.95)']}
            locations={[0, 0.4, 0.75, 1]}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={s.stepHeroText}>
            <Text style={s.stepEyebrow}>What is Marcus?</Text>
            <Text style={s.stepTitle}>A daily Stoic{'\n'}practice</Text>
          </View>
        </View>

        <View style={s.stepBody}>
          <Text style={s.philosophyText}>
            Marcus is a daily system rooted in Stoic philosophy: one of history's most practical frameworks for living well. Not theory. Not productivity hacks. A system for becoming someone you respect.
          </Text>

          <Text style={s.practiceHeading}>Your daily practice</Text>

          {[
            { title: 'Stoic Compass', desc: 'Your personal North Star: why you practice, what you want to overcome, who you aspire to be.' },
            { title: 'Daily Reading', desc: 'A real Stoic quote chosen for you each day, drawn from the canon and grounded in your Compass.' },
            { title: 'Guided Meditations', desc: 'Six Stoic meditations, less than five minutes each. Voiced. Surfaced contextually for the time of day.' },
            { title: 'Morning Journal', desc: 'Reflect on what is in your control, foresee what may come, and prepare for what the day requires.' },
            { title: 'Evening Journal', desc: 'Examine how you acted, confess where you fell short, and release what you carry.' },
            { title: 'Emotion logger', desc: 'When strong emotions arise, log the trigger, examine your thinking, and choose your response.' },
            { title: 'Weekly review', desc: 'Once a week, examine your patterns, assess your Virtues, and set your intention forward.' },
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
        <GoldPrimary style={s.primaryBtn} onPress={onNext}>
          <Text style={[s.primaryBtnText, s.primaryBtnFilledText]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>Continue</Text>
          <Ionicons name="arrow-forward" size={18} color="#1a1a1a" style={{ marginTop: 2 }} />
        </GoldPrimary>
      </View>
    </SafeAreaView>
  );
}


function PracticePreviewStep({ onNext }) {
  const items = [
    { title: 'Stoic Compass', sub: 'Your North Star · read daily' },
    { title: 'Daily Reading', sub: 'Chosen for you, each day' },
    { title: 'Morning Journal', sub: 'Reflect and intend' },
    { title: 'Evening Journal', sub: 'Examine and release' },
  ];

  const extras = [
    { title: 'Guided meditations', sub: 'Voiced, contextual, optional' },
    { title: 'Weekly Review', sub: 'Seal the week' },
    { title: 'Emotion log', sub: 'Reframe in the moment' },
    { title: 'Optional FaceID lock', sub: 'Your practice stays private' },
  ];

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 140 }}>
        <View style={s.stepHero}>
          <Image source={require('../assets/heroes/journal-morning.jpg')} style={s.stepHeroImg} resizeMode="cover" />
          <LinearGradient
            colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.25)', 'rgba(0,0,0,0.75)', 'rgba(0,0,0,0.95)']}
            locations={[0, 0.4, 0.75, 1]}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={s.stepHeroText}>
            <Text style={s.stepEyebrow}>Your daily practice</Text>
            <Text style={s.stepTitle}>The shape{'\n'}of your day</Text>
          </View>
        </View>

        <View style={s.previewBody}>
          <View style={s.previewCard}>
            {items.map((item, idx) => (
              <View key={idx} style={[s.previewRow, idx < items.length - 1 && s.previewRowBorder]}>
                <Text style={s.previewNum}>{ROMAN[idx]}</Text>
                <View style={s.previewContent}>
                  <Text style={s.previewItemTitle}>{item.title}</Text>
                  <Text style={s.previewItemSub}>{item.sub}</Text>
                </View>
                {item.tag && (
                  <View style={[s.previewTag, s.previewTagNext]}>
                    <Text style={[s.previewTagText, s.previewTagTextNext]}>{item.tag}</Text>
                  </View>
                )}
              </View>
            ))}
          </View>

          <View style={s.previewNote}>
            <Text style={s.previewNoteText}>
              Complete all four and the day is sealed. Your streak grows. The practice compounds.
            </Text>
          </View>

          <Text style={s.extrasHeading}>Also in your kit</Text>
          <View style={s.previewCard}>
            {extras.map((item, idx) => (
              <View key={idx} style={[s.previewRow, idx < extras.length - 1 && s.previewRowBorder]}>
                <Text style={s.previewNum}>{ROMAN[idx]}</Text>
                <View style={s.previewContent}>
                  <Text style={s.previewItemTitle}>{item.title}</Text>
                  <Text style={s.previewItemSub}>{item.sub}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={s.footer}>
        <GoldPrimary style={s.primaryBtn} onPress={onNext}>
          <Text style={[s.primaryBtnText, s.primaryBtnFilledText]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>Continue</Text>
          <Ionicons name="arrow-forward" size={18} color="#1a1a1a" style={{ marginTop: 2 }} />
        </GoldPrimary>
      </View>
    </SafeAreaView>
  );
}

function MeditationsStep({ onNext }) {
  const { previewMedId, isLoading } = useMeditationPlayer();

  // Always stop any preview when leaving this step (user advances, hits
  // back, or aborts onboarding) so audio doesn't bleed into the next screen.
  useEffect(() => {
    return () => { stopPreview().catch(() => {}); };
  }, []);

  function handleAdvance() {
    stopPreview().catch(() => {});
    onNext();
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 140 }}>
        <View style={s.medOnbHero}>
          <Image
            source={require('../assets/meditations/img/view-from-above.jpg')}
            style={s.medOnbHeroImg}
            resizeMode="cover"
          />
          <LinearGradient
            colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.25)', 'rgba(0,0,0,0.75)', 'rgba(0,0,0,0.95)']}
            locations={[0, 0.4, 0.75, 1]}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={s.medOnbHeroText}>
            <Text style={s.previewEyebrow}>Six guided meditations</Text>
            <Text style={s.previewTitle}>{`Ancient attention\ntraining`}</Text>
          </View>
        </View>

        <View style={s.previewBody}>
          <View>
            {MEDITATIONS_LIST.map((m, idx) => {
              const previewing = previewMedId === m.id;
              const loading = previewing && isLoading;
              return (
                <TouchableOpacity
                  key={m.id}
                  activeOpacity={0.7}
                  onPress={() => previewing ? stopPreview() : playPreview(m)}
                  style={[s.medOnbCard, idx < MEDITATIONS_LIST.length - 1 && s.medOnbCardBorder]}
                >
                  <View style={s.medOnbLeft}>
                    <View style={s.medOnbThumb}>
                      <Image source={m.image} style={s.medOnbThumbImg} resizeMode="cover" />
                      <View style={s.medOnbThumbOverlay}>
                        <Ionicons
                          name={previewing ? 'stop-circle' : 'play-circle'}
                          size={30}
                          color={previewing ? colors.accent : '#fff'}
                        />
                      </View>
                    </View>
                    <View style={s.medOnbText}>
                      <Text style={[s.medOnbTitle, previewing && { color: colors.accent }]}>{m.title}</Text>
                      <Text style={s.medOnbMeta}>
                        {loading ? 'Loading…' : previewing ? 'Listening · 12-second excerpt' : m.subtitle}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>

      <View style={s.footer}>
        <GoldPrimary style={s.primaryBtn} onPress={handleAdvance}>
          <Text style={[s.primaryBtnText, s.primaryBtnFilledText]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>Continue</Text>
          <Ionicons name="arrow-forward" size={18} color="#1a1a1a" style={{ marginTop: 2 }} />
        </GoldPrimary>
      </View>
    </SafeAreaView>
  );
}

function formatReminderTime(hour, minute, weekday) {
  const h = hour % 12 || 12;
  const m = minute.toString().padStart(2, '0');
  const ampm = hour < 12 ? 'AM' : 'PM';
  const dayPrefix = weekday !== undefined ? `${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][weekday]} ` : '';
  return `${dayPrefix}${h}:${m} ${ampm}`;
}

function ReminderTimeAdjuster({ hour, minute, onHourChange, onMinuteChange }) {
  return (
    <View style={s.reminderAdjuster}>
      <View style={s.reminderAdjusterCol}>
        <TouchableOpacity style={s.reminderAdjusterBtn} onPress={() => onHourChange((hour + 1) % 24)}>
          <Text style={s.reminderAdjusterArrow}>▲</Text>
        </TouchableOpacity>
        <Text style={s.reminderAdjusterVal}>{(hour % 12 || 12).toString().padStart(2, '0')}</Text>
        <TouchableOpacity style={s.reminderAdjusterBtn} onPress={() => onHourChange((hour + 23) % 24)}>
          <Text style={s.reminderAdjusterArrow}>▼</Text>
        </TouchableOpacity>
      </View>
      <Text style={s.reminderAdjusterColon}>:</Text>
      <View style={s.reminderAdjusterCol}>
        <TouchableOpacity style={s.reminderAdjusterBtn} onPress={() => onMinuteChange((minute + 5) % 60)}>
          <Text style={s.reminderAdjusterArrow}>▲</Text>
        </TouchableOpacity>
        <Text style={s.reminderAdjusterVal}>{minute.toString().padStart(2, '0')}</Text>
        <TouchableOpacity style={s.reminderAdjusterBtn} onPress={() => onMinuteChange((minute + 55) % 60)}>
          <Text style={s.reminderAdjusterArrow}>▼</Text>
        </TouchableOpacity>
      </View>
      <Text style={s.reminderAdjusterAmpm}>{hour < 12 ? 'AM' : 'PM'}</Text>
    </View>
  );
}

const REMINDER_ROWS = [
  { name: 'Stoic Compass', hourKey: 'compassHour', minuteKey: 'compassMinute' },
  { name: 'Morning Journal', hourKey: 'morningHour', minuteKey: 'morningMinute' },
  { name: 'Evening Journal', hourKey: 'eveningHour', minuteKey: 'eveningMinute' },
  { name: 'Weekly Review', hourKey: 'reviewHour', minuteKey: 'reviewMinute', weekdayKey: 'reviewDay' },
];

function RemindersStep({ onNext }) {
  const [settings, setSettings] = useState(DEFAULT_NOTIF_SETTINGS);
  const [editingRow, setEditingRow] = useState(null);

  function update(key, value) {
    setSettings(prev => ({ ...prev, [key]: value }));
  }

  async function handleEnable() {
    const granted = await requestNotificationPermissions();
    if (granted) {
      await AsyncStorage.setItem('notification_settings', JSON.stringify(settings));
      await scheduleAllNotifications();
    }
    onNext();
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 180 }}
      >
        <View style={s.stepHero}>
          <Image source={require('../assets/meditations/img/evening-examination.jpg')} style={s.stepHeroImg} resizeMode="cover" />
          <LinearGradient
            colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.25)', 'rgba(0,0,0,0.75)', 'rgba(0,0,0,0.95)']}
            locations={[0, 0.4, 0.75, 1]}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={s.stepHeroText}>
            <Text style={s.stepEyebrow}>Stay anchored</Text>
            <Text style={s.stepTitle}>A few gentle{'\n'}reminders</Text>
          </View>
        </View>

        <View style={s.stepBody}>
          <Text style={s.philosophyText}>
            Marcus uses notifications to anchor your practice across the day. Just enough to keep the rhythm, never enough to feel like a leash.
          </Text>

          <Text style={s.practiceHeading}>Out of the box</Text>
          <View style={s.reminderList}>
            {REMINDER_ROWS.map((r, i, arr) => {
              const hour = settings[r.hourKey];
              const minute = settings[r.minuteKey];
              const weekday = r.weekdayKey !== undefined ? settings[r.weekdayKey] : undefined;
              const isEditing = editingRow === r.name;
              return (
                <View key={r.name} style={[s.reminderRow, i < arr.length - 1 && s.reminderRowBorder]}>
                  <View style={s.reminderRowTop}>
                    <Text style={s.reminderTime}>{formatReminderTime(hour, minute, weekday)}</Text>
                    <Text style={s.reminderName}>{r.name}</Text>
                    <GoldSecondary
                      onPress={() => setEditingRow(isEditing ? null : r.name)}
                      style={s.compassPreviewEdit}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      contentStyle={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                      borderWidth={0.5}
                      flatStroke
                    >
                      <Ionicons
                        name={isEditing ? 'checkmark-outline' : 'create-outline'}
                        size={12}
                        color={colors.accent}
                      />
                      <Text style={s.compassPreviewEditText}>{isEditing ? 'Done' : 'Edit'}</Text>
                    </GoldSecondary>
                  </View>
                  {isEditing && (
                    <ReminderTimeAdjuster
                      hour={hour}
                      minute={minute}
                      onHourChange={v => update(r.hourKey, v)}
                      onMinuteChange={v => update(r.minuteKey, v)}
                    />
                  )}
                </View>
              );
            })}
          </View>

          <Text style={s.reminderNote}>
            Adjust times or add a midday check-in anytime in Settings.
          </Text>
        </View>
      </ScrollView>

      <View style={[s.footer, s.footerRow]}>
        <GoldSecondary style={[s.primaryBtn, s.primaryBtnHalf]} onPress={onNext}>
          <Text style={s.primaryBtnText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>Maybe later</Text>
        </GoldSecondary>
        <GoldPrimary style={[s.primaryBtn, s.primaryBtnHalf]} onPress={handleEnable}>
          <Text style={[s.primaryBtnText, s.primaryBtnFilledText]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>Set reminders</Text>
        </GoldPrimary>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  // Onboarding welcome uses the static bg-svg4 wave (matching Practice/More).
  // Window-sized Image is set inline.
  welcomeRoot: { flex: 1, backgroundColor: '#050505', overflow: 'hidden' },
  safeTransparent: { flex: 1, backgroundColor: 'transparent' },
  scroll: { flex: 1 },

  // Welcome — used as contentContainerStyle on a ScrollView so small
  // screens can scroll past the absolute footer instead of being
  // obstructed by it. flexGrow: 1 + justifyContent: 'center' keeps the
  // content centered when it fits; on shorter phones, the input scrolls
  // into view above the footer thanks to the generous paddingBottom.
  welcomeBody: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
    paddingTop: 32,
    paddingBottom: 200,
  },
  welcomeBodySmall: {
    paddingTop: 16,
    paddingBottom: 180,
  },
  welcomeSkull: { width: 130, height: 130, marginBottom: 36, opacity: 0.95 },
  welcomeSkullSmall: { width: 96, height: 96, marginBottom: 16 },
  // Marcus wordmark image (replaces the Cormorant text). 1144×203 source
  // (aspect ≈ 5.64); explicit width+height so it never crops to "ARC".
  // Enlarged per V's reference; extra marginBottom opens space to the eyebrow.
  welcomeWordmark: { width: 232, height: 41, marginBottom: 22 },
  welcomeWordmarkSmall: { width: 190, height: 34, marginBottom: 16 },
  // Gold eyebrow — matches the More hero sub.
  welcomeSub: {
    fontSize: font.labelSize,
    letterSpacing: font.sectionTracking,
    color: colors.accent,
    fontFamily: font.bodyMedium,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  welcomeSubSmall: { marginBottom: 20 },
  // Quote: Inter Light italic per V's reference (true italic variant, not a
  // synthesized slant). fontStyle italic kept as a belt-and-suspenders cue.
  welcomeTagline: {
    fontSize: 22,
    color: colors.textPrimary,
    fontFamily: font.bodyLightItalic,
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 32,
    marginTop: 28,
  },
  // Attribution: same font + color as the "A STOIC PRACTICE APP" eyebrow —
  // gold, Inter Medium, uppercase, tracked.
  welcomeAttr: {
    fontSize: font.labelSize,
    letterSpacing: font.sectionTracking,
    color: colors.accent,
    fontFamily: font.bodyMedium,
    textTransform: 'uppercase',
    marginTop: 20,
    textAlign: 'center',
  },
  // Welcome-only: transparent footer (no black bar / seam) so the wave runs
  // to the bottom. The scrim below provides CTA legibility instead.
  welcomeFooter: { backgroundColor: 'transparent', borderTopWidth: 0 },
  welcomeFooterScrim: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 220 },
  welcomeRestore: { paddingVertical: 14, alignItems: 'center' },
  welcomeRestoreText: { fontSize: 13, color: colors.textSecondary, letterSpacing: 0.4 },
  welcomeNameWrap: {
    marginTop: 36,
    width: '100%',
    alignItems: 'center',
  },
  welcomeNameWrapSmall: { marginTop: 12 },
  welcomeNameLabel: {
    fontSize: font.labelSize,
    letterSpacing: font.sectionTracking,
    color: colors.accent,
    fontFamily: font.bodyMedium, textTransform: 'uppercase',
    marginBottom: 10,
  },
  // Library-spec input states: non-active = darker stroke + grey text;
  // active (focused) = brighter stroke + white text. Filled bg dropped
  // along with the rest of the unified-near-black surfaces.
  welcomeNameInput: {
    width: '100%',
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  welcomeNameInputFocused: {
    borderColor: colors.border,
    color: colors.textPrimary,
  },

  // Ready
  // Practice Preview
  previewHero: {
    backgroundColor: colors.bgDeep,
    padding: 36,
    paddingTop: 80,
    paddingBottom: 32,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
    alignItems: 'center',
  },
  // Meditations onboarding hero — same recipe as the in-app screens
  // (image + dark gradient + bottom-pinned text).
  medOnbHero: {
    backgroundColor: colors.bgDeep,
    minHeight: 320,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  medOnbHeroImg: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  medOnbHeroText: { padding: 28, paddingTop: 48, paddingBottom: 32 },
  previewEyebrow: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.accent, fontFamily: font.bodyMedium, textTransform: 'uppercase', marginBottom: 12, textShadowColor: 'rgba(0,0,0,0.85)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 },
  previewTitle: { fontSize: 36, fontFamily: font.display, color: '#FFFFFF', letterSpacing: -1, lineHeight: 42, textShadowColor: 'rgba(0,0,0,0.7)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 8 },
  previewBody: { padding: 20 },
  previewCard: { borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.bgCard, overflow: 'hidden', marginBottom: 16 },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, paddingHorizontal: 20 },
  previewRowBorder: { borderBottomWidth: 0.5, borderBottomColor: colors.border },
  // Roman-numeral row marker. Replaces the open-circle previewDot so
  // each row reads as ordered (sequence) instead of as a checkbox to
  // complete.
  previewNum: { width: 28, fontSize: 12, color: colors.accent, letterSpacing: 1.5, fontWeight: '600', textAlign: 'center' },
  previewHint: { fontSize: 12, color: colors.textSecondary, fontStyle: 'italic', marginBottom: 12, paddingHorizontal: 4, letterSpacing: 0.3 },
  // Meditation card pattern — mirrors the in-app /meditate list so the
  // onboarding preview shows the actual product design (painting thumbnail
  // + title + meta) instead of a generic numbered list.
  medOnbCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  medOnbCardBorder: { borderBottomWidth: 0.5, borderBottomColor: colors.border },
  medOnbLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 },
  medOnbThumb: { width: 64, height: 64, borderRadius: radius.md, overflow: 'hidden', backgroundColor: '#000', position: 'relative' },
  medOnbThumbImg: { width: '100%', height: '100%' },
  medOnbThumbOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)' },
  medOnbText: { flex: 1 },
  medOnbTitle: { fontSize: 15, fontFamily: font.bodyMedium, color: colors.textSecondary, marginBottom: 3 },
  medOnbMeta: { fontSize: 12, color: colors.textSecondary },
  previewContent: { flex: 1 },
  previewItemTitle: { fontSize: 16, fontFamily: font.bodyMedium, color: colors.textSecondary, marginBottom: 2 },
  previewItemSub: { fontSize: 13, color: colors.textSecondary },
  previewTag: { borderWidth: 0.5, borderColor: colors.border, borderRadius: 5, paddingHorizontal: 10, paddingVertical: 4 },
  previewTagNext: { borderColor: colors.accentDim, backgroundColor: colors.bg },
  previewTagText: { fontSize: 11, color: colors.textSecondary, letterSpacing: 1, fontFamily: font.bodyMedium, textTransform: 'uppercase' },
  previewTagTextNext: { color: colors.accent, fontFamily: font.bodyMedium },
  previewNote: { borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.md, padding: 18, backgroundColor: colors.bgDeep },
  previewNoteText: { fontSize: 14, color: colors.textSecondary, lineHeight: 22, textAlign: 'left' },
  extrasHeading: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.accent, fontFamily: font.bodyMedium, textTransform: 'uppercase', marginTop: 28, marginBottom: 12, paddingHorizontal: 4 },

  readySkull: { width: 180, height: 180, marginBottom: 28, opacity: 1 },
  readyEyebrow: {
    fontSize: font.labelSize,
    letterSpacing: font.sectionTracking,
    color: colors.accent,
    fontFamily: font.bodyMedium, textTransform: 'uppercase',
    marginBottom: 14,
    textAlign: 'center',
  },
  readyTitle: {
    fontSize: 44,
    fontFamily: font.display,
    color: '#FFFFFF',
    letterSpacing: -1.5,
    marginBottom: 16,
    textAlign: 'center',
    lineHeight: 52,
  },
  readyDate: {
    fontSize: 18,
    color: colors.textSecondary,
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

  // Sticky header bar at the top of every onboarding step (except step 0).
  // Matches the ScreenHeader/PracticeHeader chrome elsewhere in the app —
  // bgDeep band, gold back text-link, paddingHorizontal 18 — so the back
  // affordance reads as one design system everywhere.
  onboardingHeader: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    zIndex: 10,
    backgroundColor: colors.bgDeep,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
    paddingHorizontal: 18,
    paddingBottom: 14,
  },
  onboardingBackBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4, paddingRight: 12, alignSelf: 'flex-start' },
  onboardingBackText: {
    fontSize: 13,
    color: colors.accent,
    letterSpacing: 0.8,
    fontFamily: font.bodyMedium, textTransform: 'uppercase',
    fontFamily: font.bodyMedium,
  },
  // Step screens — image-hero pattern: full-bleed painting underneath,
  // text aligned to bottom-left, dark gradient overlay for legibility.
  // Mirrors the meditations step and in-app /meditate header. Padding is
  // on the inner `stepHeroText` wrapper, not the container — otherwise
  // iOS clips the absolutely-positioned painting to the content box and
  // a black gutter appears on the right.
  stepHero: {
    backgroundColor: colors.bgDeep,
    minHeight: 320,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  stepHeroImg: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  stepHeroText: { paddingHorizontal: 28, paddingTop: 48, paddingBottom: 32 },
  stepEyebrow: {
    fontSize: font.labelSize,
    letterSpacing: font.sectionTracking,
    color: colors.accent,
    fontFamily: font.bodyMedium, textTransform: 'uppercase',
    marginBottom: 12,
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  stepTitle: {
    // 36 (was 44) per V — the Cinzel all-caps read much larger than the point
    // size suggested, so the onboarding headings are toned down.
    fontSize: 36,
    fontFamily: font.display,
    color: '#FFFFFF',
    letterSpacing: -1,
    lineHeight: 42,
    marginBottom: 14,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
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
    marginBottom: 36,
  },
  practiceHeading: {
    fontSize: font.labelSize,
    letterSpacing: font.sectionTracking,
    color: colors.accent,
    fontFamily: font.bodyMedium, textTransform: 'uppercase',
    marginBottom: 20,
  },
  reminderList: {
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.bgCard,
    overflow: 'hidden',
    marginBottom: 16,
  },
  reminderRow: {
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  reminderRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
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
    minWidth: 96,
  },
  reminderName: {
    fontSize: 15,
    color: colors.textSecondary,
    fontFamily: font.bodyMedium,
    flex: 1,
  },
  reminderAdjuster: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: 14,
  },
  reminderAdjusterCol: {
    alignItems: 'center',
    gap: 4,
  },
  reminderAdjusterBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  reminderAdjusterArrow: {
    fontSize: 12,
    color: colors.accent,
  },
  reminderAdjusterVal: {
    fontSize: 22,
    fontWeight: '300',
    color: colors.textPrimary,
    minWidth: 32,
    textAlign: 'center',
  },
  reminderAdjusterColon: {
    fontSize: 22,
    color: colors.textSecondary,
    fontWeight: '300',
  },
  reminderAdjusterAmpm: {
    fontSize: 12,
    color: colors.textSecondary,
    letterSpacing: 1,
    marginLeft: 8,
  },
  reminderNote: {
    fontSize: 13,
    color: colors.textSecondary,
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
    color: colors.textSecondary,
    lineHeight: 23,
  },

  // Compass
  // Input field treatment per Valeriya's library: subtle elevation above
  // screen bg, stroke shifts non-active (#474747) → active (#878787).
  compassField: {
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 20,
    marginBottom: 16,
    backgroundColor: colors.inputBg,
  },
  compassFieldFocused: {
    borderColor: colors.inputBorderActive,
  },
  compassFieldLabel: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  compassFieldSub: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  compassFooterNote: {
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.bgDeep,
    padding: 16,
    marginTop: 8,
    marginBottom: 16,
  },
  compassFooterText: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  compassInput: {
    fontSize: 16,
    color: colors.textPrimary,
    lineHeight: 26,
    minHeight: 140,
    textAlignVertical: 'top',
  },
  compassInputFocused: {
    color: colors.textPrimary,
  },
  // Summary mode preview cards — show each default in a compact form
  // with a clear ✎ Edit affordance so users see the customization path
  // without having to wade through three full inputs.
  compassPreview: {
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 16,
    marginBottom: 12,
    backgroundColor: colors.bgCard,
  },
  compassPreviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  compassPreviewLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    letterSpacing: 0.2,
  },
  // "EDIT ✎" chip per Valeriya's library — gold-outlined rounded
  // rectangle (more square than pill) with the pencil-with-underline
  // glyph (create-outline) rendered as an Ionicon for true baseline
  // alignment with the text.
  compassPreviewEdit: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
    // Pin width so Edit ↔ Done states render at the same chip size
    // (D + o glyphs in "Done" are wider than E + i in "Edit", which
    // would otherwise grow the chip when entering edit mode).
    minWidth: 64,
  },
  // Matches the canonical archive EDIT chip — icon left, "Edit" right in
  // title case (per Valeriya: the archive form is the one to align to).
  compassPreviewEditText: {
    fontSize: 12,
    color: colors.accent,
    letterSpacing: 0.3,
  },
  compassPreviewText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  // Keyboard accessory bar — H44 outlined + filled-gold pair per Valeriya's
  // library converted for iPhone scale (her Figma H56 / 1.5 ≈ 37 → 44 minimum).
  accessoryBarPair: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: colors.bg,
    borderTopWidth: 0.5,
    borderTopColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  editBtn: {
    flex: 1,
    height: 44,
    borderRadius: radius.md,
    paddingHorizontal: 16,
  },
  editBtnSave: { backgroundColor: colors.accent },
  editBtnText: { fontSize: 14, fontFamily: font.bodyMedium, color: colors.accent, letterSpacing: 0.3 },
  editBtnSaveText: { color: '#1a1a1a' },
  skipLink: { paddingVertical: 20, alignItems: 'center' },
  skipLinkText: { fontSize: 15, color: colors.textSecondary },

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
  // Side-by-side button pair variant — used on the Reminders step to put
  // "Maybe later" (outlined) and "Set reminders" (filled) next to each other.
  footerRow: {
    flexDirection: 'row',
    gap: 12,
  },
  // H80 outlined-gold secondary CTA per Valeriya's onboarding library —
  // gold stroke + gold text on near-black bg. Used for the Continue
  // progressions through onboarding; terminal actions (Enable reminders)
  // get the filled variant below.
  // H56 per library — Valeriya's Figma is at 1.5x scale (591pt artboard vs
  // 393pt iPhone), so her "H80 medium" maps to ~53pt iOS, rounded to 56.
  // Matches the keyboard accessory editBtn so the whole app converges on
  // one primary-button size on iPhone width.
  primaryBtn: {
    borderRadius: radius.md,
    height: 56,
    paddingHorizontal: 24,
    gap: 8,
    marginBottom: 36,
  },
  // Half-width variant for side-by-side button pairs (Reminders step).
  primaryBtnHalf: {
    flex: 1,
    paddingHorizontal: 12,
  },
  primaryBtnText: {
    fontSize: 15,
    fontFamily: font.bodyMedium,
    color: colors.accent,
    letterSpacing: 0.3,
  },
  // Filled variant for terminal/commit actions in onboarding (e.g., Enable
  // reminders). Filled accent bg + dark text — carries the most weight.
  primaryBtnFilled: {
    backgroundColor: colors.accent,
    borderWidth: 0,
  },
  primaryBtnFilledText: {
    color: '#1a1a1a',
  },
  // Keyboard-accessory "Next" button on the Welcome step. Filled-gold H56
  // pill that docks above the keyboard while the name input has focus,
  // so the user can advance without dismissing to reach the bottom CTA.
  welcomeAccessoryBar: {
    backgroundColor: colors.bg,
    borderTopWidth: 0.5,
    borderTopColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  welcomeAccessoryBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcomeAccessoryBtnText: {
    fontSize: 16,
    fontFamily: font.bodyMedium,
    color: '#1a1a1a',
    letterSpacing: 0.3,
  },
});