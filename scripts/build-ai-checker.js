#!/usr/bin/env node
// /quote-checker-for-ai: setup and usage for the quote checker as a Claude
// connector and a ChatGPT app (the MCP server at /api/mcp).
//
// Both directories require a documentation URL with "clear setup and usage
// instructions", so this page is that, and nothing more: how to connect, what
// the two tools return, and what the checker cannot tell you. The last part
// matters most. "Not in the library" is not "fake", on this page as on
// /check-a-stoic-quote, and an assistant's user deserves to hear that before
// they rely on it.
//
// The counts are read from the same generated data the server answers from,
// so the page cannot claim a library size the server does not have.
//
// Re-run:  node scripts/build-ai-checker.js

const fs = require('fs');
const path = require('path');
const { footerHtml } = require('./site-footer');
const { navHtml, navCss, fontLinks, skipLink } = require('./site-nav');

const ROOT = path.join(__dirname, '..');
const SITE = 'https://getmarcus.app';
const SLUG = 'quote-checker-for-ai';
const OUT = path.join(ROOT, 'public', SLUG + '.html');
const GA = '<script src="/analytics.js"></script>';
const SERVER = SITE + '/api/mcp';
const EMAIL = 'hello@getmarcus.app';

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// The generated module is ESM; read its JSON body rather than importing it.
function counts() {
  const src = fs.readFileSync(path.join(ROOT, 'api', '_data', 'quotes.js'), 'utf8');
  const data = JSON.parse(src.slice(src.indexOf('{'), src.lastIndexOf('}') + 1));
  return { passages: data.corpus.length, mis: data.mis.length };
}

