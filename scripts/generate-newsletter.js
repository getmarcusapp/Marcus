#!/usr/bin/env node
// Daily Meditations — Newsletter Generator
// Usage: ANTHROPIC_KEY=sk-ant-... [BEEHIIV_KEY=... BEEHIIV_PUB_ID=...] node scripts/generate-newsletter.js

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ANTHROPIC_KEY = process.env.ANTHROPIC_KEY;
const BEEHIIV_KEY = process.env.BEEHIIV_KEY;
// Beehiiv publication IDs are always `pub_<uuid>`. The dashboard sometimes shows
// the bare UUID, and the API rejects it (400 INVALID_PATTERN). Normalize so
// either form works, whether set here or as a CI secret.
const BEEHIIV_PUB_ID_RAW = process.env.BEEHIIV_PUB_ID;
const BEEHIIV_PUB_ID = (BEEHIIV_PUB_ID_RAW && !BEEHIIV_PUB_ID_RAW.startsWith('pub_'))
  ? 'pub_' + BEEHIIV_PUB_ID_RAW
  : BEEHIIV_PUB_ID_RAW;

// Optional: email the rendered draft to Gio each run as a review prompt — the
// nudge to go into Beehiiv and edit/schedule it. All three must be set to send;
// if any is missing, emailing is skipped silently (the Beehiiv draft + disk
// fallback still happen). MAIL_PASS is a Gmail App Password, not the account
// password. Requires nodemailer (see scripts/package.json), loaded lazily so
// the generator still runs for anyone who doesn't email.
const MAX_ATTEMPTS = 3;
const MAIL_USER = process.env.MAIL_USER;
const MAIL_PASS = process.env.MAIL_PASS;
const MAIL_TO = process.env.MAIL_TO || MAIL_USER;

// How many days ahead this edition is for. 0 = today (generate + send same day);
// 1 = tomorrow (generate the evening before, review + schedule it in Beehiiv for
// the next morning). The workflow sets this to 1.
const EDITION_LEAD_DAYS = parseInt(process.env.EDITION_LEAD_DAYS || '0', 10);

if (!ANTHROPIC_KEY) { console.error('Missing ANTHROPIC_KEY'); process.exit(1); }

// The edition's target date, computed in Pacific time so the calendar date is
// correct no matter when (in UTC) the CI job runs — an evening-PT cron fires in
// the early-UTC hours of the next day, so we can't rely on the runner's UTC date.
// With EDITION_LEAD_DAYS=1 this returns tomorrow-in-Pacific. { iso, display }.
function editionDate() {
  const inst = new Date(Date.now() + EDITION_LEAD_DAYS * 86400000);
  const iso = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(inst);
  const display = inst.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/Los_Angeles',
  });
  return { iso, display };
}

const RESERVE_PATH = path.join(__dirname, 'reserve-editions.json');

// Which model writes the edition. Opus is the default because this is a hard
// brief — find a real event from the last seven days, tie it to a Stoic idea
// without being trite, avoid the lanes the system prompt bans, and not repeat
// recent editions — and the output goes out under Gio's name.
//
// It is also the single largest recurring AI cost in the project: one Opus call
// a day, forever, independent of how many app users there are. So it is worth
// knowing whether a cheaper model holds the register.
//
// Set NEWSLETTER_MODEL to A/B it, e.g.
//     NEWSLETTER_MODEL=claude-sonnet-4-6 node scripts/generate-newsletter.js
// Run a week, then read those editions against recent Opus ones in
// content/editions/ — each record stores the model that wrote it. Judge on the
// hook: if the cheaper model reaches for the generic "new study finds" opening
// the system prompt exists to prevent, the premium is buying something real.
const MODEL = process.env.NEWSLETTER_MODEL || 'claude-opus-4-8';

