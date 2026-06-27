// FocusDAW Mastering Desk v0.2.25 (Phase 2) - Pre Processing 3D 워터폴 실데이터 분석
// 선택 파일 버퍼 → (Web Worker)STFT 스펙트로그램 → 로그-주파수 다운샘플 그리드 + noise floor/SNR 실측.
// 무거운 STFT 는 worker 에서 돌려 메인 스레드를 막지 않는다(긴 곡 대응).
import { bufferToMono, DEFAULT_STFT_PARAMS, type Spectrogram, type StftParams } from './stft';
import { buildNoisePrint, findQuietNoiseRange } from './noisePrint';
import type { StftWorkerRequest, StftWorkerResponse } from './stft.worker';

/** 워터폴 그리드 해상도 — 기존 PreViz SVG(NT×NF)와 동일하게 유지(시각 일관성). */
export const WATERFALL_NT = 11;
export const WATERFALL_NF = 46;

/** 표시 다이내믹 레인지(dB) — maxDb 기준 아래로 이 폭만큼을 0..1 높이에 매핑. */
const DISPLAY_RANGE_DB = 72;

export interface PreAnalysis {
  fileId: string;
  key: string; // fileId + rate(+denoiseKey) — 캐시 무효화 판정용
  nt: number;
  nf: number;
  /** 정규화된 레벨 그리드(0..1). 인덱스 [t*nf + f]. t=0 = 가장 이른 시간, f=0 = 저역(20Hz). (폴백 SVG용) */
  grid: Float32Array;
  /** v0.2.26: 3D 서피스용 캡 스펙트로그램(메모리 제한 위해 2000×512 다운샘플). */
  spectrogram: Spectrogram;
  floorDb: number; // 노이즈 플로어 실측(가장 조용한 구간 평균)
  snrDb: number; // maxDb - floorDb
  binHz: number; // 주파수 bin 해상도 = sampleRate / fftSize
  fftSize: number;
  overlapPct: number; // (1 - hop/fft) * 100
  windowName: string;
}

/** v0.2.26: 풀 스펙트로그램을 max-pooling 으로 캡(2000×512)해 메모리를 제한한다(duration·Nyquist 보존). */
const CAP_FRAMES = 2000;
const CAP_BINS = 512;
function capSpectrogram(spec: Spectrogram): Spectrogram {
  if (spec.frames <= CAP_FRAMES && spec.bins <= CAP_BINS) return spec;
  const cols = Math.min(spec.frames, CAP_FRAMES);
  const rows = Math.min(spec.bins, CAP_BINS);
  const data = new Float32Array(cols * rows);
  const colScale = spec.frames / cols;
  const rowScale = spec.bins / rows;
  for (let c = 0; c < cols; c++) {
    const f0 = Math.floor(c * colScale);
    const f1 = Math.max(f0 + 1, Math.floor((c + 1) * colScale));
    for (let r = 0; r < rows; r++) {
      const b0 = Math.floor(r * rowScale);
      const b1 = Math.max(b0 + 1, Math.floor((r + 1) * rowScale));
      let peak = -Infinity;
      for (let f = f0; f < f1 && f < spec.frames; f++) {
        const base = f * spec.bins;
        for (let b = b0; b < b1 && b < spec.bins; b++) {
          const v = spec.data[base + b];
          if (v > peak) peak = v;
        }
      }
      data[c * rows + r] = peak;
    }
  }
  const duration = spec.frames * spec.timeStep;
  const nyquistSpan = spec.bins * spec.freqStep;
  return {
    ...spec,
    frames: cols,
    bins: rows,
    data,
    timeStep: duration / cols,
    freqStep: nyquistSpan / rows,
  };
}

