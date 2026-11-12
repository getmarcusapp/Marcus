#!/usr/bin/env node
/**
 * How often do the top "Stoic quotes" pages publish a fake?
 *
 *   node scripts/quote-study.js sample      search, save the sample of URLs
 *   node scripts/quote-study.js check       fetch each page, look for the fakes
 *   node scripts/quote-study.js report      print the numbers and every hit
 *
 * WHY THIS IS SEPARATE FROM outreach.js. Outreach finds pages by searching for
 * the fake lines themselves, so its 90 confirmed pages say nothing about how
 * common the problem is: the sample was chosen by the error. This one samples
 * neutrally, the top results for the searches an ordinary reader would run,
 * and only then looks for the errors. That is the difference between a list
 * of offenders and a rate anyone can cite.
 *
 * WHAT COUNTS AS A HIT. A page counts only if it prints one of our documented
 * misattributions (constants/misattributions.js), credits it to the wrong
 * person, and does not name the true source or discuss the attribution. Short
 * entries ("Know thyself") are left out: they match half the internet. A wrong
 * accusation in a published study costs more than a missed one, so every rule
 * here leans toward undercounting, and `report` prints the context of each hit
 * so a person can read it before any number is published.
 *
 * WHAT IT CANNOT SEE. Pages that refuse a non-browser user agent, disallow
 * crawling, or draw their quotes with JavaScript. Those are reported as unread
 * and left out of the denominator. We do not forge a browser to get in.
 *
 * Results live in scripts/out/quote-study.json (gitignored working data).
 */
const fs = require('fs');
const path = require('path');
const { allowed } = require('./outreach'); // also loads .env.local
const det = require('./find-misquotes');

const OUT = path.join(__dirname, 'out', 'quote-study.json');
const QUERIES = ['marcus aurelius quotes', 'seneca quotes', 'epictetus quotes', 'stoic quotes', 'stoicism quotes'];
const PER_QUERY = 40;
const UA = 'MarcusQuoteChecker/1.0 (+https://getmarcus.app/check-a-stoic-quote)';
// Words in a "credited to" field that are not a name.
const CREDIT_NOISE = new Set(['sometimes', 'stoic', 'younger', 'elder', 'often']);
// How a page sounds when it is correcting the attribution, beyond the phrases
// find-misquotes.js already knows. All from pages in the first sample.
const DEBUNKS = ['probably not', 'nowhere in', 'turns up nowhere', 'appears nowhere', 'is presented as',
  'gets handed to', 'is credited to', 'apocryphal', 'spurious', 'fake quote', 'not from marcus',
  'not from seneca', 'not from epictetus', 'paraphrase'];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const load = () => (fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : { sampled: null, pages: {} });
const save = s => { fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, JSON.stringify(s, null, 1)); };
const host = u => new URL(u).hostname.replace(/^www\./, '');

async function sample() {
  if (!process.env.BRAVE_API_KEY) throw new Error('BRAVE_API_KEY is not set in .env.local');
  const state = load();
  state.sampled = new Date().toISOString();
  state.engine = 'Brave Search';
  for (const q of QUERIES) {
    let rank = 0;
    for (let offset = 0; offset * 20 < PER_QUERY; offset++) {
      const u = 'https://api.search.brave.com/res/v1/web/search?count=20&country=us&offset=' + offset + '&q=' + encodeURIComponent(q);
      const res = await fetch(u, { headers: { Accept: 'application/json', 'X-Subscription-Token': process.env.BRAVE_API_KEY } });
      if (!res.ok) throw new Error('brave HTTP ' + res.status + ' on "' + q + '"');
      for (const r of ((await res.json()).web || {}).results || []) {
        rank++;
        if (host(r.url) === 'getmarcus.app') continue; // not our own pages
        const p = state.pages[r.url] || (state.pages[r.url] = { found: [] });
        p.found.push({ q, rank });
        p.title = r.title;
      }
      await sleep(1300);
    }
    console.log(`${q}: ${rank} results`);
  }
  save(state);
  console.log(`${Object.keys(state.pages).length} distinct pages sampled`);
}

