const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  saveFile: (c, d) => ipcRenderer.invoke('save-file', c, d),
  openFile: () => ipcRenderer.invoke('open-file'),
  startServer: (p) => ipcRenderer.invoke('start-server', p),
  stopServer: () => ipcRenderer.invoke('stop-server'),
  getServerStatus: () => ipcRenderer.invoke('get-server-status')
});
