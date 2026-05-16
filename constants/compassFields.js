// Compass field definitions — used by the onboarding default persistence
// path and by the first-visit CompassIntro on /compass. Kept in constants
// so both surfaces share the same labels, placeholders, and Stoic hints.

export const DEFAULT_COMPASS = {
  why: 'To cultivate the kind of person I want to be: disciplined in attention, deliberate in action, calm in the face of what I cannot control. Built from character, not from outcomes.',
  overcome: 'I want to worry less about what I cannot control. To respond instead of react. To free myself from the anxiety of other people\'s opinions and the tyranny of my own undisciplined mind.',
  aspire: 'I want to meet adversity with calm, and fortune with humility. To live each day with intention, not perfectly, but deliberately. To be someone who acts in accordance with their values, even when it\'s hard.',
};

export const COMPASS_FIELDS = [
  {
    key: 'why', label: 'Why I practice', sub: 'What draws you to Stoicism?',
    placeholder: 'e.g. To act with integrity regardless of outcome. To be the kind of person my future self would be proud of.',
    hint: "The Stoics held that Virtue, not outcome, is the only true good. Your Why should reflect what is in your control: your character, your intentions, how you show up.\n\nA Stoic Why doesn't depend on external circumstances. 'I want to be respected' is external. 'I want to act with integrity regardless of outcome' is internal: yours to achieve regardless of what happens around you.",
  },
  {
    key: 'overcome', label: 'What I want to overcome', sub: 'What patterns or struggles brought you here?',
    placeholder: 'e.g. My tendency to avoid difficult conversations. Mistaking busyness for progress.',
    hint: "Name a pattern you can observe in yourself, not a circumstance or another person. Those are outside your control. What you can overcome is your habitual response to them.\n\n'I want to overcome anxiety' is external. 'I want to stop treating anxiety as a verdict rather than an impression' is internal. That is where the Stoic practice lives.",
  },
  {
    key: 'aspire', label: 'Who I aspire to be', sub: 'What does the best version of you look like?',
    placeholder: 'e.g. To respond to difficulty with reason rather than reaction. To be present with the people I love.',
    hint: "Aspiration in Stoic terms is the cultivation of Virtue: wisdom, courage, temperance, justice. The test is whether your aspiration describes who you are becoming, not what you are getting.\n\nEpictetus: 'First say to yourself what you would be; then do what you have to do.'",
  },
];
