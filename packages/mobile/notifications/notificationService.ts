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

import { PrayerTimeCalculator, type PrayerTime, type Location } from '@prayer-time/shared';

import type { TranslationKey } from '../i18n/translations';
import {
  PRAYER_NOTIFICATION_NAMES,
  normalizeNotificationConfig,
  buildNotificationConfigKey,
  type NotificationScheduleConfig,
  type NotificationVariant,
  type PrayerName,
} from './notificationConfig';

const CHANNEL_ID = 'prayer-reminders';
const PRAYER_NOTIFICATION_PREFIX = 'prayer-reminder-';
const TAHAJJUD_NOTIFICATION_ID = `${PRAYER_NOTIFICATION_PREFIX}tahajjud`;
const MAX_ANDROID_NOTIFICATION_ID = 2147483647;
const ANDROID_EXACT_ALARM_MIN_SDK = 31;

let isConfigured = false;
let lastScheduledKey: string | null = null;
let activePrayerSchedulingPromise: Promise<boolean> | null = null;

export type TranslateFn = (key: TranslationKey, params?: Record<string, string | number>) => string;
export type TranslatePrayerNameFn = (prayerName: PrayerTime['name']) => string;

type NotificationPayload = {
  key: string;
  notificationId: string;
  title: string;
  message: string;
  date: Date;
  variant: NotificationVariant;
};

const sanitizeIdComponent = (value: string): string => {
  if (typeof value !== 'string') {
    return 'x';
  }

  const sanitized = value
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 48);

  return sanitized.length > 0 ? sanitized : 'x';
};

const buildNotificationKey = (
  contextKey: string,
  date: string,
  prayerName: string,
  variant: NotificationVariant,
) => {
  const contextPart = sanitizeIdComponent(contextKey);
  const datePart = sanitizeIdComponent(date);
  const prayerPart = sanitizeIdComponent(prayerName);
  return `${PRAYER_NOTIFICATION_PREFIX}${contextPart}-${datePart}-${prayerPart}-${variant}`;
};

const createNotificationIdAllocator = () => {
  const used = new Set<string>();

  const hashKey = (key: string): number => {
    let hash = 0;
    for (let index = 0; index < key.length; index += 1) {
      hash = (hash * 33 + key.charCodeAt(index)) | 0;
    }
    const normalized = Math.abs(hash) % MAX_ANDROID_NOTIFICATION_ID;
    return normalized === 0 ? 1 : normalized;
  };

  return (key: string): string => {
    let candidate = hashKey(key);

    while (candidate === 0 || used.has(String(candidate))) {
      candidate += 1;
      if (candidate >= MAX_ANDROID_NOTIFICATION_ID) {
        candidate = 1;
      }
    }

    const id = String(candidate);
    used.add(id);
    return id;
  };
};

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

const isExactAlarmPermissionRelevant = () => {
  if (Platform.OS !== 'android') {
    return false;
  }

  const version = Number(Platform.Version);
  if (Number.isNaN(version)) {
    return false;
  }

  return version >= ANDROID_EXACT_ALARM_MIN_SDK;
};

const checkExactAlarmPermission = async (): Promise<boolean> => {
  if (!isExactAlarmPermissionRelevant()) {
    return true;
  }

  try {
    const status = await check(PERMISSIONS.ANDROID.SCHEDULE_EXACT_ALARM);
    return status === RESULTS.GRANTED || status === RESULTS.UNAVAILABLE;
  } catch (error) {
    console.error('Failed to check exact alarm permission.', error);
    return false;
  }
};

