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
    configureNotifications: (enabled, times, preferences, tahajjud) => electron_1.ipcRenderer.send('notifications-configure', { enabled, times, preferences, tahajjud }),
    getPrayerCheckState: () => electron_1.ipcRenderer.invoke('prayer-check-state:get'),
    respondToPrayerCheck: (id, response) => electron_1.ipcRenderer.invoke('prayer-check:respond', { id, response }),
});
//# sourceMappingURL=preload.js.map