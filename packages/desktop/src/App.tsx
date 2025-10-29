import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DailyPrayerTimes,
  Location,
  PrayerTime,
  PrayerTimeCalculator,
} from '@prayer-time/shared';
import './App.css';

type PrayerName = PrayerTime['name'];

interface NotificationPreferencesPayload {
  leadMinutes: number;
  enabledPrayers?: PrayerName[];
}

interface NotificationPreferencesState {
  leadMinutes: number;
  perPrayer: Partial<Record<PrayerName, boolean>>;
}

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
  on: (channel: string, func: (...args: any[]) => void) => () => void;
  send?: (channel: string, args?: any) => void;
  invoke?: (channel: string, args?: any) => Promise<any>;
}

interface ElectronAPI {
  calculatePrayerTimes: (date: string, location: Location, method: string) => Promise<DailyPrayerTimes>;
  ipcRenderer?: ElectronIPC;
  configureNotifications?: (
    enabled: boolean,
    times?: DailyPrayerTimes | null,
    preferences?: NotificationPreferencesPayload
  ) => void;
}

declare global {
  interface Window {
    electron?: ElectronAPI;
  }
}

const NOTIFICATION_STORAGE_KEY = 'prayer-time-notifications';
const DEFAULT_CALCULATION_METHOD = 'Muslim World League';
const NOTIFICATION_SETTINGS_STORAGE_KEY = 'prayer-time-notification-preferences';
const LOCATION_STORAGE_KEY = 'prayer-time-location';
const MAX_NOTIFICATION_LEAD_MINUTES = 120;
const DEFAULT_NOTIFICATION_LEAD_MINUTES = 10;
const ALL_PRAYER_NAMES: PrayerName[] = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Sunset', 'Maghrib', 'Isha'];
const HIDDEN_PRAYER_NAMES: ReadonlySet<PrayerName> = new Set(['Sunset']);
const CLOCK_REFRESH_INTERVAL = 1000;
const CLOCK_DRIFT_THRESHOLD = 30000;

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

const DEFAULT_LOCATION_OPTION = LOCATION_OPTIONS[0];

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

const createDefaultNotificationPreferences = (): NotificationPreferencesState => ({
  leadMinutes: DEFAULT_NOTIFICATION_LEAD_MINUTES,
  perPrayer: {},
});

const clampLeadMinutes = (value: number): number =>
  Math.min(MAX_NOTIFICATION_LEAD_MINUTES, Math.max(0, Math.round(value)));

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

