import React, { useRef, useCallback, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, Alert,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, radius, spacing, font } from '../constants/theme';
import { cancelAllNotifications } from '../notifications';
import { clearTodayPractice, sealTodayPractice, seedWeekOfPracticeData } from '../store/db';
import { useMiniPlayerInset } from '../components/MiniMeditationPlayer';
import { ScreenHeader } from '../components/ScreenHeader';

const NOTIF_SETTINGS_KEY = 'notification_settings';

export default function DeveloperSettingsScreen() {
  const router = useRouter();
  const playerInset = useMiniPlayerInset();
  const scrollRef = useRef(null);
  const [premiumFlag, setPremiumFlag] = useState(null);
  const [trialSim, setTrialSim] = useState(null);

  useFocusEffect(useCallback(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    AsyncStorage.getItem('has_premium').then(v => setPremiumFlag(v === 'true'));
    AsyncStorage.getItem('dev_trial_days_left').then(v => setTrialSim(v === null ? null : parseInt(v, 10)));
  }, []));

  async function setTrialSimDays(days) {
    if (days === null) {
      await AsyncStorage.removeItem('dev_trial_days_left');
      setTrialSim(null);
      Alert.alert('', 'Trial simulation cleared. Re-open Practice to see the change.');
    } else {
      await AsyncStorage.setItem('dev_trial_days_left', String(days));
      setTrialSim(days);
      Alert.alert(
        '',
        `Trial simulation set to ${days} day${days === 1 ? '' : 's'} left. The trial banner will show on Practice with this value. Re-open Practice to see the change.`,
      );
    }
  }

  async function togglePremiumFlag() {
    const next = !premiumFlag;
    await AsyncStorage.setItem('has_premium', next ? 'true' : 'false');
    setPremiumFlag(next);
    Alert.alert(
      '',
      next
        ? 'Premium flag ON. Gates are bypassed — you have full access.'
        : 'Premium flag OFF. Gates engage — locked actions push to paywall. The app re-applies the dev override on next launch, so this is a per-session test.',
    );
  }

  async function handleResetOnboarding() {
    await AsyncStorage.removeItem('has_onboarded');
    Alert.alert('', 'Onboarding reset. Close and reopen the app to see it.');
  }

  function handleWipeAllData() {
    Alert.alert(
      'Wipe ALL data?',
      'Erases every journal entry, emotion log, weekly review, daily reading, compass, streak, and saved preference. Onboarding will run again. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Wipe everything',
          style: 'destructive',
          onPress: async () => {
            await cancelAllNotifications().catch(() => {});
            await AsyncStorage.clear();
            Alert.alert(
              '',
              'All data wiped. Force-close the app (swipe up in app switcher) and reopen to start as a Day 1 user.'
            );
          },
        },
      ]
    );
  }

  async function handleDisableAll() {
    await cancelAllNotifications();
    const raw = await AsyncStorage.getItem(NOTIF_SETTINGS_KEY);
    const settings = raw ? JSON.parse(raw) : {};
    const updated = { ...settings, morningEnabled: false, eveningEnabled: false, reviewEnabled: false };
    await AsyncStorage.setItem(NOTIF_SETTINGS_KEY, JSON.stringify(updated));
    Alert.alert('', 'All notifications cancelled.');
  }

  function handleResetTodayPractice() {
    Alert.alert(
      "Reset today's practice?",
      'Clears compass, reading, and any morning/evening journal entries saved today. History from previous days is kept.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            await clearTodayPractice();
            Alert.alert('', "Today's practice cleared.");
          },
        },
      ]
    );
  }

  function handleSeedWeek() {
    Alert.alert(
      'Seed a week of practice data?',
      'Replaces existing journals and emotion logs with seven days of synthetic morning + evening entries and twelve emotion logs trending from high to low intensity. Useful for previewing the weekly review with realistic spread. Today is left untouched.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Seed',
          onPress: async () => {
            const r = await seedWeekOfPracticeData();
            Alert.alert('', `Seeded ${r.journals} journal entries and ${r.triggers} emotion logs across the past 7 days. Open the Weekly Review to see the spread.`);
          },
        },
      ]
    );
  }

  function handleSealTodayPractice() {
    Alert.alert(
      "Seal today's practice?",
      'Marks compass, reading, morning journal, and evening journal as complete with seeded test data. Useful for previewing the sealed state.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Seal',
          onPress: async () => {
            await sealTodayPractice();
            Alert.alert('', "Today's practice sealed.");
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScreenHeader fromPath="/settings" fromLabel="Settings" />
      <ScrollView ref={scrollRef} style={[s.scroll, { backgroundColor: colors.bgCard }]} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: playerInset }}>
        <View style={s.hero}>
          <Text style={s.eyebrow}>Developer</Text>
          <Text style={s.title}>Developer Tools</Text>
          <Text style={s.sub}>Diagnostics and test seeds for development builds</Text>
        </View>

        <View style={s.body}>
          <Text style={s.secLabel}>Paywall gate</Text>
          <TouchableOpacity style={s.resetBtn} onPress={togglePremiumFlag} activeOpacity={0.8}>
            <Text style={s.resetBtnText}>
              Premium flag: {premiumFlag === null ? '…' : premiumFlag ? 'ON · gates bypassed' : 'OFF · gates engage'}
            </Text>
          </TouchableOpacity>
          <Text style={s.helperText}>
            Dev/beta builds auto-set this flag to ON on app launch so testers aren't blocked. Toggle OFF to verify the read-only / paywall behavior in this session. The launch override reapplies next time the app starts.
          </Text>

          <Text style={s.secLabel}>Trial simulation</Text>
          <Text style={[s.helperText, { marginTop: 0, marginBottom: 12 }]}>
            Simulate being mid-trial so you can preview the trial-state UX (banner on Practice). Active simulation overrides the Premium flag — clear it when done. Currently: {trialSim === null ? 'off' : `${trialSim} day${trialSim === 1 ? '' : 's'} left`}.
          </Text>
          <TouchableOpacity style={s.resetBtn} onPress={() => setTrialSimDays(7)} activeOpacity={0.8}>
            <Text style={s.resetBtnText}>Simulate trial · 7 days left</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.resetBtn} onPress={() => setTrialSimDays(3)} activeOpacity={0.8}>
            <Text style={s.resetBtnText}>Simulate trial · 3 days left</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.resetBtn} onPress={() => setTrialSimDays(1)} activeOpacity={0.8}>
            <Text style={s.resetBtnText}>Simulate trial · 1 day left</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.resetBtn} onPress={() => setTrialSimDays(0)} activeOpacity={0.8}>
            <Text style={s.resetBtnText}>Simulate trial · ends today</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.resetBtn} onPress={() => setTrialSimDays(null)} activeOpacity={0.8}>
            <Text style={s.resetBtnText}>Clear trial simulation</Text>
          </TouchableOpacity>

          <Text style={s.secLabel}>Notifications</Text>
          <TouchableOpacity style={s.dangerBtn} onPress={handleDisableAll} activeOpacity={0.8}>
            <Text style={s.dangerBtnText}>Cancel all notifications</Text>
          </TouchableOpacity>

          <Text style={s.secLabel}>Practice state</Text>
          <TouchableOpacity style={s.resetBtn} onPress={handleResetTodayPractice} activeOpacity={0.8}>
            <Text style={s.resetBtnText}>Reset today's practice</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.resetBtn} onPress={handleSealTodayPractice} activeOpacity={0.8}>
            <Text style={s.resetBtnText}>Seal today's practice</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.resetBtn} onPress={handleSeedWeek} activeOpacity={0.8}>
            <Text style={s.resetBtnText}>Seed week of practice data</Text>
          </TouchableOpacity>
          <Text style={s.helperText}>
            Fills the past 7 days with morning + evening journals and 12 emotion logs trending down from high to low intensity. Sets streak to 7. Use this to preview the Weekly Review and trend visualizations.
          </Text>

          <Text style={s.secLabel}>Onboarding</Text>
          <TouchableOpacity style={s.resetBtn} onPress={handleResetOnboarding} activeOpacity={0.8}>
            <Text style={s.resetBtnText}>Reset onboarding</Text>
          </TouchableOpacity>

          <Text style={s.secLabel}>Day 1 reset</Text>
          <TouchableOpacity style={s.dangerBtn} onPress={handleWipeAllData} activeOpacity={0.8}>
            <Text style={s.dangerBtnText}>Wipe all data</Text>
          </TouchableOpacity>
          <Text style={s.helperText}>
            Clears every journal, emotion log, review, reading, compass, and streak. Onboarding runs again. Use to test the first-run experience.
          </Text>
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
  title: { fontSize: font.titleSize, fontFamily: font.display, color: colors.textPrimary, letterSpacing: -0.5, marginBottom: 6 },
  sub: { fontSize: font.subSize, color: colors.textMuted },
  body: { padding: spacing.md, paddingBottom: 36 },
  secLabel: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.accent, fontFamily: font.bodyMedium, textTransform: 'uppercase', marginTop: 20, marginBottom: 10 },
  dangerBtn: { borderWidth: 0.5, borderColor: '#5a2a2a', borderRadius: radius.md, padding: 16, alignItems: 'center', backgroundColor: '#1a0a0a', marginBottom: 8 },
  dangerBtnText: { fontSize: 14, color: '#cc6666', letterSpacing: 0.5 },
  resetBtn: { borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.md, padding: 16, alignItems: 'center', backgroundColor: colors.bgCard, marginBottom: 8 },
  resetBtnText: { fontSize: 14, color: colors.textMuted, letterSpacing: 0.5 },
  helperText: { fontSize: 12, color: colors.textDim, lineHeight: 18, marginTop: 6, marginHorizontal: 4 },
});
