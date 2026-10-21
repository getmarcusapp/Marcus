// The quote matcher, for the MCP server (api/mcp.js).
//
// A port of the matcher that runs in the browser on /check-a-stoic-quote
// (CLIENT in scripts/build-quote-checker.js), kept deliberately line for line.
// The site and the ChatGPT/Claude app must never disagree about whether a
// quote is real, so scripts/check.js runs every passage and every
// misattribution through both and fails on any difference. Change one, change
// the other.
//
// Files under api/_lib are not routes (Vercel skips names starting with _).

export function norm(t) {
  return String(t || '').toLowerCase()
    .replace(/[‘’“”]/g, "'")
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

// Strip a trailing attribution: people paste the card, dash and all.
export function stripAttr(t) {
  const out = String(t || '').replace(/\s*[—–-]{1,2}\s*[^—–-]{0,70}$/, '');
  return out.trim().split(/\s+/).filter(Boolean).length >= 2 ? out : String(t || '');
}

function bigrams(s) {
  const w = s.split(' '), out = {};
  for (let i = 0; i < w.length - 1; i++) out[w[i] + ' ' + w[i + 1]] = 1;
  return out;
}

function dice(a, b) {
  const A = bigrams(a), B = bigrams(b), ka = Object.keys(A), kb = Object.keys(B);
  if (!ka.length || !kb.length) return a === b ? 1 : 0;
  let shared = 0;
  for (const k of ka) if (B[k]) shared++;
  return (2 * shared) / (ka.length + kb.length);
}

function score(input, candidate) {
  if (input === candidate) return 1;
  if (input.length > 24 && candidate.indexOf(input) !== -1) return 0.94;
  if (candidate.length > 24 && input.indexOf(candidate) !== -1) return 0.94;
  return dice(input, candidate);
}

function best(input, rows, textAt) {
  let top = null, topScore = 0;
  for (const r of rows) {
    const s = score(input, norm(textAt(r)));
    if (s > topScore) { topScore = s; top = r; }
  }
  return { row: top, score: topScore };
}

// Same thresholds and the same order as the site: a known misattribution wins
// ties, because it is the more useful answer.
export function verdict(raw, data) {
  const input = norm(stripAttr(raw));
  if (input.split(' ').length < 2) return { kind: 'short' };
  const m = best(input, data.mis, r => r.text);
  const v = best(input, data.corpus, r => r.quote);
  if (m.score >= 0.82) return { kind: 'misattributed', row: m.row, score: m.score };
  if (v.score >= 0.82) return { kind: 'verified', row: v.row, score: v.score };
  const near = m.score > v.score ? { row: m.row, score: m.score, bad: true } : { row: v.row, score: v.score, bad: false };
  if (near.score >= 0.45) return { kind: 'close', row: near.row, score: near.score, bad: near.bad };
  return { kind: 'not_found' };
}
