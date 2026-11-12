#!/usr/bin/env node
// Long-form articles — content/articles/*.md → public/<slug>.html
//
// Articles are markdown in the repo rather than data in a .js file, because
// unlike the Stoics or the reading list they are prose: the source should be
// readable and diffable as prose. Frontmatter carries slug, title, description
// and pillar.
//
// SLUGS ARE FLAT AND PERMANENT. An article lives at /premeditatio-malorum, not
// /learn/premeditatio-malorum. The hub is navigation and may be renamed; a URL
// with rankings cannot move without redirects and lost equity. The numeric
// filename prefix orders them on the hub and is not part of the URL.
//
// The markdown subset is deliberately small — headings, bold, italic, links,
// blockquotes, ordered and unordered lists, horizontal rules, paragraphs —
// because that is all these articles use. Anything outside it should be added
// here consciously rather than silently half-working.
//
// Re-run when an article changes:  node scripts/build-articles.js

const fs = require('fs');
const path = require('path');
const { footerHtml } = require('./site-footer');
const { navHtml, navCss, fontLinks, skipLink } = require('./site-nav');
const { artHtml, artCss } = require('./site-artwork');

const ROOT = path.join(__dirname, '..');
const SITE = 'https://getmarcus.app';
const SRC_DIR = path.join(ROOT, 'content', 'articles');
const OUT_DIR = path.join(ROOT, 'public');
const GA = '<script src="/analytics.js"></script>';

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function parseFrontmatter(src) {
  const m = src.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error('missing frontmatter');
  const meta = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (!kv) continue;
    // A value containing a colon has to be quoted in the frontmatter, so strip
    // one layer of wrapping quotes. Without this the quotes render into the
    // <h1> and the <title>.
    let raw = kv[2].trim();
    if (/^"(.*)"$/.test(raw) || /^'(.*)'$/.test(raw)) raw = raw.slice(1, -1);
    // about/mentions are authored as JSON so the entities a page claims to be
    // about live next to the prose rather than being inferred at build time.
    meta[kv[1]] = /^[[{]/.test(raw) ? JSON.parse(raw) : raw;
  }
  return { meta, body: m[2] };
}

// Inline markup, applied after escaping so the escaping cannot be broken by it.
function inline(t) {
  return esc(t)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, txt, href) => '<a href="' + href + '">' + txt + '</a>')
    // Bold first and non-greedy, because bold spans routinely contain nested
    // italic ("**Epictetus, *Enchiridion* 21**"). A [^*]+ body silently fails
    // on those and leaves the asterisks on the page. Italic then runs over the
    // result, including inside the <strong> it just produced.
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+?)\*/g, '<em>$1</em>')
    .replace(/ — /g, ' &mdash; ')
    .replace(/'/g, '&rsquo;');
}

