import { app } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import {
  clonePrayerCheckState,
  createDefaultPrayerCheckState,
  isNotifiablePrayerName,
  normalizePrayerCheckState,
  type PrayerCheckInRecord,
  type PrayerCheckResponse,
  type PrayerCheckState,
} from './prayerCheckTypes';

const STORE_FILE_NAME = 'prayer-check-state.json';

type PrayerCheckFallback = Omit<PrayerCheckInRecord, 'prayerTime'> & {
  prayerTime?: string;
};

let cachedState: PrayerCheckState = createDefaultPrayerCheckState();
let initialized = false;
let writePromise: Promise<void> = Promise.resolve();
let mutationQueue: Promise<PrayerCheckState> = Promise.resolve(createDefaultPrayerCheckState());

const getStorePath = () => path.join(app.getPath('userData'), STORE_FILE_NAME);

const persistState = async (state: PrayerCheckState) => {
  const snapshot = clonePrayerCheckState(state);
  writePromise = writePromise
    .then(async () => {
      await fs.mkdir(path.dirname(getStorePath()), { recursive: true });
      await fs.writeFile(getStorePath(), JSON.stringify(snapshot, null, 2), 'utf8');
    })
    .catch((error) => {
      console.error('Failed to persist desktop prayer check state.', error);
    });

  await writePromise;
};

export const initializePrayerCheckStore = async (): Promise<PrayerCheckState> => {
  if (initialized) {
    return clonePrayerCheckState(cachedState);
  }

  try {
    const raw = await fs.readFile(getStorePath(), 'utf8');
    cachedState = normalizePrayerCheckState(JSON.parse(raw));
  } catch (error) {
    cachedState = createDefaultPrayerCheckState();
  }

  initialized = true;
  return clonePrayerCheckState(cachedState);
};

const updateState = async (
  updater: (state: PrayerCheckState) => PrayerCheckState,
): Promise<PrayerCheckState> => {
  mutationQueue = mutationQueue
    .catch(() => createDefaultPrayerCheckState())
    .then(async () => {
      await initializePrayerCheckStore();
      const nextState = updater(clonePrayerCheckState(cachedState));
      cachedState = nextState;
      await persistState(nextState);
      return clonePrayerCheckState(nextState);
    });

  return mutationQueue;
};

export const getPrayerCheckState = async (): Promise<PrayerCheckState> => {
  await initializePrayerCheckStore();
  return clonePrayerCheckState(cachedState);
};

export const queuePrayerCheckPrompt = async (
  prompt: PrayerCheckInRecord,
): Promise<PrayerCheckState> => {
  return updateState((state) => {
    const alreadyAnswered = state.responses.some((entry) => entry.id === prompt.id);
    if (alreadyAnswered || state.pending.some((entry) => entry.id === prompt.id)) {
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
    if (state.responses.some((entry) => entry.id === id)) {
      return state;
    }

    const pending = state.pending.find((entry) => entry.id === id);
    const prayerName =
      pending?.prayerName ??
      (fallback?.prayerName && isNotifiablePrayerName(fallback.prayerName) ? fallback.prayerName : null);

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
    state.responses = state.responses.slice(-100);

    if (response === 'no') {
      state.missedCounts[prayerName] += 1;
    }

    return state;
  });
};
