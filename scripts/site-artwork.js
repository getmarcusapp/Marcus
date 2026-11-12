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
 * EVERY ARTICLE, BUT EVERY PAIRING EARNS ITS PLACE. Until November 2026 only
 * nine articles had a painting, on the theory that a picture chosen because a
 * page looked bare is decoration. Gio overruled that: an article with no image
 * reads as a wall and loses people before the first heading, and that is a
 * worse failure than a painting that is merely apt. So every article has one,
 * but the rule of fit stands: each is chosen for the subject (the painting
 * that inspired Gladiator on the Gladiator article; Delphi on "Know thyself"),
 * never for the palette alone, and the reason is written beside it below.
 *
 * Paintings and old engravings only. A painting is public domain once its
 * artist is; a museum photograph of a statue usually is not, because the
 * photographer holds rights in it. Each file below was checked on Wikimedia
 * Commons as Public domain or CC0, and its description page is noted.
 *
 * Sources: assets/meditations/img, assets/virtues and assets/heroes (the app's
 * own gallery), plus Wikimedia Commons. Resized to 1200px:
 *   sips -s format jpeg -Z 1200 --setProperty formatOptions 70 <src> --out public/img/art/<name>
 * and a 520px thumbnail for the Learn hub cards:
 *   sips -s format jpeg -Z 520 --setProperty formatOptions 62 <art> --out public/img/art/thumb/<name>
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
  'virtue-courage': {
    file: 'virtue-courage.jpg',
    artist: 'Caravaggio',
    work: 'David with the Head of Goliath, Galleria Borghese',
    date: '1610',
  },
  'virtue-justice': {
    file: 'virtue-justice.jpg',
    artist: 'Maerten van Heemskerck',
    work: 'Iustitia',
    date: 'sixteenth century',
  },
  // ── The app's own screen paintings (assets/heroes), credits as in app/imagery.jsx
  'philosopher-in-meditation': { file: 'philosopher-in-meditation.jpg', artist: 'Rembrandt van Rijn', work: 'The Philosopher in Meditation, Louvre', date: '1632' },
  'the-astronomer': { file: 'the-astronomer.jpg', artist: 'Johannes Vermeer', work: 'The Astronomer, Louvre', date: '1668' },
  'saint-paul-writing': { file: 'saint-paul-writing.jpg', artist: 'Valentin de Boulogne', work: 'Saint Paul Writing His Epistles, Museum of Fine Arts, Houston', date: 'c. 1618' },
  'narcissus': { file: 'narcissus.jpg', artist: 'Caravaggio', work: 'Narcissus', date: '1597–99' },
  'two-men-moon': { file: 'two-men-moon.jpg', artist: 'Caspar David Friedrich', work: 'Two Men Contemplating the Moon', date: '1819–20' },
  'aristotle-homer': { file: 'aristotle-homer.jpg', artist: 'Rembrandt van Rijn', work: 'Aristotle with a Bust of Homer, Metropolitan Museum of Art', date: '1653' },
  'penitent-magdalen': { file: 'penitent-magdalen.jpg', artist: 'Georges de La Tour', work: 'The Penitent Magdalen, Metropolitan Museum of Art', date: 'c. 1640' },
  // ── Wikimedia Commons, each marked Public domain (Death of Socrates: CC0)
  'fates': { file: 'fates.jpg', artist: 'Francisco Goya', work: 'Atropos (The Fates), Museo del Prado', date: '1820–23' },
  'dying-seneca': { file: 'dying-seneca.jpg', artist: 'Peter Paul Rubens', work: 'The Dying Seneca, Alte Pinakothek, Munich', date: 'c. 1612–13' },
  'epictetus-house': { file: 'epictetus-house.jpg', artist: 'Frontispiece engraving', work: 'The Morals of Epictetus (London)', date: '1697' },
  'epictetus-1670': { file: 'epictetus-1670.jpg', artist: 'Romeyn de Hooghe', work: 'Frontispiece to an edition of the Enchiridion, Amsterdam', date: '1670' },
  'hard-times': { file: 'hard-times.jpg', artist: 'Hubert von Herkomer', work: 'Hard Times, Manchester Art Gallery', date: '1885' },
  'death-of-socrates': { file: 'death-of-socrates.jpg', artist: 'Jacques-Louis David', work: 'The Death of Socrates, Metropolitan Museum of Art', date: '1787' },
  'fishermen-at-sea': { file: 'fishermen-at-sea.jpg', artist: 'J. M. W. Turner', work: 'Fishermen at Sea, Tate', date: '1796' },
  'marcus-bread': { file: 'marcus-bread.jpg', artist: 'Joseph-Marie Vien', work: 'Marcus Aurelius Distributing Bread to the People', date: '1765' },
  'vesuvius': { file: 'vesuvius.jpg', artist: 'Pierre-Jacques Volaire', work: 'The Eruption of Vesuvius, Art Institute of Chicago', date: '1771' },
  'priestess-of-delphi': { file: 'priestess-of-delphi.jpg', artist: 'John Collier', work: 'Priestess of Delphi, Art Gallery of South Australia', date: '1891' },
  'school-of-athens': { file: 'school-of-athens.jpg', artist: 'Raphael', work: 'The School of Athens, Apostolic Palace, Vatican', date: '1509–11' },
  'iron-forge': { file: 'iron-forge.jpg', artist: 'Joseph Wright of Derby', work: 'An Iron Forge, Tate', date: '1772' },
  'last-words-marcus': { file: 'last-words-marcus.jpg', artist: 'Eugène Delacroix', work: 'The Last Words of the Emperor Marcus Aurelius, Musée des Beaux-Arts de Lyon', date: '1844' },
  'pollice-verso': { file: 'pollice-verso.jpg', artist: 'Jean-Léon Gérôme', work: 'Pollice Verso, Phoenix Art Museum', date: '1872' },
  // Our own product, on the one page that compares apps.
  'marcus-app': { file: 'marcus-app.jpg', artist: 'Marcus', work: 'the daily reading, Practice Complete and home-screen widget', date: '' },
};

