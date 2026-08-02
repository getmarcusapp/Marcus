// The Stoics — a reference gallery for the More tab (Learn card).
//
// Purpose is a bridge, not an encyclopedia: the voices the app quotes daily ->
// the person -> the book you can actually read. The `bookIds` field joins into
// constants/library.js, which carries the live Bookshop affiliate links.
//
// ORDER IS CHRONOLOGICAL within each section, and the list screen relies on it:
// the sequence is the point, since it shows the school moving from the Greek
// founders to republican Rome to the empire. If you add someone, insert them by
// date rather than appending.
//
// FIELD NOTES (the non-obvious ones):
//
// `teaching` is a plain statement of the figure's central idea, deliberately
//   NOT wrapped in quotation marks and NOT presented as their words. Rendering
//   a paraphrase in quote styling is how apps end up attributing Epictetus's
//   dichotomy of control to Marcus Aurelius. Render it in the app's italic
//   quote voice if you like, but never with quote marks or an attribution dash.
//
// `imageNote` is the honesty field. Several of these people have no surviving
//   likeness at all, and the familiar Epictetus-with-a-crutch is an eighteenth
//   century invention. The famous "Pseudo-Seneca" bust is now thought to be
//   Hesiod, so the portrait here is the Berlin herm inscribed SENECA instead.
//   Presenting inventions as portraits alongside the genuine Marcus Aurelius
//   bust would quietly undercut the accurate-attribution claim the app makes
//   everywhere else. Always surface this line under the image.
//
// `image` is a require() or null. null means no likeness of this person exists
//   at all, and the UI renders a typographic card instead of inventing a face.
//   Marcus Aurelius reuses the bust already bundled for the premeditatio
//   meditation rather than shipping the same portrait twice.
//
// `bookIds` are curated rather than derived from an author match, so a figure
//   who wrote nothing (Cato, Zeno) can still point at the book that covers them.
//   Empty array means the UI should omit the section entirely rather than show
//   an empty shelf.

export const STOIC_SECTIONS = ['The Stoics', 'Sources & influences'];

