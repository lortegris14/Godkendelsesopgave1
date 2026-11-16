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

export async function notifyMatchingStudents(job, database) {
  const recipients = getMatchingStudents(job, database);

  if (!recipients.length) {
    return { count: 0, permissionDenied: false };
  }

  if (Platform.OS === 'web') {
    throw new Error('Lokale notifikationer understøttes kun på iOS og Android.');
  }

  const { status: currentStatus } = await Notifications.getPermissionsAsync();
  const status = currentStatus === 'granted'
    ? currentStatus
    : (await Notifications.requestPermissionsAsync()).status;

  if (status !== 'granted') {
    return { count: 0, permissionDenied: true };
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('job-matches', {
      name: 'Matchende jobopslag',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

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
