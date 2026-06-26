// FocusDAW Mastering Desk - 전역 상태 (Zustand)
// 원본 DCLogic 의 UI state(open/curFile/openMenu/eqAdvanced/enabled/vals) + 액션.
// v0.2.0(Phase 1): mock FILES 제거. 실제 디코딩된 파일 큐(files: QueueFile[])와
//   loadFiles/removeFile/clearFiles 액션 추가. curFile 은 큐 인덱스를 가리킨다.
import { create } from 'zustand';
import { DEFAULT_THEME, applyTheme, type ThemeName } from '../theme/themes';
import { DEFAULT_STATE, EQPRESETS, type DeskState, type ModId } from '../desk/data';
import { decodeAudioFile, AudioDecodeError } from '../audio/decoder';
import { buildQueueFile, type QueueFile } from '../audio/queueFile';

type AppState = DeskState & {
  theme: ThemeName;
  // ── 배치 큐 (실제 로딩 파일) ──
  files: QueueFile[];
  importing: boolean;
  importError: string | null;
  // v0.1.4: 중앙 로딩 표시용 진행 카운트
  importTotal: number;
  importDone: number;
  // v0.1.5: 현재 디코딩 중인 파일명(로딩 카드 표시용)
  importCurrentName: string;

  setTheme: (t: ThemeName) => void;
  setOpen: (i: number) => void;
  toggleEnabled: (id: ModId) => void;
  setVal: (fk: string, v: number | string | boolean) => void;
  applyPreset: (name: string) => void;
  setEqNode: (n: number, f: number, g: number) => void;
  toggleAdv: () => void;
  toggleMenu: (name: string) => void;
  closeMenu: () => void;
  prevFile: () => void;
  nextFile: () => void;
  pickFile: (i: number) => void;
  // ── 파일 로딩 ──
  loadFiles: (files: File[] | FileList) => Promise<void>;
  removeFile: (id: string) => void;
  clearFiles: () => void;
};

const clone = (s: DeskState): DeskState => ({
  ...s,
  enabled: { ...s.enabled },
  vals: { ...s.vals },
});

export const useAppStore = create<AppState>((set) => ({
  ...clone(DEFAULT_STATE),
  theme: DEFAULT_THEME,
  files: [],
  importing: false,
  importError: null,
  importTotal: 0,
  importDone: 0,
  importCurrentName: '',

  setTheme: (t) => { applyTheme(t); set({ theme: t }); },
  setOpen: (i) => set({ open: i }),
  toggleEnabled: (id) => set((s) => ({ enabled: { ...s.enabled, [id]: !s.enabled[id] } })),

  setVal: (fk, v) =>
    set((s) => {
      const extra = /^spectral\.[fgq]\d/.test(fk) ? { 'spectral.preset': 'User' } : null;
      return { vals: { ...s.vals, [fk]: v, ...(extra || {}) } };
    }),

  applyPreset: (name) =>
    set((s) => {
      const p = EQPRESETS[name];
      if (!p) return {};
      const patch: Record<string, number | string> = { 'spectral.preset': name };
      for (let n = 0; n < 5; n++) { patch['spectral.f' + n] = p.f[n]; patch['spectral.g' + n] = p.g[n]; patch['spectral.q' + n] = p.q[n]; }
      return { vals: { ...s.vals, ...patch } };
    }),

  setEqNode: (n, f, g) =>
    set((s) => ({ vals: { ...s.vals, ['spectral.f' + n]: f, ['spectral.g' + n]: g, 'spectral.band': String(n + 1), 'spectral.preset': 'User' } })),

  toggleAdv: () => set((s) => ({ eqAdvanced: !s.eqAdvanced })),
  toggleMenu: (name) => set((s) => ({ openMenu: s.openMenu === name ? null : name })),
  closeMenu: () => set({ openMenu: null }),

  prevFile: () => set((s) => (s.files.length === 0 ? {} : { curFile: (s.curFile - 1 + s.files.length) % s.files.length })),
  nextFile: () => set((s) => (s.files.length === 0 ? {} : { curFile: (s.curFile + 1) % s.files.length })),
  pickFile: (i) => set((s) => (i >= 0 && i < s.files.length ? { curFile: i } : {})),

  // 선택된 File 들을 순차 디코딩해 큐에 추가. 진행 중 importing 표시, 실패 항목은 메시지로 수집.
  loadFiles: async (fileList) => {
    const incoming = Array.from(fileList);
    if (incoming.length === 0) return;
    set({ importing: true, importError: null, importTotal: incoming.length, importDone: 0, importCurrentName: incoming[0]?.name ?? '' });
    const added: QueueFile[] = [];
    const errors: string[] = [];
    for (const file of incoming) {
      set({ importCurrentName: file.name });
      try {
        const decoded = await decodeAudioFile(file);
        added.push(buildQueueFile(file, decoded));
      } catch (e) {
        const msg = e instanceof AudioDecodeError ? e.message : 'Decoding failed';
        errors.push(`${file.name}: ${msg}`);
      }
      set((s) => ({ importDone: s.importDone + 1 }));
    }
    set((s) => {
      const wasEmpty = s.files.length === 0;
      const files = [...s.files, ...added];
      return {
        files,
        importing: false,
        importTotal: 0,
        importDone: 0,
        importCurrentName: '',
        importError: errors.length ? errors.join('\n') : null,
        // 빈 큐였다면 첫 추가 파일을 선택, 아니면 현재 선택 유지(범위 보정)
        curFile: wasEmpty && added.length ? s.files.length : Math.min(s.curFile, Math.max(0, files.length - 1)),
      };
    });
  },

  removeFile: (id) =>
    set((s) => {
      const idx = s.files.findIndex((f) => f.id === id);
      if (idx < 0) return {};
      const files = s.files.filter((f) => f.id !== id);
      let curFile = s.curFile;
      if (idx < curFile) curFile -= 1;
      curFile = Math.min(curFile, Math.max(0, files.length - 1));
      return { files, curFile };
    }),

  clearFiles: () => set({ files: [], curFile: 0, importError: null }),
}));
