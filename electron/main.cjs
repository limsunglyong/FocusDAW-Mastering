const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
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

  mainWindow.once('ready-to-show', async () => {
    if (!mainWindow) return;
    // 로컬 웹폰트가 실제 레이아웃에 적용된 뒤 창을 표시해 시작 시 font swap을 숨긴다.
    try {
      await mainWindow.webContents.executeJavaScript('document.fonts.ready.then(() => true)');
    } catch {
      // 폰트 대기 실패가 앱 실행 자체를 막지는 않도록 기존 표시 경로를 계속 진행한다.
    }
    if (!mainWindow || mainWindow.isDestroyed()) return;
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
// v0.9.0: 세션(프로젝트) 저장/불러오기 창 + 열림 컨텍스트(메인 창에서 전달한 mode/payload/theme).
let sessionsWindow = null;
let sessionContext = { mode: 'load', payload: null, theme: null };
const SESSIONS_W = 920;
const SESSIONS_H = 600;


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
    parent: undefined,
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

// v0.9.1: Render Batch 창 열기(모달 — 메인 앱 사용 차단). 세션 기반 일괄 Export.
let renderBatchWindow = null;
let renderBatchTheme = null;
const RENDER_BATCH_W = 880;
const RENDER_BATCH_H = 640;
ipcMain.on('win:open-render-batch', (event, opts) => {
  renderBatchTheme = (opts && opts.theme) || null;
  if (renderBatchWindow) {
    renderBatchWindow.focus();
    return;
  }
  const parentWindow = BrowserWindow.fromWebContents(event.sender) || mainWindow;
  let x;
  let y;
  if (parentWindow) {
    const b = parentWindow.getBounds();
    x = Math.round(b.x + (b.width - RENDER_BATCH_W) / 2);
    y = Math.round(b.y + (b.height - RENDER_BATCH_H) / 2);
  }
  const iconPath = path.join(__dirname, '..', 'assets', 'logo-main2.png');
  renderBatchWindow = new BrowserWindow({
    width: RENDER_BATCH_W,
    height: RENDER_BATCH_H,
    minWidth: 760,
    minHeight: 560,
    x,
    y,
    parent: parentWindow || undefined,
    modal: true, // 요구사항 7: Render Batch 표시 중 메인 앱 사용 차단.
    frame: false,
    resizable: true,
    maximizable: false,
    fullscreenable: false,
    backgroundColor: '#f3eede',
    show: false,
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  renderBatchWindow.once('ready-to-show', () => {
    renderBatchWindow?.show();
    // 메인 창을 흐리게(dim) — Render Batch 표시 중 시각적 비활성 처리.
    mainWindow?.webContents.send('win:dim', true);
  });
  if (isDev) {
    renderBatchWindow.loadURL(DEV_SERVER_URL + '#renderbatch');
  } else {
    renderBatchWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { hash: 'renderbatch' });
  }
  renderBatchWindow.on('closed', () => {
    renderBatchWindow = null;
    mainWindow?.webContents.send('win:dim', false);
  });
});
ipcMain.handle('render-batch:get-theme', async () => renderBatchTheme);

// v0.9.0: 세션(프로젝트) 창 열기. mode='save'|'load', payload=현재 직렬화 세션(저장용), theme=현재 테마.
ipcMain.on('win:open-sessions', (event, opts) => {
  sessionContext = {
    mode: (opts && opts.mode) === 'save' ? 'save' : 'load',
    payload: (opts && opts.payload) || null,
    theme: (opts && opts.theme) || null,
  };
  if (sessionsWindow) {
    sessionsWindow.webContents.send('session:context-updated', sessionContext);
    sessionsWindow.focus();
    return;
  }

  const parentWindow = BrowserWindow.fromWebContents(event.sender) || mainWindow;
  let x;
  let y;
  if (parentWindow) {
    const b = parentWindow.getBounds();
    x = Math.round(b.x + (b.width - SESSIONS_W) / 2);
    y = Math.round(b.y + (b.height - SESSIONS_H) / 2);
  }

  const iconPath = path.join(__dirname, '..', 'assets', 'logo-main2.png');
  sessionsWindow = new BrowserWindow({
    width: SESSIONS_W,
    height: SESSIONS_H,
    x,
    y,
    parent: undefined,
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

  sessionsWindow.once('ready-to-show', () => sessionsWindow?.show());

  if (isDev) {
    sessionsWindow.loadURL(DEV_SERVER_URL + '#sessions');
  } else {
    sessionsWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { hash: 'sessions' });
  }

  sessionsWindow.on('closed', () => {
    sessionsWindow = null;
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

// v0.9.0: 세션(프로젝트) 저장/불러오기 IO. userData/sessions/<id>.json 한 파일 = 세션 1건.
function sessionsDir() {
  const dir = path.join(app.getPath('userData'), 'sessions');
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  } catch (err) {
    console.error('Failed to ensure sessions dir:', err);
  }
  return dir;
}

// 세션 창이 mount 시 호출 — 열림 모드/직렬화 payload/테마를 전달.
ipcMain.handle('session:get-context', async () => sessionContext);

// 목록(요약만) — 아트워크 base64 는 제외하고 hasArtwork 플래그만 반환(경량화).
ipcMain.handle('session:list', async () => {
  const dir = sessionsDir();
  const out = [];
  try {
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.json')) continue;
      try {
        const data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
        const p = (data && data.payload) || {};
        const v = p.vals || {};
        out.push({
          id: data.id || f.replace(/\.json$/, ''),
          name: data.name || '(untitled)',
          description: data.description || '',
          savedAt: data.savedAt || 0,
          appVersion: data.appVersion || '',
          enabled: p.enabled || {},
          denoise: !!v['pre.denoise'] && (p.enabled ? p.enabled.pre !== false : true),
          eqPreset: v['spectral.preset'] || '—',
          lufs: typeof v['loudness.target'] === 'number' ? v['loudness.target'] : null,
          format: v['export.format'] || '—',
          rate: v['input.rate'] || '—',
          bit: v['input.bit'] || '—',
          hasArtwork: !!p.artworkDataUrl,
          exportDir: p.exportDir || null,
          album: v['export.album'] || '',
        });
      } catch (err) {
        console.error('Failed to parse session file:', f, err);
      }
    }
  } catch (err) {
    console.error('Failed to list sessions:', err);
  }
  out.sort((a, b) => b.savedAt - a.savedAt);
  return out;
});

// 단일 세션 전체(payload 포함, 아트워크 포함) — 불러오기 적용용.
ipcMain.handle('session:read', async (_event, id) => {
  if (!id) return null;
  const file = path.join(sessionsDir(), `${String(id).replace(/[^a-zA-Z0-9_-]/g, '')}.json`);
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    console.error('Failed to read session:', err);
  }
  return null;
});

// 저장(신규/덮어쓰기). id 가 없으면 새로 생성. name 은 표시명.
ipcMain.handle('session:save', async (_event, payloadArg) => {
  const name = (payloadArg && payloadArg.name ? String(payloadArg.name) : '').trim() || 'Untitled Session';
  const description = payloadArg && payloadArg.description ? String(payloadArg.description) : '';
  const payload = (payloadArg && payloadArg.payload) || null;
  if (!payload) return { ok: false, error: 'Empty session payload.' };
  const id = (payloadArg && payloadArg.id ? String(payloadArg.id).replace(/[^a-zA-Z0-9_-]/g, '') : '')
    || `sess-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
  const file = path.join(sessionsDir(), `${id}.json`);
  const data = { id, name, description, savedAt: Date.now(), appVersion: (payloadArg && payloadArg.appVersion) || '', payload };
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
    return { ok: true, id };
  } catch (err) {
    console.error('Failed to save session:', err);
    return { ok: false, error: String(err && err.message ? err.message : err) };
  }
});

ipcMain.handle('session:delete', async (_event, id) => {
  if (!id) return { ok: false };
  const file = path.join(sessionsDir(), `${String(id).replace(/[^a-zA-Z0-9_-]/g, '')}.json`);
  try {
    if (fs.existsSync(file)) fs.unlinkSync(file);
    return { ok: true };
  } catch (err) {
    console.error('Failed to delete session:', err);
    return { ok: false, error: String(err && err.message ? err.message : err) };
  }
});

// 불러온 세션 payload 를 메인 창에 적용(렌더러 간 릴레이). 메인 창이 applySession 을 수행.
ipcMain.handle('session:apply', async (_event, payload) => {
  if (!mainWindow) return { ok: false, error: 'Main window is not available.' };
  mainWindow.webContents.send('session:apply', payload);
  return { ok: true };
});

// v0.8.0 (Phase 7): Export 파일 저장 IO (단계 7-D)
// 기본 Destination = <Music>/Masters. 사용자 선택 폴더 다이얼로그 + 디렉터리 보장 + 파일 쓰기.
ipcMain.handle('export:default-dir', async () => {
  const base = app.getPath('music') || app.getPath('home');
  return path.join(base, 'Masters');
});

ipcMain.handle('export:pick-dir', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const res = await dialog.showOpenDialog(win, {
    title: 'Choose export destination',
    properties: ['openDirectory', 'createDirectory'],
  });
  if (res.canceled || !res.filePaths.length) return null;
  return res.filePaths[0];
});

// dir 안에 filename 으로 bytes 를 저장한다. overwrite=false 면 중복 시 " (n)" 접미사로 회피.
ipcMain.handle('export:save-file', async (_event, payload) => {
  const { dir, filename, bytes, overwrite } = payload || {};
  try {
    if (!dir || !filename) throw new Error('Missing destination.');
    fs.mkdirSync(dir, { recursive: true });
    let target = path.join(dir, filename);
    if (!overwrite) {
      const ext = path.extname(filename);
      const stem = path.basename(filename, ext);
      let n = 2;
      while (fs.existsSync(target)) {
        target = path.join(dir, `${stem} (${n})${ext}`);
        n++;
      }
    }
    fs.writeFileSync(target, Buffer.from(bytes));
    return { ok: true, path: target };
  } catch (err) {
    console.error('Failed to save export file:', err);
    return { ok: false, error: err && err.message ? err.message : 'Save failed' };
  }
});

// 저장 폴더를 OS 파일탐색기로 연다(Export 완료 후 "Reveal").
ipcMain.handle('export:reveal', async (_event, target) => {
  try {
    if (target) shell.showItemInFolder(target);
    return true;
  } catch {
    return false;
  }
});

// v0.9.1: 폴더를 탐색기로 연다. 폴더가 아직 없으면(기본 Masters/<Album> 미생성 등) 존재하는 상위 폴더를 연다.
ipcMain.handle('export:open-folder', async (_event, target) => {
  try {
    let dir = target ? String(target) : '';
    if (!dir) dir = path.join(app.getPath('music') || app.getPath('home'), 'Masters');
    // 존재하는 가장 가까운 상위 폴더까지 거슬러 올라간다.
    let cur = dir;
    for (let i = 0; i < 8; i++) {
      if (fs.existsSync(cur)) break;
      const parent = path.dirname(cur);
      if (!parent || parent === cur) break;
      cur = parent;
    }
    if (!fs.existsSync(cur)) cur = app.getPath('music') || app.getPath('home');
    const err = await shell.openPath(cur);
    return { ok: !err, error: err || undefined };
  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e) };
  }
});

// v0.10.0 (Phase 9): GitHub 자동 업데이트(electron-updater).
// 기동 시 1회 확인 → 자동 다운로드 → 진행률/완료를 메인 창에 IPC 로 보고(인앱 배너).
// 사용자가 "지금 재시작" 선택 시 quitAndInstall. 개발(미패키징) 모드에서는 건너뛴다.
let updateStarted = false;
function setupAutoUpdater() {
  if (isDev || updateStarted) return;
  updateStarted = true;
  let autoUpdater;
  try {
    ({ autoUpdater } = require('electron-updater'));
  } catch (err) {
    console.error('electron-updater load failed:', err);
    return;
  }
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  const send = (status) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('updater:status', status);
    }
  };

  autoUpdater.on('checking-for-update', () => send({ state: 'checking' }));
  autoUpdater.on('update-available', (info) => send({ state: 'available', version: info && info.version }));
  autoUpdater.on('update-not-available', () => send({ state: 'not-available' }));
  autoUpdater.on('download-progress', (p) => send({ state: 'progress', percent: p && p.percent ? Math.round(p.percent) : 0 }));
  autoUpdater.on('update-downloaded', (info) => send({ state: 'downloaded', version: info && info.version }));
  autoUpdater.on('error', (err) => send({ state: 'error', message: err && err.message ? err.message : String(err) }));

  // 사용자가 배너에서 "지금 재시작" 선택.
  ipcMain.on('updater:restart', () => {
    try {
      autoUpdater.quitAndInstall();
    } catch (err) {
      console.error('quitAndInstall failed:', err);
    }
  });
  // 수동 재확인(선택).
  ipcMain.on('updater:check', () => {
    autoUpdater.checkForUpdates().catch((err) => send({ state: 'error', message: err && err.message ? err.message : String(err) }));
  });

  // 기동 직후 1회 확인.
  autoUpdater.checkForUpdates().catch((err) => {
    console.error('checkForUpdates failed:', err);
    send({ state: 'error', message: err && err.message ? err.message : String(err) });
  });
}

app.whenReady().then(() => {
  createWindow();
  setupAutoUpdater();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
