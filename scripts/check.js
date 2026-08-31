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
// The misattributions page and the Learn hub each spell the size of the list
// out in prose, and both went on saying "Twenty" long after it reached
// twenty-five. On the one page whose whole subject is checking claims, a wrong
// number is the worst one to carry. build-attribution.js derives its own from
// the data now; the Learn hub is a hand-written list that cannot, so it is
// guarded here. Only "quotation(s)" is matched, never "quotes": the page links
// out to Sadler's "10 fake quotes" lists, whose counts are not ours.
function misattributionCount() {
  const fail = [];
  const { MISATTRIBUTIONS } = evalExports('constants/misattributions.js', ['MISATTRIBUTIONS']);
  const n = MISATTRIBUTIONS.length;

  const TEENS = { thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 };
  const TENS = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
  const wordNum = raw => {
    const w = String(raw).toLowerCase();
    if (NUM_WORDS[w] !== undefined) return NUM_WORDS[w];
    if (TEENS[w] !== undefined) return TEENS[w];
    const [t, u] = w.split('-');
    if (TENS[t] !== undefined) return TENS[t] + (u ? (NUM_WORDS[u] ?? 0) : 0);
    return Number(w);
  };

  const NUMBER = '(?:\\d+|(?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:-[a-z]+)?|[a-z]+)';
  const CLAIM = new RegExp('\\b(' + NUMBER + ')\\s+((?:[a-z]+\\s+){0,2}?)quotations?\\b', 'gi');

  const FILES = [
    'scripts/build-attribution.js',
    'scripts/build-learn.js',
    'public/misattributed-stoic-quotes.html',
    'public/learn.html',
  ];
  let checked = 0;
  for (const file of FILES) {
    for (const m of read(file).matchAll(CLAIM)) {
      const num = wordNum(m[1]);
      // "these quotations", "many quotations" — not a count.
      if (!Number.isFinite(num)) continue;
      checked++;
      if (num !== n) {
        fail.push(`${file}: claims ${m[1]} ${m[2]}quotations; constants/misattributions.js has ${n}`);
      }
    }
  }
  // A silent zero would mean the phrasing changed and this stopped watching.
  if (!checked) {
    fail.push('no count of the misattributions was found in any surface — the phrasing changed and this check is no longer watching anything');
  }

  return fail;
}

