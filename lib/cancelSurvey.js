import AsyncStorage from '@react-native-async-storage/async-storage';
import { getEntitlementRecord, setCustomerAttributes } from '../store/purchases';
import { track } from './analytics';

// ONE QUESTION, ONCE, AFTER SOMEONE CANCELS. By 24 Nov 2026 fourteen people
// had started a trial and six had cancelled without paying, and we had no idea
// why. Apple owns the cancel screen and passes along no reason, so the only
// place to ask is here: the first time the app is opened after renewal was
// turned off. Shown once, skippable, and never an offer or a plea to stay.
//
// The answer is stored as RevenueCat customer attributes. That needs no server
// of ours, and it lands next to the same anonymous customer's trial history,
// which is what makes one answer worth reading (scripts/cancel-reasons.js).

const SHOWN_KEY = 'cancel_survey_shown';
const NOTE_MAX = 400; // RevenueCat caps an attribute value at 500 characters

// The ids are what gets stored and counted. Never rename one: an answer
// already recorded would stop matching. Add new ones at the end, above Other.
export const CANCEL_REASONS = [
  { id: 'price', label: 'It costs more than I want to pay' },
  { id: 'usage', label: 'I wasn’t using it enough' },
  { id: 'expectation', label: 'It wasn’t what I expected' },
  { id: 'missing', label: 'Something was missing or didn’t work' },
  { id: 'trying', label: 'I was only trying it out' },
  { id: 'other', label: 'Something else' },
];

// Did this person cancel? Reads RevenueCat's record of the entitlement
// (entitlements.all, so it still answers after access has ended).
// Returns null, or { stage: 'trial' | 'paid', active, until }.
export function cancelState(ent) {
  if (!ent) return null;
  // Lifetime: nothing to cancel.
  if (!ent.expirationDate) return null;
  // A failed card is not a decision. Asking "why did you cancel?" of someone
  // who wanted to stay is the wrong question.
  if (ent.billingIssueDetectedAt) return null;
  // Apple's own record that renewal was switched off. Cleared if they
  // resubscribe, so a returning subscriber is never asked.
  if (!ent.unsubscribeDetectedAt) return null;
  if (ent.isActive && ent.willRenew) return null;
  return {
    stage: ent.periodType === 'TRIAL' ? 'trial' : 'paid',
    active: !!ent.isActive,
    until: ent.expirationDate,
  };
}

// The cancel state exactly once, then null forever: a dismissal is final.
// Null on any failure, including offline, so nobody is asked by mistake.
export async function claimCancelSurvey() {
  try {
    if (await AsyncStorage.getItem(SHOWN_KEY)) return null;
    const state = cancelState(await getEntitlementRecord());
    if (!state) return null;
    await AsyncStorage.setItem(SHOWN_KEY, '1');
    return state;
  } catch { return null; }
}

// Records the answer. The note is the only thing a person types that ever
// leaves the device, which is why the screen says so beside the field, and
// why it goes to RevenueCat only: analytics gets the reason id and nothing
// they wrote (lib/analytics.js).
export async function sendCancelReason({ reason, note, stage, version }) {
  if (!CANCEL_REASONS.some(r => r.id === reason)) return false;
  const ok = await setCustomerAttributes({
    cancel_reason: reason,
    cancel_note: String(note || '').trim().slice(0, NOTE_MAX),
    cancel_stage: stage === 'paid' ? 'paid' : 'trial',
    cancel_at: new Date().toISOString(),
    cancel_version: String(version || ''),
  });
  track('cancel_reason', { reason, stage: stage === 'paid' ? 'paid' : 'trial' });
  return ok;
}

// Developer Tools: let the question be seen again on this device.
export async function devResetCancelSurvey() {
  await AsyncStorage.removeItem(SHOWN_KEY);
}
