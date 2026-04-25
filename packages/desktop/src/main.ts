import { app, BrowserWindow, Menu, Notification, ipcMain } from 'electron';
import path from 'path';
import { DailyPrayerTimes, Location, PrayerTime, PrayerTimeCalculator } from '@prayer-time/shared';
import { MenuBarManager } from './MenuBarManager';
import {
  normalizeNotificationConfig,
  NOTIFIABLE_PRAYER_NAMES,
  type NotificationScheduleConfig,
  type NotifiablePrayerName,
} from './notificationConfig';
import {
  DEFAULT_TAHAJJUD_CUSTOM_TIME,
  type TahajjudReminderMethod,
  computeTahajjudReminderOccurrence,
} from './tahajjudTime';
import {
  getPrayerCheckState,
  initializePrayerCheckStore,
  queuePrayerCheckPrompt,
  respondToPrayerCheck,
} from './prayerCheckStore';
import {
  type PrayerCheckInRecord,
  type PrayerCheckResponse,
} from './prayerCheckTypes';

type NotificationVariant = 'at' | 'before' | 'after';

interface NotificationConfigurePayload {
  enabled?: boolean;
  times?: DailyPrayerTimes | null;
  preferences?: NotificationScheduleConfig | null;
  tahajjud?: {
    enabled?: boolean;
    method?: TahajjudReminderMethod;
    customTime?: string;
    leadMinutes?: number;
    location?: Location | null;
    calculationMethod?: string;
  } | null;
}

interface TahajjudSchedulerState {
  enabled: boolean;
  method: TahajjudReminderMethod;
  customTime: string;
  leadMinutes: number;
  location: Location | null;
  calculationMethod: string;
}

let mainWindow: BrowserWindow | null = null;
let menuBarManager: MenuBarManager | null = null;
let menuBarRefreshTimer: NodeJS.Timeout | null = null;
const isDev = !app.isPackaged;

const prayerNotificationTimers = new Set<NodeJS.Timeout>();
let tahajjudTimer: NodeJS.Timeout | null = null;
let notificationsActive = false;
let notificationSchedule: DailyPrayerTimes | null = null;
let notificationPreferences = normalizeNotificationConfig();
let tahajjudPreferences: TahajjudSchedulerState = {
  enabled: false,
  method: 'custom',
  customTime: DEFAULT_TAHAJJUD_CUSTOM_TIME,
  leadMinutes: 0,
  location: null,
  calculationMethod: 'Diyanet',
};

const MAX_TAHAJJUD_LEAD_MINUTES = 120;

const DEFAULT_LOCATION: Location = {
  latitude: 41.0082,
  longitude: 28.9784,
  city: 'Istanbul',
  country: 'Türkiye',
  timezone: 'Europe/Istanbul',
};

const DEFAULT_METHOD = 'Diyanet';

const isNotifiablePrayer = (name: PrayerTime['name']): name is NotifiablePrayerName => {
  return NOTIFIABLE_PRAYER_NAMES.includes(name as NotifiablePrayerName);
};

const formatLocalDateKey = (value: Date): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const buildPrayerCheckInRecord = (
  prayer: PrayerTime,
  occurrence: Date,
  notifyAt: Date
): PrayerCheckInRecord => {
  return {
    id: `prayer-check-${prayer.name.toLowerCase()}-${occurrence.getTime()}`,
    prayerName: prayer.name as NotifiablePrayerName,
    prayerTime: prayer.time,
    date: formatLocalDateKey(occurrence),
    occurrenceIso: occurrence.toISOString(),
    notifyAtIso: notifyAt.toISOString(),
  };
};

const clampTahajjudLeadMinutes = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const rounded = Math.round(value);
  if (rounded < 0) {
    return 0;
  }

  if (rounded > MAX_TAHAJJUD_LEAD_MINUTES) {
    return MAX_TAHAJJUD_LEAD_MINUTES;
  }

  return rounded;
};

const clearPrayerNotificationTimers = () => {
  prayerNotificationTimers.forEach((timer) => clearTimeout(timer));
  prayerNotificationTimers.clear();
};

const clearTahajjudTimer = () => {
  if (tahajjudTimer) {
    clearTimeout(tahajjudTimer);
    tahajjudTimer = null;
  }
};

const sendPrayerCheckStateToWindow = async (targetWindow: BrowserWindow) => {
  try {
    const state = await getPrayerCheckState();
    if (!targetWindow.isDestroyed() && !targetWindow.webContents.isDestroyed()) {
      targetWindow.webContents.send('prayer-check-state', state);
    }
  } catch (error) {
    console.error('Failed to send prayer check state to renderer.', error);
  }
};

