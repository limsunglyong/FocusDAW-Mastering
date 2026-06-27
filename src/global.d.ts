// FocusDAW Mastering Desk v0.1.0 (Phase 0) - preload 노출 API 타입
export {};

declare global {
  interface Window {
    focusdaw?: {
      isElectron: boolean;
      platform: string;
      versions: { electron: string; chrome: string; node: string };
      /** v0.1.5: File → 절대경로 (Electron webUtils). 브라우저에선 미정의. */
      getPathForFile?: (file: File) => string;
      win: {
        minimize: () => void;
        toggleMaximize: () => void;
        close: () => void;
        /** v0.2.13: Transport 패널 펼침/접힘 시 윈도우 크기를 절대값으로 설정(가로 드리프트 방지). */
        setTransport: (open: boolean, panelH: number) => void;
      };
    };
  }
}
