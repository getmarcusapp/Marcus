#!/usr/bin/env node
/**
 * Render the "never said this" shorts: 1080x1920, a visual per beat, voiceover
 * with word-highlighted captions, a music bed, and an end card.
 *
 *   node scripts/shorts.js check                    validate every script
 *   node scripts/shorts.js render echoes-in-eternity
 *   node scripts/shorts.js render --all
 *     --allow-unverified   render scripts whose payoff is not in the checked
 *                          library (only after checking it against print)
 *     --voice=say          force the Mac's built-in voice
 *   node scripts/shorts.js listen <id> | --all   transcribe and check words + timing
 *     --no-gen             never call fal; generated beats fall back to the
 *                          short's painting (free, for layout work)
 *
 * THE CHECK IS THE POINT. The channel's claim is that these quotations were
 * checked, so the renderer refuses a video whose on-screen quote has drifted
 * from constants/misattributions.js, or whose payoff is not word for word in
 * constants/stoicQuotes.js. AI writes narration and makes pictures; it does not
 * get to paraphrase the evidence.
 *
 * VISUALS. Each segment may name a visual: a painting from the app's gallery
 * ({ art }) or a generated clip ({ gen }). A single image held for thirty
 * seconds gives the eye nothing new, which is where Shorts lose people, so the
 * picture changes on every beat, cut exactly as the sentence starts. Generated
 * clips come from fal.ai (Veo 3.1 Lite, 9:16), with no legible text and no
 * faces: video models garble lettering, and an invented face of a real person
 * is a made-up fact on a channel about facts.
 *
 * VOICE, MUSIC, SOUND. ElevenLabs for all three when the key is set: the clone
 * of Gio's voice with per-character timestamps (which is what makes word
 * highlighting possible), a generated underscore, and sound effects on marked
 * beats. Without a key the voice falls back to macOS `say` and there is no
 * music. Everything generated is cached by its inputs, so re-rendering after a
 * layout change costs nothing.
 *
 * TEXT. This ffmpeg build has neither drawtext nor libass, so every text state
 * is an HTML page rendered to a transparent PNG by headless Chrome, using the
 * app's own Cinzel and Inter. The states are then stitched into one alpha video
 * track rather than overlaid one input at a time, which would not scale to a
 * state per highlighted word.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'shorts-out');
// 24fps: the generated footage is 24fps, and converting it to 30 meant
// repeating every fourth frame, which read as a stutter on anything moving
// (21 repeats in 105 frames on the letterpress lever pull).
const W = 1080, H = 1920, FPS = 24;
const BG = '#0c0b0f', CREAM = '#e8e4dc', GOLD = '#c9a961';
const LEAD_IN = 0.6;
const END_CARD = 3.0;
const CHROME = process.env.CHROME_PATH ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const FONTS = path.join(ROOT, 'node_modules', '@expo-google-fonts');
const VIDEO_MODEL = 'fal-ai/veo3.1/lite';

(function loadEnvLocal() {
  try {
    for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n')) {
      const m = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && m[2] && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '').trim();
    }
  } catch { /* fine */ }
})();

const { SHORTS } = require('./shorts-scripts');
const { ART } = require('./site-artwork');
const { loadMisattributions } = require('./find-misquotes');
const { STOIC_QUOTES } = require('../constants/stoicQuotes.js');

