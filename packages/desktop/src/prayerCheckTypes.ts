import type { NotifiablePrayerName } from './notificationConfig';

const MAX_RECORDED_RESPONSES = 100;

export type PrayerCheckResponse = 'yes' | 'no';

export type PrayerCheckInRecord = {
  id: string;
  prayerName: NotifiablePrayerName;
  prayerTime: string;
  date: string;
  occurrenceIso: string;
  notifyAtIso: string;
};

export type PrayerCheckResponseRecord = {
  id: string;
  prayerName: NotifiablePrayerName;
  response: PrayerCheckResponse;
  answeredAtIso: string;
};

export type PrayerCheckState = {
  pending: PrayerCheckInRecord[];
  missedCounts: Record<NotifiablePrayerName, number>;
  responses: PrayerCheckResponseRecord[];
};

type MaybePrayerCheckState = Partial<PrayerCheckState> | null | undefined;

const PRAYER_NAMES: readonly NotifiablePrayerName[] = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

export const createDefaultMissedCounts = (): Record<NotifiablePrayerName, number> => ({
  Fajr: 0,
  Dhuhr: 0,
  Asr: 0,
  Maghrib: 0,
  Isha: 0,
});

export const createDefaultPrayerCheckState = (): PrayerCheckState => ({
  pending: [],
  missedCounts: createDefaultMissedCounts(),
  responses: [],
});

export const isNotifiablePrayerName = (value: unknown): value is NotifiablePrayerName => {
  return PRAYER_NAMES.includes(value as NotifiablePrayerName);
};

const normalizePrayerCheckRecord = (value: unknown): PrayerCheckInRecord | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<PrayerCheckInRecord>;
  if (
    typeof candidate.id !== 'string' ||
    !isNotifiablePrayerName(candidate.prayerName) ||
    typeof candidate.prayerTime !== 'string' ||
    typeof candidate.date !== 'string' ||
    typeof candidate.occurrenceIso !== 'string' ||
    typeof candidate.notifyAtIso !== 'string'
  ) {
    return null;
  }

  return {
    id: candidate.id,
    prayerName: candidate.prayerName,
    prayerTime: candidate.prayerTime,
    date: candidate.date,
    occurrenceIso: candidate.occurrenceIso,
    notifyAtIso: candidate.notifyAtIso,
  };
};

const normalizeResponseRecord = (value: unknown): PrayerCheckResponseRecord | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<PrayerCheckResponseRecord>;
  if (
    typeof candidate.id !== 'string' ||
    !isNotifiablePrayerName(candidate.prayerName) ||
    (candidate.response !== 'yes' && candidate.response !== 'no') ||
    typeof candidate.answeredAtIso !== 'string'
  ) {
    return null;
  }

  return {
    id: candidate.id,
    prayerName: candidate.prayerName,
    response: candidate.response,
    answeredAtIso: candidate.answeredAtIso,
  };
};

export const normalizePrayerCheckState = (value: MaybePrayerCheckState): PrayerCheckState => {
  if (!value || typeof value !== 'object') {
    return createDefaultPrayerCheckState();
  }

  const missedCounts = createDefaultMissedCounts();

  for (const prayerName of PRAYER_NAMES) {
    const count = value.missedCounts?.[prayerName];
    if (typeof count === 'number' && Number.isFinite(count) && count >= 0) {
      missedCounts[prayerName] = Math.round(count);
    }
  }

  const pending = Array.isArray(value.pending)
    ? value.pending
        .map((entry) => normalizePrayerCheckRecord(entry))
        .filter((entry): entry is PrayerCheckInRecord => entry !== null)
        .sort((first, second) => first.notifyAtIso.localeCompare(second.notifyAtIso))
    : [];

  const responses = Array.isArray(value.responses)
    ? value.responses
        .map((entry) => normalizeResponseRecord(entry))
        .filter((entry): entry is PrayerCheckResponseRecord => entry !== null)
        .slice(-MAX_RECORDED_RESPONSES)
    : [];

  return {
    pending,
    missedCounts,
    responses,
  };
};

export const clonePrayerCheckState = (state: PrayerCheckState): PrayerCheckState => ({
  pending: state.pending.map((entry) => ({ ...entry })),
  missedCounts: { ...state.missedCounts },
  responses: state.responses.map((entry) => ({ ...entry })),
});
