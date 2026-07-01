// FocusDAW Mastering Desk - 전역 상태 (Zustand)
// 원본 DCLogic 의 UI state(open/curFile/openMenu/eqAdvanced/enabled/vals) + 액션.
// v0.2.0(Phase 1): mock FILES 제거. 실제 디코딩된 파일 큐(files: QueueFile[])와
//   loadFiles/removeFile/clearFiles 액션 추가. curFile 은 큐 인덱스를 가리킨다.
import { create } from 'zustand';
import { DEFAULT_THEME, applyTheme, type ThemeName } from '../theme/themes';
import { DEFAULT_STATE, EQPRESETS, GRAPHIC_EQ_PRESETS, MODS, type DeskState, type ModId } from '../desk/data';
import { decodeAudioFile, readHeaderMeta, AudioDecodeError, type DecodedAudio } from '../audio/decoder';
import { buildQueueFileFromHeader, applyDecodedMeta, markLufsFailed, type QueueFile } from '../audio/queueFile';
import { previewEngine, type PreviewParams } from '../audio/previewEngine';
import { resampleAudioBuffer, sampleRateFromInputRate } from '../audio/resample';
import { analyzePre, type PreAnalysis } from '../audio/preAnalysis';
import { denoiseBuffer, denoiseKeyOf, getDenoiseRecommendation } from '../audio/denoise';
import { encodeMaster, isSupportedFormat, ExportUnsupportedError } from '../export/exportRunner';
import { baseName } from '../export/wav';
import { sanitizeSessionVals, type SessionPayload } from '../session/session';

// v0.10.2: Help ▸ Check for Updates 결과 모달 상태.
export type UpdateCheckStatus = {
  state: 'checking' | 'not-available' | 'available' | 'progress' | 'downloaded' | 'error' | 'dev';
  version?: string;
  percent?: number;
  message?: string;
};

type UndoSnapshot = {
  vals: Record<string, number | string | boolean>;
  enabled: Record<ModId, boolean>;
  artworkDataUrl: string | null;
  activeUserPresetIdx: number;
  lastActivePresetName: string;
  activeGraphicUserPresetIdx: number;
};

