import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import type { DailyPrayerTimes } from '@prayer-time/shared';

contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    send: (channel: string, args?: any) => ipcRenderer.send(channel, args),
    invoke: (channel: string, args?: any) => ipcRenderer.invoke(channel, args),
    on: (channel: string, func: (...args: any[]) => void) => {
      const subscription = (_event: IpcRendererEvent, ...args: any[]) => func(...args);
      ipcRenderer.on(channel, subscription);
      return () => {
        ipcRenderer.removeListener(channel, subscription);
      };
    },
  },
  calculatePrayerTimes: (date: string, location: any, method: string) =>
    ipcRenderer.invoke('calculate-prayer-times', { date, location, method }),
  configureNotifications: (
    enabled: boolean,
    times?: DailyPrayerTimes | null,
    preferences?: { leadMinutes: number; enabledPrayers?: string[] }
  ) => ipcRenderer.send('notifications-configure', { enabled, times, preferences }),
});
