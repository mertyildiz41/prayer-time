import { app, BrowserWindow, Menu, Notification, ipcMain } from 'electron';
import path from 'path';
import { DailyPrayerTimes, Location, PrayerTime, PrayerTimeCalculator } from '@prayer-time/shared';
import { MenuBarManager } from './MenuBarManager';

type PrayerName = PrayerTime['name'];

interface NotificationPreferenceState {
  leadMinutes: number;
  enabledPrayers: Set<PrayerName> | null;
}

let mainWindow: BrowserWindow | null;
let menuBarManager: MenuBarManager | null = null;
let menuBarRefreshTimer: NodeJS.Timeout | null = null;
const isDev = !app.isPackaged;

const notificationTimers = new Set<NodeJS.Timeout>();
let notificationsActive = false;
let notificationSchedule: DailyPrayerTimes | null = null;
const MAX_NOTIFICATION_LEAD_MINUTES = 120;
const DEFAULT_NOTIFICATION_LEAD_MINUTES = 10;
const ALL_PRAYER_NAMES: PrayerName[] = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Sunset', 'Maghrib', 'Isha'];

const clampLeadMinutes = (value: number): number =>
  Math.min(MAX_NOTIFICATION_LEAD_MINUTES, Math.max(0, Math.round(value)));

let notificationPreferences: NotificationPreferenceState = {
  leadMinutes: DEFAULT_NOTIFICATION_LEAD_MINUTES,
  enabledPrayers: null,
};

const clearNotificationTimers = () => {
  notificationTimers.forEach((timer) => clearTimeout(timer));
  notificationTimers.clear();
};

const getNotificationSchedule = (prayer: PrayerTime, leadMinutes: number, reference: Date = new Date()) => {
  const leadMs = Math.max(0, leadMinutes) * 60000;
  let occurrence = PrayerTimeCalculator.getUpcomingOccurrence(prayer, reference);
  let notifyTime = new Date(occurrence.getTime() - leadMs);

  if (notifyTime.getTime() <= reference.getTime()) {
    const afterOccurrence = new Date(occurrence.getTime() + 60000);
    occurrence = PrayerTimeCalculator.getUpcomingOccurrence(prayer, afterOccurrence);
    notifyTime = new Date(occurrence.getTime() - leadMs);
  }

  return { notifyTime, occurrence };
};

const scheduleNotificationForPrayer = (prayer: PrayerTime) => {
  if (!notificationsActive) {
    return;
  }

  const enabledSet = notificationPreferences.enabledPrayers;

  if (enabledSet && enabledSet.size === 0) {
    return;
  }

  if (enabledSet && !enabledSet.has(prayer.name)) {
    return;
  }

  const now = new Date();
  const { notifyTime } = getNotificationSchedule(prayer, notificationPreferences.leadMinutes, now);
  const delay = notifyTime.getTime() - now.getTime();
  const safeDelay = Math.max(1000, delay);

  const timer = setTimeout(() => {
    notificationTimers.delete(timer);

    if (!notificationsActive || !Notification.isSupported()) {
      return;
    }

    const lead = notificationPreferences.leadMinutes;
    const leadText =
      lead > 0 ? `in ${lead} minute${lead === 1 ? '' : 's'} at ${prayer.time}` : `at ${prayer.time}`;

    const notification = new Notification({
      title: 'Prayer Reminder',
      body: `${prayer.name} ${leadText}`,
      silent: false,
    });

    notification.show();
    scheduleNotificationForPrayer(prayer);
  }, safeDelay);

  notificationTimers.add(timer);
};

const refreshNotificationSchedule = (times?: DailyPrayerTimes | null) => {
  if (typeof times !== 'undefined') {
    notificationSchedule = times ?? null;
  }

  clearNotificationTimers();

  if (!notificationsActive || !notificationSchedule || !Notification.isSupported()) {
    return;
  }

  const enabledSet = notificationPreferences.enabledPrayers;
  if (enabledSet && enabledSet.size === 0) {
    return;
  }

  notificationSchedule.prayers.forEach((prayer) => scheduleNotificationForPrayer(prayer));
};

const DEFAULT_LOCATION: Location = {
  latitude: 40.7128,
  longitude: -74.006,
  city: 'New York',
  country: 'USA',
  timezone: 'America/New_York',
};

const DEFAULT_METHOD = 'MuslimWorldLeague';

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
        if (!mainWindow) {
          createWindow();
          return;
        }
        if (mainWindow.isMinimized()) {
          mainWindow.restore();
        }
        mainWindow.show();
        mainWindow.focus();
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

  mainWindow.loadURL(startUrl);

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
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

app.whenReady().then(() => {
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
  }
});

app.on('before-quit', () => {
  if (menuBarRefreshTimer) {
    clearInterval(menuBarRefreshTimer);
    menuBarRefreshTimer = null;
  }
  clearNotificationTimers();
  notificationsActive = false;
  menuBarManager?.destroy();
});

// IPC handlers
ipcMain.handle('calculate-prayer-times', (event, { date, location, method }) => {
  const times = calculatePrayerTimes(new Date(date), location, method);
  const manager = ensureMenuBarManager();
  manager?.update(times);
  refreshNotificationSchedule(times);
  return times;
});

ipcMain.on('tray-open-app', () => {
  const manager = ensureMenuBarManager();
  manager?.hidePopover();
  if (!mainWindow) {
    createWindow();
    return;
  }
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.show();
  mainWindow.focus();
});

ipcMain.on('tray-quit-app', () => {
  app.quit();
});

ipcMain.on('tray-hide', () => {
  const manager = ensureMenuBarManager();
  manager?.hidePopover();
});

ipcMain.on('tray-manage-notifications', () => {
  const manager = ensureMenuBarManager();
  manager?.hidePopover();

  if (!mainWindow) {
    createWindow();
  }

  const targetWindow = mainWindow;

  if (!targetWindow) {
    return;
  }

  if (targetWindow.isMinimized()) {
    targetWindow.restore();
  }
  targetWindow.show();
  targetWindow.focus();

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

ipcMain.on('notifications-configure', (_event, payload) => {
  const { enabled, times, preferences } = payload ?? {};
  notificationsActive = Boolean(enabled);

  if (preferences) {
    const rawLead = Number(preferences.leadMinutes);
    if (Number.isFinite(rawLead)) {
      notificationPreferences.leadMinutes = clampLeadMinutes(rawLead);
    }

    if (Array.isArray(preferences.enabledPrayers)) {
      if (preferences.enabledPrayers.length === 0) {
        notificationPreferences.enabledPrayers = new Set();
      } else {
        const sanitized = preferences.enabledPrayers.filter((name: unknown): name is PrayerName =>
          typeof name === 'string' && ALL_PRAYER_NAMES.includes(name as PrayerName)
        );

        notificationPreferences.enabledPrayers = sanitized.length
          ? new Set(sanitized)
          : new Set();
      }
    } else {
      notificationPreferences.enabledPrayers = null;
    }
  }

  refreshNotificationSchedule(typeof times !== 'undefined' ? times : undefined);
});

// Menu
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