const SYSTEM_PROMPT = `You are the editor of Daily Meditations, a daily newsletter rooted in Stoic philosophy. Your role is to produce one edition per day in the following format:

THEME: [2–4 words. e.g. "On anger" or "On impermanence"]

QUOTE: [Exactly ONE real, verified quote with its author and source, on a single line, formatted "the quote" — Author, Work. Never fabricate quotes or present a paraphrase as a direct quote. Decide the quote privately: the output must contain only the final chosen quote — never list alternatives, show your selection process, second-guess an attribution, or write phrases like "I'll use...", "attribution disputed", or "let me choose one I can render exactly".]

CONTEXT: [Two short paragraphs. The first situates the quote historically — what was happening in the life of the person who wrote it, what world they were navigating, what problem they were solving. Do NOT open with the stock biographical scene-setting: Marcus writing in army camps along the Danube, Marcus writing for no reader but himself, Seneca writing late in life after Nero pushed him from court, Epictetus born a slave in Phrygia. Those four openings account for roughly half of all editions published so far and they are exhausted. The reader knows who these people were. Open instead on the specific occasion of THIS passage: the argument it answers, the person it was addressed to, the decision it was written under, or the thing it contradicts elsewhere in the same work. The second draws a direct, unforced connection to contemporary life. No forced analogies. No corporate wellness language. No productivity framing. Write as a scholar who cares about ideas, not as a self-help author.]

THE QUESTION: [One sentence. A genuine question — not rhetorical, not obvious — that the reader can carry through the day.]

FACT-VALIDATION RULES (non-negotiable, highest priority):
- The current event referenced in CONTEXT must come from an actual web_search result in THIS generation run. Never reference a news event from memory or assumption. If web_search returned nothing usable that connects to a genuine Stoic theme, fall back to a timeless edition with NO current-event hook rather than inventing or half-remembering one.
- You must output the exact source URL for the current event in a SOURCE_URL field (see format). The URL must be one that actually appeared in your web_search/web_fetch results this run, copied verbatim. Never construct, guess, complete, or modify a URL.
- The event must have occurred or come back into public attention within the past 7 days. Older stories are out of bounds even if they fit thematically — fall back to a timeless edition rather than reach for a month-old hook.
- Reference the timing with editorial restraint. "This week," "today," "yesterday," or the specific date are all acceptable — pick whichever fits the sentence. Avoid "Recently" as a hedge.
- Do not state any specific factual claim about the event (who, what, where, when, numbers) that is not directly supported by the fetched source text. When unsure of a detail, describe the event more generally rather than risk a wrong specific.
- The Stoic quote must be real, verbatim, and correctly attributed to a real work. If you cannot recall the exact wording with confidence, choose a different quote you can render exactly. Never paraphrase and present it as a direct quote.
- Prefer one clean, verifiable hook over a vivid but shaky one. Accuracy outranks resonance every time. A boring true edition beats an exciting wrong one.
- If forced to choose between hitting the daily cadence and getting a fact right, get the fact right. A skipped or timeless edition is recoverable; a fabricated fact damages the only thing the topical angle is selling: trust.

OUTPUT FORMAT — add this field after THE QUESTION whenever a current event is used:

SOURCE_URL: [the exact, verbatim URL from this run's search results that supports the event referenced in CONTEXT. Omit this field ONLY for a timeless edition with no current-event hook.]

Style rules:
- Prose is direct, unhurried, and precise. Short sentences where possible.
- No em dashes used as definitions (e.g. "courage — the ability to..."). Use colons instead.
- No words like "delve," "tapestry," "nuanced," "resonate," "journey," or "transformative."
- No bullet points. No headers beyond the format fields above.
- Draw from: Marcus Aurelius (Meditations), Epictetus (Discourses, Enchiridion), Seneca (Letters, Essays), Musonius Rufus, Cato, and adjacent thinkers whose work carries Stoic insight (Viktor Frankl, Montaigne, James Stockdale).
- Each edition should feel complete on its own — no callbacks to previous editions.
- Total word count: 200–250 words.

POLITICAL / SENSITIVE-CONTENT GUARDRAIL:
- Avoid active military conflicts, wars, partisan political fights, elections, and contested foreign policy as the hook, even when they dominate the day's headlines. They invite a "hot take" the newsletter must never produce, and they alienate readers across the spectrum. When the day's news is dominated by conflict, fall back to a timeless edition.

TOPIC VARIETY (important):
- Draw hooks from the full breadth of human life, and vary the domain from one day to the next. Strong territory: arts and culture, literature and publishing, music, film and theatre, sport, business and economics, history and anniversaries, human-interest stories, notable lives and deaths, architecture and design, food, travel, law, medicine and public health, education, and real developments in ideas.
- Do NOT default to astronomy, space, deep-sea or ocean discovery, or generic "new study finds" science hooks. That lane has been badly overused. Reach for space or science only when it is clearly the most resonant option that day AND the recent editions listed in the prompt have not already used it; otherwise choose a more human, cultural, or historical event.
- A grounded human hook (a book, a performance, an anniversary, a life, a decision in the culture) is almost always a better vehicle for Stoic reflection than another cosmic-scale science headline.`;

