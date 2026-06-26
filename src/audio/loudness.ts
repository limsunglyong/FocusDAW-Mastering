// FocusDAW Mastering Desk v0.1.6 (Phase 1) - Integrated Loudness (LUFS) 측정
// ITU-R BS.1770-4 / EBU R128 기반: K-weighting(2-stage biquad) → 400ms 블록(75% overlap)
//   → 절대 게이트(-70 LUFS) → 상대 게이트(-10 LU) → integrated loudness.
// 입력 섹션(I)에서 "원본 파일의 실측 LUFS" 표시에 사용한다. (목표 LUFS 설정은 Loudness 섹션 VI)
//
// 계수식은 BS.1770 의 표준 파라미터를 sample-rate 별로 bilinear 변환해 계산(48k 외 레이트도 정확).

export type Biquad = { b0: number; b1: number; b2: number; a1: number; a2: number };

/** K-weighting 2-stage 계수 (stage1: high-shelf, stage2: RLB high-pass) */
export function kWeightingCoeffs(fs: number): [Biquad, Biquad] {
  // Stage 1 — high-shelf ("pre-filter")
  const db = 3.999843853973347;
  const f1 = 1681.974450955533;
  const Q1 = 0.7071752369554196;
  const K1 = Math.tan((Math.PI * f1) / fs);
  const Vh = Math.pow(10, db / 20);
  const Vb = Math.pow(Vh, 0.4996667741545416);
  const a0_1 = 1 + K1 / Q1 + K1 * K1;
  const s1: Biquad = {
    b0: (Vh + (Vb * K1) / Q1 + K1 * K1) / a0_1,
    b1: (2 * (K1 * K1 - Vh)) / a0_1,
    b2: (Vh - (Vb * K1) / Q1 + K1 * K1) / a0_1,
    a1: (2 * (K1 * K1 - 1)) / a0_1,
    a2: (1 - K1 / Q1 + K1 * K1) / a0_1,
  };

  // Stage 2 — RLB high-pass (b = [1, -2, 1], 표준 그대로)
  const f2 = 38.13547087602444;
  const Q2 = 0.5003270373238773;
  const K2 = Math.tan((Math.PI * f2) / fs);
  const a0_2 = 1 + K2 / Q2 + K2 * K2;
  const s2: Biquad = {
    b0: 1,
    b1: -2,
    b2: 1,
    a1: (2 * (K2 * K2 - 1)) / a0_2,
    a2: (1 - K2 / Q2 + K2 * K2) / a0_2,
  };

  return [s1, s2];
}

/** Direct Form I biquad 를 적용한 새 배열 반환 (a0 정규화 완료된 계수 가정) */
function applyBiquad(x: Float32Array, c: Biquad): Float32Array {
  const y = new Float32Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let n = 0; n < x.length; n++) {
    const xn = x[n];
    const yn = c.b0 * xn + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2;
    y[n] = yn;
    x2 = x1; x1 = xn;
    y2 = y1; y1 = yn;
  }
  return y;
}

// BS.1770 채널 가중치: L,R,C = 1.0 / Ls,Rs = 1.41 (LFE 제외, 여기선 디코드 채널 순서를 따른다)
function channelWeight(index: number): number {
  return index < 3 ? 1.0 : 1.41;
}

/**
 * 채널별 PCM(Float32) + 샘플레이트로 integrated loudness(LUFS)를 계산.
 * 무음이거나 측정 가능한 구간이 없으면 -Infinity 반환.
 */
export function integratedLufsFromChannels(channels: Float32Array[], sampleRate: number): number {
  if (channels.length === 0 || sampleRate <= 0) return -Infinity;
  const length = channels[0].length;
  if (length < Math.round(0.4 * sampleRate)) return -Infinity; // 400ms 미만이면 측정 불가

  const [s1, s2] = kWeightingCoeffs(sampleRate);
  // K-weighting 적용(2-stage)
  const filtered = channels.map((ch) => applyBiquad(applyBiquad(ch, s1), s2));
  const weights = channels.map((_, i) => channelWeight(i));

  const blockSize = Math.round(0.4 * sampleRate);
  const step = Math.round(0.1 * sampleRate); // 75% overlap
  const offset = -0.691; // BS.1770 absolute offset

  // 블록별 가중 mean-square 합(zSum)과 블록 loudness(l) 산출
  const zSums: number[] = [];
  for (let start = 0; start + blockSize <= length; start += step) {
    let zSum = 0;
    for (let c = 0; c < filtered.length; c++) {
      const f = filtered[c];
      let ms = 0;
      for (let n = start; n < start + blockSize; n++) ms += f[n] * f[n];
      ms /= blockSize;
      zSum += weights[c] * ms;
    }
    zSums.push(zSum);
  }
  if (zSums.length === 0) return -Infinity;

  const loudnessOf = (z: number) => (z > 0 ? offset + 10 * Math.log10(z) : -Infinity);

  // 1) 절대 게이트 (-70 LUFS)
  const absGated = zSums.filter((z) => loudnessOf(z) >= -70);
  if (absGated.length === 0) return -Infinity;

  // 2) 상대 게이트: 절대 게이트 평균 loudness - 10 LU
  const meanAbs = absGated.reduce((a, b) => a + b, 0) / absGated.length;
  const relThreshold = loudnessOf(meanAbs) - 10;

  const relGated = absGated.filter((z) => loudnessOf(z) >= relThreshold);
  if (relGated.length === 0) return -Infinity;

  const meanRel = relGated.reduce((a, b) => a + b, 0) / relGated.length;
  return loudnessOf(meanRel);
}

/** AudioBuffer → integrated loudness(LUFS). 무음/너무 짧으면 -Infinity */
export function computeIntegratedLufs(buffer: AudioBuffer): number {
  const channels: Float32Array[] = [];
  for (let c = 0; c < buffer.numberOfChannels; c++) channels.push(buffer.getChannelData(c));
  return integratedLufsFromChannels(channels, buffer.sampleRate);
}
