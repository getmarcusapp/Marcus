#!/usr/bin/env node
/**
 * Find pages that publish one of our documented misattributions as genuine.
 *
 * WHAT THIS IS FOR. Outreach that asks for a link gets ignored. Outreach that
 * hands someone a correction they can check gets replies, because it is useful
 * to the recipient before it is useful to us. That is the whole difference
 * between this and a link-building bot, and it is why the sending half stays
 * human: what made Sadler restack us was that a specific person had read his
 * specific list. Automate the contact and you remove the property that worked.
 *
 * So this tool does the research and assembles the evidence. It does not send
 * anything, and it never will.
 *
 * DISCOVERY IS NOT AUTOMATED EITHER, because there is no search API configured
 * and scraping a search engine is both fragile and against its terms. Run
 * `--queries` to print the searches worth running, paste the results in, and
 * this verifies them.
 *
 * Usage:
 *   node scripts/find-misquotes.js --queries          print search queries to run
 *   node scripts/find-misquotes.js <url> [url...]     check specific pages
 *   node scripts/find-misquotes.js --file urls.txt    check a list
 *   node scripts/find-misquotes.js --file urls.txt --out report.md
 *
 * A page that already names the true source is reported as ALREADY CORRECT and
 * sorted to the bottom: writing to those wastes their time and ours.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function loadMisattributions() {
  const src = fs.readFileSync(path.join(ROOT, 'constants', 'misattributions.js'), 'utf8')
    .replace(/export\s+const/g, 'const');
  const mod = { exports: {} };
  new Function('module', 'exports', src + '\nmodule.exports={MISATTRIBUTIONS};')(mod, mod.exports);
  return mod.exports.MISATTRIBUTIONS;
}

const norm = t => String(t || '').toLowerCase()
  .replace(/[‘’“”]/g, "'")
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

function visibleText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchPage(url) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 15000);
  try {
    const res = await fetch(url, {
      signal: ctl.signal,
      redirect: 'follow',
      headers: {
        // Identify honestly. We are reading public pages to check quotations,
        // not pretending to be a person.
        'User-Agent': 'MarcusQuoteChecker/1.0 (+https://getmarcus.app/check-a-stoic-quote)',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });
    const body = await res.text();
    return { ok: res.ok, status: res.status, body, finalUrl: res.url || url };
  } catch (e) {
    return { ok: false, status: 0, error: e.name === 'AbortError' ? 'timeout' : e.message };
  } finally {
    clearTimeout(timer);
  }
}

// Distinctive tokens from the true source, used to tell "publishes it as
// genuine" from "already explains it is not". "Gladiator" for the film,
// "Maclaren" for the minister, and so on.
// Common given names are dropped. "Ian Maclaren (pen name of John Watson)"
// yields john and watson, and a page mentioning any John would then be marked
// as already corrected and silently skipped. Surnames and titles carry the
// signal; first names carry noise.
const COMMON_NAMES = new Set([
  'john', 'david', 'william', 'james', 'robert', 'charles', 'thomas', 'george',
  'henry', 'peter', 'paul', 'mark', 'daniel', 'richard', 'joseph', 'edward',
  'the', 'and', 'from', 'with', 'that', 'this', 'his', 'her', 'essay', 'story',
  'philosophy', 'letters', 'book', 'life', 'work', 'screenplay', 'written',
]);
function sourceTokens(entry) {
  if (!entry.actual) return [];
  const tokens = (entry.actual.match(/[A-Za-z][a-z']{3,}/g) || [])
    .map(w => w.toLowerCase())
    .filter(w => w.length >= 5 && !COMMON_NAMES.has(w));
  return [...new Set(tokens)];
}

function analyse(entry, text) {
  const needle = norm(entry.text);
  const words = needle.split(' ');
  // Two- and three-word entries ("know thyself") match half the internet, so
  // they are reported with a warning rather than silently trusted.
  const weak = words.length < 6;
  const probe = words.slice(0, Math.min(12, words.length)).join(' ');
  const at = text.indexOf(probe);
  if (at === -1) return null;

  const around = text.slice(Math.max(0, at - 220), at + probe.length + 220);
  const tokens = sourceTokens(entry);
  // Six entries have no known source, so there is no name to look for and they
  // would otherwise always read as a target. A page that is discussing the
  // attribution rather than asserting it usually says so in plain words.
  const DISCUSSES = ['misattribut', 'misquot', 'never wrote', 'never said', 'no known source',
    'wrongly attributed', 'often attributed', 'commonly attributed', 'falsely attributed',
    'did not write', 'did not say', 'not actually'];
  const discussesIt = DISCUSSES.some(d => around.includes(d));
  const namesTrueSource = discussesIt || (tokens.length > 0 && tokens.some(t => text.includes(t)));
  const creditsWrongly = norm(entry.credited).split(' ')
    .filter(w => w.length > 3)
    .some(w => around.includes(w));

  return { entry, context: around.trim(), namesTrueSource, creditsWrongly, weak };
}

function queries(list) {
  const lines = ['Searches worth running. Paste the result URLs back in with --file.', ''];
  for (const e of list) {
    const phrase = e.text.replace(/["“”]/g, '').replace(/\.$/, '');
    const who = e.credited.split(',')[0];
    // Trim on a word boundary, not at character 70. A phrase cut mid-word is
    // not a phrase search any more, and six of these were being sent out as
    // "...is not an act, but a h".
    let q = phrase;
    if (q.length > 70) {
      q = q.slice(0, 70);
      q = q.slice(0, q.lastIndexOf(' '));
    }
    lines.push('  "' + q + '" "' + who + '"');
  }
  lines.push('', 'Exclude your own site and the obvious aggregators:');
  lines.push('  -site:getmarcus.app -site:goodreads.com -site:pinterest.com -site:quotefancy.com');
  return lines.join('\n');
}

function report(rows) {
  const out = [];
  out.push('# Pages publishing a documented misattribution', '');
  const live = rows.filter(r => r.hits.length);
  const targets = live.filter(r => r.hits.some(h => !h.namesTrueSource));
  const already = live.filter(r => !r.hits.some(h => !h.namesTrueSource));

  out.push(`Checked ${rows.length} page(s). ${targets.length} worth writing to, ` +
    `${already.length} already name the true source, ${rows.length - live.length} clean or unreachable.`, '');

  if (targets.length) {
    out.push('## Worth writing to', '');
    for (const r of targets) {
      out.push('### ' + r.url, '');
      for (const h of r.hits.filter(x => !x.namesTrueSource)) {
        out.push('**"' + h.entry.text + '"**', '');
        out.push('- On their page: …' + h.context.slice(0, 200) + '…');
        out.push('- They credit: ' + h.entry.credited);
        out.push('- Actually: ' + (h.entry.actual || 'no known source'));
        out.push('- Confidence: ' + h.entry.confidence +
          (h.weak ? '  **short phrase, confirm by eye before writing**' : ''));
        out.push('- Our entry: https://getmarcus.app/misattributed-stoic-quotes#' + h.entry.id, '');
      }
    }
  }
  if (already.length) {
    out.push('## Already name the true source (do not write)', '');
    for (const r of already) out.push('- ' + r.url);
    out.push('');
  }
  const failed = rows.filter(r => r.error);
  if (failed.length) {
    out.push('## Could not be read', '');
    for (const r of failed) out.push('- ' + r.url + '  (' + r.error + ')');
  }
  return out.join('\n');
}

async function main() {
  const argv = process.argv.slice(2);
  const list = loadMisattributions();

  if (argv.includes('--queries') || argv.length === 0) {
    console.log(queries(list));
    if (argv.length === 0) {
      console.log('\nNo URLs given. Pass some, or --file urls.txt');
    }
    return;
  }

  const urls = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--file') {
      urls.push(...fs.readFileSync(argv[++i], 'utf8').split('\n')
        .map(l => l.trim()).filter(l => l && !l.startsWith('#')));
    } else if (argv[i] === '--out') {
      i++;
    } else if (/^https?:\/\//.test(argv[i])) {
      urls.push(argv[i]);
    }
  }
  if (!urls.length) { console.error('No URLs to check.'); process.exit(1); }

  const rows = [];
  for (const url of urls) {
    process.stderr.write('  ' + url + ' ... ');
    const res = await fetchPage(url);
    if (!res.ok) {
      rows.push({ url, hits: [], error: res.error || ('HTTP ' + res.status) });
      process.stderr.write((res.error || res.status) + '\n');
      continue;
    }
    const text = norm(visibleText(res.body));
    const hits = list.map(e => analyse(e, text)).filter(Boolean);
    rows.push({ url: res.finalUrl, hits });
    process.stderr.write(hits.length ? hits.length + ' hit(s)\n' : 'clean\n');
  }

  const md = report(rows);
  const outIdx = argv.indexOf('--out');
  if (outIdx !== -1 && argv[outIdx + 1]) {
    fs.writeFileSync(argv[outIdx + 1], md + '\n', 'utf8');
    console.error('\nWrote ' + argv[outIdx + 1]);
  } else {
    console.log(md);
  }
}

module.exports = { norm, visibleText, analyse, sourceTokens, loadMisattributions };
if (require.main === module) main();
