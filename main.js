const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

// ── Simple JSON store ──────────────────────────────────────
const storePath = path.join(app.getPath('userData'), 'game-data.json');

function readStore() {
  try {
    if (fs.existsSync(storePath)) {
      return JSON.parse(fs.readFileSync(storePath, 'utf-8'));
    }
  } catch (e) { /* corrupted file, use empty */ }
  return {};
}

function writeStore(data) {
  try {
    const dir = path.dirname(storePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(storePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) { /* disk full or permission error */ }
}

// ── IPC handlers ───────────────────────────────────────────
ipcMain.handle('store-get', (_event, key) => {
  const store = readStore();
  return key ? (store[key] ?? null) : store;
});

ipcMain.handle('store-set', (_event, key, value) => {
  const store = readStore();
  store[key] = value;
  writeStore(store);
  return true;
});

ipcMain.handle('app-quit', () => {
  app.quit();
  return true;
});

ipcMain.handle('window-set-fullscreen', (_event, fullscreen) => {
  if (mainWindow) {
    mainWindow.setFullScreen(Boolean(fullscreen));
  }
  return true;
});

ipcMain.handle('window-is-fullscreen', () => {
  return mainWindow ? mainWindow.isFullScreen() : false;
});

// ── Window ─────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 620,
    fullscreen: true,
    title: '斗地主',
    icon: path.join(__dirname, 'assets', 'icons', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    autoHideMenuBar: true,
    backgroundColor: '#1a5c2a'
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
