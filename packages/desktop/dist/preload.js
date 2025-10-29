"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('electron', {
    ipcRenderer: {
        send: (channel, args) => electron_1.ipcRenderer.send(channel, args),
        invoke: (channel, args) => electron_1.ipcRenderer.invoke(channel, args),
        on: (channel, func) => {
            const subscription = (_event, ...args) => func(...args);
            electron_1.ipcRenderer.on(channel, subscription);
            return () => {
                electron_1.ipcRenderer.removeListener(channel, subscription);
            };
        },
    },
    calculatePrayerTimes: (date, location, method) => electron_1.ipcRenderer.invoke('calculate-prayer-times', { date, location, method }),
    configureNotifications: (enabled, times, preferences) => electron_1.ipcRenderer.send('notifications-configure', { enabled, times, preferences }),
});
//# sourceMappingURL=preload.js.map