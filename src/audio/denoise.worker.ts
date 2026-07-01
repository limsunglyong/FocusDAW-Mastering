// FocusDAW Mastering Desk v0.2.29 (Phase 2) - Denoise Web Worker
// 스펙트럴 게이팅 전체 파이프라인(STFT→noise print→채널별 차감)을 메인 스레드 밖에서 수행.
// 메인 스레드 freeze 방지(긴 곡 denoise 시 UI 멈춤·로딩 미표시 문제 해결).
import { computeSpectrogram, mixToMono, stftParamsForSampleRate, type StftParams } from './stft';
import { findQuietNoiseRange, buildNoisePrint, type NoisePrint } from './noisePrint';
import { reduceNoiseChannel } from './noiseReduction';
import { depthToOptions } from './denoise';

export interface DenoiseWorkerReq {
  channels: ArrayBuffer[]; // 각 채널 Float32 PCM (transfer)
  sampleRate: number;
  depth: string;
  amtPct: number;
  params?: StftParams;
  print?: NoisePrint; // 사전 계산된 노이즈 지문 (있을 경우 사용)
}
export type DenoiseWorkerRes =
  | { type: 'done'; channels: ArrayBuffer[] }
  | { type: 'error'; message: string };

self.onmessage = (e: MessageEvent<DenoiseWorkerReq>) => {
  const { channels, sampleRate, depth, amtPct } = e.data;
  const post = (msg: DenoiseWorkerRes, transfer?: ArrayBuffer[]) =>
    (self as unknown as Worker).postMessage(msg, transfer ?? []);
  try {
    const chArrays = channels.map((b) => new Float32Array(b));
    const opts = depthToOptions(depth, amtPct);
    if (opts.amount <= 0.001) {
      const bufs = chArrays.map((a) => a.buffer as ArrayBuffer);
      post({ type: 'done', channels: bufs }, bufs);
      return;
    }
    const params = e.data.params ?? stftParamsForSampleRate(sampleRate);
    const length = chArrays[0]?.length ?? 0;

    let print = e.data.print;
    if (!print) {
      // 롤백/폴백 대비: 노이즈 지문이 없으면 전체 모노 분석을 수행
      const mono = mixToMono(chArrays, length);
      const spec = computeSpectrogram(mono, sampleRate, params);
      const range = findQuietNoiseRange(spec);
      if (range) {
        print = buildNoisePrint(spec, range.startTime, range.endTime, 2) || undefined;
      }
    }

    let out: Float32Array[] = chArrays;
    if (print) {
      out = chArrays.map((a) => reduceNoiseChannel(a, print!, params, opts));
    }
    const bufs = out.map((a) => a.buffer as ArrayBuffer);
    post({ type: 'done', channels: bufs }, bufs);
  } catch (err) {
    post({ type: 'error', message: err instanceof Error ? err.message : 'Denoise worker failed' });
  }
};