function build() {
  const n = counts();
  const title = 'The Stoic Quote Checker for ChatGPT and Claude | Marcus';
  const desc = 'Connect the Marcus quote checker to Claude or ChatGPT to check whether a Stoic quote is real ' +
    'and find genuine, cited quotations. Setup, tools, and limits.';
  const canonical = SITE + '/' + SLUG;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: 'The Stoic quote checker for ChatGPT and Claude',
    description: desc,
    url: canonical,
    author: { '@type': 'Organization', name: 'Marcus', url: SITE },
    publisher: { '@type': 'Organization', name: 'Marcus', logo: { '@type': 'ImageObject', url: SITE + '/skull-gold.png' } },
  };
  const code = t => '<pre class="ai-code"><code>' + esc(t) + '</code></pre>';
  const ask = t => '<li>' + esc(t) + '</li>';

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
    '<meta property="og:title" content="' + esc(title) + '">' +
    '<meta property="og:description" content="' + esc(desc) + '">' +
    '<meta property="og:url" content="' + canonical + '">' +
    '<meta property="og:image" content="' + SITE + '/og/check-a-stoic-quote.png">' +
    '<meta name="twitter:card" content="summary_large_image">' +
    '<meta name="twitter:title" content="' + esc(title) + '">' +
    '<meta name="twitter:description" content="' + esc(desc) + '">' +
    '<meta name="twitter:image" content="' + SITE + '/og/check-a-stoic-quote.png">' +
    '<link rel="icon" href="/favicon.ico" sizes="48x48">' +
    '<link rel="icon" type="image/png" href="/favicon.png">' +
    '<link rel="apple-touch-icon" href="/apple-touch-icon.png">' +
    fontLinks() +
    '<style>' + CSS + '</style>' +
    '<script type="application/ld+json">' + JSON.stringify(jsonLd) + '</script>' +
    '</head><body>' +
    skipLink('ai') + navHtml('ai') +
    '<main class="ai-main" id="main">' +
    '<header class="ai-head"><p class="ai-eyebrow">For ChatGPT and Claude</p>' +
    '<h1 class="ai-title">The Stoic quote checker, inside your AI assistant</h1></header>' +

    '<p class="ai-p">Ask an AI assistant whether Marcus Aurelius really said something and it will often ' +
    'repeat the same misattributions that circulate everywhere else. This connector gives the assistant ' +
    'something better than its memory: the library behind <a href="/check-a-stoic-quote">our quote checker</a>, ' +
    n.passages + ' cited passages and ' + n.mis + ' <a href="/misattributed-stoic-quotes">documented ' +
    'misattributions</a>, so it can tell you where a quote actually comes from.</p>' +
    '<p class="ai-p">It is free, read-only, and needs no account.</p>' +

    '<h2 class="ai-h2">Connect it to Claude</h2>' +
    '<ol class="ai-list">' +
    '<li>In Claude, open <strong>Settings</strong>, then <strong>Connectors</strong>.</li>' +
    '<li>Choose <strong>Add custom connector</strong>, name it Marcus, and paste this URL:' + code(SERVER + '?client=claude') + '</li>' +
    '<li>Leave authentication empty, add it, and make sure it is switched on in a conversation.</li>' +
    '</ol>' +

    '<h2 class="ai-h2">Connect it to ChatGPT</h2>' +
    '<ol class="ai-list">' +
    '<li>In ChatGPT settings, under <strong>Apps &amp; Connectors</strong>, turn on <strong>Developer mode</strong> ' +
    'in the advanced settings.</li>' +
    '<li>Create a new app with this URL and no authentication:' + code(SERVER + '?client=chatgpt') + '</li>' +
    '<li>Select it from the tools menu in a conversation, or mention it by name.</li>' +
    '</ol>' +
    '<p class="ai-p ai-small">Once the listing is approved in each directory, you will also be able to add it from ' +
    'there without the URL.</p>' +

    '<h2 class="ai-h2">What it does</h2>' +
    '<p class="ai-p"><strong>check_quote</strong> takes a quotation, with or without its attribution, and ' +
    'returns one of four answers:</p>' +
    '<ul class="ai-list">' +
    '<li><strong>Misattributed.</strong> It is on our published list. You get who actually wrote it and a ' +
    'link to the full source trail.</li>' +
    '<li><strong>Verified.</strong> It is in the library, with the work and section, so you can open the book ' +
    'and check. If it is real but credited to the wrong person, it says so.</li>' +
    '<li><strong>Close.</strong> It resembles something we hold. Usually that is a different translation, or a ' +
    'paraphrase that has hardened into a quotation, and you get the real passage to quote instead.</li>' +
    '<li><strong>Not in the library.</strong> See below. This is not the same as fake.</li>' +
    '</ul>' +
    '<p class="ai-p"><strong>find_quotes</strong> takes a topic in plain words, such as grief, anxiety about ' +
    'the future, or a difficult coworker, and returns genuine passages on it, each verbatim from a named ' +
    'translation with its work and section. It can be limited to one author.</p>' +

    '<h2 class="ai-h2">Things to ask</h2>' +
    '<ul class="ai-list">' +
    ask('Did Marcus Aurelius really say "What we do in life echoes in eternity"?') +
    ask('Is "the obstacle is the way" a real quote?') +
    ask('Who actually said "Be kind, for everyone you meet is fighting a hard battle"?') +
    ask('Give me a real Seneca quote about grief, with the source.') +
    ask('I want a Stoic quote about dealing with difficult people for a talk. Make sure it is genuine.') +
    '</ul>' +

    '<h2 class="ai-h2">What it cannot tell you</h2>' +
    '<p class="ai-p">The library is ' + n.passages + ' passages, not the whole of ancient philosophy. When a ' +
    'quote is not in it, the honest answer is that we cannot find it, which describes our search, not the ' +
    'quote. Two common reasons a real passage comes back that way: we do not hold it, or you have a ' +
    'different translation. Two honest translations of the same Greek can share almost no words.</p>' +
    '<p class="ai-p">What a not-found answer does tell you is that nobody has supplied a book and a chapter. ' +
    'Until someone can, treat the attribution as unchecked.</p>' +

    '<h2 class="ai-h2">Privacy</h2>' +
    '<p class="ai-p">The assistant sends only the quote or topic it is asking about. There is no account, we do ' +
    'not store or log what you check, and the checker makes no calls to any AI service. The ' +
    '<a href="/privacy">privacy policy</a> has the details.</p>' +

    '<h2 class="ai-h2">Support</h2>' +
    '<p class="ai-p">Found a wrong answer, or a misattribution we should add? Write to ' +
    '<a href="mailto:' + EMAIL + '">' + EMAIL + '</a>. Corrections are published, not quietly made.</p>' +

    '<section class="ai-app">' +
    '<img class="ai-app-skull" src="/skull-gold.png" alt="" width="64" height="64">' +
    '<p class="ai-app-copy">The same checked library is what Marcus reads from: a daily Stoic practice for iOS, ' +
    'with a morning preparation, a daily reading, and an evening examination.</p>' +
    '<a class="ai-nav-cta" href="/">Explore the app →</a></section>' +
    '</main>' +
    footerHtml('ai') +
    '</body></html>';

  fs.writeFileSync(OUT, html, 'utf8');
  console.log('Built ' + path.relative(ROOT, OUT));
}

