// Curated reading list. Books sorted into four sections: primary Stoic
// sources, modern interpreters/scholars, adjacent thinkers, and Eastern
// wisdom in parallel. Each entry has a short "why this matters" written
// in the app's voice — annotation, not promotion.
//
// Affiliate links: we use Bookshop.org as the primary link (10%
// commission, supports indie bookstores — values-aligned with the
// audience) and Amazon as a fallback (4-8% commission). Both require
// the user's affiliate IDs configured below.
//
// FTC requires clear disclosure that we earn from qualifying purchases.
// The disclosure footer is rendered at the bottom of the library screen.

// ─── Affiliate IDs ──────────────────────────────────────────────────────
// TODO: replace these placeholder strings with your real affiliate
// identifiers from Amazon Associates and Bookshop.org. Until then, links
// will function (no commission earned) but Marcus does not actually
// monetize the click.
export const BOOKSHOP_AFFILIATE_ID = '123947';      // bookshop.org ?aid=
export const AMAZON_AFFILIATE_TAG = 'marcusapp-20'; // your Amazon ?tag= (placeholder)

// Helpers ───────────────────────────────────────────────────────────────
// Bookshop.org product slugs are unstable — the safer guaranteed-working
// URL is the search-by-ISBN endpoint. Affiliate tracking still applies
// via the ?aid= parameter on any bookshop.org URL.
export function bookshopUrl(isbn) {
  return `https://bookshop.org/beta-search?keywords=${isbn}&aid=${BOOKSHOP_AFFILIATE_ID}`;
}
export function amazonUrl(asin) {
  return `https://www.amazon.com/dp/${asin}?tag=${AMAZON_AFFILIATE_TAG}`;
}

// Reading list ──────────────────────────────────────────────────────────
// Each entry: { id, title, author, translator?, year?, asin, isbn, why }
// asin = Amazon Standard ID (used in Amazon /dp/ URLs).
// isbn = 13-digit ISBN (used to search-by-ISBN on Bookshop.org).
// Where multiple translations exist, the recommended one is named.

// Open Library cover by ISBN. `default=false` makes a missing cover return 404
// rather than a gray placeholder image, so callers can fall back deliberately.
// -L is the large size, which is what the in-app cover rows want; the website
// generator uses -M for its smaller grid.
export function coverUrl(isbn, size = 'L') {
  return `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(isbn)}-${size}.jpg?default=false`;
}

