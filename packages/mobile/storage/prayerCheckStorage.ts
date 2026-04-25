import type { PrayerName } from '../notifications/notificationConfig';
import { PRAYER_NOTIFICATION_NAMES } from '../notifications/notificationConfig';
import { storage } from './baseStorage';

const PRAYER_CHECK_STORAGE_KEY = 'prayerCheckState';
const MAX_RECORDED_RESPONSES = 100;

export type PrayerCheckResponse = 'yes' | 'no';

export type PrayerCheckInRecord = {
  id: string;
  prayerName: PrayerName;
  prayerTime: string;
  date: string;
  occurrenceIso: string;
  notifyAtIso: string;
};

type PrayerCheckResponseRecord = {
  id: string;
  prayerName: PrayerName;
  response: PrayerCheckResponse;
  answeredAtIso: string;
};

export type PrayerCheckState = {
  pending: PrayerCheckInRecord[];
  missedCounts: Record<PrayerName, number>;
  responses: PrayerCheckResponseRecord[];
};

type PrayerCheckFallback = Omit<PrayerCheckInRecord, 'prayerTime'> & {
  prayerTime?: string;
};

const listeners = new Set<(state: PrayerCheckState) => void>();

const createDefaultMissedCounts = (): Record<PrayerName, number> => ({
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

const isPrayerName = (value: unknown): value is PrayerName => {
  return PRAYER_NOTIFICATION_NAMES.includes(value as PrayerName);
};

const normalizePrayerCheckRecord = (value: unknown): PrayerCheckInRecord | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<PrayerCheckInRecord>;
  if (
    typeof candidate.id !== 'string' ||
    !isPrayerName(candidate.prayerName) ||
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
    !isPrayerName(candidate.prayerName) ||
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

const normalizeState = (value: unknown): PrayerCheckState => {
  if (!value || typeof value !== 'object') {
    return createDefaultPrayerCheckState();
  }

  const candidate = value as Partial<PrayerCheckState>;
  const missedCounts = createDefaultMissedCounts();

  for (const prayerName of PRAYER_NOTIFICATION_NAMES) {
    const count = candidate.missedCounts?.[prayerName];
    if (typeof count === 'number' && Number.isFinite(count) && count >= 0) {
      missedCounts[prayerName] = Math.round(count);
    }
  }

  const pending = Array.isArray(candidate.pending)
    ? candidate.pending
        .map((entry) => normalizePrayerCheckRecord(entry))
        .filter((entry): entry is PrayerCheckInRecord => entry !== null)
        .sort((first, second) => first.notifyAtIso.localeCompare(second.notifyAtIso))
    : [];

  const responses = Array.isArray(candidate.responses)
    ? candidate.responses
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

const cloneState = (state: PrayerCheckState): PrayerCheckState => ({
  pending: state.pending.map((entry) => ({ ...entry })),
  missedCounts: { ...state.missedCounts },
  responses: state.responses.map((entry) => ({ ...entry })),
});

let cachedState: PrayerCheckState | null = null;
let activeLoadPromise: Promise<PrayerCheckState> | null = null;
let mutationQueue: Promise<PrayerCheckState> = Promise.resolve(createDefaultPrayerCheckState());

const emitChange = (state: PrayerCheckState) => {
  const snapshot = cloneState(state);
  listeners.forEach((listener) => {
    try {
      listener(snapshot);
    } catch (error) {
      console.error('Failed to notify prayer check state listener.', error);
    }
  });
};

const persistState = async (state: PrayerCheckState) => {
  try {
    await storage.set(PRAYER_CHECK_STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('Failed to persist prayer check state.', error);
  }
};

const loadState = async (): Promise<PrayerCheckState> => {
  if (cachedState) {
    return cachedState;
  }

  if (activeLoadPromise) {
    return activeLoadPromise;
  }

  activeLoadPromise = (async () => {
    try {
      const raw = await storage.getString(PRAYER_CHECK_STORAGE_KEY);
      if (!raw) {
        cachedState = createDefaultPrayerCheckState();
        return cachedState;
      }

      cachedState = normalizeState(JSON.parse(raw));
      return cachedState;
    } catch (error) {
      console.error('Failed to load prayer check state.', error);
      cachedState = createDefaultPrayerCheckState();
      return cachedState;
    } finally {
      activeLoadPromise = null;
    }
  })();

  return activeLoadPromise;
};

const updateState = async (
  updater: (state: PrayerCheckState) => PrayerCheckState,
): Promise<PrayerCheckState> => {
  mutationQueue = mutationQueue
    .catch(() => createDefaultPrayerCheckState())
    .then(async () => {
      const current = await loadState();
      const next = updater(cloneState(current));
      cachedState = next;
      await persistState(next);
      emitChange(next);
      return cloneState(next);
    });

  return mutationQueue;
};

export const getPrayerCheckState = async (): Promise<PrayerCheckState> => {
  const state = await loadState();
  return cloneState(state);
};

export const subscribeToPrayerCheckState = (
  listener: (state: PrayerCheckState) => void,
) => {
  listeners.add(listener);
  void getPrayerCheckState().then(listener).catch((error) => {
    console.error('Failed to prime prayer check state listener.', error);
  });

  return () => {
    listeners.delete(listener);
  };
};

export const queuePrayerCheckPrompt = async (
  prompt: PrayerCheckInRecord,
): Promise<PrayerCheckState> => {
  return updateState((state) => {
    const alreadyAnswered = state.responses.some((entry) => entry.id === prompt.id);
    if (alreadyAnswered) {
      return state;
    }

    if (state.pending.some((entry) => entry.id === prompt.id)) {
      return state;
    }

    state.pending.push({ ...prompt });
    state.pending.sort((first, second) => first.notifyAtIso.localeCompare(second.notifyAtIso));
    return state;
  });
};

export const respondToPrayerCheck = async (
  id: string,
  response: PrayerCheckResponse,
  fallback?: PrayerCheckFallback | null,
): Promise<PrayerCheckState> => {
  return updateState((state) => {
    const existing = state.responses.find((entry) => entry.id === id);
    if (existing) {
      return state;
    }

    const pending = state.pending.find((entry) => entry.id === id);
    const prayerName = pending?.prayerName ?? (fallback?.prayerName && isPrayerName(fallback.prayerName) ? fallback.prayerName : null);

    if (!prayerName) {
      return state;
    }

    state.pending = state.pending.filter((entry) => entry.id !== id);
    state.responses.push({
      id,
      prayerName,
      response,
      answeredAtIso: new Date().toISOString(),
    });
    state.responses = state.responses.slice(-MAX_RECORDED_RESPONSES);

    if (response === 'no') {
      state.missedCounts[prayerName] += 1;
    }

    return state;
  });
};

const updateMissedPrayerCount = async (
  prayerName: PrayerName,
  delta: number,
): Promise<PrayerCheckState> => {
  return updateState((state) => {
    if (!isPrayerName(prayerName) || !Number.isFinite(delta) || delta === 0) {
      return state;
    }

    state.missedCounts[prayerName] = Math.max(0, state.missedCounts[prayerName] + Math.round(delta));
    return state;
  });
};

export const addMissedPrayer = async (prayerName: PrayerName): Promise<PrayerCheckState> => {
  return updateMissedPrayerCount(prayerName, 1);
};

export const removeMissedPrayer = async (prayerName: PrayerName): Promise<PrayerCheckState> => {
  return updateMissedPrayerCount(prayerName, -1);
};
