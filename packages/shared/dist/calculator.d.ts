/**
 * Prayer Time Calculation Service
 */
import { PrayerTime, DailyPrayerTimes, Location } from './types';
export declare class PrayerTimeCalculator {
    private static parseTimeString;
    private static occurrenceForDate;
    static getOccurrenceForDate(prayer: PrayerTime, reference?: Date): Date;
    static getUpcomingOccurrence(prayer: PrayerTime, reference?: Date): Date;
    /**
     * Calculate prayer times for a given date and location
     * This is a placeholder - integrate with a real prayer time API or library
     */
    static calculatePrayerTimes(date: Date, location: Location, method?: string): DailyPrayerTimes;
    /**
     * Get next prayer time
     */
    static getNextPrayerTime(prayers: PrayerTime[], reference?: Date): PrayerTime | null;
    /**
     * Calculate time until next prayer
     */
    static getTimeUntilPrayer(prayer: PrayerTime, reference?: Date): number;
    static getTimeUntilNextPrayer(prayerTime: string, reference?: Date): number;
}
