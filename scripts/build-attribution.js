#!/usr/bin/env node
// The misattributed-quotes page — /misattributed-stoic-quotes.
//
// Renders constants/misattributions.js into public/misattributed-stoic-quotes.html.
// Flat file rather than a directory index, matching /library: this page has no
// child pages, so there is nothing for a directory to hold.
//
// This is the one page on the site that other people have a reason to link to,
// which is the point of it. It is also the page most damaged by being wrong, so
// the data file carries a confidence field and the build refuses to publish
// anything below 'strong'.
//
// Re-run when the list changes:  node scripts/build-attribution.js

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SITE = 'https://getmarcus.app';
const SLUG = 'misattributed-stoic-quotes';
const OUT = path.join(ROOT, 'public', SLUG + '.html');
const GA = '<script src="/analytics.js"></script>';

function loadModule(file, names) {
  const src = fs.readFileSync(path.join(ROOT, 'constants', file), 'utf8')
    .replace(/export\s+function/g, 'function')
    .replace(/export\s+const/g, 'const');
  const mod = { exports: {} };
  new Function('module', 'exports', src + '\nmodule.exports={' + names.join(',') + '};')(mod, mod.exports);
  return mod.exports;
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function entryHtml(e) {
  const verdict = e.actual
    ? '<p class="mq-actual"><span class="mq-label">Actually</span>' + esc(e.actual) + '</p>'
    : '<p class="mq-actual mq-actual-none"><span class="mq-label">Actually</span>' +
      'No known source. It is not in ' + esc(e.credited.replace(/,.*$/, '')) + '.</p>';
  return '<article class="mq-entry" id="' + esc(e.id) + '">' +
    '<blockquote class="mq-quote">' + esc(e.text) + '</blockquote>' +
    '<p class="mq-credited"><span class="mq-label">Usually credited to</span>' + esc(e.credited) + '</p>' +
    verdict +
    '<p class="mq-note">' + esc(e.note) + '</p>' +
    '</article>';
}

function jsonLd(list) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'The Stoic Quotes That Are Not Stoic',
    description: 'Twenty quotations widely attributed to Marcus Aurelius, Seneca, Epictetus and Socrates that belong to someone else, with what each one actually is.',
    url: SITE + '/' + SLUG,
    author: { '@type': 'Organization', name: 'Marcus' },
    publisher: { '@type': 'Organization', name: 'Marcus' },
    about: list.map(e => ({ '@type': 'Quotation', text: e.text })),
  };
}

