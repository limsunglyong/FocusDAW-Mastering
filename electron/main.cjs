const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');

const DEV_SERVER_URL = process.env.ELECTRON_START_URL || 'http://localhost:5173';
const isDev = !app.isPackaged;

// v0.2.13: 기준 윈도우 크기(고정). Transport 패널 펼침 시 높이만 절대값으로 변경한다.
const BASE_W = 1208;
const BASE_H = 662;

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: BASE_W,
    height: BASE_H,
    minWidth: 1100,
    minHeight: BASE_H,
    frame: false,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    backgroundColor: '#0c0f12',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow?.show());

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev) {
    mainWindow.loadURL(DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

ipcMain.on('win:minimize', () => mainWindow?.minimize());
ipcMain.on('win:toggle-maximize', () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcMain.on('win:close', () => mainWindow?.close());
// v0.2.13: Transport 패널 펼침/접힘 — 기준 크기에서 절대값으로 setSize.
//   (v0.2.12의 getBounds→setBounds 상대 방식은 DPI 배율에서 가로폭이 매번 누적 축소되는 드리프트가 있었음)
//   가로는 항상 BASE_W 로 고정, 높이만 BASE_H(±패널)로 설정 → 읽기 누적 없음.
ipcMain.on('win:transport', (_e, payload) => {
  if (!mainWindow) return;
  const open = !!(payload && payload.open);
  const panelH = payload && typeof payload.panelH === 'number' && isFinite(payload.panelH) ? Math.round(payload.panelH) : 0;
  mainWindow.setSize(BASE_W, BASE_H + (open ? panelH : 0));
});

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
