// FocusDAW Mastering Desk v0.9.0 - 세션(프로젝트) 직렬화
// 마스터링 체인 설정을 "Preset형"으로 저장/복원한다(파일 큐·곡별 denoise 미포함).
// 저장 범위 결정(2026-06-29 사용자 확정): 7섹션 vals(곡별 denoise depth/amount 제외) +
//   enabled(Bypass) + EQ 활성 프리셋 상태 + Export 메타/아트워크/Destination.
import { CTRL, META, type ModId, type Vals } from '../desk/data';

/** 세션에 저장하지 않는 vals 키.
 *  - pre.noiseDepth/denoiseAmt: 곡마다 STFT 분석 후 자동 추천되는 per-file 값(세션엔 denoise 토글만).
 *  - input.source/scope: 파일/폴더 임포트 UI 설정(마스터링 결과와 무관).
 */
const VAL_BLOCKLIST = new Set<string>([
  'pre.noiseDepth',
  'pre.denoiseAmt',
  'input.source',
  'input.scope',
]);

/** 세션에 저장할 vals 키 화이트리스트(CTRL 기반 자동 도출 + EQ/Export 보강). */
export function sessionValKeys(): string[] {
  const keys: string[] = [];
  (Object.keys(CTRL) as ModId[]).forEach((mod) => {
    CTRL[mod].forEach((c) => {
      const k = `${mod}.${c.key}`;
      if (!VAL_BLOCKLIST.has(k)) keys.push(k);
    });
  });
  // EQ: 모드 + Parametric 5밴드 + Graphic 9밴드를 함께 보관해 모드 전환 후 값도 유지한다.
  keys.push('spectral.mode', 'spectral.preset', 'spectral.graphic.preset', 'spectral.graphic.lastPreset');
  for (let n = 0; n < 5; n++) keys.push(`spectral.f${n}`, `spectral.g${n}`, `spectral.q${n}`);
  for (let n = 0; n < 9; n++) keys.push(`spectral.graphic.g${n}`);
  // Export 메타: CTRL.export 가 비어 있으므로 META(album/artist/year/genre/format) 를 포함.
  META.forEach((m) => keys.push(`export.${m.key}`));
  return keys;
}

const VAL_KEYS = sessionValKeys();

/** 세션이 보관하는 마스터링 상태(직렬화 단위). */
export type SessionPayload = {
  vals: Vals;
  enabled: Record<ModId, boolean>;
  activeUserPresetIdx: number;
  lastActivePresetName: string;
  /** 9-Band User 프리셋 활성 슬롯. 이전 세션 호환을 위해 optional. */
  activeGraphicUserPresetIdx?: number;
  artworkDataUrl: string | null;
  exportDir: string | null;
};

/** 디스크에 저장되는 세션 파일 1건. */
export type SessionFile = {
  id: string;
  name: string;
  /** v0.9.0: 세션 세부 설명(선택). */
  description?: string;
  savedAt: number;
  appVersion: string;
  payload: SessionPayload;
};

/** 세션 창 카드 표시용 요약(아트워크 base64 제외 — 목록 경량화). */
export type SessionSummary = {
  id: string;
  name: string;
  /** v0.9.0: 세션 세부 설명. */
  description: string;
  savedAt: number;
  appVersion: string;
  enabled: Record<ModId, boolean>;
  /** v0.9.0: Denoise 적용 여부(Pre 섹션 On + Denoise 토글 On). */
  denoise: boolean;
  /** 세션 카드용 EQ 종류. 구형 세션은 Parametric으로 간주. */
  eqMode?: 'Parametric' | '9-Band';
  eqPreset: string;
  lufs: number;
  format: string;
  rate: string;
  bit: string;
  hasArtwork: boolean;
  /** v0.9.0: Export 출력 폴더(미지정 시 null → 기본 <Music>/Masters/<Album>). */
  exportDir: string | null;
  /** v0.9.0: Album 명(기본 폴더 표시용). */
  album: string;
};

/** Denoise 적용 여부 = Pre 섹션 On + Denoise 토글 On. */
export function isDenoiseActive(payload: SessionPayload): boolean {
  return !!payload.vals['pre.denoise'] && payload.enabled?.pre !== false;
}

/** Export 작업 폴더 표시 문자열(미지정이면 기본 Masters/<Album> 힌트). */
export function exportFolderLabel(exportDir: string | null, album: string): string {
  if (exportDir) return exportDir;
  const a = (album || '').trim() || 'Untitled Master';
  return `Masters / ${a}  (default)`;
}

type SerializeInput = {
  vals: Vals;
  enabled: Record<ModId, boolean>;
  activeUserPresetIdx: number;
  lastActivePresetName: string;
  activeGraphicUserPresetIdx: number;
  artworkDataUrl: string | null;
  exportDir: string | null;
};

/** 현재 스토어 상태에서 세션 payload 를 추출(화이트리스트 vals 만 복사). */
export function serializeSession(s: SerializeInput): SessionPayload {
  const vals: Vals = {};
  for (const k of VAL_KEYS) {
    if (k in s.vals) vals[k] = s.vals[k];
  }
  return {
    vals,
    enabled: { ...s.enabled },
    activeUserPresetIdx: s.activeUserPresetIdx,
    lastActivePresetName: s.lastActivePresetName,
    activeGraphicUserPresetIdx: s.activeGraphicUserPresetIdx,
    artworkDataUrl: s.artworkDataUrl ?? null,
    exportDir: s.exportDir ?? null,
  };
}

/** payload 의 vals 중 세션 화이트리스트에 해당하는 키만 골라낸다(역직렬화 시 방어). */
export function sanitizeSessionVals(vals: Vals | undefined): Vals {
  const out: Vals = {};
  if (!vals) return out;
  for (const k of VAL_KEYS) {
    if (k in vals) out[k] = vals[k];
  }
  return out;
}

/** 기본 세션 이름(저장 시 placeholder) — 앨범명 또는 날짜 기반. */
export function defaultSessionName(vals: Vals): string {
  const album = String(vals['export.album'] || '').trim();
  if (album) return album;
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `Session ${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
