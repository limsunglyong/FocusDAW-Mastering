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
        /** v0.9.0: 세션(프로젝트) 창 열기. */
        openSessions?: (opts: { mode: 'save' | 'load'; payload?: unknown; theme?: string }) => void;
        /** v0.9.1: Render Batch 창 열기(모달). */
        openRenderBatch?: (opts: { theme?: string }) => void;
        getRenderBatchTheme?: () => Promise<string | null>;
        setTheme?: (theme: string) => void;
        /** v0.9.1: 메인 창 흐림(dim) 토글 수신. */
        onDim?: (callback: (on: boolean) => void) => () => void;
        onThemeUpdated?: (callback: (theme: string) => void) => () => void;
      };
      // v0.10.0 (Phase 9): 자동 업데이트 상태 수신 + 재시작/재확인.
      updater?: {
        onStatus: (
          callback: (status: {
            state: 'checking' | 'available' | 'not-available' | 'progress' | 'downloaded' | 'error';
            version?: string;
            percent?: number;
            message?: string;
          }) => void,
        ) => () => void;
        restart: () => void;
        check: () => void;
      };
      // v0.4.0: User EQ Preset disk storage handlers (cache-proof)
      loadUserPresets?: () => Promise<any>;
      saveUserPresets?: (presets: any) => Promise<boolean>;
      // v0.9.0: 세션(프로젝트) 저장/불러오기 IO
      sessionIO?: {
        getContext: () => Promise<{ mode: 'save' | 'load'; payload: import('./session/session').SessionPayload | null; theme: string | null }>;
        list: () => Promise<import('./session/session').SessionSummary[]>;
        read: (id: string) => Promise<import('./session/session').SessionFile | null>;
        save: (arg: { id?: string; name: string; description?: string; payload: import('./session/session').SessionPayload; appVersion?: string }) => Promise<{ ok: boolean; id?: string; error?: string }>;
        delete: (id: string) => Promise<{ ok: boolean; error?: string }>;
        apply: (payload: import('./session/session').SessionPayload) => Promise<{ ok: boolean; error?: string }>;
        onContextUpdated: (callback: (ctx: { mode: 'save' | 'load'; payload: import('./session/session').SessionPayload | null; theme: string | null }) => void) => () => void;
        onApply: (callback: (payload: import('./session/session').SessionPayload) => void) => () => void;
      };
      // v0.8.0 (Phase 7): Export 파일 저장 IO
      exportIO?: {
        defaultDir: () => Promise<string>;
        pickDir: () => Promise<string | null>;
        saveFile: (dir: string, filename: string, bytes: Uint8Array, overwrite?: boolean) => Promise<{ ok: boolean; path?: string; error?: string }>;
        reveal: (target: string) => Promise<boolean>;
        openFolder: (target: string) => Promise<{ ok: boolean; error?: string }>;
      };
    };
  }
}
