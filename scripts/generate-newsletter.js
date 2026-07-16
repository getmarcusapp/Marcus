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
const MAIL_USER = process.env.MAIL_USER;
const MAIL_PASS = process.env.MAIL_PASS;
const MAIL_TO = process.env.MAIL_TO || MAIL_USER;

if (!ANTHROPIC_KEY) { console.error('Missing ANTHROPIC_KEY'); process.exit(1); }

const RESERVE_PATH = path.join(__dirname, 'reserve-editions.json');

const SYSTEM_PROMPT = `You are the editor of Daily Meditations, a daily newsletter rooted in Stoic philosophy. Your role is to produce one edition per day in the following format:

THEME: [2–4 words. e.g. "On anger" or "On impermanence"]

QUOTE: [A real, verified quote from a Stoic philosopher or a thinker whose work carries genuine Stoic insight. Include the author and source. Never fabricate quotes or attribute paraphrases as direct quotes.]

CONTEXT: [Two short paragraphs. The first situates the quote historically — what was happening in the life of the person who wrote it, what world they were navigating, what problem they were solving. The second draws a direct, unforced connection to contemporary life. No forced analogies. No corporate wellness language. No productivity framing. Write as a scholar who cares about ideas, not as a self-help author.]

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
- Avoid active military conflicts, wars, partisan political fights, elections, and contested foreign policy as the hook, even when they dominate the day's headlines. They invite a "hot take" the newsletter must never produce, and they alienate readers across the spectrum.
- Strongly prefer apolitical hooks: science and discovery, space, history, sport, technology, the natural world, human-interest stories. When the day's news is dominated by conflict, fall back to a timeless edition.`;

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

function parseEdition(text) {
  return {
    theme:    (text.match(/THEME:\s*(.+)/)?.[1] || '').trim(),
    quote:    (text.match(/QUOTE:\s*([\s\S]+?)(?=\n\nCONTEXT:)/)?.[1] || '').trim(),
    context:  (text.match(/CONTEXT:\s*([\s\S]+?)(?=\n\nTHE QUESTION:)/)?.[1] || '').trim(),
    // Stop THE QUESTION at SOURCE_URL if present so the URL doesn't leak
    // into the question text. Falls back to end-of-text when no SOURCE_URL
    // line follows (timeless editions).
    question: (text.match(/THE QUESTION:\s*([\s\S]+?)(?=\n\nSOURCE_URL:|$)/)?.[1] || '').trim(),
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

// ─── Generation + Beehiiv helpers (extracted from run() for retry support) ──

async function generateEdition(dateStr) {
  const res = await httpsPost(
    'api.anthropic.com', '/v1/messages',
    { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
    {
      // opus-4-8 with the current web-search tool. web_search_20260209 has
      // built-in dynamic filtering (it runs code server-side to filter results
      // before they hit context) — do NOT also declare code_execution, that
      // confuses the model. max_tokens has headroom over the ~350-token output;
      // you only pay for what's generated, so it's free insurance vs truncation.
      model: 'claude-opus-4-8',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools: [{ type: 'web_search_20260209', name: 'web_search' }],
      // The final instruction suppresses opus-4-8's tendency (with thinking off)
      // to narrate its search process in the visible text. parseEdition already
      // discards anything before THEME:, so this is about clean logs and not
      // wasting output tokens, not correctness.
      messages: [{ role: 'user', content: 'Generate today\'s edition. Today is ' + dateStr + '. Search for a current event first. Output ONLY the edition, beginning with "THEME:" — no search narration, reasoning, or preamble before it, and no commentary after. Do not use markdown formatting such as *asterisks* or _underscores_ for emphasis; render work titles in plain text.' }],
    }
  );
  if (res.status !== 200) {
    throw new Error('Anthropic error: ' + JSON.stringify(res.body, null, 2));
  }
  const text = extractText(res.body.content);
  if (!text) throw new Error('No text block in Anthropic response.');
  return { text: text, edition: parseEdition(text) };
}

// Disk fallback when Beehiiv staging is unavailable (no credentials, API
// 403 from non-enterprise plans, transient errors, etc.). The HTML is
// written to scripts/out/YYYY-MM-DD.html so it's always reachable for a
// manual copy-paste into Beehiiv's UI. Same-day reruns overwrite.
function saveDraftToDisk(html, edition, dateStr, reason) {
  const outDir = path.join(__dirname, 'out');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const filePath = path.join(outDir, today + '.html');
  fs.writeFileSync(filePath, html, 'utf8');
  console.log('Draft saved to: ' + filePath);
  console.log('  Title:  ' + edition.theme + ' — ' + dateStr);
  if (reason) console.log('  Reason: ' + reason);
  console.log('  Next:   open in a browser, copy the rendered HTML into Beehiiv’s editor.');
}

// Email the rendered draft to Gio as the daily review prompt. Best-effort: a
// mail failure is logged but never fails the run — the Beehiiv draft is the
// real deliverable, this is just the nudge. `beehiivNote` describes where the
// draft ended up (staged in Beehiiv, or saved to disk) so the email tells Gio
// what to do next.
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
    const banner =
      '<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:640px;margin:0 auto 20px;padding:16px 18px;background:#f7f5f2;border-radius:10px;color:#1a1a1a;">'
      + '<div style="font-weight:600;margin-bottom:4px;">Today\'s Daily Meditations draft is ready to review.</div>'
      + '<div style="font-size:14px;color:#555;">' + escapeHtmlText(beehiivNote) + ' Open Beehiiv to edit and schedule: '
      + '<a href="https://app.beehiiv.com/" style="color:#8a7254;">app.beehiiv.com</a>. The rendered edition is below.</div>'
      + '</div>';
    await transporter.sendMail({
      from: '"Daily Meditations" <' + MAIL_USER + '>',
      to: MAIL_TO,
      subject: 'Draft: ' + edition.theme + ' — ' + dateStr,
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
  const iso = new Date().toISOString().slice(0, 10);
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
  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  });
  console.log('Generating edition for', dateStr, '...\n');

  // Two attempts max: initial generation + one automatic regeneration on
  // verification failure. After the second failure we fall back to the
  // reserve bank. We never stage an unverified current-event edition.
  let attempt = 1;
  while (attempt <= 2) {
    let g;
    try {
      g = await generateEdition(dateStr);
    } catch (e) {
      console.error(e.message);
      process.exit(1);
    }
    const text = g.text;
    const edition = g.edition;

    const heading = attempt === 1
      ? '--- Generated edition ---'
      : '--- Regenerated edition (retry ' + (attempt - 1) + ') ---';
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
    if (attempt === 1) console.log('\nRegenerating once for retry...');
    attempt++;
  }

  // Both attempts failed verification. Fall back to the reserve bank.
  console.log('\nFalling back to reserve bank...');
  const reserves = loadReserveBank();
  if (reserves.length === 0) {
    console.error('VALIDATION FAILED \u2014 no edition staged. Manual review required.');
    console.error('Reserve bank at scripts/reserve-editions.json is empty. Populate it with timeless editions to enable automatic fallback.');
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

run().catch(console.error);
