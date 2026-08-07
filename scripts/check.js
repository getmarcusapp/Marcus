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
 *   pool-duplicates   The 374-passage daily reading pool had never been looked
 *                     at. 46 of its entries were an exact repeat, a second
 *                     translation of a passage already there, or a truncated
 *                     twin of a fuller line, so the "random" daily reading
 *                     repeated itself far more often than the count implied.
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

// Word-bigram Dice coefficient. Catches what a character-diff misses: a
// truncated twin ("Very little is needed to make a happy life." beside the
// full sentence) scores low on character overlap because the lengths differ,
// but high here because every bigram of the short one is in the long one.
function similarity(a, b) {
  const grams = s => {
    const w = s.split(' ');
    return new Set(w.slice(0, -1).map((x, i) => `${x} ${w[i + 1]}`));
  };
  const A = grams(a), B = grams(b);
  if (!A.size || !B.size) return a === b ? 1 : 0;
  let shared = 0;
  for (const g of A) if (B.has(g)) shared++;
  return (2 * shared) / (A.size + B.size);
}

// norm() keeps punctuation, which is right for exact-match work but wrong here:
// two translations differ in commas and dashes long before they differ in words.
const passageKey = t => norm(t).replace(/\\n/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();

// Two entries may legitimately share a ref when a section holds more than one
// distinct aphorism. Listed by ref, with the count that is correct for it.
const SHARED_REFS = { 'Seneca|Letters 1.3': 2, 'Epictetus|Enchiridion 1': 2 };

// Pairs that score above the threshold but are genuinely different passages.
// Each is here because it was read and judged, not because it was noisy.
const DISTINCT_PAIRS = [
  ['if you wish to be loved love', 'if you wish to be beautiful practice beautiful deeds'],
  ['wonder is the beginning of wisdom', 'knowing yourself is the beginning of all wisdom'],
  ['the goal of life is living in agreement with nature', 'the goal of life is to live in accordance with reason'],
];

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
  // `movements` is here because the journal archive's empty state counted the
  // evening in movements rather than prompts, which is how it went on claiming
  // four a full release after the evening became five.
  const CLAIM = /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|\d+)\s+((?:[A-Za-z]+\s+){0,2}?)(meditations?|prompts?|sessions?|movements?)\b/gi;
  const FILES = ['app/howto.jsx', 'app/onboarding.jsx', 'app/meditate.jsx', 'app/imagery.jsx', 'app/journal-history.jsx', 'app/review.jsx', 'public/index.html'];

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
      else if (/prompt|movement/i.test(noun)) {
        // Both nouns need a morning/evening anchor before they count, which
        // also keeps IV · Body's "sleep, movement, food" out of the tally.
        //
        // Look FORWARD first. "Five movements each evening" puts the anchor
        // after the count, and reading only backwards found the neighbouring
        // morning string instead — or, when the window was too short to reach
        // it, gave up and passed the claim silently.
        const ahead = `${middle} ${src.slice(m.index, m.index + 80)}`.toLowerCase();
        const ctx = /morning|evening/.test(ahead) ? ahead : `${middle} ${before}`;
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

// The daily reading pool was never checked, and it had drifted badly: 46 of
// its 374 passages were the same text twice, or the same passage in a second
// translation, or a truncated twin of a fuller line. Nothing surfaced it
// because quoteDuplicates() only ever compared the small hand-picked memento
// groups against each other and never opened this file.
function poolDuplicates() {
  const fail = [];
  const q = evalExports('constants/quotes.js', ['morningQuotes', 'mementoMoriQuotes']);

  // Both pools app/index.jsx reads: morningQuotes backs the daily reading,
  // mementoMoriQuotes the sealed-day screen. There is deliberately no third
  // array — a dead eveningQuotes sat here unrendered for months, and text
  // nothing displays drifts out of sync without anyone noticing.
  const live = [];
  for (const name of ['morningQuotes', 'mementoMoriQuotes']) {
    for (const entry of q[name] || []) live.push({ pool: name, text: entry.text, author: entry.author, ref: entry.ref, key: passageKey(entry.text) });
  }

  const allowed = new Set(DISTINCT_PAIRS.map(([a, b]) => [a, b].sort().join(' ')));
  const seen = new Map();
  for (const item of live) {
    if (seen.has(item.key)) {
      fail.push(`${item.pool}: identical to ${seen.get(item.key)} — "${item.text.slice(0, 52)}…"`);
    } else {
      seen.set(item.key, item.pool);
    }
  }
  for (let i = 0; i < live.length; i++) {
    for (let j = i + 1; j < live.length; j++) {
      if (live[i].key === live[j].key) continue;
      if (similarity(live[i].key, live[j].key) <= 0.40) continue;
      if (allowed.has([live[i].key, live[j].key].sort().join(' '))) continue;
      fail.push(
        `near-duplicate passage (${live[i].pool}/${live[j].pool}):\n        "${live[i].text.slice(0, 62)}"\n        "${live[j].text.slice(0, 62)}"`
      );
    }
  }

  // Citation-level duplicates. This is the only check that sees the same
  // passage in two genuinely different translations — wording comparison
  // scores those near zero, which is how three renderings of Letters 71.3 and
  // two of On the Shortness of Life 1.3 survived every earlier pass. Only
  // entries carrying a ref participate; an uncited entry is not an error, it
  // is a passage nobody has pinned down yet.
  const byRef = new Map();
  for (const item of live) {
    if (!item.ref) continue;
    const k = `${item.author}|${item.ref}`;
    byRef.set(k, (byRef.get(k) || 0) + 1);
  }
  for (const [k, n] of byRef) {
    const allow = SHARED_REFS[k] || 1;
    if (n > allow) fail.push(`${k.replace('|', ' · ')}: ${n} entries cite this passage, expected ${allow}`);
  }

  // The emotions screen owns Enchiridion 5 permanently. A copy in the rotating
  // pool means one passage with two homes, which is what saved-line hashing
  // stores as two entries.
  const emotions = extractLiteral('app/emotions.jsx', 'MEMENTO', { optional: true });
  if (emotions) {
    const k = passageKey(emotions.text);
    for (const item of live) {
      if (item.key === k || similarity(item.key, k) > 0.40) {
        fail.push(`${item.pool} repeats the emotions screen's passage — "${item.text.slice(0, 52)}…"`);
      }
    }
  }
  return fail;
}

function quoteDuplicates() {
  const fail = [];
  // Every rotating group is optional now. Quote surfaces have been removed
  // deliberately — the More hero, then the journal and weekly-review epigraphs —
  // so an absent array is a product decision, not a bug. The check's job is to
  // catch DUPLICATES among whatever surfaces exist, not to insist a particular
  // set of them does. EMOTIONS is a single object rather than an array.
  const raw = [
    ['MORNING_MEMENTOS', extractLiteral('app/journal.jsx', 'MORNING_MEMENTOS', { optional: true })],
    ['EVENING_MEMENTOS', extractLiteral('app/journal.jsx', 'EVENING_MEMENTOS', { optional: true })],
    ['WEEKLY_MEMENTOS', extractLiteral('app/review.jsx', 'WEEKLY_MEMENTOS', { optional: true })],
    ['MORE_MEMENTOS', extractLiteral('app/more.jsx', 'MORE_MEMENTOS', { optional: true })],
    ['EMOTIONS', [extractLiteral('app/emotions.jsx', 'MEMENTO', { optional: true })].filter(Boolean)],
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

// A saved entry must record the questions it was asked. If any read surface
// goes back to looking a past answer's prompt up live by index, rewording a
// prompt silently re-labels every entry already written — an answer sitting
// beneath a question its author never saw. See the WHAT WAS ASKED note in
// constants/journalPrompts.
function promptSnapshot() {
  const fail = [];
  const { morningPrompts, eveningPromptsInOrder, snapshotPrompts, askedPrompt } =
    evalExports('constants/journalPrompts.js',
      ['morningPrompts', 'eveningPromptsInOrder', 'snapshotPrompts', 'askedPrompt']);

  // Both wizard shapes: morning keys by array index, evening carries the
  // storage key through a display reorder. A prompt reaching the snapshot
  // without an answerKey would be dropped, and its question lost.
  const keyed = morningPrompts.map((p, i) => ({ ...p, answerKey: i }));
  for (const [label, set] of [['morning', keyed], ['evening', eveningPromptsInOrder]]) {
    const qs = snapshotPrompts(set);
    if (Object.keys(qs).length !== set.length) {
      fail.push(`snapshotPrompts covered ${Object.keys(qs).length} of ${set.length} ${label} prompts`);
    }
    for (const p of set) {
      if (qs[p.answerKey]?.num !== p.num || qs[p.answerKey]?.q !== p.q) {
        fail.push(`snapshotPrompts lost the label or question for ${label} ${p.num}`);
      }
    }
  }

  const live = keyed[1];
  const withSnap = { qs: { 1: { num: 'II · Old', q: 'The old question?' } } };
  const asked = askedPrompt(withSnap, live, 1);
  if (asked.q !== 'The old question?' || asked.num !== 'II · Old') {
    fail.push('askedPrompt ignored the snapshot and returned the live prompt');
  }
  if (asked.hint !== live.hint) {
    fail.push('askedPrompt froze the hint — teaching material must stay current');
  }
  if (askedPrompt({}, live, 1)?.q !== live.q) {
    fail.push('askedPrompt did not fall back to the live prompt for a pre-snapshot entry');
  }
  if (askedPrompt(withSnap, undefined, 1)?.q !== 'The old question?') {
    fail.push('askedPrompt dropped the snapshot when the live prompt was gone');
  }

  // Reviews key their answers by field name rather than index, but carry the
  // same record and the same hazard.
  const { reviewPrompts } = evalExports('constants/reviewPrompts.js', ['reviewPrompts']);
  const rqs = snapshotPrompts(reviewPrompts.map(p => ({ ...p, answerKey: p.key })));
  for (const p of reviewPrompts) {
    if (rqs[p.key]?.q !== p.q) fail.push(`snapshotPrompts lost the question for review ${p.key}`);
  }

  // The weekly review kept a second copy of its prompts in the archive editor
  // and the two drifted, asking different questions for one stored answer.
  // Neither file may hard-code a question again.
  for (const file of ['app/review.jsx', 'components/ReviewEntryEditor.jsx']) {
    const src = read(file);
    for (const p of reviewPrompts) {
      if (src.includes(`>${p.q}<`)) fail.push(`${file}: hard-codes the ${p.key} question instead of reading constants/reviewPrompts`);
    }
  }

  // The surfaces that write or read the record.
  const wiring = [
    ['app/journal.jsx', /qs:\s*snapshotPrompts\(/, 'saves without snapshotting the questions'],
    ['app/journal-history.jsx', /askedPrompt\(entry,/, 'renders past labels live instead of from the snapshot'],
    ['components/JournalEntryEditor.jsx', /askedPrompt\(entry,/, 'edits under live prompts instead of the snapshot'],
    ['app/review.jsx', /qs:\s*snapshotPrompts\(/, 'seals a review without snapshotting the questions'],
    ['components/ReviewEntryEditor.jsx', /askedPrompt\(entry,/, 'edits reviews under live prompts instead of the snapshot'],
  ];
  for (const [file, re, why] of wiring) {
    if (!re.test(read(file))) fail.push(`${file}: ${why}`);
  }

  return fail;
}

// III · Pattern asks what patterns you are noticing, which is the one question
// in the app that cannot be answered from memory. The review used to load the
// week's journals and keep only uniqueDaysJournaled, throwing the words away,
// so the prompt was asking for recall and calling it reflection. If the entries
// stop reaching the screen the prompt quietly becomes dishonest again.
function weekReadBack() {
  const fail = [];
  const src = read('app/review.jsx');

  if (!/setWeekEntries\(weekJournals\)/.test(src)) {
    fail.push('app/review.jsx: the week\'s journals are loaded but never kept');
  }
  const rendered = [...src.matchAll(/<WeekInYourWords\b/g)].length;
  if (rendered < 2) {
    fail.push(`app/review.jsx: renders the read-back ${rendered} time(s); expected the landing and the Pattern step`);
  }
  if (!/isPattern && <WeekInYourWords/.test(src)) {
    fail.push('app/review.jsx: the read-back is not on the Pattern step, which is the one that needs it');
  }

  // The hint points at the panel. If the panel moved, the hint is a lie.
  const { reviewPromptByKey } = evalExports('constants/reviewPrompts.js', ['reviewPromptByKey']);
  const hint = reviewPromptByKey.challenges?.hint || '';
  if (!/week in your words/i.test(hint)) {
    fail.push('constants/reviewPrompts.js: III · Pattern no longer tells the user to read the week back');
  }

  return fail;
}

// ── runner ──────────────────────────────────────────────────────────────────

const CHECKS = [
  ['copy counts agree with the data', copyCounts],
  ['no duplicate quotes across surfaces', quoteDuplicates],
  ['stoic bookIds resolve to real books', stoicBooks],
  ['no duplicate passages in the daily pool', poolDuplicates],
  ['every require() points at a real file', assetRefs],
  ['the Stoics are in chronological order', chronology],
  ['FAQ page and schema agree', faqSchema],
  ['saved-line identity and resurfacing', savedLogic],
  ['entries record the questions they were asked', promptSnapshot],
  ['the weekly review can read its own week', weekReadBack],
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
