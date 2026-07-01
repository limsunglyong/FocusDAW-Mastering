// FocusDAW Mastering Desk - Electron 프리로드
// contextIsolation 환경에서 렌더러에 최소한의 안전한 API만 노출.
// v0.1.5: webUtils.getPathForFile 노출 — Electron 32+ 에서 File.path 가 제거되어,
//         드롭/선택 File 의 실제 디스크 경로는 이 API로만 얻을 수 있음(Working folder 표시용).
const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('focusdaw', {
  isElectron: true,
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
  // File → 절대경로 (브라우저엔 없는 Electron 전용 기능)
  getPathForFile: (file) => {
    try {
      return webUtils.getPathForFile(file) || '';
    } catch {
      return '';
    }
  },
  // 커스텀 타이틀바 윈도우 컨트롤
  win: {
    minimize: () => ipcRenderer.send('win:minimize'),
    toggleMaximize: () => ipcRenderer.send('win:toggle-maximize'),
    close: () => ipcRenderer.send('win:close'),
    // v0.2.14: Transport 패널 펼침/접힘 — main의 최초 실제 창 크기 기준
    setTransport: (open) => ipcRenderer.send('win:transport', { open }),
    openPreferences: () => ipcRenderer.send('win:open-preferences'),
    openAbout: () => ipcRenderer.send('win:open-about'),
    // v0.10.1: Release Notes 창 열기(현재 버전 변경 내용).
    openReleaseNotes: () => ipcRenderer.send('win:open-release-notes'),
    openManual: () => ipcRenderer.send('win:open-manual'),
    // v0.9.0: 세션(프로젝트) 창 열기 — mode='save'|'load', payload=현재 직렬화 세션, theme=현재 테마.
    openSessions: (opts) => ipcRenderer.send('win:open-sessions', opts),
    // v0.9.1: Render Batch 창 열기(모달). theme=현재 테마.
    openRenderBatch: (opts) => ipcRenderer.send('win:open-render-batch', opts),
    getRenderBatchTheme: () => ipcRenderer.invoke('render-batch:get-theme'),
    setTheme: (theme) => ipcRenderer.send('win:set-theme', theme),
    // v0.9.1: 메인 창 흐림(dim) 토글 수신 — Render Batch 등 모달 창 표시 중.
    onDim: (callback) => {
      const listener = (_event, on) => callback(!!on);
      ipcRenderer.on('win:dim', listener);
      return () => ipcRenderer.removeListener('win:dim', listener);
    },
    onThemeUpdated: (callback) => {
      const listener = (_event, theme) => callback(theme);
      ipcRenderer.on('win:theme-updated', listener);
      return () => {
        ipcRenderer.removeListener('win:theme-updated', listener);
      };
    },
  },
  // v0.10.0 (Phase 9): 자동 업데이트 상태 수신 + 재시작/재확인.
  updater: {
    onStatus: (callback) => {
      const listener = (_event, status) => callback(status);
      ipcRenderer.on('updater:status', listener);
      return () => ipcRenderer.removeListener('updater:status', listener);
    },
    restart: () => ipcRenderer.send('updater:restart'),
    check: () => ipcRenderer.send('updater:check'),
    download: () => ipcRenderer.send('updater:download'),
  },

  // v0.4.0: User EQ Preset disk storage handlers (cache-proof)
  loadUserPresets: () => ipcRenderer.invoke('win:load-user-presets'),
  saveUserPresets: (presets) => ipcRenderer.invoke('win:save-user-presets', presets),
  loadGraphicUserPresets: () => ipcRenderer.invoke('win:load-graphic-user-presets'),
  saveGraphicUserPresets: (presets) => ipcRenderer.invoke('win:save-graphic-user-presets', presets),

  // v0.9.0: 세션(프로젝트) 저장/불러오기 IO + 적용 릴레이
  sessionIO: {
    getContext: () => ipcRenderer.invoke('session:get-context'),
    list: () => ipcRenderer.invoke('session:list'),
    read: (id) => ipcRenderer.invoke('session:read', id),
    save: (arg) => ipcRenderer.invoke('session:save', arg),
    delete: (id) => ipcRenderer.invoke('session:delete', id),
    apply: (payload) => ipcRenderer.invoke('session:apply', payload),
    // 세션 창이 이미 열려 있을 때 mode/payload 갱신 통지.
    onContextUpdated: (callback) => {
      const listener = (_event, ctx) => callback(ctx);
      ipcRenderer.on('session:context-updated', listener);
      return () => ipcRenderer.removeListener('session:context-updated', listener);
    },
    // 메인 창에서 불러온 세션 payload 적용 통지를 수신.
    onApply: (callback) => {
      const listener = (_event, payload) => callback(payload);
      ipcRenderer.on('session:apply', listener);
      return () => ipcRenderer.removeListener('session:apply', listener);
    },
  },

  // v0.8.0 (Phase 7): Export 파일 저장 IO
  exportIO: {
    defaultDir: () => ipcRenderer.invoke('export:default-dir'),
    pickDir: () => ipcRenderer.invoke('export:pick-dir'),
    saveFile: (dir, filename, bytes, overwrite) =>
      ipcRenderer.invoke('export:save-file', { dir, filename, bytes, overwrite: !!overwrite }),
    reveal: (target) => ipcRenderer.invoke('export:reveal', target),
    openFolder: (target) => ipcRenderer.invoke('export:open-folder', target),
  },
});
