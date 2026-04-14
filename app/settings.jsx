import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, Switch, Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, radius, spacing, font } from '../constants/theme';

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
    await AsyncStorage.setItem(NOTIF_SETTINGS_KEY, JSON.stringify(settings));
    setSaved(true);
    Alert.alert('', 'Settings saved.');
  }

  async function handleResetOnboarding() {
    await AsyncStorage.removeItem('has_onboarded');
    Alert.alert('', 'Onboarding reset. Close and reopen the app to see it.');
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
            <Text style={s.saveBtnText}>{saved ? 'Settings saved' : 'Save settings'}</Text>
          </TouchableOpacity>

          <View style={s.notifNote}>
            <Text style={s.notifNoteTitle}>About notifications</Text>
            <Text style={s.notifNoteText}>
              Push notifications will be activated in a future update. Your time preferences are saved and will be applied automatically when enabled.
            </Text>
          </View>

          <Text style={s.secLabel}>Developer</Text>
          <TouchableOpacity
            style={s.resetBtn}
            onPress={handleResetOnboarding}
            activeOpacity={0.8}
          >
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
  body: { padding: spacing.md },
  secLabel: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.textDim, textTransform: 'uppercase', marginTop: 20, marginBottom: 10 },
  card: { borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.lg, padding: 18, marginBottom: 4, backgroundColor: colors.bgCard },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowTitle: { fontSize: 16, fontWeight: '500', color: colors.textSecondary, marginBottom: 3 },
  rowSub: { fontSize: 13, color: colors.textDim, marginBottom: 0 },
  timeSection: { marginTop: 16, borderTopWidth: 0.5, borderTopColor: colors.border, paddingTop: 16 },
  timeLabel: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.textDim, textTransform: 'uppercase', marginBottom: 4, textAlign: 'center' },
  timePreview: { fontSize: 14, color: colors.textMuted, textAlign: 'center', marginBottom: 4 },
  dayRow: { flexDirection: 'row', gap: 6, marginTop: 14 },
  dayBtn: { flex: 1, borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.sm, paddingVertical: 10, alignItems: 'center', backgroundColor: colors.bgDeep },
  dayBtnActive: { borderColor: colors.accent, backgroundColor: colors.accentBg },
  dayBtnText: { fontSize: 11, color: colors.textDim },
  dayBtnTextActive: { color: colors.accent, fontWeight: '600' },
  saveBtn: { borderWidth: 0.5, borderColor: colors.borderStrong, borderRadius: radius.md, padding: 18, alignItems: 'center', backgroundColor: colors.bgCard, marginTop: 24, marginBottom: 14 },
  saveBtnDone: { borderColor: colors.successBorder, backgroundColor: colors.successBg },
  saveBtnText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, letterSpacing: 1, textTransform: 'uppercase' },
  notifNote: { borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.lg, padding: 18, marginBottom: 4, backgroundColor: colors.bgDeep },
  notifNoteTitle: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginBottom: 8 },
  notifNoteText: { fontSize: 13, color: colors.textDim, lineHeight: 20 },
  resetBtn: { borderWidth: 0.5, borderColor: '#3a2020', borderRadius: radius.md, padding: 16, alignItems: 'center', backgroundColor: '#1a0a0a', marginBottom: 32 },
  resetBtnText: { fontSize: 12, color: '#cc6060', letterSpacing: 1, textTransform: 'uppercase' },
});