// MCP server: Marcus's Stoic quote checker, for ChatGPT apps and Claude
// connectors. https://getmarcus.app/api/mcp
//
// People ask chat assistants "did Marcus Aurelius really say this?" all the
// time, and the models repeat the same misattributions the site exists to
// correct. This hands them the checked library instead: the same 163 cited
// passages and documented misattributions behind /check-a-stoic-quote, with
// the same matcher (api/_lib/match.js), so the app and the site always give
// the same answer.
//
// Read-only, no accounts, nothing stored, and no model calls: the assistant
// does the reasoning, this only looks things up, so it costs nothing to run.
//
// Transport is MCP Streamable HTTP in its stateless form: each POST carries a
// JSON-RPC message (or a batch) and gets a JSON reply. No sessions and no SSE
// stream, because nothing here ever needs to push.
//
// Links carry utm_source from ?client= on the connector URL (chatgpt, claude),
// so the site's analytics can tell whether this sends anyone at all, which is
// the whole experiment.

import { DATA } from './_data/quotes.js';
import { verdict } from './_lib/match.js';

const SITE = 'https://getmarcus.app';
const VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];
const SERVER = { name: 'marcus-stoic-quotes', title: 'Marcus: Stoic Quote Checker', version: '1.0.0' };

const INSTRUCTIONS =
  'Use these tools whenever a quotation from Marcus Aurelius, Seneca, Epictetus, Socrates, Aristotle or another ' +
  'classical or Stoic thinker comes up. Many famous "Stoic quotes" are misattributed, and recalling them from memory ' +
  'repeats the error. check_quote says whether a quote is genuine, misattributed (with its real source), or not in the ' +
  'library. find_quotes returns genuine, cited passages on a theme, which are safe to present as direct quotations. ' +
  'A not_found result means the library does not hold the quote; it is not evidence that the quote is fake. Say so.';

