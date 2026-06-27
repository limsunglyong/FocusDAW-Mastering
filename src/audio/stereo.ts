// FocusDAW Mastering Desk v0.6.0 (Phase 5) - Stereo 파라미터 매핑 + 상관도/모노 폴드로스(순수 함수)
// Web Audio 노드 생성과 분리해 단위 시험(npm run verify) 가능하게 한다.
import type { Vals } from '../desk/data';

const num = (v: unknown, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

// Width(0~200%) → M/S Side 게인(0~2). 1=원본, 0=모노, 2=최대 확장.
export const stereoWidth = (vals: Vals) => Math.max(0, Math.min(2, num(vals['stereo.width'], 100) / 100));
// Bass Mono ON → Side 를 crossover(60~300Hz) 아래에서 제거(=저역 모노). OFF → 20Hz(사실상 영향 없음).
export const bassMonoFreq = (vals: Vals) => (vals['stereo.bassmono'] ? Math.max(20, num(vals['stereo.crossover'], 120)) : 20);
// Reverb/Delay send(0~30%) → wet 게인(0~0.5).
export const reverbSend = (vals: Vals) => Math.max(0, Math.min(1, (num(vals['stereo.reverb']) / 30) * 0.5));
export const delaySend = (vals: Vals) => Math.max(0, Math.min(1, (num(vals['stereo.delay']) / 30) * 0.5));

// 채널 상관도(Pearson) — L·R 정규화 내적. +1=모노/동위상, 0=무상관, -1=역위상. 무음이면 null.
export function computeCorrelation(l: Float32Array, r: Float32Array): number | null {
  const n = Math.min(l.length, r.length);
  let sumLR = 0, sumLL = 0, sumRR = 0;
  for (let i = 0; i < n; i++) {
    const a = l[i], b = r[i];
    sumLR += a * b; sumLL += a * a; sumRR += b * b;
  }
  const denom = Math.sqrt(sumLL * sumRR);
  if (denom < 1e-9) return null;
  return Math.max(-1, Math.min(1, sumLR / denom));
}

// 모노 합산(L+R)/2 시 손실(dB, ≤0). 동위상=0dB, 무상관≈-3dB, 역위상→큰 손실(−24dB clamp).
export function computeFoldLoss(l: Float32Array, r: Float32Array): number {
  const n = Math.min(l.length, r.length);
  let sumMono = 0, sumStereo = 0;
  for (let i = 0; i < n; i++) {
    const m = (l[i] + r[i]) * 0.5;
    sumMono += m * m;
    sumStereo += (l[i] * l[i] + r[i] * r[i]) * 0.5;
  }
  if (sumStereo < 1e-12) return 0;
  return Math.max(-24, Math.min(0, 10 * Math.log10((sumMono + 1e-20) / sumStereo)));
}

export type CorrStatus = 'GOOD' | 'CHECK' | 'RISK';
export const correlationStatus = (c: number): CorrStatus => (c >= 0.5 ? 'GOOD' : c >= 0 ? 'CHECK' : 'RISK');
export const correlationColor = (c: number) => (c >= 0.5 ? '#46c06a' : c >= 0 ? '#e6c23c' : '#e6502e');
