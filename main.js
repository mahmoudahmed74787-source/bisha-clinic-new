const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const express = require('express');
const cors = require('cors');

let mainWindow = null;
let serverInstance = null;
let serverPort = 5000;
let serverRunning = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400, 
    height: 900,
    title: 'مركز بيشة عامر للجراحة',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    autoHideMenuBar: true,
    show: false
  });
  
  // هنا التعديل: بيقرأ ملف index.html من غير مجلد renderer
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  
  mainWindow.once('ready-to-show', () => mainWindow.show());
  
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) shell.openExternal(url);
    return { action: 'deny' };
  });
}

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return '127.0.0.1';
}

async function startSyncServer(port) {
  if (serverInstance) return { success: true, alreadyRunning: true, port: serverPort, ip: getLocalIP() };

  const dataDir = path.join(app.getPath('userData'), 'sync-data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  const dataFile = path.join(dataDir, 'database.json');

  const serverApp = express();
  serverApp.use(cors({ origin: '*' }));
  serverApp.use(express.json({ limit: '100mb' }));

  serverApp.get('/sync', (req, res) => {
    try {
      if (fs.existsSync(dataFile)) res.json(JSON.parse(fs.readFileSync(dataFile, 'utf-8')));
      else res.json({});
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  serverApp.post('/sync', (req, res) => {
    try {
      fs.writeFileSync(dataFile, JSON.stringify(req.body, null, 2), 'utf-8');
      res.json({ success: true, timestamp: Date.now() });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  serverApp.get('/status', (req, res) => {
    res.json({ status: 'online', port: serverPort, ip: getLocalIP(), version: '1.0.0' });
  });

  return new Promise((resolve) => {
    try {
      serverInstance = serverApp.listen(port, '0.0.0.0', () => {
        serverRunning = true;
        serverPort = port;
        resolve({ success: true, port, ip: getLocalIP() });
      });
      serverInstance.on('error', (err) => resolve({ success: false, error: err.message }));
    } catch (e) { resolve({ success: false, error: e.message }); }
  });
}

function stopSyncServer() {
  if (serverInstance) { serverInstance.close(); serverInstance = null; serverRunning = false; }
  return { success: true };
}

ipcMain.handle('save-file', async (event, content, defaultName) => {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultName,
    filters: [{ name: 'JSON Database', extensions: ['json'] }]
  });
  if (canceled || !filePath) return null;
  fs.writeFileSync(filePath, content, 'utf-8');
  return filePath;
});

ipcMain.handle('open-file', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'JSON Database', extensions: ['json'] }]
  });
  if (canceled || !filePaths[0]) return null;
  return fs.readFileSync(filePaths[0], 'utf-8');
});

ipcMain.handle('start-server', (event, port) => startSyncServer(port || 5000));
ipcMain.handle('stop-server', () => stopSyncServer());
ipcMain.handle('get-local-ip', () => getLocalIP());
ipcMain.handle('get-server-status', () => ({
  running: serverRunning, port: serverPort, ip: serverRunning ? getLocalIP() : null
}));

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  stopSyncServer();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
