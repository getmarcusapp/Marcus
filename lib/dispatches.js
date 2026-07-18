import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { getFoundationsState } from './foundations';
import { FOUNDATIONS_LETTERS } from '../constants/foundations';

// In-app announcements ("Dispatches"): a pull-based inbox for news, updates,
// and notices. Content comes DOWN from a hosted JSON feed; nothing about the
// user goes UP — read/unread state lives only on the device, so the app's
// "your data never leaves your phone" promise holds intact. This is
// deliberately NOT push: push is for practice reminders you schedule; this is
// a quiet record you visit on your own time.
//
// Publish/edit by changing public/dispatches.json in the site repo and pushing
// (Vercel serves it from getmarcus.app with a short CDN cache). Message shape:
//   { id, date, type, title, body, cta?: {label,url}, pinned?, minVersion?, maxVersion? }

const FEED_URL = 'https://www.getmarcus.app/dispatches.json';
const CACHE_KEY = 'dispatches_cache';
const READ_KEY = 'dispatches_read';
const INIT_KEY = 'dispatches_initialized';

const APP_VERSION = Constants.expoConfig?.version ?? '0.0.0';

// ── version gating ───────────────────────────────────────────────
function parseVer(v) {
  return String(v || '0').split('.').map(n => parseInt(n, 10) || 0);
}
function versionGte(a, b) {
  const A = parseVer(a), B = parseVer(b);
  for (let i = 0; i < Math.max(A.length, B.length); i++) {
    const x = A[i] || 0, y = B[i] || 0;
    if (x > y) return true;
    if (x < y) return false;
  }
  return true;
}
// A dispatch can pin itself to a version range so we never announce a feature
// to a build that doesn't have it (minVersion) or a fix to builds past it
// (maxVersion). Both optional.
function eligible(d) {
  if (!d || typeof d.id !== 'string') return false;
  if (d.minVersion && !versionGte(APP_VERSION, d.minVersion)) return false;
  if (d.maxVersion && !versionGte(d.maxVersion, APP_VERSION)) return false;
  return true;
}
function sortDispatches(list) {
  // Pinned (evergreen) first, then newest date first.
  return [...list].sort((a, b) => {
    if (!!b.pinned !== !!a.pinned) return b.pinned ? 1 : -1;
    return String(b.date || '').localeCompare(String(a.date || ''));
  });
}

// ── tiny pub/sub so the More tab dot re-reads unread the moment read state
//    changes anywhere (marking read on the inbox screen, a background sync). ──
const listeners = new Set();
export function subscribeDispatches(cb) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}
function emit() {
  listeners.forEach(cb => { try { cb(); } catch {} });
}
// Call after something that changes the inbox but isn't a dispatch read/write
// itself — notably reading a Foundations letter, which clears that letter's
// nudge. Lets the More tab dot update immediately rather than on next focus.
export function notifyDispatchesChanged() { emit(); }

// ── cache + fetch ────────────────────────────────────────────────
export async function getCachedDispatches() {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return sortDispatches((Array.isArray(list) ? list : []).filter(eligible));
  } catch { return []; }
}

export async function refreshDispatches() {
  try {
    const res = await fetch(FEED_URL, { headers: { 'Cache-Control': 'no-cache' } });
    if (!res.ok) throw new Error('status ' + res.status);
    const data = await res.json();
    const list = Array.isArray(data)
      ? data
      : (data && Array.isArray(data.dispatches) ? data.dispatches : null);
    if (!list) throw new Error('bad shape');
    const clean = list.filter(d => d && typeof d.id === 'string');
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(clean));
    await initReadBaselineIfNeeded(clean);
    emit();
    return sortDispatches(clean.filter(eligible));
  } catch {
    // Offline / server hiccup: serve whatever we cached last so the inbox is
    // never empty just because the network blinked.
    return getCachedDispatches();
  }
}

// ── read state ───────────────────────────────────────────────────
export async function getReadIds() {
  try {
    const raw = await AsyncStorage.getItem(READ_KEY);
    const ids = raw ? JSON.parse(raw) : [];
    return Array.isArray(ids) ? ids : [];
  } catch { return []; }
}

async function setReadIds(ids) {
  await AsyncStorage.setItem(READ_KEY, JSON.stringify(Array.from(new Set(ids))));
}

export async function markRead(id) {
  try {
    const ids = await getReadIds();
    if (!ids.includes(id)) {
      await setReadIds([...ids, id]);
      emit();
    }
  } catch {}
}

export async function markAllRead(idsToAdd) {
  try {
    const ids = await getReadIds();
    const merged = Array.from(new Set([...ids, ...idsToAdd]));
    if (merged.length !== ids.length) {
      await setReadIds(merged);
      emit();
    }
  } catch {}
}

// First run: seed read state so a fresh install (or an existing user updating
// into this feature) starts CAUGHT UP rather than facing a backlog badge.
// Everything currently in the feed except pinned (evergreen) items is marked
// read; anything published AFTER this moment surfaces as unread. Runs once.
async function initReadBaselineIfNeeded(list) {
  try {
    const done = await AsyncStorage.getItem(INIT_KEY);
    if (done === 'true') return;
    const seed = list.filter(d => eligible(d) && !d.pinned).map(d => d.id);
    const ids = await getReadIds();
    await setReadIds([...ids, ...seed]);
    await AsyncStorage.setItem(INIT_KEY, 'true');
  } catch {}
}

// ── local letter nudges ──────────────────────────────────────────
// The Foundations letters unlock one per day per user, silently (we don't use
// push). Each unlocked-but-unread letter surfaces here as a nudge linking
// straight to it. Unlike remote notices ("seen once"), a letter nudge is a
// to-do: it clears only when that letter is actually READ (foundations_read),
// so it keeps pointing until acted on. The letters live permanently in The
// Foundations under More, which the copy says outright.
function toISODate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
async function getLetterDispatches() {
  try {
    const { unlockedCount, read, startDate } = await getFoundationsState();
    const startMs = new Date(startDate).getTime();
    const out = [];
    for (let n = 1; n <= unlockedCount; n++) {
      if (read.includes(n)) continue;              // read → nudge cleared
      const letter = FOUNDATIONS_LETTERS[n - 1];
      if (!letter) continue;
      out.push({
        id: `letter-${n}`,
        kind: 'letter',
        // Kept for sort ordering (newest letter first); not shown for letters.
        date: Number.isFinite(startMs) ? toISODate(new Date(startMs + (n - 1) * 86400000)) : '',
        type: 'the foundations',
        title: `Letter ${letter.num}: ${letter.title}`,
        body: 'A new letter in The Foundations has unlocked. It takes about two minutes.\n\nYou can return to any letter anytime in The Foundations, under More.',
        cta: { label: 'Read the letter', route: `/foundations?letter=${n}` },
      });
    }
    return out;
  } catch { return []; }
}

// ── the inbox contents ───────────────────────────────────────────
// What the Dispatches screen shows and what the unread dot counts: unread
// remote notices (read ones are gone — ephemeral) + pending letter nudges.
export async function getActiveDispatches() {
  try {
    const [remote, read, letters] = await Promise.all([
      getCachedDispatches(),
      getReadIds(),
      getLetterDispatches(),
    ]);
    const unreadRemote = remote.filter(d => !read.includes(d.id));
    return sortDispatches([...unreadRemote, ...letters]);
  } catch { return []; }
}

// ── unread count (drives the More tab dot + the row dot) ─────────
export async function getUnreadCount() {
  try {
    return (await getActiveDispatches()).length;
  } catch { return 0; }
}
