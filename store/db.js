import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  JOURNALS: 'journals',
  TRIGGERS: 'triggers',
  REVIEWS: 'reviews',
  COMPASS: 'compass',
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

export async function getStreak() {
  try {
    const raw = await AsyncStorage.getItem(KEYS.STREAK);
    if (!raw) return { current: 0, longest: 0, totalDays: 0, lastDate: null };
    const streak = JSON.parse(raw);
    if (streak.count !== undefined && streak.current === undefined) {
      return { current: streak.count, longest: streak.count, totalDays: streak.count, lastDate: streak.lastDate };
    }
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    const twoDaysAgo = new Date(Date.now() - 172800000).toDateString();
    // Grace day: one missed day doesn't break the streak
    if (streak.lastDate !== today && streak.lastDate !== yesterday && streak.lastDate !== twoDaysAgo) {
      return { ...streak, current: 0 };
    }
    return streak;
  } catch (e) { return { current: 0, longest: 0, totalDays: 0, lastDate: null }; }
}

export async function incrementStreak() {
  try {
    const streak = await getStreak();
    const today = new Date().toDateString();
    if (streak.lastDate === today) return streak;
    const morning = await getTodayJournal('morning');
    const evening = await getTodayJournal('evening');
    const reading = await getTodayReading();
    const compass = await getCompassDone();
    if (!morning || !evening || !reading || !compass) return streak;
    const newCurrent = streak.current + 1;
    const updated = {
      current: newCurrent,
      longest: Math.max(newCurrent, streak.longest || 0),
      totalDays: (streak.totalDays || 0) + 1,
      lastDate: today,
    };
    await AsyncStorage.setItem(KEYS.STREAK, JSON.stringify(updated));
    return updated;
  } catch (e) { return { current: 0, longest: 0, totalDays: 0, lastDate: null }; }
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
    return true;
  } catch (e) { return false; }
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
    return true;
  } catch (e) { return false; }
}

export async function getReadingLog() {
  try {
    const raw = await AsyncStorage.getItem('reading_log');
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
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
    return true;
  } catch (e) { return false; }
}

export async function clearCompassDone() {
  try {
    await AsyncStorage.removeItem('compass_done');
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