import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DailyPrayerTimes, Location, PrayerTime, PrayerTimeCalculator } from '@prayer-time/shared';
import './App.css';
import {
  DEFAULT_NOTIFICATION_CONFIG,
  MAX_NOTIFICATION_OFFSET_MINUTES,
  NOTIFIABLE_PRAYER_NAMES,
  type NotificationScheduleConfig,
  type NotifiablePrayerName,
  normalizeNotificationConfig,
} from './notificationConfig';
import {
  DEFAULT_TAHAJJUD_CUSTOM_TIME,
  type TahajjudPreferences,
  type TahajjudReminderMethod,
  computeTahajjudReminderTime,
} from './tahajjudTime';
import {
  createDefaultPrayerCheckState,
  type PrayerCheckResponse,
  type PrayerCheckState,
} from './prayerCheckTypes';

type PrayerName = PrayerTime['name'];

interface StoredLocationPayload {
  location: Location;
  presetId?: string;
}

interface LocationOption {
  id: string;
  label: string;
  description: string;
  location: Location;
}

interface ElectronIPC {
  on: (channel: string, func: (...args: unknown[]) => void) => () => void;
}

interface ElectronAPI {
  calculatePrayerTimes: (date: string, location: Location, method: string) => Promise<DailyPrayerTimes>;
  ipcRenderer?: ElectronIPC;
  configureNotifications?: (
    enabled: boolean,
    times?: DailyPrayerTimes | null,
    preferences?: NotificationScheduleConfig,
    tahajjud?: {
      enabled: boolean;
      method: TahajjudReminderMethod;
      customTime: string;
      leadMinutes: number;
      location?: Location | null;
      calculationMethod?: string;
    }
  ) => void;
  getPrayerCheckState?: () => Promise<PrayerCheckState>;
  respondToPrayerCheck?: (id: string, response: PrayerCheckResponse) => Promise<PrayerCheckState>;
}

declare global {
  interface Window {
    electron?: ElectronAPI;
  }
}

const NOTIFICATION_STORAGE_KEY = 'prayer-time-notifications';
const NOTIFICATION_SETTINGS_STORAGE_KEY = 'prayer-time-notification-preferences';
const LOCATION_STORAGE_KEY = 'prayer-time-location';
const CALCULATION_METHOD_STORAGE_KEY = 'prayer-time-calculation-method';
const TIME_FORMAT_STORAGE_KEY = 'prayer-time-twenty-four-hour';
const TAHAJJUD_SETTINGS_STORAGE_KEY = 'prayer-time-tahajjud';
const DEFAULT_CALCULATION_METHOD = 'Diyanet';
const CLOCK_REFRESH_INTERVAL = 1000;
const CLOCK_DRIFT_THRESHOLD = 30000;
const MAX_TAHAJJUD_LEAD_MINUTES = 120;

const LOCATION_OPTIONS: LocationOption[] = [
  {
    id: 'nyc',
    label: 'New York, USA',
    description: 'Eastern Time (UTC-5)',
    location: {
      latitude: 40.7128,
      longitude: -74.006,
      city: 'New York',
      country: 'USA',
      timezone: 'America/New_York',
    },
  },
  {
    id: 'istanbul',
    label: 'Istanbul, Türkiye',
    description: 'Türkiye Time (UTC+3)',
    location: {
      latitude: 41.0082,
      longitude: 28.9784,
      city: 'Istanbul',
      country: 'Türkiye',
      timezone: 'Europe/Istanbul',
    },
  },
  {
    id: 'kualalumpur',
    label: 'Kuala Lumpur, Malaysia',
    description: 'Malaysia Time (UTC+8)',
    location: {
      latitude: 3.139,
      longitude: 101.6869,
      city: 'Kuala Lumpur',
      country: 'Malaysia',
      timezone: 'Asia/Kuala_Lumpur',
    },
  },
  {
    id: 'london',
    label: 'London, United Kingdom',
    description: 'Greenwich Mean Time (UTC+0)',
    location: {
      latitude: 51.5074,
      longitude: -0.1278,
      city: 'London',
      country: 'United Kingdom',
      timezone: 'Europe/London',
    },
  },
];

const CALCULATION_METHOD_OPTIONS = [
  { key: 'Diyanet', label: 'Diyanet (Turkey)' },
  { key: 'MuslimWorldLeague', label: 'Muslim World League' },
  { key: 'Karachi', label: 'Karachi' },
  { key: 'Egyptian', label: 'Egyptian' },
  { key: 'UmmAlQura', label: 'Umm al-Qura' },
] as const;

const TAHAJJUD_METHOD_OPTIONS: ReadonlyArray<{
  value: TahajjudReminderMethod;
  label: string;
  description: string;
}> = [
  {
    value: 'custom',
    label: 'Custom time',
    description: 'Choose an exact reminder time.',
  },
  {
    value: 'middle',
    label: 'Middle of the night',
    description: 'Automatically follow the midpoint between Isha and Fajr.',
  },
  {
    value: 'lastThird',
    label: 'Last third of the night',
    description: 'Follow the final third of the night window.',
  },
];

const DEFAULT_LOCATION_OPTION = LOCATION_OPTIONS[0];
const HIDDEN_PRAYER_NAMES: ReadonlySet<PrayerName> = new Set(['Sunrise', 'Sunset']);

const createDefaultTahajjudSettings = (): TahajjudPreferences => ({
  enabled: false,
  method: 'custom',
  customTime: DEFAULT_TAHAJJUD_CUSTOM_TIME,
  leadMinutes: 0,
});

const isValidLocation = (value: unknown): value is Location => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.latitude === 'number' &&
    typeof candidate.longitude === 'number' &&
    typeof candidate.city === 'string' &&
    typeof candidate.country === 'string' &&
    typeof candidate.timezone === 'string'
  );
};

const findPresetIdForLocation = (location: Location | null): string | null => {
  if (!location) {
    return null;
  }

  const match = LOCATION_OPTIONS.find((option) => {
    const preset = option.location;
    const coordinatesClose =
      Math.abs(preset.latitude - location.latitude) < 0.0001 &&
      Math.abs(preset.longitude - location.longitude) < 0.0001;

    return coordinatesClose && preset.timezone === location.timezone;
  });

  return match?.id ?? null;
};