function build() {
  const { MISATTRIBUTIONS, GROUPS } = loadModule('misattributions.js', ['MISATTRIBUTIONS', 'GROUPS']);

  // A weak claim on this page costs more than a missing one.
  const weak = MISATTRIBUTIONS.filter(e => !['certain', 'strong'].includes(e.confidence));
  if (weak.length) {
    console.error('Refusing to build: ' + weak.length + ' entr(ies) below "strong" confidence: ' +
      weak.map(e => e.id).join(', '));
    process.exit(1);
  }

  const title = 'The Stoic Quotes That Are Not Stoic | Marcus';
  const desc = 'Marcus Aurelius did not say "what we do in life echoes in eternity". Seneca did not write ' +
    '"every new beginning comes from some other beginning\'s end". Twenty misattributed quotations, and what each one actually is.';
  const canonical = SITE + '/' + SLUG;

  const groupsHtml = GROUPS.map(g => {
    const entries = MISATTRIBUTIONS.filter(e => e.group === g.key);
    if (!entries.length) return '';
    return '<section class="mq-section" id="' + esc(g.key) + '">' +
      '<h2 class="mq-section-title">' + esc(g.title) + '</h2>' +
      '<p class="mq-section-intro">' + esc(g.intro) + '</p>' +
      entries.map(entryHtml).join('') +
      '</section>';
  }).join('');

  const html = '<!doctype html><html lang="en"><head>' +
    '<meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    GA +
    '<title>' + esc(title) + '</title>' +
    '<meta name="description" content="' + esc(desc) + '">' +
    '<meta name="robots" content="index, follow, max-image-preview:large">' +
    '<link rel="canonical" href="' + canonical + '">' +
    '<meta property="og:type" content="article">' +
    '<meta property="og:site_name" content="Marcus">' +
    '<meta property="og:title" content="The Stoic Quotes That Are Not Stoic">' +
    '<meta property="og:description" content="' + esc(desc) + '">' +
    '<meta property="og:url" content="' + canonical + '">' +
    '<meta property="og:image" content="' + SITE + '/og-image.png">' +
    '<meta name="twitter:card" content="summary_large_image">' +
    '<meta name="twitter:title" content="The Stoic Quotes That Are Not Stoic">' +
    '<meta name="twitter:description" content="' + esc(desc) + '">' +
    '<meta name="twitter:image" content="' + SITE + '/og-image.png">' +
    '<link rel="icon" href="/favicon.ico" sizes="48x48">' +
    '<link rel="icon" type="image/png" href="/favicon.png">' +
    '<link rel="apple-touch-icon" href="/apple-touch-icon.png">' +
    '<link rel="preconnect" href="https://fonts.googleapis.com">' +
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
    '<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Inter:ital,wght@0,400;0,500;1,300;1,400&display=swap" rel="stylesheet">' +
    '<style>' + CSS + '</style>' +
    '<script type="application/ld+json">' + JSON.stringify(jsonLd(MISATTRIBUTIONS)) + '</script>' +
    '</head><body>' +
    '<nav class="mq-nav">' +
    '<a class="mq-brand" href="/"><img src="/skull-gold.png" alt="Marcus" width="40" height="40"><span>Marcus</span></a>' +
    '<div class="mq-nav-right">' +
    '<a class="mq-nav-link" href="/stoics">The Stoics</a>' +
    '<a class="mq-nav-link" href="/library">Library</a>' +
    '<a class="mq-nav-cta" href="/">Get the app →</a>' +
    '</div></nav>' +

    '<header class="mq-hero"><div class="mq-hero-inner">' +
    '<p class="mq-eyebrow">Attribution</p>' +
    '<h1 class="mq-title">The Stoic quotes that are not Stoic</h1>' +
    '<p class="mq-standfirst">Marcus Aurelius did not write that what we do in life echoes in eternity. ' +
    'A screenwriter did, in 1999. Seneca did not write that every new beginning comes from some other ' +
    'beginning&rsquo;s end. That is the last line of a Semisonic song.</p>' +
    '</div></header>' +

    '<main class="mq-main">' +
    '<section class="mq-intro">' +
    '<p>We found these by auditing our own app.</p>' +
    '<p>Marcus is a Stoic practice app, and its daily reading draws from a library of passages we had ' +
    'assembled over months. In August 2026 we checked that library against its sources, properly, one line ' +
    'at a time. Fifty-five entries were not what they claimed to be. Some belonged to other philosophers. ' +
    'Some belonged to other centuries. Two were written for this app and quietly attributed to Marcus Aurelius, ' +
    'which is the kind of thing that happens when nobody is checking.</p>' +
    '<p>We took them out. This page is what we found, because the same quotations are still circulating ' +
    'everywhere else, and because a philosophy about seeing things as they actually are deserves better ' +
    'sourcing than it usually gets.</p>' +
    '<p class="mq-scope">Where the real author is known, it is named. Where a line simply has no ancient ' +
    'source and its modern origin is genuinely disputed, this page says that instead of guessing. ' +
    'Being confidently wrong is the failure mode we are describing, so it seemed a poor one to repeat.</p>' +
    '</section>' +

    groupsHtml +

    '<section class="mq-method">' +
    '<h2 class="mq-section-title">How to check one yourself</h2>' +
    '<p>Four questions catch almost everything on this page.</p>' +
    '<p><strong>Is there a citation?</strong> Not &ldquo;Marcus Aurelius&rdquo; but &ldquo;Meditations, ' +
    'V.20&rdquo;. Real quotations survive inside numbered works. A quote card with a name and no book is ' +
    'a quote whose source nobody checked.</p>' +
    '<p><strong>Does it sound translated?</strong> Ancient prose arrives through a translator and keeps ' +
    'some of the joins. Aphorisms that scan perfectly in modern English, with a neat rhythm and a twist ' +
    'at the end, are usually modern English.</p>' +
    '<p><strong>Did the person write anything?</strong> Socrates left no writings. Zeno&rsquo;s books are ' +
    'entirely lost. Anything attributed to them comes secondhand through someone else, and should say so.</p>' +
    '<p><strong>Is it claimed by two traditions?</strong> A line credited to both Seneca and Confucius ' +
    'belongs to neither. Cross-tradition popularity is a symptom of an orphan quote finding homes.</p>' +
    '</section>' +

    '<section class="mq-app">' +
    '<img class="mq-app-skull" src="/skull-gold.png" alt="" width="64" height="64">' +
    '<p class="mq-app-copy">Marcus is a daily Stoic practice for iOS. Every passage it shows you has been ' +
    'through the audit described above, and the ones we could not source are gone rather than quietly kept.</p>' +
    '<a class="mq-nav-cta" href="/">Explore the app →</a>' +
    '<p class="mq-app-links">See also <a href="/stoics">the Stoics themselves</a> and ' +
    '<a href="/library">the translations worth reading</a>.</p>' +
    '</section>' +
    '</main>' +

    '<footer class="mq-footer"><p>Marcus &middot; A Stoic Practice App &middot; ' +
    '<a href="/">getmarcus.app</a> &middot; <a href="/stoics">The Stoics</a> &middot; ' +
    '<a href="/library">The Library</a> &middot; <a href="/meditations">Daily Meditations</a></p></footer>' +
    '</body></html>';

  fs.writeFileSync(OUT, html, 'utf8');
  const certain = MISATTRIBUTIONS.filter(e => e.confidence === 'certain').length;
  console.log('Built attribution page: ' + MISATTRIBUTIONS.length + ' entries (' + certain +
    ' certain, ' + (MISATTRIBUTIONS.length - certain) + ' strong) → public/' + SLUG + '.html');
}

