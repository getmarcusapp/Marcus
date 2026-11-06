#!/usr/bin/env node
/**
 * Builds the guided meditations from content/meditations/<id>.txt.
 *
 *   node scripts/meditations.js sample              ~90s of View From Above in each voice model
 *   node scripts/meditations.js build <id> | --all  render to meditations-out/<id>.mp3
 *   node scripts/meditations.js install <id> | --all  copy a render into assets/meditations/
 *
 * WHY. The first recordings were generated as whole scripts, before there was
 * a way to place silence: ElevenLabs pause tags top out around three seconds
 * and vary by take, so the longest pause in seven meditations was 7.3s and
 * the pace ran at up to 124 words a minute. A meditation that tells you to
 * picture your last day and moves on four seconds later is a reading, not a
 * practice. Here each passage is voiced on its own and the silences between
 * them are exact, written into the script by hand.
 *
 * Voice: Theo Silk (British Deep Sleep & Meditation), the voice of the
 * originals, with its saved settings. Passages are cached by text and
 * settings in meditations-out/.cache, so retiming a script costs nothing.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
}
const SRC = path.join(ROOT, 'content', 'meditations');
const OUT = path.join(ROOT, 'meditations-out');
const CACHE = path.join(OUT, '.cache');
const ASSETS = path.join(ROOT, 'assets', 'meditations');
fs.mkdirSync(CACHE, { recursive: true });

const VOICE = 'UmQN7jS1Ee8B1czsUtQh'; // Theo Silk
const MODELS = {
  // The voice's saved settings. v2 takes SSML breaks and neighbouring text,
  // which keeps one passage's tone continuous with the next.
  v2: { model_id: 'eleven_multilingual_v2', voice_settings: { stability: 0.6, similarity_boost: 0.8, style: 0, use_speaker_boost: true, speed: 0.9 } },
  // What the July regenerations used. More expressive, less predictable.
  v3: { model_id: 'eleven_v3', voice_settings: { stability: 0.5 } },
};
const MODEL = process.env.MEDITATION_MODEL || 'v3'; // Gio's pick from the A/B samples, 2026-11-05
const BREATH = 1.1; // seconds between sentences inside a passage (v2 only)

// Shared by all seven, generated once.
const BOWL = { text: 'A single strike of a large Tibetan singing bowl in a quiet room, warm low fundamental, long natural resonant decay into silence. No other sounds.', duration_seconds: 12, prompt_influence: 0.6 };
const PAD = { prompt: 'Very quiet, warm ambient drone for a meditation recording. A soft sustained low pad, slowly breathing, no melody, no rhythm, no percussion, no bells, no vocals. Static and calm, the same from start to end.', music_length_ms: 180000 };
const PAD_DB = -25; // under the voice; silence should still feel like silence

const hash = x => crypto.createHash('sha1').update(JSON.stringify(x)).digest('hex').slice(0, 16);
const ff = args => execFileSync('ffmpeg', ['-loglevel', 'error', '-y', ...args]);
const duration = f => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString());

function parse(id) {
  const lines = fs.readFileSync(path.join(SRC, id + '.txt'), 'utf8').split('\n').map(l => l.trim()).filter(Boolean);
  return lines.map(l => {
    if (l === '[[bell]]') return { bell: true };
    const m = l.match(/^\[\[(\d+(?:\.\d+)?)\]\]$/);
    return m ? { silence: Number(m[1]) } : { say: l };
  });
}

async function post(url, body) {
  for (let a = 0; a < 4; a++) {
    const r = await fetch(url, { method: 'POST', headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (r.ok) return Buffer.from(await r.arrayBuffer());
    const t = (await r.text()).slice(0, 300);
    if (r.status !== 429 && r.status < 500) throw new Error(url.split('/v1/')[1] + ' HTTP ' + r.status + ': ' + t);
    await new Promise(z => setTimeout(z, 4000 * (a + 1)));
  }
  throw new Error('ElevenLabs kept failing: ' + url);
}

async function voice(text, prev, next, model = MODEL) {
  const m = MODELS[model];
  const spoken = model === 'v2' ? text.replace(/([.?!:])\s+(?=\S)/g, `$1 <break time="${BREATH}s" /> `) : text;
  const body = { text: spoken, ...m, ...(model === 'v2' ? { previous_text: prev || undefined, next_text: next || undefined } : {}) };
  const wav = path.join(CACHE, 'v-' + hash([VOICE, body]) + '.wav');
  if (!fs.existsSync(wav)) {
    const mp3 = await post(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_128`, body);
    fs.writeFileSync(wav + '.mp3', mp3);
    // Trim the model's own leading and trailing air, so the script's silences are the silences.
    ff(['-i', wav + '.mp3', '-af', 'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.05,areverse,silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.15,areverse', '-ar', '44100', '-ac', '1', wav]);
    fs.rmSync(wav + '.mp3');
  }
  return wav;
}

async function shared(kind, body) {
  const f = path.join(CACHE, kind + '-' + hash(body) + '.mp3');
  if (!fs.existsSync(f)) fs.writeFileSync(f, await post('https://api.elevenlabs.io/v1/' + (kind === 'pad' ? 'music' : 'sound-generation'), body));
  return f;
}

// Lays voice and bowl onto a timeline, puts the pad under everything, and
// normalises to a quiet, consistent loudness.
async function render(items, out, model = MODEL) {
  const says = items.map((x, i) => [x, i]).filter(([x]) => x.say);
  const placed = []; let t = 0; const bells = [];
  for (const x of items) {
    if (x.bell) { bells.push(t); continue; }
    if (x.silence) { t += x.silence; continue; }
    const k = says.findIndex(([y]) => y === x);
    const wav = await voice(x.say, (says[k - 1] || [{}])[0].say, (says[k + 1] || [{}])[0].say, model);
    placed.push({ wav, at: t }); t += duration(wav);
  }
  const total = t + 10; // the final bowl rings out
  const bowl = await shared('bowl', BOWL), pad = await shared('pad', PAD);
  const inputs = [], filters = [], labels = [];
  placed.forEach((p, i) => { inputs.push('-i', p.wav); const ms = Math.round(p.at * 1000); filters.push(`[${i}:a]adelay=${ms}|${ms}[v${i}]`); labels.push(`[v${i}]`); });
  let n = placed.length;
  for (const b of bells) { inputs.push('-i', bowl); const ms = Math.round(b * 1000); filters.push(`[${n}:a]aresample=44100,pan=mono|c0=0.5*c0+0.5*c1,volume=0.55,adelay=${ms}|${ms}[b${n}]`); labels.push(`[b${n}]`); n++; }
  inputs.push('-stream_loop', '-1', '-i', pad);
  filters.push(`[${n}:a]aresample=44100,pan=mono|c0=0.5*c0+0.5*c1,atrim=0:${total.toFixed(2)},volume=${PAD_DB}dB,afade=t=in:d=6,afade=t=out:st=${(total - 8).toFixed(2)}:d=8[pad]`);
  labels.push('[pad]');
  filters.push(`${labels.join('')}amix=inputs=${labels.length}:normalize=0:dropout_transition=0,atrim=0:${total.toFixed(2)},loudnorm=I=-19:TP=-2:LRA=11[out]`);
  // Master as WAV; the MP3 is for listening to a render, the app gets HE-AAC
  // (install), which holds speech over a quiet pad at about a third the size.
  const wav = out.replace(/\.mp3$/, '.wav');
  ff([...inputs, '-filter_complex', filters.join(';'), '-map', '[out]', '-ac', '1', '-ar', '44100', '-c:a', 'pcm_s16le', wav]);
  ff(['-i', wav, '-c:a', 'libmp3lame', '-b:a', '80k', out]);
  return { total, words: says.reduce((s, [x]) => s + x.say.split(/\s+/).length, 0) };
}

async function main() {
  const [cmd, arg] = process.argv.slice(2);
  const ids = arg === '--all' ? fs.readdirSync(SRC).filter(f => f.endsWith('.txt')).map(f => f.slice(0, -4)) : [arg];
  if (cmd === 'sample') {
    const items = parse('view-from-above').slice(0, 12);
    for (const model of ['v2', 'v3']) {
      const out = path.join(OUT, `sample-view-from-above-${model}.mp3`);
      const r = await render([...items, { silence: 4 }, { bell: true }], out, model);
      console.log(model, out, (r.total / 60).toFixed(1) + ' min');
    }
    return;
  }
  if (cmd === 'build') {
    for (const id of ids) {
      const out = path.join(OUT, id + '.mp3');
      const r = await render(parse(id), out);
      const d = duration(out);
      console.log(`${id.padEnd(24)} ${(d / 60).toFixed(1)} min  ${Math.round(r.words / (d / 60))} words/min  → ${path.relative(ROOT, out)}`);
    }
    return;
  }
  if (cmd === 'verify') {
    // Transcribe each render and compare it with its script, word by word.
    // v3 is expressive and can drift ("its own pace" once came back "peace"),
    // so nothing is installed until this reads 100%.
    const W = t => (t.toLowerCase().replace(/’/g, "'").replace(/-/g, ' ').match(/[a-z']+/g) || [])
      .map(w => w.replace(/^'|'$/g, '')).filter(Boolean);
    for (const id of ids) {
      let j = null;
      for (let a = 0; a < 4 && !(j && j.text); a++) {
        const form = new FormData();
        form.append('model_id', 'scribe_v1');
        form.append('file', new Blob([fs.readFileSync(path.join(OUT, id + '.mp3'))]), 'a.mp3');
        const r = await fetch('https://api.elevenlabs.io/v1/speech-to-text', { method: 'POST', headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY }, body: form });
        j = await r.json(); if (!j.text) await new Promise(z => setTimeout(z, 5000 * (a + 1)));
      }
      const s = W(parse(id).filter(x => x.say).map(x => x.say).join(' ')), h = W(j.text.replace(/\(.*?\)|\[.*?\]/g, ' '));
      const n = s.length, m = h.length, dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
      for (let i = n - 1; i >= 0; i--) for (let k = m - 1; k >= 0; k--) dp[i][k] = s[i] === h[k] ? dp[i + 1][k + 1] + 1 : Math.max(dp[i + 1][k], dp[i][k + 1]);
      const out = []; let i = 0, k = 0, mi = [], ex = [];
      const flush = () => { if (mi.length || ex.length) out.push(`script "${mi.join(' ')}" heard "${ex.join(' ')}"`); mi = []; ex = []; };
      while (i < n && k < m) { if (s[i] === h[k]) { flush(); i++; k++; } else if (dp[i + 1][k] >= dp[i][k + 1]) mi.push(s[i++]); else ex.push(h[k++]); }
      while (i < n) mi.push(s[i++]); while (k < m) ex.push(h[k++]); flush();
      console.log(`${id.padEnd(24)} ${(100 * dp[0][0] / n).toFixed(1)}%`); out.slice(0, 8).forEach(x => console.log('    ' + x));
    }
    return;
  }
  if (cmd === 'install') {
    for (const id of ids) {
      // HE-AAC at 40 kb/s mono (its ceiling), via macOS afconvert: about 2.4 MB for eight
      // minutes. Fifteen meditations as 80k MP3 were 78 MB of app download.
      const dest = path.join(ASSETS, id + '.m4a');
      execFileSync('afconvert', ['-f', 'm4af', '-d', 'aach', '-b', '40000', path.join(OUT, id + '.wav'), dest]);
      const old = path.join(ASSETS, id + '.mp3'); if (fs.existsSync(old)) fs.rmSync(old);
      console.log('installed', id, (fs.statSync(dest).size / 1048576).toFixed(1) + ' MB');
    }
    return;
  }
  console.log('usage: meditations.js sample | build <id>|--all | verify <id>|--all | install <id>|--all');
}
main().catch(e => { console.error('✗ ' + e.message); process.exit(1); });
