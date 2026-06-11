import AsyncStorage from '@react-native-async-storage/async-storage';
import { FOUNDATIONS_LETTERS } from '../constants/foundations';

// Unlock + read state for the Foundations letters. One letter unlocks per
// day, counted from the first time this is called (effectively first app
// open after the feature ships — existing TestFlight users start the series
// from Letter I, which is the right experience anyway). Earlier letters stay
// readable forever; the cadence only gates how fast the series opens up.

const START_KEY = 'foundations_start_date';
const READ_KEY = 'foundations_read';

export async function getFoundationsState() {
  let start = null;
  try {
    start = await AsyncStorage.getItem(START_KEY);
    if (!start) {
      start = new Date().toDateString();
      await AsyncStorage.setItem(START_KEY, start);
    }
  } catch {
    start = new Date().toDateString();
  }
  // toDateString round-trips to local midnight, so day boundaries follow the
  // user's calendar rather than 24h blocks from the install moment.
  const startMs = new Date(start).getTime();
  const daysSinceStart = Math.max(0, Math.floor((Date.now() - startMs) / 86400000));
  const unlockedCount = Math.min(daysSinceStart + 1, FOUNDATIONS_LETTERS.length);

  let read = [];
  try {
    const raw = await AsyncStorage.getItem(READ_KEY);
    read = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(read)) read = [];
  } catch {
    read = [];
  }

  // The next unlocked-but-unread letter (1-based), or null when the user is
  // caught up. Drives the Practice-screen card: present when there's
  // something new to read, absent once today's letter is done.
  let nextUnread = null;
  for (let i = 1; i <= unlockedCount; i++) {
    if (!read.includes(i)) { nextUnread = i; break; }
  }

  return { daysSinceStart, unlockedCount, read, nextUnread };
}

export async function markLetterRead(n) {
  try {
    const raw = await AsyncStorage.getItem(READ_KEY);
    let read = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(read)) read = [];
    if (!read.includes(n)) {
      read.push(n);
      await AsyncStorage.setItem(READ_KEY, JSON.stringify(read));
    }
  } catch {}
}
