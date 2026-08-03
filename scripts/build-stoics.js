#!/usr/bin/env node
// The Stoics — public reference section builder.
//
// Renders constants/stoics.js (the same twelve figures the app shows) into
// static pages: an index at public/stoics.html (/stoics) and one page per
// figure at public/stoics/<id>.html (/stoics/seneca), served via Vercel
// cleanUrls.
//
// A page per figure rather than one long page: "Musonius Rufus" is a real
// search term, and a section of a shared page will not rank for it. Each page
// carries Person JSON-LD and its own canonical.
//
//   - Further reading joins bookIds into constants/library.js, so the Bookshop
//     affiliate links and Open Library covers match /library exactly.
//   - Affiliate links carry rel="sponsored nofollow" and the FTC disclosure,
//     same as the library page.
//   - Portraits are copied out of assets/ and downscaled into public/img/stoics.
//
// Re-run when the figures or the reading list change:
//   node scripts/build-stoics.js

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SITE = 'https://getmarcus.app';
const OUT_INDEX = path.join(ROOT, 'public', 'stoics.html');
const OUT_DIR = path.join(ROOT, 'public', 'stoics');
const IMG_DIR = path.join(ROOT, 'public', 'img', 'stoics');
const GA = '<script src="/analytics.js"></script>';
// Portraits ship at up to 620KB each straight from Wikimedia. Twelve of those
// on one index page is several megabytes, so they are downscaled on build.
const MAX_PORTRAIT_WIDTH = 900;

