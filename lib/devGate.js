// Developer Tools access gate, shared between Settings (which unlocks it via
// the 7-tap + PIN flow) and the /settings-developer screen (which enforces
// it). Module-level state — not a route param, not AsyncStorage — so the
// unlock can't be forged via deep link or persisted across sessions. Without
// this, `marcus://settings-developer` typed into Safari lands directly on the
// dev screen and its premium toggle, bypassing the PIN entirely.
export const IS_DEV_BUILD = __DEV__ || process.env.EXPO_PUBLIC_IS_BETA === 'true';

let pinUnlocked = false;

export function unlockDevTools() {
  pinUnlocked = true;
}

export function devToolsUnlocked() {
  return IS_DEV_BUILD || pinUnlocked;
}
