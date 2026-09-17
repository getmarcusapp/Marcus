#!/usr/bin/env node
/**
 * Outreach pipeline: discover, verify, find a contact, draft. You send.
 *
 *   discover  search for pages carrying one of our 26 documented misattributions
 *   verify    fetch each and confirm it publishes the line as genuine
 *   contact   look for a published contact address on that site
 *   draft     write a specific correction for each confirmed hit
 *   report    outreach.md to work from, plus state so reruns do not repeat
 *
 * WHY THE SENDING IS NOT HERE, AND WILL NOT BE. What worked on Sadler was that
 * a specific person had read his specific list. What got the Modern Stoicism
 * pitch accepted was that it named Colligan's 2018 piece and proposed a
 * successor. Both landed because they could not have been sent to anyone else.
 * A tool that sends removes the only property that made them work, and burns a
 * young domain's sending reputation on the way. So this stops at the draft.
 *
 * WHAT IT WILL AND WILL NOT COLLECT. Only an address a site has published on
 * its own contact or about page, and only for a site we have already confirmed
 * carries a specific error we can prove. It obeys robots.txt, identifies
 * itself, and waits between requests. It does not guess addresses, try
 * firstname@, or touch WHOIS. A site with a contact form and no address is
 * reported as a form, which is the correct answer rather than a failure.
 *
 * SETUP. Discovery needs a search API. Set one:
 *   export BRAVE_API_KEY=...     (brave.com/search/api, 2k queries/month free)
 *   export SERPER_API_KEY=...    (serper.dev)
 * Everything except discovery works without one: feed it URLs instead.
 *
 * USAGE
 *   node scripts/outreach.js discover            search, cache candidates
 *   node scripts/outreach.js run                 discover, verify, contact, draft
 *   node scripts/outreach.js run --file urls.txt skip discovery, use a list
 *   node scripts/outreach.js run --limit 20      cap how many sites are touched
 *   node scripts/outreach.js status              what has been found and sent
 *   node scripts/outreach.js sent <url>          mark one as contacted
 *
 * State lives in outreach-state.json, which is gitignored: it holds other
 * people's contact addresses and has no business in a public repo.
 */
const fs = require('fs');
const path = require('path');
const det = require('./find-misquotes');

const ROOT = path.join(__dirname, '..');
const STATE_PATH = path.join(ROOT, 'outreach-state.json');

// A search key read from a gitignored file, so it does not have to live in a
// shell profile and cannot be committed. Shell exports do not survive between
// tool calls either, which makes a file the practical option. Real env vars
// win, so CI can still pass one in.
(function loadEnvLocal() {
  try {
    const txt = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8');
    for (const line of txt.split('\n')) {
      const m = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const key = m[1];
      const val = m[2].replace(/^['"]|['"]$/g, '').trim();
      if (val && !process.env[key]) process.env[key] = val;
    }
  } catch { /* no .env.local, which is fine */ }
})();
const UA = 'MarcusQuoteChecker/1.0 (+https://getmarcus.app/check-a-stoic-quote)';
const PAUSE_MS = 1500;          // between requests to the same host, and generally
const CONTACT_PATHS = ['/contact', '/contact-us', '/about', '/about-us', '/contact.html', '/about.html'];

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── state ───────────────────────────────────────────────────────────────────
function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8')); }
  catch { return { candidates: {}, sites: {}, updated: null }; }
}
function saveState(s) {
  s.updated = new Date().toISOString();
  fs.writeFileSync(STATE_PATH, JSON.stringify(s, null, 2) + '\n', 'utf8');
}

// ── http ────────────────────────────────────────────────────────────────────
async function get(url, accept) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 15000);
  try {
    const res = await fetch(url, {
      signal: ctl.signal, redirect: 'follow',
      headers: { 'User-Agent': UA, Accept: accept || 'text/html,application/xhtml+xml' },
    });
    return { ok: res.ok, status: res.status, body: await res.text(), finalUrl: res.url || url };
  } catch (e) {
    return { ok: false, status: 0, error: e.name === 'AbortError' ? 'timeout' : e.message };
  } finally { clearTimeout(timer); }
}