// A page whose subject is four things can show four pictures. This is the only
// one: everywhere else a single painting is the right amount, and a grid would
// be a gallery bolted onto an essay.
const GRIDS = {
  'four-stoic-virtues': [
    ['Wisdom', 'virtue-wisdom'],
    ['Courage', 'virtue-courage'],
    ['Justice', 'virtue-justice'],
    ['Temperance', 'virtue-moderation'],
  ],
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
  // Goya's three Fates hold the thread; amor fati is loving what they spin.
  'amor-fati': 'fates',
  // Rembrandt's scholar by the window: the first light of a working day.
  'stoic-morning-routine': 'philosopher-in-meditation',
  // The Stoic god was the order of the cosmos; Vermeer's astronomer studies it.
  'is-stoicism-a-religion': 'the-astronomer',
  // Seneca's death, as Tacitus tells it, is where many readers first meet him.
  'where-to-start-with-seneca': 'dying-seneca',
  // A man writing at his desk, which is what the Meditations are.
  'how-to-read-meditations': 'saint-paul-writing',
  // Narcissus examining his own image: CBT and the Stoics both start there.
  'stoicism-and-cbt': 'narcissus',
  // Two figures in silent contemplation, East and West of the same question.
  'stoicism-vs-buddhism': 'two-men-moon',
  // The article says the line is Durant, not Aristotle. Here is Aristotle.
  'did-aristotle-say-we-are-what-we-repeatedly-do': 'aristotle-homer',
  // "Epictetus lived at Rome in a little house": the article's own detail.
  'did-epictetus-say-its-not-what-happens-to-you': 'epictetus-house',
  'epictetus-discourses-enchiridion-or-art-of-living': 'epictetus-1670',
  // The title says it.
  'who-said-everyone-you-meet-is-fighting-a-hard-battle': 'hard-times',
  'did-socrates-say-the-secret-of-change': 'death-of-socrates',
  // The harbour and the wind of Letter 71.
  'who-said-luck-is-what-happens-when-preparation-meets-opportunity': 'fishermen-at-sea',
  'did-marcus-aurelius-say-the-obstacle-is-the-way': 'marcus-bread',
  'did-marcus-aurelius-say-everything-we-hear-is-an-opinion': 'premeditatio-malorum',
  // Pliny sailed toward Vesuvius saying fortune favours the brave.
  'who-said-fortune-favours-the-bold': 'vesuvius',
  'who-said-know-thyself': 'priestess-of-delphi',
  // Socrates is in it, among the philosophers who argued about knowledge.
  'did-socrates-say-i-know-that-i-know-nothing': 'school-of-athens',
  'who-said-everything-in-moderation-including-moderation': 'virtue-moderation',
  // Gems are polished by friction; men, says the proverb, by trials. A forge.
  'who-said-a-gem-cannot-be-polished-without-friction': 'iron-forge',
  // Feeling without being ruled by it: the Magdalen at her candle.
  'stoicism-is-not-suppressing-emotions': 'penitent-magdalen',
  'best-translation-of-meditations': 'last-words-marcus',
  // The painting Ridley Scott showed the studio when pitching Gladiator.
  'did-marcus-aurelius-say-echoes-in-eternity': 'pollice-verso',
  'best-stoic-apps': 'marcus-app',
  // A man at his desk with the page in front of him: the prompts are for that.
  'stoic-journal-prompts': 'saint-paul-writing',
};

