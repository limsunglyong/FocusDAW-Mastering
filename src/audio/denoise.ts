// FocusDAW Mastering Desk v0.2.28 (Phase 2) - STFT 스펙트럴 게이팅 Denoise 실처리(2-A)
// 선택 파일의 processingBuffer 를 오프라인으로 노이즈 제거해 denoised AudioBuffer 를 1회 생성한다.
// 흐름: computeSpectrogram → findQuietNoiseRange(가장 조용한 구간 자동 탐색) → buildNoisePrint → reduceNoiseBuffer.
import { bufferToMono, computeSpectrogram, DEFAULT_STFT_PARAMS } from './stft';
import { buildNoisePrint, findQuietNoiseRange } from './noisePrint';
import { reduceNoiseBuffer, type NoiseReductionOptions } from './noiseReduction';

/**
 * Noise Depth(1/2/3) → 스펙트럴 게이팅 옵션 매핑.
 * threshold↑ = 노이즈 프로파일 근방을 더 넓게 게이팅(강함). amount = 차감 강도. floor = 잔여 게인 하한.
 * Noise Reduction(%) 노브(amtPct, 0~100)는 amount 에 곱해지는 사용자 미세 조정.
 * (A2 2-A 매핑 초안을 본 코드의 threshold 의미에 맞게 보정: Deep=threshold↑)
 */
export function depthToOptions(depth: string, amtPct: number): NoiseReductionOptions {
  const t = Math.max(0, Math.min(1, amtPct / 100));
  switch (depth) {
    case '1': // Original — 가벼움
      return { thresholdDb: 6, amount: 0.6 * t, floor: 0.2 };
    case '3': // Deep — 강함
      return { thresholdDb: 20, amount: 1.0 * t, floor: 0.04 };
    default: // '2' Normal — 표준
      return { thresholdDb: 12, amount: 0.85 * t, floor: 0.1 };
  }
}

/** 캐시 무효화 키(rate+depth+amt). 동일 키면 재계산 생략. */
export function denoiseKeyOf(rate: number, depth: string, amtPct: number): string {
  return `${rate}:${depth}:${Math.round(amtPct)}`;
}

/**
 * processingBuffer 를 노이즈 제거해 새 AudioBuffer 를 반환한다.
 * 조용한 구간을 못 찾거나 amount 0 이면 원본 버퍼를 그대로 반환(처리 없음).
 */
export async function denoiseAudioBuffer(
  buffer: AudioBuffer,
  depth: string,
  amtPct: number,
  onProgress?: (p: number) => void,
): Promise<AudioBuffer> {
  const opts = depthToOptions(depth, amtPct);
  if (opts.amount <= 0.001) {
    onProgress?.(1);
    return buffer;
  }
  const params = DEFAULT_STFT_PARAMS;
  const mono = bufferToMono(buffer);
  const spec = computeSpectrogram(mono, buffer.sampleRate, params);
  const range = findQuietNoiseRange(spec);
  if (!range) {
    onProgress?.(1);
    return buffer; // 노이즈 지문을 만들 조용한 구간이 없음
  }
  const print = buildNoisePrint(spec, range.startTime, range.endTime, 2);
  if (!print) {
    onProgress?.(1);
    return buffer;
  }
  return reduceNoiseBuffer(buffer, print, params, opts, onProgress);
}