// Politeness is not optional when you are fetching other people's pages in a
// loop. Cached per origin so we ask once.
const robotsCache = new Map();
async function allowed(url) {
  let origin, pathname;
  try { const u = new URL(url); origin = u.origin; pathname = u.pathname; } catch { return false; }
  if (!robotsCache.has(origin)) {
    const res = await get(origin + '/robots.txt', 'text/plain');
    robotsCache.set(origin, res.ok ? res.body : '');
    await sleep(300);
  }
  const txt = robotsCache.get(origin);
  if (!txt) return true;                     // no robots.txt means no restriction
  // Only the wildcard group; we are not a named agent anywhere.
  const block = (txt.split(/user-agent:/i).find(b => /^\s*\*/.test(b)) || '');
  const rules = [...block.matchAll(/^\s*disallow:\s*(\S*)\s*$/gim)].map(m => m[1]);
  return !rules.some(r => r && r !== '/' ? pathname.startsWith(r) : r === '/');
}

// ── discovery ───────────────────────────────────────────────────────────────
function searchProvider() {
  if (process.env.BRAVE_API_KEY) return 'brave';
  if (process.env.SERPER_API_KEY) return 'serper';
  return null;
}

const EXCLUDE = [
  'getmarcus.app', 'goodreads.com', 'pinterest.', 'quotefancy.com', 'brainyquote.com',
  'azquotes.com', 'reddit.com', 'facebook.com', 'x.com', 'twitter.com', 'youtube.com',
  'amazon.', 'quotes.net', 'wikiquote.org',
  // Platforms that cannot be acted on, so a candidate slot spent here is
  // wasted. Measured over the first 40 candidates: every one of these
  // returned 403 or was disallowed, nine slots for nothing.
  //   - Medium and Quora refuse a non-browser user agent. We will not forge
  //     one, so we cannot read the page, let alone verify it.
  //   - LinkedIn and Quora disallow us in robots.txt.
  //   - Their outbound links are nofollow, so even a successful correction
  //     buys no link equity, and the author is reachable only through the
  //     platform's own messaging.
  'medium.com', 'quora.com', 'linkedin.com', 'stackexchange.com', 'stackoverflow.com',
  // A mirror of someone else's page. The error is not theirs to fix.
  'archive.org', 'webcache.googleusercontent.com',
];

// Vocabulary of a page DISCUSSING a misattribution rather than committing one.
// The query below excludes these, because a phrase-plus-author search ranks the
// debunkers above the repeaters: of the first 40 candidates, 15 came back
// "already correct" and every one was a quote-investigation page. Those are the
// pages we least want, and they were crowding out the ones we want most.
const DISCUSSION_TERMS = ['misattributed', 'misattribution', 'misquote', 'misquoted', 'fact-check'];

async function search(query) {
  const provider = searchProvider();
  if (provider === 'brave') {
    const u = 'https://api.search.brave.com/res/v1/web/search?count=20&q=' + encodeURIComponent(query);
    const res = await fetch(u, { headers: { Accept: 'application/json', 'X-Subscription-Token': process.env.BRAVE_API_KEY } });
    if (!res.ok) return { error: 'brave HTTP ' + res.status };
    const j = await res.json();
    return { urls: ((j.web && j.web.results) || []).map(r => r.url) };
  }
  if (provider === 'serper') {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'X-API-KEY': process.env.SERPER_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: query, num: 20 }),
    });
    if (!res.ok) return { error: 'serper HTTP ' + res.status };
    const j = await res.json();
    return { urls: (j.organic || []).map(r => r.link) };
  }
  return { error: 'no search API key set (BRAVE_API_KEY or SERPER_API_KEY)' };
}

