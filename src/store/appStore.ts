// FocusDAW Mastering Desk v0.1.1 (Phase 0 UI) - 전역 상태 (Zustand)
// 원본 DCLogic 의 state(open/curFile/openMenu/eqAdvanced/enabled/vals)를 그대로 보유 + 액션.
import { create } from 'zustand';
import { DEFAULT_THEME, applyTheme, type ThemeName } from '../theme/themes';
import { DEFAULT_STATE, EQPRESETS, FILES, type DeskState, type ModId } from '../desk/data';

type AppState = DeskState & {
  theme: ThemeName;
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
};

const clone = (s: DeskState): DeskState => ({
  ...s,
  enabled: { ...s.enabled },
  vals: { ...s.vals },
});

export const useAppStore = create<AppState>((set) => ({
  ...clone(DEFAULT_STATE),
  theme: DEFAULT_THEME,

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

  prevFile: () => set((s) => ({ curFile: (s.curFile - 1 + FILES.length) % FILES.length })),
  nextFile: () => set((s) => ({ curFile: (s.curFile + 1) % FILES.length })),
  pickFile: (i: number) => set({ curFile: i }),
}));
