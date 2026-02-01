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
const CALCULATION_METHOD_KEY = 'calculationMethod';

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
  async getLanguage(): Promise<string | null> {
    try {
      return await storage.getString(LANGUAGE_KEY) ?? null;
    } catch (error) {
      console.error('Failed to read language from storage.', error);
      return null;
    }
  },
  async setLanguage(language: string): Promise<void> {
    try {
      await storage.set(LANGUAGE_KEY, language);
    } catch (error) {
      console.error('Failed to persist language selection.', error);
    }
  },
  async getNotificationsEnabled(): Promise<boolean> {
    try {
      const rawValue = await storage.getString(NOTIFICATION_KEY);
      if (rawValue == null) {
        return false;
      }
      return rawValue === 'true';
    } catch (error) {
      console.error('Failed to read notification preference.', error);
      return false;
    }
  },
  async setNotificationsEnabled(enabled: boolean): Promise<void> {
    try {
      await storage.set(NOTIFICATION_KEY, String(enabled));
    } catch (error) {
      console.error('Failed to persist notification preference.', error);
    }
  },
  async getTwentyFourHourPreference(): Promise<boolean> {
    try {
      const rawValue = await storage.getString(TWENTY_FOUR_KEY);
      if (rawValue == null) {
        return false;
      }
      return rawValue === 'true';
    } catch (error) {
      console.error('Failed to read 24-hour clock preference.', error);
      return false;
    }
  },
  async setTwentyFourHourPreference(enabled: boolean): Promise<void> {
    try {
      await storage.set(TWENTY_FOUR_KEY, String(enabled));
    } catch (error) {
      console.error('Failed to persist 24-hour clock preference.', error);
    }
  },
  async getNotificationConfig(): Promise<NotificationScheduleConfig> {
    try {
      const rawValue = await storage.getString(NOTIFICATION_CONFIG_KEY);
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
  async setNotificationConfig(config: NotificationScheduleConfig): Promise<void> {
    try {
      const normalized = normalizeNotificationConfig(config);
      await storage.set(NOTIFICATION_CONFIG_KEY, JSON.stringify(normalized));
    } catch (error) {
      console.error('Failed to persist notification configuration.', error);
    }
  },
  async getTahajjudReminderEnabled(): Promise<boolean> {
    try {
      const rawValue = await storage.getString(TAHAJJUD_ENABLED_KEY);
      if (rawValue == null) {
        return false;
      }
      return rawValue === 'true';
    } catch (error) {
      console.error('Failed to read tahajjud reminder preference.', error);
      return false;
    }
  },
  async setTahajjudReminderEnabled(enabled: boolean): Promise<void> {
    try {
      await storage.set(TAHAJJUD_ENABLED_KEY, String(enabled));
    } catch (error) {
      console.error('Failed to persist tahajjud reminder preference.', error);
    }
  },
  async getTahajjudReminderTime(): Promise<string | null> {
    try {
      return await storage.getString(TAHAJJUD_TIME_KEY) ?? null;
    } catch (error) {
      console.error('Failed to read tahajjud reminder time.', error);
      return null;
    }
  },
  async setTahajjudReminderTime(time: string): Promise<void> {
    try {
      await storage.set(TAHAJJUD_TIME_KEY, time);
    } catch (error) {
      console.error('Failed to persist tahajjud reminder time.', error);
    }
  },
  async getTahajjudReminderMethod(): Promise<'custom' | 'lastThird' | 'middle'> {
    try {
      const rawValue = await storage.getString(TAHAJJUD_METHOD_KEY);
      if (rawValue === 'lastThird' || rawValue === 'middle' || rawValue === 'custom') {
        return rawValue;
      }
      return 'custom';
    } catch (error) {
      console.error('Failed to read tahajjud reminder method.', error);
      return 'custom';
    }
  },
  async setTahajjudReminderMethod(method: 'custom' | 'lastThird' | 'middle'): Promise<void> {
    try {
      await storage.set(TAHAJJUD_METHOD_KEY, method);
    } catch (error) {
      console.error('Failed to persist tahajjud reminder method.', error);
    }
  },
  async getTahajjudReminderCustomTime(): Promise<string | null> {
    try {
      const stored = await storage.getString(TAHAJJUD_CUSTOM_TIME_KEY);
      if (stored) {
        return stored;
      }
      const legacy = await storage.getString(TAHAJJUD_TIME_KEY);
      return legacy ?? null;
    } catch (error) {
      console.error('Failed to read tahajjud custom reminder time.', error);
      return null;
    }
  },
  async setTahajjudReminderCustomTime(time: string): Promise<void> {
    try {
      await storage.set(TAHAJJUD_CUSTOM_TIME_KEY, time);
    } catch (error) {
      console.error('Failed to persist tahajjud custom reminder time.', error);
    }
  },
  async getTahajjudReminderLeadMinutes(): Promise<number> {
    try {
      const rawValue = await storage.getString(TAHAJJUD_LEAD_KEY);
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
  async setTahajjudReminderLeadMinutes(minutes: number): Promise<void> {
    try {
      const clamped = clampLeadMinutes(minutes);
      await storage.set(TAHAJJUD_LEAD_KEY, String(clamped));
    } catch (error) {
      console.error('Failed to persist tahajjud reminder lead minutes.', error);
    }
  },
  async getCalculationMethod(): Promise<string | null> {
    try {
      return await storage.getString(CALCULATION_METHOD_KEY) ?? null;
    } catch (error) {
      console.error('Failed to read calculation method from storage.', error);
      return null;
    }
  },
  async setCalculationMethod(method: string): Promise<void> {
    try {
      await storage.set(CALCULATION_METHOD_KEY, method);
    } catch (error) {
      console.error('Failed to persist calculation method.', error);
    }
  },
};