// ── validation ──────────────────────────────────────────────────────────────
// Compare on words, not characters: curly versus straight quotes and a
// trailing full stop are typography, not content.
const words = t => String(t).toLowerCase().replace(/[‘’]/g, "'").replace(/[^a-z0-9' ]+/g, ' ')
  .split(/\s+/).filter(Boolean);

function validate(short) {
  const problems = [];
  const entry = loadMisattributions().find(e => e.id === short.id);
  if (!entry) problems.push(`no misattribution entry with id "${short.id}"`);
  if (!ART[short.painting]) problems.push(`no painting "${short.painting}" in site-artwork.js`);
  for (const seg of short.segments) {
    if (seg.quote && entry) {
      const q = words(seg.quote), e = words(entry.text);
      // A leading part is allowed, so a long quotation can stop at a natural
      // break. Anything else is a paraphrase.
      if (q.length < 4 || q.some((w, i) => w !== e[i])) {
        problems.push(`quote is not the entry's text, word for word: "${seg.quote}"`);
      }
    }
    if ('payoff' in seg) {
      if (seg.unverified) {
        problems.push(`UNVERIFIED payoff (${seg.cite}): not in the checked library`);
        continue;
      }
      const src = STOIC_QUOTES.find(q => q.id === seg.payoff);
      if (!src) { problems.push(`payoff id "${seg.payoff}" is not in stoicQuotes.js`); continue; }
      if (!words(src.quote).join(' ').includes(words(seg.excerpt).join(' '))) {
        problems.push(`payoff excerpt does not appear verbatim in ${seg.payoff}`);
      }
    }
  }
  return problems;
}

// ── cache ───────────────────────────────────────────────────────────────────
// Everything bought from an API is keyed by what was asked for, so the same
// request is never paid for twice.
const hash = x => crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0, 24);
function cached(dir, key, ext) {
  const d = path.join(OUT, dir);
  fs.mkdirSync(d, { recursive: true });
  return path.join(d, key + ext);
}

// ── voice ───────────────────────────────────────────────────────────────────
const spoken = seg => seg.quote || seg.say || seg.excerpt;
// Intonation context is the adjacent sentence on each side and no more. It was
// 400 characters either way, which in a 30-second script is the whole script,
// so editing one line changed every sentence's cache key and re-voiced all of
// them. One sentence either side is enough to carry the rhythm across the join.
//
// And only the PREVIOUS sentence. Passing the next one as well told the model
// the sentence continued, so it stopped mid-flow instead of letting the last
// word land: "Usually credited to Marcus Aurelius." ended at -38.6 dB, cut off
// mid-decay, which before the Hubbard pause sounded like the audio cutting
// out. With only the previous sentence as context, every line ends naturally.
const neighbours = (all, i) => [i > 0 ? spoken(all[i - 1]) : '', ''];

// Returns { wav, words: [{ text, start, end }] } with times relative to the
// start of this sentence. The words are split on ordinary spaces only, the
// same way chunk() splits, so the two line up token for token.
async function voiceSegment(all, i, voice) {
  const text = spoken(all[i]);
  const key = hash(voice === 'elevenlabs'
    ? ['el-ts', process.env.ELEVENLABS_VOICE_ID, text, ...neighbours(all, i)]
    : ['say-Daniel-172', text]);
  const wav = cached('.voice-cache', key, '.wav');
  const meta = cached('.voice-cache', key, '.json');
  if (!fs.existsSync(wav) || !fs.existsSync(meta)) {
    let align = null;
    if (voice === 'elevenlabs') {
      const res = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${process.env.ELEVENLABS_VOICE_ID}/with-timestamps?output_format=mp3_44100_128`,
        {
          method: 'POST',
          headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text, model_id: 'eleven_multilingual_v2',
            previous_text: neighbours(all, i)[0], next_text: neighbours(all, i)[1],
          }),
        });
      if (!res.ok) throw new Error('ElevenLabs HTTP ' + res.status + ': ' + (await res.text()).slice(0, 200));
      const j = await res.json();
      fs.writeFileSync(wav + '.mp3', Buffer.from(j.audio_base64, 'base64'));
      ff(['-i', wav + '.mp3', '-ar', '44100', '-ac', '2', wav]);
      fs.rmSync(wav + '.mp3');
      align = j.alignment;
    } else {
      execFileSync('say', ['-v', 'Daniel', '-r', '172', '-o', wav + '.aiff', text]);
      ff(['-i', wav + '.aiff', '-ar', '44100', '-ac', '2', wav]);
      fs.rmSync(wav + '.aiff');
    }
    fs.writeFileSync(meta, JSON.stringify({ text, align }));
  }
  const { align } = JSON.parse(fs.readFileSync(meta, 'utf8'));
  return { wav, words: wordTimes(text, align, duration(wav)) };
}

function wordTimes(text, align, dur) {
  const tokens = text.split(/ +/).filter(Boolean);
  if (!align) {
    // No timestamps from `say`: share the sentence out by characters.
    const total = tokens.reduce((s, t) => s + t.length, 0);
    let at = 0;
    return tokens.map(t => { const d = dur * t.length / total; const w = { text: t, start: at, end: at + d }; at += d; return w; });
  }
  const out = [];
  let ci = 0;
  for (const t of tokens) {
    while (ci < align.characters.length && align.characters[ci] === ' ') ci++;
    const s = align.character_start_times_seconds[ci] ?? 0;
    ci += t.length;
    const e = align.character_end_times_seconds[Math.min(ci - 1, align.characters.length - 1)] ?? s;
    out.push({ text: t, start: s, end: e });
  }
  return out;
}

// ── music and sound ─────────────────────────────────────────────────────────
async function elevenAudio(kind, body, dir) {
  const key = hash([kind, body]);
  const file = cached(dir, key, '.mp3');
  if (fs.existsSync(file)) return file;
  const url = kind === 'music' ? 'https://api.elevenlabs.io/v1/music' : 'https://api.elevenlabs.io/v1/sound-generation';
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`ElevenLabs ${kind} HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  return file;
}

// Where a music track reaches its normal level: RMS in quarter-second
// windows, and the first window within 8 dB of the median. Never so late that
// less than `need` seconds remain.
function musicStart(file, need) {
  // ametadata prints to ffmpeg's log, which is stderr.
  const r = require('child_process').spawnSync('ffmpeg', ['-v', 'info', '-i', file, '-af',
    'aresample=44100,astats=metadata=1:reset=11025,ametadata=print:key=lavfi.astats.Overall.RMS_level',
    '-f', 'null', '-'], { maxBuffer: 1 << 26 });
  return startFromLevels(String(r.stderr), duration(file), need);
}
function startFromLevels(log, dur, need) {
  const lv = [...String(log).matchAll(/RMS_level=(-?[0-9.]+|-inf)/g)]
    .map(m => (m[1] === '-inf' ? -120 : Number(m[1])));
  if (!lv.length) return 0;
  const med = [...lv].sort((a, b) => a - b)[Math.floor(lv.length / 2)];
  // ffmpeg prints a reading every audio frame (about 26ms for mp3), not once
  // per reset window, so time comes from the count, not from the window size.
  // Assuming 0.25s per reading was the first version of this and it put the
  // start past the clamp every time.
  const i = lv.findIndex(x => x >= med - 8);
  return Math.max(0, Math.min(i * (dur / lv.length), dur - need));
}

// ── generated clips ─────────────────────────────────────────────────────────
// Negative prompt carries the two rules that hold for every clip.
const NEGATIVE = 'text, letters, words, writing, captions, subtitles, signage, watermark, logo, ' +
  'faces, visible faces, portraits, modern logos, cartoon, illustration, low quality';
const clipLength = d => (d <= 4.4 ? '4s' : d <= 6.4 ? '6s' : '8s');

const clipBody = (prompt, need, extraNegative) => ({
  prompt, negative_prompt: [NEGATIVE, extraNegative].filter(Boolean).join(', '),
  aspect_ratio: '9:16', resolution: '720p',
  duration: clipLength(need), generate_audio: false,
});
const clipPath = (prompt, extraNegative, need) =>
  cached('.gen-cache', hash([VIDEO_MODEL, clipBody(prompt, need, extraNegative)]), '.mp4');

async function generateClip(prompt, need, extraNegative) {
  const body = clipBody(prompt, need, extraNegative);
  const file = clipPath(prompt, extraNegative, need);
  if (fs.existsSync(file)) return file;
  const auth = { Authorization: 'Key ' + process.env.FAL_KEY, 'Content-Type': 'application/json' };
  const sub = await falSubmit(VIDEO_MODEL, body, auth);
  const started = Date.now();
  for (;;) {
    await new Promise(r => setTimeout(r, 4000));
    const st = await (await fetch(sub.status_url, { headers: auth })).json();
    if (st.status === 'COMPLETED') break;
    if (st.status === 'FAILED' || st.error) throw new Error('fal failed: ' + JSON.stringify(st).slice(0, 200));
    if (Date.now() - started > 8 * 60 * 1000) throw new Error('fal timed out after 8 minutes: ' + prompt.slice(0, 60));
  }
  const out = await (await fetch(sub.response_url, { headers: auth })).json();
  const url = out.video && out.video.url;
  if (!url) throw new Error('fal returned no video: ' + JSON.stringify(out).slice(0, 200));
  fs.writeFileSync(file, Buffer.from(await (await fetch(url)).arrayBuffer()));
  return file;
}

// fal answers "User is locked. Reason: Exhausted balance" intermittently even
// with money on the account: across four runs some requests went through and
// the rest were refused, and a single request always succeeded, while the
// dashboard showed $8.29 left. So requests go one at a time, and a lock is
// retried with a growing wait before it is treated as real.
async function falSubmit(model, body, auth) {
  for (let attempt = 0; ; attempt++) {
    const sub = await (await fetch(`https://queue.fal.run/${model}`, { method: 'POST', headers: auth, body: JSON.stringify(body) })).json();
    if (sub.request_id) return sub;
    const locked = /locked|exhausted balance/i.test(JSON.stringify(sub));
    if (!locked || attempt >= 5) throw new Error('fal submit failed: ' + JSON.stringify(sub).slice(0, 200));
    const wait = 15 * (attempt + 1);
    console.log(`  fal says locked; retrying in ${wait}s (attempt ${attempt + 2} of 6)`);
    await new Promise(r => setTimeout(r, wait * 1000));
  }
}

// Stills are for the one thing video models cannot do: legible text. Nano
// Banana Pro sets type accurately, and a still can be read and checked letter
// by letter before it is used, which a moving clip cannot. The quote on a gym
// wall has to be the real misattributed wording, or the shot is itself wrong.
const IMAGE_MODEL = 'fal-ai/nano-banana-pro';
const stillBody = prompt => ({ prompt, aspect_ratio: '9:16', resolution: '2K', output_format: 'jpeg', num_images: 1 });
const stillPath = prompt => cached('.gen-cache', hash([IMAGE_MODEL, stillBody(prompt)]), '.jpg');

async function generateStill(prompt) {
  const body = stillBody(prompt);
  const file = stillPath(prompt);
  if (fs.existsSync(file)) return file;
  const auth = { Authorization: 'Key ' + process.env.FAL_KEY, 'Content-Type': 'application/json' };
  const sub = await falSubmit(IMAGE_MODEL, body, auth);
  for (let tries = 0; ; tries++) {
    await new Promise(r => setTimeout(r, 3000));
    const st = await (await fetch(sub.status_url, { headers: auth })).json();
    if (st.status === 'COMPLETED') break;
    if (st.status === 'FAILED' || st.error || tries > 100) throw new Error('fal image failed: ' + JSON.stringify(st).slice(0, 200));
  }
  const out = await (await fetch(sub.response_url, { headers: auth })).json();
  const url = out.images && out.images[0] && out.images[0].url;
  if (!url) throw new Error('fal returned no image: ' + JSON.stringify(out).slice(0, 200));
  fs.writeFileSync(file, Buffer.from(await (await fetch(url)).arrayBuffer()));
  console.log('  new still, check its text before posting: ' + path.relative(ROOT, file));
  return file;
}

// ── helpers ─────────────────────────────────────────────────────────────────
const ff = args => execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], { maxBuffer: 1 << 26 });
const duration = f => Number(execFileSync('ffprobe',
  ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim());
const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// The app's originals are sharper than the site's 1200px copies; use them
// when they exist.
function artFile(key) {
  const a = ART[key];
  for (const dir of ['assets/meditations/img', 'assets/virtues', 'public/img/art']) {
    const f = path.join(ROOT, dir, a.file);
    if (fs.existsSync(f)) return f;
  }
  throw new Error('no image for ' + key);
}

const FONT_CSS = `
@font-face{font-family:Cinzel;font-weight:600;src:url(file://${FONTS}/cinzel/600SemiBold/Cinzel_600SemiBold.ttf)}
@font-face{font-family:Inter;font-weight:400;src:url(file://${FONTS}/inter/400Regular/Inter_400Regular.ttf)}
@font-face{font-family:Inter;font-weight:500;src:url(file://${FONTS}/inter/500Medium/Inter_500Medium.ttf)}
@font-face{font-family:Inter;font-weight:300;font-style:italic;src:url(file://${FONTS}/inter/300Light_Italic/Inter_300Light_Italic.ttf)}
@font-face{font-family:Inter;font-weight:400;font-style:italic;src:url(file://${FONTS}/inter/400Regular_Italic/Inter_400Regular_Italic.ttf)}
html,body{margin:0;width:${W}px;height:${H}px;overflow:hidden;background:transparent}
*{box-sizing:border-box}
.abs{position:absolute;left:0;right:0}
.shadow{text-shadow:0 2px 14px rgba(0,0,0,.85),0 0 2px rgba(0,0,0,.6)}`;

function png(body, file) {
  const html = file.replace(/\.png$/, '.html');
  fs.writeFileSync(html, `<!doctype html><html><head><meta charset="utf-8"><style>${FONT_CSS}</style></head><body>${body}</body></html>`);
  execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars',
    '--default-background-color=00000000', `--window-size=${W},${H}`,
    `--screenshot=${file}`, 'file://' + html], { stdio: 'ignore' });
  if (!fs.existsSync(file)) throw new Error('Chrome did not render ' + file);
}