function httpsPost(hostname, path, headers, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request(
      { hostname, path, method: 'POST', headers: { ...headers, 'Content-Length': Buffer.byteLength(data) } },
      (res) => {
        let raw = '';
        res.on('data', c => raw += c);
        res.on('end', () => {
          try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
          catch (e) { resolve({ status: res.statusCode, body: raw }); }
        });
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function extractText(content) {
  if (!Array.isArray(content)) return '';
  return content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
}

// Normalize whitespace before sentence punctuation. opus-4-8 occasionally emits
// a stray newline (or space) right before a period, especially in the fact-dense
// current-event sentence (e.g. "two weeks\n."). HTML collapses that to a visible
// "two weeks .". This strips whitespace before .,;:!? without touching the \n\n
// paragraph breaks (those are followed by a letter, not punctuation).
function cleanText(s) {
  return String(s || '').replace(/[ \t\n\r]+([.,;:!?])/g, '$1');
}

// Backstop for the QUOTE field: if the model ever dumps its quote-selection
// reasoning (multiple candidates, repeated "QUOTE:"/"THEME:" labels, "I'll
// use..." asides) instead of one line, keep only the final chosen quote — the
// text after the LAST "QUOTE:" label, with any leftover field-label lines
// stripped. The prompt forbids this, but model output is unpredictable and a
// garbled/wrong quote is the one failure this newsletter must never ship.
function cleanQuote(s) {
  let q = String(s || '');
  const i = q.lastIndexOf('QUOTE:');
  if (i >= 0) q = q.slice(i + 'QUOTE:'.length);
  q = q.replace(/^\s*(THEME|QUOTE|CONTEXT|THE QUESTION|SOURCE_URL)\s*:.*$/gim, '');
  return q.trim();
}

function parseEdition(text) {
  return {
    theme:    cleanText((text.match(/THEME:\s*(.+)/)?.[1] || '').trim()),
    quote:    cleanText(cleanQuote((text.match(/QUOTE:\s*([\s\S]+?)(?=\n\nCONTEXT:)/)?.[1] || '').trim())),
    context:  cleanText((text.match(/CONTEXT:\s*([\s\S]+?)(?=\n\nTHE QUESTION:)/)?.[1] || '').trim()),
    // Stop THE QUESTION at SOURCE_URL if present so the URL doesn't leak
    // into the question text. Falls back to end-of-text when no SOURCE_URL
    // line follows (timeless editions).
    question: cleanText((text.match(/THE QUESTION:\s*([\s\S]+?)(?=\n\nSOURCE_URL:|$)/)?.[1] || '').trim()),
    // SOURCE_URL is optional. A timeless edition (no current-event hook)
    // legitimately omits it — verifySource() treats null as TIMELESS.
    sourceUrl: (text.match(/SOURCE_URL:\s*(\S+)/)?.[1] || '').trim() || null,
  };
}

// Extract the hostname from a URL for display in the source-link footer.
// Falls back to the raw URL if parsing fails so we never lose attribution.
function hostnameFromUrl(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); }
  catch (e) { return url; }
}

// Convert stray markdown emphasis (*title* / _title_) to real <em>. opus-4-8
// sometimes italicizes work titles in markdown; without this the asterisks
// render literally in the email (e.g. "*On the Shortness of Life*").
function md(s) {
  return String(s || '')
    .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
    .replace(/_([^_\n]+)_/g, '<em>$1</em>');
}

function buildHtml(edition, dateStr) {
  const parts = edition.context.split('\n\n');
  const para1 = md(parts[0] || '');
  const para2 = md(parts[1] || '');
  // Footer source line — rendered only for current-event editions (those
  // with a verified SOURCE_URL). Timeless editions skip it cleanly. The
  // link gives readers the option to verify the hook for themselves,
  // which is what trust in a topical newsletter actually rests on.
  const sourceFooter = edition.sourceUrl
    ? '<p style="font-size:11px;color:#999;margin-top:40px;border-top:1px solid #eee;padding-top:20px;margin-bottom:8px;">Source: <a href="' + edition.sourceUrl + '" style="color:#c9a84c;text-decoration:none;">' + hostnameFromUrl(edition.sourceUrl) + ' →</a></p>'
    : '';
  const brandFooter = '<p style="font-size:11px;color:#bbb;' + (edition.sourceUrl ? 'margin-top:0;' : 'margin-top:48px;border-top:1px solid #f0f0f0;padding-top:20px;') + '">Daily Meditations is a companion to <a href="https://www.getmarcus.app" style="color:#c9a84c;text-decoration:none;">Marcus</a>, a Stoic practice app.</p>';
  return '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>' +
    '<body style="font-family:Georgia,serif;max-width:560px;margin:0 auto;padding:40px 20px;color:#1a1a1a;line-height:1.7;background:#fff;">' +
    '<p style="font-size:11px;color:#999;letter-spacing:2px;text-transform:uppercase;margin-bottom:32px;">Daily Meditations &middot; ' + dateStr + '</p>' +
    '<h2 style="font-size:12px;font-weight:400;color:#999;letter-spacing:2px;text-transform:uppercase;margin-bottom:24px;">' + edition.theme + '</h2>' +
    '<blockquote style="border-left:2px solid #c9a84c;margin:0 0 28px;padding-left:20px;font-style:italic;font-size:17px;color:#2a2a2a;line-height:1.8;">' + md(edition.quote) + '</blockquote>' +
    '<p style="font-size:15px;margin-bottom:16px;">' + para1 + '</p>' +
    '<p style="font-size:15px;margin-bottom:28px;">' + para2 + '</p>' +
    '<p style="font-size:14px;color:#666;font-style:italic;border-top:1px solid #eee;padding-top:20px;">' + md(edition.question) + '</p>' +
    sourceFooter +
    brandFooter +
    '</body></html>';
}

// ─── Verification layer ──────────────────────────────────────────────────
// This is the mechanical safety net behind the prompt. Layer 1 (prompt)
// instructs the model to output a SOURCE_URL; layer 2 (here) fetches that
// URL and verifies it actually supports the CONTEXT before we ever stage
// a draft. A single fabricated source destroys the trust the product is
// built on, so we never publish an unverified current-event edition.

function httpsGet(url, maxRedirects) {
  if (maxRedirects === undefined) maxRedirects = 5;
  return new Promise(function (resolve, reject) {
    function go(currentUrl, remaining) {
      let parsed;
      try { parsed = new URL(currentUrl); } catch (e) { return reject(e); }
      const isHttps = parsed.protocol === 'https:';
      const lib = isHttps ? https : http;
      const req = lib.request({
        hostname: parsed.hostname,
        port: parsed.port || (isHttps ? 443 : 80),
        path: (parsed.pathname || '/') + (parsed.search || ''),
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        timeout: 10000,
      }, function (res) {
        const isRedirect = [301, 302, 303, 307, 308].indexOf(res.statusCode) !== -1;
        if (isRedirect && res.headers.location && remaining > 0) {
          const next = new URL(res.headers.location, currentUrl).toString();
          res.resume();
          return go(next, remaining - 1);
        }
        let raw = '';
        res.on('data', function (c) { raw += c; });
        res.on('end', function () { resolve({ status: res.statusCode, body: raw, finalUrl: currentUrl }); });
      });
      req.on('timeout', function () { req.destroy(new Error('Request timeout after 10s')); });
      req.on('error', reject);
      req.end();
    }
    go(url, maxRedirects);
  });
}

function extractVisibleText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim();
}

