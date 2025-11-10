import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

import { settingsStorage } from '../storage/settingsStorage';

import { DEFAULT_LANGUAGE, translations, type LanguageCode, type TranslationKey } from './translations';

type TranslationParams = Record<string, string | number>;

type TranslateFn = (key: TranslationKey, params?: TranslationParams) => string;

type I18nContextValue = {
  language: LanguageCode;
  setLanguage: (language: LanguageCode) => void;
  t: TranslateFn;
};

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

const isLanguageCode = (value: unknown): value is LanguageCode => {
  return typeof value === 'string' && value in translations;
};

const formatTemplate = (template: string, params?: TranslationParams): string => {
  if (!params) {
    return template;
  }

  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    if (Object.prototype.hasOwnProperty.call(params, key)) {
      const paramValue = params[key];
      return paramValue != null ? String(paramValue) : '';
    }
    return '';
  });
};

export const I18nProvider = ({ children }: { children: React.ReactNode }) => {
  const [language, setLanguageState] = useState<LanguageCode>(() => {
    const stored = settingsStorage.getLanguage();
    return isLanguageCode(stored) ? stored : DEFAULT_LANGUAGE;
  });

  const setLanguage = useCallback((nextLanguage: LanguageCode) => {
    setLanguageState((current) => {
      if (current === nextLanguage) {
        return current;
      }

      settingsStorage.setLanguage(nextLanguage);
      return nextLanguage;
    });
  }, []);

  const t = useCallback<TranslateFn>(
    (key, params) => {
      const dictionary = translations[language] ?? translations[DEFAULT_LANGUAGE];
      const fallbackDictionary = translations[DEFAULT_LANGUAGE];

      const template = dictionary[key] ?? fallbackDictionary[key] ?? key;
      return formatTemplate(template, params);
    },
    [language],
  );

  const value = useMemo<I18nContextValue>(() => ({ language, setLanguage, t }), [language, setLanguage, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

const useI18n = (): I18nContextValue => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return context;
};

export const useTranslation = () => {
  const { t } = useI18n();
  return { t };
};

export const useLanguage = () => {
  const { language, setLanguage } = useI18n();
  return { language, setLanguage };
};

export const SUPPORTED_LANGUAGES = Object.keys(translations) as LanguageCode[];
