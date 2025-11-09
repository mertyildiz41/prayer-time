import { Location } from '@prayer-time/shared';

export type RootStackParamList = {
  PrayerTime: { location: Location };
  Qibla: { location: Location };
  LocationSearch: undefined;
};
