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
    width: 1400, height: 900,
    title: 'مركز بيشة عامر للجراحة',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    autoHideMenuBar: true,
    show: false
  });
  // هنا التعديل: هيقرأ ملف index.html من غير مجلد
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());
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
  if (serverInstance) return { success: true, port: serverPort, ip: getLocalIP() };
  const dataDir = path.join(app.getPath('userData'), 'sync-data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  const dataFile = path.join(dataDir, 'database.json');

  const serverApp = express();
  serverApp.use(cors({ origin: '*' }));
  serverApp.use(express.json({ limit: '100mb' }));

  serverApp.get('/sync', (req, res) => {
    try { res.json(fs.existsSync(dataFile) ? JSON.parse(fs.readFileSync(dataFile, 'utf-8')) : {}); } 
    catch (e) { res.status(500).json({ error: e.message }); }
  });

  serverApp.post('/sync', (req, res) => {
    try { fs.writeFileSync(dataFile, JSON.stringify(req.body, null, 2), 'utf-8'); res.json({ success: true }); } 
    catch (e) { res.status(500).json({ error: e.message }); }
  });

  return new Promise((resolve) => {
    serverInstance = serverApp.listen(port, '0.0.0.0', () => {
      serverRunning = true; serverPort = port;
      resolve({ success: true, port, ip: getLocalIP() });
    });
  });
}

ipcMain.handle('save-file', async (e, content, defaultName) => {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, { defaultPath: defaultName });
  if (!canceled && filePath) { fs.writeFileSync(filePath, content, 'utf-8'); return filePath; }
  return null;
});
ipcMain.handle('open-file', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow);
  if (!canceled && filePaths[0]) return fs.readFileSync(filePaths[0], 'utf-8');
  return null;
});
ipcMain.handle('start-server', (e, p) => startSyncServer(p || 5000));
ipcMain.handle('stop-server', () => { if (serverInstance) { serverInstance.close(); serverInstance = null; } return { success: true }; });
ipcMain.handle('get-server-status', () => ({ running: serverRunning, port: serverPort, ip: serverRunning ? getLocalIP() : null }));

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