const STOPWORDS = new Set([
  'the','a','an','and','or','but','if','while','of','in','on','at','to','for','with','by','from','as','is','are','was','were','be','been','being','have','has','had','do','does','did','will','would','should','could','may','might','must','shall','can','this','that','these','those','they','them','their','there','here','his','her','its','our','your','what','when','where','why','how','who','which','whose','whom','all','any','some','not','only','own','same','than','too','very','just','now','said','one','two','three','four','five','six','seven','eight','nine','ten','after','again','against','because','before','between','during','into','through','under','about','across','over','down','off','above','below','further','then','once','each','more','most','other','such','also','still','already','away','back','even','ever','well','many','much','take','took','give','gave','find','found','seems','seemed','says','told','tell','told',
]);

function extractKeywords(contextText, max) {
  if (max === undefined) max = 8;
  // Per the canonical prompt, CONTEXT paragraph 1 is the HISTORICAL setup
  // of the Stoic quote (Corsica, Rome, Paulinus, etc.) and paragraph 2 is
  // the contemporary current-event hook. We want keywords from para 2 —
  // that's what the source URL should actually contain. Falls back to
  // paragraph 1 / full text when there's only one paragraph (timeless or
  // malformed) so verification can still run with whatever's available.
  const paras = contextText.split('\n\n').map(function (p) { return p.trim(); }).filter(Boolean);
  const newsText = paras[1] || paras[0] || contextText;

  // Split on sentence delimiters so we can distinguish sentence-start
  // capitals (often common words: "The", "A") from mid-sentence capitals
  // (usually proper nouns: place names, people, organizations).
  const sentences = newsText.split(/[.!?]\s+/);

  const properNouns = new Set();
  const otherTokens = new Map();

  for (const sentence of sentences) {
    const tokens = sentence.match(/[A-Za-z][A-Za-z'-]*/g) || [];
    tokens.forEach(function (tok, idx) {
      const lower = tok.toLowerCase();
      if (STOPWORDS.has(lower) || lower.length < 4) return;
      const isCapital = /^[A-Z]/.test(tok);
      if (isCapital && idx > 0) {
        properNouns.add(lower);
      } else if (lower.length >= 5) {
        otherTokens.set(lower, (otherTokens.get(lower) || 0) + 1);
      }
    });
  }

  // Build the final keyword list: proper nouns first, then fill with the
  // most-frequent / longest distinctive non-cap words up to max.
  const keywords = [...properNouns];
  if (keywords.length < max) {
    const fillers = [...otherTokens.entries()]
      .sort(function (a, b) { return b[1] - a[1] || b[0].length - a[0].length; })
      .map(function (e) { return e[0]; })
      .filter(function (w) { return !properNouns.has(w); });
    for (const f of fillers) {
      if (keywords.length >= max) break;
      keywords.push(f);
    }
  }
  return keywords.slice(0, max);
}

async function verifySource(url, contextText) {
  let res;
  try {
    res = await httpsGet(url);
  } catch (e) {
    return { ok: false, status: 0, matchedKeywords: [], totalKeywords: 0, reason: 'Fetch failed: ' + e.message };
  }
  if (res.status !== 200) {
    return { ok: false, status: res.status, matchedKeywords: [], totalKeywords: 0, reason: 'HTTP ' + res.status + ' from ' + url };
  }
  const pageText = extractVisibleText(res.body || '');
  const keywords = extractKeywords(contextText);
  if (keywords.length < 4) {
    return { ok: false, status: 200, matchedKeywords: [], totalKeywords: keywords.length, reason: 'Could not extract enough CONTEXT keywords to verify (got ' + keywords.length + ', need >=4).' };
  }
  const matched = [];
  for (const kw of keywords) {
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp('\\b' + escaped + '\\b');
    if (re.test(pageText)) matched.push(kw);
  }
  const ratio = matched.length / keywords.length;
  if (ratio < 0.6) {
    const missing = keywords.filter(function (k) { return matched.indexOf(k) === -1; });
    return {
      ok: false,
      status: 200,
      matchedKeywords: matched,
      totalKeywords: keywords.length,
      reason: 'Only ' + matched.length + '/' + keywords.length + ' keywords matched (' + Math.round(ratio * 100) + '%, need >=60%). Missing: ' + missing.join(', '),
    };
  }
  return {
    ok: true,
    status: 200,
    matchedKeywords: matched,
    totalKeywords: keywords.length,
    reason: matched.length + '/' + keywords.length + ' keywords matched (' + Math.round(ratio * 100) + '%).',
  };
}

function loadReserveBank() {
  if (!fs.existsSync(RESERVE_PATH)) {
    fs.writeFileSync(RESERVE_PATH, '[]\n', 'utf8');
    console.log('NOTE: Created scripts/reserve-editions.json (empty). Populate it with timeless editions for verification-failure fallback.');
    return [];
  }
  try {
    const arr = JSON.parse(fs.readFileSync(RESERVE_PATH, 'utf8'));
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    console.error('Reserve bank parse error (treating as empty):', e.message);
    return [];
  }
}

// Load the most recent published editions (newest first) so the generator can
// steer away from angles and news domains it just used — the fix for the feed
// feeling repetitive. Reads content/editions/*.json.
function loadRecentEditions(n) {
  try {
    const dir = path.join(__dirname, '..', 'content', 'editions');
    if (!fs.existsSync(dir)) return [];
    const recs = fs.readdirSync(dir)
      .filter(f => f.endsWith('.json'))
      .map(f => { try { return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch { return null; } })
      .filter(r => r && r.isoDate);
    recs.sort((a, b) => String(b.isoDate).localeCompare(String(a.isoDate)));
    return recs.slice(0, n);
  } catch { return []; }
}

// Compact digest of recent editions for the prompt: date, theme, and the source
// host — a clean domain signal (sciencedaily.com / space.com reveal the
// science/space lane to avoid). Empty string when there's no history yet.
function recentEditionsBlock(recent) {
  if (!recent.length) return '';
  const lines = recent.map(r => {
    let host = 'timeless (no current-event hook)';
    try { if (r.sourceUrl) host = new URL(r.sourceUrl).hostname.replace(/^www\./, ''); } catch {}
    // The passage matters more than the theme: two editions went out with the
    // same quote because this digest never said which quotes were already spent.
    const passage = String(r.quote || '').replace(/\s+/g, ' ').slice(0, 90);
    return `- ${r.isoDate}: "${r.theme}" (${host})\n    passage used: ${passage}`;
  }).join('\n');
  return '\n\nRECENT EDITIONS — do not repeat these themes, angles, news domains, or passages. ' +
    'A passage listed below is spent: pick a different one, even for a similar theme. ' +
    'Deliberately choose a different lane today:\n' + lines;
}

// ─── Generation + Beehiiv helpers (extracted from run() for retry support) ──

async function generateEdition(dateStr) {
  console.log('Generating with model: ' + MODEL);
  const recentBlock = recentEditionsBlock(loadRecentEditions(45));
  const res = await httpsPost(
    'api.anthropic.com', '/v1/messages',
    { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
    {
      // opus-4-8 with the current web-search tool. web_search_20260209 has
      // built-in dynamic filtering (it runs code server-side to filter results
      // before they hit context) — do NOT also declare code_execution, that
      // confuses the model. max_tokens has headroom over the ~350-token output;
      // you only pay for what's generated, so it's free insurance vs truncation.
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools: [{ type: 'web_search_20260209', name: 'web_search' }],
      // The final instruction suppresses opus-4-8's tendency (with thinking off)
      // to narrate its search process in the visible text. parseEdition already
      // discards anything before THEME:, so this is about clean logs and not
      // wasting output tokens, not correctness.
      messages: [{ role: 'user', content: 'Generate the edition for ' + dateStr + ' — the date the reader receives it. Search for a current event first. It will usually be from the day or two before ' + dateStr + ', so refer to its timing as "this week" or "yesterday," not "today," unless the event is literally dated ' + dateStr + '. Output ONLY the edition, beginning with "THEME:" — no search narration, reasoning, or preamble before it, and no commentary after. Do not use markdown formatting such as *asterisks* or _underscores_ for emphasis; render work titles in plain text. Each field label (THEME, QUOTE, CONTEXT, THE QUESTION, SOURCE_URL) must appear exactly once, and each field must contain only its final content — never alternatives, selection reasoning, or self-correction.' + recentBlock }],
    }
  );
  if (res.status !== 200) {
    throw new Error('Anthropic error: ' + JSON.stringify(res.body, null, 2));
  }
  const text = extractText(res.body.content);
  if (!text) throw new Error('No text block in Anthropic response.');
  const edition = parseEdition(text);
  // Layer 2: the model was told not to repeat itself and did. Throwing here puts
  // the caller's existing retry loop to work generating a genuinely new edition.
  assertNotRepeat(edition, loadRecentEditions(120));
  return { text: text, edition: edition };
}

// Reject an edition that repeats one already published.
//
// The prompt has always told the model not to repeat itself, and it did anyway:
// two editions went out byte-identical, fourteen days apart, same theme, same
// passage, same context, same question. Two causes. The recent-editions digest
// only looked back ten editions, so by day fourteen the original had fallen out
// of view, and the digest listed themes and news domains but never the passage,
// so a spent quote looked unused. Both are fixed above.
//
// This is the layer that does not depend on the model cooperating. Same
// reasoning as the SOURCE_URL verification: an instruction is layer one, a check
// is layer two, and only layer two actually holds.
function assertNotRepeat(edition, history) {
  const norm = t => String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const quoteKey = t => norm(t).split(' ').slice(0, 12).join(' ');

  const theme = norm(edition.theme);
  const qk = quoteKey(edition.quote);
  for (const prev of history) {
    if (theme && theme === norm(prev.theme)) {
      throw new Error('Repeat edition: theme "' + edition.theme + '" already published ' + prev.isoDate);
    }
    if (qk && qk === quoteKey(prev.quote)) {
      throw new Error('Repeat edition: passage already used ' + prev.isoDate + ' — ' + String(prev.quote).slice(0, 70));
    }
  }
}

// Disk fallback when Beehiiv staging is unavailable (no credentials, API
// 403 from non-enterprise plans, transient errors, etc.). The HTML is
// written to scripts/out/YYYY-MM-DD.html so it's always reachable for a
// manual copy-paste into Beehiiv's UI. Same-day reruns overwrite.
function saveDraftToDisk(html, edition, dateStr, reason) {
  const outDir = path.join(__dirname, 'out');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const filePath = path.join(outDir, editionDate().iso + '.html');
  fs.writeFileSync(filePath, html, 'utf8');
  console.log('Draft saved to: ' + filePath);
  console.log('  Title:  ' + edition.theme + ' — ' + dateStr);
  if (reason) console.log('  Reason: ' + reason);
  console.log('  Next:   open in a browser, copy the rendered HTML into Beehiiv’s editor.');
}

// Edition number = how many editions have been published (one JSON per day).
// saveEditionRecord() runs before the email, so today's file is already counted.
// This is the growing "constant" in the subject line — signals cadence/longevity
// without a date, which the inbox already stamps.
function editionNumber() {
  try {
    return fs.readdirSync(path.join(__dirname, '..', 'content', 'editions'))
      .filter(f => f.endsWith('.json')).length || null;
  } catch (e) { return null; }
}

// The subject we suggest Gio use in Beehiiv. The theme is already in "On ___"
// form (a recurring, recognizable pattern); the edition number is the explicit
// daily constant. No date — the inbox timestamps it, and dates don't drive opens.
function suggestedSubject(edition) {
  const n = editionNumber();
  return n ? edition.theme + ' · №' + n : edition.theme;
}

// Preview text (the inbox preheader after the subject). The subject names the
// theme; the preview delivers the actual quote, so the inbox pair reads
// "On perspective / Constantly regard the universe as one living being…". Strips
// the attribution tail and surrounding quotes, and trims to a preview-friendly
// length (inboxes show ~90-140 chars).
function suggestedPreview(edition) {
  let q = (edition.quote || '').trim();
  q = q.replace(/\s+[—–]\s+[^—–]*$/, '').trim();      // drop " — Author, Work"
  q = q.replace(/^["'“”‘’]+|["'“”‘’]+$/g, '').trim();  // strip surrounding quotes
  if (q.length > 140) q = q.slice(0, 137).replace(/\s+\S*$/, '') + '…';
  return q;
}

// Email the rendered draft to Gio as the daily review prompt. Best-effort: a
// mail failure is logged but never fails the run — the Beehiiv draft is the
// real deliverable, this is just the nudge. `beehiivNote` describes where the
// draft ended up (staged in Beehiiv, or saved to disk) so the email tells Gio
// what to do next.
// Silence is the failure mode that actually hurt: the 2026-08-29 edition never
// existed and nobody noticed for two days, because a failed run looks exactly
// like a quiet one from the inbox. Every path that ends without a staged
// edition says so out loud.
async function emailFailure(dateStr, reason) {
  if (!(MAIL_USER && MAIL_PASS)) return;
  let nodemailer;
  try { nodemailer = require('nodemailer'); } catch (e) { return; }
  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com', port: 465, secure: true,
      auth: { user: MAIL_USER, pass: MAIL_PASS },
    });
    await transporter.sendMail({
      from: MAIL_USER, to: MAIL_TO,
      subject: 'Daily Meditations: no draft for ' + dateStr,
      text: 'No edition was staged for ' + dateStr + '.\n\n' + reason
        + '\n\nNothing was sent to Beehiiv and nothing was published to the archive.'
        + '\nRe-run the workflow from the Actions tab when you want another attempt.\n',
    });
    console.log('Failure notice emailed to ' + MAIL_TO);
  } catch (e) {
    console.warn('Could not email the failure notice: ' + e.message);
  }
}

async function emailDraft(html, edition, dateStr, beehiivNote) {
  if (!(MAIL_USER && MAIL_PASS)) return;
  let nodemailer;
  try {
    nodemailer = require('nodemailer');
  } catch (e) {
    console.warn('nodemailer not installed — skipping draft email. (npm install in scripts/)');
    return;
  }
  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com', port: 465, secure: true,
      auth: { user: MAIL_USER, pass: MAIL_PASS },
    });
    const subject = suggestedSubject(edition);
    const preview = suggestedPreview(edition);
    const banner =
      '<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:640px;margin:0 auto 20px;padding:16px 18px;background:#f7f5f2;border-radius:10px;color:#1a1a1a;">'
      + '<div style="font-weight:600;margin-bottom:6px;">Today\'s Daily Meditations draft is ready to review.</div>'
      + '<div style="font-size:14px;color:#1a1a1a;margin-bottom:6px;">Suggested subject: <strong>' + escapeHtmlText(subject) + '</strong></div>'
      + '<div style="font-size:14px;color:#1a1a1a;margin-bottom:6px;">Suggested preview: <strong>' + escapeHtmlText(preview) + '</strong></div>'
      + '<div style="font-size:14px;color:#555;">' + escapeHtmlText(beehiivNote) + ' Open Beehiiv to edit and schedule: '
      + '<a href="https://app.beehiiv.com/" style="color:#8a7254;">app.beehiiv.com</a>. The rendered edition is below.</div>'
      + '</div>';
    await transporter.sendMail({
      from: '"Daily Meditations" <' + MAIL_USER + '>',
      to: MAIL_TO,
      subject: 'Draft: ' + subject,
      html: banner + html,
    });
    console.log('Draft emailed to ' + MAIL_TO + '.');
  } catch (e) {
    console.warn('Draft email failed (non-fatal): ' + e.message);
  }
}

