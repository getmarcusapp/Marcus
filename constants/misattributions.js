// Misattributed "Stoic" quotes — the data behind /misattributed-stoic-quotes.
//
// EVERY ENTRY HERE IS A PUBLIC ACCUSATION THAT SOMEONE ELSE GOT IT WRONG, which
// sets the bar: if this page is itself sloppy, it destroys the exact credibility
// it exists to build. Two rules follow from that.
//
// 1. `actual` is only filled in when the real source is genuinely known. When a
//    line simply has no ancient source but its modern origin is murky, `actual`
//    stays null and the entry says so. "This is not in Seneca" is a defensible
//    claim even when "who wrote it then" is not.
//
// 2. `confidence` is 'certain' or 'strong'. Anything weaker does not belong on
//    the page at all. 'certain' means the real source is documented and
//    checkable (a film, a song, a dated book). 'strong' means the attribution is
//    well established in scholarship but rests on a judgment rather than a
//    receipt.
//
// This list came out of auditing Marcus's own quote library in August 2026,
// which is why the tone is confession rather than accusation: 55 of these were
// ours. See constants/quotes.js.

export const MISATTRIBUTIONS = [
  // ─── Not ancient at all ────────────────────────────────────────────────
  {
    id: 'echoes-in-eternity',
    text: 'What we do in life echoes in eternity.',
    credited: 'Marcus Aurelius',
    actual: 'Gladiator (2000), screenplay by David Franzoni, John Logan and William Nicholson',
    confidence: 'certain',
    group: 'modern',
    note: 'Spoken by Russell Crowe as Maximus, in a film whose emperor is Marcus Aurelius. That proximity is why it spread. It appears nowhere in the Meditations, in any translation, because it was written for the screen in the late 1990s.',
  },
  {
    id: 'closing-time',
    text: "Every new beginning comes from some other beginning's end.",
    credited: 'Seneca',
    actual: 'Semisonic, "Closing Time" (1998), written by Dan Wilson',
    confidence: 'certain',
    group: 'modern',
    note: 'The closing line of a song about a bar shutting for the night. Dan Wilson has said he was also writing about his daughter being born. It is not a translation of anything.',
  },
  {
    id: 'we-are-what-we-repeatedly-do',
    text: 'We are what we repeatedly do. Excellence, then, is not an act, but a habit.',
    credited: 'Aristotle',
    actual: 'Will Durant, The Story of Philosophy (1926)',
    confidence: 'certain',
    group: 'modern',
    note: 'Durant was summarizing Aristotle, and said so. The sentence is his own compression of a passage in the Nicomachean Ethics about virtue arising from habituation. It is the most quoted thing Aristotle never wrote.',
  },
  {
    id: 'secret-of-change',
    text: 'The secret of change is to focus all of your energy not on fighting the old, but on building the new.',
    credited: 'Socrates',
    actual: 'Dan Millman, Way of the Peaceful Warrior (1980)',
    confidence: 'certain',
    group: 'modern',
    note: 'Spoken by a character in a modern novel, in a book whose narrator is taught by a mentor figure. Socrates left no writings at all, which is worth remembering every time a tidy aphorism is credited to him.',
  },
  {
    id: 'cultivate-garden',
    text: "One must cultivate one's garden.",
    credited: 'Seneca',
    actual: 'Voltaire, Candide (1759)',
    confidence: 'certain',
    group: 'modern',
    note: 'The last line of Candide, and the conclusion of an argument against exactly the kind of providential optimism the Stoics held. Attributing it to a Stoic inverts its point.',
  },
  {
    id: 'fighting-a-hard-battle',
    text: 'Be kind, for everyone you meet is fighting a hard battle.',
    credited: 'Seneca, sometimes Plato',
    actual: 'Ian Maclaren (pen name of John Watson), 1897',
    confidence: 'certain',
    group: 'modern',
    note: 'A Scottish minister writing a Christmas message. The sentiment is compatible with Stoic oikeiosis, which is probably why it migrated, but the words are Victorian.',
  },
  {
    id: 'end-not-means',
    text: 'Treat yourself and others as an end, not as a means to an end.',
    credited: 'Seneca',
    actual: 'Immanuel Kant, Groundwork of the Metaphysics of Morals (1785)',
    confidence: 'certain',
    group: 'modern',
    note: 'The second formulation of the categorical imperative. Kantian deontology is a different ethical system from Stoic virtue ethics, not a restatement of it.',
  },
  {
    id: 'courage-first-quality',
    text: 'Courage is the first of human qualities because it is the quality which guarantees the others.',
    credited: 'Aristotle',
    actual: 'Winston Churchill',
    confidence: 'strong',
    group: 'modern',
    note: 'Churchill, writing in the twentieth century about courage as the enabling virtue. Aristotle does treat courage in the Ethics, which is how the swap survives a glance.',
  },
  {
    id: 'world-turns-aside',
    text: 'The world turns aside to let any man pass who knows where he is going.',
    credited: 'Epictetus',
    actual: 'David Starr Jordan, early twentieth century',
    confidence: 'strong',
    group: 'modern',
    note: 'An American academic, not a Roman slave. The cadence is motivational-poster English, which is usually the tell.',
  },

  {
    id: 'precious-privilege',
    text: 'When you arise in the morning, think of what a precious privilege it is to be alive, to breathe, to think, to enjoy, to love.',
    credited: 'Marcus Aurelius',
    actual: 'Elbert Hubbard, The Fra: For Philistines and Roycrofters, volume 12 (1913)',
    confidence: 'strong',
    group: 'modern',
    note: 'An American arts-and-crafts publisher writing in 1913. The register is the tell: Marcus does address himself at dawn, in Meditations V.1, but to argue himself out of staying in bed rather than to celebrate breathing. Traced by Gregory Sadler.',
  },
  {
    id: 'ranks-of-the-insane',
    text: 'The object of life is not to be on the side of the majority, but to escape finding oneself in the ranks of the insane.',
    credited: 'Marcus Aurelius',
    actual: 'Leo Tolstoy, Bethink Yourselves! (1904)',
    confidence: 'strong',
    group: 'modern',
    note: 'Tolstoy, in an anti-war essay written seventeen centuries after Marcus. It circulates so widely under the wrong name that it appears in printed collections. Traced by Gregory Sadler.',
  },
  {
    id: 'everything-we-hear-is-an-opinion',
    text: 'Everything we hear is an opinion, not a fact. Everything we see is a perspective, not the truth.',
    credited: 'Marcus Aurelius',
    actual: null,
    confidence: 'strong',
    group: 'no-source',
    note: 'No translation of the Meditations contains this. It appears to be a modern reworking of Meditations II.15, which is four words long and is Marcus quoting Monimus the Cynic: everything is what you suppose it to be. The rewrite turns a remark about judgment into a claim about the unreliability of perception, which is not a Stoic position. Identified by Thomas Colligan writing for Modern Stoicism.',
  },

  // ─── Ancient, but the wrong ancient ────────────────────────────────────
  {
    id: 'know-thyself',
    text: 'Know thyself.',
    credited: 'Socrates',
    actual: 'Inscribed at the Temple of Apollo at Delphi',
    confidence: 'certain',
    group: 'wrong-ancient',
    note: 'A Delphic maxim that predates Socrates and that he quoted rather than coined. Crediting it to him turns a piece of shared Greek religious furniture into one man\'s epigram.',
  },
  {
    id: 'character-is-destiny',
    text: "A person's character is their destiny.",
    credited: 'Epictetus',
    actual: 'Heraclitus, ethos anthropoi daimon',
    confidence: 'strong',
    group: 'wrong-ancient',
    note: 'Heraclitus predates Stoicism and heavily influenced it, so the idea is genuinely in the family. The line is still his.',
  },
  {
    id: 'fortune-favours-the-bold',
    text: 'Fortune favours the bold.',
    credited: 'Seneca',
    actual: 'Virgil, Aeneid X.284',
    confidence: 'certain',
    group: 'wrong-ancient',
    note: 'Audentis Fortuna iuvat. Roman, and contemporary-ish with Seneca, but epic poetry rather than philosophy.',
  },
  {
    id: 'moderate-man',
    text: 'The mark of a moderate man is freedom from his own ideas.',
    credited: 'Marcus Aurelius',
    actual: 'Tao Te Ching',
    confidence: 'strong',
    group: 'wrong-ancient',
    note: 'A different continent and a different tradition. The overlap between Stoic and Taoist acceptance is real and is why the misfiling goes unnoticed.',
  },
  {
    id: 'words-will-follow',
    text: 'Grasp the subject, the words will follow.',
    credited: 'Cato the Younger, the Stoic',
    actual: 'Cato the Elder, his great-grandfather',
    confidence: 'strong',
    group: 'wrong-ancient',
    note: 'Rem tene, verba sequentur. Two different men, four generations apart, and only the younger was a Stoic. The name alone does the damage here.',
  },
  {
    id: 'problem-of-evil',
    text: 'Either God wants to abolish evil and cannot, or he can but does not want to.',
    credited: 'Epictetus',
    actual: 'The Epicurean paradox, reported by Lactantius',
    confidence: 'strong',
    group: 'wrong-ancient',
    note: 'An argument against providence, preserved by a Christian writer quoting Epicureans. The Stoics believed in a providential cosmos, so this is close to the opposite of what Epictetus taught.',
  },

  // ─── No source, whoever said it ────────────────────────────────────────
  {
    id: 'not-what-happens',
    text: "It's not what happens to you, but how you react to it that matters.",
    credited: 'Epictetus',
    actual: null,
    confidence: 'certain',
    group: 'no-source',
    note: 'This is a modern paraphrase of Enchiridion 5, not a translation of it. What Epictetus actually wrote is: men are disturbed not by things, but by the opinions they hold about things. The paraphrase is serviceable. It is just not a quotation, and the difference matters when it is set in quote marks with his name under it.',
  },
  {
    id: 'barrenness-busy-life',
    text: 'Beware the barrenness of a busy life.',
    credited: 'Socrates',
    actual: null,
    confidence: 'strong',
    group: 'no-source',
    note: 'No ancient source. It reads as twentieth-century English and appears in no Platonic dialogue, which is the only place a saying of Socrates could come from.',
  },
  {
    id: 'moderation-including-moderation',
    text: 'Everything in moderation, including moderation.',
    credited: 'Marcus Aurelius',
    actual: null,
    confidence: 'strong',
    group: 'no-source',
    note: 'A modern joke about the Greek maxim, not the maxim. The self-referential twist is the giveaway: it is a punchline that requires the original to already be a cliche.',
  },
  {
    id: 'luck-preparation',
    text: 'Luck is what happens when preparation meets opportunity.',
    credited: 'Seneca',
    actual: null,
    confidence: 'strong',
    group: 'no-source',
    note: 'Widely credited to Seneca and traceable to no letter or essay. Twentieth-century American in origin, though which speaker first said it is genuinely disputed, which is why no name is claimed here.',
  },
  {
    id: 'gem-friction',
    text: 'A gem cannot be polished without friction, nor a man perfected without trials.',
    credited: 'Seneca',
    actual: null,
    confidence: 'strong',
    group: 'no-source',
    note: 'Circulates as both Seneca and Confucius, which on its own is a warning sign: a line claimed by two traditions a continent apart usually belongs to neither.',
  },
];

export const GROUPS = [
  {
    key: 'modern',
    title: 'Not ancient at all',
    intro: 'These were written in the last three hundred years, several within living memory. One is from a film about Marcus Aurelius, which is how it acquired his name.',
  },
  {
    key: 'wrong-ancient',
    title: 'Ancient, but the wrong ancient',
    intro: 'Real quotations from real sources, filed under the wrong person. These are the hardest to catch, because nothing about the language gives them away.',
  },
  {
    key: 'no-source',
    title: 'No source, whoever said it',
    intro: 'No surviving text contains these. Some are loose paraphrases that hardened into quotations; some appear to have been invented whole. Where the real origin is genuinely unclear, this page says so rather than guessing.',
  },
];