// Hosts worth naming in the query itself. EXCLUDE is still applied to every
// result afterwards, because not every provider honours an operator, but
// filtering at the source means the 20 results we get back are 20 we can use.
const QUERY_EXCLUDE_SITES = [
  'medium.com', 'quora.com', 'linkedin.com', 'reddit.com', 'goodreads.com',
  'pinterest.com', 'quotefancy.com', 'brainyquote.com', 'azquotes.com',
];

// Bump this whenever queryFor changes in a way that changes WHICH pages come
// back. Candidates record the version that found them, and selectPending works
// the highest version first.
//
// Why that matters: v1 was phrase + credited author with no exclusions, and it
// yielded 0 sendable pages out of 40 candidates touched, because it ranked the
// debunkers and the 403-ing platforms above the pages actually committing the
// error. When v2 landed there were 143 untouched v1 candidates sitting ahead of
// it in insertion order, so without this the next seven batches would have gone
// on working the queue we already know does not convert.
//
//   v1  "<phrase>" "<credited>"
//   v2  ...plus -misattributed etc. and -site: for the hosts that block us
const QUERY_VERSION = 2;

function queryFor(entry) {
  let phrase = String(entry.text).replace(/["“”]/g, '').replace(/\.$/, '');
  if (phrase.length > 70) phrase = phrase.slice(0, phrase.slice(0, 70).lastIndexOf(' '));
  const neg = DISCUSSION_TERMS.map(t => '-' + t)
    .concat(QUERY_EXCLUDE_SITES.map(h => '-site:' + h))
    .join(' ');
  return '"' + phrase + '" "' + String(entry.credited).split(',')[0] + '" ' + neg;
}

// A 403 from Medium is not going to become a 200 tomorrow, and retrying a page
// robots.txt disallows is both pointless and rude. Without this the --limit is
// eaten by old failures: batch two spent 7 of its 20 slots re-fetching the
// exact seven URLs that had already failed in batch one.
//
// Transient failures do get another go, because a timeout or a 502 says nothing
// about the page. Two attempts, then it is left alone.
const PERMANENT = /^(HTTP (401|403|404|410|451)|robots\.txt)$/;
const MAX_ATTEMPTS = 2;

function isTerminal(siteRecord) {
  const s = siteRecord;
  if (!s) return false;
  if (s.sent || s.verifiedAt) return true;
  const why = s.error || (s.skipped ? 'robots.txt' : null);
  if (!why) return false;
  if (PERMANENT.test(why)) return true;
  return (s.attempts || 1) >= MAX_ATTEMPTS;
}

// Which candidates this run should touch.
//
// Extracted from the run loop so a check can exercise it directly. The first
// version of that check asserted that the string `EXCLUDE.some` appeared in the
// loop body, and it passed with the exclusion removed, because the slice it
// searched still contained a different line mentioning EXCLUDE. Reading source
// text is not testing behaviour.
//
// EXCLUDE is applied here, not only at discovery: 23 candidates were already in
// state before those hosts were excluded, and a rule enforced only at discovery
// would still have spent a slot on each. It also covers URLs given with --file.
function selectPending(urls, sites, limit, candidates) {
  const usable = [];
  let blocked = 0;
  for (const u of urls) {
    if (EXCLUDE.some(x => u.includes(x))) { blocked++; continue; }
    if (isTerminal(sites[u])) continue;
    usable.push(u);
  }
  // Highest query version first. Stable within a version, so the order a
  // provider returned results in is preserved and reruns are predictable.
  if (candidates) {
    const qv = u => (candidates[u] && candidates[u].qv) || 1;
    const pos = new Map(usable.map((u, i) => [u, i]));
    usable.sort((a, b) => (qv(b) - qv(a)) || (pos.get(a) - pos.get(b)));
  }
  const pending = usable.slice(0, limit || 40);
  return {
    pending,
    blocked,
    queued: usable.length - pending.length,
    retries: pending.filter(u => sites[u]).length,
  };
}

async function discover(state, opts) {
  const list = det.loadMisattributions();
  if (!searchProvider()) {
    console.error('No search API key. Set BRAVE_API_KEY or SERPER_API_KEY, or use --file.');
    console.error('Run `node scripts/find-misquotes.js --queries` to search by hand instead.');
    return 0;
  }
  let added = 0;
  // Short phrases match half the internet; they are searchable by hand but not
  // worth spending API quota on.
  const worth = list.filter(e => String(e.text).split(/\s+/).length >= 6);
  for (const entry of worth) {
    const q = queryFor(entry);
    process.stderr.write('  search: ' + q.slice(0, 62) + ' ... ');
    const { urls, error } = await search(q);
    if (error) { process.stderr.write(error + '\n'); break; }
    let n = 0;
    for (const url of urls || []) {
      if (EXCLUDE.some(x => url.includes(x))) continue;
      if (state.candidates[url]) continue;
      state.candidates[url] = { found: new Date().toISOString(), via: entry.id, qv: QUERY_VERSION };
      n++; added++;
    }
    process.stderr.write(n + ' new\n');
    saveState(state);
    await sleep(PAUSE_MS);
    if (opts.limit && added >= opts.limit) break;
  }
  return added;
}

// ── contact ─────────────────────────────────────────────────────────────────
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
// Anchored on the domain, not on a substring. Matching bare "example"
// discarded editor@example-quotes.test in testing, and would discard a real
// address at any domain with that word in it.
const JUNK_EMAIL = [
  /@(example|domain|email|yourdomain|company)\.(com|org|net)$/i,
  /^(your ?name|name|email|user|someone|firstname)@/i,
  /@(sentry|wix|wixpress|squarespace|godaddy|shopify|cloudflare)\./i,
  // Writing to an address that cannot receive a reply is worse than not writing.
  /^(no-?reply|donotreply|do-not-reply|postmaster|abuse|webmaster|admin|root)@/i,
  /\.(png|jpg|jpeg|gif|svg|webp)$/i,
  /@2x/i,
];
const isJunk = a => JUNK_EMAIL.some(r => r.test(a));

async function findContact(origin) {
  // `page` is the contact page that exists but gave up nothing. Plenty of
  // contact forms are rendered client-side, so a static fetch sees a 125KB
  // document with no <form> in it. "No contact found" is true and useless;
  // "there is a contact page, open it" is what you can act on.
  const out = { emails: [], form: null, page: null, checked: [] };
  for (const p of CONTACT_PATHS) {
    const url = origin + p;
    if (!(await allowed(url))) continue;
    const res = await get(url);
    out.checked.push(p + ' ' + (res.ok ? 'ok' : res.status || res.error));
    await sleep(PAUSE_MS);
    if (!res.ok) continue;
    // mailto: first — an address a site links is one it wants used.
    const mailtos = [...res.body.matchAll(/mailto:([^"'?>\s]+)/gi)].map(m => m[1]);
    const inText = (det.visibleText(res.body).match(EMAIL_RE) || []);
    for (const e of [...mailtos, ...inText]) {
      const addr = e.toLowerCase().trim();
      if (isJunk(addr)) continue;
      if (!out.emails.includes(addr)) out.emails.push(addr);
    }
    // A person reads editor@ and hello@; info@ is a queue. Sort so the draft
    // is addressed to the best available, not to whichever appeared first.
    const rank = a2 => (/^(editor|hello|hi|team|contact|press|write)@/i.test(a2) ? 0
      : /^(info|support|enquir|inquir|office)@/i.test(a2) ? 1 : 2);
    out.emails.sort((x, y) => rank(x) - rank(y));
    if (!out.form && /<form[\s\S]{0,600}?(contact|message|enquir)/i.test(res.body)) out.form = url;
    if (!out.page && /\/contact/.test(p)) out.page = url;
    if (out.emails.length) break;
  }
  return out;
}

// ── draft ───────────────────────────────────────────────────────────────────
// The skeleton is shared; the content is not. Every draft carries their
// wording, their attribution and the specific trail, which is the whole reason
// it is worth reading. Edit before sending: a message that reads as generated
// is worth less than no message.
function draft(hit, pageUrl, total) {
  const e = hit.entry;
  const who = String(e.credited).split(',')[0];
  const actually = e.actual
    ? 'It is ' + e.actual + '.'
    : 'It has no known source. It appears in no surviving text of ' + who + '.';
  // The note already ends in a full stop; appending another produced "..".
  let note = String(e.note || '').split('. ').slice(0, 2).join('. ').trim();
  if (note && !/[.!?]$/.test(note)) note += '.';
  // Derived, not typed. A hardcoded twenty-six is the same stale-count bug
  // that had /about claiming twenty for months.
  const count = total || det.loadMisattributions().length;
  return [
    'Subject: A quotation on your page is not ' + who + "'s",
    '',
    'Hello,',
    '',
    'You have this on ' + pageUrl + ':',
    '',
    '    "' + e.text + '" — ' + e.credited,
    '',
    (actually + (note ? ' ' + note : '')).trim(),
    '',
    'I maintain a checked library of Stoic passages and audited it against its',
    'sources one line at a time. This was one of ' + count + ' that did not survive.',
    'The full entry, with the trail, is here:',
    '',
    '    https://getmarcus.app/misattributed-stoic-quotes#' + e.id,
    '',
    'No need to credit me, and no need to reply. I thought you would rather',
    'know.',
    '',
    'Gio White',
    'getmarcus.app',
  ].join('\n');
}

// ── pipeline ────────────────────────────────────────────────────────────────
async function run(state, opts) {
  let urls;
  if (opts.file) {
    urls = fs.readFileSync(opts.file, 'utf8').split('\n').map(l => l.trim()).filter(l => /^https?:/.test(l));
    for (const u of urls) if (!state.candidates[u]) state.candidates[u] = { found: new Date().toISOString(), via: 'file' };
    saveState(state);
  } else {
    await discover(state, opts);
    urls = Object.keys(state.candidates);
  }

  // Never re-touch a site already verified, already written to, or permanently
  // unreachable. See isTerminal.
  const { pending, blocked, queued, retries } = selectPending(urls, state.sites, opts.limit, state.candidates);
  if (blocked) console.error('\n' + blocked + ' candidate(s) skipped: host cannot be read or acted on.');
  if (queued) console.error(queued + ' more candidate(s) queued for a later run.');
  if (retries) console.error(retries + ' of these are retries of a transient failure.');

  console.error('\n' + pending.length + ' page(s) to check\n');
  for (const url of pending) {
    process.stderr.write('  ' + url.slice(0, 72) + ' ... ');
    const priorAttempts = (state.sites[url] && state.sites[url].attempts) || 0;
    if (!(await allowed(url))) { state.sites[url] = { skipped: 'robots.txt', attempts: priorAttempts + 1 }; process.stderr.write('robots.txt\n'); continue; }
    const res = await get(url);
    await sleep(PAUSE_MS);
    if (!res.ok) {
      const why = res.error || ('HTTP ' + res.status);
      state.sites[url] = { error: why, attempts: priorAttempts + 1, failedAt: new Date().toISOString() };
      process.stderr.write(why + (PERMANENT.test(why) ? ', will not retry\n' : '\n'));
      continue;
    }

    const text = det.norm(det.visibleText(res.body));
    const hits = det.loadMisattributions().map(e => det.analyse(e, text)).filter(Boolean);
    const targets = hits.filter(h => !h.namesTrueSource);
    if (!targets.length) {
      state.sites[url] = { verifiedAt: new Date().toISOString(), targets: 0, note: hits.length ? 'already correct' : 'clean' };
      process.stderr.write(hits.length ? 'already correct\n' : 'clean\n');
      saveState(state);
      continue;
    }

    const origin = new URL(res.finalUrl).origin;
    const contact = await findContact(origin);
    state.sites[url] = {
      verifiedAt: new Date().toISOString(),
      targets: targets.length,
      entries: targets.map(t => t.entry.id),
      weak: targets.some(t => t.weak),
      emails: contact.emails.slice(0, 3),
      form: contact.form,
      page: contact.page,
      drafts: targets.map(t => draft(t, url)),
      sent: false,
    };
    saveState(state);
    process.stderr.write(targets.length + ' target(s), ' +
      (contact.emails[0] || (contact.form ? 'form' : contact.page ? 'contact page, open by hand' : 'no contact found')) + '\n');
  }
  return state;
}

// ── report ──────────────────────────────────────────────────────────────────
function report(state) {
  const rows = Object.entries(state.sites).filter(([, s]) => s.targets > 0);
  const reachable = s => s.emails.length || s.form || s.page;
  const ready = rows.filter(([, s]) => !s.sent && reachable(s));
  const noContact = rows.filter(([, s]) => !s.sent && !reachable(s));
  const done = rows.filter(([, s]) => s.sent);

  const out = ['# Outreach', '',
    `${ready.length} ready to send, ${noContact.length} with no contact found, ${done.length} already sent.`,
    `${Object.keys(state.candidates).length} candidate page(s) known.`, ''];

  if (ready.length) {
    out.push('## Ready', '');
    for (const [url, s] of ready) {
      out.push('### ' + url);
      out.push('- Contact: ' + (s.emails.join(', ')
        || (s.form ? 'form at ' + s.form
        : 'contact page at ' + s.page + ' (address is rendered by JavaScript, open it)')));
      out.push('- Entries: ' + s.entries.join(', ') + (s.weak ? '  **short phrase, confirm by eye**' : ''));
      out.push('', '```', s.drafts.join('\n\n---\n\n'), '```', '');
      out.push('Mark done:  `node scripts/outreach.js sent ' + url + '`', '');
    }
  }
  if (noContact.length) {
    out.push('## No published contact address', '');
    for (const [url, s] of noContact) out.push('- ' + url + '  (' + s.entries.join(', ') + ')');
    out.push('');
  }
  if (done.length) {
    out.push('## Sent', '');
    for (const [url, s] of done) out.push('- ' + url + '  ' + (s.sentAt || '').slice(0, 10));
  }
  return out.join('\n');
}

// ── cli ─────────────────────────────────────────────────────────────────────
async function main() {
  const argv = process.argv.slice(2);
  const cmd = argv[0] || 'status';
  const opts = {
    file: argv.includes('--file') ? argv[argv.indexOf('--file') + 1] : null,
    limit: argv.includes('--limit') ? Number(argv[argv.indexOf('--limit') + 1]) : 0,
    out: argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : 'outreach.md',
  };
  const state = loadState();

  if (cmd === 'discover') {
    const n = await discover(state, opts);
    console.error('\n' + n + ' new candidate(s). Now: node scripts/outreach.js run');
    return;
  }
  if (cmd === 'sent') {
    const url = argv[1];
    if (!state.sites[url]) { console.error('Not in state: ' + url); process.exit(1); }
    state.sites[url].sent = true;
    state.sites[url].sentAt = new Date().toISOString();
    saveState(state);
    console.error('Marked sent: ' + url);
    return;
  }
  if (cmd === 'run') {
    await run(state, opts);
    fs.writeFileSync(opts.out, report(state) + '\n', 'utf8');
    console.error('\nWrote ' + opts.out);
    return;
  }
  // status
  console.log(report(state));
}

module.exports = { draft, queryFor, findContact, allowed, EXCLUDE, report, loadState, isJunk, isTerminal, PERMANENT, DISCUSSION_TERMS, selectPending, QUERY_VERSION };
if (require.main === module) main();
