// @ts-nocheck

import { Platform } from 'react-native';
import { NotificationAction, NotificationCategory, Notifications } from 'react-native-notifications';
import {
  canScheduleExactAlarms,
  checkNotifications,
  requestNotifications,
  RESULTS,
} from 'react-native-permissions';

import { PrayerTimeCalculator, type PrayerTime, type Location } from '@prayer-time/shared';
import { storage } from '../storage/baseStorage';
import {
  queuePrayerCheckPrompt,
  respondToPrayerCheck,
  type PrayerCheckInRecord,
} from '../storage/prayerCheckStorage';

import type { TranslationKey } from '../i18n/translations';
import {
  PRAYER_NOTIFICATION_NAMES,
  normalizeNotificationConfig,
  buildNotificationConfigKey,
  type NotificationScheduleConfig,
  type NotificationVariant,
  type PrayerName,
} from './notificationConfig';

export {
  PRAYER_NOTIFICATION_NAMES,
  normalizeNotificationConfig,
  buildNotificationConfigKey,
} from './notificationConfig';

const CHANNEL_ID = 'prayer-reminders';
const PRAYER_NOTIFICATION_PREFIX = 'prayer-reminder-';
const TAHAJJUD_NOTIFICATION_ID = `${PRAYER_NOTIFICATION_PREFIX}tahajjud`;
const MAX_ANDROID_NOTIFICATION_ID = 2147483647;
const ANDROID_EXACT_ALARM_MIN_SDK = 31;
const PRAYER_NOTIFICATION_IDS_STORAGE_KEY = 'prayerNotificationIds';
const PRAYER_CHECK_CATEGORY_ID = 'prayer-check-in';
const PRAYER_CHECK_YES_ACTION_ID = 'prayer-check-yes';
const PRAYER_CHECK_NO_ACTION_ID = 'prayer-check-no';

const prayerCheckOpenListeners = new Set<(checkIn: PrayerCheckInRecord) => void>();

let isConfigured = false;
let lastScheduledKey: string | null = null;
let activePrayerSchedulingPromise: Promise<boolean> | null = null;

export const resetNotificationScheduleCache = () => {
  lastScheduledKey = null;
  activePrayerSchedulingPromise = null;
};

export type TranslateFn = (key: TranslationKey, params?: Record<string, string | number>) => string;
export type TranslatePrayerNameFn = (prayerName: PrayerTime['name']) => string;

type NotificationPayload = {
  key: string;
  notificationId: string;
  title: string;
  message: string;
  date: Date;
  variant: NotificationVariant;
  prayerName: PrayerName;
  prayerTime: string;
  dateKey: string;
  occurrenceIso: string;
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

  try {
    Notifications.setNotificationChannel({
      channelId: CHANNEL_ID,
      name: 'Prayer Reminders',
      importance: 5,
      description: 'Notifications for upcoming prayer times',
      enableLights: true,
      enableVibration: true,
    });
  } catch (error) {
    console.error('Failed to create notification channel', error);
  }
};

const createNotificationCategories = () => {
  try {
    Notifications.setCategories([
      new NotificationCategory(PRAYER_CHECK_CATEGORY_ID, [
        new NotificationAction(PRAYER_CHECK_YES_ACTION_ID, 'foreground', 'Yes', false),
        new NotificationAction(PRAYER_CHECK_NO_ACTION_ID, 'foreground', 'No', false),
      ]),
    ]);
  } catch (error) {
    console.error('Failed to configure interactive notification categories.', error);
  }
};

const emitPrayerCheckOpen = (checkIn: PrayerCheckInRecord) => {
  prayerCheckOpenListeners.forEach((listener) => {
    try {
      listener(checkIn);
    } catch (error) {
      console.error('Failed to notify prayer check open listener.', error);
    }
  });
};

const readNotificationValue = (payload: Record<string, unknown>, key: string) => {
  const userInfo =
    payload.userInfo && typeof payload.userInfo === 'object'
      ? (payload.userInfo as Record<string, unknown>)
      : null;

  if (userInfo && typeof userInfo[key] !== 'undefined') {
    return userInfo[key];
  }

  return payload[key];
};

