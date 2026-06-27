// FocusDAW Mastering Desk v0.2.0 (Phase 1) - 배치 큐 파일 모델
// 디코딩 결과(AudioBuffer + AudioMeta)를 UI 표시용 문자열 필드(FileItem)로 변환해 보관한다.
// FileItem 의 표시 필드(name/size/fmt/dur/sr/depth/ch/lufs)는 원본 UI(compute/Viz/DetailSheet)가
// 그대로 소비하므로 동일한 형태를 유지한다. sourceBuffer 는 원본 Play, processingBuffer 는 Preview/DSP 에 사용.
import type { AudioMeta, DecodedAudio, HeaderMeta } from './decoder';
import { metaFromHeader } from './decoder';
import type { FileItem } from '../desk/data';

let seq = 0;

/** v0.2.8: 원본 LUFS 측정 상태. pending=대기, measuring=측정중, done=완료(또는 실패). */
export type LufsState = 'pending' | 'measuring' | 'done';

/** 큐에 보관되는 파일: 표시 문자열(FileItem) + (lazy)디코딩 산출물(sourceBuffer/meta) */
export type QueueFile = FileItem & {
  id: string;
  bytes: number;
  /** v0.1.4: Electron File.path 에서 추출한 원본 폴더 경로(브라우저에선 ''). Working folder 표시용. */
  dir: string;
  /** v0.2.8: lazy 재디코딩용 원본 File 참조(디코딩 전엔 이것만 보관). */
  file: File;
  /** v0.2.2: 원본 샘플레이트 보존 버퍼. v0.2.8부터 lazy — 선택/재생/측정 시에만 존재. */
  sourceBuffer?: AudioBuffer;
  /** v0.2.2: 사용자 Input Rate 로 변환된 내부 처리 버퍼. Preview/DSP/Export 용 lazy cache. */
  processingBuffer?: AudioBuffer;
  processingSampleRate?: number;
  /** v0.2.28: Denoise 결과 버퍼 lazy cache(키 = rate:depth:amt). Pre ON+Denoise ON 시 재생/분석 소스. */
  denoisedBuffer?: AudioBuffer;
  denoiseKey?: string;
  meta: AudioMeta;
  /** v0.2.8: 원본 Integrated LUFS 측정 상태. */
  lufsState: LufsState;
  /** v0.2.8: duration 이 헤더로 확정됐는지(MP3 추정은 false → 디코딩 시 보정). */
  durationExact: boolean;
};

/**
 * 드롭/선택된 File 의 폴더 경로를 구한다.
 * v0.1.5: Electron 32+ 는 File.path 가 제거되어 preload 의 webUtils.getPathForFile 로 절대경로를 얻는다.
 * (브라우저 환경에선 경로 취득 불가 → '')
 */
function dirOf(file: File): string {
  const path = window.focusdaw?.getPathForFile?.(file) || '';
  if (!path) return '';
  const norm = path.replace(/\\/g, '/');
  const i = norm.lastIndexOf('/');
  return i > 0 ? norm.slice(0, i) : norm;
}

function extOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
}

/** 확장자 → 표시 포맷 라벨 */
function formatLabel(name: string): string {
  const ext = extOf(name);
  const map: Record<string, string> = {
    wav: 'WAV', mp3: 'MP3', flac: 'FLAC', ogg: 'OGG', m4a: 'M4A', aac: 'AAC', aiff: 'AIFF', aif: 'AIFF',
  };
  return map[ext] || ext.toUpperCase() || '—';
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 MB';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return mb.toFixed(1) + ' MB';
  return Math.max(1, Math.round(bytes / 1024)) + ' KB';
}

function formatDuration(sec: number): string {
  if (!isFinite(sec) || sec <= 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return m + ':' + String(s).padStart(2, '0');
}

function channelLabel(ch: number): string {
  if (ch === 1) return 'Mono';
  if (ch === 2) return 'Stereo';
  return ch + ' ch';
}

function depthLabel(meta: AudioMeta): string {
  if (meta.sourceBitDepth) return meta.sourceBitDepth + '-bit';
  return '32-bit float';
}

/** LUFS 표시 문자열: 측정 전엔 '…', 완료면 실측값(측정불가/무음은 '—'). */
function lufsLabel(meta: AudioMeta, state: LufsState): string {
  if (state !== 'done') return '…';
  return isFinite(meta.integratedLufs) ? meta.integratedLufs.toFixed(1) : '—';
}

/** 표시 문자열(FileItem) 필드를 메타에서 계산한다. */
function displayFields(meta: AudioMeta, state: LufsState) {
  return {
    dur: formatDuration(meta.duration),
    sr: (meta.sampleRate / 1000).toFixed(1) + ' kHz',
    depth: depthLabel(meta),
    ch: channelLabel(meta.channels),
    lufs: lufsLabel(meta, state),
  };
}

/** v0.2.8: 헤더 메타만으로 큐 항목 생성(디코딩 전). LUFS 는 pending('…'). */
export function buildQueueFileFromHeader(file: File, hm: HeaderMeta): QueueFile {
  const meta = metaFromHeader(file, hm);
  return {
    id: 'qf-' + Date.now().toString(36) + '-' + (seq++).toString(36),
    name: file.name,
    bytes: file.size,
    dir: dirOf(file),
    size: formatBytes(file.size),
    fmt: formatLabel(file.name),
    ...displayFields(meta, 'pending'),
    file,
    sourceBuffer: undefined,
    meta,
    lufsState: 'pending',
    durationExact: hm.durationExact,
  };
}

/**
 * v0.2.8: 디코딩 결과를 큐 항목에 반영한다.
 * @param keepBuffer true면 sourceBuffer 보관(현재 선택/재생용), false면 측정만 하고 버퍼는 버린다(백그라운드 LUFS).
 */
export function applyDecodedMeta(qf: QueueFile, decoded: DecodedAudio, keepBuffer: boolean): QueueFile {
  const meta = decoded.meta;
  return {
    ...qf,
    ...displayFields(meta, 'done'),
    meta,
    lufsState: 'done',
    durationExact: true,
    sourceBuffer: keepBuffer ? decoded.buffer : qf.sourceBuffer,
  };
}

/** v0.2.8: 디코딩 실패 시 LUFS 측정을 종료 처리('—'). */
export function markLufsFailed(qf: QueueFile): QueueFile {
  return { ...qf, lufsState: 'done', lufs: '—' };
}