const CSS = `
*{box-sizing:border-box}
body{margin:0;background:#0d0d0f;color:#e8e4dc;font-family:Inter,system-ui,-apple-system,sans-serif;line-height:1.65;-webkit-font-smoothing:antialiased}
a{color:inherit}
img{max-width:100%;display:block}
.mq-nav{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px 24px;border-bottom:1px solid rgba(232,228,220,.09);flex-wrap:wrap}
.mq-brand{display:flex;align-items:center;gap:10px;text-decoration:none;font-family:Cinzel,Georgia,serif;font-size:19px;letter-spacing:.02em}
.mq-brand img{width:40px;height:40px;object-fit:contain;opacity:.9}
.mq-nav-right{display:flex;align-items:center;gap:20px;flex-wrap:wrap}
.mq-nav-link{text-decoration:none;font-size:14px;color:rgba(232,228,220,.72)}
.mq-nav-link:hover{color:#e8e4dc}
.mq-nav-cta{text-decoration:none;font-size:14px;color:#0d0d0f;background:#c9a961;padding:9px 16px;border-radius:999px;white-space:nowrap}
.mq-hero{padding:72px 24px 44px;border-bottom:1px solid rgba(232,228,220,.09)}
.mq-hero-inner{max-width:720px;margin:0 auto}
.mq-eyebrow{font-family:Cinzel,Georgia,serif;font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:#c9a961;margin:0 0 14px}
.mq-title{font-family:Cinzel,Georgia,serif;font-size:clamp(32px,5.6vw,50px);font-weight:600;margin:0 0 22px;letter-spacing:-.01em;line-height:1.15;text-wrap:balance}
.mq-standfirst{font-size:19px;color:rgba(232,228,220,.8);margin:0;max-width:62ch}
.mq-main{max-width:720px;margin:0 auto;padding:48px 24px 8px}
.mq-intro p{font-size:17px;color:rgba(232,228,220,.84);margin:0 0 18px;max-width:66ch}
.mq-scope{font-size:15px !important;color:rgba(232,228,220,.6) !important;border-left:2px solid rgba(232,228,220,.16);padding-left:18px}
.mq-section{margin-top:64px}
.mq-section-title{font-family:Cinzel,Georgia,serif;font-size:13px;letter-spacing:.2em;text-transform:uppercase;color:#c9a961;margin:0 0 14px;padding-bottom:10px;border-bottom:1px solid rgba(232,228,220,.09)}
.mq-section-intro{font-size:16px;color:rgba(232,228,220,.68);margin:0 0 32px;max-width:64ch}
.mq-entry{padding:26px 0;border-bottom:1px solid rgba(232,228,220,.07)}
.mq-quote{font-family:Cinzel,Georgia,serif;font-size:21px;line-height:1.45;margin:0 0 16px;color:#e8e4dc;padding:0;border:0}
.mq-quote::before{content:"\\201C"}
.mq-quote::after{content:"\\201D"}
.mq-label{display:block;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:rgba(232,228,220,.42);margin-bottom:3px}
.mq-credited{font-size:15px;color:rgba(232,228,220,.66);margin:0 0 12px}
.mq-actual{font-size:16px;color:#c9a961;margin:0 0 14px}
.mq-actual-none{color:rgba(232,228,220,.72)}
.mq-note{font-size:15.5px;color:rgba(232,228,220,.76);margin:0;max-width:66ch}
.mq-method{margin-top:72px}
.mq-method p{font-size:16.5px;color:rgba(232,228,220,.8);margin:0 0 16px;max-width:66ch}
.mq-method strong{color:#e8e4dc}
.mq-app{text-align:center;margin:72px 0 0;padding:44px 24px;border-top:1px solid rgba(232,228,220,.09)}
.mq-app-skull{width:56px;height:56px;object-fit:contain;margin:0 auto 16px;opacity:.9}
.mq-app-copy{font-size:16px;color:rgba(232,228,220,.78);max-width:54ch;margin:0 auto 20px}
.mq-app-links{font-size:14.5px;color:rgba(232,228,220,.55);margin:20px 0 0}
.mq-app-links a{color:#c9a961}
.mq-footer{text-align:center;padding:32px 24px 48px;font-size:13px;color:rgba(232,228,220,.45)}
.mq-footer a{color:rgba(232,228,220,.7)}
`;

build();