const clampTahajjudLeadMinutes = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const rounded = Math.round(value);
  if (rounded < 0) {
    return 0;
  }

  if (rounded > MAX_TAHAJJUD_LEAD_MINUTES) {
    return MAX_TAHAJJUD_LEAD_MINUTES;
  }

  return rounded;
};

const formatTimeRemaining = (milliseconds: number): string => {
  if (milliseconds <= 0) {
    return 'Now';
  }

  const totalMinutes = Math.max(1, Math.round(milliseconds / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (hours > 0) {
    return `${hours}h`;
  }

  return `${minutes}m`;
};

const formatTo12Hour = (time: string): string => {
  const match = time.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return time;
  }

  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return time;
  }

  const period = hours >= 12 ? 'PM' : 'AM';
  const normalizedHour = hours % 12 || 12;
  return `${String(normalizedHour)}:${String(minutes).padStart(2, '0')} ${period}`;
};

const formatDisplayTime = (time: string, twentyFourHourClock: boolean): string => {
  return twentyFourHourClock ? time : formatTo12Hour(time);
};

const getIsoDateInTimeZone = (value: Date, timeZone: string): string => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = formatter.formatToParts(value);
  const lookup = (type: 'year' | 'month' | 'day'): string => {
    const match = parts.find((part) => part.type === type);
    return match?.value ?? '00';
  };

  return `${lookup('year')}-${lookup('month')}-${lookup('day')}`;
};

const formatCurrentTime = (value: Date, timeZone: string | undefined, twentyFourHourClock: boolean): string => {
  return new Intl.DateTimeFormat(undefined, {
    ...(timeZone ? { timeZone } : {}),
    hour: '2-digit',
    minute: '2-digit',
    hour12: !twentyFourHourClock,
  }).format(value);
};