function runStftWorker(mono: Float32Array, sampleRate: number, params: StftParams): Promise<Spectrogram> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./stft.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<StftWorkerResponse>) => {
      const msg = e.data;
      if (msg.type === 'done') {
        worker.terminate();
        resolve({ ...msg.result, data: new Float32Array(msg.data) });
      } else if (msg.type === 'error') {
        worker.terminate();
        reject(new Error(msg.message));
      }
    };
    worker.onerror = (err) => {
      worker.terminate();
      reject(err instanceof ErrorEvent ? new Error(err.message) : new Error('STFT worker failed'));
    };
    const buf = mono.buffer.slice(0) as ArrayBuffer;
    const req: StftWorkerRequest = { mono: buf, sampleRate, params };
    worker.postMessage(req, [buf]);
  });
}

/** 스펙트로그램을 NT×NF 로그-주파수 그리드로 다운샘플하고 0..1 로 정규화한다. */
function downsampleGrid(spec: Spectrogram, nt: number, nf: number): Float32Array {
  const grid = new Float32Array(nt * nf);
  if (spec.frames === 0 || spec.bins === 0) return grid;
  // 무음/평탄 신호: 정규화가 degenerate 해지므로 바닥 높이로 평탄 표시.
  if (spec.maxDb - spec.minDb < 1) {
    grid.fill(0.02);
    return grid;
  }

  const fLo = 20;
  const fHi = Math.min(20000, spec.sampleRate / 2);
  const logLo = Math.log(fLo);
  const logHi = Math.log(fHi);
  // 컬럼 f 의 주파수 경계(로그 등간격) → bin 인덱스 범위
  const binEdge = (j: number) => {
    const hz = Math.exp(logLo + ((logHi - logLo) * j) / nf);
    return Math.max(0, Math.min(spec.bins - 1, Math.round(hz / spec.freqStep)));
  };

  const lo = spec.maxDb - DISPLAY_RANGE_DB;
  const span = Math.max(1, spec.maxDb - lo);

  for (let t = 0; t < nt; t++) {
    const fStart = Math.floor((t * spec.frames) / nt);
    const fEnd = Math.max(fStart + 1, Math.floor(((t + 1) * spec.frames) / nt));
    for (let c = 0; c < nf; c++) {
      let bStart = binEdge(c);
      let bEnd = binEdge(c + 1);
      if (bEnd <= bStart) bEnd = bStart + 1;
      let sum = 0;
      let count = 0;
      for (let f = fStart; f < fEnd && f < spec.frames; f++) {
        const row = f * spec.bins;
        for (let b = bStart; b < bEnd && b < spec.bins; b++) {
          sum += spec.data[row + b];
          count++;
        }
      }
      const db = count > 0 ? sum / count : lo;
      const h = (db - lo) / span;
      grid[t * nf + c] = Math.max(0.02, Math.min(1, h));
    }
  }
  return grid;
}

/**
 * 선택 파일 버퍼를 분석해 워터폴 그리드 + noise floor/SNR 을 산출한다.
 * @param key 캐시 무효화 판정용 키(fileId+rate 등)
 */
export async function analyzePre(
  fileId: string,
  key: string,
  buffer: AudioBuffer,
  params: StftParams = DEFAULT_STFT_PARAMS,
): Promise<PreAnalysis> {
  const mono = bufferToMono(buffer);
  const spec = await runStftWorker(mono, buffer.sampleRate, params);

  const grid = downsampleGrid(spec, WATERFALL_NT, WATERFALL_NF);

  // noise floor: 가장 조용한 구간을 자동 탐색해 그 평균 dB 를 플로어로 사용
  const range = findQuietNoiseRange(spec);
  let floorDb = spec.minDb;
  if (range) {
    const print = buildNoisePrint(spec, range.startTime, range.endTime, 2);
    if (print && isFinite(print.avgDb)) floorDb = print.avgDb;
  }
  const snrDb = spec.maxDb - floorDb;

  return {
    fileId,
    key,
    nt: WATERFALL_NT,
    nf: WATERFALL_NF,
    grid,
    spectrogram: capSpectrogram(spec),
    floorDb,
    snrDb,
    binHz: spec.freqStep,
    fftSize: spec.fftSize,
    overlapPct: (1 - spec.hopSize / spec.fftSize) * 100,
    windowName: spec.window === 'hann' ? 'Hann' : spec.window === 'hamming' ? 'Hamming' : 'Blackman',
  };
}
