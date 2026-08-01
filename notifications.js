import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_COMPASS } from './constants/compassFields';

// How notifications appear when app is foregrounded. shouldShowBanner /
// shouldShowList are the current expo-notifications keys; shouldShowAlert is
// kept for back-compat until the SDK drops the deprecated mapping.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function requestNotificationPermissions() {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  return finalStatus === 'granted';
}

// Helper — check if a journal type is done today without importing db
// (avoids circular dependency)
async function isTodayJournalDone(type) {
  try {
    const raw = await AsyncStorage.getItem('journals');
    if (!raw) return false;
    const journals = JSON.parse(raw);
    const today = new Date().toDateString();
    return journals.some(j => j.type === type && new Date(j.date).toDateString() === today);
  } catch { return false; }
}

async function isTodayReadingDone() {
  try {
    const raw = await AsyncStorage.getItem('reading_today');
    if (!raw) return false;
    const reading = JSON.parse(raw);
    return reading.date === new Date().toDateString();
  } catch { return false; }
}

async function isTodayCompassDone() {
  try {
    // Written by db.js persistCompassDone under 'compass_done' as { date }.
    const raw = await AsyncStorage.getItem('compass_done');
    if (!raw) return false;
    const { date } = JSON.parse(raw);
    return date === new Date().toDateString();
  } catch { return false; }
}

// A short phrase from the user's own Compass for personalized reminder
// variants. Only the aspirational fields (aspire, then why) — never
// `overcome`, which is the confessional one and has no place on a lock
// screen. Returns null when the user hasn't written their own Compass
// (the onboarding default must not be quoted back as if it were theirs).
async function getCompassPhrase() {
  try {
    const raw = await AsyncStorage.getItem('compass');
    if (!raw) return null;
    const compass = JSON.parse(raw);
    for (const key of ['aspire', 'why']) {
      const text = (compass?.[key] || '').trim();
      if (!text || text === DEFAULT_COMPASS[key]) continue;
      // First sentence, clipped — a fragment of their own voice, not a wall.
      const sentence = text.split(/(?<=[.!?])\s+/)[0] || text;
      const phrase = sentence.length > 90 ? `${sentence.slice(0, 90)}…` : sentence;
      if (phrase.length >= 12) return phrase;
    }
    return null;
  } catch { return null; }
}

// Schedule one practice reminder. The subtlety: a repeating `daily` trigger
// can't suppress just today's fire, and skipping it entirely (the old
// behavior) also removed tomorrow's and every future day's reminder — a user
// who practiced today and didn't reopen the app got no reminder ever again.
//
// So: when the practice is already done today AND the reminder time is still
// ahead (a repeating trigger would ping after completion), schedule a
// one-shot for tomorrow instead; the repeating trigger is re-established on
// the next app open, which the one-shot itself usually prompts. In every
// other case use the repeating daily trigger so reminders keep firing even
// if the app isn't opened for days.
async function scheduleDailyReminder(identifier, content, hour, minute, doneToday) {
  const now = new Date();
  const timeAheadToday = hour * 60 + minute > now.getHours() * 60 + now.getMinutes();
  if (doneToday && timeAheadToday) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(hour, minute, 0, 0);
    await Notifications.scheduleNotificationAsync({
      identifier,
      content,
      trigger: { type: 'date', date: tomorrow },
    });
  } else {
    await Notifications.scheduleNotificationAsync({
      identifier,
      content,
      trigger: { type: 'daily', hour, minute },
    });
  }
}

// Stable identifiers for the practice reminders, so a re-sync replaces only
// these — a blanket cancelAllScheduledNotificationsAsync was also wiping the
// re-engagement notifications scheduled at boot (the two calls race).
const REMINDER_IDS = {
  compass: 'reminder-compass',
  reading: 'reminder-reading',
  morning: 'reminder-morning',
  evening: 'reminder-evening',
  midday: 'reminder-midday',
  review: 'reminder-review',
};

// reviewDay is 0=Sunday..6=Saturday (matches Date.getDay() used in index.jsx
// and the DAYS picker in settings). The review reminder names the chosen day
// so a user who picks Wednesday isn't told "Sunday reckoning".
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Re-entrancy guard: boot and the AppState foreground listener can both call
// this in quick succession (FaceID prompts cause inactive→active blips). Two
// interleaved runs would each cancel-all then schedule, duplicating every
// reminder. Concurrent callers share the in-flight run instead.
let scheduleInFlight = null;

