// FocusDAW Mastering Desk v0.1.0 (Phase 0) - preload 노출 API 타입
export {};

declare global {
  interface Window {
    focusdaw?: {
      isElectron: boolean;
      platform: string;
      versions: { electron: string; chrome: string; node: string };
      win: {
        minimize: () => void;
        toggleMaximize: () => void;
        close: () => void;
      };
    };
  }
}
