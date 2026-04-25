import type { PrayerTime } from '@prayer-time/shared';

export const NOTIFIABLE_PRAYER_NAMES = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const;

export type NotifiablePrayerName = (typeof NOTIFIABLE_PRAYER_NAMES)[number];

export type NotificationScheduleConfig = {
  enabledPrayers: Record<NotifiablePrayerName, boolean>;
  sendAtPrayerTime: boolean;
  sendBefore: boolean;
  sendAfter: boolean;
  minutesBefore: number;
  minutesAfter: number;
};

type LegacyNotificationPreferences = {
  leadMinutes?: number;
  perPrayer?: Partial<Record<PrayerTime['name'], boolean>>;
};

export const MAX_NOTIFICATION_OFFSET_MINUTES = 180;
const LEGACY_AFTER_DEFAULT_MINUTES = 10;

const DEFAULT_ENABLED_PRAYERS: Record<NotifiablePrayerName, boolean> = {
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
  sendAfter: true,
  minutesBefore: 10,
  minutesAfter: 45,
};

const clampMinutes = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const rounded = Math.round(value);
  if (rounded < 0) {
    return 0;
  }

  if (rounded > MAX_NOTIFICATION_OFFSET_MINUTES) {
    return MAX_NOTIFICATION_OFFSET_MINUTES;
  }

  return rounded;
};

const isLegacyConfig = (
  value: Partial<NotificationScheduleConfig> | LegacyNotificationPreferences | null | undefined
): value is LegacyNotificationPreferences => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  return 'leadMinutes' in value || 'perPrayer' in value;
};

export const normalizeNotificationConfig = (
  config?: Partial<NotificationScheduleConfig> | LegacyNotificationPreferences | null
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

  if (isLegacyConfig(config)) {
    const normalizedEnabled = { ...DEFAULT_NOTIFICATION_CONFIG.enabledPrayers };

    for (const prayerName of NOTIFIABLE_PRAYER_NAMES) {
      const legacyValue = config.perPrayer?.[prayerName];
      if (typeof legacyValue === 'boolean') {
        normalizedEnabled[prayerName] = legacyValue;
      }
    }

    const legacyLead = clampMinutes(
      typeof config.leadMinutes === 'number'
        ? config.leadMinutes
        : DEFAULT_NOTIFICATION_CONFIG.minutesBefore
    );

    return {
      enabledPrayers: normalizedEnabled,
      sendAtPrayerTime: false,
      sendBefore: true,
      sendAfter: false,
      minutesBefore: legacyLead,
      minutesAfter: DEFAULT_NOTIFICATION_CONFIG.minutesAfter,
    };
  }

  const normalizedEnabled: Record<NotifiablePrayerName, boolean> = {
    ...DEFAULT_NOTIFICATION_CONFIG.enabledPrayers,
  };

  for (const prayerName of NOTIFIABLE_PRAYER_NAMES) {
    if (typeof config.enabledPrayers?.[prayerName] === 'boolean') {
      normalizedEnabled[prayerName] = Boolean(config.enabledPrayers[prayerName]);
    }
  }

  const looksLikeLegacyDefault =
    NOTIFIABLE_PRAYER_NAMES.every((prayerName) => normalizedEnabled[prayerName]) &&
    (typeof config.sendAtPrayerTime === 'undefined' || config.sendAtPrayerTime === true) &&
    (typeof config.sendBefore === 'undefined' || config.sendBefore === false) &&
    config.sendAfter === false &&
    (typeof config.minutesBefore === 'undefined' || config.minutesBefore === DEFAULT_NOTIFICATION_CONFIG.minutesBefore) &&
    config.minutesAfter === LEGACY_AFTER_DEFAULT_MINUTES;

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
        ? looksLikeLegacyDefault
          ? DEFAULT_NOTIFICATION_CONFIG.sendAfter
          : config.sendAfter
        : DEFAULT_NOTIFICATION_CONFIG.sendAfter,
    minutesBefore: clampMinutes(
      typeof config.minutesBefore === 'number'
        ? config.minutesBefore
        : DEFAULT_NOTIFICATION_CONFIG.minutesBefore
    ),
    minutesAfter: clampMinutes(
      typeof config.minutesAfter === 'number'
        ? looksLikeLegacyDefault
          ? DEFAULT_NOTIFICATION_CONFIG.minutesAfter
          : config.minutesAfter
        : DEFAULT_NOTIFICATION_CONFIG.minutesAfter
    ),
  };
};