export const STOICS = [
  // ─── The Stoics ────────────────────────────────────────────────────────────
  {
    id: 'zeno',
    section: 'The Stoics',
    name: 'Zeno of Citium',
    role: 'Founder of Stoicism',
    dates: 'c. 334–262 BC',
    summary: 'A shipwrecked merchant who founded a school on a public porch.',
    life: "Zeno came to Athens from Citium in Cyprus, a merchant of Phoenician descent, and lost his cargo at sea. The story he told afterwards was that the shipwreck was the making of him. Adrift in a strange city, he wandered into a bookseller's, read an account of Socrates, and asked where such men were to be found. The bookseller pointed at Crates the Cynic walking past.\n\nHe taught in the Stoa Poikile, the painted porch on the edge of the Athenian agora, and the school took its name from the building rather than the man. Everything he wrote is lost, including a Republic that scandalised later Stoics. What survives is the shape of the thing: that virtue alone is good, that externals are indifferent, and that a life goes well when it is lived in agreement with nature.",
    teaching: 'Virtue is the only good. Everything else, health, wealth, reputation, is material the good life is built from, not the thing itself.',
    works: ['Republic (lost)', 'On Human Nature (lost)'],
    forWhom: 'Anyone who wants to know where the whole thing started, and on what.',
    bookIds: ['sellars-stoicism', 'hadot-philosophy-as-way-of-life'],
    image: require('../assets/stoics/zeno.jpg'),
    imageNote: 'Roman bust, Farnese collection, Naples. Identification is traditional rather than certain.',
    wikipedia: 'https://en.wikipedia.org/wiki/Zeno_of_Citium',
  },
  {
    id: 'cleanthes',
    section: 'The Stoics',
    name: 'Cleanthes',
    role: 'Second head of the Stoa',
    dates: 'c. 330–230 BC',
    summary: 'A boxer who carried water by night so he could study by day.',
    life: "Cleanthes of Assos arrived in Athens with almost nothing, having been a boxer, and paid for his education by hauling water in the dark hours. His contemporaries thought him slow. He was, by his own account, a vessel that took a long time to fill and then held what it was given.\n\nHe led the school for over thirty years after Zeno's death and pushed Stoic thought toward its physics and its theology. His Hymn to Zeus is the longest continuous piece of early Stoic writing to survive, and it reads less like doctrine than like prayer. At around ninety he stopped eating, and having started, declined to start again.",
    teaching: 'The order you find in the world is not indifferent to you. Living well means falling into step with it rather than dragging against it.',
    works: ['Hymn to Zeus', 'On Pleasure (lost)'],
    forWhom: 'Anyone who suspects they are the slow vessel, and wants the argument for persisting anyway.',
    bookIds: ['sellars-stoicism'],
    image: null,
    imageNote: 'No securely identified likeness survives.',
    wikipedia: 'https://en.wikipedia.org/wiki/Cleanthes',
  },
  {
    id: 'chrysippus',
    section: 'The Stoics',
    name: 'Chrysippus',
    role: 'Systematiser of Stoicism',
    dates: 'c. 279–206 BC',
    summary: 'The logician who turned a set of convictions into a system.',
    life: "Chrysippus of Soli took over a school that was losing arguments and rebuilt its foundations. He is credited with something in the region of seven hundred books, and with a logic so far ahead of its moment that it was not properly understood again for two thousand years. The ancient verdict was blunt: if there had been no Chrysippus, there would have been no Stoa.\n\nEvery one of those books is lost. What we have is quotation, mostly by opponents, which means the most rigorous Stoic reaches us through people arguing with him. Diogenes Laertius reports that he died laughing at his own joke about a donkey eating figs, which may say more about ancient biography than about Chrysippus.",
    teaching: 'Feelings are not weather. They follow from judgements you have made, which means they can be examined, and corrected.',
    works: ['On Passions (lost)', 'Logical Investigations (fragments)'],
    forWhom: 'Anyone who wants the argument underneath the advice.',
    bookIds: ['sellars-stoicism', 'hadot-philosophy-as-way-of-life'],
    image: require('../assets/stoics/chrysippus.jpg'),
    imageNote: 'Roman copy of a Hellenistic original, British Museum. Widely accepted as a genuine likeness.',
    wikipedia: 'https://en.wikipedia.org/wiki/Chrysippus',
  },
  {
    id: 'cato',
    section: 'The Stoics',
    name: 'Cato the Younger',
    role: 'Senator and exemplar',
    dates: '95–46 BC',
    summary: 'Wrote nothing. Held up by every Stoic after him as the thing itself.',
    life: "Cato is the Stoic who left no philosophy, only a life that later Stoics pointed at when they needed to show the doctrine was livable. He walked bareheaded in the sun, went without, refused bribes in an age that assumed them, and opposed Caesar with a rigidity that his allies found exhausting and his enemies could not corrupt.\n\nAt Utica in 46 BC, with Caesar's victory complete and a pardon certain to be offered, he read Plato on the soul and then killed himself rather than accept it, on the grounds that accepting would concede Caesar the right to grant it. Seneca returns to him repeatedly as the nearest thing to a sage the tradition can name.",
    teaching: 'A principle you abandon under pressure was a preference. The test is not whether you hold it, but when.',
    works: ['None survive; he wrote no philosophy'],
    forWhom: 'Anyone testing whether any of this survives contact with real cost.',
    bookIds: ['sellars-stoicism'],
    image: require('../assets/stoics/cato.jpg'),
    imageNote: 'Bust from Volubilis, Morocco, traditionally identified as Cato. The identification is disputed.',
    wikipedia: 'https://en.wikipedia.org/wiki/Cato_the_Younger',
  },
  {
    id: 'seneca',
    section: 'The Stoics',
    name: 'Seneca',
    role: 'Statesman and writer',
    dates: 'c. 4 BC–65 AD',
    summary: "Nero's tutor, enormously rich, and the most quotable Stoic on how to live poor.",
    life: "Seneca wrote the most companionable prose in Stoicism and lived the least defensible life in it. He was exiled to Corsica for eight years, recalled to tutor the young Nero, and became for a time the most powerful man in Rome after the emperor, accumulating a fortune while writing about the worthlessness of fortune. The gap has been held against him ever since, and he held it against himself in print, which is part of why the letters still land.\n\nIn 65 AD, implicated in a conspiracy, he was ordered to die and did so slowly and in public. What survives is a hundred and twenty four letters to a friend, a set of essays including one on how little of our time we actually use, and tragedies that are stranger than any of it.",
    teaching: 'You are not short of time. You waste most of it, and then call the remainder brief.',
    works: ['Letters to Lucilius', 'On the Shortness of Life', 'On Anger'],
    forWhom: 'Anyone who has ever known exactly what to do and not done it.',
    bookIds: ['seneca-letters-campbell', 'seneca-shortness-life'],
    image: require('../assets/stoics/seneca.jpg'),
    imageNote: 'Double herm, Antikensammlung Berlin, the side inscribed SENECA. Not the "Pseudo-Seneca" bust, now generally identified as Hesiod.',
    wikipedia: 'https://en.wikipedia.org/wiki/Seneca_the_Younger',
  },
  {
    id: 'musonius-rufus',
    section: 'The Stoics',
    name: 'Musonius Rufus',
    role: 'Stoic teacher',
    dates: 'c. 30–101 AD',
    summary: "Epictetus's teacher, and the most practical of the Roman Stoics.",
    life: "Musonius taught that philosophy is not a subject but a training, and then taught accordingly: on food, on sleep, on clothing, on furniture, on how to endure cold. He was exiled by Nero to the barren island of Gyaros and went on lecturing there. His students came to him for arguments and were given exercises.\n\nHe argued, in the first century, that women should study philosophy on the same terms as men, and that they were equally capable of it. His lectures survive only because a student named Lucius wrote them down. His most famous pupil, a freed slave named Epictetus, would later say that Musonius spoke in a way that made each listener feel personally accused.",
    teaching: 'Philosophy is not something you know. It is something you practise, in what you eat, what you wear, and what you are willing to go without.',
    works: ['Lectures and Sayings (recorded by Lucius)'],
    forWhom: 'Anyone who wants Stoicism as daily discipline rather than as reading.',
    bookIds: ['musonius-rufus-lectures'],
    image: null,
    imageNote: 'No authentic likeness survives.',
    wikipedia: 'https://en.wikipedia.org/wiki/Gaius_Musonius_Rufus',
  },
  {
    id: 'epictetus',
    section: 'The Stoics',
    name: 'Epictetus',
    role: 'Stoic teacher',
    dates: 'c. 50–135 AD',
    summary: 'Born a slave, lame, and the most uncompromising teacher in the tradition.',
    life: "Epictetus was born into slavery in Phrygia and owned in Rome by a secretary of Nero's. He was permitted to study under Musonius Rufus while still enslaved. He was lame, by one ancient account because his leg was broken by his owner, and he mentioned it only as an example of something outside his control.\n\nFreed, he taught in Rome until Domitian expelled the philosophers, then founded a school at Nicopolis in western Greece. He wrote nothing at all. Everything we have was recorded by a student, Arrian, who insisted he had taken it down verbatim, and it reads like it: interruptions, sarcasm, and the sound of a man refusing to let a room off the hook.",
    teaching: 'Some things are up to you and some are not. Nearly every disturbance you feel comes from confusing the two.',
    works: ['Discourses (recorded by Arrian)', 'Enchiridion'],
    forWhom: 'Anyone who wants to be told the truth rather than comforted.',
    bookIds: ['epictetus-discourses-hard', 'epictetus-art-of-living-lebell'],
    image: require('../assets/stoics/epictetus.jpg'),
    imageNote: 'No authentic likeness survives. This is an engraving by Henri Bonnart, c. 1700, invented more than fifteen centuries after his death.',
    wikipedia: 'https://en.wikipedia.org/wiki/Epictetus',
  },
  {
    id: 'marcus-aurelius',
    section: 'The Stoics',
    name: 'Marcus Aurelius',
    role: 'Roman Emperor',
    dates: '121–180 AD',
    summary: 'The most powerful man alive, writing privately to keep himself honest.',
    life: "Marcus ruled for nineteen years through plague, near-constant war on the Danube, and the revolt of a trusted general. He had not wanted the job. The notebooks he kept were written in Greek, on campaign, for an audience of one, and were never intended to be read by anyone.\n\nThat is why they work. There is no argument being won and no reader being impressed. There is a man reminding himself, again, that the people he will meet today will be difficult, that he will die, that the only thing genuinely his is how he meets what arrives. He repeats himself constantly, which is what practice looks like from the inside.",
    teaching: 'You can step back far enough to see your circumstances at their actual size. What is left, once you do, is what you were going to do about them.',
    works: ['Meditations'],
    forWhom: 'Anyone carrying responsibility they did not ask for.',
    bookIds: ['meditations-hays', 'hadot-inner-citadel', 'robertson-roman-emperor', 'aurelius-statue-marcus-aurelius'],
    image: require('../assets/meditations/img/premeditatio-malorum.jpg'),
    imageNote: 'Bust, Capitoline Museums, Rome. A contemporary likeness; his features are among the best attested of any Roman.',
    wikipedia: 'https://en.wikipedia.org/wiki/Marcus_Aurelius',
  },

  // ─── Sources & influences ──────────────────────────────────────────────────
  // Not Stoics. Kept separate on purpose: the tradition drew on the Cynics and
  // the Pre-Socratics, and much of what we know about the early Stoa reaches us
  // through outsiders. Filing them under "The Stoics" would be inaccurate.
  {
    id: 'heraclitus',
    section: 'Sources & influences',
    name: 'Heraclitus',
    role: 'Pre-Socratic philosopher',
    dates: 'c. 535–475 BC',
    summary: 'Supplied the Stoics with their physics, two centuries before there were any.',
    life: "Heraclitus of Ephesus wrote in deliberate riddles and was called the Obscure for it. Only fragments survive, and they are the kind that lodge: that you cannot step into the same river twice, that character is fate, that the way up and the way down are one and the same.\n\nThe Stoics took two things from him and built on both. The first is the logos, an ordering rationality running through the world rather than standing outside it. The second is fire as the underlying stuff of things, which became the Stoic account of a cosmos that periodically burns down and begins again. Marcus quotes him directly, centuries later, still working on the river.",
    teaching: 'Nothing holds still, including you. Stability is not a state you reach but a way of moving.',
    works: ['On Nature (fragments only)'],
    forWhom: 'Anyone curious where the Stoic idea of a rational cosmos actually came from.',
    bookIds: [],
    image: require('../assets/stoics/heraclitus.jpg'),
    imageNote: 'No authentic likeness survives. This is Raphael, who painted Heraclitus with the face of Michelangelo, in The School of Athens, 1510.',
    wikipedia: 'https://en.wikipedia.org/wiki/Heraclitus',
  },
  {
    id: 'diogenes-of-sinope',
    section: 'Sources & influences',
    name: 'Diogenes of Sinope',
    role: 'Cynic philosopher',
    dates: 'c. 412–323 BC',
    summary: 'The Cynic whose students taught Zeno. Stoicism starts here, in a barrel.',
    life: "Diogenes lived in a large ceramic jar in Athens, owned a cup until he saw a boy drinking from his hands and threw it away, and made a career of demonstrating how little a person actually requires. Asked by Alexander the Great whether he wanted anything, he asked him to stand out of the light.\n\nThe line from him to Stoicism is direct and short: Diogenes taught Crates, and Crates taught Zeno. What the Stoics kept was the conviction that most of what people want is unnecessary and that virtue is sufficient. What they dropped was the deliberate offensiveness. Stoicism is, in one reading, Cynicism made liveable inside a society.",
    teaching: 'Almost everything you believe you need is a habit you acquired. Test it by going without.',
    works: ['None survive; anecdotes only'],
    forWhom: 'Anyone who wants to see the uncompromising version the Stoics softened.',
    bookIds: [],
    image: require('../assets/stoics/diogenes.jpg'),
    imageNote: 'Roman mosaic. No contemporary portrait exists.',
    wikipedia: 'https://en.wikipedia.org/wiki/Diogenes',
  },
  {
    id: 'cicero',
    section: 'Sources & influences',
    name: 'Cicero',
    role: 'Orator and philosopher',
    dates: '106–43 BC',
    summary: 'Not a Stoic. The reason Stoic ethics survived into the Latin West.',
    life: "Cicero belonged to the sceptical Academy and argued with the Stoics all his life, which did not stop him from becoming their most important transmitter. On Duties, written in a few months in 44 BC while Rome came apart, adapts the lost work of the Stoic Panaetius and became one of the most read books in Europe for the next sixteen centuries.\n\nHe was proscribed and killed the following year. Much of what we know about Stoic ethics, and about the arguments the school could not win, comes from a man who was reporting the other side's position in order to examine it.",
    teaching: 'What is honourable and what is advantageous are not two questions. Treating them as two is how people talk themselves into things.',
    works: ['On Duties', 'Tusculan Disputations', 'On the Nature of the Gods'],
    forWhom: 'Anyone who wants Stoic ethics applied to public life and hard choices.',
    bookIds: ['cicero-on-duties'],
    image: require('../assets/stoics/cicero.jpg'),
    imageNote: 'Bust, Capitoline Museums. A contemporary likeness.',
    wikipedia: 'https://en.wikipedia.org/wiki/Cicero',
  },
  {
    id: 'diogenes-laertius',
    section: 'Sources & influences',
    name: 'Diogenes Laertius',
    role: 'Biographer of the philosophers',
    dates: 'c. 3rd century AD',
    summary: 'An uncritical compiler, and the reason we know the early Stoics at all.',
    life: "Almost nothing is known about him, including when precisely he lived or where. What he left is Lives and Opinions of Eminent Philosophers, ten books of biography, doctrine, gossip and improbable death scenes, assembled from sources that have otherwise vanished.\n\nBook seven is on the Stoics, and it is the single most important surviving account of Zeno, Cleanthes and Chrysippus, none of whose own writing survives. He is credulous, he repeats obvious inventions, and he rarely distinguishes evidence from anecdote. He is also, for the first two centuries of Stoicism, very nearly all we have.",
    teaching: 'What reaches you from the past has been selected, often carelessly. Knowing who is telling you is part of knowing what is true.',
    works: ['Lives and Opinions of Eminent Philosophers'],
    forWhom: 'Anyone who wants to understand how thin the evidence for early Stoicism really is.',
    bookIds: ['sellars-stoicism'],
    image: null,
    imageNote: 'No likeness exists. Nothing is known of his appearance, or of his life.',
    wikipedia: 'https://en.wikipedia.org/wiki/Diogenes_La%C3%ABrtius',
  },
];

export const STOICS_BY_SECTION = STOIC_SECTIONS.map(section => ({
  section,
  items: STOICS.filter(s => s.section === section),
}));

export function getStoic(id) {
  return STOICS.find(s => s.id === id) || null;
}
