// Imagery: public-domain classical art, one per virtue.
// Pre-cropped to 1080x608 (16:9 banner) so cover-crop in the 160px hero
// band fills cleanly with no per-virtue positioning needed.
//   Wisdom     -> Marble head of Athena (Met Museum)
//   Courage    -> Caravaggio, "David with the Head of Goliath" (1610, Borghese)
//   Temperance -> Piero del Pollaiolo, "Temperance" (1469-72, Uffizi)
//   Justice    -> Maerten van Heemskerck, "Iustitia"
export const virtues = [
  {
    id: 'wisdom',
    name: 'Wisdom',
    desc: 'Discernment, insight, and right judgment. See clearly — not through bias or fear.',
    question: 'Am I perceiving this clearly, or through ego?',
    image: require('../assets/virtues/wisdom.jpg'),
  },
  {
    id: 'courage',
    name: 'Courage',
    desc: 'Do the right thing even when it is hard or costly.',
    question: 'What am I avoiding out of fear?',
    image: require('../assets/virtues/courage.jpg'),
  },
  {
    id: 'moderation',
    name: 'Temperance',
    desc: 'Neither too much nor too little of anything. The disciplined middle path.',
    question: 'Where am I in excess today?',
    image: require('../assets/virtues/moderation.jpg'),
  },
  {
    id: 'justice',
    name: 'Justice',
    desc: 'Act rightly toward others. Community, fairness, duty.',
    question: 'Did I treat others well today?',
    image: require('../assets/virtues/justice.jpg'),
  },
];

export const emotions = [
  { id: 'anger', label: 'Anger' },
  { id: 'anxiety', label: 'Anxiety' },
  { id: 'frustration', label: 'Frustration' },
  { id: 'shame', label: 'Shame' },
  { id: 'avoidance', label: 'Avoidance' },
  { id: 'envy', label: 'Envy' },
  { id: 'grief', label: 'Grief' },
  { id: 'fear', label: 'Fear' },
  { id: 'other', label: 'Other' },
];

// Deeper definition + sharper question per Virtue, used by the expandable
// virtue cards on Practice, Compass, and the Journal Virtue picker. The
// `virtues` array above carries the short hero copy; this map carries the
// elaboration shown when the user taps "More".
export const VIRTUE_DETAILS = {
  wisdom: { definition: 'The Virtue of discernment and right judgment. Wisdom means seeing things clearly, not as you wish them to be, but as they are.', question: 'Am I perceiving this clearly or through bias, fear, or ego?' },
  courage: { definition: 'The Virtue of strength and moral fortitude. Courage is doing the right thing even when it is hard.', question: 'What fear is stopping me right now?' },
  moderation: { definition: 'The Virtue of temperance and balance. Neither indulgence nor deprivation: the disciplined middle path.', question: 'Where am I in excess today?' },
  justice: { definition: 'The Virtue of fairness and right action toward others. Justice is about how you treat the people around you.', question: 'Did I treat others with fairness today?' },
};

export const stoicReframes = {
  anger: "Is this worth your peace? Their action is not in your control. Your response is. What does the situation actually require of you?",
  anxiety: "Separate what is in your control from what is not. Attend only to the former. The rest is not yours to carry.",
  frustration: "You were not wronged — you were inconvenienced. The Stoic does not react to inconvenience. What is the wise response here?",
  shame: "Examine whether the shame is warranted. If you acted wrongly, own it and correct course. If not, release it — others' judgments are not yours to control.",
  avoidance: "You are delaying because you fear an outcome. Name the fear. Then ask: is it as bad as the cost of continued avoidance?",
  envy: "You are measuring your inner life against another's outer life. You do not know their interior. Tend your own.",
  grief: "Grief is love with nowhere to go. Honor it. The Stoic does not suppress feeling — only the slavery to feeling.",
  fear: "Fear imagines futures that have not arrived. Return to what is actually in front of you, in this moment. What does now require?",
  other: "Pause. Name what you are actually feeling beneath the surface. Then ask: what would a person of Virtue do here?",
};
