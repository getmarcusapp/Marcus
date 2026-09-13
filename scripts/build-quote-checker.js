#!/usr/bin/env node
/**
 * The quote checker — public/check-a-stoic-quote.html
 *
 * Paste a line, find out whether it is what it claims to be. Built from the
 * same two files everything else here is built from: constants/stoicQuotes.js
 * (164 passages, every one cited) and constants/misattributions.js (25 that are
 * not what they claim). Both are inlined as JSON and matched in the browser, so
 * the page is static and nothing is sent anywhere.
 *
 * FOUR ANSWERS, AND THE FOURTH IS THE IMPORTANT ONE.
 *
 *   misattributed  it is on our published list; show what it actually is
 *   verified       it is in the corpus; show book and chapter
 *   close          it resembles something we hold, but is not it. Usually this
 *                  means a different translation, or a paraphrase that has
 *                  hardened into a quotation
 *   unknown        we do not have it
 *
 * "Unknown" must never render as "fake". Our library is 164 passages, not the
 * corpus of ancient philosophy, and the honest claim is that we cannot find it,
 * which is a description of a search rather than a verdict. Every other page on
 * this site holds that line; a tool that quietly abandoned it would undo them.
 */
const fs = require('fs');
const path = require('path');
const { footerHtml } = require('./site-footer');

const ROOT = path.join(__dirname, '..');
const SITE = 'https://getmarcus.app';
const SLUG = 'check-a-stoic-quote';
const OUT = path.join(ROOT, 'public', SLUG + '.html');
const GA = '<script src="/analytics.js"></script>';

