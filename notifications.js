import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { getMatchingStudents } from './storage';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

async function requestNotificationPermission() {
  const { status: currentStatus } = await Notifications.getPermissionsAsync();
  return currentStatus === 'granted'
    ? currentStatus
    : (await Notifications.requestPermissionsAsync()).status;
}

async function configureAndroidChannel(channelId, name) {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(channelId, {
      name,
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
}

export async function notifyMatchingStudents(job, database) {
  const recipients = getMatchingStudents(job, database);

  if (!recipients.length) {
    return { count: 0, permissionDenied: false };
  }

  if (Platform.OS === 'web') {
    throw new Error('Lokale notifikationer understøttes kun på iOS og Android.');
  }

  const status = await requestNotificationPermission();
  if (status !== 'granted') {
    return { count: 0, permissionDenied: true };
  }

  await configureAndroidChannel('job-matches', 'Matchende jobopslag');

  await Promise.all(recipients.map(account => Notifications.scheduleNotificationAsync({
    content: {
      title: 'Nyt job, der matcher din uddannelse',
      body: `${job.position} hos ${job.company}`,
      data: { jobId: job.id, userId: account.id },
      channelId: 'job-matches',
    },
    trigger: null,
  })));

  return { count: recipients.length, permissionDenied: false };
}

export async function notifyNewMessage(recipient, sender, chat, message) {
  if (!recipient) return { count: 0, permissionDenied: false };
  if (Platform.OS === 'web') {
    throw new Error('Lokale notifikationer understøttes kun på iOS og Android.');
  }

  const status = await requestNotificationPermission();
  if (status !== 'granted') {
    return { count: 0, permissionDenied: true };
  }

  await configureAndroidChannel('new-messages', 'Nye beskeder');
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `Ny besked fra ${sender?.companyName || sender?.name || 'en bruger'}`,
      body: message.text || 'Du har modtaget en vedhæftning.',
      data: { chatId: chat.id, userId: recipient.id },
      channelId: 'new-messages',
    },
    trigger: null,
  });

  return { count: 1, permissionDenied: false };
}
