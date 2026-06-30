// FocusDAW Mastering Desk v0.10.4 - 릴리스 노트 (현재 버전 전용)
// Help ▸ Release Notes 창에 표시. 버전을 올릴 때마다 이 파일을 "현재 버전" 내용으로 교체한다
//   (이전 버전 노트는 남기지 않는다 — A4 수정요청 #2). 버그=상세, 기능/개선=간략.
import { APP_VERSION } from './version';

export type ReleaseNotes = {
  version: string;
  date: string;
  /** 기능 추가 — 간략 */
  features: string[];
  /** 개선 — 간략 */
  improvements: string[];
  /** 버그 수정 — 상세 */
  fixes: string[];
};

export const RELEASE_NOTES: ReleaseNotes = {
  version: APP_VERSION,
  date: '2026-06-30',
  features: [],
  improvements: [
    'Optimized denoise performance by implementing time-domain silent range detection.',
    'Denoising is now parallelized across channels using separate Web Workers for multi-threading speedup.',
    'Removed heavy Math.hypot and Math.log10 calls in the inner loops of spectral gating.',
  ],
  fixes: [],
};
