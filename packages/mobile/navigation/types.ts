import { Location } from '@prayer-time/shared';

export type RootStackParamList = {
  PrayerTime: { location: Location } | undefined;
  Qibla: { location: Location };
  LocationSearch: undefined;
  Quran: undefined;
  Settings: undefined;
  TahajjudSettings: undefined;
};
