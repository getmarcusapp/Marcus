#!/usr/bin/env node
// Open Graph cards — one per page, generated typographically.
//
// WHY GENERATED RATHER THAN PHOTOGRAPHED. Every page on the site shared a
// single og-image.png, so a share of the attribution essay, the premeditatio
// guide and the homepage all produced an identical card that said nothing.
// Link previews are how the attribution page is supposed to earn links, and an
// identical card on every one of them wastes that. Stock photography would fix
// the sameness and cost more than it returns: it is what every other Stoicism
// site uses, and it carries the same licensing exposure as the portraits.
// Type on the brand's own ground has no licensing exposure at all and scales to
// every future article for free.
//
// HOW IT RASTERIZES. This machine has no SVG renderer: no rsvg-convert, no
// ImageMagick, no sharp, no puppeteer. What macOS does ship is Quick Look,
// which renders SVG only into a SQUARE thumbnail.
//
// Feeding it a 1200x630 SVG does NOT letterbox cleanly: measured against a
// calibration card with ruled borders, Quick Look scaled the design by ~1.53
// and clipped the right third off the canvas. So the SVG is authored on a
// SQUARE 1200x1200 canvas with the card occupying the middle 630 band, which
// maps 1:1 with no scaling, and sips then crops that band back out. Verified
// with a border-ruled test card rather than assumed.
//
// Re-run when a page or its title changes:  node scripts/build-og.js

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'public', 'og');
const TMP = path.join(ROOT, '.og-tmp');
const W = 1200, H = 630;
// The square canvas Quick Look wants, and the offset that centers the card in it.
const CANVAS = 1200;
const OFF = (CANVAS - H) / 2;

const INK = '#e8e4dc';
const GROUND = '#0d0d0f';
const GOLD = '#c9a961';

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// SVG has no text wrapping, so lines are broken here. Widths are estimated from
// an average glyph width for the serif at this size; the box is kept generous
// so an underestimate cannot push a line off the canvas.
function wrap(text, fontSize, maxWidth) {
  // Measured: 20 'M' at 68px Georgia spans ~1110px, so the widest glyph is
  // ~0.82em. Mixed-case prose averages far less, but 0.58 leaves headroom so a
  // title with unusually wide letters still cannot run off the edge.
  const avg = fontSize * 0.58;
  const maxChars = Math.floor(maxWidth / avg);
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    const next = line ? line + ' ' + w : w;
    if (next.length > maxChars && line) { lines.push(line); line = w; }
    else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

function card({ title, eyebrow }) {
  // Long titles step down a size rather than overflowing or wrapping to four.
  let size = 66;
  let lines = wrap(title, size, W - 160);
  if (lines.length > 2) { size = 54; lines = wrap(title, size, W - 160); }
  if (lines.length > 3) { size = 44; lines = wrap(title, size, W - 160); }

  const lh = size * 1.24;
  const blockH = (lines.length - 1) * lh;
  // Vertically centered within the card band, then shifted onto the square
  // canvas. All y values below are card-space plus OFF.
  const startY = OFF + (H - blockH) / 2 - 10;

  const titleTspans = lines.map((l, i) =>
    '<tspan x="80" y="' + (startY + i * lh).toFixed(1) + '">' + esc(l) + '</tspan>').join('');

  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + CANVAS + '" height="' + CANVAS + '" viewBox="0 0 ' + CANVAS + ' ' + CANVAS + '">' +
    '<rect width="' + CANVAS + '" height="' + CANVAS + '" fill="' + GROUND + '"/>' +
    '<rect x="0" y="' + OFF + '" width="' + W + '" height="6" fill="' + GOLD + '"/>' +
    (eyebrow
      ? '<text x="80" y="' + (OFF + 96) + '" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" ' +
        'font-size="21" letter-spacing="4.5" fill="' + GOLD + '">' + esc(eyebrow.toUpperCase()) + '</text>'
      : '') +
    '<text font-family="Georgia, Times New Roman, serif" font-size="' + size + '" fill="' + INK + '">' +
    titleTspans + '</text>' +
    '<text x="80" y="' + (OFF + H - 60) + '" font-family="Georgia, serif" font-size="25" fill="' + INK + '" opacity="0.5">Marcus</text>' +
    '<text x="80" y="' + (OFF + H - 32) + '" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="17" letter-spacing="1.5" fill="' + GOLD + '">getmarcus.app</text>' +
    '</svg>';
}

function render(svg, slug) {
  fs.mkdirSync(TMP, { recursive: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const svgPath = path.join(TMP, slug + '.svg');
  fs.writeFileSync(svgPath, svg, 'utf8');

  execFileSync('qlmanage', ['-t', '-s', String(CANVAS), '-o', TMP, svgPath], { stdio: 'ignore' });
  const raw = path.join(TMP, slug + '.svg.png');
  if (!fs.existsSync(raw)) throw new Error('qlmanage produced nothing for ' + slug);

  const out = path.join(OUT_DIR, slug + '.png');
  fs.copyFileSync(raw, out);
  // Crop the square back down to the card band.
  execFileSync('sips', ['-c', String(H), String(W), out], { stdio: 'ignore' });
  return out;
}

function articles() {
  const dir = path.join(ROOT, 'content', 'articles');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith('.md')).sort().map(f => {
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    const g = k => (src.match(new RegExp('^' + k + ':\\s*(.+)$', 'm')) || [])[1];
    return { slug: (g('slug') || '').trim(), title: (g('title') || '').trim(), eyebrow: 'The practice' };
  }).filter(a => a.slug);
}

// Pages that are not markdown articles still need their own card.
const STATIC = [
  { slug: 'home', title: 'A Stoic practice, every day', eyebrow: 'Marcus' },
  { slug: 'learn', title: 'Stoicism, as it was actually practiced', eyebrow: 'Learn' },
  { slug: 'stoics', title: 'The Stoics', eyebrow: 'Twelve figures' },
  { slug: 'library', title: 'The Stoic Library', eyebrow: 'The books behind the practice' },
  { slug: 'misattributed-stoic-quotes', title: 'The Stoic quotes that are not Stoic', eyebrow: 'Attribution' },
  { slug: 'meditations', title: 'Daily Meditations', eyebrow: 'One reflection each morning' },
];

function build() {
  const pages = [...STATIC, ...articles()];
  for (const p of pages) render(card(p), p.slug);
  fs.rmSync(TMP, { recursive: true, force: true });
  console.log('Built OG cards: ' + pages.length + ' → public/og/*.png');
}

build();
