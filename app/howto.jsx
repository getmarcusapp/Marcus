import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { colors, radius, spacing, font } from '../constants/theme';
import { useMiniPlayerInset } from '../components/MiniMeditationPlayer';
import { ScreenHeader } from '../components/ScreenHeader';

const sections = [
  {
    title: 'What is Marcus?',
    content: 'Marcus is a daily practice app rooted in Stoic philosophy: one of history\'s most practical frameworks for living well. The app is named after Marcus Aurelius, the Roman Emperor who wrote Meditations as a private journal of Stoic practice.\n\nThe goal is not productivity. Not habit tracking. It\'s a system for becoming someone you respect through daily reflection, honest self-examination, and deliberate action.',
  },
  {
    title: 'The daily practice',
    content: 'Each day has four core elements:\n\n1. Stoic Compass: Read your personal North Star to anchor your intentions.\n\n2. Daily Reading: A real Stoic quote chosen for you each day, grounded in your Compass, with a 3-4 sentence reflection in your voice. Save your own insight underneath; it accumulates in Past readings.\n\n3. Morning Journal: Reflect on what is in your control, foresee what may come, and prepare for the day.\n\n4. Evening Journal: Examine how you acted, confess where you fell short, and release what you carry before sleep.\n\nGuided meditations are available alongside the daily practice. They are optional. Use them when they serve.',
  },
  {
    title: 'The Stoic Compass',
    content: 'The compass is the foundation of your practice. It has four sections:\n\nWhy I practice: What draws you to Stoicism? What brought you here?\n\nWhat I want to overcome: The patterns, fears, and struggles you want to work through.\n\nWho I aspire to be: The person you are building toward.\n\nThe roles I am called to fulfill: The relational positions you actually occupy. Parent, partner, friend, colleague, citizen. The Stoics called these your kathēkonta, the appropriate actions owed to others by virtue of the position you occupy. Marcus Aurelius reminded himself of his roles every morning. So can you.\n\nRead your compass every morning before journaling. It takes 60 seconds and reorients everything that follows. Edit it anytime from the More tab as your answers evolve.',
  },
  {
    title: 'The four Virtues',
    content: 'Stoicism centers on four cardinal Virtues. They are not menu choices, and they are not separable. Wisdom without Justice is shallow. Courage without Temperance is recklessness. The Stoic does not pick one virtue for the day; the Stoic watches for all four in every situation.\n\nWisdom: Discernment and right judgment. Seeing clearly, not through bias or fear.\n\nCourage: Doing the right thing even when it is hard or costly.\n\nTemperance: Neither too much nor too little. The disciplined middle path.\n\nJustice: Acting rightly toward others. Community, fairness, duty.\n\nThe weekly review asks which Virtue you most embodied and which you fell short on. Over months, that answer becomes a mirror.',
  },
  {
    title: 'The emotion logger',
    content: 'Between stimulus and response there is a space. The emotion logger is that space made visible.\n\nWhen a strong emotion arises (anger, anxiety, frustration, shame), log it immediately. Name the emotion, rate the intensity, describe the trigger, and note your automatic reaction.\n\nThen read the Stoic reframe and write your chosen response. The difference between your automatic reaction and your chosen response is where the practice lives.\n\nYour logged triggers feed into the weekly review, where patterns become visible.',
  },
  {
    title: 'Cognitive distortions: the nine',
    content: 'Cognitive distortions are habitual errors in thinking that generate unnecessary suffering. They were first named by Aaron Beck in the 1950s, who built cognitive behavioral therapy by citing Epictetus directly. The patterns are the same ones the Stoics identified two thousand years earlier.\n\nMarcus tracks nine:\n\n1. Catastrophizing: Imagining the worst possible outcome when evidence doesn\'t support it. Epictetus: "Men are disturbed not by things, but by their judgments about things." The catastrophe is almost always a judgment, not a fact.\n\n2. Mind-reading: Assuming you know what others think or feel without evidence. Marcus Aurelius practiced constantly observing his own assumptions about others\' motives. Most are projections.\n\n3. Overgeneralizing: Treating one event as a permanent pattern. "I always fail at this." "People never change." The Stoic corrective: attend to what is actually in front of you, not the story you\'ve constructed around it.\n\n4. Personalizing: Taking responsibility for things outside your control. The dichotomy of control is the foundation of Stoic practice. What is mine to own? What is not? Personalizing collapses that distinction.\n\n5. Filtering: Fixating on the negative while dismissing the positive. The Stoics practiced gratitude not as optimism, but as accurate perception: seeing what is actually present, not just what is wrong.\n\n6. Emotional reasoning: Treating a feeling as proof that something is true. "I feel ashamed, therefore I must have done something shameful." Emotions are impressions: data worth examining, not verdicts to accept without scrutiny.\n\n7. Should statements: Rigid rules about how you or others must behave. "He should have known better." "I should be further along." These generate resentment and guilt in equal measure. The Stoic asks instead: what does this situation actually require?\n\n8. All-or-nothing thinking: Seeing situations in binary terms with no middle ground. "Either I do this perfectly or I have failed." The Stoics held that progress, not perfection, is the standard. Most days are neither triumphs nor disasters; they are the ordinary ground on which character is built.\n\n9. Labeling: Reducing yourself or another person to a fixed essence rather than describing a behavior. "I am a screw-up." "She is selfish." Epictetus\'s core distinction applies directly: an act is not the actor. A person is not their worst moment, and a single label cannot contain a life.',
  },
  {
    title: 'The weekly review',
    content: 'Once a week, on the day you choose in Settings, the weekly review appears in your Practice tab.\n\nSet aside 15 to 30 minutes. The review walks you through where you embodied Virtue, where you fell short, the recurring challenges that kept showing up, and how you treated your body and health.\n\nThe Virtue Ledger asks which Virtue you most and least embodied this week. Over months, this data becomes a mirror.\n\nIf you have named your roles in the Compass, an Account prompt asks how you served each one this week. The Stoic discipline of action made visible week by week.\n\nEnd the review with a single Commit prompt: one thing you will do differently next week. Not a list. One thing. Write it as a commitment, not a wish.',
  },
  {
    title: 'Guided meditations',
    content: 'Six short audio sessions, voiced. Each runs less than five minutes. Optional alongside the daily practice, surfaced contextually for the time of day.\n\nView From Above: Rise above your circumstances to see them at scale.\n\nPremeditatio Malorum: Look at what might go wrong before the day begins, so it cannot surprise you. Best in the morning.\n\nThe Evening Examination: Three honest questions. Then put the day down.\n\nNegative Visualization: Imagine the absence of what you love, to see it clearly.\n\nThe Present Moment: Pure attention training. Not staying. Returning.\n\nMemento Mori: Remember that you will die. Not to grieve, but to live differently.\n\nUse them on the way to work, before journaling, or whenever you need to return to yourself. They are not required for your streak. They are a tool.',
  },
  {
    title: 'About streaks',
    content: 'Marcus tracks three streak metrics:\n\nCurrent streak: Your active run of consecutive days completing the full daily practice: compass, daily reading, morning journal, and evening journal. A day must be fully sealed (all four) to count.\n\nLongest streak: Your best ever run. This never resets.\n\nTotal days practiced: Your cumulative count of fully sealed days, ever.\n\nGrace day: Missing a single day does not break your streak. Marcus carries you forward. If you miss two days in a row, the current streak resets. Your longest and total are preserved.\n\nIf you break your current streak, the app won\'t berate you. The Stoic response to a missed day is simple: begin again.',
  },
  {
    title: 'Apple Health',
    content: 'Marcus can sync to Apple Health as Mindful Minutes: your Stoic practice counted alongside meditation, breathwork, and other mindfulness time.\n\nWhen connected, each practice you complete (compass, daily reading, morning journal, evening journal, or emotion log) is recorded as a Mindful Session. The session contains only the start and end timestamps, never the content of your journal entries.\n\nMarcus does not read any health data from your device. The integration is opt-in and one-way: Marcus writes, never reads.\n\nConnect from Settings → Apple Health. Once granted, iOS only allows changes from system Settings → Privacy & Security → Health → Marcus.',
  },
  {
    title: 'Memento mori',
    content: '"Memento mori" means remember that you will die. This is not morbid. It is clarifying.\n\nThe Stoics used awareness of death to sharpen their attention to the present. If you knew this was your last week, what would you stop wasting time on? What would you start doing immediately?\n\nThe skull in Marcus is not decoration. It is a daily reminder that time is finite and the practice matters.',
  },
];

