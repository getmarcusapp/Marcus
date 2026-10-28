/**
 * Scripts for the "never said this" shorts, one per misattribution.
 *
 * Every script is made of segments, and the segment type decides what may be
 * said:
 *
 *   { quote: '...' }   The misattributed line. Must be the entry's text in
 *                      constants/misattributions.js, word for word, or a clean
 *                      leading part of it. It is the hook, so it cannot drift.
 *   { payoff: id, excerpt, cite }
 *                      What the philosopher actually wrote. `id` is an entry in
 *                      constants/stoicQuotes.js and `excerpt` must appear in it
 *                      verbatim. This is the checked library the whole channel
 *                      stands on, so a paraphrase here would be the one thing
 *                      the channel exists to catch.
 *   { payoff: null, excerpt, cite, unverified: true }
 *                      A real passage that is NOT in the checked library. The
 *                      renderer refuses these unless --allow-unverified is
 *                      passed, and the flag should only be passed after
 *                      checking the wording against a printed translation.
 *   { say: '...' }     Narration. Free text, but every factual claim in it
 *                      should already be on the misattribution entry or the
 *                      site's article for that entry. Titles are written with
 *                      non-breaking spaces so a caption never splits them.
 *
 * `painting` is a key in scripts/site-artwork.js, and is what any segment
 * without its own visual shows.
 *
 * Optional per segment:
 *   visual: { art, zoom: 'in'|'out'|'tight', focus: 0..1 }   a gallery painting
 *   visual: { still: '...' } a generated still, for shots that need legible
 *                            text. Read it before posting.
 *   visual: [ ..., ... ]     several, splitting the line's time evenly
 *   negative: '...'          (on a gen visual) things this clip must not show
 *   visual: { gen: '...' }   a generated clip. Describe places, objects, hands
 *                            and light. No legible text (it comes out garbled)
 *                            and no faces (an invented face of a real person is
 *                            a made-up fact). The renderer also passes both as
 *                            negative prompts.
 *   pauseBefore: seconds     silence before the line, holding the previous
 *                            picture, so a reveal lands on the cut
 *   sfx: '...'               a generated sound effect at the start of the line
 *   sfxVolume: 0..1          its level (default 0.85; a letterpress needed 0.3)
 * Optional per short:
 *   music: '...'             prompt for the underscore; there is a default
 */
