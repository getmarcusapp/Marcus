/**
 * Scripts for long-form videos, rendered at 16:9 by scripts/longform.js.
 *
 * Same segment rules as scripts/shorts-scripts.js, because the claim is the
 * same: a { quote } must be its misattribution entry's text word for word,
 * and a { payoff } excerpt must appear verbatim in constants/stoicQuotes.js.
 * The difference is structure. A long video is a cold open, numbered
 * chapters and a close, and each chapter names the misattribution it is
 * about (`entry`), so its quote is checked against that entry.
 *
 *   cold:     segments before the first chapter
 *   titleBefore: true on a cold-open segment puts the title card before it
 *   chapters: [{ n, entry, painting, segments }]
 *   close:    segments after the last chapter
 *
 * Visuals work as in the shorts: { art }, { gen }, { still }, or a list. A
 * segment with no visual shows its chapter's painting. Generated clips are
 * 16:9, with no legible text and no faces; stills are the only way to show
 * words, and must be read letter by letter before posting.
 *
 * Narration is not burned in. Long-form viewers expect clean footage, so the
 * spoken words go to an .srt file for YouTube's captions instead, timed from
 * the voice itself.
 */
const NEG_MODERN = 'modern objects, plastic, electric light, cars, phones';

const LONGFORM = [
  {
    id: 'fake-stoic-quotes',
    title: '10 Famous Stoic Quotes They Never Said',
    painting: 'premeditatio-malorum',
    music: 'Sparse, dark cinematic underscore for a documentary about ancient Rome and philosophy. ' +
      'A low sustained cello drone, soft felt piano, distant air, occasional low strings. Slow, contemplative, ' +
      'restrained, with gentle movement so it does not feel static over several minutes. No drums, no vocals, ' +
      'no melody that competes with speech. Begins immediately at full presence: no fade-in, no build.',
    cold: [
      { quote: 'What we do in life echoes in eternity.', entry: 'echoes-in-eternity',
        visual: { still: 'Wide photograph of a gritty modern gym at dawn. On a dark painted concrete wall, large ' +
          'hand-painted white serif lettering reads exactly: "WHAT WE DO IN LIFE ECHOES IN ETERNITY" and beneath ' +
          'it, smaller: "— MARCUS AURELIUS". Squat rack and iron plates in the foreground, chalk dust in warm ' +
          'window light. Photoreal, moody, shallow depth of field. No people.', zoom: 'in', focus: 0.4 } },
      // Names him. The quote card shows the attribution but the voice never
      // said it, so "He never said it" had no one to refer to.
      { say: "It's credited to Marcus Aurelius on gym walls, on tattoos, and on a thousand motivational posters.",
        visual: { gen: 'Slow dolly along a dim, empty modern gym at dawn, iron plates and a barbell on the floor, ' +
          'chalk dust floating in shafts of window light. Photoreal, moody, no people.' } },
      { say: 'He never said it.', pauseBefore: 0.3,
        visual: { art: 'premeditatio-malorum', zoom: 'tight', focus: 0.45 } },
      { say: 'And he is not the only one. Seneca gets credit for song lyrics. Epictetus gets credit for self-help ' +
          'books he died eighteen centuries too early to read.', titleBefore: true,
        visual: [
          { gen: 'A dusty vinyl record spinning slowly on an old turntable in a dim room, warm lamplight, shallow ' +
            'depth of field. Photoreal, no people.' },
          // Spines turned away: the first take printed garbled titles on them.
          { gen: 'A tall stack of worn paperback books on a wooden table, seen from the page edges so only the ' +
            'cream paper edges face the camera, beside a small ancient Roman terracotta oil lamp, dust in the ' +
            'light. Slow push in. Photoreal, no people.', negative: 'book spines, titles, covers, lettering' },
        ] },
      { say: "So today: ten famous Stoic quotes, where each one actually came from, and what the real Stoics " +
          "wrote instead. At least one of these is probably on your wall.",
        visual: { gen: 'Candlelit ancient library, rows of rolled papyrus scrolls in wooden pigeonholes, dust ' +
          'drifting in a beam of light. Slow lateral move. Photoreal, warm, no people.', negative: NEG_MODERN } },
      { say: "The full source trail for every one is linked in the description, so you don't have to take my " +
          "word for any of it.",
        visual: { gen: 'Close-up of an old brass magnifying glass moving slowly across the surface of aged, ' +
          'blank parchment on a wooden desk, warm light. Photoreal, no people, no writing.' } },
    ],
    chapters: [
      {
        n: 10, entry: 'luck-preparation', painting: 'dichotomy-of-control',
        segments: [
          { quote: 'Luck is what happens when preparation meets opportunity.',
            visual: { art: 'dichotomy-of-control', zoom: 'in', focus: 0.3 } },
          { say: "You'll find this under Seneca's name in business books, locker rooms, and a very large number " +
              'of LinkedIn posts.',
            visual: { gen: 'An empty modern locker room at night, a single light on, a towel over a bench, ' +
              'steam drifting. Slow push in. Photoreal, no people, no text.' } },
          { say: 'Now go looking for it. Seneca left us one hundred and twenty-four letters, a shelf of essays, ' +
              "and a handful of tragedies. It isn't in any of them.",
            visual: { gen: 'Hands in shadow unrolling an ancient papyrus scroll on a wooden table, lit by a small ' +
              'flat terracotta Roman oil lamp with one flame at its spout, the papyrus blank and aged. Close-up, ' +
              'slow. Photoreal, no faces.',
              negative: NEG_MODERN + ', lantern, glass lantern, hurricane lamp, candle' } },
          { say: "The line is twentieth-century American. Who said it first is genuinely disputed, so I won't " +
              'pin it on anyone.',
            visual: { gen: 'A 1950s American office at night, an empty wooden desk with a brass desk lamp and a ' +
              'typewriter, venetian-blind shadows across the wall. Slow push in. Photoreal, no people.' } },
          { say: "But that's the first pattern on this list. When a good sentence has no author, a famous name " +
              'moves in, because a famous name makes a sentence feel true.',
            visual: { art: 'dichotomy-of-control', zoom: 'out', focus: 0.3 } },
        ],
      },
      {
        n: 9, entry: 'circumstances-reveal-the-man', painting: 'view-from-above',
        segments: [
          { quote: 'Circumstances do not make the man, they only reveal him to himself.',
            visual: { art: 'view-from-above', zoom: 'in', focus: 0.3 } },
          { say: 'Epictetus was born a slave in the first century, and taught philosophy in Greece.',
            visual: { gen: 'A rough iron chain and shackle lying on worn ancient stone steps in harsh Mediterranean ' +
              'sunlight, dust in the air. Slow push in. Photoreal, no people.', negative: NEG_MODERN } },
          { say: 'This sentence was published in 1903, in a short self-help book called As a Man Thinketh, by an ' +
              'English writer named James Allen.',
            visual: { gen: 'A small cloth-bound Edwardian book lying closed on a lace doily beside a teacup in an ' +
              'English parlor, soft grey window light, rain on the glass. Photoreal, no people, no readable text.' } },
          { say: 'Once you know that, you can hear it. The rhythm is Edwardian inspiration, not a Greek teacher ' +
              'working through an argument with his students.',
            visual: { gen: 'Sunlit courtyard of an ancient Greek school, empty stone benches arranged in a half ' +
              'circle, olive trees moving in the wind. Slow pan. Photoreal, no people.', negative: NEG_MODERN } },
          { say: 'The irony is that Epictetus had a lot to say about circumstances. His whole teaching begins by ' +
              "splitting the world in two: what is up to us, and what isn't.",
            visual: { art: 'view-from-above', zoom: 'out', focus: 0.35 } },
          { say: "But he said it in his own words, and they're sharper than this one.",
            // The first take drew a fountain pen. A Roman stylus is a plain
            // pointed metal rod with a flat spatula at the other end.
            visual: { gen: 'A plain ancient Roman stylus, a thin pointed bronze rod with a small flat spatula at ' +
              'one end, resting on an open wooden writing tablet filled with smooth dark wax, on a stone table in ' +
              'morning light. Close-up, slow push in. Photoreal, no people.',
              negative: NEG_MODERN + ', fountain pen, pen nib, quill, pencil, ballpoint' } },
        ],
      },
      {
        n: 8, entry: 'fighting-a-hard-battle', painting: 'evening-examination',
        segments: [
          { quote: 'Be kind, for everyone you meet is fighting a hard battle.',
            visual: { art: 'evening-examination', zoom: 'in', focus: 0.35 } },
          { say: "This one is lovely. It's also Victorian.",
            visual: { gen: 'A Victorian study at night, snow falling past a tall window, a fire in the grate, an ' +
              'inkwell and quill on a writing desk. Slow push in. Photoreal, warm, no people.' } },
          { say: 'It traces to Ian Maclaren, the pen name of a Scottish minister named John Watson, writing a ' +
              'Christmas message in 1897.',
            visual: { gen: 'A small stone Scottish church in a snowy glen at dusk, warm light in the windows, ' +
              'smoke from a chimney. Slow drift. Photoreal, no people.' } },
          { say: 'You can see why it drifted toward the Stoics. They thought about difficult people constantly. ' +
              "Here's how Marcus Aurelius opened one of his mornings.",
            visual: { gen: 'Dawn over a Roman military camp on the Danube frontier, rows of leather tents, mist on ' +
              'the river, a standard silhouetted on a hill. Slow pan. Photoreal, no faces.', negative: NEG_MODERN } },
          { payoff: 'aurelius-meditations-2-1-difficult-people',
            excerpt: 'Begin the morning by saying to thyself, I shall meet with the busybody, the ungrateful, ' +
              'arrogant, deceitful, envious, unsocial.',
            cite: 'Meditations II.1, George Long translation',
            visual: { art: 'premeditatio-malorum', zoom: 'in', focus: 0.45 } },
          { say: "Less warm. More honest. And he goes on to say that none of them can harm him, and that he was " +
              'made to work alongside them anyway.',
            visual: { art: 'evening-examination', zoom: 'out', focus: 0.35 } },
        ],
      },
      {
        n: 7, entry: 'cultivate-garden', painting: 'present-moment',
        segments: [
          { quote: "One must cultivate one's garden.",
            visual: { art: 'present-moment', zoom: 'in', focus: 0.5 } },
          { say: 'This is the last line of Candide, by Voltaire, published in 1759.',
            visual: { gen: 'An eighteenth-century French salon at candlelight, a gilded writing desk with a quill ' +
              'and a closed leather book, a harpsichord in shadow. Slow push in. Photoreal, no people.' } },
          { say: "And this one isn't just misattributed. It's backwards.", pauseBefore: 0.3,
            visual: { art: 'present-moment', zoom: 'tight', focus: 0.5 } },
          { say: 'Candide is a satire of the belief that everything happens for the best, that the world is ' +
              'arranged by a wise providence. The Stoics believed exactly that.',
            visual: { gen: 'A vast starry night sky slowly turning over ancient Greek temple ruins, the stars ' +
              'wheeling in long arcs. Timelapse feel, photoreal, no people.' } },
          { say: "Voltaire's hero spends the whole book battered by disasters, gives up on grand explanations, " +
              'and goes home to work in his garden.',
            visual: { gen: 'Close-up of hands in rough linen sleeves turning dark soil with an old iron spade in ' +
              'a small walled garden at golden hour. Only hands and soil. Photoreal, no faces.' } },
          { say: "Putting Seneca's name on that line is like signing a critic's review with the name of the " +
              'person being reviewed.',
            visual: { art: 'present-moment', zoom: 'out', focus: 0.5 } },
        ],
      },
      {
        n: 6, entry: 'closing-time', painting: 'negative-visualization',
        segments: [
          { quote: "Every new beginning comes from some other beginning's end.",
            visual: { art: 'negative-visualization', zoom: 'in', focus: 0.4 } },
          { say: "If this one sounds familiar and you can't place it, you've probably heard it at two in the " +
              'morning.',
            visual: { gen: 'A dim American bar at closing time, chairs being stacked upside down on tables, the ' +
              'jukebox glowing, neon light reflecting on a wet floor. Slow dolly. Photoreal, no faces, no text.' } },
          { say: "It's from Closing Time, by Semisonic, 1998, written by Dan Wilson. A song about a bar shutting " +
              'for the night.',
            visual: { gen: 'Close-up of a guitar leaning against an amplifier on an empty small stage, one warm ' +
              'spotlight, dust in the beam. Slow push in. Photoreal, no people, no logos.' } },
          { say: 'Wilson has said he was also writing about his daughter being born.',
            visual: { gen: 'A tiny newborn hand gripping an adult finger, soft morning light, shallow depth of ' +
              'field. Close-up of the hands only. Photoreal, tender, no faces.' } },
          { say: "It's a good line. It's just not Latin.",
            visual: { art: 'negative-visualization', zoom: 'out', focus: 0.4 } },
        ],
      },
      {
        n: 5, entry: 'precious-privilege', painting: 'memento-mori',
        segments: [
          { quote: 'When you arise in the morning, think of what a precious privilege it is to be alive, to ' +
              'breathe, to think, to enjoy, to love.',
            visual: { gen: 'Sunrise over misty green hills, golden light spilling across the valley, birds ' +
              'crossing the sky. Slow push in. Photoreal, no people.' } },
          { say: 'This is one of the most shared Marcus Aurelius quotes there is. It was written in 1913, by ' +
              'Elbert Hubbard, an American publisher, in his magazine The Fra.',
            visual: { gen: 'An early twentieth-century letterpress print shop, a heavy iron press in warm window ' +
              'light, sheets of blank paper stacked, ink rollers turning slowly. Photoreal, no people, no text.' } },
          { say: "The tell is the tone. Marcus did write about mornings. Here's what he actually said.",
            visual: { gen: 'Pre-dawn inside a Roman military tent, a rumpled wool blanket on a low camp bed, grey ' +
              'first light at the tent flap. Slow push in. Photoreal, no people.', negative: NEG_MODERN } },
          { payoff: 'aurelius-meditations-5-1-do-the-work',
            excerpt: 'At dawn, when you have trouble getting out of bed, tell yourself: I have to go to work — as a ' +
              'human being.',
            cite: 'Meditations V.1, Gregory Hays translation',
            visual: { art: 'premeditatio-malorum', zoom: 'in', focus: 0.45 } },
          { say: "He isn't celebrating the morning. He's arguing with himself to get up.",
            visual: { art: 'memento-mori', zoom: 'in', focus: 0.35 } },
          { say: "It's less pretty, and a lot more useful, because anyone who has ever hit snooze knows which of " +
              'these two men is being honest.',
            visual: { art: 'memento-mori', zoom: 'out', focus: 0.35 } },
        ],
      },
      {
        n: 4, entry: 'everything-we-hear-is-an-opinion', painting: 'virtue-wisdom',
        segments: [
          { quote: 'Everything we hear is an opinion, not a fact. Everything we see is a perspective, not the truth.',
            visual: { art: 'virtue-wisdom', zoom: 'in', focus: 0.3 } },
          { say: "If you follow any Stoic account, you've seen this one. No translation of the Meditations " +
              'contains it.',
            visual: { gen: 'Abstract close-up of many glowing phone screens in a dark room, out of focus, colored ' +
              'light flickering as they scroll. Photoreal, no readable text, no faces.' } },
          { say: 'Its closest ancestor is a tiny entry in book two, section fifteen, where Marcus quotes an ' +
              'earlier philosopher, Monimus the Cynic, to the effect that everything is what you suppose it to be.',
            visual: { gen: 'A single candle burning on a dark wooden table, its flame reflected in a small bronze ' +
              'mirror, deep shadows. Slow push in. Photoreal, still, no people.' } },
          { say: 'And the rewrite changes the meaning. Marcus is talking about judgment: the verdict you add on ' +
              'top of what happens.',
            visual: { art: 'virtue-wisdom', zoom: 'out', focus: 0.3 } },
          { say: "The viral version says your senses can't be trusted, which is not a Stoic position at all. " +
              'The Stoics thought perception, handled carefully, could grasp the truth.',
            visual: { gen: 'A clear mountain lake at dawn, perfectly still, reflecting the peaks, then a gentle ' +
              'breeze ripples the surface. Photoreal, no people.' } },
          { say: "Credit where it's due: this one was identified by Thomas Colligan, writing for Modern Stoicism.",
            visual: { art: 'virtue-wisdom', zoom: 'in', focus: 0.3 } },
        ],
      },
      {
        n: 3, entry: 'not-what-happens', painting: 'virtue-moderation',
        segments: [
          { quote: "It's not what happens to you, but how you react to it that matters.",
            visual: { gen: 'Storm rain lashing against a tall window at night, lightning in the distance, inside ' +
              'a calm room lit by a single oil lamp on the sill. Photoreal, no people.' } },
          { say: 'Now we are getting close. This one is a modern paraphrase of something Epictetus really did ' +
              "say. Here's the original.",
            visual: { art: 'virtue-moderation', zoom: 'in', focus: 0.3 } },
          { payoff: 'epictetus-enchiridion-5-disturbed',
            excerpt: 'It is not events that disturb people, it is their judgments concerning them.',
            cite: 'Epictetus, Enchiridion 5',
            visual: { gen: 'Waves crashing against a dark sea rock at dusk, spray flying, the rock unmoved. Slow ' +
              'motion. Photoreal, no people.' } },
          { say: 'Notice the difference. The paraphrase is about reacting. Epictetus is about judging.',
            visual: { art: 'virtue-moderation', zoom: 'out', focus: 0.3 } },
          { say: 'For him, the judgment comes before the reaction, and the judgment is where the work happens. ' +
              'That distinction is the one modern cognitive therapy later built on.',
            visual: { gen: 'A quiet modern therapist\'s office, two empty armchairs facing each other, soft ' +
              'afternoon light, a plant by the window. Slow push in. Photoreal, no people, no text.' } },
          { say: "So the paraphrase isn't wrong, exactly. It's just not a quote, and it loses the most useful part.",
            visual: { art: 'virtue-moderation', zoom: 'in', focus: 0.3 } },
        ],
      },
      {
        n: 2, entry: 'obstacle-is-the-way', painting: 'virtue-justice',
        segments: [
          { quote: 'The obstacle is the way.',
            visual: { gen: 'A large mossy boulder in a mountain stream, clear water parting around it and flowing ' +
              'on. Slow push in. Photoreal, no people.' } },
          { say: "This one's the closest of all. The thought really is his. Here's Meditations book five, " +
              'section twenty.',
            visual: { art: 'premeditatio-malorum', zoom: 'in', focus: 0.45 } },
          { payoff: 'aurelius-meditations-5-20-impediment',
            excerpt: 'The impediment to action advances action. What stands in the way becomes the way.',
            cite: 'Meditations V.20, Gregory Hays translation',
            visual: { gen: 'Water from a stream flowing around and over a fallen tree trunk, carving a new channel ' +
              'through the pebbles. Close, slow motion. Photoreal, no people.' } },
          { say: "The five-word version is the title of Ryan Holiday's 2014 book, and Holiday is completely " +
              'open about where it came from.',
            visual: { art: 'virtue-justice', zoom: 'in', focus: 0.3 } },
          { say: 'What happened next is the internet dropped the book, kept the title, put it in quotation ' +
              'marks, and signed it Marcus Aurelius.',
            visual: { gen: 'Abstract dark scene of thousands of small glowing rectangles, like social posts, ' +
              'multiplying and drifting across a black void. Photoreal glow, no readable text, no faces.' } },
          { say: 'So: the right idea, the right man, the wrong words. And the real words are better.',
            visual: { art: 'virtue-justice', zoom: 'out', focus: 0.3 } },
        ],
      },
      {
        n: 1, entry: 'echoes-in-eternity', painting: 'premeditatio-malorum',
        segments: [
          { quote: 'What we do in life echoes in eternity.',
            visual: { art: 'premeditatio-malorum', zoom: 'in', focus: 0.45 } },
          { say: 'And the most famous of all.',
            visual: { art: 'premeditatio-malorum', zoom: 'tight', focus: 0.45 } },
          { say: "This line is from the 2000 film Gladiator, spoken by Russell Crowe as Maximus. The screenplay " +
              'is by David Franzoni, John Logan, and William Nicholson.',
            sfx: 'a single deep cinematic boom with a soft low rumble tail, no music', sfxVolume: 0.6,
            visual: { gen: 'An empty ancient Roman arena at dusk, seen from the sand floor, wind lifting sand, ' +
              'tall stone arches and empty stands, golden low sun and long shadows. Slow push in. Photoreal, epic, ' +
              'no people.', negative: NEG_MODERN } },
          { say: "The film's emperor is Marcus Aurelius, and he's on screen in the opening act. That's how the " +
              'line got attached to him.',
            visual: { gen: 'Close-up of a battered bronze gladiator helmet lying on its side on arena sand, ' +
              'torchlight flickering across the metal, embers drifting in the dark. Slow orbit. Photoreal, no ' +
              'people.' } },
          { say: 'The most famous thing Marcus Aurelius ever said was written in Hollywood in the late 1990s, ' +
              'about eighteen hundred years after he died.',
            visual: { gen: 'The beam of an old film projector cutting through a dark room, dust swirling in the ' +
              'light, the reel turning in silhouette. Slow drift. Photoreal, warm, no people.' } },
          { say: "And here's the part I love. The real Marcus spent a lot of the Meditations telling himself that " +
              'fame after death is worthless. In one entry he sums up a human life in a list, and it ends with this.',
            visual: { gen: 'Night inside a Roman military tent, a small terracotta Roman oil lamp with a single ' +
              'flame at the spout on a rough wooden table, a hand writing slowly on a wax tablet with a bronze ' +
              'stylus. Close-up on the hand and lamp only. Photoreal, intimate.',
              negative: 'lantern, glass lantern, candle, candlestick, electric light, paper, pen' } },
          { payoff: 'aurelius-meditations-2-17-life', excerpt: 'Lasting fame: uncertain.',
            cite: 'Meditations II.17',
            visual: { gen: 'Weathered, broken marble statues half-buried in long grass among ancient ruins, fog ' +
              'rolling through at dawn, a toppled stone head in the foreground. Slow push in. Photoreal, ' +
              'melancholy.' } },
          { say: "A man who wrote that doesn't go around announcing that his deeds will echo in eternity.",
            visual: { art: 'premeditatio-malorum', zoom: 'out', focus: 0.45 } },
        ],
      },
    ],
    close: [
      { say: 'So why do the fakes spread better than the real thing?',
        visual: { art: 'evening-examination', zoom: 'in', focus: 0.35 } },
      { say: "Because most of them were written to be quoted. They're smooth, they fit on a poster, and they " +
          'flatter you.',
        // Not posters: the first take filled the frame with garbled slogans.
        visual: { gen: 'Identical glossy prints sliding face down along a conveyor belt in a print factory, only ' +
          'their plain white backs visible, harsh fluorescent light. Slow tracking shot. Photoreal, no people.',
          negative: 'posters, slogans, lettering, printed words' } },
      { say: "The real Stoics were writing to themselves, or to their students, and it shows. They're blunter, " +
          'stranger, and much more useful on a bad day.',
        visual: { gen: 'An old leather-bound journal lying closed on a rough wooden desk by a window at dusk, a ' +
          'worn leather strap around it. Slow push in. Photoreal, no people, no text.' } },
      { say: "If you want to spot a fake, there are three tells. The rhythm sounds modern. There's no book or " +
          "section number anywhere near it. And it's a little too perfect.",
        visual: { art: 'evening-examination', zoom: 'out', focus: 0.35 } },
      { say: 'The Meditations was a private journal. Marcus never meant anyone to read it, which is exactly why ' +
          "it's worth reading.",
        visual: { art: 'premeditatio-malorum', zoom: 'in', focus: 0.45 } },
      { say: "I built an app around that journal. It's called Marcus. Each morning you get a real passage, with " +
          'the book and section it came from, and each night you look back on your day the way he did. ' +
          "It's linked below.", app: true,
        visual: { art: 'view-from-above', zoom: 'in', focus: 0.3 } },
      { say: "And if there's a quote you've always wondered about, put it in the comments. I'll trace it, and " +
          'the best ones will end up in the next video.',
        visual: { art: 'view-from-above', zoom: 'out', focus: 0.3 } },
    ],
  },
];

module.exports = { LONGFORM };
