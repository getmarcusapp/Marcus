#!/usr/bin/env node
// Daily Meditations — archive builder.
//
// Reads structured editions from content/editions/*.json (written by the
// generator) and renders a static, SEO-optimized archive into public/meditations:
//   - index.html         a timeline of every edition
//   - <slug>.html        one page per edition (canonical, OG, JSON-LD Article)
//   - archive.css        shared styles, carrying over the main site's brand
//
// Idempotent: re-run any time to rebuild from the current set of editions.
// To veto an edition, delete its content/editions/<date>.json and rebuild.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const EDITIONS_DIR = path.join(ROOT, 'content', 'editions');
const OUT_DIR = path.join(ROOT, 'public', 'meditations');
const SITE = 'https://getmarcus.app';
const BEEHIIV_CREATE = 'https://daily-meditations.beehiiv.com/create';

const FONT_LINKS =
  '<link rel="preconnect" href="https://fonts.googleapis.com">' +
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
  '<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Inter:ital,wght@0,400;0,500;1,300;1,400&display=swap" rel="stylesheet">';
const ICON_LINKS =
  '<link rel="icon" href="/favicon.ico" sizes="48x48">' +
  '<link rel="icon" type="image/png" href="/favicon.png">' +
  '<link rel="apple-touch-icon" href="/apple-touch-icon.png">';

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
// Markdown emphasis -> <em> (the model occasionally italicizes work titles).
function md(s) {
  return String(s || '')
    .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
    .replace(/_([^_\n]+)_/g, '<em>$1</em>');
}
function hostname(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return url; }
}
// Plain-text meta description: strip markup, collapse whitespace, ~155 chars.
function metaDesc(rec) {
  const base = (rec.context || rec.quote || '').replace(/[*_]/g, '').replace(/\s+/g, ' ').trim();
  return base.length > 155 ? base.slice(0, 152).replace(/[\s,;:.]+\S*$/, '') + '…' : base;
}

function pageHead(title, description, canonical, jsonLd, extraOg) {
  return '<!doctype html><html lang="en"><head>' +
    '<meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>' + esc(title) + '</title>' +
    '<meta name="description" content="' + esc(description) + '">' +
    '<link rel="canonical" href="' + esc(canonical) + '">' +
    '<meta property="og:title" content="' + esc(title) + '">' +
    '<meta property="og:description" content="' + esc(description) + '">' +
    '<meta property="og:url" content="' + esc(canonical) + '">' +
    '<meta property="og:site_name" content="Daily Meditations">' +
    (extraOg || '') +
    '<meta name="twitter:card" content="summary">' +
    '<meta name="twitter:title" content="' + esc(title) + '">' +
    '<meta name="twitter:description" content="' + esc(description) + '">' +
    ICON_LINKS + FONT_LINKS +
    '<link rel="stylesheet" href="/meditations/archive.css">' +
    (jsonLd ? '<script type="application/ld+json">' + JSON.stringify(jsonLd) + '</script>' : '') +
    '</head>';
}

// Fixed nav matching the main site: skull-gold wordmark + gold pill CTA.
function nav() {
  return '<nav class="dm-nav">' +
    '<a class="dm-brand" href="/"><img src="/skull-gold.png" alt="Marcus" width="40" height="40"><span>Marcus</span></a>' +
    '<div class="dm-nav-right">' +
    '<a class="dm-nav-link" href="/meditations">Daily Meditations</a>' +
    '<a class="dm-nav-cta" href="/">Get the app →</a>' +
    '</div></nav>';
}

function subscribeBlock(id) {
  return '<section class="dm-subscribe">' +
    '<p class="dm-eyebrow">The newsletter</p>' +
    '<h2 class="dm-sub-title">Get tomorrow\'s edition</h2>' +
    '<p class="dm-sub-copy">One short Stoic reflection each morning. Free. Unsubscribe anytime.</p>' +
    '<div class="dm-form">' +
    '<input class="dm-input" id="' + id + '" type="email" placeholder="your@email.com" autocomplete="email">' +
    '<button class="dm-submit" onclick="dmSubscribe(\'' + id + '\')">Subscribe →</button>' +
    '</div>' +
    '<p class="dm-note" id="' + id + '-note">Daily. No noise.</p>' +
    '</section>';
}