// The nightly newsletter has a reserve bank for the days the generator cannot
// produce something publishable, and on 2026-08-31 it was unreachable: a repeat
// draft threw, the catch around generateEdition called process.exit(1), and
// that walked past both the retry loop and the reserve bank underneath it. The
// guard that fires most often was the one guaranteeing no edition and no email.
// The 2026-08-29 edition had already been lost the same way and nobody noticed
// for two days, because from an inbox a failed run looks like a quiet one.
function newsletterFallback() {
  const fail = [];
  const gen = read('scripts/generate-newsletter.js');

  // Slice the CATCH, not the try. A first pass took everything up to the first
  // closing brace, which is the end of the `try`, so the arm testing for the
  // exit passed against code that still had it.
  const after = gen.slice(gen.indexOf('g = await generateEdition(dateStr);'));
  const catchStart = after.indexOf('catch');
  const catchBody = after.slice(catchStart, after.indexOf('\n    }', catchStart)).replace(/\/\/[^\n]*/g, '');
  if (/process\.exit\(/.test(catchBody)) {
    fail.push('scripts/generate-newsletter.js: a failed generation exits instead of retrying, which skips the retry loop and the reserve bank below it');
  }

  // A crash must not look like a quiet day. `.catch(console.error)` logs and
  // then falls off the end, which exits 0 and turns the workflow green.
  if (/run\(\)\.catch\(console\.error\)/.test(gen)) {
    fail.push('scripts/generate-newsletter.js: an unhandled throw exits 0, so the workflow reports success on a dead generator');
  }

  // Every path that ends with nothing staged has to say so.
  if (!/emailFailure\(/.test(gen)) {
    fail.push('scripts/generate-newsletter.js: no failure notice, so a night with no edition is silent');
  }

  const reserves = JSON.parse(read('scripts/reserve-editions.json'));
  const bank = Array.isArray(reserves) ? reserves : reserves.editions || [];
  if (bank.length < 3) {
    fail.push(`scripts/reserve-editions.json: only ${bank.length} reserve edition(s); the fallback needs a real bank to draw from`);
  }

  const wf = read('.github/workflows/newsletter.yml');
  if (!/if:\s*failure\(\)[\s\S]{0,400}notify-failure\.js/.test(wf)) {
    fail.push('.github/workflows/newsletter.yml: no failure notification step, so a run that dies before the generator is silent');
  }

  return fail;
}

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

  const allowed = new Set(DISTINCT_PAIRS.map(([a, b]) => [a, b].sort().join('\0')));
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
      if (allowed.has([live[i].key, live[j].key].sort().join('\0'))) continue;
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

// The daily reading must never serve a passage the user has already been given.
// This shipped broken: store/db.js built its history entry by hand and omitted
// quote_id, while app/read.jsx read `r.quote_id` and dropped falsy values, so
// the exclude list was always empty and the no-repeat filter did nothing at
// all. Nothing failed loudly — the reading just repeated. Checked here because
// the two halves live in different files and neither looks wrong alone.
function readingUniqueness() {
  const fail = [];

  // 1. History must persist the id the filter runs on.
  const db = read('store/db.js');
  const entry = db.slice(db.indexOf('export async function addToReadingHistory'));
  // Strip comments first: an earlier version of this check matched the word
  // quote_id inside the comment explaining why it must be there, so deleting
  // the actual field still passed.
  const body = entry
    .slice(entry.indexOf('const entry = {'), entry.indexOf('};'))
    .replace(/\/\/[^\n]*/g, '');
  if (!/\bquote_id\s*:/.test(body)) {
    fail.push('store/db.js: addToReadingHistory drops quote_id — the daily reading no-repeat filter silently does nothing');
  }

  // 2. The reader must exclude the WHOLE history, not a recent window, and
  //    must cope with rows written before quote_id was stored.
  const rd = read('app/read.jsx');
  if (/history\.slice\(0,\s*\d+\)\s*\.map\(r => r\.quote_id\)/.test(rd)) {
    fail.push('app/read.jsx: only a recent window of readings is excluded — older passages can be served again');
  }
  if (!/idForQuoteText/.test(rd)) {
    fail.push('app/read.jsx: no text fallback for history rows saved before quote_id existed');
  }

  // 3. The pool is finite, so excluding everything must still return a full
  //    slate of candidates, and must release the OLDEST seen first.
  const { STOIC_QUOTES, selectCandidates } = evalExports(
    'constants/stoicQuotes.js', ['STOIC_QUOTES', 'selectCandidates']
  );
  const ids = STOIC_QUOTES.map(q => q.id);
  const limit = 24;
  for (const seen of [0, 60, ids.length - 1, ids.length]) {
    const excludeIds = ids.slice(0, seen);
    const got = selectCandidates({ excludeIds, limit });
    if (got.length < limit) {
      fail.push(`constants/stoicQuotes.js: only ${got.length}/${limit} candidates with ${seen} seen — the reading would run dry`);
    }
    // Whatever comes back must not be something seen recently.
    const recent = new Set(excludeIds.slice(0, Math.max(0, ids.length - limit)));
    const repeats = got.filter(q => recent.has(q.id));
    if (repeats.length) {
      fail.push(`constants/stoicQuotes.js: ${repeats.length} recently-seen passages offered with ${seen} seen`);
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

  // Keeping a line must not disturb the walk. The cache is newest-first, so
  // indexing it directly moved every existing entry down a slot on each save
  // and replayed a line the user had just been shown: measured at 4 cycles
  // between two showings where a collection of 6 owes 6. Every save day in
  // the window is tried, because whether it bit depended on where in the walk
  // the save landed.
  const dayAt = n => new Date(2026, 0, 1 + n, 12, 0);
  const mkLine = (text, n) => ({ id: text, text, savedAt: dayAt(n).toISOString() });
  const kept = ['A', 'B', 'C', 'D', 'E', 'F'].map((t, i) => mkLine(t, i * 4));
  const newestFirst = [...kept].reverse();
  const walkWith = cacheFor => {
    const out = [];
    for (let d = 20; d <= 140; d++) {
      const r = resurfacedLine(cacheFor(d), dayAt(d));
      if (r) out.push({ d, text: r.text });
    }
    return out;
  };
  const undisturbed = walkWith(() => newestFirst);
  for (let saveDay = 24; saveDay <= 60; saveDay++) {
    const grown = [mkLine('NEW', saveDay), ...newestFirst];
    const after = walkWith(d => (d >= saveDay ? grown : newestFirst));

    // A line kept today cannot change which line was due last week.
    const upToSave = x => x.d < saveDay;
    if (after.filter(upToSave).map(x => x.text).join(' ')
        !== undisturbed.filter(upToSave).map(x => x.text).join(' ')) {
      fail.push(`lib/saved.js: saving on day ${saveDay} rewrote the walk that had already happened before it`);
      break;
    }

    // And nothing may come back sooner than the collection is big.
    const seq = after.map(x => x.text);
    const lastAt = {};
    let tight = null;
    for (let i = 0; i < seq.length; i++) {
      const prev = lastAt[seq[i]];
      if (prev !== undefined && i - prev < kept.length) tight = `${seq[i]} again after ${i - prev}`;
      lastAt[seq[i]] = i;
    }
    if (tight) {
      fail.push(`lib/saved.js: saving on day ${saveDay} replays a line too soon (${tight} cycles, ${kept.length} kept)`);
      break;
    }
  }

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

// Sitemap health. Two failures worth catching, both silent:
//
// A missing lastmod costs a crawl-scheduling hint, and this file shipped with
// 38 of 40 URLs lacking one while carrying changefreq and priority, which
// Google ignores. Worse is a lastmod that is not true: stamp all 40 pages with
// the newest edition date and every page claims to change daily, which teaches
// Google to disregard the field entirely. So: every URL dated, and not all of
// them dated the same day the newsletter last ran.
//
// The IndexNow key file must also match the key the submitter sends, or every
// batch is rejected and the script's caller sees nothing.
function sitemapHealth() {
  const fail = [];
  const xml = read('public/sitemap.xml');
  const blocks = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map(m => m[1]);
  if (!blocks.length) return ['public/sitemap.xml has no <url> entries'];

  const dated = [];
  for (const b of blocks) {
    const loc = (b.match(/<loc>(.*?)<\/loc>/) || [])[1];
    const lm = (b.match(/<lastmod>(.*?)<\/lastmod>/) || [])[1];
    if (!lm) fail.push(`sitemap: ${loc} has no <lastmod>`);
    else if (!/^\d{4}-\d{2}-\d{2}/.test(lm)) fail.push(`sitemap: ${loc} has a malformed <lastmod> "${lm}"`);
    else dated.push(lm.slice(0, 10));
  }

  // If every page shares one date, lastmod has become a site-wide stamp again.
  // Legitimately possible only if the whole site really was built in a day, and
  // it no longer is.
  if (dated.length > 5 && new Set(dated).size === 1) {
    fail.push(`sitemap: all ${dated.length} URLs claim lastmod ${dated[0]}; lastmod is a site-wide stamp, not a per-page date`);
  }

  // A generated page changes when either its data or its builder changes.
  // Dating it by the data alone is silently wrong for prose edits, which is
  // how /misattributed-stoic-quotes carried a lastmod three weeks older than
  // the paragraph a reader could see on it.
  const archive = read('scripts/build-archive.js');
  const GENERATED = [
    ['/library', 'constants/library.js', 'scripts/build-library.js'],
    ['/misattributed-stoic-quotes', 'constants/misattributions.js', 'scripts/build-attribution.js'],
    ['/stoics', 'constants/stoics.js', 'scripts/build-stoics.js'],
  ];
  for (const [page, data, builder] of GENERATED) {
    if (!archive.includes(builder)) {
      fail.push(`scripts/build-archive.js: ${page} is not dated from ${builder}, so editing its copy would not move its lastmod`);
    }
    if (new RegExp(`gitDate\\('${data.replace('.', '\\.')}'\\)`).test(archive)) {
      fail.push(`scripts/build-archive.js: ${page} is dated from ${data} alone — use newestDate so a builder edit counts too`);
    }
  }

  // The nightly job rebuilds the sitemap. It has to commit it as well, or the
  // rebuild is discarded and /meditations claims to be older than the editions
  // it already lists.
  const workflow = read('.github/workflows/newsletter.yml');
  const staged = (workflow.match(/git add ([^\n]*)/) || [])[1] || '';
  if (/build-archive\.js/.test(workflow) && !staged.includes('public/sitemap.xml')) {
    fail.push('.github/workflows/newsletter.yml: build-archive.js rewrites public/sitemap.xml but the publish step does not stage it, so every nightly rebuild is thrown away');
  }

  const src = read('scripts/indexnow.js');
  const key = (src.match(/const KEY = '([^']+)'/) || [])[1];
  if (!key) fail.push('scripts/indexnow.js: no KEY found');
  else {
    const p = path.join(ROOT, 'public', `${key}.txt`);
    if (!fs.existsSync(p)) fail.push(`public/${key}.txt is missing, so every IndexNow submission would be rejected`);
    else if (fs.readFileSync(p, 'utf8').trim() !== key) fail.push(`public/${key}.txt does not contain the key`);
  }

  return fail;
}

function compassCopy() {
  const fail = [];

  const { DEFAULT_COMPASS, COMPASS_QUESTIONS, COMPASS_FIELDS, isAppWrittenCompassText } =
    evalExports('constants/compassFields.js',
      ['DEFAULT_COMPASS', 'COMPASS_QUESTIONS', 'COMPASS_FIELDS', 'isAppWrittenCompassText']);

  const KEYS = ['why', 'overcome', 'aspire'];

  // 1. Every seed string the app has ever written must stay recognisable.
  //    notifications.js quotes a Compass line back on the lock screen only
  //    when the user wrote it, so a default that stops being recognised gets
  //    pushed at the user as if it were their own words. HEAD is the witness:
  //    change DEFAULT_COMPASS without appending the old text to
  //    PAST_COMPASS_DEFAULTS and this fails on the very commit that does it.
  let head = null;
  try {
    head = require('child_process')
      .execSync('git show HEAD:constants/compassFields.js', { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch (e) { /* no git, or the file is new — nothing to compare against */ }
  if (head) {
    const m = head.match(/const DEFAULT_COMPASS = (\{[\s\S]*?\n\});/);
    if (m) {
      const previous = new Function(`return ${m[1]}`)();
      for (const key of KEYS) {
        const was = previous[key];
        if (was && !isAppWrittenCompassText(was)) {
          fail.push(`constants/compassFields.js: the previous ${key} default is no longer recognised as app-written — append it to PAST_COMPASS_DEFAULTS or notifications will quote it back to existing users as their own`);
        }
      }
    }
  }

  // 2. Nothing else may hold its own copy of the seed text. store/db.js used
  //    to carry a second, divergent set inside getCompass().
  const db = read('store/db.js');
  const getCompassBody = db.slice(db.indexOf('export async function getCompass()'));
  const bodyEnd = getCompassBody.indexOf('\n}');
  const prose = getCompassBody.slice(0, bodyEnd).match(/'[^']{60,}'/g);
  if (prose) {
    fail.push(`store/db.js: getCompass() hardcodes ${prose.length} line(s) of Compass prose — it must fall back to DEFAULT_COMPASS`);
  }

  // 3. The default guard must not be an equality test against the current
  //    default, which only ever recognises the newest copy.
  const notif = read('notifications.js');
  if (/===\s*DEFAULT_COMPASS\[/.test(notif)) {
    fail.push('notifications.js: compares against DEFAULT_COMPASS by equality — older seed text stored on existing devices would pass as the user\'s own');
  }
  if (!/isAppWrittenCompassText/.test(notif)) {
    fail.push('notifications.js: no app-written check before quoting a Compass line on the lock screen');
  }

  // 4. Both surfaces must ask the same question. The onboarding walkthrough
  //    and /compass each used to phrase these independently, so a user wrote
  //    an answer to one question and was shown another one forever after.
  const compass = read('app/compass.jsx');
  for (const key of KEYS) {
    const q = COMPASS_QUESTIONS[key];
    if (!q || !/\?$/.test(q)) {
      fail.push(`constants/compassFields.js: COMPASS_QUESTIONS.${key} is missing or is not a question`);
      continue;
    }
    if (compass.includes(`"${q}"`) || compass.includes(`'${q}'`)) {
      fail.push(`app/compass.jsx: the ${key} question is written out literally — import it from COMPASS_QUESTIONS or the two screens will drift`);
    }
    if (!new RegExp(`question:\\s*COMPASS_QUESTIONS\\.${key}\\b`).test(compass)) {
      fail.push(`app/compass.jsx: the ${key} tab does not ask COMPASS_QUESTIONS.${key}`);
    }
    const field = COMPASS_FIELDS.find(f => f.key === key);
    if (!field) {
      fail.push(`constants/compassFields.js: COMPASS_FIELDS has no ${key} entry`);
    } else if (field.sub !== q) {
      fail.push(`constants/compassFields.js: the onboarding walkthrough asks "${field.sub}" for ${key} where /compass asks "${q}"`);
    }
  }

  // 5. A seed answer has to answer its question in that question's grammar.
  //    All three used to open "I want to…", which answers "what do you want?"
  //    and modelled the wrong shape for the user about to write their own.
  if (/^I want to\b/.test(DEFAULT_COMPASS.aspire || '')) {
    fail.push('constants/compassFields.js: the aspire default answers "Who am I becoming?" with a want, not a person');
  }
  if (/^I want to\b/.test(DEFAULT_COMPASS.overcome || '')) {
    fail.push('constants/compassFields.js: the overcome default answers "What pattern in myself…?" with a want, not a named pattern');
  }
  for (const key of KEYS) {
    if (!String(DEFAULT_COMPASS[key] || '').trim()) {
      fail.push(`constants/compassFields.js: DEFAULT_COMPASS.${key} is empty`);
    }
  }

  // 6. The daily reading is chosen against the Compass server-side, and the
  //    prompt lets the reflection echo its language back. Seed text reaching
  //    it means the reading is personalised against the app's own words and
  //    can quote them at the user on day one.
  const rd = read('app/read.jsx');
  if (!/isAppWrittenCompassText/.test(rd)) {
    fail.push('app/read.jsx: the reading prompt does not screen app-written Compass text out');
  }
  if (/\$\{compass[.?]*\.?(why|overcome|aspire)\}/.test(rd)) {
    fail.push('app/read.jsx: raw Compass fields are interpolated into the reading prompt — onboarding seed text would reach the model as the user\'s own');
  }

  return fail;
}

// ── runner ──────────────────────────────────────────────────────────────────

const CHECKS = [
  ['copy counts agree with the data', copyCounts],
  ['the misattribution count matches the list', misattributionCount],
  ['the newsletter can fail without going quiet', newsletterFallback],
  ['no duplicate quotes across surfaces', quoteDuplicates],
  ['stoic bookIds resolve to real books', stoicBooks],
  ['no duplicate passages in the daily pool', poolDuplicates],
  ['every require() points at a real file', assetRefs],
  ['the Stoics are in chronological order', chronology],
  ['FAQ page and schema agree', faqSchema],
  ['saved-line identity and resurfacing', savedLogic],
  ['the daily reading never repeats a passage', readingUniqueness],
  ['entries record the questions they were asked', promptSnapshot],
  ['the weekly review can read its own week', weekReadBack],
  ['sitemap dates and the IndexNow key', sitemapHealth],
  ['the Compass asks one question and seeds one answer', compassCopy],
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
