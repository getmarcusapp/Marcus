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

export async function cancelAllNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
