// FocusDAW Mastering Desk v0.2.24 (Phase 2) - STFT 스펙트럴 게이팅 노이즈 제거
// _refer/FocusSpectogram/src/audio/noiseReduction.ts 이식.
// noise print(주파수별 노이즈 지문) 기반 스펙트럴 차감을 오프라인으로 적용해
// denoised AudioBuffer 를 생성한다(실시간이 아닌 1회 처리·캐시 용도).
import { getAudioContext } from './decoder';
import { FFT } from './fft';
import { makeWindow, type StftParams } from './stft';
import type { NoisePrint } from './noisePrint';

export interface NoiseReductionOptions {
  thresholdDb: number;
  amount: number;
  floor: number;
  oversubFactor?: number;
}

function dbToAmp(db: number): number {
  return Math.pow(10, db / 20);
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function processChannel(
  input: Float32Array,
  print: NoisePrint,
  params: StftParams,
  options: NoiseReductionOptions,
  onProgress?: (p: number) => void,
): Float32Array {
  if (input.length === 0) return new Float32Array(0);

  const { fftSize, hopSize, window } = params;
  const bins = fftSize >> 1;
  const pad = fftSize;
  const paddedLength = input.length + pad * 2;
  const padded = new Float32Array(paddedLength);
  padded.set(input, pad);
  for (let i = 0; i < pad; i++) {
    const frontSrc = Math.min(i, input.length - 1);
    const backSrc = Math.max(0, input.length - 1 - i);
    padded[pad - 1 - i] = input[frontSrc];
    padded[pad + input.length + i] = input[backSrc];
  }

  const win = makeWindow(window, fftSize);
  let winSum = 0;
  for (let i = 0; i < fftSize; i++) winSum += win[i];
  const ampScale = 2 / winSum;
  const fft = new FFT(fftSize);
  const re = new Float32Array(fftSize);
  const im = new Float32Array(fftSize);
  const output = new Float32Array(paddedLength);
  const norm = new Float32Array(paddedLength);
  const frames = 1 + Math.floor((paddedLength - fftSize) / hopSize);
  const amount = clamp01(options.amount);
  const floor = clamp01(options.floor);
  const thresholdDb = Math.max(0, options.thresholdDb);
  const oversub = options.oversubFactor !== undefined ? options.oversubFactor : 1.0;
  const progressEvery = Math.max(1, Math.floor(Math.max(1, frames) / 100));

  const thresholdAmp = new Float32Array(bins);
  const subAmp = new Float32Array(bins);

  for (let k = 0; k < bins; k++) {
    const profileDb = print.profileDb[Math.min(k, print.profileDb.length - 1)];
    const noiseAmpK = dbToAmp(profileDb) / ampScale;
    thresholdAmp[k] = Math.max(0, (Math.pow(10, (profileDb + thresholdDb) / 20) - 1e-12) / ampScale);
    subAmp[k] = noiseAmpK * amount * oversub;
  }

  for (let f = 0; f < frames; f++) {
    const start = f * hopSize;
    for (let i = 0; i < fftSize; i++) {
      re[i] = padded[start + i] * win[i];
      im[i] = 0;
    }

    fft.transform(re, im);

    for (let k = 0; k < bins; k++) {
      const mag = Math.sqrt(re[k] * re[k] + im[k] * im[k]);
      if (mag <= 1e-12) continue;
      if (mag > thresholdAmp[k]) continue;

      const subtraction = subAmp[k] / mag;
      const gain = Math.max(floor, 1 - subtraction);
      re[k] *= gain;
      im[k] *= gain;

      if (k > 0) {
        const mirror = fftSize - k;
        re[mirror] *= gain;
        im[mirror] *= gain;
      }
    }

    fft.inverseTransform(re, im);

    for (let i = 0; i < fftSize; i++) {
      const idx = start + i;
      const w = win[i];
      output[idx] += re[i] * w;
      norm[idx] += w * w;
    }

    if (onProgress && f % progressEvery === 0) onProgress(f / Math.max(1, frames));
  }

  const result = new Float32Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const idx = i + pad;
    let sample = norm[idx] > 1e-8 ? output[idx] / norm[idx] : input[i];
    sample = Math.max(-1, Math.min(1, sample));
    result[i] = sample;
  }
  onProgress?.(1);

  return result;
}

/** 노이즈 지문 기반으로 채널별 스펙트럴 게이팅을 적용한 새 AudioBuffer 를 반환한다. */
export async function reduceNoiseBuffer(
  source: AudioBuffer,
  print: NoisePrint,
  params: StftParams,
  options: NoiseReductionOptions,
  onProgress?: (p: number) => void,
): Promise<AudioBuffer> {
  const ctx = getAudioContext();
  const out = ctx.createBuffer(source.numberOfChannels, source.length, source.sampleRate);

  for (let ch = 0; ch < source.numberOfChannels; ch++) {
    const progressBase = ch / source.numberOfChannels;
    const progressScale = 1 / source.numberOfChannels;
    const processed = processChannel(
      source.getChannelData(ch),
      print,
      params,
      options,
      (p) => onProgress?.(progressBase + p * progressScale),
    );
    out.copyToChannel(new Float32Array(processed), ch);
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  onProgress?.(1);
  return out;
}

/** noise print 없이 채널 PCM 만으로 동기 처리(시험/오프라인 검증용). */
export function reduceNoiseChannel(
  input: Float32Array,
  print: NoisePrint,
  params: StftParams,
  options: NoiseReductionOptions,
): Float32Array {
  return processChannel(input, print, params, options);
}
