#!/usr/bin/env node
/**
 * Copy-consistency check.
 *
 * Catches a defect class that has bitten twice: prose asserting a fact the data
 * contradicts. "Six guided meditations" survived in five places after a seventh
 * shipped, and "Four Stoic prompts" described a morning journal that has had
 * five for months.
 *
 * It derives the real counts from the source of truth (lib/meditationPlayer.js,
 * constants/journalPrompts.js) and then fails if any user-facing copy in the app
 * or on the marketing site disagrees, or if a meditation is missing from the
 * places that enumerate them.
 *
 * Run: node scripts/check-copy.js   (exit 1 on any mismatch)
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

const NUM_WORDS = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
};
const WORD_FOR = Object.fromEntries(Object.entries(NUM_WORDS).map(([w, n]) => [n, w]));

const failures = [];
const fail = (file, msg) => failures.push(`${file}: ${msg}`);

// ── Source of truth ─────────────────────────────────────────────────────────

// meditationPlayer.js can't be required (it uses require() for mp3/jpg assets),
// so read the MEDITATIONS object literal directly.
const medSrc = read('lib/meditationPlayer.js');
const medBlock = medSrc.slice(
  medSrc.indexOf('export const MEDITATIONS = {'),
  medSrc.indexOf('export const MEDITATIONS_LIST'),
);
const medIds = [...medBlock.matchAll(/^\s{4}id: '([^']+)'/gm)].map(m => m[1]);
const medTitles = [...medBlock.matchAll(/^\s{4}title: '([^']+)'/gm)].map(m => m[1]);

// journalPrompts.js is pure data — strip the ESM exports and evaluate it.
const promptSrc = read('constants/journalPrompts.js').replace(/export const /g, 'const ');
const promptMod = {};
new Function('module', 'exports', `${promptSrc}
  module.exports = { morningPrompts, eveningPrompts };`)(promptMod, promptMod);
const { morningPrompts, eveningPrompts } = promptMod.exports ?? promptMod;

const EXPECTED = {
  meditations: medIds.length,
  'morning prompts': morningPrompts.length,
  'evening prompts': eveningPrompts.length,
};

if (medIds.length !== medTitles.length) {
  fail('lib/meditationPlayer.js', `parsed ${medIds.length} ids but ${medTitles.length} titles — check the regex`);
}

// ── 1. Numeric claims must match the data ───────────────────────────────────

// Files whose prose makes countable claims. Add to this list, don't special-case.
const COPY_FILES = [
  'app/howto.jsx',
  'app/onboarding.jsx',
  'app/meditate.jsx',
  'app/imagery.jsx',
  'public/index.html',
];

// A number word followed (within a couple of words) by a countable noun.
// `sessions` is included because the howto describes the meditations as
// "Seven short audio sessions" without using the word meditation at all —
// exactly the phrasing that let a stale count survive.
const CLAIM = /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|\d+)\s+((?:[A-Za-z]+\s+){0,2}?)(meditations?|prompts?|sessions?)\b/gi;

for (const file of COPY_FILES) {
  const src = read(file);
  for (const m of src.matchAll(CLAIM)) {
    const [full, numRaw, middle, noun] = m;
    const num = NUM_WORDS[numRaw.toLowerCase()] ?? Number(numRaw);
    if (!Number.isFinite(num)) continue;
    // "One artwork per meditation" counts artworks, not meditations. A `per`
    // between the number and the noun means it's a ratio, not a total.
    if (/\bper\b/i.test(middle)) continue;

    const before = src.slice(Math.max(0, m.index - 120), m.index).toLowerCase();
    let key = null;
    if (/meditation/i.test(noun)) key = 'meditations';
    // "sessions" only counts meditations when the surrounding copy says so,
    // so unrelated uses of the word don't get judged.
    else if (/session/i.test(noun)) {
      if (/audio|meditat|voiced/i.test(`${middle} ${before}`)) key = 'meditations';
    }
    else if (/prompt/i.test(noun)) {
      // Only judge prompt counts that name which journal they belong to.
      const ctx = `${middle} ${before}`;
      if (ctx.includes('morning')) key = 'morning prompts';
      else if (ctx.includes('evening')) key = 'evening prompts';
    }
    if (!key) continue;

    const want = EXPECTED[key];
    if (num !== want) {
      fail(file, `"${full.trim()}" claims ${num} ${key}, but there are ${want} (should read "${WORD_FOR[want] ?? want} ${noun}")`);
    }
  }
}

// ── 2. Every meditation must be enumerated where meditations are listed ─────

const ENUMERATING_FILES = ['app/howto.jsx', 'public/index.html'];
for (const file of ENUMERATING_FILES) {
  const src = read(file);
  for (const title of medTitles) {
    // Prose legitimately drops the leading article ("View From Above:" in the
    // howto list vs the catalog's "The View From Above"), so accept either.
    const short = title.replace(/^The\s+/i, '');
    if (!src.includes(title) && !src.includes(short)) {
      fail(file, `does not mention the meditation "${title}"`);
    }
  }
}

// ── Report ──────────────────────────────────────────────────────────────────

console.log('Source of truth:');
console.log(`  meditations      ${EXPECTED.meditations}`);
console.log(`  morning prompts  ${EXPECTED['morning prompts']}`);
console.log(`  evening prompts  ${EXPECTED['evening prompts']}`);
console.log('');

if (failures.length) {
  console.error(`✗ ${failures.length} copy inconsistenc${failures.length === 1 ? 'y' : 'ies'}:\n`);
  for (const f of failures) console.error(`  ${f}`);
  console.error('');
  process.exit(1);
}
console.log('✓ app + site copy agrees with the data');
