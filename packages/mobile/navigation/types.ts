import { Location } from '@prayer-time/shared';

export type RootStackParamList = {
  PrayerTime: { location: Location } | undefined;
  Qibla: { location: Location };
  LocationSearch: undefined;
  Quran: undefined;
  QuranReader: { surahNumber: number; surahName: string };
  Ummah: undefined;
  CreateGroup: undefined;
  GroupDetail: { groupId: string };
  Counter: { groupId: string };
  Completion: { groupId: string; count?: number };
  Settings: undefined;
  TahajjudSettings: undefined;
  MosqueFinder: undefined;
};
