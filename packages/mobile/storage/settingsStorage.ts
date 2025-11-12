import { storage } from './baseStorage';
import {
  normalizeNotificationConfig,
  type NotificationScheduleConfig,
} from '../notifications/notificationConfig';

const LANGUAGE_KEY = 'appLanguage';
const NOTIFICATION_KEY = 'notificationsEnabled';
const TWENTY_FOUR_KEY = 'useTwentyFourHourClock';
const NOTIFICATION_CONFIG_KEY = 'notificationConfig';
const TAHAJJUD_ENABLED_KEY = 'tahajjudReminderEnabled';
const TAHAJJUD_TIME_KEY = 'tahajjudReminderTime';
const TAHAJJUD_METHOD_KEY = 'tahajjudReminderMethod';
const TAHAJJUD_CUSTOM_TIME_KEY = 'tahajjudReminderCustomTime';
const TAHAJJUD_LEAD_KEY = 'tahajjudReminderLeadMinutes';

const clampLeadMinutes = (value: number): number => {
  if (!Number.isFinite(value)) {
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

export const settingsStorage = {
  getLanguage(): string | null {
    try {
      return storage.getString(LANGUAGE_KEY) ?? null;
    } catch (error) {
      console.error('Failed to read language from storage.', error);
      return null;
    }
  },
  setLanguage(language: string): void {
    try {
      storage.set(LANGUAGE_KEY, language);
    } catch (error) {
      console.error('Failed to persist language selection.', error);
    }
  },
  getNotificationsEnabled(): boolean {
    try {
      const rawValue = storage.getString(NOTIFICATION_KEY);
      if (rawValue == null) {
        return false;
      }
      return rawValue === 'true';
    } catch (error) {
      console.error('Failed to read notification preference.', error);
      return false;
    }
  },
  setNotificationsEnabled(enabled: boolean): void {
    try {
      storage.set(NOTIFICATION_KEY, String(enabled));
    } catch (error) {
      console.error('Failed to persist notification preference.', error);
    }
  },
  getTwentyFourHourPreference(): boolean {
    try {
      const rawValue = storage.getString(TWENTY_FOUR_KEY);
      if (rawValue == null) {
        return false;
      }
      return rawValue === 'true';
    } catch (error) {
      console.error('Failed to read 24-hour clock preference.', error);
      return false;
    }
  },
  setTwentyFourHourPreference(enabled: boolean): void {
    try {
      storage.set(TWENTY_FOUR_KEY, String(enabled));
    } catch (error) {
      console.error('Failed to persist 24-hour clock preference.', error);
    }
  },
  getNotificationConfig(): NotificationScheduleConfig {
    try {
      const rawValue = storage.getString(NOTIFICATION_CONFIG_KEY);
      if (!rawValue) {
        return normalizeNotificationConfig();
      }

      const parsed = JSON.parse(rawValue);
      return normalizeNotificationConfig(parsed);
    } catch (error) {
      console.error('Failed to read notification configuration.', error);
      return normalizeNotificationConfig();
    }
  },
  setNotificationConfig(config: NotificationScheduleConfig): void {
    try {
      const normalized = normalizeNotificationConfig(config);
      storage.set(NOTIFICATION_CONFIG_KEY, JSON.stringify(normalized));
    } catch (error) {
      console.error('Failed to persist notification configuration.', error);
    }
  },
  getTahajjudReminderEnabled(): boolean {
    try {
      const rawValue = storage.getString(TAHAJJUD_ENABLED_KEY);
      if (rawValue == null) {
        return false;
      }
      return rawValue === 'true';
    } catch (error) {
      console.error('Failed to read tahajjud reminder preference.', error);
      return false;
    }
  },
  setTahajjudReminderEnabled(enabled: boolean): void {
    try {
      storage.set(TAHAJJUD_ENABLED_KEY, String(enabled));
    } catch (error) {
      console.error('Failed to persist tahajjud reminder preference.', error);
    }
  },
  getTahajjudReminderTime(): string | null {
    try {
      return storage.getString(TAHAJJUD_TIME_KEY) ?? null;
    } catch (error) {
      console.error('Failed to read tahajjud reminder time.', error);
      return null;
    }
  },
  setTahajjudReminderTime(time: string): void {
    try {
      storage.set(TAHAJJUD_TIME_KEY, time);
    } catch (error) {
      console.error('Failed to persist tahajjud reminder time.', error);
    }
  },
  getTahajjudReminderMethod(): 'custom' | 'lastThird' | 'middle' {
    try {
      const rawValue = storage.getString(TAHAJJUD_METHOD_KEY);
      if (rawValue === 'lastThird' || rawValue === 'middle' || rawValue === 'custom') {
        return rawValue;
      }
      return 'custom';
    } catch (error) {
      console.error('Failed to read tahajjud reminder method.', error);
      return 'custom';
    }
  },
  setTahajjudReminderMethod(method: 'custom' | 'lastThird' | 'middle'): void {
    try {
      storage.set(TAHAJJUD_METHOD_KEY, method);
    } catch (error) {
      console.error('Failed to persist tahajjud reminder method.', error);
    }
  },
  getTahajjudReminderCustomTime(): string | null {
    try {
      const stored = storage.getString(TAHAJJUD_CUSTOM_TIME_KEY);
      if (stored) {
        return stored;
      }
      const legacy = storage.getString(TAHAJJUD_TIME_KEY);
      return legacy ?? null;
    } catch (error) {
      console.error('Failed to read tahajjud custom reminder time.', error);
      return null;
    }
  },
  setTahajjudReminderCustomTime(time: string): void {
    try {
      storage.set(TAHAJJUD_CUSTOM_TIME_KEY, time);
    } catch (error) {
      console.error('Failed to persist tahajjud custom reminder time.', error);
    }
  },
  getTahajjudReminderLeadMinutes(): number {
    try {
      const rawValue = storage.getString(TAHAJJUD_LEAD_KEY);
      if (rawValue == null) {
        return 0;
      }

      const parsed = Number(rawValue);
      if (!Number.isFinite(parsed)) {
        return 0;
      }

      return clampLeadMinutes(parsed);
    } catch (error) {
      console.error('Failed to read tahajjud reminder lead minutes.', error);
      return 0;
    }
  },
  setTahajjudReminderLeadMinutes(minutes: number): void {
    try {
      const clamped = clampLeadMinutes(minutes);
      storage.set(TAHAJJUD_LEAD_KEY, String(clamped));
    } catch (error) {
      console.error('Failed to persist tahajjud reminder lead minutes.', error);
    }
  },
};
