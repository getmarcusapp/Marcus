import AsyncStorage from '@react-native-async-storage/async-storage';
import { getReadingHistory, getJournals, getReviews, getTriggers } from '../store/db';

// Cumulative "time in practice": total time invested across all practices,
// accumulated locally on-device. Deliberately independent of Apple Health
// permission — Health writes are gated on the user granting access, this total
// is not — so it works for every user and stays private. Fed by
// lib/useMindfulSession (screen practices: compass, reading, journals, emotions)
// and lib/meditationPlayer (guided meditations, actual listened duration).

const KEY = 'practice_time_ms';
const SEED_KEY = 'practice_time_seeded';

// Match the Health write's sanity bounds so a session left open, a stray tap,
// or a runaway timer can't distort the total. Meditations pass real listened
// duration, well within these.
const MIN_MS = 30 * 1000;
const MAX_MS = 60 * 60 * 1000;

export async function getPracticeTimeMs() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (parseInt(raw, 10) || 0) : 0;
  } catch { return 0; }
}

export async function addPracticeTime(ms) {
  try {
    if (!Number.isFinite(ms) || ms < MIN_MS) return;
    const clamped = Math.min(ms, MAX_MS);
    const total = await getPracticeTimeMs();
    await AsyncStorage.setItem(KEY, String(total + clamped));
  } catch {}
}

// Directly set the total (dev seeds / scenario setup). Marks seeded so the
// one-time auto-estimate won't later stack on top of the seeded value.
export async function setPracticeTimeMs(ms) {
  try {
    const v = Math.max(0, Math.floor(ms) || 0);
    await AsyncStorage.setItem(KEY, String(v));
    await AsyncStorage.setItem(SEED_KEY, 'true');
  } catch {}
}

// One-time gentle backfill for users who practiced before this feature existed
// (durations were never recorded). Conservatively estimates time already
// invested from logged artifacts, so a committed user doesn't open to "0m".
// New users have no history → seeds 0. Idempotent (guarded by SEED_KEY).
export async function seedPracticeTimeIfNeeded() {
  try {
    if ((await AsyncStorage.getItem(SEED_KEY)) === 'true') return;
    const [readings, journals, reviews, triggers] = await Promise.all([
      getReadingHistory(), getJournals(), getReviews(), getTriggers(),
    ]);
    const minutes =
      (readings?.length || 0) * 4 +   // daily reading + insight
      (journals?.length || 0) * 5 +   // morning / evening entries
      (reviews?.length || 0) * 8 +    // weekly review
      (triggers?.length || 0) * 3;    // emotion logs
    if (minutes > 0) {
      const total = await getPracticeTimeMs();
      await AsyncStorage.setItem(KEY, String(total + minutes * 60000));
    }
    await AsyncStorage.setItem(SEED_KEY, 'true');
  } catch {}
}