export const ensureExactAlarmPermission = async (): Promise<boolean> => {
  if (!isExactAlarmPermissionRelevant()) {
    return true;
  }

  try {
    const status = await check(PERMISSIONS.ANDROID.SCHEDULE_EXACT_ALARM);
    if (status === RESULTS.GRANTED || status === RESULTS.UNAVAILABLE) {
      return true;
    }

    if (status === RESULTS.BLOCKED) {
      return false;
    }

    const nextStatus = await request(PERMISSIONS.ANDROID.SCHEDULE_EXACT_ALARM);
    return nextStatus === RESULTS.GRANTED;
  } catch (error) {
    console.error('Failed to request exact alarm permission.', error);
    return false;
  }
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
  if (!ids.length) {
    return;
  }

  const uniqueIds = Array.from(new Set(ids.filter((value): value is string => Boolean(value))));

  uniqueIds.forEach((id) => {
    try {
      if (typeof PushNotification.cancelLocalNotification === 'function') {
        PushNotification.cancelLocalNotification(id);
      }
    } catch (error) {
      console.error('Failed to cancel scheduled notification', id, error);
    }
  });

  if (Platform.OS === 'ios') {
    try {
      PushNotificationIOS.removePendingNotificationRequests(uniqueIds);
    } catch (error) {
      console.error('Failed to remove pending iOS notifications', error);
    }
  }
};

const computeNextOccurrenceForTime = (time: string): Date | null => {
  if (typeof time !== 'string') {
    return null;
  }

  const [rawHours, rawMinutes] = time.split(':');
  const hours = Number.parseInt(rawHours, 10);
  const minutes = Number.parseInt(rawMinutes, 10);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return null;
  }

  const now = new Date();
  const candidate = new Date(now);
  candidate.setHours(hours, minutes, 0, 0);

  if (candidate.getTime() <= now.getTime()) {
    candidate.setDate(candidate.getDate() + 1);
  }

  return candidate;
};

const getPendingIOSNotifications = async () => {
  if (Platform.OS !== 'ios') {
    return [];
  }

  if (typeof PushNotificationIOS.getPendingNotificationRequests !== 'function') {
    return [];
  }

  return new Promise((resolve) => {
    try {
      PushNotificationIOS.getPendingNotificationRequests((requests) => {
        if (Array.isArray(requests)) {
          resolve(requests);
        } else {
          resolve([]);
        }
      });
    } catch (error) {
      console.error('Failed to fetch pending iOS notifications', error);
      resolve([]);
    }
  });
};

const getScheduledPrayerNotificationIds = async (): Promise<string[]> => {
  const ids = new Set<string>();

  const parseMetadata = (value: unknown): Record<string, unknown> | null => {
    if (!value) {
      return null;
    }

    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return null;
      }
    }

    if (typeof value === 'object') {
      return value as Record<string, unknown>;
    }

    return null;
  };

  const considerNotification = (notification: any) => {
    if (!notification) {
      return;
    }

    const metadata =
      parseMetadata(notification?.data) ??
      parseMetadata(notification?.userInfo);

    const internalIdCandidate =
      typeof metadata?.internalId === 'string'
        ? metadata.internalId
        : typeof metadata?.id === 'string'
          ? metadata.id
          : undefined;

    const actualIdCandidate =
      notification?.id ??
      notification?.notificationId ??
      notification?.identifier ??
      (typeof metadata?.notificationId === 'string' ? metadata.notificationId : undefined);

    const belongsToPrayer =
      (typeof actualIdCandidate === 'string' && actualIdCandidate.startsWith(PRAYER_NOTIFICATION_PREFIX)) ||
      (typeof internalIdCandidate === 'string' && internalIdCandidate.startsWith(PRAYER_NOTIFICATION_PREFIX));

    if (!belongsToPrayer) {
      return;
    }

    const resolvedId = actualIdCandidate ?? internalIdCandidate;
    if (resolvedId != null) {
      if (resolvedId === TAHAJJUD_NOTIFICATION_ID) {
        return;
      }
      ids.add(String(resolvedId));
    }
  };

  await new Promise<void>((resolve) => {
    if (typeof PushNotification.getScheduledLocalNotifications === 'function') {
      try {
        PushNotification.getScheduledLocalNotifications((scheduled) => {
          if (Array.isArray(scheduled)) {
            scheduled.forEach((notification) => {
              considerNotification(notification);
            });
          }
          resolve();
        });
      } catch (error) {
        console.error('Failed to inspect scheduled notifications', error);
        resolve();
      }
    } else {
      resolve();
    }
  });

  const pending = await getPendingIOSNotifications();
  pending.forEach((request: any) => {
    considerNotification({
      id: request?.identifier,
      identifier: request?.identifier,
      userInfo: request?.userInfo ?? request?.content?.userInfo,
    });
  });

  return Array.from(ids);
};

