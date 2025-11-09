import { Location } from '@prayer-time/shared';
import { createMMKV } from 'react-native-mmkv';

const LOCATION_KEY = 'userLocation';

const storage = createMMKV({ id: 'prayer-time-storage' });

type StoredLocation = Location;

export const locationStorage = {
  get(): StoredLocation | null {
    try {
      const rawValue = storage.getString(LOCATION_KEY);

      if (!rawValue) {
        return null;
      }

      return JSON.parse(rawValue) as StoredLocation;
    } catch (error) {
      console.error('Failed to read location from storage.', error);
      return null;
    }
  },
  set(location: StoredLocation): void {
    storage.set(LOCATION_KEY, JSON.stringify(location));
  },
  clear(): void {
    storage.remove(LOCATION_KEY);
  },
};
