// Imagery: public-domain classical art, one per virtue.
//   Wisdom     -> Marble head of Athena (Met Museum, Roman copy of Greek original)
//   Courage    -> Caravaggio, "David with the Head of Goliath" (1610, Borghese)
//   Temperance -> Piero del Pollaiolo, "Temperance" (1469-72, Uffizi)
//   Justice    -> Maerten van Heemskerck, "Iustitia"
//
// imageAspect = source W/H, used to set the image's intrinsic size at
// width:100%. imageShift is a percentage translateY (negative = up) that
// pulls the focal point of each painting into the visible 160px band.
// Computed from the formula:
//   shift% = (80 / renderedH) - focalY
// where focalY is the 0-1 position of the subject in the source and
// renderedH is the image's height at ~390px wide phone width.
export const virtues = [
  {
    id: 'wisdom',
    name: 'Wisdom',
    desc: 'Discernment, insight, and right judgment. See clearly — not through bias or fear.',
    question: 'Am I perceiving this clearly, or through ego?',
    image: require('../assets/virtues/wisdom.jpg'),
    imageAspect: 1280 / 1707,
    // Athena's face is centered vertically in the photo (~50%)
    imageShift: '-35%',
  },
  {
    id: 'courage',
    name: 'Courage',
    desc: 'Do the right thing even when it is hard or costly.',
    question: 'What am I avoiding out of fear?',
    image: require('../assets/virtues/courage.jpg'),
    imageAspect: 1280 / 1584,
    // Goliath's head is held in David's hand at ~65-70% down.
    imageShift: '-50%',
  },
  {
    id: 'moderation',
    name: 'Temperance',
    desc: 'Neither too much nor too little of anything. The disciplined middle path.',
    question: 'Where am I in excess today?',
    image: require('../assets/virtues/moderation.jpg'),
    imageAspect: 1280 / 2461,
    // Tall portrait: figure's face + hands holding vessels at ~25% down.
    imageShift: '-16%',
  },
  {
    id: 'justice',
    name: 'Justice',
    desc: 'Act rightly toward others. Community, fairness, duty.',
    question: 'Did I treat others well today?',
    image: require('../assets/virtues/justice.jpg'),
    imageAspect: 743 / 1023,
    // Justitia's face + scales at ~30% down.
    imageShift: '-15%',
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

export const stoicReframes = {
  anger: "Is this worth your peace? Their action is not in your control. Your response is. What does the situation actually require of you?",
  anxiety: "Separate what is in your control from what is not. Attend only to the former. The rest is not yours to carry.",
  frustration: "You were not wronged — you were inconvenienced. The Stoic does not react to inconvenience. What is the wise response here?",
  shame: "Examine whether the shame is warranted. If you acted wrongly, own it and correct course. If not, release it — others' judgments are not yours to control.",
  avoidance: "You are delaying because you fear an outcome. Name the fear. Then ask: is it as bad as the cost of continued avoidance?",
  envy: "You are measuring your inner life against another's outer life. You do not know their interior. Tend your own.",
  grief: "Grief is love with nowhere to go. Honor it. The Stoic does not suppress feeling — only the slavery to feeling.",
  fear: "Fear imagines futures that have not arrived. Return to what is actually in front of you, in this moment. What does now require?",
  other: "Pause. Name what you are actually feeling beneath the surface. Then ask: what would a person of virtue do here?",
};