// Minimal HTML-escape for the plain-text banner strings (theme/note), so a
// stray < or & in an edition theme can't break the email markup.
function escapeHtmlText(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function slugify(s) {
  return String(s || 'edition').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'edition';
}

// Persist the structured edition to content/editions/<date>.json. The archive
// builder renders these into SEO pages at getmarcus.app/meditations. This is the
// auto-publish half of the "auto-publish + veto" model: every delivered edition
// is archived. To veto one, delete its JSON and rebuild the archive.
function saveEditionRecord(edition, dateStr) {
  const iso = editionDate().iso;
  const dir = path.join(__dirname, '..', 'content', 'editions');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const record = {
    isoDate: iso,
    displayDate: dateStr,
    slug: iso + '-' + slugify(edition.theme),
    theme: edition.theme,
    quote: edition.quote,
    context: edition.context,
    question: edition.question,
    sourceUrl: edition.sourceUrl || null,
  };
  fs.writeFileSync(path.join(dir, iso + '.json'), JSON.stringify(record, null, 2) + '\n', 'utf8');
  console.log('Edition record saved: content/editions/' + iso + '.json');
}

async function postToBeehiiv(edition, dateStr) {
  saveEditionRecord(edition, dateStr);
  const html = buildHtml(edition, dateStr);

  if (!(BEEHIIV_KEY && BEEHIIV_PUB_ID)) {
    saveDraftToDisk(html, edition, dateStr, 'Beehiiv credentials not set.');
    await emailDraft(html, edition, dateStr, 'Beehiiv credentials were not set, so it was saved to disk instead.');
    return;
  }

  console.log('Posting draft to Beehiiv...');
  const bRes = await httpsPost(
    'api.beehiiv.com', '/v2/publications/' + BEEHIIV_PUB_ID + '/posts',
    { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + BEEHIIV_KEY },
    { title: edition.theme + ' — ' + dateStr, subject: edition.theme + ' — ' + dateStr, content: { free: { web: html, email: html } }, status: 'draft', authors: [{ name: 'Gio' }] }
  );
  if (bRes.status === 201 || bRes.status === 200) {
    console.log('Draft created in Beehiiv.');
    await emailDraft(html, edition, dateStr, 'A draft was staged in Beehiiv.');
    return;
  }
  // Beehiiv's post-creation API is Enterprise-only. On lower plans it 403s with
  // SEND_API_NOT_ENTERPRISE_PLAN — expected, not a failure. Say so plainly and
  // fall through to email/disk, which is the intended delivery on those plans.
  const notEnterprise = bRes.status === 403
    && JSON.stringify(bRes.body || '').includes('SEND_API_NOT_ENTERPRISE_PLAN');
  if (notEnterprise) {
    console.log('Beehiiv post API needs an Enterprise plan — delivering via email/disk instead (expected on your plan).');
    saveDraftToDisk(html, edition, dateStr, 'Beehiiv API is Enterprise-only; paste the edition below into Beehiiv by hand.');
    await emailDraft(html, edition, dateStr, 'Beehiiv auto-staging needs Enterprise, so paste the edition below into Beehiiv by hand.');
    return;
  }
  // Any other non-2xx — log verbatim and fall back so nothing is lost.
  console.error('Beehiiv error:', bRes.status, JSON.stringify(bRes.body));
  saveDraftToDisk(html, edition, dateStr, 'Beehiiv returned HTTP ' + bRes.status + '.');
  await emailDraft(html, edition, dateStr, 'Beehiiv staging failed (HTTP ' + bRes.status + '), so paste the edition below into Beehiiv by hand.');
}

async function run() {
  const dateStr = editionDate().display;
  console.log('Generating edition for', dateStr, '...\n');

  // Three attempts: an initial generation plus two regenerations. Both gates
  // an edition has to clear (source verification and the no-repeat check) are
  // probabilistic, and one retry was not enough cover for two of them: on
  // 2026-08-31 attempt one failed verification and attempt two drew a passage
  // used twelve days earlier, which was the whole budget. After the last
  // attempt we fall back to the reserve bank. We never stage an unverified
  // current-event edition.
  let attempt = 1;
  while (attempt <= MAX_ATTEMPTS) {
    let g;
    try {
      g = await generateEdition(dateStr);
    } catch (e) {
      // A repeat is a bad DRAFT, not a broken run. This used to exit(1) right
      // here, which walked past both the retry below and the reserve bank
      // underneath it, so the guard that fires most often was also the one
      // that guaranteed no edition at all and no email. assertNotRepeat's own
      // comment says throwing "puts the caller's existing retry loop to work";
      // it never did. Burn the attempt and go round again, same as a failed
      // verification.
      console.error(e.message);
      attempt++;
      if (attempt <= MAX_ATTEMPTS) console.log('\nRegenerating (attempt ' + attempt + ' of ' + MAX_ATTEMPTS + ')...');
      continue;
    }
    const text = g.text;
    const edition = g.edition;

    const heading = attempt === 1
      ? '--- Generated edition ---'
      : '--- Regenerated edition (attempt ' + attempt + ' of ' + MAX_ATTEMPTS + ') ---';
    console.log('\n' + heading + '\n');
    console.log(text);
    console.log('\n---\n');

    // Timeless edition \u2014 no current-event hook, nothing to verify. Per
    // spec: this is a legitimate state and we proceed to staging.
    if (!edition.sourceUrl) {
      const status = attempt === 1
        ? 'TIMELESS (no current-event hook)'
        : 'TIMELESS on retry (no current-event hook)';
      console.log(status);
      await postToBeehiiv(edition, dateStr);
      console.log('\nResult: ' + status);
      console.log('Done.');
      return;
    }

    // Current-event edition \u2014 run the verification gate.
    console.log('Verifying source: ' + edition.sourceUrl);
    const verification = await verifySource(edition.sourceUrl, edition.context);
    if (verification.ok) {
      const status = (attempt === 1 ? 'VERIFIED \u2713' : 'VERIFIED \u2713 on retry')
        + ' (source: ' + edition.sourceUrl + ', ' + verification.reason + ')';
      console.log(status);
      await postToBeehiiv(edition, dateStr);
      console.log('\nResult: ' + status);
      console.log('Done.');
      return;
    }

    console.error('Verification failed: ' + verification.reason);
    attempt++;
    if (attempt <= MAX_ATTEMPTS) console.log('\nRegenerating (attempt ' + attempt + ' of ' + MAX_ATTEMPTS + ')...');
  }

  // Every attempt failed. Fall back to the reserve bank.
  console.log('\nFalling back to reserve bank...');
  const reserves = loadReserveBank();
  if (reserves.length === 0) {
    console.error('VALIDATION FAILED \u2014 no edition staged. Manual review required.');
    console.error('Reserve bank at scripts/reserve-editions.json is empty. Populate it with timeless editions to enable automatic fallback.');
    await emailFailure(dateStr, 'Every attempt failed and the reserve bank at scripts/reserve-editions.json is empty, so nothing was staged.');
    console.log('\nResult: FAILED');
    process.exit(2);
  }

  const picked = reserves[Math.floor(Math.random() * reserves.length)];
  // Reserve editions store quote + attribution as separate fields for
  // clarity. Generated editions bake the attribution into the QUOTE string
  // (per the prompt). Merge them here so buildHtml renders both the same
  // way regardless of which path produced the edition.
  const staged = picked.attribution && !picked.quote.includes(picked.attribution)
    ? Object.assign({}, picked, { quote: picked.quote + ' — ' + picked.attribution })
    : picked;
  console.log('Used reserve edition: ' + picked.theme);
  await postToBeehiiv(staged, dateStr);
  console.log('\nResult: RESERVE USED (theme: ' + picked.theme + ')');
  console.log('Done.');
}

// A crash used to log and fall off the end, which exits 0. The workflow then
// ran its remaining steps, found nothing to commit, and reported success, so a
// dead generator looked exactly like a quiet day.
run().catch(async e => {
  console.error(e && e.stack ? e.stack : e);
  try { await emailFailure(editionDate().display, String((e && e.message) || e)); } catch {}
  process.exit(1);
});