export const cancelPrayerNotifications = async () => {
  try {
    console.log('Cancelling prayer notifications');
    const ids = await getScheduledPrayerNotificationIds();
    cancelScheduledIds(ids);
  } catch (error) {
    console.error('Failed to cancel prayer notifications', error);
  } finally {
    lastScheduledKey = null;
  }
};

const schedulePayloads = (payloads: NotificationPayload[]) => {
  createChannelIfNeeded();

  const sorted = [...payloads].sort((first, second) => first.date.getTime() - second.date.getTime());

  let effectivePayloads = sorted;
  if (Platform.OS === 'ios' && sorted.length > 64) {
    effectivePayloads = sorted.slice(0, 64);
    console.log(
      `Scheduling ${effectivePayloads.length} notifications (trimmed from ${sorted.length} to respect iOS limits)`,
    );
  } else {
    console.log(`Scheduling ${sorted.length} notifications`);
  }

  effectivePayloads.forEach((payload) => {
    if (payload.date.getTime() <= Date.now()) {
      return;
    }

    PushNotification.localNotificationSchedule({
      id: payload.notificationId,
      channelId: CHANNEL_ID,
      title: payload.title,
      message: payload.message,
      date: payload.date,
      allowWhileIdle: true,
      playSound: true,
      soundName: 'default',
      userInfo: {
        internalId: payload.key,
        notificationId: payload.notificationId,
        variant: payload.variant,
      },
      data: {
        internalId: payload.key,
        notificationId: payload.notificationId,
        variant: payload.variant,
      },
    });
  });
  
};

export type PrayerScheduleDay = {
  date: string;
  prayers: PrayerTime[];
};

type BuildPayloadOptions = {
  day: PrayerScheduleDay;
  contextKey: string;
  normalizedConfig: NotificationScheduleConfig;
  translator: TranslateFn;
  translatePrayerName: TranslatePrayerNameFn;
  now: number;
  allocateNotificationId: (key: string) => string;
};

const buildPayloadsForDay = ({
  day,
  contextKey,
  normalizedConfig,
  translator,
  translatePrayerName,
  now,
  allocateNotificationId,
}: BuildPayloadOptions): NotificationPayload[] => {
  const payloads: NotificationPayload[] = [];

  for (const prayer of day.prayers) {
    if (!PRAYER_NOTIFICATION_NAMES.includes(prayer.name as PrayerName)) {
      continue;
    }

    const prayerName = prayer.name as PrayerName;
    if (!normalizedConfig.enabledPrayers[prayerName]) {
      continue;
    }

    const occurrence =
      prayer.timestamp && Number.isFinite(prayer.timestamp) && prayer.timestamp > 0
        ? new Date(prayer.timestamp * 1000)
        : PrayerTimeCalculator.getOccurrenceForDate(prayer);

    const displayName = translatePrayerName(prayer.name);

    const resolveTitle = (variant: NotificationVariant) => {
      const key = `notifications.prayerTitle.${variant}` as TranslationKey;
      const translated = translator(key, { prayer: displayName });
      if (translated !== key) {
        return translated;
      }
      const fallback = translator('notifications.prayerTitle', { prayer: displayName });
      return fallback === 'notifications.prayerTitle' ? displayName : fallback;
    };

    const resolveMessage = (variant: NotificationVariant, minutes: number | undefined) => {
      const key = `notifications.prayerMessage.${variant}` as TranslationKey;
      const params = minutes
        ? { prayer: displayName, minutes }
        : { prayer: displayName };
      const translated = translator(key, params);
      if (translated !== key) {
        return translated;
      }
      return translator('notifications.prayerMessage', params);
    };

    if (normalizedConfig.sendAtPrayerTime && occurrence.getTime() > now) {
      const key = buildNotificationKey(contextKey, day.date, prayer.name, 'at');
      payloads.push({
        key,
        notificationId: allocateNotificationId(key),
        date: occurrence,
        title: resolveTitle('at'),
        message: resolveMessage('at', undefined),
        variant: 'at',
      });
    }

    if (normalizedConfig.sendBefore && normalizedConfig.minutesBefore > 0) {
      const minutes = normalizedConfig.minutesBefore;
      const beforeDate = new Date(occurrence.getTime() - minutes * 60 * 1000);
      if (beforeDate.getTime() > now) {
        const key = buildNotificationKey(contextKey, day.date, prayer.name, 'before');
        payloads.push({
          key,
          notificationId: allocateNotificationId(key),
          date: beforeDate,
          title: resolveTitle('before'),
          message: resolveMessage('before', minutes),
          variant: 'before',
        });
      }
    }

    if (normalizedConfig.sendAfter && normalizedConfig.minutesAfter > 0) {
      const minutes = normalizedConfig.minutesAfter;
      const afterDate = new Date(occurrence.getTime() + minutes * 60 * 1000);
      if (afterDate.getTime() > now) {
        const key = buildNotificationKey(contextKey, day.date, prayer.name, 'after');
        payloads.push({
          key,
          notificationId: allocateNotificationId(key),
          date: afterDate,
          title: resolveTitle('after'),
          message: resolveMessage('after', minutes),
          variant: 'after',
        });
      }
    }
  }

  return payloads;
};