function appCta() {
  return '<section class="dm-app">' +
    '<img class="dm-app-skull" src="/skull-gold.png" alt="" width="72" height="72">' +
    '<p class="dm-app-copy">Daily Meditations is a companion to <strong>Marcus</strong>, a Stoic practice ' +
    'app for iOS: daily journaling, guided meditation, and a structured evening reckoning.</p>' +
    '<a class="dm-nav-cta" href="/">Explore the app →</a></section>';
}

function footer() {
  return '<footer class="dm-footer"><p>Marcus &middot; A Stoic Practice App &middot; ' +
    '<a href="/">getmarcus.app</a> &middot; <a href="/meditations">Daily Meditations</a></p></footer>';
}

function subscribeScript() {
  // Mirrors the main site's Beehiiv POST (no-cors form post).
  return '<script>function dmSubscribe(id){var i=document.getElementById(id);' +
    'var e=(i.value||"").trim();var n=document.getElementById(id+"-note");' +
    'if(!e||e.indexOf("@")<0){i.style.outline="2px solid #a05050";i.focus();return;}' +
    'var b=i.parentElement.querySelector(".dm-submit");b.textContent="...";b.disabled=true;' +
    'var f=new FormData();f.append("email",e);f.append("is_js_enabled","true");' +
    'f.append("double_opt","false");f.append("fallback_path","/");' +
    'fetch("' + BEEHIIV_CREATE + '",{method:"POST",body:f,mode:"no-cors"}).catch(function(){});' +
    'i.parentElement.style.display="none";if(n){n.textContent="You\'re in. Check your inbox.";n.style.color="#FFCE82";}}' +
    '</script>';
}

function renderEditionPage(rec) {
  const canonical = SITE + '/meditations/' + rec.slug;
  const title = rec.theme + ' — Daily Meditations';
  const desc = metaDesc(rec);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: rec.theme,
    datePublished: rec.isoDate,
    dateModified: rec.isoDate,
    author: { '@type': 'Person', name: 'Gio White' },
    publisher: { '@type': 'Organization', name: 'Marcus', url: SITE },
    description: desc,
    mainEntityOfPage: canonical,
    isPartOf: { '@type': 'Blog', name: 'Daily Meditations', url: SITE + '/meditations' },
  };
  const paras = (rec.context || '').split('\n\n')
    .map(p => '<p>' + md(esc(p.trim())) + '</p>').join('');
  const source = rec.sourceUrl
    ? '<p class="dm-source">Source: <a href="' + esc(rec.sourceUrl) + '" rel="nofollow noopener" target="_blank">' + esc(hostname(rec.sourceUrl)) + ' →</a></p>'
    : '';
  return pageHead(title, desc, canonical, jsonLd, '<meta property="og:type" content="article">') +
    '<body>' + nav() +
    '<main class="dm-main">' +
    '<article class="dm-article">' +
    '<p class="dm-eyebrow">Daily Meditations &middot; ' + esc(rec.displayDate) + '</p>' +
    '<h1 class="dm-theme">' + esc(rec.theme) + '</h1>' +
    '<blockquote class="dm-quote">' + md(esc(rec.quote)) + '</blockquote>' +
    '<div class="dm-context">' + paras + '</div>' +
    '<p class="dm-question">' + md(esc(rec.question)) + '</p>' +
    source +
    '</article>' +
    '<p class="dm-back"><a href="/meditations">← All editions</a></p>' +
    subscribeBlock('e-' + rec.isoDate) +
    appCta() +
    '</main>' + footer() + subscribeScript() +
    '</body></html>';
}

