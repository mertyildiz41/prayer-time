/**
 * Prayer Times Type Definitions
 */
export interface PrayerTime {
    name: 'Fajr' | 'Sunrise' | 'Dhuhr' | 'Asr' | 'Sunset' | 'Maghrib' | 'Isha';
    time: string;
    timestamp: number;
}
export interface DailyPrayerTimes {
    date: string;
    prayers: PrayerTime[];
    hijriDate?: string;
}
export interface Location {
    latitude: number;
    longitude: number;
    city: string;
    country: string;
    timezone: string;
}
export interface AppSettings {
    location: Location;
    calculationMethod: 'MuslimWorldLeague' | 'Islamic' | 'Karachi' | 'Diyanet' | 'Custom';
    madhab: 'Hanafi' | 'Shafi';
    notifications: boolean;
    theme: 'light' | 'dark' | 'auto';
    language: 'en' | 'ar' | 'tr' | 'ur';
}
export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
    timestamp: number;
}
