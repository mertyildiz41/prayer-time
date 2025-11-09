"use strict";
/**
 * Prayer Time Calculation Service
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrayerTimeCalculator = void 0;
const adhan_1 = require("adhan");
const METHOD_RESOLVERS = {
    muslimworldleague: () => adhan_1.CalculationMethod.MuslimWorldLeague(),
    mwl: () => adhan_1.CalculationMethod.MuslimWorldLeague(),
    egyptian: () => adhan_1.CalculationMethod.Egyptian(),
    northamerica: () => adhan_1.CalculationMethod.NorthAmerica(),
    isna: () => adhan_1.CalculationMethod.NorthAmerica(),
    karachi: () => adhan_1.CalculationMethod.Karachi(),
    ummalqura: () => adhan_1.CalculationMethod.UmmAlQura(),
    makkah: () => adhan_1.CalculationMethod.UmmAlQura(),
    qatar: () => adhan_1.CalculationMethod.Qatar(),
    kuwait: () => adhan_1.CalculationMethod.Kuwait(),
    singapore: () => adhan_1.CalculationMethod.Singapore(),
    moonsightingcommittee: () => adhan_1.CalculationMethod.MoonsightingCommittee(),
    turkey: () => adhan_1.CalculationMethod.Turkey(),
    diyanet: () => adhan_1.CalculationMethod.Turkey(),
    other: () => adhan_1.CalculationMethod.Other(),
};
const DEFAULT_METHOD_KEY = 'muslimworldleague';
const normalizeMethodKey = (method) => {
    if (!method) {
        return DEFAULT_METHOD_KEY;
    }
    return method
        .toLowerCase()
        .replace(/[^a-z]/g, '');
};
const resolveCalculationParameters = (method) => {
    const key = normalizeMethodKey(method);
    const factory = METHOD_RESOLVERS[key] ?? METHOD_RESOLVERS[DEFAULT_METHOD_KEY];
    const params = factory();
    params.madhab = adhan_1.Madhab.Shafi;
    return params;
};
const getDatePartsInTimeZone = (value, timeZone) => {
    try {
        const formatter = new Intl.DateTimeFormat('en-CA', {
            timeZone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        });
        const parts = formatter.formatToParts(value);
        const lookup = (type) => {
            const match = parts.find((part) => part.type === type);
            return match ? Number.parseInt(match.value, 10) : Number.NaN;
        };
        const year = lookup('year');
        const month = lookup('month');
        const day = lookup('day');
        if (!Number.isNaN(year) && !Number.isNaN(month) && !Number.isNaN(day)) {
            return { year, month, day };
        }
    }
    catch (error) {
        console.error('Failed to resolve timezone-specific date parts', error);
    }
    return {
        year: value.getFullYear(),
        month: value.getMonth() + 1,
        day: value.getDate(),
    };
};
const formatTimeInTimeZone = (value, timeZone) => {
    try {
        return new Intl.DateTimeFormat('en-GB', {
            timeZone,
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        }).format(value);
    }
    catch (error) {
        console.error('Failed to format prayer time for timezone', error);
        return value.toISOString().slice(11, 16);
    }
};
const formatHijriDate = (value, timeZone) => {
    try {
        return new Intl.DateTimeFormat('en-US', {
            timeZone,
            calendar: 'islamic-umalqura',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        }).format(value);
    }
    catch {
        return undefined;
    }
};
const createPrayerEntry = (name, occurrence, timeZone) => ({
    name,
    time: formatTimeInTimeZone(occurrence, timeZone),
    timestamp: Math.floor(occurrence.getTime() / 1000),
});
class PrayerTimeCalculator {
    static parseTimeString(time) {
        const trimmed = time.trim();
        const match = trimmed.match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
        if (!match) {
            return { hour: 0, minute: 0 };
        }
        let hour = Number.parseInt(match[1], 10);
        const minute = Number.parseInt(match[2], 10);
        const meridiem = match[3]?.toLowerCase();
        if (Number.isNaN(hour) || Number.isNaN(minute)) {
            return { hour: 0, minute: 0 };
        }
        if (meridiem === 'pm' && hour < 12) {
            hour += 12;
        }
        if (meridiem === 'am' && hour === 12) {
            hour = 0;
        }
        return {
            hour: Math.min(23, Math.max(0, hour)),
            minute: Math.min(59, Math.max(0, minute)),
        };
    }
    static occurrenceForDate(prayer, reference) {
        if (prayer.timestamp && Number.isFinite(prayer.timestamp) && prayer.timestamp > 0) {
            return new Date(prayer.timestamp * 1000);
        }
        const occurrence = new Date(reference);
        const { hour, minute } = this.parseTimeString(prayer.time);
        occurrence.setHours(hour, minute, 0, 0);
        return occurrence;
    }
    static getOccurrenceForDate(prayer, reference = new Date()) {
        const basis = this.occurrenceForDate(prayer, reference);
        return new Date(basis.getTime());
    }
    static getUpcomingOccurrence(prayer, reference = new Date()) {
        const occurrence = this.occurrenceForDate(prayer, reference);
        if (occurrence.getTime() <= reference.getTime()) {
            occurrence.setDate(occurrence.getDate() + 1);
        }
        return occurrence;
    }
    /**
     * Calculate prayer times for a given date and location
     * This is a placeholder - integrate with a real prayer time API or library
     */
    static calculatePrayerTimes(date, location, method = 'MuslimWorldLeague') {
        try {
            const params = resolveCalculationParameters(method);
            const coordinates = new adhan_1.Coordinates(location.latitude, location.longitude);
            const dateParts = getDatePartsInTimeZone(date, location.timezone);
            const calculationDate = new Date(dateParts.year, dateParts.month - 1, dateParts.day);
            const adhanTimes = new adhan_1.PrayerTimes(coordinates, calculationDate, params);
            const prayers = [
                createPrayerEntry('Fajr', adhanTimes.fajr, location.timezone),
                createPrayerEntry('Sunrise', adhanTimes.sunrise, location.timezone),
                createPrayerEntry('Dhuhr', adhanTimes.dhuhr, location.timezone),
                createPrayerEntry('Asr', adhanTimes.asr, location.timezone),
                createPrayerEntry('Sunset', adhanTimes.sunset, location.timezone),
                createPrayerEntry('Maghrib', adhanTimes.maghrib, location.timezone),
                createPrayerEntry('Isha', adhanTimes.isha, location.timezone),
            ];
            const isoDate = `${dateParts.year}-${String(dateParts.month).padStart(2, '0')}-${String(dateParts.day).padStart(2, '0')}`;
            const hijriDate = formatHijriDate(calculationDate, location.timezone);
            return {
                date: isoDate,
                prayers,
                ...(hijriDate ? { hijriDate } : {}),
            };
        }
        catch (error) {
            console.error('Failed to calculate prayer times with Adhan, falling back to static schedule', error);
            return {
                date: date.toISOString().split('T')[0],
                prayers: [
                    { name: 'Fajr', time: '05:30', timestamp: 0 },
                    { name: 'Sunrise', time: '07:00', timestamp: 0 },
                    { name: 'Dhuhr', time: '12:30', timestamp: 0 },
                    { name: 'Asr', time: '15:45', timestamp: 0 },
                    { name: 'Sunset', time: '18:00', timestamp: 0 },
                    { name: 'Maghrib', time: '18:15', timestamp: 0 },
                    { name: 'Isha', time: '20:00', timestamp: 0 },
                ],
            };
        }
    }
    /**
     * Get next prayer time
     */
    static getNextPrayerTime(prayers, reference = new Date()) {
        if (!prayers.length) {
            return null;
        }
        const sorted = [...prayers].sort((a, b) => {
            const first = this.getOccurrenceForDate(a, reference).getTime();
            const second = this.getOccurrenceForDate(b, reference).getTime();
            return first - second;
        });
        for (const prayer of sorted) {
            if (this.getOccurrenceForDate(prayer, reference).getTime() > reference.getTime()) {
                return prayer;
            }
        }
        return sorted[0] ?? null;
    }
    /**
     * Calculate time until next prayer
     */
    static getTimeUntilPrayer(prayer, reference = new Date()) {
        const upcoming = this.getUpcomingOccurrence(prayer, reference);
        return upcoming.getTime() - reference.getTime();
    }
    static getTimeUntilNextPrayer(prayerTime, reference = new Date()) {
        const { hour, minute } = this.parseTimeString(prayerTime);
        const occurrence = new Date(reference);
        occurrence.setHours(hour, minute, 0, 0);
        if (occurrence.getTime() <= reference.getTime()) {
            occurrence.setDate(occurrence.getDate() + 1);
        }
        return occurrence.getTime() - reference.getTime();
    }
    /**
     * Calculate Qibla direction
     */
    static calculateQiblaDirection(location) {
        const kaaba = {
            latitude: 21.4225,
            longitude: 39.8262,
        };
        const toRadians = (degrees) => degrees * (Math.PI / 180);
        const lat1 = toRadians(location.latitude);
        const lon1 = toRadians(location.longitude);
        const lat2 = toRadians(kaaba.latitude);
        const lon2 = toRadians(kaaba.longitude);
        const lonDiff = lon2 - lon1;
        const y = Math.sin(lonDiff);
        const x = Math.cos(lat1) * Math.tan(lat2) - Math.sin(lat1) * Math.cos(lonDiff);
        let angle = Math.atan2(y, x);
        angle = (angle * 180) / Math.PI;
        angle = (angle + 360) % 360;
        return angle;
    }
}
exports.PrayerTimeCalculator = PrayerTimeCalculator;
