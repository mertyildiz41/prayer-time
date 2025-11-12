import en from './locales/en.json';
import tr from './locales/tr.json';
import id from './locales/id.json';

export const translations = {
  en,
  tr,
  id,
} as const;

export type LanguageCode = keyof typeof translations;
export type TranslationKey = keyof typeof en;

export const DEFAULT_LANGUAGE: LanguageCode = 'en';