function renderMarkdown(md) {
  const out = [];
  const lines = md.split('\n');
  let i = 0;
  const flushList = (tag, items) =>
    out.push('<' + tag + ' class="ar-list">' + items.map(x => '<li>' + inline(x) + '</li>').join('') + '</' + tag + '>');

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) { i++; continue; }

    if (/^---\s*$/.test(line)) { out.push('<hr class="ar-rule">'); i++; continue; }

    const h = line.match(/^(#{2,4})\s+(.*)$/);
    if (h) {
      const lvl = h[1].length;
      out.push('<h' + lvl + ' class="ar-h' + lvl + '">' + inline(h[2]) + '</h' + lvl + '>');
      i++; continue;
    }

    if (line.startsWith('> ')) {
      const buf = [];
      while (i < lines.length && (lines[i].startsWith('>'))) {
        buf.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      // A trailing "— Source" line inside a quote becomes the citation.
      const cite = [];
      while (buf.length && /^—\s/.test(buf[buf.length - 1])) cite.unshift(buf.pop());
      while (buf.length && !buf[buf.length - 1].trim()) buf.pop();
      out.push('<blockquote class="ar-quote">' +
        buf.filter(x => x.trim()).map(x => '<span>' + inline(x) + '</span>').join('') +
        (cite.length ? '<cite>' + inline(cite.join(' ').replace(/^—\s*/, '')) + '</cite>' : '') +
        '</blockquote>');
      continue;
    }

    if (/^\d+\.\s/.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) { items.push(lines[i].replace(/^\d+\.\s/, '')); i++; }
      flushList('ol', items); continue;
    }

    // A row of images: consecutive lines of ![caption](src). Used for book
    // covers, so a page about choosing an edition shows the editions.
    if (/^!\[/.test(line)) {
      const figs = [];
      while (i < lines.length && /^!\[/.test(lines[i])) {
        const m = lines[i].match(/^!\[([^\]]*)\]\(([^)]+)\)/);
        if (m) figs.push('<figure><img src="' + esc(m[2]) + '" alt="' + esc(m[1].replace(/[*_]/g, '')) + '" loading="lazy" decoding="async" width="180" height="270"><figcaption>' + inline(m[1]) + '</figcaption></figure>');
        i++;
      }
      out.push('<div class="ar-figs">' + figs.join('') + '</div>');
      continue;
    }

    // A table: consecutive lines that start with "|". The second line is the
    // markdown separator (| --- |) and is skipped. Wrapped so it scrolls
    // sideways on a phone instead of widening the page.
    if (line.startsWith('|')) {
      const rows = [];
      while (i < lines.length && lines[i].startsWith('|')) { rows.push(lines[i]); i++; }
      const cells = r => r.replace(/^\|\s*|\s*\|\s*$/g, '').split(/\s*\|\s*/);
      const body = rows.slice(1).filter(r => !/^\|[\s:|-]+\|?\s*$/.test(r));
      out.push('<div class="ar-table-wrap"><table class="ar-table"><thead><tr>' +
        cells(rows[0]).map(c => '<th scope="col">' + inline(c) + '</th>').join('') + '</tr></thead><tbody>' +
        body.map(r => '<tr>' + cells(r).map((c, k) => (k ? '<td>' : '<th scope="row">') + inline(c) + (k ? '</td>' : '</th>')).join('') + '</tr>').join('') +
        '</tbody></table></div>');
      continue;
    }

    if (/^-\s/.test(line)) {
      const items = [];
      while (i < lines.length && /^-\s/.test(lines[i])) { items.push(lines[i].replace(/^-\s/, '')); i++; }
      flushList('ul', items); continue;
    }

    // Paragraph: consume until a blank line or a block-level marker.
    const buf = [];
    while (i < lines.length && lines[i].trim() &&
           !/^(#{2,4}\s|>|-\s|\d+\.\s|---\s*$|\||!\[)/.test(lines[i])) {
      buf.push(lines[i]); i++;
    }
    // A paragraph that is entirely bold and ends without a stop is a lead-in,
    // not a heading: keep it a paragraph so the document outline stays honest.
    out.push('<p class="ar-p">' + inline(buf.join(' ')) + '</p>');
  }
  return out.join('');
}

// A card for the app, placed after the second section, where a reader who is
// still here is engaged; the end-of-page card is seen by the few who finish.
// Not on the app comparison page, where it would turn a comparison into a pitch.
const APP_STORE = require('./site-nav').appStoreUrl('web-content');
function withAppCard(html, slug) {
  if (slug === 'best-stoic-apps') return html;
  const card = '<aside class="ar-appcard">' +
    '<img src="/img/app-reading-phone.png" alt="The Marcus app showing a daily reading" width="180" height="367" loading="lazy" decoding="async">' +
    '<div><p class="ar-appcard-label">Marcus for iPhone</p>' +
    '<p class="ar-appcard-copy">One real passage from the Stoics each morning, checked against its translation, then a morning intention and an evening review.</p>' +
    '<a class="ar-nav-cta" href="' + APP_STORE + '">Download on the App Store</a></div></aside>';
  let n = 0;
  return html.replace(/<h2 /g, m => (++n === 3 ? card + m : m));
}

function page(meta, bodyHtml, prev, next) {
  const canonical = SITE + '/' + meta.slug;
  const ogImage = SITE + '/og/' + meta.slug + '.png';
  // Structured data serves two readers with different needs, so this emits a
  // @graph rather than one node.
  //
  // SEARCH wants Article with real dates, a resolvable publisher entity, and a
  // BreadcrumbList, which is the one item here that can actually change how the
  // result is drawn.
  //
  // ANSWER ENGINES want to know what the page is ABOUT as entities, not as
  // keywords. `about` and `mentions` carry DefinedTerm and Person nodes with
  // sameAs links to Wikipedia, which is what lets a model connect this page to
  // "Epictetus" the entity rather than the string. That is the difference
  // between being quoted and being ignored.
  //
  // Deliberately NOT emitted: FAQPage. Google deprecated FAQ rich results for
  // most sites in 2023, and these articles are essays with question headings
  // rather than genuine Q&A. Marking them up as an FAQ would be describing the
  // page as something it is not, to chase a feature that no longer renders.
  const wordCount = bodyHtml.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        '@id': canonical + '#article',
        headline: meta.title,
        description: meta.description,
        url: canonical,
        mainEntityOfPage: { '@id': canonical + '#webpage' },
        datePublished: meta.published,
        dateModified: meta.modified || meta.published,
        inLanguage: 'en-US',
        wordCount,
        articleSection: 'Stoic practice',
        author: { '@id': SITE + '#author' },
        publisher: { '@id': SITE + '#org' },
        isPartOf: { '@id': SITE + '#website' },
        about: (meta.about || []).map(t => ({ '@type': 'DefinedTerm', name: t.name, description: t.description, ...(t.sameAs ? { sameAs: t.sameAs } : {}) })),
        mentions: (meta.mentions || []).map(p => ({ '@type': 'Person', name: p.name, sameAs: p.sameAs })),
      },
      {
        '@type': 'WebPage',
        '@id': canonical + '#webpage',
        url: canonical,
        name: meta.title,
        isPartOf: { '@id': SITE + '#website' },
        breadcrumb: { '@id': canonical + '#breadcrumb' },
      },
      {
        '@type': 'BreadcrumbList',
        '@id': canonical + '#breadcrumb',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE + '/' },
          { '@type': 'ListItem', position: 2, name: 'Learn', item: SITE + '/learn' },
          { '@type': 'ListItem', position: 3, name: meta.title },
        ],
      },
      {
        // The Person the articles are attributed to. Defined on /about, which is
        // the canonical node; repeated here so each article's graph resolves
        // without a fetch.
        '@type': 'Person',
        '@id': SITE + '#author',
        name: 'Gio White',
        url: SITE + '/about',
        sameAs: ['https://www.linkedin.com/in/giovanniwhite/'],
        worksFor: { '@id': SITE + '#org' },
        image: SITE + '/img/author.jpg',
      },
      {
        '@type': 'Organization',
        '@id': SITE + '#org',
        name: 'Marcus',
        url: SITE,
        logo: SITE + '/skull-gold.png',
        description: 'A Stoic practice app for iOS.',
      },
      {
        '@type': 'WebSite',
        '@id': SITE + '#website',
        url: SITE,
        name: 'Marcus',
        publisher: { '@id': SITE + '#org' },
        inLanguage: 'en-US',
      },
    ],
  };
  const pager = (prev || next)
    ? '<nav class="ar-pager">' +
      (prev ? '<a class="ar-pager-prev" href="/' + prev.slug + '"><span>Previous</span>' + esc(prev.title) + '</a>' : '<span></span>') +
      (next ? '<a class="ar-pager-next" href="/' + next.slug + '"><span>Next</span>' + esc(next.title) + '</a>' : '<span></span>') +
      '</nav>'
    : '';

  return '<!doctype html><html lang="en"><head>' +
    '<meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    GA +
    '<title>' + esc(meta.title) + ' | Marcus</title>' +
    '<meta name="description" content="' + esc(meta.description) + '">' +
    '<meta name="robots" content="index, follow, max-image-preview:large">' +
    '<link rel="canonical" href="' + canonical + '">' +
    '<meta property="og:type" content="article">' +
    '<meta property="og:site_name" content="Marcus">' +
    '<meta property="og:title" content="' + esc(meta.title) + '">' +
    '<meta property="og:description" content="' + esc(meta.description) + '">' +
    '<meta property="og:url" content="' + canonical + '">' +
    '<meta property="og:image" content="' + ogImage + '">'+'<meta property="og:image:width" content="1200">'+'<meta property="og:image:height" content="630">' +
    '<meta name="twitter:card" content="summary_large_image">' +
    '<meta name="twitter:title" content="' + esc(meta.title) + '">' +
    '<meta name="twitter:description" content="' + esc(meta.description) + '">' +
    '<meta name="twitter:image" content="' + ogImage + '">' +
    '<link rel="icon" href="/favicon.ico" sizes="48x48">' +
    '<link rel="icon" type="image/png" href="/favicon.png">' +
    '<link rel="apple-touch-icon" href="/apple-touch-icon.png">' +
    fontLinks() +
    '<style>' + CSS + '</style>' +
    '<script type="application/ld+json">' + JSON.stringify(jsonLd) + '</script>' +
    '</head><body>' +
    skipLink('ar') + navHtml('ar') +
    '<article class="ar-main" id="main">' +
    '<header class="ar-head">' +
    '<p class="ar-eyebrow"><a href="/learn">The practice</a></p>' +
    '<h1 class="ar-title">' + esc(meta.title) + '</h1>' +
    '<p class="ar-byline"><img src="/img/author.jpg" alt="" width="30" height="30">' +
    'By <a href="/about">Gio White</a><span>&middot;</span>' +
    '<a href="/about">How sources are checked</a></p>' +
    '</header>' +
    artHtml(meta.slug, 'ar') +
    // The description, written for search results, doubles as the answer for
    // a reader who only skims: it is the article in two sentences.
    '<aside class="ar-brief"><p class="ar-brief-label">In brief</p><p>' + esc(meta.description) + '</p></aside>' +
    withAppCard(bodyHtml, meta.slug) +
    pager +
    '<section class="ar-app">' +
    '<img class="ar-app-skull" src="/skull-gold.png" alt="" width="64" height="64">' +
    '<p class="ar-app-copy">Marcus turns this into a daily practice for iOS: a morning preparation, ' +
    'a daily reading, and a structured evening examination.</p>' +
    '<a class="ar-nav-cta" href="/">Explore the app →</a></section>' +
    '</article>' +
    footerHtml('ar') +
    '</body></html>';
}

