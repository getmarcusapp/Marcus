import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

  // Compass
  if (settings.compassEnabled) {
    await scheduleDailyReminder(
      REMINDER_IDS.compass,
      { title: 'Begin with your compass', body: 'Let it orient the day.', sound: false },
      settings.compassHour, settings.compassMinute,
      await isTodayCompassDone(),
    );
  }

  // Reading
  if (settings.readingEnabled) {
    await scheduleDailyReminder(
      REMINDER_IDS.reading,
      { title: "Today's reading is ready", body: 'A passage chosen for this day. Read it before the noise begins.', sound: false },
      settings.readingHour, settings.readingMinute,
      await isTodayReadingDone(),
    );
  }

  // Morning journal
  if (settings.morningEnabled) {
    await scheduleDailyReminder(
      REMINDER_IDS.morning,
      { title: 'Morning practice', body: 'The hourglass turns. Reflect and intend.', sound: false },
      settings.morningHour, settings.morningMinute,
      await isTodayJournalDone('morning'),
    );
  }

  // Evening journal
  if (settings.eveningEnabled) {
    await scheduleDailyReminder(
      REMINDER_IDS.evening,
      { title: 'The day closes', body: 'Time to examine it before you sleep.', sound: false },
      settings.eveningHour, settings.eveningMinute,
      await isTodayJournalDone('evening'),
    );
  }

  // Midday check-in — no completion state, always repeating
  if (settings.middayEnabled) {
    await Notifications.scheduleNotificationAsync({
      identifier: REMINDER_IDS.midday,
      content: {
        title: 'Pause',
        body: 'How are you meeting the day?',
        sound: false,
      },
      trigger: { type: 'daily', hour: settings.middayHour, minute: settings.middayMinute },
    });
  }

  // Weekly review
  if (settings.reviewEnabled) {
    await Notifications.scheduleNotificationAsync({
      identifier: REMINDER_IDS.review,
      content: {
        title: 'Sunday reckoning',
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


// ─── RE-ENGAGEMENT NOTIFICATIONS ─────────────────────────────────────────────
// Called on app load. Checks lastPracticeDate and schedules re-engagement
// notifications if the user has been inactive. Cancels them if user is active.

const REENGAGEMENT_IDS = {
  day2: 'reengagement-day2',
  day7: 'reengagement-day7',
};

// Next occurrence of `hour`:00 that is at least a couple of hours away —
// tomorrow morning in practice. A raw timeInterval ("8 hours from now") fired
// at 3am for users who opened the app in the evening.
function nextMorningAt(hour) {
  const t = new Date();
  t.setDate(t.getDate() + 1);
  t.setHours(hour, 0, 0, 0);
  return t;
}

export async function scheduleReengagementNotifications() {
  try {
    // Cancel any existing re-engagement notifications first
    await cancelReengagementNotifications();

    const raw = await AsyncStorage.getItem('streak');
    if (!raw) return;
    const streak = JSON.parse(raw);
    if (!streak.lastDate) return;

    const lastPractice = new Date(streak.lastDate);
    const now = new Date();
    const daysSince = Math.floor((now - lastPractice) / 86400000);

    // Active today or yesterday — no re-engagement needed
    if (daysSince <= 1) return;

    // Day 2 miss — soft invite, fires tomorrow morning at 8am
    if (daysSince === 2) {
      await Notifications.scheduleNotificationAsync({
        identifier: REENGAGEMENT_IDS.day2,
        content: {
          title: "It's been a day",
          body: "The practice doesn't judge absence. It just waits.",
          sound: false,
        },
        trigger: { type: 'date', date: nextMorningAt(8) },
      });
      return;
    }

    // Day 7 miss — more direct, fires in 1 hour
    if (daysSince >= 7) {
      await Notifications.scheduleNotificationAsync({
        identifier: REENGAGEMENT_IDS.day7,
        content: {
          title: "It's been a week",
          body: 'Begin with one prompt. The rest follows.',
          sound: false,
        },
        trigger: { type: 'timeInterval', seconds: 60 * 60, repeats: false },
      });
      return;
    }

    // Days 3–6 — general nudge, fires next morning at 7am
    await Notifications.scheduleNotificationAsync({
      identifier: REENGAGEMENT_IDS.day2,
      content: {
        title: 'Even Marcus missed days',
        body: 'He always returned. So can you.',
        sound: false,
      },
      trigger: { type: 'date', date: nextMorningAt(7) },
    });

  } catch (e) {
    console.log('scheduleReengagementNotifications error:', e);
  }
}

export async function cancelReengagementNotifications() {
  try {
    for (const id of Object.values(REENGAGEMENT_IDS)) {
      await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
    }
  } catch (e) {
    console.log('cancelReengagementNotifications error:', e);
  }
}

// Call this when a practice is sealed — cancels all re-engagement notifications
export async function onPracticeSealed() {
  await cancelReengagementNotifications();
}

export async function cancelAllNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
