#!/usr/bin/env node
/**
 * Repo checks.  `npm run check`
 *
 * Every check here exists because the bug it catches actually happened, and was
 * found by a throwaway script that then got deleted. This file is where those
 * stop being throwaway.
 *
 *   copy-counts       "Six guided meditations" survived in five places after a
 *                     seventh shipped; "Four Stoic prompts" described a morning
 *                     journal that had had five for months.
 *   quote-duplicates  Epictetus Enchiridion 5 appeared on two screens in two
 *                     different translations. Saved-line identity is a text
 *                     hash, so it would have stored as two entries.
 *   stoic-books       bookIds are hand-written strings joining into
 *                     constants/library.js. A typo silently renders no books.
 *   asset-refs        A require() pointing at a missing file breaks the bundle
 *                     at runtime, not at build.
 *   chronology        The Stoics list is ordered by date and the grid relies on
 *                     it. Musonius was ahead of Seneca and Cato was last.
 *   saved-logic       The resurfacing loop is date maths nobody can eyeball:
 *                     frequency, coverage, and stability within a day.
 *
 * Exits 1 if anything fails, so it can gate a commit or CI.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

// Evaluate a module's data exports without a bundler. Strips import lines and
// the export keyword, and rewrites require('x') to the literal '__ASSET__x' so
// asset paths survive as inspectable strings instead of throwing.
function evalExports(file, names) {
  let src = read(file)
    .replace(/^\s*import[^;]+;$/gm, '')
    .replace(/export\s+const\s+/g, 'const ')
    .replace(/export\s+function\s+/g, 'function ')
    .replace(/export\s+async\s+function\s+/g, 'async function ')
    .replace(/require\(\s*'([^']+)'\s*\)/g, "'__ASSET__$1'");
  src += `\n;module.exports = { ${names.join(', ')} };`;
  const m = { exports: {} };
  new Function('module', 'exports', src)(m, m.exports);
  return m.exports;
}

// .jsx files cannot be evaluated (JSX, default exports, component bodies), so
// for those the array literal is extracted and evaluated on its own.
function extractLiteral(file, name, { optional = false } = {}) {
  const src = read(file);
  const m = src.match(new RegExp(`const ${name} = ([\\[{][\\s\\S]*?\\n(?:\\]|\\}));`));
  // Optional groups return null when absent, so deliberately removing a quote
  // surface does not break the check. Only a group that is supposed to exist
  // and has gone missing should be an error.
  if (!m) {
    if (optional) return null;
    throw new Error(`could not find ${name} in ${file}`);
  }
  return new Function(`return ${m[1]}`)();
}

const NUM_WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };
const WORD_FOR = Object.fromEntries(Object.entries(NUM_WORDS).map(([w, n]) => [n, w]));
// The visible copy carries HTML entities (&middot;, &#275;) where the JSON-LD
// carries the character itself, so both sides must be decoded before comparing.
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', middot: '·', mdash: '—', ndash: '–', hellip: '…', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”' };
function decodeEntities(t) {
  return String(t)
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}

const norm = t => String(t).replace(/[“”"'‘’]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

// ── checks ──────────────────────────────────────────────────────────────────

function copyCounts() {
  const fail = [];
  const medSrc = read('lib/meditationPlayer.js');
  const block = medSrc.slice(medSrc.indexOf('export const MEDITATIONS = {'), medSrc.indexOf('export const MEDITATIONS_LIST'));
  const medCount = [...block.matchAll(/^\s{4}id: '([^']+)'/gm)].length;
  const medTitles = [...block.matchAll(/^\s{4}title: '([^']+)'/gm)].map(m => m[1]);

  const { morningPrompts, eveningPrompts } = evalExports('constants/journalPrompts.js', ['morningPrompts', 'eveningPrompts']);
  const expected = {
    meditations: medCount,
    'morning prompts': morningPrompts.length,
    'evening prompts': eveningPrompts.length,
  };

  // `sessions` is here because the howto describes the meditations as "Seven
  // short audio sessions" without using the word meditation at all — the exact
  // phrasing that let a stale count survive a review.
  const CLAIM = /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|\d+)\s+((?:[A-Za-z]+\s+){0,2}?)(meditations?|prompts?|sessions?)\b/gi;
  const FILES = ['app/howto.jsx', 'app/onboarding.jsx', 'app/meditate.jsx', 'app/imagery.jsx', 'public/index.html'];

  for (const file of FILES) {
    const src = read(file);
    for (const m of src.matchAll(CLAIM)) {
      const [full, numRaw, middle, noun] = m;
      const num = NUM_WORDS[numRaw.toLowerCase()] ?? Number(numRaw);
      if (!Number.isFinite(num)) continue;
      // "One artwork per meditation" counts artworks, not meditations.
      if (/\bper\b/i.test(middle)) continue;
      const before = src.slice(Math.max(0, m.index - 120), m.index).toLowerCase();
      let key = null;
      if (/meditation/i.test(noun)) key = 'meditations';
      else if (/session/i.test(noun)) { if (/audio|meditat|voiced/i.test(`${middle} ${before}`)) key = 'meditations'; }
      else if (/prompt/i.test(noun)) {
        const ctx = `${middle} ${before}`;
        if (ctx.includes('morning')) key = 'morning prompts';
        else if (ctx.includes('evening')) key = 'evening prompts';
      }
      if (!key) continue;
      if (num !== expected[key]) {
        fail.push(`${file}: "${full.trim()}" claims ${num} ${key}, but there are ${expected[key]} (should read "${WORD_FOR[expected[key]] ?? expected[key]} ${noun}")`);
      }
    }
  }

  // Every meditation must be enumerated where meditations are listed. Prose
  // legitimately drops the leading article, so accept either form.
  for (const file of ['app/howto.jsx', 'public/index.html']) {
    const src = read(file);
    for (const title of medTitles) {
      if (!src.includes(title) && !src.includes(title.replace(/^The\s+/i, ''))) {
        fail.push(`${file}: does not mention the meditation "${title}"`);
      }
    }
  }
  return fail;
}

function quoteDuplicates() {
  const fail = [];
  // Required groups: these back a practice surface, so their absence is a bug.
  // MORE_MEMENTOS is optional — the More hero quote was removed deliberately
  // (it framed nothing, unlike the journal epigraphs which set up the prompt
  // you are about to answer), and the check should not fail for that.
  const raw = [
    ['MORNING_MEMENTOS', extractLiteral('app/journal.jsx', 'MORNING_MEMENTOS')],
    ['EVENING_MEMENTOS', extractLiteral('app/journal.jsx', 'EVENING_MEMENTOS')],
    ['WEEKLY_MEMENTOS', extractLiteral('app/review.jsx', 'WEEKLY_MEMENTOS')],
    ['MORE_MEMENTOS', extractLiteral('app/more.jsx', 'MORE_MEMENTOS', { optional: true })],
    ['EMOTIONS', [extractLiteral('app/emotions.jsx', 'MEMENTO')]],
  ];
  const groups = raw.filter(([, list]) => Array.isArray(list) && list.length);

  const byText = new Map(), byAttr = new Map();
  for (const [name, list] of groups) {
    for (const q of list) {
      const kt = norm(q.text), ka = norm(q.attr);
      if (byText.has(kt)) fail.push(`${name}: same TEXT as ${byText.get(kt)} — "${String(q.text).slice(0, 50)}…"`);
      else byText.set(kt, name);
      // Attribution matters independently: one passage in two translations has
      // different text but the same source, and the text hash cannot see it.
      if (byAttr.has(ka)) fail.push(`${name}: same SOURCE as ${byAttr.get(ka)} — ${q.attr}`);
      else byAttr.set(ka, name);
    }
  }
  return fail;
}

function stoicBooks() {
  const fail = [];
  const { STOICS } = evalExports('constants/stoics.js', ['STOICS']);
  const { READING_LIST } = evalExports('constants/library.js', ['READING_LIST']);
  const ids = new Set(READING_LIST.map(b => b.id));
  for (const s of STOICS) {
    for (const id of s.bookIds) {
      if (!ids.has(id)) fail.push(`constants/stoics.js: ${s.name} references book "${id}", which is not in READING_LIST`);
    }
  }
  return fail;
}

function assetRefs() {
  const fail = [];
  for (const file of ['constants/stoics.js', 'lib/meditationPlayer.js']) {
    const src = read(file);
    for (const m of src.matchAll(/require\(\s*'(\.\.\/[^']+)'\s*\)/g)) {
      const rel = m[1].replace(/^\.\.\//, '');
      if (!fs.existsSync(path.join(ROOT, rel))) {
        fail.push(`${file}: require('${m[1]}') — file does not exist`);
      }
    }
  }
  return fail;
}

function chronology() {
  const fail = [];
  const { STOICS } = evalExports('constants/stoics.js', ['STOICS']);
  // Start-year with sign. "c. 4 BC–65 AD" is -4; "c. 334–262 BC" is -334 (the
  // trailing BC governs both); "c. 3rd century AD" has no year at all.
  const startYear = dates => {
    const cent = dates.match(/(\d+)(?:st|nd|rd|th)\s+century/i);
    if (cent) return (Number(cent[1]) - 1) * 100 + 50;
    const nums = [...dates.matchAll(/\d+/g)];
    if (!nums.length) return null;
    const first = Number(nums[0][0]);
    const after = dates.slice(nums[0].index);
    const bcAt = after.search(/BC/i), adAt = after.search(/AD/i);
    const isBC = bcAt >= 0 && (adAt < 0 || bcAt < adAt);
    return isBC ? -first : first;
  };
  const sections = [...new Set(STOICS.map(s => s.section))];
  for (const section of sections) {
    const items = STOICS.filter(s => s.section === section);
    let prev = null, prevName = null;
    for (const s of items) {
      const y = startYear(s.dates);
      if (y === null) { prev = null; continue; }
      if (prev !== null && y < prev) {
        fail.push(`constants/stoics.js [${section}]: ${s.name} (${s.dates}) comes after ${prevName}, but is earlier`);
      }
      prev = y; prevName = s.name;
    }
  }
  return fail;
}

function faqSchema() {
  const fail = [];
  const src = read('public/index.html');

  // The FAQ exists twice: as visible HTML, and inside the FAQPage JSON-LD added
  // during the SEO pass. Editing one and not the other leaves Google reading a
  // different answer than visitors see, which is exactly the mismatch
  // structured data gets penalised for — and nothing about a build would ever
  // complain.
  const blocks = [...src.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  let faqPage = null;
  for (const b of blocks) {
    let parsed;
    try {
      parsed = JSON.parse(b[1]);
    } catch (e) {
      fail.push(`public/index.html: JSON-LD block does not parse — ${e.message}`);
      continue;
    }
    const nodes = parsed['@graph'] || [parsed];
    for (const n of nodes) if (n['@type'] === 'FAQPage') faqPage = n;
  }
  if (!faqPage) {
    fail.push('public/index.html: no FAQPage found in the JSON-LD');
    return fail;
  }

  const strip = t => decodeEntities(String(t).replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
  const schema = new Map(
    (faqPage.mainEntity || []).map(q => [strip(q.name), strip(q.acceptedAnswer && q.acceptedAnswer.text)]),
  );

  const visible = new Map();
  const re = /class="faq-question"[^>]*>([\s\S]*?)<\/div>\s*<div class="faq-answer">([\s\S]*?)<\/div>/g;
  for (const m of src.matchAll(re)) visible.set(strip(m[1]), strip(m[2]));

  if (!visible.size) {
    fail.push('public/index.html: could not read any visible FAQ pairs — the markup shape changed, so this check is blind');
    return fail;
  }
  if (visible.size !== schema.size) {
    fail.push(`public/index.html: ${visible.size} visible FAQ entries but ${schema.size} in the FAQPage schema`);
  }

  for (const [q, a] of visible) {
    if (!schema.has(q)) {
      fail.push(`public/index.html: FAQ "${q.slice(0, 55)}…" is on the page but missing from the schema`);
    } else if (schema.get(q) !== a) {
      fail.push(`public/index.html: FAQ answer differs between the page and the schema — "${q.slice(0, 55)}…"`);
    }
  }
  for (const q of schema.keys()) {
    if (!visible.has(q)) {
      fail.push(`public/index.html: FAQ "${q.slice(0, 55)}…" is in the schema but not on the page`);
    }
  }
  return fail;
}

function savedLogic() {
  const fail = [];
  const { lineId, resurfacedLine } = evalExports('lib/saved.js', ['lineId', 'resurfacedLine']);

  // Identity must survive whitespace and curly quotes, or the same line saved
  // from two screens stores twice.
  const a = lineId('The impediment to action advances action.');
  const b = lineId('  The  impediment to action advances action. ');
  const c = lineId('“The impediment to action advances action.”');
  if (a !== b) fail.push('lib/saved.js: lineId is not whitespace-insensitive');
  if (a !== c) fail.push('lib/saved.js: lineId is not quote-style-insensitive');

  // Below the threshold it must never fire, or a thin collection just repeats.
  const few = Array.from({ length: 4 }, (_, i) => ({ text: `line${i}` }));
  let hits = 0;
  for (let d = 0; d < 30; d++) if (resurfacedLine(few, new Date(2026, 7, 1 + d))) hits++;
  if (hits) fail.push(`lib/saved.js: resurfaced ${hits} times with only 4 saved lines (should never)`);

  // Frequency, coverage, and stability within a day.
  const many = Array.from({ length: 6 }, (_, i) => ({ text: `line${i}` }));
  const seen = new Set(); hits = 0;
  for (let d = 0; d < 30; d++) {
    const r = resurfacedLine(many, new Date(2026, 7, 1 + d));
    if (r) { hits++; seen.add(r.text); }
  }
  if (hits < 8 || hits > 12) fail.push(`lib/saved.js: resurfaced ${hits}/30 days, expected about 10 (one in three)`);
  if (seen.size !== many.length) fail.push(`lib/saved.js: only ${seen.size} of ${many.length} lines appeared in 30 days — the walk is not covering the collection`);

  const morning = resurfacedLine(many, new Date(2026, 7, 3, 9, 0));
  const evening = resurfacedLine(many, new Date(2026, 7, 3, 21, 30));
  const same = (morning && evening && morning.text === evening.text) || (!morning && !evening);
  if (!same) fail.push('lib/saved.js: resurfaced line differs within one day — the Practice screen would flicker');

  return fail;
}

// ── runner ──────────────────────────────────────────────────────────────────

const CHECKS = [
  ['copy counts agree with the data', copyCounts],
  ['no duplicate quotes across surfaces', quoteDuplicates],
  ['stoic bookIds resolve to real books', stoicBooks],
  ['every require() points at a real file', assetRefs],
  ['the Stoics are in chronological order', chronology],
  ['FAQ page and schema agree', faqSchema],
  ['saved-line identity and resurfacing', savedLogic],
];

let total = 0;
for (const [name, run] of CHECKS) {
  let failures;
  try {
    failures = run();
  } catch (e) {
    failures = [`check threw: ${e.message}`];
  }
  total += failures.length;
  console.log(`${failures.length ? '✗' : '✓'} ${name}`);
  for (const f of failures) console.log(`    ${f}`);
}

console.log('');
if (total) {
  console.error(`${total} problem${total === 1 ? '' : 's'} found.`);
  process.exit(1);
}
console.log('All checks passed.');
