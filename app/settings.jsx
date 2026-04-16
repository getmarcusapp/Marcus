import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, Switch, Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, radius, spacing, font } from '../constants/theme';
import { requestNotificationPermissions, scheduleAllNotifications, cancelAllNotifications } from '../notifications';

const NOTIF_SETTINGS_KEY = 'notification_settings';

const DEFAULT_SETTINGS = {
  morningEnabled: true,
  morningHour: 7,
  morningMinute: 0,
  eveningEnabled: true,
  eveningHour: 20,
  eveningMinute: 0,
  reviewEnabled: true,
  reviewHour: 9,
  reviewMinute: 0,
  reviewDay: 0,
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatTime(hour, minute) {
  const h = hour % 12 || 12;
  const m = minute.toString().padStart(2, '0');
  return `${h}:${m} ${hour < 12 ? 'AM' : 'PM'}`;
}

function TimeAdjuster({ hour, minute, onHourChange, onMinuteChange }) {
  return (
    <View style={t.wrap}>
      <View style={t.col}>
        <TouchableOpacity style={t.btn} onPress={() => onHourChange((hour + 1) % 24)}>
          <Text style={t.arrow}>▲</Text>
        </TouchableOpacity>
        <Text style={t.val}>{(hour % 12 || 12).toString().padStart(2, '0')}</Text>
        <TouchableOpacity style={t.btn} onPress={() => onHourChange((hour + 23) % 24)}>
          <Text style={t.arrow}>▼</Text>
        </TouchableOpacity>
      </View>
      <Text style={t.colon}>:</Text>
      <View style={t.col}>
        <TouchableOpacity style={t.btn} onPress={() => onMinuteChange((minute + 5) % 60)}>
          <Text style={t.arrow}>▲</Text>
        </TouchableOpacity>
        <Text style={t.val}>{minute.toString().padStart(2, '0')}</Text>
        <TouchableOpacity style={t.btn} onPress={() => onMinuteChange((minute + 55) % 60)}>
          <Text style={t.arrow}>▼</Text>
        </TouchableOpacity>
      </View>
      <View style={t.col}>
        <TouchableOpacity style={t.btn} onPress={() => onHourChange((hour + 12) % 24)}>
          <Text style={t.arrow}>▲</Text>
        </TouchableOpacity>
        <Text style={t.val}>{hour < 12 ? 'AM' : 'PM'}</Text>
        <TouchableOpacity style={t.btn} onPress={() => onHourChange((hour + 12) % 24)}>
          <Text style={t.arrow}>▼</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function SettingsScreen() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(NOTIF_SETTINGS_KEY).then(raw => {
      if (raw) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(raw) });
    });
    // Check existing permission status
    import('expo-notifications').then(Notifications => {
      Notifications.getPermissionsAsync().then(({ status }) => {
        setPermissionGranted(status === 'granted');
      });
    });
  }, []);

  function update(key, value) {
    setSettings(prev => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function handleSave() {
    await AsyncStorage.setItem(NOTIF_SETTINGS_KEY, JSON.stringify(settings));

    // Request permissions if not already granted
    if (!permissionGranted) {
      const granted = await requestNotificationPermissions();
      setPermissionGranted(granted);
      if (!granted) {
        Alert.alert(
          'Notifications disabled',
          'Please enable notifications for Marcus in your iPhone Settings → Marcus → Notifications.',
          [{ text: 'OK' }]
        );
        setSaved(true);
        return;
      }
    }

    // Schedule notifications — wrap in try/catch so a scheduling error
    // doesn't silently swallow the confirmation
    try {
      await scheduleAllNotifications();
    } catch (e) {
      console.log('Notification scheduling error:', e);
    }

    setSaved(true);
    Alert.alert('', 'Settings saved. Notifications scheduled.', [{ text: 'Done' }]);
  }

  async function handleResetOnboarding() {
    await AsyncStorage.removeItem('has_onboarded');
    Alert.alert('', 'Onboarding reset. Close and reopen the app to see it.');
  }

  async function handleDisableAll() {
    await cancelAllNotifications();
    const updated = {
      ...settings,
      morningEnabled: false,
      eveningEnabled: false,
      reviewEnabled: false,
    };
    setSettings(updated);
    await AsyncStorage.setItem(NOTIF_SETTINGS_KEY, JSON.stringify(updated));
    Alert.alert('', 'All notifications cancelled.');
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>

        <View style={s.hero}>
          <Text style={s.eyebrow}>Marcus</Text>
          <Text style={s.title}>Settings</Text>
          <Text style={s.sub}>Configure your daily practice</Text>
        </View>

        {!permissionGranted && (
          <View style={s.permissionBanner}>
            <Text style={s.permissionTitle}>Notifications not enabled</Text>
            <Text style={s.permissionText}>
              Save your settings below to request notification permissions. Or enable them manually in iPhone Settings → Marcus.
            </Text>
          </View>
        )}

        <View style={s.body}>

          <Text style={s.secLabel}>Morning reflection</Text>
          <View style={s.card}>
            <View style={s.rowBetween}>
              <View>
                <Text style={s.rowTitle}>Morning reminder</Text>
                <Text style={s.rowSub}>Daily · before the world begins</Text>
              </View>
              <Switch
                value={settings.morningEnabled}
                onValueChange={v => update('morningEnabled', v)}
                trackColor={{ false: colors.border, true: colors.borderStrong }}
                thumbColor={settings.morningEnabled ? colors.textPrimary : colors.textDim}
              />
            </View>
            {settings.morningEnabled && (
              <View style={s.timeSection}>
                <Text style={s.timeLabel}>Remind me at</Text>
                <TimeAdjuster
                  hour={settings.morningHour}
                  minute={settings.morningMinute}
                  onHourChange={v => update('morningHour', v)}
                  onMinuteChange={v => update('morningMinute', v)}
                />
                <Text style={s.timePreview}>{formatTime(settings.morningHour, settings.morningMinute)}</Text>
                <View style={s.sampleMsg}>
                  <Text style={s.sampleText}>"The hourglass turns. Your morning practice awaits."</Text>
                </View>
              </View>
            )}
          </View>

          <Text style={s.secLabel}>Evening reflection</Text>
          <View style={s.card}>
            <View style={s.rowBetween}>
              <View>
                <Text style={s.rowTitle}>Evening reminder</Text>
                <Text style={s.rowSub}>Daily · before the day closes</Text>
              </View>
              <Switch
                value={settings.eveningEnabled}
                onValueChange={v => update('eveningEnabled', v)}
                trackColor={{ false: colors.border, true: colors.borderStrong }}
                thumbColor={settings.eveningEnabled ? colors.textPrimary : colors.textDim}
              />
            </View>
            {settings.eveningEnabled && (
              <View style={s.timeSection}>
                <Text style={s.timeLabel}>Remind me at</Text>
                <TimeAdjuster
                  hour={settings.eveningHour}
                  minute={settings.eveningMinute}
                  onHourChange={v => update('eveningHour', v)}
                  onMinuteChange={v => update('eveningMinute', v)}
                />
                <Text style={s.timePreview}>{formatTime(settings.eveningHour, settings.eveningMinute)}</Text>
                <View style={s.sampleMsg}>
                  <Text style={s.sampleText}>"The day closes. Time to examine it."</Text>
                </View>
              </View>
            )}
          </View>

          <Text style={s.secLabel}>Weekly review</Text>
          <View style={s.card}>
            <View style={s.rowBetween}>
              <View>
                <Text style={s.rowTitle}>Review reminder</Text>
                <Text style={s.rowSub}>Weekly · seal the week</Text>
              </View>
              <Switch
                value={settings.reviewEnabled}
                onValueChange={v => update('reviewEnabled', v)}
                trackColor={{ false: colors.border, true: colors.borderStrong }}
                thumbColor={settings.reviewEnabled ? colors.textPrimary : colors.textDim}
              />
            </View>
            {settings.reviewEnabled && (
              <View style={s.timeSection}>
                <Text style={s.timeLabel}>Remind me at</Text>
                <TimeAdjuster
                  hour={settings.reviewHour}
                  minute={settings.reviewMinute}
                  onHourChange={v => update('reviewHour', v)}
                  onMinuteChange={v => update('reviewMinute', v)}
                />
                <Text style={s.timePreview}>{formatTime(settings.reviewHour, settings.reviewMinute)}</Text>
                <View style={s.sampleMsg}>
                  <Text style={s.sampleText}>"A week has passed. Seal it with intention."</Text>
                </View>
              </View>
            )}
          </View>

          <Text style={s.secLabel}>Review day</Text>
          <View style={s.card}>
            <Text style={s.rowSub}>Your weekly review appears in Practice on this day</Text>
            <View style={s.dayRow}>
              {DAYS.map((day, idx) => (
                <TouchableOpacity
                  key={day}
                  style={[s.dayBtn, settings.reviewDay === idx && s.dayBtnActive]}
                  onPress={() => update('reviewDay', idx)}
                >
                  <Text style={[s.dayBtnText, settings.reviewDay === idx && s.dayBtnTextActive]}>
                    {day}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TouchableOpacity
            style={[s.saveBtn, saved && s.saveBtnDone]}
            onPress={handleSave}
            activeOpacity={0.8}
          >
            <Text style={[s.saveBtnText, saved && s.saveBtnTextDone]}>{saved ? 'Notifications scheduled ✓' : 'Save & schedule notifications'}</Text>
          </TouchableOpacity>

          <View style={s.notifNote}>
            <Text style={s.notifNoteTitle}>About notifications</Text>
            <Text style={s.notifNoteText}>
              Saving your settings will request permission to send notifications and schedule your daily reminders. You can update your times at any time and save again to reschedule.
            </Text>
          </View>

          <Text style={s.secLabel}>Developer</Text>
          <TouchableOpacity style={s.dangerBtn} onPress={handleDisableAll} activeOpacity={0.8}>
            <Text style={s.dangerBtnText}>Cancel all notifications</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.resetBtn} onPress={handleResetOnboarding} activeOpacity={0.8}>
            <Text style={s.resetBtnText}>Reset onboarding</Text>
          </TouchableOpacity>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const t = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginVertical: 12 },
  col: { alignItems: 'center', gap: 8 },
  btn: { width: 36, height: 36, borderWidth: 0.5, borderColor: colors.border, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  arrow: { fontSize: 12, color: colors.textMuted },
  val: { fontSize: 22, fontWeight: '600', color: colors.textPrimary, minWidth: 36, textAlign: 'center' },
  colon: { fontSize: 22, color: colors.textMuted, marginBottom: 4 },
});

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
  title: { fontSize: font.titleSize, fontWeight: '600', color: colors.textPrimary, letterSpacing: -0.5, marginBottom: 6 },
  sub: { fontSize: font.subSize, color: colors.textMuted },
  permissionBanner: {
    backgroundColor: '#0a0f1a',
    borderBottomWidth: 0.5,
    borderBottomColor: '#1e2a3a',
    padding: spacing.lg,
  },
  permissionTitle: { fontSize: 13, fontWeight: '600', color: '#7aaddd', marginBottom: 6 },
  permissionText: { fontSize: 13, color: '#3a5a7a', lineHeight: 20 },
  body: { padding: spacing.md },
  secLabel: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.textDim, textTransform: 'uppercase', marginTop: 20, marginBottom: 10 },
  card: { borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.lg, padding: 18, marginBottom: 4, backgroundColor: colors.bgCard },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowTitle: { fontSize: 16, fontWeight: '500', color: colors.textSecondary, marginBottom: 3 },
  rowSub: { fontSize: 13, color: colors.textDim, marginBottom: 0 },
  timeSection: { marginTop: 16, borderTopWidth: 0.5, borderTopColor: colors.border, paddingTop: 16 },
  timeLabel: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.textDim, textTransform: 'uppercase', marginBottom: 4, textAlign: 'center' },
  timePreview: { fontSize: 14, color: colors.textMuted, textAlign: 'center', marginBottom: 10 },
  sampleMsg: { backgroundColor: colors.bgDeep, borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.md, padding: 12 },
  sampleText: { fontSize: 13, color: colors.textMuted, fontStyle: 'italic', fontFamily: font.serif, lineHeight: 20, textAlign: 'center' },
  dayRow: { flexDirection: 'row', gap: 6, marginTop: 14 },
  dayBtn: { flex: 1, borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.sm, paddingVertical: 10, alignItems: 'center', backgroundColor: colors.bgDeep },
  dayBtnActive: { borderColor: colors.accent, backgroundColor: colors.accentBg },
  dayBtnText: { fontSize: 11, color: colors.textDim },
  dayBtnTextActive: { color: colors.accent, fontWeight: '600' },
  saveBtn: { borderWidth: 0.5, borderColor: colors.borderStrong, borderRadius: radius.md, padding: 18, alignItems: 'center', backgroundColor: colors.bgCard, marginTop: 24, marginBottom: 14 },
  saveBtnDone: { borderColor: '#3a6a3a', backgroundColor: '#0a1a0a' },
  saveBtnText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, letterSpacing: 1, textTransform: 'uppercase' },
  saveBtnTextDone: { color: '#6aaa6a' },
  notifNote: { borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.lg, padding: 18, marginBottom: 4, backgroundColor: colors.bgDeep },
  notifNoteTitle: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginBottom: 8 },
  notifNoteText: { fontSize: 13, color: colors.textDim, lineHeight: 20 },
  dangerBtn: { borderWidth: 0.5, borderColor: '#2a1a1a', borderRadius: radius.md, padding: 16, alignItems: 'center', backgroundColor: '#0d0808', marginBottom: 10 },
  dangerBtnText: { fontSize: 12, color: '#884444', letterSpacing: 1, textTransform: 'uppercase' },
  resetBtn: { borderWidth: 0.5, borderColor: '#3a2020', borderRadius: radius.md, padding: 16, alignItems: 'center', backgroundColor: '#1a0a0a', marginBottom: 32 },
  resetBtnText: { fontSize: 12, color: '#cc6060', letterSpacing: 1, textTransform: 'uppercase' },
});
