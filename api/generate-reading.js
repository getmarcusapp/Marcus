// Vercel serverless function: proxies the daily-reading generation to the
// Anthropic API so the key lives server-side only (env: ANTHROPIC_API_KEY).
// The app previously called api.anthropic.com directly with an EXPO_PUBLIC_
// key inlined in the JS bundle — extractable from the IPA by anyone.
//
// The system prompt, model, and max_tokens are pinned here, so this endpoint
// can't be repurposed as a general Claude proxy: whatever a caller sends
// arrives as a user message under our curator prompt, capped at 2048 output
// tokens.
//
// Abuse guards are deliberately lightweight for v1 (no shared store on a
// static-site deploy): method/shape/size checks plus a best-effort per-IP
// throttle on warm instances. For real per-device limits, add Vercel KV and
// key on a device token.

const SYSTEM_PROMPT = `You are a curator of Stoic and philosophical wisdom generating a personalized daily reading for a user of a Stoic practice app.

CRITICAL: You will be given a list of CANDIDATE QUOTES with their authors, works, and source citations. You MUST select your quote from this candidate list — do not generate, paraphrase, or substitute any quote. Use the exact quote text and exact attribution as provided. This is non-negotiable: misattribution destroys user trust.

Your job is to:
1. Select the candidate that best resonates with the user's Compass — what brought them to the practice, what they want to overcome, who they aspire to be.
2. Write a 3–4 sentence reflection in the second person that connects the quote to the user's practice. The reflection may quietly echo language or ideas from their Compass when it earns the connection — never quote the Compass back at them.

Output this EXACT JSON format with no other text:
{
  "quote_id": "the id of the candidate you selected",
  "quote": "the exact quote text from the candidate (verbatim)",
  "author": "the exact author from the candidate (verbatim)",
  "work": "the exact work from the candidate (verbatim)",
  "theme": "2-4 word Stoic theme",
  "virtue": "Wisdom|Courage|Temperance|Justice",
  "reflection": "A 3-4 sentence reflection in second person, grounded in the user's Compass when it earns the connection."
}

Rules:
- Pick the quote whose theme genuinely speaks to something in the user's Compass. Prefer relevance over rotation.
- Reflection must be original and specific to the chosen quote — no generic Stoic platitudes.
- Match the virtue field to the dominant virtue of the chosen candidate.
- Do not use temporal markers (today, yesterday, this week, recently) in the reflection — the reading should read as timeless.`;

const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 2048;
const MAX_MESSAGE_CHARS = 30000;

// Best-effort throttle: per-IP request timestamps on this warm instance.
// Serverless instances don't share memory, so this is a speed bump for
// naive abuse, not a guarantee.
const RATE_WINDOW_MS = 60 * 60 * 1000;
const RATE_MAX_PER_WINDOW = 20;
const hits = new Map();

function throttled(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter(t => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_MAX_PER_WINDOW) return true;
  recent.push(now);
  hits.set(ip, recent);
  // Keep the map from growing unbounded on a long-lived instance.
  if (hits.size > 10000) hits.clear();
  return false;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Server not configured' });
    return;
  }

  // Optional shared app token: enforced only when MARCUS_APP_TOKEN is set in
  // the Vercel env. Extractable from the app bundle, so it's rotation
  // hygiene rather than security — it blocks scrapers reusing the endpoint
  // without at least unpacking the current IPA.
  const requiredToken = process.env.MARCUS_APP_TOKEN;
  if (requiredToken && req.headers['x-marcus-token'] !== requiredToken) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (throttled(ip)) {
    res.status(429).json({ error: 'Too many requests. Try again later.' });
    return;
  }

  const userMessage = req.body?.userMessage;
  if (typeof userMessage !== 'string' || !userMessage.trim() || userMessage.length > MAX_MESSAGE_CHARS) {
    res.status(400).json({ error: 'Invalid request' });
    return;
  }

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });
    const data = await upstream.json();
    if (!upstream.ok) {
      // Don't leak upstream error details (they can include key metadata);
      // a generic failure is all the client needs.
      res.status(502).json({ error: 'Generation failed. Try again.' });
      return;
    }
    const text = Array.isArray(data.content)
      ? data.content.filter(b => b.type === 'text').map(b => b.text).join('')
      : '';
    res.status(200).json({ text });
  } catch (e) {
    res.status(502).json({ error: 'Generation failed. Try again.' });
  }
}
