import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, Image, TextInput,
  KeyboardAvoidingView, Platform, Alert,
  InputAccessoryView, Keyboard,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, radius, spacing, font } from '../constants/theme';
import { saveCompass, setHasOnboarded } from '../store/db';
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

const HERO_GRADIENT = ['#4a3a26', '#1a1410', '#000000'];

// Roman numerals used as left-side row markers in PracticePreview and
// MeditationsStep. They convey order/sequence rather than completion,
// avoiding the empty-circle "checkbox" misread.
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

const DEFAULT_COMPASS = {
  why: 'To cultivate the kind of person I want to be: disciplined in attention, deliberate in action, calm in the face of what I cannot control. Built from character, not from outcomes.',
  overcome: 'I want to worry less about what I cannot control. To respond instead of react. To free myself from the anxiety of other people\'s opinions and the tyranny of my own undisciplined mind.',
  aspire: 'I want to meet adversity with calm, and fortune with humility. To live each day with intention, not perfectly, but deliberately. To be someone who acts in accordance with their values, even when it\'s hard.',
};

export default function OnboardingScreen() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [compass, setCompass] = useState({ ...DEFAULT_COMPASS });

  // Onboarding ends by saving compass + has_onboarded, then routing to
  // the paywall with ?from=onboarding so the paywall knows to send the
  // user to the post-paywall ReadyStep ("Your practice begins now")
  // rather than straight to Practice.
  async function handleFinish() {
    await saveCompass(compass);
    await setHasOnboarded();
    router.replace('/paywall?from=onboarding');
  }

  async function handleSkipCompass() {
    await saveCompass(DEFAULT_COMPASS);
    await setHasOnboarded();
    router.replace('/paywall?from=onboarding');
  }

  const steps = [
    <WelcomeStep onNext={() => setStep(1)} />,
    <PhilosophyStep onNext={() => setStep(2)} />,
    <CompassStep compass={compass} setCompass={setCompass} onNext={() => setStep(3)} onSkip={() => setStep(3)} />,
    <PracticePreviewStep onNext={() => setStep(4)} />,
    <MeditationsStep onNext={() => setStep(5)} />,
    <RemindersStep onNext={handleFinish} />,
  ];

  return (
    <View style={{ flex: 1 }}>
      {step > 0 && (
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
  const router = useRouter();
  const [name, setName] = useState('');

  async function handleNext() {
    const trimmed = name.trim();
    if (trimmed) await AsyncStorage.setItem('user_name', trimmed);
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
    <LinearGradient
      colors={HERO_GRADIENT}
      locations={[0, 0.6, 1]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={{ flex: 1 }}
    >
      <SafeAreaView style={s.safeTransparent}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={s.welcomeBody}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            bounces={false}
          >
            <Image source={require('../assets/skull.png')} style={s.welcomeSkull} resizeMode="contain" />
            <Text style={s.welcomeTitle}>Marcus</Text>
            <Text style={s.welcomeSub}>A Stoic practice app</Text>
            <View style={s.welcomeDivider} />
            <Text style={s.welcomeTagline}>
              “The impediment to action advances action. What stands in the way becomes the way.”
            </Text>
            <Text style={s.welcomeAttr}>— Marcus Aurelius, Meditations V.20</Text>

            <View style={s.welcomeNameWrap}>
              <Text style={s.welcomeNameLabel}>Your name · optional</Text>
              <TextInput
                style={s.welcomeNameInput}
                placeholder="What should we call you?"
                placeholderTextColor={colors.textMuted}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                autoCorrect={false}
                maxLength={40}
                returnKeyType="done"
                onSubmitEditing={handleNext}
              />
            </View>
          </ScrollView>
          <View style={s.footer}>
            <TouchableOpacity style={s.primaryBtn} onPress={handleNext} activeOpacity={0.8}>
              <Text style={s.primaryBtnText}>Begin your practice</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleRestore} activeOpacity={0.7} style={s.welcomeRestore}>
              <Text style={s.welcomeRestoreText}>I have a backup from another device</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

function PhilosophyStep({ onNext }) {
  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={true}
        contentContainerStyle={{ paddingBottom: 140 }}
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
            { title: 'Daily Reading', desc: 'A real Stoic quote chosen for you each day, drawn from the canon and grounded in your Compass.' },
            { title: 'Guided Meditations', desc: 'Five Stoic meditations, less than five minutes each. Voiced. Surfaced contextually for the time of day.' },
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
        <TouchableOpacity style={s.primaryBtn} onPress={onNext} activeOpacity={0.8}>
          <Text style={s.primaryBtnText}>Continue →</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// Three-question Compass setup. Default mode is a summary screen
// framing the defaults as a complete starting point ("Your Compass is
// ready"), with one primary continue path and a secondary
// "Customize each one" link. The customize flow is a focused 1-of-3
// card sequence with progress dots — single prompt + input + save.
// User feedback that drove this: showing all 3 fields at once was
// overwhelming, and the pre-filled paragraphs read as fixed copy
// rather than something they could edit.
const COMPASS_FIELDS = [
  {
    key: 'why', label: 'Why I practice', sub: 'What draws you to Stoicism?',
    placeholder: 'e.g. To act with integrity regardless of outcome. To be the kind of person my future self would be proud of.',
    hint: "The Stoics held that Virtue, not outcome, is the only true good. Your Why should reflect what is in your control: your character, your intentions, how you show up.\n\nA Stoic Why doesn't depend on external circumstances. 'I want to be respected' is external. 'I want to act with integrity regardless of outcome' is internal: yours to achieve regardless of what happens around you.",
  },
  {
    key: 'overcome', label: 'What I want to overcome', sub: 'What patterns or struggles brought you here?',
    placeholder: 'e.g. My tendency to avoid difficult conversations. Mistaking busyness for progress.',
    hint: "Name a pattern you can observe in yourself, not a circumstance or another person. Those are outside your control. What you can overcome is your habitual response to them.\n\n'I want to overcome anxiety' is external. 'I want to stop treating anxiety as a verdict rather than an impression' is internal. That is where the Stoic practice lives.",
  },
  {
    key: 'aspire', label: 'Who I aspire to be', sub: 'What does the best version of you look like?',
    placeholder: 'e.g. To respond to difficulty with reason rather than reaction. To be present with the people I love.',
    hint: "Aspiration in Stoic terms is the cultivation of Virtue: wisdom, courage, temperance, justice. The test is whether your aspiration describes who you are becoming, not what you are getting.\n\nEpictetus: 'First say to yourself what you would be; then do what you have to do.'",
  },
];

function CompassStep({ compass, setCompass, onNext, onSkip }) {
  // mode: 'summary' shows the three defaults as compact preview cards
  //       'edit'    shows ONE prompt at a time (1/3, 2/3, 3/3) for focused customization
  const [mode, setMode] = useState('summary');
  const [editIdx, setEditIdx] = useState(0);
  const [hintOpen, setHintOpen] = useState(false);
  const editInputRef = useRef(null);

  // Re-focus the textarea each time the user advances to the next prompt.
  // autoFocus fires only on mount; the input is reused across prompt
  // indices, so we drive focus imperatively instead.
  useEffect(() => {
    if (mode !== 'edit') return;
    const t = setTimeout(() => editInputRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, [mode, editIdx]);

  function startCustomize() {
    setMode('edit');
    setEditIdx(0);
    setHintOpen(false);
  }

  function advanceOrFinish() {
    if (editIdx < COMPASS_FIELDS.length - 1) {
      setEditIdx(editIdx + 1);
      setHintOpen(false);
    } else {
      setMode('summary');
    }
  }

  if (mode === 'edit') {
    const field = COMPASS_FIELDS[editIdx];
    return (
      <SafeAreaView style={s.safe}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          <ScrollView
            style={s.scroll}
            showsVerticalScrollIndicator={true}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 140 }}
          >
            <View style={s.stepHero}>
              <Text style={s.stepEyebrow}>{editIdx + 1} of {COMPASS_FIELDS.length}</Text>
              <Text style={s.stepTitle}>{field.label}</Text>
              <Text style={s.stepSub}>{field.sub}</Text>
            </View>

            <View style={s.stepBody}>
              <View style={s.compassField}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 4 }}>
                  <TouchableOpacity
                    onPress={() => setHintOpen(!hintOpen)}
                    style={{ padding: 4 }}
                    activeOpacity={0.7}
                  >
                    <Text style={{ fontSize: 18, color: colors.accent }}>ⓘ</Text>
                  </TouchableOpacity>
                </View>
                {hintOpen && (
                  <View style={{ backgroundColor: colors.bg, borderWidth: 0.5, borderColor: colors.border, borderRadius: 10, padding: 14, marginBottom: 10 }}>
                    <Text style={{ fontSize: 13, color: colors.textMuted, lineHeight: 21 }}>{field.hint}</Text>
                  </View>
                )}
                <TextInput
                  ref={editInputRef}
                  style={s.compassInput}
                  multiline
                  value={compass[field.key]}
                  onChangeText={text => setCompass(prev => ({ ...prev, [field.key]: text }))}
                  placeholder={field.placeholder}
                  placeholderTextColor={colors.textDim}
                  scrollEnabled={false}
                  inputAccessoryViewID={Platform.OS === 'ios' ? 'compassEditAccessory' : undefined}
                />
              </View>

              <View style={s.compassDots}>
                {COMPASS_FIELDS.map((_, i) => (
                  <View key={i} style={[s.compassDot, i === editIdx && s.compassDotActive]} />
                ))}
              </View>

              <TouchableOpacity onPress={() => setMode('summary')} style={s.compassExitLink} activeOpacity={0.7}>
                <Text style={s.compassExitLinkText}>‹ Back to summary</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
          <View style={s.footer}>
            <TouchableOpacity style={s.primaryBtn} onPress={advanceOrFinish} activeOpacity={0.8}>
              <Text style={s.primaryBtnText}>
                {editIdx < COMPASS_FIELDS.length - 1 ? 'Save & next →' : 'Save & finish →'}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
        {Platform.OS === 'ios' && (
          <InputAccessoryView nativeID="compassEditAccessory">
            <View style={s.accessoryBar}>
              <TouchableOpacity onPress={() => Keyboard.dismiss()} style={s.accessoryDone} activeOpacity={0.7}>
                <Text style={s.accessoryDoneText}>Done</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { Keyboard.dismiss(); advanceOrFinish(); }}
                style={s.accessoryAction}
                activeOpacity={0.7}
              >
                <Text style={s.accessoryActionText}>
                  {editIdx < COMPASS_FIELDS.length - 1 ? 'Save & next →' : 'Save & finish →'}
                </Text>
              </TouchableOpacity>
            </View>
          </InputAccessoryView>
        )}
      </SafeAreaView>
    );
  }

  // Summary mode (default)
  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={true}
        contentContainerStyle={{ paddingBottom: 140 }}
      >
        <View style={s.stepHero}>
          <Text style={s.stepEyebrow}>Your compass</Text>
          <Text style={s.stepTitle}>Your Compass{'\n'}is ready.</Text>
          <Text style={s.stepSub}>
            Three answers anchor your daily practice. The defaults below are a complete starting point. Customize them now or anytime later in Compass.
          </Text>
        </View>

        <View style={s.stepBody}>
          {COMPASS_FIELDS.map((field, i) => (
            <TouchableOpacity
              key={field.key}
              style={s.compassPreview}
              onPress={() => { setMode('edit'); setEditIdx(i); setHintOpen(false); }}
              activeOpacity={0.75}
            >
              <View style={s.compassPreviewHeader}>
                <Text style={s.compassPreviewLabel}>{field.label}</Text>
                <Text style={s.compassPreviewEdit}>✎ Edit</Text>
              </View>
              <Text style={s.compassPreviewText} numberOfLines={3}>
                {compass[field.key] || field.placeholder}
              </Text>
            </TouchableOpacity>
          ))}

          <View style={s.compassFooterNote}>
            <Text style={s.compassFooterText}>
              Your Compass also has a Roles section for naming the relational positions you occupy: parent, partner, colleague, citizen. You can fill that in once your practice begins, in Compass · Roles.
            </Text>
          </View>

          <TouchableOpacity onPress={startCustomize} style={s.skipLink}>
            <Text style={s.skipLinkText}>Customize each one →</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      <View style={s.footer}>
        <TouchableOpacity style={s.primaryBtn} onPress={onNext} activeOpacity={0.8}>
          <Text style={s.primaryBtnText}>Use these to start →</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function PracticePreviewStep({ onNext }) {
  const items = [
    { title: 'Stoic Compass', sub: 'Your North Star · read daily', tag: 'NOW' },
    { title: 'Daily Reading', sub: 'Personalized to your practice, fresh each day', tag: 'NOW' },
    { title: 'Morning Journal', sub: 'Reflect and intend', tag: 'NOW' },
    { title: 'Evening Journal', sub: 'Examine and release', tag: 'LATER' },
  ];

  const extras = [
    { title: 'Weekly Review', sub: 'Sunday reckoning · see the storm getting smaller across the week' },
    { title: 'Emotion log', sub: 'Reframe what disturbs you, in the moment' },
    { title: 'Optional FaceID lock', sub: 'Your practice stays private, even if your phone doesn’t' },
  ];

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView style={s.scroll} showsVerticalScrollIndicator={true} contentContainerStyle={{ paddingBottom: 140 }}>
        <View style={s.previewHero}>
          <Text style={s.previewEyebrow}>Your daily practice</Text>
          <Text style={s.previewTitle}>{`This is what\neach day looks like.`}</Text>
          <Text style={s.previewSub}>Four elements. Executed with intention.</Text>
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
        <TouchableOpacity style={s.primaryBtn} onPress={onNext} activeOpacity={0.8}>
          <Text style={s.primaryBtnText}>Continue →</Text>
        </TouchableOpacity>
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
      <ScrollView style={s.scroll} showsVerticalScrollIndicator={true} contentContainerStyle={{ paddingBottom: 140 }}>
        <View style={s.medOnbHero}>
          <Image
            source={require('../assets/meditations/img/view-from-above.jpg')}
            style={s.medOnbHeroImg}
            resizeMode="cover"
          />
          <LinearGradient
            colors={['rgba(0,0,0,0.25)', 'rgba(0,0,0,0.7)', 'rgba(0,0,0,0.95)']}
            locations={[0, 0.55, 1]}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={s.medOnbHeroText}>
            <Text style={s.previewEyebrow}>Five guided meditations</Text>
            <Text style={s.previewTitle}>{`Ancient attention\ntraining, voiced.`}</Text>
            <Text style={s.previewSub}>Less than 5 minutes each. Optional, but they deepen the practice.</Text>
          </View>
        </View>

        <View style={s.previewBody}>
          <Text style={s.previewHint}>Tap any to hear a 12-second excerpt.</Text>
          <View style={s.previewCard}>
            {MEDITATIONS_LIST.map((m, idx) => {
              const previewing = previewMedId === m.id;
              const loading = previewing && isLoading;
              return (
                <TouchableOpacity
                  key={m.id}
                  activeOpacity={0.7}
                  onPress={() => previewing ? stopPreview() : playPreview(m)}
                  style={[s.previewRow, idx < MEDITATIONS_LIST.length - 1 && s.previewRowBorder]}
                >
                  <Text style={[s.previewNum, previewing && { color: colors.accent }]}>{ROMAN[idx]}</Text>
                  <View style={s.previewContent}>
                    <Text style={[s.previewItemTitle, previewing && { color: colors.accent }]}>{m.title}</Text>
                    <Text style={s.previewItemSub}>
                      {loading ? 'Loading…' : previewing ? 'Listening · 12-second excerpt' : m.subtitle}
                    </Text>
                  </View>
                  <Text style={s.previewPlayIcon}>{previewing ? '◼' : '▶'}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={s.previewNote}>
            <Text style={s.previewNoteText}>
              The practice card surfaces the right one for the time of day. Listen on the way to work, before journaling, or anytime you need to return to yourself.
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={s.footer}>
        <TouchableOpacity style={s.primaryBtn} onPress={handleAdvance} activeOpacity={0.8}>
          <Text style={s.primaryBtnText}>Continue →</Text>
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
      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={true}
        contentContainerStyle={{ paddingBottom: 180 }}
      >
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
              { time: '7:00 AM', name: 'Stoic Compass' },
              { time: '7:30 AM', name: 'Morning Journal' },
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
      </ScrollView>

      <View style={s.footer}>
        <TouchableOpacity style={s.primaryBtn} onPress={handleEnable} activeOpacity={0.8}>
          <Text style={s.primaryBtnText}>Enable reminders</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.skipLink} onPress={onNext} activeOpacity={0.7}>
          <Text style={s.skipLinkText}>Maybe later</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
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
  welcomeRestore: { paddingVertical: 14, alignItems: 'center' },
  welcomeRestoreText: { fontSize: 13, color: colors.textMuted, letterSpacing: 0.4 },
  welcomeNameWrap: {
    marginTop: 36,
    width: '100%',
    alignItems: 'center',
  },
  welcomeNameLabel: {
    fontSize: font.labelSize,
    letterSpacing: font.sectionTracking,
    color: colors.accent,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  welcomeNameInput: {
    width: '100%',
    borderWidth: 0.5,
    borderColor: colors.accentDim,
    borderRadius: radius.md,
    backgroundColor: colors.accentBg,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: colors.textPrimary,
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
  medOnbHeroText: { padding: 36, paddingTop: 48, paddingBottom: 32, alignItems: 'center' },
  previewEyebrow: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.accent, textTransform: 'uppercase', marginBottom: 12, textAlign: 'center' },
  previewTitle: { fontSize: 44, fontWeight: '700', color: '#FFFFFF', letterSpacing: -1.5, marginBottom: 14, textAlign: 'center', lineHeight: 52 },
  previewSub: { fontSize: 17, color: colors.textMuted, textAlign: 'center', lineHeight: 26 },
  previewBody: { padding: 20 },
  previewCard: { borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.bgCard, overflow: 'hidden', marginBottom: 16 },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, paddingHorizontal: 20 },
  previewRowBorder: { borderBottomWidth: 0.5, borderBottomColor: colors.border },
  // Roman-numeral row marker. Replaces the open-circle previewDot so
  // each row reads as ordered (sequence) instead of as a checkbox to
  // complete.
  previewNum: { width: 28, fontSize: 12, color: colors.accent, letterSpacing: 1.5, fontWeight: '600', textAlign: 'center' },
  previewPlayIcon: { fontSize: 13, color: colors.accentDim, marginLeft: 8, letterSpacing: 1 },
  previewHint: { fontSize: 12, color: colors.textMuted, fontStyle: 'italic', marginBottom: 12, paddingHorizontal: 4, letterSpacing: 0.3 },
  previewContent: { flex: 1 },
  previewItemTitle: { fontSize: 16, fontWeight: '500', color: colors.textSecondary, marginBottom: 2 },
  previewItemSub: { fontSize: 13, color: colors.textMuted },
  previewTag: { borderWidth: 0.5, borderColor: colors.border, borderRadius: 5, paddingHorizontal: 10, paddingVertical: 4 },
  previewTagNow: { borderColor: colors.accentDim, backgroundColor: colors.accentBg },
  previewTagLater: { borderColor: 'transparent', backgroundColor: 'transparent' },
  previewTagTextNow: { color: colors.accent, fontWeight: '500' },
  previewTagText: { fontSize: 10, color: colors.textDim, letterSpacing: 1, textTransform: 'uppercase' },
  previewNote: { borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.lg, padding: 18, backgroundColor: colors.bgDeep },
  previewNoteText: { fontSize: 14, color: colors.textMuted, lineHeight: 22, textAlign: 'center' },
  extrasHeading: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.accent, textTransform: 'uppercase', marginTop: 28, marginBottom: 12, paddingHorizontal: 4 },

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
    top: 52,
    left: 16,
    zIndex: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 8,
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
  compassFooterNote: {
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.bgDeep,
    padding: 16,
    marginTop: 8,
    marginBottom: 16,
  },
  compassFooterText: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 20,
  },
  compassInput: {
    fontSize: 16,
    color: colors.textSecondary,
    lineHeight: 26,
    minHeight: 140,
    textAlignVertical: 'top',
    fontFamily: font.serif,
  },
  // Summary mode preview cards — show each default in a compact form
  // with a clear ✎ Edit affordance so users see the customization path
  // without having to wade through three full inputs.
  compassPreview: {
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
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
  compassPreviewEdit: {
    fontSize: 12,
    color: colors.accent,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  compassPreviewText: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 22,
    fontFamily: font.serif,
  },
  // Edit-mode progress dots (1/3, 2/3, 3/3)
  compassDots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 18 },
  compassDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.borderMid },
  compassDotActive: { backgroundColor: colors.accent, transform: [{ scale: 1.4 }] },
  // Exit link from edit mode back to the summary preview cards. Uses
  // accent color + arrow so it reads clearly as a button rather than a
  // stray sentence.
  compassExitLink: { paddingVertical: 16, alignItems: 'center' },
  compassExitLinkText: { fontSize: 14, color: colors.accent, letterSpacing: 0.5 },
  // Keyboard accessory (iOS) — surfaces Save & next above the keyboard
  // so the action isn't hidden behind it.
  accessoryBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.bgElevated,
    borderTopWidth: 0.5, borderTopColor: colors.border,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  accessoryDone: { paddingVertical: 6, paddingHorizontal: 8 },
  accessoryDoneText: { fontSize: 14, color: colors.textDim, letterSpacing: 0.3 },
  accessoryAction: { paddingVertical: 6, paddingHorizontal: 8 },
  accessoryActionText: { fontSize: 13, fontWeight: '600', color: colors.accent, letterSpacing: 1, textTransform: 'uppercase' },
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