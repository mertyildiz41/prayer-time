import { storage } from './baseStorage';

const LANGUAGE_KEY = 'appLanguage';
const NOTIFICATION_KEY = 'notificationsEnabled';
const TWENTY_FOUR_KEY = 'useTwentyFourHourClock';

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
};
