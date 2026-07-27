#!/usr/bin/env node
// The Stoic Library — public reading-list page builder.
//
// Renders constants/library.js (the same curated list the app uses) into a
// static, SEO-optimized, affiliate-enabled page at public/library.html
// (served at /library via Vercel cleanUrls).
//
//   - Bookshop.org primary link (10%), Amazon fallback (4-8%).
//   - Affiliate links carry rel="sponsored nofollow" per Google guidance.
//   - FTC affiliate disclosure rendered near the top and in the footer.
//   - JSON-LD ItemList of Book entries.
//
// Re-run any time the reading list changes:  node scripts/build-library.js
// (Not part of the daily newsletter automation — the list changes rarely.)

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SITE = 'https://getmarcus.app';
const OUT = path.join(ROOT, 'public', 'library.html');
// Google Analytics (GA4) — injected into the page <head>.
const GA = '<script async src="https://www.googletagmanager.com/gtag/js?id=G-10SNPQGSRS"></script>' +
  '<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}' +
  "gtag('js',new Date());gtag('config','G-10SNPQGSRS');</script>";

// Load constants/library.js (an ES module of pure data + helpers) into this
// CommonJS script: strip the `export` keywords and evaluate. Safe because the
// file has no imports — only `export const`/`export function` + template data.
function loadLibrary() {
  const src = fs.readFileSync(path.join(ROOT, 'constants', 'library.js'), 'utf8');
  const cjs = src
    .replace(/export\s+function/g, 'function')
    .replace(/export\s+const/g, 'const') +
    '\nmodule.exports={READING_LIST,BOOKSHOP_AFFILIATE_ID,AMAZON_AFFILIATE_TAG,bookshopUrl,amazonUrl};';
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', cjs)(mod, mod.exports, require);
  return mod.exports;
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function yearLabel(y) {
  if (y == null) return '';
  if (y < 0) return Math.abs(y) + ' BCE';
  if (y < 1000) return y + ' CE';
  return String(y);
}
function metaLine(b) {
  const parts = [b.author];
  if (b.translator) parts.push('trans. ' + b.translator);
  if (b.year != null) parts.push(yearLabel(b.year));
  return parts.join('  ·  ');
}

// Short section intros in the app's voice, keyed to the section labels used
// in constants/library.js. Order below defines the page order.
const SECTIONS = [
  { key: 'Primary sources', intro: 'The Stoics themselves, in the translations worth reading. Start here.' },
  { key: 'Modern interpreters', intro: 'Scholars and practitioners who make the ancient texts legible to a modern reader.' },
  { key: 'Adjacent thinkers', intro: 'Not Stoics, but working the same ground: attention, fortune, and how to live.' },
  { key: 'Eastern parallel', intro: 'The same questions Marcus and Epictetus circle, arrived at from another tradition.' },
];

const DISCLOSURE =
  'Marcus earns a commission from qualifying purchases made through the links on this page, ' +
  'at no additional cost to you. We link to Bookshop.org first (which supports independent ' +
  'bookstores) and Amazon as a fallback. We only list books we genuinely recommend.';

function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}
// Free cover thumbnails by ISBN from Open Library. ?default=false makes it
// 404 on a missing cover so onerror can gracefully collapse the column.
function coverUrl(b) {
  return 'https://covers.openlibrary.org/b/isbn/' + encodeURIComponent(b.isbn) + '-M.jpg?default=false';
}

function bookCard(b, bookshopUrl, amazonUrl) {
  const bs = bookshopUrl(b.isbn);
  const az = amazonUrl(b.asin);
  const pill = /start here/i.test(b.why) ? '<span class="lib-pill">Start here</span>' : '';
  return '<article class="lib-book">' +
    '<div class="lib-cover-wrap">' +
    '<img class="lib-cover" src="' + esc(coverUrl(b)) + '" alt="' + esc(b.title) + ' cover" ' +
    'loading="lazy" width="96" height="146" ' +
    'onerror="this.closest(\'.lib-cover-wrap\').classList.add(\'lib-cover-missing\')"></div>' +
    '<div class="lib-book-body">' +
    '<h3 class="lib-book-title">' + esc(b.title) + pill + '</h3>' +
    '<p class="lib-book-meta">' + esc(metaLine(b)) + '</p>' +
    '<p class="lib-book-why">' + esc(b.why) + '</p>' +
    '<div class="lib-actions">' +
    '<a class="lib-btn lib-btn-primary" href="' + esc(bs) + '" rel="sponsored nofollow noopener" target="_blank">Bookshop.org</a>' +
    '<a class="lib-btn lib-btn-secondary" href="' + esc(az) + '" rel="sponsored nofollow noopener" target="_blank">Amazon</a>' +
    '</div></div></article>';
}

