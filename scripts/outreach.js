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
 *   node scripts/outreach.js report              rewrite outreach.md from state
 *   node scripts/outreach.js export              the ready list as JSON
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
  // A Google Translate proxy of a page we already exclude. wikiquote.org was
  // on this list and en-wikiquote-org.translate.goog walked straight past it.
  'translate.goog',

  // ── STRUCTURALLY UNCORRECTABLE ──────────────────────────────────────────
  //
  // The bare-phrase query finds far more pages, and a share of them are pages
  // where no correction is possible at all. The line drawn here is
  // "correction is structurally impossible", not "correction seems unlikely",
  // because the two kinds of mistake do not cost the same: a wrong exclusion
  // silently removes a real target forever, while a wrong inclusion costs one
  // twelve-second fetch. So this list only contains cases where there is
  // nothing a recipient could do even if they wanted to.
  //
  // Merch. A product listing is not an editorial claim about who said a thing,
  // and nobody reprints stock over an attribution. 21 candidates, 4 worked,
  // none usable.
  'redbubble.com', 'etsy.com', 'teepublic.com', 'ebay.com', 'zazzle.com',
  'society6.com', 'displate.com', 'cafepress.com', 'teespring.com', '1stees.com',
  // Immutable by design. A Steem or Hive post is written to a blockchain and
  // cannot be edited by its author, let alone by us.
  'steemit.com', 'hive.blog', 'peakd.com',
  // Short-form social. We cannot edit someone's post, the links are nofollow,
  // and most of these disallow us anyway.
  'instagram.com', 'threads.com', 'tiktok.com',
  // Answers written by students, with no editor to write to.
  'brainly.', 'answers.com', 'chegg.com',
  // A track page or a song title. The quote is the name of the work.
  'bandcamp.com', 'soundcloud.com', 'spotify.com',
  // The reference works on misattribution. Every one of these comes back
  // "already correct", which is a fetch spent confirming what we knew.
  'quoteinvestigator.com', 'snopes.com', 'wist.info',
];

// NOT EXCLUDED, DELIBERATELY, AND THE NEAR MISS IS WORTH RECORDING.
//
// I was about to exclude quote-database sites as a class: fifty candidates,
// no editorial staff, machine-assembled, and six of the biggest were already
// on the list above from an earlier round. Checking the outcomes first showed
// the class had produced a hit WITH a published address, and it was
// wisdomquotes.com — three documented errors on one page and a named human,
// the strongest letter this tool has produced. Excluding the class would have
// thrown it away and nothing would have reported the loss.
//
// Also staying: real publications with real desks (the Indian dailies,
// dailystoic.com, success.com) and small independent blogs, which are most of
// what is left and the whole point.
const DELIBERATELY_INCLUDED = ['wisdomquotes.com', 'dailystoic.com', 'success.com', 'indiatimes.com'];

// Vocabulary of a page DISCUSSING a misattribution rather than committing one.
// The query below excludes these, because a phrase-plus-author search ranks the
// debunkers above the repeaters: of the first 40 candidates, 15 came back
// "already correct" and every one was a quote-investigation page. Those are the
// pages we least want, and they were crowding out the ones we want most.
const DISCUSSION_TERMS = ['misattributed', 'misattribution', 'misquote', 'misquoted', 'fact-check'];

async function search(query, page) {
  const provider = searchProvider();
  const offset = page || 0;
  if (provider === 'brave') {
    // Only ever reading the first twenty results put a hard ceiling on the
    // candidate pool: 26 entries times 20 is the whole universe this tool could
    // ever see, and it had been reached. Brave pages with `offset`.
    const u = 'https://api.search.brave.com/res/v1/web/search?count=20&offset=' + offset +
      '&q=' + encodeURIComponent(query);
    const res = await fetch(u, { headers: { Accept: 'application/json', 'X-Subscription-Token': process.env.BRAVE_API_KEY } });
    if (!res.ok) return { error: 'brave HTTP ' + res.status };
    const j = await res.json();
    return { urls: ((j.web && j.web.results) || []).map(r => r.url) };
  }
  if (provider === 'serper') {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'X-API-KEY': process.env.SERPER_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: query, num: 20, page: offset + 1 }),
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
//   v3  ...plus a bare-phrase variant with no author, and two pages of
//       results per query instead of one. v2 exhausted what one page of one
//       query shape could see: 26 entries times 20 results was the entire
//       universe the tool could reach, and it had reached it. 120 of the 122
//       candidates still queued were v1, which is a queue we know converts at
//       roughly a tenth of what v2 did.
const QUERY_VERSION = 3;

