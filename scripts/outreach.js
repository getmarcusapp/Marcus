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
];

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

function queryFor(entry) {
  let phrase = String(entry.text).replace(/["“”]/g, '').replace(/\.$/, '');
  if (phrase.length > 70) phrase = phrase.slice(0, phrase.slice(0, 70).lastIndexOf(' '));
  return '"' + phrase + '" "' + String(entry.credited).split(',')[0] + '"';
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
      state.candidates[url] = { found: new Date().toISOString(), via: entry.id };
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

  // Never re-touch a site already verified or already written to.
  const pending = urls.filter(u => {
    const s = state.sites[u];
    return !s || (!s.sent && !s.verifiedAt);
  }).slice(0, opts.limit || 40);

  console.error('\n' + pending.length + ' page(s) to check\n');
  for (const url of pending) {
    process.stderr.write('  ' + url.slice(0, 72) + ' ... ');
    if (!(await allowed(url))) { state.sites[url] = { skipped: 'robots.txt' }; process.stderr.write('robots.txt\n'); continue; }
    const res = await get(url);
    await sleep(PAUSE_MS);
    if (!res.ok) { state.sites[url] = { error: res.error || ('HTTP ' + res.status) }; process.stderr.write('unreachable\n'); continue; }

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

module.exports = { draft, queryFor, findContact, allowed, EXCLUDE, report, loadState, isJunk };
if (require.main === module) main();
