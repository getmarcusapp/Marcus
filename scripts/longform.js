#!/usr/bin/env node
/**
 * Render long-form videos: 1920x1080, a cold open, numbered chapters and a
 * close, voiced in the same clone as the shorts, with a music bed and a
 * captions file for YouTube.
 *
 *   node scripts/longform.js check
 *   node scripts/longform.js plan <id>           what generation would cost, before spending it
 *   node scripts/longform.js render <id> [--no-gen] [--voice=say]
 *
 * Built on scripts/shorts.js: the same voice, music, generation and cache
 * helpers, so a clip or a sentence is never paid for twice, and the same rule
 * that a quotation on screen is checked word for word before anything is
 * rendered. What differs is the shape:
 *
 *   - Narration is not burned in. Long-form viewers expect clean footage and
 *     turn captions on themselves, so the words go to an .srt file timed from
 *     the voice. Only quotations appear on screen, because the quotations are
 *     the evidence.
 *   - Chapter cards and a chapter badge keep a nine-minute countdown legible,
 *     and the notes file carries YouTube chapter timestamps taken from the
 *     render, so they cannot drift from the video.
 *   - One music track, restarted from a different point in each chapter
 *     behind the card's impact, rather than one bed looped for nine minutes.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const S = require('./shorts');
const { LONGFORM } = require('./longform-scripts');
const { ART } = require('./site-artwork');
const { loadMisattributions } = require('./find-misquotes');
const { STOIC_QUOTES } = require('../constants/stoicQuotes.js');

const ROOT = path.join(__dirname, '..');
const W = 1920, H = 1080, FPS = S.FPS;
const { BG, CREAM, GOLD, esc, ff, duration } = S;
const LEAD_IN = 0.6;
const CARD = 2.4;
const END_CARD = 5.0;
// Veo clips are at most 8s, and slowing past 1.5x looks like slow motion. A
// beat longer than this shows its clip, then its chapter's painting.
const MAX_CLIP = 11;

// ── structure ───────────────────────────────────────────────────────────────
// A flat list of cards and segments, each segment knowing its chapter.
function flatten(lf) {
  const items = [];
  for (const seg of lf.cold) {
    if (seg.titleBefore) items.push({ card: 'title' });
    items.push({ seg, chapter: null });
  }
  for (const ch of lf.chapters) {
    items.push({ card: 'chapter', chapter: ch });
    for (const seg of ch.segments) items.push({ seg, chapter: ch });
  }
  for (const seg of lf.close) items.push({ seg, chapter: null, close: true });
  return items;
}

const spoken = seg => seg.quote || seg.say || seg.excerpt;

function validate(lf) {
  const problems = [];
  const entries = loadMisattributions();
  if (!ART[lf.painting]) problems.push(`no painting "${lf.painting}"`);
  const ns = lf.chapters.map(c => c.n);
  if (ns.some((n, i) => i && n !== ns[i - 1] - 1)) problems.push(`chapters are not a countdown: ${ns.join(', ')}`);
  for (const it of flatten(lf)) {
    if (it.card === 'chapter') {
      if (!entries.find(e => e.id === it.chapter.entry)) problems.push(`chapter ${it.chapter.n}: no entry "${it.chapter.entry}"`);
      if (!ART[it.chapter.painting]) problems.push(`chapter ${it.chapter.n}: no painting "${it.chapter.painting}"`);
    }
    if (!it.seg) continue;
    const seg = it.seg;
    const where = it.chapter ? `chapter ${it.chapter.n}` : it.close ? 'close' : 'cold open';
    if ([seg.quote, seg.say, 'payoff' in seg].filter(Boolean).length !== 1) {
      problems.push(`${where}: a segment must be exactly one of quote, say, payoff`);
    }
    if (seg.quote) {
      const id = seg.entry || (it.chapter && it.chapter.entry);
      const entry = entries.find(e => e.id === id);
      if (!entry) { problems.push(`${where}: quote has no entry to check against`); continue; }
      const q = S.words(seg.quote), e = S.words(entry.text);
      if (q.length < 4 || q.some((w, i) => w !== e[i])) {
        problems.push(`${where}: quote is not ${id}'s text, word for word: "${seg.quote}"`);
      }
    }
    if ('payoff' in seg) {
      const src = STOIC_QUOTES.find(q => q.id === seg.payoff);
      if (!src) { problems.push(`${where}: payoff "${seg.payoff}" is not in stoicQuotes.js`); continue; }
      if (!S.words(src.quote).join(' ').includes(S.words(seg.excerpt).join(' '))) {
        problems.push(`${where}: payoff excerpt does not appear verbatim in ${seg.payoff}`);
      }
    }
    for (const v of [].concat(seg.visual || [])) {
      if (v.art && !ART[v.art]) problems.push(`${where}: no painting "${v.art}"`);
      if (v.gen && /\b(sign|caption|reads|lettering|written words)\b/i.test(v.gen)) {
        problems.push(`${where}: a generated clip asks for text, which video models garble: "${v.gen.slice(0, 50)}"`);
      }
    }
  }
  return problems;
}

// ── text ────────────────────────────────────────────────────────────────────
const FONT_CSS = `
@font-face{font-family:Cinzel;font-weight:600;src:url(file://${S.FONTS}/cinzel/600SemiBold/Cinzel_600SemiBold.ttf)}
@font-face{font-family:Inter;font-weight:400;src:url(file://${S.FONTS}/inter/400Regular/Inter_400Regular.ttf)}
@font-face{font-family:Inter;font-weight:500;src:url(file://${S.FONTS}/inter/500Medium/Inter_500Medium.ttf)}
@font-face{font-family:Inter;font-weight:300;font-style:italic;src:url(file://${S.FONTS}/inter/300Light_Italic/Inter_300Light_Italic.ttf)}
@font-face{font-family:Inter;font-weight:400;font-style:italic;src:url(file://${S.FONTS}/inter/400Regular_Italic/Inter_400Regular_Italic.ttf)}
html,body{margin:0;width:${W}px;height:${H}px;overflow:hidden;background:transparent}
*{box-sizing:border-box}
.abs{position:absolute;left:0;right:0}
.shadow{text-shadow:0 2px 14px rgba(0,0,0,.85),0 0 2px rgba(0,0,0,.6)}`;

function png(body, file) {
  const html = file.replace(/\.png$/, '.html');
  fs.writeFileSync(html, `<!doctype html><html><head><meta charset="utf-8"><style>${FONT_CSS}</style></head><body>${body}</body></html>`);
  execFileSync(S.CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars',
    '--default-background-color=00000000', `--window-size=${W},${H}`,
    `--screenshot=${file}`, 'file://' + html], { stdio: 'ignore' });
  if (!fs.existsSync(file)) throw new Error('Chrome did not render ' + file);
}

const KICKER = `font:500 24px Inter;letter-spacing:.34em;color:${GOLD}`;
const card = inner => `<div style="width:${W}px;height:${H}px;background:${BG};display:flex;flex-direction:column;` +
  `align-items:center;justify-content:center;text-align:center;padding:0 240px">${inner}</div>`;
const badge = ch => (ch ? `<div class="shadow" style="position:absolute;top:56px;left:72px;font:600 34px Cinzel;` +
  `color:${GOLD};letter-spacing:.06em">No. ${ch.n}</div>` : '');
// Quotations sit low, over a gradient, so the footage above them stays clean.
const lowerQuote = (text, sub, color, subColor) => `
  <div class="abs" style="bottom:0;height:560px;background:linear-gradient(to top,rgba(12,11,15,.95) 0,rgba(12,11,15,.75) 260px,rgba(12,11,15,0) 560px)"></div>
  <div class="abs" style="bottom:96px;display:flex;flex-direction:column;align-items:center;padding:0 220px;text-align:center">
    <div class="shadow" style="font:300 italic 54px/1.32 Inter;color:${color}">&ldquo;${esc(text)}&rdquo;</div>
    <div class="shadow" style="margin-top:22px;font:500 26px Inter;letter-spacing:.06em;color:${subColor}">${esc(sub)}</div>
  </div>`;

// ── captions file ───────────────────────────────────────────────────────────
const stamp = s => {
  const ms = Math.max(0, Math.round(s * 1000));
  const p = (n, w) => String(n).padStart(w, '0');
  return `${p(Math.floor(ms / 3600000), 2)}:${p(Math.floor(ms / 60000) % 60, 2)}:${p(Math.floor(ms / 1000) % 60, 2)},${p(ms % 1000, 3)}`;
};
function srt(timeline) {
  const cues = [];
  for (const x of timeline) {
    const cards = S.chunk(spoken(x.seg)).map(c => c.split(/ +/));
    let w = 0;
    for (const c of cards) {
      const first = x.words[w], last = x.words[Math.min(w + c.length, x.words.length) - 1];
      if (!first) break;
      cues.push({ text: c.join(' ').replace(/ /g, ' '), from: x.start + first.start, to: x.start + last.end });
      w += c.length;
    }
  }
  // Each cue holds until the next begins, unless a real pause follows.
  cues.forEach((c, i) => { const n = cues[i + 1]; c.to = n ? Math.min(Math.max(c.to + 0.3, c.to), n.from) : c.to + 0.5; });
  return cues.map((c, i) => `${i + 1}\n${stamp(c.from)} --> ${stamp(c.to)}\n${c.text}\n`).join('\n');
}
const clock = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// ── visuals plan ────────────────────────────────────────────────────────────
// Every picture the video needs, with its time, before anything is made. The
// plan is what `plan` prices and what `render` builds, so the two cannot
// disagree about what will be generated.
function visualPlan(lf, timeline, voEnd, canGen) {
  const frame = x => Math.round(x * FPS);
  const specs = [];
  timeline.forEach((x, i) => {
    const a = i === 0 ? 0 : frame(x.start);
    const b = i + 1 < timeline.length ? frame(timeline[i + 1].start) : frame(voEnd);
    if (x.card) { specs.push({ card: true, from: a, to: b }); return; }
    const painting = (x.chapter && x.chapter.painting) || lf.painting;
    const list = [].concat(x.seg.visual || { art: painting });
    list.forEach((v0, k) => {
      const from = Math.round(a + (b - a) * k / list.length), to = Math.round(a + (b - a) * (k + 1) / list.length);
      let v = { ...v0 };
      const cachedAlready = v.still ? fs.existsSync(S.stillPath(v.still, '16:9'))
        : v.gen ? fs.existsSync(S.clipPath(v.gen, v.negative, Math.min((to - from) / FPS, MAX_CLIP), '16:9')) : true;
      if ((v.gen || v.still) && !canGen && !cachedAlready) v = { art: painting, zoom: v.zoom || 'in', fellBack: true };
      if (v.gen && (to - from) / FPS > MAX_CLIP) {
        const mid = from + Math.round(MAX_CLIP * FPS);
        specs.push({ ...v, from, to: mid });
        specs.push({ art: painting, zoom: 'out', from: mid, to });
      } else specs.push({ ...v, from, to });
    });
  });
  return specs;
}

// ── render ──────────────────────────────────────────────────────────────────
async function voiceAll(lf, voice, work) {
  const items = flatten(lf);
  const segs = items.filter(x => x.seg).map(x => x.seg);
  const silence = secs => {
    const f = path.join(work, `sil${S.hash([secs, Math.random()])}.wav`);
    ff(['-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo', '-t', secs.toFixed(3), f]);
    return f;
  };
  const parts = [silence(LEAD_IN)];
  const timeline = [];
  let t = LEAD_IN, si = 0;
  for (const [i, it] of items.entries()) {
    if (it.card) {
      parts.push(silence(CARD));
      timeline.push({ ...it, start: t, end: t + CARD });
      t += CARD;
      continue;
    }
    const seg = it.seg;
    if (seg.pauseBefore) { parts.push(silence(seg.pauseBefore)); t += seg.pauseBefore; }
    const { wav, words } = await S.voiceSegment(segs, si++, voice);
    const d = duration(wav);
    const tail = Number((String(spawnSync('ffmpeg', ['-v', 'info', '-ss', Math.max(0, d - 0.06).toFixed(3), '-i', wav,
      '-af', 'astats', '-f', 'null', '-']).stderr).match(/RMS level dB: (-?[0-9.]+)/) || [0, -120])[1]);
    const fo = tail > -55 ? 0.12 : 0.015;
    const faded = path.join(work, `voice${i}.wav`);
    ff(['-i', wav, '-af', `afade=t=in:d=0.015,afade=t=out:st=${Math.max(0, d - fo).toFixed(3)}:d=${fo}`, faded]);
    parts.push(faded);
    timeline.push({ ...it, start: t, end: t + d, words, wav });
    t += d;
    // A quotation gets room to land; a line before a chapter card gets a breath.
    const next = items[i + 1];
    const gap = seg.quote || 'payoff' in seg ? 0.8 : next && next.card ? 0.7 : 0.35;
    parts.push(silence(gap));
    t += gap;
  }
  const list = path.join(work, 'parts.txt');
  fs.writeFileSync(list, parts.map(p => `file '${p}'`).join('\n'));
  const vo = path.join(work, 'vo.wav');
  ff(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', vo]);
  return { timeline, voEnd: t, vo };
}

async function render(lf, opts) {
  const problems = validate(lf);
  if (problems.length) throw new Error(`refusing to render ${lf.id}:\n  - ` + problems.join('\n  - '));
  const eleven = opts.voice !== 'say' && process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_VOICE_ID;
  const voice = eleven ? 'elevenlabs' : 'say';
  const canGen = !opts.noGen && !!process.env.FAL_KEY;
  const work = path.join(S.OUT, '.work', lf.id);
  fs.rmSync(work, { recursive: true, force: true });
  fs.mkdirSync(work, { recursive: true });
  const frame = x => Math.round(x * FPS);

  // 1. Voice.
  const { timeline, voEnd, vo } = await voiceAll(lf, voice, work);
  const total = voEnd + END_CARD;
  console.log(`  voice: ${clock(voEnd)} across ${timeline.filter(x => x.seg).length} lines`);

  // 2. Visuals, one at a time (see falSubmit in shorts.js).
  const specs = visualPlan(lf, timeline, voEnd, canGen);
  const visParts = [];
  for (const [i, v] of specs.entries()) {
    const n = Math.max(1, v.to - v.from);
    const f = path.join(work, `vis${i}.mp4`);
    const enc = ['-frames:v', String(n), '-r', String(FPS), '-an', '-c:v', 'libx264', '-crf', '17',
      '-preset', 'medium', '-pix_fmt', 'yuv420p', f];
    if (v.card) {
      ff(['-f', 'lavfi', '-i', `color=c=${BG}:s=${W}x${H}:r=${FPS}`, ...enc]);
    } else if (v.gen) {
      const clip = await S.generateClip(v.gen, n / FPS, v.negative, '16:9');
      const k = Math.min(Math.max((n / FPS) / duration(clip), 1), 1.5);
      const slow = k > 1.02 ? `setpts=${k.toFixed(4)}*PTS,minterpolate=fps=${FPS}:mi_mode=mci:mc_mode=aobmc:vsbmc=1` : `fps=${FPS}`;
      ff(['-i', clip, '-vf', `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},${slow},` +
        'tpad=stop_mode=clone:stop_duration=10', ...enc]);
    } else {
      const src = v.still ? await S.generateStill(v.still, '16:9') : S.artFile(v.art);
      const [z0, z1] = { in: [1.0, 1.08], out: [1.08, 1.0], tight: [1.28, 1.36] }[v.zoom || 'in'];
      const focus = v.focus ?? 0.3;
      // Paintings are mostly portrait, so a 16:9 frame is a slice of one;
      // `focus` picks which slice (0 top, 1 bottom).
      ff(['-loop', '1', '-framerate', String(FPS), '-i', src, '-vf',
        `scale=${W * 2}:${H * 2}:force_original_aspect_ratio=increase,crop=${W * 2}:${H * 2}:(iw-${W * 2})/2:(ih-${H * 2})*${focus},` +
        `zoompan=z='${z0}+(${z1 - z0})*on/${n}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${W}x${H}:fps=${FPS}`,
        ...enc]);
    }
    visParts.push(f);
    if (i % 10 === 9) console.log(`  visuals: ${i + 1} of ${specs.length}`);
  }
  const visList = path.join(work, 'vis.txt');
  fs.writeFileSync(visList, visParts.map(p => `file '${p}'`).join('\n'));
  const vis = path.join(work, 'vis.mp4');
  ff(['-f', 'concat', '-safe', '0', '-i', visList, '-c', 'copy', vis]);

  // 3. Text: cards, quotations, the chapter badge, and the end card, laid out
  //    frame by frame (see the caption track in shorts.js for why).
  const entries = loadMisattributions();
  let pn = 0;
  const shot = body => { const f = path.join(work, `T${pn++}.png`); png(body, f); return f; };
  const states = [];
  timeline.forEach((x, i) => {
    const from = i === 0 ? 0 : x.start;
    const to = i + 1 < timeline.length ? timeline[i + 1].start : voEnd;
    if (x.card === 'title') {
      states.push({ from, to, f: shot(card(`<div style="${KICKER}">MISATTRIBUTED</div>
        <div style="margin-top:34px;font:600 88px/1.15 Cinzel;color:${CREAM}">${esc(lf.title)}</div>`)) });
    } else if (x.card === 'chapter') {
      const entry = entries.find(e => e.id === x.chapter.entry);
      states.push({ from, to, f: shot(card(`<div style="${KICKER}">NUMBER</div>
        <div style="margin-top:10px;font:600 240px/1 Cinzel;color:${GOLD}">${x.chapter.n}</div>
        <div style="margin-top:34px;font:400 30px Inter;letter-spacing:.04em;color:rgba(232,228,220,.7)">credited to ${esc(entry.credited)}</div>`)) });
    } else if (x.seg.quote) {
      const entry = entries.find(e => e.id === (x.seg.entry || x.chapter.entry));
      states.push({ from, to, f: shot(badge(x.chapter) + lowerQuote(x.seg.quote, `commonly credited to ${entry.credited}`,
        CREAM, 'rgba(232,228,220,.72)')) });
    } else if ('payoff' in x.seg) {
      states.push({ from, to, f: shot(badge(x.chapter) + lowerQuote(x.seg.excerpt, x.seg.cite, GOLD, 'rgba(201,169,97,.88)')) });
    } else if (x.seg.app) {
      // The reading screen, because it shows the promise: a real passage with
      // its citation. (Not complete.png: its quote was one of the 55 removed
      // in the attribution audit, and has not been re-shot.)
      states.push({ from, to, f: shot(`<div style="position:absolute;right:220px;top:90px;height:900px;border-radius:44px;` +
        `overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.7)"><img src="file://${path.join(ROOT, 'public', 'screenshots', 'reading.png')}" ` +
        'style="height:900px;display:block"></div>') });
    } else if (x.chapter) {
      states.push({ from, to, f: shot(badge(x.chapter)) });
    }
  });
  states.push({ from: voEnd, to: total, f: shot(card(`
    <img src="file://${path.join(ROOT, 'public', 'skull-gold.png')}" style="width:130px;height:auto">
    <div style="margin-top:44px;font:600 72px Cinzel;color:${CREAM};letter-spacing:.04em">Marcus</div>
    <div style="margin-top:18px;font:400 32px Inter;color:rgba(232,228,220,.75)">A daily Stoic practice for iOS</div>
    <div style="margin-top:40px;font:600 44px Cinzel;color:${GOLD};letter-spacing:.04em">getmarcus.app</div>`)) });
  const blank = shot('');
  const framesDir = path.join(work, 'frames');
  fs.mkdirSync(framesDir, { recursive: true });
  let at = 0, fi = 0;
  const put = (f, n) => { for (let k = 0; k < n; k++) fs.symlinkSync(f, path.join(framesDir, `f${String(fi++).padStart(6, '0')}.png`)); };
  for (const s of states.sort((a, b) => a.from - b.from)) {
    const f0 = frame(s.from), f1 = frame(s.to);
    if (f0 > at) put(blank, f0 - at);
    if (f1 > Math.max(f0, at)) { put(s.f, f1 - Math.max(f0, at)); at = f1; }
  }
  const text = path.join(work, 'text.mov');
  ff(['-framerate', String(FPS), '-i', path.join(framesDir, 'f%06d.png'), '-c:v', 'qtrle', text]);
  if (Math.abs(fi - frame(total)) > 1) throw new Error(`text track is ${fi} frames, expected ${frame(total)}`);

  // 4. Sound. The music restarts in each section (between cards) from a
  //    different point in the track, fading in after the card's impact.
  const audioIn = ['-i', vo];
  const mix = ['[0:a]apad[v]'];
  const labels = ['[v]'];
  let ai = 1;
  if (eleven) {
    const LEN = 180;
    const music = await S.elevenAudio('music', { prompt: lf.music, music_length_ms: LEN * 1000 }, '.music-cache');
    const len = duration(music);
    const head = S.musicStart(music, 60);
    const cards = timeline.filter(x => x.card);
    const bounds = [0, ...cards.flatMap(c => [c.start, c.end]), total];
    const sections = [];
    for (let k = 0; k < bounds.length; k += 2) if (bounds[k + 1] - bounds[k] > 1) sections.push([bounds[k], bounds[k + 1]]);
    audioIn.push('-i', music);
    mix.push(`[${ai}:a]aresample=44100,asplit=${sections.length}${sections.map((_, k) => `[mu${k}]`).join('')}`);
    sections.forEach(([a, b], k) => {
      const d = b - a;
      const room = Math.max(0, len - head - d);
      const off = head + (room ? (k * 47) % room : 0);
      const ms = Math.round(a * 1000);
      mix.push(`[mu${k}]atrim=start=${off.toFixed(2)}:duration=${d.toFixed(2)},asetpts=PTS-STARTPTS,volume=0.17,` +
        `afade=t=in:d=${k ? 1.2 : 0.4},afade=t=out:st=${Math.max(0, d - 1.0).toFixed(2)}:d=1.0,adelay=${ms}|${ms}[m${k}]`);
      labels.push(`[m${k}]`);
    });
    ai++;
    const hit = await S.elevenAudio('sfx', { text: 'a single low, soft cinematic impact with a short dark reverb tail, no music',
      duration_seconds: 2.5, prompt_influence: 0.5 }, '.sfx-cache');
    audioIn.push('-i', hit);
    mix.push(`[${ai}:a]aresample=44100,asplit=${cards.length}${cards.map((_, k) => `[h${k}]`).join('')}`);
    cards.forEach((c, k) => {
      const ms = Math.round((c.start + 0.05) * 1000);
      mix.push(`[h${k}]adelay=${ms}|${ms},volume=0.5[hh${k}]`);
      labels.push(`[hh${k}]`);
    });
    ai++;
    for (const x of timeline) {
      if (!x.seg || !x.seg.sfx) continue;
      const fx = await S.elevenAudio('sfx', { text: x.seg.sfx, duration_seconds: 2.5, prompt_influence: 0.5 }, '.sfx-cache');
      audioIn.push('-i', fx);
      const ms = Math.max(0, Math.round((x.start - 0.08) * 1000));
      mix.push(`[${ai}:a]aresample=44100,adelay=${ms}|${ms},volume=${x.seg.sfxVolume ?? 0.85}[s${ai}]`);
      labels.push(`[s${ai}]`);
      ai++;
    }
  }
  mix.push(`${labels.join('')}amix=inputs=${labels.length}:normalize=0:duration=longest[aout]`);
  const premix = path.join(work, 'premix.wav');
  ff([...audioIn, '-filter_complex', mix.join(';'), '-map', '[aout]', '-t', total.toFixed(3),
    '-ar', '44100', '-c:a', 'pcm_s16le', premix]);
  const meas = spawnSync('ffmpeg', ['-v', 'info', '-i', premix, '-af', 'loudnorm=I=-14:TP=-1.5:LRA=20:print_format=json',
    '-f', 'null', '-'], { maxBuffer: 1 << 26 });
  const blocks = String(meas.stderr).match(/\{[^{}]*\}/g) || [];
  const gain = -14 - Number(JSON.parse(blocks[blocks.length - 1]).input_i);

  const mp4 = path.join(S.OUT, `${lf.id}.mp4`);
  ff(['-i', vis, '-i', text, '-i', premix, '-filter_complex', [
    `[0:v]tpad=stop_mode=clone:stop_duration=${END_CARD + 1}[bg]`,
    '[bg][1:v]overlay=0:0:eof_action=repeat[b1]', '[b1]format=yuv420p[vout]',
    `[2:a]volume=${gain.toFixed(2)}dB,alimiter=limit=0.84:attack=5:release=50:level=false,aresample=44100[aout]`].join(';'),
  '-map', '[vout]', '-map', '[aout]', '-t', total.toFixed(3), '-r', String(FPS),
  '-c:v', 'libx264', '-profile:v', 'high', '-crf', '18', '-preset', 'medium',
  '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', mp4]);

  // 5. Captions, the timeline for listening, and the notes to paste.
  const spokenTl = timeline.filter(x => x.seg);
  fs.writeFileSync(path.join(S.OUT, `${lf.id}.srt`), srt(spokenTl));
  fs.writeFileSync(path.join(S.OUT, `${lf.id}.timeline.json`), JSON.stringify(spokenTl.map(x => ({
    text: spoken(x.seg), start: x.start, end: x.end, wav: x.wav,
    words: x.words.map(w => ({ text: w.text, at: x.start + w.start })),
  })), null, 1));
  const chapters = [{ at: 0, name: 'Intro' }];
  for (const x of timeline) {
    if (x.card === 'chapter') {
      const entry = entries.find(e => e.id === x.chapter.entry);
      chapters.push({ at: x.start, name: `${x.chapter.n}. ${entry.text.replace(/\.$/, '')}` });
    }
  }
  const close = timeline.find(x => x.close);
  if (close) chapters.push({ at: close.start, name: 'How to spot a fake' });
  const credits = [...new Set(specs.filter(v => v.art).map(v => ART[v.art]))]
    .map(a => [a.artist, a.work, a.date].filter(Boolean).join(', '));
  const generated = specs.some(v => v.gen || v.still);
  const fellBack = specs.filter(v => v.fellBack).length;
  fs.writeFileSync(path.join(S.OUT, `${lf.id}.txt`), [
    '════ PASTE INTO YOUTUBE ════', '', 'TITLE', lf.title, '', 'DESCRIPTION',
    'Ten famous quotes credited to Marcus Aurelius, Seneca, and Epictetus, where each one really came from, ' +
      'and what the Stoics actually wrote instead.',
    '', 'Full sources for every quote: https://getmarcus.app/misattributed-stoic-quotes',
    '', ...chapters.map(c => `${clock(c.at)} ${c.name}`),
    '', 'Paintings:', ...credits.map(c => `${c}.`),
    '', [voice === 'elevenlabs' ? 'Narrated with an AI clone of my own voice' : null,
      generated ? 'some footage is AI-generated' : null].filter(Boolean).join('; ').replace(/^./, c => c.toUpperCase()) +
      '. Every quotation is checked against its source.',
    '', 'Marcus, a daily Stoic practice for iOS: https://getmarcus.app',
    '', 'SUBTITLES', `Upload ${lf.id}.srt under Subtitles, language English.`,
    '', '', '════ FOR YOU, NOT FOR PASTING ════', '',
    '- In YouTube Studio, under "Altered content", answer Yes.',
    voice === 'elevenlabs' ? null : '- Voice is macOS say. DRAFT ONLY, do not post.',
    fellBack ? `- DRAFT: ${fellBack} generated shot(s) replaced by paintings. Not final.` : null,
    `- Length ${clock(total)}.`,
  ].filter(x => x !== null).join('\n') + '\n');
  return { mp4, total, voice, specs };
}

// ── plan ────────────────────────────────────────────────────────────────────
// Prices generation without voicing anything, from an estimate of each line's
// length (about 15 characters a second in the clone), so it is free to run.
function plan(lf) {
  const items = flatten(lf);
  let t = LEAD_IN;
  const timeline = items.map((it, i) => {
    const start = t;
    if (it.card) { t += CARD; return { ...it, start }; }
    t += (it.seg.pauseBefore || 0) + spoken(it.seg).length / 15;
    const next = items[i + 1];
    t += it.seg.quote || 'payoff' in it.seg ? 0.8 : next && next.card ? 0.7 : 0.35;
    return { ...it, start };
  });
  const specs = visualPlan(lf, timeline, t, true);
  const clips = specs.filter(v => v.gen), stills = specs.filter(v => v.still);
  const newClips = clips.filter(v => !fs.existsSync(S.clipPath(v.gen, v.negative, Math.min((v.to - v.from) / FPS, MAX_CLIP), '16:9')));
  const newStills = stills.filter(v => !fs.existsSync(S.stillPath(v.still, '16:9')));
  const secs = newClips.reduce((s, v) => s + Number(({ 4: 4, 6: 6, 8: 8 })[Math.min((v.to - v.from) / FPS, MAX_CLIP) <= 4.4 ? 4 : Math.min((v.to - v.from) / FPS, MAX_CLIP) <= 6.4 ? 6 : 8]), 0);
  const chars = items.filter(x => x.seg).reduce((s, x) => s + spoken(x.seg).length, 0);
  console.log(`${lf.id}: about ${clock(t + END_CARD)}`);
  console.log(`  voice: ${chars} characters (cached lines cost nothing)`);
  console.log(`  clips: ${clips.length} (${newClips.length} new, ${secs}s of footage to generate)`);
  console.log(`  stills: ${stills.length} (${newStills.length} new)`);
  console.log(`  paintings: ${specs.filter(v => v.art).length} shots`);
}

async function main() {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  const pick = () => {
    const id = argv.slice(1).find(a => !a.startsWith('--'));
    const lf = LONGFORM.find(x => x.id === id);
    if (!lf) { console.error(`usage: longform.js ${cmd} <${LONGFORM.map(x => x.id).join('|')}>`); process.exit(1); }
    return lf;
  };
  if (!cmd || cmd === 'check') {
    let bad = 0;
    for (const lf of LONGFORM) {
      const p = validate(lf);
      console.log((p.length ? '✗ ' : '✓ ') + lf.id);
      p.forEach(x => console.log('    ' + x));
      if (p.length) bad++;
    }
    process.exit(bad ? 1 : 0);
  }
  if (cmd === 'plan') return plan(pick());
  if (cmd === 'render') {
    const r = await render(pick(), { noGen: argv.includes('--no-gen'), voice: (argv.find(a => a.startsWith('--voice=')) || '').split('=')[1] });
    console.log(`✓ ${path.relative(ROOT, r.mp4)}  ${clock(r.total)}  voice=${r.voice}  ` +
      `${r.specs.filter(v => v.gen).length} clips, ${r.specs.filter(v => v.art).length} painting shots` +
      (r.specs.some(v => v.fellBack) ? `  (${r.specs.filter(v => v.fellBack).length} fell back to paintings)` : ''));
  }
}

module.exports = { validate, flatten, srt, visualPlan };
if (require.main === module) main().catch(e => { console.error('✗ ' + e.message); process.exit(1); });