export function scheduleAllNotifications() {
  if (scheduleInFlight) return scheduleInFlight;
  scheduleInFlight = doScheduleAllNotifications()
    .catch(() => {})
    .finally(() => { scheduleInFlight = null; });
  return scheduleInFlight;
}

async function doScheduleAllNotifications() {
  // Replace only the practice reminders (stable ids), never the
  // re-engagement notifications.
  await Promise.all(
    Object.values(REMINDER_IDS).map(id =>
      Notifications.cancelScheduledNotificationAsync(id).catch(() => {})
    )
  );

  const raw = await AsyncStorage.getItem('notification_settings');
  if (!raw) return;
  let settings;
  try {
    settings = JSON.parse(raw);
  } catch {
    return; // corrupt settings — leave everything unscheduled rather than throw
  }

  // Done-states fetched once: each reminder needs its own, and the evening
  // copy varies with the overall count (see below).
  const compassDoneToday = await isTodayCompassDone();
  const readingDoneToday = await isTodayReadingDone();
  const morningDoneToday = await isTodayJournalDone('morning');
  const eveningDoneToday = await isTodayJournalDone('evening');
  const doneCount = [compassDoneToday, readingDoneToday, morningDoneToday, eveningDoneToday].filter(Boolean).length;

  // Personalized variants: on odd days of the month, the morning and midday
  // reminders carry a fragment of the user's own Compass instead of the
  // standard copy. Deterministic by date so the many re-syncs within a day
  // agree; alternating keeps either register from going stale.
  const compassPhrase = await getCompassPhrase();
  const personalizedDay = compassPhrase && new Date().getDate() % 2 === 1;

  // Compass
  if (settings.compassEnabled) {
    await scheduleDailyReminder(
      REMINDER_IDS.compass,
      { title: 'Begin with your compass', body: 'Let it orient the day.', sound: false },
      settings.compassHour, settings.compassMinute,
      compassDoneToday,
    );
  }

  // Reading
  if (settings.readingEnabled) {
    await scheduleDailyReminder(
      REMINDER_IDS.reading,
      { title: "Today's reading is ready", body: 'A passage chosen for this day. Read it before the noise begins.', sound: false },
      settings.readingHour, settings.readingMinute,
      readingDoneToday,
    );
  }

  // Morning journal
  if (settings.morningEnabled) {
    await scheduleDailyReminder(
      REMINDER_IDS.morning,
      {
        title: 'Morning practice',
        body: personalizedDay
          ? `“${compassPhrase}” The day is waiting.`
          : 'The hourglass turns. Reflect and intend.',
        sound: false,
      },
      settings.morningHour, settings.morningMinute,
      morningDoneToday,
    );
  }

  // Evening journal. When three of four practices are already done, the
  // reminder names the gap — completion bias, in the house register. The
  // count reflects the last foreground re-sync, which is when this runs.
  if (settings.eveningEnabled) {
    await scheduleDailyReminder(
      REMINDER_IDS.evening,
      {
        title: 'The day closes',
        body: doneCount === 3 && !eveningDoneToday
          ? 'One step remains. The day is nearly sealed.'
          : 'Time to examine it before you sleep.',
        sound: false,
      },
      settings.eveningHour, settings.eveningMinute,
      eveningDoneToday,
    );
  }

  // Midday check-in — no completion state, always repeating
  if (settings.middayEnabled) {
    await Notifications.scheduleNotificationAsync({
      identifier: REMINDER_IDS.midday,
      content: {
        title: 'Pause',
        body: personalizedDay
          ? `“${compassPhrase}” Is that who showed up this morning?`
          : 'How has the morning gone? Have you acted in accordance with your values?',
        sound: false,
        // Tapping the midday reminder deep-links to the Prosoche checkpoint
        // (routed in app/_layout.jsx via the notification-response listener).
        data: { route: '/prosoche' },
      },
      trigger: { type: 'daily', hour: settings.middayHour, minute: settings.middayMinute },
    });
  }

  // Weekly review
  if (settings.reviewEnabled) {
    const reviewDayName = DAY_NAMES[(settings.reviewDay ?? 0) % 7] || 'Weekly';
    await Notifications.scheduleNotificationAsync({
      identifier: REMINDER_IDS.review,
      content: {
        title: `${reviewDayName} reckoning`,
        body: 'Five questions. The week is yours to close.',
        sound: false,
      },
      trigger: {
        type: 'weekly',
        weekday: (settings.reviewDay ?? 0) + 1,
        hour: settings.reviewHour,
        minute: settings.reviewMinute,
      },
    });
  }
}

