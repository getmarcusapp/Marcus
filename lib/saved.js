import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Saved lines — the user's own commonplace book.
//
// The Stoics called these hypomnemata: personal notebooks of lines copied out
// to be reread. Meditations is one. So the point of this store is not the
// collection, it is the RETURN: app/index.jsx draws from here for the Practice
// screen quote roughly one day in three, so a line kept in March resurfaces
// unannounced in July.
//
// TWO DESIGN DECISIONS WORTH KNOWING:
//
// 1. Identity is a hash of the normalised text, not a quote id. Quotes do not
//    share a shape across the app: constants/stoicQuotes.js has 165 entries
//    with stable ids, but constants/quotes.js and the memento arrays in
//    journal.jsx / review.jsx are plain {text, author} with none. Hashing the
//    text works uniformly on every surface and needs no migration.
//
// 2. We store the CONTENT, not a pointer. If a quote is later reworded or
//    dropped from the constants, a line someone kept must not vanish from their
//    collection. It stopped being our content the moment they saved it.

const KEY = 'saved_lines';

// ── identity ────────────────────────────────────────────────────────────────

function normalise(text) {
  return String(text || '')
    .replace(/[‘’]/g, "'")   // curly single quotes
    .replace(/[“”]/g, '"')   // curly double quotes
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// FNV-1a. Deterministic, dependency-free, and plenty for de-duplicating a few
// hundred lines. Not used for anything security-sensitive.
export function lineId(text) {
  const str = normalise(text);
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

// Journal and review mementos carry a single display attribution string
// ("Marcus Aurelius · Meditations II.1") rather than separate author/work
// fields. Split on the middot so saved lines and share cards get the same
// shape as quotes from elsewhere. No separator (e.g. "The Serenity Prayer")
// means the whole string is the attribution.
export function splitAttribution(attr) {
  const raw = String(attr || '').trim();
  if (!raw) return { author: null, work: null };
  const i = raw.indexOf('·');
  if (i < 0) return { author: raw, work: null };
  return {
    author: raw.slice(0, i).trim() || null,
    work: raw.slice(i + 1).trim() || null,
  };
}

// ── store ───────────────────────────────────────────────────────────────────
// Cached in memory so the heart can render its filled/outline state
// synchronously, without every quote surface doing an async read on mount.

let cache = null;            // null until first load
let loading = null;
const listeners = new Set();

function notify() {
  listeners.forEach(fn => fn(cache || []));
}

async function load() {
  if (cache) return cache;
  if (loading) return loading;
  loading = (async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      const list = raw ? JSON.parse(raw) : [];
      cache = Array.isArray(list) ? list.filter(l => l && l.id && l.text) : [];
    } catch {
      cache = [];
    }
    loading = null;
    notify();
    return cache;
  })();
  return loading;
}

async function persist() {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(cache));
  } catch {}
  notify();
}

export async function getSavedLines() {
  return [...(await load())];
}

// Synchronous best-effort read for render. Returns false before the first load
// resolves; the subscription re-renders callers once it does.
export function isSavedSync(id) {
  return !!cache && cache.some(l => l.id === id);
}

// Returns the new saved state (true = now saved).
export async function toggleSaved({ text, author, work, from }) {
  await load();
  const id = lineId(text);
  const existing = cache.findIndex(l => l.id === id);
  if (existing >= 0) {
    cache.splice(existing, 1);
    await persist();
    return false;
  }
  cache.unshift({
    id,
    text: String(text).trim(),
    author: author || null,
    work: work || null,
    from: from || null,
    savedAt: new Date().toISOString(),
  });
  await persist();
  return true;
}

export async function removeSaved(id) {
  await load();
  const i = cache.findIndex(l => l.id === id);
  if (i >= 0) {
    cache.splice(i, 1);
    await persist();
  }
}

export function subscribeSaved(fn) {
  listeners.add(fn);
  load();
  return () => listeners.delete(fn);
}

// ── hooks ───────────────────────────────────────────────────────────────────

export function useSavedLines() {
  const [lines, setLines] = useState(cache || []);
  useEffect(() => subscribeSaved(setLines), []);
  return lines;
}

export function useIsSaved(text) {
  const id = text ? lineId(text) : null;
  const [saved, setSaved] = useState(() => (id ? isSavedSync(id) : false));
  useEffect(() => {
    if (!id) return undefined;
    return subscribeSaved(list => setSaved(list.some(l => l.id === id)));
  }, [id]);
  return saved;
}

// ── the return loop ─────────────────────────────────────────────────────────

// Below this, the collection is too thin for resurfacing to feel like anything
// other than repetition.
const MIN_TO_RESURFACE = 5;
// Roughly one day in three: often enough to notice, rare enough to stay a
// small surprise rather than becoming the norm.
const RESURFACE_EVERY = 3;

// Deterministic by local day so the Practice screen does not flicker between a
// saved line and the daily one on re-render. Returns null when it is not a
// resurfacing day, or the collection is too small.
export function resurfacedLine(lines, date = new Date()) {
  if (!lines || lines.length < MIN_TO_RESURFACE) return null;
  const localDay = Math.floor((date.getTime() - date.getTimezoneOffset() * 60000) / 86400000);
  if (localDay % RESURFACE_EVERY !== 0) return null;
  // Step through the collection rather than picking at random, so a user sees
  // the whole of it over time instead of the same few lines.
  const index = Math.floor(localDay / RESURFACE_EVERY) % lines.length;
  return lines[index];
}

// ── dev only ────────────────────────────────────────────────────────────────

// Seeds a collection large enough to cross MIN_TO_RESURFACE, so the return loop
// can be exercised without waiting to accumulate lines by hand. Backdates
// savedAt so the list reads like a collection built over weeks rather than all
// at once. Called from Settings -> Developer.
export async function seedSavedLines() {
  await load();
  const seed = [
    { text: 'You have power over your mind, not outside events. Realize this, and you will find strength.', author: 'Marcus Aurelius', work: 'Meditations' },
    { text: 'We suffer more often in imagination than in reality.', author: 'Seneca', work: 'Letters' },
    { text: 'It is not death that a man should fear, but he should fear never beginning to live.', author: 'Marcus Aurelius', work: 'Meditations' },
    { text: 'No man is free who is not master of himself.', author: 'Epictetus', work: 'Discourses' },
    { text: 'The impediment to action advances action. What stands in the way becomes the way.', author: 'Marcus Aurelius', work: 'Meditations' },
    { text: 'It is not that we have a short time to live, but that we waste much of it.', author: 'Seneca', work: 'On the Shortness of Life' },
    { text: 'Waste no more time arguing about what a good man should be. Be one.', author: 'Marcus Aurelius', work: 'Meditations' },
  ];
  let added = 0;
  seed.forEach((line, i) => {
    const id = lineId(line.text);
    if (cache.some(l => l.id === id)) return;
    const when = new Date();
    when.setDate(when.getDate() - (seed.length - i) * 4);
    cache.push({ ...line, id, from: 'dev-seed', savedAt: when.toISOString() });
    added++;
  });
  cache.sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)));
  await persist();
  return { added, total: cache.length };
}

export async function clearSavedLines() {
  await load();
  const n = cache.length;
  cache.length = 0;
  await persist();
  return n;
}
