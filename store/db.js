import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  JOURNALS: 'journals',
  TRIGGERS: 'triggers',
  REVIEWS: 'reviews',
  COMPASS: 'compass',
  ROLES: 'compass_roles',
  STREAK: 'streak',
};

export async function saveJournal(entry) {
  try {
    const existing = await getJournals();
    const today = new Date().toDateString();
    const filtered = existing.filter(j => !(j.type === entry.type && new Date(j.date).toDateString() === today));
    await AsyncStorage.setItem(KEYS.JOURNALS, JSON.stringify([entry, ...filtered]));
    return true;
  } catch (e) { return false; }
}

export async function getJournals() {
  try {
    const raw = await AsyncStorage.getItem(KEYS.JOURNALS);
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
}

export async function getTodayJournal(type) {
  const journals = await getJournals();
  const today = new Date().toDateString();
  return journals.find(j => j.type === type && new Date(j.date).toDateString() === today) || null;
}

export async function saveTrigger(entry) {
  try {
    const existing = await getTriggers();
    await AsyncStorage.setItem(KEYS.TRIGGERS, JSON.stringify([entry, ...existing]));
    return true;
  } catch (e) { return false; }
}

export async function getTriggers() {
  try {
    const raw = await AsyncStorage.getItem(KEYS.TRIGGERS);
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
}

export async function saveReview(entry) {
  try {
    const existing = await getReviews();
    await AsyncStorage.setItem(KEYS.REVIEWS, JSON.stringify([entry, ...existing]));
    return true;
  } catch (e) { return false; }
}

export async function getReviews() {
  try {
    const raw = await AsyncStorage.getItem(KEYS.REVIEWS);
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
}

export async function saveCompass(data) {
  try {
    await AsyncStorage.setItem(KEYS.COMPASS, JSON.stringify(data));
    return true;
  } catch (e) { return false; }
}

export async function getCompass() {
  try {
    const raw = await AsyncStorage.getItem(KEYS.COMPASS);
    return raw ? JSON.parse(raw) : {
      why: 'I am drawn to Stoicism because it offers something rare — a practical philosophy for living well, tested across centuries. Not theory. Not productivity hacks. A system for becoming someone you respect.',
      overcome: 'I want to worry less about what I cannot control. To respond instead of react. To free myself from the anxiety of other people\'s opinions and the tyranny of my own undisciplined mind.',
      aspire: 'I want to meet adversity with calm and fortune with humility. To live each day with intention — not perfectly, but deliberately. To be someone who acts in accordance with their values, even when it\'s hard.',
    };
  } catch (e) { return {}; }
}

// Stoic discipline of action — the user's named relational positions
// (parent, partner, colleague, citizen, human being, etc.) with an
// optional one-line commitment per role. Lives alongside the Compass
// values because roles are part of orientation. Schema:
//   [{ id, name, commitment }]
export async function getRoles() {
  try {
    const raw = await AsyncStorage.getItem(KEYS.ROLES);
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
}

export async function saveRoles(roles) {
  try {
    await AsyncStorage.setItem(KEYS.ROLES, JSON.stringify(roles));
    return true;
  } catch (e) { return false; }
}

const EMPTY_STREAK = { current: 0, longest: 0, totalDays: 0, lastDate: null, sealedDays: 0, lastSealedDate: null };

export async function getStreak() {
  try {
    const raw = await AsyncStorage.getItem(KEYS.STREAK);
    if (!raw) return { ...EMPTY_STREAK };
    let streak = JSON.parse(raw);
    if (streak.count !== undefined && streak.current === undefined) {
      streak = { current: streak.count, longest: streak.count, totalDays: streak.count, lastDate: streak.lastDate };
    }
    // Migration for the "any practice keeps the flame" rework: before it,
    // a day only counted when all four practices were done, so every
    // pre-rework totalDay was a sealed day. Persisted on the next increment.
    if (streak.sealedDays === undefined) {
      streak.sealedDays = streak.totalDays || 0;
      streak.lastSealedDate = streak.lastDate || null;
    }
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    const twoDaysAgo = new Date(Date.now() - 172800000).toDateString();
    // Grace day: one missed day doesn't break the streak
    if (streak.lastDate !== today && streak.lastDate !== yesterday && streak.lastDate !== twoDaysAgo) {
      return { ...streak, current: 0 };
    }
    return streak;
  } catch (e) { return { ...EMPTY_STREAK }; }
}

// "Any practice keeps the flame": the day is credited on the FIRST completed
// practice (every completion writer calls this), in the spirit of direction
// over perfection — Epictetus measures progress by showing up, and the old
// all-four-or-nothing rule zeroed out genuinely practiced days. A fully
// examined day (all four practices) is tracked separately as the rarer,
// earned mark: the seal.
export async function incrementStreak() {
  try {
    const streak = await getStreak();
    const today = new Date().toDateString();
    const updated = { ...streak };
    let changed = false;

    if (streak.lastDate !== today) {
      const newCurrent = (streak.current || 0) + 1;
      updated.current = newCurrent;
      updated.longest = Math.max(newCurrent, streak.longest || 0);
      updated.totalDays = (streak.totalDays || 0) + 1;
      updated.lastDate = today;
      changed = true;
    }

    if (updated.lastSealedDate !== today) {
      const morning = await getTodayJournal('morning');
      const evening = await getTodayJournal('evening');
      const reading = await getTodayReading();
      const compass = await getCompassDone();
      if (morning && evening && reading && compass) {
        updated.sealedDays = (updated.sealedDays || 0) + 1;
        updated.lastSealedDate = today;
        changed = true;
      }
    }

    if (changed) {
      await AsyncStorage.setItem(KEYS.STREAK, JSON.stringify(updated));
      return updated;
    }
    return streak;
  } catch (e) { return { ...EMPTY_STREAK }; }
}

export async function getTodayReading() {
  try {
    const raw = await AsyncStorage.getItem('reading_today');
    if (!raw) return null;
    const reading = JSON.parse(raw);
    if (reading.date !== new Date().toDateString()) return null;
    return reading;
  } catch (e) { return null; }
}

export async function saveTodayReading(reading) {
  try {
    await AsyncStorage.setItem('reading_today', JSON.stringify({
      ...reading,
      date: new Date().toDateString(),
    }));
    await addToReadingHistory(reading);
    // The reading may be the user's final practice of the day — credit the
    // streak here too. incrementStreak is idempotent (lastDate check) and
    // self-gates on all four practices being done, so every completion
    // writer can safely call it regardless of the order the user finished in.
    await incrementStreak();
    return true;
  } catch (e) { return false; }
}

export async function addToReadingHistory(reading) {
  try {
    const raw = await AsyncStorage.getItem('reading_history');
    const history = raw ? JSON.parse(raw) : [];
    const entry = {
      date: new Date().toISOString(),
      author: reading.author,
      quote: reading.quote,
      theme: reading.theme,
      reflection: reading.reflection,
    };
    const updated = [entry, ...history];
    await AsyncStorage.setItem('reading_history', JSON.stringify(updated));
    return true;
  } catch (e) { return false; }
}

export async function getReadingHistory() {
  try {
    const raw = await AsyncStorage.getItem('reading_history');
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
}

export async function getLastVirtueFocus() {
  try {
    const raw = await AsyncStorage.getItem(KEYS.JOURNALS);
    if (!raw) return null;
    const journals = JSON.parse(raw);
    const morning = journals
      .filter(j => j.type === 'morning' && j.virtue)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    return morning[0]?.virtue || null;
  } catch (e) { return null; }
}

export async function saveReadingInsight(insight) {
  try {
    const existing = await getReadingLog();
    const today = new Date().toDateString();
    const filtered = existing.filter(r => r.date !== today);
    const todayReading = await getTodayReading();
    await AsyncStorage.setItem('reading_log', JSON.stringify([
      { id: Date.now().toString(), date: today, reading: todayReading, insight },
      ...filtered,
    ]));
    // Mirror the insight onto today's reading so the Reading screen shows
    // it when the user returns later in the day. Generating a new reading
    // overwrites reading_today entirely, which resets the field as expected.
    if (todayReading) {
      await AsyncStorage.setItem('reading_today', JSON.stringify({
        ...todayReading,
        insight,
      }));
    }
    return true;
  } catch (e) { return false; }
}

export async function getReadingLog() {
  try {
    const raw = await AsyncStorage.getItem('reading_log');
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
}

// Reading generation rate limits. Caps AI cost exposure per paid user so
// subscription unit economics stay positive even for power users / abuse.
// Day cap protects against burst generation; month cap against sustained
// heavy use. Adjust constants based on cost data over time.
export const READING_DAY_CAP = 5;
export const READING_MONTH_CAP = 100;

function readingDayKey(d = new Date()) {
  return `reading_count_${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function readingMonthKey(d = new Date()) {
  return `reading_count_month_${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export async function getReadingCounts() {
  try {
    const dayRaw = await AsyncStorage.getItem(readingDayKey());
    const monthRaw = await AsyncStorage.getItem(readingMonthKey());
    return {
      dayCount: dayRaw ? parseInt(dayRaw, 10) : 0,
      monthCount: monthRaw ? parseInt(monthRaw, 10) : 0,
    };
  } catch (e) {
    return { dayCount: 0, monthCount: 0 };
  }
}

export async function incrementReadingCount() {
  try {
    const { dayCount, monthCount } = await getReadingCounts();
    const nextDay = dayCount + 1;
    const nextMonth = monthCount + 1;
    await AsyncStorage.setItem(readingDayKey(), String(nextDay));
    await AsyncStorage.setItem(readingMonthKey(), String(nextMonth));
    return { dayCount: nextDay, monthCount: nextMonth };
  } catch (e) {
    return { dayCount: 0, monthCount: 0 };
  }
}

export async function updateReadingInsight(id, insight) {
  try {
    const all = await getReadingLog();
    const updated = all.map(e => (e.id === id ? { ...e, insight } : e));
    await AsyncStorage.setItem('reading_log', JSON.stringify(updated));
    // If the edited entry is today's reading, mirror the change onto
    // reading_today so the live Reading screen reflects the revision.
    const today = new Date().toDateString();
    const edited = updated.find(e => e.id === id);
    if (edited?.date === today) {
      const todayRaw = await AsyncStorage.getItem('reading_today');
      if (todayRaw) {
        const todayReading = JSON.parse(todayRaw);
        await AsyncStorage.setItem('reading_today', JSON.stringify({ ...todayReading, insight }));
      }
    }
    return true;
  } catch (e) { return false; }
}

export async function getCompassDone() {
  try {
    const raw = await AsyncStorage.getItem('compass_done');
    if (!raw) return false;
    const { date } = JSON.parse(raw);
    return date === new Date().toDateString();
  } catch (e) { return false; }
}

export async function persistCompassDone() {
  try {
    await AsyncStorage.setItem('compass_done', JSON.stringify({
      date: new Date().toDateString(),
    }));
    // Same as saveTodayReading: the compass may be the last step completed
    // today, so credit the streak from here as well (idempotent, self-gated).
    await incrementStreak();
    return true;
  } catch (e) { return false; }
}

export async function clearCompassDone() {
  try {
    await AsyncStorage.removeItem('compass_done');
    return true;
  } catch (e) { return false; }
}

export async function clearTodayPractice() {
  try {
    await AsyncStorage.removeItem('compass_done');
    await AsyncStorage.removeItem('reading_today');
    const raw = await AsyncStorage.getItem(KEYS.JOURNALS);
    const journals = raw ? JSON.parse(raw) : [];
    const today = new Date().toDateString();
    const remaining = journals.filter(j => new Date(j.date).toDateString() !== today);
    await AsyncStorage.setItem(KEYS.JOURNALS, JSON.stringify(remaining));
    return true;
  } catch (e) { return false; }
}

export async function sealTodayPractice() {
  try {
    const todayStr = new Date().toDateString();
    const todayIso = new Date().toISOString();
    await persistCompassDone();
    await saveTodayReading({
      quote: 'You have power over your mind — not outside events. Realize this, and you will find strength.',
      author: 'Marcus Aurelius',
      work: 'Meditations',
      theme: 'Inner Citadel',
      virtue: 'Wisdom',
      event_date: null,
      event_url: null,
      reflection: '[Test seed reading — created via Developer → Seal today\'s practice.]',
    });
    const raw = await AsyncStorage.getItem(KEYS.JOURNALS);
    const journals = raw ? JSON.parse(raw) : [];
    const filtered = journals.filter(j => new Date(j.date).toDateString() !== todayStr);
    const synthetic = ['morning', 'evening'].map(type => ({
      id: `seed-${type}-${Date.now()}`,
      type,
      date: todayIso,
      virtue: 'wisdom',
      answers: { 0: '[Seeded for testing.]' },
    }));
    await AsyncStorage.setItem(KEYS.JOURNALS, JSON.stringify([...synthetic, ...filtered]));
    return true;
  } catch (e) { return false; }
}

export async function hasOnboarded() {
  try {
    const raw = await AsyncStorage.getItem('has_onboarded');
    return raw === 'true';
  } catch (e) { return false; }
}

export async function setHasOnboarded() {
  try {
    await AsyncStorage.setItem('has_onboarded', 'true');
    return true;
  } catch (e) { return false; }
}

// Compass intro flag — gates the first-visit walkthrough on /compass.
// Returns null when never set so the caller can distinguish "explicitly
// false" from "no value yet" for migration purposes.
export async function getHasSeenCompassIntro() {
  try {
    const raw = await AsyncStorage.getItem('has_seen_compass_intro');
    if (raw === null) return null;
    return raw === 'true';
  } catch (e) { return null; }
}

export async function setHasSeenCompassIntro(value) {
  try {
    await AsyncStorage.setItem('has_seen_compass_intro', value ? 'true' : 'false');
    return true;
  } catch (e) { return false; }
}

export async function updateJournalEntry(updated) {
  try {
    const all = await getJournals();
    const filtered = all.filter(j => j.id !== updated.id);
    await AsyncStorage.setItem(KEYS.JOURNALS, JSON.stringify([updated, ...filtered]));
    return true;
  } catch (e) { return false; }
}

export async function updateTriggerEntry(updated) {
  try {
    const all = await getTriggers();
    const filtered = all.filter(t => t.id !== updated.id);
    await AsyncStorage.setItem(KEYS.TRIGGERS, JSON.stringify([updated, ...filtered]));
    return true;
  } catch (e) { return false; }
}

export async function updateReview(updated) {
  try {
    const all = await getReviews();
    const filtered = all.filter(r => r.id !== updated.id);
    await AsyncStorage.setItem(KEYS.REVIEWS, JSON.stringify([updated, ...filtered]));
    return true;
  } catch (e) { return false; }
}

// Dev seed: 7 days of completed journals + a believable spread of emotion logs
// with intensities trending down across the week, so weekly-review trend
// visualizations have a clear directional signal to render. Wipes existing
// journals and triggers so repeated presses stay idempotent. Today is left
// untouched so the user can still test live practice on top.
export async function seedWeekOfPracticeData() {
  const dayMs = 86400000;
  const now = Date.now();
  const dayOffsets = [7, 6, 5, 4, 3, 2, 1];
  const virtueRotation = ['wisdom', 'courage', 'justice', 'moderation', 'courage', 'wisdom', 'justice'];

  const morningAnswers = [
    { 0: 'Outcomes at work are not in my control. My focus and effort are.', 1: 'Telling my manager I cannot take on the third project this week.', 2: 'The performance-review write-up I have been postponing.', 3: 'Anxiety about the meeting at 2pm — meet it with preparation, not avoidance.' },
    { 0: 'Other people\'s opinions of me are outside my control. My integrity is.', 1: 'Holding the line on the deadline I set for myself.', 2: 'Calling my father.', 3: 'A coworker may push back hard. Hear them, do not absorb their frustration.' },
    { 0: 'Traffic, weather, what others say. I release these.', 1: 'Saying no to the after-work drinks I do not actually want.', 2: 'Reviewing the budget I have been avoiding.', 3: 'A difficult email may arrive. Read it once, respond once, do not relitigate.' },
    { 0: 'I cannot control whether the deal closes. I can control how I prepare.', 1: 'Limiting myself to one coffee and stopping doomscrolling at lunch.', 2: 'Writing the apology message I owe.', 3: 'Tiredness will tempt me toward shortcuts. Slow down instead of rushing.' },
    { 0: 'My reaction is mine. The provocation is not.', 1: 'Pushing back on the scope creep in this morning\'s standup.', 2: 'Booking the dentist appointment.', 3: 'Boredom in the afternoon. The sage works through dullness — they do not flee it.' },
    { 0: 'How long this takes is not in my control. The quality of my attention is.', 1: 'Sitting with the discomfort of the hard conversation rather than rehearsing escape lines.', 2: 'The book I started six weeks ago.', 3: 'Comparison thoughts. They will arise. I will let them pass without engagement.' },
    { 0: 'The outcome of the conversation is not mine. The honesty I bring to it is.', 1: 'Telling my friend the truth about the project even though it disappoints them.', 2: 'The thank-you note I owe.', 3: 'Fatigue. Meet it with steadiness — small steps, no dramatics.' },
  ];

  const eveningAnswers = [
    { 0: 'Stayed calm when the deploy failed. Walked through the rollback methodically.', 1: 'Snapped at my partner over something small. The Stoic would have noticed the tiredness and held the comment.', 2: 'The lingering frustration about the meeting. It is over. I can put it down.', 3: 'A clear hour of focused work. Rare and worth noticing.' },
    { 0: 'Said no, gently, to a request I did not have capacity for.', 1: 'Spent thirty minutes on social media when I had said I would read. The Stoic does what they planned.', 2: 'A worry about next month\'s rent. Tomorrow it will still be there. Tonight I let it go.', 3: 'A long walk after work. The cold air felt like a gift.' },
    { 0: 'Kept my promise to call my father. The conversation went better than I expected.', 1: 'Cut someone off in the meeting. The Stoic would have waited and listened first.', 2: 'A regret about a decision I made last year. It is done. I cannot edit it.', 3: 'The meal a friend made for me. Simple food, presented with care.' },
    { 0: 'Apologized clearly when I was wrong. No hedging.', 1: 'Avoided the difficult email until 4pm. I knew it was there. I should have opened it at 9.', 2: 'A small disappointment from a friend who did not show up. Not mine to carry overnight.', 3: 'My morning coffee. The exact taste of it. Attention paid.' },
    { 0: 'Pushed back on the scope creep without making it personal.', 1: 'Ate too much at lunch out of boredom rather than hunger. The Stoic eats deliberately.', 2: 'A conversation that looped in my head. I have decided what I will say tomorrow. Tonight I sleep.', 3: 'Sunlight through the window in the afternoon. Five seconds of pure presence.' },
    { 0: 'Sat with my discomfort during the hard conversation rather than rushing to resolve it.', 1: 'Refreshed my email three times in the last hour of the day. Not the practice I want.', 2: 'A small worry about my health. I have an appointment booked. The rest is not in my hands tonight.', 3: 'A line of poetry I read this morning that came back to me unprompted.' },
    { 0: 'Told my friend the difficult truth, with kindness. They received it well.', 1: 'Was short with someone who asked me a reasonable question. I will follow up tomorrow.', 2: 'The sense that I am behind on something undefined. I will define it tomorrow morning. Tonight I rest.', 3: 'My health. Quiet, reliable, easy to forget.' },
  ];

  const journalsForWeek = [];
  dayOffsets.forEach((offset, i) => {
    const dayIso = new Date(now - offset * dayMs).toISOString();
    journalsForWeek.push({
      id: `seed-morning-${offset}-${now}`,
      type: 'morning',
      date: dayIso,
      virtue: virtueRotation[i],
      answers: morningAnswers[i],
    });
    journalsForWeek.push({
      id: `seed-evening-${offset}-${now}`,
      type: 'evening',
      date: dayIso,
      virtue: virtueRotation[i],
      answers: eveningAnswers[i],
    });
  });

  // 12 emotion logs spread across the week. Intensities trend down from 8
  // early in the week to 3 late, so a weekly-review trend chart has a clear
  // "got better" signal. Anxiety is the dominant emotion (~40%), so the
  // breakdown bar chart shows a clean leader. Roughly half have a
  // chosenResponse set, modeling reframes.
  const triggerSpec = [
    { offset: 7, hours: 11, emotion: 'anxiety',     intensity: 8, trigger: 'Manager scheduled an unexpected 1:1 for tomorrow.',                              reaction: 'Spiraled into worst-case scenarios for an hour.', chosen: '' },
    { offset: 7, hours: 19, emotion: 'frustration', intensity: 7, trigger: 'Partner left dishes in the sink again after we agreed.',                          reaction: 'Snapped at them when they walked in.',           chosen: '' },
    { offset: 6, hours: 9,  emotion: 'anger',       intensity: 8, trigger: 'Coworker took credit for my analysis in the team meeting.',                       reaction: 'Stewed about it for the rest of the morning.',   chosen: '' },
    { offset: 6, hours: 16, emotion: 'anxiety',     intensity: 7, trigger: 'Saw an article about my industry that hit close to home.',                        reaction: 'Caught myself doomscrolling.',                   chosen: '' },
    { offset: 5, hours: 14, emotion: 'envy',        intensity: 5, trigger: 'Saw a former classmate post about a promotion on LinkedIn.',                       reaction: 'Compared my last two years to theirs.',          chosen: '' },
    { offset: 5, hours: 21, emotion: 'anxiety',     intensity: 6, trigger: 'Rent increase notice arrived in the mail.',                                       reaction: 'Tried to calculate everything at once.',         chosen: 'Acknowledge it, sit with it, and look at the numbers properly tomorrow with a clear head.' },
    { offset: 4, hours: 10, emotion: 'frustration', intensity: 5, trigger: 'Build broke right before the demo.',                                              reaction: 'Felt my chest tighten.',                         chosen: '' },
    { offset: 4, hours: 18, emotion: 'fear',        intensity: 5, trigger: 'Realized I had not prepared enough for tomorrow\'s presentation.',                reaction: 'Procrastinated more, ironically.',               chosen: 'I cannot make tomorrow not exist. I can prepare for the next ninety minutes. That is what is in my control.' },
    { offset: 3, hours: 13, emotion: 'anxiety',     intensity: 4, trigger: 'Did not hear back from the recruiter for three days.',                            reaction: 'Wanted to send a follow-up immediately.',        chosen: 'Their silence is not about me. I will give it the rest of the week before following up. The wait is not mine to fill.' },
    { offset: 3, hours: 22, emotion: 'grief',       intensity: 4, trigger: 'Anniversary of grandfather\'s death.',                                            reaction: 'Felt heavy all evening.',                        chosen: 'Sit with it. Honor him by remembering, not by performing okay-ness.' },
    { offset: 2, hours: 12, emotion: 'frustration', intensity: 3, trigger: 'Traffic made me late to lunch.',                                                  reaction: 'Started planning angry texts in my head.',       chosen: 'The traffic is not in my control. My friend will understand. Arrive present, not still arguing with the cars.' },
    { offset: 1, hours: 17, emotion: 'anxiety',     intensity: 3, trigger: 'Slight headache; first thought was the worst.',                                   reaction: 'Started searching symptoms.',                    chosen: 'Drink water, eat something, see if it passes. Most headaches are headaches.' },
  ];
  const triggers = triggerSpec.map((t, i) => {
    const d = new Date(now - t.offset * dayMs);
    d.setHours(t.hours, Math.floor(Math.random() * 60), 0, 0);
    return {
      id: `seed-trigger-${t.offset}-${i}-${now}`,
      date: d.toISOString(),
      emotion: t.emotion,
      intensity: t.intensity,
      timing: 'past',
      trigger: t.trigger,
      reaction: t.reaction,
      stoicResponse: '',
      chosenResponse: t.chosen,
      distortions: [],
    };
  });

  await AsyncStorage.setItem(KEYS.JOURNALS, JSON.stringify(journalsForWeek));
  await AsyncStorage.setItem(KEYS.TRIGGERS, JSON.stringify(triggers));

  const yesterday = new Date(now - dayMs).toDateString();
  await AsyncStorage.setItem(KEYS.STREAK, JSON.stringify({
    current: 7,
    longest: 7,
    totalDays: 7,
    lastDate: yesterday,
    sealedDays: 7,
    lastSealedDate: yesterday,
  }));

  return { journals: journalsForWeek.length, triggers: triggers.length };
}