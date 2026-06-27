const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const DEV_SERVER_URL = process.env.ELECTRON_START_URL || 'http://localhost:5173';
const isDev = !app.isPackaged;

// v0.2.13: 기준 윈도우 크기(고정). Transport 패널 펼침 시 높이만 절대값으로 변경한다.
const BASE_W = 1208;
const BASE_H = 662;
const TRANSPORT_H = 132;

let mainWindow = null;
let baseWindowSize = null;

function createWindow() {
  // v0.4.2: Register app icon (assets/logo-main2.png)
  const iconPath = path.join(__dirname, '..', 'assets', 'logo-main2.png');
  mainWindow = new BrowserWindow({
    width: BASE_W,
    height: BASE_H,
    minWidth: 1100,
    minHeight: BASE_H,
    frame: false,
    // v0.2.14: 처음부터 native resizable 상태로 생성해 Windows/DPI의 최초 경계 재계산을 없앤다.
    // 사용자 수동 리사이즈는 아래 will-resize에서 차단한다.
    resizable: true,
    maximizable: false,
    fullscreenable: false,
    backgroundColor: '#0c0f12',
    show: false,
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once('ready-to-show', () => {
    if (!mainWindow) return;
    // v0.2.14: 창을 표시하기 전에 첫 setSize를 실행해 Windows/DPI의
    // outer bounds 정규화가 사용자에게 보이지 않도록 한다.
    const initialSize = mainWindow.getSize();
    mainWindow.setSize(initialSize[0], initialSize[1]);

    // native bounds 반영이 끝난 뒤 실제 크기를 한 번만 기준으로 저장한다.
    setImmediate(() => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      baseWindowSize = mainWindow.getSize();
      mainWindow.show();
    });
  });

  // 공식 Electron 동작상 will-resize는 수동 리사이즈에서만 발생한다.
  // programmatic setContentSize는 통과시키면서 사용자 가장자리 드래그만 차단한다.
  mainWindow.on('will-resize', (event) => event.preventDefault());

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

let preferencesWindow = null;
const PREFERENCES_W = 900;
const PREFERENCES_H = 480;
let aboutWindow = null;
let manualWindow = null;


ipcMain.on('win:minimize', (event) => {
  BrowserWindow.fromWebContents(event.sender)?.minimize();
});
ipcMain.on('win:toggle-maximize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  if (win.isMaximized()) win.unmaximize();
  else win.maximize();
});
ipcMain.on('win:close', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win === mainWindow) {
    app.quit();
  } else {
    win?.close();
  }
});
// v0.2.14: 최초 실제 outer 크기를 기준으로 width는 고정하고 height만 변경한다.
ipcMain.on('win:transport', (_e, payload) => {
  if (!mainWindow) return;
  const open = !!(payload && payload.open);
  if (!baseWindowSize) baseWindowSize = mainWindow.getSize();
  const [width, height] = baseWindowSize;
  mainWindow.setSize(width, height + (open ? TRANSPORT_H : 0));
});

ipcMain.on('win:open-preferences', (event) => {
  if (preferencesWindow) {
    preferencesWindow.focus();
    return;
  }

  let x = undefined;
  let y = undefined;
  const parentWindow = BrowserWindow.fromWebContents(event.sender) || mainWindow;
  if (parentWindow) {
    const parentBounds = parentWindow.getBounds();
    x = Math.round(parentBounds.x + (parentBounds.width - PREFERENCES_W) / 2);
    y = Math.round(parentBounds.y + (parentBounds.height - PREFERENCES_H) / 2);
  }

  const iconPath = path.join(__dirname, '..', 'assets', 'logo-main2.png');
  preferencesWindow = new BrowserWindow({
    width: PREFERENCES_W,
    height: PREFERENCES_H,
    x: x,
    y: y,
    parent: parentWindow || undefined,
    modal: true,
    frame: false,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    backgroundColor: '#c9c3b8',
    show: false,
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  preferencesWindow.once('ready-to-show', () => {
    preferencesWindow?.show();
  });

  if (isDev) {
    preferencesWindow.loadURL(DEV_SERVER_URL + '#preferences');
  } else {
    preferencesWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { hash: 'preferences' });
  }

  preferencesWindow.on('closed', () => {
    preferencesWindow = null;
  });
});

ipcMain.on('win:open-about', () => {
  if (aboutWindow) {
    aboutWindow.focus();
    return;
  }

  let x = undefined;
  let y = undefined;
  if (mainWindow) {
    const parentBounds = mainWindow.getBounds();
    x = Math.round(parentBounds.x + (parentBounds.width - 420) / 2);
    y = Math.round(parentBounds.y + (parentBounds.height - 370) / 2);
  }

  aboutWindow = new BrowserWindow({
    width: 420,
    height: 370,
    x: x,
    y: y,
    parent: mainWindow || undefined,
    modal: true,
    frame: false,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    backgroundColor: '#c9c3b8',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  aboutWindow.once('ready-to-show', () => {
    aboutWindow?.show();
  });

  if (isDev) {
    aboutWindow.loadURL(DEV_SERVER_URL + '#about');
  } else {
    aboutWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { hash: 'about' });
  }

  aboutWindow.on('closed', () => {
    aboutWindow = null;
  });
});

ipcMain.on('win:open-manual', (event) => {
  if (manualWindow) {
    manualWindow.focus();
    return;
  }

  const parentWindow = BrowserWindow.fromWebContents(event.sender) || mainWindow;
  const width = 1100;
  const height = 760;
  let x;
  let y;
  if (parentWindow) {
    const bounds = parentWindow.getBounds();
    x = Math.round(bounds.x + (bounds.width - width) / 2);
    y = Math.round(bounds.y + (bounds.height - height) / 2);
  }

  const iconPath = path.join(__dirname, '..', 'assets', 'logo-main2.png');
  manualWindow = new BrowserWindow({
    width,
    height,
    minWidth: 880,
    minHeight: 620,
    x,
    y,
    parent: parentWindow || undefined,
    frame: false,
    resizable: true,
    maximizable: true,
    fullscreenable: false,
    backgroundColor: '#26374d',
    show: false,
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  manualWindow.once('ready-to-show', () => manualWindow?.show());

  if (isDev) {
    manualWindow.loadURL(DEV_SERVER_URL + '#manual');
  } else {
    manualWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { hash: 'manual' });
  }

  manualWindow.on('closed', () => {
    manualWindow = null;
  });
});

ipcMain.on('win:set-theme', (event, themeName) => {
  BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send('win:theme-updated', themeName);
  });
});

// v0.4.0: User EQ Preset disk storage handlers (cache-proof)
ipcMain.handle('win:load-user-presets', async () => {
  const filePath = path.join(app.getPath('userData'), 'user-presets.json');
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.error('Failed to load user presets:', err);
  }
  return null;
});

ipcMain.handle('win:save-user-presets', async (_event, presets) => {
  const filePath = path.join(app.getPath('userData'), 'user-presets.json');
  try {
    fs.writeFileSync(filePath, JSON.stringify(presets, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Failed to save user presets:', err);
    return false;
  }
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
