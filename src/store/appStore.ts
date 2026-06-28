// FocusDAW Mastering Desk - 전역 상태 (Zustand)
// 원본 DCLogic 의 UI state(open/curFile/openMenu/eqAdvanced/enabled/vals) + 액션.
// v0.2.0(Phase 1): mock FILES 제거. 실제 디코딩된 파일 큐(files: QueueFile[])와
//   loadFiles/removeFile/clearFiles 액션 추가. curFile 은 큐 인덱스를 가리킨다.
import { create } from 'zustand';
import { DEFAULT_THEME, applyTheme, type ThemeName } from '../theme/themes';
import { DEFAULT_STATE, EQPRESETS, MODS, type DeskState, type ModId } from '../desk/data';
import { decodeAudioFile, readHeaderMeta, AudioDecodeError, type DecodedAudio } from '../audio/decoder';
import { buildQueueFileFromHeader, applyDecodedMeta, markLufsFailed, type QueueFile } from '../audio/queueFile';
import { previewEngine, type PreviewParams } from '../audio/previewEngine';
import { resampleAudioBuffer, sampleRateFromInputRate } from '../audio/resample';
import { analyzePre, type PreAnalysis } from '../audio/preAnalysis';
import { denoiseBuffer, denoiseKeyOf, getDenoiseRecommendation } from '../audio/denoise';
import { encodeMaster, isSupportedFormat, ExportUnsupportedError } from '../export/exportRunner';
import { baseName } from '../export/wav';

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
  // ── Preview 재생 (v0.2.0 Phase 1) ──
  isPreviewing: boolean;
  previewError: string | null;
  // ── Pre Processing 3D 워터폴 실데이터 분석 (v0.2.25 Phase 2) ──
  preAnalysis: PreAnalysis | null;
  // ── 원본 재생 (v0.2.1 Phase 1 Patch) ──
  isOriginalPlaying: boolean;
  originalPlayError: string | null;
  // ── Transport 패널 (v0.2.11) ──
  transportOpen: boolean;
  volume: number;
  muted: boolean;
  loopEnabled: boolean;
  loopStart: number;
  loopEnd: number;
  // ── 처리 버퍼 리샘플링 (v0.2.3 Phase 1 Patch) ──
  processingAudio: boolean;
  processingMessage: string;
  processingCurrentName: string;
  processingDone: number;
  processingTotal: number;

  // ── Export (v0.8.0 Phase 7) ──
  exporting: boolean;
  exportTotal: number;
  exportDone: number;
  exportCurrentName: string;
  exportError: string | null;
  /** 사용자가 고른 Destination 폴더(절대경로). null 이면 기본 <Music>/Masters/<Album>. */
  exportDir: string | null;
  /** 마지막으로 저장된 파일 경로(완료 후 Reveal 용). */
  exportLastPath: string | null;
  /** Album Artwork 미리보기 dataURL(현재 라운드는 표시 전용 — WAV 미임베드). */
  artworkDataUrl: string | null;

  // v0.4.0: User EQ Presets State
  userPresets: { name: string; f: number[]; g: number[]; q: number[] }[];
  activeUserPresetIdx: number;
  lastActivePresetName: string;

  setTheme: (t: ThemeName) => void;
  setOpen: (i: number) => void;
  toggleEnabled: (id: ModId) => void;
  setVal: (fk: string, v: number | string | boolean) => void;
  applyPreset: (name: string) => void;
  recallUserPreset: (idx: number) => void;
  saveUserPreset: (idx: number) => void;
  renameUserPreset: (idx: number, name: string) => void;
  initUserPresets: () => Promise<void>;
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
  togglePreview: () => Promise<void>;
  stopPreview: () => void;
  syncPreviewParams: () => void;
  /** v0.2.25: Pre 패널이 열렸을 때 선택 파일을 STFT 분석해 워터폴/노이즈 정보를 채운다. */
  analyzePreSelected: () => Promise<void>;
  ensureProcessingBuffer: (id: string) => Promise<AudioBuffer>;
  /** v0.2.28: Denoise 결과 버퍼 확보(lazy·캐시, 처리 오버레이 표시). */
  ensureDenoisedBuffer: (id: string) => Promise<AudioBuffer>;
  /** v0.2.28: 현재 Pre/Denoise 상태에 맞는 재생·분석용 유효 버퍼(denoise on→denoised, off→processing). */
  effectivePlaybackBuffer: (id: string) => Promise<AudioBuffer>;
  /** v0.2.28: Denoise 관련 파라미터 변경 시 분석/재생 버퍼를 디바운스 갱신. */
  refreshDenoise: () => void;
  /** v0.2.8: lazy 디코딩 — 필요 시 원본 버퍼를 확보(없으면 디코딩, LRU=현재 파일만 유지). */
  ensureSourceBuffer: (id: string) => Promise<AudioBuffer>;
  changeInputRate: (rate: string) => Promise<void>;
  toggleOriginalPlayback: () => Promise<void>;
  stopOriginalPlayback: () => void;
  resumeOriginalPlaybackAfterSelection: (resumeSeq: number) => Promise<void>;
  // ── Transport 패널 (v0.2.11) ──
  toggleTransport: () => void;
  setVolume: (v: number) => void;
  toggleMute: () => void;
  seekPreview: (time: number) => void;
  skip: (delta: number) => void;
  setLoopRange: (start: number, end: number) => void;
  toggleLoop: () => void;
  clearLoop: () => void;
  // ── Export (v0.8.0 Phase 7) ──
  setArtwork: (dataUrl: string | null) => void;
  pickExportDir: () => Promise<void>;
  resetExportDir: () => void;
  exportSelected: () => Promise<void>;
  exportBatch: () => Promise<void>;
  cancelExport: () => void;
  revealLastExport: () => void;
};

