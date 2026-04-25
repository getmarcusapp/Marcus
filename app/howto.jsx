import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors, radius, spacing, font } from '../constants/theme';

const sections = [
  {
    title: 'What is Marcus?',
    content: 'Marcus is a daily practice app rooted in Stoic philosophy — one of history\'s most practical frameworks for living well. The app is named after Marcus Aurelius, the Roman Emperor who wrote Meditations as a private journal of Stoic practice.\n\nThe goal is not productivity. Not habit tracking. It\'s a system for becoming someone you respect — through daily reflection, honest self-examination, and deliberate action.',
  },
  {
    title: 'The daily practice',
    content: 'Each day has four core elements:\n\n1. Stoic compass — Read your personal north star to anchor your intentions.\n\n2. Daily reading — A quote and reflection from Marcus Aurelius, Epictetus, or Seneca. Generated fresh each day.\n\n3. Morning journal — Set your virtue focus, reflect on what\'s in your control, and prepare for the day.\n\n4. Evening journal — Examine how you acted, confess where you fell short, and release what you carry before sleep.',
  },
  {
    title: 'The Stoic compass',
    content: 'The compass is the foundation of your practice. It has three sections:\n\nWhy I practice — What draws you to Stoicism? What brought you here?\n\nWhat I want to overcome — The patterns, fears, and struggles you want to work through.\n\nWho I aspire to be — The person you are building toward.\n\nRead your compass every morning before journaling. It takes 60 seconds and reorients everything that follows. Edit it anytime from the More tab as your answers evolve.',
  },
  {
    title: 'The four virtues',
    content: 'Stoicism centers on four cardinal virtues. Each morning you choose one as your focus:\n\nWisdom (Sophia) — Discernment and right judgment. Seeing clearly, not through bias or fear.\n\nCourage (Andreia) — Doing the right thing even when it is hard or costly.\n\nModeration (Sophrosyne) — Neither too much nor too little. Temperance in all things.\n\nJustice (Dikaiosyne) — Acting rightly toward others. Community, fairness, duty.\n\nOver time, tracking which virtues you embody and which you struggle with reveals patterns worth examining.',
  },
  {
    title: 'The emotion logger',
    content: 'Between stimulus and response there is a space. The emotion logger is that space made visible.\n\nWhen a strong emotion arises — anger, anxiety, frustration, shame — log it immediately. Name the emotion, rate the intensity, describe the trigger, and note your automatic reaction.\n\nThen read the Stoic reframe and write your chosen response. The difference between your automatic reaction and your chosen response is where the practice lives.\n\nYour logged triggers feed into the weekly review, where patterns become visible.',
  },
  {
    title: 'Cognitive distortions — the seven',
    content: 'Cognitive distortions are habitual errors in thinking that generate unnecessary suffering. They were first named by Aaron Beck in the 1950s — who built cognitive behavioral therapy by citing Epictetus directly. The patterns are the same ones the Stoics identified two thousand years earlier.\n\nMarcos tracks seven:\n\n1. Catastrophizing — Imagining the worst possible outcome when evidence doesn\'t support it. Epictetus: "Men are disturbed not by things, but by their judgments about things." The catastrophe is almost always a judgment, not a fact.\n\n2. Mind-reading — Assuming you know what others think or feel without evidence. Marcus Aurelius practiced constantly observing his own assumptions about others\' motives. Most are projections.\n\n3. Overgeneralizing — Treating one event as a permanent pattern. "I always fail at this." "People never change." The Stoic corrective: attend to what is actually in front of you, not the story you\'ve constructed around it.\n\n4. Personalizing — Taking responsibility for things outside your control. The dichotomy of control is the foundation of Stoic practice. What is mine to own? What is not? Personalizing collapses that distinction.\n\n5. Filtering — Fixating on the negative while dismissing the positive. The Stoics practiced gratitude not as optimism, but as accurate perception — seeing what is actually present, not just what is wrong.\n\n6. Emotional reasoning — Treating a feeling as proof that something is true. "I feel ashamed, therefore I must have done something shameful." Emotions are impressions — data worth examining, not verdicts to accept without scrutiny.\n\n7. Should statements — Rigid rules about how you or others must behave. "He should have known better." "I should be further along." These generate resentment and guilt in equal measure. The Stoic asks instead: what does this situation actually require?',
  },
  {
    title: 'The weekly review',
    content: 'Once a week — on the day you choose in Settings — the weekly review appears in your Practice tab.\n\nSet aside 15–30 minutes. Review what went well, where you strayed, recurring challenges, and how you treated your body and health.\n\nThe virtue ledger asks which virtue you most and least embodied this week. Over months, this data becomes a mirror.\n\nEnd the review with a single intention for the coming week. Not a list. One thing. Write it as a commitment, not a wish.',
  },
  {
    title: 'About streaks',
    content: 'Marcus tracks three streak metrics:\n\nCurrent streak — Your active run of consecutive days completing the core practice (compass + reading + morning journal). This resets if you miss a day.\n\nLongest streak — Your best ever run. This never resets.\n\nTotal days practiced — Your cumulative count of practice days, ever.\n\nIf you break your current streak, the app won\'t berate you. The Stoic response to a missed day is simple: begin again.',
  },
  {
    title: 'Memento mori',
    content: '"Memento mori" means remember that you will die. It is not morbid — it is clarifying.\n\nThe Stoics used awareness of death to sharpen their attention to the present. If you knew this was your last week, what would you stop wasting time on? What would you start doing immediately?\n\nThe skull in Marcus is not decoration. It is a daily reminder that time is finite and the practice matters.',
  },
];

export default function HowToScreen() {
  const router = useRouter();
  const [openSection, setOpenSection] = useState(null);

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>

        <View style={s.hero}>
          <TouchableOpacity onPress={() => router.back()} style={s.backRow}>
            <Text style={s.backArrow}>‹</Text>
            <Text style={s.backLabel}>More</Text>
          </TouchableOpacity>
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
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  hero: {
    backgroundColor: colors.bgDeep,
    padding: spacing.xl,
    paddingTop: 36,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 18 },
  backArrow: { fontSize: 24, color: colors.accent },
  backLabel: { fontSize: 13, color: colors.accent, letterSpacing: 0.8, textTransform: 'uppercase' },
  eyebrow: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.accent, textTransform: 'uppercase', marginBottom: 8 },
  title: { fontSize: font.heroSize, fontWeight: '600', color: colors.textPrimary, letterSpacing: -0.8, marginBottom: 8 },
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
  sectionTitle: { fontSize: 16, fontWeight: '500', color: colors.textSecondary, flex: 1 },
  sectionChev: { fontSize: 20, color: colors.textDim, marginLeft: 12 },
  sectionBody: { padding: 18, borderTopWidth: 0.5, borderTopColor: colors.border, backgroundColor: colors.bgDeep },
  sectionContent: { fontSize: 15, color: colors.textSecondary, lineHeight: 26 },
  footer: { padding: spacing.xl, paddingBottom: 48, alignItems: 'center' },
  footerQuote: { fontSize: 14, color: colors.textMuted, fontStyle: 'italic', fontFamily: font.serif, textAlign: 'center', lineHeight: 22, marginBottom: 8 },
  footerAttr: { fontSize: 11, color: colors.textDim, letterSpacing: 1, textTransform: 'uppercase' },
});