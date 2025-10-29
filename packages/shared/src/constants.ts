/**
 * Shared Constants
 */

export const CALCULATION_METHODS = {
  MuslimWorldLeague: 'Muslim World League',
  Islamic: 'Islamic Society of North America',
  Karachi: 'University of Islamic Sciences, Karachi',
  Diyanet: 'Presidency of Religious Affairs, Turkey',
  Custom: 'Custom',
} as const;

export const MADHABS = {
  Hanafi: 'Hanafi',
  Shafi: 'Shafi',
} as const;

export const LANGUAGES = {
  en: 'English',
  ar: 'العربية',
  tr: 'Türkçe',
  ur: 'اردو',
} as const;

export const THEMES = {
  light: 'Light',
  dark: 'Dark',
  auto: 'Auto',
} as const;

export const PRAYER_NAMES = {
  Fajr: 'Fajr',
  Sunrise: 'Sunrise',
  Dhuhr: 'Dhuhr',
  Asr: 'Asr',
  Sunset: 'Sunset',
  Maghrib: 'Maghrib',
  Isha: 'Isha',
} as const;

export const API_CONFIG = {
  timeout: 10000,
  retries: 3,
  baseURL: process.env.REACT_APP_API_URL || 'https://api.example.com',
};
