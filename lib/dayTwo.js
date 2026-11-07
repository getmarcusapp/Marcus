import AsyncStorage from '@react-native-async-storage/async-storage';
import { freeDayState, freeDayDate } from './useEntitlement';
import { hasEverPurchased } from '../store/purchases';

// THE DAY-TWO MOMENT. A new user meets the paywall before doing anything,
// declines, and takes the free day. Until 1.5.3 that day simply ended: the
// next open found locked fields and a small banner, and almost nobody started
// a trial (2 of 34 new users in the 28 days to 7 Nov 2026). The best moment to
// ask is after the practice has been felt, so the first open after the free
// day presents the paywall once, acknowledging what they did with it.

const SHOWN_KEY = 'day_two_paywall_shown';

// True exactly once: the free day is over and this moment hasn't been shown.
// Marks it shown, so a dismissal is final.
export async function claimDayTwoPaywall() {
  try {
    if ((await freeDayState()) !== 'used') return false;
    if (await AsyncStorage.getItem(SHOWN_KEY)) return false;
    // Never to a subscriber, past or present, and never on a failed check:
    // offline, a paying customer can read as having no access.
    if ((await hasEverPurchased()) !== false) return false;
    await AsyncStorage.setItem(SHOWN_KEY, '1');
    return true;
  } catch { return false; }
}

// What the person did on their free day, for the paywall's first line.
// { sealed: bool, journals: number } or null when there is no free day.
export async function dayOneRecap() {
  try {
    const day = await freeDayDate();
    if (!day) return null;
    const raw = await AsyncStorage.getItem('journals');
    const journals = (raw ? JSON.parse(raw) : [])
      .filter(j => new Date(j.date).toDateString() === day).length;
    const streakRaw = await AsyncStorage.getItem('streak');
    const sealedOn = await AsyncStorage.getItem('last_sealed_date');
    const sealed = sealedOn === day || (!!streakRaw && (JSON.parse(streakRaw).sealedDays || 0) >= 1);
    return { sealed, journals };
  } catch { return null; }
}
