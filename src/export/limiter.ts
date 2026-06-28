// FocusDAW Mastering Desk v0.8.1 (Phase 7) - 오프라인 브릭월 True-Peak 리미터(순수 JS)
// limiterWorklet.ts 의 룩어헤드 리미터 알고리즘을 1:1 포팅한 결정적 오프라인 버전.
// OfflineAudioContext + AudioWorklet 의 로드/동작 불확실성을 제거하고, Export 결과가 항상
// ceiling 이하로 보장되도록 렌더된 PCM 에 직접 적용한다(Preview↔Export 정합의 기준).
//
// 알고리즘(스테레오 링크 브릭월, 워클릿과 동일):
//  - lookahead 만큼 신호 지연 + 같은 길이 desired-gain 링버퍼.
//  - 매 샘플 desired = ceiling/peak(초과 시), 출력 게인 target = 윈도우 내 desired 최소값(선행 더킹).
//  - target<gain → attack(빠름), target≥gain → release(느림) 스무딩.
//  - 출력은 지연 샘플 × 게인 → 피크 도달 시 이미 천장 이하(오버슈트 없음).
//  - enabled=false 면 desired=1(통과, 룩어헤드 지연만 — 정합용으로 동일 지연 유지).
//
// 입력 channelData 를 in-place 로 갱신한다(길이 동일, 워클릿 지연은 내부에서 flush·정렬).
export type BrickwallOptions = {
  ceiling: number;       // 선형 천장(0~1)
  releaseSec: number;    // 릴리즈(초)
  enabled: boolean;      // TP Limit 토글
  sampleRate: number;
  lookaheadMs: number;
};

export function applyBrickwallLimiter(channelData: Float32Array[], opts: BrickwallOptions): void {
  const nCh = channelData.length;
  if (nCh === 0) return;
  const n = channelData[0].length;
  const la = Math.max(1, Math.round((opts.lookaheadMs / 1000) * opts.sampleRate));
  const ceiling = opts.ceiling;
  const enabled = opts.enabled;
  const releaseSamples = Math.max(1, opts.releaseSec * opts.sampleRate);
  const relCoeff = 1 - Math.exp(-1 / releaseSamples);
  const attackCoeff = 1 - Math.exp(-1 / Math.max(1, la * 0.5));

  // 채널별 지연 라인 + 공유 desired 링버퍼(스테레오 링크)
  const delay: Float32Array[] = [];
  for (let c = 0; c < nCh; c++) delay.push(new Float32Array(la));
  const desired = new Float32Array(la).fill(1);
  let pos = 0;
  let gain = 1;

  // 입력 n 샘플 + la 샘플(0 패딩)으로 지연 라인을 flush 한다. 출력은 i>=la 일 때 i-la 위치로 정렬.
  const total = n + la;
  for (let i = 0; i < total; i++) {
    // 현재 입력 샘플(패딩 구간은 0)과 스테레오 링크 피크
    let peak = 0;
    for (let c = 0; c < nCh; c++) {
      const x = i < n ? channelData[c][i] : 0;
      const ax = x < 0 ? -x : x;
      if (ax > peak) peak = ax;
    }
    const d = enabled && peak > ceiling ? ceiling / peak : 1;

    // 지연 라인 읽기/쓰기 + desired 기록
    const readPos = pos;
    const delayed: number[] = [];
    for (let c = 0; c < nCh; c++) {
      delayed.push(delay[c][readPos]);
      delay[c][readPos] = i < n ? channelData[c][i] : 0;
    }
    desired[pos] = d;
    pos = pos + 1 >= la ? 0 : pos + 1;

    // 룩어헤드 윈도우 내 최소 desired → 게인 스무딩
    let target = 1;
    for (let k = 0; k < la; k++) if (desired[k] < target) target = desired[k];
    gain += (target - gain) * (target < gain ? attackCoeff : relCoeff);

    // 정렬된 출력 기록(i-la 가 원본 인덱스)
    const outIdx = i - la;
    if (outIdx >= 0) {
      for (let c = 0; c < nCh; c++) channelData[c][outIdx] = delayed[c] * gain;
    }
  }
}