function renderIndex(records) {
  const canonical = SITE + '/meditations';
  const title = 'Daily Meditations — a daily Stoic newsletter';
  const desc = 'A daily Stoic reflection: a verified passage from Marcus Aurelius, Seneca, or Epictetus, the moment in history that produced it, and a line to the world today. Free.';
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: 'Daily Meditations',
    url: canonical,
    description: desc,
    publisher: { '@type': 'Organization', name: 'Marcus', url: SITE },
    blogPost: records.slice(0, 20).map(r => ({
      '@type': 'BlogPosting',
      headline: r.theme,
      datePublished: r.isoDate,
      url: SITE + '/meditations/' + r.slug,
    })),
  };
  const items = records.length
    ? records.map(r => '<a class="dm-item" href="/meditations/' + esc(r.slug) + '">' +
        '<time class="dm-item-date" datetime="' + esc(r.isoDate) + '">' + esc(r.displayDate) + '</time>' +
        '<h2 class="dm-item-theme">' + esc(r.theme) + '</h2>' +
        '<p class="dm-item-quote">' + md(esc(r.quote)) + '</p>' +
        '</a>').join('')
    : '<p class="dm-empty">The first edition arrives soon.</p>';
  return pageHead(title, desc, canonical, jsonLd, '<meta property="og:type" content="website">') +
    '<body>' + nav() +
    '<header class="dm-hero"><div class="dm-hero-inner">' +
    '<img class="dm-hero-skull" src="/skull-gold.png" alt="Marcus" width="132" height="132">' +
    '<p class="dm-eyebrow dm-eyebrow-accent">The newsletter</p>' +
    '<h1 class="dm-hero-title">Daily Meditations</h1>' +
    '<p class="dm-hero-copy">One edition each morning: a verified passage from the Stoics, the moment in ' +
    'history that produced it, and an unforced line to the world as it is today. Two minutes. Free.</p>' +
    '<div class="dm-form dm-form-hero">' +
    '<input class="dm-input" id="hero" type="email" placeholder="your@email.com" autocomplete="email">' +
    '<button class="dm-submit" onclick="dmSubscribe(\'hero\')">Subscribe →</button>' +
    '</div><p class="dm-note" id="hero-note">Daily. No noise. Unsubscribe anytime.</p>' +
    '</div></header>' +
    '<main class="dm-main">' +
    '<section class="dm-timeline">' + items + '</section>' +
    appCta() +
    '</main>' + footer() + subscribeScript() +
    '</body></html>';
}

