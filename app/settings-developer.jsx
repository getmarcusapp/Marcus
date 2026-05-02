import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, radius, spacing, font } from '../constants/theme';
import { cancelAllNotifications } from '../notifications';
import { clearTodayPractice, sealTodayPractice } from '../store/db';

const NOTIF_SETTINGS_KEY = 'notification_settings';

export default function DeveloperSettingsScreen() {
  const router = useRouter();

  async function handleResetOnboarding() {
    await AsyncStorage.removeItem('has_onboarded');
    Alert.alert('', 'Onboarding reset. Close and reopen the app to see it.');
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
      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.hero}>
          <TouchableOpacity onPress={() => router.replace('/settings')} style={s.backRow}>
            <Text style={s.backArrow}>‹</Text>
            <Text style={s.backLabel}>Settings</Text>
          </TouchableOpacity>
          <Text style={s.eyebrow}>Developer</Text>
          <Text style={s.title}>Developer Tools</Text>
          <Text style={s.sub}>Diagnostics and test seeds for development builds</Text>
        </View>

        <View style={s.body}>
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

          <Text style={s.secLabel}>Onboarding</Text>
          <TouchableOpacity style={s.resetBtn} onPress={handleResetOnboarding} activeOpacity={0.8}>
            <Text style={s.resetBtnText}>Reset onboarding</Text>
          </TouchableOpacity>
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
  backRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, marginLeft: -4 },
  backArrow: { fontSize: 24, color: colors.accent },
  backLabel: { fontSize: 13, color: colors.accent, letterSpacing: 0.8, textTransform: 'uppercase' },
  eyebrow: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.accent, textTransform: 'uppercase', marginBottom: 8 },
  title: { fontSize: font.titleSize, fontWeight: '300', color: colors.textPrimary, letterSpacing: -0.5, marginBottom: 6 },
  sub: { fontSize: font.subSize, color: colors.textMuted },
  body: { padding: spacing.md, paddingBottom: 60 },
  secLabel: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.accent, textTransform: 'uppercase', marginTop: 20, marginBottom: 10 },
  dangerBtn: { borderWidth: 0.5, borderColor: '#5a2a2a', borderRadius: radius.md, padding: 16, alignItems: 'center', backgroundColor: '#1a0a0a', marginBottom: 8 },
  dangerBtnText: { fontSize: 14, color: '#cc6666', letterSpacing: 0.5 },
  resetBtn: { borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.md, padding: 16, alignItems: 'center', backgroundColor: colors.bgCard, marginBottom: 8 },
  resetBtnText: { fontSize: 14, color: colors.textMuted, letterSpacing: 0.5 },
});
