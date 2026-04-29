#!/usr/bin/env node
/**
 * Daily Meditations — Newsletter Generator
 * Searches for a current event, applies a Stoic lens, posts to Beehiiv as draft.
 *
 * Usage:
 *   ANTHROPIC_KEY=sk-ant-... BEEHIIV_KEY=... BEEHIIV_PUB_ID=... node scripts/generate-newsletter.js
 */

const https = require('https');

const ANTHROPIC_KEY = process.env.ANTHROPIC_KEY;
const BEEHIIV_KEY = process.env.BEEHIIV_KEY;
const BEEHIIV_PUB_ID = process.env.BEEHIIV_PUB_ID;

if (!ANTHROPIC_KEY) { console.error('Missing ANTHROPIC_KEY'); process.exit(1); }

const SYSTEM_PROMPT = `You are the editor of Daily Meditations, a daily newsletter that applies Stoic philosophy to the world as it actually is today.

Your process:
1. Use the web search tool to find one significant current event from the past 48 hours — something real people are thinking about today.
2. Only use the event if a genuine Stoic theme applies naturally. Do not force a connection. If the news is trivial or the connection is weak, search for something else.
3. Write the edition in this exact format:

THEME: [2-4 words capturing the Stoic theme, not the news event itself. e.g. "On the instinct to retaliate" or "On watching institutions fail"]

QUOTE: [A real, verified quote from a Stoic or adjacent thinker that speaks to this theme. Include author and source. Never fabricate.]

CONTEXT: [Two short paragraphs separated by a blank line. The first paragraph: what's happening in the world right now, described plainly and without partisan framing. The second paragraph: the Stoic lens — what the quote actually means, why it applies here, what the ancient thinker would have said about this moment. Write as a scholar, not a pundit. No hot takes. No corporate wellness language. No productivity framing.]

THE QUESTION: [One genuine, non-rhetorical sentence the reader can carry through the day.]

Style rules:
- Direct, unhurried, precise prose. Short sentences.
- No em dashes as definitions — use colons instead.
- No words like "delve", "tapestry", "resonate", "journey", "transformative".
- The quote must be real and verifiable. If uncertain, choose another.
- Sources: Marcus Aurelius (Meditations), Epictetus (Discourses, Enchiridion), Seneca (Letters, Essays), Musonius Rufus, Cato, Viktor Frankl, Montaigne, James Stockdale.
- Total word count: 200-250 words.
- The event is the hook. The Stoic content is the substance.`;

function httpsPost(hostname, path, headers, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request(
      { hostname, path, method: 'POST', headers: { ...headers, 'Content-Length': Buffer.byteLength(data) } },
      (res) => {
        let raw = '';
        res.on('data', c => raw += c);
        res.on('end', () => {
          try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
          catch { resolve({ status: res.statusCode, body: raw }); }
        });
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function extractText(content) {
  // When web search is used, content has tool_use + tool_result + text blocks
  // Extract only the final text block
  if (!Array.isArray(content)) return '';
  const textBlocks = content.filter(b => b.type === 'text');
  return textBlocks.map(b => b.text).join('\n').trim();
}

function parseEdition(text) {
  const theme = (text.match(/THEME:\s*(.+)/)?.[1] || '').trim();
  const quote = (text.match(/QUOTE:\s*([\s\S]+?)(?=\n\nCONTEXT:)/)?.[1] || '').trim();
  const context = (text.match(/CONTEXT:\s*([\s\S]+?)(?=\n\nTHE QUESTION:)/)?.[1] || '').trim();
  const question = (text.match(/THE QUESTION:\s*([\s\S]+?)$/)?.[1] || '').trim();
  return { theme, quote, context, question };
}

function buildHtml(edition, dateStr) {
  const [para1, para2] = edition.context.split('\n\n');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:Georgia,serif;max-width:560px;margin:0 auto;padding:40px 20px;color:#1a1a1a;line-height:1.7;background:#fff;">
  <p style="font-size:11px;color:#999;letter-spacing:2px;text-transform:uppercase;margin-bottom:32px;">Daily Meditations &middot; ${dateStr}</p>
  <h2 style="font-size:12px;font-weight:400;color:#999;letter-spacing:2px;text-transform:uppercase;margin-bottom:24px;">${edition.theme}</h2>
  <blockquote style="border-left:2px solid #c9a84c;margin:0 0 28px;padding-left:20px;font-style:italic;font-size:17px;color:#2a2a2a;line-height:1.8;">${edition.quote}</blockquote>
  <p style="font-size:15px;margin-bottom:16px;">${para1 || ''}</p>
  <p style="font-size:15px;margin-bottom:28px;">${para2 || ''}</p>
  <p style="font-size:14px;color:#666;font-style:italic;border-top:1px solid #eee;padding-top:20px;">${edition.question}</p>
  <p style="font-size:11px;color:#bbb;margin-top:48px;border-top:1px solid #f0f0f0;padding-top:20px;">
    Daily Meditations is a companion to <a href="https://www.getmarcus.app" style="color:#c9a84c;text-decoration:none;">Marcus</a>, a Stoic practice app.
  </p>
</body></html>`;
}

async function run() {
  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  });
  console.log('Generating topical edition for', dateStr, '...\n');

  const res = await httpsPost(
    'api.anthropic.com', '/v1/messages',
    {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    },
    {
      model: 'claude-opus-4-6',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages: [{ role: 'user', content: `Generate today's edition. Today is ${dateStr}. Search for a current event first.` }],
    }
  );

  if (res.status !== 200) { console.error('Anthropic error:', res.body); process.exit(1); }

  const text = extractText(res.body.content);
  if (!text) { console.error('No text in response:', JSON.stringify(res.body.content, null, 2)); process.exit(1); }

  console.log('--- Generated edition ---\n');
  console.log(text);
  console.log('\n---\n');

  const edition = parseEdition(text);
  const html = buildHtml(edition, dateStr);

  if (BEEHIIV_KEY && BEEHIIV_PUB_ID) {
    console.log('Posting draft to Beehiiv...');
    const bRes = await httpsPost(
      'api.beehiiv.com', `/v2/publications/${BEEHIIV_PUB_ID}/posts`,
      { 'Content-Type': 'application/json', 'Authorization': `Bearer ${BEEHIIV_KEY}` },
      {
        subject: `${edition.theme} \u2014 ${dateStr}`,
        content: { free: { web: html, email: html } },
        status: 'draft',
        authors: [{ name: 'Gio' }],
      }
    );
    if (bRes.status === 201 || bRes.status === 200) {
      console.log('Draft created in Beehiiv.');
    } else {
      console.error('Beehiiv error:', bRes.status, JSON.stringify(bRes.body));
    }
  } else {
    console.log('(Set BEEHIIV_KEY and BEEHIIV_PUB_ID to post to Beehiiv)');
  }
  console.log('\nDone.');
}

run().catch(console.error);