const CSS = `
:root{--bg:#080808;--bg-deep:#040404;--bg-card:#0f0f0f;--border:#252525;--border-mid:#2a2a2a;
--text-primary:#F0F0F0;--text-secondary:#C0C0C0;--text-muted:#888;--text-dim:#7A7A7A;--accent:#FFCE82;--accent-dim:#B38B5B;
--display:'Cinzel',Georgia,serif;--body:'Inter',-apple-system,BlinkMacSystemFont,'Helvetica Neue',sans-serif;}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--text-primary);font-family:var(--body);line-height:1.6;-webkit-font-smoothing:antialiased}
a{color:inherit;text-decoration:none}
/* NAV — matches the main site: fixed, blurred, skull + Cinzel wordmark, gold pill CTA */
.dm-nav{position:fixed;top:0;left:0;right:0;z-index:100;height:64px;background:rgba(4,4,4,.94);
backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border-bottom:1px solid var(--border);
display:flex;align-items:center;justify-content:space-between;padding:0 clamp(20px,5vw,40px)}
.dm-brand{display:flex;align-items:center;gap:10px}
.dm-brand img{width:40px;height:40px;object-fit:contain;opacity:.9}
.dm-brand span{font-family:var(--display);font-size:24px;font-weight:400;letter-spacing:.5px;color:var(--text-primary)}
.dm-nav-right{display:flex;align-items:center;gap:22px}
.dm-nav-link{font-size:13px;letter-spacing:.3px;color:var(--text-muted);transition:color .15s}
.dm-nav-link:hover{color:var(--text-secondary)}
.dm-nav-cta{background:var(--accent);color:#000;font-size:13px;font-weight:700;letter-spacing:.3px;
padding:10px 20px;border-radius:8px;transition:opacity .15s}
.dm-nav-cta:hover{opacity:.85}
@media(max-width:560px){.dm-nav-link{display:none}}
/* HERO — dark with the amber radial glow + skull, like the site hero */
.dm-hero{position:relative;overflow:hidden;background:var(--bg-deep);border-bottom:1px solid var(--border);
text-align:center;padding:140px 24px 72px}
.dm-hero::before{content:'';position:absolute;inset:0;pointer-events:none;
background:radial-gradient(ellipse 65% 55% at 50% 40%,rgba(255,206,130,.28) 0%,rgba(255,206,130,.08) 42%,transparent 74%)}
.dm-hero-inner{position:relative;max-width:600px;margin:0 auto}
.dm-hero-skull{width:132px;height:132px;object-fit:contain;opacity:.92;margin-bottom:28px;
filter:drop-shadow(0 0 40px rgba(255,206,130,.18))}
.dm-hero-title{font-family:var(--display);font-size:clamp(40px,9vw,72px);font-weight:400;color:#fff;letter-spacing:1px;line-height:1;margin-bottom:22px}
.dm-hero-copy{font-size:clamp(16px,2.4vw,19px);color:var(--text-secondary);max-width:520px;margin:0 auto 34px;line-height:1.6}
/* shared eyebrow — uppercase, tracked, matching the site's section eyebrows */
.dm-eyebrow{font-size:12px;letter-spacing:3px;text-transform:uppercase;color:var(--accent-dim);margin-bottom:16px}
.dm-eyebrow-accent{color:var(--accent)}
.dm-main{max-width:640px;margin:0 auto;padding:0 24px}
/* ARTICLE */
.dm-article{padding-top:104px}
.dm-article .dm-eyebrow{margin-top:0}
.dm-theme{font-family:var(--display);font-size:clamp(30px,6vw,44px);color:var(--accent);letter-spacing:.5px;margin-bottom:30px;line-height:1.15}
.dm-quote{font-family:var(--body);font-style:italic;font-size:22px;line-height:1.55;color:var(--text-primary);border-left:2px solid var(--accent);padding-left:22px;margin:0 0 32px}
.dm-context p{font-size:17px;color:var(--text-secondary);line-height:1.75;margin-bottom:20px}
.dm-question{font-style:italic;font-size:18px;color:var(--text-primary);border-top:1px solid var(--border);padding-top:24px;margin-top:8px;line-height:1.6}
.dm-source{font-size:13px;color:var(--text-dim);margin-top:22px}
.dm-source a{color:var(--accent-dim)}
.dm-back{margin:40px 0 8px}.dm-back a{font-size:13px;letter-spacing:1px;text-transform:uppercase;color:var(--accent-dim)}
/* TIMELINE */
.dm-timeline{padding:8px 0}
.dm-item{display:block;padding:28px 0;border-top:1px solid var(--border);transition:opacity .15s}
.dm-item:first-child{border-top:none}
.dm-item:hover{opacity:.72}
.dm-item-date{font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:var(--text-dim)}
.dm-item-theme{font-family:var(--display);font-size:25px;color:var(--accent);margin:8px 0 8px;line-height:1.2}
.dm-item-quote{font-style:italic;font-size:16px;color:var(--text-secondary);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.dm-empty{padding:60px 0;text-align:center;color:var(--text-muted)}
/* SUBSCRIBE CARD */
.dm-subscribe{background:var(--bg-card);border:1px solid var(--border-mid);border-radius:14px;padding:36px 28px;margin:56px 0 40px;text-align:center}
.dm-subscribe .dm-eyebrow{margin-bottom:12px}
.dm-sub-title{font-family:var(--display);font-size:26px;font-weight:400;margin-bottom:10px}
.dm-sub-copy{font-size:15px;color:var(--text-secondary);margin-bottom:22px}
.dm-form{display:flex;border:1px solid var(--border-mid);border-radius:12px;overflow:hidden;max-width:440px;margin:0 auto}
.dm-form-hero{margin:0 auto}
.dm-input{flex:1;background:#111;color:var(--text-primary);font-size:16px;padding:16px 18px;border:none;outline:none;font-family:inherit}
.dm-input::placeholder{color:var(--text-dim)}
.dm-submit{background:var(--accent);color:#000;font-size:15px;font-weight:700;padding:16px 24px;border:none;cursor:pointer;font-family:inherit;white-space:nowrap;transition:opacity .15s}
.dm-submit:hover{opacity:.9}
.dm-note{font-size:13px;color:var(--text-dim);margin-top:12px}
/* APP CTA */
.dm-app{border-top:1px solid var(--border);padding:48px 0 12px;margin-top:20px;text-align:center}
.dm-app-skull{width:72px;height:72px;object-fit:contain;opacity:.85;margin-bottom:18px;filter:drop-shadow(0 0 26px rgba(255,206,130,.15))}
.dm-app-copy{font-size:15px;color:var(--text-secondary);max-width:480px;margin:0 auto 22px;line-height:1.65}
.dm-app .dm-nav-cta{display:inline-block;padding:13px 26px;font-size:14px}
/* FOOTER */
.dm-footer{border-top:1px solid var(--border);margin-top:40px;padding:28px 24px;text-align:center;font-size:13px;color:var(--text-dim)}
.dm-footer a{color:var(--accent-dim)}
@media(max-width:500px){.dm-form{flex-direction:column}.dm-submit{padding:14px}}
`;