const SHORTS = [
  {
    id: 'echoes-in-eternity',
    hook: 'Marcus Aurelius never said this.',
    painting: 'premeditatio-malorum',
    segments: [
      { quote: 'What we do in life echoes in eternity.',
        visual: { art: 'premeditatio-malorum', zoom: 'in', focus: 0.25 } },
      { say: "It's on gym walls, tattoos, and a million Marcus Aurelius posts.",
        // Two stills, because the line names two places and both need the words
        // themselves legible. Check the lettering in each before posting.
        visual: [
          { still: 'Photograph of a gritty modern gym at dawn. On a dark painted concrete wall, large hand-painted ' +
              'white serif lettering reads exactly: "WHAT WE DO IN LIFE ECHOES IN ETERNITY" and beneath it, smaller: ' +
              '"— MARCUS AURELIUS". Squat rack and iron plates in the foreground, chalk dust in warm window light. ' +
              'Photoreal, moody, shallow depth of field. No people.', zoom: 'in', focus: 0.35 },
          { still: 'Close-up photograph of a muscular forearm with a black-ink script tattoo that reads exactly: ' +
              '"What we do in life echoes in eternity". Only the forearm and hand, resting on a gym bench, soft ' +
              'natural light, shallow depth of field. Photoreal. No face.', zoom: 'in', focus: 0.5 },
        ] },
      { say: 'He never wrote it.',
        visual: { art: 'premeditatio-malorum', zoom: 'tight', focus: 0.3 } },
      { say: "It's from the 2000 film Gladiator.", pauseBefore: 0.8,
        sfx: 'a single deep cinematic boom with a soft low rumble tail, no music',
        visual: { gen: 'An empty ancient Roman arena at dusk, seen from the sand floor. Wind lifts fine sand across ' +
          'the ground. In the foreground, lying flat on the sand and filling the lower third of the frame, a ' +
          'single Roman gladius: a short, wide, straight double-edged blade no longer than a forearm, a ' +
          'rounded wooden hand guard, a ribbed grip and a round pommel, and no cross-guard. Sand drifts over ' +
          'the blade. Tall stone arches and empty stands behind, golden low sun and long shadows. ' +
          'Slow push in. Photoreal, epic, no people.',
        negative: 'longsword, medieval sword, cross-guard, crossguard, broadsword, katana, spear, pole, stake, upright sword' } },
      { say: 'Russell Crowe says it as Maximus, in a movie where Marcus Aurelius is a character.',
        visual: { gen: 'Close-up of a battered bronze gladiator helmet lying on its side on arena sand, torchlight ' +
          'flickering across the metal, sparks and embers drifting in the dark. Slow orbit. Photoreal, no people.' } },
      // "line" came out close enough to "lion" that a transcript of the clean
      // recording heard "lion". Reworded rather than hoped about.
      { say: "That's how the quote got attached to him.",
        visual: { gen: 'The beam of an old film projector cutting through a dark room, dust swirling in the light, ' +
          'the reel turning in silhouette. Slow drift. Photoreal, warm, cinematic, no people.' } },
      { say: "Here's what Marcus actually wrote about being remembered.",
        visual: { gen: 'Night inside a Roman military tent on campaign, second century. On a rough wooden table a ' +
          'small terracotta Roman oil lamp, shaped like a flat round dish with a spout, burns with a single ' +
          'small flame at the spout. Beside it a hand writes slowly on a wooden wax tablet with a bronze stylus. ' +
          'Close-up on the hand and the lamp only. Warm flicker, deep shadows. Photoreal, intimate, slow.',
        negative: 'lantern, glass lantern, hurricane lamp, candle, candlestick, metal lamp, electric light, paper, pen' } },
      { payoff: 'aurelius-meditations-2-17-life', excerpt: 'Lasting fame: uncertain.', cite: 'Meditations II.17',
        visual: { gen: 'Weathered, broken marble statues half-buried in long grass among ancient ruins, fog rolling ' +
          'through at dawn, a toppled stone head in the foreground. Slow push in. Photoreal, melancholy.' } },
      { say: "The man who supposedly said your deeds echo forever wrote that fame doesn't last.",
        visual: { art: 'premeditatio-malorum', zoom: 'out', focus: 0.25 } },
    ],
  },
  {
    id: 'closing-time',
    hook: 'This "Seneca quote" is a 90s bar song.',
    painting: 'negative-visualization',
    segments: [
      { quote: "Every new beginning comes from some other beginning's end.",
        visual: { art: 'negative-visualization', zoom: 'in', focus: 0.4 } },
      { say: 'Credited to Seneca on thousands of pages.',
        visual: { still: 'Photograph of a framed minimalist motivational print hanging on a warm cafe wall, ' +
          'next to a potted plant. The print has elegant black serif text on cream paper that reads exactly: ' +
          '"Every new beginning comes from some other beginning\'s end." and beneath it, smaller: "— Seneca". ' +
          'Soft morning light, shallow depth of field. Photoreal. No people.', zoom: 'in', focus: 0.4 } },
      { say: "It's the last line of Closing Time, a 1998 song by Semisonic.", pauseBefore: 0.8,
        sfx: 'a record needle dropping onto a vinyl record, a soft thump then warm crackle, no music',
        visual: { gen: 'A small neighbourhood bar at closing time in the late 1990s. Chairs being turned upside ' +
          'down onto tables, a glowing jukebox in the corner, warm amber light, an empty wooden bar top with one ' +
          'last glass. Slow dolly across the room. Photoreal, nostalgic, cinematic. No readable signs, no faces.',
          negative: 'neon text, readable signs, logos, brand names, band, musicians, faces' } },
      { say: 'A song about a bar closing for the night.',
        visual: { gen: 'Inside an empty bar at night, the hanging lights over the bar switch off one by one, ' +
          'leaving a single warm pendant lamp glowing over the counter. Static camera. Photoreal, quiet, cinematic. ' +
          'No people.' } },
      // "he's said" was heard as "he said" on every transcript: the contraction
      // gets swallowed. Written out, it survives.
      { say: 'Dan Wilson wrote it, and he has said it was also about his daughter being born.',
        visual: { gen: 'Extreme close-up of a newborn baby\'s tiny hand gripping an adult\'s index finger, soft ' +
          'early-morning window light, white blanket, gentle movement. Photoreal, tender. Hands only, no faces.' } },
      { say: 'Seneca did write about endings. This is him.',
        visual: { art: 'memento-mori', zoom: 'in', focus: 0.3 } },
      {
        payoff: 'seneca-letter-101-each-day',
        excerpt: "Let us prepare our minds as if we'd come to the very end of life. Let us postpone nothing.",
        cite: 'Letters to Lucilius 101',
        visual: { gen: 'An antique hourglass on a worn stone ledge beside a guttering candle at dusk, the last ' +
          'grains of sand running through. Slow push in. Photoreal, still, contemplative.' },
      },
    ],
  },
  {
    id: 'we-are-what-we-repeatedly-do',
    hook: "Aristotle's most famous quote isn't Aristotle's.",
    painting: 'virtue-wisdom',
    segments: [
      { quote: 'We are what we repeatedly do. Excellence, then, is not an act, but a habit.' },
      { say: "That's Will Durant, a historian, in The Story of Philosophy, 1926." },
      { say: 'He was summarizing Aristotle, and he said so.' },
      { say: 'The name just fell off along the way.' },
      { say: "Here's what Aristotle actually wrote." },
      {
        payoff: null,
        unverified: true,
        excerpt: 'We become just by doing just acts, temperate by doing temperate acts, brave by doing brave acts.',
        cite: 'Nicomachean Ethics II.1',
      },
      { say: 'Same idea. His words.' },
    ],
  },
  {
    id: 'secret-of-change',
    hook: 'Socrates never wrote anything. So who said this?',
    painting: 'evening-examination',
    segments: [
      { quote: 'The secret of change is to focus all of your energy not on fighting the old, but on building the new.',
        visual: { still: 'Photograph of a modern open-plan office with glass walls. On a white wall hangs a large ' +
          'framed motivational poster with clean black sans-serif text on white that reads exactly: "The secret of ' +
          'change is to focus all of your energy not on fighting the old, but on building the new." and beneath ' +
          'it, smaller: "— Socrates". Desks and plants softly out of focus. Photoreal. No people.', zoom: 'in', focus: 0.4 } },
      // The voice contracts "Here is" to "Here's", so the caption now says what
      // is heard.
      { say: "Credited to Socrates everywhere. Here's the twist.",
        visual: { gen: 'Inside a dusty secondhand bookshop, tall wooden shelves packed with worn old paperbacks, ' +
          'late afternoon light and dust drifting in the air. Slow dolly down the aisle. Photoreal, warm, quiet. ' +
          'No people, no readable titles.' } },
      { say: "It's from Way of the Peaceful Warrior, a 1980 novel by Dan Millman.", pauseBefore: 0.7,
        sfx: 'a hardback book snapping shut, a single crisp thud, no music',
        visual: { gen: 'A single worn, dog-eared 1980s paperback novel lying face down on the counter of an ' +
          'empty American diner at night, a cup of coffee beside it, neon glow reflecting on the counter. ' +
          'Slow push in. Photoreal, cinematic. No readable text, no cover art, no people.',
          negative: 'book cover, title, readable text, faces' } },
      { say: 'The narrator meets an old man working nights at a gas station, and nicknames him Socrates.',
        visual: { gen: 'An old-fashioned American gas station at night in the 1960s, glowing under a flat ' +
          'fluorescent canopy, two vintage fuel pumps, a small lit office, an empty street and the dark beyond. ' +
          'Static wide shot, a moth circling the light. Photoreal, lonely, cinematic. No people, no readable signs.',
          negative: 'readable signs, brand logos, faces, people' } },
      { say: 'That Socrates says it.',
        visual: { gen: 'Close-up at night of an old man\'s weathered hands wiping a vintage gas pump nozzle with ' +
          'a cloth rag under fluorescent light. Hands only. Photoreal, quiet, cinematic.' } },
      { say: 'The real one never wrote a single word down. Everything we have from him comes through other people.',
        visual: { art: 'evening-examination', zoom: 'in', focus: 0.35 } },
    ],
  },
  {
    id: 'precious-privilege',
    hook: 'Marcus Aurelius\'s "good morning" quote was written in 1913.',
    painting: 'view-from-above',
    segments: [
      { quote: 'When you arise in the morning, think of what a precious privilege it is to be alive.',
        // The first attempt put the print small on a nightstand, unreadable at
        // phone size, and spelled the name "Marcas". Close-up now, and the name
        // is spelled out letter by letter in the prompt.
        visual: { still: 'Close-up photograph of a framed print standing on a wooden bedside table at sunrise, the ' +
          'print filling most of the frame. Elegant black serif text on cream paper reads exactly: "When you arise ' +
          'in the morning, think of what a precious privilege it is to be alive." Beneath it, smaller, the ' +
          'attribution reads exactly "— Marcus Aurelius" (M-A-R-C-U-S A-U-R-E-L-I-U-S). Warm golden light ' +
          'through linen curtains behind, a glass of water at the edge. Photoreal, shallow depth of field.', zoom: 'in', focus: 0.45 } },
      { say: 'Usually credited to Marcus Aurelius.',
        visual: { art: 'premeditatio-malorum', zoom: 'in', focus: 0.25 } },
      { say: "It's Elbert Hubbard, an American publisher, 1913.", pauseBefore: 0.4,
        sfx: 'the heavy mechanical thunk of an old iron letterpress printing press, no music', sfxVolume: 0.3,
        visual: { gen: 'A small print shop in the 1910s, warm lamplight, a hand pulling the long iron lever of a ' +
          'letterpress printing press, a fresh sheet of paper, wooden type cases on the wall. Close-up on the ' +
          'hand and the press. Photoreal, cinematic. No faces, no readable text.',
          negative: 'readable text, words, faces, modern printer' } },
      { say: 'Marcus did write about mornings, just not like that. Here is the real one.',
        visual: { art: 'view-from-above', zoom: 'in', focus: 0.3 } },
      {
        payoff: 'aurelius-meditations-5-1-do-the-work',
        excerpt: 'At dawn, when you have trouble getting out of bed, tell yourself: I have to go to work — as a human being.',
        cite: 'Meditations V.1',
        visual: { gen: 'Grey cold dawn inside a Roman army tent on campaign, second century. A low wooden camp bed ' +
          'with a rough wool blanket being slowly pushed back, pale light through the open tent flap, breath ' +
          'visible in the cold air. Photoreal, quiet, cinematic. No faces.',
          negative: 'faces, modern bedding, pillows with patterns, electric light' },
      },
      { say: "He wasn't celebrating waking up. He was talking himself out of staying in bed.",
        // The first version came out grey-white, like a corpse's feet. Warm,
        // living skin and warm light are now asked for explicitly.
        visual: { gen: 'Close-up of a man\'s bare feet stepping down from a low wooden bed onto a stone floor at ' +
          'dawn, a rough wool blanket trailing. Healthy, warm, sun-tanned living skin, lit by warm golden light ' +
          'from a doorway. Feet only. Photoreal, quiet, alive.',
          negative: 'pale skin, grey skin, bluish skin, corpse, lifeless, dead, cold blue light' } },
    ],
  },
  // ── Second batch (November 2026): the twist comes FIRST. ──────────────────
  // The first four opened on the quote, read calmly over a painting after a
  // silent lead-in, and 62% of viewers swiped away before the reveal arrived.
  // These open on the claim at frame zero, and are the three most widely
  // shared misattributions on the list.
  {
    id: 'not-what-happens',
    hook: 'Epictetus never said this.',
    painting: 'dichotomy-of-control',
    segments: [
      { say: 'Epictetus never said this.',
        visual: { art: 'dichotomy-of-control', zoom: 'tight', focus: 0.3 } },
      { quote: "It's not what happens to you, but how you react to it that matters.",
        visual: { gen: 'Heavy rain streaming down a tall window at night, a calm room inside lit by one small oil ' +
          'lamp on the sill, lightning far away. Static camera. Photoreal, quiet. No people.' } },
      { say: "It's on mugs, posters, and a million Instagram posts. It's a modern paraphrase.",
        visual: { art: 'view-from-above', zoom: 'in', focus: 0.35 } },
      { say: "Here's what he actually wrote.", pauseBefore: 0.4,
        visual: { gen: 'Waves crashing against a dark sea rock at dusk, white spray flying, the rock unmoved. ' +
          'Slow motion. Photoreal, no people.' } },
      { payoff: 'epictetus-enchiridion-5-disturbed',
        excerpt: 'It is not events that disturb people, it is their judgments concerning them.',
        cite: 'Enchiridion 5',
        visual: { art: 'dichotomy-of-control', zoom: 'out', focus: 0.3 } },
      { say: 'Not your reaction. Your judgment. That is the part the paraphrase leaves out.',
        visual: { gen: 'A single candle flame burning perfectly still in a dark stone room, then a slight draft ' +
          'makes it flicker and steady again. Close-up. Photoreal, no people.' } },
    ],
  },
  {
    id: 'everything-we-hear-is-an-opinion',
    hook: 'Marcus Aurelius never wrote this.',
    painting: 'premeditatio-malorum',
    segments: [
      { say: 'Marcus Aurelius never wrote this.',
        visual: { art: 'premeditatio-malorum', zoom: 'tight', focus: 0.45 } },
      { quote: 'Everything we hear is an opinion, not a fact. Everything we see is a perspective, not the truth.',
        visual: { gen: 'Dozens of glowing phone screens floating in a dark room, softly out of focus, colored light ' +
          'flickering as feeds scroll. Photoreal. No readable text, no faces.' } },
      { say: 'It is one of the most shared Marcus quotes online. No translation of the Meditations contains it.',
        visual: { art: 'evening-examination', zoom: 'in', focus: 0.4 } },
      { say: 'And it flips what the Stoics believed.', pauseBefore: 0.4,
        visual: { gen: 'A perfectly still mountain lake at dawn reflecting snowy peaks, then a breeze ripples the ' +
          'surface and the reflection breaks apart. Photoreal, no people.' } },
      { say: 'They trusted what you see. What they distrusted was the verdict you add on top of it.',
        visual: { art: 'premeditatio-malorum', zoom: 'out', focus: 0.45 } },
    ],
  },
  {
    id: 'fighting-a-hard-battle',
    hook: 'Seneca never said this.',
    painting: 'evening-examination',
    segments: [
      { say: 'Seneca never said this.',
        visual: { art: 'evening-examination', zoom: 'tight', focus: 0.35 } },
      { quote: 'Be kind, for everyone you meet is fighting a hard battle.',
        visual: { gen: 'A Victorian study at night, snow falling past a tall window, a fire burning low in the ' +
          'grate, an inkwell and quill on a writing desk. Slow push in. Photoreal, warm. No people.' } },
      { say: 'It comes from 1897, from a Scottish minister writing as Ian Maclaren.',
        visual: { gen: 'A small stone church in a snowy Scottish glen at dusk, warm light in the windows, smoke ' +
          'rising from the chimney. Slow drift. Photoreal, no people.' } },
      { say: 'A Stoic did say something like it. Just less gently.', pauseBefore: 0.4,
        visual: { art: 'premeditatio-malorum', zoom: 'in', focus: 0.45 } },
      { payoff: 'aurelius-meditations-2-1-difficult-people',
        excerpt: 'Begin the morning by saying to thyself, I shall meet with the busybody, the ungrateful, arrogant, ' +
          'deceitful, envious, unsocial.',
        cite: 'Meditations II.1',
        visual: { gen: 'Dawn over a Roman military camp on a misty river, rows of leather tents, a standard ' +
          'silhouetted on a hill. Slow pan. Photoreal, no faces.',
          negative: 'modern objects, plastic, electric light' } },
      { say: 'Expect difficult people. Be decent anyway.',
        visual: { art: 'evening-examination', zoom: 'out', focus: 0.35 } },
    ],
  },
  // ── Third batch (November 2026): hook-first, with the real line as payoff. ─
  {
    id: 'luck-preparation',
    hook: 'Seneca never said this. Nobody knows who did.',
    painting: 'dichotomy-of-control',
    segments: [
      { say: 'Seneca never said this. Nobody knows who did.',
        visual: { art: 'dichotomy-of-control', zoom: 'tight', focus: 0.3 } },
      { quote: 'Luck is what happens when preparation meets opportunity.',
        visual: { gen: 'An empty locker room at night, one light on, a folded towel on a wooden bench, steam ' +
          'drifting slowly. Slow push in. Photoreal, no people, no text.' } },
      { say: "It's in business books and locker rooms under his name. It is in none of his letters or essays.",
        visual: { art: 'evening-examination', zoom: 'in', focus: 0.4 } },
      { say: 'Seneca did write about preparation. Like this.', pauseBefore: 0.4,
        visual: { gen: 'An ancient wooden sailing ship at dawn on a calm grey sea, sails slack, waiting for wind, ' +
          'mist on the water. Slow drift. Photoreal, no people.', negative: 'modern boats, engines, flags with text' } },
      { payoff: 'seneca-letter-71-good-character',
        excerpt: 'If a man knows not to which port he is sailing, no wind is favorable.',
        cite: 'Letters to Lucilius 71',
        visual: { art: 'dichotomy-of-control', zoom: 'out', focus: 0.3 } },
    ],
  },
  {
    id: 'circumstances-reveal-the-man',
    hook: 'Epictetus never said this. He said it better.',
    painting: 'view-from-above',
    segments: [
      { say: 'Epictetus never said this. He said it better.',
        visual: { art: 'view-from-above', zoom: 'tight', focus: 0.35 } },
      { quote: 'Circumstances do not make the man, they only reveal him to himself.',
        visual: { gen: 'A rough iron chain lying on worn ancient stone steps in harsh Mediterranean sunlight, dust ' +
          'drifting in the air. Slow push in. Photoreal, no people.', negative: 'modern objects, plastic' } },
      { say: 'It was published in 1903, in a self-help book by James Allen called As a Man Thinketh.',
        visual: { gen: 'A small cloth-bound book lying closed on a lace doily beside a china teacup in an English ' +
          'parlor, grey window light, rain on the glass. Photoreal, no people, no readable text.' } },
      { say: "Epictetus was born a slave. Here's what he actually said.", pauseBefore: 0.4,
        visual: { art: 'view-from-above', zoom: 'in', focus: 0.35 } },
      { payoff: 'epictetus-discourses-1-24-difficulties',
        excerpt: 'It is difficulties that show what men are.',
        cite: 'Discourses I.24',
        visual: { gen: 'Waves crashing against a dark sea rock at dusk, spray flying, the rock unmoved. Slow motion. ' +
          'Photoreal, no people.' } },
      { say: 'Eight words. No poster needed.',
        visual: { art: 'view-from-above', zoom: 'out', focus: 0.35 } },
    ],
  },
  {
    id: 'cultivate-garden',
    hook: 'Seneca never said this. It mocks what he believed.',
    painting: 'present-moment',
    segments: [
      { say: 'Seneca never said this. It mocks what he believed.',
        visual: { art: 'present-moment', zoom: 'in', focus: 0.5 } },
      { quote: "One must cultivate one's garden.",
        visual: { gen: 'Close-up of hands in rough linen sleeves turning dark soil with an old iron spade in a small ' +
          'walled garden at golden hour. Only hands and soil. Photoreal, no faces.' } },
      { say: "It's the last line of Candide, by Voltaire, from 1759.",
        visual: { gen: 'An eighteenth-century French salon by candlelight, a gilded writing desk with a quill and a ' +
          'closed leather book. Slow push in. Photoreal, no people.' } },
      { say: 'Candide mocks the belief that everything happens for the best, that a wise providence runs the world.',
        pauseBefore: 0.3,
        visual: { gen: 'A starry night sky slowly wheeling over ancient Greek temple ruins, stars turning in long ' +
          'arcs. Photoreal, no people.' } },
      { say: 'The Stoics believed exactly that. Putting Seneca on this line is signing the critic’s review with ' +
          'the author’s name.',
        visual: { art: 'present-moment', zoom: 'out', focus: 0.5 } },
    ],
  },
  {
    id: 'obstacle-is-the-way',
    hook: "Marcus Aurelius didn't say this. He said it better.",
    painting: 'premeditatio-malorum',
    segments: [
      { say: "Marcus Aurelius didn't say this. He said it better.",
        visual: { art: 'premeditatio-malorum', zoom: 'tight', focus: 0.45 } },
      { quote: 'The obstacle is the way.',
        visual: { gen: 'A large mossy boulder in a clear mountain stream, water parting around it and flowing on. ' +
          'Slow push in. Photoreal, no people.' } },
      { say: "Those five words are the title of Ryan Holiday's 2014 book, and he is open about where they came from.",
        visual: { art: 'virtue-justice', zoom: 'in', focus: 0.3 } },
      { say: 'Here is the original, from book five.', pauseBefore: 0.4,
        visual: { gen: 'Water from a stream flowing over and around a fallen log, carving a new channel through ' +
          'pebbles. Close, slow motion. Photoreal, no people.' } },
      { payoff: 'aurelius-meditations-5-20-impediment',
        excerpt: 'The impediment to action advances action. What stands in the way becomes the way.',
        cite: 'Meditations V.20',
        visual: { art: 'premeditatio-malorum', zoom: 'out', focus: 0.45 } },
    ],
  },
  {
    // Corrected before posting: the first version said "Seneca never said
    // this", but Seneca does quote the line, once, in Letters 94.28. He did
    // not write it; Virgil did. The hook now says exactly that.
    id: 'fortune-favours-the-bold',
    hook: "Seneca didn't write this. He quoted it.",
    painting: 'negative-visualization',
    segments: [
      { say: "Seneca didn't write this. He quoted it.",
        visual: { art: 'negative-visualization', zoom: 'in', focus: 0.4 } },
      { quote: 'Fortune favours the bold.',
        visual: { gen: 'A Roman trireme cutting through rough dark seas under storm clouds, oars rising together, ' +
          'spray over the bow. Wide shot. Photoreal, epic, no visible faces.',
          negative: 'modern boats, engines, text, flags with text' } },
      { say: "The line is Virgil's, from the Aeneid, and it was an old proverb even then.",
        visual: { gen: 'An ancient papyrus scroll partly unrolled on a marble table by oil-lamp light, the papyrus ' +
          'blank and aged. Close-up, slow. Photoreal, no people.', negative: 'modern objects, lantern, candle' } },
      { say: 'Seneca cites it once, in a letter. His own view of fortune was harder.', pauseBefore: 0.4,
        visual: { art: 'negative-visualization', zoom: 'out', focus: 0.4 } },
      { payoff: 'seneca-providence-fire',
        excerpt: 'Fire is the test of gold; adversity, of strong men.',
        cite: 'On Providence 5',
        visual: { gen: 'Molten gold being poured from a glowing crucible in a dark ancient forge, sparks rising. ' +
          'Close-up, slow motion. Photoreal, no faces.' } },
    ],
  },
  // ── From the October 2026 audit of the app's own quotes. ──────────────────
  {
    id: 'present-moment-chosen',
    hook: 'Marcus Aurelius never said this. A 1997 bestseller did.',
    painting: 'present-moment',
    segments: [
      { say: 'Marcus Aurelius never said this. A 1997 bestseller did.',
        visual: { art: 'premeditatio-malorum', zoom: 'tight', focus: 0.45 } },
      { quote: 'Whatever the present moment contains, accept it as if you had chosen it.',
        visual: { gen: 'A calm lake at dawn, mist drifting over the water, a single wooden rowboat moored at a small ' +
          'jetty. Slow push in. Photoreal, still, no people.' } },
      { say: "It's Eckhart Tolle, from The Power of Now. It is in no translation of the Meditations.",
        visual: { gen: 'A modern living room at golden hour, a paperback book lying face down on a linen sofa beside a ' +
          'cup of tea, sunlight through sheer curtains. Photoreal, no people, no readable text.' } },
      { say: 'The Stoics did teach something like it. Here is Epictetus.', pauseBefore: 0.4,
        visual: { art: 'dichotomy-of-control', zoom: 'in', focus: 0.3 } },
      { payoff: 'epictetus-enchiridion-8-wish',
        excerpt: 'Do not seek to have everything that happens happen as you wish, but wish for everything to happen ' +
          'as it actually does happen, and your life will be serene.',
        cite: 'Enchiridion 8',
        visual: { gen: 'A river flowing steadily around smooth stones in morning light, the water never stopping. ' +
          'Slow motion, close. Photoreal, no people.' } },
    ],
  },
  {
    id: 'attention-become',
    hook: 'Epictetus never said this. A 1995 book did.',
    painting: 'view-from-above',
    segments: [
      { say: 'Epictetus never said this. A 1995 book did.',
        visual: { art: 'view-from-above', zoom: 'tight', focus: 0.35 } },
      { quote: 'You become what you give your attention to.',
        visual: { gen: 'Abstract close-up of many glowing phone screens in a dark room, softly out of focus, colored ' +
          'light flickering as they scroll. Photoreal, no readable text, no faces.' } },
      { say: "It's Sharon Lebell's The Art of Living, an interpretation of Epictetus in her own words, " +
          'not a translation.',
        visual: { gen: 'A small modern paperback book lying open on a wooden desk by a window, soft afternoon light, ' +
          'pages blank. Photoreal, no people, no readable text.' } },
      { say: 'Here is what Epictetus actually said.', pauseBefore: 0.4,
        visual: { art: 'view-from-above', zoom: 'in', focus: 0.35 } },
      { payoff: 'epictetus-discourses-3-23-be-then-do',
        excerpt: 'First say to yourself what you would be; and then do what you have to do.',
        cite: 'Discourses III.23',
        visual: { gen: 'Close-up of hands lacing worn leather boots on a stone step at dawn, ready to set out. ' +
          'Hands only, photoreal, no faces.' } },
    ],
  },
];

module.exports = { SHORTS };
