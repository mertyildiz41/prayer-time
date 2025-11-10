// @ts-nocheck

import { Platform } from 'react-native';
import PushNotification from 'react-native-push-notification';
import PushNotificationIOS from '@react-native-community/push-notification-ios';
import {
  checkNotifications,
  requestNotifications,
  check,
  request,
  PERMISSIONS,
  RESULTS,
} from 'react-native-permissions';

import { PrayerTimeCalculator, type PrayerTime } from '@prayer-time/shared';

import type { TranslationKey } from '../i18n/translations';

const CHANNEL_ID = 'prayer-reminders';
const PRAYER_NOTIFICATION_PREFIX = 'prayer-reminder-';
const PRAYER_NAMES = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const;

let isConfigured = false;
let lastScheduledKey: string | null = null;

export type TranslateFn = (key: TranslationKey, params?: Record<string, string | number>) => string;
export type TranslatePrayerNameFn = (prayerName: PrayerTime['name']) => string;

type NotificationPayload = {
  id: string;
  title: string;
  message: string;
  date: Date;
};

const getNotificationId = (prayerName: string) =>
  `${PRAYER_NOTIFICATION_PREFIX}${prayerName.toLowerCase()}`;

const createChannelIfNeeded = () => {
  if (Platform.OS !== 'android') {
    return;
  }

  PushNotification.createChannel(
    {
      channelId: CHANNEL_ID,
      channelName: 'Prayer Reminders',
      channelDescription: 'Notifications for upcoming prayer times',
      importance: 4,
      vibrate: true,
      soundName: 'default',
    },
    () => {
      /* no-op */
    },
  );
};

export const initializeNotifications = () => {
  if (isConfigured) {
    return;
  }

  PushNotification.configure({
    onNotification(notification) {
      if (Platform.OS === 'ios') {
        notification.finish?.(PushNotificationIOS.FetchResult.NoData);
      }
    },
    popInitialNotification: true,
    requestPermissions: false,
  });

  createChannelIfNeeded();
  isConfigured = true;
};

const checkNotificationAuthorization = async (): Promise<boolean> => {
  if (Platform.OS === 'ios') {
    const { status } = await checkNotifications();
    return status === RESULTS.GRANTED || status === RESULTS.LIMITED;
  }

  const status = await check(PERMISSIONS.ANDROID.POST_NOTIFICATIONS);
  return status === RESULTS.GRANTED || status === RESULTS.UNAVAILABLE;
};

export const ensureNotificationPermission = async (): Promise<boolean> => {
  const alreadyGranted = await checkNotificationAuthorization();
  if (alreadyGranted) {
    if (Platform.OS === 'ios') {
      await PushNotificationIOS.requestPermissions();
    }
    return true;
  }

  if (Platform.OS === 'ios') {
    const { status } = await requestNotifications(['alert', 'badge', 'sound']);
    if (status === RESULTS.GRANTED || status === RESULTS.LIMITED) {
      await PushNotificationIOS.requestPermissions();
      return true;
    }
    return false;
  }

  const status = await request(PERMISSIONS.ANDROID.POST_NOTIFICATIONS);
  return status === RESULTS.GRANTED || status === RESULTS.UNAVAILABLE;
};

const cancelScheduledIds = (ids: string[]) => {
  ids.forEach((id) => {
    PushNotification.cancelLocalNotification(id);
  });

  if (Platform.OS === 'ios' && ids.length > 0) {
    PushNotificationIOS.removePendingNotificationRequests(ids);
  }
};

export const cancelPrayerNotifications = async () => {
  const ids = PRAYER_NAMES.map((name) => getNotificationId(name));
  cancelScheduledIds(ids);
  lastScheduledKey = null;
};

const schedulePayloads = (payloads: NotificationPayload[]) => {
  cancelScheduledIds(PRAYER_NAMES.map((name) => getNotificationId(name)));

  payloads.forEach((payload) => {
    if (payload.date.getTime() <= Date.now()) {
      return;
    }

    PushNotification.localNotificationSchedule({
      id: payload.id,
      channelId: CHANNEL_ID,
      title: payload.title,
      message: payload.message,
      date: payload.date,
      allowWhileIdle: true,
      playSound: true,
      soundName: 'default',
      userInfo: { id: payload.id },
    });
  });
};

type ScheduleDailyPrayerOptions = {
  prayers: PrayerTime[];
  dateKey: string;
  translator: TranslateFn;
  translatePrayerName: TranslatePrayerNameFn;
  force?: boolean;
};

export const scheduleDailyPrayerNotifications = async ({
  prayers,
  dateKey,
  translator,
  translatePrayerName,
  force = false,
}: ScheduleDailyPrayerOptions): Promise<boolean> => {
  if (!force && lastScheduledKey === dateKey) {
    return true;
  }

  const granted = await checkNotificationAuthorization();
  if (!granted) {
    return false;
  }

  const payloads: NotificationPayload[] = [];
  const now = Date.now();

  for (const prayer of prayers) {
    if (!PRAYER_NAMES.includes(prayer.name as typeof PRAYER_NAMES[number])) {
      continue;
    }

    const occurrenceFromTimestamp =
      prayer.timestamp && Number.isFinite(prayer.timestamp) && prayer.timestamp > 0
        ? new Date(prayer.timestamp * 1000)
        : PrayerTimeCalculator.getOccurrenceForDate(prayer);

    if (occurrenceFromTimestamp.getTime() <= now) {
      continue;
    }

    const displayName = translatePrayerName(prayer.name);
    payloads.push({
      id: getNotificationId(prayer.name),
      date: occurrenceFromTimestamp,
      title: translator('notifications.prayerTitle', { prayer: displayName }),
      message: translator('notifications.prayerMessage', { prayer: displayName }),
    });
  }

  if (!payloads.length) {
    lastScheduledKey = dateKey;
    return true;
  }

  schedulePayloads(payloads);
  lastScheduledKey = dateKey;
  return true;
};

export const resetNotificationScheduleCache = () => {
  lastScheduledKey = null;
};

export const getPrayerNotificationId = getNotificationId;
export const PRAYER_NOTIFICATION_CHANNEL_ID = CHANNEL_ID;
export const PRAYER_NOTIFICATION_NAMES = PRAYER_NAMES;
