import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('tray', {
  openApp: () => ipcRenderer.send('tray-open-app'),
  manageNotifications: () => ipcRenderer.send('tray-manage-notifications'),
  quitApp: () => ipcRenderer.send('tray-quit-app'),
  hidePopover: () => ipcRenderer.send('tray-hide'),
});
