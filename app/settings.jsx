import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, Alert, Share, Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, radius, spacing, font } from '../constants/theme';
import { getJournals, getTriggers, getStreak } from '../store/db';
import * as health from '../lib/health';

const NOTIF_SETTINGS_KEY = 'notification_settings';

function NavRow({ label, sub, onPress, last }) {
  return (
    <TouchableOpacity
      style={[s.row, !last && s.rowBorder]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={{ flex: 1 }}>
        <Text style={s.rowLabel}>{label}</Text>
        {sub ? <Text style={s.rowSub}>{sub}</Text> : null}
      </View>
      <Text style={s.chev}>›</Text>
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const [healthAsked, setHealthAsked] = useState(false);
  const [healthAvailable, setHealthAvailable] = useState(false);
  const [reminderSummary, setReminderSummary] = useState('');

  useEffect(() => {
    (async () => {
      const asked = await AsyncStorage.getItem('health_permission_asked');
      setHealthAsked(asked === 'true');
      setHealthAvailable(await health.isAvailable());
      const raw = await AsyncStorage.getItem(NOTIF_SETTINGS_KEY);
      if (raw) {
        const cfg = JSON.parse(raw);
        const enabled = ['morningEnabled', 'compassEnabled', 'middayEnabled', 'eveningEnabled', 'reviewEnabled']
          .filter(k => cfg[k]).length;
        setReminderSummary(enabled === 0 ? 'Off' : `${enabled} of 5 active`);
      } else {
        setReminderSummary('Configure your reminders');
      }
    })();
  }, []);

  async function handleConnectHealth() {
    const ok = await health.requestPermission();
    await AsyncStorage.setItem('health_permission_asked', 'true');
    setHealthAsked(true);
    if (!ok) {
      Alert.alert(
        'Permission denied',
        'Open iOS Settings to allow Marcus to write Mindful Minutes to Apple Health.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ],
      );
    }
  }

  async function handleExport() {
    try {
      const journals = await getJournals();
      const triggers = await getTriggers();
      const streak = await getStreak();
      const lines = [];
      lines.push(`Marcus practice export — ${new Date().toDateString()}`);
      lines.push(`Streak: ${streak.current ?? 0} day(s) current, ${streak.longest ?? 0} longest, ${streak.totalDays ?? 0} total\n`);
      if (journals.length) {
        lines.push('--- Journal entries ---');
        journals.forEach(j => {
          lines.push(`\n${new Date(j.date).toDateString()} — ${j.type}${j.virtue ? ` (Virtue: ${j.virtue})` : ''}`);
          Object.values(j.answers || {}).forEach(a => a && lines.push(`  ${a}`));
        });
      }
      if (triggers.length) {
        lines.push('\n\n--- Emotion logs ---');
        triggers.forEach(t => {
          lines.push(`\n${new Date(t.date).toDateString()} — ${t.emotion} (intensity ${t.intensity}/10)`);
          if (t.trigger) lines.push(`  Trigger: ${t.trigger}`);
          if (t.reaction) lines.push(`  Automatic reaction: ${t.reaction}`);
          if (t.chosenResponse) lines.push(`  Chosen response: ${t.chosenResponse}`);
        });
      }
      await Share.share({ message: lines.join('\n'), title: 'Marcus Practice Export' });
    } catch (e) {
      Alert.alert('', 'Could not export. Try again later.');
    }
  }

  async function handleShareApp() {
    try {
      await Share.share({
        message: 'Marcus — a daily Stoic practice app. Become someone you respect.\n\nhttps://getmarcus.app',
      });
    } catch (e) { /* swallowed */ }
  }

  async function handleContactSupport() {
    const url = 'mailto:support@getmarcus.app?subject=Marcus%20app%20support';
    const supported = await Linking.canOpenURL(url);
    if (supported) await Linking.openURL(url);
    else Alert.alert('', 'No email app set up. Email support@getmarcus.app');
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.hero}>
          <Text style={s.eyebrow}>Marcus</Text>
          <Text style={s.title}>Settings</Text>
          <Text style={s.sub}>Configure your daily practice</Text>
        </View>

        <View style={s.body}>
          <Text style={s.secLabel}>Practice</Text>
          <View style={s.card}>
            <NavRow
              label="Notifications & Reminders"
              sub={reminderSummary}
              onPress={() => router.push('/settings-notifications')}
            />
            {healthAvailable && (
              <NavRow
                label="Apple Health"
                sub={healthAsked ? 'Mindful Minutes connected' : 'Sync your practice as Mindful Minutes'}
                onPress={handleConnectHealth}
                last
              />
            )}
          </View>

          <Text style={s.secLabel}>Data</Text>
          <View style={s.card}>
            <NavRow
              label="Export your practice data"
              sub="Share journal entries and emotion logs as text"
              onPress={handleExport}
              last
            />
          </View>

          <Text style={s.secLabel}>Marcus</Text>
          <View style={s.card}>
            <NavRow
              label="Share Marcus"
              sub="Send the app to someone who could use it"
              onPress={handleShareApp}
            />
            <NavRow
              label="Contact support"
              sub="Email the team — questions, feedback, bug reports"
              onPress={handleContactSupport}
              last
            />
          </View>

          <Text style={s.secLabel}>About</Text>
          <View style={s.card}>
            <View style={[s.row, s.rowBorder]}>
              <Text style={s.rowLabel}>Version</Text>
              <Text style={s.rowValue}>1.0.0</Text>
            </View>
            <NavRow
              label="Privacy policy"
              onPress={() => Linking.openURL('https://getmarcus.app/privacy.html')}
            />
            <NavRow
              label="getmarcus.app"
              onPress={() => Linking.openURL('https://getmarcus.app')}
              last
            />
          </View>

          <Text style={s.secLabel}>Developer</Text>
          <View style={s.card}>
            <NavRow
              label="Developer Tools"
              sub="Diagnostics and test seeds"
              onPress={() => router.push('/settings-developer')}
              last
            />
          </View>
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
  eyebrow: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.accent, textTransform: 'uppercase', marginBottom: 8 },
  title: { fontSize: font.titleSize, fontWeight: '300', color: colors.textPrimary, letterSpacing: -0.5, marginBottom: 6 },
  sub: { fontSize: font.subSize, color: colors.textMuted },
  body: { padding: spacing.md, paddingBottom: 60 },
  secLabel: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.accent, textTransform: 'uppercase', marginTop: 20, marginBottom: 10 },
  card: { borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.bgCard, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', padding: 18 },
  rowBorder: { borderBottomWidth: 0.5, borderBottomColor: colors.border },
  rowLabel: { fontSize: 16, fontWeight: '500', color: colors.textSecondary, marginBottom: 3 },
  rowSub: { fontSize: 13, color: colors.textDim },
  rowValue: { fontSize: 14, color: colors.textMuted, marginLeft: 12 },
  chev: { fontSize: 22, color: colors.textMuted, marginLeft: 12 },
});
