#!/usr/bin/env node
/**
 * Render the "never said this" shorts: 1080x1920, voiceover, painting,
 * captions, end card. One command, one MP4 per misattribution.
 *
 *   node scripts/shorts.js check                    validate every script
 *   node scripts/shorts.js render echoes-in-eternity
 *   node scripts/shorts.js render --all
 *     --allow-unverified   render scripts whose payoff is not in the checked
 *                          library (only after checking it against print)
 *     --voice=say          force the Mac's built-in voice even when an
 *                          ElevenLabs key is configured
 *
 * THE CHECK IS THE POINT. The channel's whole claim is that these quotations
 * were checked, so the renderer refuses to make a video whose on-screen quote
 * has drifted from constants/misattributions.js, or whose payoff is not word
 * for word in constants/stoicQuotes.js. AI can write the narration; it does
 * not get to paraphrase the evidence.
 *
 * VOICE. With ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID in .env.local it uses
 * the ElevenLabs clone of Gio's voice. Without them it falls back to macOS
 * `say`, which is fine for judging the layout and timing and not for posting.
 * The output's notes file says which was used, because a cloned voice needs the
 * platforms' AI-content disclosure ticked.
 *
 * TEXT. This ffmpeg build has neither drawtext nor libass, so every text layer
 * is an HTML page rendered to a transparent PNG by headless Chrome, using the
 * app's own Cinzel and Inter from node_modules. That also means the type is the
 * site's type, not an approximation of it.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'shorts-out');
const W = 1080, H = 1920, FPS = 30;
const BG = '#0c0b0f', CREAM = '#e8e4dc', GOLD = '#c9a961';
// The painting sits in a fixed band so nothing moves between shorts except the
// picture itself.
const BAND = { top: 470, height: 800 };
const LEAD_IN = 0.6;        // hook alone on screen before the first word
const END_CARD = 3.0;
const CHROME = process.env.CHROME_PATH ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const FONTS = path.join(ROOT, 'node_modules', '@expo-google-fonts');

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

// ── voice ───────────────────────────────────────────────────────────────────
const spoken = seg => seg.quote || seg.say || seg.excerpt;

// Voiced sentences are cached by voice + text + context, so tweaking a caption
// or the layout and re-rendering costs no ElevenLabs characters. Changing a
// sentence, or its neighbours (they shape the intonation), re-voices only that.
const CACHE = path.join(OUT, '.voice-cache');

async function synth(seg, i, all, file, voice) {
  const text = spoken(seg);
  const ctx = voice === 'elevenlabs'
    ? [process.env.ELEVENLABS_VOICE_ID, all.slice(0, i).map(spoken).join(' ').slice(-400), all.slice(i + 1).map(spoken).join(' ').slice(0, 400)]
    : ['say-Daniel-172'];
  const key = require('crypto').createHash('sha256').update(JSON.stringify([voice, text, ...ctx])).digest('hex').slice(0, 24);
  const cached = path.join(CACHE, key + '.wav');
  if (fs.existsSync(cached)) { fs.copyFileSync(cached, file); return; }
  fs.mkdirSync(CACHE, { recursive: true });
  await synthUncached(seg, i, all, file, voice, text);
  fs.copyFileSync(file, cached);
}

async function synthUncached(seg, i, all, file, voice, text) {
  if (voice === 'elevenlabs') {
    // previous_text / next_text let ElevenLabs keep the intonation of a whole
    // paragraph while generating it a sentence at a time, which is what makes
    // per-segment timing possible without sounding stitched together.
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${process.env.ELEVENLABS_VOICE_ID}?output_format=mp3_44100_128`,
      {
        method: 'POST',
        headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          previous_text: all.slice(0, i).map(spoken).join(' ').slice(-400),
          next_text: all.slice(i + 1).map(spoken).join(' ').slice(0, 400),
        }),
      });
    if (!res.ok) throw new Error('ElevenLabs HTTP ' + res.status + ': ' + (await res.text()).slice(0, 200));
    fs.writeFileSync(file + '.mp3', Buffer.from(await res.arrayBuffer()));
    ff(['-i', file + '.mp3', '-ar', '44100', '-ac', '2', file]);
  } else {
    execFileSync('say', ['-v', 'Daniel', '-r', '172', '-o', file + '.aiff', text]);
    ff(['-i', file + '.aiff', '-ar', '44100', '-ac', '2', file]);
  }
}

// ── helpers ─────────────────────────────────────────────────────────────────
const ff = args => execFileSync('ffmpeg', ['-v', 'error', '-y', ...args]);
const duration = f => Number(execFileSync('ffprobe',
  ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim());
const dims = f => execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0',
  '-show_entries', 'stream=width,height', '-of', 'csv=p=0', f]).toString().trim().split(',').map(Number);
const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const even = n => Math.round(n / 2) * 2;

const FONT_CSS = `
@font-face{font-family:Cinzel;font-weight:600;src:url(file://${FONTS}/cinzel/600SemiBold/Cinzel_600SemiBold.ttf)}
@font-face{font-family:Inter;font-weight:400;src:url(file://${FONTS}/inter/400Regular/Inter_400Regular.ttf)}
@font-face{font-family:Inter;font-weight:500;src:url(file://${FONTS}/inter/500Medium/Inter_500Medium.ttf)}
@font-face{font-family:Inter;font-weight:300;font-style:italic;src:url(file://${FONTS}/inter/300Light_Italic/Inter_300Light_Italic.ttf)}
@font-face{font-family:Inter;font-weight:400;font-style:italic;src:url(file://${FONTS}/inter/400Regular_Italic/Inter_400Regular_Italic.ttf)}
html,body{margin:0;width:${W}px;height:${H}px;overflow:hidden;background:transparent}
*{box-sizing:border-box}
.abs{position:absolute;left:0;right:0}`;

function png(body, file, css = '') {
  const html = file.replace(/\.png$/, '.html');
  fs.writeFileSync(html, `<!doctype html><html><head><meta charset="utf-8"><style>${FONT_CSS}${css}</style></head><body>${body}</body></html>`);
  execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars',
    '--default-background-color=00000000', `--window-size=${W},${H}`,
    `--screenshot=${file}`, 'file://' + html], { stdio: 'ignore' });
  if (!fs.existsSync(file)) throw new Error('Chrome did not render ' + file);
}

// Captions sit below the painting. One chunk at a time, a few words each: long
// enough to read in rhythm with the voice, short enough to read with the sound
// off, which is how most of these will be watched.
const CAPTION_BOX = 'top:1360px;height:420px;display:flex;align-items:center;justify-content:center;padding:0 90px;text-align:center';

function chunk(text) {
  const out = [];
  let cur = [];
  for (const w of text.split(/\s+/)) {
    if (cur.length && (cur.length >= 4 || (cur.join(' ') + ' ' + w).length > 26)) { out.push(cur.join(' ')); cur = []; }
    cur.push(w);
  }
  if (cur.length) out.push(cur.join(' '));
  return out;
}

// ── build ───────────────────────────────────────────────────────────────────
async function render(short, opts) {
  const problems = validate(short).filter(p => !(opts.allowUnverified && p.startsWith('UNVERIFIED')));
  if (problems.length) {
    throw new Error(`refusing to render ${short.id}:\n  - ` + problems.join('\n  - '));
  }
  const entry = loadMisattributions().find(e => e.id === short.id);
  const art = ART[short.painting];
  const voice = opts.voice === 'say' || !(process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_VOICE_ID)
    ? 'say' : 'elevenlabs';

  const work = path.join(OUT, '.work', short.id);
  fs.rmSync(work, { recursive: true, force: true });
  fs.mkdirSync(work, { recursive: true });

  // 1. Voice, a segment at a time, so every caption knows exactly when its
  //    sentence starts and ends.
  const timeline = [];
  const parts = [];
  let t = LEAD_IN;
  const silence = (secs, name) => {
    const f = path.join(work, name);
    ff(['-f', 'lavfi', '-i', `anullsrc=r=44100:cl=stereo`, '-t', secs.toFixed(3), f]);
    parts.push(f);
  };
  silence(LEAD_IN, 'lead.wav');
  for (const [i, seg] of short.segments.entries()) {
    const f = path.join(work, `seg${i}.wav`);
    await synth(seg, i, short.segments, f, voice);
    const d = duration(f);
    parts.push(f);
    timeline.push({ seg, start: t, end: t + d });
    t += d;
    // Let the quotation and the reveal land before the next sentence.
    const gap = seg.quote || 'payoff' in seg ? 0.55 : 0.22;
    silence(gap, `gap${i}.wav`);
    t += gap;
  }
  const voEnd = t;
  const total = voEnd + END_CARD;
  const list = path.join(work, 'parts.txt');
  fs.writeFileSync(list, parts.map(p => `file '${p}'`).join('\n'));
  const vo = path.join(work, 'vo.wav');
  ff(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', vo]);

  // 2. Text layers.
  const layers = [];
  const staticPng = path.join(work, 'static.png');
  const credit = [art.artist, art.work, art.date].filter(Boolean).join(', ');
  png(`
    <div class="abs" style="top:120px;text-align:center;font:500 26px Inter;letter-spacing:.32em;color:${GOLD}">MISATTRIBUTED</div>
    <div class="abs" style="top:175px;height:270px;display:flex;align-items:center;justify-content:center;padding:0 80px;text-align:center;font:600 66px/1.18 Cinzel;color:${CREAM}">${esc(short.hook)}</div>
    <div class="abs" style="top:${BAND.top + BAND.height + 18}px;text-align:center;padding:0 90px;font:400 22px/1.35 Inter;color:rgba(232,228,220,.45)">${esc(credit)}</div>`,
    staticPng);

  let n = 0;
  for (const [i, { seg, start, end }] of timeline.entries()) {
    const until = i + 1 < timeline.length ? timeline[i + 1].start : voEnd;
    if (seg.quote) {
      const f = path.join(work, `L${n++}.png`);
      png(`<div class="abs" style="${CAPTION_BOX};flex-direction:column">
        <div style="font:300 italic 54px/1.3 Inter;color:${CREAM}">&ldquo;${esc(seg.quote)}&rdquo;</div>
        <div style="margin-top:22px;font:400 26px Inter;color:rgba(232,228,220,.55);letter-spacing:.04em">commonly credited to ${esc(entry.credited)}</div></div>`, f);
      layers.push({ f, from: start, to: until });
    } else if ('payoff' in seg) {
      const src = seg.payoff && STOIC_QUOTES.find(q => q.id === seg.payoff);
      const who = seg.author || (src && src.author) || '';
      const f = path.join(work, `L${n++}.png`);
      png(`<div class="abs" style="${CAPTION_BOX};flex-direction:column">
        <div style="font:400 italic 52px/1.3 Inter;color:${GOLD}">&ldquo;${esc(seg.excerpt)}&rdquo;</div>
        <div style="margin-top:22px;font:500 26px Inter;color:rgba(201,169,97,.75);letter-spacing:.06em">${esc([who, seg.cite].filter(Boolean).join(', '))}</div></div>`, f);
      layers.push({ f, from: start, to: until });
    } else {
      // Narration: time each chunk by its share of the sentence's characters.
      const chunks = chunk(seg.say);
      const totalChars = chunks.reduce((s, c) => s + c.length, 0);
      let at = start;
      for (const [k, c] of chunks.entries()) {
        const d = (end - start) * (c.length / totalChars);
        const f = path.join(work, `L${n++}.png`);
        png(`<div class="abs" style="${CAPTION_BOX};font:500 60px/1.25 Inter;color:${CREAM}">${esc(c)}</div>`, f);
        layers.push({ f, from: at, to: k === chunks.length - 1 ? until : at + d });
        at += d;
      }
    }
  }
  const endPng = path.join(work, 'end.png');
  png(`<div style="width:${W}px;height:${H}px;background:${BG};display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 110px;text-align:center">
      <img src="file://${path.join(ROOT, 'public', 'skull-gold.png')}" style="width:150px;height:auto;object-fit:contain">
      <div style="margin-top:56px;font:400 46px/1.35 Inter;color:${CREAM}">Every quote in Marcus is checked against its source.</div>
      <div style="margin-top:44px;font:600 62px Cinzel;color:${GOLD};letter-spacing:.04em">getmarcus.app</div></div>`,
    endPng);
  layers.push({ f: endPng, from: voEnd, to: total });

  // 3. The painting: fitted into the band, with a slow push in over the length
  //    of the video. Upscaled first, because zoompan on a small source jitters.
  const paintingFile = path.join(ROOT, 'public', 'img', 'art', art.file);
  const [pw, ph] = dims(paintingFile);
  const k = Math.min(W / pw, BAND.height / ph);
  const fw = even(pw * k), fh = even(ph * k);
  const frames = Math.ceil(total * FPS);

  const inputs = ['-f', 'lavfi', '-i', `color=c=${BG.replace('#', '0x')}:s=${W}x${H}:r=${FPS}:d=${total.toFixed(3)}`,
    '-loop', '1', '-framerate', String(FPS), '-t', total.toFixed(3), '-i', paintingFile,
    '-loop', '1', '-framerate', String(FPS), '-t', total.toFixed(3), '-i', staticPng];
  for (const l of layers) inputs.push('-loop', '1', '-framerate', String(FPS), '-t', total.toFixed(3), '-i', l.f);
  inputs.push('-i', vo);
  const audioIdx = 3 + layers.length;

  const g = [
    `[1:v]scale=${fw * 3}:${fh * 3},zoompan=z='1+0.07*on/${frames}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${fw}x${fh}:fps=${FPS}[p]`,
    `[0:v][p]overlay=x=${(W - fw) / 2}:y=${BAND.top + (BAND.height - fh) / 2}[b0]`,
    `[b0][2:v]overlay=0:0[b1]`,
  ];
  let last = 'b1';
  layers.forEach((l, i) => {
    const next = 'v' + i;
    g.push(`[${last}][${3 + i}:v]overlay=0:0:enable='between(t,${l.from.toFixed(3)},${l.to.toFixed(3)})'[${next}]`);
    last = next;
  });
  g.push(`[${last}]format=yuv420p[vout]`);
  // Normalised to -14 LUFS, where Shorts, Reels and TikTok sit. The raw
  // voiceover averaged -28 dB, which on a phone plays noticeably quieter than
  // whatever was scrolled past just before it.
  g.push(`[${audioIdx}:a]loudnorm=I=-14:TP=-1.5:LRA=11,aresample=44100,apad[aout]`);

  fs.mkdirSync(OUT, { recursive: true });
  const mp4 = path.join(OUT, `${short.id}.mp4`);
  ff([...inputs, '-filter_complex', g.join(';'), '-map', '[vout]', '-map', '[aout]',
    '-t', total.toFixed(3), '-r', String(FPS), '-c:v', 'libx264', '-profile:v', 'high', '-crf', '18',
    '-preset', 'medium', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', mp4]);

  // 4. What to paste when posting, and the disclosure decision in writing.
  fs.writeFileSync(path.join(OUT, `${short.id}.txt`), [
    `TITLE`, short.hook, ``,
    `DESCRIPTION`,
    `"${entry.text}" is commonly credited to ${entry.credited}. It's ${entry.actual}.`,
    ``, `The full trail: https://getmarcus.app/misattributed-stoic-quotes#${entry.id}`,
    ``, `VOICE`, voice === 'elevenlabs'
      ? 'ElevenLabs clone. Tick the AI / altered-or-synthetic content disclosure on YouTube and TikTok.'
      : 'macOS say, DRAFT ONLY. Not for posting.',
    `LENGTH ${total.toFixed(1)}s`,
  ].join('\n') + '\n');

  return { mp4, total, voice, layers: layers.length };
}

async function main() {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  const opts = {
    allowUnverified: argv.includes('--allow-unverified'),
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
  if (cmd === 'render') {
    const ids = argv.includes('--all') ? SHORTS.map(s => s.id) : argv.slice(1).filter(a => !a.startsWith('--'));
    if (!ids.length) { console.error('usage: shorts.js render <id> | --all'); process.exit(1); }
    for (const id of ids) {
      const s = SHORTS.find(x => x.id === id);
      if (!s) { console.error('no short ' + id); continue; }
      try {
        const r = await render(s, opts);
        console.log(`✓ ${id}  ${r.total.toFixed(1)}s  voice=${r.voice}  ${r.layers} text layers  → ${path.relative(ROOT, r.mp4)}`);
      } catch (e) { console.error('✗ ' + e.message); }
    }
  }
}

module.exports = { validate, words, chunk };
if (require.main === module) main();