// Load a constants/*.js data module into this CommonJS script. Same trick as
// build-library.js, plus require() rewriting: constants/stoics.js references
// portraits as require('../assets/...'), which means nothing here, so each one
// becomes the string path it was given and is resolved to a web path later.
function loadModule(file, exportNames) {
  const src = fs.readFileSync(path.join(ROOT, 'constants', file), 'utf8')
    .replace(/export\s+function/g, 'function')
    .replace(/export\s+const/g, 'const')
    .replace(/require\(\s*'([^']+)'\s*\)/g, "'__ASSET__$1'");
  const cjs = src + '\nmodule.exports={' + exportNames.join(',') + '};';
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', cjs)(mod, mod.exports, require);
  return mod.exports;
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// `life` is authored with \n\n paragraph breaks.
function paragraphs(text, cls) {
  return String(text || '').split(/\n{2,}/).map(p =>
    '<p' + (cls ? ' class="' + cls + '"' : '') + '>' + esc(p.trim()) + '</p>'
  ).join('');
}

function coverUrl(isbn) {
  return 'https://covers.openlibrary.org/b/isbn/' + encodeURIComponent(isbn) + '-M.jpg?default=false';
}

// Copy each portrait into public/img/stoics, downscaled. sips ships with macOS;
// if it is missing the file is copied at full size rather than failing the
// build, since a heavy image beats a broken one.
function preparePortrait(assetRef) {
  if (!assetRef || !String(assetRef).startsWith('__ASSET__')) return null;
  const rel = String(assetRef).replace('__ASSET__', '');
  const src = path.join(ROOT, 'constants', rel);
  if (!fs.existsSync(src)) {
    console.warn('  ! portrait missing, skipping: ' + rel);
    return null;
  }
  fs.mkdirSync(IMG_DIR, { recursive: true });
  const base = path.basename(src);
  const dest = path.join(IMG_DIR, base);
  fs.copyFileSync(src, dest);
  try {
    execFileSync('sips', ['-Z', String(MAX_PORTRAIT_WIDTH), dest], { stdio: 'ignore' });
  } catch (e) {
    console.warn('  ! could not downscale ' + base + ' (' + e.message.split('\n')[0] + ')');
  }
  return '/img/stoics/' + base;
}

// A figure with no surviving likeness gets the name set in Cinzel, matching
// what the app does. Inventing a face would undercut the accuracy claim the
// rest of the app makes, which is the whole point of the imageNote field.
function portrait(fig, cls) {
  if (fig.webImage) {
    return '<img class="st-portrait ' + cls + '" src="' + esc(fig.webImage) + '" alt="' +
      esc(fig.name) + '" loading="lazy">';
  }
  return '<div class="st-portrait st-portrait-none ' + cls + '"><span>' + esc(fig.name) + '</span></div>';
}

function bookCard(b, bookshopUrl, amazonUrl) {
  return '<article class="st-book">' +
    '<div class="st-cover-wrap">' +
    '<img class="st-cover" src="' + esc(coverUrl(b.isbn)) + '" alt="' + esc(b.title) + ' cover" ' +
    'loading="lazy" width="80" height="122" ' +
    'onerror="this.closest(\'.st-cover-wrap\').classList.add(\'st-cover-missing\')">' +
    '<span class="st-cover-fallback">' + esc(b.title) + '</span></div>' +
    '<div class="st-book-body">' +
    '<h3 class="st-book-title">' + esc(b.title) + '</h3>' +
    '<p class="st-book-meta">' + esc([b.author, b.translator ? 'trans. ' + b.translator : ''].filter(Boolean).join('  ·  ')) + '</p>' +
    '<p class="st-book-why">' + esc(b.why) + '</p>' +
    '<div class="st-actions">' +
    '<a class="st-btn st-btn-primary" href="' + esc(bookshopUrl(b.isbn)) + '" rel="sponsored nofollow noopener" target="_blank">Bookshop.org</a>' +
    '<a class="st-btn st-btn-secondary" href="' + esc(amazonUrl(b.asin)) + '" rel="sponsored nofollow noopener" target="_blank">Amazon</a>' +
    '</div></div></article>';
}

// Index-page headings for the section keys in constants/stoics.js. "The Stoics"
// is the page's own title, so repeating it as the first section heading made
// the top of the page say it three times over. Web-only: the app and the figure
// page eyebrows still use the raw section value.
const SECTION_LABELS = { 'The Stoics': 'The school' };

const DISCLOSURE =
  'Marcus earns a commission from qualifying purchases made through the links on this page, ' +
  'at no additional cost to you. We link to Bookshop.org first (which supports independent ' +
  'bookstores) and Amazon as a fallback. We only list books we genuinely recommend.';

function head(opts) {
  return '<!doctype html><html lang="en"><head>' +
    '<meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    GA +
    '<title>' + esc(opts.title) + '</title>' +
    '<meta name="description" content="' + esc(opts.desc) + '">' +
    '<meta name="robots" content="index, follow, max-image-preview:large">' +
    '<link rel="canonical" href="' + esc(opts.canonical) + '">' +
    '<meta property="og:type" content="' + (opts.ogType || 'website') + '">' +
    '<meta property="og:site_name" content="Marcus">' +
    '<meta property="og:title" content="' + esc(opts.ogTitle || opts.title) + '">' +
    '<meta property="og:description" content="' + esc(opts.desc) + '">' +
    '<meta property="og:url" content="' + esc(opts.canonical) + '">' +
    '<meta property="og:image" content="' + esc(opts.ogImage || (SITE + '/og-image.png')) + '">' +
    '<meta name="twitter:card" content="summary_large_image">' +
    '<meta name="twitter:title" content="' + esc(opts.ogTitle || opts.title) + '">' +
    '<meta name="twitter:description" content="' + esc(opts.desc) + '">' +
    '<meta name="twitter:image" content="' + esc(opts.ogImage || (SITE + '/og-image.png')) + '">' +
    '<link rel="icon" href="/favicon.ico" sizes="48x48">' +
    '<link rel="icon" type="image/png" href="/favicon.png">' +
    '<link rel="apple-touch-icon" href="/apple-touch-icon.png">' +
    '<link rel="preconnect" href="https://fonts.googleapis.com">' +
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
    '<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Inter:ital,wght@0,400;0,500;1,300;1,400&display=swap" rel="stylesheet">' +
    '<style>' + CSS + '</style>' +
    (opts.jsonLd ? '<script type="application/ld+json">' + JSON.stringify(opts.jsonLd) + '</script>' : '') +
    '</head><body>';
}

const NAV =
  '<nav class="st-nav">' +
  '<a class="st-brand" href="/"><img src="/skull-gold.png" alt="Marcus" width="40" height="40"><span>Marcus</span></a>' +
  '<div class="st-nav-right">' +
  '<a class="st-nav-link" href="/stoics">The Stoics</a>' +
  '<a class="st-nav-link" href="/library">Library</a>' +
  '<a class="st-nav-link" href="/meditations">Daily Meditations</a>' +
  '<a class="st-nav-cta" href="/">Get the app →</a>' +
  '</div></nav>';

const FOOTER =
  '<footer class="st-footer"><p>Marcus &middot; A Stoic Practice App &middot; ' +
  '<a href="/">getmarcus.app</a> &middot; <a href="/stoics">The Stoics</a> &middot; ' +
  '<a href="/library">The Library</a> &middot; <a href="/meditations">Daily Meditations</a></p></footer>';

function figurePage(fig, prev, next, books, bookshopUrl, amazonUrl) {
  const canonical = SITE + '/stoics/' + fig.id;
  const desc = fig.summary + ' ' + fig.dates + '. ' + fig.teaching;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: fig.name,
    description: fig.summary,
    url: canonical,
    ...(fig.webImage ? { image: SITE + fig.webImage } : {}),
    ...(fig.wikipedia ? { sameAs: [fig.wikipedia] } : {}),
    jobTitle: fig.role,
  };

  const worksHtml = (fig.works || []).length
    ? '<section class="st-block"><h2>Works</h2><ul class="st-works">' +
      fig.works.map(w => '<li>' + esc(w) + '</li>').join('') + '</ul></section>'
    : '';

  const booksHtml = books.length
    ? '<section class="st-block"><h2>Where to start reading</h2>' +
      books.map(b => bookCard(b, bookshopUrl, amazonUrl)).join('') +
      '<p class="st-disclosure-inline">Some links above are affiliate links. ' +
      '<a href="/library#disclosure">How this works →</a></p></section>'
    : '';

  // The credit line renders only when constants/stoics.js carries one. Museum
  // photographs are not automatically free to republish, so this is where the
  // per-image licence and photographer go once they are recorded.
  const creditHtml = fig.imageCredit
    ? '<p class="st-credit">' + esc(fig.imageCredit) + '</p>'
    : '';

  const pager =
    '<nav class="st-pager">' +
    (prev ? '<a class="st-pager-prev" href="/stoics/' + prev.id + '"><span>Before</span>' + esc(prev.name) + '</a>' : '<span></span>') +
    (next ? '<a class="st-pager-next" href="/stoics/' + next.id + '"><span>After</span>' + esc(next.name) + '</a>' : '<span></span>') +
    '</nav>';

  return head({
    title: fig.name + ' — Life, Teaching and Where to Start | Marcus',
    ogTitle: fig.name + ' — ' + fig.role,
    desc,
    canonical,
    ogType: 'article',
    ogImage: fig.webImage ? SITE + fig.webImage : undefined,
    jsonLd,
  }) +
    NAV +
    '<article class="st-fig">' +
    '<header class="st-fig-head">' +
    portrait(fig, 'st-portrait-lg') +
    '<div class="st-fig-headtext">' +
    '<p class="st-eyebrow">' + esc(fig.section) + '</p>' +
    '<h1 class="st-fig-name">' + esc(fig.name) + '</h1>' +
    '<p class="st-fig-role">' + esc(fig.role) + '</p>' +
    '<p class="st-fig-dates">' + esc(fig.dates) + '</p>' +
    '</div></header>' +
    // imageNote is the honesty field: it says what the picture actually is, and
    // constants/stoics.js instructs that it always appear under the image.
    '<p class="st-imagenote">' + esc(fig.imageNote) + '</p>' + creditHtml +
    '<section class="st-block st-lead">' + paragraphs(fig.life) + '</section>' +
    // Never rendered with quote marks or an attribution dash: it is a plain
    // statement of the idea, not the figure's words.
    '<section class="st-block"><h2>What he taught</h2>' +
    '<p class="st-teaching">' + esc(fig.teaching) + '</p></section>' +
    worksHtml +
    '<section class="st-block"><h2>Who it is for</h2><p>' + esc(fig.forWhom) + '</p></section>' +
    booksHtml +
    (fig.wikipedia ? '<p class="st-external"><a href="' + esc(fig.wikipedia) + '" rel="noopener" target="_blank">Read more on Wikipedia →</a></p>' : '') +
    pager +
    '<section class="st-app">' +
    '<img class="st-app-skull" src="/skull-gold.png" alt="" width="64" height="64">' +
    '<p class="st-app-copy">Marcus turns these voices into a daily practice: a morning compass, ' +
    'a daily reading, and a structured evening reckoning, for iOS.</p>' +
    '<a class="st-nav-cta" href="/">Explore the app →</a></section>' +
    '</article>' + FOOTER + '</body></html>';
}