const broadcastPrayerCheckState = async () => {
  const windows = BrowserWindow.getAllWindows();
  await Promise.all(
    windows.map(async (window) => {
      if (window.isDestroyed() || window.webContents.isDestroyed()) {
        return;
      }

      if (window.webContents.isLoading()) {
        window.webContents.once('did-finish-load', () => {
          void sendPrayerCheckStateToWindow(window);
        });
        return;
      }

      await sendPrayerCheckStateToWindow(window);
    })
  );
};

const showMainWindow = () => {
  if (!mainWindow) {
    createWindow();
  }

  const targetWindow = mainWindow;
  if (!targetWindow) {
    return null;
  }

  if (targetWindow.isMinimized()) {
    targetWindow.restore();
  }

  targetWindow.show();
  targetWindow.focus();

  return targetWindow;
};

type DesktopNotificationOptions = {
  prayerCheckIn?: PrayerCheckInRecord;
};

const showDesktopNotification = (
  title: string,
  body: string,
  options: DesktopNotificationOptions = {}
) => {
  const notification = new Notification({
    title,
    body,
    silent: false,
    ...(options.prayerCheckIn && process.platform === 'darwin'
      ? {
          actions: [
            { type: 'button', text: 'Yes' },
            { type: 'button', text: 'No' },
          ],
          closeButtonText: 'Later',
        }
      : {}),
  });

  if (options.prayerCheckIn) {
    notification.on('click', () => {
      showMainWindow();
      void broadcastPrayerCheckState();
    });

    if (process.platform === 'darwin') {
      notification.on('action', (_event, index) => {
        const response: PrayerCheckResponse = index === 0 ? 'yes' : 'no';
        void respondToPrayerCheck(options.prayerCheckIn!.id, response, options.prayerCheckIn)
          .then(() => broadcastPrayerCheckState())
          .catch((error) => {
            console.error('Failed to handle prayer check notification action.', error);
          });
      });
    }
  }

  notification.show();
};

const getPrayerNotificationSchedule = (
  prayer: PrayerTime,
  variant: NotificationVariant,
  minutesOffset: number,
  reference: Date = new Date()
): { notifyTime: Date; occurrence: Date } => {
  if (variant === 'before') {
    let occurrence = PrayerTimeCalculator.getUpcomingOccurrence(prayer, reference);
    let notifyTime = new Date(occurrence.getTime() - minutesOffset * 60 * 1000);

    if (notifyTime.getTime() <= reference.getTime()) {
      occurrence = PrayerTimeCalculator.getUpcomingOccurrence(
        prayer,
        new Date(occurrence.getTime() + 60 * 1000)
      );
      notifyTime = new Date(occurrence.getTime() - minutesOffset * 60 * 1000);
    }

    return { notifyTime, occurrence };
  }

  let occurrence = PrayerTimeCalculator.getOccurrenceForDate(prayer, reference);
  let notifyTime =
    variant === 'after'
      ? new Date(occurrence.getTime() + minutesOffset * 60 * 1000)
      : new Date(occurrence.getTime());

  if (notifyTime.getTime() <= reference.getTime()) {
    occurrence = PrayerTimeCalculator.getUpcomingOccurrence(prayer, reference);
    notifyTime =
      variant === 'after'
        ? new Date(occurrence.getTime() + minutesOffset * 60 * 1000)
        : new Date(occurrence.getTime());
  }

  return { notifyTime, occurrence };
};

const buildPrayerNotificationCopy = (
  prayer: PrayerTime,
  variant: NotificationVariant,
  minutesOffset: number
): { title: string; body: string } => {
  if (variant === 'before') {
    return {
      title: 'Salah Time',
      body: `${prayer.name} begins in ${minutesOffset} minute${minutesOffset === 1 ? '' : 's'} at ${prayer.time}.`,
    };
  }

  if (variant === 'after') {
    return {
      title: 'Salah Time',
      body: `Did you pray ${prayer.name}? It began ${minutesOffset} minute${
        minutesOffset === 1 ? '' : 's'
      } ago at ${prayer.time}.`,
    };
  }

  return {
    title: 'Salah Time',
    body: `It is time for ${prayer.name} at ${prayer.time}.`,
  };
};

const schedulePrayerNotificationVariant = (
  prayer: PrayerTime,
  variant: NotificationVariant,
  minutesOffset: number
) => {
  const now = new Date();
  const { notifyTime, occurrence } = getPrayerNotificationSchedule(prayer, variant, minutesOffset, now);
  const delay = Math.max(1000, notifyTime.getTime() - now.getTime());

  const timer = setTimeout(async () => {
    prayerNotificationTimers.delete(timer);

    if (!notificationsActive || !Notification.isSupported()) {
      return;
    }

    const copy = buildPrayerNotificationCopy(prayer, variant, minutesOffset);

    if (variant === 'after') {
      const prayerCheckIn = buildPrayerCheckInRecord(prayer, occurrence, notifyTime);

      try {
        await queuePrayerCheckPrompt(prayerCheckIn);
        await broadcastPrayerCheckState();
      } catch (error) {
        console.error('Failed to queue desktop prayer check-in.', error);
      }

      showDesktopNotification(copy.title, copy.body, { prayerCheckIn });
    } else {
      showDesktopNotification(copy.title, copy.body);
    }

    schedulePrayerNotificationVariant(prayer, variant, minutesOffset);
  }, delay);

  prayerNotificationTimers.add(timer);
};