function artFor(slug) {
  const key = BY_SLUG[slug];
  return key ? { key, ...ART[key] } : null;
}

function gridHtml(slug, prefix) {
  const rows = GRIDS[slug];
  if (!rows) return '';
  return '<div class="' + prefix + '-artgrid">' + rows.map(([label, key]) => {
    const a = ART[key];
    // The full credit is long enough to outgrow the picture in a grid cell:
    // five lines of caption under a 200px image reads as a bibliography with a
    // thumbnail. The visible line drops the museum; alt keeps the whole thing.
    const full = [a.artist, a.work, a.date].filter(Boolean).join(', ');
    const shortWork = a.work.split(',')[0];
    const brief = [a.artist, shortWork, a.date].filter(Boolean).join(', ');
    return '<figure class="' + prefix + '-art">' +
      '<img src="/img/art/' + a.file + '" alt="' + full.replace(/"/g, '&quot;') + '" loading="lazy" decoding="async">' +
      '<figcaption><b>' + label + '</b>' + brief + '</figcaption>' +
      '</figure>';
  }).join('') + '</div>';
}

// Rendered above the article body. The caption is part of the point.
function artHtml(slug, prefix) {
  if (GRIDS[slug]) return gridHtml(slug, prefix);
  const a = artFor(slug);
  if (!a) return '';
  const credit = [a.artist, a.work, a.date].filter(Boolean).join(', ');
  return '<figure class="' + prefix + '-art">' +
    '<img src="/img/art/' + a.file + '" alt="' + credit.replace(/"/g, '&quot;') + '" fetchpriority="high" decoding="async">' +
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
    p + '-art figcaption{font-size:12.5px;color:rgba(232,228,220,.5);padding:10px 14px;letter-spacing:.01em}' +
    // Four abreast on a wide screen, two on a phone. The images are landscape
    // and near-identical in ratio, so a fixed height crops all four the same
    // amount and the row reads as a set rather than four loose pictures.
    p + '-artgrid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin:0 0 34px}' +
    p + '-artgrid ' + p + '-art{margin:0}' +
    p + '-artgrid ' + p + '-art img{height:230px;max-height:none;object-fit:cover;object-position:center 35%}' +
    p + '-artgrid figcaption{font-size:11.5px;padding:8px 12px;line-height:1.45}' +
    p + '-artgrid figcaption b{display:block;color:rgba(232,228,220,.82);font-family:Cinzel,Georgia,serif;' +
      'font-size:13px;font-weight:600;letter-spacing:.04em;margin-bottom:2px}' +
    '@media (max-width:560px){' + p + '-artgrid{gap:8px}' + p + '-artgrid ' + p + '-art img{max-height:130px}}'
  );
}

module.exports = { ART, BY_SLUG, GRIDS, artFor, artHtml, artCss };
