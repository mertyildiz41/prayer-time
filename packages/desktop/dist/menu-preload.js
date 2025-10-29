"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('tray', {
    openApp: () => electron_1.ipcRenderer.send('tray-open-app'),
    manageNotifications: () => electron_1.ipcRenderer.send('tray-manage-notifications'),
    quitApp: () => electron_1.ipcRenderer.send('tray-quit-app'),
    hidePopover: () => electron_1.ipcRenderer.send('tray-hide'),
});
//# sourceMappingURL=menu-preload.js.map