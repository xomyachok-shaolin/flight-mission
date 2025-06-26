const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    send: (channel, ...args) => ipcRenderer.send(channel, ...args),
    invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
    on: (channel, listener) => {
      ipcRenderer.on(channel, listener);
      // Возвращаем function для отписки, если нужно
      return () => ipcRenderer.removeListener(channel, listener);
    }
  }
});
// Можно добавить другие API, например:
contextBridge.exposeInMainWorld('appVersion', { get: () => ipcRenderer.invoke('getVersion') });
