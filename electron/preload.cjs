// FocusDAW Mastering Desk v0.1.0 - Electron 프리로드 (Phase 0)
// contextIsolation 환경에서 렌더러에 최소한의 안전한 API만 노출.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('focusdaw', {
  isElectron: true,
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
  // 커스텀 타이틀바 윈도우 컨트롤
  win: {
    minimize: () => ipcRenderer.send('win:minimize'),
    toggleMaximize: () => ipcRenderer.send('win:toggle-maximize'),
    close: () => ipcRenderer.send('win:close'),
  },
});
