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

export async function scheduleAllNotifications() {
  // Cancel all existing scheduled notifications first
  await Notifications.cancelAllScheduledNotificationsAsync();

  const raw = await AsyncStorage.getItem('notification_settings');
  if (!raw) return;
  const settings = JSON.parse(raw);

  // Morning
  if (settings.morningEnabled) {
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

  // Evening
  if (settings.eveningEnabled) {
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
        weekday: (settings.reviewDay ?? 0) + 1, // Expo: 1=Sunday
        hour: settings.reviewHour,
        minute: settings.reviewMinute,
      },
    });
  }
}

export async function cancelAllNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