const refreshPrayerNotificationSchedule = (times?: DailyPrayerTimes | null) => {
  if (typeof times !== 'undefined') {
    notificationSchedule = times ?? null;
  }

  clearPrayerNotificationTimers();

  if (!notificationsActive || !notificationSchedule || !Notification.isSupported()) {
    return;
  }

  notificationSchedule.prayers.forEach((prayer) => {
    if (!isNotifiablePrayer(prayer.name)) {
      return;
    }

    if (!notificationPreferences.enabledPrayers[prayer.name]) {
      return;
    }

    if (notificationPreferences.sendAtPrayerTime) {
      schedulePrayerNotificationVariant(prayer, 'at', 0);
    }

    if (notificationPreferences.sendBefore && notificationPreferences.minutesBefore > 0) {
      schedulePrayerNotificationVariant(prayer, 'before', notificationPreferences.minutesBefore);
    }

    if (notificationPreferences.sendAfter && notificationPreferences.minutesAfter > 0) {
      schedulePrayerNotificationVariant(prayer, 'after', notificationPreferences.minutesAfter);
    }
  });
};

const refreshTahajjudSchedule = () => {
  clearTahajjudTimer();

  if (!notificationsActive || !Notification.isSupported() || !tahajjudPreferences.enabled) {
    return;
  }

  const schedule = computeTahajjudReminderOccurrence({
    method: tahajjudPreferences.method,
    location: tahajjudPreferences.location,
    customTime: tahajjudPreferences.customTime,
    leadMinutes: tahajjudPreferences.leadMinutes,
    calculationMethod: tahajjudPreferences.calculationMethod,
  });

  if (!schedule) {
    return;
  }

  const delay = Math.max(1000, schedule.notifyAt.getTime() - Date.now());
  tahajjudTimer = setTimeout(() => {
    tahajjudTimer = null;

    if (!notificationsActive || !Notification.isSupported() || !tahajjudPreferences.enabled) {
      return;
    }

    const body =
      tahajjudPreferences.leadMinutes > 0
        ? `Tahajjud begins in ${tahajjudPreferences.leadMinutes} minute${
            tahajjudPreferences.leadMinutes === 1 ? '' : 's'
          } at ${schedule.time}.`
        : `It is time for Tahajjud at ${schedule.time}.`;

    showDesktopNotification('Salah Time', body);
    refreshTahajjudSchedule();
  }, delay);
};

const refreshNotificationSchedule = (times?: DailyPrayerTimes | null) => {
  refreshPrayerNotificationSchedule(times);
  refreshTahajjudSchedule();
};

const calculatePrayerTimes = (
  date: Date = new Date(),
  location: Location = DEFAULT_LOCATION,
  method: string = DEFAULT_METHOD
): DailyPrayerTimes => {
  return PrayerTimeCalculator.calculatePrayerTimes(date, location, method);
};

const ensureMenuBarManager = () => {
  if (process.platform !== 'darwin') {
    return null;
  }

  if (!menuBarManager) {
    menuBarManager = new MenuBarManager({
      onShowApp: () => {
        menuBarManager?.hidePopover();
        showMainWindow();
      },
    });
  }

  return menuBarManager;
};

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const startUrl = isDev
    ? 'http://localhost:3000'
    : `file://${path.join(__dirname, '../build/index.html')}`;

  const currentWindow = mainWindow;
  void currentWindow.loadURL(startUrl);

  currentWindow.webContents.once('did-finish-load', () => {
    void sendPrayerCheckStateToWindow(currentWindow);
  });

  if (isDev) {
    currentWindow.webContents.openDevTools();
  }

  currentWindow.on('closed', () => {
    if (mainWindow === currentWindow) {
      mainWindow = null;
    }
  });
};

const bootstrapMenuBar = () => {
  if (process.platform !== 'darwin') {
    return;
  }

  const manager = ensureMenuBarManager();
  if (!manager) {
    return;
  }

  const initialTimes = calculatePrayerTimes();
  manager.update(initialTimes);
  refreshNotificationSchedule(initialTimes);

  const oneHour = 60 * 60 * 1000;
  if (menuBarRefreshTimer) {
    clearInterval(menuBarRefreshTimer);
  }

  menuBarRefreshTimer = setInterval(() => {
    const times = calculatePrayerTimes();
    manager.update(times);
    refreshNotificationSchedule(times);
  }, oneHour);
};

