import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, Alert, Share, Linking, Switch,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, radius, spacing, font } from '../constants/theme';
import { getJournals, getTriggers, getStreak } from '../store/db';
import * as health from '../lib/health';
import { useAppLock, setLockEnabled, authenticate, getSupportedAuthLabel } from '../lib/appLock';
import { exportBackup, pickAndImportBackup } from '../lib/backup';

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
  const params = useLocalSearchParams();
  const fromPath = params?.from || '/more';
  const fromLabel = params?.fromLabel || 'More';
  const [healthAsked, setHealthAsked] = useState(false);
  const [healthAvailable, setHealthAvailable] = useState(false);
  const [reminderSummary, setReminderSummary] = useState('');
  const [authLabel, setAuthLabel] = useState('FaceID');
  const { lockEnabled } = useAppLock();

  // Re-load on focus (not just mount) so the reminder summary refreshes
  // when the user returns from the Notifications subscreen — otherwise
  // toggling reminders there leaves the "X of 5 active" line stale.
  useFocusEffect(useCallback(() => {
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
      try { setAuthLabel(await getSupportedAuthLabel()); } catch {}
    })();
  }, []));

  async function handleConnectHealth() {
    if (healthAsked) {
      // iOS won't re-prompt once asked. Send the user to system Settings
      // where they can toggle Mindful Sessions write access.
      Alert.alert(
        'Manage Apple Health',
        'Once Marcus has asked for permission, iOS only allows changes from system Settings → Privacy & Security → Health → Marcus.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ],
      );
      return;
    }
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

  async function handleExportBackup() {
    try {
      await exportBackup();
    } catch (e) {
      Alert.alert('', e?.message || 'Could not export the backup file.');
    }
  }

  function handleImportBackup() {
    Alert.alert(
      'Restore from a backup file?',
      'Importing replaces every journal entry, emotion log, weekly review, compass, streak, and reading history on this device with the contents of the backup. This cannot be undone. If you have practice on this device you want to keep, export it first.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Choose file…',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await pickAndImportBackup();
              if (result.canceled) return;
              const exportedDate = result.exportedAt
                ? new Date(result.exportedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                : 'an earlier date';
              Alert.alert(
                'Restored',
                `Imported ${result.journalCount} journal entries, ${result.triggerCount} emotion logs, and ${result.reviewCount} weekly reviews from a backup made on ${exportedDate}. Force-close Marcus and reopen so the practice screen reflects the restored data.`,
              );
            } catch (e) {
              Alert.alert('', e?.message || 'Could not import that file.');
            }
          },
        },
      ],
    );
  }

  async function handleToggleLock(next) {
    if (next) {
      // Confirm hardware works before persisting the setting — saves the
      // user from enabling a lock they can't actually unlock.
      const r = await authenticate().catch(() => ({ success: false }));
      if (!r.success) {
        Alert.alert(
          '',
          `Couldn't authenticate. Make sure ${authLabel} is set up in iOS Settings, then try again.`
        );
        return;
      }
      await setLockEnabled(true);
    } else {
      // Confirm before disabling so a casual phone-borrower can't turn
      // the lock off without auth.
      const r = await authenticate().catch(() => ({ success: false }));
      if (!r.success) return;
      await setLockEnabled(false);
    }
  }

  async function handleShareApp() {
    try {
      await Share.share({
        message: 'Marcus. A daily Stoic practice app. Become someone you respect.\n\nhttps://getmarcus.app',
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
      <ScrollView style={s.scroll} showsVerticalScrollIndicator={true}>
        <View style={s.hero}>
          <TouchableOpacity onPress={() => router.replace(fromPath)} style={s.backRow}>
            <Text style={s.backArrow}>‹</Text>
            <Text style={s.backLabel}>{fromLabel}</Text>
          </TouchableOpacity>
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

          <Text style={s.secLabel}>Privacy</Text>
          <View style={s.card}>
            <View style={s.lockRow}>
              <View style={s.lockTextWrap}>
                <Text style={s.rowLabel}>Require {authLabel} to open Marcus</Text>
                <Text style={s.rowSub}>
                  Your journal, emotions, and reflections stay private when others have access to your phone. Re-locks after the app has been backgrounded for 30 seconds.
                </Text>
              </View>
              <Switch
                value={lockEnabled}
                onValueChange={handleToggleLock}
                trackColor={{ false: colors.border, true: colors.accent }}
                thumbColor={colors.textPrimary}
              />
            </View>
          </View>

          <Text style={s.secLabel}>Data</Text>
          <View style={s.card}>
            <NavRow
              label="Export backup file"
              sub="Save a complete copy to Files. Restore on a new device."
              onPress={handleExportBackup}
            />
            <NavRow
              label="Import backup file"
              sub="Restore everything from a previous export"
              onPress={handleImportBackup}
            />
            <NavRow
              label="Export as text"
              sub="Share journals and emotion logs in human-readable form"
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
              sub="Email the team. Questions, feedback, bug reports."
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
    paddingTop: 52,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  backRow: {
    position: 'absolute', top: 12, left: 16, zIndex: 10,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 8,
  },
  backArrow: { fontSize: 18, color: colors.accent, marginTop: -2 },
  backLabel: { fontSize: 12, color: colors.accent, letterSpacing: 0.8, textTransform: 'uppercase' },
  eyebrow: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.accent, textTransform: 'uppercase', marginBottom: 8 },
  title: { fontSize: font.titleSize, fontWeight: '300', color: colors.textPrimary, letterSpacing: -0.5, marginBottom: 6 },
  sub: { fontSize: font.subSize, color: colors.textMuted },
  body: { padding: spacing.md, paddingBottom: 60 },
  secLabel: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.accent, textTransform: 'uppercase', marginTop: 20, marginBottom: 10 },
  card: { borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.bgCard, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', padding: 18 },
  rowBorder: { borderBottomWidth: 0.5, borderBottomColor: colors.border },
  rowLabel: { fontSize: 16, fontWeight: '500', color: colors.textSecondary, marginBottom: 3 },
  rowSub: { fontSize: 13, color: colors.textDim, lineHeight: 18 },
  lockRow: { flexDirection: 'row', alignItems: 'center', padding: 18, gap: 14 },
  lockTextWrap: { flex: 1 },
  rowValue: { fontSize: 14, color: colors.textMuted, marginLeft: 12 },
  chev: { fontSize: 22, color: colors.textMuted, marginLeft: 12 },
});
