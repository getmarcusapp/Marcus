import AsyncStorage from '@react-native-async-storage/async-storage';
import { getEntitlementRecord } from '../store/purchases';
import { track } from './analytics';

// WHAT DID THEY DO BEFORE THEY DECIDED? By November 2026 two things were
// known and one was not. Known: three in four new users never came back after
// their first session, and a trial started in that first session had never
// once turned into a payment (0 of 7), while trials started a day or two
// later had (3 of 3). Not known: what the people who stayed had actually
// done, because analytics here is anonymous by design and no event said.
//
// So the three events that mark a decision (starting a trial, turning
// renewal off, the first payment after a trial) now carry a few counts. They
// are counts and nothing else: how many days were sealed, how many entries
// exist, never a word of what was written. Each is capped, so a count cannot
// single out a long-time user. No identifier travels with them.

const FIRST_OPEN_KEY = 'usage_first_open';
const MEDITATIONS_KEY = 'usage_meditations';
const CONVERTED_KEY = 'usage_trial_converted';
const CANCEL_SEEN_KEY = 'usage_cancel_seen';
const CAP = 30;

const cap = n => Math.max(0, Math.min(CAP, Math.floor(Number(n) || 0)));
const list = raw => { try { const v = JSON.parse(raw); return Array.isArray(v) ? v : []; } catch { return []; } };

// Called once per launch: remembers the first day this device opened the app.
export async function noteFirstOpen() {
  try {
    if (!(await AsyncStorage.getItem(FIRST_OPEN_KEY))) {
      await AsyncStorage.setItem(FIRST_OPEN_KEY, new Date().toISOString());
    }
  } catch {}
}

// A meditation counts once it has been listened to for long enough to mean it
// (lib/meditationPlayer.js decides that).
export async function noteMeditation() {
  try {
    const n = parseInt(await AsyncStorage.getItem(MEDITATIONS_KEY), 10) || 0;
    await AsyncStorage.setItem(MEDITATIONS_KEY, String(n + 1));
  } catch {}
}

// The counts. Every value is a small whole number; nothing here is text the
// person wrote. Keep the keys stable: reports are read by key.
export async function usageCounts() {
  try {
    const pairs = await AsyncStorage.multiGet([
      'streak', 'journals', 'reading_history', MEDITATIONS_KEY, FIRST_OPEN_KEY, 'free_day',
    ]);
    const v = Object.fromEntries(pairs);
    let streak = {};
    try { streak = JSON.parse(v.streak) || {}; } catch {}
    const first = Date.parse(v[FIRST_OPEN_KEY] || '');
    return {
      days_sealed: cap(streak.sealedDays),
      entries: cap(list(v.journals).length),
      readings: cap(list(v.reading_history).length),
      meditations: cap(v[MEDITATIONS_KEY]),
      days_since_first_open: first ? cap((Date.now() - first) / 864e5) : 0,
      took_free_day: v.free_day ? 1 : 0,
    };
  } catch {
    return {};
  }
}

// track(), with the counts attached.
export async function trackWithUsage(event, props) {
  track(event, { ...(props || {}), ...(await usageCounts()) });
}

// Two moments the paywall never sees, read from RevenueCat's record on open.
// Each is reported once per device.
//   trial_converted   the first paid period after a trial
//   renewal_off       renewal was switched off (whether or not the cancel
//                     question is answered; lib/cancelSurvey.js asks it)
export async function noteSubscriptionMoments() {
  try {
    const ent = await getEntitlementRecord();
    if (!ent || !ent.expirationDate) return;
    if (ent.isActive && ent.periodType === 'NORMAL' && !(await AsyncStorage.getItem(CONVERTED_KEY))) {
      await AsyncStorage.setItem(CONVERTED_KEY, '1');
      await trackWithUsage('trial_converted');
    }
    if (ent.unsubscribeDetectedAt && !ent.billingIssueDetectedAt && !(await AsyncStorage.getItem(CANCEL_SEEN_KEY))) {
      await AsyncStorage.setItem(CANCEL_SEEN_KEY, '1');
      await trackWithUsage('renewal_off', { stage: ent.periodType === 'TRIAL' ? 'trial' : 'paid' });
    }
  } catch {}
}
