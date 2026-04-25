import { PrayerTimeCalculator, type DailyPrayerTimes, type Location, type PrayerTime } from '@prayer-time/shared';

export type TahajjudReminderMethod = 'custom' | 'lastThird' | 'middle';

export type TahajjudPreferences = {
  enabled: boolean;
  method: TahajjudReminderMethod;
  customTime: string;
  leadMinutes: number;
};

type TimeZoneDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

export const DEFAULT_TAHAJJUD_CUSTOM_TIME = '02:30';

const DEFAULT_FALLBACK_TIME = DEFAULT_TAHAJJUD_CUSTOM_TIME;

const formatDateToTime = (date: Date): string => {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

const parseClockTime = (time: string): { hour: number; minute: number } | null => {
  if (typeof time !== 'string') {
    return null;
  }

  const match = time.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return null;
  }

  const hour = Number.parseInt(match[1], 10);
  const minute = Number.parseInt(match[2], 10);

  if (Number.isNaN(hour) || Number.isNaN(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }

  return { hour, minute };
};

const getTimeZoneDateParts = (value: Date, timeZone: string): TimeZoneDateParts => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(value);

  const lookup = (type: Intl.DateTimeFormatPartTypes): number => {
    const match = parts.find((part) => part.type === type);
    return match ? Number.parseInt(match.value, 10) : 0;
  };

  return {
    year: lookup('year'),
    month: lookup('month'),
    day: lookup('day'),
    hour: lookup('hour'),
    minute: lookup('minute'),
    second: lookup('second'),
  };
};

const getTimeZoneOffsetMs = (value: Date, timeZone: string): number => {
  const zoned = getTimeZoneDateParts(value, timeZone);
  const asUtc = Date.UTC(zoned.year, zoned.month - 1, zoned.day, zoned.hour, zoned.minute, zoned.second);
  return asUtc - value.getTime();
};

const makeDateInTimeZone = (
  timeZone: string,
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second = 0
): Date => {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  const offset = getTimeZoneOffsetMs(utcGuess, timeZone);
  const candidate = new Date(utcGuess.getTime() - offset);
  const correctedOffset = getTimeZoneOffsetMs(candidate, timeZone);

  if (correctedOffset !== offset) {
    return new Date(utcGuess.getTime() - correctedOffset);
  }

  return candidate;
};

const nextOccurrenceForClockTime = (time: string, timeZone: string, referenceDate: Date): Date | null => {
  const parsed = parseClockTime(time);
  if (!parsed) {
    return null;
  }

  const zonedReference = getTimeZoneDateParts(referenceDate, timeZone);
  let candidate = makeDateInTimeZone(
    timeZone,
    zonedReference.year,
    zonedReference.month,
    zonedReference.day,
    parsed.hour,
    parsed.minute
  );

  if (candidate.getTime() <= referenceDate.getTime()) {
    candidate = makeDateInTimeZone(
      timeZone,
      zonedReference.year,
      zonedReference.month,
      zonedReference.day + 1,
      parsed.hour,
      parsed.minute
    );
  }

  return candidate;
};

const findPrayerTime = (prayers: PrayerTime[], name: PrayerTime['name']): string | null => {
  const match = prayers.find((prayer) => prayer.name === name);
  return match?.time ?? null;
};

const normalizeCalculationMethod = (method?: string): string => {
  if (typeof method === 'string' && method.length > 0) {
    return method;
  }

  return 'Diyanet';
};

