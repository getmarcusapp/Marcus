#!/usr/bin/env node
/**
 * Themed quote pages — public/stoic-quotes/<slug>.html plus an index.
 *
 * Generated from constants/stoicQuotes.js, so every line on every page carries
 * chapter and verse and cannot drift from the corpus. That is the whole point:
 * essentially every "Stoic quotes about death" page on the web is unsourced,
 * and this one cites Meditations II.11 next to the words.
 *
 * WHY THE SETS ARE HAND-PICKED RATHER THAN FILTERED BY TAG.
 *
 * The `themes` tags in the corpus are loose and were written for the daily
 * reading's variety logic, not for pages. Filtering on them mechanically
 * produced pages of five quotes, several of which appeared on three other
 * pages, which is the thin-content pattern this site has turned down twice.
 * Each page below is a curated id list instead: nine to twelve passages, and a
 * quote appears on at most two pages.
 *
 * WHY SIX PAGES AND NOT EIGHT. Eight themes cleared the "5+ quotes" bar, but:
 *   control    — 3 of its 5 also sit on `perception`, and /dichotomy-of-control
 *                already covers it in long form. Two near-duplicates, not one page.
 *   integrity  — 4 of its 5 sit on `character` or `discipline`.
 *   present    — its strongest passages are load-bearing on `death`.
 * `other people` replaced them: the corpus supports it at nine passages and it
 * is a distinct search, not a slice of one already covered.
 *
 * To add a page: add an entry below, run this, then rebuild the archive so the
 * sitemap picks it up.
 */
const fs = require('fs');
const path = require('path');
const { footerHtml } = require('./site-footer');
const { navHtml, navCss } = require('./site-nav');

const ROOT = path.join(__dirname, '..');
const SITE = 'https://getmarcus.app';
const OUT_DIR = path.join(ROOT, 'public', 'stoic-quotes');
const GA = '<script src="/analytics.js"></script>';

