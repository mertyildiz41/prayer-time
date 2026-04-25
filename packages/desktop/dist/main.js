"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const shared_1 = require("@prayer-time/shared");
const MenuBarManager_1 = require("./MenuBarManager");
const notificationConfig_1 = require("./notificationConfig");
const tahajjudTime_1 = require("./tahajjudTime");
const prayerCheckStore_1 = require("./prayerCheckStore");
let mainWindow = null;
let menuBarManager = null;
let menuBarRefreshTimer = null;
const isDev = !electron_1.app.isPackaged;
const prayerNotificationTimers = new Set();
let tahajjudTimer = null;
let notificationsActive = false;
let notificationSchedule = null;
let notificationPreferences = (0, notificationConfig_1.normalizeNotificationConfig)();
let tahajjudPreferences = {
    enabled: false,
    method: 'custom',
    customTime: tahajjudTime_1.DEFAULT_TAHAJJUD_CUSTOM_TIME,
    leadMinutes: 0,
    location: null,
    calculationMethod: 'Diyanet',
};
const MAX_TAHAJJUD_LEAD_MINUTES = 120;
const DEFAULT_LOCATION = {
    latitude: 41.0082,
    longitude: 28.9784,
    city: 'Istanbul',
    country: 'Türkiye',
    timezone: 'Europe/Istanbul',
};
const DEFAULT_METHOD = 'Diyanet';
const isNotifiablePrayer = (name) => {
    return notificationConfig_1.NOTIFIABLE_PRAYER_NAMES.includes(name);
};
const formatLocalDateKey = (value) => {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};
const buildPrayerCheckInRecord = (prayer, occurrence, notifyAt) => {
    return {
        id: `prayer-check-${prayer.name.toLowerCase()}-${occurrence.getTime()}`,
        prayerName: prayer.name,
        prayerTime: prayer.time,
        date: formatLocalDateKey(occurrence),
        occurrenceIso: occurrence.toISOString(),
        notifyAtIso: notifyAt.toISOString(),
    };
};
const clampTahajjudLeadMinutes = (value) => {
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
const sendPrayerCheckStateToWindow = async (targetWindow) => {
    try {
        const state = await (0, prayerCheckStore_1.getPrayerCheckState)();
        if (!targetWindow.isDestroyed() && !targetWindow.webContents.isDestroyed()) {
            targetWindow.webContents.send('prayer-check-state', state);
        }
    }
    catch (error) {
        console.error('Failed to send prayer check state to renderer.', error);
    }
};
const broadcastPrayerCheckState = async () => {
    const windows = electron_1.BrowserWindow.getAllWindows();
    await Promise.all(windows.map(async (window) => {
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
    }));
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
const showDesktopNotification = (title, body, options = {}) => {
    const notification = new electron_1.Notification({
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
                const response = index === 0 ? 'yes' : 'no';
                void (0, prayerCheckStore_1.respondToPrayerCheck)(options.prayerCheckIn.id, response, options.prayerCheckIn)
                    .then(() => broadcastPrayerCheckState())
                    .catch((error) => {
                    console.error('Failed to handle prayer check notification action.', error);
                });
            });
        }
    }
    notification.show();
};
const getPrayerNotificationSchedule = (prayer, variant, minutesOffset, reference = new Date()) => {
    if (variant === 'before') {
        let occurrence = shared_1.PrayerTimeCalculator.getUpcomingOccurrence(prayer, reference);
        let notifyTime = new Date(occurrence.getTime() - minutesOffset * 60 * 1000);
        if (notifyTime.getTime() <= reference.getTime()) {
            occurrence = shared_1.PrayerTimeCalculator.getUpcomingOccurrence(prayer, new Date(occurrence.getTime() + 60 * 1000));
            notifyTime = new Date(occurrence.getTime() - minutesOffset * 60 * 1000);
        }
        return { notifyTime, occurrence };
    }
    let occurrence = shared_1.PrayerTimeCalculator.getOccurrenceForDate(prayer, reference);
    let notifyTime = variant === 'after'
        ? new Date(occurrence.getTime() + minutesOffset * 60 * 1000)
        : new Date(occurrence.getTime());
    if (notifyTime.getTime() <= reference.getTime()) {
        occurrence = shared_1.PrayerTimeCalculator.getUpcomingOccurrence(prayer, reference);
        notifyTime =
            variant === 'after'
                ? new Date(occurrence.getTime() + minutesOffset * 60 * 1000)
                : new Date(occurrence.getTime());
    }
    return { notifyTime, occurrence };
};
const buildPrayerNotificationCopy = (prayer, variant, minutesOffset) => {
    if (variant === 'before') {
        return {
            title: 'Salah Time',
            body: `${prayer.name} begins in ${minutesOffset} minute${minutesOffset === 1 ? '' : 's'} at ${prayer.time}.`,
        };
    }
    if (variant === 'after') {
        return {
            title: 'Salah Time',
            body: `Did you pray ${prayer.name}? It began ${minutesOffset} minute${minutesOffset === 1 ? '' : 's'} ago at ${prayer.time}.`,
        };
    }
    return {
        title: 'Salah Time',
        body: `It is time for ${prayer.name} at ${prayer.time}.`,
    };
};
const schedulePrayerNotificationVariant = (prayer, variant, minutesOffset) => {
    const now = new Date();
    const { notifyTime, occurrence } = getPrayerNotificationSchedule(prayer, variant, minutesOffset, now);
    const delay = Math.max(1000, notifyTime.getTime() - now.getTime());
    const timer = setTimeout(async () => {
        prayerNotificationTimers.delete(timer);
        if (!notificationsActive || !electron_1.Notification.isSupported()) {
            return;
        }
        const copy = buildPrayerNotificationCopy(prayer, variant, minutesOffset);
        if (variant === 'after') {
            const prayerCheckIn = buildPrayerCheckInRecord(prayer, occurrence, notifyTime);
            try {
                await (0, prayerCheckStore_1.queuePrayerCheckPrompt)(prayerCheckIn);
                await broadcastPrayerCheckState();
            }
            catch (error) {
                console.error('Failed to queue desktop prayer check-in.', error);
            }
            showDesktopNotification(copy.title, copy.body, { prayerCheckIn });
        }
        else {
            showDesktopNotification(copy.title, copy.body);
        }
        schedulePrayerNotificationVariant(prayer, variant, minutesOffset);
    }, delay);
    prayerNotificationTimers.add(timer);
};
const refreshPrayerNotificationSchedule = (times) => {
    if (typeof times !== 'undefined') {
        notificationSchedule = times ?? null;
    }
    clearPrayerNotificationTimers();
    if (!notificationsActive || !notificationSchedule || !electron_1.Notification.isSupported()) {
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
    if (!notificationsActive || !electron_1.Notification.isSupported() || !tahajjudPreferences.enabled) {
        return;
    }
    const schedule = (0, tahajjudTime_1.computeTahajjudReminderOccurrence)({
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
        if (!notificationsActive || !electron_1.Notification.isSupported() || !tahajjudPreferences.enabled) {
            return;
        }
        const body = tahajjudPreferences.leadMinutes > 0
            ? `Tahajjud begins in ${tahajjudPreferences.leadMinutes} minute${tahajjudPreferences.leadMinutes === 1 ? '' : 's'} at ${schedule.time}.`
            : `It is time for Tahajjud at ${schedule.time}.`;
        showDesktopNotification('Salah Time', body);
        refreshTahajjudSchedule();
    }, delay);
};
const refreshNotificationSchedule = (times) => {
    refreshPrayerNotificationSchedule(times);
    refreshTahajjudSchedule();
};
const calculatePrayerTimes = (date = new Date(), location = DEFAULT_LOCATION, method = DEFAULT_METHOD) => {
    return shared_1.PrayerTimeCalculator.calculatePrayerTimes(date, location, method);
};
const ensureMenuBarManager = () => {
    if (process.platform !== 'darwin') {
        return null;
    }
    if (!menuBarManager) {
        menuBarManager = new MenuBarManager_1.MenuBarManager({
            onShowApp: () => {
                menuBarManager?.hidePopover();
                showMainWindow();
            },
        });
    }
    return menuBarManager;
};
const createWindow = () => {
    mainWindow = new electron_1.BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path_1.default.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
    });
    const startUrl = isDev
        ? 'http://localhost:3000'
        : `file://${path_1.default.join(__dirname, '../build/index.html')}`;
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
electron_1.app.whenReady().then(async () => {
    await (0, prayerCheckStore_1.initializePrayerCheckStore)();
    createWindow();
    bootstrapMenuBar();
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
electron_1.app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
        return;
    }
    showMainWindow();
});
electron_1.app.on('before-quit', () => {
    if (menuBarRefreshTimer) {
        clearInterval(menuBarRefreshTimer);
        menuBarRefreshTimer = null;
    }
    clearPrayerNotificationTimers();
    clearTahajjudTimer();
    notificationsActive = false;
    menuBarManager?.destroy();
});
electron_1.ipcMain.handle('calculate-prayer-times', (_event, { date, location, method }) => {
    const times = calculatePrayerTimes(new Date(date), location, method);
    const manager = ensureMenuBarManager();
    manager?.update(times);
    refreshNotificationSchedule(times);
    return times;
});
electron_1.ipcMain.on('tray-open-app', () => {
    const manager = ensureMenuBarManager();
    manager?.hidePopover();
    showMainWindow();
});
electron_1.ipcMain.on('tray-quit-app', () => {
    electron_1.app.quit();
});
electron_1.ipcMain.on('tray-hide', () => {
    const manager = ensureMenuBarManager();
    manager?.hidePopover();
});
electron_1.ipcMain.on('tray-resize-popover', (_event, height) => {
    if (typeof height !== 'number' || !Number.isFinite(height)) {
        return;
    }
    const manager = ensureMenuBarManager();
    manager?.resizePopover(height);
});
electron_1.ipcMain.on('tray-manage-notifications', () => {
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
    }
    else {
        sendOpen();
    }
});
electron_1.ipcMain.on('notifications-configure', (_event, payload) => {
    notificationsActive = Boolean(payload?.enabled);
    notificationPreferences = (0, notificationConfig_1.normalizeNotificationConfig)(payload?.preferences ?? notificationPreferences);
    const rawTahajjudMethod = payload?.tahajjud?.method;
    const tahajjudMethod = rawTahajjudMethod === 'custom' ||
        rawTahajjudMethod === 'middle' ||
        rawTahajjudMethod === 'lastThird'
        ? rawTahajjudMethod
        : tahajjudPreferences.method;
    tahajjudPreferences = {
        enabled: Boolean(payload?.tahajjud?.enabled),
        method: tahajjudMethod,
        customTime: payload?.tahajjud?.customTime || tahajjudTime_1.DEFAULT_TAHAJJUD_CUSTOM_TIME,
        leadMinutes: clampTahajjudLeadMinutes(Number(payload?.tahajjud?.leadMinutes ?? tahajjudPreferences.leadMinutes)),
        location: payload?.tahajjud?.location ?? null,
        calculationMethod: payload?.tahajjud?.calculationMethod || DEFAULT_METHOD,
    };
    refreshNotificationSchedule(typeof payload?.times !== 'undefined' ? payload.times : undefined);
});
electron_1.ipcMain.handle('prayer-check-state:get', async () => {
    return (0, prayerCheckStore_1.getPrayerCheckState)();
});
electron_1.ipcMain.handle('prayer-check:respond', async (_event, payload) => {
    if (typeof payload?.id !== 'string' || (payload.response !== 'yes' && payload.response !== 'no')) {
        return (0, prayerCheckStore_1.getPrayerCheckState)();
    }
    const state = await (0, prayerCheckStore_1.respondToPrayerCheck)(payload.id, payload.response);
    await broadcastPrayerCheckState();
    return state;
});
const template = [
    {
        label: 'File',
        submenu: [
            {
                label: 'Exit',
                accelerator: 'CmdOrCtrl+Q',
                click: () => {
                    electron_1.app.quit();
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
const menu = electron_1.Menu.buildFromTemplate(template);
electron_1.Menu.setApplicationMenu(menu);
//# sourceMappingURL=main.js.map