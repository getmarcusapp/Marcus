/**
 * Classical artwork for the articles, reused from the app.
 *
 * The site was a wall of type. The app already carries a curated gallery of
 * public-domain paintings, each chosen for a specific practice and each with an
 * attribution and a reason, so the honest way to add colour to the website was
 * to use the same pictures rather than source new ones. They are the same
 * brand because they ARE the brand.
 *
 * ATTRIBUTION IS NOT OPTIONAL HERE. This site argues that a quotation without a
 * citation has not been checked by anyone. An image without one is the same
 * claim in a different medium, so every picture prints its artist, its title
 * and its date under it.
 *
 * ONLY WHERE THE FIT IS REAL. Nine articles get a painting. The others get
 * nothing, deliberately: a picture chosen because a page looked bare is
 * decoration, and this site does not do decoration. Friedrich's wanderer on the
 * view from above earns its place; the same painting on "Is Stoicism a
 * religion?" would not.
 *
 * The files are copies of assets/meditations/img and assets/virtues, resized to
 * 1200px and recompressed for the web. Regenerate with:
 *   sips -Z 1200 --setProperty formatOptions 45 <src> --out public/img/art/<name>
 */

// Artist, work and why, lifted from app/imagery.jsx so the two cannot drift.
const ART = {
  'view-from-above': {
    file: 'view-from-above.jpg',
    artist: 'Caspar David Friedrich',
    work: 'Wanderer above the Sea of Fog',
    date: '1818',
  },
  'premeditatio-malorum': {
    file: 'premeditatio-malorum.jpg',
    artist: 'Roman sculpture',
    work: 'Bust of Marcus Aurelius, Capitoline Museums, Rome',
    date: 'second century',
  },
  'evening-examination': {
    file: 'evening-examination.jpg',
    artist: 'Caravaggio',
    work: 'Saint Jerome Writing, Galleria Borghese',
    date: '1605–6',
  },
  'negative-visualization': {
    file: 'negative-visualization.jpg',
    artist: 'Philippe de Champaigne',
    work: 'Vanitas (Still Life with a Skull)',
    date: '1671',
  },
  'present-moment': {
    file: 'present-moment.jpg',
    artist: 'Francisco de Zurbarán',
    work: 'Cup of Water and a Rose on a Silver Plate',
    date: 'c. 1630',
  },
  'memento-mori': {
    file: 'memento-mori.jpg',
    artist: 'Frans Hals',
    work: 'Young Man with a Skull, National Gallery, London',
    date: 'c. 1626–28',
  },
  'dichotomy-of-control': {
    file: 'dichotomy-of-control.jpg',
    artist: 'Annibale Carracci',
    work: 'The Choice of Hercules, Museo di Capodimonte, Naples',
    date: 'c. 1596',
  },
  'virtue-wisdom': {
    file: 'virtue-wisdom.jpg',
    artist: 'Roman, after a Greek original',
    work: 'Marble head of Athena, Metropolitan Museum of Art',
    date: '',
  },
  'virtue-moderation': {
    file: 'virtue-moderation.jpg',
    artist: 'Piero del Pollaiolo',
    work: 'Temperance, Uffizi',
    date: '1469–72',
  },
};

// article slug -> artwork key. Each pairing is a judgment, not a lookup.
const BY_SLUG = {
  'view-from-above': 'view-from-above',
  'premeditatio-malorum': 'premeditatio-malorum',
  'stoic-evening-examination': 'evening-examination',
  'memento-mori': 'memento-mori',
  'dichotomy-of-control': 'dichotomy-of-control',
  'four-stoic-virtues': 'virtue-wisdom',
  // The vanitas is a painting about losing what you have, which is the subject.
  'stoicism-and-grief': 'negative-visualization',
  // Zurbarán gave a glass of water the attention a monk gives prayer. That is
  // what the journal asks of an ordinary day.
  'how-to-keep-a-stoic-journal': 'present-moment',
  // Seneca's three books on anger argue for restraint over expression.
  'stoicism-and-anger': 'virtue-moderation',
};

function artFor(slug) {
  const key = BY_SLUG[slug];
  return key ? { key, ...ART[key] } : null;
}

// Rendered above the article body. The caption is part of the point.
function artHtml(slug, prefix) {
  const a = artFor(slug);
  if (!a) return '';
  const credit = [a.artist, a.work, a.date].filter(Boolean).join(', ');
  return '<figure class="' + prefix + '-art">' +
    '<img src="/img/art/' + a.file + '" alt="' + credit.replace(/"/g, '&quot;') + '" loading="lazy" decoding="async">' +
    '<figcaption>' + credit + '</figcaption>' +
    '</figure>';
}

function artCss(prefix) {
  const p = '.' + prefix;
  return (
    p + '-art{margin:0 0 34px;border-radius:12px;overflow:hidden;background:rgba(232,228,220,.03)}' +
    // contain, not cover. Several of these are portrait format, and cropping a
    // Friedrich to a letterbox to make a page tidy is not a trade worth making.
    // Letterboxing against the page colour costs nothing and shows the picture.
    p + '-art img{width:100%;height:auto;display:block;max-height:560px;object-fit:contain;background:#0d0d0f}' +
    p + '-art figcaption{font-size:12.5px;color:rgba(232,228,220,.5);padding:10px 14px;letter-spacing:.01em}'
  );
}

module.exports = { ART, BY_SLUG, artFor, artHtml, artCss };