const CSS = `
*{box-sizing:border-box}
body{margin:0;background:#0d0d0f;color:#e8e4dc;font-family:Inter,system-ui,-apple-system,sans-serif;line-height:1.7;-webkit-font-smoothing:antialiased}
a{color:inherit}
img{max-width:100%;display:block}
.ai-nav{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px 24px;border-bottom:1px solid rgba(232,228,220,.09);flex-wrap:wrap}
.ai-brand{display:flex;align-items:center;gap:10px;text-decoration:none;font-family:Cinzel,Georgia,serif;font-size:19px;letter-spacing:.02em}
.ai-brand img{width:40px;height:40px;object-fit:contain;opacity:.9}
.ai-nav-right{display:flex;align-items:center;gap:20px;flex-wrap:wrap}
.ai-nav-link{text-decoration:none;font-size:14px;color:rgba(232,228,220,.72)}
.ai-nav-cta{text-decoration:none;font-size:14px;color:#0d0d0f;background:#c9a961;padding:9px 16px;border-radius:999px;white-space:nowrap}
.ai-main{max-width:680px;margin:0 auto;padding:56px 24px 8px}
.ai-head{margin-bottom:34px}
.ai-eyebrow{font-family:Cinzel,Georgia,serif;font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:#c9a961;margin:0 0 14px}
.ai-title{font-family:Cinzel,Georgia,serif;font-size:clamp(28px,4.8vw,40px);font-weight:600;margin:0;letter-spacing:-.01em;line-height:1.2;text-wrap:balance}
.ai-p{font-size:17.5px;color:rgba(232,228,220,.86);margin:0 0 22px}
.ai-p a,.ai-list a{color:#c9a961}
.ai-small{font-size:15px;color:rgba(232,228,220,.62)}
.ai-h2{font-family:Cinzel,Georgia,serif;font-size:13px;letter-spacing:.2em;text-transform:uppercase;color:#c9a961;margin:48px 0 18px;padding-bottom:10px;border-bottom:1px solid rgba(232,228,220,.09)}
.ai-list{margin:0 0 24px;padding-left:22px}
.ai-list li{font-size:17px;color:rgba(232,228,220,.84);margin-bottom:14px}
.ai-list strong{color:#e8e4dc}
.ai-code{margin:12px 0 4px;padding:14px 16px;background:#16161a;border:1px solid rgba(232,228,220,.12);border-radius:10px;overflow-x:auto;font-size:14.5px;color:#e8e4dc;white-space:pre-wrap;word-break:break-all}
.ai-code code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.ai-app{text-align:center;margin:64px 0 0;padding:44px 24px;border-top:1px solid rgba(232,228,220,.09)}
.ai-app-skull{width:56px;height:56px;object-fit:contain;margin:0 auto 16px;opacity:.9}
.ai-app-copy{font-size:16px;color:rgba(232,228,220,.78);max-width:52ch;margin:0 auto 20px}
.ai-footer{text-align:center;padding:32px 24px 48px;font-size:13px;color:rgba(232,228,220,.45)}
.ai-footer a{color:rgba(232,228,220,.7)}

/* Shared chrome last, as in every builder. */
${navCss('ai')}`;

build();
