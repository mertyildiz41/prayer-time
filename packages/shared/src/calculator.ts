/**
 * Prayer Time Calculation Service
 */

import { CalculationMethod, CalculationParameters, Coordinates, Madhab, PrayerTimes as AdhanPrayerTimes } from 'adhan';
import { PrayerTime, DailyPrayerTimes, Location } from './types';

const METHOD_RESOLVERS: Record<string, () => CalculationParameters> = {
  muslimworldleague: () => CalculationMethod.MuslimWorldLeague(),
  mwl: () => CalculationMethod.MuslimWorldLeague(),
  egyptian: () => CalculationMethod.Egyptian(),
  northamerica: () => CalculationMethod.NorthAmerica(),
  isna: () => CalculationMethod.NorthAmerica(),
  karachi: () => CalculationMethod.Karachi(),
  ummalqura: () => CalculationMethod.UmmAlQura(),
  makkah: () => CalculationMethod.UmmAlQura(),
  qatar: () => CalculationMethod.Qatar(),
  kuwait: () => CalculationMethod.Kuwait(),
  singapore: () => CalculationMethod.Singapore(),
  moonsightingcommittee: () => CalculationMethod.MoonsightingCommittee(),
  turkey: () => CalculationMethod.Turkey(),
  diyanet: () => CalculationMethod.Turkey(),
  other: () => CalculationMethod.Other(),
};

const DEFAULT_METHOD_KEY = 'muslimworldleague';

const normalizeMethodKey = (method: string | undefined | null): string => {
  if (!method) {
    return DEFAULT_METHOD_KEY;
  }

  return method
    .toLowerCase()
    .replace(/[^a-z]/g, '');
};

const resolveCalculationParameters = (method: string): CalculationParameters => {
  const key = normalizeMethodKey(method);
  const factory = METHOD_RESOLVERS[key] ?? METHOD_RESOLVERS[DEFAULT_METHOD_KEY];
  const params = factory();
  params.madhab = Madhab.Shafi;
  return params;
};

interface DateParts {
  year: number;
  month: number;
  day: number;
}

const getDatePartsInTimeZone = (value: Date, timeZone: string): DateParts => {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

    const parts = formatter.formatToParts(value);
    const lookup = (type: string): number => {
      const match = parts.find((part) => part.type === type);
      return match ? Number.parseInt(match.value, 10) : Number.NaN;
    };

    const year = lookup('year');
    const month = lookup('month');
    const day = lookup('day');

    if (!Number.isNaN(year) && !Number.isNaN(month) && !Number.isNaN(day)) {
      return { year, month, day };
    }
  } catch (error) {
    console.error('Failed to resolve timezone-specific date parts', error);
  }

  return {
    year: value.getFullYear(),
    month: value.getMonth() + 1,
    day: value.getDate(),
  };
};

const formatTimeInTimeZone = (value: Date, timeZone: string): string => {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(value);
  } catch (error) {
    console.error('Failed to format prayer time for timezone', error);
    return value.toISOString().slice(11, 16);
  }
};

const formatHijriDate = (value: Date, timeZone: string): string | undefined => {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone,
      calendar: 'islamic-umalqura',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(value);
  } catch {
    return undefined;
  }
};

const createPrayerEntry = (
  name: PrayerTime['name'],
  occurrence: Date,
  timeZone: string
): PrayerTime => ({
  name,
  time: formatTimeInTimeZone(occurrence, timeZone),
  timestamp: Math.floor(occurrence.getTime() / 1000),
});

export class PrayerTimeCalculator {
  private static parseTimeString(time: string): { hour: number; minute: number } {
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

  private static occurrenceForDate(prayer: PrayerTime, reference: Date): Date {
    if (prayer.timestamp && Number.isFinite(prayer.timestamp) && prayer.timestamp > 0) {
      return new Date(prayer.timestamp * 1000);
    }

    const occurrence = new Date(reference);
    const { hour, minute } = this.parseTimeString(prayer.time);
    occurrence.setHours(hour, minute, 0, 0);
    return occurrence;
  }

  static getOccurrenceForDate(prayer: PrayerTime, reference: Date = new Date()): Date {
    const basis = this.occurrenceForDate(prayer, reference);
    return new Date(basis.getTime());
  }

  static getUpcomingOccurrence(prayer: PrayerTime, reference: Date = new Date()): Date {
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
  static calculatePrayerTimes(
    date: Date,
    location: Location,
    method: string = 'MuslimWorldLeague'
  ): DailyPrayerTimes {
    try {
      const params = resolveCalculationParameters(method);
      const coordinates = new Coordinates(location.latitude, location.longitude);
      const dateParts = getDatePartsInTimeZone(date, location.timezone);
      const calculationDate = new Date(dateParts.year, dateParts.month - 1, dateParts.day);
      const adhanTimes = new AdhanPrayerTimes(coordinates, calculationDate, params);

      const prayers: PrayerTime[] = [
        createPrayerEntry('Fajr', adhanTimes.fajr, location.timezone),
        createPrayerEntry('Sunrise', adhanTimes.sunrise, location.timezone),
        createPrayerEntry('Dhuhr', adhanTimes.dhuhr, location.timezone),
        createPrayerEntry('Asr', adhanTimes.asr, location.timezone),
        createPrayerEntry('Sunset', adhanTimes.sunset, location.timezone),
        createPrayerEntry('Maghrib', adhanTimes.maghrib, location.timezone),
        createPrayerEntry('Isha', adhanTimes.isha, location.timezone),
      ];

      const isoDate = `${dateParts.year}-${String(dateParts.month).padStart(2, '0')}-${String(
        dateParts.day
      ).padStart(2, '0')}`;
      const hijriDate = formatHijriDate(calculationDate, location.timezone);

      return {
        date: isoDate,
        prayers,
        ...(hijriDate ? { hijriDate } : {}),
      };
    } catch (error) {
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
  static getNextPrayerTime(prayers: PrayerTime[], reference: Date = new Date()): PrayerTime | null {
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
  static getTimeUntilPrayer(prayer: PrayerTime, reference: Date = new Date()): number {
    const upcoming = this.getUpcomingOccurrence(prayer, reference);
    return upcoming.getTime() - reference.getTime();
  }

  static getTimeUntilNextPrayer(prayerTime: string, reference: Date = new Date()): number {
    const { hour, minute } = this.parseTimeString(prayerTime);
    const occurrence = new Date(reference);
    occurrence.setHours(hour, minute, 0, 0);

    if (occurrence.getTime() <= reference.getTime()) {
      occurrence.setDate(occurrence.getDate() + 1);
    }

    return occurrence.getTime() - reference.getTime();
  }
}