function indexPage(figures) {
  const canonical = SITE + '/stoics';
  const desc = 'The twelve figures behind Stoic practice, in the order they lived: who they were, ' +
    'what each one taught, and which book to read first. From Zeno on the painted porch to Marcus Aurelius.';
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'The Stoics',
    description: desc,
    url: canonical,
    numberOfItems: figures.length,
    itemListElement: figures.map((f, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Person',
        name: f.name,
        description: f.summary,
        url: SITE + '/stoics/' + f.id,
        ...(f.wikipedia ? { sameAs: [f.wikipedia] } : {}),
      },
    })),
  };

  const sections = [];
  for (const f of figures) {
    if (!sections.length || sections[sections.length - 1].key !== f.section) {
      sections.push({ key: f.section, figures: [] });
    }
    sections[sections.length - 1].figures.push(f);
  }

  const sectionsHtml = sections.map(sec =>
    '<section class="st-section"><h2 class="st-section-title">' + esc(SECTION_LABELS[sec.key] || sec.key) + '</h2>' +
    '<div class="st-grid">' +
    sec.figures.map(f =>
      '<a class="st-card" href="/stoics/' + f.id + '">' +
      portrait(f, 'st-portrait-sm') +
      '<h3 class="st-card-name">' + esc(f.name) + '</h3>' +
      '<p class="st-card-dates">' + esc(f.dates) + '</p>' +
      '<p class="st-card-summary">' + esc(f.summary) + '</p>' +
      '</a>').join('') +
    '</div></section>').join('');

  return head({
    title: 'The Stoics — Who They Were and What They Taught | Marcus',
    ogTitle: 'The Stoics — Who They Were and What They Taught',
    desc, canonical, jsonLd,
  }) +
    NAV +
    '<header class="st-hero"><div class="st-hero-inner">' +
    '<img class="st-hero-skull" src="/skull-gold.png" alt="Marcus" width="120" height="120">' +
    '<h1 class="st-title">The Stoics</h1>' +
    '<p class="st-hero-copy">Twelve figures, in the order they lived. A shipwrecked merchant who ' +
    'founded a school on a public porch, a slave who taught emperors, and the most powerful man ' +
    'alive writing privately to keep himself honest. Who each one was, what they taught, and ' +
    'the book worth reading first.</p>' +
    '</div></header>' +
    '<main class="st-main">' + sectionsHtml +
    '<section class="st-app">' +
    '<img class="st-app-skull" src="/skull-gold.png" alt="" width="64" height="64">' +
    '<p class="st-app-copy">Marcus turns these voices into a daily practice, for iOS.</p>' +
    '<a class="st-nav-cta" href="/">Explore the app →</a></section>' +
    '</main>' + FOOTER + '</body></html>';
}

