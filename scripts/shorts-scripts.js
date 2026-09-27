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
      { say: "That's how the line got attached to him.",
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
      { quote: "Every new beginning comes from some other beginning's end." },
      { say: 'Credited to Seneca on thousands of pages.' },
      { say: "It's the last line of Closing Time, a 1998 song by Semisonic." },
      { say: 'A song about a bar closing for the night.' },
      { say: "Dan Wilson wrote it, and he's said it was also about his daughter being born." },
      { say: 'Seneca did write about endings. This is him.' },
      {
        payoff: 'seneca-letter-101-each-day',
        excerpt: "Let us prepare our minds as if we'd come to the very end of life. Let us postpone nothing.",
        cite: 'Letters to Lucilius 101',
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
      { quote: 'The secret of change is to focus all of your energy not on fighting the old, but on building the new.' },
      { say: 'Credited to Socrates everywhere. Here is the twist.' },
      { say: "It's from Way of the Peaceful Warrior, a 1980 novel by Dan Millman." },
      { say: 'The narrator meets an old man working nights at a gas station, and nicknames him Socrates.' },
      { say: 'That Socrates says it.' },
      { say: 'The real one never wrote a single word down. Everything we have from him comes through other people.' },
    ],
  },
  {
    id: 'precious-privilege',
    hook: 'Marcus Aurelius\'s "good morning" quote was written in 1913.',
    painting: 'view-from-above',
    segments: [
      { quote: 'When you arise in the morning, think of what a precious privilege it is to be alive.' },
      { say: 'Usually credited to Marcus Aurelius.' },
      { say: "It's Elbert Hubbard, an American publisher, 1913." },
      { say: 'Marcus did write about mornings, just not like that. Here is the real one.' },
      {
        payoff: 'aurelius-meditations-5-1-do-the-work',
        excerpt: 'At dawn, when you have trouble getting out of bed, tell yourself: I have to go to work — as a human being.',
        cite: 'Meditations V.1',
      },
      { say: "He wasn't celebrating waking up. He was talking himself out of staying in bed." },
    ],
  },
];

module.exports = { SHORTS };
