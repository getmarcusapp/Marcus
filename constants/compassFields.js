// Compass field definitions — used by the onboarding default persistence
// path and by the first-visit CompassIntro on /compass. Kept in constants
// so both surfaces share the same labels, placeholders, and Stoic hints.

// The questions are the canonical framing of the three Compass fields.
// /compass asks them above the answer; the onboarding walkthrough asks the
// same ones while the answer is being written. One source, so the two
// screens can never drift into asking a user two different things about the
// same field.
export const COMPASS_QUESTIONS = {
  why: 'Why do I practice?',
  overcome: 'What pattern in myself will I overcome?',
  aspire: 'Who am I becoming?',
};

// Seed text, written to storage when onboarding finishes. Each one has to
// answer its question in the question's own grammar: a "why" takes an
// infinitive, a "what pattern" takes the pattern named as a thing, and a
// "who" takes a person. Earlier copy answered all three with "I want to…",
// which reads as an answer to "what do you want?" and quietly modelled the
// wrong shape for the user about to write their own.
export const DEFAULT_COMPASS = {
  why: 'To cultivate the kind of person I want to be: disciplined in attention, deliberate in action, calm in the face of what I cannot control. A life built from character, not from outcomes.',
  overcome: 'Treating my first impression of a thing as the truth about it. I react before I have understood, and I give other people\'s opinions the weight of a verdict. That is the habit I am learning to see clearly and set down.',
  aspire: 'Someone who meets adversity with calm and fortune with humility. Someone who lives each day deliberately rather than perfectly, and who holds to those values when holding to them costs something.',
};

// Every default the app has ever written into a user's Compass.
//
// notifications.js quotes a Compass line back on the lock screen and must
// never quote text the app wrote for them. Comparing against DEFAULT_COMPASS
// alone is not enough: a user who onboarded before a copy change still has
// the OLD string in storage, so an equality test against only the current
// default opens the gate and pushes onboarding boilerplate at them as if it
// were their own words.
//
// APPEND ONLY. A string removed from this list becomes quotable again.
const PAST_COMPASS_DEFAULTS = [
  // Shipped in DEFAULT_COMPASS through 1.2.0.
  'To cultivate the kind of person I want to be: disciplined in attention, deliberate in action, calm in the face of what I cannot control. Built from character, not from outcomes.',
  'I want to worry less about what I cannot control. To respond instead of react. To free myself from the anxiety of other people\'s opinions and the tyranny of my own undisciplined mind.',
  'I want to meet adversity with calm, and fortune with humility. To live each day with intention, not perfectly, but deliberately. To be someone who acts in accordance with their values, even when it\'s hard.',
  // A second, divergent copy that lived inline in store/db.js getCompass().
  // Never written by onboarding, but /compass loads that fallback into state
  // and saves it on the next edit, so it can be in storage.
  'I am drawn to Stoicism because it offers something rare — a practical philosophy for living well, tested across centuries. Not theory. Not productivity hacks. A system for becoming someone you respect.',
  'I want to meet adversity with calm and fortune with humility. To live each day with intention — not perfectly, but deliberately. To be someone who acts in accordance with their values, even when it\'s hard.',
];

const normalise = t => String(t || '').replace(/\s+/g, ' ').trim();
const APP_WRITTEN = new Set(
  [...Object.values(DEFAULT_COMPASS), ...PAST_COMPASS_DEFAULTS].map(normalise)
);

// True when a Compass line is the app's own seed text rather than the user's.
// Deliberately checked across all three fields at once: text the app wrote
// for `why` is not the user's voice if it turns up under `aspire` either.
export function isAppWrittenCompassText(text) {
  const t = normalise(text);
  return !t || APP_WRITTEN.has(t);
}

export const COMPASS_FIELDS = [
  {
    key: 'why', label: 'Why', sub: COMPASS_QUESTIONS.why,
    placeholder: 'e.g. To act with integrity regardless of outcome. To be the kind of person my future self would be proud of.',
    hint: "The Stoics held that Virtue, not outcome, is the only true good. Your Why should reflect what is in your control: your character, your intentions, how you show up.\n\nA Stoic Why doesn't depend on external circumstances. 'I want to be respected' is external. 'I want to act with integrity regardless of outcome' is internal: yours to achieve regardless of what happens around you.",
  },
  {
    key: 'overcome', label: 'Overcome', sub: COMPASS_QUESTIONS.overcome,
    placeholder: 'e.g. My tendency to avoid difficult conversations. Mistaking busyness for progress.',
    hint: "Name a pattern you can observe in yourself, not a circumstance or another person. Those are outside your control. What you can overcome is your habitual response to them.\n\n'I want to overcome anxiety' is external. 'I want to stop treating anxiety as a verdict rather than an impression' is internal. That is where the Stoic practice lives.",
  },
  {
    key: 'aspire', label: 'Aspire', sub: COMPASS_QUESTIONS.aspire,
    placeholder: 'e.g. To respond to difficulty with reason rather than reaction. To be present with the people I love.',
    hint: "Aspiration in Stoic terms is the cultivation of Virtue: wisdom, courage, temperance, justice. The test is whether your aspiration describes who you are becoming, not what you are getting.\n\nEpictetus: 'First say to yourself what you would be; then do what you have to do.'",
  },
];
