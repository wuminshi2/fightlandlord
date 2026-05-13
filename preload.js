const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getStoreValue: (key) => ipcRenderer.invoke('store-get', key),
  setStoreValue: (key, value) => ipcRenderer.invoke('store-set', key, value),
  quitApp: () => ipcRenderer.invoke('app-quit'),
  setFullscreen: (fullscreen) => ipcRenderer.invoke('window-set-fullscreen', fullscreen),
  isFullscreen: () => ipcRenderer.invoke('window-is-fullscreen'),
  onMenuAction: (callback) => ipcRenderer.on('menu-action', (event, action) => callback(action))
});
