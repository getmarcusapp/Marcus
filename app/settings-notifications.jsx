import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, Switch, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, radius, spacing, font } from '../constants/theme';
import { requestNotificationPermissions, scheduleAllNotifications } from '../notifications';

const NOTIF_SETTINGS_KEY = 'notification_settings';

const DEFAULT_SETTINGS = {
  // Compass orients the day; Morning Journal acts on that orientation.
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
    </View>
  );
}

export default function NotificationsSettingsScreen() {
  const router = useRouter();
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(NOTIF_SETTINGS_KEY).then(raw => {
      if (raw) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(raw) });
    });
  }, []);

  function update(key, value) {
    setSettings(prev => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function handleSave() {
    const granted = await requestNotificationPermissions();
    setPermissionGranted(granted);
    if (!granted) {
      Alert.alert(
        'Permission denied',
        'Enable notifications in iPhone Settings → Marcus to receive reminders.',
      );
      return;
    }
    await AsyncStorage.setItem(NOTIF_SETTINGS_KEY, JSON.stringify(settings));
    await scheduleAllNotifications();
    setSaved(true);
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>

        <View style={s.hero}>
          <TouchableOpacity onPress={() => router.replace('/settings')} style={s.backRow}>
            <Text style={s.backArrow}>‹</Text>
            <Text style={s.backLabel}>Settings</Text>
          </TouchableOpacity>
          <Text style={s.eyebrow}>Notifications</Text>
          <Text style={s.title}>Notifications & Reminders</Text>
          <Text style={s.sub}>When Marcus reaches out across the day</Text>
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
          <Text style={s.secLabel}>Compass</Text>
          <View style={s.card}>
            <View style={s.rowBetween}>
              <View>
                <Text style={s.rowTitle}>Compass reminder</Text>
                <Text style={s.rowSub}>Daily · read before the day begins</Text>
              </View>
              <Switch
                value={settings.compassEnabled}
                onValueChange={v => update('compassEnabled', v)}
                trackColor={{ false: colors.border, true: colors.borderStrong }}
                thumbColor={settings.compassEnabled ? colors.textPrimary : colors.textDim}
              />
            </View>
            {settings.compassEnabled && (
              <View style={s.timeSection}>
                <Text style={s.timeLabel}>Remind me at</Text>
                <TimeAdjuster
                  hour={settings.compassHour}
                  minute={settings.compassMinute}
                  onHourChange={v => update('compassHour', v)}
                  onMinuteChange={v => update('compassMinute', v)}
                />
                <Text style={s.timePreview}>{formatTime(settings.compassHour, settings.compassMinute)}</Text>
                <View style={s.sampleMsg}>
                  <Text style={s.sampleText}>"Before you begin, read your compass. Remember who you are trying to be."</Text>
                </View>
              </View>
            )}
          </View>

          <Text style={s.secLabel}>Morning Journal</Text>
          <View style={s.card}>
            <View style={s.rowBetween}>
              <View>
                <Text style={s.rowTitle}>Morning reminder</Text>
                <Text style={s.rowSub}>Daily · after the compass orients the day</Text>
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

          <Text style={s.secLabel}>Mid-day check-in</Text>
          <View style={s.card}>
            <View style={s.rowBetween}>
              <View>
                <Text style={s.rowTitle}>Mid-day pause</Text>
                <Text style={s.rowSub}>Daily · examine before the afternoon</Text>
              </View>
              <Switch
                value={settings.middayEnabled}
                onValueChange={v => update('middayEnabled', v)}
                trackColor={{ false: colors.border, true: colors.borderStrong }}
                thumbColor={settings.middayEnabled ? colors.textPrimary : colors.textDim}
              />
            </View>
            {settings.middayEnabled && (
              <View style={s.timeSection}>
                <Text style={s.timeLabel}>Remind me at</Text>
                <TimeAdjuster
                  hour={settings.middayHour}
                  minute={settings.middayMinute}
                  onHourChange={v => update('middayHour', v)}
                  onMinuteChange={v => update('middayMinute', v)}
                />
                <Text style={s.timePreview}>{formatTime(settings.middayHour, settings.middayMinute)}</Text>
                <View style={s.sampleMsg}>
                  <Text style={s.sampleText}>"Pause. How has the morning gone? Have you acted in accordance with your values?"</Text>
                </View>
              </View>
            )}
          </View>

          <Text style={s.secLabel}>Evening Journal</Text>
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
  backRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, marginLeft: -4 },
  backArrow: { fontSize: 24, color: colors.accent },
  backLabel: { fontSize: 13, color: colors.accent, letterSpacing: 0.8, textTransform: 'uppercase' },
  eyebrow: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.accent, textTransform: 'uppercase', marginBottom: 8 },
  title: { fontSize: font.titleSize, fontWeight: '300', color: colors.textPrimary, letterSpacing: -0.5, marginBottom: 6 },
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
  secLabel: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.accent, textTransform: 'uppercase', marginTop: 20, marginBottom: 10 },
  card: { borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.lg, padding: 18, marginBottom: 4, backgroundColor: colors.bgCard },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowTitle: { fontSize: 16, fontWeight: '500', color: colors.textSecondary, marginBottom: 3 },
  rowSub: { fontSize: 13, color: colors.textDim, marginBottom: 0 },
  timeSection: { marginTop: 16, borderTopWidth: 0.5, borderTopColor: colors.border, paddingTop: 16 },
  timeLabel: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.textDim, textTransform: 'uppercase', marginBottom: 4, textAlign: 'center' },
  timePreview: { fontSize: 14, color: colors.textMuted, textAlign: 'center', marginBottom: 10 },
  sampleMsg: { backgroundColor: colors.bgDeep, borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.md, padding: 12 },
  sampleText: { fontSize: 13, color: colors.textMuted, fontFamily: font.serif, lineHeight: 20, textAlign: 'center' },
  dayRow: { flexDirection: 'row', gap: 6, marginTop: 14 },
  dayBtn: { flex: 1, borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.sm, paddingVertical: 10, alignItems: 'center', backgroundColor: colors.bgDeep },
  dayBtnActive: { borderColor: colors.accent, backgroundColor: colors.accentBg },
  dayBtnText: { fontSize: 11, color: colors.textDim },
  dayBtnTextActive: { color: colors.accent, fontWeight: '600' },
  saveBtn: { borderWidth: 0.5, borderColor: colors.borderStrong, borderRadius: radius.md, padding: 18, alignItems: 'center', backgroundColor: colors.bgCard, marginTop: 24, marginBottom: 14 },
  saveBtnDone: { backgroundColor: colors.accentBg, borderColor: colors.accent },
  saveBtnText: { fontSize: 14, fontWeight: '500', color: colors.textPrimary, letterSpacing: 1, textTransform: 'uppercase' },
  saveBtnTextDone: { color: colors.accent },
  notifNote: { padding: 16, backgroundColor: colors.bgCard, borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.md, marginBottom: 24 },
  notifNoteTitle: { fontSize: 12, fontWeight: '600', color: colors.textMuted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
  notifNoteText: { fontSize: 13, color: colors.textDim, lineHeight: 20 },
});