export default function HowToScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const fromPath = params?.from || '/more';
  const fromLabel = params?.fromLabel || 'More';
  const [openSection, setOpenSection] = useState(null);
  const scrollRef = useRef(null);
  const playerInset = useMiniPlayerInset();

  useFocusEffect(useCallback(() => {
    setOpenSection(null);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, []));

  return (
    <SafeAreaView style={s.safe}>
      <ScreenHeader fromPath={fromPath} fromLabel={fromLabel} />
      <ScrollView
        ref={scrollRef}
        style={[s.scroll, { backgroundColor: colors.bgCard }]}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: playerInset }}
      >

        <View style={s.hero}>
          <Text style={s.eyebrow}>Marcus</Text>
          <Text style={s.title}>How it works</Text>
          <Text style={s.sub}>Everything you need to know about your Stoic practice</Text>
        </View>

        <View style={s.body}>
          {sections.map((section, idx) => (
            <TouchableOpacity
              key={idx}
              style={[s.sectionBlock, openSection === idx && s.sectionBlockOpen]}
              onPress={() => setOpenSection(openSection === idx ? null : idx)}
              activeOpacity={0.8}
            >
              <View style={s.sectionHeader}>
                <Text style={s.sectionTitle}>{section.title}</Text>
                <Text style={s.sectionChev}>{openSection === idx ? '∨' : '›'}</Text>
              </View>
              {openSection === idx && (
                <View style={s.sectionBody}>
                  <Text style={s.sectionContent}>{section.content}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        <View style={s.footer}>
          <Text style={s.footerQuote}>"Waste no more time arguing about what a good man should be. Be one."</Text>
          <Text style={s.footerAttr}>Marcus Aurelius · Meditations</Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgDeep },
  scroll: { flex: 1 },
  hero: {
    backgroundColor: colors.bgDeep,
    padding: spacing.xl,
    paddingTop: 52,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  eyebrow: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.accent, fontFamily: font.bodyMedium, textTransform: 'uppercase', marginBottom: 8 },
  title: { fontSize: font.heroSize, fontFamily: font.display, color: colors.textPrimary, letterSpacing: -0.8, marginBottom: 8 },
  sub: { fontSize: font.subSize, color: colors.textMuted, lineHeight: 22 },
  body: { padding: spacing.md, paddingTop: spacing.lg },
  sectionBlock: {
    borderWidth: 0.5, borderColor: colors.border,
    borderRadius: radius.lg, marginBottom: 10, overflow: 'hidden',
  },
  sectionBlockOpen: { borderColor: colors.borderMid },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 18, backgroundColor: colors.bgCard,
  },
  sectionTitle: { fontSize: 16, fontFamily: font.bodyMedium, color: colors.textSecondary, flex: 1 },
  sectionChev: { fontSize: 20, color: colors.textDim, marginLeft: 12 },
  sectionBody: { padding: 18, borderTopWidth: 0.5, borderTopColor: colors.border, backgroundColor: colors.bgDeep },
  sectionContent: { fontSize: 15, color: colors.textSecondary, lineHeight: 26 },
  footer: { padding: spacing.xl, paddingBottom: 36, alignItems: 'center' },
  footerQuote: { fontSize: 14, color: colors.textMuted, fontStyle: 'italic', fontFamily: font.serif, textAlign: 'center', lineHeight: 22, marginBottom: 8 },
  footerAttr: { fontSize: 11, color: colors.textDim, letterSpacing: 1, fontFamily: font.bodyMedium, textTransform: 'uppercase' },
});