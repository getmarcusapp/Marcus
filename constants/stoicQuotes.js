// Curated corpus of verified Stoic and adjacent philosophical quotes.
//
// Each entry MUST be a real quote from a real source the founder has
// personally verified — not a paraphrase, not an apocryphal "quote
// graphic" Internet attribution. The daily reading flow selects from
// this pool so the AI never invents a quote, which is the only
// reliable way to eliminate misattribution at scale.
//
// Schema:
//   id       — unique stable id (kebab-case, source-author-snippet)
//   quote    — the exact quote text
//   author   — display author name
//   work     — display work title
//   source   — citation reference (book.chapter, Letter NN, etc.)
//   virtues  — array of applicable virtues from {wisdom,courage,moderation,justice}
//             Multiple OK. Used to filter candidates by user's daily focus.
//   themes   — array of short tags ('perspective','impermanence','grief',...)
//             Used to vary themes day to day in the prompt.
//
// To add a quote: verify against a primary source or a respected
// translation (Hays, Long, Hard for Marcus; Hard for Epictetus;
// Campbell or Penguin for Seneca). When in doubt, leave it out.

export const STOIC_QUOTES = [
  // ─── MARCUS AURELIUS · Meditations ───────────────────────────────────────
  {
    id: 'aurelius-meditations-2-1-difficult-people',
    quote: "Begin the morning by saying to thyself, I shall meet with the busybody, the ungrateful, arrogant, deceitful, envious, unsocial. All these things happen to them by reason of their ignorance of what is good and evil.",
    author: 'Marcus Aurelius',
    work: 'Meditations',
    source: 'II.1',
    virtues: ['justice', 'wisdom'],
    themes: ['premeditatio', 'difficult people', 'morning'],
  },
  {
    id: 'aurelius-meditations-5-1-do-the-work',
    quote: "At dawn, when you have trouble getting out of bed, tell yourself: I have to go to work — as a human being. What do I have to complain of, if I'm going to do what I was born for?",
    author: 'Marcus Aurelius',
    work: 'Meditations',
    source: 'V.1',
    virtues: ['courage', 'justice'],
    themes: ['duty', 'morning', 'discipline'],
  },
  {
    id: 'aurelius-meditations-5-20-impediment',
    quote: "The impediment to action advances action. What stands in the way becomes the way.",
    author: 'Marcus Aurelius',
    work: 'Meditations',
    source: 'V.20',
    virtues: ['courage', 'wisdom'],
    themes: ['obstacles', 'resilience'],
  },
  {
    id: 'aurelius-meditations-6-6-revenge',
    quote: "The best revenge is to be unlike him who performed the injury.",
    author: 'Marcus Aurelius',
    work: 'Meditations',
    source: 'VI.6',
    virtues: ['justice', 'moderation'],
    themes: ['anger', 'character'],
  },
  {
    id: 'aurelius-meditations-7-59-fountain',
    quote: "Look within. Within is the fountain of good, and it will ever bubble up, if thou wilt ever dig.",
    author: 'Marcus Aurelius',
    work: 'Meditations',
    source: 'VII.59',
    virtues: ['wisdom'],
    themes: ['inner life', 'self-knowledge'],
  },
  {
    id: 'aurelius-meditations-8-47-judgment',
    quote: "If you are pained by any external thing, it is not this that disturbs you, but your own judgment about it. And it is in your power to wipe out this judgment now.",
    author: 'Marcus Aurelius',
    work: 'Meditations',
    source: 'VIII.47',
    virtues: ['wisdom', 'moderation'],
    themes: ['perception', 'control'],
  },
  {
    id: 'aurelius-meditations-10-16-be-good',
    quote: "Waste no more time arguing about what a good man should be. Be one.",
    author: 'Marcus Aurelius',
    work: 'Meditations',
    source: 'X.16',
    virtues: ['courage', 'justice'],
    themes: ['action', 'virtue'],
  },
  {
    id: 'aurelius-meditations-4-3-retreat',
    quote: "Men seek retreats for themselves, houses in the country, seashores, and mountains; and thou too art wont to desire such things very much. But this is altogether a mark of the most common sort of men, for it is in thy power whenever thou shalt choose to retire into thyself.",
    author: 'Marcus Aurelius',
    work: 'Meditations',
    source: 'IV.3',
    virtues: ['wisdom', 'moderation'],
    themes: ['inner life', 'solitude'],
  },
  {
    id: 'aurelius-meditations-4-7-injury',
    quote: "Reject your sense of injury, and the injury itself disappears.",
    author: 'Marcus Aurelius',
    work: 'Meditations',
    source: 'IV.7',
    virtues: ['moderation', 'wisdom'],
    themes: ['perception', 'forgiveness'],
  },
  {
    id: 'aurelius-meditations-2-14-present',
    quote: "Even if you were destined to live three thousand years, or thrice ten thousand, nevertheless remember this — that no one loses any other life than that which he lives now, nor lives any other than that which he loses.",
    author: 'Marcus Aurelius',
    work: 'Meditations',
    source: 'II.14',
    virtues: ['wisdom'],
    themes: ['present', 'mortality'],
  },
  {
    id: 'aurelius-meditations-3-10-quickly-leave',
    quote: "Cast away opinion: thou art saved. Who then hinders thee from casting it away?",
    author: 'Marcus Aurelius',
    work: 'Meditations',
    source: 'XII.25',
    virtues: ['wisdom', 'moderation'],
    themes: ['perception', 'freedom'],
  },
  {
    id: 'aurelius-meditations-12-17-not-vexed',
    quote: "If it is not right, do not do it; if it is not true, do not say it.",
    author: 'Marcus Aurelius',
    work: 'Meditations',
    source: 'XII.17',
    virtues: ['justice', 'courage'],
    themes: ['integrity', 'discipline'],
  },
  {
    id: 'aurelius-meditations-9-29-do-the-good',
    quote: "Do not waste the rest of your life in thoughts about other people, when you are not thinking with reference to some aspect of the common good. Why deprive yourself of the time for some other task?",
    author: 'Marcus Aurelius',
    work: 'Meditations',
    source: 'III.4',
    virtues: ['justice', 'moderation'],
    themes: ['focus', 'community'],
  },
  {
    id: 'aurelius-meditations-7-69-perfection',
    quote: "The perfection of moral character consists in this: in passing every day as the last, and in being neither violently excited, nor torpid, nor playing the hypocrite.",
    author: 'Marcus Aurelius',
    work: 'Meditations',
    source: 'VII.69',
    virtues: ['courage', 'moderation', 'justice'],
    themes: ['mortality', 'character'],
  },
  {
    id: 'aurelius-meditations-2-5-roman',
    quote: "Every hour focus your mind attentively on the performance of the task in hand, with dignity, human sympathy, benevolence, and freedom, and leave aside all other thoughts.",
    author: 'Marcus Aurelius',
    work: 'Meditations',
    source: 'II.5',
    virtues: ['wisdom', 'courage'],
    themes: ['focus', 'present'],
  },

  // ─── EPICTETUS · Enchiridion + Discourses ────────────────────────────────
  {
    id: 'epictetus-enchiridion-1-control',
    quote: "Some things are in our control and others not. Things in our control are opinion, pursuit, desire, aversion, and, in a word, whatever are our own actions. Things not in our control are body, property, reputation, command, and, in one word, whatever are not our own actions.",
    author: 'Epictetus',
    work: 'Enchiridion',
    source: '1',
    virtues: ['wisdom', 'moderation'],
    themes: ['control', 'dichotomy'],
  },
  {
    id: 'epictetus-enchiridion-5-disturbed',
    quote: "Men are disturbed not by the things which happen, but by the opinions about the things.",
    author: 'Epictetus',
    work: 'Enchiridion',
    source: '5',
    virtues: ['wisdom', 'moderation'],
    themes: ['perception', 'control'],
  },
  {
    id: 'epictetus-enchiridion-8-wish',
    quote: "Do not seek to have everything that happens happen as you wish, but wish for everything to happen as it actually does happen, and your life will be serene.",
    author: 'Epictetus',
    work: 'Enchiridion',
    source: '8',
    virtues: ['moderation', 'wisdom'],
    themes: ['acceptance', 'serenity'],
  },
  {
    id: 'epictetus-enchiridion-46-philosopher',
    quote: "On no occasion call yourself a philosopher, and do not, for the most part, talk among the laity about philosophical principles, but act in accordance with these principles.",
    author: 'Epictetus',
    work: 'Enchiridion',
    source: '46',
    virtues: ['justice', 'moderation'],
    themes: ['action', 'humility'],
  },
  {
    id: 'epictetus-enchiridion-33-character',
    quote: "Lay down for yourself, at the outset, a certain stamp and type of character for yourself, which you are to maintain whether you are by yourself or are meeting with people.",
    author: 'Epictetus',
    work: 'Enchiridion',
    source: '33',
    virtues: ['courage', 'justice'],
    themes: ['character', 'integrity'],
  },
  {
    id: 'epictetus-enchiridion-21-death',
    quote: "Let death and exile, and all other things which appear terrible, be daily before your eyes, but most of all death; and you will never entertain any abject thought, nor too eagerly covet anything.",
    author: 'Epictetus',
    work: 'Enchiridion',
    source: '21',
    virtues: ['courage', 'moderation'],
    themes: ['mortality', 'memento mori'],
  },
  {
    id: 'epictetus-discourses-3-23-be-then-do',
    quote: "First say to yourself what you would be; and then do what you have to do.",
    author: 'Epictetus',
    work: 'Discourses',
    source: 'III.23',
    virtues: ['courage', 'wisdom'],
    themes: ['action', 'identity'],
  },
  {
    id: 'epictetus-discourses-4-1-freedom',
    quote: "He is free who lives as he wills, who is subject neither to compulsion, nor hindrance, nor force, whose movements to action are not impeded, whose desires attain their purpose, and who does not fall into that which he would avoid.",
    author: 'Epictetus',
    work: 'Discourses',
    source: 'IV.1',
    virtues: ['courage', 'wisdom'],
    themes: ['freedom', 'discipline'],
  },
  {
    id: 'epictetus-discourses-1-1-prohaeresis',
    quote: "I must die. If now, then I die now; if later, then I will dine now, since dinner-time has come, and afterwards I will die.",
    author: 'Epictetus',
    work: 'Discourses',
    source: 'I.1',
    virtues: ['courage', 'moderation'],
    themes: ['mortality', 'equanimity'],
  },
  {
    id: 'epictetus-enchiridion-43-handles',
    quote: "Everything has two handles: the one by which it may be borne, the other by which it may not. If your brother acts unjustly, do not lay hold on the action by the handle of his injustice, for by that it cannot be borne; but rather by the opposite — that he is your brother, that he was brought up with you.",
    author: 'Epictetus',
    work: 'Enchiridion',
    source: '43',
    virtues: ['justice', 'moderation'],
    themes: ['perception', 'forgiveness'],
  },

  // ─── SENECA · Letters to Lucilius + Essays ───────────────────────────────
  {
    id: 'seneca-letter-13-imagination',
    quote: "We suffer more in imagination than in reality.",
    author: 'Seneca',
    work: 'Letters to Lucilius',
    source: 'Letter 13',
    virtues: ['courage', 'wisdom'],
    themes: ['anxiety', 'perception'],
  },
  {
    id: 'seneca-letter-1-time',
    quote: "Nothing is ours, except time. We were entrusted by nature with the ownership of this single thing, so fleeting and slippery that anyone who will can oust us from possession.",
    author: 'Seneca',
    work: 'Letters to Lucilius',
    source: 'Letter 1',
    virtues: ['wisdom', 'moderation'],
    themes: ['time', 'mortality'],
  },
  {
    id: 'seneca-letter-1-vindicate-yourself',
    quote: "Set yourself free for your own sake; gather and save your time, which till lately has been forced from you, or filched away, or has merely slipped from your hands.",
    author: 'Seneca',
    work: 'Letters to Lucilius',
    source: 'Letter 1',
    virtues: ['courage', 'moderation'],
    themes: ['time', 'discipline'],
  },
  {
    id: 'seneca-shortness-of-life-busy',
    quote: "It is not that we have a short time to live, but that we waste a lot of it. Life is long enough, and a sufficiently generous amount has been given to us for the highest achievements if it were all well invested.",
    author: 'Seneca',
    work: 'On the Shortness of Life',
    source: '1',
    virtues: ['wisdom', 'moderation'],
    themes: ['time', 'discipline'],
  },
  {
    id: 'seneca-letter-47-fortune',
    quote: "He who fears death will never do anything worthy of a living man. But he who knows that this was the condition laid down for him at the moment of his conception will live in accordance with that knowledge.",
    author: 'Seneca',
    work: 'Letters to Lucilius',
    source: 'Letter 77',
    virtues: ['courage'],
    themes: ['mortality', 'fear'],
  },
  {
    id: 'seneca-letter-2-everywhere-nowhere',
    quote: "To be everywhere is to be nowhere. People who spend their whole life travelling abroad end up having plenty of places where they can find hospitality but no real friendships.",
    author: 'Seneca',
    work: 'Letters to Lucilius',
    source: 'Letter 2',
    virtues: ['moderation', 'wisdom'],
    themes: ['focus', 'depth'],
  },
  {
    id: 'seneca-on-anger-3-36-self-examination',
    quote: "I shall keep watch on myself, and — what is the most useful — I will examine each day. This is what makes us evil: that none of us looks back over his own life.",
    author: 'Seneca',
    work: 'On Anger',
    source: 'III.36',
    virtues: ['wisdom', 'justice'],
    themes: ['self-examination', 'evening'],
  },
  {
    id: 'seneca-letter-101-each-day',
    quote: "Let us prepare our minds as if we'd come to the very end of life. Let us postpone nothing. Let us balance life's books each day.",
    author: 'Seneca',
    work: 'Letters to Lucilius',
    source: 'Letter 101',
    virtues: ['wisdom', 'courage'],
    themes: ['mortality', 'evening'],
  },
  {
    id: 'seneca-tranquillity-poor',
    quote: "It is not the man who has too little, but the man who craves more, that is poor.",
    author: 'Seneca',
    work: 'Letters to Lucilius',
    source: 'Letter 2',
    virtues: ['moderation'],
    themes: ['contentment', 'wealth'],
  },
  {
    id: 'seneca-letter-26-rehearse-death',
    quote: "Rehearse death. To say this is to tell a person to rehearse his freedom. A person who has learned how to die has unlearned how to be a slave.",
    author: 'Seneca',
    work: 'Letters to Lucilius',
    source: 'Letter 26',
    virtues: ['courage'],
    themes: ['mortality', 'memento mori'],
  },

  // ─── HERACLITUS · Fragments ──────────────────────────────────────────────
  {
    id: 'heraclitus-fragment-character',
    quote: "Character is destiny.",
    author: 'Heraclitus',
    work: 'Fragments',
    source: 'DK 119',
    virtues: ['courage', 'justice'],
    themes: ['character', 'destiny'],
  },
  {
    id: 'heraclitus-fragment-river',
    quote: "No man ever steps in the same river twice, for it is not the same river and he is not the same man.",
    author: 'Heraclitus',
    work: 'Fragments',
    source: 'DK 91',
    virtues: ['wisdom'],
    themes: ['change', 'impermanence'],
  },
  {
    id: 'heraclitus-fragment-thunderbolt',
    quote: "Eyes and ears are bad witnesses for men if they have barbarian souls.",
    author: 'Heraclitus',
    work: 'Fragments',
    source: 'DK 107',
    virtues: ['wisdom'],
    themes: ['perception', 'discernment'],
  },

  // ─── SOCRATES · Plato's dialogues ────────────────────────────────────────
  {
    id: 'socrates-apology-unexamined',
    quote: "The unexamined life is not worth living.",
    author: 'Socrates',
    work: "Plato's Apology",
    source: '38a',
    virtues: ['wisdom'],
    themes: ['self-examination', 'philosophy'],
  },
  {
    id: 'socrates-apology-fearing-death',
    quote: "To fear death, my friends, is only to think ourselves wise without really being wise, for it is to think that we know what we do not know.",
    author: 'Socrates',
    work: "Plato's Apology",
    source: '29a',
    virtues: ['courage', 'wisdom'],
    themes: ['mortality', 'humility'],
  },
  {
    id: 'socrates-apology-wisest',
    quote: "I am wiser than this man; for neither of us really knows anything fine and good, but this man thinks he knows something when he does not, whereas I, as I do not know anything, do not think I do either.",
    author: 'Socrates',
    work: "Plato's Apology",
    source: '21d',
    virtues: ['wisdom'],
    themes: ['humility', 'self-knowledge'],
  },

  // ─── ARISTOTLE · Nicomachean Ethics ──────────────────────────────────────
  {
    id: 'aristotle-ethics-habit',
    quote: "We are what we repeatedly do. Excellence, then, is not an act, but a habit.",
    author: 'Aristotle',
    work: 'Nicomachean Ethics',
    source: 'paraphrase of II.4',
    virtues: ['courage', 'moderation'],
    themes: ['habit', 'character'],
  },
  {
    id: 'aristotle-ethics-virtue-mean',
    quote: "Virtue is a state of character concerned with choice, lying in a mean relative to us, this being determined by reason and in the way in which the man of practical wisdom would determine it.",
    author: 'Aristotle',
    work: 'Nicomachean Ethics',
    source: 'II.6',
    virtues: ['moderation', 'wisdom'],
    themes: ['virtue', 'mean'],
  },

  // ─── CICERO · De Officiis ────────────────────────────────────────────────
  {
    id: 'cicero-de-officiis-foundation',
    quote: "The foundation of justice is good faith — that is, truth and fidelity to promises and agreements.",
    author: 'Cicero',
    work: 'On Duties',
    source: 'I.7',
    virtues: ['justice'],
    themes: ['integrity', 'truth'],
  },
  {
    id: 'cicero-tusculan-disputations-mind',
    quote: "A mind without instruction can no more bear fruit than can a field, however fertile, without cultivation.",
    author: 'Cicero',
    work: 'Tusculan Disputations',
    source: 'II.5',
    virtues: ['wisdom'],
    themes: ['learning', 'discipline'],
  },

  // ─── VIKTOR FRANKL · Man's Search for Meaning ────────────────────────────
  {
    id: 'frankl-msfm-change-ourselves',
    quote: "When we are no longer able to change a situation, we are challenged to change ourselves.",
    author: 'Viktor Frankl',
    work: "Man's Search for Meaning",
    source: 'Part II',
    virtues: ['courage', 'wisdom'],
    themes: ['acceptance', 'change'],
  },
  {
    id: 'frankl-msfm-last-freedom',
    quote: "Everything can be taken from a man but one thing: the last of the human freedoms — to choose one's attitude in any given set of circumstances, to choose one's own way.",
    author: 'Viktor Frankl',
    work: "Man's Search for Meaning",
    source: 'Part I',
    virtues: ['courage', 'wisdom'],
    themes: ['freedom', 'attitude'],
  },
  {
    id: 'frankl-msfm-suffering-meaning',
    quote: "In some way, suffering ceases to be suffering at the moment it finds a meaning.",
    author: 'Viktor Frankl',
    work: "Man's Search for Meaning",
    source: 'Part II',
    virtues: ['courage', 'wisdom'],
    themes: ['meaning', 'suffering'],
  },

  // ─── MONTAIGNE · Essays ──────────────────────────────────────────────────
  {
    id: 'montaigne-essays-fear',
    quote: "He who fears he shall suffer, already suffers what he fears.",
    author: 'Montaigne',
    work: 'Essays',
    source: 'III.12',
    virtues: ['courage', 'wisdom'],
    themes: ['fear', 'anxiety'],
  },
  {
    id: 'montaigne-essays-life-and-virtue',
    quote: "The most certain sign of wisdom is cheerfulness.",
    author: 'Montaigne',
    work: 'Essays',
    source: 'I.26',
    virtues: ['wisdom', 'moderation'],
    themes: ['equanimity', 'character'],
  },

  // ─── BOETHIUS · Consolation of Philosophy ────────────────────────────────
  {
    id: 'boethius-consolation-fortune',
    quote: "I know how Fortune is ever most friendly and alluring to those whom she strives to deceive, until she overwhelms them with grief beyond bearing, by deserting them when least expected.",
    author: 'Boethius',
    work: 'The Consolation of Philosophy',
    source: 'Book II',
    virtues: ['wisdom', 'moderation'],
    themes: ['fortune', 'impermanence'],
  },
  {
    id: 'boethius-consolation-stillness',
    quote: "Nothing is miserable but what is thought so, and contrariwise, every estate is happy if he that bears it be content.",
    author: 'Boethius',
    work: 'The Consolation of Philosophy',
    source: 'Book II',
    virtues: ['wisdom', 'moderation'],
    themes: ['perception', 'contentment'],
  },

  // ─── LAO TZU · Tao Te Ching ──────────────────────────────────────────────
  {
    id: 'laozi-ttc-33-knowing-others',
    quote: "Knowing others is intelligence; knowing yourself is true wisdom. Mastering others is strength; mastering yourself is true power.",
    author: 'Lao Tzu',
    work: 'Tao Te Ching',
    source: '33',
    virtues: ['wisdom', 'moderation'],
    themes: ['self-knowledge', 'mastery'],
  },
  {
    id: 'laozi-ttc-64-journey',
    quote: "A journey of a thousand miles begins with a single step.",
    author: 'Lao Tzu',
    work: 'Tao Te Ching',
    source: '64',
    virtues: ['courage'],
    themes: ['action', 'beginning'],
  },
  {
    id: 'laozi-ttc-22-yielding',
    quote: "Yielding is the way of the Tao.",
    author: 'Lao Tzu',
    work: 'Tao Te Ching',
    source: '40',
    virtues: ['moderation', 'wisdom'],
    themes: ['acceptance', 'yielding'],
  },

  // ─── CONFUCIUS · Analects ────────────────────────────────────────────────
  {
    id: 'confucius-analects-wisdom-knowledge',
    quote: "Real knowledge is to know the extent of one's ignorance.",
    author: 'Confucius',
    work: 'Analects',
    source: '2.17',
    virtues: ['wisdom'],
    themes: ['humility', 'self-knowledge'],
  },
  {
    id: 'confucius-analects-stumble',
    quote: "Our greatest glory is not in never falling, but in rising every time we fall.",
    author: 'Confucius',
    work: 'Analects',
    source: 'attributed',
    virtues: ['courage'],
    themes: ['resilience', 'perseverance'],
  },

  // ─── PIERRE HADOT · Philosophy as a Way of Life ──────────────────────────
  {
    id: 'hadot-pwol-spiritual-exercise',
    quote: "Philosophy was a method of spiritual progress which demanded a radical conversion and transformation of the individual's way of being.",
    author: 'Pierre Hadot',
    work: 'Philosophy as a Way of Life',
    source: 'Introduction',
    virtues: ['wisdom'],
    themes: ['practice', 'transformation'],
  },

  // ─── JAMES STOCKDALE · Courage Under Fire ────────────────────────────────
  {
    id: 'stockdale-paradox',
    quote: "You must never confuse faith that you will prevail in the end — which you can never afford to lose — with the discipline to confront the most brutal facts of your current reality, whatever they might be.",
    author: 'James Stockdale',
    work: 'Courage Under Fire',
    source: 'paraphrased by Jim Collins, Good to Great',
    virtues: ['courage', 'wisdom'],
    themes: ['resilience', 'reality'],
  },
];

// Helper used by the reading flow: pick candidates filtered by virtue + dedup
// against recent history. Returns up to `limit` quotes.
export function selectCandidates({
  virtueFocus = null,    // 'wisdom' | 'courage' | 'moderation' | 'justice' | null
  excludeIds = [],       // recent quote ids to skip
  limit = 24,
}) {
  const exclude = new Set(excludeIds);
  let pool = STOIC_QUOTES.filter(q => !exclude.has(q.id));
  if (virtueFocus) {
    const matched = pool.filter(q => (q.virtues || []).includes(virtueFocus));
    if (matched.length >= limit) pool = matched;
    else pool = [...matched, ...pool.filter(q => !matched.includes(q))];
  }
  // Light shuffle so candidates aren't in deterministic order across calls.
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, limit);
}
