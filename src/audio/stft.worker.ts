// FocusDAW Mastering Desk v0.2.25 (Phase 2) - STFT 분석 Web Worker
// _refer/FocusSpectogram/src/audio/stft.worker.ts 이식.
// 메인 스레드 블로킹 없이 스펙트로그램을 계산한다(긴 곡도 UI 멈춤 없이 분석).
import { computeSpectrogram, type StftParams, type Spectrogram } from './stft';

export interface StftWorkerRequest {
  mono: ArrayBuffer; // Float32Array의 버퍼 (transfer)
  sampleRate: number;
  params: StftParams;
}

export type StftWorkerResponse =
  | { type: 'progress'; value: number }
  | { type: 'done'; result: Omit<Spectrogram, 'data'>; data: ArrayBuffer }
  | { type: 'error'; message: string };

self.onmessage = (e: MessageEvent<StftWorkerRequest>) => {
  const { mono, sampleRate, params } = e.data;
  try {
    const monoArr = new Float32Array(mono);
    const spec = computeSpectrogram(monoArr, sampleRate, params, (p) => {
      (self as unknown as Worker).postMessage({ type: 'progress', value: p } satisfies StftWorkerResponse);
    });
    const { data, ...meta } = spec;
    const dataBuf = data.buffer as ArrayBuffer;
    (self as unknown as Worker).postMessage(
      { type: 'done', result: meta, data: dataBuf } satisfies StftWorkerResponse,
      [dataBuf],
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error during STFT analysis.';
    (self as unknown as Worker).postMessage({ type: 'error', message } satisfies StftWorkerResponse);
  }
};
