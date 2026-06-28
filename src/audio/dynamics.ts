// FocusDAW Mastering Desk v0.5.0 (Phase 4) - Dynamics 멀티밴드 파라미터 매핑(순수 함수)
// Web Audio 노드 생성과 분리해, 노브값 → DSP 파라미터 매핑을 단위 시험(npm run verify) 가능하게 한다.
// (LR4 크로스오버 노드 빌드 자체는 AudioContext 가 필요하므로 previewEngine.ts 에 둔다.)
import type { Vals } from '../desk/data';

const num = (v: unknown, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

// 크로스오버/익사이터 고정 주파수(Hz)
export const DYN_XOVER_LOW = 200; // low|mid 분할
export const DYN_XOVER_HIGH = 2000; // mid|high 분할
export const DYN_EXCITER_HP = 3500; // 익사이터 고역 추출
// 밴드별 어택/릴리즈 배율(저역 느림 · 고역 빠름) — index 0=low,1=mid,2=high
export const DYN_ATTACK_MUL = [1.5, 1.0, 0.6];
export const DYN_RELEASE_MUL = [1.4, 1.0, 0.7];
export const DYN_KEYS = ['dynamics.low', 'dynamics.mid', 'dynamics.high'] as const;

// Ratio 세그먼트('2:1'/'4:1'/'8:1') → 컴프 ratio
export function ratioFromVal(v: unknown): number {
  if (v === '8:1') return 8;
  if (v === '2:1') return 2;
  return 4;
}

// 밴드 노브(-18~0dB, |값|=압축량) → 컴프 threshold(낮을수록 강한 압축)
export const dynThreshold = (val: number) => Math.max(-40, Math.min(0, val * 1.6));
// 압축량에 비례한 가벼운 make-up gain(선형). val=0 → 1배.
// v0.8.2: 계수 0.3→0.12 로 완화. 기존 0.3 은 -18dB 밴드에서 +5.4dB/밴드를 내질러, loudness
// make-up(최대 +15.6dB)과 누적되면 VI 새츄레이터를 과구동해 피크가 거칠게 으깨지며 "지직"
// 노이즈를 만들었다(메이크업=1 로 두면 사라짐을 청취 확인). 최종 loudness 는 VI 단이 책임지므로
// IV 메이크업은 밴드 상대 밸런스용으로만 가볍게(−18dB → +2.2dB) 적용한다.(버그 #3)
export const dynMakeup = (val: number) => Math.pow(10, (Math.abs(val) * 0.12) / 20);
// transient(-50~+50%) → 밴드별 어택(초). +면 어택↑(트랜지언트 보존/펀치), 저역 느림·고역 빠름.
export const dynAttack = (vals: Vals, band: number) =>
  Math.max(0.002, Math.min(0.06, (0.02 + (num(vals['dynamics.transient']) / 50) * 0.015) * DYN_ATTACK_MUL[band]));
// transient → 밴드별 릴리즈(초). +면 릴리즈↓(스냅).
export const dynRelease = (vals: Vals, band: number) =>
  Math.max(0.04, Math.min(0.5, (0.18 - (num(vals['dynamics.transient']) / 50) * 0.1) * DYN_RELEASE_MUL[band]));
// exciter(0~100%) → 고역 하모닉 블렌드 게인(0~0.5). 0%면 0(원신호만).
export const exciterBlend = (vals: Vals) => (num(vals['dynamics.exciter']) / 100) * 0.5;
// exciter → 셰이퍼 드라이브(0.3~0.8). 블렌드 게인이 0이면 결과는 무음이라 드라이브는 무관.
export const exciterDrive = (vals: Vals) => 0.3 + (num(vals['dynamics.exciter']) / 100) * 0.5;
