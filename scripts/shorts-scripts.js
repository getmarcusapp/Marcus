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
 * `painting` is a key in scripts/site-artwork.js, so the on-screen credit comes
 * from the same place the website's credits do.
 */
const SHORTS = [
  {
    id: 'echoes-in-eternity',
    hook: 'Marcus Aurelius never said this.',
    painting: 'premeditatio-malorum',
    segments: [
      { quote: 'What we do in life echoes in eternity.' },
      { say: "It's on gym walls, tattoos, and a million Marcus Aurelius posts." },
      { say: 'He never wrote it.' },
      { say: "It's from the 2000 film Gladiator." },
      { say: 'Russell Crowe says it as Maximus, in a movie where Marcus Aurelius is a character.' },
      { say: "That's how the line got attached to him." },
      { say: "Here's what Marcus actually wrote about being remembered." },
      { payoff: 'aurelius-meditations-2-17-life', excerpt: 'Lasting fame: uncertain.', cite: 'Meditations II.17' },
      { say: "The man who supposedly said your deeds echo forever wrote that fame doesn't last." },
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