function build() {
  const { STOICS } = loadModule('stoics.js', ['STOICS']);
  const { READING_LIST, bookshopUrl, amazonUrl } = loadModule('library.js',
    ['READING_LIST', 'bookshopUrl', 'amazonUrl']);

  const figures = STOICS.map(f => ({ ...f, webImage: preparePortrait(f.image) }));

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_INDEX, indexPage(figures), 'utf8');

  let missingBooks = 0;
  figures.forEach((fig, i) => {
    const books = (fig.bookIds || []).map(id => {
      const b = READING_LIST.find(x => x.id === id);
      if (!b) { console.warn('  ! ' + fig.id + ' references unknown bookId: ' + id); missingBooks++; }
      return b;
    }).filter(Boolean);
    const html = figurePage(fig, figures[i - 1], figures[i + 1], books, bookshopUrl, amazonUrl);
    fs.writeFileSync(path.join(OUT_DIR, fig.id + '.html'), html, 'utf8');
  });

  const withPortrait = figures.filter(f => f.webImage).length;
  console.log('Built stoics: ' + figures.length + ' figure(s) → public/stoics.html + public/stoics/*.html');
  console.log('  portraits: ' + withPortrait + ' rendered, ' + (figures.length - withPortrait) + ' typographic');
  if (missingBooks) console.log('  ! ' + missingBooks + ' unresolved bookId(s)');
  const uncredited = figures.filter(f => f.webImage && !f.imageCredit).length;
  if (uncredited) console.log('  ! ' + uncredited + ' portrait(s) have no imageCredit — see FIELD NOTES in constants/stoics.js');
}