const clone = (s: DeskState): DeskState => ({
  ...s,
  enabled: { ...s.enabled },
  vals: { ...s.vals },
});

function previewParamsFromState(s: AppState, file: QueueFile): PreviewParams {
  return { vals: s.vals, enabled: s.enabled, meta: file.meta };
}

function invalidateProcessingBuffers(files: QueueFile[]): QueueFile[] {
  return files.map((file) => ({
    ...file,
    processingBuffer: undefined,
    processingSampleRate: undefined,
    // v0.2.28: 처리 버퍼가 무효화되면 그로부터 파생된 denoise 버퍼도 무효화.
    denoisedBuffer: undefined,
    denoiseKey: undefined,
  }));
}

// v0.2.28: Pre 섹션이 켜져 있고 Denoise 토글이 ON 일 때만 denoise 가 적용된다.
function denoiseActive(s: AppState): boolean {
  return !!s.enabled.pre && !!s.vals['pre.denoise'];
}
function currentDenoiseKey(s: AppState): string {
  const rate = sampleRateFromInputRate(s.vals['input.rate']);
  const file = s.files[s.curFile];
  const depth = file?.noiseDepth !== undefined ? String(file.noiseDepth) : String(s.vals['pre.noiseDepth']);
  const amt = file?.denoiseAmt !== undefined ? Number(file.denoiseAmt) : Number(s.vals['pre.denoiseAmt']);
  return denoiseKeyOf(rate, depth, amt);
}

let originalSelectionResumeSeq = 0;

// ── v0.2.8: lazy 디코딩 + 백그라운드 LUFS 측정 ──────────────────────────────
// 같은 파일을 동시에 디코딩하지 않도록 in-flight 프로미스를 공유한다.
const decodeInFlight = new Map<string, Promise<DecodedAudio>>();
function decodeOnce(file: QueueFile): Promise<DecodedAudio> {
  let p = decodeInFlight.get(file.id);
  if (!p) {
    p = decodeAudioFile(file.file).finally(() => decodeInFlight.delete(file.id));
    decodeInFlight.set(file.id, p);
  }
  return p;
}

function updateQueueFile(id: string, fn: (f: QueueFile) => QueueFile) {
  useAppStore.setState((s) => ({ files: s.files.map((f) => (f.id === id ? fn(f) : f)) }));
}

// 백그라운드 측정 큐: 한 곡씩 디코딩→LUFS 측정→버퍼 해제(메모리 일정).
let measureQueue: string[] = [];
let measuring = false;
function enqueueMeasure(id: string, front = false) {
  measureQueue = measureQueue.filter((x) => x !== id);
  if (front) measureQueue.unshift(id);
  else measureQueue.push(id);
}
function dropFromMeasureQueue(id: string) {
  measureQueue = measureQueue.filter((x) => x !== id);
}
async function pumpMeasureQueue() {
  if (measuring) return;
  measuring = true;
  try {
    while (measureQueue.length) {
      const id = measureQueue[0];
      const file = useAppStore.getState().files.find((f) => f.id === id);
      if (!file || file.lufsState === 'done') {
        measureQueue.shift();
        continue;
      }
      if (file.sourceBuffer) {
        // 이미 디코딩됨(선택 등) → 메타가 done 으로 갱신됐을 것이므로 측정 생략.
        measureQueue.shift();
        continue;
      }
      updateQueueFile(id, (f) => ({ ...f, lufsState: 'measuring' }));
      try {
        const decoded = await decodeOnce(file);
        updateQueueFile(id, (f) => applyDecodedMeta(f, decoded, false));
      } catch {
        updateQueueFile(id, (f) => markLufsFailed(f));
      }
      measureQueue.shift();
    }
  } finally {
    measuring = false;
  }
}

// 선택된 파일을 측정 큐 맨 앞으로 올리고 즉시 디코딩(재생/Preview/웨이브폼 준비 + LUFS 채움).
function prioritizeSelectedDecode() {
  const st = useAppStore.getState();
  const sel = st.files[st.curFile];
  if (!sel) {
    useAppStore.setState({ preAnalysis: null });
    return;
  }
  enqueueMeasure(sel.id, true);
  void pumpMeasureQueue();
  if (!sel.sourceBuffer) void st.ensureSourceBuffer(sel.id).catch(() => {});
  // 선택이 바뀌었으면 기존 워터폴 분석을 비우고(엉뚱한 파일 표시 방지) 새로 분석.
  useAppStore.setState({ preAnalysis: null });
  void st.analyzePreSelected();
}

// v0.2.25: 워터폴 분석 stale 가드(선택/Rate 변경으로 진행 중 분석을 폐기).
let preAnalysisSeq = 0;