function jsonLd(list) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'The Stoic Library',
    description: 'A curated reading list for Stoic practice: primary sources, modern interpreters, adjacent thinkers, and Eastern parallels.',
    url: SITE + '/library',
    numberOfItems: list.length,
    itemListElement: list.map((b, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Book',
        name: b.title,
        author: { '@type': 'Person', name: b.author },
        ...(b.isbn ? { isbn: b.isbn } : {}),
        ...(b.translator ? { translator: { '@type': 'Person', name: b.translator } } : {}),
      },
    })),
  };
}

function build() {
  const { READING_LIST, bookshopUrl, amazonUrl } = loadLibrary();
  const title = 'The Stoic Library — Best Books on Stoicism | Marcus';
  const desc = 'A curated reading list for Stoic practice: the best translations of Marcus Aurelius, Epictetus, and Seneca, plus modern interpreters and adjacent thinkers. Annotated, no fluff.';
  const canonical = SITE + '/library';

  const liveSections = SECTIONS.filter(sec => READING_LIST.some(b => b.section === sec.key));
  const jumpNav = '<nav class="lib-jump">' +
    liveSections.map(sec => '<a href="#' + slug(sec.key) + '">' + esc(sec.key) + '</a>').join('') +
    '</nav>';
  const sectionsHtml = liveSections.map(sec => {
    const books = READING_LIST.filter(b => b.section === sec.key);
    return '<section class="lib-section" id="' + slug(sec.key) + '">' +
      '<h2 class="lib-section-title">' + esc(sec.key) + '</h2>' +
      '<p class="lib-section-intro">' + esc(sec.intro) + '</p>' +
      books.map(b => bookCard(b, bookshopUrl, amazonUrl)).join('') +
      '</section>';
  }).join('');
  const introHtml = '<section class="lib-intro"><p>Stoicism has three core voices, ' +
    'Marcus Aurelius, Epictetus, and Seneca, and a long line of interpreters and kindred ' +
    'thinkers around them. This is where to start and where to go next: ' + READING_LIST.length +
    ' books, each in the translation worth reading, with a note on why it matters. ' +
    'No affiliate padding, no filler, only the books behind the practice.</p></section>';

  const html = '<!doctype html><html lang="en"><head>' +
    '<meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    GA +
    '<title>' + esc(title) + '</title>' +
    '<meta name="description" content="' + esc(desc) + '">' +
    '<meta name="robots" content="index, follow, max-image-preview:large">' +
    '<link rel="canonical" href="' + canonical + '">' +
    '<meta property="og:type" content="website">' +
    '<meta property="og:site_name" content="Marcus">' +
    '<meta property="og:title" content="The Stoic Library — Best Books on Stoicism">' +
    '<meta property="og:description" content="' + esc(desc) + '">' +
    '<meta property="og:url" content="' + canonical + '">' +
    '<meta property="og:image" content="' + SITE + '/og-image.png">' +
    '<meta property="og:image:width" content="1200">' +
    '<meta property="og:image:height" content="630">' +
    '<meta name="twitter:card" content="summary_large_image">' +
    '<meta name="twitter:title" content="The Stoic Library — Best Books on Stoicism">' +
    '<meta name="twitter:description" content="' + esc(desc) + '">' +
    '<meta name="twitter:image" content="' + SITE + '/og-image.png">' +
    '<link rel="icon" href="/favicon.ico" sizes="48x48">' +
    '<link rel="icon" type="image/png" href="/favicon.png">' +
    '<link rel="apple-touch-icon" href="/apple-touch-icon.png">' +
    '<link rel="preconnect" href="https://fonts.googleapis.com">' +
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
    '<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Inter:ital,wght@0,400;0,500;1,300;1,400&display=swap" rel="stylesheet">' +
    '<style>' + CSS + '</style>' +
    '<script type="application/ld+json">' + JSON.stringify(jsonLd(READING_LIST)) + '</script>' +
    '</head><body>' +
    '<nav class="lib-nav">' +
    '<a class="lib-brand" href="/"><img src="/skull-gold.png" alt="Marcus" width="40" height="40"><span>Marcus</span></a>' +
    '<div class="lib-nav-right">' +
    '<a class="lib-nav-link" href="/meditations">Daily Meditations</a>' +
    '<a class="lib-nav-cta" href="/">Get the app →</a>' +
    '</div></nav>' +
    '<header class="lib-hero"><div class="lib-hero-inner">' +
    '<img class="lib-hero-skull" src="/skull-gold.png" alt="Marcus" width="120" height="120">' +
    '<p class="lib-eyebrow">The Library</p>' +
    '<h1 class="lib-title">The Stoic Library</h1>' +
    '<p class="lib-hero-copy">The books behind the practice. Primary sources in the translations worth reading, ' +
    'the modern interpreters who make them legible, and the adjacent thinkers working the same ground. ' +
    'Every entry is one we actually recommend.</p>' +
    '<p class="lib-disclosure-top">Some links below are affiliate links. <a href="#disclosure">How this works →</a></p>' +
    jumpNav +
    '</div></header>' +
    '<main class="lib-main">' + introHtml + sectionsHtml +
    '<section class="lib-app">' +
    '<img class="lib-app-skull" src="/skull-gold.png" alt="" width="64" height="64">' +
    '<p class="lib-app-copy">Marcus turns these sources into a daily practice: a morning compass, a daily reading, ' +
    'and a structured evening reckoning, for iOS.</p>' +
    '<a class="lib-nav-cta" href="/">Explore the app →</a></section>' +
    '<section class="lib-disclosure" id="disclosure"><h2>Affiliate disclosure</h2><p>' + esc(DISCLOSURE) + '</p></section>' +
    '</main>' +
    '<footer class="lib-footer"><p>Marcus &middot; A Stoic Practice App &middot; ' +
    '<a href="/">getmarcus.app</a> &middot; <a href="/meditations">Daily Meditations</a> &middot; ' +
    '<a href="/library">The Library</a></p></footer>' +
    '</body></html>';

  fs.writeFileSync(OUT, html, 'utf8');
  console.log('Built library: ' + READING_LIST.length + ' book(s) → public/library.html');
}

