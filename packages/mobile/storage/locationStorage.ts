import { Location } from '@prayer-time/shared';

import { storage } from './baseStorage';

const LOCATION_KEY = 'userLocation';

type StoredLocation = Location;

export const locationStorage = {
  async get(): Promise<StoredLocation | null> {
    try {
      const rawValue = await storage.getString(LOCATION_KEY);

      if (!rawValue) {
        return null;
      }

      return JSON.parse(rawValue) as StoredLocation;
    } catch (error) {
      console.error('Failed to read location from storage.', error);
      return null;
    }
  },
  async set(location: StoredLocation): Promise<void> {
    await storage.set(LOCATION_KEY, JSON.stringify(location));
  },
  async clear(): Promise<void> {
    await storage.delete(LOCATION_KEY);
  },
};
