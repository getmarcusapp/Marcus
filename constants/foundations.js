// The Foundations — seven letters, one unlocked per day across the user's
// first week. The trial-week teaching arc: each letter gives one Stoic tool
// and quietly points at the part of the app that exercises it (Letter III →
// morning journal's II · Brace, IV → evening journal, V → weekly review's
// Ledger). Letter VII lands as the trial closes and does the conversion work
// in-world: no pricing, no CTA, just "the letters end, the practice does not."
//
// Sourcing: the Seneca examination quote is On Anger 3.36; the Marcus
// closing lines are Meditations 2.11 (Hays). Everything else is paraphrase —
// no invented quotations, per the app's attribution discipline.
//
// `tomorrow` renders as an italic closing line; null on the last letter
// (its close is in the body).

export const FOUNDATIONS_LETTERS = [
  {
    num: 'I',
    title: 'The Practice',
    paragraphs: [
      'Philosophy was never meant to be read. It was meant to be done.',
      'The Stoics knew this. Epictetus was born a slave. Seneca advised one emperor and was ordered to die by another. Marcus Aurelius ruled the known world from a war camp on the Danube. None of them practiced philosophy because it was interesting. They practiced because the day demanded it.',
      'What you have begun is not a course of study. It is a practice, in the oldest sense of the word: something done repeatedly, imperfectly, until it becomes part of you. The reading, the morning pages, the evening examination. Each is small. None requires brilliance. The only requirement is that you return.',
      'Do not aim at intensity. Aim at consistency. A single honest sentence written tonight is worth more than a perfect week imagined. The Stoics measured progress the way you measure the growth of a tree: not by watching, but by returning each season and finding it changed.',
      'Six letters remain. Each takes two minutes. Each gives you one tool.',
    ],
    tomorrow: 'Tomorrow: the single distinction everything else is built on.',
  },
  {
    num: 'II',
    title: 'The Dichotomy of Control',
    paragraphs: [
      '"Some things are up to us, and some things are not." Epictetus opened his handbook with that sentence because every other page depends on it.',
      'Up to you: your judgments, your intentions, your responses, where you place your attention. Not up to you: other people\'s opinions, the outcome of your work, the past, the weather, the verdict.',
      'This sounds simple. It is not. Most suffering begins as a category error: treating what is not yours as if it were. You cannot make the meeting go well. You can prepare honestly and speak plainly. You cannot make someone understand you. You can say the true thing kindly.',
      'The moment you sort a worry into its proper column, it changes shape. What is yours becomes a task. What is not yours becomes weather.',
      'Try it today with one thing. Take whatever sits heaviest on you and ask the first question the Stoics asked of everything: is this up to me? If yes, act. If no, release it the way you release the rain.',
    ],
    tomorrow: 'Tomorrow: why the Stoics rehearsed misfortune on purpose.',
  },
  {
    num: 'III',
    title: 'The Rehearsal',
    paragraphs: [
      'Each morning, Marcus Aurelius reminded himself that he would meet people who were meddling, arrogant, and ungrateful. He was right. He was also the steadiest man in Rome.',
      'The Stoics called it premeditatio malorum: the premeditation of adversity. Before the day begins, you rehearse what could go wrong. Not to worry. To prepare. The difficult colleague, the delayed train, the plan that collapses at noon. You meet each one in your mind and choose your response while you are still calm enough to choose well.',
      'This is the opposite of anxiety. Anxiety rehearses the disaster and stops there. Premeditation rehearses the disaster and then rehearses you: meeting it with patience, with humor, with a steady voice. When the difficulty arrives, and some version of it will, it finds you already acquainted.',
      'Seneca observed that the blow we never saw coming is the one that lands heaviest. The whole exercise is simply refusing to be surprised.',
      'Your morning journal asks where courage will be required of you today. Now you know why.',
    ],
    tomorrow: 'Tomorrow: the oldest habit in Stoicism, and the reason this practice has an evening.',
  },
  {
    num: 'IV',
    title: 'The Examination',
    paragraphs: [
      'Every night, before sleep, Seneca put his day on trial.',
      '"I examine my entire day and go back over what I have done and said, hiding nothing from myself, passing nothing by." He learned the habit from his teacher Sextius, and it reduces to three questions: What did I do badly? What did I do well? What did I leave undone?',
      'Notice what is absent: punishment. The examination is an audit, not a sentencing. You look at the day the way a craftsman looks at the day\'s work, plainly, to see what to keep and what to correct. Shame distorts the ledger. Honesty balances it.',
      'This is the keystone of the whole practice. The morning sets an intention; the evening asks what became of it. Without the evening, the morning is just optimism. With it, every day becomes evidence, and the evidence accumulates into character.',
      'Tonight, when the evening journal asks where you acted with virtue and where you fell short, answer in specifics. Not "I was impatient" but where, with whom, and what the Stoic would have done instead.',
      'The day is judged. Then it is released. Sleep is for neither guilt nor planning.',
    ],
    tomorrow: 'Tomorrow: the four measures the Stoics judged everything against.',
  },
  {
    num: 'V',
    title: 'The Four Virtues',
    paragraphs: [
      'Strip Stoicism to its load-bearing wall and you find one claim: virtue is the only good. Everything else, money, health, reputation, comfort, is at most preferred. Useful, pleasant, worth pursuing, but not good in itself, because each of them can serve a bad life as easily as a good one.',
      'Virtue, to the Stoics, was four things.',
      'Wisdom: seeing clearly. What is true, what matters, what is yours to do.\nCourage: doing the right thing when it costs something.\nJustice: giving people what they are owed, beginning with honesty.\nTemperance: wanting in right measure. Restraint not as denial but as proportion.',
      'The four are a compass, not a scoreboard. In any difficult moment, one of them names what the moment requires. The hard conversation requires courage. The unfair criticism requires justice toward them and wisdom about yourself. The second glass, the third hour of scrolling: temperance.',
      'Your weekly review will ask which virtue you embodied most and which you neglected. Begin noticing now. Most people are strong in one or two and quietly bankrupt in another. That gap is where your practice lives.',
    ],
    tomorrow: 'Tomorrow: the exercise Marcus used to shrink an empire\'s problems to their true size.',
  },
  {
    num: 'VI',
    title: 'The View from Above',
    paragraphs: [
      'When the weight of Rome pressed on him, Marcus Aurelius practiced a strange exercise. He imagined rising above the city, above the empire, until he could see the whole of human affairs at once: the armies and marketplaces, the weddings and funerals, the same scenes repeated in every age.',
      'The Stoics called it the view from above, and from that height two things happen. The first is humbling: your grievance with a colleague is invisible from a thousand feet. The deadline, the slight, the worry that owned your morning, none of it survives the altitude. The second is warming: you see how much company you have. Every person below is carrying something, fearing something, hoping for something. The Stoics had a word for that recognition: sympatheia, the kinship of all beings.',
      'Use it as a tool, not an escape. When something small has grown large in your mind, climb. Will this matter in a year? Did it matter to the generation before you? From how high up can it still be seen?',
      'Most of what disturbs us cannot be seen from the roof of the building.',
    ],
    tomorrow: 'Tomorrow: the last letter, and the oldest reminder of all.',
  },
  {
    num: 'VII',
    title: 'Memento Mori',
    paragraphs: [
      'You have seen the skull by now. It is on the icon, the practice screen, the seal. It is not decoration, and it is not morbid. It is the oldest tool in the Stoic kit.',
      '"You could leave life right now," Marcus wrote, to himself, not to an audience. "Let that determine what you do and say and think." He was not being dark. He was being precise. Death is the one deadline that cannot be renegotiated, and the Stoics found that remembering it does not poison life. It concentrates it.',
      'The trivial argument loses its appeal when you remember the clock. So does the postponed call, the unwritten page, the apology you have been holding. Memento mori does not tell you to hurry. It tells you to choose, because choosing is what a finite life is for.',
      'Seven letters. The foundations are laid: the practice, the dichotomy, the rehearsal, the examination, the virtues, the view, and now the clock. None of it was complicated. It never is. The whole discipline is remembering what you already know, daily, until you act on it.',
      'The letters end. The practice does not. The hourglass turns.',
    ],
    tomorrow: null,
  },
];