type AppState = DeskState & {
  theme: ThemeName;
  // ── Undo/Redo (v0.8.9) ──
  undoStacks: Record<number, UndoSnapshot[]>;
  redoStacks: Record<number, UndoSnapshot[]>;
  pushUndoSnap: () => void;
  undo: () => void;
  redo: () => void;

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
  exportCancelling: boolean;
  exportTotal: number;
  exportDone: number;
  exportCurrentName: string;
  /** v0.9.1: 현재 파일의 처리 단계(Decoding/Rendering/Encoding/Saving) — 로딩 카드 표시용. */
  exportStage: string;
  exportError: string | null;
  /** 사용자가 고른 Destination 폴더(절대경로). null 이면 기본 <Music>/Masters/<Album>. */
  exportDir: string | null;
  /** 마지막으로 저장된 파일 경로(완료 후 Reveal 용). */
  exportLastPath: string | null;
  /** v0.8.5: Export 완료 알림(성공/실패 요약). 모달로 표시 후 사용자가 닫으면 null. */
  exportNotice: { ok: boolean; saved: number; total: number; path: string | null; error: string | null } | null;
  /** Album Artwork 미리보기 dataURL(현재 라운드는 표시 전용 — WAV 미임베드). */
  artworkDataUrl: string | null;
  /** v0.10.2: Help ▸ Check for Updates 결과 모달. null=닫힘. */
  updateCheck: UpdateCheckStatus | null;

  // v0.4.0: User EQ Presets State
  userPresets: { name: string; f: number[]; g: number[]; q: number[] }[];
  activeUserPresetIdx: number;
  lastActivePresetName: string;
  graphicUserPresets: { name: string; g: number[] }[];
  activeGraphicUserPresetIdx: number;

  setTheme: (t: ThemeName) => void;
  setOpen: (i: number) => void;
  toggleEnabled: (id: ModId) => void;
  setVal: (fk: string, v: number | string | boolean, skipUndo?: boolean) => void;
  applyPreset: (name: string) => void;
  applyGraphicPreset: (name: string) => void;
  recallGraphicUserPreset: (idx: number) => void;
  saveGraphicUserPreset: (idx: number) => void;
  renameGraphicUserPreset: (idx: number, name: string) => void;
  recallUserPreset: (idx: number) => void;
  saveUserPreset: (idx: number) => void;
  renameUserPreset: (idx: number, name: string) => void;
  initUserPresets: () => Promise<void>;
  setEqNode: (n: number, f: number, g: number, skipUndo?: boolean) => void;
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
  newSession: () => void;
  togglePreview: () => Promise<void>;
  stopPreview: () => void;
  syncPreviewParams: () => void;
  /** v0.2.25: Pre 패널이 열렸을 때 선택 파일을 STFT 분석해 워터폴/노이즈 정보를 채운다. */
  analyzePreSelected: () => Promise<void>;
  ensureProcessingBuffer: (id: string) => Promise<AudioBuffer>;
  /** v0.2.28: Denoise 결과 버퍼 확보(lazy·캐시, 처리 오버레이 표시). */
  ensureDenoisedBuffer: (id: string) => Promise<AudioBuffer>;
  /** v0.9.1: 곡별 denoise 추천값(noiseDepth/denoiseAmt)이 없으면 분석해 채운다(Pre 미열람 곡 export 일관성). */
  ensureDenoiseRecommendation: (id: string) => Promise<void>;
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
  clearExportNotice: () => void;

  // ── 업데이트 확인 (v0.10.2) ──
  /** Help ▸ Check for Updates 클릭 — 수동 업데이트 확인 시작(모달 'checking' 표시 + updater.check). */
  checkForUpdates: () => void;
  /** updater:status 수신 시 진행 중인 수동 확인 모달에 결과 반영. */
  setUpdateCheckResult: (status: UpdateCheckStatus) => void;
  /** 업데이트 확인 모달 닫기. */
  closeUpdateCheck: () => void;

  // ── 세션(프로젝트) 적용 (v0.9.0) ──
  /** 세션 payload(체인 설정)를 현재 상태에 적용한다. 곡별 denoise·파일 큐는 건드리지 않는다. */
  applySession: (payload: SessionPayload) => void;

  // ── Denoise 조작 개선 (v0.10.4) ──
  appliedDenoiseAmt: number;
  appliedNoiseDepth: string;
  applyManualDenoise: () => Promise<void>;
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
    noisePrint: undefined,
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
const processingInFlight = new Map<string, Promise<AudioBuffer>>();
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
  // 선택 즉시 원본 디코딩과 현재 Input Rate processingBuffer 생성을 선행한다.
  // 여러 곡이 들어와도 선택 곡 하나만 처리하며, ensureProcessingBuffer가 중복 요청을 합친다.
  void st.ensureProcessingBuffer(sel.id).catch(() => {});
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
    useAppStore.setState({ exportError: `${format} export is not supported (use WAV, MP3, or FLAC).` });
    return;
  }
  // 렌더는 오프라인 컨텍스트지만, 진행 중 버퍼 evict 가 재생을 끊을 수 있으므로 재생을 멈춘다.
  s0.stopPreview();
  s0.stopOriginalPlayback();
  exportCancelled = false;

  const dir = await resolveExportDir(s0);
  const bit = s0.vals['input.bit'];
  useAppStore.setState({ exporting: true, exportCancelling: false, exportError: null, exportNotice: null, exportTotal: ids.length, exportDone: 0, exportCurrentName: '', exportStage: '', exportLastPath: null });
  // v0.8.5: 무거운 렌더/인코딩 전에 한 프레임 양보 → 로딩 오버레이가 먼저 그려지게 한다.
  await new Promise((r) => setTimeout(r, 30));

  let lastPath: string | null = null;
  const errors: string[] = [];
  try {
    for (let i = 0; i < ids.length; i++) {
      if (exportCancelled) break;
      const st = useAppStore.getState();
      const file = st.files.find((f) => f.id === ids[i]);
      if (!file) continue;
      // v0.8.5: 로딩 표시는 소스명이 아니라 출력 파일명(현재 포맷 확장자)으로.
      const outExt = format === 'MP3' ? 'mp3' : format === 'FLAC' ? 'flac' : 'wav';
      useAppStore.setState({ exportCurrentName: `${baseName(file.name)}.${outExt}`, exportDone: i, exportStage: 'Decoding' });
      try {
        // Decoding(디코드+리샘플) → Denoising(토글 ON 시) 단계를 분리 표시.
        let buffer = await st.ensureProcessingBuffer(file.id);
        if (denoiseActive(useAppStore.getState())) {
          useAppStore.setState({ exportStage: 'Denoising' });
          buffer = await st.ensureDenoisedBuffer(file.id);
        }
        // ensureProcessingBuffer 가 디코딩하며 store 의 meta(peakDb 등)를 갱신하므로,
        // Normalize 등 meta 의존 파라미터가 신선하도록 최신 file 을 다시 조회한다(Preview/Batch 와 동일 신선도).
        const latest = useAppStore.getState();
        const latestFile = latest.files.find((f) => f.id === file.id) ?? file;
        const params = previewParamsFromState(latest, latestFile);
        // v0.8.4 (7-E): MP3/FLAC 태그·아트워크. 트랙 제목은 파일명(별도 title 필드 없음), 나머지는 Export 메타.
        const meta = {
          title: baseName(file.name),
          artist: String(st.vals['export.artist'] || ''),
          album: String(st.vals['export.album'] || ''),
          year: String(st.vals['export.year'] || ''),
          genre: String(st.vals['export.genre'] || ''),
          artworkDataUrl: st.artworkDataUrl,
        };
        const { bytes, ext } = await encodeMaster(buffer, params, format, bit, meta, (stage) => {
          useAppStore.setState({ exportStage: stage === 'rendering' ? 'Rendering' : 'Encoding' });
        });
        useAppStore.setState({ exportStage: 'Saving' });
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
    const saved = ids.length - errors.length;
    // v0.8.5: 완료 알림 — 취소가 아니면 항상 모달로 결과를 알린다(저장 위치 포함).
    const notice = cancelled
      ? null
      : { ok: errors.length === 0, saved, total: ids.length, path: lastPath, error: errors.length ? errors.join('\n') : null };
    useAppStore.setState({
      exporting: false,
      exportCancelling: false,
      exportCurrentName: '',
      exportStage: '',
      exportLastPath: lastPath,
      exportError: errors.length ? errors.join('\n') : cancelled ? 'Export cancelled.' : null,
      exportNotice: notice,
    });
  }
}

export const useAppStore = create<AppState>((set, get) => ({
  ...clone(DEFAULT_STATE),
  theme: DEFAULT_THEME,
  appliedDenoiseAmt: 35,
  appliedNoiseDepth: '2',
  undoStacks: {},
  redoStacks: {},
  pushUndoSnap: () => {
    const s = get();
    const section = s.open;
    const snap: UndoSnapshot = {
      vals: JSON.parse(JSON.stringify(s.vals)),
      enabled: { ...s.enabled },
      artworkDataUrl: s.artworkDataUrl,
      activeUserPresetIdx: s.activeUserPresetIdx,
      lastActivePresetName: s.lastActivePresetName,
      activeGraphicUserPresetIdx: s.activeGraphicUserPresetIdx,
    };
    set((state) => {
      const currentStack = state.undoStacks[section] || [];
      const nextStack = [...currentStack, snap];
      if (nextStack.length > 100) nextStack.shift();
      return {
        undoStacks: {
          ...state.undoStacks,
          [section]: nextStack,
        },
        redoStacks: {
          ...state.redoStacks,
          [section]: [],
        },
      };
    });
  },
  undo: () => {
    const s = get();
    const section = s.open;
    const currentUndoStack = s.undoStacks[section] || [];
    if (currentUndoStack.length === 0) return;

    const nextUndoStack = [...currentUndoStack];
    const snap = nextUndoStack.pop()!;
    const currentSnap: UndoSnapshot = {
      vals: JSON.parse(JSON.stringify(s.vals)),
      enabled: { ...s.enabled },
      artworkDataUrl: s.artworkDataUrl,
      activeUserPresetIdx: s.activeUserPresetIdx,
      lastActivePresetName: s.lastActivePresetName,
      activeGraphicUserPresetIdx: s.activeGraphicUserPresetIdx,
    };

    const modId = MODS[section]?.id;
    const nextVals = { ...s.vals };
    let nextEnabled = { ...s.enabled };
    let nextArtworkDataUrl = s.artworkDataUrl;
    let nextActiveUserPresetIdx = s.activeUserPresetIdx;
    let nextLastActivePresetName = s.lastActivePresetName;
    let nextActiveGraphicUserPresetIdx = s.activeGraphicUserPresetIdx;

    if (modId) {
      const prefix = `${modId}.`;
      for (const k of Object.keys(snap.vals)) {
        if (k.startsWith(prefix)) {
          nextVals[k] = snap.vals[k];
        }
      }
      nextEnabled[modId] = snap.enabled[modId];
      if (modId === 'spectral') {
        nextActiveUserPresetIdx = snap.activeUserPresetIdx;
        nextLastActivePresetName = snap.lastActivePresetName;
        nextActiveGraphicUserPresetIdx = snap.activeGraphicUserPresetIdx;
      }
      if (modId === 'export') {
        nextArtworkDataUrl = snap.artworkDataUrl;
      }
    }

    set((state) => {
      const currentRedoStack = state.redoStacks[section] || [];
      const nextRedoStack = [...currentRedoStack, currentSnap];
      if (nextRedoStack.length > 100) nextRedoStack.shift();
      return {
        vals: nextVals,
        enabled: nextEnabled,
        artworkDataUrl: nextArtworkDataUrl,
        activeUserPresetIdx: nextActiveUserPresetIdx,
        lastActivePresetName: nextLastActivePresetName,
        activeGraphicUserPresetIdx: nextActiveGraphicUserPresetIdx,
        undoStacks: {
          ...state.undoStacks,
          [section]: nextUndoStack,
        },
        redoStacks: {
          ...state.redoStacks,
          [section]: nextRedoStack,
        },
      };
    });

    get().syncPreviewParams();
    get().refreshDenoise();
    void get().analyzePreSelected();
  },
  redo: () => {
    const s = get();
    const section = s.open;
    const currentRedoStack = s.redoStacks[section] || [];
    if (currentRedoStack.length === 0) return;

    const nextRedoStack = [...currentRedoStack];
    const snap = nextRedoStack.pop()!;
    const currentSnap: UndoSnapshot = {
      vals: JSON.parse(JSON.stringify(s.vals)),
      enabled: { ...s.enabled },
      artworkDataUrl: s.artworkDataUrl,
      activeUserPresetIdx: s.activeUserPresetIdx,
      lastActivePresetName: s.lastActivePresetName,
      activeGraphicUserPresetIdx: s.activeGraphicUserPresetIdx,
    };

    const modId = MODS[section]?.id;
    const nextVals = { ...s.vals };
    let nextEnabled = { ...s.enabled };
    let nextArtworkDataUrl = s.artworkDataUrl;
    let nextActiveUserPresetIdx = s.activeUserPresetIdx;
    let nextLastActivePresetName = s.lastActivePresetName;
    let nextActiveGraphicUserPresetIdx = s.activeGraphicUserPresetIdx;

    if (modId) {
      const prefix = `${modId}.`;
      for (const k of Object.keys(snap.vals)) {
        if (k.startsWith(prefix)) {
          nextVals[k] = snap.vals[k];
        }
      }
      nextEnabled[modId] = snap.enabled[modId];
      if (modId === 'spectral') {
        nextActiveUserPresetIdx = snap.activeUserPresetIdx;
        nextLastActivePresetName = snap.lastActivePresetName;
        nextActiveGraphicUserPresetIdx = snap.activeGraphicUserPresetIdx;
      }
      if (modId === 'export') {
        nextArtworkDataUrl = snap.artworkDataUrl;
      }
    }

    set((state) => {
      const currentUndoStack = state.undoStacks[section] || [];
      const nextUndoStack = [...currentUndoStack, currentSnap];
      if (nextUndoStack.length > 100) nextUndoStack.shift();
      return {
        vals: nextVals,
        enabled: nextEnabled,
        artworkDataUrl: nextArtworkDataUrl,
        activeUserPresetIdx: nextActiveUserPresetIdx,
        lastActivePresetName: nextLastActivePresetName,
        activeGraphicUserPresetIdx: nextActiveGraphicUserPresetIdx,
        undoStacks: {
          ...state.undoStacks,
          [section]: nextUndoStack,
        },
        redoStacks: {
          ...state.redoStacks,
          [section]: nextRedoStack,
        },
      };
    });

    get().syncPreviewParams();
    get().refreshDenoise();
    void get().analyzePreSelected();
  },
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
  exportCancelling: false,
  exportTotal: 0,
  exportDone: 0,
  exportCurrentName: '',
  exportStage: '',
  exportError: null,
  exportDir: null,
  exportLastPath: null,
  exportNotice: null,
  artworkDataUrl: null,
  updateCheck: null,
  userPresets: [
    { name: 'User 1', f: [60, 250, 1000, 4000, 12000], g: [0, 0, 0, 0, 0], q: [0.71, 1.0, 1.0, 1.2, 0.71] },
    { name: 'User 2', f: [60, 250, 1000, 4000, 12000], g: [0, 0, 0, 0, 0], q: [0.71, 1.0, 1.0, 1.2, 0.71] },
    { name: 'User 3', f: [60, 250, 1000, 4000, 12000], g: [0, 0, 0, 0, 0], q: [0.71, 1.0, 1.0, 1.2, 0.71] },
    { name: 'User 4', f: [60, 250, 1000, 4000, 12000], g: [0, 0, 0, 0, 0], q: [0.71, 1.0, 1.0, 1.2, 0.71] },
    { name: 'User 5', f: [60, 250, 1000, 4000, 12000], g: [0, 0, 0, 0, 0], q: [0.71, 1.0, 1.0, 1.2, 0.71] }
  ],
  activeUserPresetIdx: -1,
  lastActivePresetName: 'Normal',
  graphicUserPresets: Array.from({ length: 5 }, (_, i) => ({ name: `User ${i + 1}`, g: Array(9).fill(0) })),
  activeGraphicUserPresetIdx: -1,

  setTheme: (t) => { applyTheme(t); set({ theme: t }); },
  setOpen: (i) => {
    set({ open: i });
    if (MODS[i]?.id === 'pre') void get().analyzePreSelected(); // Pre 패널 열 때 워터폴 분석
  },
  toggleEnabled: (id) => {
    get().pushUndoSnap();
    set((s) => ({ enabled: { ...s.enabled, [id]: !s.enabled[id] } }));
    get().syncPreviewParams();
    // v0.2.28: Pre 섹션 On/Bypass 는 denoise 적용 여부(유효 버퍼)를 바꾸므로 분석/재생 갱신.
    if (id === 'pre') get().refreshDenoise();
  },

  setVal: (fk, v, skipUndo) =>
    {
      if (!skipUndo) {
        get().pushUndoSnap();
      }
      if (fk === 'input.rate') {
        void get().changeInputRate(String(v));
        return;
      }
      set((s) => {
        const extra = /^spectral\.[fgq]\d/.test(fk)
          ? { 'spectral.preset': 'User' }
          : /^spectral\.graphic\.g\d/.test(fk)
            ? { 'spectral.graphic.preset': 'User' }
            : null;
        let activeUserPresetIdx = s.activeUserPresetIdx;
        if (extra && s.vals['spectral.preset'] !== 'User') {
          activeUserPresetIdx = -1;
        }
        const vals: Record<string, any> = { ...s.vals, [fk]: v, ...(extra || {}) };
        let files = s.files;
        let appliedPatch = {};
        if (fk === 'pre.denoise' && v === true) {
          const file = s.files[s.curFile];
          if (file && file.denoiseRecommended) {
            const rec = file.denoiseRecommended;
            vals['pre.noiseDepth'] = rec.depth;
            vals['pre.denoiseAmt'] = rec.amount;
            appliedPatch = {
              appliedNoiseDepth: rec.depth,
              appliedDenoiseAmt: rec.amount
            };
            files = s.files.map((f, idx) => {
              if (idx === s.curFile) {
                return { ...f, noiseDepth: rec.depth, denoiseAmt: rec.amount };
              }
              return f;
            });
          }
        } else if (fk === 'pre.noiseDepth' || fk === 'pre.denoiseAmt') {
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
        return { vals, files, activeUserPresetIdx, ...appliedPatch };
      });
      get().syncPreviewParams();
      if (fk === 'pre.denoise') get().refreshDenoise();
    },

  applyPreset: (name) =>
    {
      get().pushUndoSnap();
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

  applyGraphicPreset: (name) => {
    if (name === 'User') {
      set((s) => ({ vals: { ...s.vals, 'spectral.graphic.preset': 'User' }, activeGraphicUserPresetIdx: -1 }));
      return;
    }
    const preset = GRAPHIC_EQ_PRESETS[name];
    if (!preset) return;
    get().pushUndoSnap();
    set((s) => {
      const patch: Record<string, number | string> = {
        'spectral.graphic.preset': name,
        'spectral.graphic.lastPreset': name,
      };
      for (let n = 0; n < preset.g.length; n++) patch[`spectral.graphic.g${n}`] = preset.g[n];
      return { vals: { ...s.vals, ...patch }, activeGraphicUserPresetIdx: -1 };
    });
    get().syncPreviewParams();
  },

  recallGraphicUserPreset: (idx) => {
    const preset = get().graphicUserPresets[idx];
    if (!preset) return;
    get().pushUndoSnap();
    set((s) => {
      const patch: Record<string, number | string> = { 'spectral.graphic.preset': 'User' };
      preset.g.forEach((gain, n) => { patch[`spectral.graphic.g${n}`] = gain; });
      return { vals: { ...s.vals, ...patch }, activeGraphicUserPresetIdx: idx };
    });
    get().syncPreviewParams();
  },

  saveGraphicUserPreset: (idx) => {
    set((s) => {
      const current = s.graphicUserPresets[idx];
      if (!current) return {};
      const g = Array.from({ length: 9 }, (_, n) => Number(s.vals[`spectral.graphic.g${n}`]));
      const updated = s.graphicUserPresets.map((p, i) => i === idx ? { ...p, g } : p);
      void window.focusdaw?.saveGraphicUserPresets?.(updated);
      localStorage.setItem('graphic_user_presets', JSON.stringify(updated));
      return {
        graphicUserPresets: updated,
        activeGraphicUserPresetIdx: idx,
        vals: { ...s.vals, 'spectral.graphic.preset': 'User' },
      };
    });
  },

  renameGraphicUserPreset: (idx, name) => {
    set((s) => {
      const updated = s.graphicUserPresets.map((p, i) => i === idx ? { ...p, name } : p);
      void window.focusdaw?.saveGraphicUserPresets?.(updated);
      localStorage.setItem('graphic_user_presets', JSON.stringify(updated));
      return { graphicUserPresets: updated };
    });
  },

  recallUserPreset: (idx) => {
    const p = get().userPresets[idx];
    if (!p) return;
    get().pushUndoSnap();
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
      let graphicPresets = await window.focusdaw?.loadGraphicUserPresets?.();
      if (!graphicPresets) {
        const localGraphic = localStorage.getItem('graphic_user_presets');
        if (localGraphic) graphicPresets = JSON.parse(localGraphic);
      }
      if (graphicPresets && Array.isArray(graphicPresets) && graphicPresets.length === 5) {
        set({ graphicUserPresets: graphicPresets });
      }
    } catch (err) {
      console.error('Error initializing user presets:', err);
    }
  },

  setEqNode: (n, f, g, skipUndo) =>
    {
      if (!skipUndo) {
        get().pushUndoSnap();
      }
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
      return {
        curFile: nextIdx,
        vals,
        appliedNoiseDepth: file ? (file.noiseDepth ?? '2') : '2',
        appliedDenoiseAmt: file ? (file.denoiseAmt ?? 35) : 35,
      };
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
      return {
        curFile: nextIdx,
        vals,
        appliedNoiseDepth: file ? (file.noiseDepth ?? '2') : '2',
        appliedDenoiseAmt: file ? (file.denoiseAmt ?? 35) : 35,
      };
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
      return {
        curFile: i,
        vals,
        appliedNoiseDepth: file ? (file.noiseDepth ?? '2') : '2',
        appliedDenoiseAmt: file ? (file.denoiseAmt ?? 35) : 35,
      };
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
        appliedNoiseDepth: firstFile ? (firstFile.noiseDepth ?? '2') : '2',
        appliedDenoiseAmt: firstFile ? (firstFile.denoiseAmt ?? 35) : 35,
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

  newSession: () => {
    get().stopPreview();
    get().stopOriginalPlayback();
    measureQueue = [];
    previewEngine.setLoop(false, 0, 0);
    set({
      ...clone(DEFAULT_STATE),
      appliedDenoiseAmt: 35,
      appliedNoiseDepth: '2',
      undoStacks: {},
      redoStacks: {},
      files: [],
      curFile: 0,
      importError: null,
      loopEnabled: false,
      loopStart: 0,
      loopEnd: 0,
      preAnalysis: null,
      artworkDataUrl: null,
      activeUserPresetIdx: -1,
      lastActivePresetName: 'Normal',
      activeGraphicUserPresetIdx: -1,
    });
    get().syncPreviewParams();
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
    // Denoise OFF도 선택한 Input Rate의 processingBuffer를 분석한다.
    // 그래야 ON/OFF 비교에서 리샘플링 유무가 섞이지 않고 Denoise 영향만 분리된다.
    const active = denoiseActive(st);
    const analysisRate = sampleRateFromInputRate(st.vals['input.rate']);
    const key = `${file.id}:${active ? 'dn:' + currentDenoiseKey(st) : `dry:${analysisRate}`}`;
    if (st.preAnalysis?.key === key) return; // 이미 동일 조건으로 분석됨
    const seq = ++preAnalysisSeq;
    let buffer: AudioBuffer;
    try {
      buffer = active ? await get().ensureDenoisedBuffer(file.id) : await get().ensureProcessingBuffer(file.id);
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
        const appliedPatch = (currentFile && currentFile.id === file.id && autoApplied) ? {
          appliedNoiseDepth: rec.depth,
          appliedDenoiseAmt: rec.amount
        } : {};
        if (currentFile && currentFile.id === file.id && autoApplied) {
          vals['pre.noiseDepth'] = rec.depth;
          vals['pre.denoiseAmt'] = rec.amount;
        }
        return { preAnalysis: analysis, files, vals, ...appliedPatch };
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
    const inFlightKey = `${id}:${targetSampleRate}`;
    const existingTask = processingInFlight.get(inFlightKey);
    if (existingTask) return existingTask;

    const task = (async () => {
      set((state) => ({
        files: state.files.map((f) => (
          f.id === id ? { ...f, resampling: true, resamplingRate: targetSampleRate } : f
        )),
      }));
      try {
        const sourceBuffer = await get().ensureSourceBuffer(id);
        const processingBuffer = await resampleAudioBuffer(sourceBuffer, targetSampleRate);
        set((state) => ({
          files: state.files.map((f) => {
            if (f.id !== id) return f;
            const rateStillCurrent = sampleRateFromInputRate(state.vals['input.rate']) === targetSampleRate;
            const isSelected = state.files[state.curFile]?.id === id;
            return rateStillCurrent && (isSelected || state.exporting)
              ? { ...f, processingBuffer, processingSampleRate: targetSampleRate }
              : f;
          }),
        }));
        return processingBuffer;
      } finally {
        processingInFlight.delete(inFlightKey);
        set((state) => ({
          files: state.files.map((f) => (
            f.id === id && f.resamplingRate === targetSampleRate
              ? { ...f, resampling: false, resamplingRate: undefined }
              : f
          )),
        }));
      }
    })();
    processingInFlight.set(inFlightKey, task);
    return task;
  },

  // v0.9.1: 곡별 denoise 추천값이 없으면(=Pre 패널에서 분석한 적 없는 곡) export/재생 직전에 1회 분석한다.
  // 메인 앱 analyzePreSelected 와 동일하게 dry(source) 신호 SNR → getDenoiseRecommendation 으로 per-file 값을 채움.
  ensureDenoiseRecommendation: async (id) => {
    const file0 = get().files.find((f) => f.id === id);
    if (!file0 || file0.denoiseRecommended) return; // 이미 추천값 있음(또는 큐에서 제거됨)
    let source: AudioBuffer;
    try {
      source = await get().ensureSourceBuffer(id);
    } catch {
      return; // 디코딩 실패 → 기존 per-file 값(기본값) 유지
    }
    const fname = get().files.find((f) => f.id === id)?.name ?? '';
    set({ processingAudio: true, processingMessage: 'Analyzing noise', processingCurrentName: fname, processingDone: 0, processingTotal: 1 });
    try {
      const analysis = await analyzePre(`exp:${id}`, `exp:${id}`, source);
      const rec = getDenoiseRecommendation(analysis.snrDb, analysis.floorDb);
      set((s) => {
        const files = s.files.map((f) => (f.id === id ? { ...f, denoiseRecommended: rec, noiseDepth: rec.depth, denoiseAmt: rec.amount } : f));
        // 분석 대상이 현재 선택곡이면 UI 미러(vals)도 함께 갱신.
        const cur = files[s.curFile];
        const vals = cur && cur.id === id ? { ...s.vals, 'pre.noiseDepth': rec.depth, 'pre.denoiseAmt': rec.amount } : s.vals;
        return { files, vals };
      });
    } catch {
      // 분석 실패 시 기존 per-file 값(기본값) 유지
    } finally {
      set({ processingAudio: false, processingMessage: '', processingCurrentName: '', processingDone: 0, processingTotal: 0 });
    }
  },

  // v0.2.28: Denoise 결과 버퍼(lazy·캐시). 키(rate:depth:amt)가 같으면 재계산 생략.
  ensureDenoisedBuffer: async (id) => {
    const processing = await get().ensureProcessingBuffer(id);
    // v0.9.1: 추천값 없는 곡은 여기서 분석해 채운 뒤 그 depth/amt 로 denoise(여러 곡 export 일관성).
    await get().ensureDenoiseRecommendation(id);
    const st = get();
    const file = st.files.find((f) => f.id === id);
    if (!file) throw new Error('File is no longer in the queue.');
    const depth = file.noiseDepth !== undefined ? String(file.noiseDepth) : String(st.vals['pre.noiseDepth']);
    const amt = file.denoiseAmt !== undefined ? Number(file.denoiseAmt) : Number(st.vals['pre.denoiseAmt']);
    const key = denoiseKeyOf(processing.sampleRate, depth, amt);
    if (file.denoisedBuffer && file.denoiseKey === key) return file.denoisedBuffer;

    set({ processingAudio: true, processingMessage: 'Denoising', processingCurrentName: file.name, processingDone: 0, processingTotal: 1 });
    try {
      let computedPrint = file.noisePrint;
      const denoised = await denoiseBuffer(
        processing,
        depth,
        amt,
        file.noisePrint,
        (print) => {
          computedPrint = print;
        }
      );
      set((state) => {
        const files = state.files.map((f) => (
          f.id === id ? { ...f, denoisedBuffer: denoised, denoiseKey: key, noisePrint: computedPrint } : f
        ));
        const curFileObj = files[state.curFile];
        const appliedPatch = (curFileObj && curFileObj.id === id) ? {
          appliedDenoiseAmt: amt,
          appliedNoiseDepth: depth
        } : {};
        return {
          files,
          processingDone: 1,
          ...appliedPatch
        };
      });
      return denoised;
    } finally {
      set({ processingAudio: false, processingMessage: '', processingCurrentName: '', processingDone: 0, processingTotal: 0 });
    }
  },

  // v0.2.28: Pre ON + Denoise ON → denoised, 그 외 → processing.
  effectivePlaybackBuffer: async (id) => {
    return denoiseActive(get()) ? get().ensureDenoisedBuffer(id) : get().ensureProcessingBuffer(id);
  },

  // v0.10.4: 현재 UI의 Denoise 파라미터 값으로 Denoise를 강제 수행
  applyManualDenoise: async () => {
    const file = get().files[get().curFile];
    if (!file) return;
    try {
      await get().ensureDenoisedBuffer(file.id);
      void get().analyzePreSelected();
      void swapPlaybackToEffective();
    } catch (e) {
      console.error('applyManualDenoise failed:', e);
    }
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
          return { ...f, sourceBuffer: undefined, processingBuffer: undefined, processingSampleRate: undefined, denoisedBuffer: undefined, denoiseKey: undefined, noisePrint: undefined };
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
      preAnalysis: null,
      isOriginalPlaying: false,
      previewError: null,
      originalPlayError: null,
    }));

    if (!currentFile) return;

    // Rate 변경 직후 현재 선택 곡만 선행 리샘플링한다.
    // 행 단위 resampling 상태가 Input 파일 목록에서 애니메이션으로 표시된다.
    try {
      await get().ensureProcessingBuffer(currentFile.id);
    } catch {
      set({ previewError: 'Resampling failed.' });
      return;
    }
    void get().analyzePreSelected();

    if (resumeOriginal) {
      try {
        const playBuffer = await get().effectivePlaybackBuffer(currentFile.id);
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
    previewEngine.stop(true, true);
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
  setArtwork: (dataUrl) => {
    get().pushUndoSnap();
    set({ artworkDataUrl: dataUrl });
  },

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
    set({ exportCancelling: true });
  },

  revealLastExport: () => {
    const p = get().exportLastPath;
    if (p) void window.focusdaw?.exportIO?.reveal?.(p);
  },

  clearExportNotice: () => set({ exportNotice: null }),

  // ── 업데이트 확인 (v0.10.2) ──
  checkForUpdates: () => {
    const api = window.focusdaw?.updater;
    if (!api?.check) {
      // 브라우저(비-Electron) 등 업데이터 미가용 환경.
      set({ updateCheck: { state: 'dev' } });
      return;
    }
    set({ updateCheck: { state: 'checking' } });
    api.check();
  },
  setUpdateCheckResult: (status) => {
    // 모달이 열려 있을 때(수동 확인 진행 중)만 결과를 반영한다.
    if (!get().updateCheck) return;
    set({ updateCheck: status });
  },
  closeUpdateCheck: () => set({ updateCheck: null }),

  // ── 세션(프로젝트) 적용 (v0.9.0) ──
  applySession: (payload) => {
    const cur = get();
    const incomingVals = sanitizeSessionVals(payload?.vals);
    // 9-Band 도입 전 세션에는 mode가 없으므로 기존 Min-φ Parametric으로 복원한다.
    if (payload?.vals && payload.vals['spectral.mode'] === undefined) {
      incomingVals['spectral.mode'] = 'Parametric';
    }
    const rateChanged =
      incomingVals['input.rate'] !== undefined && incomingVals['input.rate'] !== cur.vals['input.rate'];

    // 적용 중 재생 끊김/엉뚱한 버퍼 방지 — 재생 정지.
    previewEngine.stop();
    set((s) => ({
      // 곡별 denoise 미러(pre.noiseDepth/denoiseAmt)는 incomingVals 에 없으므로 그대로 유지된다.
      vals: { ...s.vals, ...incomingVals },
      enabled: payload?.enabled ? { ...s.enabled, ...payload.enabled } : s.enabled,
      activeUserPresetIdx:
        typeof payload?.activeUserPresetIdx === 'number' ? payload.activeUserPresetIdx : s.activeUserPresetIdx,
      lastActivePresetName: payload?.lastActivePresetName || s.lastActivePresetName,
      activeGraphicUserPresetIdx:
        typeof payload?.activeGraphicUserPresetIdx === 'number' ? payload.activeGraphicUserPresetIdx : -1,
      artworkDataUrl: payload?.artworkDataUrl ?? null,
      exportDir: payload?.exportDir ?? null,
      // Rate 가 바뀌면 처리/denoise 버퍼를 무효화(다음 Preview/Export 시 lazy 재생성).
      files: rateChanged ? invalidateProcessingBuffers(s.files) : s.files,
      isOriginalPlaying: false,
      // 세션 적용은 새 기준점 → 섹션별 Undo/Redo 스택 초기화.
      undoStacks: {},
      redoStacks: {},
    }));

    get().syncPreviewParams();
    get().refreshDenoise();
    void get().analyzePreSelected();
  },
}));
