// FocusDAW Mastering Desk v0.2.28 (Phase 2) - STFT 스펙트럴 게이팅 Denoise 실처리(2-A)
// 선택 파일의 processingBuffer 를 오프라인으로 노이즈 제거해 denoised AudioBuffer 를 1회 생성한다.
// 흐름: computeSpectrogram → findQuietNoiseRange(가장 조용한 구간 자동 탐색) → buildNoisePrint → reduceNoiseBuffer.
import { bufferToMono, computeSpectrogram, DEFAULT_STFT_PARAMS } from './stft';
import { buildNoisePrint, findQuietNoiseRange, findQuietNoiseRangeTimeDomain } from './noisePrint';
import { reduceNoiseBuffer, type NoiseReductionOptions } from './noiseReduction';
import { getAudioContext } from './decoder';
import type { DenoiseWorkerReq, DenoiseWorkerRes } from './denoise.worker';

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
      return { thresholdDb: 6, amount: 0.6 * t, floor: 0.2, oversubFactor: 2.0 };
    case '3': // Deep — 강함
      return { thresholdDb: 20, amount: 1.0 * t, floor: 0.04, oversubFactor: 3.0 };
    default: // '2' Normal — 표준
      return { thresholdDb: 12, amount: 0.85 * t, floor: 0.1, oversubFactor: 2.5 };
  }
}

/**
 * 분석된 SNR 및 노이즈 플로어를 기반으로 최적의 Denoise 파라미터를 추천한다.
 */
export function getDenoiseRecommendation(snrDb: number, _floorDb: number) {
  if (snrDb >= 100) {
    return { depth: '1', amount: 5, text: 'Very Clean', color: '#4ea5ff' }; // Blue
  }
  if (snrDb >= 90) {
    return { depth: '1', amount: 10, text: 'Clean', color: '#4ea5ff' }; // Blue
  }
  if (snrDb >= 80) {
    return { depth: '1', amount: 25, text: 'Light Clean', color: '#46d36e' }; // Green
  }
  if (snrDb >= 60) {
    return { depth: '2', amount: 10, text: 'Moderate Noise', color: '#a2db34' }; // Yellow-green
  }
  if (snrDb >= 40) {
    return { depth: '2', amount: 30, text: 'Heavy Noise', color: '#ff983d' }; // Orange
  }
  return { depth: '3', amount: 50, text: 'Extreme Noise', color: '#ff5a5a' }; // Red
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

/**
 * v0.10.4: Web Worker 기반 denoise.
 * 1. 메인 스레드에서 시간 도메인 RMS 로 극도로 빠르게 조용한 구간을 자동 탐색하고 (~15ms)
 * 2. 해당 2초 구간에 대해서만 단일 STFT 분석을 수행해 노이즈 지문을 추출합니다 (~15ms)
 * 3. 각 채널을 별도의 Web Worker 로 전송하여 병렬(Parallel Multi-Threading)로 노이즈 감쇠를 처리합니다.
 */
export function denoiseBuffer(
  buffer: AudioBuffer,
  depth: string,
  amtPct: number,
  prebuiltPrint?: any,
  onPrintComputed?: (print: any) => void
): Promise<AudioBuffer> {
  return new Promise(async (resolve, reject) => {
    const numCh = buffer.numberOfChannels;
    const length = buffer.length;
    const sampleRate = buffer.sampleRate;
    const params = DEFAULT_STFT_PARAMS;

    try {
      const opts = depthToOptions(depth, amtPct);
      if (opts.amount <= 0.001) {
        // 노이즈 감쇠량이 0에 수렴하면 복사 후 즉시 반환
        const ctx = getAudioContext();
        const out = ctx.createBuffer(numCh, length, sampleRate);
        for (let ch = 0; ch < numCh; ch++) {
          out.copyToChannel(buffer.getChannelData(ch), ch);
        }
        resolve(out);
        return;
      }

      let print: any = prebuiltPrint || null;

      if (!print) {
        // 1. 모노 믹스 생성
        const mono = bufferToMono(buffer);

        // 2. 시간 도메인 기반 조용한 2초 구간 고속 자동 탐색 (~10ms)
        const range = findQuietNoiseRangeTimeDomain(mono, sampleRate, params);

        if (range) {
          // 3. 탐색된 2초 구간의 모노 신호만 잘라내어 STFT 스펙트로그램을 계산 (기존 대비 100배 이상 빠름, ~10ms)
          const startSample = range.startFrame * params.hopSize;
          const endSample = startSample + range.windowFrames * params.hopSize + params.fftSize;
          const monoSlice = mono.subarray(startSample, Math.min(mono.length, endSample));
          const sliceSpec = computeSpectrogram(monoSlice, sampleRate, params);

          // 4. 노이즈 지문 빌드
          print = buildNoisePrint(sliceSpec, 0, sliceSpec.frames * sliceSpec.timeStep, 2);
          if (print && onPrintComputed) {
            onPrintComputed(print);
          }
        }
      }

      if (!print) {
        // 노이즈 프로파일 추출 실패 시 원본 복제 후 반환
        const ctx = getAudioContext();
        const out = ctx.createBuffer(numCh, length, sampleRate);
        for (let ch = 0; ch < numCh; ch++) {
          out.copyToChannel(buffer.getChannelData(ch), ch);
        }
        resolve(out);
        return;
      }

      // 5. 각 오디오 채널을 별도 Web Worker 로 전송하여 병렬로 노이즈 감쇠 처리 (2ch = 2배속)
      const promises: Promise<ArrayBuffer>[] = [];

      for (let ch = 0; ch < numCh; ch++) {
        const copy = new Float32Array(buffer.getChannelData(ch)); // 복사본 생성하여 transfer
        const chBuffer = copy.buffer;

        promises.push(
          new Promise<ArrayBuffer>((resolveCh, rejectCh) => {
            const worker = new Worker(new URL('./denoise.worker.ts', import.meta.url), { type: 'module' });
            worker.onmessage = (e: MessageEvent<DenoiseWorkerRes>) => {
              const msg = e.data;
              if (msg.type === 'done') {
                resolveCh(msg.channels[0]);
                worker.terminate();
              } else {
                rejectCh(new Error(msg.message));
                worker.terminate();
              }
            };
            worker.onerror = (err) => {
              rejectCh(err instanceof ErrorEvent ? new Error(err.message) : new Error('Denoise worker failed'));
              worker.terminate();
            };

            const req: DenoiseWorkerReq = {
              channels: [chBuffer],
              sampleRate,
              depth,
              amtPct,
              print,
            };
            worker.postMessage(req, [chBuffer]);
          })
        );
      }

      const processedChannels = await Promise.all(promises);
      const ctx = getAudioContext();
      const out = ctx.createBuffer(numCh, length, sampleRate);
      processedChannels.forEach((b, ch) => {
        out.copyToChannel(new Float32Array(b), ch);
      });
      resolve(out);
    } catch (err) {
      reject(err);
    }
  });
}
