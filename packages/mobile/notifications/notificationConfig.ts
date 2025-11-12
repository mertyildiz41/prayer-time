export const PRAYER_NOTIFICATION_NAMES = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const;

export type PrayerName = (typeof PRAYER_NOTIFICATION_NAMES)[number];

export const NOTIFICATION_VARIANTS = ['at', 'before', 'after'] as const;

export type NotificationVariant = (typeof NOTIFICATION_VARIANTS)[number];

export type NotificationScheduleConfig = {
  enabledPrayers: Record<PrayerName, boolean>;
  sendAtPrayerTime: boolean;
  sendBefore: boolean;
  sendAfter: boolean;
  minutesBefore: number;
  minutesAfter: number;
};

const DEFAULT_ENABLED_PRAYERS: Record<PrayerName, boolean> = {
  Fajr: true,
  Dhuhr: true,
  Asr: true,
  Maghrib: true,
  Isha: true,
};

export const DEFAULT_NOTIFICATION_CONFIG: NotificationScheduleConfig = {
  enabledPrayers: { ...DEFAULT_ENABLED_PRAYERS },
  sendAtPrayerTime: true,
  sendBefore: false,
  sendAfter: false,
  minutesBefore: 10,
  minutesAfter: 10,
};

const MIN_OFFSET_MINUTES = 0;
const MAX_OFFSET_MINUTES = 180;

const clampMinutes = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  const rounded = Math.round(value);
  if (rounded < MIN_OFFSET_MINUTES) {
    return MIN_OFFSET_MINUTES;
  }
  if (rounded > MAX_OFFSET_MINUTES) {
    return MAX_OFFSET_MINUTES;
  }
  return rounded;
};

export const normalizeNotificationConfig = (
  config?: Partial<NotificationScheduleConfig> | null,
): NotificationScheduleConfig => {
  if (!config) {
    return {
      enabledPrayers: { ...DEFAULT_NOTIFICATION_CONFIG.enabledPrayers },
      sendAtPrayerTime: DEFAULT_NOTIFICATION_CONFIG.sendAtPrayerTime,
      sendBefore: DEFAULT_NOTIFICATION_CONFIG.sendBefore,
      sendAfter: DEFAULT_NOTIFICATION_CONFIG.sendAfter,
      minutesBefore: DEFAULT_NOTIFICATION_CONFIG.minutesBefore,
      minutesAfter: DEFAULT_NOTIFICATION_CONFIG.minutesAfter,
    };
  }

  const normalizedEnabled: Record<PrayerName, boolean> = {
    ...DEFAULT_NOTIFICATION_CONFIG.enabledPrayers,
  };

  for (const name of PRAYER_NOTIFICATION_NAMES) {
    if (typeof config.enabledPrayers?.[name] === 'boolean') {
      normalizedEnabled[name] = Boolean(config.enabledPrayers[name]);
    }
  }

  return {
    enabledPrayers: normalizedEnabled,
    sendAtPrayerTime:
      typeof config.sendAtPrayerTime === 'boolean'
        ? config.sendAtPrayerTime
        : DEFAULT_NOTIFICATION_CONFIG.sendAtPrayerTime,
    sendBefore:
      typeof config.sendBefore === 'boolean'
        ? config.sendBefore
        : DEFAULT_NOTIFICATION_CONFIG.sendBefore,
    sendAfter:
      typeof config.sendAfter === 'boolean'
        ? config.sendAfter
        : DEFAULT_NOTIFICATION_CONFIG.sendAfter,
    minutesBefore: clampMinutes(
      typeof config.minutesBefore === 'number'
        ? config.minutesBefore
        : DEFAULT_NOTIFICATION_CONFIG.minutesBefore,
    ),
    minutesAfter: clampMinutes(
      typeof config.minutesAfter === 'number'
        ? config.minutesAfter
        : DEFAULT_NOTIFICATION_CONFIG.minutesAfter,
    ),
  };
};

export const buildNotificationConfigKey = (
  config: NotificationScheduleConfig,
): string => {
  const flags = [
    config.sendAtPrayerTime ? '1' : '0',
    config.sendBefore ? '1' : '0',
    config.sendAfter ? '1' : '0',
  ].join('');

  const minutes = `${config.minutesBefore}:${config.minutesAfter}`;
  const enabled = PRAYER_NOTIFICATION_NAMES.map((name) =>
    config.enabledPrayers[name] ? '1' : '0',
  ).join('');

  return `${flags}|${minutes}|${enabled}`;
};