export const READING_LIST = [
  // ─── Primary Sources ─────────────────────────────────────────────────
  {
    id: 'meditations-hays',
    section: 'Primary sources',
    title: 'Meditations',
    author: 'Marcus Aurelius',
    translator: 'Gregory Hays',
    year: 167,
    asin: '0812968255',
    isbn: '9780812968255',
    why: "The private journal of a Roman emperor, written for himself in moments stolen from the work of running an empire. The Hays translation is the modern standard, direct, unornamented, hits with the immediacy of a contemporary voice. The single most important book in the canon. Start here.",
  },
  {
    id: 'epictetus-discourses-hard',
    section: 'Primary sources',
    title: 'Discourses, Fragments, Handbook',
    author: 'Epictetus',
    translator: 'Robin Hard',
    year: 108,
    asin: '0199595186',
    isbn: '9780199595181',
    why: "Epictetus was born a slave and became the most influential Stoic teacher of the Roman empire. The Discourses are his classroom, the Handbook his concentrated practice manual. Where Marcus is private and tonal, Epictetus is direct and instructional. Start with the Handbook if you want the practice in its tightest form.",
  },
  {
    id: 'seneca-letters-campbell',
    section: 'Primary sources',
    title: 'Letters from a Stoic',
    author: 'Seneca',
    translator: 'Robin Campbell',
    year: 65,
    asin: '0140442103',
    isbn: '9780140442106',
    why: "124 letters written near the end of Seneca's life to his friend Lucilius. Each is short, self-contained, and addresses a single subject: anger, time, the fear of death, the practice of friendship. The Penguin edition is the classic. Reads like a master practitioner thinking out loud across a desk from you.",
  },
  {
    id: 'seneca-shortness-life',
    section: 'Primary sources',
    title: 'On the Shortness of Life',
    author: 'Seneca',
    translator: 'C.D.N. Costa',
    year: 49,
    asin: '0143036327',
    isbn: '9780143036326',
    why: "Three short essays. The title essay is one of the most important Stoic texts on time: how we squander it, how we mistake busyness for living, what it costs to keep postponing the work that matters. Reads in an hour. Worth re-reading every year.",
  },
  {
    id: 'epictetus-art-of-living-lebell',
    section: 'Primary sources',
    title: 'The Art of Living',
    author: 'Epictetus',
    translator: 'Sharon Lebell',
    year: 1995,
    asin: '0061286052',
    isbn: '9780061286056',
    why: "An interpretive rendering of Epictetus's Handbook for modern readers. Not a literal translation. Lebell rewrites for clarity rather than scholarship, controversial among purists, but for a first encounter with Epictetus it's the most accessible door. Read this, then go to Hard.",
  },
  {
    id: 'cicero-on-duties',
    section: 'Primary sources',
    title: 'On Duties (De Officiis)',
    author: 'Cicero',
    translator: 'P.G. Walsh',
    year: -44,
    asin: '0192833030',
    isbn: '9780192833037',
    why: "Cicero's last major philosophical work, written for his son in the year of his own assassination. Less austere than the imperial Stoics, more concerned with the practical Stoicism of public life: what duty asks of a citizen, a friend, a holder of office. The four cardinal virtues are systematized here in a form Renaissance humanists would later adopt as standard ethical training.",
  },
  {
    id: 'musonius-rufus-lectures',
    section: 'Primary sources',
    title: 'Lectures and Sayings',
    author: 'Musonius Rufus',
    translator: 'Cynthia King',
    year: 80,
    asin: '1456459538',
    isbn: '9781456459536',
    why: "Musonius taught Epictetus. The lectures survive only in fragments, short, brutal, immediately usable. He argued that women should study philosophy, that exile is not an evil, that food and clothing are matters of practice. The Stoic teacher closest to your everyday experience: how to eat, how to dress, how to live with another person, how to bear an injury. Practical Stoicism in its earliest preserved form.",
  },

  // ─── Modern interpreters ─────────────────────────────────────────────
  {
    id: 'hadot-philosophy-as-way-of-life',
    section: 'Modern interpreters',
    title: 'Philosophy as a Way of Life',
    author: 'Pierre Hadot',
    translator: 'Michael Chase',
    year: 1995,
    asin: '0631180338',
    isbn: '9780631180333',
    why: "The book that recovered ancient philosophy as practice rather than theory. Hadot, French scholar, a generation's worth of work, argues that for the Stoics and their contemporaries, philosophy was a daily discipline of attention and exercise, not a body of doctrine. Foundational for understanding why Marcus is structured the way it is.",
  },
  {
    id: 'hadot-inner-citadel',
    section: 'Modern interpreters',
    title: 'The Inner Citadel: The Meditations of Marcus Aurelius',
    author: 'Pierre Hadot',
    translator: 'Michael Chase',
    year: 1998,
    asin: '0674007077',
    isbn: '9780674007079',
    why: "The single best companion to Meditations. Hadot reconstructs the spiritual exercises Marcus was performing in each entry: the discipline of assent, the discipline of desire, the discipline of action. After reading this, Meditations stops feeling like aphorisms and starts feeling like a practice manual.",
  },
  {
    id: 'sellars-stoicism',
    section: 'Modern interpreters',
    title: 'Stoicism (Ancient Philosophies)',
    author: 'John Sellars',
    year: 2006,
    asin: '0520249089',
    isbn: '9780520249080',
    why: "The serious scholarly introduction. Sellars is a philosopher specializing in the ancient Stoics. This is the book to read after the practical introductions if you want to understand the school's full architecture (logic, physics, ethics) and its place in ancient thought. Concise, dense, definitive.",
  },
  {
    id: 'robertson-roman-emperor',
    section: 'Modern interpreters',
    title: 'How to Think Like a Roman Emperor: The Stoic Philosophy of Marcus Aurelius',
    author: 'Donald Robertson',
    year: 2019,
    asin: '1250196620',
    isbn: '9781250196620',
    why: "Robertson is a cognitive-behavioral therapist who traces the lineage from Stoicism through CBT. Reads as a biography of Marcus interleaved with practical exercises drawn from his journal. The closest book to Marcus's own structure: ancient philosophy as evidence-based mental practice.",
  },
  {
    id: 'holiday-daily-stoic',
    section: 'Modern interpreters',
    title: 'The Daily Stoic',
    author: 'Ryan Holiday & Stephen Hanselman',
    year: 2016,
    asin: '0735211736',
    isbn: '9780735211735',
    why: "366 daily readings, one for each day of the year, drawn from the three core Stoics with original commentary. The book that introduced Stoicism to a modern mainstream audience. Useful as a year-long structure if you want a daily passage paired with a commentary.",
  },

  // ─── Adjacent thinkers ───────────────────────────────────────────────
  {
    id: 'frankl-mans-search-for-meaning',
    section: 'Adjacent thinkers',
    title: "Man's Search for Meaning",
    author: 'Viktor Frankl',
    year: 1946,
    asin: '0807014273',
    isbn: '9780807014271',
    why: "Frankl survived four Nazi concentration camps and wrote this in nine days afterward. The first half is a witness account; the second is a brief introduction to logotherapy. The book closest in spirit to Stoicism written in the modern era. The freedom to choose one's response is the same freedom Epictetus describes from his teacher's chair 1,800 years earlier.",
  },
  {
    id: 'boethius-consolation',
    section: 'Adjacent thinkers',
    title: 'The Consolation of Philosophy',
    author: 'Boethius',
    translator: 'Victor Watts',
    year: 524,
    asin: '0140447806',
    isbn: '9780140447804',
    why: "Written from a prison cell while Boethius awaited execution. Lady Philosophy appears to him and walks him through Fortune, the nature of the good, and the question of why the wicked prosper. A bridge text between classical Stoicism and the Christian medieval world, and one of the most-read books in the West for a thousand years.",
  },
  {
    id: 'emerson-essays',
    section: 'Adjacent thinkers',
    title: 'Self-Reliance and Other Essays',
    author: 'Ralph Waldo Emerson',
    year: 1841,
    asin: '0486277909',
    isbn: '9780486277905',
    why: "American Transcendentalism's central voice. Self-Reliance argues for the cultivation of inner authority over external conformity, a thoroughly Stoic position dressed in 19th-century New England prose. 'Trust thyself: every heart vibrates to that iron string.' Reads as a Stoic essay disguised as American philosophy.",
  },
  {
    id: 'thoreau-walden',
    section: 'Adjacent thinkers',
    title: 'Walden',
    author: 'Henry David Thoreau',
    year: 1854,
    asin: '0691096120',
    isbn: '9780691096124',
    why: "Two years and two months in a cabin Thoreau built on Emerson's land at Walden Pond. The book is a meditation on what's required to live deliberately: what a life looks like when you strip it of social performance and unnecessary acquisition. The Princeton edition with its fuller annotations is the definitive scholarly version.",
  },
  {
    id: 'montaigne-essays',
    section: 'Adjacent thinkers',
    title: 'The Complete Essays',
    author: 'Michel de Montaigne',
    translator: 'M.A. Screech',
    year: 1580,
    asin: '0140446044',
    isbn: '9780140446043',
    why: "The book that invented the personal essay. Montaigne in retreat at his château, reading his Stoics and writing himself into being one. The Screech translation is the modern scholarly standard. Skip 'On Cannibals' on first read; start with 'On Solitude' or 'That to Philosophise is to Learne to Die.'",
  },
  {
    id: 'aurelius-statue-marcus-aurelius',
    section: 'Adjacent thinkers',
    title: 'Marcus Aurelius: A Life',
    author: 'Frank McLynn',
    year: 2009,
    asin: '0306819163',
    isbn: '9780306819162',
    why: "The major modern English biography of Marcus. McLynn places Meditations in the full context of the empire Marcus actually ran: the Antonine plague, the Marcomannic wars, the difficult son who succeeded him. Reading the journal alongside the life makes both more legible.",
  },
  {
    id: 'oliver-upstream',
    section: 'Adjacent thinkers',
    title: 'Upstream: Selected Essays',
    author: 'Mary Oliver',
    year: 2016,
    asin: '0143130277',
    isbn: '9780143130277',
    why: "Essays on attention as a discipline. Oliver's subject is the visible world: a snake, a spider's web, a morning's light through trees. Reading her is practice in seeing, the kind of returning-to-the-present the Stoics called prosoche. Quiet where Marcus is austere, but the discipline beneath is the same.",
  },
  {
    id: 'dillard-pilgrim',
    section: 'Adjacent thinkers',
    title: 'Pilgrim at Tinker Creek',
    author: 'Annie Dillard',
    year: 1974,
    asin: '0061233323',
    isbn: '9780061233326',
    why: "A year of solitary observation along a creek in Virginia, written in her late twenties. Dillard pays the kind of close, sustained, sometimes terrifying attention to the natural world that Marcus pays to his own mind. The book that taught a generation of essayists what attention costs and what it earns.",
  },

  // ─── Eastern parallel ────────────────────────────────────────────────
  {
    id: 'gita-easwaran',
    section: 'Eastern parallel',
    title: 'The Bhagavad Gita',
    author: 'Anonymous (c. 200 BCE)',
    translator: 'Eknath Easwaran',
    year: -200,
    asin: '1586380192',
    isbn: '9781586380199',
    why: "An 18-chapter dialogue between the warrior Arjuna and the god Krishna, set on the eve of battle. Treats the same questions Marcus and Epictetus circle (duty, action without attachment to outcome, the discipline of the mind) from a Hindu cosmology. Easwaran's translation is the most accessible modern English rendering.",
  },
  {
    id: 'dhammapada-easwaran',
    section: 'Eastern parallel',
    title: 'The Dhammapada',
    author: 'Buddha',
    translator: 'Eknath Easwaran',
    year: -300,
    asin: '1586380206',
    isbn: '9781586380205',
    why: "423 verses, the most beloved scripture in the Theravada Buddhist canon: concise teachings attributed to the Buddha himself. The chapters on the mind, on anger, and on the self are unmistakably Stoic in their ethics: self-conquest over the conquest of others, the mind as the source of suffering and its release.",
  },
  {
    id: 'lao-tzu-mitchell',
    section: 'Eastern parallel',
    title: 'Tao Te Ching',
    author: 'Lao Tzu',
    translator: 'Stephen Mitchell',
    year: -400,
    asin: '0061142662',
    isbn: '9780061142666',
    why: "81 chapters on the Way (Tao) and its Virtue (Te). Mitchell's version is interpretive rather than literal, beloved by lay readers, suspect to Sinologists. For a stricter rendering, look at Stephen Addiss & Stanley Lombardo. Either way, the Stoic resonances on yielding, contentment, and acting without grasping are unmistakable.",
  },
  {
    id: 'analects-watson',
    section: 'Eastern parallel',
    title: 'The Analects of Confucius',
    author: 'Confucius',
    translator: 'Burton Watson',
    year: -475,
    asin: '0231141653',
    isbn: '9780231141659',
    why: "Twenty short books of fragments, conversations, and aphorisms collected by Confucius's students. The Watson translation is the most readable scholarly version. Less metaphysical than the Stoics; more concerned with how a person of integrity moves through political, family, and social life. Reads as a parallel manual on the Stoic Virtue of justice.",
  },
];