function phraseOf(entry) {
  let phrase = String(entry.text).replace(/["“”]/g, '').replace(/\.$/, '');
  if (phrase.length > 70) phrase = phrase.slice(0, phrase.slice(0, 70).lastIndexOf(' '));
  return phrase;
}

function negatives() {
  return DISCUSSION_TERMS.map(t => '-' + t)
    .concat(QUERY_EXCLUDE_SITES.map(h => '-site:' + h))
    .join(' ');
}

function queryFor(entry) {
  return '"' + phraseOf(entry) + '" "' + String(entry.credited).split(',')[0] + '" ' + negatives();
}

// TWO SHAPES, BECAUSE THEY FIND DIFFERENT PAGES.
//
// Naming the credited author is what surfaces the attribution investigations:
// a page arguing about whether Aristotle said a thing mentions Aristotle far
// more than a page that simply prints the line under his name. That was the v1
// failure, and adding negatives only suppressed the worst of it.
//
// The bare phrase finds the pages that just publish it, which are the ones a
// correction can actually help. It returns more noise, and that is acceptable:
// the detector already rejects a page that does not credit the wrong person,
// so noise costs a fetch, whereas a target we never see costs the whole point.
function queryVariants(entry) {
  return [
    queryFor(entry),
    '"' + phraseOf(entry) + '" ' + negatives(),
  ];
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
  const PAGES = 2;
  outer:
  for (const entry of worth) {
    for (const [shape, q] of queryVariants(entry).entries()) {
      for (let page = 0; page < PAGES; page++) {
        process.stderr.write('  ' + entry.id.slice(0, 26).padEnd(27) +
          (shape ? 'bare  ' : 'author') + ' p' + (page + 1) + ' ... ');
        const { urls, error } = await search(q, page);
        if (error) { process.stderr.write(error + '\n'); break outer; }
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
        // An empty page means there is no second page worth asking for.
        if (!(urls || []).length) break;
        if (opts.limit && added >= opts.limit) break outer;
      }
    }
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
  // Theme and plugin vendors, scraped out of a WordPress footer or a theme
  // credit line. motivationalwizard.com yielded support@pencidesign.com, which
  // is the company that sells the theme: writing to them about a quotation on
  // someone else's site wastes both their time and ours, and looks careless to
  // the one recipient whose opinion matters.
  /@(pencidesign|themeforest|envato|elementor|wpengine|kinsta|siteground|bluehost|hostgator|namecheap|jetpack|automattic|woocommerce|divi|elegantthemes|mythemeshop|themeisle)\./i,
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
  // Wrapped, like the multi-entry letters. This function predates
  // wrapIndented and never got it, so the single-finding letter -- which is
  // thirty-three of the forty-nine -- was going out with the source note as
  // one unbroken 200-character line while the grouped letters wrapped at 76.
  // The line-length check only exercised the grouped ones, so nothing caught
  // it.
  return [
    'Subject: A quotation on your page is not ' + who + "'s",
    '',
    'Hello,',
    '',
    ...wrapIndented('You have this on ' + pageUrl + ':', '', 76),
    '',
    ...wrapIndented('"' + e.text + '" — ' + e.credited, '    ', 76),
    '',
    ...wrapIndented((actually + (note ? ' ' + note : '')).trim(), '', 76),
    '',
    ...wrapIndented('I maintain a checked library of Stoic passages and audited it against ' +
      'its sources one line at a time. This was one of ' + count +
      ' that did not survive. The full entry, with the trail, is here:', '', 76),
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

// ONE EMAIL PER SITE, NOT PER ERROR.
//
// The first version mapped draft() over the targets, so wisdomquotes.com,
// which carries three documented misattributions on a single Seneca page,
// produced three separate near-identical emails to one address. Sending those
// is worse than sending nothing: it reads as a mail merge, which is exactly
// the thing this file's header says destroys the only property that makes the
// outreach work.
//
// It is also the weaker pitch. "Three lines on your page are misattributed,
// here is each one with its real source" is a person who read the page. Three
// copies of the same letter with the quotation swapped is a script.
// Plain-text email, so the wrapping is ours to do. The source notes run past
// 200 characters and under a four-space indent they arrive as one long line
// with a horizontal scrollbar in most mail clients.
function wrapIndented(text, indent, width) {
  const w = (width || 76) - indent.length;
  const out = [];
  let line = '';
  for (const word of String(text).split(/\s+/)) {
    if (!line) { line = word; continue; }
    if ((line + ' ' + word).length > w) { out.push(indent + line); line = word; }
    else line += ' ' + word;
  }
  if (line) out.push(indent + line);
  return out;
}

const NUMBER_WORD = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const numberWord = n => NUMBER_WORD[n] || String(n);

// One finding, rendered. Shared by the page letter and the domain letter so a
// change to how a correction reads cannot apply to one and not the other.
// `nameAuthor` is false when the surrounding text has already said whose name
// the lines are under, which is the single-author case.
function entryBlock(e, nameAuthor, indent) {
  const who = String(e.credited).split(',')[0];
  const actually = e.actual
    ? 'It is ' + e.actual + '.'
    : 'It has no known source. It appears in no surviving text of ' + who + '.';
  let note = String(e.note || '').split('. ').slice(0, 2).join('. ').trim();
  if (note && !/[.!?]$/.test(note)) note += '.';
  const out = [];
  out.push(...wrapIndented('"' + e.text + '"', indent, 76));
  if (nameAuthor) out.push(...wrapIndented('Credited to ' + e.credited + '.', indent, 76));
  out.push(...wrapIndented((actually + (note ? ' ' + note : '')).trim(), indent, 76));
  out.push(indent + 'https://getmarcus.app/misattributed-stoic-quotes#' + e.id);
  out.push('');
  return out;
}

function draftForSite(targets, pageUrl, total) {
  if (targets.length === 1) return draft(targets[0], pageUrl, total);

  const count = total || det.loadMisattributions().length;
  const n = targets.length;
  const word = numberWord(n);

  // "not Seneca's" when every line is credited to the same person, which is
  // the common case on an author page. A mixed page gets the neutral wording
  // rather than a subject line naming only the first of several.
  const authors = [...new Set(targets.map(t => String(t.entry.credited).split(',')[0]))];
  const subject = authors.length === 1
    ? word.charAt(0).toUpperCase() + word.slice(1) + ' quotations on your page are not ' + authors[0] + "'s"
    : word.charAt(0).toUpperCase() + word.slice(1) + ' quotations on your page are misattributed';

  const lines = [
    'Subject: ' + subject,
    '',
    'Hello,',
    '',
  ];
  const cap = word.charAt(0).toUpperCase() + word.slice(1);
  lines.push(...wrapIndented(
    authors.length === 1
      ? cap + ' lines on ' + pageUrl + ' are attributed to ' + authors[0] + '. None of them are genuine:'
      : cap + ' lines on ' + pageUrl + ' are credited to the wrong person:', '', 76));
  lines.push('');

  for (const t of targets) lines.push(...entryBlock(t.entry, authors.length > 1, '    '));

  lines.push(
    ...wrapIndented('I maintain a checked library of Stoic passages and audited it against ' +
      'its sources one line at a time. These were ' + word + ' of ' + count +
      ' that did not survive.', '', 76),
    '',
    'No need to credit me, and no need to reply. I thought you would rather',
    'know.',
    '',
    'Gio White',
    'getmarcus.app',
  );
  return lines.join('\n');
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
      drafts: [draftForSite(targets, url)],
      sent: false,
    };
    saveState(state);
    process.stderr.write(targets.length + ' target(s), ' +
      (contact.emails[0] || (contact.form ? 'form' : contact.page ? 'contact page, open by hand' : 'no contact found')) + '\n');
  }
  return state;
}

// ── report ──────────────────────────────────────────────────────────────────
// The letter is a pure function of the entry ids and the URL, so it is derived
// here rather than read from state. State holds a `drafts` array written when
// the page was crawled, and while that was the source of truth every change to
// the copy applied only to pages crawled afterwards: the four sites already
// found kept their old letters, including the per-error ones that sent the same
// address three nearly identical emails.
function letterForDomain(rows) {
  const list = det.loadMisattributions();
  const pages = rows.map(([url, site]) => ({
    url,
    targets: (site.entries || [])
      .map(id => list.find(e => e.id === id))
      .filter(Boolean)
      .map(entry => ({ entry })),
  }));
  if (!pages.some(p => p.targets.length)) {
    return rows.flatMap(([, site]) => site.drafts || []).join('\n\n---\n\n');
  }
  return draftForDomain(pages, list.length);
}

// ONE LETTER PER DOMAIN, NOT PER PAGE.
//
// Same mistake as the per-error letters, one level up. socratic-method.com had
// eight candidate pages, and the report would have produced eight separate
// letters to one webmaster. The whole argument for stopping at the draft is
// that a specific person reading a specific page is what makes these land, and
// eight near-identical letters to one address destroys that just as thoroughly
// as three did.
//
// GROUPED BY HOSTNAME, NOT REGISTRABLE DOMAIN. davidlee204.substack.com and
// another author's Substack are different people who happen to share a
// platform, and merging them would write to one about the other's page. Only
// a leading www. is folded, which is the same site by any reading.
function domainKey(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

// pages: [{ url, targets: [{entry}] }]
function draftForDomain(pages, total) {
  const live = pages.filter(p => p.targets && p.targets.length);
  if (live.length === 0) return '';
  if (live.length === 1) return draftForSite(live[0].targets, live[0].url, total);

  const count = total || det.loadMisattributions().length;
  const all = live.flatMap(p => p.targets);
  const n = all.length;
  const word = numberWord(n);
  const cap = word.charAt(0).toUpperCase() + word.slice(1);
  const host = domainKey(live[0].url);
  const authors = [...new Set(all.map(t => String(t.entry.credited).split(',')[0]))];

  const lines = [
    'Subject: ' + cap + ' misattributed quotations on ' + host,
    '',
    'Hello,',
    '',
  ];
  lines.push(...wrapIndented(
    cap + ' lines across ' + host + ', on ' + numberWord(live.length) +
    ' different pages, are credited to people who did not write them:', '', 76));
  lines.push('');

  for (const page of live) {
    lines.push(...wrapIndented('On ' + page.url + ':', '  ', 76));
    // The author is always named per entry in a domain letter. The reader is
    // being sent to several pages and cannot be assumed to hold which name
    // went with which line.
    // Four spaces, not six. The entry link runs to 77 characters on the
    // longest id and cannot be wrapped without breaking it, so every space of
    // indent in front of it is a space over the line budget.
    for (const t of page.targets) lines.push(...entryBlock(t.entry, true, '    '));
  }

  // TWO DIFFERENT COUNTS, AND CONFLATING THEM PUT A FALSE NUMBER IN THE LETTER.
  //
  // "Eight lines across the site" counts occurrences, and is right: one quote
  // repeated on two pages is two lines, and both need fixing.
  //
  // "of 26 that did not survive" counts DISTINCT entries in the audit. On
  // quoteambition.com, precious-privilege appears on two pages, so the letter
  // claimed "eight of 26" when only seven of the twenty-six were involved.
  //
  // A letter whose entire premise is that someone else's number is wrong
  // cannot carry one of its own.
  const distinct = new Set(all.map(t => t.entry.id)).size;
  lines.push(
    ...wrapIndented('I maintain a checked library of Stoic passages and audited it against ' +
      'its sources one line at a time. ' + (distinct === 1
        ? 'This was one of ' + count + ' that did not survive.'
        : 'These were ' + numberWord(distinct) + ' of ' + count + ' that did not survive.'), '', 76),
    '',
    'No need to credit me, and no need to reply. I thought you would rather',
    'know.',
    '',
    'Gio White',
    'getmarcus.app',
  );
  return lines.join('\n');
}

// SEND ORDER. The list had been in whatever order the sites happened to be
// crawled, which with thirty-odd letters to write by hand is thirty-odd
// coin flips about what to do first.
//
// Ranked on three things that are actually measurable here, and nothing else.
// There is no domain-authority number in this tool and there is not going to be
// a made-up one: every proxy I could compute from a URL (its length, its TLD,
// whether it looks like a "real" site) would be a guess dressed as a score.
//
//   1. How many errors the page carries. Three on one page is a different
//      letter from one, and it is the letter that reads as a person who read
//      the page. wisdomquotes.com with three is the strongest thing the tool
//      has produced.
//   2. How directly it can be reached. A published address beats a form, and a
//      form beats "the address is behind JavaScript, open it yourself" — which
//      is real work for the sender, so it sorts last.
//   3. Whether every entry is `certain` rather than `strong`. A correction you
//      can prove outright is a better first impression than one that rests on
//      an absence of evidence.
//
// Deliberately NOT part of the score: a platform subdomain penalty. A
// wordpress.com blog nofollows its links, so it is worth less as a link and
// exactly as much as a correction, and this tool's stated purpose is the
// correction. Sorting those down would be optimising for the link.
function sendOrder(list, allEntries) {
  const byId = new Map(allEntries.map(e => [e.id, e]));
  const score = ([, s]) => {
    const n = (s.entries || []).length;
    const contact = (s.emails && s.emails.length) ? 3 : s.form ? 2 : 1;
    const certain = (s.entries || []).every(id => (byId.get(id) || {}).confidence === 'certain');
    return n * 10 + contact * 2 + (certain ? 1 : 0) - (s.weak ? 5 : 0);
  };
  return list.slice().sort((a, b) => score(b) - score(a));
}

// The ready list as data, one object per site, for anything that needs it in a
// shape other than Markdown. Used to push rows into the Notion tracker.
//
// Shares groupReady with report() deliberately. Two implementations of "which
// sites are ready and what is the letter" would drift, and the one that drifted
// would be the one a human was working from.
function readyGroups(state) {
  // EXCLUDE applies here too. Four sites were crawled before their hosts were
  // excluded and stayed in the ready list afterwards: a Steemit post that
  // cannot be edited, a t-shirt, a Bandcamp track and a quote-image generator.
  // Handing those over as work contradicts the decision not to pursue them.
  const rows = Object.entries(state.sites)
    .filter(([u, x]) => x.targets > 0 && !EXCLUDE.some(e => u.includes(e)));
  const reachable = x => (x.emails && x.emails.length) || x.form || x.page;
  const ready = rows.filter(([, x]) => !x.sent && reachable(x));
  const list = det.loadMisattributions();

  const byHost = new Map();
  for (const row of ready) {
    const k = domainKey(row[0]);
    if (!byHost.has(k)) byHost.set(k, []);
    byHost.get(k).push(row);
  }
  const groups = [...byHost.entries()].map(([host, rs]) => {
    // isJunk again here, not only where the address was found. State holds
    // addresses scraped before a rule existed: support@pencidesign.com, a
    // WordPress theme vendor, was already sitting in it when that rule landed.
    const emails = [...new Set(rs.flatMap(([, x]) => x.emails || []))].filter(a => !isJunk(a));
    const merged = {
      entries: [...new Set(rs.flatMap(([, x]) => x.entries || []))],
      emails,
      form: (rs.find(([, x]) => x.form) || [, {}])[1].form || null,
      page: (rs.find(([, x]) => x.page) || [, {}])[1].page || null,
      weak: rs.some(([, x]) => x.weak),
    };
    return { host, rows: rs, merged };
  });

  const ranked = sendOrder(groups.map(g => [g.host, g.merged]), list);
  const rank = new Map(ranked.map((r, i) => [r[0], i]));
  groups.sort((a, b) => rank.get(a.host) - rank.get(b.host));

  return groups.map((g, i) => ({
    site: g.host,
    priority: groups.length - i,
    errors: g.merged.entries.length,
    pages: g.rows.length,
    urls: g.rows.map(([u]) => u),
    entries: g.merged.entries,
    weak: g.merged.weak,
    contact: g.merged.emails.length ? g.merged.emails.join(', ')
      : g.merged.form ? g.merged.form : g.merged.page,
    reach: g.merged.emails.length ? 'email' : g.merged.form ? 'form' : 'open by hand',
    letter: letterForDomain(g.rows),
  }));
}

function report(state) {
  // Built on readyGroups, not a second copy of the same grouping. The two had
  // already drifted: readyGroups filtered out hosts we cannot act on and this
  // did not, so `report` said 52 sites ready while `export` said 49 from the
  // same state. Having claimed that sharing the logic prevented exactly this,
  // I had left a duplicate in place that proved otherwise.
  const groups = readyGroups(state);

  const visible = ([u]) => !EXCLUDE.some(e => u.includes(e));
  const rows = Object.entries(state.sites).filter(([u, x]) => x.targets > 0 && visible([u]));
  const reachable = x => (x.emails && x.emails.length) || x.form || x.page;
  const noContact = rows.filter(([, x]) => !x.sent && !reachable(x));
  const done = rows.filter(([, x]) => x.sent);
  const readyPages = groups.reduce((n, g) => n + g.pages, 0);

  const out = ['# Outreach', '',
    `${groups.length} site(s) ready to send, across ${readyPages} page(s).`,
    `${noContact.length} page(s) with no contact found, ${done.length} already sent.`,
    `${Object.keys(state.candidates).length} candidate page(s) known.`, ''];

  if (groups.length) {
    out.push('## Ready', '',
      groups.length + ' site(s), best first. See sendOrder for what that means.', '');
    for (const g of groups) {
      out.push('### ' + g.site);
      out.push('- Contact: ' + (g.reach === 'email' ? g.contact
        : g.reach === 'form' ? 'form at ' + g.contact
        : 'contact page at ' + g.contact + ' (address is rendered by JavaScript, open it)'));
      out.push('- Pages: ' + g.pages + '   Entries: ' + g.entries.join(', ') +
        (g.weak ? '  **short phrase, confirm by eye**' : '') +
        (g.errors > 1 ? '   (' + g.errors + ' errors)' : ''));
      for (const u of g.urls) out.push('  - ' + u);
      out.push('', '```', g.letter, '```', '');
      out.push('Mark done:  `node scripts/outreach.js sent ' + g.site + '`', '');
    }
  }
  if (noContact.length) {
    out.push('## No published contact address', '');
    for (const [url, x] of noContact) out.push('- ' + url + '  (' + (x.entries || []).join(', ') + ')');
    out.push('');
  }
  if (done.length) {
    out.push('## Sent', '');
    for (const [url, x] of done) out.push('- ' + url + '  ' + (x.sentAt || '').slice(0, 10));
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
    const what = argv[1];
    if (!what) { console.error('usage: outreach.js sent <host-or-url>'); process.exit(1); }
    // A hostname marks every affected page on that site, because one letter
    // now covers all of them. Marking only the URL that happened to be listed
    // would leave the others to resurface as unsent in the next report.
    const exact = state.sites[what] ? [what] : [];
    const byHost = exact.length ? exact : Object.keys(state.sites)
      .filter(u => domainKey(u) === what.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, ''))
      .filter(u => (state.sites[u].targets || 0) > 0);
    if (!byHost.length) { console.error('Nothing in state for: ' + what); process.exit(1); }
    for (const u of byHost) {
      state.sites[u].sent = true;
      state.sites[u].sentAt = new Date().toISOString();
    }
    saveState(state);
    console.error('Marked sent: ' + byHost.length + ' page(s)');
    for (const u of byHost) console.error('  ' + u);
    return;
  }
  if (cmd === 'run') {
    await run(state, opts);
    fs.writeFileSync(opts.out, report(state) + '\n', 'utf8');
    console.error('\nWrote ' + opts.out);
    return;
  }
  // Rewrite outreach.md from state without touching the network. The letters
  // are derived from the stored entry ids, so this is how a change to the
  // wording reaches pages that were already crawled: after the per-error
  // letters were replaced with one per site, the file on disk still held the
  // old ones, and only a full re-crawl would have refreshed it.
  // JSON on stdout, for pushing into the tracker. Deliberately not a Notion
  // client: the credentials for that are not in this repo and a script that
  // could write to the workspace unattended is a bigger thing than this needs.
  if (cmd === 'export') {
    process.stdout.write(JSON.stringify(readyGroups(state), null, 2) + '\n');
    return;
  }
  if (cmd === 'report') {
    fs.writeFileSync(opts.out, report(state) + '\n', 'utf8');
    console.error('Wrote ' + opts.out + ' from state. No pages were fetched.');
    return;
  }
  // status
  console.log(report(state));
}

module.exports = { draft, draftForSite, numberWord, wrapIndented, letterForDomain, queryFor, findContact, allowed, EXCLUDE, report, loadState, isJunk, isTerminal, PERMANENT, DISCUSSION_TERMS, selectPending, QUERY_VERSION, queryVariants, phraseOf, sendOrder, DELIBERATELY_INCLUDED, draftForDomain, domainKey, entryBlock, readyGroups };
if (require.main === module) main();
