import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

// How notifications appear when app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
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

export async function scheduleAllNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();

  const raw = await AsyncStorage.getItem('notification_settings');
  if (!raw) return;
  const settings = JSON.parse(raw);

  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();

  // Compass — skip if already done today
  if (settings.compassEnabled) {
    const compassDone = await AsyncStorage.getItem('compass_done_today');
    const compassDate = compassDone ? JSON.parse(compassDone) : null;
    const compassAlreadyDone = compassDate === new Date().toDateString();
    if (!compassAlreadyDone) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Marcus',
          body: 'Begin with your compass. Let it orient the day.',
          sound: false,
        },
        trigger: { type: 'daily', hour: settings.compassHour, minute: settings.compassMinute },
      });
    }
  }

  // Reading — skip if already done today
  if (settings.readingEnabled) {
    const readingDone = await isTodayReadingDone();
    if (!readingDone) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Marcus',
          body: 'Your daily wisdom awaits. Take a moment to read.',
          sound: false,
        },
        trigger: { type: 'daily', hour: settings.readingHour, minute: settings.readingMinute },
      });
    }
  }

  // Morning — skip if already done today OR if the time has already passed today
  if (settings.morningEnabled) {
    const morningDone = await isTodayJournalDone('morning');
    const morningMins = settings.morningHour * 60 + settings.morningMinute;
    const morningPassedToday = nowMins > morningMins;
    if (!morningDone || !morningPassedToday) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Marcus',
          body: 'The hourglass turns. Your morning practice awaits.',
          sound: false,
        },
        trigger: {
          type: 'daily',
          hour: settings.morningHour,
          minute: settings.morningMinute,
        },
      });
    }
  }

  // Evening — skip if already done today
  if (settings.eveningEnabled) {
    const eveningDone = await isTodayJournalDone('evening');
    if (!eveningDone) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Marcus',
          body: 'The day closes. Time to examine it.',
          sound: false,
        },
        trigger: {
          type: 'daily',
          hour: settings.eveningHour,
          minute: settings.eveningMinute,
        },
      });
    }
  }

  // Midday check-in
  if (settings.middayEnabled) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Marcus',
        body: 'Pause. How are you meeting the day?',
        sound: false,
      },
      trigger: { type: 'daily', hour: settings.middayHour, minute: settings.middayMinute },
    });
  }

  // Weekly review
  if (settings.reviewEnabled) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Marcus',
        body: 'A week has passed. Seal it with intention.',
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

// Call this when the app comes to foreground — cancels notifications
// for things already completed today
export async function refreshNotificationsForToday() {
  try {
    const raw = await AsyncStorage.getItem('notification_settings');
    if (!raw) return;
    const settings = JSON.parse(raw);

    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const morningDone = await isTodayJournalDone('morning');
    const eveningDone = await isTodayJournalDone('evening');

    for (const notif of scheduled) {
      const body = notif.content?.body || '';
      if (morningDone && body.includes('morning practice')) {
        await Notifications.cancelScheduledNotificationAsync(notif.identifier);
      }
      if (eveningDone && body.includes('day closes')) {
        await Notifications.cancelScheduledNotificationAsync(notif.identifier);
      }
    }
  } catch (e) {
    console.log('refreshNotifications error:', e);
  }
}


// Call immediately when a journal is saved — cancels the notification for that type
export async function cancelJournalNotification(type) {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const keywords = {
      morning: 'morning practice',
      evening: 'day closes',
      compass: 'Begin with your compass',
      reading: 'daily wisdom awaits',
    };
    const keyword = keywords[type] || '';
    if (!keyword) return;
    for (const notif of scheduled) {
      if ((notif.content?.body || '').includes(keyword)) {
        await Notifications.cancelScheduledNotificationAsync(notif.identifier);
      }
    }
  } catch (e) {
    console.log('cancelJournalNotification error:', e);
  }
}


// ─── RE-ENGAGEMENT NOTIFICATIONS ─────────────────────────────────────────────
// Called on app load. Checks lastPracticeDate and schedules re-engagement
// notifications if the user has been inactive. Cancels them if user is active.

const REENGAGEMENT_IDS = {
  day2: 'reengagement-day2',
  day7: 'reengagement-day7',
  streakRisk: 'reengagement-streak-risk',
};

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
          title: 'Marcus',
          body: 'The practice doesn't judge absence. It just waits.',
          sound: false,
        },
        trigger: { type: 'timeInterval', seconds: 60 * 60 * 8, repeats: false },
      });
      return;
    }

    // Day 7 miss — more direct, fires in 1 hour
    if (daysSince >= 7) {
      await Notifications.scheduleNotificationAsync({
        identifier: REENGAGEMENT_IDS.day7,
        content: {
          title: 'Marcus',
          body: 'It's been a week. One prompt is enough to start again.',
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
        title: 'Marcus',
        body: 'Marcus Aurelius missed days too. He always returned.',
        sound: false,
      },
      trigger: { type: 'timeInterval', seconds: 60 * 60 * 7, repeats: false },
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