// Captions sit in the lower third, above where YouTube and TikTok draw their
// own title and buttons.
const CAPTION_BOX = 'top:1120px;height:360px;display:flex;align-items:center;justify-content:center;padding:0 110px;text-align:center';

// Captions break where a reader would pause, not every N words. A fixed cut put
// "It's from Gladiator, the" on screen, split "Marcus / Aurelius", and left
// single words like "born." stranded on their own card.
//
// So: split into clauses at punctuation first; divide each clause into as few
// balanced pieces as fit (about 28 characters each) rather than filling greedily,
// which is what strands the last word; then nudge any boundary that would split
// a capitalised name or end on a word that needs what follows. A clause of one
// or two words joins the previous card when it fits, so "1998." rides along
// with the sentence it finishes instead of flashing up alone.
const CLINGY = new Set(['a', 'an', 'the', 'of', 'to', 'in', 'on', 'at', 'by', 'for', 'and', 'but', 'or',
  'as', 'with', 'from', 'his', 'her', 'their', 'your', 'my', 'its', "it's", 'is', 'was', 'that', 'who',
  'which', 'about', 'every', 'what', "here's", 'this']);
// Two lines of 60px Inter hold about 32 characters comfortably.
const MAX = 32;
const bare = w => w.toLowerCase().replace(/[^a-z']/g, '');
const isCap = w => /^[A-Z]/.test(w) && !/[,.;:!?]$/.test(w);

function balanced(ws) {
  const chars = ws.join(' ').length;
  const n = Math.max(1, Math.ceil(chars / MAX));
  if (n === 1) return [ws];
  const cuts = [];
  for (let k = 1; k < n; k++) cuts.push(Math.round(ws.length * k / n));
  const fixed = cuts.map(c => {
    // Try the planned cut, then one either side, for a boundary that neither
    // splits a name nor strands a clingy word.
    for (const d of [0, 1, -1, 2, -2]) {
      const x = c + d;
      if (x <= 0 || x >= ws.length) continue;
      const before = ws[x - 1], after = ws[x];
      if (CLINGY.has(bare(before))) continue;
      if (isCap(before) && /^[A-Z]/.test(after)) continue;
      return x;
    }
    // No clean break anywhere near: keep the clause whole and let it wrap to
    // two lines, rather than strand "It's from" before a title.
    return null;
  }).filter(c => c !== null);
  const out = [];
  let from = 0;
  for (const c of [...new Set(fixed)].sort((a, b) => a - b)) { if (c > from) { out.push(ws.slice(from, c)); from = c; } }
  out.push(ws.slice(from));
  return out;
}

function chunk(text) {
  // Ordinary spaces only: a non-breaking space in a script binds a title into
  // one unit, so "Way of the Peaceful Warrior" is never split across cards.
  const ws = text.split(/ +/).filter(Boolean);
  const clauses = [];
  let cur = [];
  for (const w of ws) {
    cur.push(w);
    if (/[,.;:!?]["'”’]?$/.test(w)) { clauses.push(cur); cur = []; }
  }
  if (cur.length) clauses.push(cur);
  const out = [];
  for (const cl of clauses) {
    const pieces = balanced(cl);
    const prev = out[out.length - 1];
    if (prev && cl.length <= 2 && !/[.!?]["'”’]?$/.test(prev[prev.length - 1]) &&
        (prev.join(' ') + ' ' + cl.join(' ')).length <= MAX + 6) {
      prev.push(...cl);
      continue;
    }
    out.push(...pieces);
  }
  return out.map(p => p.join(' '));
}

// ── build ───────────────────────────────────────────────────────────────────
const DEFAULT_MUSIC = 'Sparse, dark cinematic underscore for a short documentary about ancient Rome. ' +
  'A low sustained cello drone, soft felt piano notes, distant air. Slow, contemplative, ' +
  'restrained. No drums, no vocals, no melody that competes with speech. ' +
  'Begins immediately at full presence from the very first second: no fade-in, no intro, no build.';
const ZOOM = { in: [1.0, 1.08], out: [1.08, 1.0], tight: [1.28, 1.36] };

async function render(short, opts) {
  const problems = validate(short).filter(p => !(opts.allowUnverified && p.startsWith('UNVERIFIED')));
  if (problems.length) throw new Error(`refusing to render ${short.id}:\n  - ` + problems.join('\n  - '));
  const entry = loadMisattributions().find(e => e.id === short.id);
  const eleven = opts.voice !== 'say' && process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_VOICE_ID;
  const voice = eleven ? 'elevenlabs' : 'say';
  const canGen = !opts.noGen && !!process.env.FAL_KEY;

  const work = path.join(OUT, '.work', short.id);
  fs.rmSync(work, { recursive: true, force: true });
  fs.mkdirSync(work, { recursive: true });
  const silence = secs => {
    const f = path.join(work, `sil${hash([secs, Math.random()])}.wav`);
    ff(['-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo', '-t', secs.toFixed(3), f]);
    return f;
  };

  // 1. Voice, a sentence at a time, with word timings.
  const parts = [silence(LEAD_IN)];
  const timeline = [];
  let t = LEAD_IN;
  for (const [i, seg] of short.segments.entries()) {
    if (seg.pauseBefore) { parts.push(silence(seg.pauseBefore)); t += seg.pauseBefore; }
    const { wav, words } = await voiceSegment(short.segments, i, voice);
    const d = duration(wav);
    // 15ms fades at each edge, so a sentence never starts or stops on a click.
    // And a longer fade where a tail still has energy in its last 60ms, as a
    // backstop if a recording ever stops mid-decay again.
    const tail = Number((String(require('child_process').spawnSync('ffmpeg', ['-v', 'info', '-ss',
      Math.max(0, d - 0.06).toFixed(3), '-i', wav, '-af', 'astats', '-f', 'null', '-']).stderr)
      .match(/RMS level dB: (-?[0-9.]+)/) || [0, -120])[1]);
    const fo = tail > -55 ? 0.12 : 0.015;
    const faded = path.join(work, `voice${i}.wav`);
    ff(['-i', wav, '-af', `afade=t=in:d=0.015,afade=t=out:st=${Math.max(0, d - fo).toFixed(3)}:d=${fo}`, faded]);
    parts.push(faded);
    timeline.push({ seg, start: t, end: t + d, words, wav });
    t += d;
    const gap = seg.quote || 'payoff' in seg ? 0.55 : 0.22;
    parts.push(silence(gap));
    t += gap;
  }
  const voEnd = t, total = voEnd + END_CARD;
  const list = path.join(work, 'parts.txt');
  fs.writeFileSync(list, parts.map(p => `file '${p}'`).join('\n'));
  const vo = path.join(work, 'vo.wav');
  ff(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', vo]);

  // 2. Visuals: one per segment, cut exactly as its sentence starts. The first
  //    covers the silent lead-in; a pause holds the previous picture, so the
  //    cut lands with the reveal rather than before it.
  const frame = x => Math.round(x * FPS);
  const cuts = timeline.map((x, i) => (i === 0 ? 0 : frame(x.start)));
  cuts.push(frame(voEnd));
  // A segment's visual may be a list, which splits its time evenly into a
  // quick montage ("gym walls, tattoos" is two pictures, not one).
  // Without generation (--no-gen, or no key), anything already generated and
  // cached is still used: --no-gen means "spend nothing", not "ignore what has
  // already been paid for". Only uncached beats fall back to the painting.
  const isCached = v => fs.existsSync(v.still ? stillPath(v.still) : clipPath(v.gen, v.negative, v.__need || 4));
  const fallback = v => ((v.gen || v.still) && !canGen && !isCached(v)
    ? { art: short.painting, zoom: 'in', fellBack: true } : v);
  const specs = [];
  const bounds = [];
  timeline.forEach(({ seg }, i) => {
    const list = [].concat(seg.visual || { art: short.painting }).map(v => ({ ...v }));
    const a = cuts[i], b = cuts[i + 1];
    list.forEach((v, k) => {
      if (v.gen) v.__need = (Math.round(a + (b - a) * (k + 1) / list.length) - Math.round(a + (b - a) * k / list.length)) / FPS;
      v = fallback(v);
      specs.push(v);
      bounds.push([Math.round(a + (b - a) * k / list.length), Math.round(a + (b - a) * (k + 1) / list.length)]);
    });
  });
  // One at a time. Parallel requests were faster, but they are what trips
  // fal's lock (see falSubmit), and a half-generated short is worse than a
  // slow one.
  const clips = [];
  for (const [i, v] of specs.entries()) {
    clips.push(v.gen ? await generateClip(v.gen, (bounds[i][1] - bounds[i][0]) / FPS, v.negative)
      : v.still ? await generateStill(v.still) : null);
  }
  const visParts = [];
  for (const [i, v] of specs.entries()) {
    const n = Math.max(1, bounds[i][1] - bounds[i][0]);
    const f = path.join(work, `vis${i}.mp4`);
    const enc = ['-frames:v', String(n), '-r', String(FPS), '-an', '-c:v', 'libx264', '-crf', '16',
      '-preset', 'medium', '-pix_fmt', 'yuv420p', f];
    if (v.gen) {
      const have = duration(clips[i]);
      const k = Math.min(Math.max((n / FPS) / have, 1), 1.5);
      // When a clip must be slowed to fill its beat, interpolate the new
      // frames rather than repeating old ones, which is what a plain setpts
      // plus fps does and what makes slowed footage judder.
      const slow = k > 1.02 ? `setpts=${k.toFixed(4)}*PTS,minterpolate=fps=${FPS}:mi_mode=mci:mc_mode=aobmc:vsbmc=1` : `fps=${FPS}`;
      ff(['-i', clips[i], '-vf',
        `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},${slow},tpad=stop_mode=clone:stop_duration=10`,
        ...enc]);
    } else {
      const [z0, z1] = ZOOM[v.zoom || 'in'];
      const focus = v.focus ?? 0.3;
      ff(['-loop', '1', '-framerate', String(FPS), '-i', v.still ? clips[i] : artFile(v.art), '-vf',
        `scale=${W * 2}:${H * 2}:force_original_aspect_ratio=increase,crop=${W * 2}:${H * 2}:(iw-${W * 2})/2:(ih-${H * 2})*${focus},` +
        `zoompan=z='${z0}+(${z1 - z0})*on/${n}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${W}x${H}:fps=${FPS}`,
        ...enc]);
    }
    visParts.push(f);
  }
  const visList = path.join(work, 'vis.txt');
  fs.writeFileSync(visList, visParts.map(p => `file '${p}'`).join('\n'));
  const vis = path.join(work, 'vis.mp4');
  ff(['-f', 'concat', '-safe', '0', '-i', visList, '-c', 'copy', vis]);

  // 3. The fixed layer: gradients that keep text legible over moving footage,
  //    the kicker and the hook.
  const staticPng = path.join(work, 'static.png');
  png(`
    <div class="abs" style="top:0;height:720px;background:linear-gradient(to bottom,rgba(12,11,15,.94) 0,rgba(12,11,15,.72) 330px,rgba(12,11,15,0) 720px)"></div>
    <div class="abs" style="bottom:0;height:980px;background:linear-gradient(to top,rgba(12,11,15,.96) 0,rgba(12,11,15,.8) 520px,rgba(12,11,15,0) 980px)"></div>
    <div class="abs shadow" style="top:120px;text-align:center;font:500 26px Inter;letter-spacing:.32em;color:${GOLD}">MISATTRIBUTED</div>
    <div class="abs shadow" style="top:175px;height:270px;display:flex;align-items:center;justify-content:center;padding:0 80px;text-align:center;font:600 66px/1.18 Cinzel;color:${CREAM}">${esc(short.hook)}</div>`,
    staticPng);

  // 4. Text states: every caption card, and a state per spoken word so the
  //    current word lights up. Stitched into one alpha track.
  const states = [];
  let pn = 0;
  const shot = body => { const f = path.join(work, `T${pn++}.png`); png(body, f); return f; };
  for (const [i, { seg, start, end, words }] of timeline.entries()) {
    const until = i + 1 < timeline.length ? timeline[i + 1].start : voEnd;
    if (seg.quote) {
      states.push({ from: start, to: until, f: shot(`<div class="abs" style="${CAPTION_BOX};flex-direction:column">
        <div class="shadow" style="font:300 italic 56px/1.3 Inter;color:${CREAM}">&ldquo;${esc(seg.quote)}&rdquo;</div>
        <div class="shadow" style="margin-top:22px;font:400 27px Inter;color:rgba(232,228,220,.7);letter-spacing:.04em">commonly credited to ${esc(entry.credited)}</div></div>`) });
      continue;
    }
    if ('payoff' in seg) {
      const src = seg.payoff && STOIC_QUOTES.find(q => q.id === seg.payoff);
      const who = seg.author || (src && src.author) || '';
      states.push({ from: start, to: until, f: shot(`<div class="abs" style="${CAPTION_BOX};flex-direction:column">
        <div class="shadow" style="font:400 italic 58px/1.3 Inter;color:${GOLD}">&ldquo;${esc(seg.excerpt)}&rdquo;</div>
        <div class="shadow" style="margin-top:22px;font:500 27px Inter;color:rgba(201,169,97,.85);letter-spacing:.06em">${esc([who, seg.cite].filter(Boolean).join(', '))}</div></div>`) });
      continue;
    }
    const cards = chunk(seg.say).map(c => c.split(/ +/));
    if (cards.flat().length !== words.length) {
      throw new Error(`${short.id}: caption tokens (${cards.flat().length}) and voice words (${words.length}) disagree in "${seg.say}"`);
    }
    let w = 0;
    for (const [ci, card] of cards.entries()) {
      for (let k = 0; k < card.length; k++, w++) {
        const from = ci === 0 && k === 0 ? start : start + words[w].start;
        // The last word clears shortly after the voice stops rather than
        // holding until the next line. Across a normal gap that changes
        // nothing; across a pause it stops the frame freezing with stale text,
        // which read as the video stalling rather than as suspense.
        const to = w + 1 < words.length ? start + words[w + 1].start : Math.min(until, end + 0.3);
        const html = card.map((tok, j) => j === k
          ? `<span style="color:${GOLD}">${esc(tok)}</span>` : esc(tok)).join(' ');
        // The inner div matters: inside a flex container each text run and
        // span becomes its own item and the spaces between them collapse,
        // which rendered "RussellCrowesays" on the first attempt.
        states.push({ from, to, f: shot(`<div class="abs shadow" style="${CAPTION_BOX};font:500 62px/1.22 Inter;color:${CREAM}"><div>${html}</div></div>`) });
      }
    }
  }
  states.push({ from: voEnd, to: total, f: shot(`<div style="width:${W}px;height:${H}px;background:${BG};display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 110px;text-align:center">
      <img src="file://${path.join(ROOT, 'public', 'skull-gold.png')}" style="width:150px;height:auto;object-fit:contain">
      <div style="margin-top:56px;font:400 46px/1.35 Inter;color:${CREAM}">Every quote in Marcus is checked against its source.</div>
      <div style="margin-top:44px;font:600 62px Cinzel;color:${GOLD};letter-spacing:.04em">getmarcus.app</div></div>`) });

  const blank = shot('');
  const seq = [];
  let at = 0;
  for (const s of states.sort((a, b) => a.from - b.from)) {
    const f0 = frame(s.from), f1 = frame(s.to);
    if (f0 > at) seq.push({ f: blank, n: f0 - at });
    if (f1 > Math.max(f0, at)) { seq.push({ f: s.f, n: f1 - Math.max(f0, at) }); at = f1; }
  }
  // One symlink per frame, read as a numbered image sequence at exactly FPS.
  // The first version fed the states to ffmpeg's concat demuxer with a
  // duration each, which does not keep still images frame-exact: the
  // Semisonic track came out as 805 frames claiming 32.1s where 873 frames and
  // 29.1s were planned, so captions drifted steadily behind the pictures and
  // "This is him." landed over the wrong painting. Laying it out frame by
  // frame makes the length exact by construction.
  const framesDir = path.join(work, 'frames');
  fs.mkdirSync(framesDir, { recursive: true });
  let fi = 0;
  for (const s of seq) for (let k = 0; k < s.n; k++) {
    fs.symlinkSync(s.f, path.join(framesDir, `f${String(fi++).padStart(6, '0')}.png`));
  }
  const text = path.join(work, 'text.mov');
  ff(['-framerate', String(FPS), '-i', path.join(framesDir, 'f%06d.png'), '-c:v', 'png', '-pix_fmt', 'rgba', text]);
  const want = frame(total);
  const got = Number(execFileSync('ffprobe', ['-v', 'error', '-count_frames', '-select_streams', 'v:0',
    '-show_entries', 'stream=nb_read_frames', '-of', 'csv=p=0', text]).toString().trim());
  if (Math.abs(got - want) > 1) throw new Error(`caption track is ${got} frames, expected ${want}: timing would drift`);

  // 5. Sound: voice, a music bed under it, and effects on marked beats.
  const audioIn = ['-i', vo];
  const mix = ['[3:a]apad[v]'];
  const labels = ['[v]'];
  let ai = 4;
  if (eleven) {
    const music = await elevenAudio('music',
      { prompt: short.music || DEFAULT_MUSIC, music_length_ms: Math.ceil(total + 12) * 1000 }, '.music-cache');
    audioIn.push('-i', music);
    // The generated tracks open as slow crescendos, near silence for several
    // seconds, so under the voice the music seemed to start at twelve. Asking
    // for no intro did not stop it, and a silence threshold only trimmed a
    // second because one early note crossed it. So the track starts where its
    // loudness first reaches its own normal level. The extra 12s requested
    // above is the headroom that trim eats into.
    const off = musicStart(music, total);
    mix.push(`[${ai}:a]aresample=44100,atrim=start=${off.toFixed(2)},asetpts=PTS-STARTPTS,` +
      `volume=0.2,afade=t=in:d=0.4,afade=t=out:st=${(total - 2.5).toFixed(2)}:d=2.5[m]`);
    labels.push('[m]');
    ai++;
    for (const { seg, start } of timeline) {
      if (!seg.sfx) continue;
      const fx = await elevenAudio('sfx', { text: seg.sfx, duration_seconds: 2.5, prompt_influence: 0.5 }, '.sfx-cache');
      audioIn.push('-i', fx);
      const ms = Math.max(0, Math.round((start - 0.08) * 1000));
      // Per line, because effects differ a lot in loudness: the letterpress
      // thunk at 0.85 drowned the voice where the Gladiator boom did not.
      mix.push(`[${ai}:a]aresample=44100,adelay=${ms}|${ms},volume=${seg.sfxVolume ?? 0.85}[s${ai}]`);
      labels.push(`[s${ai}]`);
      ai++;
    }
  }
  // -14 LUFS is where Shorts, Reels and TikTok sit; the raw voice was -28 dB.
  mix.push(`${labels.join('')}amix=inputs=${labels.length}:normalize=0:duration=longest[aout]`);

  // Loudness in two passes: mix, measure the whole thing, then apply ONE gain.
  // Single-pass loudnorm adjusts gain continuously, like an automatic volume
  // control: when the voice stopped before the Hubbard reveal it turned the
  // music up, then clamped everything down when the press hit, so the audio
  // seemed to cut out and come back. A fixed gain cannot pump. A brickwall
  // limiter with a 50ms release catches the few peaks (the press, the boom)
  // that the gain would push over -1.5 dBTP, and lets go immediately.
  const premix = path.join(work, 'premix.wav');
  ff([...audioIn, '-filter_complex', mix.map(m => m.replace(/\[(\d+):a\]/g, (_, n) => `[${n - 3}:a]`)).join(';'),
    '-map', '[aout]', '-t', total.toFixed(3), '-ar', '44100', '-c:a', 'pcm_s16le', premix]);
  const meas = require('child_process').spawnSync('ffmpeg', ['-v', 'info', '-i', premix,
    '-af', 'loudnorm=I=-14:TP=-1.5:LRA=20:print_format=json', '-f', 'null', '-'], { maxBuffer: 1 << 26 });
  // The JSON block is followed by more log lines, so take the last {...}.
  const blocks = String(meas.stderr).match(/\{[^{}]*\}/g) || [];
  const lj = JSON.parse(blocks[blocks.length - 1]);
  const gain = -14 - Number(lj.input_i);

  fs.mkdirSync(OUT, { recursive: true });
  const mp4 = path.join(OUT, `${short.id}.mp4`);
  ff(['-i', vis, '-loop', '1', '-framerate', String(FPS), '-t', total.toFixed(3), '-i', staticPng, '-i', text, '-i', premix,
    '-filter_complex', [
      `[0:v]tpad=stop_mode=clone:stop_duration=${END_CARD + 1}[bg]`,
      '[bg][1:v]overlay=0:0[b1]', '[b1][2:v]overlay=0:0:eof_action=repeat[b2]', '[b2]format=yuv420p[vout]',
      `[3:a]volume=${gain.toFixed(2)}dB,alimiter=limit=0.84:attack=5:release=50:level=false,aresample=44100[aout]`].join(';'),
    '-map', '[vout]', '-map', '[aout]', '-t', total.toFixed(3), '-r', String(FPS),
    '-c:v', 'libx264', '-profile:v', 'high', '-crf', '18', '-preset', 'medium',
    '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', mp4]);

  // Kept beside the video so `listen` can compare what is heard with what the
  // captions claim, without re-rendering.
  fs.writeFileSync(path.join(OUT, `${short.id}.timeline.json`), JSON.stringify(timeline.map(x => ({
    text: spoken(x.seg), start: x.start, end: x.end, wav: x.wav,
    words: x.words.map(w => ({ text: w.text, at: x.start + w.start })),
  })), null, 1));

  // 6. What to paste when posting, and the disclosure decision in writing.
  const credits = [...new Set(specs.filter(v => v.art).map(v => ART[v.art]))]
    .map(a => [a.artist, a.work, a.date].filter(Boolean).join(', '));
  const generated = specs.some(v => v.gen || v.still);
  fs.writeFileSync(path.join(OUT, `${short.id}.txt`), [
    'TITLE', short.hook, '',
    'DESCRIPTION',
    `"${entry.text}" is commonly credited to ${entry.credited}. It's ${entry.actual}.`,
    '', `The full trail: https://getmarcus.app/misattributed-stoic-quotes#${entry.id}`,
    '', ...credits.map(c => `Image: ${c}.`),
    '', 'DISCLOSURE',
    voice === 'elevenlabs' ? 'Voice: ElevenLabs clone.' : 'Voice: macOS say. DRAFT ONLY, not for posting.',
    generated ? `Footage: some clips generated with ${VIDEO_MODEL} and ${IMAGE_MODEL}.` : 'Footage: public-domain paintings only.',
    (voice === 'elevenlabs' || generated) ? 'Tick the AI / altered-or-synthetic content disclosure on YouTube and TikTok.' : '',
    '', `LENGTH ${total.toFixed(1)}s`,
    specs.some(v => v.fellBack) ? 'NOTE: generated beats fell back to the painting (--no-gen or no FAL_KEY).' : '',
  ].join('\n') + '\n');

  return { mp4, total, voice, states: states.length, gen: clips.filter(Boolean).length };
}

// ── listen ──────────────────────────────────────────────────────────────────
// A transcript check, since I cannot hear the videos. It answers two things:
// does each sentence say what the script says, and does each caption light up
// when its word is actually spoken. It cannot say whether the video sounds
// good, which stays a human judgment.
//
// The first question is asked of each sentence's clean recording, not of the
// finished mix. Transcribing the mix with music under it, the transcriber
// heard "it actually comes from Elbert Hubbard, an American publisher from
// 1913" where the voice says, and the clean recording confirms, "It's Elbert
// Hubbard, an American publisher, 1913." A check that trusts the mix would
// report the transcriber's inventions as the voice's.
// A recording that starts straight into a word makes the transcriber invent
// a leading "And": the clean "That's how the quote got attached to him" came
// back as "And that's how..." twice running, and correctly with 0.6s of
// silence in front. Every clip is padded before it is sent.
async function transcribe(file) {
  const tmp = path.join(OUT, '.work', 'stt-' + hash([file, Math.random()]) + '.wav');
  ff(['-i', file, '-vn', '-af', 'adelay=600:all=1', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', tmp]);
  const form = new FormData();
  form.append('model_id', 'scribe_v1');
  form.append('timestamps_granularity', 'word');
  form.append('file', new Blob([fs.readFileSync(tmp)]), 'a.wav');
  fs.rmSync(tmp);
  const res = await fetch('https://api.elevenlabs.io/v1/speech-to-text',
    { method: 'POST', headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY }, body: form });
  if (!res.ok) throw new Error('speech-to-text HTTP ' + res.status + ': ' + (await res.text()).slice(0, 200));
  const j = await res.json();
  // Take the padding back out of the timestamps. Leaving it in made every
  // word in the finished video look 0.6s late on the first run.
  for (const w of j.words || []) { w.start -= 0.6; w.end -= 0.6; }
  return j;
}

// Numbers are compared loosely ("1913" may come back as "nineteen thirteen"),
// and punctuation not at all.
const NUM = { '2000': 'two thousand', '1913': 'nineteen thirteen', '1998': 'nineteen ninety eight',
  '1980': 'nineteen eighty', '1926': 'nineteen twenty six', '101': 'one hundred and one' };
const listenWords = t => words(String(t).replace(/\u00a0/g, ' ').replace(/\b\d+\b/g, n => NUM[n] || n));

function diffWords(want, got) {
  // Longest common subsequence, then report what is missing and what is extra.
  const a = listenWords(want), b = listenWords(got);
  const L = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) {
    L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  }
  const missing = [], extra = [];
  let i = 0, j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) missing.push(a[i++]); else extra.push(b[j++]);
  }
  missing.push(...a.slice(i)); extra.push(...b.slice(j));
  return { missing, extra, ratio: a.length ? 1 - missing.length / a.length : 1 };
}

async function listen(id) {
  const tl = JSON.parse(fs.readFileSync(path.join(OUT, `${id}.timeline.json`), 'utf8'));
  console.log(`# ${id}\n\n## Does each sentence say what the script says? (clean voice, no music)\n`);
  let problems = 0;
  for (const [i, seg] of tl.entries()) {
    const heard = (await transcribe(seg.wav)).text;
    const d = diffWords(seg.text, heard);
    const ok = !d.missing.length && !d.extra.length;
    if (!ok) problems++;
    console.log(`${ok ? '✓' : '✗'} ${i + 1}. ${seg.text}`);
    if (!ok) {
      console.log(`     heard:   ${heard}`);
      if (d.missing.length) console.log(`     missing: ${d.missing.join(' ')}`);
      if (d.extra.length) console.log(`     extra:   ${d.extra.join(' ')}`);
    }
  }
  console.log('\n## Do the captions light up when the words are spoken? (finished video)\n');
  const mix = await transcribe(path.join(OUT, `${id}.mp4`));
  const heardW = (mix.words || []).filter(w => w.type === 'word')
    .map(w => ({ w: listenWords(w.text)[0], at: w.start })).filter(x => x.w);
  const expect = tl.flatMap(s => s.words.map(w => ({ w: listenWords(w.text)[0], at: w.at }))).filter(x => x.w);
  // Walk both in order, pairing identical words within a two-second window.
  const offs = [];
  let j = 0;
  for (const e of expect) {
    for (let k = j; k < Math.min(heardW.length, j + 6); k++) {
      if (heardW[k].w === e.w && Math.abs(heardW[k].at - e.at) < 2) { offs.push(heardW[k].at - e.at); j = k + 1; break; }
    }
  }
  if (!offs.length) { console.log('✗ could not match any words to measure timing'); return; }
  const sorted = [...offs].sort((x, y) => x - y);
  const med = sorted[sorted.length >> 1];
  const worst = sorted.reduce((m, x) => (Math.abs(x) > Math.abs(m) ? x : m), 0);
  const late = offs.filter(x => Math.abs(x) > 0.25).length;
  // A caption up to a quarter-second off is imperceptible; beyond that the
  // highlight visibly leads or lags the voice.
  const ok = Math.abs(med) <= 0.15 && late <= Math.ceil(offs.length * 0.1);
  if (!ok) problems++;
  console.log(`${ok ? '✓' : '✗'} matched ${offs.length} of ${expect.length} words; ` +
    `median offset ${(med * 1000).toFixed(0)}ms, worst ${(worst * 1000).toFixed(0)}ms, ` +
    `${late} more than 250ms off`);
  console.log(`\n${problems ? '✗ ' + problems + ' problem(s)' : '✓ nothing found'}. ` +
    'This checks words and timing only; music balance and how it sounds need a listen.\n');
  return problems;
}

async function main() {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  const opts = {
    allowUnverified: argv.includes('--allow-unverified'),
    noGen: argv.includes('--no-gen'),
    voice: (argv.find(a => a.startsWith('--voice=')) || '').split('=')[1],
  };
  if (cmd === 'check' || !cmd) {
    let bad = 0;
    for (const s of SHORTS) {
      const p = validate(s);
      console.log((p.length ? '✗ ' : '✓ ') + s.id);
      p.forEach(x => console.log('    ' + x));
      if (p.some(x => !x.startsWith('UNVERIFIED'))) bad++;
    }
    process.exit(bad ? 1 : 0);
  }
  if (cmd === 'listen') {
    const ids = argv.includes('--all') ? SHORTS.map(s => s.id).filter(i => fs.existsSync(path.join(OUT, `${i}.timeline.json`)))
      : argv.slice(1).filter(a => !a.startsWith('--'));
    for (const id of ids) { try { await listen(id); } catch (e) { console.error('✗ ' + id + ': ' + e.message); } }
    return;
  }
  if (cmd === 'render') {
    const ids = argv.includes('--all') ? SHORTS.map(s => s.id) : argv.slice(1).filter(a => !a.startsWith('--'));
    if (!ids.length) { console.error('usage: shorts.js render <id> | --all'); process.exit(1); }
    for (const id of ids) {
      const s = SHORTS.find(x => x.id === id);
      if (!s) { console.error('no short ' + id); continue; }
      try {
        const r = await render(s, opts);
        console.log(`✓ ${id}  ${r.total.toFixed(1)}s  voice=${r.voice}  ${r.gen} generated clip(s)  ${r.states} text states  → ${path.relative(ROOT, r.mp4)}`);
      } catch (e) { console.error('✗ ' + e.message); process.exitCode = 1; }
    }
  }
}

module.exports = { validate, words, chunk, wordTimes, startFromLevels, diffWords };
if (require.main === module) main();