export const computeNightWindow = (
  location: Location,
  referenceDate: Date,
  calculationMethod?: string
): { isha: Date; fajr: Date } | null => {
  const normalizedMethod = normalizeCalculationMethod(calculationMethod);

  let today: DailyPrayerTimes;
  let tomorrow: DailyPrayerTimes;

  try {
    today = PrayerTimeCalculator.calculatePrayerTimes(referenceDate, location, normalizedMethod);
  } catch (error) {
    console.error("Failed to calculate today's prayer times for tahajjud window.", error);
    return null;
  }

  const tomorrowDate = new Date(referenceDate);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);

  try {
    tomorrow = PrayerTimeCalculator.calculatePrayerTimes(tomorrowDate, location, normalizedMethod);
  } catch (error) {
    console.error("Failed to calculate tomorrow's prayer times for tahajjud window.", error);
    return null;
  }

  const ishaTime = findPrayerTime(today.prayers, 'Isha');
  const fajrTime = findPrayerTime(tomorrow.prayers, 'Fajr');

  if (!ishaTime || !fajrTime) {
    return null;
  }

  const ishaDate = nextOccurrenceForClockTime(ishaTime, location.timezone, new Date(referenceDate.getTime() - 12 * 60 * 60 * 1000));
  const fajrDate = nextOccurrenceForClockTime(fajrTime, location.timezone, referenceDate);

  if (!ishaDate || !fajrDate) {
    return null;
  }

  if (fajrDate.getTime() <= ishaDate.getTime()) {
    return null;
  }

  return { isha: ishaDate, fajr: fajrDate };
};

export const computeTahajjudReminderTime = ({
  method,
  location,
  customTime,
  fallbackTime,
  referenceDate = new Date(),
  calculationMethod,
}: {
  method: TahajjudReminderMethod;
  location?: Location | null;
  customTime?: string | null;
  fallbackTime?: string | null;
  referenceDate?: Date;
  calculationMethod?: string;
}): { time: string; derivedFromMethod: boolean } => {
  if (method === 'custom' || !location) {
    return {
      time: customTime ?? fallbackTime ?? DEFAULT_FALLBACK_TIME,
      derivedFromMethod: false,
    };
  }

  const window = computeNightWindow(location, referenceDate, calculationMethod);
  if (!window) {
    return {
      time: fallbackTime ?? customTime ?? DEFAULT_FALLBACK_TIME,
      derivedFromMethod: false,
    };
  }

  const duration = window.fajr.getTime() - window.isha.getTime();
  if (duration <= 0) {
    return {
      time: fallbackTime ?? customTime ?? DEFAULT_FALLBACK_TIME,
      derivedFromMethod: false,
    };
  }

  const target =
    method === 'lastThird'
      ? new Date(window.fajr.getTime() - duration / 3)
      : new Date(window.isha.getTime() + duration / 2);

  return {
    time: formatDateToTime(target),
    derivedFromMethod: true,
  };
};

export const computeTahajjudReminderOccurrence = ({
  method,
  location,
  customTime,
  leadMinutes,
  referenceDate = new Date(),
  calculationMethod,
}: {
  method: TahajjudReminderMethod;
  location?: Location | null;
  customTime?: string | null;
  leadMinutes: number;
  referenceDate?: Date;
  calculationMethod?: string;
}): { notifyAt: Date; reminderAt: Date; time: string } | null => {
  if (!location) {
    return null;
  }

  let reminderAt: Date | null = null;
  let timeLabel = customTime ?? DEFAULT_FALLBACK_TIME;

  if (method === 'custom') {
    reminderAt = nextOccurrenceForClockTime(timeLabel, location.timezone, referenceDate);
  } else {
    const window = computeNightWindow(location, referenceDate, calculationMethod);
    if (!window) {
      return null;
    }

    const duration = window.fajr.getTime() - window.isha.getTime();
    if (duration <= 0) {
      return null;
    }

    reminderAt =
      method === 'lastThird'
        ? new Date(window.fajr.getTime() - duration / 3)
        : new Date(window.isha.getTime() + duration / 2);
    timeLabel = formatDateToTime(reminderAt);
  }

  if (!reminderAt) {
    return null;
  }

  const notifyAt = new Date(reminderAt.getTime() - Math.max(0, Math.round(leadMinutes)) * 60 * 1000);

  if (notifyAt.getTime() <= referenceDate.getTime()) {
    return computeTahajjudReminderOccurrence({
      method,
      location,
      customTime,
      leadMinutes,
      referenceDate: new Date(referenceDate.getTime() + 60 * 1000),
      calculationMethod,
    });
  }

  return {
    notifyAt,
    reminderAt,
    time: timeLabel,
  };
};