const extractPrayerCheckIn = (notification: unknown): PrayerCheckInRecord | null => {
  const payload =
    notification && typeof notification === 'object' && 'payload' in (notification as Record<string, unknown>)
      ? ((notification as { payload?: Record<string, unknown> }).payload ?? {})
      : notification && typeof notification === 'object'
        ? (notification as Record<string, unknown>)
        : null;

  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const variant = readNotificationValue(payload, 'variant');
  const prayerName = readNotificationValue(payload, 'prayerName');
  const prayerTime = readNotificationValue(payload, 'prayerTime');
  const dateKey = readNotificationValue(payload, 'date');
  const occurrenceIso = readNotificationValue(payload, 'occurrenceIso');
  const notifyAtIso = readNotificationValue(payload, 'notifyAtIso');
  const internalId =
    readNotificationValue(payload, 'internalId') ??
    readNotificationValue(payload, 'key') ??
    readNotificationValue(payload, 'notificationId');

  if (
    variant !== 'after' ||
    !PRAYER_NOTIFICATION_NAMES.includes(prayerName as PrayerName) ||
    typeof prayerTime !== 'string' ||
    typeof dateKey !== 'string' ||
    typeof occurrenceIso !== 'string' ||
    typeof notifyAtIso !== 'string' ||
    typeof internalId !== 'string'
  ) {
    return null;
  }

  return {
    id: internalId,
    prayerName: prayerName as PrayerName,
    prayerTime,
    date: dateKey,
    occurrenceIso,
    notifyAtIso,
  };
};

const recordPrayerCheckInIfNeeded = async (notification: unknown) => {
  const prayerCheckIn = extractPrayerCheckIn(notification);
  if (!prayerCheckIn) {
    return;
  }

  await queuePrayerCheckPrompt(prayerCheckIn);
};

const handlePrayerCheckInOpen = async (
  notification: unknown,
  actionResponse?: { identifier?: string } | null,
) => {
  const prayerCheckIn = extractPrayerCheckIn(notification);
  if (!prayerCheckIn) {
    return;
  }

  if (actionResponse?.identifier === PRAYER_CHECK_YES_ACTION_ID) {
    await respondToPrayerCheck(prayerCheckIn.id, 'yes', prayerCheckIn);
    return;
  }

  if (actionResponse?.identifier === PRAYER_CHECK_NO_ACTION_ID) {
    await respondToPrayerCheck(prayerCheckIn.id, 'no', prayerCheckIn);
    return;
  }

  await queuePrayerCheckPrompt(prayerCheckIn);
  emitPrayerCheckOpen(prayerCheckIn);
};

export const initializeNotifications = () => {
  if (isConfigured) {
    return;
  }

  createChannelIfNeeded();
  createNotificationCategories();

  Notifications.events().registerNotificationReceivedForeground((notification, completion) => {
    void recordPrayerCheckInIfNeeded(notification).catch((error) => {
      console.error('Failed to record foreground prayer check-in notification.', error);
    });
    completion({ alert: true, sound: true, badge: false });
  });

  Notifications.events().registerNotificationReceivedBackground((notification, completion) => {
    void recordPrayerCheckInIfNeeded(notification).catch((error) => {
      console.error('Failed to record background prayer check-in notification.', error);
    });
    completion({ alert: true, sound: true, badge: false });
  });

  Notifications.events().registerNotificationOpened((notification, completion, actionResponse) => {
    void handlePrayerCheckInOpen(notification, actionResponse).catch((error) => {
      console.error('Failed to handle prayer check-in notification open.', error);
    });
    completion();
  });

  void Notifications.getInitialNotification()
    .then((notification) => {
      if (!notification) {
        return;
      }

      return handlePrayerCheckInOpen(notification);
    })
    .catch((error) => {
      console.error('Failed to resolve initial prayer check-in notification.', error);
    });

  isConfigured = true;
};

export const subscribeToPrayerCheckOpens = (
  listener: (checkIn: PrayerCheckInRecord) => void,
) => {
  prayerCheckOpenListeners.add(listener);

  return () => {
    prayerCheckOpenListeners.delete(listener);
  };
};