type SchedulePrayerRangeOptions = {
  days: PrayerScheduleDay[];
  translator: TranslateFn;
  translatePrayerName: TranslatePrayerNameFn;
  contextKey: string;
  force?: boolean;
  config?: NotificationScheduleConfig;
};

export const schedulePrayerNotificationsRange = async ({
  days,
  translator,
  translatePrayerName,
  contextKey,
  force = false,
  config,
}: SchedulePrayerRangeOptions): Promise<boolean> => {
  const normalizedConfig = normalizeNotificationConfig(config);
  const sortedDays = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const configSignature = buildNotificationConfigKey(normalizedConfig);
  const datesSignature = sortedDays.map((day) => day.date).join(',');
  const compositeKey = `${contextKey}|${configSignature}|${datesSignature}`;

  const executeScheduling = async (): Promise<boolean> => {
    const granted = await checkNotificationAuthorization();
    if (!granted) {
      return false;
    }

    const exactAlarmsAllowed = await checkExactAlarmPermission();
    if (!exactAlarmsAllowed) {
      console.warn('Exact alarm permission missing; prayer notifications will not be scheduled.');
      return false;
    }

    const now = Date.now();
    const payloads: NotificationPayload[] = [];
    const allocateNotificationId = createNotificationIdAllocator();

    for (const day of sortedDays) {
      payloads.push(
        ...buildPayloadsForDay({
          day,
          contextKey,
          normalizedConfig,
          translator,
          translatePrayerName,
          now,
          allocateNotificationId,
        }),
      );
    }

    await cancelPrayerNotifications();

    if (!payloads.length) {
      lastScheduledKey = compositeKey;
      return true;
    }

    schedulePayloads(payloads);
    lastScheduledKey = compositeKey;
    return true;
  };

  if (activePrayerSchedulingPromise) {
    try {
      await activePrayerSchedulingPromise;
    } catch (error) {
      console.error('Previous prayer notification scheduling attempt failed.', error);
    }

    if (!force && lastScheduledKey === compositeKey) {
      return true;
    }
  }

  if (!force && lastScheduledKey === compositeKey) {
    return true;
  }

  const schedulingPromise = executeScheduling();
  activePrayerSchedulingPromise = schedulingPromise;

  try {
    return await schedulingPromise;
  } finally {
    activePrayerSchedulingPromise = null;
  }
};

type ScheduleDailyPrayerOptions = {
  prayers: PrayerTime[];
  dateKey: string;
  calendarDate?: string;
  translator: TranslateFn;
  translatePrayerName: TranslatePrayerNameFn;
  force?: boolean;
  config?: NotificationScheduleConfig;
};

export const scheduleDailyPrayerNotifications = async ({
  prayers,
  dateKey,
  calendarDate,
  translator,
  translatePrayerName,
  force = false,
  config,
}: ScheduleDailyPrayerOptions): Promise<boolean> => {
  return schedulePrayerNotificationsRange({
    days: [{ date: calendarDate ?? dateKey, prayers }],
    translator,
    translatePrayerName,
    contextKey: dateKey,
    force,
    config,
  });
};