const CSS = `
:root{--bg:#080808;--bg-deep:#040404;--border:#252525;--border-mid:#2a2a2a;
--text-primary:#F0F0F0;--text-secondary:#C0C0C0;--text-muted:#888;--text-dim:#7A7A7A;--accent:#FFCE82;--accent-dim:#B38B5B;
--display:'Cinzel',Georgia,serif;--body:'Inter',-apple-system,BlinkMacSystemFont,'Helvetica Neue',sans-serif;}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--text-primary);font-family:var(--body);line-height:1.6;-webkit-font-smoothing:antialiased}
a{color:inherit;text-decoration:none}
.lib-nav{position:fixed;top:0;left:0;right:0;z-index:100;height:64px;background:rgba(4,4,4,.94);
backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border-bottom:1px solid var(--border);
display:flex;align-items:center;justify-content:space-between;padding:0 clamp(20px,5vw,40px)}
.lib-brand{display:flex;align-items:center;gap:10px}
.lib-brand img{width:40px;height:40px;object-fit:contain;opacity:.9}
.lib-brand span{font-family:var(--display);font-size:24px;font-weight:400;letter-spacing:.5px}
.lib-nav-right{display:flex;align-items:center;gap:22px}
.lib-nav-link{font-size:13px;letter-spacing:.3px;color:var(--text-muted);transition:color .15s}
.lib-nav-link:hover{color:var(--text-secondary)}
.lib-nav-cta{background:var(--accent);color:#000;font-size:13px;font-weight:700;letter-spacing:.3px;padding:10px 20px;border-radius:8px;transition:opacity .15s}
.lib-nav-cta:hover{opacity:.85}
@media(max-width:560px){.lib-nav-link{display:none}}
.lib-hero{position:relative;overflow:hidden;background:var(--bg-deep);border-bottom:1px solid var(--border);text-align:center;padding:132px 24px 64px}
.lib-hero::before{content:'';position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse 65% 55% at 50% 38%,rgba(255,206,130,.26) 0%,rgba(255,206,130,.07) 44%,transparent 74%)}
.lib-hero-inner{position:relative;max-width:640px;margin:0 auto}
.lib-hero-skull{width:120px;height:120px;object-fit:contain;opacity:.92;margin-bottom:24px;filter:drop-shadow(0 0 40px rgba(255,206,130,.18))}
.lib-title{font-family:var(--display);font-size:clamp(38px,8vw,64px);font-weight:400;color:#fff;letter-spacing:1px;line-height:1;margin-bottom:20px}
.lib-hero-copy{font-size:clamp(15px,2.3vw,18px);color:var(--text-secondary);max-width:560px;margin:0 auto 20px;line-height:1.7}
.lib-eyebrow{font-size:12px;letter-spacing:3px;text-transform:uppercase;color:var(--accent);margin-bottom:16px}
.lib-disclosure-top{font-size:13px;color:var(--text-dim)}
.lib-disclosure-top a{color:var(--accent-dim)}
.lib-jump{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:26px}
.lib-jump a{font-size:12px;letter-spacing:.4px;color:var(--text-secondary);border:1px solid var(--border-mid);border-radius:999px;padding:7px 15px;transition:border-color .15s,color .15s}
.lib-jump a:hover{border-color:var(--accent-dim);color:var(--text-primary)}
.lib-main{max-width:720px;margin:0 auto;padding:0 24px}
.lib-intro{padding:44px 0 4px}
.lib-intro p{font-size:16px;color:var(--text-secondary);line-height:1.75}
.lib-section{padding:52px 0 8px;scroll-margin-top:80px}
.lib-section-title{font-family:var(--display);font-size:clamp(24px,4vw,32px);color:var(--accent);letter-spacing:.5px;margin-bottom:8px}
.lib-section-intro{font-size:15px;color:var(--text-muted);margin-bottom:12px;line-height:1.6}
.lib-book{display:flex;gap:24px;align-items:flex-start;padding:28px 0;border-top:1px solid var(--border)}
.lib-cover-wrap{flex:0 0 auto;width:96px}
.lib-cover{width:96px;height:auto;border-radius:4px;display:block;background:#141414;box-shadow:0 6px 22px rgba(0,0,0,.5)}
.lib-cover-missing{display:none}
.lib-book-body{flex:1;min-width:0}
.lib-book-title{font-family:var(--display);font-size:22px;color:var(--text-primary);line-height:1.25;margin-bottom:6px}
.lib-pill{display:inline-block;vertical-align:middle;margin-left:12px;font-family:var(--body);font-size:11px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:#000;background:var(--accent);border-radius:999px;padding:3px 10px}
.lib-book-meta{font-size:12.5px;letter-spacing:.4px;text-transform:uppercase;color:var(--text-dim);margin-bottom:14px}
.lib-book-why{font-size:16px;color:var(--text-secondary);line-height:1.72;margin-bottom:18px}
.lib-actions{display:flex;gap:12px;flex-wrap:wrap}
@media(max-width:520px){.lib-book{gap:16px}.lib-cover-wrap{width:66px}.lib-cover{width:66px}}
.lib-btn{display:inline-block;font-size:13px;font-weight:600;letter-spacing:.3px;padding:10px 20px;border-radius:8px;transition:opacity .15s,background .15s}
.lib-btn-primary{background:var(--accent);color:#000}
.lib-btn-primary:hover{opacity:.85}
.lib-btn-secondary{background:transparent;color:var(--text-secondary);border:1px solid var(--border-mid)}
.lib-btn-secondary:hover{border-color:var(--accent-dim);color:var(--text-primary)}
.lib-app{border-top:1px solid var(--border);padding:52px 0 12px;margin-top:40px;text-align:center}
.lib-app-skull{width:64px;height:64px;object-fit:contain;opacity:.85;margin-bottom:16px;filter:drop-shadow(0 0 26px rgba(255,206,130,.15))}
.lib-app-copy{font-size:15px;color:var(--text-secondary);max-width:500px;margin:0 auto 20px;line-height:1.65}
.lib-app .lib-nav-cta{display:inline-block;padding:13px 26px;font-size:14px}
.lib-disclosure{border-top:1px solid var(--border);margin-top:44px;padding:32px 0 8px}
.lib-disclosure h2{font-family:var(--display);font-size:18px;font-weight:400;color:var(--text-secondary);margin-bottom:10px}
.lib-disclosure p{font-size:13.5px;color:var(--text-dim);line-height:1.7;max-width:640px}
.lib-footer{border-top:1px solid var(--border);margin-top:40px;padding:28px 24px;text-align:center;font-size:13px;color:var(--text-dim)}
.lib-footer a{color:var(--accent-dim)}
`;

build();
