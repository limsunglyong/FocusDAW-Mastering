// FocusDAW Mastering Desk v0.7.0 (Phase 6) - Loudness/Limiter 파라미터 매핑 + True Peak 측정(순수 함수)
// Web Audio 노드/Worklet 과 분리해 단위 시험(npm run verify) 가능하게 한다.
// (룩어헤드 리미터 자체는 AudioWorkletProcessor → limiterWorklet.ts)
import type { Vals } from '../desk/data';

const num = (v: unknown, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

// 룩어헤드(ms) — Preview 리미터 선행 지연. 작게 두어 모니터 지연 최소화.
export const LIMITER_LOOKAHEAD_MS = 2;

// LUFS Target(−24~−6) 대비 측정 LUFS → make-up 게인(0.05~6배). 측정 불가면 1배.
export function loudnessGain(targetLufs: number, measuredLufs: number): number {
  if (!Number.isFinite(measuredLufs)) return 1;
  return Math.max(0.05, Math.min(6, Math.pow(10, (targetLufs - measuredLufs) / 20)));
}

// Saturate(0~100%) → tanh 드라이브용 amount(0~0.5).
export const saturationAmount = (vals: Vals) => (num(vals['loudness.sat']) / 100) * 0.5;

// True Peak ceiling(−3~0dBTP) → 선형 천장(0.0001~1).
export const ceilingLinear = (vals: Vals) => Math.max(0.0001, Math.min(1, Math.pow(10, num(vals['loudness.ceiling'], -1) / 20)));
// TP Limit 토글.
export const limiterEnabled = (vals: Vals) => !!vals['loudness.tplimit'];
// Limiter 캐릭터 → 릴리즈(초). Clear=부드럽게/Punchy=중간/Loud=빠르게.
export const limiterReleaseSec = (vals: Vals) =>
  vals['loudness.limiter'] === 'Loud' ? 0.08 : vals['loudness.limiter'] === 'Clear' ? 0.18 : 0.12;

// 피크(dB) 추정. oversample>1 이면 인접 샘플 선형보간을 보지만, 선형보간은 항상 엔드포인트가 최대라
// 실효는 샘플 피크와 동일하다(정밀 인터샘플 TP 는 폴리페이즈 FIR 필요 — 후속). Preview 메터 추정용.
export function truePeakDb(channel: Float32Array, oversample = 4): number {
  let peak = 0;
  const n = channel.length;
  for (let i = 0; i < n; i++) {
    const x = channel[i];
    const ax = x < 0 ? -x : x;
    if (ax > peak) peak = ax;
    if (oversample > 1 && i + 1 < n) {
      const nx = channel[i + 1];
      for (let s = 1; s < oversample; s++) {
        const t = s / oversample;
        const v = Math.abs(x + (nx - x) * t);
        if (v > peak) peak = v;
      }
    }
  }
  return peak > 0 ? 20 * Math.log10(peak) : -Infinity;
}

export type ThdStatus = 'GENTLE' | 'MUSICAL' | 'HOT';
// Saturation THD(%) → 청감 판정. (compute.ts 의 viz 판정과 동일 임계.)
export const thdStatus = (thdPercent: number): ThdStatus => (thdPercent >= 3 ? 'HOT' : thdPercent >= 1 ? 'MUSICAL' : 'GENTLE');
