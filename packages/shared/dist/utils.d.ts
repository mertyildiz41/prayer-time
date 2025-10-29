/**
 * Shared Utilities
 */
export declare const formatTime: (date: Date) => string;
export declare const formatDate: (date: Date, locale?: string) => string;
export declare const getTimeZoneOffset: (timezone: string) => number;
export declare const debounce: <T extends (...args: any[]) => any>(func: T, wait: number) => ((...args: Parameters<T>) => void);
export declare const throttle: <T extends (...args: any[]) => any>(func: T, limit: number) => ((...args: Parameters<T>) => void);