const CSS = `
*{box-sizing:border-box}
body{margin:0;background:#0d0d0f;color:#e8e4dc;font-family:Inter,system-ui,-apple-system,sans-serif;line-height:1.65;-webkit-font-smoothing:antialiased}
a{color:inherit}
img{max-width:100%;display:block}
.st-nav{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px 24px;border-bottom:1px solid rgba(232,228,220,.09);flex-wrap:wrap}
.st-brand{display:flex;align-items:center;gap:10px;text-decoration:none;font-family:Cinzel,Georgia,serif;font-size:19px;letter-spacing:.02em}
.st-brand img{width:40px;height:40px;object-fit:contain;opacity:.9}
.st-nav-right{display:flex;align-items:center;gap:20px;flex-wrap:wrap}
.st-nav-link{text-decoration:none;font-size:14px;color:rgba(232,228,220,.72)}
.st-nav-link:hover{color:#e8e4dc}
.st-nav-cta{text-decoration:none;font-size:14px;color:#0d0d0f;background:#c9a961;padding:9px 16px;border-radius:999px;white-space:nowrap}
.st-hero{padding:64px 24px 40px;text-align:center;border-bottom:1px solid rgba(232,228,220,.09)}
.st-hero-inner{max-width:720px;margin:0 auto}
.st-hero-skull{width:110px;height:110px;object-fit:contain;margin:0 auto 20px;opacity:.92;filter:drop-shadow(0 0 40px rgba(255,206,130,.18))}
.st-eyebrow{font-family:Cinzel,Georgia,serif;font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:#c9a961;margin:0 0 10px}
.st-title{font-family:Cinzel,Georgia,serif;font-size:clamp(34px,6vw,52px);font-weight:600;margin:0 0 18px;letter-spacing:-.01em}
.st-hero-copy{font-size:17px;color:rgba(232,228,220,.76);margin:0 auto;max-width:60ch}
.st-main{max-width:1000px;margin:0 auto;padding:48px 24px 8px}
.st-section{margin-bottom:56px}
.st-section-title{font-family:Cinzel,Georgia,serif;font-size:13px;letter-spacing:.2em;text-transform:uppercase;color:#c9a961;margin:0 0 24px;padding-bottom:10px;border-bottom:1px solid rgba(232,228,220,.09)}
.st-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:28px}
.st-card{text-decoration:none;display:block}
.st-card:hover .st-card-name{color:#c9a961}
.st-portrait{width:100%;aspect-ratio:3/4;object-fit:cover;border-radius:6px;background:#17171a}
.st-portrait-none{display:flex;align-items:center;justify-content:center;padding:16px;text-align:center;border:1px solid rgba(232,228,220,.14)}
.st-portrait-none span{font-family:Cinzel,Georgia,serif;font-size:17px;color:rgba(232,228,220,.62);line-height:1.35}
.st-card-name{font-family:Cinzel,Georgia,serif;font-size:19px;font-weight:600;margin:14px 0 4px;transition:color .15s}
.st-card-dates{font-size:12.5px;letter-spacing:.06em;color:rgba(232,228,220,.5);margin:0 0 8px}
.st-card-summary{font-size:14.5px;color:rgba(232,228,220,.72);margin:0}
.st-fig{max-width:720px;margin:0 auto;padding:48px 24px 8px}
.st-fig-head{display:flex;gap:28px;align-items:flex-start;flex-wrap:wrap}
.st-portrait-lg{width:200px;flex:0 0 200px}
.st-fig-headtext{flex:1;min-width:220px}
.st-fig-name{font-family:Cinzel,Georgia,serif;font-size:clamp(30px,5vw,42px);font-weight:600;margin:0 0 8px;letter-spacing:-.01em}
.st-fig-role{font-size:16px;color:rgba(232,228,220,.8);margin:0 0 4px}
.st-fig-dates{font-size:13px;letter-spacing:.06em;color:rgba(232,228,220,.5);margin:0}
.st-imagenote{font-size:12.5px;font-style:italic;color:rgba(232,228,220,.5);margin:18px 0 0;max-width:60ch}
.st-credit{font-size:12px;color:rgba(232,228,220,.42);margin:6px 0 0}
.st-block{margin-top:40px}
.st-block h2{font-family:Cinzel,Georgia,serif;font-size:13px;letter-spacing:.2em;text-transform:uppercase;color:#c9a961;margin:0 0 16px;padding-bottom:10px;border-bottom:1px solid rgba(232,228,220,.09)}
.st-block p{font-size:17px;color:rgba(232,228,220,.84);margin:0 0 16px;max-width:66ch}
.st-lead p{font-size:17.5px}
.st-teaching{font-style:italic;color:#e8e4dc !important;border-left:2px solid #c9a961;padding-left:18px}
.st-works{margin:0;padding-left:20px;color:rgba(232,228,220,.8)}
.st-works li{margin-bottom:6px}
.st-book{display:flex;gap:18px;padding:20px 0;border-bottom:1px solid rgba(232,228,220,.07)}
.st-cover-wrap{flex:0 0 80px;position:relative}
.st-cover{width:80px;border-radius:3px;background:#17171a}
.st-cover-fallback{display:none;font-family:Cinzel,Georgia,serif;font-size:12px;line-height:1.35;color:rgba(232,228,220,.6);border:1px solid rgba(232,228,220,.14);border-radius:3px;padding:10px 8px;text-align:center}
.st-cover-missing .st-cover{display:none}
.st-cover-missing .st-cover-fallback{display:block}
.st-book-body{flex:1;min-width:0}
.st-book-title{font-family:Cinzel,Georgia,serif;font-size:17px;font-weight:600;margin:0 0 4px}
.st-book-meta{font-size:13px;color:rgba(232,228,220,.55);margin:0 0 8px !important}
.st-book-why{font-size:14.5px;color:rgba(232,228,220,.76);margin:0 0 12px !important}
.st-actions{display:flex;gap:10px;flex-wrap:wrap}
.st-btn{text-decoration:none;font-size:13px;padding:7px 14px;border-radius:999px;white-space:nowrap}
.st-btn-primary{background:#c9a961;color:#0d0d0f}
.st-btn-secondary{border:1px solid rgba(232,228,220,.22);color:rgba(232,228,220,.82)}
.st-disclosure-inline{font-size:12.5px;color:rgba(232,228,220,.5);margin-top:16px !important}
.st-disclosure-inline a{color:#c9a961}
.st-external{margin-top:32px}
.st-external a{color:#c9a961;font-size:14.5px;text-decoration:none}
.st-pager{display:flex;justify-content:space-between;gap:16px;margin-top:48px;padding-top:24px;border-top:1px solid rgba(232,228,220,.09)}
.st-pager a{text-decoration:none;font-family:Cinzel,Georgia,serif;font-size:16px;max-width:45%}
.st-pager a:hover{color:#c9a961}
.st-pager-next{text-align:right}
.st-pager span{display:block;font-family:Inter,sans-serif;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:rgba(232,228,220,.42);margin-bottom:4px}
.st-app{text-align:center;margin:64px 0 0;padding:40px 24px;border-top:1px solid rgba(232,228,220,.09)}
.st-app-skull{width:56px;height:56px;object-fit:contain;margin:0 auto 16px;opacity:.9}
.st-app-copy{font-size:16px;color:rgba(232,228,220,.76);max-width:52ch;margin:0 auto 20px}
.st-footer{text-align:center;padding:32px 24px 48px;font-size:13px;color:rgba(232,228,220,.45)}
.st-footer a{color:rgba(232,228,220,.7)}
@media (max-width:640px){
  .st-fig-head{gap:20px}
  .st-portrait-lg{width:140px;flex:0 0 140px}
  .st-grid{grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:20px}
}
`;

build();