function build() {
  if (!fs.existsSync(EDITIONS_DIR)) {
    console.log('No editions dir yet (' + EDITIONS_DIR + '). Nothing to build.');
    fs.mkdirSync(EDITIONS_DIR, { recursive: true });
  }
  const files = fs.existsSync(EDITIONS_DIR)
    ? fs.readdirSync(EDITIONS_DIR).filter(f => f.endsWith('.json'))
    : [];
  const records = files.map(f => {
    try { return JSON.parse(fs.readFileSync(path.join(EDITIONS_DIR, f), 'utf8')); }
    catch (e) { console.warn('Skipping unparseable ' + f + ': ' + e.message); return null; }
  }).filter(Boolean).sort((a, b) => (a.isoDate < b.isoDate ? 1 : -1));

  fs.mkdirSync(OUT_DIR, { recursive: true });
  // Clean stale pages first, so a vetoed edition (its JSON deleted) or a
  // renamed slug (theme changed on a same-day re-run) can't linger as an
  // orphaned, unlinked URL. index.html and every edition page are regenerated
  // from content/editions below, so a clean slate is correct and idempotent.
  for (const f of fs.readdirSync(OUT_DIR)) {
    if (f.endsWith('.html')) fs.unlinkSync(path.join(OUT_DIR, f));
  }
  fs.writeFileSync(path.join(OUT_DIR, 'archive.css'), CSS.trim() + '\n', 'utf8');
  fs.writeFileSync(path.join(OUT_DIR, 'index.html'), renderIndex(records), 'utf8');
  for (const rec of records) {
    fs.writeFileSync(path.join(OUT_DIR, rec.slug + '.html'), renderEditionPage(rec), 'utf8');
  }
  console.log('Built archive: ' + records.length + ' edition(s) → public/meditations/');
  records.slice(0, 5).forEach(r => console.log('  ' + r.isoDate + '  ' + r.slug + '.html  (' + r.theme + ')'));
}

build();
