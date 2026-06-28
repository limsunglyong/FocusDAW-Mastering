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
        /** v0.2.14: Transport 패널 펼침/접힘 시 최초 실제 창 폭을 유지하고 높이만 변경. */
        setTransport: (open: boolean) => void;
        openPreferences?: () => void;
        openAbout?: () => void;
        openManual?: () => void;
        setTheme?: (theme: string) => void;
        onThemeUpdated?: (callback: (theme: string) => void) => () => void;
      };
      // v0.4.0: User EQ Preset disk storage handlers (cache-proof)
      loadUserPresets?: () => Promise<any>;
      saveUserPresets?: (presets: any) => Promise<boolean>;
      // v0.8.0 (Phase 7): Export 파일 저장 IO
      exportIO?: {
        defaultDir: () => Promise<string>;
        pickDir: () => Promise<string | null>;
        saveFile: (dir: string, filename: string, bytes: Uint8Array, overwrite?: boolean) => Promise<{ ok: boolean; path?: string; error?: string }>;
        reveal: (target: string) => Promise<boolean>;
      };
    };
  }
}
