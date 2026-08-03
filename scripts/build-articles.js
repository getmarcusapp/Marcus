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

    if (/^-\s/.test(line)) {
      const items = [];
      while (i < lines.length && /^-\s/.test(lines[i])) { items.push(lines[i].replace(/^-\s/, '')); i++; }
      flushList('ul', items); continue;
    }

    // Paragraph: consume until a blank line or a block-level marker.
    const buf = [];
    while (i < lines.length && lines[i].trim() &&
           !/^(#{2,4}\s|>|-\s|\d+\.\s|---\s*$)/.test(lines[i])) {
      buf.push(lines[i]); i++;
    }
    // A paragraph that is entirely bold and ends without a stop is a lead-in,
    // not a heading: keep it a paragraph so the document outline stays honest.
    out.push('<p class="ar-p">' + inline(buf.join(' ')) + '</p>');
  }
  return out.join('');
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
        author: { '@id': SITE + '#org' },
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
    '<link rel="preconnect" href="https://fonts.googleapis.com">' +
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
    '<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Inter:ital,wght@0,400;0,500;1,300;1,400&display=swap" rel="stylesheet">' +
    '<style>' + CSS + '</style>' +
    '<script type="application/ld+json">' + JSON.stringify(jsonLd) + '</script>' +
    '</head><body>' +
    '<nav class="ar-nav">' +
    '<a class="ar-brand" href="/"><img src="/skull-gold.png" alt="Marcus" width="40" height="40"><span>Marcus</span></a>' +
    '<div class="ar-nav-right">' +
    '<a class="ar-nav-link" href="/learn">Learn</a>' +
    '<a class="ar-nav-cta" href="/">Get the app →</a>' +
    '</div></nav>' +
    '<article class="ar-main">' +
    '<header class="ar-head">' +
    '<p class="ar-eyebrow"><a href="/learn">The practice</a></p>' +
    '<h1 class="ar-title">' + esc(meta.title) + '</h1>' +
    '</header>' +
    bodyHtml +
    pager +
    '<section class="ar-app">' +
    '<img class="ar-app-skull" src="/skull-gold.png" alt="" width="64" height="64">' +
    '<p class="ar-app-copy">Marcus turns this into a daily practice for iOS: a morning preparation, ' +
    'a daily reading, and a structured evening examination.</p>' +
    '<a class="ar-nav-cta" href="/">Explore the app →</a></section>' +
    '</article>' +
    '<footer class="ar-footer"><p>Marcus &middot; A Stoic Practice App &middot; ' +
    '<a href="/">getmarcus.app</a> &middot; <a href="/learn">Learn</a> &middot; ' +
    '<a href="/stoics">The Stoics</a> &middot; <a href="/library">The Library</a></p></footer>' +
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
.ar-head{margin-bottom:36px}
.ar-eyebrow{font-family:Cinzel,Georgia,serif;font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:#c9a961;margin:0 0 14px}
.ar-eyebrow a{text-decoration:none}
.ar-title{font-family:Cinzel,Georgia,serif;font-size:clamp(30px,5.2vw,44px);font-weight:600;margin:0;letter-spacing:-.01em;line-height:1.18;text-wrap:balance}
.ar-p{font-size:17.5px;color:rgba(232,228,220,.86);margin:0 0 22px}
.ar-h2{font-family:Cinzel,Georgia,serif;font-size:13px;letter-spacing:.2em;text-transform:uppercase;color:#c9a961;margin:52px 0 18px;padding-bottom:10px;border-bottom:1px solid rgba(232,228,220,.09)}
.ar-h3{font-family:Cinzel,Georgia,serif;font-size:19px;font-weight:600;margin:36px 0 12px;color:#e8e4dc}
.ar-quote{margin:0 0 26px;padding:0 0 0 22px;border-left:2px solid #c9a961}
.ar-quote span{display:block;font-family:Cinzel,Georgia,serif;font-size:19px;line-height:1.5;color:#e8e4dc}
.ar-quote cite{display:block;margin-top:10px;font-style:normal;font-size:13px;letter-spacing:.08em;color:rgba(232,228,220,.5)}
.ar-list{margin:0 0 24px;padding-left:22px}
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
`;

build();
