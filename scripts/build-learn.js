#!/usr/bin/env node
// /learn — the single door from the landing page into everything else.
//
// WHY THIS EXISTS. The homepage is a conversion surface: its traffic arrives
// from the App Store listing, direct, or paid, already close to installing, and
// every extra nav item is an exit. It had grown to eight items plus the CTA,
// three of them leaking into content. This hub replaces those three with one, so
// the article count can grow without the homepage nav growing with it.
//
// URLS ARE FLAT AND THIS HUB IS NAVIGATION ONLY. Articles live at
// /premeditatio-malorum, not /learn/premeditatio-malorum, deliberately: a hub
// may get renamed or restructured, and if it were a URL prefix every article
// would break with it. Nav is free to change, URLs are not.
//
// Re-run when a page is added or flipped to published:
//   node scripts/build-learn.js

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SITE = 'https://getmarcus.app';
const OUT = path.join(ROOT, 'public', 'learn.html');
const GA = '<script src="/analytics.js"></script>';

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// `published: false` entries are drafted but not built yet. They are listed here
// so the hub is the one place that knows the whole plan, and are skipped at
// render time so the page never links to a 404. Flip the flag when the page
// ships. The build prints what is still pending.
const PILLARS = [
  {
    key: 'attribution',
    title: 'Sources and attribution',
    intro: 'A great deal of what circulates as Stoic wisdom is not. This is the part of the site that checks.',
    pages: [
      { href: '/misattributed-stoic-quotes', title: 'The Stoic quotes that are not Stoic', blurb: 'Twenty quotations credited to Marcus Aurelius, Seneca and Epictetus that belong to a screenwriter, a songwriter, Voltaire and Kant. Found by auditing our own library.', published: true },
    ],
  },
  {
    key: 'practice',
    title: 'The practice',
    intro: 'How the Stoics actually worked on themselves, daily, and how to run the same exercises without abandoning them by February.',
    pages: [
      { href: '/how-to-keep-a-stoic-journal', title: 'How to keep a Stoic journal', blurb: 'The most famous book in Stoicism is a private notebook. What made it a Stoic one, and how to keep your own.', published: true },
      { href: '/stoic-evening-examination', title: 'The Stoic evening examination', blurb: 'Seneca put himself on trial every night, as a judge who does not frighten the defendant. The oldest documented practice in the tradition.', published: true },
      { href: '/premeditatio-malorum', title: 'Premeditatio malorum', blurb: 'Rehearsing what could go wrong, and why it is the opposite of worrying about it.', published: true },
      { href: '/dichotomy-of-control', title: 'The dichotomy of control', blurb: 'The most quoted idea in Stoicism, and the most consistently flattened in the retelling.', published: true },
      { href: '/four-stoic-virtues', title: 'The four Stoic virtues', blurb: 'Wisdom, courage, justice, temperance. Three of the four are about acting, and one is entirely about other people.', published: true },
    ],
  },
  {
    key: 'people',
    title: 'The Stoics and their books',
    intro: 'The voices behind the practice, and the translations worth actually owning.',
    pages: [
      { href: '/stoics', title: 'The Stoics', blurb: 'Twelve figures in the order they lived, from a shipwrecked merchant to an emperor. What each taught and where to start.', published: true },
      { href: '/library', title: 'The Library', blurb: 'Twenty-four books: primary sources in the best translations, modern interpreters, and adjacent thinkers.', published: true },
      { href: '/meditations', title: 'Daily Meditations', blurb: 'One short Stoic reflection each morning, tied to something happening in the world. Free.', published: true },
    ],
  },
];