// v0.2.28: Denoise 재계산 디바운스(노브 드래그 중 thrash 방지) + 재생 중 버퍼 스왑.
let denoiseRefreshTimer: ReturnType<typeof setTimeout> | null = null;
async function swapPlaybackToEffective() {
  const st = useAppStore.getState();
  if (!st.isOriginalPlaying) return;
  const file = st.files[st.curFile];
  if (!file) return;
  const pos = previewEngine.getCurrentTime();
  let buf: AudioBuffer;
  try {
    buf = await st.effectivePlaybackBuffer(file.id);
  } catch {
    return;
  }
  const latest = useAppStore.getState();
  const lf = latest.files[latest.curFile];
  if (!lf || lf.id !== file.id || !latest.isOriginalPlaying) return;
  await previewEngine.play(
    buf,
    previewParamsFromState(latest, lf),
    () => useAppStore.setState({ isOriginalPlaying: false }),
    Math.min(pos, Math.max(0, buf.duration - 0.001)),
    latest.isPreviewing,
  );
}

// ── v0.8.0 (Phase 7): Export 오케스트레이션 ──────────────────────────────
// per-file: effective 버퍼 확보(decode→resample→denoise lazy) → 오프라인 렌더 → 인코딩 → 저장.
// 버퍼는 ensureSourceBuffer 의 LRU=1 정책으로 다음 파일 처리 시 자동 evict 되어 메모리 일정.
let exportCancelled = false;

