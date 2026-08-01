// Morning + Evening journal prompts. Extracted so both the Journal
// "write" view (app/journal.jsx) and the Past Entries view
// (app/journal-history.jsx) can render the same prompt copy when
// displaying or editing past entries.

export const morningPrompts = [
  {
    num: 'I · Discern',
    q: 'What is in my control today — and what must I release?',
    hint: "The Stoics divide all things into two categories: what is 'up to us' and what is not. Up to us: our judgments, intentions, how we respond. Not up to us: other people's behavior, outcomes, reputation, the weather, the economy.\n\nImportantly, your thoughts themselves are not fully in your control: they arise unbidden. What is in your control is whether you assent to a thought, dwell on it, act on it. The Stoic practice is not suppression but discernment: this impression is mine to engage with; that one I can let pass.\n\nReleasing what is not yours doesn't mean you don't care. It means you stop exhausting yourself on things you cannot move.",
  },
  {
    num: 'II · Brace',
    q: 'Where will courage be required of me today?',
    hint: "Courage (andreia) is one of the four cardinal Virtues, but the Stoics meant something precise by it. Not recklessness, not aggression. The willingness to act rightly even when it is uncomfortable, costly, or unpopular.\n\nCourage is required whenever you know what the right thing is but feel resistance to doing it: the difficult conversation you've been avoiding, the boundary you need to hold, the work that demands your honest effort when distraction is easier.\n\nAsking this in the morning puts you on alert. You've named the moment before it arrives. When it comes, you've already decided.",
  },
  {
    num: 'III · Name',
    q: 'What am I postponing that matters? Name one thing.',
    hint: "Seneca opened On the Shortness of Life with a charge: it is not that we have a short time to live, but that we waste much of it. We are experts at deferring what matters in favor of what is urgent, easy, or comfortable.\n\nThe Stoics were deeply aware of mortality as a clarifying force. If you knew today was your last, what would you regret not having done? That regret is information. It points at what actually matters to you beneath the noise of daily preference.\n\nNaming one thing — just one — makes it real. The act of naming is the act of committing. Not to completing it today necessarily, but to acknowledging that it exists and that you are responsible for it.",
  },
  {
    num: 'IV · Foresee',
    q: 'What difficulty might I face today, and how would a person of Virtue meet it?',
    hint: "This is premeditatio malorum: the premeditation of adversity. The Stoics practiced it daily. Marcus Aurelius began most mornings by mentally rehearsing the difficult people and situations he would face.\n\nModern research confirms what the Stoics intuited: negative visualization — mentally simulating obstacles before they occur — reduces anxiety and improves performance. It works because the obstacle loses its power to surprise you. You've already met it, already chosen your response.\n\nAsk: not 'what bad thing might happen' in a fearful way, but 'how would a person who embodies wisdom, courage, and justice meet this?' You're not predicting disaster. You're rehearsing Virtue.",
  },
  {
    num: 'V · Question',
    q: 'What impression am I carrying into today that deserves examination before I act on it?',
    hint: "A worry, assumption, or reaction I haven't questioned yet.",
    info: {
      title: 'The Discipline of Assent',
      source: 'Epictetus, Discourses 1.1',
      body: "Epictetus taught that between every event and your response, there is a moment where an impression arises in the mind. Before you act on it, you can examine it. Is this impression accurate? Is what is troubling me actually harmful, or does it just feel that way?\n\nHe called this the discipline of assent: choosing which impressions to accept and which to question.\n\nExamples of impressions worth examining:\n\n• You check your phone and read a terse message. The impression: \"this person is angry with me.\" Is that what the words actually say, or is that one interpretation?\n\n• You have a difficult meeting today. The impression: \"this will go badly and I will not handle it well.\" Is that a fact, or a story?\n\n• Something didn't work out last week. The impression: \"I am behind, things aren't working.\" Is that an accurate reading of reality, or a judgment made on incomplete information?\n\nThe practice is not to eliminate the impression. It is to see it clearly before deciding whether to act on it.",
    },
  },
];