app.whenReady().then(async () => {
  await initializePrayerCheckStore();
  createWindow();
  bootstrapMenuBar();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
    return;
  }

  showMainWindow();
});

app.on('before-quit', () => {
  if (menuBarRefreshTimer) {
    clearInterval(menuBarRefreshTimer);
    menuBarRefreshTimer = null;
  }

  clearPrayerNotificationTimers();
  clearTahajjudTimer();
  notificationsActive = false;
  menuBarManager?.destroy();
});

ipcMain.handle('calculate-prayer-times', (_event, { date, location, method }) => {
  const times = calculatePrayerTimes(new Date(date), location, method);
  const manager = ensureMenuBarManager();
  manager?.update(times);
  refreshNotificationSchedule(times);
  return times;
});

ipcMain.on('tray-open-app', () => {
  const manager = ensureMenuBarManager();
  manager?.hidePopover();

  showMainWindow();
});

ipcMain.on('tray-quit-app', () => {
  app.quit();
});

ipcMain.on('tray-hide', () => {
  const manager = ensureMenuBarManager();
  manager?.hidePopover();
});

ipcMain.on('tray-resize-popover', (_event, height: unknown) => {
  if (typeof height !== 'number' || !Number.isFinite(height)) {
    return;
  }

  const manager = ensureMenuBarManager();
  manager?.resizePopover(height);
});

ipcMain.on('tray-manage-notifications', () => {
  const manager = ensureMenuBarManager();
  manager?.hidePopover();

  const targetWindow = showMainWindow();
  if (!targetWindow) {
    return;
  }

  const sendOpen = () => {
    if (!targetWindow.isDestroyed() && !targetWindow.webContents.isDestroyed()) {
      targetWindow.webContents.send('notifications:open');
    }
  };

  if (targetWindow.webContents.isLoading()) {
    targetWindow.webContents.once('did-finish-load', sendOpen);
  } else {
    sendOpen();
  }
});

ipcMain.on('notifications-configure', (_event, payload: NotificationConfigurePayload | null | undefined) => {
  notificationsActive = Boolean(payload?.enabled);

  notificationPreferences = normalizeNotificationConfig(payload?.preferences ?? notificationPreferences);

  const rawTahajjudMethod = payload?.tahajjud?.method;
  const tahajjudMethod =
    rawTahajjudMethod === 'custom' ||
    rawTahajjudMethod === 'middle' ||
    rawTahajjudMethod === 'lastThird'
      ? rawTahajjudMethod
      : tahajjudPreferences.method;

  tahajjudPreferences = {
    enabled: Boolean(payload?.tahajjud?.enabled),
    method: tahajjudMethod,
    customTime: payload?.tahajjud?.customTime || DEFAULT_TAHAJJUD_CUSTOM_TIME,
    leadMinutes: clampTahajjudLeadMinutes(
      Number(payload?.tahajjud?.leadMinutes ?? tahajjudPreferences.leadMinutes)
    ),
    location: payload?.tahajjud?.location ?? null,
    calculationMethod: payload?.tahajjud?.calculationMethod || DEFAULT_METHOD,
  };

  refreshNotificationSchedule(typeof payload?.times !== 'undefined' ? payload.times : undefined);
});

ipcMain.handle('prayer-check-state:get', async () => {
  return getPrayerCheckState();
});

ipcMain.handle(
  'prayer-check:respond',
  async (_event, payload: { id?: string; response?: PrayerCheckResponse } | null | undefined) => {
    if (typeof payload?.id !== 'string' || (payload.response !== 'yes' && payload.response !== 'no')) {
      return getPrayerCheckState();
    }

    const state = await respondToPrayerCheck(payload.id, payload.response);
    await broadcastPrayerCheckState();
    return state;
  }
);

const template: Electron.MenuItemConstructorOptions[] = [
  {
    label: 'File',
    submenu: [
      {
        label: 'Exit',
        accelerator: 'CmdOrCtrl+Q',
        click: () => {
          app.quit();
        },
      },
    ],
  },
  {
    label: 'View',
    submenu: [
      {
        label: 'Reload',
        accelerator: 'CmdOrCtrl+R',
        click: () => {
          mainWindow?.reload();
        },
      },
      {
        label: 'Toggle Developer Tools',
        accelerator: 'CmdOrCtrl+Shift+I',
        click: () => {
          mainWindow?.webContents.toggleDevTools();
        },
      },
    ],
  },
];

const menu = Menu.buildFromTemplate(template);
Menu.setApplicationMenu(menu);
