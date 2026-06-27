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
  },
});