// STORAGE CONTRACT — read before touching this array.
//
// A prompt's INDEX here is its answer key in saved entries (see the
// `answerKey` mapping in app/journal.jsx), and both journal-history.jsx and
// JournalEntryEditor.jsx look past answers up by that index. Reordering or
// splicing this array would silently re-label every entry a user has already
// written. NEVER reorder, NEVER splice. Append only.
//
// `order` drives DISPLAY position, which is decoupled from storage for
// exactly that reason. III · Undone was added after the original four, so it
// lives at index 4 but renders third — the order Epictetus gives the evening
// examination in Discourses III.10 (did well, did badly, left undone), which
// is also the order quoted on the evening landing screen.
export const eveningPrompts = [
  {
    order: 0,
    num: 'I · Examine',
    q: 'Where did I act in accordance with my Virtue today?',
    // `sub` carries Epictetus's canonical question in a quiet register beneath
    // the app's fuller one, so the three-question spine of the evening reads
    // down the screen every night. It used to be carried by the landing
    // memento alone, which now rotates and shows this quote only 1 night in 5.
    // III · Undone needs no sub: its question already IS the third question.
    sub: 'What did I do well?',
    hint: "The evening Examen begins with what went right, not as self-congratulation but as honest accounting. The Stoics believed Virtue was not an abstract aspiration but something demonstrated in specific moments: how you treated a person who frustrated you, whether you kept your word, whether you were present.\n\nLooking for evidence of Virtue is a skill. Most people are faster to notice their failures than their successes. Naming what you did well isn't vanity. It's recognizing the character you're building, reinforcing the pattern you want to continue.\n\nBe specific. 'I was patient' is less useful than 'I stayed calm when the meeting ran over and I still gave my colleague my full attention.'",
  },
  {
    order: 1,
    num: 'II · Confess',
    q: 'Where did I fall short? What would a person of Virtue have done?',
    sub: 'What did I do badly?',
    hint: "The Stoics were unflinching self-examiners. Seneca wrote that we should 'censure' ourselves each evening, not to generate guilt but to learn. The goal is not punishment. It's accuracy.\n\nWhere you fell short tells you something true about yourself: a pattern of avoidance, a recurring trigger, a Virtue you haven't yet developed. That information is valuable only if you look at it clearly rather than explaining it away or dwelling in shame.\n\nThe second question — what would a person of Virtue have done? — is the productive pivot. It transforms the failure from a verdict into a lesson. You're not broken. You're practicing.",
  },
  {
    order: 3,
    num: 'IV · Release',
    q: 'What am I carrying that I must set down before I sleep?',
    hint: "Epictetus taught that many of our burdens are not ours to carry. We've picked them up through habit, obligation, or the failure to distinguish what is ours from what is not.\n\nSome things you carry are legitimate: responsibilities, relationships, real problems that need your attention tomorrow. But many are not: the conversation that looped all day, the slight that happened and cannot be undone, the worry about something you cannot control.\n\nSetting something down doesn't mean it disappears. It means you stop running it in the background when it serves no purpose. Sleep is not for processing. What needs to be carried tomorrow will be there tomorrow. What doesn't — let it go tonight.\n\nSeneca's own examination ends with a line the practice needs: see that you do it no more, for now I pardon you. The accounting is finished when it is finished. Carrying the verdict past the examination is not rigor, it is one more burden picked up out of habit.",
  },
  {
    order: 4,
    num: 'V · Gratitude',
    q: 'Who, or what, deserves my thanks today? Name one, and be specific.',
    hint: "Marcus opens the Meditations not with doctrine but with debts: what his grandfather taught him about temper, what Rusticus taught him about writing plainly, what his mother showed him about generosity. Book One is almost entirely gratitude, and nearly all of it is owed to people.\n\nStoic gratitude is not the forced positivity of modern self-help. It is a corrective to a perceptual error: we habituate to what we have and stop seeing it. The practice is attention, not cheerfulness.\n\nThe specificity matters. 'I'm grateful for my health' is a thought. 'I noticed my body carried me through a hard day without complaint' is perception.\n\nOne thing. However small. The smaller the better, in some ways. It proves you were paying attention.",
  },
  {
    // Appended (index 4) to preserve saved-entry keys; displays third.
    order: 2,
    num: 'III · Undone',
    q: 'What did I leave undone that was mine to do?',
    hint: 'A duty deferred, not a thing done badly.',
    info: {
      title: 'The Three Questions',
      source: 'Epictetus, Discourses III.10',
      body: "Epictetus set three questions at the center of the evening examination, borrowed from an older verse: Where did I go wrong? What did I do? And what duty did I leave undone?\n\nThe third is the one most often skipped, because it is the quietest. Acting badly announces itself. Not acting at all does not. The obligation you meant to meet, the person you meant to call, the work that was yours and stayed untouched: none of it makes a sound.\n\nThis is not a task list. Not every unfinished thing was a duty, and a day is not a failure because it did not empty your inbox. Ask what was actually yours to do.\n\nName it plainly and leave it named. 'I did not touch it' is a complete and honest answer, and writing it down is how the pattern becomes visible. Tomorrow it is either done, or it is answered for again.",
    },
  },
];

// Answer key of III · Undone. Exported because journal.jsx merges the
// morning-commitment echo into this prompt, and journal-history.jsx renders
// the quoted morning words above its answer.
export const UNDONE_KEY = 4;

// Display-ordered view with the storage key attached. The writing wizard,
// the archive, and the entry editor all render from this so the practice
// reads in Epictetus's order while saved answers keep their original keys.
export const eveningPromptsInOrder = eveningPrompts
  .map((p, i) => ({ ...p, answerKey: i }))
  .sort((a, b) => a.order - b.order);