// Call this when the app comes to foreground, or when a practice completes.
// A full re-sync replaces the old keyword-matching cancel: scheduleAll
// already reads each practice's done-state and suppresses only today's fire
// (one-shot-for-tomorrow), so completed practices stop pinging today without
// losing tomorrow's reminder — which the old cancel-the-repeating-trigger
// approach silently did.
export async function refreshNotificationsForToday() {
  await scheduleAllNotifications();
}

// Call immediately when a practice is completed. The type param is kept for
// call-site compatibility; the re-sync reads done-state directly.
export async function cancelJournalNotification(_type) {
  await scheduleAllNotifications();
}


// ─── TRIAL-END NOTICE ────────────────────────────────────────────────────────
// Honest heads-up two days before the trial converts: no surprise charges.
// Called from useEntitlement whenever RevenueCat reports an active trial;
// the stable identifier makes rescheduling idempotent. Surprise charges are
// refund requests and one-star reviews — the notice converts better than
// silence and is the registers' kind of honesty anyway.

const TRIAL_NOTICE_ID = 'trial-ending-notice';

export async function scheduleTrialEndingNotice(trialDaysLeft) {
  try {
    // Needs at least 3 days left so "in two days" lands on a future morning.
    // RevenueCat's own day-7 charge handles the final boundary.
    if (!trialDaysLeft || trialDaysLeft < 3) return;
    const t = new Date();
    t.setDate(t.getDate() + (trialDaysLeft - 2));
    t.setHours(10, 0, 0, 0);
    await Notifications.scheduleNotificationAsync({
      identifier: TRIAL_NOTICE_ID,
      content: {
        title: 'Your trial ends in two days',
        body: 'If the practice has earned its place, do nothing. If not, cancel anytime in iOS Settings.',
        sound: false,
      },
      trigger: { type: 'date', date: t },
    });
  } catch {}
}

// ─── RE-ENGAGEMENT NOTIFICATIONS ─────────────────────────────────────────────
// Pre-armed win-back ladder. Every app open (and every sealed day) re-arms
// four one-shots at +3 / +7 / +14 / +30 days out, each at 8am. They only
// ever fire if the user does NOT come back — any return re-arms the ladder
// from that day. The old model scheduled win-backs only after the user had
// already lapsed AND reopened the app, which is exactly backwards: the user
// who never reopens is the one the ladder exists for.

const REENGAGEMENT_LADDER = [
  {
    id: 'reengagement-day3',
    days: 3,
    title: 'Even Marcus missed days',
    body: 'He always returned. So can you.',
  },
  {
    id: 'reengagement-day7',
    days: 7,
    title: "It's been a week",
    body: 'Begin with one prompt. The rest follows.',
  },
  {
    id: 'reengagement-day14',
    days: 14,
    title: 'The page is still open',
    body: 'Your practice is where you left it. One quiet step back in.',
  },
  {
    id: 'reengagement-day30',
    days: 30,
    title: 'The practice does not judge absence',
    body: 'It waits. Today is as good a day as the first.',
  },
];

// 8am, `days` days from now — mornings are when resolve is highest.
function morningInDays(days, hour = 8) {
  const t = new Date();
  t.setDate(t.getDate() + days);
  t.setHours(hour, 0, 0, 0);
  return t;
}

export async function scheduleReengagementNotifications() {
  try {
    await cancelReengagementNotifications();
    for (const rung of REENGAGEMENT_LADDER) {
      await Notifications.scheduleNotificationAsync({
        identifier: rung.id,
        content: { title: rung.title, body: rung.body, sound: false },
        trigger: { type: 'date', date: morningInDays(rung.days) },
      });
    }
  } catch (e) {
    console.log('scheduleReengagementNotifications error:', e);
  }
}

export async function cancelReengagementNotifications() {
  try {
    for (const rung of REENGAGEMENT_LADDER) {
      await Notifications.cancelScheduledNotificationAsync(rung.id).catch(() => {});
    }
    // Clean up identifiers from the pre-ladder model so they can't fire.
    await Notifications.cancelScheduledNotificationAsync('reengagement-day2').catch(() => {});
  } catch (e) {
    console.log('cancelReengagementNotifications error:', e);
  }
}

// Call this when a practice is sealed — re-arms the ladder from today (the
// old behavior cancelled it outright, which meant a user who sealed today
// and never returned got no win-back at all).
export async function onPracticeSealed() {
  await scheduleReengagementNotifications();
}

export async function cancelAllNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