function loadModule(file, names) {
  const src = fs.readFileSync(path.join(ROOT, 'constants', file), 'utf8')
    .replace(/export\s+const/g, 'const')
    .replace(/export\s+function/g, 'function');
  const mod = { exports: {} };
  new Function('module', 'exports', src + '\nmodule.exports={' + names.join(',') + '};')(mod, mod.exports);
  return mod.exports;
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const CSS = `
*{box-sizing:border-box}
body{margin:0;background:#0d0d0f;color:#e8e4dc;font-family:Inter,system-ui,-apple-system,sans-serif;line-height:1.65;-webkit-font-smoothing:antialiased}
a{color:#c9a961}
img{max-width:100%;display:block}
.qc-nav{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px 24px;border-bottom:1px solid rgba(232,228,220,.09);flex-wrap:wrap}
.qc-brand{display:flex;align-items:center;gap:10px;text-decoration:none;color:#e8e4dc;font-family:Cinzel,Georgia,serif;letter-spacing:.08em}
.qc-nav-right{display:flex;align-items:center;gap:14px}
.qc-nav-link{text-decoration:none;font-size:14px;color:rgba(232,228,220,.72)}
.qc-nav-cta{text-decoration:none;font-size:14px;color:#0d0d0f;background:#c9a961;padding:9px 16px;border-radius:999px;white-space:nowrap}
.qc-wrap{max-width:760px;margin:0 auto;padding:0 24px}
.qc-hero{padding:64px 0 28px}
.qc-eyebrow{font-family:Cinzel,Georgia,serif;font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:#c9a961;margin:0 0 14px}
.qc-title{font-family:Cinzel,Georgia,serif;font-size:clamp(30px,5.2vw,46px);font-weight:600;margin:0 0 18px;letter-spacing:-.01em;line-height:1.15;text-wrap:balance}
.qc-intro{font-size:18px;color:rgba(232,228,220,.82);margin:0;max-width:62ch}
.qc-form{margin:32px 0 10px}
.qc-label{display:block;font-size:14px;color:rgba(232,228,220,.7);margin:0 0 8px}
.qc-input{width:100%;min-height:120px;resize:vertical;background:#141416;color:#f3efe7;border:1px solid rgba(232,228,220,.18);border-radius:12px;padding:16px;font:inherit;font-size:17px;line-height:1.55}
.qc-input:focus{outline:none;border-color:#c9a961}
.qc-row{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-top:14px}
.qc-btn{font:inherit;font-size:15px;cursor:pointer;border:0;color:#0d0d0f;background:#c9a961;padding:11px 22px;border-radius:999px}
.qc-btn.secondary{background:transparent;color:rgba(232,228,220,.75);border:1px solid rgba(232,228,220,.22)}
.qc-eg{font-size:13px;color:rgba(232,228,220,.55);margin:18px 0 0}
.qc-eg button{font:inherit;font-size:13px;cursor:pointer;background:none;border:0;border-bottom:1px dotted rgba(201,169,97,.6);color:#c9a961;padding:0;margin:0 2px}
.qc-result{margin:30px 0 0;border-radius:14px;border:1px solid rgba(232,228,220,.16);padding:24px;display:none}
.qc-result.show{display:block}
.qc-result.bad{border-color:rgba(214,106,92,.5);background:rgba(214,106,92,.07)}
.qc-result.good{border-color:rgba(201,169,97,.5);background:rgba(201,169,97,.07)}
.qc-result.maybe{border-color:rgba(214,176,92,.45);background:rgba(214,176,92,.06)}
.qc-verdict{font-family:Cinzel,Georgia,serif;font-size:20px;margin:0 0 12px;letter-spacing:.01em}
.qc-result.bad .qc-verdict{color:#e08d80}
.qc-result.good .qc-verdict{color:#d8b877}
.qc-result.maybe .qc-verdict{color:#d9bd77}
.qc-quoted{font-size:17px;color:#f3efe7;margin:0 0 14px;padding-left:14px;border-left:2px solid rgba(232,228,220,.2)}
.qc-fact{margin:0 0 10px;font-size:15px;color:rgba(232,228,220,.82)}
.qc-fact b{color:#f3efe7}
.qc-note{margin:14px 0 0;font-size:14px;color:rgba(232,228,220,.66)}
.qc-meta{margin:16px 0 0;font-size:13px;color:rgba(232,228,220,.5)}
.qc-body{padding:10px 0 60px}
.qc-h2{font-family:Cinzel,Georgia,serif;font-size:22px;margin:44px 0 12px}
.qc-p{font-size:16px;color:rgba(232,228,220,.78);margin:0 0 14px;max-width:62ch}
.qc-app{margin-top:48px;display:flex;align-items:center;gap:18px;flex-wrap:wrap;border-top:1px solid rgba(232,228,220,.09);padding-top:28px}
.qc-app p{margin:0;flex:1 1 280px;font-size:15px;color:rgba(232,228,220,.78)}
.qc-footer{padding:26px 24px 52px;border-top:1px solid rgba(232,228,220,.09);font-size:13px;color:rgba(232,228,220,.55);text-align:center}
.qc-footer a{color:rgba(232,228,220,.7)}
`;

// Matching runs in the browser. Kept deliberately legible: the tool's whole
// claim is that you can check it, so the check should not be a black box.
const CLIENT = `
(function () {
  var D = window.__QC__;
  function norm(t) {
    return String(t || '').toLowerCase()
      .replace(/[\\u2018\\u2019\\u201c\\u201d]/g, "'")
      .replace(/[^a-z0-9]+/g, ' ').trim();
  }
  // Strip a trailing attribution: people paste the card, dash and all. The
  // guard is on words remaining, not characters. A character floor refused to
  // strip "Know thyself. \u2014 Socrates", because what was left was 13
  // characters, and that entry could then never be found.
  function stripAttr(t) {
    var out = String(t || '').replace(/\\s*[\\u2014\\u2013-]{1,2}\\s*[^\\u2014\\u2013-]{0,70}$/, '');
    return out.trim().split(/\\s+/).filter(Boolean).length >= 2 ? out : String(t || '');
  }
  function bigrams(s) {
    var w = s.split(' '), out = {};
    for (var i = 0; i < w.length - 1; i++) out[w[i] + ' ' + w[i + 1]] = 1;
    return out;
  }
  function dice(a, b) {
    var A = bigrams(a), B = bigrams(b), ka = Object.keys(A), kb = Object.keys(B);
    if (!ka.length || !kb.length) return a === b ? 1 : 0;
    var shared = 0;
    for (var i = 0; i < ka.length; i++) if (B[ka[i]]) shared++;
    return (2 * shared) / (ka.length + kb.length);
  }
  function score(input, candidate) {
    if (input === candidate) return 1;
    // A short paste of a long passage is a match, and Dice punishes it hard.
    if (input.length > 24 && candidate.indexOf(input) !== -1) return 0.94;
    if (candidate.length > 24 && input.indexOf(candidate) !== -1) return 0.94;
    return dice(input, candidate);
  }
  function best(input, rows, textAt) {
    var top = null, topScore = 0;
    for (var i = 0; i < rows.length; i++) {
      var s = score(input, norm(textAt(rows[i])));
      if (s > topScore) { topScore = s; top = rows[i]; }
    }
    return { row: top, score: topScore };
  }

  var elInput = document.getElementById('qc-input');
  var elResult = document.getElementById('qc-result');

  function render(html, kind) {
    elResult.className = 'qc-result show ' + kind;
    elResult.innerHTML = html;
  }

  function check(raw) {
    var input = norm(stripAttr(raw));
    // Two words, not three: "Know thyself" is on the list, and a floor of three
    // meant the tool could never return the answer for it. Short input is safe
    // because a two-word phrase has one bigram, so anything short of an exact
    // match scores near zero and falls through to "not in our library".
    if (input.split(' ').length < 2) {
      render('<p class="qc-verdict">Paste a little more</p><p class="qc-fact">One word is not enough to match against. Try the whole line.</p>', 'maybe');
      return;
    }
    var m = best(input, D.mis, function (r) { return r[0]; });
    var v = best(input, D.corpus, function (r) { return r[0]; });

    // A known misattribution wins ties: it is the more useful answer.
    if (m.score >= 0.82) {
      var r = m.row;
      render(
        '<p class="qc-verdict">Not what it claims to be</p>' +
        '<p class="qc-quoted">' + r[0] + '</p>' +
        '<p class="qc-fact">Usually credited to <b>' + r[1] + '</b></p>' +
        '<p class="qc-fact">Actually <b>' + (r[2] || 'of no known source') + '</b></p>' +
        '<p class="qc-note">' + r[3] + '</p>' +
        '<p class="qc-meta">Confidence: ' + r[4] + ' &middot; <a href="/misattributed-stoic-quotes#' + r[5] + '">see the full entry</a></p>', 'bad');
      return;
    }
    if (v.score >= 0.82) {
      var q = v.row;
      render(
        '<p class="qc-verdict">In our checked library</p>' +
        '<p class="qc-quoted">' + q[0] + '</p>' +
        '<p class="qc-fact"><b>' + q[1] + '</b>, ' + q[2] + (q[3] ? ' ' + q[3] : '') + '</p>' +
        '<p class="qc-note">This passage is in the corpus the app reads from, cited to a work and a section you can open and check. ' +
        'Translations vary; the wording above is the one we hold.</p>', 'good');
      return;
    }
    var near = m.score > v.score ? { row: m.row, score: m.score, bad: true } : { row: v.row, score: v.score, bad: false };
    if (near.score >= 0.45) {
      var t = near.row;
      render(
        '<p class="qc-verdict">Close to something we hold</p>' +
        '<p class="qc-fact">We do not have that exact wording, but it resembles this:</p>' +
        '<p class="qc-quoted">' + t[0] + '</p>' +
        '<p class="qc-fact">' + (near.bad
          ? 'Usually credited to <b>' + t[1] + '</b>, actually <b>' + (t[2] || 'of no known source') + '</b>'
          : '<b>' + t[1] + '</b>, ' + t[2] + (t[3] ? ' ' + t[3] : '')) + '</p>' +
        '<p class="qc-note">Two things usually cause this: a different translation of the same passage, or a paraphrase that has ' +
        'hardened into a quotation. The second is worth caring about, because quotation marks make a claim the paraphrase cannot keep.</p>' +
        (near.bad ? '<p class="qc-meta"><a href="/misattributed-stoic-quotes#' + t[5] + '">see the full entry</a></p>' : ''), 'maybe');
      return;
    }
    render(
      '<p class="qc-verdict">Not in our library</p>' +
      '<p class="qc-fact">We hold ' + D.corpus.length + ' checked passages and ' + D.mis.length + ' documented misattributions, and this matches neither.</p>' +
      '<p class="qc-note">That is a description of our search, not a verdict on the quote. Two things commonly produce this answer for ' +
      'a real passage: we may simply not hold it, or you may have a different translation. This tool matches wording, and two honest ' +
      'translations of the same Greek can share almost no words at all.</p>' +
      '<p class="qc-note">What it does tell you is that nobody has handed you a book and a chapter. Until someone can, the attribution ' +
      'has probably not been checked by anyone else either.</p>', '');
  }

  document.getElementById('qc-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var v = elInput.value.trim();
    if (!v) return;
    check(v);
    try {
      history.replaceState(null, '', '?q=' + encodeURIComponent(v.slice(0, 300)));
    } catch (err) {}
  });
  document.getElementById('qc-clear').addEventListener('click', function () {
    elInput.value = '';
    elResult.className = 'qc-result';
    elResult.innerHTML = '';
    try { history.replaceState(null, '', location.pathname); } catch (err) {}
    elInput.focus();
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-eg]'), function (b) {
    b.addEventListener('click', function () {
      elInput.value = b.getAttribute('data-eg');
      check(elInput.value);
    });
  });
  // Shareable results: /check-a-stoic-quote?q=...
  var q = new URLSearchParams(location.search).get('q');
  if (q) { elInput.value = q; check(q); }
})();
`;

const NAV =
  '<nav class="qc-nav">' +
  '<a class="qc-brand" href="/"><img src="/skull-gold.png" alt="Marcus" width="36" height="36"><span>Marcus</span></a>' +
  '<div class="qc-nav-right">' +
  '<a class="qc-nav-link" href="/learn">Learn</a>' +
  '<a class="qc-nav-cta" href="/">Get the app →</a>' +
  '</div></nav>';

const FOOTER = footerHtml('qc', '/check-a-stoic-quote');

function build() {
  const { STOIC_QUOTES } = loadModule('stoicQuotes.js', ['STOIC_QUOTES']);
  const { MISATTRIBUTIONS } = loadModule('misattributions.js', ['MISATTRIBUTIONS']);

  const weak = MISATTRIBUTIONS.filter(e => !['certain', 'strong'].includes(e.confidence));
  if (weak.length) {
    console.error('Refusing to build: ' + weak.length + ' misattribution(s) below "strong" confidence.');
    process.exit(1);
  }

  const data = {
    corpus: STOIC_QUOTES.map(q => [q.quote, q.author, q.work, q.source || '']),
    mis: MISATTRIBUTIONS.map(m => [m.text, m.credited, m.actual || '', m.note, m.confidence, m.id]),
  };

  const title = 'Check a Stoic Quote';
  const desc = 'Paste a quotation attributed to Marcus Aurelius, Seneca or Epictetus and find out whether it is theirs. '
    + 'Checked against ' + STOIC_QUOTES.length + ' sourced passages and ' + MISATTRIBUTIONS.length + ' documented misattributions.';
  const canonical = SITE + '/' + SLUG;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: title,
    description: desc,
    url: canonical,
    applicationCategory: 'ReferenceApplication',
    operatingSystem: 'Any',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    publisher: { '@type': 'Organization', name: 'Marcus', url: SITE },
  };

  const EG_FAKE = 'What we do in life echoes in eternity.';
  const EG_REAL = 'You could leave life right now. Let that determine what you do and say and think.';

  const body =
    '<div class="qc-wrap">' +
    '<header class="qc-hero">' +
    '<p class="qc-eyebrow">A free tool</p>' +
    '<h1 class="qc-title">Check a Stoic Quote</h1>' +
    '<p class="qc-intro">Paste a line attributed to Marcus Aurelius, Seneca or Epictetus. We will tell you whether it is in our ' +
    'checked library, whether it is one of the ones we have traced to someone else, or whether we simply cannot find it.</p>' +
    '</header>' +

    '<form class="qc-form" id="qc-form">' +
    '<label class="qc-label" for="qc-input">The quotation</label>' +
    '<textarea class="qc-input" id="qc-input" placeholder="Paste the quote here. An attribution on the end is fine, we will ignore it." spellcheck="false"></textarea>' +
    '<div class="qc-row">' +
    '<button class="qc-btn" type="submit">Check it</button>' +
    '<button class="qc-btn secondary" type="button" id="qc-clear">Clear</button>' +
    '</div>' +
    '<p class="qc-eg">Try one: <button type="button" data-eg="' + esc(EG_FAKE) + '">a famous one that is not his</button> ' +
    'or <button type="button" data-eg="' + esc(EG_REAL) + '">one that is</button>.</p>' +
    '</form>' +

    '<div class="qc-result" id="qc-result" role="status" aria-live="polite"></div>' +

    '<div class="qc-body">' +
    '<h2 class="qc-h2">What it is checking against</h2>' +
    '<p class="qc-p">Two lists. The first is ' + STOIC_QUOTES.length + ' passages we have taken the trouble to cite, each to a work ' +
    'and a section you can open. The second is ' + MISATTRIBUTIONS.length + ' quotations that circulate under a Stoic name and belong ' +
    'to someone else: a screenwriter, a songwriter, Voltaire, Kant, a Victorian minister. We found most of them by auditing our own ' +
    'library and throwing out what did not survive.</p>' +

    '<h2 class="qc-h2">What "not in our library" means</h2>' +
    '<p class="qc-p">It means we cannot find it. It does not mean the line is fake. Our library is a few hundred passages, not the ' +
    'whole of ancient philosophy, and a genuine quotation can easily sit outside it.</p>' +
    '<p class="qc-p">There is also a limit worth knowing about. This tool matches wording, and translators differ. Epictetus writing ' +
    'that people are disturbed by their judgments rather than by events has been rendered a dozen ways in four centuries, and two of ' +
    'those renderings can share almost no vocabulary. A real passage in an unfamiliar translation may come back unfound.</p>' +
    '<p class="qc-p">What it does tell you is that nobody has handed you a book and a chapter. That is the thing worth noticing. A ' +
    'quotation that travels with a citation can be checked by anyone; one that travels with only a name has usually never been ' +
    'checked by anyone.</p>' +

    '<h2 class="qc-h2">Why this matters more for Stoicism than for most</h2>' +
    '<p class="qc-p">Stoic practice is built on precise distinctions, and a rewrite frequently inverts one. The best-known example is ' +
    'a line about everything we hear being an opinion, which is a rewrite of <em>Meditations</em> II.15. The original is a claim about ' +
    'judgment. The rewrite is a claim about the unreliability of the senses, which is not a Stoic position at all. Someone building a ' +
    'discipline on the second is practising something else.</p>' +
    '<p class="qc-p">The longer version of that argument, and the whole list, is on ' +
    '<a href="/misattributed-stoic-quotes">the Stoic quotes that are not Stoic</a>. If you would rather browse passages that do check ' +
    'out, they are on <a href="/stoic-quotes">sourced quotes</a>.</p>' +

    '<section class="qc-app">' +
    '<img src="/skull-gold.png" alt="" width="52" height="52">' +
    '<p>Marcus is a daily Stoic practice for iOS, and it reads from this same checked library. No quote in the app is there unless it survived the audit.</p>' +
    '<a class="qc-nav-cta" href="/">Explore the app →</a></section>' +
    '</div></div>';

  const html = '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' + esc(title) + ' | Marcus</title>' +
    '<meta name="description" content="' + esc(desc) + '">' +
    '<link rel="canonical" href="' + canonical + '">' +
    '<link rel="icon" href="/favicon.ico" sizes="48x48">' +
    '<meta property="og:title" content="' + esc(title) + '">' +
    '<meta property="og:description" content="' + esc(desc) + '">' +
    '<meta property="og:url" content="' + canonical + '">' +
    '<meta property="og:type" content="website">' +
    '<link rel="preconnect" href="https://fonts.googleapis.com">' +
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
    '<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600&family=Inter:wght@400;500&display=swap" rel="stylesheet">' +
    '<style>' + CSS.trim() + '</style>' +
    '<script type="application/ld+json">' + JSON.stringify(jsonLd) + '</script>' +
    GA + '</head><body>' + NAV + body +
    '<script>window.__QC__=' + JSON.stringify(data).replace(/</g, '\\u003c') + ';</script>' +
    '<script>' + CLIENT + '</script>' +
    FOOTER + '</body></html>';

  fs.writeFileSync(OUT, html, 'utf8');
  console.log('Built the quote checker: ' + STOIC_QUOTES.length + ' passages, ' +
    MISATTRIBUTIONS.length + ' misattributions, ' + (html.length / 1024).toFixed(0) + ' KB → public/' + SLUG + '.html');
}

// CLIENT is exported so the matcher can be exercised in node rather than only
// in a browser. scripts/check.js runs real quotations through it: the tool's
// whole value is the verdict, and a matcher nothing tests is a matcher nobody
// knows the behaviour of.
module.exports = { SLUG, CLIENT, loadModule };
if (require.main === module) build();