function build() {
  const title = 'Learn Stoicism — Practice, Sources and the Stoics | Marcus';
  const desc = 'How the Stoics actually practiced: the evening examination, premeditatio malorum, the dichotomy of control ' +
    'and the four virtues. Plus the twelve figures behind it and which translations to read.';
  const canonical = SITE + '/learn';

  const live = PILLARS.map(p => ({ ...p, pages: p.pages.filter(x => x.published) })).filter(p => p.pages.length);
  const pending = PILLARS.flatMap(p => p.pages.filter(x => !x.published));

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Learn Stoicism',
    description: desc,
    url: canonical,
    hasPart: live.flatMap(p => p.pages.map(x => ({
      '@type': 'WebPage', name: x.title, url: SITE + x.href, description: x.blurb,
    }))),
  };

  const sections = live.map(p =>
    '<section class="ln-section"><h2 class="ln-section-title">' + esc(p.title) + '</h2>' +
    '<p class="ln-section-intro">' + esc(p.intro) + '</p>' +
    '<div class="ln-list">' +
    p.pages.map(x =>
      '<a class="ln-item" href="' + esc(x.href) + '">' +
      '<h3 class="ln-item-title">' + esc(x.title) + '</h3>' +
      '<p class="ln-item-blurb">' + esc(x.blurb) + '</p></a>').join('') +
    '</div></section>').join('');

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
    '<meta property="og:title" content="Learn Stoicism">' +
    '<meta property="og:description" content="' + esc(desc) + '">' +
    '<meta property="og:url" content="' + canonical + '">' +
    '<meta property="og:image" content="' + SITE + '/og-image.png">' +
    '<meta name="twitter:card" content="summary_large_image">' +
    '<meta name="twitter:title" content="Learn Stoicism">' +
    '<meta name="twitter:description" content="' + esc(desc) + '">' +
    '<meta name="twitter:image" content="' + SITE + '/og-image.png">' +
    '<link rel="icon" href="/favicon.ico" sizes="48x48">' +
    '<link rel="icon" type="image/png" href="/favicon.png">' +
    '<link rel="apple-touch-icon" href="/apple-touch-icon.png">' +
    '<link rel="preconnect" href="https://fonts.googleapis.com">' +
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
    '<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Inter:ital,wght@0,400;0,500;1,300;1,400&display=swap" rel="stylesheet">' +
    '<style>' + CSS + '</style>' +
    '<script type="application/ld+json">' + JSON.stringify(jsonLd) + '</script>' +
    '</head><body>' +
    '<nav class="ln-nav">' +
    '<a class="ln-brand" href="/"><img src="/skull-gold.png" alt="Marcus" width="40" height="40"><span>Marcus</span></a>' +
    '<div class="ln-nav-right">' +
    '<a class="ln-nav-link" href="/learn">Learn</a>' +
    '<a class="ln-nav-cta" href="/">Get the app →</a>' +
    '</div></nav>' +
    '<header class="ln-hero"><div class="ln-hero-inner">' +
    '<p class="ln-eyebrow">Learn</p>' +
    '<h1 class="ln-title">Stoicism, as it was actually practiced</h1>' +
    '<p class="ln-hero-copy">Not a summary of the philosophy. The exercises the Stoics ran on themselves daily, ' +
    'the people who wrote them down, and an honest account of which famous quotations are not theirs at all.</p>' +
    '</div></header>' +
    '<main class="ln-main">' + sections +
    '<section class="ln-app">' +
    '<img class="ln-app-skull" src="/skull-gold.png" alt="" width="64" height="64">' +
    '<p class="ln-app-copy">Marcus turns all of this into a daily practice for iOS: a morning preparation, ' +
    'a daily reading, and a structured evening examination.</p>' +
    '<a class="ln-nav-cta" href="/">Explore the app →</a></section>' +
    '</main>' +
    '<footer class="ln-footer"><p>Marcus &middot; A Stoic Practice App &middot; ' +
    '<a href="/">getmarcus.app</a> &middot; <a href="/learn">Learn</a> &middot; ' +
    '<a href="/stoics">The Stoics</a> &middot; <a href="/library">The Library</a> &middot; ' +
    '<a href="/meditations">Daily Meditations</a></p></footer>' +
    '</body></html>';

  fs.writeFileSync(OUT, html, 'utf8');
  console.log('Built learn hub: ' + live.flatMap(p => p.pages).length + ' page(s) linked → public/learn.html');
  if (pending.length) {
    console.log('  pending (drafted, not built): ' + pending.map(p => p.href).join(', '));
  }
}

