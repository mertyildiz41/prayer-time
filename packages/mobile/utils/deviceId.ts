// @ts-nocheck

import { createMMKV } from 'react-native-mmkv';

const storage = createMMKV({ id: 'device-storage' });
const DEVICE_ID_KEY = 'device_id';

/**
 * Generate a UUID v4
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Get or create device ID
 * Generates a unique device ID and stores it locally
 */
export function getDeviceId(): string {
  let deviceId = storage.getString(DEVICE_ID_KEY);
  
  if (!deviceId) {
    deviceId = generateUUID();
    storage.set(DEVICE_ID_KEY, deviceId);
  }
  
  return deviceId;
}

/**
 * Reset device ID (for testing purposes)
 */
export function resetDeviceId(): void {
  storage.delete(DEVICE_ID_KEY);
}

