import { Location } from '@prayer-time/shared';

import { storage } from './baseStorage';

const LOCATION_KEY = 'userLocation';

type StoredLocation = Location;

type LegacyStoredLocation = {
  latitude?: number | string;
  longitude?: number | string;
  city?: string;
  country?: string;
  timezone?: string;
  coords?: {
    latitude?: number | string;
    longitude?: number | string;
  };
};

const toFiniteNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const normalizeStoredLocation = (value: unknown): StoredLocation | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as LegacyStoredLocation;
  const latitude = toFiniteNumber(candidate.latitude ?? candidate.coords?.latitude);
  const longitude = toFiniteNumber(candidate.longitude ?? candidate.coords?.longitude);

  if (latitude == null || longitude == null) {
    return null;
  }

  return {
    latitude,
    longitude,
    city: typeof candidate.city === 'string' ? candidate.city : '',
    country: typeof candidate.country === 'string' ? candidate.country : '',
    timezone:
      typeof candidate.timezone === 'string' && candidate.timezone.length > 0
        ? candidate.timezone
        : 'UTC',
  };
};

export const locationStorage = {
  async get(): Promise<StoredLocation | null> {
    try {
      const rawValue = await storage.getString(LOCATION_KEY);

      if (!rawValue) {
        return null;
      }

      return normalizeStoredLocation(JSON.parse(rawValue));
    } catch (error) {
      console.error('Failed to read location from storage.', error);
      return null;
    }
  },
  async set(location: StoredLocation): Promise<void> {
    const normalized = normalizeStoredLocation(location);
    if (!normalized) {
      console.error('Failed to persist location: invalid coordinates.');
      return;
    }

    await storage.set(LOCATION_KEY, JSON.stringify(normalized));
  },
  async clear(): Promise<void> {
    await storage.delete(LOCATION_KEY);
  },
};
