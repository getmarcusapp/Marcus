import { Platform } from 'react-native';
import AppleHealthKit from 'react-native-health';

const PERMISSIONS = {
  permissions: {
    read: [],
    write: [AppleHealthKit.Constants.Permissions.MindfulSession],
  },
};

let initialized = false;

function isPlatformSupported() {
  return Platform.OS === 'ios';
}

export function isAvailable() {
  return new Promise(resolve => {
    if (!isPlatformSupported()) return resolve(false);
    AppleHealthKit.isAvailable((err, available) => resolve(!err && !!available));
  });
}

// Triggers iOS native permission sheet on first call. Once the user has
// answered, subsequent calls don't show the sheet again — iOS only ever
// shows it once per usage description string.
export function requestPermission() {
  return new Promise(resolve => {
    if (!isPlatformSupported()) return resolve(false);
    AppleHealthKit.initHealthKit(PERMISSIONS, err => {
      initialized = !err;
      resolve(!err);
    });
  });
}

// Note: iOS does not provide a programmatic way to check whether
// MindfulSession write authorization was granted. We treat any
// successful initHealthKit call as "asked" and rely on the write call
// to silently fail if denied. UI can use the `health_permission_asked`
// AsyncStorage flag to know whether we've prompted.
export function isInitialized() {
  return initialized;
}

const MIN_DURATION_MS = 30 * 1000;
const MAX_DURATION_MS = 30 * 60 * 1000;

export function writeMindfulSession(startMs, endMs) {
  return new Promise(resolve => {
    if (!isPlatformSupported()) return resolve(false);
    if (!initialized) return resolve(false);
    if (!startMs || !endMs) return resolve(false);
    const duration = endMs - startMs;
    if (duration < MIN_DURATION_MS || duration > MAX_DURATION_MS) return resolve(false);
    const options = {
      startDate: new Date(startMs).toISOString(),
      endDate: new Date(endMs).toISOString(),
    };
    AppleHealthKit.saveMindfulSession(options, err => resolve(!err));
  });
}
