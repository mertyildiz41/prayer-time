"use strict";
/**
 * Shared Constants
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.API_CONFIG = exports.PRAYER_NAMES = exports.THEMES = exports.LANGUAGES = exports.MADHABS = exports.CALCULATION_METHODS = void 0;
exports.CALCULATION_METHODS = {
    MuslimWorldLeague: 'Muslim World League',
    Islamic: 'Islamic Society of North America',
    Karachi: 'University of Islamic Sciences, Karachi',
    Diyanet: 'Presidency of Religious Affairs, Turkey',
    Custom: 'Custom',
};
exports.MADHABS = {
    Hanafi: 'Hanafi',
    Shafi: 'Shafi',
};
exports.LANGUAGES = {
    en: 'English',
    ar: 'العربية',
    tr: 'Türkçe',
    ur: 'اردو',
};
exports.THEMES = {
    light: 'Light',
    dark: 'Dark',
    auto: 'Auto',
};
exports.PRAYER_NAMES = {
    Fajr: 'Fajr',
    Sunrise: 'Sunrise',
    Dhuhr: 'Dhuhr',
    Asr: 'Asr',
    Sunset: 'Sunset',
    Maghrib: 'Maghrib',
    Isha: 'Isha',
};
exports.API_CONFIG = {
    timeout: 10000,
    retries: 3,
    baseURL: process.env.REACT_APP_API_URL || 'https://api.example.com',
};
