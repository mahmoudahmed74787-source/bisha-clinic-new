const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  saveFile: (content, defaultName) => ipcRenderer.invoke('save-file', content, defaultName),
  openFile: () => ipcRenderer.invoke('open-file'),
  startServer: (port) => ipcRenderer.invoke('start-server', port),
  stopServer: () => ipcRenderer.invoke('stop-server'),
  getServerStatus: () => ipcRenderer.invoke('get-server-status'),
  printWindow: (htmlContent, options) => ipcRenderer.invoke('print-window', htmlContent, options)
});
