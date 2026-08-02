// Developer Tools access gate, shared between Settings (which unlocks it via
// the 7-tap + PIN flow) and the /settings-developer screen (which enforces
// it). Module-level state — not a route param, not AsyncStorage — so the
// unlock can't be forged via deep link or persisted across sessions. Without
// this, `marcus://settings-developer` typed into Safari lands directly on the
// dev screen and its premium toggle, bypassing the PIN entirely.
export const IS_DEV_BUILD = __DEV__ || process.env.EXPO_PUBLIC_IS_BETA === 'true';

// The PIN comes from the environment and is never written in the source. It
// used to be a literal in app/settings.jsx, which meant it shipped inside the
// App Store bundle: `strings` on the IPA hands it to anyone who looks, and the
// dev screen it guards includes a premium toggle. A secret in a client bundle
// is not a secret. Production sets no value, so there is no unlock path in the
// shipped app at all — not a hidden one, an absent one. Local and TestFlight
// builds get it from .env.local / an EAS secret.
const DEV_PIN = process.env.EXPO_PUBLIC_DEV_PIN || '';
export const DEV_PIN_AVAILABLE = DEV_PIN.length > 0;

let pinUnlocked = false;

// Returns whether the PIN was accepted, so the caller does not have to know it.
export function unlockDevTools(pin) {
  if (!DEV_PIN_AVAILABLE || String(pin) !== DEV_PIN) return false;
  pinUnlocked = true;
  return true;
}

export function devToolsUnlocked() {
  return IS_DEV_BUILD || pinUnlocked;
}