function App() {
  const [prayerTimes, setPrayerTimes] = useState<DailyPrayerTimes | null>(null);
  const [loading, setLoading] = useState(true);
  const [nextPrayer, setNextPrayer] = useState<PrayerTime | null>(null);
  const [previousPrayer, setPreviousPrayer] = useState<PrayerTime | null>(null);
  const [nextPrayerProgress, setNextPrayerProgress] = useState<number>(0);
  const [timeUntilNext, setTimeUntilNext] = useState<string>('');
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(false);
  const [showOnboarding, setShowOnboarding] = useState<boolean>(false);
  const [showLocationOnboarding, setShowLocationOnboarding] = useState<boolean>(false);
  const [activeLocation, setActiveLocation] = useState<Location | null>(null);
  const [locationHydrated, setLocationHydrated] = useState<boolean>(false);
  const [pendingLocationId, setPendingLocationId] = useState<string>(DEFAULT_LOCATION_OPTION.id);
  const [locationPresetId, setLocationPresetId] = useState<string | null>(null);
  const [currentTimeDisplay, setCurrentTimeDisplay] = useState<string>('');
  const [currentDateDisplay, setCurrentDateDisplay] = useState<string>('');
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferencesState>(
    () => createDefaultNotificationPreferences()
  );
  const [preferencesHydrated, setPreferencesHydrated] = useState<boolean>(false);

  const notificationsSupported = typeof window !== 'undefined' && 'Notification' in window;
  const notificationPermission = notificationsSupported ? Notification.permission : 'unsupported';

  const enabledPrayerNames = useMemo<PrayerName[]>(() => {
    return Object.entries(notificationPreferences.perPrayer)
      .filter(([name, enabled]) => Boolean(enabled) && !HIDDEN_PRAYER_NAMES.has(name as PrayerName))
      .map(([name]) => name as PrayerName);
  }, [notificationPreferences.perPrayer]);

  const visiblePrayers = useMemo<PrayerTime[]>(() => {
    if (!prayerTimes) {
      return [];
    }
    return prayerTimes.prayers.filter((prayer) => !HIDDEN_PRAYER_NAMES.has(prayer.name));
  }, [prayerTimes]);

  const selectedLocationOption = useMemo<LocationOption>(() => {
    return LOCATION_OPTIONS.find((option) => option.id === pendingLocationId) ?? DEFAULT_LOCATION_OPTION;
  }, [pendingLocationId]);

  const prayerTimesRef = useRef<DailyPrayerTimes | null>(null);
  const activeLocationRef = useRef<Location | null>(null);

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
        setShowOnboarding(false);
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
        setShowOnboarding(false);
        setSettingsOpen(false);
      }
    } catch (error) {
      console.error('Failed to load stored location', error);
      setLoading(false);
      setPendingLocationId(DEFAULT_LOCATION_OPTION.id);
      setShowLocationOnboarding(true);
      setShowOnboarding(false);
      setSettingsOpen(false);
    } finally {
      setLocationHydrated(true);
    }
  }, []);

  const openSettings = useCallback(() => {
    setSettingsOpen(true);
    setShowOnboarding(false);
  }, []);

  const requestNotificationsPermission = useCallback(async (): Promise<boolean> => {
    if (!notificationsSupported) {
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

  const handleSettingsToggleNotifications = useCallback(
    async (enabled: boolean) => {
      if (enabled) {
        const granted = await requestNotificationsPermission();
        if (!granted) {
          return;
        }
      } else {
        localStorage.setItem(NOTIFICATION_STORAGE_KEY, 'denied');
        setNotificationsEnabled(false);
      }
    },
    [requestNotificationsPermission]
  );

  const handleLeadMinutesChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(event.target.value);
    if (Number.isNaN(value)) {
      return;
    }

    setNotificationPreferences((prev) => ({
      ...prev,
      leadMinutes: clampLeadMinutes(value),
    }));
  };

  const handlePrayerToggle = (name: PrayerName) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const { checked } = event.target;
    setNotificationPreferences((prev) => ({
      ...prev,
      perPrayer: {
        ...prev.perPrayer,
        [name]: checked,
      },
    }));
  };

  const handleCloseSettings = () => {
    setSettingsOpen(false);
  };

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

  const handleOpenLocationPicker = useCallback(() => {
    const matchedPreset = locationPresetId ?? findPresetIdForLocation(activeLocationRef.current);
    setPendingLocationId(matchedPreset ?? DEFAULT_LOCATION_OPTION.id);
    setShowLocationOnboarding(true);
    setShowOnboarding(false);
    setSettingsOpen(false);
  }, [locationPresetId]);

  const handleLocationSelectionChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setPendingLocationId(event.target.value);
  };

  const handleConfirmLocation = () => {
    const nextOption = selectedLocationOption;
    setLocationPresetId(nextOption.id);
    setActiveLocation(nextOption.location);
    persistLocation(nextOption.location, nextOption.id);
    setShowLocationOnboarding(false);
    setShowOnboarding(false);
    setLoading(true);
  };

  useEffect(() => {
    if (!locationHydrated || !activeLocation) {
      return;
    }

    const matchedPreset = locationPresetId ?? findPresetIdForLocation(activeLocation);
    persistLocation(activeLocation, matchedPreset);
  }, [activeLocation, locationHydrated, locationPresetId, persistLocation]);

  const updateNextPrayer = useCallback(
    (times: DailyPrayerTimes) => {
      const visiblePrayers = times.prayers.filter((prayer) => !HIDDEN_PRAYER_NAMES.has(prayer.name));

      if (!visiblePrayers.length) {
        setNextPrayer(null);
        setPreviousPrayer(null);
        setTimeUntilNext('');
        setNextPrayerProgress(0);
        return;
      }

      const reference = new Date();
      const upcoming = PrayerTimeCalculator.getNextPrayerTime(visiblePrayers, reference) ?? null;
      setNextPrayer(upcoming);

      if (upcoming) {
        const remaining = PrayerTimeCalculator.getTimeUntilPrayer(upcoming, reference);
        setTimeUntilNext(formatTimeRemaining(remaining));

        const now = reference;
        const nextOccurrence = PrayerTimeCalculator.getUpcomingOccurrence(upcoming, now);

        let previousContext: { prayer: PrayerTime; occurrence: Date } | null = null;

        visiblePrayers.forEach((prayer) => {
          const occurrence = PrayerTimeCalculator.getOccurrenceForDate(prayer, now);
          if (occurrence.getTime() <= now.getTime()) {
            previousContext = { prayer, occurrence };
          }
        });

        if (!previousContext && visiblePrayers.length) {
          const lastPrayer = visiblePrayers[visiblePrayers.length - 1];
          const occurrence = PrayerTimeCalculator.getOccurrenceForDate(lastPrayer, now);
          if (occurrence.getTime() >= nextOccurrence.getTime()) {
            occurrence.setDate(occurrence.getDate() - 1);
          }
          previousContext = { prayer: lastPrayer, occurrence };
        }

        if (previousContext && previousContext.occurrence.getTime() >= nextOccurrence.getTime()) {
          previousContext.occurrence.setDate(previousContext.occurrence.getDate() - 1);
        }

        setPreviousPrayer(previousContext?.prayer ?? null);

        if (previousContext) {
          const totalWindow = nextOccurrence.getTime() - previousContext.occurrence.getTime();
          const elapsedWindow = now.getTime() - previousContext.occurrence.getTime();

          if (totalWindow > 0) {
            const progress = Math.min(100, Math.max(0, (elapsedWindow / totalWindow) * 100));
            setNextPrayerProgress(progress);
          } else {
            setNextPrayerProgress(0);
          }
        } else {
          setNextPrayerProgress(0);
        }
      } else {
        setTimeUntilNext('');
        setPreviousPrayer(null);
        setNextPrayerProgress(0);
      }
    },
    []
  );

  const loadPrayerTimes = useCallback(
    async (targetLocation: Location) => {
      try {
        setLoading(true);

        const now = new Date();
        let times: DailyPrayerTimes;

        if (window.electron?.calculatePrayerTimes) {
          times = await window.electron.calculatePrayerTimes(
            now.toISOString(),
            targetLocation,
            DEFAULT_CALCULATION_METHOD
          );
        } else {
          times = PrayerTimeCalculator.calculatePrayerTimes(now, targetLocation, DEFAULT_CALCULATION_METHOD);
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
    [updateNextPrayer]
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
  }, [activeLocation, locationHydrated, loadPrayerTimes]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const stored = localStorage.getItem(NOTIFICATION_SETTINGS_STORAGE_KEY);

    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        const rawLead = Number(parsed?.leadMinutes);
        const nextLead = Number.isFinite(rawLead) ? clampLeadMinutes(rawLead) : DEFAULT_NOTIFICATION_LEAD_MINUTES;
        const sanitizedPerPrayer: Partial<Record<PrayerName, boolean>> = {};

        if (parsed?.perPrayer && typeof parsed.perPrayer === 'object') {
          Object.entries(parsed.perPrayer as Record<string, boolean>).forEach(([name, value]) => {
            if (
              ALL_PRAYER_NAMES.includes(name as PrayerName) &&
              !HIDDEN_PRAYER_NAMES.has(name as PrayerName) &&
              typeof value === 'boolean'
            ) {
              sanitizedPerPrayer[name as PrayerName] = value;
            }
          });
        }

        setNotificationPreferences({
          leadMinutes: nextLead,
          perPrayer: sanitizedPerPrayer,
        });
      } catch (error) {
        console.error('Failed to load notification preferences', error);
      }
    }

    setPreferencesHydrated(true);
  }, []);

  useEffect(() => {
    if (!preferencesHydrated || typeof window === 'undefined') {
      return;
    }
    localStorage.setItem(NOTIFICATION_SETTINGS_STORAGE_KEY, JSON.stringify(notificationPreferences));
  }, [notificationPreferences, preferencesHydrated]);

  useEffect(() => {
    if (!prayerTimes) {
      return;
    }

    setNotificationPreferences((prev) => {
      const perPrayer = { ...prev.perPrayer };
      let changed = false;

      prayerTimes.prayers.forEach((prayer) => {
        if (HIDDEN_PRAYER_NAMES.has(prayer.name)) {
          if (typeof perPrayer[prayer.name] !== 'undefined') {
            delete perPrayer[prayer.name];
            changed = true;
          }
          return;
        }

        if (typeof perPrayer[prayer.name] === 'undefined') {
          perPrayer[prayer.name] = true;
          changed = true;
        }
      });

      Object.keys(perPrayer).forEach((name) => {
        if (HIDDEN_PRAYER_NAMES.has(name as PrayerName)) {
          delete perPrayer[name as PrayerName];
          changed = true;
          return;
        }

        if (!prayerTimes.prayers.some((prayer) => prayer.name === name)) {
          delete perPrayer[name as PrayerName];
          changed = true;
        }
      });

      if (!changed) {
        return prev;
      }

      return {
        ...prev,
        perPrayer,
      };
    });
  }, [prayerTimes]);

  useEffect(() => {
    const removeListener = window.electron?.ipcRenderer?.on('notifications:open', () => {
      openSettings();
    });

    return () => {
      removeListener?.();
    };
  }, [openSettings]);

  useEffect(() => {
    let lastTick = Date.now();

    const tick = () => {
      const now = new Date();
      setCurrentTimeDisplay(
        new Intl.DateTimeFormat(undefined, {
          hour: '2-digit',
          minute: '2-digit',
        }).format(now)
      );
      setCurrentDateDisplay(
        new Intl.DateTimeFormat(undefined, {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
        }).format(now)
      );

      const currentTimes = prayerTimesRef.current;
      if (currentTimes) {
        updateNextPrayer(currentTimes);
      }

      const nowMs = now.getTime();
      if (Math.abs(nowMs - lastTick - CLOCK_REFRESH_INTERVAL) > CLOCK_DRIFT_THRESHOLD) {
        const locationForReload = activeLocationRef.current;
        if (locationForReload) {
          loadPrayerTimes(locationForReload);
        }
      }
      lastTick = nowMs;
    };

    tick();
    const timer = setInterval(tick, CLOCK_REFRESH_INTERVAL);
    return () => clearInterval(timer);
  }, [loadPrayerTimes, updateNextPrayer]);

  useEffect(() => {
    if (!locationHydrated || !activeLocation) {
      return;
    }

    if (!('Notification' in window)) {
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

    if (storedPreference === 'granted') {
      setShowOnboarding(true);
    } else if (storedPreference === 'prompt' || storedPreference === null) {
      setShowOnboarding(true);
    }
  }, [activeLocation, locationHydrated]);

  useEffect(() => {
    if (!preferencesHydrated) {
      return;
    }

    const configure = window.electron?.configureNotifications;

    if (!configure) {
      return;
    }

    const preferencesPayload: NotificationPreferencesPayload = {
      leadMinutes: notificationPreferences.leadMinutes,
    };

  const totalPrayers = visiblePrayers.length;
    if (totalPrayers > 0) {
      preferencesPayload.enabledPrayers = [...enabledPrayerNames];
    }

    if (
      notificationsEnabled &&
      prayerTimes &&
      (!notificationsSupported || notificationPermission === 'granted')
    ) {
      configure(true, prayerTimes, preferencesPayload);
    } else {
      configure(false);
    }
  }, [
    enabledPrayerNames,
    notificationPermission,
    notificationPreferences.leadMinutes,
    preferencesHydrated,
    notificationsEnabled,
    notificationsSupported,
    prayerTimes,
    visiblePrayers,
  ]);

  useEffect(() => {
    const configure = window.electron?.configureNotifications;
    return () => {
      configure?.(false);
    };
  }, []);

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
    openSettings();
  };

  const firstPrayer = visiblePrayers[0] ?? null;
  const lastPrayer = visiblePrayers[visiblePrayers.length - 1] ?? null;
  const sunrisePrayer = visiblePrayers.find((prayer) => prayer.name === 'Sunrise') ?? null;

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
              <button
                className="location-action primary"
                onClick={handleConfirmLocation}
              >
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
              Stay on schedule with gentle notifications for each prayer time. Would you like to
              enable reminders?
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
                <p>Fine-tune reminders to match your routine.</p>
              </div>
              <button className="settings-close" onClick={handleCloseSettings} aria-label="Close settings">
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
                  <button className="settings-secondary-button" onClick={handleOpenLocationPicker}>
                    Change
                  </button>
                </div>
                <p className="settings-note">
                  {activeLocation
                    ? `${activeLocation.city}, ${activeLocation.country} • ${activeLocation.timezone}`
                    : 'Select a location to calculate prayer times.'}
                </p>
              </section>
              <section className="settings-section">
                <div className="settings-row">
                  <label className="settings-label" htmlFor="settings-notifications-toggle">
                    Prayer reminders
                  </label>
                  <label className="settings-toggle" htmlFor="settings-notifications-toggle">
                    <input
                      id="settings-notifications-toggle"
                      type="checkbox"
                      checked={notificationsEnabled}
                      onChange={(event) => handleSettingsToggleNotifications(event.target.checked)}
                    />
                    <span>{notificationsEnabled ? 'Enabled' : 'Disabled'}</span>
                  </label>
                </div>
                <p className="settings-description">Allow desktop reminders before each prayer time.</p>
                {notificationPermission === 'denied' && (
                  <p className="settings-note warning">
                    Notifications are currently blocked. Enable them from system preferences to receive reminders.
                  </p>
                )}
                {notificationPermission === 'unsupported' && (
                  <p className="settings-note warning">Notifications are not supported on this device.</p>
                )}
              </section>
              <section className="settings-section">
                <div className="settings-row">
                  <div>
                    <span className="settings-label">Lead time</span>
                    <p className="settings-description">Choose how long before each prayer you are notified.</p>
                  </div>
                  <div className="settings-field">
                    <input
                      type="number"
                      min={0}
                      max={MAX_NOTIFICATION_LEAD_MINUTES}
                      step={1}
                      value={notificationPreferences.leadMinutes}
                      onChange={handleLeadMinutesChange}
                      disabled={!notificationsEnabled}
                      aria-label="Minutes before prayer to notify"
                    />
                    <span className="settings-field-unit">min</span>
                  </div>
                </div>
              </section>
              <section className="settings-section">
                <span className="settings-label">Prayer selection</span>
                <p className="settings-description">Select which prayers will trigger reminders.</p>
                {visiblePrayers.length ? (
                  <div className="settings-prayer-grid">
                    {visiblePrayers.map((prayer: PrayerTime) => {
                      const isEnabled = notificationPreferences.perPrayer[prayer.name] ?? true;
                      return (
                        <label
                          key={prayer.name}
                          className={`settings-prayer${!notificationsEnabled ? ' disabled' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={Boolean(isEnabled)}
                            onChange={handlePrayerToggle(prayer.name)}
                            disabled={!notificationsEnabled}
                          />
                          <span>{prayer.name}</span>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <p className="settings-note">Prayer schedule unavailable. Try refreshing.</p>
                )}
              </section>
            </div>
            <div className="settings-actions">
              <button className="settings-action primary" onClick={handleCloseSettings}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="shell">
        <header className="topbar">
          <div className="brand">
            <div className="brand-mark">PT</div>
            <div>
              <h1>Prayer Rhythm</h1>
              <p>Craft a calm flow for every prayer across your day.</p>
            </div>
          </div>
          <div className="top-actions">
            <div className="top-meta">
              <span className="chip">
                {activeLocation ? `${activeLocation.city}, ${activeLocation.country}` : 'Locating...'}
              </span>
              {activeLocation?.timezone && <span className="chip subtle">{activeLocation.timezone}</span>}
              <span className="chip subtle">{DEFAULT_CALCULATION_METHOD}</span>
            </div>
            <div className="top-buttons">
              {notificationsEnabled ? (
                <span className="status-pill success">Reminders enabled</span>
              ) : (
                <button className="status-pill ghost" onClick={handleManageNotifications}>
                  Enable reminders
                </button>
              )}
              <button className="status-pill ghost settings-button" onClick={openSettings}>
                Settings
              </button>
            </div>
          </div>
        </header>

        <main className="content">
          {loading ? (
            <div className="state-card">Loading prayer times...</div>
          ) : prayerTimes ? (
            <div className="dashboard">
              <section className="summary-panel">
                <div className="hero-card">
                  <span className="hero-label">Current moment</span>
                  <div className="hero-time">{currentTimeDisplay || '--:--'}</div>
                  <div className="hero-date">{currentDateDisplay || prayerTimes.date}</div>
                  <div className="hero-meta">
                    <span className="chip">
                      {activeLocation ? `${activeLocation.city}, ${activeLocation.country}` : 'Locating...'}
                    </span>
                    {activeLocation?.timezone && <span className="chip subtle">{activeLocation.timezone}</span>}
                    {prayerTimes.hijriDate && <span className="chip subtle">{prayerTimes.hijriDate}</span>}
                  </div>
                </div>

                {nextPrayer && (
                  <div className="next-card">
                    <div className="next-card-header">
                      <span className="label">Next prayer</span>
                      <span className="next-name">{nextPrayer.name}</span>
                    </div>
                    <div className="next-card-main">
                      <span className="next-time">{nextPrayer.time}</span>
                      <span className="next-countdown">
                        {timeUntilNext === 'Now' ? 'Starting now' : `in ${timeUntilNext}`}
                      </span>
                    </div>
                    <div className="progress-track" aria-hidden="true">
                      <div
                        className="progress-bar"
                        style={{ width: `${Math.min(100, Math.max(0, nextPrayerProgress))}%` }}
                      />
                    </div>
                    <div className="progress-meta">
                      <span className="progress-label">
                        {previousPrayer
                          ? `${previousPrayer.name} • ${previousPrayer.time}`
                          : 'Awaiting previous prayer'}
                      </span>
                      <span className="progress-label">Toward {nextPrayer.name}</span>
                    </div>
                  </div>
                )}

                <div className="insight-grid">
                  {firstPrayer && (
                    <div className="insight-card">
                      <span className="insight-label">First prayer</span>
                      <span className="insight-value">{firstPrayer.time}</span>
                      <span className="insight-subtext">{firstPrayer.name}</span>
                    </div>
                  )}
                  {sunrisePrayer && (
                    <div className="insight-card">
                      <span className="insight-label">Sunrise</span>
                      <span className="insight-value">{sunrisePrayer.time}</span>
                      <span className="insight-subtext">Golden hour begins</span>
                    </div>
                  )}
                  {lastPrayer && (
                    <div className="insight-card">
                      <span className="insight-label">Final prayer</span>
                      <span className="insight-value">{lastPrayer.time}</span>
                      <span className="insight-subtext">{lastPrayer.name}</span>
                    </div>
                  )}
                </div>
              </section>

              <section className="schedule-panel">
                <div className="panel-heading">
                  <h2>Today's Schedule</h2>
                  {prayerTimes.hijriDate && <span className="chip subtle">{prayerTimes.hijriDate}</span>}
                </div>
                <p className="panel-subtitle">
                  Track each prayer as your day progresses and stay mindful of the moments ahead.
                </p>
                <div className="timeline-list">
                  {visiblePrayers.map((prayer: PrayerTime) => {
                    const now = new Date();
                    const isNext = nextPrayer?.name === prayer.name;
                    const todayOccurrence = PrayerTimeCalculator.getOccurrenceForDate(prayer, now);
                    const isPast = !isNext && todayOccurrence.getTime() < now.getTime();
                    const statusClass = isNext ? 'next' : isPast ? 'past' : 'upcoming';
                    const statusText = isNext ? 'Next' : isPast ? 'Completed' : 'Upcoming';

                    let relativeLabel = '';
                    if (isNext) {
                      relativeLabel = timeUntilNext === 'Now' ? 'Starting now' : `in ${timeUntilNext}`;
                    } else if (isPast) {
                      const diff = now.getTime() - todayOccurrence.getTime();
                      const formatted = formatTimeRemaining(diff);
                      relativeLabel = formatted === 'Now' ? 'Moments ago' : `${formatted} ago`;
                    } else {
                      const diff = todayOccurrence.getTime() - now.getTime();
                      const formatted = formatTimeRemaining(diff);
                      relativeLabel = formatted === 'Now' ? 'Moments away' : `in ${formatted}`;
                    }

                    return (
                      <div key={prayer.name} className={`timeline-card ${statusClass}`}>
                        <div className="timeline-dot" />
                        <div className="timeline-content">
                          <div className="timeline-heading">
                            <span className="timeline-name">{prayer.name}</span>
                            <span className="timeline-time">{prayer.time}</span>
                          </div>
                          <div className="timeline-meta">
                            <span className={`timeline-status ${statusClass}`}>{statusText}</span>
                            <span className="timeline-relative">{relativeLabel}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
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
