import { PrayerTimeCalculator, type Location, type DailyPrayerTimes, type PrayerTime } from '@prayer-time/shared';

export type TahajjudReminderMethod = 'custom' | 'lastThird' | 'middle';

const DEFAULT_FALLBACK_TIME = '02:30';

const formatDateToTime = (date: Date): string => {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

const combineDateWithTime = (base: Date, time: string, dayOffset = 0): Date | null => {
  if (typeof time !== 'string') {
    return null;
  }

  const [rawHours, rawMinutes] = time.split(':');
  const hours = Number.parseInt(rawHours, 10);
  const minutes = Number.parseInt(rawMinutes, 10);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return null;
  }

  const candidate = new Date(base);
  candidate.setHours(0, 0, 0, 0);
  candidate.setDate(candidate.getDate() + dayOffset);
  candidate.setHours(hours, minutes, 0, 0);
  return candidate;
};

const findPrayerTime = (prayers: PrayerTime[], name: string): string | null => {
  const match = prayers.find((prayer) => prayer.name === name);
  return match?.time ?? null;
};

const normalizeCalculationMethod = (method?: string): string => {
  if (typeof method === 'string' && method.length > 0) {
    return method;
  }
  return 'Karachi';
};

export const computeNightWindow = (
  location: Location,
  referenceDate: Date,
  calculationMethod?: string,
): { isha: Date; fajr: Date } | null => {
  const normalizedMethod = normalizeCalculationMethod(calculationMethod);

  let today: DailyPrayerTimes;
  let tomorrow: DailyPrayerTimes;

  try {
    today = PrayerTimeCalculator.calculatePrayerTimes(referenceDate, location, normalizedMethod);
  } catch (error) {
    console.error('Failed to calculate today\'s prayer times for tahajjud window.', error);
    return null;
  }

  const tomorrowDate = new Date(referenceDate);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);

  try {
    tomorrow = PrayerTimeCalculator.calculatePrayerTimes(tomorrowDate, location, normalizedMethod);
  } catch (error) {
    console.error('Failed to calculate tomorrow\'s prayer times for tahajjud window.', error);
    return null;
  }

  const ishaTimeString = findPrayerTime(today.prayers, 'Isha');
  const fajrTimeString = findPrayerTime(tomorrow.prayers, 'Fajr');

  if (!ishaTimeString || !fajrTimeString) {
    return null;
  }

  const ishaDate = combineDateWithTime(referenceDate, ishaTimeString, 0);
  const fajrDate = combineDateWithTime(referenceDate, fajrTimeString, 1);

  if (!ishaDate || !fajrDate) {
    return null;
  }

  if (fajrDate.getTime() <= ishaDate.getTime()) {
    fajrDate.setDate(fajrDate.getDate() + 1);
  }

  return { isha: ishaDate, fajr: fajrDate };
};

export type ComputeTahajjudTimeOptions = {
  method: TahajjudReminderMethod;
  location?: Location | null;
  customTime?: string | null;
  fallbackTime?: string | null;
  referenceDate?: Date;
  calculationMethod?: string;
};

export const computeTahajjudReminderTime = ({
  method,
  location,
  customTime,
  fallbackTime,
  referenceDate = new Date(),
  calculationMethod,
}: ComputeTahajjudTimeOptions): { time: string; derivedFromMethod: boolean } => {
  if (method === 'custom' || !location) {
    const time = customTime ?? fallbackTime ?? DEFAULT_FALLBACK_TIME;
    return { time, derivedFromMethod: false };
  }

  const window = location ? computeNightWindow(location, referenceDate, calculationMethod) : null;
  if (!window) {
    const time = fallbackTime ?? customTime ?? DEFAULT_FALLBACK_TIME;
    return { time, derivedFromMethod: false };
  }

  const duration = window.fajr.getTime() - window.isha.getTime();
  if (duration <= 0) {
    const time = fallbackTime ?? customTime ?? DEFAULT_FALLBACK_TIME;
    return { time, derivedFromMethod: false };
  }

  let target: Date;

  if (method === 'lastThird') {
    target = new Date(window.fajr.getTime() - duration / 3);
  } else {
    target = new Date(window.isha.getTime() + duration / 2);
  }

  return { time: formatDateToTime(target), derivedFromMethod: true };
};

