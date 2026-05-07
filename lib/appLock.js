// App-wide privacy lock backed by FaceID/TouchID with the iOS device
// passcode as automatic fallback. Marcus journals/emotions/reviews are
// genuinely personal — this gates the whole app behind biometric auth so
// a phone left on a desk or lent to a kid doesn't expose the practice.
//
// Module-level singleton (same pattern as lib/meditationPlayer.js): one
// state shared across the root layout and the settings toggle, components
// subscribe via the useAppLock hook.

import { useEffect, useState } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SETTING_KEY = 'app_lock_enabled';

// How long the app can be backgrounded before re-locking on foreground.
// 30s is the rough industry norm — long enough that brief notification
// hops don't re-prompt, short enough that someone walking away from your
// phone doesn't get a free pass.
const RELOCK_AFTER_MS = 30 * 1000;

let lockEnabled = false;        // user setting (loaded from AsyncStorage)
let isLocked = true;            // runtime state — true = show lock screen
let backgroundedAt = null;      // timestamp of last background transition
let initialized = false;        // gates the cold-start init

const listeners = new Set();

function notify() {
  const snapshot = { lockEnabled, isLocked };
  listeners.forEach(fn => fn(snapshot));
}

export async function initAppLock() {
  if (initialized) return;
  initialized = true;
  try {
    const raw = await AsyncStorage.getItem(SETTING_KEY);
    lockEnabled = raw === 'true';
  } catch {
    lockEnabled = false;
  }
  // If lock isn't enabled, skip the lock screen entirely on cold start.
  isLocked = lockEnabled;
  notify();
}

export async function setLockEnabled(enabled) {
  lockEnabled = !!enabled;
  await AsyncStorage.setItem(SETTING_KEY, lockEnabled ? 'true' : 'false');
  // Toggling on doesn't lock immediately — the user just confirmed they
  // want it. Toggling off clears the lock if they were locked.
  if (!lockEnabled) isLocked = false;
  notify();
}

// Called when the app comes to foreground. If the lock is enabled and
// the app was backgrounded for >RELOCK_AFTER_MS, re-lock.
export function handleForeground() {
  if (!lockEnabled) return;
  if (backgroundedAt === null) return;
  const elapsed = Date.now() - backgroundedAt;
  backgroundedAt = null;
  if (elapsed >= RELOCK_AFTER_MS) {
    isLocked = true;
    notify();
  }
}

export function handleBackground() {
  backgroundedAt = Date.now();
}

export async function authenticate() {
  // Compatibility check first — if no biometric hardware AND no device
  // passcode is set, authenticate would always fail. Bail early.
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const enrolled = await LocalAuthentication.isEnrolledAsync();
  if (!hasHardware && !enrolled) {
    // Edge case: device has no passcode and no biometrics. Treat as
    // unlocked so the user isn't permanently locked out.
    isLocked = false;
    notify();
    return { success: true, fallback: 'no_hardware' };
  }
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Unlock Marcus',
    fallbackLabel: 'Use Passcode',
    disableDeviceFallback: false,
    cancelLabel: 'Cancel',
  });
  if (result.success) {
    isLocked = false;
    notify();
  }
  return result;
}

export function getState() {
  return { lockEnabled, isLocked };
}

// Hook: subscribe to lock state in any component.
export function useAppLock() {
  const [state, setState] = useState(getState);
  useEffect(() => {
    listeners.add(setState);
    return () => listeners.delete(setState);
  }, []);
  return state;
}

// Probe used by the settings toggle to verify biometric support before
// confirming the toggle. Returns the supported method name for UI labels.
export async function getSupportedAuthLabel() {
  const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) return 'FaceID';
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) return 'TouchID';
  return 'biometrics';
}