const formatCurrentDate = (value: Date, timeZone: string | undefined): string => {
  return new Intl.DateTimeFormat(undefined, {
    ...(timeZone ? { timeZone } : {}),
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(value);
};

const normalizeTahajjudSettings = (value: unknown): TahajjudPreferences => {
  if (!value || typeof value !== 'object') {
    return createDefaultTahajjudSettings();
  }

  const candidate = value as Partial<TahajjudPreferences>;
  const method =
    candidate.method === 'custom' || candidate.method === 'middle' || candidate.method === 'lastThird'
      ? candidate.method
      : 'custom';

  const customTime =
    typeof candidate.customTime === 'string' && candidate.customTime.length > 0
      ? candidate.customTime
      : DEFAULT_TAHAJJUD_CUSTOM_TIME;

  return {
    enabled: Boolean(candidate.enabled),
    method,
    customTime,
    leadMinutes: clampTahajjudLeadMinutes(
      typeof candidate.leadMinutes === 'number' ? candidate.leadMinutes : 0
    ),
  };
};

function App() {
  const [prayerTimes, setPrayerTimes] = useState<DailyPrayerTimes | null>(null);
  const [loading, setLoading] = useState(true);
  const [nextPrayer, setNextPrayer] = useState<PrayerTime | null>(null);
  const [previousPrayer, setPreviousPrayer] = useState<PrayerTime | null>(null);
  const [nextPrayerProgress, setNextPrayerProgress] = useState(0);
  const [timeUntilNext, setTimeUntilNext] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showLocationOnboarding, setShowLocationOnboarding] = useState(false);
  const [activeLocation, setActiveLocation] = useState<Location | null>(null);
  const [locationHydrated, setLocationHydrated] = useState(false);
  const [pendingLocationId, setPendingLocationId] = useState(DEFAULT_LOCATION_OPTION.id);
  const [locationPresetId, setLocationPresetId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [calculationMethod, setCalculationMethod] = useState(DEFAULT_CALCULATION_METHOD);
  const [twentyFourHourClock, setTwentyFourHourClock] = useState(false);
  const [notificationConfig, setNotificationConfig] = useState<NotificationScheduleConfig>(() =>
    normalizeNotificationConfig()
  );
  const [tahajjudSettings, setTahajjudSettings] = useState<TahajjudPreferences>(() =>
    createDefaultTahajjudSettings()
  );
  const [prayerCheckState, setPrayerCheckState] = useState<PrayerCheckState>(() =>
    createDefaultPrayerCheckState()
  );
  const [settingsHydrated, setSettingsHydrated] = useState(false);
  const [currentTimeDisplay, setCurrentTimeDisplay] = useState('');
  const [currentDateDisplay, setCurrentDateDisplay] = useState('');

  const notificationsSupported = typeof window !== 'undefined' && 'Notification' in window;
  const notificationPermission =
    notificationsSupported && typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';

  const prayerTimesRef = useRef<DailyPrayerTimes | null>(null);
  const activeLocationRef = useRef<Location | null>(null);

  const calculationMethodLabel = useMemo(() => {
    return (
      CALCULATION_METHOD_OPTIONS.find((option) => option.key === calculationMethod)?.label ?? calculationMethod
    );
  }, [calculationMethod]);

  const visiblePrayers = useMemo<PrayerTime[]>(() => {
    if (!prayerTimes) {
      return [];
    }

    return prayerTimes.prayers.filter((prayer) => !HIDDEN_PRAYER_NAMES.has(prayer.name));
  }, [prayerTimes]);

  const notificationPrayers = useMemo<PrayerTime[]>(() => {
    return visiblePrayers.filter((prayer) =>
      NOTIFIABLE_PRAYER_NAMES.includes(prayer.name as NotifiablePrayerName)
    );
  }, [visiblePrayers]);

  const selectedLocationOption = useMemo<LocationOption>(() => {
    return LOCATION_OPTIONS.find((option) => option.id === pendingLocationId) ?? DEFAULT_LOCATION_OPTION;
  }, [pendingLocationId]);

  const settingsLocationId = useMemo(() => {
    return locationPresetId ?? findPresetIdForLocation(activeLocation) ?? DEFAULT_LOCATION_OPTION.id;
  }, [activeLocation, locationPresetId]);

  const tahajjudPreview = useMemo(() => {
    return computeTahajjudReminderTime({
      method: tahajjudSettings.method,
      location: activeLocation,
      customTime: tahajjudSettings.customTime,
      fallbackTime: tahajjudSettings.customTime,
      calculationMethod,
    });
  }, [activeLocation, calculationMethod, tahajjudSettings.customTime, tahajjudSettings.method]);

  const tahajjudMethodLabel = useMemo(() => {
    return (
      TAHAJJUD_METHOD_OPTIONS.find((option) => option.value === tahajjudSettings.method)?.label ??
      tahajjudSettings.method
    );
  }, [tahajjudSettings.method]);

  const tahajjudStatusLabel = useMemo(() => {
    if (!tahajjudSettings.enabled) {
      return 'Night reminder is off';
    }

    const prefix =
      tahajjudSettings.leadMinutes > 0
        ? `${tahajjudSettings.leadMinutes} min before`
        : 'At reminder time';

    return `${formatDisplayTime(tahajjudPreview.time, twentyFourHourClock)} • ${prefix}`;
  }, [tahajjudPreview.time, tahajjudSettings.enabled, tahajjudSettings.leadMinutes, twentyFourHourClock]);

  const pendingPrayerCheck = useMemo(() => {
    return prayerCheckState.pending[0] ?? null;
  }, [prayerCheckState.pending]);

  const totalMissedPrayers = useMemo(() => {
    return NOTIFIABLE_PRAYER_NAMES.reduce((total, prayerName) => {
      return total + (prayerCheckState.missedCounts[prayerName] ?? 0);
    }, 0);
  }, [prayerCheckState.missedCounts]);

  const missedPrayerBreakdown = useMemo(() => {
    return NOTIFIABLE_PRAYER_NAMES.filter((prayerName) => (prayerCheckState.missedCounts[prayerName] ?? 0) > 0).map(
      (prayerName) => `${prayerName} ${prayerCheckState.missedCounts[prayerName]}`
    );
  }, [prayerCheckState.missedCounts]);

  useEffect(() => {
    prayerTimesRef.current = prayerTimes;
  }, [prayerTimes]);

  useEffect(() => {
    activeLocationRef.current = activeLocation;
  }, [activeLocation]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      setLocationHydrated(true);
      return;
    }

    try {
      const raw = localStorage.getItem(LOCATION_STORAGE_KEY);

      if (!raw) {
        setLoading(false);
        setPendingLocationId(DEFAULT_LOCATION_OPTION.id);
        setShowLocationOnboarding(true);
        setSettingsOpen(false);
        setLocationHydrated(true);
        return;
      }

      const parsed = JSON.parse(raw);
      let storedLocation: Location | null = null;
      let storedPresetId: string | null = null;

      if (parsed && typeof parsed === 'object' && 'location' in parsed) {
        const payload = parsed as StoredLocationPayload;
        if (isValidLocation(payload.location)) {
          storedLocation = payload.location;
        }
        if (typeof payload.presetId === 'string') {
          storedPresetId = payload.presetId;
        }
      } else if (isValidLocation(parsed)) {
        storedLocation = parsed;
      }

      if (storedLocation) {
        setActiveLocation(storedLocation);
        const matchedPreset = storedPresetId ?? findPresetIdForLocation(storedLocation);
        if (matchedPreset) {
          setPendingLocationId(matchedPreset);
          setLocationPresetId(matchedPreset);
        }
      } else {
        setLoading(false);
        setPendingLocationId(DEFAULT_LOCATION_OPTION.id);
        setShowLocationOnboarding(true);
        setSettingsOpen(false);
      }
    } catch (error) {
      console.error('Failed to load stored location', error);
      setLoading(false);
      setPendingLocationId(DEFAULT_LOCATION_OPTION.id);
      setShowLocationOnboarding(true);
      setSettingsOpen(false);
    } finally {
      setLocationHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      setSettingsHydrated(true);
      return;
    }

    try {
      const storedMethod = localStorage.getItem(CALCULATION_METHOD_STORAGE_KEY);
      if (storedMethod) {
        setCalculationMethod(storedMethod);
      }

      const storedClock = localStorage.getItem(TIME_FORMAT_STORAGE_KEY);
      if (storedClock === 'true' || storedClock === 'false') {
        setTwentyFourHourClock(storedClock === 'true');
      }

      const storedNotificationConfig = localStorage.getItem(NOTIFICATION_SETTINGS_STORAGE_KEY);
      if (storedNotificationConfig) {
        setNotificationConfig(normalizeNotificationConfig(JSON.parse(storedNotificationConfig)));
      }

      const storedTahajjud = localStorage.getItem(TAHAJJUD_SETTINGS_STORAGE_KEY);
      if (storedTahajjud) {
        setTahajjudSettings(normalizeTahajjudSettings(JSON.parse(storedTahajjud)));
      }
    } catch (error) {
      console.error('Failed to load desktop settings', error);
    } finally {
      setSettingsHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!settingsHydrated || typeof window === 'undefined') {
      return;
    }

    localStorage.setItem(CALCULATION_METHOD_STORAGE_KEY, calculationMethod);
  }, [calculationMethod, settingsHydrated]);

  useEffect(() => {
    if (!settingsHydrated || typeof window === 'undefined') {
      return;
    }

    localStorage.setItem(TIME_FORMAT_STORAGE_KEY, String(twentyFourHourClock));
  }, [settingsHydrated, twentyFourHourClock]);

  useEffect(() => {
    if (!settingsHydrated || typeof window === 'undefined') {
      return;
    }

    localStorage.setItem(NOTIFICATION_SETTINGS_STORAGE_KEY, JSON.stringify(notificationConfig));
  }, [notificationConfig, settingsHydrated]);

  useEffect(() => {
    if (!settingsHydrated || typeof window === 'undefined') {
      return;
    }

    localStorage.setItem(TAHAJJUD_SETTINGS_STORAGE_KEY, JSON.stringify(tahajjudSettings));
  }, [settingsHydrated, tahajjudSettings]);

  const persistLocation = useCallback((location: Location, presetId?: string | null) => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const payload: StoredLocationPayload = {
        location,
        ...(presetId ? { presetId } : {}),
      };

      localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
      console.error('Failed to persist location', error);
    }
  }, []);

  useEffect(() => {
    if (!locationHydrated || !activeLocation) {
      return;
    }

    const matchedPreset = locationPresetId ?? findPresetIdForLocation(activeLocation);
    persistLocation(activeLocation, matchedPreset);
  }, [activeLocation, locationHydrated, locationPresetId, persistLocation]);

  const updateNextPrayer = useCallback((times: DailyPrayerTimes) => {
    const prayers = times.prayers.filter((prayer) => !HIDDEN_PRAYER_NAMES.has(prayer.name));

    if (!prayers.length) {
      setNextPrayer(null);
      setPreviousPrayer(null);
      setTimeUntilNext('');
      setNextPrayerProgress(0);
      return;
    }

    const reference = new Date();
    const upcoming = PrayerTimeCalculator.getNextPrayerTime(prayers, reference);
    setNextPrayer(upcoming);

    if (!upcoming) {
      setTimeUntilNext('');
      setPreviousPrayer(null);
      setNextPrayerProgress(0);
      return;
    }

    const remaining = PrayerTimeCalculator.getTimeUntilPrayer(upcoming, reference);
    setTimeUntilNext(formatTimeRemaining(remaining));

    const nextOccurrence = PrayerTimeCalculator.getUpcomingOccurrence(upcoming, reference);

    let previousContext: { prayer: PrayerTime; occurrence: Date } | null = null;

    prayers.forEach((prayer) => {
      const occurrence = PrayerTimeCalculator.getOccurrenceForDate(prayer, reference);
      if (occurrence.getTime() <= reference.getTime()) {
        previousContext = { prayer, occurrence };
      }
    });

    if (!previousContext && prayers.length > 0) {
      const lastPrayer = prayers[prayers.length - 1];
      const occurrence = PrayerTimeCalculator.getOccurrenceForDate(lastPrayer, reference);
      if (occurrence.getTime() >= nextOccurrence.getTime()) {
        occurrence.setDate(occurrence.getDate() - 1);
      }
      previousContext = { prayer: lastPrayer, occurrence };
    }

    if (previousContext && previousContext.occurrence.getTime() >= nextOccurrence.getTime()) {
      previousContext.occurrence.setDate(previousContext.occurrence.getDate() - 1);
    }

    setPreviousPrayer(previousContext?.prayer ?? null);

    if (!previousContext) {
      setNextPrayerProgress(0);
      return;
    }

    const totalWindow = nextOccurrence.getTime() - previousContext.occurrence.getTime();
    const elapsedWindow = reference.getTime() - previousContext.occurrence.getTime();

    if (totalWindow <= 0) {
      setNextPrayerProgress(0);
      return;
    }

    const progress = Math.min(100, Math.max(0, (elapsedWindow / totalWindow) * 100));
    setNextPrayerProgress(progress);
  }, []);

  const loadPrayerTimes = useCallback(
    async (targetLocation: Location) => {
      try {
        setLoading(true);

        const now = new Date();
        let times: DailyPrayerTimes;

        if (window.electron?.calculatePrayerTimes) {
          times = await window.electron.calculatePrayerTimes(now.toISOString(), targetLocation, calculationMethod);
        } else {
          times = PrayerTimeCalculator.calculatePrayerTimes(now, targetLocation, calculationMethod);
        }

        setPrayerTimes(times);
        updateNextPrayer(times);
      } catch (error) {
        console.error('Error loading prayer times:', error);
        setPrayerTimes(null);
      } finally {
        setLoading(false);
      }
    },
    [calculationMethod, updateNextPrayer]
  );

  useEffect(() => {
    if (!locationHydrated) {
      return;
    }

    if (!activeLocation) {
      setPrayerTimes(null);
      return;
    }

    loadPrayerTimes(activeLocation);
  }, [activeLocation, loadPrayerTimes, locationHydrated]);

  useEffect(() => {
    const removeListener = window.electron?.ipcRenderer?.on('notifications:open', () => {
      setSettingsOpen(true);
      setShowOnboarding(false);
    });

    return () => {
      removeListener?.();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadPrayerCheckState = async () => {
      try {
        const nextState = await window.electron?.getPrayerCheckState?.();
        if (!cancelled && nextState) {
          setPrayerCheckState(nextState);
        }
      } catch (error) {
        console.error('Failed to load prayer check state.', error);
      }
    };

    void loadPrayerCheckState();

    const removeListener = window.electron?.ipcRenderer?.on('prayer-check-state', (nextState: unknown) => {
      if (!nextState || typeof nextState !== 'object') {
        return;
      }

      setPrayerCheckState(nextState as PrayerCheckState);
    });

    return () => {
      cancelled = true;
      removeListener?.();
    };
  }, []);

  useEffect(() => {
    let lastTick = Date.now();

    const tick = () => {
      const now = new Date();
      const currentLocation = activeLocationRef.current;
      const timeZone = currentLocation?.timezone;

      setCurrentTimeDisplay(formatCurrentTime(now, timeZone, twentyFourHourClock));
      setCurrentDateDisplay(formatCurrentDate(now, timeZone));

      const currentTimes = prayerTimesRef.current;
      if (currentTimes) {
        updateNextPrayer(currentTimes);

        if (currentLocation) {
          const currentDateKey = getIsoDateInTimeZone(now, currentLocation.timezone);
          if (currentDateKey !== currentTimes.date) {
            void loadPrayerTimes(currentLocation);
          }
        }
      }

      const nowMs = now.getTime();
      if (Math.abs(nowMs - lastTick - CLOCK_REFRESH_INTERVAL) > CLOCK_DRIFT_THRESHOLD) {
        const locationForReload = activeLocationRef.current;
        if (locationForReload) {
          void loadPrayerTimes(locationForReload);
        }
      }
      lastTick = nowMs;
    };

    tick();
    const timer = window.setInterval(tick, CLOCK_REFRESH_INTERVAL);
    return () => window.clearInterval(timer);
  }, [loadPrayerTimes, twentyFourHourClock, updateNextPrayer]);

  const requestNotificationsPermission = useCallback(async (): Promise<boolean> => {
    if (!notificationsSupported || typeof Notification === 'undefined') {
      localStorage.setItem(NOTIFICATION_STORAGE_KEY, 'unsupported');
      setNotificationsEnabled(false);
      return false;
    }

    try {
      localStorage.setItem(NOTIFICATION_STORAGE_KEY, 'prompt');
      const permission = await Notification.requestPermission();

      if (permission === 'granted') {
        setNotificationsEnabled(true);
        localStorage.setItem(NOTIFICATION_STORAGE_KEY, 'granted');
        return true;
      }

      setNotificationsEnabled(false);
      localStorage.setItem(NOTIFICATION_STORAGE_KEY, permission);
      return false;
    } catch (error) {
      console.error('Failed to request notifications permission', error);
      setNotificationsEnabled(false);
      localStorage.setItem(NOTIFICATION_STORAGE_KEY, 'error');
      return false;
    }
  }, [notificationsSupported]);

  useEffect(() => {
    if (!locationHydrated || !activeLocation || !notificationsSupported || typeof Notification === 'undefined') {
      return;
    }

    const storedPreference = localStorage.getItem(NOTIFICATION_STORAGE_KEY);

    if (Notification.permission === 'granted') {
      setNotificationsEnabled(true);
      if (!storedPreference) {
        localStorage.setItem(NOTIFICATION_STORAGE_KEY, 'granted');
      }
      return;
    }

    if (storedPreference === 'granted' || storedPreference === 'prompt' || storedPreference === null) {
      setShowOnboarding(true);
    }
  }, [activeLocation, locationHydrated, notificationsSupported]);

  useEffect(() => {
    if (!settingsHydrated) {
      return;
    }

    const configure = window.electron?.configureNotifications;

    if (!configure) {
      return;
    }

    const tahajjudPayload = {
      enabled: notificationsEnabled && tahajjudSettings.enabled,
      method: tahajjudSettings.method,
      customTime: tahajjudSettings.customTime,
      leadMinutes: tahajjudSettings.leadMinutes,
      location: activeLocation,
      calculationMethod,
    };

    if (
      notificationsEnabled &&
      prayerTimes &&
      (!notificationsSupported || notificationPermission === 'granted')
    ) {
      configure(true, prayerTimes, notificationConfig, tahajjudPayload);
      return;
    }

    configure(false, undefined, notificationConfig, tahajjudPayload);
  }, [
    activeLocation,
    calculationMethod,
    notificationConfig,
    notificationPermission,
    notificationsEnabled,
    notificationsSupported,
    prayerTimes,
    tahajjudSettings,
    settingsHydrated,
  ]);

  useEffect(() => {
    const configure = window.electron?.configureNotifications;
    return () => {
      configure?.(false);
    };
  }, []);

  const updateNotificationConfig = useCallback(
    (
      updater:
        | NotificationScheduleConfig
        | ((previous: NotificationScheduleConfig) => NotificationScheduleConfig)
    ) => {
      setNotificationConfig((previous) => {
        const next = typeof updater === 'function' ? updater(previous) : updater;
        return normalizeNotificationConfig(next);
      });
    },
    []
  );

  const handleNotificationToggle = useCallback(
    async (enabled: boolean) => {
      if (enabled) {
        await requestNotificationsPermission();
        return;
      }

      localStorage.setItem(NOTIFICATION_STORAGE_KEY, 'denied');
      setNotificationsEnabled(false);
    },
    [requestNotificationsPermission]
  );

  const handlePrayerToggle = useCallback((prayerName: NotifiablePrayerName) => {
    return (event: React.ChangeEvent<HTMLInputElement>) => {
      const { checked } = event.target;
      updateNotificationConfig((previous) => ({
        ...previous,
        enabledPrayers: {
          ...previous.enabledPrayers,
          [prayerName]: checked,
        },
      }));
    };
  }, [updateNotificationConfig]);

  const handleLeadMinutesChange = useCallback(
    (key: 'minutesBefore' | 'minutesAfter') => (event: React.ChangeEvent<HTMLInputElement>) => {
      const parsed = Number(event.target.value);
      updateNotificationConfig((previous) => ({
        ...previous,
        [key]: Number.isFinite(parsed) ? parsed : 0,
      }));
    },
    [updateNotificationConfig]
  );

  const handleReminderVariantToggle = useCallback(
    (key: 'sendAtPrayerTime' | 'sendBefore' | 'sendAfter') =>
      (event: React.ChangeEvent<HTMLInputElement>) => {
        const { checked } = event.target;
        updateNotificationConfig((previous) => {
          const next = { ...previous, [key]: checked };

          if (key === 'sendBefore' && checked && previous.minutesBefore === 0) {
            next.minutesBefore = DEFAULT_NOTIFICATION_CONFIG.minutesBefore;
          }

          if (key === 'sendAfter' && checked && previous.minutesAfter === 0) {
            next.minutesAfter = DEFAULT_NOTIFICATION_CONFIG.minutesAfter;
          }

          return next;
        });
      },
    [updateNotificationConfig]
  );

  const handleCalculationMethodChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setCalculationMethod(event.target.value);
  };

  const handleTwentyFourHourClockChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setTwentyFourHourClock(event.target.checked);
  };

  const handleLocationSelectionChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setPendingLocationId(event.target.value);
  };

  const handleSettingsLocationChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextId = event.target.value;
    const nextOption = LOCATION_OPTIONS.find((option) => option.id === nextId);

    if (!nextOption) {
      return;
    }

    setPendingLocationId(nextId);
    setLocationPresetId(nextOption.id);
    setActiveLocation(nextOption.location);
    persistLocation(nextOption.location, nextOption.id);
    setShowLocationOnboarding(false);
    setLoading(true);
  };

  const handleOpenLocationPicker = useCallback(() => {
    const matchedPreset = locationPresetId ?? findPresetIdForLocation(activeLocationRef.current);
    setPendingLocationId(matchedPreset ?? DEFAULT_LOCATION_OPTION.id);
    setShowLocationOnboarding(true);
    setShowOnboarding(false);
    setSettingsOpen(false);
  }, [locationPresetId]);

  const handleConfirmLocation = () => {
    const nextOption = selectedLocationOption;
    setLocationPresetId(nextOption.id);
    setActiveLocation(nextOption.location);
    persistLocation(nextOption.location, nextOption.id);
    setShowLocationOnboarding(false);
    setShowOnboarding(false);
    setLoading(true);
  };

  const handleEnableNotifications = useCallback(async () => {
    await requestNotificationsPermission();
    setShowOnboarding(false);
  }, [requestNotificationsPermission]);

  const handleSkipNotifications = () => {
    localStorage.setItem(NOTIFICATION_STORAGE_KEY, 'denied');
    setNotificationsEnabled(false);
    setShowOnboarding(false);
  };

  const handleManageNotifications = () => {
    if (!activeLocation) {
      handleOpenLocationPicker();
      return;
    }

    if (!notificationsEnabled) {
      setShowOnboarding(true);
      return;
    }

    setSettingsOpen(true);
    setShowOnboarding(false);
  };

  const handlePrayerCheckResponse = useCallback(async (id: string, response: PrayerCheckResponse) => {
    try {
      const nextState = await window.electron?.respondToPrayerCheck?.(id, response);
      if (nextState) {
        setPrayerCheckState(nextState);
      }
    } catch (error) {
      console.error('Failed to record prayer check response.', error);
    }
  }, []);

  const handleTahajjudToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { checked } = event.target;
    setTahajjudSettings((previous) => ({
      ...previous,
      enabled: checked,
    }));
  };

  const handleTahajjudMethodChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextMethod = event.target.value as TahajjudReminderMethod;
    setTahajjudSettings((previous) => ({
      ...previous,
      method: nextMethod,
    }));
  };

  const handleTahajjudTimeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextTime = event.target.value;
    setTahajjudSettings((previous) => ({
      ...previous,
      customTime: nextTime || DEFAULT_TAHAJJUD_CUSTOM_TIME,
    }));
  };

  const handleTahajjudLeadMinutesChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const parsed = Number(event.target.value);
    setTahajjudSettings((previous) => ({
      ...previous,
      leadMinutes: clampTahajjudLeadMinutes(Number.isFinite(parsed) ? parsed : 0),
    }));
  };

  const sunrisePrayer = prayerTimes?.prayers.find((prayer) => prayer.name === 'Sunrise') ?? null;
  const tahajjudSectionDisabled = !activeLocation;
  const locationSummary = activeLocation ? `${activeLocation.city}, ${activeLocation.country}` : 'Choose location';
  const locationDetail = activeLocation?.timezone ?? null;
  const missedPrayerSummaryText =
    missedPrayerBreakdown.length > 0 ? missedPrayerBreakdown.join(' • ') : 'No missed prayers';

  const getPrayerDescription = (name: string) => {
    switch (name) {
      case 'Fajr': return 'Dawn time in your area';
      case 'Dhuhr': return 'Noon time in your area';
      case 'Asr': return 'Afternoon time in your area';
      case 'Maghrib': return 'Sunset time in your area';
      case 'Isha': return 'Night time in your area';
      default: return 'Prayer time in your area';
    }
  };

  const getPrayerIcon = (name: string, isActive: boolean) => {
    const color = isActive ? '#007AFF' : '#8E8E93';
    switch (name) {
      case 'Fajr':
        return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v2M4.93 4.93l1.41 1.41M2 12h2M4.93 19.07l1.41-1.41M12 22v-2M17.66 19.07l-1.41-1.41M22 12h-2M17.66 4.93l-1.41 1.41"></path></svg>;
      case 'Dhuhr':
        return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>;
      case 'Asr':
        return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>;
      case 'Maghrib':
        return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path></svg>;
      case 'Isha':
        return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path></svg>;
      default:
        return null;
    }
  };

  const countdownText = useMemo(() => {
    if (!timeUntilNext) return '--:--';
    if (timeUntilNext === 'Now') return '00:00';
    if (timeUntilNext.includes('h')) return timeUntilNext;
    return `00:${timeUntilNext.replace('m', '').padStart(2, '0')}`;
  }, [timeUntilNext]);

  return (
    <div className="app">
      {showLocationOnboarding && (
        <div className="location-overlay">
          <div className="location-panel" role="dialog" aria-modal="true" aria-labelledby="location-title">
            <div className="location-header">
              <h3 id="location-title">Choose your location</h3>
              <p>Select where you pray so we can calculate accurate times.</p>
            </div>
            <div className="location-options">
              {LOCATION_OPTIONS.map((option) => (
                <label
                  key={option.id}
                  className={`location-card${pendingLocationId === option.id ? ' selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="location-option"
                    value={option.id}
                    checked={pendingLocationId === option.id}
                    onChange={handleLocationSelectionChange}
                  />
                  <span className="location-name">{option.label}</span>
                  <span className="location-meta">{option.description}</span>
                </label>
              ))}
            </div>
            <div className="location-actions">
              <button className="location-action primary" onClick={handleConfirmLocation}>
                Continue
              </button>
            </div>
            <p className="location-footer-note">You can change this later from Settings.</p>
          </div>
        </div>
      )}

      {showOnboarding && (
        <div className="notification-onboarding">
          <div className="notification-dialog">
            <h3>Prayer reminders</h3>
            <p>
              Stay on schedule with desktop reminders for each prayer time and tahajjud.
              Would you like to enable notifications?
            </p>
            <div className="notification-actions">
              <button className="primary" onClick={handleEnableNotifications}>
                Enable Notifications
              </button>
              <button className="secondary" onClick={handleSkipNotifications}>
                Maybe Later
              </button>
            </div>
          </div>
        </div>
      )}

      {settingsOpen && (
        <div className="settings-overlay">
          <div className="settings-panel" role="dialog" aria-modal="true" aria-labelledby="settings-title">
            <div className="settings-header">
              <div>
                <h3 id="settings-title">Prayer settings</h3>
                <p>Align the desktop experience with the mobile prayer preferences.</p>
              </div>
              <button
                className="settings-close"
                onClick={() => {
                  setSettingsOpen(false);
                }}
                aria-label="Close settings"
              >
                Close
              </button>
            </div>

            <div className="settings-body">
              <section className="settings-section">
                <div className="settings-row">
                  <div>
                    <span className="settings-label">Location</span>
                    <p className="settings-description">Prayer times follow the city and timezone you select.</p>
                  </div>
                  <div className="settings-field settings-select-field">
                    <select
                      className="settings-select"
                      value={settingsLocationId}
                      onChange={handleSettingsLocationChange}
                      aria-label="Location"
                    >
                      {LOCATION_OPTIONS.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <p className="settings-note">
                  {activeLocation
                    ? `${activeLocation.city}, ${activeLocation.country} • ${activeLocation.timezone}`
                    : 'Select a location to calculate prayer times.'}
                </p>
              </section>

              <section className="settings-section">
                <div className="settings-row">
                  <div>
                    <span className="settings-label">Calculation method</span>
                    <p className="settings-description">Choose how prayer times are calculated on desktop.</p>
                  </div>
                  <div className="settings-field settings-select-field">
                    <select
                      className="settings-select"
                      value={calculationMethod}
                      onChange={handleCalculationMethodChange}
                      aria-label="Calculation method"
                    >
                      {CALCULATION_METHOD_OPTIONS.map((option) => (
                        <option key={option.key} value={option.key}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <p className="settings-note">
                  Diyanet is now available on desktop and the selected method updates the schedule immediately.
                </p>
              </section>

              <section className="settings-section">
                <div className="settings-row">
                  <div>
                    <span className="settings-label">24-hour clock</span>
                    <p className="settings-description">Match the desktop time display with your mobile preference.</p>
                  </div>
                  <label className="settings-toggle" htmlFor="settings-twenty-four-hour">
                    <input
                      id="settings-twenty-four-hour"
                      type="checkbox"
                      checked={twentyFourHourClock}
                      onChange={handleTwentyFourHourClockChange}
                    />
                    <span>{twentyFourHourClock ? '24h' : '12h'}</span>
                  </label>
                </div>
              </section>

              <section className="settings-section">
                <div className="settings-row">
                  <div>
                    <span className="settings-label">Prayer reminders</span>
                    <p className="settings-description">Enable desktop notifications for daily prayer moments.</p>
                  </div>
                  <label className="settings-toggle" htmlFor="settings-notifications-toggle">
                    <input
                      id="settings-notifications-toggle"
                      type="checkbox"
                      checked={notificationsEnabled}
                      onChange={(event) => {
                        void handleNotificationToggle(event.target.checked);
                      }}
                    />
                    <span>{notificationsEnabled ? 'Enabled' : 'Disabled'}</span>
                  </label>
                </div>
                {notificationPermission === 'denied' && (
                  <p className="settings-note warning">
                    Notifications are blocked. Re-enable them from system preferences to receive reminders.
                  </p>
                )}
                {notificationPermission === 'unsupported' && (
                  <p className="settings-note warning">Notifications are not supported on this device.</p>
                )}

                <div className={`settings-subsection${!notificationsEnabled ? ' disabled' : ''}`}>
                  <div className="settings-row">
                    <div>
                      <span className="settings-label">At prayer time</span>
                      <p className="settings-description">Send a reminder right when the prayer begins.</p>
                    </div>
                    <label className="settings-toggle" htmlFor="settings-send-at-time">
                      <input
                        id="settings-send-at-time"
                        type="checkbox"
                        checked={notificationConfig.sendAtPrayerTime}
                        onChange={handleReminderVariantToggle('sendAtPrayerTime')}
                        disabled={!notificationsEnabled}
                      />
                      <span>{notificationConfig.sendAtPrayerTime ? 'On' : 'Off'}</span>
                    </label>
                  </div>

                  <div className="settings-row">
                    <div>
                      <span className="settings-label">Before prayer</span>
                      <p className="settings-description">Get a reminder ahead of time.</p>
                    </div>
                    <label className="settings-toggle" htmlFor="settings-send-before">
                      <input
                        id="settings-send-before"
                        type="checkbox"
                        checked={notificationConfig.sendBefore}
                        onChange={handleReminderVariantToggle('sendBefore')}
                        disabled={!notificationsEnabled}
                      />
                      <span>{notificationConfig.sendBefore ? 'On' : 'Off'}</span>
                    </label>
                  </div>
                  {notificationConfig.sendBefore && (
                    <div className="settings-row settings-row-inline">
                      <label className="settings-field-label" htmlFor="settings-minutes-before">
                        Minutes before
                      </label>
                      <div className="settings-field">
                        <input
                          id="settings-minutes-before"
                          type="number"
                          min={0}
                          max={MAX_NOTIFICATION_OFFSET_MINUTES}
                          step={1}
                          value={notificationConfig.minutesBefore}
                          onChange={handleLeadMinutesChange('minutesBefore')}
                          disabled={!notificationsEnabled}
                        />
                        <span className="settings-field-unit">min</span>
                      </div>
                    </div>
                  )}

                  <div className="settings-row">
                    <div>
                      <span className="settings-label">Prayer check-in</span>
                      <p className="settings-description">Ask whether you prayed after each prayer begins.</p>
                    </div>
                    <label className="settings-toggle" htmlFor="settings-send-after">
                      <input
                        id="settings-send-after"
                        type="checkbox"
                        checked={notificationConfig.sendAfter}
                        onChange={handleReminderVariantToggle('sendAfter')}
                        disabled={!notificationsEnabled}
                      />
                      <span>{notificationConfig.sendAfter ? 'On' : 'Off'}</span>
                    </label>
                  </div>
                  {notificationConfig.sendAfter && (
                    <div className="settings-row settings-row-inline">
                      <label className="settings-field-label" htmlFor="settings-minutes-after">
                        Minutes after start
                      </label>
                      <div className="settings-field">
                        <input
                          id="settings-minutes-after"
                          type="number"
                          min={0}
                          max={MAX_NOTIFICATION_OFFSET_MINUTES}
                          step={1}
                          value={notificationConfig.minutesAfter}
                          onChange={handleLeadMinutesChange('minutesAfter')}
                          disabled={!notificationsEnabled}
                        />
                        <span className="settings-field-unit">min</span>
                      </div>
                    </div>
                  )}
                  {notificationConfig.sendAfter && (
                    <p className="settings-note">
                      Desktop notifications show quick `Yes` and `No` actions, and `No` adds that prayer to the missed
                      count on the dashboard.
                    </p>
                  )}
                </div>
              </section>

              <section className="settings-section">
                <span className="settings-label">Prayer selection</span>
                <p className="settings-description">Choose which prayers should trigger desktop reminders.</p>
                <div className={`settings-prayer-grid${!notificationsEnabled ? ' disabled' : ''}`}>
                  {notificationPrayers.map((prayer) => {
                    const isEnabled = notificationConfig.enabledPrayers[prayer.name as NotifiablePrayerName];
                    return (
                      <label
                        key={prayer.name}
                        className={`settings-prayer${!notificationsEnabled ? ' disabled' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={Boolean(isEnabled)}
                          onChange={handlePrayerToggle(prayer.name as NotifiablePrayerName)}
                          disabled={!notificationsEnabled}
                        />
                        <span>{prayer.name}</span>
                      </label>
                    );
                  })}
                </div>
              </section>

              <section className="settings-section">
                <div className="settings-row">
                  <div>
                    <span className="settings-label">Tahajjud reminder</span>
                    <p className="settings-description">
                      Keep the desktop app aligned with the mobile tahajjud setup.
                    </p>
                  </div>
                  <label className="settings-toggle" htmlFor="settings-tahajjud-toggle">
                    <input
                      id="settings-tahajjud-toggle"
                      type="checkbox"
                      checked={tahajjudSettings.enabled}
                      onChange={handleTahajjudToggle}
                      disabled={tahajjudSectionDisabled}
                    />
                    <span>{tahajjudSettings.enabled ? 'Enabled' : 'Disabled'}</span>
                  </label>
                </div>

                <div className={`settings-subsection${tahajjudSectionDisabled ? ' disabled' : ''}`}>
                  <div className="settings-row">
                    <div>
                      <span className="settings-label">Reminder method</span>
                      <p className="settings-description">
                        Switch between a fixed time and the night-based automatic modes.
                      </p>
                    </div>
                    <div className="settings-field settings-select-field">
                      <select
                        className="settings-select"
                        value={tahajjudSettings.method}
                        onChange={handleTahajjudMethodChange}
                        disabled={tahajjudSectionDisabled}
                        aria-label="Tahajjud reminder method"
                      >
                        {TAHAJJUD_METHOD_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <p className="settings-note">
                    {TAHAJJUD_METHOD_OPTIONS.find((option) => option.value === tahajjudSettings.method)?.description}
                  </p>

                  {tahajjudSettings.method === 'custom' && (
                    <div className="settings-row settings-row-inline">
                      <label className="settings-field-label" htmlFor="settings-tahajjud-time">
                        Reminder time
                      </label>
                      <div className="settings-field">
                        <input
                          id="settings-tahajjud-time"
                          type="time"
                          value={tahajjudSettings.customTime}
                          onChange={handleTahajjudTimeChange}
                          disabled={tahajjudSectionDisabled}
                        />
                      </div>
                    </div>
                  )}

                  <div className="settings-row settings-row-inline">
                    <label className="settings-field-label" htmlFor="settings-tahajjud-lead">
                      Minutes before
                    </label>
                    <div className="settings-field">
                      <input
                        id="settings-tahajjud-lead"
                        type="number"
                        min={0}
                        max={MAX_TAHAJJUD_LEAD_MINUTES}
                        step={1}
                        value={tahajjudSettings.leadMinutes}
                        onChange={handleTahajjudLeadMinutesChange}
                        disabled={tahajjudSectionDisabled}
                      />
                      <span className="settings-field-unit">min</span>
                    </div>
                  </div>
                </div>

                <p className="settings-note">
                  {activeLocation
                    ? `Preview: ${formatDisplayTime(
                        tahajjudPreview.time,
                        twentyFourHourClock
                      )} • ${tahajjudMethodLabel}${
                        tahajjudSettings.leadMinutes > 0
                          ? ` • ${tahajjudSettings.leadMinutes} min before`
                          : ' • at reminder time'
                      }`
                    : 'Choose a location first to preview the tahajjud reminder.'}
                </p>
                {!notificationsEnabled && tahajjudSettings.enabled && (
                  <p className="settings-note warning">
                    Tahajjud is saved, but it will only notify after desktop reminders are enabled.
                  </p>
                )}
              </section>
            </div>

            <div className="settings-actions">
              <button
                className="settings-action primary"
                onClick={() => {
                  setSettingsOpen(false);
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="shell">
        <header className="topbar">
          <div className="brand">
            <div className="brand-mark">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 21h18"></path>
                <path d="M7 21v-4"></path>
                <path d="M17 21v-4"></path>
                <path d="M10 21V10l2-2 2 2v11"></path>
                <path d="M12 4V2"></path>
              </svg>
            </div>
            <div className="brand-copy">
              <h1>Prayer Manager</h1>
              <p>{locationDetail ? `${locationSummary} • ${locationDetail}` : locationSummary}</p>
            </div>
          </div>
          <div className="top-buttons">
            <button
              className="status-pill ghost settings-button"
              onClick={() => {
                setSettingsOpen(true);
                setShowOnboarding(false);
              }}
            >
              Settings
            </button>
          </div>
        </header>

        <main className="content">
          {loading ? (
            <div className="state-card">Loading prayer times...</div>
          ) : prayerTimes ? (
            <div className="dashboard-grid">
              <div className="main-column">
                <section className="greeting-section">
                  <div className="current-date">{currentDateDisplay}</div>
                  <h1>As-salaam Alaikum</h1>
                </section>

                {nextPrayer && (
                  <section className="next-prayer-large-card">
                    <div className="next-prayer-header">
                      <div className="next-prayer-info">
                        <span className="label">NEXT PRAYER</span>
                        <h2 className="prayer-name">{nextPrayer.name}</h2>
                        <span className="prayer-desc">{getPrayerDescription(nextPrayer.name)}</span>
                      </div>
                      <div className="countdown-pill">
                        <span className="time">{countdownText}</span>
                        <span className="unit">min left</span>
                      </div>
                    </div>
                    <button className="reminder-btn" onClick={handleManageNotifications}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
                      Set Reminder
                    </button>
                  </section>
                )}

                {pendingPrayerCheck && (
                  <div className="checkin-card">
                    <div className="checkin-card-content">
                      <span className="checkin-label">Prayer check-in</span>
                      <strong className="checkin-title">Did you pray {pendingPrayerCheck.prayerName}?</strong>
                      <p className="checkin-text">
                        Started at {formatDisplayTime(pendingPrayerCheck.prayerTime, twentyFourHourClock)}
                      </p>
                    </div>
                    <div className="checkin-actions">
                      <button className="settings-secondary-button" onClick={() => void handlePrayerCheckResponse(pendingPrayerCheck.id, 'yes')}>Yes</button>
                      <button className="settings-secondary-button danger" onClick={() => void handlePrayerCheckResponse(pendingPrayerCheck.id, 'no')}>No</button>
                    </div>
                  </div>
                )}
              </div>

              <div className="side-column">
                <section className="schedule-section">
                  <h3>Daily Schedule</h3>
                  <div className="schedule-list">
                    {visiblePrayers.map((prayer) => {
                      const isNext = nextPrayer?.name === prayer.name;
                      const itemClass = `schedule-item${isNext ? ' active' : ''}`;
                      return (
                        <div key={prayer.name} className={itemClass}>
                          <div className="prayer-info">
                            <span className="prayer-icon">{getPrayerIcon(prayer.name, isNext)}</span>
                            <span className="prayer-name">{prayer.name}</span>
                          </div>
                          <span className="prayer-time">{formatDisplayTime(prayer.time, twentyFourHourClock)}</span>
                        </div>
                      );
                    })}
                  </div>
                </section>
              </div>
            </div>
          ) : (
            <div className={`state-card${activeLocation ? ' error' : ''}`}>
              {activeLocation ? 'Failed to load prayer times' : 'Select a location to begin'}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;