function loadCorpus() {
  const src = fs.readFileSync(path.join(ROOT, 'constants', 'stoicQuotes.js'), 'utf8')
    .replace(/export\s+const/g, 'const')
    .replace(/export\s+function/g, 'function');
  const mod = { exports: {} };
  new Function('module', 'exports', src + '\nmodule.exports={STOIC_QUOTES};')(mod, mod.exports);
  return mod.exports.STOIC_QUOTES;
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const PAGES = [
  {
    slug: 'death',
    title: 'Stoic Quotes on Death',
    blurb: 'Twelve passages on mortality from Marcus Aurelius, Seneca, Epictetus and Musonius Rufus, each with its source.',
    intro:
      'The Stoics wrote about death more than almost anything else, and not as a morbid interest. Their claim is that a life is ' +
      'shaped by how honestly you hold its ending: that the person who has rehearsed dying is harder to frighten, wastes less ' +
      'time, and postpones less. Seneca goes furthest, calling the rehearsal of death a rehearsal of freedom.',
    note:
      'These are the passages the practice actually rests on, not the ones that circulate on quote cards. If you came here after ' +
      'seeing something attributed to Marcus Aurelius about echoing in eternity, that line is from a film: see our ' +
      '<a href="/misattributed-stoic-quotes">list of misattributed Stoic quotes</a>.',
    ids: [
      'aurelius-meditations-12-1-now',
      'aurelius-meditations-2-14-present',
      'aurelius-meditations-2-17-life',
      'aurelius-meditations-12-32-tiny-share',
      'aurelius-meditations-7-69-perfection',
      'epictetus-enchiridion-21-death',
      'epictetus-discourses-1-1-prohaeresis',
      'seneca-letter-26-rehearse-death',
      'seneca-letter-101-each-day',
      'seneca-letter-47-fortune',
      'seneca-letter-1-time',
      'musonius-each-day-last',
    ],
  },
  {
    slug: 'perception',
    title: 'Stoic Quotes on Perception and Judgment',
    blurb: 'Ten passages on the Stoic claim that events do not disturb us, our judgments about them do.',
    intro:
      'This is the load-bearing idea in Stoic practice, and the one most often flattened in the retelling. The claim is not that ' +
      'nothing bad happens, nor that you should feel less. It is narrower: between an event and your distress sits a judgment you ' +
      'made, usually without noticing, and that judgment is the part available to you.',
    note:
      'Note how specific the passages are about where the work happens. It is at the moment of assent, before the reaction, not ' +
      'after it. A paraphrase that relocates it to "how you react" is describing something else: see ' +
      '<a href="/did-epictetus-say-its-not-what-happens-to-you">did Epictetus say it is not what happens to you?</a>',
    ids: [
      'epictetus-enchiridion-5-disturbed',
      'aurelius-meditations-8-47-judgment',
      'aurelius-meditations-4-7-injury',
      'aurelius-meditations-3-10-quickly-leave',
      'aurelius-meditations-4-12-things',
      'epictetus-enchiridion-20-insults',
      'epictetus-enchiridion-26-misfortune',
      'epictetus-enchiridion-43-handles',
      'seneca-letter-78-pain',
      'aurelius-meditations-9-40-pain',
    ],
  },
  {
    slug: 'anxiety',
    title: 'Stoic Quotes on Anxiety and Fear',
    blurb: 'Seven passages on imagined trouble, from Seneca, Marcus Aurelius and Epictetus, each with its source.',
    intro:
      'The Stoic account of anxiety is unusually practical, and Seneca is its best source because he plainly suffered from it. ' +
      'The argument is arithmetic rather than consoling: most of what we fear either never arrives or arrives smaller than the ' +
      'version we rehearsed, and in the meantime we have paid for it in full, often more than once.',
    note:
      'This is the material modern cognitive behavioral therapy drew on directly, and its founders said so. For the lineage and ' +
      'where it stops, see <a href="/stoicism-and-cbt">Stoicism and cognitive behavioral therapy</a>.',
    ids: [
      'seneca-letter-13-imagination',
      'seneca-letter-13-anxiety',
      'aurelius-meditations-9-13-judgment',
      'aurelius-meditations-8-36-burden',
      'aurelius-meditations-7-27-not-there',
      'seneca-letter-4-fortune',
      'epictetus-enchiridion-8-wish',
    ],
  },
  {
    slug: 'discipline',
    title: 'Stoic Quotes on Discipline and Self-Mastery',
    blurb: 'Twelve passages on habit, attention and the use of time, with chapter and verse.',
    intro:
      'Stoic discipline is not endurance for its own sake. It is the claim that character is the residue of what you repeatedly ' +
      'do, so the small settled decisions matter more than the large declared ones. Marcus is the most useful writer here ' +
      'precisely because he is arguing with himself, at dawn, about getting out of bed.',
    note:
      'Several of these are instructions rather than observations, which is how they were meant. The Enchiridion is a handbook, ' +
      'and Marcus wrote his notebooks to be reread.',
    ids: [
      'aurelius-meditations-5-1-do-the-work',
      'aurelius-meditations-2-4-time',
      'aurelius-meditations-12-17-not-vexed',
      'aurelius-meditations-5-16-thoughts',
      'aurelius-meditations-2-5-roman',
      'epictetus-enchiridion-50-rules',
      'epictetus-discourses-3-23-be-then-do',
      'epictetus-discourses-4-1-freedom',
      'seneca-letter-96-soldier',
      'seneca-letter-1-vindicate-yourself',
      'seneca-shortness-of-life-busy',
      'cicero-tusculan-disputations-mind',
    ],
  },
  {
    slug: 'character',
    title: 'Stoic Quotes on Character',
    blurb: 'Ten passages on what a person is made of, and how the Stoics thought it was built.',
    intro:
      'The Stoics treated character as something constructed rather than discovered, and they were specific about the method: ' +
      'decide in advance what sort of person you are, so that each separate occasion does not have to be argued out from the ' +
      'beginning. The test they keep returning to is what you do when nobody is watching, and what difficulty reveals.',
    note:
      'Epictetus is blunt that describing a practice is not the same as having one. The line about never calling yourself a ' +
      'philosopher is followed, in the original, by an image about sheep not bringing the shepherd grass to prove they have eaten.',
    ids: [
      'epictetus-enchiridion-33-character',
      'epictetus-discourses-1-24-difficulties',
      'aurelius-meditations-6-6-revenge',
      'aurelius-meditations-10-16-be-good',
      'epictetus-enchiridion-46-philosopher',
      'aurelius-meditations-6-21-truth',
      'cicero-de-officiis-honesty',
      'seneca-letter-71-good-character',
      'epictetus-enchiridion-17-actor',
      'musonius-philosophy-correctness',
    ],
  },
  {
    slug: 'other-people',
    title: 'Stoic Quotes on Dealing with Other People',
    blurb: 'Nine passages on difficult people, insult, anger and what we owe each other.',
    intro:
      'Stoicism is often read as a philosophy of withdrawal, which is close to the opposite of what its authors practiced. Marcus ' +
      'ran an empire, Seneca served in government, Cicero argued in the courts. Justice is the virtue that is entirely about ' +
      'other people, and three of the four Stoic virtues are about acting rather than feeling.',
    note:
      'Marcus opens his second book by listing the people he expects to meet that day and why he cannot hate them. It is a ' +
      'preparation, written before the day began, not a reflection afterwards.',
    ids: [
      'aurelius-meditations-2-1-difficult-people',
      'aurelius-meditations-7-22-love',
      'aurelius-meditations-4-18-neighbor',
      'aurelius-meditations-9-29-do-the-good',
      'aurelius-meditations-9-29-do-good',
      'epictetus-discourses-1-1-hindrance',
      'seneca-on-anger-delay',
      'seneca-on-anger-3-36-self-examination',
      'cicero-friendship-light',
    ],
  },
];

const CSS = `
${navCss('tq')}
*{box-sizing:border-box}
body{margin:0;background:#0d0d0f;color:#e8e4dc;font-family:Inter,system-ui,-apple-system,sans-serif;line-height:1.65;-webkit-font-smoothing:antialiased}
a{color:#c9a961}
img{max-width:100%;display:block}
.tq-nav{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px 24px;border-bottom:1px solid rgba(232,228,220,.09);flex-wrap:wrap}
.tq-brand{display:flex;align-items:center;gap:10px;text-decoration:none;color:#e8e4dc;font-family:Cinzel,Georgia,serif;letter-spacing:.08em}
.tq-nav-right{display:flex;align-items:center;gap:14px}
.tq-nav-link{text-decoration:none;font-size:14px;color:rgba(232,228,220,.72)}
.tq-nav-cta{text-decoration:none;font-size:14px;color:#0d0d0f;background:#c9a961;padding:9px 16px;border-radius:999px;white-space:nowrap}
.tq-hero{padding:72px 24px 40px;border-bottom:1px solid rgba(232,228,220,.09)}
.tq-wrap{max-width:760px;margin:0 auto}
.tq-eyebrow{font-family:Cinzel,Georgia,serif;font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:#c9a961;margin:0 0 14px}
.tq-title{font-family:Cinzel,Georgia,serif;font-size:clamp(30px,5.2vw,46px);font-weight:600;margin:0 0 20px;letter-spacing:-.01em;line-height:1.15;text-wrap:balance}
.tq-intro{font-size:18px;color:rgba(232,228,220,.82);margin:0;max-width:62ch}
.tq-main{padding:40px 24px 64px}
.tq-note{font-size:15px;color:rgba(232,228,220,.66);border-left:2px solid rgba(201,169,97,.4);padding:2px 0 2px 16px;margin:0 0 40px;max-width:62ch}
.tq-q{margin:0 0 34px;padding:0 0 30px;border-bottom:1px solid rgba(232,228,220,.08)}
.tq-q:last-of-type{border-bottom:0}
.tq-text{font-size:20px;line-height:1.55;margin:0 0 12px;color:#f3efe7}
.tq-cite{font-size:14px;color:rgba(232,228,220,.6);margin:0;font-style:normal}
.tq-cite b{color:rgba(232,228,220,.85);font-weight:600}
.tq-h2{font-family:Cinzel,Georgia,serif;font-size:22px;margin:44px 0 14px}
.tq-list{list-style:none;padding:0;margin:0;display:grid;gap:14px}
.tq-card{border:.5px solid rgba(232,228,220,.16);border-radius:12px;padding:18px 20px}
.tq-card a{text-decoration:none;font-size:17px;font-family:Cinzel,Georgia,serif}
.tq-card p{margin:6px 0 0;font-size:14px;color:rgba(232,228,220,.66)}
.tq-app{margin-top:56px;display:flex;align-items:center;gap:18px;flex-wrap:wrap;border-top:1px solid rgba(232,228,220,.09);padding-top:28px}
.tq-app p{margin:0;flex:1 1 280px;font-size:15px;color:rgba(232,228,220,.78)}
.tq-footer{padding:26px 24px 52px;border-top:1px solid rgba(232,228,220,.09);font-size:13px;color:rgba(232,228,220,.55);text-align:center}
.tq-footer a{color:rgba(232,228,220,.7)}
`;

const NAV =
  navHtml('tq');

const FOOTER = footerHtml('tq', '/stoic-quotes');

function shell({ title, desc, canonical, jsonLd, body }) {
  return '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' + esc(title) + ' | Marcus</title>' +
    '<meta name="description" content="' + esc(desc) + '">' +
    '<link rel="canonical" href="' + canonical + '">' +
    '<link rel="icon" href="/favicon.ico" sizes="48x48">' +
    '<meta property="og:title" content="' + esc(title) + '">' +
    '<meta property="og:description" content="' + esc(desc) + '">' +
    '<meta property="og:url" content="' + canonical + '">' +
    '<meta property="og:type" content="article">' +
    '<link rel="preconnect" href="https://fonts.googleapis.com">' +
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
    '<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600&family=Inter:wght@400;500&display=swap" rel="stylesheet">' +
    '<style>' + CSS.trim() + '</style>' +
    (jsonLd ? '<script type="application/ld+json">' + JSON.stringify(jsonLd) + '</script>' : '') +
    GA + '</head><body>' + NAV + body + FOOTER + '</body></html>';
}

const APP_CTA =
  '<section class="tq-app">' +
  '<img src="/skull-gold.png" alt="" width="52" height="52">' +
  '<p>Marcus turns these into a daily practice for iOS: a morning preparation, a daily reading matched to what you are working on, and an honest evening examination.</p>' +
  '<a class="tq-nav-cta" href="/">Explore the app →</a></section>';

function quoteHtml(q) {
  const cite = [q.author, q.work, q.source].filter(Boolean);
  return '<blockquote class="tq-q">' +
    '<p class="tq-text">' + esc(q.quote) + '</p>' +
    '<p class="tq-cite"><b>' + esc(cite[0]) + '</b>' +
    (cite.length > 1 ? ', ' + esc(cite.slice(1).join(' ')) : '') + '</p>' +
    '</blockquote>';
}

function build() {
  const corpus = loadCorpus();
  const byId = new Map(corpus.map(q => [q.id, q]));
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const seen = new Map();
  for (const page of PAGES) {
    const quotes = page.ids.map(id => {
      const q = byId.get(id);
      if (!q) {
        console.error('Refusing to build: ' + page.slug + ' references ' + id + ', which is not in the corpus.');
        process.exit(1);
      }
      seen.set(id, (seen.get(id) || 0) + 1);
      return q;
    });
    const canonical = SITE + '/stoic-quotes/' + page.slug;
    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      headline: page.title,
      description: page.blurb,
      url: canonical,
      inLanguage: 'en-US',
      publisher: { '@type': 'Organization', name: 'Marcus', url: SITE },
      hasPart: quotes.map(q => ({
        '@type': 'Quotation',
        text: q.quote,
        spokenByCharacter: { '@type': 'Person', name: q.author },
        isPartOf: { '@type': 'CreativeWork', name: [q.work, q.source].filter(Boolean).join(' ') },
      })),
    };
    const body =
      '<header class="tq-hero"><div class="tq-wrap">' +
      '<p class="tq-eyebrow"><a href="/stoic-quotes">Sourced quotes</a></p>' +
      '<h1 class="tq-title">' + esc(page.title) + '</h1>' +
      '<p class="tq-intro">' + page.intro + '</p>' +
      '</div></header>' +
      '<main class="tq-main"><div class="tq-wrap">' +
      '<p class="tq-note">' + page.note + '</p>' +
      quotes.map(quoteHtml).join('') +
      APP_CTA +
      '</div></main>';
    fs.writeFileSync(path.join(OUT_DIR, page.slug + '.html'),
      shell({ title: page.title, desc: page.blurb, canonical, jsonLd, body }), 'utf8');
    console.log('  ' + String(quotes.length).padStart(2) + ' quotes  /stoic-quotes/' + page.slug);
  }

  // Index
  const canonical = SITE + '/stoic-quotes';
  const body =
    '<header class="tq-hero"><div class="tq-wrap">' +
    '<p class="tq-eyebrow">Sourced quotes</p>' +
    '<h1 class="tq-title">Stoic Quotes, With Sources</h1>' +
    '<p class="tq-intro">Every passage here is cited to a book and a chapter, because most of what circulates as Stoic wisdom is not, ' +
    'and a good deal of it is not Stoic. Browse them by theme, check a quote of your own, or read the ones we traced to somebody else.</p>' +
    '</div></header>' +
    '<main class="tq-main"><div class="tq-wrap">' +
    '<p class="tq-note">We audited our own quote library one passage at a time and removed the ones that were not what they claimed to be. ' +
    'The findings are on our <a href="/misattributed-stoic-quotes">list of misattributed Stoic quotes</a>.</p>' +
    '<ul class="tq-list">' +
    PAGES.map(p => '<li class="tq-card"><a href="/stoic-quotes/' + p.slug + '">' + esc(p.title) + '</a>' +
      '<p>' + esc(p.blurb) + '</p></li>').join('') +
    '</ul>' +
    // This is the hub for the whole quotes cluster, not just the themed pages.
    // It shipped without a single link to the checker, which is the most useful
    // thing in the section.
    '<h2 class="tq-h2">Checking a quote of your own</h2>' +
    '<ul class="tq-list">' +
    '<li class="tq-card"><a href="/check-a-stoic-quote">Check a Stoic quote</a>' +
    '<p>Paste a line attributed to Marcus Aurelius, Seneca or Epictetus and find out whether it is theirs. ' +
    'Runs in your browser, nothing is sent anywhere.</p></li>' +
    '<li class="tq-card"><a href="/misattributed-stoic-quotes">The Stoic quotes that are not Stoic</a>' +
    '<p>The quotations we traced to someone else: a screenwriter, a songwriter, Voltaire, Kant, a Victorian minister. ' +
    'Found by auditing our own library.</p></li>' +
    '</ul>' + APP_CTA +
    '</div></main>';
  fs.writeFileSync(path.join(OUT_DIR, 'index.html'),
    shell({
      title: 'Stoic Quotes, With Sources',
      desc: 'Themed collections of Stoic passages from Marcus Aurelius, Seneca and Epictetus, every one cited to a book and chapter.',
      canonical,
      jsonLd: {
        '@context': 'https://schema.org', '@type': 'CollectionPage',
        headline: 'Stoic Quotes, With Sources', url: canonical, inLanguage: 'en-US',
        publisher: { '@type': 'Organization', name: 'Marcus', url: SITE },
      },
      body,
    }), 'utf8');

  const reused = [...seen.entries()].filter(([, n]) => n > 1);
  console.log('Built ' + PAGES.length + ' theme pages + index → public/stoic-quotes/');
  console.log('  ' + seen.size + ' distinct passages used, ' + reused.length + ' appearing on two pages');
}

module.exports = { PAGES };
if (require.main === module) build();