function build() {
  // Sort by the numeric prefix, not by filename: a string sort puts 10- and 11-
  // immediately after 1-, which silently scrambles the prev/next pager into a
  // reading order nobody chose.
  const num = f => parseInt(f.match(/^(\d+)/)?.[1] ?? '9999', 10);
  const files = fs.readdirSync(SRC_DIR).filter(f => f.endsWith('.md'))
    .sort((a, b) => num(a) - num(b) || a.localeCompare(b));
  const parsed = files.map(f => {
    const { meta, body } = parseFrontmatter(fs.readFileSync(path.join(SRC_DIR, f), 'utf8'));
    for (const k of ['slug', 'title', 'description']) {
      if (!meta[k]) throw new Error(f + ': frontmatter missing ' + k);
    }
    return { meta, body };
  });

  parsed.forEach((a, i) => {
    const html = page(a.meta, renderMarkdown(a.body),
      parsed[i - 1] && parsed[i - 1].meta, parsed[i + 1] && parsed[i + 1].meta);
    fs.writeFileSync(path.join(OUT_DIR, a.meta.slug + '.html'), html, 'utf8');
  });

  console.log('Built articles: ' + parsed.length + ' → ' +
    parsed.map(a => '/' + a.meta.slug).join(', '));
}

const CSS = `
*{box-sizing:border-box}
body{margin:0;background:#0d0d0f;color:#e8e4dc;font-family:Inter,system-ui,-apple-system,sans-serif;line-height:1.7;-webkit-font-smoothing:antialiased}
a{color:inherit}
img{max-width:100%;display:block}
.ar-nav{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px 24px;border-bottom:1px solid rgba(232,228,220,.09);flex-wrap:wrap}
.ar-brand{display:flex;align-items:center;gap:10px;text-decoration:none;font-family:Cinzel,Georgia,serif;font-size:19px;letter-spacing:.02em}
.ar-brand img{width:40px;height:40px;object-fit:contain;opacity:.9}
.ar-nav-right{display:flex;align-items:center;gap:20px;flex-wrap:wrap}
.ar-nav-link{text-decoration:none;font-size:14px;color:rgba(232,228,220,.72)}
.ar-nav-cta{text-decoration:none;font-size:14px;color:#0d0d0f;background:#c9a961;padding:9px 16px;border-radius:999px;white-space:nowrap}
.ar-main{max-width:680px;margin:0 auto;padding:56px 24px 8px}
${artCss('ar')}
.ar-head{margin-bottom:36px}
.ar-eyebrow{font-family:Cinzel,Georgia,serif;font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:#c9a961;margin:0 0 14px}
.ar-eyebrow a{text-decoration:none}
.ar-title{font-family:Cinzel,Georgia,serif;font-size:clamp(30px,5.2vw,44px);font-weight:600;margin:0;letter-spacing:-.01em;line-height:1.18;text-wrap:balance}
.ar-byline{display:flex;align-items:center;gap:9px;margin:18px 0 0;font-size:13.5px;color:rgba(232,228,220,.55);flex-wrap:wrap}
.ar-byline img{width:30px;height:30px;border-radius:999px;object-fit:cover}
.ar-byline a{color:rgba(232,228,220,.8)}
.ar-byline span{opacity:.4}
.ar-p{font-size:17.5px;color:rgba(232,228,220,.86);margin:0 0 22px}
.ar-h2{font-family:Cinzel,Georgia,serif;font-size:25px;line-height:1.3;letter-spacing:.03em;font-weight:400;color:#e8e4dc;margin:60px 0 20px;padding-bottom:12px;border-bottom:1px solid rgba(201,169,97,.28)}
.ar-h3{font-family:Cinzel,Georgia,serif;font-size:19px;font-weight:600;margin:36px 0 12px;color:#e8e4dc}
.ar-quote{margin:0 0 26px;padding:18px 22px;border-left:3px solid #c9a961;background:linear-gradient(90deg,rgba(201,169,97,.10),rgba(201,169,97,.03));border-radius:0 10px 10px 0}
.ar-brief{margin:0 0 36px;padding:18px 22px;border:1px solid rgba(201,169,97,.35);border-radius:12px;background:linear-gradient(135deg,rgba(201,169,97,.14),rgba(120,88,46,.06))}
.ar-brief p{margin:0;font-size:16.5px;line-height:1.55;color:#e8e4dc}
.ar-brief .ar-brief-label{font-family:Cinzel,Georgia,serif;font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#c9a961;margin-bottom:6px}
.ar-appcard{display:flex;gap:24px;align-items:center;margin:44px 0;padding:22px 24px;border-radius:16px;border:1px solid rgba(201,169,97,.28);background:radial-gradient(120% 140% at 0% 0%,rgba(120,88,46,.35),rgba(20,15,10,.6) 60%,rgba(13,13,15,.9))}
.ar-appcard img{width:120px;height:auto;flex:0 0 auto;filter:drop-shadow(0 12px 24px rgba(0,0,0,.6))}
.ar-appcard-label{font-family:Cinzel,Georgia,serif;font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#c9a961;margin:0 0 8px}
.ar-appcard-copy{font-size:16px;line-height:1.5;color:#e8e4dc;margin:0 0 16px}
.ar-appcard .ar-nav-cta{display:inline-block}
@media (max-width:560px){.ar-appcard{gap:16px;padding:18px}.ar-appcard img{width:88px}}
.ar-quote span{display:block;font-family:'Iowan Old Style','Palatino Linotype',Palatino,Georgia,serif;font-style:italic;font-size:20px;line-height:1.55;color:#e8e4dc}
.ar-figs{display:flex;gap:14px;margin:8px 0 32px;overflow-x:auto;padding-bottom:4px}
.ar-figs figure{margin:0;flex:0 0 auto;width:108px}
.ar-figs img{display:block;width:108px;height:162px;object-fit:cover;border-radius:3px;box-shadow:0 8px 24px rgba(0,0,0,.5)}
.ar-figs figcaption{margin-top:8px;font-size:12.5px;line-height:1.35;color:rgba(232,228,220,.62)}
.ar-quote cite{display:block;margin-top:10px;font-style:normal;font-size:13px;letter-spacing:.08em;color:rgba(232,228,220,.5)}
.ar-list{margin:0 0 24px;padding-left:22px}
.ar-table-wrap{overflow-x:auto;margin:0 0 28px;-webkit-overflow-scrolling:touch;max-width:calc(100vw - 32px)}
.ar-table{width:100%;border-collapse:collapse;font-size:15px;min-width:560px}
.ar-table th,.ar-table td{text-align:left;vertical-align:top;padding:10px 12px;border-bottom:1px solid rgba(201,169,97,.18);color:rgba(232,228,220,.84)}
.ar-table thead th{color:#c9a961;font-weight:600;font-size:12px;letter-spacing:.08em;text-transform:uppercase}
.ar-table tbody th{color:#e8e4dc;font-weight:600}
.ar-list li{font-size:17px;color:rgba(232,228,220,.84);margin-bottom:10px}
.ar-rule{border:0;border-top:1px solid rgba(232,228,220,.09);margin:44px 0}
.ar-p strong,.ar-list strong{color:#e8e4dc;font-weight:600}
.ar-p em,.ar-list em{font-style:italic}
.ar-p a,.ar-list a{color:#c9a961}
.ar-pager{display:flex;justify-content:space-between;gap:16px;margin-top:52px;padding-top:24px;border-top:1px solid rgba(232,228,220,.09)}
.ar-pager a{text-decoration:none;font-family:Cinzel,Georgia,serif;font-size:16px;max-width:45%;line-height:1.35}
.ar-pager a:hover{color:#c9a961}
.ar-pager-next{text-align:right}
.ar-pager span{display:block;font-family:Inter,sans-serif;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:rgba(232,228,220,.42);margin-bottom:5px}
.ar-app{text-align:center;margin:64px 0 0;padding:44px 24px;border-top:1px solid rgba(232,228,220,.09)}
.ar-app-skull{width:56px;height:56px;object-fit:contain;margin:0 auto 16px;opacity:.9}
.ar-app-copy{font-size:16px;color:rgba(232,228,220,.78);max-width:52ch;margin:0 auto 20px}
.ar-footer{text-align:center;padding:32px 24px 48px;font-size:13px;color:rgba(232,228,220,.45)}
.ar-footer a{color:rgba(232,228,220,.7)}

/* Shared chrome last: these override the builder's own nav rules, and a
   mobile menu that cannot hide is worse than no mobile menu. */
${navCss('ar')}`;

build();