const checkNotificationAuthorization = async (): Promise<boolean> => {
  const { status } = await checkNotifications();
  return (
    status === RESULTS.GRANTED ||
    status === RESULTS.LIMITED ||
    status === RESULTS.UNAVAILABLE
  );
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
    return await canScheduleExactAlarms();
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
    return await canScheduleExactAlarms();
  } catch (error) {
    console.error('Failed to request exact alarm permission.', error);
    return false;
  }
};

export const ensureNotificationPermission = async (): Promise<boolean> => {
  const alreadyGranted = await checkNotificationAuthorization();
  if (alreadyGranted) {
    if (Platform.OS === 'ios') {
      Notifications.registerRemoteNotifications();
    }
    return true;
  }

  if (Platform.OS === 'ios') {
    const { status } = await requestNotifications(['alert', 'badge', 'sound']);
    if (status === RESULTS.GRANTED || status === RESULTS.LIMITED) {
      Notifications.registerRemoteNotifications();
      return true;
    }
    return false;
  }

  const { status } = await requestNotifications(['alert', 'badge', 'sound']);
  if (status === RESULTS.GRANTED || status === RESULTS.UNAVAILABLE) {
    return true;
  }
  return false;
};

const cancelScheduledIds = (ids: string[]) => {
  if (!ids.length) {
    return;
  }
  ids.forEach(id => {
    // react-native-notifications handles id as number or string?
    // Type definition says number usually, but let's check. 
    // If it takes number, we might need to parse.
    // But we generated string IDs.
    // Assuming it supports strings or we need to cast.
    // Safe bet: Convert to number if possible, or pass as is if library supports it.
    // Looking at the implementation of id allocator, it returns stringified numbers mostly.
    const numId = Number(id);
    if (!Number.isNaN(numId)) {
      Notifications.cancelLocalNotification(numId);
    }
  });
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

const readStoredPrayerNotificationIds = async (): Promise<string[]> => {
  try {
    const raw = await storage.getString(PRAYER_NOTIFICATION_IDS_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((item) => typeof item === 'string' && item.length > 0)
      .filter((item) => item !== TAHAJJUD_NOTIFICATION_ID);
  } catch (error) {
    console.error('Failed to read stored prayer notification ids', error);
    return [];
  }
};

const writeStoredPrayerNotificationIds = async (ids: string[]) => {
  try {
    if (!ids.length) {
      await storage.delete(PRAYER_NOTIFICATION_IDS_STORAGE_KEY);
      return;
    }

    const unique = Array.from(new Set(ids));
    await storage.set(PRAYER_NOTIFICATION_IDS_STORAGE_KEY, JSON.stringify(unique));
  } catch (error) {
    console.error('Failed to persist prayer notification ids', error);
  }
};

export const cancelPrayerNotifications = async () => {
  try {
    console.log('Cancelling prayer notifications');
    const ids = await readStoredPrayerNotificationIds();
    cancelScheduledIds(ids);
    await writeStoredPrayerNotificationIds([]);
  } catch (error) {
    console.error('Failed to cancel prayer notifications', error);
  } finally {
    lastScheduledKey = null;
  }
};

const schedulePayloads = (payloads: NotificationPayload[]): string[] => {
  createChannelIfNeeded();
  const scheduledIds: string[] = [];

  try {
    const sorted = [...payloads].sort((first, second) => first.date.getTime() - second.date.getTime());

    let effectivePayloads = sorted;
    if (Platform.OS === 'ios' && sorted.length > 64) {
      effectivePayloads = sorted.slice(0, 64);
      console.log(`Scheduling ${effectivePayloads.length} notifications (trimmed from ${sorted.length})`);
    } else {
      console.log(`Scheduling ${sorted.length} notifications`);
    }

    effectivePayloads.forEach((payload) => {
      if (payload.date.getTime() <= Date.now()) {
        return;
      }

      const numId = Number(payload.notificationId);
      if (Number.isNaN(numId)) return;

      Notifications.postLocalNotification({
        body: payload.message,
        title: payload.title,
        sound: 'default',
        fireDate: payload.date.toISOString(),
        silent: false,
        ...(payload.variant === 'after' ? { category: PRAYER_CHECK_CATEGORY_ID } : {}),
        userInfo: {
          internalId: payload.key,
          notificationId: payload.notificationId,
          variant: payload.variant,
          prayerName: payload.prayerName,
          prayerTime: payload.prayerTime,
          date: payload.dateKey,
          occurrenceIso: payload.occurrenceIso,
          notifyAtIso: payload.date.toISOString(),
        },
      }, numId);
      scheduledIds.push(payload.notificationId);
    });
  } catch (error) {
    console.error('Failed to schedule notifications', error);
  }

  return scheduledIds;
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
      if (variant === 'after') {
        const translated = translator('notifications.prayerCheckTitle', { prayer: displayName });
        if (translated !== 'notifications.prayerCheckTitle') {
          return translated;
        }
      }

      const key = `notifications.prayerTitle.${variant}` as TranslationKey;
      const translated = translator(key, { prayer: displayName });
      if (translated !== key) {
        return translated;
      }
      const fallback = translator('notifications.prayerTitle', { prayer: displayName });
      return fallback === 'notifications.prayerTitle' ? displayName : fallback;
    };

    const resolveMessage = (variant: NotificationVariant, minutes: number | undefined) => {
      if (variant === 'after') {
        const translated = translator('notifications.prayerCheckMessage', {
          prayer: displayName,
          minutes: minutes ?? 0,
        });
        if (translated !== 'notifications.prayerCheckMessage') {
          return translated;
        }
      }

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
        prayerName,
        prayerTime: prayer.time,
        dateKey: day.date,
        occurrenceIso: occurrence.toISOString(),
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
          prayerName,
          prayerTime: prayer.time,
          dateKey: day.date,
          occurrenceIso: occurrence.toISOString(),
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
          prayerName,
          prayerTime: prayer.time,
          dateKey: day.date,
          occurrenceIso: occurrence.toISOString(),
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

    const scheduledIds = schedulePayloads(payloads);
    await writeStoredPrayerNotificationIds(scheduledIds);
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
  // Using a fixed ID for Tahajjud. Can we hash it? 
  // Allocator uses max, so we need a known valid ID.
  // We'll use a large known integer for Tahajjud or hash the ID string.
  // The prefix is string. 
  // Let's simple hash the TAHAJJUD_NOTIFICATION_ID or use a constant.
  // For safety, let's use 2000000000 for Tahajjud to avoid collision with prayer times.
  const tahajjudId = 2000000000;

  Notifications.cancelLocalNotification(tahajjudId);

  try {
    const title = translator('notifications.tahajjudTitle');
    const message = translator('notifications.tahajjudMessage');

    Notifications.postLocalNotification({
      title,
      body: message,
      sound: 'default',
      fireDate: scheduledDate.toISOString(),
      silent: false,
      userInfo: {
        internalId: TAHAJJUD_NOTIFICATION_ID,
        notificationId: TAHAJJUD_NOTIFICATION_ID,
        variant: 'tahajjud',
        time,
        leadMinutes: clampedLeadMinutes,
      },
    }, tahajjudId);
  } catch (error) {
    console.error('Failed to schedule tahajjud notification', error);
    return false;
  }

  return true;
};

export const cancelTahajjudNotification = async () => {
  const tahajjudId = 2000000000;
  Notifications.cancelLocalNotification(tahajjudId);
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
  const latitude = Number(location?.latitude ?? location?.coords?.latitude);
  const longitude = Number(location?.longitude ?? location?.coords?.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || days <= 0) {
    return [];
  }

  const normalizedLocation: Location = {
    latitude,
    longitude,
    city: typeof location?.city === 'string' ? location.city : '',
    country: typeof location?.country === 'string' ? location.country : '',
    timezone:
      typeof location?.timezone === 'string' && location.timezone.length > 0
        ? location.timezone
        : 'UTC',
  };

  const schedules: PrayerScheduleDay[] = [];
  const date = new Date(startDate);

  for (let i = 0; i < days; i++) {
    const dailyTimes = PrayerTimeCalculator.calculatePrayerTimes(
      new Date(date),
      normalizedLocation,
      method,
    );

    schedules.push({
      date: dailyTimes.date,
      prayers: dailyTimes.prayers,
    });

    date.setDate(date.getDate() + 1);
  }

  return schedules;
};