const TOOLS = [
  {
    name: 'check_quote',
    title: 'Check a Stoic quote',
    description:
      'Check whether a quotation attributed to Marcus Aurelius, Seneca, Epictetus, Socrates, Aristotle or another ' +
      'classical thinker is genuine. Returns a verdict: "misattributed" (a documented false attribution, with who ' +
      'actually wrote it), "verified" (in the checked library, with work and section), "close" (resembles a passage ' +
      'in the library: usually a different translation or a paraphrase that has hardened into a quotation), or ' +
      '"not_found" (not in the library; this is not a verdict that it is fake). Use when someone asks whether a ' +
      'person really said something, asks for the source of a quote, or before presenting a Stoic quote as a direct ' +
      'quotation.',
    inputSchema: {
      type: 'object',
      properties: {
        quote: { type: 'string', description: 'The quotation, as the user gave it. An attached attribution ("— Seneca") is fine.' },
        attributed_to: { type: 'string', description: 'Who the quote is credited to, if the user said.' },
      },
      required: ['quote'],
      additionalProperties: false,
    },
    annotations: { title: 'Check a Stoic quote', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'find_quotes',
    title: 'Find genuine Stoic quotes',
    description:
      'Find genuine quotations from the Stoics and related thinkers on a theme, such as anxiety, anger, grief, death, ' +
      'discipline, control, adversity, other people or the morning. Every result is verbatim from a named translation ' +
      'with work and section, so it is safe to present as a direct quotation. Use this instead of quoting from memory.',
    inputSchema: {
      type: 'object',
      properties: {
        topic: { type: 'string', description: 'A theme or situation in plain words, e.g. "anxiety about the future" or "dealing with difficult people".' },
        author: { type: 'string', description: 'Optional: limit to one author, e.g. "Seneca".' },
        limit: { type: 'integer', minimum: 1, maximum: 10, description: 'How many quotes to return (default 5).' },
      },
      required: ['topic'],
      additionalProperties: false,
    },
    annotations: { title: 'Find genuine Stoic quotes', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
];

// ── tools ───────────────────────────────────────────────────────────────────
const link = (p, client, hash) =>
  `${SITE}${p}?utm_source=${client}&utm_medium=mcp&utm_campaign=quote-checker${hash ? '#' + hash : ''}`;
const cite = q => [q.author, [q.work, q.section].filter(Boolean).join(' ')].filter(Boolean).join(', ');

export function checkQuote({ quote, attributed_to }, client) {
  if (typeof quote !== 'string' || !quote.trim()) throw new RpcError(-32602, 'quote is required');
  const v = verdict(quote.slice(0, 2000), DATA);
  const size = { passages: DATA.corpus.length, misattributions: DATA.mis.length };
  if (v.kind === 'short') {
    return out({ verdict: 'too_short', library: size }, 'That is too short to match. Try the whole line.');
  }
  if (v.kind === 'misattributed') {
    const r = v.row;
    return out({
      verdict: 'misattributed', quote: r.text, usually_credited_to: r.credited,
      actually: r.actual || null, confidence: r.confidence, note: r.note,
      source_trail: link('/misattributed-stoic-quotes', client, r.id), library: size,
    }, `Misattributed. "${r.text}" is usually credited to ${r.credited}, but it is ` +
      `${r.actual ? r.actual : 'of no known source'}. ${r.note}\nFull source trail: ${link('/misattributed-stoic-quotes', client, r.id)}`);
  }
  if (v.kind === 'verified') {
    const q = v.row;
    // A real passage credited to the wrong person is its own answer.
    const who = attributed_to && !q.author.toLowerCase().includes(String(attributed_to).toLowerCase().trim().split(/\s+/).pop())
      ? `The wording is genuine, but it is ${q.author}'s, not ${attributed_to}'s. ` : '';
    return out({
      verdict: 'verified', quote: q.quote, author: q.author, work: q.work, section: q.section || null,
      wrong_author: !!who, citation: cite(q), library: size,
      note: 'Verbatim from the translation held in the library. Other translations word it differently.',
    }, `${who}Verified: "${q.quote}" (${cite(q)}). Translations vary; this is the wording in the checked library.`);
  }
  if (v.kind === 'close') {
    const r = v.row;
    if (v.bad) {
      return out({
        verdict: 'close', resembles: { kind: 'misattribution', quote: r.text, usually_credited_to: r.credited, actually: r.actual || null },
        source_trail: link('/misattributed-stoic-quotes', client, r.id), library: size,
      }, `Not an exact match, but it closely resembles a known misattribution: "${r.text}", usually credited to ` +
        `${r.credited}, actually ${r.actual || 'of no known source'}. Likely a variant of the same false quote.\n` +
        `Source trail: ${link('/misattributed-stoic-quotes', client, r.id)}`);
    }
    return out({
      verdict: 'close', resembles: { kind: 'passage', quote: r.quote, author: r.author, work: r.work, section: r.section || null, citation: cite(r) },
      library: size,
    }, `Not an exact match, but it resembles a genuine passage: "${r.quote}" (${cite(r)}). Usually this means a different ` +
      'translation, or a paraphrase that has hardened into a quotation. Quote the passage itself, not the paraphrase.');
  }
  return out({ verdict: 'not_found', library: size, checker: link('/check-a-stoic-quote', client) },
    `Not in the library (${size.passages} cited passages, ${size.misattributions} documented misattributions). That is a ` +
    'description of this search, not a verdict: the library may not hold it, or it may be a different translation. ' +
    'What it does mean is that no one has supplied a work and a section for it, so treat the attribution as unchecked.');
}

const STOP = new Set('a an the and or of to in on for with about from by is are be being my me i you your how what when why do does dealing deal feel feeling quote quotes stoic stoics on'.split(' '));
const stem = w => w.replace(/(ing|ies|es|s)$/, '');

// People ask in their own words; the library is tagged in its own. "Grief"
// found nothing by Seneca, whose passages on loss are tagged mortality and
// suffering. Each everyday word maps to the library themes that answer it.
const SYN = {
  grief: ['mortality', 'impermanence', 'suffering', 'acceptance', 'memento mori'],
  loss: ['mortality', 'impermanence', 'suffering', 'acceptance'],
  mourn: ['mortality', 'impermanence', 'suffering'],
  death: ['mortality', 'memento mori', 'impermanence'],
  dying: ['mortality', 'memento mori'],
  stress: ['anxiety', 'worry', 'present', 'control'],
  worr: ['anxiety', 'worry', 'fear', 'present'],
  anxiou: ['anxiety', 'worry', 'fear'],
  overthink: ['anxiety', 'perception', 'thought', 'present'],
  afraid: ['fear', 'anxiety'],
  angry: ['anger', 'restraint', 'patience'],
  frustration: ['anger', 'patience', 'acceptance'],
  rage: ['anger', 'restraint'],
  failure: ['adversity', 'resilience', 'errors', 'perseverance'],
  setback: ['adversity', 'resilience', 'obstacles'],
  hardship: ['adversity', 'endurance', 'resilience'],
  obstacle: ['obstacles', 'adversity'],
  motivation: ['discipline', 'action', 'purpose'],
  procrastination: ['discipline', 'action', 'time'],
  lazy: ['discipline', 'action', 'work'],
  productivity: ['discipline', 'work', 'focus', 'time'],
  busy: ['time', 'focus', 'simplicity'],
  people: ['difficult people', 'community', 'humanity'],
  coworker: ['difficult people', 'community'],
  boss: ['difficult people', 'leadership'],
  family: ['love', 'community', 'duty'],
  relationship: ['love', 'friendship', 'difficult people'],
  breakup: ['impermanence', 'acceptance', 'love'],
  money: ['wealth', 'contentment', 'enough', 'desire'],
  rich: ['wealth', 'contentment', 'enough'],
  happiness: ['contentment', 'serenity', 'inner peace', 'gratitude'],
  calm: ['equanimity', 'serenity', 'inner peace'],
  peace: ['inner peace', 'serenity', 'equanimity'],
  pride: ['ego', 'humility'],
  confidence: ['self-trust', 'character'],
  courage: ['fear', 'adversity', 'endurance'],
};

export function findQuotes({ topic, author, limit }, client) {
  if (typeof topic !== 'string' || !topic.trim()) throw new RpcError(-32602, 'topic is required');
  const n = Math.min(Math.max(parseInt(limit, 10) || 5, 1), 10);
  const words = topic.toLowerCase().split(/[^a-z]+/).filter(w => w.length > 2 && !STOP.has(w)).map(stem);
  const extra = new Set(words.flatMap(w => SYN[w] || Object.entries(SYN).find(([k]) => w.startsWith(k))?.[1] || []));
  const who = author ? String(author).toLowerCase().trim() : '';
  const scored = DATA.corpus
    .filter(q => !who || q.author.toLowerCase().includes(who))
    .map(q => {
      const themes = q.themes.map(t => t.toLowerCase());
      const text = q.quote.toLowerCase().split(/[^a-z]+/).map(stem);
      let s = themes.filter(t => extra.has(t)).length * 2;
      for (const w of words) {
        if (themes.some(t => t.split(/[^a-z]+/).map(stem).includes(w))) s += 3;
        if (q.virtues.some(v => stem(v) === w)) s += 2;
        if (text.includes(w)) s += 1;
      }
      return { q, s };
    })
    .filter(x => x.s > 0)
    .sort((a, b) => b.s - a.s || a.q.id.localeCompare(b.q.id))
    .slice(0, n);
  if (!scored.length) {
    return out({ quotes: [], themes_available: themeList() },
      `No passages in the library match "${topic}"${author ? ' by ' + author : ''}. Themes it covers include: ${themeList().slice(0, 30).join(', ')}.`);
  }
  const quotes = scored.map(({ q }) => ({ quote: q.quote, author: q.author, work: q.work, section: q.section || null, citation: cite(q), themes: q.themes }));
  return out({ quotes, more: link('/stoic-quotes', client) },
    quotes.map((q, i) => `${i + 1}. "${q.quote}" (${q.citation})`).join('\n') +
    `\n\nEach is verbatim from the translation held in the library. More, by theme: ${link('/stoic-quotes', client)}`);
}

function themeList() {
  const c = {};
  for (const q of DATA.corpus) for (const t of q.themes) c[t] = (c[t] || 0) + 1;
  return Object.entries(c).sort((a, b) => b[1] - a[1]).map(([t]) => t);
}

const out = (structuredContent, text) => ({ content: [{ type: 'text', text }], structuredContent, isError: false });

// ── JSON-RPC ────────────────────────────────────────────────────────────────
class RpcError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

export function handle(msg, client) {
  if (!msg || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') {
    return { jsonrpc: '2.0', id: msg && msg.id !== undefined ? msg.id : null, error: { code: -32600, message: 'Invalid Request' } };
  }
  // A notification gets no reply.
  if (msg.id === undefined || msg.id === null) return null;
  const ok = result => ({ jsonrpc: '2.0', id: msg.id, result });
  try {
    switch (msg.method) {
      case 'initialize': {
        const asked = msg.params && msg.params.protocolVersion;
        return ok({
          protocolVersion: VERSIONS.includes(asked) ? asked : VERSIONS[0],
          capabilities: { tools: { listChanged: false } },
          serverInfo: SERVER,
          instructions: INSTRUCTIONS,
        });
      }
      case 'ping': return ok({});
      case 'tools/list': return ok({ tools: TOOLS });
      case 'tools/call': {
        const { name, arguments: args } = msg.params || {};
        if (name === 'check_quote') return ok(checkQuote(args || {}, client));
        if (name === 'find_quotes') return ok(findQuotes(args || {}, client));
        throw new RpcError(-32602, `Unknown tool: ${name}`);
      }
      default: throw new RpcError(-32601, `Method not found: ${msg.method}`);
    }
  } catch (e) {
    // A bad argument is reported as a tool error the model can read and fix;
    // anything else is a protocol error.
    if (msg.method === 'tools/call' && e.code === -32602 && !/Unknown tool/.test(e.message)) {
      return ok({ content: [{ type: 'text', text: e.message }], isError: true });
    }
    return { jsonrpc: '2.0', id: msg.id, error: { code: e.code || -32603, message: e.code ? e.message : 'Internal error' } };
  }
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, Mcp-Session-Id, Mcp-Protocol-Version',
};

export default function handler(req, res) {
  for (const [k, v] of Object.entries(CORS)) res.setHeader(k, v);
  if (req.method === 'OPTIONS') return res.status(204).end();
  // Stateless: no server-to-client stream to open.
  if (req.method !== 'POST') return res.status(405).setHeader('Allow', 'POST, OPTIONS').json({ error: 'Use POST (MCP Streamable HTTP).' });
  const client = /^[a-z0-9-]{1,20}$/.test(String((req.query && req.query.client) || '')) ? req.query.client : 'mcp';
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return res.status(400).json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }); }
  }
  const replies = (Array.isArray(body) ? body : [body]).map(m => handle(m, client)).filter(Boolean);
  if (!replies.length) return res.status(202).end();
  return res.status(200).json(Array.isArray(body) ? replies : replies[0]);
}
