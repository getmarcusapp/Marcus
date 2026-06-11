// Privacy-first analytics via Aptabase: anonymous, no PII, no device IDs,
// no user-level tracking. Events carry feature names and coarse properties
// only — NEVER journal text, compass content, or anything the user wrote.
// This is the line that keeps "Private by design. Your journal never leaves
// your device." honest.
//
// The SDK ships a small native module, so it activates on the next EAS
// build; until then (and whenever EXPO_PUBLIC_APTABASE_KEY is unset) every
// call here is a silent no-op. Lazy require so a missing native module
// can't take down the boot path.

let aptabase = null;
let ready = false;

export function initAnalytics() {
  try {
    const key = process.env.EXPO_PUBLIC_APTABASE_KEY;
    if (!key) return;
    aptabase = require('@aptabase/react-native');
    aptabase.init(key);
    ready = true;
  } catch {
    ready = false;
  }
}

export function track(event, props) {
  if (!ready) return;
  try {
    aptabase.trackEvent(event, props);
  } catch {}
}