const CSS = `
*{box-sizing:border-box}
body{margin:0;background:#0d0d0f;color:#e8e4dc;font-family:Inter,system-ui,-apple-system,sans-serif;line-height:1.65;-webkit-font-smoothing:antialiased}
a{color:inherit}
img{max-width:100%;display:block}
.ln-nav{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px 24px;border-bottom:1px solid rgba(232,228,220,.09);flex-wrap:wrap}
.ln-brand{display:flex;align-items:center;gap:10px;text-decoration:none;font-family:Cinzel,Georgia,serif;font-size:19px;letter-spacing:.02em}
.ln-brand img{width:40px;height:40px;object-fit:contain;opacity:.9}
.ln-nav-right{display:flex;align-items:center;gap:20px;flex-wrap:wrap}
.ln-nav-link{text-decoration:none;font-size:14px;color:rgba(232,228,220,.72)}
.ln-nav-cta{text-decoration:none;font-size:14px;color:#0d0d0f;background:#c9a961;padding:9px 16px;border-radius:999px;white-space:nowrap}
.ln-hero{padding:72px 24px 44px;border-bottom:1px solid rgba(232,228,220,.09)}
.ln-hero-inner{max-width:720px;margin:0 auto}
.ln-eyebrow{font-family:Cinzel,Georgia,serif;font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:#c9a961;margin:0 0 14px}
.ln-title{font-family:Cinzel,Georgia,serif;font-size:clamp(32px,5.4vw,48px);font-weight:600;margin:0 0 20px;letter-spacing:-.01em;line-height:1.15;text-wrap:balance}
.ln-hero-copy{font-size:18px;color:rgba(232,228,220,.78);margin:0;max-width:62ch}
.ln-main{max-width:760px;margin:0 auto;padding:48px 24px 8px}
.ln-section{margin-bottom:60px}
.ln-section-title{font-family:Cinzel,Georgia,serif;font-size:13px;letter-spacing:.2em;text-transform:uppercase;color:#c9a961;margin:0 0 12px;padding-bottom:10px;border-bottom:1px solid rgba(232,228,220,.09)}
.ln-section-intro{font-size:16px;color:rgba(232,228,220,.66);margin:0 0 28px;max-width:64ch}
.ln-list{display:flex;flex-direction:column;gap:4px}
.ln-item{text-decoration:none;display:block;padding:18px 20px;margin:0 -20px;border-radius:8px;transition:background .15s}
.ln-item:hover{background:rgba(232,228,220,.04)}
.ln-item:hover .ln-item-title{color:#c9a961}
.ln-item-title{font-family:Cinzel,Georgia,serif;font-size:20px;font-weight:600;margin:0 0 6px;transition:color .15s}
.ln-item-blurb{font-size:15.5px;color:rgba(232,228,220,.72);margin:0;max-width:66ch}
.ln-app{text-align:center;margin:40px 0 0;padding:44px 24px;border-top:1px solid rgba(232,228,220,.09)}
.ln-app-skull{width:56px;height:56px;object-fit:contain;margin:0 auto 16px;opacity:.9}
.ln-app-copy{font-size:16px;color:rgba(232,228,220,.78);max-width:54ch;margin:0 auto 20px}
.ln-footer{text-align:center;padding:32px 24px 48px;font-size:13px;color:rgba(232,228,220,.45)}
.ln-footer a{color:rgba(232,228,220,.7)}
@media (max-width:640px){.ln-item{margin:0;padding:16px 0}}
`;

build();
