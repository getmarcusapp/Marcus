#!/usr/bin/env node
/**
 * Word-level audit of the app's quote lists (constants/quotes.js) against
 * public-domain translations.
 *
 *   node scripts/audit-quotes.js            report to stdout
 *   node scripts/audit-quotes.js --json     machine-readable
 *
 * The August 2026 audit checked WHO said each line. It did not check that the
 * words in quotation marks are words a translator actually wrote, and in
 * October two survivors turned up on the homepage: a paraphrase of
 * Meditations II.1 and a blend of two translations of Seneca's Letter 12.
 * This finds the rest. For each quote it locates the closest passage in that
 * author's translations and grades the match:
 *
 *   verbatim   the wording is in a translation (punctuation aside)
 *   close      a passage says this, in different words: a different
 *              translation we don't hold, or a paraphrase. Needs a human.
 *   not found  nothing close. A modern translation we don't hold, or not
 *              his at all. Needs a human.
 *   no corpus  no public-domain translation to check against (Musonius).
 *
 * Only "verbatim" is a pass. The other grades are leads, not verdicts: a quote
 * from Hays or Hard will grade "close" against Long without being wrong.
 *
 * Texts are downloaded once into scripts/.corpus/ (gitignored).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CACHE = path.join(__dirname, '.corpus');
const gut = n => ({ name: 'gutenberg-' + n, url: `https://www.gutenberg.org/cache/epub/${n}/pg${n}.txt` });

const CORPORA = {
  'Marcus Aurelius': [
    { ...gut(15877), label: 'Long (1862)' },
    { ...gut(2680), label: 'Casaubon (1634)' },
    { name: 'hays-vreeman', url: 'https://vreeman.com/meditations/', html: true, label: 'Hays (2002), via vreeman.com' },
  ],
  Epictetus: [
    { ...gut(10661), label: 'Long (1877), selection' },
    { ...gut(871), label: 'Crossley, Golden Sayings (1903)' },
    { ...gut(39855), label: 'Rolleston, Teaching (1888)' },
    { ...gut(45109), label: 'Enchiridion (Gutenberg #45109)' },
  ],
  Seneca: [
    { name: 'gummere-letters', wikisourceLetters: true, label: 'Gummere, Letters (1917-25)' },
    { ...gut(64576), label: 'Stewart, Minor Dialogues (1889)' },
    { ...gut(3794), label: 'Stewart, On Benefits (1887)' },
  ],
};

function loadQuotes() {
  const src = fs.readFileSync(path.join(ROOT, 'constants', 'quotes.js'), 'utf8')
    .replace(/export\s+(const|function)/g, '$1');
  const names = [...src.matchAll(/^(?:const|function)\s+(\w+)/gm)].map(m => m[1]);
  const m = {};
  new Function('m', src + ';m.all={' + names.join(',') + '}')(m);
  const out = [];
  for (const [list, v] of Object.entries(m.all)) {
    if (Array.isArray(v)) v.forEach((q, i) => out.push({ ...q, list, index: i }));
  }
  return out;
}

const strip = h => h.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/g, ' ')
  .replace(/<[^>]+>/g, ' ').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n))
  .replace(/&[a-z]+;/g, ' ');

async function fetchCorpus(c) {
  fs.mkdirSync(CACHE, { recursive: true });
  const file = path.join(CACHE, c.name + '.txt');
  if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8');
  let text = '';
  if (c.wikisourceLetters) {
    for (let n = 1; n <= 124; n++) {
      const r = await fetch(`https://en.wikisource.org/wiki/Moral_letters_to_Lucilius/Letter_${n}`);
      text += '\n' + strip(await r.text());
      await new Promise(z => setTimeout(z, 250));
    }
  } else {
    const r = await fetch(c.url, { headers: { 'User-Agent': 'Mozilla/5.0 (quote audit; getmarcus.app)' } });
    text = await r.text();
    if (c.html) text = strip(text);
  }
  fs.writeFileSync(file, text);
  return text;
}

const norm = t => String(t).toLowerCase().replace(/[‘’]/g, "'").replace(/[^a-z0-9' ]+/g, ' ')
  .split(/\s+/).filter(Boolean);
function bigrams(ws) { const s = new Set(); for (let i = 0; i < ws.length - 1; i++) s.add(ws[i] + ' ' + ws[i + 1]); return s; }
function dice(a, b) {
  if (!a.size || !b.size) return 0;
  let n = 0; for (const x of a) if (b.has(x)) n++;
  return (2 * n) / (a.size + b.size);
}

// Candidate windows come from token votes, so only plausible stretches of a
// 300,000-word text are scored.
function index(words) {
  const ix = new Map();
  words.forEach((w, i) => { if (w.length > 3) { if (!ix.has(w)) ix.set(w, []); ix.get(w).push(i); } });
  return ix;
}
function bestMatch(q, corpus) {
  const qw = norm(q), qb = bigrams(qw), n = qw.length;
  const votes = new Map();
  qw.forEach((w, k) => {
    const hits = corpus.ix.get(w);
    if (!hits || hits.length > 400) return; // common words carry no signal
    for (const p of hits) { const s = Math.max(0, p - k) >> 2; votes.set(s, (votes.get(s) || 0) + 1); }
  });
  const starts = [...votes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40).map(([s]) => s << 2);
  let best = { score: 0, at: 0 };
  for (const s0 of starts) {
    for (let s = Math.max(0, s0 - 6); s <= s0 + 6; s += 2) {
      for (const len of [n - 4, n, n + 6]) {
        if (len < 2) continue;
        const sc = dice(qb, bigrams(corpus.words.slice(s, s + len)));
        if (sc > best.score) best = { score: sc, at: s, len };
      }
    }
  }
  return { score: best.score, text: corpus.words.slice(best.at, best.at + (best.len || n)).join(' ') };
}

function authorKey(a) {
  if (/Marcus Aurelius/.test(a)) return 'Marcus Aurelius';
  if (/Epictetus/.test(a)) return 'Epictetus';
  if (/^Seneca/.test(a)) return 'Seneca';
  return null;
}

(async () => {
  const quotes = loadQuotes();
  const corpora = {};
  for (const [author, list] of Object.entries(CORPORA)) {
    corpora[author] = [];
    for (const c of list) {
      const words = norm(await fetchCorpus(c));
      corpora[author].push({ label: c.label, words, ix: index(words) });
    }
  }
  const rows = quotes.map(q => {
    const key = authorKey(q.author);
    if (!key) return { ...q, grade: 'no corpus' };
    let best = { score: 0 };
    for (const c of corpora[key]) {
      const m = bestMatch(q.text, c);
      if (m.score > best.score) best = { ...m, label: c.label };
    }
    const grade = best.score >= 0.85 ? 'verbatim' : best.score >= 0.45 ? 'close' : 'not found';
    return { ...q, grade, score: Math.round(best.score * 100) / 100, match: best.text, translation: best.label };
  });
  if (process.argv.includes('--json')) { console.log(JSON.stringify(rows, null, 1)); return; }
  const by = g => rows.filter(r => r.grade === g);
  console.log(`# Quote audit: ${rows.length} quotes in constants/quotes.js\n`);
  for (const g of ['verbatim', 'close', 'not found', 'no corpus']) console.log(`  ${g.padEnd(10)} ${by(g).length}`);
  for (const g of ['not found', 'close']) {
    console.log(`\n## ${g}\n`);
    for (const r of by(g).sort((a, b) => a.score - b.score)) {
      console.log(`- [${r.list}#${r.index}] ${r.author}, ${r.ref || r.source} (${r.score})\n    app:  ${r.text}\n    best: ${r.translation}: ${r.match.slice(0, 220)}`);
    }
  }
})().catch(e => { console.error('✗ ' + e.message); process.exit(1); });