function sanitizeFolder(name: string): string {
  return (name || '').replace(/[\\/:*?"<>|]/g, '_').trim() || 'Untitled Master';
}

async function resolveExportDir(s: AppState): Promise<string> {
  if (s.exportDir) return s.exportDir;
  const album = sanitizeFolder(String(s.vals['export.album'] || 'Untitled Master'));
  const base = (await window.focusdaw?.exportIO?.defaultDir?.()) || 'Masters';
  return `${base}/${album}`;
}

async function runExport(ids: string[]) {
  const io = window.focusdaw?.exportIO;
  if (!io) {
    useAppStore.setState({ exportError: 'Export is available in the desktop app only.' });
    return;
  }
  const s0 = useAppStore.getState();
  if (ids.length === 0) {
    useAppStore.setState({ exportError: 'Load an audio file before exporting.' });
    return;
  }
  const format = String(s0.vals['export.format']);
  if (!isSupportedFormat(format)) {
    useAppStore.setState({ exportError: `${format} export is not available yet (WAV only in this build).` });
    return;
  }
  // 렌더는 오프라인 컨텍스트지만, 진행 중 버퍼 evict 가 재생을 끊을 수 있으므로 재생을 멈춘다.
  s0.stopPreview();
  s0.stopOriginalPlayback();
  exportCancelled = false;

  const dir = await resolveExportDir(s0);
  const bit = s0.vals['input.bit'];
  useAppStore.setState({ exporting: true, exportError: null, exportTotal: ids.length, exportDone: 0, exportCurrentName: '', exportLastPath: null });

  let lastPath: string | null = null;
  const errors: string[] = [];
  try {
    for (let i = 0; i < ids.length; i++) {
      if (exportCancelled) break;
      const st = useAppStore.getState();
      const file = st.files.find((f) => f.id === ids[i]);
      if (!file) continue;
      useAppStore.setState({ exportCurrentName: file.name, exportDone: i });
      try {
        const buffer = await st.effectivePlaybackBuffer(file.id);
        const params = previewParamsFromState(useAppStore.getState(), file);
        const { bytes, ext } = await encodeMaster(buffer, params, format, bit);
        const filename = `${baseName(file.name)}.${ext}`;
        const res = await io.saveFile(dir, filename, bytes, false);
        if (res.ok && res.path) lastPath = res.path;
        else errors.push(`${file.name}: ${res.error || 'Save failed'}`);
      } catch (e) {
        const msg = e instanceof ExportUnsupportedError ? e.message : e instanceof Error ? e.message : 'Render failed';
        errors.push(`${file.name}: ${msg}`);
      }
    }
    useAppStore.setState({ exportDone: ids.length });
  } finally {
    const cancelled = exportCancelled;
    useAppStore.setState({
      exporting: false,
      exportCurrentName: '',
      exportLastPath: lastPath,
      exportError: errors.length ? errors.join('\n') : cancelled ? 'Export cancelled.' : null,
    });
  }
}

export const useAppStore = create<AppState>((set, get) => ({
  ...clone(DEFAULT_STATE),
  theme: DEFAULT_THEME,
  files: [],
  importing: false,
  importError: null,
  importTotal: 0,
  importDone: 0,
  importCurrentName: '',
  isPreviewing: false,
  previewError: null,
  preAnalysis: null,
  isOriginalPlaying: false,
  originalPlayError: null,
  transportOpen: false,
  volume: 1,
  muted: false,
  loopEnabled: false,
  loopStart: 0,
  loopEnd: 0,
  processingAudio: false,
  processingMessage: '',
  processingCurrentName: '',
  processingDone: 0,
  processingTotal: 0,
  exporting: false,
  exportTotal: 0,
  exportDone: 0,
  exportCurrentName: '',
  exportError: null,
  exportDir: null,
  exportLastPath: null,
  artworkDataUrl: null,
  userPresets: [
    { name: 'User 1', f: [60, 250, 1000, 4000, 12000], g: [0, 0, 0, 0, 0], q: [0.71, 1.0, 1.0, 1.2, 0.71] },
    { name: 'User 2', f: [60, 250, 1000, 4000, 12000], g: [0, 0, 0, 0, 0], q: [0.71, 1.0, 1.0, 1.2, 0.71] },
    { name: 'User 3', f: [60, 250, 1000, 4000, 12000], g: [0, 0, 0, 0, 0], q: [0.71, 1.0, 1.0, 1.2, 0.71] },
    { name: 'User 4', f: [60, 250, 1000, 4000, 12000], g: [0, 0, 0, 0, 0], q: [0.71, 1.0, 1.0, 1.2, 0.71] },
    { name: 'User 5', f: [60, 250, 1000, 4000, 12000], g: [0, 0, 0, 0, 0], q: [0.71, 1.0, 1.0, 1.2, 0.71] }
  ],
  activeUserPresetIdx: -1,
  lastActivePresetName: 'Normal',

  setTheme: (t) => { applyTheme(t); set({ theme: t }); },
  setOpen: (i) => {
    set({ open: i });
    if (MODS[i]?.id === 'pre') void get().analyzePreSelected(); // Pre 패널 열 때 워터폴 분석
  },
  toggleEnabled: (id) => {
    set((s) => ({ enabled: { ...s.enabled, [id]: !s.enabled[id] } }));
    get().syncPreviewParams();
    // v0.2.28: Pre 섹션 On/Bypass 는 denoise 적용 여부(유효 버퍼)를 바꾸므로 분석/재생 갱신.
    if (id === 'pre') get().refreshDenoise();
  },

  setVal: (fk, v) =>
    {
      if (fk === 'input.rate') {
        void get().changeInputRate(String(v));
        return;
      }
      set((s) => {
        const extra = /^spectral\.[fgq]\d/.test(fk) ? { 'spectral.preset': 'User' } : null;
        let activeUserPresetIdx = s.activeUserPresetIdx;
        if (extra && s.vals['spectral.preset'] !== 'User') {
          activeUserPresetIdx = -1;
        }
        const vals = { ...s.vals, [fk]: v, ...(extra || {}) };
        let files = s.files;
        if (fk === 'pre.noiseDepth' || fk === 'pre.denoiseAmt') {
          files = s.files.map((f, idx) => {
            if (idx === s.curFile) {
              const patch: Partial<QueueFile> = {};
              if (fk === 'pre.noiseDepth') patch.noiseDepth = String(v);
              if (fk === 'pre.denoiseAmt') patch.denoiseAmt = Number(v);
              return { ...f, ...patch };
            }
            return f;
          });
        }
        return { vals, files, activeUserPresetIdx };
      });
      get().syncPreviewParams();
      // v0.2.28: Denoise 관련 파라미터는 유효 버퍼를 재계산해야 하므로 디바운스 갱신.
      if (fk === 'pre.denoise' || fk === 'pre.noiseDepth' || fk === 'pre.denoiseAmt') get().refreshDenoise();
    },

  applyPreset: (name) =>
    {
      set((s) => {
        if (name === 'User') {
          return { vals: { ...s.vals, 'spectral.preset': 'User' }, activeUserPresetIdx: -1 };
        }
        const p = EQPRESETS[name];
        if (!p) return {};
        const patch: Record<string, number | string> = { 'spectral.preset': name };
        for (let n = 0; n < 5; n++) { patch['spectral.f' + n] = p.f[n]; patch['spectral.g' + n] = p.g[n]; patch['spectral.q' + n] = p.q[n]; }
        return { vals: { ...s.vals, ...patch }, activeUserPresetIdx: -1, lastActivePresetName: name };
      });
      get().syncPreviewParams();
    },

  recallUserPreset: (idx) => {
    const p = get().userPresets[idx];
    if (!p) return;
    set((state) => {
      const patch: Record<string, number | string> = { 'spectral.preset': 'User' };
      for (let n = 0; n < 5; n++) {
        patch['spectral.f' + n] = p.f[n];
        patch['spectral.g' + n] = p.g[n];
        patch['spectral.q' + n] = p.q[n];
      }
      return { vals: { ...state.vals, ...patch }, activeUserPresetIdx: idx, lastActivePresetName: p.name };
    });
    get().syncPreviewParams();
  },

  saveUserPreset: (idx) => {
    set((state) => {
      const currentPreset = state.userPresets[idx];
      if (!currentPreset) return {};
      const f: number[] = [];
      const g: number[] = [];
      const q: number[] = [];
      for (let n = 0; n < 5; n++) {
        f.push(Number(state.vals['spectral.f' + n]));
        g.push(Number(state.vals['spectral.g' + n]));
        q.push(Number(state.vals['spectral.q' + n]));
      }
      const updatedPresets = state.userPresets.map((p, i) =>
        i === idx ? { ...p, f, g, q } : p
      );
      
      // Persist to Disk & LocalStorage
      void window.focusdaw?.saveUserPresets?.(updatedPresets);
      localStorage.setItem('user_presets', JSON.stringify(updatedPresets));

      return { userPresets: updatedPresets, activeUserPresetIdx: idx, lastActivePresetName: currentPreset.name };
    });
  },

  renameUserPreset: (idx, name) => {
    set((state) => {
      const updatedPresets = state.userPresets.map((p, i) =>
        i === idx ? { ...p, name } : p
      );
      
      // Persist to Disk & LocalStorage
      void window.focusdaw?.saveUserPresets?.(updatedPresets);
      localStorage.setItem('user_presets', JSON.stringify(updatedPresets));

      const isCurrentActive = state.activeUserPresetIdx === idx;
      const extraPatch = isCurrentActive ? { lastActivePresetName: name } : {};

      return { userPresets: updatedPresets, ...extraPatch };
    });
  },

  initUserPresets: async () => {
    try {
      let presets = await window.focusdaw?.loadUserPresets?.();
      if (!presets) {
        const local = localStorage.getItem('user_presets');
        if (local) {
          presets = JSON.parse(local);
        }
      }
      if (presets && Array.isArray(presets) && presets.length === 5) {
        set({ userPresets: presets });
      }
    } catch (err) {
      console.error('Error initializing user presets:', err);
    }
  },

  setEqNode: (n, f, g) =>
    {
      set((s) => {
        let activeUserPresetIdx = s.activeUserPresetIdx;
        if (s.vals['spectral.preset'] !== 'User') {
          activeUserPresetIdx = -1;
        }
        return {
          vals: { ...s.vals, ['spectral.f' + n]: f, ['spectral.g' + n]: g, 'spectral.band': String(n + 1), 'spectral.preset': 'User' },
          activeUserPresetIdx
        };
      });
      get().syncPreviewParams();
    },

  toggleAdv: () => set((s) => ({ eqAdvanced: !s.eqAdvanced })),
  toggleMenu: (name) => set((s) => ({ openMenu: s.openMenu === name ? null : name })),
  closeMenu: () => set({ openMenu: null }),

  prevFile: () => {
    const shouldResumeOriginal = get().isOriginalPlaying;
    const resumeSeq = ++originalSelectionResumeSeq;
    previewEngine.stop();
    previewEngine.setLoop(false, 0, 0);
    set({ isOriginalPlaying: false, loopEnabled: false, loopStart: 0, loopEnd: 0 });
    set((s) => {
      if (s.files.length === 0) return {};
      const nextIdx = (s.curFile - 1 + s.files.length) % s.files.length;
      const file = s.files[nextIdx];
      const vals = { ...s.vals };
      if (file) {
        vals['pre.noiseDepth'] = file.noiseDepth ?? '2';
        vals['pre.denoiseAmt'] = file.denoiseAmt ?? 35;
      }
      return { curFile: nextIdx, vals };
    });
    if (shouldResumeOriginal) void get().resumeOriginalPlaybackAfterSelection(resumeSeq);
    prioritizeSelectedDecode();
  },
  nextFile: () => {
    const shouldResumeOriginal = get().isOriginalPlaying;
    const resumeSeq = ++originalSelectionResumeSeq;
    previewEngine.stop();
    previewEngine.setLoop(false, 0, 0);
    set({ isOriginalPlaying: false, loopEnabled: false, loopStart: 0, loopEnd: 0 });
    set((s) => {
      if (s.files.length === 0) return {};
      const nextIdx = (s.curFile + 1) % s.files.length;
      const file = s.files[nextIdx];
      const vals = { ...s.vals };
      if (file) {
        vals['pre.noiseDepth'] = file.noiseDepth ?? '2';
        vals['pre.denoiseAmt'] = file.denoiseAmt ?? 35;
      }
      return { curFile: nextIdx, vals };
    });
    if (shouldResumeOriginal) void get().resumeOriginalPlaybackAfterSelection(resumeSeq);
    prioritizeSelectedDecode();
  },
  pickFile: (i) => {
    const shouldResumeOriginal = get().isOriginalPlaying;
    const resumeSeq = ++originalSelectionResumeSeq;
    previewEngine.stop();
    previewEngine.setLoop(false, 0, 0);
    set({ isOriginalPlaying: false, loopEnabled: false, loopStart: 0, loopEnd: 0 });
    set((s) => {
      if (i < 0 || i >= s.files.length) return {};
      const file = s.files[i];
      const vals = { ...s.vals };
      if (file) {
        vals['pre.noiseDepth'] = file.noiseDepth ?? '2';
        vals['pre.denoiseAmt'] = file.denoiseAmt ?? 35;
      }
      return { curFile: i, vals };
    });
    if (shouldResumeOriginal) void get().resumeOriginalPlaybackAfterSelection(resumeSeq);
    prioritizeSelectedDecode();
  },

  // v0.2.8: 헤더만 읽어 큐에 추가(풀 디코딩 없음). LUFS 는 백그라운드에서 채우고,
  //   선택 파일은 우선순위로 즉시 디코딩한다. 실패(미지원/읽기오류) 항목은 메시지로 수집.
  loadFiles: async (fileList) => {
    const incoming = Array.from(fileList);
    if (incoming.length === 0) return;
    set({ importing: true, importError: null, importTotal: incoming.length, importDone: 0, importCurrentName: incoming[0]?.name ?? '' });
    const added: QueueFile[] = [];
    const errors: string[] = [];
    for (const file of incoming) {
      set({ importCurrentName: file.name });
      try {
        const hm = await readHeaderMeta(file);
        added.push(buildQueueFileFromHeader(file, hm));
      } catch (e) {
        const msg = e instanceof AudioDecodeError ? e.message : 'Reading failed';
        errors.push(`${file.name}: ${msg}`);
      }
      set((s) => ({ importDone: s.importDone + 1 }));
    }
    set((s) => {
      const wasEmpty = s.files.length === 0;
      const files = [...s.files, ...added];
      const curFileIdx = wasEmpty && added.length ? s.files.length : Math.min(s.curFile, Math.max(0, files.length - 1));
      const firstFile = files[curFileIdx];
      const vals = { ...s.vals };
      if (wasEmpty && firstFile) {
        vals['pre.noiseDepth'] = firstFile.noiseDepth ?? '2';
        vals['pre.denoiseAmt'] = firstFile.denoiseAmt ?? 35;
      }
      return {
        files,
        importing: false,
        importTotal: 0,
        importDone: 0,
        importCurrentName: '',
        importError: errors.length ? errors.join('\n') : null,
        // 빈 큐였다면 첫 추가 파일을 선택, 아니면 현재 선택 유지(범위 보정)
        curFile: curFileIdx,
        vals,
      };
    });
    // 백그라운드 LUFS 측정 등록 + 현재 선택 파일 우선 디코딩
    for (const qf of added) enqueueMeasure(qf.id);
    prioritizeSelectedDecode();
  },

  removeFile: (id) =>
    {
      get().stopPreview();
      get().stopOriginalPlayback();
      previewEngine.setLoop(false, 0, 0);
      dropFromMeasureQueue(id);
      set((s) => {
      const idx = s.files.findIndex((f) => f.id === id);
      if (idx < 0) return {};
      const files = s.files.filter((f) => f.id !== id);
      let curFile = s.curFile;
      if (idx < curFile) curFile -= 1;
      curFile = Math.min(curFile, Math.max(0, files.length - 1));
      return { files, curFile, loopEnabled: false, loopStart: 0, loopEnd: 0, preAnalysis: null };
      });
      void get().analyzePreSelected();
    },

  clearFiles: () => {
    get().stopPreview();
    get().stopOriginalPlayback();
    measureQueue = [];
    previewEngine.setLoop(false, 0, 0);
    set({ files: [], curFile: 0, importError: null, loopEnabled: false, loopStart: 0, loopEnd: 0, preAnalysis: null });
  },

  togglePreview: async () => {
    const s = get();
    if (s.files.length === 0) {
      set({ previewError: 'Load an audio file before preview.' });
      return;
    }
    const enabled = !s.isPreviewing;
    previewEngine.setPreviewEnabled(enabled);
    set({ isPreviewing: enabled, previewError: null });
  },

  stopPreview: () => {
    previewEngine.setPreviewEnabled(false);
    set({ isPreviewing: false });
  },

  syncPreviewParams: () => {
    const s = get();
    const file = s.files[s.curFile];
    if (!file) return;
    previewEngine.update(previewParamsFromState(s, file));
  },

  // v0.2.25: Pre 패널이 열려 있을 때만 선택 파일을 STFT 분석(워터폴 그리드 + noise floor/SNR).
  // 무거운 계산은 Web Worker(analyzePre)에서 수행하며, 선택/Rate 변경 시 stale 결과는 폐기한다.
  analyzePreSelected: async () => {
    const st = get();
    if (MODS[st.open]?.id !== 'pre') return; // Pre 상세 패널이 열렸을 때만 분석
    const file = st.files[st.curFile];
    if (!file) {
      set({ preAnalysis: null });
      return;
    }
    // v0.2.28: Denoise 적용 후 기준으로 표시(P2-4) — denoise on 이면 denoised 버퍼를 분석.
    // dry 는 원본 sourceBuffer 로 분석(resample 생략, 빠른 진입). 주파수 내용은 rate 무관.
    const active = denoiseActive(st);
    const key = `${file.id}:${active ? 'dn:' + currentDenoiseKey(st) : 'dry'}`;
    if (st.preAnalysis?.key === key) return; // 이미 동일 조건으로 분석됨
    const seq = ++preAnalysisSeq;
    let buffer: AudioBuffer;
    try {
      buffer = active ? await get().ensureDenoisedBuffer(file.id) : await get().ensureSourceBuffer(file.id);
    } catch {
      return; // 디코딩/처리 실패 → 절차적 폴백 유지
    }
    if (seq !== preAnalysisSeq) return; // 분석 도중 선택/Rate 변경됨
    try {
      const analysis = await analyzePre(file.id, key, buffer);
      if (seq !== preAnalysisSeq) return;

      const rec = getDenoiseRecommendation(analysis.snrDb, analysis.floorDb);
      let autoApplied = false;

      set((s) => {
        const files = s.files.map((f) => {
          if (f.id === file.id) {
            const patch: Partial<QueueFile> = { denoiseRecommended: rec };
            if (!f.denoiseRecommended) {
              patch.noiseDepth = rec.depth;
              patch.denoiseAmt = rec.amount;
              autoApplied = true;
            }
            return { ...f, ...patch };
          }
          return f;
        });
        const vals = { ...s.vals };
        const currentFile = files[s.curFile];
        if (currentFile && currentFile.id === file.id && autoApplied) {
          vals['pre.noiseDepth'] = rec.depth;
          vals['pre.denoiseAmt'] = rec.amount;
        }
        return { preAnalysis: analysis, files, vals };
      });

      if (autoApplied) {
        get().refreshDenoise();
      }
    } catch (e) {
      // 분석 실패 시 절차적 워터폴 폴백 유지(원인 확인용 로그)
      console.warn('[Pre] STFT 워터폴 분석 실패 — 절차적 폴백 사용:', e);
    }
  },

  ensureProcessingBuffer: async (id) => {
    const targetSampleRate = sampleRateFromInputRate(get().vals['input.rate']);
    const file = get().files.find((f) => f.id === id);
    if (!file) throw new Error('File is no longer in the queue.');
    if (file.processingBuffer && file.processingSampleRate === targetSampleRate) {
      return file.processingBuffer;
    }
    const sourceBuffer = await get().ensureSourceBuffer(id);
    const processingBuffer = await resampleAudioBuffer(sourceBuffer, targetSampleRate);
    set((state) => ({
      files: state.files.map((f) => (
        f.id === id ? { ...f, processingBuffer, processingSampleRate: targetSampleRate } : f
      )),
    }));
    return processingBuffer;
  },

  // v0.2.28: Denoise 결과 버퍼(lazy·캐시). 키(rate:depth:amt)가 같으면 재계산 생략.
  ensureDenoisedBuffer: async (id) => {
    const processing = await get().ensureProcessingBuffer(id);
    const st = get();
    const file = st.files.find((f) => f.id === id);
    if (!file) throw new Error('File is no longer in the queue.');
    const depth = file.noiseDepth !== undefined ? String(file.noiseDepth) : String(st.vals['pre.noiseDepth']);
    const amt = file.denoiseAmt !== undefined ? Number(file.denoiseAmt) : Number(st.vals['pre.denoiseAmt']);
    const key = denoiseKeyOf(processing.sampleRate, depth, amt);
    if (file.denoisedBuffer && file.denoiseKey === key) return file.denoisedBuffer;

    set({ processingAudio: true, processingMessage: 'Denoising', processingCurrentName: file.name, processingDone: 0, processingTotal: 1 });
    try {
      const denoised = await denoiseBuffer(processing, depth, amt);
      set((state) => ({
        files: state.files.map((f) => (f.id === id ? { ...f, denoisedBuffer: denoised, denoiseKey: key } : f)),
        processingDone: 1,
      }));
      return denoised;
    } finally {
      set({ processingAudio: false, processingMessage: '', processingCurrentName: '', processingDone: 0, processingTotal: 0 });
    }
  },

  // v0.2.28: Pre ON + Denoise ON → denoised, 그 외 → processing.
  effectivePlaybackBuffer: async (id) => {
    return denoiseActive(get()) ? get().ensureDenoisedBuffer(id) : get().ensureProcessingBuffer(id);
  },

  // v0.2.28: Denoise 파라미터/토글 변경 시 디바운스로 분석+재생 버퍼를 갱신(드래그 thrash 방지).
  refreshDenoise: () => {
    if (denoiseRefreshTimer) clearTimeout(denoiseRefreshTimer);
    denoiseRefreshTimer = setTimeout(() => {
      denoiseRefreshTimer = null;
      void useAppStore.getState().analyzePreSelected();
      void swapPlaybackToEffective();
    }, 350);
  },

  // v0.2.8: 원본 버퍼 확보(lazy). 없으면 디코딩하고, 현재 파일만 버퍼를 유지(LRU=1)하도록 나머지를 evict.
  ensureSourceBuffer: async (id) => {
    const existing = get().files.find((f) => f.id === id);
    if (!existing) throw new Error('File is no longer in the queue.');
    if (existing.sourceBuffer) return existing.sourceBuffer;
    const decoded = await decodeOnce(existing);
    set((state) => ({
      files: state.files.map((f) => {
        if (f.id === id) return applyDecodedMeta(f, decoded, true);
        if (f.sourceBuffer || f.processingBuffer || f.denoisedBuffer) {
          return { ...f, sourceBuffer: undefined, processingBuffer: undefined, processingSampleRate: undefined, denoisedBuffer: undefined, denoiseKey: undefined };
        }
        return f;
      }),
    }));
    return decoded.buffer;
  },

  changeInputRate: async (rate) => {
    const before = get();
    if (before.vals['input.rate'] === rate) return;

    const currentFile = before.files[before.curFile];
    const resumeOriginal = before.isOriginalPlaying && !!currentFile;
    const resumeTime = resumeOriginal ? previewEngine.getCurrentTime() : 0;

    previewEngine.stop();
    set((s) => ({
      vals: { ...s.vals, 'input.rate': rate },
      files: invalidateProcessingBuffers(s.files),
      isOriginalPlaying: false,
      previewError: null,
      originalPlayError: null,
    }));

    if (!currentFile) return;

    if (resumeOriginal) {
      set({
        processingAudio: true,
        processingMessage: `Resampling to ${rate}`,
        processingCurrentName: currentFile.name,
        processingDone: 0,
        processingTotal: 1,
      });
      try {
        const playBuffer = await get().effectivePlaybackBuffer(currentFile.id);
        set({ processingDone: 1 });
        const latest = get();
        const latestFile = latest.files[latest.curFile];
        if (latestFile?.id === currentFile.id) {
          await previewEngine.play(
            playBuffer,
            previewParamsFromState(latest, latestFile),
            () => set({ isOriginalPlaying: false }),
            Math.min(resumeTime, Math.max(0, playBuffer.duration - 0.001)),
            latest.isPreviewing,
          );
          set({ isOriginalPlaying: true, originalPlayError: null });
        }
      } catch {
        set({ isOriginalPlaying: false, originalPlayError: 'Resampling failed.' });
      } finally {
        set({ processingAudio: false, processingMessage: '', processingCurrentName: '', processingDone: 0, processingTotal: 0 });
      }
    }
  },

  toggleOriginalPlayback: async () => {
    originalSelectionResumeSeq++;
    const s = get();
    const file = s.files[s.curFile];
    if (!file) {
      set({ originalPlayError: 'Load an audio file before playback.' });
      return;
    }
    try {
      if (s.isOriginalPlaying) {
        previewEngine.pause();
        set({ isOriginalPlaying: false, originalPlayError: null });
        return;
      }
      const playBuffer = await get().effectivePlaybackBuffer(file.id);
      const latest = get();
      const latestFile = latest.files[latest.curFile];
      if (!latestFile || latestFile.id !== file.id) return;
      const offset = Math.min(previewEngine.getCurrentTime(), Math.max(0, playBuffer.duration - 0.001));
      await previewEngine.play(
        playBuffer,
        previewParamsFromState(latest, latestFile),
        () => set({ isOriginalPlaying: false }),
        offset,
        latest.isPreviewing,
      );
      set({ isOriginalPlaying: true, originalPlayError: null });
    } catch {
      set({ isOriginalPlaying: false, originalPlayError: 'Original playback failed.' });
    }
  },

  stopOriginalPlayback: () => {
    originalSelectionResumeSeq++;
    previewEngine.stop();
    set({ isOriginalPlaying: false });
  },

  resumeOriginalPlaybackAfterSelection: async (resumeSeq) => {
    const s = get();
    if (resumeSeq !== originalSelectionResumeSeq) return;
    const file = s.files[s.curFile];
    if (!file) return;
    try {
      const playBuffer = await get().effectivePlaybackBuffer(file.id);
      const latest = get();
      const latestFile = latest.files[latest.curFile];
      if (!latestFile || latestFile.id !== file.id) return;
      await previewEngine.play(
        playBuffer,
        previewParamsFromState(latest, latestFile),
        () => set({ isOriginalPlaying: false }),
        0,
        latest.isPreviewing,
      );
      if (resumeSeq !== originalSelectionResumeSeq) return;
      set({ isOriginalPlaying: true, originalPlayError: null });
    } catch {
      if (resumeSeq !== originalSelectionResumeSeq) return;
      set({ isOriginalPlaying: false, originalPlayError: 'Original playback failed.' });
    }
  },

  // ── Transport 패널 (v0.2.11) ──
  toggleTransport: () => set((s) => ({ transportOpen: !s.transportOpen })),

  setVolume: (v) => {
    const volume = Math.max(0, Math.min(1, v));
    // 슬라이더 조작은 음소거를 해제하고 그 음량을 적용한다.
    previewEngine.setVolume(volume);
    set({ volume, muted: false });
  },

  // 음소거 토글: 끄면 0, 켜면 이전 볼륨 복원(슬라이더 위치는 유지).
  toggleMute: () => {
    const muted = !get().muted;
    previewEngine.setVolume(muted ? 0 : get().volume);
    set({ muted });
  },

  // 현재 재생/일시정지 상태를 유지한 채 위치를 이동. 엔진이 재생 중이면 그 위치에서 재시작.
  seekPreview: (time) => {
    const s = get();
    const file = s.files[s.curFile];
    const dur = file?.meta.duration ?? 0;
    const t = Math.max(0, dur > 0 ? Math.min(time, Math.max(0, dur - 0.05)) : time);
    previewEngine.seek(t);
  },

  skip: (delta) => {
    get().seekPreview(previewEngine.getCurrentTime() + delta);
  },

  setLoopRange: (start, end) => {
    const s = get();
    const duration = s.files[s.curFile]?.meta.duration ?? 0;
    const a = Math.max(0, Math.min(start, duration));
    const b = Math.max(a, Math.min(end, duration));
    if (b - a < 0.25) return;
    set({ loopStart: a, loopEnd: b });
    if (s.loopEnabled) previewEngine.setLoop(true, a, b);
  },

  toggleLoop: () => {
    const s = get();
    const enabled = !s.loopEnabled && s.loopEnd - s.loopStart >= 0.25;
    previewEngine.setLoop(enabled, s.loopStart, s.loopEnd);
    set({ loopEnabled: enabled });
  },

  clearLoop: () => {
    previewEngine.setLoop(false, 0, 0);
    set({ loopEnabled: false, loopStart: 0, loopEnd: 0 });
  },

  // ── Export (v0.8.0 Phase 7) ──
  setArtwork: (dataUrl) => set({ artworkDataUrl: dataUrl }),

  pickExportDir: async () => {
    const picked = await window.focusdaw?.exportIO?.pickDir?.();
    if (picked) set({ exportDir: picked });
  },

  resetExportDir: () => set({ exportDir: null }),

  exportSelected: async () => {
    const s = get();
    if (s.exporting) return;
    const file = s.files[s.curFile];
    if (!file) {
      set({ exportError: 'Load an audio file before exporting.' });
      return;
    }
    await runExport([file.id]);
  },

  exportBatch: async () => {
    const s = get();
    if (s.exporting) return;
    await runExport(s.files.map((f) => f.id));
  },

  cancelExport: () => {
    exportCancelled = true;
  },

  revealLastExport: () => {
    const p = get().exportLastPath;
    if (p) void window.focusdaw?.exportIO?.reveal?.(p);
  },
}));