async function fetchPage(url) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 20000);
  try {
    const res = await fetch(url, { signal: ctl.signal, redirect: 'follow', headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' } });
    return { ok: res.ok, status: res.status, body: await res.text() };
  } catch (e) {
    return { ok: false, status: 0, error: e.name === 'AbortError' ? 'timeout' : e.message };
  } finally { clearTimeout(timer); }
}

async function checkOne(url, p, entries) {
  if (!(await allowed(url).catch(() => true))) { p.unread = 'robots.txt disallows'; return; }
  const res = await fetchPage(url);
  if (!res.ok) { p.unread = res.error || 'HTTP ' + res.status; return; }
  const text = det.norm(det.visibleText(res.body));
  p.words = text.split(' ').length;
  // Under a few hundred words there is no list of quotes to check: a consent
  // wall, a JavaScript shell, or an error page served with a 200.
  if (p.words < 300) { p.unread = 'no readable text (' + p.words + ' words)'; return; }
  const title = det.norm((res.body.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '');
  p.hits = []; p.corrected = [];
  for (const e of entries) {
    const a = det.analyse(e, text);
    if (!a || a.weak) continue;
    // Where the quotation sits, so the attribution can be read next to it.
    const needle = det.norm(e.text);
    const probe = needle.split(' ').slice(0, 12).join(' ');
    const at = text.indexOf(probe);
    const end = at + (text.startsWith(needle, at) ? needle.length : probe.length);
    const near = text.slice(Math.max(0, at - 80), at) + ' | ' + text.slice(end, end + 80);
    const wide = text.slice(Math.max(0, at - 400), end + 400);
    // The wrong name must sit right beside the line, or be the page's title
    // ("Seneca Quotes"). A name 200 characters on belongs to the next quote:
    // the first run counted success.com for a line it credits to someone else.
    const credited = det.norm(e.credited).split(' ').filter(w => w.length > 3 && !CREDIT_NOISE.has(w));
    const wrongly = credited.some(w => near.includes(w) || title.includes(w));
    // A page explaining that the line is fake is the opposite of a hit. The
    // first run counted two debunking articles as offenders.
    const discussed = a.namesTrueSource || DEBUNKS.some(d => wide.includes(d));
    if (discussed) p.corrected.push(e.id);
    else if (wrongly) p.hits.push({ id: e.id, context: text.slice(Math.max(0, at - 160), end + 160) });
  }
  delete p.unread;
}

async function check() {
  const state = load();
  const entries = det.loadMisattributions();
  if (process.argv.includes('--again')) for (const p of Object.values(state.pages)) { delete p.hits; delete p.corrected; delete p.unread; }
  const todo = Object.entries(state.pages).filter(([, p]) => p.hits === undefined && !p.unread);
  let i = 0;
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (i < todo.length) {
      const [url, p] = todo[i++];
      await checkOne(url, p, entries);
      if (i % 20 === 0) { save(state); console.log(`${i}/${todo.length}`); }
    }
  }));
  save(state);
  console.log('checked ' + todo.length);
}

function report() {
  const state = load();
  const all = Object.entries(state.pages);
  const read = all.filter(([, p]) => p.hits);
  const bad = read.filter(([, p]) => p.hits.length);
  const pct = (a, b) => (b ? Math.round(100 * a / b) : 0) + '%';
  console.log(`# Stoic quote pages, sampled ${String(state.sampled).slice(0, 10)} via ${state.engine}\n`);
  console.log(`  ${all.length} distinct pages in the top ${PER_QUERY} for ${QUERIES.length} searches`);
  console.log(`  ${read.length} could be read; ${all.length - read.length} could not`);
  console.log(`  ${bad.length} of ${read.length} (${pct(bad.length, read.length)}) publish at least one documented fake as genuine`);
  const strict = read.filter(([, p]) => p.hits.some(h => h.id !== 'not-what-happens'));
  console.log(`  ${strict.length} of ${read.length} (${pct(strict.length, read.length)}) if the Epictetus paraphrase ("It's not what happens to you...") is not counted`);
  console.log(`  ${read.filter(([, p]) => p.corrected.length).length} pages name the true source of one, or say it is disputed\n`);
  console.log('## By search');
  for (const q of QUERIES) {
    const inQ = read.filter(([, p]) => p.found.some(f => f.q === q));
    const top10 = inQ.filter(([, p]) => p.found.some(f => f.q === q && f.rank <= 10));
    console.log(`  ${q.padEnd(24)} ${inQ.filter(([, p]) => p.hits.length).length}/${inQ.length} read pages` +
      `   top ten: ${top10.filter(([, p]) => p.hits.length).length}/${top10.length}`);
  }
  const n = {};
  for (const [, p] of bad) for (const h of p.hits) n[h.id] = (n[h.id] || 0) + 1;
  console.log('\n## Most common fakes (pages)');
  for (const [id, c] of Object.entries(n).sort((a, b) => b[1] - a[1])) console.log(`  ${String(c).padStart(3)}  ${id}`);
  const why = {};
  for (const [, p] of all) if (!p.hits) why[(p.unread || 'unchecked').replace(/\(.*/, '').trim()] = (why[(p.unread || 'unchecked').replace(/\(.*/, '').trim()] || 0) + 1;
  console.log('\n## Unread, by reason'); for (const [k, c] of Object.entries(why).sort((a, b) => b[1] - a[1])) console.log(`  ${String(c).padStart(3)}  ${k}`);
  if (process.argv.includes('--hits')) {
    console.log('\n## Every hit, for a person to read');
    for (const [url, p] of bad) for (const h of p.hits) console.log(`\n${url}\n  [${h.id}] …${h.context}…`);
  }
}

const cmd = process.argv[2];
(cmd === 'sample' ? sample() : cmd === 'check' ? check() : Promise.resolve(report()))
  .catch(e => { console.error('✗ ' + e.message); process.exit(1); });
