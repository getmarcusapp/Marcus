import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import Constants from 'expo-constants';

// Bump this when the backup schema changes in a backward-incompatible way.
// Older backups (lower version) can still be imported via migration logic
// in importBackup. Newer backups are rejected with a friendly error.
const BACKUP_VERSION = 1;

// Keys that participate in backup. Deliberately excludes:
//   - reading_today, compass_done (today-only state; new device starts fresh)
//   - has_onboarded (set automatically post-import so user lands in app)
//   - has_premium (managed by RevenueCat / IAP, not user data)
//   - health_permission_asked (iOS-managed; would lie if carried over)
//   - app_lock_enabled (device-specific; new phone may lack biometrics)
const BACKUP_KEYS = [
  'journals',
  'triggers',
  'reviews',
  'compass',
  'compass_roles',
  'streak',
  'reading_history',
  // User-owned data added later. Without these, a device migration silently
  // drops the commonplace collection, the lifetime practice total, and the
  // mid-day pause state.
  'saved_lines',
  'practice_time_ms',
  'prosoche_last',
  'reading_log',
  'notification_settings',
  'user_name',
];

function tidyDateForFilename() {
  return new Date().toISOString().split('T')[0];
}

export async function exportBackup() {
  const data = {};
  for (const key of BACKUP_KEYS) {
    const raw = await AsyncStorage.getItem(key);
    if (raw === null) continue;
    // Try to embed parsed JSON for human readability; fall back to raw
    // string for plain-text values (e.g., user_name).
    try {
      data[key] = JSON.parse(raw);
    } catch (e) {
      data[key] = raw;
    }
  }

  const payload = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    appVersion: Constants.expoConfig?.version ?? 'unknown',
    data,
  };

  const json = JSON.stringify(payload, null, 2);
  const filename = `marcus-backup-${tidyDateForFilename()}.json`;
  const uri = FileSystem.documentDirectory + filename;
  await FileSystem.writeAsStringAsync(uri, json, { encoding: FileSystem.EncodingType.UTF8 });

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device.');
  }
  await Sharing.shareAsync(uri, {
    mimeType: 'application/json',
    dialogTitle: 'Marcus practice backup',
    UTI: 'public.json',
  });

  return {
    filename,
    journalCount: (data.journals || []).length,
    triggerCount: (data.triggers || []).length,
    reviewCount: (data.reviews || []).length,
  };
}

// Picks a JSON file via the iOS document picker and replaces the current
// device's practice data with its contents. Replace (not merge) is
// deliberate: simpler mental model, no duplicate-id ambiguity, and matches
// the actual migration use case ("I got a new phone, restore my practice").
export async function pickAndImportBackup() {
  const picked = await DocumentPicker.getDocumentAsync({
    type: 'application/json',
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (picked.canceled) return { canceled: true };

  const asset = picked.assets?.[0];
  if (!asset?.uri) throw new Error('Could not read the selected file.');

  const text = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.UTF8 });
  let payload;
  try {
    payload = JSON.parse(text);
  } catch (e) {
    throw new Error('That file is not valid JSON.');
  }

  if (typeof payload?.version !== 'number' || !payload?.data) {
    throw new Error('That does not look like a Marcus backup.');
  }
  if (payload.version > BACKUP_VERSION) {
    throw new Error('This backup was made with a newer version of Marcus. Update the app and try again.');
  }

  const data = payload.data;
  for (const key of BACKUP_KEYS) {
    if (data[key] === undefined) {
      await AsyncStorage.removeItem(key);
      continue;
    }
    const value = typeof data[key] === 'string' ? data[key] : JSON.stringify(data[key]);
    await AsyncStorage.setItem(key, value);
  }

  // Mark onboarding complete so a fresh-install restore lands in the app
  // instead of bouncing the user back through onboarding.
  await AsyncStorage.setItem('has_onboarded', 'true');

  return {
    canceled: false,
    journalCount: (data.journals || []).length,
    triggerCount: (data.triggers || []).length,
    reviewCount: (data.reviews || []).length,
    exportedAt: payload.exportedAt,
  };
}
