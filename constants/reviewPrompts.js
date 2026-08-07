// Weekly review prompts. Extracted so the review wizard (app/review.jsx) and
// the archive's inline editor (components/ReviewEntryEditor.jsx) render the
// same copy. They did not: the editor kept its own hardcoded list and had
// drifted, asking "What is the single most important thing I want to do this
// week?" where the wizard asked "What one thing will I do differently next
// week?" Two questions, one stored answer.
//
// STORAGE: `key` is the field these answers live under, and unlike the journal
// it is a string rather than an index, so this array is safe to reorder. The
// keys themselves are not: they are written into saved reviews.
//
// Ledger stores no text. It carries a question and hint because the wizard and
// the snapshot both need them; its answer is the bestVirtue/worstVirtue pair.
export const reviewPrompts = [
  {
    key: 'wentWell',
    num: 'I · Honor',
    q: 'What went well this week? Where did I act with Virtue more than once?',
    hint: 'Notice the small moments where you showed up as the person you want to be. Catalog what worked so you can repeat it.\n\nThe week is a different unit than the day. One good moment is worth naming, but what you are looking for here is the thing you did well repeatedly, because that is the part that has stopped being effort and started being character.',
  },
  {
    key: 'strayed',
    num: 'II · Reckon',
    q: 'Where did I fall short this week, and did it happen in the same way twice?',
    hint: 'Without shame, without flinching. Naming where you fell short is the beginning of correcting it.\n\nThe repetition is the useful part. A lapse that happened once was circumstances. A lapse that happened Tuesday and again Friday is a standing weakness, and it is the one worth spending next week on.',
  },
  {
    key: 'challenges',
    num: 'III · Pattern',
    q: 'What patterns am I noticing? What remains unresolved?',
    hint: 'A single bad day is a moment. The same bad day three weeks running is a pattern, and patterns are where the practice does its real work.\n\nThis is the one question you cannot answer from memory, because memory is where patterns hide. The week in your words sits directly above this question. Open it and read the days back, the mornings and the evenings together. Everyone has one recurring failure and one recurring evasion, and neither is visible from inside a single day.\n\nReading the week is the step almost everyone skips, and it is where most of the value of a weekly review actually is.',
  },
  {
    key: 'body',
    num: 'IV · Body',
    q: 'How did I treat my physical self: sleep, movement, food, restraint?',
    hint: 'The Stoics treated food, sleep, and movement as moral matters; the body is the instrument of Virtue. Glance at Apple Health if you want real data instead of memory.',
  },
  {
    key: 'ledger',
    num: 'V · Ledger',
    q: 'Given the week you just described, which Virtue held, and which gave way?',
    hint: 'The four Virtues are inseparable. Wisdom without Justice is shallow. Courage without Temperance is recklessness. This question is not which Virtue you remembered to do; it is a sober assessment of where the unified character was tested most, and where it held.\n\nIt is also not a fresh question. You have already written the evidence above. This is the verdict on it.',
  },
  {
    key: 'roles',
    num: 'VI · Account',
    q: 'Of the roles you named, which did this week serve, and which did it cost?',
    hint: 'These are the roles you defined in your Compass: parent, friend, citizen, worker. Edit them there if they have shifted. Epictetus held that virtue is not abstract; it is paid out through the specific parts each person is called to play. The week is the natural unit to test how those parts were served.\n\nA week spent well in one role is usually a week spent poorly in another. Naming which one paid for which is the accounting, and it is more honest than asking whether the week went well.',
  },
  {
    key: 'intention',
    // Numbered VII when the user has Compass roles and VI · Account renders,
    // VI when it does not. The wizard and the editor both compute this.
    num: 'Commit',
    q: 'What one thing will I do differently next week?',
    hint: 'One change, not many. The Stoics measured the year by what they actually did, not by what they intended. A single concrete commitment, kept, reshapes next week more than a long list you abandon by Wednesday. Make it specific. Make it visible. Make it doable in the conditions you actually live in.',
  },
];

// The four text prompts the wizard renders as a block, before the Ledger
// picker and the conditional Account step.
export const reviewTextPrompts = reviewPrompts.slice(0, 4);

export const reviewPromptByKey = Object.fromEntries(reviewPrompts.map(p => [p.key, p]));

// Commit's numeral depends on whether Account rendered. Both the wizard and
// the editor need it, and they disagreed about the question text for a whole
// release, so it lives here now rather than being spelled out twice.
export function commitNum(hasRoles) {
  return hasRoles ? 'VII · Commit' : 'VI · Commit';
}