type ScheduleTahajjudOptions = {
  translator: TranslateFn;
  time: string;
  leadMinutes?: number;
};

const clampLeadMinutes = (value: number | undefined): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }

  if (value == null) {
    return 0;
  }

  if (value < 0) {
    return 0;
  }

  if (value > 180) {
    return 180;
  }

  return Math.round(value);
};

const applyLeadMinutes = (date: Date, leadMinutes: number): Date => {
  if (!leadMinutes) {
    return date;
  }

  const adjusted = new Date(date.getTime() - leadMinutes * 60 * 1000);
  if (adjusted.getTime() <= Date.now()) {
    adjusted.setDate(adjusted.getDate() + 1);
  }
  return adjusted;
};

export const scheduleTahajjudNotification = async ({
  translator,
  time,
  leadMinutes,
}: ScheduleTahajjudOptions): Promise<boolean> => {
  const granted = await checkNotificationAuthorization();
  if (!granted) {
    return false;
  }

  const exactGranted = await checkExactAlarmPermission();
  if (!exactGranted) {
    console.warn('Exact alarm permission missing; tahajjud notification will not be scheduled.');
    return false;
  }

  const nextOccurrence = computeNextOccurrenceForTime(time);
  if (!nextOccurrence) {
    console.warn('Invalid tahajjud reminder time provided.', time);
    return false;
  }

  const clampedLeadMinutes = clampLeadMinutes(leadMinutes);
  const scheduledDate = applyLeadMinutes(nextOccurrence, clampedLeadMinutes);

  createChannelIfNeeded();
  cancelScheduledIds([TAHAJJUD_NOTIFICATION_ID]);

  const title = translator('notifications.tahajjudTitle');
  const message = translator('notifications.tahajjudMessage');

  PushNotification.localNotificationSchedule({
    id: TAHAJJUD_NOTIFICATION_ID,
    channelId: CHANNEL_ID,
    title,
    message,
    date: scheduledDate,
    allowWhileIdle: true,
    playSound: true,
    soundName: 'default',
    repeatType: 'day',
    userInfo: {
      internalId: TAHAJJUD_NOTIFICATION_ID,
      notificationId: TAHAJJUD_NOTIFICATION_ID,
      variant: 'tahajjud',
      time,
      leadMinutes: clampedLeadMinutes,
    },
    data: {
      internalId: TAHAJJUD_NOTIFICATION_ID,
      notificationId: TAHAJJUD_NOTIFICATION_ID,
      variant: 'tahajjud',
      time,
      leadMinutes: clampedLeadMinutes,
    },
  });

  return true;
};

export const cancelTahajjudNotification = async () => {
  cancelScheduledIds([TAHAJJUD_NOTIFICATION_ID]);
};

type GeneratePrayerScheduleOptions = {
  location: Location;
  startDate?: Date;
  days: number;
  method?: string;
};

export const generatePrayerSchedules = ({
  location,
  startDate = new Date(),
  days,
  method = 'Karachi',
}: GeneratePrayerScheduleOptions): PrayerScheduleDay[] => {
  if (days <= 0) {
    return [];
  }

  const schedules: PrayerScheduleDay[] = [];
  const baseDate = new Date(startDate);
  baseDate.setHours(0, 0, 0, 0);

  for (let offset = 0; offset < days; offset += 1) {
    const target = new Date(baseDate);
    target.setDate(baseDate.getDate() + offset);

    const daily = PrayerTimeCalculator.calculatePrayerTimes(target, location, method);
    
    schedules.push({
      date: daily.date,
      prayers: daily.prayers.map((prayer) => ({ ...prayer })),
    });
  }

  return schedules;
};

export const resetNotificationScheduleCache = () => {
  lastScheduledKey = null;
};

export const PRAYER_NOTIFICATION_CHANNEL_ID = CHANNEL_ID;

export { PRAYER_NOTIFICATION_NAMES } from './notificationConfig';
export type { NotificationScheduleConfig, NotificationVariant, PrayerName } from './notificationConfig';
export { DEFAULT_NOTIFICATION_CONFIG, normalizeNotificationConfig, buildNotificationConfigKey } from './notificationConfig';
export type { PrayerScheduleDay };
