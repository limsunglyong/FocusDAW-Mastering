// FocusDAW Mastering Desk v0.1.0 - Electron 메인 프로세스 (Phase 0)
// borderless(frame:false) 윈도우 + 커스텀 타이틀바. 개발: Vite dev 서버 / 배포: dist/index.html.
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');

const DEV_SERVER_URL = process.env.ELECTRON_START_URL || 'http://localhost:5173';
const isDev = !app.isPackaged;

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1100,
    minHeight: 720,
    frame: false, // borderless — 커스텀 타이틀바 사용
    backgroundColor: '#0c0f12', // page (dc.html 기본 배경)
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow?.show());

  // 외부 링크(폰트 CDN 등)는 기본 브라우저로
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev) {
    mainWindow.loadURL(DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 커스텀 타이틀바 윈도우 컨트롤 (borderless 이므로 IPC로 처리)
ipcMain.on('win:minimize', () => mainWindow?.minimize());
ipcMain.on('win:toggle-maximize', () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcMain.on('win:close', () => mainWindow?.close());

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
